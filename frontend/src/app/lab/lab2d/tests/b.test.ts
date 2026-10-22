/**
 * LABOR 2D (v2) — B: Backen und Wiedergabe. Tore aus SANDBOX.md §13: die
 * Wiedergabe zeigt Bild für Bild, was beim Backen live zu sehen war; Spulen
 * trifft das Bild der Zeit; aus einem Schlüsselbild weitergerechnet entsteht
 * Bit für Bit derselbe Lauf wie ohne Halt; die Grösse je Minute gemessen
 * (die Grenze daraus, b.slow.test.ts).
 */

import { describe, expect, it } from 'vitest';

import { Baker, canonicalScene, clipKey, CLIP_VERSION, FPS, Player, rootOf, type Baked } from '../clip/clip';
import { OVERLAY_EVERY, unpack } from '../clip/codec';
import { layoutOf, restoreSnapshot, takeSnapshot } from '../clip/snapshot';
import { Charts } from '../engine/charts';
import { Engine } from '../engine/engine';
import { readScene } from '../engine/scene';
import { allocFrame, buildFrame, frameFromLayers, OVERLAYS, type FrameBuffers } from '../render/frame';
import { scene } from './scenes';
import scenarios from '../../../../../scripts/fixtures/lab2d-scenariusze.json';

const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;

/** Die kompakte Zlewka mit Siedesteinen auf der Heizplatte (die Szene von Test 11), knapp unter dem Sieden. */
const boiling = () => scene({
  box: { w: 0.1, h: 0.08, depth: 0.01 },
  ops: [
    { op: 'hotplate', x: 0.05, y: 0, w: 0.08, h: 0.006, material: 'steel', mode: 'power', power: 25, on: true, T: 135 },
    { op: 'beaker', x: 0.05, y: 0.006, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 108 },
    { op: 'fill', region: { rect: [0.027, 0.008, 0.073, 0.035] }, composition: { H2O: 1 }, phase: 'liquid', T: 99.9 },
    { op: 'solid', region: { rect: [0.036, 0.008, 0.040, 0.010] }, material: 'ceramic', T: 99.9 }
  ]
});

/** Szenen für das Weiterrechnen: Sieden mit Blasen, Sole bis zur Kruste, Wasser unter Öl (Viskosität), eine geschlossene Kiste mit Nebel. */
const RESUME: Record<string, { scene: () => unknown; warm: number }> = {
  boiling: { scene: boiling, warm: 480 },
  brine: {
    warm: 1200,
    scene: () => scene({
      box: { w: 0.06, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'hotplate', x: 0.03, y: 0, w: 0.06, h: 0.006, material: 'steel', mode: 'power', power: 60, on: true, T: 120 },
        { op: 'beaker', x: 0.03, y: 0.006, w: 0.03, h: 0.04, wall: 0.002, material: 'steel', T: 120 },
        { op: 'fill', region: { rect: [0.017, 0.008, 0.043, 0.012] }, composition: { H2O: 0.75, NaCl: 0.25 }, phase: 'liquid', T: 105 }
      ]
    })
  },
  oil: {
    warm: 360,
    scene: () => scene({
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'hotplate', x: 0.05, y: 0, w: 0.08, h: 0.006, material: 'steel', mode: 'power', power: 25, on: true, T: 140 },
        { op: 'beaker', x: 0.05, y: 0.006, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 105 },
        { op: 'fill', region: { rect: [0.027, 0.008, 0.073, 0.030] }, composition: { H2O: 1 }, phase: 'liquid', T: 99 },
        { op: 'fill', region: { rect: [0.027, 0.030, 0.073, 0.040] }, composition: { 'oil-rapeseed': 1 }, phase: 'liquid', T: 99 }
      ]
    })
  },
  fog: {
    warm: 240,
    scene: () => scene({
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      sides: sealed,
      ambient: { p: 101.325, T: 10, rh: 0.8, g: 9.81 },
      ops: [
        { op: 'hotplate', x: 0.05, y: 0, w: 0.08, h: 0.006, material: 'steel', mode: 'power', power: 15, on: true, T: 90 },
        { op: 'beaker', x: 0.05, y: 0.006, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 90 },
        { op: 'fill', region: { rect: [0.027, 0.008, 0.073, 0.040] }, composition: { H2O: 1 }, phase: 'liquid', T: 90 }
      ]
    })
  }
};

/** Ein Bild als Fingerabdruck (alles, was der Zeichner liest). */
function frameHash(f: FrameBuffers): string {
  let a = 0x811c9dc5;
  let b = 0;
  const eat = (v: ArrayBufferView): void => {
    const u = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    for (let i = 0; i < u.length; i += 1) { a = Math.imul(a ^ u[i], 0x01000193) >>> 0; b = (b + u[i] * ((i % 65521) + 1)) >>> 0; }
  };
  eat(f.cells);
  eat(f.field);
  eat(f.liquid);
  eat(f.bubbles.subarray(0, 4 * f.nb));
  eat(f.arrows.subarray(0, 4 * (f.nag + f.nal)));
  eat(new Float64Array([f.nb, f.nag, f.nal, f.scaleLo, f.scaleHi, f.vLiq, f.tintLiquid]));
  return `${a.toString(16)}:${b.toString(16)}`;
}

/** Eine Szene backen; onFrame sieht jedes aufgenommene Bild (mit der Engine in genau diesem Zustand). */
async function bake(raw: unknown, seconds: number, onFrame?: (k: number, e: Engine) => void): Promise<{ baked: Baked; ms: number }> {
  const e = new Engine(raw);
  const charts = new Charts(e);
  const sc = canonicalScene(e.serialize());
  const b = new Baker(e, charts, sc, await clipKey(sc), seconds);
  if (onFrame !== undefined) b.onFrame = (k) => onFrame(k, e);
  const t0 = performance.now();
  while (!b.run(1000)) { /* weiter */ }
  const ms = performance.now() - t0;
  const baked = await b.finish();
  if (baked === null) throw new Error('nothing baked');
  return { baked, ms };
}

const playerOf = (baked: Baked): Player => new Player(baked.header, async (i) => baked.chunks[i] ?? null);

describe('B — test 31: playback shows exactly what was baked', () => {
  it('3 s of the compact boiling beaker: each frame from the clip draws the same pixels as the live view while baking — without overlay every frame, with every overlay every third frame (where its layers are stored)', async () => {
    const live: string[][] = [];
    let f = allocFrame(1, 1, 16, 0);
    const { baked, ms } = await bake(boiling(), 3, (k, e) => {
      if (f.nx !== e.grid.nx) f = allocFrame(e.grid.nx, e.grid.ny, 4096, 0);
      live[k] = OVERLAYS.map((ov) => { buildFrame(e, f, ov, false); return frameHash(f); });
    });
    const h = baked.header;
    expect(h.frames).toBe(3 * FPS + 1);
    expect(h.version).toBe(CLIP_VERSION);
    const player = playerOf(baked);
    let compared = 0;
    for (let k = 0; k < h.frames; k += 1) {
      const L = await player.frameAsync(k);
      expect(L).not.toBeNull();
      if (L === null) return;
      OVERLAYS.forEach((ov, o) => {
        if (ov !== 'none' && k % OVERLAY_EVERY !== 0) return;
        frameFromLayers(L, f, ov);
        expect(frameHash(f)).toBe(live[k][o]);
        compared += 1;
      });
    }
    const bytes = baked.chunks.reduce((s, c) => s + c.length, 0);
    console.log(`test 31: ${h.frames} frames (${h.nx}×${h.ny}), ${compared} drawn frames identical to the live view; frames ${(bytes / h.frames / 1e3).toFixed(1)} kB each, keyframes ${(baked.keys.reduce((s, k) => s + k.length, 0) / baked.keys.length / 1e3).toFixed(0)} kB each; baked in ${(ms / 1000).toFixed(1)} s for ${h.duration.toFixed(2)} s`);
  });
});

describe('B — test 32: seeking lands on the frame of the time', () => {
  it('frames read in any order equal the frames read in sequence; time maps to frame floor(t·30) within the clip', async () => {
    const { baked } = await bake(boiling(), 3);
    const h = baked.header;
    const seq = playerOf(baked);
    const f = allocFrame(h.nx, h.ny, 4096, 0);
    const want = new Map<number, string>();
    for (let k = 0; k < h.frames; k += 1) {
      const L = await seq.frameAsync(k);
      if (L === null) throw new Error('no frame');
      frameFromLayers(L, f, 'none');
      const a = frameHash(f);
      frameFromLayers(L, f, 'temperature');
      want.set(k, `${a}|${frameHash(f)}`);
    }
    const order = [77, 2, 59, 60, 61, 0, 90, 45, 44, 89, 3, 31];
    const random = playerOf(baked);
    for (const k of order) {
      const L = await random.frameAsync(k);
      if (L === null) throw new Error('no frame');
      frameFromLayers(L, f, 'none');
      const a = frameHash(f);
      frameFromLayers(L, f, 'temperature');
      expect(`${a}|${frameHash(f)}`).toBe(want.get(k));
    }
    expect(random.frameAt(0)).toBe(0);
    expect(random.frameAt(1 / 30)).toBe(1);
    expect(random.frameAt(1)).toBe(30);
    expect(random.frameAt(1.0333)).toBe(30);
    expect(random.frameAt(h.duration)).toBe(h.frames - 1);
    expect(random.frameAt(99)).toBe(h.frames - 1);
    expect(random.frameAt(-1)).toBe(0);
    console.log(`test 32: ${order.length} frames read out of order, each equal to its frame in sequence`);
  });
});

describe('B — test 33: going on from a keyframe is the same run', () => {
  for (const [name, def] of Object.entries(RESUME)) {
    it(`${name}: a snapshot restored into a fresh engine runs on bit for bit like the run that never stopped (whole state compared after 120 steps)`, () => {
      const a = new Engine(def.scene());
      const ca = new Charts(a);
      for (let k = 0; k < def.warm; k += 1) a.step();
      const snap = takeSnapshot(rootOf(a, ca));
      for (let k = 0; k < 120; k += 1) a.step();
      const b = new Engine(def.scene());
      const cb = new Charts(b);
      expect(layoutOf(rootOf(b, cb))).toBe(layoutOf(rootOf(a, ca)));
      restoreSnapshot(rootOf(b, cb), snap);
      for (let k = 0; k < 120; k += 1) b.step();
      const sa = takeSnapshot(rootOf(a, ca));
      const sb = takeSnapshot(rootOf(b, cb));
      let same = sa.length === sb.length;
      for (let i = 0; same && i < sa.length; i += 1) if (sa[i] !== sb[i]) same = false;
      console.log(`test 33 (${name}): ${a.particles.count} particles, ${a.bubbles.count} bubbles at ${a.time.toFixed(2)} s; snapshot ${(snap.length / 1e3).toFixed(0)} kB; the two runs ${same ? 'are identical' : 'DIFFER'}`);
      expect(same).toBe(true);
    });
  }

  it('from the keyframe at 5 s of a 6 s clip: the frames computed on equal the frames in the clip', async () => {
    const { baked } = await bake(boiling(), 6);
    const h = baked.header;
    const kf = h.keyframes.findIndex((k) => k.frame === 5 * FPS);
    expect(kf).toBeGreaterThan(0);
    const e = new Engine(h.scene);
    const charts = new Charts(e);
    restoreSnapshot(rootOf(e, charts), await unpack(baked.keys[kf]));
    const player = playerOf(baked);
    const f = allocFrame(h.nx, h.ny, 4096, 0);
    let compared = 0;
    for (let k = 5 * FPS; k < h.frames; k += 1) {
      while (e.time < k / FPS - 1e-9) e.step();
      const L = await player.frameAsync(k);
      if (L === null) throw new Error('no frame');
      for (const ov of OVERLAYS) {
        if (ov !== 'none' && k % OVERLAY_EVERY !== 0) continue;
        buildFrame(e, f, ov, false);
        const live = frameHash(f);
        frameFromLayers(L, f, ov);
        if (frameHash(f) !== live) console.log(`DIFF at frame ${k} overlay ${ov}`);
        expect(frameHash(f)).toBe(live);
        compared += 1;
      }
    }
    console.log(`test 33 (clip): from the keyframe at ${h.keyframes[kf].t} s, ${compared} drawn frames up to ${h.duration.toFixed(2)} s equal to the clip`);
  });
});

describe('B — the scenario page (scripts/fixtures/lab2d-scenariusze.json)', () => {
  it('one lab with the scene and ten scenarios to choose, one lab that bakes on opening; every scene reads and builds without a warning', () => {
    const page = scenarios as { modules: { kind: string; config: { scene?: unknown; start?: string; seconds?: string; scenarios?: { title: string; scene: unknown }[] } }[] };
    const labs = page.modules.filter((m) => m.kind === 'lab2d');
    expect(labs.length).toBe(2);
    expect(labs[0].config.start).toBe('button');
    expect(labs[1].config.start).toBe('bake');
    const scenes = [...labs.map((m) => m.config.scene), ...(labs[0].config.scenarios ?? []).map((x) => x.scene)];
    expect(scenes.length).toBe(12);
    for (const raw of scenes) {
      const { scene: sc, warnings } = readScene(raw);
      expect(warnings).toEqual([]);
      expect(new Engine(sc).warnings).toEqual([]);
    }
  });
});
