/**
 * Was jede Karte trägt (COGITA.md §5, §7): die Stücke auf den Leitungen (`Item`), Zufall mit Samen, Frage und Antwort, die Kennung — und das Zerlegen eines Zitats in Fragmente.
 */

import type { PointExpected, TextRule } from './check';
import type { InteractiveSpec } from './interactive';
import type { DatePrecision, Entity, Lookup, MediaRef, ValueState } from './schema';

/* -- Was auf den Leitungen fliesst ------------------------------------------------- */

export interface Item {
  readonly text: string;
  /** Der Wert mit seinem Typ: Zahl, Datum, ja/nein, Ort … */
  readonly value?: unknown;
  /** Wofür das Stück steht, wenn es ein Eintrag ist. */
  readonly entity?: string;
  readonly media?: MediaRef;
  readonly state?: ValueState;
}

export interface TemplateContext {
  readonly look: Lookup;
  /** Der Eintrag, für den die Karte entsteht. */
  readonly entity: Entity;
  /** Die Einträge einer Art — woraus Dystraktoren kommen. */
  readonly pool: (kind: string) => readonly Entity[];
  /** Die aktuelle Sammlung: Dystraktoren „nur aus ihr" [D15]. */
  readonly scope?: ReadonlySet<string>;
  /** Der Same des Zufalls — je Versuch ein anderer, damit Wahlmöglichkeiten neu gemischt werden. */
  readonly seed: string;
  /** Pyodide im Browser [D10]; fehlt er, scheitert nur der Python-Baustein. */
  readonly python?: (code: string, args: readonly unknown[]) => Promise<unknown>;
  /** Der Wert der Schleife „dla każdej wartości" in diesem Lauf. */
  readonly variant?: string;
}

/* -- Zufall mit Samen -------------------------------------------------------------- */

/** FNV-1a, 32 Bit — für Samen und Fingerabdrücke, nicht für Geheimnisse. */
export function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** mulberry32 — dieselbe Folge für denselben Samen. */
export function rngOf(seed: string): () => number {
  let a = parseInt(hashOf(seed), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stabil serialisiert: gleiche Daten, gleicher Text, gleich in welcher Reihenfolge die Schlüssel kamen. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/* -- Die Karte --------------------------------------------------------------------- */

export interface PromptPart {
  readonly text: string;
  readonly media?: MediaRef;
}

export type AnswerSpec =
  | { readonly form: 'text'; readonly accepted: readonly string[]; readonly rule: TextRule }
  | { readonly form: 'gap'; readonly shown: string; readonly accepted: readonly string[]; readonly rule: TextRule }
  | { readonly form: 'number'; readonly values: readonly number[]; readonly tolerance: number; readonly relative: boolean; readonly unit: string; readonly quantity?: string }
  | { readonly form: 'date'; readonly values: readonly string[]; readonly precision: DatePrecision; readonly tolerance: number }
  | { readonly form: 'one'; readonly options: readonly string[]; readonly correct: number }
  | { readonly form: 'many'; readonly options: readonly string[]; readonly correct: readonly number[] }
  | { readonly form: 'truefalse'; readonly value: boolean }
  | { readonly form: 'order'; readonly items: readonly string[]; readonly shown: readonly string[] }
  /* 2026-10-27 — `heads`: was über den beiden Spalten steht („Rok” — „Wydarzenie”). */
  | { readonly form: 'match'; readonly left: readonly string[]; readonly right: readonly string[]; readonly pairs: readonly (readonly [number, number])[]; readonly heads?: readonly [string, string] }
  | { readonly form: 'flash'; readonly back: readonly string[] }
  | { readonly form: 'code'; readonly task: string; readonly starter: string; readonly createInput: string; readonly reference: string; readonly cases: number }
  | { readonly form: 'point'; readonly on: 'map' | 'image'; readonly target: PointExpected }
  /* 2026-10-17 — ein Bild zum Anfassen (interactive.ts): die Antwort sind die eingestellten Werte. */
  | InteractiveSpec;

export interface Card {
  /** Die Frage: eine von Hand geschriebene, oder `vorlage:eintrag[:wert]`. */
  readonly question: string;
  readonly direction: string;
  /** Unter diesem Schlüssel liegen Antworten und Kenntnis. */
  readonly key: string;
  readonly entity?: string;
  readonly template?: string;
  readonly prompt: readonly PromptPart[];
  readonly answer: AnswerSpec;
  /** Was nach der Antwort zur Erklärung erscheint — Wissen, Einträge [D14]. */
  readonly explain: readonly string[];
  /** Fingerabdruck dessen, was als richtig gilt [D7]. */
  readonly fingerprint: string;
  /** Fragt jedes Mal anderes (Zufall); der Fingerabdruck ist dann der der Vorlage. */
  readonly varies: boolean;
  /** Karten, die vorher sitzen müssen — die Teile eines Zitats vor dem Ganzen. */
  readonly requires: readonly string[];
  /**
   * 2026-10-27 — WAS DIE KARTE AUSSERDEM PRÜFT: die Einträge, über die ein Pytanie ist („O czym”).
   * Ihre Kenntnis zählt dort mit, und die Karte wartet auf das, was dort zuerst zu können ist
   * (`prerequisites.ts`). Eine Karte aus einer Vorlage prüft ihren Eintrag (`entity`).
   */
  readonly about?: readonly string[];
  /** 2026-10-27 — was diese Karte fragt, kurz, für Listen (die Karte eines Paars: „1410 — Grunwald”). */
  readonly label?: string;
  /**
   * 2026-10-30 — WOFÜR DIE KARTE ZEUGNIS GIBT, und wie stark: die Einträge, deren Kenntnis sie mitbestimmt, mit dem
   * Gewicht, das ihre Vorlage im Schema erklärt („Co sprawdza ta karta", `Template.tests`). Fehlt es: ihr Eintrag
   * und, bei einem Pytanie, was es prüft („O czym") — je mit 1 (`knowing.ts`, `cardTests`).
   */
  readonly tests?: readonly CardTest[];
}

/** Ein Eintrag, den eine Karte prüft, und wie stark (eine genaue Frage zählt mehr als eine allgemeine). */
export interface CardTest {
  readonly id: string;
  readonly weight: number;
}

export const cardKey = (question: string, direction: string): string => (direction === '' ? question : `${question}|${direction}`);

/* -- Bausteine --------------------------------------------------------------------- */

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

export const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter((x) => x !== '') : typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter((x) => x !== '') : []);

/* -- Die Teile eines Zitats (der Baum des Altbestands, features/revision/quote.ts) --- */

export interface Fragment {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly depth: number;
  /** Die beiden Hälften, falls das Stück geteilt wurde — sie sitzen zuerst. */
  readonly parts: readonly string[];
}

const isSpace = (c: string) => /\s/.test(c);

const isWord = (c: string) => /[\p{L}\p{N}]/u.test(c);

function boundary(text: string, at: number): number {
  const left = at > 0 ? text[at - 1] : '';
  const right = at < text.length ? text[at] : '';
  if (left === '' || right === '') return 0;
  if (isSpace(left) || isSpace(right)) return 3;
  if (isWord(left) !== isWord(right)) return 2;
  return !isWord(left) && !isWord(right) ? 1 : 0;
}

function splitAt(text: string, start: number, end: number, min: number): number | null {
  const lo = start + min;
  const hi = end - min;
  if (end - start <= min * 2 || hi <= lo) return null;
  const target = Math.floor((start + end) / 2);
  for (const need of [3, 2, 1]) {
    for (let off = 0; off <= Math.max(target - lo, hi - target); off += 1) {
      for (const at of [target - off, target + off]) {
        if (at < lo || at > hi || boundary(text, at) < need) continue;
        const l = text[at - 1] ?? '';
        const r = text[at] ?? '';
        if (l === '' || r === '' || isWord(l) !== isWord(r)) return at;
      }
    }
  }
  return null;
}

/**
 * Ein Zitat als Baum: halbiert an Wortgrenzen, bis die Stücke kurz genug sind
 * (7–13 Zeichen wie im Altbestand). Gefragt wird von unten: erst die kleinen
 * Stücke, dann das, was sie zusammen ergeben.
 */
export function fragmentTree(text: string, min = 7, max = 13): Fragment[] {
  const lo = Math.max(1, min);
  const hi = Math.max(lo, max);
  const out: Fragment[] = [];
  const build = (start: number, end: number, depth: number, id: string): void => {
    const at = end - start > hi ? splitAt(text, start, end, lo) : null;
    const parts = at === null || at <= start || at >= end ? [] : [`${id}0`, `${id}1`];
    out.push({ id, start, end, text: text.slice(start, end), depth, parts });
    if (parts.length === 2) {
      build(start, at!, depth + 1, parts[0]);
      build(at!, end, depth + 1, parts[1]);
    }
  };
  if (text.trim() !== '') build(0, text.length, 0, 'f');
  return out.sort((a, b) => b.depth - a.depth || a.start - b.start);
}
