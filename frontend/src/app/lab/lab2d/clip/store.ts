/**
 * LABOR 2D (v2) — DER SPEICHER DER NACHWEISE (B): nur im Browser (die
 * Entscheidung des Nutzers, SANDBOX.md §9 — keine Dateien, nichts an Seiten).
 * IndexedDB „recreatio-lab2d“: Köpfe in „clips“, gepackte Stücke in „chunks“,
 * Schlüsselbilder in „keys“ (je `Schlüssel:Nummer`), damit die Wiedergabe nur
 * holt, was sie gerade braucht. Mehr als MAX_CLIPS Nachweise oder MAX_BYTES:
 * die am längsten nicht abgespielten weichen.
 *
 * Ohne IndexedDB (privates Fenster, Prüfstand) ein Speicher im Arbeiter —
 * dann gilt ein Nachweis nur, solange das Labor offen ist.
 */

import type { ClipHeader } from './clip';

export interface ClipStore {
  header(key: string): Promise<ClipHeader | null>;
  chunk(key: string, i: number): Promise<Uint8Array | null>;
  keyframe(key: string, i: number): Promise<Uint8Array | null>;
  save(header: ClipHeader, chunks: readonly Uint8Array[], keys: readonly Uint8Array[]): Promise<void>;
  /** Als abgespielt vermerken (die ältesten weichen zuerst). */
  touch(key: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const MAX_CLIPS = 16;
const MAX_BYTES = 600e6;

/** Ein Speicher im Arbeiter (ohne IndexedDB; im Prüfstand). */
export function memoryStore(): ClipStore {
  const heads = new Map<string, ClipHeader>();
  const data = new Map<string, Uint8Array>();
  return {
    header: async (key) => heads.get(key) ?? null,
    chunk: async (key, i) => data.get(`c:${key}:${i}`) ?? null,
    keyframe: async (key, i) => data.get(`k:${key}:${i}`) ?? null,
    save: async (h, chunks, keys) => {
      heads.set(h.key, h);
      chunks.forEach((c, i) => data.set(`c:${h.key}:${i}`, c));
      keys.forEach((k, i) => data.set(`k:${h.key}:${i}`, k));
    },
    touch: async (key) => { const h = heads.get(key); if (h !== undefined) h.used = Date.now(); },
    remove: async (key) => {
      heads.delete(key);
      for (const k of [...data.keys()]) if (k.includes(`:${key}:`)) data.delete(k);
    }
  };
}

const DB = 'recreatio-lab2d';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
  });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('clips')) db.createObjectStore('clips', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB'));
    r.onblocked = () => reject(new Error('IndexedDB: blocked'));
  });
}

/** Der Speicher in IndexedDB — oder im Arbeiter, wenn es keine gibt. */
export async function browserStore(): Promise<ClipStore> {
  if (typeof indexedDB === 'undefined') return memoryStore();
  let db: IDBDatabase;
  try { db = await open(); } catch { return memoryStore(); }
  const get = async (store: string, key: string): Promise<unknown> => request(db.transaction(store, 'readonly').objectStore(store).get(key));
  const bytes = (v: unknown): Uint8Array | null => (v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : null);
  const removeAll = async (key: string, chunks: number, keys: number): Promise<void> => {
    const tx = db.transaction(['clips', 'chunks', 'keys'], 'readwrite');
    tx.objectStore('clips').delete(key);
    for (let i = 0; i < chunks; i += 1) tx.objectStore('chunks').delete(`${key}:${i}`);
    for (let i = 0; i < keys; i += 1) tx.objectStore('keys').delete(`${key}:${i}`);
    await done(tx);
  };
  const store: ClipStore = {
    header: async (key) => (await get('clips', key) as ClipHeader | undefined) ?? null,
    chunk: async (key, i) => bytes(await get('chunks', `${key}:${i}`)),
    keyframe: async (key, i) => bytes(await get('keys', `${key}:${i}`)),
    save: async (h, chunks, keys) => {
      const old = await store.header(h.key);
      if (old !== null) await removeAll(old.key, old.chunkBytes.length, old.keyframes.length);
      /* Platz schaffen: die am längsten nicht abgespielten zuerst. */
      const all = (await request(db.transaction('clips', 'readonly').objectStore('clips').getAll())) as ClipHeader[];
      all.sort((a, b) => a.used - b.used);
      let count = all.length + 1;
      let total = all.reduce((s, x) => s + x.bytes, 0) + h.bytes;
      for (const x of all) {
        if (count <= MAX_CLIPS && total <= MAX_BYTES) break;
        await removeAll(x.key, x.chunkBytes.length, x.keyframes.length);
        count -= 1;
        total -= x.bytes;
      }
      const tx = db.transaction(['clips', 'chunks', 'keys'], 'readwrite');
      chunks.forEach((c, i) => tx.objectStore('chunks').put(c, `${h.key}:${i}`));
      keys.forEach((k, i) => tx.objectStore('keys').put(k, `${h.key}:${i}`));
      tx.objectStore('clips').put(h);
      await done(tx);
    },
    touch: async (key) => {
      const h = await store.header(key);
      if (h === null) return;
      const tx = db.transaction('clips', 'readwrite');
      tx.objectStore('clips').put({ ...h, used: Date.now() });
      await done(tx);
    },
    remove: async (key) => {
      const h = await store.header(key);
      if (h !== null) await removeAll(key, h.chunkBytes.length, h.keyframes.length);
    }
  };
  return store;
}
