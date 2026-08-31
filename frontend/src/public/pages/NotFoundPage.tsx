/**
 * Eine unbekannte Adresse.
 *
 * Sie fuehrt NICHT stillschweigend auf die Startseite. Eine Umleitung verbirgt
 * kaputte Verweise genau so lange, bis jemand sich wundert, warum ueber einen
 * verteilten Link niemand ankommt.
 */

import type { PublicCopy } from '../content';
import { publicHref } from '../publicRoutes';

export function NotFoundPage({ copy }: { copy: PublicCopy }) {
  const t = copy.notFound;

  return (
    <article className="pub-page">
      <h1 className="pub-h1">{t.title}</h1>
      <p className="pub-lead">{t.body}</p>
      <p className="pub-onward">
        <a href={publicHref('manifest')}>{t.back}</a>
      </p>
    </article>
  );
}
