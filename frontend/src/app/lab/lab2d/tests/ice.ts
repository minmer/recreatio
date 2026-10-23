/**
 * LABOR 2D (v2) — Hilfen der Prüfungen von M3b (Schmelzen und Anfrieren):
 * die Neumann-Lösung des Stefan-Problems, die beiden Aufbauten dazu, die Sole
 * gemittelt über ihre Teilchen.
 */

import { Engine } from '../engine/engine';
import { cpL, kL, rhoL, SOLIDS, solidIndex, WATER } from '../engine/materials';
import { H_MELT, T_MELT } from '../engine/solution';
import { T0 } from '../engine/units';
import { erf, scene, type TestScene } from './scenes';

export const ICE = SOLIDS[solidIndex('ice')];

/** λ der Neumann-Lösung, wenn nur eine Seite leitet: λ e^{λ²} (1 + erf λ) = St/√π (Bisektion). */
export function neumannLambda(St: number): number {
  let lo = 0;
  let hi = 3;
  for (let i = 0; i < 100; i += 1) {
    const m = 0.5 * (lo + hi);
    if (m * Math.exp(m * m) * (1 + erf(m)) > St / Math.sqrt(Math.PI)) hi = m;
    else lo = m;
  }
  return 0.5 * (lo + hi);
}

/**
 * Schmelzen (Stefan): Eis bei 0 °C füllt die Kiste bis 2 cm, darüber Wasser
 * von Tw — das kalte Wasser liegt unten, keine Konvektion; die Wände halten
 * dicht. Die Front s(t) = 2λ√(α_l t), α_l und St bei der mittleren Temperatur
 * der Grenzschicht: St = ρ_l c_l (Tw − T_m)/(ρ_Eis L) (das Wasser leitet, das
 * Eis bleibt bei T_m).
 */
export function stefanMelt(quality: TestScene['quality'], Tw = 20): { scene: TestScene; slope: number } {
  const Tm = T0 + Tw / 2;
  const alpha = kL(Tm) / (rhoL(Tm) * cpL(Tm));
  const St = (rhoL(Tm) * cpL(Tm) * Tw) / (ICE.rho * H_MELT);
  return {
    slope: 2 * neumannLambda(St) * Math.sqrt(alpha),
    scene: scene({
      quality,
      box: { w: 0.02, h: 0.06, depth: 0.01 },
      ambient: { p: 101.325, T: Tw, rh: 1, g: 9.81 },
      ops: [
        { op: 'body', region: { rect: [0, 0, 0.02, 0.02] }, material: 'ice', T: 0, pinned: true },
        { op: 'fill', region: { rect: [0, 0.02, 0.02, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T: Tw }
      ]
    })
  };
}

/**
 * Erstarren: Eis bei Tc füllt die Kiste bis 4 cm, darüber Wasser an seinem
 * Gefrierpunkt — nur das Eis leitet; s(t) = 2λ√(α_Eis t), St = c_Eis (T_m − Tc)/L.
 */
export function stefanFreeze(quality: TestScene['quality'], Tc = -20): { scene: TestScene; slope: number } {
  const alpha = ICE.k / (ICE.rho * ICE.cp);
  const St = (ICE.cp * (T_MELT - T0 - Tc)) / H_MELT;
  return {
    slope: 2 * neumannLambda(St) * Math.sqrt(alpha),
    scene: scene({
      quality,
      box: { w: 0.02, h: 0.08, depth: 0.01 },
      ambient: { p: 101.325, T: 0, rh: 1, g: 9.81 },
      ops: [
        { op: 'body', region: { rect: [0, 0, 0.02, 0.04] }, material: 'ice', T: Tc, pinned: true },
        { op: 'fill', region: { rect: [0, 0.04, 0.02, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: T_MELT - T0 }
      ]
    })
  };
}

/** Die Oberkante des Eises (m) zu den Zeiten `at` (s). */
export function frontAt(e: Engine, at: readonly number[]): number[] {
  const b = e.bodies.list[0];
  const top = (): number => b.y + b.bounds(0)[3];
  const out: number[] = [];
  for (const t of at) {
    while (e.time < t) e.step();
    out.push(top());
  }
  return out;
}

/** Die Wasserteilchen: mittlere Temperatur (nach Masse), Salz und Wasser (kg), kälteste und wärmste. */
export function liquidState(e: Engine): { T: number; salt: number; water: number; Tmin: number; Tmax: number } {
  const P = e.particles;
  let salt = 0;
  let water = 0;
  let mT = 0;
  let m = 0;
  let Tmin = Infinity;
  let Tmax = -Infinity;
  for (let p = 0; p < P.count; p += 1) {
    if (P.mat[p] !== WATER) continue;
    const s = P.smass[2 * p];
    salt += s;
    water += P.mass[p] - s;
    mT += P.mass[p] * P.T[p];
    m += P.mass[p];
    Tmin = Math.min(Tmin, P.T[p]);
    Tmax = Math.max(Tmax, P.T[p]);
  }
  return { T: mT / m, salt, water, Tmin, Tmax };
}

/** Ein Eiswürfel in Sole (offene Kiste, ohne Verluste durch die Wände): Massenanteil w, Sole bei T (°C), Eis bei Tice (°C), Kante a (m). */
export function iceInBrine(w: number, T: number, Tice: number, a: number): TestScene {
  return scene({
    box: { w: 0.04, h: 0.05, depth: 0.01 },
    ambient: { p: 101.325, T, rh: 0.5, g: 9.81 },
    ops: [
      { op: 'fill', region: { rect: [0, 0, 0.04, 0.03] }, composition: { H2O: 1 - w, NaCl: w }, phase: 'liquid', T },
      { op: 'body', region: { rect: [0.02 - a / 2, 0.03 - 0.8 * a, 0.02 + a / 2, 0.03 + 0.2 * a] }, material: 'ice', T: Tice }
    ]
  });
}
