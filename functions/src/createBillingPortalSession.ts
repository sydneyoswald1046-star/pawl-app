import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient';

const RETURN_URL = 'https://us-central1-payly-app-prod.cloudfunctions.net/stripeConnectReturn/return';

/**
 * Returns a Stripe Customer Portal URL where the user can update their
 * payment method, cancel, switch plans, view invoices, etc. The portal
 * is configured in Stripe Dashboard → Settings → Customer Portal.
 */
export const createBillingPortalSession = onCall(
  {
    secrets: [STRIPE_SECRET_KEY],
    region: 'us-central1',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    const customerId = userSnap.data()?.stripeCustomerId as string | undefined;
    if (!customerId) {
      throw new HttpsError('failed-precondition', 'No Stripe customer on file');
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: RETURN_URL,
    });
    return { url: session.url };
  },
);
