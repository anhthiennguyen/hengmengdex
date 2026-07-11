import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Plus, Settings, Swords } from 'lucide-react';
import { useDex } from '../hooks/useDex';
import { useMembership } from '../hooks/useMembership';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { generateLobbyCode } from '../lobby/lobbyEngine';
import PokedexGrid from './PokedexGrid';
import MengModal from './MengModal';
import MengForm from './MengForm';
import DexForm from './DexForm';
import JoinDexBanner from './JoinDexBanner';
import JoinDexModal from './JoinDexModal';
import DexThemeProvider from './DexThemeProvider';

export default function DexView({ dexId, user, autoJoinPrompt, onBack, onOpenAuth, onOpenLobby }) {
  const { dex, entries, loading, error } = useDex(dexId);
  const { isMember } = useMembership(user, dexId);
  const isAdmin = useIsAdmin(user, dex);

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEditDex, setShowEditDex] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    if (autoJoinPrompt && !loading && !isMember && !isAdmin) {
      setShowJoinModal(true);
    }
  }, [autoJoinPrompt, loading, isMember, isAdmin]);

  const canAdd = !!user && (isMember || isAdmin);
  const canManageSelected = !!selected && !!user && (isAdmin || selected.createdBy === user.uid);

  const shareLink = useMemo(() => `${window.location.origin}/dex/${dexId}/join`, [dexId]);

  function copyLink() {
    navigator.clipboard?.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleCreateLobby() {
    onOpenLobby(generateLobbyCode(), true);
  }

  if (error) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-semibold text-red-600">Couldn't load this dex.</p>
        <p className="mt-1 text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-sm font-semibold text-zinc-400">Loading dex…</div>
    );
  }

  if (!dex) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-semibold text-zinc-600">This dex doesn't exist.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
        >
          Back to My Dexes
        </button>
      </div>
    );
  }

  return (
    <DexThemeProvider color={dex.color}>
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft size={15} />
        My Dexes
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="h-9 w-9 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: dex.color }}
          />
          <h1 className="text-xl font-extrabold text-zinc-900">{dex.name}</h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowEditDex(true)}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Edit dex settings"
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Invite Link'}
          </button>
          <button
            type="button"
            onClick={handleCreateLobby}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--dex-accent-300)] bg-[var(--dex-accent-50)] px-3 py-2 text-xs font-bold text-[var(--dex-accent-700)] hover:bg-[var(--dex-accent-100)]"
          >
            <Swords size={14} />
            Create Lobby
          </button>
          {canAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--dex-accent-600)] px-3 py-2 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
            >
              <Plus size={16} />
              Add Pokemon
            </button>
          )}
        </div>
      </div>

      {!isMember && !isAdmin && !showJoinModal && (
        <JoinDexBanner user={user} dexId={dexId} onOpenAuth={onOpenAuth} />
      )}

      <PokedexGrid entries={entries} onSelect={setSelected} />

      {selected && (
        <MengModal
          meng={selected}
          dexId={dexId}
          canManage={canManageSelected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
        />
      )}

      {showAdd && user && (
        <MengForm user={user} dex={dex} entries={entries} onClose={() => setShowAdd(false)} />
      )}

      {editing && user && (
        <MengForm user={user} dex={dex} entries={entries} entry={editing} onClose={() => setEditing(null)} />
      )}

      {showEditDex && (
        <DexForm user={user} dex={dex} onClose={() => setShowEditDex(false)} />
      )}

      {showJoinModal && (
        <JoinDexModal
          user={user}
          dex={dex}
          dexId={dexId}
          onClose={() => setShowJoinModal(false)}
          onOpenAuth={onOpenAuth}
        />
      )}
    </div>
    </DexThemeProvider>
  );
}
