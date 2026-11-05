/**
 * „ARCHIWUM TEKSTÓW" (0064) — die Texte eines Skryptorium (bis 2026-10-23:
 * einer Bibliothek; eine ältere Seite nennt es noch `library`, es wird weiter
 * gelesen). Wer sie sieht, entscheidet sein Bereich:
 * alle oder die eines Projekts (ein Zyklus von Predigten, ein Buch). Jeder
 * öffnet sich ganz, an Ort und Stelle; `?t=<kennung>` in der
 * Adresse öffnet ihn gleich — ein Text des Archivs lässt sich verschicken.
 *
 * <b>Je Grösse:</b> im Streifen der neueste Text; als Block die letzten mit
 * Datum und kurzem Inhalt; hoch und im Vollbild das ganze Archiv.
 *
 * <b>2026-10-21 — für sehr viele Kazania:</b> hoch und im Vollbild mit
 * Suche, einem Filter je Achse und drei Ansichten — Lista, Tabela (je Achse
 * eine Spalte), Drzewo (die Werte einer Achse, mit Zahlen). Ein geöffneter
 * Text zeigt seinen Plan, die Wygłoszenia (mit Nagranie und dem, was gesagt
 * und was ausgelassen wurde) und die Quellen. 2026-10-23 (Schritt 5): die
 * Achsen sind die Verweisfelder der Rodzaje tekstów („Tajemnica", „Obszar"),
 * nicht mehr Themen; eine alte Einstellung `topic` wird nicht mehr gelesen.
 *
 * 2026-10-22 (Schritt 10) — die TABELA ist ausgemustert: Tabelle und Macierz
 * gibt der Baustein „Widok" (mit dem Kazanie als innerer Ansicht). Wer sie
 * schon eingestellt hat, behält sie.
 */

import { t } from '../../core/i18n';
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
  /** 2026-10-21 — womit das Archiv beginnt: „lista", „tabela", „drzewo"; der Besucher kann wechseln. */
  readonly layout: string;
}

const LAYOUT_SAYS: Record<string, string> = {
  list: 'moduleContent.writings.layoutSays.list',
  table: 'moduleContent.writings.layoutSays.table',
  tree: 'moduleContent.writings.layoutSays.tree'
};

export const writingsPart = definePart<WritingsConfig>({
  kind: 'writings',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Kazania', scriptorium: '<id-skryptorium>', project: '<id-projektu albo puste>', layout: 'drzewo' }, // i18n-ignore
  label: 'moduleContent.writings.label',
  use: 'moduleContent.writings.use',
  box: { colSpan: 6, rowSpan: 5 },

  fields: [
    { key: 'title', label: 'moduleContent.writings.title', kind: 'line', hint: 'moduleContent.writings.titleHint' },
    { key: 'scriptorium', label: 'moduleContent.writings.scriptorium', kind: 'scriptorium' },
    { key: 'project', label: 'moduleContent.writings.project', kind: 'libraryEntry', of: 'scriptorium', entryKinds: ['project'], optional: true },
    { key: 'layout', label: 'moduleContent.writings.layout', kind: 'line', hint: 'moduleContent.writings.layoutHint' }
  ],

  read: (raw: RawConfig): WritingsConfig => ({
    title: text(raw, 'title'), scriptorium: text(raw, 'scriptorium') || text(raw, 'library'), project: text(raw, 'project'), layout: text(raw, 'layout')
  }),

  hasContent: (c) => c.scriptorium !== '',
  missing: (c) => (c.scriptorium === '' ? t('moduleContent.writings.missing') : null),

  fullscreen: true,
  shows: (c, size) => size.height === 'strip' ? t('moduleContent.writings.showsStrip')
    : size.height === 'tall' ? t('moduleContent.writings.showsTall', { layout: t(LAYOUT_SAYS[layoutOf(c.layout)]) })
    : t('moduleContent.writings.showsBlock'),

  View: ({ config, ctx }) => (
    <WritingsCard
      library={config.scriptorium} title={config.title} project={config.project} layout={config.layout}
      size={ctx.size} whole={ctx.whole === true} prefix={`a${ctx.moduleId.slice(0, 8)}-`}
    />
  )
});
