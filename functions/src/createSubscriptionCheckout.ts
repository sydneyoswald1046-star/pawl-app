import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient';
import { priceForPlan } from './subscriptionConfig';

type Plan = 'monthly' | 'yearly';

const SUCCESS_URL = 'https://us-central1-payly-app-prod.cloudfunctions.net/stripeConnectReturn/return';
const CANCEL_URL = 'https://us-central1-payly-app-prod.cloudfunctions.net/stripeConnectReturn/refresh';

/**
 * Creates a Stripe Checkout Session for a PAWL Pro subscription.
 * Lives on the platform Stripe account (NOT a connected account).
 * The session uses subscription mode with a 7-day free trial.
 *
 * If the user has no `stripeCustomerId` on their profile yet, creates
 * one with their email so future webhook events match back.
 */
export const createSubscriptionCheckout = onCall(
  {
    secrets: [STRIPE_SECRET_KEY],
    region: 'us-central1',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

    const plan = (req.data?.plan ?? 'monthly') as Plan;
    if (plan !== 'monthly' && plan !== 'yearly') {
      throw new HttpsError('invalid-argument', 'Invalid plan');
    }
    const priceId = priceForPlan(plan);
    if (priceId.startsWith('price_REPLACE_ME')) {
      throw new HttpsError('failed-precondition', 'Subscription prices not configured yet');
    }

    const stripe = getStripe();
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const profile = userSnap.data() ?? {};
    let customerId = profile.stripeCustomerId as string | undefined;

    if (!customerId) {
      const email = req.auth?.token.email ?? undefined;
      const customer = await stripe.customers.create({
        email,
        metadata: { payly_uid: uid },
      });
      customerId = customer.id;
      await userRef.set(
        {
          stripeCustomerId: customerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      logger.info('Created Stripe Customer for subscription', { uid, customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { payly_uid: uid },
      },
      metadata: { payly_uid: uid },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
    });

    if (!session.url) throw new HttpsError('internal', 'Stripe returned no checkout URL');
    return { url: session.url, sessionId: session.id };
  },
);
