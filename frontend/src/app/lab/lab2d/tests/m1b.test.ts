/**
 * LABOR 2D (v2) — M1b: die Flüssigkeit. Tore des Prompts: Test 1
 * (Hydrostatik), Test 4 mit Wasser (Energie, Wassermasse), Test 5
 * (Wärmeausdehnung). Test 3 (Heizrate) und die zehn Minuten von Test 4 laufen
 * in m1b.slow.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { rhoL } from '../engine/materials';
import { T0 } from '../engine/units';
import { scene } from './scenes';

const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;

/** Steigung von p_l über die Tiefe in der mittleren Spalte (Pa/cm), Zeilen 2 bis `top`. */
function gradient(e: Engine, top: number): number {
  const g = e.grid;
  const i = Math.floor(g.nx / 2);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let j = 2; j <= top; j += 1) {
    const y = (j + 0.5) * g.dx;
    const p = g.pl[i + j * g.nx];
    sx += y; sy += p; sxx += y * y; sxy += y * p; n += 1;
  }
  return -((n * sxy - sx * sy) / (n * sxx - sx * sx)) / 100;
}

/** Höhe der freien Oberfläche (m): wo φ in den inneren Spalten ½ kreuzt, gemittelt. */
export function level(e: Engine): number {
  const g = e.grid;
  let sum = 0, n = 0;
  for (let i = 3; i < g.nx - 3; i += 1) {
    let top = -1;
    for (let j = g.ny - 1; j >= 0; j -= 1) if (g.phi[i + j * g.nx] >= 0.5) { top = j; break; }
    if (top < 0 || top >= g.ny - 1) continue;
    const a = g.phi[i + top * g.nx];
    const b = g.phi[i + (top + 1) * g.nx];
    sum += (top + 0.5 + (a - 0.5) / (a - b)) * g.dx;
    n += 1;
  }
  return sum / n;
}

describe('M1b — test 1: hydrostatics', () => {
  for (const [T, expected] of [[20, 97.9], [90, 94.7]] as const) {
    it(`water at rest at ${T} °C: ${expected} Pa per cm (±2 %), residual currents below 1 mm/s`, () => {
      const e = new Engine(scene({
        box: { w: 0.08, h: 0.08, depth: 0.01 },
        ambient: { p: 101.325, T, rh: 0, g: 9.81 },
        ops: [{ op: 'fill', region: { rect: [0, 0, 0.08, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T }]
      }), { insulated: true, tol: 1e-8, maxIter: 200 });
      while (e.time < 5) e.step();
      const grad = gradient(e, 20);
      let vmax = 0;
      for (let p = 0; p < e.particles.count; p += 1) vmax = Math.max(vmax, Math.hypot(e.particles.vx[p], e.particles.vy[p]));
      /* Die Erwartung aus den Stoffdaten: ρ(T) g. */
      const exact = (rhoL(T0 + T) * 9.81) / 100;
      console.log(`test 1 (${T} °C): ${grad.toFixed(3)} Pa/cm (ρ g = ${exact.toFixed(3)}, prompt ${expected}), largest particle speed after 5 s ${(vmax * 1000).toFixed(4)} mm/s`);
      expect(Math.abs(grad / expected - 1)).toBeLessThan(0.02);
      expect(Math.abs(grad / exact - 1)).toBeLessThan(0.002);
      expect(vmax).toBeLessThan(1e-3);
    });
  }
});

describe('M1b — test 5: thermal expansion', () => {
  it('heating water from 20 to 90 °C raises its level by 3.4 % (±0.3 %)', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.15, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0, g: 9.81 },
      sides: sealed,
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.08, 0.10] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }]
    }), { insulated: true });
    for (let k = 0; k < 120; k += 1) e.step();
    const h0 = level(e);
    /* Gleichmässig geheizt (wie im Mikrowellenherd), bis das Wasser im Mittel 90 °C hat; dann zur Ruhe kommen. */
    e.heat.liquidPower = 1000;
    while (e.waterTemperature().mean < T0 + 90) e.step();
    e.heat.liquidPower = 0;
    for (let k = 0; k < 240; k += 1) e.step();
    const h1 = level(e);
    const rise = h1 / h0 - 1;
    const exact = rhoL(T0 + 20) / rhoL(e.waterTemperature().mean) - 1;
    console.log(`test 5: level ${(h0 * 1000).toFixed(2)} → ${(h1 * 1000).toFixed(2)} mm, rise ${(100 * rise).toFixed(3)} % (ρ(20)/ρ(T) − 1 = ${(100 * exact).toFixed(3)} %, prompt 3.4 %), energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(rise - 0.034)).toBeLessThan(0.003);
    expect(Math.abs(e.waterError())).toBeLessThan(1e-15);
  });
});

describe('M1b — test 4 with water: conservation', () => {
  it('sealed, insulated beaker on a hot plate: ΔE equals ∫P dt within 0.5 %, water exact (60 s; 10 min in the slow suite)', () => {
    const e = new Engine(scene({
      box: { w: 0.10, h: 0.08, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
      sides: sealed,
      ops: [
        { op: 'hotplate', x: 0.05, y: 0, w: 0.06, h: 0.004, material: 'steel', mode: 'power', power: 10, on: true, T: 20 },
        { op: 'beaker', x: 0.05, y: 0.004, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 20 },
        { op: 'fill', region: { rect: [0.027, 0.006, 0.073, 0.046] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
      ]
    }), { insulated: true });
    while (e.time < 60) e.step();
    const s = e.stats();
    const err = Math.abs(s.energyError);
    console.log(`test 4 (sealed with water, 60 s): ∫P dt = ${s.flows.heater.toFixed(2)} J, |ΔE − ∫P dt| = ${err.toExponential(3)} J (${(100 * err / s.flows.heater).toExponential(2)} %), water error ${s.waterError.toExponential(2)} kg, water ${(s.waterT - T0).toFixed(2)} °C`);
    expect(err / s.flows.heater).toBeLessThan(0.005);
    expect(Math.abs(s.waterError)).toBeLessThan(1e-15);
  });

  it('open box with water: the budgets close including what escaped', () => {
    const e = new Engine(scene({
      box: { w: 0.10, h: 0.08, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
      ops: [
        { op: 'hotplate', x: 0.05, y: 0, w: 0.06, h: 0.004, material: 'steel', mode: 'power', power: 10, on: true, T: 20 },
        { op: 'beaker', x: 0.05, y: 0.004, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 20 },
        { op: 'fill', region: { rect: [0.027, 0.006, 0.073, 0.046] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
      ]
    }));
    while (e.time < 40) e.step();
    const s = e.stats();
    const err = Math.abs(s.energyError);
    console.log(`test 4 (open with water, 40 s): heater ${s.flows.heater.toFixed(2)} J, walls ${s.flows.lossWalls.toFixed(3)} J, escaped ${s.flows.escapedEnergy.toFixed(3)} J, error ${err.toExponential(3)} J`);
    expect(err / s.flows.heater).toBeLessThan(0.005);
    expect(Math.abs(s.waterError)).toBeLessThan(1e-15);
  });
});
