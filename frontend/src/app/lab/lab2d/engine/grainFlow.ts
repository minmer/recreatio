/**
 * LABOR 2D (v2) — DIE BEWEGUNG DER KÖRNER (M3c, SANDBOX.md §8): Kornteilchen
 * als Scheiben mit Reibung, aufgelöst als Lagebedingungen (position-based
 * dynamics, Macklin et al. 2014, „Unified particle physics for real-time
 * applications“, ACM TOG 33(4) 153, https://doi.org/10.1145/2601097.2601152,
 * §5 Reibung):
 *
 * - **Kräfte**: die Schwerkraft — im Wasser um den Auftrieb vermindert,
 *   g (1 − ρ_l/ρ_s) — und der Widerstand des Wassers, implizit zur
 *   Geschwindigkeit der Flüssigkeit am Ort hin mit der Zeit τ = w/g_eff, w die
 *   Sinkgeschwindigkeit nach Ferguson & Church (2004),
 *   https://doi.org/10.1306/051204740933 (natürliche Körner nach Siebweite:
 *   C₁ = 18, C₂ = 1,0) — so sinkt ein einzelnes Korn genau mit w. Die
 *   Gegenkraft bekommt das Wasser im nächsten Schritt (Liquid.fU, fV): ein
 *   sinkendes Korn trägt sein Gewicht über das Wasser zum Boden, ein liegendes
 *   über die anderen Körner.
 * - **Berührung**: zwei Körner kommen sich nicht näher als die Summe ihrer
 *   Radien (r = 0,27 Δx √(m/m₀) — vier Scheiben je Zelle in dichter Packung
 *   sind genau PHI_MAX); Wände, Feststoffe und Körper ebenso. Haftreibung
 *   hebt die Verschiebung längs der Berührung ganz auf, solange sie unter
 *   μ_s mal der Eindringtiefe bleibt, sonst Gleitreibung μ_k — so steht eine
 *   Schüttung bis zu ihrem Schüttwinkel, steiler rutscht sie ab.
 * - Einige Teilschritte je Schritt (höchstens 2 ms) mit wenigen
 *   Gauss–Seidel-Durchgängen, abwechselnd vorwärts und rückwärts (sonst
 *   rutscht ein Haufen zu einer Seite); die Körner wiegen dabei nach unten
 *   exponentiell mehr (Macklin et al. §6, „mass scaling“) — ein Stapel trägt
 *   sich so in wenigen Durchgängen, statt sich wie eine zusammendrückbare
 *   Flüssigkeit breitzulaufen. Danach v = Δx/Δt.
 *
 * Abweichung vom Plan (SANDBOX.md §8: ein Kontinuum nach Narain, Golas & Lin
 * 2010): auf Zellen von 2 mm mit vier Körnern je Zelle hielt das Kontinuum
 * keine ruhende Böschung — halb gefüllte Zellen an der Oberfläche haben dort
 * keinen Druck, die oberste Lage floss ab und jeder Haufen kroch flach
 * (SIMPLIFICATIONS.md).
 */

import type { Engine } from './engine';
import { gridVelocityAt } from './extend';
import { GRAIN_MATS } from './grains';
import { muL } from './materials';
import { LIQUID } from './units';

/** Ferguson & Church: Beiwerte natürlicher Körner nach Siebweite. */
const FC_C1 = 18;
const FC_C2 = 1.0;
/** Längster Teilschritt (s) und Gauss–Seidel-Durchgänge je Teilschritt. */
const SUB_MAX = 0.002;
const ITER = 4;
/** Radius einer vollen Kornscheibe je Zellkante: vier Scheiben je Zelle füllen sie in dichter Packung (π r² = 0,907 Δx²/4). */
const R_FAC = 0.2687;
/** Reibung zwischen Körnern und an Wänden: Haft- und Gleitbeiwert (auf den Schüttwinkel des Stoffs geeicht, Test 49). */
export const MU_STATIC = 0.85;
export const MU_KINETIC = 0.7;

/** Sinkgeschwindigkeit nach Ferguson & Church (m/s): w = R g d²/(C₁ ν + √(0,75 C₂ R g d³)), R = (ρ_s − ρ_l)/ρ_l. */
export function settlingVelocity(d: number, rhoS: number, rhoL: number, mu: number, g: number): number {
  const R = Math.abs(rhoS - rhoL) / rhoL;
  const nu = mu / rhoL;
  return (R * g * d * d) / (FC_C1 * nu + Math.sqrt(0.75 * FC_C2 * R * g * d * d * d));
}

/** Gewichte des quadratischen B-Splines für s (in Zellen): Basis i0, drei Gewichte nach w[o..o+2]. */
function bspline(s: number, w: Float64Array, o: number): number {
  const i0 = Math.floor(s - 0.5);
  const f = s - i0;
  const a = 1.5 - f;
  const c = f - 0.5;
  w[o] = 0.5 * a * a;
  w[o + 1] = 0.75 - (f - 1) * (f - 1);
  w[o + 2] = 0.5 * c * c;
  return i0;
}

export class GrainFlow {
  private readonly e: Engine;
  /* Je Zelle das erste Korn, je Korn das nächste (Nachbarsuche); Lage am Anfang des Teilschritts; Radius. */
  private readonly head: Int32Array;
  private next = new Int32Array(0);
  private px = new Float64Array(0);
  private py = new Float64Array(0);
  private rad = new Float64Array(0);
  private readonly w = new Float64Array(6);
  private readonly vel = new Float64Array(2);
  private readonly hit = new Float64Array(6);
  /** Länge des laufenden Teilschritts (s) und der Exponent der Massenskalierung (1/m). */
  private h = 0;
  private ks = 0;
  /** Das schnellste Korn des letzten Schritts (m/s) — für Δt. */
  vmax = 0;

  constructor(engine: Engine) {
    this.e = engine;
    this.head = new Int32Array(engine.grid.n);
  }

  /** Höchstens eine halbe Zelle je Schritt für das schnellste Korn. */
  dtLimit(): number {
    return this.vmax > 0 ? (0.5 * this.e.grid.dx) / this.vmax : Infinity;
  }

  /** Der Volumenanteil der Körner je Zelle (grid.grain) — vor der Flüssigkeit gebraucht (ihr Driftausgleich, ihre Zellarten). */
  splatVolume(): void {
    const { grid: g, grains: G } = this.e;
    const { nx, ny, dx } = g;
    const frac = g.grain;
    frac.fill(0);
    const w = this.w;
    const inv = 1 / dx;
    const iv = 1 / g.vCell;
    for (let q = 0; q < G.count; q += 1) {
      const vol = (G.m[q] / G.rho(q)) * iv;
      const i0 = bspline(G.x[q] * inv - 0.5, w, 0);
      const j0 = bspline(G.y[q] * inv - 0.5, w, 3);
      for (let b = 0; b < 3; b += 1) {
        const j = j0 + b;
        if (j < 0 || j >= ny) continue;
        for (let a = 0; a < 3; a += 1) {
          const i = i0 + a;
          if (i < 0 || i >= nx) continue;
          frac[i + j * nx] += w[a] * w[3 + b] * vol;
        }
      }
    }
  }

  /** Ein Schritt der Körner (nach der Flüssigkeit; ihre Geschwindigkeiten sind die dieses Schritts). */
  step(dt: number): void {
    const G = this.e.grains;
    if (G.count === 0) { this.vmax = 0; return; }
    if (this.next.length < G.cap) {
      this.next = new Int32Array(G.cap);
      this.px = new Float64Array(G.cap);
      this.py = new Float64Array(G.cap);
      this.rad = new Float64Array(G.cap);
    }
    this.forces(dt);
    const dx = this.e.grid.dx;
    for (let q = 0; q < G.count; q += 1) this.rad[q] = R_FAC * dx * Math.sqrt(Math.max(0, G.m[q] / G.m0[q]));
    this.ks = 1 / (4 * R_FAC * dx);
    const ns = Math.max(1, Math.ceil(dt / SUB_MAX - 1e-9));
    this.h = dt / ns;
    for (let s = 0; s < ns; s += 1) this.substep();
    this.escape();
    let vmax = 0;
    for (let q = 0; q < G.count; q += 1) { const v = Math.hypot(G.vx[q], G.vy[q]); if (v > vmax) vmax = v; }
    this.vmax = vmax;
  }

  /* -- Schwerkraft und Widerstand des Wassers ---------------------------------------------------------- */

  private forces(dt: number): void {
    const e = this.e;
    const { grid: g, grains: G } = e;
    const rhoL = e.liquid.rhoRef;
    const gy = e.gy;
    const gRef = gy > 0 ? gy : 9.81;
    for (let q = 0; q < G.count; q += 1) {
      const c = g.cellAt(G.x[q], G.y[q]);
      const wet = c >= 0 && g.kind[c] === LIQUID;
      if (!wet) { G.vy[q] -= gy * dt; continue; }
      const rhoS = GRAIN_MATS[G.mat[q]].rho;
      const geff = gy * (1 - rhoL / rhoS);
      const T = g.Tl[c] > 200 ? g.Tl[c] : 293.15;
      const tau = settlingVelocity(G.diameter(q), rhoS, rhoL, muL(T), gRef) / Math.max(1e-6, Math.abs(gRef * (1 - rhoL / rhoS)));
      gridVelocityAt(g, G.x[q], G.y[q], this.vel);
      const vx0 = G.vx[q];
      const vy0 = G.vy[q] - geff * dt;
      const k = dt / tau;
      const vx = (vx0 + k * this.vel[0]) / (1 + k);
      const vy = (vy0 + k * this.vel[1]) / (1 + k);
      G.vx[q] = vx;
      G.vy[q] = vy;
      /* Die Gegenkraft auf das Wasser (N), im nächsten Schritt. */
      this.spread(G.x[q], G.y[q], (-G.m[q] * (vx - vx0)) / dt, (-G.m[q] * (vy - vy0)) / dt);
    }
  }

  /** Eine Kraft (N) mit den Flächengewichten des B-Splines um (x, y) auf die Flüssigkeit (wie BubbleMotion.spreadForce). */
  private spread(x: number, y: number, fx: number, fy: number): void {
    const { grid: g, liquid: L } = this.e;
    const { nx, ny, dx } = g;
    const w = this.w;
    const inv = 1 / dx;
    let i0 = bspline(x * inv, w, 0);
    let j0 = bspline(y * inv - 0.5, w, 3);
    for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) {
      const i = i0 + a;
      const j = j0 + b;
      if (i < 0 || i > nx || j < 0 || j >= ny) continue;
      L.fU[i + j * (nx + 1)] += fx * w[a] * w[3 + b];
    }
    i0 = bspline(x * inv - 0.5, w, 0);
    j0 = bspline(y * inv, w, 3);
    for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) {
      const i = i0 + a;
      const j = j0 + b;
      if (i < 0 || i >= nx || j < 0 || j > ny) continue;
      L.fV[i + j * nx] += fy * w[a] * w[3 + b];
    }
  }

  /* -- Berührungen ----------------------------------------------------------------------------------- */

  private substep(): void {
    const { grid: g, grains: G } = this.e;
    const { px, py, head, next } = this;
    const { nx, ny } = g;
    const h = this.h;
    for (let q = 0; q < G.count; q += 1) {
      px[q] = G.x[q];
      py[q] = G.y[q];
      G.x[q] += h * G.vx[q];
      G.y[q] += h * G.vy[q];
    }
    /* Nachbarn je Zelle (nach der vorhergesagten Lage; der Berührabstand ist kleiner als eine Zelle). */
    head.fill(-1);
    for (let q = 0; q < G.count; q += 1) {
      const c = g.cellAt(G.x[q], G.y[q]);
      next[q] = head[c];
      head[c] = q;
    }
    const inv = 1 / g.dx;
    for (let it = 0; it < ITER; it += 1) {
      const back = (it & 1) === 1;
      for (let k = 0; k < G.count; k += 1) {
        const q = back ? G.count - 1 - k : k;
        const ci = Math.min(nx - 1, Math.max(0, Math.floor(G.x[q] * inv)));
        const cj = Math.min(ny - 1, Math.max(0, Math.floor(G.y[q] * inv)));
        for (let b = -1; b <= 1; b += 1) {
          const j = cj + b;
          if (j < 0 || j >= ny) continue;
          for (let a = -1; a <= 1; a += 1) {
            const i = ci + a;
            if (i < 0 || i >= nx) continue;
            for (let o = head[i + j * nx]; o >= 0; o = next[o]) if (o !== q && (back ? o < q : o > q)) this.pair(q, o);
          }
        }
        this.walls(q);
      }
    }
    for (let q = 0; q < G.count; q += 1) {
      G.vx[q] = (G.x[q] - px[q]) / h;
      G.vy[q] = (G.y[q] - py[q]) / h;
    }
  }

  /** Zwei Körner: nicht ineinander; Haft- oder Gleitreibung längs der Berührung (nach ihren Massen). */
  private pair(a: number, b: number): void {
    const G = this.e.grains;
    const dxp = G.x[a] - G.x[b];
    const dyp = G.y[a] - G.y[b];
    const rr = this.rad[a] + this.rad[b];
    const d2 = dxp * dxp + dyp * dyp;
    if (d2 >= rr * rr || d2 < 1e-24) return;
    const d = Math.sqrt(d2);
    const nxv = dxp / d;
    const nyv = dyp / d;
    const pen = rr - d;
    /* Höher liegende Körner geben nach (Massenskalierung nach der Höhe, je vier Radien ein Faktor e). */
    const wa = Math.exp(this.ks * G.y[a]) / G.m[a];
    const wb = Math.exp(this.ks * G.y[b]) / G.m[b];
    const sa = wa / (wa + wb);
    const sb = wb / (wa + wb);
    G.x[a] += sa * pen * nxv; G.y[a] += sa * pen * nyv;
    G.x[b] -= sb * pen * nxv; G.y[b] -= sb * pen * nyv;
    /* Reibung: die Verschiebung beider in diesem Teilschritt gegeneinander, quer zur Normalen. */
    const rx = G.x[a] - this.px[a] - (G.x[b] - this.px[b]);
    const ry = G.y[a] - this.py[a] - (G.y[b] - this.py[b]);
    const rn = rx * nxv + ry * nyv;
    const tx = rx - rn * nxv;
    const ty = ry - rn * nyv;
    const tl = Math.hypot(tx, ty);
    if (!(tl > 0)) return;
    const f = tl < MU_STATIC * pen ? 1 : Math.min(1, (MU_KINETIC * pen) / tl);
    G.x[a] -= sa * f * tx; G.y[a] -= sa * f * ty;
    G.x[b] += sb * f * tx; G.y[b] += sb * f * ty;
  }

  /** Ein Korn an Wänden, Feststoffen und Körpern: hinausschieben, Reibung gegen die (ruhende oder bewegte) Fläche. */
  private walls(q: number): void {
    const e = this.e;
    const { grid: g, grains: G } = e;
    const r = this.rad[q];
    const W = g.w;
    const H = g.h;
    /* Seiten der Kiste (geschlossene): wie eine Wand mit Reibung. */
    if (!g.openL && G.x[q] < r) this.wallContact(q, 1, 0, r - G.x[q], 0, 0);
    if (!g.openR && G.x[q] > W - r) this.wallContact(q, -1, 0, G.x[q] - (W - r), 0, 0);
    if (!g.openB && G.y[q] < r) this.wallContact(q, 0, 1, r - G.y[q], 0, 0);
    if (!g.openT && G.y[q] > H - r) this.wallContact(q, 0, -1, G.y[q] - (H - r), 0, 0);
    /* Ein wacher Körper entscheidet selbst (seine genaue Form). */
    const bodyHit = e.liquid.bodyHit;
    const near = bodyHit !== null ? bodyHit(this.px[q], this.py[q], G.x[q], G.y[q], this.hit) : 0;
    if (near === 1) {
      const hx = this.hit;
      const pen = Math.hypot(hx[0] - G.x[q], hx[1] - G.y[q]);
      this.wallContact(q, hx[2], hx[3], pen, hx[4], hx[5]);
      return;
    }
    if (near === 2) return;
    /* Feststoffe: längs des Abstandsfelds (positiv im Fluid). */
    const d = g.sdfAt(G.x[q], G.y[q]);
    if (d >= r) return;
    const ee = 0.25 * g.dx;
    let nxv = g.sdfAt(G.x[q] + ee, G.y[q]) - g.sdfAt(G.x[q] - ee, G.y[q]);
    let nyv = g.sdfAt(G.x[q], G.y[q] + ee) - g.sdfAt(G.x[q], G.y[q] - ee);
    const len = Math.hypot(nxv, nyv);
    if (!(len > 1e-12)) return;
    nxv /= len;
    nyv /= len;
    this.wallContact(q, nxv, nyv, r - d, 0, 0);
  }

  /** Hinaus längs (nx, ny) um pen; Reibung gegen die Fläche, die sich mit (vx, vy) bewegt. */
  private wallContact(q: number, nxv: number, nyv: number, pen: number, vx: number, vy: number): void {
    if (!(pen > 0)) return;
    const G = this.e.grains;
    G.x[q] += pen * nxv;
    G.y[q] += pen * nyv;
    const rx = G.x[q] - this.px[q] - vx * this.h;
    const ry = G.y[q] - this.py[q] - vy * this.h;
    const rn = rx * nxv + ry * nyv;
    const tx = rx - rn * nxv;
    const ty = ry - rn * nyv;
    const tl = Math.hypot(tx, ty);
    if (!(tl > 0)) return;
    const f = tl < MU_STATIC * pen ? 1 : Math.min(1, (MU_KINETIC * pen) / tl);
    G.x[q] -= f * tx;
    G.y[q] -= f * ty;
  }

  /** Durch offene Seiten hinaus: entwichen (Salz und Energie); sonst in der Kiste halten. */
  private escape(): void {
    const e = this.e;
    const { grid: g, grains: G } = e;
    const W = g.w;
    const H = g.h;
    const m = 1e-4 * g.dx;
    for (let q = 0; q < G.count; q += 1) {
      const x = G.x[q];
      const y = G.y[q];
      if ((x < 0 && g.openL) || (x > W && g.openR) || (y < 0 && g.openB) || (y > H && g.openT)) {
        if (GRAIN_MATS[G.mat[q]].dissolves) e.flows.escapedSalt += G.m[q];
        e.flows.escapedEnergy += G.enthalpy(q);
        G.remove(q);
        q -= 1;
        continue;
      }
      if (x < m || x > W - m) G.vx[q] = 0;
      if (y < m || y > H - m) G.vy[q] = 0;
      G.x[q] = Math.min(W - m, Math.max(m, x));
      G.y[q] = Math.min(H - m, Math.max(m, y));
    }
  }
}
