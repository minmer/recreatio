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

import { coarsen, dateKey, dateText, precisionOf, readDate, readNumber, type DatePrecision, type DateValue } from './schema';
import { findUnit, kindById, kindsText, measures, parseQuantity, siUnitOf, toSI, type QuantityKind } from '../core/quantities';

/* -- Formen ------------------------------------------------------------------------ */

export const ANSWER_FORMS = ['text', 'number', 'date', 'one', 'many', 'truefalse', 'order', 'match', 'gap', 'flash', 'code', 'point', 'interactive', 'build'] as const;
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
  point: 'Punkt na obrazie albo mapie',
  interactive: 'Rysunek do poruszania (np. fizyka)',
  build: 'Zbuduj z kafelków'
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
  /** 2026-10-23 (Schritt 13) — warum nicht, wenn es nicht an der Zahl lag (eine Einheit einer anderen Grösse). */
  readonly note?: string;
  /** 2026-11-01 — ein Datum: jeder gefragte Teil (Tag, Monat, Jahr) mit seinem eigenen Ergebnis. */
  readonly dateParts?: readonly DatePartMark[];
  /** 2026-11-01 — nah dran, auch wenn der Anteil nicht über die Hälfte kommt (ein Jahr daneben). */
  readonly near?: boolean;
  /** 2026-11-01 — je Stelle (eine gebaute Folge) oder je Lücke: stimmt sie. */
  readonly marks?: readonly boolean[];
  /** 2026-11-01 — gebaut: die richtige Folge, der die Antwort am nächsten kam (`items` oder eine der `alternatives`). */
  readonly solution?: readonly string[];
  /** 2026-11-01 — wie viele Podpowiedzi aufgedeckt waren; jede nahm ein Viertel vom Höchsten (`withHints`). */
  readonly hints?: number;
  /**
   * 2026-11-01 — die richtige Antwort, wie der Autor sie schrieb (mit ihrem Wzór), wo `expected` die Zeile ohne LaTeX
   * ist, mit der verglichen wurde (`typedAccepted`): gezeigt wird diese, verglichen Zeichen für Zeichen mit jener.
   */
  readonly shown?: string;
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
  /** 2026-10-23 (Schritt 13) — die Einheit der erwarteten Werte (wie sie hinter der Zahl steht). */
  readonly unit?: string;
  /** 2026-10-23 (Schritt 13) — welche Grösse gefragt ist (`core/quantities.ts`): dann zählt die Einheit der Antwort. */
  readonly quantity?: string;
}

export function checkNumber(expected: NumberExpected, given: unknown): Outcome {
  const kind = kindById(expected.quantity);
  if (kind !== undefined && typeof given === 'string') return checkQuantity(expected, kind, given);
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
 * 2026-10-23 (Schritt 13) — EINE GRÖSSE: verglichen in SI, und nur innerhalb
 * ihrer Art. „12 N·m" auf ein Drehmoment von 12 N·m gilt, „0,012 kN·m" auch;
 * „12 J" nicht — dieselbe Dimension, aber eine Energie. Ohne Einheit gilt die
 * der Frage (sie steht neben dem Feld).
 */
function checkQuantity(expected: NumberExpected, kind: QuantityKind, given: string): Outcome {
  const read = parseQuantity(given);
  if (read === null) return given.trim() === '' ? NOTHING : { correct: false, correctness: 0, answered: true };
  if (expected.values.length === 0) return { correct: false, correctness: 0, answered: true };
  const own = findUnit(expected.unit) ?? siUnitOf(kind.id);
  if (own === undefined) return { correct: false, correctness: 0, answered: true };
  let unit = own;
  if (read.unitText !== '') {
    if (read.unit === undefined) return { correct: false, correctness: 0, answered: true, note: `Nie znam jednostki „${read.unitText}”.` };
    if (!measures(read.unit, kind.id)) {
      return { correct: false, correctness: 0, answered: true, note: `„${read.unit.symbol}” to jednostka wielkości: ${kindsText(read.unit.kinds)} — a pytanie dotyczy wielkości: ${kind.label}.` };
    }
    unit = read.unit;
  }
  const si = toSI(read.value, unit);
  const correct = expected.values.some((v) => {
    const want = toSI(v, own);
    const allowed = (expected.relative ? Math.abs(v) * Math.max(0, expected.tolerance) : Math.max(0, expected.tolerance)) * own.factor;
    return Math.abs(want - si) <= allowed + 1e-9 * Math.max(1, Math.abs(want));
  });
  return { correct, correctness: correct ? 1 : 0, answered: true };
}

/* 2026-11-01 — Monate als Wort: die ersten drei Buchstaben (ohne Polnische Zeichen) jeder Form — listopad, listopada,
   w listopadzie, lis., November. */
const MONTH_STEM: Readonly<Record<string, number>> = {
  sty: 1, lut: 2, mar: 3, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, lis: 11, gru: 12,
  jan: 1, feb: 2, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};
const ROMAN_MONTH = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
/** Wörter, die um ein Datum stehen dürfen, ohne etwas zu sagen: „3-go listopada 1829 r.", „w roku 1829", „ok. 1829". */
const DATE_FILLER: ReadonlySet<string> = new Set(['r', 'rok', 'roku', 'w', 'we', 'dnia', 'dn', 'dzien', 'dniu', 'ok', 'okolo', 'ca', 'circa', 'go', 'ego', 'the', 'of', 'in', 'on', 'year', 'st', 'nd', 'rd', 'th']);
const BCE_END = /(?<=^|[\s\d.])(p\.?\s?n\.?\s?e\.?|przed\s+chr(?:ystusem|\.)?|bce?|b\.\s?c\.)$/i;
const CE_END = /(?<=^|[\s\d.])(n\.?\s?e\.?|po\s+chr(?:ystusie|\.)?|ad|a\.\s?d\.)$/i;
const plainWord = (w: string): string => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/**
 * EIN DATUM, WIE MAN ES EINTIPPT — 2026-11-01 in jeder üblichen Form: „1829", „1829-11", „1829 11", „11 1829",
 * „11.1829", „3.11.1829", „1829/11/3", „listopad 1829", „3 listopada 1829 r.", „w listopadzie 1829", „3 XI 1829",
 * „November 1829", „1000 p.n.e.", „-1000". Die Zahl mit drei Stellen (oder über 31) ist das Jahr; steht der Monat als
 * Wort, ist die andere Zahl der Tag. Ein Wort, das kein Monat ist und nicht zu einem Datum gehört, macht es unlesbar
 * (`null`) — lieber nachfragen als falsch lesen.
 */
export function readDateAnswer(text: string): DateValue | null {
  let raw = text.trim().replace(/\s+/g, ' ');
  if (raw === '') return null;
  let sign = 1;
  if (BCE_END.test(raw)) { sign = -1; raw = raw.replace(BCE_END, '').trim(); } else if (CE_END.test(raw)) raw = raw.replace(CE_END, '').trim();
  const flip = (d: DateValue | null): DateValue | null => (d === null || sign === 1 ? d : readDate(dateKey({ ...d, y: -Math.abs(d.y) })));
  const direct = readDate(raw);
  if (direct !== null) return flip(direct);

  const numbers: { value: number; digits: number; at: number }[] = [];
  let month: { value: number; at: number } | null = null;
  const tokens = [...raw.matchAll(/\d+|\p{L}+/gu)].map((m) => m[0]);
  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at];
    if (/^\d+$/.test(token)) { numbers.push({ value: Number(token), digits: token.length, at }); continue; }
    const word = plainWord(token);
    if (DATE_FILLER.has(word)) continue;
    /* Römisch nur ab zwei Zeichen — oder gross geschrieben (I, V, X): ein kleines „i" ist „und". */
    const roman = ROMAN_MONTH.indexOf(word);
    const stem = word.length >= 3 ? MONTH_STEM[word.slice(0, 3)] : undefined;
    const named = roman >= 0 && (token.length > 1 || token === token.toUpperCase()) ? roman + 1 : stem;
    if (named === undefined || month !== null) return null;
    month = { value: named, at };
  }
  const yearLike = (n: { value: number; digits: number }) => n.digits >= 3 || n.value > 31;
  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;
  if (month !== null) {
    m = month.value;
    if (numbers.length === 1) {
      /* „3 listopada" — ein Tag ohne Jahr: unlesbar (nicht das Jahr 3). */
      const [n] = numbers;
      if (!yearLike(n) && n.at < month.at) return null;
      y = n.value;
    } else if (numbers.length === 2) {
      const [a, b] = numbers;
      /* Das Jahr: die Zahl, die eines sein muss — sind beide klein, die nach dem Monat („3 listopada 29"). */
      let year: typeof a | null;
      if (yearLike(a) !== yearLike(b)) year = yearLike(a) ? a : b;
      else if (!yearLike(a)) year = b.at > month.at ? b : null;
      else year = null;
      if (year === null) return null;
      y = year.value;
      d = (year === a ? b : a).value;
    } else return null;
  } else if (numbers.length === 1) y = numbers[0].value;
  else if (numbers.length === 2) {
    const [a, b] = numbers;
    if (yearLike(a) && yearLike(b)) return null;
    if (yearLike(a)) { y = a.value; m = b.value; } else { m = a.value; y = b.value; }
  } else if (numbers.length === 3) {
    const [a, b, c] = numbers;
    if (yearLike(a)) { y = a.value; m = b.value; d = c.value; }
    else if (yearLike(c)) {
      y = c.value;
      /* Gewöhnlich Tag, Monat, Jahr; steht im zweiten Feld etwas über 12, war es Monat, Tag, Jahr. */
      if (b.value > 12 && a.value <= 12) { m = a.value; d = b.value; } else { d = a.value; m = b.value; }
    } else return null;
  } else return null;
  if (y === undefined) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return flip(readDate(m === undefined ? String(y) : d === undefined ? `${y}-${pad(m)}` : `${y}-${pad(m)}-${pad(d)}`));
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

/** 2026-11-01 — die Teile, die eine Frage nach dieser Genauigkeit prüft, in der Folge, in der man ein Datum liest. */
export const DATE_PARTS: Readonly<Record<DatePrecision, readonly DatePrecision[]>> = { year: ['year'], month: ['month', 'year'], day: ['day', 'month', 'year'] };

/** Was jeder Teil wert ist: das Jahr die Hälfte (gefragt nur das Jahr: alles), Monat und Tag teilen sich den Rest. */
const PART_WEIGHT: Readonly<Record<DatePrecision, Readonly<Partial<Record<DatePrecision, number>>>>> = {
  year: { year: 1 },
  month: { year: 0.5, month: 0.5 },
  day: { year: 0.5, month: 0.25, day: 0.25 }
};

/** Ein Teil um eins daneben (ein Jahr, ein Monat, ein Tag) ist nah: die Hälfte. */
export const DATE_NEAR = 0.5;

/** Ein Teil eines Datums nach der Prüfung: was gegeben war (`null`: fehlt), was richtig ist, wie viel es wert ist (1, ½, 0). */
export interface DatePartMark {
  readonly part: DatePrecision;
  readonly given: number | null;
  readonly expected: number;
  readonly score: number;
}

/** Wie genau eine Datumsfrage fragt: nie genauer, als die richtige Antwort bekannt ist (nur ein Jahr: nur das Jahr). */
export function dateAsked(expected: Pick<DateExpected, 'values' | 'precision'>): DatePrecision {
  let finest = -1;
  for (const raw of expected.values) {
    const want = readDate(raw);
    if (want !== null) finest = Math.max(finest, RANK[precisionOf(want)]);
  }
  return finest < 0 || finest >= RANK[expected.precision] ? expected.precision : (['year', 'month', 'day'] as const)[finest];
}

/**
 * Jeder Teil für sich: gleich — ganz; um eins daneben — halb; sonst nichts. Um eins daneben ist ein Monat (ein Tag)
 * auch, wenn er im Kalender gleich daneben liegt: Dezember 1829 und Januar 1830, der 31. und der 1.
 */
function partMark(part: DatePrecision, want: DateValue, got: DateValue): DatePartMark {
  const year = (y: number) => (y < 0 ? y + 1 : y);
  const score = (gap: number, span: number) => (gap === 0 ? 1 : gap === 1 || span === 1 ? DATE_NEAR : 0);
  if (part === 'year') { const gap = Math.abs(year(want.y) - year(got.y)); return { part, given: got.y, expected: want.y, score: score(gap, gap) }; }
  if (part === 'month') {
    const expected = want.m ?? 1;
    if (got.m === undefined) return { part, given: null, expected, score: 0 };
    return { part, given: got.m, expected, score: score(Math.abs(expected - got.m), distance(coarsen(want, 'month'), coarsen(got, 'month'), 'month')) };
  }
  const expected = want.d ?? 1;
  if (got.d === undefined) return { part, given: null, expected, score: 0 };
  return { part, given: got.d, expected, score: score(Math.abs(expected - got.d), distance(want, got, 'day')) };
}

/** Was unter einer Datumsfrage steht, wenn die Antwort sich nicht lesen lässt. */
export const DATE_UNREAD = 'Nie rozumiem tej daty — wpisz np. 11.1829, 1829-11 albo „listopad 1829”.';

/**
 * EIN DATUM, so genau wie gefragt. 2026-11-01 — JEDER TEIL FÜR SICH: Jahr, Monat und Tag werden einzeln verglichen;
 * gleich zählt ganz, um eins daneben halb („nah"), sonst nichts. Das Jahr ist die Hälfte wert (wird nur das Jahr
 * gefragt, alles), Monat und Tag teilen sich die andere Hälfte. Richtig ist es, wenn jeder Teil stimmt — oder die
 * Antwort innerhalb der Toleranz der Frage liegt. Mehrere richtige Antworten: die, der die Antwort am nächsten kommt.
 */
export function checkDate(expected: DateExpected, given: string): Outcome {
  if (given.trim() === '') return NOTHING;
  const answer = readDateAnswer(given);
  if (answer === null) return { correct: false, correctness: 0, answered: true, note: DATE_UNREAD };
  let best: Outcome | null = null;
  for (const raw of expected.values) {
    const want = readDate(raw);
    if (want === null) continue;
    const asked = RANK[precisionOf(want)] < RANK[expected.precision] ? precisionOf(want) : expected.precision;
    const marks = DATE_PARTS[asked].map((part) => partMark(part, want, answer));
    const exact = marks.every((m) => m.score === 1);
    const within = expected.tolerance > 0 && RANK[precisionOf(answer)] >= RANK[asked]
      && distance(coarsen(want, asked), coarsen(answer, asked), asked) <= expected.tolerance;
    const correct = exact || within;
    const correctness = correct ? 1 : marks.reduce((sum, m) => sum + (PART_WEIGHT[asked][m.part] ?? 0) * m.score, 0);
    /* „Nah": kein Teil ganz daneben — auch wenn die Hälfte nicht über der Grenze für „prawie" liegt (ein Jahr daneben). */
    const near = !correct && marks.every((m) => m.score > 0);
    const outcome: Outcome = { correct, correctness, answered: true, expected: dateText(want), dateParts: marks, ...(near ? { near } : {}) };
    if (best === null || outcome.correctness > best.correctness) best = outcome;
  }
  return best ?? { correct: false, correctness: 0, answered: true };
}

/* -- Wahl, Reihenfolge, Paare ----------------------------------------------------- */

export function checkOne(correct: number, given: number | null | undefined): Outcome {
  if (given === null || given === undefined) return NOTHING;
  const ok = given === correct;
  return { correct: ok, correctness: ok ? 1 : 0, answered: true };
}

/** Mehrere Wahlen: getroffen durch alles, was hätte gewählt werden können — wie im Altbestand. */
/**
 * „Kilka z kilku". 2026-11-01 — mit `count` (wie viele Sätze dastehen) zählt JEDER SATZ FÜR SICH: richtig, wenn er
 * angekreuzt ist und es sein soll, oder frei bleibt und es soll; die Richtigkeit ist der Durchschnitt der Sätze. Ohne
 * `count` wie früher: Treffer ÷ max(gewollt, gegeben).
 */
export function checkMany(correct: readonly number[], given: readonly number[], count?: number): Outcome {
  const want = new Set(correct);
  const got = new Set(given);
  if (got.size === 0) return NOTHING;
  const hits = [...got].filter((g) => want.has(g)).length;
  const ok = hits === want.size && got.size === want.size;
  if (ok) return { correct: true, correctness: 1, answered: true };
  if (count !== undefined && count > 0) {
    let right = 0;
    for (let i = 0; i < count; i++) if (want.has(i) === got.has(i)) right++;
    return { correct: false, correctness: right / count, answered: true };
  }
  return { correct: false, correctness: hits / Math.max(want.size, got.size, 1), answered: true };
}

export function checkTrueFalse(correct: boolean, given: boolean | null | undefined): Outcome {
  if (given === null || given === undefined) return NOTHING;
  const ok = given === correct;
  return { correct: ok, correctness: ok ? 1 : 0, answered: true };
}

/**
 * 2026-10-31 — WAS EINE DATUMSFRAGE VERLANGT, in Worten: jede Karte sagt es unter der Frage, damit niemand raten muss,
 * ob das Jahr genügt (im Allgemeinen genügt es; der genaue Tag kommt im Thema, das davon erzählt).
 */
export const PRECISION_ASK: Readonly<Record<DatePrecision, string>> = {
  year: 'Podaj rok.',
  month: 'Podaj miesiąc i rok.',
  day: 'Podaj dzień, miesiąc i rok.'
};

/** Ein Stück der Reihenfolge nach der Prüfung: steht es an seiner Stelle, und welche ist seine (1 = die erste). */
export interface OrderMark {
  readonly right: boolean;
  readonly place: number;
}

/**
 * 2026-10-31 — DIE MARKEN AUF DER EIGENEN ANTWORT (Ułóż w kolejności): je gegebenem Stück, ob es richtig steht und wohin
 * es gehört. Gleiche Texte (zweimal „1841”) bekommen je eine eigene Stelle — die, an der es steht, wenn sie dort
 * richtig ist, sonst die erste freie.
 */
export function orderMarks(correct: readonly string[], given: readonly string[]): OrderMark[] {
  const norm = (s: string) => s.trim().toLocaleLowerCase('pl-PL');
  const want = correct.map(norm);
  const used = new Set<number>();
  const place: number[] = given.map(() => -1);
  given.forEach((g, i) => { if (want[i] === norm(g)) { place[i] = i; used.add(i); } });
  given.forEach((g, i) => {
    if (place[i] >= 0) return;
    const at = want.findIndex((w, j) => !used.has(j) && w === norm(g));
    if (at >= 0) { place[i] = at; used.add(at); }
  });
  return place.map((p, i) => ({ right: p === i, place: p + 1 }));
}

/**
 * Reihenfolge: der Anteil der Stellen, an denen das Richtige steht — 2026-10-31 oder, wenn das mehr ist, der Anteil der
 * richtigen Nachbarn (a direkt vor b, wie es sein soll): ein einziges verschobenes Stück lässt sonst alles dahinter
 * falsch stehen, und ein Tausch ist kein völliger Fehlschlag.
 */
export function checkOrder(correct: readonly string[], given: readonly string[]): Outcome {
  if (given.length === 0) return NOTHING;
  const norm = (s: string) => s.trim().toLocaleLowerCase('pl-PL');
  const longest = Math.max(correct.length, given.length, 1);
  let hits = 0;
  for (let i = 0; i < Math.min(correct.length, given.length); i += 1) if (norm(correct[i]) === norm(given[i])) hits += 1;
  const ok = hits === correct.length && given.length === correct.length && correct.length > 0;
  const pairs = new Set<string>();
  for (let i = 0; i + 1 < correct.length; i += 1) pairs.add(`${norm(correct[i])}\u0000${norm(correct[i + 1])}`);
  let neighbours = 0;
  for (let i = 0; i + 1 < given.length; i += 1) if (pairs.delete(`${norm(given[i])}\u0000${norm(given[i + 1])}`)) neighbours += 1;
  const byNeighbours = correct.length > 1 ? neighbours / (Math.max(correct.length, given.length) - 1) : 0;
  return { correct: ok, correctness: ok ? 1 : Math.max(hits / longest, byNeighbours), answered: true };
}

/**
 * 2026-11-01 — AUS KACHELN GEBAUT: richtig, wenn die Folge eine der richtigen ist (`items` oder eine der `alternatives`).
 * Sonst zählt die nächste richtige Folge: der Anteil des richtigen Anfangs — oder, wenn das mehr ist, was `checkOrder`
 * gäbe (Stellen und Nachbarn) —, je Stelle ✓/✗ gegen sie. Gekachelt wird aus der Bank: Texte werden genau verglichen.
 */
export function checkBuild(targets: readonly (readonly string[])[], given: readonly string[]): Outcome {
  if (given.length === 0) return NOTHING;
  const norm = (s: string) => s.trim();
  const wanted = targets.filter((t) => t.length > 0);
  if (wanted.length === 0) return { correct: false, correctness: 0, answered: true };
  let best: { share: number; prefix: number; target: readonly string[] } | null = null;
  for (const t of wanted) {
    if (t.length === given.length && t.every((x, i) => norm(x) === norm(given[i]!))) {
      return { correct: true, correctness: 1, answered: true, marks: given.map(() => true), solution: t };
    }
    let prefix = 0;
    while (prefix < t.length && prefix < given.length && norm(t[prefix]!) === norm(given[prefix]!)) prefix += 1;
    const share = Math.max(prefix / Math.max(t.length, given.length), checkOrder(t, given).correctness);
    /* Bei Gleichstand die Folge, deren Anfang schon steht — dorthin war der Lernende unterwegs. */
    if (best === null || share > best.share + 1e-9 || (Math.abs(share - best.share) <= 1e-9 && prefix > best.prefix)) best = { share, prefix, target: t };
  }
  const target = best!.target;
  return { correct: false, correctness: Math.min(best!.share, 0.99), answered: true, marks: given.map((g, i) => target[i] !== undefined && norm(target[i]!) === norm(g)), solution: target };
}

/**
 * 2026-11-01 — MEHRERE LÜCKEN: jede für sich — gewählt (genau), getippt (wie eine Lücke, `rule`). Der Anteil ist der
 * Anteil der richtigen Lücken; richtig ist die Antwort, wenn jede stimmt.
 */
export function checkGaps(slots: readonly { readonly accepted: readonly string[]; readonly choices?: readonly string[] }[], given: readonly string[], rule: TextRule): Outcome {
  if (given.every((g) => (g ?? '').trim() === '')) return NOTHING;
  const marks = slots.map((slot, i) => {
    const one = (given[i] ?? '').trim();
    if (one === '') return false;
    if (slot.choices !== undefined && slot.choices.length > 0) return slot.accepted.some((a) => a.trim() === one);
    return checkText(slot.accepted, one, rule).correct;
  });
  const right = marks.filter(Boolean).length;
  return { correct: slots.length > 0 && right === slots.length, correctness: slots.length === 0 ? 0 : right / slots.length, answered: true, marks };
}

/**
 * 2026-11-01 — PODPOWIEDZI KOSTEN: jede aufgedeckte nimmt `cost` (ein Viertel) vom Höchsten dieser Antwort — eine
 * richtige Antwort mit einer Podpowiedź zählt 0,75, mit zweien 0,5; die Kenntnis nimmt sie als teilweise richtig.
 */
export function withHints(outcome: Outcome, used: number, cost = 0.25): Outcome {
  const n = Math.max(0, Math.floor(used));
  if (n === 0) return outcome;
  return { ...outcome, correctness: Math.min(outcome.correctness, Math.max(0, 1 - cost * n)), hints: n };
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
