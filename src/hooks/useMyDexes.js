import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useMyDexes(user) {
  const [dexes, setDexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setDexes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'memberships'), where('uid', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const memberships = snapshot.docs.map((d) => d.data());
        try {
          const dexDocs = await Promise.all(
            memberships.map((m) => getDoc(doc(db, 'dexes', m.dexId)))
          );
          const merged = dexDocs
            .map((snap, i) => (snap.exists() ? { id: snap.id, ...snap.data(), role: memberships[i].role } : null))
            .filter(Boolean);
          setDexes(merged);
          setLoading(false);
        } catch (err) {
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { dexes, loading, error };
}
