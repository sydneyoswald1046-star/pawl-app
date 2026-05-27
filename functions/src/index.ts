import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { createInvoicePaymentLink } from './createInvoicePaymentLink';
export { stripeWebhook } from './stripeWebhook';
export { createConnectAccountLink } from './createConnectAccountLink';
export { stripeConnectReturn } from './stripeConnectReturn';
export { connectWebhook } from './connectWebhook';
export { deleteAccount } from './deleteAccount';
export { createSubscriptionCheckout } from './createSubscriptionCheckout';
export { createBillingPortalSession } from './createBillingPortalSession';
export {
  createConnectionToken,
  createTerminalPaymentIntent,
} from './terminal';
