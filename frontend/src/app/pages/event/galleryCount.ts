/* 0063 — aus dem Altbestand übernommen (legacy/pages/events/parts/galleryCount.ts). */

import { t as inApp, type T } from '../../core/i18n';

/**
 * How a gallery says how big it is — a plural key (`pagesEvent.photos`): Polish counts
 * three ways, and the dictionary knows which (Intl.PluralRules), not this file.
 */
/** "1 zdjęcie", "3 zdjęcia", "24 zdjęcia" — `t` of the scope when there is one. */
export function photoCount(count: number, t: T | typeof inApp = inApp): string {
  return t('pagesEvent.photos', { count });
}
