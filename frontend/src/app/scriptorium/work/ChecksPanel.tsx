/**
 * DIE PRÜFUNG (2026-11-15) — der Bericht je Weg, nie eine Sperre: nach Gewicht (muss, soll, Hinweis) und Art
 * gruppiert; jeder Befund sagt, was, warum und was es behebt, mit Links an die Stelle (und zum Eintrag). Dieselben
 * Befunde liest eine KI über `get_work_checks`.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { cogitaPath } from '../../cogita/parts';
import { viewPath } from '../../routes';
import { countFindings, type Finding, type Weight } from './workChecks';
import { PathPick, pathKeyOf, type WorkCtx } from './WorkView';

const WEIGHTS: readonly Weight[] = ['must', 'should', 'info'];

export function ChecksPanel({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const report = ctx.work.report(pathKeyOf(ctx));
  const [showInfo, setShowInfo] = useState(false);
  if (report === undefined) return null;
  const counts = countFindings(report.findings);
  const all = ctx.work.reports.length > 1 ? ctx.work.reports.map((r) => ({ path: r.path, counts: countFindings(r.findings) })) : [];

  return (
    <div className="work-checks">
      <div className="work-toolbar">
        <PathPick ctx={ctx} all={false} />
        <p className="work-badges" aria-live="polite">
          {WEIGHTS.map((w) => <span key={w} className={`work-count is-${w}`}>{t(`workUi.checks.${w}`)}: {counts[w]}</span>)}
        </p>
      </div>
      {all.length > 0 && (
        <ul className="work-path-summary">
          {all.map((one) => (
            <li key={one.path.key}>
              <button type="button" className={one.path.key === report.path.key ? 'wk-link-btn is-on' : 'wk-link-btn'} onClick={() => ctx.setPath(one.path.key)}>
                {one.path.name === '' ? t('workUi.path.default') : one.path.name}
              </button>
              <span className="lib-meta">{t('workUi.checks.summary', { must: one.counts.must, should: one.counts.should })}</span>
            </li>
          ))}
        </ul>
      )}
      {report.findings.length === 0 && <p className="wk-note">{t('workUi.checks.clean')}</p>}
      {WEIGHTS.map((w) => {
        const list = report.findings.filter((f) => f.weight === w);
        if (list.length === 0) return null;
        if (w === 'info' && !showInfo) {
          return <p key={w}><button type="button" className="wk-link-btn" onClick={() => setShowInfo(true)}>{t('workUi.checks.showInfo', { count: list.length })}</button></p>;
        }
        const codes = [...new Set(list.map((f) => f.code))];
        return (
          <section key={w} className={`work-check-group is-${w}`}>
            <h2 className="wk-h2">{t(`workUi.checks.${w}`)} <span className="lib-count">{list.length}</span></h2>
            {codes.map((code) => {
              const of = list.filter((f) => f.code === code);
              return (
                <details key={code} className="wk-fold work-check-code" open={of.length <= 8}>
                  <summary>{t(`workUi.checks.code.${code}`)} <span className="lib-count">{of.length}</span></summary>
                  <ul className="work-findings">
                    {of.map((f) => <FindingRow key={f.id} ctx={ctx} finding={f} />)}
                  </ul>
                </details>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function FindingRow({ ctx, finding }: { ctx: WorkCtx; finding: Finding }) {
  const t = useT();
  const base = finding.entity === undefined ? undefined : ctx.work.knowledge.get(finding.entity)?.base;
  return (
    <li className={`work-finding is-${finding.weight}`}>
      <p className="work-finding-msg">{finding.message}</p>
      <p className="lib-meta">{t('workUi.checks.why', { why: finding.why })}</p>
      <p className="lib-meta">{t('workUi.checks.fix', { fix: finding.fix })}</p>
      <p className="wk-actions">
        {finding.node !== undefined && <a className="wk-link-btn" href={ctx.href('struktura', finding.node)}>{t('workUi.checks.openNode')}</a>}
        {finding.entity !== undefined && base !== undefined && <a className="wk-link-btn" href={cogitaPath(base, 'wpisy', finding.entity)}>{t('workUi.checks.openEntry')}</a>}
        {finding.rule !== undefined && <a className="wk-link-btn" href={viewPath('scriptorium', ctx.library.libraryId, finding.rule)}>{t('workUi.checks.openRule')}</a>}
      </p>
    </li>
  );
}
