/**
 * LABOR 2D (v2) — M1c: Blasen und Phasenwechsel. Tore des Prompts: Test 6
 * (Sättigung nach IF97 und ihre hydrostatische Verschiebung), 7 (Wachsen nach
 * Plesset & Zwick), 8 (Abreissen nach Fritz), 9 (Steiggeschwindigkeit nach
 * Tomiyama), 13 (Verdunsten), 14 (Nebel). Die langen Siedeläufe (Tests 10,
 * 11, 12) stehen in m1c.slow.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { pSat, rhoVapourSat, tSat } from '../engine/if97';
import { cpL, diffVapour, hLV, kL, MOLAR, rhoL, sigma } from '../engine/materials';
import { level, scene, waterTolerance } from './scenes';

describe('M1c — test 6: saturation', () => {
  it('T_sat = 99.97 °C at 101.325 kPa and 89.93 °C at 70 kPa (±0.01 K) — IAPWS-IF97', () => {
    expect(Math.abs(tSat(101325) - 273.15 - 99.97)).toBeLessThan(0.01);
    expect(Math.abs(tSat(70000) - 273.15 - 89.93)).toBeLessThan(0.01);
  });

  it('10 cm below the surface T_sat is 0.26 K higher (water at 100 °C, 958 kg/m³), from the engine\'s own pressure', () => {
    const e = new Engine(scene({
      box: { w: 0.04, h: 0.14, depth: 0.01 },
      ambient: { p: 101.325, T: 99.9, rh: 0, g: 9.81 },
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.04, 0.12] }, composition: { H2O: 1 }, phase: 'liquid', T: 99.9 }]
    }), { insulated: true, tol: 1e-8, maxIter: 200 });
    while (e.time < 2) e.step();
    const g = e.grid;
    const top = level(e);
    const i = Math.floor(g.nx / 2);
    /* Absoluter Druck in der Tiefe 10 cm (linear zwischen den Zellmitten) und an der Oberfläche (p0 des Gases). */
    const y = top - 0.1;
    const fj = y / g.dx - 0.5;
    const j = Math.floor(fj);
    const t = fj - j;
    const p = e.pRef + (1 - t) * g.pl[i + j * g.nx] + t * g.pl[i + (j + 1) * g.nx];
    const shift = tSat(p) - tSat(e.regions.pAmb);
    console.log(`test 6: surface at ${(top * 100).toFixed(2)} cm, p(10 cm) − p0 = ${(p - e.regions.pAmb).toFixed(1)} Pa, T_sat higher by ${shift.toFixed(4)} K (ρ = ${rhoL(373.05).toFixed(1)} kg/m³)`);
    expect(Math.abs(shift - 0.26)).toBeLessThan(0.01);
  });
});

describe('M1c — test 7: bubble growth', () => {
  it('g = 0, water superheated by 5 K, seed 10 µm: radius 1.20 mm after 10 ms (±5 %, Plesset–Zwick)', () => {
    const Ts = tSat(101325);
    const e = new Engine(scene({
      box: { w: 0.02, h: 0.02, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0, g: 0 },
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.02, 0.016] }, composition: { H2O: 1 }, phase: 'liquid', T: Ts + 5 - 273.15 }]
    }), { harness: true, dtMax: 1e-3 });
    e.phase.gatherLiquid();
    e.bubbleModel.spawn(0.01, 0.008, 0.005, 10e-6, 0);
    for (let k = 0; k < 10; k += 1) e.step();
    const r = e.bubbles.r[0];
    /* Plesset & Zwick (1954): R = 2 √(3/π) Ja √(α t), Ja = ρ_l c_p ΔT/(ρ_v h_lv), ρ_v aus IAPWS. */
    const Tl = Ts + 5;
    const alpha = kL(Tl) / (rhoL(Tl) * cpL(Tl));
    const Ja = (rhoL(Tl) * cpL(Tl) * 5) / (rhoVapourSat(Ts) * hLV(Ts));
    const pz = 2 * Math.sqrt(3 / Math.PI) * Ja * Math.sqrt(alpha * 0.01);
    console.log(`test 7: r(10 ms) = ${(r * 1000).toFixed(4)} mm, Plesset–Zwick ${(pz * 1000).toFixed(4)} mm (${(100 * (r / pz - 1)).toFixed(2)} %; the 10 µm seed starts near the critical radius, where 2σ/r lifts T_b)`);
    expect(Math.abs(r / 1.2e-3 - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M1c — test 8: departure', () => {
  it('saturated water at 100 °C, contact angle 45°: bubbles leave the wall at 2.34 mm (±5 %, Fritz)', () => {
    const Tsat = tSat(101325) - 273.15;
    const e = new Engine(scene({
      box: { w: 0.04, h: 0.04, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0, g: 9.81 },
      seed: 3,
      ops: [
        { op: 'hotplate', x: 0.02, y: 0, w: 0.04, h: 0.004, material: 'steel', mode: 'thermostat', power: 200, target: 107, on: true, T: 107 },
        { op: 'fill', region: { rect: [0, 0.004, 0.04, 0.024] }, composition: { H2O: 1 }, phase: 'liquid', T: Tsat }
      ]
    }), { harness: true });
    e.bubbleModel.contactAngleOverride = 45;
    while (e.time < 1 && e.bubbleModel.departureCount < 20) e.step();
    const n = Math.min(e.bubbleModel.departureCount, e.bubbleModel.departures.length);
    let mean = 0;
    for (let k = 0; k < n; k += 1) mean += e.bubbleModel.departures[k] / n;
    const fritz = 0.0208 * 45 * Math.sqrt(sigma(373.15) / (9.81 * (rhoL(373.15) - rhoVapourSat(373.15))));
    console.log(`test 8: ${n} departures, mean diameter ${(mean * 1000).toFixed(4)} mm, Fritz at 100 °C ${(fritz * 1000).toFixed(4)} mm (${(100 * (mean / 2.34e-3 - 1)).toFixed(2)} % from 2.34 mm)`);
    expect(n).toBeGreaterThan(5);
    expect(Math.abs(mean / 2.34e-3 - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M1c — test 9: rise velocity', () => {
  for (const [d, expected] of [[0.003, 0.25], [0.005, 0.23]] as const) {
    it(`air bubble of ${d * 1000} mm in water at 20 °C: slip velocity ${expected} m/s (±10 %, Tomiyama)`, () => {
      const e = new Engine(scene({
        box: { w: 0.04, h: 0.14, depth: 0.01 },
        ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
        ops: [{ op: 'fill', region: { rect: [0, 0, 0.04, 0.12] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }]
      }));
      for (let k = 0; k < 60; k += 1) e.step();
      e.phase.gatherLiquid();
      const id = e.bubbles.id[e.bubbleModel.spawn(0.02, 0.01, 0.005, d / 2, 1)];
      let slip = 0;
      while (e.time < 1.5) {
        e.step();
        const b = e.bubbles.find(id);
        if (b < 0) break;
        const [ux, uy] = e.bubbleModel.liquidVelocity(b);
        slip = Math.hypot(e.bubbles.vx[b] - ux, e.bubbles.vy[b] - uy);
        if (e.bubbles.y[b] > 0.09) break;
      }
      console.log(`test 9 (${d * 1000} mm): slip ${slip.toFixed(4)} m/s (prompt ${expected}, ${(100 * (slip / expected - 1)).toFixed(2)} %)`);
      expect(Math.abs(slip / expected - 1)).toBeLessThan(0.1);
    });
  }
});

describe('M1c — test 13: evaporation', () => {
  it('water at 20 °C below a still air column (g = 0): the rate equals ρ D ΔY/L within 5 %', () => {
    const e = new Engine(scene({
      box: { w: 0.02, h: 0.05, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0, g: 0 },
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.02, 0.01] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }]
    }), { harness: true, insulated: true });
    let m0 = 0;
    let t0 = 0;
    while (e.time < 40) {
      e.step();
      if (e.time >= 30 && t0 === 0) { t0 = e.time; m0 = e.phase.produced - e.phase.condensed; }
    }
    const rate = (e.phase.produced - e.phase.condensed - m0) / (e.time - t0);
    const g = e.grid;
    let Ts = 0;
    for (let i = 0; i < g.nx; i += 1) Ts += e.phase.Tl[i + 4 * g.nx] / g.nx;
    const x = pSat(Ts) / 101325;
    const mDry = 1 / (0.7676 / MOLAR[0] + 0.2324 / MOLAR[1]);
    const ysat = (x * MOLAR[2]) / (x * MOLAR[2] + (1 - x) * mDry);
    const Tm = (Ts + 293.15) / 2;
    const rho = (101325 * mDry) / (8.314462618 * Tm);
    const expected = (rho * diffVapour(Tm, 101325) * ysat * 0.02 * 0.01) / 0.04;
    console.log(`test 13: surface ${(Ts - 273.15).toFixed(3)} °C, Y_sat ${ysat.toFixed(5)}, rate ${rate.toExponential(4)} kg/s, ρ D ΔY/L ${expected.toExponential(4)} kg/s (${(100 * (rate / expected - 1)).toFixed(2)} %; Stefan flow adds ≈ Y_sat/2)`);
    expect(Math.abs(rate / expected - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M1c — test 14: fog', () => {
  it('fog forms only where p_H₂O > p_sat(T), each fog cell ends exactly saturated, water mass stays exact', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.06, depth: 0.01 },
      ambient: { p: 101.325, T: 35, rh: 1, g: 9.81 },
      sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' },
      ops: [{ op: 'solid', region: { rect: [0.03, 0.02, 0.05, 0.03] }, material: 'steel', T: 2 }]
    }), { insulated: true });
    let maxErr = 0;
    let wrong = 0;
    while (e.time < 6) {
      e.step();
      maxErr = Math.max(maxErr, e.phase.fogError);
      wrong += e.phase.fogWrong;
    }
    const s = e.stats();
    console.log(`test 14: fog ${(s.budget.water.fog * 1e6).toFixed(3)} mg, dew ${(s.budget.water.film * 1e6).toFixed(3)} mg, largest |p_v − p_sat|/p_sat of a fog cell ${maxErr.toExponential(2)}, fog in subsaturated cells ${wrong}, water error ${s.waterError.toExponential(2)} kg`);
    expect(s.budget.water.fog).toBeGreaterThan(0);
    expect(maxErr).toBeLessThan(1e-6);
    expect(wrong).toBe(0);
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
  });
});
