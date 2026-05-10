import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient';

/**
 * Creates a Stripe Connect Express account for the calling user (or reuses
 * the existing one) and returns an onboarding URL the app should open in
 * a browser. After the user finishes Stripe's hosted form, Stripe redirects
 * to `returnUrl`; if the link expires or the user backs out, Stripe sends
 * them to `refreshUrl`.
 */
export const createConnectAccountLink = onCall(
  {
    secrets: [STRIPE_SECRET_KEY],
    region: 'us-central1',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

    const stripe = getStripe();
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const profile = userSnap.data() ?? {};

    let accountId = profile.stripeAccountId as string | undefined;

    if (!accountId) {
      // Create a fresh Express account. We let Stripe collect capabilities
      // automatically based on the requested set.
      const account = await stripe.accounts.create({
        type: 'express',
        email: req.auth?.token.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          payly_uid: uid,
        },
      });
      accountId = account.id;
      await userRef.set(
        {
          stripeAccountId: accountId,
          stripeAccountStatus: 'pending',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      logger.info('Created Connect Express account', { uid, accountId });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: 'https://us-central1-payly-app-prod.cloudfunctions.net/stripeConnectReturn/refresh',
      return_url: 'https://us-central1-payly-app-prod.cloudfunctions.net/stripeConnectReturn/return',
    });

    return { url: link.url, accountId };
  },
);
