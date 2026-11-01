/**
 * 2026-11-01 — FRAGEN MIT PARAMETERN: jede Frage bekommt bei jedem Versuch neue Zahlen.
 *
 * <code>
 *   "params":  [{ "name": "a", "random": [20, 99] }, { "name": "n", "random": [3, 9], "step": 1 }, { "name": "f", "values": ["sin", "cos"] }]
 *   "let":     [{ "name": "r", "value": "mod(a, n)" }]           gerechnet in der Sprache der Rysunki (`pages/motion/expr.ts`)
 *   "require": ["a > 2*n", "r != 0"]                              gezogen wird neu, bis jede Bedingung gilt (höchstens 60-mal)
 *   im Text:   "Bestimmen Sie $r$ mit $0\le r<{n}$ und ${a} = q\cdot {n} + r$."   "answers": ["{r}"]   "{fmt(x, 2)}"
 * </code>
 *
 * <b>Was ein Platzhalter ist</b>: `{…}` mit einem Ausdruck, der wenigstens einen Namen aus `params`/`let` liest und sonst
 * nur bekannte Funktionen. Alles andere bleibt, wie es steht — `\mathbb{N}`, `x^{2}`, `\{1,2\}` sind LaTeX. Wer einen
 * Buchstaben, der ein Parameter ist, als LaTeX-Gruppe meint, schreibt ihn mit Leerzeichen: `\frac{ a }{2}`.
 *
 * <b>Zahlen</b> stehen mit Komma (3,5) und einfachem Minus, damit eine getippte Antwort sie liest; in einem Wzór mit
 * `{,}` (setzt ohne Abstand). Rein, ohne Oberfläche — geprüft in `app-lemma-check`.
 */

import { compile, isExprError, newEnv, truth, type Env, type Val } from '../pages/motion/expr';
import { texPieces, texSource } from '../core/tex';

export interface ParamSpec {
  readonly name: string;
  /** Gezogen aus [von, bis] mit `step` (ganze Grenzen: 1) — oder aus `values`. */
  readonly random?: readonly [number, number];
  readonly step?: number;
  readonly values?: readonly Val[];
}

export interface LetSpec {
  readonly name: string;
  readonly value: string;
}

export interface ParamsSpec {
  readonly params: readonly ParamSpec[];
  readonly lets: readonly LetSpec[];
  readonly require: readonly string[];
}

/** Wie oft neu gezogen wird, bis `require` gilt. */
export const PARAM_TRIES = 60;

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Ein JSON-Feld, auch als Text gekommen. */
const jsonList = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    try { const v = JSON.parse(raw) as unknown; return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
};

/** `params`, `let` und `require` einer Frage — `null`: sie hat keine Parameter. */
export function readParamsSpec(d: Readonly<Record<string, unknown>>): ParamsSpec | null {
  const params: ParamSpec[] = [];
  for (const one of jsonList(d.params).slice(0, 24)) {
    if (!isObject(one) || typeof one.name !== 'string' || !NAME.test(one.name.trim())) continue;
    const name = one.name.trim();
    if (params.some((p) => p.name === name)) continue;
    const values = Array.isArray(one.values) ? one.values.filter((x): x is Val => typeof x === 'number' || typeof x === 'string').slice(0, 200) : [];
    const lo = Array.isArray(one.random) ? finite(one.random[0]) : null;
    const hi = Array.isArray(one.random) ? finite(one.random[1]) : null;
    const step = finite(one.step);
    if (values.length > 0) params.push({ name, values });
    else if (lo !== null && hi !== null) params.push({ name, random: [Math.min(lo, hi), Math.max(lo, hi)], ...(step !== null && step > 0 ? { step } : {}) });
  }
  const lets: LetSpec[] = [];
  for (const one of jsonList(d.let).slice(0, 24)) {
    if (!isObject(one) || typeof one.name !== 'string' || !NAME.test(one.name.trim())) continue;
    const value = typeof one.value === 'string' ? one.value : typeof one.value === 'number' ? String(one.value) : '';
    if (value.trim() !== '') lets.push({ name: one.name.trim(), value: value.trim() });
  }
  const require = (Array.isArray(d.require) ? d.require : typeof d.require === 'string' ? jsonList(d.require).length > 0 ? jsonList(d.require) : d.require.split('\n') : [])
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, 16);
  return params.length === 0 && lets.length === 0 ? null : { params, lets, require };
}

/** Wie gross ein Schritt ist, wenn keiner gesagt ist: ganze Grenzen — 1, sonst ein Hundertstel des Bereichs. */
const stepOf = (p: ParamSpec): number => {
  if (p.step !== undefined) return p.step;
  const [lo, hi] = p.random ?? [0, 0];
  return Number.isInteger(lo) && Number.isInteger(hi) ? 1 : Math.max(1e-9, (hi - lo) / 100);
};

function drawOne(p: ParamSpec, rng: () => number): Val {
  if (p.values !== undefined && p.values.length > 0) return p.values[Math.floor(rng() * p.values.length)]!;
  const [lo, hi] = p.random ?? [0, 0];
  const step = stepOf(p);
  const steps = Math.floor((hi - lo) / step + 1e-9);
  return Number((lo + Math.floor(rng() * (steps + 1)) * step).toPrecision(12));
}

/** Die Namen, die bis zu einer Stelle gelten: alle Parameter und die `let` davor. */
const knownUpTo = (spec: ParamsSpec, upTo: number) => {
  const names = new Set<string>([...spec.params.map((p) => p.name), ...spec.lets.slice(0, upTo).map((l) => l.name)]);
  return (name: string) => names.has(name);
};

/**
 * EIN ZUG: die Parameter gewürfelt, die `let` der Reihe nach gerechnet — so oft, bis jede Bedingung von `require` gilt.
 * `held`: ob sie galt (sonst steht der letzte Zug da, und der Editor sagt es).
 */
export function drawParams(spec: ParamsSpec, rng: () => number, tries = PARAM_TRIES): { readonly values: Record<string, Val>; readonly held: boolean } {
  let last: Record<string, Val> = {};
  const all = (name: string) => spec.params.some((p) => p.name === name) || spec.lets.some((l) => l.name === name);
  for (let t = 0; t < Math.max(1, tries); t += 1) {
    const env: Env = newEnv();
    for (const p of spec.params) env[p.name] = drawOne(p, rng);
    spec.lets.forEach((l, i) => {
      const e = compile(l.value, knownUpTo(spec, i));
      env[l.name] = isExprError(e) ? Number.NaN : e.run(env);
    });
    last = { ...env };
    const held = spec.require.every((r) => {
      const e = compile(r, all);
      return !isExprError(e) && truth(e.run(env));
    });
    if (held) return { values: last, held: true };
  }
  return { values: last, held: spec.require.length === 0 };
}

/** Was in einem Ausdruck eines Parameters nicht stimmt — für den Editor (leer: alles gut). */
export function paramsProblems(spec: ParamsSpec, rng: () => number = Math.random): string[] {
  const out: string[] = [];
  const all = (name: string) => spec.params.some((p) => p.name === name) || spec.lets.some((l) => l.name === name);
  spec.lets.forEach((l, i) => {
    const e = compile(l.value, knownUpTo(spec, i));
    if (isExprError(e)) out.push(`„${l.name} = ${l.value}”: ${e.error}.`);
  });
  for (const r of spec.require) {
    const e = compile(r, all);
    if (isExprError(e)) out.push(`Warunek „${r}”: ${e.error}.`);
  }
  if (out.length === 0 && spec.require.length > 0 && !drawParams(spec, rng).held) out.push(`Warunki nie dały się spełnić w ${PARAM_TRIES} losowaniach — poszerz zakresy albo złagodź warunki.`);
  return out;
}

/* -- Wstawianie wartości ------------------------------------------------------------------------------------- */

/** Eine Zahl, wie sie im Text steht: mit Komma, einfachem Minus, ohne Rundungsreste; im Wzór das Komma als `{,}`. */
export function numberText(n: number, math = false): string {
  if (!Number.isFinite(n)) return math ? (n > 0 ? '\\infty' : n < 0 ? '-\\infty' : '?') : n > 0 ? '∞' : n < 0 ? '-∞' : '?';
  const r = Number(n.toPrecision(12));
  let s = String(r);
  if (/e/i.test(s)) s = r.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', math ? '{,}' : ',');
}

/** Ein gerechneter Wert als Text — eine Zahl (siehe `numberText`), ein Text mit einfachem Minus, im Wzór mit `{,}`. */
function valText(v: Val, math: boolean): string {
  if (typeof v === 'number') return numberText(v, math);
  const plain = v.replace(/−/g, '-');
  return math ? plain.replace(/(\d),(\d)/g, '$1{,}$2') : plain;
}

/** `{…}` ohne Leerzeichen am Rand, nicht `\{`. */
const PLACE = /(?<!\\)\{([^{}\s](?:[^{}]*[^{}\s])?)\}/g;

function fillPiece(text: string, values: Readonly<Record<string, Val>>, math: boolean): string {
  if (!text.includes('{')) return text;
  const known = (name: string) => Object.prototype.hasOwnProperty.call(values, name);
  return text.replace(PLACE, (whole, inner: string) => {
    const e = compile(inner, known);
    if (isExprError(e) || e.reads.length === 0) return whole;
    const env: Env = Object.assign(newEnv(), values);
    return valText(e.run(env), math);
  });
}

/** EIN TEXT MIT DEN GEZOGENEN WERTEN — in Wzory als Zahl für LaTeX, sonst als Zahl zum Lesen und Tippen. */
export function fillParams(text: string, values: Readonly<Record<string, Val>>): string {
  if (!text.includes('{')) return text;
  if (!text.includes('$')) return fillPiece(text, values, false);
  return texPieces(text).map((p) => (p.t === 'math' ? texSource(fillPiece(p.tex, values, true), p.display) : fillPiece(p.v, values, false).split('$').join('\\$'))).join('');
}

/** Die Schlüssel einer Frage, deren Texte Platzhalter tragen dürfen. */
export const PARAM_KEYS = ['prompt', 'answers', 'options', 'items', 'left', 'right', 'leftLabel', 'rightLabel', 'back', 'hints', 'explanation', 'feedback', 'extra', 'alternatives', 'choices', 'task'] as const;

/** Alle Texte darin (auch in Listen von Listen) mit den Werten. */
function fillDeep(v: unknown, values: Readonly<Record<string, Val>>): unknown {
  if (typeof v === 'string') return fillParams(v, values);
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, values));
  return v;
}

/** DIE FRAGE MIT DEN WERTEN DIESES VERSUCHS: jedes Feld aus `PARAM_KEYS` ausgefüllt, die anderen bleiben. */
export function withParams(d: Readonly<Record<string, unknown>>, values: Readonly<Record<string, Val>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...d };
  for (const key of PARAM_KEYS) {
    const raw = d[key];
    if (raw === undefined) continue;
    /* „alternatives", „choices" dürfen als JSON-Text kommen. */
    const parsed = (key === 'alternatives' || key === 'choices') && typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown; } catch { return raw; } })() : raw;
    out[key] = fillDeep(parsed, values);
  }
  return out;
}
