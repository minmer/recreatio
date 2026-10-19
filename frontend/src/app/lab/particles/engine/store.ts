/**
 * PARTIKEL-LABOR — DER SPEICHER DER PARTIKELN: ein Feld je Grösse
 * (structure of arrays), feste Kapazität, ein Stapel freier Plätze — Erzeugen
 * und Löschen kosten O(1) und legen nie Speicher an. Ein Platz behält seinen
 * Index, solange die Partikel lebt (der Inspektor hält Index und `uid`).
 *
 * Wasser, Luft, Dampf, Glas und die Heizplatte sind dieselbe Art Partikel mit
 * anderen Daten: Zusammensetzung (K Plätze Stoff + Masse), Phase, Enthalpie,
 * und ob sie fest steht. Ein Phasenwechsel ändert Felder, nie den Typ.
 *
 * Die Felder liegen in einem `Mem` — gemeinsam mit den Helfern, wenn welche
 * mitrechnen. Erzeugen und Löschen tut nur der Rechner der Engine.
 */

import type { Mem } from './mem';
import { GAS, type PhaseId } from './units';

/** Stoffplätze je Partikel (M1: H₂O, N₂, O₂ — die Chemie arbeitet später darauf). */
export const SLOTS = 4;

/** Woher eine Partikel kommt: Wand der Kiste, ein Handgriff (gemalt, gestellt), Luft des Saums (von selbst). */
export const ORIGIN_WALL = 0;
export const ORIGIN_OP = 1;
export const ORIGIN_AIR = 2;

/** Kein Stoff (in `dom`). */
export const NO_SPECIES = 255;

export class Store {
  readonly cap: number;
  /** Lebende Partikeln. */
  count = 0;
  /** Eins über dem höchsten jemals belegten Platz (Schleifen über alle Plätze enden hier). */
  highWater = 0;

  /* Ort und Bewegung (m, m/s). `px, py` und `qx, qy`: die beiden Puffer der vorhergesagten Orte (der Löser rechnet von einem in den anderen). */
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly qx: Float64Array;
  readonly qy: Float64Array;
  readonly ox: Float64Array;
  readonly oy: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;

  /* Art. */
  readonly phase: Uint8Array;
  readonly fixed: Uint8Array;
  readonly alive: Uint8Array;
  readonly role: Uint8Array;
  readonly origin: Uint8Array;
  readonly group: Uint16Array;
  readonly uid: Uint32Array;

  /* Stoff: K Plätze (Stoffindex + 1, 0 = leer) mit ihrer Masse in kg; `dom` der Stoff mit der grössten Masse. */
  readonly spc: Uint16Array;
  readonly smass: Float64Array;
  readonly dom: Uint8Array;
  /** Stoffmasse in kg — echt, erhalten, für Wärme und Chemie. */
  readonly mass: Float64Array;
  /** Spezifische Enthalpie in J/kg — Temperatur und Phasenfortschritt folgen aus ihr. */
  readonly H: Float64Array;

  /* Abgeleitet je Schritt. */
  readonly T: Float64Array;
  readonly rho: Float64Array;
  readonly p: Float64Array;
  readonly nbr: Uint16Array;

  /* Löser: Ruhefläche (feste: ihr Anteil an der Dichte der Nachbarn), inverse Lösermasse, PBF-Multiplikator und seine Summe im Teilschritt. */
  readonly area: Float64Array;
  readonly wInv: Float64Array;
  readonly lambda: Float64Array;
  readonly lamSum: Float64Array;
  /** Die Dichte im Löser relativ zur Ruhe (A_i·Σ W, 1 = in Ruhe) aus der letzten Iteration. */
  readonly dens: Float64Array;
  /** Der Überdruck des Lösers (Pa, ungeglättet): Startwert des nächsten Schritts (warm start) und Grundlage von `p`. */
  readonly pres: Float64Array;
  /** Geschwindigkeitsänderung aus Viskosität, Kohäsion, Adhäsion (zwischen zwei Phasen des Schritts). */
  readonly dvx: Float64Array;
  readonly dvy: Float64Array;
  /** Σ ∇W über die ruhende Umgebungsluft der Nachbarzellen (für die Korrektur am Rand des Saums). */
  readonly vgx: Float64Array;
  readonly vgy: Float64Array;
  /** Σ W über dieselben Plätze (die Glättung zieht zur Ruhe der Umgebungsluft hin). */
  readonly vgw: Float64Array;
  /** 1: eine der 3×3 Zellen um die Partikel ist Umgebungsluft ohne Partikeln (ihre Plätze zählen mit). */
  readonly edge: Uint8Array;

  /* Vorbehalten für spätere Meilensteine. */
  readonly site: Float64Array;
  readonly budget: Float64Array;
  readonly acc: Float64Array;
  readonly accH: Float64Array;
  readonly bond: Int32Array;

  private readonly free: Int32Array;
  private freeTop: number;
  private nextUid = 1;

  constructor(cap: number, mem: Mem) {
    this.cap = cap;
    const f64 = (name: string) => mem.f64(name, cap);
    this.x = f64('x'); this.y = f64('y'); this.px = f64('px'); this.py = f64('py'); this.qx = f64('qx'); this.qy = f64('qy');
    this.ox = f64('ox'); this.oy = f64('oy'); this.vx = f64('vx'); this.vy = f64('vy');
    this.phase = mem.u8('phase', cap); this.fixed = mem.u8('fixed', cap); this.alive = mem.u8('alive', cap); this.role = mem.u8('role', cap);
    this.origin = mem.u8('origin', cap); this.group = mem.u16('group', cap); this.uid = mem.u32('uid', cap);
    this.spc = mem.u16('spc', cap * SLOTS); this.smass = mem.f64('smass', cap * SLOTS); this.dom = mem.u8('dom', cap);
    this.mass = f64('mass'); this.H = f64('H'); this.T = f64('T'); this.rho = f64('rho'); this.p = f64('p'); this.nbr = mem.u16('nbr', cap);
    this.area = f64('area'); this.wInv = f64('wInv'); this.lambda = f64('lambda'); this.lamSum = f64('lamSum'); this.dens = f64('dens'); this.pres = f64('pres');
    this.dvx = f64('dvx'); this.dvy = f64('dvy'); this.vgx = f64('vgx'); this.vgy = f64('vgy'); this.vgw = f64('vgw'); this.edge = mem.u8('edge', cap);
    this.site = f64('site'); this.budget = f64('budget'); this.acc = f64('acc'); this.accH = f64('accH'); this.bond = mem.i32('bond', cap);
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
    this.x[i] = 0; this.y[i] = 0; this.px[i] = 0; this.py[i] = 0; this.qx[i] = 0; this.qy[i] = 0;
    this.ox[i] = 0; this.oy[i] = 0; this.vx[i] = 0; this.vy[i] = 0;
    this.phase[i] = GAS; this.fixed[i] = 0; this.role[i] = 0; this.origin[i] = 0; this.group[i] = 0;
    for (let k = 0; k < SLOTS; k += 1) { this.spc[i * SLOTS + k] = 0; this.smass[i * SLOTS + k] = 0; }
    this.dom[i] = NO_SPECIES;
    this.mass[i] = 0; this.H[i] = 0; this.T[i] = 0; this.rho[i] = 0; this.p[i] = 0; this.nbr[i] = 0;
    this.area[i] = 0; this.wInv[i] = 0; this.lambda[i] = 0; this.lamSum[i] = 0; this.dens[i] = 1; this.pres[i] = 0;
    this.dvx[i] = 0; this.dvy[i] = 0; this.vgx[i] = 0; this.vgy[i] = 0; this.vgw[i] = 0; this.edge[i] = 0;
    this.site[i] = 0; this.budget[i] = 0; this.acc[i] = 0; this.accH[i] = 0; this.bond[i] = -1;
  }

  /** Masse eines Stoffes in eine Partikel legen (in seinen Platz oder einen leeren). `false`: kein Platz frei. */
  addSpecies(i: number, sp: number, kg: number): boolean {
    const o = i * SLOTS;
    let empty = -1;
    for (let k = 0; k < SLOTS; k += 1) {
      const s = this.spc[o + k];
      if (s === sp + 1) { this.smass[o + k] += kg; this.mass[i] += kg; this.dom[i] = this.domOf(i); return true; }
      if (s === 0 && empty < 0) empty = k;
    }
    if (empty < 0) return false;
    this.spc[o + empty] = sp + 1;
    this.smass[o + empty] = kg;
    this.mass[i] += kg;
    this.dom[i] = this.domOf(i);
    return true;
  }

  private domOf(i: number): number {
    const d = this.dominant(i);
    return d < 0 ? NO_SPECIES : d;
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
