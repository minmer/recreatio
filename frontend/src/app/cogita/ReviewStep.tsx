/**
 * 2026-11-05 (Prompt 23, D4) — DER PRZEGLĄD IN EINEM SCHRITT im Spieler (`reviewStep.ts` rechnet): ein Satz, was geprüft
 * wird, dann jede noch nicht gekonnte Frage der Erzählung einmal (eine falsche kommt in dieser Runde nicht wieder), zuletzt
 * das Ergebnis — „Dalej" geht über „passed" oder „notyet". Die Antworten zählen wie jede andere (dieselbe Karte, dieselbe
 * Geschichte).
 */

import { useState } from 'react';

import type { Card } from './cardBasics';
import { CardFace, type CardStats } from './CardFace';
import type { Outcome } from './check';
import type { Words } from './lang';
import { reviewPlan, reviewResult } from './reviewRound';

export function ReviewStep({ cards, known, threshold, W, onAnswer, onDone, stats }: {
  /** 2026-11-10 — „Statistik dieser Karte" (die Antworten des Lernenden). */
  stats?: (card: Card) => CardStats | null;
  /** Die Karten der Erzählung (jede einmal). */
  cards: readonly Card[];
  /** Sitzt die Karte schon (die Regel des Spielers)? */
  known: (card: Card) => boolean;
  threshold: number;
  W: Words;
  onAnswer: (card: Card, outcome: Outcome, given: unknown) => void;
  onDone: (passed: boolean) => void;
}) {
  /* Was gefragt wird, steht beim Betreten fest (die Kenntnis ändert sich mit jeder Antwort). */
  const [plan] = useState(() => reviewPlan(cards, known));
  const [at, setAt] = useState(-1);
  const [right, setRight] = useState(0);
  const [answered, setAnswered] = useState(false);
  const pct = Math.round(threshold * 100);
  const done = at >= plan.pending.length;
  const result = reviewResult(plan, right, threshold);
  if (plan.pending.length === 0 || done) {
    const r = plan.pending.length === 0 ? reviewResult(plan, 0, threshold) : result;
    return (
      <div className="cg-review-step" data-flow-review-step="result" data-flow-review-passed={r.passed ? '1' : '0'} data-flow-review-share={r.share.toFixed(3)}>
        <p className="cg-run-closing-h">{W.reviewStepHead}</p>
        {plan.pending.length === 0 ? <p>{W.reviewStepNone}</p> : <p>{W.reviewStepScore(r.good, plan.total, Math.round(r.share * 100))}</p>}
        <p className={r.passed ? 'wk-note' : 'cg-muted'}>{r.passed ? W.reviewStepPassed : W.reviewStepNotYet(pct)}</p>
        <div className="wk-actions"><button type="button" className="wk-btn" autoFocus onClick={() => onDone(r.passed)} data-flow-review-go="">{W.goOn}</button></div>
      </div>
    );
  }
  if (at < 0) {
    return (
      <div className="cg-review-step" data-flow-review-step="intro" data-flow-review-ask={plan.pending.length} data-flow-review-total={plan.total}>
        <p className="cg-run-closing-h">{W.reviewStepHead}</p>
        <p>{W.reviewStepIntro(plan.pending.length, plan.total, pct)}</p>
        <div className="wk-actions"><button type="button" className="wk-btn" autoFocus onClick={() => setAt(0)} data-flow-review-start="">{W.reviewStepStart}</button></div>
      </div>
    );
  }
  const card = plan.pending[at]!;
  const nextOne = () => { setAnswered(false); setAt((x) => x + 1); };
  return (
    <div className="cg-review-step" data-flow-review-step="ask" data-flow-review-at={at + 1}>
      <p className="cg-muted" data-flow-review-of="">{W.reviewStepHead} · {W.reviewStepOf(at + 1, plan.pending.length)}</p>
      <CardFace key={`${card.key}:${at}`} card={card} lang={W.lang} stats={stats?.(card) ?? null}
        onAnswered={(outcome, given) => { if (answered) return; setAnswered(true); if (outcome.correct) setRight((x) => x + 1); onAnswer(card, outcome, given); }}
        onNext={nextOne} />
    </div>
  );
}
