/**
 * LABOR 2D (v2) — HEFTIGE ZUSTÄNDE (extremes.ts, seit 2026-10-24): Wasser
 * von 95 °C direkt auf einer Stahlplatte von 140 °C — 40 K über dem Sieden.
 * Vorher lief das in zehn Schritten auf 3000 m/s und NaN (die ganze
 * Überhitzung der Wand in eine Blase, die Gegenkraft grosser Blasen auf
 * wenige Flächen, der Driftausgleich mit 1/Δt, Druckeinbrüche unter null).
 * „compute“ rechnet das heftige Sieden, „normalize“ mildert es, „ask“ hält an
 * und fragt.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { criticalHeatFlux } from '../engine/extremes';
import { readScene, writeScene, type ExtremeMode } from '../engine/scene';
import { scene, waterTolerance } from './scenes';

/** Die heisse Platte ohne Zlewka, darauf 2 cm Wasser knapp unter dem Sieden. */
const hotPlate = (extremes: ExtremeMode): Record<string, unknown> => ({
  ...scene({
    ops: [
      { op: 'hotplate', id: 'plyta', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, on: true, T: 140 },
      { op: 'fill', region: { rect: [0.05, 0.008, 0.15, 0.03] }, composition: { H2O: 1 }, phase: 'liquid', T: 95 }
    ]
  }),
  extremes
});

/** Alles endlich? (Teilchen, Blasen, Zellen) */
function finite(e: Engine): boolean {
  const P = e.particles;
  const B = e.bubbles;
  const g = e.grid;
  for (let p = 0; p < P.count; p += 1) if (!Number.isFinite(P.x[p] + P.y[p] + P.vx[p] + P.vy[p] + P.T[p] + P.mass[p])) return false;
  for (let b = 0; b < B.count; b += 1) if (!Number.isFinite(B.x[b] + B.y[b] + B.r[b] + B.V[b])) return false;
  for (let c = 0; c < g.n; c += 1) if (!Number.isFinite(g.T[c] + g.pl[c] + g.pg[c])) return false;
  return true;
}

function run(mode: ExtremeMode, steps: number) {
  const e = new Engine(hotPlate(mode));
  const water0 = e.measureBudget().water.liquid;
  let biggest = 0;
  let fastest = 0;
  let dtMin = Infinity;
  let ok = true;
  for (let k = 0; k < steps && ok; k += 1) {
    e.step();
    ok = finite(e);
    dtMin = Math.min(dtMin, e.dt);
    biggest = Math.max(biggest, e.extremes.maxBubble);
    fastest = Math.max(fastest, e.extremes.maxSpeed);
  }
  const w = e.measureBudget().water;
  return { e, ok, biggest, fastest, dtMin, kept: w.liquid / water0, escaped: w.escaped };
}

describe('Extremes — test 47: violent boiling stays finite', () => {
  it('the critical heat flux (Lienhard & Dhir 1973) at 1 atm and 9.81 m/s² is about 1.26 MW/m² (0.149 ρv^½ h_lv [σ g (ρl − ρv)]^¼)', () => {
    const q = criticalHeatFlux(101325, 9.81);
    console.log(`test 47: q″_max = ${(q / 1e6).toFixed(3)} MW/m²`);
    expect(q).toBeGreaterThan(1.2e6);
    expect(q).toBeLessThan(1.32e6);
  });

  it('compute: water at 95 °C on steel at 140 °C boils violently for 300 steps — every value finite, the 20 m/s guard never has to act, the step never collapses, energy and water exact', () => {
    const r = run('compute', 300);
    console.log(`test 47 (compute): finite ${r.ok}, largest bubble ${(r.biggest * 1000).toFixed(2)} mm, fastest particle ${r.fastest.toFixed(2)} m/s (guard acted ${r.e.extremes.slowed}×), shortest step ${(r.dtMin * 1000).toFixed(3)} ms, water kept ${(100 * r.kept).toFixed(1)} %, escaped ${(r.escaped * 1000).toFixed(3)} g; energy error ${r.e.energyError().toExponential(2)} J, water error ${r.e.waterError().toExponential(2)} kg`);
    expect(r.ok).toBe(true);
    expect(r.e.extremes.slowed).toBe(0);
    expect(r.dtMin).toBeGreaterThan(5e-5);
    expect(Math.abs(r.e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(r.e.waterError())).toBeLessThan(waterTolerance(r.e));
  });

  it('normalize: the same scene boils calmly — no bubble above 4 mm (2 % for the state solved after venting; the rest goes to the air), water held below 1.5 m/s, the water stays on the plate, energy and water exact', () => {
    const r = run('normalize', 300);
    console.log(`test 47 (normalize): finite ${r.ok}, largest bubble ${(r.biggest * 1000).toFixed(2)} mm, fastest particle ${r.fastest.toFixed(2)} m/s, shortest step ${(r.dtMin * 1000).toFixed(3)} ms, water kept ${(100 * r.kept).toFixed(1)} %, vented ${(r.e.extremes.vented * 1e6).toFixed(2)} mg; energy error ${r.e.energyError().toExponential(2)} J, water error ${r.e.waterError().toExponential(2)} kg`);
    expect(r.ok).toBe(true);
    expect(r.biggest).toBeLessThanOrEqual(0.004 * 1.02);
    expect(r.fastest).toBeLessThanOrEqual(1.5 + 1e-9);
    expect(r.kept).toBeGreaterThan(0.97);
    expect(Math.abs(r.e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(r.e.waterError())).toBeLessThan(waterTolerance(r.e));
  });
});

describe('Extremes — test 48: asking', () => {
  it('ask (the default): the run raises one event when a bubble passes 6 mm or water 2 m/s, take() hands it over once; the answer (normalize) is stored in the scene and nothing is asked again', () => {
    const e = new Engine(hotPlate('ask'));
    expect(e.scene.extremes).toBe('ask');
    let event = null;
    let steps = 0;
    for (; steps < 300 && event === null; steps += 1) { e.step(); event = e.extremes.take(); }
    console.log(`test 48: event after ${steps} steps (t = ${(e.time * 1000).toFixed(1)} ms): ${JSON.stringify(event)}`);
    expect(event).not.toBeNull();
    expect(e.extremes.take()).toBeNull();
    e.setExtremes('normalize');
    expect(readScene(e.serialize()).scene.extremes).toBe('normalize');
    for (let k = 0; k < 50; k += 1) { e.step(); expect(e.extremes.take()).toBeNull(); }
    /* „ask“ steht nicht in der Datei (die Vorgabe), die anderen schon. */
    expect('extremes' in writeScene(readScene(hotPlate('ask')).scene)).toBe(false);
    expect(writeScene(readScene(hotPlate('compute')).scene).extremes).toBe('compute');
  });
});
