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
import { fmtNumber, t } from '../core/i18n';

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
  'audio/x-m4a': 'audio/mp4', 'audio/aac': 'audio/mp4', 'video/x-m4v': 'video/mp4', 'audio/opus': 'audio/ogg',
  'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'image/x-png': 'image/png'
};

/** 2026-11-28 — Bilder, die ohne Art ankommen (oder mit einer seltenen), erkennt die Endung. */
const IMAGE_EXT: Readonly<Record<string, string>> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

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
  return IMAGE_EXT[ext] ?? FILE_TYPES[ext] ?? MEDIA_TYPES[ext] ?? null;
}

/** Bilder, die der Dienst so nicht nimmt, die der Browser aber lesen kann (HEIC kann meist nur Safari). */
const CONVERTIBLE = /.(heic|heif|bmp|svg|tiff?|ico)$/i;
const MAX_SIDE = 4000;

/**
 * 2026-11-28 — EIN BILD, DAS SO NICHT PASST, PASSEND MACHEN: zu gross
 * (über 8 MB) oder in einer Art, die der Dienst nicht nimmt (BMP, SVG, HEIC …).
 * Der Browser zeichnet es neu als WebP (sonst JPEG), höchstens 4000 Punkte
 * breit, und verkleinert, bis es unter die Grenze passt. `null`: der Browser
 * kann das Bild nicht lesen — dann bleibt der Hinweis, warum es nicht passt.
 */
export async function fitImageFile(file: File): Promise<File | null> {
  const type = typeOfFile(file);
  if (type !== null && isImageType(type) && file.size <= MAX_IMAGE_BYTES) return file;
  const image = (type !== null && isImageType(type)) || file.type.toLowerCase().startsWith('image/') || CONVERTIBLE.test(file.name);
  if (!image || typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let w = img.naturalWidth || 1600;
    let h = img.naturalHeight || 1200;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    for (let round = 0; round < 6; round += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      let blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.86));
      if (blob === null || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.86));
      if (blob === null) return null;
      if (blob.size <= MAX_IMAGE_BYTES) {
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        return new File([blob], file.name.replace(/.[a-z0-9]{1,5}$/i, '') + '.' + ext, { type: blob.type });
      }
      w = Math.max(1, Math.round(w * 0.75));
      h = Math.max(1, Math.round(h * 0.75));
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** „PDF, 240 kB" — wie die Liste der Pliki es neben den Namen schreibt. */
export function describeFile(name: string, bytes: number): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase() ?? t('pages.files.fileExt');
  const size = bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${fmtNumber(bytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`;
  return `${ext}, ${size}`;
}

export const loadPageImages = (path: string): Promise<{ images: readonly PageImageRow[] }> =>
  call(`/workspace/page-images/${encodePath(path)}`);

/** Eine Datei an die Seite legen — ein Bild oder (0063) ein Dokument. */
export async function uploadPageFile(path: string, file: File | Blob, name: string, type: string): Promise<PageImageRow> {
  const image = isImageType(type);
  const media = isMediaType(type);
  if (!image && !media && !Object.values(FILE_TYPES).includes(type)) {
    throw new WorkspaceError(t('pages.files.badType'));
  }
  const most = image ? MAX_IMAGE_BYTES : media ? MAX_MEDIA_BYTES : MAX_FILE_BYTES;
  if (file.size > most) {
    throw new WorkspaceError(t(image ? 'pages.files.imageTooBig' : media ? 'pages.files.mediaTooBig' : 'pages.files.fileTooBig'));
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
    throw new WorkspaceError(t('pages.files.noConnection'));
  }

  const said = await response.json().catch(() => null) as { id?: string; error?: string; contentType?: string; size?: number } | null;
  if (!response.ok || said?.id === undefined) {
    throw new WorkspaceError(said?.error ?? t(image ? 'pages.files.imageFailed' : 'pages.files.fileFailed'));
  }
  return { id: said.id, contentType: said.contentType ?? type, size: said.size ?? file.size, name, createdAt: new Date().toISOString() };
}

export async function uploadPageImage(path: string, given: File): Promise<PageImageRow> {
  const file = (await fitImageFile(given)) ?? given; // 2026-11-28
  const type = typeOfFile(file);
  if (type === null || !isImageType(type)) throw new WorkspaceError(t('pages.files.onlyImages'));
  return uploadPageFile(path, file, file.name, type);
}

export const deletePageImage = (id: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/page-image-file/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Wie die Schicht das Bild (und der Baustein die Datei) nennt. */
export const imageRef = (id: string): string => `page-image:${id}`;
