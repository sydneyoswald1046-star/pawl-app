import { useSyncExternalStore } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  number: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  service: string;
  items?: InvoiceLineItem[];
  notes?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedDate?: string;
  dueDate: string;
  paidDate?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  localCreatedAt: number;
};

export type NewInvoiceInput = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'localCreatedAt'>;

let invoices: Invoice[] = [];
const listeners = new Set<() => void>();
let unsub: Unsubscribe | null = null;
let currentUid: string | null = null;

const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = (): Invoice[] => invoices;

export function attachInvoicesListener(uid: string | null) {
  unsub?.();
  currentUid = uid;
  if (!uid) {
    invoices = [];
    notify();
    return;
  }
  const q = query(
    collection(db, 'users', uid, 'invoices'),
    orderBy('localCreatedAt', 'desc'),
  );
  unsub = onSnapshot(q, (snap) => {
    invoices = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) }));
    notify();
  });
}

function requireUid(): string {
  if (!currentUid) throw new Error('Cannot mutate invoices: not signed in');
  return currentUid;
}

export async function addInvoice(input: NewInvoiceInput): Promise<string> {
  const uid = requireUid();
  const ref = await addDoc(collection(db, 'users', uid, 'invoices'), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    localCreatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateInvoice(
  id: string,
  patch: Partial<Omit<Invoice, 'id' | 'createdAt' | 'localCreatedAt'>>,
): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(db, 'users', uid, 'invoices', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(db, 'users', uid, 'invoices', id));
}

export async function markInvoicePaid(id: string, paidOn?: string): Promise<void> {
  const date = paidOn ?? new Date().toISOString().split('T')[0];
  await updateInvoice(id, { status: 'paid', paidDate: date });
}

export async function markInvoiceUnpaid(id: string): Promise<void> {
  await updateInvoice(id, { status: 'pending', paidDate: undefined });
}

export function nextInvoiceNumber(): string {
  let max = 0;
  for (const inv of invoices) {
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
  today: Date = new Date(),
) {
  const paid = list.filter(
    (i) => i.status === 'paid' && i.paidDate && isInPeriod(i.paidDate, period, today),
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
  today: Date = new Date(),
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
  onlyPaid: boolean = true,
): ClientRevenue[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const inv of list) {
    if (onlyPaid && inv.status !== 'paid') continue;
    const prev = map.get(inv.clientName) ?? { amount: 0, count: 0 };
    map.set(inv.clientName, { amount: prev.amount + inv.amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export function statusBreakdown(list: Invoice[], today: Date = new Date()) {
  const paid = list.filter((i) => i.status === 'paid');
  const overdue = list.filter((i) => isOverdue(i, today));
  const pending = list.filter((i) => i.status !== 'paid' && !isOverdue(i, today));
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
