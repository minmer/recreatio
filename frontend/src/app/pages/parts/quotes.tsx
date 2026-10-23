/**
 * „ZBIÓR CYTATÓW" (0064) — die Zitate einer Bibliothek, mit Herkunft (wer sie
 * sieht, entscheidet seit 2026-10-22 der Bereich der Bibliothek).
 *
 * 2026-10-23 — keine Themen mehr: statt „Tylko z tematu" nun „Tylko ze
 * źródła" (ein Werk). Eine alte Einstellung `topic` wird nicht mehr gelesen
 * — der Baustein zeigt dann alle Zitate.
 *
 * <b>Je Grösse:</b> im Streifen und als Block die „Myśl dnia" — ein Zitat
 * (breit: zwei), jeden Tag ein anderes, für alle dasselbe; hoch und im
 * Vollbild die Sammlung mit Suche und Themen.
 */

import { definePart, text, type RawConfig } from '../part';
import { later } from '../../ui/later';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const QuotesCard = later(() => import('../../library/LibraryPublic').then((m) => m.QuotesCard));

interface QuotesConfig {
  readonly title: string;
  readonly library: string;
  readonly work: string;
}

export const quotesPart = definePart<QuotesConfig>({
  kind: 'quotes',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Myśl dnia', library: '<id-biblioteki>', work: '<id-dzieła albo puste>' },
  label: 'Zbiór cytatów',
  use: 'Cytaty z Biblioteki — ze źródłem (widzi je ten, kto widzi obszar biblioteki); mały kafelek pokazuje „myśl dnia”, duży — zbiór z wyszukiwaniem i wyborem źródła.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Myśl dnia' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'work', label: 'Tylko ze źródła', kind: 'libraryEntry', of: 'library', entryKinds: ['work'], optional: true }
  ],

  read: (raw: RawConfig): QuotesConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), work: text(raw, 'work') }),

  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : null),

  fullscreen: true,
  shows: (_c, size) => size.height === 'tall' ? 'Zbiór cytatów z wyszukiwaniem i wyborem źródła.'
    : size.width === 'wide' || size.width === 'full' ? 'Dwa cytaty dnia — co dzień inne.'
    : 'Cytat dnia — co dzień inny.',

  View: ({ config, ctx }) => (
    <QuotesCard library={config.library} title={config.title} work={config.work} size={ctx.size} whole={ctx.whole === true} />
  )
});
