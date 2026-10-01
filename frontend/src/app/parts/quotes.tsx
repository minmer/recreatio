/**
 * „ZBIÓR CYTATÓW" (0064) — die veröffentlichten Zitate einer Bibliothek, mit
 * Herkunft, Beschreibung und Themen.
 *
 * <b>Je Grösse:</b> im Streifen und als Block die „Myśl dnia" — ein Zitat
 * (breit: zwei), jeden Tag ein anderes, für alle dasselbe; hoch und im
 * Vollbild die Sammlung mit Suche und Themen.
 */

import { definePart, text, type RawConfig } from '../part';
import { QuotesCard } from '../LibraryPublic';

interface QuotesConfig {
  readonly title: string;
  readonly library: string;
  readonly topic: string;
}

export const quotesPart = definePart<QuotesConfig>({
  kind: 'quotes',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Myśl dnia', library: '<id-biblioteki>', topic: '<id-tematu albo puste>' },
  label: 'Zbiór cytatów',
  use: 'Opublikowane cytaty z Biblioteki — z opisem, źródłem i tematami; mały kafelek pokazuje „myśl dnia”.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Myśl dnia' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'topic', label: 'Tylko z tematu', kind: 'libraryEntry', of: 'library', entryKinds: ['topic'], optional: true }
  ],

  read: (raw: RawConfig): QuotesConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), topic: text(raw, 'topic') }),

  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : null),

  fullscreen: true,
  shows: (_c, size) => size.height === 'tall' ? 'Zbiór cytatów z wyszukiwaniem i tematami.'
    : size.width === 'wide' || size.width === 'full' ? 'Dwa cytaty dnia — co dzień inne.'
    : 'Cytat dnia — co dzień inny.',

  View: ({ config, ctx }) => (
    <QuotesCard library={config.library} title={config.title} topic={config.topic} size={ctx.size} whole={ctx.whole === true} />
  )
});
