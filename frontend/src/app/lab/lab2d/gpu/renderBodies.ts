/**
 * LABOR 2D (v2) — DIE KÖRPER IM ZEICHNER DER GPU (seit 2026-10-26): mit
 * genauen Anteilen (GpuState.body) liegen Lage und Wärme der Körper nur in
 * den Puffern der GPU (kbodylib.ts); gezeichnet wird wie render/layers.ts
 * (sampleBodies, composeBodies, extendUnderBodies):
 *
 *  - rBodies: je innere Zelle ein gedrehtes Viereck in der Farbe ihres
 *    Werkstoffs (glühend ab 60 °C, mit Kruste), der Temperatur (Einblendung)
 *    oder grau (Mapa stanów); je Rechteck die vier Seiten als Strecken.
 *  - rLiqUnder: in die Texel der Wasserfläche, deren Mitte in einem Körper
 *    liegt, die grösste Bedeckung eines Nachbarn — sonst bliebe zwischen
 *    Wasser und gedrehtem Körper ein heller Saum (vier Lagen, je zwei Texel
 *    hin und her zwischen lq und lq2).
 *
 * Die geschlossenen Zellen der Körper lässt rCells leer (render.ts).
 */

import { SOLIDS } from '../engine/materials';
import { RHO_CRYSTAL } from '../engine/solution';
import { T_SCALE } from '../render/palette';
import { BODY_ACCESS } from './kbodylib';
import type { KernelDef } from './kernel';
import { f } from './lib';
import { RO_WGSL, SOLID_WGSL, VIRIDIS_WGSL } from './renderLib';

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>)';

/** f32 je Viereck (Mitte, halbe Seiten, Winkel, Farbe) und je Rechteck (vier Strecken). */
export const BQ_WORDS = 8;
export const BE_WORDS = 16;

export const BODY_RENDER_KERNELS: readonly KernelDef[] = [
  {
    name: 'rBodies', wg: WG,
    bind: 'P:u RO:u<ROpt> bod:r bgeo:r bcell:r bq:w be:w',
    code: `${RO_WGSL}
${VIRIDIS_WGSL}
${SOLID_WGSL}
${BODY_ACCESS}
/* Temperatur einer inneren Zelle aus Energie, Wärmekapazität, Film und Kruste (wie bMeas). */
fn cellTemp(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
fn toWorld(b: u32, l: vec2<f32>) -> vec2<f32> {
  let a = bv(b, B_A);
  let c = cos(a);
  let s = sin(a);
  return vec2<f32>(bv(b, B_X) + c * l.x - s * l.y, bv(b, B_Y) + s * l.x + c * l.y);
}
${MAIN} {
  let t = gid.x;
  let ncell = u32(bgeo[GH_NCELL]);
  let nrect = u32(bgeo[GH_NRECT]);
  if (t < ncell) {
    let o = ${BQ_WORDS}u * t;
    let rq = u32(bcell[BC * t + 3u]);
    let b = u32(rv(rq, GR_BODY));
    for (var k = 0u; k < ${BQ_WORDS}u; k++) { bq[o + k] = 0.0; }
    if (!bGone(b)) {
      let loc = t - u32(rv(rq, GR_KO));
      let ni = u32(rv(rq, GR_NI));
      let p = loc % ni;
      let q = loc / ni;
      let x0 = rxs(rq, p);
      let x1 = rxs(rq, p + 1u);
      let y0 = rys(rq, q);
      let y1 = rys(rq, q + 1u);
      let w = toWorld(b, vec2<f32>(0.5 * (x0 + x1), 0.5 * (y0 + y1)));
      bq[o] = w.x; bq[o + 1u] = w.y; bq[o + 2u] = 0.5 * (x1 - x0); bq[o + 3u] = 0.5 * (y1 - y0); bq[o + 4u] = bv(b, B_A);
      let mb = u32(bv(b, B_MAT)) + 1u;
      let C = solidRho(mb) * solidCp(mb) * P.depth * (x1 - x0) * (y1 - y0);
      let crust = bcell[BC * t + 2u];
      let T = cellTemp(bcell[BC * t], C, bcell[BC * t + 1u], crust);
      var rgb = vec3<f32>(0.353);
      if (RO.overlay == 1u) { rgb = viridis((T - T0 - ${f(T_SCALE[0])}) / ${f(T_SCALE[1] - T_SCALE[0])}); }
      else if (RO.overlay != 6u) {
        let base = SOLID_RGB[min(mb, ${SOLIDS.length}u) - 1u];
        let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
        rgb = vec3<f32>(base.x + (0.902 - base.x) * glow, base.y * (1.0 - 0.6 * glow), base.z * (1.0 - 0.8 * glow));
        let size = max(1e-6, min(x1 - x0, y1 - y0));
        if (crust > 0.0) { rgb = mix(rgb, CRYSTAL_RGB, min(1.0, sqrt(crust / (${f(RHO_CRYSTAL)} * size * P.depth) / size))); }
      }
      bq[o + 5u] = rgb.x; bq[o + 6u] = rgb.y; bq[o + 7u] = rgb.z;
    }
  }
  if (t < nrect) {
    let o = ${BE_WORDS}u * t;
    let b = u32(rv(t, GR_BODY));
    for (var k = 0u; k < ${BE_WORDS}u; k++) { be[o + k] = 0.0; }
    if (!bGone(b)) {
      let bx = rBox(t);
      let p0 = toWorld(b, bx.xy);
      let p1 = toWorld(b, vec2<f32>(bx.z, bx.y));
      let p2 = toWorld(b, bx.zw);
      let p3 = toWorld(b, vec2<f32>(bx.x, bx.w));
      be[o] = p0.x; be[o + 1u] = p0.y; be[o + 2u] = p1.x; be[o + 3u] = p1.y;
      be[o + 4u] = p1.x; be[o + 5u] = p1.y; be[o + 6u] = p2.x; be[o + 7u] = p2.y;
      be[o + 8u] = p2.x; be[o + 9u] = p2.y; be[o + 10u] = p3.x; be[o + 11u] = p3.y;
      be[o + 12u] = p3.x; be[o + 13u] = p3.y; be[o + 14u] = p0.x; be[o + 15u] = p0.y;
    }
  }
}`
  },
  {
    /* Eine Lage der Wasserfläche unter die Körper (src → dst; layers.extendUnderBodies). */
    name: 'rLiqUnder', wg: WG,
    bind: 'P:u bod:r bgeo:r src:r dst:w',
    code: `${BODY_ACCESS}
fn inBodies(x: f32, y: f32) -> bool {
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    /* Die Umgrenzung stammt vom Anfang des Schritts: eine Zelle Rand für die Bewegung seither. */
    if (x < bv(b, B_BX0) - P.dx || x > bv(b, B_BX1) + P.dx || y < bv(b, B_BY0) - P.dx || y > bv(b, B_BY1) + P.dx) { continue; }
    let a = bv(b, B_A);
    let c = cos(a);
    let s = sin(a);
    let dx = x - bv(b, B_X);
    let dy = y - bv(b, B_Y);
    let l = vec2<f32>(c * dx + s * dy, -s * dx + c * dy);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      if (l.x >= bx.x && l.x <= bx.z && l.y >= bx.y && l.y <= bx.w) { return true; }
    }
  }
  return false;
}
${MAIN} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  for (var k = 0u; k < 4u; k++) { dst[4u * t + k] = src[4u * t + k]; }
  let I = t % lx;
  let J = t / lx;
  let h = 0.5 * P.dx;
  if (!inBodies((f32(I) + 0.5) * h, (f32(J) + 0.5) * h)) { return; }
  var best = t;
  var bw = src[4u * t];
  if (I > 0u && src[4u * (t - 1u)] > bw) { best = t - 1u; bw = src[4u * best]; }
  if (I + 1u < lx && src[4u * (t + 1u)] > bw) { best = t + 1u; bw = src[4u * best]; }
  if (J > 0u && src[4u * (t - lx)] > bw) { best = t - lx; bw = src[4u * best]; }
  if (J + 1u < ly && src[4u * (t + lx)] > bw) { best = t + lx; bw = src[4u * best]; }
  if (best != t) { for (var k = 0u; k < 4u; k++) { dst[4u * t + k] = src[4u * best + k]; } }
}`
  }
];

/** Der Zeichenkern der Vierecke (hinter DRAW_COMMON aus render.ts): je Instanz ein Viereck aus bq, deckend. */
export const BODYQ_WGSL = `
@group(0) @binding(1) var<storage, read> bq: array<f32>;
struct BO { @builtin(position) pos: vec4<f32>, @location(0) rgb: vec3<f32> }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) q: u32) -> BO {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  let o = ${BQ_WORDS}u * q;
  let l = corner * vec2<f32>(bq[o + 2u], bq[o + 3u]);
  let c = cos(bq[o + 4u]);
  let s = sin(bq[o + 4u]);
  var r: BO;
  r.pos = toClip(vec2<f32>(bq[o], bq[o + 1u]) + vec2<f32>(c * l.x - s * l.y, s * l.x + c * l.y));
  r.rgb = vec3<f32>(bq[o + 5u], bq[o + 6u], bq[o + 7u]);
  return r;
}
@fragment fn fs(i: BO) -> @location(0) vec4<f32> { return vec4<f32>(i.rgb, 1.0); }
`;
