export default function PokedexGrid({ entries, onSelect }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 py-20 text-center">
        <p className="text-sm font-semibold text-zinc-500">The dex is empty.</p>
        <p className="mt-1 text-xs text-zinc-400">Log in and add the first Meng.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelect(entry)}
          className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--dex-accent-300)] hover:shadow-md"
        >
          <img
            src={entry.imageUrl}
            alt={entry.name}
            loading="lazy"
            className="h-3/5 w-3/5 object-contain transition group-hover:scale-105"
          />
          <span className="truncate px-1 text-[11px] font-semibold capitalize text-zinc-700">
            {entry.name}
          </span>
        </button>
      ))}
    </div>
  );
}
