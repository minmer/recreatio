/**
 * PARTIKEL-LABOR — das Polecenie dla AI neben dem Editor: die KI schreibt im
 * eigenen Chat einen Anfangsaufbau, den man hier einfügt (keine KI in der App).
 * Die Texte stehen in labParticles.json (`labParticles.ai.*`).
 */

import { t } from '../../core/i18n';
import { SPECIES } from './engine/species';
import { speciesName } from './i18n';
import { BOILING_SCENE } from './particlePresets';

export function particleDescription(): string {
  const fluids = SPECIES.filter((s) => s.kind === 'substance').map((s) => `${s.id} (${speciesName(s.id)})`).join(', ');
  const solids = SPECIES.filter((s) => s.kind === 'material').map((s) => `${s.id} (${speciesName(s.id)})`).join(', ');
  return [t('labParticles.ai.format'), t('labParticles.ai.lists', { fluids, solids })].join('\n');
}

export function particlePrompt(): string {
  return [
    t('labParticles.ai.prompt'),
    '',
    particleDescription(),
    '',
    t('labParticles.ai.example'),
    JSON.stringify(BOILING_SCENE, null, 2)
  ].join('\n');
}
