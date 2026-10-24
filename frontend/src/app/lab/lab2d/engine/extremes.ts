/**
 * LABOR 2D (v2) — HEFTIGE ZUSTÄNDE (seit 2026-10-24). Wasser auf einer sehr
 * heissen Platte, Siedeverzug ohne Siedesteinchen, viele Blasen, die zu einer
 * riesigen verschmelzen: dann drückte der Dampf oft das ganze Wasser aus der
 * Kiste. Die Szene sagt, wie solche Zustände gerechnet werden (scene.extremes):
 *
 * - **Immer** — auch beim Rechnen ohne Milderung — nimmt eine Blase an einer
 *   Wand höchstens so viel Wärme, wie die Siedekurve dort durchlässt: die
 *   kritische Wärmestromdichte (Lienhard & Dhir 1973,
 *   q″ = 0,149 ρ_v^½ h_lv [σ g (ρ_l − ρ_v)]^¼, bei 1 atm 1,26 MW/m²) auf der
 *   benetzten Fläche der Wandzelle. Vorher bekam sie die ganze gespeicherte
 *   Überhitzung der Wand in einem Schritt: Wasser auf Stahl von 140 °C gab
 *   8,6 cm³ Dampf in 27 ms, nach zehn Schritten liefen die Teilchen mit
 *   3000 m/s und alles wurde NaN. Dazu eine Rechenwache: schneller als 20 m/s
 *   wird kein Teilchen (Wasser in einer Laborkiste erreicht wenige m/s).
 * - **„compute“** (so rechnen): sonst nichts — heftiges Sieden bleibt heftig.
 * - **„normalize“** (mildern): die Wand gibt Blasen höchstens ein Zehntel der
 *   kritischen Wärmestromdichte; jede Kavität keimt spätestens bei 2 K
 *   Überhitzung (kein Siedeverzug); was eine Blase über 4 mm Radius hinaus hat,
 *   geht ins Gas über der Oberfläche (als platzte sie dort); Wasser wird auf
 *   1,5 m/s gebremst. Masse und Energie bleiben genau.
 * - **„ask“** (fragen, die Vorgabe): gerechnet wie „compute“; wächst eine Blase
 *   über 6 mm Radius oder läuft Wasser schneller als 2 m/s, steht ein Ereignis
 *   an — die Oberfläche hält an und fragt, wie es weitergehen soll.
 *
 * Die kinetische Energie der Flüssigkeit steht nicht in der Energiebilanz (sie
 * zählt Enthalpien): Bremsen ändert die Bilanz nicht.
 */

import type { Engine } from './engine';
import { rhoVapourSatFast, tSat } from './if97';
import { hLV, rhoL, sigma } from './materials';
import type { ExtremeMode } from './scene';

/** Die Rechenwache (m/s): so schnell wird kein Teilchen, in keiner Art. */
const V_GUARD = 20;
/** Mildern: Anteil der kritischen Wärmestromdichte, Keimen spätestens bei ΔT (K), grösster Blasenradius (m), Wasser höchstens (m/s). */
const NORM_FLUX = 0.1;
const NORM_DT = 2;
const NORM_R = 0.004;
const NORM_V = 1.5;
/** Fragen: ab diesem Blasenradius (m) oder dieser Geschwindigkeit (m/s). */
const ASK_R = 0.006;
const ASK_V = 2;
/* (ASK_LIMITS unten nennt dieselben Zahlen für den beschleunigten Weg.) */

/** Ein heftiger Zustand, auf den die Oberfläche antworten soll. */
export interface ExtremeEvent {
  readonly kind: 'bubble' | 'speed';
  /** Radius der grössten Blase (m) oder Geschwindigkeit des schnellsten Teilchens (m/s). */
  readonly value: number;
  readonly time: number;
}

/** Was die Kennzahlen davon zeigen. */
export interface ExtremeStats {
  readonly mode: ExtremeMode;
  readonly pending: ExtremeEvent | null;
  readonly maxBubble: number;
  readonly maxSpeed: number;
  /** Seit dem Start: Wärme, die die Wände den Blasen nicht gaben (J), abgelassener Dampf (kg), gebremste Teilchen (Anzahl je Schritt, summiert). */
  readonly heldHeat: number;
  readonly vented: number;
  readonly slowed: number;
}

/** Ab welchem Blasenradius (m) und welcher Geschwindigkeit (m/s) „ask“ fragt — auch der beschleunigte Weg. */
export const ASK_LIMITS = { r: ASK_R, v: ASK_V } as const;

/**
 * Was die Kerne des beschleunigten Wegs (gpu/) von der Art der Rechnung brauchen: die Wärmestromdichte der Wände an
 * Blasen (W/m²), die höchste Überhitzung zum Keimen (K), die höchste Geschwindigkeit der Teilchen (m/s), der grösste
 * Blasenradius (m) — dieselben Zahlen wie hier auf der CPU.
 */
export function extremeParams(mode: ExtremeMode, p: number, g: number): { chf: number; actMax: number; vmax: number; bubCap: number } {
  const soft = mode === 'normalize';
  return { chf: criticalHeatFlux(p, g) * (soft ? NORM_FLUX : 1), actMax: soft ? NORM_DT : 1e30, vmax: soft ? NORM_V : V_GUARD, bubCap: soft ? NORM_R : 1e30 };
}

/** Kritische Wärmestromdichte (W/m²) beim Druck p (Pa) und der Schwerkraft g (m/s²) — Lienhard & Dhir (1973). */
export function criticalHeatFlux(p: number, g: number): number {
  const Ts = tSat(p);
  const rv = rhoVapourSatFast(Ts);
  const rl = rhoL(Ts);
  return 0.149 * Math.sqrt(rv) * hLV(Ts) * Math.pow(Math.max(0, sigma(Ts) * g * (rl - rv)), 0.25);
}

export class Extremes {
  /** Ein Ereignis, auf das die Oberfläche antworten soll (nur „ask“); einmal je Szene. */
  pending: ExtremeEvent | null = null;
  private asked = false;
  heldHeat = 0;
  vented = 0;
  slowed = 0;
  maxBubble = 0;
  maxSpeed = 0;
  /** Je Wandzelle: was sie in diesem Schritt noch an Blasen geben darf (J; < 0: noch nicht berechnet). */
  private wall = new Float64Array(0);
  private flux = 0;

  constructor(private readonly e: Engine) {}

  get mode(): ExtremeMode { return this.e.scene.extremes; }
  get normalize(): boolean { return this.e.scene.extremes === 'normalize'; }
  /** Grösster Blasenradius beim Mildern (m; ∞ sonst). */
  get bubbleCap(): number { return this.normalize ? NORM_R : Infinity; }

  /** Zu Beginn der Blasenstufe: die Wärme der Wände für diesen Schritt neu, die kritische Wärmestromdichte beim Umgebungsdruck. */
  beginStep(): void {
    const n = this.e.grid.n;
    if (this.wall.length !== n) this.wall = new Float64Array(n);
    this.wall.fill(-1);
    this.flux = criticalHeatFlux(this.e.regions.pAmb, Math.abs(this.e.gy)) * (this.normalize ? NORM_FLUX : 1);
  }

  /** Was die Wandzelle sc in diesem Schritt noch an Blasen geben darf (J): die Wärmestromdichte auf einer Zellseite. */
  wallLeft(sc: number, dt: number): number {
    if (this.wall[sc] < 0) { const g = this.e.grid; this.wall[sc] = this.flux * g.dx * g.depth * dt; }
    return this.wall[sc];
  }

  /** Eine Blase nahm Q (J) von der Wandzelle sc; `wanted` hätte sie ohne Grenze genommen. */
  takeWall(sc: number, Q: number, wanted: number): void {
    if (Q > 0) this.wall[sc] = Math.max(0, this.wall[sc] - Q);
    if (wanted > Q) this.heldHeat += wanted - Q;
  }

  /** Die Überhitzung, bei der eine Kavität keimt (K): beim Mildern höchstens NORM_DT. */
  activation(dT: number): number {
    return this.normalize ? Math.min(dT, NORM_DT) : dT;
  }

  /** Nach dem Schritt: Teilchen bremsen (Rechenwache, beim Mildern stärker), grösste Blase und schnellstes Teilchen, Ereignis beim Fragen. */
  afterStep(): void {
    const P = this.e.particles;
    const B = this.e.bubbles;
    const vmax = this.normalize ? NORM_V : V_GUARD;
    let fastest = 0;
    for (let p = 0; p < P.count; p += 1) {
      const v = Math.hypot(P.vx[p], P.vy[p]);
      if (v > vmax) {
        const f = vmax / v;
        P.vx[p] *= f;
        P.vy[p] *= f;
        this.slowed += 1;
        fastest = Math.max(fastest, vmax);
      } else if (v > fastest) fastest = v;
    }
    let big = 0;
    for (let b = 0; b < B.count; b += 1) if (B.r[b] > big) big = B.r[b];
    this.maxSpeed = fastest;
    this.maxBubble = big;
    if (this.mode !== 'ask' || this.asked) return;
    if (big > ASK_R) { this.pending = { kind: 'bubble', value: big, time: this.e.time }; this.asked = true; }
    else if (fastest > ASK_V) { this.pending = { kind: 'speed', value: fastest, time: this.e.time }; this.asked = true; }
  }

  /** Der beschleunigte Weg meldet aus seiner Ablesung die grösste Blase und das schnellste Teilchen: dieselbe Frage wie afterStep. */
  observe(big: number, fastest: number, time: number): void {
    this.maxBubble = big;
    this.maxSpeed = fastest;
    if (this.mode !== 'ask' || this.asked) return;
    if (big > ASK_R) { this.pending = { kind: 'bubble', value: big, time }; this.asked = true; }
    else if (fastest > ASK_V) { this.pending = { kind: 'speed', value: fastest, time }; this.asked = true; }
  }

  /** Das anstehende Ereignis abholen (der Arbeiter hält an und fragt); danach steht keins mehr an — gefragt wird einmal je Szene. */
  take(): ExtremeEvent | null {
    const ev = this.pending;
    this.pending = null;
    return ev;
  }

  /** Neue Szene: noch nicht gefragt, nichts gemildert. */
  reset(): void {
    this.pending = null;
    this.asked = false;
    this.heldHeat = 0;
    this.vented = 0;
    this.slowed = 0;
    this.maxBubble = 0;
    this.maxSpeed = 0;
  }

  stats(): ExtremeStats {
    return { mode: this.mode, pending: this.pending, maxBubble: this.maxBubble, maxSpeed: this.maxSpeed, heldHeat: this.heldHeat, vented: this.vented, slowed: this.slowed };
  }
}
