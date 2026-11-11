/**
 * 2026-11-10 (Eigentümer: „weniger auf einmal — ist ein Ziel gewählt, zeigt die Karte den Weg dorthin, alles andere grau") — WAS
 * DIE KARTE BEI EINEM GEWÄHLTEN ZIEL HERVORHEBT (rein, ohne React; `scripts/app-wm-shapes-check.mjs` prüft es):
 * <code>
 *   Türme      die noch fehlenden (der Plan erobert sie, auch mittelbare Voraussetzungen) und das Ziel; dazu Türme, über die der
 *              Weg nur geht (schon erobert) — leiser
 *   Spuren     der Weg: was noch zu gehen ist (kräftig, die Schritte als Punkte), was schon gegangen ist (dünn, gedämpft, ohne
 *              gefüllte Punkte)
 *   Tore       die Spuren von verlangten Türmen zu den Toren auf dem Weg
 *   grau       alles andere (Türme, Spuren, Tore, auch die Landschaft)
 * </code>
 */

import type { Plan } from './wmPlan';
import type { WorldState } from './wmState';
import { HOME, isJunction, type Lines } from './wmTypes';

export interface RouteFocus {
  /** Die Türme des Weges: fehlend (zu erobern) und das Ziel. */
  readonly missing: ReadonlySet<string>;
  /** Türme, über die der Weg nur geht (schon erobert). */
  readonly passed: ReadonlySet<string>;
  /** Spuren, die noch zu gehen sind. */
  readonly remaining: ReadonlySet<string>;
  /** Spuren des Weges, die schon gegangen sind. */
  readonly done: ReadonlySet<string>;
  /** Knoten (Gabelungen, Tore) auf dem Weg. */
  readonly nodes: ReadonlySet<string>;
  /** Die Spuren verlangter Türme zu Toren auf dem Weg (Kennungen von `Lines.links` und `requires:<von>><nach>`). */
  readonly gates: ReadonlySet<string>;
  /** 2026-11-10 — der jetzige Schritt: die erste Spur des Weges, die noch zu gehen ist (sie sticht hervor). */
  readonly current: string | null;
  /** 2026-11-10 — weitere Abhängigkeiten als Bögen in der Luft (von → zu: Türme, Knoten). */
  readonly arcs?: readonly (readonly [string, string])[];
}

/**
 * 2026-11-10 (Eigentümer: „ein Klick auf eine Gabelung oder einen Turm zeigt die Abhängigkeiten wie im Weg") — EIN KNOTEN ODER EIN
 * EROBERTER TURM: seine Wege (offen kräftig, gegangen dezent), woher er kommt (vom Haus), und als Bögen, was er verlangt.
 */
export function nodeFocus(state: WorldState, lines: Lines, id: string): RouteFocus | null {
  const j = lines.junctions.get(id);
  const place = state.world.places.get(id);
  if (j === undefined && place === undefined) return null;
  const remaining = new Set<string>();
  const done = new Set<string>();
  const nodes = new Set<string>(j === undefined ? [] : [id]);
  const passed = new Set<string>();
  const travelled = (s: string) => state.sections.get(s)?.travelled === true;
  /* Woher: der Weg vom Haus her (dezent), über Knoten zu ihm. */
  const into = [...lines.sections.values()].filter((s) => s.to === id && s.from !== s.to);
  const from = j !== undefined ? j.from : null;
  for (const s of state.routeTo(from ?? id) ?? []) done.add(s);
  for (const s of into) if (from === null || s.from === from) { if (travelled(s.id)) done.add(s.id); else remaining.add(s.id); }
  /* Wohin: die Wege einer Gabelung. */
  for (const s of j?.out ?? []) { if (travelled(s)) done.add(s); else remaining.add(s); const t = lines.sections.get(s)?.to; if (t !== undefined && !isJunction(t)) passed.add(t); }
  for (const s of [...done, ...remaining]) { const x = lines.sections.get(s); for (const n of [x?.from, x?.to]) if (n !== undefined && n !== HOME) { if (isJunction(n)) nodes.add(n); else passed.add(n); } }
  if (place !== undefined) passed.add(id);
  const gates = new Set(lines.links.filter((l) => l.to === id || (j !== undefined && j.out.includes(l.section))).map((l) => l.id));
  const arcs = (place?.needs ?? []).map((n) => [n, id] as const);
  return { missing: new Set(), passed, remaining, done, nodes, gates, current: null, arcs };
}

/** Was hervorgehoben ist, wenn der Weg dieses Plans gezeigt wird. Alles, was hier fehlt, ist grau. */
export function routeFocus(plan: Plan, state: WorldState, lines: Lines): RouteFocus {
  const missing = new Set<string>([...plan.places, plan.target]);
  const remaining = new Set<string>();
  const done = new Set<string>();
  const nodes = new Set<string>();
  const passed = new Set<string>();
  const todo = new Set(plan.steps.flatMap((s) => (s.kind === 'travel' || s.kind === 'review' ? [s.section] : [])));
  for (const id of plan.route) {
    const s = lines.sections.get(id);
    if (s === undefined) continue;
    /* Noch zu gehen: ein Teil des Plans, oder eine Spur ohne Inhalt in einen Turm/Knoten, der noch kommt. */
    const open = todo.has(id) || (s.steps.length === 0 && state.sections.get(id)?.travelled !== true && (missing.has(s.to) || isJunction(s.to)));
    if (open) { remaining.add(id); done.delete(id); } else if (!remaining.has(id)) done.add(id);
    for (const n of [s.from, s.to]) {
      if (isJunction(n)) nodes.add(n);
      else if (n !== HOME && !missing.has(n)) passed.add(n);
    }
  }
  /* Die Tore: Spuren in Knoten des Weges oder in fehlende Türme. */
  const gates = new Set<string>();
  for (const l of lines.links) if (nodes.has(l.to) || missing.has(l.to)) gates.add(l.id);
  for (const p of missing) for (const n of state.world.places.get(p)?.needs ?? []) if (missing.has(n) || state.places.get(n)?.passable !== true) gates.add(`requires:${n}>${p}`);
  const current = plan.route.find((id) => remaining.has(id)) ?? null;
  return { missing, passed, remaining, done, nodes, gates, current };
}

/**
 * 2026-11-10 (Eigentümer: „ein Klick auf einen Turm oder einen Pfad zeigt den Weg") — EIN GEWÄHLTER PFAD: führt er zu einem Turm,
 * der noch fehlt, der Weg dorthin über genau diesen Pfad; sonst nur er selbst.
 */
export function sectionFocus(state: WorldState, lines: Lines, section: string, planOf: (target: string, via: string) => Plan): RouteFocus | null {
  const s = lines.sections.get(section);
  if (s === undefined) return null;
  if (state.places.get(s.to)?.conquered === false) {
    const f = routeFocus(planOf(s.to, s.id), state, lines);
    if (f.remaining.has(section) || f.done.has(section)) return f;
  }
  const walked = state.sections.get(section)?.travelled === true;
  const nodes = new Set([s.from, s.to].filter(isJunction));
  return {
    missing: new Set(), passed: new Set([s.from, s.to].filter((x) => x !== HOME && !isJunction(x))), nodes, gates: new Set(lines.links.filter((l) => l.section === section).map((l) => l.id)),
    remaining: new Set(walked ? [] : [section]), done: new Set(walked ? [section] : []), current: walked ? null : section
  };
}

/** Ist dieser Turm (oder diese Spur) bei gezeigtem Weg grau? */
export const greyPlace = (f: RouteFocus, id: string): boolean => !f.missing.has(id) && !f.passed.has(id);
export const greySection = (f: RouteFocus, id: string): boolean => !f.remaining.has(id) && !f.done.has(id);
