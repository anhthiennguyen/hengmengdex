import { getTypeInfo } from '../lib/pokemonTypes';

export default function TypeBadge({ type, size = 'sm' }) {
  const info = getTypeInfo(type);
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[11px]';

  return (
    <span
      className={`rounded-full font-bold uppercase tracking-wide text-white ${sizeClasses}`}
      style={{ backgroundColor: info.color }}
    >
      {info.label}
    </span>
  );
}
