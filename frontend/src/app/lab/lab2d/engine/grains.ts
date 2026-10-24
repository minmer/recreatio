/**
 * LABOR 2D (v2) — KÖRNER (M3c, SANDBOX.md §8): Salzkristalle als
 * Kornteilchen. Jedes steht für N echte Körner des Durchmessers d (wie ein
 * Flüssigkeitsteilchen für viele Moleküle): Masse m, Ort, Geschwindigkeit,
 * Temperatur, der Stoff — und ob seine Körner noch trockene Spalten mit Luft
 * tragen (Keime für Blasen, wenn sie in überhitztes Wasser fallen).
 *
 * Der Durchmesser folgt aus Masse und Zahl: d = (6 m/(N π ρ_s))^⅓ — ein Korn,
 * das sich löst, wird kleiner, eines, an dem Salz auskristallisiert, grösser.
 * Feste Kapazität, in einem Stück gepackt (Entfernen holt das letzte an die
 * freie Stelle), wie die Flüssigkeitsteilchen.
 */

import { CP_CRYSTAL, RHO_CRYSTAL, SOLUTES } from './solution';
import { T0 } from './units';

export interface GrainMaterial {
  /** Kennung in Szenen (wie bei den gelösten Stoffen: „NaCl“). */
  readonly id: string;
  /** Dichte (kg/m³) und c_p (J/(kg·K)) des Kristalls. */
  readonly rho: number;
  readonly cp: number;
  readonly color: string;
  /** Löst er sich in Wasser (als gelöster Stoff NACL)? */
  readonly dissolves: boolean;
  /** Schüttwinkel (Grad) — der Reibungswinkel des Kornkontinuums (grainFlow.ts). */
  readonly repose: number;
}

/**
 * Kochsalz: Dichte und c_p des Steinsalzes (wie die Kruste, solution.ts); der
 * Schüttwinkel feinen Speisesalzes 34 ± 3° (Handbook of Pharmaceutical
 * Excipients: 38° für kubische Kristalle, Unterrichtsmaterial ~32°; die
 * Literatur hat keinen gemessenen Wert für 0,3–0,8 mm — documentation/lab2d/
 * SANDBOX.md, Quellen).
 */
export const GRAIN_MATS: readonly GrainMaterial[] = [
  { id: 'NaCl', rho: RHO_CRYSTAL, cp: CP_CRYSTAL, color: SOLUTES[0]?.color ?? '#f4f3ee', dissolves: true, repose: 34 }
];

/** Index eines Kornstoffs (−1: unbekannt). */
export function grainIndex(id: string): number {
  return GRAIN_MATS.findIndex((m) => m.id === id);
}

/** Packungsdichte einer lockeren Schüttung (Volumenanteil): Speisesalz 0,51–0,60 (Onoda & Liniger 1990 für Kugeln). */
export const PHI_MAX = 0.58;
/** Durchmesser der Körner, wenn eine Szene keinen nennt (m): feines Speisesalz. */
export const GRAIN_D = 5e-4;

export class Grains {
  readonly cap: number;
  count = 0;
  private nextId = 1;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  /** Masse des Kristalls (kg) — beim Anlegen (m0) und jetzt — und Zahl der echten Körner, für die das Teilchen steht. */
  readonly m: Float64Array;
  readonly m0: Float64Array;
  readonly N: Float64Array;
  /** Temperatur (K); die Enthalpie ist m c_p (T − 0 °C). */
  readonly T: Float64Array;
  readonly mat: Uint8Array;
  /** 1: die Körner tragen noch trockene Spalten (Keime für Blasen); beim ersten Benetzen 0. */
  readonly dry: Uint8Array;
  readonly id: Uint32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float64Array(cap);
    this.y = new Float64Array(cap);
    this.vx = new Float64Array(cap);
    this.vy = new Float64Array(cap);
    this.m = new Float64Array(cap);
    this.m0 = new Float64Array(cap);
    this.N = new Float64Array(cap);
    this.T = new Float64Array(cap);
    this.mat = new Uint8Array(cap);
    this.dry = new Uint8Array(cap);
    this.id = new Uint32Array(cap);
  }

  /** Ein Kornteilchen anlegen (−1, wenn voll). */
  add(x: number, y: number, m: number, N: number, T: number, mat: number): number {
    if (this.count >= this.cap) return -1;
    const p = this.count;
    this.count += 1;
    this.x[p] = x;
    this.y[p] = y;
    this.vx[p] = 0;
    this.vy[p] = 0;
    this.m[p] = m;
    this.m0[p] = m;
    this.N[p] = N;
    this.T[p] = T;
    this.mat[p] = mat;
    this.dry[p] = 1;
    this.id[p] = this.nextId;
    this.nextId = (this.nextId + 1) >>> 0 || 1;
    return p;
  }

  /** Entfernen: das letzte rückt an seine Stelle. */
  remove(p: number): void {
    const q = this.count - 1;
    if (p !== q) {
      this.x[p] = this.x[q];
      this.y[p] = this.y[q];
      this.vx[p] = this.vx[q];
      this.vy[p] = this.vy[q];
      this.m[p] = this.m[q];
      this.m0[p] = this.m0[q];
      this.N[p] = this.N[q];
      this.T[p] = this.T[q];
      this.mat[p] = this.mat[q];
      this.dry[p] = this.dry[q];
      this.id[p] = this.id[q];
    }
    this.count = q;
  }

  /** Dichte und c_p des Kristalls eines Teilchens. */
  rho(p: number): number { return GRAIN_MATS[this.mat[p]].rho; }
  cp(p: number): number { return GRAIN_MATS[this.mat[p]].cp; }

  /** Durchmesser seiner echten Körner (m). */
  diameter(p: number): number {
    return Math.cbrt((6 * this.m[p]) / (this.N[p] * Math.PI * this.rho(p)));
  }

  /** Enthalpie (J, 0 bei 0 °C wie die Feststoffe). */
  enthalpy(p: number): number {
    return this.m[p] * this.cp(p) * (this.T[p] - T0);
  }

  /** Salz in Körnern (kg) und ihre Enthalpie (J). */
  totals(): { salt: number; energy: number } {
    let s = 0;
    let H = 0;
    for (let p = 0; p < this.count; p += 1) {
      if (GRAIN_MATS[this.mat[p]].dissolves) s += this.m[p];
      H += this.enthalpy(p);
    }
    return { salt: s, energy: H };
  }

  clear(): void {
    this.count = 0;
  }
}
