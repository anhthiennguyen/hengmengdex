export const MAX_RULES = 3;
export const MAX_EFFECTS = 3;
export const MAX_AMOUNT = 9999;
export const MAX_ROUNDS = 99;

export const MENG_TRIGGERS = [
  { value: 'on_enter', label: 'Card Enters Battle' },
  { value: 'on_turn_start', label: 'Start of Your Turn' },
  { value: 'on_attack', label: 'This Card Attacks' },
  { value: 'on_hit', label: 'This Card Is Hit' },
];

export const PLAY_TRIGGER = { value: 'on_play', label: 'When Played' };

export const CONDITION_FIELDS = [
  { value: 'hp_below_percent', label: "This card's HP is below" },
  { value: 'hp_above_percent', label: "This card's HP is above" },
];

export const EFFECT_ACTIONS = [
  { value: 'add_hp', label: 'Add HP' },
  { value: 'subtract_hp', label: 'Subtract HP' },
  { value: 'add_attack', label: 'Add Attack' },
  { value: 'subtract_attack', label: 'Subtract Attack' },
];

export function defaultTriggerForCardType(cardType) {
  return cardType === 'meng' ? MENG_TRIGGERS[0].value : PLAY_TRIGGER.value;
}
