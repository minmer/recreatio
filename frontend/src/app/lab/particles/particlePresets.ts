/**
 * PARTIKEL-LABOR — fertige Anfangsaufbauten (Szenen als Daten, keine
 * Skripte): was stehen soll und was darin ist. Was dann geschieht, rechnet die
 * Engine. Der erste Aufbau ist die Szene des Meilensteins 1: eine Zlewka mit
 * Wasser auf einer Heizplatte (Wärme und Sieden kommen in M1b/M1c).
 */

import { t } from '../../core/i18n';
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

/** Ein Aufbau mit seinen Texten (labParticles.json: Titel, Kurzbeschreibung, Absätze) — übersetzt erst beim Lesen. */
function preset(id: string, key: string, scene: Readonly<Record<string, unknown>>): LabPreset {
  return {
    key,
    scene,
    get title() { return t(`labParticles.preset.${id}.title`); },
    get summary() { return t(`labParticles.preset.${id}.summary`); },
    get text() { return t(`labParticles.preset.${id}.text`).split('\n'); }
  };
}

export const PARTICLE_PRESETS: readonly LabPreset[] = [
  preset('beakerOnPlate', 'zlewka-na-plycie', BOILING_SCENE),
  preset('emptyBox', 'pusta-skrzynka', SANDBOX_PARTICLES)
];
