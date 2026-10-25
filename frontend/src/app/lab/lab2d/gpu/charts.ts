/**
 * LABOR 2D (v2) — DIE SCHREIBER DES BESCHLEUNIGTEN WEGS: dieselben Proben wie
 * engine/charts.ts, aber aus den Ablesungen der GPU (Gesamtsummen in f64,
 * Kennzahlen aus den Teilsummen) statt aus den Feldern der CPU-Engine.
 */

import type { Charts } from '../engine/charts';
import { tSat } from '../engine/if97';
import { hLV } from '../engine/materials';
import type { ChartSample } from '../engine/protocol';
import type { GpuEngine } from './engine';

/** Die Marken der Schreiber (engine/charts.ts führt dieselben Felder): so geht eine Probe nach einem Wechsel zwischen GPU und CPU weiter. */
interface Marks { last: Mark | null; latent0: number; stored0: number; started: boolean }

interface Mark {
  t: number;
  heater: number;
  solids: number;
  sens: number;
  SG: number;
  LG: number;
  lossS: number;
  bub: number;
  vap: number;
}

export class GpuCharts {
  private readonly g: GpuEngine;
  private last: Mark | null = null;
  private latent0 = 0;
  private stored0 = 0;
  private started = false;

  constructor(gpu: GpuEngine) {
    this.g = gpu;
  }

  private vapour(): number {
    const t = this.g.totals;
    return t.produced - t.condensed + t.burstVapour;
  }

  /** Eine Probe aus der letzten Ablesung (null, solange es keine gibt). */
  sample(): ChartSample | null {
    const g = this.g;
    const r = g.last;
    if (r === null) return null;
    const t = g.totals;
    const Ts = tSat(g.cpu.regions.pAmb);
    const L = hLV(Ts);
    const b = g.budget();
    const m: Mark = { t: t.time, heater: t.heater, solids: b.solids, sens: r.sensible, SG: t.fluxSG, LG: t.fluxLG, lossS: t.lossSolids, bub: b.bubbles, vap: this.vapour() };
    const prev = this.last;
    let vapourRate = 0;
    let expectedRate = 0;
    if (prev !== null && m.t > prev.t) {
      const dt = m.t - prev.t;
      const P = (m.heater - prev.heater) / dt;
      const losses = (m.solids - prev.solids + m.SG - prev.SG + m.lossS - prev.lossS + m.LG - prev.LG + m.sens - prev.sens + m.bub - prev.bub) / dt;
      vapourRate = (m.vap - prev.vap) / dt;
      expectedRate = Math.max(0, (P - losses) / L);
    }
    this.last = m;
    const latent = this.vapour() * L;
    const stored = b.energy;
    if (!this.started) { this.started = true; this.latent0 = latent; this.stored0 = stored; }
    return {
      t: t.time,
      waterT: r.waterT,
      waterTmax: r.waterTmax,
      Tsat: Ts,
      heater: t.heater,
      latent: latent - this.latent0,
      sensible: stored - this.stored0 - (latent - this.latent0),
      losses: t.lossWalls + t.lossOpen,
      escaped: t.escapedEnergy,
      liquid: b.water.liquid,
      vapour: b.water.vapour,
      fog: b.water.fog,
      film: b.water.film,
      bubbles: b.water.bubbles,
      escapedWater: b.water.escaped,
      vapourRate,
      expectedRate
    };
  }

  /** Die Marken in die Schreiber der CPU-Engine (ein Schlüsselbild beim Backen mit der GPU: dort geht es live weiter). */
  copyTo(c: Charts): void {
    const to = c as unknown as Marks;
    to.last = this.last === null ? null : { ...this.last };
    to.latent0 = this.latent0;
    to.stored0 = this.stored0;
    to.started = this.started;
  }

  /** Die Marken aus den Schreibern der CPU-Engine (live weiter auf der GPU aus einem Schlüsselbild). */
  copyFrom(c: Charts): void {
    const from = c as unknown as Marks;
    this.last = from.last === null ? null : { ...from.last };
    this.latent0 = from.latent0;
    this.stored0 = from.stored0;
    this.started = from.started;
  }
}
