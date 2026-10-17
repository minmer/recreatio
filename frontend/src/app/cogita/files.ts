/**
 * COGITA — DATEIEN DER BIBLIOTHEK (COGITA.md §8, [G10, F31]): Erzählton,
 * Bilder, Filme, Dokumente.
 *
 * Versiegelt im Browser unter dem jüngsten Schlüssel des Bereichs — wie jeder
 * Eintrag —, beim Dienst nur als Hülle mit Grösse. Ein Eintrag zeigt auf eine
 * Datei mit `{file, type, name, mime}` (Feldtyp `media`). Wer einen Kurs
 * veröffentlicht, stellt die Dateien, die er zeigt, OFFEN daneben: ein Besucher
 * ohne Konto hat keinen Schlüssel.
 */

import { aad, Field, open, seal } from '../core/crypto';
import { newId } from '../core/ids';
import { heldProofs } from '../links/linkAccess';
import { API, call, LINKS_HEADER, WorkspaceError } from '../core/session';
import type { MediaRef, MediaType } from './schema';

const MAX = 50 * 1024 * 1024;

const fileAad = (fileId: string) => aad('library', 'file', fileId, Field.LibraryFile, 1);

export const mediaTypeOf = (mime: string): MediaType =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'document';

export interface FileRow {
  readonly fileId: string;
  readonly epoch: number;
  readonly size: number;
  readonly createdAt: string;
  readonly publicSize: number | null;
  readonly publicType: string | null;
  readonly publicAt: string | null;
}

export const loadFiles = (libraryId: string): Promise<{ files: readonly FileRow[]; total: number; quota: number }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/files`);

/** Eine Datei versiegeln und hinauf — gibt den Verweis zurück, der in ein Feld gehört. */
export async function uploadFile(libraryId: string, newest: { epoch: number; key: Uint8Array }, file: File): Promise<MediaRef> {
  if (file.size > MAX - 64) throw new WorkspaceError('Plik może mieć najwyżej 50 MB.');
  const fileId = newId();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sealed = await seal(newest.key, fileAad(fileId), bytes);
  await call(`/workspace/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(fileId)}?epoch=${newest.epoch}`, {
    method: 'PUT', body: new Blob([sealed as BlobPart])
  }, { 'Content-Type': 'application/octet-stream' });
  const mime = file.type || 'application/octet-stream';
  /* 0110 — der Verweis weiss, wo die Datei liegt: eine Baza wiedzy, die diesen Eintrag wiederverwendet, holt sie von dort. */
  return { file: fileId, type: mediaTypeOf(mime), name: file.name.slice(0, 200), mime, library: libraryId };
}

export const removeFile = (libraryId: string, fileId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(fileId)}`, { method: 'DELETE' });

const opened = new Map<string, Promise<string | null>>();

/** Die Epochen, deren Schlüssel dieser Browser hält — ab der ersten, bis eine fehlt; die jüngste zuerst. */
async function heldEpochs(keyOf: (epoch: number) => Promise<Uint8Array | undefined>): Promise<number[]> {
  const out: number[] = [];
  for (let epoch = 1; epoch <= 32 && (await keyOf(epoch)) !== undefined; epoch += 1) out.push(epoch);
  return out.reverse();
}

/**
 * Eine Datei öffnen — als `blob:`-Adresse für `<img>`, `<audio>`, `<video>`.
 * `keyOf`: der Schlüssel einer Epoche des Bereichs (Konto, Link oder Platz).
 * `seat`: über einen Platz holen. Einmal je Tab und Datei.
 */
export function fileUrl(libraryId: string, ref: MediaRef, keyOf: (epoch: number) => Promise<Uint8Array | undefined>, seat?: string): Promise<string | null> {
  const slot = `${libraryId}:${ref.file}`;
  let found = opened.get(slot);
  if (found === undefined) {
    found = (async () => {
      const path = seat === undefined
        ? `/workspace/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(ref.file)}`
        : `/seat/${encodeURIComponent(seat)}/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(ref.file)}`;
      const links = seat === undefined ? await heldProofs().catch(() => [] as string[]) : [];
      const response = await fetch(`${API}${path}`, { credentials: 'include', headers: links.length > 0 ? { [LINKS_HEADER]: links.join(',') } : {} });
      if (!response.ok) return null;
      /*
        2026-10-17 — `X-Epoch` sieht der Browser über Herkünfte hinweg (recreatio.pl
        → api.recreatio.pl) nur, wenn der Dienst die Kopfzeile freigibt
        (Program.cs, `WithExposedHeaders`). Ein Dienst ohne die Freigabe liefert
        `null`: dann die gehaltenen Schlüssel der Reihe nach, der jüngste zuerst.
      */
      const header = response.headers.get('X-Epoch');
      const sealed = new Uint8Array(await response.arrayBuffer());
      for (const epoch of header !== null ? [Number(header)] : await heldEpochs(keyOf)) {
        const key = await keyOf(epoch);
        if (key === undefined) continue;
        const plain = await open(key, fileAad(ref.file), sealed).catch(() => null);
        if (plain !== null) return URL.createObjectURL(new Blob([plain as BlobPart], { type: ref.mime ?? '' }));
      }
      return null;
    })().catch(() => null);
    opened.set(slot, found);
    found.then((url) => { if (url === null) opened.delete(slot); }, () => opened.delete(slot));
  }
  return found;
}

/** Die offene Fassung hinausstellen (ein veröffentlichter Kurs zeigt sie). */
export async function publishFile(libraryId: string, ref: MediaRef, plainUrl: string): Promise<void> {
  const mime = ref.mime ?? '';
  const bytes = new Uint8Array(await (await fetch(plainUrl)).arrayBuffer());
  await call(`/workspace/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(ref.file)}/public?type=${encodeURIComponent(mime)}`, {
    method: 'PUT', body: new Blob([bytes as BlobPart])
  }, { 'Content-Type': mime || 'application/octet-stream' });
}

export const unpublishFile = (libraryId: string, fileId: string): Promise<{ unpublished: boolean }> =>
  call(`/workspace/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(fileId)}/public`, { method: 'DELETE' });

/** Wo die offene Fassung liegt — ohne Konto. */
export const publicFileUrl = (libraryId: string, fileId: string): string =>
  `${API}/library/${encodeURIComponent(libraryId)}/file/${encodeURIComponent(fileId)}`;
