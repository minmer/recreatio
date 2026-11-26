/**
 * 2026-11-22 (Eigentümer, „guide-good-world" I3/I4) — EIN INHALT, ZWEI REIHENFOLGEN: dieselbe Erzählung spielt allein
 * (`self` — erst erklären, dann fragen) und in einer Stunde (`lesson` — erst vorhersagen lassen, dann erklären). Was der Modus
 * spielt, sagt der Inhalt selbst, nicht ein Tag:
 * <code>
 *   "use": "self" | "lesson" | "both"     an einem Eintrag (Folie, Frage — ein Schlüssel seiner Daten, Vorgabe "both")
 *                                          oder an einem Schritt ("use" in seiner Einstellung — gewinnt; dieselbe Folie kann
 *                                          in zwei Erzählungen anders dienen)
 *   "predict": true                         an einem Schritt „question": eine VORHERSAGE — gefragt, ausgewertet (Ausgänge
 *                                          right/wrong/wrong:<tag>, die Verteilung der Klasse), aber sie zählt NIE (keine
 *                                          Antwort im Fortschritt, keine Kenntnis, Stufe, Eroberung, Wiederholung)
 *   {"type": "mode", "is": "lesson"}        eine Bedingung (Wahl, Warunek, skipWhen) — `logic.ts`
 * </code>
 * Spielen: ein Schritt, den der Modus nicht spielt, wird übersprungen wie mit `skipWhen` (über „dalej", eine Frage über
 * „dobrze"); ein Zweig einer Wahl oder eines Kapitels, dessen erster Schritt nicht passt, gilt nicht. Bleibt einer Wahl im
 * Modus genau EIN Zweig, nimmt die App ihn selbst — ohne Frage, auch mit "hold" oder "of" (wer leitet, sieht den Schalter nie).
 * Zählen (Ścieżka, Karte, Zähler): `countedGraph` — was der Modus nicht spielt, und jede Vorhersage, fällt weg (eine
 * Vorhersage zählt wie ein Schritt der Nachhilfe).
 * Rein (ohne React); geprüft in `scripts/app-adaptive-check.mjs` (§11).
 */

import type { Graph, GraphEdge, GraphNode } from './graph';
import { readCondition, type Condition } from './logic';
import { readMode, readUse, type PlayMode, type StepUse } from './modeWords';

export { readMode, readUse, type PlayMode, type StepUse } from './modeWords';
export const PLAY_MODES: readonly PlayMode[] = ['self', 'lesson'];
export const STEP_USES: readonly StepUse[] = ['both', 'self', 'lesson'];

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Spielt der Modus etwas mit diesem "use"? */
export const fitsMode = (use: StepUse, mode: PlayMode): boolean => use === 'both' || use === mode;

/**
 * 2026-11-26 (Eigentümer: „die Türme sind gemeinsam, die Pfade nicht") — EIN PFAD (eine Erzählung) IN EINEM MODUS: ohne "use" in
 * beiden, mit `"use": "self"` nur beim Selbstlernen, mit `"use": "lesson"` nur, wer unterrichtet (und die Klasse, die folgt).
 */
export const flowFitsMode = (flow: { readonly use?: 'self' | 'lesson' }, mode: PlayMode): boolean => flow.use === undefined || flow.use === mode;

/** Eine Vorhersage (`"predict": true` an einem Schritt „question")? */
export const isPredict = (node: Pick<GraphNode, 'type' | 'config'>): boolean => node.type === 'question' && node.config.predict === true;

/** Der Eintrag, für den ein Schritt steht (seine Folie, seine Frage) — `null`: keiner. */
export function stepEntryOf(node: Pick<GraphNode, 'type' | 'config'>): string | null {
  const c = node.config;
  switch (node.type) {
    case 'show': case 'expand': case 'opening': case 'line': return str(c.of) || null;
    case 'question': return str(c.of) || str(c.card) || null;
    default: return null;
  }
}

/** Der Wert "use" eines Eintrags (aus seinen Daten), wie ein Gastgeber ihn kennt — `undefined`: unbekannt. */
export type UseOf = (entry: string) => unknown;

/** Für wen ein Schritt spielt: seine eigene Einstellung, sonst die seines Eintrags, sonst beide. */
export function stepUse(node: Pick<GraphNode, 'type' | 'config'>, useOf?: UseOf): StepUse {
  const own = readUse(node.config.use);
  if (own !== null) return own;
  const entry = stepEntryOf(node);
  if (entry === null || useOf === undefined) return 'both';
  return readUse(useOf(entry)) ?? 'both';
}

/**
 * ÜBER WELCHEN AUSGANG ein Schritt übersprungen wird, den der Modus nicht spielt — `null`: er lässt sich nicht überspringen
 * (eine Wahl, Kapitel, Bedingung, Werte, Ende: dort sagt "use" nichts).
 */
export function skipExitOf(node: Pick<GraphNode, 'type' | 'config'>): string | null {
  switch (node.type) {
    case 'show': case 'opening': case 'line': case 'expand': case 'subflow': case 'each': return 'next';
    case 'scene': return node.config.question === true ? 'right' : 'next';
    case 'question': return 'right';
    case 'detour': return 'skip';
    case 'explore': return 'done';
    /* Ein Przegląd, den der Modus nicht spielt: weiter, als wäre er bestanden — ohne sein Ergebnis zu setzen. */
    case 'review': return 'passed';
    default: return null;
  }
}

/**
 * Die Ausgänge, über die ein übersprungener Schritt weitergeht, in dieser Reihenfolge (der erste mit einem Weg gilt): ein
 * Abstecher ohne „skip" über „done", eine Einstufung notfalls über „next", ein Przegląd notfalls über „notyet".
 */
export function skipExitsOf(node: Pick<GraphNode, 'type' | 'config'>): string[] {
  const first = skipExitOf(node);
  if (first === null) return [];
  return node.type === 'detour' ? ['skip', 'done'] : node.type === 'explore' ? ['done', 'next'] : node.type === 'review' ? ['passed', 'notyet'] : [first];
}

/** Wird dieser Schritt im Modus übersprungen? */
export function modeSkips(node: Pick<GraphNode, 'type' | 'config'>, mode: PlayMode, useOf?: UseOf): boolean {
  return skipExitOf(node) !== null && !fitsMode(stepUse(node, useOf), mode);
}

/**
 * KANN EINE BEDINGUNG IN DIESEM MODUS GELTEN? Drei Werte: eine Bedingung „mode" ist wahr oder falsch, alles andere
 * (Kenntnis, Werte, der Lauf …) unbekannt — `false` nur, wenn sie im Modus sicher nie gilt.
 */
export function modePossible(c: Condition | null, mode: PlayMode): boolean {
  const v = (x: Condition): boolean | null => {
    switch (x.type) {
      case 'mode': return x.is === undefined ? null : x.is === mode;
      case 'and': { const all = (x.items ?? []).map(v); return all.some((a) => a === false) ? false : all.length > 0 && all.every((a) => a === true) ? true : null; }
      case 'or': { const all = (x.items ?? []).map(v); return all.some((a) => a === true) ? true : all.length > 0 && all.every((a) => a === false) ? false : null; }
      case 'not': { const a = x.items?.[0] === undefined ? null : v(x.items[0]); return a === null ? null : !a; }
      case 'xor': { const all = (x.items ?? []).map(v); return all.some((a) => a === null) ? null : all.filter(Boolean).length % 2 === 1; }
      default: return null;
    }
  };
  return c === null || v(c) !== false;
}

/** Steht eine Bedingung „mode" darin (dann entscheidet der Modus mit)? */
export function usesMode(c: Condition | null): boolean {
  if (c === null) return false;
  return c.type === 'mode' || (c.items ?? []).some(usesMode);
}

const forkExit = (type: string, exit: string): boolean => (type === 'choice' && /^o\d+$/.test(exit)) || (type === 'chapters' && /^c\d+$/.test(exit));

/** Die Bedingung einer Möglichkeit einer Wahl (`o<i>`) — `null`: keine. */
export function optionCondition(node: Pick<GraphNode, 'type' | 'config'>, exit: string): Condition | null {
  if (node.type !== 'choice' || !/^o\d+$/.test(exit)) return null;
  const option = (Array.isArray(node.config.options) ? node.config.options : [])[Number(exit.slice(1))];
  return isObject(option) ? readCondition(option.condition) : null;
}

/**
 * PASST EIN ZWEIG ZUM MODUS? Sein erster Schritt wird nicht übersprungen, und seine Bedingung (bei einer Wahl) kann im
 * Modus gelten. `first`: der Schritt, zu dem der Ausgang führt (`undefined`: keiner — ein Zweig ins Leere passt immer).
 */
export function branchFits(node: Pick<GraphNode, 'type' | 'config'>, exit: string, first: Pick<GraphNode, 'type' | 'config'> | undefined, mode: PlayMode, useOf?: UseOf): boolean {
  if (!modePossible(optionCondition(node, exit), mode)) return false;
  return first === undefined || !modeSkips(first, mode, useOf);
}

export interface ModeView {
  readonly mode: PlayMode;
  readonly useOf?: UseOf;
  /** Vorhersagen: `bypass` (Vorgabe — zum Zählen: sie zählen nie) oder `keep` (was der Modus spielt). */
  readonly predict?: 'bypass' | 'keep';
}

/**
 * WAS DER MODUS SPIELT — UND WAS ZÄHLT (Ścieżka, Weltkarte, Zähler): Schritte, die der Modus nicht spielt, und jede Vorhersage
 * fallen heraus (wer zu ihnen führte, führt nun dorthin, wohin sie weitergingen); Zweige einer Wahl oder eines Kapitels, die im
 * Modus nicht gelten, fallen weg; was nur durch sie erreichbar war, auch. Was vorher schon unerreichbar war, bleibt (die Prüfung
 * soll es weiter sehen). Ohne Wirkung: derselbe Graph.
 */
export function countedGraph(graph: Graph, start: string | null, view: ModeView): { readonly graph: Graph; readonly start: string | null } {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n] as const));
  /* Je übersprungenem Schritt die Ausgänge, über die er weitergeht (der erste mit einem Weg gilt). */
  const skip = new Map<string, readonly string[]>();
  const byMode = new Set<string>();
  for (const n of graph.nodes) {
    const exits = skipExitsOf(n);
    if (exits.length === 0) continue;
    if (!fitsMode(stepUse(n, view.useOf), view.mode)) { skip.set(n.id, exits); byMode.add(n.id); }
    else if (isPredict(n) && view.predict !== 'keep') skip.set(n.id, exits);
  }
  const invalid = (e: GraphEdge): boolean => {
    const from = nodes.get(e.from);
    if (from === undefined || !forkExit(from.type, e.out)) return false;
    return !modePossible(optionCondition(from, e.out), view.mode) || byMode.has(e.to);
  };
  /*
    Eine Wahl oder Kapitel ohne die Zweige, die der Modus nicht spielt: sie bleiben in der Einstellung (die Zählung o<i>/c<i> bleibt),
    tragen aber `_dropped` — `exitsOf` nennt sie nicht mehr (sonst stünde dort ein Zweig ins Leere). Bleibt einer WAHL so genau ein
    Zweig, gibt es sie nicht mehr (der Spieler nimmt ihn selbst): sie wird wie ein Schritt übersprungen, über diesen Zweig.
  */
  const dropped = new Map<string, Set<number>>();
  for (const e of graph.edges) {
    if (!invalid(e)) continue;
    const set = dropped.get(e.from) ?? new Set<number>();
    set.add(Number(e.out.slice(1)));
    dropped.set(e.from, set);
  }
  for (const id of dropped.keys()) {
    const n = nodes.get(id);
    if (n === undefined || n.type !== 'choice') continue;
    const left = graph.edges.filter((e) => e.from === id && forkExit(n.type, e.out) && !invalid(e));
    if (left.length === 1) skip.set(id, [left[0].out]);
  }
  if (skip.size === 0 && dropped.size === 0) return { graph, start };
  /* Wohin ein übersprungener Schritt führt (über seine Kette, ohne Kreis). */
  const via = (id: string | null): string | null => {
    let at = id;
    const seen = new Set<string>();
    while (at !== null && skip.has(at)) {
      if (seen.has(at)) return null;
      seen.add(at);
      const from: string = at;
      at = (skip.get(from) ?? []).map((x) => graph.edges.find((e) => e.from === from && e.out === x)?.to).find((x) => x !== undefined) ?? null;
    }
    return at;
  };
  const edges: GraphEdge[] = [];
  for (const e of graph.edges) {
    if (skip.has(e.from) || invalid(e)) continue;
    if (!skip.has(e.to)) { edges.push(e); continue; }
    const to = via(e.to);
    if (to !== null) edges.push({ ...e, to });
  }
  const mark = (n: GraphNode): GraphNode => {
    const gone = dropped.get(n.id);
    if (gone === undefined) return n;
    const key = n.type === 'choice' ? 'options' : 'chapters';
    const list = Array.isArray(n.config[key]) ? (n.config[key] as unknown[]) : [];
    return { ...n, config: { ...n.config, [key]: list.map((o, i) => (!gone.has(i) ? o : { ...(isObject(o) ? o : { label: str(o) }), _dropped: true })) } };
  };
  const kept = graph.nodes.filter((n) => !skip.has(n.id)).map(mark);
  const newStart = start === null ? null : via(start);
  /* Was vorher erreichbar war und jetzt nicht mehr: nur hinter einem übersprungenen Schritt oder einem ungültigen Zweig — weg. */
  const reach = (list: readonly GraphEdge[], from: string | null): Set<string> => {
    const out = new Set<string>();
    const todo = from === null ? [] : [from];
    while (todo.length > 0) { const id = todo.pop()!; if (out.has(id)) continue; out.add(id); for (const e of list) if (e.from === id) todo.push(e.to); }
    return out;
  };
  const before = reach(graph.edges, start);
  const after = reach(edges, newStart);
  const gone = new Set(kept.filter((n) => before.has(n.id) && !after.has(n.id)).map((n) => n.id));
  return {
    graph: { nodes: kept.filter((n) => !gone.has(n.id)), edges: edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)) },
    start: newStart
  };
}

/* -- Prüfung für den Import ---------------------------------------------------------------------------------------- */

export interface ModeProblem {
  /** `useUnknown`: ein Wert "use", den es nicht gibt · `modeUnknown`: eine Bedingung „mode" ohne gültiges "is" · `branchNever`: ein Zweig, in den kein Modus je kommt · `emptyIn`: im Modus bleibt von der Erzählung nichts. */
  readonly key: 'useUnknown' | 'modeUnknown' | 'branchNever' | 'emptyIn';
  readonly step?: string;
  readonly params: Readonly<Record<string, string>>;
}

/** Eine Bedingung „mode" mit einem "is", das es nicht gibt (roh gelesen — `readCondition` liesse sie fallen). */
function badModes(raw: unknown, depth = 0): string[] {
  if (!isObject(raw) || depth > 12) return [];
  if (raw.type === 'mode') return raw.is === undefined || readMode(raw.is) !== null ? [] : [String(raw.is)];
  return (Array.isArray(raw.items) ? raw.items : []).flatMap((x) => badModes(x, depth + 1));
}

/** Steht in der Erzählung etwas, das gezeigt oder gefragt wird? */
const hasContent = (g: Graph, start: string | null): boolean => {
  const seen = new Set<string>();
  const todo = start === null ? [] : [start];
  while (todo.length > 0) {
    const id = todo.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = g.nodes.find((x) => x.id === id);
    if (n !== undefined && skipExitOf(n) !== null) return true;
    for (const e of g.edges) if (e.from === id) todo.push(e.to);
  }
  return false;
};

/**
 * WAS AN DEN MODI EINER ERZÄHLUNG NICHT STIMMT (Warnungen): ein unbekannter Wert "use" (Schritt oder Eintrag), eine Bedingung
 * „mode" ohne gültiges "is", ein Zweig, in den kein Modus je kommt, und ein Modus, in dem von der Erzählung nichts bleibt.
 * `rawEntryUse`: der rohe Wert "use" eines Eintrags (für die Warnung über unbekannte Werte).
 */
export function modeProblems(graph: Graph, start: string | null, useOf?: UseOf): ModeProblem[] {
  const out: ModeProblem[] = [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n] as const));
  let modal = false;
  for (const n of graph.nodes) {
    const own = n.config.use;
    if (own !== undefined && readUse(own) === null) out.push({ key: 'useUnknown', step: n.id, params: { value: String(own) } });
    if (own !== undefined || isPredict(n)) modal = true;
    const entry = stepEntryOf(n);
    const raw = entry === null || useOf === undefined ? undefined : useOf(entry);
    if (raw !== undefined && raw !== null && raw !== '') {
      modal = true;
      if (readUse(raw) === null) out.push({ key: 'useUnknown', step: n.id, params: { value: String(raw) } });
    }
    for (const raw of [n.config.skipWhen, n.config.condition, ...(Array.isArray(n.config.options) ? n.config.options.map((o) => (isObject(o) ? o.condition : undefined)) : [])]) {
      for (const bad of badModes(raw)) out.push({ key: 'modeUnknown', step: n.id, params: { value: bad } });
      if (usesMode(readCondition(raw))) modal = true;
    }
  }
  if (!modal) return out;
  for (const e of graph.edges) {
    const from = nodes.get(e.from);
    if (from === undefined || !forkExit(from.type, e.out)) continue;
    const first = nodes.get(e.to);
    if (PLAY_MODES.every((m) => !branchFits(from, e.out, first, m, useOf))) out.push({ key: 'branchNever', step: from.id, params: { exit: e.out } });
  }
  for (const m of PLAY_MODES) {
    const g = countedGraph(graph, start, { mode: m, useOf, predict: 'keep' });
    if (!hasContent(g.graph, g.start)) out.push({ key: 'emptyIn', params: { mode: m } });
  }
  return out;
}
