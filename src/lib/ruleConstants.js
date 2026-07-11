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

export const PLAY_TRIGGER = { value: 'on_play', label: 'Played' };

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

// Inflict/cure a Special Condition (Asleep/Confused/Paralyzed/Burned/
// Poisoned). Unlike EFFECT_ACTIONS these carry no amount/duration — they're
// a bare { action } shape. On the 4 meng triggers these target the
// opponent's current Active Pokemon (e.g. "on_hit: inflict_poisoned" reads
// as "when hit, poison the attacker"); on a Trainer's on_play they target
// the player's own Active, same as today's HP/Attack effects.
export const STATUS_EFFECT_ACTIONS = [
  { value: 'inflict_asleep', label: "Put Opponent's Active to Sleep" },
  { value: 'inflict_confused', label: "Confuse Opponent's Active" },
  { value: 'inflict_paralyzed', label: "Paralyze Opponent's Active" },
  { value: 'inflict_burned', label: "Burn Opponent's Active" },
  { value: 'inflict_poisoned', label: "Poison Opponent's Active" },
  { value: 'cure_all_conditions', label: 'Cure All Special Conditions' },
];

export const ALL_EFFECT_ACTIONS = [...EFFECT_ACTIONS, ...STATUS_EFFECT_ACTIONS];
export const STATUS_EFFECT_ACTION_VALUES = STATUS_EFFECT_ACTIONS.map((a) => a.value);

export function defaultTriggerForCardType(cardType) {
  return cardType === 'meng' ? MENG_TRIGGERS[0].value : PLAY_TRIGGER.value;
}
