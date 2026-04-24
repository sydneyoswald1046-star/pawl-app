import { useMemo, useSyncExternalStore } from 'react';
import { useInvoices, type Invoice } from './invoices';

export type GalleryItem = {
  id: string;
  uri: string;
  caption?: string;
  addedAt: string; // ISO YYYY-MM-DD
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  gallery?: GalleryItem[];
  createdAt: string; // ISO YYYY-MM-DD
};

export type ClientWithStats = Client & {
  invoiceCount: number;
  totalBilled: number;
  outstandingAmount: number;
  lastInvoiceDate?: string;
};

const SEED: Client[] = [
  {
    id: 'c1',
    name: 'Marcus Williams',
    email: 'marcus@mwphoto.co',
    phone: '+1 (415) 555-0142',
    address: '2350 Mission St\nSan Francisco, CA 94110',
    createdAt: '2026-02-14',
    gallery: [
      { id: 'g-mw-1', uri: 'https://picsum.photos/seed/payly-mw1/600/600', caption: 'Portrait session', addedAt: '2026-02-20' },
      { id: 'g-mw-2', uri: 'https://picsum.photos/seed/payly-mw2/600/600', caption: 'Product shoot', addedAt: '2026-03-18' },
    ],
  },
  {
    id: 'c2',
    name: 'Sarah Chen',
    email: 'sarah@chenstudio.com',
    phone: '+1 (212) 555-0198',
    address: '421 Broadway, Suite 4B\nNew York, NY 10013',
    createdAt: '2026-03-02',
    notes: 'Prefers a brief recap after each milestone.',
  },
  {
    id: 'c3',
    name: 'Oakwood Barbershop',
    email: 'book@oakwoodcuts.com',
    phone: '+1 (323) 555-0176',
    address: '1508 Sunset Blvd\nLos Angeles, CA 90026',
    createdAt: '2026-01-18',
    notes: 'Monthly maintenance retainer — invoice on the 1st.',
    gallery: [
      { id: 'g-oak-1', uri: 'https://picsum.photos/seed/payly-oak1/600/600', caption: 'Storefront refresh', addedAt: '2026-02-03' },
      { id: 'g-oak-2', uri: 'https://picsum.photos/seed/payly-oak2/600/600', caption: 'New chairs installed', addedAt: '2026-03-12' },
      { id: 'g-oak-3', uri: 'https://picsum.photos/seed/payly-oak3/600/600', caption: 'Exterior lighting', addedAt: '2026-04-10' },
      { id: 'g-oak-4', uri: 'https://picsum.photos/seed/payly-oak4/600/600', caption: 'Back room cleanup', addedAt: '2026-04-18' },
    ],
  },
  {
    id: 'c4',
    name: 'Lisa Okafor',
    email: 'lisa.okafor@gmail.com',
    phone: '+1 (646) 555-0163',
    address: 'Brooklyn, NY',
    createdAt: '2026-03-20',
  },
  {
    id: 'c5',
    name: 'Tomas Reyes',
    email: 'tomas@reyesfilms.net',
    phone: '+1 (512) 555-0134',
    createdAt: '2026-04-04',
  },
];

let store: Client[] = SEED;
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getSnapshot = (): Client[] => store;
function emit() {
  listeners.forEach((l) => l());
}

export function addClient(input: Omit<Client, 'id' | 'createdAt'>): Client {
  const created: Client = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString().split('T')[0],
    ...input,
  };
  store = [created, ...store];
  emit();
  return created;
}

export function updateClient(id: string, patch: Partial<Omit<Client, 'id' | 'createdAt'>>) {
  store = store.map((c) => (c.id === id ? { ...c, ...patch } : c));
  emit();
}

export function deleteClient(id: string) {
  store = store.filter((c) => c.id !== id);
  emit();
}

export function addGalleryItem(
  clientId: string,
  item: Omit<GalleryItem, 'id' | 'addedAt'>
): GalleryItem {
  const created: GalleryItem = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    addedAt: new Date().toISOString().split('T')[0],
    ...item,
  };
  store = store.map((c) =>
    c.id === clientId
      ? { ...c, gallery: [created, ...(c.gallery ?? [])] }
      : c
  );
  emit();
  return created;
}

export function removeGalleryItem(clientId: string, itemId: string) {
  store = store.map((c) =>
    c.id === clientId
      ? { ...c, gallery: (c.gallery ?? []).filter((g) => g.id !== itemId) }
      : c
  );
  emit();
}

export function getClientByName(name: string): Client | undefined {
  return store.find((c) => c.name === name);
}

function useRawClients(): Client[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function enrich(clients: Client[], invoices: Invoice[]): ClientWithStats[] {
  return clients
    .map((cl) => {
      const my = invoices.filter((i) => i.client === cl.name);
      const totalBilled = my.reduce((s, i) => s + i.amount, 0);
      const outstandingAmount = my
        .filter((i) => i.status !== 'paid')
        .reduce((s, i) => s + i.amount, 0);
      const lastInvoiceDate = my.length
        ? my.map((i) => i.dueDate).sort().reverse()[0]
        : undefined;
      return {
        ...cl,
        invoiceCount: my.length,
        totalBilled,
        outstandingAmount,
        lastInvoiceDate,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useClients(): ClientWithStats[] {
  const clients = useRawClients();
  const invoices = useInvoices();
  return useMemo(() => enrich(clients, invoices), [clients, invoices]);
}

export function useClient(id: string): ClientWithStats | undefined {
  return useClients().find((c) => c.id === id);
}
