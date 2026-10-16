/**
 * COGITA — DER GRAPH, auf dem alles Gezeichnete läuft (COGITA.md §4).
 *
 * <b>Einer statt sieben.</b> Der Altbestand hatte sieben Graph-Editoren —
 * Sammlungen, Abhängigkeiten, berechnete Fragen, Kartengraph, Storyboards,
 * Spielaktionen, Kartenvorlagen —, jeder mit eigenen Knoten, eigener
 * Speicherung und eigener Auswertung [N4]. Hier gibt es EIN Modell: Knoten mit
 * einem Typ, benannte Anschlüsse, Kanten von einem Ausgang zu einem Eingang.
 * Was ein Knoten tut, sagt seine PALETTE: die Kartenvorlage, die Wiederholung,
 * die Bedingung, der Ablauf, das Spiel bringen je ihre eigenen Knoten mit, und
 * derselbe Editor zeichnet sie alle.
 *
 * <code>
 *   Knoten    { id, type, x, y, config }      config: was der Knoten einstellt
 *   Kante     { id, from, out, to, in }       vom Ausgang `out` zum Eingang `in`
 *   Anschluss { id, label, type, many }       Typen müssen passen, `any` passt zu allem
 * </code>
 *
 * <b>Ausgewertet wird im Browser</b>, in der Reihenfolge der Kanten — ein Kreis
 * hat keine und wird beim Zeichnen schon verweigert. Ein Knoten bekommt je
 * Eingang die Werte aller Kanten, die dort ankommen, von oben nach unten so,
 * wie sie im Bild stehen. Scheitert ein Knoten, steht sein Fehler an ihm, und
 * nur, was von ihm abhängt, bleibt still; der Rest des Graphen läuft.
 *
 * <b>Asynchron</b>, weil ein Knoten in Python rechnen darf (Pyodide im Browser
 * [D10]) — alle anderen antworten sofort.
 *
 * <b>Duldsam beim Lesen</b>: ein Knoten ohne Typ, eine Kante ins Leere, ein
 * Kreis, eine doppelte Kennung fallen beim Lesen weg, statt den Graphen zu
 * zerbrechen. Was der Graph der Palette nicht recht macht, sagt `problemsOf`.
 */

/* -- Das Modell -------------------------------------------------------------------- */

export interface GraphNode {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface GraphEdge {
  readonly id: string;
  readonly from: string;
  readonly out: string;
  readonly to: string;
  readonly in: string;
}

export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Passt zu jedem anderen Typ. */
export const ANY = 'any';

export interface Port {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  /** Nimmt mehrere Kanten; sonst ersetzt eine neue die alte. */
  readonly many?: boolean;
}

export interface Ports {
  readonly inputs: readonly Port[];
  readonly outputs: readonly Port[];
}

export interface RunInput<C> {
  readonly node: GraphNode;
  readonly config: Readonly<Record<string, unknown>>;
  /** Je Eingang die ankommenden Werte, in der Reihenfolge des Bildes. */
  readonly inputs: Readonly<Record<string, readonly unknown[]>>;
  readonly ctx: C;
}

export type RunOutput = Readonly<Record<string, unknown>>;

export interface NodeKind<C> {
  readonly type: string;
  readonly label: string;
  /** Was der Knoten tut, in einem Satz — im Editor und in der Beschreibung des JSON. */
  readonly says: string;
  /** Unter welcher Überschrift er in der Palette steht. */
  readonly group: string;
  /** Die Anschlüsse dürfen von der Einstellung abhängen (ein Muster mit drei Lücken hat drei Eingänge). */
  readonly ports: (config: Readonly<Record<string, unknown>>) => Ports;
  readonly run: (input: RunInput<C>) => RunOutput | Promise<RunOutput>;
}

export interface Palette<C> {
  readonly id: string;
  readonly kinds: ReadonlyMap<string, NodeKind<C>>;
}

export function paletteOf<C>(id: string, kinds: readonly NodeKind<C>[]): Palette<C> {
  return { id, kinds: new Map(kinds.map((k) => [k.type, k])) };
}

/* -- Lesen und Schreiben ----------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Ein Graph aus seinem JSON. Es fällt weg: ein Knoten ohne Kennung oder Typ,
 * eine doppelte Kennung, eine Kante zu einem Knoten, den es nicht gibt, eine
 * Schleife auf sich selbst, eine doppelte Kante, und jede Kante, die einen
 * Kreis schlösse — in der Reihenfolge, in der sie dastehen. `cycles`: ein Ablauf darf
 * zurückführen (ein Kapitel neu, zurück zur Auswahl) — dann bleiben Kreise.
 */
export function readGraph(raw: unknown, cycles = false): Graph {
  const doc = isObject(raw) ? raw : {};
  const nodes: GraphNode[] = [];
  const ids = new Set<string>();
  for (const one of Array.isArray(doc.nodes) ? doc.nodes : []) {
    if (!isObject(one)) continue;
    const id = str(one.id).trim();
    const type = str(one.type).trim();
    if (id === '' || type === '' || ids.has(id)) continue;
    ids.add(id);
    nodes.push({ id, type, x: num(one.x), y: num(one.y), config: isObject(one.config) ? one.config : {} });
  }

  let graph: Graph = { nodes, edges: [] };
  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  for (const one of Array.isArray(doc.edges) ? doc.edges : []) {
    if (!isObject(one)) continue;
    const edge: GraphEdge = {
      id: str(one.id).trim(),
      from: str(one.from).trim(),
      out: str(one.out).trim() || 'out',
      to: str(one.to).trim(),
      in: str(one.in).trim() || 'in'
    };
    const pair = `${edge.from}\u0000${edge.out}\u0000${edge.to}\u0000${edge.in}`;
    if (edge.id === '' || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to)) continue;
    if (edge.from === edge.to || pairs.has(pair) || (!cycles && wouldCycle(graph, edge.from, edge.to))) continue;
    edgeIds.add(edge.id);
    pairs.add(pair);
    graph = { nodes, edges: [...graph.edges, edge] };
  }
  return graph;
}

/** Das JSON eines Graphen — dieselbe Form, die `readGraph` liest. */
export function graphJson(graph: Graph): Record<string, unknown> {
  return {
    nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type, x: Math.round(n.x), y: Math.round(n.y), config: n.config })),
    edges: graph.edges.map((e) => ({ id: e.id, from: e.from, out: e.out, to: e.to, in: e.in }))
  };
}

/* -- Form ------------------------------------------------------------------------- */

/** Ob eine Kante `from → to` einen Kreis schlösse: kommt man von `to` zurück zu `from`? */
export function wouldCycle(graph: Graph, from: string, to: string): boolean {
  if (from === to) return true;
  const next = new Map<string, string[]>();
  for (const e of graph.edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return false;
}

/** Die Reihenfolge der Auswertung — `null`, wenn der Graph doch einen Kreis hat. */
export function order(graph: Graph): string[] | null {
  const indegree = new Map(graph.nodes.map((n) => [n.id, 0]));
  const next = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  }
  /* Bei Gleichstand von oben nach unten, dann von links nach rechts — wie man das Bild liest. */
  const place = new Map(graph.nodes.map((n, i) => [n.id, { y: n.y, x: n.x, i }]));
  const byPlace = (a: string, b: string) => {
    const pa = place.get(a)!;
    const pb = place.get(b)!;
    return pa.y - pb.y || pa.x - pb.x || pa.i - pb.i;
  };
  const ready = graph.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id).sort(byPlace);
  const out: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    out.push(id);
    for (const to of next.get(id) ?? []) {
      const left = (indegree.get(to) ?? 0) - 1;
      indegree.set(to, left);
      if (left === 0) {
        ready.push(to);
        ready.sort(byPlace);
      }
    }
  }
  return out.length === graph.nodes.length ? out : null;
}

/** Alles, wovon ein Knoten abhängt, er selbst eingeschlossen. */
export function ancestors(graph: Graph, id: string): Set<string> {
  const back = new Map<string, string[]>();
  for (const e of graph.edges) back.set(e.to, [...(back.get(e.to) ?? []), e.from]);
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const one = stack.pop()!;
    if (seen.has(one)) continue;
    seen.add(one);
    stack.push(...(back.get(one) ?? []));
  }
  return seen;
}

export const compatible = (out: string, into: string): boolean => out === into || out === ANY || into === ANY;

function portsOf<C>(palette: Palette<C>, node: GraphNode): Ports | null {
  const kind = palette.kinds.get(node.type);
  return kind === undefined ? null : kind.ports(node.config);
}

/**
 * Eine Kante ziehen. Verweigert, was nicht geht — einen Kreis, einen Anschluss,
 * den es nicht gibt, Typen, die nicht passen —, und zwar mit einem Satz, den
 * der Editor zeigen kann. Ein Eingang ohne `many` nimmt eine Kante: die neue
 * ersetzt die alte.
 */
export function connect<C>(graph: Graph, palette: Palette<C>, edge: GraphEdge, cycles = false): { graph: Graph } | { error: string } {
  const from = graph.nodes.find((n) => n.id === edge.from);
  const to = graph.nodes.find((n) => n.id === edge.to);
  if (from === undefined || to === undefined) return { error: 'Nie ma takiego kroku.' };
  const outs = portsOf(palette, from);
  const ins = portsOf(palette, to);
  const out = outs?.outputs.find((p) => p.id === edge.out);
  const into = ins?.inputs.find((p) => p.id === edge.in);
  if (out === undefined || into === undefined) return { error: 'Nie ma takiego wejścia albo wyjścia.' };
  if (!compatible(out.type, into.type)) return { error: `To nie pasuje: „${out.label}" nie daje tego, czego potrzebuje „${into.label}".` };
  if (!cycles && wouldCycle(graph, edge.from, edge.to)) return { error: 'Tak powstałoby koło — krok zależałby od samego siebie.' };
  if (edge.from === edge.to) return { error: 'Krok nie może prowadzić do samego siebie.' };
  const kept = graph.edges.filter((e) =>
    e.id !== edge.id
    && !(e.from === edge.from && e.out === edge.out && e.to === edge.to && e.in === edge.in)
    && (into.many === true || !(e.to === edge.to && e.in === edge.in)));
  return { graph: { nodes: graph.nodes, edges: [...kept, edge] } };
}

/** Was am Graphen nicht stimmt — für den Editor, den Import und die Prüfung vor dem Lauf. */
export function problemsOf<C>(graph: Graph, palette: Palette<C>, cycles = false): { readonly node?: string; readonly text: string }[] {
  const out: { node?: string; text: string }[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const node of graph.nodes) {
    if (!palette.kinds.has(node.type)) out.push({ node: node.id, text: `Nieznany rodzaj kroku: „${node.type}".` });
  }
  const taken = new Map<string, number>();
  for (const edge of graph.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) continue;
    const out1 = portsOf(palette, from)?.outputs.find((p) => p.id === edge.out);
    const into = portsOf(palette, to)?.inputs.find((p) => p.id === edge.in);
    if (out1 === undefined || into === undefined) { out.push({ node: to.id, text: 'Połączenie prowadzi do wejścia, którego nie ma.' }); continue; }
    if (!compatible(out1.type, into.type)) out.push({ node: to.id, text: `Połączenie „${out1.label}" → „${into.label}" nie pasuje.` });
    const key = `${edge.to}\u0000${edge.in}`;
    taken.set(key, (taken.get(key) ?? 0) + 1);
    if (!into.many && (taken.get(key) ?? 0) > 1) out.push({ node: to.id, text: `Wejście „${into.label}" przyjmuje jedno połączenie.` });
  }
  if (!cycles && order(graph) === null) out.push({ text: 'Graf ma koło.' });
  return out;
}

/* -- Auswerten -------------------------------------------------------------------- */

export interface Evaluation {
  readonly outputs: ReadonlyMap<string, RunOutput>;
  readonly errors: ReadonlyMap<string, string>;
}

export interface EvaluateOptions {
  /** Nur diese Knoten (etwa: was ein Ziel braucht, `ancestors`). */
  readonly only?: ReadonlySet<string>;
  /** Vorgegebene Ausgänge — der Knoten läuft dann nicht selbst (die Schleife „für jeden Wert"). */
  readonly fixed?: ReadonlyMap<string, RunOutput>;
}

/** Ein Knoten, dessen Vorgänger gescheitert ist, läuft nicht — sein Fehler wäre nur ein Echo. */
export const UPSTREAM = 'Poprzedni krok się nie udał.';

export async function evaluate<C>(graph: Graph, palette: Palette<C>, ctx: C, options: EvaluateOptions = {}): Promise<Evaluation> {
  const outputs = new Map<string, RunOutput>();
  const errors = new Map<string, string>();
  const sequence = order(graph);
  if (sequence === null) {
    for (const node of graph.nodes) errors.set(node.id, 'Graf ma koło.');
    return { outputs, errors };
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const place = new Map(graph.nodes.map((n, i) => [n.id, { y: n.y, x: n.x, i }]));
  const incoming = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e]);

  for (const id of sequence) {
    if (options.only !== undefined && !options.only.has(id)) continue;
    const node = byId.get(id)!;
    const fixed = options.fixed?.get(id);
    if (fixed !== undefined) { outputs.set(id, fixed); continue; }
    const kind = palette.kinds.get(node.type);
    if (kind === undefined) { errors.set(id, `Nieznany rodzaj kroku: „${node.type}".`); continue; }

    const edges = (incoming.get(id) ?? []).slice().sort((a, b) => {
      const pa = place.get(a.from)!;
      const pb = place.get(b.from)!;
      return pa.y - pb.y || pa.x - pb.x || pa.i - pb.i;
    });
    if (edges.some((e) => errors.has(e.from))) { errors.set(id, UPSTREAM); continue; }

    const inputs: Record<string, unknown[]> = {};
    for (const port of kind.ports(node.config).inputs) inputs[port.id] = [];
    for (const e of edges) {
      const produced = outputs.get(e.from);
      if (produced === undefined || !(e.out in produced)) continue;
      (inputs[e.in] ??= []).push(produced[e.out]);
    }

    try {
      outputs.set(id, await kind.run({ node, config: node.config, inputs, ctx }));
    } catch (e) {
      errors.set(id, e instanceof Error && e.message !== '' ? e.message : 'Ten krok się nie udał.');
    }
  }
  return { outputs, errors };
}
