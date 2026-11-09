/**
 * 2026-11-03 — DER VERSCHACHTELTE KRAJOBRAZ: was zusammengehört, steht in den Daten, nie gerechnet.
 *
 * <code>
 *   Knoten    ein Eintrag (Rodzaj frei, z. B. „Pole mapy") mit Namen, Reihenfolge (Zahlenfeld, Vorgabe "nr") und einem
 *             Strukturfeld „up" zu seinem Elternknoten — beliebig tief, je Zweig verschieden tief
 *   Inhalt    ein Eintrag des Widoku nennt seinen Knoten im Verweisfeld des Widoku (\`"landscape": {"nest": "pole"}\`);
 *             ohne Knoten steht er auf der obersten Ebene
 *   Ebene     das Ganze zeigt nur die oberste Ebene; jeder Zoom genau eine Ebene: die Unterknoten und die Einträge eines
 *             Knotens, gemischt; die Brotkrumen führen zurück
 *   Gruppe    ein Knoten ist ein echtes Feld: Ring = gewusste / alle Karten seines ganzen Teilbaums; Höhe = der Abstand
 *             zum Nächsten darin, das jetzt lernbar ist (0: etwas darin ist bereit); Tal, sobald alles darin gelernt
 *             ist; Sperre, wenn alles darin, was jetzt dran wäre, erst eine Powtórka braucht; Farbe nach dem Anteil
 *   Lage      fest, nur aus der Struktur: Felder einer Ebene dicht in Ringen um den Lernenden, was früher zu lernen ist
 *             (Reihenfolge des Lernens in der Ebene), näher; dann die Reihenfolge des Autors — nie nach dem Fortschritt
 * </code>
 *
 * Rein (ohne React, ohne Baza). 2026-11-09 (Weltkarte, Entscheidung 2) — hier steht nur noch das Lesen der Knoten
 * (`readNest`); gezeichnet wird ein verschachtelter Krajobraz über `levelMap.ts` (`nestAsRegions`) und `worldLayout.ts`.
 * Die alte eigene Lage (`nestLayout`, `nestSlots`) ist entfernt: niemand fragte sie mehr.
 */

export interface NestNode {
  readonly id: string;
  readonly label: string;
  /** Der Elternknoten (null: oben). */
  readonly parent: string | null;
  /** Die Reihenfolge des Autors (kleiner zuerst; ohne Zahl: hinten, nach Namen). */
  readonly order: number;
}

export interface NestTree {
  readonly nodes: ReadonlyMap<string, NestNode>;
  /** Inhalt → sein Knoten. */
  readonly home: ReadonlyMap<string, string>;
  /** Je Elternknoten (null: oben) seine Unterknoten in Reihenfolge. */
  readonly children: ReadonlyMap<string | null, readonly string[]>;
}

/** Was eine Baza dafür hergibt (ein kleiner Ausschnitt von \`CogitaLibrary\`). */
export interface NestSource {
  entity(id: string): { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> } | undefined;
  kind(id: string): { readonly fields: readonly { readonly key: string; readonly type?: string; readonly structure?: string }[] } | undefined;
  label(e: { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }): string;
}

const firstRef = (v: unknown): string | null => {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && x.trim() !== '') return x.trim();
  return null;
};

/** Der Baum der Knoten über diesen Einträgen: ihr Feld \`field\` nennt den Knoten, das Strukturfeld „up" eines Knotens seinen Elternknoten. */
export function readNest(src: NestSource, content: readonly string[], field: string, sortField = 'nr'): NestTree {
  const home = new Map<string, string>();
  const nodes = new Map<string, NestNode>();
  const parentOf = (id: string): string | null => {
    const e = src.entity(id);
    if (e === undefined) return null;
    /* Zuerst das Feld des Widoku (ein Knoten kann selbst in einem Knoten liegen), dann sein Strukturfeld „up". */
    const own = firstRef(e.data[field]);
    if (own !== null && own !== id && src.entity(own) !== undefined) return own;
    for (const k of e.kinds) {
      for (const f of src.kind(k)?.fields ?? []) {
        if (f.structure !== 'up') continue;
        const p = firstRef(e.data[f.key]);
        if (p !== null && p !== id && src.entity(p) !== undefined) return p;
      }
    }
    return null;
  };
  const addNode = (start: string) => {
    let at: string | null = start;
    const chain = new Set<string>();
    while (at !== null && !nodes.has(at) && !chain.has(at) && chain.size < 64) {
      chain.add(at);
      const e = src.entity(at)!;
      const n = Number(e.data[sortField]);
      let parent = parentOf(at);
      if (parent !== null && chain.has(parent)) parent = null;
      nodes.set(at, { id: at, label: src.label(e), parent, order: Number.isFinite(n) ? n : Number.POSITIVE_INFINITY });
      at = parent;
    }
  };
  for (const id of content) {
    const e = src.entity(id);
    if (e === undefined) continue;
    const node = firstRef(e.data[field]);
    if (node === null || node === id || src.entity(node) === undefined) continue;
    home.set(id, node);
    addNode(node);
  }
  /* Ein Kreis in der Struktur (A über B über A) — der Knoten, der ihn schlösse, steht oben. */
  for (const n of nodes.values()) {
    const seen = new Set<string>([n.id]);
    for (let p = n.parent; p !== null; p = nodes.get(p)?.parent ?? null) {
      if (seen.has(p)) { nodes.set(n.id, { ...n, parent: null }); break; }
      seen.add(p);
    }
  }
  const children = new Map<string | null, string[]>();
  for (const n of nodes.values()) { const list = children.get(n.parent) ?? []; list.push(n.id); children.set(n.parent, list); }
  const byOrder = (a: string, b: string) => { const x = nodes.get(a)!; const y = nodes.get(b)!; return x.order - y.order || x.label.localeCompare(y.label, 'pl', { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0); };
  for (const list of children.values()) list.sort(byOrder);
  return { nodes, home, children };
}

/** Die Inhalte im ganzen Teilbaum eines Knotens (ihr Heimknoten ist er oder liegt unter ihm). */
export function nestSubtree(tree: NestTree, node: string, content: readonly string[]): string[] {
  return content.filter((id) => {
    let n = 0;
    for (let at = tree.home.get(id) ?? null; at !== null && n < 64; at = tree.nodes.get(at)?.parent ?? null, n += 1) if (at === node) return true;
    return false;
  });
}
