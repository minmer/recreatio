/**
 * COGITA — DIE PRÜFUNG einer Antwort (COGITA.md §5).
 *
 * <b>Ein Modul für jede Form</b> [F13]: getippter Text, Zahl, Datum, eine oder
 * mehrere Wahlen, wahr oder falsch, Reihenfolge, Paare, die Lücke im Zitat,
 * die selbst bewertete Karte, Code, ein Punkt auf Bild oder Karte. Jede Form
 * antwortet gleich: richtig oder nicht, und WIE richtig, zwischen 0 und 1 —
 * denn die Kenntnis rechnet mit dem Teil, nicht nur mit dem Ganzen [D6].
 *
 * <b>Text wird Zeichen für Zeichen verglichen</b>, wie im Altbestand
 * (`features/revision/compare.ts`): je Zeichen der erwarteten Antwort eine
 * Zahl — 255 getroffen, 127 ähnlich (ą für a), 0 daneben. Daraus entsteht die
 * Teilrichtigkeit, und daraus zeichnet die Karte nach der Antwort, was stimmte
 * und was nicht [D14]. Drei Verfahren stehen zur Wahl:
 *
 * <code>
 *   anchors         die kürzeste Angleichung beider Texte — verzeiht ein fehlendes
 *                   oder überzähliges Zeichen, ohne den Rest zu verwerfen (Vorgabe)
 *   bidirectional   vom Anfang und vom Ende her, Stelle für Stelle
 *   prefix          nur vom Anfang her
 * </code>
 *
 * Wie streng geprüft wird — Verfahren, ähnliche Zeichen, Satzzeichen, Schwelle
 * —, sagt die Vorlage; eine Wiederholung darf es überschreiben [D5].
 *
 * <b>Rein</b>: keine Oberfläche, kein Speicher. Code prüft Pyodide im Browser;
 * hier kommt nur sein Ergebnis an [D10].
 */

import { coarsen, dateKey, readDate, readNumber, type DatePrecision, type DateValue } from './schema';

/* -- Formen ------------------------------------------------------------------------ */

export const ANSWER_FORMS = ['text', 'number', 'date', 'one', 'many', 'truefalse', 'order', 'match', 'gap', 'flash', 'code', 'point'] as const;
export type AnswerForm = (typeof ANSWER_FORMS)[number];

export const ANSWER_FORM_LABEL: Record<AnswerForm, string> = {
  text: 'Wpisany tekst',
  number: 'Liczba',
  date: 'Data',
  one: 'Jeden wybór',
  many: 'Kilka wyborów',
  truefalse: 'Prawda albo fałsz',
  order: 'Kolejność',
  match: 'Dopasowanie par',
  gap: 'Luka w cytacie',
  flash: 'Fiszka z samooceną',
  code: 'Kod (Python)',
  point: 'Punkt na obrazie albo mapie'
};

export type CompareAlgorithm = 'anchors' | 'bidirectional' | 'prefix';

export interface TextRule {
  readonly algorithm: CompareAlgorithm;
  /** Ähnliche Zeichen (ą und a, ł und l) zählen als getroffen. */
  readonly similar: boolean;
  /** Satzzeichen und Leerraum zählen nicht. */
  readonly ignorePunctuation: boolean;
  /** Ab welchem Anteil (0–1) die Antwort richtig ist. */
  readonly threshold: number;
  readonly caseSensitive: boolean;
}

export const TEXT_RULE: TextRule = { algorithm: 'anchors', similar: true, ignorePunctuation: false, threshold: 1, caseSensitive: false };

/** Die Lücke im Zitat: wie im Altbestand ohne Satzzeichen und mit 90 %. */
export const GAP_RULE: TextRule = { ...TEXT_RULE, ignorePunctuation: true, threshold: 0.9 };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Eine Regel aus der Einstellung einer Vorlage; was fehlt, kommt aus `base`. */
export function readRule(raw: unknown, base: TextRule = TEXT_RULE): TextRule {
  if (!isObject(raw)) return base;
  const algorithm = raw.algorithm === 'bidirectional' || raw.algorithm === 'prefix' || raw.algorithm === 'anchors' ? raw.algorithm : base.algorithm;
  const threshold = typeof raw.threshold === 'number' ? clamp01(raw.threshold > 1 ? raw.threshold / 100 : raw.threshold) : base.threshold;
  return {
    algorithm,
    similar: typeof raw.similar === 'boolean' ? raw.similar : base.similar,
    ignorePunctuation: typeof raw.ignorePunctuation === 'boolean' ? raw.ignorePunctuation : base.ignorePunctuation,
    threshold,
    caseSensitive: typeof raw.caseSensitive === 'boolean' ? raw.caseSensitive : base.caseSensitive
  };
}

export interface Outcome {
  readonly correct: boolean;
  /** Wie richtig, 0–1 — damit rechnet die Kenntnis [D6]. */
  readonly correctness: number;
  /** Ob überhaupt etwas geantwortet wurde. */
  readonly answered: boolean;
  /** Je Zeichen der erwarteten Antwort: 255 getroffen, 127 ähnlich, 0 daneben. */
  readonly mask?: Uint8Array;
  /** Gegen welche der erlaubten Antworten verglichen wurde. */
  readonly expected?: string;
}

const NOTHING: Outcome = { correct: false, correctness: 0, answered: false };

/* -- Text, Zeichen für Zeichen ----------------------------------------------------- */

const SIMILAR: Readonly<Record<string, string>> = {
  ą: 'a', à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  ć: 'c', č: 'c',
  ę: 'e', è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ł: 'l',
  ń: 'n',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o',
  ś: 's', š: 's',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y',
  ź: 'z', ż: 'z', ž: 'z'
};

const base = (c: string): string => SIMILAR[c] ?? c;
const same = (a: string, b: string, similar: boolean): boolean => a === b || (similar && a !== undefined && b !== undefined && base(a) === base(b));
const score = (a: string, b: string, similar: boolean): number => (a === b ? 255 : same(a, b, similar) ? 127 : 0);

const lengthFactor = (expected: readonly string[], answer: readonly string[]): number => {
  const longest = Math.max(expected.length, answer.length, 1);
  return Math.max(0, 1 - Math.abs(expected.length - answer.length) / longest);
};

function comparePrefix(expected: readonly string[], answer: readonly string[], similar: boolean): Uint8Array {
  const mask = new Uint8Array(expected.length);
  const factor = lengthFactor(expected, answer);
  for (let i = 0; i < expected.length; i += 1) mask[i] = Math.round(score(expected[i], answer[i] ?? '', similar) * factor);
  return mask;
}

/**
 * Von vorn UND von hinten: ein Zeichen, das von beiden Seiten her an seiner
 * Stelle steht, ist ganz getroffen; von einer Seite her halb. Ein vertauschter
 * Buchstabe kostet so ein Zeichen, ein fehlender die Hälfte des Restes — dafür
 * gibt es die Anker.
 */
function compareBidirectional(expected: readonly string[], answer: readonly string[], similar: boolean): Uint8Array {
  const mask = new Uint8Array(expected.length);
  const factor = lengthFactor(expected, answer);
  const shift = answer.length - expected.length;
  for (let i = 0; i < expected.length; i += 1) {
    const j = i + shift;
    const front = i < answer.length && same(expected[i], answer[i], similar);
    const back = j >= 0 && j < answer.length && same(expected[i], answer[j], similar);
    const exact = (i < answer.length && expected[i] === answer[i]) || (j >= 0 && j < answer.length && expected[i] === answer[j]);
    const value = Math.round(((front ? 128 : 0) + (back ? 127 : 0)) * factor);
    mask[i] = value > 0 && !exact ? Math.min(value, 127) : value;
  }
  return mask;
}

/**
 * DIE ANKER, neu gerechnet. Der Altbestand suchte Dreiergruppen als Anker und
 * dehnte sie aus — aber an JEDER Stelle der Antwort, nicht in ihrer Reihenfolge:
 * „Mickiewcz" galt als ganz richtig, weil „ic" in „Mickiewicz" zweimal steht.
 * Hier ist der Anker die kürzeste Angleichung beider Texte (Levenshtein):
 * jedes erwartete Zeichen ist getroffen, ähnlich, ersetzt oder fehlt, und ein
 * überzähliges Zeichen der Antwort kostet einen Schritt. Was der Altbestand
 * wollte — ein fehlendes oder zusätzliches Zeichen verzeihen, ohne den Rest zu
 * verwerfen —, bleibt; die falschen Treffer fallen weg.
 */
function compareAnchors(expected: readonly string[], answer: readonly string[], similar: boolean): Uint8Array {
  const n = expected.length;
  const m = answer.length;
  const mask = new Uint8Array(n);
  if (n === 0) return mask;
  const w = m + 1;
  const cost = new Float64Array((n + 1) * w);
  for (let i = 0; i <= n; i += 1) cost[i * w] = i;
  for (let j = 0; j <= m; j += 1) cost[j] = j;
  const sub = (i: number, j: number) => (expected[i] === answer[j] ? 0 : same(expected[i], answer[j], similar) ? 0.5 : 1);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      cost[i * w + j] = Math.min(
        cost[(i - 1) * w + (j - 1)] + sub(i - 1, j - 1),
        cost[(i - 1) * w + j] + 1,
        cost[i * w + (j - 1)] + 1
      );
    }
  }
  /* Zurück vom Ende; bei Gleichstand die Diagonale — ein Zeichen gegen ein Zeichen. */
  let i = n;
  let j = m;
  while (i > 0) {
    if (j > 0 && cost[i * w + j] === cost[(i - 1) * w + (j - 1)] + sub(i - 1, j - 1)) {
      const s = sub(i - 1, j - 1);
      mask[i - 1] = s === 0 ? 255 : s === 0.5 ? 127 : 0;
      i -= 1;
      j -= 1;
    } else if (cost[i * w + j] === cost[(i - 1) * w + j] + 1) {
      mask[i - 1] = 0;
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return mask;
}

/**
 * Überzählige Zeichen der Antwort gehören keinem erwarteten und stehen darum
 * nicht in der Maske — „Mickiewiczzz" träfe sonst jedes Zeichen. Sie mindern
 * den Anteil statt der Maske, damit die Karte die getroffenen Zeichen weiter
 * als getroffen zeigt.
 */
const surplus = (expected: number, given: number): number => (given > expected && expected > 0 ? expected / given : 1);

const COMPARABLE = /[\p{L}\p{N}]/u;

/** Der Anteil der Maske, mit ähnlichen Zeichen als getroffen, wenn die Regel es so will. */
export function maskShare(mask: Uint8Array, similar: boolean): number {
  if (mask.length === 0) return 1;
  let sum = 0;
  for (const v of mask) sum += similar && v === 127 ? 255 : v;
  return sum / (mask.length * 255);
}

/**
 * Ein Text gegen einen erwarteten. Die Maske bezieht sich auf den erwarteten
 * Text, wie er dasteht — auch wenn Satzzeichen nicht zählten (sie gelten dann
 * als getroffen), damit die Karte ihn Zeichen für Zeichen einfärben kann.
 */
export function compareText(expected: string, given: string, rule: TextRule = TEXT_RULE): { mask: Uint8Array; share: number } {
  const norm = (s: string) => (rule.caseSensitive ? s.trim() : s.trim().toLocaleLowerCase('pl-PL'));
  const want = Array.from(norm(expected));
  const got = Array.from(norm(given));
  const run = (e: readonly string[], g: readonly string[]) =>
    rule.algorithm === 'prefix' ? comparePrefix(e, g, rule.similar)
      : rule.algorithm === 'bidirectional' ? compareBidirectional(e, g, rule.similar)
        : compareAnchors(e, g, rule.similar);

  const penalty = (e: number, g: number) => (rule.algorithm === 'anchors' ? surplus(e, g) : 1);

  if (!rule.ignorePunctuation) {
    const mask = want.join('') === got.join('') ? new Uint8Array(want.length).fill(255) : run(want, got);
    return { mask, share: maskShare(mask, rule.similar) * penalty(want.length, got.length) };
  }
  const index: number[] = [];
  const kept: string[] = [];
  want.forEach((c, i) => { if (COMPARABLE.test(c)) { kept.push(c); index.push(i); } });
  const keptGot = got.filter((c) => COMPARABLE.test(c));
  const inner = kept.join('') === keptGot.join('') ? new Uint8Array(kept.length).fill(255) : run(kept, keptGot);
  const mask = new Uint8Array(want.length);
  want.forEach((c, i) => { mask[i] = COMPARABLE.test(c) ? 0 : 255; });
  inner.forEach((v, i) => { mask[index[i]] = v; });
  return { mask, share: maskShare(inner, rule.similar) * penalty(kept.length, keptGot.length) };
}

/** Gegen alle erlaubten Antworten — die beste zählt [D2: „dodatkowe poprawne odpowiedzi"]. */
export function checkText(accepted: readonly string[], given: string, rule: TextRule = TEXT_RULE): Outcome {
  const answers = accepted.map((a) => a.trim()).filter((a) => a !== '');
  if (given.trim() === '') return NOTHING;
  if (answers.length === 0) return { correct: false, correctness: 0, answered: true };
  let best: { mask: Uint8Array; share: number; expected: string } | null = null;
  for (const one of answers) {
    const result = compareText(one, given, rule);
    if (best === null || result.share > best.share) best = { ...result, expected: one };
  }
  const share = clamp01(best!.share);
  return { correct: share >= rule.threshold - 1e-9, correctness: share, answered: true, mask: best!.mask, expected: best!.expected };
}

/** Zusammenhängende Stücke gleicher Güte — so zeichnet die Karte den Vergleich. */
export function spansOf(expected: string, mask: Uint8Array): { text: string; level: 'hit' | 'near' | 'miss' }[] {
  const chars = Array.from(expected.trim());
  const out: { text: string; level: 'hit' | 'near' | 'miss' }[] = [];
  chars.forEach((c, i) => {
    const v = mask[i] ?? 0;
    const level = v >= 255 ? 'hit' : v > 0 ? 'near' : 'miss';
    const last = out[out.length - 1];
    if (last !== undefined && last.level === level) out[out.length - 1] = { text: last.text + c, level };
    else out.push({ text: c, level });
  });
  return out;
}

/* -- Zahl und Datum --------------------------------------------------------------- */

export interface NumberExpected {
  readonly values: readonly number[];
  /** Erlaubte Abweichung — absolut, oder mit `relative` als Anteil (0,05 = 5 %). */
  readonly tolerance: number;
  readonly relative: boolean;
}

export function checkNumber(expected: NumberExpected, given: unknown): Outcome {
  const value = readNumber(given);
  if (value === null) return typeof given === 'string' && given.trim() !== '' ? { correct: false, correctness: 0, answered: true } : NOTHING;
  if (expected.values.length === 0) return { correct: false, correctness: 0, answered: true };
  const correct = expected.values.some((v) => {
    const allowed = expected.relative ? Math.abs(v) * Math.max(0, expected.tolerance) : Math.max(0, expected.tolerance);
    return Math.abs(v - value) <= allowed + 1e-9;
  });
  return { correct, correctness: correct ? 1 : 0, answered: true };
}

/**
 * Ein Datum, wie man es eintippt: „1999", „1999-05-03", „3.05.1999", „5.1999",
 * „1000 p.n.e.", „-1000".
 */
export function readDateAnswer(text: string): DateValue | null {
  let t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  let sign = 1;
  const bce = /\s*(p\.?\s?n\.?\s?e\.?|przed chr(ystusem|\.)?|bce?|b\.c\.)$/;
  const ce = /\s*(n\.?\s?e\.?|po chr(ystusie|\.)?|ad|a\.d\.)$/;
  if (bce.test(t)) { sign = -1; t = t.replace(bce, ''); } else if (ce.test(t)) t = t.replace(ce, '');
  const flip = (d: DateValue | null): DateValue | null => (d === null || sign === 1 ? d : readDate(dateKey({ ...d, y: -Math.abs(d.y) })));
  const direct = readDate(t);
  if (direct !== null) return flip(direct);
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](-?\d{1,6})$/.exec(t);
  if (dmy) return flip(readDate(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`));
  const my = /^(\d{1,2})[./](-?\d{1,6})$/.exec(t);
  if (my) return flip(readDate(`${my[2]}-${my[1].padStart(2, '0')}`));
  return null;
}

/** Wie viele Einheiten der Genauigkeit zwei Daten auseinander liegen. Jahr 0 gibt es nicht. */
function distance(a: DateValue, b: DateValue, precision: DatePrecision): number {
  const year = (y: number) => (y < 0 ? y + 1 : y);
  if (precision === 'year') return Math.abs(year(a.y) - year(b.y));
  if (precision === 'month') return Math.abs(year(a.y) * 12 + (a.m ?? 1) - (year(b.y) * 12 + (b.m ?? 1)));
  const day = (d: DateValue) => Date.UTC(year(d.y), (d.m ?? 1) - 1, d.d ?? 1) / 86_400_000;
  return Math.abs(day(a) - day(b));
}

export interface DateExpected {
  readonly values: readonly string[];
  readonly precision: DatePrecision;
  /** Erlaubte Abweichung in Einheiten der Genauigkeit (±1 Jahr). */
  readonly tolerance: number;
}

const RANK: Record<DatePrecision, number> = { year: 0, month: 1, day: 2 };

export function checkDate(expected: DateExpected, given: string): Outcome {
  if (given.trim() === '') return NOTHING;
  const answer = readDateAnswer(given);
  if (answer === null) return { correct: false, correctness: 0, answered: true };
  const precision = expected.precision;
  const have = answer.d !== undefined ? 'day' : answer.m !== undefined ? 'month' : 'year';
  /* Wer nur das Jahr nennt, wo der Tag gefragt ist, hat die Frage nicht beantwortet. */
  if (RANK[have] < RANK[precision]) return { correct: false, correctness: 0, answered: true };
  const mine = coarsen(answer, precision);
  const correct = expected.values.some((raw) => {
    const want = readDate(raw);
    return want !== null && RANK[want.d !== undefined ? 'day' : want.m !== undefined ? 'month' : 'year'] >= RANK[precision]
      && distance(coarsen(want, precision), mine, precision) <= Math.max(0, expected.tolerance);
  });
  return { correct, correctness: correct ? 1 : 0, answered: true };
}

/* -- Wahl, Reihenfolge, Paare ----------------------------------------------------- */

export function checkOne(correct: number, given: number | null | undefined): Outcome {
  if (given === null || given === undefined) return NOTHING;
  const ok = given === correct;
  return { correct: ok, correctness: ok ? 1 : 0, answered: true };
}

/** Mehrere Wahlen: getroffen durch alles, was hätte gewählt werden können — wie im Altbestand. */
export function checkMany(correct: readonly number[], given: readonly number[]): Outcome {
  const want = new Set(correct);
  const got = new Set(given);
  if (got.size === 0) return NOTHING;
  const hits = [...got].filter((g) => want.has(g)).length;
  const ok = hits === want.size && got.size === want.size;
  return { correct: ok, correctness: ok ? 1 : hits / Math.max(want.size, got.size, 1), answered: true };
}

export function checkTrueFalse(correct: boolean, given: boolean | null | undefined): Outcome {
  if (given === null || given === undefined) return NOTHING;
  const ok = given === correct;
  return { correct: ok, correctness: ok ? 1 : 0, answered: true };
}

/** Reihenfolge: der Anteil der Stellen, an denen das Richtige steht. */
export function checkOrder(correct: readonly string[], given: readonly string[]): Outcome {
  if (given.length === 0) return NOTHING;
  const norm = (s: string) => s.trim().toLocaleLowerCase('pl-PL');
  const longest = Math.max(correct.length, given.length, 1);
  let hits = 0;
  for (let i = 0; i < Math.min(correct.length, given.length); i += 1) if (norm(correct[i]) === norm(given[i])) hits += 1;
  const ok = hits === correct.length && given.length === correct.length && correct.length > 0;
  return { correct: ok, correctness: hits / longest, answered: true };
}

/** Paare als Stellen links und rechts: `[[0, 2], [1, 0], …]`. */
export function checkMatch(correct: readonly (readonly [number, number])[], given: readonly (readonly [number, number])[]): Outcome {
  if (given.length === 0) return NOTHING;
  const key = (p: readonly [number, number]) => `${p[0]}:${p[1]}`;
  const want = new Set(correct.map(key));
  const got = new Set(given.map(key));
  const hits = [...got].filter((g) => want.has(g)).length;
  const ok = hits === want.size && got.size === want.size;
  return { correct: ok, correctness: ok ? 1 : hits / Math.max(want.size, got.size, 1), answered: true };
}

/* -- Selbst bewertet, Code, Punkt ---------------------------------------------------- */

export type FlashGrade = 'knew' | 'partly' | 'not';

/** Die Karte, die man umdreht und selbst bewertet [D4]. */
export function checkFlash(grade: FlashGrade | null | undefined): Outcome {
  if (grade === null || grade === undefined) return NOTHING;
  const correctness = grade === 'knew' ? 1 : grade === 'partly' ? 0.5 : 0;
  return { correct: grade === 'knew', correctness, answered: true };
}

/** Code: was Pyodide im Browser über die Fälle der Aufgabe berichtet. */
export function checkCode(result: { readonly passed: number; readonly total: number } | null | undefined): Outcome {
  if (result === null || result === undefined) return NOTHING;
  const total = Math.max(0, Math.floor(result.total));
  const passed = Math.max(0, Math.min(total, Math.floor(result.passed)));
  return { correct: total > 0 && passed === total, correctness: total === 0 ? 0 : passed / total, answered: true };
}

/** Ein Punkt auf einem Bild (x, y in Anteilen 0–1) oder auf der Karte (lat, lon, Halbmesser in Metern). */
export type PointExpected =
  | { readonly x: number; readonly y: number; readonly r: number }
  | { readonly lat: number; readonly lon: number; readonly r: number };

export type PointGiven = { readonly x: number; readonly y: number } | { readonly lat: number; readonly lon: number };

/** Meter zwischen zwei Punkten der Erde (Haversine). */
export function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Im Kreis: richtig. Daneben nimmt die Richtigkeit bis zum dreifachen Halbmesser ab. */
export function checkPoint(expected: PointExpected, given: PointGiven | null | undefined): Outcome {
  if (given === null || given === undefined) return NOTHING;
  let d: number;
  if ('lat' in expected && 'lat' in given) d = metres(expected, given);
  else if ('x' in expected && 'x' in given) d = Math.hypot(expected.x - given.x, expected.y - given.y);
  else return { correct: false, correctness: 0, answered: true };
  const r = Math.max(expected.r, 1e-9);
  if (d <= r) return { correct: true, correctness: 1, answered: true };
  return { correct: false, correctness: clamp01(1 - (d - r) / (2 * r)), answered: true };
}

/* -- Masken zum Aufbewahren --------------------------------------------------------- */

/** Die Maske als Base64 — so steht sie in der versiegelten Antwort. */
export function maskText(mask: Uint8Array): string {
  let binary = '';
  mask.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export function readMask(text: string): Uint8Array {
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}
