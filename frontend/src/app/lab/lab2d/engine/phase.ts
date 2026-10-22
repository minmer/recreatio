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
 * 2. <b>Entspannungsverdampfen</b> (flash.ts): eine Oberflächenzelle über
 *    T_sat(p) gibt ihre überschüssige fühlbare Wärme als Dampf ab; die
 *    Teilchen enden genau bei T_sat. Ebenso Tröpfchen in Gaszellen.
 * 3. <b>Nebel</b> (fog.ts): Kondensation im Gas genau bis zur Sättigung.
 *
 * Sättigung aus IAPWS-IF97 Region 4 beim örtlichen Druck. Über Salzlösung
 * (M2b) ist der Dampfdruck a_w p_sat(T) und die Siedetemperatur T_b(p, m)
 * (solution.ts): beides je Zelle aus der Molalität ihres Wassers. Wasser
 * verlässt eine Lösung mit seiner partiellen Enthalpie h̄_w (die Sammlung
 * accH führt sie), das Salz bleibt; ein vertrocknendes Teilchen gibt sein Salz
 * an die Kruste (salt.ts).
 */

import type { Engine } from './engine';
import { flashStep } from './flash';
import { fogStep } from './fog';
import { pSatFast, tSat } from './if97';
import { cpLiq, diffVapour, hGas, hL, hV, LIQUIDS, MOLAR, WATER } from './materials';
import { boilingPoint, hCrystal, hWaterIn, M_S, waterActivityFast } from './solution';
import { GAS, H2O, LIQUID, N2, O2, SOLID } from './units';

/** Ein Teilchen unter diesem Anteil seiner Nennmasse verschwindet (sein Rest wird Dampf). */
export const MIN_MASS = 1e-3;

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
  /* Arbeitsfelder (auch für flash.ts). */
  readonly mtot: Float64Array;
  readonly rd: Float64Array;
  readonly Y0: Float64Array;
  /**
   * Je Zelle aus den Teilchen (mit den Wärmegewichten): Temperatur und
   * Wärmekapazität des flüssigen Anteils (aller Flüssigkeiten), Σ w m und
   * Σ w m h des WASSERS (nur Wasser verdampft und kondensiert: alles, was
   * Masse zwischen Flüssigkeit und Dampf bewegt, liest diese beiden), Σ w m
   * aller Flüssigkeiten und die vorherrschende Flüssigkeit (für die Stoffwerte
   * um eine Blase).
   */
  readonly Tl: Float64Array;
  readonly Cl: Float64Array;
  readonly acc: Float64Array;
  readonly accH: Float64Array;
  readonly accAll: Float64Array;
  readonly host: Uint8Array;
  /** Gibt es Teilchen anderer Flüssigkeiten (seit dem letzten gatherLiquid)? */
  mixed = false;
  /**
   * Gelöstes Salz (seit dem letzten gatherLiquid)? Dann je Zelle Σ w s (accS),
   * die Molalität ihres Wassers (mol) und die Aktivität des Wassers (aw, bei Tl).
   */
  salty = false;
  readonly accS: Float64Array;
  readonly mol: Float64Array;
  readonly aw: Float64Array;
  private readonly accMat: Float64Array;
  private readonly Fm: Float64Array;
  private readonly Fe: Float64Array;
  private readonly dm: Float64Array;
  readonly side = new Int32Array(4);
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
    this.accAll = new Float64Array(n);
    this.host = new Uint8Array(n);
    this.accMat = new Float64Array(n * LIQUIDS.length);
    this.accS = new Float64Array(n);
    this.mol = new Float64Array(n);
    this.aw = new Float64Array(n);
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

  /** Gesättigter Massenanteil Y_sat bei T und p über einem Gas mit der trockenen Molmasse dieser Zelle (über Lösung: mit a_w). */
  private ysat(T: number, p: number, c: number, aw = 1): number {
    const g = this.e.grid;
    const n = g.n;
    const x = Math.min(0.999, (aw * pSatFast(T)) / p);
    const mN = g.mg[N2 * n + c];
    const mO = g.mg[O2 * n + c];
    const dry = mN + mO;
    const mDry = dry > 0 ? dry / (mN / MOLAR[N2] + mO / MOLAR[O2]) : 0.02885;
    return (x * MOLAR[H2O]) / (x * MOLAR[H2O] + (1 - x) * mDry);
  }

  /**
   * Temperatur und Wärmekapazität des flüssigen Anteils jeder Zelle, Σ w m_w
   * und Σ w m_w h̄_w des Wassers (in Lösungen nur das Wasser, mit seiner
   * partiellen Enthalpie; in reinem Wasser m und h), Σ w m aller
   * Flüssigkeiten, mit Salz Σ w s (alles mit den Wärmegewichten).
   */
  gatherLiquid(): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny, n } = g;
    const { Tl, Cl, acc, accH, accAll, accS } = this;
    Cl.fill(0);
    Tl.fill(0);
    acc.fill(0);
    accH.fill(0);
    let mixed = false;
    let salty = false;
    for (let p = 0; p < P.count; p += 1) {
      const m = P.mass[p];
      const mat = P.mat[p];
      const Cp = m * P.cp(p);
      const s = P.smass[2 * p];
      const mw = m - s;
      const hw = s > 0 ? hWaterIn(P.T[p], s / m) : P.h[p];
      if (s > 0 && !salty) { salty = true; accS.fill(0); }
      if (mat !== WATER && !mixed) { mixed = true; accAll.fill(0); this.accMat.fill(0); }
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
        if (mat === WATER) {
          acc[c] += w * mw;
          accH[c] += w * mw * hw;
        }
        if (salty) accS[c] += w * s;
        if (mixed) this.accMat[mat * n + c] += w * m;
      }
    }
    for (let c = 0; c < n; c += 1) Tl[c] = Cl[c] > 0 ? Tl[c] / Cl[c] : g.T[c];
    this.mixed = mixed;
    this.salty = salty;
    if (salty) {
      /* Je Zelle die Molalität ihres Wassers und dessen Aktivität bei der Temperatur der Flüssigkeit. */
      for (let c = 0; c < n; c += 1) {
        const mo = accS[c] > 0 && acc[c] > 0 ? accS[c] / (acc[c] * M_S) : 0;
        this.mol[c] = mo;
        this.aw[c] = mo > 0 ? waterActivityFast(Tl[c], mo) : 1;
      }
    }
    if (!mixed) {
      /* Nur Wasser: alle Flüssigkeit ist Wasser. */
      accAll.set(acc);
      this.host.fill(WATER);
      return;
    }
    /* Mit anderen Flüssigkeiten: das Wasser der Teilchen vor dem ersten anderen fehlte in accMat — aus acc nachtragen. */
    const NL = LIQUIDS.length;
    for (let c = 0; c < n; c += 1) {
      this.accMat[WATER * n + c] = salty ? acc[c] + accS[c] : acc[c];
      let all = 0;
      let best = WATER;
      let bm = -1;
      for (let l = 0; l < NL; l += 1) {
        const v = this.accMat[l * n + c];
        all += v;
        if (v > bm) { bm = v; best = l; }
      }
      accAll[c] = all;
      this.host[c] = best;
    }
  }

  /** Anteil des Wassers (mit seinem gelösten Salz) an der Flüssigkeit der Zelle c (1 ohne Flüssigkeit — wie vor M2a). */
  waterShare(c: number): number {
    if (!this.mixed) return 1;
    const all = this.accAll[c];
    return all > 0 ? (this.salty ? this.acc[c] + this.accS[c] : this.acc[c]) / all : 1;
  }

  /** Siedetemperatur der Flüssigkeit der Zelle c beim Druck p (K): mit Salz T_b(p, m), sonst T_sat(p). */
  boilingAt(c: number, p: number): number {
    return this.salty && this.mol[c] > 0 ? boilingPoint(p, this.mol[c]) : tSat(p);
  }

  /** Mittlere spezifische Enthalpie des Wassers der Zelle c (J/kg); ohne Wasserteilchen die des Wassers bei der Temperatur der Zelle. */
  waterH(c: number): number {
    return this.acc[c] > 0 ? this.accH[c] / this.acc[c] : hL(this.Tl[c]);
  }

  /** Die vorherrschende Flüssigkeit am Ort (x, y) (Wasser, wenn dort keine ist). */
  hostAt(x: number, y: number): number {
    const c = this.e.grid.cellAt(x, y);
    return c < 0 ? WATER : this.host[c];
  }

  /**
   * Die Masse Fm[c] (positiv: hinzu, negativ: weg) auf die WASSERteilchen
   * jeder Zelle verteilen, nach w·m_w (aus dem letzten gatherLiquid); reine
   * Teilchen behalten ihr h, Teilchen mit Salz geben oder nehmen das Wasser mit
   * seiner partiellen Enthalpie h̄_w — die Energie ist dann Fm·waterH(c), wie
   * die Aufrufer sie buchen. Kommt Wasser in eine Zelle ohne Wasserteilchen
   * (Dampf kondensiert in Öl), entsteht dort ein neues Teilchen mit waterH(c).
   */
  applyMass(Fm: Float64Array, dt: number): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny } = g;
    const { acc, dm } = this;
    dm.fill(0, 0, P.count);
    for (let p = 0; p < P.count; p += 1) {
      if (P.mat[p] !== WATER) continue;
      const o = 9 * p;
      let d = 0;
      for (let k = 0; k < 9; k += 1) {
        const w = L.wt[o + k];
        if (w === 0) continue;
        const i = L.bi[p] + (k % 3);
        const j = L.bj[p] + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        if (Fm[c] !== 0 && acc[c] > 0) d += (Fm[c] * w * (P.mass[p] - P.smass[2 * p])) / acc[c];
      }
      dm[p] = d;
    }
    const nominal = (L.rhoRef * g.vCell) / 4;
    for (let p = P.count - 1; p >= 0; p -= 1) {
      const d = dm[p];
      if (d === 0) continue;
      if (P.smass[2 * p] > 0) { this.applySalty(p, d, nominal, dt); continue; }
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
    /* Wasser in Zellen ohne Wasserteilchen: ein neues Teilchen (mit waterH, wie die Aufrufer gebucht haben). */
    for (let c = 0; c < g.n; c += 1) {
      if (Fm[c] <= 0 || acc[c] > 0) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      const q = P.add((i + 0.5) * g.dx, (j + 0.5) * g.dx, Fm[c], this.waterH(c), WATER);
      if (q < 0) continue;
      L.placeParticle(q);
      L.dVp[q] = Fm[c] / P.rho[q];
      this.track(q, Fm[c]);
    }
  }

  /** Die Sammlung der Zellen nachführen, wenn sich die Masse von Teilchen p um d ändert (sein h bleibt). */
  private track(p: number, d: number): void {
    const { grid: g, particles: P, liquid: L } = this.e;
    const { nx, ny } = g;
    const o = 9 * p;
    const cp = cpLiq(P.mat[p], P.T[p]);
    for (let k = 0; k < 9; k += 1) {
      const w = L.wt[o + k];
      if (w === 0) continue;
      const i = L.bi[p] + (k % 3);
      const j = L.bj[p] + ((k / 3) | 0);
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const c = i + j * nx;
      this.acc[c] += w * d;
      this.accH[c] += w * d * P.h[p];
      this.accAll[c] += w * d;
      this.Cl[c] += w * d * cp;
    }
  }

  /**
   * Wasser d (kg) zu einem Teilchen mit Salz hinzu (oder weg): es trägt h̄_w
   * beim Zustand, mit dem es in accH steht; die Sammlung wird mit dem neuen
   * Zustand nachgeführt (h̄_w hängt von w ab). Bleibt kaum Wasser, vertrocknet
   * das Teilchen: der Rest Wasser wird Dampf, das Salz Kruste.
   */
  private applySalty(p: number, d: number, nominal: number, dt: number): void {
    const { particles: P, liquid: L } = this.e;
    const s = P.smass[2 * p];
    const m0 = P.mass[p];
    const mw0 = m0 - s;
    const hw0 = hWaterIn(P.T[p], s / m0);
    const cp0 = P.cp(p);
    const H = m0 * P.h[p] + d * hw0;
    const mw1 = mw0 + d;
    if (mw1 < MIN_MASS * nominal) {
      this.trackSalty(p, -mw0, -mw0 * hw0, -m0, -s, -m0 * cp0);
      this.dryUp(p, Math.max(0, mw1), H, dt);
      return;
    }
    const before = m0 / P.rho[p];
    P.mass[p] = m0 + d;
    P.h[p] = H / P.mass[p];
    P.derive(p);
    L.dVp[p] += P.mass[p] / P.rho[p] - before;
    const hw1 = hWaterIn(P.T[p], s / P.mass[p]);
    this.trackSalty(p, d, mw1 * hw1 - mw0 * hw0, d, 0, P.mass[p] * P.cp(p) - m0 * cp0);
  }

  /** Die Sammlung für ein Teilchen mit Salz nachführen: Änderungen von Σ m_w, Σ m_w h̄_w, Σ m, Σ s und der Wärmekapazität. */
  private trackSalty(p: number, dW: number, dWH: number, dAll: number, dS: number, dC: number): void {
    const { grid: g, liquid: L } = this.e;
    const { nx, ny } = g;
    const o = 9 * p;
    for (let k = 0; k < 9; k += 1) {
      const w = L.wt[o + k];
      if (w === 0) continue;
      const i = L.bi[p] + (k % 3);
      const j = L.bj[p] + ((k / 3) | 0);
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const c = i + j * nx;
      this.acc[c] += w * dW;
      this.accH[c] += w * dWH;
      this.accAll[c] += w * dAll;
      this.accS[c] += w * dS;
      this.Cl[c] += w * dC;
    }
  }

  /**
   * Ein Teilchen mit Salz vertrocknet: das restliche Wasser mw wird Dampf in
   * der nächsten Gaszelle darüber, das Salz geht mit h_Kristall(T) in die Kruste
   * (salt.ts); was die Energie H des Teilchens darüber hinaus hatte oder zu
   * wenig hatte, ist latente Wärme seiner Zelle. Ohne Gas darüber geht das
   * Wasser an ein anderes Teilchen der Zelle (wie bei reinem Wasser).
   */
  private dryUp(p: number, mw: number, H: number, dt: number): void {
    const { grid: g, particles: P, liquid: L, heat, gas } = this.e;
    const T = P.T[p];
    const s = P.smass[2 * p];
    const Hs = s * hCrystal(T);
    this.e.salt.deposit(P.x[p], P.y[p], s, Hs);
    const c0 = g.cellAt(P.x[p], P.y[p]);
    let gc = c0;
    while (gc >= 0 && g.kind[gc] !== GAS) gc = gc + g.nx < g.n ? gc + g.nx : -1;
    if (c0 >= 0 && gc >= 0) {
      if (mw > 0) {
        g.mg[H2O * g.n + gc] += mw;
        g.Hg[gc] += mw * hV(T);
        this.produced += mw;
        gas.deriveCell(gc);
      }
      heat.src[c0] -= (mw * hV(T) + Hs - H) / dt;
    } else if (c0 >= 0) {
      for (let q = 0; q < P.count; q += 1) {
        if (q !== p && P.mat[q] === P.mat[p] && g.cellAt(P.x[q], P.y[q]) === c0) {
          const e = P.mass[q] * P.h[q] + (H - Hs);
          P.mass[q] += mw;
          P.h[q] = e / P.mass[q];
          P.derive(q);
          break;
        }
      }
    }
    L.removeParticle(p);
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
      /* Kein Gas darüber: die Masse bleibt Flüssigkeit — beim nächsten Teilchen derselben Flüssigkeit in der Zelle. */
      for (let q = 0; q < P.count; q += 1) {
        if (q !== p && P.mat[q] === P.mat[p] && g.cellAt(P.x[q], P.y[q]) === c0) {
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
    flashStep(this.e, this, dt);
    fogStep(this.e, this);
    this.films();
  }

  /** 1. Dampfdiffusion mit Verdunsten, Kondensieren, Tau und Umgebung als Randbedingungen. */
  private diffuse(dt: number): void {
    const e = this.e;
    const { grid: g, gas, regions: R, heat, solver: S } = e;
    const { nx, ny, n, depth, kind } = g;
    const { mtot, rd, Y0, Tl, Fm, Fe, edge, hvC, hnC, hoC } = this;
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
    /* Die Teilchen: Masse nach w·m verteilt, die latente Wärme als Quelle ihrer Zelle: (Energie des Dampfs − Masse · mittleres h des Wassers) / Δt. */
    for (let c = 0; c < n; c += 1) {
      if (Fm[c] === 0) continue;
      heat.src[c] += (Fe[c] - Fm[c] * this.waterH(c)) / dt;
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
      /* Nur Wasser verdunstet und nimmt Tau auf: die Fläche zählt mit dem Anteil des Wassers an der Flüssigkeit dieser Zelle (Öl allein: kein Austausch). */
      const fw = this.waterShare(nb);
      /* Ohne Wasserteilchen in der Zelle (nur ihr Platz ist flüssig: Blasen, Öl) verdunstet nichts — sonst entstünde Dampf aus nichts. */
      if (fw <= 0 || !(this.acc[nb] > 0)) return 0;
      /* Über Salzlösung der Dampfdruck a_w p_sat (Raoult für Elektrolyte, mit φ nach Pitzer). */
      this.yb = this.ysat(this.Tl[nb], p, c, this.salty ? this.aw[nb] : 1);
      return half * (1 - Y) * fw;
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
      const p = P.add(x, y, full, hL(Tw), WATER);
      if (p < 0) continue;
      g.film[c] -= full;
      g.Es[c] -= full * hL(Tw);
      L.placeParticle(p);
      L.dVp[p] = full / P.rho[p];
    }
  }
}
