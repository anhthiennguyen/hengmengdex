import { Sparkles, Swords, Users, Zap } from 'lucide-react';

const FEATURES = [
  {
    image: '/landing/dex-grid.png',
    icon: Users,
    title: 'Build a Dex with your crew',
    body: 'Create a "Dex" — your own themed collection with a custom name and color — then send an invite link so friends can join in and add their own cards. Everyone contributes to the same shared roster.',
  },
  {
    image: '/landing/card-editor.png',
    icon: Sparkles,
    title: 'Design your own cards',
    body: "Upload any photo, name it whatever's funny, and set its HP, type, attacks, evolution stage, and weakness/resistance. Every card is fully custom — this isn't a Pokedex of real Pokemon, it's one built entirely out of your friend group.",
    compact: true,
  },
  {
    image: '/landing/lobby.png',
    icon: Swords,
    title: 'Challenge friends to battle',
    body: "Open a lobby, share the link, and challenge whoever's online. Accept, decline, and get matched up — all in real time, peer-to-peer, no waiting on a server.",
  },
];

export default function Landing({ onOpenAuth }) {
  return (
    <div>
      {/* Hero */}
      <div className="grid items-center gap-10 py-8 md:grid-cols-2 md:py-14">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dex-accent-50)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--dex-accent-700)]">
            <Zap size={12} />
            Your friends. Your rules. Your Pokemon.
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
            Turn your friend group into a trading card game.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600">
            HengMeng Dex lets you build custom Pokemon-style cards out of real photos of your friends, organize
            them into a shareable Dex, and battle each other live — with the real TCG rules: Energy, Bench,
            Evolution, weakness &amp; resistance, and more.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-lg bg-[var(--dex-accent-600)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--dex-accent-700)]"
            >
              Log In / Sign Up
            </button>
            <p className="text-xs text-zinc-400">Free. Or open a dex link a friend sent you to browse as a guest.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <img src="/landing/battle.png" alt="A live battle in progress" className="w-full" />
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 gap-3 border-t border-zinc-200 py-8 sm:grid-cols-3">
        {[
          { step: '1', label: 'Create a Dex', detail: 'Pick a name and color for your group.' },
          { step: '2', label: 'Add custom cards', detail: 'Photos, stats, attacks, evolutions — all yours.' },
          { step: '3', label: 'Battle live', detail: 'Invite friends and fight it out in real time.' },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3 rounded-xl bg-white p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dex-accent-600)] text-sm font-extrabold text-white">
              {s.step}
            </span>
            <div>
              <p className="text-sm font-bold text-zinc-900">{s.label}</p>
              <p className="text-xs text-zinc-500">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Feature sections */}
      <div className="grid gap-16 py-10">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}
          >
            <div
              className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg ${
                f.compact ? 'mx-auto w-full max-w-[280px]' : ''
              }`}
            >
              <img src={f.image} alt={f.title} className="w-full" />
            </div>
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--dex-accent-50)] text-[var(--dex-accent-600)]">
                <f.icon size={18} />
              </span>
              <h2 className="mt-3 text-xl font-extrabold text-zinc-900">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Closing CTA */}
      <div className="mb-10 flex flex-col items-center gap-3 rounded-2xl border border-[var(--dex-accent-200)] bg-[var(--dex-accent-50)] py-10 text-center">
        <h2 className="text-xl font-extrabold text-zinc-900">Ready to make some cards?</h2>
        <p className="max-w-sm text-sm text-zinc-600">Create your first Dex and start turning your friends into playable cards.</p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-1 rounded-lg bg-[var(--dex-accent-600)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--dex-accent-700)]"
        >
          Log In / Sign Up
        </button>
      </div>
    </div>
  );
}
