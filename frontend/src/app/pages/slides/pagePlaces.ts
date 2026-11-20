/**
 * 2026-11-20 — WOHIN AUF EINER SEITE EIN LINK FÜHREN KANN: ihre Slajdy mit ihrer
 * Nummer (`?s=3`, gezählt wie im Deck — der Titelslajd ist der erste) oder, im
 * Raster, ihre Bausteine (`?part=<kennung>`). Für die Wahl im Portal eines
 * Formulars: ein Klick statt eines abgetippten Zusatzes.
 */

import { t } from '../../core/i18n';
import { toDraft, type PageContent } from '../page';
import { text } from '../part';
import { partLabel, partOf } from '../parts/registry';
import { deckParts, slideLabelOf } from './PageSlides';
import { deckOf, readLook } from './slideLook';

export interface PagePlace {
  /** Der Zusatz zur Adresse — leer: der Anfang der Seite. */
  readonly at: string;
  readonly label: string;
}

export function placesOf(page: PageContent): readonly PagePlace[] {
  /* Was im Deck ohne Inhalt wegfällt, hat auch keine Nummer (`PageSlides`). */
  const parts = page.parts.map(toDraft).filter((part) => {
    const def = partOf(part.kind);
    return def === undefined || def.hasContent(part.config);
  });

  if (page.mode === 'presentation') return [];

  if (page.mode === 'slides') {
    const cover = deckOf(readLook(page.theme)).titleSlide
      && ((page.title ?? '').trim() !== '' || (page.lead ?? '').trim() !== '');
    const out: PagePlace[] = [];
    if (cover) out.push({ at: '', label: t('seats.portal.placeSlide', { n: 1, label: (page.title ?? '').trim() || t('pagesSlides.deck.start') }) });
    deckParts(parts).own.forEach((part, i) => {
      const n = i + (cover ? 2 : 1);
      out.push({ at: n === 1 ? '' : `?s=${n}`, label: t('seats.portal.placeSlide', { n, label: slideLabelOf(part) }) });
    });
    return out;
  }

  return parts.map((part) => ({ at: `?part=${part.id}`, label: text(part.config, 'title') || partLabel(part.kind) }));
}
