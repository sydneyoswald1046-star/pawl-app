import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  PAYSTACK_SECRET_KEY,
  paystackRequest,
} from './paystackClient';

type Bank = {
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string | null;
  pay_with_bank: boolean;
  active: boolean;
  is_deleted: boolean;
  country: string;
  currency: string;
  type: string;
};

type ResolvedAccount = {
  account_number: string;
  account_name: string;
  bank_id: number;
};

type Subaccount = {
  id: number;
  subaccount_code: string;
  business_name: string;
  description: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  percentage_charge: number;
  settlement_bank: string;
  account_number: string;
  active: boolean;
};

const SUPPORTED_COUNTRIES = new Set(['ghana', 'nigeria', 'south africa', 'kenya']);

/**
 * Returns the list of banks Paystack supports in the user's country, plus
 * the per-currency selection. The mobile app shows this as a dropdown when
 * the user is connecting their bank for payouts.
 */
export const listPaystackBanks = onCall(
  { secrets: [PAYSTACK_SECRET_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const country = String(request.data?.country ?? 'ghana').toLowerCase();
    if (!SUPPORTED_COUNTRIES.has(country)) {
      throw new HttpsError(
        'invalid-argument',
        `Paystack does not support ${country}.`,
      );
    }

    try {
      const banks = await paystackRequest<Bank[]>(
        `/bank?country=${encodeURIComponent(country)}&perPage=100`,
      );
      return {
        banks: banks
          .filter((b) => b.active && !b.is_deleted)
          .map((b) => ({
            name: b.name,
            code: b.code,
            currency: b.currency,
            type: b.type,
          })),
      };
    } catch (err) {
      logger.error('Failed to list Paystack banks', { country, err });
      throw new HttpsError('internal', (err as Error).message);
    }
  },
);

/**
 * Verifies the supplied bank account belongs to the supplied account holder.
 * Paystack's "resolve" endpoint hits the bank's name-enquiry API and returns
 * the account holder's name. We surface that to the user to confirm before
 * we create the subaccount.
 */
export const resolvePaystackAccount = onCall(
  { secrets: [PAYSTACK_SECRET_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const accountNumber = String(request.data?.accountNumber ?? '').trim();
    const bankCode = String(request.data?.bankCode ?? '').trim();
    if (!accountNumber || !bankCode) {
      throw new HttpsError(
        'invalid-argument',
        'accountNumber and bankCode are required',
      );
    }

    try {
      const data = await paystackRequest<ResolvedAccount>(
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      );
      return {
        accountName: data.account_name,
        accountNumber: data.account_number,
      };
    } catch (err) {
      const message = (err as Error).message;
      // Paystack returns 422 with "Could not resolve account name" for
      // invalid combos. Surface as user-facing error.
      throw new HttpsError(
        'failed-precondition',
        message.includes('resolve')
          ? 'That account number is not valid for the selected bank.'
          : message,
      );
    }
  },
);

/**
 * Creates (or updates) a Paystack subaccount for the calling user. The
 * subaccount is the destination Paystack credits when a customer pays an
 * invoice — Paystack handles the split between the user's bank and any
 * platform fee Payly takes.
 *
 * Currently sets `percentage_charge: 0` — Payly takes no platform fee in v1.
 * Adjust later by passing a different number from the caller.
 */
export const createPaystackSubaccount = onCall(
  { secrets: [PAYSTACK_SECRET_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = request.auth.uid;
    const businessName = String(request.data?.businessName ?? '').trim();
    const bankCode = String(request.data?.bankCode ?? '').trim();
    const accountNumber = String(request.data?.accountNumber ?? '').trim();
    const country = String(request.data?.country ?? 'ghana').toLowerCase();
    const primaryContactName = request.data?.primaryContactName?.toString().trim();
    const primaryContactEmail = request.data?.primaryContactEmail?.toString().trim();
    const primaryContactPhone = request.data?.primaryContactPhone?.toString().trim();

    if (!businessName || !bankCode || !accountNumber) {
      throw new HttpsError(
        'invalid-argument',
        'businessName, bankCode, and accountNumber are required',
      );
    }
    if (!SUPPORTED_COUNTRIES.has(country)) {
      throw new HttpsError('invalid-argument', `Country ${country} not supported`);
    }

    try {
      const userRef = admin.firestore().doc(`users/${uid}`);
      const userSnap = await userRef.get();
      const existing = userSnap.data()?.paystackSubaccountCode as string | undefined;

      const body: Record<string, unknown> = {
        business_name: businessName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: 0,
        primary_contact_name: primaryContactName,
        primary_contact_email: primaryContactEmail,
        primary_contact_phone: primaryContactPhone,
        metadata: { payly_uid: uid, country },
      };

      const subaccount = existing
        ? await paystackRequest<Subaccount>(`/subaccount/${existing}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await paystackRequest<Subaccount>('/subaccount', {
            method: 'POST',
            body: JSON.stringify(body),
          });

      await userRef.set(
        {
          paymentGateway: 'paystack',
          paystackSubaccountCode: subaccount.subaccount_code,
          paystackAccountStatus: subaccount.active ? 'active' : 'inactive',
          paystackBankCode: bankCode,
          paystackAccountLast4: accountNumber.slice(-4),
          paystackBusinessName: businessName,
          paystackCountry: country,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      logger.info('Paystack subaccount synced', {
        uid,
        code: subaccount.subaccount_code,
        active: subaccount.active,
      });

      return {
        subaccountCode: subaccount.subaccount_code,
        active: subaccount.active,
      };
    } catch (err) {
      logger.error('Failed to create/update Paystack subaccount', { uid, err });
      throw new HttpsError('internal', (err as Error).message);
    }
  },
);
