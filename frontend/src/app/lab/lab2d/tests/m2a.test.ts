/**
 * LABOR 2D (v2) — M2a: weitere Flüssigkeiten (Öl). Tore aus SANDBOX.md §13:
 * die Stoffwerte gegen ihre Quelle, Hydrostatik zweier Schichten, Schichtung
 * von Öl über Wasser, der Zähigkeitsschritt gegen den genauen Zerfall einer
 * Scherwelle, Öl über 100 °C ohne Sieden (Bilanzen), Dampfblasen durch eine
 * Ölschicht. Dass reines Wasser dieselben Zahlen gibt wie vor M2a, prüfen die
 * Tests von M1 (unverändert bis auf die letzte gedruckte Stelle).
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { cpLiq, kLiq, liquidIndex, muLiq, rhoL, rhoLiq, tFromHLiq, hLiq, WATER } from '../engine/materials';
import { T0 } from '../engine/units';
import { scene } from './scenes';

const OIL = liquidIndex('oil-rapeseed');
const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;

/** Steigung von p_l in der mittleren Spalte zwischen den Zeilen j0 und j1 (Pa/cm). */
function gradient(e: Engine, j0: number, j1: number): number {
  const g = e.grid;
  const i = Math.floor(g.nx / 2);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let j = j0; j <= j1; j += 1) {
    const y = (j + 0.5) * g.dx;
    const p = g.pl[i + j * g.nx];
    sx += y; sy += p; sxx += y * y; sxy += y * p; n += 1;
  }
  return -((n * sxy - sx * sy) / (n * sxx - sx * sx)) / 100;
}

/** Masse der Ölteilchen (kg). */
function oilMass(e: Engine): number {
  const P = e.particles;
  let m = 0;
  for (let p = 0; p < P.count; p += 1) if (P.mat[p] === OIL) m += P.mass[p];
  return m;
}

describe('M2a — materials: rapeseed (canola) oil against its source', () => {
  it('reproduces the canola measurements of Rojas, Coimbra & Telis-Romero (2013) within the fits’ deviations', () => {
    expect(OIL).toBeGreaterThan(0);
    /* Tables 2–5 of the paper at 293.15, 373.15 and 433.15 K. */
    const table: [number, number, number, number, number][] = [
      [293.15, 920.2, 1837, 0.166, 93.990e-3],
      [373.15, 900.8, 2249, 0.173, 7.528e-3],
      [433.15, 888.0, 2607, 0.179, 2.695e-3]
    ];
    for (const [T, rho, cp, k, mu] of table) {
      expect(Math.abs(rhoLiq(OIL, T) / rho - 1)).toBeLessThan(0.003);
      expect(Math.abs(cpLiq(OIL, T) / cp - 1)).toBeLessThan(0.02);
      expect(Math.abs(kLiq(OIL, T) / k - 1)).toBeLessThan(0.006);
      expect(Math.abs(muLiq(OIL, T) / mu - 1)).toBeLessThan(0.015);
    }
    /* Enthalpy closure: T(h(T)) = T, and h is the integral of c_p. */
    for (const T of [273.15, 300, 373.15, 450]) {
      expect(Math.abs(tFromHLiq(OIL, hLiq(OIL, T)) - T)).toBeLessThan(1e-9);
      const dT = 1e-3;
      expect(Math.abs((hLiq(OIL, T + dT) - hLiq(OIL, T - dT)) / (2 * dT) / cpLiq(OIL, T) - 1)).toBeLessThan(1e-6);
    }
    expect(hLiq(OIL, T0)).toBeCloseTo(0, 6);
  });

  it('a fill of several liquids places them by volume (each particle is one of them)', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.08, depth: 0.01 },
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.08, 0.04] }, composition: { H2O: 0.5, 'oil-rapeseed': 0.5 }, phase: 'liquid', T: 20 }]
    }));
    const P = e.particles;
    let nw = 0;
    let no = 0;
    for (let p = 0; p < P.count; p += 1) { if (P.mat[p] === WATER) nw += 1; else no += 1; }
    /* Equal masses: the volume of oil is ρ_w/ρ_oil times that of water. */
    const ratio = rhoL(T0 + 20) / rhoLiq(OIL, T0 + 20);
    console.log(`fill 50/50 by mass: ${nw} water, ${no} oil particles (oil/water ${(no / nw).toFixed(4)}, ρ_w/ρ_oil ${ratio.toFixed(4)})`);
    expect(Math.abs(no / nw / ratio - 1)).toBeLessThan(0.01);
    expect(Math.abs(e.measureBudget().other.total - e.measureBudget().water.liquid)).toBeLessThan(0.02 * e.measureBudget().water.liquid);
  });
});

describe('M2a — test 18: hydrostatics of two layers', () => {
  it('oil on water at rest: the pressure gradient is ρ_oil g in the oil and ρ_w g in the water (±2 %), currents below 1 mm/s', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.10, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 1, g: 9.81 },
      sides: sealed,
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.08, 0.03] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
        { op: 'fill', region: { rect: [0, 0.03, 0.08, 0.06] }, composition: { 'oil-rapeseed': 1 }, phase: 'liquid', T: 20 }
      ]
    }), { insulated: true, tol: 1e-8, maxIter: 200 });
    while (e.time < 5) e.step();
    const dx = e.grid.dx;
    const gw = gradient(e, 2, Math.round(0.03 / dx) - 3);
    const go = gradient(e, Math.round(0.03 / dx) + 3, Math.round(0.06 / dx) - 3);
    const expW = (rhoL(T0 + 20) * 9.81) / 100;
    const expO = (rhoLiq(OIL, T0 + 20) * 9.81) / 100;
    let vmax = 0;
    for (let p = 0; p < e.particles.count; p += 1) vmax = Math.max(vmax, Math.hypot(e.particles.vx[p], e.particles.vy[p]));
    console.log(`test 18: water ${gw.toFixed(3)} Pa/cm (ρ_w g ${expW.toFixed(3)}), oil ${go.toFixed(3)} Pa/cm (ρ_oil g ${expO.toFixed(3)}), largest speed after 5 s ${(vmax * 1000).toFixed(4)} mm/s, oil mass error ${e.otherError().toExponential(2)} kg`);
    expect(Math.abs(gw / expW - 1)).toBeLessThan(0.02);
    expect(Math.abs(go / expO - 1)).toBeLessThan(0.02);
    expect(vmax).toBeLessThan(1e-3);
    expect(Math.abs(e.otherError())).toBeLessThan(1e-12 * oilMass(e));
  });
});

describe('M2a — test 19: oil poured under water ends on top', () => {
  it('a layer of oil below water rises through it; at rest the oil band is as thick as its volume says (±1 cell)', () => {
    const e = new Engine(scene({
      box: { w: 0.06, h: 0.08, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 1, g: 9.81 },
      sides: sealed,
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.06, 0.016] }, composition: { 'oil-rapeseed': 1 }, phase: 'liquid', T: 20 },
        { op: 'fill', region: { rect: [0, 0.016, 0.06, 0.048] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
      ]
    }), { insulated: true });
    const m0 = oilMass(e);
    while (e.time < 20) e.step();
    /* The interface: in the inner columns, where the share of oil among the liquid crosses ½ (from below). */
    const g = e.grid;
    const P = e.particles;
    const oilV = new Float64Array(g.ny);
    const allV = new Float64Array(g.ny);
    for (let p = 0; p < P.count; p += 1) {
      const i = Math.floor(P.x[p] / g.dx);
      if (i < 3 || i >= g.nx - 3) continue;
      const j = Math.min(g.ny - 1, Math.floor(P.y[p] / g.dx));
      const v = P.mass[p] / P.rho[p];
      allV[j] += v;
      if (P.mat[p] === OIL) oilV[j] += v;
    }
    let interface_ = -1;
    for (let j = 0; j < g.ny - 1; j += 1) {
      const a = allV[j] > 0 ? oilV[j] / allV[j] : 0;
      const b = allV[j + 1] > 0 ? oilV[j + 1] / allV[j + 1] : 0;
      if (a < 0.5 && b >= 0.5) { interface_ = (j + 0.5 + (0.5 - a) / (b - a)) * g.dx; break; }
    }
    /* Oil below the interface (should be none at rest). */
    let below = 0;
    for (let p = 0; p < P.count; p += 1) if (P.mat[p] === OIL && P.y[p] < interface_ - 2 * g.dx) below += P.mass[p];
    const expected = 0.032;
    console.log(`test 19: interface at ${(interface_ * 1000).toFixed(2)} mm (water layer 32 mm thick), oil below it ${((100 * below) / m0).toFixed(2)} % of the oil, oil mass error ${(oilMass(e) - m0).toExponential(2)} kg`);
    expect(Math.abs(interface_ - expected)).toBeLessThan(g.dx);
    expect(below / m0).toBeLessThan(0.02);
    expect(Math.abs(oilMass(e) - m0)).toBeLessThan(1e-12 * m0);
  });
});

describe('M2a — test 20: viscosity', () => {
  it('one implicit step damps a shear wave by the exact factor of its discrete mode (±1 %)', () => {
    const H = 0.05;
    const e = new Engine(scene({
      box: { w: 0.2, h: 0.08, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 1, g: 9.81 },
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.2, H] }, composition: { 'oil-rapeseed': 1 }, phase: 'liquid', T: 20 }]
    }), { insulated: true });
    const g = e.grid;
    const L = e.liquid as unknown as { p2g(): void; viscous: boolean; viscosity(dt: number): void; knownU: Uint8Array; knownV: Uint8Array; rhoRef: number };
    /* The faces of the liquid as in a step, then the mode u(y) = sin(π y / 2H): no slip at the bottom, no stress at the surface. */
    L.viscous = true;
    L.p2g();
    const nxu = g.nx + 1;
    const N = Math.round(H / g.dx);
    for (let j = 0; j < g.ny; j += 1) for (let i = 0; i <= g.nx; i += 1) {
      const f = i + j * nxu;
      const wall = i === 0 || i === g.nx;
      L.knownU[f] = wall ? 2 : j < N ? 1 : 0;
      g.ul[f] = wall || j >= N ? 0 : Math.sin((Math.PI * (j + 0.5) * g.dx) / (2 * H));
    }
    for (let f = 0; f < g.nv; f += 1) { L.knownV[f] = 0; g.vl[f] = 0; }
    const dt = 1 / 120;
    const before = g.ul[Math.floor(g.nx / 2) + Math.floor(N / 2) * nxu];
    L.viscosity(dt);
    const after = g.ul[Math.floor(g.nx / 2) + Math.floor(N / 2) * nxu];
    /* Discrete mode: λ = (2 − 2 cos kΔx)/Δx², factor 1/(1 + η Δt λ/ρ_ref). */
    const k = Math.PI / (2 * H);
    const lambda = (2 - 2 * Math.cos(k * g.dx)) / (g.dx * g.dx);
    const eta = muLiq(OIL, T0 + 20);
    const factor = 1 / (1 + (eta * dt * lambda) / L.rhoRef);
    const continuous = Math.exp(-(eta / L.rhoRef) * k * k * dt);
    console.log(`test 20: damping in one step ${(after / before).toFixed(6)}, discrete mode ${factor.toFixed(6)}, continuous exp(−ν k² Δt) ${continuous.toFixed(6)} (η ${(eta * 1000).toFixed(2)} mPa·s, ρ_ref ${L.rhoRef.toFixed(1)} kg/m³)`);
    expect(Math.abs(after / before / factor - 1)).toBeLessThan(0.01);
    expect(Math.abs(after / before / continuous - 1)).toBeLessThan(0.01);
  });

  it('water alone stays inviscid at the cell scale: no viscosity solve and no cost', () => {
    const e = new Engine(scene({ box: { w: 0.08, h: 0.08, depth: 0.01 }, ops: [{ op: 'fill', region: { rect: [0, 0, 0.08, 0.04] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }] }));
    for (let k = 0; k < 10; k += 1) e.step();
    expect(e.liquid.last.viscIterations).toBe(0);
  });
});

describe('M2a — test 21: oil above 100 °C does not boil', () => {
  it('oil heated from 140 to 150 °C: no bubbles, no vapour, dT/dt = P/(m c_p) (±2 %), energy and oil mass close', () => {
    const e = new Engine(scene({
      box: { w: 0.06, h: 0.06, depth: 0.01 },
      ambient: { p: 101.325, T: 140, rh: 0, g: 9.81 },
      sides: sealed,
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.06, 0.03] }, composition: { 'oil-rapeseed': 1 }, phase: 'liquid', T: 140 }]
    }), { insulated: true });
    const m = oilMass(e);
    const P = 20;
    e.heat.liquidPower = P;
    const T1 = e.otherTemperature().mean;
    const t1 = e.time;
    let bubbles = 0;
    while (e.otherTemperature().mean < T0 + 150) { e.step(); bubbles = Math.max(bubbles, e.bubbles.count); }
    const T2 = e.otherTemperature().mean;
    const rate = (T2 - T1) / (e.time - t1);
    /* Heat capacity: oil at the mean temperature, plus the air in the sealed box. */
    const air = e.measureBudget().air;
    const C = m * cpLiq(OIL, 0.5 * (T1 + T2)) + air * 1010;
    const expected = P / C;
    const vapour = e.phase.produced + e.bubbleModel.burstVapour;
    console.log(`test 21: dT/dt ${rate.toFixed(5)} K/s, P/Σ(m c_p) ${expected.toFixed(5)} K/s (${(100 * (rate / expected - 1)).toFixed(2)} %), bubbles ${bubbles}, vapour ${vapour.toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J, oil mass error ${e.otherError().toExponential(2)} kg`);
    expect(bubbles).toBe(0);
    expect(vapour).toBe(0);
    expect(Math.abs(rate / expected - 1)).toBeLessThan(0.02);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6 * P * (e.time - t1) + 1e-3);
    expect(Math.abs(e.otherError())).toBeLessThan(1e-12 * m);
  });
});

describe('M2a — test 22: steam bubbles through an oil layer', () => {
  it('water boils under oil: bubbles nucleate in the water, cross the oil and burst; oil, water and energy budgets close', () => {
    const e = new Engine(scene({
      ops: [
        { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, on: true, T: 140 },
        { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 105 },
        { op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.040] }, composition: { H2O: 1 }, phase: 'liquid', T: 99 },
        { op: 'fill', region: { rect: [0.067, 0.040, 0.133, 0.060] }, composition: { 'oil-rapeseed': 1 }, phase: 'liquid', T: 99 },
        { op: 'solid', region: { rect: [0.082, 0.010, 0.086, 0.012] }, material: 'ceramic', T: 99 },
        { op: 'solid', region: { rect: [0.112, 0.010, 0.116, 0.012] }, material: 'ceramic', T: 99 }
      ]
    }));
    const m0 = oilMass(e);
    const water0 = e.measureBudget().water.total;
    const bm = e.bubbleModel;
    /* Bis die erste Blase an der Oberfläche des Öls platzt (nach gut 4 s; seit 2026-10-23 platzen keine mehr an der Aussenseite des
       Zlewka-Fusses — dort war eine halb bedeckte Zelle neben der Platte offen, heute ist sie fest). */
    while (e.time < 6 && bm.burst === 0) e.step();
    /* Where the oil is: its particles stay above the water (oil mean height above the water mean height). */
    const P = e.particles;
    let yo = 0, mo = 0, yw = 0, mw = 0;
    for (let p = 0; p < P.count; p += 1) {
      if (P.mat[p] === OIL) { yo += P.mass[p] * P.y[p]; mo += P.mass[p]; } else { yw += P.mass[p] * P.y[p]; mw += P.mass[p]; }
    }
    const energy = e.energyError();
    const water = e.waterError();
    console.log(`test 22: first burst after ${e.time.toFixed(2)} s, nucleated ${bm.nucleated}, burst ${bm.burst}, collapsed ${bm.collapsed}, oil centre ${(1000 * yo / mo).toFixed(1)} mm, water centre ${(1000 * yw / mw).toFixed(1)} mm, oil mass error ${e.otherError().toExponential(2)} kg, water error ${water.toExponential(2)} kg of ${water0.toExponential(3)}, energy error ${energy.toExponential(2)} J`);
    expect(bm.nucleated).toBeGreaterThan(0);
    expect(bm.burst).toBeGreaterThan(0);
    expect(yo / mo).toBeGreaterThan(yw / mw);
    expect(Math.abs(e.otherError())).toBeLessThan(1e-12 * m0);
    expect(Math.abs(water)).toBeLessThan(1e-9 * water0);
    expect(Math.abs(energy)).toBeLessThan(0.5);
  });
});
