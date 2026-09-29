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
import { splitRow, weekdaysIn } from '../weekday';

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

  /*
   * IMMER ALLE ZEILEN — eine Öffnungszeit wegzulassen hiesse, dass jemand an
   * dem Tag vor verschlossener Tür steht. Was sich mit der Grösse ändert, ist
   * die Anordnung: im Streifen hintereinander, schmal als Tafel mit zwei
   * Spalten, breit auf zwei oder drei Spalten verteilt. Die Zeile, die HEUTE
   * gilt, ist hervorgehoben — nach ihr sucht, wer die Kachel aufschlägt.
   */
  shows: (_config, size) =>
    size.height === 'strip' ? 'Wszystkie pozycje w jednym ciągu; dzisiejsza wyróżniona.'
    : size.width === 'wide' ? 'Tabela w dwóch kolumnach; dzisiejsza pozycja wyróżniona.'
    : size.width === 'full' ? 'Tabela w trzech kolumnach; dzisiejsza pozycja wyróżniona.'
    : 'Tabela: dzień i godziny; dzisiejsza pozycja wyróżniona.',

  View: ({ config }) => {
    const today = new Date().getDay();

    return (
      <>
        {config.title !== '' && <h2 className="wk-card-title">{config.title}</h2>}
        <ul className="wk-card-lines wk-hours">
          {config.rows.map((row, i) => {
            const { label, value } = splitRow(row);
            const now = weekdaysIn(label).has(today);

            return (
              <li key={i} className={now ? 'is-today' : undefined}>
                <span className="wk-hours-label">{label}{now && <span className="wk-hours-today"> dziś</span>}</span>
                {value !== null && <span className="wk-hours-value">{value}</span>}
              </li>
            );
          })}
        </ul>
      </>
    );
  }
});
