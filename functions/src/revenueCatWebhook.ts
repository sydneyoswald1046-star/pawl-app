import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

export const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');

/**
 * RevenueCat webhook. Mirrors the subscription state RC tracks against
 * Apple/Google into the user's Firestore profile so the rest of the app
 * (entitlements, paywall gating, dashboard) can keep reading
 * profile.subscription as before.
 *
 * RevenueCat doesn't sign payloads — it uses a shared Authorization header.
 * Set the header in the RC Dashboard → Project → Integrations → Webhooks →
 * "Authorization header value" and stash the same string as the Firebase
 * secret REVENUECAT_WEBHOOK_AUTH.
 */
export const revenueCatWebhook = onRequest(
  {
    secrets: [REVENUECAT_WEBHOOK_AUTH],
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const auth = req.get('authorization') ?? '';
    if (auth !== REVENUECAT_WEBHOOK_AUTH.value()) {
      logger.warn('RevenueCat webhook auth failed');
      res.status(401).send('Unauthorized');
      return;
    }

    const event = req.body?.event as RcEvent | undefined;
    if (!event) {
      res.status(400).send('Missing event');
      return;
    }

    const uid = event.app_user_id;
    if (!uid) {
      logger.warn('RC event has no app_user_id', { type: event.type });
      res.status(200).send('ok'); // ack so RC doesn't retry forever
      return;
    }

    try {
      await syncEvent(uid, event);
      res.status(200).send('ok');
    } catch (err) {
      logger.error('RC webhook handler error', { type: event.type, uid, err });
      res.status(500).send('handler error');
    }
  },
);

async function syncEvent(uid: string, event: RcEvent) {
  const ref = admin.firestore().doc(`users/${uid}`);
  const status = mapEventToStatus(event);
  const plan = mapProductToPlan(event.product_id);

  // EXPIRATION + CANCELLATION simply update status. INITIAL_PURCHASE and
  // RENEWAL replace the whole subscription block.
  if (status === 'canceled' || status === 'expired') {
    await ref.set(
      {
        subscription: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    logger.info('RC: cleared subscription', { uid, type: event.type });
    return;
  }

  const subscription = {
    status,
    plan,
    customerId: event.app_user_id, // RC uses the same identifier we passed
    subscriptionId: event.original_transaction_id ?? event.transaction_id ?? '',
    currentPeriodEnd: event.expiration_at_ms
      ? Math.floor(event.expiration_at_ms / 1000)
      : 0,
    trialEnd: event.is_trial_conversion ? null : undefined,
    cancelAtPeriodEnd: event.cancel_reason != null,
    source: 'revenuecat' as const,
  };

  await ref.set(
    {
      subscription,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  logger.info('RC: synced subscription', { uid, status, plan, type: event.type });
}

function mapEventToStatus(event: RcEvent): 'trialing' | 'active' | 'canceled' | 'expired' | 'past_due' {
  switch (event.type) {
    case 'INITIAL_PURCHASE':
      return event.period_type === 'TRIAL' ? 'trialing' : 'active';
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
      return 'active';
    case 'CANCELLATION':
      // RC fires CANCELLATION when the user disables auto-renew BUT the sub
      // remains active until expiration_at. Keep it active and let the next
      // EXPIRATION event clear it.
      return 'active';
    case 'EXPIRATION':
      return 'expired';
    case 'BILLING_ISSUE':
      return 'past_due';
    default:
      return 'active';
  }
}

function mapProductToPlan(productId: string | undefined): 'monthly' | 'yearly' | undefined {
  if (!productId) return undefined;
  if (/(yearly|annual|year)/i.test(productId)) return 'yearly';
  if (/(monthly|month)/i.test(productId)) return 'monthly';
  return undefined;
}

// Minimal subset of the RC webhook event shape we actually use. RC v2 payload
// — they ship many more fields, all optional from our consumer's perspective.
type RcEvent = {
  type:
    | 'INITIAL_PURCHASE'
    | 'RENEWAL'
    | 'PRODUCT_CHANGE'
    | 'CANCELLATION'
    | 'UNCANCELLATION'
    | 'EXPIRATION'
    | 'BILLING_ISSUE'
    | 'NON_RENEWING_PURCHASE'
    | 'SUBSCRIPTION_PAUSED'
    | 'TRANSFER';
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  period_type?: 'NORMAL' | 'TRIAL' | 'INTRO';
  cancel_reason?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  is_trial_conversion?: boolean;
  transaction_id?: string;
  original_transaction_id?: string;
  store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'AMAZON' | 'PROMOTIONAL';
};
