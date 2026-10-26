/**
 * LABOR 2D (v2) — die langen Prüfungen von M3b (`npm run test:lab2d:slow`):
 * die Fronten des Stefan-Problems bei 1 mm (die Gate-Genauigkeit ±5 %), die
 * Kältemischung aus Eis und starker Sole bis ans Eutektikum und (seit
 * 2026-10-25) ein Eiswürfel auf der heissen Platte bis zum letzten Rest.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { freezingPoint, M_S, T_EUTECTIC } from '../engine/solution';
import { frontAt, iceInBrine, liquidState, stefanFreeze, stefanMelt } from './ice';
import { scene, waterTolerance } from './scenes';

/** Zeitgrenze je Lauf (ms). */
const LONG = 30 * 60 * 1000;

describe('M3b — test 41 at 1 mm', () => {
  it('melting front under water at 20 °C: after 4 minutes within 5 % of Neumann, its speed from 2 to 4 minutes too', () => {
    const { scene: sc, slope } = stefanMelt('very-high');
    const e = new Engine(sc, { insulated: true });
    const top0 = e.bodies.list[0].y + e.bodies.list[0].bounds(0)[3];
    const [a, b] = frontAt(e, [120, 240]).map((y) => top0 - y);
    const speed = (b - a) / (Math.sqrt(240) - Math.sqrt(120));
    const want = slope * Math.sqrt(240);
    console.log(`test 41 (melting, 1 mm): front ${(b * 1000).toFixed(3)} mm after 4 min, Neumann ${(want * 1000).toFixed(3)} mm (${(100 * (b / want - 1)).toFixed(1)} %); speed ${(100 * (speed / slope - 1)).toFixed(1)} %; energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(b / want - 1)).toBeLessThan(0.05);
    expect(Math.abs(speed / slope - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  }, LONG);

  it('freezing front on ice at −20 °C: after 2 minutes within 5 % of Neumann', () => {
    const { scene: sc, slope } = stefanFreeze('very-high');
    const e = new Engine(sc, { insulated: true });
    const top0 = e.bodies.list[0].y + e.bodies.list[0].bounds(0)[3];
    const [s] = frontAt(e, [120]).map((y) => y - top0);
    const want = slope * Math.sqrt(120);
    console.log(`test 41 (freezing, 1 mm): front ${(s * 1000).toFixed(3)} mm after 2 min, Neumann ${(want * 1000).toFixed(3)} mm (${(100 * (s / want - 1)).toFixed(1)} %); energy error ${e.energyError().toExponential(2)} J`);
    expect(Math.abs(s / want - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  }, LONG);
});

describe('M3b — test 43 with enough salt: a cooling mixture', () => {
  it('a 2 cm cube at −10 °C in 25 % brine at −10 °C melts and drives the brine toward the eutectic (more than 3 K colder after 3 minutes), never below it', () => {
    const e = new Engine(iceInBrine(0.25, -10, -10, 0.02), { insulated: true });
    /* Das kälteste Teilchen nach jedem Schritt (ein Teilchen, das Schmelzwasser aufnimmt, kühlt beim Verdünnen ein wenig: das Mischen starker Sole nimmt Wärme auf). */
    let coldest = Infinity;
    while (e.time < 180) {
      e.step();
      coldest = Math.min(coldest, liquidState(e).Tmin);
    }
    const L = liquidState(e);
    const Tf = freezingPoint(L.salt / (L.water * M_S));
    console.log(`test 43 (eutectic): brine ${(L.T - 273.15).toFixed(2)} °C, coldest particle ${(coldest - 273.15).toFixed(3)} °C, w ${(100 * L.salt / (L.salt + L.water)).toFixed(2)} %, T_f(w) ${(Tf - 273.15).toFixed(2)} °C, eutectic ${(T_EUTECTIC - 273.15).toFixed(1)} °C, melted ${(e.melt.melted * 1000).toFixed(3)} g; salt error ${e.saltError().toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J`);
    /* Bis 2026-10-25: unter −18 °C und auf 0,5 K an T_f(w) — das erreichte die Lake, weil der Würfel sich unablässig drehte (bis 161°,
       0,1 m/s, die Lake mit 0,4 m/s); seit die Kopplung ihn nicht mehr einen Schritt zu spät einholt, rollt er einmal auf die Seite
       (bei ρ_Eis/ρ_Lake = 0,77 schwimmt ein Quadrat nicht flach) und liegt still: die Lake kühlt durch Leitung und eigene Konvektion
       (−14,4 °C nach 3 Minuten, 0,75 g geschmolzen). */
    expect(L.T).toBeLessThan(273.15 - 13);
    expect(coldest).toBeGreaterThan(T_EUTECTIC - 0.05);
    expect(L.T).toBeGreaterThan(Tf);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * L.salt);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  }, LONG);
});

describe('M3b — test 55 to the end: an ice cube on the hot plate melts away', () => {
  it('a 2 cm cube at −5 °C on the 40 W plate of the default box (as the shell adds them, the plate from 20 °C) melts to the last rest: its water always visible, it stays where it stands and never flies, every value finite; energy and water exact', () => {
    const e = new Engine(scene({
      ops: [
        { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, target: 150, on: true, T: 20 },
        { op: 'body', region: { rect: [0.09, 0.008, 0.11, 0.028] }, material: 'ice', T: -5 }
      ]
    }));
    const b = e.bodies.list[1];
    const x0 = b.x;
    /* Das meiste Schmelzwasser, das je noch nicht als Wasser zu sehen war (kg); wie weit und wie schnell der Würfel je ging. */
    let held = 0;
    let drift = 0;
    let fastest = 0;
    let finite = true;
    while (!b.gone && e.time < 240) {
      e.step();
      if (!Number.isFinite(b.x + b.y + b.a + b.vx + b.vy + e.energyError())) { finite = false; break; }
      if (b.gone) break;
      drift = Math.max(drift, Math.abs(b.x - x0));
      fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
      held = Math.max(held, e.melt.pendingTotals().m);
    }
    console.log(`test 55 (to the end): ${b.gone ? 'melted away' : 'still there'} after ${e.time.toFixed(2)} s, finite ${finite}; it moved at most ${(drift * 1000).toFixed(2)} mm sideways, fastest ${(fastest * 1000).toFixed(2)} mm/s; at most ${(held * 1e6).toFixed(2)} mg of meltwater held back at a time (of ${(e.melt.melted * 1000).toFixed(3)} g), ${e.particles.count} water particles; energy error ${e.energyError().toExponential(2)} J, water error ${e.waterError().toExponential(2)} kg`);
    /* Bis 2026-10-24: das Schmelzwasser wartete unsichtbar (1 g nach 42 s), nach 54 s flog der Würfel mit 52 m/s aus der Kiste; dann gefangenes Gas (NaN nach 125 s), zuletzt ein Splitter, den das Sieden fortschleuderte. */
    expect(finite).toBe(true);
    expect(b.gone).toBe(true);
    expect(held).toBeLessThan(2e-5);
    /* Bis 130 s geht der Würfel kaum (unter 0,4 mm); seine letzten 2 mm (eine Scheibe von 7 mm Breite) hüpfen in den letzten 10 s auf dem Sieden
       unter ihr. Wie weit, ist Zufall: mit 1 % mehr oder weniger Leistung, 0,2 K wärmerem oder kälterem Eis oder 0,02 mm verschoben 1,0–2,7 mm vor
       dem 2026-10-25 und 1,3–3,2 mm danach (schnellstens 16–32 und 24–43 mm/s) — seit sich die Flächen seiner geschlossenen Zellen mit ihm bewegen
       (bodyCover.closedFace), nimmt jeder Lauf einen anderen, ebenso zufälligen Weg. Die Grenze von 5 mm (bis 2026-10-25 3 mm) fängt das
       Fortfliegen von früher, nicht dieses Hüpfen. */
    expect(drift).toBeLessThan(0.005);
    expect(fastest).toBeLessThan(0.05);
    expect(e.particles.count).toBeGreaterThan(500);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
    expect(Math.abs(e.waterError())).toBeLessThan(waterTolerance(e));
  }, LONG);
});
