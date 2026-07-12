import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { POKEMON_TYPES } from '../lib/pokemonTypes';
import { MAX_ENERGY_PER_TYPE } from './energyLoadout';
import MengCardTile from './MengCardTile';

export default function SetupPhase({ battle, myPeerId, opponentName, engine }) {
  const [activeCardId, setActiveCardId] = useState(null);
  const [benchCardIds, setBenchCardIds] = useState([]);

  const myReady = !!battle.setupReady?.[myPeerId];
  const opponentId = battle.players.find((p) => p !== myPeerId);
  const opponentReady = !!battle.setupReady?.[opponentId];

  if (myReady) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="text-[var(--dex-accent-500)]" size={28} />
        <p className="text-sm font-semibold text-zinc-700">
          {opponentReady
            ? 'Both ready! Revealing Pokemon…'
            : `Waiting for ${opponentName} to finish choosing…`}
        </p>
        {!opponentReady && <Loader2 className="animate-spin text-zinc-300" size={18} />}
      </div>
    );
  }

  // Everything the player picked in deckbuild, except the hidden Prize
  // pile — the player already hand-picked their whole deck, so this
  // shouldn't re-hide most of it behind a small random "hand" slice.
  const allCards = [...(battle.hands?.[myPeerId] ?? []), ...(battle.decks?.[myPeerId] ?? [])];
  const basics = allCards.filter((c) => c.cardType === 'meng' && c.stage === 'basic');

  // Energy is no longer picked here — it's auto-granted per type based on
  // the whole deck the player already built (see energyPools, computed at
  // deckbuild time). This is just a read-only summary of that grant.
  const grantedTypes = POKEMON_TYPES.filter((t) => (battle.energyPools?.[myPeerId]?.[t.value] || 0) > 0);

  function isPlaceable(card) {
    return card.cardType === 'meng' && card.stage === 'basic';
  }

  function toggleCard(card) {
    if (!isPlaceable(card)) return;
    if (card.id === activeCardId) {
      setActiveCardId(null);
      return;
    }
    if (benchCardIds.includes(card.id)) {
      setBenchCardIds((ids) => ids.filter((id) => id !== card.id));
      return;
    }
    if (!activeCardId) {
      setActiveCardId(card.id);
      return;
    }
    if (benchCardIds.length < 5) {
      setBenchCardIds((ids) => [...ids, card.id]);
    }
  }

  function handleSubmit() {
    if (!activeCardId) return;
    engine.submitSetup(battle.battleId, activeCardId, benchCardIds);
  }

  return (
    <div>
      <h2 className="text-center text-lg font-bold text-zinc-900">Choose Your Team</h2>
      <p className="mt-1 text-center text-xs text-zinc-500">
        This is everything from the deck you built. Tap a Basic Pokemon for your Active spot first, then up to 5
        more for your Bench — everything else stays in your hand for later.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {allCards.map((card) => {
          const placeable = isPlaceable(card);
          return (
            <div key={card.id} className="relative">
              {card.id === activeCardId && (
                <span className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--dex-accent-600)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                  Active
                </span>
              )}
              {benchCardIds.includes(card.id) && (
                <span className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-zinc-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  Bench
                </span>
              )}
              {!placeable && (
                <span className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">
                  In Hand
                </span>
              )}
              <MengCardTile
                card={card}
                selected={card.id === activeCardId || benchCardIds.includes(card.id)}
                disabled={!placeable}
                onClick={placeable ? () => toggleCard(card) : undefined}
              />
            </div>
          );
        })}
      </div>

      {basics.length === 0 && (
        <p className="mt-4 text-center text-xs text-amber-600">
          Your deck has no Basic Pokemon, which shouldn't happen after the mulligan check. Contact the host.
        </p>
      )}

      <div className="mt-5">
        <p className="text-xs font-bold text-zinc-500">Your Energy</p>
        <p className="mt-1 text-[11px] text-zinc-400">
          Automatic — every Pokemon type in your deck comes with {MAX_ENERGY_PER_TYPE} Energy of that type, no
          picking needed.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {grantedTypes.map((t) => (
            <span
              key={t.value}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label} &middot; {MAX_ENERGY_PER_TYPE}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-500">
        <span>Bench: {benchCardIds.length}/5</span>
        <button
          type="button"
          disabled={!activeCardId}
          onClick={handleSubmit}
          className="rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ready!
        </button>
      </div>
    </div>
  );
}
