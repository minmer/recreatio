/**
 * 2026-10-24 — MIEJSCA W DZIELE: EIN MODELL FÜR ALLE STELLEN.
 *
 * Eine Stelle bleibt, was jemand geschrieben hat (`locator`: „s. 23", „J 21,15",
 * „nr 24", „I-II, q. 90, a. 1, ad 2", „2.0121", „§ 43", „rozdz. 3, s. 45"). Was sie
 * BEDEUTET, liest dieses Modul — für Fussnoten, Zitate, Felder mit Stelle in Nauka,
 * den Zapis des Skryptorium, JSON und die Blöcke eines Quellentexts gleich. Darum hat
 * dieselbe Stelle überall dieselbe Bedeutung, und eine Fussnote findet den Absatz eines
 * Textes, der erst später eingetragen wird.
 *
 * <b>Zwei Arten von Stellen.</b> Die STRUKTUR eines Werks (Vers, Nummer, Proposition,
 * Quaestio, Kapitel) gilt in jeder Ausgabe; die SEITE gilt nur in der einen Ausgabe,
 * deren Werk-Eintrag zitiert wird. Eine Stelle kann beides tragen („rozdz. 3, s. 45").
 *
 * <b>Welche Struktur, sagt das Werk</b> (`scheme`, sonst aus dem Rodzaj: Pismo Święte →
 * `bible`, Dokument → `numbered`, sonst `pages`). Es gibt feste Regeln für:
 * <code>
 *   pages     nur Seiten dieser Ausgabe              s. 23 · s. 23–25 · s. 23, 27 · s. xii
 *   bible     Buch, Kapitel, Vers                    J 21,15-17 · Ps 51(50),3 · Łk 1,26–2,5
 *   numbered  nummerierte Absätze (Dokumente, Kodizes) nr 24 · nn. 24–26 · KKK 1234 · kan. 915 § 1
 *   aquinas   Teil, Quaestio, Artikel, Einwand, Antwort  I-II, q. 90, a. 1, ad 2 · I q. 2 a. 3 co.
 *   decimal   Dezimalnummern (Tractatus)              2.0121 · 4.1–4.116 · TLP 6.54
 *   sections  Paragraphen (Untersuchungen)           § 43 · §§ 1–5 · cz. II, xi
 *   outline   Gliederung eines Buches                t. 2, cz. 1, rozdz. 3, § 4, ak. 5
 * </code>
 * Was keine Regel liest, bleibt als `rest` erhalten — nichts geht verloren, nur
 * verknüpft wird es dann nicht.
 */

import { bibleBooks, bookById, formatBible, parseBible, type BibleSpan } from './bible';

export type SchemeId = 'pages' | 'bible' | 'numbered' | 'aquinas' | 'decimal' | 'sections' | 'outline';

export interface SchemeDef {
  readonly id: SchemeId;
  readonly label: string;
  /** Wofür, in einem Satz, mit Beispielen — für die Auswahl und die Beschreibung des JSON. */
  readonly says: string;
  readonly examples: readonly string[];
}

export const SCHEMES: readonly SchemeDef[] = [
  { id: 'pages', label: 'Strony wydania', says: 'Tylko strony tej konkretnej edycji (książki, artykuły bez własnej numeracji).', examples: ['s. 23', 's. 23–25', 's. 23, 27', 's. xii'] },
  { id: 'bible', label: 'Pismo Święte', says: 'Księga, rozdział, werset — wspólne dla wszystkich przekładów (numeracja psalmów: hebrajska, grecka w nawiasie).', examples: ['J 21,15-17', 'Ps 51(50),3', 'Łk 1,26–2,5', 'Mt 5,3-12; 6,1'] },
  { id: 'numbered', label: 'Numery (dokumenty)', says: 'Numerowane punkty dokumentów Kościoła, katechizmu, kodeksów; paragraf w numerze po „§".', examples: ['nr 24', 'nn. 24–26', 'KKK 1234', 'kan. 915 § 1'] },
  { id: 'aquinas', label: 'Tomasz z Akwinu', says: 'Część, kwestia, artykuł; zarzut (arg.), sed contra, odpowiedź (co.), odpowiedź na zarzut (ad).', examples: ['I, q. 2, a. 3', 'I-II, q. 90, a. 1, ad 2', 'II-II q. 23 a. 1 arg. 1', 'III q. 75 a. 1 co.'] },
  { id: 'decimal', label: 'Numeracja dziesiętna', says: 'Twierdzenia numerowane dziesiętnie, jak w Traktacie logiczno-filozoficznym: każda cyfra po kropce to poziom niżej.', examples: ['2.0121', '4.1–4.116', 'TLP 6.54'] },
  { id: 'sections', label: 'Paragrafy dzieła', says: 'Paragrafy (uwagi) numerowane w całym dziele, z częściami, jak w Dociekaniach filozoficznych.', examples: ['§ 43', '§§ 1–5', 'cz. II, xi'] },
  { id: 'outline', label: 'Podział dzieła', says: 'Tom, część, księga, rozdział, paragraf, akapit — tyle poziomów, ile ma dzieło.', examples: ['t. 2, cz. 1, rozdz. 3', 'ks. II, rozdz. 4, § 2', 'rozdz. 3, ak. 5'] }
];

export const schemeOf = (id: string): SchemeDef => SCHEMES.find((s) => s.id === id) ?? SCHEMES[0];

/** Die Regel eines Werks: ausdrücklich gewählt, sonst aus seinem Rodzaj. */
export function workScheme(data: Readonly<Record<string, unknown>>): SchemeId {
  const set = typeof data.scheme === 'string' ? data.scheme : '';
  if (SCHEMES.some((s) => s.id === set)) return set as SchemeId;
  return data.workType === 'bible' ? 'bible' : data.workType === 'document' ? 'numbered' : 'pages';
}

/* -- Das Modell ----------------------------------------------------------------------------- */

/**
 * Eine Position in der Struktur, von oben nach unten. `null` heisst: diese Ebene nennt die
 * Stelle nicht (nur bei `outline` mitten im Pfad — sonst ist der Pfad einfach kürzer).
 */
export type Path = readonly (number | null)[];

/** Ein Stück der Struktur, beide Enden eingeschlossen; ein kürzerer Pfad meint die ganze Einheit. */
export interface Span {
  readonly from: Path;
  readonly to: Path;
}

/** Seiten dieser Ausgabe; römische (Vorspann) liegen vor 1. */
export interface PageSpan {
  readonly from: number;
  readonly to: number;
}

export interface Place {
  readonly scheme: SchemeId;
  readonly spans: readonly Span[];
  readonly pages: readonly PageSpan[];
  /** Was keine Regel las — bleibt, wird nur nicht verknüpft. */
  readonly rest: string;
}

const ROMAN: Readonly<Record<string, number>> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/** „xii" → 12; keine römische Zahl → 0. */
export function roman(text: string): number {
  const s = text.toLowerCase();
  if (!/^[ivxlcdm]+$/.test(s)) return 0;
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const v = ROMAN[s[i]!]!;
    const next = ROMAN[s[i + 1] ?? ''] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

const ROMAN_PAGE = -10000;
/** Eine Seitenzahl: arabisch, oder römisch (Vorspann, vor 1). */
function pageNumber(text: string): number | null {
  const t = text.trim();
  if (/^\d{1,5}$/.test(t)) return Number(t);
  const r = roman(t);
  return r > 0 ? ROMAN_PAGE + r : null;
}

const pageWord = (n: number): string => (n < 0 ? romanOf(n - ROMAN_PAGE) : String(n));

function romanOf(n: number): string {
  const table: readonly [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

const DASH = /[–—−]/g;
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Zahlen und Bereiche: „23", „23-25", „23, 27", „23n", „23nn" (bis 999). */
function ranges(text: string, read: (t: string) => number | null): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (const raw of text.replace(DASH, '-').split(/[,;]|\s+i\s+|\s+and\s+|\s+et\s+/)) {
    const item = raw.trim().replace(/\.$/, '');
    if (item === '') continue;
    const following = /^(.+?)\s*(nn|ff|n|f)\.?$/i.exec(item);
    if (following !== null && !following[1]!.includes('-')) {
      const a = read(following[1]!);
      if (a !== null) out.push({ from: a, to: /^(nn|ff)$/i.test(following[2]!) ? a + 999 : a + 1 });
      continue;
    }
    /* „23-25n" — ein Bereich mit „n" dahinter: der Bereich gilt. */
    const [x, y] = item.replace(/(\d)\s*(?:nn|ff|n|f)\.?$/i, '$1').split('-');
    const a = read(x ?? '');
    const b = y === undefined ? a : read(y);
    if (a === null || b === null) continue;
    out.push(a <= b ? { from: a, to: b } : { from: a, to: a });
  }
  return out;
}

/* Seiten: „s. 23", „ss. 23–25", „str. 23", „p. 23", „pp. 23-25", „S. 23", „s. xii". */
const PAGES = /(?:^|[\s,;(])(?:ss?|str|pp?|S)\.\s*((?:[0-9ivxlcdm]+\s*(?:[-–—]\s*[0-9ivxlcdm]+)?\s*(?:nn?|ff?)?\.?\s*(?:,\s*|\s+i\s+)?)+)/gi;

function takePages(text: string): { pages: PageSpan[]; rest: string } {
  const pages: PageSpan[] = [];
  const rest = text.replace(PAGES, (whole, list: string) => {
    pages.push(...ranges(list, pageNumber));
    return whole.startsWith(',') || whole.startsWith(';') ? ',' : ' ';
  });
  return { pages, rest: ws(rest).replace(/^[,;]\s*|\s*[,;]$/g, '') };
}

/* -- Die Regeln ------------------------------------------------------------------------------ */

function bibleSpans(text: string): { spans: Span[]; rest: string } {
  const parsed = parseBible(text);
  if (parsed.length === 0) return { spans: [], rest: text };
  return { spans: parsed.map(bibleToSpan), rest: '' };
}

/** Ein Stück der Schrift im Modell: [Buch (Ordnung des Kanons), Kapitel, Vers]. */
export function bibleToSpan(span: BibleSpan): Span {
  const order = bookById(span.book)?.order ?? 0;
  const from = span.from.v === null ? [order, span.from.c] : [order, span.from.c, span.from.v];
  /* Ein ganzes Buch („Rdz") steht als Kapitel 1–150. */
  if (span.from.c === 1 && span.to.c >= 150 && span.from.v === null) return { from: [order], to: [order] };
  const to = span.to.v === null ? [order, span.to.c] : [order, span.to.c, span.to.v];
  return { from, to };
}

/** „nr 24", „nn. 24–26", „KKK 1234", „kan. 915 § 1", „24, 26", „pkt 3". */
function numberedSpans(text: string): { spans: Span[]; rest: string } {
  const t = text.replace(DASH, '-');
  const spans: Span[] = [];
  const sub = /§\s*(\d+)(?:\s*-\s*(\d+))?/.exec(t);
  const main = t.replace(/§\s*\d+(?:\s*-\s*\d+)?/, '').replace(/^[^\d]*/, '');
  if (main.trim() === '' && sub === null) return { spans: [], rest: text };
  const list = ranges(main, (x) => (/^\d{1,6}$/.test(x.trim()) ? Number(x.trim()) : null));
  if (list.length === 0) return { spans: [], rest: text };
  if (sub !== null && list.length === 1 && list[0]!.from === list[0]!.to) {
    const n = list[0]!.from;
    spans.push({ from: [n, Number(sub[1])], to: [n, Number(sub[2] ?? sub[1])] });
  } else {
    for (const r of list) spans.push({ from: [r.from], to: [r.to] });
  }
  return { spans, rest: '' };
}

const AQ_PARTS: readonly [RegExp, number][] = [[/^(?:i-ii|ia-iiae|1-2|prima secundae)$/i, 2], [/^(?:ii-ii|iia-iiae|2-2|secunda secundae)$/i, 3], [/^(?:iii|iiia|3|tertia)$/i, 4], [/^(?:suppl\.?|supplementum)$/i, 5], [/^(?:i|ia|1|prima)$/i, 1]];

/**
 * Tomasz: [Teil, Quaestio, Artikel, Stück, Nummer]. Teil: I = 1, I-II = 2, II-II = 3,
 * III = 4, Suppl. = 5, ohne Teil 0 (Quaestiones disputatae). Stück: Einwand (arg., obj.) 1,
 * sed contra 2, Antwort (co., resp., corpus) 3, Antwort auf den Einwand (ad) 4.
 */
function aquinasSpans(text: string): { spans: Span[]; rest: string } {
  const t = ' ' + text.replace(DASH, '-').replace(/^\s*(?:STh|S\.\s*Th\.|ST|Summa(?:\s+Theologiae)?)\b\.?\s*,?/i, ' ') + ' ';
  const partMatch = /^\s*([IV]+(?:a)?(?:-[IV]+(?:ae)?)?|Suppl\.?|[123](?:-[12])?)\s*[,.]?\s/i.exec(t);
  let part = 0;
  if (partMatch !== null) part = AQ_PARTS.find(([re]) => re.test(partMatch[1]!.replace(/\.$/, '')))?.[1] ?? 0;
  const q = /\bq(?:uaestio)?\.?\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(t);
  if (q === null) return { spans: [], rest: text };
  const a = /\ba(?:rt(?:iculus)?)?\.?\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(t.slice(q.index + q[0].length));
  const qFrom = Number(q[1]);
  const qTo = Number(q[2] ?? q[1]);
  if (a === null) return { spans: [{ from: [part, qFrom], to: [part, qTo] }], rest: '' };
  const aFrom = Number(a[1]);
  const aTo = Number(a[2] ?? a[1]);
  const tail = t.slice(q.index + q[0].length + a.index + a[0].length);
  const ad = /\bad\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(tail);
  const arg = /\b(?:arg|obj|ob)\.?\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(tail);
  if (ad !== null) return { spans: [{ from: [part, qFrom, aFrom, 4, Number(ad[1])], to: [part, qFrom, aFrom, 4, Number(ad[2] ?? ad[1])] }], rest: '' };
  if (arg !== null) return { spans: [{ from: [part, qFrom, aFrom, 1, Number(arg[1])], to: [part, qFrom, aFrom, 1, Number(arg[2] ?? arg[1])] }], rest: '' };
  if (/\bsed\s+contra\b|\bs\.\s*c\./i.test(tail)) return { spans: [{ from: [part, qFrom, aFrom, 2], to: [part, qFrom, aFrom, 2] }], rest: '' };
  if (/\b(?:co|c|resp|respondeo|corpus)\b\.?/i.test(tail)) return { spans: [{ from: [part, qFrom, aFrom, 3], to: [part, qFrom, aFrom, 3] }], rest: '' };
  return { spans: [{ from: [part, qFrom, aFrom], to: [part, qTo === qFrom ? qFrom : qTo, aTo] }], rest: '' };
}

/** „2.0121" → [2, 0, 1, 2, 1]: die Zahl vor dem Punkt, dann jede Ziffer eine Ebene tiefer. */
export function decimalPath(text: string): number[] | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (m === null) return null;
  return [Number(m[1]), ...(m[2] ?? '').split('').map(Number)];
}

function decimalSpans(text: string): { spans: Span[]; rest: string } {
  const t = text.replace(DASH, '-').replace(/^\s*(?:TLP|Tractatus|Traktat)\b\.?\s*/i, '');
  const spans: Span[] = [];
  for (const item of t.split(/[,;]/)) {
    const [x, y] = item.split('-').map((s) => s.trim());
    const a = decimalPath(x ?? '');
    const b = y === undefined ? a : decimalPath(y);
    if (a === null || b === null) continue;
    spans.push({ from: a, to: b });
  }
  return spans.length === 0 ? { spans: [], rest: text } : { spans, rest: '' };
}

/** Untersuchungen: Teil I (die §§) = 1, Teil II (römische Abschnitte) = 2 — [Teil, Nummer]. */
function sectionsSpans(text: string): { spans: Span[]; rest: string } {
  const t = text.replace(DASH, '-').replace(/^\s*(?:PU|PI|PB|Dociekania(?:\s+filozoficzne)?|Philosophische Untersuchungen)\b\.?\s*,?/i, '');
  const second = /(?:cz\.|część|Teil|part|pt\.)\s*(?:II|2)\s*,?\s*([ivxlc]+|\d+)(?:\s*-\s*([ivxlc]+|\d+))?|(?:PPF|PPI)\s*([ivxlc]+|\d+)/i.exec(t);
  if (second !== null) {
    const read = (s: string | undefined) => (s === undefined ? null : /^\d+$/.test(s) ? Number(s) : roman(s));
    const a = read(second[1] ?? second[3]);
    const b = read(second[2]) ?? a;
    if (a !== null && a > 0 && b !== null) return { spans: [{ from: [2, a], to: [2, b] }], rest: '' };
  }
  const list = ranges(t.replace(/§§?/g, '').replace(/^[^\d]*/, ''), (x) => (/^\d{1,5}$/.test(x.trim()) ? Number(x.trim()) : null));
  return list.length === 0 ? { spans: [], rest: text } : { spans: list.map((r) => ({ from: [1, r.from], to: [1, r.to] })), rest: '' };
}

/** Die Ebenen eines Buches, von oben: Tom, Część, Księga, Rozdział, Paragraf, Akapit. */
export const OUTLINE_LEVELS: readonly { readonly key: string; readonly label: string; readonly words: RegExp }[] = [
  { key: 'volume', label: 't.', words: /^(?:t|tom|vol|volumen|bd|band)\.?$/i },
  { key: 'part', label: 'cz.', words: /^(?:cz|część|czesc|part|pars|teil|pt)\.?$/i },
  { key: 'book', label: 'ks.', words: /^(?:ks|księga|ksiega|lib|liber|book|buch)\.?$/i },
  { key: 'chapter', label: 'rozdz.', words: /^(?:rozdz|rozdział|rozdzial|r|cap|c|caput|ch|chap|chapter|kap|kapitel)\.?$/i },
  { key: 'section', label: '§', words: /^(?:§|sekcja|sect|sectio|section|art|artykuł|artykul)\.?$/i },
  { key: 'paragraph', label: 'ak.', words: /^(?:ak|akapit|par|para|¶|abs)\.?$/i }
];

/** „t. 2, cz. 1, rozdz. 3" → [2, 1, null, 3, null, null]; Ebenen ohne Angabe sind `null`, auch als Bereich am Ende. */
function outlineSpans(text: string): { spans: Span[]; rest: string } {
  const from: (number | null)[] = OUTLINE_LEVELS.map(() => null);
  const to: (number | null)[] = OUTLINE_LEVELS.map(() => null);
  let found = false;
  const t = text.replace(DASH, '-').replace(/§\s*/g, '§ ');
  const tokens = t.split(/[,;]\s*|\s+(?=(?:t|tom|vol|cz|część|ks|księga|lib|rozdz|rozdział|r|cap|c|ch|chap|§|art|ak|akapit|par|¶)\.?\s)/i);
  for (const token of tokens) {
    const m = /^\s*(\S+?)\.?\s*([0-9ivxlcdm]+)(?:\s*-\s*([0-9ivxlcdm]+))?\s*$/i.exec(token);
    if (m === null) continue;
    const level = OUTLINE_LEVELS.findIndex((l) => l.words.test(m[1]!) || l.words.test(`${m[1]}.`));
    if (level < 0) continue;
    const read = (s: string | undefined) => (s === undefined ? null : /^\d+$/.test(s) ? Number(s) : roman(s) || null);
    const a = read(m[2]);
    if (a === null) continue;
    from[level] = a;
    to[level] = read(m[3]) ?? a;
    found = true;
  }
  /* „I.2.3" — eine gepunktete Gliederung ohne Wörter: Ebenen von oben, ab dem Kapitel. */
  if (!found) {
    const dotted = /^\s*([0-9ivxlcdm]+(?:\.[0-9]+){1,4})\s*$/i.exec(text);
    if (dotted !== null) {
      const bits = dotted[1]!.split('.');
      bits.forEach((b, i) => { const n = /^\d+$/.test(b) ? Number(b) : roman(b); from[3 + i] = n; to[3 + i] = n; });
      found = from.some((x) => x !== null);
    }
  }
  return found ? { spans: [{ from, to }], rest: '' } : { spans: [], rest: text };
}

const READERS: Readonly<Record<SchemeId, ((text: string) => { spans: Span[]; rest: string }) | null>> = {
  pages: null,
  bible: bibleSpans,
  numbered: numberedSpans,
  aquinas: aquinasSpans,
  decimal: decimalSpans,
  sections: sectionsSpans,
  outline: outlineSpans
};

/**
 * EINE STELLE LESEN — Seiten werden überall erkannt („s.", „pp."), die Struktur nach der
 * Regel des Werks. Bei `pages` ist eine nackte Zahl eine Seite („23" = „s. 23").
 */
export function parsePlace(text: string, scheme: SchemeId, options: PlaceOptions = {}): Place {
  const source = ws(text ?? '');
  if (source === '') return { scheme, spans: [], pages: [], rest: '' };
  const { pages, rest } = takePages(source);
  if (scheme === 'pages') {
    if (pages.length === 0) {
      const bare = ranges(rest, pageNumber);
      if (bare.length > 0 && /^[0-9ivxlcdm\s,;\-–—nf.]+$/i.test(rest)) return { scheme, spans: [], pages: bare, rest: '' };
    }
    /* Auch ein Buch mit Seiten hat oft Kapitel: „rozdz. 3, s. 45" bleibt lesbar. */
    const outline = rest === '' ? { spans: [], rest: '' } : outlineSpans(rest);
    return { scheme, spans: outline.spans, pages, rest: outline.rest };
  }
  const read = READERS[scheme]!;
  const structural = rest === '' ? { spans: [], rest: '' } : read(rest);
  const spans = scheme === 'bible' && options.psalms === 'greek' ? structural.spans.map(hebrewPsalms) : structural.spans;
  return { scheme, spans, pages, rest: structural.rest };
}

export interface PlaceOptions {
  /**
   * Die Zählung der Psalmen eines Werks: `hebrew` (Biblia Tysiąclecia und die meisten
   * heutigen Übersetzungen — die Vorgabe) oder `greek` (Septuaginta, Vulgata, Nova Vulgata).
   * Gespeichert und verglichen wird immer hebräisch; so liegen Ausgaben nebeneinander.
   */
  readonly psalms?: 'hebrew' | 'greek';
}

const PSALMS_ORDER = 23;

/**
 * Griechische (Vulgata-)Zählung der Psalmen → hebräische: Ps 9 = Ps 9–10, Ps 10–112 = Ps 11–113,
 * Ps 113 = Ps 114–115, Ps 114–115 = Ps 116, Ps 116–145 = Ps 117–146, Ps 146–147 = Ps 147.
 * Die Verse der geteilten Psalmen nach den üblichen Grenzen (9,22 → 10,1; 113,9 → 115,1;
 * 115,1 → 116,10; 147,1 → 147,12).
 */
export function greekToHebrewPsalm(c: number, v: number | null): { c: number; v: number | null } {
  if (c <= 8 || c >= 148) return { c, v };
  if (c === 9) return v !== null && v >= 22 ? { c: 10, v: v - 21 } : { c: 9, v };
  if (c <= 112) return { c: c + 1, v };
  if (c === 113) return v !== null && v >= 9 ? { c: 115, v: v - 8 } : { c: 114, v };
  if (c === 114) return { c: 116, v };
  if (c === 115) return { c: 116, v: v === null ? null : v + 9 };
  if (c <= 145) return { c: c + 1, v };
  if (c === 146) return { c: 147, v };
  return { c: 147, v: v === null ? null : v + 11 };
}

function hebrewPsalms(span: Span): Span {
  if (span.from[0] !== PSALMS_ORDER) return span;
  const map = (p: Path): Path => {
    if (p.length < 2 || p[1] === null) return p;
    const { c, v } = greekToHebrewPsalm(p[1]!, p.length > 2 ? p[2] ?? null : null);
    return p.length > 2 ? [p[0]!, c, v] : [p[0]!, c];
  };
  return { from: map(span.from), to: map(span.to) };
}

/* -- Vergleichen ----------------------------------------------------------------------------- */

const LOW = -Infinity;
const HIGH = Infinity;

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

const DEPTH = 6;
const lowOf = (p: Path): number[] => Array.from({ length: Math.max(DEPTH, p.length) }, (_, i) => p[i] ?? LOW);
const highOf = (p: Path): number[] => Array.from({ length: Math.max(DEPTH, p.length) }, (_, i) => p[i] ?? HIGH);

/**
 * BERÜHREN SICH ZWEI STÜCKE? Bei Pfaden ohne Lücke: als Bereiche in der Ordnung des Werks
 * (ein kürzerer Pfad umfasst alles darunter). Bei `outline` (Ebenen dürfen fehlen): Ebene
 * für Ebene, wo beide eine Angabe haben.
 */
export function overlap(a: Span, b: Span): boolean {
  const gappy = [a.from, a.to, b.from, b.to].some((p) => p.slice(0, -1).includes(null) || (p.includes(null) && p.some((x) => x !== null)));
  if (gappy) {
    for (let i = 0; i < Math.max(a.from.length, b.from.length); i += 1) {
      const af = a.from[i] ?? null, at = a.to[i] ?? af, bf = b.from[i] ?? null, bt = b.to[i] ?? bf;
      if (af === null || bf === null || at === null || bt === null) continue;
      if (af > bt || bf > at) return false;
    }
    return true;
  }
  return compare(lowOf(a.from), highOf(b.to)) <= 0 && compare(lowOf(b.from), highOf(a.to)) <= 0;
}

/** Umfasst `a` ganz `b`? (Das Kapitel umfasst den Vers, der Vers nicht das Kapitel.) */
export function contains(a: Span, b: Span): boolean {
  const gappy = [a.from, a.to, b.from, b.to].some((p) => p.slice(0, -1).includes(null) || (p.includes(null) && p.some((x) => x !== null)));
  if (gappy) {
    for (let i = 0; i < Math.max(a.from.length, b.from.length); i += 1) {
      const af = a.from[i] ?? null, at = a.to[i] ?? af, bf = b.from[i] ?? null, bt = b.to[i] ?? bf;
      if (af === null || at === null) continue;
      if (bf === null || bt === null || bf < af || bt > at) return false;
    }
    return true;
  }
  return compare(lowOf(a.from), lowOf(b.from)) <= 0 && compare(highOf(b.to), highOf(a.to)) <= 0;
}

export const pagesOverlap = (a: PageSpan, b: PageSpan): boolean => a.from <= b.to && b.from <= a.to;

/** Ein Schlüssel zum Ordnen nach der Struktur, dann nach Seiten; Unlesbares ans Ende. */
export function placeSortKey(place: Place): string {
  const pad = (n: number | null) => (n === null ? '000000' : String(Math.max(0, n + 20000)).padStart(6, '0'));
  if (place.spans.length > 0) return place.spans[0]!.from.map(pad).join('.');
  if (place.pages.length > 0) return `p.${pad(place.pages[0]!.from)}`;
  return `~${place.rest.toLowerCase()}`;
}

/** Die Zählung, in der die Stellen eines Werks geschrieben sind (nur Pismo Święte: `psalms`). */
export const workOptions = (work: Readonly<Record<string, unknown>> | undefined): PlaceOptions =>
  work?.psalms === 'greek' ? { psalms: 'greek' } : {};

/** Eine Stelle, gelesen nach der Regel ihres Werks (ohne Werk: Seiten). */
export const workPlace = (locator: string, work: Readonly<Record<string, unknown>> | undefined): Place =>
  parsePlace(locator, work === undefined ? 'pages' : workScheme(work), workOptions(work));

/** Eine Stelle zum Ordnen nach der Regel ihres Werks — Seiten als Zahlen, die Schrift nach dem Kanon, Quaestionen nach Teil und Artikel. */
export const workLocatorKey = (locator: string, work: Readonly<Record<string, unknown>> | undefined): string =>
  locator.trim() === '' ? '' : placeSortKey(workPlace(locator, work));

/* -- Schreiben ------------------------------------------------------------------------------- */

const AQ_PART_WORD = ['', 'I', 'I-II', 'II-II', 'III', 'Suppl.'];
const AQ_SUB = ['', 'arg.', 'sed contra', 'co.', 'ad'];

function writeSpan(span: Span, scheme: SchemeId): string {
  const f = span.from;
  const t = span.to;
  const same = f.length === t.length && f.every((x, i) => x === t[i]);
  switch (scheme) {
    case 'numbered': {
      const main = f[0] === t[0] ? `nr ${f[0]}` : `nn. ${f[0]}–${t[0]}`;
      return f.length > 1 ? `${main} § ${f[1]}${t[1] !== f[1] ? `–${t[1]}` : ''}` : main;
    }
    case 'aquinas': {
      const bits = [AQ_PART_WORD[f[0] ?? 0] ?? '', `q. ${f[1]}${!same && t.length === 2 && t[1] !== f[1] ? `–${t[1]}` : ''}`];
      if (f.length > 2) bits.push(`a. ${f[2]}${!same && f.length === 3 && t[2] !== f[2] ? `–${t[2]}` : ''}`);
      if (f.length > 3) bits.push(f[3] === 1 || f[3] === 4 ? `${AQ_SUB[f[3]!]} ${f[4]}${t[4] !== f[4] ? `–${t[4]}` : ''}` : AQ_SUB[f[3]!] ?? '');
      return bits.filter((b) => b !== '').join(', ');
    }
    case 'decimal': {
      const word = (p: Path) => `${p[0]}${p.length > 1 ? `.${p.slice(1).join('')}` : ''}`;
      return same ? word(f) : `${word(f)}–${word(t)}`;
    }
    case 'sections':
      if (f[0] === 2) return `cz. II, ${romanOf(f[1] ?? 0)}${t[1] !== f[1] ? `–${romanOf(t[1] ?? 0)}` : ''}`;
      return f[1] === t[1] ? `§ ${f[1]}` : `§§ ${f[1]}–${t[1]}`;
    case 'outline':
    case 'pages':
      /* Bei `pages` die Kapitel eines Buches mit Seiten („rozdz. 3, s. 45") — wie in der Gliederung. */
      return OUTLINE_LEVELS.map((l, i) => (f[i] === null || f[i] === undefined ? '' : `${l.label} ${f[i]}${t[i] !== f[i] && t[i] !== null ? `–${t[i]}` : ''}`)).filter((x) => x !== '').join(', ');
    default:
      return '';
  }
}

/** Eine Stelle, einheitlich geschrieben: „J 21,15-17", „nr 24–26", „I-II, q. 90, a. 1, ad 2", „rozdz. 3, s. 45". */
export function formatPlace(place: Place, original = ''): string {
  if (place.spans.length === 0 && place.pages.length === 0) return original || place.rest;
  const parts: string[] = [];
  if (place.spans.length > 0) {
    if (place.scheme === 'bible') parts.push(formatBible(place.spans.map(spanToBible).filter((s): s is BibleSpan => s !== null)));
    else parts.push(place.spans.map((s) => writeSpan(s, place.scheme)).join('; '));
  }
  if (place.pages.length > 0) parts.push(`s. ${place.pages.map((p) => (p.from === p.to ? pageWord(p.from) : `${pageWord(p.from)}–${pageWord(p.to)}`)).join(', ')}`);
  if (place.rest !== '') parts.push(place.rest);
  return parts.join(', ');
}

/** Zurück in die Schreibweise der Schrift (für `formatBible`). */
function spanToBible(span: Span): BibleSpan | null {
  const book = bibleBooks().find((b) => b.order === span.from[0]);
  if (book === undefined) return null;
  if (span.from.length === 1) return { book: book.id, from: { c: 1, v: null }, to: { c: 150, v: null } };
  return {
    book: book.id,
    from: { c: span.from[1] ?? 1, v: span.from[2] ?? null },
    to: { c: span.to[1] ?? span.from[1] ?? 1, v: span.to.length > 2 ? span.to[2] ?? null : null }
  };
}

/** Gilt die Stelle in jeder Ausgabe (Struktur) oder nur in dieser (Seiten)? */
export const isStructural = (place: Place): boolean => place.spans.length > 0;
