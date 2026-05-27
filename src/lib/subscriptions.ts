import { Linking, Platform } from 'react-native';

/**
 * App Store / Play Store subscriptions are managed in OS settings, not on
 * Stripe. The RevenueCat migration replaced the Stripe Customer Portal —
 * billing changes (cancel, upgrade, refund) now flow through Apple / Google.
 *
 * iOS: https://apps.apple.com/account/subscriptions opens the Manage
 * Subscriptions sheet inside the App Store app.
 * Android: corresponding Play Store deep link.
 */
export async function openBillingPortal(): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  await Linking.openURL(url);
}
