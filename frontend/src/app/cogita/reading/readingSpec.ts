/**
 * 2026-11-22 (Homer-Einheit, „R · Lektüre mit Aufgaben") — DREI ARTEN DER FRAGE AN EINEM ABSCHNITT EINES TEXTES DER BIBLIOTHEK.
 *
 * Der Text steht nie in der Welt: die Frage nennt nur das Werk und die Stelle (`passage`), der Browser holt den Abschnitt
 * aus der Bibliothek (die Quellen der Baza, sonst jede offene Bibliothek — `PassageLines.tsx`). Die Zeilen des Abschnitts
 * sind von 1 an gezählt, lokal für den Abschnitt: jeder Block wird an seinen Zeilenumbrüchen geteilt (ein Vers je Zeile).
 *
 * <code>
 *   lines   „Zaznacz wers, w którym …"   lines: "3-5, 9"                  gegeben: [3, 4, 5, 9]   teils: Treffer − Fehlgriffe
 *   label   Zeilen einer Rolle zuordnen   roles + labels "1: Hektor"       gegeben: Rolle je Zeile  teils: Anteil richtiger Zeilen
 *   span    Anfang und Ende eines Mittels spans: "12-15; 30-31"           gegeben: [von, bis]      teils: Überlappung (IoU)
 * </code>
 *
 * Fehler-Tags (`tags`, wie bei den anderen Arten, für `wrong:<tag>`): Zeilen "7: myli-narratora", "12-13: zbyt-doslownie" —
 * eine falsch gewählte oder übersehene Zeile (lines), eine falsch zugeordnete (label), eine Auswahl, die den Bereich trifft
 * (span), trägt den Tag ihres Bereichs.
 *
 * Słowniczek: Einträge eines Rodzaj, dessen Felder die Marke `glossary` tragen — `word` (das Wort), `forms` (weitere Formen,
 * eine je Zeile oder mit Komma), `meaning` (die Bedeutung), `work` (optional, ein Verweis: nur in diesem Werk). Im Abschnitt
 * ist jedes solche Wort unterstrichen; ein Tippen zeigt die Bedeutung.
 *
 * Rein (ohne React, ohne Netz) — `scripts/app-reading-check.mjs` prüft es.
 */

import { plainOfText, type SourceBlock } from '../../library/sourceText';

export interface PassageRef {
  /** Das Werk: eine Kennung, ein Schlüssel der Bibliothek oder ein bleibender Name („@iliada-dmochowski"). */
  readonly work: string;
  readonly locator: string;
}

export type ReadingForm = 'lines' | 'label' | 'span';
export const READING_FORMS: readonly ReadingForm[] = ['lines', 'label', 'span'];
export const isReadingForm = (f: unknown): f is ReadingForm => f === 'lines' || f === 'label' || f === 'span';

export type ReadingSpec =
  | { readonly form: 'lines'; readonly passage: PassageRef; readonly correct: readonly number[] }
  | { readonly form: 'label'; readonly passage: PassageRef; readonly marked: readonly number[]; readonly roles: readonly string[]; readonly correct: readonly number[] }
  | { readonly form: 'span'; readonly passage: PassageRef; readonly spans: readonly (readonly [number, number])[] };

/** So viele Zeilen hat ein Abschnitt höchstens (eine Stelle, die ein ganzes Buch meint, wird abgeschnitten). */
export const MAX_LINES = 400;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/* -- Bereiche ------------------------------------------------------------------------------------------------------ */

/** Ein Bereich „3-5" / „3–5" / „9" → [von, bis]; `null`: keiner. */
export function readRange(raw: string): [number, number] | null {
  const m = /^\s*(\d{1,4})\s*(?:[-–—]\s*(\d{1,4}))?\s*$/.exec(raw);
  if (m === null) return null;
  const a = Number(m[1]);
  const b = m[2] === undefined ? a : Number(m[2]);
  if (a < 1 || b < 1) return null;
  return a <= b ? [a, b] : [b, a];
}

/** Bereiche aus Text („3-5, 9; 12") oder einer Liste (Zahlen, Texte, [von, bis]). */
export function readRanges(raw: unknown): [number, number][] {
  const parts: unknown[] = Array.isArray(raw) ? raw : typeof raw === 'string' || typeof raw === 'number' ? str(raw).split(/[,;\n]/) : [];
  const out: [number, number][] = [];
  for (const p of parts) {
    if (Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1)) {
      const [a, b] = p as [number, number];
      out.push(a <= b ? [a, b] : [b, a]);
      continue;
    }
    const r = readRange(str(p));
    if (r !== null) out.push(r);
  }
  return out;
}

/** Die Zeilen der Bereiche, sortiert, ohne doppelte. */
export function linesOf(raw: unknown): number[] {
  const out = new Set<number>();
  for (const [a, b] of readRanges(raw)) for (let i = a; i <= Math.min(b, a + MAX_LINES); i += 1) out.add(i);
  return [...out].sort((x, y) => x - y);
}

/** Zeilen wieder als kurzer Text: [3,4,5,9] → „3–5, 9". */
export function rangesText(lines: readonly number[]): string {
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j += 1;
    out.push(j === i ? String(sorted[i]) : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return out.join(', ');
}

/* -- Die Frage lesen --------------------------------------------------------------------------------------------- */

/** Die Stelle: `{work, locator}` (auch `{value, locator}` wie ein Verweis mit Stelle). `null`: keine. */
export function readPassage(raw: unknown): PassageRef | null {
  if (!isObject(raw)) return null;
  const work = str(raw.work ?? raw.value).trim();
  if (work === '') return null;
  return { work, locator: str(raw.locator).trim() };
}

/** Rollen: eine Liste oder Zeilen. */
export const readRoles = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw.map(str) : str(raw).split('\n')).map((x) => x.trim()).filter((x) => x !== '');

/**
 * Die Zuordnung: Zeilen „3-4: Achilles" oder Objekte `{lines, role}` → je markierte Zeile die Rolle (Name oder Nummer
 * in `roles`). Unbekannte Rollen fallen weg.
 */
export function readLabels(raw: unknown, roles: readonly string[]): { marked: number[]; correct: number[]; unknown: number } {
  const items: { lines: unknown; role: string }[] = [];
  const list = Array.isArray(raw) ? raw : str(raw).split('\n');
  for (const one of list) {
    if (isObject(one)) { items.push({ lines: one.lines ?? one.line, role: str(one.role).trim() }); continue; }
    const m = /^\s*([\d\s,;–—-]+?)\s*[:=]\s*(.+?)\s*$/.exec(str(one));
    if (m !== null) items.push({ lines: m[1], role: m[2]! });
  }
  const byLine = new Map<number, number>();
  const norm = (s: string) => s.trim().toLocaleLowerCase('pl-PL');
  let unknown = 0;
  for (const it of items) {
    let role = roles.findIndex((r) => norm(r) === norm(it.role));
    if (role < 0 && /^\d+$/.test(it.role) && Number(it.role) < roles.length) role = Number(it.role);
    if (role < 0) { unknown += 1; continue; }
    for (const line of linesOf(it.lines)) byLine.set(line, role);
  }
  const marked = [...byLine.keys()].sort((a, b) => a - b);
  return { marked, correct: marked.map((l) => byLine.get(l)!), unknown };
}

/** Die Antwort einer Frage dieser drei Arten aus ihren Daten — `null`: es fehlt etwas. */
export function readingSpecOf(form: ReadingForm, d: Readonly<Record<string, unknown>>): ReadingSpec | null {
  const passage = readPassage(d.passage);
  if (passage === null) return null;
  if (form === 'lines') {
    const correct = linesOf(d.lines);
    return correct.length === 0 ? null : { form, passage, correct };
  }
  if (form === 'label') {
    const roles = readRoles(d.roles);
    if (roles.length < 2) return null;
    const { marked, correct } = readLabels(d.labels, roles);
    return marked.length === 0 ? null : { form, passage, marked, roles, correct };
  }
  const spans = readRanges(d.spans);
  return spans.length === 0 ? null : { form, passage, spans };
}

/** Was in den Daten noch fehlt — Schlüssel unter `cogitaData.questionProblem.*`. */
export function readingProblems(form: ReadingForm, d: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = [];
  if (readPassage(d.passage) === null) out.push('passage');
  if (form === 'lines' && linesOf(d.lines).length === 0) out.push('readLines');
  if (form === 'label') {
    const roles = readRoles(d.roles);
    if (roles.length < 2) out.push('readRoles');
    else if (readLabels(d.labels, roles).marked.length === 0) out.push('readLabels');
  }
  if (form === 'span' && readRanges(d.spans).length === 0) out.push('readSpans');
  return out;
}

/* -- Prüfen ------------------------------------------------------------------------------------------------------- */

export interface ReadingOutcome {
  readonly correct: boolean;
  readonly correctness: number;
  readonly answered: boolean;
  /** lines: je gewählte Zeile (sortiert) ob richtig; label: je markierte Zeile. */
  readonly marks?: readonly boolean[];
}

const NOTHING: ReadingOutcome = { correct: false, correctness: 0, answered: false };

export const givenLines = (given: unknown): number[] =>
  Array.isArray(given) ? [...new Set(given.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1))].sort((a, b) => a - b) : [];

/** Zeilen wählen: richtig nur genau die richtigen; sonst (Treffer − Fehlgriffe) / richtige, nie unter 0. */
export function checkLines(correct: readonly number[], given: unknown): ReadingOutcome {
  const got = givenLines(given);
  if (got.length === 0) return NOTHING;
  const want = new Set(correct);
  const marks = got.map((l) => want.has(l));
  const hits = marks.filter(Boolean).length;
  const wrong = got.length - hits;
  const ok = hits === want.size && wrong === 0;
  return { correct: ok, correctness: ok ? 1 : Math.max(0, (hits - wrong) / Math.max(1, want.size)), answered: true, marks };
}

/** Zeilen zuordnen: der Anteil richtig zugeordneter Zeilen; unbeantwortet, solange keine Zeile eine Rolle hat. */
export function checkLabel(correct: readonly number[], given: unknown): ReadingOutcome {
  const got = Array.isArray(given) ? given.map((g) => (typeof g === 'number' && Number.isInteger(g) ? g : -1)) : [];
  if (!got.some((g) => g >= 0)) return NOTHING;
  const marks = correct.map((c, i) => got[i] === c);
  const right = marks.filter(Boolean).length;
  return { correct: right === correct.length && correct.length > 0, correctness: correct.length === 0 ? 0 : right / correct.length, answered: true, marks };
}

/** Ein gewählter Bereich [von, bis]. */
export function givenSpan(given: unknown): [number, number] | null {
  if (!Array.isArray(given) || given.length !== 2 || !given.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1)) return null;
  const [a, b] = given as [number, number];
  return a <= b ? [a, b] : [b, a];
}

/** Überlappung zweier Bereiche (Zeilen gemeinsam / Zeilen zusammen). */
export function spanOverlap(a: readonly [number, number], b: readonly [number, number]): number {
  const common = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]) + 1);
  const all = Math.max(a[1], b[1]) - Math.min(a[0], b[0]) + 1;
  return all <= 0 ? 0 : common / all;
}

/** Anfang und Ende finden: richtig, wenn der Bereich genau einer der richtigen ist; sonst die beste Überlappung. */
export function checkSpan(spans: readonly (readonly [number, number])[], given: unknown): ReadingOutcome {
  const g = givenSpan(given);
  if (g === null) return NOTHING;
  const best = Math.max(0, ...spans.map((s) => spanOverlap(s, g)));
  return { correct: best === 1, correctness: best, answered: true };
}

export function checkReading(a: ReadingSpec, given: unknown): ReadingOutcome {
  if (a.form === 'lines') return checkLines(a.correct, given);
  if (a.form === 'label') return checkLabel(a.correct, given);
  return checkSpan(a.spans, given);
}

/** Was als richtig gilt (für den Fingerabdruck der Karte). */
export function readingExpected(a: ReadingSpec): unknown {
  const p = { w: a.passage.work, l: a.passage.locator };
  if (a.form === 'lines') return { f: 'lines', p, c: a.correct };
  if (a.form === 'label') return { f: 'label', p, m: a.marked, r: a.roles, c: a.correct };
  return { f: 'span', p, s: a.spans };
}

/** Für die Teilnehmer: ohne das Richtige (Abschnitt, markierte Zeilen und Rollen bleiben). */
export function stripReading(a: ReadingSpec): ReadingSpec {
  if (a.form === 'lines') return { ...a, correct: [] };
  if (a.form === 'label') return { ...a, correct: [] };
  return { ...a, spans: [] };
}

/** Die richtige Antwort, kurz (Zeilen „3–5, 9"; Zuordnung „1 Hektor · 3–4 Achilles"; Bereich „12–15"). */
export function readingAnswerText(a: ReadingSpec, words: { readonly line: string }): string {
  if (a.form === 'lines') return `${words.line} ${rangesText(a.correct)}`;
  if (a.form === 'label') {
    const groups = new Map<number, number[]>();
    a.marked.forEach((l, i) => { const r = a.correct[i] ?? -1; groups.set(r, [...(groups.get(r) ?? []), l]); });
    return [...groups.entries()].map(([r, ls]) => `${rangesText(ls)} ${a.roles[r] ?? '?'}`).join(' · ');
  }
  return a.spans.map(([x, y]) => (x === y ? String(x) : `${x}–${y}`)).join(' / ');
}

/** Die gegebene Antwort, kurz. */
export function readingGivenText(a: ReadingSpec, given: unknown): string {
  if (a.form === 'lines') return rangesText(givenLines(given));
  if (a.form === 'label') {
    const got = Array.isArray(given) ? given : [];
    return a.marked.map((l, i) => `${l} ${typeof got[i] === 'number' && got[i] >= 0 ? a.roles[got[i] as number] ?? '?' : '—'}`).join(' · ');
  }
  const g = givenSpan(given);
  return g === null ? '' : g[0] === g[1] ? String(g[0]) : `${g[0]}–${g[1]}`;
}

/* -- Fehler-Tags ------------------------------------------------------------------------------------------------ */

/** Die Tags je Bereich: Zeilen „7: tag", „12-13: tag" (oder `{lines, tag}`). */
export function readLineTags(raw: unknown): { readonly lines: ReadonlySet<number>; readonly tag: string }[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('\n') : [];
  const out: { lines: Set<number>; tag: string }[] = [];
  for (const one of list) {
    if (isObject(one)) {
      const tag = str(one.tag).trim();
      const lines = linesOf(one.lines ?? one.line);
      if (tag !== '' && lines.length > 0) out.push({ lines: new Set(lines), tag });
      continue;
    }
    const m = /^\s*([\d\s,;–—-]+?)\s*:\s*(\S.*?)\s*$/.exec(str(one));
    if (m === null) continue;
    const lines = linesOf(m[1]);
    if (lines.length > 0) out.push({ lines: new Set(lines), tag: m[2]! });
  }
  return out;
}

/** Welche Fehler-Tags eine Antwort trägt (ohne doppelte, in der Folge der Tags). */
export function readingTags(a: ReadingSpec, tagsRaw: unknown, given: unknown): string[] {
  const tagged = readLineTags(tagsRaw);
  if (tagged.length === 0) return [];
  const touched = new Set<number>();
  if (a.form === 'lines') {
    const got = new Set(givenLines(given));
    const want = new Set(a.correct);
    for (const l of got) if (!want.has(l)) touched.add(l);
    for (const l of want) if (!got.has(l)) touched.add(l);
  } else if (a.form === 'label') {
    const got = Array.isArray(given) ? given : [];
    a.marked.forEach((l, i) => { if (got[i] !== a.correct[i]) touched.add(l); });
  } else {
    const g = givenSpan(given);
    if (g === null || a.spans.some((s) => spanOverlap(s, g) === 1)) return [];
    for (let l = g[0]; l <= Math.min(g[1], g[0] + MAX_LINES); l += 1) touched.add(l);
  }
  const out: string[] = [];
  for (const t of tagged) if ([...touched].some((l) => t.lines.has(l)) && !out.includes(t.tag)) out.push(t.tag);
  return out;
}

/* -- Der Abschnitt als Zeilen ------------------------------------------------------------------------------------- */

const SKIP: ReadonlySet<string> = new Set(['heading', 'note', 'page', 'figure', 'table']);

/** Die Zeilen der getroffenen Blöcke: jeder Block an seinen Zeilenumbrüchen geteilt, ohne Zeichen, leere fallen weg. */
export function passageLinesOf(blocks: readonly SourceBlock[], hit: readonly number[]): string[] {
  const out: string[] = [];
  for (const i of hit) {
    const b = blocks[i];
    if (b === undefined || SKIP.has(b.type)) continue;
    const texts = b.items !== undefined && b.items.length > 0 ? b.items : [b.text ?? ''];
    for (const text of texts) {
      for (const raw of text.split(/\r?\n/)) {
        const line = plainOfText(raw);
        if (line !== '') out.push(line);
        if (out.length >= MAX_LINES) return out;
      }
    }
  }
  return out;
}

/* -- Słowniczek -------------------------------------------------------------------------------------------------- */

export type GlossaryRole = 'word' | 'forms' | 'meaning' | 'work';
export const GLOSSARY_ROLES: readonly GlossaryRole[] = ['word', 'forms', 'meaning', 'work'];

export interface GlossaryEntry {
  readonly id: string;
  /** Das Wort und seine Formen, klein. */
  readonly words: readonly string[];
  readonly word: string;
  readonly meaning: string;
  /** Nur in diesem Werk (Kennung) — sonst in jedem. */
  readonly work?: string;
}

const fold = (s: string): string => s.toLocaleLowerCase('pl-PL').normalize('NFC');

/** Ein Eintrag aus seinen Werten (je Rolle). `null`: kein Wort oder keine Bedeutung. */
export function glossaryEntry(id: string, values: { readonly word?: unknown; readonly forms?: unknown; readonly meaning?: unknown; readonly work?: unknown }): GlossaryEntry | null {
  const word = str(values.word).trim();
  const meaning = str(values.meaning).trim();
  if (word === '' || meaning === '') return null;
  const formsRaw = Array.isArray(values.forms) ? values.forms.map((f) => str(isObject(f) ? f.value : f)) : str(values.forms).split(/[\n,;]/);
  const words = [...new Set([word, ...formsRaw].map((x) => fold(x.trim())).filter((x) => x !== ''))];
  const workRaw = Array.isArray(values.work) ? values.work[0] : values.work;
  const work = str(isObject(workRaw) ? workRaw.value : workRaw).trim();
  return { id, words, word, meaning, ...(work === '' ? {} : { work }) };
}

/** Ein Stück einer Zeile: Text oder ein Wort des Słowniczek. */
export type LinePiece = { readonly text: string; readonly entry?: GlossaryEntry };

const WORD = /[\p{L}\p{M}'’]+/gu;

/** Eine Zeile in Stücke: jedes Wort, das im Słowniczek steht (für dieses Werk), wird ein eigenes Stück. */
export function glossaryPieces(line: string, entries: readonly GlossaryEntry[], workId?: string): LinePiece[] {
  const usable = entries.filter((e) => e.work === undefined || workId === undefined || e.work === workId);
  if (usable.length === 0) return [{ text: line }];
  const index = new Map<string, GlossaryEntry>();
  for (const e of usable) for (const w of e.words) if (!index.has(w)) index.set(w, e);
  const out: LinePiece[] = [];
  let at = 0;
  for (const m of line.matchAll(WORD)) {
    const hit = index.get(fold(m[0]));
    if (hit === undefined) continue;
    if (m.index! > at) out.push({ text: line.slice(at, m.index) });
    out.push({ text: m[0], entry: hit });
    at = m.index! + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out;
}

/* -- Die Wärmekarte (Leiter, Leinwand) --------------------------------------------------------------------------- */

/** Wie oft jede Zeile gewählt wurde (Index 0 = Zeile 1) — für `lines`, und für `span` jede Zeile im gewählten Bereich. */
export function heatOf(a: ReadingSpec, givens: readonly unknown[]): number[] {
  const counts: number[] = [];
  const add = (l: number) => { while (counts.length < l) counts.push(0); counts[l - 1] = (counts[l - 1] ?? 0) + 1; };
  for (const g of givens) {
    if (a.form === 'lines') for (const l of givenLines(g)) add(l);
    else if (a.form === 'span') { const s = givenSpan(g); if (s !== null) for (let l = s[0]; l <= Math.min(s[1], s[0] + MAX_LINES); l += 1) add(l); }
  }
  return counts;
}
