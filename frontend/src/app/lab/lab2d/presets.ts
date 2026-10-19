/**
 * LABOR 2D (v2) — FERTIGE ANFANGSAUFBAUTEN (Szenen als Daten, keine Skripte):
 * was wo steht und wie warm es ist. Was dann geschieht, rechnet die Engine.
 * Der erste Aufbau ist die Szene des Meilensteins 1: eine Zlewka mit Wasser
 * auf der Heizplatte (die Benchmark-Szene, documentation/lab2d/MILESTONES.md).
 */

import type { LabPreset } from '../LabEditor';

const BASE = {
  format: 'recreatio/lab2d',
  version: 1,
  seed: 1,
  box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' },
  quality: 'high'
} as const;

/** Eine leere Kiste voll Luft (Piaskownica). */
export const SANDBOX_LAB2D: Readonly<Record<string, unknown>> = { ...BASE, ops: [] };

const plate = (power: number, T = 20) => ({ op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power, target: 150, on: true, T });
const beaker = (T = 20, lid = false) => ({ op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T, ...(lid ? { lid: true } : {}) });
const water = (T: number) => ({ op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T });
const chips = (T: number) => [
  { op: 'solid', region: { rect: [0.082, 0.010, 0.086, 0.012] }, material: 'ceramic', T },
  { op: 'solid', region: { rect: [0.112, 0.010, 0.116, 0.012] }, material: 'ceramic', T }
];

export const BOILING_SCENE: Readonly<Record<string, unknown>> = { ...BASE, ops: [plate(40), beaker(), water(20), ...chips(20)] };

export const LAB2D_PRESETS: readonly LabPreset[] = [
  {
    key: 'zlewka-na-plycie',
    title: 'Zlewka z wodą na płycie grzejnej',
    summary: 'scena wrzenia: woda (20 °C) w szklanej zlewce z kamyczkami wrzennymi na stalowej płycie grzejnej',
    text: [
      'W zlewce jest woda o temperaturze pokojowej, pod nią płyta grzejna o mocy 40 W. Obserwuj, jak najpierw nagrzewa się płyta, potem szkło, potem woda.',
      'Przy dnie pojawią się pęcherze. Dopóki woda jest chłodna, znikają, zanim dopłyną do powierzchni. Wykres „Temperatura wody” pokaże plateau przy temperaturze wrzenia.'
    ],
    scene: BOILING_SCENE
  },
  {
    key: 'wrzenie',
    title: 'Wrzenie z kamyczkami',
    summary: 'woda tuż przed wrzeniem (98 °C) na gorącej płycie — od razu widać wrzenie pęcherzykowe',
    text: [
      'Woda ma 98 °C, płyta jest gorąca. Kamyczki wrzenne mają wiele wgłębień, w których rodzą się pęcherze — woda wrze spokojnie, bez przegrzania.',
      'Zbadaj pęcherz narzędziem „Badaj”: wypór jest setki razy większy od jego ciężaru.'
    ],
    scene: { ...BASE, ops: [plate(40, 140), beaker(105), water(98), ...chips(98)] }
  },
  {
    key: 'szybkowar',
    title: 'Szybkowar — zamknięta skrzynka',
    summary: 'ta sama zlewka, ale skrzynka jest zamknięta: ciśnienie rośnie, a woda wrze w wyższej temperaturze',
    text: [
      'Skrzynka jest szczelnie zamknięta. Gdy woda paruje, para nie ma ujścia — ciśnienie rośnie i temperatura wrzenia też.',
      'Porównaj temperaturę wrzenia w inspektorze z otwartą skrzynką.'
    ],
    scene: { ...BASE, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' }, ops: [plate(40, 120), beaker(100), water(97), ...chips(97)] }
  },
  {
    key: 'mgla',
    title: 'Mgła nad gorącą wodą',
    summary: 'gorąca woda (90 °C) w chłodnym, wilgotnym pokoju — nad zlewką tworzy się mgła',
    text: [
      'Woda w zlewce jest gorąca, pokój chłodny. Para wodna jest niewidoczna — biała mgła powstaje dopiero tam, gdzie wilgotne powietrze się ochładza.',
      'Włącz nakładkę „Para wodna”, żeby zobaczyć niewidoczną parę obok widocznej mgły.'
    ],
    scene: { ...BASE, ambient: { p: 101.325, T: 10, rh: 0.8, g: 9.81 }, ops: [plate(15, 90), beaker(90), water(90)] }
  },
  {
    key: 'pusta-skrzynka',
    title: 'Pusta skrzynka',
    summary: 'skrzynka pełna powietrza — maluj wodę, stawiaj ścianki, zlewki i płyty grzejne',
    text: ['Skrzynka jest pełna powietrza. Maluj wodę, rysuj ścianki, stawiaj zlewki i płyty grzejne.'],
    scene: SANDBOX_LAB2D
  }
];
