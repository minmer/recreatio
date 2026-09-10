/**
 * Anhang D (kanonische Serialisierung) und Anhang E (ID-Format), Browserseite.
 *
 * Beide sind Einbahntüren. Anhang D ist die härteste: sobald der erste
 * Ketteneintrag geschrieben ist, macht jede Änderung hier JEDE bestehende
 * Signatur ungültig. Eine Änderung an diesem Abschnitt ist niemals eine
 * Verbesserung, sondern immer eine neue Kette.
 *
 * Muss byteweise mit `backend/Rc.Kernel/RcCanonical.cs` und `RcId.cs`
 * übereinstimmen.
 */

// ===========================================================================
// Anhang D — Kanonische Serialisierung nach RFC 8785 (JCS)
// ===========================================================================

/** 22.3 — 2^53−1. Größere Zahlen sind Zeichenketten. */
export const RC_MAX_SAFE_INTEGER = 9007199254740991;

export type RcJson =
  | string
  | number // ausschließlich Ganzzahlen, siehe unten
  | boolean
  | null
  | RcJson[]
  | { [key: string]: RcJson };

/**
 * 22.3 — Ein Ketteneintrag enthält KEINE Gleitkommazahlen. Das ist eine
 * Entscheidung, keine Auslassung: die Serialisierung von Gleitkomma nach
 * ECMAScript-Regeln ist die einzige Stelle, an der RFC-8785-Umsetzungen
 * regelmäßig auseinanderlaufen. Der Serialisierer wirft einen Fehler statt
 * zu runden.
 */
export function rcCanonicalize(value: RcJson): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error('Gleitkommazahlen sind in der Kette verboten (22.3).');
    }
    if (value > RC_MAX_SAFE_INTEGER || value < -RC_MAX_SAFE_INTEGER) {
      throw new Error(`Ganzzahl ${value} liegt außerhalb des sicheren Bereichs (22.3).`);
    }
    return String(value);
  }

  if (typeof value === 'string') return rcJsonString(value);

  if (Array.isArray(value)) return `[${value.map(rcCanonicalize).join(',')}]`;

  // 22.2 — aufsteigend nach UTF-16-Codeeinheiten, nicht nach UTF-8-Bytes und
  // nicht nach Sprachregeln. Ein blosser `<`-Vergleich tut in JavaScript genau
  // das; `localeCompare` täte es NICHT.
  const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((k) => `${rcJsonString(k)}:${rcCanonicalize(value[k])}`).join(',')}}`;
}

/**
 * 22.2 — Minimale Maskierung: nur `"` `\` und Steuerzeichen. Nicht-ASCII bleibt
 * UNMASKIERT und steht als UTF-8. Das ist der häufigste Umsetzungsfehler
 * (siehe TV-8): `JSON.stringify` maskiert zwar richtig, aber manche
 * Umsetzungen fügen `\uXXXX` für Umlaute ein, und dann stimmt der Hash nicht.
 */
function rcJsonString(s: string): string {
  let out = '"';
  for (const c of s) {
    switch (c) {
      case '"': out += '\\"'; break;
      case '\\': out += '\\\\'; break;
      case '\b': out += '\\b'; break;
      case '\f': out += '\\f'; break;
      case '\n': out += '\\n'; break;
      case '\r': out += '\\r'; break;
      case '\t': out += '\\t'; break;
      default: {
        const code = c.codePointAt(0)!;
        out += code < 0x20 ? `\\u${code.toString(16).padStart(4, '0')}` : c;
      }
    }
  }
  return out + '"';
}

/** UTF-8, ohne Byte Order Mark (22.2). */
export function rcCanonicalBytes(value: RcJson): Uint8Array {
  return new TextEncoder().encode(rcCanonicalize(value));
}

export async function rcCanonicalHash(value: RcJson): Promise<Uint8Array> {
  const bytes = rcCanonicalBytes(value);
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

/** UTC, Sekundengenauigkeit, Zulu-Form. Ohne feste Form wären zwei
 *  gleichwertige Zeitpunkte zwei verschiedene Hashes. */
export const rcTimestamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

// ===========================================================================
// Anhang E — ID-Format (UUIDv7)
// ===========================================================================

/**
 * 23.2 — Die ID entsteht im KLIENTEN, vor dem Absenden. Sie ist Teil des
 * signierten Inhalts; vergäbe der Server sie, bräuchte es zwei Runden —
 * hinschicken, ID holen, signieren, noch einmal hinschicken. Bei einer
 * Ableitungsdauer im Sekundenbereich ist das spürbar.
 *
 * Der Server lehnt eine bereits vergebene ID ab (`id.duplicate`); der Klient
 * erzeugt dann eine neue.
 */
export function rcNewId(at: Date = new Date()): string {
  const b = new Uint8Array(16);
  const ms = at.getTime();
  if (ms < 0) throw new Error('Zeitpunkt vor 1970.');

  // 48 Bit Zeitstempel, big-endian
  b[0] = Math.floor(ms / 2 ** 40) & 0xff;
  b[1] = Math.floor(ms / 2 ** 32) & 0xff;
  b[2] = Math.floor(ms / 2 ** 24) & 0xff;
  b[3] = Math.floor(ms / 2 ** 16) & 0xff;
  b[4] = Math.floor(ms / 2 ** 8) & 0xff;
  b[5] = ms & 0xff;

  crypto.getRandomValues(b.subarray(6));
  b[6] = 0x70 | (b[6] & 0x0f); // Version 7
  b[8] = 0x80 | (b[8] & 0x3f); // Variante 10

  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 23.4 — Kleinbuchstaben mit Bindestrichen. Großbuchstaben werden ABGELEHNT
 *  und nicht stillschweigend umgewandelt: sonst entstehen zwei Schreibweisen
 *  derselben ID, und eine davon steht irgendwann in einer AAD. */
export function rcParseId(text: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text)) {
    throw new Error('Keine gültige ID in Kleinschreibung (23.4).');
  }
  return text;
}

export function rcIsVersion7(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
}

/** Nur als Sortierhinweis brauchbar, nie als Nachweis — der Zeitstempel stammt
 *  von der Uhr des Klienten (23.2). */
export function rcTimestampHint(id: string): Date | null {
  if (!rcIsVersion7(id)) return null;
  const hex = id.replace(/-/g, '').slice(0, 12);
  return new Date(parseInt(hex, 16));
}

/** 23.3 — Der Heimatspeicher steht NICHT in der ID, sondern in einer eigenen
 *  Spalte. Ein Präfix machte aus 16 Byte eine Zeichenkette, verdürbe den Index
 *  und müsste in jede URL mitwandern. 0 = Hauptinstanz. */
export const RC_HOME_STORE_MAIN = 0;
