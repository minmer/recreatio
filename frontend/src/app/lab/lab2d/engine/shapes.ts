/**
 * LABOR 2D (v2) — FLÄCHEN in der Ebene der Kiste (Meter, Ursprung links
 * unten im Inneren, y nach oben): Rechteck, Kreis, Vieleck, Strecke mit
 * Breite. Die Handgriffe der Szene und die Werkzeuge malen in solche Flächen.
 */

export type Region =
  | { readonly rect: readonly [number, number, number, number] }
  | { readonly circle: readonly [number, number, number] }
  | { readonly poly: readonly (readonly [number, number])[] }
  | { readonly line: readonly [number, number, number, number]; readonly width: number };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Eine Fläche aus JSON lesen (sonst `null`). */
export function readRegion(raw: unknown): Region | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const list = (v: unknown, n: number): number[] | null => {
    if (!Array.isArray(v) || v.length !== n) return null;
    const out = v.map(num);
    return out.every((x) => x !== null) ? (out as number[]) : null;
  };
  const rect = list(r.rect, 4);
  if (rect !== null) return { rect: [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])] };
  const circle = list(r.circle, 3);
  if (circle !== null && circle[2] > 0) return { circle: [circle[0], circle[1], circle[2]] };
  if (Array.isArray(r.poly) && r.poly.length >= 3) {
    const pts = r.poly.map((p) => list(p, 2));
    if (pts.every((p) => p !== null)) return { poly: (pts as number[][]).map((p) => [p[0], p[1]] as const) };
  }
  const line = list(r.line, 4);
  const width = num(r.width);
  if (line !== null && width !== null && width > 0) return { line: [line[0], line[1], line[2], line[3]], width };
  return null;
}

/** Liegt (x, y) in der Fläche? */
export function inside(region: Region, x: number, y: number): boolean {
  if ('rect' in region) {
    const [x0, y0, x1, y1] = region.rect;
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }
  if ('circle' in region) {
    const [cx, cy, r] = region.circle;
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
  }
  if ('poly' in region) {
    const p = region.poly;
    let odd = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
      const [xi, yi] = p[i];
      const [xj, yj] = p[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
    }
    return odd;
  }
  const [x0, y0, x1, y1] = region.line;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2)) : 0;
  const ex = x - (x0 + t * dx);
  const ey = y - (y0 + t * dy);
  return ex * ex + ey * ey <= 0.25 * region.width * region.width;
}

/** Das umschliessende Rechteck [x0, y0, x1, y1]. */
export function bounds(region: Region): [number, number, number, number] {
  if ('rect' in region) return [region.rect[0], region.rect[1], region.rect[2], region.rect[3]];
  if ('circle' in region) {
    const [cx, cy, r] = region.circle;
    return [cx - r, cy - r, cx + r, cy + r];
  }
  if ('poly' in region) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of region.poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  }
  const h = region.width / 2;
  const [ax, ay, bx, by] = region.line;
  return [Math.min(ax, bx) - h, Math.min(ay, by) - h, Math.max(ax, bx) + h, Math.max(ay, by) + h];
}

/** Als JSON (genau so, wie es gelesen wird). */
export function writeRegion(region: Region): Record<string, unknown> {
  if ('rect' in region) return { rect: [...region.rect] };
  if ('circle' in region) return { circle: [...region.circle] };
  if ('poly' in region) return { poly: region.poly.map((p) => [p[0], p[1]]) };
  return { line: [...region.line], width: region.width };
}
