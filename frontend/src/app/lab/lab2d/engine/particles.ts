/**
 * LABOR 2D (v2) — DIE FLÜSSIGKEITSTEILCHEN (ARCHITECTURE.md §3.2): etwa vier
 * je Flüssigkeitszelle, jedes mit Ort, Geschwindigkeit, affiner APIC-Matrix C,
 * Masse, spezifischer Enthalpie (die Temperatur folgt aus ihr), zwei Plätzen
 * für gelöste Stoffe (M2) und dem Stoff.
 *
 * Feste Kapazität, in einem Stück gepackt: Entfernen holt das letzte Teilchen
 * an die freie Stelle (eine Freiliste der Länge eins) — die Schleifen laufen
 * ohne Lücken. Eine eigene Nummer (`id`) wandert mit, damit der Inspektor ein
 * Teilchen über Bilder hinweg verfolgen kann.
 */

import { rhoL, tFromHL } from './materials';

export class Particles {
  readonly cap: number;
  count = 0;
  private nextId = 1;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly c00: Float32Array;
  readonly c01: Float32Array;
  readonly c10: Float32Array;
  readonly c11: Float32Array;
  readonly mass: Float64Array;
  /** Spezifische Enthalpie (J/kg) — der Zustand; T ist abgeleitet. */
  readonly h: Float64Array;
  readonly T: Float32Array;
  /** ρ(T) im Zwischenspeicher (kg/m³). */
  readonly rho: Float32Array;
  /** Zwei Plätze für gelöste Stoffe (M2): Art (0 = leer) und Masse. */
  readonly spc: Uint8Array;
  readonly smass: Float64Array;
  readonly mat: Uint8Array;
  readonly id: Uint32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.c00 = new Float32Array(cap);
    this.c01 = new Float32Array(cap);
    this.c10 = new Float32Array(cap);
    this.c11 = new Float32Array(cap);
    this.mass = new Float64Array(cap);
    this.h = new Float64Array(cap);
    this.T = new Float32Array(cap);
    this.rho = new Float32Array(cap);
    this.spc = new Uint8Array(2 * cap);
    this.smass = new Float64Array(2 * cap);
    this.mat = new Uint8Array(cap);
    this.id = new Uint32Array(cap);
  }

  /** Ein Teilchen anlegen (−1, wenn voll). */
  add(x: number, y: number, mass: number, h: number, mat: number): number {
    if (this.count >= this.cap) return -1;
    const p = this.count;
    this.count += 1;
    this.x[p] = x;
    this.y[p] = y;
    this.vx[p] = 0;
    this.vy[p] = 0;
    this.c00[p] = 0;
    this.c01[p] = 0;
    this.c10[p] = 0;
    this.c11[p] = 0;
    this.mass[p] = mass;
    this.h[p] = h;
    this.mat[p] = mat;
    this.spc[2 * p] = 0;
    this.spc[2 * p + 1] = 0;
    this.smass[2 * p] = 0;
    this.smass[2 * p + 1] = 0;
    this.id[p] = this.nextId;
    this.nextId = (this.nextId + 1) >>> 0 || 1;
    this.derive(p);
    return p;
  }

  /** Temperatur und Dichte aus der Enthalpie. */
  derive(p: number): void {
    const T = tFromHL(this.h[p]);
    this.T[p] = T;
    this.rho[p] = rhoL(T);
  }

  /** Entfernen: das letzte Teilchen rückt an seine Stelle. */
  remove(p: number): void {
    const q = this.count - 1;
    if (p !== q) {
      this.x[p] = this.x[q];
      this.y[p] = this.y[q];
      this.vx[p] = this.vx[q];
      this.vy[p] = this.vy[q];
      this.c00[p] = this.c00[q];
      this.c01[p] = this.c01[q];
      this.c10[p] = this.c10[q];
      this.c11[p] = this.c11[q];
      this.mass[p] = this.mass[q];
      this.h[p] = this.h[q];
      this.T[p] = this.T[q];
      this.rho[p] = this.rho[q];
      this.spc[2 * p] = this.spc[2 * q];
      this.spc[2 * p + 1] = this.spc[2 * q + 1];
      this.smass[2 * p] = this.smass[2 * q];
      this.smass[2 * p + 1] = this.smass[2 * q + 1];
      this.mat[p] = this.mat[q];
      this.id[p] = this.id[q];
    }
    this.count = q;
  }

  /** Das Teilchen mit dieser Nummer (−1: nicht mehr da). */
  find(id: number): number {
    for (let p = 0; p < this.count; p += 1) if (this.id[p] === id) return p;
    return -1;
  }

  clear(): void {
    this.count = 0;
  }
}
