/**
 * LABOR 2D (v2) — das Polecenie dla AI neben dem Editor: die KI schreibt im
 * eigenen Chat einen Anfangsaufbau, den man hier einfügt (keine KI in der App).
 * Die Texte stehen in lab2d.json (`lab2d.ai.*`).
 */

import { t } from '../../core/i18n';
import { BOILING_SCENE } from './presets';

export function lab2dDescription(): string {
  return t('lab2d.ai.aiFormat');
}

export function lab2dPrompt(): string {
  return [
    t('lab2d.ai.aiPrompt'),
    '',
    lab2dDescription(),
    '',
    t('lab2d.ai.aiExample'),
    JSON.stringify(BOILING_SCENE, null, 2)
  ].join('\n');
}
