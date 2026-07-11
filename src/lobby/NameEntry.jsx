import { useState } from 'react';

export default function NameEntry({ onSubmit }) {
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  }

  return (
    <div className="mx-auto max-w-xs">
      <h2 className="text-center text-lg font-bold text-zinc-900">Enter a name</h2>
      <p className="mt-1 text-center text-xs text-zinc-500">
        Temporary for this lobby only — not saved anywhere.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="Ash"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-100"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-royal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-royal-700"
        >
          Join
        </button>
      </form>
    </div>
  );
}
