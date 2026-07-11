import { useState } from 'react';
import { Swords, Check, X } from 'lucide-react';

export default function Roster({ roster, myPeerId, incomingRequests, onChallenge, onRespond }) {
  const [target, setTarget] = useState(null);

  const others = roster.filter((p) => p.peerId !== myPeerId);

  return (
    <div>
      {incomingRequests.length > 0 && (
        <div className="mb-4 grid gap-2">
          {incomingRequests.map((battle) => (
            <div
              key={battle.battleId}
              className="flex items-center justify-between rounded-xl border border-[var(--dex-accent-200)] bg-[var(--dex-accent-50)] px-4 py-3"
            >
              <span className="text-sm font-semibold text-[var(--dex-accent-800)]">
                {battle.names[battle.challenger]} wants to battle!
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRespond(battle.battleId, true)}
                  className="flex items-center gap-1 rounded-lg bg-[var(--dex-accent-600)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--dex-accent-700)]"
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(battle.battleId, false)}
                  className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-bold text-zinc-900">Lobby ({roster.length})</h2>
      <div className="mt-2 grid gap-1.5">
        {roster.map((p) => (
          <button
            key={p.peerId}
            type="button"
            disabled={p.peerId === myPeerId}
            onClick={() => setTarget(p.peerId)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
              p.peerId === myPeerId
                ? 'border-zinc-200 bg-zinc-50 text-zinc-400'
                : target === p.peerId
                ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)] font-semibold text-[var(--dex-accent-700)]'
                : 'border-zinc-200 bg-white hover:border-[var(--dex-accent-300)]'
            }`}
          >
            {p.name} {p.peerId === myPeerId && '(you)'}
          </button>
        ))}
        {others.length === 0 && (
          <p className="py-4 text-center text-xs text-zinc-400">
            Waiting for others to join — send them the lobby link.
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!target}
        onClick={() => target && onChallenge(target)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--dex-accent-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Swords size={16} />
        Battle
      </button>
    </div>
  );
}
