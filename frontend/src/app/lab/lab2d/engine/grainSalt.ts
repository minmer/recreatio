/**
 * LABOR 2D (v2) — KÖRNER UND IHRE ZELLE (M3c, SANDBOX.md §5, §8): Salzkörner
 * lösen sich, wachsen aus übersättigter Lösung, nehmen die Temperatur der
 * Flüssigkeit (oder Luft) ihrer Zelle an und tragen trockene Spalten, an
 * denen in überhitztem Wasser Blasen keimen.
 *
 * - **Lösen** (Stoffübergang, mit Ausblasen): ṁ = A k ρ ln(1 + B),
 *   B = (w_sat − w_∞)/(1 − w_sat), k = Sh D/d, Sh = 1 + (1 + Re Sc)^⅓ f(Re)
 *   mit f = 1 (Re ≤ 1), Re^0,077 (1 < Re ≤ 400) — Clift, Grace & Weber, wie
 *   Nugraha et al. 2022 (https://doi.org/10.1016/j.ces.2021.117292) sie
 *   zitieren; w_∞ der Salzgehalt des Wassers der Zelle, w_sat(T) der der
 *   gesättigten Lösung (solution.ts), A = N π d² die Fläche der echten
 *   Körner, Re aus dem Schlupf des Korns gegen das Wasser. Das gelöste Salz
 *   geht an die Wasserteilchen der Zelle (nach ihrem Wasser) mit seiner
 *   Enthalpie als Kristall: die Lösungswärme Δ_solH (bei 20 °C +4,6 kJ/mol)
 *   kühlt die Lösung von selbst — Energie und Salz genau. Nie mehr, als das
 *   Wasser der Zelle bis zur Sättigung aufnimmt.
 * - **Wachsen**: was eine übersättigte Lösung abgibt (salt.ts), geht an ein
 *   Korn in derselben oder einer Nachbarzelle, wenn es eines gibt (sonst als
 *   Kruste auf den nächsten Feststoff, wie bisher).
 * - **Wärme**: ein Korn nähert sich der Temperatur der Flüssigkeit seiner Zelle
 *   (ohne Wasser: der Luft) mit τ = m c_p/(h A), h = Nu k/d (dieselbe Form wie
 *   Sh, mit Pr); die Wärme nimmt die Zelle im Wärmeschritt (heat.src).
 * - **Keime**: in den Spalten der Körner ist Luft (Griffith & Wallis 1958);
 *   gerät ein Korn in Wasser über T_sat + ΔT_act(10 µm) (3,3 K), setzt es eine
 *   Blase frei — einmal. Die Luft hält sich WET_LIFE im Wasser (sie löst sich
 *   erst nach und nach): ein Korn, das durch die Oberfläche (dort T_sat) in
 *   überhitztes Wasser fällt, keimt noch darin.
 */

import { activation } from './cavities';
import type { Engine } from './engine';
import { GRAIN_MATS } from './grains';
import { rhoVapourSatFast, tSat } from './if97';
import { gridVelocityAt } from './extend';
import { cpL, hV, kL, kMix, muL, rhoL, sigma, WATER } from './materials';
import { hCrystal, hWaterIn, NACL, rhoSol, saltDiffusivity, satFraction } from './solution';
import { GAS, H2O, LIQUID, SPECIES_SLOTS, T0 } from './units';

/** Mündungsradius der Spalten der Körner (m): ΔT_act ≈ 3,3 K bei 1 atm. */
const R_CAVITY = 1e-5;
/** So lange hält sich die Luft in den Spalten eines Korns im Wasser (s; Modellannahme). */
const WET_LIFE = 2;
/** Unter diesem Anteil seiner ersten Masse ist ein Korn gelöst (der Rest geht mit). */
const GONE = 1e-4;

/** Sherwood- (oder Nusselt-)Zahl einer Kugel nach Clift: 1 + (1 + Re Sc)^⅓ f(Re). */
export function sherwood(Re: number, Sc: number): number {
  const f = Re <= 1 ? 1 : Math.pow(Math.min(Re, 400), 0.077);
  return 1 + Math.cbrt(1 + Re * Sc) * f;
}

export class GrainSalt {
  private readonly e: Engine;
  /* Je Zelle die erste ihrer Wasserteilchen und je Teilchen das nächste (−1: Ende); je Zelle die erste ihrer Körner. */
  private head: Int32Array;
  private next = new Int32Array(0);
  private gHead: Int32Array;
  private gNext = new Int32Array(0);
  private listed = false;
  /** Gelöst und gewachsen seit dem Start (kg). */
  dissolved = 0;
  grown = 0;
  /** Blasen, die an Körnern keimten (seit dem Start). */
  burst = 0;
  private readonly vel = new Float64Array(2);

  constructor(engine: Engine) {
    this.e = engine;
    this.head = new Int32Array(engine.grid.n);
    this.gHead = new Int32Array(engine.grid.n);
  }

  /** Nach einem Schritt der Körner sind die Listen alt. */
  invalidate(): void { this.listed = false; }

  /** Die Wasserteilchen und die Körner je Zelle (nach ihrem Ort). */
  private list(): void {
    if (this.listed) return;
    const { grid: g, particles: P, grains: G } = this.e;
    if (this.next.length < P.cap) this.next = new Int32Array(P.cap);
    if (this.gNext.length < G.cap) this.gNext = new Int32Array(G.cap);
    this.head.fill(-1);
    this.gHead.fill(-1);
    for (let p = 0; p < P.count; p += 1) {
      if (P.mat[p] !== WATER) continue;
      const c = g.cellAt(P.x[p], P.y[p]);
      if (c < 0) continue;
      this.next[p] = this.head[c];
      this.head[c] = p;
    }
    for (let q = 0; q < G.count; q += 1) {
      const c = g.cellAt(G.x[q], G.y[q]);
      if (c < 0) continue;
      this.gNext[q] = this.gHead[c];
      this.gHead[c] = q;
    }
    this.listed = true;
  }

  /** Lösen, Wärme, Keime (Stufe 5, nach dem Ausfallen der übersättigten Teilchen). */
  step(dt: number): void {
    const { grains: G } = this.e;
    if (G.count === 0) return;
    this.listed = false;
    this.list();
    this.nucleate(dt);
    this.heatAndDissolve(dt);
    this.listed = false;
  }

  /**
   * Ein übersättigtes Teilchen bei (px, py) gibt x (kg) Kristall mit der Enthalpie Hx (J) ab: an ein Korn derselben
   * oder einer Nachbarzelle (das nächste); false, wenn keines da ist (dann die Kruste, salt.ts).
   */
  grow(px: number, py: number, x: number, Hx: number): boolean {
    const { grid: g, grains: G } = this.e;
    if (G.count === 0) return false;
    this.list();
    const c0 = g.cellAt(px, py);
    if (c0 < 0) return false;
    const i0 = c0 % g.nx;
    const j0 = (c0 - i0) / g.nx;
    let best = -1;
    let bd = Infinity;
    for (let b = -1; b <= 1; b += 1) for (let a = -1; a <= 1; a += 1) {
      const i = i0 + a;
      const j = j0 + b;
      if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) continue;
      for (let q = this.gHead[i + j * g.nx]; q >= 0; q = this.gNext[q]) {
        if (!GRAIN_MATS[G.mat[q]].dissolves) continue;
        const d = (G.x[q] - px) ** 2 + (G.y[q] - py) ** 2;
        if (d < bd) { bd = d; best = q; }
      }
    }
    if (best < 0) return false;
    /* Das Korn nimmt Masse und Enthalpie des Kristalls auf: seine Temperatur aus der Summe. */
    const H = G.enthalpy(best) + Hx;
    G.m[best] += x;
    G.T[best] = T0 + H / (G.m[best] * G.cp(best));
    this.grown += x;
    return true;
  }

  /** Körner mit trockenen Spalten im Wasser: über T_sat + ΔT_act eine Blase, auf jeden Fall geflutet. */
  private nucleate(dt: number): void {
    const e = this.e;
    const { grid: g, grains: G, bubbles: B, particles: P, liquid: L } = e;
    for (let q = 0; q < G.count; q += 1) {
      if (G.dry[q] === 0) continue;
      const c = g.cellAt(G.x[q], G.y[q]);
      if (c < 0 || g.kind[c] !== LIQUID || this.head[c] < 0) continue;
      G.wet[q] += dt;
      if (G.wet[q] > WET_LIFE) { G.dry[q] = 0; continue; }
      /* Das Wasser der Zelle: Masse, mittleres T, mittleres h̄_w. */
      let W = 0, WT = 0, WH = 0;
      for (let p = this.head[c]; p >= 0; p = this.next[p]) {
        const s = P.smass[2 * p];
        const mw = P.mass[p] - s;
        W += mw;
        WT += mw * P.T[p];
        WH += mw * (s > 0 ? hWaterIn(P.T[p], s / P.mass[p]) : P.h[p]);
      }
      if (!(W > 0)) continue;
      const Tl = WT / W;
      const pl = Math.max(0.5 * e.pRef, e.pRef + g.pl[c]);
      const Ts = tSat(pl);
      if (Tl - Ts < activation(R_CAVITY, pl)) continue;
      const pb = pl + (2 * sigma(Tl)) / R_CAVITY;
      const Tb = tSat(pb);
      const V = (4 / 3) * Math.PI * R_CAVITY ** 3;
      const mv = rhoVapourSatFast(Tb) * V;
      if (mv * 4 > W) continue;
      const b = B.add(G.x[q], G.y[q], 0.5 * g.depth);
      if (b < 0) continue;
      G.dry[q] = 0;
      B.m[b * SPECIES_SLOTS + H2O] = mv;
      B.r[b] = R_CAVITY;
      B.V[b] = V;
      B.Tb[b] = Tb;
      B.pb[b] = pb;
      B.pv[b] = pb;
      B.H[b] = mv * hV(Tb);
      B.site[b] = -1;
      B.age[b] = 0;
      gridVelocityAt(g, G.x[q], G.y[q], this.vel);
      const mo = e.bubbleModel.motionState;
      mo.ux0[b] = this.vel[0];
      mo.uy0[b] = this.vel[1];
      B.vx[b] = this.vel[0];
      B.vy[b] = this.vel[1];
      /* Der Dampf aus dem Wasser der Zelle (nach seinem Wasser, mit h̄_w), die latente Wärme aus der Zelle. */
      const hbar = WH / W;
      for (let p = this.head[c]; p >= 0; p = this.next[p]) {
        const s = P.smass[2 * p];
        const take = (mv * (P.mass[p] - s)) / W;
        const hw = s > 0 ? hWaterIn(P.T[p], s / P.mass[p]) : P.h[p];
        const before = P.mass[p] / P.rho[p];
        const Hp = P.mass[p] * P.h[p] - take * hw;
        P.mass[p] -= take;
        P.h[p] = Hp / P.mass[p];
        P.derive(p);
        L.dVp[p] += P.mass[p] / P.rho[p] - before;
      }
      e.heat.src[c] -= (mv * (hV(Tb) - hbar)) / dt;
      this.burst += 1;
    }
  }

  /** Jedes Korn: Wärme mit seiner Zelle, dann lösen (wo Wasser ist und es nicht gesättigt ist). */
  private heatAndDissolve(dt: number): void {
    const e = this.e;
    const { grid: g, grains: G, particles: P, liquid: L } = e;
    const n = g.n;
    for (let q = 0; q < G.count; q += 1) {
      const c = g.cellAt(G.x[q], G.y[q]);
      if (c < 0) continue;
      const mat = GRAIN_MATS[G.mat[q]];
      /* Das Wasser der Zelle: Wasser, Salz, Σ m T. */
      let W = 0, S = 0, MT = 0, M = 0;
      for (let p = this.head[c]; p >= 0; p = this.next[p]) {
        const s = P.smass[2 * p];
        W += P.mass[p] - s;
        S += s;
        MT += P.mass[p] * P.T[p];
        M += P.mass[p];
      }
      const wet = W > 0 && g.kind[c] === LIQUID;
      const d = G.diameter(q);
      const A = G.N[q] * Math.PI * d * d;
      gridVelocityAt(g, G.x[q], G.y[q], this.vel);
      const slip = Math.hypot(G.vx[q] - this.vel[0], G.vy[q] - this.vel[1]);
      /* Wärme: zur Flüssigkeit der Zelle (ohne Wasser: zur Luft). */
      const Tf = wet ? MT / M : g.T[c];
      if (wet || g.kind[c] === GAS) {
        let k: number, nu: number, alpha: number;
        if (wet) {
          const rho = rhoL(Tf);
          k = kL(Tf);
          nu = muL(Tf) / rho;
          alpha = k / (rho * cpL(Tf));
        } else {
          k = kMix(g.mg[c], g.mg[n + c], g.mg[H2O * n + c], Tf);
          nu = 1.6e-5;
          alpha = 2.2e-5;
        }
        const Re = (slip * d) / nu;
        const h = (sherwood(Re, nu / alpha) * k) / d;
        const C = G.m[q] * mat.cp;
        const dT = (1 - Math.exp((-dt * h * A) / C)) * (Tf - G.T[q]);
        if (dT !== 0) {
          G.T[q] += dT;
          e.heat.src[c] -= (C * dT) / dt;
        }
      }
      if (!wet || !mat.dissolves) continue;
      /* Lösen. */
      const Tl = MT / M;
      const wInf = S / (S + W);
      const wSat = satFraction(Tl);
      if (wInf >= wSat) continue;
      const rho = rhoSol(Tl, wInf);
      const D = saltDiffusivity(Tl);
      const nu = muL(Tl) / rho;
      const Re = (slip * d) / nu;
      const k = (sherwood(Re, nu / D) * D) / d;
      const Bm = (wSat - wInf) / (1 - wSat);
      let x = A * k * rho * Math.log(1 + Bm) * dt;
      /* Nie über die Sättigung des Wassers der Zelle hinaus. */
      const room = (wSat * (S + W) - S) / (1 - wSat);
      if (x > room) x = Math.max(0, room);
      const gone = G.m[q] - x < GONE * G.m0[q];
      if (gone) x = G.m[q];
      if (!(x > 0)) continue;
      /* An die Wasserteilchen der Zelle nach ihrem Wasser, mit der Enthalpie des Kristalls. */
      const hx = hCrystal(G.T[q]);
      for (let p = this.head[c]; p >= 0; p = this.next[p]) {
        const s = P.smass[2 * p];
        const ds = (x * (P.mass[p] - s)) / W;
        if (!(ds > 0)) continue;
        const before = P.mass[p] / P.rho[p];
        const Hp = P.mass[p] * P.h[p] + ds * hx;
        P.mass[p] += ds;
        P.smass[2 * p] = s + ds;
        P.spc[2 * p] = NACL;
        P.h[p] = Hp / P.mass[p];
        P.derive(p);
        L.dVp[p] += P.mass[p] / P.rho[p] - before;
      }
      this.dissolved += x;
      if (gone) {
        G.remove(q);
        q -= 1;
      } else {
        G.m[q] -= x;
      }
    }
  }
}
