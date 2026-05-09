import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { createInvoicePaymentLink } from './createInvoicePaymentLink';
export { stripeWebhook } from './stripeWebhook';
