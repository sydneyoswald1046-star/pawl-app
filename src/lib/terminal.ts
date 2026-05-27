import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

type ConnectionTokenResult = { secret: string };
type PaymentIntentResult = { clientSecret: string; paymentIntentId: string };

const connectionTokenFn = httpsCallable<{ reader_location?: string }, ConnectionTokenResult>(
  functions,
  'createConnectionToken',
);

const paymentIntentFn = httpsCallable<
  { invoiceId: string; amount: number; currency?: string },
  PaymentIntentResult
>(functions, 'createTerminalPaymentIntent');

/**
 * Used by StripeTerminalProvider's `tokenProvider` prop. Stripe Terminal SDK
 * calls this every ~1 hour to refresh its connection credential.
 */
export async function fetchConnectionToken(): Promise<string> {
  const { data } = await connectionTokenFn({});
  if (!data?.secret) throw new Error('No connection token returned');
  return data.secret;
}

/**
 * Mint a PaymentIntent on the user's Connect account for an invoice. The
 * client secret is what the Terminal SDK collects against. On capture, the
 * existing connectWebhook marks the invoice paid via metadata.
 */
export async function createTerminalPaymentIntent(args: {
  invoiceId: string;
  amount: number;
  currency?: string;
}): Promise<PaymentIntentResult> {
  const { data } = await paymentIntentFn(args);
  if (!data?.clientSecret) throw new Error('No client secret returned');
  return data;
}
