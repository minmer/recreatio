/**
 * LABOR 2D (v2) — GRENZFLÄCHE UND PHASENWECHSEL IM GAS (ARCHITECTURE.md §9).
 *
 * 1. <b>Dampfdiffusion, implizit</b> (Jacobi-CG über den Gaszellen), mit den
 *    Grenzflächen als Randbedingungen:
 *    - Flüssigkeit–Gas: Y_sat(T_s) auf der Fläche selbst (nicht in der ersten
 *      Gaszelle), ṁ″ = ρ D (Y_sat − Y_1)/(Δx/2), mit dem Stefan-Faktor
 *      (1 − Y) (die Luft bleibt). Positiv verdunstet Wasser aus den
 *      Teilchen der Oberflächenzelle, negativ kondensiert Dampf auf ihnen.
 *    - Gas–Wand: ist das Gas feuchter als Y_sat(T_Wand), schlägt sich Tau im
 *      Wandfilm nieder: ṁ″ = ρ D (Y_1 − Y_sat(T_w))/(Δx/2); ein Film verdunstet
 *      umgekehrt, solange er da ist. Ein voller Film gibt ein Teilchen ab, das
 *      hinunterläuft.
 *    - Offene Seite: Austausch mit der Umgebungsluft (Y_amb), entwichen.
 *    Jeder Übergang trägt die Masse mit der Enthalpie des Speichers, den sie
 *    verlässt; die Differenz ist latente Wärme der Zelle (Quelle der
 *    Wärmestufe) — die Bilanzen schliessen.
 * 2. <b>Entspannungsverdampfen</b>: eine Oberflächenzelle über T_sat(p) gibt
 *    ihre überschüssige fühlbare Wärme als Dampf ab; die Teilchen enden genau
 *    bei T_sat.
 * 3. <b>Nebel</b>: ist p_H₂O > p_sat(T), kondensiert Δm so, dass der
 *    restliche Dampf bei der neuen Temperatur genau gesättigt ist (H bleibt,
 *    T steigt um h_lv Δm/C) — gesucht mit einem eingeschlossenen
 *    Sekantenverfahren; „den Überschuss bei der alten Temperatur“ zu
 *    kondensieren schösse weit hinaus. Untersättigt verdunstet Nebel ebenso.
 *
 * Sättigung aus IAPWS-IF97 Region 4 beim örtlichen Druck.
 */

import type { Engine } from './engine';
import { pSatFast, tSat } from './if97';
import { cpL, diffVapour, gasHeatCapacity, gasTemperature, hGas, hL, hV, MOLAR } from './materials';
import { GAS, H2O, LIQUID, N2, O2, SOLID } from './units';

/** Ein Teilchen unter diesem Anteil seiner Nennmasse verschwindet (sein Rest wird Dampf). */
const MIN_MASS = 1e-3;

export class Phase {
  private readonly e: Engine;
  /** Dampf aus der Flüssigkeit (Verdunsten, Entspannung) und zurück (Kondensieren an der Oberfläche), seit dem Start (kg). */
  produced = 0;
  condensed = 0;
  /** Tau in Wandfilmen, Film zu Teilchen, Nebel netto (kg, seit dem Start). */
  dew = 0;
  fogMade = 0;
  producedMark = 0;
  /** Nebel in diesem Schritt: grösste relative Abweichung von der Sättigung in Zellen mit Nebel, Zellen mit Nebel ohne Übersättigung. */
  fogError = 0;
  fogWrong = 0;
  /* Arbeitsfelder. */
  private readonly mtot: Float64Array;
  private readonly rd: Float64Array;
  private readonly Y0: Float64Array;
  /** Je Zelle aus den Teilchen (mit den Wärmegewichten): Temperatur und Wärmekapazität des flüssigen Anteils, Σ w m, Σ w m h. */
  readonly Tl: Float64Array;
  readonly Cl: Float64Array;
  readonly acc: Float64Array;
  readonly accH: Float64Array;
  private readonly Fm: Float64Array;
  private readonly Fe: Float64Array;
  private readonly dm: Float64Array;
  private readonly side = new Int32Array(4);
  /** Rand der Diffusion je Zelle und Seite (Leitwert, Wert) — beim Aufbau berechnet, bei den Flüssen gelesen. */
  private readonly bG: Float64Array;
  private readonly bY: Float64Array;
  /** Je Gaszelle: hat sie einen Rand (Seite zu Flüssigkeit, Feststoff oder Kistenrand)? Nur dort fragt die Diffusion boundary(). */
  private readonly edge: Uint8Array;
  /** Je Zelle bei ihrer Temperatur (für die Flüsse der Diffusion einmal je Schritt): h_v, h_N₂, h_O₂ (J/kg). */
  private readonly hvC: Float64Array;
  private readonly hnC: Float64Array;
  private readonly hoC: Float64Array;

  constructor(engine: Engine) {
    this.e = engine;
    const n = engine.grid.n;
    this.mtot = new Float64Array(n);
    this.rd = new Float64Array(n);
    this.Y0 = new Float64Array(n);
    this.Tl = new Float64Array(n);
    this.Cl = new Float64Array(n);
    this.acc = new Float64Array(n);
    this.accH = new Float64Array(n);
    this.Fm = new Float64Array(n);
    this.Fe = new Float64Array(n);
    this.dm = new Float64Array(engine.particles.cap);
    this.bG = new Float64Array(4 * n);
    this.bY = new Float64Array(4 * n);
    this.edge = new Uint8Array(n);
    this.hvC = new Float64Array(n);
    this.hnC = new Float64Array(n);
    this.hoC = new Float64Array(n);
  }

  /* -- Hilfen ---------------------------------------------------------------------------------------- */

  /** Gesättigter Massenanteil Y_sat bei T und p über einem Gas mit der trockenen Molmasse dieser Zelle. */
  private ysat(T: number, p: number, c: number): number {
    const g = this.e.grid;
    const n = g.n;
    const x = Math.min(0.999, pSatFast(T) / p);
    const mN = g.mg[N2 * n + c];
    const mO = g.mg[O2 * n + c];
    const dry = mN + mO;
    const mDry = dry > 0 ? dry / (mN / MOLAR[N2] + mO / MOLAR[O2]) : 0.02885;
    return (x * MOLAR[H2O]) / (x * MOLAR[H2O] + (1 - x) * mDry);
  }

  /** Temperatur und Wärmekapazität des flüssigen Anteils jeder Zelle, und Σ w m, Σ w m h der Teilchen (mit den Wärmegewichten). */
  gatherLiquid(): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny } = g;
    const { Tl, Cl, acc, accH } = this;
    Cl.fill(0);
    Tl.fill(0);
    acc.fill(0);
    accH.fill(0);
    for (let p = 0; p < P.count; p += 1) {
      const m = P.mass[p];
      const Cp = m * cpL(P.T[p]);
      const o = 9 * p;
      for (let k = 0; k < 9; k += 1) {
        const w = L.wt[o + k];
        if (w === 0) continue;
        const i = L.bi[p] + (k % 3);
        const j = L.bj[p] + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        Cl[c] += w * Cp;
        Tl[c] += w * Cp * P.T[p];
        acc[c] += w * m;
        accH[c] += w * m * P.h[p];
      }
    }
    for (let c = 0; c < g.n; c += 1) Tl[c] = Cl[c] > 0 ? Tl[c] / Cl[c] : g.T[c];
  }

  /**
   * Die Masse Fm[c] (positiv: hinzu, negativ: weg) auf die Teilchen jeder Zelle
   * verteilen, nach w·m (aus dem letzten gatherLiquid); die Teilchen behalten
   * ihr h — die Energie ist dann Fm·h̄ der Zelle, wie die Aufrufer sie buchen.
   */
  applyMass(Fm: Float64Array, dt: number): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny } = g;
    const { acc, dm } = this;
    dm.fill(0, 0, P.count);
    for (let p = 0; p < P.count; p += 1) {
      const o = 9 * p;
      let d = 0;
      for (let k = 0; k < 9; k += 1) {
        const w = L.wt[o + k];
        if (w === 0) continue;
        const i = L.bi[p] + (k % 3);
        const j = L.bj[p] + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        if (Fm[c] !== 0 && acc[c] > 0) d += (Fm[c] * w * P.mass[p]) / acc[c];
      }
      dm[p] = d;
    }
    const nominal = (L.rhoRef * g.vCell) / 4;
    for (let p = P.count - 1; p >= 0; p -= 1) {
      const d = dm[p];
      if (d === 0) continue;
      const before = P.mass[p] / P.rho[p];
      const m = P.mass[p] + d;
      if (m < MIN_MASS * nominal) {
        /* Der Rest des Teilchens wird Dampf in der Gaszelle über ihm (genau gebucht: latente Wärme aus seiner Zelle). */
        this.track(p, -P.mass[p]);
        this.vanish(p, Math.max(0, m), dt);
        continue;
      }
      this.track(p, d);
      P.mass[p] = m;
      L.dVp[p] += m / P.rho[p] - before;
    }
  }

  /** Die Sammlung der Zellen nachführen, wenn sich die Masse von Teilchen p um d ändert (sein h bleibt). */
  private track(p: number, d: number): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny } = g;
    const o = 9 * p;
    const cp = cpL(P.T[p]);
    for (let k = 0; k < 9; k += 1) {
      const w = L.wt[o + k];
      if (w === 0) continue;
      const i = L.bi[p] + (k % 3);
      const j = L.bj[p] + ((k / 3) | 0);
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const c = i + j * nx;
      this.acc[c] += w * d;
      this.accH[c] += w * d * P.h[p];
      this.Cl[c] += w * d * cp;
    }
  }

  /** Ein fast leeres Teilchen verschwinden lassen: seine Restmasse wird Dampf in der nächsten Gaszelle darüber. */
  private vanish(p: number, m: number, dt: number): void {
    const { grid: g, particles: P, liquid: L, heat, gas } = this.e;
    const c0 = g.cellAt(P.x[p], P.y[p]);
    let gc = c0;
    while (gc >= 0 && g.kind[gc] !== GAS) gc = gc + g.nx < g.n ? gc + g.nx : -1;
    if (m > 0 && gc >= 0 && c0 >= 0) {
      const T = P.T[p];
      g.mg[H2O * g.n + gc] += m;
      g.Hg[gc] += m * hV(T);
      heat.src[c0] -= (m * (hV(T) - P.h[p])) / dt;
      this.produced += m;
      gas.deriveCell(gc);
    } else if (m > 0 && c0 >= 0) {
      /* Kein Gas darüber: die Masse bleibt Flüssigkeit — beim nächsten Teilchen der Zelle. */
      for (let q = 0; q < P.count; q += 1) {
        if (q !== p && g.cellAt(P.x[q], P.y[q]) === c0) {
          const e = P.mass[q] * P.h[q] + m * P.h[p];
          P.mass[q] += m;
          P.h[q] = e / P.mass[q];
          P.derive(q);
          break;
        }
      }
    }
    L.removeParticle(p);
  }

  /* -- Ein Schritt ----------------------------------------------------------------------------------- */

  step(dt: number): void {
    /* Die Sammlung der Flüssigkeit stammt aus der Blasenstufe dieses Schritts (applyMass hält sie aktuell). */
    this.diffuse(dt);
    this.flash();
    this.fog();
    this.films();
  }

  /** 1. Dampfdiffusion mit Verdunsten, Kondensieren, Tau und Umgebung als Randbedingungen. */
  private diffuse(dt: number): void {
    const e = this.e;
    const { grid: g, gas, regions: R, heat, solver: S } = e;
    const { nx, ny, n, depth, kind } = g;
    const { mtot, rd, Y0, Tl, Fm, Fe, accH, acc, edge, hvC, hnC, hoC } = this;
    let any = false;
    for (let c = 0; c < n; c += 1) {
      if (kind[c] !== GAS) { mtot[c] = 0; continue; }
      const m = g.mg[c] + g.mg[n + c] + g.mg[H2O * n + c];
      mtot[c] = m;
      Y0[c] = m > 0 ? g.mg[H2O * n + c] / m : 0;
      const T = g.T[c];
      rd[c] = gas.rho[c] * diffVapour(T, R.pAt(c));
      hvC[c] = hV(T);
      hnC[c] = hGas(N2, T);
      hoC[c] = hGas(O2, T);
      any = true;
    }
    if (!any) return;
    /* Gaszellen mit einem Rand: eine Seite zu Flüssigkeit, Feststoff oder zum Kistenrand. */
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        edge[c] = kind[c] === GAS && (i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || kind[c - 1] !== GAS || kind[c + 1] !== GAS || kind[c - nx] !== GAS || kind[c + nx] !== GAS) ? 1 : 0;
      }
    }
    const sys = S.begin(nx, ny);
    const stride = sys.stride;
    const yAmb = e.ambientY[H2O];
    const { bG, bY } = this;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (kind[c] !== GAS || mtot[c] <= 0) continue;
        const s = i + 1 + (j + 1) * stride;
        sys.act[s] = 1;
        sys.x[s] = Y0[c];
        sys.dH[s] = mtot[c] / dt;
        let b = (mtot[c] * Y0[c]) / dt;
        if (i + 1 < nx && kind[c + 1] === GAS && mtot[c + 1] > 0) sys.ax[s] = 0.5 * (rd[c] + rd[c + 1]) * depth;
        if (j + 1 < ny && kind[c + nx] === GAS && mtot[c + nx] > 0) sys.ay[s] = 0.5 * (rd[c] + rd[c + nx]) * depth;
        if (edge[c] === 0) { sys.b[s] = b; continue; }
        let gb = 0;
        for (let k = 0; k < 4; k += 1) {
          const G = this.boundary(c, i, j, k, yAmb);
          bG[4 * c + k] = G;
          bY[4 * c + k] = this.yb;
          if (G <= 0) continue;
          gb += G;
          b += G * this.yb;
        }
        sys.dDx[s] = gb;
        sys.b[s] = b;
      }
    }
    S.solve(1e-9, 200, false);
    /* Flüsse aus dem gelösten Y: innen antisymmetrisch (Dampf hin, Luft zurück), an den Rändern einseitig. */
    Fm.fill(0);
    Fe.fill(0);
    const X = sys.x;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (kind[c] !== GAS || mtot[c] <= 0) continue;
        const s = i + 1 + (j + 1) * stride;
        const Yc = X[s];
        if (i + 1 < nx && kind[c + 1] === GAS && mtot[c + 1] > 0) this.exchange(c, c + 1, dt * 0.5 * (rd[c] + rd[c + 1]) * depth * (Yc - X[s + 1]));
        if (j + 1 < ny && kind[c + nx] === GAS && mtot[c + nx] > 0) this.exchange(c, c + nx, dt * 0.5 * (rd[c] + rd[c + nx]) * depth * (Yc - X[s + stride]));
        if (edge[c] === 0) continue;
        for (let k = 0; k < 4; k += 1) {
          const G = bG[4 * c + k];
          if (G <= 0) continue;
          /* Masse, die aus der Grenzfläche ins Gas geht (negativ: aus dem Gas hinaus). */
          const F = dt * G * (bY[4 * c + k] - Yc);
          const out = k === 0 ? i === 0 : k === 1 ? i === nx - 1 : k === 2 ? j === 0 : j === ny - 1;
          const nb = out ? -1 : k === 0 ? c - 1 : k === 1 ? c + 1 : k === 2 ? c - nx : c + nx;
          if (nb < 0) {
            /* Offene Seite: Dampf hinein oder hinaus, Luft in Gegenrichtung (wie zwischen zwei Gaszellen). */
            this.ambientExchange(c, F);
          } else if (kind[nb] === LIQUID) {
            if (F > 0) {
              const T = Tl[nb];
              g.mg[H2O * n + c] += F;
              g.Hg[c] += F * hV(T);
              Fm[nb] -= F;
              Fe[nb] -= F * hV(T);
              this.produced += F;
            } else {
              const take = Math.min(-F, g.mg[H2O * n + c]);
              g.mg[H2O * n + c] -= take;
              g.Hg[c] -= take * hV(g.T[c]);
              Fm[nb] += take;
              Fe[nb] += take * hV(g.T[c]);
              this.condensed += take;
            }
          } else if (kind[nb] === SOLID) {
            const Tw = g.T[nb];
            if (F < 0) {
              const take = Math.min(-F, g.mg[H2O * n + c]);
              g.mg[H2O * n + c] -= take;
              g.Hg[c] -= take * hV(g.T[c]);
              g.film[nb] += take;
              g.Es[nb] += take * hL(Tw);
              heat.src[nb] += (take * (hV(g.T[c]) - hL(Tw))) / dt;
              this.dew += take;
            } else {
              const give = Math.min(F, g.film[nb]);
              g.film[nb] -= give;
              g.Es[nb] -= give * hL(Tw);
              g.mg[H2O * n + c] += give;
              g.Hg[c] += give * hV(Tw);
              heat.src[nb] -= (give * (hV(Tw) - hL(Tw))) / dt;
              this.dew -= give;
            }
          }
        }
      }
    }
    /* Die Teilchen: Masse nach w·m verteilt, die latente Wärme als Quelle ihrer Zelle: (Energie des Dampfs − Masse · mittleres h) / Δt. */
    for (let c = 0; c < n; c += 1) {
      if (Fm[c] === 0 || acc[c] <= 0) continue;
      const hbar = accH[c] / acc[c];
      heat.src[c] += (Fe[c] - Fm[c] * hbar) / dt;
    }
    this.applyMass(Fm, dt);
    for (let c = 0; c < n; c += 1) if (kind[c] === GAS && mtot[c] > 0) gas.deriveCell(c);
  }

  /** Wert am Rand (in this.yb) und Leitwert G einer Seite k (0 links, 1 rechts, 2 unten, 3 oben) der Gaszelle c; 0: kein Austausch. Merkt den Nachbarn in side[k] (−1: offene Seite). */
  private yb = 0;
  private boundary(c: number, i: number, j: number, k: number, yAmb: number): number {
    const g = this.e.grid;
    const { nx, ny, depth, kind } = g;
    const out = k === 0 ? i === 0 : k === 1 ? i === nx - 1 : k === 2 ? j === 0 : j === ny - 1;
    const half = 2 * this.rd[c] * depth;
    if (out) {
      this.side[k] = -1;
      const open = k === 0 ? g.openL : k === 1 ? g.openR : k === 2 ? g.openB : g.openT;
      if (!open) return 0;
      this.yb = yAmb;
      return half;
    }
    const nb = k === 0 ? c - 1 : k === 1 ? c + 1 : k === 2 ? c - nx : c + nx;
    this.side[k] = nb;
    const kn = kind[nb];
    const Y = this.Y0[c];
    const p = this.e.regions.pAt(c);
    if (kn === LIQUID) {
      this.yb = this.ysat(this.Tl[nb], p, c);
      return half * (1 - Y);
    }
    if (kn === SOLID) {
      const ys = this.ysat(g.T[nb], p, c);
      if (Y > ys || (g.film[nb] > 0 && Y < ys)) { this.yb = ys; return half * (1 - Y); }
      return 0;
    }
    return 0;
  }

  /** Dampf F (kg) von a nach b, Luft gleicher Masse zurück — jede mit der Enthalpie ihrer Spenderzelle. */
  private exchange(a: number, b: number, Fin: number): void {
    const g = this.e.grid;
    const n = g.n;
    if (Fin === 0) return;
    const from = Fin > 0 ? a : b;
    const to = Fin > 0 ? b : a;
    let F = Math.abs(Fin);
    F = Math.min(F, g.mg[H2O * n + from]);
    const airN = g.mg[N2 * n + to];
    const airO = g.mg[O2 * n + to];
    const air = airN + airO;
    const back = Math.min(F, air);
    if (F <= 0) return;
    /* h_v(T) der Spenderzelle, h der Luft bei T der Empfängerzelle — aus den Zellwerten dieses Schritts (diffuse()). */
    const hv = this.hvC[from];
    g.mg[H2O * n + from] -= F;
    g.mg[H2O * n + to] += F;
    g.Hg[from] -= F * hv;
    g.Hg[to] += F * hv;
    if (back > 0) {
      const fN = (back * airN) / air;
      const fO = back - fN;
      g.mg[N2 * n + to] -= fN;
      g.mg[O2 * n + to] -= fO;
      g.mg[N2 * n + from] += fN;
      g.mg[O2 * n + from] += fO;
      const h = fN * this.hnC[to] + fO * this.hoC[to];
      g.Hg[to] -= h;
      g.Hg[from] += h;
    }
  }

  /** Austausch mit der Umgebung durch eine offene Seite: F > 0 Dampf herein (Luft hinaus), F < 0 Dampf hinaus (Luft herein). */
  private ambientExchange(c: number, F: number): void {
    const e = this.e;
    const g = e.grid;
    const n = g.n;
    const Ta = e.ambientT;
    if (F > 0) {
      const air = g.mg[N2 * n + c] + g.mg[O2 * n + c];
      const back = Math.min(F, air);
      g.mg[H2O * n + c] += F;
      g.Hg[c] += F * hV(Ta);
      if (back > 0) {
        const fN = (back * g.mg[N2 * n + c]) / air;
        const fO = back - fN;
        g.mg[N2 * n + c] -= fN;
        g.mg[O2 * n + c] -= fO;
        const h = fN * hGas(N2, g.T[c]) + fO * hGas(O2, g.T[c]);
        g.Hg[c] -= h;
        e.flows.escapedAir += back;
        e.flows.escapedEnergy += h;
      }
      e.flows.escapedWater -= F;
      e.flows.escapedEnergy -= F * hV(Ta);
    } else if (F < 0) {
      const out = Math.min(-F, g.mg[H2O * n + c]);
      const yN = e.ambientY[N2];
      const yO = e.ambientY[O2];
      const dry = yN + yO > 0 ? yN + yO : 1;
      g.mg[H2O * n + c] -= out;
      g.Hg[c] -= out * hV(g.T[c]);
      const fN = (out * yN) / dry;
      const fO = out - fN;
      g.mg[N2 * n + c] += fN;
      g.mg[O2 * n + c] += fO;
      const h = fN * hGas(N2, Ta) + fO * hGas(O2, Ta);
      g.Hg[c] += h;
      e.flows.escapedWater += out;
      e.flows.escapedAir -= out;
      e.flows.escapedEnergy += out * hV(g.T[c]) - h;
    }
  }

  /** 2. Entspannungsverdampfen an der Oberfläche: Teilchenanteile über T_sat geben ihre Überhitzung als Dampf ab. */
  private flash(): void {
    const e = this.e;
    const { grid: g, particles: P, liquid: L, regions: R, gas } = e;
    const { nx, ny, n, kind } = g;
    const { Tl } = this;
    /* Oberflächenzellen über T_sat: die Siedetemperatur steht in rd[c] (Arbeitsfeld), sonst 0. */
    const ts = this.rd;
    let any = false;
    for (let c = 0; c < n; c += 1) {
      ts[c] = 0;
      if (kind[c] !== LIQUID) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      const up = j + 1 < ny ? c + nx : -1;
      const surface = (up >= 0 && kind[up] === GAS) || (i > 0 && kind[c - 1] === GAS) || (i < nx - 1 && kind[c + 1] === GAS) || (j > 0 && kind[c - nx] === GAS);
      if (!surface) continue;
      const Tsat = tSat(R.pAt(c));
      if (Tl[c] > Tsat) { ts[c] = Tsat; any = true; }
    }
    if (!any) return;
    const vap = this.mtot;
    vap.fill(0);
    const vapH = this.Y0;
    vapH.fill(0);
    for (let p = 0; p < P.count; p += 1) {
      const o = 9 * p;
      let lost = 0;
      let lostE = 0;
      for (let k = 0; k < 9; k += 1) {
        const w = L.wt[o + k];
        if (w === 0) continue;
        const i = L.bi[p] + (k % 3);
        const j = L.bj[p] + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        const Tsat = ts[c];
        if (Tsat === 0) continue;
        const hs = hL(Tsat);
        if (P.h[p] <= hs) continue;
        const hv = hV(Tsat);
        const dmv = (w * P.mass[p] * (P.h[p] - hs)) / (hv - hs);
        lost += dmv;
        lostE += dmv * hv;
        vap[c] += dmv;
        vapH[c] += dmv * hv;
      }
      if (lost === 0) continue;
      const before = P.mass[p] / P.rho[p];
      const m = P.mass[p] - lost;
      P.h[p] = (P.mass[p] * P.h[p] - lostE) / m;
      P.mass[p] = m;
      P.derive(p);
      L.dVp[p] += m / P.rho[p] - before;
    }
    /* Der Dampf geht in die Gasnachbarn der Oberflächenzelle (bevorzugt nach oben). */
    for (let c = 0; c < n; c += 1) {
      if (vap[c] === 0) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      let targets = 0;
      const up = j + 1 < ny && kind[c + nx] === GAS ? c + nx : -1;
      if (up >= 0) {
        g.mg[H2O * n + up] += vap[c];
        g.Hg[up] += vapH[c];
        gas.deriveCell(up);
      } else {
        const nbs = this.side;
        nbs[0] = i > 0 && kind[c - 1] === GAS ? c - 1 : -1;
        nbs[1] = i < nx - 1 && kind[c + 1] === GAS ? c + 1 : -1;
        nbs[2] = j > 0 && kind[c - nx] === GAS ? c - nx : -1;
        nbs[3] = -1;
        for (let k = 0; k < 3; k += 1) if (nbs[k] >= 0) targets += 1;
        for (let k = 0; k < 3; k += 1) {
          if (nbs[k] < 0) continue;
          g.mg[H2O * n + nbs[k]] += vap[c] / targets;
          g.Hg[nbs[k]] += vapH[c] / targets;
          gas.deriveCell(nbs[k]);
        }
      }
      this.produced += vap[c];
    }
  }

  /** Die Temperatur einer Gaszelle mit geänderten Massen (Dampf mv, Nebel mf) bei gleicher Enthalpie H. */
  private tempWith(c: number, mv: number, mf: number, T0: number): number {
    const g = this.e.grid;
    const n = g.n;
    const mN = g.mg[N2 * n + c];
    const mO = g.mg[O2 * n + c];
    const H = g.Hg[c];
    if (mf <= 0) return gasTemperature(mN, mO, mv, H);
    let T = T0;
    for (let it = 0; it < 6; it += 1) {
      const Hc = mN * hGas(N2, T) + mO * hGas(O2, T) + mv * hV(T) + mf * hL(T);
      const dT = (H - Hc) / gasHeatCapacity(mN, mO, mv, mf, T);
      T += dT;
      if (Math.abs(dT) < 1e-10) break;
    }
    return T;
  }

  /** Abstand zur Sättigung p_v − p_sat(T) (Pa) nach dem Kondensieren von d (kg Dampf → Nebel). */
  private satGap(c: number, d: number, nDry: number, p: number, T0: number): number {
    const g = this.e.grid;
    const n = g.n;
    const mv = g.mg[H2O * n + c] - d;
    const mf = g.mfog[c] + d;
    const T = this.tempWith(c, mv, mf, T0);
    const nv = mv / MOLAR[H2O];
    /* Reiner Dampf ohne Luft: p_v = p; ganz ohne Gas: p_v = 0. */
    const pv = nv + nDry > 0 ? (nv / (nv + nDry)) * p : 0;
    return pv - pSatFast(T);
  }

  /** 3. Nebel: Kondensation bis genau zur Sättigung, oder Verdunsten von Nebel in untersättigtem Gas. */
  private fog(): void {
    const { grid: g, gas, regions: R } = this.e;
    const n = g.n;
    this.fogError = 0;
    this.fogWrong = 0;
    for (let c = 0; c < n; c += 1) {
      if (g.kind[c] !== GAS) continue;
      const mv = g.mg[H2O * n + c];
      const mf = g.mfog[c];
      if (mv <= 0 && mf <= 0) continue;
      const nDry = g.mg[N2 * n + c] / MOLAR[N2] + g.mg[O2 * n + c] / MOLAR[O2];
      const p = R.pAt(c);
      const T0 = g.T[c];
      if (mf <= 0) {
        const nv = mv / MOLAR[H2O];
        if ((nv / (nv + nDry)) * p < 0.999 * pSatFast(T0)) continue;
      }
      const gap0 = this.satGap(c, 0, nDry, p, T0);
      if (gap0 <= 0 && mf <= 0) continue;
      let lo: number, hi: number, flo: number, fhi: number;
      if (gap0 > 0) {
        lo = 0; flo = gap0;
        hi = mv; fhi = this.satGap(c, hi, nDry, p, T0);
      } else {
        hi = 0; fhi = gap0;
        lo = -mf; flo = this.satGap(c, lo, nDry, p, T0);
        if (flo <= 0) {
          /* Auch ohne Nebel untersättigt: aller Nebel verdunstet. */
          this.setFog(c, lo);
          continue;
        }
      }
      if (fhi > 0) { this.setFog(c, hi); continue; }
      /* Eingeschlossene Sekante (Illinois): f(lo) > 0 > f(hi). */
      let d = lo;
      let side = 0;
      for (let it = 0; it < 40; it += 1) {
        d = (lo * fhi - hi * flo) / (fhi - flo);
        if (!Number.isFinite(d) || d <= Math.min(lo, hi) || d >= Math.max(lo, hi)) d = 0.5 * (lo + hi);
        const f = this.satGap(c, d, nDry, p, T0);
        if (Math.abs(f) <= 1e-13 * p) break;
        if (f > 0) { lo = d; flo = f; if (side === 1) fhi /= 2; side = 1; }
        else { hi = d; fhi = f; if (side === -1) flo /= 2; side = -1; }
      }
      this.setFog(c, d);
      if (gap0 < 0 && d > 0) this.fogWrong += 1;
      if (g.mfog[c] > 0) {
        const after = this.satGap(c, 0, nDry, p, g.T[c]);
        this.fogError = Math.max(this.fogError, Math.abs(after) / pSatFast(g.T[c]));
      }
      void gas;
    }
  }

  private setFog(c: number, d: number): void {
    const { grid: g, gas } = this.e;
    const n = g.n;
    if (d === 0 || !Number.isFinite(d)) return;
    const dd = Math.max(-g.mfog[c], Math.min(g.mg[H2O * n + c], d));
    g.mg[H2O * n + c] -= dd;
    g.mfog[c] += dd;
    if (g.mfog[c] < 1e-30) g.mfog[c] = 0;
    this.fogMade += dd;
    gas.deriveCell(c);
  }

  /** Volle Wandfilme geben ein Teilchen ab (in die Gaszelle neben der Wand, mit der Temperatur der Wand). */
  private films(): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny, n, kind } = g;
    const full = (L.rhoRef * g.vCell) / 4;
    for (let c = 0; c < n; c += 1) {
      if (g.solid[c] === 0 || g.film[c] < full) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      /* Die Gasseite: bevorzugt seitlich (der Film läuft an der Wand hinunter), sonst oben, unten. */
      const nbs = [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, j + 1 < ny ? c + nx : -1, j > 0 ? c - nx : -1];
      const target = nbs.find((b) => b >= 0 && kind[b] === GAS);
      if (target === undefined) continue;
      const ti = target % nx;
      const tj = (target - ti) / nx;
      const x = (ti + 0.5 + 0.25 * Math.sign(i - ti)) * g.dx;
      const y = (tj + 0.5 + 0.25 * Math.sign(j - tj)) * g.dx;
      const Tw = g.T[c];
      const p = P.add(x, y, full, hL(Tw), 0);
      if (p < 0) continue;
      g.film[c] -= full;
      g.Es[c] -= full * hL(Tw);
      L.weightsDirty = true;
    }
  }
}
