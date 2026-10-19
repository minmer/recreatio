/**
 * PARTIKEL-LABOR — Prüfungen für M1a (Mechanik): die Tore 1–3 des Auftrags
 * (ARCHITECTURE.md §11) — Ruhe, Hydrostatik, Auftrieb — und was sie trägt:
 * die Eichung der Oberflächenspannung, der Saum der Luft mit seinen
 * Bilanzen, und dass Stücke (Fäden) das Ergebnis nicht ändern. Die zehn
 * Minuten von Tor 1 laufen in `m1a.slow.test.ts` (`npm run test:particles:slow`).
 * Kopflos in Node: `npm run test:particles`.
 */

import { describe, expect, it } from 'vitest';

import { RADIUS } from '../engine/band';
import { Engine } from '../engine/engine';
import { SerialRunner } from '../engine/runner';
import { readScene, type Quality } from '../engine/scene';
import { spIndex } from '../engine/species';
import { ORIGIN_AIR } from '../engine/store';
import { GAS, LIQUID } from '../engine/units';
import { BOILING_SCENE, SANDBOX_PARTICLES } from '../particlePresets';
import { settled } from './measure';

const H2O = spIndex('H2O');

const scene = (box: { w: number; h: number }, quality: Quality, ops: readonly Record<string, unknown>[], g = 9.81) =>
  readScene({ ...SANDBOX_PARTICLES, box: { ...box, depth: 0.01 }, ambient: { p: 101.325, T: 20, g }, quality, ops }).scene;

const water = (rect: readonly number[]) => ({ op: 'fill', region: { rect }, composition: { H2O: 1 }, phase: 'liquid', T: 20 });

/** Mittelpunkt der Partikeln, die `pick` wählt. */
function centroid(e: Engine, pick: (i: number) => boolean): { x: number; y: number; n: number } {
  const st = e.store;
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = 0; i < st.highWater; i += 1) {
    if (st.alive[i] === 0 || st.fixed[i] === 1 || !pick(i)) continue;
    x += st.x[i];
    y += st.y[i];
    n += 1;
  }
  return { x: x / n, y: y / n, n };
}

describe('gate 1 — stability (short; ten minutes in m1a.slow.test.ts)', () => {
  it('water under air settles: 60 s, no explosion, nothing lost, a flat surface, at rest', () => {
    const e = new Engine(scene({ w: 0.06, h: 0.06 }, 'medium', [water([0, 0, 0.06, 0.025])]));
    const mass0 = e.totalMass(H2O);
    e.advance(60);
    const r = settled(e);
    expect(r.finite).toBe(true);
    expect(e.totalMass(H2O)).toBeCloseTo(mass0, 12);
    expect(r.surfaceStd).toBeLessThan(0.25 * e.s);
    expect(r.vmax).toBeLessThan(0.05);
    expect(r.rms).toBeLessThan(0.01);
    expect(Math.abs(r.meanDensity - 1)).toBeLessThan(0.02);
    console.log(`gate 1 (60 s, medium): surface σ ${(r.surfaceStd * 1e3).toFixed(3)} mm, v_max ${(r.vmax * 100).toFixed(2)} cm/s, v_rms ${(r.rms * 100).toFixed(2)} cm/s, density ${r.meanDensity.toFixed(4)}`);
  });
});

describe('gate 2 — hydrostatics', () => {
  for (const [quality, depth] of [['medium', 0.06], ['very-high', 0.05]] as const) {
    it(`pressure rises 98 Pa per cm of water depth (±10 %) — ${quality}`, () => {
      const e = new Engine(scene({ w: 0.06, h: 0.1 }, quality, [water([0, 0, 0.06, depth])]));
      const st = e.store;
      e.advance(2);
      /* Druck über eine Sekunde, in Schichten von 5 mm. */
      const bins = new Map<number, { p: number; y: number; n: number }>();
      for (let k = 0; k < 240; k += 1) {
        e.step();
        for (let i = 0; i < st.highWater; i += 1) {
          if (st.alive[i] === 0 || st.fixed[i] === 1 || st.phase[i] !== LIQUID) continue;
          const b = Math.floor(st.y[i] / 0.005);
          const cur = bins.get(b) ?? { p: 0, y: 0, n: 0 };
          cur.p += st.pres[i];
          cur.y += st.y[i];
          cur.n += 1;
          bins.set(b, cur);
        }
      }
      /* Kleinste Quadrate über die inneren Schichten (ohne die am Boden und an der Oberfläche). */
      const rows = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => [v.y / v.n, v.p / v.n] as const).slice(1, -1);
      const n = rows.length;
      const sx = rows.reduce((a, [y]) => a + y, 0);
      const sy = rows.reduce((a, [, p]) => a + p, 0);
      const sxx = rows.reduce((a, [y]) => a + y * y, 0);
      const sxy = rows.reduce((a, [y, p]) => a + y * p, 0);
      const perCm = -((n * sxy - sx * sy) / (n * sxx - sx * sx)) / 100;
      const expected = (998.2 * 9.81) / 100;
      console.log(`gate 2 (${quality}): ${perCm.toFixed(1)} Pa/cm (expected ${expected.toFixed(1)})`);
      expect(perCm).toBeGreaterThan(0.9 * expected);
      expect(perCm).toBeLessThan(1.1 * expected);
    });
  }
});

describe('gate 3 — buoyancy', () => {
  it('a vapour blob in water rises', () => {
    const e = new Engine(scene({ w: 0.06, h: 0.1 }, 'medium', [
      water([0, 0, 0.06, 0.05]),
      { op: 'fill', region: { circle: [0.03, 0.012, 0.006] }, composition: { H2O: 1 }, phase: 'gas', T: 100 }
    ]));
    const st = e.store;
    const vapour = (i: number) => st.phase[i] === GAS && st.dom[i] === H2O;
    const y0 = centroid(e, vapour).y;
    e.advance(0.5);
    const y1 = centroid(e, vapour).y;
    console.log(`gate 3: vapour blob rose ${((y1 - y0) * 100).toFixed(1)} cm in 0.5 s`);
    expect(y1 - y0).toBeGreaterThan(0.02);
  });

  it('a water droplet in air falls — slower than in vacuum', () => {
    const e = new Engine(scene({ w: 0.06, h: 0.12 }, 'medium', [{ op: 'fill', region: { circle: [0.03, 0.08, 0.005] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }]));
    const st = e.store;
    const drop = (i: number) => st.phase[i] === LIQUID;
    const y0 = centroid(e, drop).y;
    e.advance(0.1);
    const fell = y0 - centroid(e, drop).y;
    const vacuum = 0.5 * 9.81 * 0.1 * 0.1;
    console.log(`gate 3: droplet fell ${(fell * 100).toFixed(1)} cm in 0.1 s (vacuum ${(vacuum * 100).toFixed(1)} cm)`);
    expect(fell).toBeGreaterThan(0.4 * vacuum);
    expect(fell).toBeLessThan(vacuum);
  });
});

describe('surface tension (calibration)', () => {
  it('a water disc in zero gravity: the pressure jump is σ/R (±25 %)', () => {
    const R = 0.01;
    const e = new Engine(scene({ w: 0.08, h: 0.08 }, 'medium', [{ op: 'fill', region: { circle: [0.04, 0.04, R] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }], 0));
    const st = e.store;
    e.advance(1);
    let pin = 0;
    let nin = 0;
    let pout = 0;
    let nout = 0;
    for (let k = 0; k < 240; k += 1) {
      e.step();
      const c = centroid(e, (i) => st.phase[i] === LIQUID);
      for (let i = 0; i < st.highWater; i += 1) {
        if (st.alive[i] === 0 || st.fixed[i] === 1) continue;
        const d = Math.hypot(st.x[i] - c.x, st.y[i] - c.y);
        if (st.phase[i] === LIQUID && d < 0.5 * R) { pin += st.pres[i]; nin += 1; }
        if (st.phase[i] === GAS && d > R + 2 * e.s && d < R + 4 * e.s) { pout += st.pres[i]; nout += 1; }
      }
    }
    const n = centroid(e, (i) => st.phase[i] === LIQUID).n;
    const r = Math.sqrt((n * e.s * e.s) / Math.PI);
    const ratio = (pin / nin - pout / nout) / (0.07275 / r);
    console.log(`surface tension: Laplace pressure / (σ/R) = ${ratio.toFixed(2)}`);
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.25);
  });
});

describe('air only where it matters (band.ts)', () => {
  it('air particles surround the water, the rest of the box is ambient air; exchanged air is booked', () => {
    const e = new Engine(scene({ w: 0.1, h: 0.1 }, 'medium', [water([0.04, 0, 0.06, 0.02])]));
    const st = e.store;
    const sum = () => {
      let m = 0;
      for (let i = 0; i < st.highWater; i += 1) if (st.alive[i] === 1 && st.fixed[i] === 0 && st.origin[i] === ORIGIN_AIR) m += st.mass[i];
      return m;
    };
    const s0 = e.stats();
    const ledger0 = sum() - e.airInMass + e.airOutMass;
    expect(s0.air).toBeGreaterThan(50);
    expect(s0.air).toBeLessThan(0.5 * e.nx * e.ny);
    e.advance(2);
    /* No air far from the water (it spread over the floor): every explicit air particle lies within the band — RADIUS cells, diagonally, plus one. */
    const reach = (RADIUS + 1) * Math.SQRT2 * e.h;
    let far = 0;
    for (let i = 0; i < st.highWater; i += 1) {
      if (st.alive[i] === 0 || st.origin[i] !== ORIGIN_AIR) continue;
      let near = false;
      for (let j = 0; j < st.highWater && !near; j += 1) {
        if (st.alive[j] === 1 && st.phase[j] === LIQUID && Math.hypot(st.x[i] - st.x[j], st.y[i] - st.y[j]) < reach) near = true;
      }
      if (!near) far += 1;
    }
    expect(far).toBe(0);
    /* Air in particles plus what went back minus what came: constant. */
    expect(sum() - e.airInMass + e.airOutMass).toBeCloseTo(ledger0, 12);
  });

  it('the band costs a fraction of a box full of air', () => {
    const banded = new Engine(readScene(BOILING_SCENE).scene).stats();
    const full = new Engine(readScene(BOILING_SCENE).scene, { airBand: false }).stats();
    console.log(`band: ${banded.gas} air particles instead of ${full.gas}`);
    expect(banded.gas).toBeLessThan(0.25 * full.gas);
  });
});

describe('threads change nothing', () => {
  it('kernels computed in seven pieces, backwards, give bit-identical results', () => {
    const run = (runner: SerialRunner) => {
      const e = new Engine(readScene({ ...BOILING_SCENE, quality: 'medium' }).scene, { runner });
      e.apply({ op: 'fill', region: { circle: [0.06, 0.12, 0.01] }, composition: { H2O: 1 }, phase: 'liquid', T: 293.15 });
      e.advance(0.25);
      return [Array.from(e.store.x.subarray(0, e.store.highWater)), Array.from(e.store.vy.subarray(0, e.store.highWater))];
    };
    expect(run(new SerialRunner(7, true))).toEqual(run(new SerialRunner()));
  });
});

describe('cost (measured, not a gate)', () => {
  it('logs ms per step of the boiling scene at each quality (one thread, Node)', () => {
    for (const q of ['medium', 'high', 'very-high'] as const) {
      const e = new Engine(readScene({ ...BOILING_SCENE, quality: q }).scene);
      e.advance(0.5);
      const t0 = performance.now();
      e.advance(0.5);
      const ms = (performance.now() - t0) / 120;
      const s = e.stats();
      console.log(`cost ${q}: ${ms.toFixed(2)} ms per step, ${s.liquid + s.gas} moving + ${s.fixed} fixed particles, ${s.substeps} substeps`);
      expect(Number.isFinite(ms)).toBe(true);
    }
  });
});
