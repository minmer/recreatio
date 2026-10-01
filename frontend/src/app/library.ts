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

import { areaKeys, newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { newId } from './ids';
import type { Ring } from './keys';
import type { EntryData } from './libraryKinds';
import type { PublicEntryIn, PublishedAs } from './libraryPublish';
import { call, WorkspaceError } from './session';

/* -- Bibliotheken --------------------------------------------------------------------- */

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
}

export interface OpenLibrary extends LibraryRow {
  readonly name: string;
}

const nameAad = (libraryId: string) => aad('library', 'library', libraryId, Field.LibraryName, 1);
const entryAad = (entryId: string) => aad('library', 'entry', entryId, Field.LibraryEntry, 1);

export const loadLibraries = (): Promise<{ libraries: readonly LibraryRow[] }> => call('/workspace/libraries');

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
  }
  return out;
}

async function newest(ring: Ring, areaId: string): Promise<{ epoch: number; key: Uint8Array }> {
  const found = newestKey(await areaKeys(ring, areaId, true));
  if (found === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
  return found;
}

export async function createLibrary(ring: Ring, areaId: string, name: string): Promise<string> {
  const libraryId = newId();
  const { epoch, key } = await newest(ring, areaId);
  await call('/workspace/libraries', {
    method: 'POST',
    body: JSON.stringify({ libraryId, areaId, epoch, nameSealed: toBase64Url(await sealText(key, nameAad(libraryId), name.trim() || 'Biblioteka')) })
  });
  return libraryId;
}

export async function renameLibrary(ring: Ring, library: LibraryRow, name: string): Promise<void> {
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
