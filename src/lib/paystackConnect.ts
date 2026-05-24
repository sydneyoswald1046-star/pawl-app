import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { PaystackCountry } from '../data/profile';

export type PaystackBank = {
  name: string;
  code: string;
  currency: string;
  type: string;
};

const listBanksFn = httpsCallable<{ country: PaystackCountry }, { banks: PaystackBank[] }>(
  functions,
  'listPaystackBanks',
);

const resolveAccountFn = httpsCallable<
  { accountNumber: string; bankCode: string },
  { accountName: string; accountNumber: string }
>(functions, 'resolvePaystackAccount');

const createSubaccountFn = httpsCallable<
  {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    country: PaystackCountry;
    primaryContactName?: string;
    primaryContactEmail?: string;
    primaryContactPhone?: string;
  },
  { subaccountCode: string; active: boolean }
>(functions, 'createPaystackSubaccount');

export async function listPaystackBanks(country: PaystackCountry): Promise<PaystackBank[]> {
  const { data } = await listBanksFn({ country });
  return data.banks;
}

export async function resolvePaystackAccount(
  bankCode: string,
  accountNumber: string,
): Promise<{ accountName: string; accountNumber: string }> {
  const { data } = await resolveAccountFn({ bankCode, accountNumber });
  return data;
}

export async function createPaystackSubaccount(args: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  country: PaystackCountry;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}): Promise<{ subaccountCode: string; active: boolean }> {
  const { data } = await createSubaccountFn(args);
  return data;
}
