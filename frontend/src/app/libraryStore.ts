/**
 * DIE OFFENE BIBLIOTHEK IM BROWSER (0064).
 *
 * <b>Alles, was der Dienst nicht kann, geschieht hier:</b> öffnen, suchen,
 * Verweise und Rückverweise („wo wird dieses Zitat genannt?"), Schlüssel
 * eindeutig machen, und vor dem Veröffentlichen ausrechnen, was mitgeht.
 * Der Dienst gleicht nur ab — dieser Speicher holt beim zweiten Mal bloss,
 * was sich seither geändert hat.
 *
 * Ein Speicher je Bibliothek und Tab, über Ansichten hinweg: wer von der
 * Liste in einen Eintrag und zurück geht, lädt nicht neu.
 */

import { useEffect, useState } from 'react';

import { areaKeys, newestKey } from './chat';
import { newId } from './ids';
import type { Ring } from './keys';
import {
  loadEntries, loadPublishedOne, openEntry, publishEntries, putEntry, removeEntry, sealEntry,
  type EntryDoc, type LibraryRow, type SealedEntry
} from './library';
import { originOf } from './libraryCite';
import {
  entryTitle, fieldRefs, kindOf, str, suggestKey, uniqueKey,
  type EntryData, type LibEntry, type Lookup
} from './libraryKinds';
import { citedKeys } from './libraryMarkup';
import { plan, publicEntry, type PublishedAs, type PublishPlan, type PubEntry } from './libraryPublish';
import { WorkspaceError } from './session';

export interface Entry extends PubEntry {
  readonly key?: string;
  readonly version: number;
  readonly epoch: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
}

/** Leere Werte fallen weg — ein Eintrag trägt nur, was gesagt ist. */
export function cleanData(data: EntryData): EntryData {
  const out: EntryData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = typeof value === 'string' ? value.replace(/\s+$/, '') : value;
  }
  return out;
}

const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

export class LibraryStore implements Lookup {
  readonly libraryId: string;
  readonly areaId: string;
  private readonly ring: Ring;
  private readonly entries = new Map<string, Entry>();
  private readonly keys = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private since: string | null = null;
  private syncing: Promise<void> | null = null;
  private backIndex: Map<string, Set<string>> | null = null;
  private searchIndex: Map<string, string> | null = null;

  /** Einträge, deren Hülle sich hier nicht öffnen lässt (Schlüssel einer fremden Epoche). */
  unreadable = 0;
  revision = 0;
  loaded = false;

  constructor(ring: Ring, library: Pick<LibraryRow, 'libraryId' | 'areaId'>) {
    this.ring = ring;
    this.libraryId = library.libraryId;
    this.areaId = library.areaId;
  }

  /* -- Lesen ------------------------------------------------------------------------------- */

  get(id: string): Entry | undefined { return this.entries.get(id); }

  byKey(key: string): Entry | undefined {
    const id = this.keys.get(key.toLowerCase());
    return id === undefined ? undefined : this.entries.get(id);
  }

  all(): Entry[] { return [...this.entries.values()]; }

  ofKind(kind: string): Entry[] { return this.all().filter((e) => e.kind === kind); }

  title(entry: LibEntry): string { return entryTitle(entry, this); }

  keyTaken(key: string, except?: string): boolean {
    const id = this.keys.get(key.toLowerCase());
    return id !== undefined && id !== except;
  }

  /** Wer auf einen Eintrag zeigt — über ein Feld oder einen Verweis im Text. */
  backlinks(id: string): Entry[] {
    if (this.backIndex === null) {
      const index = new Map<string, Set<string>>();
      const add = (target: string, source: string) => {
        if (target === source) return;
        let set = index.get(target);
        if (set === undefined) { set = new Set(); index.set(target, set); }
        set.add(source);
      };
      for (const entry of this.entries.values()) {
        for (const ref of fieldRefs(entry)) add(ref, entry.id);
        const def = kindOf(entry.kind);
        for (const field of def?.fields ?? []) {
          if (field.type !== 'markup') continue;
          for (const key of citedKeys(str(entry.data, field.key))) {
            const target = this.byKey(key);
            if (target !== undefined) add(target.id, entry.id);
          }
        }
      }
      this.backIndex = index;
    }
    return [...(this.backIndex.get(id) ?? [])].map((one) => this.entries.get(one)).filter((e): e is Entry => e !== undefined);
  }

  /** Suchen — in Titel, Schlüssel und allen Textfeldern, ohne Rücksicht auf Akzente. */
  search(query: string, kinds?: readonly string[]): Entry[] {
    if (this.searchIndex === null) {
      const index = new Map<string, string>();
      for (const entry of this.entries.values()) {
        const parts = [this.title(entry), entry.key ?? ''];
        for (const value of Object.values(entry.data)) if (typeof value === 'string') parts.push(value);
        if (entry.kind === 'quote') parts.push(originOf(entry, this));
        if (entry.kind === 'work') for (const id of fieldRefs(entry)) { const p = this.get(id); if (p !== undefined) parts.push(this.title(p)); }
        index.set(entry.id, fold(parts.join(' ')));
      }
      this.searchIndex = index;
    }
    const words = fold(query).split(/\s+/).filter(Boolean);
    return this.all().filter((entry) => (kinds === undefined || kinds.includes(entry.kind))
      && words.every((w) => (this.searchIndex!.get(entry.id) ?? '').includes(w)));
  }

  /* -- Abgleich --------------------------------------------------------------------------- */

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private changed(): void {
    this.revision += 1;
    this.backIndex = null;
    this.searchIndex = null;
    for (const listener of this.listeners) listener();
  }

  private put(entry: Entry): void {
    const before = this.entries.get(entry.id);
    if (before?.key !== undefined && this.keys.get(before.key.toLowerCase()) === entry.id) this.keys.delete(before.key.toLowerCase());
    this.entries.set(entry.id, entry);
    if (entry.key !== undefined) this.keys.set(entry.key.toLowerCase(), entry.id);
  }

  private drop(id: string): void {
    const before = this.entries.get(id);
    if (before?.key !== undefined && this.keys.get(before.key.toLowerCase()) === id) this.keys.delete(before.key.toLowerCase());
    this.entries.delete(id);
  }

  private async keysFor(epochs: Iterable<number>): Promise<ReadonlyMap<number, Uint8Array>> {
    let keys = await areaKeys(this.ring, this.areaId);
    if ([...epochs].some((e) => !keys.has(e))) keys = await areaKeys(this.ring, this.areaId, true);
    return keys;
  }

  private async absorb(rows: readonly SealedEntry[]): Promise<void> {
    const keys = await this.keysFor(rows.filter((r) => r.sealed !== null).map((r) => r.epoch));
    let unreadable = 0;
    for (const row of rows) {
      if (row.deletedAt !== null) { this.drop(row.entryId); continue; }
      const doc = await openEntry(keys, row);
      if (doc === null) { unreadable += 1; continue; }
      this.put({
        id: doc.id, kind: doc.kind, ...(doc.key === undefined ? {} : { key: doc.key }), data: doc.data,
        version: row.version, epoch: row.epoch, createdAt: row.createdAt, updatedAt: row.updatedAt,
        publishedAt: row.publishedAt, publishedAs: row.publishedAs
      });
    }
    this.unreadable = this.since === null ? unreadable : this.unreadable + unreadable;
  }

  /** Holen, was sich geändert hat — beim ersten Mal alles. Gleichzeitige Aufrufe teilen sich einen Gang. */
  sync(): Promise<void> {
    if (this.syncing !== null) return this.syncing;
    this.syncing = (async () => {
      try {
        const { now, entries } = await loadEntries(this.libraryId, this.since);
        await this.absorb(entries);
        this.since = now;
        this.loaded = true;
        this.changed();
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  /* -- Schreiben -------------------------------------------------------------------------- */

  /** Ein Schlüssel für diesen Eintrag: der gewünschte, sonst ein Vorschlag — eindeutig in der Bibliothek. */
  keyFor(entry: LibEntry, wanted?: string): string | undefined {
    if (kindOf(entry.kind)?.keyed !== true) return undefined;
    const base = (wanted ?? '').trim() !== '' ? wanted!.trim() : suggestKey(entry, this);
    return uniqueKey(base, (key) => this.keyTaken(key, entry.id));
  }

  /**
   * SPEICHERN — versiegelt unter dem jüngsten Schlüssel des Bereichs. Hat
   * inzwischen jemand anderes geändert, lehnt der Dienst ab (`stale`); dann
   * wird abgeglichen, und der Editor zeigt den neueren Stand.
   */
  async save(input: { readonly id?: string; readonly kind: string; readonly key?: string; readonly data: EntryData }): Promise<Entry> {
    const id = input.id ?? newId();
    const before = this.entries.get(id);
    const data = cleanData(input.data);
    const key = this.keyFor({ id, kind: input.kind, data }, input.key ?? before?.key);
    const doc: EntryDoc = { v: 1, id, kind: input.kind, ...(key === undefined ? {} : { key }), data };

    const newest = newestKey(await areaKeys(this.ring, this.areaId, true));
    if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');

    try {
      const done = await putEntry(this.libraryId, id, {
        kind: input.kind, epoch: newest.epoch, sealed: await sealEntry(newest.key, doc), version: before?.version ?? 0
      });
      const entry: Entry = {
        id, kind: input.kind, ...(key === undefined ? {} : { key }), data,
        version: done.version, epoch: newest.epoch, createdAt: before?.createdAt ?? done.updatedAt, updatedAt: done.updatedAt,
        publishedAt: before?.publishedAt ?? null, publishedAs: before?.publishedAs ?? null
      };
      this.put(entry);
      this.changed();
      return entry;
    } catch (e) {
      if (e instanceof WorkspaceError && e.verdict === 'stale') await this.sync().catch(() => undefined);
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    const entry = this.entries.get(id);
    await removeEntry(this.libraryId, id);
    this.drop(id);
    this.changed();
    /* Was nur für ihn draussen stand, geht mit. */
    if (entry?.publishedAs !== null && entry !== undefined) await this.apply(plan(this.all(), this, {})).catch(() => undefined);
  }

  /* -- Öffentlich ------------------------------------------------------------------------ */

  planFor(change: { add?: readonly string[]; remove?: readonly string[]; refresh?: readonly string[] }): PublishPlan {
    return plan(this.all(), this, change);
  }

  /** Einen Plan ausführen — in Stücken, die der Dienst annimmt (höchstens ~3 MB je Gang). */
  async apply(next: PublishPlan): Promise<void> {
    if (next.publish.length === 0 && next.unpublish.length === 0) return;
    const gone = new Set(next.unpublish);
    const after = new Set([...this.all().filter((e) => e.publishedAs !== null).map((e) => e.id), ...next.publish.map((p) => p.id)]
      .filter((id) => !gone.has(id)));
    const docs = next.publish
      .filter((p) => this.entries.has(p.id))
      .map((p) => publicEntry(this.entries.get(p.id)!, p.as, this, (id) => after.has(id)));

    const chunks: (typeof docs)[] = [[]];
    let size = 0;
    for (const doc of docs) {
      const weight = doc.json.length + doc.summary.length;
      if (chunks[chunks.length - 1].length > 0 && (size + weight > 3_000_000 || chunks[chunks.length - 1].length >= 400)) { chunks.push([]); size = 0; }
      chunks[chunks.length - 1].push(doc);
      size += weight;
    }

    let at = new Date().toISOString();
    for (const [index, chunk] of chunks.entries()) {
      const done = await publishEntries(this.libraryId, chunk, index === 0 ? next.unpublish : []);
      at = done.at;
    }

    for (const p of next.publish) {
      const entry = this.entries.get(p.id);
      if (entry !== undefined) this.put({ ...entry, publishedAs: p.as, publishedAt: entry.publishedAt ?? at });
    }
    for (const id of next.unpublish) {
      const entry = this.entries.get(id);
      if (entry !== undefined) this.put({ ...entry, publishedAs: null, publishedAt: null });
    }
    this.changed();
  }

  publish(ids: readonly string[]): Promise<void> { return this.apply(this.planFor({ add: ids })); }
  unpublish(ids: readonly string[]): Promise<void> { return this.apply(this.planFor({ remove: ids })); }
  refresh(ids: readonly string[]): Promise<void> {
    return this.apply(this.planFor({ refresh: ids.filter((id) => this.entries.get(id)?.publishedAs != null) }));
  }

  /** Steht draussen dasselbe wie hier? `null`: nicht veröffentlicht. */
  async publicIsCurrent(id: string): Promise<boolean | null> {
    const entry = this.entries.get(id);
    if (entry === undefined || entry.publishedAs === null) return null;
    try {
      const { entry: there } = await loadPublishedOne(this.libraryId, id);
      const published = new Set(this.all().filter((e) => e.publishedAs !== null).map((e) => e.id));
      const here = publicEntry(entry, entry.publishedAs, this, (one) => published.has(one));
      return there.json === here.json;
    } catch {
      return false;
    }
  }
}

/* -- Ein Speicher je Bibliothek und Tab ------------------------------------------------------ */

const stores = new Map<string, LibraryStore>();

export function storeOf(ring: Ring, library: Pick<LibraryRow, 'libraryId' | 'areaId'>): LibraryStore {
  let store = stores.get(library.libraryId);
  if (store === undefined) {
    store = new LibraryStore(ring, library);
    stores.set(library.libraryId, store);
  }
  return store;
}

/** Den Speicher abonnieren — und beim ersten Mal (und bei jedem Öffnen) abgleichen. */
export function useLibraryStore(ring: Ring | null, library: Pick<LibraryRow, 'libraryId' | 'areaId'> | null): {
  readonly store: LibraryStore | null;
  readonly revision: number;
  readonly failed: string | null;
} {
  const store = ring === null || library === null ? null : storeOf(ring, library);
  const [revision, setRevision] = useState(store?.revision ?? 0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (store === null) return undefined;
    const off = store.subscribe(() => setRevision(store.revision));
    let alive = true;
    store.sync().then(() => { if (alive) setFailed(null); }, (e: unknown) => {
      if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać biblioteki.');
    });
    const again = () => { if (document.visibilityState === 'visible') void store.sync().catch(() => undefined); };
    document.addEventListener('visibilitychange', again);
    return () => { alive = false; off(); document.removeEventListener('visibilitychange', again); };
  }, [store]);

  return { store, revision, failed };
}

export type { PublishedAs };
