/**
 * 2026-11-01 (Lemma, 2.11) — DAS TAGESZIEL eines Lernenden: wie viele Karten heute (von wie vielen), wie viele Tage
 * hintereinander das Ziel galt, und die letzten sieben Tage — jeder Tag mit einem Zeichen (✓ erreicht, ◐ angefangen,
 * · nichts), nie nur mit Farbe. Nur, wenn die Baza „Serie dni nauki" gewählt hat (Ustawienia → Motywacja); jeder sieht
 * nur seine eigenen Tage — Ranglisten gibt es nur in Sitzungen.
 */

import { plural } from '../core/plural';
import { renamer, type Learner } from './learn';
import { DEFAULT_DAILY_GOAL, goalState } from './lessons';
import type { CogitaLibrary } from './store';
import { Bar } from './ui';
import './lessons.css';

const WEEKDAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const DAY_NAME = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

export function DailyGoal({ lib, learner, compact = false }: {
  lib: CogitaLibrary;
  /** Wessen Tage — ohne Lernenden (noch nicht geladen) nichts. */
  learner: Learner | null;
  /** Am Ende einer Powtórka: eine Zeile und die Woche, ohne Überschrift. */
  compact?: boolean;
}) {
  const settings = lib.settings();
  if (settings.motivation !== 'streaks' || learner === null) return null;
  const s = goalState(learner.progress.answers.values(), settings.dailyGoal ?? DEFAULT_DAILY_GOAL, Date.now(), renamer(lib.merges()));
  const reached = s.today >= s.goal;
  const cards = (n: number) => `${n} ${plural(n, 'karta', 'karty', 'kart')}`;
  return (
    <section className={`cg-goal${compact ? ' is-compact' : ''}`} data-daily-goal={`${s.today}/${s.goal}`} data-streak={s.streak} aria-label="Cel dzienny">
      {!compact && <h3 className="cg-goal-title">Cel dzienny</h3>}
      <div className="cg-goal-row">
        <Bar value={Math.min(1, s.today / s.goal)} label="Cel dzienny" />
        <span>
          <strong>Dziś {s.today} z {s.goal}</strong>
          {reached ? <span className="cg-goal-done"> · <span aria-hidden>✓ </span>cel osiągnięty</span> : <span className="cg-muted"> · jeszcze {cards(s.goal - s.today)}</span>}
        </span>
        <span className="cg-goal-streak" data-goal-streak={s.streak}>
          Seria: {s.streak} {plural(s.streak, 'dzień', 'dni', 'dni')} z rzędu
        </span>
      </div>
      <ol className="cg-goal-week" aria-label="Ostatnie 7 dni">
        {s.week.map((d, i) => {
          const state = d.met ? 'met' : d.cards > 0 ? 'some' : 'none';
          const said = `${DAY_NAME.format(new Date(d.day))}: ${cards(d.cards)}${d.met ? ' — cel osiągnięty' : ''}`;
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
