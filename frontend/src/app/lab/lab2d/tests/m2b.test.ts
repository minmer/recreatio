/**
 * LABOR 2D (v2) — M2b: Kochsalzlösungen. Tore aus SANDBOX.md §13: die
 * Stoffwerte gegen ihre Quellen (Dichte bei 10 und 20 %, osmotischer
 * Koeffizient, Siedepunkt bei 1 und 3 mol/kg, Gefrierpunkt bei 1 und
 * 3 mol/kg, Wärmekapazität und Enthalpie, Wasseraktivität der gesättigten
 * Lösung), dann die Engine: Hydrostatik von Sole unter Wasser, die Luft über
 * gesättigter Sole, Salz genau über dem Sieden, ein Tropfen trocknet zur
 * Kruste. Dass reines Wasser und Öl dieselben Zahlen geben wie vor M2b,
 * prüfen die Tests von M1 und M2a (und ein Vergleich Bit für Bit,
 * MILESTONES.md).
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { pSatFast, tSat } from '../engine/if97';
import { MOLAR } from '../engine/materials';
import { readScene, writeScene } from '../engine/scene';
import {
  boilingPoint, cpSol, freezingPoint, hCrystal, hSol, hWaterIn, massFraction, molality, M_S, M_W, osmotic, rhoSol,
  satFraction, satMolality, tFromHSol, waterActivity
} from '../engine/solution';
import { H2O, N2, O2, T0 } from '../engine/units';
import { scene } from './scenes';

const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;
const MOL = [0.1, 0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 6];

/** Lagrange durch die vier Tabellenwerte um x. */
function interp(x: number, xs: readonly number[], ys: readonly number[]): number {
  let k = xs.findIndex((v) => v > x);
  if (k < 2) k = 2;
  if (k > xs.length - 2) k = xs.length - 2;
  const X = xs.slice(k - 2, k + 2);
  const Y = ys.slice(k - 2, k + 2);
  let s = 0;
  for (let i = 0; i < 4; i += 1) {
    let l = 1;
    for (let j = 0; j < 4; j += 1) if (j !== i) l *= (x - X[j]) / (X[i] - X[j]);
    s += l * Y[i];
  }
  return s;
}

/** Bodnar (1993): Salinität (Gew.-%) = 1,78 θ − 0,0442 θ² + 0,000557 θ³ — nach θ aufgelöst. */
function bodnar(wt: number): number {
  let th = wt / 1.78;
  for (let i = 0; i < 50; i += 1) th -= (1.78 * th - 0.0442 * th * th + 0.000557 * th ** 3 - wt) / (1.78 - 0.0884 * th + 0.001671 * th * th);
  return th;
}

function saltIn(e: Engine): number {
  return e.particles.saltMass();
}

describe('M2b — test 23: sodium chloride against its sources', () => {
  it('density at 10 and 20 % (20 and 25 °C) within ±0.3 % of Pitzer, Peiper & Busey (1984), Table A-15', () => {
    const rows: [number, number[]][] = [
      [293.15, [1.00239, 1.00851, 1.01850, 1.02827, 1.03783, 1.07421, 1.10795, 1.13940, 1.16894, 1.19688]],
      [298.15, [1.00117, 1.00722, 1.01710, 1.02676, 1.03623, 1.07228, 1.10577, 1.13705, 1.16644, 1.19423]]
    ];
    for (const [T, row] of rows) {
      for (const w of [0.1, 0.2]) {
        const ref = 1000 * interp(molality(w), MOL, row);
        const got = rhoSol(T, w);
        console.log(`test 23: ρ(${(T - T0).toFixed(0)} °C, ${(100 * w).toFixed(0)} %) = ${got.toFixed(2)} kg/m³, PPB ${ref.toFixed(2)} (${(100 * (got / ref - 1)).toFixed(3)} %)`);
        expect(Math.abs(got / ref - 1)).toBeLessThan(0.003);
      }
    }
  });

  it('osmotic coefficient at 25 and 100 °C, 0.1–6 mol/kg, within ±0.5 % of PPB Table A-9', () => {
    const p25 = [0.933, 0.922, 0.922, 0.928, 0.935, 0.984, 1.045, 1.114, 1.190, 1.272];
    const p100 = [0.922, 0.912, 0.914, 0.922, 0.933, 0.985, 1.043, 1.101, 1.158, 1.211];
    let worst = 0;
    MOL.forEach((m, k) => {
      worst = Math.max(worst, Math.abs(osmotic(298.15, m) / p25[k] - 1), Math.abs(osmotic(373.15, m) / p100[k] - 1));
    });
    console.log(`test 23: φ — largest deviation from PPB ${(100 * worst).toFixed(3)} %`);
    expect(worst).toBeLessThan(0.005);
  });

  it('boiling point at 1 and 3 mol/kg within ±0.1 K of the one from PPB’s osmotic coefficients (a_w p_sat(T_b) = 101.325 kPa)', () => {
    for (const [m, phi] of [[1, 0.933], [3, 1.043]] as const) {
      const aw = Math.exp(-2 * m * phi * M_W);
      const ref = tSat(101325 / aw);
      const got = boilingPoint(101325, m);
      console.log(`test 23: T_b(${m} mol/kg) = ${(got - T0).toFixed(3)} °C, from PPB ${(ref - T0).toFixed(3)} °C, pure water ${(tSat(101325) - T0).toFixed(3)} °C`);
      expect(Math.abs(got - ref)).toBeLessThan(0.1);
    }
  });

  it('freezing point at 1 and 3 mol/kg within ±0.1 K of the measurements (Bodnar 1993)', () => {
    for (const m of [1, 3]) {
      const ref = T0 - bodnar(100 * massFraction(m));
      const got = freezingPoint(m);
      console.log(`test 23: T_f(${m} mol/kg) = ${(got - T0).toFixed(3)} °C, Bodnar ${(ref - T0).toFixed(3)} °C`);
      expect(Math.abs(got - ref)).toBeLessThan(0.1);
    }
  });

  it('the air over saturated brine: a_w = 75.47, 75.29, 75.09 % at 20, 25, 30 °C within ±0.3 % RH (Greenspan 1977)', () => {
    for (const [T, rh] of [[293.15, 75.47], [298.15, 75.29], [303.15, 75.09]] as const) {
      const aw = waterActivity(T, satMolality(T));
      console.log(`test 23: saturated at ${(T - T0).toFixed(0)} °C: a_w ${(100 * aw).toFixed(2)} %, Greenspan ${rh} %`);
      expect(Math.abs(100 * aw - rh)).toBeLessThan(0.3);
    }
  });

  it('heat capacity and sensible enthalpy of 1 and 3 mol/kg solutions within ±0.5 % of PPB Table A-17', () => {
    /* Specific enthalpy of the solution at 1 bar (J/g; only differences count): 20, 25, 30, 100 °C. */
    const h1 = { 20: -1808.0, 30: -1768.8, 100: -1493.4 };
    const h3 = { 20: -1631.5, 30: -1595.9, 100: -1345.3 };
    for (const [m, h] of [[1, h1], [3, h3]] as const) {
      const w = massFraction(m);
      const cpRef = (1000 * (h[30] - h[20])) / 10;
      const dhRef = 1000 * (h[100] - h[20]);
      const cp = cpSol(298.15, w);
      const dh = hSol(373.15, w) - hSol(293.15, w);
      console.log(`test 23: ${m} mol/kg: c_p(25 °C) ${cp.toFixed(1)} J/(kg·K), PPB ${cpRef.toFixed(0)}; h(100 °C) − h(20 °C) ${(dh / 1000).toFixed(2)} kJ/kg, PPB ${(dhRef / 1000).toFixed(1)}`);
      expect(Math.abs(cp / cpRef - 1)).toBeLessThan(0.005);
      expect(Math.abs(dh / dhRef - 1)).toBeLessThan(0.005);
    }
  });

  it('the enthalpy closes: T(h(T, w)) = T, ∂h/∂T = c_p, h̄_w = ∂(m h)/∂m_w, Δ_solH(25 °C) = 3.883 kJ/mol', () => {
    for (const w of [0.01, 0.1, 0.2, 0.28]) {
      for (const T of [263.15, 280, 300, 350, 373.15, 400]) {
        expect(Math.abs(tFromHSol(hSol(T, w), w, T + 5) - T)).toBeLessThan(1e-7);
        expect(Math.abs((hSol(T + 1e-3, w) - hSol(T - 1e-3, w)) / 2e-3 / cpSol(T, w) - 1)).toBeLessThan(1e-6);
        const H = (mw: number): number => (mw + w) * hSol(T, w / (mw + w));
        expect(Math.abs((H(1 - w + 1e-6) - H(1 - w - 1e-6)) / 2e-6 - hWaterIn(T, w))).toBeLessThan(0.05);
      }
    }
    /* The heat of solution at infinite dilution: h̄_s(25 °C, w → 0) − h_crystal(25 °C). */
    const Hs = (s: number): number => (1 + s) * hSol(298.15, s / (1 + s));
    const dHsol = ((Hs(1e-7 + 1e-8) - Hs(1e-7 - 1e-8)) / 2e-8 - hCrystal(298.15)) * M_S;
    expect(Math.abs(dHsol - 3883)).toBeLessThan(5);
  });

  it('a fill with salt makes brine particles of the asked mass fraction; the scene keeps NaCl through JSON', () => {
    const json = scene({ box: { w: 0.06, h: 0.06, depth: 0.01 }, ops: [{ op: 'fill', region: { rect: [0, 0, 0.06, 0.03] }, composition: { H2O: 0.9, NaCl: 0.1 }, phase: 'liquid', T: 20 }] });
    const e = new Engine(json);
    const P = e.particles;
    for (let p = 0; p < P.count; p += 1) expect(Math.abs(P.saltFraction(p) - 0.1)).toBeLessThan(1e-12);
    const b = e.measureBudget();
    expect(Math.abs(b.salt.liquid / (b.salt.liquid + b.water.liquid) - 0.1)).toBeLessThan(1e-12);
    expect(e.needsCpu()).toBe(true);
    const again = readScene(writeScene(readScene(json).scene)).scene;
    const fill = again.ops[0];
    expect(fill.op === 'fill' && fill.composition.NaCl).toBeCloseTo(0.1, 12);
  });
});

/** Steigung von p_l in der mittleren Spalte zwischen den Zeilen j0 und j1 (Pa/cm). */
function gradient(e: Engine, j0: number, j1: number): number {
  const g = e.grid;
  const i = Math.floor(g.nx / 2);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let j = j0; j <= j1; j += 1) {
    const y = (j + 0.5) * g.dx;
    const p = g.pl[i + j * g.nx];
    sx += y; sy += p; sxx += y * y; sxy += y * p; n += 1;
  }
  return -((n * sxy - sx * sy) / (n * sxx - sx * sx)) / 100;
}

describe('M2b — test 24: brine under water', () => {
  it('a layer of 20 % brine under fresh water at rest: dp/dy = ρ_brine g and ρ_w g (±2 %), the layers stay, salt exact', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.10, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 1, g: 9.81 },
      sides: sealed,
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.08, 0.03] }, composition: { H2O: 0.8, NaCl: 0.2 }, phase: 'liquid', T: 20 },
        { op: 'fill', region: { rect: [0, 0.03, 0.08, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
      ]
    }), { insulated: true, tol: 1e-8, maxIter: 200 });
    const s0 = saltIn(e);
    while (e.time < 5) e.step();
    const dx = e.grid.dx;
    const gb = gradient(e, 2, Math.round(0.03 / dx) - 3);
    const gw = gradient(e, Math.round(0.03 / dx) + 3, Math.round(0.06 / dx) - 3);
    const expB = (rhoSol(T0 + 20, 0.2) * 9.81) / 100;
    const expW = (rhoSol(T0 + 20, 0) * 9.81) / 100;
    /* Salt above the original interface (it should stay below; nothing diffuses). */
    const P = e.particles;
    let above = 0;
    let vmax = 0;
    for (let p = 0; p < P.count; p += 1) {
      if (P.y[p] > 0.03 + 2 * dx) above += P.smass[2 * p];
      vmax = Math.max(vmax, Math.hypot(P.vx[p], P.vy[p]));
    }
    console.log(`test 24: brine ${gb.toFixed(3)} Pa/cm (ρ g ${expB.toFixed(3)}), water ${gw.toFixed(3)} Pa/cm (ρ_w g ${expW.toFixed(3)}), salt more than two cells above the interface ${((100 * above) / s0).toFixed(3)} %, largest speed ${(vmax * 1000).toFixed(4)} mm/s, salt error ${e.saltError().toExponential(2)} kg`);
    expect(Math.abs(gb / expB - 1)).toBeLessThan(0.02);
    expect(Math.abs(gw / expW - 1)).toBeLessThan(0.02);
    expect(above / s0).toBeLessThan(0.01);
    expect(vmax).toBeLessThan(1e-3);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * s0);
  });
});

describe('M2b — test 25: the air over saturated brine', () => {
  it('in a sealed, insulated box at 25 °C the air above saturated brine settles at 75.3 % RH (Greenspan 1977, ±0.5 %)', () => {
    const ws = satFraction(298.15);
    const e = new Engine(scene({
      box: { w: 0.04, h: 0.03, depth: 0.01 },
      ambient: { p: 101.325, T: 25, rh: 0.5, g: 9.81 },
      sides: sealed,
      ops: [{ op: 'fill', region: { rect: [0, 0, 0.04, 0.01] }, composition: { H2O: 1 - ws, NaCl: ws }, phase: 'liquid', T: 25 }]
    }), { insulated: true });
    const g = e.grid;
    const n = g.n;
    const rh = (): number => {
      let s = 0, k = 0;
      for (let c = 0; c < n; c += 1) {
        if (g.kind[c] !== 0) continue;
        const nv = g.mg[H2O * n + c] / MOLAR[H2O];
        const nd = g.mg[N2 * n + c] / MOLAR[N2] + g.mg[O2 * n + c] / MOLAR[O2];
        s += ((nv / (nv + nd)) * e.regions.pAt(c)) / pSatFast(g.T[c]);
        k += 1;
      }
      return s / k;
    };
    const s0 = saltIn(e);
    const r0 = rh();
    while (e.time < 40) e.step();
    const r1 = rh();
    console.log(`test 25: relative humidity ${(100 * r0).toFixed(2)} % → ${(100 * r1).toFixed(2)} % after ${e.time.toFixed(0)} s (Greenspan 75.29 %), salt error ${e.saltError().toExponential(2)} kg, water error ${e.waterError().toExponential(2)} kg`);
    expect(Math.abs(100 * r1 - 75.29)).toBeLessThan(0.5);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * s0);
  });
});

describe('M2b — test 26: salt stays when brine boils', () => {
  it('1 mol/kg brine boiling on a hot plate: bubbles nucleate and burst, the brine gets saltier, salt exact, water and energy close', () => {
    const w = massFraction(1);
    const e = new Engine(scene({
      ops: [
        { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 150, on: true, T: 160 },
        { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 104 },
        { op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.045] }, composition: { H2O: 1 - w, NaCl: w }, phase: 'liquid', T: 100.8 },
        { op: 'solid', region: { rect: [0.082, 0.010, 0.086, 0.012] }, material: 'ceramic', T: 100.8 },
        { op: 'solid', region: { rect: [0.112, 0.010, 0.116, 0.012] }, material: 'ceramic', T: 100.8 }
      ]
    }));
    const s0 = saltIn(e);
    const b0 = e.measureBudget();
    const w0 = b0.salt.liquid / (b0.salt.liquid + b0.water.liquid);
    while (e.time < 5) e.step();
    const b = e.measureBudget();
    const w1 = b.salt.liquid / (b.salt.liquid + b.water.liquid);
    const bm = e.bubbleModel;
    const salt = e.saltError();
    const water = e.waterError();
    const energy = e.energyError();
    console.log(`test 26: nucleated ${bm.nucleated}, burst ${bm.burst}, vapour ${((e.phase.produced + bm.burstVapour) * 1e6).toFixed(1)} mg, salt fraction ${(100 * w0).toFixed(4)} → ${(100 * w1).toFixed(4)} %, salt error ${salt.toExponential(2)} kg of ${s0.toExponential(3)}, water error ${water.toExponential(2)} kg, energy error ${energy.toExponential(2)} J`);
    expect(bm.nucleated).toBeGreaterThan(0);
    expect(bm.burst).toBeGreaterThan(0);
    expect(w1).toBeGreaterThan(w0);
    expect(Math.abs(salt)).toBeLessThan(1e-12 * s0);
    expect(Math.abs(water)).toBeLessThan(1e-9 * b0.water.total);
    expect(Math.abs(energy)).toBeLessThan(0.5);
  });
});

describe('M2b — test 27: brine boiled dry leaves its salt as a crust', () => {
  it('20 % brine in a steel dish on a hot plate: all water leaves, all salt ends as crust (exact, nothing spattered out), energy closes', () => {
    const e = new Engine(scene({
      box: { w: 0.06, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'hotplate', x: 0.03, y: 0, w: 0.06, h: 0.006, material: 'steel', mode: 'power', power: 60, on: true, T: 120 },
        { op: 'beaker', x: 0.03, y: 0.006, w: 0.03, h: 0.04, wall: 0.002, material: 'steel', T: 120 },
        { op: 'fill', region: { rect: [0.017, 0.008, 0.043, 0.010] }, composition: { H2O: 0.8, NaCl: 0.2 }, phase: 'liquid', T: 100 }
      ]
    }));
    const s0 = saltIn(e);
    while (e.time < 120 && e.particles.count > 0) e.step();
    const b = e.measureBudget();
    console.log(`test 27: dry after ${e.time.toFixed(2)} s (${e.particles.count} particles left), crust ${(b.salt.crust * 1e6).toFixed(6)} mg of ${(s0 * 1e6).toFixed(6)} mg, spattered out ${(b.salt.escaped * 1e6).toFixed(6)} mg, on the box floor ${(b.salt.floor * 1e6).toFixed(6)} mg, salt error ${e.saltError().toExponential(2)} kg, water error ${e.waterError().toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J`);
    expect(e.particles.count).toBe(0);
    expect(Math.abs(b.salt.crust - s0)).toBeLessThan(1e-12 * s0);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * s0);
    expect(Math.abs(e.energyError())).toBeLessThan(0.5);
  });
});
