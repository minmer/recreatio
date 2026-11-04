/**
 * 2026-11-04 — GEBIETE IN GEBIETEN (Prompt 11, 9): die Hierarchie der Gebiete eines Krajobraz, nur aus den
 * Voraussetzungen gerechnet — für alle Lernenden gleich, nie aus Kapiteln oder Fächern (die bleiben Farbe und Filter).
 * Rein (ohne React, ohne Baza, ohne Stand), läuft einmal im Worker; geprüft in `scripts/app-regions-check.mjs`.
 *
 * <code>
 *   Atome    die Themen (Pytania sind keine Knoten); ein Kreis — eine starke Zusammenhangskomponente — ist EIN Atom
 *            und wird nie geteilt
 *   Ebene    von unten, gierig: das verbundene Paar mit den meisten verbindenden Kanten je Thema (w / (|A| + |B|))
 *            zuerst, zunächst nur bis 10 (von 12: Platz für Reste); nur wenn der Graph der Gruppen kreisfrei bleibt —
 *            kein Weg verlässt eine Gruppe und kommt zurück (geprüft im Fenster einer nachgeführten Reihenfolge des
 *            Lernens, nach Pearce–Kelly)
 *   Reste    was unter 5 bleibt, geht zu einem verbundenen Nachbarn, sonst zu einer Gruppe desselben Namens oder zum
 *            Nachbarn in der Reihenfolge des Autors, zuletzt zum Nachbarn in der Reihenfolge des Lernens (der nächste
 *            ist immer kreisfrei); danach dürfen stark verbundene Gruppen (≥ 2 Kanten) bis 12 zusammen, die Grenzen
 *            werden nachgezogen (ein Knoten wechselt, wenn mehr Kanten innen liegen), Reste holen sich Knoten, und ein
 *            Gebiet mit nur einem Kind geht zuletzt in seinen Nachbarn (lieber eins über 12 als eine leere Karte)
 *   Oben     Ebene um Ebene, bis oben 7–20 Knoten stehen; die letzte Ebene wählt ihre Größe danach (≤ 20 Themen:
 *            keine Gebiete)
 *   Namen    von oben nach unten: der des Eigentümers, sonst einer der Baza, den die Hälfte der Themen trägt (je Ebene
 *            nur einmal, das Gebiet mit dem größten Anteil gewinnt), sonst „Rund um <Mitte>" — die Mitte ist das Thema,
 *            von dem darin am meisten abhängt; nie ein Name, den ein Gebiet darüber oder daneben schon trägt (dann die
 *            nächste Mitte)
 *   Bestand  mit der vorigen Rechnung (`previous`) wird zuerst wieder vereinigt, was zuletzt beisammen lag, und nie
 *            zwei alte Gebiete (nur Reste dürfen das); die Schlüssel kommen je Ebene nach Überdeckung der Themen
 *            (Jaccard ≥ 0,5) — so bleiben Namen, Lage und die Verschiebungen des Eigentümers; dieselbe Baza mit ihrer
 *            eigenen Rechnung ergibt genau dieselben Gebiete
 * </code>
 *
 * Alles im Ergebnis lässt sich klonen (Map, Felder, schlichte Objekte) — es reist aus einem Web Worker.
 */

/* -- Eingänge ---------------------------------------------------------------------------------------------------- */

export interface RegionGraphInput {
  /** The topics (never questions — the caller removes them). */
  readonly ids: readonly string[];
  readonly labels: readonly string[];
  /** Direct prerequisites per topic (indices into ids); cycles may occur (a strongly connected component is one atom that is never split). */
  readonly needs: readonly (readonly number[])[];
  /** The author's order per topic (smaller first) — the tie-breaker everywhere; default: the index. */
  readonly rank?: readonly number[];
  /** Human group names per topic (e.g. the value of the view's grouping such as "§4 Relationen und Restklassen", or a section entry's label) — candidates for naming regions. */
  readonly names?: readonly (readonly string[])[];
}

export interface RegionOverrides {
  /** Region key → name given by the owner. */
  readonly names?: Readonly<Record<string, string>>;
  /** Topic id → the leaf region key the owner moved it to. */
  readonly moves?: Readonly<Record<string, string>>;
}

export interface RegionOptions {
  readonly min?: number;     // 5
  readonly max?: number;     // 12
  readonly topMin?: number;  // 7
  readonly topMax?: number;  // 20
  /** How a region is named after its central topic, e.g. (label) => `Rund um ${label}` (de), `Wokół: ${label}` (pl), `Around ${label}` (en). Default German. */
  readonly around?: (label: string) => string;
  readonly overrides?: RegionOverrides;
  /** The previous result's assignment, to keep keys (and so names/positions) stable: topic id → its region keys from the top down. */
  readonly previous?: Readonly<Record<string, readonly string[]>>;
}

export interface RegionNode {
  /** Stable: "r:" + the central topic's id (plus "~2", "~3" … on collision), or the key matched from `previous`. */
  readonly key: string;
  /** 1 = its children are topics; 2 = its children are level-1 regions; … */
  readonly level: number;
  /** The region above; null on the top level. */
  readonly parent: string | null;
  /** Region keys (level ≥ 2) or topic ids (level 1), in the order of learning, ties in the author's order. */
  readonly children: readonly string[];
  /** Every topic index in the whole subtree (ascending). */
  readonly topics: readonly number[];
  readonly name: string;
  readonly named: 'base' | 'central' | 'owner';
  /**
   * The topic used for the name: most others inside depend on it. When its name is already carried by an ancestor or a
   * sibling, the next most central topic whose name is free (named 'central'); for 'base'/'owner' the most central topic.
   */
  readonly central: number;
}

export interface RegionTree {
  /** How many region levels: 0 = no regions (a small base: the top shows topics directly). */
  readonly levels: number;
  readonly regions: ReadonlyMap<string, RegionNode>;
  /** The top level: region keys (levels ≥ 1) or topic ids (levels = 0), in the order of learning, ties in the author's order. */
  readonly top: readonly string[];
  /** Per topic (index) its level-1 region key (null when levels = 0). */
  readonly leafOf: readonly (string | null)[];
  /** Per topic id: its region keys from the top down (what `previous` takes next time). */
  readonly assignment: Readonly<Record<string, readonly string[]>>;
  readonly stats: {
    /** Per level (1 = topic groups …): the group sizes (children counts). */
    readonly sizes: readonly (readonly number[])[];
    /** Per level: the share of topic prerequisite edges whose two ends lie in the same group of that level (1 without edges). */
    readonly inside: readonly number[];
    readonly ms: number;
    /** Owner moves applied, and moves ignored (with why, e.g. "would create a cycle"). */
    readonly moved: number;
    readonly ignored: readonly string[];
    /** Per level the bounds [min, max] its grouping used (the last level may use smaller ones so the top lands in topMin–topMax). */
    readonly bounds: readonly (readonly [number, number])[];
    /** Distinct prerequisite edges between two different topics (what `inside` counts). */
    readonly edges: number;
    /** Cycles kept together: strongly connected components with more than one topic. */
    readonly cycles: number;
  };
}

/* -- Konstanten ---------------------------------------------------------------------------------------------------- */

/** So viele Knoten darf eine Prüfung auf Kreise besuchen; darüber wird die Vereinigung vorsichtshalber abgelehnt (deterministisch). */
const BUDGET = 4096;
/** Ab dieser Überdeckung (Jaccard) ist ein neues Gebiet das alte. */
const MATCH = 0.5;
/** Ab diesem Anteil der Themen trägt ein Gebiet einen Namen der Baza. */
const SHARE = 0.5;
/** So weit sucht ein Rest in der Reihenfolge des Lernens nach Platz (je Seite). */
const WIDEN = 48;
/** So viele Nachbarn in der Reihenfolge des Autors fragt ein Rest je Mitglied (je Seite). */
const AUTHOR_REACH = 2;
/** Höchstens so viele Durchgänge beim Nachziehen der Grenzen. */
const REFINE = 4;
/** Zwei schon gültige Gruppen vereinigen sich danach nur noch, wenn sie so viele Kanten verbinden („hängen viel aneinander"). */
const STRONG = 2;

const now = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const popcount = (x: number): number => {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
};

/* -- Hilfen ---------------------------------------------------------------------------------------------------- */

/** Ein binärer Haufen: oben liegt, was nach `before` zuerst kommt. */
class Heap<T> {
  private readonly items: T[] = [];
  private readonly before: (x: T, y: T) => boolean;
  constructor(before: (x: T, y: T) => boolean) { this.before = before; }
  get size(): number { return this.items.length; }
  push(x: T): void {
    const a = this.items;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(a[i], a[p])) break;
      const t = a[i]; a[i] = a[p]; a[p] = t;
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop() as T;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.before(a[l], a[m])) m = l;
        if (r < a.length && this.before(a[r], a[m])) m = r;
        if (m === i) break;
        const t = a[i]; a[i] = a[m]; a[m] = t;
        i = m;
      }
    }
    return top;
  }
}

/**
 * Die Reihenfolge des Lernens über `nodes`: was nichts mehr davor braucht, zuerst; unter Gleichen die Reihenfolge des
 * Autors (dann der Index). Ein Kreis wird am kleinsten Rang aufgebrochen (Themen eines Atoms).
 */
function learningOrder(nodes: readonly number[], succ: (x: number) => Iterable<number>, rank: ArrayLike<number>): number[] {
  const open = new Map<number, number>();
  for (const x of nodes) open.set(x, 0);
  for (const x of nodes) for (const y of succ(x)) { const d = open.get(y); if (d !== undefined && y !== x) open.set(y, d + 1); }
  const first = (p: number, q: number): boolean => rank[p] < rank[q] || (rank[p] === rank[q] && p < q);
  const ready = new Heap<number>(first);
  for (const x of nodes) if (open.get(x) === 0) ready.push(x);
  const done = new Set<number>();
  const order: number[] = [];
  let rest: number[] | null = null;
  let restAt = 0;
  while (order.length < nodes.length) {
    let x = ready.pop();
    if (x === undefined) {
      /* Nur noch Kreise: der kleinste offene Rang geht vor. */
      if (rest === null) rest = [...nodes].sort((p, q) => (first(p, q) ? -1 : first(q, p) ? 1 : 0));
      while (done.has(rest[restAt])) restAt += 1;
      x = rest[restAt];
    }
    if (done.has(x)) continue;
    done.add(x);
    order.push(x);
    for (const y of succ(x)) {
      const d = open.get(y);
      if (d === undefined || y === x || done.has(y)) continue;
      open.set(y, d - 1);
      if (d - 1 === 0) ready.push(y);
    }
  }
  return order;
}

/** Starke Zusammenhangskomponenten (Tarjan, ohne Rekursion): je Knoten seine Komponente. */
function strongComponents(n: number, succ: readonly (readonly number[])[]): { readonly comp: Int32Array; readonly count: number } {
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const comp = new Int32Array(n).fill(-1);
  const at = new Int32Array(n);
  const stack: number[] = [];
  const calls: number[] = [];
  let next = 0;
  let count = 0;
  for (let s = 0; s < n; s += 1) {
    if (index[s] !== -1) continue;
    index[s] = next; low[s] = next; next += 1;
    stack.push(s); onStack[s] = 1; calls.push(s);
    while (calls.length > 0) {
      const v = calls[calls.length - 1];
      const out = succ[v];
      if (at[v] < out.length) {
        const w = out[at[v]];
        at[v] += 1;
        if (index[w] === -1) {
          index[w] = next; low[w] = next; next += 1;
          stack.push(w); onStack[w] = 1; calls.push(w);
        } else if (onStack[w] === 1 && index[w] < low[v]) low[v] = index[w];
      } else {
        calls.pop();
        if (calls.length > 0) { const u = calls[calls.length - 1]; if (low[v] < low[u]) low[u] = low[v]; }
        if (low[v] === index[v]) {
          let w: number;
          do { w = stack.pop() as number; onStack[w] = 0; comp[w] = count; } while (w !== v);
          count += 1;
        }
      }
    }
  }
  return { comp, count };
}

/* -- Eine Ebene ------------------------------------------------------------------------------------------------- */

/** Die Knoten einer Ebene: Atome (Ebene 1) oder die Gebiete darunter. */
interface Level {
  readonly n: number;
  /** Kinder je Knoten, wie sie oben zählen: die Themen eines Atoms; ein Gebiet zählt 1. */
  readonly size: Float64Array;
  /** Die kleinste Reihenfolge des Autors im Knoten. */
  readonly rank: Float64Array;
  /** Gerichtete Kanten mit Gewicht (so viele Themenkanten): Voraussetzung → was darauf baut. */
  readonly out: readonly Map<number, number>[];
  readonly inn: readonly Map<number, number>[];
  /** Die Namen der Baza im Knoten: Name → so viele Themen tragen ihn. */
  readonly names: readonly Map<number, number>[];
  /** Die Gebiete dieser Ebene aus der vorigen Rechnung: alter Schlüssel (Nummer) → so viele Themen lagen darin. */
  readonly prev: readonly Map<number, number>[];
}

interface Pair {
  readonly a: number;
  readonly b: number;
  /** 1: beide lagen zuletzt im selben Gebiet — vor allem anderen. */
  readonly tier: number;
  readonly score: number;
  readonly va: number;
  readonly vb: number;
  readonly r1: number;
  readonly r2: number;
}

interface Small {
  readonly g: number;
  readonly size: number;
  readonly rank: number;
}

const pairFirst = (x: Pair, y: Pair): boolean => {
  if (x.tier !== y.tier) return x.tier > y.tier;
  if (x.score !== y.score) return x.score > y.score;
  if (x.r1 !== y.r1) return x.r1 < y.r1;
  if (x.r2 !== y.r2) return x.r2 < y.r2;
  if (x.a !== y.a) return x.a < y.a;
  return x.b < y.b;
};

const smallFirst = (x: Small, y: Small): boolean => {
  if (x.size !== y.size) return x.size < y.size;
  if (x.rank !== y.rank) return x.rank < y.rank;
  return x.g < y.g;
};

/** Der häufigste Wert (bei Gleichstand der kleinere) — −1 ohne Werte. */
function dominant(counts: Map<number, number>): number {
  let best = -1;
  let count = 0;
  for (const [v, c] of counts) if (c > 0 && (c > count || (c === count && v < best))) { best = v; count = c; }
  return best;
}

const addCounts = (into: Map<number, number>, from: Map<number, number>, sign = 1): void => {
  for (const [v, c] of from) into.set(v, (into.get(v) ?? 0) + sign * c);
};

/** Gruppen je häufigstem Wert (Name der Baza, altes Gebiet) — nachgeführt, wenn Gruppen verschmelzen. */
class ByValue {
  readonly of: Int32Array;
  private readonly sets = new Map<number, Set<number>>();
  private readonly counts: Map<number, number>[];
  constructor(counts: Map<number, number>[], alive: Uint8Array) {
    this.counts = counts;
    this.of = new Int32Array(counts.length).fill(-1);
    for (let g = 0; g < counts.length; g += 1) if (alive[g] === 1) this.put(g);
  }
  put(g: number): void {
    const d = dominant(this.counts[g]);
    this.of[g] = d;
    if (d < 0) return;
    let s = this.sets.get(d);
    if (s === undefined) { s = new Set(); this.sets.set(d, s); }
    s.add(g);
  }
  drop(g: number): void {
    const d = this.of[g];
    if (d >= 0) this.sets.get(d)?.delete(g);
    this.of[g] = -1;
  }
  with(v: number): Iterable<number> { return this.sets.get(v) ?? []; }
}

/**
 * Gruppiert die Knoten einer Ebene zu Gruppen von `lo`–`hi` (in `size`). Ergebnis: je Knoten seine Gruppe, die Gruppen
 * in einer Reihenfolge des Lernens nummeriert (der Graph der Gruppen ist kreisfrei).
 */
function groupLevel(L: Level, lo: number, hi: number): { readonly groupOf: Int32Array; readonly count: number } {
  const n = L.n;
  const out = L.out.map((m) => new Map(m));
  const inn = L.inn.map((m) => new Map(m));
  const names = L.names.map((m) => new Map(m));
  const prevs = L.prev.map((m) => new Map(m));
  const size = Float64Array.from(L.size);
  const rank = Float64Array.from(L.rank);
  const alive = new Uint8Array(n).fill(1);
  const ver = new Int32Array(n);
  const up = new Int32Array(n);
  for (let i = 0; i < n; i += 1) up[i] = i;
  const members: number[][] = [];
  for (let i = 0; i < n; i += 1) members.push([i]);
  const all: number[] = [];
  for (let i = 0; i < n; i += 1) all.push(i);

  /* Eine Reihenfolge des Lernens über den lebenden Gruppen, bei jeder Vereinigung nachgeführt: jeder Weg von A nach B
     läuft durch Knoten, die zwischen ihnen stehen — die Prüfung bleibt in diesem Fenster. */
  const ord = new Float64Array(n);
  learningOrder(all, (x) => out[x].keys(), rank).forEach((x, i) => { ord[x] = i; });

  const mark = new Int32Array(n);
  let stamp = 0;
  const fwd: number[] = [];
  const bwd: number[] = [];

  const merge = (a: number, b: number, at: number): number => {
    const keepA = out[a].size + inn[a].size > out[b].size + inn[b].size || (out[a].size + inn[a].size === out[b].size + inn[b].size && a < b);
    const keep = keepA ? a : b;
    const gone = keepA ? b : a;
    const ko = out[keep];
    const ki = inn[keep];
    for (const [x, w] of out[gone]) {
      if (x === keep) continue;
      ko.set(x, (ko.get(x) ?? 0) + w);
      const ix = inn[x];
      ix.delete(gone);
      ix.set(keep, (ix.get(keep) ?? 0) + w);
    }
    for (const [x, w] of inn[gone]) {
      if (x === keep) continue;
      ki.set(x, (ki.get(x) ?? 0) + w);
      const ox = out[x];
      ox.delete(gone);
      ox.set(keep, (ox.get(keep) ?? 0) + w);
    }
    ko.delete(gone);
    ki.delete(gone);
    out[gone] = new Map();
    inn[gone] = new Map();
    addCounts(names[keep], names[gone]);
    names[gone] = new Map();
    addCounts(prevs[keep], prevs[gone]);
    prevs[gone] = new Map();
    size[keep] += size[gone];
    if (rank[gone] < rank[keep]) rank[keep] = rank[gone];
    const km = members[keep];
    for (const m of members[gone]) km.push(m);
    members[gone] = [];
    up[gone] = keep;
    alive[gone] = 0;
    ver[keep] += 1;
    ver[gone] += 1;
    ord[keep] = at;
    return keep;
  };

  /**
   * Verschmilzt a und b, wenn danach kein Weg eine Gruppe verlässt und zurückkommt: es darf keinen Weg von der früheren
   * zur späteren über eine dritte geben. Die Suche vorwärts (δF) und rückwärts (δB) liefert zugleich, was umzuordnen
   * ist: δB vor die neue Gruppe, δF dahinter, in den alten Plätzen (Pearce–Kelly). −1: abgelehnt.
   */
  const tryMerge = (a: number, b: number): number => {
    const u = ord[a] < ord[b] ? a : b;
    const v = u === a ? b : a;
    const lowO = ord[u];
    const highO = ord[v];
    stamp += 1;
    fwd.length = 0;
    for (const x of out[u].keys()) if (x !== v && ord[x] < highO && mark[x] !== stamp) { mark[x] = stamp; fwd.push(x); }
    for (let i = 0; i < fwd.length; i += 1) {
      if (fwd.length > BUDGET) return -1;
      for (const y of out[fwd[i]].keys()) {
        if (y === v) return -1;
        if (ord[y] < highO && mark[y] !== stamp) { mark[y] = stamp; fwd.push(y); }
      }
    }
    stamp += 1;
    bwd.length = 0;
    for (const x of inn[v].keys()) if (x !== u && ord[x] > lowO && mark[x] !== stamp) { mark[x] = stamp; bwd.push(x); }
    for (let i = 0; i < bwd.length; i += 1) {
      if (bwd.length > BUDGET) return -1;
      for (const y of inn[bwd[i]].keys()) if (ord[y] > lowO && mark[y] !== stamp) { mark[y] = stamp; bwd.push(y); }
    }
    let mid = lowO;
    if (fwd.length > 0 || bwd.length > 0) {
      const pool: number[] = [lowO, highO];
      for (const x of fwd) pool.push(ord[x]);
      for (const x of bwd) pool.push(ord[x]);
      pool.sort((p, q) => p - q);
      fwd.sort((p, q) => ord[p] - ord[q]);
      bwd.sort((p, q) => ord[p] - ord[q]);
      for (let i = 0; i < bwd.length; i += 1) ord[bwd[i]] = pool[i];
      mid = pool[bwd.length];
      for (let j = 0; j < fwd.length; j += 1) ord[fwd[j]] = pool[pool.length - fwd.length + j];
    }
    return merge(a, b, mid);
  };

  /* Die verbindenden Kanten je Thema der vereinigten Gruppe: kleine, eng verbundene Paare zuerst. */
  const affinity = (a: number, b: number, w: number): number => w / (size[a] + size[b]);

  /**
   * Gierig über verbundene Paare bis `cap` (`strong`: nur Paare mit so vielen Kanten). Mit der vorigen Rechnung zuerst,
   * was zuletzt im selben Gebiet lag (bis zur vollen Größe), und nie zwei verschiedene alte Gebiete: so kommt dieselbe
   * Karte wieder, wo die Struktur sie noch trägt.
   */
  const agglomerate = (cap: number, strong: number): void => {
    const pairs = new Heap<Pair>(pairFirst);
    const offer = (x: number, y: number, w: number): void => {
      if (w < strong) return;
      const px = dominant(prevs[x]);
      const py = dominant(prevs[y]);
      const same = px >= 0 && px === py;
      if (!same && px >= 0 && py >= 0) return;
      if (size[x] + size[y] > (same ? hi : cap)) return;
      const a = x < y ? x : y;
      const b = x < y ? y : x;
      pairs.push({ a, b, tier: same ? 1 : 0, score: affinity(a, b, w), va: ver[a], vb: ver[b], r1: Math.min(rank[a], rank[b]), r2: Math.max(rank[a], rank[b]) });
    };
    for (let x = 0; x < n; x += 1) if (alive[x] === 1) for (const [y, w] of out[x]) offer(x, y, w);
    for (let p = pairs.pop(); p !== undefined; p = pairs.pop()) {
      /* Unverändert seit dem Angebot (gleiche Versionen): Größen und Gebiete gelten noch. */
      if (alive[p.a] === 0 || alive[p.b] === 0 || ver[p.a] !== p.va || ver[p.b] !== p.vb) continue;
      const k = tryMerge(p.a, p.b);
      if (k < 0) continue;
      for (const [y, w] of out[k]) offer(k, y, w);
      for (const [y, w] of inn[k]) offer(y, k, w);
    }
  };

  /* -- 1. Verbundene Paare — nur bis unter die volle Größe: so bleibt Platz für die Reste (sonst stünden zwischen vollen
         Gruppen Stücke, die nirgends mehr hineinpassen) ------------------------------------------------------------------ */

  const soft = Math.max(lo, hi - Math.max(1, Math.floor((hi - lo) / 3)));
  agglomerate(soft, 1);

  /* -- 1b. Mit der vorigen Rechnung: Stücke desselben alten Gebiets, die keine Kante verbindet (es kam einst über Reste
          zusammen), wieder vereinigen — soweit kreisfrei und in den Grenzen ------------------------------------------ */

  if (L.prev.some((m) => m.size > 0)) {
    const byOld = new Map<number, number[]>();
    for (let g = 0; g < n; g += 1) {
      if (alive[g] === 0) continue;
      const d = dominant(prevs[g]);
      if (d < 0) continue;
      const list = byOld.get(d);
      if (list === undefined) byOld.set(d, [g]); else list.push(g);
    }
    for (const list of byOld.values()) {
      if (list.length < 2) continue;
      list.sort((p, q) => (rank[p] !== rank[q] ? rank[p] - rank[q] : p - q));
      let acc = list[0];
      for (let i = 1; i < list.length; i += 1) {
        const h = list[i];
        if (size[acc] + size[h] > hi) continue;
        const k = tryMerge(acc, h);
        if (k >= 0) acc = k;
      }
    }
  }

  /* -- 2. Reste unter `lo` ------------------------------------------------------------------------------------------ */

  const find = (x: number): number => {
    let r = x;
    while (up[r] !== r) r = up[r];
    let y = x;
    while (up[y] !== r) { const nx = up[y]; up[y] = r; y = nx; }
    return r;
  };
  /* Die Reihenfolge des Autors über den Knoten dieser Ebene (fest). */
  const byAuthor = [...all].sort((p, q) => (L.rank[p] !== L.rank[q] ? L.rank[p] - L.rank[q] : p - q));
  const authorPos = new Int32Array(n);
  byAuthor.forEach((x, i) => { authorPos[x] = i; });
  const byName = new ByValue(names, alive);
  const byPrev = new ByValue(prevs, alive);

  const smalls = new Heap<Small>(smallFirst);
  for (let g = 0; g < n; g += 1) if (alive[g] === 1 && size[g] < lo) smalls.push({ g, size: size[g], rank: rank[g] });
  const gaveUp = new Uint8Array(n);
  let live: number[] = [];
  let livePos = new Map<number, number>();
  let liveDirty = true;
  const liveOrder = (): void => {
    if (!liveDirty) return;
    live = [];
    for (let g = 0; g < n; g += 1) if (alive[g] === 1) live.push(g);
    live.sort((p, q) => ord[p] - ord[q]);
    livePos = new Map(live.map((g, i) => [g, i]));
    liveDirty = false;
  };

  for (let e = smalls.pop(); e !== undefined; e = smalls.pop()) {
    const g = e.g;
    if (alive[g] === 0 || gaveUp[g] === 1 || size[g] !== e.size || size[g] >= lo) continue;
    const tried = new Set<number>();
    const room = (h: number): boolean => h !== g && alive[h] === 1 && size[g] + size[h] <= hi && !tried.has(h);
    let merged = -1;
    const attempt = (h: number): boolean => {
      if (!room(h)) return false;
      tried.add(h);
      byName.drop(g); byName.drop(h); byPrev.drop(g); byPrev.drop(h);
      const k = tryMerge(g, h);
      if (k < 0) { byName.put(g); byName.put(h); byPrev.put(g); byPrev.put(h); return false; }
      byName.put(k);
      byPrev.put(k);
      merged = k;
      return true;
    };
    /* a) Was zuletzt im selben Gebiet lag (verbunden oder nicht) — sonst zerfiele ein altes Gebiet, das nur durch einen
          Rest zusammenkam; dann die verbundenen Nachbarn mit den meisten Kanten je Größe. */
    const near: [number, number][] = [];
    const pg0 = byPrev.of[g];
    const link = (h: number): number => (out[g].get(h) ?? 0) + (inn[g].get(h) ?? 0);
    if (pg0 >= 0) for (const h of byPrev.with(pg0)) if (h !== g) near.push([h, 2e6 + (link(h) > 0 ? 1e6 + affinity(g, h, link(h)) : -Math.abs(rank[h] - rank[g]) / (1 + Math.abs(rank[h] - rank[g])))]);
    for (const [h, w] of out[g]) if (pg0 < 0 || byPrev.of[h] !== pg0) near.push([h, affinity(g, h, w)]);
    for (const [h, w] of inn[g]) if (pg0 < 0 || byPrev.of[h] !== pg0) near.push([h, affinity(g, h, w)]);
    near.sort((p, q) => (q[1] !== p[1] ? q[1] - p[1] : rank[p[0]] !== rank[q[0]] ? rank[p[0]] - rank[q[0]] : p[0] - q[0]));
    for (const [h] of near) if (attempt(h)) break;
    /* b) Unverbunden: zuerst das alte Gebiet, dann derselbe Name, dann die Nachbarn in der Reihenfolge des Autors. */
    if (merged < 0) {
      const cand = new Map<number, number>();
      const pg = byPrev.of[g];
      const ng = byName.of[g];
      const add = (h: number, dist: number): void => {
        if (!room(h)) return;
        const key = (pg >= 0 && byPrev.of[h] === pg ? 0 : 2e12) + (ng >= 0 && byName.of[h] === ng ? 0 : 1e12) + dist;
        const old = cand.get(h);
        if (old === undefined || key < old) cand.set(h, key);
      };
      if (pg >= 0) for (const h of byPrev.with(pg)) add(h, Math.abs(rank[h] - rank[g]));
      if (ng >= 0) for (const h of byName.with(ng)) add(h, Math.abs(rank[h] - rank[g]));
      for (const m of members[g]) {
        const p = authorPos[m];
        for (let d = 1; d <= AUTHOR_REACH; d += 1) {
          if (p - d >= 0) add(find(byAuthor[p - d]), d);
          if (p + d < n) add(find(byAuthor[p + d]), d);
        }
      }
      /* Gleich nah: die kleinere Gruppe zuerst — so wachsen Reste gleichmäßig, statt eine Gruppe bis zum Rand zu füllen
         und am Ende einen einzelnen übrig zu lassen. */
      const list = [...cand].sort((p, q) => (p[1] !== q[1] ? p[1] - q[1] : size[p[0]] !== size[q[0]] ? size[p[0]] - size[q[0]] : rank[p[0]] !== rank[q[0]] ? rank[p[0]] - rank[q[0]] : p[0] - q[0]));
      for (const [h] of list) if (attempt(h)) break;
    }
    /* c) Die Nachbarn in der Reihenfolge des Lernens (der nächste ist immer kreisfrei), dann weiter weg. */
    if (merged < 0) {
      liveOrder();
      const at = livePos.get(g) ?? -1;
      for (let d = 1; d <= WIDEN && merged < 0; d += 1) {
        if (at - d >= 0 && attempt(live[at - d])) break;
        if (at + d < live.length && attempt(live[at + d])) break;
      }
    }
    if (merged < 0) { gaveUp[g] = 1; continue; }
    liveDirty = true;
    if (size[merged] < lo) smalls.push({ g: merged, size: size[merged], rank: rank[merged] });
  }

  /* -- 2b. Was stark verbunden ist (mindestens STRONG Kanten), darf nun bis zur vollen Größe zusammen ------------------ */

  agglomerate(hi, STRONG);

  /* -- 3. Grenzen nachziehen: ein Knoten wechselt in eine benachbarte Gruppe, wenn dadurch mehr Kanten innen liegen —
         nur, wenn beide Gruppen in ihren Grenzen bleiben und die Reihenfolge der Gruppen weiter gilt (dann bleibt der
         Graph der Gruppen kreisfrei, ohne zu suchen), und nie aus seinem alten Gebiet hinaus ---------------------------- */

  const gid = new Int32Array(n);
  for (let x = 0; x < n; x += 1) gid[x] = find(x);
  const fits = (x: number, a: number, b: number): boolean => {
    const ob = ord[b];
    if (ord[a] < ob) {
      for (const y of L.out[x].keys()) { const g = gid[y]; if (g === a || (g !== b && ord[g] < ob)) return false; }
      for (const y of L.inn[x].keys()) { const g = gid[y]; if (g !== b && g !== a && ord[g] > ob) return false; }
    } else {
      for (const y of L.inn[x].keys()) { const g = gid[y]; if (g === a || (g !== b && ord[g] > ob)) return false; }
      for (const y of L.out[x].keys()) { const g = gid[y]; if (g !== b && g !== a && ord[g] < ob) return false; }
    }
    return true;
  };
  const toGroup = new Map<number, number>();
  for (let pass = 0; pass < REFINE; pass += 1) {
    let changed = false;
    for (const x of byAuthor) {
      const a = gid[x];
      if (size[a] - L.size[x] < Math.max(1, lo)) continue;
      toGroup.clear();
      let toA = 0;
      for (const [y, w] of L.out[x]) { const g = gid[y]; if (g === a) toA += w; else toGroup.set(g, (toGroup.get(g) ?? 0) + w); }
      for (const [y, w] of L.inn[x]) { const g = gid[y]; if (g === a) toA += w; else toGroup.set(g, (toGroup.get(g) ?? 0) + w); }
      const px = dominant(L.prev[x]);
      let best = -1;
      let gain = 0;
      for (const [b, w] of toGroup) {
        const d = w - toA;
        if (d <= 0 || d < gain || size[b] + L.size[x] > hi) continue;
        if (d === gain && best >= 0 && (rank[b] > rank[best] || (rank[b] === rank[best] && b > best))) continue;
        if (px >= 0 && byPrev.of[a] === px && byPrev.of[b] !== px) continue;
        if (!fits(x, a, b)) continue;
        best = b;
        gain = d;
      }
      if (best < 0) continue;
      gid[x] = best;
      size[a] -= L.size[x];
      size[best] += L.size[x];
      addCounts(prevs[a], L.prev[x], -1);
      addCounts(prevs[best], L.prev[x]);
      byPrev.drop(a); byPrev.put(a); byPrev.drop(best); byPrev.put(best);
      changed = true;
    }
    if (!changed) break;
  }

  /* -- 4. Reste auffüllen: eine Gruppe unter `lo` holt sich einzelne Knoten von Nachbarn, die einen entbehren können —
         den, der am wenigsten Kanten kostet; auch hier nur, wo die Reihenfolge der Gruppen gilt -------------------------- */

  const membersOf = new Map<number, number[]>();
  for (const x of byAuthor) {
    let list = membersOf.get(gid[x]);
    if (list === undefined) { list = []; membersOf.set(gid[x], list); }
    list.push(x);
  }
  const shorts = [...membersOf.keys()].filter((g) => size[g] < lo).sort((p, q) => (size[p] !== size[q] ? size[p] - size[q] : rank[p] !== rank[q] ? rank[p] - rank[q] : p - q));
  for (const g of shorts) {
    while (size[g] < lo) {
      const mine = membersOf.get(g) as number[];
      let best = -1;
      let gain = -Infinity;
      const seen = new Set<number>();
      for (const m of mine) {
        for (const map of [L.out[m], L.inn[m]]) {
          for (const x of map.keys()) {
            const a = gid[x];
            if (a === g || seen.has(x)) continue;
            seen.add(x);
            if (size[a] - L.size[x] < Math.max(1, lo) || size[g] + L.size[x] > hi) continue;
            const px = dominant(L.prev[x]);
            if (px >= 0 && byPrev.of[a] === px && byPrev.of[g] !== px) continue;
            let toG = 0;
            let toA = 0;
            for (const [y, w] of L.out[x]) { if (gid[y] === g) toG += w; else if (gid[y] === a) toA += w; }
            for (const [y, w] of L.inn[x]) { if (gid[y] === g) toG += w; else if (gid[y] === a) toA += w; }
            const d = toG - toA;
            if (d < gain || (d === gain && best >= 0 && (L.rank[x] > L.rank[best] || (L.rank[x] === L.rank[best] && x > best)))) continue;
            if (!fits(x, a, g)) continue;
            best = x;
            gain = d;
          }
        }
      }
      if (best < 0) break;
      const a = gid[best];
      gid[best] = g;
      size[a] -= L.size[best];
      size[g] += L.size[best];
      addCounts(prevs[a], L.prev[best], -1);
      addCounts(prevs[g], L.prev[best]);
      byPrev.drop(a); byPrev.put(a); byPrev.drop(g); byPrev.put(g);
      const from = membersOf.get(a) as number[];
      from.splice(from.indexOf(best), 1);
      mine.push(best);
    }
  }

  /* -- 5. Zuletzt: ein Gebiet mit nur einem Kind gibt es nicht, solange es Nachbarn gibt — es geht in die Gruppe neben ihm
         in der Reihenfolge des Lernens (die nächste ist immer kreisfrei), lieber eine mit Platz, sonst die kleinere (dann
         eben eins über `hi`) ------------------------------------------------------------------------------------------- */

  {
    const lives: number[] = [];
    for (let g = 0; g < n; g += 1) if (alive[g] === 1) lives.push(g);
    if (lives.length > 1) {
      lives.sort((p, q) => ord[p] - ord[q]);
      for (let i = 0; i < lives.length; i += 1) {
        const g = lives[i];
        const mine = membersOf.get(g);
        if (alive[g] === 0 || mine === undefined || mine.length !== 1 || size[g] !== 1) continue;
        const near: number[] = [];
        for (let j = i - 1; j >= 0; j -= 1) if (alive[lives[j]] === 1) { near.push(lives[j]); break; }
        for (let j = i + 1; j < lives.length; j += 1) if (alive[lives[j]] === 1) { near.push(lives[j]); break; }
        if (near.length === 0) continue;
        near.sort((p, q) => (Number(size[p] + 1 > hi) - Number(size[q] + 1 > hi)) || size[p] - size[q] || ord[p] - ord[q]);
        const h = near[0];
        const x = mine[0];
        gid[x] = h;
        size[h] += size[g];
        size[g] = 0;
        (membersOf.get(h) as number[]).push(x);
        membersOf.delete(g);
        alive[g] = 0;
      }
    }
  }

  /* -- Nummern der Gruppen: in der Reihenfolge des Lernens ---------------------------------------------------------- */
  const finals: number[] = [];
  for (let g = 0; g < n; g += 1) if (alive[g] === 1) finals.push(g);
  finals.sort((p, q) => ord[p] - ord[q]);
  const num = new Map<number, number>(finals.map((g, i) => [g, i]));
  const groupOf = new Int32Array(n);
  for (let x = 0; x < n; x += 1) groupOf[x] = num.get(gid[x]) as number;
  return { groupOf, count: finals.length };
}

/**
 * Die nächste Ebene: je Gruppe ein Knoten (Größe 1), Kanten zwischen Gruppen mit der Summe ihrer Gewichte; die alten
 * Gebiete dieser Ebene (`prev`) zählen die Themen je Knoten (`prevOf`: Thema → alter Schlüssel, `nodeOf`: Thema → Knoten).
 */
function nextLevel(L: Level, groupOf: Int32Array, count: number, nodeOf: Int32Array, prevOf: Int32Array | undefined): Level {
  const size = new Float64Array(count).fill(1);
  const rank = new Float64Array(count).fill(Infinity);
  const out: Map<number, number>[] = [];
  const inn: Map<number, number>[] = [];
  const names: Map<number, number>[] = [];
  for (let g = 0; g < count; g += 1) { out.push(new Map()); inn.push(new Map()); names.push(new Map()); }
  for (let x = 0; x < L.n; x += 1) {
    const g = groupOf[x];
    if (L.rank[x] < rank[g]) rank[g] = L.rank[x];
    addCounts(names[g], L.names[x]);
    for (const [y, w] of L.out[x]) {
      const h = groupOf[y];
      if (h === g) continue;
      out[g].set(h, (out[g].get(h) ?? 0) + w);
      inn[h].set(g, (inn[h].get(g) ?? 0) + w);
    }
  }
  return { n: count, size, rank, out, inn, names, prev: prevCounts(count, nodeOf, prevOf) };
}

/** Je Knoten: wie viele seiner Themen in welchem alten Gebiet lagen. */
function prevCounts(count: number, nodeOf: Int32Array, prevOf: Int32Array | undefined): Map<number, number>[] {
  const maps: Map<number, number>[] = [];
  for (let x = 0; x < count; x += 1) maps.push(new Map());
  if (prevOf === undefined) return maps;
  for (let t = 0; t < nodeOf.length; t += 1) {
    const o = prevOf[t];
    if (o < 0) continue;
    const m = maps[nodeOf[t]];
    m.set(o, (m.get(o) ?? 0) + 1);
  }
  return maps;
}

/* -- Das Ganze -------------------------------------------------------------------------------------------------- */

export function buildRegions(input: RegionGraphInput, options: RegionOptions = {}): RegionTree {
  const t0 = now();
  const ids = input.ids;
  const n = ids.length;
  const min = Math.max(1, Math.floor(options.min ?? 5));
  const max = Math.max(min, Math.floor(options.max ?? 12));
  const topMin = Math.max(1, Math.floor(options.topMin ?? 7));
  const topMax = Math.max(topMin, Math.floor(options.topMax ?? 20));
  const around = options.around ?? ((label: string) => `Rund um ${label}`);
  const labelOf = (t: number): string => {
    const l = input.labels[t];
    return typeof l === 'string' && l.trim() !== '' ? l.trim() : ids[t];
  };
  const rank = new Float64Array(n);
  for (let t = 0; t < n; t += 1) {
    const r = input.rank?.[t];
    rank[t] = typeof r === 'number' && Number.isFinite(r) ? r : t;
  }
  const firstTopic = (p: number, q: number): number => (rank[p] !== rank[q] ? rank[p] - rank[q] : p - q);
  /** Das erste Thema einer Liste in der Reihenfolge des Autors. */
  const firstOf = (topics: readonly number[]): number => {
    let best = topics[0];
    for (const t of topics) if (firstTopic(t, best) < 0) best = t;
    return best;
  };

  /* Kanten: Voraussetzung p → Thema t, ohne Doppelte, ohne Schleifen. */
  const succ: number[][] = [];
  for (let t = 0; t < n; t += 1) succ.push([]);
  const edgeP: number[] = [];
  const edgeT: number[] = [];
  {
    const seen = new Int32Array(n).fill(-1);
    for (let t = 0; t < n; t += 1) {
      for (const p of input.needs[t] ?? []) {
        if (!Number.isInteger(p) || p < 0 || p >= n || p === t || seen[p] === t) continue;
        seen[p] = t;
        succ[p].push(t);
        edgeP.push(p);
        edgeT.push(t);
      }
    }
  }
  const edges = edgeP.length;

  /* Die Namen der Baza: Nummern in der Reihenfolge des Autors ihres ersten Themas (für Gleichstände). */
  const byAuthor: number[] = [];
  for (let t = 0; t < n; t += 1) byAuthor.push(t);
  byAuthor.sort(firstTopic);
  const nameId = new Map<string, number>();
  const nameText: string[] = [];
  const namesOf: number[][] = [];
  for (let t = 0; t < n; t += 1) namesOf.push([]);
  for (const t of byAuthor) {
    for (const raw of input.names?.[t] ?? []) {
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      const s = raw.trim();
      let id = nameId.get(s);
      if (id === undefined) { id = nameText.length; nameId.set(s, id); nameText.push(s); }
      if (!namesOf[t].includes(id)) namesOf[t].push(id);
    }
  }
  /* Ein Eintrag, dessen Name selbst ein Name der Baza ist (der Eintrag eines Abschnitts), trägt ihn. */
  const labelName = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t += 1) { const id = nameId.get(labelOf(t)); if (id !== undefined) labelName[t] = id; }

  /* -- Atome: Kreise bleiben beisammen ------------------------------------------------------------------------------ */
  const scc = strongComponents(n, succ);
  const atomCount = scc.count;
  /* Kanonisch nummeriert: nach dem ersten Thema in der Reihenfolge des Autors. */
  const atomNum = new Int32Array(atomCount).fill(-1);
  const atomTopics: number[][] = [];
  for (const t of byAuthor) {
    const c = scc.comp[t];
    if (atomNum[c] < 0) { atomNum[c] = atomTopics.length; atomTopics.push([]); }
    atomTopics[atomNum[c]].push(t);
  }
  const atomOf = new Int32Array(n);
  for (let t = 0; t < n; t += 1) atomOf[t] = atomNum[scc.comp[t]];
  let cycles = 0;
  for (const a of atomTopics) if (a.length > 1) cycles += 1;

  /* -- Die vorige Rechnung: je Ebene (von unten) der alte Schlüssel jedes Themas, nach Kennung ------------------------- */
  const oldAt: Map<string, string>[] = [];
  const oldSize: Map<string, number>[] = [];
  /** Jeder Schlüssel, den es früher gab — ein neuer nimmt keinen davon (sonst erbte er Namen und Lage eines anderen). */
  const taken = new Set<string>();
  {
    const prev = options.previous;
    if (prev !== undefined && prev !== null) {
      for (const id of Object.keys(prev)) {
        const list = prev[id];
        if (!Array.isArray(list)) continue;
        const D = list.length;
        for (let j = 0; j < D; j += 1) {
          const key = list[j];
          if (typeof key !== 'string' || key === '') continue;
          const lvl = D - j;
          while (oldAt.length < lvl) { oldAt.push(new Map()); oldSize.push(new Map()); }
          oldAt[lvl - 1].set(id, key);
          oldSize[lvl - 1].set(key, (oldSize[lvl - 1].get(key) ?? 0) + 1);
          taken.add(key);
        }
      }
    }
  }
  /* Je Ebene: Thema → Nummer seines alten Gebiets (−1: neu), die Nummern in der Reihenfolge des Autors. */
  const oldIdx: Int32Array[] = oldAt.map((m) => {
    const num = new Map<string, number>();
    const arr = new Int32Array(n).fill(-1);
    for (const t of byAuthor) {
      const key = m.get(ids[t]);
      if (key === undefined) continue;
      let k = num.get(key);
      if (k === undefined) { k = num.size; num.set(key, k); }
      arr[t] = k;
    }
    return arr;
  });

  const atomLevel: Level = (() => {
    const size = new Float64Array(atomCount);
    const arank = new Float64Array(atomCount).fill(Infinity);
    const out: Map<number, number>[] = [];
    const inn: Map<number, number>[] = [];
    const names: Map<number, number>[] = [];
    for (let a = 0; a < atomCount; a += 1) { out.push(new Map()); inn.push(new Map()); names.push(new Map()); }
    for (let t = 0; t < n; t += 1) {
      const a = atomOf[t];
      size[a] += 1;
      if (rank[t] < arank[a]) arank[a] = rank[t];
      for (const nm of namesOf[t]) names[a].set(nm, (names[a].get(nm) ?? 0) + 1);
    }
    for (let e = 0; e < edges; e += 1) {
      const a = atomOf[edgeP[e]];
      const b = atomOf[edgeT[e]];
      if (a === b) continue;
      out[a].set(b, (out[a].get(b) ?? 0) + 1);
      inn[b].set(a, (inn[b].get(a) ?? 0) + 1);
    }
    return { n: atomCount, size, rank: arank, out, inn, names, prev: prevCounts(atomCount, atomOf, oldIdx[0]) };
  })();

  /* -- Ebenen, bis oben topMin–topMax stehen ------------------------------------------------------------------------- */
  const ups: Int32Array[] = [];
  const counts: number[] = [];
  const bounds: [number, number][] = [];
  if (n > topMax) {
    let cur = atomLevel;
    let total = n;
    let nodeOf: Int32Array = atomOf;
    for (let guard = 0; guard < 32; guard += 1) {
      let b: [number, number] = [min, max];
      let r = groupLevel(cur, b[0], b[1]);
      /* Die letzte Ebene: kleinere Gruppen, damit oben genug stehen. Entschieden nur aus der Struktur (ohne die vorige
         Rechnung) — sonst wählte dieselbe Baza mit ihrer eigenen Rechnung andere Grenzen. Nur kleine Ebenen kommen in
         Frage: ab topMin · max Knoten bleiben mit Gruppen bis max ohnehin genug. */
      if (total < topMin * max) {
        const hasPrev = cur.prev.some((m) => m.size > 0);
        const bare: Level = hasPrev ? { ...cur, prev: cur.prev.map(() => new Map<number, number>()) } : cur;
        const probe = hasPrev ? groupLevel(bare, min, max) : r;
        const hi2 = Math.max(2, Math.min(max, Math.floor(total / topMin)));
        const lo2 = Math.min(hi2, Math.max(2, Math.min(min, Math.ceil(hi2 / 2))));
        if (probe.count < topMin && (hi2 < max || lo2 < min)) {
          const r2 = groupLevel(cur, lo2, hi2);
          const probe2 = hasPrev ? groupLevel(bare, lo2, hi2) : r2;
          if (probe2.count > probe.count) { r = r2; b = [lo2, hi2]; }
        }
      }
      if (r.count < 2 || r.count >= cur.n) break;
      ups.push(r.groupOf);
      counts.push(r.count);
      bounds.push(b);
      if (r.count <= topMax) break;
      const next = new Int32Array(n);
      for (let t = 0; t < n; t += 1) next[t] = r.groupOf[nodeOf[t]];
      nodeOf = next;
      cur = nextLevel(cur, r.groupOf, r.count, nodeOf, oldIdx[ups.length]);
      total = r.count;
    }
  }
  const levels = ups.length;

  /* Je Ebene (Index k − 1) das Gebiet jedes Themas, und das Gebiet über jedem Gebiet. */
  const regOf: Int32Array[] = [];
  {
    let cur: Int32Array = atomOf;
    for (let k = 0; k < levels; k += 1) {
      const g = ups[k];
      const next = new Int32Array(n);
      for (let t = 0; t < n; t += 1) next[t] = g[cur[t]];
      regOf.push(next);
      cur = next;
    }
  }
  const parentOf = (k: number, i: number): number => (k < levels ? ups[k][i] : -1);

  /* -- Die Mitte: das Thema, von dem im Gebiet am meisten abhängt ---------------------------------------------------- */
  const atomOrder = learningOrder(atomTopics.map((_, a) => a), (a) => atomLevel.out[a].keys(), atomLevel.rank);
  const atomPos = new Int32Array(atomCount);
  atomOrder.forEach((a, i) => { atomPos[a] = i; });
  const loc = new Int32Array(n).fill(-1);
  const aloc = new Int32Array(atomCount).fill(-1);
  /** Die Themen eines Gebiets nach der Zahl der Themen darin, die auf ihnen aufbauen (die meisten zuerst; dann der Autor). */
  const byCentrality = (topics: readonly number[]): number[] => {
    const atoms: number[] = [];
    topics.forEach((t, i) => {
      loc[t] = i;
      const a = atomOf[t];
      if (aloc[a] < 0) { aloc[a] = atoms.length; atoms.push(a); }
    });
    const W = (topics.length + 31) >>> 5;
    const bits = new Uint32Array(atoms.length * W);
    /* Was darauf baut, zuerst: so ist alles darunter schon gezählt. Kein Weg verlässt das Gebiet und kommt zurück. */
    const late = [...atoms].sort((p, q) => atomPos[q] - atomPos[p]);
    for (const a of late) {
      const base = aloc[a] * W;
      for (const b of atomLevel.out[a].keys()) {
        const lb = aloc[b];
        if (lb < 0) continue;
        const bb = lb * W;
        for (let w = 0; w < W; w += 1) bits[base + w] |= bits[bb + w];
        for (const t of atomTopics[b]) bits[base + (loc[t] >>> 5)] |= 1 << (loc[t] & 31);
      }
    }
    const below = new Int32Array(atoms.length);
    for (let i = 0; i < atoms.length; i += 1) {
      let c = atomTopics[atoms[i]].length - 1;
      for (let w = 0; w < W; w += 1) c += popcount(bits[i * W + w]);
      below[i] = c;
    }
    const count = new Map<number, number>();
    for (const t of topics) count.set(t, below[aloc[atomOf[t]]]);
    for (const a of atoms) aloc[a] = -1;
    for (const t of topics) loc[t] = -1;
    return [...topics].sort((p, q) => ((count.get(q) as number) - (count.get(p) as number)) || firstTopic(p, q));
  };
  /** Die Mitte: das Thema, von dem im Gebiet am meisten abhängt. */
  const centralOf = (topics: readonly number[]): number => byCentrality(topics)[0];
  const topicsByRegion = (k: number, count: number): number[][] => {
    const lists: number[][] = [];
    for (let i = 0; i < count; i += 1) lists.push([]);
    const r = regOf[k];
    for (let t = 0; t < n; t += 1) lists[r[t]].push(t);
    return lists;
  };

  /* -- Schlüssel: aus der vorigen Rechnung nach Überdeckung, sonst neu aus der Mitte ------------------------------------ */
  const keyOf: string[][] = [];
  const keyAt = new Map<string, { readonly k: number; readonly i: number }>();
  {
    const pre: number[][][] = [];
    for (let k = 0; k < levels; k += 1) {
      const lists = topicsByRegion(k, counts[k]);
      pre.push(lists);
      const keys: string[] = new Array<string>(counts[k]).fill('');
      keyOf.push(keys);
      const old = oldAt[k];
      if (old === undefined) continue;
      const cands: { readonly i: number; readonly key: string; readonly j: number; readonly r: number }[] = [];
      lists.forEach((topics, i) => {
        const hits = new Map<string, number>();
        for (const t of topics) { const key = old.get(ids[t]); if (key !== undefined) hits.set(key, (hits.get(key) ?? 0) + 1); }
        for (const [key, c] of hits) {
          const j = c / (topics.length + (oldSize[k].get(key) ?? 0) - c);
          if (j >= MATCH) cands.push({ i, key, j, r: rank[firstOf(topics)] });
        }
      });
      cands.sort((p, q) => (p.j !== q.j ? q.j - p.j : p.r !== q.r ? p.r - q.r : p.i !== q.i ? p.i - q.i : p.key < q.key ? -1 : p.key > q.key ? 1 : 0));
      const usedKey = new Set<string>();
      for (const c of cands) {
        if (keys[c.i] !== '' || usedKey.has(c.key) || keyAt.has(c.key)) continue;
        keys[c.i] = c.key;
        usedKey.add(c.key);
        keyAt.set(c.key, { k, i: c.i });
      }
    }
    /* Neue Schlüssel: "r:" + die Mitte; nie einer, den es früher gab (sonst erbte er Namen und Lage eines anderen). */
    for (let k = 0; k < levels; k += 1) {
      const lists = pre[k];
      const order = lists.map((_, i) => i).sort((p, q) => firstTopic(firstOf(lists[p]), firstOf(lists[q])));
      for (const i of order) {
        if (keyOf[k][i] !== '') continue;
        const base = `r:${ids[centralOf(lists[i])]}`;
        let key = base;
        for (let s = 2; taken.has(key) || keyAt.has(key); s += 1) key = `${base}~${s}`;
        keyOf[k][i] = key;
        keyAt.set(key, { k, i });
      }
    }
  }

  /* -- Verschiebungen des Eigentümers: nur, wenn jede Ebene kreisfrei bleibt ---------------------------------------------- */
  let moved = 0;
  const ignored: string[] = [];
  {
    const moves = options.overrides?.moves ?? {};
    const topicIndex = new Map<string, number>();
    ids.forEach((id, t) => { if (!topicIndex.has(id)) topicIndex.set(id, t); });
    const list = Object.keys(moves).filter((id) => hasOwn(moves, id)).sort((p, q) => {
      const tp = topicIndex.get(p);
      const tq = topicIndex.get(q);
      if (tp !== undefined && tq !== undefined) return firstTopic(tp, tq);
      if (tp !== undefined) return -1;
      if (tq !== undefined) return 1;
      return p < q ? -1 : p > q ? 1 : 0;
    });
    const cyclicAt = (r: Int32Array, count: number): boolean => {
      const out: Set<number>[] = [];
      for (let i = 0; i < count; i += 1) out.push(new Set());
      const indeg = new Int32Array(count);
      for (let e = 0; e < edges; e += 1) {
        const a = r[edgeP[e]];
        const b = r[edgeT[e]];
        if (a === b || out[a].has(b)) continue;
        out[a].add(b);
        indeg[b] += 1;
      }
      const queue: number[] = [];
      for (let i = 0; i < count; i += 1) if (indeg[i] === 0) queue.push(i);
      let seen = 0;
      for (let q = 0; q < queue.length; q += 1) {
        seen += 1;
        for (const b of out[queue[q]]) { indeg[b] -= 1; if (indeg[b] === 0) queue.push(b); }
      }
      return seen < count;
    };
    for (const id of list) {
      const to = moves[id];
      const t = topicIndex.get(id);
      if (t === undefined) { ignored.push(`${id}: no such topic`); continue; }
      if (levels === 0) { ignored.push(`${id}: the base has no regions`); continue; }
      const target = typeof to === 'string' ? keyAt.get(to) : undefined;
      if (target === undefined || target.k !== 0) { ignored.push(`${id}: no leaf region ${String(to)}`); continue; }
      if (regOf[0][t] === target.i) { moved += 1; continue; }
      if (atomTopics[atomOf[t]].length > 1) { ignored.push(`${id}: in a cycle with other topics — the cycle stays in one region`); continue; }
      const chain: number[] = [];
      for (let k = 0, i = target.i; k < levels; k += 1) { chain.push(i); i = parentOf(k + 1, i); }
      let bad = -1;
      for (let k = 0; k < levels && bad < 0; k += 1) {
        if (regOf[k][t] === chain[k]) continue;
        const r = Int32Array.from(regOf[k]);
        r[t] = chain[k];
        if (cyclicAt(r, counts[k])) bad = k + 1;
      }
      if (bad > 0) { ignored.push(`${id}: would create a cycle (level ${bad})`); continue; }
      for (let k = 0; k < levels; k += 1) regOf[k][t] = chain[k];
      moved += 1;
    }
  }

  /* -- Zusammenbau ------------------------------------------------------------------------------------------------------ */
  const regions = new Map<string, RegionNode>();
  const leafOf: (string | null)[] = new Array<string | null>(n).fill(null);
  const sizes: number[][] = [];
  const inside: number[] = [];
  let top: string[] = [];

  if (levels === 0) {
    const all: number[] = [];
    for (let t = 0; t < n; t += 1) all.push(t);
    top = learningOrder(all, (t) => succ[t], rank).map((t) => ids[t]);
  } else {
    /* Die Themen je Gebiet (nach den Verschiebungen), leere Gebiete fallen weg. */
    const lists: number[][][] = [];
    for (let k = 0; k < levels; k += 1) lists.push(topicsByRegion(k, counts[k]));
    const regionRank = (k: number, i: number): number => rank[firstOf(lists[k][i])];

    /* Namen, von oben nach unten: der Eigentümer, sonst die Baza (je Ebene jeder Name höchstens einmal), sonst die Mitte —
       nie ein Name, den ein Gebiet darüber oder daneben schon trägt (sonst stünde in den Brotkrumen zweimal dasselbe). */
    const ownerNames = options.overrides?.names ?? {};
    const nameOf: string[][] = [];
    const namedOf: ('base' | 'central' | 'owner')[][] = [];
    const centralAt: number[][] = [];
    for (let k = 0; k < levels; k += 1) {
      nameOf.push(new Array<string>(counts[k]).fill(''));
      namedOf.push(new Array<'base' | 'central' | 'owner'>(counts[k]).fill('central'));
      centralAt.push(new Array<number>(counts[k]).fill(-1));
    }
    const fold = (s: string): string => s.toLowerCase();
    /** Der Name der Baza, den ein vom Eigentümer benanntes Gebiet trotzdem hält (sonst ginge er an ein anderes). */
    const kept: string[][] = counts.map((c) => new Array<string>(c).fill(''));
    /** Die Namen aller Gebiete über einem Gebiet (klein geschrieben), mit den gehaltenen. */
    const above = (k: number, i: number): Set<string> => {
      const names = new Set<string>();
      for (let kk = k, ii = i; kk + 1 < levels; kk += 1) {
        ii = parentOf(kk + 1, ii);
        names.add(fold(nameOf[kk + 1][ii]));
        if (kept[kk + 1][ii] !== '') names.add(fold(kept[kk + 1][ii]));
      }
      return names;
    };
    for (let k = levels - 1; k >= 0; k -= 1) {
      const count = counts[k];
      const nm = nameOf[k];
      const nd = namedOf[k];
      const ce = centralAt[k];
      const ranked: number[][] = [];
      const ancestors: Set<string>[] = [];
      const cands: { readonly i: number; readonly name: number; readonly share: number; readonly entry: boolean; readonly count: number; readonly r: number }[] = [];
      for (let i = 0; i < count; i += 1) {
        const topics = lists[k][i];
        ranked.push([]);
        ancestors.push(new Set());
        if (topics.length === 0) continue;
        ranked[i] = byCentrality(topics);
        ce[i] = ranked[i][0];
        ancestors[i] = above(k, i);
        const key = keyOf[k][i];
        const own = hasOwn(ownerNames, key) ? ownerNames[key] : undefined;
        /* Der Name des Eigentümers gilt; sein Gebiet bewirbt sich trotzdem um einen Namen der Baza — so wandert der nicht
           zu einem anderen Gebiet, nur weil eines umbenannt wurde. */
        if (typeof own === 'string' && own.trim() !== '') { nm[i] = own.trim(); nd[i] = 'owner'; }
        const tally = new Map<number, number>();
        const entry = new Set<number>();
        for (const t of topics) {
          for (const x of namesOf[t]) tally.set(x, (tally.get(x) ?? 0) + 1);
          const ln = labelName[t];
          if (ln >= 0) { entry.add(ln); if (!namesOf[t].includes(ln)) tally.set(ln, (tally.get(ln) ?? 0) + 1); }
        }
        for (const [x, c] of tally) {
          const share = c / topics.length;
          if (share >= SHARE && !ancestors[i].has(fold(nameText[x]))) cands.push({ i, name: x, share, entry: entry.has(x), count: c, r: regionRank(k, i) });
        }
      }
      cands.sort((p, q) => (p.share !== q.share ? q.share - p.share
        : p.entry !== q.entry ? (p.entry ? -1 : 1)
          : p.count !== q.count ? q.count - p.count
            : p.r !== q.r ? p.r - q.r
              : p.i !== q.i ? p.i - q.i : p.name - q.name));
      const used = new Set<number>();
      const claimed = new Uint8Array(count);
      for (const c of cands) {
        if (claimed[c.i] === 1 || used.has(c.name)) continue;
        claimed[c.i] = 1;
        used.add(c.name);
        if (nd[c.i] === 'owner') { kept[k][c.i] = nameText[c.name]; continue; }
        nm[c.i] = nameText[c.name];
        nd[c.i] = 'base';
      }
      /* Die übrigen nach ihrer Mitte — die nächste Mitte, wenn der Name darüber oder daneben schon steht; erst wenn jede
         Mitte vergeben ist, eine Nummer. */
      const siblings = new Map<number, Set<string>>();
      const namesBeside = (i: number): Set<string> => {
        const p = k + 1 < levels ? parentOf(k + 1, i) : -1;
        let set = siblings.get(p);
        if (set === undefined) { set = new Set(); siblings.set(p, set); }
        return set;
      };
      for (let i = 0; i < count; i += 1) if (nm[i] !== '') namesBeside(i).add(fold(nm[i]));
      const rest: number[] = [];
      for (let i = 0; i < count; i += 1) if (nm[i] === '' && lists[k][i].length > 0) rest.push(i);
      rest.sort((p, q) => regionRank(k, p) - regionRank(k, q) || p - q);
      for (const i of rest) {
        const beside = namesBeside(i);
        const blocked = (s: string): boolean => beside.has(fold(s)) || ancestors[i].has(fold(s));
        let pick = -1;
        for (const t of ranked[i]) if (!blocked(around(labelOf(t)))) { pick = t; break; }
        let name: string;
        if (pick >= 0) name = around(labelOf(pick));
        else {
          pick = ranked[i][0];
          const plain = around(labelOf(pick));
          let s = 2;
          while (blocked(`${plain} (${s})`)) s += 1;
          name = `${plain} (${s})`;
        }
        nm[i] = name;
        ce[i] = pick;
        beside.add(fold(name));
      }
    }

    /* Der Graph der Gebiete je Ebene — für die Reihenfolge der Kinder. */
    const quotient: Set<number>[][] = [];
    for (let k = 0; k < levels; k += 1) {
      const q: Set<number>[] = [];
      for (let i = 0; i < counts[k]; i += 1) q.push(new Set());
      const r = regOf[k];
      for (let e = 0; e < edges; e += 1) { const a = r[edgeP[e]]; const b = r[edgeT[e]]; if (a !== b) q[a].add(b); }
      quotient.push(q);
    }
    const rankOfLevel: Float64Array[] = [];
    for (let k = 0; k < levels; k += 1) {
      const rr = new Float64Array(counts[k]).fill(Infinity);
      for (let i = 0; i < counts[k]; i += 1) if (lists[k][i].length > 0) rr[i] = regionRank(k, i);
      rankOfLevel.push(rr);
    }
    const childLists: number[][][] = [];
    for (let k = 1; k < levels; k += 1) {
      const ch: number[][] = [];
      for (let i = 0; i < counts[k]; i += 1) ch.push([]);
      for (let j = 0; j < counts[k - 1]; j += 1) if (lists[k - 1][j].length > 0) ch[parentOf(k, j)].push(j);
      childLists.push(ch);
    }

    /* Einfügen von oben nach unten, je Ebene in der Reihenfolge der Kinder. */
    const topIdx: number[] = [];
    for (let i = 0; i < counts[levels - 1]; i += 1) if (lists[levels - 1][i].length > 0) topIdx.push(i);
    let layer = learningOrder(topIdx, (i) => quotient[levels - 1][i], rankOfLevel[levels - 1]);
    top = layer.map((i) => keyOf[levels - 1][i]);
    for (let k = levels - 1; k >= 0; k -= 1) {
      const nextLayer: number[] = [];
      for (const i of layer) {
        const key = keyOf[k][i];
        const topics = lists[k][i];
        let children: string[];
        if (k === 0) {
          children = learningOrder(topics, (t) => succ[t], rank).map((t) => ids[t]);
          for (const t of topics) leafOf[t] = key;
        } else {
          const kids = learningOrder(childLists[k - 1][i], (j) => quotient[k - 1][j], rankOfLevel[k - 1]);
          for (const j of kids) nextLayer.push(j);
          children = kids.map((j) => keyOf[k - 1][j]);
        }
        const p = parentOf(k + 1, i);
        regions.set(key, {
          key,
          level: k + 1,
          parent: p >= 0 ? keyOf[k + 1][p] : null,
          children,
          topics: [...topics],
          name: nameOf[k][i],
          named: namedOf[k][i],
          central: centralAt[k][i]
        });
      }
      layer = nextLayer;
    }

    /* Größen und Anteil der Kanten innen, je Ebene von unten. */
    for (let k = 0; k < levels; k += 1) {
      const s: number[] = [];
      for (const node of regions.values()) if (node.level === k + 1) s.push(node.children.length);
      sizes.push(s);
      const r = regOf[k];
      let inner = 0;
      for (let e = 0; e < edges; e += 1) if (r[edgeP[e]] === r[edgeT[e]]) inner += 1;
      inside.push(edges === 0 ? 1 : inner / edges);
    }
  }

  /* Je Thema seine Schlüssel von oben nach unten. */
  const assignment = Object.fromEntries(ids.map((id, t) => {
    const keys: string[] = [];
    for (let k = levels - 1; k >= 0; k -= 1) keys.push(keyOf[k][regOf[k][t]]);
    return [id, keys];
  })) as Record<string, readonly string[]>;

  return {
    levels,
    regions,
    top,
    leafOf,
    assignment,
    stats: { sizes, inside, ms: now() - t0, moved, ignored, bounds, edges, cycles }
  };
}
