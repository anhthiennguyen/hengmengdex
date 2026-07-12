import { Zap } from 'lucide-react';
import { canAffordAttack } from './combatEngine';
import { getEnergyTypeInfo } from '../lib/pokemonTypes';
import MengCardTile from './MengCardTile';

export default function ActivePokemonPanel({ card, label, canAttack, isFirstTurn, onAttack, onViewDetails }) {
  if (!card) {
    return (
      <div>
        <p className="mb-1 text-center text-xs font-bold text-zinc-500">{label}</p>
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-400">
          No Active Pokemon
        </div>
      </div>
    );
  }

  const conditionBlocksAttack = ['asleep', 'paralyzed'].includes(card.conditions?.primary?.type);
  const blockedReason = isFirstTurn
    ? "You can't attack on the very first turn of the game."
    : conditionBlocksAttack
    ? `${card.name} can't attack right now (${card.conditions.primary.type}).`
    : null;

  return (
    <div>
      <p className="mb-1 text-center text-xs font-bold text-zinc-500">{label}</p>
      <MengCardTile card={card} showHp onClick={onViewDetails ? () => onViewDetails(card) : undefined} />

      {canAttack && (
        <div className="mt-2 grid gap-1.5">
          {(card.attacks || []).map((attack) => {
            const affordable = canAffordAttack(attack, card.attachedEnergy || []);
            const disabled = !affordable || !!blockedReason;
            return (
              <button
                key={attack.id}
                type="button"
                disabled={disabled}
                onClick={() => onAttack(attack.id)}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-left text-xs transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center gap-1">
                  {attack.cost.map((c, i) => {
                    const info = getEnergyTypeInfo(c);
                    return <Zap key={i} size={11} style={{ color: info.color, fill: info.color }} />;
                  })}
                  <span className="font-bold text-zinc-800">{attack.name}</span>
                </span>
                <span className="font-extrabold text-zinc-900">{attack.damage}</span>
              </button>
            );
          })}
          {blockedReason && <p className="text-center text-[11px] text-amber-600">{blockedReason}</p>}
        </div>
      )}
    </div>
  );
}
