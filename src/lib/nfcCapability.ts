import { Platform } from 'react-native';
import * as Device from 'expo-device';

export type NfcCapability =
  | 'builtin' // Tap to Pay on iPhone — no extra hardware
  | 'external' // user can pair a Bluetooth reader (Stripe M2, BBPOS, S700)
  | 'unsupported'; // neither path available

// Tap to Pay on iPhone ships on iPhone XS (iPhone11,*) and newer running
// iOS 16.4+. Below that line the phone can't read NFC for payments directly
// — user pairs an external MFi/Bluetooth reader (Stripe M2, BBPOS, S700).
//
// Stripe Terminal SDK has its own isSupported() check we also run at runtime,
// but this pre-check drives the UX while the SDK is initializing.
export function detectNfcCapability(): NfcCapability {
  if (!Device.isDevice) {
    return __DEV__ ? 'builtin' : 'unsupported';
  }

  if (Platform.OS === 'ios') {
    const model = Device.modelId ?? '';
    const osMajor = parseInt((Device.osVersion ?? '0').split('.')[0], 10);
    const osMinor = parseInt((Device.osVersion ?? '0').split('.')[1] ?? '0', 10);

    // iPad — no built-in TTP on iPad. External reader only.
    if (/^iPad/.test(model)) return 'external';

    const match = model.match(/^iPhone(\d+),/);
    if (!match) return 'external';
    const major = parseInt(match[1], 10);

    const osOk = osMajor > 16 || (osMajor === 16 && osMinor >= 4);
    const modelOk = major >= 11; // iPhone XS = iPhone11,2

    return modelOk && osOk ? 'builtin' : 'external';
  }

  if (Platform.OS === 'android') {
    return 'external';
  }

  return 'unsupported';
}

// Countries where Stripe Tap to Pay on iPhone is generally available. Outside
// this list the SDK rejects the request even on a supported iPhone, so we
// degrade to the 'external' path.
// Ref: stripe.com/docs/terminal/payments/setup-reader/tap-to-pay
export const TTP_SUPPORTED_COUNTRIES = new Set([
  'US', 'CA', 'GB', 'AU', 'FR', 'NL', 'IE', 'AT', 'BE', 'CH', 'CZ', 'DK',
  'FI', 'DE', 'IT', 'NO', 'PT', 'ES', 'SE', 'NZ', 'BR',
]);
