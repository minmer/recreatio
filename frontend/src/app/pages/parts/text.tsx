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
 *
 * <b>2026-10-22 — derselbe Leser wie die Bibliothek.</b> `**fett**`,
 * `*kursiv*`, `[napis](adres)` liest `libraryMarkup.ts`. Wer eine Bibliothek
 * wählt (`library`), kann aus ihr zitieren: `[@klucz, s. 12]` auf ein Werk,
 * ein Zitat, eine Person wird eine Fussnote, `[@klucz]` auf einen eigenen
 * Eintrag (ein Text, ein Komentarz, ein Thema) und `[[Wort|@klucz]]` ein Link,
 * `^[…]` eine Fussnote ohne Quelle. Was der Leser in dieser Bibliothek nicht
 * lesen darf, heisst „[odwołanie niedostępne]" — nichts darüber hinaus.
 */

import { useState } from 'react';

import { definePart, lines, text, type RawConfig } from '../part';
import { RichLine } from '../../ui/richText';
import { later } from '../../ui/later';

/* Die Bibliothek erst, wenn ein Text auf sie verweist (`ui/later`): ein schlichter Text lädt sie nicht. */
const LibraryLines = later(() => import('../../library/LibraryLines').then((m) => m.LibraryLines));

interface Config {
  readonly title: string;
  readonly body: readonly string[];
  /** 2026-10-22 — woraus `[@…]` und `[[…|@…]]` zitieren (leer: aus nichts). */
  readonly library: string;
}

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  body: lines(raw, 'body'),
  library: text(raw, 'library')
});

/** Steht im Text ein Verweis oder eine Fussnote? Dann zeichnet ihn der Leser mit der Bibliothek. */
const REFERENCES = /\[@|\|@[^\]]*\]\]|\^\[/;

/**
 * Eine Zeile des Textes: Zwischenüberschrift, Absatz — und seit 0085 eine
 * grosse Zeile (`# `), eine leise (`> `), Verweise (`[Napis](adres)`) und eine
 * Zeile nur aus Verweisen als Reihe (`richText.tsx`).
 */
function Line({ line }: { line: string }) {
  return <RichLine line={line} />;
}

function TextView({ config, strip, prefix }: { config: Config; strip: boolean; prefix: string }) {
  const [open, setOpen] = useState(false);

  /* Der Anriss: der erste Absatz, der keine Überschrift ist. */
  const lead = config.body.findIndex((line) => !/^#{2,3}\s/.test(line));
  const teaser = strip && !open && lead >= 0 && config.body.length > 1;
  const shown = teaser ? [config.body[lead]] : config.body;

  return (
    <>
      {config.title !== '' && <h2 className="wk-card-title">{config.title}</h2>}
      {shown.some((line) => REFERENCES.test(line))
        ? <LibraryLines library={config.library} lines={shown} prefix={prefix} />
        : shown.map((line, i) => <Line key={i} line={line} />)}
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
    body: 'Spotykamy się w każdy czwartek o 19:30 w salce przy kościele.\n## Kto może przyjść\nKażdy — nie trzeba się zapisywać. **Wspólnota** rośnie ze słuchania słowa [@ratzinger2007, s. 183]; więcej w [[kazaniu o chlebie|@kazanie-chleb]].',
    /* 2026-10-22 — woraus \`[@…]\` und \`[[…|@…]]\` zitieren; ohne Verweise im Text bleibt es leer. */
    library: '<id-biblioteki>'
  },
  label: 'Tekst',
  use: 'Akapity — to, co strona ma powiedzieć.',
  box: { colSpan: 6, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line' },
    { key: 'body', label: 'Treść', kind: 'text', hint: 'Akapit w wierszu; „## " — śródtytuł, „# " — duża linia, „> " — mała; **pogrubienie**, *kursywa*; link: [napis](https://… albo #/strona); z wybranej biblioteki: [@klucz, s. 12] — przypis do źródła, [[słowo|@klucz]] — link do wpisu, ^[…] — przypis' },
    { key: 'library', label: 'Odwołania z biblioteki', kind: 'library', optional: true, hint: 'Opcjonalnie: biblioteka, z której tekst cytuje ([@klucz]). Kto jej nie może czytać, zobaczy „[odwołanie niedostępne]”.' }
  ],

  read,

  /* Eine Überschrift über nichts ist eine Überschrift über nichts. */
  hasContent: (c) => c.body.length > 0,

  shows: (_config, size) =>
    size.height === 'strip' ? 'Nagłówek i pierwszy akapit; reszta po „Czytaj dalej".'
    : size.width === 'full' && size.height === 'tall' ? 'Cały tekst w dwóch szpaltach, jak w gazecie.'
    : 'Cały tekst.',

  /* Ein langer Text liest sich im ganzen Fenster besser — in zwei Spalten, ohne Seite drumherum. Ein kurzer nicht (2026-10-17). */
  fullscreen: (c) => c.body.length > 4 || c.body.join(' ').length > 480,

  View: ({ config, ctx }) => <TextView config={config} strip={ctx.size.height === 'strip'} prefix={`t${ctx.moduleId.slice(0, 8)}-`} />
});
