# Firebase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory seed-data stores in PAWL with Firebase Auth (email + Google + Apple) and Firestore (offline-first), preserving the existing `useSyncExternalStore` API surface so screens need only minimal changes.

**Architecture:** A new `AuthProvider` wraps the app and gates `AppStack` behind a signed-in user. Existing stores (`invoices.ts`, `clients.ts`) keep their public API but swap internals to Firestore `onSnapshot` listeners on `users/{uid}/{collection}`. Invoices store a denormalized snapshot of client name/email so they survive client edits. A new `profile.ts` store holds the user's default currency. Firestore offline persistence makes writes appear instantly and sync when online.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, TypeScript strict, Firebase JS SDK 10+, `@react-native-google-signin/google-signin`, `expo-apple-authentication`, `@react-native-async-storage/async-storage`, `expo-dev-client`.

**Verification approach:** No test runner is configured in this project (per `CLAUDE.md` non-goals). Each task uses `npx tsc --noEmit` for type-safety verification plus targeted manual verification in the dev client running on iOS simulator and Android emulator. Pure-logic helpers may be verified with one-off Node scripts where practical.

**Reference spec:** [`docs/superpowers/specs/2026-05-08-firebase-backend-design.md`](../specs/2026-05-08-firebase-backend-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `src/lib/firebase.ts` | Initialize Firebase app, auth (with AsyncStorage RN persistence), Firestore (with offline persistence). Single source of `app`, `auth`, `db` exports. |
| `src/lib/auth.tsx` | `AuthProvider` component, `useAuth()` hook. Owns `user` state, `initializing` flag, all sign-in/sign-out methods. Wires up store listeners on auth state changes. |
| `src/screens/SignInScreen.tsx` | Sign-in / sign-up / reset-password UI. Email + password fields. Google button (all platforms). Apple button (iOS only). |
| `src/data/profile.ts` | Module store for `users/{uid}` profile doc. `useProfile()` hook + `updateProfile(patch)`. Default currency lives here. |
| `app.config.ts` | Expo config as TypeScript so it can read `process.env.EXPO_PUBLIC_*`. Replaces `app.json`. |
| `firestore.rules` | Firestore security rules locked to `request.auth.uid`. |
| `.env.local` | Firebase web config + Google OAuth client IDs. Gitignored. |
| `.env.example` | Template showing required env var names (no values). Committed. |

### Modified files

| Path | Change |
|------|--------|
| `App.tsx` | Mount `AuthProvider`. Gate `AppStack` behind `user`. Show `SignInScreen` when `!user`. |
| `src/data/invoices.ts` | Replace seed array + sync mutations with Firestore listener + async CRUD. New types: `clientId`, `clientName`, `clientEmail`, `currency`, `createdAt`, `updatedAt`, `localCreatedAt`. Drop `client` string field. |
| `src/data/clients.ts` | Same Firestore swap. Stats join changes from `invoice.client === client.name` to `invoice.clientId === client.id`. |
| `src/screens/DashboardScreen.tsx` | Read `invoice.clientName` instead of `invoice.client`. |
| `src/screens/InvoicesScreen.tsx` | Same. |
| `src/screens/RemindersScreen.tsx` | Same. |
| `src/screens/InvoiceDetailScreen.tsx` | Read `invoice.clientName`. Look up client by `invoice.clientId`. Make CRUD calls `await`. |
| `src/screens/NewInvoiceScreen.tsx` | Client picker writes `clientId` + name/email snapshot. Read default currency from profile. `await addInvoice`. Add toast on error. |
| `src/screens/ClientFormScreen.tsx` | `await addClient` / `updateClient`. |
| `src/screens/ClientDetailScreen.tsx` | Filter invoices by `clientId`. `await deleteClient`. |
| `src/screens/ReportsScreen.tsx` | Update any client breakdown to use `clientName` / `clientId`. |
| `src/screens/SettingsScreen.tsx` | Add "Sign out" row showing user email. Add default-currency picker. |
| `src/i18n/en.ts` | Add auth, error, settings keys. |
| `src/i18n/es.ts` | Mirror new keys. |
| `package.json` | New dependencies. |
| `app.json` | Deleted (replaced by `app.config.ts`). |
| `.gitignore` | Add `.env.local`, `google-services.json`, `GoogleService-Info.plist`, `ios/`, `android/`. |

---

## Task 1: Firebase Project Setup

Create the Firebase project and enable required services. Most steps are external (Firebase console or MCP) — this task produces no code commits but is required before anything else.

**Files:** None (external setup)

- [ ] **Step 1: Create the Firebase project**

Use Firebase MCP if available, otherwise the Firebase Console at https://console.firebase.google.com.

If using the MCP:
```
Tool: mcp__plugin_firebase_firebase__firebase_create_project
Args: { displayName: "PAWL", projectId: "pawl-prod-<random-suffix>" }
```

Note the resulting `projectId` and `projectNumber`. You'll need both later.

- [ ] **Step 2: Enable Authentication providers**

In the Firebase Console → Authentication → Sign-in method, enable:
1. **Email/Password** (just toggle on)
2. **Google** — toggle on, set support email, copy the auto-generated **Web client ID** (you'll paste it into `.env.local` later)
3. **Apple** — toggle on. For native iOS, you don't need to fill the Service ID / OAuth code flow — those are only required for web Apple sign-in. Native uses `expo-apple-authentication` directly.

- [ ] **Step 3: Enable Firestore**

In Firebase Console → Firestore Database → Create database. Start in **production mode**. Pick a region close to your users (e.g., `us-east1` or `europe-west1`). Region cannot be changed later.

- [ ] **Step 4: Register the iOS app**

Console → Project Settings → Your apps → Add app → iOS.
- Bundle ID: `com.pawl.app` (we'll set this in `app.config.ts` in a later task)
- App nickname: `PAWL iOS`
- App Store ID: leave blank for now

Download `GoogleService-Info.plist` and save it somewhere outside the repo for reference (we won't commit it).

- [ ] **Step 5: Register the Android app**

Console → Add app → Android.
- Package name: `com.pawl.app`
- App nickname: `PAWL Android`
- SHA-1: leave blank for now (we'll add it after the first dev client build via `eas credentials` or local keytool)

Download `google-services.json` for reference. Don't commit.

- [ ] **Step 6: Register the Web app**

Console → Add app → Web.
- App nickname: `PAWL Web`

Copy the `firebaseConfig` object shown — these are the values we'll put in `.env.local`. Specifically:
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

- [ ] **Step 7: Note the Google OAuth client IDs**

Console → Project Settings → General → Your apps. For each app there's an **OAuth 2.0 client ID** auto-generated when you enabled Google sign-in. Copy:
- **Web client ID** (used as `webClientId` for `GoogleSignin.configure`)
- **iOS client ID** (used as `iosClientId`)
- **iOS URL scheme** (the reversed iOS client ID, e.g. `com.googleusercontent.apps.123456789-abc`)

- [ ] **Step 8: Verify in Firebase MCP**

Confirm your CLI/MCP can see the project:
```
Tool: mcp__plugin_firebase_firebase__firebase_list_projects
```

Expected: project `pawl-prod-*` appears in the list.

No commit for this task — just gather credentials. Save them in a temporary scratch file you'll delete after Task 4.

---

## Task 2: Install Dependencies

Add all required npm packages.

**Files:** Modify `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime dependencies**

Run from project root:
```bash
cd /Users/botchtech/Desktop/pawl
npx expo install firebase @react-native-async-storage/async-storage @react-native-google-signin/google-signin expo-apple-authentication expo-dev-client expo-crypto
```

Expected: each package installs at the Expo-recommended version for SDK 54. No errors.

- [ ] **Step 2: Verify installation**

```bash
npx tsc --noEmit
```

Expected: PASS (no type errors). It should compile because we haven't imported anything yet.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add firebase, google-signin, apple-auth, dev-client, async-storage, crypto"
```

---

## Task 3: Generate Native Projects (Prebuild) and Verify Dev Client Builds

Native modules (Google sign-in, Apple sign-in) require an `expo-dev-client` build. This task produces the `ios/` and `android/` folders and confirms the dev client runs.

**Files:** Create `ios/`, `android/`, modify `.gitignore`

- [ ] **Step 1: Update .gitignore before prebuild**

Edit `.gitignore` and append:
```
# Native projects (generated by expo prebuild)
ios/
android/

# Local env
.env.local

# Firebase per-app configs (kept out of repo; supplied at build time)
google-services.json
GoogleService-Info.plist
```

- [ ] **Step 2: Run expo prebuild**

```bash
npx expo prebuild
```

Expected: prompt for app slug confirmation, then generates `ios/PAWL.xcworkspace` and `android/`. Takes 30–90 seconds.

If the command fails because `app.config.ts` doesn't exist yet (we create it in Task 4), it will still read `app.json` — that's fine for now. We'll re-prebuild after creating `app.config.ts`.

- [ ] **Step 3: Build and run iOS dev client**

```bash
npx expo run:ios
```

Expected: Xcode build runs (~3–5 minutes first time). Simulator launches. App opens to current PAWL screens. No code changes yet, so behavior is identical to before — this just confirms the dev client compiles.

If you hit CocoaPods errors, run `cd ios && pod install && cd ..` then retry.

- [ ] **Step 4: Build and run Android dev client**

```bash
npx expo run:android
```

Expected: Gradle build runs (~3–5 minutes first time). Emulator launches with the app. Same as iOS verification.

- [ ] **Step 5: Commit**

Only `.gitignore` should have changes (the `ios/` and `android/` folders are now ignored).

```bash
git add .gitignore
git commit -m "build: add expo-dev-client, gitignore native projects and env"
```

---

## Task 4: Create app.config.ts and Environment Files

Replace `app.json` with TypeScript-based config so we can read environment variables. Add the env template.

**Files:** Create `app.config.ts`, `.env.local`, `.env.example`. Delete `app.json`.

- [ ] **Step 1: Create .env.local**

Create `/Users/botchtech/Desktop/pawl/.env.local` with the values from Task 1:

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=pawl-prod-xxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=pawl-prod-xxxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=pawl-prod-xxxx.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef0123456789
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789012-abc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789012-def.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.123456789012-def
```

Replace each value with the real ones from Firebase Console.

- [ ] **Step 2: Create .env.example**

Create `/Users/botchtech/Desktop/pawl/.env.example` with the same keys but no values:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
```

- [ ] **Step 3: Create app.config.ts**

Create `/Users/botchtech/Desktop/pawl/app.config.ts`:

```ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'PAWL',
  slug: 'pawl',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    bundleIdentifier: 'com.pawl.app',
    supportsTablet: true,
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.pawl.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-font',
    'expo-localization',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? '' },
    ],
  ],
  extra: {
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  },
};

export default config;
```

- [ ] **Step 4: Delete app.json**

```bash
rm /Users/botchtech/Desktop/pawl/app.json
```

- [ ] **Step 5: Re-prebuild to pick up new config**

```bash
npx expo prebuild --clean
```

Expected: regenerates `ios/` and `android/` with new bundle id, Apple sign-in entitlement, Google sign-in URL scheme.

- [ ] **Step 6: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Verify the app still launches**

```bash
npx expo run:ios
```

Expected: app launches normally. Same UI as before.

- [ ] **Step 8: Commit**

```bash
git add app.config.ts .env.example .gitignore
git rm app.json
git commit -m "config: switch to app.config.ts with env-based Firebase + Google config"
```

(`.env.local` is gitignored — it should not appear in `git status`.)

---

## Task 5: Firebase Init Module

Create the single source of truth for initialized Firebase services.

**Files:** Create `src/lib/firebase.ts`

- [ ] **Step 1: Read Expo Constants extras into the module**

Create `/Users/botchtech/Desktop/pawl/src/lib/firebase.ts`:

```ts
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

export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const googleClientIds = {
  webClientId: extra.googleWebClientId,
  iosClientId: extra.googleIosClientId,
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Smoke-test by importing in App.tsx temporarily**

Open `App.tsx` and add at the top of the file (above other imports for visibility):

```ts
import './src/lib/firebase';
```

Run:
```bash
npx expo start
```

Then press `i` to open iOS simulator. Watch the Metro logs.

Expected: app launches without throwing the "Firebase config missing" error. If it throws, your `.env.local` values are wrong or missing — fix them and retry.

- [ ] **Step 4: Remove the smoke-test import**

Delete the temporary `import './src/lib/firebase';` line you just added in `App.tsx`. We'll wire it up properly in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase.ts
git commit -m "feat(firebase): init module for app, auth (RN persistence), firestore offline cache"
```

---

## Task 6: Auth Provider with Email/Password

Create the auth context. Email/password methods only in this task; Google and Apple come later.

**Files:** Create `src/lib/auth.tsx`

- [ ] **Step 1: Create the auth provider**

Create `/Users/botchtech/Desktop/pawl/src/lib/auth.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    throw new Error('Google sign-in not wired yet — added in Task 21');
  }, []);

  const signInWithApple = useCallback(async () => {
    throw new Error('Apple sign-in not wired yet — added in Task 22');
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const value: AuthContextValue = {
    user,
    initializing,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'auth.error.invalidCredential';
    case 'auth/email-already-in-use':
      return 'auth.error.emailInUse';
    case 'auth/weak-password':
      return 'auth.error.weakPassword';
    case 'auth/user-not-found':
      return 'auth.error.userNotFound';
    case 'auth/network-request-failed':
      return 'auth.error.network';
    default:
      return 'auth.error.generic';
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.tsx
git commit -m "feat(auth): AuthProvider with email/password methods"
```

---

## Task 7: SignInScreen (email-only first)

Build the sign-in UI. Google/Apple buttons render but are disabled until later tasks.

**Files:** Create `src/screens/SignInScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `/Users/botchtech/Desktop/pawl/src/screens/SignInScreen.tsx`:

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useAuth, mapAuthError } from '../lib/auth';

type Mode = 'signIn' | 'signUp' | 'reset';

export default function SignInScreen() {
  const { c } = useTheme();
  const t = useT();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || (mode !== 'reset' && !password)) return;
    setLoading(true);
    try {
      if (mode === 'signIn') await auth.signInWithEmail(email, password);
      else if (mode === 'signUp') await auth.signUpWithEmail(email, password);
      else {
        await auth.resetPassword(email);
        Alert.alert(t('auth.resetEmailSent'));
        setMode('signIn');
      }
    } catch (err) {
      const key = mapAuthError(err);
      Alert.alert(t(key as any));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await auth.signInWithGoogle();
    } catch (err) {
      Alert.alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      await auth.signInWithApple();
    } catch (err) {
      Alert.alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: c.text }]}>PAWL</Text>
          <Text style={[styles.subtitle, { color: c.sub }]}>
            {mode === 'signIn' && t('auth.signIn')}
            {mode === 'signUp' && t('auth.signUp')}
            {mode === 'reset' && t('auth.resetPassword')}
          </Text>

          <View style={styles.tabs}>
            {(['signIn', 'signUp', 'reset'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.tab, mode === m && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
              >
                <Text style={{ color: mode === m ? c.text : c.sub, fontWeight: '500' }}>
                  {t(`auth.${m === 'signIn' ? 'signIn' : m === 'signUp' ? 'signUp' : 'resetPassword'}` as any)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.faint, backgroundColor: c.surface }]}
            placeholder={t('auth.email')}
            placeholderTextColor={c.sub}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {mode !== 'reset' && (
            <TextInput
              style={[styles.input, { color: c.text, borderColor: c.faint, backgroundColor: c.surface }]}
              placeholder={t('auth.password')}
              placeholderTextColor={c.sub}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: c.accent, opacity: loading ? 0.6 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'signIn' && t('auth.signIn')}
                {mode === 'signUp' && t('auth.signUp')}
                {mode === 'reset' && t('auth.resetPassword')}
              </Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: c.faint }]} />
            <Text style={{ color: c.sub, marginHorizontal: 12 }}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: c.faint }]} />
          </View>

          <Pressable
            onPress={handleGoogle}
            disabled={loading}
            style={[styles.secondaryBtn, { borderColor: c.faint }]}
          >
            <Text style={[styles.secondaryBtnText, { color: c.text }]}>
              {t('auth.continueWithGoogle')}
            </Text>
          </Pressable>

          {Platform.OS === 'ios' && (
            <Pressable
              onPress={handleApple}
              disabled={loading}
              style={[styles.secondaryBtn, { borderColor: c.faint }]}
            >
              <Text style={[styles.secondaryBtnText, { color: c.text }]}>
                {t('auth.continueWithApple')}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingTop: 80 },
  title: { fontSize: 36, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  tab: { paddingVertical: 12, paddingHorizontal: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  primaryBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '500' },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors about unknown i18n keys (`auth.signIn`, etc.) — that's because we add them in a later task. To unblock, temporarily add the keys to `en.ts` now (we'll do the full set in Task 20). Append these lines to `src/i18n/en.ts` before the closing brace:

```ts
'auth.signIn': 'Sign In',
'auth.signUp': 'Sign Up',
'auth.resetPassword': 'Reset Password',
'auth.email': 'Email',
'auth.password': 'Password',
'auth.continueWithGoogle': 'Continue with Google',
'auth.continueWithApple': 'Continue with Apple',
'auth.resetEmailSent': 'Password reset email sent',
'auth.error.invalidCredential': 'Invalid email or password',
'auth.error.emailInUse': 'Email already registered',
'auth.error.weakPassword': 'Password too weak (min 6 characters)',
'auth.error.userNotFound': 'No account found for this email',
'auth.error.network': 'Network error — check connection',
'auth.error.generic': 'Something went wrong. Try again.',
```

Then re-run `npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SignInScreen.tsx src/i18n/en.ts
git commit -m "feat(auth): SignInScreen with sign-in/sign-up/reset modes"
```

---

## Task 8: Wire AuthProvider into App.tsx and Gate Stacks

Mount `AuthProvider`. Show `SignInScreen` when no user, `AppStack` when there is.

**Files:** Modify `App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the entire `App.tsx` file with this version:

```tsx
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home, FileText, Users, Settings, Plus } from 'lucide-react-native';
import { ThemeProvider, useTheme } from './src/theme';
import { I18nProvider, useT } from './src/i18n';
import { AuthProvider, useAuth } from './src/lib/auth';
import DashboardScreen from './src/screens/DashboardScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TapToReceiveScreen from './src/screens/TapToReceiveScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import NewInvoiceScreen from './src/screens/NewInvoiceScreen';
import ClientDetailScreen from './src/screens/ClientDetailScreen';
import ClientFormScreen from './src/screens/ClientFormScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import InvoiceDetailScreen from './src/screens/InvoiceDetailScreen';
import SignInScreen from './src/screens/SignInScreen';
import SplashScreen from './src/screens/SplashScreen';
import TabBarBackground, { TAB_BAR_HEIGHT } from './src/components/TabBarBackground';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function EmptyScreen() { return <View />; }

function TabNav() {
  const { c, dark } = useTheme();
  const stackNav = useNavigation<any>();
  const t = useT();

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarBackground: () => <TabBarBackground />,
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            position: 'absolute',
            elevation: 0,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 28,
            paddingTop: 8,
          },
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.faint,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        }}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarLabel: t('nav.home'),
            tabBarIcon: ({ color, focused }) => <Home size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
        <Tab.Screen
          name="Invoices"
          component={InvoicesScreen}
          options={{
            tabBarLabel: t('nav.invoices'),
            tabBarIcon: ({ color, focused }) => <FileText size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
        <Tab.Screen
          name="Create"
          component={EmptyScreen}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={[styles.plusBtn, { backgroundColor: c.accent, shadowColor: c.accent }]}>
                <Plus size={26} color="#fff" strokeWidth={2.5} />
              </View>
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              stackNav.navigate('NewInvoice');
            },
          })}
        />
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{
            tabBarLabel: t('nav.clients'),
            tabBarIcon: ({ color, focused }) => <Users size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
        <Tab.Screen
          name="More"
          component={SettingsScreen}
          options={{
            tabBarLabel: t('nav.more'),
            tabBarIcon: ({ color, focused }) => <Settings size={22} color={color} strokeWidth={focused ? 2.2 : 1.4} />,
          }}
        />
      </Tab.Navigator>
    </>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNav} />
      <Stack.Screen name="TapToReceive" component={TapToReceiveScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="NewInvoice" component={NewInvoiceScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="ClientForm" component={ClientFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const { c, dark } = useTheme();
  const { user, initializing } = useAuth();
  const base = dark ? DarkTheme : DefaultTheme;
  const [splashDone, setSplashDone] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        theme={{
          ...base,
          dark,
          colors: {
            ...base.colors,
            primary: c.accent,
            background: c.bg,
            card: c.surface,
            text: c.text,
            border: 'transparent',
            notification: c.red,
          },
        }}
      >
        {initializing ? (
          <View style={[styles.center, { backgroundColor: c.bg }]}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : user ? (
          <AppStack />
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Manual verification — sign-up, sign-in, sign-out**

```bash
npx expo run:ios
```

In the simulator:
1. After splash, you should see the SignInScreen.
2. Tap **Sign Up**, enter `test1@example.com` / `password123`, tap the button.
3. App should switch to the AppStack (you see the Dashboard).
4. Stop the app. Reopen — you should still be signed in (Firebase Auth persists via AsyncStorage).
5. Open Firebase Console → Authentication → Users — verify `test1@example.com` appears.

To sign out, you can't yet (we add that in Task 19). For testing, kill the app + delete app data, or use the Firebase Console to delete the user.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(auth): wire AuthProvider; gate AppStack behind signed-in user"
```

---

## Task 9: Migrate `src/data/invoices.ts` to Firestore

This is the biggest single-file change. Replace seed array + sync mutations with Firestore listener + async CRUD. Update types to add `clientId`, `clientName`, `clientEmail`, `currency`, etc.

**Files:** Modify `src/data/invoices.ts`

- [ ] **Step 1: Read the current file in full**

```bash
cat /Users/botchtech/Desktop/pawl/src/data/invoices.ts
```

Take note of all exported helpers (`daysUntilDue`, `isOverdue`, `formatDateShort`, `formatDateLong`, `formatDueStatus`, `nextInvoiceNumber`, `addInvoice`, `updateInvoice`, `deleteInvoice`, `useInvoices`, `Invoice` type). All of these must remain exported (some with new signatures).

- [ ] **Step 2: Replace the file**

Replace the contents of `/Users/botchtech/Desktop/pawl/src/data/invoices.ts` with the following. Note: the helpers `daysUntilDue`, `isOverdue`, `formatDateShort`, `formatDateLong`, `formatDueStatus` are preserved unchanged from the original — copy them verbatim from your current file into the placeholder at the bottom. The rest is new.

```ts
import { useSyncExternalStore } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCurrentLocale } from '../i18n';
import en from '../i18n/en';
import es from '../i18n/es';

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export type InvoiceLineItem = {
  id: string;
  description: string;
  amount: number;
};

export type Invoice = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  service: string;
  items?: InvoiceLineItem[];
  notes?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedDate?: string;
  dueDate: string;
  paidDate?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  localCreatedAt: number;
};

export type NewInvoiceInput = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'localCreatedAt'>;

let invoices: Invoice[] = [];
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

const getSnapshot = (): Invoice[] => invoices;

export const useInvoices = (): Invoice[] => useSyncExternalStore(subscribe, getSnapshot);

export function attachInvoicesListener(uid: string | null) {
  unsub?.();
  currentUid = uid;
  if (!uid) {
    invoices = [];
    notify();
    return;
  }
  const q = query(
    collection(db, 'users', uid, 'invoices'),
    orderBy('localCreatedAt', 'desc'),
  );
  unsub = onSnapshot(q, (snap) => {
    invoices = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) }));
    notify();
  });
}

function requireUid(): string {
  if (!currentUid) throw new Error('Cannot mutate invoices: not signed in');
  return currentUid;
}

export async function addInvoice(input: NewInvoiceInput): Promise<string> {
  const uid = requireUid();
  const ref = await addDoc(collection(db, 'users', uid, 'invoices'), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    localCreatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<void> {
  const uid = requireUid();
  const { id: _ignored, createdAt: _c, localCreatedAt: _l, ...writable } = patch;
  await updateDoc(doc(db, 'users', uid, 'invoices', id), {
    ...writable,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(db, 'users', uid, 'invoices', id));
}

export function nextInvoiceNumber(): string {
  let max = 0;
  for (const inv of invoices) {
    const m = /(\d+)\s*$/.exec(inv.number);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

// ---- Date helpers (unchanged from previous version) ----
// COPY VERBATIM FROM PREVIOUS FILE: daysUntilDue, isOverdue, formatDateShort,
// formatDateLong, formatDueStatus. They depend only on `Invoice.dueDate` /
// `paidDate` (ISO strings) and the locale resolver — all still in scope.
```

For the date helpers at the bottom, copy them verbatim from the previous version of `src/data/invoices.ts`. They reference `getCurrentLocale`, `en`, and `es`, all of which are still imported at the top.

- [ ] **Step 3: Wire the listener into AuthProvider**

Open `src/lib/auth.tsx`. Add an import at the top:

```ts
import { attachInvoicesListener } from '../data/invoices';
```

Modify the `useEffect` block to call the listener:

```tsx
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u);
    setInitializing(false);
    attachInvoicesListener(u?.uid ?? null);
  });
  return unsub;
}, []);
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: a number of errors in screens that use `invoice.client` (string), `addInvoice(invoice)` with the old signature, etc. We will fix each screen in Tasks 12–18. For now, note them — they confirm we've correctly broken the old API surface.

To unblock the type-check enough to keep building, temporarily comment out or stub the broken screen lines is **not** acceptable. Instead, we'll fix each screen in its dedicated task. Skip type-check verification on subsequent tasks until Task 19, where we re-run it as a checkpoint.

- [ ] **Step 5: Commit**

```bash
git add src/data/invoices.ts src/lib/auth.tsx
git commit -m "feat(invoices): migrate store to Firestore with denormalized client snapshot"
```

---

## Task 10: Migrate `src/data/clients.ts` to Firestore

Same pattern as invoices, plus update the stats join to use `clientId`.

**Files:** Modify `src/data/clients.ts`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/botchtech/Desktop/pawl/src/data/clients.ts
```

Note all exports: `Client`, `ClientWithStats`, `GalleryItem`, `useClients`, `addClient`, `updateClient`, `deleteClient`. The `enrich` step inside `useClients` joins clients with invoices.

- [ ] **Step 2: Replace the file**

Replace the contents of `/Users/botchtech/Desktop/pawl/src/data/clients.ts` with:

```ts
import { useMemo, useSyncExternalStore } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useInvoices, type Invoice } from './invoices';

export type GalleryItem = {
  id: string;
  uri: string;
  caption?: string;
  addedAt: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  gallery?: GalleryItem[];
  createdAt: string;
  updatedAt?: Timestamp | null;
};

export type ClientWithStats = Client & {
  invoiceCount: number;
  totalBilled: number;
  outstandingAmount: number;
  lastInvoiceDate?: string;
};

export type NewClientInput = Omit<Client, 'id' | 'updatedAt'>;

let clients: Client[] = [];
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
const getSnapshot = (): Client[] => clients;

export function attachClientsListener(uid: string | null) {
  unsub?.();
  currentUid = uid;
  if (!uid) {
    clients = [];
    notify();
    return;
  }
  const q = query(
    collection(db, 'users', uid, 'clients'),
    orderBy('createdAt', 'desc'),
  );
  unsub = onSnapshot(q, (snap) => {
    clients = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
    notify();
  });
}

function requireUid(): string {
  if (!currentUid) throw new Error('Cannot mutate clients: not signed in');
  return currentUid;
}

function useClientsRaw(): Client[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useClients(): ClientWithStats[] {
  const all = useClientsRaw();
  const invoices = useInvoices();
  return useMemo(() => enrich(all, invoices), [all, invoices]);
}

function enrich(allClients: Client[], allInvoices: Invoice[]): ClientWithStats[] {
  return allClients.map((cl) => {
    const mine = allInvoices.filter((inv) => inv.clientId === cl.id);
    const totalBilled = mine.reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingAmount = mine
      .filter((inv) => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
    const lastInvoiceDate = mine
      .map((inv) => inv.issuedDate)
      .filter((d): d is string => !!d)
      .sort()
      .pop();
    return {
      ...cl,
      invoiceCount: mine.length,
      totalBilled,
      outstandingAmount,
      lastInvoiceDate,
    };
  });
}

export async function addClient(input: NewClientInput): Promise<string> {
  const uid = requireUid();
  const ref = await addDoc(collection(db, 'users', uid, 'clients'), {
    ...input,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  const uid = requireUid();
  const { id: _ignored, createdAt: _c, ...writable } = patch;
  await updateDoc(doc(db, 'users', uid, 'clients', id), {
    ...writable,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClient(id: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(db, 'users', uid, 'clients', id));
}
```

- [ ] **Step 3: Wire the clients listener into AuthProvider**

Open `src/lib/auth.tsx`. Update the import to include the clients listener:

```ts
import { attachInvoicesListener } from '../data/invoices';
import { attachClientsListener } from '../data/clients';
```

Update the `useEffect`:

```tsx
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u);
    setInitializing(false);
    attachInvoicesListener(u?.uid ?? null);
    attachClientsListener(u?.uid ?? null);
  });
  return unsub;
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add src/data/clients.ts src/lib/auth.tsx
git commit -m "feat(clients): migrate store to Firestore; join invoices by clientId"
```

---

## Task 11: Create the Profile Store

A new module store for `users/{uid}` profile doc holding `defaultCurrency`.

**Files:** Create `src/data/profile.ts`. Modify `src/lib/auth.tsx`.

- [ ] **Step 1: Create the profile store**

Create `/Users/botchtech/Desktop/pawl/src/data/profile.ts`:

```ts
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
```

- [ ] **Step 2: Wire profile listener into AuthProvider**

Open `src/lib/auth.tsx`. Add the import:

```ts
import { attachProfileListener } from '../data/profile';
```

Update the `useEffect`:

```tsx
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u);
    setInitializing(false);
    attachInvoicesListener(u?.uid ?? null);
    attachClientsListener(u?.uid ?? null);
    attachProfileListener(u?.uid ?? null);
  });
  return unsub;
}, []);
```

- [ ] **Step 3: Commit**

```bash
git add src/data/profile.ts src/lib/auth.tsx
git commit -m "feat(profile): add user profile store for default currency"
```

---

## Task 12: Update DashboardScreen for new Invoice fields

Replace `invoice.client` reads with `invoice.clientName`.

**Files:** Modify `src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Find usages**

```bash
grep -n "invoice.client\|inv.client" /Users/botchtech/Desktop/pawl/src/screens/DashboardScreen.tsx
```

Note each line number.

- [ ] **Step 2: Replace each occurrence**

For every match found in step 1, change `invoice.client` → `invoice.clientName` (or `inv.client` → `inv.clientName`). Use the Edit tool for each line.

If there are no matches, this task is a no-op for this screen. Move on.

- [ ] **Step 3: Type-check this file**

```bash
npx tsc --noEmit 2>&1 | grep DashboardScreen
```

Expected: no errors specific to `DashboardScreen.tsx`. Errors in other files are still expected — we fix them in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "refactor(dashboard): use invoice.clientName (denormalized)"
```

---

## Task 13: Update InvoicesScreen

Same fix as Dashboard.

**Files:** Modify `src/screens/InvoicesScreen.tsx`

- [ ] **Step 1: Replace `invoice.client` reads**

In `src/screens/InvoicesScreen.tsx`, line 226 and any other occurrences, change `invoice.client` → `invoice.clientName`.

- [ ] **Step 2: Type-check this file**

```bash
npx tsc --noEmit 2>&1 | grep InvoicesScreen
```

Expected: no errors specific to this file.

- [ ] **Step 3: Commit**

```bash
git add src/screens/InvoicesScreen.tsx
git commit -m "refactor(invoices-list): use invoice.clientName"
```

---

## Task 14: Update RemindersScreen

Same fix.

**Files:** Modify `src/screens/RemindersScreen.tsx`

- [ ] **Step 1: Replace**

In `src/screens/RemindersScreen.tsx` line 210, change `invoice.client` → `invoice.clientName`.

- [ ] **Step 2: Type-check this file**

```bash
npx tsc --noEmit 2>&1 | grep RemindersScreen
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/screens/RemindersScreen.tsx
git commit -m "refactor(reminders): use invoice.clientName"
```

---

## Task 15: Update InvoiceDetailScreen

Replace `invoice.client` reads, change client lookup to `clientId`, make CRUD calls async.

**Files:** Modify `src/screens/InvoiceDetailScreen.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/botchtech/Desktop/pawl/src/screens/InvoiceDetailScreen.tsx
```

Identify:
- Line 70: `const clientRecord = clients.find((cl) => cl.name === invoice.client);` → change to `cl.id === invoice.clientId`
- Line 88: `t('invoice.reminder_sent_body', { client: invoice.client })` → `{ client: invoice.clientName }`
- Line 97: `client: invoice.client,` (probably in nav params) → `client: invoice.clientName,`
- Line 163, 178: display `invoice.client` → `invoice.clientName`
- Any `updateInvoice(...)` or `deleteInvoice(...)` calls — wrap in `try/await` with error toast

- [ ] **Step 2: Make each replacement**

For each line above, use the Edit tool. For each mutation call, change e.g.:

```tsx
// BEFORE
const handleDelete = () => {
  deleteInvoice(invoice.id);
  navigation.goBack();
};

// AFTER
const handleDelete = async () => {
  try {
    await deleteInvoice(invoice.id);
    navigation.goBack();
  } catch (err) {
    Alert.alert(t('common.error'), (err as Error).message);
  }
};
```

Apply the same async/try-catch pattern to any `updateInvoice` calls in this screen.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep InvoiceDetailScreen
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/InvoiceDetailScreen.tsx
git commit -m "refactor(invoice-detail): use clientId join, await async CRUD"
```

---

## Task 16: Update NewInvoiceScreen (most complex)

Client picker writes `clientId` + `clientName` + `clientEmail` snapshot. Currency comes from profile. `addInvoice` is awaited.

**Files:** Modify `src/screens/NewInvoiceScreen.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/botchtech/Desktop/pawl/src/screens/NewInvoiceScreen.tsx
```

Identify the parts to change:
- The current client picker probably stores a `clientName` string in local state. We need to switch it to store the picked `Client` object (or its `id`), and then on save include `clientId`, `clientName`, `clientEmail`.
- The save handler probably calls `addInvoice({ ... })` synchronously. Change to `await addInvoice({ ... })`.
- Read default currency from `useProfile()`.
- Add error handling (Alert) on failure.

- [ ] **Step 2: Make the changes**

At the top, add imports:

```ts
import { useProfile } from '../data/profile';
import { useClients } from '../data/clients';
```

In the component body, near other hooks:

```ts
const profile = useProfile();
const clients = useClients();
const [pickedClient, setPickedClient] = useState<{ id: string; name: string; email?: string } | null>(null);
```

If there's already a `client` (string) state, replace it with the `pickedClient` state above. Update the picker UI: clicking a client in the list calls `setPickedClient({ id: c.id, name: c.name, email: c.email })`.

Update the save handler. Replace whatever `addInvoice` call exists with:

```ts
const handleSave = async () => {
  if (!pickedClient) {
    Alert.alert(t('new_invoice.pick_client_first'));
    return;
  }
  setSaving(true);
  try {
    await addInvoice({
      number: nextInvoiceNumber(),
      clientId: pickedClient.id,
      clientName: pickedClient.name,
      clientEmail: pickedClient.email,
      service,
      items,
      notes,
      amount,
      currency: profile.defaultCurrency,
      status: 'pending',
      issuedDate: new Date().toISOString().slice(0, 10),
      dueDate,
    });
    navigation.goBack();
  } catch (err) {
    Alert.alert(t('common.error'), (err as Error).message);
  } finally {
    setSaving(false);
  }
};
```

(The exact local field names — `service`, `items`, `notes`, `amount`, `dueDate` — should already exist in the screen's local state. Wire them through as-is.)

Add a `saving` state for the loading indicator: `const [saving, setSaving] = useState(false);`

- [ ] **Step 3: Add the missing i18n keys**

Append to `src/i18n/en.ts`:

```ts
'new_invoice.pick_client_first': 'Pick a client first',
'common.error': 'Error',
```

(Spanish mirror happens in Task 20.)

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep NewInvoiceScreen
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/NewInvoiceScreen.tsx src/i18n/en.ts
git commit -m "refactor(new-invoice): clientId+snapshot picker, currency from profile, async save"
```

---

## Task 17: Update ClientFormScreen

Make `addClient` / `updateClient` async with error handling.

**Files:** Modify `src/screens/ClientFormScreen.tsx`

- [ ] **Step 1: Find mutation calls**

```bash
grep -n "addClient\|updateClient" /Users/botchtech/Desktop/pawl/src/screens/ClientFormScreen.tsx
```

- [ ] **Step 2: Convert to async**

For each call, wrap in `try/await`:

```tsx
const handleSave = async () => {
  setSaving(true);
  try {
    if (existingClient) {
      await updateClient(existingClient.id, { name, email, phone, address, notes });
    } else {
      await addClient({ name, email, phone, address, notes, createdAt: new Date().toISOString().slice(0, 10) });
    }
    navigation.goBack();
  } catch (err) {
    Alert.alert(t('common.error'), (err as Error).message);
  } finally {
    setSaving(false);
  }
};
```

Add `const [saving, setSaving] = useState(false);` near the top of the component.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep ClientFormScreen
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ClientFormScreen.tsx
git commit -m "refactor(client-form): await async addClient/updateClient with error toast"
```

---

## Task 18: Update ClientDetailScreen

Filter invoices by `clientId`. Make `deleteClient` async.

**Files:** Modify `src/screens/ClientDetailScreen.tsx`

- [ ] **Step 1: Find filter and delete usage**

```bash
grep -n "client.name\|inv.client\|deleteClient\|invoice.client" /Users/botchtech/Desktop/pawl/src/screens/ClientDetailScreen.tsx
```

- [ ] **Step 2: Update filter**

Wherever the screen filters invoices by client (e.g., `invoices.filter(inv => inv.client === client.name)`), change to `inv => inv.clientId === client.id`.

- [ ] **Step 3: Async deleteClient**

```tsx
const handleDelete = async () => {
  try {
    await deleteClient(client.id);
    navigation.goBack();
  } catch (err) {
    Alert.alert(t('common.error'), (err as Error).message);
  }
};
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep ClientDetailScreen
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ClientDetailScreen.tsx
git commit -m "refactor(client-detail): filter invoices by clientId, await deleteClient"
```

---

## Task 19: Update ReportsScreen and SettingsScreen

ReportsScreen uses `invoice.client` for any breakdown — fix. SettingsScreen gets sign-out + currency picker.

**Files:** Modify `src/screens/ReportsScreen.tsx`, `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Update ReportsScreen**

```bash
grep -n "invoice.client\|inv.client" /Users/botchtech/Desktop/pawl/src/screens/ReportsScreen.tsx
```

Replace each match: `invoice.client` → `invoice.clientName`. If the breakdown groups by client, switch to grouping by `clientId` (with `clientName` as display label).

- [ ] **Step 2: Update SettingsScreen — read current file**

```bash
cat /Users/botchtech/Desktop/pawl/src/screens/SettingsScreen.tsx
```

- [ ] **Step 3: Add sign-out row**

At the top of `SettingsScreen.tsx`, add:

```tsx
import { useAuth } from '../lib/auth';
import { useProfile, updateProfile } from '../data/profile';
```

In the component body, near other hooks:

```ts
const { user, signOut } = useAuth();
const profile = useProfile();
```

Add a sign-out row in the appropriate section of the existing settings list. The exact placement depends on the screen's current structure — add it near the bottom of the main settings section:

```tsx
<Pressable
  onPress={() => {
    Alert.alert(
      t('auth.signOutConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.signOut'),
          style: 'destructive',
          onPress: async () => { try { await signOut(); } catch {} },
        },
      ],
    );
  }}
  style={[styles.row, { borderBottomColor: c.faint }]}
>
  <View>
    <Text style={[styles.rowLabel, { color: c.text }]}>{t('auth.signOut')}</Text>
    {user?.email && (
      <Text style={[styles.rowSubLabel, { color: c.sub }]}>{user.email}</Text>
    )}
  </View>
</Pressable>
```

(Reuse the existing row styles from this screen — pattern names like `styles.row`, `styles.rowLabel`, `styles.rowSubLabel` are placeholders; match what's already there.)

- [ ] **Step 4: Add the currency picker**

Add another row that opens a simple action sheet / modal listing common currencies:

```tsx
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'NGN', 'ZAR'];

const handleCurrencyPress = () => {
  Alert.alert(
    t('settings.defaultCurrency'),
    undefined,
    [
      ...CURRENCIES.map((cur) => ({
        text: cur,
        onPress: async () => { try { await updateProfile({ defaultCurrency: cur }); } catch {} },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ],
  );
};

<Pressable onPress={handleCurrencyPress} style={[styles.row, { borderBottomColor: c.faint }]}>
  <Text style={[styles.rowLabel, { color: c.text }]}>{t('settings.defaultCurrency')}</Text>
  <Text style={[styles.rowSubLabel, { color: c.sub }]}>{profile.defaultCurrency}</Text>
</Pressable>
```

- [ ] **Step 5: Type-check the whole project**

```bash
npx tsc --noEmit
```

Expected: PASS for the whole project. This is the first full-clean checkpoint since Task 9.

If there are remaining errors, they're almost certainly more `invoice.client` reads we missed. Run:

```bash
grep -rn "invoice\.client\b\|inv\.client\b" /Users/botchtech/Desktop/pawl/src/
```

Fix any matches that aren't already `invoice.clientName`.

- [ ] **Step 6: Manual verification**

```bash
npx expo run:ios
```

Sign in with the test account. Verify:
1. Empty Dashboard / Invoices / Clients (since seeds are dropped)
2. Tap "+" → New Invoice screen renders. The currency placeholder shows `USD`.
3. Create a new client → it appears in Clients tab.
4. Create a new invoice picking that client → it appears in Invoices tab. Detail page shows the client name.
5. Open Settings → tap default currency → pick `EUR` → currency value updates immediately.
6. Tap Sign out → returns to SignInScreen.
7. Sign back in → invoices and clients are still there. EUR still set.

- [ ] **Step 7: Commit**

```bash
git add src/screens/ReportsScreen.tsx src/screens/SettingsScreen.tsx
git commit -m "feat(settings): sign out + default currency picker; reports use clientName"
```

---

## Task 20: Add the rest of the i18n keys (en + es)

Mirror everything to Spanish.

**Files:** Modify `src/i18n/en.ts`, `src/i18n/es.ts`

- [ ] **Step 1: Make sure en.ts has all auth/settings keys**

Open `src/i18n/en.ts` and verify these keys exist (add any missing). The full set:

```ts
'auth.signIn': 'Sign In',
'auth.signUp': 'Sign Up',
'auth.resetPassword': 'Reset Password',
'auth.email': 'Email',
'auth.password': 'Password',
'auth.continueWithGoogle': 'Continue with Google',
'auth.continueWithApple': 'Continue with Apple',
'auth.signOut': 'Sign out',
'auth.signOutConfirm': 'Sign out of PAWL?',
'auth.resetEmailSent': 'Password reset email sent',
'auth.error.invalidCredential': 'Invalid email or password',
'auth.error.emailInUse': 'Email already registered',
'auth.error.weakPassword': 'Password too weak (min 6 characters)',
'auth.error.userNotFound': 'No account found for this email',
'auth.error.network': 'Network error — check connection',
'auth.error.generic': 'Something went wrong. Try again.',
'settings.defaultCurrency': 'Default currency',
'settings.signedInAs': 'Signed in as',
'common.cancel': 'Cancel',
'common.confirm': 'Confirm',
'common.retry': 'Retry',
'common.error': 'Error',
'new_invoice.pick_client_first': 'Pick a client first',
```

- [ ] **Step 2: Mirror to es.ts**

Open `src/i18n/es.ts` and add Spanish translations for every key above:

```ts
'auth.signIn': 'Iniciar sesión',
'auth.signUp': 'Crear cuenta',
'auth.resetPassword': 'Restablecer contraseña',
'auth.email': 'Correo electrónico',
'auth.password': 'Contraseña',
'auth.continueWithGoogle': 'Continuar con Google',
'auth.continueWithApple': 'Continuar con Apple',
'auth.signOut': 'Cerrar sesión',
'auth.signOutConfirm': '¿Cerrar sesión en PAWL?',
'auth.resetEmailSent': 'Se envió el correo de restablecimiento',
'auth.error.invalidCredential': 'Correo o contraseña no válidos',
'auth.error.emailInUse': 'Correo ya registrado',
'auth.error.weakPassword': 'Contraseña demasiado débil (mínimo 6 caracteres)',
'auth.error.userNotFound': 'No hay cuenta con este correo',
'auth.error.network': 'Error de red — verifica tu conexión',
'auth.error.generic': 'Algo salió mal. Intenta de nuevo.',
'settings.defaultCurrency': 'Moneda predeterminada',
'settings.signedInAs': 'Sesión iniciada como',
'common.cancel': 'Cancelar',
'common.confirm': 'Confirmar',
'common.retry': 'Reintentar',
'common.error': 'Error',
'new_invoice.pick_client_first': 'Elige un cliente primero',
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts
git commit -m "i18n: add auth/settings/common keys (en + es)"
```

---

## Task 21: Add Google Sign-In

Wire `@react-native-google-signin/google-signin` into the auth provider.

**Files:** Modify `src/lib/auth.tsx`. Modify `App.tsx` (for `GoogleSignin.configure`).

- [ ] **Step 1: Configure GoogleSignin at app start**

Open `App.tsx`. Add at the top:

```ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { googleClientIds } from './src/lib/firebase';
```

Just before the `export default function App()`:

```ts
GoogleSignin.configure({
  webClientId: googleClientIds.webClientId,
  iosClientId: googleClientIds.iosClientId,
  offlineAccess: false,
});
```

- [ ] **Step 2: Implement signInWithGoogle in auth.tsx**

Open `src/lib/auth.tsx`. Add imports:

```ts
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
```

Replace the placeholder `signInWithGoogle` body:

```ts
const signInWithGoogle = useCallback(async () => {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  // SignInResponse shape: { type: 'success' | 'cancelled', data?: { idToken } }
  if (result.type === 'cancelled') return;
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google sign-in returned no idToken');
  const cred = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, cred);
}, []);
```

(`statusCodes` import is included for future use; not strictly needed in this minimal flow.)

- [ ] **Step 3: Re-run prebuild for the plugin**

The `expo-google-sign-in` plugin set in `app.config.ts` (Task 4, step 3) injects native config. If you've changed `app.config.ts` since the last prebuild, re-run:

```bash
npx expo prebuild --clean
npx expo run:ios
```

- [ ] **Step 4: Manual verification**

In the simulator:
1. Sign out (if signed in).
2. Tap "Continue with Google".
3. Google's native sheet appears. Pick a Google account (the simulator can use the host machine's iCloud Keychain if you've set it up; otherwise enter credentials).
4. App switches to AppStack — signed in.
5. Check Firebase Console → Authentication → Users — the Google-linked user appears.

If you see "Idtoken is null" or similar, double-check your `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env.local` — it MUST be the **Web** client ID, not the iOS one.

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/lib/auth.tsx
git commit -m "feat(auth): Google sign-in via native module + Firebase credential"
```

---

## Task 22: Add Apple Sign-In

Wire `expo-apple-authentication`.

**Files:** Modify `src/lib/auth.tsx`

- [ ] **Step 1: Implement signInWithApple**

Open `src/lib/auth.tsx`. Add imports:

```ts
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
```

(Combine these with the existing `signInWithCredential` import from the Google task.)

Replace the placeholder `signInWithApple` body:

```ts
const signInWithApple = useCallback(async () => {
  const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token');
  const provider = new OAuthProvider('apple.com');
  const firebaseCred = provider.credential({
    idToken: credential.identityToken,
    rawNonce,
  });
  await signInWithCredential(auth, firebaseCred);
}, []);
```

- [ ] **Step 2: Manual verification**

```bash
npx expo run:ios
```

In the simulator (Apple sign-in only works on iOS — the SignInScreen already hides the button on Android):
1. Sign out.
2. Tap "Continue with Apple".
3. Apple's native sheet appears. The simulator must have an iCloud account signed in for this to work — set this up in Settings → [Account].
4. Choose "Share My Email" or "Hide My Email", then "Continue".
5. App switches to AppStack — signed in.
6. Firebase Console → Users — Apple user appears.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.tsx
git commit -m "feat(auth): Apple sign-in via expo-apple-authentication + Firebase credential"
```

---

## Task 23: Deploy Firestore Security Rules and Final End-to-End Verification

Lock down Firestore. Verify the full success criteria from the spec.

**Files:** Create `firestore.rules`

- [ ] **Step 1: Create the rules file**

Create `/Users/botchtech/Desktop/pawl/firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

- [ ] **Step 2: Deploy the rules**

If using Firebase MCP:
```
Tool: mcp__plugin_firebase_firebase__firebase_deploy
Args: { project: "pawl-prod-xxxx", only: "firestore:rules" }
```

Otherwise via CLI:
```bash
npm install -g firebase-tools  # if not already
firebase login
firebase use pawl-prod-xxxx
firebase deploy --only firestore:rules
```

Expected: "Deploy complete!"

- [ ] **Step 3: Verify rules in console**

Firebase Console → Firestore Database → Rules tab → confirm the new rules are live and the timestamp matches your deploy.

- [ ] **Step 4: Negative-path verification — User A cannot read User B's data**

Quick sanity check that rules work:
1. In the app, sign in as `test1@example.com`. Create one client and one invoice.
2. Sign out. Sign up as `test2@example.com`.
3. As user 2, you should see EMPTY lists — NOT user 1's data.
4. In Firebase Console → Firestore, navigate to `users/{user1-uid}/invoices` — you can see user 1's data as the project owner. That's expected.

If user 2 sees user 1's data, the rules didn't deploy correctly. Re-run step 2.

- [ ] **Step 5: Run through full success criteria from the spec**

Open spec at [`docs/superpowers/specs/2026-05-08-firebase-backend-design.md`](../specs/2026-05-08-firebase-backend-design.md) §1 and verify each criterion:

1. **Fresh user signs up via email → creates an invoice and a client → kills app → reopens → data persists.** PASS expected because Firestore offline cache + AsyncStorage auth persistence.
2. **Same user signs in on a second device → sees same data.** Test by running iOS simulator AND Android emulator, signing in as the same email on both, and verifying the same invoice list.
3. **Airplane mode → user can create/edit invoices → reconnect → changes sync.** Toggle airplane mode in iOS simulator (Settings → Airplane Mode), create an invoice, watch it appear in the list immediately, toggle airplane mode off, verify the doc lands in Firestore Console within ~5 seconds.
4. **Google sign-in works on both simulators.**
5. **Apple sign-in works on iOS simulator.**
6. **Sign-out returns to SignInScreen, cached data clears from local mirror.** Sign out, then watch the in-memory mirror — Dashboard / Invoices / Clients should all show empty states. Sign back in → data reloads.

If any criterion fails, file it as a bug and decide whether to fix now or move on.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Firestore security rules locked to request.auth.uid"
```

- [ ] **Step 7: Push the branch**

```bash
git push -u origin main
```

(Optional — only if the user asks. Otherwise leave it for them.)

---

## Self-Review Notes

After writing this plan, verified against the spec:

1. **Spec coverage check:**
   - §1 Goals (auth providers, persistence, multi-device, offline, currency) → Tasks 6, 7, 8, 9, 10, 11, 19, 21, 22, 23
   - §2 Architecture (AuthProvider, store internals swap) → Tasks 6, 8, 9, 10, 11
   - §3 Data Model (denormalization, security rules) → Tasks 9, 10, 11, 23
   - §4 Store Pattern → Tasks 9, 10, 11
   - §5 Auth Flow (gating, three modes, error mapping) → Tasks 7, 8, 19, 21, 22
   - §6 Setup (project, deps, prebuild, env, i18n) → Tasks 1, 2, 3, 4, 5, 20
   - §7 Risks (`localCreatedAt`, async API, dev client) → addressed in Tasks 9, 16, 17, 18, 19; dev client in Task 3
   - §8 Implementation Order → Tasks follow exactly the order in spec §8

2. **Type consistency:** `attachInvoicesListener`, `attachClientsListener`, `attachProfileListener` all match across tasks. `clientId` / `clientName` / `clientEmail` consistent. `currency` field added in Task 9, used in Task 16.

3. **Placeholder scan:** No "TBD"s. Each step shows actual code, exact paths, exact commands. The one explicit "copy verbatim" instruction (Task 9 step 2 for date helpers) is justified — those helpers are 30+ lines and unchanged from the original; copying preserves them exactly without inflating the plan.

4. **Scope:** Single subsystem (backend swap). EAS, NFC, tests deferred per spec §9. No decomposition needed.
