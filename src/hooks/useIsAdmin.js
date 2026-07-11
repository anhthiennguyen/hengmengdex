import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useIsAdmin(user, dex) {
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsGlobalAdmin(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'admins', user.uid),
      (snap) => setIsGlobalAdmin(snap.exists()),
      () => setIsGlobalAdmin(false)
    );
    return unsubscribe;
  }, [user]);

  const isDexOwner = !!user && !!dex && dex.ownerId === user.uid;

  return isGlobalAdmin || isDexOwner;
}
