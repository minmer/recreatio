/**
 * 2026-11-22 (Homer) — EIN ITEM AUF DEM TELEFON (allein, in der Reihenfolge des Selbststudiums): eine Erzählung im Spieler
 * eines Lernenden, Fragen nacheinander (sie zählen, mit Erklärung nach jeder), eine offene Frage (≤ 80 Zeichen, nie bewertet),
 * eine Umfrage (eine von N, nie bewertet). Jede Antwort meldet sich als Fortschritt OHNE ihren Text (`report`); nur bei einer
 * Frage „Zaznacz wersy" gehen die gewählten Zeilennummern mit (für die Wärmekarte der Leinwand).
 */

import { useMemo, useState } from 'react';

import { useT } from '../../core/i18n';
import { TexText } from '../../ui/tex/Tex';
import { answerSignals } from '../adaptive';
import { CardFace } from '../CardFace';
import type { Card } from '../cardBasics';
import { checkCard } from '../cards';
import { FlowPlayer, type FlowContent } from '../FlowPlayer';
import type { Learner } from '../learn';
import { isPredict } from '../modes';
import type { CogitaLibrary } from '../store';
import type { Progress, ProgressResult, UnitItem } from './unitModel';

export type Report = (p: Omit<Progress, 'participant' | 'stage' | 'item' | 'at'>) => void;

export const resultOf = (correctness: number): ProgressResult => (correctness >= 1 ? 'right' : correctness > 0 ? 'partial' : 'wrong');

/** Die gewählten Zeilen einer Frage „lines" (Fork A: `given` ist eine Liste von Zeilennummern). */
const linesOf = (card: Card, given: unknown): number[] | undefined =>
  ((card.answer.form as string) === 'lines' || (card.answer.form as string) === 'span') && Array.isArray(given) ? given.filter((n): n is number => typeof n === 'number' && Number.isInteger(n)).slice(0, 200) : undefined;

/** Was eine Antwort meldet: richtig/teilweise/falsch, der erste benannte Fehler, die Zeilen einer Wers-Aufgabe. */
export function answerReport(card: Card, data: Readonly<Record<string, unknown>> | null, given: unknown, correctness: number, step: string, predict = false): Omit<Progress, 'participant' | 'stage' | 'item' | 'at'> {
  let tag: string | undefined;
  try { tag = correctness >= 1 ? undefined : answerSignals(card, data, given, checkCard(card, given)).tags[0]; } catch { tag = undefined; }
  const lines = linesOf(card, given);
  return { what: 'answer', step, result: resultOf(correctness), ...(tag === undefined || tag === '' ? {} : { tag }), ...(lines === undefined ? {} : { lines, card: card.key }), ...(predict ? { predict: true } : {}) };
}

export function ItemRun({ item, lib, content, cards, learner, via, report, onDone, onPrompt }: {
  item: UnitItem;
  lib: CogitaLibrary;
  content: FlowContent;
  cards: readonly Card[];
  learner: Learner | null;
  via: string;
  report: Report;
  onDone: () => void;
  onPrompt: (answer: { text?: string; choice?: number }) => void;
}) {
  if (item.kind === 'flow') {
    const flow = content.flow(item.flow);
    if (flow === undefined) return <MissingItem onDone={onDone} />;
    return (
      <FlowPlayer flow={flow} content={content} learner={learner} gate={false} mode="self" endToClose onClose={onDone}
        jumpTo={item.start === undefined ? null : { step: item.start.step, at: 1, ...(item.start.exit === undefined ? {} : { exit: item.start.exit }) }}
        onAnswer={(step, card, correctness, given) => {
          const node = flow.graph.nodes.find((n) => n.id === step);
          report(answerReport(card, lib.entity(card.question)?.data ?? null, given, correctness, step, node !== undefined && isPredict(node)));
        }} />
    );
  }
  if (item.kind === 'questions') return <QuestionsRun questions={item.questions} lib={lib} cards={cards} learner={learner} via={via} report={report} onDone={onDone} />;
  if (item.kind === 'prompt') return <PromptRun item={item} onSend={(text) => { onPrompt({ text }); onDone(); }} />;
  return <PollRun item={item} onSend={(choice) => { onPrompt({ choice }); onDone(); }} />;
}

function MissingItem({ onDone }: { onDone: () => void }) {
  const t = useT();
  return <div className="cg-unit-missing"><p className="cg-muted">{t('cogitaUnit.play.missing')}</p><button type="button" className="wk-btn wk-btn-line" onClick={onDone}>{t('common.next')}</button></div>;
}

function QuestionsRun({ questions, lib, cards, learner, via, report, onDone }: {
  questions: readonly string[]; lib: CogitaLibrary; cards: readonly Card[]; learner: Learner | null; via: string; report: Report; onDone: () => void;
}) {
  const t = useT();
  const list = useMemo(() => questions.map((q) => cards.find((c) => c.key === q || c.question === q)).filter((c): c is Card => c !== undefined), [questions, cards]);
  const [at, setAt] = useState(0);
  const card = list[at];
  if (list.length === 0) return <MissingItem onDone={onDone} />;
  if (card === undefined) return null;
  return (
    <div className="cg-unit-questions" data-unit-question={at}>
      <p className="cg-muted">{t('cogitaUnit.play.questionOf', { n: at + 1, all: list.length })}</p>
      <CardFace key={card.key} card={card} lib={lib}
        onAnswered={(outcome, given, ms) => {
          const data = lib.entity(card.question)?.data ?? null;
          const r = answerReport(card, data, given, outcome.correctness, card.key);
          learner?.record(card, outcome.correctness, { via, ms, ...(r.tag === undefined ? {} : { tags: [r.tag] }) });
          report(r);
        }}
        onNext={() => { if (at + 1 >= list.length) onDone(); else setAt(at + 1); }} />
    </div>
  );
}

function PromptRun({ item, onSend }: { item: Extract<UnitItem, { kind: 'prompt' }>; onSend: (text: string) => void }) {
  const t = useT();
  const [text, setText] = useState('');
  return (
    <form className="cg-unit-prompt" data-unit-prompt="" onSubmit={(e) => { e.preventDefault(); if (text.trim() !== '') onSend(text.trim().slice(0, item.max)); }}>
      <h3 className="cg-unit-prompt-q"><TexText text={item.prompt} /></h3>
      <input value={text} maxLength={item.max} onChange={(e) => setText(e.target.value)} aria-label={t('cogitaUnit.play.promptLabel')} data-unit-prompt-input="" />
      <p className="cg-muted">{t('cogitaUnit.play.promptSays', { left: item.max - text.length })}{item.anonymous ? ` ${t('cogitaUnit.play.anonymous')}` : ''}</p>
      <button type="submit" className="wk-btn" disabled={text.trim() === ''} data-unit-prompt-send="">{t('cogitaUnit.play.send')}</button>
    </form>
  );
}

function PollRun({ item, onSend }: { item: Extract<UnitItem, { kind: 'poll' }>; onSend: (choice: number) => void }) {
  const t = useT();
  return (
    <div className="cg-unit-poll" data-unit-poll="">
      <h3><TexText text={item.poll} /></h3>
      <p className="cg-muted">{t('cogitaUnit.play.pollSays')}</p>
      <div className="cg-choices cg-choice-list">
        {item.options.map((o, i) => <button key={i} type="button" className="cg-option cg-choice-item" data-unit-poll-option={i} onClick={() => onSend(i)}><TexText text={o} /></button>)}
      </div>
    </div>
  );
}
