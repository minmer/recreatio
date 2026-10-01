/**
 * „ARCHIWUM TEKSTÓW" (0064) — die veröffentlichten Texte einer Bibliothek:
 * alle, die eines Projekts (ein Zyklus von Predigten, ein Buch) oder eines
 * Themas. Jeder öffnet sich ganz, an Ort und Stelle; `?t=<kennung>` in der
 * Adresse öffnet ihn gleich — ein Text des Archivs lässt sich verschicken.
 *
 * <b>Je Grösse:</b> im Streifen der neueste Text; als Block die letzten mit
 * Datum und kurzem Inhalt; hoch und im Vollbild mit Suche, Themen und „Więcej".
 */

import { definePart, text, type RawConfig } from '../part';
import { WritingsCard } from '../LibraryPublic';

interface WritingsConfig {
  readonly title: string;
  readonly library: string;
  readonly project: string;
  readonly topic: string;
}

export const writingsPart = definePart<WritingsConfig>({
  kind: 'writings',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Kazania', library: '<id-biblioteki>', project: '<id-projektu albo puste>', topic: '<id-tematu albo puste>' },
  label: 'Archiwum tekstów',
  use: 'Lista opublikowanych kazań i tekstów z Biblioteki — z wyszukiwaniem; każdy otwiera się w całości.',
  box: { colSpan: 6, rowSpan: 5 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Kazania' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'project', label: 'Tylko z projektu (cyklu, książki)', kind: 'libraryEntry', of: 'library', entryKinds: ['project'], optional: true },
    { key: 'topic', label: 'Tylko z tematu', kind: 'libraryEntry', of: 'library', entryKinds: ['topic'], optional: true }
  ],

  read: (raw: RawConfig): WritingsConfig => ({
    title: text(raw, 'title'), library: text(raw, 'library'), project: text(raw, 'project'), topic: text(raw, 'topic')
  }),

  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : null),

  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Najnowszy tekst — tytuł i data.'
    : size.height === 'tall' ? 'Teksty z wyszukiwaniem i tematami; każdy otwiera się w całości.'
    : 'Ostatnie teksty z datą i krótkim opisem.',

  View: ({ config, ctx }) => (
    <WritingsCard
      library={config.library} title={config.title} project={config.project} topic={config.topic}
      size={ctx.size} whole={ctx.whole === true} prefix={`a${ctx.moduleId.slice(0, 8)}-`}
    />
  )
});
