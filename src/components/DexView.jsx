import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Plus, Settings, Swords } from 'lucide-react';
import { useDex } from '../hooks/useDex';
import { useMembership } from '../hooks/useMembership';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { generateLobbyCode } from '../lobby/lobbyEngine';
import {
  checkPoolLegality,
  clampDeckSize,
  DEFAULT_DECK_SIZE,
  MIN_DECK_BASICS,
  MIN_REQUIRED_DECK_SIZE,
} from '../lobby/deckBuilder';
import PokedexGrid from './PokedexGrid';
import MengModal from './MengModal';
import MengForm from './MengForm';
import DexForm from './DexForm';
import JoinDexBanner from './JoinDexBanner';
import DexThemeProvider from './DexThemeProvider';

export default function DexView({ dexId, user, onBack, onOpenAuth, onOpenLobby }) {
  const { dex, entries, loading, error } = useDex(dexId);
  const { isMember } = useMembership(user, dexId);
  const isAdmin = useIsAdmin(user, dex);

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEditDex, setShowEditDex] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBattleRequirements, setShowBattleRequirements] = useState(false);
  const [showDeckSizePicker, setShowDeckSizePicker] = useState(false);
  const [deckSizeInput, setDeckSizeInput] = useState('');

  const poolLegality = useMemo(() => checkPoolLegality(entries), [entries]);
  const basicCount = poolLegality.cards.filter((c) => c.cardType === 'meng' && c.stage === 'basic').length;

  const canAdd = !!user && (isMember || isAdmin);
  const canManageSelected = !!selected && !!user && (isAdmin || selected.createdBy === user.uid);

  const shareLink = useMemo(() => `${window.location.origin}/dex/${dexId}/join`, [dexId]);

  function copyLink() {
    navigator.clipboard?.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleCreateLobby() {
    if (!poolLegality.legal) {
      setShowBattleRequirements(true);
      return;
    }
    setDeckSizeInput(String(clampDeckSize(DEFAULT_DECK_SIZE, poolLegality.cards.length)));
    setShowDeckSizePicker(true);
  }

  function confirmCreateLobby() {
    const deckSize = clampDeckSize(Number(deckSizeInput), poolLegality.cards.length);
    onOpenLobby(generateLobbyCode(), true, deckSize);
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

      {!isMember && !isAdmin && (
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

      {showBattleRequirements && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBattleRequirements(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <Swords className="mx-auto text-[var(--dex-accent-500)]" size={28} />
            <h2 className="mt-3 text-lg font-bold text-zinc-900">Not Ready to Battle Yet</h2>
            <p className="mt-2 text-sm text-zinc-600">
              This dex needs at least {MIN_REQUIRED_DECK_SIZE} battle-ready Pokemon/Trainer cards (with attacks,
              evolution stage, etc. filled in), including {MIN_DECK_BASICS}+ Basic Pokemon, before a battle can
              start.
            </p>
            <p className="mt-2 text-xs font-semibold text-zinc-500">
              Currently: {poolLegality.cards.length}/{MIN_REQUIRED_DECK_SIZE} battle-ready cards, {basicCount}/
              {MIN_DECK_BASICS} Basic Pokemon.
            </p>
            <button
              type="button"
              onClick={() => setShowBattleRequirements(false)}
              className="mt-4 rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showDeckSizePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeckSizePicker(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <Swords className="mx-auto text-[var(--dex-accent-500)]" size={28} />
            <h2 className="mt-3 text-center text-lg font-bold text-zinc-900">Deck Size</h2>
            <p className="mt-2 text-center text-sm text-zinc-600">
              Choose exactly how many cards each player must pick for their deck. Both players will pick this many
              — no more, no less.
            </p>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_REQUIRED_DECK_SIZE}
              max={poolLegality.cards.length}
              step="1"
              value={deckSizeInput}
              onChange={(e) => setDeckSizeInput(e.target.value)}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-sm font-bold focus:border-[var(--dex-accent-500)] focus:outline-none focus:ring-2 focus:ring-[var(--dex-accent-100)]"
            />
            <p className="mt-1 text-center text-[11px] text-zinc-400">
              Between {MIN_REQUIRED_DECK_SIZE} and {poolLegality.cards.length} (this dex's battle-ready card count).
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeckSizePicker(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCreateLobby}
                className="flex-1 rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--dex-accent-700)]"
              >
                Create Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DexThemeProvider>
  );
}
