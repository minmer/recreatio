/**
 * PARTIKEL-LABOR — Prüfungen für M0 (das Gerüst): Stoffdatenbank, Speicher
 * mit freien Plätzen, Nachbarsuche gegen rohe Gewalt, Szene hin und zurück,
 * Determinismus, ein stabiler Lauf. Kopflos in Node: `npm run test:particles`.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { Grid, MAX_NBR } from '../engine/grid';
import { Kernels, latticeSum, pressureScale } from '../engine/kernels';
import { Mem } from '../engine/mem';
import { JOB_SEARCH, P_A0, P_EPS, P_GNX, P_GNY, P_H, P_H2, P_KD, P_KS, P_N, P_W0, PARAMS, runJob, viewsOf } from '../engine/solver';
import { EMPTY_SCENE, QUALITIES, SPACING, readScene, writeScene } from '../engine/scene';
import { CP, L_BOIL, enthalpy, liquidDensity, psat, spIndex, tsat, unsourced } from '../engine/species';
import { Store } from '../engine/store';
import { GAS, LIQUID, P_ATM, T0 } from '../engine/units';
import { BOILING_SCENE, SANDBOX_PARTICLES } from '../particlePresets';

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
    const st = new Store(8, new Mem(false));
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
    const st = new Store(2, new Mem(false));
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
    const mem = new Mem(false);
    const st = new Store(n, mem);
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let k = 0; k < n; k += 1) { const i = st.spawn(); st.px[i] = st.x[i] = rnd() * 0.1; st.py[i] = st.y[i] = rnd() * 0.08; st.area[i] = 2e-6; st.wInv[i] = 1; }
    st.kill(17);
    st.kill(300);
    const h = 0.005;
    const g = new Grid(n, -0.01, -0.01, 0.12, 0.1, h / 2, mem);
    g.build(st, true);
    const k = new Kernels(h, 2);
    const P = new Float64Array(PARAMS);
    P[P_H] = h; P[P_H2] = h * h; P[P_KS] = k.ks; P[P_KD] = k.kd; P[P_W0] = k.w0; P[P_EPS] = 1; P[P_A0] = 2e-6;
    P[P_GNX] = g.nx; P[P_GNY] = g.ny; P[P_N] = g.n;
    runJob(JOB_SEARCH, viewsOf(st, g), P, 0, g.n);
    expect(g.n).toBe(n - 2);
    for (let i = 0; i < n; i += 1) {
      if (st.alive[i] === 0) continue;
      const want: number[] = [];
      for (let j = 0; j < n; j += 1) if (j !== i && st.alive[j] === 1 && (st.x[i] - st.x[j]) ** 2 + (st.y[i] - st.y[j]) ** 2 < h * h) want.push(j);
      const got = Array.from(g.nbrList.subarray(i * MAX_NBR, i * MAX_NBR + g.nbrCount[i])).sort((p, q) => p - q);
      expect(got).toEqual(want);
    }
  });

  it('the density kernel on the lattice gives the rest area of a particle; the pressure scale follows from it', () => {
    const s = 0.0025;
    /* poly6: ≈ s². spiky (the kernel of the solver): its own point weighs 62 %, the rest area is ≈ 0.785·s². */
    expect(1 / latticeSum(new Kernels(2 * s, 0), s) / (s * s)).toBeCloseTo(0.9856, 3);
    const k = new Kernels(2 * s, 2);
    const area = 1 / latticeSum(k, s);
    expect(area / (s * s)).toBeCloseTo(0.785, 2);
    /* The discrete gradient sees a pressure 1.83 times too weakly with these areas (kernels.ts, pressureScale). */
    expect(pressureScale(k, s, area)).toBeCloseTo(1.83, 2);
  });
});

describe('scene and engine', () => {
  it('quality: very high (2 mm) is the default; medium is the coarsest; an unknown level falls back with a warning', () => {
    expect(EMPTY_SCENE.quality).toBe('very-high');
    expect(QUALITIES).toEqual(['very-high', 'high', 'medium']);
    expect(QUALITIES.map((q) => SPACING[q])).toEqual([0.002, 0.0025, 0.003]);
    expect(readScene({}).scene.quality).toBe('very-high');
    expect(readScene({ quality: 'medium' }).warnings).toEqual([]);
    const old = readScene({ quality: 'low' });
    expect(old.scene.quality).toBe('very-high');
    expect(old.warnings).toHaveLength(1);
  });

  it('a quality change rebuilds the same layout in other particles (water mass within the lattice error)', () => {
    const scene = readScene({ ...SANDBOX_PARTICLES, ops: [{ op: 'fill', region: { rect: [0.05, 0.05, 0.11, 0.09] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }] }).scene;
    const e = new Engine(scene);
    const water = e.totalMass(H2O);
    const fine = e.stats().liquid;
    e.setQuality('medium');
    expect(e.quality).toBe('medium');
    expect(e.s).toBe(0.003);
    expect(e.serialize().ops).toEqual(writeScene(scene).ops);
    /* The same rectangle of water: the mass differs only by the lattice at its edges. (In a beaker it differs more:
       walls are at least two particles thick, 6 mm at medium against 4 mm at very high.) */
    expect(e.totalMass(H2O) / water).toBeGreaterThan(0.93);
    expect(e.totalMass(H2O) / water).toBeLessThan(1.07);
    /* (2 mm / 3 mm)² as many particles, give or take the edges. */
    expect(e.stats().liquid / fine).toBeGreaterThan(0.38);
    expect(e.stats().liquid / fine).toBeLessThan(0.5);
  });

  it('an empty box holds only its glass walls: air without particles until something is placed (or a box full of air)', () => {
    const e = new Engine(EMPTY_SCENE);
    const st = e.stats();
    /* Two layers on the left, right and bottom, corners included; the air is all ambient (band.ts). */
    expect(st.fixed).toBe(2 * 2 * (e.ny + 2) + 2 * (e.nx + 4));
    expect(st.gas).toBe(0);
    expect(st.liquid).toBe(0);
    const full = new Engine(EMPTY_SCENE, { airBand: false }).stats();
    expect(full.gas).toBe(e.nx * e.ny);
    expect(full.air).toBe(e.nx * e.ny);
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
    console.log(`step (${e.quality}): ${ms.toFixed(3)} ms for ${st.count} particles (PBF, one thread, Node)`);
  });
});
