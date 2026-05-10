import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient';

const STRIPE_CONNECT_WEBHOOK_SECRET = defineSecret('STRIPE_CONNECT_WEBHOOK_SECRET');

/**
 * Webhook endpoint for events FROM connected accounts (configured in
 * Stripe Dashboard → Connect → Webhooks). Different signing secret
 * than the platform webhook.
 *
 * Handles:
 *   account.updated         — promote stripeAccountStatus to 'active'
 *                             when charges_enabled flips on.
 *   checkout.session.completed
 *   payment_intent.succeeded — mark the matching Payly invoice paid.
 */
export const connectWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_CONNECT_WEBHOOK_SECRET],
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      res.status(400).send('Missing stripe-signature header');
      return;
    }
    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_CONNECT_WEBHOOK_SECRET.value(),
      );
    } catch (err) {
      logger.warn('Connect webhook signature failed', { err: (err as Error).message });
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'account.updated': {
          const account = event.data.object as {
            id: string;
            charges_enabled?: boolean;
            details_submitted?: boolean;
            metadata?: Record<string, string> | null;
          };
          const uid = account.metadata?.payly_uid;
          if (!uid) {
            logger.warn('account.updated missing payly_uid metadata', { accountId: account.id });
            break;
          }
          const status = account.charges_enabled
            ? 'active'
            : account.details_submitted
              ? 'pending'
              : 'incomplete';
          await admin.firestore().doc(`users/${uid}`).set(
            {
              stripeAccountStatus: status,
              stripeChargesEnabled: !!account.charges_enabled,
              stripeDetailsSubmitted: !!account.details_submitted,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          logger.info('Updated Connect account status', { uid, status });
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object as {
            payment_status?: string;
            metadata?: Record<string, string> | null;
          };
          if (session.payment_status !== 'paid') break;
          await markInvoicePaid(session.metadata);
          break;
        }
        case 'payment_intent.succeeded': {
          const intent = event.data.object as {
            metadata?: Record<string, string> | null;
          };
          await markInvoicePaid(intent.metadata);
          break;
        }
        default:
          break;
      }
      res.status(200).send('ok');
    } catch (err) {
      logger.error('Connect webhook handler error', { type: event.type, err });
      res.status(500).send('handler error');
    }
  },
);

async function markInvoicePaid(metadata: Record<string, string> | null | undefined) {
  const uid = metadata?.payly_uid;
  const invoiceId = metadata?.payly_invoice_id;
  if (!uid || !invoiceId) {
    logger.warn('Connect webhook missing payly metadata', { metadata });
    return;
  }
  await admin.firestore().doc(`users/${uid}/invoices/${invoiceId}`).update({
    status: 'paid',
    paidDate: new Date().toISOString().slice(0, 10),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  logger.info('Marked invoice paid via Connect webhook', { uid, invoiceId });
}
