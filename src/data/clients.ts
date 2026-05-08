import { useMemo, useSyncExternalStore } from 'react';
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
import { useInvoices, type Invoice } from './invoices';

export type GalleryItem = {
  id: string;
  uri: string;
  caption?: string;
  addedAt: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  gallery?: GalleryItem[];
  createdAt: string;
  updatedAt?: Timestamp | null;
};

export type ClientWithStats = Client & {
  invoiceCount: number;
  totalBilled: number;
  outstandingAmount: number;
  lastInvoiceDate?: string;
};

export type NewClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;

let store: Client[] = [];
const listeners = new Set<() => void>();
let unsub: Unsubscribe | null = null;
let currentUid: string | null = null;

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

export function attachClientsListener(uid: string | null) {
  unsub?.();
  currentUid = uid;
  if (!uid) {
    store = [];
    emit();
    return;
  }
  const q = query(
    collection(db, 'users', uid, 'clients'),
    orderBy('createdAt', 'desc'),
  );
  unsub = onSnapshot(q, (snap) => {
    store = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
    emit();
  });
}

function requireUid(): string {
  if (!currentUid) throw new Error('Cannot mutate clients: not signed in');
  return currentUid;
}

// Firestore rejects `undefined` field values. Strip them so callers can pass
// `field: maybe || undefined` without thinking about it.
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export async function addClient(input: NewClientInput): Promise<string> {
  const uid = requireUid();
  const ref = await addDoc(collection(db, 'users', uid, 'clients'), {
    ...stripUndefined(input),
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClient(
  id: string,
  patch: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(db, 'users', uid, 'clients', id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClient(id: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(db, 'users', uid, 'clients', id));
}

export async function addGalleryItem(
  clientId: string,
  item: Omit<GalleryItem, 'id' | 'addedAt'>,
): Promise<GalleryItem> {
  const created: GalleryItem = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    addedAt: new Date().toISOString().split('T')[0],
    ...item,
  };
  const current = store.find((c) => c.id === clientId);
  const nextGallery = [created, ...(current?.gallery ?? [])];
  await updateClient(clientId, { gallery: nextGallery });
  return created;
}

export async function removeGalleryItem(clientId: string, itemId: string): Promise<void> {
  const current = store.find((c) => c.id === clientId);
  const nextGallery = (current?.gallery ?? []).filter((g) => g.id !== itemId);
  await updateClient(clientId, { gallery: nextGallery });
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
      const my = invoices.filter((i) => i.clientId === cl.id);
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
