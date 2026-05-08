import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error — getReactNativePersistence is not in the type defs but is exported at runtime in firebase 10+
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const firebaseConfig = {
  apiKey: extra.firebaseApiKey,
  authDomain: extra.firebaseAuthDomain,
  projectId: extra.firebaseProjectId,
  storageBucket: extra.firebaseStorageBucket,
  messagingSenderId: extra.firebaseMessagingSenderId,
  appId: extra.firebaseAppId,
};

if (!firebaseConfig.apiKey) {
  throw new Error(
    'Firebase config missing. Did you create .env.local from .env.example and re-run `npx expo prebuild --clean`?',
  );
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let _auth: Auth;
if (Platform.OS === 'web') {
  _auth = getAuth(app);
} else {
  _auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
export const auth = _auth;

// Persistent cache (IndexedDB) only works on web. On React Native the firebase
// JS SDK falls back to memory cache and emits a warning, so on native we just
// use getFirestore which defaults to memory cache silently. True offline
// persistence on RN requires @react-native-firebase/firestore (deferred).
export const db: Firestore =
  Platform.OS === 'web'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    : getFirestore(app);

export const googleClientIds = {
  webClientId: extra.googleWebClientId,
  iosClientId: extra.googleIosClientId,
};
