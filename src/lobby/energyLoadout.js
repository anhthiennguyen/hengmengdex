// Each player's Energy is no longer dealt from the Dex pool or manually
// picked — it's derived automatically from the deck they built: every
// Pokemon type present in their picked cards comes with a full pool of
// that type's Energy, matching how real Pokemon TCG decks treat Basic
// Energy as copy-unlimited. The whole loadout is a standalone resource
// pool (battle.energyPools[peerId]), not part of the deck/hand, so a
// player can never be starved of Energy by bad shuffle luck the way a
// dealt-and-drawn card could be — and since it's derived, not chosen, both
// players end up with the exact same rule applied to their own deck.

export const MAX_ENERGY_PER_TYPE = 20;

export function computeAutoEnergyLoadout(cards) {
  const types = new Set((cards || []).filter((c) => c.cardType === 'meng').map((c) => c.type));
  const loadout = {};
  for (const type of types) loadout[type] = MAX_ENERGY_PER_TYPE;
  return loadout;
}

export function totalEnergy(pool) {
  return Object.values(pool || {}).reduce((sum, n) => sum + n, 0);
}
