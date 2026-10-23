/**
 * LABOR 2D (v2) — B, die lange Prüfung: wie gross wird ein Nachweis je
 * Minute Simulationszeit, und wie schnell backt er? Die Szene des
 * Meilensteins (Wrzenie: Zlewka mit Siedesteinen, 98 °C, 20 × 15 cm) eine
 * Minute bei 2 mm. Die Grenze ist aus der Messung gesetzt (MILESTONES.md §B).
 */

import { describe, expect, it } from 'vitest';

import { Baker, canonicalScene, clipKey } from '../clip/clip';
import { Charts } from '../engine/charts';
import { Engine } from '../engine/engine';
import { LAB2D_PRESETS } from '../presets';

describe('B — test 34: the size of a clip per simulated minute', () => {
  it('one minute of the boiling beaker at 2 mm: at most 40 MB per minute (frames and keyframes), all frames and keyframes there', async () => {
    const preset = LAB2D_PRESETS.find((p) => p.key === 'wrzenie');
    if (preset === undefined) throw new Error('preset wrzenie');
    const e = new Engine(preset.scene);
    const charts = new Charts(e);
    const sc = canonicalScene(e.serialize());
    const b = new Baker(e, charts, sc, await clipKey(sc), 60);
    const t0 = performance.now();
    /* Zwischen den Scheiben die Ereignisschleife frei geben: sonst wartet Vitests RPC des Arbeiters („onTaskUpdate“) minutenlang und meldet einen Fehler. */
    while (!b.run(2000)) await new Promise((r) => setTimeout(r, 0));
    const ms = performance.now() - t0;
    const baked = await b.finish();
    if (baked === null) throw new Error('nothing baked');
    const h = baked.header;
    const frames = baked.chunks.reduce((s, c) => s + c.length, 0);
    const keys = baked.keys.reduce((s, c) => s + c.length, 0);
    const perMinute = ((frames + keys) / h.duration) * 60;
    console.log(`test 34: ${h.frames} frames in ${baked.chunks.length} chunks, ${(frames / 1e6).toFixed(2)} MB (${(frames / h.frames / 1e3).toFixed(1)} kB per frame); ${baked.keys.length} keyframes, ${(keys / 1e6).toFixed(2)} MB (${(keys / baked.keys.length / 1e3).toFixed(0)} kB each); ${(perMinute / 1e6).toFixed(1)} MB per simulated minute; baked in ${(ms / 1000).toFixed(0)} s (${(h.duration / (ms / 1000)).toFixed(2)}× real time)`);
    expect(h.frames).toBe(60 * 30 + 1);
    expect(baked.keys.length).toBe(13);
    expect(perMinute).toBeLessThan(40e6);
  });
});
