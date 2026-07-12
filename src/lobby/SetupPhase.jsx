import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Minus, Plus } from 'lucide-react';
import { POKEMON_TYPES } from '../lib/pokemonTypes';
import { MAX_ENERGY_PER_TYPE } from './energyLoadout';
import MengCardTile from './MengCardTile';

const HOLD_START_DELAY = 400; // ms before repeating kicks in, so a single tap doesn't double-fire
const HOLD_REPEAT_INTERVAL = 80; // ms between repeats while held

// A +/- button that fires once immediately on press, then keeps firing on
// an interval for as long as it's held down (mouse or touch).
function HoldButton({ onPress, ariaLabel, children }) {
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);

  function stop() {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }

  function start() {
    onPress();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onPress, HOLD_REPEAT_INTERVAL);
    }, HOLD_START_DELAY);
  }

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={(e) => {
        e.preventDefault();
        start();
      }}
      onTouchEnd={stop}
      className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export default function SetupPhase({ battle, myPeerId, opponentName, engine }) {
  const [activeCardId, setActiveCardId] = useState(null);
  const [benchCardIds, setBenchCardIds] = useState([]);
  const [energyLoadout, setEnergyLoadout] = useState({});

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

  // Types across the player's WHOLE deck (including their own Prize pile —
  // that's fine to read for this purpose since it's their own already-picked
  // cards, not new information; the Prize cards themselves just stay
  // visually hidden), so the Energy picker can remind them what they'll
  // actually need, not just what happens to be visible right now.
  const myWholeDeck = [...allCards, ...(battle.prizePiles?.[myPeerId] ?? [])];
  const neededTypes = new Set(
    myWholeDeck.filter((c) => c.cardType === 'meng').map((c) => c.type)
  );

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

  function adjustEnergy(type, delta) {
    setEnergyLoadout((current) => {
      const next = Math.max(0, Math.min(MAX_ENERGY_PER_TYPE, (current[type] || 0) + delta));
      return { ...current, [type]: next };
    });
  }

  const totalEnergy = Object.values(energyLoadout).reduce((sum, n) => sum + n, 0);

  function handleSubmit() {
    if (!activeCardId) return;
    engine.submitSetup(battle.battleId, activeCardId, benchCardIds, energyLoadout);
  }

  return (
    <div>
      <h2 className="text-center text-lg font-bold text-zinc-900">Choose Your Team</h2>
      <p className="mt-1 text-center text-xs text-zinc-500">
        This is everything from the deck you built. Tap a Basic Pokemon for your Active spot first, then up to 5
        more for your Bench — everything else stays in your hand for later.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
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
        <p className="text-xs font-bold text-zinc-500">
          Choose your Energy — pick as much of each type as you want, for the whole game.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="h-2.5 w-2.5 shrink-0 rounded-md border border-[var(--dex-accent-400)] bg-[var(--dex-accent-50)]" />
          Highlighted = a Pokemon in your deck is this type — without at least some of this Energy, that Pokemon's
          attacks won't be usable.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {POKEMON_TYPES.map((t) => {
            const needed = neededTypes.has(t.value);
            return (
            <div
              key={t.value}
              className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 ${
                needed
                  ? 'border-[var(--dex-accent-400)] bg-[var(--dex-accent-50)]'
                  : 'border-zinc-200'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-zinc-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="truncate">{t.label}</span>
              </span>
              <span className="flex items-center gap-1">
                <HoldButton onPress={() => adjustEnergy(t.value, -1)} ariaLabel={`Remove ${t.label} Energy`}>
                  <Minus size={12} />
                </HoldButton>
                <span className="w-4 text-center text-xs font-bold text-zinc-800">
                  {energyLoadout[t.value] || 0}
                </span>
                <HoldButton onPress={() => adjustEnergy(t.value, 1)} ariaLabel={`Add ${t.label} Energy`}>
                  <Plus size={12} />
                </HoldButton>
              </span>
            </div>
            );
          })}
        </div>
        {totalEnergy === 0 && (
          <p className="mt-2 text-center text-[11px] text-amber-600">
            You haven't picked any Energy — you won't be able to power most attacks.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-500">
        <span>Bench: {benchCardIds.length}/5 &middot; Energy: {totalEnergy}</span>
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
