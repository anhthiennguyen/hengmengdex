// Fully-automatic deck construction: pool legality check, Energy
// synthesis, dealing, prizes/hands, and the mulligan loop. Runs once when a
// battle is accepted — there is no manual deck-building UI (see the plan's
// "Deck model" decision).

import { getEnergyTypeInfo } from '../lib/pokemonTypes';

export const MIN_POOL_SIZE = 20;
export const MIN_BASICS = 2;
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

// Distributes `energyCount` Energy cards across the elemental types present
// among `mengCards`, proportional to how often each type appears, via the
// largest-remainder rounding method. Guarantees every represented type gets
// at least 1 Energy (stealing from the currently-largest type) so a deck's
// only Fire attacker is never left with zero Fire Energy to draw into.
function synthesizeEnergy(mengCards, energyCount) {
  if (energyCount <= 0 || mengCards.length === 0) return [];

  const tally = {};
  for (const card of mengCards) {
    tally[card.type] = (tally[card.type] || 0) + 1;
  }
  const types = Object.keys(tally);
  const total = mengCards.length;

  const raw = types.map((t) => (energyCount * tally[t]) / total);
  const counts = raw.map(Math.floor);
  let leftover = energyCount - counts.reduce((a, b) => a + b, 0);

  const byRemainder = types
    .map((t, i) => ({ i, remainder: raw[i] - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let k = 0; k < leftover; k++) {
    counts[byRemainder[k % types.length].i] += 1;
  }
  leftover = 0;

  for (let i = 0; i < types.length; i++) {
    if (counts[i] > 0) continue;
    if (energyCount < types.length) break; // not enough Energy to cover every type at all
    let maxIdx = 0;
    for (let j = 1; j < types.length; j++) if (counts[j] > counts[maxIdx]) maxIdx = j;
    if (counts[maxIdx] > 1) {
      counts[maxIdx] -= 1;
      counts[i] += 1;
    }
  }

  const energyCards = [];
  types.forEach((type, i) => {
    const info = getEnergyTypeInfo(type);
    for (let n = 0; n < counts[i]; n++) {
      energyCards.push({
        id: `energy-${type}-${energyCards.length}-${Date.now()}`,
        cardType: 'energy',
        energyType: type,
        name: `${info.label} Energy`,
        synthetic: true,
      });
    }
  });
  return energyCards;
}

function buildDeckForPlayer(cards) {
  const mengCards = cards.filter((c) => c.cardType === 'meng');
  const energyCount = Math.ceil((cards.length * 2) / 3);
  const energy = synthesizeEnergy(mengCards, energyCount);
  let deck = shuffle([...cards, ...energy]);
  if (deck.length > MAX_DECK_SIZE) deck = deck.slice(0, MAX_DECK_SIZE);
  return deck;
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

// Runs the whole automatic deal: legality gate, dealing, Energy synthesis,
// prizes/hands, and mulligans. Returns { legal: false } on a bad pool, or
// the full initial per-player state pieces on success.
export function buildMatch(pool, players) {
  const { legal, cards } = checkPoolLegality(pool);
  if (!legal) return { legal: false };

  const [playerA, playerB] = players;
  const remaining = shuffle(cards);
  const dealtFirst = Math.random() < 0.5 ? playerA : playerB;
  const dealtSecond = dealtFirst === playerA ? playerB : playerA;

  const allocations = { [playerA]: [], [playerB]: [] };

  // Guaranteed-basic seeding: every deck gets >=1 Basic before the rest is
  // dealt out — mulligans still handle "not necessarily in the opening hand."
  for (const peerId of [dealtFirst, dealtSecond]) {
    const idx = remaining.findIndex((c) => c.cardType === 'meng' && c.stage === 'basic');
    if (idx !== -1) allocations[peerId].push(remaining.splice(idx, 1)[0]);
  }

  let turn = dealtFirst;
  while (remaining.length > 0) {
    allocations[turn].push(remaining.shift());
    turn = turn === dealtFirst ? dealtSecond : dealtFirst;
  }

  const decks = {
    [playerA]: buildDeckForPlayer(allocations[playerA]).map(toInPlayInstance),
    [playerB]: buildDeckForPlayer(allocations[playerB]).map(toInPlayInstance),
  };

  const firstPlayer = Math.random() < 0.5 ? playerA : playerB;
  const prizePiles = {};
  const hands = {};
  const mulliganCounts = { [playerA]: 0, [playerB]: 0 };
  const log = [];

  for (const peerId of players) {
    prizePiles[peerId] = decks[peerId].splice(0, PRIZE_COUNT);
  }
  for (const peerId of players) {
    hands[peerId] = decks[peerId].splice(0, STARTING_HAND_SIZE);
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
      hands[peerId] = decks[peerId].splice(0, STARTING_HAND_SIZE);
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
      if (decks[peerId].length > 0) hands[peerId].push(decks[peerId].shift());
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
