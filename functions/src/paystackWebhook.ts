import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import {
  PAYSTACK_SECRET_KEY,
  PAYSTACK_WEBHOOK_SECRET,
} from './paystackClient';

/**
 * Paystack webhook. Marks invoices paid on `charge.success` using the
 * `payly_invoice_id` we stamped into the transaction metadata when the
 * payment link was created.
 *
 * Paystack signs payloads with HMAC SHA-512 of the request body, keyed with
 * the secret key. The signature lives in the `x-paystack-signature` header.
 */
export const paystackWebhook = onRequest(
  {
    secrets: [PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET],
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const signature = req.get('x-paystack-signature');
    if (!signature) {
      res.status(400).send('Missing x-paystack-signature');
      return;
    }

    // Paystack signs with the SECRET KEY (not a separate webhook secret),
    // but the dashboard exposes a settable "Webhook Secret Key" override.
    // Prefer the override when set; fall back to the secret key.
    const key =
      PAYSTACK_WEBHOOK_SECRET.value() || PAYSTACK_SECRET_KEY.value();
    const expected = crypto
      .createHmac('sha512', key)
      .update(req.rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      logger.warn('Paystack webhook signature mismatch');
      res.status(400).send('Bad signature');
      return;
    }

    const event = req.body as {
      event?: string;
      data?: {
        reference?: string;
        status?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
        metadata?: Record<string, unknown> | null;
      };
    };

    try {
      switch (event.event) {
        case 'charge.success':
          await handleChargeSuccess(event.data);
          break;
        case 'transfer.success':
        case 'transfer.failed':
        case 'transfer.reversed':
          // Payouts to user's bank — log for now, surface in app later if needed.
          logger.info('Paystack transfer event', { type: event.event });
          break;
        default:
          break;
      }
      res.status(200).send('ok');
    } catch (err) {
      logger.error('Paystack webhook handler error', { type: event.event, err });
      res.status(500).send('handler error');
    }
  },
);

async function handleChargeSuccess(
  data: {
    reference?: string;
    status?: string;
    paid_at?: string;
    metadata?: Record<string, unknown> | null;
  } | undefined,
) {
  if (!data || data.status !== 'success') return;
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const uid = metadata.payly_uid;
  const invoiceId = metadata.payly_invoice_id;
  if (!uid || !invoiceId) {
    logger.warn('Paystack charge.success missing metadata', {
      reference: data.reference,
    });
    return;
  }

  const ref = admin.firestore().doc(`users/${uid}/invoices/${invoiceId}`);
  const paidDate = data.paid_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  await ref.update({
    status: 'paid',
    paidDate,
    paystackReference: data.reference,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  logger.info('Marked invoice paid via Paystack', {
    uid,
    invoiceId,
    reference: data.reference,
  });
}
