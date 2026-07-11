// Standard Pokemon type palette (matches the widely-used Bulbapedia/TCG
// convention) so each type reads as visually distinct and recognizable.
export const POKEMON_TYPES = [
  { value: 'normal', label: 'Normal', color: '#A8A878' },
  { value: 'fire', label: 'Fire', color: '#F08030' },
  { value: 'water', label: 'Water', color: '#6890F0' },
  { value: 'electric', label: 'Electric', color: '#F8D030' },
  { value: 'grass', label: 'Grass', color: '#78C850' },
  { value: 'ice', label: 'Ice', color: '#98D8D8' },
  { value: 'fighting', label: 'Fighting', color: '#C03028' },
  { value: 'poison', label: 'Poison', color: '#A040A0' },
  { value: 'ground', label: 'Ground', color: '#E0C068' },
  { value: 'flying', label: 'Flying', color: '#A890F0' },
  { value: 'psychic', label: 'Psychic', color: '#F85888' },
  { value: 'bug', label: 'Bug', color: '#A8B820' },
  { value: 'rock', label: 'Rock', color: '#B8A038' },
  { value: 'ghost', label: 'Ghost', color: '#705898' },
  { value: 'dragon', label: 'Dragon', color: '#7038F8' },
  { value: 'dark', label: 'Dark', color: '#705848' },
  { value: 'steel', label: 'Steel', color: '#B8B8D0' },
  { value: 'fairy', label: 'Fairy', color: '#EE99AC' },
];

export const POKEMON_TYPE_VALUES = POKEMON_TYPES.map((t) => t.value);

const TYPE_MAP = Object.fromEntries(POKEMON_TYPES.map((t) => [t.value, t]));

export function getTypeInfo(value) {
  return TYPE_MAP[value] || TYPE_MAP.normal;
}

// A pseudo-type used only in attack Energy costs — never a valid `type`,
// `weakness`, or `resistance` value. Represents "any 1 Energy of any type,"
// matching the Pokemon TCG's colorless/star cost symbol.
export const COLORLESS_ENERGY = { value: 'colorless', label: 'Colorless', color: '#C6C6A7' };

// Energy costs can be paid with any of the 18 elemental types or Colorless.
export const ENERGY_TYPES = [...POKEMON_TYPES, COLORLESS_ENERGY];
export const ENERGY_TYPE_VALUES = ENERGY_TYPES.map((t) => t.value);

const ENERGY_TYPE_MAP = Object.fromEntries(ENERGY_TYPES.map((t) => [t.value, t]));

export function getEnergyTypeInfo(value) {
  return ENERGY_TYPE_MAP[value] || ENERGY_TYPE_MAP.colorless;
}
