import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './stripeClient';
import { planForPrice } from './subscriptionConfig';

/**
 * Platform-level Stripe webhook. Handles:
 *   - Invoice payments (legacy from when payment links lived on platform)
 *   - Payly Pro subscriptions: customer.subscription.{created,updated,deleted},
 *     invoice.paid, invoice.payment_failed
 *
 * Per-user Connect events (payments from connected accounts) are handled
 * by the separate connectWebhook function.
 */
export const stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
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
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      logger.warn('Webhook signature failed', { err: (err as Error).message });
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as {
            id: string;
            mode?: string;
            payment_status?: string;
            metadata?: Record<string, string> | null;
          };
          // Subscription checkouts come in as mode='subscription'. The
          // customer.subscription.created event below handles the real state
          // change, so just log here.
          if (session.mode === 'subscription') {
            logger.info('Subscription checkout completed', { sessionId: session.id });
            break;
          }
          if (session.payment_status === 'paid') {
            await markInvoicePaidFromMetadata(session.metadata);
          }
          break;
        }
        case 'payment_intent.succeeded': {
          const intent = event.data.object as { metadata?: Record<string, string> | null };
          await markInvoicePaidFromMetadata(intent.metadata);
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          await syncSubscription(event.data.object);
          break;
        }
        case 'invoice.paid':
        case 'invoice.payment_failed': {
          // The subscription.updated event already covers the status change
          // when these fire. Log for traceability.
          logger.info('Subscription invoice event', { type: event.type });
          break;
        }
        default:
          break;
      }
      res.status(200).send('ok');
    } catch (err) {
      logger.error('Webhook handler error', { type: event.type, err });
      res.status(500).send('handler error');
    }
  },
);

async function markInvoicePaidFromMetadata(metadata: Record<string, string> | null | undefined) {
  const uid = metadata?.payly_uid;
  const invoiceId = metadata?.payly_invoice_id;
  if (!uid || !invoiceId) return;
  const ref = admin.firestore().doc(`users/${uid}/invoices/${invoiceId}`);
  await ref.update({
    status: 'paid',
    paidDate: new Date().toISOString().slice(0, 10),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  logger.info('Marked invoice paid', { uid, invoiceId });
}

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  trial_end?: number | null;
  items?: { data?: Array<{ price?: { id?: string } }> };
  metadata?: Record<string, string> | null;
};

async function syncSubscription(raw: unknown) {
  const sub = raw as StripeSubscription;
  let uid = sub.metadata?.payly_uid;

  if (!uid) {
    // Fall back to looking up by customer ID.
    const snap = await admin.firestore()
      .collection('users')
      .where('stripeCustomerId', '==', sub.customer)
      .limit(1)
      .get();
    uid = snap.empty ? undefined : snap.docs[0].id;
  }
  if (!uid) {
    logger.warn('Subscription event has no matching user', { customer: sub.customer });
    return;
  }

  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? planForPrice(priceId) : null;

  const subscription = {
    status: sub.status,
    plan,
    customerId: sub.customer,
    subscriptionId: sub.id,
    currentPeriodEnd: sub.current_period_end ?? 0,
    trialEnd: sub.trial_end ?? null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };

  await admin.firestore().doc(`users/${uid}`).set(
    {
      subscription,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  logger.info('Synced subscription', { uid, status: sub.status, plan });
}
