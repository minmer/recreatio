/**
 * LABOR 2D (v2) — die langen Prüfungen von M3b (`npm run test:lab2d:slow`):
 * die Fronten des Stefan-Problems bei 1 mm (die Gate-Genauigkeit ±5 %) und
 * die Kältemischung aus Eis und starker Sole bis ans Eutektikum.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { freezingPoint, M_S, T_EUTECTIC } from '../engine/solution';
import { frontAt, iceInBrine, liquidState, stefanFreeze, stefanMelt } from './ice';
import { waterTolerance } from './scenes';

/** Zeitgrenze je Lauf (ms). */
const LONG = 30 * 60 * 1000;

describe('M3b — test 41 at 1 mm', () => {
  it('melting front under water at 20 °C: after 4 minutes within 5 % of Neumann, its speed from 2 to 4 minutes too', () => {
    const { scene: sc, slope } = stefanMelt('very-high');
    const e = new Engine(sc, { insulated: true });
    const top0 = e.bodies.list[0].y + e.bodies.list[0].bounds(0)[3];
    const [a, b] = frontAt(e, [120, 240]).map((y) => top0 - y);
    const speed = (b - a) / (Math.sqrt(240) - Math.sqrt(120));
    const want = slope * Math.sqrt(240);
    console.log(`test 41 (melting, 1 mm): front ${(b * 1000).toFixed(3)} mm after 4 min, Neumann ${(want * 1000).toFixed(3)} mm (${(100 * (b / want - 1)).toFixed(1)} %); speed ${(100 * (speed / slope - 1)).toFixed(1)} %; energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(b / want - 1)).toBeLessThan(0.05);
    expect(Math.abs(speed / slope - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  }, LONG);

  it('freezing front on ice at −20 °C: after 2 minutes within 5 % of Neumann', () => {
    const { scene: sc, slope } = stefanFreeze('very-high');
    const e = new Engine(sc, { insulated: true });
    const top0 = e.bodies.list[0].y + e.bodies.list[0].bounds(0)[3];
    const [s] = frontAt(e, [120]).map((y) => y - top0);
    const want = slope * Math.sqrt(120);
    console.log(`test 41 (freezing, 1 mm): front ${(s * 1000).toFixed(3)} mm after 2 min, Neumann ${(want * 1000).toFixed(3)} mm (${(100 * (s / want - 1)).toFixed(1)} %); energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(s / want - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  }, LONG);
});

describe('M3b — test 43 with enough salt: a cooling mixture', () => {
  it('a 2 cm cube at −10 °C in 25 % brine at −10 °C melts and drives the brine below −18 °C toward the eutectic, never below it; within 0.5 K of T_f(w) after 3 minutes', () => {
    const e = new Engine(iceInBrine(0.25, -10, -10, 0.02), { insulated: true });
    /* Das kälteste Teilchen nach jedem Schritt (ein Teilchen, das Schmelzwasser aufnimmt, kühlt beim Verdünnen ein wenig: das Mischen starker Sole nimmt Wärme auf). */
    let coldest = Infinity;
    while (e.time < 180) {
      e.step();
      coldest = Math.min(coldest, liquidState(e).Tmin);
    }
    const L = liquidState(e);
    const Tf = freezingPoint(L.salt / (L.water * M_S));
    console.log(`test 43 (eutectic): brine ${(L.T - 273.15).toFixed(2)} °C, coldest particle ${(coldest - 273.15).toFixed(3)} °C, w ${(100 * L.salt / (L.salt + L.water)).toFixed(2)} %, T_f(w) ${(Tf - 273.15).toFixed(2)} °C, eutectic ${(T_EUTECTIC - 273.15).toFixed(1)} °C, melted ${(e.melt.melted * 1000).toFixed(3)} g; salt error ${e.saltError().toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J`);
    expect(L.T).toBeLessThan(273.15 - 18);
    expect(coldest).toBeGreaterThan(T_EUTECTIC - 0.05);
    expect(Math.abs(L.T - Tf)).toBeLessThan(0.5);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * L.salt);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  }, LONG);
});
