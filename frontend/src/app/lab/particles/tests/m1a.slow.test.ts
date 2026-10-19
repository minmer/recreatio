/**
 * PARTIKEL-LABOR — Tor 1 in voller Länge: Wasser unter Luft, zehn simulierte
 * Minuten. Läuft nicht mit `app:check` (gut eine Minute), sondern mit
 * `npm run test:particles:slow`.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { readScene } from '../engine/scene';
import { spIndex } from '../engine/species';
import { SANDBOX_PARTICLES } from '../particlePresets';
import { settled } from './measure';

const H2O = spIndex('H2O');

describe('gate 1 — stability, ten simulated minutes', () => {
  it('water under air: no explosion, nothing lost, a flat surface, at rest', () => {
    const e = new Engine(readScene({
      ...SANDBOX_PARTICLES, box: { w: 0.05, h: 0.05, depth: 0.01 }, quality: 'medium',
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.05, 0.02] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }]
    }).scene);
    const mass0 = e.totalMass(H2O);
    const t0 = performance.now();
    for (let minute = 1; minute <= 10; minute += 1) {
      e.advance(60);
      const r = settled(e);
      console.log(`minute ${minute}: surface σ ${(r.surfaceStd * 1e3).toFixed(3)} mm, v_max ${(r.vmax * 100).toFixed(2)} cm/s, density ${r.meanDensity.toFixed(4)}, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
      expect(r.finite).toBe(true);
    }
    const r = settled(e);
    expect(e.totalMass(H2O)).toBeCloseTo(mass0, 12);
    expect(r.surfaceStd).toBeLessThan(0.25 * e.s);
    expect(r.vmax).toBeLessThan(0.05);
    expect(r.rms).toBeLessThan(0.01);
    expect(Math.abs(r.meanDensity - 1)).toBeLessThan(0.02);
  });
});
