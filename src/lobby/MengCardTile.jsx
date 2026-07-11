import { Sparkles, Wand2, Zap } from 'lucide-react';
import { summarizeRules } from '../lib/ruleSummary';
import { getEnergyTypeInfo } from '../lib/pokemonTypes';
import TypeBadge from '../components/TypeBadge';

const STAGE_LABELS = { basic: 'Basic', stage1: 'Stage 1', stage2: 'Stage 2' };
const TRAINER_TYPE_LABELS = { item: 'Item', supporter: 'Supporter' };

const CONDITION_LABELS = {
  asleep: 'Asleep',
  confused: 'Confused',
  paralyzed: 'Paralyzed',
};

function ConditionBadges({ conditions }) {
  if (!conditions) return null;
  const badges = [];
  if (conditions.primary) {
    badges.push({ key: 'primary', label: CONDITION_LABELS[conditions.primary.type] || conditions.primary.type });
  }
  if (conditions.burned) badges.push({ key: 'burned', label: 'Burned' });
  if (conditions.poisoned) badges.push({ key: 'poisoned', label: 'Poisoned' });
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {badges.map((b) => (
        <span key={b.key} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
          {b.label}
        </span>
      ))}
    </div>
  );
}

export default function MengCardTile({ card, onClick, disabled, selected, showHp }) {
  const cardType = card.cardType || 'meng';
  const summaries = summarizeRules(card.rules);

  const baseClasses = `flex w-full flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
    selected
      ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)] shadow-md'
      : 'border-zinc-200 bg-white hover:border-[var(--dex-accent-300)] hover:shadow-sm'
  } ${onClick && !disabled ? 'cursor-pointer' : 'cursor-default'} ${disabled ? 'opacity-50' : ''}`;

  if (cardType === 'energy') {
    const info = getEnergyTypeInfo(card.energyType);
    return (
      <button type="button" onClick={onClick} disabled={disabled || !onClick} className={baseClasses}>
        <span
          className="flex h-14 w-14 items-center justify-center rounded-lg"
          style={{ backgroundColor: info.color }}
        >
          <Zap size={22} className="text-white" fill="white" />
        </span>
        <span className="text-xs font-bold text-zinc-800">{card.name}</span>
      </button>
    );
  }

  if (cardType === 'trainer') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        title={summaries.join(' ')}
        className={baseClasses}
      >
        <img src={card.imageUrl} alt={card.name} className="h-14 w-14 rounded-lg object-contain" />
        <span className="flex max-w-full items-center gap-1 truncate text-xs font-bold capitalize text-zinc-800">
          <Wand2 size={11} className="shrink-0 text-[var(--dex-accent-500)]" />
          {card.name}
        </span>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-500">
          {TRAINER_TYPE_LABELS[card.trainerType] || 'Trainer'}
        </span>
        <span className="line-clamp-2 text-[10px] leading-tight text-zinc-500">{summaries[0] || 'Trainer'}</span>
      </button>
    );
  }

  const isInPlay = typeof card.currentHp === 'number' && typeof card.maxHp === 'number';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      title={summaries.length ? summaries.join(' ') : undefined}
      className={baseClasses}
    >
      <img src={card.imageUrl} alt={card.name} className="h-14 w-14 rounded-lg object-contain" />
      <span className="flex max-w-full items-center gap-1 truncate text-xs font-bold capitalize text-zinc-800">
        {card.name}
        {summaries.length > 0 && <Sparkles size={10} className="shrink-0 text-[var(--dex-accent-500)]" />}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {typeof card.type === 'string' && <TypeBadge type={card.type} />}
        {card.stage && (
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-500">
            {STAGE_LABELS[card.stage] || card.stage}
          </span>
        )}
      </div>
      <div className="flex gap-2 text-[10px] font-semibold text-zinc-500">
        <span>HP {showHp ? card.currentHp ?? card.hp : card.hp}</span>
      </div>
      {isInPlay && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--dex-accent-500)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, (card.currentHp / card.maxHp) * 100))}%` }}
          />
        </div>
      )}
      {card.attachedEnergy?.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5">
          {card.attachedEnergy.map((e, i) => {
            const info = getEnergyTypeInfo(e.energyType);
            return <Zap key={i} size={11} style={{ color: info.color, fill: info.color }} />;
          })}
        </div>
      )}
      <ConditionBadges conditions={card.conditions} />
      {card.statuses?.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {card.statuses.map((s) => (
            <span
              key={s.id}
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                s.action.startsWith('add_') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {s.action.startsWith('add_') ? '+' : '-'}
              {s.amount} {s.action.includes('hp') ? 'HP' : 'ATK'} ({s.roundsRemaining})
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
