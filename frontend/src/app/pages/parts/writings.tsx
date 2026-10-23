/**
 * „ARCHIWUM TEKSTÓW" (0064) — die Texte eines Skryptorium (bis 2026-10-23:
 * einer Bibliothek; eine ältere Seite nennt es noch `library`, es wird weiter
 * gelesen). Wer sie sieht, entscheidet sein Bereich:
 * alle, die eines Projekts (ein Zyklus von Predigten, ein Buch) oder eines
 * Themas. Jeder öffnet sich ganz, an Ort und Stelle; `?t=<kennung>` in der
 * Adresse öffnet ihn gleich — ein Text des Archivs lässt sich verschicken.
 *
 * <b>Je Grösse:</b> im Streifen der neueste Text; als Block die letzten mit
 * Datum und kurzem Inhalt; hoch und im Vollbild das ganze Archiv.
 *
 * <b>2026-10-21 — für sehr viele Kazania:</b> hoch und im Vollbild mit
 * Suche, einem Filter je Aspekt der Bibliothek und drei Ansichten — Lista,
 * Tabela (je Aspekt eine Spalte), Drzewo (die Themen als Baum, mit Zahlen).
 * Ein geöffneter Text zeigt seinen Plan, die Wygłoszenia (mit Nagranie und
 * dem, was gesagt und was ausgelassen wurde) und die Quellen. Die Achsen
 * stehen in der Bibliothek (Themen mit „Aspekt"); hier wird nur gewählt,
 * womit das Archiv beginnt — der Baustein bleibt so klein wie vorher.
 *
 * 2026-10-22 (Schritt 10) — die TABELA ist ausgemustert: Tabelle und Macierz
 * gibt der Baustein „Widok" (mit dem Kazanie als innerer Ansicht). Wer sie
 * schon eingestellt hat, behält sie.
 */

import { definePart, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { layoutOf } from '../../scriptorium/archiveLayout';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const WritingsCard = later(() => import('../../scriptorium/ArchiveCard').then((m) => m.WritingsCard));

interface WritingsConfig {
  readonly title: string;
  /** 2026-10-23 — das Skryptorium (eine ältere Seite: `library`). */
  readonly scriptorium: string;
  readonly project: string;
  readonly topic: string;
  /** 2026-10-21 — womit das Archiv beginnt: „lista", „tabela", „drzewo"; der Besucher kann wechseln. */
  readonly layout: string;
}

const LAYOUT_SAYS: Record<string, string> = {
  list: 'lista według dat',
  table: 'tabela — aspekty jako kolumny',
  tree: 'drzewo tematów z liczbami'
};

export const writingsPart = definePart<WritingsConfig>({
  kind: 'writings',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Kazania', scriptorium: '<id-skryptorium>', project: '<id-projektu albo puste>', topic: '<id-tematu albo puste>', layout: 'drzewo' },
  label: 'Archiwum tekstów',
  use: 'Kazania i teksty ze Skryptorium — z wyszukiwaniem, jako lista; każdy otwiera się z planem, nagraniami i źródłami. Tabelę i macierz (np. tajemnice × obszary) daje moduł „Widok”.',
  box: { colSpan: 6, rowSpan: 5 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Kazania' },
    { key: 'scriptorium', label: 'Ze skryptorium', kind: 'scriptorium' },
    { key: 'project', label: 'Tylko z projektu (cyklu, książki)', kind: 'libraryEntry', of: 'scriptorium', entryKinds: ['project'], optional: true },
    { key: 'topic', label: 'Tylko z tematu', kind: 'libraryEntry', of: 'scriptorium', entryKinds: ['topic'], optional: true },
    { key: 'layout', label: 'Na początek', kind: 'line', hint: 'lista albo drzewo — odwiedzający może zmienić (tabela: moduł „Widok”)' }
  ],

  read: (raw: RawConfig): WritingsConfig => ({
    title: text(raw, 'title'), scriptorium: text(raw, 'scriptorium') || text(raw, 'library'), project: text(raw, 'project'), topic: text(raw, 'topic'), layout: text(raw, 'layout')
  }),

  hasContent: (c) => c.scriptorium !== '',
  missing: (c) => (c.scriptorium === '' ? 'Wybierz skryptorium.' : null),

  fullscreen: true,
  shows: (c, size) => size.height === 'strip' ? 'Najnowszy tekst — tytuł i data.'
    : size.height === 'tall' ? `Całe archiwum: wyszukiwanie, filtry według aspektów; na początek ${LAYOUT_SAYS[layoutOf(c.layout)]}. Każdy tekst otwiera się z planem, nagraniami i źródłami.`
    : 'Ostatnie teksty z datą i krótkim opisem.',

  View: ({ config, ctx }) => (
    <WritingsCard
      library={config.scriptorium} title={config.title} project={config.project} topic={config.topic} layout={config.layout}
      size={ctx.size} whole={ctx.whole === true} prefix={`a${ctx.moduleId.slice(0, 8)}-`}
    />
  )
});
