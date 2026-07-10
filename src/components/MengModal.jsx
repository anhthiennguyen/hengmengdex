import { useState } from 'react';
import { X, Trash2, Pencil, Loader2 } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function MengModal({ meng, canManage, onClose, onEdit }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'meng', meng.id));
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-royal-500 to-royal-700 p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <img
            src={meng.imageUrl}
            alt={meng.name}
            className="mx-auto h-40 w-40 rounded-xl bg-white/90 object-contain p-2 shadow-lg"
          />
        </div>
        <div className="p-6">
          <h2 className="text-xl font-extrabold capitalize text-zinc-900">{meng.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{meng.description}</p>

          {(typeof meng.hp === 'number' || typeof meng.attack === 'number') && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-royal-50 px-3 py-2 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wide text-royal-500">HP</div>
                <div className="text-lg font-extrabold text-royal-700">{meng.hp ?? '—'}</div>
              </div>
              <div className="rounded-lg bg-royal-50 px-3 py-2 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wide text-royal-500">Attack</div>
                <div className="text-lg font-extrabold text-royal-700">{meng.attack ?? '—'}</div>
              </div>
            </div>
          )}

          {canManage && (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
              {confirming ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                    {deleting ? 'Deleting…' : 'Confirm delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center gap-1.5 text-sm font-semibold text-royal-600 transition hover:text-royal-700"
                  >
                    <Pencil size={14} />
                    Edit entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-red-600 transition hover:text-red-700"
                  >
                    <Trash2 size={14} />
                    Delete entry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
