/**
 * „O inicjatywie" — die ehrliche Standortbestimmung (Abschnitt 0).
 *
 * Diese Seite gibt es, damit das Manifest nicht mit Erklaerungen befrachtet
 * werden muss. Wer wissen will, was „Initiative im Entstehen" genau heisst,
 * findet es hier ausbuchstabiert: keine Rechtsperson, kein Register, kein
 * Vorstand, keine Satzung, kein Gemeinnuetzigkeitsstatus.
 */

import type { PublicCopy } from '../content';
import { PublicText } from '../PublicText';
import { publicHref } from '../publicRoutes';

export function AboutPage({ copy }: { copy: PublicCopy }) {
  const t = copy.about;

  return (
    <article className="pub-page">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.whatInitiativeMeans.title}</h2>
        <p className="pub-p">{t.whatInitiativeMeans.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.family.title}</h2>
        <p className="pub-p">{t.family.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.road.title}</h2>
        <p className="pub-p">{t.road.body}</p>
      </section>

      <section className="pub-sec">
        <h2 className="pub-h2">{t.people.title}</h2>
        <PublicText value={t.people.body} copy={copy} as="div" />
      </section>

      <p className="pub-onward">
        <a href={publicHref('przejrzystosc')}>{copy.nav.przejrzystosc}</a>
      </p>
    </article>
  );
}
