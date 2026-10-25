/**
 * 0129/0130 — UNTER JEDER ÖFFENTLICHEN SEITE: wer für ihren Inhalt geradesteht, wer
 * den Dienst betreibt, und „Zgłoś".
 *
 * Unter einer eigenen Domain (cogita.pl) führt „Zgłoś" nach recreatio.pl — dort gibt
 * es `#/zglos`, unter der Domain wäre es ein Pfad der Seite.
 */

import { clauseLines, type ClauseController } from '../areas/clause';
import { foreignHost, PRIMARY_HOST } from '../routes';
import { reportPath } from './reportPath';

export function PageFooter({ pageId, responsible, restricted }: {
  /** Die Kennung der Seite (bei einem Alias: die ihres Ziels) — `undefined`: ein Dienst von vorher. */
  pageId: string | undefined;
  /** `undefined`: der Dienst sagt es (noch) nicht; `null`: niemand. */
  responsible: { readonly controller: ClauseController | null } | null | undefined;
  /** Nur mit Zugang: wer fehlt, steht in den Bereichen der Seite, nicht hier. */
  restricted: boolean;
}) {
  const away = foreignHost() !== null;
  const href = pageId === undefined ? null
    : away ? `https://${PRIMARY_HOST}/${reportPath('page', pageId)}`
    : reportPath('page', pageId);

  const controller = responsible?.controller ?? null;
  const known = responsible !== undefined && (controller !== null || !restricted);
  const l = clauseLines(controller, 'page');

  return (
    <footer className="wk-clause is-footer wk-page-footer" data-clause={controller === null ? 'nobody' : 'named'} data-page-footer="">
      {known && <p className="wk-clause-who">{l.who ?? l.nobody}</p>}
      {known && l.dpo !== null && <p>{l.dpo}</p>}
      <p className="wk-clause-operator">
        {l.operator}
        {href !== null && (
          <> <a className="wk-link" href={href} data-report="page" {...(away ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>Zgłoś treść</a></>
        )}
      </p>
    </footer>
  );
}

export default PageFooter;
