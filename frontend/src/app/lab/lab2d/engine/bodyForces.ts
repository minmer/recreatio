/**
 * LABOR 2D (v2) — WAS FLÜSSIGKEIT UND GAS AUF EINEN KÖRPER AUSÜBEN (M3a,
 * SANDBOX.md §6).
 *
 * <b>Druck über den wahren Umriss</b>: an der Mitte jeder Umrisskante des
 * Körpers, aus den Fluidzellen auf ihrer Aussenseite (die Zellmitte vor der
 * Kante, in Richtung ihrer Normalen), jede mit der Hydrostatik ρ g Δy auf die
 * Höhe der Kante gebracht: F = −Σ p n Δx D, das Drehmoment mit dem Hebel der
 * Kante. In ruhendem Wasser ist das genau der Auftrieb ρ g V des eingetauchten
 * Teils, auch wenn der Körper zwischen den Zellen steht (eine Summe über die
 * Zellen, die er gerade füllt, spränge mit jeder Zeile); eine Wand von einer
 * Zelle Dicke bekommt innen den Druck des Wassers und aussen den der Luft (über
 * die Wand hinweg gemittelt, drückte das Wasser einer Zlewka kaum auf ihre
 * Wände). Flüssigkeit und Gas vor einer Kante an der Wasserlinie: der grössere
 * der beiden Werte (über der Oberfläche ist es der Druck des Gases). Eine
 * Kante, die auf einem anderen Festen liegt, bekommt den in die festen Zellen
 * fortgesetzten Druck (aus den Fluidnachbarn, Lage um Lage) — als stünde ein
 * dünner Film dazwischen; so treibt ein Holzklotz auch vom Boden des Beckens
 * auf.
 *
 * <b>Mitbewegte Masse</b> (nur für die Stabilität der Kopplung): die Projektion
 * sieht die Geschwindigkeit des Körpers aus dem letzten Schritt; was die
 * Flüssigkeit dafür zurückstösst, ist −M_a ΔV. Der Körper rechnet darum mit
 * (M + M̃_a) und gibt M̃_a ΔV des letzten Schritts zurück
 * (bodies.ts) — stabil, solange die Schätzung M̃_a grösser als die halbe wahre
 * ist; zu gross schadet nicht. Geschätzt: 1,5 ρ_l f A_Hülle D, f der Anteil der
 * Umrisskanten an Flüssigkeit (ein Quadrat in Wasser hat C_a ≈ 1,19); fürs
 * Drehen ρ_l f J_Hülle D. Im Gleichgewicht fällt der Zusatz weg.
 */

import type { Body2D } from './body';
import type { Bubbles } from './bubbles';
import type { Gas } from './gas';
import type { Grid } from './grid';
import type { Liquid } from './liquid';
import type { Particles } from './particles';
import type { Regions } from './regions';
import { GAS, LIQUID } from './units';

/** Mitbewegte Masse: Vorfaktor auf ρ_l f A_Hülle D (Verschieben) und auf ρ_l f J_Hülle D (Drehen) — bewusst grösser als die wahre. */
const ADDED = 1.5;
const ADDED_TURN = 1;

export interface ForceWorld {
  readonly grid: Grid;
  readonly particles: Particles;
  readonly bubbles: Bubbles;
  readonly liquid: Liquid;
  readonly gas: Gas;
  readonly regions: Regions;
  readonly pRef: number;
  readonly gy: number;
}

export class BodyForces {
  /** Druck über p_ref (Pa) je Zelle — in festen Zellen fortgesetzt — und die Dichte, mit der fortgesetzt wird (kg/m³). */
  readonly pe: Float64Array;
  readonly re: Float64Array;
  /** 0: unbekannt; 1: Fluid; 2: fortgesetzt. */
  private readonly known: Uint8Array;
  private readonly mass: Float64Array;
  private readonly vol: Float64Array;
  /** Ergebnis von force(): Fx, Fy (N), Drehmoment (N·m). */
  readonly out = new Float64Array(3);

  constructor(private readonly w: () => ForceWorld) {
    const n = w().grid.n;
    this.pe = new Float64Array(n);
    this.re = new Float64Array(n);
    this.known = new Uint8Array(n);
    this.mass = new Float64Array(n);
    this.vol = new Float64Array(n);
    this.front = new Int32Array(n);
    this.next = new Int32Array(n);
    this.vp = new Float64Array(n);
    this.vr = new Float64Array(n);
    this.queued = new Int32Array(n);
  }

  /** Den Druck dieses Schritts auf alle Zellen ausdehnen. */
  extend(): void {
    const W = this.w();
    const { grid: g, particles: P, liquid, gas, regions } = W;
    const { nx, ny, n, dx } = g;
    const { pe, re, known, mass, vol } = this;
    /* Dichte der Flüssigkeit je Zelle aus ihren Teilchen (Öl über Wasser setzt sich mit seiner eigenen fort). */
    mass.fill(0);
    vol.fill(0);
    for (let p = 0; p < P.count; p += 1) {
      const c = g.cellAt(P.x[p], P.y[p]);
      if (c < 0) continue;
      mass[c] += P.mass[p];
      vol[c] += P.mass[p] / P.rho[p];
    }
    for (let c = 0; c < n; c += 1) {
      const k = g.kind[c];
      if (k === LIQUID) {
        pe[c] = g.pl[c];
        re[c] = vol[c] > 0 ? mass[c] / vol[c] : liquid.rhoRef;
        known[c] = 1;
      } else if (k === GAS && g.solid[c] === 0) {
        pe[c] = regions.pAt(c) - W.pRef + g.pg[c];
        re[c] = gas.rho[c] > 0 ? gas.rho[c] : regions.rhoAmb;
        known[c] = 1;
      } else {
        pe[c] = 0;
        re[c] = 0;
        known[c] = 0;
      }
    }
    /*
     * Lage um Lage durch alles Feste (ein breiter Klotz, der flach am Boden
     * liegt, braucht so viele Lagen wie die halbe Breite): jede Zelle aus den
     * Nachbarn früherer Lagen, die in derselben Lage gesetzten zählen erst in
     * der nächsten — unabhängig von der Reihenfolge.
     */
    const gdx = W.gy * dx;
    const front = this.front;
    const next = this.next;
    const vp = this.vp;
    const vr = this.vr;
    const queued = this.queued;
    const tag = ++this.tag;
    let nf = 0;
    for (let c = 0; c < n; c += 1) {
      if (known[c] !== 0) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      if ((i > 0 && known[c - 1] === 1) || (i < nx - 1 && known[c + 1] === 1) || (j > 0 && known[c - nx] === 1) || (j < ny - 1 && known[c + nx] === 1)) {
        front[nf++] = c;
        queued[c] = tag;
      }
    }
    while (nf > 0) {
      for (let q = 0; q < nf; q += 1) {
        const c = front[q];
        const i = c % nx;
        const j = (c - i) / nx;
        let s = 0;
        let r = 0;
        let cnt = 0;
        if (i > 0 && known[c - 1] !== 0) { s += pe[c - 1]; r += re[c - 1]; cnt += 1; }
        if (i < nx - 1 && known[c + 1] !== 0) { s += pe[c + 1]; r += re[c + 1]; cnt += 1; }
        if (j > 0 && known[c - nx] !== 0) { s += pe[c - nx] - re[c - nx] * gdx; r += re[c - nx]; cnt += 1; }
        if (j < ny - 1 && known[c + nx] !== 0) { s += pe[c + nx] + re[c + nx] * gdx; r += re[c + nx]; cnt += 1; }
        vp[q] = cnt > 0 ? s / cnt : 0;
        vr[q] = cnt > 0 ? r / cnt : 0;
      }
      let nn = 0;
      for (let q = 0; q < nf; q += 1) {
        const c = front[q];
        pe[c] = vp[q];
        re[c] = vr[q];
        known[c] = 2;
      }
      for (let q = 0; q < nf; q += 1) {
        const c = front[q];
        const i = c % nx;
        const j = (c - i) / nx;
        for (let d = 0; d < 4; d += 1) {
          const ii = i + (d === 0 ? -1 : d === 1 ? 1 : 0);
          const jj = j + (d === 2 ? -1 : d === 3 ? 1 : 0);
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const nb = ii + jj * nx;
          if (known[nb] !== 0 || queued[nb] === tag) continue;
          queued[nb] = tag;
          next[nn++] = nb;
        }
      }
      /* Die nächste Lage nach Zellen geordnet (wie sie gefunden wird, hängt von der Reihenfolge ab, das Ergebnis nicht). */
      nf = nn;
      for (let q = 0; q < nn; q += 1) front[q] = next[q];
    }
  }

  private readonly front: Int32Array;
  private readonly next: Int32Array;
  private readonly vp: Float64Array;
  private readonly vr: Float64Array;
  private readonly queued: Int32Array;
  private tag = 0;

  /** Der fortgesetzte Druck an (x, y): bilinear über die bekannten Zellmitten (Pa über p_ref). */
  pressureAt(x: number, y: number): number {
    const g = this.w().grid;
    const { nx, ny, dx } = g;
    const fx = Math.min(nx - 1.0001, Math.max(0, x / dx - 0.5));
    const fy = Math.min(ny - 1.0001, Math.max(0, y / dx - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    let s = 0;
    let wsum = 0;
    for (let b = 0; b < 2; b += 1) {
      for (let a = 0; a < 2; a += 1) {
        const c = i + a + (j + b) * nx;
        if (this.known[c] === 0) continue;
        const wgt = (a === 0 ? 1 - tx : tx) * (b === 0 ? 1 - ty : ty);
        s += wgt * this.pe[c];
        wsum += wgt;
      }
    }
    return wsum > 0 ? s / wsum : 0;
  }

  /** Kraft (N) und Drehmoment (N·m) des Drucks auf den Körper: über die Mitten seiner Umrisskanten (Ergebnis in out). */
  force(b: Body2D): Float64Array {
    const out = this.out;
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const A = b.dx * b.depth;
    let fx = 0;
    let fy = 0;
    let tq = 0;
    for (let e = 0; e < b.ne; e += 1) {
      const lx = b.ex[e];
      const ly = b.ey[e];
      const d = b.ed[e];
      const nlx = d === 0 ? -1 : d === 1 ? 1 : 0;
      const nly = d === 2 ? -1 : d === 3 ? 1 : 0;
      const rx = cs * lx - sn * ly;
      const ry = sn * lx + cs * ly;
      const nwx = cs * nlx - sn * nly;
      const nwy = sn * nlx + cs * nly;
      const p = this.sideAt(b.x + rx, b.y + ry, nwx, nwy) * A;
      fx -= p * nwx;
      fy -= p * nwy;
      tq -= p * (rx * nwy - ry * nwx);
    }
    out[0] = fx;
    out[1] = fy;
    out[2] = tq;
    return out;
  }

  /**
   * Der Druck (über p_ref) an einem Punkt (mx, my) des Umrisses mit der
   * Aussennormalen (nx, ny): aus den Fluidzellen um den Punkt eine halbe Zelle
   * davor, nur denen, deren Mitte auf der Aussenseite liegt, je mit ρ g Δy auf
   * die Höhe des Punkts gebracht — Flüssigkeit und Gas getrennt, der grössere
   * Wert gilt. Kein Fluid davor (der Körper liegt auf etwas): der fortgesetzte
   * Druck.
   */
  private sideAt(mx: number, my: number, nx: number, ny: number): number {
    const W = this.w();
    const g = W.grid;
    const { dx } = g;
    const sx = mx + 0.5 * dx * nx;
    const sy = my + 0.5 * dx * ny;
    const fx = Math.min(g.nx - 1.0001, Math.max(0, sx / dx - 0.5));
    const fy = Math.min(g.ny - 1.0001, Math.max(0, sy / dx - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    let ls = 0;
    let lw = 0;
    let gs = 0;
    let gw = 0;
    for (let b = 0; b < 2; b += 1) {
      for (let a = 0; a < 2; a += 1) {
        const ci = i + a;
        const cj = j + b;
        const c = ci + cj * g.nx;
        if (this.known[c] !== 1) continue;
        const xc = (ci + 0.5) * dx;
        const yc = (cj + 0.5) * dx;
        if ((xc - mx) * nx + (yc - my) * ny <= 0) continue;
        const wgt = (a === 0 ? 1 - tx : tx) * (b === 0 ? 1 - ty : ty) + 1e-6;
        const v = this.pe[c] + this.re[c] * W.gy * (yc - my);
        if (g.kind[c] === LIQUID) { ls += wgt * v; lw += wgt; } else { gs += wgt * v; gw += wgt; }
      }
    }
    if (lw > 0 && gw > 0) return Math.max(ls / lw, gs / gw);
    if (lw > 0) return ls / lw;
    if (gw > 0) return gs / gw;
    return this.pressureAt(mx, my);
  }

  /** Mitbewegte Masse und Trägheit schätzen (b.ma, b.Ia): nach dem Anteil der Umrisskanten, vor denen Flüssigkeit liegt. */
  addedMass(b: Body2D): void {
    const W = this.w();
    const g = W.grid;
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    let wet = 0;
    for (let e = 0; e < b.ne; e += 1) {
      const d = b.ed[e];
      const lx = b.ex[e] + (d === 0 ? -0.5 : d === 1 ? 0.5 : 0) * b.dx;
      const ly = b.ey[e] + (d === 2 ? -0.5 : d === 3 ? 0.5 : 0) * b.dx;
      const c = g.cellAt(b.x + cs * lx - sn * ly, b.y + sn * lx + cs * ly);
      if (c >= 0 && g.kind[c] === LIQUID) wet += 1;
    }
    const f = b.ne > 0 ? wet / b.ne : 0;
    const rho = W.liquid.rhoRef;
    b.ma = ADDED * rho * f * b.hullA * b.depth;
    b.Ia = ADDED_TURN * rho * f * b.hullJ * b.depth;
  }
}
