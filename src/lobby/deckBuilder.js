// Deck construction from a player's own manual card selection: each player
// independently picks whichever Pokemon/Trainer cards they want from the
// full Dex pool (overlap with the opponent's picks is fine — these are
// two separate personal decks, not a shared pool being split) via
// lobbyEngine.js's submit_deck intent. This module just takes that
// selection and turns it into a shuffled deck + dealt Prizes/hand, with
// the same mulligan safety net as before. Energy is a separate, unlimited
// per-type Setup-time choice — see energyLoadout.js — not part of the deck.

// The host picks the exact deck size when creating the lobby (not a fixed
// app-wide constant) — every player must then pick EXACTLY that many
// cards, so both decks are always the same size and get identical
// hand/Prize scaling. These are just the bounds on that choice.
export const MIN_DECK_BASICS = 2;
export const MIN_REQUIRED_DECK_SIZE = MIN_DECK_BASICS;
export const DEFAULT_DECK_SIZE = 10;

// Keeps the host's requested size sane: never below what a legal deck
// needs, and — per the pool it'll actually be drawn from — never above
// how many eligible cards exist, so the requirement can never be
// impossible to meet.
export function clampDeckSize(requested, poolSize) {
  const n = Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_DECK_SIZE;
  return Math.max(MIN_REQUIRED_DECK_SIZE, Math.min(n, poolSize));
}
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

function isBasic(card) {
  return card.cardType === 'meng' && card.stage === 'basic';
}

// The pool a player is allowed to pick from — battle-eligible cards only.
export function eligiblePool(pool) {
  return pool.filter(isCompleteCard);
}

// Is this Dex even big enough for anyone to be able to build a legal deck?
export function checkPoolLegality(pool) {
  const cards = eligiblePool(pool);
  const basics = cards.filter(isBasic);
  return { legal: cards.length >= MIN_REQUIRED_DECK_SIZE && basics.length >= MIN_DECK_BASICS, cards };
}

// Does this specific player's selection meet the host-chosen exact size?
export function checkSelectionLegality(selectedCards, requiredDeckSize) {
  const basics = selectedCards.filter(isBasic);
  return selectedCards.length === requiredDeckSize && basics.length >= MIN_DECK_BASICS;
}

// Scales hand/Prize sizes down for small decks instead of always using the
// real game's fixed 7/6. Prizes get a floor of 2 (never 1) — with only 1
// Prize, a single Knock Out instantly wins the game, which feels just as
// abrupt/"random" as the early bugs this whole system was built to avoid.
// Hand gets whatever's left after Prizes (up to the real 7), since a thin
// hand makes Setup barely playable. Deck-out is no longer a loss
// condition, so there's no need to defensively reserve cards against it —
// an empty deck just means no more draws, not a loss.
function scaledZones(totalCards) {
  const rawPrizeCount = Math.max(2, Math.floor(totalCards / 3));
  const prizeCount = Math.max(0, Math.min(PRIZE_COUNT, Math.min(rawPrizeCount, totalCards - 1)));
  const afterPrizes = totalCards - prizeCount;
  const handSize = Math.max(1, Math.min(STARTING_HAND_SIZE, afterPrizes));
  return { prizeCount, handSize };
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

// Turns one player's manually-selected cards into a shuffled deck plus
// dealt Prizes/hand, with the mulligan safety net. Returns
// { legal: false } if the selection doesn't meet the minimum.
export function buildPlayerDeck(selectedCards, requiredDeckSize) {
  if (!checkSelectionLegality(selectedCards, requiredDeckSize)) return { legal: false };

  let deck = shuffle(selectedCards).map(toInPlayInstance);
  if (deck.length > MAX_DECK_SIZE) deck = deck.slice(0, MAX_DECK_SIZE);

  const { prizeCount, handSize } = scaledZones(deck.length);
  deck = keepOneBasicOutOfPrizes(deck, prizeCount);
  const prizePile = deck.splice(0, prizeCount);
  let hand = deck.splice(0, handSize);

  const log = [];
  let mulliganCount = 0;
  let attempts = 0;
  while (!hand.some(isBasic) && attempts < MAX_MULLIGAN_ATTEMPTS) {
    const revealed = hand.map((c) => c.name).join(', ') || 'an empty hand';
    log.push(`A player had no Basic Pokemon and mulliganed (revealed: ${revealed}).`);
    deck = shuffle([...deck, ...hand]);
    hand = deck.splice(0, handSize);
    mulliganCount += 1;
    attempts += 1;
  }
  if (attempts >= MAX_MULLIGAN_ATTEMPTS) {
    log.push('A player still had no Basic Pokemon after 10 mulligans, so this hand was kept as a rare edge case.');
  }

  return { legal: true, deck, hand, prizePile, mulliganCount, log };
}

// Runs buildPlayerDeck for both players from their own independent
// selections, then applies the opponent-mulligan bonus draw. Returns
// { legal: false } if either player's own selection didn't meet the
// per-player minimum.
export function buildMatch(selections, players, requiredDeckSize) {
  const [playerA, playerB] = players;
  const built = {};
  for (const peerId of players) {
    built[peerId] = buildPlayerDeck(selections[peerId] || [], requiredDeckSize);
    if (!built[peerId].legal) return { legal: false };
  }

  const decks = { [playerA]: built[playerA].deck, [playerB]: built[playerB].deck };
  const hands = { [playerA]: built[playerA].hand, [playerB]: built[playerB].hand };
  const prizePiles = { [playerA]: built[playerA].prizePile, [playerB]: built[playerB].prizePile };
  const mulliganCounts = { [playerA]: built[playerA].mulliganCount, [playerB]: built[playerB].mulliganCount };
  const log = [...built[playerA].log, ...built[playerB].log];
  const firstPlayer = Math.random() < 0.5 ? playerA : playerB;

  for (const peerId of players) {
    const opponentId = players.find((p) => p !== peerId);
    for (let i = 0; i < mulliganCounts[opponentId]; i++) {
      // Never let a bonus draw empty the deck entirely.
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
