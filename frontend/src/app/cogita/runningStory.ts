/**
 * 2026-11-04 (Prompt 11) — WELCHE ERZÄHLUNG GERADE LÄUFT. Ein Ablauf kann in einen anderen gehen: ein Unterablauf („Inny
 * przebieg", etwa eine ganze Erzählung auf einem Weg eines Wątek), „dla każdego", eine Übergabe — oder der Lernende beginnt
 * nach „Koniec" die nächste Erzählung. Was der Spieler zeigt (Titel, Ścieżka, „TERAZ", die Zähler, die Zeile über der
 * Frage) und wo er die Stelle merkt, folgt immer der Erzählung, die WIRKLICH läuft:
 * <code>
 *   besucht       je Erzählung ihre eigenen Schritte (die Kennungen zweier Erzählungen gleichen sich oft: s1, q1_1 …);
 *                 die einer rufenden Erzählung warten, bis sie weitergeht
 *   „Koniec"      in einer gerufenen Erzählung: sie ist zu Ende (gemerkt als ukończona), die rufende geht nach ihr weiter
 *                 („dalej" ihres Schrittes) — ein Weg, der zur Wahl zurückführt, kommt dort wirklich an
 *   Übergabe      die alte Erzählung ist zu Ende, die neue beginnt von vorn und ist nun die eigene
 *   Abstecher     (2026-11-04, Prompt 13) „Wejdź" geht in die andere Erzählung (dort, wo der Lernende in ihr war; „Przypomnij":
 *                 von vorn), ihr „Koniec" führt über „done" zurück; „Wróć do …" jederzeit zurück an den Abstecher, ohne
 *                 sie als ukończona zu merken; nach dem Neuladen baut `resumeInside` den Stapel aus der Stelle der äusseren
 *                 Erzählung (`inside`) wieder auf
 * </code>
 * Rein (ohne React); `FlowPlayer` benutzt es, `scripts/app-story-check.mjs` und `app-detour-check.mjs` prüfen es.
 */

import { advance, detourRefused, exitAfter, follow, startFlow, type Flow, type FlowState, type PlayContext } from './flow';
import type { GraphNode } from './graph';
import { holds, readCondition, type Condition, type Facts } from './logic';

export interface StoryRun {
  /** Der Stand des Spielers (`flow.ts`) — `visited` nur die Schritte der laufenden Erzählung. */
  readonly state: FlowState;
  /** Die besuchten Schritte der rufenden Erzählungen (die äusserste zuerst, wie `state.stack`). */
  readonly outer: readonly (readonly string[])[];
  /** Die Erzählung, die dieser Lauf erzählt (geöffnet, übergeben oder nach „Koniec" begonnen). */
  readonly root: string;
}

/** Eine Erzählung, die eben zu Ende ging (der Gastgeber merkt sie als ukończona). */
export interface StoryFinished {
  readonly flow: string;
  readonly step: string;
  readonly visited: readonly string[];
}

export interface RunStep {
  readonly run: StoryRun;
  readonly finished: readonly StoryFinished[];
}

const GATE = '\u0000enter';
const merge = (a: readonly string[], b: readonly string[]): string[] => [...a, ...b.filter((x) => !a.includes(x))];

/**
 * Einen Schritt betreten, wie `flow.ts` es tut — mit allem, was von selbst weitergeht (Warunek, Wartość, eine gekonnte
 * Frage): über einen Hilfsschritt, der genau dorthin führt (er selbst wird nie besucht).
 */
export function enterAt(flow: Flow, state: FlowState, to: string | null, ctx: PlayContext): FlowState {
  const via: Flow = {
    ...flow,
    graph: {
      nodes: [...flow.graph.nodes, { id: GATE, type: 'show', x: 0, y: 0, config: {} }],
      edges: [...flow.graph.edges, ...(to === null ? [] : [{ id: GATE, from: GATE, out: 'next', to, in: 'in' }])]
    }
  };
  return advance(via, { ...state, flow: flow.id, step: GATE, ended: false }, 'next', ctx);
}

/** Der erste Schritt, den er noch nicht besucht hat — vom Anfang den Ausgängen nach (Breite zuerst); `null`: der Anfang. */
function firstOpen(flow: Flow, visited: ReadonlySet<string>): string | null {
  if (flow.start === null) return null;
  const seen = new Set<string>([flow.start]);
  const queue = [flow.start];
  while (queue.length > 0) {
    const at = queue.shift()!;
    if (!visited.has(at)) return at;
    for (const e of flow.graph.edges) if (e.from === at && e.to !== null && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
  }
  return null;
}

/** Ein Lauf vom Anfang einer Erzählung (oder einer gemerkten Stelle), mit den Kapiteln, die schon durch sind. */
export function startRun(flow: Flow, from: { readonly values?: Readonly<Record<string, number>>; readonly at?: string | null; readonly chapters?: FlowState['chapters']; readonly visited?: readonly string[] }, ctx: PlayContext): StoryRun {
  /*
    2026-11-04 (Prompt 13) — WIEDER DA, WO ER WAR: mit den schon besuchten Schritten (sonst zeigte der Pfad nach dem Neuladen
    nichts, und die nächste Stelle überschrieb sie). Gibt es den gemerkten Schritt nicht mehr (der Ablauf wurde neu
    eingespielt), dann der erste noch nicht besuchte Schritt in der Reihenfolge des Ablaufs, sonst der Anfang.
  */
  const nodes = new Set(flow.graph.nodes.map((n) => n.id));
  const visited = (from.visited ?? []).filter((id) => nodes.has(id));
  let at = from.at ?? null;
  if (at !== null && at !== '' && !nodes.has(at)) at = firstOpen(flow, new Set(visited));
  const s0 = startFlow(flow, from.values ?? {}, at);
  const base: FlowState = { ...s0, visited, ...(from.chapters === undefined ? {} : { chapters: from.chapters }) };
  return { state: s0.step === null ? s0 : enterAt(flow, base, s0.step, ctx), outer: [], root: flow.id };
}

/** Nach einem Ende in einer gerufenen Erzählung: weiter in der rufenden (oder „dla każdego" mit dem nächsten Eintrag). */
function settle(run: StoryRun, flows: (id: string) => Flow | undefined, ctx: PlayContext, finished: StoryFinished[]): RunStep {
  let r = run;
  for (let guard = 0; guard < 8 && r.state.ended && r.state.stack.length > 0; guard += 1) {
    const s = r.state;
    finished.push({ flow: s.flow, step: s.step ?? '', visited: s.visited });
    if (s.queue !== undefined && s.queue.length > 0) {
      const inner = flows(s.flow);
      if (inner === undefined) break;
      const [item, ...queue] = s.queue;
      r = { ...r, state: enterAt(inner, { ...s, item, queue, visited: [], ended: false }, inner.start, ctx) };
      continue;
    }
    const back = s.stack[s.stack.length - 1];
    const parent = flows(back.flow);
    if (parent === undefined || back.step === null) break;
    const resumed: FlowState = { ...s, flow: back.flow, stack: s.stack.slice(0, -1), item: back.item, queue: undefined, chapter: null, ended: false, visited: r.outer[r.outer.length - 1] ?? [] };
    r = { ...r, outer: r.outer.slice(0, -1), state: enterAt(parent, resumed, follow(parent, back.step, exitAfter(parent, back.step)), ctx) };
  }
  return { run: r, finished };
}

/**
 * EIN SCHRITT WEITER (wie `advance`, über einen Ausgang) — an den Grenzen der Erzählungen mit ihren eigenen besuchten
 * Schritten: in einen Unterablauf hinein beginnt er leer (die rufende wartet), aus ihm heraus gilt wieder der rufende.
 */
export function stepRun(run: StoryRun, flows: (id: string) => Flow | undefined, exit: string | undefined, ctx: PlayContext): RunStep {
  const s = run.state;
  const flow = flows(s.flow);
  if (flow === undefined || s.ended || s.step === null) return { run, finished: [] };
  const node = flow.graph.nodes.find((n) => n.id === s.step);
  const finished: StoryFinished[] = [];
  let next: StoryRun;
  const into = node !== undefined && (node.type === 'subflow' || node.type === 'each' || node.type === 'handoff' || (node.type === 'detour' && (exit === undefined || exit === 'enter')));
  if (node !== undefined && into) {
    const moved = advance(flow, { ...s, visited: [] }, exit, ctx);
    const entered = moved.flow !== s.flow || moved.stack.length !== s.stack.length;
    if (!entered) next = { ...run, state: { ...moved, visited: merge(s.visited, moved.visited) } };
    else if (node.type === 'handoff') { finished.push({ flow: s.flow, step: s.step, visited: s.visited }); next = { root: moved.flow, outer: [], state: moved }; }
    else next = { ...run, outer: [...run.outer, s.visited], state: moved };
  } else {
    const moved = advance(flow, s, exit, ctx);
    next = { ...run, state: moved };
    /* Ein „Powrót": zurück in die rufende Erzählung — was danach besucht wurde, gehört ihr. */
    if (moved.stack.length < s.stack.length && run.outer.length > 0) {
      const back = s.stack[s.stack.length - 1];
      const parent = flows(back.flow);
      const target = parent === undefined || back.step === null ? null : follow(parent, back.step, exitAfter(parent, back.step));
      const tail = moved.visited.slice(s.visited.length);
      const at = target === null ? -1 : tail.indexOf(target);
      finished.push({ flow: s.flow, step: s.step, visited: at < 0 ? moved.visited : moved.visited.slice(0, s.visited.length + at) });
      next = { ...run, outer: run.outer.slice(0, -1), state: { ...moved, visited: merge(run.outer[run.outer.length - 1], at < 0 ? [] : tail.slice(at)) } };
    }
  }
  return settle(next, flows, ctx, finished);
}

/** Die laufende Erzählung, die eigene (geöffnete) und die rufenden dazwischen (die äusserste zuerst). */
export function runningOf(run: StoryRun, flows: (id: string) => Flow | undefined): { readonly running: Flow | undefined; readonly root: Flow | undefined; readonly trail: readonly Flow[] } {
  return { running: flows(run.state.flow), root: flows(run.root), trail: run.state.stack.map((x) => flows(x.flow)).filter((f): f is Flow => f !== undefined) };
}

/* -- Abstecher (2026-11-04, Prompt 13) ------------------------------------------------------------------------------- */

/** Ein Rahmen eines offenen Abstechers, wie er an der Stelle der äusseren Erzählung steht: die Erzählung und ihr Schritt. */
export interface InsideFrame {
  readonly flow: string;
  readonly step: string;
}

const nodeAt = (flows: (id: string) => Flow | undefined, flow: string, step: string | null): GraphNode | undefined =>
  step === null ? undefined : flows(flow)?.graph.nodes.find((n) => n.id === step);
const isDetour = (flows: (id: string) => Flow | undefined, frame: { readonly flow: string; readonly step: string | null }) => nodeAt(flows, frame.flow, frame.step)?.type === 'detour';

/**
 * WAS DIE EIGENE ERZÄHLUNG SICH MERKT, SOLANGE ABSTECHER OFFEN SIND: ihr Schritt ist der Abstecher, ihre besuchten Schritte
 * warten, und `inside` sagt, in welchen Erzählungen der Lernende darunter steht (die äusserste zuerst, die laufende zuletzt).
 * `null`: kein Abstecher offen (oder ein anderer Weg hinein — ein Unterablauf merkt sich so nichts).
 */
export function insideOf(run: StoryRun, flows: (id: string) => Flow | undefined): { readonly step: string; readonly visited: readonly string[]; readonly inside: readonly InsideFrame[] } | null {
  const s = run.state;
  if (s.stack.length === 0 || s.step === null || s.stack[0].flow !== run.root || s.stack[0].step === null) return null;
  if (!s.stack.every((x) => isDetour(flows, x))) return null;
  const inside: InsideFrame[] = [...s.stack.slice(1).map((x) => ({ flow: x.flow, step: x.step ?? '' })), { flow: s.flow, step: s.step }];
  return { step: s.stack[0].step, visited: run.outer[0] ?? [], inside };
}

/**
 * WIEDER IM ABSTECHER (nach dem Neuladen, auf einem anderen Gerät): von der Stelle der äusseren Erzählung (ihr Schritt ist
 * der Abstecher) Rahmen für Rahmen hinein — nur, solange der Schritt wirklich ein Abstecher in genau diese Erzählung ist
 * (ein neu eingespielter Ablauf: so weit, wie es noch stimmt). Die besuchten Schritte jeder Erzählung kommen aus ihrer eigenen
 * Stelle (`keptOf`).
 */
export function resumeInside(run: StoryRun, inside: readonly InsideFrame[], flows: (id: string) => Flow | undefined, ctx: PlayContext, keptOf: (flow: string) => { readonly visited?: readonly string[] } | undefined): StoryRun {
  let r = run;
  for (const frame of inside) {
    const s = r.state;
    if (s.ended || s.step === null) break;
    const node = nodeAt(flows, s.flow, s.step);
    if (node?.type !== 'detour') break;
    const inner = flows(typeof node.config.flow === 'string' ? node.config.flow : '');
    if (inner === undefined || inner.id !== (flows(frame.flow)?.id ?? frame.flow) || detourRefused(s, inner.id, flows) !== null) break;
    const nodes = new Set(inner.graph.nodes.map((n) => n.id));
    const visited = (keptOf(inner.id)?.visited ?? []).filter((id) => nodes.has(id));
    const state = enterAt(inner, {
      ...s, flow: inner.id, chapter: null, item: undefined, queue: undefined, ended: false, visited,
      stack: [...s.stack, { flow: s.flow, step: s.step }]
    }, nodes.has(frame.step) ? frame.step : inner.start, ctx);
    r = { ...r, outer: [...r.outer, s.visited], state };
  }
  return r;
}

/**
 * „WEJDŹ" / „PRZYPOMNIJ": in die Erzählung des Abstechers — war der Lernende schon in ihr (und hat sie nicht beendet), dort,
 * wo er war; sonst (und bei „Przypomnij") von vorn.
 */
export function detourIn(run: StoryRun, flows: (id: string) => Flow | undefined, ctx: PlayContext, kept?: { readonly step?: string; readonly visited?: readonly string[]; readonly done?: boolean } | null): RunStep {
  const step = stepRun(run, flows, 'enter', ctx);
  const s = step.run.state;
  if (s.stack.length <= run.state.stack.length || kept == null || kept.done === true || kept.step === undefined || kept.step === '') return step;
  const inner = flows(s.flow);
  if (inner === undefined || !inner.graph.nodes.some((n) => n.id === kept.step)) return step;
  const nodes = new Set(inner.graph.nodes.map((n) => n.id));
  const visited = (kept.visited ?? []).filter((id) => nodes.has(id));
  return { ...step, run: { ...step.run, state: enterAt(inner, { ...s, visited, ended: false }, kept.step, ctx) } };
}

/**
 * „WRÓĆ DO …": zurück an den Abstecher einer rufenden Erzählung (`depth`: wie viele Rahmen bleiben — 0: die eigene), ohne
 * die verlassenen als ukończona zu merken. Nur durch Abstecher (ein Unterablauf ginge sonst gleich wieder hinein).
 */
export function backTo(run: StoryRun, flows: (id: string) => Flow | undefined, depth: number): StoryRun {
  let r = run;
  while (r.state.stack.length > Math.max(0, depth)) {
    const s = r.state;
    const back = s.stack[s.stack.length - 1];
    if (back.step === null || !isDetour(flows, back)) break;
    const visited = r.outer[r.outer.length - 1] ?? [];
    r = {
      ...r, outer: r.outer.slice(0, -1),
      state: { ...s, flow: back.flow, step: back.step, stack: s.stack.slice(0, -1), item: back.item, queue: undefined, chapter: null, ended: false, visited: visited.includes(back.step) ? visited : [...visited, back.step] }
    };
  }
  return r;
}

/** Welche Rahmen des Stapels ein Lernender mit „Wróć do …" erreichen kann (die Tiefe, bis zu der alles darüber Abstecher sind). */
export function backDepths(run: StoryRun, flows: (id: string) => Flow | undefined): number[] {
  const out: number[] = [];
  const stack = run.state.stack;
  for (let d = stack.length - 1; d >= 0; d -= 1) {
    if (!isDetour(flows, stack[d])) break;
    out.push(d);
  }
  return out;
}

/* -- Automatische Schritte ------------------------------------------------------------------------------------------- */

/** Bedingungen, die jetzt schon gelten oder nicht (was der Lernende kann, beantwortet, erzählt hat; die Zeit). */
const STABLE = new Set(['knowness', 'answered', 'flow', 'time']);
const stable = (c: Condition): boolean => (c.type === 'and' || c.type === 'or' || c.type === 'not' || c.type === 'xor' ? (c.items ?? []).every(stable) : STABLE.has(c.type));

/**
 * WIE EIN WARUNEK FÜR DIESEN LERNENDEN JETZT AUSGEHT (für die Ścieżka, `storyPath` → `decide`): „yes"/„no", wenn er nur auf
 * Beständiges schaut; `null` bei Werten, Besuchtem, Ort — das entscheidet sich erst unterwegs.
 */
export const decideBy = (facts: Facts) => (node: GraphNode): string | null => {
  if (node.type !== 'condition') return null;
  const c = readCondition(node.config.condition);
  if (c !== null && !stable(c)) return null;
  return holds(c, facts) ? 'yes' : 'no';
};
