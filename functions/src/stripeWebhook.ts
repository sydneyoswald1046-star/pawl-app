import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './stripeClient';

export const stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    region: 'us-central1',
    // Stripe needs the raw body to verify signatures.
    // onRequest in Functions v2 already provides req.rawBody.
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
    const secret = STRIPE_WEBHOOK_SECRET.value();
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
    } catch (err) {
      logger.warn('Webhook signature verification failed', { err: (err as Error).message });
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as {
            id: string;
            payment_status?: string;
            metadata?: Record<string, string> | null;
          };
          if (session.payment_status !== 'paid') break;
          await markPaidFromMetadata(session.metadata);
          break;
        }
        case 'payment_intent.succeeded': {
          const intent = event.data.object as {
            id: string;
            metadata?: Record<string, string> | null;
          };
          await markPaidFromMetadata(intent.metadata);
          break;
        }
        default:
          // No-op for events we don't care about.
          break;
      }
      res.status(200).send('ok');
    } catch (err) {
      logger.error('Failed to handle webhook', { type: event.type, err });
      res.status(500).send('handler error');
    }
  },
);

async function markPaidFromMetadata(metadata: Record<string, string> | null | undefined) {
  const uid = metadata?.payly_uid;
  const invoiceId = metadata?.payly_invoice_id;
  if (!uid || !invoiceId) {
    logger.warn('Webhook missing payly metadata', { metadata });
    return;
  }
  const ref = admin.firestore().doc(`users/${uid}/invoices/${invoiceId}`);
  await ref.update({
    status: 'paid',
    paidDate: new Date().toISOString().slice(0, 10),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  logger.info('Marked invoice paid via Stripe webhook', { uid, invoiceId });
}
