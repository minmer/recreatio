/**
 * LABOR 2D (v2) — DIE EBENEN EINES BILDES (B, Backen): was von einem Zustand
 * sichtbar ist, unabhängig von der Einblendung und schon in der Genauigkeit,
 * in der ein Nachweis (clip/) es speichert. Aus ihnen setzt composeFrame das
 * Bild für die gewählte Einblendung zusammen — live wie bei der Wiedergabe;
 * darum zeigt ein abgespielter Nachweis genau, was live zu sehen war.
 *
 * - Je Zelle: Art und Werkstoff (code), Blasen da (flags), Salzkruste bzw.
 *   Salz am Boden der Kiste (crust), Glühen der Feststoffe (glow),
 *   Temperatur von Gas und Feststoff (temp, 0,5 K), und für die Einblendungen
 *   im Gas: Druck und Geschwindigkeit (pres, speed: 8 bit auf fester,
 *   quadratischer Skala), Feuchte (hum, 64 Stufen), Dampfdichte (vap), Nebel
 *   (fog, als Deckkraft).
 * - Die Flüssigkeit auf halben Zellen (wie bisher die Flüssigkeitstextur):
 *   Bedeckung, Temperatur, Anteil Öl, Anteil Salz.
 * - Pfeile: die Geschwindigkeit an den Punkten des groben Pfeilrasters
 *   (8 bit je Richtung, quadratisch).
 * - Blasen: Ort, Radius (µm) und Luftanteil, je 16 bit.
 * - Körper (seit 2026-10-23 genaue Rechtecke, nicht Zellen): je innere Zelle
 *   ein gedrehtes Viereck (Mitte, halbe Seiten, Winkel, Werkstoff, Glühen,
 *   Kruste, Temperatur — je 16 bit) und je Rechteck sein Umriss. Zellen, die
 *   ein Körper füllt, zeichnet die Zelltextur nicht (sie zeigte Treppen).
 *
 * Live rechnet sampleLayers nur, was die Einblendung braucht; für einen
 * Nachweis alles (overlay = null).
 */

import { Body2D } from '../engine/body';
import type { Engine } from '../engine/engine';
import { pSatFast } from '../engine/if97';
import { MOLAR, SOLIDS, WATER } from '../engine/materials';
import { RHO_CRYSTAL, SOLUTES } from '../engine/solution';
import { GAS, H2O, LIQUID, N2, O2, SOLID, SPECIES_SLOTS, T0 } from '../engine/units';
import { hex, T_SCALE, viridis } from './palette';

export type Overlay = 'none' | 'temperature' | 'pressure' | 'velocity' | 'humidity' | 'vapour' | 'salt' | 'phase';
export const OVERLAYS: readonly Overlay[] = ['none', 'temperature', 'pressure', 'velocity', 'humidity', 'vapour', 'salt', 'phase'];
/** Massenanteil des Salzes, bei dem die Einblendung „Stężenie“ das Ende ihrer Farbskala erreicht (gesättigt sind 26,4 % bei 25 °C). */
export const SALT_FULL = 0.3;
/** Dampfdichte, bei der die Einblendung „Para wodna“ voll deckt (kg/m³): gesättigter Dampf bei 100 °C hat 0,598 (IAPWS). */
export const VAPOUR_FULL = 0.6;
/** Die Temperatur der Zellen aus Gas und Feststoff: (T − T_BASE)/T_STEP in 16 bit (Stufen von 0,5 K — die Farbskala hat 0,47 K je Stufe; in der Flüssigkeit zeigt die Farbe die Teilchen). */
export const T_BASE = 150;
export const T_STEP = 0.5;
/** Die Feuchte in 64 Stufen (die Einblendung deckt mit 0,86 × Feuchte). */
const humQ = (x: number): number => Math.round(63 * Math.min(1, Math.max(0, x)));
/*
 * Geschwindigkeit (m/s) und Druck gegenüber p0 (Pa) in 8 bit auf einer festen
 * Skala, quadratisch (feine Stufen bei kleinen Werten): ein Wert ändert sich
 * im Nachweis nur, wo er sich ändert — nicht, weil das Maximum des Bildes
 * wandert (so packt der Unterschied zum vorigen Bild gut).
 */
export const SPEED_TOP = 2;
export const PRES_TOP = 1000;
const speedQ = (s: number): number => Math.round(255 * Math.sqrt(Math.min(1, s / SPEED_TOP)));
export const speedOf = (q: number): number => SPEED_TOP * (q / 255) ** 2;
const presQ = (p: number): number => 128 + Math.round(127 * Math.sign(p) * Math.sqrt(Math.min(1, Math.abs(p) / PRES_TOP)));
export const presOf = (q: number): number => PRES_TOP * Math.sign(q - 128) * ((q - 128) / 127) ** 2;
/** Eine Komponente der Geschwindigkeit an einem Pfeil (vorzeichenbehaftet, 8 bit, quadratisch). */
const velQ = (u: number): number => Math.round(127 * Math.sign(u) * Math.sqrt(Math.min(1, Math.abs(u) / SPEED_TOP)));
export const velOf = (q: number): number => SPEED_TOP * Math.sign(q) * (q / 127) ** 2;

export interface Layers {
  nx: number;
  ny: number;
  dx: number;
  depth: number;
  boxW: number;
  boxH: number;
  /** Simulationszeit der Probe (s). */
  t: number;
  /** Art (0 Gas, 1 Flüssigkeit, 2 Feststoff) + 4 × Werkstoff (1-basiert, 0 ohne). */
  code: Uint8Array;
  /** Bit 0: Blasen füllen mehr als 2 % der Zelle (Mapa stanów). */
  flags: Uint8Array;
  /** Deckung der Salzkruste (Feststoffe) bzw. des Salzes am Boden der Kiste (unterste Zeile), 0–255. */
  crust: Uint8Array;
  /** Glühen eines Feststoffs (über 60 °C, voll bei 400 °C), 0–255 — fürs Bild ohne Einblendung. */
  glow: Uint8Array;
  temp: Uint16Array;
  pres: Uint8Array;
  speed: Uint8Array;
  hum: Uint8Array;
  vap: Uint8Array;
  fog: Uint8Array;
  /** 2nx × 2ny, RGBA: Bedeckung, Temperatur (auf T_SCALE), Anteil Öl, Anteil Salz (auf SALT_FULL). */
  liquid: Uint8Array;
  /** Je Punkt des Pfeilrasters u und v (velQ). */
  arrows: Int8Array;
  pmax: number;
  vmax: number;
  vGas: number;
  vLiq: number;
  nb: number;
  /** Je Blase: x und y (Bruchteil der Kiste × 65535), Radius (µm), Luftanteil × 65535. */
  bubbles: Uint16Array;
  /** Je innere Zelle eines Körpers (QUAD Werte): Mitte (Bruchteil der Kiste × 65535), Breite und Höhe (2 µm), Winkel (angleQ), Werkstoff + 1, Glühen | Kruste << 8, Temperatur (wie temp). */
  nq: number;
  quads: Uint16Array;
  /** Je Rechteck eines Körpers (RECT Werte): Mitte, Breite und Höhe (20 µm), Winkel — sein Umriss. */
  nr: number;
  rects: Uint16Array;
}

/** Werte je Viereck und je Rechteck in den Ebenen. */
export const QUAD = 8;
export const RECT = 5;
/** Ein Winkel (rad) in 16 bit: (a/2π + ½) mod 1 — und zurück. */
const angleQ = (a: number): number => { let t = a / (2 * Math.PI) + 0.5; t -= Math.floor(t); return Math.round(65535 * t) & 65535; };
export const angleOf = (q: number): number => (q / 65535 - 0.5) * 2 * Math.PI;

/** Wie viele innere Zellen und Rechtecke die Körper der Engine haben (für die Grösse der Puffer). */
export function bodyCounts(e: Engine): { quads: number; rects: number } {
  let quads = 0;
  let rects = 0;
  for (const b of e.bodies.list) if (!b.gone) { quads += b.ncell; rects += b.nr; }
  return { quads, rects };
}

/** Abstand der Pfeile (m): etwa alle 6 mm einer, mindestens alle zwei Zellen. */
const ARROW_SPACING = 0.006;
export const arrowStep = (dx: number): number => Math.max(2, Math.round(ARROW_SPACING / dx));
/** Die Punkte des Pfeilrasters: (i, j) für i = h, h + s, …; j ebenso (h = s/2). */
export function arrowPoints(nx: number, ny: number, dx: number): number {
  const s = arrowStep(dx);
  const h = s >> 1;
  return Math.max(0, Math.ceil((nx - h) / s)) * Math.max(0, Math.ceil((ny - h) / s));
}

export function allocLayers(nx: number, ny: number, dx: number, bubbles = 64): Layers {
  const n = nx * ny;
  return {
    nx, ny, dx, depth: 0, boxW: 0, boxH: 0, t: 0,
    code: new Uint8Array(n), flags: new Uint8Array(n), crust: new Uint8Array(n), glow: new Uint8Array(n), temp: new Uint16Array(n),
    pres: new Uint8Array(n), speed: new Uint8Array(n), hum: new Uint8Array(n), vap: new Uint8Array(n), fog: new Uint8Array(n),
    liquid: new Uint8Array(16 * n),
    arrows: new Int8Array(2 * arrowPoints(nx, ny, dx)),
    pmax: 1, vmax: 0.02, vGas: 0, vLiq: 0,
    nb: 0, bubbles: new Uint16Array(4 * Math.max(16, bubbles)),
    nq: 0, quads: new Uint16Array(QUAD * 64), nr: 0, rects: new Uint16Array(RECT * 16)
  };
}

/** Passen die Ebenen noch zu dieser Engine? */
export function layersFit(L: Layers, e: Engine): boolean {
  return L.nx === e.grid.nx && L.ny === e.grid.ny && L.dx === e.grid.dx && L.bubbles.length >= 4 * e.bubbles.count;
}

/** Deckung einer Salzkruste (0–1) aus ihrer Masse: die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel (dünne Krusten bleiben sichtbar). */
function crustCover(m: number, dx: number, depth: number): number {
  return m > 0 ? Math.min(1, Math.sqrt(m / (RHO_CRYSTAL * dx * depth) / dx)) : 0;
}

/*
 * Deckkraft des Nebels nach Beer–Lambert: α = 1 − exp(−β·L), β = 3·Q·LWC/(4·ρ_w·r)
 * für Tröpfchen vom Radius r mit Extinktionseffizienz Q ≈ 2 (geometrische
 * Optik; Bohren & Huffman 1983, Kap. 4). Annahmen (Modellparameter, keine
 * Messung): frisch kondensierter Dampfnebel mit r ≈ 1,5 µm; Sichtweg L = 7 cm
 * (so breit wie eine Zlewka — wie man eine Dampffahne sieht) statt der 1 cm
 * der Schicht, durch die echter Nebel fast unsichtbar wäre (SIMPLIFICATIONS.md).
 * Ergibt LWC_ref = 4·ρ_w·r/(3·Q·L) ≈ 14 g/m³: 3 g/m³ → 19 %, 10 g/m³ → 50 %,
 * 15 g/m³ → 65 % (über heissem Wasser bildet die Engine 1–15 g/m³).
 */
const FOG_REF = (4 * 1000 * 1.5e-6) / (3 * 2 * 0.07);
const u8 = (x: number): number => Math.round(255 * Math.min(1, Math.max(0, x)));

let lw = new Float32Array(0);
let lt = new Float32Array(0);
/** Volumen der anderen Flüssigkeit (Öl) je Texel. */
let lo = new Float32Array(0);
/** Volumen mal Salzanteil je Texel. */
let ls = new Float32Array(0);
let tmp = new Float32Array(0);
/** Texel, deren Mitte in einem Körper liegt (1). */
let inBody = new Uint8Array(0);
const local = new Float64Array(2);
const wbox = new Float64Array(4);

/** [1 2 1]/4 in x und in y (Ränder wiederholt) — in place, mit einem Zwischenspeicher. */
function blur121(a: Float32Array, lx: number, ly: number): void {
  for (let j = 0; j < ly; j += 1) {
    const o = j * lx;
    for (let i = 0; i < lx; i += 1) {
      const l = i > 0 ? a[o + i - 1] : a[o + i];
      const r = i < lx - 1 ? a[o + i + 1] : a[o + i];
      tmp[o + i] = 0.25 * l + 0.5 * a[o + i] + 0.25 * r;
    }
  }
  for (let j = 0; j < ly; j += 1) {
    const o = j * lx;
    const ob = j > 0 ? o - lx : o;
    const ot = j < ly - 1 ? o + lx : o;
    for (let i = 0; i < lx; i += 1) a[o + i] = 0.25 * tmp[ob + i] + 0.5 * tmp[o + i] + 0.25 * tmp[ot + i];
  }
}

const vel = new Float64Array(2);
/** Geschwindigkeit in der Mitte der Zelle (i, j) aus den Flächen u, v (in vel). */
function centre(u: Float32Array, v: Float32Array, i: number, j: number, nx: number): void {
  vel[0] = 0.5 * (u[i + j * (nx + 1)] + u[i + 1 + j * (nx + 1)]);
  vel[1] = 0.5 * (v[i + j * nx] + v[i + (j + 1) * nx]);
}

/** Die Ebenen aus der Engine; overlay: nur, was diese Einblendung braucht (null: alles, für einen Nachweis). */
export function sampleLayers(e: Engine, L: Layers, overlay: Overlay | null): void {
  const g = e.grid;
  const { nx, ny, n } = g;
  const all = overlay === null;
  L.t = e.time;
  L.boxW = g.w;
  L.boxH = g.h;
  L.depth = g.depth;
  const wantP = all || overlay === 'pressure';
  const wantV = all || overlay === 'velocity';
  const wantH = all || overlay === 'humidity';
  const wantD = all || overlay === 'vapour';
  const wantA = all || overlay === 'phase';
  let pmax = 1;
  let vmax = 0.02;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      const kind = g.kind[c];
      /* Eine Zelle, die ein Körper füllt, bleibt ohne Werkstoff: der Körper selbst wird gezeichnet (sampleBodies). */
      const built = kind === SOLID && g.owner[c] === 0;
      L.code[c] = kind + 4 * (built ? g.solid[c] : 0);
      L.temp[c] = kind === LIQUID ? 0 : tempQ(g.T[c]);
      /* Heiss: Rot mischt sich bei (mit der Temperatur über 60 °C, voll bei 400 °C). */
      L.glow[c] = built ? u8((g.T[c] - T0 - 60) / 340) : 0;
      L.flags[c] = wantA && g.alpha[c] > 0.02 ? 1 : 0;
      L.crust[c] = built ? u8(crustCover(g.crust[c], g.dx, g.depth)) : kind !== SOLID && j === 0 && e.salt.floor[i] > 0 ? u8(crustCover(e.salt.floor[i], g.dx, g.depth)) : 0;
      let p = 128, s = 0, hu = 0, va = 0, fo = 0;
      if (kind === GAS) {
        if (wantP) { p = presQ(g.pg[c]); pmax = Math.max(pmax, Math.abs(presOf(p))); }
        if (wantV) { centre(g.ug, g.vg, i, j, nx); s = speedQ(Math.hypot(vel[0], vel[1])); vmax = Math.max(vmax, speedOf(s)); }
        if (wantH || wantD) {
          const mv = g.mg[H2O * n + c];
          if (wantH) {
            const nd = g.mg[N2 * n + c] / MOLAR[N2] + g.mg[O2 * n + c] / MOLAR[O2];
            const nv = mv / MOLAR[H2O];
            const x = nv + nd > 0 ? nv / (nv + nd) : 0;
            hu = humQ((x * e.regions.pAt(c)) / pSatFast(g.T[c]));
          }
          if (wantD) va = u8(mv / Math.max(1e-12, e.gas.vgas[c]) / VAPOUR_FULL);
        }
        const fog = g.mfog[c] / Math.max(1e-12, e.gas.vgas[c]);
        if (fog > 0) fo = u8(Math.min(0.95, 1 - Math.exp(-fog / FOG_REF)));
      }
      L.pres[c] = p;
      L.speed[c] = s;
      L.hum[c] = hu;
      L.vap[c] = va;
      L.fog[c] = fo;
    }
  }
  L.pmax = pmax;
  L.vmax = vmax;
  sampleLiquid(e, L);
  /* Blasen. */
  const B = e.bubbles;
  L.nb = B.count;
  for (let b = 0; b < B.count; b += 1) {
    const o = 4 * b;
    const total = B.totalMass(b);
    L.bubbles[o] = Math.round(65535 * Math.min(1, Math.max(0, B.x[b] / g.w)));
    L.bubbles[o + 1] = Math.round(65535 * Math.min(1, Math.max(0, B.y[b] / g.h)));
    L.bubbles[o + 2] = Math.min(65535, Math.round(B.r[b] * 1e6));
    L.bubbles[o + 3] = Math.round(65535 * (total > 0 ? (B.m[b * SPECIES_SLOTS + N2] + B.m[b * SPECIES_SLOTS + O2]) / total : 0));
  }
  /* Pfeile: die Geschwindigkeit an den Punkten des groben Rasters. */
  L.vGas = 0;
  L.vLiq = 0;
  if (wantV) sampleArrows(e, L);
  sampleBodies(e, L);
}

/** Die Temperatur einer Zelle oder eines Körperstücks in 16 bit (Stufen T_STEP ab T_BASE). */
const tempQ = (T: number): number => Math.min(65535, Math.max(0, Math.round((T - T_BASE) / T_STEP)));

/** Die Körper: je innere Zelle ein Viereck, je Rechteck ein Umriss (die Puffer wachsen, wenn es mehr werden). */
function sampleBodies(e: Engine, L: Layers): void {
  const g = e.grid;
  const { quads: nq, rects: nr } = bodyCounts(e);
  if (L.quads.length < QUAD * nq) L.quads = new Uint16Array(QUAD * Math.ceil(nq * 1.25 + 16));
  if (L.rects.length < RECT * nr) L.rects = new Uint16Array(RECT * Math.ceil(nr * 1.25 + 4));
  const Q = L.quads;
  const R = L.rects;
  const X = (x: number): number => Math.round(65535 * Math.min(1, Math.max(0, x / g.w)));
  const Y = (y: number): number => Math.round(65535 * Math.min(1, Math.max(0, y / g.h)));
  let q = 0;
  let r = 0;
  for (const b of e.bodies.list) {
    if (b.gone) continue;
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const ang = angleQ(b.a);
    for (let k = 0; k < b.nr; k += 1) {
      const xs = b.xs[k];
      const ys = b.ys[k];
      const ni = b.ni[k];
      const nj = b.nj[k];
      for (let jj = 0; jj < nj; jj += 1) {
        for (let ii = 0; ii < ni; ii += 1) {
          const cell = b.off[k] + ii + jj * ni;
          const lx = 0.5 * (xs[ii] + xs[ii + 1]);
          const ly = 0.5 * (ys[jj] + ys[jj + 1]);
          const T = b.cellT(cell);
          const cover = crustCover(b.crust[cell], Math.max(1e-6, Math.min(xs[ii + 1] - xs[ii], ys[jj + 1] - ys[jj])), g.depth);
          const o = QUAD * q;
          Q[o] = X(b.x + cs * lx - sn * ly);
          Q[o + 1] = Y(b.y + sn * lx + cs * ly);
          Q[o + 2] = Math.min(65535, Math.round(5e5 * (xs[ii + 1] - xs[ii])));
          Q[o + 3] = Math.min(65535, Math.round(5e5 * (ys[jj + 1] - ys[jj])));
          Q[o + 4] = ang;
          Q[o + 5] = b.mat + 1;
          Q[o + 6] = u8((T - T0 - 60) / 340) | (u8(cover) << 8);
          Q[o + 7] = tempQ(T);
          q += 1;
        }
      }
      const lx = 0.5 * (xs[0] + xs[ni]);
      const ly = 0.5 * (ys[0] + ys[nj]);
      const o = RECT * r;
      R[o] = X(b.x + cs * lx - sn * ly);
      R[o + 1] = Y(b.y + sn * lx + cs * ly);
      R[o + 2] = Math.min(65535, Math.round(5e4 * (xs[ni] - xs[0])));
      R[o + 3] = Math.min(65535, Math.round(5e4 * (ys[nj] - ys[0])));
      R[o + 4] = ang;
      r += 1;
    }
  }
  L.nq = q;
  L.nr = r;
}

/** Flüssigkeit: Bedeckung auf halben Zellen (quadratischer B-Spline), Temperatur, Öl und Salz gewichtet. */
function sampleLiquid(e: Engine, L: Layers): void {
  const g = e.grid;
  const lx = 2 * g.nx;
  const ly = 2 * g.ny;
  const nl = lx * ly;
  if (lw.length < nl) { lw = new Float32Array(nl); lt = new Float32Array(nl); lo = new Float32Array(nl); ls = new Float32Array(nl); tmp = new Float32Array(nl); }
  lw.fill(0, 0, nl);
  lt.fill(0, 0, nl);
  const P = e.particles;
  let other = false;
  let salty = false;
  for (let p = 0; p < P.count; p += 1) {
    if (P.mat[p] !== WATER) other = true;
    if (P.smass[2 * p] > 0) salty = true;
  }
  if (other) lo.fill(0, 0, nl);
  if (salty) ls.fill(0, 0, nl);
  const tmin = T_SCALE[0];
  const tspan = T_SCALE[1] - T_SCALE[0];
  const h = g.dx / 2;
  const invTexel = 1 / (h * h * g.depth);
  for (let p = 0; p < P.count; p += 1) {
    const vp = (P.mass[p] / P.rho[p]) * invTexel;
    const sx = P.x[p] / h - 0.5;
    const sy = P.y[p] / h - 0.5;
    const i0 = Math.floor(sx - 0.5);
    const j0 = Math.floor(sy - 0.5);
    const fx = sx - i0;
    const fy = sy - j0;
    const T = P.T[p];
    const oil = P.mat[p] !== WATER;
    const sw = salty ? P.saltFraction(p) : 0;
    for (let b = 0; b < 3; b += 1) {
      const j = j0 + b;
      if (j < 0 || j >= ly) continue;
      const wy = b === 0 ? 0.5 * (1.5 - fy) ** 2 : b === 1 ? 0.75 - (fy - 1) ** 2 : 0.5 * (fy - 0.5) ** 2;
      for (let a = 0; a < 3; a += 1) {
        const i = i0 + a;
        if (i < 0 || i >= lx) continue;
        const wx = a === 0 ? 0.5 * (1.5 - fx) ** 2 : a === 1 ? 0.75 - (fx - 1) ** 2 : 0.5 * (fx - 0.5) ** 2;
        const w = wx * wy * vp;
        lw[i + j * lx] += w;
        lt[i + j * lx] += w * T;
        if (oil) lo[i + j * lx] += w;
        if (sw > 0) ls[i + j * lx] += w * sw;
      }
    }
  }
  /* Unter den Körpern die Bedeckung aus den Nachbarn fortsetzen (vor dem Weichzeichner): sonst bliebe zwischen dem Wasser und einem Körper, der
     zwischen den Zellen steht, ein heller Spalt — der Körper selbst deckt, was darunter liegt. */
  extendUnderBodies(e, lx, ly, h, other, salty);
  /* Teilchen liegen nie ganz gleichmässig: ohne Weichzeichner zeigen sich einzelne Lücken als Löcher im Wasser (die Oberfläche bei ½ bleibt, wo sie ist). */
  blur121(lw, lx, ly);
  blur121(lt, lx, ly);
  if (other) blur121(lo, lx, ly);
  if (salty) blur121(ls, lx, ly);
  const liq = L.liquid;
  for (let k = 0; k < nl; k += 1) {
    const w = lw[k];
    const o = 4 * k;
    liq[o] = Math.min(255, 255 * w);
    liq[o + 1] = w > 0 ? Math.min(255, Math.max(0, (255 * (lt[k] / w - T0 - tmin)) / tspan)) : 0;
    liq[o + 2] = other && w > 0 ? Math.min(255, (255 * lo[k]) / w) : 0;
    liq[o + 3] = salty && w > 0 ? Math.min(255, (255 * ls[k]) / (w * SALT_FULL)) : 0;
  }
}

/** In die Texel, deren Mitte in einem Körper liegt, drei Lagen weit die grösste Bedeckung eines Nachbarn (mit dessen Temperatur, Öl und Salz). */
function extendUnderBodies(e: Engine, lx: number, ly: number, h: number, other: boolean, salty: boolean): void {
  const nl = lx * ly;
  if (inBody.length < nl) inBody = new Uint8Array(nl);
  inBody.fill(0, 0, nl);
  let any = false;
  for (const b of e.bodies.list) {
    if (b.gone) continue;
    b.worldBox(b.x, b.y, b.a, wbox);
    const i0 = Math.max(0, Math.floor(wbox[0] / h));
    const i1 = Math.min(lx - 1, Math.floor(wbox[2] / h));
    const j0 = Math.max(0, Math.floor(wbox[1] / h));
    const j1 = Math.min(ly - 1, Math.floor(wbox[3] / h));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        Body2D.toLocal(b.x, b.y, b.a, (i + 0.5) * h, (j + 0.5) * h, local);
        if (b.insideLocal(local[0], local[1], 0)) { inBody[i + j * lx] = 1; any = true; }
      }
    }
  }
  if (!any) return;
  for (let pass = 0; pass < 3; pass += 1) {
    for (let j = 0; j < ly; j += 1) {
      for (let i = 0; i < lx; i += 1) {
        const k = i + j * lx;
        if (inBody[k] === 0) continue;
        let best = -1;
        if (i > 0 && lw[k - 1] > lw[k] && (best < 0 || lw[k - 1] > lw[best])) best = k - 1;
        if (i < lx - 1 && lw[k + 1] > lw[k] && (best < 0 || lw[k + 1] > lw[best])) best = k + 1;
        if (j > 0 && lw[k - lx] > lw[k] && (best < 0 || lw[k - lx] > lw[best])) best = k - lx;
        if (j < ly - 1 && lw[k + lx] > lw[k] && (best < 0 || lw[k + lx] > lw[best])) best = k + lx;
        if (best < 0) continue;
        lw[k] = lw[best];
        lt[k] = lt[best];
        if (other) lo[k] = lo[best];
        if (salty) ls[k] = ls[best];
      }
    }
  }
}

function sampleArrows(e: Engine, L: Layers): void {
  const g = e.grid;
  const { nx, ny, dx } = g;
  const step = arrowStep(dx);
  const half = step >> 1;
  let vGas = 0;
  let vLiq = 0;
  const a = L.arrows;
  let q = 0;
  for (let j = half; j < ny; j += step) {
    for (let i = half; i < nx; i += step, q += 1) {
      const k = g.kind[i + j * nx];
      a[2 * q] = 0;
      a[2 * q + 1] = 0;
      if (k === GAS) centre(g.ug, g.vg, i, j, nx);
      else if (k === LIQUID) centre(g.ul, g.vl, i, j, nx);
      else continue;
      const qu = velQ(vel[0]);
      const qv = velQ(vel[1]);
      a[2 * q] = qu;
      a[2 * q + 1] = qv;
      const s = Math.hypot(velOf(qu), velOf(qv));
      if (k === GAS) vGas = Math.max(vGas, s); else vLiq = Math.max(vLiq, s);
    }
  }
  L.vGas = vGas;
  L.vLiq = vLiq;
}

/* -- Zusammensetzen ------------------------------------------------------------------------------------- */

/** Was composeFrame füllt (die Felder von FrameBuffers, frame.ts, die aus den Ebenen kommen). */
export interface ComposeTarget {
  nx: number;
  ny: number;
  cells: Uint8Array;
  field: Uint8Array;
  lx: number;
  ly: number;
  liquid: Uint8Array;
  nb: number;
  bubbles: Float32Array;
  boxW: number;
  boxH: number;
  overlay: Overlay;
  tintLiquid: number;
  scaleLo: number;
  scaleHi: number;
  arrows: Float32Array;
  nag: number;
  nal: number;
  vLiq: number;
  /** Körper: je Viereck Mitte, halbe Seiten, Winkel und Farbe (RGB 0–1) — 8 Zahlen; Umrisse als Strecken (4 Zahlen). */
  quads: Float32Array;
  nq: number;
  edges: Float32Array;
  ne: number;
}

const SOLID_RGB = SOLIDS.map((s) => hex(s.color));
const CRYSTAL_RGB = hex(SOLUTES[0]?.color ?? '#f4f3ee');
/** Unter den Einblendungen Temperatur, Druck und Geschwindigkeit wird der Nebel blasser (die Farben bleiben lesbar). */
const FOG_UNDER_OVERLAY = 0.3;
const scratch = new Uint8Array(4);

/** Das Bild der Einblendung aus den Ebenen (live und bei der Wiedergabe dieselbe Rechnung). */
export function composeFrame(L: Layers, f: ComposeTarget, overlay: Overlay): void {
  const { nx, ny } = L;
  f.boxW = L.boxW;
  f.boxH = L.boxH;
  f.overlay = overlay;
  f.tintLiquid = overlay === 'temperature' ? 1 : overlay === 'salt' ? 2 : 0;
  const cells = f.cells;
  const field = f.field;
  const tmin = T_SCALE[0];
  const tspan = T_SCALE[1] - T_SCALE[0];
  const strong = overlay === 'temperature' || overlay === 'pressure' || overlay === 'velocity';
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      const o = 4 * c;
      const code = L.code[c];
      const kind = code & 3;
      const T = T_BASE + T_STEP * L.temp[c];
      cells[o] = 0; cells[o + 1] = 0; cells[o + 2] = 0; cells[o + 3] = 0;
      field[o] = 0; field[o + 1] = 0; field[o + 2] = 0; field[o + 3] = 0;
      if (kind === SOLID) {
        /* Eine Zelle, die ein Körper füllt: den zeichnen seine Vierecke. */
        if (code >> 2 === 0) continue;
        const rgb = SOLID_RGB[(code >> 2) - 1] ?? [128, 128, 128];
        const glow = L.glow[c] / 255;
        cells[o] = rgb[0] + (230 - rgb[0]) * glow;
        cells[o + 1] = rgb[1] * (1 - 0.6 * glow);
        cells[o + 2] = rgb[2] * (1 - 0.8 * glow);
        cells[o + 3] = 255;
        const cr = L.crust[c] / 255;
        if (cr > 0) {
          cells[o] += (CRYSTAL_RGB[0] - cells[o]) * cr;
          cells[o + 1] += (CRYSTAL_RGB[1] - cells[o + 1]) * cr;
          cells[o + 2] += (CRYSTAL_RGB[2] - cells[o + 2]) * cr;
        }
        if (overlay === 'temperature') {
          viridis((T - T0 - tmin) / tspan, scratch, 0);
          cells[o] = scratch[0]; cells[o + 1] = scratch[1]; cells[o + 2] = scratch[2];
        } else if (overlay === 'phase') {
          cells[o] = 90; cells[o + 1] = 90; cells[o + 2] = 90;
        }
        continue;
      }
      if (overlay === 'phase') {
        if (kind === LIQUID) { cells[o] = 61; cells[o + 1] = 143; cells[o + 2] = 216; cells[o + 3] = 200; }
        else { cells[o] = 235; cells[o + 1] = 235; cells[o + 2] = 235; cells[o + 3] = 120; }
        if ((L.flags[c] & 1) !== 0) { cells[o] = 250; cells[o + 1] = 200; cells[o + 2] = 80; cells[o + 3] = 220; }
        continue;
      }
      /* Salz am Boden der Kiste (wo unter der Lösung kein Feststoff lag): die unterste Zelle seiner Spalte. */
      if (j === 0 && L.crust[c] > 0) {
        cells[o] = CRYSTAL_RGB[0]; cells[o + 1] = CRYSTAL_RGB[1]; cells[o + 2] = CRYSTAL_RGB[2]; cells[o + 3] = L.crust[c];
      }
      if (kind !== GAS) continue;
      /* Einblendung: Farbe (0–255) und Deckkraft (0–1), am Ende vormultipliziert. */
      let r = 0, gg = 0, bl = 0, a = 0;
      if (strong) {
        const t = overlay === 'temperature' ? (T - T0 - tmin) / tspan : overlay === 'pressure' ? 0.5 + (0.5 * presOf(L.pres[c])) / L.pmax : speedOf(L.speed[c]) / L.vmax;
        viridis(t, scratch, 0);
        r = scratch[0]; gg = scratch[1]; bl = scratch[2]; a = overlay === 'velocity' ? 0.4 : 0.55;
      } else if (overlay === 'humidity' || overlay === 'vapour') {
        const value = overlay === 'humidity' ? L.hum[c] / 63 : L.vap[c] / 255;
        r = 40; gg = 110; bl = 220; a = Math.min(0.86, 0.86 * value);
      }
      /* Nebel immer: weiss, mit seiner Deckkraft (Beer–Lambert, oben). */
      if (L.fog[c] > 0) {
        let af = L.fog[c] / 255;
        if (strong) af *= FOG_UNDER_OVERLAY;
        const outA = af + a * (1 - af);
        if (outA > 0) {
          r = (255 * af + r * a * (1 - af)) / outA;
          gg = (255 * af + gg * a * (1 - af)) / outA;
          bl = (255 * af + bl * a * (1 - af)) / outA;
        }
        a = outA;
      }
      field[o] = r * a; field[o + 1] = gg * a; field[o + 2] = bl * a; field[o + 3] = 255 * a;
    }
  }
  /* Die Skala für die Legende. */
  if (overlay === 'temperature') { f.scaleLo = T0 + tmin; f.scaleHi = T0 + T_SCALE[1]; }
  else if (overlay === 'pressure') { f.scaleLo = -L.pmax; f.scaleHi = L.pmax; }
  else if (overlay === 'velocity') { f.scaleLo = 0; f.scaleHi = L.vmax; }
  else if (overlay === 'vapour') { f.scaleLo = 0; f.scaleHi = VAPOUR_FULL; }
  else if (overlay === 'salt') { f.scaleLo = 0; f.scaleHi = SALT_FULL; }
  else { f.scaleLo = 0; f.scaleHi = 1; }
  /* Die Flüssigkeit: nur die Kanäle, die diese Einblendung zeigt (G Temperatur, A Salz) — das Bild hängt an nichts, was es nicht zeigt. */
  const liq = f.liquid;
  liq.set(L.liquid.subarray(0, 16 * nx * ny));
  const keepG = f.tintLiquid === 1;
  const keepA = f.tintLiquid === 2;
  if (!keepG || !keepA) for (let k = 0; k < 16 * nx * ny; k += 4) { if (!keepG) liq[k + 1] = 0; if (!keepA) liq[k + 3] = 0; }
  f.nb = L.nb;
  for (let b = 0; b < L.nb; b += 1) {
    const o = 4 * b;
    f.bubbles[o] = (L.bubbles[o] / 65535) * L.boxW;
    f.bubbles[o + 1] = (L.bubbles[o + 1] / 65535) * L.boxH;
    f.bubbles[o + 2] = L.bubbles[o + 2] * 1e-6;
    f.bubbles[o + 3] = L.bubbles[o + 3] / 65535;
  }
  f.nag = 0;
  f.nal = 0;
  f.vLiq = 0;
  if (overlay === 'velocity') composeArrows(L, f);
  composeBodies(L, f, overlay);
}

/** Die Körper: Vierecke in der Farbe ihres Werkstoffs (glühend, mit Kruste) oder der Einblendung, dazu die Umrisse der Rechtecke. */
function composeBodies(L: Layers, f: ComposeTarget, overlay: Overlay): void {
  if (f.quads.length < 8 * L.nq) f.quads = new Float32Array(8 * Math.ceil(L.nq * 1.25 + 16));
  if (f.edges.length < 16 * L.nr) f.edges = new Float32Array(16 * Math.ceil(L.nr * 1.25 + 4));
  const tmin = T_SCALE[0];
  const tspan = T_SCALE[1] - T_SCALE[0];
  const out = f.quads;
  for (let q = 0; q < L.nq; q += 1) {
    const i = QUAD * q;
    const o = 8 * q;
    out[o] = (L.quads[i] / 65535) * L.boxW;
    out[o + 1] = (L.quads[i + 1] / 65535) * L.boxH;
    out[o + 2] = L.quads[i + 2] * 1e-6;
    out[o + 3] = L.quads[i + 3] * 1e-6;
    out[o + 4] = angleOf(L.quads[i + 4]);
    let r: number;
    let g: number;
    let b: number;
    if (overlay === 'temperature') {
      viridis((T_BASE + T_STEP * L.quads[i + 7] - T0 - tmin) / tspan, scratch, 0);
      r = scratch[0]; g = scratch[1]; b = scratch[2];
    } else if (overlay === 'phase') {
      r = 90; g = 90; b = 90;
    } else {
      const rgb = SOLID_RGB[L.quads[i + 5] - 1] ?? [128, 128, 128];
      const glow = (L.quads[i + 6] & 255) / 255;
      const cr = (L.quads[i + 6] >> 8) / 255;
      r = rgb[0] + (230 - rgb[0]) * glow;
      g = rgb[1] * (1 - 0.6 * glow);
      b = rgb[2] * (1 - 0.8 * glow);
      if (cr > 0) { r += (CRYSTAL_RGB[0] - r) * cr; g += (CRYSTAL_RGB[1] - g) * cr; b += (CRYSTAL_RGB[2] - b) * cr; }
    }
    out[o + 5] = r / 255;
    out[o + 6] = g / 255;
    out[o + 7] = b / 255;
  }
  f.nq = L.nq;
  /* Umrisse: die vier Seiten jedes Rechtecks. */
  const e = f.edges;
  for (let k = 0; k < L.nr; k += 1) {
    const i = RECT * k;
    const cx = (L.rects[i] / 65535) * L.boxW;
    const cy = (L.rects[i + 1] / 65535) * L.boxH;
    const hw = L.rects[i + 2] * 1e-5;
    const hh = L.rects[i + 3] * 1e-5;
    const a = angleOf(L.rects[i + 4]);
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    for (let s = 0; s < 4; s += 1) {
      const ax = s === 0 || s === 3 ? -hw : hw;
      const ay = s < 2 ? -hh : hh;
      const bx = s === 0 || s === 1 ? hw : -hw;
      const by = s === 0 || s === 3 ? -hh : hh;
      const o = 16 * k + 4 * s;
      e[o] = cx + cs * ax - sn * ay;
      e[o + 1] = cy + sn * ax + cs * ay;
      e[o + 2] = cx + cs * bx - sn * by;
      e[o + 3] = cy + sn * bx + cs * by;
    }
  }
  f.ne = 4 * L.nr;
}

/** Pfeile auf dem groben Raster: Gas und Wasser je mit eigenem Massstab (die grösste Geschwindigkeit ist 0,9 Rasterweiten lang). */
function composeArrows(L: Layers, f: ComposeTarget): void {
  const { nx, ny, dx } = L;
  const step = arrowStep(dx);
  const half = step >> 1;
  f.scaleHi = Math.max(f.scaleHi, L.vGas);
  f.vLiq = L.vLiq;
  const out = f.arrows;
  const len = 0.9 * step * dx;
  const cap = out.length / 4;
  let n = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    const kind = pass === 0 ? GAS : LIQUID;
    const vmax = pass === 0 ? f.scaleHi : L.vLiq;
    const start = n;
    if (vmax > 1e-6) {
      let q = 0;
      for (let j = half; j < ny; j += step) {
        for (let i = half; i < nx; i += step, q += 1) {
          if ((L.code[i + j * nx] & 3) !== kind || n + 3 > cap) continue;
          const ux0 = velOf(L.arrows[2 * q]);
          const uy0 = velOf(L.arrows[2 * q + 1]);
          const s = Math.hypot(ux0, uy0);
          if (s < 0.03 * vmax) continue;
          const Ln = (len * s) / vmax;
          const ux = ux0 / s;
          const uy = uy0 / s;
          const cx = (i + 0.5) * dx;
          const cy = (j + 0.5) * dx;
          const x1 = cx + 0.5 * Ln * ux;
          const y1 = cy + 0.5 * Ln * uy;
          const o = 4 * n;
          out[o] = cx - 0.5 * Ln * ux; out[o + 1] = cy - 0.5 * Ln * uy; out[o + 2] = x1; out[o + 3] = y1;
          /* Spitze: zwei Striche zurück unter ±25°, 35 % der Länge. */
          const h = 0.35 * Ln;
          const ca = 0.9063;
          const sa = 0.4226;
          out[o + 4] = x1; out[o + 5] = y1; out[o + 6] = x1 - h * (ca * ux - sa * uy); out[o + 7] = y1 - h * (sa * ux + ca * uy);
          out[o + 8] = x1; out[o + 9] = y1; out[o + 10] = x1 - h * (ca * ux + sa * uy); out[o + 11] = y1 - h * (-sa * ux + ca * uy);
          n += 3;
        }
      }
    }
    if (pass === 0) f.nag = n - start; else f.nal = n - start;
  }
}
