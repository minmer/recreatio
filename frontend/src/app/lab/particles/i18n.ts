/**
 * PARTIKEL-LABOR — DIE SPRACHE: alle Texte stehen in
 * `src/locales/<sprache>/labParticles.json` und kommen über core/i18n. Hier
 * bleiben die Helfer für Stoffnamen und Zahlen. Die Engine hat keine Texte;
 * Stoffe kennt sie nur mit ihrer Kennung (`labParticles.species.<id>.<phase>`).
 */

import { appLang, tOr, type Lang } from '../../core/i18n';
import type EN from '../../../locales/en/labParticles.json';
import type { PhaseId } from './engine/units';

export type { Lang };

/** Die Schlüssel der Texte (ohne `labParticles.` davor); `t(\`labParticles.${key}\`)`. */
export type TextKey = Exclude<keyof typeof EN, 'ai' | 'species' | 'preset'>;

const PHASE_KEYS = ['solid', 'liquid', 'gas'] as const;

/** Der Name eines Stoffes (in einer Phase, wenn sie einen eigenen hat: „lód“, „para wodna“). */
export function speciesName(id: string, phase?: PhaseId, lang: Lang = appLang()): string {
  const whole = tOr(`labParticles.species.${id}.name`, id, undefined, lang);
  return phase === undefined ? whole : tOr(`labParticles.species.${id}.${PHASE_KEYS[phase]}`, whole, undefined, lang);
}

/** Eine Zahl auf polnische (deutsche) Art: Komma statt Punkt. */
export function num(x: number, digits = 1, lang: Lang = appLang()): string {
  const s = x.toFixed(digits);
  return lang === 'en' ? s : s.replace('.', ',');
}
