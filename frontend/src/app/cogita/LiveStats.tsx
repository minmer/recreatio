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

import { plural } from '../core/plural';
import { Loading } from '../ui/Loading';
import type { Card } from './cardBasics';
import { Columns, Figure, KnowledgeStats, Line, Tiles, type Point } from './KnowCharts';
import { dayStart } from './lessons';
import type { Learner } from './learn';
import { answerIndex } from './measures';
import { GOAL_UNIT_LABEL, lastDays, todayLine, type RewardDay, type RewardRules, type RewardState } from './rewards';
import { useRewards } from './RewardViews';
import type { CogitaLibrary } from './store';
import { percent } from './ui';
import './rewards.css';

export const STATS_PIECES = [
  { value: 'tiles', label: 'Liczby dnia' },
  { value: 'today', label: 'Punkty dziś — wykres' },
  { value: 'days', label: 'Punkty dzień po dniu' },
  { value: 'goal', label: 'Cel dnia dzień po dniu' },
  { value: 'knowledge', label: 'Gdzie są karty (w pełnym widoku)' }
] as const;
export type StatsPiece = (typeof STATS_PIECES)[number]['value'];

const NUM = new Intl.NumberFormat('pl-PL');
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'numeric' });
const DAY_NAME = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });

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
  const { state, fresh } = useRewards(learner, rules, { ...(keys === undefined ? {} : { keys }), ...(rename === undefined ? {} : { rename }), live: true });
  const [range, setRange] = useState(14);
  const show = (p: StatsPiece) => hidden === undefined || !hidden.has(p);
  const now = Date.now();
  const byDay = useMemo(() => (state === null ? new Map<number, number>() : pointsByDay(state)), [state]);
  const answered = learner?.progress.answers.size ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mit jeder Antwort
  const byCard = useMemo(() => (learner === null ? null : answerIndex(learner.progress, rename)), [learner, rename, answered]);
  if (state === null) return <Loading lines={2} label="Liczenie statystyk…" />;

  const today = state.today;
  const todayPoints = byDay.get(today.day) ?? 0;
  const accuracy = today.answers === 0 ? null : today.correct / today.answers;
  const g = rules.goal;
  const pulse = fresh.events.some((e) => e.at >= today.day) ? fresh.seq : 0;

  if (shape === 'strip') {
    return (
      <div className="cg-live-stats" data-live-stats="strip">
        <p className="cg-live-line" data-live-today={todayPoints}>
          <span className="cg-live-dot">na żywo</span>
          <span>Dziś <strong>+{NUM.format(todayPoints)}</strong> pkt</span>
          <span><strong>{today.answers}</strong> {plural(today.answers, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}</span>
          <span>trafność <strong>{accuracy === null ? '—' : percent(accuracy)}</strong></span>
          <span>cel <strong>{Math.min(state.goalNow, g.amount)}/{g.amount}</strong></span>
        </p>
      </div>
    );
  }

  const line = todayLine(state, now);
  const todayPoints2: Point[] = line.length === 0 ? [] : [
    { key: 'start', axis: 'start', value: 0, tip: [['0 pkt', 'na początku dnia']] },
    ...line.map((p, i): Point => ({ key: `t${i}`, axis: TIME.format(new Date(p.at)), value: p.total, tip: [[`${NUM.format(p.total)} pkt`, `o ${TIME.format(new Date(p.at))}`], [`+${NUM.format(p.points)}`, 'za tę odpowiedź']] }))
  ];
  const list = lastDays(state, now, range);
  const dayPoints: Point[] = list.map((d) => ({
    key: String(d.day), axis: DATE.format(new Date(d.day)), value: byDay.get(d.day) ?? 0,
    tip: [[`${NUM.format(byDay.get(d.day) ?? 0)} pkt`, DAY_NAME.format(new Date(d.day))], [String(d.answers), plural(d.answers, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')]]
  }));
  const goalPoints: Point[] = list.map((d) => ({
    key: String(d.day), axis: DATE.format(new Date(d.day)), value: unitValue(d, g.unit),
    tip: [[`${NUM.format(unitValue(d, g.unit))} ${GOAL_UNIT_LABEL[g.unit]}`, DAY_NAME.format(new Date(d.day))], [d.met ? '✓' : '—', d.met ? 'cel osiągnięty' : `cel: ${g.amount}`]]
  }));
  const table = (rows: readonly Point[], head: string) => (
    <table className="cg-table cg-stats-table"><thead><tr><th>Kiedy</th><th>{head}</th></tr></thead>
      <tbody>{rows.map((p) => <tr key={p.key}><td>{p.axis}</td><td>{NUM.format(p.value)}</td></tr>)}</tbody></table>
  );
  const chips = (
    <div className="cg-chips" role="radiogroup" aria-label="Okres">
      {[7, 14, 30].map((d) => (
        <button key={d} type="button" role="radio" aria-checked={d === range} className={`cg-chip${d === range ? ' is-on' : ''}`} data-live-range={d} onClick={() => setRange(d)}>{d} dni</button>
      ))}
    </div>
  );

  return (
    <div className="cg-live-stats cg-stats" data-live-stats={shape} data-live-today={todayPoints}>
      <div className="cg-live-head">
        <span className="cg-live-dot">na żywo</span>
        {shape === 'full' && (show('days') || show('goal')) && chips}
      </div>
      {show('tiles') && (
        <div key={pulse} className={pulse > 0 ? 'cg-live-tiles is-fresh' : 'cg-live-tiles'}>
          <Tiles tiles={[
            { key: 'points', label: 'Punkty dziś', value: `+${NUM.format(todayPoints)}`, sub: `razem ${NUM.format(state.total)}` },
            { key: 'answers', label: 'Odpowiedzi dziś', value: NUM.format(today.answers), sub: `${today.cards} ${plural(today.cards, 'karta', 'karty', 'kart')}` },
            { key: 'accuracy', label: 'Trafność dziś', value: accuracy === null ? '—' : percent(accuracy), sub: `${today.correct} dobrze` },
            { key: 'goal', label: 'Cel dnia', value: `${NUM.format(Math.min(state.goalNow, g.amount))}/${NUM.format(g.amount)}`, sub: GOAL_UNIT_LABEL[g.unit] },
            { key: 'streak', label: 'Seria', value: `${state.streak} ${plural(state.streak, 'dzień', 'dni', 'dni')}`, sub: state.streakToday ? 'dziś już się liczy' : state.atRisk ? 'ucz się dziś' : `najdłuższa: ${state.best}` }
          ]} />
        </div>
      )}
      {show('today') && (
        <Figure id="live-today" title="Punkty dziś" says="odpowiedź po odpowiedzi — rośnie na żywo" table={todayPoints2.length === 0 ? undefined : table(todayPoints2, 'Punkty razem')}>
          {todayPoints2.length === 0 ? <p className="cg-muted">Dziś jeszcze bez punktów — pierwsza odpowiedź narysuje linię.</p>
            : <Line points={todayPoints2} name="Punkty dziś, odpowiedź po odpowiedzi" max={todayPoints2[todayPoints2.length - 1]!.value} pulse={pulse} />}
        </Figure>
      )}
      {show('days') && shape === 'full' && (
        <Figure id="live-days" title="Punkty dzień po dniu" says={`ostatnie ${range} dni`} table={table(dayPoints, 'Punkty')}>
          <Columns points={dayPoints} name="Punkty dzień po dniu" emphasize={dayPoints.length - 1} pulse={pulse} />
        </Figure>
      )}
      {show('goal') && shape === 'full' && (
        <Figure id="live-goal" title={`Cel dnia: ${g.amount} ${GOAL_UNIT_LABEL[g.unit]}`} says="linia przerywana — cel" table={table(goalPoints, GOAL_UNIT_LABEL[g.unit])}>
          <Columns points={goalPoints} name={`Cel dnia dzień po dniu (${GOAL_UNIT_LABEL[g.unit]})`} emphasize={goalPoints.length - 1} rule={{ value: g.amount, label: 'cel' }} pulse={pulse} />
        </Figure>
      )}
      {show('knowledge') && shape === 'full' && (
        cards === null || byCard === null ? <Loading lines={2} label="Liczenie kart…" /> : <KnowledgeStats lib={lib} cards={cards} answers={byCard} />
      )}
    </div>
  );
}
