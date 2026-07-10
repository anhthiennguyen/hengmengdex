import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useIsAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'admins', user.uid),
      (snap) => setIsAdmin(snap.exists()),
      () => setIsAdmin(false)
    );
    return unsubscribe;
  }, [user]);

  return isAdmin;
}
