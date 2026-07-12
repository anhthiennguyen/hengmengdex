// Energy is no longer a self-chosen or auto-granted separate resource —
// it's real cards shuffled into the deck alongside the Pokemon/Trainer
// cards a player picked, drawn at random, and attached from hand, just
// like the real Pokemon TCG. A player can't "search" their deck for a
// specific type; they get whatever they draw. What we DO control is how
// many Energy cards of each type go into the deck in the first place —
// synthesized here from the types of Pokemon the player actually picked,
// since Energy cards themselves are never authored/stored in the Dex.

import { getTypeInfo } from '../lib/pokemonTypes';

// Energy cards make up roughly 2/(2+3) = 40% of the final deck (picked
// cards + Energy), which is in the neighborhood of a real 60-card deck's
// ~15-20 Energy cards, scaled down for small decks.
const ENERGY_RATIO = 2 / 3;

export function synthesizeEnergyCards(selectedCards) {
  const mengCards = (selectedCards || []).filter((c) => c.cardType === 'meng');
  if (mengCards.length === 0) return [];

  const energyCount = Math.ceil(selectedCards.length * ENERGY_RATIO);
  if (energyCount === 0) return [];

  const tally = {};
  for (const card of mengCards) tally[card.type] = (tally[card.type] || 0) + 1;
  const types = Object.keys(tally);

  // Largest-remainder rounding: split energyCount across the represented
  // types proportional to how often each appears among the picked Pokemon.
  const shares = types.map((type) => (tally[type] / mengCards.length) * energyCount);
  const counts = Object.fromEntries(types.map((type, i) => [type, Math.floor(shares[i])]));
  const allocated = Object.values(counts).reduce((a, b) => a + b, 0);
  const byRemainder = types
    .map((type, i) => ({ type, remainder: shares[i] - Math.floor(shares[i]) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < energyCount - allocated; i++) {
    counts[byRemainder[i % byRemainder.length].type] += 1;
  }

  // Every type the player actually picked a Pokemon of gets at least 1
  // Energy card, or that Pokemon could never attack no matter what's
  // drawn — steal a unit from whichever type currently has the most.
  for (const type of types) {
    if (counts[type] > 0) continue;
    const [biggestType] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (counts[biggestType] > 1) {
      counts[biggestType] -= 1;
      counts[type] = 1;
    }
  }

  const cards = [];
  let n = 0;
  for (const type of types) {
    for (let i = 0; i < counts[type]; i++) {
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
