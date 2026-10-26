/**
 * LABOR 2D (v2) — WOHIN DAS SCHMELZWASSER GEHT (bodyMelt.ts, seit 2026-10-25
 * eine eigene Datei).
 *
 * Schmelzwasser einer Seite geht an die Wasserteilchen vor ihr, nach ihrer
 * Masse (ein Teilchen über SPLIT Nennmassen teilt sich). Liegt dort keines:
 *
 * - Ist vor der Seite Fluid, sammelt es sich je Seite (pending) und wird ein
 *   neues Teilchen vor ihr, sobald es SPAWN Nennmassen erreicht — höchstens eine
 *   Nennmasse je Teilchen.
 * - Liegt die Seite auf etwas (kein Fluid davor: die Unterseite eines Würfels
 *   auf der Heizplatte), quillt das Wasser an ihren beiden Enden hervor: je die
 *   Hälfte an die Nachbarseiten, dort an das Ende zu dieser Seite.
 *
 * Bis 2026-10-24 sammelte sich das Wasser einer aufliegenden Seite unsichtbar
 * an (kein freier Ort drei Zellen um die Mitte der Unterseite): ein Viertel
 * eines Würfels auf der Heizplatte wurde zu Wasser, das nirgends war, und kam
 * dann auf einmal als ein Teilchen von 50 Nennmassen — die Flüssigkeit sprengte
 * Zellen, das Gas daneben bekam das Tausendfache seiner Masse, und sein Druck
 * schleuderte den Würfel aus der Kiste (MILESTONES.md).
 */

import type { Body2D } from './body';
import type { Engine } from './engine';
import { WATER } from './materials';
import { fluidFront } from './meltSides';
import { NACL } from './solution';
import { LIQUID } from './units';

/** Ein Teilchen über dieser Masse (Vielfaches der Nennmasse) teilt sich; neues Schmelzwasser ab diesem Anteil wird ein Teilchen (auch gpu/kbodymelt.ts). */
export const SPLIT = 2;
export const SPAWN = 0.25;
/** Höchstens so viele neue Teilchen je Seite und Schritt (jedes höchstens eine Nennmasse). */
export const SPAWN_MAX = 4;

/** Schmelzwasser, das noch kein Teilchen ist (je Körper und Seite): Masse samt Salz (kg), Enthalpie (J), Salz (kg), Ort und Normale der Stelle, an der es hervorkommt. */
export interface Pending { m: number; H: number; s: number; x: number; y: number; nx: number; ny: number }

export class MeltWater {
  /** Je Körper und Seite (Schlüssel 4 · Index + Seite) das Wasser, das noch kein Teilchen ist. */
  readonly pending = new Map<number, Pending>();
  private readonly sg = new Float64Array(6);

  constructor(private readonly e: Engine, private readonly inCell: (c: number, fn: (p: number) => void) => void) {}

  /** Wasser (ohne Salz), Enthalpie und Salz des noch nicht verteilten Schmelzwassers (für die Bilanzen). */
  totals(): { m: number; H: number; s: number } {
    let m = 0;
    let H = 0;
    let s = 0;
    for (const p of this.pending.values()) { m += p.m - p.s; H += p.H; s += p.s; }
    return { m, H, s };
  }

  /** Wartet noch Wasser des Körpers mit diesem Index? */
  any(index: number): boolean {
    for (let s = 0; s < 4; s += 1) if ((this.pending.get(4 * index + s)?.m ?? 0) > 0) return true;
    return false;
  }

  /**
   * Schmelzwasser (Masse m samt Salz, Enthalpie H) der Seite s des Rechtecks r. `from`: die aufliegende Seite, deren
   * Wasser hier an ihrem Ende hervorquillt (sonst −1).
   */
  give(b: Body2D, r: number, s: number, m: number, H: number, salt = 0, from = -1): void {
    const g = this.e.grid;
    const P = this.e.particles;
    const L = this.e.liquid;
    const takers: number[] = [];
    const seen = new Set<number>();
    let wsum = 0;
    /* Fluid knapp vor der Seite? (Nur die Zellen direkt davor zählen — eine dünne Platte darunter hat Luft unter sich.) */
    let fluid = false;
    /* Erst die Zellen direkt vor der Seite; nur wenn dort kein Wasserteilchen ist, auch die nächste Lage. */
    for (let pass = 0; pass < 2 && takers.length === 0; pass += 1) {
      for (let e = 0; e < b.nseg; e += 1) {
        if (b.segR[e] !== r || b.segS[e] !== s) continue;
        fluidFront(this.e, b, e, (c) => {
          if (pass === 0) fluid = true;
          if (g.kind[c] !== LIQUID || seen.has(c)) return;
          seen.add(c);
          this.inCell(c, (p) => { if (P.mat[p] === WATER) { takers.push(p); wsum += P.mass[p]; } });
        }, pass === 1);
      }
    }
    if (takers.length === 0 || !(wsum > 0)) {
      if (!fluid && from < 0) {
        /* Die Seite liegt auf etwas: das Wasser quillt an ihren Enden hervor, je zur Hälfte. */
        const ends = s < 2 ? [2, 3] : [0, 1];
        for (const a of ends) this.give(b, r, a, 0.5 * m, 0.5 * H, 0.5 * salt, s);
        return;
      }
      this.hold(b, r, s, m, H, salt, from);
      return;
    }
    const nominal = (L.rhoRef * g.vCell) / 4;
    for (const p of takers) {
      const share = P.mass[p] / wsum;
      const before = P.mass[p] / P.rho[p];
      const Hp = P.mass[p] * P.h[p] + share * H;
      P.mass[p] += share * m;
      if (salt > 0) { P.smass[2 * p] += share * salt; P.spc[2 * p] = NACL; }
      P.h[p] = Hp / P.mass[p];
      P.derive(p);
      L.dVp[p] += P.mass[p] / P.rho[p] - before;
      if (P.mass[p] > SPLIT * nominal) this.split(p);
    }
  }

  /** Ein schweres Teilchen in zwei gleiche teilen (das neue ein Viertel Zelle daneben, nicht in einem Körper oder Bau). */
  private split(p: number): void {
    const P = this.e.particles;
    const L = this.e.liquid;
    const g = this.e.grid;
    const side = P.id[p] % 2 === 0 ? 1 : -1;
    let x = NaN;
    for (const sg of [side, -side]) {
      const cx = Math.min(g.w - 1e-6, Math.max(1e-6, P.x[p] + 0.25 * g.dx * sg));
      const c = g.cellAt(cx, P.y[p]);
      if (c >= 0 && g.solid[c] === 0 && this.e.bodies.bodyAt(cx, P.y[p], 0) === null) { x = cx; break; }
    }
    if (Number.isNaN(x)) return;
    const half = 0.5 * P.mass[p];
    const s = 0.5 * P.smass[2 * p];
    const q = P.add(x, P.y[p], half, P.h[p], P.mat[p], s);
    if (q < 0) return;
    P.mass[p] = half;
    P.smass[2 * p] = s;
    P.derive(p);
    P.vx[q] = P.vx[p];
    P.vy[q] = P.vy[p];
    L.placeParticle(q);
  }

  /** Schmelzwasser ohne Teilchen davor sammeln — vor der Mitte der Seite oder, kam es von der aufliegenden Seite `from`, eine halbe Zelle vor der Ecke zu ihr. */
  private hold(b: Body2D, r: number, s: number, m: number, H: number, salt: number, from: number): void {
    const dx = this.e.grid.dx;
    const [x0, y0, x1, y1] = b.bounds(r);
    let lx = s === 0 ? x0 : s === 1 ? x1 : 0.5 * (x0 + x1);
    let ly = s === 2 ? y0 : s === 3 ? y1 : 0.5 * (y0 + y1);
    if (from === 2) ly = Math.min(y1, y0 + 0.5 * dx);
    else if (from === 3) ly = Math.max(y0, y1 - 0.5 * dx);
    else if (from === 0) lx = Math.min(x1, x0 + 0.5 * dx);
    else if (from === 1) lx = Math.max(x0, x1 - 0.5 * dx);
    const nlx = s === 0 ? -1 : s === 1 ? 1 : 0;
    const nly = s === 2 ? -1 : s === 3 ? 1 : 0;
    const c = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const key = 4 * b.index + s;
    let p = this.pending.get(key);
    if (p === undefined) { p = { m: 0, H: 0, s: 0, x: 0, y: 0, nx: 0, ny: 1 }; this.pending.set(key, p); }
    p.m += m;
    p.H += H;
    p.s += salt;
    p.x = b.x + c * lx - sn * ly;
    p.y = b.y + sn * lx + c * ly;
    p.nx = c * nlx - sn * nly;
    p.ny = sn * nlx + c * nly;
  }

  /** Gesammeltes Schmelzwasser des Körpers wird zu Teilchen (je höchstens eine Nennmasse), sobald es SPAWN Nennmassen erreicht (ist der Körper weg, ganz). */
  spawnAll(b: Body2D): void {
    for (let s = 0; s < 4; s += 1) {
      const p = this.pending.get(4 * b.index + s);
      if (p !== undefined && p.m > 0) this.spawn(b, p);
    }
  }

  private spawn(b: Body2D, p: Pending): void {
    const g = this.e.grid;
    const P = this.e.particles;
    const L = this.e.liquid;
    const nominal = (L.rhoRef * g.vCell) / 4;
    for (let k = 0; k < SPAWN_MAX && p.m > 0; k += 1) {
      if (p.m < SPAWN * nominal && !b.gone) return;
      /* Vor der Stelle, die Teilchen eines Schritts längs der Seite versetzt. */
      const t = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 0.3 * g.dx;
      const x = p.x + 0.3 * g.dx * p.nx - t * p.ny;
      const y = p.y + 0.3 * g.dx * p.ny + t * p.nx;
      const at = this.freeSpot(b, p.x, p.y, x, y) ?? (b.gone ? null : this.outlineSpot(b, x, y));
      if (at === null) return;
      const take = Math.min(p.m, nominal);
      const f = take / p.m;
      const q = P.add(at[0], at[1], take, p.H / p.m, WATER, f * p.s);
      if (q < 0) return;
      P.vx[q] = b.gone ? 0 : b.vx;
      P.vy[q] = b.gone ? 0 : b.vy;
      L.placeParticle(q);
      L.dVp[q] = take / P.rho[q];
      p.H -= f * p.H;
      p.s -= f * p.s;
      p.m -= take;
      if (!(p.m > 1e-15)) { p.m = 0; p.H = 0; p.s = 0; }
    }
  }

  /** Ist (x, y) Fluid (in der Kiste, nicht in einem Bau oder Körper)? */
  private fluidAt(x: number, y: number): boolean {
    const g = this.e.grid;
    if (!(x > 0 && y > 0 && x < g.w && y < g.h)) return false;
    const c = g.cellAt(x, y);
    return c >= 0 && g.solid[c] === 0 && this.e.bodies.bodyAt(x, y, 0) === null;
  }

  /**
   * Ein Ort in Fluid bei (x, y): dort, sonst in Ringen von Zellen bis drei weit, oben zuerst — nur einer, den von der
   * Stelle der Seite (ox, oy) kein anderer Körper trennt (seit 2026-10-25: lag ein Eiswürfel an der Wand einer
   * Zlewka, deren Wand quer über zwei Zellen liegt, kam sein Schmelzwasser zwei Millimeter weiter — ausserhalb).
   */
  private freeSpot(b: Body2D, ox: number, oy: number, x: number, y: number): [number, number] | null {
    const g = this.e.grid;
    const ok = (px: number, py: number): boolean => this.fluidAt(px, py) && !this.e.bodies.blocks(b, ox, oy, px, py);
    if (ok(x, y)) return [x, y];
    for (let ring = 1; ring <= 3; ring += 1) {
      for (let j = ring; j >= -ring; j -= 1) {
        for (let i = -ring; i <= ring; i += 1) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
          if (ok(x + i * g.dx, y + j * g.dx)) return [x + i * g.dx, y + j * g.dx];
        }
      }
    }
    return null;
  }

  /** Der freie Ort knapp vor dem Umriss des Körpers, der (x, y) am nächsten liegt (wenn um die Stelle selbst alles fest ist; nicht hinter einem anderen Körper). */
  private outlineSpot(b: Body2D, x: number, y: number): [number, number] | null {
    const dx = this.e.grid.dx;
    const sg = this.sg;
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let e = 0; e < b.nseg; e += 1) {
      b.segment(e, sg);
      const len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]);
      const n = Math.max(1, Math.ceil(len / (0.5 * dx)));
      for (let q = 0; q < n; q += 1) {
        const t = (q + 0.5) / n;
        const sx = sg[0] + t * (sg[2] - sg[0]);
        const sy = sg[1] + t * (sg[3] - sg[1]);
        const lx = sx + 0.3 * dx * sg[4];
        const ly = sy + 0.3 * dx * sg[5];
        const wx = b.x + cs * lx - sn * ly;
        const wy = b.y + sn * lx + cs * ly;
        const d = (wx - x) * (wx - x) + (wy - y) * (wy - y);
        if (d < bd && this.fluidAt(wx, wy) && !this.e.bodies.blocks(b, b.x + cs * sx - sn * sy, b.y + sn * sx + cs * sy, wx, wy)) { bd = d; best = [wx, wy]; }
      }
    }
    return best;
  }
}
