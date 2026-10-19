/**
 * PARTIKEL-LABOR — GEBIETE: wo gemalt, gelöscht, eine Wand gezogen oder ein
 * Gerät gestellt wird. Ein Gebiet ist reine Geometrie (Meter, Ursprung unten
 * links in der Kiste); die Engine belegt die Gitterplätze in ihm mit Partikeln.
 * Geräte sind Formen aus festen Partikeln — keine Skripte.
 */

export type Region =
  | { readonly rect: readonly [number, number, number, number] }
  | { readonly circle: readonly [number, number, number] }
  | { readonly poly: readonly (readonly [number, number])[] }
  | { readonly line: readonly [number, number, number, number]; readonly width: number };

/** Liegt der Punkt im Gebiet? */
export function inRegion(r: Region, x: number, y: number): boolean {
  if ('rect' in r) {
    const [a, b, c, d] = r.rect;
    return x >= Math.min(a, c) && x <= Math.max(a, c) && y >= Math.min(b, d) && y <= Math.max(b, d);
  }
  if ('circle' in r) {
    const [cx, cy, rad] = r.circle;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= rad * rad;
  }
  if ('line' in r) {
    const [ax, ay, bx, by] = r.line;
    const ex = bx - ax;
    const ey = by - ay;
    const len2 = ex * ex + ey * ey;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * ex + (y - ay) * ey) / len2)) : 0;
    const dx = x - (ax + t * ex);
    const dy = y - (ay + t * ey);
    const half = r.width / 2;
    return dx * dx + dy * dy <= half * half;
  }
  /* Vieleck: gerade/ungerade Regel. */
  const pts = r.poly;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Das umschliessende Rechteck [x0, y0, x1, y1]. */
export function regionBounds(r: Region): [number, number, number, number] {
  if ('rect' in r) {
    const [a, b, c, d] = r.rect;
    return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
  }
  if ('circle' in r) {
    const [cx, cy, rad] = r.circle;
    return [cx - rad, cy - rad, cx + rad, cy + rad];
  }
  if ('line' in r) {
    const [ax, ay, bx, by] = r.line;
    const half = r.width / 2;
    return [Math.min(ax, bx) - half, Math.min(ay, by) - half, Math.max(ax, bx) + half, Math.max(ay, by) + half];
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of r.poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

/** Ein Teil eines Gerätes: ein Gebiet aus einem Werkstoff (`role` 1: Heizelement). */
export interface SolidPart {
  readonly region: Region;
  readonly material: string;
  readonly role: number;
}

/**
 * Eine Zlewka als Querschnitt: zwei Wände und ein Boden (Aussenmasse; Mitte x,
 * Unterkante y). Wände mindestens zwei Partikeln dick, damit nichts durchsickert.
 */
export function beakerParts(x: number, y: number, w: number, h: number, wall: number, material: string, s: number): SolidPart[] {
  const t = Math.max(wall, 2 * s);
  const l = x - w / 2;
  const r = x + w / 2;
  return [
    { region: { rect: [l, y, l + t, y + h] }, material, role: 0 },
    { region: { rect: [r - t, y, r, y + h] }, material, role: 0 },
    { region: { rect: [l, y, r, y + t] }, material, role: 0 }
  ];
}

/** Eine Heizplatte: ein Block aus Stahl, innen die Heizelemente (eine Partikel Rand ringsum). */
export function hotplateParts(x: number, y: number, w: number, h: number, material: string, s: number): SolidPart[] {
  const l = x - w / 2;
  const r = x + w / 2;
  return [
    { region: { rect: [l, y, r, y + h] }, material, role: 0 },
    { region: { rect: [l + s, y + s * 0.5, r - s, y + h - s] }, material, role: 1 }
  ];
}
