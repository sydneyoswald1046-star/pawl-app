import { useSyncExternalStore } from 'react';
import { getCurrentLocale } from '../i18n';
import en from '../i18n/en';
import es from '../i18n/es';

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export type InvoiceLineItem = {
  id: string;
  description: string;
  amount: number;
};

export type Invoice = {
  id: string;
  number?: string; // e.g. "INV-0012"
  client: string;
  service: string; // human summary of items for list views
  items?: InvoiceLineItem[];
  notes?: string;
  amount: number;
  status: InvoiceStatus;
  issuedDate?: string; // ISO YYYY-MM-DD
  dueDate: string; // ISO YYYY-MM-DD
  paidDate?: string; // ISO YYYY-MM-DD — set only for paid invoices
};

const SEED: Invoice[] = [
  // Current — open invoices
  { id: '1', number: 'INV-0012', client: 'Marcus Williams', service: 'Photography', amount: 850, status: 'paid', issuedDate: '2026-04-01', dueDate: '2026-04-18', paidDate: '2026-04-14' },
  { id: '2', number: 'INV-0011', client: 'Sarah Chen', service: 'Brand Design', amount: 2400, status: 'pending', issuedDate: '2026-04-15', dueDate: '2026-04-29' },
  { id: '3', number: 'INV-0010', client: 'Oakwood Barbershop', service: 'Maintenance', amount: 350, status: 'overdue', issuedDate: '2026-04-05', dueDate: '2026-04-17' },
  { id: '4', number: 'INV-0009', client: 'Lisa Okafor', service: 'DJ Set', amount: 1200, status: 'pending', issuedDate: '2026-04-20', dueDate: '2026-05-04' },
  { id: '5', number: 'INV-0008', client: 'Tomas Reyes', service: 'Video Editing', amount: 850, status: 'pending', issuedDate: '2026-04-12', dueDate: '2026-04-26' },
  // Historical — paid invoices for reports
  { id: 'h1', number: 'INV-0001', client: 'Marcus Williams', service: 'Event Photography', amount: 1600, status: 'paid', issuedDate: '2025-11-06', dueDate: '2025-11-20', paidDate: '2025-11-18' },
  { id: 'h2', number: 'INV-0002', client: 'Sarah Chen', service: 'Brand Identity', amount: 2200, status: 'paid', issuedDate: '2025-12-01', dueDate: '2025-12-15', paidDate: '2025-12-12' },
  { id: 'h3', number: 'INV-0003', client: 'Oakwood Barbershop', service: 'Maintenance', amount: 350, status: 'paid', issuedDate: '2025-12-22', dueDate: '2026-01-05', paidDate: '2026-01-04' },
  { id: 'h4', number: 'INV-0004', client: 'Tomas Reyes', service: 'Intro Video', amount: 900, status: 'paid', issuedDate: '2026-01-27', dueDate: '2026-02-10', paidDate: '2026-02-09' },
  { id: 'h5', number: 'INV-0005', client: 'Lisa Okafor', service: 'DJ Set', amount: 1400, status: 'paid', issuedDate: '2026-02-11', dueDate: '2026-02-25', paidDate: '2026-02-26' },
  { id: 'h6', number: 'INV-0006', client: 'Sarah Chen', service: 'Website Redesign', amount: 3200, status: 'paid', issuedDate: '2026-03-04', dueDate: '2026-03-18', paidDate: '2026-03-15' },
  { id: 'h7', number: 'INV-0007', client: 'Marcus Williams', service: 'Product Photography', amount: 1100, status: 'paid', issuedDate: '2026-03-14', dueDate: '2026-03-28', paidDate: '2026-03-27' },
];

let invoices: Invoice[] = SEED;
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = (): Invoice[] => invoices;

export function addInvoice(invoice: Invoice) {
  invoices = [invoice, ...invoices];
  listeners.forEach((l) => l());
}

export function updateInvoice(id: string, patch: Partial<Omit<Invoice, 'id'>>) {
  invoices = invoices.map((i) => (i.id === id ? { ...i, ...patch } : i));
  listeners.forEach((l) => l());
}

export function deleteInvoice(id: string) {
  invoices = invoices.filter((i) => i.id !== id);
  listeners.forEach((l) => l());
}

export function markInvoicePaid(id: string, paidOn?: string) {
  const date = paidOn ?? new Date().toISOString().split('T')[0];
  updateInvoice(id, { status: 'paid', paidDate: date });
}

export function markInvoiceUnpaid(id: string) {
  updateInvoice(id, { status: 'pending', paidDate: undefined });
}

export function nextInvoiceNumber(): string {
  let max = 0;
  for (const inv of invoices) {
    if (!inv.number) continue;
    const m = inv.number.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

export function useInvoices(): Invoice[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useInvoice(id: string): Invoice | undefined {
  return useInvoices().find((i) => i.id === id);
}

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntilDue(invoice: Invoice, today: Date = new Date()): number {
  const due = startOfDay(new Date(invoice.dueDate));
  const t = startOfDay(today);
  return Math.round((due.getTime() - t.getTime()) / MS_PER_DAY);
}

export function isOutstanding(invoice: Invoice): boolean {
  return invoice.status !== 'paid';
}

export function isOverdue(invoice: Invoice, today: Date = new Date()): boolean {
  if (invoice.status === 'paid') return false;
  return invoice.status === 'overdue' || daysUntilDue(invoice, today) < 0;
}

function dict() {
  return getCurrentLocale() === 'es' ? es : en;
}

function localeTag(): string {
  return getCurrentLocale() === 'es' ? 'es-US' : 'en-US';
}

export function formatDueStatus(invoice: Invoice, today: Date = new Date()): string {
  const days = daysUntilDue(invoice, today);
  const d = dict();
  if (isOverdue(invoice, today)) {
    const late = Math.abs(days);
    const template = late === 1 ? d['plural.day_late_one'] : d['plural.day_late_other'];
    return template.replace('{count}', String(late));
  }
  if (days === 0) return d['due.today'];
  if (days === 1) return d['due.tomorrow'];
  return d['due.in_days'].replace('{count}', String(days));
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' });
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(localeTag(), { month: 'short', day: 'numeric', year: 'numeric' });
}

export function summarizeOutstanding(list: Invoice[]) {
  const open = list.filter(isOutstanding);
  return {
    count: open.length,
    amount: open.reduce((sum, i) => sum + i.amount, 0),
    invoices: open,
  };
}

export function summarizeOverdue(list: Invoice[], today: Date = new Date()) {
  const overdue = list.filter((i) => isOverdue(i, today));
  const maxDaysLate = overdue.length
    ? Math.max(...overdue.map((i) => -daysUntilDue(i, today)))
    : 0;
  return {
    count: overdue.length,
    amount: overdue.reduce((sum, i) => sum + i.amount, 0),
    maxDaysLate,
    invoices: overdue,
  };
}

// ─────────────────────────────────────────────────────────────
// Reporting helpers
// ─────────────────────────────────────────────────────────────
export type ReportPeriod = 'month' | '3months' | 'year' | 'all';

export function periodLabel(period: ReportPeriod, today: Date = new Date()): string {
  const d = dict();
  switch (period) {
    case 'month':
      return today.toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' });
    case '3months':
      return d['reports.period_label_3months'];
    case 'year':
      return String(today.getFullYear());
    case 'all':
      return d['reports.period_label_all'];
  }
}

function isInPeriod(paidDate: string, period: ReportPeriod, today: Date): boolean {
  const paid = new Date(paidDate);
  if (period === 'all') return true;
  if (period === 'month') {
    return paid.getFullYear() === today.getFullYear() && paid.getMonth() === today.getMonth();
  }
  if (period === '3months') {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return paid >= start;
  }
  if (period === 'year') {
    return paid.getFullYear() === today.getFullYear();
  }
  return false;
}

export function revenueInPeriod(
  list: Invoice[],
  period: ReportPeriod,
  today: Date = new Date()
) {
  const paid = list.filter(
    (i) => i.status === 'paid' && i.paidDate && isInPeriod(i.paidDate, period, today)
  );
  return {
    amount: paid.reduce((s, i) => s + i.amount, 0),
    count: paid.length,
    invoices: paid,
  };
}

export type MonthRevenue = { key: string; label: string; amount: number };

export function monthlyRevenue(
  list: Invoice[],
  monthsBack: number = 6,
  today: Date = new Date()
): MonthRevenue[] {
  const out: MonthRevenue[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { month: 'short' });
    const amount = list
      .filter((inv) => inv.status === 'paid' && inv.paidDate?.startsWith(key))
      .reduce((s, inv) => s + inv.amount, 0);
    out.push({ key, label, amount });
  }
  return out;
}

export type ClientRevenue = { name: string; amount: number; count: number };

export function topClientsByRevenue(
  list: Invoice[],
  n: number = 5,
  onlyPaid: boolean = true
): ClientRevenue[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const inv of list) {
    if (onlyPaid && inv.status !== 'paid') continue;
    const prev = map.get(inv.client) ?? { amount: 0, count: 0 };
    map.set(inv.client, { amount: prev.amount + inv.amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export function statusBreakdown(list: Invoice[], today: Date = new Date()) {
  const paid = list.filter((i) => i.status === 'paid');
  const overdue = list.filter((i) => isOverdue(i, today));
  const pending = list.filter(
    (i) => i.status !== 'paid' && !isOverdue(i, today)
  );
  return {
    paid: {
      amount: paid.reduce((s, i) => s + i.amount, 0),
      count: paid.length,
    },
    pending: {
      amount: pending.reduce((s, i) => s + i.amount, 0),
      count: pending.length,
    },
    overdue: {
      amount: overdue.reduce((s, i) => s + i.amount, 0),
      count: overdue.length,
    },
  };
}
