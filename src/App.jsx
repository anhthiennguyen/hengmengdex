import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import DexList from './components/DexList';
import DexView from './components/DexView';
import AuthModal from './components/AuthModal';
import LobbyPage from './lobby/LobbyPage';
import { useAuth } from './hooks/useAuth';

function parseLocation() {
  const dexLobbyMatch = window.location.pathname.match(
    /^\/dex\/([A-Za-z0-9_-]+)\/lobby\/([A-Za-z0-9]+)$/
  );
  if (dexLobbyMatch) {
    return {
      view: 'lobby',
      dexId: dexLobbyMatch[1],
      lobbyCode: dexLobbyMatch[2],
      mode: new URLSearchParams(window.location.search).get('host') === '1' ? 'host' : 'guest',
    };
  }

  const joinMatch = window.location.pathname.match(/^\/dex\/([A-Za-z0-9_-]+)\/join$/);
  if (joinMatch) {
    return { view: 'dex', dexId: joinMatch[1], autoJoinPrompt: true };
  }

  const dexMatch = window.location.pathname.match(/^\/dex\/([A-Za-z0-9_-]+)$/);
  if (dexMatch) {
    return { view: 'dex', dexId: dexMatch[1] };
  }

  return { view: 'home' };
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
  const [showAuth, setShowAuth] = useState(false);

  if (route.view === 'lobby') {
    return (
      <LobbyPage
        key={`${route.mode}-${route.dexId}-${route.lobbyCode}`}
        mode={route.mode}
        dexId={route.dexId}
        lobbyCode={route.lobbyCode}
        onLeave={() => navigate(`/dex/${route.dexId}`)}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onGoHome={() => navigate('/')}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {authLoading ? (
          <div className="flex justify-center py-20 text-sm font-semibold text-zinc-400">Loading…</div>
        ) : route.view === 'dex' ? (
          <DexView
            key={route.dexId}
            dexId={route.dexId}
            user={user}
            autoJoinPrompt={route.autoJoinPrompt}
            onBack={() => navigate('/')}
            onOpenAuth={() => setShowAuth(true)}
            onOpenLobby={(code, host) => navigate(`/dex/${route.dexId}/lobby/${code}${host ? '?host=1' : ''}`)}
          />
        ) : (
          <DexList user={user} onOpenDex={(id) => navigate(`/dex/${id}`)} onOpenAuth={() => setShowAuth(true)} />
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
