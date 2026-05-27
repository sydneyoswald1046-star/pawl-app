import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';

/**
 * RevenueCat client wrapper.
 *
 * RevenueCat handles subscription purchase + restore + receipt validation
 * against the App Store / Play Store. We treat it as the source of truth for
 * "is this user Pro right now" and mirror the resulting state into Firestore
 * via the revenueCatWebhook Cloud Function so server-side code (e.g.
 * createInvoicePaymentLink entitlement checks) can keep reading
 * profile.subscription.
 *
 * Public API keys are safe in the client bundle.
 */

export const PRO_ENTITLEMENT_ID = 'pro';

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

let configured = false;
let configuredUid: string | null = null;

export function isConfigured(): boolean {
  return configured;
}

/**
 * Initialize the RC SDK with the platform-specific public API key. Call this
 * once on app launch (Anonymous mode) and again with the Firebase UID after
 * sign-in so RC links purchases to the user identity.
 */
export async function configureRevenueCat(uid: string | null): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) {
    // Defer silently — the paywall checks isConfigured() before letting the
    // user attempt a purchase. Keeps dev builds without the key from crashing.
    return;
  }

  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey, appUserID: uid ?? undefined });
    configured = true;
    configuredUid = uid;
    return;
  }

  // Already configured. Switch identity if the user changed.
  if (configuredUid !== uid) {
    if (uid) {
      await Purchases.logIn(uid);
    } else {
      await Purchases.logOut();
    }
    configuredUid = uid;
  }
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  return Purchases.getCustomerInfo();
}

export function isProFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
}
