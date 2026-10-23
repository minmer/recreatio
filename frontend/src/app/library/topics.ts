/**
 * DIE THEMEN ALS BAUM — und ihre ASPEKTE (2026-10-21).
 *
 * Ein Thema kann eine Achse sein (`aspect: "yes"`): „Okres liturgiczny",
 * „Księga", „Okazja", „Temat". Seine Unterthemen, in jeder Tiefe, sind ihre
 * Werte. Ein Text, der „Adwent" und „Nadzieja" trägt, liegt so zugleich in
 * zwei Ordnungen — und eine Seite zeigt dieselben Texte als Tabelle (je
 * Aspekt eine Spalte), mit Filtern oder als Baum, ohne dass ein Baustein die
 * Achsen kennen muss: sie stehen in der Bibliothek.
 *
 * Derselbe Baum dient dem Speicher im Browser (Einträge) und der
 * öffentlichen Seite (Kurzfassungen der veröffentlichten Themen).
 */

import { ids, num, str, type EntryData, type LibEntry } from './libraryKinds';

/** Ist dieses Thema ein Aspekt? (bis P5 nur noch für alte Einträge und Cogita) */
const isAspect = (data: EntryData): boolean => str(data, 'aspect') === 'yes';

export interface TopicNode {
  readonly id: string;
  readonly name: string;
  readonly parent: string | null;
  readonly aspect: boolean;
  /** Platz unter Geschwistern — `null`: nach dem Namen. */
  readonly order: number | null;
}

export interface TopicTree {
  readonly nodes: ReadonlyMap<string, TopicNode>;
  /** Die obersten — ohne Oberthema (oder mit einem, das hier fehlt). */
  readonly roots: readonly TopicNode[];
  /** Die Aspekte, in ihrer Reihenfolge — wo keiner steht, keiner. */
  readonly aspects: readonly TopicNode[];
  children(id: string | null): readonly TopicNode[];
  /** Die darüber, das nächste zuerst — höchstens zwanzig Stufen (ein Kreis in den Daten hält hier nicht fest). */
  ancestors(id: string): readonly TopicNode[];
  /** Der Aspekt eines Themas: es selbst, wenn es einer ist, sonst der nächste darüber — `null`: keiner. */
  aspectOf(id: string): TopicNode | null;
  /** Alles unter einem Thema (oder ganz oben), in der Reihenfolge des Baums, mit der Tiefe — für Listen mit Einzug. */
  flat(under: string | null): readonly { readonly node: TopicNode; readonly depth: number }[];
}

/** Geschwister: nach `order`, dann nach dem Namen. */
export const byOrder = (a: TopicNode, b: TopicNode): number =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'pl');

/** Ein Thema aus dem Speicher. */
export function topicNode(entry: LibEntry): TopicNode {
  return {
    id: entry.id,
    name: str(entry.data, 'name').trim() || 'Temat',
    parent: ids(entry.data, 'parent')[0] ?? null,
    aspect: isAspect(entry.data),
    order: num(entry.data, 'order')
  };
}

export function topicTree(list: Iterable<TopicNode>): TopicTree {
  const nodes = new Map<string, TopicNode>();
  for (const node of list) nodes.set(node.id, node);
  const under = new Map<string | null, TopicNode[]>();
  for (const node of nodes.values()) {
    const parent = node.parent !== null && nodes.has(node.parent) && node.parent !== node.id ? node.parent : null;
    const list2 = under.get(parent) ?? [];
    list2.push(node);
    under.set(parent, list2);
  }
  for (const list2 of under.values()) list2.sort(byOrder);

  const ancestors = (id: string): TopicNode[] => {
    const out: TopicNode[] = [];
    let at = nodes.get(id);
    for (let step = 0; step < 20 && at !== undefined && at.parent !== null; step += 1) {
      const parent = nodes.get(at.parent);
      if (parent === undefined || parent.id === id || out.includes(parent)) break;
      out.push(parent);
      at = parent;
    }
    return out;
  };

  const aspectOf = (id: string): TopicNode | null => {
    const self = nodes.get(id);
    if (self === undefined) return null;
    if (self.aspect) return self;
    return ancestors(id).find((one) => one.aspect) ?? null;
  };

  const flat = (from: string | null): { node: TopicNode; depth: number }[] => {
    const out: { node: TopicNode; depth: number }[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
      for (const node of under.get(parent) ?? []) {
        if (seen.has(node.id) || depth > 20) continue;
        seen.add(node.id);
        out.push({ node, depth });
        walk(node.id, depth + 1);
      }
    };
    walk(from, 0);
    return out;
  };

  const roots = under.get(null) ?? [];
  /* Die Aspekte: oben die markierten Wurzeln, dann markierte tiefer im Baum — in der Reihenfolge des Baums. */
  const aspects = flat(null).map((one) => one.node).filter((node) => node.aspect);

  return {
    nodes,
    roots,
    aspects,
    children: (id) => under.get(id) ?? [],
    ancestors,
    aspectOf,
    flat
  };
}

/**
 * DIE ACHSEN EINER SEITE: die Aspekte — und wo die Bibliothek keine hat, eine
 * einzige, „Tematy", über alle obersten Themen. So hat jede Bibliothek einen
 * Baum und Filter, auch eine, die ihre Themen nie geordnet hat.
 */
export interface Facet {
  /** Kennung des Aspekts — oder `''` für „alle Themen". */
  readonly id: string;
  readonly name: string;
  /** Die Werte: unter dem Aspekt — bei `''` alle Themen, die zu keinem Aspekt gehören. */
  readonly values: readonly { readonly node: TopicNode; readonly depth: number }[];
}

export function facetsOf(tree: TopicTree): Facet[] {
  if (tree.aspects.length > 0) {
    const out: Facet[] = tree.aspects.map((aspect) => ({ id: aspect.id, name: aspect.name, values: tree.flat(aspect.id) }));
    const loose = tree.flat(null).filter((one) => tree.aspectOf(one.node.id) === null);
    if (loose.length > 0) out.push({ id: '', name: 'Inne tematy', values: loose });
    return out;
  }
  const all = tree.flat(null);
  return all.length === 0 ? [] : [{ id: '', name: 'Tematy', values: all }];
}

/** Zu welcher Achse ein Thema gehört — die Kennung des Aspekts oder `''`. */
export const facetOf = (tree: TopicTree, topicId: string): string => tree.aspectOf(topicId)?.id ?? '';
