import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient';

type InvoiceDoc = {
  number?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  amount?: number;
  currency?: string;
  status?: string;
  service?: string;
  dueDate?: string;
};

export const createInvoicePaymentLink = onDocumentCreated(
  {
    document: 'users/{uid}/invoices/{invoiceId}',
    secrets: [STRIPE_SECRET_KEY],
    region: 'us-central1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const invoice = snap.data() as InvoiceDoc;
    const { uid, invoiceId } = event.params;

    if (!invoice.amount || invoice.amount <= 0) {
      logger.info('Skipping payment link: no positive amount', { uid, invoiceId });
      return;
    }
    if (invoice.status === 'paid') {
      logger.info('Skipping payment link: already paid', { uid, invoiceId });
      return;
    }

    // Look up the user's Connect account. Without one we can't create a link
    // because all charges must flow into the user's Stripe, never the platform.
    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    const profile = userSnap.data() ?? {};
    const stripeAccountId = profile.stripeAccountId as string | undefined;
    const stripeAccountStatus = profile.stripeAccountStatus as string | undefined;

    if (!stripeAccountId) {
      logger.info('Skipping payment link: user has no Connect account', { uid, invoiceId });
      await snap.ref.update({
        paymentLinkPending: 'connect_required',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }
    if (stripeAccountStatus !== 'active') {
      logger.info('Skipping payment link: Connect account not active yet', {
        uid, invoiceId, stripeAccountStatus,
      });
      await snap.ref.update({
        paymentLinkPending: 'connect_pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const stripe = getStripe();
    const currency = (invoice.currency || 'USD').toLowerCase();
    const amountMinorUnits = zeroDecimal(currency)
      ? Math.round(invoice.amount)
      : Math.round(invoice.amount * 100);

    try {
      const product = await stripe.products.create(
        {
          name: `Invoice ${invoice.number ?? invoiceId}`,
          description: invoice.service || `Invoice for ${invoice.clientName ?? 'client'}`,
          metadata: {
            payly_uid: uid,
            payly_invoice_id: invoiceId,
          },
        },
        { stripeAccount: stripeAccountId },
      );

      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: amountMinorUnits,
          currency,
        },
        { stripeAccount: stripeAccountId },
      );

      const paymentLink = await stripe.paymentLinks.create(
        {
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: {
            payly_uid: uid,
            payly_invoice_id: invoiceId,
          },
          after_completion: {
            type: 'hosted_confirmation',
            hosted_confirmation: {
              custom_message: `Thanks! Your payment for invoice ${invoice.number ?? ''} was received.`,
            },
          },
        },
        { stripeAccount: stripeAccountId },
      );

      await snap.ref.update({
        paymentLinkUrl: paymentLink.url,
        stripeProductId: product.id,
        stripePriceId: price.id,
        stripePaymentLinkId: paymentLink.id,
        paymentLinkPending: admin.firestore.FieldValue.delete(),
        paymentLinkError: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info('Created payment link on Connect account', {
        uid, invoiceId, accountId: stripeAccountId, url: paymentLink.url,
      });
    } catch (err) {
      logger.error('Failed to create payment link', { uid, invoiceId, err });
      await snap.ref.update({
        paymentLinkError: (err as Error).message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);

function zeroDecimal(currency: string): boolean {
  return ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'].includes(currency);
}
