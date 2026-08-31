/**
 * „Przejrzystosc" (Abschnitt 4.1, letzter Absatz).
 *
 * <b>Der Abschnitt „Was es noch nicht gibt" ist der wichtigste.</b> Eine Seite
 * ueber Trennung von Taetigkeit und Privatvermoegen liest sich ohne ihn wie die
 * Beschreibung einer gepruefter Einrichtung. Getrennte Buchfuehrung,
 * Gemeinnuetzigkeit und Pruefung gibt es NICHT — und das muss dastehen, nicht
 * fehlen.
 */

import type { PublicCopy } from '../content';

export function TransparencyPage({ copy }: { copy: PublicCopy }) {
  const t = copy.transparency;

  return (
    <article className="pub-page">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.separation.title}</h2>
        <p className="pub-p">{t.separation.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.house.title}</h2>
        <p className="pub-p">{t.house.body}</p>
      </section>

      <section className="pub-sec pub-standing-sec">
        <h2 className="pub-h2">{t.notYet.title}</h2>
        <p className="pub-p">{t.notYet.body}</p>
      </section>
    </article>
  );
}
