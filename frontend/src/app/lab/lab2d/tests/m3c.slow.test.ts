/**
 * LABOR 2D (v2) — M3c, langsam: der Schüttwinkel von Speisesalz (Test 49).
 * Zwei Haufen werden langsam aufgeschüttet (alle 0,05 s eine Prise über der
 * Mitte, bis 25 g liegen, dann 1 s Ruhe); gemessen wird je Seite die Gerade
 * durch das Profil zwischen 20 und 80 % der Höhe. Ein einzelner Haufen streut
 * um ±2° (die Lawinen kommen, wie sie kommen): der Test mittelt zwei.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { GRAIN_MATS } from '../engine/grains';
import { scene } from './scenes';

/** Böschungswinkel links und rechts der Spitze: je Zellspalte die Höhe des obersten Korns, Gerade durch 20–80 % der Höhe. */
function slopes(e: Engine): { left: number; right: number; peak: number } {
  const G = e.grains;
  const g = e.grid;
  const nx = g.nx;
  const h = new Float64Array(nx);
  for (let q = 0; q < G.count; q += 1) { const i = Math.min(nx - 1, Math.floor(G.x[q] / g.dx)); h[i] = Math.max(h[i], G.y[q]); }
  let peak = 0;
  for (let i = 0; i < nx; i += 1) if (h[i] > h[peak]) peak = i;
  const hmax = h[peak];
  const fit = (from: number, to: number, step: number): number => {
    let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (let i = from; i !== to; i += step) {
      if (h[i] < 0.2 * hmax || h[i] > 0.8 * hmax) continue;
      const x = (i + 0.5) * g.dx;
      sx += x; sy += h[i]; sxx += x * x; sxy += x * h[i]; n += 1;
    }
    return (Math.atan(Math.abs((n * sxy - sx * sy) / (n * sxx - sx * sx))) * 180) / Math.PI;
  };
  return { left: fit(0, peak, 1), right: fit(nx - 1, peak, -1), peak: hmax };
}

function pour(shift: number): { left: number; right: number; peak: number; saltError: number } {
  const e = new Engine(scene({ box: { w: 0.16, h: 0.08, depth: 0.01 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, ops: [] }));
  let next = 0;
  while (e.grains.totals().salt < 0.025) {
    if (e.time >= next) {
      e.apply({ op: 'grains', region: { rect: [0.078 + shift, 0.06, 0.082 + shift, 0.064] }, material: 'NaCl', d: 0.0005, T: 293.15 });
      next += 0.05;
    }
    e.step();
  }
  const end = e.time + 1;
  while (e.time < end) e.step();
  return { ...slopes(e), saltError: e.saltError() };
}

describe('M3c — test 49: the angle of repose of table salt', () => {
  it('two piles poured from above stand at 34° (±3°, the cited value for fine table salt); salt exact', () => {
    const a = pour(0.0003);
    const b = pour(0.0021);
    const mean = (a.left + a.right + b.left + b.right) / 4;
    console.log(`test 49: pile 1 ${a.left.toFixed(1)}°/${a.right.toFixed(1)}° (${(a.peak * 1000).toFixed(1)} mm high), pile 2 ${b.left.toFixed(1)}°/${b.right.toFixed(1)}° (${(b.peak * 1000).toFixed(1)} mm); mean ${mean.toFixed(1)}° (cited ${GRAIN_MATS[0].repose}°); salt errors ${a.saltError.toExponential(1)}, ${b.saltError.toExponential(1)} kg`);
    expect(Math.abs(mean - GRAIN_MATS[0].repose)).toBeLessThan(3);
    expect(Math.abs(a.saltError)).toBeLessThan(1e-15);
    expect(Math.abs(b.saltError)).toBeLessThan(1e-15);
  }, 600000);
});
