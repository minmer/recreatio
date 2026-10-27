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
 *   pages     nur Seiten dieser Ausgabe              s. 23 · s. 23–25 · s. 23, 27 · s. xii · s. 12* · s. (7) · s. A12
 *   bible     Buch, Kapitel, Vers                    J 21,15-17 · Ps 51(50),3 · Łk 1,26–2,5
 *   numbered  nummerierte Absätze (Dokumente, Kodizes) nr 24 · nn. 24–26 · KKK 1234 · kan. 915 § 1
 *   aquinas   Teil, Quaestio, Artikel, Einwand, Antwort  I-II, q. 90, a. 1, ad 2 · I q. 2 a. 3 co.
 *   decimal   Dezimalnummern (Tractatus)              2.0121 · 4.1–4.116 · TLP 6.54
 *   sections  Paragraphen (Untersuchungen)           § 43 · §§ 1–5 · cz. II, xi
 *   outline   Gliederung eines Buches                t. 2, cz. 1, rozdz. 3, § 4, ak. 5
 *   time      Zeit in einem Nagranie (2026-10-26)    1:23 · 1:23–1:45 · 0:45; 2:10–2:30 · 1:02:03
 * </code>
 * Die Zeit gehört wie die Seite einer Ausgabe dem einen Nagranie, nicht dem Utwór: eine andere
 * Aufführung desselben Stücks hat andere Zeiten (`isStructural` sagt darum nein).
 * Was keine Regel liest, bleibt als `rest` erhalten — nichts geht verloren, nur
 * verknüpft wird es dann nicht.
 *
 * <b>Seiten in Serien</b> (2026-10-27): wenn ein Buch seine Teile eigens zählt, trägt die Seite die Zeichen
 * ihrer Serie, wie sie gedruckt sind — für jedes Buch und jedes Zeichen, unten bei `readPage`.
 */

import { bibleBooks, bookById, formatBible, parseBible, type BibleSpan } from './bible';

export type SchemeId = 'pages' | 'bible' | 'numbered' | 'aquinas' | 'decimal' | 'sections' | 'outline' | 'time';

export interface SchemeDef {
  readonly id: SchemeId;
  readonly label: string;
  /** Wofür, in einem Satz, mit Beispielen — für die Auswahl und die Beschreibung des JSON. */
  readonly says: string;
  readonly examples: readonly string[];
}

export const SCHEMES: readonly SchemeDef[] = [
  { id: 'pages', label: 'Strony wydania', says: 'Tylko strony tej konkretnej edycji (książki, artykuły bez własnej numeracji). Gdy książka numeruje swoje części osobno (wstęp „xii” albo „12*”, dodatek „3\'”, wkładki „(7)”, „A12”), strona niesie znaki swojej serii tak, jak są wydrukowane — dowolne — a dzieło w polu „Serie stron” mówi, w jakiej kolejności serie stoją w książce.', examples: ['s. 23', 's. 23–25', 's. 23, 27', 's. xii', 's. 12*', "s. 45'–47'", 's. (7)', 's. A12'] },
  { id: 'bible', label: 'Pismo Święte', says: 'Księga, rozdział, werset — wspólne dla wszystkich przekładów (numeracja psalmów: hebrajska, grecka w nawiasie).', examples: ['J 21,15-17', 'Ps 51(50),3', 'Łk 1,26–2,5', 'Mt 5,3-12; 6,1'] },
  { id: 'numbered', label: 'Numery (dokumenty)', says: 'Numerowane punkty dokumentów Kościoła, katechizmu, kodeksów; paragraf w numerze po „§".', examples: ['nr 24', 'nn. 24–26', 'KKK 1234', 'kan. 915 § 1'] },
  { id: 'aquinas', label: 'Tomasz z Akwinu', says: 'Część, kwestia, artykuł; zarzut (arg.), sed contra, odpowiedź (co.), odpowiedź na zarzut (ad).', examples: ['I, q. 2, a. 3', 'I-II, q. 90, a. 1, ad 2', 'II-II q. 23 a. 1 arg. 1', 'III q. 75 a. 1 co.'] },
  { id: 'decimal', label: 'Numeracja dziesiętna', says: 'Twierdzenia numerowane dziesiętnie, jak w Traktacie logiczno-filozoficznym: każda cyfra po kropce to poziom niżej.', examples: ['2.0121', '4.1–4.116', 'TLP 6.54'] },
  { id: 'sections', label: 'Paragrafy dzieła', says: 'Paragrafy (uwagi) numerowane w całym dziele, z częściami, jak w Dociekaniach filozoficznych.', examples: ['§ 43', '§§ 1–5', 'cz. II, xi'] },
  { id: 'outline', label: 'Podział dzieła', says: 'Tom, część, księga, rozdział, paragraf, akapit — tyle poziomów, ile ma dzieło.', examples: ['t. 2, cz. 1, rozdz. 3', 'ks. II, rozdz. 4, § 2', 'rozdz. 3, ak. 5'] },
  { id: 'time', label: 'Czas nagrania', says: 'Minuty i sekundy nagrania — jak strony wydania należą do tego jednego wykonania, nie do utworu.', examples: ['1:23', '1:23–1:45', '0:45; 2:10–2:30', '1:02:03'] }
];

/** 2026-10-26 — die Regeln für Texte (Quellentexte, die Wahl am Werk); `time` gehört den Nagrania. */
export const TEXT_SCHEMES: readonly SchemeDef[] = SCHEMES.filter((s) => s.id !== 'time');

export const schemeOf = (id: string): SchemeDef => SCHEMES.find((s) => s.id === id) ?? SCHEMES[0];

/** Die Regel eines Werks: ausdrücklich gewählt, sonst aus seinem Rodzaj. */
export function workScheme(data: Readonly<Record<string, unknown>>): SchemeId {
  const set = typeof data.scheme === 'string' ? data.scheme : '';
  if (SCHEMES.some((s) => s.id === set)) return set as SchemeId;
  return data.workType === 'bible' ? 'bible' : data.workType === 'document' ? 'numbered' : data.workType === 'recording' ? 'time' : 'pages';
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

/*
 * 2026-10-27 — SEITEN IN SERIEN, für jedes Buch. Eine gedruckte Seite ist eine Zahl — arabisch oder römisch —
 * mit den Zeichen ihrer Serie davor, dahinter oder darum herum, wie sie gedruckt ist: „45", „12*", „3''", „(7)",
 * „[7]", „A12", „†3", „xii", „iv*". Die SERIE ist das Muster dieser Zeichen: „#" steht für eine arabische Zahl,
 * „i" für eine römische („#*", „#''", „(#)", „A#", „†#", „i*"; „#" allein die gewöhnlichen Seiten, „i" allein die
 * römische Titelei). Eine Liste der Serien gibt es nicht — jedes Zeichen geht, ausser Leerraum, Ziffern, Trennern
 * (. , ; : und Striche), Anführungszeichen und Buchstaben HINTER der Zahl („23n" ist „23 i n.", „12a" eine Spalte).
 * Vor der Zahl dürfen Buchstaben stehen („A12"); Klammern zählen nur als Paar: „(7)" ist eine Seite, in „(s. 7)"
 * schliesst die Klammer den Satz.
 *
 * Jede Serie hat ihr eigenes ZAHLENBAND, aus ihrem Muster gerechnet (FNV-1a → 1 … 20 000, mal 100 000;
 * `AiAccess.PageValue` im Dienst rechnet dasselbe): dieselbe Zahl in zwei Serien bleibt zwei Seiten, und die
 * Zahlen bleiben gleich, wo sie gespeichert sind (`ManifestPart.pages`). Zurückgeschrieben wird über die Muster,
 * die schon gelesen wurden (`SEEN`; das Verzeichnis eines Textes nennt seine Serien, `ManifestPart.series`).
 * In welcher Reihenfolge die Serien im Buch stehen, sagt das Werk („Serie stron": je eine Beispielseite in der
 * Reihenfolge des Buches, „xii 12* 1 3'"); ohne Angabe: die römische Titelei, die gewöhnlichen, dann die anderen.
 */
const BAND = 100_000;
const BANDS = 20_000;
/** Was nie Zeichen einer Serie ist. */
const NOT_MARK = String.raw`\s\d.,;:\-–—()\[\]{}„”“«»`;
/** Zeichen vor einer arabischen Zahl (auch Buchstaben: „A12"); hinter ihr und um eine römische ohne Buchstaben. */
const BEFORE = String.raw`[^${NOT_MARK}]`;
const AFTER = String.raw`[^${NOT_MARK}\p{L}]`;
const PAGE_BODY = String.raw`(?:${BEFORE}{0,3}?\d{1,5}${AFTER}{0,3}|${AFTER}{0,3}?[ivxlcdm]+${AFTER}{0,3})`;
const ARABIC_PAGE = new RegExp(String.raw`^(${BEFORE}{0,3}?)(\d{1,5})(${AFTER}{0,3})$`, 'u');
const ROMAN_LABEL = new RegExp(String.raw`^(${AFTER}{0,3}?)([ivxlcdm]+)(${AFTER}{0,3})$`, 'iu');

/** Die Zeichen, die Setzer für Strich und Doppelstrich nehmen: ’ ′ ` ´ → ', ″ " → ''. */
const primes = (text: string): string => text.replace(/[’′`´]/g, "'").replace(/[″"]/g, "''");
const upperAscii = (text: string): string => text.replace(/[a-z]/g, (c) => c.toUpperCase());

/** Eine gedruckte Seite: ihre Serie (das Muster ihrer Zeichen) und ihre Zahl darin. */
export interface PageLabel {
  readonly key: string;
  readonly k: number;
}

/** Die Nummer des Bandes einer Serie: die gewöhnlichen 0, die römische Titelei −1, jede andere aus ihrem Muster (FNV-1a). */
export function seriesIndex(key: string): number {
  if (key === '#') return 0;
  if (key === 'i') return -1;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 1 + (h % BANDS);
}

/** Die Muster, die schon gelesen wurden — damit eine Zahl wieder so geschrieben wird, wie sie gedruckt war. */
const SEEN = new Map<number, string>();
function remember(page: PageLabel): PageLabel {
  const index = seriesIndex(page.key);
  if (index > 0 && !SEEN.has(index)) SEEN.set(index, page.key);
  return page;
}

/** Die Serien eines Verzeichnisses (oder eines Werks) bekanntmachen. */
export function rememberSeries(keys: Iterable<string>): void {
  for (const key of keys) if (typeof key === 'string' && key.length <= 24 && /[#i]/.test(key)) remember({ key, k: 0 });
}

/** „12*" → {„#*", 12}, „(7)" → {„(#)", 7}, „A12" → {„A#", 12}, „xii" → {„i", 12}, „iv*" → {„i*", 4}; keine Seite → null. */
export function readPage(text: string): PageLabel | null {
  let t = primes(text.trim());
  let open = '';
  let close = '';
  const wrap = /^([([])\s*(.*?)\s*([)\]])$/.exec(t);
  if (wrap !== null) {
    if ((wrap[1] === '(') !== (wrap[3] === ')')) return null;
    open = wrap[1]!;
    close = wrap[3]!;
    t = wrap[2]!;
  }
  const arabic = ARABIC_PAGE.exec(t);
  if (arabic !== null) return remember({ key: `${open}${upperAscii(arabic[1]!)}#${arabic[3]!}${close}`, k: Number(arabic[2]) });
  const r = ROMAN_LABEL.exec(t);
  if (r === null) return null;
  const k = roman(r[2]!);
  if (k <= 0) return null;
  return remember({ key: `${open}${r[1]!}i${r[3]!}${close}`, k });
}

/** Die Serie einer gedruckten Seite — `null`: keine Seite. */
export const seriesKeyOf = (label: string): string | null => readPage(label)?.key ?? null;

/** Eine Seitenzahl: arabisch, römisch (Titelei, vor 1) — mit den Zeichen ihrer Serie in deren Band. */
function pageNumber(text: string): number | null {
  const page = readPage(text);
  if (page === null) return null;
  if (page.key === 'i') return page.k <= 9_999 ? ROMAN_PAGE + page.k : null;
  return page.k < BAND ? seriesIndex(page.key) * BAND + page.k : null;
}

/** Zu welcher Serie eine Seite gehört (`null`: ein Muster, das hier noch niemand gelesen hat), und ihre Zahl darin. */
export function pageSeriesOf(n: number): { readonly series: string | null; readonly k: number } {
  if (n < 0) return { series: 'i', k: n - ROMAN_PAGE };
  const index = Math.floor(n / BAND);
  return { series: index === 0 ? '#' : SEEN.get(index) ?? null, k: n - index * BAND };
}

const pageWord = (n: number): string => {
  const { series, k } = pageSeriesOf(n);
  if (series === null) return `${k}?`;
  return series.includes('#') ? series.replace('#', String(k)) : series.replace('i', romanOf(k));
};

/**
 * 2026-10-27 — WO EINE SEITE IM BUCH STEHT: ihre Serie in der Reihenfolge des Werks (`options.series`), sonst
 * die römische Titelei, die gewöhnlichen Seiten, dann die anderen; darin ihre Zahl. Nur zum Ordnen — gespeichert
 * wird das Band.
 */
export function pageOrdinal(n: number, options: PlaceOptions = {}): number {
  const index = n < 0 ? -1 : Math.floor(n / BAND);
  const k = n < 0 ? n - ROMAN_PAGE : n - index * BAND;
  const declared = (options.series ?? []).map(seriesIndex);
  const at = declared.indexOf(index);
  const rank = at >= 0 ? at : declared.length + (index === -1 ? 0 : index === 0 ? 1 : 1 + index);
  return rank * BAND + k;
}

/**
 * 2026-10-27 — DIE SERIEN EINES WERKS in der Reihenfolge des Buches, aus dem Feld „Serie stron": je eine
 * Beispielseite („xii 12* 1 3' (1) A1") — oder nur die Zeichen („* 1 ' ''": ein Zeichen allein steht hinter der
 * Zahl, Buchstaben davor, „()" und „[]" darum herum).
 */
export function readSeries(text: unknown): string[] {
  if (typeof text !== 'string') return [];
  const out: string[] = [];
  for (const raw of primes(text).split(/[\s,;]+/)) {
    const token = raw.trim();
    if (token === '') continue;
    const read = readPage(token);
    const key = read !== null ? read.key
      : /^[()]+$/.test(token) ? '(#)'
      : /^[[\]]+$/.test(token) ? '[#]'
      : /^\p{L}{1,3}$/u.test(token) ? `${upperAscii(token)}#`
      : readPage(`1${token}`)?.key ?? null;
    if (key !== null && !out.includes(key)) out.push(key);
  }
  rememberSeries(out);
  return out;
}

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

/* Seiten: „s. 23", „ss. 23–25", „str. 23", „p. 23", „pp. 23-25", „S. 23", „s. xii" — 2026-10-27 auch in Serien: „s. 12*", „s. 45'–47'", „s. (7)", „s. A12". */
const PAGE_TOKEN = String.raw`(?:\(\s*${PAGE_BODY}\s*\)|\[\s*${PAGE_BODY}\s*\]|${PAGE_BODY})`;
const PAGES = new RegExp(String.raw`(?:^|[\s,;(])(?:ss?|str|pp?|S)\.\s*((?:${PAGE_TOKEN}\s*(?:[-–—]\s*${PAGE_TOKEN})?\s*(?:nn?|ff?)?\.?\s*(?:,\s*|\s+i\s+)?)+)`, 'giu');

/** Ist der ganze Text eine Liste von Seiten („12*, 15*–17*")? Dann gilt er bei `pages` auch ohne „s.". */
function allPages(text: string): PageSpan[] {
  const items = text.replace(DASH, '-').split(/[,;]|\s+i\s+/).map((x) => x.trim()).filter((x) => x !== '');
  const read = ranges(text, pageNumber);
  return items.length > 0 && read.length === items.length ? read : [];
}

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

/**
 * „t. 2, cz. 1, rozdz. 3" → [2, 1, null, 3, null, null]; Ebenen ohne Angabe sind `null`, auch als Bereich am Ende.
 * 2026-10-25: Was dabei nicht gelesen wird („cz. II, xi" → „xi"), bleibt als `rest` — es fiel sonst still
 * weg, und die Stelle galt als ganz gelesen (die Erkennung des Układ zählt nur, was ganz gelesen ist).
 */
function outlineSpans(text: string): { spans: Span[]; rest: string } {
  const from: (number | null)[] = OUTLINE_LEVELS.map(() => null);
  const to: (number | null)[] = OUTLINE_LEVELS.map(() => null);
  const unread: string[] = [];
  let found = false;
  const t = text.replace(DASH, '-').replace(/§\s*/g, '§ ');
  const tokens = t.split(/[,;]\s*|\s+(?=(?:t|tom|vol|cz|część|ks|księga|lib|rozdz|rozdział|r|cap|c|ch|chap|§|art|ak|akapit|par|¶)\.?\s)/i);
  for (const token of tokens) {
    const m = /^\s*(\S+?)\.?\s*([0-9ivxlcdm]+)(?:\s*-\s*([0-9ivxlcdm]+))?\s*$/i.exec(token);
    const level = m === null ? -1 : OUTLINE_LEVELS.findIndex((l) => l.words.test(m[1]!) || l.words.test(`${m[1]}.`));
    const read = (s: string | undefined) => (s === undefined ? null : /^\d+$/.test(s) ? Number(s) : roman(s) || null);
    const a = m === null || level < 0 ? null : read(m[2]);
    if (m === null || a === null) {
      if (token.trim() !== '') unread.push(token.trim());
      continue;
    }
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
      if (from.some((x) => x !== null)) return { spans: [{ from, to }], rest: '' };
    }
  }
  return found ? { spans: [{ from, to }], rest: unread.join(', ') } : { spans: [], rest: text };
}

/* -- Zeit in einem Nagranie (2026-10-26) ------------------------------------------------------- */

/** „1:23" → 83, „1:02:03" → 3723, „83" → 83, „1:23.5" → 83.5 — Sekunden; sonst `null`. */
export function secondsOfTime(text: string): number | null {
  const t = text.trim().replace(/\s*(?:s|sek)\.?$/i, '');
  const hms = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (hms !== null) return Number(hms[2]) < 60 && Number(hms[3]) < 60 ? Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]) : null;
  const ms = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (ms !== null) return Number(ms[2]) < 60 ? Number(ms[1]) * 60 + Number(ms[2]) : null;
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

/** 83 → „1:23", 3723 → „1:02:03", 83.5 → „1:23.5". */
export function timeWord(seconds: number): string {
  const all = Math.round(Math.max(0, seconds) * 10);
  const whole = Math.floor(all / 10);
  const tenths = all % 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = `${String(whole % 60).padStart(2, '0')}${tenths > 0 ? `.${tenths}` : ''}`;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** „1:23", „1:23–1:45", „0:45; 2:10–2:30" (auch mit Komma) — jedes Stück ein Bereich in Sekunden. */
function timeSpans(text: string): { spans: Span[]; rest: string } {
  const spans: Span[] = [];
  const unread: string[] = [];
  for (const piece of text.replace(DASH, '-').split(/[;,]/).map((x) => x.trim()).filter((x) => x !== '')) {
    const [a, b, more] = piece.split(/\s*-\s*/);
    const from = secondsOfTime(a ?? '');
    const to = b === undefined ? from : secondsOfTime(b);
    if (from === null || to === null || more !== undefined || to < from) { unread.push(piece); continue; }
    spans.push({ from: [from], to: [to] });
  }
  return { spans, rest: unread.join(', ') };
}

const READERS: Readonly<Record<SchemeId, ((text: string) => { spans: Span[]; rest: string }) | null>> = {
  pages: null,
  bible: bibleSpans,
  numbered: numberedSpans,
  aquinas: aquinasSpans,
  decimal: decimalSpans,
  sections: sectionsSpans,
  outline: outlineSpans,
  time: timeSpans
};

/**
 * EINE STELLE LESEN — Seiten werden überall erkannt („s.", „pp."), die Struktur nach der
 * Regel des Werks. Bei `pages` ist eine nackte Zahl eine Seite („23" = „s. 23").
 */
export function parsePlace(text: string, scheme: SchemeId, options: PlaceOptions = {}): Place {
  const source = ws(text ?? '');
  if (source === '') return { scheme, spans: [], pages: [], rest: '' };
  /*
    2026-10-25 — MEHRERE STÜCKE, durch „;" getrennt (Anfang, Mitte, Ende): „s. 45–47; 52; 58–60",
    „rozdz. 1; rozdz. 9", „I q. 2 a. 3; I q. 3 a. 1" — jedes für sich gelesen. Ein Stück, das tiefer
    beginnt als das davor, gehört in dessen Rahmen: „I q. 2 a. 3; a. 4" ist Artikel 4 derselben
    Quaestio, „I q. 2 a. 3 arg. 1; ad 1" die Antwort im selben Artikel, „t. 2, rozdz. 1; rozdz. 9"
    Kapitel 9 desselben Bandes. Die Schrift, Nummern, Paragraphen und Dezimalzahlen lesen „;" schon selbst.
    2026-10-25, nach der Prüfung: Ein Stück, das NUR tiefer geht, als das davor aufhörte, ist dieselbe
    Stelle, genauer — so standen in alten Daten Ebenen einer Stelle („cz. 1; rozdz. 2" = Teil 1, Kapitel 2;
    „I q. 2 a. 3; ad 1" = nur ad 1). Es ersetzt das Stück davor, statt als zweites daneben zu stehen (sonst
    meinte die Stelle den ganzen Teil, den ganzen Artikel). Eine nackte Zahl („rozdz. 3; 5", „I q. 2 a. 3; 4")
    steht auf der tiefsten Ebene, die das Stück davor nannte — Seiten, wenn es Seiten nannte.
  */
  if ((scheme === 'pages' || scheme === 'outline' || scheme === 'aquinas') && source.includes(';')) {
    const parts = source.split(';').map((s) => s.trim()).filter((s) => s !== '');
    if (parts.length > 1) return scheme === 'aquinas' ? aquinasPieces(parts) : outlinePieces(parts, scheme, options);
  }
  return parseOne(source, scheme, options);
}

/** Eine nackte Zahl oder ein Bereich, ohne Wort einer Ebene („5", „5–7", „IV"). */
const BARE = /^[0-9ivxlcdm]+(?:\s*[-–—]\s*[0-9ivxlcdm]+)?$/i;

/** Die tiefste Ebene, die ein Pfad nennt (-1: keine). */
function deepestOf(path: Path): number {
  for (let i = path.length - 1; i >= 0; i -= 1) if (path[i] !== null && path[i] !== undefined) return i;
  return -1;
}

/**
 * Ein Buch, Stück für Stück. Beginnt ein Stück tiefer, als das davor aufhörte („cz. 1; rozdz. 2"), ist es
 * dieselbe Stelle, genauer: es ersetzt das Stück davor. Daneben oder höher („rozdz. 1; rozdz. 9",
 * „rozdz. 3, § 2; § 4") steht es daneben und behält die Ebenen darüber vom Stück davor.
 */
function outlinePieces(parts: readonly string[], scheme: SchemeId, options: PlaceOptions): Place {
  const spans: Span[] = [];
  const pages: PageSpan[] = [];
  const rest: string[] = [];
  let pagesBefore = false;
  for (const raw of parts) {
    const last = spans[spans.length - 1];
    const level = last === undefined ? -1 : deepestOf(last.from);
    /* Eine nackte Zahl (bei `pages` ist sie ohnehin eine Seite): auf der tiefsten Ebene des Stücks davor. */
    const text = scheme !== 'outline' || !BARE.test(raw) ? raw
      : pagesBefore ? `s. ${raw}` : level >= 0 ? `${OUTLINE_LEVELS[level]!.label} ${raw}` : raw;
    const place = parseOne(text, scheme, options);
    pagesBefore = place.pages.length > 0;
    pages.push(...place.pages);
    if (place.rest !== '') rest.push(place.rest);
    const span = place.spans.length === 1 ? place.spans[0]! : undefined;
    if (span === undefined || last === undefined) {
      spans.push(...place.spans);
      continue;
    }
    const top = span.from.findIndex((x) => x !== null);
    if (top > level) {
      spans[spans.length - 1] = { from: last.from.map((x, i) => span.from[i] ?? x), to: last.to.map((x, i) => span.to[i] ?? x) };
    } else {
      const fill = (path: Path): Path => path.map((x, i) => (i < top && x === null ? last.to[i] ?? null : x));
      spans.push({ from: fill(span.from), to: fill(span.to) });
    }
  }
  return { scheme, spans, pages, rest: rest.join('; ') };
}

/* Tomasz: woran ein Stück seine Ebene zeigt — Quaestio, Artikel, ein Stück des Artikels (wie `aquinasSpans` sie liest). */
const AQ_Q = /\bq(?:uaestio)?\.?\s*\d+(?:\s*-\s*\d+)?/i;
const AQ_A = /\ba(?:rt(?:iculus)?)?\.?\s*\d+(?:\s*-\s*\d+)?/i;
const AQ_PIECE = /\bad\s*\d|\b(?:arg|obj|ob)\.?\s*\d|\bsed\s+contra\b|\b(?:co|c|resp|respondeo|corpus)\b/i;

/**
 * 2026-10-25: „s. c." am Ende einer Stelle Tomasz' (oder vor einem Trenner) heisst sed contra, nicht die
 * römische Seite c — die Seiten nahmen es bisher weg, bevor `aquinasSpans` es lesen konnte.
 */
const sedContra = (text: string): string => text.replace(/(^|[\s,;(])s\.\s*c\.?(?=\s*(?:[,;)]|$))/gi, '$1sed contra');

/** Womit eine nackte Zahl nach diesem Pfad weiterzählt: q., a., arg., ad — nach co. und sed contra nichts. */
function aquinasWord(path: Path): string {
  if (path.length === 2) return 'q.';
  if (path.length === 3) return 'a.';
  return path.length === 5 ? (path[3] === 1 ? 'arg.' : path[3] === 4 ? 'ad' : '') : '';
}

/**
 * Tomasz, Stück für Stück. Die Seiten kommen zuerst heraus: sie sind kein Rahmen und wandern in kein
 * anderes Stück. Was bleibt, steht im Rahmen des Stücks davor (Teil, Quaestio, Artikel), soweit es ihn
 * nicht selbst nennt — aber nur, wenn es eine Ebene Tomasz' nennt; sonst bliebe allein der Rahmen,
 * also der ganze Artikel („…arg. 1; s. 45"). Geht es nur tiefer, als das Stück davor aufhörte
 * („I q. 2; a. 3", „I q. 2 a. 3; ad 1"), ersetzt es dieses; daneben („a. 3; a. 4", „arg. 1; ad 1") bleiben beide.
 */
function aquinasPieces(parts: readonly string[]): Place {
  const spans: Span[] = [];
  const pages: PageSpan[] = [];
  const rest: string[] = [];
  let head = '';
  let upToQ = '';
  let upToA = '';
  let pagesBefore = false;
  for (const raw of parts) {
    const last = spans[spans.length - 1];
    let text = raw.replace(DASH, '-');
    if (/^\d+(?:\s*-\s*\d+)?$/.test(text)) {
      const word = pagesBefore ? 's.' : last === undefined ? '' : aquinasWord(last.from);
      if (word !== '') text = `${word} ${text}`;
    }
    const taken = takePages(AQ_Q.test(text) || upToQ !== '' ? sedContra(text) : text);
    pages.push(...taken.pages);
    pagesBefore = taken.pages.length > 0;
    const piece = taken.rest;
    if (piece === '') continue;
    const own = AQ_Q.exec(piece);
    const article = AQ_A.test(piece);
    if (own === null && !article && !AQ_PIECE.test(piece)) {
      rest.push(piece);
      continue;
    }
    /* Die Ebene, auf der das Stück beginnt: 0 Teil (oder etwas vor der Quaestio), 1 Quaestio, 2 Artikel, 3 Stück des Artikels. */
    const top = own !== null ? (piece.slice(0, own.index).trim() === '' ? 1 : 0) : article ? 2 : 3;
    const frame = top === 1 ? head : top === 2 ? upToQ : top === 3 ? upToA || upToQ : '';
    const full = frame === '' ? piece : `${frame} ${piece}`;
    const read = aquinasSpans(full);
    const q = AQ_Q.exec(full);
    if (read.spans.length === 0 || q === null) {
      rest.push(piece);
      continue;
    }
    head = full.slice(0, q.index).trim();
    upToQ = full.slice(0, q.index + q[0].length);
    const a = AQ_A.exec(full.slice(upToQ.length));
    upToA = a === null ? '' : full.slice(0, upToQ.length + a.index + a[0].length);
    /* Die tiefste Ebene des Stücks davor: [Teil, Quaestio] 1, [… Artikel] 2, [… Stück (, Nummer)] 3. */
    if (last !== undefined && top > Math.min(last.from.length, 4) - 1) spans.splice(spans.length - 1, 1, ...read.spans);
    else spans.push(...read.spans);
  }
  return { scheme: 'aquinas', spans, pages, rest: rest.join('; ') };
}

function parseOne(source: string, scheme: SchemeId, options: PlaceOptions): Place {
  const { pages, rest } = takePages(scheme === 'aquinas' && AQ_Q.test(source) ? sedContra(source) : source);
  if (scheme === 'pages') {
    if (pages.length === 0) {
      const bare = allPages(rest);
      if (bare.length > 0) return { scheme, spans: [], pages: bare, rest: '' };
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
  /** 2026-10-27 — die Serien der Seiten in der Reihenfolge des Buches (`readSeries`: Muster wie „#*", „i", „A#"): nur zum Ordnen. */
  readonly series?: readonly string[];
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

/** Ein Schlüssel zum Ordnen nach der Struktur, dann nach Seiten (2026-10-27: in der Reihenfolge der Serien); Unlesbares ans Ende. */
export function placeSortKey(place: Place, options: PlaceOptions = {}): string {
  const pad = (n: number | null) => (n === null ? '000000' : String(Math.max(0, n + 20000)).padStart(6, '0'));
  if (place.spans.length > 0) return place.spans[0]!.from.map(pad).join('.');
  if (place.pages.length > 0) return `p.${String(pageOrdinal(place.pages[0]!.from, options) + 20000).padStart(12, '0')}`;
  return `~${place.rest.toLowerCase()}`;
}

/** Die Zählung, in der die Stellen eines Werks geschrieben sind (Pismo Święte: `psalms`; 2026-10-27: die Serien der Seiten). */
export const workOptions = (work: Readonly<Record<string, unknown>> | undefined): PlaceOptions => {
  const series = readSeries(work?.pageSeries);
  return { ...(work?.psalms === 'greek' ? { psalms: 'greek' as const } : {}), ...(series.length > 0 ? { series } : {}) };
};

/** Eine Stelle, gelesen nach der Regel ihres Werks (ohne Werk: Seiten). */
export const workPlace = (locator: string, work: Readonly<Record<string, unknown>> | undefined): Place =>
  parsePlace(locator, work === undefined ? 'pages' : workScheme(work), workOptions(work));

/** Eine Stelle zum Ordnen nach der Regel ihres Werks — Seiten als Zahlen, die Schrift nach dem Kanon, Quaestionen nach Teil und Artikel. */
export const workLocatorKey = (locator: string, work: Readonly<Record<string, unknown>> | undefined): string =>
  locator.trim() === '' ? '' : placeSortKey(workPlace(locator, work), workOptions(work));

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
    case 'time':
      return same || f[0] === t[0] ? timeWord(f[0] ?? 0) : `${timeWord(f[0] ?? 0)}–${timeWord(t[0] ?? 0)}`;
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
  /* 2026-10-25 — was keine Regel las, vor den Seiten (hinter „s. 45" läse man ein „xi" wieder als Seite); übrige Satzzeichen („)") nicht. */
  if (/[\p{L}\p{N}]/u.test(place.rest)) parts.push(place.rest);
  if (place.pages.length > 0) parts.push(`s. ${place.pages.map((p) => (p.from === p.to ? pageWord(p.from) : `${pageWord(p.from)}–${pageWord(p.to)}`)).join(', ')}`);
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

/** Gilt die Stelle in jeder Ausgabe (Struktur) oder nur in dieser (Seiten; 2026-10-26: die Zeit eines Nagrania)? */
export const isStructural = (place: Place): boolean => place.spans.length > 0 && place.scheme !== 'time';
