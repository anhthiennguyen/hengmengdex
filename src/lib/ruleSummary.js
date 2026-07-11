import { MENG_TRIGGERS, PLAY_TRIGGER, CONDITION_FIELDS, EFFECT_ACTIONS } from './ruleConstants';

const TRIGGER_LABELS = Object.fromEntries(
  [...MENG_TRIGGERS, PLAY_TRIGGER].map((t) => [t.value, t.label])
);
const CONDITION_LABELS = Object.fromEntries(CONDITION_FIELDS.map((f) => [f.value, f.label]));
const ACTION_LABELS = Object.fromEntries(EFFECT_ACTIONS.map((a) => [a.value, a.label]));

export function summarizeEffect(effect) {
  if (!effect) return '';
  const actionLabel = ACTION_LABELS[effect.action] || effect.action;
  const durationText =
    effect.duration === 'permanent'
      ? 'permanently'
      : `for ${effect.duration} round${effect.duration === 1 ? '' : 's'}`;
  return `${actionLabel} ${effect.amount} ${durationText}`;
}

export function summarizeCondition(condition) {
  if (!condition) return '';
  const fieldLabel = CONDITION_LABELS[condition.field] || condition.field;
  return `${fieldLabel} ${condition.value}%`;
}

export function summarizeRule(rule) {
  if (!rule) return '';
  const triggerLabel = TRIGGER_LABELS[rule.trigger] || rule.trigger;
  const conditionPart = rule.condition ? `, if ${summarizeCondition(rule.condition)}` : '';
  const effectsText = (rule.effects || []).map(summarizeEffect).join('; ');
  return `When ${triggerLabel}${conditionPart}: ${effectsText}.`;
}

export function summarizeRules(rules) {
  if (!rules || rules.length === 0) return [];
  return rules.map(summarizeRule);
}
