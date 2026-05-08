import { useSyncExternalStore } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UserProfile = {
  defaultCurrency: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const DEFAULT_PROFILE: UserProfile = { defaultCurrency: 'USD' };

let profile: UserProfile = DEFAULT_PROFILE;
const listeners = new Set<() => void>();
let unsub: Unsubscribe | null = null;
let currentUid: string | null = null;

const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = (): UserProfile => profile;

export const useProfile = (): UserProfile => useSyncExternalStore(subscribe, getSnapshot);

export function attachProfileListener(uid: string | null) {
  unsub?.();
  currentUid = uid;
  if (!uid) {
    profile = DEFAULT_PROFILE;
    notify();
    return;
  }
  unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) {
      profile = snap.data() as UserProfile;
    } else {
      profile = DEFAULT_PROFILE;
      void setDoc(doc(db, 'users', uid), {
        ...DEFAULT_PROFILE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    notify();
  });
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
  if (!currentUid) throw new Error('Cannot update profile: not signed in');
  await setDoc(
    doc(db, 'users', currentUid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
