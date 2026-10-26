/**
 * LABOR 2D (v2) — DIE AUFNAHME AUF DER GPU (B, Backen mit der Grafikkarte; seit
 * 2026-10-25): Kerne, die nach jedem Schritt genau die Bytes eines Bildes
 * schreiben, die render/layers.ts (sampleLayers) aus der CPU-Engine nähme —
 * Art, Kruste, Glühen, Nebel, die Flüssigkeit auf halben Zellen, Blasen, die
 * Vierecke der Körper und, in jedem dritten Bild (wie der Nachweis sie
 * speichert, codec.ts), Merkmale, Temperatur, Druck, Geschwindigkeit,
 * Feuchte, Dampf und Pfeile. Der Backer (clip/gpuBake.ts) liest sie gebündelt
 * zurück, ohne je auf einen Schritt zu warten.
 *
 * - bkClock (ein Faden): die Uhr der Bilder in Festkomma — u64 als zwei u32 in
 *   Einheiten von 1/(60·2²⁴) s, so sind Bilder bei 15/30/60 je Sekunde genaue
 *   Vielfache (die f32-Zeit der GPU, glob.TIME, liefe in 600 s um 0,2 s davon).
 *   Sie zählt das Δt des eben gerechneten Schritts dazu (vor ihm aus glob.DT
 *   gemerkt — stepEnd schreibt dort schon das nächste) und vergibt, wenn ein
 *   Bild fällig ist, den nächsten Platz des Bündels. Auf Wunsch (Prüfstand)
 *   nimmt sie den Zustand jetzt in den letzten Platz auf, ohne die Uhr zu stellen.
 * - bkCells: vier Zellen je Faden, ein u32 je Byte-Ebene; die Maxima von Druck
 *   und Geschwindigkeit mit atomicMax im Kopf des Platzes.
 * - bkLiqSplat, bkLiqExt ×3, bkLiqBlurX, bkLiqOut: die Flüssigkeit wie
 *   sampleLiquid (die Fortsetzung unter den Körpern liest und schreibt getrennte
 *   Puffer — die CPU rechnet sie an Ort und Stelle: neben Körpern weicht sie ab).
 * - bkArrows, bkBubbles, bkQuads (Temperatur, Glühen und Kruste der Vierecke aus
 *   den Treppenzellen, wie GpuState.download → collect sie hinterliesse).
 * - Mit genauen Anteilen (K.body; freie Körper, schmelzendes Eis, seit
 *   2026-10-26) statt der festen Masken und bkQuads: bkTexB (die Texel in einem
 *   Körper, je Bild) und bkBodyB (je innere Zelle das ganze Viereck, je
 *   Rechteck der Umriss, ihre Zahl im Kopf — aus den Puffern der Körper).
 *
 * Jeder Kern kehrt sofort zurück, wenn kein Bild fällig ist, und schreibt nur
 * seine eigenen Ausgaben (kein Feld, das ein Kern liest, schreibt er im selben
 * Aufruf). Alles, was von der Szene abhängt, steht im Uniform K: der Text der
 * Kerne ist für jede Szene derselbe (der Shader-Cache des Browsers greift).
 *
 * Gerundet wird wie auf der CPU: Math.round als floor(x + 0,5), die Bytes der
 * Flüssigkeit abgeschnitten (Uint8Array).
 */

import { RHO_CRYSTAL } from '../engine/solution';
import { FOG_REF, PRES_TOP, SALT_FULL, SPEED_TOP, T_BASE, T_STEP, VAPOUR_FULL } from '../render/layers';
import { T_SCALE } from '../render/palette';
import type { KernelDef } from './kernel';
import { BODY_ACCESS } from './kbodylib';
import { f } from './lib';

/** Einheiten der Uhr je Sekunde: 60·2²⁴ (Bilder bei 15, 30 und 60 je Sekunde liegen auf ganzen Einheiten). */
export const CLOCK_UNITS = 60 * 2 ** 24;

/** Die Wörter von bkc (u32): Uhr, fällig, Bilder im Bündel, Platz, verlorene Bilder, nächstes Bild, Zahl der Bilder, gemerktes Δt, Einblendungen, Probe. */
export const BKC = { LO: 0, HI: 1, DUE: 2, K: 3, SLOT: 7, LOST: 8, NEXT_LO: 9, NEXT_HI: 10, FRAMES: 11, DT: 12, OV: 13, PROBE: 14 } as const;
export const BKC_WORDS = 16;
/** Wörter je Kopf eines Platzes: Uhr (lo), Druck- und Geschwindigkeitsmaximum (Stufen), Blasen, Nummer des Bildes, Uhr (hi); mit genauen Anteilen die Vierecke und Rechtecke des Bildes. */
export const HEAD_WORDS = 8;
export const HEAD = { LO: 0, PMAX: 1, VMAX: 2, NB: 3, INDEX: 4, HI: 5, NQ: 6, NR: 7 } as const;
/** Wörter des Uniforms K (die Reihenfolge wie im Struct Bk unten). */
export const BK_WORDS = 28;

const MAIN = '@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)';

const COMMON = `
struct Bk {
  sw: u32, kmax: u32, period: u32, bcap: u32,
  oFlags: u32, oCrust: u32, oGlow: u32, oTemp: u32,
  oPres: u32, oSpeed: u32, oHum: u32, oVap: u32,
  oFog: u32, oLiq: u32, oArw: u32, oBub: u32,
  oQuad: u32, nq: u32, na: u32, nax: u32,
  astep: u32, ahalf: u32, every: u32, body: u32,
  oRect: u32, ncell: u32, pad1: u32, pad2: u32,
}
fn rnd(x: f32) -> f32 { return floor(x + 0.5); }
fn u8q(x: f32) -> u32 { return u32(floor(255.0 * clamp(x, 0.0, 1.0) + 0.5)); }
fn tq(T: f32) -> u32 { return u32(clamp(rnd((T - ${f(T_BASE)}) / ${f(T_STEP)}), 0.0, 65535.0)); }
fn crustCov(m: f32, size: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${f(RHO_CRYSTAL)} * size * P.depth) / size)); }
fn velQ(u: f32) -> i32 { return i32(rnd(127.0 * sign(u) * sqrt(min(1.0, abs(u) / ${f(SPEED_TOP)})))); }
`;

export const CAPTURE_KERNELS: readonly KernelDef[] = [
  {
    /* Ein Faden nach jedem Schritt. Im Prüfmodus (bkc[PROBE]): der Zustand jetzt in den Platz kmax, alle Ebenen, die Uhr bleibt. */
    name: 'bkClock', wg: 64,
    bind: 'P:u K:u<Bk> glob:r bkc:w<u32> bkh:a',
    code: `${COMMON}
${MAIN} {
  if (gid.x != 0u) { return; }
  bkc[2] = 0u;
  if (bkc[14] != 0u) {
    let ps = K.kmax;
    bkc[2] = 1u;
    bkc[7] = ps;
    bkc[13] = 1u;
    atomicStore(&bkh[ps * 8u], bkc[0]);
    atomicStore(&bkh[ps * 8u + 1u], 0u);
    atomicStore(&bkh[ps * 8u + 2u], 0u);
    atomicStore(&bkh[ps * 8u + 3u], 0u);
    atomicStore(&bkh[ps * 8u + 4u], 0xffffffffu);
    atomicStore(&bkh[ps * 8u + 5u], bkc[1]);
    return;
  }
  let lo0 = bkc[0];
  let lo = lo0 + bkc[12];
  var hi = bkc[1];
  if (lo < lo0) { hi += 1u; }
  bkc[0] = lo;
  bkc[1] = hi;
  bkc[12] = u32(round(glob[G_DT] * ${f(CLOCK_UNITS)}));
  let nlo = bkc[9];
  let nhi = bkc[10];
  if (hi > nhi || (hi == nhi && lo >= nlo)) {
    let idx = bkc[11];
    let k = bkc[3];
    if (k < K.kmax) {
      bkc[2] = 1u;
      bkc[7] = k;
      bkc[3] = k + 1u;
      bkc[13] = select(0u, 1u, idx % K.every == 0u);
      atomicStore(&bkh[k * 8u], lo);
      atomicStore(&bkh[k * 8u + 1u], 0u);
      atomicStore(&bkh[k * 8u + 2u], 0u);
      atomicStore(&bkh[k * 8u + 3u], 0u);
      atomicStore(&bkh[k * 8u + 4u], idx);
      atomicStore(&bkh[k * 8u + 5u], hi);
    } else { bkc[8] = bkc[8] + 1u; }
    bkc[11] = idx + 1u;
    let n2 = nlo + K.period;
    var h2 = nhi;
    if (n2 < nlo) { h2 += 1u; }
    bkc[9] = n2;
    bkc[10] = h2;
  }
}`
  },
  {
    /* Die Zellen: Art und Werkstoff (eine Treppenzelle eines Körpers ohne Werkstoff — den zeichnen seine Vierecke), Kruste, Glühen, Nebel; in Bildern mit Einblendungen auch Merkmale, Temperatur, Druck, Geschwindigkeit, Feuchte, Dampf. */
    name: 'bkCells', wg: 128,
    bind: 'P:u K:u<Bk> bkc:r<u32> cf:r cu:r ff:r reg:r bkm:r<u32> bko:w<u32> bkh:a',
    code: `${COMMON}
${MAIN} {
  if (bkc[2] == 0u) { return; }
  let w = gid.x;
  let n = P.n;
  if (w >= (n + 3u) / 4u) { return; }
  let ov = bkc[13] != 0u;
  let slot = bkc[7];
  let base = slot * K.sw;
  var code = 0u; var flags = 0u; var crust = 0u; var glow = 0u; var t01 = 0u; var t23 = 0u;
  var pres = 0u; var speed = 0u; var hum = 0u; var vap = 0u; var fog = 0u;
  var pm = 0u; var vm = 0u;
  for (var k = 0u; k < 4u; k++) {
    let c = 4u * w + k;
    if (c >= n) { break; }
    let kind = cu[U_KIND * n + c];
    let sol = cu[U_SOLID * n + c];
    /* Ein Körper zeichnet sich selbst: die Treppenzellen (bkm) — mit genauen Anteilen die Zellen, die ein Körper besitzt (wie sampleLayers: owner). */
    var mine = bkm[c] != 0u;
    if (K.body != 0u) { mine = cu[U_OWNER * n + c] != 0u; }
    let built = kind == SOLID && sol != 0u && !mine;
    let T = cf[F_T * n + c];
    let i = ci(c);
    let j = cj(c);
    let cd = kind + 4u * select(0u, sol, built);
    var gl = 0u;
    if (built) { gl = u8q((T - T0 - 60.0) / 340.0); }
    var cr = 0u;
    if (built) { cr = u8q(crustCov(cf[F_CRUST * n + c], P.dx)); }
    else if (kind != SOLID && j == 0) {
      let fm = cf[F_FLOOR * n + u32(i)];
      if (fm > 0.0) { cr = u8q(crustCov(fm, P.dx)); }
    }
    var p = 128u; var s = 0u; var hu = 0u; var va = 0u; var fo = 0u; var fl = 0u; var tqv = 0u;
    if (kind == GAS) {
      let vg = max(1e-12, cf[F_VGAS * n + c]);
      let fgv = cf[F_MF * n + c] / vg;
      if (fgv > 0.0) { fo = u8q(min(0.95, 1.0 - exp(-fgv / ${f(FOG_REF)}))); }
    }
    if (ov) {
      if (kind != LIQUID) { tqv = tq(T); }
      fl = select(0u, 1u, cf[F_ALPHA * n + c] > 0.02);
      if (kind == GAS) {
        let pg = cf[F_PG * n + c];
        let pq = 128 + i32(rnd(127.0 * sign(pg) * sqrt(min(1.0, abs(pg) / ${f(PRES_TOP)}))));
        p = u32(pq);
        pm = max(pm, u32(abs(pq - 128)));
        let og = FF_UG * P.nf;
        let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
        let v = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
        s = u32(rnd(255.0 * sqrt(min(1.0, sqrt(u * u + v * v) / ${f(SPEED_TOP)}))));
        vm = max(vm, s);
        let mv = cf[F_MV * n + c];
        let nd = cf[F_MN * n + c] / M_N2 + cf[F_MO * n + c] / M_O2;
        let nv = mv / M_H2O;
        var x = 0.0;
        if (nv + nd > 0.0) { x = nv / (nv + nd); }
        hu = u32(rnd(63.0 * clamp(x * pAt(c) / pSat(T), 0.0, 1.0)));
        va = u8q(mv / max(1e-12, cf[F_VGAS * n + c]) / ${f(VAPOUR_FULL)});
      }
    }
    let sh = 8u * k;
    code |= cd << sh; crust |= cr << sh; glow |= gl << sh; fog |= fo << sh;
    flags |= fl << sh; pres |= p << sh; speed |= s << sh; hum |= hu << sh; vap |= va << sh;
    if (k < 2u) { t01 |= tqv << (16u * k); } else { t23 |= tqv << (16u * (k - 2u)); }
  }
  bko[base + w] = code;
  bko[base + K.oCrust + w] = crust;
  bko[base + K.oGlow + w] = glow;
  bko[base + K.oFog + w] = fog;
  if (!ov) { return; }
  bko[base + K.oFlags + w] = flags;
  bko[base + K.oTemp + 2u * w] = t01;
  bko[base + K.oTemp + 2u * w + 1u] = t23;
  bko[base + K.oPres + w] = pres;
  bko[base + K.oSpeed + w] = speed;
  bko[base + K.oHum + w] = hum;
  bko[base + K.oVap + w] = vap;
  if (pm > 0u) { atomicMax(&bkh[slot * 8u + 1u], pm); }
  if (vm > 0u) { atomicMax(&bkh[slot * 8u + 2u], vm); }
}`
  },
  {
    /* Die Flüssigkeit auf halben Zellen: Volumen der Teilchen mit dem quadratischen B-Spline gesammelt (wie sampleLiquid verteilt), dazu Σ w T, Σ w Öl, Σ w Salzanteil. */
    name: 'bkLiqSplat', wg: 128,
    bind: 'P:u bkc:r<u32> lq:w parts:r ccount:r cstart:r bsum:r',
    code: `${MAIN} {
  if (bkc[2] == 0u) { return; }
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
  var w = 0.0; var wt = 0.0; var wo = 0.0; var wsl = 0.0;
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
        if (((parts[pk].flags >> 8u) & 255u) != 0u) { wo += vp; }
        wsl += vp * parts[pk].s / m;
      }
    }
  }
  lq[4u * t] = w; lq[4u * t + 1u] = wt; lq[4u * t + 2u] = wo; lq[4u * t + 3u] = wsl;
}`
  },
  {
    /* Unter den Körpern: ein Texel, dessen Mitte in einem Körper liegt, nimmt die grösste Bedeckung eines Nachbarn (mit ihrer Temperatur, Öl, Salz) — aus lqa gelesen, nach lqb geschrieben. */
    name: 'bkLiqExt', wg: 128,
    bind: 'P:u bkc:r<u32> lqa:r lqb:w bkt:r<u32>',
    code: `${MAIN} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  var src = t;
  if (bkt[t] != 0u) {
    let I = t % lx;
    let J = t / lx;
    var best = 0xffffffffu;
    var bw = lqa[4u * t];
    if (I > 0u && lqa[4u * (t - 1u)] > bw) { best = t - 1u; bw = lqa[4u * best]; }
    if (I + 1u < lx && lqa[4u * (t + 1u)] > bw) { best = t + 1u; bw = lqa[4u * best]; }
    if (J > 0u && lqa[4u * (t - lx)] > bw) { best = t - lx; bw = lqa[4u * best]; }
    if (J + 1u < ly && lqa[4u * (t + lx)] > bw) { best = t + lx; bw = lqa[4u * best]; }
    if (best != 0xffffffffu) { src = best; }
  }
  for (var k = 0u; k < 4u; k++) { lqb[4u * t + k] = lqa[4u * src + k]; }
}`
  },
  {
    name: 'bkLiqBlurX', wg: 128,
    bind: 'P:u bkc:r<u32> lqa:r lq2:w',
    code: `${MAIN} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lqa[4u * l + k] + 0.5 * lqa[4u * t + k] + 0.25 * lqa[4u * r + k]; }
}`
  },
  {
    /* Weichzeichner in y, dann die Bytes RGBA: Bedeckung, Temperatur auf T_SCALE, Anteil Öl, Anteil Salz auf SALT_FULL (abgeschnitten wie Uint8Array). */
    name: 'bkLiqOut', wg: 128,
    bind: 'P:u K:u<Bk> bkc:r<u32> lq2:r bko:w<u32>',
    code: `${COMMON}
${MAIN} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let J = t / lx;
  let b = select(t, t - lx, J > 0u);
  let u = select(t, t + lx, J + 1u < ly);
  let w = 0.25 * lq2[4u * b] + 0.5 * lq2[4u * t] + 0.25 * lq2[4u * u];
  let wt = 0.25 * lq2[4u * b + 1u] + 0.5 * lq2[4u * t + 1u] + 0.25 * lq2[4u * u + 1u];
  let wo = 0.25 * lq2[4u * b + 2u] + 0.5 * lq2[4u * t + 2u] + 0.25 * lq2[4u * u + 2u];
  let wsl = 0.25 * lq2[4u * b + 3u] + 0.5 * lq2[4u * t + 3u] + 0.25 * lq2[4u * u + 3u];
  let R = u32(floor(clamp(255.0 * w, 0.0, 255.0)));
  var G = 0u; var Bc = 0u; var A = 0u;
  if (w > 0.0) {
    G = u32(floor(clamp(255.0 * (wt / w - T0 - ${f(T_SCALE[0])}) / ${f(T_SCALE[1] - T_SCALE[0])}, 0.0, 255.0)));
    Bc = u32(floor(clamp(255.0 * wo / w, 0.0, 255.0)));
    A = u32(floor(clamp(255.0 * wsl / (w * ${f(SALT_FULL)}), 0.0, 255.0)));
  }
  bko[bkc[7] * K.sw + K.oLiq + t] = R | (G << 8u) | (Bc << 16u) | (A << 24u);
}`
  },
  {
    /* Pfeile (nur in Bildern mit Einblendungen): die Geschwindigkeit von Gas oder Wasser an den Punkten des groben Rasters, zwei Punkte je Wort. */
    name: 'bkArrows', wg: 64,
    bind: 'P:u K:u<Bk> bkc:r<u32> cu:r ff:r bko:w<u32>',
    code: `${COMMON}
${MAIN} {
  if (bkc[2] == 0u || bkc[13] == 0u) { return; }
  let w = gid.x;
  if (w >= (K.na + 1u) / 2u) { return; }
  var word = 0u;
  for (var k = 0u; k < 2u; k++) {
    let qq = 2u * w + k;
    if (qq >= K.na) { break; }
    let i = i32(K.ahalf + (qq % K.nax) * K.astep);
    let j = i32(K.ahalf + (qq / K.nax) * K.astep);
    let c = cellOf(i, j);
    let kind = cu[U_KIND * P.n + c];
    var qu = 0; var qv = 0;
    if (kind == GAS || kind == LIQUID) {
      let o = select(FF_UG, FF_UL, kind == LIQUID) * P.nf;
      qu = velQ(0.5 * (ff[o + uF(i, j)] + ff[o + uF(i + 1, j)]));
      qv = velQ(0.5 * (ff[o + vF(i, j)] + ff[o + vF(i, j + 1)]));
    }
    word |= ((u32(qu) & 255u) | ((u32(qv) & 255u) << 8u)) << (16u * k);
  }
  bko[bkc[7] * K.sw + K.oArw + w] = word;
}`
  },
  {
    /* Blasen (dicht nach bubCompact): Ort, Radius in µm, Luftanteil — je 16 bit. Eine Blase, die danach verging, bekommt den Radius 0 (unsichtbar). */
    name: 'bkBubbles', wg: 128,
    bind: 'P:u K:u<Bk> bkc:r<u32> cnt:r<u32> bubs:r bko:w<u32> bkh:a',
    code: `${COMMON}
${MAIN} {
  if (bkc[2] == 0u) { return; }
  let b = gid.x;
  let slot = bkc[7];
  let count = min(cnt[C_BCOUNT], K.bcap);
  if (b == 0u) { atomicStore(&bkh[slot * 8u + 3u], count); }
  if (b >= count) { return; }
  let Bb = bubs[b];
  let x = u32(rnd(65535.0 * clamp(Bb.x / P.boxw, 0.0, 1.0)));
  let y = u32(rnd(65535.0 * clamp(Bb.y / P.boxh, 0.0, 1.0)));
  var r = u32(min(65535.0, rnd(Bb.r * 1e6)));
  if (Bb.alive == 0u) { r = 0u; }
  let tot = Bb.mN + Bb.mO + Bb.mV;
  var air = 0u;
  if (tot > 0.0) { air = u32(rnd(65535.0 * (Bb.mN + Bb.mO) / tot)); }
  bko[slot * K.sw + K.oBub + 2u * b] = x | (y << 16u);
  bko[slot * K.sw + K.oBub + 2u * b + 1u] = r | (air << 16u);
}`
  },
  {
    /* Die Vierecke der (angehefteten) Körper, wie GpuState.download → fromStair → collect sie hinterliesse (der lineare Teil von coverCollect.ts):
       T_k = T_k(0) + Σ w (T_c − T_c(0)) über ihre Treppenzellen, Kruste_k = Kruste_k(0) + Σ (w/Σw) (Kruste_c − Kruste_c(0)), mindestens 0;
       der Bezug (0) vom letzten Schlüsselbild, c0: erst T_c aller Zellen, dann ihre Kruste. */
    name: 'bkQuads', wg: 64,
    bind: 'P:u K:u<Bk> bkc:r<u32> cf:r bkm:r<u32> qs:r<u32> qc:r<u32> qw:r qx:r q0:r c0:r bko:w<u32>',
    code: `${COMMON}
${MAIN} {
  if (bkc[2] == 0u) { return; }
  let qd = gid.x;
  if (qd >= K.nq) { return; }
  var T = q0[3u * qd];
  var Kc = q0[3u * qd + 1u];
  for (var e = qs[qd]; e < qs[qd + 1u]; e++) {
    let c = qc[e];
    if (bkm[c] == 0u) { continue; }
    T += qw[e] * (cf[F_T * P.n + c] - c0[c]);
    Kc += qx[e] * (cf[F_CRUST * P.n + c] - c0[P.n + c]);
  }
  let gl = u8q((T - T0 - 60.0) / 340.0);
  let cr = u8q(crustCov(max(Kc, 0.0), q0[3u * qd + 2u]));
  bko[bkc[7] * K.sw + K.oQuad + qd] = gl | (cr << 8u) | (tq(T) << 16u);
}`
  },
  {
    /* Mit genauen Anteilen (Körper in Bewegung, schmelzendes Eis; seit 2026-10-26): die Texel, deren Mitte in einem Körper liegt — in jedem
       Bild neu aus den Puffern der Körper (layers.extendUnderBodies; die Lage nach dem Schritt). */
    name: 'bkTexB', wg: 128,
    bind: 'P:u bkc:r<u32> bod:r bgeo:r bkt:w<u32>',
    code: `${BODY_ACCESS}
fn inBodiesT(x: f32, y: f32) -> bool {
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    let dx = x - bv(b, B_X);
    let dy = y - bv(b, B_Y);
    let rm = bv(b, B_RMAX) + 1e-6;
    if (dx * dx + dy * dy > rm * rm) { continue; }
    let a = bv(b, B_A);
    let c = cos(a);
    let s = sin(a);
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
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let h = 0.5 * P.dx;
  bkt[t] = select(0u, 1u, inBodiesT((f32(t % lx) + 0.5) * h, (f32(t / lx) + 0.5) * h));
}`
  },
  {
    /* Mit genauen Anteilen: je innere Zelle ihr Viereck (Mitte, Grösse, Winkel, Werkstoff, Glühen und Kruste, Temperatur — wie sampleBodies), je
       Rechteck sein Umriss (ein Faden, es sind wenige), die Zahlen im Kopf — aus den Puffern der Körper nach dem Schritt (Lage, Grenzen, Energie). */
    name: 'bkBodyB', wg: 64,
    bind: 'P:u K:u<Bk> bkc:r<u32> bod:r bgeo:r bcell:r bko:w<u32> bkh:a',
    code: `${COMMON}
${BODY_ACCESS}
fn cellTK(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
fn angQ(a: f32) -> u32 { let t = a / ${f(2 * Math.PI)} + 0.5; return u32(rnd(65535.0 * (t - floor(t)))) & 65535u; }
fn posQ(v: f32, w: f32) -> u32 { return u32(rnd(65535.0 * clamp(v / w, 0.0, 1.0))); }
fn putU16(w0: u32, i: u32, v: u32) {
  let w = w0 + i / 2u;
  if ((i & 1u) == 0u) { bko[w] = (bko[w] & 0xffff0000u) | v; } else { bko[w] = (bko[w] & 0xffffu) | (v << 16u); }
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let slot = bkc[7];
  let base = slot * K.sw;
  if (t == 0u) {
    var nq = 0u;
    var nr = 0u;
    for (var b = 0u; b < P.nbody; b++) {
      if (bGone(b)) { continue; }
      nq += u32(bv(b, B_NCELL));
      let a = bv(b, B_A);
      let c = cos(a);
      let s = sin(a);
      let nrb = u32(bv(b, B_NR));
      for (var r = 0u; r < nrb; r++) {
        let bx = rBox(rectOf(b, r));
        let lx = 0.5 * (bx.x + bx.z);
        let ly = 0.5 * (bx.y + bx.w);
        let o = base + K.oRect;
        putU16(o, 5u * nr, posQ(bv(b, B_X) + c * lx - s * ly, P.boxw));
        putU16(o, 5u * nr + 1u, posQ(bv(b, B_Y) + s * lx + c * ly, P.boxh));
        putU16(o, 5u * nr + 2u, min(65535u, u32(rnd(5e4 * (bx.z - bx.x)))));
        putU16(o, 5u * nr + 3u, min(65535u, u32(rnd(5e4 * (bx.w - bx.y)))));
        putU16(o, 5u * nr + 4u, angQ(a));
        nr += 1u;
      }
    }
    atomicStore(&bkh[slot * 8u + 6u], nq);
    atomicStore(&bkh[slot * 8u + 7u], nr);
  }
  if (t >= K.ncell) { return; }
  let rq = u32(bcell[BC * t + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let local = t - u32(bv(b, B_KO));
  if (local >= u32(bv(b, B_NCELL))) { return; }
  var qi = local;
  for (var o = 0u; o < b; o++) { if (!bGone(o)) { qi += u32(bv(o, B_NCELL)); } }
  let loc = t - u32(rv(rq, GR_KO));
  let ni = u32(rv(rq, GR_NI));
  let p = loc % ni;
  let q = loc / ni;
  let x0 = rxs(rq, p);
  let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q);
  let y1 = rys(rq, q + 1u);
  let a = bv(b, B_A);
  let c = cos(a);
  let s = sin(a);
  let lx = 0.5 * (x0 + x1);
  let ly = 0.5 * (y0 + y1);
  let mb = u32(bv(b, B_MAT)) + 1u;
  let C = solidRho(mb) * solidCp(mb) * P.depth * (x1 - x0) * (y1 - y0);
  let crust = bcell[BC * t + 2u];
  let T = cellTK(bcell[BC * t], C, bcell[BC * t + 1u], crust);
  let gl = u8q((T - T0 - 60.0) / 340.0);
  let cr = u8q(crustCov(crust, max(1e-6, min(x1 - x0, y1 - y0))));
  let o4 = base + K.oQuad + 4u * qi;
  bko[o4] = posQ(bv(b, B_X) + c * lx - s * ly, P.boxw) | (posQ(bv(b, B_Y) + s * lx + c * ly, P.boxh) << 16u);
  bko[o4 + 1u] = min(65535u, u32(rnd(5e5 * (x1 - x0)))) | (min(65535u, u32(rnd(5e5 * (y1 - y0)))) << 16u);
  bko[o4 + 2u] = angQ(a) | (mb << 16u);
  bko[o4 + 3u] = gl | (cr << 8u) | (tq(T) << 16u);
}`
  }
];
