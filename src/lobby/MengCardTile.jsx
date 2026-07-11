import { Sparkles, Wand2 } from 'lucide-react';
import { summarizeRules } from '../lib/ruleSummary';
import TypeBadge from '../components/TypeBadge';

export default function MengCardTile({ card, onClick, disabled, selected, showHp }) {
  const cardType = card.cardType || 'meng';
  const dead = card.alive === false;
  const summaries = summarizeRules(card.rules);

  const baseClasses = `flex w-full flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
    dead
      ? 'border-zinc-200 bg-zinc-100 opacity-50'
      : selected
      ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)] shadow-md'
      : 'border-zinc-200 bg-white hover:border-[var(--dex-accent-300)] hover:shadow-sm'
  } ${onClick && !disabled ? 'cursor-pointer' : 'cursor-default'}`;

  if (cardType !== 'meng') {
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
        <span className="line-clamp-2 text-[10px] leading-tight text-zinc-500">
          {summaries[0] || 'Trainer'}
        </span>
      </button>
    );
  }

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
      {typeof card.type === 'string' && <TypeBadge type={card.type} />}
      <div className="flex gap-2 text-[10px] font-semibold text-zinc-500">
        <span>HP {showHp ? card.currentHp ?? card.hp : card.hp}</span>
        <span>ATK {card.attack}</span>
      </div>
      {typeof card.currentHp === 'number' && typeof card.maxHp === 'number' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--dex-accent-500)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, (card.currentHp / card.maxHp) * 100))}%` }}
          />
        </div>
      )}
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
