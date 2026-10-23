/**
 * DIE BIBLIOTHEK (0064) — der Weg zum Dienst und die Hüllen.
 *
 * Ein Eintrag geht als EIN versiegeltes Dokument hinaus (`EntryDoc`), unter
 * dem jüngsten Schlüssel des Bereichs, dem die Bibliothek gehört; die AAD
 * nennt seine Kennung, das Dokument selbst noch einmal Kennung und Art —
 * eine Hülle lässt sich so weder an einen anderen Platz noch in eine andere
 * Art schieben, ohne dass das Öffnen es merkt.
 *
 * Wer liest, entscheidet der Bereich (2026-10-22): Mitglieder über
 * `/workspace/library/…/entries`, jeder andere über `/library/{id}/open` —
 * dieselben Hüllen, geöffnet mit dem offengelegten Schlüssel des Bereichs.
 * 2026-10-22 (Schritt 8) ebenso jede Baza wiedzy: offene Fassungen entstehen
 * nicht mehr; alte werden nur noch zurückgezogen (`withdrawEntries`).
 */

import { areaKeys, newestKey } from '../chat/chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import type { EntryData } from './libraryKinds';
import { call, WorkspaceError } from '../core/session';

/* -- Bibliotheken --------------------------------------------------------------------- */

/** Wie ein Eintrag früher hinausging (ausdrücklich oder mitgezogen) — nur noch, um alte offene Fassungen zurückzuziehen. */
export type PublishedAs = 'explicit' | 'implicit';

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
  /** 2026-10-22 — ob jeder liest (der Bereich ist öffentlich); ein älterer Dienst schickt es nicht. */
  readonly areaPublic?: boolean;
  /** 0122 — wann die Umstellung auf die Regel des Bereichs durchgesehen wurde; `null`: noch nicht. */
  readonly areaRuleAt?: string | null;
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

/** 2026-10-23 — viele auf einmal (höchstens 500 je Aufruf): ausdrücklich gewählt und bestätigt. */
export const removeEntries = (libraryId: string, ids: readonly string[]): Promise<{ deleted: number }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/entries/remove`, { method: 'POST', body: JSON.stringify({ ids }) });

/** 2026-10-22 — einen Eintrag in die Bibliothek eines anderen Bereichs tragen: dieselbe Kennung, neu versiegelt. */
export const moveEntry = (
  libraryId: string, entryId: string, body: { toLibrary: string; kind: string; epoch: number; sealed: string; version: number }
): Promise<{ entryId: string; libraryId: string; version: number; updatedAt: string }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/entry/${encodeURIComponent(entryId)}/move`, {
    method: 'POST', body: JSON.stringify(body)
  });

/** 0122 — die Umstellung dieser Bibliothek ist durchgesehen; erst dann liest ein öffentlicher Bereich sie offen. */
export const settleLibrary = (libraryId: string): Promise<{ areaRuleAt: string }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/area-rule`, { method: 'POST' });

/** 2026-10-22 (Schritt 8) — alte offene Fassungen zurückziehen; hinaus geht nichts mehr (der Dienst nimmt nur das an). */
export const withdrawEntries = (libraryId: string, ids: readonly string[]): Promise<{ unpublished: number; at: string }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/publish`, {
    method: 'POST', body: JSON.stringify({ publish: [], unpublish: ids })
  });

/* -- Öffentlich ------------------------------------------------------------------------------ */

/** 2026-10-22 — eine Bibliothek eines öffentlichen Bereichs, ohne Konto: alle Hüllen. */
export interface OpenRead {
  readonly now: string;
  readonly libraryId: string;
  readonly areaId: string;
  readonly nameSealed: string;
  readonly nameEpoch: number;
  readonly entries: readonly SealedEntry[];
}

export const loadOpen = (libraryId: string, since: string | null): Promise<OpenRead> =>
  call(`/library/${encodeURIComponent(libraryId)}/open${since === null ? '' : `?since=${encodeURIComponent(since)}`}`);

/** Wo diese Einträge liegen — nur die, die dieser Browser lesen darf; die anderen fehlen in der Antwort. */
export const libraryWhere = (ids: readonly string[]): Promise<{ found: readonly { entryId: string; libraryId: string }[] }> =>
  call(`/library/where?ids=${encodeURIComponent(ids.join(','))}`);

/** Der offengelegte Schlüssel einer bestimmten Epoche (`/area/{id}/key?epoch=`). */
export const loadPublicKeyAt = (areaId: string, epoch: number): Promise<{ areaId: string; epoch: number; key: string }> =>
  call(`/area/${encodeURIComponent(areaId)}/key?epoch=${epoch}`);

/** Den Namen einer offenen Bibliothek lesen. */
export async function openLibraryName(key: Uint8Array | undefined, libraryId: string, nameSealed: string): Promise<string> {
  if (key === undefined) return 'Biblioteka';
  try {
    return await openText(key, nameAad(libraryId), fromBase64Url(nameSealed));
  } catch {
    return 'Biblioteka';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);
