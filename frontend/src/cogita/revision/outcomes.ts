import { createCogitaReviewOutcomesBulk } from '../../lib/api';

export type RevisionOutcomePayload = {
  itemType: 'info' | 'connection';
  itemId: string;
  revisionType: string;
  evalType: string;
  correct: boolean;
  createdUtc: string;
  maskBase64?: string | null;
  payloadBase64?: string | null;
  payloadHashBase64?: string | null;
  clientId: string;
  clientSequence: number;
  personRoleId?: string | null;
};

type StoredOutcome = RevisionOutcomePayload & {
  id: string;
  pending: boolean;
};

const DB_NAME = 'cogita-revision';
const DB_VERSION = 1;
const STORE = 'outcomes';

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('byItem', 'itemKey', { unique: false });
      store.createIndex('byPending', 'pending', { unique: false });
    }
  };
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});

const withStore = async <T,>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => Promise<T>) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    handler(store).then(resolve).catch(reject);
    tx.onerror = () => reject(tx.error);
  });
};

const getClientId = () => {
  const key = 'cogita_revision_client_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
};

const nextSequence = () => {
  const key = 'cogita_revision_client_seq';
  const current = Number(localStorage.getItem(key) ?? '0');
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(key, String(next));
  return next;
};

const toItemKey = (itemType: string, itemId: string) => `${itemType}:${itemId}`;

export const recordOutcome = async (payload: Omit<RevisionOutcomePayload, 'clientId' | 'clientSequence' | 'createdUtc'>) => {
  const clientId = getClientId();
  const clientSequence = nextSequence();
  const createdUtc = new Date().toISOString();
  const outcome: StoredOutcome = {
    ...payload,
    clientId,
    clientSequence,
    createdUtc,
    id: crypto.randomUUID(),
    pending: true
  };
  await withStore('readwrite', (store) => new Promise<void>((resolve, reject) => {
    const item = { ...outcome, itemKey: toItemKey(outcome.itemType, outcome.itemId) };
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
  return outcome;
};

export const getOutcomesForItem = async (itemType: string, itemId: string) => {
  const itemKey = toItemKey(itemType, itemId);
  return withStore('readonly', (store) => new Promise<RevisionOutcomePayload[]>((resolve, reject) => {
    const index = store.index('byItem');
    const request = index.getAll(itemKey);
    request.onsuccess = () => {
      const rows = (request.result ?? []) as Array<StoredOutcome & { itemKey: string }>;
      const outcomes = rows
        .map((row) => ({
          itemType: row.itemType,
          itemId: row.itemId,
          revisionType: row.revisionType,
          evalType: row.evalType,
          correct: row.correct,
          createdUtc: row.createdUtc,
          maskBase64: row.maskBase64,
          payloadBase64: row.payloadBase64,
          payloadHashBase64: row.payloadHashBase64,
          clientId: row.clientId,
          clientSequence: row.clientSequence,
          personRoleId: row.personRoleId ?? null
        }))
        .sort((a, b) => a.createdUtc.localeCompare(b.createdUtc));
      resolve(outcomes);
    };
    request.onerror = () => reject(request.error);
  }));
};

export const getPendingOutcomes = async (limit = 100) => {
  return withStore('readonly', (store) => new Promise<StoredOutcome[]>((resolve, reject) => {
    const index = store.index('byPending');
    const request = index.getAll(true);
    request.onsuccess = () => {
      const rows = (request.result ?? []) as Array<StoredOutcome & { itemKey: string }>;
      resolve(rows.slice(0, limit));
    };
    request.onerror = () => reject(request.error);
  }));
};

export const markOutcomesSynced = async (ids: string[]) => {
  if (ids.length === 0) return;
  await withStore('readwrite', (store) => new Promise<void>((resolve, reject) => {
    let remaining = ids.length;
    ids.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const row = request.result as StoredOutcome | undefined;
        if (row) {
          row.pending = false;
          const put = store.put(row);
          put.onsuccess = () => {
            remaining -= 1;
            if (remaining === 0) resolve();
          };
          put.onerror = () => reject(put.error);
        } else {
          remaining -= 1;
          if (remaining === 0) resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }));
};

export const syncPendingOutcomes = async (libraryId: string, personRoleId?: string | null) => {
  const pending = await getPendingOutcomes(200);
  if (pending.length === 0) return;
  const grouped = new Map<string, StoredOutcome[]>();
  pending.forEach((outcome) => {
    const key = outcome.personRoleId ?? personRoleId ?? '';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(outcome);
  });
  for (const [key, outcomes] of grouped.entries()) {
    const payload = outcomes.map((outcome) => ({
      itemType: outcome.itemType,
      itemId: outcome.itemId,
      revisionType: outcome.revisionType,
      evalType: outcome.evalType,
      correct: outcome.correct,
      clientId: outcome.clientId,
      clientSequence: outcome.clientSequence,
      maskBase64: outcome.maskBase64 ?? null,
      payloadHashBase64: outcome.payloadHashBase64 ?? null,
      payloadBase64: outcome.payloadBase64 ?? null,
      personRoleId: key || null
    }));
    try {
      await createCogitaReviewOutcomesBulk({ libraryId, outcomes: payload });
      await markOutcomesSynced(outcomes.map((entry) => entry.id));
    } catch {
      // keep pending for later retry
    }
  }
};
