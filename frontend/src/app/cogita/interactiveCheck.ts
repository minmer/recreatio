/**
 * 2026-11-05 (Prompt 23, D3) — STIMMT EIN RYSUNEK DO PORUSZANIA, bevor er eingespielt wird? Für die Vorschau des Imports
 * (`json.ts` planImport), die Vorschau der KI (`frontend/mcp`) und `scripts/app-interactive-check.mjs`:
 * <code>
 *   JSON       ist der Rysunek JSON mit Teilen? (sonst entsteht keine Karte)
 *   Namen      jeder Ausdruck in let, sim, rules, controls und an jedem Teil übersetzt — unbekannte Namen beim Namen
 *              (`liveLint.problemsOf`); dazu das Ziel ("goal", "goals") und die Rechnungen der Lösung
 *   Lösung     mit den Werten aus "solution" gerechnet, bis zum Ende: erreicht sie das Ziel? (sonst zeigt die Karte nach
 *              einer falschen Antwort eine Lösung, die selbst falsch ist)
 * </code>
 * Rein (ohne Oberfläche); der Zufall eines Versuchs aus einem festen Samen.
 */

import { problemsOf } from '../pages/motion/liveLint';
import { Program } from '../pages/motion/liveRun';
import { checkInteractive, drawingOfText, interactiveSpec, liveWithGoals, solutionValues, solutionWorld, type InteractiveSpec } from './interactive';

export interface DrawingReport {
  /** Was nicht stimmt (in Worten, mit der Stelle). */
  readonly problems: readonly string[];
  /** Die Lösung erreicht das Ziel (`null`: keine Lösung oder kein Ziel). */
  readonly solved: boolean | null;
  readonly spec: InteractiveSpec | null;
}

/** Ein fester Same (ein Versuch, immer derselbe). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Der Bericht über die Daten einer Frage der Form "interactive" (oder `null`: keine solche). */
export function drawingReport(data: Readonly<Record<string, unknown>>, seed = 7): DrawingReport | null {
  if (data.form !== 'interactive') return null;
  const spec = interactiveSpec(data, seeded(seed));
  if (spec === null) return { problems: ['rysunek jest pusty albo nie jest poprawnym JSON z "elements" — karta nie powstanie'], solved: null, spec: null };
  const drawing = drawingOfText(spec.drawing)!;
  const problems: string[] = [];
  for (const p of problemsOf(drawing)) problems.push(`${p.where}: ${p.error}${p.source === '' ? '' : ` („${p.source}”)`}`);
  /* Das Ziel und die Lösung mit denselben Namen wie die Zeichnung. */
  const program = new Program(liveWithGoals(drawing.live, spec), { fixed: spec.fixed });
  for (const p of program.problems) problems.push(`${p.where}: ${p.error}${p.source === '' ? '' : ` („${p.source}”)`}`);
  for (const [name, source] of Object.entries(spec.solution ?? {})) {
    const e = program.compile(source, `solution „${name}”`);
    if (e === null) { const p = program.problems[program.problems.length - 1]; problems.push(p === undefined ? `solution „${name}”: nie da się policzyć („${source}”)` : `${p.where}: ${p.error}`); }
  }
  const hasGoal = program.hasGoal();
  /* Ein Ziel, das sich nicht übersetzen lässt (ein unbekannter Name), ist schon gemeldet — dann keine zweite Meldung zur Lösung. */
  const probe = new Program(drawing.live, { fixed: spec.fixed });
  const goalsCompile = [spec.goal, ...(spec.goals ?? [])].filter((g): g is string => g !== null).every((g) => probe.compile(g, 'goal') !== null);
  let solved: boolean | null = null;
  if (spec.solution !== null && hasGoal && goalsCompile) {
    const vars = solutionValues(spec) ?? {};
    const world = solutionWorld(spec);
    solved = checkInteractive(spec, { vars, ...(world === null ? {} : { world }) }).correct;
  }
  return { problems: [...new Set(problems)], solved, spec };
}

/** 2026-11-05 (Prompt 23, D3) — ein Rysunek für die Vorschau der KI: was nicht stimmt und was die Lösung ergibt. */
export interface DrawingSample {
  readonly id: string;
  readonly ref: string | null;
  readonly name: string;
  readonly goal: string | null;
  readonly goals: readonly string[];
  readonly check: 'live' | 'submit';
  /** Die Werte der Lösung (gerechnet mit dem Zufall eines Versuchs). */
  readonly solution: Readonly<Record<string, number>> | null;
  /** Erreicht die Lösung das Ziel (`null`: keine Lösung oder kein Ziel)? */
  readonly solved: boolean | null;
  readonly problems: readonly string[];
  /** Was der Lernende einstellen kann (Bedienung, Griffe). */
  readonly controls: number;
}

/** Alle Rysunki do poruszania einer Baza (Fragen der Form "interactive"). */
export function drawingSamples(entities: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }[], refOf: (id: string) => string | null = () => null): DrawingSample[] {
  const out: DrawingSample[] = [];
  for (const e of entities) {
    if (!e.kinds.includes('question') || e.data.form !== 'interactive') continue;
    const r = drawingReport(e.data);
    if (r === null) continue;
    const prompt = typeof e.data.prompt === 'string' ? e.data.prompt.trim() : '';
    const drawing = r.spec === null ? null : drawingOfText(r.spec.drawing);
    out.push({
      id: e.id, ref: refOf(e.id), name: prompt === '' ? e.id : prompt, goal: r.spec?.goal ?? null, goals: r.spec?.goals ?? [], check: r.spec?.check ?? 'live',
      solution: r.spec === null ? null : solutionValues(r.spec), solved: r.solved, problems: r.problems, controls: drawing?.live?.controls.length ?? 0
    });
  }
  return out;
}

/** DIE WARNUNGEN der Rysunki eines geplanten Imports — leer: alles gut (oder keine). */
export function interactiveImportWarnings(plan: { readonly entities: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }[] }): string[] {
  const out: string[] = [];
  for (const e of plan.entities) {
    if (!e.kinds.includes('question') || e.data.form !== 'interactive') continue;
    const r = drawingReport(e.data);
    if (r === null) continue;
    const prompt = typeof e.data.prompt === 'string' && e.data.prompt.trim() !== '' ? e.data.prompt.trim() : e.id;
    const name = `Pytanie „${prompt.length > 60 ? `${prompt.slice(0, 59)}…` : prompt}” (rysunek)`;
    for (const p of r.problems.slice(0, 6)) out.push(`${name}: ${p}.`);
    if (r.problems.length > 6) out.push(`${name}: i ${r.problems.length - 6} innych błędów w wyrażeniach.`);
    if (r.solved === false) out.push(`${name}: rozwiązanie ("solution") nie osiąga celu — policzone do końca z tymi wartościami cel nie jest spełniony; uczący się po złej odpowiedzi zobaczy złe rozwiązanie.`);
  }
  return out;
}
