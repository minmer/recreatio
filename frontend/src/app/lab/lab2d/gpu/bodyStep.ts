/**
 * LABOR 2D (v2) — DIE KÖRPER IM SCHRITT DER GPU (seit 2026-10-26): welche
 * Kerne der Körper engine.ts wann aufzeichnet, wenn alle Körper genaue
 * Anteile haben (GpuState.body). Die Reihenfolge ist die der CPU:
 *
 *  - Stufe „inputs“ (bodies.prepare): bPrep, Teilchen und Blasen hinaus,
 *    abdecken, schliessen (Schwellen, Paare der u-, dann der v-Flächen),
 *    wechseln (Gas hinaus/herein), schreiben, gasApply bucht, φ_s/Abstand.
 *  - In der Flüssigkeit: nach p2g die bewegten Flächen (bFaceL); nach der
 *    Projektion die drei Lösungen der mitbewegten Masse je wachem freiem
 *    Körper (höchstens acht, aus der letzten Ablesung gewählt: select);
 *    im Gas nach markFaces bFaceG; vor jedem
 *    regFinish das Fluidvolumen der Gebiete (bRegVol); vor dem Regler der
 *    Heizungen die Heizplatten (bHeaters).
 *  - Stufe „bodies“ (bodies.finish): collect; mit Eis aus einem Rechteck das
 *    Schmelzen und Anfrieren (kbodymelt.ts: Summen der Zellen, eine
 *    Arbeitsgruppe für alle Körper, die Teilchen, neues Schmelzwasser); die
 *    Druckfortsetzung, Kräfte, die Bewegung in einer Arbeitsgruppe; danach erst
 *    stepEnd (Δt mit dem schnellsten Körper).
 */

import type { BodyRead } from './bodies';
import { BB, BS } from './kbodylib';
import type { Resource } from './kernel';
import type { GpuSolver } from './solver';
import { SOLVE_PROBE } from './solver';
import type { GpuState } from './state';

/** Was engine.ts zum Aufzeichnen bereitstellt (Bindungsgruppen nach Namen, Variante und Zusatz). */
export interface BodyHooks {
  cells(p: GPUComputePassEncoder, name: string, v?: 'A'): void;
  faces(p: GPUComputePassEncoder, name: string): void;
  parts(p: GPUComputePassEncoder, name: string): void;
  bubs(p: GPUComputePassEncoder, name: string): void;
  one(p: GPUComputePassEncoder, name: string): void;
  /** Ein Kern über `threads` Fäden mit zusätzlichen Bindungen (key: Name der Gruppe im Zwischenspeicher). */
  run(p: GPUComputePassEncoder, name: string, threads: number, key: string, extra: Readonly<Record<string, Resource>>): void;
}

/** Plätze des Uniforms der Messung (je Lösung: Körper, Spalte k). */
const PB_SLOT = 256;
const PB_SLOTS = 3 * 8;

export class BodyStep {
  /** Die Auswahl der Messungen (Körper, Spalte) als Uniform-Plätze. */
  private readonly pb: GPUBuffer;
  /** Iterationen einer Messung (aus den Ablesungen angepasst). */
  itP = 12;

  constructor(private readonly state: GpuState, private readonly solver: GpuSolver) {
    this.pb = state.ctx.buffer('probesel', PB_SLOT * PB_SLOTS, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.writeSel();
  }

  /**
   * Nach jedem Hochladen und wenn sich die Auswahl ändert: welche Körper gemessen werden (die Plätze der Auswahl) und ihr B_PROBE (nur
   * gemessene schliesst bProbeFin ab). Kein Kern schreibt B_PROBE; das Schreiben reiht sich hinter die schon abgeschickten Schritte.
   */
  writeSel(): void {
    const q = this.state.ctx.device.queue;
    const B = this.state.bodies;
    const probed = B.probed;
    for (let j = 0; j < Math.min(8, probed.length); j += 1) {
      for (let k = 0; k < 3; k += 1) q.writeBuffer(this.pb, PB_SLOT * (3 * j + k), new Uint32Array([probed[j], k, 0, 0]));
    }
    for (let k = 0; k < B.nbody; k += 1) q.writeBuffer(B.bod, 4 * (BS * k + BB.PROBE), new Float32Array([probed.includes(k) ? 1 : 0]));
  }

  /**
   * Nach einer Ablesung: gemessen werden die freien Körper, die wach waren (wie bodies.probe auf der CPU) — bis 2026-10-26 jeder freie, auch
   * ein schlafender (1,55 ms je Schritt und Körper: ein ruhender Stein 6,3 statt 4,3 ms, sechs 13,4 statt 4,1 ms). Wacht einer zwischen zwei
   * Ablesungen auf, rechnet er bis zur nächsten mit seiner zuletzt gemessenen mitbewegten Masse (kbodydyn.ts).
   */
  select(reads: readonly BodyRead[]): void {
    const want: number[] = [];
    reads.forEach((b, k) => { if (!b.pinned && !b.asleep && !b.gone && want.length < 8) want.push(k); });
    const cur = this.state.bodies.probed;
    if (want.length === cur.length && want.every((k, i) => cur[i] === k)) return;
    this.state.bodies.probed = want;
    this.writeSel();
  }

  destroy(): void { this.state.ctx.release([this.pb]); }

  /** Stufe „inputs“: die wachen Körper ins Gitter. */
  prepare(p: GPUComputePassEncoder, h: BodyHooks): void {
    h.one(p, 'bPrep');
    h.parts(p, 'bPush');
    h.bubs(p, 'bPushB');
    h.cells(p, 'bCover');
    h.cells(p, 'bClose1');
    h.cells(p, 'bClose2');
    h.cells(p, 'bFlip');
    h.cells(p, 'bApply');
    h.cells(p, 'gasApply');
    h.cells(p, 'bStatic');
    h.one(p, 'bPrepEnd');
  }

  /** Nach der Projektion der Flüssigkeit: M_a = Δt Δx² D Jᵀ A⁻¹ J je gemessenem Körper (select; drei Lösungen mit ihrer Matrix). */
  probe(p: GPUComputePassEncoder, h: BodyHooks): void {
    const probed = this.state.bodies.probed;
    if (probed.length === 0) return;
    const n = this.state.d.n;
    const L = this.solver.level0;
    for (let j = 0; j < Math.min(8, probed.length); j += 1) {
      for (let k = 0; k < 3; k += 1) {
        const slot = 3 * j + k;
        const sel = { PB: { buffer: this.pb, offset: PB_SLOT * slot, size: 16 }, L };
        h.run(p, 'bProbeRhs', n, `pr${slot}`, sel);
        /* Dieselbe Matrix wie die eben gelöste Projektion (und dieselbe Behandlung rein Neumann'scher Gebiete): ihre groben Stufen stehen noch. */
        this.solver.encodeMG(p, SOLVE_PROBE, this.itP, true, false, true);
        h.run(p, 'bProbeDot', n, `pd${slot}`, sel);
      }
    }
    h.one(p, 'bProbeFin');
  }

  /** Stufe „bodies“: collect, schmelzen und anfrieren (kbodymelt*.ts — wie die CPU nach collect, vor den Kräften), Druck fortsetzen, Kräfte, Bewegung. */
  finish(p: GPUComputePassEncoder, h: BodyHooks): void {
    const B = this.state.bodies;
    h.cells(p, 'bCollectPrep');
    h.run(p, 'bCollect', Math.max(1, B.ncell), 'bCollect', {});
    h.run(p, 'bCollectRest', Math.max(1, B.ncell), 'bCollectRest', {});
    h.cells(p, 'bCollectEnd');
    if (B.melting) {
      h.cells(p, 'mSums', 'A');
      h.one(p, 'mMelt');
      h.parts(p, 'mApply');
      h.run(p, 'mSpawn', 4 * Math.max(1, B.nbody), 'mSpawn', {});
    }
    h.cells(p, 'bExtInit', 'A');
    for (let k = 0; k < B.layers; k += 2) { h.cells(p, 'bExtA'); h.cells(p, 'bExtB'); }
    h.run(p, 'bForce', 64 * Math.max(1, B.nbody), 'bForce', {});
    h.one(p, 'bDyn');
  }

  /** In einer Ablesung: je Körper Lage, Zustand, Masse, Temperatur, Energie, Film, Kruste. */
  measure(p: GPUComputePassEncoder, h: BodyHooks): void {
    h.run(p, 'bMeas', 64 * Math.max(1, this.state.bodies.nbody), 'bMeas', {});
  }

  /** Die Iterationen der Messung an das anpassen, was die letzten brauchten (wie die anderen Löser). */
  adapt(used: number, capped: number): void {
    if (used === 0 && capped === 0) return;
    const want = capped > 0 ? Math.ceil(this.itP * 1.5) + 2 : used + 1;
    this.itP = Math.min(40, Math.max(4, this.itP > want ? Math.max(want, this.itP - 2) : want));
  }
}
