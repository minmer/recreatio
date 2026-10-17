/**
 * COGITA — DIE FASSUNGEN EINES EINTRAGS [N9]: jedes Speichern lässt die
 * vorige Hülle beim Dienst stehen. Hier werden sie geholt und geöffnet;
 * Wiederherstellen heisst, eine alte Fassung als neue zu speichern.
 */

import { openEntry, type EntryDoc } from '../library/library';
import { call } from '../core/session';

export interface VersionRow {
  readonly version: number;
  readonly kind: string;
  readonly epoch: number;
  readonly writtenAt: string;
  readonly byMe: boolean;
  readonly size: number;
}

export const loadVersions = (libraryId: string, entryId: string): Promise<{ versions: readonly VersionRow[] }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/entry/${encodeURIComponent(entryId)}/versions`);

export async function openVersion(libraryId: string, entryId: string, version: number, keys: ReadonlyMap<number, Uint8Array>): Promise<EntryDoc | null> {
  const row = await call<{ kind: string; epoch: number; sealed: string; writtenAt: string }>(
    `/workspace/library/${encodeURIComponent(libraryId)}/entry/${encodeURIComponent(entryId)}/version/${version}`);
  return openEntry(keys, {
    entryId, kind: row.kind, epoch: row.epoch, sealed: row.sealed, version,
    createdAt: row.writtenAt, updatedAt: row.writtenAt, deletedAt: null, publishedAt: null, publishedAs: null
  });
}
