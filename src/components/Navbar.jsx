import { LogOut, User } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Navbar({ user, onOpenAuth, onGoHome }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <button type="button" onClick={onGoHome} className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="HengMeng Dex"
            className="h-9 w-9 object-contain"
          />
          <span className="text-lg font-extrabold tracking-tight text-zinc-900">HengMeng Dex</span>
        </button>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 sm:flex">
                <User size={14} />
                <span className="max-w-[140px] truncate">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-lg bg-[var(--dex-accent-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--dex-accent-700)]"
            >
              Log In / Sign Up
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
