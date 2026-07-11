import { useMemo, useState } from 'react';
import { Copy, Check, Loader2, LogOut } from 'lucide-react';
import { useLobbyEngine } from './useLobbyEngine';
import { useDex } from '../hooks/useDex';
import DexThemeProvider from '../components/DexThemeProvider';
import NameEntry from './NameEntry';
import Roster from './Roster';
import BattleView from './BattleView';

export default function LobbyPage({ mode, lobbyCode, dexId, onLeave }) {
  const { snapshot, engine } = useLobbyEngine(mode, lobbyCode, dexId);
  const { dex } = useDex(dexId);
  const [copied, setCopied] = useState(false);

  const shareLink = useMemo(
    () => `${window.location.origin}/dex/${dexId}/lobby/${lobbyCode}`,
    [dexId, lobbyCode]
  );

  function copyLink() {
    navigator.clipboard?.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!snapshot || snapshot.status === 'connecting') {
    return (
      <Shell onLeave={onLeave} dexName={dex?.name} dexColor={dex?.color}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="animate-spin text-[var(--dex-accent-500)]" size={28} />
          <p className="text-sm font-semibold text-zinc-500">
            {mode === 'host' ? 'Creating lobby…' : 'Joining lobby…'}
          </p>
        </div>
      </Shell>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <Shell onLeave={onLeave} dexName={dex?.name} dexColor={dex?.color}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm font-semibold text-red-600">{snapshot.errorMessage}</p>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
          >
            Back to Dex
          </button>
        </div>
      </Shell>
    );
  }

  const { myPeerId, state } = snapshot;
  const me = state.roster.find((p) => p.peerId === myPeerId);

  if (!me) {
    return (
      <Shell onLeave={onLeave} dexName={dex?.name} dexColor={dex?.color}>
        <NameEntry onSubmit={(name) => engine.setName(name)} />
      </Shell>
    );
  }

  const myBattles = Object.values(state.battles).filter((b) => b.players.includes(myPeerId));
  const activeBattle =
    myBattles.find((b) => b.phase !== 'pending') ||
    myBattles.find((b) => b.phase === 'pending' && b.challenger === myPeerId);
  const incomingRequests = myBattles.filter(
    (b) => b.phase === 'pending' && b.challenger !== myPeerId
  );

  return (
    <Shell onLeave={onLeave} dexName={dex?.name} dexColor={dex?.color}>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
        <span className="truncate text-xs font-mono text-zinc-500">{shareLink}</span>
        <button
          type="button"
          onClick={copyLink}
          className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--dex-accent-600)] px-2.5 py-1 text-xs font-bold text-white hover:bg-[var(--dex-accent-700)]"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>

      <Roster
        roster={state.roster}
        myPeerId={myPeerId}
        incomingRequests={incomingRequests}
        onChallenge={(target) => engine.requestBattle(target)}
        onRespond={(battleId, accept) => engine.respondBattle(battleId, accept)}
      />

      {activeBattle && (
        <BattleView
          battle={activeBattle}
          myPeerId={myPeerId}
          engine={engine}
          onClose={() => engine.send({ type: 'battle_ack', battleId: activeBattle.battleId })}
        />
      )}
    </Shell>
  );
}

function Shell({ children, onLeave, dexName, dexColor }) {
  return (
    <DexThemeProvider color={dexColor ?? '#4169e1'}>
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-zinc-900">
            Battle Lobby{dexName ? ` — ${dexName}` : ''}
          </h1>
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-700"
          >
            <LogOut size={13} />
            Leave
          </button>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">{children}</div>
      </div>
    </DexThemeProvider>
  );
}
