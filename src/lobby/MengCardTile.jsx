export default function MengCardTile({ card, onClick, disabled, selected, showHp }) {
  const dead = card.alive === false;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`flex w-full flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
        dead
          ? 'border-zinc-200 bg-zinc-100 opacity-50'
          : selected
          ? 'border-[var(--dex-accent-500)] bg-[var(--dex-accent-50)] shadow-md'
          : 'border-zinc-200 bg-white hover:border-[var(--dex-accent-300)] hover:shadow-sm'
      } ${onClick && !disabled ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <img
        src={card.imageUrl}
        alt={card.name}
        className="h-14 w-14 rounded-lg object-contain"
      />
      <span className="max-w-full truncate text-xs font-bold capitalize text-zinc-800">{card.name}</span>
      <div className="flex gap-2 text-[10px] font-semibold text-zinc-500">
        <span>HP {showHp ? card.currentHp ?? card.hp : card.hp}</span>
        <span>ATK {card.attack}</span>
      </div>
      {typeof card.currentHp === 'number' && typeof card.maxHp === 'number' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[var(--dex-accent-500)] transition-all"
            style={{ width: `${Math.max(0, (card.currentHp / card.maxHp) * 100)}%` }}
          />
        </div>
      )}
    </button>
  );
}
