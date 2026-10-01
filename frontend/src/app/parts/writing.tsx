/**
 * „TEKST Z BIBLIOTEKI" (0064) — eine Predigt, ein Kapitel, eine Betrachtung
 * aus der Bibliothek, mit Fussnoten, „Dalsze informacje" und den Quellen.
 *
 * Gezeigt wird, was veröffentlicht ist — die Fassung der Bibliothek, nicht
 * eine Kopie: wer den Text dort überarbeitet und die Veröffentlichung
 * aktualisiert, ändert ihn auf jeder Seite, auf der er steht.
 *
 * <b>Je Grösse:</b> im Streifen ein Knopf; als Block Titel, Datum und der
 * Anfang, „Czytaj całość" klappt auf; hoch und im Vollbild das Ganze.
 */

import { definePart, text, type RawConfig } from '../part';
import { WritingCard } from '../LibraryPublic';

interface WritingConfig {
  readonly library: string;
  readonly entry: string;
}

export const writingPart = definePart<WritingConfig>({
  kind: 'writing',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { library: '<id-biblioteki>', entry: '<id-opublikowanego-tekstu>' },
  label: 'Tekst z biblioteki',
  use: 'Kazanie albo inny tekst z Biblioteki — z przypisami, dalszymi informacjami i źródłami.',
  box: { colSpan: 6, rowSpan: 5 },

  fields: [
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'entry', label: 'Który tekst', kind: 'libraryEntry', of: 'library', entryKinds: ['text'] }
  ],

  read: (raw: RawConfig): WritingConfig => ({ library: text(raw, 'library'), entry: text(raw, 'entry') }),

  hasContent: (c) => c.library !== '' && c.entry !== '',
  missing: (c) => (c.library === '' || c.entry === '' ? 'Wybierz bibliotekę i opublikowany tekst.' : null),

  strip: { title: 'Tekst', open: 'Czytaj' },
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Przycisk, który otwiera tekst.'
    : size.height === 'tall' ? 'Cały tekst z przypisami, dalszymi informacjami i źródłami.'
    : 'Tytuł, data i początek — całość po kliknięciu „Czytaj całość”.',

  View: ({ config, ctx }) => (
    <WritingCard library={config.library} entryId={config.entry} size={ctx.size} whole={ctx.whole === true} prefix={`w${ctx.moduleId.slice(0, 8)}-`} />
  )
});
