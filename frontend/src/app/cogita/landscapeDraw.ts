/**
 * 2026-11-03 (Prompt 3) — WAS DAS BILD DES KRAJOBRAZ ZEICHNET, ohne React (geprüft in `app-landscape-check`):
 *
 * <code>
 *   Wege      EIN Graph auf dem Raster: jede Kante zwischen zwei Feldern genau einmal, von Zellmitte zu Zellmitte über
 *             Nachbarzellen (A*: lieber über die eigenen Zellen und den Boden als über fremde Felder); schon gelegte
 *             Stücke kosten weniger — gemeinsame Strecken liegen aufeinander und werden einmal gezeichnet
 *   Schritte  die nächsten drei Schritte und das Ziel tragen ihre Zahl, die übrigen einen Punkt
 *   Namen     was wichtiger ist, steht zuerst; was sich mit schon Stehendem überdeckt, fällt weg
 * </code>
 */

/** Eine Zelle des Rasters (axial). */
export interface DrawCell {
  readonly q: number;
  readonly r: number;
}

/** Die sechs Nachbarn einer Zelle (axial). */
const NB: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Ein Stück zwischen zwei Nachbarzellen, ohne Richtung. */
export const segmentKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

const hexDist = (a: DrawCell, b: DrawCell): number => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

export interface HexRoutes {
  /** Jedes Stück genau einmal (die kleinere Zelle zuerst), in der Reihenfolge, in der es gelegt wurde. */
  readonly segments: readonly (readonly [number, number])[];
  /** Je Kante die Zellen ihres Weges, von der ersten zur zweiten (null: kein Weg). */
  readonly paths: readonly (readonly number[] | null)[];
}

/** Ein kleiner Binärheap nach Kosten (bei Gleichstand: was zuerst kam). */
class Heap {
  private readonly keys: number[] = [];
  private readonly vals: number[] = [];
  private readonly seq: number[] = [];
  private n = 0;
  get size(): number { return this.keys.length; }
  push(key: number, val: number): void {
    this.keys.push(key); this.vals.push(val); this.seq.push(this.n++);
    let i = this.keys.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(i, p)) break; this.swap(i, p); i = p; }
  }
  pop(): number | undefined {
    if (this.keys.length === 0) return undefined;
    const top = this.vals[0];
    const lastK = this.keys.pop()!; const lastV = this.vals.pop()!; const lastS = this.seq.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastK; this.vals[0] = lastV; this.seq[0] = lastS;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; const r = l + 1; let m = i;
        if (l < this.keys.length && this.less(l, m)) m = l;
        if (r < this.keys.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private less(a: number, b: number): boolean { return this.keys[a] < this.keys[b] - 1e-12 || (Math.abs(this.keys[a] - this.keys[b]) <= 1e-12 && this.seq[a] < this.seq[b]); }
  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.vals[a], this.vals[b]] = [this.vals[b], this.vals[a]];
    [this.seq[a], this.seq[b]] = [this.seq[b], this.seq[a]];
  }
}

/**
 * DIE WEGE AUF DEM RASTER. `edges`: Paare von Zellen (Indizes in `cells`); `costOf`: was es kostet, eine Zelle zu
 * betreten (mindestens 1 — die eigenen Zellen 1, Boden etwas mehr, fremde Felder viel mehr); ein schon gelegtes Stück
 * kostet nur `reuse` davon. Kurze Kanten zuerst — lange finden dann die gelegten Stücke. Deterministisch.
 */
export function hexRoutes(cells: readonly DrawCell[], edges: readonly (readonly [number, number])[], costOf: (i: number) => number, reuse = 0.5): HexRoutes {
  const at = new Map<string, number>();
  cells.forEach((c, i) => at.set(`${c.q},${c.r}`, i));
  const around = new Map<number, number[]>();
  const neighbours = (i: number): number[] => {
    let out = around.get(i);
    if (out !== undefined) return out;
    out = [];
    const c = cells[i];
    for (const [dq, dr] of NB) { const j = at.get(`${c.q + dq},${c.r + dr}`); if (j !== undefined) out.push(j); }
    around.set(i, out);
    return out;
  };
  const used = new Set<string>();
  const segments: [number, number][] = [];
  const paths: (number[] | null)[] = edges.map(() => null);
  const order = edges.map((_, k) => k).sort((x, y) => hexDist(cells[edges[x][0]], cells[edges[x][1]]) - hexDist(cells[edges[y][0]], cells[edges[y][1]]) || x - y);
  for (const k of order) {
    const [a, b] = edges[k];
    if (a === b) { paths[k] = [a]; continue; }
    const g = new Map<number, number>([[a, 0]]);
    const from = new Map<number, number>();
    const closed = new Set<number>();
    const heap = new Heap();
    heap.push(hexDist(cells[a], cells[b]) * reuse, a);
    let found = false;
    while (heap.size > 0) {
      const x = heap.pop()!;
      if (x === b) { found = true; break; }
      if (closed.has(x)) continue;
      closed.add(x);
      const gx = g.get(x)!;
      for (const y of neighbours(x)) {
        if (closed.has(y)) continue;
        const step = (y === b ? 1 : Math.max(1, costOf(y))) * (used.has(segmentKey(x, y)) ? reuse : 1);
        const gy = gx + step;
        if (gy < (g.get(y) ?? Number.POSITIVE_INFINITY) - 1e-9) {
          g.set(y, gy);
          from.set(y, x);
          heap.push(gy + hexDist(cells[y], cells[b]) * reuse, y);
        }
      }
    }
    if (!found) continue;
    const path = [b];
    for (let x = b; x !== a;) { x = from.get(x)!; path.push(x); }
    path.reverse();
    paths[k] = path;
    for (let i = 1; i < path.length; i += 1) {
      const key = segmentKey(path[i - 1], path[i]);
      if (used.has(key)) continue;
      used.add(key);
      segments.push(path[i - 1] < path[i] ? [path[i - 1], path[i]] : [path[i], path[i - 1]]);
    }
  }
  return { segments, paths };
}

/** Die Kanten eines Graphen zwischen Zellen: jedes Paar einmal (ohne Richtung), ohne Kanten einer Zelle zu sich selbst. */
export function cellEdges(pairs: readonly (readonly [number, number])[]): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const [a, b] of pairs) {
    if (a < 0 || b < 0 || a === b) continue;
    const key = segmentKey(a, b);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([a, b]);
  }
  return out;
}

/* -- Namen und Zeichen ------------------------------------------------------------------------------------------ */

export interface DrawBox {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export interface DrawLabel {
  readonly key: string;
  readonly box: DrawBox;
  /** Kleiner ist wichtiger. */
  readonly rank: number;
  /** Andere Plätze, wenn der eigene belegt ist (der erste freie gilt) — eine Zahl des Weges an einer Ecke ihres Feldes. */
  readonly alts?: readonly DrawBox[];
}

export const boxesOverlap = (a: DrawBox, b: DrawBox, pad = 0): boolean => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

/**
 * WER STEHT: nach Wichtigkeit (bei Gleichstand: in der gegebenen Reihenfolge); was sich mit schon Stehendem (oder mit
 * `taken`) überdeckt, fällt weg. Gibt die stehenden Schlüssel und alle belegten Kästen zurück.
 */
export function placeLabels(items: readonly DrawLabel[], taken: readonly DrawBox[] = [], pad = 0.5): { readonly kept: ReadonlySet<string>; readonly boxes: readonly DrawBox[]; readonly at: ReadonlyMap<string, number> } {
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => a.it.rank - b.it.rank || a.i - b.i);
  const boxes: DrawBox[] = [...taken];
  /* Ein grobes Gitter der Kästen (64 px), damit viele Zeichen schnell geprüft sind. */
  const CELL = 64;
  const grid = new Map<string, number[]>();
  const keysOf = (b: DrawBox): string[] => {
    const out: string[] = [];
    for (let x = Math.floor((b.x0 - pad) / CELL); x <= Math.floor((b.x1 + pad) / CELL); x += 1) for (let y = Math.floor((b.y0 - pad) / CELL); y <= Math.floor((b.y1 + pad) / CELL); y += 1) out.push(`${x},${y}`);
    return out;
  };
  const put = (i: number) => { for (const k of keysOf(boxes[i])) { const l = grid.get(k); if (l === undefined) grid.set(k, [i]); else l.push(i); } };
  boxes.forEach((_, i) => put(i));
  const kept = new Set<string>();
  /* Welcher Platz gilt: 0 der eigene, 1… die anderen der Reihe nach. */
  const at = new Map<string, number>();
  const free = (box: DrawBox): boolean => {
    for (const k of keysOf(box)) for (const j of grid.get(k) ?? []) if (boxesOverlap(boxes[j], box, pad)) return false;
    return true;
  };
  for (const { it } of order) {
    const places = [it.box, ...(it.alts ?? [])];
    const pick = places.findIndex(free);
    if (pick < 0) continue;
    boxes.push(places[pick]);
    put(boxes.length - 1);
    kept.add(it.key);
    at.set(it.key, pick);
  }
  return { kept, boxes, at };
}

/** Welche Schritte eines Weges ihre Zahl tragen (Schritte 1…n, das Ziel n+1): die nächsten drei und das Ziel; die übrigen ein Punkt. */
export const numberedStep = (step: number, steps: number): boolean => step <= 3 || step === steps + 1;
