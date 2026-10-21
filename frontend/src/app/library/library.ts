/**
 * DIE BIBLIOTHEK (0064) — der Weg zum Dienst und die Hüllen.
 *
 * Ein Eintrag geht als EIN versiegeltes Dokument hinaus (`EntryDoc`), unter
 * dem jüngsten Schlüssel des Bereichs, dem die Bibliothek gehört; die AAD
 * nennt seine Kennung, das Dokument selbst noch einmal Kennung und Art —
 * eine Hülle lässt sich so weder an einen anderen Platz noch in eine andere
 * Art schieben, ohne dass das Öffnen es merkt.
 *
 * Die offenen Fassungen (Veröffentlichung) baut `libraryPublish.ts`; hier
 * werden sie nur verschickt. Öffentlich lesen geht ohne Konto.
 */

import { areaKeys, newestKey } from '../chat/chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import type { EntryData } from './libraryKinds';
import type { PublicEntryIn, PublishedAs } from './libraryPublish';
import { call, WorkspaceError } from '../core/session';

/* -- Bibliotheken --------------------------------------------------------------------- */

/**
 * 0110 — ZWEI STRUKTUREN NEBENEINANDER, EIN SPEICHER: `books` ist die
 * Bibliothek (eine Sammlung von Büchern — Werke, Zitate, Texte, Personen,
 * Themen), `knowledge` eine Baza wiedzy für Cogita (Arten, Wissen, Fragen,
 * Vorlagen, Wiederholungen, Abläufe). Sie verweist auf Bibliotheken und andere
 * Bazy wiedzy, auch in anderen Bereichen (`cogita/sources.ts`).
 */
export type LibraryKind = 'books' | 'knowledge';

export interface LibraryRow {
  readonly libraryId: string;
  readonly areaId: string;
  readonly epoch: number;
  readonly nameSealed: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly entries: number;
  readonly published: number;
  readonly writes: boolean;
  /** 0110 — Bibliothek (`books`) oder Baza wiedzy (`knowledge`). */
  readonly kind: LibraryKind;
}

export const libraryKindOf = (row: { readonly kind?: string | null }): LibraryKind => (row.kind === 'knowledge' ? 'knowledge' : 'books');

export interface OpenLibrary extends LibraryRow {
  readonly name: string;
}

const nameAad = (libraryId: string) => aad('library', 'library', libraryId, Field.LibraryName, 1);
const entryAad = (entryId: string) => aad('library', 'entry', entryId, Field.LibraryEntry, 1);

export const loadLibraries = (): Promise<{ libraries: readonly LibraryRow[] }> => call('/workspace/libraries');

/** 0109 — die Namen, die dieser Tab schon geöffnet hat (für die Suche, Ctrl K); nur im Speicher. */
const openedNames = new Map<string, string>();
const openedKinds = new Map<string, LibraryKind>();
export const openedLibraryNames = (): ReadonlyMap<string, string> => openedNames;
/** 0110 — ob eine geöffnete Bibliothek eine Bibliothek ist oder eine Baza wiedzy (für die Wege der Suche). */
export const openedLibraryKind = (libraryId: string): LibraryKind | undefined => openedKinds.get(libraryId);
export const forgetLibraryNames = (): void => { openedNames.clear(); openedKinds.clear(); };

export async function openLibraries(ring: Ring, rows: readonly LibraryRow[]): Promise<OpenLibrary[]> {
  const out: OpenLibrary[] = [];
  for (const row of rows) {
    let name = 'Biblioteka';
    try {
      const key = (await areaKeys(ring, row.areaId)).get(row.epoch);
      if (key !== undefined) name = await openText(key, nameAad(row.libraryId), fromBase64Url(row.nameSealed));
    } catch {
      // Nicht lesbar — die Bibliothek steht trotzdem da, ohne Namen.
    }
    out.push({ ...row, name });
    openedNames.set(row.libraryId, name);
    openedKinds.set(row.libraryId, libraryKindOf(row));
  }
  return out;
}

async function newest(ring: Ring, areaId: string): Promise<{ epoch: number; key: Uint8Array }> {
  const found = newestKey(await areaKeys(ring, areaId, true));
  if (found === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
  return found;
}

export async function createLibrary(ring: Ring, areaId: string, name: string, kind: LibraryKind = 'books'): Promise<string> {
  const libraryId = newId();
  const { epoch, key } = await newest(ring, areaId);
  const fallback = kind === 'knowledge' ? 'Baza wiedzy' : 'Biblioteka';
  await call('/workspace/libraries', {
    method: 'POST',
    body: JSON.stringify({ libraryId, areaId, epoch, kind, nameSealed: toBase64Url(await sealText(key, nameAad(libraryId), name.trim() || fallback)) })
  });
  return libraryId;
}

export async function renameLibrary(ring: Ring, library: Pick<LibraryRow, 'libraryId' | 'areaId'>, name: string): Promise<void> {
  const { epoch, key } = await newest(ring, library.areaId);
  await call(`/workspace/library/${encodeURIComponent(library.libraryId)}`, {
    method: 'POST',
    body: JSON.stringify({ epoch, nameSealed: toBase64Url(await sealText(key, nameAad(library.libraryId), name.trim() || 'Biblioteka')) })
  });
}

export const deleteLibrary = (libraryId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}`, { method: 'DELETE' });

/* -- Einträge ------------------------------------------------------------------------------- */

export interface SealedEntry {
  readonly entryId: string;
  readonly kind: string;
  readonly epoch: number;
  readonly sealed: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly publishedAt: string | null;
  readonly publishedAs: PublishedAs | null;
}

/** Was in der Hülle steht. */
export interface EntryDoc {
  readonly v: 1;
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
}

export const loadEntries = (libraryId: string, since: string | null): Promise<{ now: string; entries: readonly SealedEntry[] }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/entries${since === null ? '' : `?since=${encodeURIComponent(since)}`}`);

/** 0109 — dieselben Wege für einen Platz: seine Bibliothek (ihr Bereich, ihr versiegelter Name) und ihre Hüllen. */
export const loadSeatLibrary = (token: string, libraryId: string): Promise<LibraryRow> =>
  call(`/seat/${encodeURIComponent(token)}/library/${encodeURIComponent(libraryId)}`);

export const loadSeatEntries = (token: string, libraryId: string, since: string | null): Promise<{ now: string; entries: readonly SealedEntry[] }> =>
  call(`/seat/${encodeURIComponent(token)}/library/${encodeURIComponent(libraryId)}/entries${since === null ? '' : `?since=${encodeURIComponent(since)}`}`);

/** 0109 — den Namen mit einem Schlüssel öffnen, der nicht aus einem Bund kommt (ein Platz). */
export async function libraryNameWith(key: Uint8Array, row: Pick<LibraryRow, 'libraryId' | 'nameSealed'>): Promise<string> {
  try {
    return await openText(key, nameAad(row.libraryId), fromBase64Url(row.nameSealed));
  } catch {
    return 'Biblioteka';
  }
}

export async function sealEntry(key: Uint8Array, doc: EntryDoc): Promise<string> {
  return toBase64Url(await sealText(key, entryAad(doc.id), JSON.stringify(doc)));
}

/** Eine Hülle öffnen — `null`, wenn der Schlüssel fehlt oder sie nicht zu ihrem Platz passt. */
export async function openEntry(keys: ReadonlyMap<number, Uint8Array>, row: SealedEntry): Promise<EntryDoc | null> {
  if (row.sealed === null) return null;
  const key = keys.get(row.epoch);
  if (key === undefined) return null;
  try {
    const doc = JSON.parse(await openText(key, entryAad(row.entryId), fromBase64Url(row.sealed))) as Partial<EntryDoc>;
    if (doc.id !== row.entryId || doc.kind !== row.kind || typeof doc.data !== 'object' || doc.data === null) return null;
    return { v: 1, id: doc.id, kind: doc.kind, ...(typeof doc.key === 'string' && doc.key !== '' ? { key: doc.key } : {}), data: doc.data };
  } catch {
    return null;
  }
}

export const putEntry = (
  libraryId: string, entryId: string, body: { kind: string; epoch: number; sealed: string; version: number }
): Promise<{ entryId: string; version: number; updatedAt: string }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/entry/${encodeURIComponent(entryId)}`, {
    method: 'PUT', body: JSON.stringify(body)
  });

export const removeEntry = (libraryId: string, entryId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/entry/${encodeURIComponent(entryId)}`, { method: 'DELETE' });

export const publishEntries = (
  libraryId: string, publish: readonly PublicEntryIn[], unpublish: readonly string[]
): Promise<{ published: number; unpublished: number; at: string }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/publish`, {
    method: 'POST', body: JSON.stringify({ publish, unpublish })
  });

/* -- Öffentlich ------------------------------------------------------------------------------ */

export interface PublishedItem {
  readonly entryId: string;
  readonly kind: string;
  readonly key: string | null;
  readonly sort: string | null;
  readonly summary: string | null;
  readonly publishedAt: string;
  readonly publishedAs: PublishedAs;
}

export interface PublishedEntry {
  readonly entryId: string;
  readonly kind: string;
  readonly key: string | null;
  readonly sort: string | null;
  readonly json: string;
  readonly publishedAt: string;
  readonly publishedAs: PublishedAs;
}

export interface PublishedQuery {
  readonly kind?: string;
  readonly ref?: string;
  readonly q?: string;
  readonly order?: 'sort' | '-sort';
  readonly explicitOnly?: boolean;
  readonly take?: number;
  readonly skip?: number;
}

export function loadPublished(libraryId: string, query: PublishedQuery): Promise<{ total: number; items: readonly PublishedItem[] }> {
  const params = new URLSearchParams();
  if (query.kind !== undefined) params.set('kind', query.kind);
  if (query.ref !== undefined && query.ref !== '') params.set('ref', query.ref);
  if (query.q !== undefined && query.q.trim() !== '') params.set('q', query.q.trim());
  if (query.order !== undefined) params.set('order', query.order);
  if (query.explicitOnly === true) params.set('explicitOnly', 'true');
  if (query.take !== undefined) params.set('take', String(query.take));
  if (query.skip !== undefined) params.set('skip', String(query.skip));
  return call(`/library/${encodeURIComponent(libraryId)}/published?${params.toString()}`);
}

export const loadPublishedOne = (libraryId: string, entryId: string): Promise<{ entry: PublishedEntry; refs: readonly PublishedEntry[] }> =>
  call(`/library/${encodeURIComponent(libraryId)}/published/${encodeURIComponent(entryId)}`);

/* -- 2026-10-21: das Archiv durchsuchen ----------------------------------------------------- */

export interface BrowseQuery {
  readonly kind?: string;
  /** Die Filter: innerhalb einer Gruppe ODER, zwischen den Gruppen UND. */
  readonly groups?: readonly (readonly string[])[];
  readonly q?: string;
  readonly order?: 'sort' | '-sort' | 'key' | '-key';
  readonly take?: number;
  readonly skip?: number;
  /** Auch zählen, wie viele der gefundenen auf jedes Ziel zeigen (die Zahlen im Baum). */
  readonly counts?: boolean;
}

export interface BrowseResult {
  readonly total: number;
  readonly items: readonly PublishedItem[];
  /** Je Ziel (Thema, Projekt) die Zahl der gefundenen — `null`: der Dienst kann es noch nicht. */
  readonly counts: ReadonlyMap<string, number> | null;
  /** Ob alle Filter gegriffen haben — ein älterer Dienst nimmt nur einen. */
  readonly exact: boolean;
}

/** Bibliotheken, deren Dienst `/published/browse` noch nicht kennt — einmal gemerkt, nicht bei jeder Anfrage neu versucht. */
const withoutBrowse = new Set<string>();

/**
 * DAS ARCHIV DURCHSUCHEN — mehrere Filter zugleich, mit Zahlen je Thema.
 * Kennt der Dienst den Weg noch nicht (die Seite kam vor ihm hinaus), geht
 * es über die einfache Liste: nur der zuletzt gewählte Filter, ohne Zahlen.
 */
export async function browsePublished(libraryId: string, query: BrowseQuery): Promise<BrowseResult> {
  const groups = (query.groups ?? []).map((group) => group.filter((one) => one !== '')).filter((group) => group.length > 0);
  if (!withoutBrowse.has(libraryId)) {
    const params = new URLSearchParams();
    if (query.kind !== undefined) params.set('kind', query.kind);
    for (const group of groups) params.append('ref', group.join(','));
    if (query.q !== undefined && query.q.trim() !== '') params.set('q', query.q.trim());
    if (query.order !== undefined) params.set('order', query.order);
    if (query.take !== undefined) params.set('take', String(query.take));
    if (query.skip !== undefined) params.set('skip', String(query.skip));
    if (query.counts === true) params.set('counts', 'true');
    try {
      const found = await call<{ total: number; items: PublishedItem[]; counts?: { id: string; n: number }[] | null }>(
        `/library/${encodeURIComponent(libraryId)}/published/browse?${params.toString()}`);
      return { total: found.total, items: found.items, counts: found.counts == null ? null : new Map(found.counts.map((c) => [c.id, c.n])), exact: true };
    } catch (e) {
      /* Ein Dienst ohne diesen Weg antwortet 404 ohne Text („Nie udało się."); jeder andere Fehler bleibt einer. */
      if (!(e instanceof WorkspaceError) || e.message !== 'Nie udało się.') throw e;
      withoutBrowse.add(libraryId);
    }
  }
  const last = groups[groups.length - 1];
  const order = query.order === 'key' ? 'sort' : query.order === '-key' ? '-sort' : query.order;
  const found = await loadPublished(libraryId, {
    ...(query.kind === undefined ? {} : { kind: query.kind }), ...(last === undefined ? {} : { ref: last[0] }),
    ...(query.q === undefined ? {} : { q: query.q }), ...(order === undefined ? {} : { order }),
    ...(query.take === undefined ? {} : { take: query.take }), ...(query.skip === undefined ? {} : { skip: query.skip })
  });
  return { total: found.total, items: found.items, counts: null, exact: groups.length <= 1 && (last?.length ?? 0) <= 1 };
}

/** Bis zu `max` veröffentlichte Einträge einer Art — der Dienst gibt höchstens 200 auf einmal. */
export async function loadPublishedAll(libraryId: string, query: PublishedQuery, max = 2000): Promise<PublishedItem[]> {
  const out: PublishedItem[] = [];
  while (out.length < max) {
    const page = await loadPublished(libraryId, { ...query, take: 200, skip: out.length });
    out.push(...page.items);
    if (page.items.length < 200 || out.length >= page.total) break;
  }
  return out;
}

/** Eine Kurzfassung lesen — duldsam: eine kaputte Zeile ist eine leere. */
export function summaryOf(item: { readonly summary: string | null }): Record<string, unknown> {
  if (item.summary === null) return {};
  try {
    const parsed: unknown = JSON.parse(item.summary);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);
