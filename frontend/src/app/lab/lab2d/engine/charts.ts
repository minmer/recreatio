/**
 * LABOR 2D (v2) — DIE SCHREIBER: je Probe die Wassertemperatur (mit der
 * Siedetemperatur an der Oberfläche), die Energiebilanz (Heizung, fühlbar,
 * latent, Verluste, entwichen), das Wasser nach Zustand und die
 * Dampferzeugung gegen (P − Verluste)/h_lv — dieselbe Rechnung wie Test 11:
 * Verluste sind alles, was die Heizleistung nicht ins Verdampfen bringt
 * (gespeichert in Feststoffen, an die Luft geleitet, durch die Wände, aus der
 * Flüssigkeit an die Luft, fühlbar in der Flüssigkeit gespeichert).
 */

import type { Engine } from './engine';
import { tSat } from './if97';
import { hL, hLV } from './materials';
import type { ChartSample } from './protocol';

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

export class Charts {
  private readonly e: Engine;
  private last: Mark | null = null;
  private latent0 = 0;
  private stored0 = 0;
  private started = false;

  constructor(engine: Engine) {
    this.e = engine;
  }

  /** Verdampftes Wasser seit dem Start (kg): aus der Flüssigkeit ins Gas und in Blasen, die platzten. */
  private vapour(): number {
    const e = this.e;
    return e.phase.produced - e.phase.condensed + e.bubbleModel.burstVapour;
  }

  private mark(Ts: number): Mark {
    const e = this.e;
    const b = e.measureBudget();
    const hs = hL(Ts);
    let sens = 0;
    const P = e.particles;
    for (let p = 0; p < P.count; p += 1) sens += P.mass[p] * (P.h[p] - hs);
    return { t: e.time, heater: e.flows.heater, solids: b.solids, sens, SG: e.heat.fluxSG, LG: e.heat.fluxLG, lossS: e.heat.lossSolids, bub: b.bubbles, vap: this.vapour() };
  }

  /** Eine Probe jetzt. */
  sample(): ChartSample {
    const e = this.e;
    const Ts = tSat(e.regions.pAmb);
    const L = hLV(Ts);
    const wt = e.waterTemperature();
    const b = e.measureBudget();
    const f = e.flows;
    const m = this.mark(Ts);
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
      t: e.time,
      waterT: wt.mean,
      waterTmax: wt.max,
      Tsat: Ts,
      heater: f.heater,
      latent: latent - this.latent0,
      sensible: stored - this.stored0 - (latent - this.latent0),
      losses: f.lossWalls + f.lossOpen,
      escaped: f.escapedEnergy,
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
}
