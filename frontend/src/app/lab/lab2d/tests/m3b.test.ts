/**
 * LABOR 2D (v2) — M3b: SCHMELZEN UND ANFRIEREN (SANDBOX.md §7, §13; seit
 * 2026-10-23 bleibt ein Eisblock ein Rechteck, seine Seiten rücken). Die
 * Fronten gegen Neumann, der Eiswürfel in warmem Wasser, Eis in Sole an ihrem
 * Gefrierpunkt, gefrierende Sole behält ihr Salz, ein ausgeschnittener Block
 * schmilzt als Rechtecke, Eis auf einer warmen Platte schmilzt von unten; seit
 * 2026-10-25 ein Eiswürfel auf der heissen Platte (sein Schmelzwasser liegt
 * sichtbar daneben, er bleibt stehen) und schräges Eis über ihr (nichts
 * explodiert). Die genaueren Fronten (1 mm), die Kältemischung bis ans
 * Eutektikum und der Würfel auf der Platte bis zum letzten Rest stehen in
 * m3b.slow.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { freezingPoint, M_S, T_MELT } from '../engine/solution';
import { ICE, frontAt, iceInBrine, liquidState, stefanFreeze, stefanMelt } from './ice';
import { scene, waterTolerance } from './scenes';

describe('M3b — test 41: the Stefan problem', () => {
  it('ice at 0 °C under water at 20 °C (cold water below: no convection) melts like Neumann, s = 2λ√(α t): the front speed from 2 to 4 minutes within 5 %, its position after 4 minutes within 10 % (the first seconds are thinner than a cell)', () => {
    const { scene: sc, slope } = stefanMelt('high');
    const e = new Engine(sc, { insulated: true });
    const top0 = e.bodies.list[0].y + e.bodies.list[0].bounds(0)[3];
    const [a, b] = frontAt(e, [120, 240]).map((y) => top0 - y);
    const speed = (b - a) / (Math.sqrt(240) - Math.sqrt(120));
    const want = slope * Math.sqrt(240);
    console.log(`test 41 (melting, 2 mm): front ${(b * 1000).toFixed(3)} mm after 4 min, Neumann ${(want * 1000).toFixed(3)} mm (${(100 * (b / want - 1)).toFixed(1)} %); speed from 2 to 4 min ${(speed * 1000).toFixed(4)} mm/√s, Neumann ${(slope * 1000).toFixed(4)} (${(100 * (speed / slope - 1)).toFixed(1)} %); energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(speed / slope - 1)).toBeLessThan(0.05);
    expect(Math.abs(b / want - 1)).toBeLessThan(0.1);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });

  it('water at its freezing point on ice at −20 °C freezes onto it like Neumann (only the ice conducts): the front after 2 minutes within 10 %', () => {
    const { scene: sc, slope } = stefanFreeze('high');
    const e = new Engine(sc, { insulated: true });
    const top0 = e.bodies.list[0].y + e.bodies.list[0].bounds(0)[3];
    const [s] = frontAt(e, [120]).map((y) => y - top0);
    const want = slope * Math.sqrt(120);
    console.log(`test 41 (freezing, 2 mm): front ${(s * 1000).toFixed(3)} mm after 2 min, Neumann ${(want * 1000).toFixed(3)} mm (${(100 * (s / want - 1)).toFixed(1)} %); frozen ${(e.melt.frozen * 1e6).toFixed(1)} mg; energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(s / want - 1)).toBeLessThan(0.1);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M3b — test 42: an ice cube in warm water', () => {
  it('a 2 cm cube at −5 °C in water at 20 °C melts as one rectangle, never warmer than its melting point; the ice it loses is water in the particles; energy and water exact', () => {
    const e = new Engine(scene({
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.1, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
        { op: 'body', region: { rect: [0.04, 0.035, 0.06, 0.055] }, material: 'ice', T: -5 }
      ]
    }), { insulated: true });
    const b = e.bodies.list[0];
    const m0 = b.m;
    const w0 = e.measureBudget().water;
    let warmest = -Infinity;
    while (e.time < 8) {
      e.step();
      for (let k = 0; k < b.ncell; k += 1) warmest = Math.max(warmest, b.cellT(k));
    }
    const [x0, y0, x1, y1] = b.bounds(0);
    const w = e.measureBudget().water;
    console.log(`test 42: ice ${(m0 * 1000).toFixed(3)} → ${(b.m * 1000).toFixed(3)} g, ${((x1 - x0) * 1000).toFixed(2)} × ${((y1 - y0) * 1000).toFixed(2)} mm, melted ${(e.melt.melted * 1000).toFixed(4)} g, frozen ${(e.melt.frozen * 1000).toFixed(4)} g, warmest ice ${(warmest - 273.15).toFixed(4)} °C, liquid water +${((w.liquid - w0.liquid) * 1000).toFixed(4)} g, energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    expect(b.gone).toBe(false);
    expect(b.nr).toBe(1);
    expect(x1 - x0).toBeLessThan(0.0199);
    expect(y1 - y0).toBeLessThan(0.0199);
    expect(m0 - b.m).toBeGreaterThan(1e-4);
    expect(warmest).toBeLessThanOrEqual(T_MELT + 1e-9);
    expect(Math.abs(m0 - b.m - (e.melt.melted - e.melt.frozen))).toBeLessThan(1e-12 * m0);
    expect(w.ice).toBeCloseTo(b.m, 15);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M3b — test 43: ice in brine settles at the freezing point of the brine', () => {
  it('a 1.5 cm cube at −5 °C in 3.5 % brine at 0 °C: after 2.5 minutes the brine is within 0.2 K of T_f(w) of its diluted mean, the ice too; salt, water and energy exact', () => {
    const e = new Engine(iceInBrine(0.035, 0, -5, 0.015), { insulated: true });
    const b = e.bodies.list[0];
    while (e.time < 150) e.step();
    const L = liquidState(e);
    const Tf = freezingPoint(L.salt / (L.water * M_S));
    console.log(`test 43: brine ${(L.T - 273.15).toFixed(3)} °C (${(L.Tmin - 273.15).toFixed(2)} … ${(L.Tmax - 273.15).toFixed(2)}), w ${(100 * L.salt / (L.salt + L.water)).toFixed(3)} %, T_f(w) ${(Tf - 273.15).toFixed(3)} °C, ice ${(b.meanT() - 273.15).toFixed(3)} °C, melted ${(e.melt.melted * 1000).toFixed(3)} g, salt error ${e.saltError().toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(L.T - Tf)).toBeLessThan(0.2);
    expect(Math.abs(b.meanT() - Tf)).toBeLessThan(0.2);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * L.salt);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  });
});

describe('M3b — test 44: freezing brine keeps all its salt', () => {
  it('3.5 % brine at its freezing point on ice at −20 °C: the ice grows, every gram of salt stays in the brine, which gets saltier by exactly the water that froze', () => {
    const e = new Engine(iceInBrine(0.035, freezingPoint(0.035 / (0.965 * M_S)) - 273.15, -20, 0.015), { insulated: true });
    const b = e.bodies.list[0];
    const m0 = b.m;
    const L0 = liquidState(e);
    while (e.time < 20) e.step();
    const L = liquidState(e);
    console.log(`test 44: ice +${((b.m - m0) * 1e6).toFixed(1)} mg (frozen ${(e.melt.frozen * 1e6).toFixed(1)}, melted ${(e.melt.melted * 1e6).toFixed(1)} mg), salt in the brine ${(L.salt * 1e6).toFixed(3)} mg (${((L.salt - L0.salt) * 1e9).toExponential(2)} µg), w ${(100 * L0.salt / (L0.salt + L0.water)).toFixed(4)} → ${(100 * L.salt / (L.salt + L.water)).toFixed(4)} %, crust on the ice ${b.crustMass()} kg`);
    expect(b.m - m0).toBeGreaterThan(1e-5);
    expect(Math.abs(L.salt - L0.salt)).toBeLessThan(1e-12 * L0.salt);
    expect(b.crustMass()).toBe(0);
    expect(L.salt / L.water).toBeGreaterThan(L0.salt / L0.water);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * L0.salt);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M3b — test 45: a carved ice block melts as rectangles', () => {
  it('a 3 × 2 cm block with a 1 cm notch in warm water: its sides recede only where they are free, it stays a few rectangles that neither overlap nor fall apart; mass, energy and water exact', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.06, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.08, 0.045] }, composition: { H2O: 1 }, phase: 'liquid', T: 40 },
        { op: 'body', region: { rect: [0.025, 0.01, 0.055, 0.03] }, material: 'ice', T: -2, pinned: true },
        { op: 'erase', region: { rect: [0.035, 0.02, 0.045, 0.031] } }
      ]
    }), { insulated: true });
    const b = e.bodies.list[0];
    const nr0 = b.nr;
    const m0 = b.m;
    let most = nr0;
    while (e.time < 6) { e.step(); most = Math.max(most, b.nr); }
    let area = 0;
    let overlap = 0;
    const rects = Array.from({ length: b.nr }, (_, r) => b.bounds(r));
    for (let r = 0; r < rects.length; r += 1) {
      const [x0, y0, x1, y1] = rects[r];
      area += (x1 - x0) * (y1 - y0);
      for (let q = r + 1; q < rects.length; q += 1) {
        const [u0, v0, u1, v1] = rects[q];
        overlap += Math.max(0, Math.min(x1, u1) - Math.max(x0, u0)) * Math.max(0, Math.min(y1, v1) - Math.max(y0, v0));
      }
    }
    console.log(`test 45: ${nr0} rectangles → ${b.nr} (at most ${most}), ice ${(m0 * 1000).toFixed(3)} → ${(b.m * 1000).toFixed(3)} g, overlap ${overlap.toExponential(1)} m², bodies ${e.bodies.list.filter((x) => !x.gone).length}, energy error ${e.energyError().toExponential(2)} J`);
    expect(nr0).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(6);
    expect(e.bodies.list.filter((x) => !x.gone).length).toBe(1);
    expect(overlap).toBeLessThan(1e-14);
    expect(ICE.rho * area * b.depth).toBeCloseTo(b.m, 12);
    expect(m0 - b.m).toBeGreaterThan(1e-5);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M3b — test 46: the side the heat comes through melts', () => {
  it('a 2 × 1 cm ice block at −2 °C on a steel plate at 60 °C, in air: it melts from below and sinks onto the plate as its bottom recedes; the top in air hardly melts; energy and water exact', () => {
    const e = new Engine(scene({
      box: { w: 0.06, h: 0.05, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
      ops: [
        { op: 'hotplate', x: 0.03, y: 0, w: 0.05, h: 0.006, material: 'steel', mode: 'power', power: 4, target: 150, on: true, T: 60 },
        { op: 'body', region: { rect: [0.02, 0.006, 0.04, 0.016] }, material: 'ice', T: -2 }
      ]
    }));
    const [plate, b] = e.bodies.list;
    while (e.time < 10) e.step();
    const [x0, y0, x1, y1] = b.bounds(0);
    const top = (plate.y + plate.bounds(0)[3]) * 1000;
    const bottom = (b.y + y0) * 1000;
    console.log(`test 46: block ${((x1 - x0) * 1000).toFixed(2)} × ${((y1 - y0) * 1000).toFixed(2)} mm (was 20 × 10), its bottom ${(bottom - top).toFixed(3)} mm above the plate, ice ${(b.m * 1000).toFixed(3)} g, energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    /* Unten schmilzt es (der Block wird niedriger), und er sitzt weiter auf der Platte. */
    expect(10 - (y1 - y0) * 1000).toBeGreaterThan(1);
    expect(Math.abs(bottom - top)).toBeLessThan(0.2);
    expect(b.nr).toBe(1);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

/** Eine Heizplatte aus Stahl bei 80 °C in der Mitte einer 8 cm breiten Kiste (Tests 55 und 56). */
const HOT_PLATE = { op: 'hotplate', x: 0.04, y: 0, w: 0.06, h: 0.006, material: 'steel', mode: 'power', power: 10, target: 150, on: true, T: 80 };

describe('M3b — test 55: an ice cube on a hot plate', () => {
  it('a 2 cm cube at −5 °C on a steel plate at 80 °C: its meltwater lies beside it as water (none is held back unseen), it gets lower and narrower and stays where it stands; energy and water exact', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.06, depth: 0.01 },
      ops: [HOT_PLATE, { op: 'body', region: { rect: [0.03, 0.006, 0.05, 0.026] }, material: 'ice', T: -5 }]
    }));
    const [plate, b] = e.bodies.list;
    const x0 = b.x;
    /* Der grösste Anteil des geschmolzenen Eises, der noch nicht als Wasser zu sehen war; die grösste Geschwindigkeit des Würfels. */
    let held = 0;
    let fastest = 0;
    while (e.time < 10) {
      e.step();
      fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
      if (e.time > 1) held = Math.max(held, e.melt.pendingTotals().m / e.melt.melted);
    }
    const [bx0, by0, bx1, by1] = b.bounds(0);
    const top = (plate.y + plate.bounds(0)[3]) * 1000;
    const bottom = (b.y + by0) * 1000;
    console.log(`test 55: cube ${((bx1 - bx0) * 1000).toFixed(2)} × ${((by1 - by0) * 1000).toFixed(2)} mm (was 20 × 20), its bottom ${(bottom - top).toFixed(3)} mm above the plate, moved ${((b.x - x0) * 1000).toFixed(3)} mm, turned ${(b.a * 180 / Math.PI).toFixed(3)}°, fastest ${(fastest * 1000).toFixed(2)} mm/s; melted ${(e.melt.melted * 1e6).toFixed(1)} mg, at most ${(100 * held).toFixed(2)} % of it held back, ${e.particles.count} water particles; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    /* Bis 2026-10-24 wartete das ganze Schmelzwasser unsichtbar (held 100 %, kein Teilchen) und kam später auf einmal. */
    expect(held).toBeLessThan(0.05);
    expect(e.particles.count).toBeGreaterThan(20);
    expect(20 - (by1 - by0) * 1000).toBeGreaterThan(1.5);
    expect(20 - (bx1 - bx0) * 1000).toBeGreaterThan(0.5);
    expect(Math.abs(bottom - top)).toBeLessThan(0.2);
    expect(Math.abs(b.x - x0)).toBeLessThan(5e-4);
    expect(Math.abs(b.a)).toBeLessThan(0.01);
    expect(fastest).toBeLessThan(0.01);
    expect(b.nr).toBe(1);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M3b — test 56: tilted ice over a hot plate', () => {
  /** Dieselbe Platte, 8 mm hoch. */
  const PLATE = { ...HOT_PLATE, h: 0.008 };
  /** 2 s laufen lassen: der freie Körper, seine grösste Geschwindigkeit, ob alles endlich blieb, seine Weltbox am Ende. */
  function tilt(w: number, ops: Record<string, unknown>[]): { e: Engine; fastest: number; finite: boolean; box: Float64Array; b: Engine['bodies']['list'][number] } {
    const e = new Engine(scene({ box: { w, h: 0.06, depth: 0.01 }, ops }));
    const b = e.bodies.list.find((q) => q.free) as Engine['bodies']['list'][number];
    let fastest = 0;
    let finite = true;
    while (e.time < 2 && !b.gone) {
      e.step();
      fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
      if (!Number.isFinite(b.x + b.y + b.a + b.w + e.energyError())) { finite = false; break; }
    }
    const box = new Float64Array(4);
    if (!b.gone && finite) b.worldBox(b.x, b.y, b.a, box);
    console.log(`test 56: after ${e.time.toFixed(2)} s ${b.gone ? 'GONE' : `at (${(b.x * 1000).toFixed(2)}, ${(b.y * 1000).toFixed(2)}) mm, ${(b.a * 180 / Math.PI).toFixed(2)}°, its lowest point ${(box[1] * 1000).toFixed(3)} mm`}, fastest ${(fastest * 1000).toFixed(0)} mm/s, now ${(Math.hypot(b.vx, b.vy) * 1000).toFixed(2)} mm/s; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    return { e, fastest, finite, box, b };
  }
  /** Liegt der Körper auf einer Seite (Winkel ein Vielfaches von 90°, auf 1° genau)? */
  const square = (a: number): boolean => Math.abs(a - (Math.PI / 2) * Math.round(a / (Math.PI / 2))) < Math.PI / 180;

  it('a 4 × 0.8 cm ice bar laid at 10° with one end on a steel step slides off onto the plate and lies there (until 2026-10-24 the air it shut in under itself flung it out of the box at 54 m/s within three steps); energy and water exact', () => {
    const { e, fastest, finite, box, b } = tilt(0.08, [
      PLATE,
      { op: 'body', region: { rect: [0.055, 0.008, 0.075, 0.016] }, material: 'steel', T: 60, pinned: true },
      { op: 'body', region: { rect: [0.025, 0.014, 0.065, 0.022] }, material: 'ice', T: -5, angle: 10 }
    ]);
    expect(finite).toBe(true);
    expect(b.gone).toBe(false);
    expect(fastest).toBeLessThan(0.5);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.005);
    expect(square(b.a)).toBe(true);
    expect(Math.abs(box[1] - 0.008)).toBeLessThan(2e-4);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });

  it('a 2 cm cube standing 3 mm over the edge of the plate tips off and comes to rest on the floor beside it (until 2026-10-24 the run blew up as it tipped); energy and water exact', () => {
    const { e, fastest, finite, box, b } = tilt(0.1, [PLATE, { op: 'body', region: { rect: [0.063, 0.008, 0.083, 0.028] }, material: 'ice', T: -5 }]);
    expect(finite).toBe(true);
    expect(b.gone).toBe(false);
    expect(fastest).toBeLessThan(0.6);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.005);
    expect(square(b.a)).toBe(true);
    expect(box[1]).toBeLessThan(2e-4);
    expect(box[0]).toBeGreaterThan(0.07);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });

  it('a 2 cm cube dropped at 25° lands on the plate and lies flat; energy and water exact', () => {
    const { e, fastest, finite, box, b } = tilt(0.08, [PLATE, { op: 'body', region: { rect: [0.03, 0.03, 0.05, 0.05] }, material: 'ice', T: -5, angle: 25 }]);
    expect(finite).toBe(true);
    expect(b.gone).toBe(false);
    expect(fastest).toBeLessThan(1);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.005);
    expect(square(b.a)).toBe(true);
    expect(Math.abs(box[1] - 0.008)).toBeLessThan(2e-4);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});
