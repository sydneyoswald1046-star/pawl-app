import { defineSecret } from 'firebase-functions/params';

// Paystack secret + webhook secrets. Paystack exposes a single secret per
// environment (test vs live) and a separate webhook signature secret which
// defaults to the same value unless rotated in the Paystack dashboard.
export const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY');
export const PAYSTACK_WEBHOOK_SECRET = defineSecret('PAYSTACK_WEBHOOK_SECRET');

const BASE_URL = 'https://api.paystack.co';

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

export async function paystackRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${PAYSTACK_SECRET_KEY.value()}`);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: PaystackResponse<T> | undefined;
  try {
    body = text ? (JSON.parse(text) as PaystackResponse<T>) : undefined;
  } catch {
    throw new Error(`Paystack returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || !body?.status) {
    const message = body?.message || `${res.status} ${res.statusText}`;
    throw new Error(`Paystack ${path}: ${message}`);
  }
  return body.data;
}

// Convert app amount (major units, e.g. 12.50 GHS) → Paystack minor units
// (pesewas for GHS, kobo for NGN, cents for USD, etc.).
//
// Paystack uses minor units for every currency it supports; there are no
// "zero-decimal" exceptions like Stripe's JPY/KRW/etc. — Paystack's supported
// currencies (NGN, GHS, ZAR, KES, USD) all have 2 decimals.
export function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}
