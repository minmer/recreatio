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

  View: ({ config }) => <p className="wk-card-notice">{config.body}</p>
});
