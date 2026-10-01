/**
 * Fliesstext — das Rückgrat jeder Seite.
 *
 * <b>Über die ganze Breite.</b> Bei der Firmung sind das mehrere Absätze am
 * Stück. Mit einer halben Spalte als Vorgabe musste jeder davon einzeln breiter
 * gezogen werden; wer es vergass, hatte eine Seite, die zur Hälfte leer aussah.
 * Nebeneinander stellt man zwei Texte weiterhin — nur ist das der seltenere
 * Fall, und der seltenere Fall soll die Arbeit machen.
 *
 * <b>Je Grösse:</b> im Streifen die Überschrift und der erste Absatz, der Rest
 * hinter „Czytaj dalej" — ein Streifen ist ein Anriss, kein abgeschnittener
 * Text. Als Block und hoch der ganze Text; hoch über die ganze Breite in zwei
 * Spalten (`app.css`), denn eine Zeile über 1200 Pixel verliert man beim
 * Sprung in die nächste. Als Block über die ganze Breite bleibt er, wie er
 * ist: so stehen die Seiten, die es schon gibt, und dort soll nichts rücken.
 *
 * <b>„## " macht eine Zwischenüberschrift.</b> So schreibt man sie ohnehin in
 * ein Textfeld — und so standen sie schon da, als Doppelkreuz im Text.
 */

import { useState } from 'react';

import { definePart, lines, text, type RawConfig } from '../part';

interface Config {
  readonly title: string;
  readonly body: readonly string[];
}

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  body: lines(raw, 'body')
});

/** Eine Zeile des Textes: Zwischenüberschrift oder Absatz. */
function Line({ line }: { line: string }) {
  const heading = /^#{2,3}\s+(.*)$/.exec(line);
  return heading !== null
    ? <h3 className="wk-card-sub">{heading[1]}</h3>
    : <p className="wk-card-text">{line}</p>;
}

function TextView({ config, strip }: { config: Config; strip: boolean }) {
  const [open, setOpen] = useState(false);

  /* Der Anriss: der erste Absatz, der keine Überschrift ist. */
  const lead = config.body.findIndex((line) => !/^#{2,3}\s/.test(line));
  const teaser = strip && !open && lead >= 0 && config.body.length > 1;
  const shown = teaser ? [config.body[lead]] : config.body;

  return (
    <>
      {config.title !== '' && <h2 className="wk-card-title">{config.title}</h2>}
      {shown.map((line, i) => <Line key={i} line={line} />)}
      {teaser && (
        <button type="button" className="wk-link-btn wk-card-more" onClick={() => setOpen(true)}>
          Czytaj dalej
        </button>
      )}
    </>
  );
}

export const textPart = definePart<Config>({
  kind: 'text',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: {
    title: 'O wspólnocie',
    body: 'Spotykamy się w każdy czwartek o 19:30 w salce przy kościele.\n## Kto może przyjść\nKażdy — nie trzeba się zapisywać.'
  },
  label: 'Tekst',
  use: 'Akapity — to, co strona ma powiedzieć.',
  box: { colSpan: 6, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line' },
    { key: 'body', label: 'Treść', kind: 'text', hint: 'Akapit w wierszu; „## " na początku robi śródtytuł' }
  ],

  read,

  /* Eine Überschrift über nichts ist eine Überschrift über nichts. */
  hasContent: (c) => c.body.length > 0,

  shows: (_config, size) =>
    size.height === 'strip' ? 'Nagłówek i pierwszy akapit; reszta po „Czytaj dalej".'
    : size.width === 'full' && size.height === 'tall' ? 'Cały tekst w dwóch szpaltach, jak w gazecie.'
    : 'Cały tekst.',

  /* Ein langer Text liest sich im ganzen Fenster besser — in zwei Spalten, ohne Seite drumherum. */
  fullscreen: true,

  View: ({ config, ctx }) => <TextView config={config} strip={ctx.size.height === 'strip'} />
});
