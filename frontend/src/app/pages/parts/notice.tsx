/**
 * Eine Ankündigung — kurz, und sie soll auffallen.
 *
 * <b>Ohne Überschrift, und das ist der Unterschied zum Text.</b> „Zapisy trwają
 * do 30 września" braucht keine Überschrift darüber; sie verdoppelte nur, was
 * ohnehin dasteht. Klein und flach im Raster, damit mehrere nebeneinander
 * passen — eine Ankündigung, die eine halbe Seite einnimmt, ist keine mehr.
 */

import { t } from '../../core/i18n';
import { definePart, text, type RawConfig } from '../part';

interface Config {
  readonly body: string;
}

const read = (raw: RawConfig): Config => ({ body: text(raw, 'body') });

export const noticePart = definePart<Config>({
  kind: 'notice',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { body: 'W tę niedzielę msza o 11:00 wyjątkowo w kaplicy.' }, // i18n-ignore
  label: 'moduleContent.notice.label',
  use: 'moduleContent.notice.use',
  box: { colSpan: 2, rowSpan: 1 },

  fields: [
    { key: 'body', label: 'moduleContent.notice.body', kind: 'text', hint: 'moduleContent.notice.bodyHint' }
  ],

  read,
  hasContent: (c) => c.body !== '',

  /*
   * DERSELBE SATZ, ANDERS LAUT. Mehr Inhalt hat eine Ankündigung nicht —
   * eine grössere Kachel heisst hier: sie soll lauter sein. Im Streifen eine
   * Zeile mit Randstrich, als Block grösser gesetzt, hoch wie ein Plakat; über
   * die ganze Breite als Band (`app.css`, nach `data-w`/`data-h`).
   */
  shows: (_config, size) =>
    size.height === 'strip'
      ? (size.width === 'full' ? t('moduleContent.notice.showsBand') : t('moduleContent.notice.showsLine'))
      : size.height === 'block' ? t('moduleContent.notice.showsBlock')
      : t('moduleContent.notice.showsTall'),

  View: ({ config }) => <p className="wk-card-notice">{config.body}</p>
});
