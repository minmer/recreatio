/**
 * Öffnungszeiten — eine Zeile je Eintrag.
 *
 * <b>Warum nicht einfach ein Text.</b> Weil es keiner ist: „wtorek —
 * 16:00–18:00" ist eine Tafel mit zwei Spalten, keine Prosa. Als Absätze
 * gesetzt liest man sie Zeile für Zeile statt sie zu überfliegen — und
 * überflogen wird sie, denn wer sie aufschlägt, sucht EINEN Tag.
 *
 * Es ist ausserdem die Angabe, nach der auf einer Pfarrseite am häufigsten
 * gesucht wird.
 */

import { definePart, lines, text, type RawConfig } from '../part';

interface Config {
  readonly title: string;
  readonly rows: readonly string[];
}

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  rows: lines(raw, 'body')
});

export const hoursPart = definePart<Config>({
  kind: 'hours',
  label: 'Godziny',
  use: 'Kancelaria, spowiedź — jedna pozycja w wierszu.',
  box: { colSpan: 2, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Kancelaria' },
    {
      key: 'body', label: 'Godziny', kind: 'text',
      hint: 'Jedna pozycja w wierszu: wtorek — 16:00–18:00'
    }
  ],

  read,
  hasContent: (c) => c.rows.length > 0,

  View: ({ config }) => (
    <>
      {config.title !== '' && <h2 className="wk-card-title">{config.title}</h2>}
      <ul className="wk-card-lines">
        {config.rows.map((row, i) => <li key={i}>{row}</li>)}
      </ul>
    </>
  )
});
