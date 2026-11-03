/**
 * 2026-11-03 (F) — DIE ŚCIEŻKA EINER ERZÄHLUNG: welche Einträge ein Ablauf zeigt (in seiner Reihenfolge), an welchem
 * Schritt jeder steht, und wohin jede Möglichkeit einer Gabel führt — damit Erzählung und Karte (`PathMap`)
 * zusammenbleiben:
 * <code>
 *   Karte         die Reihenfolge des Lernens über diesen Einträgen; wo sie nichts sagt, die der Erzählung
 *   jetzt dran    der Eintrag des Schrittes, an dem der Lernende steht (sonst der zuletzt gezeigte)
 *   Gabel         eine Wahl oder Kapitel: je Möglichkeit die Spur dahinter — über ihr leuchtet sie auf der Karte
 *   Zusammen      „Rozdziały" führen zurück zur Auswahl, bis alle durch sind: die Karte zeigt „2 z 3 ścieżek"
 *   Tippen        ein freier Knoten: die Erzählung springt zu dem Schritt, der ihn zeigt
 * </code>
 * Rein und ohne React; `cogita/FlowPlayer.tsx` und der Baustein „Ścieżka" benutzen es.
 */

import { follow, type Flow, type FlowState } from './flow';
import type { GraphNode } from './graph';
import { effectiveNeeds, pathModel, type PathItem, type PathModel } from './pathLayout';

export interface FlowPath {
  /** Die Einträge in der Reihenfolge, in der die Erzählung sie zuerst zeigt. */
  readonly items: readonly PathItem[];
  /** Je Eintrag der erste Schritt, der ihn zeigt. */
  readonly stepOf: ReadonlyMap<string, string>;
  /** Je Schritt seine Einträge. */
  readonly entriesAt: ReadonlyMap<string, readonly string[]>;
  /** Die Reihenfolge der Erzählung: was direkt davor gezeigt wird (Indizes wie `items`). */
  readonly storyNeeds: readonly (readonly number[])[];
  /** Je Gabel (Wahl, Kapitel): je Ausgang die ersten Einträge dahinter. */
  readonly exits: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;
  /** Je Schritt mit Einträgen in einem Kapitel: seine Auswahl und der Ausgang des Kapitels (zum Hineinspringen). */
  readonly chapterOf: ReadonlyMap<string, { readonly hub: string; readonly exit: string }>;
}

const STOP = new Set(['end', 'return', 'restart', 'handoff']);

/** Die Einträge eines Schrittes — was er zeigt oder fragt (eine Frage: worüber sie ist, sonst sie selbst). */
export type EntriesOfStep = (node: GraphNode) => readonly string[];

export function flowPath(flow: Flow, entriesOfStep: EntriesOfStep, label: (id: string) => string): FlowPath {
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  const outs = new Map<string, { out: string; to: string }[]>();
  for (const e of flow.graph.edges) { const l = outs.get(e.from) ?? []; l.push({ out: e.out, to: e.to }); outs.set(e.from, l); }
  const entriesAt = new Map<string, readonly string[]>();
  for (const n of flow.graph.nodes) { const list = [...new Set(entriesOfStep(n).filter((x) => x !== ''))]; if (list.length > 0) entriesAt.set(n.id, list); }

  /* Ein „Koniec rozdziału" führt zurück zu seiner Auswahl — für die Karte: dorthin, wo es nach allen Kapiteln weitergeht. */
  const hubOf = new Map<string, string>();
  const chapterOf = new Map<string, { hub: string; exit: string }>();
  for (const hub of flow.graph.nodes.filter((n) => n.type === 'chapters')) {
    for (const { out, to } of outs.get(hub.id) ?? []) {
      if (!/^c\d+$/.test(out)) continue;
      const seen = new Set<string>();
      const stack = [to];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const n = nodes.get(id);
        if (n === undefined) continue;
        /* Jeder Schritt mit Einträgen in diesem Kapitel: wer dorthin springt, ist in diesem Kapitel. */
        if (entriesAt.has(id) && !chapterOf.has(id)) chapterOf.set(id, { hub: hub.id, exit: out });
        if (n.type === 'chapterEnd') { if (!hubOf.has(id)) hubOf.set(id, hub.id); continue; }
        if (n.type === 'chapters' || STOP.has(n.type)) continue;
        for (const o of outs.get(id) ?? []) stack.push(o.to);
      }
    }
  }
  /** Wohin ein Schritt weiterführt (über alle Ausgänge); ein Kapitelende dorthin, wo es nach allen Kapiteln weitergeht. */
  const forward = (id: string): string[] => {
    const n = nodes.get(id);
    if (n === undefined || STOP.has(n.type)) return [];
    if (n.type === 'chapterEnd') { const hub = hubOf.get(id); const done = hub === undefined ? null : follow(flow, hub, 'done'); return done === null ? [] : [done]; }
    return (outs.get(id) ?? []).map((o) => o.to);
  };
  /*
    Was zurückführt (eine falsche Antwort wiederholt, ein Kreis), ist kein Schritt nach vorn: eine Kante zu einem Schritt,
    der auf dem Weg dorthin schon offen ist (Tiefensuche), zählt nicht. Die Reihenfolge des Lesens: umgekehrte
    Nachordnung — jede Möglichkeit in ihrer Reihenfolge, was nach allen kommt, danach.
  */
  const back = new Set<string>();
  const order0: string[] = [];
  {
    const state = new Map<string, 1 | 2>();
    const visit = (start: string) => {
      const stack: { id: string; kids: string[]; i: number }[] = [{ id: start, kids: [...forward(start)].reverse(), i: 0 }];
      state.set(start, 1);
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.i >= top.kids.length) { state.set(top.id, 2); order0.push(top.id); stack.pop(); continue; }
        const to = top.kids[top.i];
        top.i += 1;
        const s = state.get(to);
        if (s === 1) { back.add(`${top.id}>${to}`); continue; }
        if (s === 2 || !nodes.has(to)) continue;
        state.set(to, 1);
        stack.push({ id: to, kids: [...forward(to)].reverse(), i: 0 });
      }
    };
    if (flow.start !== null && nodes.has(flow.start)) visit(flow.start);
    order0.reverse();
  }
  /* Nach allen Kapiteln geht es über ihre Enden weiter — der Ausgang „gotowe" der Auswahl selbst ist dann kein Schritt nach vorn. */
  const viaEnds = new Set(hubOf.values());
  const after = (id: string): string[] => {
    const done = viaEnds.has(id) ? follow(flow, id, 'done') : null;
    return forward(id).filter((to) => !back.has(`${id}>${to}`) && to !== done);
  };
  /** Die nächsten Schritte mit Einträgen hinter diesen Zielen (durch Logik, Wahl, Kapitel hindurch). */
  const nextShown = (starts: readonly string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [...starts].reverse();
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (entriesAt.has(id)) { out.push(id); continue; }
      for (const to of after(id).reverse()) stack.push(to);
    }
    return out;
  };

  /* Die Reihenfolge, in der die Erzählung Einträge zuerst zeigt (wie man liest: jede Möglichkeit der Reihe nach). */
  const order: string[] = [];
  const stepOf = new Map<string, string>();
  const visit = new Set(order0);
  for (const id of order0) for (const e of entriesAt.get(id) ?? []) if (!stepOf.has(e)) { stepOf.set(e, id); order.push(e); }
  const index = new Map(order.map((id, i) => [id, i] as const));
  const storyNeeds: number[][] = order.map(() => []);
  for (const [step, list] of entriesAt) {
    if (!visit.has(step)) continue;
    for (const next of nextShown(after(step))) {
      for (const b of entriesAt.get(next) ?? []) {
        const bi = index.get(b);
        if (bi === undefined) continue;
        for (const a of list) { const ai = index.get(a); if (ai !== undefined && ai !== bi && !storyNeeds[bi].includes(ai)) storyNeeds[bi].push(ai); }
      }
    }
  }
  const exits = new Map<string, Map<string, string[]>>();
  for (const n of flow.graph.nodes) {
    if (n.type !== 'choice' && n.type !== 'chapters') continue;
    const per = new Map<string, string[]>();
    for (const { out, to } of outs.get(n.id) ?? []) {
      if (n.type === 'chapters' && out === 'done') continue;
      per.set(out, [...new Set(nextShown([to]).flatMap((s) => entriesAt.get(s) ?? []))]);
    }
    exits.set(n.id, per);
  }
  return { items: order.map((id) => ({ id, label: label(id) })), stepOf, entriesAt, storyNeeds, exits, chapterOf };
}

/**
 * DIE KARTE EINER ERZÄHLUNG: die Reihenfolge des Lernens über ihren Einträgen; wo sie nichts sagt (ein Eintrag ohne
 * jede Kante dorthin), die der Erzählung; ohne beides eine Kette in der Reihenfolge der Erzählung.
 */
export function flowPathModel(fp: FlowPath, needsOf: (id: string) => readonly string[]): PathModel {
  const ids = fp.items.map((i) => i.id);
  const learning = effectiveNeeds(ids, needsOf);
  const touched = new Set<number>();
  learning.forEach((l, v) => { if (l.length > 0) { touched.add(v); for (const p of l) touched.add(p); } });
  const needs = learning.map((l, v) => (touched.has(v) ? l : fp.storyNeeds[v].filter((p) => !touched.has(p))));
  return pathModel(fp.items, needs, { source: touched.size > 0 ? 'learning' : 'story', chainIfFlat: true });
}

/** Wo der Lernende in der Erzählung ist: der Eintrag dieses Schrittes, sonst der zuletzt besuchte mit einem Eintrag. */
export function flowCurrent(fp: FlowPath, state: Pick<FlowState, 'step' | 'visited'>): string | null {
  const here = state.step === null ? undefined : fp.entriesAt.get(state.step);
  if (here !== undefined && here.length > 0) return here[0];
  for (let i = state.visited.length - 1; i >= 0; i -= 1) {
    const list = fp.entriesAt.get(state.visited[i]);
    if (list !== undefined && list.length > 0) return list[list.length - 1];
  }
  return null;
}

/** Was die Erzählung schon gezeigt hat (für Einträge ohne Karten: gezeigt = durch). */
export function flowShown(fp: FlowPath, visited: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const step of visited) for (const e of fp.entriesAt.get(step) ?? []) out.add(e);
  return out;
}
