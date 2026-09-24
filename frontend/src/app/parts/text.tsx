/**
 * Fliesstext — das Rückgrat jeder Seite.
 *
 * <b>Über die ganze Breite.</b> Bei der Firmung sind das mehrere Absätze am
 * Stück. Mit einer halben Spalte als Vorgabe musste jeder davon einzeln breiter
 * gezogen werden; wer es vergass, hatte eine Seite, die zur Hälfte leer aussah.
 * Nebeneinander stellt man zwei Texte weiterhin — nur ist das der seltenere
 * Fall, und der seltenere Fall soll die Arbeit machen.
 */

import { definePart, lines, text, type RawConfig } from '../part';

interface Config {
  readonly title: string;
  readonly body: readonly string[];
}

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  body: lines(raw, 'body')
});

export const textPart = definePart<Config>({
  kind: 'text',
  label: 'Tekst',
  use: 'Akapity — to, co strona ma powiedzieć.',
  box: { colSpan: 6, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line' },
    { key: 'body', label: 'Treść', kind: 'text' }
  ],

  read,

  /* Eine Überschrift über nichts ist eine Überschrift über nichts. */
  hasContent: (c) => c.body.length > 0,

  View: ({ config }) => (
    <>
      {config.title !== '' && <h2 className="wk-card-title">{config.title}</h2>}
      {config.body.map((line, i) => <p key={i} className="wk-card-text">{line}</p>)}
    </>
  )
});
