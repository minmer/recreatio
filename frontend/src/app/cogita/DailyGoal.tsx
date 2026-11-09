/**
 * 2026-11-01 (Lemma, 2.11) — DAS TAGESZIEL eines Lernenden: wie viele Karten heute (von wie vielen), wie viele Tage
 * hintereinander das Ziel galt, und die letzten sieben Tage — jeder Tag mit einem Zeichen (✓ erreicht, ◐ angefangen,
 * · nichts), nie nur mit Farbe. Nur, wenn die Baza „Serie dni nauki" gewählt hat (Ustawienia → Motywacja); jeder sieht
 * nur seine eigenen Tage — Ranglisten gibt es nur in Sitzungen.
 */

import { useT } from '../core/i18n';
import { renamer, type Learner } from './learn';
import { DEFAULT_DAILY_GOAL, goalState } from './lessons';
import type { CogitaLibrary } from './store';
import { Bar } from './ui';
import './lessons.css';


export function DailyGoal({ lib, learner, compact = false }: {
  lib: CogitaLibrary;
  /** Wessen Tage — ohne Lernenden (noch nicht geladen) nichts. */
  learner: Learner | null;
  /** Am Ende einer Powtórka: eine Zeile und die Woche, ohne Überschrift. */
  compact?: boolean;
}) {
  const t = useT();
  const WEEKDAY = new Intl.DateTimeFormat(t.locale, { weekday: 'short' });
  const DAY_NAME = new Intl.DateTimeFormat(t.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const settings = lib.settings();
  if (settings.motivation !== 'streaks' || learner === null) return null;
  const s = goalState(learner.progress.answers.values(), settings.dailyGoal ?? DEFAULT_DAILY_GOAL, Date.now(), renamer(lib.merges()));
  const reached = s.today >= s.goal;
  const cards = (n: number) => t('cogitaLearn.count.cards', { count: n });
  return (
    <section className={`cg-goal${compact ? ' is-compact' : ''}`} data-daily-goal={`${s.today}/${s.goal}`} data-streak={s.streak} aria-label={t('cogitaLearnRun.goal.title')}>
      {!compact && <h3 className="cg-goal-title">{t('cogitaLearnRun.goal.title')}</h3>}
      <div className="cg-goal-row">
        <Bar value={Math.min(1, s.today / s.goal)} label={t('cogitaLearnRun.goal.title')} />
        <span>
          <strong>{t('cogitaLearnRun.goal.today', { k: s.today, n: s.goal })}</strong>
          {reached ? <span className="cg-goal-done"> · <span aria-hidden>✓ </span>{t('cogitaLearnRun.goal.reached')}</span> : <span className="cg-muted">{t('cogitaLearnRun.goal.left', { cards: cards(s.goal - s.today) })}</span>}
        </span>
        <span className="cg-goal-streak" data-goal-streak={s.streak}>
          {t('cogitaLearnRun.goal.streak', { count: s.streak })}
        </span>
      </div>
      <ol className="cg-goal-week" aria-label={t('cogitaLearnRun.goal.week')}>
        {s.week.map((d, i) => {
          const state = d.met ? 'met' : d.cards > 0 ? 'some' : 'none';
          const said = t(d.met ? 'cogitaLearnRun.goal.dayMet' : 'cogitaLearnRun.goal.day', { day: DAY_NAME.format(new Date(d.day)), cards: cards(d.cards) });
          return (
            <li key={d.day} className={`is-${state}${i === s.week.length - 1 ? ' is-today' : ''}`} title={said} data-goal-day={state}>
              <span className="cg-goal-wd" aria-hidden>{WEEKDAY.format(new Date(d.day))}</span>
              <span className="cg-goal-mark" aria-hidden>{d.met ? '✓' : d.cards > 0 ? '◐' : '·'}</span>
              <span className="cg-sr">{said}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
