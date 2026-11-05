/**
 * „TEKST ZE SKRYPTORIUM" (0064; seit 2026-10-23 aus dem Skryptorium) — eine
 * Predigt, ein Kapitel, eine Betrachtung, mit Plan, Wygłoszenia, Fussnoten,
 * „Dalsze informacje" und den Quellen.
 *
 * Gezeigt wird der Eintrag selbst, nicht eine Kopie: wer den Text im
 * Skryptorium überarbeitet, ändert ihn auf jeder Seite, auf der er steht. Wer
 * ihn sieht, entscheidet der Bereich des Skryptorium (2026-10-22) — ein Leser,
 * der ihn nicht lesen darf, sieht „Tego tekstu nie ma albo nie możesz go
 * zobaczyć". Eine ältere Seite nennt den Behälter noch `library`: er wird
 * weiter gelesen (gefunden wird der Text dort, wo er jetzt liegt).
 *
 * <b>Je Grösse:</b> im Streifen ein Knopf; als Block Titel, Datum und der
 * Anfang, „Czytaj całość" klappt auf; hoch und im Vollbild das Ganze.
 */

import { t } from '../../core/i18n';
import { definePart, text, type RawConfig } from '../part';
import { later } from '../../ui/later';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const WritingCard = later(() => import('../../scriptorium/WritingCard').then((m) => m.WritingCard));

interface WritingConfig {
  /** 2026-10-23 — das Skryptorium (eine ältere Seite: `library`). */
  readonly scriptorium: string;
  readonly entry: string;
}

export const writingPart = definePart<WritingConfig>({
  kind: 'writing',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { scriptorium: '<id-skryptorium>', entry: '<id-tekstu>' }, // i18n-ignore
  label: 'moduleContent.writing.label',
  use: 'moduleContent.writing.use',
  box: { colSpan: 6, rowSpan: 5 },

  fields: [
    { key: 'scriptorium', label: 'moduleContent.writing.scriptorium', kind: 'scriptorium' },
    { key: 'entry', label: 'moduleContent.writing.entry', kind: 'libraryEntry', of: 'scriptorium', entryKinds: ['text'] }
  ],

  read: (raw: RawConfig): WritingConfig => ({ scriptorium: text(raw, 'scriptorium') || text(raw, 'library'), entry: text(raw, 'entry') }),

  hasContent: (c) => c.scriptorium !== '' && c.entry !== '',
  missing: (c) => (c.scriptorium === '' || c.entry === '' ? t('moduleContent.writing.missing') : null),

  strip: { title: 'moduleContent.writing.stripTitle', open: 'moduleContent.writing.stripOpen' },
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleContent.writing.showsStrip')
    : size.height === 'tall' ? t('moduleContent.writing.showsTall')
    : t('moduleContent.writing.showsBlock'),

  View: ({ config, ctx }) => (
    <WritingCard library={config.scriptorium} entryId={config.entry} size={ctx.size} whole={ctx.whole === true} prefix={`w${ctx.moduleId.slice(0, 8)}-`} />
  )
});
