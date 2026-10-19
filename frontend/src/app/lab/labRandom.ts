/**
 * 2026-10-18 — DER ZUFALL UND DIE ZAHLEN EINES LABORS (Fizyka, Chemia).
 *
 * Die Motoren sind Code; was ein Baustein mit ihnen zeigt, ist ein Dokument
 * (die Tafel in `slug_part.config`). Damit dasselbe Dokument jedes Mal ein
 * etwas anderes Experiment sein kann, darf es Werte ziehen:
 *
 * <code>
 *   "vars": [{ "name": "kat", "from": 20, "to": 40, "step": 5 },
 *            { "name": "sol", "pick": ["NaCl", "KCl", "CaCl2"] }]
 *   "x": "=2 + cos(rad(kat))"        eine Zahl als Rechnung (dieselbe Sprache wie die Animacja)
 *   "species": "{sol}"               ein Text mit einem gezogenen Text darin
 * </code>
 *
 * Gezogen wird einmal, wenn das Labor gebaut wird (und mit „Nowe losowanie”);
 * ein Same macht es wiederholbar (Prüfungen, Vorschau).
 */

import { compile, isExprError, toNum, type Env, type Expr } from '../pages/motion/expr';

/** Ein Zufall aus einem Samen (mulberry32 über FNV-1a) — derselbe Same, dieselben Zahlen. */
export function seeded(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i += 1) a = Math.imul(a ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ein gezogener Wert: eine Zahl aus einem Bereich (auf ihr Raster gelegt) oder ein Text aus einer Liste. */
export interface LabVar {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly step: number | null;
  readonly pick: readonly string[] | null;
}

const NAME = /^[\p{L}_][\p{L}\p{N}_]{0,31}$/u;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Die gezogenen Werte aus dem Dokument — duldsam: was nicht passt, fällt weg. */
export function readVars(value: unknown): LabVar[] {
  const out: LabVar[] = [];
  for (const raw of (Array.isArray(value) ? value : []).slice(0, 24)) {
    const one = record(raw);
    const name = typeof one.name === 'string' ? one.name.trim() : '';
    if (!NAME.test(name) || out.some((v) => v.name === name)) continue;
    const pick = Array.isArray(one.pick) ? one.pick.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim()).slice(0, 40) : null;
    if (pick !== null && pick.length > 0) { out.push({ name, from: 0, to: 0, step: null, pick }); continue; }
    const from = finite(one.from) ?? finite(one.value) ?? 0;
    const to = finite(one.to) ?? from;
    const step = finite(one.step);
    out.push({ name, from: Math.min(from, to), to: Math.max(from, to), step: step !== null && step > 0 ? step : null, pick: null });
  }
  return out;
}

/** Die gezogenen Werte: Zahlen (für Rechnungen) und Texte (für `{name}`). */
export interface Drawn {
  readonly nums: Env;
  readonly texts: Readonly<Record<string, string>>;
}

/** Ziehen — `fixed` gewinnt (eine Vorschau, eine Prüfung). */
export function drawVars(vars: readonly LabVar[], random: () => number, fixed: Readonly<Record<string, number | string>> = {}): Drawn {
  const nums: Env = {};
  const texts: Record<string, string> = {};
  for (const v of vars) {
    const given = fixed[v.name];
    if (v.pick !== null) {
      const text = typeof given === 'string' && v.pick.includes(given) ? given : v.pick[Math.min(v.pick.length - 1, Math.floor(random() * v.pick.length))];
      texts[v.name] = text;
      nums[v.name] = v.pick.indexOf(text);
      continue;
    }
    let x = typeof given === 'number' && Number.isFinite(given) ? given : v.from + random() * (v.to - v.from);
    if (v.step !== null) x = v.from + Math.round((x - v.from) / v.step) * v.step;
    x = Math.round(Math.min(v.to, Math.max(v.from, x)) * 1e9) / 1e9;
    nums[v.name] = x;
    texts[v.name] = String(x).replace('.', ',');
  }
  return { nums, texts };
}

const cache = new Map<string, Expr | null>();

/** Eine Zahl des Dokuments: eine Zahl, oder `"=Rechnung"` mit den gezogenen Werten — sonst `fallback`. */
export function num(value: unknown, drawn: Drawn, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  if (!text.startsWith('=')) {
    const n = Number(text.replace(',', '.'));
    return text !== '' && Number.isFinite(n) ? n : fallback;
  }
  const source = text.slice(1).trim();
  let e = cache.get(source);
  if (e === undefined) {
    const made = compile(source);
    e = isExprError(made) ? null : made;
    if (cache.size > 500) cache.clear();
    cache.set(source, e);
  }
  if (e === null) return fallback;
  const v = toNum(e.run(drawn.nums));
  return Number.isFinite(v) ? v : fallback;
}

/** Ein Text des Dokuments mit `{name}` durch die gezogenen Texte ersetzt. */
export function str(value: unknown, drawn: Drawn, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\{([\p{L}_][\p{L}\p{N}_]*)\}/gu, (whole, name: string) => drawn.texts[name] ?? whole).trim().slice(0, 400);
}

export const NO_DRAW: Drawn = { nums: {}, texts: {} };
