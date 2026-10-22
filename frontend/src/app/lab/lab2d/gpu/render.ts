/**
 * LABOR 2D (v2) — DER ZEICHNER DES BESCHLEUNIGTEN WEGS (WebGPU): zeichnet
 * dasselbe Bild wie render/frame.ts + render/glRenderer.ts, aber direkt aus
 * den Puffern der GPU — kein Bild wandert zur CPU.
 *
 * Rechenkerne bauen die Texturen (Zellen scharf, Feld weich und
 * vormultipliziert, die Bedeckung der Flüssigkeit auf halben Zellen mit
 * [1 2 1]-Weichzeichner) und die Pfeile der Geschwindigkeit; Zeichenkerne
 * legen Grund, Wasserfläche (oder die rohen Teilchen), Blasen, Feld, Zellen,
 * Pfeile und Wände übereinander.
 */

import { SOLIDS } from '../engine/materials';
import type { Overlay } from '../render/frame';
import { hex, T_SCALE, VIRIDIS } from '../render/palette';
import type { View } from '../render/view';
import type { Walls } from '../render/glRenderer';
import type { GpuEngine } from './engine';
import type { KernelDef, Resource } from './kernel';
import { f, LIB } from './lib';
import { C } from './slots';

const WG = 128;
const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)';

/** Abstand der Pfeile (m) wie frame.ts. */
const ARROW_SPACING = 0.006;
/* Salz kennt der beschleunigte Weg noch nicht (er lehnt Szenen mit Salz ab): „Stężenie“ zeigt dort reines Wasser. */
export const OVERLAY_CODE: Readonly<Record<Overlay, number>> = { none: 0, temperature: 1, pressure: 2, velocity: 3, humidity: 4, vapour: 5, salt: 0, phase: 6 };
/* Deckkraft des Nebels nach Beer–Lambert (frame.ts): LWC_ref. */
const FOG_REF = (4 * 1000 * 1.5e-6) / (3 * 2 * 0.07);

const VIRIDIS_WGSL = `
const VIR = array<vec3<f32>, ${VIRIDIS.length}>(${VIRIDIS.map((c) => `vec3<f32>(${f(c[0] / 255)}, ${f(c[1] / 255)}, ${f(c[2] / 255)})`).join(', ')});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${f(VIRIDIS.length - 1)};
  let i = min(u32(floor(x)), ${VIRIDIS.length - 2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`;

/** Uniform der Rechenkerne des Zeichners. */
const RO_WGSL = `struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }`;

export const RENDER_KERNELS: readonly KernelDef[] = [
  {
    /* Massstäbe der Einblendungen: grösster Überdruck und Gasgeschwindigkeit; an den Pfeilpunkten die des Gases und des Wassers. */
    name: 'rScale', wg: WG,
    bind: 'P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a',
    code: `${RO_WGSL}
var<workgroup> m4: array<vec4<f32>, WG>;
${MAIN} {
  let c = gid.x;
  let lid = lid3.x;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    let n = P.n;
    let k = cu[U_KIND * n + c];
    let i = ci(c);
    let j = cj(c);
    let og = FF_UG * P.nf;
    let ol = FF_UL * P.nf;
    if (k == GAS) {
      v.x = abs(cf[F_PG * n + c]);
      let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
      let w = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
      v.y = sqrt(u * u + w * w);
    }
    let half = i32(RO.step / 2u);
    if ((i - half) % i32(RO.step) == 0 && (j - half) % i32(RO.step) == 0 && i >= half && j >= half) {
      if (k == GAS) { v.z = v.y; }
      else if (k == LIQUID) {
        let u = 0.5 * (ff[ol + uF(i, j)] + ff[ol + uF(i + 1, j)]);
        let w = 0.5 * (ff[ol + vF(i, j)] + ff[ol + vF(i, j + 1)]);
        v.w = sqrt(u * u + w * w);
      }
    }
  }
  m4[lid] = v;
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { m4[lid] = max(m4[lid], m4[lid + s]); }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let r = m4[0];
    maxU_cnt(C_OV_PMAX, r.x); maxU_cnt(C_OV_VMAX, r.y); maxU_cnt(C_OV_VGAS, r.z); maxU_cnt(C_OV_VLIQ, r.w);
  }
}`
  },
  {
    /* Zellen (scharf: Feststoffe, Mapa stanów) und Feld (weich, vormultipliziert: Nebel und stetige Einblendungen). */
    name: 'rCells', wg: WG,
    bind: 'P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t',
    code: `${RO_WGSL}
${VIRIDIS_WGSL}
const SOLID_RGB = array<vec3<f32>, ${SOLIDS.length}>(${SOLIDS.map((s) => { const c = hex(s.color); return `vec3<f32>(${f(c[0] / 255)}, ${f(c[1] / 255)}, ${f(c[2] / 255)})`; }).join(', ')});
${MAIN} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${f(T_SCALE[0])};
  let tspan = ${f(T_SCALE[1] - T_SCALE[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${SOLIDS.length}u) - 1u];
    let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
    cell = vec4<f32>(rgb.x + (0.902 - rgb.x) * glow, rgb.y * (1.0 - 0.6 * glow), rgb.z * (1.0 - 0.8 * glow), 1.0);
    if (ov == 1u) { cell = vec4<f32>(viridis((T - T0 - tmin) / tspan), 1.0); }
    else if (ov == 6u) { cell = vec4<f32>(0.353, 0.353, 0.353, 1.0); }
  } else if (ov == 6u) {
    if (k == LIQUID) { cell = vec4<f32>(0.239, 0.561, 0.847, 0.784); } else { cell = vec4<f32>(0.922, 0.922, 0.922, 0.471); }
    if (cf[F_ALPHA * n + c] > 0.02) { cell = vec4<f32>(0.98, 0.784, 0.314, 0.863); }
  } else if (k == GAS) {
    if (ov == 1u || ov == 2u || ov == 3u) {
      var t = 0.0;
      if (ov == 1u) { t = (T - T0 - tmin) / tspan; }
      else if (ov == 2u) { t = 0.5 + 0.5 * cf[F_PG * n + c] / max(1.0, cnt[C_OV_PMAX]); }
      else {
        let og = FF_UG * P.nf;
        let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
        let w = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
        t = sqrt(u * u + w * w) / max(0.02, cnt[C_OV_VMAX]);
      }
      col = viridis(t);
      a = select(0.55, 0.4, ov == 3u);
    } else if (ov == 4u || ov == 5u) {
      let mv = cf[F_MV * n + c];
      let nd = cf[F_MN * n + c] / M_N2 + cf[F_MO * n + c] / M_O2;
      let nv = mv / M_H2O;
      var x = 0.0;
      if (nv + nd > 0.0) { x = nv / (nv + nd); }
      var value = 0.0;
      if (ov == 4u) { value = x * pAt(c) / pSat(T); } else { value = mv / max(1e-12, cf[F_VGAS * n + c]) / 0.6; }
      col = vec3<f32>(0.157, 0.431, 0.863);
      a = min(0.86, 0.86 * value);
    }
    let fog = cf[F_MF * n + c] / max(1e-12, cf[F_VGAS * n + c]);
    if (fog > 0.0) {
      var af = min(0.95, 1.0 - exp(-fog / ${f(FOG_REF)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`
  },
  {
    /* Bedeckung der Flüssigkeit auf halben Zellen (quadratischer B-Spline der Teilchenvolumina) und ihre Temperatur. */
    name: 'rLiqSplat', wg: WG,
    bind: 'P:u lq:w parts:r ccount:r cstart:r bsum:r',
    code: `${MAIN} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let J = t / lx;
  let h = 0.5 * P.dx;
  let inv = 1.0 / (h * h * P.depth);
  let ic = i32(I / 2u);
  let jc = i32(J / 2u);
  var w = 0.0;
  var wt = 0.0;
  for (var b = -1; b <= 1; b++) {
    let jj = jc + b;
    if (jj < 0 || jj >= i32(P.ny)) { continue; }
    for (var a = -1; a <= 1; a++) {
      let ii = ic + a;
      if (ii < 0 || ii >= i32(P.nx)) { continue; }
      let cc = cellOf(ii, jj);
      let st = cellStart(cc);
      let cn = ccount[cc];
      for (var k = 0u; k < cn; k++) {
        let pk = st + k;
        let m = parts[pk].mass;
        if (!(m > 0.0)) { continue; }
        let ww = bspline1(parts[pk].x / h - 0.5 - f32(I)) * bspline1(parts[pk].y / h - 0.5 - f32(J));
        if (ww == 0.0) { continue; }
        let vp = m / parts[pk].rho * inv * ww;
        w += vp;
        wt += vp * parts[pk].T;
      }
    }
  }
  lq[2u * t] = w;
  lq[2u * t + 1u] = wt;
}`
  },
  {
    name: 'rLiqBlurX', wg: WG,
    bind: 'P:u lq:r lq2:w',
    code: `${MAIN} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`
  },
  {
    name: 'rLiqBlurY', wg: WG,
    bind: 'P:u lq2:r liquid:t',
    code: `${MAIN} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let J = t / lx;
  let b = select(t, t - lx, J > 0u);
  let u = select(t, t + lx, J + 1u < ly);
  let w = 0.25 * lq2[2u * b] + 0.5 * lq2[2u * t] + 0.25 * lq2[2u * u];
  let wt = 0.25 * lq2[2u * b + 1u] + 0.5 * lq2[2u * t + 1u] + 0.25 * lq2[2u * u + 1u];
  var temp = 0.0;
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${f(T_SCALE[0])}) / ${f(T_SCALE[1] - T_SCALE[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`
  },
  {
    /* Pfeile auf einem groben Raster: je Punkt drei Strecken (Schaft, zwei Spitzen) — erst das Gas, dahinter das Wasser; sonst Strecken der Länge null. */
    name: 'rArrows', wg: WG,
    bind: 'P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w',
    code: `${RO_WGSL}
${MAIN} {
  let a = gid.x;
  let na = RO.nax * RO.nay;
  if (a >= 2u * na) { return; }
  let liquidPass = a >= na;
  let q = a % na;
  let half = RO.step / 2u;
  let i = i32(half + (q % RO.nax) * RO.step);
  let j = i32(half + (q / RO.nax) * RO.step);
  let o = 12u * a;
  for (var k = 0u; k < 12u; k++) { arrows[o + k] = 0.0; }
  if (RO.overlay != 3u || i >= i32(P.nx) || j >= i32(P.ny)) { return; }
  let c = cellOf(i, j);
  let kind = cu[U_KIND * P.n + c];
  if ((liquidPass && kind != LIQUID) || (!liquidPass && kind != GAS)) { return; }
  let fld = select(FF_UG, FF_UL, liquidPass);
  let ofs = fld * P.nf;
  let u = 0.5 * (ff[ofs + uF(i, j)] + ff[ofs + uF(i + 1, j)]);
  let v = 0.5 * (ff[ofs + vF(i, j)] + ff[ofs + vF(i, j + 1)]);
  let s = sqrt(u * u + v * v);
  let vmax = select(max(0.02, cnt[C_OV_VMAX]), cnt[C_OV_VLIQ], liquidPass);
  if (!(vmax > 1e-6) || s < 0.03 * vmax) { return; }
  let len = 0.9 * f32(RO.step) * P.dx;
  let L = len * s / vmax;
  let ux = u / s;
  let uy = v / s;
  let cx = (f32(i) + 0.5) * P.dx;
  let cy = (f32(j) + 0.5) * P.dx;
  let x1 = cx + 0.5 * L * ux;
  let y1 = cy + 0.5 * L * uy;
  let h = 0.35 * L;
  let ca = 0.9063;
  let sa = 0.4226;
  arrows[o] = cx - 0.5 * L * ux; arrows[o + 1u] = cy - 0.5 * L * uy; arrows[o + 2u] = x1; arrows[o + 3u] = y1;
  arrows[o + 4u] = x1; arrows[o + 5u] = y1; arrows[o + 6u] = x1 - h * (ca * ux - sa * uy); arrows[o + 7u] = y1 - h * (sa * ux + ca * uy);
  arrows[o + 8u] = x1; arrows[o + 9u] = y1; arrows[o + 10u] = x1 - h * (ca * ux + sa * uy); arrows[o + 11u] = y1 - h * (-sa * ux + ca * uy);
}`
  }
];

/* -- Zeichenkerne ------------------------------------------------------------------------------------- */

const DRAW_COMMON = `
struct RP {
  view: vec4<f32>,
  box: vec2<f32>,
  canvas: vec2<f32>,
  ground: vec4<f32>,
  water: vec4<f32>,
  ink: vec4<f32>,
  waterInk: vec4<f32>,
  rect: vec4<f32>,
  fill: vec4<f32>,
  tint: f32,
  pointPx: f32,
  bcount: u32,
  pcount: u32,
}
@group(0) @binding(0) var<uniform> R: RP;
fn toClip(p: vec2<f32>) -> vec4<f32> { return vec4<f32>((p - R.view.xy) / (R.view.zw - R.view.xy) * 2.0 - 1.0, 0.0, 1.0); }
`;

const QUAD_WGSL = `${DRAW_COMMON}
${VIRIDIS_WGSL}
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex fn vs(@builtin(vertex_index) v: u32) -> VO {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  var o: VO;
  o.pos = toClip(corner * R.box);
  o.uv = vec2<f32>(corner.x, 1.0 - corner.y);
  return o;
}
@fragment fn fsCells(i: VO) -> @location(0) vec4<f32> {
  let c = textureSample(tex, smp, i.uv);
  return vec4<f32>(c.rgb * c.a, c.a);
}
@fragment fn fsField(i: VO) -> @location(0) vec4<f32> { return textureSample(tex, smp, i.uv); }
@fragment fn fsLiquid(i: VO) -> @location(0) vec4<f32> {
  let c = textureSample(tex, smp, i.uv);
  let cover = c.r;
  let a = smoothstep(0.42, 0.58, cover);
  if (a <= 0.0) { discard; }
  var rgb = mix(R.water.rgb, viridis(c.g), R.tint);
  let edge = 1.0 - smoothstep(0.0, 0.12, abs(cover - 0.5));
  rgb *= 1.0 - 0.25 * edge;
  let alpha = 0.82 * a;
  return vec4<f32>(rgb * alpha, alpha);
}
`;

const RECT_WGSL = `${DRAW_COMMON}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`;

const DISC_WGSL = `${DRAW_COMMON}
${(LIB.match(/struct Bubble \{[\s\S]*?\n\}/) ?? [''])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${C.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let B = bubs[b];
  let tot = B.mN + B.mO + B.mV;
  if (tot > 0.0) { o.air = (B.mN + B.mO) / tot; }
  o.pos = toClip(vec2<f32>(B.x, B.y) + corner * max(B.r, 0.00012));
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  let d = length(i.local);
  if (d > 1.0) { discard; }
  let ring = smoothstep(0.72, 0.95, d);
  let inside = mix(vec3<f32>(0.93, 0.97, 1.0), vec3<f32>(0.95, 0.95, 0.9), i.air);
  let rgb = mix(inside, vec3<f32>(0.16, 0.36, 0.62), ring);
  let alpha = mix(0.55, 0.95, ring) * (1.0 - smoothstep(0.95, 1.0, d));
  return vec4<f32>(rgb * alpha, alpha);
}
`;

const POINT_WGSL = `${DRAW_COMMON}
${VIRIDIS_WGSL}
${(LIB.match(/struct Particle \{[\s\S]*?\n\}/) ?? [''])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${C.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${f(273.15 + T_SCALE[0])}) / ${f(T_SCALE[1] - T_SCALE[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`;

const LINE_WGSL = `${DRAW_COMMON}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`;

const RP_WORDS = 48;
const RP_SLOT = 256;
/** Uniform-Plätze je Zeichnung (Rechtecke und Farben brauchen je einen eigenen). */
const RP_SLOTS = 12;

export interface Theme {
  ground: readonly [number, number, number];
  outside: readonly [number, number, number];
  wall: readonly [number, number, number];
  ink: readonly [number, number, number];
}

export class GpuRenderer {
  private readonly gpu: GpuEngine;
  private readonly device: GPUDevice;
  private readonly context: GPUCanvasContext;
  private readonly format: string;
  private readonly rp: GPUBuffer;
  private readonly ro: GPUBuffer;
  private readonly sampLin: GPUSampler;
  private readonly sampNear: GPUSampler;
  private pipes: Record<string, GPURenderPipeline> = {};
  private layouts: Record<string, GPUBindGroupLayout> = {};
  /* Je Szene (hängen an den Puffern der GPU): Texturen, Zwischenspeicher, Gruppen. */
  private size = '';
  private cellsTex!: GPUTexture;
  private fieldTex!: GPUTexture;
  private liquidTex!: GPUTexture;
  private lq!: GPUBuffer;
  private lq2!: GPUBuffer;
  private arrows!: GPUBuffer;
  private nArrows = 0;
  private groups = new Map<string, GPUBindGroup>();
  theme: Theme = { ground: [0.93, 0.95, 0.97], outside: [0.86, 0.88, 0.9], wall: [0.42, 0.46, 0.5], ink: [0.08, 0.1, 0.12] };
  private readonly water: readonly [number, number, number] = [0.24, 0.56, 0.85];
  private readonly waterInk: readonly [number, number, number] = [1, 1, 1];

  constructor(gpu: GpuEngine, canvas: OffscreenCanvas) {
    this.gpu = gpu;
    this.device = gpu.ctx.device;
    const nav = (globalThis as unknown as { navigator: Navigator }).navigator;
    this.format = nav.gpu?.getPreferredCanvasFormat() ?? 'bgra8unorm';
    const ctx = (canvas as unknown as { getContext(kind: 'webgpu'): GPUCanvasContext | null }).getContext('webgpu');
    if (ctx === null) throw new Error('no webgpu canvas context');
    this.context = ctx;
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
    this.rp = gpu.ctx.buffer('rp', RP_SLOT * RP_SLOTS, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.ro = gpu.ctx.buffer('ro', 16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.sampLin = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.sampNear = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  }

  /** Die Zeichenkerne (einmal). */
  async init(): Promise<void> {
    const d = this.device;
    const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
    const vf = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const L = (entries: GPUBindGroupLayoutEntry[]): GPUBindGroupLayout => d.createBindGroupLayout({ entries });
    this.layouts.quad = L([
      { binding: 0, visibility: vf, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
    ]);
    this.layouts.rect = L([{ binding: 0, visibility: vf, buffer: { type: 'uniform' } }]);
    this.layouts.store = L([
      { binding: 0, visibility: vf, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }
    ]);
    const pipe = async (code: string, fs: string, layout: GPUBindGroupLayout, topology: 'triangle-strip' | 'line-list', buffers: unknown[] = []): Promise<GPURenderPipeline> => {
      const module = d.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const bad = info.messages.filter((m) => m.type === 'error');
      if (bad.length > 0) throw new Error(`render WGSL: ${bad.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join(' | ')}`);
      return d.createRenderPipelineAsync({
        layout: d.createPipelineLayout({ bindGroupLayouts: [layout] }),
        vertex: { module, entryPoint: 'vs', buffers },
        fragment: { module, entryPoint: fs, targets: [{ format: this.format, blend }] },
        primitive: { topology }
      });
    };
    const [cells, field, liquid, rect, disc, point, line] = await Promise.all([
      pipe(QUAD_WGSL, 'fsCells', this.layouts.quad, 'triangle-strip'),
      pipe(QUAD_WGSL, 'fsField', this.layouts.quad, 'triangle-strip'),
      pipe(QUAD_WGSL, 'fsLiquid', this.layouts.quad, 'triangle-strip'),
      pipe(RECT_WGSL, 'fs', this.layouts.rect, 'triangle-strip'),
      pipe(DISC_WGSL, 'fs', this.layouts.store, 'triangle-strip'),
      pipe(POINT_WGSL, 'fs', this.layouts.store, 'triangle-strip'),
      pipe(LINE_WGSL, 'fs', this.layouts.rect, 'line-list', [{ arrayStride: 8, attributes: [{ format: 'float32x2', offset: 0, shaderLocation: 0 }] }])
    ]);
    this.pipes = { cells, field, liquid, rect, disc, point, line };
  }

  /** Texturen und Zwischenspeicher für die jetzige Szene (nach jedem Neuaufbau des Zustands). */
  private ensure(): void {
    const S = this.gpu.state;
    const key = `${S.d.nx}x${S.d.ny}:${this.gpu.stateVersion}`;
    if (key === this.size) return;
    this.size = key;
    this.groups.clear();
    const d = this.device;
    const tex = (w: number, h: number): GPUTexture => d.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    this.cellsTex?.destroy();
    this.fieldTex?.destroy();
    this.liquidTex?.destroy();
    this.cellsTex = tex(S.d.nx, S.d.ny);
    this.fieldTex = tex(S.d.nx, S.d.ny);
    this.liquidTex = tex(2 * S.d.nx, 2 * S.d.ny);
    const nl = 4 * S.d.nx * S.d.ny;
    this.lq?.destroy();
    this.lq2?.destroy();
    this.arrows?.destroy();
    this.lq = d.createBuffer({ size: 4 * 2 * nl, usage: GPUBufferUsage.STORAGE });
    this.lq2 = d.createBuffer({ size: 4 * 2 * nl, usage: GPUBufferUsage.STORAGE });
    const step = Math.max(2, Math.round(ARROW_SPACING / this.gpu.cpu.grid.dx));
    const half = step >> 1;
    const nax = Math.max(1, Math.ceil((S.d.nx - half) / step));
    const nay = Math.max(1, Math.ceil((S.d.ny - half) / step));
    this.nArrows = nax * nay;
    this.arrows = d.createBuffer({ size: 4 * 12 * 2 * this.nArrows, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX });
    this.roData = new Uint32Array([0, step, nax, nay]);
  }

  private roData = new Uint32Array(4);

  private computeGroup(name: string, extra: Readonly<Record<string, Resource>>): GPUBindGroup {
    let g = this.groups.get(name);
    if (g === undefined) {
      const S = this.gpu.state;
      g = this.gpu.ctx.bind(name, {
        P: S.params, RO: this.ro, cf: S.cf, cu: S.cu, ff: S.ff, reg: S.reg, cnt: S.cnt, parts: S.partsA, ccount: S.ccountB, cstart: S.cstart, bsum: S.bsum,
        lq: this.lq, lq2: this.lq2, arrows: this.arrows, ...extra
      });
      this.groups.set(name, g);
    }
    return g;
  }

  private drawGroup(key: string, layout: GPUBindGroupLayout, slot: number, extra: { tex?: GPUTexture; smp?: GPUSampler; store?: GPUBuffer }): GPUBindGroup {
    let g = this.groups.get(key);
    if (g === undefined) {
      const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: this.rp, offset: RP_SLOT * slot, size: 4 * RP_WORDS } }];
      if (extra.tex !== undefined) entries.push({ binding: 1, resource: extra.tex.createView() }, { binding: 2, resource: extra.smp as GPUSampler });
      if (extra.store !== undefined) entries.push({ binding: 1, resource: { buffer: extra.store } }, { binding: 2, resource: { buffer: this.gpu.state.cnt } });
      g = this.device.createBindGroup({ layout, entries });
      this.groups.set(key, g);
    }
    return g;
  }

  /** Ein Bild aufzeichnen: Rechenkerne für Texturen und Pfeile, dann den Zeichenpass (in den Encoder des Bildes). */
  encode(enc: GPUCommandEncoder, view: View, width: number, height: number, walls: Walls, overlay: Overlay, particles: boolean): void {
    this.ensure();
    const S = this.gpu.state;
    const ctx = this.gpu.ctx;
    const q = this.device.queue;
    this.roData[0] = OVERLAY_CODE[overlay];
    q.writeBuffer(this.ro, 0, this.roData);
    enc.clearBuffer(S.cnt, 4 * C.OV_PMAX, 16);
    const p = enc.beginComputePass();
    const n = S.d.n;
    ctx.dispatch(p, 'rScale', this.computeGroup('rScale', {}), n);
    ctx.dispatch(p, 'rCells', this.computeGroup('rCells', { cells: { view: this.cellsTex.createView() }, field: { view: this.fieldTex.createView() } }), n);
    if (!particles) {
      ctx.dispatch(p, 'rLiqSplat', this.computeGroup('rLiqSplat', {}), 4 * n);
      ctx.dispatch(p, 'rLiqBlurX', this.computeGroup('rLiqBlurX', {}), 4 * n);
      ctx.dispatch(p, 'rLiqBlurY', this.computeGroup('rLiqBlurY', { liquid: { view: this.liquidTex.createView() } }), 4 * n);
    }
    if (overlay === 'velocity') ctx.dispatch(p, 'rArrows', this.computeGroup('rArrows', {}), 2 * this.nArrows);
    p.end();
    /* Uniform-Plätze: 0 Grund, 1 Bild (Wasser, Blasen, Teilchen), 2–3 Pfeile, 4–7 Wände. */
    const g = this.gpu.cpu.grid;
    const rpAt = (slot: number, rect: readonly number[], fill: readonly number[]): void => {
      const a = new Float32Array(RP_WORDS);
      const u = new Uint32Array(a.buffer);
      a.set([view.x0, view.y0, view.x1, view.y1, g.w, g.h, width, height], 0);
      a.set([...this.theme.ground, 1, ...this.water, 1, ...this.theme.ink, 0.85, ...this.waterInk, 0.9], 8);
      a.set(rect, 24);
      a.set(fill, 28);
      a[32] = overlay === 'temperature' ? 1 : 0;
      a[33] = Math.max(1.5, (0.5 * g.dx * width) / (view.x1 - view.x0));
      u[34] = S.d.bcap;
      u[35] = S.d.pcap;
      q.writeBuffer(this.rp, RP_SLOT * slot, a);
    };
    const t = 0.003;
    rpAt(0, [0, 0, g.w, g.h], [...this.theme.ground, 1]);
    rpAt(1, [0, 0, 0, 0], [0, 0, 0, 0]);
    rpAt(2, [0, 0, 0, 0], [...this.theme.ink, 0.85]);
    rpAt(3, [0, 0, 0, 0], [...this.waterInk, 0.9]);
    const wallRects: number[][] = [];
    if (walls.left) wallRects.push([-t, -t, 0, g.h + (walls.top ? t : 0)]);
    if (walls.right) wallRects.push([g.w, -t, g.w + t, g.h + (walls.top ? t : 0)]);
    if (walls.bottom) wallRects.push([-t, -t, g.w + t, 0]);
    if (walls.top) wallRects.push([-t, g.h, g.w + t, g.h + t]);
    wallRects.forEach((r, k) => rpAt(4 + k, r, [...this.theme.wall, 1]));
    const rp = enc.beginRenderPass({
      colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: this.theme.outside[0], g: this.theme.outside[1], b: this.theme.outside[2], a: 1 }, loadOp: 'clear', storeOp: 'store' }]
    });
    const P = this.pipes;
    rp.setPipeline(P.rect);
    rp.setBindGroup(0, this.drawGroup('d-ground', this.layouts.rect, 0, {}));
    rp.draw(4);
    if (particles) {
      rp.setPipeline(P.point);
      rp.setBindGroup(0, this.drawGroup('d-points', this.layouts.store, 1, { store: S.partsA }));
      rp.draw(4, S.d.pcap);
    } else {
      rp.setPipeline(P.liquid);
      rp.setBindGroup(0, this.drawGroup('d-liquid', this.layouts.quad, 1, { tex: this.liquidTex, smp: this.sampLin }));
      rp.draw(4);
    }
    rp.setPipeline(P.disc);
    rp.setBindGroup(0, this.drawGroup('d-bubbles', this.layouts.store, 1, { store: S.bubs }));
    rp.draw(4, S.d.bcap);
    rp.setPipeline(P.field);
    rp.setBindGroup(0, this.drawGroup('d-field', this.layouts.quad, 1, { tex: this.fieldTex, smp: this.sampLin }));
    rp.draw(4);
    rp.setPipeline(P.cells);
    rp.setBindGroup(0, this.drawGroup('d-cells', this.layouts.quad, 1, { tex: this.cellsTex, smp: this.sampNear }));
    rp.draw(4);
    if (overlay === 'velocity') {
      rp.setPipeline(P.line);
      rp.setVertexBuffer(0, this.arrows);
      rp.setBindGroup(0, this.drawGroup('d-ink', this.layouts.rect, 2, {}));
      rp.draw(6 * this.nArrows);
      rp.setBindGroup(0, this.drawGroup('d-winks', this.layouts.rect, 3, {}));
      rp.draw(6 * this.nArrows, 1, 6 * this.nArrows);
    }
    rp.setPipeline(P.rect);
    wallRects.forEach((_, k) => {
      rp.setBindGroup(0, this.drawGroup(`d-wall${k}`, this.layouts.rect, 4 + k, {}));
      rp.draw(4);
    });
    rp.end();
  }

  /** Nach einem Neuaufbau des Zustands (neue Puffer): Gruppen neu. */
  reset(): void {
    this.size = '';
    this.groups.clear();
  }
}
