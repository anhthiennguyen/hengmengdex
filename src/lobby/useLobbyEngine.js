import { useEffect, useRef, useState } from 'react';
import LobbyEngine from './lobbyEngine';

export function useLobbyEngine(mode, lobbyCode, dexId, deckSize) {
  const engineRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    const engine =
      mode === 'host'
        ? LobbyEngine.createHost(lobbyCode, dexId, deckSize)
        : LobbyEngine.joinGuest(lobbyCode, dexId);
    engineRef.current = engine;

    const unsubscribe = engine.subscribe(setSnapshot);

    return () => {
      unsubscribe();
      engine.leave();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lobbyCode, dexId]);

  return { snapshot, engine: engineRef.current };
}
