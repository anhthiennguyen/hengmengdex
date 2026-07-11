import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useMembership(user, dexId) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !dexId) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'memberships', `${user.uid}_${dexId}`),
      (snap) => {
        setRole(snap.exists() ? snap.data().role : null);
        setLoading(false);
      },
      () => {
        setRole(null);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, dexId]);

  return { isMember: role !== null, role, loading };
}
