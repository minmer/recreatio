/**
 * LABOR 2D (v2) — DER OBJEKTSPEICHER (ARCHITECTURE.md §3.3): in M1 nur Blasen.
 * Jede hat einen Ort in der Ebene, eine Tiefe z in der Schicht, eine
 * Geschwindigkeit, Massen je Gasart, eine Enthalpie, ein Alter und die
 * Kavität, an der sie hängt (−1: frei). Radius, Volumen, Innendruck und
 * Temperatur folgen aus dem Zustand (bubbleState.ts) und stehen hier nur im
 * Zwischenspeicher. Feste Kapazität, gepackt wie die Teilchen; die starren
 * Körper aus M3 bekommen denselben Speicher.
 */

import { SPECIES_SLOTS } from './units';

/** Kräfte für die Ansicht einer Blase: Auftrieb (−V∇p), Gewicht, Widerstand, virtuelle Masse — je x und y. */
export const FORCE_SLOTS = 8;

export class Bubbles {
  readonly cap: number;
  count = 0;
  private nextId = 1;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** Massen je Gasart (kg): [b·SPECIES_SLOTS + k]. */
  readonly m: Float64Array;
  /** Enthalpie des Inhalts (J). */
  readonly H: Float64Array;
  readonly age: Float32Array;
  readonly site: Int32Array;
  /* Abgeleitet (Zwischenspeicher). */
  readonly r: Float32Array;
  readonly V: Float64Array;
  readonly pb: Float32Array;
  readonly pv: Float32Array;
  readonly Tb: Float32Array;
  /** Wachstum dm_v/dt (kg/s) im letzten Schritt. */
  readonly dmdt: Float32Array;
  readonly force: Float32Array;
  readonly id: Uint32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.z = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.m = new Float64Array(cap * SPECIES_SLOTS);
    this.H = new Float64Array(cap);
    this.age = new Float32Array(cap);
    this.site = new Int32Array(cap);
    this.r = new Float32Array(cap);
    this.V = new Float64Array(cap);
    this.pb = new Float32Array(cap);
    this.pv = new Float32Array(cap);
    this.Tb = new Float32Array(cap);
    this.dmdt = new Float32Array(cap);
    this.force = new Float32Array(cap * FORCE_SLOTS);
    this.id = new Uint32Array(cap);
  }

  /** Eine leere Blase anlegen (−1, wenn voll); Massen und Enthalpie setzt der Aufrufer. */
  add(x: number, y: number, z: number): number {
    if (this.count >= this.cap) return -1;
    const b = this.count;
    this.count += 1;
    this.x[b] = x;
    this.y[b] = y;
    this.z[b] = z;
    this.vx[b] = 0;
    this.vy[b] = 0;
    for (let k = 0; k < SPECIES_SLOTS; k += 1) this.m[b * SPECIES_SLOTS + k] = 0;
    this.H[b] = 0;
    this.age[b] = 0;
    this.site[b] = -1;
    this.r[b] = 0;
    this.V[b] = 0;
    this.pb[b] = 0;
    this.pv[b] = 0;
    this.Tb[b] = 0;
    this.dmdt[b] = 0;
    for (let k = 0; k < FORCE_SLOTS; k += 1) this.force[b * FORCE_SLOTS + k] = 0;
    this.id[b] = this.nextId;
    this.nextId = (this.nextId + 1) >>> 0 || 1;
    return b;
  }

  /** Gesamtmasse einer Blase (kg). */
  totalMass(b: number): number {
    let s = 0;
    for (let k = 0; k < SPECIES_SLOTS; k += 1) s += this.m[b * SPECIES_SLOTS + k];
    return s;
  }

  remove(b: number): void {
    const q = this.count - 1;
    if (b !== q) {
      this.x[b] = this.x[q];
      this.y[b] = this.y[q];
      this.z[b] = this.z[q];
      this.vx[b] = this.vx[q];
      this.vy[b] = this.vy[q];
      for (let k = 0; k < SPECIES_SLOTS; k += 1) this.m[b * SPECIES_SLOTS + k] = this.m[q * SPECIES_SLOTS + k];
      this.H[b] = this.H[q];
      this.age[b] = this.age[q];
      this.site[b] = this.site[q];
      this.r[b] = this.r[q];
      this.V[b] = this.V[q];
      this.pb[b] = this.pb[q];
      this.pv[b] = this.pv[q];
      this.Tb[b] = this.Tb[q];
      this.dmdt[b] = this.dmdt[q];
      for (let k = 0; k < FORCE_SLOTS; k += 1) this.force[b * FORCE_SLOTS + k] = this.force[q * FORCE_SLOTS + k];
      this.id[b] = this.id[q];
    }
    this.count = q;
  }

  find(id: number): number {
    for (let b = 0; b < this.count; b += 1) if (this.id[b] === id) return b;
    return -1;
  }

  clear(): void {
    this.count = 0;
  }
}
