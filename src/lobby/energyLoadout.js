// Energy is no longer a self-chosen or auto-granted separate resource —
// it's real cards shuffled into the deck alongside the Pokemon/Trainer
// cards a player picked, drawn at random, and attached from hand, just
// like the real Pokemon TCG. A player can't "search" their deck for a
// specific type; they get whatever they draw. What we DO control is how
// many Energy cards go into the deck in the first place, and that's done
// deterministically, not statistically: every picked Pokemon contributes
// exactly the Energy its own attacks need, so a picked Pokemon is never
// mathematically unusable for lack of that type existing anywhere in the
// deck — since Energy cards themselves are never authored/stored in the
// Dex, they have to be synthesized here.

import { getTypeInfo } from '../lib/pokemonTypes';

// Energy is a scarce, non-renewing resource once shuffled into the deck —
// KO'd Pokemon take their attached Energy to the discard pile with them,
// and nothing puts it back. A bare-minimum supply runs dry fast, so every
// type's dedicated count gets padded well beyond what any single card
// strictly needs.
const ENERGY_BUFFER_MULTIPLIER = 2;

// How much Energy (per type) one Pokemon card needs to be able to use
// ANY of its attacks — the max per type across its attacks, since
// attached Energy is permanent (never consumed by attacking) and only
// needs to cover whichever attack gets used. Colorless slots are filled
// with the card's own type, since that's what a real deck for that
// Pokemon would mostly run.
function energyNeededForCard(card) {
  const perType = {};
  for (const attack of card.attacks || []) {
    const attackTyped = {};
    let colorlessCount = 0;
    for (const cost of attack.cost || []) {
      if (cost === 'colorless') colorlessCount += 1;
      else attackTyped[cost] = (attackTyped[cost] || 0) + 1;
    }
    if (colorlessCount > 0) {
      attackTyped[card.type] = (attackTyped[card.type] || 0) + colorlessCount;
    }
    for (const [type, count] of Object.entries(attackTyped)) {
      perType[type] = Math.max(perType[type] || 0, count);
    }
  }
  return perType;
}

export function synthesizeEnergyCards(selectedCards) {
  const totals = {};
  for (const card of selectedCards || []) {
    if (card.cardType !== 'meng') continue;
    const need = energyNeededForCard(card);
    for (const [type, count] of Object.entries(need)) {
      totals[type] = (totals[type] || 0) + count;
    }
  }

  const cards = [];
  let n = 0;
  for (const [type, count] of Object.entries(totals)) {
    const buffered = Math.ceil(count * ENERGY_BUFFER_MULTIPLIER);
    for (let i = 0; i < buffered; i++) {
      n += 1;
      cards.push({
        id: `energy-${type}-${n}`,
        cardType: 'energy',
        energyType: type,
        name: `${getTypeInfo(type).label} Energy`,
        synthetic: true,
      });
    }
  }
  return cards;
}
