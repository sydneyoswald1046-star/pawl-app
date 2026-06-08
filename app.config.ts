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
    bundleIdentifier: 'app.pawl.botchtech',
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      // PAWL only uses standard HTTPS/TLS — exempt from export compliance.
      // Declaring this skips the per-build encryption question in App Store Connect.
      ITSAppUsesNonExemptEncryption: false,
      // Stripe Terminal SDK + Tap to Pay on iPhone requirements.
      NSLocationWhenInUseUsageDescription:
        'PAWL uses location to comply with card-network rules when accepting in-person card payments.',
      NSBluetoothAlwaysUsageDescription:
        'PAWL connects to Bluetooth card readers (Stripe Reader M2, BBPOS, etc.) to accept in-person payments.',
      NSBluetoothPeripheralUsageDescription:
        'PAWL connects to Bluetooth card readers to accept in-person payments.',
      NSMicrophoneUsageDescription:
        'PAWL uses the microphone for legacy audio-jack card readers.',
    },
    // Tap to Pay on iPhone entitlement is REQUESTED separately from Apple
    // (developer.apple.com/contact/request/tap-to-pay-on-iphone/). Once Apple
    // approves and attaches it to your provisioning profile, uncomment the
    // block below and re-run `npx expo prebuild --clean`. External Bluetooth
    // reader payments work without this entitlement.
    //
    // entitlements: {
    //   'com.apple.developer.proximity-reader.payment.acceptance': true,
    // },
  },
  android: {
    package: 'app.pawl.botchtech',
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
    'expo-mail-composer',
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
