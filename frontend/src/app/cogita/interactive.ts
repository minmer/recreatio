/**
 * COGITA — EINE FRAGE, DIE MAN MIT DEN HÄNDEN BEANTWORTET (2026-10-17): die
 * Antwortform `interactive`. Die Frage trägt ein Bild zum Anfassen — dasselbe
 * JSON wie der Baustein „Animacja" einer Seite (`pages/motion/liveModel.ts`):
 * einen Wurf, ein Pendel, einen Lichtstrahl —, und ihr Ziel. Geantwortet wird,
 * indem man einstellt (Schieber, Ziehen) und „Sprawdź" drückt.
 *
 * <b>Geprüft wird durch Nachrechnen</b>, nicht durch Vertrauen: gespeichert
 * werden nur die Werte, die der Lernende eingestellt hat (`given.vars`); die
 * Prüfung baut das Programm mit ihnen neu, lässt die Simulation bis zum Ende
 * laufen (`Program.runToEnd`) und sieht, ob ein Ziel erreicht wurde —
 * irgendwann unterwegs. So zählt eine Antwort auch bei der Leitung einer
 * Sitzung, die nur die Werte bekommt.
 *
 * <b>Zufall je Versuch</b>: Werte mit `random` werden beim Bauen der Karte
 * gezogen (aus ihrem Samen) und stehen in der Karte (`fixed`) — die Anzeige
 * und die Prüfung sehen dieselben; der Lernende kann sie nicht überschreiben.
 * Der Fingerabdruck der Karte hängt nicht an ihnen: die Geschichte der Karte
 * bleibt, auch wenn jedes Mal ein anderes Ziel kommt. Darum ist eine Lösung
 * eine RECHNUNG mit diesen Werten (`v0 = sqrt(cel*g)`), keine feste Zahl.
 */

import { drawingOf, type Drawing, type Shape } from '../pages/motion/drawing';
import { fmt, toNum } from '../pages/motion/expr';
import { NAME, readLive, type Live } from '../pages/motion/liveModel';
import { Program } from '../pages/motion/liveRun';
import type { Outcome } from './check';

export interface InteractiveSpec {
  readonly form: 'interactive';
  /** Das Bild als JSON-Text — so steht es in der Frage, so geht es in den Fingerabdruck. */
  readonly drawing: string;
  /** Ein eigenes Ziel (Ausdruck) — `null`: die Regeln des Bildes mit `"goal": true`. */
  readonly goal: string | null;
  /** Was für diesen Versuch feststeht (der gezogene Zufall). */
  readonly fixed: Readonly<Record<string, number>>;
  /** Was das Rätsel löst: Wert → Rechnung (mit den Namen des Bildes, auch dem Zufall) — gezeigt nach einer falschen Antwort. */
  readonly solution: Readonly<Record<string, string>> | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Das Bild aus dem Text der Frage — `null`: keines (oder keines mit Teilen). */
export function drawingOfText(text: string): Drawing | null {
  try {
    const value = JSON.parse(text) as unknown;
    if (!isObject(value)) return null;
    const drawing = drawingOf(value);
    return drawing.elements.length === 0 ? null : drawing;
  } catch {
    return null;
  }
}

/** Eine Lösung: „kat = 45; v0 = sqrt(cel*g)" (oder ein Objekt) — je Wert eine Rechnung. */
export function readSolution(value: unknown): Record<string, string> | null {
  const out: Record<string, string> = {};
  const put = (name: string, expr: string) => {
    const n = name.trim();
    const e = expr.trim();
    if (NAME.test(n) && e !== '' && e.length <= 400) out[n] = e;
  };
  if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) if (typeof v === 'number' && Number.isFinite(v)) put(k, String(v)); else if (typeof v === 'string') put(k, v);
  } else if (typeof value === 'string') {
    for (const part of value.split(/[;\n]/)) {
      const at = part.search(/[=:]/);
      /* „11,5" ist eine Zahl mit Komma; in „max(a, b)" trennt das Komma Argumente. */
      const expr = part.slice(at + 1).trim();
      if (at > 0) put(part.slice(0, at), /^-?\d+,\d+$/.test(expr) ? expr.replace(',', '.') : expr);
    }
  }
  return Object.keys(out).length === 0 ? null : out;
}

/**
 * DIE KARTE AUS DER FRAGE: das Bild (als Text), das Ziel, der gezogene Zufall
 * (`rng` — der Same der Karte), die Lösung. `null`: kein brauchbares Bild.
 */
export function interactiveSpec(data: Readonly<Record<string, unknown>>, rng: () => number): InteractiveSpec | null {
  const text = typeof data.drawing === 'string' ? data.drawing.trim() : isObject(data.drawing) ? JSON.stringify(data.drawing) : '';
  const drawing = drawingOfText(text);
  if (drawing === null) return null;
  const fixed: Record<string, number> = {};
  for (const v of drawing.live?.vars ?? []) {
    if (v.random === null) continue;
    let x = v.random[0] + rng() * (v.random[1] - v.random[0]);
    if (v.step !== null) x = (v.min ?? 0) + Math.round((x - (v.min ?? 0)) / v.step) * v.step;
    fixed[v.name] = Math.round(x * 1e9) / 1e9;
  }
  const goal = typeof data.goal === 'string' && data.goal.trim() !== '' ? data.goal.trim().replace(/^=\s*/, '') : null;
  return { form: 'interactive', drawing: text, goal, fixed, solution: readSolution(data.solution) };
}

/** Das Bild mit dem Ziel der Frage als weitere Regel — so erreicht es die Prüfung wie jedes andere Ziel. */
export function liveWithGoal(live: Live | null, goal: string | null): Live | null {
  if (goal === null) return live;
  const withGoal = readLive({ vars: [], rules: [{ when: goal, goal: true }] });
  if (withGoal === null) return live;
  return live === null ? withGoal : { ...live, rules: [...live.rules, ...withGoal.rules] };
}

/**
 * WAS DER LERNENDE EINSTELLEN KANN: Werte mit einer Bedienung (Schieber, Wahl,
 * Knopf), einem Griff oder einem Teil zum Antippen — ohne den Zufall dieses
 * Versuchs. Nur sie gehören in die Antwort und in ihre Worte.
 */
export function adjustable(drawing: Drawing, fixed: Readonly<Record<string, number>> = {}): Set<string> {
  const out = new Set<string>();
  for (const c of drawing.live?.controls ?? []) {
    if ('var' in c) out.add(c.var);
    if (c.type === 'button') for (const name of Object.keys(c.set)) out.add(name);
  }
  const walk = (list: readonly Shape[], depth: number) => {
    if (depth > 8) return;
    for (const s of list) {
      if (s.drag !== null) {
        if (s.drag.x !== null) out.add(s.drag.x);
        if (s.drag.y !== null) out.add(s.drag.y);
        for (const name of Object.keys(s.drag.set)) out.add(name);
      }
      if (s.tap !== null) for (const name of Object.keys(s.tap.set)) out.add(name);
      walk(s.type === 'use' ? drawing.symbols.get(s.use ?? '') ?? [] : s.children, depth + 1);
    }
  };
  walk(drawing.elements, 0);
  const vars = new Set((drawing.live?.vars ?? []).map((v) => v.name));
  return new Set([...out].filter((name) => vars.has(name) && !(name in fixed)));
}

/** Die Werte des Lernenden — nur Zahlen, nur die des Bildes; was feststeht, gewinnt. */
export function answerValues(spec: InteractiveSpec, given: unknown): Record<string, number> | null {
  const vars = isObject(given) && isObject(given.vars) ? given.vars : null;
  if (vars === null) return null;
  const drawing = drawingOfText(spec.drawing);
  const names = new Set((drawing?.live?.vars ?? []).map((v) => v.name));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(vars)) if (names.has(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return { ...out, ...spec.fixed };
}

/** Die Lösung als Zahlen — gerechnet mit dem Zufall dieses Versuchs. `null`: keine Lösung angegeben. */
export function solutionValues(spec: InteractiveSpec): Record<string, number> | null {
  if (spec.solution === null) return null;
  const drawing = drawingOfText(spec.drawing);
  if (drawing === null) return null;
  const program = new Program(drawing.live, { fixed: spec.fixed });
  const out: Record<string, number> = {};
  for (const [name, source] of Object.entries(spec.solution)) {
    const e = program.compile(source, `solution „${name}"`);
    const v = e === null ? NaN : toNum(e.run(program.env));
    if (Number.isFinite(v)) out[name] = v;
  }
  return Object.keys(out).length === 0 ? null : out;
}

/**
 * DIE PRÜFUNG: mit den Werten des Lernenden neu rechnen, bis zum Ende. Richtig,
 * wenn ein Ziel erreicht wurde. Ohne Ziel im Bild und in der Frage gibt es
 * nichts zu prüfen — dann zählt jede abgegebene Antwort als richtig (ein
 * Ausprobieren, keine Aufgabe).
 */
export function checkInteractive(spec: InteractiveSpec, given: unknown): Outcome {
  const values = answerValues(spec, given);
  const expected = solutionText(spec) ?? 'cel rysunku osiągnięty';
  if (values === null) return { correct: false, correctness: 0, answered: false, expected };
  const drawing = drawingOfText(spec.drawing);
  if (drawing === null) return { correct: false, correctness: 0, answered: true, expected };
  const program = new Program(liveWithGoal(drawing.live, spec.goal), { fixed: values });
  if (!program.hasGoal()) return { correct: true, correctness: 1, answered: true, expected };
  const reached = program.runToEnd();
  return { correct: reached, correctness: reached ? 1 : 0, answered: true, expected };
}

/** Werte in Worten, mit den Namen und Einheiten des Bildes: „Kąt = 45°; Prędkość = 12 m/s" — `only`: nur diese. */
export function describeValues(drawingText: string, values: Readonly<Record<string, number>>, only?: ReadonlySet<string>): string {
  const vars = drawingOfText(drawingText)?.live?.vars ?? [];
  const by = new Map(vars.map((v) => [v.name, v]));
  return Object.entries(values).filter(([name]) => by.has(name) && (only === undefined || only.has(name))).map(([name, value]) => {
    const v = by.get(name)!;
    const digits = v.step === null ? 2 : Math.max(0, Math.min(4, Math.ceil(-Math.log10(v.step) - 1e-9)));
    const unit = v.unit === '' ? '' : /^[°%′″]/.test(v.unit) ? v.unit : ` ${v.unit}`;
    return `${v.label || name} = ${fmt(value, digits)}${unit}`;
  }).join('; ');
}

/** Die Lösung in Worten — mit dem Zufall dieses Versuchs gerechnet. */
export function solutionText(spec: InteractiveSpec): string | null {
  const values = solutionValues(spec);
  return values === null ? null : describeValues(spec.drawing, values);
}

/** Die Antwort in Worten: nur, was der Lernende einstellen konnte. */
export function givenValuesText(spec: InteractiveSpec, given: unknown): string {
  const vars = isObject(given) && isObject(given.vars) ? given.vars as Record<string, number> : null;
  const drawing = drawingOfText(spec.drawing);
  if (vars === null || drawing === null) return '';
  return describeValues(spec.drawing, vars, adjustable(drawing, spec.fixed));
}

/**
 * FÜR DIE TEILNEHMER EINER SITZUNG [L3]: die Karte ohne das, was die Antwort
 * verrät — kein eigenes Ziel, keine Lösung, und im Bild keine Regel mit
 * `"goal": true` (sie würde das Treffen schon vor der Abgabe melden). Das
 * Bild selbst bleibt: ohne es lässt sich nicht antworten.
 */
export function stripInteractive(spec: InteractiveSpec): InteractiveSpec {
  let drawing = spec.drawing;
  try {
    const value = JSON.parse(spec.drawing) as Record<string, unknown>;
    if (Array.isArray(value.rules)) drawing = JSON.stringify({ ...value, rules: value.rules.filter((r) => !(isObject(r) && r.goal === true)) });
  } catch { /* bleibt, wie es ist — es zeichnet dann eben nichts */ }
  return { ...spec, drawing, goal: null, solution: null };
}

/** Was der Fingerabdruck sieht: das Bild, das Ziel, die Lösung — nicht den Zufall dieses Versuchs. */
export const interactiveExpected = (spec: InteractiveSpec): unknown => ({ f: 'interactive', d: spec.drawing, g: spec.goal, s: spec.solution });
