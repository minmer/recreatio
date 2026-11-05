/**
 * LABOR 2D (v2) — DIE SPRACHE DES LABORS: alle Texte stehen in
 * `src/locales/<sprache>/lab2d.json` (die Voreinstellungen in
 * `lab2dPresets.json`) und kommen über core/i18n. Hier bleiben nur die
 * Helfer, die Stoffnamen und Zahlen zu Text machen. Die Engine hat keine
 * Texte; sie kennt Stoffe nur mit ihrer Kennung (`lab2d.solid.<id>`,
 * `lab2d.liquid.<id>`).
 */

import { appLang, tOr, type Lang } from '../../core/i18n';
import type EN from '../../../locales/en/lab2d.json';

export type { Lang };

/** Die Schlüssel der Texte des Labors (ohne `lab2d.` davor); `t(\`lab2d.${key}\`)`. */
export type TextKey = Exclude<keyof typeof EN, 'ai' | 'simpl' | 'solid' | 'liquid' | 'species' | 'vapour' | 'solute' | 'soluteShort'>;

/** Der Name eines Feststoffs (die Engine kennt nur seine Kennung). */
export function materialName(id: string, lang: Lang = appLang()): string {
  return tOr(`lab2d.solid.${id}`, id, undefined, lang);
}

/** Der Kurzname einer Flüssigkeit („woda“, „olej“). */
export function liquidName(id: string, lang: Lang = appLang()): string {
  return tOr(`lab2d.liquid.${id}`, id, undefined, lang);
}

/** Die Flüssigkeiten einer Zelle als Text: „woda“ oder „woda 60 %, olej 40 %“. */
export function liquidsText(list: readonly { readonly id: string; readonly share: number }[], lang: Lang = appLang()): string {
  if (list.length === 0) return '';
  const sorted = [...list].sort((a, b) => b.share - a.share);
  if (sorted[0].share > 0.995) return liquidName(sorted[0].id, lang);
  return sorted.map((l) => `${liquidName(l.id, lang)} ${num(100 * l.share, 0, lang)} %`).join(', ');
}

/** Eine Zahl auf polnische (deutsche) Art: Komma statt Punkt. */
export function num(x: number, digits = 1, lang: Lang = appLang()): string {
  if (!Number.isFinite(x)) return '–';
  let s = x.toFixed(digits);
  /* „−0,000“ (ein winziger negativer Rest) ohne Vorzeichen. */
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return lang === 'en' ? s : s.replace('.', ',').replace('-', '−');
}

/**
 * Die Vereinfachungen für die Tafel „O tym modelu” — auf zwei Stufen
 * (SIMPLIFICATIONS.md ist die ausführliche Fassung): `lab2d.simpl.<id>.title|primary|secondary`.
 */
export const SIMPLIFICATIONS: readonly string[] = [
  'flatWorld', 'grid', 'waterAirApart', 'noSound', 'incompressible', 'tensionInBubbles', 'noRadiation', 'lossesOneNumber', 'cavities',
  'bubbleFormulas', 'idealGases', 'fogNoFall', 'liquidsOneFlow', 'viscosity', 'subcellDrops', 'onlyWaterEvaporates', 'saltInWater', 'saltMixing',
  'crystalsOnBottom', 'roundGrains', 'saltSinks', 'airDroplets', 'iceWholeWalls', 'heatInCell', 'roomBehindSide', 'rigidBodies',
  'frictionlessWalls', 'onlyBubbles', 'violentBoiling', 'tinyBubbles', 'fogWhiteness'
];
