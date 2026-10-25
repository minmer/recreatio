/**
 * LABOR 2D (v2) — LIVE WEITER AUF DER GPU AUS EINEM SCHLÜSSELBILD (B, seit
 * 2026-10-25): „Na żywo od tej chwili“ bei einem Nachweis von der Grafikkarte
 * geht im beschleunigten Weg weiter. gpu.worker.ts schreibt das Schlüsselbild
 * in seine CPU-Engine zurück (restoreSnapshot), GpuEngine.create lädt sie
 * hoch (das Hochladen rechnet die Gasfelder neu, die ein Schlüsselbild nicht
 * trägt — state.ts derivedGas), und hier bekommt die GPU, was die CPU-Engine
 * führt: die Gesamtsummen (die Umkehrung von GpuEngine.download — sonst finge
 * die Zeit bei 0 an und die Heizung bei 0 J) und die Abweichungen der
 * Bilanzen (das Schlüsselbild trägt die der GPU beim Backen; an der ersten
 * Ablesung gehen sie genau so weiter).
 */

import type { GpuEngine } from './engine';

/** Die Gesamtsummen der GPU aus ihrer (eben wiederhergestellten) CPU-Engine und deren Abweichungen der Bilanzen. */
export function seedFromMirror(g: GpuEngine): void {
  const e = g.cpu;
  const f = e.flows;
  const ph = e.phase;
  const bm = e.bubbleModel;
  const x = e.extremes.stats();
  Object.assign(g.totals, {
    time: e.time, steps: e.steps,
    heater: f.heater, lossWalls: f.lossWalls, lossOpen: f.lossOpen, escapedEnergy: f.escapedEnergy, escapedWater: f.escapedWater, escapedAir: f.escapedAir,
    escapedOther: f.escapedOther, escapedSalt: f.escapedSalt, crystallized: e.salt.crystallized,
    produced: ph.produced, condensed: ph.condensed, dew: ph.dew, fogMade: ph.fogMade, burstVapour: bm.burstVapour,
    nucleated: bm.nucleated, departed: bm.departed, merged: bm.merged, burst: bm.burst, collapsed: bm.collapsed,
    burstCold: bm.burstCold, burstWarm: bm.burstWarm, collapsedCold: bm.collapsedCold, collapsedWarm: bm.collapsedWarm,
    fluxSL: e.heat.fluxSL, fluxLG: e.heat.fluxLG, fluxSG: e.heat.fluxSG, lossSolids: e.heat.lossSolids,
    slowed: x.slowed, vented: x.vented
  });
  g.carryErrors({ energy: e.energyError(), water: e.waterError(), other: e.otherError(), salt: e.saltError() });
}
