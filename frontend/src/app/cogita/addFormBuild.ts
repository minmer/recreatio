/**
 * COGITA — FORMULARZE DODAWANIA BAUEN HELFEN (COGITA.md §2.4): ein Anfang aus
 * einem Rodzaj, noch ein Eintrag wie dieser (die nächste Sprache), und die
 * Reihenfolge der Module im Editor. Das Modell steht in `addForm.ts`.
 */

import { entryConfig, isTypeable, nodeLabel, pickConfig, refFields, rowOrder, type AddForm } from './addForm';
import type { Graph, GraphEdge, GraphNode } from './graph';
import { patternKeys, type FieldDef, type KindDef, type Lookup } from './schema';

/* -- Ein Formular aus einem Rodzaj ------------------------------------------------------------- */

/** Der Abstand der Spalten: links die Wahlen oben, in der Mitte die Einträge der Zeile, rechts, was sie verbindet. Eng genug, dass die Leinwand neben den Einstellungen lesbar bleibt. */
export const COLUMN = 260;

/**
 * Die Felder, die man von einem Rodzaj tippt: die seines Etiketts, die man
 * tippen kann. Ein Rodzaj, dessen Etikett nur aus Verweisen besteht (eine
 * Übersetzung: „{z}"), tippt man nicht — er VERBINDET.
 */
export function defaultTyped(kind: KindDef): FieldDef[] {
  const inLabel = new Set(patternKeys(kind.label));
  const typed = kind.fields.filter((f) => inLabel.has(f.key) && isTypeable(f));
  if (typed.length > 0) return typed;
  if (kind.fields.some((f) => f.type === 'ref' && inLabel.has(f.key))) return [];
  return kind.fields.filter(isTypeable).slice(0, 1);
}

/**
 * EIN ANFANG AUS EINEM RODZAJ: ein Rodzaj, den man tippt (Słowo), bekommt
 * seine Verweise als Wahlen oben (Język, Temat). Einer, der verbindet
 * (Tłumaczenie: z → Słowo, na → Słowo), bekommt für jeden Verweis einen
 * Eintrag je Zeile — und deren Verweise als Wahlen oben: getrennt, wo das
 * Feld EINEN Eintrag nimmt (die Sprache von „z" ist nicht die von „na"),
 * gemeinsam, wo es mehrere nimmt (Themen).
 */
export function formFromKind(root: KindDef, look: Pick<Lookup, 'kind'>, makeId: () => string): { name: string; graph: Graph } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const fieldsOfConfig = (typed: readonly FieldDef[]) => Object.fromEntries(typed.map((f) => [f.key, { from: 'type' }]));
  const add = (type: 'entry' | 'pick', x: number, y: number, config: Record<string, unknown>): string => {
    const id = makeId();
    nodes.push({ id, type, x, y, config });
    return id;
  };
  const link = (from: string, to: string, field: string) => edges.push({ id: makeId(), from, out: 'out', to, in: field });
  const target = (f: FieldDef): KindDef | undefined => (f.to !== undefined && f.to.length === 1 ? look.kind(f.to[0]) : undefined);
  const shared = new Map<string, string>();
  let pickY = 0;
  /* Pflicht ist eine Wahl nur, wo das Feld genau EINEN Eintrag eines bestimmten Rodzaj nimmt (die Sprache). */
  const pickFor = (f: FieldDef, ownerLabel: string | null): string => {
    const kinds = f.to ?? [];
    const share = `${f.key}|${kinds.join(',')}`;
    if (f.multi && shared.has(share)) return shared.get(share)!;
    /* Eine Wahl je Zeilen-Eintrag bleibt ohne Namen: sie heisst nach ihm („Język — angielski", `nodeLabel`). */
    const named = f.multi || ownerLabel === null ? { label: f.label } : {};
    const id = add('pick', 0, pickY, { ...named, kinds: [...kinds], many: f.multi, optional: f.multi || target(f) === undefined, value: [] });
    pickY += 110;
    if (f.multi) shared.set(share, id);
    return id;
  };
  const rootTyped = defaultTyped(root);
  if (rootTyped.length > 0) {
    const id = add('entry', COLUMN, 0, { kind: root.id, many: false, reuse: 'same', fields: fieldsOfConfig(rootTyped) });
    for (const f of refFields(root)) if (target(f)?.id !== root.id) link(pickFor(f, null), id, f.key);
    return { name: `Dodawanie: ${root.name}`, graph: { nodes, edges } };
  }
  const rootId = add('entry', 2 * COLUMN, 0, { kind: root.id, many: false, reuse: 'same', fields: {} });
  let childY = 0;
  for (const f of refFields(root)) {
    const kind = target(f);
    if (kind === undefined || kind.id === root.id || defaultTyped(kind).length === 0) {
      link(pickFor(f, null), rootId, f.key);
      continue;
    }
    /* Ein Feld, das mehrere nimmt, verbindet mindestens zwei: eine Übersetzung zwei Wörter („Word 1", „Word 2"); weitere fügt man im Editor hinzu. */
    const copies = f.multi ? 2 : 1;
    for (let n = 1; n <= copies; n += 1) {
      const label = copies === 1 ? f.label : `${f.label} ${n}`;
      const child = add('entry', COLUMN, childY, { kind: kind.id, label, many: false, reuse: 'same', fields: fieldsOfConfig(defaultTyped(kind)) });
      childY += 220;
      link(child, rootId, f.key);
      for (const g of refFields(kind)) if (target(g)?.id !== kind.id) link(pickFor(g, label), child, g.key);
    }
  }
  /* Der verbindende Eintrag steht in der Mitte seiner Zeilen-Einträge. */
  const at = nodes.findIndex((n) => n.id === rootId);
  nodes[at] = { ...nodes[at], y: Math.max(0, (childY - 220) / 2) };
  /*
    Die Wahlen oben stehen, wie die Leinwand sie zeigt — darum hier geordnet:
    erst die eines einzelnen Eintrags (die Sprache von „z", dann die von „na"),
    dann die gemeinsamen (Themen).
  */
  const fed = (id: string) => edges.filter((e) => e.from === id).map((e) => nodes.find((n) => n.id === e.to)?.y ?? 0);
  const picks = nodes.filter((n) => n.type === 'pick').sort((a, b) =>
    (fed(a.id).length === 1 ? 0 : 1) - (fed(b.id).length === 1 ? 0 : 1) || Math.min(...fed(a.id)) - Math.min(...fed(b.id)));
  picks.forEach((p, i) => { nodes[nodes.indexOf(p)] = { ...p, y: i * 110 }; });
  return { name: `Dodawanie: ${root.name}`, graph: { nodes, edges } };
}

/* -- Noch einer wie dieser, und die Reihenfolge darunter -------------------------------------- */

/** „Word" → „Word 2", „Word 2" → „Word 3": die nächste freie Nummer unter den Namen, die es gibt. */
export function nextLabel(label: string, taken: readonly string[]): string {
  const base = label.replace(/\s+\d+$/, '');
  let top = 1;
  for (const one of taken) {
    const rest = one.startsWith(`${base} `) ? one.slice(base.length + 1) : null;
    if (rest !== null && /^\d+$/.test(rest)) top = Math.max(top, Number(rest));
  }
  return `${base} ${top + 1}`;
}

/**
 * NOCH EINER WIE DIESER — die nächste Sprache: derselbe Rodzaj mit denselben
 * Feldern und einem freien Namen. Eine Wahl oben, die nur ihn speiste (seine
 * Sprache), bekommt der neue als eigene, leer; eine gemeinsame (Themen) speist
 * beide. Wohin er zeigte, zeigt der neue auch — dort, wo das Feld mehrere nimmt
 * (eine Übersetzung aus mehreren Wörtern); ein Feld für EINEN ist schon besetzt.
 */
export function duplicateEntry(graph: Graph, nodeId: string, look: Pick<Lookup, 'kind'>, makeId: () => string): { graph: Graph; id: string } | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (node === undefined || node.type !== 'entry') return null;
  const id = makeId();
  const label = nextLabel(nodeLabel(node, look), graph.nodes.filter((n) => n.type === 'entry').map((n) => nodeLabel(n, look)));
  const below = Math.max(...graph.nodes.filter((n) => Math.abs(n.x - node.x) < 120).map((n) => n.y)) + 220;
  const nodes: GraphNode[] = [...graph.nodes, { ...node, id, y: below, config: { ...node.config, label } }];
  const edges: GraphEdge[] = [...graph.edges];
  for (const e of graph.edges.filter((x) => x.to === nodeId)) {
    const from = graph.nodes.find((n) => n.id === e.from);
    if (from === undefined) continue;
    /* Eine eigene Wahl (seine Sprache) bekommt er neu; eine für ein Feld, das mehrere nimmt (Themen), teilen sich beide. */
    const field = refFields(look.kind(entryConfig(node.config).kind)).find((f) => f.key === e.in);
    const own = from.type === 'pick' && field?.multi !== true && graph.edges.every((x) => x.from !== from.id || x.to === nodeId);
    if (!own) { edges.push({ id: makeId(), from: e.from, out: e.out, to: id, in: e.in }); continue; }
    const pickId = makeId();
    const named = pickConfig(from.config).label;
    const taken = nodes.filter((n) => n.type === 'pick').map((n) => nodeLabel(n, look, { nodes, edges }));
    /* Gleich unter die Wahl, die er abschreibt — die Wahlen darunter rücken nach: oben beim Ausfüllen steht die neue Sprache bei den anderen. */
    for (let i = 0; i < nodes.length; i += 1) if (nodes[i].type === 'pick' && nodes[i].y > from.y) nodes[i] = { ...nodes[i], y: nodes[i].y + 110 };
    nodes.push({
      ...from, id: pickId, y: from.y + 110,
      config: { ...from.config, value: [], ...(named === undefined ? {} : { label: nextLabel(named, taken) }) }
    });
    edges.push({ id: makeId(), from: pickId, out: 'out', to: id, in: e.in });
  }
  for (const e of graph.edges.filter((x) => x.from === nodeId)) {
    const target = graph.nodes.find((n) => n.id === e.to);
    const field = target === undefined ? undefined : refFields(look.kind(entryConfig(target.config).kind)).find((f) => f.key === e.in);
    if (field?.multi === true) edges.push({ id: makeId(), from: id, out: 'out', to: e.to, in: e.in });
  }
  return { graph: { nodes, edges }, id };
}

/** Wie die Knoten unter der Leinwand stehen: die Wahlen wie oben beim Ausfüllen, die Einträge wie in der Zeile (die verbindenden danach). */
export function designOrder(form: AddForm): { readonly picks: readonly GraphNode[]; readonly entries: readonly GraphNode[] } {
  const placed = form.graph.nodes.map((n, i) => ({ n, i }));
  return {
    picks: placed.filter(({ n }) => n.type === 'pick').sort((a, b) => a.n.y - b.n.y || a.n.x - b.n.x || a.i - b.i).map(({ n }) => n),
    entries: placed.filter(({ n }) => n.type === 'entry').sort(rowOrder(form)).map(({ n }) => n)
  };
}
