/**
 * Stripe Price IDs for Payly Pro on the platform Stripe account.
 *
 * Replace these test IDs with live IDs when switching to production.
 * To rotate prices without redeploying, move these into Firestore config
 * (e.g. doc /config/subscription) and read at function invocation time.
 */
export const PRICE_IDS = {
  // TODO: replace with actual price IDs from Stripe Dashboard
  monthly: 'price_REPLACE_ME_MONTHLY',
  yearly: 'price_REPLACE_ME_YEARLY',
};

export function priceForPlan(plan: 'monthly' | 'yearly'): string {
  return PRICE_IDS[plan];
}

export function planForPrice(priceId: string): 'monthly' | 'yearly' | null {
  if (priceId === PRICE_IDS.monthly) return 'monthly';
  if (priceId === PRICE_IDS.yearly) return 'yearly';
  return null;
}
