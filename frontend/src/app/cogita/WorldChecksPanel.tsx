/**
 * 2026-11-22 (Eigentümer, „Gute Welten", I2) — DIE KONTROLLE DER WELT für die, die sie bauen (Wiedza → „Do zrobienia"): dieselbe
 * Liste, die ein KI-Assistent über MCP bekommt (`get_world_checks`), aus `worldChecks.ts` — Gewicht, Code, was nicht stimmt, was
 * es behebt, und der Eintrag zum Öffnen. Nichts wird blockiert.
 */

import { useState } from 'react';

import { useT } from '../core/i18n';
import { Loading } from '../ui/Loading';
import { useAsyncKeep, useCtx } from './ui';
import { worldChecks, type CheckWeight, type WorldCheckReport, type WorldFinding } from './worldChecks';

/** So viele Befunde je Code stehen offen da (die übrigen gezählt). */
const SHOWN = 40;

export function WorldChecksPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { lib } = useCtx();
  const [failed, setFailed] = useState<string | null>(null);
  const [report] = useAsyncKeep<WorldCheckReport | null>(async () => {
    try {
      const { cards } = await lib.cards();
      setFailed(null);
      return worldChecks(lib, { cards });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [lib, lib.revision]);

  return (
    <section className="cg-card cg-worldcheck" data-world-checks={report === undefined || report === null ? '' : report.findings.length}>
      <h3>{t('worldChecks.panel.title')}</h3>
      <p className="cg-muted">{t('worldChecks.panel.lede')}</p>
      {failed !== null ? <p className="wk-error">{t('worldChecks.panel.failed', { error: failed })}</p>
        : report === undefined || report === null ? <Loading label={t('worldChecks.panel.counting')} lines={2} />
        : report.findings.length === 0 ? <p className="cg-muted" data-world-checks-none="">{t('worldChecks.panel.none')}</p>
        : <Findings report={report} onOpen={onOpen} />}
    </section>
  );
}

function Findings({ report, onOpen }: { report: WorldCheckReport; onOpen: (id: string) => void }) {
  const t = useT();
  const { lib } = useCtx();
  const groups = report.codes.map((c) => ({ ...c, list: report.findings.filter((f) => f.code === c.code && f.weight === c.weight) }));
  return (
    <>
      <p className="cg-worldcheck-counts" data-world-checks-must={report.counts.must}>
        {t('worldChecks.panel.counts', report.counts)} · {t('worldChecks.panel.size', report.size)}
      </p>
      {groups.map((g) => (
        <details key={`${g.weight}:${g.code}`} className="cg-worldcheck-group" open={g.weight === 'must'} data-world-check-code={g.code}>
          <summary>
            <Weight weight={g.weight} /> <code>{g.code}</code> — {g.count}
          </summary>
          <ul>
            {g.list.slice(0, SHOWN).map((f, i) => <FindingRow key={i} f={f} open={(id) => (lib.entity(id) !== undefined ? () => onOpen(id) : null)} />)}
            {g.list.length > SHOWN && <li className="cg-muted">{t('worldChecks.panel.more', { count: g.list.length - SHOWN })}</li>}
          </ul>
        </details>
      ))}
    </>
  );
}

function Weight({ weight }: { weight: CheckWeight }) {
  const t = useT();
  return <span className={`cg-worldcheck-weight is-${weight}`}>{t(`worldChecks.panel.weight.${weight}`)}</span>;
}

function FindingRow({ f, open }: { f: WorldFinding; open: (id: string) => (() => void) | null }) {
  const t = useT();
  const go = f.entity === undefined ? null : open(f.entity.id);
  return (
    <li className="cg-worldcheck-row">
      <span>{f.message}</span>
      {go !== null && <> <button type="button" className="cg-ref" onClick={go}>{t('worldChecks.panel.open')}</button></>}
      <span className="cg-muted cg-worldcheck-fix">{t('worldChecks.panel.fix')} {f.fix}</span>
    </li>
  );
}
