import { Platform } from 'react-native';
import * as Device from 'expo-device';

export type NfcCapability = 'builtin' | 'external' | 'unsupported';

// Tap to Pay on iPhone ships on iPhone XS (iPhone11,2) and newer, iOS 16.4+.
// iPads, older iPhones, and iPods can't do contactless payments on-device —
// they fall back to an external Bluetooth/MFi reader.
export function detectNfcCapability(): NfcCapability {
  if (!Device.isDevice) {
    return __DEV__ ? 'builtin' : 'unsupported';
  }

  if (Platform.OS === 'ios') {
    const model = Device.modelId ?? '';
    const osMajor = parseInt((Device.osVersion ?? '0').split('.')[0], 10);
    const osMinor = parseInt((Device.osVersion ?? '0').split('.')[1] ?? '0', 10);

    const match = model.match(/^iPhone(\d+),/);
    if (!match) return 'external';

    const major = parseInt(match[1], 10);
    const ttpSupported = major >= 11 && (osMajor > 16 || (osMajor === 16 && osMinor >= 4));
    return ttpSupported ? 'builtin' : 'external';
  }

  if (Platform.OS === 'android') {
    return 'external';
  }

  return 'unsupported';
}
