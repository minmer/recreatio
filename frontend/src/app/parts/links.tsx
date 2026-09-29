/**
 * Verweise auf andere Seiten des Hauses.
 *
 * <b>Nur nach innen.</b> Der Pfad ist eine Adresse im Register, und daraus
 * baut `pagePath` den Verweis — wer hier etwas Fremdes einträgt, bekommt keinen
 * Link nach draussen, sondern eine Seite, die es nicht gibt. Das ist Absicht:
 * ein Baustein, der auch nach aussen verlinkt, ist zwei Bausteine mit einem
 * Namen, und man sieht einer Zeile nicht an, welcher davon gemeint war.
 *
 * <b>Eine kaputte Zeile fällt still heraus</b> und nimmt die übrigen nicht mit.
 */

import { definePart, lines, readLink, text, type RawConfig } from '../part';
import { pagePath } from '../routes';

interface Config {
  readonly title: string;
  readonly links: readonly { readonly label: string; readonly path: string }[];
}

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  links: lines(raw, 'body')
    .map(readLink)
    .filter((one): one is { label: string; path: string } => one !== null)
});

export const linksPart = definePart<Config>({
  kind: 'links',
  label: 'Odnośniki',
  use: 'Przejście na inne strony tego adresu.',
  box: { colSpan: 2, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Zobacz też' },
    {
      key: 'body', label: 'Odnośniki', kind: 'text',
      hint: 'Jeden w wierszu: Zapisy — parafia/bierzmowanie'
    }
  ],

  read,
  hasContent: (c) => c.links.length > 0,

  /*
   * Im Streifen hintereinander, schmal als Liste — und breit als Kacheln
   * nebeneinander, die man trifft, ohne zu zielen: eine breite Kachel voller
   * kurzer Zeilen links und leerer Fläche rechts sähe aus wie ein Versehen.
   */
  shows: (_config, size) =>
    size.height === 'strip' ? 'Odnośniki w jednym wierszu.'
    : size.width === 'wide' || size.width === 'full' ? 'Odnośniki jako przyciski obok siebie.'
    : 'Odnośniki jeden pod drugim.',

  View: ({ config }) => (
    <>
      {config.title !== '' && <h2 className="wk-card-title">{config.title}</h2>}
      <ul className="wk-card-lines wk-links">
        {config.links.map((one, i) => (
          <li key={i}><a className="wk-link" href={pagePath(one.path)}>{one.label}</a></li>
        ))}
      </ul>
    </>
  )
});
