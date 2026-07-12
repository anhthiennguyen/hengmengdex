// Fully-automatic deck construction: pool legality check, dealing,
// prizes/hands, and the mulligan loop. Runs once when a battle is accepted
// — there is no manual deck-building UI for Pokemon/Trainer cards (see the
// plan's "Deck model" decision). Energy is handled separately: each player
// picks their own Energy loadout during Setup (see SetupPhase.jsx /
// lobbyEngine.js's submit_setup), not dealt from the Dex pool at all.

// Absolute floor: below this, even graceful scaling can't produce a
// non-degenerate game (each player needs a few Basics — for a Bench, not
// just a lone Active — and a couple of cards to draw). Above the floor,
// deck/hand/Prize sizes scale down smoothly toward the real 6-Prize/
// 7-card targets rather than hard-gating at the real game's scale, since a
// personal/casual Dex may only have a handful of cards. MIN_BASICS is 4
// (not 2) so that, split evenly, each player ends up with 2+ Basics
// instead of exactly 1 — a player with only 1 Basic in their whole deck
// has zero possible Bench, so their very first Knock Out ends the game
// instantly, which reads as a "random" early win/loss.
export const MIN_POOL_SIZE = 6;
export const MIN_BASICS = 4;
export const STARTING_HAND_SIZE = 7;
export const PRIZE_COUNT = 6;
export const MAX_DECK_SIZE = 60;
export const MAX_MULLIGAN_ATTEMPTS = 10;

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Cards authored before this feature shipped lack the new required fields —
// exclude them from battles rather than crash on them (their owner can
// re-save them through the new form to make them battle-eligible).
function isCompleteCard(card) {
  if (card.cardType === 'meng') {
    return (
      Array.isArray(card.attacks) &&
      card.attacks.length > 0 &&
      typeof card.stage === 'string' &&
      typeof card.retreatCost === 'number'
    );
  }
  if (card.cardType === 'trainer') {
    return card.trainerType === 'item' || card.trainerType === 'supporter';
  }
  return false;
}

export function checkPoolLegality(pool) {
  const cards = pool.filter(isCompleteCard);
  const basics = cards.filter((c) => c.cardType === 'meng' && c.stage === 'basic');
  return { legal: cards.length >= MIN_POOL_SIZE && basics.length >= MIN_BASICS, cards };
}

// Scales hand/Prize sizes down for small decks instead of always using the
// real game's fixed 7/6. Hand size is prioritized FIRST (up to the real 7),
// since a thin hand makes Setup barely playable — deck size no longer
// includes ~40% Energy padding (Energy moved to a separate Setup-time
// player choice, see energyLoadout.js), so decks are meaningfully smaller
// now than when this was tuned around Prizes-first. Deck-out is no longer
// a loss condition, so there's no need to defensively reserve cards against
// it — an empty deck just means no more draws, not a loss.
function scaledZones(totalCards) {
  const handSize = Math.max(1, Math.min(STARTING_HAND_SIZE, totalCards - 2));
  const afterHand = totalCards - handSize;
  const prizeCount = Math.max(0, Math.min(PRIZE_COUNT, afterHand - 1));
  return { prizeCount, handSize };
}

function buildDeckForPlayer(cards) {
  let deck = shuffle(cards);
  if (deck.length > MAX_DECK_SIZE) deck = deck.slice(0, MAX_DECK_SIZE);
  return deck;
}

function isBasic(card) {
  return card.cardType === 'meng' && card.stage === 'basic';
}

// Prize cards are just the top N of a shuffled deck, so on a small deck
// with few Basics it's entirely possible for EVERY Basic to land in the
// Prize pile by chance — leaving zero Basics anywhere in the drawable
// deck/hand. The mulligan loop then can never succeed (there's nothing
// left to draw into), so it spins until MAX_MULLIGAN_ATTEMPTS and gives
// up with a Basic-less hand — an un-playable Setup. Guarantee at least 1
// Basic stays outside the Prize slice by swapping it with a non-Basic
// from the drawable portion, if needed.
function keepOneBasicOutOfPrizes(deck, prizeCount) {
  const prizeSlice = deck.slice(0, prizeCount);
  const restSlice = deck.slice(prizeCount);
  if (restSlice.some(isBasic)) return deck; // already fine

  const basicIdx = prizeSlice.findIndex(isBasic);
  if (basicIdx === -1) return deck; // no Basics in the deck at all (shouldn't happen post-legality-gate)

  const nonBasicIdx = restSlice.findIndex((c) => !isBasic(c));
  if (nonBasicIdx === -1) return deck; // rest is somehow all Basics already — nothing to swap

  const swapped = [...deck];
  const restPos = prizeCount + nonBasicIdx;
  [swapped[basicIdx], swapped[restPos]] = [swapped[restPos], swapped[basicIdx]];
  return swapped;
}

function toInPlayInstance(card) {
  if (card.cardType === 'meng') {
    return {
      ...card,
      maxHp: card.hp,
      currentHp: card.hp,
      attachedEnergy: [],
      attackDamageModifier: 0,
      statuses: [],
      conditions: { primary: null, burned: null, poisoned: null },
      hasEnteredPlay: false,
      enteredPlayOnTurn: null,
      evolutionChainCardIds: [card.id],
    };
  }
  return { ...card, played: false };
}

// Runs the whole automatic deal: legality gate, dealing, prizes/hands, and
// mulligans. Returns { legal: false } on a bad pool, or
// the full initial per-player state pieces on success.
export function buildMatch(pool, players) {
  const { legal, cards } = checkPoolLegality(pool);
  if (!legal) return { legal: false };

  const [playerA, playerB] = players;
  const remaining = shuffle(cards);
  const dealtFirst = Math.random() < 0.5 ? playerA : playerB;
  const dealtSecond = dealtFirst === playerA ? playerB : playerA;

  const allocations = { [playerA]: [], [playerB]: [] };

  // Deal every Basic round-robin FIRST, before anything else, so Basics
  // split as evenly as possible between the two players (as opposed to
  // being scattered randomly among a big alternating deal, where one
  // player could easily end up with just a single Basic — and since only
  // Basics can ever be placed into the Active Spot or Bench, a deck with
  // only 1 Basic has zero possible Bench and loses the instant that one
  // Pokemon is Knocked Out). Every remaining (non-Basic) card is then
  // dealt alternately as before.
  const basics = remaining.filter((c) => c.cardType === 'meng' && c.stage === 'basic');
  const nonBasics = remaining.filter((c) => !(c.cardType === 'meng' && c.stage === 'basic'));

  let turn = dealtFirst;
  for (const basic of basics) {
    allocations[turn].push(basic);
    turn = turn === dealtFirst ? dealtSecond : dealtFirst;
  }
  for (const card of nonBasics) {
    allocations[turn].push(card);
    turn = turn === dealtFirst ? dealtSecond : dealtFirst;
  }

  const decks = {
    [playerA]: buildDeckForPlayer(allocations[playerA]).map(toInPlayInstance),
    [playerB]: buildDeckForPlayer(allocations[playerB]).map(toInPlayInstance),
  };

  const firstPlayer = Math.random() < 0.5 ? playerA : playerB;
  const prizePiles = {};
  const hands = {};
  const handSizes = {};
  const mulliganCounts = { [playerA]: 0, [playerB]: 0 };
  const log = [];

  for (const peerId of players) {
    const { prizeCount, handSize } = scaledZones(decks[peerId].length);
    handSizes[peerId] = handSize;
    decks[peerId] = keepOneBasicOutOfPrizes(decks[peerId], prizeCount);
    prizePiles[peerId] = decks[peerId].splice(0, prizeCount);
  }
  for (const peerId of players) {
    hands[peerId] = decks[peerId].splice(0, handSizes[peerId]);
  }

  for (const peerId of players) {
    let attempts = 0;
    while (
      !hands[peerId].some((c) => c.cardType === 'meng' && c.stage === 'basic') &&
      attempts < MAX_MULLIGAN_ATTEMPTS
    ) {
      const revealed = hands[peerId].map((c) => c.name).join(', ') || 'an empty hand';
      log.push(`A player had no Basic Pokemon and mulliganed (revealed: ${revealed}).`);
      decks[peerId] = shuffle([...decks[peerId], ...hands[peerId]]);
      hands[peerId] = decks[peerId].splice(0, handSizes[peerId]);
      mulliganCounts[peerId] += 1;
      attempts += 1;
    }
    if (attempts >= MAX_MULLIGAN_ATTEMPTS) {
      log.push('A player still had no Basic Pokemon after 10 mulligans, so this hand was kept as a rare edge case.');
    }
  }

  for (const peerId of players) {
    const opponentId = players.find((p) => p !== peerId);
    for (let i = 0; i < mulliganCounts[opponentId]; i++) {
      // Never let a bonus draw empty the deck entirely — on a small deck,
      // several opponent mulligans could otherwise drain a player to 0
      // cards before the game has even started, decking them out on their
      // very first mandatory draw with zero opportunity to have played.
      if (decks[peerId].length > 1) hands[peerId].push(decks[peerId].shift());
    }
  }

  return {
    legal: true,
    decks,
    hands,
    prizePiles,
    discard: { [playerA]: [], [playerB]: [] },
    firstPlayer,
    mulliganCounts,
    log,
  };
}
