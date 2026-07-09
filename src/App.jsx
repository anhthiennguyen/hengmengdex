import { useState } from 'react';
import Navbar from './components/Navbar';
import PokedexGrid from './components/PokedexGrid';
import MengModal from './components/MengModal';
import AuthModal from './components/AuthModal';
import AddMengForm from './components/AddMengForm';
import { useAuth } from './hooks/useAuth';
import { useDex } from './hooks/useDex';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { entries, loading: dexLoading } = useDex();

  const [selected, setSelected] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="min-h-screen">
      <Navbar
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onOpenAdd={() => setShowAdd(true)}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {authLoading || dexLoading ? (
          <div className="flex justify-center py-20 text-sm font-semibold text-zinc-400">
            Loading dex…
          </div>
        ) : (
          <PokedexGrid entries={entries} onSelect={setSelected} />
        )}
      </main>

      {selected && (
        <MengModal meng={selected} onClose={() => setSelected(null)} />
      )}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}

      {showAdd && user && (
        <AddMengForm user={user} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
