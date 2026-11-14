import { useCallback, useEffect, useState } from 'react';
import type { TransactionDTO } from '@mandimitra/shared';
import type { ReviewValues } from '@/features/voice/review-form';
import { api, ApiError } from './api';
import type { ExtractionResult } from './queries';

/**
 * Device-local storage, clearly separate from server records:
 *  - 'draft':  unconfirmed slip the user wants to finish later
 *  - 'queued': confirmed by the user while offline, waiting to be sent
 * Each item's id is used as the Idempotency-Key, so retries never create duplicates.
 */
export interface LocalItem {
  id: string;
  kind: 'draft' | 'queued';
  savedAt: string;
  values?: ReviewValues;
  payload?: Record<string, unknown>;
  recordFullPayment?: boolean;
  transcript?: string;
  extraction?: ExtractionResult | null;
  lastError?: string;
}

const KEY = 'mm_local_items_v1';
const EVENT = 'mm-local-items';

function read(): LocalItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LocalItem[]; } catch { return []; }
}
function write(items: LocalItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

export const localItems = {
  list: read,
  upsert(item: LocalItem) { write([item, ...read().filter((i) => i.id !== item.id)]); },
  remove(id: string) { write(read().filter((i) => i.id !== id)); },
};

export function useLocalItems() {
  const [items, setItems] = useState<LocalItem[]>(read);
  useEffect(() => {
    const on = () => setItems(read());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return items;
}

export async function saveConfirmed(id: string, payload: Record<string, unknown>, recordFullPayment: boolean, source: 'voice' | 'manual' | 'offline_sync') {
  const res = await api.post<{ transaction: TransactionDTO; duplicate: boolean }>(
    '/api/transactions', { ...payload, confirmed: true, source }, { 'Idempotency-Key': id },
  );
  if (recordFullPayment && res.transaction.outstandingPaise > 0 && !res.duplicate) {
    await api.post(`/api/transactions/${res.transaction.id}/payments`, { amount: res.transaction.outstandingPaise / 100, method: 'cash', note: 'Recorded at confirmation' });
  }
  return res;
}

/** Sends queued confirmed items when connectivity returns. */
export function useOfflineSync(onSynced?: (n: number) => void) {
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    let n = 0;
    for (const item of read().filter((i) => i.kind === 'queued' && i.payload)) {
      try {
        await saveConfirmed(item.id, item.payload as Record<string, unknown>, !!item.recordFullPayment, 'offline_sync');
        localItems.remove(item.id);
        n++;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NETWORK_ERROR') return;
        localItems.upsert({ ...item, lastError: e instanceof Error ? e.message : 'Sync failed' });
      }
    }
    if (n) onSynced?.(n);
  }, [onSynced]);

  useEffect(() => {
    void sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [sync]);
  return sync;
}
