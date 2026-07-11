import { Plus, X } from 'lucide-react';
import { MAX_ATTACKS, MAX_ATTACK_COST } from '../lib/attackValidation';
import { ENERGY_TYPES, getEnergyTypeInfo } from '../lib/pokemonTypes';

function makeId() {
  return `attack-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function defaultAttack() {
  return { id: makeId(), name: '', cost: [], damage: 10, text: '' };
}

const inputClass =
  'rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]';

export default function AttacksEditor({ attacks, onChange, maxDamage }) {
  function updateAttack(index, patch) {
    onChange(attacks.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function addAttack() {
    if (attacks.length >= MAX_ATTACKS) return;
    onChange([...attacks, defaultAttack()]);
  }

  function removeAttack(index) {
    if (attacks.length <= 1) return; // every Pokemon needs at least one attack
    onChange(attacks.filter((_, i) => i !== index));
  }

  function addCost(index, energyType) {
    const attack = attacks[index];
    if (attack.cost.length >= MAX_ATTACK_COST) return;
    updateAttack(index, { cost: [...attack.cost, energyType] });
  }

  function removeCost(index, costIndex) {
    const attack = attacks[index];
    updateAttack(index, { cost: attack.cost.filter((_, i) => i !== costIndex) });
  }

  return (
    <div className="grid gap-3">
      {attacks.map((attack, index) => (
        <div key={attack.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={attack.name}
              onChange={(e) => updateAttack(index, { name: e.target.value })}
              placeholder="Thunder Shock"
              className={`${inputClass} flex-1`}
            />
            {attacks.length > 1 && (
              <button
                type="button"
                onClick={() => removeAttack(index)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                aria-label="Remove attack"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="mb-2">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-500">Energy Cost</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {attack.cost.map((energyType, costIndex) => {
                const info = getEnergyTypeInfo(energyType);
                return (
                  <span
                    key={costIndex}
                    className="flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: info.color }}
                  >
                    {info.label}
                    <button
                      type="button"
                      onClick={() => removeCost(index, costIndex)}
                      className="rounded-full p-0.5 hover:bg-black/20"
                      aria-label="Remove Energy"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              {attack.cost.length < MAX_ATTACK_COST && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addCost(index, e.target.value);
                  }}
                  className={`${inputClass} py-1 text-xs`}
                >
                  <option value="">+ Add Energy</option>
                  {ENERGY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <label className="text-[11px] font-semibold text-zinc-500">Damage (max {maxDamage})</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max={maxDamage}
              value={attack.damage}
              onChange={(e) => updateAttack(index, { damage: parseInt(e.target.value, 10) || 0 })}
              className={`${inputClass} w-20`}
            />
          </div>

          <textarea
            value={attack.text}
            onChange={(e) => updateAttack(index, { text: e.target.value })}
            placeholder="Attack text (optional, flavor only)"
            rows={2}
            className={`${inputClass} w-full resize-none`}
          />
        </div>
      ))}

      {attacks.length < MAX_ATTACKS && (
        <button
          type="button"
          onClick={addAttack}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-bold text-zinc-500 hover:border-[var(--dex-accent-400)] hover:text-[var(--dex-accent-600)]"
        >
          <Plus size={14} /> Add Attack
        </button>
      )}
    </div>
  );
}
