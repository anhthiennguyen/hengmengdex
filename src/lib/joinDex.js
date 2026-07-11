import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function joinDex(user, dexId) {
  await setDoc(doc(db, 'memberships', `${user.uid}_${dexId}`), {
    uid: user.uid,
    dexId,
    role: 'member',
    joinedAt: serverTimestamp(),
  });
}
