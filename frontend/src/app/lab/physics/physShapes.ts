/**
 * 2026-10-18 — DIE FORMEN DER KÖRPER (Fizyka 2D): Kreis und konvexes
 * Vieleck (ein Kasten ist eines mit vier Ecken). Die Ecken stehen um den
 * Schwerpunkt — so dreht sich ein Körper um den Punkt, um den er sich auch in
 * Wirklichkeit dreht, und Masse, Schwerpunkt und Trägheitsmoment kommen aus
 * der Form (Dichte × Fläche × Tiefe der Szene).
 *
 * Ein Vieleck, das nicht konvex ist, wird zu seiner konvexen Hülle — so
 * bleibt die Kollision einfach und sicher; was hohl sein soll (ein Behälter),
 * setzt sich aus mehreren Körpern zusammen.
 */

export interface CircleShape {
  readonly kind: 'circle';
  readonly r: number;
}

export interface PolyShape {
  readonly kind: 'poly';
  /** Ecken um den Schwerpunkt, gegen den Uhrzeigersinn. */
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Aussennormalen der Kanten (Kante i: Ecke i → Ecke i+1). */
  readonly nx: Float64Array;
  readonly ny: Float64Array;
  readonly n: number;
  /** Der grösste Abstand einer Ecke vom Schwerpunkt. */
  readonly radius: number;
}

export type Shape = CircleShape | PolyShape;

export type Pt = readonly [number, number];

/** Die konvexe Hülle (Andrew) — gegen den Uhrzeigersinn, ohne doppelte und gerade Ecken. */
export function hull(points: readonly Pt[]): Pt[] {
  const pts = [...points].filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Ein Vieleck aus Punkten (in seinen eigenen Koordinaten): die Form um den Schwerpunkt, und wo der Schwerpunkt liegt. */
export function polyOf(points: readonly Pt[]): { shape: PolyShape; cx: number; cy: number; area: number; inertia: number } | null {
  const h = hull(points).slice(0, 16);
  if (h.length < 3) return null;
  /* Fläche und Schwerpunkt (Dreiecksfächer). */
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < h.length; i += 1) {
    const [x1, y1] = h[i];
    const [x2, y2] = h[(i + 1) % h.length];
    const c = x1 * y2 - x2 * y1;
    area += c / 2;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  if (area < 1e-9) return null;
  cx /= 6 * area;
  cy /= 6 * area;
  const n = h.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i += 1) { xs[i] = h[i][0] - cx; ys[i] = h[i][1] - cy; }
  /* Das Flächenträgheitsmoment um den Schwerpunkt (je Flächeneinheit Dichte). */
  let inertia = 0;
  for (let i = 0; i < n; i += 1) {
    const x1 = xs[i]; const y1 = ys[i];
    const x2 = xs[(i + 1) % n]; const y2 = ys[(i + 1) % n];
    const c = x1 * y2 - x2 * y1;
    inertia += c * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2);
  }
  inertia /= 12;
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  let radius = 0;
  for (let i = 0; i < n; i += 1) {
    const ex = xs[(i + 1) % n] - xs[i];
    const ey = ys[(i + 1) % n] - ys[i];
    const len = Math.hypot(ex, ey) || 1;
    nx[i] = ey / len;
    ny[i] = -ex / len;
    radius = Math.max(radius, Math.hypot(xs[i], ys[i]));
  }
  return { shape: { kind: 'poly', xs, ys, nx, ny, n, radius }, cx, cy, area, inertia };
}

/** Ein Kasten w × h um seine Mitte. */
export const boxPoints = (w: number, h: number): Pt[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

/** Fläche und Flächenträgheitsmoment (je Dichte) einer Form. */
export function areaOf(shape: Shape): { area: number; inertia: number } {
  if (shape.kind === 'circle') return { area: Math.PI * shape.r * shape.r, inertia: (Math.PI * shape.r ** 4) / 2 };
  const p = polyOf([...shape.xs].map((x, i) => [x, shape.ys[i]] as const));
  return p === null ? { area: 0, inertia: 0 } : { area: p.area, inertia: p.inertia };
}

/**
 * DER TEIL EINER FORM UNTER EINER WAAGRECHTEN LINIE (eingetaucht): Fläche
 * und Schwerpunkt, in Welt-Koordinaten — für den Auftrieb. `wx`, `wy`: die
 * Ecken eines Vielecks in der Welt; ein Kreis: Mitte und Radius.
 */
export function circleBelow(cx: number, cy: number, r: number, level: number): { area: number; x: number; y: number } {
  const d = level - cy;
  if (d <= -r) return { area: 0, x: cx, y: cy };
  if (d >= r) return { area: Math.PI * r * r, x: cx, y: cy };
  /* Ein Kreisabschnitt unter der Linie in Höhe d über der Mitte. */
  const h = r + d;
  const theta = 2 * Math.acos((r - h) / r);
  const area = (r * r / 2) * (theta - Math.sin(theta));
  const s = Math.sin(theta / 2);
  const yc = area < 1e-12 ? -r : -(4 * r * s * s * s) / (3 * (theta - Math.sin(theta)));
  return { area, x: cx, y: cy + yc };
}

export function polyBelow(wx: Float64Array, wy: Float64Array, n: number, level: number): { area: number; x: number; y: number } {
  /* Sutherland–Hodgman gegen die Halbebene y ≤ level, dann Fläche und Schwerpunkt. */
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const ax = wx[i]; const ay = wy[i];
    const bx = wx[(i + 1) % n]; const by = wy[(i + 1) % n];
    const ain = ay <= level;
    const bin = by <= level;
    if (ain) { px.push(ax); py.push(ay); }
    if (ain !== bin) {
      const t = (level - ay) / (by - ay);
      px.push(ax + (bx - ax) * t);
      py.push(level);
    }
  }
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < px.length; i += 1) {
    const x1 = px[i]; const y1 = py[i];
    const x2 = px[(i + 1) % px.length]; const y2 = py[(i + 1) % px.length];
    const c = x1 * y2 - x2 * y1;
    area += c / 2;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  if (area < 1e-12) return { area: 0, x: 0, y: 0 };
  return { area, x: cx / (6 * area), y: cy / (6 * area) };
}
