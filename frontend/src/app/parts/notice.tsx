/**
 * Eine Ankündigung — kurz, und sie soll auffallen.
 *
 * <b>Ohne Überschrift, und das ist der Unterschied zum Text.</b> „Zapisy trwają
 * do 30 września" braucht keine Überschrift darüber; sie verdoppelte nur, was
 * ohnehin dasteht. Klein und flach im Raster, damit mehrere nebeneinander
 * passen — eine Ankündigung, die eine halbe Seite einnimmt, ist keine mehr.
 */

import { definePart, text, type RawConfig } from '../part';

interface Config {
  readonly body: string;
}

const read = (raw: RawConfig): Config => ({ body: text(raw, 'body') });

export const noticePart = definePart<Config>({
  kind: 'notice',
  label: 'Ogłoszenie',
  use: 'Jedno zdanie, które ma rzucać się w oczy.',
  box: { colSpan: 2, rowSpan: 1 },

  fields: [
    { key: 'body', label: 'Treść', kind: 'text', hint: 'Krótko — to ma rzucać się w oczy' }
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
      ? (size.width === 'full' ? 'Zdanie jako pas przez całą stronę.' : 'Zdanie w jednym wierszu, wyróżnione kreską.')
      : size.height === 'block' ? 'Zdanie większą czcionką.'
      : 'Zdanie jak plakat — duża czcionka, na środku.',

  View: ({ config }) => <p className="wk-card-notice">{config.body}</p>
});
