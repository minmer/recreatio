/**
 * DER TEIL „NAUKA" EINES WIDOKS (0094, 0109): was jetzt dran ist — und im
 * erweiterten Weg die Bazy wiedzy und laufenden Sitzungen.
 */

import { useEffect, useState } from 'react';

import { libraryKindOf, loadLibraries, openLibraries, type OpenLibrary } from '../library/library';
import { useMe } from '../core/me';
import { viewPath } from '../routes';
import type { Who } from '../core/session';
import { loadDue, type DueRow } from './learn';
import { loadSessions, SESSION_KIND_LABEL, type SessionRow } from './live';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';

export function LearnPart({ mode, who }: { readonly mode: string; readonly who: Who }) {
  const me = useMe(who);
  const t = useT();
  const [due, setDue] = useState<readonly DueRow[] | null>(null);
  const [libraries, setLibraries] = useState<readonly OpenLibrary[]>([]);
  const [sessions, setSessions] = useState<readonly SessionRow[]>([]);
  useEffect(() => {
    void loadDue().then((r) => setDue(r.due), () => setDue([]));
    if (me != null) void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then((all) => setLibraries(all.filter((l) => libraryKindOf(l) === 'knowledge')), () => undefined);
    if (mode === 'all') void loadSessions().then((r) => setSessions(r.sessions.filter((s) => s.state === 'lobby' || s.state === 'running')), () => undefined);
  }, [me, mode]);
  if (due === null) return <Loading label={t('cogitaLearnRun.part.checking')} />;
  const now = Date.now();
  const names = new Map(libraries.map((l) => [l.libraryId, l.name]));
  const waiting = due.filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() <= now && d.dueCount > 0);
  return (
    <div className="wk-recent-block">
      {waiting.length === 0 ? <p className="wk-now-calm">{t('cogitaLearnRun.part.nothing')}</p> : (
        <ul className="wk-now-list">
          {waiting.map((d) => <li key={`${d.libraryId}:${d.holderRoleId}`}><a href={viewPath('learn', d.libraryId, 'nauka')}>{names.get(d.libraryId) ?? t('cogitaLearnRun.learnView.base')}</a>{t('cogitaLearnRun.part.cards', { count: d.dueCount })}</li>)}
        </ul>
      )}
      {mode === 'all' && libraries.length > 0 && (
        <ul className="wk-now-list">{libraries.map((l) => <li key={l.libraryId}><a href={viewPath('learn', l.libraryId, 'nauka')}>{l.name}</a></li>)}</ul>
      )}
      {mode === 'all' && sessions.length > 0 && (
        <ul className="wk-now-list">{sessions.map((s) => <li key={s.sessionId}>{SESSION_KIND_LABEL[s.kind]}{s.joinCode !== null ? ` · ${t('cogitaLearnRun.learnView.code', { code: s.joinCode })}` : ''}{s.libraryId !== null && <> · <a href={viewPath('learn', s.libraryId, 'sesje', s.sessionId)}>{t('cogitaLearnRun.part.open')}</a></>}</li>)}</ul>
      )}
      <p className="wk-part-foot"><a className="wk-link-btn" href={viewPath('learn')}>{t('cogitaLearnRun.learnView.learning')}</a></p>
    </div>
  );
}
