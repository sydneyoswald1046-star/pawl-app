import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import {
  PAYSTACK_SECRET_KEY,
  paystackRequest,
  toMinorUnits,
} from './paystackClient';

type InvoiceDoc = {
  number?: string;
  clientName?: string;
  clientEmail?: string;
  amount?: number;
  currency?: string;
  service?: string;
};

type UserProfile = {
  paystackSubaccountCode?: string;
  paystackAccountStatus?: string;
  email?: string;
};

type InitData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

const SUPPORTED_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'USD']);

/**
 * Create a Paystack payment link for an invoice, split to the user's
 * subaccount. Called by the gateway router in createInvoicePaymentLink when
 * the user's `paymentGateway === 'paystack'`.
 *
 * Returns nothing — writes results directly onto the invoice doc so it
 * matches the existing Stripe path.
 */
export async function paystackCreatePaymentLink(args: {
  uid: string;
  invoiceId: string;
  invoice: InvoiceDoc;
  profile: UserProfile;
  invoiceRef: FirebaseFirestore.DocumentReference;
}): Promise<void> {
  const { uid, invoiceId, invoice, profile, invoiceRef } = args;
  const currency = (invoice.currency || 'GHS').toUpperCase();

  if (!SUPPORTED_CURRENCIES.has(currency)) {
    await invoiceRef.update({
      paymentLinkError: `Paystack does not support ${currency}. Switch invoice currency to GHS, NGN, ZAR, KES, or USD.`,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  if (!profile.paystackSubaccountCode || profile.paystackAccountStatus !== 'active') {
    const reason = profile.paystackSubaccountCode
      ? 'paystack_pending'
      : 'paystack_required';
    await invoiceRef.update({
      paymentLinkPending: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info('Paystack subaccount not ready', { uid, invoiceId, reason });
    return;
  }

  // Customer email is required by Paystack to send the receipt and let them
  // resume an abandoned checkout. Fall back to a deterministic per-invoice
  // address if the invoice has none — Paystack will accept it; the receipt
  // just won't reach a real inbox. Better than rejecting the payment entirely.
  const customerEmail =
    invoice.clientEmail?.trim() ||
    `no-email-${invoiceId}@invoices.payly.app`;

  try {
    const init = await paystackRequest<InitData>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: customerEmail,
        amount: toMinorUnits(invoice.amount ?? 0),
        currency,
        subaccount: profile.paystackSubaccountCode,
        // bearer = subaccount means the user (not Payly) absorbs the
        // transaction fees. Switch to 'account' if Payly should eat them.
        bearer: 'subaccount',
        metadata: {
          payly_uid: uid,
          payly_invoice_id: invoiceId,
          invoice_number: invoice.number ?? '',
          client_name: invoice.clientName ?? '',
          custom_fields: [
            {
              display_name: 'Invoice',
              variable_name: 'invoice_number',
              value: invoice.number ?? invoiceId,
            },
          ],
        },
      }),
    });

    await invoiceRef.update({
      paymentLinkUrl: init.authorization_url,
      paymentLinkSource: 'paystack',
      paystackReference: init.reference,
      paystackAccessCode: init.access_code,
      paymentLinkPending: admin.firestore.FieldValue.delete(),
      paymentLinkError: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Created Paystack payment link', {
      uid,
      invoiceId,
      reference: init.reference,
    });
  } catch (err) {
    logger.error('Failed to create Paystack payment link', { uid, invoiceId, err });
    await invoiceRef.update({
      paymentLinkError: (err as Error).message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// Re-export the secret so callers (createInvoicePaymentLink) can attach it.
export { PAYSTACK_SECRET_KEY };
