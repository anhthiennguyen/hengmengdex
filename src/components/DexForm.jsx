import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAX_CAP = 999999;

export default function DexForm({ user, dex, onClose, onCreated }) {
  const isEditing = !!dex;

  const [name, setName] = useState(dex?.name ?? '');
  const [color, setColor] = useState(dex?.color ?? '#4169e1');
  const [maxHp, setMaxHp] = useState(dex?.maxHp != null ? String(dex.maxHp) : '100');
  const [maxAttack, setMaxAttack] = useState(dex?.maxAttack != null ? String(dex.maxAttack) : '100');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function validCap(value) {
    return /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= MAX_CAP;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!validCap(maxHp) || !validCap(maxAttack)) {
      setError(`Max HP and Max Attack must be whole numbers between 1 and ${MAX_CAP.toLocaleString()}.`);
      return;
    }

    setBusy(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'dexes', dex.id), {
          name: name.trim(),
          color,
          maxHp: parseInt(maxHp, 10),
          maxAttack: parseInt(maxAttack, 10),
        });
      } else {
        // Sequential, not batched: the membership doc's create rule has to
        // get() the dex doc to confirm ownership, and within one atomic
        // batch that get() can't see a doc being created in the same batch
        // (it still reads as "doesn't exist"), so a batched write here
        // always fails with permission-denied. The dex must exist first.
        const dexRef = doc(collection(db, 'dexes'));
        await setDoc(dexRef, {
          name: name.trim(),
          color,
          maxHp: parseInt(maxHp, 10),
          maxAttack: parseInt(maxAttack, 10),
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
        try {
          await setDoc(doc(db, 'memberships', `${user.uid}_${dexRef.id}`), {
            uid: user.uid,
            dexId: dexRef.id,
            role: 'owner',
            joinedAt: serverTimestamp(),
          });
        } catch (membershipErr) {
          await deleteDoc(dexRef).catch(() => {});
          throw membershipErr;
        }
        onCreated?.(dexRef.id);
      }
      onClose();
    } catch (err) {
      setError(err.message || `Failed to ${isEditing ? 'save' : 'create'} dex. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{isEditing ? 'Edit Dex' : 'Create Dex'}</h2>
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
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-zinc-300 p-1"
              aria-label="Dex color"
            />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Meng"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Max HP</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={maxHp}
                onChange={(e) => setMaxHp(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Max Attack</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={maxAttack}
                onChange={(e) => setMaxAttack(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
              />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-zinc-400">
            No entry in this dex can have HP or Attack above these caps.
          </p>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--dex-accent-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)] disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Dex'}
          </button>
        </form>
      </div>
    </div>
  );
}
