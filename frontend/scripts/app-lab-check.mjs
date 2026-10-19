/**
 * LABORATORIUM FIZYKI (2026-10-18) — was ohne Browser nachzumessen ist: die
 * Fizyka 2D gegen die Lehrbuchwerte — freier Fall, ein ruhender Kasten und ein
 * Turm, Stoss (Impuls), schiefe Ebene (Haft- und Gleitreibung), Pendel und Feder
 * (Periode), Atwood (Rolle), Newtons Wiege, Schwimmen (Eintauchtiefe =
 * Dichteverhältnis), Verdrängung, Druck in der Tiefe, Torricelli, verbundene
 * Gefässe (auch mit Öl), Ruhe.
 *
 *   node scripts/app-lab-check.mjs
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lab-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { readPhysScene, buildWorld, drawScene } from '${app}lab/physics/physScene';
export { STEP } from '${app}lab/physics/physWorld';
export { LIQUIDS, P_ATM } from '${app}lab/fluid';
`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), logLevel: 'error' });

const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b} (±${eps})`);
const ok = (label) => console.log(`ok   ${label}`);

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const make = (scene) => m.buildWorld(m.readPhysScene(scene), m.drawScene(m.readPhysScene(scene), 'check'));
  const run = (w, seconds) => { const n = Math.round(seconds / m.STEP); for (let i = 0; i < n; i += 1) w.step(m.STEP); };
  const body = (w, id) => w.bodies.find((b) => b.id === id);

  /* -- Freier Fall, Ruhe, Turm ------------------------------------------------------------- */
  {
    const w = make({ world: { air: 0 }, bodies: [{ id: 'k', shape: 'circle', r: 0.1, x: 0, y: 10, material: 'steel' }] });
    run(w, 1);
    /* Symplektischer Euler in Schritten von 1/120 s: der Fehler ist ½·g·h·t (4 cm nach einer Sekunde, 0,8 % der Strecke). */
    near(body(w, 'k').y, 10 - 0.5 * 9.81 * 1, 0.05, 'free fall: y = h − g·t²/2 after 1 s');
    near(body(w, 'k').vy, -9.81, 0.05, 'free fall: v = g·t');
    ok('free fall without air: position and speed as in the textbook');

    const air = make({ world: { air: 1 }, bodies: [{ id: 'p', shape: 'box', w: 0.3, h: 0.01, x: 0, y: 10, material: 'paper' }, { id: 'k', shape: 'circle', r: 0.05, x: 1, y: 10, material: 'steel' }] });
    run(air, 1);
    assert.ok(body(air, 'p').y > body(air, 'k').y + 1, `with air a sheet of paper falls behind a steel ball (${body(air, 'p').y.toFixed(2)} vs ${body(air, 'k').y.toFixed(2)})`);
    ok('air resistance: a sheet of paper falls slower than a steel ball');

    const rest = make({ bodies: [{ id: 'b', shape: 'box', w: 0.6, h: 0.4, x: 0, y: 0.25, material: 'wood' }] });
    run(rest, 3);
    near(body(rest, 'b').y, 0.2, 0.01, 'a box rests on the ground');
    assert.ok(Math.abs(body(rest, 'b').a) < 0.01 && rest.calm, 'it lies flat and the world comes to rest');
    const tower = make({ bodies: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, shape: 'box', w: 0.5, h: 0.3, x: 0, y: 0.15 + i * 0.31, material: 'wood' })) });
    run(tower, 6);
    for (let i = 0; i < 6; i += 1) {
      near(body(tower, `t${i}`).x, 0, 0.02, `tower block ${i} stays above the others`);
      near(body(tower, `t${i}`).y, 0.15 + i * 0.3, 0.03, `tower block ${i} keeps its height`);
    }
    ok('rest: a box lies still on the ground, a tower of six stands');
  }

  /* -- Stoss, schiefe Ebene ------------------------------------------------------------------- */
  {
    const w = make({ world: { air: 0, gravity: 0, ground: false }, bodies: [
      { id: 'a', shape: 'circle', r: 0.2, x: -1, y: 1, vx: 2, material: 'steel' },
      { id: 'b', shape: 'circle', r: 0.2, x: 1, y: 1, vx: 0, material: 'steel', density: 3925 }
    ] });
    const p0 = body(w, 'a').m * 2;
    run(w, 2);
    const p1 = body(w, 'a').m * body(w, 'a').vx + body(w, 'b').m * body(w, 'b').vx;
    near(p1, p0, Math.abs(p0) * 0.02, 'a collision keeps the momentum');
    assert.ok(body(w, 'b').vx > 0.5, 'the struck ball moves on');
    ok('collision: momentum is conserved');

    const slope = (deg, material) => {
      const t = Math.tan((deg * Math.PI) / 180);
      return make({ world: { air: 0 }, bodies: [
        { id: 'r', shape: 'poly', points: [[0, 0], [4, 0], [0, 4 * t]], x: 0, y: 0, static: true, material: 'wood' },
        { id: 'k', shape: 'box', w: 0.3, h: 0.2, x: 1.5, y: (4 - 1.5) * t + 0.1 / Math.cos((deg * Math.PI) / 180) + 0.01, angle: -deg, material }
      ] });
    };
    const stays = slope(15, 'wood');
    const x0 = body(stays, 'k').x;
    run(stays, 2);
    assert.ok(Math.abs(body(stays, 'k').x - x0) < 0.03, `15° < arctan(µ = 0,5): the block stays (moved ${(body(stays, 'k').x - x0).toFixed(3)} m)`);
    const slides = slope(15, 'ice');
    const s0 = body(slides, 'k').x;
    run(slides, 1);
    assert.ok(body(slides, 'k').x - s0 > 0.3, 'on ice (µ ≈ 0,03) the same block slides');
    ok('inclined plane: static friction holds on wood, ice slides');
  }

  /* -- Pendel, Feder, Rolle --------------------------------------------------------------------- */
  {
    const L = 2;
    const w = make({ world: { air: 0, ground: false }, bodies: [{ id: 'k', shape: 'circle', r: 0.05, x: L * Math.sin(0.1), y: 5 - L * Math.cos(0.1), material: 'steel' }],
      joints: [{ type: 'rod', a: 'k', at: [0, 5] }] });
    const crossings = [];
    let last = body(w, 'k').x;
    for (let i = 0; i < Math.round(12 / m.STEP); i += 1) {
      w.step(m.STEP);
      const x = body(w, 'k').x;
      if (last > 0 && x <= 0) crossings.push(w.time);
      last = x;
    }
    const period = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
    near(period, 2 * Math.PI * Math.sqrt(L / 9.81), 0.04, 'a pendulum: T = 2π·√(L/g)');
    ok(`pendulum: period ${period.toFixed(3)} s for L = 2 m`);

    const k = 400;
    const s = make({ world: { air: 0, ground: false }, bodies: [{ id: 'm', shape: 'box', w: 0.2, h: 0.2, x: 0, y: 2, material: 'steel' }],
      joints: [{ type: 'spring', a: 'm', at: [0, 4], length: 1.6, k, damping: 0 }] });
    const mass = body(s, 'm').m;
    const ys = [];
    for (let i = 0; i < Math.round(8 / m.STEP); i += 1) { s.step(m.STEP); ys.push([s.time, body(s, 'm').y]); }
    const mid = ys.reduce((a, [, y]) => a + y, 0) / ys.length;
    const ups = [];
    for (let i = 1; i < ys.length; i += 1) if (ys[i - 1][1] < mid && ys[i][1] >= mid) ups.push(ys[i][0]);
    const T = (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
    near(T, 2 * Math.PI * Math.sqrt(mass / k), 0.03, 'a spring: T = 2π·√(m/k)');
    ok(`spring: period ${T.toFixed(3)} s for m = ${mass.toFixed(2)} kg, k = 400 N/m`);

    const at = make({ world: { air: 0, ground: false }, bodies: [
      { id: 'm1', shape: 'box', w: 0.2, h: 0.2, x: -0.5, y: 2, material: 'steel' },
      { id: 'm2', shape: 'box', w: 0.2, h: 0.2, x: 0.5, y: 2, material: 'steel', density: 3925 }
    ], joints: [{ type: 'pulley', a: 'm1', b: 'm2', at: [-0.5, 4], at2: [0.5, 4] }] });
    const m1 = body(at, 'm1').m; const m2 = body(at, 'm2').m;
    run(at, 1);
    const a = -body(at, 'm1').vy;
    near(a, 9.81 * (m1 - m2) / (m1 + m2), 0.15, 'Atwood: a = g·(m₁ − m₂)/(m₁ + m₂)');
    ok(`pulley (Atwood): a = ${a.toFixed(2)} m/s²`);

    /* Kołyska Newtona: der Stoss läuft durch die Kette — die erste Kugel bleibt stehen, die letzte fliegt. */
    const cradle = make({ world: { air: 0, ground: false }, bodies: [0, 1, 2, 3, 4].map((i) => ({
      id: `k${i}`, shape: 'circle', r: 0.15, x: i === 0 ? 2 - 1.4 * Math.sin(0.6) : 2 + i * 0.302, y: i === 0 ? 3 - 1.4 * Math.cos(0.6) : 1.6, material: 'steel', bounce: 0.98, friction: 0
    })), joints: [0, 1, 2, 3, 4].map((i) => ({ type: 'rod', a: `k${i}`, at: [2 + i * 0.302, 3] })) });
    run(cradle, 0.58);
    const hit = body(cradle, 'k0').vx;
    run(cradle, 0.12);
    assert.ok(Math.abs(body(cradle, 'k0').vx) < 0.1 * hit && body(cradle, 'k4').vx > 0.85 * hit, `Newton's cradle: the first ball stops (${body(cradle, 'k0').vx.toFixed(2)}), the last flies off (${body(cradle, 'k4').vx.toFixed(2)} of ${hit.toFixed(2)} m/s)`);
    ok("Newton's cradle: the impulse travels through the chain");
  }

  /* -- Flüssigkeiten ------------------------------------------------------------------------------ */
  {
    const float = (material, extra = {}) => make({ fluids: [{ id: 'zb', x: 0, y: 0, w: 2, h: 1.5, layers: [{ liquid: 'water', height: 0.8 }] }],
      bodies: [{ id: 'k', shape: 'box', w: 0.4, h: 0.4, x: 1, y: 1.1, material, ...extra }] });
    const w = float('wood');
    const before = 0.8;
    run(w, 8);
    const k = body(w, 'k');
    const top = w.basins[0].surface();
    near((top - k.minY) / 0.4, 0.6, 0.03, 'wood (600 kg/m³) floats 60 % under water');
    near((top - before) * 2, 0.4 * 0.4 * 0.6, 0.004, 'the level rises by the displaced water (Archimedes)');
    ok('floating: wood sinks in by its density ratio, and the water rises by what it displaces');
    const ice = float('ice');
    run(ice, 8);
    near((ice.basins[0].surface() - body(ice, 'k').minY) / 0.4, 0.917, 0.03, 'ice floats 92 % under water');
    const steel = float('steel');
    run(steel, 4);
    near(body(steel, 'k').minY, 0, 0.02, 'steel sinks to the bottom');
    ok('ice floats almost under water, steel sinks');

    const p = make({ fluids: [{ id: 'zb', x: 0, y: 0, w: 1, h: 2, layers: [{ liquid: 'water', height: 1.5 }] }] });
    run(p, 0.1);
    near(p.basins[0].pressure(0.5, 9.81) - m.P_ATM, 1000 * 9.81 * 1, 1, 'pressure 1 m below the surface: ρ·g·h');
    const t = make({ fluids: [{ id: 'zb', x: 0, y: 1, w: 1, h: 2, layers: [{ liquid: 'water', height: 1.25 }], holes: [{ side: 'right', at: 0.05, size: 0.02, open: true }] }] });
    t.step(m.STEP);
    near(t.basins[0].holes[0].speed, Math.sqrt(2 * 9.81 * 1.2), 0.02, 'Torricelli: v = √(2·g·h)');
    run(t, 2);
    assert.ok(t.drops.length > 20 && t.basins[0].surface() < 2.25, `the jet flies and the level sinks (${t.drops.length} drops, level ${t.basins[0].surface().toFixed(3)})`);
    ok('pressure in depth and the jet from a hole (Torricelli)');

    const u = make({ fluids: [
      { id: 'a', x: 0, y: 0, w: 0.6, h: 2, layers: [{ liquid: 'water', height: 1.5 }] },
      { id: 'b', x: 1, y: 0, w: 0.6, h: 2, layers: [{ liquid: 'water', height: 0.3 }] }
    ], pipes: [{ a: 'a', b: 'b', y: 0.05 }] });
    run(u, 15);
    near(u.basins[0].surface(), u.basins[1].surface(), 0.01, 'communicating vessels: the levels become equal');
    near(u.basins[0].surface(), 0.9, 0.01, '… at the mean level');
    const oil = make({ fluids: [
      { id: 'a', x: 0, y: 0, w: 0.4, h: 2, layers: [{ liquid: 'water', height: 0.8 }, { liquid: 'oil', height: 0.5 }] },
      { id: 'b', x: 1, y: 0, w: 0.4, h: 2, layers: [{ liquid: 'water', height: 0.8 }] }
    ], pipes: [{ a: 'a', b: 'b', y: 0.05 }] });
    run(oil, 20);
    const A = oil.basins[0];
    const B = oil.basins[1];
    const oilH = A.layers.find((l) => l.liquid.key === 'oil').top - A.layers.find((l) => l.liquid.key === 'water').top;
    near(B.surface() - A.layers.find((l) => l.liquid.key === 'water').top, oilH * 0.9, 0.01, 'a U-tube with oil: the water stands higher by ρ_oil/ρ_water of the oil column');
    ok('communicating vessels: equal levels; with oil on one side the water rises by the density ratio');
  }

  console.log('\napp-lab-check: all passed');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
