/**
 * LABOR 2D (v2) — DIE BEWEGUNG FREIER BLASEN (ARCHITECTURE.md §8.4):
 *
 *   (ρ_v + C_A ρ_l) V dv/dt = −V∇p_l + ρ_v V g + C_A ρ_l V Du/Dt
 *                              − C_A ρ_l V̇ (v − u) − ½ C_D ρ_l A⊥ |v − u| (v − u)
 *
 * mit C_A = ½ und C_D nach Tomiyama et al. (1998) für verunreinigtes Wasser
 * (wie OpenFOAM TomiyamaKataokaZunSakaguchi). u wird auf einem Ring ausserhalb
 * der eigenen Spur gelesen (sonst ritte die Blase auf ihrem Nachlauf);
 * Widerstand und virtuelle Masse wirken umgekehrt auf die Flüssigkeit
 * (Delnoij et al. 1997) — Blasen treiben die Strömung. Blasen unter 20 µm
 * schwimmen mit der Flüssigkeit.
 */

import { FORCE_SLOTS } from './bubbles';
import type { Engine } from './engine';
import { muL, sigma } from './materials';

/** Virtuelle Masse einer Kugel (Prompt v2: C_A = ½). */
const C_A = 0.5;

export class BubbleMotion {
  private readonly e: Engine;
  /** Die Flüssigkeitsgeschwindigkeit, die jede Blase zuletzt gesehen hat (für Du/Dt und die Schlupfgeschwindigkeit). */
  readonly ux0: Float32Array;
  readonly uy0: Float32Array;
  private readonly vel = new Float64Array(2);
  private readonly w3 = new Float64Array(6);

  constructor(engine: Engine) {
    this.e = engine;
    const cap = engine.bubbles.cap;
    this.ux0 = new Float32Array(cap);
    this.uy0 = new Float32Array(cap);
  }

  /** Die Bewegung einer freien Blase über h (halbimplizit im Widerstand); Gegenkräfte auf die Flüssigkeit. */
  move(b: number, h: number, Vdot: number): void {
    const e = this.e;
    const g = e.grid;
    const B = e.bubbles;
    const L = e.liquid;
    const x = B.x[b];
    const y = B.y[b];
    const r = B.r[b];
    const V = B.V[b];
    /* u und ∇p ausserhalb der eigenen Spur: auf einem Ring vom Radius R. */
    const R = Math.max(r + g.dx, 2 * g.dx);
    const vel = this.vel;
    let ux = 0;
    let uy = 0;
    for (let q = 0; q < 8; q += 1) {
      const a = (q * Math.PI) / 4;
      L.velocityAt(x + R * Math.cos(a), y + R * Math.sin(a), vel);
      ux += vel[0] / 8;
      uy += vel[1] / 8;
    }
    const cc = g.cellAt(x, y);
    const Tl = cc >= 0 && e.phase.Cl[cc] > 0 ? e.phase.Tl[cc] : B.Tb[b];
    const rhol = L.rhoRef;
    const mul = muL(Tl);
    const rhov = B.totalMass(b) / Math.max(1e-30, V);
    const dux = (ux - this.ux0[b]) / Math.max(h, 1e-6);
    const duy = (uy - this.uy0[b]) / Math.max(h, 1e-6);
    this.ux0[b] = ux;
    this.uy0[b] = uy;
    /* Kleinste Blasen (unter 20 µm) haben keine nennenswerte Trägheit: sie schwimmen mit der Flüssigkeit. */
    if (r < 20e-6) {
      B.vx[b] = ux;
      B.vy[b] = uy;
      B.x[b] = Math.min(g.w - 1e-6, Math.max(1e-6, x + h * ux));
      B.y[b] = Math.min(g.h - 1e-6, Math.max(1e-6, y + h * uy));
      return;
    }
    const rx = B.vx[b] - ux;
    const ry = B.vy[b] - uy;
    const slip = Math.hypot(rx, ry);
    const d = 2 * r;
    const Re = Math.max(1e-6, (rhol * slip * d) / mul);
    const Eo = (Math.max(0, e.gy) * (rhol - rhov) * d * d) / sigma(Tl);
    /* Tomiyama et al. (1998), verunreinigtes Wasser. */
    const CD = Math.max((24 / Re) * (1 + 0.15 * Math.pow(Re, 0.687)), (8 / 3) * (Eo / (Eo + 4)));
    const K = 0.5 * CD * rhol * this.front(b) * slip;
    const mEff = (rhov + C_A * rhol) * V;
    /*
     * Kräfte ohne Widerstand. −V∇p_l aus der Impulsgleichung der Flüssigkeit,
     * −∇p = ρ_l (Du/Dt − g): in ruhender Flüssigkeit genau der Auftrieb ρ_l V g,
     * in bewegter mit ihrer Beschleunigung (Prompt v2). Aus dem Druckfeld
     * gelesen enthielte er die Störung, die die Gegenkraft der Blase selbst
     * darin erzeugt (die Blase stiege dann zu langsam).
     */
    const Fpx = rhol * V * dux;
    const Fpy = rhol * V * (duy + e.gy);
    const Fwy = -rhov * V * e.gy;
    const Fax = C_A * rhol * V * dux;
    const Fay = C_A * rhol * V * duy;
    /* Wachsende Blase: −C_A ρ_l V̇ (v − u) wirkt wie ein Widerstand (implizit); schrumpfend explizit. */
    const Kv = Vdot > 0 ? C_A * rhol * Vdot : 0;
    /* Schrumpfend verstärkt der Term den Schlupf ((v − u) ∝ 1/V bei erhaltenem Impuls der virtuellen Masse); je Teilschritt höchstens um 20 % von V. */
    const shrink = Vdot < 0 ? Math.min(-Vdot, (0.2 * V) / h) : 0;
    const Fvx = C_A * rhol * shrink * rx;
    const Fvy = C_A * rhol * shrink * ry;
    const vx = (mEff * B.vx[b] + h * (Fpx + Fax + Fvx) + h * (K + Kv) * ux) / (mEff + h * (K + Kv));
    const vy = (mEff * B.vy[b] + h * (Fpy + Fwy + Fay + Fvy) + h * (K + Kv) * uy) / (mEff + h * (K + Kv));
    B.vx[b] = Number.isFinite(vx) ? vx : ux;
    B.vy[b] = Number.isFinite(vy) ? vy : uy;
    const Fdx = -K * (vx - ux);
    const Fdy = -K * (vy - uy);
    const f = b * FORCE_SLOTS;
    B.force[f] = Fpx; B.force[f + 1] = Fpy;
    B.force[f + 2] = 0; B.force[f + 3] = Fwy;
    B.force[f + 4] = Fdx; B.force[f + 5] = Fdy;
    B.force[f + 6] = Fax + Fvx - Kv * (vx - ux); B.force[f + 7] = Fay + Fvy - Kv * (vy - uy);
    /* Gegenkraft auf die Flüssigkeit: −(Widerstand + virtuelle Masse), über h gemittelt auf den Schritt. */
    this.spreadForce(x, y, -(Fdx + B.force[f + 6]) * (h / e.dt), -(Fdy + B.force[f + 7]) * (h / e.dt));
    let nxp = x + h * vx;
    let nyp = y + h * vy;
    /* Wände: nicht hinein. */
    const dist = g.sdfAt(nxp, nyp);
    if (dist < r) {
      const eps = 0.25 * g.dx;
      let gx = g.sdfAt(nxp + eps, nyp) - g.sdfAt(nxp - eps, nyp);
      let gy = g.sdfAt(nxp, nyp + eps) - g.sdfAt(nxp, nyp - eps);
      const len = Math.hypot(gx, gy);
      if (len > 1e-12) {
        gx /= len;
        gy /= len;
        nxp += (r - dist) * gx;
        nyp += (r - dist) * gy;
        const vn = B.vx[b] * gx + B.vy[b] * gy;
        if (vn < 0) { B.vx[b] -= vn * gx; B.vy[b] -= vn * gy; }
      }
    }
    B.x[b] = Math.min(g.w - 1e-6, Math.max(1e-6, nxp));
    B.y[b] = Math.min(g.h - 1e-6, Math.max(1e-6, nyp));
    /* Die Tiefe bleibt in [r, D − r]. */
    const D = g.depth;
    B.z[b] = 2 * r >= D ? D / 2 : Math.min(D - r, Math.max(r, B.z[b]));
  }

  /** Eine Kraft (N) mit den Flächengewichten des B-Splines um (x, y) auf die Flüssigkeit verteilen. */
  private spreadForce(x: number, y: number, fx: number, fy: number): void {
    const L = this.e.liquid;
    const g = this.e.grid;
    const { nx, ny, dx } = g;
    const w = this.w3;
    /* u-Flächen bei (i, j + ½). */
    let i0 = Math.floor(x / dx - 0.5);
    let f = x / dx - i0;
    w[0] = 0.5 * (1.5 - f) ** 2; w[1] = 0.75 - (f - 1) ** 2; w[2] = 0.5 * (f - 0.5) ** 2;
    let j0 = Math.floor(y / dx - 1);
    f = y / dx - 0.5 - j0;
    w[3] = 0.5 * (1.5 - f) ** 2; w[4] = 0.75 - (f - 1) ** 2; w[5] = 0.5 * (f - 0.5) ** 2;
    for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) {
      const i = i0 + a;
      const j = j0 + b;
      if (i < 0 || i > nx || j < 0 || j >= ny) continue;
      L.fU[i + j * (nx + 1)] += fx * w[a] * w[3 + b];
    }
    /* v-Flächen bei (i + ½, j). */
    i0 = Math.floor(x / dx - 1);
    f = x / dx - 0.5 - i0;
    w[0] = 0.5 * (1.5 - f) ** 2; w[1] = 0.75 - (f - 1) ** 2; w[2] = 0.5 * (f - 0.5) ** 2;
    j0 = Math.floor(y / dx - 0.5);
    f = y / dx - j0;
    w[3] = 0.5 * (1.5 - f) ** 2; w[4] = 0.75 - (f - 1) ** 2; w[5] = 0.5 * (f - 0.5) ** 2;
    for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) {
      const i = i0 + a;
      const j = j0 + b;
      if (i < 0 || i >= nx || j < 0 || j > ny) continue;
      L.fV[i + j * nx] += fy * w[a] * w[3 + b];
    }
  }

  /** Angeströmte Fläche A⊥ der Blase b (aus V und r): Kugel πr², Scheibe 2rD, dazwischen linear. */
  private front(b: number): number {
    const B = this.e.bubbles;
    const D = this.e.grid.depth;
    const V = B.V[b];
    const r = B.r[b];
    const v1 = (Math.PI * D * D * D) / 6;
    const v2 = (Math.PI * D * D * D) / 4;
    if (V <= v1) return Math.PI * r * r;
    if (V >= v2) return 2 * r * D;
    const t = (V - v1) / (v2 - v1);
    return (1 - t) * (Math.PI * D * D) / 4 + t * D * D;
  }
}
