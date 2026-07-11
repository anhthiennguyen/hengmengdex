import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useMyDexes } from '../hooks/useMyDexes';
import DexForm from './DexForm';
import Landing from './Landing';

export default function DexList({ user, onOpenDex, onOpenAuth }) {
  const { dexes, loading, error } = useMyDexes(user);
  const [showCreate, setShowCreate] = useState(false);

  if (!user) {
    return <Landing onOpenAuth={onOpenAuth} />;
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-zinc-900">My Dexes</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--dex-accent-600)] px-3 py-2 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)]"
        >
          <Plus size={16} />
          Create Dex
        </button>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16 text-sm font-semibold text-zinc-400">Loading…</div>
      ) : dexes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 py-16 text-center">
          <p className="text-sm font-semibold text-zinc-500">You haven't created or joined a dex yet.</p>
          <p className="mt-1 text-xs text-zinc-400">Create one, or open an invite link someone sent you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {dexes.map((dex) => (
            <button
              key={dex.id}
              type="button"
              onClick={() => onOpenDex(dex.id)}
              className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className="h-8 w-8 rounded-full border border-black/10"
                style={{ backgroundColor: dex.color }}
              />
              <span className="truncate text-sm font-bold text-zinc-800">{dex.name}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {dex.role}
              </span>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <DexForm
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={(dexId) => onOpenDex(dexId)}
        />
      )}
    </div>
  );
}
