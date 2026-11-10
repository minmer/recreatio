/**
 * 2026-11-05 (Prompt 23, D4) — DER PRZEGLĄD IN EINEM SCHRITT, ohne Oberfläche (`flow.ts` `reviewOf`, gespielt von
 * `ReviewStep.tsx`, nachgemessen in `scripts/app-review-step-check.mjs`):
 * <code>
 *   Fragen     die verschiedenen Karten der Frage-Schritte des Ablaufs ("of": "story") oder eines anderen ("of": "@…")
 *   gefragt    nur, was noch nicht sitzt (die Regel des Spielers: Gekonntes wird nicht gefragt) — jede einmal je Runde,
 *              eine falsche kommt in dieser Runde nicht wieder
 *   Ergebnis   (vorher gekonnt + jetzt richtig) / alle ≥ "threshold" → „passed", sonst „notyet"; ohne Fragen: „passed"
 * </code>
 */

import type { Card } from './cardBasics';
import { cardsInFlow } from './flowAsk';
import type { Flow, ReviewConfig } from './flow';
import { reviewQuestionSteps } from './mountain';

/**
 * Die Karten, die der Przegląd prüft (in der Reihenfolge der Schritte). `step`: der Schritt des Przeglądu in `flow` — liegt er in
 * einem Zweig einer Gabelung, prüft er dessen Pflichtfragen (mit den gemeinsamen davor); ohne ihn wie bisher.
 */
export function reviewCards(flow: Flow, rc: Pick<ReviewConfig, 'of'>, cardOf: (id: string) => Card | null, flows: (ref: string) => Flow | undefined, step?: string): Card[] {
  const target = rc.of === 'story' || rc.of === '' ? flow : flows(rc.of) ?? flow;
  /*
    2026-11-06 — mit Wahlen: nur die Pflichtfragen (auf jedem Weg) — derselbe Przegląd, welcher Weg auch gewählt wurde (`mountain.ts`).
    2026-11-10 — in einem Zweig einer Gabelung: die Pflichtfragen dieses Zweiges (eine andere Erzählung: ihre gemeinsamen).
  */
  const counted = reviewQuestionSteps(target, target.id === flow.id ? step : undefined);
  return cardsInFlow({ ...target, graph: { ...target.graph, nodes: target.graph.nodes.filter((n) => n.type !== 'question' || counted.has(n.id)) } }, cardOf);
}

export interface ReviewPlan {
  readonly total: number;
  readonly knownBefore: number;
  /** Was gefragt wird (noch nicht gekonnt). */
  readonly pending: readonly Card[];
}

export function reviewPlan(cards: readonly Card[], known: (card: Card) => boolean): ReviewPlan {
  const pending = cards.filter((c) => !known(c));
  return { total: cards.length, knownBefore: cards.length - pending.length, pending };
}

export interface ReviewResult {
  readonly share: number;
  readonly passed: boolean;
  /** Wie viele jetzt sitzen (vorher gekonnt + richtig beantwortet). */
  readonly good: number;
}

/** Das Ergebnis einer Runde. `right`: wie viele der gefragten Karten richtig beantwortet wurden. */
export function reviewResult(plan: ReviewPlan, right: number, threshold: number): ReviewResult {
  if (plan.total === 0) return { share: 1, passed: true, good: 0 };
  const good = Math.min(plan.total, plan.knownBefore + Math.max(0, right));
  const share = good / plan.total;
  return { share, passed: share + 1e-9 >= threshold, good };
}
