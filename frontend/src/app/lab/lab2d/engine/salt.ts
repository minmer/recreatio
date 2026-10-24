/**
 * LABOR 2D (v2) — SALZ, DAS AUSFÄLLT (M2b, SANDBOX.md §5): Verdunsten und
 * Sieden nehmen nur Wasser; wird eine Lösung dabei übersättigt (w über
 * w_sat(T), Pitzer, Peiper & Busey 1984), kristallisiert der Überschuss.
 *
 * - Ein Teilchen gibt x = (s − w_sat m)/(1 − w_sat) Salz ab (danach genau
 *   gesättigt). Das Salz verlässt die Lösung als Kristall mit h_Kristall(T);
 *   die Kristallisationswärme (h̄_s − h_Kristall) bleibt im Teilchen — es wird
 *   etwas wärmer (Lösen kühlt, Ausfallen wärmt).
 * - Die Kristalle setzen sich auf den nächsten Feststoff: eine feste
 *   Nachbarzelle des Teilchens (bevorzugt darunter), sonst die erste feste
 *   Zelle unter ihm (sie sinken: Steinsalz ist fast doppelt so dicht wie
 *   gesättigte Sole). Dort wird es Kruste (grid.crust, ihre Enthalpie in Es,
 *   ihre Wärmekapazität im Feststoff). Liegt unter dem Teilchen kein
 *   Feststoff, landet es auf dem Boden der Kiste (eigener Speicher je Spalte,
 *   ohne Wärmeaustausch) oder fällt durch einen offenen Boden hinaus.
 * - Die Kruste löst sich nicht wieder (SIMPLIFICATIONS.md: erst die Körner
 *   von M3c lösen sich, mit einem Stoffübergang); Salzmasse und Energie sind
 *   über alle Wege genau gebucht.
 */

import type { Engine } from './engine';
import { hCrystal, satFraction } from './solution';

export class Salt {
  private readonly e: Engine;
  /** Salz auf dem Boden der Kiste je Spalte (kg) und seine Enthalpie (J) — wo unter der Lösung kein Feststoff lag. */
  readonly floor: Float64Array;
  readonly floorH: Float64Array;
  /** Auskristallisiertes Salz seit dem Start (kg). */
  crystallized = 0;

  constructor(engine: Engine) {
    this.e = engine;
    this.floor = new Float64Array(engine.grid.nx);
    this.floorH = new Float64Array(engine.grid.nx);
  }

  /** Salz am Boden der Kiste (kg) und seine Enthalpie (J). */
  floorTotals(): { mass: number; energy: number } {
    let m = 0;
    let H = 0;
    for (let i = 0; i < this.floor.length; i += 1) { m += this.floor[i]; H += this.floorH[i]; }
    return { mass: m, energy: H };
  }

  /** Salz in den Krusten der Feststoffe (kg): Zellen eines festen Baus und die inneren Zellen der Körper (die Zellen mit Körperteilen spiegeln diese nur). */
  crustMass(): number {
    const g = this.e.grid;
    let m = 0;
    for (let c = 0; c < g.n; c += 1) if (g.owner[c] === 0 && g.capB[c] === 0) m += g.crust[c];
    for (const b of this.e.bodies.list) if (!b.gone) m += b.crustMass();
    return m;
  }

  /** Kristalle x (kg) mit der Enthalpie H (J) vom Ort (px, py) auf den nächsten Feststoff (siehe oben). */
  deposit(px: number, py: number, x: number, H: number): void {
    if (!(x > 0)) return;
    const e = this.e;
    const g = e.grid;
    const { nx, ny } = g;
    const i = Math.min(nx - 1, Math.max(0, Math.floor(px / g.dx)));
    const j = Math.min(ny - 1, Math.max(0, Math.floor(py / g.dx)));
    const c0 = i + j * nx;
    const heat = e.heat;
    /* Fest ist auch ein Körperstück neben Fluid (die Kruste geht über die Gewichte an seine inneren Zellen). */
    if (heat.hasSolid(c0)) { this.toSolid(c0, x, H); return; }
    const sides = [j > 0 ? c0 - nx : -1, i > 0 ? c0 - 1 : -1, i < nx - 1 ? c0 + 1 : -1, j < ny - 1 ? c0 + nx : -1];
    for (const b of sides) if (b >= 0 && heat.hasSolid(b)) { this.toSolid(b, x, H); return; }
    for (let jj = j - 2; jj >= 0; jj -= 1) {
      const c = i + jj * nx;
      if (heat.hasSolid(c)) { this.toSolid(c, x, H); return; }
    }
    if (g.openB) {
      e.flows.escapedSalt += x;
      e.flows.escapedEnergy += H;
      return;
    }
    this.floor[i] += x;
    this.floorH[i] += H;
  }

  private toSolid(c: number, x: number, H: number): void {
    const g = this.e.grid;
    g.crust[c] += x;
    g.Es[c] += H;
    this.e.heat.deriveSolid(c);
  }

  /** Übersättigte Teilchen geben ihren Überschuss als Kristalle ab (nach der Grenzflächenstufe). */
  step(): void {
    const { particles: P, liquid: L } = this.e;
    for (let p = 0; p < P.count; p += 1) {
      const s = P.smass[2 * p];
      if (!(s > 0)) continue;
      const m = P.mass[p];
      const T = P.T[p];
      const ws = satFraction(T);
      if (s <= ws * m * (1 + 1e-9)) continue;
      const x = (s - ws * m) / (1 - ws);
      const Hx = x * hCrystal(T);
      const before = m / P.rho[p];
      const H = m * P.h[p] - Hx;
      P.mass[p] = m - x;
      P.smass[2 * p] = s - x;
      P.h[p] = H / P.mass[p];
      P.derive(p);
      L.dVp[p] += P.mass[p] / P.rho[p] - before;
      /* Ein Korn in derselben oder einer Nachbarzelle wächst (M3c); sonst Kruste. */
      if (!this.e.grainSalt.grow(P.x[p], P.y[p], x, Hx)) this.deposit(P.x[p], P.y[p], x, Hx);
      this.crystallized += x;
    }
  }
}
