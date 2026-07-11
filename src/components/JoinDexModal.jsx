import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { joinDex } from '../lib/joinDex';

export default function JoinDexModal({ user, dex, dexId, onClose, onOpenAuth }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    setBusy(true);
    setError('');
    try {
      await joinDex(user, dexId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to join. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <span
          className="mx-auto mb-3 block h-12 w-12 rounded-full border border-black/10"
          style={{ backgroundColor: dex.color }}
        />
        <h2 className="text-lg font-bold text-zinc-900">You've been invited to</h2>
        <p className="mb-4 text-2xl font-extrabold text-zinc-900">{dex.name}</p>

        {!user ? (
          <>
            <p className="mb-4 text-sm text-zinc-500">Log in or sign up to join this dex.</p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full rounded-lg bg-[var(--dex-accent-600)] py-2.5 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
            >
              Log In / Sign Up
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              Join to add your own entries and battle in this dex.
            </p>
            {error && <p className="mb-3 text-xs font-medium text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleJoin}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--dex-accent-600)] py-2.5 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)] disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {busy ? 'Joining…' : 'Join Dex'}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs font-semibold text-zinc-400 hover:text-zinc-600"
        >
          Just browse instead
        </button>
      </div>
    </div>
  );
}
