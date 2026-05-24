import { useSyncExternalStore } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  deleteField,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type StripeAccountStatus = 'pending' | 'incomplete' | 'active';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type SubscriptionPlan = 'monthly' | 'yearly';

export type SubscriptionState = {
  status: SubscriptionStatus;
  plan?: SubscriptionPlan;
  customerId: string;
  subscriptionId: string;
  currentPeriodEnd: number;
  trialEnd?: number;
  cancelAtPeriodEnd: boolean;
};

export type PaymentGateway = 'stripe' | 'paystack';

export type PaystackAccountStatus = 'pending' | 'inactive' | 'active';

export type PaystackCountry = 'ghana' | 'nigeria' | 'south africa' | 'kenya';

export type UserProfile = {
  defaultCurrency: string;
  businessName?: string;
  businessLogoUrl?: string;
  businessLogoPath?: string;
  paymentGateway?: PaymentGateway;
  stripeAccountId?: string;
  stripeAccountStatus?: StripeAccountStatus;
  stripeChargesEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  paystackSubaccountCode?: string;
  paystackAccountStatus?: PaystackAccountStatus;
  paystackBankCode?: string;
  paystackAccountLast4?: string;
  paystackBusinessName?: string;
  paystackCountry?: PaystackCountry;
  customPaymentLink?: string;
  notifyOnPaid?: boolean;
  notifyOnUpcoming?: boolean;
  notifyOnOverdue?: boolean;
  stripeCustomerId?: string;
  subscription?: SubscriptionState;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const DEFAULT_PROFILE: UserProfile = { defaultCurrency: 'USD' };

let profile: UserProfile = DEFAULT_PROFILE;
const listeners = new Set<() => void>();
let unsub: Unsubscribe | null = null;
let currentUid: string | null = null;

// Captures the gateway picker selection from the signup screen and carries it
// across the asynchronous auth round-trip. The pending choice is consumed (and
// cleared) the first time attachProfileListener sees the new user document —
// whether that doc has to be created (new user) or already exists (signing in
// on a different device with a stale pending choice).
let pendingGateway: PaymentGateway | null = null;
let pendingCountry: PaystackCountry | null = null;

export function setPendingGatewayChoice(
  gateway: PaymentGateway,
  country?: PaystackCountry,
): void {
  pendingGateway = gateway;
  pendingCountry = country ?? null;
}

export function clearPendingGatewayChoice(): void {
  pendingGateway = null;
  pendingCountry = null;
}

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
      // Existing profile — discard any stale gateway choice from this session.
      pendingGateway = null;
      pendingCountry = null;
    } else {
      profile = DEFAULT_PROFILE;
      const initial: Record<string, unknown> = {
        ...DEFAULT_PROFILE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (pendingGateway) initial.paymentGateway = pendingGateway;
      if (pendingCountry) initial.paystackCountry = pendingCountry;
      pendingGateway = null;
      pendingCountry = null;
      void setDoc(doc(db, 'users', uid), initial);
    }
    notify();
  });
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
  if (!currentUid) throw new Error('Cannot update profile: not signed in');
  // Translate explicit undefined into a Firestore field deletion so callers can
  // clear optional fields by passing { foo: undefined }.
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(patch)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await setDoc(doc(db, 'users', currentUid), payload, { merge: true });
}
