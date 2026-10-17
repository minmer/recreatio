/**
 * EINE KLEINE ABLAGE IM BROWSER (IndexedDB) — für das, was zu gross ist für
 * den `localStorage` und was ein Neustart überstehen soll: die versiegelte
 * Abschrift einer grossen Bibliothek [N2], die Antworten, die ohne Netz
 * entstanden sind und noch hinausmüssen [E9], die Fragen für das Lernen ohne
 * Netz.
 *
 * <b>Hier liegt nichts Offenes.</b> Was hineinkommt, ist versiegelt — unter
 * dem Schlüssel eines Bereichs, unter öffentlichen Schlüsseln (die Antworten)
 * oder unter dem Schlüssel dieses Geräts (`kept.ts`). Die Ablage ist nur der
 * Ort, nicht der Schutz.
 *
 * <b>Duldsam</b>: ein privates Fenster, gesperrte Seitendaten, kein IndexedDB
 * (die Prüfung in Node) — dann ist nichts abgelegt, und nichts wirft.
 */

const NAME = 'recreatio-local';
const VERSION = 1;
export const STORES = ['library', 'outbox', 'progress', 'offline'] as const;
export type StoreName = (typeof STORES)[number];

let opening: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (opening !== null) return opening;
  opening = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const request = indexedDB.open(NAME, VERSION);
      request.onupgradeneeded = () => {
        for (const store of STORES) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return db().then((d) => new Promise<T | null>((resolve) => {
    if (d === null) { resolve(null); return; }
    try {
      const request = work(d.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

export const idbGet = <T>(store: StoreName, key: string): Promise<T | null> =>
  run<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);

export async function idbPut(store: StoreName, key: string, value: unknown): Promise<boolean> {
  return (await run(store, 'readwrite', (s) => s.put(value, key))) !== null;
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  await run(store, 'readwrite', (s) => s.delete(key));
}

/** Die Schlüssel, die mit `prefix` beginnen. */
export async function idbKeys(store: StoreName, prefix = ''): Promise<string[]> {
  const keys = (await run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys())) ?? [];
  return keys.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
}

export async function idbClear(store: StoreName): Promise<void> {
  await run(store, 'readwrite', (s) => s.clear());
}

/** Bei der Abmeldung: alles, was dieser Mensch hier liegen liess. */
export async function idbForget(...stores: readonly StoreName[]): Promise<void> {
  for (const store of stores.length === 0 ? STORES : stores) await idbClear(store);
}
