import { useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import {
  MAX_RULES,
  MAX_EFFECTS,
  MAX_AMOUNT,
  MAX_ROUNDS,
  MENG_TRIGGERS,
  CONDITION_FIELDS,
  EFFECT_ACTIONS,
  defaultTriggerForCardType,
} from '../lib/ruleConstants';
import { summarizeRule } from '../lib/ruleSummary';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function defaultEffect() {
  return { action: 'add_hp', amount: 10, duration: 'permanent' };
}

function defaultRule(cardType) {
  return {
    id: makeId('rule'),
    trigger: defaultTriggerForCardType(cardType),
    condition: null,
    effects: [defaultEffect()],
  };
}

const inputClass =
  'rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]';

export default function RuleBuilder({ rules, onChange, cardType }) {
  const isMeng = cardType === 'meng';

  // Item/Trainer cards always carry exactly one implicit "on play" rule.
  useEffect(() => {
    if (!isMeng && rules.length !== 1) {
      onChange([defaultRule(cardType)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMeng]);

  function updateRule(index, patch) {
    const next = rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  }

  function addRule() {
    if (rules.length >= MAX_RULES) return;
    onChange([...rules, defaultRule(cardType)]);
  }

  function removeRule(index) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function addCondition(index) {
    updateRule(index, { condition: { field: 'hp_below_percent', value: 50 } });
  }

  function updateCondition(index, patch) {
    const rule = rules[index];
    updateRule(index, { condition: { ...rule.condition, ...patch } });
  }

  function removeCondition(index) {
    updateRule(index, { condition: null });
  }

  function addEffect(index) {
    const rule = rules[index];
    if (rule.effects.length >= MAX_EFFECTS) return;
    updateRule(index, { effects: [...rule.effects, defaultEffect()] });
  }

  function updateEffect(ruleIndex, effectIndex, patch) {
    const rule = rules[ruleIndex];
    const effects = rule.effects.map((e, i) => (i === effectIndex ? { ...e, ...patch } : e));
    updateRule(ruleIndex, { effects });
  }

  function removeEffect(ruleIndex, effectIndex) {
    const rule = rules[ruleIndex];
    if (rule.effects.length <= 1) return; // every rule needs at least one effect
    updateRule(ruleIndex, { effects: rule.effects.filter((_, i) => i !== effectIndex) });
  }

  return (
    <div className="grid gap-3">
      {rules.map((rule, ruleIndex) => (
        <div key={rule.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            {isMeng ? (
              <select
                value={rule.trigger}
                onChange={(e) => updateRule(ruleIndex, { trigger: e.target.value })}
                className={inputClass}
              >
                {MENG_TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    When {t.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-bold text-zinc-700">When Played</span>
            )}
            {isMeng && (
              <button
                type="button"
                onClick={() => removeRule(ruleIndex)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                aria-label="Remove rule"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {rule.condition ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
              <span className="text-xs font-semibold text-zinc-500">If</span>
              <select
                value={rule.condition.field}
                onChange={(e) => updateCondition(ruleIndex, { field: e.target.value })}
                className={inputClass}
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="99"
                value={rule.condition.value}
                onChange={(e) => updateCondition(ruleIndex, { value: parseInt(e.target.value, 10) || 1 })}
                className={`${inputClass} w-16`}
              />
              <span className="text-xs font-semibold text-zinc-500">%</span>
              <button
                type="button"
                onClick={() => removeCondition(ruleIndex)}
                className="ml-auto rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Remove condition"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addCondition(ruleIndex)}
              className="mb-2 flex items-center gap-1 text-xs font-semibold text-[var(--dex-accent-600)] hover:text-[var(--dex-accent-700)]"
            >
              <Plus size={12} /> Add Condition
            </button>
          )}

          <div className="grid gap-1.5">
            {rule.effects.map((effect, effectIndex) => (
              <div key={effectIndex} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
                <select
                  value={effect.action}
                  onChange={(e) => updateEffect(ruleIndex, effectIndex, { action: e.target.value })}
                  className={inputClass}
                >
                  {EFFECT_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max={MAX_AMOUNT}
                  value={effect.amount}
                  onChange={(e) =>
                    updateEffect(ruleIndex, effectIndex, { amount: parseInt(e.target.value, 10) || 1 })
                  }
                  className={`${inputClass} w-20`}
                />
                <select
                  value={effect.duration === 'permanent' ? 'permanent' : 'rounds'}
                  onChange={(e) =>
                    updateEffect(ruleIndex, effectIndex, {
                      duration: e.target.value === 'permanent' ? 'permanent' : 3,
                    })
                  }
                  className={inputClass}
                >
                  <option value="permanent">Permanently</option>
                  <option value="rounds">For N rounds</option>
                </select>
                {effect.duration !== 'permanent' && (
                  <>
                    <input
                      type="number"
                      min="1"
                      max={MAX_ROUNDS}
                      value={effect.duration}
                      onChange={(e) =>
                        updateEffect(ruleIndex, effectIndex, { duration: parseInt(e.target.value, 10) || 1 })
                      }
                      className={`${inputClass} w-16`}
                    />
                    <span className="text-xs font-semibold text-zinc-500">rounds</span>
                  </>
                )}
                {rule.effects.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEffect(ruleIndex, effectIndex)}
                    className="ml-auto rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    aria-label="Remove effect"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {rule.effects.length < MAX_EFFECTS && (
            <button
              type="button"
              onClick={() => addEffect(ruleIndex)}
              className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--dex-accent-600)] hover:text-[var(--dex-accent-700)]"
            >
              <Plus size={12} /> Add Effect
            </button>
          )}

          <p className="mt-2 rounded-lg bg-[var(--dex-accent-50)] px-2 py-1.5 text-xs text-[var(--dex-accent-800)]">
            {summarizeRule(rule)}
          </p>
        </div>
      ))}

      {isMeng && rules.length < MAX_RULES && (
        <button
          type="button"
          onClick={addRule}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-bold text-zinc-500 hover:border-[var(--dex-accent-400)] hover:text-[var(--dex-accent-600)]"
        >
          <Plus size={14} /> Add Rule
        </button>
      )}
    </div>
  );
}
