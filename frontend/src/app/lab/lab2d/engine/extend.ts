/**
 * LABOR 2D (v2) — DIE GESCHWINDIGKEIT AUSSERHALB DER FLÜSSIGKEIT (ARCHITECTURE.md
 * §7): Flächen, die die Projektion nicht kennt, bekommen ihren Wert aus
 * bekannten Nachbarn derselben Komponente (zwei Lagen), weiter draussen null —
 * die Teilchen am Rand der Flüssigkeit lesen dort ihre Geschwindigkeit.
 * Tropfen fern der Flüssigkeit lesen das Gitter nicht (liquid.ts, markStranded).
 */

import type { Grid } from './grid';
import type { Particles } from './particles';
import { LIQUID } from './units';

/** Unbekannte Flächen aus bekannten Nachbarn derselben Komponente füllen (zwei Lagen), weiter draussen null. */
export function extendVelocities(
  g: Grid, knownU: Uint8Array, knownV: Uint8Array, markU: Uint8Array, markV: Uint8Array,
  tmpU: Float32Array, tmpV: Float32Array
): void {
  const { nx, ny } = g;
  const nxu = nx + 1;
  const ul = g.ul;
  const vl = g.vl;
  for (let f = 0; f < g.nu; f += 1) markU[f] = knownU[f] !== 0 ? 1 : 0;
  for (let f = 0; f < g.nv; f += 1) markV[f] = knownV[f] !== 0 ? 1 : 0;
  for (let layer = 0; layer < 2; layer += 1) {
    tmpU.set(ul);
    tmpV.set(vl);
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (markU[f] !== 0) continue;
      let s = 0, n = 0;
      if (i > 0 && markU[f - 1] === 1) { s += ul[f - 1]; n += 1; }
      if (i < nx && markU[f + 1] === 1) { s += ul[f + 1]; n += 1; }
      if (j > 0 && markU[f - nxu] === 1) { s += ul[f - nxu]; n += 1; }
      if (j < ny - 1 && markU[f + nxu] === 1) { s += ul[f + nxu]; n += 1; }
      if (n > 0) { tmpU[f] = s / n; markU[f] = 3; }
    }
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (markV[f] !== 0) continue;
      let s = 0, n = 0;
      if (i > 0 && markV[f - 1] === 1) { s += vl[f - 1]; n += 1; }
      if (i < nx - 1 && markV[f + 1] === 1) { s += vl[f + 1]; n += 1; }
      if (j > 0 && markV[f - nx] === 1) { s += vl[f - nx]; n += 1; }
      if (j < ny && markV[f + nx] === 1) { s += vl[f + nx]; n += 1; }
      if (n > 0) { tmpV[f] = s / n; markV[f] = 3; }
    }
    ul.set(tmpU);
    vl.set(tmpV);
    for (let f = 0; f < g.nu; f += 1) if (markU[f] === 3) markU[f] = 1;
    for (let f = 0; f < g.nv; f += 1) if (markV[f] === 3) markV[f] = 1;
  }
  /* Weiter draussen: null (dort sind keine Teilchen). */
  for (let f = 0; f < g.nu; f += 1) if (markU[f] === 0) ul[f] = 0;
  for (let f = 0; f < g.nv; f += 1) if (markV[f] === 0) vl[f] = 0;
}

/**
 * Tropfen fern der Flüssigkeit (M2b): ein Teilchen, in dessen Umkreis von zwei
 * Zellen keine Flüssigkeitszelle liegt (ein Spritzer, die letzten Reste einer
 * verdampfenden Schicht), fliegt ballistisch mit seiner eigenen
 * Geschwindigkeit und der Schwerkraft; trifft es einen Feststoff oder eine
 * Wand, bleibt es dort liegen (es benetzt). Das Gitter kennt dort keine
 * Geschwindigkeit: die Fortsetzung oben setzte die Tropfen auf null (sie
 * schwebten), und Flächen mit eigener Geschwindigkeit neben fortgesetzten
 * schaukelten APIC auf. stranded[p] = 1 für solche Teilchen; liefert, ob es
 * welche gibt.
 */
export function markStranded(P: Particles, g: Grid, stranded: Uint8Array): boolean {
  const { nx, ny, kind } = g;
  let any = false;
  for (let p = 0; p < P.count; p += 1) {
    const ci = Math.min(nx - 1, Math.max(0, Math.floor(P.x[p] / g.dx)));
    const cj = Math.min(ny - 1, Math.max(0, Math.floor(P.y[p] / g.dx)));
    /* Fast alle Teilchen liegen in einer Flüssigkeitszelle. */
    if (kind[ci + cj * nx] === LIQUID) { stranded[p] = 0; continue; }
    let near = false;
    for (let j = Math.max(0, cj - 2); j <= Math.min(ny - 1, cj + 2) && !near; j += 1) {
      for (let i = Math.max(0, ci - 2); i <= Math.min(nx - 1, ci + 2); i += 1) if (kind[i + j * nx] === LIQUID) { near = true; break; }
    }
    stranded[p] = near ? 0 : 1;
    if (!near) any = true;
  }
  return any;
}

/** Geschwindigkeit des Flüssigkeitsgitters an einem Punkt (bilinear je Komponente). */
export function gridVelocityAt(g: Grid, x: number, y: number, out: Float64Array): void {
  const { nx, ny, dx } = g;
  const nxu = nx + 1;
  const inv = 1 / dx;
  /* u: Knoten bei (i, j + ½). */
  let fx = Math.min(nx - 1e-6, Math.max(0, x * inv));
  let fy = Math.min(ny - 1.000001, Math.max(0, y * inv - 0.5));
  let i = Math.floor(fx), j = Math.floor(fy);
  let tx = fx - i, ty = fy - j;
  const ul = g.ul;
  out[0] = (1 - ty) * ((1 - tx) * ul[i + j * nxu] + tx * ul[i + 1 + j * nxu]) + ty * ((1 - tx) * ul[i + (j + 1) * nxu] + tx * ul[i + 1 + (j + 1) * nxu]);
  fx = Math.min(nx - 1.000001, Math.max(0, x * inv - 0.5));
  fy = Math.min(ny - 1e-6, Math.max(0, y * inv));
  i = Math.floor(fx); j = Math.floor(fy);
  tx = fx - i; ty = fy - j;
  const vl = g.vl;
  out[1] = (1 - ty) * ((1 - tx) * vl[i + j * nx] + tx * vl[i + 1 + j * nx]) + ty * ((1 - tx) * vl[i + (j + 1) * nx] + tx * vl[i + 1 + (j + 1) * nx]);
}
