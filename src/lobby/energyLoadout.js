// Each player's Energy is no longer dealt from the Dex pool — it's a
// self-chosen loadout (type -> quantity) picked during Setup, matching how
// real Pokemon TCG decks treat Basic Energy as copy-unlimited. The whole
// loadout is a standalone resource pool (battle.energyPools[peerId]), not
// part of the deck/hand, so a player can never be starved of Energy by bad
// shuffle luck the way a dealt-and-drawn card could be.

import { POKEMON_TYPE_VALUES } from '../lib/pokemonTypes';

export const MAX_ENERGY_PER_TYPE = 20;

export function validateEnergyLoadout(loadout) {
  if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout)) return null;

  const validated = {};
  for (const [type, count] of Object.entries(loadout)) {
    if (!POKEMON_TYPE_VALUES.includes(type)) return null;
    if (!Number.isInteger(count) || count < 0 || count > MAX_ENERGY_PER_TYPE) return null;
    if (count > 0) validated[type] = count;
  }
  return validated;
}

export function totalEnergy(pool) {
  return Object.values(pool || {}).reduce((sum, n) => sum + n, 0);
}
