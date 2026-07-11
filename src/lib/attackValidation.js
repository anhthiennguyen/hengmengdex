import { ENERGY_TYPE_VALUES } from './pokemonTypes';

export const MAX_ATTACKS = 4;
export const MAX_ATTACK_COST = 5;
export const MAX_ATTACK_NAME_LENGTH = 40;
export const MAX_ATTACK_TEXT_LENGTH = 300;
export const MAX_RETREAT_COST = 4;

export const STAGES = [
  { value: 'basic', label: 'Basic' },
  { value: 'stage1', label: 'Stage 1' },
  { value: 'stage2', label: 'Stage 2' },
];

function validateAttack(attack, maxDamage) {
  if (!attack || typeof attack !== 'object') return 'Each attack needs a name.';
  if (!attack.name || !attack.name.trim() || attack.name.length > MAX_ATTACK_NAME_LENGTH) {
    return `Attack names must be 1-${MAX_ATTACK_NAME_LENGTH} characters.`;
  }
  if (!Array.isArray(attack.cost) || attack.cost.length > MAX_ATTACK_COST) {
    return `An attack can have at most ${MAX_ATTACK_COST} Energy in its cost.`;
  }
  if (attack.cost.some((c) => !ENERGY_TYPE_VALUES.includes(c))) {
    return 'Invalid Energy type in an attack cost.';
  }
  if (!Number.isInteger(attack.damage) || attack.damage < 0 || attack.damage > maxDamage) {
    return `Attack damage must be a whole number between 0 and ${maxDamage}.`;
  }
  if ((attack.text || '').length > MAX_ATTACK_TEXT_LENGTH) {
    return `Attack text must be at most ${MAX_ATTACK_TEXT_LENGTH} characters.`;
  }
  return null;
}

export function validateAttacks(attacks, maxDamage) {
  if (!Array.isArray(attacks) || attacks.length < 1 || attacks.length > MAX_ATTACKS) {
    return { valid: false, error: `A Pokemon needs 1 to ${MAX_ATTACKS} attacks.` };
  }
  for (const attack of attacks) {
    const err = validateAttack(attack, maxDamage);
    if (err) return { valid: false, error: err };
  }
  return { valid: true, error: null };
}
