/**
 * PARTIKEL-LABOR — WER DIE KERNE RECHNET: ein Faden allein (`SerialRunner`)
 * oder der Rechner der Engine mit Helfern (`SharedRunner`), die über
 * gemeinsamen Speicher je ein Stück jeder Aufgabe nehmen. Weil jeder Kern
 * nur die eigenen Partikeln schreibt (Jacobi, `solver.ts`), ist das Ergebnis
 * dasselbe — bitgenau, gleich wie viele Fäden und in welcher Reihenfolge.
 *
 * Abstimmung über ein Int32Array (`ctrl`): der Rechner erhöht die Generation,
 * die Helfer rechnen ihr Stück und zählen `DONE` hoch; zwischen den Aufgaben
 * eines Schritts warten sie aktiv (kurz), dann schlafen sie (`Atomics.wait`).
 * Neue Felder (eine neue Szene) gehen als Nachricht an die Helfer: `C_VERSION`
 * sagt, welche Fassung gilt — ein Helfer mit einer älteren kehrt in seine
 * Schleife der Nachrichten zurück und holt sie. Bis alle sie bestätigt haben,
 * rechnet der Rechner allein.
 */

import type { Block } from './mem';
import { jobLength, runJob, type Views } from './solver';

export interface Runner {
  /** Fäden, die rechnen (1: allein). */
  readonly threads: number;
  /** Neue Felder (nach dem Laden einer Szene). */
  bind(V: Views, P: Float64Array, blocks: readonly Block[]): void;
  run(job: number): void;
  dispose(): void;
}

/** Ein Faden. Mit `parts` > 1 rechnet er die Aufgaben in Stücken (rückwärts mit `reverse`) — für die Prüfung, dass Stücke nichts ändern. */
export class SerialRunner implements Runner {
  readonly threads = 1;
  private V: Views | null = null;
  private P: Float64Array | null = null;

  constructor(private readonly parts = 1, private readonly reverse = false) {}

  bind(V: Views, P: Float64Array): void {
    this.V = V;
    this.P = P;
  }

  run(job: number): void {
    const V = this.V;
    const P = this.P;
    if (V === null || P === null) return;
    const n = jobLength(job, P);
    if (this.parts <= 1) { runJob(job, V, P, 0, n); return; }
    for (let q = 0; q < this.parts; q += 1) {
      const t = this.reverse ? this.parts - 1 - q : q;
      runJob(job, V, P, Math.floor((n * t) / this.parts), Math.floor((n * (t + 1)) / this.parts));
    }
  }

  dispose(): void {
    this.V = null;
    this.P = null;
  }
}

/* -- Abstimmung mit den Helfern ------------------------------------------------------------------------------ */

export const C_GEN = 0;
export const C_JOB = 1;
export const C_DONE = 2;
export const C_VERSION = 3;
export const C_QUIT = 4;
/** Ab hier je Helfer die Fassung der Felder, die er hat. */
export const C_ACK = 8;
export const CTRL = 64;

/** Aktives Warten, bevor ein Faden schläft (Schleifendurchläufe; etwa eine halbe Millisekunde — länger als das Einordnen zwischen zwei Aufgaben, kürzer als die Pause zwischen zwei Schritten). */
export const SPIN = 300000;

/** Kleine Aufgaben rechnet der Rechner allein (Aufwecken kostet mehr). */
const MIN_PARALLEL = 768;

/** Was ein Helfer bekommt. */
export type HelperMessage =
  | { readonly type: 'init'; readonly ctrl: SharedArrayBuffer; readonly index: number; readonly threads: number }
  | { readonly type: 'attach'; readonly blocks: readonly Block[]; readonly version: number }
  | { readonly type: 'quit' };

export class SharedRunner implements Runner {
  readonly threads: number;
  private readonly ctrl: Int32Array;
  private readonly ports: readonly MessagePort[];
  private V: Views | null = null;
  private P: Float64Array | null = null;
  private version = 0;
  private ready = false;
  private broken = false;

  constructor(ports: readonly MessagePort[]) {
    this.ports = ports;
    this.threads = ports.length + 1;
    const buffer = new SharedArrayBuffer(CTRL * 4);
    this.ctrl = new Int32Array(buffer);
    ports.forEach((port, k) => {
      const m: HelperMessage = { type: 'init', ctrl: buffer, index: k + 1, threads: this.threads };
      port.postMessage(m);
    });
  }

  bind(V: Views, P: Float64Array, blocks: readonly Block[]): void {
    this.V = V;
    this.P = P;
    this.version += 1;
    this.ready = false;
    /* Wer gerade wartet, sieht die neue Fassung, kommt zurück in seine Schleife der Nachrichten und holt die Felder. */
    Atomics.store(this.ctrl, C_VERSION, this.version);
    Atomics.add(this.ctrl, C_GEN, 1);
    Atomics.notify(this.ctrl, C_GEN);
    for (const port of this.ports) {
      const m: HelperMessage = { type: 'attach', blocks, version: this.version };
      port.postMessage(m);
    }
  }

  /** Haben alle Helfer die jetzigen Felder? */
  private check(): boolean {
    if (this.ready) return true;
    for (let k = 0; k < this.ports.length; k += 1) if (Atomics.load(this.ctrl, C_ACK + k) !== this.version) return false;
    this.ready = true;
    return true;
  }

  /** Rechnen die Helfer gerade mit (für das HUD)? */
  get active(): boolean {
    return this.ready && !this.broken;
  }

  run(job: number): void {
    const V = this.V;
    const P = this.P;
    if (V === null || P === null) return;
    const n = jobLength(job, P);
    if (this.broken || n < MIN_PARALLEL || !this.check()) { runJob(job, V, P, 0, n); return; }
    const ctrl = this.ctrl;
    const helpers = this.ports.length;
    Atomics.store(ctrl, C_JOB, job);
    Atomics.store(ctrl, C_DONE, 0);
    Atomics.add(ctrl, C_GEN, 1);
    Atomics.notify(ctrl, C_GEN);
    runJob(job, V, P, 0, Math.floor(n / this.threads));
    let spins = 0;
    const started = performance.now();
    for (;;) {
      const done = Atomics.load(ctrl, C_DONE);
      if (done >= helpers) break;
      spins += 1;
      if (spins < SPIN) continue;
      Atomics.wait(ctrl, C_DONE, done, 2);
      if (performance.now() - started > 2000) {
        /* Ein Helfer antwortet nicht mehr: ab jetzt allein (das Stück, das fehlt, rechnet der Rechner nicht nach — der Schritt ist verloren, die Szene läuft weiter). */
        this.broken = true;
        break;
      }
    }
  }

  dispose(): void {
    Atomics.store(this.ctrl, C_QUIT, 1);
    Atomics.add(this.ctrl, C_GEN, 1);
    Atomics.notify(this.ctrl, C_GEN);
    for (const port of this.ports) {
      const m: HelperMessage = { type: 'quit' };
      port.postMessage(m);
      port.close();
    }
    this.V = null;
    this.P = null;
  }
}
