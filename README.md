# PAWL — Professional Invoicing for Freelancers & Small Businesses

A full-featured invoicing app built with **Expo (SDK 54)**, **React Native 0.81**, and **TypeScript (strict)**. Create invoices, accept card payments, send reminders, and manage clients — all from your phone.

Currently live on the **App Store** for iOS.

---

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Earnings chart, outstanding balance, overdue alerts, and recent activity at a glance |
| **Invoicing** | Create, send, and track professional invoices with auto-generated invoice numbers |
| **Clients** | Full client management with per-client history, lifetime revenue, and work gallery |
| **Tap to Pay** | Accept in-person card payments via Tap to Pay on iPhone or paired Bluetooth reader (Stripe Terminal) |
| **Online Payments** | Every invoice includes a secure Stripe payment link — card, Apple Pay, or bank transfer |
| **Reminders** | Send payment reminders to individual clients or nudge everyone at once |
| **Reports** | Revenue breakdown, invoice status, top clients, and quick stats by period |
| **PDF Export** | Generate branded PDF invoices with your business name and logo (Pro) |
| **Multi-currency** | Bill in USD, EUR, GBP, CAD, and more |
| **Dark/Light Mode** | Full theme support with a custom dark-first palette |
| **i18n** | English and Spanish with locale detection via `expo-localization` |
| **Onboarding** | 5-slide walkthrough for new users |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Expo SDK 54, React Native 0.81, React 19, New Architecture |
| **Language** | TypeScript (strict mode) |
| **Navigation** | React Navigation — native stack + bottom tabs with a custom SVG tab bar |
| **Auth** | Firebase Auth (Email/Password, Google Sign-In, Apple Sign-In) |
| **Database** | Cloud Firestore with real-time `onSnapshot` listeners |
| **Backend** | Firebase Cloud Functions (webhook handlers, payment link creation) |
| **Payments** | Stripe Connect (online), Stripe Terminal (in-person), RevenueCat (subscriptions/IAP) |
| **Animations** | Reanimated 4 + React Native Worklets |
| **Icons** | Lucide React Native |
| **Hosting** | Firebase Hosting (privacy policy, terms, landing page) |
| **Build/Deploy** | EAS Build + EAS Submit |

---

## Architecture

```
src/
├── components/        # Shared UI: TabBarBackground, LifeLine, PulseGlow
├── data/              # Stores: invoices, clients, profile (useSyncExternalStore)
├── i18n/              # Flat-key dictionaries (en.ts, es.ts) + TranslationKey type
├── lib/               # Utilities: revenuecat, entitlements, nfcCapability, firebase
├── screens/           # 17 screens — flat, one file per screen
├── theme.tsx          # ThemeProvider with dark/light palette + useTheme()
└── App.tsx            # SafeAreaProvider → I18nProvider → ThemeProvider → Navigator
```

**State management** uses a lightweight custom store pattern — module-level mutable arrays with `Set<Listener>` and `useSyncExternalStore` for React subscriptions. No Redux, no Zustand, no Context for data.

**Navigation** is two layers: an outer native stack (modals + detail screens) wrapping an inner bottom-tab navigator. The center "Create" tab is a fake tab that intercepts `tabPress` to open the New Invoice modal.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- iOS Simulator or physical device
- Firebase project (Firestore, Auth, Cloud Functions)
- Stripe account (Connect + Terminal)
- RevenueCat account (iOS/Android API keys)

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your keys
cp .env.example .env.local

# Start the dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Typecheck
npx tsc --noEmit
```

### Environment Variables

See `.env.example` for required keys:

- `EXPO_PUBLIC_FIREBASE_*` — Firebase project config
- `EXPO_PUBLIC_GOOGLE_*` — Google Sign-In client IDs
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` — RevenueCat public API key

---

## Screens

| Screen | Purpose |
|--------|---------|
| `DashboardScreen` | Home — earnings, outstanding, quick actions, recent invoices |
| `InvoicesScreen` | Filterable/searchable invoice list |
| `InvoiceDetailScreen` | Full invoice view with pay link, email, reminder actions |
| `NewInvoiceScreen` | Create invoice — client picker, line items, due date, notes |
| `ClientsScreen` | Client roster with lifetime stats |
| `ClientDetailScreen` | Per-client invoices, contact info, work gallery |
| `ClientFormScreen` | Add/edit client |
| `TapToReceiveScreen` | In-person card payments (Tap to Pay / Bluetooth reader) |
| `PaywallScreen` | PAWL Pro subscription with StoreKit trial integration |
| `RemindersScreen` | Batch or individual payment reminders |
| `ReportsScreen` | Revenue charts, invoice status, top clients |
| `SettingsScreen` | Profile, Stripe Connect, theme, language, subscription |
| `SignInScreen` | Email/password, Google, Apple authentication |
| `OnboardingScreen` | 5-slide new user walkthrough |
| `SplashScreen` | Animated launch screen |

---

## Subscription Model

**Free tier:** 5 invoices/month, 10 clients, core features.

**PAWL Pro:** Unlimited invoices and clients, branded PDFs, reminder automation, no watermark. Managed via RevenueCat + App Store IAP with a 7-day free trial.

Subscription state syncs from RevenueCat → Cloud Function webhook → Firestore → client via `onSnapshot`.

---

## Build & Deploy

```bash
# Production iOS build
npx eas-cli build --platform ios --profile production

# Submit to App Store
npx eas-cli submit --platform ios
```

---

## License

This project is source-available for portfolio purposes. All rights reserved.
