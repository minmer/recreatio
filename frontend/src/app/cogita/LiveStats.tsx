/**
 * 2026-11-02 — STATYSTYKI NA ŻYWO: die Zahlen des Tages, die Punkte von heute Antwort für Antwort, die Punkte und das
 * Tagesziel Tag für Tag (mit der Ziellinie) und — im Ganzen — wo die Karten stehen (`KnowledgeStats`). Alles wächst mit
 * jeder Antwort, die ein Baustein derselben Person auf der Seite festhält (die Lernenden hören einander, `learn.ts`);
 * mit Konto oder Platz kommt alle 30 s dazu, was andere Geräte sandten.
 *
 * Dieselben Diagramme wie Nauka → Postępy (`KnowCharts.tsx`: eine Reihe, eine Farbe, Hinweis unter dem Zeiger, die
 * Tabelle darunter). Die Punkte rechnet `rewards.ts` nach der Regel des Ortes.
 */

import { useMemo, useState } from 'react';

import { fmtDate, fmtNumber, rich, t, useT, type Lang } from '../core/i18n';
import { Loading } from '../ui/Loading';
import type { Card } from './cardBasics';
import { Columns, Figure, KnowledgeStats, Line, Tiles, type Point } from './KnowCharts';
import { dayStart } from './lessons';
import type { Learner } from './learn';
import { answerIndex } from './measures';
/* 2026-11-05 (Durchsicht) — die Abstände dieses Lernenden, nicht die Vorgabe. */
import { spacingFor } from './spacing';
import { GOAL_UNIT_LABEL, lastDays, todayLine, type RewardDay, type RewardRules, type RewardState } from './rewards';
import { useRewards } from './RewardViews';
import type { CogitaLibrary } from './store';
import { percent } from './ui';
import './rewards.css';

/* Die Namen werden beim Lesen übersetzt (Getter). */
export const STATS_PIECES = [
  { value: 'tiles' as const, get label() { return t('cogitaViewsRewards.live.piece.tiles'); } },
  { value: 'today' as const, get label() { return t('cogitaViewsRewards.live.piece.today'); } },
  { value: 'days' as const, get label() { return t('cogitaViewsRewards.live.piece.days'); } },
  { value: 'goal' as const, get label() { return t('cogitaViewsRewards.live.piece.goal'); } },
  { value: 'knowledge' as const, get label() { return t('cogitaViewsRewards.live.piece.knowledge'); } }
] as const;
export type StatsPiece = (typeof STATS_PIECES)[number]['value'];

/* Zahlen und Tage in der Sprache der Stelle. */
const fmt = (lang: Lang) => ({
  num: (n: number) => fmtNumber(n, undefined, lang),
  time: (at: number) => fmtDate(new Date(at), { hour: '2-digit', minute: '2-digit' }, lang),
  date: (at: number) => fmtDate(new Date(at), { day: 'numeric', month: 'numeric' }, lang),
  dayName: (at: number) => fmtDate(new Date(at), { weekday: 'short', day: 'numeric', month: 'long' }, lang)
});

/** Alle Punkte eines Tages (auch Ziel, Serie, Abzeichen) — `RewardDay.points` zählt nur, was Antworten bringen. */
function pointsByDay(state: RewardState): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of state.events) if (e.points > 0) out.set(dayStart(e.at), (out.get(dayStart(e.at)) ?? 0) + e.points);
  return out;
}

const unitValue = (d: RewardDay, unit: RewardRules['goal']['unit']): number =>
  unit === 'cards' ? d.cards : unit === 'answers' ? d.answers : unit === 'points' ? d.points : d.minutes;

export function LiveStats({ lib, learner, rules, cards, keys, rename, hidden, shape }: {
  lib: CogitaLibrary;
  learner: Learner | null;
  rules: RewardRules;
  /** Die Karten dieses Ortes für „Gdzie są karty" — `null`: noch nicht gerechnet. */
  cards: readonly Card[] | null;
  keys?: ReadonlySet<string>;
  rename?: (key: string) => string;
  hidden?: ReadonlySet<string>;
  shape: 'strip' | 'block' | 'full';
}) {
  const t = useT();
  const F = fmt(t.lang);
  const { state, fresh } = useRewards(learner, rules, { ...(keys === undefined ? {} : { keys }), ...(rename === undefined ? {} : { rename }), live: true });
  const [range, setRange] = useState(14);
  const show = (p: StatsPiece) => hidden === undefined || !hidden.has(p);
  const now = Date.now();
  const byDay = useMemo(() => (state === null ? new Map<number, number>() : pointsByDay(state)), [state]);
  const answered = learner?.progress.answers.size ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mit jeder Antwort
  const byCard = useMemo(() => (learner === null ? null : answerIndex(learner.progress, rename)), [learner, rename, answered]);
  if (state === null) return <Loading lines={2} label={t('cogitaViewsRewards.live.counting')} />;

  const today = state.today;
  const todayPoints = byDay.get(today.day) ?? 0;
  const accuracy = today.answers === 0 ? null : today.correct / today.answers;
  const g = rules.goal;
  const pulse = fresh.events.some((e) => e.at >= today.day) ? fresh.seq : 0;

  if (shape === 'strip') {
    return (
      <div className="cg-live-stats" data-live-stats="strip">
        <p className="cg-live-line" data-live-today={todayPoints}>
          <span className="cg-live-dot">{t('cogitaViewsRewards.live.live')}</span>
          <span>{rich(t('cogitaViewsRewards.live.todayPts', { count: F.num(todayPoints) }), { b: (x) => <strong>{x}</strong> })}</span>
          <span>{rich(t('cogitaViewsRewards.live.answers', { count: today.answers }), { b: (x) => <strong>{x}</strong> })}</span>
          <span>{rich(t('cogitaViewsRewards.live.accuracy', { value: accuracy === null ? '—' : percent(accuracy) }), { b: (x) => <strong>{x}</strong> })}</span>
          <span>{rich(t('cogitaViewsRewards.live.goal', { value: `${Math.min(state.goalNow, g.amount)}/${g.amount}` }), { b: (x) => <strong>{x}</strong> })}</span>
        </p>
      </div>
    );
  }

  const line = todayLine(state, now);
  const todayPoints2: Point[] = line.length === 0 ? [] : [
    { key: 'start', axis: 'start', value: 0, tip: [[t('cogitaViewsRewards.live.pts', { count: 0 }), t('cogitaViewsRewards.live.dayStart')]] },
    ...line.map((p, i): Point => ({ key: `t${i}`, axis: F.time(p.at), value: p.total, tip: [[t('cogitaViewsRewards.live.pts', { count: F.num(p.total) }), t('cogitaViewsRewards.live.at', { time: F.time(p.at) })], [`+${F.num(p.points)}`, t('cogitaViewsRewards.live.forAnswer')]] }))
  ];
  const list = lastDays(state, now, range);
  const dayPoints: Point[] = list.map((d) => ({
    key: String(d.day), axis: F.date(d.day), value: byDay.get(d.day) ?? 0,
    tip: [[t('cogitaViewsRewards.live.pts', { count: F.num(byDay.get(d.day) ?? 0) }), F.dayName(d.day)], [String(d.answers), t('cogitaViewsRewards.live.answersWord', { count: d.answers })]]
  }));
  const goalPoints: Point[] = list.map((d) => ({
    key: String(d.day), axis: F.date(d.day), value: unitValue(d, g.unit),
    tip: [[`${F.num(unitValue(d, g.unit))} ${GOAL_UNIT_LABEL[g.unit]}`, F.dayName(d.day)], [d.met ? '✓' : '—', d.met ? t('cogitaViewsRewards.live.goalMet') : t('cogitaViewsRewards.live.goalOf', { count: g.amount })]]
  }));
  const table = (rows: readonly Point[], head: string) => (
    <table className="cg-table cg-stats-table"><thead><tr><th>{t('cogitaViewsRewards.live.when')}</th><th>{head}</th></tr></thead>
      <tbody>{rows.map((p) => <tr key={p.key}><td>{p.axis}</td><td>{F.num(p.value)}</td></tr>)}</tbody></table>
  );
  const chips = (
    <div className="cg-chips" role="radiogroup" aria-label={t('cogitaViewsRewards.live.period')}>
      {[7, 14, 30].map((d) => (
        <button key={d} type="button" role="radio" aria-checked={d === range} className={`cg-chip${d === range ? ' is-on' : ''}`} data-live-range={d} onClick={() => setRange(d)}>{t('cogitaViewsRewards.live.days', { count: d })}</button>
      ))}
    </div>
  );

  return (
    <div className="cg-live-stats cg-stats" data-live-stats={shape} data-live-today={todayPoints}>
      <div className="cg-live-head">
        <span className="cg-live-dot">{t('cogitaViewsRewards.live.live')}</span>
        {shape === 'full' && (show('days') || show('goal')) && chips}
      </div>
      {show('tiles') && (
        <div key={pulse} className={pulse > 0 ? 'cg-live-tiles is-fresh' : 'cg-live-tiles'}>
          <Tiles tiles={[
            { key: 'points', label: t('cogitaViewsRewards.live.tile.points'), value: `+${F.num(todayPoints)}`, sub: t('cogitaViewsRewards.live.tile.total', { count: F.num(state.total) }) },
            { key: 'answers', label: t('cogitaViewsRewards.live.tile.answers'), value: F.num(today.answers), sub: t('cogitaViewsRewards.live.tile.cards', { count: today.cards }) },
            { key: 'accuracy', label: t('cogitaViewsRewards.live.tile.accuracy'), value: accuracy === null ? '—' : percent(accuracy), sub: t('cogitaViewsRewards.live.tile.correct', { count: today.correct }) },
            { key: 'goal', label: t('cogitaViewsRewards.live.tile.goal'), value: `${F.num(Math.min(state.goalNow, g.amount))}/${F.num(g.amount)}`, sub: GOAL_UNIT_LABEL[g.unit] },
            { key: 'streak', label: t('cogitaViewsRewards.live.tile.streak'), value: t('cogitaViewsRewards.live.tile.streakDays', { count: state.streak }), sub: state.streakToday ? t('cogitaViewsRewards.live.tile.counts') : state.atRisk ? t('cogitaViewsRewards.live.tile.risk') : t('cogitaViewsRewards.live.tile.best', { count: state.best }) }
          ]} />
        </div>
      )}
      {show('today') && (
        <Figure id="live-today" title={t('cogitaViewsRewards.live.fig.today')} says={t('cogitaViewsRewards.live.fig.todaySays')} table={todayPoints2.length === 0 ? undefined : table(todayPoints2, t('cogitaViewsRewards.live.fig.totalPoints'))}>
          {todayPoints2.length === 0 ? <p className="cg-muted">{t('cogitaViewsRewards.live.fig.noPoints')}</p>
            : <Line points={todayPoints2} name={t('cogitaViewsRewards.live.fig.todayName')} max={todayPoints2[todayPoints2.length - 1]!.value} pulse={pulse} />}
        </Figure>
      )}
      {show('days') && shape === 'full' && (
        <Figure id="live-days" title={t('cogitaViewsRewards.live.fig.days')} says={t('cogitaViewsRewards.live.fig.lastDays', { count: range })} table={table(dayPoints, t('cogitaViewsRewards.live.fig.points'))}>
          <Columns points={dayPoints} name={t('cogitaViewsRewards.live.fig.days')} emphasize={dayPoints.length - 1} pulse={pulse} />
        </Figure>
      )}
      {show('goal') && shape === 'full' && (
        <Figure id="live-goal" title={t('cogitaViewsRewards.live.fig.goal', { amount: g.amount, unit: GOAL_UNIT_LABEL[g.unit] })} says={t('cogitaViewsRewards.live.fig.goalSays')} table={table(goalPoints, GOAL_UNIT_LABEL[g.unit])}>
          <Columns points={goalPoints} name={t('cogitaViewsRewards.live.fig.goalName', { unit: GOAL_UNIT_LABEL[g.unit] })} emphasize={goalPoints.length - 1} rule={{ value: g.amount, label: t('cogitaViewsRewards.live.fig.goalRule') }} pulse={pulse} />
        </Figure>
      )}
      {show('knowledge') && shape === 'full' && (
        cards === null || byCard === null ? <Loading lines={2} label={t('cogitaViewsRewards.live.countingCards')} /> : <KnowledgeStats lib={lib} cards={cards} answers={byCard} spacing={learner === null ? undefined : spacingFor(lib, learner)} />
      )}
    </div>
  );
}
