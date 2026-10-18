/**
 * LABORATORIA (2026-10-18) — was ohne Browser nachzumessen ist: die Fizyka 2D
 * und die Chemia gegen die Lehrbuchwerte.
 *
 *   Fizyka   freier Fall, ein ruhender Kasten und ein Turm, Stoss (Impuls), schiefe
 *            Ebene (Haft- und Gleitreibung), Pendel und Feder (Periode), Atwood (Rolle),
 *            Schwimmen (Eintauchtiefe = Dichteverhältnis), Verdrängung, Druck in der
 *            Tiefe, Torricelli, verbundene Gefässe (auch mit Öl), Ruhe.
 *
 *   Chemia   die Piaskownica selbst (Gitter, Wärme, Gase, Stoffe in jeder Zelle):
 *            pH und Löslichkeit, Neutralisationswärme, AgCl genau nach der Gleichung,
 *            Lösungswärme, Metalle, das Schmelzplateau der Cyna, Wärmeleitung (Kupfer
 *            gegen Glas), Kochen (auch mit Salz), sinkendes CO₂, Kerze unter dem Glas,
 *            Brenner, Wasserstoff, Flammenfärbung, Titration, Eis mit Salz; Lösen nach
 *            Noyes–Whitney (heiss, gerührt, Pulver), langsame Diffusion, Geschwindig-
 *            keitsgesetze (Tiosiarczan, H₂O₂ mit I⁻, Arrhenius), Umkehrbares (Chromian,
 *            NO₂ ⇄ N₂O₄ bei K(T)), Hydrolyse der Metallionen, eine geschlossene Probówka
 *            im Wasserbad — und jede fertige Szene baut sich, läuft und speichert sich
 *            verlustfrei.
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
export { World } from '${app}lab/chem/chemWorld';
export { buildWorld as buildChemWorld, readChemScene, drawChem, perform, sceneOfWorld, useTool } from '${app}lab/chem/chemSetup';
export { CHEM_PRESETS, SANDBOX_CHEM } from '${app}lab/chem/chemPresets';
export { bottleOf, specOf, solubility, diffusivity, AQI, NC } from '${app}lab/chem/chemAq';
export { saltOf, reagentOf } from '${app}lab/chem/chemData';
export { SOLI, NG, GASI, G_CO2, G_O2 } from '${app}lab/chem/chemGrid';
export { rateConstant } from '${app}lab/chem/chemKinetics';
export { wickOf, nozzleOf, toWorld } from '${app}lab/chem/chemThings';
export { seeded } from '${app}lab/labRandom';
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

  /* -- Chemia: Gleichgewichte und Tabellen (ohne Welt) ----------------------------------------------------- */
  {
    const ph = (id) => m.bottleOf(m.reagentOf(id)).spec.pH;
    near(ph('HCl-dil'), 1, 0.05, 'HCl 0.1 mol/L: pH 1');
    near(ph('NaOH-dil'), 13, 0.05, 'NaOH 0.1 mol/L: pH 13');
    near(ph('vinegar'), 2.38, 0.06, 'acetic acid 1 mol/L: pH 2.4');
    near(ph('NH3-aq'), 11.78, 0.08, 'ammonia 2 mol/L: pH 11.8');
    near(ph('water'), 7, 0.02, 'distilled water: pH 7 at 25 °C');
    const water = new Float64Array(m.NC);
    water[0] = 55.4;
    near(m.specOf(water, 0, 353.15, null).pH, 6.3, 0.1, 'hot water (80 °C): pH ≈ 6.3, still neutral');
    near(m.solubility(m.saltOf('KNO3'), 293.15), 31.6, 0.5, 'KNO₃ dissolves 31.6 g / 100 g water at 20 °C');
    assert.ok(m.solubility(m.saltOf('KNO3'), 333.15) > 2 * m.solubility(m.saltOf('KNO3'), 293.15), 'KNO₃ dissolves far better at 60 °C');
    assert.ok(m.solubility(m.saltOf('Ca(OH)2'), 353.15) < m.solubility(m.saltOf('Ca(OH)2'), 293.15), 'Ca(OH)₂ dissolves worse when hot');
    ok('chemistry tables: pH of acids, bases, buffers and water (also hot), solubility against temperature');
  }

  /* -- Chemia: die Piaskownica selbst ------------------------------------------------------------------- */
  const room = { T: 293.15, p: 101.325 };
  const world = (x0, x1, top) => new m.World(x0, x1, top, 3, room, m.seeded('check'));
  const runW = (w, seconds, dt = 1 / 30) => { const n = Math.round(seconds / dt); for (let i = 0; i < n; i += 1) w.step(dt); };
  const said = (w, text) => w.log.some((e) => e.text.includes(text));
  const solid = (w, sp) => { let s = 0; for (let i = 0; i < w.g.n; i += 1) if (w.g.sp[i] === m.SOLI[sp]) s += w.g.sn[i]; return s; };
  const gasIn = (w, t, gi) => { let x = 0; let n = 0; for (const i of t.cells) if (w.g.own[i] === t.num && w.g.mat[i] === 0) { x += w.g.gas[i * m.NG + gi]; n += w.g.gasTotal(i); } return n > 0 ? x / n : 0; };
  {
    /* Säure und Lauge: die Wärme kommt aus den Bildungsenthalpien (57 kJ/mol). */
    const w = world(-8, 8, 20);
    const b = w.place('beaker', 'b', { x: 0, size: 250 });
    w.add('HCl', 50, b, null, true);
    runW(w, 0.5);
    w.add('NaOH-aq', 50, b, null, true);
    w.stir(b);
    runW(w, 6);
    const s = w.summary(b);
    near(s.T - 293.15, 5.7, 1.2, 'neutralisation: 0.05 mol HCl + NaOH warm 100 mL (and the beaker) by about 6 K');
    near(s.spec.pH, 7, 1.2, 'neutralisation: about neutral');
    ok('neutralisation heat from formation enthalpies, pH after mixing');
  }
  {
    /* Silbernitrat in Kochsalzlösung: AgCl fällt genau so viel, wie Ag⁺ da war. */
    const w = world(-8, 8, 20);
    const b = w.place('beaker', 'b', { x: 0, size: 250 });
    w.add('NaCl-aq', 50, b, null, true);
    w.add('AgNO3', 40, b);
    runW(w, 8);
    near(solid(w, 'AgCl'), 0.004, 0.0002, 'AgCl: 4.0 mmol from 40 cm³ AgNO₃ 0.1 mol/L');
    assert.ok(said(w, 'chlorek srebra'), 'the white precipitate is reported');
    ok('precipitation where the solutions meet: AgCl stoichiometric, reported with its equation');
  }
  {
    /* Lösungswärme: NaOH heiss, NH₄NO₃ kalt. */
    const w = world(-12, 12, 20);
    const a = w.place('beaker', 'a', { x: -6, size: 100 });
    const c = w.place('beaker', 'c', { x: 6, size: 100 });
    w.add('water', 50, a, null, true);
    w.add('water', 50, c, null, true);
    w.add('NaOH', 5, a);
    w.add('NH4NO3', 10, c);
    /* Die Körner lösen sich mit Umrühren in etwa einer Minute (wie im Labor). */
    for (let k = 0; k < 25; k += 1) { w.stir(a); w.stir(c); runW(w, 2); }
    near(w.summary(a).T - 293.15, 22, 4, '5 g NaOH in 50 cm³ water: +22 K (44.5 kJ/mol)');
    near(w.summary(c).T - 293.15, -13, 3, '10 g NH₄NO₃ in 50 cm³ water: −13 K (25.7 kJ/mol)');
    ok('heat of dissolution: NaOH warms by about 22 K, NH₄NO₃ cools by about 13 K');
  }
  {
    /* Metalle: Natrium mit Wasser, Zink in Säure, Kupfer nicht, Eisen scheidet Kupfer ab. */
    const w = world(-16, 16, 20);
    const na = w.place('beaker', 'na', { x: -10, size: 250 });
    w.add('water', 150, na, null, true);
    w.add('Na', 0.2, na);
    const zn = w.place('tube', 'zn', { x: -2, size: 25 });
    const cu = w.place('tube', 'cu', { x: 2, size: 25 });
    w.add('HCl', 10, zn, null, true);
    w.add('HCl', 10, cu, null, true);
    w.add('Zn', 1, zn);
    w.add('Cu', 1, cu);
    const fe = w.place('beaker', 'fe', { x: 10, size: 100 });
    w.add('CuSO4-aq', 50, fe, null, true);
    w.add('Fe', 5, fe);
    runW(w, 20);
    assert.ok(solid(w, 'Na') < 1e-4 && w.summary(na).spec.pH > 12, `sodium reacts away and leaves NaOH (pH ${w.summary(na).spec.pH.toFixed(1)})`);
    const ion = (t, id) => w.summary(t, false).comp[m.AQI[id]];
    assert.ok(ion(zn, 'Zn+2') > 1e-4, 'zinc dissolves in hydrochloric acid');
    assert.ok(ion(cu, 'Cu+2') < 1e-7, 'copper does not');
    assert.ok(solid(w, 'Cu') > 1e-4, 'iron in copper sulfate is covered with copper');
    assert.ok(said(w, 'wodór') && said(w, 'osadza się miedź'), 'hydrogen and the copper coating are reported');
    ok('metals: sodium with water, zinc but not copper in acid, iron displaces copper');
  }
  {
    /* Zinn im Tiegel über dem Brenner: die Temperatur bleibt beim Schmelzen stehen. */
    const w = world(-12, 12, 48);
    const p = w.place('burner', 'p', { x: 0 });
    const tr = w.place('tripod', 't', { x: 0 });
    const c = w.place('crucible', 'c', { x: 0, on: tr, size: 30 });
    w.add('Sn', 20, c, null, true);
    const th = w.place('thermometer', 'th', { x: 0, into: c });
    p.flow = 0.8;
    w.burner(p, true);
    let plateau = 0;
    for (let k = 0; k < 150; k += 1) { runW(w, 1, 1 / 15); if (th.readout > 230 && th.readout < 234) plateau += 1; }
    const melt = w.summary(c, false).melts.get('Sn') ?? 0;
    assert.ok(plateau >= 8, `the thermometer stays near 232 °C while the tin melts (${plateau} s)`);
    assert.ok(melt * 118.71 > 15 && th.readout > 245, `then all tin is liquid and gets hotter (${(melt * 118.71).toFixed(1)} g, ${th.readout.toFixed(0)} °C)`);
    assert.ok(said(w, 'Cyna topi się'), 'melting is reported');
    ok('melting tin over the burner: plateau at 232 °C, then liquid metal warms');
  }
  {
    /* Wärmeleitung in Eiswasser: über heissem Wasser wärmt die feuchte, warme Luft auch das Glas (Tau!) — kaltes Wasser
       hat keine Fahne, so misst man die Leitung allein: der Kupferstab wird bis weit über dem Wasser kalt, Glas nicht. */
    const w = world(-10, 10, 30);
    const b = w.place('beaker', 'b', { x: 0, size: 600 });
    w.add('water-cold', 450, b, null, true);
    const cu = w.place('rod', 'cu', { x: -2, into: b, size: 20, of: 'Cu' });
    const gl = w.place('rod', 'gl', { x: 2, into: b, size: 20, of: 'glass' });
    runW(w, 40, 1 / 15);
    const at = (t) => w.g.T[w.g.at(...m.toWorld(t, 0, 15))] - 273.15;
    assert.ok(at(cu) < at(gl) - 5, `above the rim the copper rod is much colder than glass (${at(cu).toFixed(1)} vs ${at(gl).toFixed(1)} °C)`);
    ok('heat conduction along rods: copper cools far above ice water, glass hardly');
  }
  {
    /* Kochen: Wasser hält bei 100 °C, Salzwasser kocht höher. */
    const w = world(-14, 14, 25);
    const h1 = w.place('hotplate', 'h1', { x: -7 });
    const h2 = w.place('hotplate', 'h2', { x: 7 });
    const a = w.place('beaker', 'a', { x: -7, on: h1, size: 100 });
    const s = w.place('beaker', 's', { x: 7, on: h2, size: 100 });
    w.add('water', 50, a, null, true);
    w.add('water', 50, s, null, true);
    w.add('NaCl', 15, s, null, true);
    h1.air = 900; h2.air = 900; h1.on = true; h2.on = true;
    for (let k = 0; k < 20; k += 1) { w.stir(s); runW(w, 10, 1 / 10); }
    const ta = w.summary(a).Tmax - 273.15;
    const ts = w.summary(s).Tmax - 273.15;
    near(ta, 100, 1.5, 'water boils at 100 °C');
    assert.ok(ts > ta + 0.8, `salt water boils higher (${ts.toFixed(1)} vs ${ta.toFixed(1)} °C)`);
    assert.ok(said(w, 'wrze'), 'boiling is reported');
    ok('boiling: water holds at 100 °C, brine boils higher');
  }
  {
    /* Gase: CO₂ sinkt, die Kerze unter dem Słój geht aus, der Brenner heizt, Wasserstoff knallt, Natrium färbt die Flamme. */
    const w = world(-10, 10, 30);
    const g = w.g;
    for (let i = 0; i < g.n; i += 1) { const x = g.cx(i); const y = g.cy(i); if (Math.abs(x) < 1 && y > 20 && y < 22) { const n = g.gasTotal(i); g.gas.fill(0, i * m.NG, i * m.NG + m.NG); g.gas[i * m.NG + m.G_CO2] = n; } }
    /* Eine Wolke von 2 × 2 cm fällt mit gut 10 cm/s (√(g·L·Δρ/ρ)) und mischt sich dabei: in 2 s ist ihr Schwerpunkt mehr als halb unten. */
    runW(w, 2);
    let sy = 0; let sn = 0;
    for (let i = 0; i < g.n; i += 1) { const c = g.gas[i * m.NG + m.G_CO2] - 4e-4 * g.gasTotal(i); if (c > 0) { sy += c * g.cy(i); sn += c; } }
    assert.ok(sy / sn < 11, `a blob of CO₂ sinks toward the bench (${(sy / sn).toFixed(1)} cm, from 21 cm)`);

    const j = world(-12, 12, 30);
    const candle = j.place('candle', 'c', { x: 0 });
    j.ignite(...m.wickOf(candle));
    runW(j, 3);
    assert.ok(candle.on, 'the candle burns in open air');
    const jar = j.place('jar', 'j', { x: 0, size: 500, angle: Math.PI, y: 15 });
    j.drop(jar);
    let out = null;
    for (let k = 0; k < 60 && out === null; k += 1) { runW(j, 1); if (!candle.on) out = gasIn(j, jar, m.G_O2); }
    assert.ok(out !== null && out < 0.18, `under a jar it goes out when oxygen runs low (${out === null ? 'still burning' : (out * 100).toFixed(1) + ' %'})`);

    const f = world(-12, 12, 40);
    const p = f.place('burner', 'p', { x: 0 });
    const tr = f.place('tripod', 't', { x: 0 });
    const b = f.place('beaker', 'b', { x: 0, on: tr, size: 250 });
    f.add('water', 100, b, null, true);
    f.burner(p, true);
    runW(f, 20);
    assert.ok(f.summary(b).T - 293.15 > 3, `the burner flame heats the beaker on the tripod (${(f.summary(b).T - 293.15).toFixed(1)} K in 20 s)`);
    let flame = 0;
    for (let i = 0; i < f.g.n; i += 1) flame = Math.max(flame, f.g.T[i]);
    assert.ok(flame > 1500, `the flame is hot (${flame.toFixed(0)} K)`);

    const h = world(-8, 8, 40);
    const tube = h.place('tube', 't', { x: 0, size: 25 });
    h.add('HCl', 12, tube, null, true);
    h.add('Zn', 2, tube);
    runW(h, 15);
    m.useTool(h, 'splint', tube);
    runW(h, 2);
    assert.ok(said(h, 'Pyk!'), 'hydrogen with air pops at a burning splint');

    const t = world(-12, 12, 40);
    const nacl = t.place('beaker', 'n', { x: -6, size: 50 });
    t.add('NaCl-aq', 30, nacl, null, true);
    const pb = t.place('burner', 'p', { x: 6 });
    t.burner(pb, true);
    runW(t, 1);
    m.useTool(t, 'loop', nacl);
    runW(t, 0.3);
    const loop = t.things.find((u) => u.kind === 'loop');
    t.move(loop, ...m.nozzleOf(pb).map((v, k) => v + (k === 1 ? 2.5 : 0)));
    runW(t, 2);
    assert.ok(said(t, 'żółto'), 'sodium colours the flame yellow');
    ok('gases and fire: CO₂ sinks, the candle under a jar goes out, the burner heats, hydrogen pops, the flame test');
  }
  {
    /* Miareczkowanie: der Umschlag bei 25 cm³. */
    const w = world(-8, 8, 55);
    const f = w.place('flask', 'f', { x: 0, size: 100 });
    w.add('NaOH-dil', 25, f, null, true);
    const bu = w.place('burette', 'b', { x: 0, y: f.y + f.prof.top + 1.5, size: 50 });
    w.add('HCl-dil', 50, bu, null, true);
    w.tap(bu, 1);
    let at20 = null;
    let at30 = null;
    for (let k = 0; k < 40; k += 1) {
      w.stir(f);
      runW(w, 1);
      if (at20 === null && bu.readout >= 20) at20 = w.summary(f).spec.pH;
      if (at30 === null && bu.readout >= 30) at30 = w.summary(f).spec.pH;
    }
    assert.ok(at20 !== null && at20 > 10, `20 cm³ of acid: still basic (pH ${at20?.toFixed(1)})`);
    assert.ok(at30 !== null && at30 < 3.5, `30 cm³: past the equivalence point (pH ${at30?.toFixed(1)})`);
    ok('titration: the pH jumps between 20 and 30 cm³ (equivalence at 25 cm³)');
  }
  {
    /* Lód z solą. */
    const w = world(-8, 8, 20);
    const b = w.place('beaker', 'b', { x: 0, size: 250 });
    w.add('ice-crushed', 60, b, null, true);
    w.add('water', 20, b, null, true);
    w.add('NaCl', 20, b);
    for (let k = 0; k < 50; k += 1) { w.stir(b); runW(w, 2); }
    /* Im Labor: in ein, zwei Minuten −10 °C, mit der Zeit bis −20 °C (die Grenze ist der eutektische Punkt, −21 °C) — das Salz
       löst sich nur so schnell, wie es das Schmelzwasser berührt (Noyes–Whitney, in der Kälte langsamer). */
    assert.ok(w.summary(b).T < 263.5 && w.summary(b).T > 251, `crushed ice with salt cools below −10 °C in 100 s (${(w.summary(b).T - 273.15).toFixed(1)} °C)`);
    /* Ohne Rühren auch: wo Salz das Eis berührt, ist das Eis nass — die Sole taut es weiter. */
    const u = world(-8, 8, 20);
    const c = u.place('beaker', 'b', { x: 0, size: 250 });
    u.add('ice-crushed', 60, c, null, true);
    u.add('water', 20, c, null, true);
    runW(u, 1, 1 / 15);
    u.add('NaCl', 20, c);
    runW(u, 20, 1 / 15);
    assert.ok(u.summary(c).T < 271.5 && said(u, 'Lód topi się w roztworze soli'), `unstirred, salt on ice still makes brine and cools (${(u.summary(c).T - 273.15).toFixed(1)} °C)`);
    ok('ice and salt: a freezing mixture far below 0 °C');
  }

  /* -- Chemia: wie schnell — Lösen, Diffusion, Reaktionsgeschwindigkeit, Gleichgewicht ------------------- */
  const aqIn = (w, t, ion) => { let s = 0; for (const i of t.cells) if (w.g.own[i] === t.num && w.g.lq[i] === 1) s += w.g.comp[i * m.NC + m.AQI[ion]]; return s; };
  const solidIn = (w, t, sp) => { let s = 0; for (const i of t.cells) if (w.g.own[i] === t.num && w.g.sp[i] === m.SOLI[sp]) s += w.g.sn[i]; return s; };
  const mix = (x) => Array.from({ length: m.NG }, (_, k) => x[Object.keys(m.GASI).find((g) => m.GASI[g] === k)] ?? 0);
  {
    /* Lösen nach Noyes–Whitney: 2 g CuSO₄·5H₂O in 50 cm³, 30 s — heiss (D·cₛ grösser), gerührt (dünnere Schicht), Pulver (mehr Fläche). */
    const make = (T, stir, reagent) => {
      const w = world(-10, 10, 14);
      const h = w.place('hotplate', 'h', { x: 0 });
      h.stir = stir;
      const b = w.place('beaker', 'b', { x: 0, on: h, size: 100 });
      w.add('water', 50, b, null, true);
      w.warmTo(b, T);
      w.add(reagent, 2, b);
      runW(w, 30, 1 / 15);
      return aqIn(w, b, 'Cu+2') * 1000;
    };
    const cold = make(278.15, false, 'CuSO4·5H2O');
    const hot = make(353.15, false, 'CuSO4·5H2O');
    const still = make(293.15, false, 'CuSO4·5H2O');
    const stirred = make(293.15, true, 'CuSO4·5H2O');
    const powder = make(293.15, false, 'CuSO4·5H2O-powder');
    near(m.diffusivity(298.15), 1.5e-5, 1e-10, 'D at 25 °C');
    assert.ok(m.diffusivity(353.15) / m.diffusivity(293.15) > 3, 'D(80 °C) is over 3× D(20 °C): T/η(T), Stokes–Einstein');
    assert.ok(hot > 2.5 * cold, `hot water dissolves faster (${hot.toFixed(2)} vs ${cold.toFixed(2)} mmol in 30 s)`);
    assert.ok(stirred > 2 * still, `stirring dissolves faster (${stirred.toFixed(2)} vs ${still.toFixed(2)} mmol)`);
    assert.ok(powder > 2 * still, `powder dissolves faster than crystals (${powder.toFixed(2)} vs ${still.toFixed(2)} mmol)`);
    ok(`dissolving (Noyes–Whitney): hot ×${(hot / cold).toFixed(1)}, stirred ×${(stirred / still).toFixed(1)}, powder ×${(powder / still).toFixed(1)}`);
  }
  {
    /* Diffusion ist langsam: KMnO₄-Lösung unter Wasser, alles ruhig und gleich warm — nach 10 min ist ein wenig nach oben gewandert. */
    const w = world(-8, 8, 14);
    const b = w.place('beaker', 'b', { x: 0, size: 250 });
    w.add('KMnO4-aq', 80, b, null, true);
    w.add('water', 80, b, null, true);
    const ys = b.cells.filter((i) => w.g.own[i] === b.num && w.g.lq[i] === 1 && w.g.liqVol(i) > 0.5 * w.g.room(i)).map((i) => w.g.cy(i));
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const upper = () => { let up = 0; let all = 0; for (const i of b.cells) if (w.g.own[i] === b.num && w.g.lq[i] === 1) { const x = w.g.comp[i * m.NC + m.AQI['MnO4-']]; all += x; if (w.g.cy(i) > mid) up += x; } return up / all; };
    assert.ok(upper() < 1e-6, 'the layers start apart');
    runW(w, 600, 0.5);
    const share = upper();
    assert.ok(share > 0.002 && share < 0.03, `in 10 minutes a little permanganate creeps up (${(share * 100).toFixed(2)} % in the upper half)`);
    ok(`diffusion: still layers mix slowly (${(share * 100).toFixed(2)} % across in 10 min)`);
  }
  {
    /* Geschwindigkeitsgesetze: Tiosiarczan erster Ordnung (halbe Konzentration — halb so viel Schwefel), Arrhenius mit Eₐ = 45 kJ/mol
       (+10 K: etwa doppelt so schnell); H₂O₂ mit I⁻: doppelt so viel Jodid — doppelt so schnell. */
    const thio = (T, ml, water) => {
      const w = world(-10, 10, 16);
      const h = w.place('hotplate', 'h', { x: 0 });
      h.stir = true;
      const f = w.place('flask', 'f', { x: 0, on: h, size: 100 });
      w.add('Na2S2O3', ml, f, null, true);
      if (water > 0) w.add('water', water, f, null, true);
      w.blend(f);
      w.warmTo(f, T);
      w.add('HCl', 5, f);
      runW(w, 30, 1 / 15);
      return solidIn(w, f, 'S');
    };
    const s20 = thio(293.15, 50, 0);
    const s30 = thio(303.15, 50, 0);
    const half = thio(293.15, 25, 25);
    near(m.rateConstant('tiosiarczan', 303.15) / m.rateConstant('tiosiarczan', 293.15), 1.84, 0.02, 'k(30 °C)/k(20 °C) from Ea = 45 kJ/mol');
    near(s20 / half, 2, 0.15, 'half the thiosulfate, half the sulfur (first order)');
    assert.ok(s30 / s20 > 1.5 && s30 / s20 < 2, `10 K warmer: about twice as fast (${(s30 / s20).toFixed(2)}×, the flask cools meanwhile)`);
    const iodide = (g) => {
      const w = world(-10, 10, 18);
      const h = w.place('hotplate', 'h', { x: 0 });
      h.stir = true;
      const f = w.place('flask', 'f', { x: 0, on: h, size: 250 });
      w.add('H2O2', 50, f, null, true);
      w.add('KI-s', g, f);
      runW(w, 4, 1 / 15);
      const a = aqIn(w, f, 'H2O2');
      runW(w, 20, 1 / 15);
      return a - aqIn(w, f, 'H2O2');
    };
    const one = iodide(0.5);
    const two = iodide(1);
    assert.ok(two / one > 1.7 && two / one < 2.1, `H₂O₂ with twice the iodide decomposes twice as fast (${(two / one).toFixed(2)}×)`);
    ok('reaction rates: thiosulfate first order with Arrhenius (Ea 45 kJ/mol), H₂O₂ first order in iodide');
  }
  {
    /* Umkehrbar: Chromian ⇄ Dichromian mit Säure und Lauge; 2NO₂ ⇄ N₂O₄ im geschlossenen Kolben bei K(T) (van 't Hoff, ΔH = +57 kJ/mol). */
    const w = world(-6, 6, 16);
    const t = w.place('tube', 't', { x: 0, size: 25 });
    w.add('K2CrO4', 8, t, null, true);
    runW(w, 0.5);
    w.add('H2SO4', 2, t);
    w.stir(t);
    runW(w, 4);
    assert.ok(aqIn(w, t, 'Cr2O7-2') > 3.5e-4 && said(w, 'staje się pomarańczowy'), 'acid turns chromate into orange dichromate');
    w.add('NaOH-aq', 4, t);
    w.stir(t);
    runW(w, 4);
    assert.ok(aqIn(w, t, 'CrO4-2') > 7e-4 && aqIn(w, t, 'Cr2O7-2') < 1e-5 && said(w, 'żółty chromian'), 'base turns it back');
    const K = (T) => 4.6e-3 * Math.exp(-(57200 / 8.314) * (1 / T - 1 / 298.15));
    const share = {};
    for (const T of [273.15, 333.15]) {
      const u = world(-8, 8, 16);
      const f = u.place('roundflask', 'f', { x: 0, size: 100 });
      u.fillGasMix(f, mix({ NO2: 0.4, N2: 0.6 }));
      u.stopper(f);
      u.warmTo(f, T);
      runW(u, 0.5);
      let dev = 0;
      let n = 0;
      let no2 = 0;
      let all = 0;
      for (const i of f.cells) {
        if (u.g.own[i] !== f.num || u.g.mat[i] !== 0) continue;
        const V = u.g.gasVol(i) / 1000;
        const a = u.g.gas[i * m.NG + m.GASI.NO2];
        const d = u.g.gas[i * m.NG + m.GASI.N2O4];
        if (d <= 0) continue;
        dev += Math.abs(Math.log(((a / V) * (a / V)) / (d / V) / K(u.g.T[i])));
        n += 1;
        no2 += a;
        all += a + 2 * d;
      }
      assert.ok(n > 0 && dev / n < 0.1, `NO₂/N₂O₄ in every cell at K(T) (mean |ln Q/K| ${(dev / n).toFixed(3)})`);
      share[T] = no2 / all;
    }
    assert.ok(share[333.15] > share[273.15] * 1.3, `warmer — more brown NO₂ (${(share[333.15] * 100).toFixed(0)} % vs ${(share[273.15] * 100).toFixed(0)} % of the nitrogen)`);
    ok('reversible: chromate ⇄ dichromate with acid and base; 2NO₂ ⇄ N₂O₄ at K(T), browner when warm');
  }
  {
    /* Hydrolyse der Metallionen (Hydroxo-Komplexe): CuSO₄-Lösung ist sauer — und fällt darum auch heiss kein Cu(OH)₂ aus; FeCl₃ noch saurer. */
    const ph = (r, T = null) => {
      const w = world(-6, 6, 12);
      const b = w.place('beaker', 'b', { x: 0, size: 100 });
      w.add(r, 50, b, null, true);
      if (T !== null) w.warmTo(b, T);
      runW(w, 2, 1 / 15);
      return [w.summary(b, true).spec.pH, solidIn(w, b, 'Cu(OH)2')];
    };
    const [cu, cuSolid] = ph('CuSO4-aq');
    const [, hotSolid] = ph('CuSO4-aq', 353.15);
    const [fe] = ph('FeCl3');
    assert.ok(cu > 3.5 && cu < 4.7 && cuSolid === 0 && hotSolid === 0, `CuSO₄ 0.5 mol/dm³ is acidic (pH ${cu.toFixed(2)}) and stays clear, also hot`);
    assert.ok(fe < 1.8, `FeCl₃ is more acidic (pH ${fe.toFixed(2)})`);
    /* Eine geschlossene Probówka im Wasserbad behält ihr Gas (das Wasser, dem sie Platz nahm, steigt um sie herum). */
    const w = world(-8, 8, 18);
    const b = w.place('beaker', 'b', { x: 0, size: 600 });
    w.add('water', 480, b, null, true);
    const p = w.place('tube', 'p', { x: 0, into: b, size: 10 });
    w.fillGasMix(p, mix({ N2: 1 }));
    w.stopper(p);
    const nOf = () => { let n = 0; for (const i of p.cells) if (w.g.own[i] === p.num && w.g.mat[i] === 0) n += w.g.gasTotal(i); return n; };
    const n0 = nOf();
    runW(w, 5);
    near(nOf() / n0, 1, 1e-4, 'a closed tube in a water bath keeps its gas');
    near(w.summary(p).P, room.p, 0.5, 'and its pressure');
    ok(`metal ions hydrolyse (CuSO₄ pH ${cu.toFixed(1)}, FeCl₃ pH ${fe.toFixed(1)}); a closed tube in a bath keeps its gas`);
  }
  {
    /* Jede fertige Szene baut sich, läuft ein paar Sekunden ohne NaN, und speichert sich verlustfrei. */
    for (const p of [...m.CHEM_PRESETS, { key: 'sandbox', scene: m.SANDBOX_CHEM }]) {
      const scene = m.readChemScene(p.scene);
      const w = m.buildChemWorld(scene, m.drawChem(scene, 'check'), m.seeded('check'));
      for (const s of scene.steps) for (const a of s.do) m.perform(w, a, m.drawChem(scene, 'check'), true);
      runW(w, 2, 1 / 15);
      for (let i = 0; i < w.g.n; i += 1) assert.ok(Number.isFinite(w.g.T[i]), `${p.key}: temperatures stay finite`);
      assert.equal(w.things.filter((t) => t.cells.length === 0).length, 0, `${p.key}: every thing has its place`);
      const saved = m.sceneOfWorld(w, scene);
      const again = m.buildChemWorld(m.readChemScene(JSON.parse(JSON.stringify(saved))), m.drawChem(scene, 'check'), m.seeded('check'));
      assert.equal(again.things.filter((t) => t.kind !== 'stopper').length, w.things.filter((t) => t.kind !== 'stopper').length, `${p.key}: saving keeps every thing`);
    }
    ok(`${m.CHEM_PRESETS.length} chemistry experiments and the sandbox build, run and save without loss`);
  }

  console.log('\napp-lab-check: all passed');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
