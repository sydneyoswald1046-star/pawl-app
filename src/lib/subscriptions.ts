import { httpsCallable } from 'firebase/functions';
import { Linking } from 'react-native';
import { functions } from './firebase';

type Plan = 'monthly' | 'yearly';

const checkout = httpsCallable<{ plan: Plan }, { url: string; sessionId: string }>(
  functions,
  'createSubscriptionCheckout',
);

const portal = httpsCallable<unknown, { url: string }>(functions, 'createBillingPortalSession');

export async function startSubscriptionCheckout(plan: Plan): Promise<void> {
  const { data } = await checkout({ plan });
  if (!data?.url) throw new Error('No checkout URL returned');
  await Linking.openURL(data.url);
}

export async function openBillingPortal(): Promise<void> {
  const { data } = await portal({});
  if (!data?.url) throw new Error('No portal URL returned');
  await Linking.openURL(data.url);
}
