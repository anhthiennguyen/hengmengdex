import { useState } from 'react';
import { X, ImagePlus, Loader2 } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resizeImageToDataUrl } from '../lib/resizeImage';
import { validateRules } from '../lib/ruleValidation';
import { validateAttacks, MAX_RETREAT_COST, STAGES } from '../lib/attackValidation';
import { POKEMON_TYPES } from '../lib/pokemonTypes';
import RuleBuilder from './RuleBuilder';
import AttacksEditor from './AttacksEditor';

// Firestore caps documents at 1MB; a resized 240px JPEG is normally a few
// dozen KB, so this only trips on pathological inputs.
const MAX_IMAGE_DATA_URL_LENGTH = 700_000;

const CARD_TYPES = [
  { value: 'meng', label: 'Pokemon' },
  { value: 'trainer', label: 'Trainer' },
];

const TRAINER_TYPES = [
  { value: 'item', label: 'Item', hint: 'Play any number per turn' },
  { value: 'supporter', label: 'Supporter', hint: 'Play only 1 per turn' },
];

function defaultAttack() {
  return { id: `attack-${Date.now()}`, name: '', cost: [], damage: 10, text: '' };
}

export default function MengForm({ user, dex, entry, entries = [], onClose }) {
  const isEditing = !!entry;

  const [cardType, setCardType] = useState(entry?.cardType ?? 'meng');
  const [name, setName] = useState(entry?.name ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [hp, setHp] = useState(entry?.hp != null ? String(entry.hp) : '');
  const [pokemonType, setPokemonType] = useState(entry?.type ?? 'normal');
  const [stage, setStage] = useState(entry?.stage ?? 'basic');
  const [evolvesFrom, setEvolvesFrom] = useState(entry?.evolvesFrom ?? null);
  const [weakness, setWeakness] = useState(entry?.weakness ?? null);
  const [resistance, setResistance] = useState(entry?.resistance ?? null);
  const [retreatCost, setRetreatCost] = useState(entry?.retreatCost != null ? String(entry.retreatCost) : '1');
  const [attacks, setAttacks] = useState(entry?.attacks ?? [defaultAttack()]);
  const [trainerType, setTrainerType] = useState(entry?.trainerType ?? null);
  const [rules, setRules] = useState(entry?.rules ?? []);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(entry?.imageUrl ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isMeng = cardType === 'meng';

  // Evolution targets: a Stage 1 must evolve from a Basic, a Stage 2 from a
  // Stage 1 — both restricted to this same dex's other Pokemon cards.
  const priorStage = stage === 'stage1' ? 'basic' : stage === 'stage2' ? 'stage1' : null;
  const evolutionCandidates = entries.filter(
    (e) => e.cardType === 'meng' && e.stage === priorStage && e.id !== entry?.id
  );

  function handleFileChange(e) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : entry?.imageUrl ?? null);
  }

  function handleStageChange(nextStage) {
    setStage(nextStage);
    if (nextStage === 'basic') setEvolvesFrom(null);
    else setEvolvesFrom(null); // force re-pick when stage changes
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !description.trim() || (!isEditing && !file)) {
      setError('Name, description, and an image are all required.');
      return;
    }

    if (isMeng) {
      if (!/^\d+$/.test(hp)) {
        setError('HP must be a whole number.');
        return;
      }
      if (parseInt(hp, 10) > dex.maxHp) {
        setError(`HP can't exceed this dex's cap (${dex.maxHp} HP).`);
        return;
      }
      if (stage !== 'basic' && !evolvesFrom) {
        setError(`Choose which ${priorStage === 'basic' ? 'Basic' : 'Stage 1'} Pokemon this evolves from.`);
        return;
      }
      if (!/^\d+$/.test(retreatCost) || parseInt(retreatCost, 10) > MAX_RETREAT_COST) {
        setError(`Retreat cost must be a whole number from 0 to ${MAX_RETREAT_COST}.`);
        return;
      }
      const attacksCheck = validateAttacks(attacks, dex.maxAttack);
      if (!attacksCheck.valid) {
        setError(attacksCheck.error);
        return;
      }
    } else if (!trainerType) {
      setError('Choose whether this is an Item or Supporter card.');
      return;
    }

    const rulesCheck = validateRules(rules, cardType);
    if (!rulesCheck.valid) {
      setError(rulesCheck.error);
      return;
    }

    setBusy(true);
    try {
      let imageUrl = entry?.imageUrl ?? null;
      if (file) {
        imageUrl = await resizeImageToDataUrl(file);
        if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
          setError('That image is too large even after resizing. Try a simpler image.');
          setBusy(false);
          return;
        }
      }

      const fields = {
        cardType,
        name: name.trim(),
        description: description.trim(),
        imageUrl,
        rules,
        ...(isMeng
          ? {
              hp: parseInt(hp, 10),
              type: pokemonType,
              stage,
              evolvesFrom: stage === 'basic' ? null : evolvesFrom,
              weakness: weakness || null,
              resistance: resistance || null,
              retreatCost: parseInt(retreatCost, 10),
              attacks: attacks.map(({ id, name: attackName, cost, damage, text }) => ({
                id,
                name: attackName.trim(),
                cost,
                damage,
                text: text.trim(),
              })),
            }
          : { trainerType }),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'dexes', dex.id, 'meng', entry.id), fields);
      } else {
        await addDoc(collection(db, 'dexes', dex.id, 'meng'), {
          ...fields,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err) {
      setError(err.message || `Failed to ${isEditing ? 'save' : 'add'} card. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{isEditing ? 'Edit Card' : 'Add Card'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="flex rounded-lg bg-zinc-100 p-1 text-xs font-semibold">
            {CARD_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={isEditing}
                onClick={() => setCardType(t.value)}
                className={`flex-1 rounded-md py-1.5 transition disabled:cursor-not-allowed ${
                  cardType === t.value
                    ? 'bg-white text-[var(--dex-accent-600)] shadow'
                    : 'text-zinc-500'
                } ${isEditing ? 'opacity-60' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="mx-auto flex h-28 w-28 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 hover:border-[var(--dex-accent-400)] hover:text-[var(--dex-accent-500)]">
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <ImagePlus size={22} />
                <span className="mt-1 text-[11px] font-semibold">Upload image</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pikachu"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When several of these Pokemon gather, their electricity could build and cause lightning storms."
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
            />
          </div>

          {isMeng && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">HP (max {dex.maxHp})</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={dex.maxHp}
                    step="1"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                    placeholder="35"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Type</label>
                  <select
                    value={pokemonType}
                    onChange={(e) => setPokemonType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  >
                    {POKEMON_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Evolution Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Retreat Cost</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={MAX_RETREAT_COST}
                    step="1"
                    value={retreatCost}
                    onChange={(e) => setRetreatCost(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  />
                </div>
              </div>

              {stage !== 'basic' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    Evolves From ({priorStage === 'basic' ? 'a Basic' : 'a Stage 1'})
                  </label>
                  <select
                    value={evolvesFrom ?? ''}
                    onChange={(e) => setEvolvesFrom(e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  >
                    <option value="">Choose a card…</option>
                    {evolutionCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {evolutionCandidates.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      No eligible {priorStage === 'basic' ? 'Basic' : 'Stage 1'} Pokemon exist in this dex yet.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Weakness</label>
                  <select
                    value={weakness ?? ''}
                    onChange={(e) => setWeakness(e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  >
                    <option value="">None</option>
                    {POKEMON_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">Resistance</label>
                  <select
                    value={resistance ?? ''}
                    onChange={(e) => setResistance(e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
                  >
                    <option value="">None</option>
                    {POKEMON_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Attacks</label>
                <AttacksEditor attacks={attacks} onChange={setAttacks} maxDamage={dex.maxAttack} />
              </div>
            </>
          )}

          {!isMeng && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Trainer Type</label>
              <div className="flex gap-2">
                {TRAINER_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTrainerType(t.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition ${
                      trainerType === t.value
                        ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)]'
                        : 'border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="font-bold text-zinc-800">{t.label}</div>
                    <div className="text-zinc-500">{t.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              {isMeng ? 'Ability (optional)' : 'Effect'}
            </label>
            <RuleBuilder rules={rules} onChange={setRules} cardType={cardType} />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--dex-accent-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)] disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Saving…' : isEditing ? 'Save Changes' : 'Add to Dex'}
          </button>
        </form>
      </div>
    </div>
  );
}
