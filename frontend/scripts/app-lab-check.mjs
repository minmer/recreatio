/**
 * LABORATORIA (2026-10-18) — was ohne Browser nachzumessen ist: die Fizyka 2D
 * und die Chemia gegen die Lehrbuchwerte.
 *
 *   Fizyka   freier Fall, ein ruhender Kasten und ein Turm, Stoss (Impuls), schiefe
 *            Ebene (Haft- und Gleitreibung), Pendel und Feder (Periode), Atwood (Rolle),
 *            Schwimmen (Eintauchtiefe = Dichteverhältnis), Verdrängung, Druck in der
 *            Tiefe, Torricelli, verbundene Gefässe (auch mit Öl), Ruhe.
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
export { Lab, SEAT, STEP as CSTEP } from '${app}lab/chem/chemBench';
export { Vessel } from '${app}lab/chem/chemVessel';
export { SALTS, SPECIES, saltOf } from '${app}lab/chem/chemData';
export { solubility } from '${app}lab/chem/chemSalts';
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

  /* -- Chemia: pH ------------------------------------------------------------------------------ */
  const chem = (T = 298.15) => new m.Lab({ T });
  const glass = (L, id, size = 250, kind = 'beaker', x = 0) => { const v = new m.Vessel(id, kind, size, x, L.room.T); L.vessels.push(v); L.settle(v); return v; };
  const runC = (L, seconds) => { const n = Math.round(seconds / m.CSTEP); for (let i = 0; i < n; i += 1) L.step(m.CSTEP); };
  const said = (L, text) => L.log.some((e) => e.text.includes(text));
  const burner = (L, x = 0) => { const b = { id: `p${L.burners.length}`, x, on: true, air: true, tint: null, tintLeft: 0 }; L.burners.push(b); return b; };
  const lump = (v, sp) => v.lumps.filter((l) => l.sp === sp).reduce((a, l) => a + l.n, 0);
  {
    const ph = (list) => { const L = chem(); const v = glass(L, 'b'); for (const [id, a] of list) L.add(v, id, a); runC(L, 0.1); return v.spec.pH; };
    /* Ein wenig CO₂ aus der Luft löst sich sofort (an der Luft wird Wasser mit der Zeit pH 5,6). */
    near(ph([['water', 100]]), 7.0, 0.06, 'pure water at 25 °C: pH 7');
    near(ph([['HCl-dil', 10], ['water', 90]]), 2.0, 0.03, 'HCl 0.01 mol/L: pH 2');
    near(ph([['NaOH-dil', 10], ['water', 90]]), 12.0, 0.03, 'NaOH 0.01 mol/L: pH 12');
    near(ph([['vinegar', 10], ['water', 90]]), 2.88, 0.04, 'acetic acid 0.1 mol/L: pH 2.88');
    near(ph([['NH3-aq', 5], ['water', 95]]), 11.13, 0.05, 'ammonia 0.1 mol/L: pH 11.1');
    near(ph([['Na2CO3-aq', 10], ['water', 90]]), 11.66, 0.06, 'sodium carbonate 0.1 mol/L: pH 11.7');
    near(ph([['vinegar', 10], ['NaOH-aq', 5], ['water', 85]]), 4.76, 0.04, 'acetate buffer 1:1: pH = pKa');
    const hot = chem(353.15);
    const w = glass(hot, 'b');
    hot.add(w, 'water', 100);
    runC(hot, 0.2);
    assert.ok(w.spec.pH < 6.7, `hot water (80 °C) is neutral below pH 7 (${w.spec.pH.toFixed(2)})`);
    ok('chemistry pH: strong and weak acids and bases, a buffer, and neutral water at 25 and 80 °C');
  }

  /* -- Chemia: Wärme ------------------------------------------------------------------------------ */
  {
    const L = chem();
    const v = glass(L, 'b', 100);
    L.add(v, 'HCl', 25);
    runC(L, 0.5);
    const T0 = v.T;
    L.add(v, 'NaOH-aq', 25);
    runC(L, 1);
    const dT = v.T - T0;
    assert.ok(dT > 4.5 && dT < 6.5, `HCl + NaOH (25 + 25 mL, 1 mol/L) warms by about 5.5 K (with the glass): ${dT.toFixed(2)} K`);
    near(v.spec.pH, 7, 0.6, 'equal amounts of HCl and NaOH are neutral');

    const dissolve = (reagent, g) => {
      const D = chem();
      const b = glass(D, 'b', 100);
      D.add(b, 'water', 50);
      runC(D, 0.5);
      const t0 = b.T;
      b.stir = 1e9;
      D.add(b, reagent, g);
      runC(D, 75);
      return { dT: b.T - t0, left: b.lumps.length };
    };
    const naoh = dissolve('NaOH', 5);
    assert.ok(naoh.left === 0 && naoh.dT > 14 && naoh.dT < 26, `5 g NaOH in 50 mL water dissolves and heats by ~20 K: ${naoh.dT.toFixed(1)} K, ${naoh.left} lumps left`);
    const nitrate = dissolve('NH4NO3', 10);
    assert.ok(nitrate.left === 0 && nitrate.dT < -9 && nitrate.dT > -18, `10 g NH₄NO₃ in 50 mL cools by ~13 K: ${nitrate.dT.toFixed(1)} K`);
    ok(`heat: neutralisation +${dT.toFixed(1)} K, NaOH dissolving +${naoh.dT.toFixed(1)} K, NH₄NO₃ ${nitrate.dT.toFixed(1)} K — all from formation enthalpies`);
  }

  /* -- Chemia: Fällung, Löslichkeit, Komplexe ------------------------------------------------------------ */
  {
    const L = chem();
    const v = glass(L, 'b', 50);
    L.add(v, 'AgNO3', 10);
    L.add(v, 'NaCl-aq', 2);
    runC(L, 3);
    near(lump(v, 'AgCl'), 1e-3, 2e-5, 'AgNO₃ + excess NaCl: all silver precipitates as AgCl');
    assert.ok(v.conc('Ag+') < 1e-6, `almost no Ag⁺ left (${v.conc('Ag+').toExponential(2)} mol/L)`);
    assert.ok(said(L, 'biały osad'), 'the log tells of a white precipitate');
    const kno3 = m.saltOf('KNO3');
    near(m.solubility(kno3, 293.15), 31.6, 0.3, 'KNO₃ dissolves 31.6 g in 100 g water at 20 °C');
    assert.ok(m.solubility(kno3, 333.15) > 70, `… and much more at 60 °C (${m.solubility(kno3, 333.15).toFixed(0)} g)`);
    assert.ok(m.solubility(m.saltOf('Ca(OH)2'), 353.15) < m.solubility(m.saltOf('Ca(OH)2'), 293.15), 'Ca(OH)₂ dissolves worse when hot');

    const cu = chem();
    const c = glass(cu, 'b', 100);
    cu.add(c, 'CuSO4-aq', 5);
    cu.add(c, 'water', 20);
    cu.add(c, 'NaOH-aq', 4);
    runC(cu, 3);
    assert.ok(lump(c, 'Cu(OH)2') > 1.9e-3, `CuSO₄ + NaOH: blue Cu(OH)₂ precipitates (${lump(c, 'Cu(OH)2').toExponential(2)} mol)`);
    /* Mit Ammoniak allein (wie im Versuch, wenig Kupfer): erst der hellblaue Niederschlag, dann die tiefblaue Lösung. */
    const c2 = glass(cu, 'b2', 100, 'beaker', 12);
    cu.add(c2, 'CuSO4-aq', 1);
    cu.add(c2, 'water', 20);
    cu.add(c2, 'NH3-aq', 1);
    runC(cu, 3);
    const light = lump(c2, 'Cu(OH)2');
    cu.add(c2, 'NH3-aq', 25);
    runC(cu, 16);
    assert.ok(light > 3e-4 && lump(c2, 'Cu(OH)2') < 2e-5 && (c2.spec.cx['Cu(NH3)4+2'] ?? 0) > 0.5, `a little ammonia precipitates Cu(OH)₂ (${light.toExponential(1)} mol), excess dissolves it as deep blue [Cu(NH₃)₄]²⁺ (left ${lump(c2, 'Cu(OH)2').toExponential(1)}, complex ${(c2.spec.cx['Cu(NH3)4+2'] ?? 0).toFixed(2)})`);

    const zn = chem();
    const z = glass(zn, 'b', 100);
    zn.add(z, 'ZnSO4', 2);
    zn.add(z, 'NaOH-aq', 1.6);
    runC(zn, 3);
    const zp = lump(z, 'Zn(OH)2');
    zn.add(z, 'NaOH-aq', 15);
    runC(zn, 10);
    assert.ok(zp > 6e-4 && lump(z, 'Zn(OH)2') < 1e-5, `Zn(OH)₂ precipitates and dissolves in excess NaOH (amphoteric): ${zp.toExponential(2)} → ${lump(z, 'Zn(OH)2').toExponential(1)}`);

    const ag = chem();
    const a1 = glass(ag, 'a', 50);
    const a2 = glass(ag, 'b', 50, 'beaker', 10);
    for (const [vv, salt] of [[a1, 'NaCl-aq'], [a2, 'KI']]) { ag.add(vv, 'AgNO3', 2); ag.add(vv, salt, 3); }
    runC(ag, 2);
    ag.add(a1, 'NH3-aq', 10);
    ag.add(a2, 'NH3-aq', 10);
    runC(ag, 6);
    assert.ok(lump(a1, 'AgCl') < 1e-5 && lump(a2, 'AgI') > 1.5e-4, `ammonia dissolves AgCl but not AgI (${lump(a1, 'AgCl').toExponential(1)} / ${lump(a2, 'AgI').toExponential(1)})`);
    ok('precipitation and solubility: AgCl, KNO₃(T), Ca(OH)₂(T), Cu(OH)₂ → [Cu(NH₃)₄]²⁺, amphoteric Zn(OH)₂, AgCl vs AgI in ammonia');
  }

  /* -- Chemia: Metalle --------------------------------------------------------------------------------- */
  {
    const L = chem();
    const v = glass(L, 'b', 250);
    L.add(v, 'water', 100);
    L.add(v, 'phenolphthalein', 3);
    runC(L, 0.5);
    const T0 = v.T;
    L.add(v, 'Na', 0.2);
    runC(L, 60);
    assert.ok(lump(v, 'Na') === 0, 'sodium is used up within a minute');
    assert.ok(v.spec.pH > 12.5, `the water became basic (pH ${v.spec.pH.toFixed(2)})`);
    assert.ok(said(L, 'barwi się na różowo'), 'phenolphthalein turns pink');
    assert.ok(v.T - T0 > 1 && v.T - T0 < 6, `and warmer (${(v.T - T0).toFixed(2)} K)`);
    near(v.aq.get('Na+'), 0.2 / 22.99, 1e-9, 'every sodium atom is now a Na⁺ ion');

    const M = chem();
    const f = glass(M, 'f', 500, 'flask');
    M.add(f, 'HCl', 25);
    runC(M, 0.2);
    f.closed = true;
    const h0 = f.gas.get('H2') ?? 0;
    M.add(f, 'Mg', 0.1);
    runC(M, 60);
    assert.ok(lump(f, 'Mg') === 0, 'magnesium dissolves in hydrochloric acid');
    near((f.gas.get('H2') ?? 0) - h0, 0.1 / 24.305, (0.1 / 24.305) * 0.02, 'Mg + 2HCl: one H₂ for every Mg');
    M.add(f, 'phenolphthalein', 1);
    f.closed = false;
    M.use('splint', f);
    assert.ok(said(M, 'Pyk'), 'a burning splint pops in hydrogen');

    const rate = (metal, g) => { const R2 = chem(); const t = glass(R2, 't', 25, 'tube'); R2.add(t, 'HCl', 10); runC(R2, 0.2); R2.add(t, metal, g); runC(R2, 5); return (t.aq.get(`${metal}+2`) ?? 0) / 5; };
    const mg = rate('Mg', 0.1);
    const znr = rate('Zn', 1);
    const fe = rate('Fe', 5);
    const cuR = rate('Cu', 1);
    assert.ok(mg > znr && znr > fe && fe > 0 && cuR === 0, `activity series in HCl: Mg ${mg.toExponential(1)} > Zn ${znr.toExponential(1)} > Fe ${fe.toExponential(1)} mol/s, Cu none`);

    const D = chem();
    const d = glass(D, 'b', 100);
    D.add(d, 'CuSO4-aq', 50);
    runC(D, 0.2);
    const cu0 = d.aq.get('Cu+2');
    D.add(d, 'Fe', 5);
    runC(D, 120);
    const nail = d.lumps.find((l) => l.sp === 'Fe');
    assert.ok((nail?.coat.Cu ?? 0) > 1e-4 && (d.aq.get('Fe+2') ?? 0) > 1e-4, `an iron nail in CuSO₄ gets a copper coat (${(nail?.coat.Cu ?? 0).toExponential(2)} mol)`);
    near((d.aq.get('Cu+2') ?? 0) + (nail?.coat.Cu ?? 0) + lump(d, 'Cu(OH)2') + lump(d, 'CuO'), cu0, 1e-9, 'copper is conserved (ions + coat)');
    ok(`metals: Na in water (pH ${v.spec.pH.toFixed(1)}, pink, warm), Mg + HCl → H₂ (pop), activity series, Fe + Cu²⁺ → Cu`);
  }

  /* -- Chemia: Gase, Feuer, Kochen, Druck ---------------------------------------------------------------- */
  {
    const L = chem();
    const v = glass(L, 'b', 100);
    L.add(v, 'H2O2', 50);
    runC(L, 0.2);
    const n0 = v.aq.get('H2O2');
    L.add(v, 'MnO2', 0.5);
    runC(L, 30);
    assert.ok((v.aq.get('H2O2') ?? 0) < 0.2 * n0, 'MnO₂ decomposes hydrogen peroxide within half a minute');
    L.use('glow', v);
    assert.ok(said(L, 'zapala się jasnym płomieniem'), `a glowing splint relights in the oxygen (x(O₂) = ${v.frac('O2').toFixed(2)})`);

    const G = chem();
    const gen = glass(G, 'gen', 250, 'flask');
    const lime = glass(G, 'lime', 100, 'beaker', 20);
    G.add(gen, 'HCl', 50);
    G.add(lime, 'limewater', 50);
    runC(G, 0.3);
    G.connect(gen, lime);
    G.add(gen, 'CaCO3', 2);
    let milky = 0;
    for (let i = 0; i < 40; i += 1) { runC(G, 0.5); milky = Math.max(milky, lump(lime, 'CaCO3')); }
    assert.ok(milky > 3e-4, `CO₂ from marble and acid turns limewater milky (CaCO₃ ${milky.toExponential(2)} mol)`);

    const J = chem();
    const jar = glass(J, 'j', 1000, 'jar');
    J.add(jar, 'candle', 3);
    J.use('match', jar);
    jar.closed = true;
    runC(J, 90);
    const candle = jar.lumps.find((l) => l.sp === 'wax');
    assert.ok(candle !== undefined && !candle.burning && jar.frac('O2') < 0.18 && jar.frac('O2') > 0.1, `a candle under a closed jar goes out with O₂ at ${(jar.frac('O2') * 100).toFixed(1)} %`);

    const C = chem();
    const co2 = glass(C, 'b', 250);
    C.add(co2, 'CO2-gas', 400);
    runC(C, 60);
    const h2 = glass(C, 'h', 250, 'beaker', 15);
    C.add(h2, 'H2-gas', 50);
    runC(C, 20);
    assert.ok(co2.frac('CO2') > 0.35 && h2.frac('H2') < 0.05, `heavy CO₂ stays in an open beaker (${co2.frac('CO2').toFixed(2)} after 80 s), light H₂ escapes (${h2.frac('H2').toFixed(3)} after 20 s)`);

    const B = chem();
    burner(B);
    const w = glass(B, 'w', 250);
    w.y = m.SEAT;
    B.add(w, 'water', 100);
    runC(B, 400);
    near(w.T, 373.15, 0.6, 'water on a burner boils at 100 °C');
    assert.ok(w.water < 100 / 18.015 - 0.2, 'and boils away');
    const S = chem();
    burner(S);
    const sw = glass(S, 's', 250);
    sw.y = m.SEAT;
    S.add(sw, 'water', 100);
    S.add(sw, 'NaCl', 20);
    sw.stir = 1e9;
    runC(S, 400);
    assert.ok(sw.T > 374.6, `salt water boils higher (${(sw.T - 273.15).toFixed(1)} °C)`);

    const P = chem();
    burner(P);
    const fl = glass(P, 'f', 250, 'flask');
    fl.y = m.SEAT;
    fl.closed = true;
    let peak = 0;
    for (let i = 0; i < 300 && fl.closed; i += 1) { runC(P, 1); peak = Math.max(peak, fl.pressure(P.room.p)); }
    assert.ok(!fl.closed && said(P, 'korek wyskakuje') && peak > 140, `a closed flask on the burner builds pressure until the stopper flies (${peak.toFixed(0)} kPa)`);

    const N = chem();
    burner(N);
    const tube = glass(N, 't', 25, 'tube');
    tube.y = m.SEAT;
    N.add(tube, 'NH4Cl', 1);
    N.add(tube, 'NaOH-aq', 10);
    runC(N, 30);
    N.use('wetpaper', tube);
    assert.ok(said(N, 'na niebiesko'), 'NH₄Cl + NaOH heated gives ammonia (damp paper turns blue)');

    const F = chem();
    const fb = burner(F, 30);
    const ft = glass(F, 't', 25, 'tube');
    F.add(ft, 'NaCl-aq', 5);
    F.use('loop', ft);
    F.useBurner(fb, 'loop');
    assert.ok(fb.tint === m.SPECIES['Na+'].flame, 'flame test: sodium colours the flame yellow');

    const I = chem();
    const ice = glass(I, 'i', 250);
    I.add(ice, 'ice', 60);
    I.add(ice, 'water', 10);
    I.add(ice, 'NaCl', 20);
    ice.stir = 1e9;
    runC(I, 120);
    assert.ok(ice.T < 271, `ice with salt cools below 0 °C (${(ice.T - 273.15).toFixed(1)} °C)`);
    ok('gases and heat: O₂ from H₂O₂ (splint), CO₂ into limewater, candle in a jar, heavy CO₂ / light H₂, boiling (+salt), stopper, ammonia, flame test, ice and salt');
  }

  console.log('\napp-lab-check: all passed');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
