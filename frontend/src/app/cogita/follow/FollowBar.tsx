/**
 * 2026-11-24 (Tryb prowadzony) — DIE LEISTE DER LEHRERIN, solange sie die Klasse führt: „Na żywo · klasa · N uczniów", das Bild
 * anhalten oder wieder aufnehmen, „Pokaż uczniom" (der jetzige Stand gleich hinaus), die Leinwand, „Zakończ". Ist eine Frage
 * gezeigt: wie viele geantwortet haben, die Verteilung (nur für sie) und „Pokaż wyniki" (die Klasse sieht sie, ohne Namen).
 */

import { useEffect, useMemo, useState } from 'react';

import { useT } from '../../core/i18n';
import type { Me } from '../../core/me';
import { loadIntake, openIntakeKey } from '../../forms/intake';
import { viewPath } from '../../routes';
import { ask } from '../../ui/dialogs';
import { bodies, useEvents } from '../sessionEvents';
import { TallyBars, type LessonRevealEvent, type TallyLite } from '../lesson/LessonHost';
import { tallyQuestion, type Vote } from '../lesson/lessonTally';
import { clearFollowVote, deliverFollowKeys, followSend, setFollowFrozen, showNow, stopFollow, useFollowLive } from './followHost';
import './follow.css';

const NO_CRED = {};

export function FollowBar({ me }: { me: Me | null }) {
  const { live } = useFollowLive();
  return live === null ? null : <FollowBarIn key={live.sessionId} me={me} />;
}

function FollowBarIn({ me }: { me: Me | null }) {
  const t = useT();
  const { live, vote } = useFollowLive();
  const [intake, setIntake] = useState<Uint8Array | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (live === null || me === null) { setIntake(null); return undefined; }
    let alive = true;
    void loadIntake(live.areaId).then((i) => openIntakeKey(i, me.ring)).then((k) => { if (alive) setIntake(k); }, () => undefined);
    return () => { alive = false; };
  }, [live?.areaId, me]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Wer neu (ohne Konto) dazukommt, bekommt den Schlüssel — alle 30 s. */
  useEffect(() => {
    if (live === null) return undefined;
    void deliverFollowKeys();
    const id = window.setInterval(() => { void deliverFollowKeys(); }, 30_000);
    return () => window.clearInterval(id);
  }, [live?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { opened } = useEvents(live?.sessionId ?? 'none', NO_CRED, live?.keys ?? new Map(), intake);
  const joined = useMemo(() => new Set(bodies<{ participant: string }>(opened, 'join').map((j) => j.body.participant)).size, [opened]);
  const answers: Vote[] = useMemo(() => (vote === null ? [] : bodies<{ participant: string; index: number; given: unknown; at: number }>(opened, 'answer')
    .filter((a) => a.body.index === vote.index).map((a) => ({ participant: a.body.participant, given: a.body.given, at: a.body.at }))), [opened, vote]);
  const revealed = vote !== null && bodies<{ index: number }>(opened, 'reveal').some((r) => r.body.index === vote.index);
  if (live === null) return null;
  const tally = vote === null ? null : tallyQuestion(vote.card, answers, vote.data);
  const reveal = () => {
    if (vote === null || tally === null) return;
    const lite: TallyLite = { votes: tally.votes, correct: tally.correct, bars: tally.bars, tags: tally.tags };
    void followSend('reveal', { index: vote.index, card: vote.card, answered: tally.votes, correct: tally.correct, scores: [], teams: [], round: 1, tally: lite } satisfies LessonRevealEvent);
  };
  const end = () => {
    void ask({ title: t('cogitaFollow.bar.endAsk'), body: t('cogitaFollow.bar.endSays'), confirm: t('cogitaFollow.bar.end') }).then((yes) => { if (yes) { clearFollowVote(); void stopFollow(); } });
  };
  return (
    <div className={`cg-follow-bar${live.frozen ? ' is-frozen' : ''}`} role="region" aria-label={t('cogitaFollow.bar.label')} data-follow-bar={live.sessionId} data-follow-frozen={live.frozen ? '1' : '0'}>
      <span className="cg-follow-live"><span className="cg-follow-dot" aria-hidden="true" />{t('cogitaFollow.bar.live')}</span>
      <span className="cg-follow-class">{live.className}</span>
      <span className="cg-follow-n" data-follow-joined={joined}>{t('cogitaFollow.bar.joined', { count: joined })}</span>
      {live.frozen && <span className="cg-follow-frozen" role="status">{t('cogitaFollow.bar.frozenSays')}</span>}
      <span className="cg-follow-actions">
        <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => setFollowFrozen(!live.frozen)} data-follow-freeze={live.frozen ? 'on' : 'off'}>
          {live.frozen ? t('cogitaFollow.bar.resume') : t('cogitaFollow.bar.freeze')}
        </button>
        <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => { void showNow(); }} data-follow-show="">{t('cogitaFollow.bar.showNow')}</button>
        <a className="wk-btn wk-btn-line is-small" href={viewPath('learn', live.libraryId, 'sesje', live.sessionId, 'ekran')} target="_blank" rel="noreferrer" data-follow-screen="">{t('cogitaFollow.bar.screen')}</a>
        <button type="button" className="wk-btn is-small" onClick={end} data-follow-end="">{t('cogitaFollow.bar.end')}</button>
      </span>
      {vote !== null && tally !== null && (
        <div className="cg-follow-vote" data-follow-vote={vote.index} data-follow-votes={tally.votes}>
          <button type="button" className="wk-link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t('cogitaFollow.bar.votes', { count: tally.votes, total: joined })}</button>
          {!revealed && <button type="button" className="wk-btn is-small" disabled={vote.predict && tally.votes === 0} onClick={reveal} data-follow-reveal="">{t('cogitaFollow.bar.reveal')}</button>}
          {revealed && <span className="cg-muted" data-follow-revealed="">{t('cogitaFollow.bar.revealed')}</span>}
          {open && <div className="cg-follow-tally"><TallyBars bars={tally.bars} votes={tally.votes} form={vote.card.answer.form} reveal={revealed} tags={tally.tags} /></div>}
        </div>
      )}
    </div>
  );
}
