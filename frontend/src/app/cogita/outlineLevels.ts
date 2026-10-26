/**
 * EBENE UM EBENE (2026-10-26) — wie viel vom Baum einer Struktura offen ist, wenn man ihn von aussen nach
 * innen öffnet: zuerst die äusseren Schritte, dann Schritt um Schritt oder eine Ebene für alle.
 *
 * Ein Schritt heisst hier nach seinem Pfad, wie `TreeNode` (StructureView.tsx) ihn bildet:
 * `<Wurzel>/<Kennung>/<Index>` und darunter `<Pfad>/<Kennung>/<Index>`. Der Index zählt alle Schritte einer
 * Liste, auch die mit „już wyżej" — so heisst derselbe Eintrag an zwei Stellen des Baumes verschieden.
 * `inner` ist die Menge der Pfade, deren innere Schritte zu sehen sind.
 */

import type { OutlineNode } from './views';

/** Die Schritte unter einem Knoten (ohne das, was der Widok nur dazu holt). */
export const structKids = (n: OutlineNode): OutlineNode[] => n.groups.filter((g) => g.structure === true).flatMap((g) => g.nodes);

/** Wie tief der Baum unter einer Wurzel reicht: 1 — nur äussere Schritte, 0 — keine. */
export const depthOf = (n: OutlineNode): number => structKids(n).reduce((d, k) => Math.max(d, k.again === true ? 1 : 1 + depthOf(k)), 0);

export interface ShownStep {
  readonly path: string;
  /** 1 — ein äusserer Schritt. */
  readonly depth: number;
  /** Wie viele Schritte er in sich hat. */
  readonly kids: number;
}

/** Was zu sehen ist: die äusseren Schritte und unter jedem aufgeklappten seine (ein „już wyżej" ohne innere). */
export function shownSteps(root: OutlineNode, inner: ReadonlySet<string>): ShownStep[] {
  const out: ShownStep[] = [];
  const walk = (nodes: readonly OutlineNode[], base: string, depth: number) => nodes.forEach((n, i) => {
    const path = `${base}/${n.id}/${i}`;
    const kids = n.again === true ? [] : structKids(n);
    out.push({ path, depth, kids: kids.length });
    if (kids.length > 0 && inner.has(path)) walk(kids, path, depth + 1);
  });
  walk(structKids(root), root.id, 1);
  return out;
}

/** Die tiefste Ebene, die zu sehen ist (1, solange nur die äusseren Schritte da sind). */
export const deepestShown = (shown: readonly ShownStep[]): number => shown.reduce((m, s) => Math.max(m, s.depth), 1);

/**
 * „Rozwiń poziom": überall, wo ein Schritt zu sehen ist, seine inneren dazu — genau eine Ebene. Was unter einem
 * so geöffneten Schritt früher offen war (man hatte ihn danach wieder zugeklappt), bleibt zu.
 */
export function oneDeeper(root: OutlineNode, inner: ReadonlySet<string>): ReadonlySet<string> {
  const closed = shownSteps(root, inner).filter((s) => s.kids > 0 && !inner.has(s.path)).map((s) => s.path);
  if (closed.length === 0) return inner;
  const next = new Set([...inner].filter((p) => !closed.some((c) => p.startsWith(`${c}/`))));
  for (const c of closed) next.add(c);
  return next;
}

/** „Zwiń poziom": die tiefste Ebene, die zu sehen ist, wieder zu — in jedem Ast, der so tief reicht. */
export function oneShallower(root: OutlineNode, inner: ReadonlySet<string>): ReadonlySet<string> {
  const shown = shownSteps(root, inner);
  const deepest = deepestShown(shown);
  if (deepest <= 1) return inner;
  const next = new Set(inner);
  for (const s of shown) if (s.depth === deepest - 1) next.delete(s.path);
  return next;
}
