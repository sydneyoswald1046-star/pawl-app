import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Payly',
  slug: 'payly',
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
    bundleIdentifier: 'app.payly.botchtech',
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      // Stripe Terminal SDK + Tap to Pay on iPhone requirements.
      NSLocationWhenInUseUsageDescription:
        'Payly uses location to comply with card-network rules when accepting in-person card payments.',
      NSBluetoothAlwaysUsageDescription:
        'Payly connects to Bluetooth card readers (Stripe Reader M2, BBPOS, etc.) to accept in-person payments.',
      NSBluetoothPeripheralUsageDescription:
        'Payly connects to Bluetooth card readers to accept in-person payments.',
      NSMicrophoneUsageDescription:
        'Payly uses the microphone for legacy audio-jack card readers.',
      UIBackgroundModes: ['bluetooth-central'],
    },
    entitlements: {
      // Tap to Pay on iPhone — request via Apple Developer Portal, attach to
      // app's provisioning profile. App fails to launch on TTP API call until
      // entitlement is approved (~1-3 business days from Apple).
      'com.apple.developer.proximity-reader.payment.acceptance': true,
    },
  },
  android: {
    package: 'app.payly.botchtech',
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
