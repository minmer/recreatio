/**
 * 2026-11-09 — GLEISE: KEINES GEHT DURCH EINE SÄULE (spec §5.4).
 * <code>
 *   ein Gleis   je Paar von Orten mit mindestens einem Abschnitt
 *   Hindernis   jeder Ort als Kreis mit VOLLEM Radius + 11 (auch bei schmaleren Säulen, §4.7)
 *   Gitter      Zellen zu 7; in Hindernissen gesperrt, näher als 22 teurer, schon benutzte etwas billiger (Gleise bündeln)
 *   A*          8 Nachbarn, keine Diagonale durch gesperrte Ecken, von Tor zu Tor (am Rand, zum anderen Ort gewandt; liegt ein
 *               Tor in einem anderen Hindernis, dreht es in Schritten von ±0,3 rad); gesucht wird in einem Fenster um beide
 *               Tore, das nur wächst, wenn es nicht reicht
 *   glätten     Eckpunkte mit freier Sicht (Schritt 3), Catmull–Rom; liegt ein Punkt in einem Hindernis (Toleranz 3), gilt
 *               die Eckenlinie
 *   Prüfung     kein Punkt eines Gleises kommt einer anderen Säule näher als ihr voller Radius + 8 (`clearance`)
 *   kein Weg    eine gerade Linie — rot in der Liste der Autoren (`noRoute`), die Prüfung schlägt fehl
 * </code>
 * Rein (läuft im Worker).
 */

export const MARGIN = 11;
export const CELL = 7;
export const NEAR = 22;
/** Abstand paralleler Linien auf einem Gleis. */
export const LINE_GAP = 5;

export interface Obstacle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Der volle Radius (ohne Rand). */
  readonly r: number;
}

export interface Track {
  readonly a: string;
  readonly b: string;
  /** Die Punkte (x, y, x, y, …): vom Rand von a bis zum Rand von b. */
  readonly points: readonly number[];
  /** Die gerade Ersatzlinie, weil A* keinen Weg fand. */
  readonly straight?: true;
  /** Die Eckenlinie, weil die Glättung ein Hindernis berührte. */
  readonly corners?: true;
}

export interface TrackResult {
  readonly tracks: readonly Track[];
  /** Paare ohne Weg. */
  readonly noRoute: readonly (readonly [string, string])[];
  readonly smoothed: number;
  readonly cornered: number;
}

/** Ein Gitter der Hindernisse für schnelle Abstandsfragen. */
class ObstacleIndex {
  private readonly cells = new Map<string, number[]>();
  readonly size: number;
  constructor(readonly list: readonly Obstacle[]) {
    let maxR = 0;
    for (const o of list) maxR = Math.max(maxR, o.r);
    this.size = Math.max(64, 2 * (maxR + MARGIN + NEAR));
    list.forEach((o, i) => {
      const k = this.key(Math.floor(o.x / this.size), Math.floor(o.y / this.size));
      const l = this.cells.get(k);
      if (l === undefined) this.cells.set(k, [i]); else l.push(i);
    });
  }
  private key(gx: number, gy: number): string { return `${gx},${gy}`; }
  /** Die Hindernisse in der Nähe eines Punktes (im Umkreis `reach`). */
  near(x: number, y: number, reach: number, out: number[]): number[] {
    out.length = 0;
    const g = Math.ceil(reach / this.size);
    const gx = Math.floor(x / this.size), gy = Math.floor(y / this.size);
    for (let oy = -g; oy <= g; oy += 1) for (let ox = -g; ox <= g; ox += 1) {
      const l = this.cells.get(this.key(gx + ox, gy + oy));
      if (l !== undefined) for (const i of l) out.push(i);
    }
    return out;
  }
}

/** Liegt (x, y) frei von allen Hindernissen ausser `skip` (Abstand ≥ r + MARGIN − tol)? */
function clearAt(ix: ObstacleIndex, x: number, y: number, skipA: number, skipB: number, tol: number, buf: number[]): boolean {
  for (const i of ix.near(x, y, MARGIN + 80, buf)) {
    if (i === skipA || i === skipB) continue;
    const o = ix.list[i];
    if (Math.hypot(x - o.x, y - o.y) < o.r + MARGIN - tol) return false;
  }
  return true;
}

/** Ein binärer Haufen über Zahlen (Priorität, Zelle). */
class Heap {
  private pri = new Float64Array(1024);
  private val = new Int32Array(1024);
  size = 0;
  clear() { this.size = 0; }
  push(p: number, v: number) {
    if (this.size === this.pri.length) {
      const np = new Float64Array(this.size * 2); np.set(this.pri); this.pri = np;
      const nv = new Int32Array(this.size * 2); nv.set(this.val); this.val = nv;
    }
    let i = this.size;
    this.size += 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.pri[parent] <= p) break;
      this.pri[i] = this.pri[parent]; this.val[i] = this.val[parent];
      i = parent;
    }
    this.pri[i] = p; this.val[i] = v;
  }
  pop(): number {
    const top = this.val[0];
    this.size -= 1;
    if (this.size > 0) {
      const p = this.pri[this.size], v = this.val[this.size];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = -1;
        if (l < this.size) m = l;
        if (r < this.size && this.pri[r] < this.pri[l]) m = r;
        if (m < 0 || this.pri[m] >= p) break;
        this.pri[i] = this.pri[m]; this.val[i] = this.val[m];
        i = m;
      }
      this.pri[i] = p; this.val[i] = v;
    }
    return top;
  }
}

/** Liegt die ganze Linie (alle 2 Einheiten abgetastet) frei — mindestens voller Radius + 8 von jeder anderen Säule? */
function curveClear(ix: ObstacleIndex, pts: readonly number[], a: number, b: number, buf: number[], extra = 0): boolean {
  for (let k = 0; k < pts.length - 2; k += 2) {
    const dx = pts[k + 2] - pts[k], dy = pts[k + 3] - pts[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    for (let s = 0; s <= n; s += 1) if (!clearAt(ix, pts[k] + (dx * s) / n, pts[k + 1] + (dy * s) / n, a, b, 3 - extra, buf)) return false;
  }
  return true;
}

/** Catmull–Rom durch die Eckpunkte (je Abschnitt `n` Schritte). */
function catmull(w: readonly number[], n = 8): number[] {
  const out: number[] = [];
  const count = w.length / 2;
  const P = (i: number) => { const k = Math.max(0, Math.min(count - 1, i)) * 2; return [w[k], w[k + 1]]; };
  for (let i = 0; i < count - 1; i += 1) {
    const [x0, y0] = P(i - 1); const [x1, y1] = P(i); const [x2, y2] = P(i + 1); const [x3, y3] = P(i + 2);
    for (let s = 0; s < n; s += 1) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      out.push(
        0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3)
      );
    }
  }
  out.push(w[w.length - 2], w[w.length - 1]);
  return out;
}

/** Zwischenpunkte, höchstens alle 8 Einheiten. */
function densify(w: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.length - 2; i += 2) {
    const dx = w[i + 2] - w[i], dy = w[i + 3] - w[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let s = 0; s < n; s += 1) out.push(w[i] + (dx * s) / n, w[i + 1] + (dy * s) / n);
  }
  out.push(w[w.length - 2], w[w.length - 1]);
  return out;
}

/** DIE GLEISE zwischen den Orten (`pairs`: ungerichtete Paare). */
/**
 * Step 3 §2.1 — die halbe Breite eines Bündels (`lanes` Linien auf einem Gleis, LINE_GAP auseinander, dazu die Breite einer
 * Spur): um so viel weiter bleibt ein belebtes Gleis von fremden Säulen weg, damit auch die äusserste versetzte Spur frei ist.
 */
export const bundleHalf = (lanes: number): number => (lanes <= 1 ? 0 : ((lanes - 1) / 2) * LINE_GAP + 1.5);

export function routeTracks(obstacles: readonly Obstacle[], pairs: readonly (readonly [string, string])[], lanesOf?: (a: string, b: string) => number): TrackResult {
  const ix = new ObstacleIndex(obstacles);
  const byId = new Map(obstacles.map((o, i) => [o.id, i] as const));
  const buf: number[] = [];
  /* Das Gitter über der ganzen Welt. */
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of obstacles) { x0 = Math.min(x0, o.x - o.r); y0 = Math.min(y0, o.y - o.r); x1 = Math.max(x1, o.x + o.r); y1 = Math.max(y1, o.y + o.r); }
  if (!Number.isFinite(x0)) return { tracks: [], noRoute: [], smoothed: 0, cornered: 0 };
  x0 -= 120; y0 -= 120; x1 += 120; y1 += 120;
  const W = Math.ceil((x1 - x0) / CELL), H = Math.ceil((y1 - y0) / CELL);
  const N = W * H;
  const blocked = new Uint8Array(N);
  const pen = new Float32Array(N);
  const used = new Uint8Array(N);
  /* Wie weit jede Zelle vor dem Rand + MARGIN der nächsten Säule liegt (für die breiteren Bündel). */
  const free = new Float32Array(N).fill(Infinity);
  obstacles.forEach((o) => {
    const reach = o.r + MARGIN + NEAR;
    const gx0 = Math.max(0, Math.floor((o.x - reach - x0) / CELL)), gx1 = Math.min(W - 1, Math.floor((o.x + reach - x0) / CELL));
    const gy0 = Math.max(0, Math.floor((o.y - reach - y0) / CELL)), gy1 = Math.min(H - 1, Math.floor((o.y + reach - y0) / CELL));
    for (let gy = gy0; gy <= gy1; gy += 1) for (let gx = gx0; gx <= gx1; gx += 1) {
      const cx = x0 + (gx + 0.5) * CELL, cy = y0 + (gy + 0.5) * CELL;
      const d = Math.hypot(cx - o.x, cy - o.y) - (o.r + MARGIN);
      const k = gy * W + gx;
      if (d < free[k]) free[k] = d;
      if (d < 0) blocked[k] = 1;
      else if (d < NEAR) pen[k] = Math.max(pen[k], ((NEAR - d) / NEAR) * 2.2);
    }
  });
  const g = new Float64Array(N);
  const from = new Int32Array(N);
  const seen = new Uint32Array(N);
  const closed = new Uint32Array(N);
  let stamp = 0;
  const heap = new Heap();
  const cellOf = (x: number, y: number) => [Math.max(0, Math.min(W - 1, Math.floor((x - x0) / CELL))), Math.max(0, Math.min(H - 1, Math.floor((y - y0) / CELL)))] as const;

  /** A* in einem Fenster; die Zellen der Pfades (Indizes) oder `null`. */
  const astar = (sx: number, sy: number, tx: number, ty: number, grow: number, extra = 0, ends: readonly Obstacle[] = []): number[] | null => {
    /* Ein breites Bündel: auch Zellen näher als `extra` an einer fremden Säule sind zu (an den eigenen Enden nicht). */
    const tight = (nk: number, ni: number, nj: number): boolean => {
      if (extra <= 0 || free[nk] >= extra) return false;
      const cx = x0 + (ni + 0.5) * CELL, cy = y0 + (nj + 0.5) * CELL;
      return !ends.some((o) => Math.hypot(cx - o.x, cy - o.y) < o.r + MARGIN + extra + CELL * 2);
    };
    const [si, sj] = cellOf(sx, sy);
    const [ti, tj] = cellOf(tx, ty);
    const pad = Math.ceil(grow / CELL);
    const wx0 = Math.max(0, Math.min(si, ti) - pad), wx1 = Math.min(W - 1, Math.max(si, ti) + pad);
    const wy0 = Math.max(0, Math.min(sj, tj) - pad), wy1 = Math.min(H - 1, Math.max(sj, tj) + pad);
    stamp += 1;
    heap.clear();
    const s = sj * W + si, t = tj * W + ti;
    const h = (i: number, j: number) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    g[s] = 0; from[s] = -1; seen[s] = stamp;
    heap.push(h(si, sj), s);
    while (heap.size > 0) {
      const k = heap.pop();
      if (closed[k] === stamp) continue;
      closed[k] = stamp;
      if (k === t) break;
      const i = k % W, j = (k - i) / W;
      for (let dj = -1; dj <= 1; dj += 1) for (let di = -1; di <= 1; di += 1) {
        if (di === 0 && dj === 0) continue;
        const ni = i + di, nj = j + dj;
        if (ni < wx0 || nj < wy0 || ni > wx1 || nj > wy1) continue;
        const nk = nj * W + ni;
        if (closed[nk] === stamp) continue;
        if ((blocked[nk] === 1 || tight(nk, ni, nj)) && nk !== t) continue;
        if (di !== 0 && dj !== 0 && (blocked[j * W + ni] === 1 || blocked[nj * W + i] === 1)) continue;
        const c = (di !== 0 && dj !== 0 ? Math.SQRT2 : 1) * (1 + pen[nk] + (used[nk] === 1 ? -0.15 : 0));
        const ng = g[k] + c;
        if (seen[nk] !== stamp || ng < g[nk]) { g[nk] = ng; from[nk] = k; seen[nk] = stamp; heap.push(ng + h(ni, nj), nk); }
      }
    }
    if (closed[t] !== stamp) return null;
    const path: number[] = [];
    for (let k = t; k >= 0; k = k === s ? -1 : from[k]) path.push(k);
    return path.reverse();
  };

  /** Ein Tor am Rand von a, zum Punkt (tx, ty) gewandt, frei von anderen Hindernissen. */
  const gate = (a: number, tx: number, ty: number, other: number): { x: number; y: number; angle: number } => {
    const o = obstacles[a];
    const base = Math.atan2(ty - o.y, tx - o.x);
    for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]) {
      const angle = base + da;
      const x = o.x + Math.cos(angle) * (o.r + MARGIN + 3), y = o.y + Math.sin(angle) * (o.r + MARGIN + 3);
      if (clearAt(ix, x, y, a, other, 0, buf)) return { x, y, angle };
    }
    return { x: o.x + Math.cos(base) * (o.r + MARGIN + 3), y: o.y + Math.sin(base) * (o.r + MARGIN + 3), angle: base };
  };
  const sight = (ax: number, ay: number, bx: number, by: number, a: number, b: number, extra = 0): boolean => {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.ceil(d / 3));
    for (let i = 0; i <= n; i += 1) { const t = i / n; if (!clearAt(ix, ax + (bx - ax) * t, ay + (by - ay) * t, a, b, 1 - extra, buf)) return false; }
    return true;
  };

  /* Die kürzesten zuerst: sie bündeln, die langen folgen den benutzten Zellen. */
  const list: [number, number, number][] = [];
  const seenPairs = new Set<string>();
  for (const [pa, pb] of pairs) {
    const a = byId.get(pa), b = byId.get(pb);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const [p, q] = obstacles[a].id < obstacles[b].id ? [a, b] : [b, a];
    list.push([p, q, Math.hypot(obstacles[p].x - obstacles[q].x, obstacles[p].y - obstacles[q].y)]);
  }
  list.sort((u, v) => u[2] - v[2] || (obstacles[u[0]].id < obstacles[v[0]].id ? -1 : 1));

  const tracks: Track[] = [];
  const noRoute: [string, string][] = [];
  let smoothed = 0;
  let cornered = 0;
  for (const [a, b, dist] of list) {
    const A = obstacles[a], B = obstacles[b];
    const extra = bundleHalf(lanesOf?.(A.id, B.id) ?? 1);
    const ga = gate(a, B.x, B.y, b);
    const gb = gate(b, A.x, A.y, a);
    let path: number[] | null = null;
    for (const grow of [Math.max(60, dist * 0.35), Math.max(160, dist * 0.8), Math.max(W, H) * CELL]) {
      path = astar(ga.x, ga.y, gb.x, gb.y, grow, extra, [A, B]) ?? (extra > 0 ? astar(ga.x, ga.y, gb.x, gb.y, grow) : null);
      if (path !== null) break;
    }
    const rimA = [A.x + Math.cos(ga.angle) * A.r, A.y + Math.sin(ga.angle) * A.r];
    const rimB = [B.x + Math.cos(gb.angle) * B.r, B.y + Math.sin(gb.angle) * B.r];
    if (path === null) {
      noRoute.push([A.id, B.id]);
      tracks.push({ a: A.id, b: B.id, points: [...rimA, ga.x, ga.y, gb.x, gb.y, ...rimB], straight: true });
      continue;
    }
    for (const k of path) used[k] = 1;
    const raw: number[] = [ga.x, ga.y];
    for (let i = 1; i < path.length - 1; i += 1) { const k = path[i]; const ci = k % W, cj = (k - ci) / W; raw.push(x0 + (ci + 0.5) * CELL, y0 + (cj + 0.5) * CELL); }
    raw.push(gb.x, gb.y);
    /* Eckpunkte mit freier Sicht. */
    const corners: number[] = [raw[0], raw[1]];
    const count = raw.length / 2;
    let i = 0;
    while (i < count - 1) {
      let j = count - 1;
      while (j > i + 1 && !sight(raw[i * 2], raw[i * 2 + 1], raw[j * 2], raw[j * 2 + 1], a, b, extra)) j -= 1;
      corners.push(raw[j * 2], raw[j * 2 + 1]);
      i = j;
    }
    let pts = catmull(corners);
    /* Geprüft wie in der Pflichtprüfung: alle 2 Einheiten, mindestens voller Radius + 8 (MARGIN − 3). */
    const ok = curveClear(ix, pts, a, b, buf, extra);
    if (ok) smoothed += 1;
    else { pts = densify(corners); cornered += 1; }
    tracks.push({ a: A.id, b: B.id, points: [...rimA, ...pts, ...rimB], ...(ok ? {} : { corners: true as const }) });
  }
  return { tracks, noRoute, smoothed, cornered };
}

/**
 * DIE PFLICHTPRÜFUNG (§5.4.8): kein Punkt eines Gleises (alle 2 Einheiten abgetastet) näher an einer anderen Säule als ihr
 * voller Radius + `tol`. Die Verstösse (leer: grün).
 */
export function clearance(obstacles: readonly Obstacle[], tracks: readonly Track[], tol = 8): { readonly track: string; readonly near: string; readonly distance: number }[] {
  const ix = new ObstacleIndex(obstacles);
  const buf: number[] = [];
  const out: { track: string; near: string; distance: number }[] = [];
  for (const t of tracks) {
    if (t.straight === true) continue;
    const p = t.points;
    let worst: { near: string; distance: number } | null = null;
    for (let k = 0; k < p.length - 2; k += 2) {
      const dx = p[k + 2] - p[k], dy = p[k + 3] - p[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
      for (let s = 0; s <= n; s += 1) {
        const x = p[k] + (dx * s) / n, y = p[k + 1] + (dy * s) / n;
        for (const i of ix.near(x, y, MARGIN + 80, buf)) {
          const o = obstacles[i];
          if (o.id === t.a || o.id === t.b) continue;
          const d = Math.hypot(x - o.x, y - o.y) - o.r;
          if (d < tol && (worst === null || d < worst.distance)) worst = { near: o.id, distance: Math.round(d * 10) / 10 };
        }
      }
    }
    if (worst !== null) out.push({ track: `${t.a}|${t.b}`, ...worst });
  }
  return out;
}

/** Parallele Linien: die Punkte um `off` senkrecht versetzt. */
export function offsetPoints(points: readonly number[], off: number): number[] {
  const out: number[] = [];
  const n = points.length / 2;
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - 1) * 2, b = Math.min(n - 1, i + 1) * 2;
    const dx = points[b] - points[a], dy = points[b + 1] - points[a + 1];
    const l = Math.hypot(dx, dy) || 1;
    out.push(points[i * 2] - (dy / l) * off, points[i * 2 + 1] + (dx / l) * off);
  }
  return out;
}

/** Wo eine Linie auf einem Gleis fährt: ihr Platz in der festen Reihenfolge der Linien dieses Gleises. */
export const laneOffset = (lane: number, lanes: number): number => (lane - (lanes - 1) / 2) * LINE_GAP;
