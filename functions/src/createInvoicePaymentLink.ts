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
      logger.info('Skipping payment link: invoice has no positive amount', { uid, invoiceId });
      return;
    }
    if (invoice.status === 'paid') {
      logger.info('Skipping payment link: invoice already paid', { uid, invoiceId });
      return;
    }

    const stripe = getStripe();
    const currency = (invoice.currency || 'USD').toLowerCase();
    const amountMinorUnits = zeroDecimal(currency)
      ? Math.round(invoice.amount)
      : Math.round(invoice.amount * 100);

    try {
      const product = await stripe.products.create({
        name: `Invoice ${invoice.number ?? invoiceId}`,
        description: invoice.service || `Invoice for ${invoice.clientName ?? 'client'}`,
        metadata: {
          payly_uid: uid,
          payly_invoice_id: invoiceId,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amountMinorUnits,
        currency,
      });

      const paymentLink = await stripe.paymentLinks.create({
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
      });

      await snap.ref.update({
        paymentLinkUrl: paymentLink.url,
        stripeProductId: product.id,
        stripePriceId: price.id,
        stripePaymentLinkId: paymentLink.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info('Created payment link', { uid, invoiceId, url: paymentLink.url });
    } catch (err) {
      logger.error('Failed to create payment link', { uid, invoiceId, err });
      // Surface the error on the doc so the app can show a hint
      await snap.ref.update({
        paymentLinkError: (err as Error).message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);

// Currencies Stripe treats as zero-decimal (the amount is already in the
// smallest unit of the currency). Add as needed.
function zeroDecimal(currency: string): boolean {
  return ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'].includes(currency);
}
