/**
 * LABOR 2D (v2) — die langen Siedeläufe von M1c (`npm run test:lab2d:slow`):
 * Test 10 (unterkühltes Sieden), 11 (Siedeplateau und Dampferzeugung),
 * 12 (Überhitzung mit und ohne Siedesteine). Eine kompakte Zlewka (5 cm breit,
 * Wasser 2,7 cm tief) auf einer Heizplatte, damit die Läufe in Minuten fertig
 * sind.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { tSat } from '../engine/if97';
import { hL, hLV } from '../engine/materials';
import { scene, waterTolerance } from './scenes';

function compact(opts: { chips: boolean; water: number; glass: number; plate: number; power: number }) {
  return scene({
    box: { w: 0.1, h: 0.08, depth: 0.01 },
    ops: [
      { op: 'hotplate', x: 0.05, y: 0, w: 0.08, h: 0.006, material: 'steel', mode: 'power', power: opts.power, on: true, T: opts.plate },
      { op: 'beaker', x: 0.05, y: 0.006, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: opts.glass },
      { op: 'fill', region: { rect: [0.027, 0.008, 0.073, 0.035] }, composition: { H2O: 1 }, phase: 'liquid', T: opts.water },
      ...(opts.chips ? [
        { op: 'solid', region: { rect: [0.036, 0.008, 0.040, 0.010] }, material: 'ceramic', T: opts.water },
        { op: 'solid', region: { rect: [0.058, 0.008, 0.062, 0.010] }, material: 'ceramic', T: opts.water }
      ] : [])
    ]
  });
}

const Ts = tSat(101325);
/** Zeitgrenze je Lauf (ms). */
const LONG = 45 * 60 * 1000;

describe('M1c — test 10: subcooled boiling', () => {
  it('bubbles collapse before the surface while the bulk is ≥ 5 K below T_sat; later they reach it', () => {
    const e = new Engine(compact({ chips: false, water: 88, glass: 112, plate: 150, power: 40 }));
    const bm = e.bubbleModel;
    while (e.time < 75 && !(e.waterTemperature().mean > Ts - 1.5 && bm.burstWarm >= 20)) e.step();
    const coldShare = bm.burstCold / Math.max(1, bm.burstCold + bm.collapsedCold);
    console.log(`test 10: bulk ≥ 5 K below T_sat — ${bm.collapsedCold} bubbles collapsed, ${bm.burstCold} reached the surface (${(100 * coldShare).toFixed(3)} %); warmer — ${bm.collapsedWarm} collapsed, ${bm.burstWarm} reached the surface; water ${(e.waterTemperature().mean - 273.15).toFixed(2)} °C after ${e.time.toFixed(1)} s`);
    expect(bm.collapsedCold).toBeGreaterThan(100);
    expect(coldShare).toBeLessThan(0.01);
    expect(bm.burstWarm).toBeGreaterThan(0);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  }, LONG);
});

describe('M1c — test 11: boiling plateau', () => {
  it('steady boiling with chips: mean water within 0.5 K of T_sat(p0), vapour production = (P − losses)/h_lv within 5 %', () => {
    const e = new Engine(compact({ chips: true, water: 99.9, glass: 108, plate: 135, power: 25 }));
    const snap = () => {
      const b = e.measureBudget();
      const hs = hL(Ts);
      let sens = 0;
      for (let p = 0; p < e.particles.count; p += 1) sens += e.particles.mass[p] * (e.particles.h[p] - hs);
      return {
        t: e.time, heater: e.flows.heater, solids: b.solids, sens, SG: e.heat.fluxSG, LG: e.heat.fluxLG, lossS: e.heat.lossSolids, bub: b.bubbles,
        vap: e.phase.produced - e.phase.condensed + e.bubbleModel.burstVapour
      };
    };
    while (e.time < 30) e.step();
    const a = snap();
    let meanT = 0;
    let samples = 0;
    while (e.time < 60) {
      e.step();
      if (e.steps % 24 === 0) { meanT += e.waterTemperature().mean; samples += 1; }
    }
    const b = snap();
    meanT /= samples;
    const dt = b.t - a.t;
    const P = (b.heater - a.heater) / dt;
    /* Verluste: was die Heizung nicht ins Verdampfen bringt — in Feststoffen gespeichert, von Feststoffen an die Luft und durch Wände, aus der Flüssigkeit an die Luft, fühlbar in der Flüssigkeit, in Blasen. */
    const losses = (b.solids - a.solids + b.SG - a.SG + b.lossS - a.lossS + b.LG - a.LG + b.sens - a.sens + b.bub - a.bub) / dt;
    const expected = (P - losses) / hLV(Ts);
    const produced = (b.vap - a.vap) / dt;
    console.log(`test 11: mean water ${(meanT - 273.15).toFixed(3)} °C (T_sat ${(Ts - 273.15).toFixed(3)} °C), P ${P.toFixed(2)} W, losses ${losses.toFixed(2)} W, vapour ${(produced * 1e6).toFixed(3)} mg/s, (P − losses)/h_lv ${(expected * 1e6).toFixed(3)} mg/s (${(100 * (produced / expected - 1)).toFixed(2)} %)`);
    expect(Math.abs(meanT - Ts)).toBeLessThan(0.5);
    expect(Math.abs(produced / expected - 1)).toBeLessThan(0.05);
  }, LONG);
});

describe('M1c — test 12: superheating', () => {
  it('wall superheat at the first bubble: ≤ 1 K with boiling chips, ≥ ΔT_act of the largest glass cavity without them', () => {
    const withChips = new Engine(compact({ chips: true, water: 96, glass: 96, plate: 96, power: 25 }));
    while (withChips.bubbleModel.firstSuperheat === null && withChips.time < 120) withChips.step();
    const without = new Engine(compact({ chips: false, water: 96, glass: 96, plate: 96, power: 25 }));
    while (without.bubbleModel.firstSuperheat === null && without.time < 120) without.step();
    const bm = without.bubbleModel;
    /* ΔT_act der grössten Glaskavität beim Druck am Boden der Zlewka. */
    const bottom = without.pRef + 958 * 9.81 * 0.027;
    const act = bm.activation(bm.largestCavity('glass'), bottom);
    console.log(`test 12: with chips the first bubble came at ${withChips.bubbleModel.firstSuperheat?.toFixed(3)} K superheat on ${withChips.bubbleModel.firstMaterial} (t = ${withChips.time.toFixed(1)} s); without chips at ${bm.firstSuperheat?.toFixed(3)} K on ${bm.firstMaterial} (t = ${without.time.toFixed(1)} s), ΔT_act of the largest glass cavity ${act.toFixed(3)} K`);
    expect(withChips.bubbleModel.firstSuperheat).not.toBeNull();
    expect(withChips.bubbleModel.firstSuperheat as number).toBeLessThanOrEqual(1);
    expect(withChips.bubbleModel.firstMaterial).toBe('ceramic');
    expect(bm.firstSuperheat).not.toBeNull();
    expect(bm.firstMaterial).toBe('glass');
    expect(bm.firstSuperheat as number).toBeGreaterThanOrEqual(act - 0.05);
  }, LONG);
});
