/**
 * LABOR 2D (v2) — EIN BILD ALS PUFFER: was der Zeichner braucht, aus dem
 * Zustand der Engine, ohne die Engine selbst (so geht es auch als
 * übertragbares Abbild zur Seite).
 *
 * - Zelltextur (nx × ny, RGBA): Feststoffe in ihrer Farbe (eine Heizplatte
 *   glüht mit ihrer Temperatur), Nebel weiss mit seiner Dichte, sonst
 *   durchsichtig — oder die gewählte Einblendung.
 * - Flüssigkeit (2nx × 2ny, RGBA): R = Bedeckung aus den Teilchen (B-Spline auf
 *   halben Zellen; der Shader zieht bei ½ eine glatte Oberfläche), G = ihre
 *   Temperatur (für die Einblendung), B = Bedeckung aus Blasen.
 * - Blasen: Mitte, Radius, Anteil Luft — Kreise in wahrer Grösse.
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
}

export function allocFrame(nx: number, ny: number, bubbles: number): FrameBuffers {
  return {
    nx, ny,
    cells: new Uint8Array(4 * nx * ny),
    lx: 2 * nx,
    ly: 2 * ny,
    liquid: new Uint8Array(4 * 4 * nx * ny),
    nb: 0,
    bubbles: new Float32Array(4 * Math.max(16, bubbles)),
    boxW: 0, boxH: 0,
    overlay: 'none',
    tintLiquid: false
  };
}

/** Passt der Puffer noch zu dieser Engine? */
export function frameFits(f: FrameBuffers, e: Engine): boolean {
  return f.nx === e.grid.nx && f.ny === e.grid.ny && f.bubbles.length >= 4 * e.bubbles.count;
}

const SOLID_RGB = SOLIDS.map((s) => hex(s.color));
const scratch = new Uint8Array(4);
let lw = new Float32Array(0);
let lt = new Float32Array(0);

/** Das Bild aus der Engine in die Puffer schreiben. */
export function buildFrame(e: Engine, f: FrameBuffers, overlay: Overlay): void {
  const g = e.grid;
  const { nx, ny, n } = g;
  f.boxW = g.w;
  f.boxH = g.h;
  f.overlay = overlay;
  f.tintLiquid = overlay === 'temperature';
  const cells = f.cells;
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
      if (overlay === 'temperature') {
        viridis((g.T[c] - T0 - tmin) / tspan, cells, o);
        cells[o + 3] = 140;
      } else if (overlay === 'pressure') {
        viridis(0.5 + (0.5 * g.pg[c]) / pmax, cells, o);
        cells[o + 3] = 140;
      } else if (overlay === 'velocity') {
        const u = 0.5 * (g.ug[i + j * (nx + 1)] + g.ug[i + 1 + j * (nx + 1)]);
        const v = 0.5 * (g.vg[c] + g.vg[c + nx]);
        viridis(Math.hypot(u, v) / vmax, cells, o);
        cells[o + 3] = 140;
      } else if (overlay === 'humidity' || overlay === 'vapour') {
        const mv = g.mg[H2O * n + c];
        const nd = g.mg[N2 * n + c] / MOLAR[N2] + g.mg[O2 * n + c] / MOLAR[O2];
        const nv = mv / MOLAR[H2O];
        const x = nv + nd > 0 ? nv / (nv + nd) : 0;
        const value = overlay === 'humidity' ? (x * e.regions.pAt(c)) / pSatFast(g.T[c]) : Math.min(1, (mv / Math.max(1e-12, e.gas.vgas[c])) / 0.6);
        cells[o] = 40; cells[o + 1] = 110; cells[o + 2] = 220;
        cells[o + 3] = Math.min(220, 220 * value);
      }
      /* Nebel immer: weiss, die Deckkraft aus seiner Dichte (1 g/m³ ist dichter Nebel). */
      const fog = g.mfog[c] / Math.max(1e-12, e.gas.vgas[c]);
      if (fog > 0) {
        const a = Math.min(0.92, fog / 1e-3);
        const base = cells[o + 3] / 255;
        const outA = a + base * (1 - a);
        if (outA > 0) {
          cells[o] = (255 * a + cells[o] * base * (1 - a)) / outA;
          cells[o + 1] = (255 * a + cells[o + 1] * base * (1 - a)) / outA;
          cells[o + 2] = (255 * a + cells[o + 2] * base * (1 - a)) / outA;
          cells[o + 3] = 255 * outA;
        }
      }
    }
  }
  /* Flüssigkeit: Bedeckung auf halben Zellen (quadratischer B-Spline), Temperatur gewichtet. */
  const lx = f.lx;
  const ly = f.ly;
  const nl = lx * ly;
  if (lw.length < nl) { lw = new Float32Array(nl); lt = new Float32Array(nl); }
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
}
