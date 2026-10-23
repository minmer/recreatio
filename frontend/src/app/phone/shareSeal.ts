/**
 * PLIKI PRZEZ LINK (0117) — die Bytes, ohne Dienst und ohne Sitzung: was aus dem
 * Geheimnis folgt, die Hülle, das Etikett, Fotos ohne den Ort. Der Browser
 * (`share.ts`) und der Dodatek für Thunderbird (`frontend/thunderbird`, 0125)
 * bündeln dieselbe Datei — eine zweite Fassung dieser Verträge liefe irgendwann
 * auseinander, und dann ginge ein Link aus der Post im Browser nicht mehr auf.
 *
 * <code>
 *   Geheimnis  16 Zufallsbytes — nur im Link, hinter der Raute (#/plik/<geheimnis>)
 *   Kennung    HKDF(Geheimnis, „share id")  — darunter legt der Dienst die Hülle ab
 *   Schlüssel  HKDF(Geheimnis, „share key") — nur hier; die Hülle: Kopf (Name, Art,
 *              Grösse) und Datei, AES-GCM
 *   Etikett    Name, Art, Grösse, Geheimnis, an wen — unter dem Schlüssel des eigenen
 *              Bereichs, für „Pliki przez link" (noch einmal kopieren, zurückziehen);
 *              aus Thunderbird unter dem Schlüssel seines Połączenie (siehe unten)
 * </code>
 *
 * Der Dienst sieht die Kennung, nie den Schlüssel; eine statische Seite sieht von
 * der Raute gar nichts. Wer den Link hat, öffnet die Datei — wie bei einer MMS, die
 * jeder liest, der das Telefon hat.
 *
 * Fotos (JPEG) gehen ohne ihre EXIF-Angaben hinaus — der Ort der Aufnahme bleibt
 * hier; nur die Drehung wird neu vermerkt. Neu gerechnet wird nichts: volle Qualität.
 *
 * Diese Datei holt nichts aus dem Netz und kennt keine Sitzung: der Dodatek bündelt
 * sie ohne den Rest der App.
 */

import { aad, derive, Field, fromBase64Url, open, openText, seal, sealText, toBase64Url } from '../core/crypto';
import { PRIMARY_HOST } from '../routes';

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
  /** An wen: Telefonnummern aus einer SMS; aus der Post bleibt es leer. */
  readonly to: readonly string[];
  /** 0125 — aus welchem Programm, wenn nicht aus der App (`thunderbird`). */
  readonly via?: string;
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

/** Der Link — immer auf recreatio.pl: auch aus der App, auch von einer eigenen Domain, auch aus Thunderbird. */
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

/* -- Das Etikett ------------------------------------------------------------------------------- */

/** Das Etikett versiegeln — unter dem Schlüssel des Bereichs, oder (0125) unter dem eines Połączenie. */
export const sealLabel = (key: Uint8Array, id: string, label: ShareLabel): Promise<Uint8Array> =>
  sealText(key, labelAad(id), JSON.stringify({ v: 1, ...label }));

/** Und öffnen — `null`, wenn es nicht aufgeht oder nicht wie ein Etikett aussieht. */
export async function openLabel(key: Uint8Array, id: string, sealed: Uint8Array): Promise<ShareLabel | null> {
  try {
    return readLabel(await openText(key, labelAad(id), sealed));
  } catch {
    return null;
  }
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
      to: Array.isArray(o.to) ? o.to.filter((t): t is string => typeof t === 'string') : [],
      ...(typeof o.via === 'string' && o.via !== '' ? { via: o.via.slice(0, 40) } : {})
    };
  } catch {
    return null;
  }
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

/**
 * Was hinausgeht: die Datei mit Kopf — ein JPEG ohne seine Angaben. Der Browser
 * (`shareFile`) und Thunderbird nehmen denselben Weg, damit ein Foto aus der Post
 * nicht mehr verrät als eines aus einer SMS.
 */
export function shareHeadOf(name: string, type: string, raw: Uint8Array): { head: ShareHead; bytes: Uint8Array } {
  const kind = type === '' ? 'application/octet-stream' : type;
  const bytes = kind === 'image/jpeg' ? withoutPlace(raw) : raw;
  return { head: { name: cleanName(name), type: kind, size: bytes.length }, bytes };
}

/* -- Was gezeigt wird -------------------------------------------------------------------------- */

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

/* -- Połączenie: ein Programm, das Links anlegt (0125) ------------------------------------------
 *
 * Thunderbird meldet kein Konto an. Er hält ein Połączenie, das im Browser des Kontos
 * entsteht: der Browser würfelt den SCHLÜSSEL DER ETIKETTEN und versiegelt ihn mit dem
 * Namen unter dem Schlüssel des Bereichs (so öffnet „Pliki przez link" später, was aus
 * der Post kam); der Dienst würfelt das GEHEIMNIS, mit dem sich das Programm ausweist,
 * und behält nur dessen Hash. Beides — und die Adresse des Dienstes — ist der
 * KOD POŁĄCZENIA, den man in Thunderbird einfügt:
 *
 *   RCFL1.<base64url({"v":1,"api":…,"id":…,"token":…,"key":…,"name":…})>
 *
 * Mit dem Kod legt das Programm Dateien in den Bereich und zieht die eigenen zurück.
 * Einen Bereichsschlüssel bekommt es nicht — lesen kann es dort nichts.
 */

const PAIRING_PREFIX = 'RCFL1.';
const TOKEN_TEXT = /^[A-Za-z0-9_-]{16,128}$/;
const ID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Was ein Połączenie unter dem Schlüssel des Bereichs hat. */
export interface DeviceDoc {
  /** Der Schlüssel seiner Etiketten (32 Byte). */
  readonly key: Uint8Array;
  /** Wie es heisst („Thunderbird — laptop"). */
  readonly name: string;
}

/** Was im Kod połączenia steht. */
export interface Pairing extends DeviceDoc {
  /** Wo der Dienst liegt (`https://api.recreatio.pl`). */
  readonly api: string;
  /** Die Kennung des Połączenie. */
  readonly id: string;
  /** Sein Geheimnis — `Authorization: Bearer …`. */
  readonly token: string;
}

const deviceAad = (id: string) => aad('share', 'device', id, Field.ShareDevice, 1);

/** Ein Name ohne Steuerzeichen, höchstens 60 Zeichen; leer heisst „Thunderbird". */
export function deviceName(text: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return clean === '' ? 'Thunderbird' : clean;
}

/** Ein frischer Schlüssel für die Etiketten eines Połączenie. */
export const newDeviceKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

export const sealDevice = (areaKey: Uint8Array, id: string, doc: DeviceDoc): Promise<Uint8Array> =>
  sealText(areaKey, deviceAad(id), JSON.stringify({ v: 1, key: toBase64Url(doc.key), name: deviceName(doc.name) }));

/** Den versiegelten Teil öffnen — `null`, wenn er nicht aufgeht. */
export async function openDevice(areaKey: Uint8Array, id: string, sealed: Uint8Array): Promise<DeviceDoc | null> {
  try {
    const o = JSON.parse(await openText(areaKey, deviceAad(id), sealed)) as { key?: unknown; name?: unknown };
    if (typeof o.key !== 'string') return null;
    const key = fromBase64Url(o.key);
    return key.length === 32 ? { key, name: deviceName(typeof o.name === 'string' ? o.name : '') } : null;
  } catch {
    return null;
  }
}

/** Ist das eine Adresse, unter der ein Dienst liegen darf? https — oder in der Entwicklung http auf diesem Rechner. */
export function serviceAddress(text: string): string | null {
  try {
    const url = new URL(text);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function pairingCode(p: Pairing): string {
  const json = JSON.stringify({ v: 1, api: p.api, id: p.id, token: p.token, key: toBase64Url(p.key), name: deviceName(p.name) });
  return PAIRING_PREFIX + toBase64Url(new TextEncoder().encode(json));
}

/** Den Kod lesen — Leerzeichen und Zeilenumbrüche vom Kopieren stören nicht. `null`: kein Kod połączenia. */
export function readPairing(text: string): Pairing | null {
  const t = text.replace(/\s+/g, '');
  if (!t.startsWith(PAIRING_PREFIX)) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(fromBase64Url(t.slice(PAIRING_PREFIX.length)))) as Record<string, unknown>;
    if (o.v !== 1 || typeof o.api !== 'string' || typeof o.id !== 'string' || typeof o.token !== 'string' || typeof o.key !== 'string') return null;
    const api = serviceAddress(o.api);
    const key = fromBase64Url(o.key);
    if (api === null || !ID_TEXT.test(o.id) || !TOKEN_TEXT.test(o.token) || key.length !== 32) return null;
    return { api, id: o.id, token: o.token, key, name: deviceName(typeof o.name === 'string' ? o.name : '') };
  } catch {
    return null;
  }
}
