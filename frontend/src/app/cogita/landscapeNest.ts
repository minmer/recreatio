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
 * Rein (ohne React, ohne Baza): die Höhen, Bänder und Sperren je Eintrag kommen aus dem Motor (\`LsLayout\` des Ganzen).
 */

import { BAND_CODE, hexCenter, hexDistance, liftOf, type LsBand, type LsField, type LsInput, type LsLand, type LsLayout, type LsSector, type LsState } from './landscape';

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

/** Die Kette über einem Knoten bis oben (oben zuerst). */
export function nestPath(tree: NestTree, node: string | null): string[] {
  const out: string[] = [];
  for (let at = node; at !== null && out.length < 64; at = tree.nodes.get(at)?.parent ?? null) out.unshift(at);
  return out;
}

/** Die Inhalte im ganzen Teilbaum eines Knotens (ihr Heimknoten ist er oder liegt unter ihm). */
export function nestSubtree(tree: NestTree, node: string, content: readonly string[]): string[] {
  return content.filter((id) => {
    let n = 0;
    for (let at = tree.home.get(id) ?? null; at !== null && n < 64; at = tree.nodes.get(at)?.parent ?? null, n += 1) if (at === node) return true;
    return false;
  });
}

/** Die Zellen eines Ringes um den Lernenden, in der oberen Hälfte, von links nach rechts (Winkel 0 links, 180 rechts). */
function ringSlots(r: number): { q: number; r: number; x: number; y: number }[] {
  const out: { q: number; r: number; x: number; y: number; a: number }[] = [];
  for (let q = -r; q <= r; q += 1) {
    for (let rr = -r; rr <= r; rr += 1) {
      if (hexDistance(0, 0, q, rr) !== r) continue;
      const c = hexCenter(q, rr);
      if (c.y < -1e-9) continue;
      out.push({ q, r: rr, x: c.x, y: c.y, a: (Math.atan2(c.y, -c.x) * 180) / Math.PI });
    }
  }
  return out.sort((a, b) => a.a - b.a).map(({ q, r: rr, x, y }) => ({ q, r: rr, x, y }));
}

/** Die festen Plätze für \`count\` Felder: Ring um Ring, dicht, ein Rest in der Mitte seines Ringes. */
export function nestSlots(count: number): { q: number; r: number; x: number; y: number; ring: number }[] {
  const out: { q: number; r: number; x: number; y: number; ring: number }[] = [];
  for (let ring = 1; out.length < count && ring < 400; ring += 1) {
    const slots = ringSlots(ring);
    const left = count - out.length;
    const start = left >= slots.length ? 0 : Math.floor((slots.length - left) / 2);
    for (const s of slots.slice(start, start + Math.min(left, slots.length))) out.push({ ...s, ring });
  }
  return out;
}

interface Item {
  readonly kind: 'node' | 'entry';
  readonly id: string;
  /** Die Einträge (Indizes wie \`LsInput.ids\`) im ganzen Teilbaum — bei einem Eintrag er selbst. */
  readonly entries: readonly number[];
}

/**
 * EINE EBENE DES VERSCHACHTELTEN KRAJOBRAZ als \`LsLayout\` (dieselbe Zeichnung wie das Ganze): \`base\` ist die Gestalt des
 * Motors über alle Einträge (Höhen, Bänder, Sperren, Felder je Eintrag), \`focus\` der Knoten dieser Ebene (null: oben).
 * \`order\` ordnet Einträge (die Reihenfolge des Autors).
 */
export function nestLayout(input: LsInput, base: LsLayout, state: LsState, tree: NestTree, focusIn: string | null, order: (a: string, b: string) => number): LsLayout {
  const focus = focusIn !== null && tree.nodes.has(focusIn) ? focusIn : null;
  const band = (v: number): LsBand | null => BAND_CODE[base.bands[v]] ?? null;
  /* Inhalt: was im Widok steht, Karten hat (ein Band) und kein Knoten ist. */
  const direct = new Map<string | null, number[]>();
  for (let v = 0; v < input.ids.length; v += 1) {
    const id = input.ids[v];
    if (!input.inView[v] || band(v) === null || tree.nodes.has(id)) continue;
    const at = tree.home.get(id) ?? null;
    const list = direct.get(at) ?? [];
    list.push(v);
    direct.set(at, list);
  }
  for (const list of direct.values()) list.sort((a, b) => order(input.ids[a], input.ids[b]));
  const under = new Map<string, number[]>();
  const subtree = (node: string, depth = 0): number[] => {
    const had = under.get(node);
    if (had !== undefined) return had;
    const out = [...(direct.get(node) ?? [])];
    if (depth < 64) for (const c of tree.children.get(node) ?? []) out.push(...subtree(c, depth + 1));
    under.set(node, out);
    return out;
  };
  const items: Item[] = [
    ...(tree.children.get(focus) ?? []).map((id) => ({ kind: 'node' as const, id, entries: subtree(id) })).filter((x) => x.entries.length > 0),
    ...(direct.get(focus) ?? []).map((v) => ({ kind: 'entry' as const, id: input.ids[v], entries: [v] }))
  ];
  /*
    Die Reihenfolge des Lernens IN dieser Ebene: nach dem frühesten Eintrag darin (seine Tiefe in der Kette der
    Voraussetzungen) — ein Feld, dessen Anfang andere Felder braucht, kommt nach ihnen; Kreise zwischen Feldern stören nicht.
  */
  const chainDepth = new Map<number, number>();
  const busy = new Set<number>();
  const depthOfEntry = (v: number): number => {
    const had = chainDepth.get(v);
    if (had !== undefined) return had;
    if (busy.has(v) || busy.size > 4096) return 0;
    busy.add(v);
    let d = 0;
    for (const p of input.needs[v] ?? []) d = Math.max(d, depthOfEntry(p) + 1);
    busy.delete(v);
    chainDepth.set(v, d);
    return d;
  };
  const depth = items.map((it) => Math.min(...it.entries.map(depthOfEntry)));
  const rank = items.map((_, k) => k);
  rank.sort((a, b) => depth[a] - depth[b] || (items[a].kind === items[b].kind ? 0 : items[a].kind === 'node' ? -1 : 1) || a - b);
  const slots = nestSlots(items.length);
  /* Die Farbe: der oberste Knoten darüber (in seiner Reihenfolge, acht Farben), ohne Knoten grau. */
  const tops = tree.children.get(null) ?? [];
  const topOf = (id: string): string | null => { const path = nestPath(tree, tree.nodes.has(id) ? id : tree.home.get(id) ?? null); return path[0] ?? null; };
  const subjectOf = (id: string): number => { const t = topOf(id); const i = t === null ? -1 : tops.indexOf(t); return i >= 0 && i < 8 ? i : -1; };
  const baseField = new Map(base.fields.map((f) => [f.key, f] as const));
  const goalId = base.goal?.id ?? null;
  const fields: LsField[] = [];
  const land: LsLand[] = [];
  const cellOf = new Int32Array(input.ids.length).fill(-1);
  rank.forEach((k, place) => {
    const it = items[k];
    const s = slots[place];
    const angle = (Math.atan2(s.y, -s.x) * 180) / Math.PI;
    const bands = it.entries.map(band);
    const count = (b: LsBand) => bands.filter((x) => x === b).length;
    const known = count('known');
    const due = count('due');
    const ring = count('ring');
    const mountain = count('mountain');
    let cardsKnown = 0;
    let cardsTotal = 0;
    for (const v of it.entries) { cardsKnown += Number(state.cardsKnown?.[v] ?? 0); cardsTotal += Number(state.cardsTotal?.[v] ?? 0); }
    const subject = subjectOf(it.id);
    const cell = land.length;
    for (const v of it.entries) cellOf[v] = cell;
    if (it.kind === 'entry') {
      const v = it.entries[0];
      const b = band(v)!;
      const was = baseField.get(it.id);
      const missing = b === 'mountain' ? Math.max(1, Math.round(base.heights[v])) : 0;
      const lift = liftOf(b, missing);
      fields.push({
        key: it.id, kind: 'entry', id: it.id, label: input.labels[v] ?? it.id, count: 1, height: base.heights[v], missing, band: b, locked: base.locked[v] === 1,
        subject, area: subject, q: s.q, r: s.r, x: s.x, y: s.y, angle, row: s.ring, lift, route: was?.route ?? 0, next: was?.next ?? false, goal: it.id === goalId,
        due: b === 'due' ? 1 : 0, ring: b === 'ring' ? 1 : 0, known: b === 'known' ? 1 : 0, mountain: b === 'mountain' ? 1 : 0, edge: false, cells: [cell],
        ...(was?.progress === undefined ? {} : { progress: was.progress }), ...(was?.unlocks === undefined ? {} : { unlocks: was.unlocks })
      });
      land.push({ q: s.q, r: s.r, x: s.x, y: s.y, lift, band: b, tone: b, steps: missing, node: v, field: it.id, region: -1, subject, inScope: true, due: b === 'due' });
      return;
    }
    /* EIN KNOTEN IST EIN ECHTES FELD: Tal, sobald alles darin gelernt ist; sonst eben, wenn etwas darin bereit ist; sonst ein Berg so hoch wie das Nächste darin. */
    const b: LsBand = known + due === it.entries.length ? (due > 0 ? 'due' : 'known') : ring > 0 ? 'ring' : 'mountain';
    const low = Math.min(...it.entries.filter((v) => band(v) === 'mountain').map((v) => Math.max(1, Math.round(base.heights[v]))));
    const missing = b === 'mountain' && Number.isFinite(low) ? low : 0;
    const rings = it.entries.filter((v) => band(v) === 'ring');
    const locked = b === 'ring' && rings.length > 0 && rings.every((v) => base.locked[v] === 1);
    const lift = liftOf(b, missing);
    const share = cardsTotal === 0 ? 0 : cardsKnown / cardsTotal;
    const inside = [...(tree.children.get(it.id) ?? []).filter((c) => subtree(c).length > 0), ...(direct.get(it.id) ?? []).map((v) => input.ids[v])];
    fields.push({
      key: `nest:${it.id}`, kind: 'area', value: it.id, label: tree.nodes.get(it.id)?.label ?? it.id, count: it.entries.length,
      height: b === 'mountain' ? missing : b === 'ring' ? 0 : -1, missing, band: b, locked, subject, area: subject, q: s.q, r: s.r, x: s.x, y: s.y, angle, row: s.ring, lift,
      route: it.entries.filter((v) => (baseField.get(input.ids[v])?.route ?? 0) > 0).length, next: it.entries.some((v) => baseField.get(input.ids[v])?.next === true),
      goal: goalId !== null && it.entries.some((v) => input.ids[v] === goalId), due, ring, known, mountain, edge: false, ids: inside, cells: [cell],
      ...(cardsTotal > 0 ? { progress: { known: cardsKnown, total: cardsTotal } } : {})
    });
    land.push({ q: s.q, r: s.r, x: s.x, y: s.y, lift, band: b, tone: b, steps: missing, node: -1, field: `nest:${it.id}`, region: -1, subject, inScope: true, due: due > 0, group: true, share });
  });
  const scope = focus === null ? [...(direct.get(null) ?? []), ...(tree.children.get(null) ?? []).flatMap((c) => subtree(c))] : subtree(focus);
  const counts: Record<LsBand, number> = { known: 0, due: 0, ring: 0, mountain: 0 };
  for (const v of scope) { const b = band(v); if (b !== null) counts[b] += 1; }
  const sectors: LsSector[] = items.filter((it) => it.kind === 'node').map((it) => ({
    value: it.id, label: tree.nodes.get(it.id)?.label ?? it.id, from: 0, to: 0, subject: subjectOf(it.id), count: it.entries.length, deeper: (tree.children.get(it.id) ?? []).length > 0
  }));
  const xs = land.map((c) => c.x);
  const ys = land.map((c) => c.y);
  const camera = land.length === 0 ? { x0: -3, x1: 3, y0: -0.6, y1: 3 } : { x0: Math.min(...xs, 0) - 1, x1: Math.max(...xs, 0) + 1, y0: -0.6, y1: Math.max(...ys, 1) + 1 };
  return {
    fields, land, sectors, areas: [], path: nestPath(tree, focus).map((id) => ({ value: id, label: tree.nodes.get(id)?.label ?? id })), outside: [], camera,
    goal: base.goal, counts, total: scope.length, me: base.me, notes: [], heights: base.heights, bands: base.bands, locked: base.locked, links: base.links, cellOf
  };
}
