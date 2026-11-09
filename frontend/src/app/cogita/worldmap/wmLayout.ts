/**
 * 2026-11-09 — DIE LAGE DER ORTE (spec §5.3): nur aus den Verbindungen, deterministisch (dieselben Daten, dieselbe Karte).
 * <code>
 *   Anfang     gespeicherte Lage, wo es sie gibt; ein neuer Ort neben seinen schon gesetzten Nachbarn (Winkel aus dem Hash
 *              seiner Kennung); ohne Nachbarn am Rand bei Orten derselben Farbe
 *   Kräfte     Federn längs jedes Gleises (Ruhelänge 3,4 R, Stärke 0,05), längs jeder Voraussetzung ohne Gleis (5 R, 0,01),
 *              Abstossung zwischen allen Orten mit hartem Mindestabstand r_a + r_b + 2,1 R; ab 500 Orten Barnes–Hut
 *   Stabil     mit gespeicherter Lage bleiben alte Orte stehen, nur neue suchen ihren Platz; ganz neu nur auf Befehl
 *   Block      die Lage nimmt die äussere Scheibe; innen stehen die Teile dicht gepackt und berühren einander
 * </code>
 * Rein, ohne DOM und ohne Texte (läuft im Worker, `wmGeometry.worker.ts`).
 */

/** Der volle Radius einer Säule (Welteinheiten). */
export const R = 28;
/** Die grösste Kraft einer Feder je Schritt. */
const SPRING_CAP = 3;
/** Was zwischen zwei Rändern mindestens frei bleibt. */
export const GAP = 2.1 * R;
export const HOME_R = 0.85 * R;

export interface LayoutNode {
  readonly id: string;
  /** Der volle Radius (eine Säule R, ein Block seine Scheibe, das Haus 0,85 R). */
  readonly r: number;
  /** Die Farbe (eine Gruppe): Orte ohne Verbindung stehen am Rand bei ihresgleichen. */
  readonly color?: string;
}

export interface LayoutInput {
  readonly nodes: readonly LayoutNode[];
  /** Paare mit mindestens einem Abschnitt (ungerichtet). */
  readonly tracks: readonly (readonly [string, string])[];
  /** Voraussetzungen (Grundlage → Aufbau). */
  readonly prereqs: readonly (readonly [string, string])[];
  /** Die gespeicherte Lage. */
  readonly previous?: Readonly<Record<string, readonly [number, number]>>;
  /** `full`: alles neu (nur auf Befehl); sonst bleiben gespeicherte Orte stehen. */
  readonly mode?: 'stable' | 'full';
}

export interface LayoutResult {
  readonly positions: Map<string, [number, number]>;
  /** Die Orte, die neu gesetzt wurden. */
  readonly placed: readonly string[];
  readonly iterations: number;
  /** Was nach dem letzten Durchgang am harten Abstand noch fehlte (0: nichts). */
  readonly residual: number;
}

/** FNV-1a → [0, 1). */
export function hash01(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 4294967296;
}

/* -- Blöcke: Teile dicht gepackt ------------------------------------------------------------------------------------------ */

/** Mittelpunkte von `k` gleichen Kreisen (Radius `r`), die einander berühren, um (0, 0); dazu der Radius der Scheibe. */
export function packParts(k: number, r: number): { readonly offsets: readonly (readonly [number, number])[]; readonly disc: number } {
  if (k <= 0) return { offsets: [], disc: r };
  if (k === 1) return { offsets: [[0, 0]], disc: r * 1.25 };
  let offsets: [number, number][];
  if (k <= 6) {
    const rho = r / Math.sin(Math.PI / k);
    offsets = Array.from({ length: k }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / k; return [rho * Math.cos(a), rho * Math.sin(a)] as [number, number]; });
  } else {
    /* Dichteste Packung: Gitterplätze nach Abstand zur Mitte. */
    const spots: [number, number][] = [];
    const n = Math.ceil(Math.sqrt(k)) + 2;
    for (let j = -n; j <= n; j += 1) for (let i = -n; i <= n; i += 1) spots.push([2 * r * (i + (j & 1) / 2), 2 * r * j * Math.sqrt(3) / 2]);
    spots.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2) || a[1] - b[1] || a[0] - b[0]);
    offsets = spots.slice(0, k);
  }
  const disc = Math.max(...offsets.map(([x, y]) => Math.hypot(x, y))) + r * 1.15;
  return { offsets, disc };
}

/* -- Barnes–Hut ------------------------------------------------------------------------------------------------------------- */

interface Quad { x0: number; y0: number; size: number; mass: number; cx: number; cy: number; body: number; kids: (Quad | null)[] | null }

function buildQuad(xs: Float64Array, ys: Float64Array, n: number): Quad {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i += 1) { x0 = Math.min(x0, xs[i]); y0 = Math.min(y0, ys[i]); x1 = Math.max(x1, xs[i]); y1 = Math.max(y1, ys[i]); }
  const size = Math.max(x1 - x0, y1 - y0, 1) * 1.001;
  const root: Quad = { x0, y0, size, mass: 0, cx: 0, cy: 0, body: -1, kids: null };
  const insert = (q: Quad, i: number, depth: number) => {
    let node = q;
    let d = depth;
    for (;;) {
      node.cx = (node.cx * node.mass + xs[i]) / (node.mass + 1);
      node.cy = (node.cy * node.mass + ys[i]) / (node.mass + 1);
      node.mass += 1;
      if (node.kids === null) {
        if (node.body < 0 && node.mass === 1) { node.body = i; return; }
        if (d > 40) return;
        node.kids = [null, null, null, null];
        const old = node.body;
        node.body = -1;
        if (old >= 0) {
          const h = node.size / 2;
          const qi = (xs[old] >= node.x0 + h ? 1 : 0) + (ys[old] >= node.y0 + h ? 2 : 0);
          const kid: Quad = { x0: node.x0 + (qi & 1 ? h : 0), y0: node.y0 + (qi & 2 ? h : 0), size: h, mass: 1, cx: xs[old], cy: ys[old], body: old, kids: null };
          node.kids[qi] = kid;
        }
      }
      const h = node.size / 2;
      const qi = (xs[i] >= node.x0 + h ? 1 : 0) + (ys[i] >= node.y0 + h ? 2 : 0);
      let kid = node.kids[qi];
      if (kid === null) { kid = { x0: node.x0 + (qi & 1 ? h : 0), y0: node.y0 + (qi & 2 ? h : 0), size: h, mass: 0, cx: 0, cy: 0, body: -1, kids: null }; node.kids[qi] = kid; }
      node = kid;
      d += 1;
    }
  };
  for (let i = 0; i < n; i += 1) insert(root, i, 0);
  return root;
}

/* -- Die Lage ---------------------------------------------------------------------------------------------------------------- */

export function layout(input: LayoutInput): LayoutResult {
  const nodes = input.nodes.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = nodes.length;
  const index = new Map(nodes.map((nd, i) => [nd.id, i] as const));
  const rad = Float64Array.from(nodes, (nd) => nd.r);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const fixed = new Uint8Array(n);
  const has = new Uint8Array(n);
  const stable = input.mode !== 'full';
  if (stable && input.previous !== undefined) {
    for (let i = 0; i < n; i += 1) {
      const p = input.previous[nodes[i].id];
      if (p !== undefined && Number.isFinite(p[0]) && Number.isFinite(p[1])) { xs[i] = p[0]; ys[i] = p[1]; fixed[i] = 1; has[i] = 1; }
    }
  }
  /* Kanten nach Indizes. */
  const trackSet = new Set<string>();
  const tracks: [number, number][] = [];
  for (const [a, b] of input.tracks) {
    const i = index.get(a); const j = index.get(b);
    if (i === undefined || j === undefined || i === j) continue;
    const k = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (trackSet.has(k)) continue;
    trackSet.add(k);
    tracks.push([i, j]);
  }
  const prereqs: [number, number][] = [];
  const prSet = new Set<string>();
  for (const [a, b] of input.prereqs) {
    const i = index.get(a); const j = index.get(b);
    if (i === undefined || j === undefined || i === j) continue;
    const k = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (trackSet.has(k) || prSet.has(k)) continue;
    prSet.add(k);
    prereqs.push([i, j]);
  }
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (const [i, j] of [...tracks, ...prereqs]) { nb[i].push(j); nb[j].push(i); }
  const lonely = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) if (nb[i].length === 0) lonely[i] = 1;

  /* -- Anfang: neben gesetzten Nachbarn, sonst ein Ring --------------------------------------------------------------------- */
  const placed: string[] = [];
  const angleOf = (i: number) => hash01(nodes[i].id) * Math.PI * 2;
  let maxR = 0;
  for (let i = 0; i < n; i += 1) maxR = Math.max(maxR, rad[i]);
  const cellSize = 2 * maxR + GAP;
  const occupied = new Map<string, number[]>();
  const cellKey = (x: number, y: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const occupy = (i: number) => { const k = cellKey(xs[i], ys[i]); const l = occupied.get(k); if (l === undefined) occupied.set(k, [i]); else l.push(i); };
  for (let i = 0; i < n; i += 1) if (has[i] === 1) occupy(i);
  const free = (i: number, x: number, y: number): boolean => {
    const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
    for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
      for (const j of occupied.get(`${gx + ox},${gy + oy}`) ?? []) if (Math.hypot(xs[j] - x, ys[j] - y) < rad[i] + rad[j] + GAP + 0.5) return false;
    }
    return true;
  };
  const put = (i: number, x: number, y: number) => { xs[i] = x; ys[i] = y; has[i] = 1; placed.push(nodes[i].id); occupy(i); };
  /** Der nächste freie Platz um (cx, cy), zuerst in Richtung `a`, im Abstand `d` und weiter draussen. */
  const nearestFree = (i: number, cx: number, cy: number, a: number, d: number): [number, number] => {
    for (let ring = 0; ring < 60; ring += 1) {
      const dist = d + ring * 0.5 * R;
      const steps = 12 + ring * 2;
      for (let k = 0; k < steps; k += 1) {
        const turn = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * ((2 * Math.PI) / steps);
        const x = cx + Math.cos(a + turn) * dist, y = cy + Math.sin(a + turn) * dist;
        if (free(i, x, y)) return [x, y];
      }
    }
    return [cx + Math.cos(a) * (d + 30 * R), cy + Math.sin(a) * (d + 30 * R)];
  };
  if (![...has].some((h) => h === 1)) {
    /* Der Anfang: das Haus, sonst der Ort mit den meisten Verbindungen. */
    let first = index.get('~home') ?? -1;
    if (first < 0) { let best = -1; for (let i = 0; i < n; i += 1) if (lonely[i] === 0 && (best < 0 || nb[i].length > nb[best].length)) best = i; first = best; }
    if (first >= 0) put(first, 0, 0);
  }
  for (let round = 0; round < n + 2; round += 1) {
    const wave: number[] = [];
    for (let i = 0; i < n; i += 1) if (has[i] === 0 && lonely[i] === 0 && nb[i].some((j) => has[j] === 1)) wave.push(i);
    if (wave.length === 0) {
      /* Ein Teil der Welt ohne Verbindung zum Gesetzten: sein erster Ort auf einen Ring draussen. */
      let next = -1;
      for (let i = 0; i < n; i += 1) if (has[i] === 0 && lonely[i] === 0) { next = i; break; }
      if (next < 0) break;
      const ext = extent(xs, ys, rad, has, n);
      const a = angleOf(next);
      const [x, y] = nearestFree(next, ext.cx, ext.cy, a, ext.radius + 4 * R);
      put(next, x, y);
      continue;
    }
    for (const i of wave) {
      let sx = 0, sy = 0, c = 0;
      for (const j of nb[i]) if (has[j] === 1) { sx += xs[j]; sy += ys[j]; c += 1; }
      const [x, y] = nearestFree(i, sx / c, sy / c, angleOf(i), 3.4 * R + rad[i]);
      put(i, x, y);
    }
  }

  /* -- Kräfte -------------------------------------------------------------------------------------------------------------------- */
  const moving: number[] = [];
  for (let i = 0; i < n; i += 1) if (fixed[i] === 0 && lonely[i] === 0) moving.push(i);
  const iterations = moving.length === 0 ? 0 : fixed.some((f) => f === 1) ? 160 : n > 2000 ? 160 : n > 500 ? 240 : 400;
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  const KREP = R * R * 60;
  const active = (i: number) => lonely[i] === 0 && has[i] === 1;
  const idx: number[] = [];
  for (let i = 0; i < n; i += 1) if (active(i)) idx.push(i);
  const m = idx.length;
  const ax = new Float64Array(m);
  const ay = new Float64Array(m);
  function project(relax: number, slack: number): number {
    let worst = 0;
    collide(xs, ys, rad, idx, (i, j, push, ux, uy) => {
      const fi = fixed[i] === 1, fj = fixed[j] === 1;
      if (fi && fj) return;
      worst = Math.max(worst, push - slack);
      const share = fi || fj ? 1 : 0.5;
      const k = push * share * relax;
      if (!fi) { xs[i] -= ux * k; ys[i] -= uy * k; }
      if (!fj) { xs[j] += ux * k; ys[j] += uy * k; }
    }, 1, slack);
    return worst;
  }
  for (let it = 0; it < iterations; it += 1) {
    const cool = 1 - it / (iterations * 1.075);
    fx.fill(0); fy.fill(0);
    for (let k = 0; k < m; k += 1) { ax[k] = xs[idx[k]]; ay[k] = ys[idx[k]]; }
    if (m < 500) {
      for (let a = 0; a < m; a += 1) {
        const i = idx[a];
        for (let b = a + 1; b < m; b += 1) {
          const j = idx[b];
          let dx = xs[j] - xs[i], dy = ys[j] - ys[i];
          let d = Math.hypot(dx, dy);
          if (d < 0.01) { dx = Math.cos(a + b); dy = Math.sin(a + b); d = 0.01; }
          const f = KREP / (d * d);
          dx /= d; dy /= d;
          fx[i] -= dx * f; fy[i] -= dy * f; fx[j] += dx * f; fy[j] += dy * f;
        }
      }
    } else {
      /* Barnes–Hut für die Fernwirkung, ein Gitter für den harten Abstand. */
      const root = buildQuad(ax, ay, m);
      const theta2 = 0.9 * 0.9;
      const stack: Quad[] = [];
      for (let a = 0; a < m; a += 1) {
        const i = idx[a];
        stack.length = 0;
        stack.push(root);
        while (stack.length > 0) {
          const q = stack.pop()!;
          if (q.mass === 0 || q.body === a) continue;
          const dx = q.cx - xs[i], dy = q.cy - ys[i];
          const d2 = dx * dx + dy * dy + 0.01;
          if (q.kids === null || (q.size * q.size) / d2 < theta2) {
            const d = Math.sqrt(d2);
            const f = (KREP * q.mass) / d2;
            fx[i] -= (dx / d) * f; fy[i] -= (dy / d) * f;
          } else for (const kid of q.kids) if (kid !== null) stack.push(kid);
        }
      }
    }
    const spring = (i: number, j: number, rest: number, k: number) => {
      let dx = xs[j] - xs[i], dy = ys[j] - ys[i];
      const d = Math.hypot(dx, dy) || 0.01;
      const f = Math.max(-SPRING_CAP, Math.min(SPRING_CAP, (d - (rest + rad[i] + rad[j] - 2 * R)) * k));
      dx /= d; dy /= d;
      fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f;
    };
    for (const [i, j] of tracks) spring(i, j, 3.4 * R, 0.05);
    for (const [i, j] of prereqs) spring(i, j, 5 * R, 0.01);
    for (const i of moving) {
      if (!active(i)) continue;
      let dx = fx[i] * cool, dy = fy[i] * cool;
      const step = Math.hypot(dx, dy);
      if (step > R) { dx *= R / step; dy *= R / step; }
      xs[i] = (xs[i] + dx) * 0.9985;
      ys[i] = (ys[i] + dy) * 0.9985;
    }
    project(1, 0.6);
  }

  /* -- Am Ende: kein Paar näher als r_a + r_b + 2,1 R (feste Orte bleiben stehen) -------------------------------------------- */
  let residual = 0;
  const anyFixed = fixed.some((f) => f === 1);
  for (let round = 0; round < 8; round += 1) {
    for (let pass = 0; pass < 120; pass += 1) {
      residual = project(1, 0.6);
      if (residual <= 0) break;
    }
    if (residual <= 0 || anyFixed) break;
    let cx = 0, cy = 0;
    for (const i of idx) { cx += xs[i]; cy += ys[i]; }
    cx /= Math.max(1, idx.length); cy /= Math.max(1, idx.length);
    const grow = 1 + Math.min(0.35, residual / (2 * R + GAP));
    for (const i of idx) { xs[i] = cx + (xs[i] - cx) * grow; ys[i] = cy + (ys[i] - cy) * grow; }
  }
  if (anyFixed) for (let pass = 0; pass < 200 && residual > 0; pass += 1) residual = project(1, 0.6);
  /*
   * Was dann noch zu nah steht (ein neuer Ort, von Federn zwischen feste gezogen, die nicht weichen): an den nächsten freien
   * Platz um seine jetzige Stelle — so berührt keine Säule eine andere, und keine alte bewegt sich.
   */
  if (residual > 0) {
    occupied.clear();
    for (let i = 0; i < n; i += 1) if (has[i] === 1) occupy(i);
    const unoccupy = (i: number) => { const l = occupied.get(cellKey(xs[i], ys[i])); if (l !== undefined) { const at = l.indexOf(i); if (at >= 0) l.splice(at, 1); } };
    const crowded = (i: number) => {
      const gx = Math.floor(xs[i] / cellSize), gy = Math.floor(ys[i] / cellSize);
      for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
        for (const j of occupied.get(`${gx + ox},${gy + oy}`) ?? []) if (j !== i && Math.hypot(xs[j] - xs[i], ys[j] - ys[i]) < rad[i] + rad[j] + GAP - 0.01) return true;
      }
      return false;
    };
    for (const i of moving) {
      if (!crowded(i)) continue;
      unoccupy(i);
      const [x, y] = nearestFree(i, xs[i], ys[i], angleOf(i), 0);
      xs[i] = x; ys[i] = y;
      occupy(i);
    }
    residual = 0;
  }

  /* -- Orte ohne Verbindung: am Rand, bei Orten derselben Farbe ------------------------------------------------------------- */
  const lonelyList = nodes.map((_, i) => i).filter((i) => lonely[i] === 1 && has[i] === 0);
  if (lonelyList.length > 0) {
    const ext = extent(xs, ys, rad, has, n);
    const byColor = new Map<string, { x: number; y: number; c: number }>();
    for (let i = 0; i < n; i += 1) {
      if (has[i] === 0 || lonely[i] === 1) continue;
      const key = nodes[i].color ?? '';
      const g = byColor.get(key) ?? { x: 0, y: 0, c: 0 };
      g.x += xs[i]; g.y += ys[i]; g.c += 1;
      byColor.set(key, g);
    }
    let ring = 0;
    for (const i of lonelyList) {
      const g = byColor.get(nodes[i].color ?? '');
      const base = g === undefined || g.c === 0 ? angleOf(i) : Math.atan2(g.y / g.c - ext.cy, g.x / g.c - ext.cx);
      for (let tries = 0; tries < 400; tries += 1) {
        const a = base + ((tries % 2 === 0 ? 1 : -1) * Math.ceil(tries / 2) * 0.18);
        const d = ext.radius + rad[i] + GAP + Math.floor(tries / 24) * (2 * R + GAP) + (ring % 3) * 0.3 * R;
        const x = ext.cx + Math.cos(a) * d, y = ext.cy + Math.sin(a) * d;
        let ok = true;
        for (let j = 0; j < n && ok; j += 1) if (has[j] === 1 && Math.hypot(xs[j] - x, ys[j] - y) < rad[i] + rad[j] + GAP) ok = false;
        if (ok) { put(i, x, y); break; }
      }
      if (has[i] === 0) put(i, ext.cx + Math.cos(base) * (ext.radius + 6 * R), ext.cy + Math.sin(base) * (ext.radius + 6 * R));
      ring += 1;
    }
  }

  const positions = new Map<string, [number, number]>();
  for (let i = 0; i < n; i += 1) positions.set(nodes[i].id, fixed[i] === 1 ? [xs[i], ys[i]] : [Math.round(xs[i] * 10) / 10, Math.round(ys[i] * 10) / 10]);
  return { positions, placed, iterations, residual: Math.max(0, residual) };
}

/** Mitte und Halbmesser des Gesetzten. */
function extent(xs: Float64Array, ys: Float64Array, rad: Float64Array, has: Uint8Array, n: number): { cx: number; cy: number; radius: number } {
  let sx = 0, sy = 0, c = 0;
  for (let i = 0; i < n; i += 1) if (has[i] === 1) { sx += xs[i]; sy += ys[i]; c += 1; }
  if (c === 0) return { cx: 0, cy: 0, radius: 0 };
  const cx = sx / c, cy = sy / c;
  let radius = 0;
  for (let i = 0; i < n; i += 1) if (has[i] === 1) radius = Math.max(radius, Math.hypot(xs[i] - cx, ys[i] - cy) + rad[i]);
  return { cx, cy, radius };
}

/** Jedes Paar näher als r_a + r_b + 2,1 R (über ein Gitter): `push` = wie viel fehlt, (ux, uy) von i nach j. */
function collide(xs: Float64Array, ys: Float64Array, rad: Float64Array, idx: readonly number[], hit: (i: number, j: number, push: number, ux: number, uy: number) => void, factor: number, slack = 0): void {
  let maxR = 0;
  for (const i of idx) maxR = Math.max(maxR, rad[i]);
  const cell = 2 * maxR + GAP + slack;
  const grid = new Map<number, number[]>();
  const keyOf = (gx: number, gy: number) => gx * 1048576 + gy;
  for (const i of idx) {
    const k = keyOf(Math.floor(xs[i] / cell), Math.floor(ys[i] / cell));
    const l = grid.get(k);
    if (l === undefined) grid.set(k, [i]); else l.push(i);
  }
  for (const i of idx) {
    const gx = Math.floor(xs[i] / cell), gy = Math.floor(ys[i] / cell);
    for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
      const l = grid.get(keyOf(gx + ox, gy + oy));
      if (l === undefined) continue;
      for (const j of l) {
        if (j <= i) continue;
        let dx = xs[j] - xs[i], dy = ys[j] - ys[i];
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = Math.cos(i * 7 + j); dy = Math.sin(i * 7 + j); d = 0.01; }
        const min = rad[i] + rad[j] + GAP + slack;
        if (d >= min) continue;
        hit(i, j, (min - d) * factor, dx / d, dy / d);
      }
    }
  }
}
