/**
 * WAS DIE LAMPE HÖRT (2026-10-18) — ein BLE-Werbepaket (Legacy Advertising,
 * höchstens 31 Bytes), so wie nRF Connect es zeigt: als Text gelesen, in
 * seine AD-Strukturen zerlegt und so umgebaut, wie Android es senden kann.
 *
 * <b>Android nimmt keine rohen Bytes.</b> `AdvertiseData.Builder` setzt das
 * Paket selbst zusammen. Für Daten des Herstellers (Typ 0xFF) heisst das:
 * `addManufacturerData(kennung, daten)` — die Kennung (zwei Bytes, little
 * endian) und NUR die Bytes dahinter. Android schreibt davor wieder Länge und
 * Typ. Aus `1E FF 00 00 <27 Bytes>` wird so `addManufacturerData(0x0000,
 * <27 Bytes>)`, und in der Luft steht wieder dasselbe.
 *
 * <b>Nur, was sich genau so senden lässt.</b> Andere Strukturen (Namen,
 * UUID-Listen, Dienstdaten) baut Android in eigener Reihenfolge und Form;
 * sie werden gemeldet, nicht still verändert oder weggelassen. Ebenso eine
 * zweite Struktur des Herstellers. Nullen am Ende (das Füllsel mancher
 * Mitschnitte) sind laut Kernspezifikation kein Inhalt und werden nicht gesendet.
 */

export const LEGACY_MAX = 31;
export const AD_MANUFACTURER = 0xff;
/** Länge, Typ, zwei Bytes Kennung — was vor den Daten des Herstellers steht. */
export const MANUFACTURER_HEAD = 4;
/** Höchstens so viele Daten des Herstellers passen in ein Legacy-Paket. */
export const MANUFACTURER_MAX = LEGACY_MAX - MANUFACTURER_HEAD;

/** Die bekannten AD-Typen — nur, um sie beim Namen zu nennen. */
const AD_NAMES: Readonly<Record<number, string>> = {
  0x01: 'Flagi',
  0x02: 'UUID 16-bit (część listy)',
  0x03: 'UUID 16-bit (cała lista)',
  0x04: 'UUID 32-bit (część listy)',
  0x05: 'UUID 32-bit (cała lista)',
  0x06: 'UUID 128-bit (część listy)',
  0x07: 'UUID 128-bit (cała lista)',
  0x08: 'Nazwa skrócona',
  0x09: 'Nazwa pełna',
  0x0a: 'Moc nadawania',
  0x16: 'Dane usługi (UUID 16-bit)',
  0x19: 'Wygląd',
  0x20: 'Dane usługi (UUID 32-bit)',
  0x21: 'Dane usługi (UUID 128-bit)',
  0xff: 'Dane producenta'
};

export const adName = (type: number): string => AD_NAMES[type] ?? 'Nieznany typ';

/* -- Text → Bytes ------------------------------------------------------------------------------ */

export interface HexRead {
  /** Grossbuchstaben, ohne Trenner — leer, wenn nichts da war. */
  readonly hex: string;
  readonly problem: string | null;
}

/**
 * Was jemand einfügt: `0x1EFF…`, `1E FF 00 …`, über mehrere Zeilen, `1E:FF`,
 * `0x1E, 0xFF`. Trenner und das `0x` vor jedem Stück fallen weg.
 */
export function normalizeHex(text: string): HexRead {
  const joined = text
    .split(/[\s,;:\-]+/)
    .filter((piece) => piece !== '')
    .map((piece) => piece.replace(/^0x/i, ''))
    .join('')
    .toUpperCase();
  if (joined === '') return { hex: '', problem: 'Wpisz bajty szesnastkowo, np. 1EFF0000…' };
  const bad = /[^0-9A-F]/.exec(joined);
  if (bad !== null) return { hex: joined, problem: `Niedozwolony znak „${bad[0]}" — tylko cyfry 0–9 i litery A–F.` };
  if (joined.length % 2 !== 0) return { hex: joined, problem: `Nieparzysta liczba cyfr (${joined.length}) — każdy bajt to dwie cyfry.` };
  return { hex: joined, problem: null };
}

export function bytesOf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export const hexOf = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** `1EFF00` → `1E FF 00` — zum Lesen. */
export const spaced = (hex: string): string => (hex.match(/.{1,2}/g) ?? []).join(' ');

/** `0x0000` — die Kennung des Herstellers, wie nRF Connect sie nennt. */
export const idText = (id: number): string => `0x${id.toString(16).toUpperCase().padStart(4, '0')}`;

/** Lesbare Zeichen als sie selbst, alles andere als Punkt — so sieht man `HFKJ` im Paket. */
export const asciiOf = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');

/* -- Bytes → AD-Strukturen ---------------------------------------------------------------------- */

export interface AdStructure {
  /** Wo ihr Längenbyte steht (ab 0). */
  readonly offset: number;
  /** Der Wert des Längenbytes: Typ + Daten. */
  readonly length: number;
  readonly type: number;
  readonly data: Uint8Array;
}

export interface Manufacturer {
  readonly id: number;
  /** Die Bytes NACH der Kennung — das, was `addManufacturerData` bekommt. */
  readonly data: Uint8Array;
}

export interface Advertising {
  readonly bytes: Uint8Array;
  readonly structures: readonly AdStructure[];
  /** Nullen am Ende, die nicht gesendet werden. */
  readonly padding: number;
  /** Was das Senden verhindert. */
  readonly problems: readonly string[];
  /** Was man wissen sollte, aber nicht stört. */
  readonly notes: readonly string[];
  readonly manufacturer: Manufacturer | null;
}

export function parseAdvertising(bytes: Uint8Array): Advertising {
  const problems: string[] = [];
  const notes: string[] = [];
  const structures: AdStructure[] = [];
  let padding = 0;

  if (bytes.length === 0) problems.push('Pakiet jest pusty.');

  let at = 0;
  while (at < bytes.length) {
    const length = bytes[at];
    if (length === 0) {
      /* Länge 0: hier endet der Inhalt; dahinter dürfen nur Nullen stehen. */
      if (bytes.slice(at).some((b) => b !== 0)) {
        problems.push(`Bajt ${at + 1} ma długość 0 (koniec danych), a za nim są jeszcze dane.`);
      } else {
        padding = bytes.length - at;
      }
      break;
    }
    if (at + 1 + length > bytes.length) {
      problems.push(`Struktura od bajtu ${at + 1} zapowiada ${length} bajtów, a zostało ${bytes.length - at - 1}.`);
      break;
    }
    structures.push({ offset: at, length, type: bytes[at + 1], data: bytes.slice(at + 2, at + 1 + length) });
    at += 1 + length;
  }

  /* Gezählt wird der Inhalt — die Nullen dahinter (bei einem Mitschnitt des Telefons bis 62 Bytes) nicht. */
  const used = bytes.length - padding;
  if (used > LEGACY_MAX) problems.unshift(`Pakiet ma ${used} bajtów — reklama BLE (legacy) mieści najwyżej ${LEGACY_MAX}.`);

  for (const s of structures) {
    if (s.type !== AD_MANUFACTURER) {
      problems.push(`${adName(s.type)} (typ 0x${s.type.toString(16).toUpperCase().padStart(2, '0')}, bajt ${s.offset + 1}) — nadawane są na razie tylko dane producenta (0xFF), bez zmiany bajtów.`);
    }
  }

  const makers = structures.filter((s) => s.type === AD_MANUFACTURER);
  let manufacturer: Manufacturer | null = null;
  if (makers.length > 1) {
    problems.push('Więcej niż jedna struktura danych producenta — Android ułożyłby je po swojemu.');
  } else if (makers.length === 1) {
    const one = makers[0];
    if (one.data.length < 2) problems.push('Dane producenta muszą zaczynać się dwubajtowym identyfikatorem producenta.');
    else manufacturer = { id: one.data[0] | (one.data[1] << 8), data: one.data.slice(2) };
  } else if (structures.length > 0 || bytes.length > 0) {
    if (problems.length === 0) problems.push('Brak danych producenta (typ 0xFF).');
  }

  if (padding > 0) notes.push(`Na końcu ${padding} ${padding === 1 ? 'bajt' : 'bajtów'} zer (wypełnienie) — nie są nadawane.`);
  return { bytes, structures, padding, problems, notes, manufacturer };
}

/** Was Android in die Luft schreibt: Länge, 0xFF, Kennung (little endian), Daten. */
export function airBytes(m: Manufacturer): Uint8Array {
  const out = new Uint8Array(MANUFACTURER_HEAD + m.data.length);
  out[0] = 3 + m.data.length;
  out[1] = AD_MANUFACTURER;
  out[2] = m.id & 0xff;
  out[3] = (m.id >> 8) & 0xff;
  out.set(m.data, MANUFACTURER_HEAD);
  return out;
}

/**
 * Nur der Inhalt, ohne die Nullen dahinter — so, wie ein Mitschnitt (Telefon:
 * Werbung und Scan-Antwort zusammen, 62 Bytes) zu einem Sygnał wird.
 */
export function significantHex(hex: string): string {
  const bytes = bytesOf(hex);
  let at = 0;
  while (at < bytes.length && bytes[at] !== 0 && at + 1 + bytes[at] <= bytes.length) at += 1 + bytes[at];
  if (at < bytes.length && bytes.slice(at).every((b) => b === 0)) return hex.slice(0, at * 2);
  return hex.replace(/(?:00)+$/, '');
}

/* -- Ein Text, ganz gelesen --------------------------------------------------------------------- */

export interface FrameRead {
  readonly hex: string;
  readonly advertising: Advertising | null;
  /** Der erste Grund, warum das nicht gesendet werden kann — `null`: es geht. */
  readonly problem: string | null;
  /** Das, worum Android gebeten wird — nur, wenn es geht. */
  readonly manufacturer: Manufacturer | null;
}

export function readFrame(text: string): FrameRead {
  const read = normalizeHex(text);
  if (read.problem !== null) return { hex: read.hex, advertising: null, problem: read.problem, manufacturer: null };
  const advertising = parseAdvertising(bytesOf(read.hex));
  const problem = advertising.problems[0] ?? null;
  return { hex: read.hex, advertising, problem, manufacturer: problem === null ? advertising.manufacturer : null };
}
