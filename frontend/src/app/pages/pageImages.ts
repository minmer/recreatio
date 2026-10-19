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
 *
 * <b>2026-10-19 — auch Filme und Klänge</b> (Präsentation: ein Feuer in
 * Schleife, die Geräusche des Gartens): dieselbe Ablage; der Dienst liefert
 * sie wie Bilder aus, mit Teilabruf, damit ein Film springen kann.
 */

import { API, call, WorkspaceError } from '../core/session';

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

/** 2026-10-19 — Filme und Klänge; der Dienst hat dieselbe Liste (`PageImage.Media`). */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav'
};
export const MAX_MEDIA_BYTES = 30 * 1024 * 1024;

/** Wie Browser dieselben Arten auch nennen. */
const MEDIA_ALIASES: Readonly<Record<string, string>> = {
  'audio/mp3': 'audio/mpeg', 'audio/x-mp3': 'audio/mpeg', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4', 'audio/aac': 'audio/mp4', 'video/x-m4v': 'video/mp4', 'audio/opus': 'audio/ogg'
};

export const isMediaType = (type: string): boolean => Object.values(MEDIA_TYPES).includes(type);
export const isVideoType = (type: string): boolean => isMediaType(type) && type.startsWith('video/');
export const isAudioType = (type: string): boolean => isMediaType(type) && type.startsWith('audio/');

/** Was im Dateidialog für einen Film oder einen Klang angeboten wird. */
export const mediaAccept = (kind: 'video' | 'audio'): string =>
  Object.entries(MEDIA_TYPES).filter(([, type]) => type.startsWith(`${kind}/`)).map(([ext]) => `.${ext}`).join(',') + `,${kind}/*`;

/** Was im Dateidialog angeboten wird. */
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((ext) => `.${ext}`).join(',');

export const isImageType = (type: string): boolean => (IMAGE_TYPES as readonly string[]).includes(type);

/**
 * Die Art einer Datei. Der Browser kennt sie nicht immer — ein GPX kommt oft
 * ohne an —, dann entscheidet die Endung.
 */
export function typeOfFile(file: File): string | null {
  const raw = file.type.toLowerCase();
  const said = MEDIA_ALIASES[raw] ?? raw;
  if (isImageType(said) || Object.values(FILE_TYPES).includes(said) || isMediaType(said)) return said;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  return FILE_TYPES[ext] ?? MEDIA_TYPES[ext] ?? null;
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
  const media = isMediaType(type);
  if (!image && !media && !Object.values(FILE_TYPES).includes(type)) {
    throw new WorkspaceError('Tylko obrazy (JPEG, PNG, WebP, GIF, AVIF), filmy (MP4, WebM), dźwięki (MP3, M4A, OGG, WAV), PDF, dokumenty Office i OpenDocument albo ślad GPX.');
  }
  const most = image ? MAX_IMAGE_BYTES : media ? MAX_MEDIA_BYTES : MAX_FILE_BYTES;
  if (file.size > most) {
    throw new WorkspaceError(image ? 'Obraz może mieć najwyżej 8 MB.' : media ? 'Film albo dźwięk może mieć najwyżej 30 MB.' : 'Plik może mieć najwyżej 25 MB.');
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
