# PAWL Firebase Backend — Design

**Date:** 2026-05-08
**Status:** Proposed
**Scope:** Replace in-memory seed-data stores with Firebase Auth + Firestore. Offline-first. Email + Google + Apple sign-in.

---

## 1. Goals & Non-Goals

### Goals

- Authenticated users sign in with email/password, Google, or Apple
- Invoices and clients persist to Firestore, scoped per user
- Offline-first: app works on airplane, syncs on reconnect
- Multi-device: same account on phone + tablet sees same data
- Preserve existing screen/store API surface — minimal screen rewrites
- User-selectable default currency in profile

### Non-Goals (deferred to separate specs)

- EAS Cloud build / TestFlight distribution (local dev client only today)
- NFC / Tap-to-Pay payment processing
- Test runner setup (Jest, RTL)
- Org/team multi-tenancy (single-user accounts only)
- Push notifications, analytics, crash reporting
- Cloud Functions / server-side logic

### Success Criteria

1. Fresh user signs up via email → creates an invoice and a client → kills app → reopens → data persists
2. Same user signs in on a second device (or simulator) → sees same data
3. Airplane mode → user can create/edit invoices → reconnect → changes sync to other device within seconds
4. Google sign-in works on iOS simulator (via dev client) and Android emulator
5. Apple sign-in works on iOS simulator (sandbox account)
6. Sign-out → app returns to SignInScreen, cached data cleared from local mirror

---

## 2. Architecture

```
App.tsx
└─ SafeAreaProvider
   └─ I18nProvider
      └─ ThemeProvider
         └─ AuthProvider                    (NEW — Firebase auth state)
            └─ NavigationContainer
               ├─ AuthStack                 (NEW — only when !user)
               │  └─ SignInScreen
               └─ AppStack                  (existing — only when user)
                  ├─ TabNav (Dashboard, Invoices, Clients, Settings)
                  └─ Modal/Detail screens
```

### New modules

| File | Purpose |
|------|---------|
| `src/lib/firebase.ts` | Initialize Firebase app, auth (with AsyncStorage persistence on RN), Firestore (with offline persistence). Export `app`, `auth`, `db`. |
| `src/lib/auth.tsx` | `AuthProvider` + `useAuth()` hook. Owns `user`, `initializing`, all sign-in/out methods. Calls `attachInvoicesListener(uid)` and `attachClientsListener(uid)` on auth state change. |
| `src/screens/SignInScreen.tsx` | Three modes (Sign In / Sign Up / Reset). Email + password fields. Google button. Apple button (iOS only). |
| `firestore.rules` | Security rules — locked to `request.auth.uid`. |
| `app.config.ts` | Replaces `app.json` so Expo can read `process.env.EXPO_PUBLIC_FIREBASE_*`. |
| `.env.local` | Firebase web config (gitignored — public-safe but kept out for hygiene). |

### Modified modules

| File | Change |
|------|--------|
| `src/data/invoices.ts` | Internals swap to Firestore. Module mirror array fed by `onSnapshot`. CRUD becomes `async` calls to Firestore SDK. Drop seed array. New `attachInvoicesListener(uid)` / `detachInvoicesListener()` exports for `AuthProvider` to call. |
| `src/data/clients.ts` | Same pattern. Join in `useClients()` enrich changes from `name === client` to `clientId === id`. Drop seed array. |
| `src/data/profile.ts` (NEW) | Same store pattern for `users/{uid}` profile doc. `useProfile()` returns `{ defaultCurrency }`. `updateProfile(patch)`. |
| `App.tsx` | Mount `AuthProvider`. Gate `AppStack` behind `user`. Show `SignInScreen` when `!user`. Keep `SplashScreen` overlay during `initializing`. |
| `src/screens/NewInvoiceScreen.tsx` | `await addInvoice(...)`. Add try/catch with toast on failure. Replace string-name client picker with id-based picker (still shows name in UI). Read `defaultCurrency` from profile to prefill currency. |
| `src/screens/InvoiceDetailScreen.tsx` | `await updateInvoice` / `deleteInvoice`. Read `clientName`/`clientEmail` from invoice (denormalized) instead of joining. |
| `src/screens/ClientFormScreen.tsx` | `await addClient` / `updateClient`. |
| `src/screens/ClientDetailScreen.tsx` | `await deleteClient`. Stats join unchanged in surface; uses new id-based join under the hood. |
| `src/screens/SettingsScreen.tsx` | Add "Sign out" row showing user email. Add currency picker bound to profile `defaultCurrency`. |
| `src/i18n/en.ts` | Add auth + error keys (see §6). |
| `src/i18n/es.ts` | Mirror. |
| `package.json` | New deps (see §6). |
| `.gitignore` | Add `.env.local`, `google-services.json`, `GoogleService-Info.plist`. |

---

## 3. Data Model

### Firestore tree

```
users/{uid}                              ← profile doc (NEW)
   defaultCurrency: string               // "USD"
   createdAt: Timestamp
   updatedAt: Timestamp

users/{uid}/invoices/{invoiceId}
   number: string                        // "INV-0001" (existing)
   clientId: string                      // FK to clients/{id} (NEW — replaces string `client`)
   clientName: string                    // SNAPSHOT at creation/edit (NEW)
   clientEmail: string | null            // SNAPSHOT at creation/edit (NEW)
   service: string                       // human summary (existing)
   items: Array<{ id, description, amount }>  // existing shape
   notes: string                         // existing
   amount: number                        // existing
   currency: string                      // "USD" | "EUR" | ... (NEW — read from profile.defaultCurrency at creation)
   status: 'paid' | 'pending' | 'overdue'  // existing — UNCHANGED
   issuedDate: string                    // ISO YYYY-MM-DD (existing — note name `issuedDate` not `issueDate`)
   dueDate: string                       // ISO YYYY-MM-DD (existing)
   paidDate: string | null               // existing
   createdAt: Timestamp                  // NEW (Firestore server timestamp)
   updatedAt: Timestamp                  // NEW
   localCreatedAt: number                // NEW — Date.now() fallback for ordering while offline

users/{uid}/clients/{clientId}
   name: string                          // existing
   email: string | null                  // existing
   phone: string | null                  // existing
   address: string | null                // existing
   notes: string | null                  // existing
   gallery: Array<{ id, uri, caption?, addedAt }> | null  // existing
   createdAt: string                     // ISO YYYY-MM-DD (existing — kept as string, not Timestamp, to match current convention)
   updatedAt: Timestamp                  // NEW (server timestamp for change tracking)
```

### Key decisions

- **Denormalized client snapshot on invoice**: `clientName`/`clientEmail` frozen at invoice creation. Editing a client does NOT mutate past invoices. Matches real-world invoice semantics.
- **Stats join in `useClients()`**: switches from `invoice.client === client.name` to `invoice.clientId === client.id`. Stable across renames.
- **Doc IDs**: Firestore auto-IDs for both. `invoice.number` is human-facing label only.
- **`nextInvoiceNumber()`**: scans local mirror (already in memory via `onSnapshot`) — no server round-trip. Race condition possible across two devices creating simultaneously offline; acceptable for V1 (last-write-wins; user can edit).
- **Dates**: ISO strings preserved per existing convention. `createdAt`/`updatedAt` are Firestore Timestamps for ordering only.
- **`localCreatedAt`**: fallback for ordering when offline (Firestore `serverTimestamp()` resolves to `null` until sync, which would misorder pending docs).
- **Currency on invoice**: per-invoice (existing). User profile holds `defaultCurrency` used to prefill new invoices.

### Type changes (`src/data/invoices.ts`, `clients.ts`)

```ts
// BEFORE (current)
type Invoice = {
  id: string;
  number?: string;
  client: string;              // ← name string (REMOVED)
  service: string;
  items?: InvoiceLineItem[];
  notes?: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  issuedDate?: string;
  dueDate: string;
  paidDate?: string;
};

// AFTER
type Invoice = {
  id: string;                  // Firestore doc id
  number: string;              // now required (auto-generated)
  clientId: string;            // NEW — FK
  clientName: string;          // NEW — denormalized snapshot
  clientEmail?: string;        // NEW — denormalized snapshot
  service: string;
  items?: InvoiceLineItem[];   // shape unchanged: { id, description, amount }
  notes?: string;
  amount: number;
  currency: string;            // NEW — copied from profile at creation
  status: 'paid' | 'pending' | 'overdue';
  issuedDate?: string;
  dueDate: string;
  paidDate?: string;
  createdAt?: Timestamp;       // NEW — server
  updatedAt?: Timestamp;       // NEW — server
  localCreatedAt: number;      // NEW — Date.now() fallback
};

// Client type — unchanged shape, but `id` is now Firestore doc id
type UserProfile = {
  defaultCurrency: string;     // e.g. "USD"
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
```

### Migration path for existing screens

Every screen reading `invoice.client` (string name) must change to `invoice.clientName`. Audit list (from grep):

- `DashboardScreen.tsx` — invoice cards
- `InvoicesScreen.tsx` — list rendering
- `InvoiceDetailScreen.tsx` — detail header
- `NewInvoiceScreen.tsx` — client picker output (writes `clientId` + snapshot)
- `ClientDetailScreen.tsx` — invoices-for-client filter (now filters by `clientId`)
- `ReportsScreen.tsx` — any client breakdown

### Security rules (`firestore.rules`)

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

Deployed via `firebase_deploy` MCP tool or `firebase deploy --only firestore:rules`.

---

## 4. Store Pattern (the swap)

Existing API surface preserved. Internals replaced.

```ts
// src/data/invoices.ts (sketch)

import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSyncExternalStore } from 'react';

let invoices: Invoice[] = [];
const listeners = new Set<() => void>();
let unsub: (() => void) | null = null;
let currentUid: string | null = null;

const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => invoices;

export const useInvoices = () => useSyncExternalStore(subscribe, getSnapshot);

export function attachInvoicesListener(uid: string | null) {
  unsub?.();
  currentUid = uid;
  if (!uid) { invoices = []; notify(); return; }
  const q = query(
    collection(db, 'users', uid, 'invoices'),
    orderBy('createdAt', 'desc'),
  );
  unsub = onSnapshot(q, (snap) => {
    invoices = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
    notify();
  });
}

function requireUid(): string {
  if (!currentUid) throw new Error('Not signed in');
  return currentUid;
}

export async function addInvoice(input: NewInvoiceInput) {
  const uid = requireUid();
  await addDoc(collection(db, 'users', uid, 'invoices'), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    localCreatedAt: Date.now(),
  });
}

export async function updateInvoice(id: string, patch: Partial<Invoice>) {
  const uid = requireUid();
  await updateDoc(doc(db, 'users', uid, 'invoices', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(id: string) {
  const uid = requireUid();
  await deleteDoc(doc(db, 'users', uid, 'invoices', id));
}
```

**Optimistic updates**: Firestore SDK with offline persistence reflects local writes immediately in `onSnapshot` (with `metadata.hasPendingWrites: true`). No extra optimistic-update code needed.

**Auth wiring** (`AuthProvider`):

```ts
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u);
    setInitializing(false);
    attachInvoicesListener(u?.uid ?? null);
    attachClientsListener(u?.uid ?? null);
    attachProfileListener(u?.uid ?? null);
    if (u && isFirstSignIn(u)) {
      ensureProfileDoc(u.uid);  // creates users/{uid} with defaultCurrency: 'USD' if missing
    }
  });
  return unsub;
}, []);
```

**Helpers preserved unchanged**: `nextInvoiceNumber`, `daysUntilDue`, `isOverdue`, `formatDateShort/Long`, `formatDueStatus` — all read from `invoices` array which still works the same.

---

## 5. Auth Flow

### `useAuth()` shape

```ts
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
```

### App.tsx gating

```tsx
const { user, initializing } = useAuth();
if (initializing || !splashDone) return <SplashScreen />;
if (!user) return <NavigationContainer><AuthStack /></NavigationContainer>;
return <NavigationContainer><AppStack /></NavigationContainer>;
```

### SignInScreen UX

- Segmented control top: **Sign In** | **Sign Up** | **Reset Password**
- Email + Password fields (Sign In, Sign Up)
- Email field only (Reset)
- "Continue with Google" button — all platforms
- "Continue with Apple" button — iOS only (Apple guidelines: don't show on Android/web)
- Loading state on button press, error toast on failure
- Visual style matches existing dark theme

### Provider implementations

| Method | Implementation |
|--------|----------------|
| Email/Password | Firebase JS SDK: `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendPasswordResetEmail` |
| Google | `@react-native-google-signin/google-signin` → `signIn()` → get `idToken` → `GoogleAuthProvider.credential(idToken)` → `signInWithCredential(auth, cred)` |
| Apple | `expo-apple-authentication` → `signInAsync({ requestedScopes: [...], nonce: hashedNonce })` → `OAuthProvider('apple.com').credential({ idToken, rawNonce })` → `signInWithCredential` |

### Persistence

- iOS/Android: `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`
- Web: default `browserLocalPersistence`

### Error handling

Map Firebase error codes to i18n keys:

| Firebase code | i18n key |
|---------------|----------|
| `auth/invalid-credential` | `auth.error.invalidCredential` |
| `auth/email-already-in-use` | `auth.error.emailInUse` |
| `auth/weak-password` | `auth.error.weakPassword` |
| `auth/user-not-found` | `auth.error.userNotFound` |
| `auth/network-request-failed` | `auth.error.network` |
| (default) | `auth.error.generic` |

### SettingsScreen

- "Sign out" row showing signed-in email
- Confirm dialog before sign-out
- Default currency picker (writes to `users/{uid}.defaultCurrency`)

---

## 6. Setup, Deps, Config

### Firebase project setup

1. Create new project `pawl-prod` (via Firebase MCP `firebase_create_project`)
2. Enable **Authentication**: Email/Password, Google, Apple
3. Enable **Firestore Database** (production mode)
4. Register apps:
   - **iOS**: bundle id (from `app.json` / `app.config.ts`)
   - **Android**: package name + SHA-1 (from `eas credentials` or local keystore)
   - **Web**: any nickname
5. Configure Apple sign-in:
   - Apple Developer console: enable "Sign In with Apple" capability for the iOS app id
   - Native iOS uses `expo-apple-authentication` directly (no Firebase Service ID needed for native flow)
6. Configure Google sign-in:
   - Generate iOS, Android (SHA-1), Web OAuth client IDs in Google Cloud Console (auto-created when enabling Google in Firebase Auth)
   - Pass client IDs to `GoogleSignin.configure({ webClientId, iosClientId, ... })`
7. Deploy `firestore.rules`

### Dependencies to install

```bash
npx expo install firebase \
  @react-native-async-storage/async-storage \
  @react-native-google-signin/google-signin \
  expo-apple-authentication \
  expo-dev-client \
  expo-crypto
```

- `firebase` — JS SDK (works in RN with AsyncStorage adapter)
- `@react-native-async-storage/async-storage` — required by Firebase Auth RN persistence
- `@react-native-google-signin/google-signin` — Google native SDK
- `expo-apple-authentication` — Apple sign-in
- `expo-dev-client` — required for native modules (Google sign-in won't work in Expo Go)
- `expo-crypto` — for hashing the nonce in Apple sign-in flow

### Dev client build (local, not EAS)

```bash
npx expo prebuild              # generates ios/ + android/ folders
npx expo run:ios               # local Xcode build → simulator
npx expo run:android           # local Android Studio build → emulator
```

After first build, `npm start` Metro talks to the dev client.

### app.config.ts (replaces app.json)

```ts
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'PAWL',
  slug: 'pawl',
  // ... existing fields from app.json
  ios: {
    bundleIdentifier: 'com.pawl.app',
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.pawl.app',
  },
  plugins: [
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME },
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

### .env.local (gitignored)

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=...
```

### New i18n keys (en.ts — source of truth)

```
auth.signIn: "Sign In"
auth.signUp: "Sign Up"
auth.resetPassword: "Reset Password"
auth.email: "Email"
auth.password: "Password"
auth.continueWithGoogle: "Continue with Google"
auth.continueWithApple: "Continue with Apple"
auth.signOut: "Sign out"
auth.signOutConfirm: "Sign out of PAWL?"
auth.resetEmailSent: "Password reset email sent"
auth.error.invalidCredential: "Invalid email or password"
auth.error.emailInUse: "Email already registered"
auth.error.weakPassword: "Password too weak (min 6 characters)"
auth.error.userNotFound: "No account found for this email"
auth.error.network: "Network error — check connection"
auth.error.generic: "Something went wrong. Try again."
settings.defaultCurrency: "Default currency"
settings.signedInAs: "Signed in as"
common.cancel: "Cancel"
common.confirm: "Confirm"
common.retry: "Retry"
```

Mirror in `es.ts`.

---

## 7. Risks & Mitigations

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Google sign-in requires native module → won't work in Expo Go | Build dev client locally (`expo run:ios/android`). Documented in §6. |
| 2 | `serverTimestamp()` is `null` locally until sync → ordering glitch | Write `localCreatedAt: Date.now()` in parallel; UI sorts by `createdAt ?? localCreatedAt`. |
| 3 | Firestore offline persistence on web uses IndexedDB (flaky in private browsing) | Acceptable; web is secondary platform. |
| 4 | Async store API breaks fire-and-forget callers | TypeScript will catch via Promise return type. Audit all call sites during implementation. |
| 5 | Bundle size from `firebase` web SDK (~200KB gzip) | Acceptable for V1. Defer modular tree-shaking. |
| 6 | Two devices offline create invoices with same `nextInvoiceNumber()` | Last-write-wins; user can manually edit number. Acceptable for V1. Cloud Function for atomic increment is future work. |
| 7 | Apple sign-in needs paid Apple Developer ($99/yr) | User confirmed enrolled. |
| 8 | Existing data in `__DEV__` seed arrays will be lost on swap | User chose option A (drop seeds). Empty start is desired. |

---

## 8. Implementation Order (high level — detailed plan in writing-plans output)

1. Firebase project create + Firestore enable + auth providers enable + rules deploy
2. Install deps + `expo prebuild` + verify dev client builds on iOS sim and Android emu
3. `app.config.ts` + `.env.local` + `src/lib/firebase.ts`
4. `src/lib/auth.tsx` (AuthProvider, useAuth) + email/password methods first
5. `src/screens/SignInScreen.tsx` (email-only initially)
6. App.tsx gating + verify sign-up/in/out works on simulator
7. Migrate `src/data/invoices.ts` to Firestore (preserve API)
8. Migrate `src/data/clients.ts` (id-based join)
9. New `src/data/profile.ts` for `users/{uid}` + currency
10. Audit/fix all screens for async CRUD + new types (`clientName` etc.)
11. Add Google sign-in
12. Add Apple sign-in
13. Settings: sign-out + currency picker
14. i18n keys (en + es)
15. Manual end-to-end verification per success criteria §1

---

## 9. Out of Scope (separate specs)

- EAS Cloud build & TestFlight (`docs/superpowers/specs/<future>-eas-build-design.md`)
- NFC / Tap-to-Pay payment processing (Stripe Terminal SDK, Apple Tap-to-Pay entitlement)
- Test runner setup (Jest + RTL + first coverage)
- Cloud Functions (atomic invoice number, email reminders, PDF generation)
- Org/team support
- Push notifications, analytics, crash reporting
