/**
 * 2026-11-22 (Part B, class) — DIE STUNDE: eine Erzählung, die die Klasse zusammen geht.
 *
 * Der Leiter spielt sie mit dem Spieler eines Lernenden (`FlowPlayer`, ohne eigenen Fortschritt: seine Antworten zählen
 * nicht für ihn). Jeder Schritt geht versiegelt an die Klasse (`step`); eine Frage, eine Wahl (Gabelung) und Kapitel
 * (welches Thema zuerst) öffnen eine Abstimmung (`question` / `poll`), jede und jeder stimmt einzeln (`answer`, versiegelt
 * für die Przyjęcia des Bereichs — nur der Leiter öffnet sie). Der Leiter sieht die Verteilung sofort, mit den benannten
 * Fehlern (`tags` der Frage) und einem Hinweis (≥ 70 % weiter, 30–70 % Nachbarn und zweite Runde, < 30 % zurück zur Folie
 * — einstellbar). Schliessen deckt auf (`reveal` / `pollend`); die Antwort der Klasse führt die Erzählung weiter, wie die
 * eines Lernenden (sie wählt `wrong:<tag>`, sie steht im Lauf für „session"/„lastAnswer").
 *
 * Die Leinwand (`LessonScreen`, „…/ekran") folgt den Ereignissen: Folie, Frage, wie viele gestimmt haben, die Verteilung —
 * nie Namen. Wer die Verteilung sieht, stellt der Leiter ein (nur er · die Klasse nach dem Schliessen · live).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '../../core/i18n';
import { TexText } from '../../ui/tex/Tex';
import { Loading } from '../../ui/Loading';
import { AnswerInput, answerText, givenText, Verdict } from '../CardFace';
import { checkCard } from '../cards';
import { inScreenOrder, type Card } from '../cardBasics';
import { contentOfLibrary, EntityView, FlowPlayer } from '../FlowPlayer';
import { setSessionState, stripCard, type SessionRow } from '../live';
import type { PublicEntity } from '../publish';
import { bodies, lastOf, type Opened } from '../sessionEvents';
import { useAsync, useBusy, useCtx } from '../ui';
import type { LessonDecision, LessonLink, LessonOption, LessonStep } from './lessonStep';
import {
  adviceOf, isFlowPart, readLessonConfig, tallyPoll, tallyQuestion, type Bar, type LessonConfig, type LessonPart, type LessonQuestionsPart, type ShowVotes, type Thresholds, type Vote
} from './lessonTally';
import { LinesHeat, linesHeat } from '../reading/linesHeat';
import './lesson.css';

/** 2026-11-22 (Homer-Einheit) — eine Lektüre-Frage, deren Antworten sich als Wärmekarte je Zeile zeigen lassen. */
const heatForm = (card: Card): boolean => card.answer.form === 'lines' || card.answer.form === 'span';

/* -- Die Ereignisse einer Stunde (dieselben Arten wie im Quiz, wo es geht: `question`, `answer`, `reveal`) --------------- */

export interface LessonQuestionEvent {
  readonly index: number;
  readonly total: number;
  readonly card: Card;
  readonly startedAt: number;
  readonly deadline: null;
  readonly round: number;
  readonly step: string;
  readonly lesson: true;
  /** 2026-11-22 (I3) — eine Vorhersage: abgestimmt und verteilt, aber für niemanden im Fortschritt. */
  readonly predict?: true;
}

export interface LessonPollEvent {
  readonly index: number;
  readonly round: number;
  readonly step: string;
  readonly kind: 'choice' | 'chapters';
  readonly title: string | null;
  readonly options: readonly LessonOption[];
}

export interface LessonStepEvent {
  readonly at: number;
  readonly flow: string;
  readonly step: string;
  readonly kind: LessonStep['kind'];
  readonly title: string | null;
  readonly entity: PublicEntity | null;
}

/** Was die Klasse von einer Verteilung sieht: die Balken ohne Namen. */
export interface TallyLite {
  readonly votes: number;
  readonly correct: number;
  readonly bars: readonly Bar[];
  readonly tags: readonly { readonly tag: string; readonly count: number }[];
  /** 2026-11-22 (Homer-Einheit) — Lektüre (lines, span): wie oft jede Zeile gewählt wurde (Index 0 = Zeile 1), nie wer. */
  readonly heat?: readonly number[];
}

export interface LessonRevealEvent {
  readonly index: number;
  readonly card: Card;
  readonly answered: number;
  readonly correct: number;
  readonly scores: readonly never[];
  readonly teams: readonly never[];
  readonly round: number;
  readonly tally?: TallyLite;
}

export interface PollEndEvent {
  readonly index: number;
  readonly winner: number | null;
  readonly order: readonly number[];
  readonly counts?: readonly number[];
  readonly votes: number;
}

export interface TallyEvent {
  readonly index: number;
  readonly votes: number;
  readonly counts: readonly number[];
  /** 2026-11-22 (Homer-Einheit) — Lektüre: die Wärmekarte je Zeile, live. */
  readonly heat?: readonly number[];
}

interface AnswerEvent { readonly participant: string; readonly index: number; readonly given: unknown; readonly at: number }

export type Send = (kind: string, body: unknown, plain?: { readonly kind: string; readonly body: unknown }) => Promise<void>;

/** Eine Folie geht nur mit, solange sie klein ist (ein Ereignis trägt höchstens 64 KB). */
const smallEntity = (e: PublicEntity | null): PublicEntity | null => {
  if (e === null) return null;
  try { return JSON.stringify(e).length <= 40_000 ? e : null; } catch { return null; }
};

const THRESHOLDS = 'recreatio:cogita:lesson-thresholds';
const keptThresholds = (fallback: Thresholds): Thresholds => {
  try { const v = JSON.parse(localStorage.getItem(THRESHOLDS) ?? 'null') as Thresholds | null; return v !== null && typeof v.high === 'number' && typeof v.low === 'number' ? v : fallback; } catch { return fallback; }
};

/* -- Die Balken (Leiter, Leinwand, Klasse): je Möglichkeit wie viele, richtig markiert, ohne Namen ------------------ */

export function TallyBars({ bars, votes, form, reveal, tags }: {
  bars: readonly Bar[];
  votes: number;
  form?: string;
  /** Die richtige Möglichkeit zeigen (nach dem Schliessen). */
  reveal: boolean;
  tags?: readonly { readonly tag: string; readonly count: number }[];
}) {
  const t = useT();
  const labelOf = (b: Bar, i: number): string => {
    if (b.key === 'rest') return t('cogitaLesson.bars.rest');
    if (form === 'truefalse') return b.key === 'true' ? t('cogitaViewsStats.sess.true') : t('cogitaViewsStats.sess.false');
    return b.label === '' ? String.fromCharCode(65 + i) : b.label;
  };
  return (
    <div className="cg-lesson-bars" data-lesson-bars={bars.length} data-lesson-votes={votes}>
      <ul>
        {bars.map((b, i) => {
          const pct = votes === 0 ? 0 : Math.round((b.count / votes) * 100);
          return (
            <li key={b.key} className={reveal ? (b.correct ? 'is-right' : 'is-wrong') : ''} data-lesson-bar={b.key} data-lesson-label={b.label} data-lesson-count={b.count}>
              <span className="cg-lesson-bar-label"><span className="cg-lesson-letter">{String.fromCharCode(65 + i)}</span> <TexText text={labelOf(b, i)} />{reveal && b.correct && <span className="cg-lesson-ok"> ✓</span>}</span>
              <svg className="cg-lesson-bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width={pct} height="8" rx="1" /></svg>
              <span className="cg-lesson-bar-n">{t('cogitaLesson.bars.count', { count: b.count, pct })}</span>
              {reveal && b.tag !== undefined && <span className="cg-lesson-tag" data-lesson-tag={b.tag}>{t('cogitaLesson.bars.error', { tag: b.tag })}</span>}
            </li>
          );
        })}
      </ul>
      {tags !== undefined && tags.length > 0 && (
        <p className="cg-muted" data-lesson-tags="">{t('cogitaLesson.bars.errors', { list: tags.map((x) => t('cogitaLesson.bars.errorN', { tag: x.tag, count: x.count })).join(' · ') })}</p>
      )}
    </div>
  );
}

/** Die Balken einer Abstimmung über Wege oder Themen. */
export function PollBars({ options, counts, votes, winner }: { options: readonly LessonOption[]; counts: readonly number[]; votes: number; winner: number | null }) {
  const bars: Bar[] = options.map((o, i) => ({ key: o.exit, label: o.label, count: counts[i] ?? 0, correct: winner === i }));
  return <TallyBars bars={bars} votes={votes} reveal={winner !== null} />;
}

/* -- Was gerade dran ist, aus den Ereignissen ------------------------------------------------------------------------ */

export interface LessonNow {
  readonly config: LessonConfig | null;
  readonly step: LessonStepEvent | null;
  /** Die laufende (oder zuletzt geschlossene) Abstimmung — die mit dem grössten Index. */
  readonly vote: { readonly kind: 'question'; readonly q: LessonQuestionEvent; readonly reveal: LessonRevealEvent | null } | { readonly kind: 'poll'; readonly p: LessonPollEvent; readonly end: PollEndEvent | null } | null;
  readonly tally: TallyEvent | null;
  readonly joined: number;
}

export function lessonNow(opened: readonly Opened[]): LessonNow {
  const config = readLessonConfig(lastOf(bodies<unknown>(opened, 'config'))?.body ?? null);
  const step = lastOf(bodies<LessonStepEvent>(opened, 'step'))?.body ?? null;
  const qs = bodies<LessonQuestionEvent>(opened, 'question').map((x) => x.body);
  const ps = bodies<LessonPollEvent>(opened, 'poll').map((x) => x.body);
  const q = lastOf(qs);
  const p = lastOf(ps);
  const reveals = bodies<LessonRevealEvent>(opened, 'reveal').map((x) => x.body);
  const ends = bodies<PollEndEvent>(opened, 'pollend').map((x) => x.body);
  const vote: LessonNow['vote'] = q === undefined && p === undefined ? null
    : p === undefined || (q !== undefined && q.index > p.index) ? { kind: 'question', q: q!, reveal: reveals.find((r) => r.index === q!.index) ?? null }
    : { kind: 'poll', p, end: ends.find((e) => e.index === p.index) ?? null };
  const index = vote === null ? -1 : vote.kind === 'question' ? vote.q.index : vote.p.index;
  const tally = lastOf(bodies<TallyEvent>(opened, 'tally').map((x) => x.body).filter((x) => x.index === index)) ?? null;
  const joined = new Set(bodies<{ participant: string }>(opened, 'join').map((j) => j.body.participant)).size;
  return { config, step, vote, tally, joined };
}

/* -- Der Leiter ----------------------------------------------------------------------------------------------------- */

interface OpenVote {
  readonly index: number;
  readonly round: number;
  readonly step: string;
  readonly kind: 'question' | 'choice' | 'chapters';
  readonly card?: Card;
  readonly data?: Readonly<Record<string, unknown>> | null;
  readonly options?: readonly LessonOption[];
  readonly title?: string | null;
  /** 2026-11-22 (I3) — eine Vorhersage (auch in der zweiten Runde). */
  readonly predict?: boolean;
  closed: boolean;
}

export function LessonHost({ session, opened, send, parts, onPartsDone }: {
  session: SessionRow;
  opened: readonly Opened[];
  send: Send;
  /**
   * 2026-11-22 (Homer) — EIN GEMEINSAMER ETAP EINER EINHEIT (`unit/UnitHost.tsx`): diese Teile statt der Einstellung der Sitzung;
   * am Ende `onPartsDone` statt des Endes der Stunde; die Einstellungen ändern nur dieses Gerät (die Einstellung trägt die Einheit).
   */
  parts?: readonly LessonPart[];
  onPartsDone?: () => void;
}) {
  const t = useT();
  const { lib } = useCtx();
  const now = lessonNow(opened);
  const config: LessonConfig | null = parts === undefined ? now.config
    : { title: '', showVotes: 'after', thresholds: { high: 0.7, low: 0.3 }, ...(now.config ?? {}), parts };
  const cards = useAsync(() => lib.cards('flow').then((r) => r.cards), [lib, lib.revision]);
  const content = useMemo(() => (cards == null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  const [partAt, setPartAt] = useState(0);
  const [decide, setDecide] = useState<LessonDecision | null>(null);
  const [jump, setJump] = useState<{ step: string; at: number; exit?: string } | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(() => keptThresholds(config?.thresholds ?? { high: 0.7, low: 0.3 }));
  const [showVotes, setShowVotes] = useState<ShowVotes>(config?.showVotes ?? 'after');
  const [panel, setPanel] = useState(true);
  const [stepNow, setStepNow] = useState<LessonStep | null>(null);
  const { busy, failed, run } = useBusy();
  useEffect(() => { if (config !== null) setShowVotes(config.showVotes); }, [config?.showVotes]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Die Abstimmungen dieser Stunde (Index fortlaufend über Fragen und Wahlen). */
  const votes = useRef<OpenVote[]>([]);
  const [tick, setTick] = useState(0);
  const nextIndex = () => Math.max(-1, ...votes.current.map((v) => v.index), ...bodies<{ index: number }>(opened, 'question').map((q) => q.body.index), ...bodies<{ index: number }>(opened, 'poll').map((p) => p.body.index)) + 1;
  const open = lastOf(votes.current) ?? null;
  const answersOf = (index: number): Vote[] => bodies<AnswerEvent>(opened, 'answer').filter((a) => a.body.index === index).map((a) => ({ participant: a.body.participant, given: a.body.given, at: a.body.at }));
  const shows = useRef<{ flow: string; step: string }[]>([]);
  const chapterOrder = useRef(new Map<string, readonly number[]>());

  const part = config?.parts[partAt];
  const flow = content === null || !isFlowPart(part) ? undefined : content.flow(part.flow);
  /* Beginnt die Erzählung nicht am Anfang (ein Weg ab einer Gabelung, ein Pfad): dorthin, sobald der Spieler steht. */
  useEffect(() => {
    /* 2026-11-22 (I11) — der Anfang der Erzählung selbst ist kein Sprung (er käme sonst nach dem ersten „Dalej" zurück). */
    if (isFlowPart(part) && part.start !== undefined && (part.start.step !== flow?.start || part.start.exit !== undefined)) setJump({ step: part.start.step, at: Date.now(), ...(part.start.exit === undefined ? {} : { exit: part.start.exit }) });
  }, [partAt, flow?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 2026-11-22 (I11) — der Name eines Teils: die Erzählung, oder der Turm, dessen Fragen die Klasse gemeinsam beantwortet. */
  const partName = (p: LessonPart | undefined): string => {
    if (p === undefined) return '';
    if (isFlowPart(p)) return content?.flow(p.flow)?.name ?? '';
    const e = p.tower === undefined ? undefined : lib.entity(p.tower);
    return e === undefined ? t('cogitaLesson.round.questions', { count: p.questions.length }) : t('cogitaLesson.round.tower', { name: lib.label(e) });
  };

  const closeVote = async (v: OpenVote, quiet = false) => {
    if (v.closed) return;
    v.closed = true;
    setTick((n) => n + 1);
    const given = answersOf(v.index);
    if (v.kind === 'question' && v.card !== undefined) {
      const tally = tallyQuestion(v.card, given, v.data ?? null);
      const heat = linesHeat(v.card, given.map((g) => g.given));
      const lite: TallyLite = { votes: tally.votes, correct: tally.correct, bars: tally.bars, tags: tally.tags, ...(heat.length === 0 ? {} : { heat }) };
      await send('reveal', { index: v.index, card: v.card, answered: tally.votes, correct: tally.correct, scores: [], teams: [], round: v.round, ...(showVotes === 'never' || quiet ? {} : { tally: lite }) } satisfies LessonRevealEvent);
    } else if (v.options !== undefined) {
      const pt = tallyPoll(v.options.length, given, v.options.flatMap((o, i) => (o.open ? [i] : [])));
      if (v.kind === 'chapters') chapterOrder.current.set(v.step, pt.order);
      await send('pollend', { index: v.index, winner: pt.winner, order: pt.order, votes: pt.votes, ...(showVotes === 'never' || quiet ? {} : { counts: pt.counts }) } satisfies PollEndEvent);
    }
  };

  const openQuestion = async (step: string, card: Card, data: Readonly<Record<string, unknown>> | null, round: number, predict = false) => {
    const index = nextIndex();
    votes.current = [...votes.current, { index, round, step, kind: 'question', card, data, closed: false, ...(predict ? { predict: true } : {}) }];
    setTick((n) => n + 1);
    if (session.state === 'lobby') await setSessionState(session.sessionId, 'running');
    await send('question', { index, total: 0, card: stripCard(card), startedAt: Date.now(), deadline: null, round, step, lesson: true, ...(predict ? { predict: true as const } : {}) } satisfies LessonQuestionEvent,
      { kind: 'slot', body: { index, form: card.answer.form, count: card.answer.form === 'one' || card.answer.form === 'many' ? card.answer.options.length : card.answer.form === 'truefalse' ? 2 : 0 } });
  };
  const openPoll = async (step: string, kind: 'choice' | 'chapters', title: string | null, options: readonly LessonOption[], round: number) => {
    const index = nextIndex();
    votes.current = [...votes.current, { index, round, step, kind, options, title, closed: false }];
    setTick((n) => n + 1);
    if (session.state === 'lobby') await setSessionState(session.sessionId, 'running');
    await send('poll', { index, round, step, kind, title, options } satisfies LessonPollEvent, { kind: 'slot', body: { index, form: 'poll', count: options.length } });
  };

  /* Ein neuer Schritt im Spieler: an die Klasse; eine Frage, eine Wahl, Kapitel öffnen eine Abstimmung. */
  const onStep = (step: LessonStep) => {
    setStepNow(step);
    void run(async () => {
      const was = lastOf(votes.current);
      if (was !== undefined && !was.closed && (step.kind === 'end' || was.step !== step.step)) await closeVote(was, true);
      if (step.kind === 'end') { await send('step', { at: Date.now(), flow: step.flow, step: '', kind: 'end', title: null, entity: null } satisfies LessonStepEvent); return; }
      const title = step.kind === 'show' || step.kind === 'choice' || step.kind === 'chapters' ? step.title : null;
      if (step.kind === 'show') shows.current = [...shows.current, { flow: step.flow, step: step.step }].slice(-50);
      await send('step', { at: Date.now(), flow: step.flow, step: step.step, kind: step.kind, title, entity: step.kind === 'show' ? smallEntity(step.entity) : null } satisfies LessonStepEvent);
      if (step.kind === 'question') await openQuestion(step.step, step.card, step.data, 1, step.predict === true);
      if ((step.kind === 'choice' || step.kind === 'chapters') && step.options.filter((o) => o.open).length >= 2) await openPoll(step.step, step.kind, step.title, step.options, 1);
    });
  };
  /* Der Spieler bekommt eine feste Hand (`onStep` sieht immer den neuesten Stand: Einstellungen, Ereignisse). */
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const lesson = useMemo(() => ({ onStep: (s: LessonStep) => onStepRef.current(s), decide }), [decide]);

  /* Live an die Klasse (wenn der Leiter es will): wie viele je Möglichkeit, höchstens alle 1,5 s. */
  const liveCount = open === null || open.closed ? -1 : answersOf(open.index).length;
  useEffect(() => {
    if (showVotes !== 'live' || open === null || open.closed || liveCount < 1) return undefined;
    const tm = window.setTimeout(() => {
      const given = answersOf(open.index);
      const counts = open.kind === 'question' && open.card !== undefined ? tallyQuestion(open.card, given, open.data ?? null).bars.map((b) => b.count) : tallyPoll(open.options?.length ?? 0, given).counts;
      const heat = open.kind === 'question' && open.card !== undefined ? linesHeat(open.card, given.map((g) => g.given)) : [];
      void send('tally', { index: open.index, votes: new Set(given.map((g) => g.participant)).size, counts, ...(heat.length === 0 ? {} : { heat }) } satisfies TallyEvent);
    }, 1500);
    return () => window.clearTimeout(tm);
  }, [liveCount, showVotes, open?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = (next: { showVotes?: ShowVotes; thresholds?: Thresholds }) => {
    if (config === null) return;
    const merged = { ...config, ...next };
    if (next.showVotes !== undefined) setShowVotes(next.showVotes);
    if (next.thresholds !== undefined) { setThresholds(next.thresholds); try { localStorage.setItem(THRESHOLDS, JSON.stringify(next.thresholds)); } catch { /* nur jetzt */ } }
    if (parts === undefined) void run(() => send('config', merged));
  };

  if (config === null) return <p className="wk-error">{t('cogitaLesson.host.noConfig')}</p>;
  if (cards === undefined || content === null) return <Loading label={t('cogitaLesson.host.loading')} />;

  /* -- Das Feld des Leiters: wer da ist, die laufende Abstimmung, ihre Verteilung, der Hinweis, die Entscheidung ------ */
  void tick;
  const given = open === null ? [] : answersOf(open.index);
  const qTally = open !== null && open.kind === 'question' && open.card !== undefined ? tallyQuestion(open.card, given, open.data ?? null) : null;
  const pTally = open !== null && open.kind !== 'question' && open.options !== undefined ? tallyPoll(open.options.length, given, open.options.flatMap((o, i) => (o.open ? [i] : []))) : null;
  const atStep = stepNow !== null && stepNow.kind !== 'end' && open !== null && open.step === stepNow.step;
  const advice = qTally === null || qTally.votes === 0 ? null : adviceOf(qTally.share, thresholds);
  const lastShow = lastOf(shows.current.filter((s) => s.flow === flow?.id));
  const kept = stepNow !== null && stepNow.kind === 'chapters' ? chapterOrder.current.get(stepNow.step) : undefined;
  const nextByOrder = kept === undefined || stepNow === null || stepNow.kind !== 'chapters' ? null : kept.map((i) => stepNow.options[i]).find((o) => o !== undefined && o.open) ?? null;

  const side = (
    <aside className="cg-lesson-side" aria-label={t('cogitaLesson.host.panel')} data-lesson-panel="">
      <p className="cg-row-between"><strong>{t('cogitaLesson.host.joined', { count: now.joined })}</strong>
        <button type="button" className="wk-link-btn" onClick={() => setPanel(false)}>{t('cogitaLesson.host.hidePanel')}</button></p>
      {open === null || !atStep ? <p className="cg-muted">{t('cogitaLesson.host.noVote')}</p> : (
        <div className="cg-lesson-vote" data-lesson-vote={open.index} data-lesson-round={open.round} data-lesson-closed={open.closed ? '1' : '0'}>
          <p className="cg-muted">{open.kind === 'question' ? t('cogitaLesson.host.voteQuestion', { round: open.round }) : open.kind === 'choice' ? t('cogitaLesson.host.voteWay') : t('cogitaLesson.host.voteOrder')}
            {' · '}{t('cogitaLesson.host.voted', { count: new Set(given.map((g) => g.participant)).size, total: now.joined })}</p>
          {qTally !== null && <TallyBars bars={qTally.bars} votes={qTally.votes} form={open.card?.answer.form} reveal={open.closed} tags={qTally.tags} />}
          {open.card !== undefined && heatForm(open.card) && <LinesHeat card={open.card} counts={linesHeat(open.card, given.map((g) => g.given))} reveal={open.closed} />}
          {pTally !== null && open.options !== undefined && <PollBars options={open.options} counts={pTally.counts} votes={pTally.votes} winner={open.closed ? pTally.winner : null} />}
          {qTally !== null && open.closed && open.card !== undefined && <p>{t('cogitaLesson.host.correctIs')} <TexText text={answerText(open.card)} /></p>}
          {qTally !== null && qTally.votes > 0 && (
            <p className="cg-lesson-share" data-lesson-share={Math.round(qTally.share * 100)}>{t('cogitaLesson.host.share', { pct: Math.round(qTally.share * 100) })}
              {qTally.answer !== null && <> · {qTally.answer.correct ? t('cogitaLesson.host.classRight') : t('cogitaLesson.host.classWrong')}</>}</p>
          )}
          {advice !== null && open.closed && <p className={`cg-lesson-advice is-${advice}`} data-lesson-advice={advice}>{t(`cogitaLesson.advice.${advice}`)}</p>}
          <div className="wk-actions">
            {!open.closed && <button type="button" className="wk-btn" disabled={busy} data-lesson-close="" onClick={() => void run(() => closeVote(open))}>{t('cogitaLesson.host.close')}</button>}
            {open.closed && open.kind === 'question' && open.card !== undefined && (
              <button type="button" className="wk-btn wk-btn-line" disabled={busy} data-lesson-again="" onClick={() => void run(() => openQuestion(open.step, open.card!, open.data ?? null, open.round + 1, open.predict === true))}>{t('cogitaLesson.host.again')}</button>
            )}
            {open.closed && open.kind === 'question' && qTally?.answer != null && (
              <button type="button" className="wk-btn" disabled={busy} data-lesson-take="" onClick={() => setDecide({ step: open.step, at: Date.now(), given: qTally.answer!.given })}>{t('cogitaLesson.host.takeAnswer')}</button>
            )}
            {open.closed && open.kind !== 'question' && pTally?.winner != null && open.options !== undefined && (
              <button type="button" className="wk-btn" disabled={busy} data-lesson-take="" onClick={() => setDecide({ step: open.step, at: Date.now(), exit: open.options![pTally.winner!]!.exit })}>
                {t('cogitaLesson.host.takeChoice', { name: open.options[pTally.winner]!.label })}</button>
            )}
            {open.closed && advice === 'back' && lastShow !== undefined && (
              <button type="button" className="wk-btn wk-btn-line" disabled={busy} data-lesson-back="" onClick={() => setJump({ step: lastShow.step, at: Date.now() })}>{t('cogitaLesson.host.backToSlide')}</button>
            )}
          </div>
        </div>
      )}
      {nextByOrder !== null && stepNow !== null && stepNow.kind === 'chapters' && (open === null || open.step !== stepNow.step || open.closed) && (
        <p><button type="button" className="wk-btn wk-btn-line" data-lesson-order="" onClick={() => setDecide({ step: stepNow.step, at: Date.now(), exit: nextByOrder.exit })}>{t('cogitaLesson.host.nextByOrder', { name: nextByOrder.label })}</button></p>
      )}
      {stepNow !== null && stepNow.kind === 'end' && (
        <div className="wk-actions">
          {partAt + 1 < config.parts.length
            ? <button type="button" className="wk-btn" data-lesson-next-part="" onClick={() => { setDecide(null); setPartAt((n) => n + 1); }}>{t('cogitaLesson.host.nextPart', { name: partName(config.parts[partAt + 1]) })}</button>
            : onPartsDone !== undefined ? <button type="button" className="wk-btn" data-lesson-parts-done="" onClick={onPartsDone}>{t('cogitaUnit.host.ledDone')}</button>
            : <button type="button" className="wk-btn" disabled={busy} data-lesson-finish="" onClick={() => void run(() => setSessionState(session.sessionId, 'finished'))}>{t('cogitaLesson.host.finish')}</button>}
        </div>
      )}
      <details className="cg-lesson-settings">
        <summary>{t('cogitaLesson.host.settings')}</summary>
        <label className="wk-field"><span>{t('cogitaLesson.host.showVotes')}</span>
          <select value={showVotes} data-lesson-show-votes="" onChange={(e) => saveSettings({ showVotes: e.target.value as ShowVotes })}>
            {(['after', 'live', 'never'] as const).map((v) => <option key={v} value={v}>{t(`cogitaLesson.showVotes.${v}`)}</option>)}
          </select>
        </label>
        <div className="cg-row">
          <label className="wk-field"><span>{t('cogitaLesson.host.high')}</span>
            <input type="number" min={0} max={100} value={Math.round(thresholds.high * 100)} onChange={(e) => saveSettings({ thresholds: { high: Math.min(1, Math.max(thresholds.low, Number(e.target.value) / 100)), low: thresholds.low } })} /></label>
          <label className="wk-field"><span>{t('cogitaLesson.host.low')}</span>
            <input type="number" min={0} max={100} value={Math.round(thresholds.low * 100)} onChange={(e) => saveSettings({ thresholds: { high: thresholds.high, low: Math.max(0, Math.min(thresholds.high, Number(e.target.value) / 100)) } })} /></label>
        </div>
        <p className="cg-muted">{t('cogitaLesson.host.thresholdsSay')}</p>
      </details>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </aside>
  );

  return (
    <div className={`cg-lesson${panel ? ' has-panel' : ''}`} data-lesson-host={session.sessionId} data-lesson-part={partAt}>
      <div className="cg-lesson-main">
        {!panel && <button type="button" className="wk-link-btn cg-lesson-showpanel" onClick={() => setPanel(true)} data-lesson-show-panel="">{t('cogitaLesson.host.showPanel', { count: open !== null && !open.closed ? new Set(given.map((g) => g.participant)).size : 0 })}</button>}
        {part !== undefined && !isFlowPart(part)
          ? <QuestionsRound key={`${partAt}:q`} part={part} index={partAt} cards={cards ?? []} name={partName(part)} lesson={lesson} />
          : flow === undefined ? <p className="wk-error">{t('cogitaViewsStats.sess.noFlow')}</p>
          : <FlowPlayer key={`${partAt}:${flow.id}`} flow={flow} content={content} learner={null} gate={false} jumpTo={jump} lesson={lesson} />}
      </div>
      {panel && side}
    </div>
  );
}

/* -- Pfad und Turm: die Fragen eines Turms nacheinander (I11) -------------------------------------------------------------- */

/**
 * 2026-11-22 (I11) — DIE KLASSE BEANTWORTET DIE FRAGEN EINES TURMS GEMEINSAM: Frage für Frage dieselbe Abstimmung wie in einer
 * Erzählung (der Leiter sieht die Verteilung, schliesst, nimmt die Antwort der Klasse oder geht weiter). Der Teil meldet sich wie
 * der Spieler (`onStep`), so tragen Leinwand, Klasse und Fortschritt der Schüler ihn ohne eigene Wege.
 */
function QuestionsRound({ part, index, cards, name, lesson }: { part: LessonQuestionsPart; index: number; cards: readonly Card[]; name: string; lesson: LessonLink }) {
  const t = useT();
  const { lib } = useCtx();
  const list = useMemo(() => part.questions.map((k) => cards.find((c) => c.key === k)).filter((c): c is Card => c !== undefined), [part, cards]);
  const [at, setAt] = useState(0);
  const flowId = `~questions:${index}`;
  const stepId = (i: number) => `~q${i}`;
  const card = list[at];
  /* Jede Frage wird angesagt (eine Abstimmung öffnet sich); nach der letzten das Ende des Teils. */
  useEffect(() => {
    if (card === undefined) { lesson.onStep({ kind: 'end', flow: flowId }); return; }
    lesson.onStep({ kind: 'question', flow: flowId, step: stepId(at), card, data: lib.entity(card.question)?.data ?? null });
  }, [at, card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  /* „Antwort der Klasse übernehmen" führt hier zur nächsten Frage. */
  useEffect(() => {
    if (lesson.decide !== null && lesson.decide.step === stepId(at)) setAt((n) => n + 1);
  }, [lesson.decide]); // eslint-disable-line react-hooks/exhaustive-deps
  if (list.length === 0) return <p className="cg-muted" data-lesson-round="empty">{t('cogitaLesson.round.none', { name })}</p>;
  return (
    <section className="cg-lesson-round" data-lesson-round={index} data-lesson-round-at={at}>
      <p className="cg-muted">{card === undefined ? t('cogitaLesson.round.done', { name }) : t('cogitaLesson.round.of', { n: at + 1, all: list.length, name })}</p>
      {card !== undefined && (
        <>
          <div className="cg-prompt"><TexText text={card.prompt.map((p) => p.text).join(' ')} /></div>
          {(card.answer.form === 'one' || card.answer.form === 'many') && (
            <ol className="cg-lesson-options" type="A">{inScreenOrder(card, card.answer.options).map((o, i) => <li key={i}><TexText text={o} /></li>)}</ol>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line" onClick={() => setAt((n) => n + 1)} data-lesson-round-next="">
              {at + 1 < list.length ? t('cogitaLesson.round.next') : t('cogitaLesson.round.finish')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/* -- Die Leinwand ---------------------------------------------------------------------------------------------------- */

export function LessonScreen({ opened, title }: { opened: readonly Opened[]; title: string }) {
  const t = useT();
  const now = lessonNow(opened);
  const v = now.vote;
  const step = now.step;
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => undefined);
    return () => { void lock?.release(); };
  }, []);
  const onStepVote = v !== null && step !== null && (v.kind === 'question' ? v.q.step : v.p.step) === step.step;
  /* 2026-11-25 — ohne Zwischenstand (die geführte Klasse schickt keinen): die Stimmen selbst gezählt, je Teilnehmer eine. */
  const voteIndex = v === null ? -1 : v.kind === 'question' ? v.q.index : v.p.index;
  const voted = now.tally?.votes ?? new Set(bodies<{ participant: string; index: number }>(opened, 'answer').filter((a) => a.body.index === voteIndex).map((a) => a.body.participant)).size;
  return (
    <div className="cg-live-screen cg-lesson-screen" data-lesson-screen={step?.kind ?? 'none'}>
      {step === null || step.kind === 'end' ? (
        <>
          <h1>{now.config?.title || title}</h1>
          <p className="cg-muted">{t('cogitaViewsStats.sess.joined', { count: now.joined })}</p>
        </>
      ) : step.kind === 'show' ? (
        <div className="cg-lesson-slide">
          {step.title !== null && <h2><TexText text={step.title} /></h2>}
          {step.entity !== null && <EntityView entity={step.entity} />}
        </div>
      ) : v !== null && onStepVote && v.kind === 'question' ? (
        <>
          <span className="cg-muted">{v.q.round > 1 ? t('cogitaLesson.screen.round', { round: v.q.round }) : t('cogitaLesson.screen.vote')}</span>
          {v.q.predict === true && <p className="cg-flow-predict" role="note" data-lesson-predict="screen">{t('cogitaLearn.words.predictBefore')}</p>}
          <div className="cg-prompt"><TexText text={v.q.card.prompt.map((p) => p.text).join(' ')} /></div>
          {v.reveal === null ? (
            <>
              {(v.q.card.answer.form === 'one' || v.q.card.answer.form === 'many') && (
                <ol className="cg-lesson-options" type="A">{inScreenOrder(v.q.card, v.q.card.answer.options).map((o, i) => <li key={i}><TexText text={o} /></li>)}</ol>
              )}
              {/* 2026-11-22 (Homer-Einheit) — Lektüre: der Abschnitt für alle, mit der Wärmekarte, sobald der Leiter Stimmen zeigt. */}
              {heatForm(v.q.card) && <LinesHeat card={v.q.card} counts={now.tally?.heat ?? []} />}
              <span className="cg-timer" data-lesson-voted={v.q.index}>{t('cogitaLesson.screen.voted', { count: voted, total: now.joined })}</span>
              {now.tally !== null && <TallyBars bars={inScreenOrder(v.q.card, now.tally.counts.map((n, i) => ({ key: String(i), label: v.q.card.answer.form === 'one' || v.q.card.answer.form === 'many' ? v.q.card.answer.options[i] ?? '' : '', count: n, correct: false })))} votes={now.tally.votes} form={v.q.card.answer.form} reveal={false} />}
            </>
          ) : (
            <>
              {v.reveal.tally?.heat !== undefined && <LinesHeat card={v.reveal.card} counts={v.reveal.tally.heat} reveal />}
              {v.reveal.tally !== undefined
                ? <TallyBars bars={inScreenOrder(v.reveal.card, v.reveal.tally.bars)} votes={v.reveal.tally.votes} form={v.reveal.card.answer.form} reveal tags={v.reveal.tally.tags} />
                : <p>{t('cogitaLesson.screen.answered', { count: v.reveal.answered })}</p>}
              <strong data-lesson-screen-share="">{t('cogitaLesson.screen.share', { pct: v.reveal.answered === 0 ? 0 : Math.round((v.reveal.correct / v.reveal.answered) * 100) })}</strong>
              <p>{t('cogitaLesson.host.correctIs')} <TexText text={answerText(v.reveal.card)} /></p>
            </>
          )}
        </>
      ) : v !== null && onStepVote && v.kind === 'poll' ? (
        <>
          {v.p.title !== null && <h2><TexText text={v.p.title} /></h2>}
          <span className="cg-muted">{v.p.kind === 'choice' ? t('cogitaLesson.screen.pollWay') : t('cogitaLesson.screen.pollOrder')}</span>
          {v.end === null
            ? <>
              <ol className="cg-lesson-options" type="A">{v.p.options.map((o) => <li key={o.exit} className={o.open ? '' : 'is-off'}><TexText text={o.label} /></li>)}</ol>
              <span className="cg-timer">{t('cogitaLesson.screen.voted', { count: voted, total: now.joined })}</span>
            </>
            : <>
              {v.end.counts !== undefined && <PollBars options={v.p.options} counts={v.end.counts} votes={v.end.votes} winner={v.end.winner} />}
              {v.end.winner !== null && <strong>{t('cogitaLesson.screen.chosen', { name: v.p.options[v.end.winner]?.label ?? '' })}</strong>}
            </>}
        </>
      ) : (
        <h2>{step.title ?? now.config?.title ?? title}</h2>
      )}
    </div>
  );
}

/** Für die Stunde im Gastgeber: `config` gelesen — sonst `null` (dann ist es keine Stunde). */
export const lessonConfigOf = (opened: readonly Opened[]): LessonConfig | null => readLessonConfig(lastOf(bodies<unknown>(opened, 'config'))?.body ?? null);


/* -- Die Klasse: jede und jeder auf dem eigenen Gerät ---------------------------------------------------------------- */

/**
 * ALS SCHÜLERIN, ALS SCHÜLER: die Folie (zum Mitlesen), die Frage (einzeln abstimmen), die Wege oder Themen (wählen),
 * nach dem Schliessen das Ergebnis — und, wenn der Leiter es zulässt, die Verteilung. Die EIGENE Stimme der ersten Runde
 * geht in den eigenen Fortschritt (wie eine Antwort in einer Powtórka); die zweite Runde (nach dem Gespräch mit dem
 * Nachbarn) zählt für die Klasse, nicht noch einmal für einen selbst. Ohne Schlüssel (nur der Code) stehen Buchstaben da.
 */
export function LessonPlay({ sessionId, opened, slots, learner, sent, onVote }: {
  sessionId: string;
  opened: readonly Opened[];
  slots: readonly { readonly index: number; readonly form: string; readonly count: number }[];
  learner: { record: (card: Card, correctness: number, extras?: { via?: string; given?: string; tags?: readonly string[] }) => unknown } | null;
  sent: ReadonlyMap<number, unknown>;
  onVote: (index: number, given: unknown) => void;
}) {
  const t = useT();
  const now = lessonNow(opened);
  const v = now.vote;
  const step = now.step;
  const slot = lastOf(slots) ?? null;
  const index = v === null ? slot?.index ?? -1 : Math.max(v.kind === 'question' ? v.q.index : v.p.index, slot?.index ?? -1);
  const [typed, setTyped] = useState('');

  /* Die eigene Stimme der ersten Runde in den eigenen Fortschritt — einmal je Frage. */
  const recorded = useRef(new Set<number>());
  const reveal = v?.kind === 'question' ? v.reveal : null;
  useEffect(() => {
    /* 2026-11-22 (I3) — eine Vorhersage zählt für niemanden. */
    if (v?.kind !== 'question' || reveal === null || learner === null || v.q.round > 1 || v.q.predict === true || recorded.current.has(reveal.index) || !sent.has(reveal.index)) return;
    recorded.current.add(reveal.index);
    const given = sent.get(reveal.index);
    learner.record(reveal.card, checkCardSafe(reveal.card, given), { via: sessionId, given: givenTextSafe(reveal.card, given) });
  }, [reveal, learner, sent, sessionId, v]);

  const stepShown = step !== null && step.kind === 'show' && (v === null || (v.kind === 'question' ? v.q.step : v.p.step) !== step.step);
  if (stepShown || (v === null && slot === null)) {
    return (
      <div className="cg-live-screen cg-lesson-student" data-lesson-student="slide">
        {step === null ? <p className="cg-muted">{t('cogitaViewsStats.sess.soon')}</p> : (
          <>
            {step.title !== null && <h2><TexText text={step.title} /></h2>}
            {step.entity !== null ? <div className="cg-lesson-slide"><EntityView entity={step.entity} /></div> : <p className="cg-muted">{t('cogitaLesson.student.board')}</p>}
          </>
        )}
      </div>
    );
  }

  /* Eine Frage mit Schlüssel: die Karte zum Beantworten. */
  if (v !== null && v.kind === 'question' && v.q.index === index) {
    const mine = sent.get(index);
    return (
      <div className="cg-live-screen cg-lesson-student" data-lesson-student="question" data-lesson-index={index}>
        <span className="cg-muted">{v.q.round > 1 ? t('cogitaLesson.screen.round', { round: v.q.round }) : t('cogitaLesson.screen.vote')}</span>
        {v.q.predict === true && <p className="cg-flow-predict" role="note" data-lesson-predict="">{t('cogitaLearn.words.predictBefore')}</p>}
        {/* 2026-11-25 (Eigentümer) — nach dem Abschicken bleibt alles stehen: die Frage, die Möglichkeiten, die eigene Wahl (gesperrt, ohne richtig/falsch). */}
        {v.reveal === null && (
          <section className="cg-face" data-lesson-answered={mine === undefined ? undefined : ''}>
            <div className="cg-prompt"><TexText text={v.q.card.prompt.map((p) => p.text).join(' ')} /></div>
            <AnswerInput card={v.q.card} disabled={mine !== undefined} chosen={mine} onSubmit={(given) => onVote(index, given)} />
          </section>
        )}
        {v.reveal === null && mine !== undefined && <p className="cg-muted" data-lesson-sent="">{t('cogitaLesson.student.sent')}</p>}
        {v.reveal === null && now.tally !== null && <TallyBars bars={inScreenOrder(v.q.card, now.tally.counts.map((n, i) => ({ key: String(i), label: v.q.card.answer.form === 'one' || v.q.card.answer.form === 'many' ? v.q.card.answer.options[i] ?? '' : '', count: n, correct: false })))} votes={now.tally.votes} form={v.q.card.answer.form} reveal={false} />}
        {v.reveal !== null && (
          <>
            {mine !== undefined
              ? <Verdict card={v.reveal.card} outcome={checkCard(v.reveal.card, mine)} given={mine} />
              : <p>{t('cogitaLesson.host.correctIs')} <TexText text={answerText(v.reveal.card)} /></p>}
            {v.reveal.tally?.heat !== undefined && <LinesHeat card={v.reveal.card} counts={v.reveal.tally.heat} reveal />}
            {v.reveal.tally !== undefined && <TallyBars bars={inScreenOrder(v.reveal.card, v.reveal.tally.bars)} votes={v.reveal.tally.votes} form={v.reveal.card.answer.form} reveal tags={v.reveal.tally.tags} />}
          </>
        )}
      </div>
    );
  }

  /* Eine Wahl (Weg oder Thema) mit Schlüssel: die Möglichkeiten beim Namen. */
  if (v !== null && v.kind === 'poll' && v.p.index === index) {
    const mine = sent.get(index);
    return (
      <div className="cg-live-screen cg-lesson-student" data-lesson-student="poll" data-lesson-index={index}>
        {v.p.title !== null && <h2><TexText text={v.p.title} /></h2>}
        <span className="cg-muted">{v.p.kind === 'choice' ? t('cogitaLesson.screen.pollWay') : t('cogitaLesson.screen.pollOrder')}</span>
        {v.end === null ? (
          <div className="cg-choices cg-choice-list">
            {v.p.options.map((o, i) => (
              <button key={o.exit} type="button" className={`cg-option cg-choice-item${mine === i ? ' is-on' : ''}`} disabled={!o.open || mine !== undefined} data-lesson-option={i} onClick={() => onVote(index, i)}>
                <TexText text={o.label} />
              </button>
            ))}
          </div>
        ) : (
          <>
            {v.end.counts !== undefined && <PollBars options={v.p.options} counts={v.end.counts} votes={v.end.votes} winner={v.end.winner} />}
            {v.end.winner !== null && <strong>{t('cogitaLesson.screen.chosen', { name: v.p.options[v.end.winner]?.label ?? '' })}</strong>}
          </>
        )}
        {v.end === null && mine !== undefined && <p className="cg-muted" data-lesson-sent="">{t('cogitaLesson.student.sent')}</p>}
      </div>
    );
  }

  /* Ohne Schlüssel (nur der Code): Buchstaben, wahr/falsch, ein Feld — die Frage steht an der Tafel. */
  if (slot !== null && slot.index === index) {
    const mine = sent.get(index);
    const letters = slot.form === 'one' || slot.form === 'poll' || slot.form === 'many' ? Math.max(1, slot.count) : slot.form === 'truefalse' ? 2 : 0;
    return (
      <div className="cg-live-screen cg-lesson-student" data-lesson-student="slot" data-lesson-index={index}>
        <p className="cg-muted">{t('cogitaLesson.student.board')}</p>
        {mine !== undefined && <p className="cg-muted" data-lesson-sent="">{t('cogitaLesson.student.sent')}</p>}
        {letters > 0 ? (
            <div className="cg-live-buttons">
              {Array.from({ length: letters }, (_, i) => (
                <button key={i} type="button" data-lesson-option={i} disabled={mine !== undefined} className={mine !== undefined && JSON.stringify(mine) === JSON.stringify(slot.form === 'truefalse' ? i === 0 : slot.form === 'many' ? [i] : i) ? 'is-on' : undefined} onClick={() => onVote(index, slot.form === 'truefalse' ? i === 0 : slot.form === 'many' ? [i] : i)}>
                  {slot.form === 'truefalse' ? (i === 0 ? t('cogitaViewsStats.sess.true') : t('cogitaViewsStats.sess.false')) : String.fromCharCode(65 + i)}
                </button>
              ))}
            </div>
          ) : mine !== undefined ? <p data-lesson-mine="">{typeof mine === 'string' ? mine : JSON.stringify(mine)}</p>
          : slot.form === 'text' || slot.form === 'number' || slot.form === 'date' ? (
            <form className="cg-row" onSubmit={(e) => { e.preventDefault(); if (typed.trim() !== '') { onVote(index, typed.trim()); setTyped(''); } }}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t('cogitaLesson.student.typed')} maxLength={200} />
              <button type="submit" className="wk-btn">{t('cogitaLesson.student.send')}</button>
            </form>
          ) : <p className="cg-muted">{t('cogitaLesson.student.onlyBoard')}</p>}
      </div>
    );
  }
  return <div className="cg-live-screen cg-lesson-student"><p className="cg-muted">{t('cogitaLesson.student.board')}</p></div>;
}

const checkCardSafe = (card: Card, given: unknown): number => { try { return checkCard(card, given).correctness; } catch { return 0; } };
const givenTextSafe = (card: Card, given: unknown): string => { try { return givenText(card, given).slice(0, 400); } catch { return ''; } };
