/**
 * PARTIKEL-LABOR — Prüfungen für M0 (das Gerüst): Stoffdatenbank, Speicher
 * mit freien Plätzen, Nachbargitter gegen rohe Gewalt, Szene hin und zurück,
 * Determinismus, ein stabiler Lauf. Kopflos in Node: `npm run test:particles`.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { Grid, MAX_NBR } from '../engine/grid';
import { Kernels, latticeSum } from '../engine/kernels';
import { EMPTY_SCENE, readScene, writeScene } from '../engine/scene';
import { CP, L_BOIL, enthalpy, liquidDensity, psat, spIndex, tsat, unsourced } from '../engine/species';
import { Store } from '../engine/store';
import { GAS, LIQUID, P_ATM, T0 } from '../engine/units';
import { BOILING_SCENE } from '../particlePresets';

const H2O = spIndex('H2O');

describe('species database', () => {
  it('every number has a known source', () => {
    expect(unsourced()).toEqual([]);
  });

  it('Antoine: 760 mmHg boils at 100.0 °C, and the inverse agrees', () => {
    expect(tsat(H2O, P_ATM) - T0).toBeCloseTo(100.0, 1);
    expect(psat(H2O, T0 + 100) / P_ATM).toBeCloseTo(1, 2);
    /* 70 kPa (a mountain at ~3000 m): about 90 °C. */
    expect(tsat(H2O, 70_000) - T0).toBeGreaterThan(89);
    expect(tsat(H2O, 70_000) - T0).toBeLessThan(91);
  });

  it('Kell: water densest near 4 °C, 958 kg/m³ at 100 °C', () => {
    expect(liquidDensity(H2O, T0 + 4)).toBeCloseTo(999.97, 1);
    expect(liquidDensity(H2O, T0 + 100)).toBeCloseTo(958.4, 0);
    expect(liquidDensity(H2O, T0 + 4)).toBeGreaterThan(liquidDensity(H2O, T0 + 0.1));
  });

  it('enthalpy curve: liquid from 0 °C, steam above it by the latent heat at 100 °C', () => {
    expect(enthalpy(H2O, LIQUID, T0 + 100)).toBeCloseTo(CP[H2O * 3 + LIQUID] * 100, 6);
    const tb = 373.124;
    expect(enthalpy(H2O, GAS, tb) - enthalpy(H2O, LIQUID, tb)).toBeCloseTo(L_BOIL[H2O], 3);
  });
});

describe('particle store', () => {
  it('spawns, kills and reuses slots without growing', () => {
    const st = new Store(8);
    const a = Array.from({ length: 8 }, () => st.spawn());
    expect(a).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(st.spawn()).toBe(-1);
    st.kill(3);
    st.kill(7);
    expect(st.count).toBe(6);
    expect(st.highWater).toBe(7);
    const b = st.spawn();
    expect(b).toBe(7);
    expect(st.uid[b]).toBeGreaterThan(st.uid[0]);
    expect(st.spawn()).toBe(3);
    expect(st.count).toBe(8);
  });

  it('keeps a composition in slots and its mass', () => {
    const st = new Store(2);
    const i = st.spawn();
    st.addSpecies(i, 0, 1e-6);
    st.addSpecies(i, 1, 3e-6);
    st.addSpecies(i, 0, 1e-6);
    expect(st.mass[i]).toBeCloseTo(5e-6, 15);
    expect(st.massOf(i, 0)).toBeCloseTo(2e-6, 15);
    expect(st.dominant(i)).toBe(1);
  });
});

describe('neighbour grid', () => {
  it('finds exactly the neighbours brute force finds', () => {
    const n = 600;
    const st = new Store(n);
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let k = 0; k < n; k += 1) { const i = st.spawn(); st.x[i] = rnd() * 0.1; st.y[i] = rnd() * 0.08; }
    st.kill(17);
    st.kill(300);
    const h = 0.005;
    const g = new Grid(n, -0.01, -0.01, 0.12, 0.1, h);
    g.build(st, false);
    g.neighbours(st, h, false);
    expect(g.n).toBe(n - 2);
    expect(g.overflow).toBe(0);
    for (let i = 0; i < n; i += 1) {
      if (st.alive[i] === 0) continue;
      const want: number[] = [];
      for (let j = 0; j < n; j += 1) if (j !== i && st.alive[j] === 1 && (st.x[i] - st.x[j]) ** 2 + (st.y[i] - st.y[j]) ** 2 < h * h) want.push(j);
      const got = Array.from(g.nbrList.subarray(i * MAX_NBR, i * MAX_NBR + g.nbrCount[i])).sort((p, q) => p - q);
      expect(got).toEqual(want);
    }
  });

  it('poly6 on the lattice gives the rest area of a particle (≈ s²)', () => {
    const s = 0.0025;
    const area = 1 / latticeSum(new Kernels(2 * s), s);
    expect(area / (s * s)).toBeGreaterThan(0.95);
    expect(area / (s * s)).toBeLessThan(1.05);
  });
});

describe('scene and engine', () => {
  it('starts as a box full of ambient air inside glass walls (open top)', () => {
    const e = new Engine(EMPTY_SCENE);
    const st = e.stats();
    expect(st.gas).toBe(e.nx * e.ny);
    /* Two layers on the left, right and bottom, corners included. */
    expect(st.fixed).toBe(2 * 2 * (e.ny + 2) + 2 * (e.nx + 4) - 0);
    expect(st.liquid).toBe(0);
  });

  it('builds the boiling layout and writes it back unchanged', () => {
    const { scene, warnings } = readScene(BOILING_SCENE);
    expect(warnings).toEqual([]);
    const e = new Engine(scene);
    const st = e.stats();
    expect(st.liquid).toBeGreaterThan(300);
    expect(e.heaters.length).toBe(1);
    expect(e.heaters[0].elements).toBeGreaterThan(20);
    const again = readScene(e.serialize());
    expect(again.warnings).toEqual([]);
    expect(writeScene(again.scene)).toEqual(e.serialize());
    expect(new Engine(again.scene).stats().liquid).toBe(st.liquid);
  });

  it('is deterministic for a seed and a command sequence', () => {
    const run = () => {
      const e = new Engine(readScene(BOILING_SCENE).scene);
      e.apply({ op: 'fill', region: { circle: [0.06, 0.12, 0.012] }, composition: { H2O: 1 }, phase: 'liquid', T: T0 + 20 });
      e.advance(0.5);
      return Array.from(e.store.y.subarray(0, e.store.highWater));
    };
    expect(run()).toEqual(run());
  });

  it('runs 2 s of a painted scene with no NaN and nothing lost through the walls', () => {
    const e = new Engine(readScene(BOILING_SCENE).scene);
    e.apply({ op: 'fill', region: { circle: [0.06, 0.12, 0.015] }, composition: { H2O: 1 }, phase: 'liquid', T: T0 + 20 });
    const water0 = e.totalMass(H2O);
    const t0 = performance.now();
    e.advance(2);
    const ms = (performance.now() - t0) / (2 / e.dt);
    const st = e.store;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0) continue;
      expect(Number.isFinite(st.x[i]) && Number.isFinite(st.y[i])).toBe(true);
    }
    /* Water cannot leave a closed beaker or the floor; only gas may escape through the open top. */
    expect(e.totalMass(H2O)).toBeCloseTo(water0, 12);
    console.log(`M0 step: ${ms.toFixed(3)} ms for ${st.count} particles (placeholder constraint, Node)`);
  });
});
