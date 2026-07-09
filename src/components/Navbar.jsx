import { LogOut, Plus, User } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Navbar({ user, onOpenAuth, onOpenAdd }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-900 bg-red-600">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-zinc-900">HengMeng Dex</span>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button
                type="button"
                onClick={onOpenAdd}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Meng</span>
              </button>
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
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
            >
              Log In / Sign Up
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
