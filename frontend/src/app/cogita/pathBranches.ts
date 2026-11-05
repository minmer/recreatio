/**
 * 2026-11-05 (Prompt 23, B2–B5, B7) — WAS DIE ZWEIGE DER ŚCIEŻKA ZEIGEN (`PathMap` `branches`): je Abstecher einer Erzählung
 * die andere Erzählung — ihr Name, ihr Satz (das Streszczenie ihrer Einheit), wie weit der Lernende darin ist, ihre Fragen
 * und wie viele davon er kann, nach welchem Slajd sie abzweigt, und ihre eigenen Abstecher (für „Rozwiń").
 * <code>
 *   Stand     ukończona (wo immer sie zu Ende ging — auch direkt aus dem Krajobraz) → done; begonnen → progress mit
 *             gezeigten Slajdy / allen; vorbei, ohne sie → skipped; sonst new
 *   Fragen    die Karten, die in ihr gefragt werden (`cardsInFlow`), und wie viele davon gekonnt sind (`isKnown`)
 *   wo        „po slajdzie N": so viele Slajdy stehen auf der Linie bis zum Knoten davor (0: „na początku")
 * </code>
 * Rein (ohne React); die Gastgeber sind der Spieler (`FlowPlayer`) und die Ścieżka einer Einheit im Krajobraz.
 */

import { detourOf, detoursIn, detourState } from './detour';
import type { Flow } from './flow';
import type { FlowPosition } from './learn';
import { cardsInFlow, isKnown, type MarksOf } from './flowAsk';
import type { Card } from './cardBasics';
import type { Words } from './lang';
import type { PathBranch } from './PathMap';
import type { StoryPath } from './storyPath';

export interface BranchContext {
  readonly flowOf: (ref: string) => Flow | undefined;
  /** Der gemerkte Stand einer Erzählung (ohne Lernenden: nichts). */
  readonly position: (id: string) => FlowPosition | undefined;
  /** Ist sie ukończona (auch in diesem Lauf)? */
  readonly done: (id: string) => boolean;
  readonly card: (id: string) => Card | null;
  readonly marks: MarksOf | null;
  /** Ihr Satz (das Streszczenie ihrer Einheit). */
  readonly summary?: (flow: Flow) => string;
  readonly words: Words;
}

const slidesOf = (f: Flow): readonly string[] => f.graph.nodes.filter((n) => n.type === 'show' || n.type === 'line' || n.type === 'expand' || n.type === 'opening' || n.type === 'scene').map((n) => n.id);

/** Wie eine andere Erzählung als Zweig dasteht (ohne ihren Ort auf der Linie). */
export function storyBranch(inner: Flow, ctx: BranchContext, passed: boolean): Omit<PathBranch, 'where'> {
  const pos = ctx.position(inner.id);
  const slides = slidesOf(inner);
  const seen = new Set(pos?.visited ?? []);
  const started = pos !== undefined && ((pos.visited?.length ?? 0) > 1 || (pos.inside?.length ?? 0) > 0 || (pos.step !== '' && pos.step !== inner.start));
  const state: PathBranch['state'] = ctx.done(inner.id) ? 'done' : started ? 'progress' : passed ? 'skipped' : 'new';
  const cards = cardsInFlow(inner, ctx.card);
  const known = ctx.marks === null ? 0 : cards.filter((c) => isKnown(c, ctx.marks!)).length;
  const sub = detoursIn(inner).flatMap((d) => {
    const f = d.flow === '' ? undefined : ctx.flowOf(d.flow);
    if (f === undefined || f.id === inner.id) return [];
    const p = ctx.position(f.id);
    const st: PathBranch['state'] = ctx.done(f.id) ? 'done' : p !== undefined && (p.visited?.length ?? 0) > 1 ? 'progress' : 'new';
    return [{ id: f.id, name: f.name, state: st }];
  });
  const summary = ctx.summary?.(inner) ?? '';
  return {
    name: inner.name, state, done: slides.filter((s) => seen.has(s)).length, total: slides.length,
    questions: cards.length, known, ...(summary === '' ? {} : { summary }), ...(sub.length > 0 ? { sub } : {})
  };
}

/** Je Zweig-Knoten der Ścieżka (Kennung des Teils) sein Zweig. */
export function branchesOf(sp: StoryPath, flow: Flow, ctx: BranchContext, progress: { readonly visited: readonly string[]; readonly step: string | null }): Map<string, PathBranch> {
  const out = new Map<string, PathBranch>();
  const nodeOf = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  const visited = new Set(progress.visited);
  sp.parts.forEach((part, v) => {
    const nd = sp.model.nodes[v];
    if (part.kind !== 'detour' || nd?.branch === undefined) return;
    const step = part.steps[0];
    const node = step === undefined ? undefined : nodeOf.get(step);
    const d = node === undefined ? null : detourOf(node);
    const inner = d === null || d.flow === '' ? undefined : ctx.flowOf(d.flow);
    if (inner === undefined || step === undefined) return;
    const passed = detourState(step, visited, progress.step, false) === 'skipped';
    out.set(nd.id, { ...storyBranch(inner, ctx, passed), where: whereOf(sp, nd.branch.anchor, ctx.words) });
  });
  return out;
}

/** „po slajdzie N": die Slajdy der Linie bis einschliesslich des Ankers (in der Reihenfolge von unten). */
export function whereOf(sp: StoryPath, anchor: number, W: Words): string {
  const lvl = sp.model.nodes[anchor]?.level ?? 0;
  let n = 0;
  sp.parts.forEach((p, v) => { const nd = sp.model.nodes[v]; if (nd !== undefined && nd.branch === undefined && nd.level <= lvl) n += p.slides; });
  return n === 0 ? W.branchAtStart : W.branchAfter(n);
}
