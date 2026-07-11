import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import PokedexGrid from './components/PokedexGrid';
import MengModal from './components/MengModal';
import AuthModal from './components/AuthModal';
import MengForm from './components/MengForm';
import LobbyPage from './lobby/LobbyPage';
import { generateLobbyCode } from './lobby/lobbyEngine';
import { useAuth } from './hooks/useAuth';
import { useDex } from './hooks/useDex';
import { useIsAdmin } from './hooks/useIsAdmin';

function parseLocation() {
  const match = window.location.pathname.match(/^\/lobby\/([A-Za-z0-9-]+)$/);
  if (!match) return null;
  return {
    lobbyCode: match[1],
    mode: new URLSearchParams(window.location.search).get('host') === '1' ? 'host' : 'guest',
  };
}

function navigate(path) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function App() {
  const [route, setRoute] = useState(parseLocation);

  useEffect(() => {
    const onPopState = () => setRoute(parseLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const { user, loading: authLoading } = useAuth();
  const { entries, loading: dexLoading, error: dexError } = useDex();
  const isAdmin = useIsAdmin(user);

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const canManageSelected = !!selected && !!user && (isAdmin || selected.createdBy === user.uid);

  function handleCreateLobby() {
    const code = generateLobbyCode();
    navigate(`/lobby/${code}?host=1`);
  }

  if (route) {
    return (
      <LobbyPage
        key={`${route.mode}-${route.lobbyCode}`}
        mode={route.mode}
        lobbyCode={route.lobbyCode}
        onLeave={() => navigate('/')}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onOpenAdd={() => setShowAdd(true)}
        onCreateLobby={handleCreateLobby}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {dexError ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-300 bg-red-50 py-20 text-center">
            <p className="text-sm font-semibold text-red-600">Couldn't load the dex.</p>
            <p className="mt-1 max-w-xs text-xs text-red-400">{dexError}</p>
          </div>
        ) : authLoading || dexLoading ? (
          <div className="flex justify-center py-20 text-sm font-semibold text-zinc-400">
            Loading dex…
          </div>
        ) : (
          <PokedexGrid entries={entries} onSelect={setSelected} />
        )}
      </main>

      {selected && (
        <MengModal
          meng={selected}
          canManage={canManageSelected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
        />
      )}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}

      {showAdd && user && (
        <MengForm user={user} onClose={() => setShowAdd(false)} />
      )}

      {editing && user && (
        <MengForm user={user} entry={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
