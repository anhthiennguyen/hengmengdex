import { X } from 'lucide-react';

export default function MengModal({ meng, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-royal-500 to-royal-700 p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <img
            src={meng.imageUrl}
            alt={meng.name}
            className="mx-auto h-40 w-40 rounded-xl bg-white/90 object-contain p-2 shadow-lg"
          />
        </div>
        <div className="p-6">
          <h2 className="text-xl font-extrabold capitalize text-zinc-900">{meng.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{meng.description}</p>
        </div>
      </div>
    </div>
  );
}
