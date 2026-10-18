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
 * <b>2026-10-18 — mit einer Welt</b> (die Waage, Zahnräder): dazu kommt der
 * Bau, wie ihn der Lernende hinterlassen hat (`given.world`). Die Prüfung
 * spielt ihn durch die Regeln der Welt nach (`World.replay`): was gesperrt
 * ist, bleibt gesperrt, was nicht angehängt werden darf, wird nicht angehängt
 * — eine Antwort kann nichts, was die Hand nicht konnte.
 *
 * <b>Zufall je Versuch</b>: Werte mit `random` werden beim Bauen der Karte
 * gezogen (aus ihrem Samen) und stehen in der Karte (`fixed`, für Dinge als
 * `ding.eigenschaft`) — die Anzeige und die Prüfung sehen dieselben; der
 * Lernende kann sie nicht überschreiben. Der Fingerabdruck der Karte hängt
 * nicht an ihnen: die Geschichte der Karte bleibt, auch wenn jedes Mal ein
 * anderes Ziel kommt. Darum ist eine Lösung eine RECHNUNG mit diesen Werten
 * (`v0 = sqrt(cel*g)`, `w2.pos = 5`), keine feste Zahl.
 *
 * <b>2026-10-18 — gleich schwer</b>: gezogen wird mit derselben Rechnung wie
 * auf einer Seite (`pages/motion/liveTask.ts`) — bis die Bedingungen der
 * Aufgabe (`task.require`) gelten, sie nicht schon gelöst ist und ihre
 * Lösung erreichbar ist. Ohne eigene Lösung gilt die des Bildes (`task.solve`).
 */

import { drawingOf, type Drawing, type Shape } from '../pages/motion/drawing';
import { fmt, toNum } from '../pages/motion/expr';
import { readAssignText, readLive, type Live } from '../pages/motion/liveModel';
import { Program } from '../pages/motion/liveRun';
import { readShot, type WorldShot } from '../pages/motion/liveThings';
import type { Outcome } from './check';

export interface InteractiveSpec {
  readonly form: 'interactive';
  /** Das Bild als JSON-Text — so steht es in der Frage, so geht es in den Fingerabdruck. */
  readonly drawing: string;
  /** Ein eigenes Ziel (Ausdruck) — `null`: die Regeln des Bildes mit `"goal": true`. */
  readonly goal: string | null;
  /** Was für diesen Versuch feststeht (der gezogene Zufall; für Dinge `ding.eigenschaft`). */
  readonly fixed: Readonly<Record<string, number>>;
  /** Was das Rätsel löst: Wert (oder `ding.eigenschaft`) → Rechnung — gezeigt nach einer falschen Antwort. */
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

/** Eine Lösung: „kat = 45; v0 = sqrt(cel*g); w2.pos = 5" (oder ein Objekt) — je Wert eine Rechnung. */
export function readSolution(value: unknown): Record<string, string> | null {
  const out = readAssignText(value);
  return Object.keys(out).length === 0 ? null : out;
}

/**
 * DIE KARTE AUS DER FRAGE: das Bild (als Text), das Ziel, der gezogene Zufall
 * (`rng` — der Same der Karte), die Lösung. `null`: kein brauchbares Bild.
 * Gezogen wird wie auf einer Seite (die Bedingungen der Aufgabe gelten) —
 * und festgehalten: Werte beim Namen, Dinge als `ding.eigenschaft`.
 */
export function interactiveSpec(data: Readonly<Record<string, unknown>>, rng: () => number): InteractiveSpec | null {
  const text = typeof data.drawing === 'string' ? data.drawing.trim() : isObject(data.drawing) ? JSON.stringify(data.drawing) : '';
  const drawing = drawingOfText(text);
  if (drawing === null) return null;
  const fixed = new Program(drawing.live, { random: rng }).drawn();
  const goal = typeof data.goal === 'string' && data.goal.trim() !== '' ? data.goal.trim().replace(/^=\s*/, '') : null;
  const own = readSolution(data.solution);
  const solve = drawing.live?.task?.solve ?? {};
  return { form: 'interactive', drawing: text, goal, fixed, solution: own ?? (Object.keys(solve).length === 0 ? null : solve) };
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

/** 2026-10-18 — der Bau des Lernenden (`null`: keiner — dann gilt der Anfang). */
export function answerWorld(given: unknown): WorldShot | null {
  return isObject(given) ? readShot(given.world) : null;
}

/** Die Rechnungen der Lösung, mit dem Zufall dieses Versuchs gerechnet — Werte des Bildes und Eigenschaften der Dinge. */
function solved(spec: InteractiveSpec): { readonly drawing: Drawing; readonly program: Program; readonly values: Record<string, number> } | null {
  if (spec.solution === null) return null;
  const drawing = drawingOfText(spec.drawing);
  if (drawing === null) return null;
  const program = new Program(drawing.live, { fixed: spec.fixed });
  const values: Record<string, number> = {};
  for (const [name, source] of Object.entries(spec.solution)) {
    const e = program.compile(source, `solution „${name}"`);
    const v = e === null ? NaN : toNum(e.run(program.env));
    if (Number.isFinite(v)) values[name] = v;
  }
  return { drawing, program, values };
}

/** Die Lösung als Zahlen (die Werte des Bildes). `null`: keine Lösung angegeben. */
export function solutionValues(spec: InteractiveSpec): Record<string, number> | null {
  const s = solved(spec);
  if (s === null) return null;
  const out = Object.fromEntries(Object.entries(s.values).filter(([k]) => !k.includes('.')));
  return Object.keys(out).length === 0 ? null : out;
}

/** 2026-10-18 — die Lösung als Bau der Welt: der Anfang, mit den Eigenschaften, die die Lösung nennt. `null`: keine. */
export function solutionWorld(spec: InteractiveSpec): WorldShot | null {
  const s = solved(spec);
  const start = s?.program.worldSnapshot() ?? null;
  if (s === null || start === null) return null;
  const keys = Object.keys(s.values).filter((k) => k.includes('.'));
  if (keys.length === 0) return null;
  return {
    things: start.things.map((t) => {
      const props = { ...t.props };
      for (const key of keys) if (key.startsWith(`${t.id}.`)) props[key.slice(t.id.length + 1)] = s.values[key];
      return { ...t, props };
    })
  };
}

/**
 * DIE PRÜFUNG: mit den Werten (und dem Bau) des Lernenden neu rechnen, bis
 * zum Ende. Richtig, wenn ein Ziel erreicht wurde. Ohne Ziel im Bild und in
 * der Frage gibt es nichts zu prüfen — dann zählt jede abgegebene Antwort als
 * richtig (ein Ausprobieren, keine Aufgabe).
 */
export function checkInteractive(spec: InteractiveSpec, given: unknown): Outcome {
  const values = answerValues(spec, given);
  const expected = solutionText(spec) ?? 'cel rysunku osiągnięty';
  if (values === null) return { correct: false, correctness: 0, answered: false, expected };
  const drawing = drawingOfText(spec.drawing);
  if (drawing === null) return { correct: false, correctness: 0, answered: true, expected };
  const program = new Program(liveWithGoal(drawing.live, spec.goal), { fixed: values, replay: answerWorld(given) });
  if (!program.hasGoal()) return { correct: true, correctness: 1, answered: true, expected };
  /* Eine Regel der Welt gebrochen (zu viele Züge): falsch, gleich, wohin es führt. */
  if (program.broken() !== null) return { correct: false, correctness: 0, answered: true, expected };
  const reached = program.runToEnd();
  return { correct: reached, correctness: reached ? 1 : 0, answered: true, expected };
}

/** Wie viele Stellen ein Schritt hat (0,25 → zwei, 0,5 → eine, 1 → keine). */
const stepDigits = (step: number | null): number => {
  if (step === null) return 2;
  for (let d = 0; d < 4; d += 1) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d;
  return 4;
};

/** Wie eine Zahl geschrieben wird: so viele Stellen, wie ihr Schritt hat, mit Einheit — `trim`: ohne Nullen am Ende (6 m, 5,25 m). */
const valueText = (value: number, step: number | null, unit: string, trim = false): string => {
  const digits = stepDigits(step);
  const n = fmt(value, digits);
  const number = trim && n.includes(',') ? n.replace(/0+$/, '').replace(/,$/, '') : n;
  /* Zwischen Zahl und Einheit ein fester Abstand (U+00A0): „9,9 m/s" bricht nicht um. */
  return `${number}${unit === '' ? '' : /^[°%′″]/.test(unit) ? unit : ` ${unit}`}`;
};

/** Werte in Worten, mit den Namen und Einheiten des Bildes: „Kąt = 45°; Ciężarek w2 · Miejsce = 5 m" — `only`: nur diese. */
export function describeValues(drawingText: string, values: Readonly<Record<string, number>>, only?: ReadonlySet<string>): string {
  const live = drawingOfText(drawingText)?.live ?? null;
  const by = new Map((live?.vars ?? []).map((v) => [v.name, v]));
  const world = live?.world ?? null;
  return Object.entries(values).flatMap(([name, value]) => {
    if (only !== undefined && !only.has(name)) return [];
    const v = by.get(name);
    if (v !== undefined) return [`${v.label || name} = ${valueText(value, v.step, v.unit)}`];
    const dot = name.indexOf('.');
    if (dot < 0 || world === null) return [];
    const id = name.slice(0, dot);
    const kind = world.kinds.find((k) => k.name === world.things.find((t) => t.id === id)?.kind);
    const prop = kind?.props.find((p) => p.name === name.slice(dot + 1));
    return kind === undefined || prop === undefined ? [] : [`${kind.label} ${id} · ${prop.label || prop.name} = ${valueText(value, prop.step, prop.unit, true)}`];
  }).join('; ');
}

/** Die Lösung in Worten — mit dem Zufall dieses Versuchs gerechnet. */
export function solutionText(spec: InteractiveSpec): string | null {
  const s = solved(spec);
  return s === null || Object.keys(s.values).length === 0 ? null : describeValues(spec.drawing, s.values);
}

/** Was der Lernende am Bau geändert hat, in Worten — verglichen mit dem Anfang dieses Versuchs. */
function worldChangesText(spec: InteractiveSpec, drawing: Drawing, world: WorldShot): string {
  const start = new Program(drawing.live, { fixed: spec.fixed }).worldSnapshot();
  const spec0 = drawing.live?.world ?? null;
  if (start === null || spec0 === null) return '';
  const label = (kind: string) => spec0.kinds.find((k) => k.name === kind)?.label ?? kind;
  const before = new Map(start.things.map((t) => [t.id, t]));
  const after = new Map(world.things.map((t) => [t.id, t]));
  const out: string[] = [];
  for (const t of world.things) {
    const was = before.get(t.id);
    if (was === undefined) { out.push(`+ ${label(t.kind)}`); continue; }
    const kind = spec0.kinds.find((k) => k.name === t.kind);
    for (const p of kind?.props ?? []) {
      const a = was.props[p.name];
      const b = t.props[p.name];
      if (typeof b === 'number' && (typeof a !== 'number' || Math.abs(a - b) > 1e-9)) out.push(`${label(t.kind)} ${t.id} · ${p.label || p.name} = ${valueText(b, p.step, p.unit, true)}`);
    }
  }
  for (const t of start.things) if (!after.has(t.id)) out.push(`− ${label(t.kind)} ${t.id}`);
  return out.length > 8 ? [...out.slice(0, 8), `… (${out.length - 8} więcej)`].join('; ') : out.join('; ');
}

/** Die Antwort in Worten: nur, was der Lernende einstellen konnte — und was er am Bau geändert hat. */
export function givenValuesText(spec: InteractiveSpec, given: unknown): string {
  const vars = isObject(given) && isObject(given.vars) ? given.vars as Record<string, number> : null;
  const drawing = drawingOfText(spec.drawing);
  if (vars === null || drawing === null) return '';
  const world = answerWorld(given);
  return [describeValues(spec.drawing, vars, adjustable(drawing, spec.fixed)), world === null ? '' : worldChangesText(spec, drawing, world)]
    .filter((x) => x !== '').join('; ');
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
