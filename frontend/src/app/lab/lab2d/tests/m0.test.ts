/**
 * LABOR 2D (v2) — M0: das Gerüst. Stoffdaten und IF97 gegen die Prüfwerte der
 * Normen, die drei Speicher, Szenen, die Handgriffe, eine Schleife mit Zeiten
 * je Stufe, Determinismus.
 */

import { describe, expect, it } from 'vitest';

import { Bubbles } from '../engine/bubbles';
import { Engine } from '../engine/engine';
import { pSat, rhoLiquidSat, rhoVapourSat, tSat } from '../engine/if97';
import { data, diffVapour, gasTemperature, hGas, hL, hLV, rhoL, sigma, solidIndex, tFromHL } from '../engine/materials';
import { Particles } from '../engine/particles';
import { readScene, writeScene } from '../engine/scene';
import { STAGES } from '../engine/stages';
import { LIQUID, N2, O2, H2O, SOLID, T0 } from '../engine/units';
import { LAB2D_PRESETS } from '../presets';
import fixture from '../../../../../scripts/fixtures/lab2d-wrzenie.json';
import { boilingScene, scene, waterTolerance } from './scenes';

describe('M0 — materials and IAPWS-IF97', () => {
  it('reproduces the IF97 verification values of region 4 (R7-97(2012), tables 35 and 36)', () => {
    expect(pSat(300) / 0.353658941e4).toBeCloseTo(1, 8);
    expect(pSat(500) / 0.263889776e7).toBeCloseTo(1, 8);
    expect(pSat(600) / 0.123443146e8).toBeCloseTo(1, 8);
    expect(tSat(0.1e6)).toBeCloseTo(372.755919, 5);
    expect(tSat(1e6)).toBeCloseTo(453.035632, 5);
    expect(tSat(10e6)).toBeCloseTo(584.149488, 5);
  });

  it('gives the saturated densities of IAPWS SR1-86 near 100 °C', () => {
    /* IAPWS-95 tables at 373.15 K: ρ' = 958.35, ρ'' = 0.5982 kg/m³. */
    expect(rhoLiquidSat(373.15)).toBeCloseTo(958.35, 0);
    expect(rhoVapourSat(373.15)).toBeCloseTo(0.598, 2);
  });

  it('has the liquid properties of water at the textbook values', () => {
    expect(rhoL(T0 + 20)).toBeCloseTo(998.2, 1);
    expect(rhoL(T0 + 90)).toBeCloseTo(965.3, 1);
    /* Maximum of the density near 4 °C. */
    let best = 0;
    let at = 0;
    for (let t = 0; t <= 10; t += 0.01) { const r = rhoL(T0 + t); if (r > best) { best = r; at = t; } }
    expect(at).toBeGreaterThan(3.8);
    expect(at).toBeLessThan(4.2);
    expect(sigma(T0 + 100)).toBeCloseTo(0.05891, 4);
    expect(hLV(T0 + 100)).toBeCloseTo(2256.4e3, -1);
    expect(diffVapour(T0 + 20, 101325)).toBeCloseTo(2.475e-5, 7);
  });

  it('inverts the enthalpy closures exactly', () => {
    for (const T of [273.2, 290, 330.33, 373.15, 400, 425]) expect(tFromHL(hL(T))).toBeCloseTo(T, 9);
    const mN = 3e-5, mO = 1e-5, mV = 2e-6;
    for (const T of [260, 293.15, 373.15, 450]) {
      const H = mN * hGas(N2, T) + mO * hGas(O2, T) + mV * hGas(H2O, T);
      expect(gasTemperature(mN, mO, mV, H)).toBeCloseTo(T, 9);
    }
  });

  it('cites a source for every value in materials.json', () => {
    const keys = new Set(Object.keys(data.sources));
    const walk = (v: unknown, path: string): void => {
      if (v === null || typeof v !== 'object') return;
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
      const o = v as Record<string, unknown>;
      if ('src' in o) { expect(keys.has(String(o.src)), `${path}: source "${String(o.src)}"`).toBe(true); return; }
      for (const [k, x] of Object.entries(o)) if (k !== 'sources') walk(x, `${path}.${k}`);
    };
    walk(data, '');
  });
});

describe('M0 — the three stores', () => {
  it('adds and removes liquid particles with stable ids', () => {
    const P = new Particles(8);
    const a = P.add(0.01, 0.01, 1e-6, hL(300), 0);
    const b = P.add(0.02, 0.01, 1e-6, hL(310), 0);
    expect(P.count).toBe(2);
    const idB = P.id[b];
    P.remove(a);
    expect(P.count).toBe(1);
    expect(P.find(idB)).toBe(0);
    expect(P.T[0]).toBeCloseTo(310, 6);
  });

  it('adds and removes bubbles', () => {
    const B = new Bubbles(4);
    const a = B.add(0.01, 0.02, 0.005);
    B.add(0.02, 0.02, 0.005);
    B.m[a * 6 + H2O] = 1e-9;
    expect(B.totalMass(a)).toBeCloseTo(1e-9, 15);
    B.remove(a);
    expect(B.count).toBe(1);
  });
});

describe('M0 — scenes, painting, the loop', () => {
  it('reads and writes a scene without loss', () => {
    const raw = boilingScene();
    const once = writeScene(readScene(raw).scene);
    const twice = writeScene(readScene(once).scene);
    expect(twice).toEqual(once);
    expect(readScene(raw).warnings).toEqual([]);
  });

  it('reads the scenes of the presets and of the page fixture (scripts/fixtures/lab2d-wrzenie.json) without a warning', () => {
    const page = fixture as { modules: { kind: string; config: { scene?: unknown } }[] };
    const scenes = [...LAB2D_PRESETS.map((p) => p.scene), ...page.modules.filter((m) => m.kind === 'lab2d').map((m) => m.config.scene)];
    expect(scenes.length).toBe(LAB2D_PRESETS.length + 4);
    for (const raw of scenes) {
      const { scene, warnings } = readScene(raw);
      expect(warnings).toEqual([]);
      const e = new Engine(scene);
      expect(e.warnings).toEqual([]);
    }
  });

  it('paints water as four particles per cell, apparatus as bodies of exact rectangles', () => {
    const e = new Engine(boilingScene());
    const g = e.grid;
    let solid = 0;
    let liquid = 0;
    for (let c = 0; c < g.n; c += 1) {
      if (g.kind[c] === SOLID) solid += 1;
      if (g.kind[c] === LIQUID) liquid += 1;
    }
    /* Die Heizplatte: ein Rechteck 12 × 0,8 cm mit Heizung, innere Zellen etwa Δx; die Zlewka: Boden und zwei Wände. */
    const plate = e.bodies.list.find((b) => b.heater >= 0);
    const beaker = e.bodies.list.find((b) => b.heater < 0);
    const heater = plate?.ncell ?? 0;
    expect(heater).toBe(60 * 4);
    expect(beaker?.nr).toBe(3);
    expect(solid).toBeGreaterThan(heater);
    expect(liquid).toBeGreaterThan(700);
    expect(e.particles.count / liquid).toBeGreaterThan(3.5);
    expect(e.particles.count / liquid).toBeLessThan(4.5);
    /* 20 °C water at 998,2 kg/m³: mass of the painted region. */
    const mass = e.waterTemperature().mass;
    expect(mass).toBeGreaterThan(0.03);
  });

  it('erases particles and solids, and refuses a liquid without a free surface', () => {
    const e = new Engine(scene({
      sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' },
      ops: [{ op: 'beaker', x: 0.1, y: 0, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 20, lid: true }]
    }));
    const warning = e.apply({ op: 'fill', region: { rect: [0.07, 0.0, 0.13, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T: 293.15 });
    expect(warning).toMatch(/refused/);
    expect(e.particles.count).toBe(0);
    e.apply({ op: 'fill', region: { rect: [0.077, 0.002, 0.123, 0.02] }, composition: { H2O: 1 }, phase: 'liquid', T: 293.15 });
    expect(e.particles.count).toBeGreaterThan(0);
    e.apply({ op: 'erase', region: { rect: [0, 0, 0.2, 0.15] } });
    expect(e.particles.count).toBe(0);
    let solid = 0;
    for (let c = 0; c < e.grid.n; c += 1) if (e.grid.solid[c] !== 0) solid += 1;
    expect(solid).toBe(0);
  });

  it('moves a beaker with its water and a hot plate with its heater, and the budgets stay closed', () => {
    const e = new Engine(boilingScene());
    for (let k = 0; k < 20; k += 1) e.step();
    const g = e.grid;
    const count = e.particles.count;
    const GLASS = solidIndex('glass') + 1;
    /* Genaue Rechtecke: die bedeckte Fläche bleibt (die Zahl der festen Zellen nicht — eine halb bedeckte Zelle am Fuss ist neben der Platte fest, in der Luft frei). */
    const coverOf = (): number => { let a = 0; for (let c = 0; c < g.n; c += 1) if (g.matB[c] === GLASS) a += g.fs[c]; return a; };
    const glass = coverOf();
    const x0 = e.particles.x[0];
    /* Die Zlewka (Aussenrechteck) samt Wasser 2 cm nach links und 1 cm hinauf; die Heizplatte 1 cm nach rechts. */
    e.apply({ op: 'move', region: { rect: [0.065, 0.008, 0.135, 0.088] }, dx: -0.02, dy: 0.01 });
    expect(e.particles.count).toBe(count);
    expect(e.particles.x[0]).toBeCloseTo(x0 - 0.02, 6);
    expect(coverOf()).toBeCloseTo(glass, 9);
    e.apply({ op: 'move', region: { rect: [0.04, 0, 0.16, 0.008] }, dx: 0.01, dy: 0 });
    const plate = e.bodies.list.find((b) => b.heater >= 0 && !b.gone);
    expect(plate?.ncell).toBe(60 * 4);
    expect(e.stats().heaters.length).toBe(1);
    const box = new Float64Array(4);
    plate?.worldBox(plate.x, plate.y, plate.a, box);
    expect(box[2]).toBeCloseTo(0.17, 9);
    for (let k = 0; k < 20; k += 1) e.step();
    const s = e.stats();
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
    expect(Math.abs(s.energyError)).toBeLessThan(1e-6 * Math.max(1, s.flows.heater));
    /* Der Handgriff steht in der Szene und lässt sich wieder lesen. */
    const again = readScene(writeScene(e.scene)).scene;
    expect(again.ops.filter((op) => op.op === 'move').length).toBe(2);
  });

  it('keeps the energy budget closed when a side or a lid seals or opens a region (U = H − p0·V is booked as an edit)', () => {
    const e = new Engine(boilingScene());
    for (let k = 0; k < 10; k += 1) e.step();
    e.setBoundary('top', 'wall');
    for (let k = 0; k < 10; k += 1) e.step();
    e.apply({ op: 'solid', region: { rect: [0.065, 0.086, 0.135, 0.088] }, material: 'glass', T: 293.15 });
    for (let k = 0; k < 10; k += 1) e.step();
    e.setBoundary('top', 'open');
    for (let k = 0; k < 10; k += 1) e.step();
    const s = e.stats();
    expect(Math.abs(s.energyError)).toBeLessThan(1e-6 * Math.max(1, s.flows.heater));
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
  });

  it('runs the nine stages with a time for each, and keeps every number finite', () => {
    const e = new Engine(boilingScene());
    for (let k = 0; k < 40; k += 1) e.step();
    const s = e.stats();
    expect(s.stages.length).toBe(STAGES.length);
    expect(STAGES).toEqual(['inputs', 'liquid', 'gas', 'bubbles', 'interface', 'heat', 'chemistry', 'diagnostics', 'bodies']);
    for (const t of s.stages) expect(t).toBeGreaterThanOrEqual(0);
    for (let p = 0; p < e.particles.count; p += 1) expect(Number.isFinite(e.particles.x[p] + e.particles.vx[p] + e.particles.h[p])).toBe(true);
    for (let c = 0; c < e.grid.n; c += 1) expect(Number.isFinite(e.grid.T[c])).toBe(true);
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
    expect(Math.abs(s.energyError)).toBeLessThan(1e-6 * Math.max(1, s.flows.heater));
  });

  it('is deterministic: the same scene and the same commands give the same state, bit for bit', () => {
    const run = (): Float64Array => {
      const e = new Engine(boilingScene());
      for (let k = 0; k < 30; k += 1) e.step();
      e.apply({ op: 'fill', region: { circle: [0.1, 0.11, 0.006] }, composition: { H2O: 1 }, phase: 'liquid', T: 333.15 });
      for (let k = 0; k < 30; k += 1) e.step();
      const out = new Float64Array(3 * e.particles.count + e.grid.n);
      for (let p = 0; p < e.particles.count; p += 1) { out[3 * p] = e.particles.x[p]; out[3 * p + 1] = e.particles.y[p]; out[3 * p + 2] = e.particles.h[p]; }
      for (let c = 0; c < e.grid.n; c += 1) out[3 * e.particles.count + c] = e.grid.T[c];
      return out;
    };
    expect(run()).toEqual(run());
  });
});
