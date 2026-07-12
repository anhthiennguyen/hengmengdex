import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { MIN_DECK_SIZE, MIN_DECK_BASICS } from './deckBuilder';
import MengCardTile from './MengCardTile';

export default function DeckBuildPhase({ battle, myPeerId, opponentName, engine }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const myReady = !!battle.deckReady?.[myPeerId];
  const opponentId = battle.players.find((p) => p !== myPeerId);
  const opponentReady = !!battle.deckReady?.[opponentId];

  if (myReady) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="text-[var(--dex-accent-500)]" size={28} />
        <p className="text-sm font-semibold text-zinc-700">
          {opponentReady ? 'Both decks ready! Dealing…' : `Waiting for ${opponentName} to finish picking their deck…`}
        </p>
        {!opponentReady && <Loader2 className="animate-spin text-zinc-300" size={18} />}
      </div>
    );
  }

  const pool = battle.cardPool ?? [];
  const selectedCards = pool.filter((c) => selectedIds.includes(c.id));
  const basicsCount = selectedCards.filter((c) => c.cardType === 'meng' && c.stage === 'basic').length;
  const meetsMinimum = selectedCards.length >= MIN_DECK_SIZE && basicsCount >= MIN_DECK_BASICS;

  function toggleCard(card) {
    setSelectedIds((ids) => (ids.includes(card.id) ? ids.filter((id) => id !== card.id) : [...ids, card.id]));
  }

  function handleSubmit() {
    if (!meetsMinimum) return;
    engine.submitDeck(battle.battleId, selectedIds);
  }

  return (
    <div>
      <h2 className="text-center text-lg font-bold text-zinc-900">Build Your Deck</h2>
      <p className="mt-1 text-center text-xs text-zinc-500">
        Pick any cards you want from the whole Dex — no random dealing. You need at least {MIN_DECK_SIZE} cards,
        including {MIN_DECK_BASICS}+ Basic Pokemon.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pool.map((card) => (
          <MengCardTile
            key={card.id}
            card={card}
            selected={selectedIds.includes(card.id)}
            onClick={() => toggleCard(card)}
          />
        ))}
      </div>

      {pool.length === 0 && <p className="mt-4 text-center text-xs text-zinc-400">This Dex has no cards yet.</p>}

      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-500">
        <span>
          Selected: {selectedCards.length}/{MIN_DECK_SIZE}+ &middot; Basics: {basicsCount}/{MIN_DECK_BASICS}+
        </span>
        <button
          type="button"
          disabled={!meetsMinimum}
          onClick={handleSubmit}
          className="rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ready!
        </button>
      </div>
    </div>
  );
}
