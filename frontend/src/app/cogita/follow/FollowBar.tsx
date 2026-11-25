/**
 * 2026-11-24 (Tryb prowadzony) — DIE LEISTE DER LEHRERIN, solange sie die Klasse führt: „Na żywo · klasa · N uczniów", das Bild
 * anhalten oder wieder aufnehmen, „Pokaż uczniom" (der jetzige Stand gleich hinaus), die Leinwand, „Zakończ". Ist eine Frage
 * gezeigt: wie viele geantwortet haben, die Verteilung (nur für sie) und „Pokaż wyniki" (die Klasse sieht sie, ohne Namen).
 *
 * 2026-11-25 (LiveRoom) — DER RAUM: die Leiste ruft jede Sekunde ab (zugleich der Herzschlag der Lehrerin — die Schüler sehen, ob sie
 * da ist). Gezählt wird, wer sich angemeldet hat ODER gerade da ist; „online" heisst: in den letzten 8 s abgerufen. Die Liste nennt
 * jeden mit Punkt. Bei einer Frage: die drei Schnellsten mit richtiger Antwort — nach der Uhr des Dienstes.
 */

import { useEffect, useMemo, useState } from 'react';

import { useT } from '../../core/i18n';
import type { Me } from '../../core/me';
import { loadIntake, openIntakeKey } from '../../forms/intake';
import { viewPath } from '../../routes';
import { ask } from '../../ui/dialogs';
import { bodies, useEvents } from '../sessionEvents';
import { TallyBars, type LessonRevealEvent, type TallyLite } from '../lesson/LessonHost';
import { fastestCorrect, tallyQuestion, type Vote } from '../lesson/lessonTally';
import { classAim } from '../classes/classModel';
import { clearFollowVote, deliverFollowKeys, followSend, setFollowFrozen, showNow, stopFollow, useFollowLive } from './followHost';
import './follow.css';

const ROOM = { room: true } as const;
const ONLINE_MS = 8000;

/** `onMap`: die Leiste liegt auf der geführten Karte; sonst (Konsole, Klassenseite) führt ein Knopf zu ihr. */
export function FollowBar({ me, onMap = false }: { me: Me | null; onMap?: boolean }) {
  const { live } = useFollowLive();
  return live === null ? null : <FollowBarIn key={live.sessionId} me={me} onMap={onMap} />;
}

function FollowBarIn({ me, onMap }: { me: Me | null; onMap: boolean }) {
  const t = useT();
  const { live, vote } = useFollowLive();
  const [intake, setIntake] = useState<Uint8Array | null>(null);
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(false);
  useEffect(() => {
    if (live === null || me === null) { setIntake(null); return undefined; }
    let alive = true;
    void loadIntake(live.areaId).then((i) => openIntakeKey(i, me.ring)).then((k) => { if (alive) setIntake(k); }, () => undefined);
    return () => { alive = false; };
  }, [live?.areaId, me]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Der Rückfall für Plätze ohne Schlüssel der Klasse: der verpackte Schlüssel — alle 5 s. */
  useEffect(() => {
    if (live === null) return undefined;
    void deliverFollowKeys();
    const id = window.setInterval(() => { void deliverFollowKeys(); }, 5000);
    return () => window.clearInterval(id);
  }, [live?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const cred = useMemo(() => ({ participant: `t-${(live?.hostRoleId ?? '').toLowerCase()}` }), [live?.hostRoleId]);
  const { opened, pulse } = useEvents(live?.sessionId ?? 'none', cred, live?.keys ?? new Map(), intake, ROOM);

  /* Wer da ist: angemeldet (mit Namen) und/oder eben abgerufen. */
  const roster = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; ago: number | null }>();
    for (const j of bodies<{ participant: string; name?: string }>(opened, 'join')) {
      const id = j.body.participant.toLowerCase();
      byId.set(id, { id, name: typeof j.body.name === 'string' && j.body.name !== '' ? j.body.name : id.slice(-4), ago: byId.get(id)?.ago ?? null });
    }
    const late = pulse === null ? 0 : Date.now() - pulse.at;
    for (const p of pulse?.pulse?.present ?? []) {
      const id = p.participant.toLowerCase();
      const had = byId.get(id);
      byId.set(id, { id, name: had?.name ?? id.slice(-4), ago: p.ago + late });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [opened, pulse]);
  const online = roster.filter((r) => r.ago !== null && r.ago <= ONLINE_MS).length;
  const nameOf = (id: string) => roster.find((r) => r.id === id.toLowerCase())?.name ?? id.slice(-4);

  /* Die Stimmen der offenen Frage — mit der Zeit des Dienstes (wann sie ankamen). */
  const answers: (Vote & { order: number })[] = useMemo(() => (vote === null ? [] : bodies<{ participant: string; index: number; given: unknown }>(opened, 'answer')
    .filter((a) => a.body.index === vote.index)
    .map((a) => ({ participant: a.body.participant, given: a.body.given, at: Date.parse(a.event.createdAt), order: a.event.seq }))), [opened, vote]);
  const openedAt = useMemo(() => {
    if (vote === null) return null;
    const q = bodies<{ index: number }>(opened, 'question').find((x) => x.body.index === vote.index);
    return q === undefined ? null : Date.parse(q.event.createdAt);
  }, [opened, vote]);
  const revealed = vote !== null && bodies<{ index: number }>(opened, 'reveal').some((r) => r.body.index === vote.index);
  if (live === null) return null;
  const tally = vote === null ? null : tallyQuestion(vote.card, answers, vote.data);
  const fastest = vote === null || openedAt === null ? [] : fastestCorrect(vote.card, answers, openedAt);
  const reveal = () => {
    if (vote === null || tally === null) return;
    const lite: TallyLite = { votes: tally.votes, correct: tally.correct, bars: tally.bars, tags: tally.tags };
    void followSend('reveal', { index: vote.index, card: vote.card, answered: tally.votes, correct: tally.correct, scores: [], teams: [], round: 1, tally: lite } satisfies LessonRevealEvent);
  };
  const end = () => {
    void ask({ title: t('cogitaFollow.bar.endAsk'), body: t('cogitaFollow.bar.endSays'), confirm: t('cogitaFollow.bar.end') }).then((yes) => { if (yes) { clearFollowVote(); void stopFollow(); } });
  };
  const down = pulse === null || Date.now() - pulse.at > 6000;
  return (
    <div className={`cg-follow-bar${live.frozen ? ' is-frozen' : ''}`} role="region" aria-label={t('cogitaFollow.bar.label')} data-follow-bar={live.sessionId} data-follow-frozen={live.frozen ? '1' : '0'}>
      <span className={`cg-follow-live${down ? ' is-down' : ''}`} data-follow-link={down ? 'down' : 'ok'}><span className="cg-follow-dot" aria-hidden="true" />{down ? t('cogitaFollow.bar.linkDown') : t('cogitaFollow.bar.live')}</span>
      <span className="cg-follow-class">{live.className}</span>
      <button type="button" className="wk-link-btn cg-follow-n" aria-expanded={people} onClick={() => setPeople((v) => !v)} data-follow-joined={roster.length} data-follow-online={online}>
        {t('cogitaFollow.bar.joined', { count: roster.length })} · {t('cogitaFollow.bar.online', { count: online })}
      </button>
      {live.frozen && <span className="cg-follow-frozen" role="status">{t('cogitaFollow.bar.frozenSays')}</span>}
      <span className="cg-follow-actions">
        {!onMap && <a className="wk-btn is-small" href={`#/${classAim(live.areaId, live.libraryId)}`} data-follow-map="">{t('cogitaFollow.bar.map')}</a>}
        <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => setFollowFrozen(!live.frozen)} data-follow-freeze={live.frozen ? 'on' : 'off'}>
          {live.frozen ? t('cogitaFollow.bar.resume') : t('cogitaFollow.bar.freeze')}
        </button>
        <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => { void showNow(); }} data-follow-show="">{t('cogitaFollow.bar.showNow')}</button>
        <a className="wk-btn wk-btn-line is-small" href={viewPath('learn', live.libraryId, 'sesje', live.sessionId, 'ekran')} target="_blank" rel="noreferrer" data-follow-projector="">{t('cogitaFollow.bar.screen')}</a>
        <button type="button" className="wk-btn is-small" onClick={end} data-follow-end="">{t('cogitaFollow.bar.end')}</button>
      </span>
      {people && (
        <ul className="cg-follow-people" data-follow-people="">
          {roster.length === 0 && <li className="cg-muted">{t('cogitaFollow.bar.nobody')}</li>}
          {roster.map((r) => {
            const on = r.ago !== null && r.ago <= ONLINE_MS;
            return (
              <li key={r.id} className={on ? 'is-on' : 'is-off'} data-follow-person={r.id} data-follow-person-on={on ? '1' : '0'}>
                <span className="cg-follow-dot" aria-hidden="true" />{r.name}
                <span className="cg-muted"> · {on ? t('cogitaFollow.bar.personOn') : r.ago === null ? t('cogitaFollow.bar.personJoined') : t('cogitaFollow.bar.personAway', { s: Math.round(r.ago / 1000) })}</span>
              </li>
            );
          })}
        </ul>
      )}
      {vote !== null && tally !== null && (
        <div className="cg-follow-vote" data-follow-vote={vote.index} data-follow-votes={tally.votes}>
          <button type="button" className="wk-link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t('cogitaFollow.bar.votes', { count: tally.votes, total: roster.length })}</button>
          {!revealed && <button type="button" className="wk-btn is-small" disabled={vote.predict && tally.votes === 0} onClick={reveal} data-follow-reveal="">{t('cogitaFollow.bar.reveal')}</button>}
          {revealed && <span className="cg-muted" data-follow-revealed="">{t('cogitaFollow.bar.revealed')}</span>}
          {fastest.length > 0 && (
            <span className="cg-follow-fast" data-follow-fastest={fastest.map((f) => f.participant.toLowerCase()).join(',')}>
              {t('cogitaFollow.bar.fastest')} {fastest.map((f, i) => `${i + 1}. ${nameOf(f.participant)} ${(f.ms / 1000).toFixed(1)} s`).join(' · ')}
            </span>
          )}
          {open && <div className="cg-follow-tally"><TallyBars bars={tally.bars} votes={tally.votes} form={vote.card.answer.form} reveal={revealed} tags={tally.tags} /></div>}
        </div>
      )}
    </div>
  );
}
