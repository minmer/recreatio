/**
 * BILDER UND DATEIEN EINER SEITE (0062, 0063) — hochladen, auflisten, wegnehmen.
 *
 * Öffentlich wie die Seite: ein Hintergrund wird jedem gezeigt, der sie öffnet
 * (`PageImage.cs`). In einer Schicht steht er als `page-image:<id>` — die
 * Adresse des Dienstes setzt erst die Anzeige davor (`slides.imageUrl`), damit
 * dieselbe Seite in der Entwicklung und im Betrieb auf ihren Dienst zeigt.
 *
 * <b>0063 — auch Dateien.</b> Das Regulamin als PDF, Dokumente, ein GPX-Track:
 * dieselbe Ablage, dieselbe Schreibweise (`page-image:<id>`), nur dass der
 * Dienst sie als Download ausliefert.
 */

import { API, call, WorkspaceError } from './session';

export interface PageImageRow {
  readonly id: string;
  readonly contentType: string;
  readonly size: number;
  readonly name: string | null;
  readonly createdAt: string;
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** 0063 — Dokumente und Tracks; der Dienst hat dieselbe Liste (`PageImage.Documents`). */
export const FILE_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  gpx: 'application/gpx+xml'
};
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Was im Dateidialog angeboten wird. */
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((ext) => `.${ext}`).join(',');

export const isImageType = (type: string): boolean => (IMAGE_TYPES as readonly string[]).includes(type);

/**
 * Die Art einer Datei. Der Browser kennt sie nicht immer — ein GPX kommt oft
 * ohne an —, dann entscheidet die Endung.
 */
export function typeOfFile(file: File): string | null {
  const said = file.type.toLowerCase();
  if (isImageType(said) || Object.values(FILE_TYPES).includes(said)) return said;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  return FILE_TYPES[ext] ?? null;
}

/** „PDF, 240 kB" — wie die Liste der Pliki es neben den Namen schreibt. */
export function describeFile(name: string, bytes: number): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase() ?? 'PLIK';
  const size = bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;
  return `${ext}, ${size}`;
}

export const loadPageImages = (path: string): Promise<{ images: readonly PageImageRow[] }> =>
  call(`/workspace/page-images/${encodePath(path)}`);

/** Eine Datei an die Seite legen — ein Bild oder (0063) ein Dokument. */
export async function uploadPageFile(path: string, file: File | Blob, name: string, type: string): Promise<PageImageRow> {
  const image = isImageType(type);
  if (!image && !Object.values(FILE_TYPES).includes(type)) {
    throw new WorkspaceError('Tylko obrazy (JPEG, PNG, WebP, GIF, AVIF), PDF, dokumenty Office i OpenDocument albo ślad GPX.');
  }
  if (file.size > (image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES)) {
    throw new WorkspaceError(image ? 'Obraz może mieć najwyżej 8 MB.' : 'Plik może mieć najwyżej 25 MB.');
  }

  let response: Response;
  try {
    response = await fetch(`${API}/workspace/page-image/${encodePath(path)}?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': type, Accept: 'application/json' },
      body: file
    });
  } catch {
    throw new WorkspaceError('Nie udało się połączyć z usługą.');
  }

  const said = await response.json().catch(() => null) as { id?: string; error?: string; contentType?: string; size?: number } | null;
  if (!response.ok || said?.id === undefined) {
    throw new WorkspaceError(said?.error ?? (image ? 'Nie udało się wgrać obrazu.' : 'Nie udało się wgrać pliku.'));
  }
  return { id: said.id, contentType: said.contentType ?? type, size: said.size ?? file.size, name, createdAt: new Date().toISOString() };
}

export async function uploadPageImage(path: string, file: File): Promise<PageImageRow> {
  if (!isImageType(file.type)) throw new WorkspaceError('Tylko obrazy: JPEG, PNG, WebP, GIF albo AVIF.');
  return uploadPageFile(path, file, file.name, file.type);
}

export const deletePageImage = (id: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/page-image-file/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Wie die Schicht das Bild (und der Baustein die Datei) nennt. */
export const imageRef = (id: string): string => `page-image:${id}`;
