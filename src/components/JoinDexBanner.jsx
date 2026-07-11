import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { joinDex } from '../lib/joinDex';

export default function JoinDexBanner({ user, dexId, onOpenAuth }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[var(--dex-accent-200)] bg-[var(--dex-accent-50)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--dex-accent-800)]">
          You're browsing as a guest. Log in to join and add entries.
        </span>
        <button
          type="button"
          onClick={onOpenAuth}
          className="shrink-0 rounded-lg bg-[var(--dex-accent-600)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--dex-accent-700)]"
        >
          Log In
        </button>
      </div>
    );
  }

  async function handleJoin() {
    setBusy(true);
    setError('');
    try {
      await joinDex(user, dexId);
    } catch (err) {
      setError(err.message || 'Failed to join. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[var(--dex-accent-200)] bg-[var(--dex-accent-50)] px-4 py-3">
      <div>
        <span className="text-sm font-semibold text-[var(--dex-accent-800)]">
          You're browsing as a guest. Join to add entries and battle.
        </span>
        {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        onClick={handleJoin}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--dex-accent-600)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--dex-accent-700)] disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
        Join Dex
      </button>
    </div>
  );
}
