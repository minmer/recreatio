/**
 * PLIKI PRZEZ LINK (0117) — statt einer MMS, die der Netzbetreiber auf ein paar
 * hundert KB drückt, eine SMS mit einem Link: das Zdjęcie in voller Grösse, ein
 * Film, ein PDF, bis 25 MB.
 *
 * <code>
 *   Geheimnis  16 Zufallsbytes — nur im Link, hinter der Raute (#/plik/<geheimnis>)
 *   Kennung    HKDF(Geheimnis, „share id")  — darunter legt der Dienst die Hülle ab
 *   Schlüssel  HKDF(Geheimnis, „share key") — nur hier; die Hülle: Kopf (Name, Art,
 *              Grösse) und Datei, AES-GCM
 *   Etikett    Name, Art, Grösse, Geheimnis, an wen — unter dem Schlüssel des eigenen
 *              Bereichs, für „Pliki przez link" (noch einmal kopieren, zurückziehen)
 * </code>
 *
 * Der Dienst sieht die Kennung, nie den Schlüssel; eine statische Seite sieht von
 * der Raute gar nichts. Wer den Link hat, öffnet die Datei — wie bei einer MMS, die
 * jeder liest, der das Telefon hat.
 *
 * Fotos (JPEG) gehen ohne ihre EXIF-Angaben hinaus — der Ort der Aufnahme bleibt
 * hier; nur die Drehung wird neu vermerkt. Neu gerechnet wird nichts: volle Qualität.
 */

import { aad, derive, Field, fromBase64Url, open, openText, seal, sealText, toBase64Url } from '../core/crypto';
import { API, call, WorkspaceError } from '../core/session';
import { PRIMARY_HOST } from '../routes';
import type { PhoneCtx } from './phoneContext';

/** So gross darf eine Datei sein (der Dienst nimmt die Hülle mit 64 KB Kopf dazu). */
export const SHARE_MAX = 25 * 1024 * 1024;

/** Wie lange ein Link gilt — zur Wahl. */
export const SHARE_DAYS = [7, 30, 365] as const;

export const daysLabel = (days: number): string => (days === 365 ? '1 rok' : days === 1 ? '1 dzień' : `${days} dni`);

const SECRET_BYTES = 16;
const SECRET_TEXT = /^[A-Za-z0-9_-]{22}$/;

/** Was in der Hülle vor der Datei steht. */
export interface ShareHead {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

/** Was der Absender über einen seiner Links weiss (das geöffnete Etikett). */
export interface ShareLabel extends ShareHead {
  /** Das Geheimnis (base64url) — der Link lässt sich daraus noch einmal bilden. */
  readonly secret: string;
  readonly to: readonly string[];
}

export interface ShareEntry {
  readonly id: string;
  readonly size: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly downloads: number;
  readonly lastDownloadAt: string | null;
  /** Geöffnet — `null`: geht nicht auf (fremde Epoche). */
  readonly label: ShareLabel | null;
}

/* -- Geheimnis, Kennung, Schlüssel ------------------------------------------------------------- */

export const newSecret = (): Uint8Array => crypto.getRandomValues(new Uint8Array(SECRET_BYTES));

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** 16 Bytes als Kennung in der Form, die der Dienst liest (`8-4-4-4-12`). */
export function guidText(bytes: Uint8Array): string {
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Kennung und Schlüssel aus dem Geheimnis — mit verschiedenen Etiketten: das eine verrät das andere nicht. */
export async function shareKeys(secret: Uint8Array): Promise<{ id: string; key: Uint8Array }> {
  if (secret.length !== SECRET_BYTES) throw new Error('Geheimnis muss 16 Byte lang sein.');
  const [id, key] = await Promise.all([derive(secret, 'recreatio share id v1', 16), derive(secret, 'recreatio share key v1', 32)]);
  return { id: guidText(id), key };
}

/** Der Link — immer auf recreatio.pl: auch aus der App, auch von einer eigenen Domain. */
export const shareLink = (secret: Uint8Array | string): string =>
  `https://${PRIMARY_HOST}/#/plik/${typeof secret === 'string' ? secret : toBase64Url(secret)}`;

/** Das Geheimnis aus der Adresse (22 Zeichen base64url) — sonst `null`. */
export function secretOf(text: string | null | undefined): Uint8Array | null {
  const t = (text ?? '').trim();
  if (!SECRET_TEXT.test(t)) return null;
  const bytes = fromBase64Url(t);
  return bytes.length === SECRET_BYTES ? bytes : null;
}

const fileAad = (id: string) => aad('share', 'file', id, Field.ShareFile, 1);
const labelAad = (id: string) => aad('share', 'label', id, Field.ShareLabel, 1);

/* -- Kopf und Datei ---------------------------------------------------------------------------- */

/** Ein Dateiname ohne Pfad und Steuerzeichen, höchstens 120 Zeichen. */
export function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (clean === '' ? 'plik' : clean).slice(0, 120);
}

/** Kopf und Datei in einem: 4 Bytes Länge (big-endian), der Kopf als JSON, die Datei. */
export function packShare(head: ShareHead, bytes: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, name: head.name, type: head.type, size: head.size }));
  const out = new Uint8Array(4 + json.length + bytes.length);
  new DataView(out.buffer).setUint32(0, json.length);
  out.set(json, 4);
  out.set(bytes, 4 + json.length);
  return out;
}

export function unpackShare(plain: Uint8Array): { head: ShareHead; bytes: Uint8Array } {
  if (plain.length < 4) throw new Error('Plik jest uszkodzony.');
  const length = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
  if (length > 8192 || 4 + length > plain.length) throw new Error('Plik jest uszkodzony.');
  const o = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + length))) as Partial<ShareHead>;
  const bytes = plain.subarray(4 + length);
  return {
    head: {
      name: cleanName(typeof o.name === 'string' ? o.name : 'plik'),
      type: typeof o.type === 'string' && o.type !== '' ? o.type : 'application/octet-stream',
      size: bytes.length
    },
    bytes
  };
}

/** Die Hülle: Kopf und Datei unter dem Schlüssel aus dem Geheimnis. */
export async function sealShare(secret: Uint8Array, head: ShareHead, bytes: Uint8Array): Promise<{ id: string; sealed: Uint8Array }> {
  const { id, key } = await shareKeys(secret);
  return { id, sealed: await seal(key, fileAad(id), packShare(head, bytes)) };
}

export async function openShare(secret: Uint8Array, sealed: Uint8Array): Promise<{ head: ShareHead; bytes: Uint8Array }> {
  const { id, key } = await shareKeys(secret);
  return unpackShare(await open(key, fileAad(id), sealed));
}

/* -- Fotos ohne den Ort ------------------------------------------------------------------------- */

const ascii = (bytes: Uint8Array, at: number, text: string): boolean => {
  if (at + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[at + i] !== text.charCodeAt(i)) return false;
  return true;
};

/** Die Drehung aus einem TIFF-Block (EXIF), 1–8 — oder `null`. */
function orientationIn(tiff: Uint8Array): number | null {
  if (tiff.length < 8) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return null;
  const u16 = (o: number) => (little ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1]);
  const u32 = (o: number) => (little
    ? (tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16) | (tiff[o + 3] << 24)) >>> 0
    : ((tiff[o] << 24) | (tiff[o + 1] << 16) | (tiff[o + 2] << 8) | tiff[o + 3]) >>> 0);
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > tiff.length) return null;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** Ein EXIF-Block mit nichts als der Drehung. */
function orientationSegment(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,                 // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,     // TIFF, big-endian, IFD0 bei 8
    0x00, 0x01,                                         // ein Eintrag
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00                              // kein weiteres IFD
  ]);
}

/**
 * EIN JPEG OHNE SEINE ANGABEN: EXIF (Ort, Gerät, Zeit), XMP und IPTC fallen fort,
 * die Drehung wird neu vermerkt. Die Bilddaten bleiben Byte für Byte, wie sie
 * waren. Was kein JPEG ist oder unerwartet aussieht, bleibt unverändert.
 */
export function withoutPlace(jpeg: Uint8Array): Uint8Array {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const kept: Uint8Array[] = [];
  let orientation = 1;
  let dropped = false;
  let at = 2;
  while (at + 4 <= jpeg.length) {
    if (jpeg[at] !== 0xff) return jpeg;
    const marker = jpeg[at + 1];
    if (marker === 0xff) { at += 1; continue; }
    if (marker === 0xda || marker === 0xd9) break;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { kept.push(jpeg.subarray(at, at + 2)); at += 2; continue; }
    const length = (jpeg[at + 2] << 8) | jpeg[at + 3];
    if (length < 2 || at + 2 + length > jpeg.length) return jpeg;
    const segment = jpeg.subarray(at, at + 2 + length);
    if (marker === 0xe1 && ascii(segment, 4, 'Exif\0\0')) {
      orientation = orientationIn(segment.subarray(10)) ?? orientation;
      dropped = true;
    } else if ((marker === 0xe1 && ascii(segment, 4, 'http://ns.adobe.com/')) || marker === 0xed) {
      dropped = true;
    } else {
      kept.push(segment);
    }
    at += 2 + length;
  }
  if (!dropped) return jpeg;

  const head = kept.length > 0 && kept[0][1] === 0xe0 ? [kept[0]] : [];
  const parts = [
    jpeg.subarray(0, 2),
    ...head,
    ...(orientation === 1 ? [] : [orientationSegment(orientation)]),
    ...kept.slice(head.length),
    jpeg.subarray(at)
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let to = 0;
  for (const p of parts) { out.set(p, to); to += p.length; }
  return out;
}

/* -- Hinauf (der Absender) --------------------------------------------------------------------- */

/**
 * Hinauf mit Fortschritt — 25 MB über ein langsames Netz dauern, und ein Balken sagt
 * mehr als „Wysyłanie…". Darum hier `XMLHttpRequest` (fetch meldet beim Hochladen
 * nichts); Keks und Fehlerform wie bei `call`.
 */
function put(path: string, body: Uint8Array, headers: Readonly<Record<string, string>>, onProgress?: (done: number, total: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded, e.total); };
    xhr.onload = () => {
      let said: unknown = null;
      try { said = JSON.parse(xhr.responseText); } catch { said = null; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(said); return; }
      const error = said !== null && typeof said === 'object' && 'error' in said ? String((said as { error: unknown }).error) : null;
      reject(new WorkspaceError(error ?? (xhr.status >= 500 ? 'Usługa nie odpowiada — spróbuj za chwilę.' : 'Nie udało się wysłać pliku.')));
    };
    xhr.onerror = () => reject(new WorkspaceError('Brak połączenia — plik nie został wysłany.'));
    xhr.send(new Blob([body as BlobPart]));
  });
}

/** EINE DATEI TEILEN: versiegeln, hinauf, den Link zurück. */
export async function shareFile(
  ctx: PhoneCtx, file: File,
  options: { readonly days: number; readonly to?: readonly string[]; readonly onProgress?: (done: number, total: number) => void }
): Promise<{ id: string; link: string; expiresAt: string }> {
  if (file.size > SHARE_MAX) throw new WorkspaceError('Plik przez link może mieć najwyżej 25 MB.');
  const type = file.type || 'application/octet-stream';
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  if (type === 'image/jpeg') bytes = withoutPlace(bytes);
  const head: ShareHead = { name: cleanName(file.name), type, size: bytes.length };

  const secret = newSecret();
  const { id, sealed } = await sealShare(secret, head, bytes);
  const label: ShareLabel = { ...head, secret: toBase64Url(secret), to: [...(options.to ?? [])] };
  const sealedLabel = await sealText(ctx.newest.key, labelAad(id), JSON.stringify({ v: 1, ...label }));
  const said = await put(
    `/workspace/phone/${encodeURIComponent(ctx.areaId)}/share/${id}?epoch=${ctx.newest.epoch}&days=${options.days}`,
    sealed, { 'X-Share-Label': toBase64Url(sealedLabel) }, options.onProgress
  ) as { expiresAt?: string } | null;
  return { id, link: shareLink(secret), expiresAt: said?.expiresAt ?? '' };
}

function readLabel(json: string): ShareLabel | null {
  try {
    const o = JSON.parse(json) as Partial<ShareLabel>;
    if (typeof o.secret !== 'string' || secretOf(o.secret) === null) return null;
    return {
      name: cleanName(typeof o.name === 'string' ? o.name : 'plik'),
      type: typeof o.type === 'string' ? o.type : 'application/octet-stream',
      size: typeof o.size === 'number' ? o.size : 0,
      secret: o.secret,
      to: Array.isArray(o.to) ? o.to.filter((t): t is string => typeof t === 'string') : []
    };
  } catch {
    return null;
  }
}

/** Die eigenen Links, die noch gelten — neueste zuerst. */
export async function loadShares(ctx: PhoneCtx): Promise<ShareEntry[]> {
  const { shares } = await call<{ shares: readonly (Omit<ShareEntry, 'label'> & { epoch: number; label: string })[] }>(
    `/workspace/phone/${encodeURIComponent(ctx.areaId)}/shares`);
  const out: ShareEntry[] = [];
  for (const s of shares) {
    const key = ctx.keys.get(s.epoch);
    let label: ShareLabel | null = null;
    if (key !== undefined) {
      try { label = readLabel(await openText(key, labelAad(s.id), fromBase64Url(s.label))); } catch { label = null; }
    }
    out.push({ id: s.id, size: s.size, createdAt: s.createdAt, expiresAt: s.expiresAt, downloads: s.downloads, lastDownloadAt: s.lastDownloadAt, label });
  }
  return out;
}

/** Zurückziehen: die Datei ist sofort fort. */
export const unshare = (ctx: PhoneCtx, id: string): Promise<unknown> =>
  call(`/workspace/phone/${encodeURIComponent(ctx.areaId)}/share/${encodeURIComponent(id)}`, { method: 'DELETE' });

/* -- Herunter (wer den Link hat, ohne Konto) ------------------------------------------------- */

/** Der Link gilt nicht (mehr) — mit dem Wort des Dienstes. */
export class ShareGone extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function goneOf(response: Response): Promise<ShareGone> {
  const said = await response.json().catch(() => null) as { error?: unknown } | null;
  const error = said !== null && typeof said.error === 'string' ? said.error : null;
  return new ShareGone(
    error ?? (response.status === 410 ? 'Ten link wygasł.' : response.status === 404 ? 'Tego pliku nie ma — został usunięty albo link jest niepełny.' : 'Usługa nie odpowiada — spróbuj za chwilę.'),
    response.status
  );
}

const unreachable = () => new ShareGone('Brak połączenia z recreatio.pl — spróbuj ponownie.', 0);

/** Was der Link noch ist: wie gross, bis wann. */
export async function shareInfo(id: string): Promise<{ size: number; createdAt: string; expiresAt: string }> {
  let response: Response;
  try { response = await fetch(`${API}/share/${encodeURIComponent(id)}/info`, { credentials: 'omit' }); } catch { throw unreachable(); }
  if (!response.ok) throw await goneOf(response);
  return await response.json() as { size: number; createdAt: string; expiresAt: string };
}

/** Die Hülle holen — mit Fortschritt, wenn der Browser ihn hergibt. */
export async function fetchShare(id: string, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  let response: Response;
  try { response = await fetch(`${API}/share/${encodeURIComponent(id)}`, { credentials: 'omit' }); } catch { throw unreachable(); }
  if (!response.ok) throw await goneOf(response);
  const total = Number(response.headers.get('Content-Length') ?? '0') || 0;
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    done += step.value.length;
    onProgress?.(done, total);
  }
  const out = new Uint8Array(done);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/**
 * Was der Browser zeigen darf — und wie. Alles andere nur zum Herunterladen: eine
 * HTML- oder SVG-Datei, im Browser geöffnet, liefe unter recreatio.pl.
 */
export function shownAs(type: string): 'image' | 'video' | 'audio' | 'pdf' | null {
  const t = type.toLowerCase();
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'].includes(t)) return 'image';
  if (['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/3gpp'].includes(t)) return 'video';
  if (['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/x-m4a', 'audio/flac'].includes(t)) return 'audio';
  if (t === 'application/pdf') return 'pdf';
  return null;
}

/** „3,2 MB", „240 KB". */
export function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('pl-PL')} KB`;
}
