import type { UserProfile, SubscriptionStatus } from '../data/profile';

export const FREE_INVOICE_LIMIT_PER_MONTH = 5;
export const FREE_CLIENT_LIMIT = 10;

export type Entitlements = {
  isPro: boolean;
  status: SubscriptionStatus | 'free';
  invoiceLimit: number | 'unlimited';
  clientLimit: number | 'unlimited';
  stripeConnect: boolean;
  customPaymentLink: boolean;
  businessNameOnPdf: boolean;
  businessLogoOnPdf: boolean;
  poweredByFooter: boolean;
};

const PRO_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due'];

export function getEntitlements(profile: UserProfile | null | undefined): Entitlements {
  const status = profile?.subscription?.status;
  const isPro = !!status && PRO_STATUSES.includes(status);
  return {
    isPro,
    status: status ?? 'free',
    invoiceLimit: isPro ? 'unlimited' : FREE_INVOICE_LIMIT_PER_MONTH,
    clientLimit: isPro ? 'unlimited' : FREE_CLIENT_LIMIT,
    // Receiving payments is core functionality — free for all users.
    stripeConnect: true,
    customPaymentLink: true,
    businessNameOnPdf: isPro,
    businessLogoOnPdf: isPro,
    poweredByFooter: !isPro, // free PDFs include a "Sent via PAWL" footer
  };
}

export function invoiceCountThisMonth(invoices: Array<{ localCreatedAt?: number; createdAt?: { toMillis?: () => number } | null }>): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return invoices.filter((inv) => {
    const t = inv.localCreatedAt ?? inv.createdAt?.toMillis?.() ?? 0;
    return t >= startOfMonth;
  }).length;
}
