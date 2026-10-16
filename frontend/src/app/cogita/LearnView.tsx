/**
 * NAUKA (0109) — `#/workspace/learn`: was jetzt dran ist, über alle
 * Bibliotheken; die Kurse, die man liest; Sitzungen, die gerade laufen; und
 * was das Gerät für die Zeit ohne Netz hält — dort lässt es sich auch ohne Netz
 * üben (die Antworten gehen später hinaus).
 */

import { useEffect, useMemo, useState } from 'react';

import { loadLibraries, openLibraries, type OpenLibrary } from '../library';
import { useMe, type Me } from '../me';
import { viewPath } from '../routes';
import type { Who } from '../session';
import { holderOfMe } from './holders';
import { Learner, loadDue, targetOf, type DueRow } from './learn';
import { loadSessions, SESSION_KIND_LABEL, type SessionRow } from './live';
import { offlineList, openOffline, type OfflineRevision } from './offline';
import { readPlan } from './revision';
import { RevisionRun } from './RevisionRun';
import './cogita.css';

export function LearnView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  if (me === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null) return <OfflineOnly trail={trail} />;
  return <LearnHome me={me} trail={trail} />;
}

/** Ohne offenen Schlüsselbund (kein Netz, kein Passwort in dieser Karte): nur, was das Gerät hält. */
function OfflineOnly({ trail }: { trail: readonly string[] }) {
  return (
    <div className="cg">
      <p className="wk-note">Klucze nie są otwarte w tej karcie. Bez nich można powtarzać tylko to, co urządzenie trzyma bez internetu.</p>
      <OfflinePart me={null} trail={trail} />
    </div>
  );
}

function LearnHome({ me, trail }: { me: Me; trail: readonly string[] }) {
  const [due, setDue] = useState<readonly DueRow[] | null>(null);
  const [libraries, setLibraries] = useState<readonly OpenLibrary[] | null>(null);
  const [sessions, setSessions] = useState<readonly SessionRow[]>([]);
  useEffect(() => {
    void loadDue().then((r) => setDue(r.due), () => setDue([]));
    void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then(setLibraries, () => setLibraries([]));
    void loadSessions().then((r) => setSessions(r.sessions.filter((s) => s.state === 'lobby' || s.state === 'running')), () => undefined);
  }, [me]);
  if (trail[0] === 'bez-sieci') return <OfflinePart me={me} trail={trail.slice(1)} />;
  const names = new Map((libraries ?? []).map((l) => [l.libraryId, l.name]));
  const now = Date.now();
  return (
    <div className="cg">
      <h1 className="wk-h1">Nauka</h1>
      <section className="cg-card">
        <h3>Na teraz</h3>
        {due === null ? <span className="wk-hint">Sprawdzanie…</span>
          : due.filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() <= now && d.dueCount > 0).length === 0 ? <span className="wk-now-calm">Nic nie czeka — wszystko powtórzone.</span>
          : (
            <ul>
              {due.filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() <= now && d.dueCount > 0).map((d) => (
                <li key={`${d.libraryId}:${d.holderRoleId}`}><a href={viewPath('library', d.libraryId, 'cogita', 'nauka')}>{names.get(d.libraryId) ?? 'Biblioteka'}</a> — {d.dueCount} kart</li>
              ))}
            </ul>
          )}
        {due !== null && due.some((d) => d.dueAt !== null && new Date(d.dueAt).getTime() > now) && (
          <span className="cg-muted">Następne: {due.filter((d) => d.dueAt !== null && new Date(d.dueAt).getTime() > now).map((d) => `${names.get(d.libraryId) ?? 'Biblioteka'} ${new Date(d.dueAt!).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}`).slice(0, 3).join(' · ')}</span>
        )}
      </section>
      {sessions.length > 0 && (
        <section className="cg-card">
          <h3>Sesje teraz</h3>
          <ul>{sessions.map((s) => <li key={s.sessionId}><a href={s.libraryId === null ? '#' : viewPath('library', s.libraryId, 'cogita', 'sesje', s.sessionId)}>{SESSION_KIND_LABEL[s.kind]}</a>{s.joinCode !== null ? ` · kod ${s.joinCode}` : ''}{s.host ? ' · prowadzisz' : ''}</li>)}</ul>
        </section>
      )}
      <section className="cg-card">
        <h3>Twoje biblioteki i kursy</h3>
        {libraries === null ? <span className="wk-hint">Wczytywanie…</span> : libraries.length === 0 ? <span className="wk-hint">Nie masz jeszcze biblioteki — <a href={viewPath('library')}>załóż ją</a> albo dołącz do kursu przez link.</span> : (
          <ul className="lib-list">
            {libraries.map((l) => (
              <li key={l.libraryId}><a className="lib-row" href={viewPath('library', l.libraryId, 'cogita', 'nauka')}><span className="lib-row-title">{l.name}</span><span className="lib-row-meta">{l.entries} wpisów{l.writes ? '' : ' · uczysz się'}</span></a></li>
            ))}
          </ul>
        )}
      </section>
      <a className="wk-link-btn" href={viewPath('learn', 'bez-sieci')}>Bez internetu na tym urządzeniu</a>
    </div>
  );
}

/** Was das Gerät hält — und ein Lauf daraus, ohne Netz. */
function OfflinePart({ me, trail }: { me: Me | null; trail: readonly string[] }) {
  const [list, setList] = useState<readonly { libraryId: string; revisionId: string; savedAt: number }[] | null>(null);
  const [open, setOpen] = useState<OfflineRevision | null | undefined>(undefined);
  const [learner, setLearner] = useState<Learner | null>(null);
  useEffect(() => { void offlineList().then(setList); }, []);
  const chosen = trail[0];
  useEffect(() => {
    if (chosen === undefined) { setOpen(undefined); return; }
    const [libraryId, revisionId] = chosen.split(':');
    void openOffline(libraryId, revisionId).then(async (copy) => {
      setOpen(copy);
      if (copy !== null && me !== null) {
        const target = copy.target === null ? null : await targetOf(copy.target.areaId).catch(() => ({ areaId: copy.target!.areaId, intake: null }));
        const made = new Learner(copy.libraryId, holderOfMe(me), target);
        await made.load().catch(() => undefined);
        setLearner(made);
      }
    });
  }, [chosen, me]);
  const source = useMemo(() => (open == null ? null : { plan: readPlan(open.cards, null, open.plan), cards: open.cards, deps: open.deps, title: open.name }), [open]);
  if (chosen !== undefined) {
    if (open === undefined) return <p className="wk-hint">Otwieranie…</p>;
    if (open === null || source === null) return <p className="wk-error">Tej powtórki nie ma na tym urządzeniu.</p>;
    return <RevisionRun lib={null} learner={learner} source={source} onClose={() => { window.location.hash = viewPath('learn', 'bez-sieci'); }} />;
  }
  return (
    <section className="cg-card">
      <h3>Na tym urządzeniu bez internetu</h3>
      {list === null ? <span className="wk-hint">Sprawdzanie…</span> : list.length === 0 ? <span className="wk-hint">Nic. Autor może oznaczyć powtórkę „Trzymaj na urządzeniach bez internetu" — wtedy po pierwszym przejściu zostanie tutaj (tylko gdy klucz jest zapamiętany na tym urządzeniu).</span> : (
        <ul>{list.map((o) => <li key={`${o.libraryId}:${o.revisionId}`}><a href={viewPath('learn', 'bez-sieci', `${o.libraryId}:${o.revisionId}`)}>Powtórka z {new Date(o.savedAt).toLocaleDateString('pl-PL')}</a></li>)}</ul>
      )}
    </section>
  );
}
