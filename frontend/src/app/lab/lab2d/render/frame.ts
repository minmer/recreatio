/**
 * LABOR 2D (v2) — EIN BILD ALS PUFFER: was der Zeichner braucht, aus dem
 * Zustand der Engine, ohne die Engine selbst (so geht es auch als
 * übertragbares Abbild zur Seite).
 *
 * - Zelltextur (nx × ny, RGBA, scharf gelesen): Feststoffe in ihrer Farbe
 *   (eine Heizplatte glüht mit ihrer Temperatur), in der Mapa stanów die
 *   Zustände; sonst durchsichtig.
 * - Feldtextur (nx × ny, RGBA mit vormultipliziertem Alpha, linear gelesen —
 *   weiche Übergänge): Nebel weiss mit seiner Dichte und die stetigen
 *   Einblendungen (Temperatur, Druck, Geschwindigkeit, Feuchte, Dampf); ihre
 *   Skala steht in scaleLo/scaleHi (für die Legende).
 * - Flüssigkeit (2nx × 2ny, RGBA): R = Bedeckung aus den Teilchen (B-Spline auf
 *   halben Zellen; der Shader zieht bei ½ eine glatte Oberfläche), G = ihre
 *   Temperatur (für die Einblendung), B = Bedeckung aus Blasen.
 * - Blasen: Mitte, Radius, Anteil Luft — Kreise in wahrer Grösse.
 * - Wahlweise die rohen Teilchen (x, y, Temperatur auf der Skala) und in der
 *   Einblendung „Prędkość“ Pfeile der Geschwindigkeit auf einem groben Raster —
 *   erst die des Gases, dann die des Wassers (jedes mit eigenem Massstab).
 * Wasserdampf selbst bleibt unsichtbar; nur Nebel und Flüssigkeit sind weiss
 * bzw. blau (Prompt v2). Ein Schalter zeigt den Dampf als Feld.
 */

import type { Engine } from '../engine/engine';
import { pSatFast } from '../engine/if97';
import { MOLAR, SOLIDS } from '../engine/materials';
import { GAS, H2O, LIQUID, N2, O2, SOLID, SPECIES_SLOTS, T0 } from '../engine/units';
import { hex, T_SCALE, viridis } from './palette';

export type Overlay = 'none' | 'temperature' | 'pressure' | 'velocity' | 'humidity' | 'vapour' | 'phase';
export const OVERLAYS: readonly Overlay[] = ['none', 'temperature', 'pressure', 'velocity', 'humidity', 'vapour', 'phase'];

export interface FrameBuffers {
  nx: number;
  ny: number;
  cells: Uint8Array;
  field: Uint8Array;
  lx: number;
  ly: number;
  liquid: Uint8Array;
  nb: number;
  /** Je Blase: x, y, r, Luftanteil (0–1). */
  bubbles: Float32Array;
  boxW: number;
  boxH: number;
  overlay: Overlay;
  /** Wasser einfärben (Temperatur) oder in seiner Farbe. */
  tintLiquid: boolean;
  /** Die Skala der Einblendung (in SI: K, Pa, m/s, 1, kg/m³) — Anfang und Ende der Farbskala. */
  scaleLo: number;
  scaleHi: number;
  /** Rohe Teilchen (wenn gezeigt): je Teilchen x, y, Temperatur auf der Skala (0–1); np Teilchen. */
  parts: Float32Array;
  np: number;
  /** Pfeile (Einblendung „Prędkość“): je Strecke x0, y0, x1, y1 — erst nag Strecken des Gases, dann nal des Wassers. */
  arrows: Float32Array;
  nag: number;
  nal: number;
  /** Grösste Geschwindigkeit des Wassers an den Pfeilen (m/s; die des Gases steht in scaleHi). */
  vLiq: number;
}

/** Abstand der Pfeile (m): etwa alle 6 mm einer, mindestens alle zwei Zellen. */
const ARROW_SPACING = 0.006;
const arrowStep = (dx: number): number => Math.max(2, Math.round(ARROW_SPACING / dx));

export function allocFrame(nx: number, ny: number, bubbles: number, particles = 0): FrameBuffers {
  return {
    nx, ny,
    cells: new Uint8Array(4 * nx * ny),
    field: new Uint8Array(4 * nx * ny),
    lx: 2 * nx,
    ly: 2 * ny,
    liquid: new Uint8Array(4 * 4 * nx * ny),
    nb: 0,
    bubbles: new Float32Array(4 * Math.max(16, bubbles)),
    boxW: 0, boxH: 0,
    overlay: 'none',
    tintLiquid: false,
    scaleLo: 0,
    scaleHi: 1,
    parts: new Float32Array(3 * particles),
    np: 0,
    /* Höchstens ein Pfeil je 2 × 2 Zellen, drei Strecken (Schaft, zwei Spitzen) zu vier Zahlen. */
    arrows: new Float32Array(12 * Math.ceil(nx / 2) * Math.ceil(ny / 2)),
    nag: 0,
    nal: 0,
    vLiq: 0
  };
}

/** Die übertragbaren Puffer eines Bildes (Arbeiter ↔ Seite). */
export function frameTransfer(f: FrameBuffers): ArrayBuffer[] {
  return [f.cells.buffer, f.field.buffer, f.liquid.buffer, f.bubbles.buffer, f.parts.buffer, f.arrows.buffer] as ArrayBuffer[];
}

/** Passt der Puffer noch zu dieser Engine (mit den rohen Teilchen, wenn sie gezeigt werden)? */
export function frameFits(f: FrameBuffers, e: Engine, particles = false): boolean {
  return f.nx === e.grid.nx && f.ny === e.grid.ny && f.bubbles.length >= 4 * e.bubbles.count && (!particles || f.parts.length >= 3 * e.particles.count);
}

const SOLID_RGB = SOLIDS.map((s) => hex(s.color));

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
/** Unter den Einblendungen Temperatur, Druck und Geschwindigkeit wird der Nebel blasser (die Farben bleiben lesbar). */
const FOG_UNDER_OVERLAY = 0.3;
const scratch = new Uint8Array(4);
/** Dampfdichte, bei der die Einblendung „Para wodna“ voll deckt (kg/m³): gesättigter Dampf bei 100 °C hat 0,598 (IAPWS). */
export const VAPOUR_FULL = 0.6;
let lw = new Float32Array(0);
let lt = new Float32Array(0);
let tmp = new Float32Array(0);

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

/** Das Bild aus der Engine in die Puffer schreiben. */
export function buildFrame(e: Engine, f: FrameBuffers, overlay: Overlay, particles = false): void {
  const g = e.grid;
  const { nx, ny, n } = g;
  f.boxW = g.w;
  f.boxH = g.h;
  f.overlay = overlay;
  f.tintLiquid = overlay === 'temperature';
  const cells = f.cells;
  const field = f.field;
  const tmin = T_SCALE[0];
  const tspan = T_SCALE[1] - T_SCALE[0];
  /* Zellen. */
  let pmax = 1;
  let vmax = 0.02;
  if (overlay === 'pressure') for (let c = 0; c < n; c += 1) if (g.kind[c] === GAS) pmax = Math.max(pmax, Math.abs(g.pg[c]));
  if (overlay === 'velocity') {
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      if (g.kind[c] !== GAS) continue;
      const u = 0.5 * (g.ug[i + j * (nx + 1)] + g.ug[i + 1 + j * (nx + 1)]);
      const v = 0.5 * (g.vg[c] + g.vg[c + nx]);
      vmax = Math.max(vmax, Math.hypot(u, v));
    }
  }
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      const o = 4 * c;
      const kind = g.kind[c];
      cells[o] = 0; cells[o + 1] = 0; cells[o + 2] = 0; cells[o + 3] = 0;
      field[o] = 0; field[o + 1] = 0; field[o + 2] = 0; field[o + 3] = 0;
      if (kind === SOLID) {
        const rgb = SOLID_RGB[g.solid[c] - 1];
        /* Heiss: Rot mischt sich bei (mit der Temperatur über 60 °C, voll bei 400 °C). */
        const glow = Math.min(1, Math.max(0, (g.T[c] - T0 - 60) / 340));
        cells[o] = rgb[0] + (230 - rgb[0]) * glow;
        cells[o + 1] = rgb[1] * (1 - 0.6 * glow);
        cells[o + 2] = rgb[2] * (1 - 0.8 * glow);
        cells[o + 3] = 255;
        if (overlay === 'temperature') {
          viridis((g.T[c] - T0 - tmin) / tspan, scratch, 0);
          cells[o] = scratch[0]; cells[o + 1] = scratch[1]; cells[o + 2] = scratch[2];
        } else if (overlay === 'phase') {
          cells[o] = 90; cells[o + 1] = 90; cells[o + 2] = 90;
        }
        continue;
      }
      if (overlay === 'phase') {
        if (kind === LIQUID) { cells[o] = 61; cells[o + 1] = 143; cells[o + 2] = 216; cells[o + 3] = 200; }
        else { cells[o] = 235; cells[o + 1] = 235; cells[o + 2] = 235; cells[o + 3] = 120; }
        if (g.alpha[c] > 0.02) { cells[o] = 250; cells[o + 1] = 200; cells[o + 2] = 80; cells[o + 3] = 220; }
        continue;
      }
      if (kind !== GAS) continue;
      /* Einblendung: Farbe (0–255) und Deckkraft (0–1), am Ende vormultipliziert. */
      let r = 0, gg = 0, bl = 0, a = 0;
      if (overlay === 'temperature' || overlay === 'pressure' || overlay === 'velocity') {
        let t = 0;
        if (overlay === 'temperature') t = (g.T[c] - T0 - tmin) / tspan;
        else if (overlay === 'pressure') t = 0.5 + (0.5 * g.pg[c]) / pmax;
        else {
          const u = 0.5 * (g.ug[i + j * (nx + 1)] + g.ug[i + 1 + j * (nx + 1)]);
          const v = 0.5 * (g.vg[c] + g.vg[c + nx]);
          t = Math.hypot(u, v) / vmax;
        }
        viridis(t, scratch, 0);
        r = scratch[0]; gg = scratch[1]; bl = scratch[2]; a = overlay === 'velocity' ? 0.4 : 0.55;
      } else if (overlay === 'humidity' || overlay === 'vapour') {
        const mv = g.mg[H2O * n + c];
        const nd = g.mg[N2 * n + c] / MOLAR[N2] + g.mg[O2 * n + c] / MOLAR[O2];
        const nv = mv / MOLAR[H2O];
        const x = nv + nd > 0 ? nv / (nv + nd) : 0;
        const value = overlay === 'humidity' ? (x * e.regions.pAt(c)) / pSatFast(g.T[c]) : (mv / Math.max(1e-12, e.gas.vgas[c])) / VAPOUR_FULL;
        r = 40; gg = 110; bl = 220; a = Math.min(0.86, 0.86 * value);
      }
      /* Nebel immer: weiss, die Deckkraft nach Beer–Lambert aus seiner Dichte (oben). */
      const fog = g.mfog[c] / Math.max(1e-12, e.gas.vgas[c]);
      if (fog > 0) {
        let af = Math.min(0.95, 1 - Math.exp(-fog / FOG_REF));
        if (overlay === 'temperature' || overlay === 'pressure' || overlay === 'velocity') af *= FOG_UNDER_OVERLAY;
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
  else if (overlay === 'pressure') { f.scaleLo = -pmax; f.scaleHi = pmax; }
  else if (overlay === 'velocity') { f.scaleLo = 0; f.scaleHi = vmax; }
  else if (overlay === 'vapour') { f.scaleLo = 0; f.scaleHi = VAPOUR_FULL; }
  else { f.scaleLo = 0; f.scaleHi = 1; }
  /* Flüssigkeit: Bedeckung auf halben Zellen (quadratischer B-Spline), Temperatur gewichtet. */
  const lx = f.lx;
  const ly = f.ly;
  const nl = lx * ly;
  if (lw.length < nl) { lw = new Float32Array(nl); lt = new Float32Array(nl); tmp = new Float32Array(nl); }
  lw.fill(0, 0, nl);
  lt.fill(0, 0, nl);
  const P = e.particles;
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
      }
    }
  }
  /* Teilchen liegen nie ganz gleichmässig: ohne Weichzeichner zeigen sich einzelne Lücken als Löcher im Wasser (die Oberfläche bei ½ bleibt, wo sie ist). */
  blur121(lw, lx, ly);
  blur121(lt, lx, ly);
  const liq = f.liquid;
  for (let k = 0; k < nl; k += 1) {
    const w = lw[k];
    const o = 4 * k;
    liq[o] = Math.min(255, 255 * w);
    liq[o + 1] = w > 0 ? Math.min(255, Math.max(0, (255 * (lt[k] / w - T0 - tmin)) / tspan)) : 0;
    liq[o + 2] = 0;
    liq[o + 3] = 255;
  }
  /* Blasen. */
  const B = e.bubbles;
  f.nb = B.count;
  for (let b = 0; b < B.count; b += 1) {
    const o = 4 * b;
    const total = B.totalMass(b);
    f.bubbles[o] = B.x[b];
    f.bubbles[o + 1] = B.y[b];
    f.bubbles[o + 2] = B.r[b];
    f.bubbles[o + 3] = total > 0 ? (B.m[b * SPECIES_SLOTS + N2] + B.m[b * SPECIES_SLOTS + O2]) / total : 0;
  }
  /* Rohe Teilchen. */
  f.np = 0;
  if (particles && f.parts.length >= 3 * P.count) {
    const pp = f.parts;
    for (let q = 0; q < P.count; q += 1) {
      pp[3 * q] = P.x[q];
      pp[3 * q + 1] = P.y[q];
      pp[3 * q + 2] = Math.min(1, Math.max(0, (P.T[q] - T0 - tmin) / tspan));
    }
    f.np = P.count;
  }
  /* Pfeile der Geschwindigkeit. */
  f.nag = 0;
  f.nal = 0;
  f.vLiq = 0;
  if (overlay === 'velocity') arrows(e, f);
}

/** Geschwindigkeit in der Mitte der Zelle (i, j) aus den Flächen u, v (in vel[0], vel[1]). */
const vel = new Float64Array(2);
function centre(u: Float32Array, v: Float32Array, i: number, j: number, nx: number): void {
  vel[0] = 0.5 * (u[i + j * (nx + 1)] + u[i + 1 + j * (nx + 1)]);
  vel[1] = 0.5 * (v[i + j * nx] + v[i + (j + 1) * nx]);
}

/** Pfeile auf einem groben Raster: Gas und Wasser je mit eigenem Massstab (die grösste Geschwindigkeit ist 0,9 Rasterweiten lang). */
function arrows(e: Engine, f: FrameBuffers): void {
  const g = e.grid;
  const { nx, ny, dx } = g;
  const step = arrowStep(dx);
  const half = step >> 1;
  let vGas = 0;
  let vLiq = 0;
  for (let j = half; j < ny; j += step) {
    for (let i = half; i < nx; i += step) {
      const k = g.kind[i + j * nx];
      if (k === GAS) { centre(g.ug, g.vg, i, j, nx); vGas = Math.max(vGas, Math.hypot(vel[0], vel[1])); }
      else if (k === LIQUID) { centre(g.ul, g.vl, i, j, nx); vLiq = Math.max(vLiq, Math.hypot(vel[0], vel[1])); }
    }
  }
  f.scaleHi = Math.max(f.scaleHi, vGas);
  f.vLiq = vLiq;
  const out = f.arrows;
  const len = 0.9 * step * dx;
  let n = 0;
  const cap = out.length / 4;
  for (let pass = 0; pass < 2; pass += 1) {
    const kind = pass === 0 ? GAS : LIQUID;
    const vmax = pass === 0 ? f.scaleHi : vLiq;
    const start = n;
    if (vmax > 1e-6) {
      for (let j = half; j < ny; j += step) {
        for (let i = half; i < nx; i += step) {
          if (g.kind[i + j * nx] !== kind || n + 3 > cap) continue;
          if (kind === GAS) centre(g.ug, g.vg, i, j, nx); else centre(g.ul, g.vl, i, j, nx);
          const s = Math.hypot(vel[0], vel[1]);
          if (s < 0.03 * vmax) continue;
          const L = (len * s) / vmax;
          const ux = vel[0] / s;
          const uy = vel[1] / s;
          const cx = (i + 0.5) * dx;
          const cy = (j + 0.5) * dx;
          const x1 = cx + 0.5 * L * ux;
          const y1 = cy + 0.5 * L * uy;
          const o = 4 * n;
          out[o] = cx - 0.5 * L * ux; out[o + 1] = cy - 0.5 * L * uy; out[o + 2] = x1; out[o + 3] = y1;
          /* Spitze: zwei Striche zurück unter ±25°, 35 % der Länge. */
          const h = 0.35 * L;
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
