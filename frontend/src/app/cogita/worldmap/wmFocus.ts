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
  for (const p of missing) for (const n of state.world.places.get(p)?.needs ?? []) if (missing.has(n) || state.places.get(n)?.conquered !== true) gates.add(`requires:${n}>${p}`);
  return { missing, passed, remaining, done, nodes, gates };
}

/** Ist dieser Turm (oder diese Spur) bei gezeigtem Weg grau? */
export const greyPlace = (f: RouteFocus, id: string): boolean => !f.missing.has(id) && !f.passed.has(id);
export const greySection = (f: RouteFocus, id: string): boolean => !f.remaining.has(id) && !f.done.has(id);
