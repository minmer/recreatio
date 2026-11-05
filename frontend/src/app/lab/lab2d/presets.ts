/**
 * LABOR 2D (v2) — FERTIGE ANFANGSAUFBAUTEN (Szenen als Daten, keine Skripte):
 * was wo steht und wie warm es ist. Was dann geschieht, rechnet die Engine.
 * Der erste Aufbau ist die Szene des Meilensteins 1: eine Zlewka mit Wasser
 * auf der Heizplatte (die Benchmark-Szene, documentation/lab2d/MILESTONES.md).
 */

import { t } from '../../core/i18n';
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

const plate = (power: number, T = 20) => ({ op: 'hotplate', id: 'plyta', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power, target: 150, on: true, T });
const beaker = (T = 20, lid = false) => ({ op: 'beaker', id: 'zlewka', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T, ...(lid ? { lid: true } : {}) });
const water = (T: number) => ({ op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T });
/** Eine Schicht einer Flüssigkeit in der Zlewka, von y0 bis y1 (M2a: jede Flüssigkeit der Datenbank). */
const layer = (composition: Record<string, number>, T: number, y0: number, y1: number) => ({ op: 'fill', region: { rect: [0.067, y0, 0.133, y1] }, composition, phase: 'liquid', T });
const chips = (T: number) => [
  { op: 'solid', region: { rect: [0.082, 0.010, 0.086, 0.012] }, material: 'ceramic', T },
  { op: 'solid', region: { rect: [0.112, 0.010, 0.116, 0.012] }, material: 'ceramic', T }
];

export const BOILING_SCENE: Readonly<Record<string, unknown>> = { ...BASE, ops: [plate(40), beaker(), water(20), ...chips(20)] };

/** Ein Aufbau mit seinen Texten (lab2dPresets.json: Titel, Kurzbeschreibung, Absätze) — übersetzt erst beim Lesen. */
function preset(id: string, p: { readonly key: string; readonly scene: Readonly<Record<string, unknown>> }): LabPreset {
  return {
    ...p,
    get title() { return t(`lab2dPresets.${id}.title`); },
    get summary() { return t(`lab2dPresets.${id}.summary`); },
    get text() { return t(`lab2dPresets.${id}.text`).split('\n'); }
  };
}

export const LAB2D_PRESETS: readonly LabPreset[] = [
  preset('beakerOnPlate', {
    key: 'zlewka-na-plycie',
    scene: BOILING_SCENE
  }),
  preset('boilingChips', {
    key: 'wrzenie',
    scene: { ...BASE, ops: [plate(40, 140), beaker(105), water(98), ...chips(98)] }
  }),
  preset('pressureCooker', {
    key: 'szybkowar',
    scene: { ...BASE, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' }, ops: [plate(40, 120), beaker(100), water(97), ...chips(97)] }
  }),
  preset('waterUnderOil', {
    key: 'woda-pod-olejem',
    scene: { ...BASE, ops: [plate(40, 140), beaker(105), layer({ H2O: 1 }, 97, 0.010, 0.040), layer({ 'oil-rapeseed': 1 }, 97, 0.040, 0.060), ...chips(97)] }
  }),
  preset('oilWaterSeparate', {
    key: 'olej-i-woda',
    scene: { ...BASE, ops: [beaker(), layer({ H2O: 0.5, 'oil-rapeseed': 0.5 }, 20, 0.010, 0.060)] }
  }),
  preset('brineBoilsLater', {
    key: 'solanka-wrze-pozniej',
    scene: {
      ...BASE,
      ops: [
        { op: 'hotplate', id: 'plyta-lewa', x: 0.05, y: 0, w: 0.08, h: 0.008, material: 'steel', mode: 'power', power: 30, target: 150, on: true, T: 140 },
        { op: 'hotplate', id: 'plyta-prawa', x: 0.15, y: 0, w: 0.08, h: 0.008, material: 'steel', mode: 'power', power: 30, target: 150, on: true, T: 140 },
        { op: 'beaker', id: 'zlewka-lewa', x: 0.05, y: 0.008, w: 0.06, h: 0.07, wall: 0.002, material: 'glass', T: 105 },
        { op: 'beaker', id: 'zlewka-prawa', x: 0.15, y: 0.008, w: 0.06, h: 0.07, wall: 0.002, material: 'glass', T: 105 },
        { op: 'fill', region: { rect: [0.022, 0.010, 0.078, 0.05] }, composition: { H2O: 1 }, phase: 'liquid', T: 97 },
        { op: 'fill', region: { rect: [0.122, 0.010, 0.178, 0.05] }, composition: { H2O: 0.85, NaCl: 0.15 }, phase: 'liquid', T: 97 },
        { op: 'solid', region: { rect: [0.036, 0.010, 0.040, 0.012] }, material: 'ceramic', T: 97 },
        { op: 'solid', region: { rect: [0.136, 0.010, 0.140, 0.012] }, material: 'ceramic', T: 97 }
      ]
    }
  }),
  preset('brineEvaporation', {
    key: 'odparowanie-solanki',
    scene: { ...BASE, ops: [{ ...plate(150, 180), mode: 'thermostat', target: 250 }, beaker(115), layer({ H2O: 0.75, NaCl: 0.25 }, 105, 0.010, 0.015)] }
  }),
  preset('fog', {
    key: 'mgla',
    scene: { ...BASE, ambient: { p: 101.325, T: 10, rh: 0.8, g: 9.81 }, ops: [plate(15, 90), beaker(90), water(90)] }
  }),
  preset('mountain', {
    key: 'wysoka-gora',
    scene: { ...BASE, ambient: { p: 70, T: 15, rh: 0.4, g: 9.81 }, ops: [plate(40, 130), beaker(95), water(88), ...chips(88)] }
  }),
  preset('convection', {
    key: 'konwekcja',
    scene: { ...BASE, ops: [beaker(20), water(20), { op: 'hotplate', id: 'grzalka', x: 0.08, y: 0.012, w: 0.012, h: 0.004, material: 'steel', mode: 'power', power: 6, target: 150, on: true, T: 20 }] }
  }),
  preset('brineUnderWater', {
    key: 'solanka-pod-woda',
    scene: { ...BASE, ops: [plate(15), beaker(), layer({ H2O: 0.8, NaCl: 0.2 }, 20, 0.010, 0.030), layer({ H2O: 1 }, 20, 0.030, 0.060)] }
  }),
  preset('whatFloats', {
    key: 'co-plywa',
    scene: {
      ...BASE,
      ambient: { p: 101.325, T: 15, rh: 0.5, g: 9.81 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.2, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: 2 },
        { op: 'body', id: 'drewno', region: { rect: [0.025, 0.085, 0.065, 0.105] }, material: 'wood', T: 15 },
        { op: 'body', id: 'lod', region: { rect: [0.09, 0.085, 0.11, 0.105] }, material: 'ice', T: -2 },
        { op: 'body', id: 'kamien', region: { rect: [0.14, 0.085, 0.16, 0.1] }, material: 'stone', T: 15 }
      ]
    }
  }),
  preset('iceInWarmWater', {
    key: 'lod-w-wodzie',
    scene: {
      ...BASE,
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.2, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: 40 },
        { op: 'body', id: 'kostka', region: { rect: [0.085, 0.0425, 0.115, 0.0725] }, material: 'ice', T: -10 }
      ]
    }
  }),
  preset('iceWithSalt', {
    key: 'lod-z-sola',
    scene: {
      ...BASE,
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      ops: [
        { op: 'fill', region: { rect: [0, 0, 0.1, 0.04] }, composition: { H2O: 0.77, NaCl: 0.23 }, phase: 'liquid', T: 0 },
        { op: 'body', id: 'kostka-1', region: { rect: [0.012, 0.024, 0.032, 0.044] }, material: 'ice', T: -5 },
        { op: 'body', id: 'kostka-2', region: { rect: [0.04, 0.024, 0.06, 0.044] }, material: 'ice', T: -5 },
        { op: 'body', id: 'kostka-3', region: { rect: [0.068, 0.024, 0.088, 0.044] }, material: 'ice', T: -5 }
      ]
    }
  }),
  preset('saltIntoWater', {
    key: 'sol-w-wodzie',
    scene: {
      ...BASE,
      ops: [beaker(), water(20), { op: 'grains', region: { rect: [0.09, 0.07, 0.11, 0.08] }, material: 'NaCl', d: 0.0005, T: 20 }]
    }
  }),
  preset('saltSuperheated', {
    key: 'sol-do-wrzatku',
    scene: {
      ...BASE,
      ops: [plate(20, 106), beaker(104), water(104), { op: 'grains', region: { rect: [0.095, 0.07, 0.105, 0.075] }, material: 'NaCl', d: 0.0005, T: 20 }]
    }
  }),
  preset('tippedBeaker', {
    key: 'przewrocona-zlewka',
    scene: {
      ...BASE,
      box: { w: 0.24, h: 0.15, depth: 0.01 },
      ops: [
        { op: 'solid', region: { rect: [0, 0, 0.1, 0.03] }, material: 'stone', T: 20 },
        { op: 'beaker', id: 'zlewka', x: 0.11, y: 0.03, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20, pinned: false },
        { op: 'fill', region: { rect: [0.077, 0.032, 0.143, 0.07] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
      ]
    }
  }),
  preset('emptyBox', {
    key: 'pusta-skrzynka',
    scene: SANDBOX_LAB2D
  })
];
