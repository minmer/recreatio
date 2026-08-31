/** Kontakt. Eine Adresse, die wirklich gelesen wird, und sonst nichts. */

import type { PublicCopy } from '../content';
import { PublicText } from '../PublicText';

export function ContactPage({ copy }: { copy: PublicCopy }) {
  const t = copy.contact;

  return (
    <article className="pub-page">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.lead}</p>

      <p className="pub-mail">
        <a href={`mailto:${t.email}`}>{t.email}</a>
      </p>

      <section className="pub-sec">
        <PublicText value={t.people} copy={copy} as="div" />
        <PublicText value={t.address} copy={copy} as="div" />
      </section>
    </article>
  );
}
