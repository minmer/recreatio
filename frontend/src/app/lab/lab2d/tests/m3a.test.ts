/**
 * LABOR 2D (v2) — M3a: KÖRPER (SANDBOX.md §6, §13; seit 2026-10-23 genaue
 * Rechtecke). Schwimmen (ohne das Schaukeln der Zellen), Sinken, Stapeln,
 * Kippen, die Bilanzen mit bewegten Körpern, das JSON der neuen Handgriffe.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { rhoL, SOLIDS } from '../engine/materials';
import { editObject } from '../engine/objects';
import { readScene, writeScene } from '../engine/scene';
import { T0 } from '../engine/units';
import { scene, waterTolerance } from './scenes';

const rhoOf = (id: string): number => (SOLIDS.find((s) => s.id === id) as { rho: number }).rho;

/** Wasserspiegel (m): wo φ ½ kreuzt, gemittelt über die Spalten, die mehr als `away` vom Punkt x entfernt sind. */
function levelAway(e: Engine, x: number, away: number): number {
  const g = e.grid;
  let s = 0;
  let n = 0;
  for (let i = 3; i < g.nx - 3; i += 1) {
    if (Math.abs((i + 0.5) * g.dx - x) < away) continue;
    let top = -1;
    for (let j = g.ny - 1; j >= 0; j -= 1) if (g.phi[i + j * g.nx] >= 0.5) { top = j; break; }
    if (top < 0 || top >= g.ny - 1) continue;
    const a = g.phi[i + top * g.nx];
    const b = g.phi[i + (top + 1) * g.nx];
    s += (top + 0.5 + (a - 0.5) / (a - b)) * g.dx;
    n += 1;
  }
  return s / n;
}

describe('M3a — test 36: floating depth', () => {
  for (const [mat, W, H, Tw] of [['wood', 0.08, 0.04, 20], ['ice', 0.04, 0.04, 0]] as const) {
    it(`${mat} ${W * 100} × ${H * 100} cm floats with ρ_b/ρ_l of its height under water (±2 %, mean over 3 s); budgets exact`, () => {
      const want = (rhoOf(mat) / rhoL(T0 + Tw)) * H;
      const e = new Engine(scene({
        box: { w: 0.2, h: 0.15, depth: 0.01 },
        ambient: { p: 101.325, T: Tw, rh: 0.5, g: 9.81 },
        ops: [
          { op: 'fill', region: { rect: [0, 0, 0.2, 0.08] }, composition: { H2O: 1 }, phase: 'liquid', T: Tw },
          { op: 'body', region: { rect: [0.1 - W / 2, 0.08 - want, 0.1 + W / 2, 0.08 - want + H] }, material: mat, T: Tw }
        ]
      }), { insulated: true });
      const b = e.bodies.list[0];
      expect(b.free).toBe(true);
      const drafts: number[] = [];
      while (e.time < 6) {
        e.step();
        if (e.time > 3) drafts.push(levelAway(e, b.x, W / 2 + 0.02) - (b.y - H / 2));
      }
      const mean = drafts.reduce((s, d) => s + d, 0) / drafts.length;
      const spread = Math.max(...drafts) - Math.min(...drafts);
      console.log(`test 36 (${mat}): draft ${(mean * 1000).toFixed(3)} mm, ρ_b/ρ_l H ${(want * 1000).toFixed(3)} mm (${(100 * (mean / want - 1)).toFixed(2)} %), bobbing ${(spread * 500).toFixed(2)} mm; angle ${(b.a * 180 / Math.PI).toFixed(2)}°; added mass (x, y) ${(b.ma6[0] * 1000).toFixed(1)}, ${(b.ma6[3] * 1000).toFixed(1)} g of ${(b.m * 1000).toFixed(1)} g; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
      expect(Math.abs(mean / want - 1)).toBeLessThan(0.02);
      /* Genaue Rechtecke: das Wasser, das der Körper verdrängt, ändert sich stetig — kein Schaukeln um ganze Zeilen (mit Voxeln ±1,4 mm). */
      expect(spread * 500).toBeLessThan(0.2e-3 * 1000);
      expect(Math.abs(b.a)).toBeLessThan(0.05);
      expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
      expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
    });
  }
});

describe('M3a — test 37: sinking and resting', () => {
  it('a 2 cm ceramic square sinks at the terminal speed of the drag law, v² = 2(ρ_b/ρ_l − 1) g a/C_D, C_D = 2.1 (±15 %), before its wake turns it over', () => {
    const a = 0.02;
    const depth = 0.28;
    const e = new Engine(scene({
      box: { w: 0.2, h: 0.3, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.2, depth] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
        { op: 'body', region: { rect: [0.1 - a / 2, depth - 0.01 - a, 0.1 + a / 2, depth - 0.01] }, material: 'ceramic', T: 20 }
      ]
    }));
    const b = e.bodies.list[0];
    /* Lyn et al. (1995): ein Quadratzylinder mit Wirbelstrasse, Re 22 000, C_D = 2,1 (auf die Seite a bezogen). Gemessen von 6 bis 14 cm
       (drei bis sieben Seitenlängen): danach dreht ihn seine Wirbelstrasse, er taumelt und gleitet seitlich — eine chaotische Bahn, bei 1 mm
       anders als bei 2 mm, und kein Mass mehr für den Widerstand. */
    const vt = Math.sqrt((2 * (rhoOf('ceramic') / rhoL(T0 + 20) - 1) * 9.81 * a) / 2.1);
    const y0 = b.y;
    let sum = 0;
    let time = 0;
    let turn = 0;
    while (y0 - b.y < 0.14 && e.time < 2) {
      e.step();
      if (y0 - b.y > 0.06) { sum += -b.vy * e.dt; time += e.dt; turn = Math.max(turn, Math.abs(b.a)); }
    }
    const v = sum / time;
    console.log(`test 37 (square): mean speed from 6 to 14 cm ${v.toFixed(3)} m/s, drag law ${vt.toFixed(3)} m/s (${(100 * (v / vt - 1)).toFixed(1)} %), turned up to ${(turn * 180 / Math.PI).toFixed(0)}°, drift sideways ${((b.x - 0.1) * 1000).toFixed(1)} mm`);
    expect(Math.abs(v / vt - 1)).toBeLessThan(0.15);
  });

  it('a stone block lands on the bottom and rests without jitter: after 1 s it moves less than 0.1 mm and falls asleep', () => {
    const e = new Engine(scene({
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.1, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
        { op: 'body', region: { rect: [0.04, 0.02, 0.06, 0.03] }, material: 'stone', T: 20 }
      ]
    }));
    const b = e.bodies.list[0];
    while (e.time < 1) e.step();
    const x0 = b.x;
    const y0 = b.y;
    const a0 = b.a;
    let worst = 0;
    while (e.time < 2) {
      e.step();
      worst = Math.max(worst, Math.hypot(b.x - x0, b.y - y0) + 0.01 * Math.abs(b.a - a0));
    }
    console.log(`test 37 (rest): bottom of the block at ${((b.y - 0.005) * 1000).toFixed(3)} mm, moved at most ${(worst * 1000).toFixed(4)} mm in the second second, ${b.asleep ? 'asleep' : 'awake'}`);
    expect(Math.abs(b.y - 0.005)).toBeLessThan(0.0005);
    expect(worst).toBeLessThan(1e-4);
    expect(b.asleep).toBe(true);
  });
});

describe('M3a — test 38: a stack of two blocks stands', () => {
  it('a wood block dropped 1 cm onto another lands flat on it; both rest in place and fall asleep; energy exact', () => {
    const e = new Engine(scene({
      ops: [
        { op: 'body', region: { rect: [0.07, 0, 0.13, 0.03] }, material: 'wood', T: 20 },
        { op: 'body', region: { rect: [0.08, 0.04, 0.12, 0.06] }, material: 'wood', T: 20 }
      ]
    }), { insulated: true });
    const [lo, hi] = e.bodies.list;
    /* Freie Körper setzen sich am Anfang kurz (bodies.settleStart); der obere fällt. */
    expect(hi.awake).toBe(true);
    const x0 = hi.x;
    while (e.time < 2) e.step();
    console.log(`test 38: upper block at y ${(hi.y * 1000).toFixed(3)} mm (on the lower one: 40.000), x moved ${((hi.x - x0) * 1000).toFixed(4)} mm, angle ${(hi.a * 180 / Math.PI).toFixed(4)}°; lower ${(lo.y * 1000).toFixed(3)} mm; ${lo.asleep && hi.asleep ? 'both asleep' : 'not asleep'}; energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(hi.y - 0.04)).toBeLessThan(0.0003);
    expect(Math.abs(hi.x - x0)).toBeLessThan(0.0005);
    expect(Math.abs(hi.a)).toBeLessThan(0.01);
    expect(Math.abs(lo.y - 0.015)).toBeLessThan(0.0003);
    expect(lo.asleep && hi.asleep).toBe(true);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  });
});

/* -- Kippen: der geometrische Kippwinkel einer Zlewka mit Wasser (Oberfläche waagrecht) ------------------------------ */

type P2 = [number, number];
const rot = (p: P2, t: number): P2 => [p[0] * Math.cos(t) - p[1] * Math.sin(t), p[0] * Math.sin(t) + p[1] * Math.cos(t)];
function clipBelow(poly: P2[], level: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (a[1] <= level) out.push(a);
    if ((a[1] <= level) !== (b[1] <= level)) { const t = (level - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, level]); }
  }
  return out;
}
function areaCentroid(poly: P2[]): { A: number; x: number } {
  let A = 0;
  let cx = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const c = x1 * y2 - x2 * y1;
    A += c / 2;
    cx += (x1 + x2) * c;
  }
  return { A, x: A !== 0 ? cx / (6 * A) : 0 };
}
/** Die waagrechte Höhe, bis zu der die Fläche `area` im Vieleck steht. */
function fillLevel(poly: P2[], area: number): number {
  let lo = Math.min(...poly.map((p) => p[1]));
  let hi = Math.max(...poly.map((p) => p[1]));
  for (let k = 0; k < 60; k += 1) { const mid = (lo + hi) / 2; if (areaCentroid(clipBelow(poly, mid)).A < area) lo = mid; else hi = mid; }
  return lo;
}

describe('M3a — test 39: a beaker of water tips at its geometric tipping angle', () => {
  it('7 × 8 cm glass beaker with 4 cm of water on its corner: released 3° below the angle it falls back, 3° above it falls over (no slip, no spill)', () => {
    const W = 0.07, H = 0.08, WALL = 0.002, X = 0.12, FILL = 0.04;
    const interior: P2[] = [[-W / 2 + WALL, WALL], [W / 2 - WALL, WALL], [W / 2 - WALL, H], [-W / 2 + WALL, H]];
    const glass: P2[][] = [
      [[-W / 2, 0], [-W / 2 + WALL, 0], [-W / 2 + WALL, H], [-W / 2, H]],
      [[W / 2 - WALL, 0], [W / 2, 0], [W / 2, H], [W / 2 - WALL, H]],
      [[-W / 2 + WALL, 0], [W / 2 - WALL, 0], [W / 2 - WALL, WALL], [-W / 2 + WALL, WALL]]
    ];
    const area = (W - 2 * WALL) * (FILL - WALL);
    /* Schwerpunkt-x von Glas und Wasser relativ zur linken unteren Ecke beim Winkel t: > 0 fällt zurück. */
    const lever = (t: number): number => {
      let m = 0, mx = 0;
      for (const r of glass) { const ac = areaCentroid(r.map((p) => rot(p, t))); m += ac.A * rhoOf('glass'); mx += ac.A * rhoOf('glass') * ac.x; }
      const inner = interior.map((p) => rot(p, t));
      const water = areaCentroid(clipBelow(inner, fillLevel(inner, area)));
      return (mx + water.A * 998 * water.x) / (m + water.A * 998) - rot([-W / 2, 0], t)[0];
    };
    let a0 = 0, a1 = Math.PI / 2;
    for (let k = 0; k < 60; k += 1) { const m = (a0 + a1) / 2; if (lever(m) > 0) a0 = m; else a1 = m; }
    const thetaC = (a0 * 180) / Math.PI;
    const run = (deg: number): { angle: number; water: number; water0: number; error: number; tolerance: number } => {
      const t = (deg * Math.PI) / 180;
      const y0 = (W / 2) * Math.sin(t) + 0.0001;
      const inner = interior.map((p) => rot(p, t)).map((p): P2 => [X + p[0], y0 + p[1]]);
      /* 20 cm hoch (bis 2026-10-25 15 cm): das Wasser der umgefallenen Zlewka läuft mit 1,7–1,9 m/s über den Boden und an der linken
         Wand 15–18 cm hinauf (v²/2g), seit sich die Flächen ihrer geschlossenen Zellen mit ihr bewegen (bodyCover.closedFace) — über
         eine offene Decke bei 15 cm ging es hinaus. Geprüft wird, dass kein Wasser verloren geht, nicht, wie hoch es spritzt. */
      const e = new Engine(scene({
        box: { w: 0.24, h: 0.2, depth: 0.01 },
        ops: [
          { op: 'beaker', x: X, y: y0, w: W, h: H, wall: WALL, material: 'glass', T: 20, angle: deg },
          { op: 'fill', region: { poly: clipBelow(inner, fillLevel(inner, area)) }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
        ]
      }));
      const b = e.bodies.list[0];
      const mass = (): number => { let s = 0; for (let p = 0; p < e.particles.count; p += 1) s += e.particles.mass[p]; return s; };
      /* Angeheftet, bis das Wasser waagrecht steht; dann los. */
      while (e.time < 1.5) e.step();
      const water0 = mass();
      /* Die Einstellung „Przypięty“ der Zlewka aus — während es läuft (sie heisst beaker-1). */
      expect(editObject(e, 'beaker-1', { pinned: false })).toEqual({ rebuilt: false, warning: null });
      expect(b.awake).toBe(true);
      while (e.time < 3.5) e.step();
      return { angle: (b.a * 180) / Math.PI, water: mass(), water0, error: e.waterError(), tolerance: waterTolerance(e) };
    };
    const below = run(thetaC - 3);
    const above = run(thetaC + 3);
    console.log(`test 39: geometric tipping angle ${thetaC.toFixed(2)}°; released at ${(thetaC - 3).toFixed(2)}° it ends at ${below.angle.toFixed(2)}°, at ${(thetaC + 3).toFixed(2)}° at ${above.angle.toFixed(2)}°; liquid water ${(below.water * 1000).toFixed(2)} / ${(above.water * 1000).toFixed(2)} g (evaporated ${((below.water0 - below.water) * 1e6).toFixed(3)} / ${((above.water0 - above.water) * 1e6).toFixed(3)} mg), water errors ${below.error.toExponential(2)} / ${above.error.toExponential(2)} kg`);
    expect(Math.abs(below.angle)).toBeLessThan(1);
    expect(above.angle).toBeGreaterThan(60);
    /* Kein Wasser verloren (nur ein wenig verdunstet, die Luft hat 50 % Feuchte); die Bilanz genau. */
    expect(Math.abs(below.water / below.water0 - 1)).toBeLessThan(1e-4);
    expect(Math.abs(above.water / above.water0 - 1)).toBeLessThan(1e-4);
    expect(Math.abs(below.error)).toBeLessThan(below.tolerance);
    expect(Math.abs(above.error)).toBeLessThan(above.tolerance);
  });
});

describe('M3a — test 40: budgets close with moving solids', () => {
  it('a hot stone sinks and a warm wood block floats in cold water: energy, water and air exact while they move and share heat', () => {
    const e = new Engine(scene({
      box: { w: 0.1, h: 0.1, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.1, 0.04] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
        { op: 'body', region: { rect: [0.03, 0.06, 0.042, 0.072] }, material: 'stone', T: 80 },
        { op: 'body', region: { rect: [0.06, 0.05, 0.085, 0.06] }, material: 'wood', T: 40 }
      ]
    }), { insulated: true });
    const heat = (): number => { let s = 0; for (const b of e.bodies.list) for (let k = 0; k < b.ncell; k += 1) s += b.E[k]; return s; };
    const E0 = heat();
    const air0 = e.measureBudget().air;
    while (e.time < 2) e.step();
    const [stone, wood] = e.bodies.list;
    const air = e.measureBudget().air;
    console.log(`test 40: the bodies gave ${(E0 - heat()).toFixed(3)} J to water and air; stone ${stone.asleep ? 'resting' : 'moving'} at ${(stone.y * 1000).toFixed(1)} mm, wood at ${(wood.y * 1000).toFixed(1)} mm; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg, air ${(air - air0).toExponential(2)} kg`);
    expect(E0 - heat()).toBeGreaterThan(1);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
    expect(Math.abs(air - air0)).toBeLessThan(1e-12 * air0);
  });
});

/* -- Freie Körper in einer Zlewka, deren Wände von 2 mm quer über zwei Zellen liegen (die Zlewkas der Vorlagen bei 2 mm) -- */

describe('M3a — free bodies in a beaker whose walls lie across cells (2026-10-25)', () => {
  /** Eine Zlewka 4 × 5 cm, Wände 2 mm bei x 31–33 und 69–71 mm (halbe Zellen), Wasser 3 cm hoch; der Körper aus `body`. */
  const beakerScene = (Tw: number, body: Record<string, unknown>): ReturnType<typeof scene> => scene({
    box: { w: 0.1, h: 0.07, depth: 0.01 },
    ambient: { p: 101.325, T: Tw, rh: 0.5, g: 9.81 },
    ops: [
      { op: 'beaker', x: 0.051, y: 0.004, w: 0.04, h: 0.05, wall: 0.002, material: 'glass', T: Tw },
      { op: 'fill', region: { rect: [0.033, 0.006, 0.069, 0.036] }, composition: { H2O: 1 }, phase: 'liquid', T: Tw },
      body
    ]
  });
  /** Wasser ausserhalb des Umrisses der Zlewka (kg). */
  const outside = (e: Engine): number => {
    let m = 0;
    for (let p = 0; p < e.particles.count; p += 1) { const x = e.particles.x[p]; if (x < 0.031 || x > 0.071 || e.particles.y[p] < 0.004) m += e.particles.mass[p]; }
    return m;
  };

  it('a pine block dropped 2 mm onto the water settles: nothing leaves through the walls, no jets, bobbing and tilt small, budgets exact', () => {
    const H = 0.012;
    const want = (rhoOf('wood') / rhoL(T0 + 20)) * H;
    const e = new Engine(beakerScene(20, { op: 'body', region: { rect: [0.041, 0.038 - want, 0.061, 0.038 - want + H] }, material: 'wood', T: 20 }));
    const b = e.bodies.list[1];
    expect(b.free).toBe(true);
    let out = 0, uMax = 0, ymin = Infinity, ymax = -Infinity, tilt = 0;
    while (e.time < 3) {
      e.step();
      out = Math.max(out, outside(e));
      if (e.time > 2) { uMax = Math.max(uMax, e.liquid.last.uMax); ymin = Math.min(ymin, b.y); ymax = Math.max(ymax, b.y); tilt = Math.max(tilt, Math.abs(b.a)); }
    }
    console.log(`walls across cells (wood): water outside the beaker ${(out * 1e6).toFixed(3)} mg; in the third second fastest water ${(uMax * 1000).toFixed(1)} mm/s, bobbing ${((ymax - ymin) * 1000).toFixed(3)} mm, tilt ${(tilt * 180 / Math.PI).toFixed(2)}°; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    /* Bis 2026-10-25: das Wasser holte den Körper einen Schritt zu spät ein und gewann dabei Energie (in der dritten Sekunde Wasser mit
       0,48 m/s, der Klotz schwankte 5 mm und kippte 25°); das Abstandsfeld schob Wasser aus dem zugeklappten Spalt quer durch die Wand (50 mg).
       Was bleibt (bis 0,05 m/s, 0,3 mm), kommt vom Abklingen des Falls und von den halb bedeckten Zellen an der Wasserlinie (an den
       Wänden und am Klotz: sie kippen zwischen flüssig und Gas, ARCHITECTURE.md §17). */
    expect(out).toBe(0);
    expect(uMax).toBeLessThan(0.1);
    expect(ymax - ymin).toBeLessThan(0.001);
    expect(tilt).toBeLessThan((2 * Math.PI) / 180);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });

  it('an ice cube melting against such a wall in water at 80 °C keeps its meltwater inside; budgets exact', () => {
    const W = 0.012;
    const want = (rhoOf('ice') / rhoL(T0 + 80)) * W;
    const x1 = 0.069 - 0.0005;
    const e = new Engine(beakerScene(80, { op: 'body', region: { rect: [x1 - W, 0.036 - want, x1, 0.036 - want + W] }, material: 'ice', T: -10 }));
    let out = 0;
    while (e.time < 3) { e.step(); out = Math.max(out, outside(e)); }
    const ice = e.bodies.list[1];
    console.log(`walls across cells (ice): melted ${((1 - ice.m / (rhoOf('ice') * W * W * 0.01)) * 100).toFixed(1)} %, water outside the beaker ${(out * 1e6).toFixed(3)} mg; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    /* Bis 2026-10-25 kam Schmelzwasser, das vor der Seite keinen Platz fand, zwei Millimeter weiter heraus — hinter der Wand (5 mg in 3 s). */
    expect(out).toBe(0);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  });
});

describe('M3a — bodies in the scene format and on the accelerated view', () => {
  it('body and pin round-trip through JSON; beakers and plates stay pinned unless told; older scenes write without the settings they do not use', () => {
    const raw = scene({
      ops: [
        { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, on: true, T: 20 },
        { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20 },
        { op: 'body', region: { rect: [0.02, 0.1, 0.05, 0.12] }, material: 'wood', T: 20, angle: 15 },
        { op: 'body', region: { rect: [0.16, 0.04, 0.18, 0.06] }, material: 'stone', T: 20, pinned: true },
        { op: 'pin', x: 0.1, y: 0.009, pinned: false }
      ]
    });
    const { scene: sc, warnings } = readScene(raw);
    expect(warnings).toEqual([]);
    expect(readScene(writeScene(sc)).scene).toEqual(sc);
    const e = new Engine(sc);
    expect(e.warnings).toEqual([]);
    const [plate, beaker, wood, stone] = e.bodies.list;
    expect(plate.pinned).toBe(true);
    expect(beaker.pinned).toBe(false);
    expect(wood.pinned).toBe(false);
    expect(Math.abs(wood.a - (15 * Math.PI) / 180)).toBeLessThan(1e-12);
    expect(stone.pinned).toBe(true);
    /* Freie Körper (bis acht, ohne Eis und Körner) rechnet seit 2026-10-26 auch der beschleunigte Weg (gpu/kbody*.ts). */
    expect(e.needsCpu()).toBe(false);
    /* Nur angeheftete Körper: der beschleunigte Weg kann die Szene. */
    const old = scene({ ops: raw.ops.slice(0, 2) });
    const plain = new Engine(old);
    expect(plain.needsCpu()).toBe(false);
    for (const op of writeScene(readScene(old).scene).ops as Record<string, unknown>[]) {
      expect('pinned' in op).toBe(false);
      expect('angle' in op).toBe(false);
    }
    /* Körper sind Rechtecke: ein Kreis wird das Quadrat gleicher Fläche (mit einer Warnung), eine Strecke mit Breite ein gedrehtes Rechteck. */
    const round = new Engine(scene({ ops: [
      { op: 'body', region: { circle: [0.1, 0.05, 0.01] }, material: 'stone', T: 20, pinned: true },
      { op: 'body', region: { line: [0.02, 0.1, 0.06, 0.14], width: 0.004 }, material: 'wood', T: 20, pinned: true }
    ] }));
    expect(round.warnings.some((w) => w.includes('square'))).toBe(true);
    const [sq, bar] = round.bodies.list;
    const [x0, y0, x1, y1] = sq.bounds(0);
    expect((x1 - x0) * (y1 - y0)).toBeCloseTo(Math.PI * 0.01 * 0.01, 12);
    expect(Math.abs(bar.a - Math.PI / 4)).toBeLessThan(1e-12);
    const [bx0, by0, bx1, by1] = bar.bounds(0);
    expect(bx1 - bx0).toBeCloseTo(Math.hypot(0.04, 0.04), 12);
    expect(by1 - by0).toBeCloseTo(0.004, 12);
  });

  it('objects: every object has a name; its settings change in place (pinned at any time, the set-up only at the start); move and remove by name, budgets exact', () => {
    const { scene: sc, warnings } = readScene(scene({
      ops: [
        { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 0, on: false, T: 20 },
        { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20 },
        { op: 'fill', region: { rect: [0.067, 0.01, 0.133, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
        { op: 'body', id: 'kostka', region: { rect: [0.09, 0.045, 0.11, 0.065] }, material: 'ice', T: -5 },
        { op: 'body', region: { rect: [0.01, 0.1, 0.05, 0.12] }, material: 'wood', T: 20, pinned: true },
        { op: 'body', id: 'kostka', region: { rect: [0.16, 0.1, 0.18, 0.12] }, material: 'stone', T: 20, pinned: true },
        { op: 'move', id: 'nikt', dx: 0.01, dy: 0 }
      ]
    }));
    /* Namen: vergeben, wo keiner stand; ein doppelter umbenannt; ein Schritt mit unbekanntem Namen fällt weg. */
    const names = sc.ops.map((o) => ('id' in o ? o.id : null));
    expect(names).toEqual(['hotplate-1', 'beaker-1', null, 'kostka', 'body-1', 'body-2']);
    expect(warnings.length).toBe(2);
    expect(readScene(writeScene(sc)).scene).toEqual(sc);
    const e = new Engine(sc);
    const ops = e.scene.ops.length;
    const ice = (): typeof e.bodies.list => e.bodies.list.filter((b) => !b.gone && b.key === 3);
    /* „Przypięty“ ändert den Gegenstand an seiner Stelle — kein Handgriff kommt hinzu. */
    expect(editObject(e, 'kostka', { pinned: true })).toEqual({ rebuilt: false, warning: null });
    expect(e.scene.ops.length).toBe(ops);
    expect((e.scene.ops[3] as { pinned: boolean }).pinned).toBe(true);
    expect(ice()[0].pinned).toBe(true);
    /* Am Anfang ändert eine Temperatur den Aufbau: die Szene entsteht neu, mit dem Würfel bei −20 °C, weiter angeheftet. */
    expect(editObject(e, 'kostka', { T: T0 - 20 })).toEqual({ rebuilt: true, warning: null });
    expect(e.scene.ops.length).toBe(ops);
    expect(ice()[0].meanT()).toBeCloseTo(T0 - 20, 6);
    expect(ice()[0].pinned).toBe(true);
    for (let k = 0; k < 30; k += 1) e.step();
    /* Läuft es, lehnt die Engine den Aufbau ab; „Przypięty“ geht weiter: der Würfel ist frei. */
    expect(editObject(e, 'kostka', { T: T0 })?.warning?.startsWith('refused')).toBe(true);
    expect(editObject(e, 'kostka', { pinned: false })).toEqual({ rebuilt: false, warning: null });
    expect(ice()[0].pinned).toBe(false);
    /* Die Zlewka mit allem darin 1 cm nach rechts: ihr Wasser und der Würfel darin gehen mit, die Platte nicht. */
    const beaker = e.bodies.list.find((b) => b.key === 1) as (typeof e.bodies.list)[number];
    const plate = e.bodies.list.find((b) => b.key === 0) as (typeof e.bodies.list)[number];
    const bx = beaker.x;
    const px = plate.x;
    const cx = ice()[0].x;
    const inside = (): number => { let n = 0; for (let p = 0; p < e.particles.count; p += 1) if (e.particles.x[p] > beaker.x - 0.033 && e.particles.x[p] < beaker.x + 0.033) n += 1; return n; };
    const before = inside();
    const err0 = e.energyError();
    e.apply({ op: 'move', region: null, id: 'beaker-1', dx: 0.01, dy: 0 });
    expect(beaker.x - bx).toBeCloseTo(0.01, 12);
    expect(plate.x).toBe(px);
    expect(ice()[0].x - cx).toBeCloseTo(0.01, 9);
    expect(inside()).toBe(before);
    /* Wegnehmen ist gebucht: Energie und Wasser (Eis zählt als Wasser) schliessen. */
    e.apply({ op: 'remove', id: 'kostka' });
    e.apply({ op: 'remove', id: 'body-1' });
    expect(ice().length).toBe(0);
    expect(Math.abs(e.energyError() - err0)).toBeLessThan(1e-9);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
    /* Verschieben und Wegnehmen stehen mit Namen im JSON. */
    const back = readScene(e.serialize()).scene.ops;
    expect(back.slice(-3)).toEqual([{ op: 'move', region: null, id: 'beaker-1', dx: 0.01, dy: 0 }, { op: 'remove', id: 'kostka' }, { op: 'remove', id: 'body-1' }]);
  });
});
