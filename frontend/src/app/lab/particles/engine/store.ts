/**
 * PARTIKEL-LABOR — DER SPEICHER DER PARTIKELN: ein Feld je Grösse
 * (structure of arrays), feste Kapazität, ein Stapel freier Plätze — Erzeugen
 * und Löschen kosten O(1) und legen nie Speicher an. Ein Platz behält seinen
 * Index, solange die Partikel lebt (der Inspektor hält Index und `uid`).
 *
 * Wasser, Luft, Dampf, Glas und die Heizplatte sind dieselbe Art Partikel mit
 * anderen Daten: Zusammensetzung (K Plätze Stoff + Masse), Phase, Enthalpie,
 * und ob sie fest steht. Ein Phasenwechsel ändert Felder, nie den Typ.
 */

import { GAS, type PhaseId } from './units';

/** Stoffplätze je Partikel (M1: H₂O, N₂, O₂ — die Chemie arbeitet später darauf). */
export const SLOTS = 4;

export class Store {
  readonly cap: number;
  /** Lebende Partikeln. */
  count = 0;
  /** Eins über dem höchsten jemals belegten Platz (Schleifen über alle Plätze enden hier). */
  highWater = 0;

  /* Ort und Bewegung (m, m/s). */
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly ox: Float64Array;
  readonly oy: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;

  /* Art. */
  readonly phase: Uint8Array;
  readonly fixed: Uint8Array;
  readonly alive: Uint8Array;
  readonly role: Uint8Array;
  readonly group: Uint16Array;
  readonly uid: Uint32Array;

  /* Stoff: K Plätze (Stoffindex + 1, 0 = leer) mit ihrer Masse in kg. */
  readonly spc: Uint16Array;
  readonly smass: Float64Array;
  /** Stoffmasse in kg — echt, erhalten, für Wärme und Chemie. */
  readonly mass: Float64Array;
  /** Spezifische Enthalpie in J/kg — Temperatur und Phasenfortschritt folgen aus ihr. */
  readonly H: Float64Array;

  /* Abgeleitet je Schritt. */
  readonly T: Float64Array;
  readonly rho: Float64Array;
  readonly p: Float64Array;
  readonly nbr: Uint16Array;

  /* Löser. */
  readonly area: Float64Array;
  readonly wInv: Float64Array;
  readonly lambda: Float64Array;

  /* Vorbehalten für spätere Meilensteine. */
  readonly site: Float32Array;
  readonly budget: Float32Array;
  readonly acc: Float64Array;
  readonly accH: Float64Array;
  readonly bond: Int32Array;

  private readonly free: Int32Array;
  private freeTop: number;
  private nextUid = 1;

  constructor(cap: number) {
    this.cap = cap;
    const f64 = () => new Float64Array(cap);
    this.x = f64(); this.y = f64(); this.px = f64(); this.py = f64(); this.ox = f64(); this.oy = f64(); this.vx = f64(); this.vy = f64();
    this.phase = new Uint8Array(cap); this.fixed = new Uint8Array(cap); this.alive = new Uint8Array(cap); this.role = new Uint8Array(cap);
    this.group = new Uint16Array(cap); this.uid = new Uint32Array(cap);
    this.spc = new Uint16Array(cap * SLOTS); this.smass = new Float64Array(cap * SLOTS);
    this.mass = f64(); this.H = f64(); this.T = f64(); this.rho = f64(); this.p = f64(); this.nbr = new Uint16Array(cap);
    this.area = f64(); this.wInv = f64(); this.lambda = f64();
    this.site = new Float32Array(cap); this.budget = new Float32Array(cap); this.acc = f64(); this.accH = f64(); this.bond = new Int32Array(cap);
    this.free = new Int32Array(cap);
    for (let k = 0; k < cap; k += 1) this.free[k] = cap - 1 - k;
    this.freeTop = cap;
  }

  /** Ein freier Platz, auf null gesetzt (−1: voll). */
  spawn(): number {
    if (this.freeTop === 0) return -1;
    const i = this.free[--this.freeTop];
    this.clear(i);
    this.alive[i] = 1;
    this.uid[i] = this.nextUid++;
    this.count += 1;
    if (i >= this.highWater) this.highWater = i + 1;
    return i;
  }

  kill(i: number): void {
    if (this.alive[i] === 0) return;
    this.alive[i] = 0;
    this.free[this.freeTop++] = i;
    this.count -= 1;
    while (this.highWater > 0 && this.alive[this.highWater - 1] === 0) this.highWater -= 1;
  }

  /** Alle Plätze frei (eine neue Szene). */
  reset(): void {
    this.alive.fill(0);
    for (let k = 0; k < this.cap; k += 1) this.free[k] = this.cap - 1 - k;
    this.freeTop = this.cap;
    this.count = 0;
    this.highWater = 0;
  }

  private clear(i: number): void {
    this.x[i] = 0; this.y[i] = 0; this.px[i] = 0; this.py[i] = 0; this.ox[i] = 0; this.oy[i] = 0; this.vx[i] = 0; this.vy[i] = 0;
    this.phase[i] = GAS; this.fixed[i] = 0; this.role[i] = 0; this.group[i] = 0;
    for (let k = 0; k < SLOTS; k += 1) { this.spc[i * SLOTS + k] = 0; this.smass[i * SLOTS + k] = 0; }
    this.mass[i] = 0; this.H[i] = 0; this.T[i] = 0; this.rho[i] = 0; this.p[i] = 0; this.nbr[i] = 0;
    this.area[i] = 0; this.wInv[i] = 0; this.lambda[i] = 0;
    this.site[i] = 0; this.budget[i] = 0; this.acc[i] = 0; this.accH[i] = 0; this.bond[i] = -1;
  }

  /** Masse eines Stoffes in eine Partikel legen (in seinen Platz oder einen leeren). `false`: kein Platz frei. */
  addSpecies(i: number, sp: number, kg: number): boolean {
    const o = i * SLOTS;
    let empty = -1;
    for (let k = 0; k < SLOTS; k += 1) {
      const s = this.spc[o + k];
      if (s === sp + 1) { this.smass[o + k] += kg; this.mass[i] += kg; return true; }
      if (s === 0 && empty < 0) empty = k;
    }
    if (empty < 0) return false;
    this.spc[o + empty] = sp + 1;
    this.smass[o + empty] = kg;
    this.mass[i] += kg;
    return true;
  }

  /** Der Stoff mit der grössten Masse (−1: leer). */
  dominant(i: number): number {
    const o = i * SLOTS;
    let best = -1;
    let m = -1;
    for (let k = 0; k < SLOTS; k += 1) {
      const s = this.spc[o + k];
      if (s !== 0 && this.smass[o + k] > m) { m = this.smass[o + k]; best = s - 1; }
    }
    return best;
  }

  /** Die Masse eines Stoffes in einer Partikel (kg). */
  massOf(i: number, sp: number): number {
    const o = i * SLOTS;
    for (let k = 0; k < SLOTS; k += 1) if (this.spc[o + k] === sp + 1) return this.smass[o + k];
    return 0;
  }

  setPhase(i: number, phase: PhaseId): void {
    this.phase[i] = phase;
  }
}
