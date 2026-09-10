/**
 * Das Manifest — die Startseite (Abschnitt 4.1).
 *
 * <b>Sieben Abschnitte in der Reihenfolge des Auftrags.</b> Sie ist nicht
 * beliebig: Eröffnung, Auftrag, Bereiche, Inspiration, Familie, Weg, Schluss.
 * Wer sie umstellt, stellt die Aussage um — die Offenheit steht vor der
 * Herkunft, weil sonst die Herkunft die Offenheit einschränkt.
 *
 * <b>Genau eine Überschrift erster Ordnung.</b> Der Foliensatz hatte elf, eine
 * je Folie. Für ein Vorführstück nachlässig, für die Eingangstür einer
 * Einrichtung schädlich: elf gleichrangige Überschriften heissen für ein
 * Vorleseprogramm elf Dokumente ohne Ordnung.
 *
 * <b>Der Satz „Initiative im Entstehen" steht oben, nicht im Kleingedruckten.</b>
 * Abschnitt 0 verlangt, dass nichts eine bestehende Rechtsform behauptet. Das
 * lässt sich nicht durch Weglassen erreichen — wer eine Einrichtung dieser Art
 * beschreibt, ohne ihren Stand zu nennen, wird als eingetragene Einrichtung
 * gelesen. Es muss dastehen.
 */

import type { PublicCopy } from '../content';
import { PublicText } from '../PublicText';
import { publicHref } from '../publicRoutes';

export function ManifestPage({ copy }: { copy: PublicCopy }) {
  const t = copy.manifest;

  return (
    <article className="pub-page pub-manifest">
      <header className="pub-open">
        <h1 className="pub-h1">{t.title}</h1>
        <PublicText value={t.opening.lead} copy={copy} as="div" />

        {/* Der ehrliche Satz. Er steht in einem eigenen Kasten, damit er nicht
            als Werbezeile gelesen wird — er ist eine Auskunft. */}
        <p className="pub-standing">{t.opening.inFormation}</p>

        <p className="pub-open-more">
          <a href={publicHref('o-nas')}>{copy.nav['o-nas']}</a>
          <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
        </p>
      </header>

      <section className="pub-sec" id="misja" aria-labelledby="h-misja">
        <h2 className="pub-h2" id="h-misja">{t.mission.title}</h2>
        <PublicText value={t.mission.body} copy={copy} as="div" />
      </section>

      <section className="pub-sec" id="obszary" aria-labelledby="h-obszary">
        <h2 className="pub-h2" id="h-obszary">{t.areas.title}</h2>

        {/* Keine Nummerierung. Die sechs Bereiche sind kein Ablauf und keine
            Rangfolge — eine Zählung davor behauptete beides. */}
        <ul className="pub-areas">
          {t.areas.items.map((area) => (
            <li key={area.name}>
              <h3 className="pub-h3">{area.name}</h3>
              <PublicText value={area.body} copy={copy} as="div" />
            </li>
          ))}
        </ul>
      </section>

      <section className="pub-sec" id="inspiracja" aria-labelledby="h-inspiracja">
        <h2 className="pub-h2" id="h-inspiracja">{t.inspiration.title}</h2>
        <PublicText value={t.inspiration.body} copy={copy} as="div" />
      </section>

      <section className="pub-sec" id="rodzina" aria-labelledby="h-rodzina">
        <h2 className="pub-h2" id="h-rodzina">{t.family.title}</h2>
        <PublicText value={t.family.body} copy={copy} as="div" />
      </section>

      <section className="pub-sec" id="droga" aria-labelledby="h-droga">
        <h2 className="pub-h2" id="h-droga">{t.road.title}</h2>
        <PublicText value={t.road.intro} copy={copy} as="div" />

        {/* HIER ist eine Zählung richtig: der Plan ist eine Reihenfolge, und
            „zuerst das Haus" ist eine Aussage über die Reihenfolge. */}
        <ol className="pub-road">
          {t.road.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section className="pub-sec pub-closing" aria-label={t.closing.join(' ')}>
        <p>
          {t.closing.map((word) => <span key={word}>{word}</span>)}
        </p>
      </section>
    </article>
  );
}
