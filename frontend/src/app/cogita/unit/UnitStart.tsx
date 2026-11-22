/**
 * 2026-11-22 (Homer) — EINE EINHEIT MIT DER KLASSE BEGINNEN (`…/klasy/<klasse>/jednostki`): die Einheiten der Baza (Dokumente
 * `unit`, aus dem Kurs-JSON `units`) und die Klassensitzungen dieser Klasse, die aus ihnen entstanden — eine laufende oder
 * pausierte öffnet der Lehrer wieder (dieselbe Sitzung, derselbe Code über alle Stunden).
 */

import { useEffect, useState } from 'react';

import { fmtDate, useT } from '../../core/i18n';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import { useLeadAreas } from '../lesson/MapClassTools';
import { loadEvents, loadSessions, type SessionRow } from '../live';
import { plains } from '../sessionEvents';
import { useBusy, useCtx } from '../ui';
import { readUnit } from './unitModel';
import { createUnitSession } from './unitSession';
import './unit.css';

interface Running { readonly session: SessionRow; readonly unitId: string }

export function UnitStart({ classAreaId }: { classAreaId: string }) {
  const t = useT();
  const { lib, me, href } = useCtx();
  const areas = useLeadAreas(lib, me);
  const area = areas?.find((a) => a.areaId.toLowerCase() === classAreaId.toLowerCase()) ?? null;
  const [running, setRunning] = useState<readonly Running[] | null>(null);
  const { busy, failed, run } = useBusy();
  useEffect(() => {
    if (area === null) return undefined;
    let alive = true;
    void (async () => {
      const { sessions } = await loadSessions(area.areaId, lib.libraryId);
      const out: Running[] = [];
      for (const s of sessions.filter((x) => x.kind === 'lesson' && x.joinCode !== null && x.state !== 'closed').slice(0, 30)) {
        try {
          const { events } = await loadEvents(s.sessionId, 0);
          const meta = plains<{ unit?: string }>(events, 'meta').pop();
          if (typeof meta?.unit === 'string') out.push({ session: s, unitId: meta.unit });
        } catch { /* eine Sitzung, die sich nicht lesen lässt */ }
      }
      if (alive) setRunning(out);
    })().catch(() => { if (alive) setRunning([]); });
    return () => { alive = false; };
  }, [lib, area?.areaId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me === null) return <p className="wk-lede">{t('cogitaClass.tab.needAccount')}</p>;
  if (areas === null) return <Loading label={t('cogitaUnit.start.loading')} />;
  if (area === null) return <p className="wk-error" data-unit-not-lead="">{t('cogitaLesson.plan.notLead')}</p>;
  const units = lib.docs('unit').map((d) => readUnit(d.id, d.data));
  const start = (unitId: string, name: string) => run(async () => {
    const id = await createUnitSession(lib, me, { areaId: area.areaId, unitId, title: name });
    window.location.hash = href('sesje', id).replace(/^#/, '');
  });
  return (
    <div className="cg cg-unit-start" data-unit-start={area.areaId}>
      <a className="wk-link-btn" href={href('klasy')}>‹ {t('cogitaLesson.plan.toClasses')}</a>
      <h2 className="wk-h2">{t('cogitaUnit.start.title', { name: area.name })}</h2>
      <p className="wk-lede">{t('cogitaUnit.start.lede')}</p>
      {units.length === 0 ? <p className="wk-box-empty" data-unit-none="">{t('cogitaUnit.start.none')}</p> : (
        <ul className="cg-unit-list">
          {units.map((u) => {
            const mine = (running ?? []).filter((r) => r.unitId === u.id);
            return (
              <li key={u.id} className="wk-box" data-unit-doc={u.id}>
                <p><strong>{u.name || '—'}</strong> <span className="cg-muted">{t('cogitaUnit.start.shape', { lessons: u.lessons.length, stages: u.stages.length })}</span></p>
                <ol className="cg-muted">{u.lessons.map((l, i) => <li key={i}>{l.title || t('cogitaUnit.start.lesson', { n: i + 1 })}</li>)}</ol>
                {mine.map((r) => (
                  <p key={r.session.sessionId}>
                    <a className="wk-btn wk-btn-line" href={href('sesje', r.session.sessionId)} data-unit-session={r.session.sessionId}><Icon name="next" />
                      {t(`cogitaUnit.start.state.${r.session.state}`)} · {fmtDate(Date.parse(r.session.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })}</a>
                  </p>
                ))}
                <button type="button" className="wk-btn" disabled={busy} onClick={() => void start(u.id, u.name || t('cogitaUnit.start.untitled'))} data-unit-begin={u.id}><Icon name="plus" />{t('cogitaUnit.start.begin')}</button>
              </li>
            );
          })}
        </ul>
      )}
      {running === null && <Loading lines={1} label={t('cogitaUnit.start.loading')} />}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
