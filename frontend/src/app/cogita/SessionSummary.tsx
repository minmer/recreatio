/**
 * 2026-11-05 (Prompt 17) — DAS ENDE EINES LAUFS IN EINER KARTE: wie viele Karten, wie viele richtig, die Punkte (sie zählen
 * hoch), welche Themen dabei gelernt wurden, wie viele Wiederholungen erledigt sind, wie weit das Tagesziel ist — und „Wróć
 * do mapy", das zur Landschaft führt (dort spielt die Karte ab, was sich änderte).
 *
 * Gerechnet aus den Antworten: ein Thema ist gelernt, wenn alle seine Karten jetzt sitzen (Kenntnis ≥ 1) und zu Beginn des
 * Laufs nicht alle; eine Wiederholung ist erledigt, wenn die Karte zu Beginn fällig war und es jetzt nicht mehr ist.
 */

import { useMemo } from 'react';

import type { Card } from './cardBasics';
import { dueAt, knownessOf, type Mark, type Spacing } from './knowness';
import type { Learner } from './learn';
import type { MotionWords } from './motionWords';
import { cardEntities } from './prerequisites';
import { rewardState, type RewardRules } from './rewards';
import { CountUp } from './RewardViews';

export function SessionSummary({ learner, cards, asked, startedAt, answered, correct, rewards, rename, spacing, onBackToMap, MW }: {
  learner: Learner | null;
  /** Alle Karten, die in diesem Lauf dazugehören (für die Themen). */
  cards: readonly Card[];
  /** Die Schlüssel der gefragten Karten. */
  asked: readonly string[];
  startedAt: number;
  answered: number;
  correct: number;
  rewards: RewardRules | null;
  rename?: (key: string) => string;
  spacing: Spacing;
  onBackToMap?: (() => void) | null;
  MW: MotionWords;
}) {
  const now = Date.now();
  const numbers = useMemo(() => {
    if (learner === null) return { points: null as number | null, topics: 0, reviews: 0, goal: null as { now: number; of: number } | null };
    const marksOf = (c: Card): Mark[] => learner.marks(c.key, c.fingerprint, rename);
    const before = (m: readonly Mark[]) => m.filter((x) => x.at < startedAt);
    const byKey = new Map(cards.map((c) => [c.key, c] as const));
    /* Wiederholungen: zu Beginn fällig, jetzt nicht mehr. */
    let reviews = 0;
    for (const key of asked) {
      const c = byKey.get(key);
      if (c === undefined) continue;
      const was = before(marksOf(c));
      if (was.length === 0) continue;
      const dueThen = dueAt(was, spacing);
      const dueNow = dueAt(marksOf(c), spacing);
      if (dueThen !== null && dueThen <= startedAt && (dueNow === null || dueNow > now)) reviews += 1;
    }
    /* Themen: alle Karten sitzen jetzt, zu Beginn nicht alle. */
    const touched = new Set<string>();
    for (const key of asked) { const c = byKey.get(key); if (c !== undefined) for (const e of cardEntities(c)) touched.add(e); }
    let topics = 0;
    for (const id of touched) {
      const of = cards.filter((c) => cardEntities(c).includes(id));
      if (of.length === 0) continue;
      const knownNow = of.every((c) => knownessOf(marksOf(c), now, spacing) >= 1);
      const knownThen = of.every((c) => knownessOf(before(marksOf(c)), startedAt, spacing) >= 1);
      if (knownNow && !knownThen) topics += 1;
    }
    if (rewards === null) return { points: null, topics, reviews, goal: null };
    const state = rewardState(learner.progress.answers.values(), rewards, now, rename === undefined ? {} : { rename });
    const points = state.events.filter((e) => e.at >= startedAt).reduce((s, e) => s + e.points, 0);
    return { points, topics, reviews, goal: { now: Math.min(state.goalNow, rewards.goal.amount), of: rewards.goal.amount } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal, am Ende
  }, [learner, cards, asked.length, startedAt, rewards, rename, spacing]);
  return (
    <section className="cg-summary" data-session-summary="" aria-label={MW.summaryTitle}>
      <strong>{MW.summaryTitle}</strong>
      <dl className="cg-summary-grid">
        <div data-summary="cards"><dt>{MW.cardsDone(asked.length).replace(/^\d+\s*/, '')}</dt><dd>{asked.length}</dd></div>
        <div data-summary="right"><dt>{MW.labelRight}</dt><dd>{correct}/{answered}</dd></div>
        {numbers.points !== null && <div data-summary="points"><dt>{MW.pointsEarned}</dt><dd>+<CountUp value={numbers.points} from={0} /></dd></div>}
        <div data-summary="topics"><dt>{MW.labelTopics}</dt><dd>{numbers.topics}</dd></div>
        <div data-summary="reviews"><dt>{MW.labelReviews}</dt><dd>{numbers.reviews}</dd></div>
        {numbers.goal !== null && <div data-summary="goal"><dt>{MW.labelGoal}</dt><dd>{numbers.goal.now}/{numbers.goal.of}</dd></div>}
      </dl>
      {onBackToMap != null && <div className="wk-actions"><button type="button" className="wk-btn" onClick={onBackToMap} data-summary-map="">{MW.backToMap}</button></div>}
    </section>
  );
}
