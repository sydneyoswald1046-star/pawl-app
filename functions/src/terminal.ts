import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient';

/**
 * Stripe Terminal flow for in-person payments via Tap to Pay on iPhone or a
 * paired Bluetooth reader (Stripe Reader M2 / BBPOS).
 *
 * Two callables:
 *   createConnectionToken — short-lived (~1 hour) auth credential the
 *     Terminal SDK uses to connect to a reader, scoped to the calling user's
 *     Stripe Connect Express account.
 *   createTerminalPaymentIntent — creates a PaymentIntent with capture method
 *     "manual" so the SDK can collect the card and then we capture, with
 *     metadata that lets the existing connectWebhook mark the invoice paid.
 */

type ConnectionTokenData = { secret: string };

export const createConnectionToken = onCall<
  { reader_location?: string } | undefined,
  Promise<ConnectionTokenData>
>(
  { secrets: [STRIPE_SECRET_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = request.auth.uid;
    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    const profile = userSnap.data() ?? {};
    const stripeAccountId = profile.stripeAccountId as string | undefined;
    if (!stripeAccountId || profile.stripeAccountStatus !== 'active') {
      throw new HttpsError(
        'failed-precondition',
        'Connect your Stripe account before taking in-person payments.',
      );
    }

    try {
      const stripe = getStripe();
      const token = await stripe.terminal.connectionTokens.create(
        // Scope the location only if the caller passed one; otherwise the
        // token is account-wide and any of the user's locations can use it.
        request.data?.reader_location
          ? { location: request.data.reader_location }
          : undefined,
        { stripeAccount: stripeAccountId },
      );
      return { secret: token.secret };
    } catch (err) {
      logger.error('Failed to create Terminal connection token', { uid, err });
      throw new HttpsError('internal', (err as Error).message);
    }
  },
);

type PaymentIntentInput = {
  invoiceId: string;
  amount: number; // major units, will be converted
  currency?: string;
};

type PaymentIntentData = {
  clientSecret: string;
  paymentIntentId: string;
};

export const createTerminalPaymentIntent = onCall<
  PaymentIntentInput,
  Promise<PaymentIntentData>
>(
  { secrets: [STRIPE_SECRET_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = request.auth.uid;
    const { invoiceId, amount, currency } = request.data;
    if (!invoiceId || !amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'invoiceId and positive amount required');
    }

    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    const profile = userSnap.data() ?? {};
    const stripeAccountId = profile.stripeAccountId as string | undefined;
    if (!stripeAccountId || profile.stripeAccountStatus !== 'active') {
      throw new HttpsError(
        'failed-precondition',
        'Connect your Stripe account before taking in-person payments.',
      );
    }

    const invoiceSnap = await admin
      .firestore()
      .doc(`users/${uid}/invoices/${invoiceId}`)
      .get();
    if (!invoiceSnap.exists) {
      throw new HttpsError('not-found', `Invoice ${invoiceId} not found`);
    }
    const invoice = invoiceSnap.data() ?? {};

    const cur = (currency || invoice.currency || 'USD').toLowerCase();
    const minor = zeroDecimal(cur) ? Math.round(amount) : Math.round(amount * 100);

    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create(
        {
          amount: minor,
          currency: cur,
          payment_method_types: ['card_present'],
          capture_method: 'automatic',
          metadata: {
            payly_uid: uid,
            payly_invoice_id: invoiceId,
            source: 'terminal',
          },
        },
        { stripeAccount: stripeAccountId },
      );
      logger.info('Terminal PaymentIntent created', {
        uid,
        invoiceId,
        intent: intent.id,
      });
      return {
        clientSecret: intent.client_secret ?? '',
        paymentIntentId: intent.id,
      };
    } catch (err) {
      logger.error('Failed to create Terminal PaymentIntent', { uid, invoiceId, err });
      throw new HttpsError('internal', (err as Error).message);
    }
  },
);

function zeroDecimal(currency: string): boolean {
  return [
    'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw',
    'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
  ].includes(currency);
}
