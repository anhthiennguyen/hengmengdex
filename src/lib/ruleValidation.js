import {
  MAX_RULES,
  MAX_EFFECTS,
  MAX_AMOUNT,
  MAX_ROUNDS,
  MENG_TRIGGERS,
  PLAY_TRIGGER,
  CONDITION_FIELDS,
  EFFECT_ACTIONS,
} from './ruleConstants';

const MENG_TRIGGER_VALUES = MENG_TRIGGERS.map((t) => t.value);
const CONDITION_FIELD_VALUES = CONDITION_FIELDS.map((f) => f.value);
const EFFECT_ACTION_VALUES = EFFECT_ACTIONS.map((a) => a.value);

function validateEffect(effect) {
  if (!effect || typeof effect !== 'object') return 'Each effect needs an action.';
  if (!EFFECT_ACTION_VALUES.includes(effect.action)) return 'Invalid effect action.';
  if (!Number.isInteger(effect.amount) || effect.amount < 1 || effect.amount > MAX_AMOUNT) {
    return `Amount must be a whole number between 1 and ${MAX_AMOUNT}.`;
  }
  if (effect.duration !== 'permanent') {
    if (!Number.isInteger(effect.duration) || effect.duration < 1 || effect.duration > MAX_ROUNDS) {
      return `Duration must be "Permanent" or a whole number of rounds between 1 and ${MAX_ROUNDS}.`;
    }
  }
  return null;
}

function validateCondition(condition) {
  if (condition == null) return null;
  if (!CONDITION_FIELD_VALUES.includes(condition.field)) return 'Invalid condition field.';
  if (!Number.isInteger(condition.value) || condition.value < 1 || condition.value > 99) {
    return 'Condition percentage must be a whole number between 1 and 99.';
  }
  return null;
}

function validateRule(rule, cardType) {
  if (!rule || typeof rule !== 'object') return 'Invalid rule.';
  const allowedTriggers = cardType === 'meng' ? MENG_TRIGGER_VALUES : [PLAY_TRIGGER.value];
  if (!allowedTriggers.includes(rule.trigger)) return 'Invalid trigger for this card type.';

  const conditionError = validateCondition(rule.condition ?? null);
  if (conditionError) return conditionError;

  if (!Array.isArray(rule.effects) || rule.effects.length < 1 || rule.effects.length > MAX_EFFECTS) {
    return `Each rule needs 1 to ${MAX_EFFECTS} effects.`;
  }
  for (const effect of rule.effects) {
    const err = validateEffect(effect);
    if (err) return err;
  }
  return null;
}

export function validateRules(rules, cardType) {
  if (!Array.isArray(rules)) return { valid: false, error: 'Rules must be a list.' };
  if (rules.length > MAX_RULES) {
    return { valid: false, error: `A card can have at most ${MAX_RULES} rules.` };
  }

  if (cardType !== 'meng' && rules.length !== 1) {
    return { valid: false, error: 'Item and Trainer cards need exactly one effect.' };
  }

  for (const rule of rules) {
    const err = validateRule(rule, cardType);
    if (err) return { valid: false, error: err };
  }

  return { valid: true, error: null };
}
