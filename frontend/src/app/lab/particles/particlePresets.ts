/**
 * PARTIKEL-LABOR — fertige Anfangsaufbauten (Szenen als Daten, keine
 * Skripte): was stehen soll und was darin ist. Was dann geschieht, rechnet die
 * Engine. Der erste Aufbau ist die Szene des Meilensteins 1: eine Zlewka mit
 * Wasser auf einer Heizplatte (Wärme und Sieden kommen in M1b/M1c).
 */

import type { LabPreset } from '../LabEditor';

/** Eine leere Kiste voll Luft (Piaskownica). */
export const SANDBOX_PARTICLES: Readonly<Record<string, unknown>> = {
  format: 'recreatio/particles',
  version: 1,
  seed: 1,
  box: { w: 0.3, h: 0.2, depth: 0.01 },
  ambient: { p: 101.325, T: 20, g: 9.81 },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' },
  quality: 'very-high',
  ops: []
};

export const BOILING_SCENE: Readonly<Record<string, unknown>> = {
  ...SANDBOX_PARTICLES,
  ops: [
    { op: 'hotplate', x: 0.15, y: 0, w: 0.16, h: 0.012, power: 50 },
    { op: 'beaker', x: 0.15, y: 0.012, w: 0.07, h: 0.09 },
    { op: 'fill', region: { rect: [0.116, 0.017, 0.184, 0.067] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
  ]
};

export const PARTICLE_PRESETS: readonly LabPreset[] = [
  {
    key: 'zlewka-na-plycie',
    title: 'Zlewka z wodą na płycie grzejnej',
    summary: 'scena wrzenia: zlewka z wodą (20 °C) na stalowej płycie grzejnej w skrzynce pełnej powietrza',
    text: ['W zlewce jest woda o temperaturze pokojowej, pod nią płyta grzejna.', 'Zbadaj cząstki narzędziem „Badaj” — każda ma swój skład, temperaturę i masę.'],
    scene: BOILING_SCENE
  },
  {
    key: 'pusta-skrzynka',
    title: 'Pusta skrzynka',
    summary: 'skrzynka pełna powietrza — maluj wodę, stawiaj ściany i aparaturę',
    text: ['Skrzynka jest pełna powietrza. Maluj wodę, rysuj ściany, stawiaj zlewki i płyty grzejne.'],
    scene: SANDBOX_PARTICLES
  }
];
