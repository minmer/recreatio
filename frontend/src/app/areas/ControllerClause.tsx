/**
 * 0129 — DIE KLAUSEL als Baustein (die Worte: `clause.ts`).
 *
 * `report`: wohin „Zgłoś" führt — die Sache, um die es geht (eine Seite, ein
 * Formular, ein Termin); ohne Angabe kein Knopf.
 */

import { reportPath } from '../reports/reportPath';
import { clauseLines, type ClauseContext, type ClauseController } from './clause';

export function ControllerClause({ controller, context, report, className }: {
  controller: ClauseController | null;
  context: ClauseContext;
  report?: { readonly kind: string; readonly id: string } | null;
  className?: string;
}) {
  const l = clauseLines(controller, context);
  return (
    <div className={`wk-clause${className === undefined ? '' : ` ${className}`}`} data-clause={controller === null ? 'nobody' : 'named'}>
      <p className="wk-clause-who">{l.who ?? l.nobody}</p>
      {l.dpo !== null && <p>{l.dpo}</p>}
      {l.complaint !== null && <p>{l.complaint}</p>}
      <p className="wk-clause-operator">
        {l.operator}
        {report !== undefined && report !== null && (
          <> <a className="wk-link" href={reportPath(report.kind, report.id)} data-report={report.kind}>Zgłoś</a></>
        )}
      </p>
    </div>
  );
}
