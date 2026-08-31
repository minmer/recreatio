/**
 * „Bezpieczeństwo" — warum die Werkzeuge so gebaut sind.
 *
 * <b>Diese Seite gehört zu REcreatio und nicht zur Plattform.</b> Sie erklärt
 * kein Bedienfeld, sondern eine Haltung — und ohne sie liest sich jede
 * Eigenheit der Werkzeuge als Mangel: kein Verwalter, keine Zurücksetzung des
 * Passworts, kein Verzeichnis der Gemeinschaften. Das sind Entscheidungen, und
 * jede kostet etwas. Was sie kostet, steht dabei.
 *
 * <b>Der vierte Punkt ist der unbequeme.</b> „Freigabe zurücknehmen" klingt
 * nach einem Knopf, der die Vergangenheit einholt. Er tut es nicht, und das
 * steht so auf der Seite. Eine Einrichtung, die den Umgang mit Daten erklärt
 * und dabei die eine unangenehme Grenze verschweigt, hat nichts erklärt.
 */

import type { PublicCopy } from '../content';
import { publicHref } from '../publicRoutes';

export function SecurityPage({ copy }: { copy: PublicCopy }) {
  const t = copy.security;

  return (
    <article className="pub-page pub-wide">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <div className="pub-points">
        {t.points.map((point) => (
          <section className="pub-point" key={point.q}>
            <h2 className="pub-h2">{point.q}</h2>
            <p className="pub-p">{point.a}</p>
          </section>
        ))}
      </div>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.originTitle}</h2>
        <p className="pub-p">{t.origin}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.toolsTitle}</h2>
        <p className="pub-p">{t.toolsIntro}</p>

        <div className="pub-tools">
          {t.tools.map((tool) => (
            <div className="pub-tool" key={tool.name}>
              <h3 className="pub-h3">{tool.name}</h3>
              <p className="pub-p">{tool.body}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="pub-onward">
        <a href={publicHref('narzedzia')}>{copy.nav.narzedzia}</a>
        <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
      </p>
    </article>
  );
}
