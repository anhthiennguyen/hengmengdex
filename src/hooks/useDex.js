import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useDex(dexId) {
  const [dex, setDex] = useState(null);
  const [entries, setEntries] = useState([]);
  const [dexLoading, setDexLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dexId) {
      setDex(null);
      setEntries([]);
      setDexLoading(false);
      setEntriesLoading(false);
      return;
    }

    setDexLoading(true);
    setEntriesLoading(true);
    setError(null);

    const unsubDex = onSnapshot(
      doc(db, 'dexes', dexId),
      (snap) => {
        setDex(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setDexLoading(false);
      },
      (err) => {
        setError(err.message);
        setDexLoading(false);
      }
    );

    const entriesQuery = query(collection(db, 'dexes', dexId, 'meng'), orderBy('createdAt', 'asc'));
    const unsubEntries = onSnapshot(
      entriesQuery,
      (snapshot) => {
        setEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEntriesLoading(false);
      },
      (err) => {
        setError(err.message);
        setEntriesLoading(false);
      }
    );

    return () => {
      unsubDex();
      unsubEntries();
    };
  }, [dexId]);

  return { dex, entries, loading: dexLoading || entriesLoading, error };
}
