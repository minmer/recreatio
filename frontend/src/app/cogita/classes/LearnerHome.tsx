/**
 * 2026-11-22 — DIE STARTSEITE DER KLEINEN WERKSTATT (`shell/LearnerShell.tsx`): was ein Schüler braucht, in der Reihenfolge,
 * in der er es braucht — eine Lekcja, die gerade läuft (ganz oben, ein Tipp), seine Klassen (je eine Karte: „Ucz się"), was
 * zu wiederholen ist, Zadania mit Frist. Sonst nichts; der Weg zur ganzen Werkstatt steht im Menü.
 */

import { useEffect, useState } from 'react';

import { fmtDate, useT } from '../../core/i18n';
import type { Who } from '../../core/session';
import { viewPath } from '../../routes';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import { loadDue, type DueRow } from '../learn';
import { loadSessions, type SessionRow } from '../live';
import { classAim, type ClassOf } from './classModel';
import { myClasses } from './classes';
import './classes.css';

interface Home {
  readonly classes: readonly ClassOf[];
  readonly leads: readonly ClassOf[];
  readonly due: readonly DueRow[];
  readonly live: readonly SessionRow[];
  readonly tasks: readonly SessionRow[];
}

const inClass = (list: readonly ClassOf[], areaId: string) => list.find((c) => c.areaId.toLowerCase() === areaId.toLowerCase());

export function LearnerHome({ who }: { who: Who }) {
  const t = useT();
  const [home, setHome] = useState<Home | null>(null);
  useEffect(() => {
    let alive = true;
    const look = async () => {
      const [classes, leads, due, sessions] = await Promise.all([
        myClasses(false).catch(() => [] as ClassOf[]),
        myClasses(true).catch(() => [] as ClassOf[]),
        loadDue().then((r) => r.due, () => [] as readonly DueRow[]),
        loadSessions().then((r) => r.sessions, () => [] as readonly SessionRow[])
      ]);
      const mine = sessions.filter((s) => inClass(classes, s.areaId) !== undefined);
      if (alive) {
        setHome({
          classes, leads, due,
          live: mine.filter((s) => s.kind === 'lesson' && (s.state === 'running' || s.state === 'lobby')),
          tasks: mine.filter((s) => s.kind === 'task' && s.state !== 'closed' && s.state !== 'finished')
        });
      }
    };
    void look();
    /* Eine Lekcja, die beginnt, erscheint von selbst. */
    const timer = window.setInterval(() => { void look(); }, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [who.accountId]);

  if (home === null) return <Loading label={t('cogitaClass.home.loading')} />;
  const now = Date.now();
  const dueOf = (libraryId: string) => home.due.filter((d) => d.libraryId.toLowerCase() === libraryId.toLowerCase() && d.dueAt !== null && Date.parse(d.dueAt) <= now)
    .reduce((n, d) => n + d.dueCount, 0);
  const pageOf = (klass: ClassOf) => `#/${classAim(klass.areaId, klass.bases[0]!.libraryId)}`;

  return (
    <div className="cl-home wk-narrow" data-learner-home="">
      <h1 className="wk-h1">{t('cogitaClass.home.title')}</h1>

      {home.live.map((s) => {
        const klass = inClass(home.classes, s.areaId)!;
        return (
          <a key={s.sessionId} className="cl-live" href={s.libraryId === null ? pageOf(klass) : viewPath('learn', s.libraryId, 'sesje', s.sessionId)} data-home-live={s.sessionId}>
            <span className="cl-live-dot" aria-hidden="true" />
            <strong>{t('cogitaClass.home.liveIn', { name: klass.name })}</strong>
            <span>{t('cogitaClass.page.liveJoin')}</span>
          </a>
        );
      })}

      <section className="wk-box" aria-labelledby="home-classes">
        <div className="wk-box-head"><h2 className="wk-box-title" id="home-classes">{t('cogitaClass.home.classes')}</h2></div>
        {home.classes.length === 0
          ? <p className="wk-box-empty" data-home-empty="">{t('cogitaClass.home.none')}</p>
          : home.classes.map((klass) => {
            const due = klass.bases.reduce((n, b) => n + dueOf(b.libraryId), 0);
            return (
              <a key={klass.areaId} className="cl-home-class" href={pageOf(klass)} data-home-class={klass.areaId}>
                <span className="cl-card-ic" aria-hidden="true"><Icon name="cap" /></span>
                <span className="cl-card-text">
                  <strong>{klass.name}</strong>
                  <span>{klass.bases.map((b) => b.name).filter((n) => n !== '').join(' · ')}</span>
                </span>
                {due > 0 && <span className="cl-due" title={t('cogitaClass.home.dueTitle')}>{t('cogitaClass.home.due', { count: due })}</span>}
                <span className="wk-btn cl-go">{t('cogitaClass.home.learn')}<Icon name="next" /></span>
              </a>
            );
          })}
      </section>

      {home.tasks.length > 0 && (
        <section className="wk-box" aria-labelledby="home-tasks">
          <div className="wk-box-head"><h2 className="wk-box-title" id="home-tasks">{t('cogitaClass.home.tasks')}</h2></div>
          {home.tasks.map((s) => {
            const klass = inClass(home.classes, s.areaId)!;
            const late = s.endsAt !== null && Date.parse(s.endsAt) < now;
            return (
              <a key={s.sessionId} className="wk-line" href={pageOf(klass)} data-home-task={s.sessionId}>
                <span className={late ? 'wk-line-ic is-warn' : 'wk-line-ic'}><Icon name="task" /></span>
                <span className="wk-line-text">
                  <span className="wk-line-title">{t('cogitaClass.home.taskIn', { name: klass.name })}</span>
                  <span className="wk-line-sub">{s.endsAt === null ? t('cogitaClass.home.noDeadline') : t(late ? 'cogitaClass.home.wasDue' : 'cogitaClass.home.dueBy', { date: fmtDate(Date.parse(s.endsAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</span>
                </span>
                <span className="wk-line-end"><Icon name="next" /></span>
              </a>
            );
          })}
        </section>
      )}

      {home.leads.length > 0 && (
        <section className="wk-box" aria-labelledby="home-leads">
          <div className="wk-box-head"><h2 className="wk-box-title" id="home-leads">{t('cogitaClass.home.youLead')}</h2></div>
          {home.leads.map((klass) => (
            <a key={klass.areaId} className="wk-line" href={viewPath('learn', klass.bases[0]!.libraryId, 'klasy')}>
              <span className="wk-line-ic"><Icon name="users" /></span>
              <span className="wk-line-text"><span className="wk-line-title">{klass.name}</span></span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
        </section>
      )}

      <p className="cl-note">{t('cogitaClass.home.another')}</p>
    </div>
  );
}
