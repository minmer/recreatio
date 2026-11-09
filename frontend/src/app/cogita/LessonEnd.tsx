/**
 * 2026-11-01 — DAS ENDE EINER LEKTION (Lemma): was der Lauf gebracht hat — wie viele Karten erledigt, wie viele beim
 * ersten Mal sassen, wie lange gelernt wurde —, die Karten, die nicht sassen (falsch, oder nur mit Podpowiedź), mit
 * „Ćwicz te jeszcze raz", und „Następna lekcja", wenn die Powtórka eine nächste nennt (`next`). Die Zahlen rechnet
 * `lessons.ts`; hier wird nur gezeigt.
 */

import { t, useT } from '../core/i18n';
import { TexText } from '../ui/tex/Tex';
import type { Card } from './cardBasics';
import { durationText, type Missed } from './lessons';
import type { LessonProgress } from './revision';
import type { CogitaLibrary } from './store';
import { entityNameTex } from './ui';
import './lessons.css';

/** Was eine Karte fragt, als eine Zeile mit ihren Wzory (`$…$`) — für die Liste am Ende. */
export function cardTexOf(card: Card, lib: CogitaLibrary | null): string {
  const prompt = (card.answer.form === 'gap' ? card.answer.shown : card.prompt.map((p) => p.text).join(' ')).replace(/\s+/g, ' ').trim();
  const base = prompt !== '' ? prompt : card.entity !== undefined && lib !== null ? entityNameTex(lib, card.entity) : t('cogitaLearnRun.lesson.card');
  return card.label === undefined ? base : `${base}: ${card.label}`;
}

export function LessonSummary({ answers, cards, firstTry, activeMs, done }: {
  answers: number;
  /** Wie viele verschiedene Karten gefragt wurden. */
  cards: number;
  firstTry: number;
  activeMs: number;
  /** Erledigt von allen — nur bei einem Lauf, der von selbst endet. */
  done: LessonProgress | null;
}) {
  const t = useT();
  if (answers === 0) return null;
  return (
    <dl className="cg-lesson-sum" data-lesson-summary="">
      {done !== null && (
        <div data-lesson-done={`${done.done}/${done.total}`}>
          <dt>{t('cogitaLearnRun.lesson.mastered')}</dt>
          <dd>{t('cogitaLearnRun.lesson.masteredOf', { done: done.done, count: done.total })}</dd>
        </div>
      )}
      <div data-lesson-first={`${firstTry}/${cards}`}>
        <dt>{t('cogitaLearnRun.lesson.firstTry')}</dt>
        <dd>{t('cogitaLearnRun.code.of', { k: firstTry, n: cards })}</dd>
      </div>
      <div data-lesson-time={Math.round(activeMs / 1000)}>
        <dt>{t('cogitaLearnRun.lesson.time')}</dt>
        <dd>{durationText(activeMs)}</dd>
      </div>
    </dl>
  );
}

/**
 * DIE KARTEN, DIE NICHT SASSEN — in der Folge, in der es geschah, je mit ✗ (falsch) oder ½ (mit Podpowiedź; das Zeichen
 * und das Wort, nie die Farbe allein), darunter „Ćwicz te jeszcze raz".
 */
export function MissedCards({ lib, missed, onPractice }: {
  lib: CogitaLibrary | null;
  missed: readonly { readonly card: Card; readonly why: Missed }[];
  onPractice?: () => void;
}) {
  const t = useT();
  if (missed.length === 0) return null;
  return (
    <section className="cg-lesson-missed" data-lesson-missed={missed.length} aria-label={t('cogitaLearnRun.lesson.practise')}>
      <h3>{t('cogitaLearnRun.lesson.practiseN', { n: missed.length })}</h3>
      <ul>
        {missed.map(({ card, why }) => (
          <li key={card.key} className={why === 'wrong' ? 'is-wrong' : 'is-hint'} data-missed={why}>
            <span className="cg-lesson-mark" aria-hidden>{why === 'wrong' ? '✗' : '½'}</span>
            <span className="cg-lesson-q"><TexText text={cardTexOf(card, lib)} /></span>
            <span className="cg-lesson-why">{why === 'wrong' ? t('cogitaLearnRun.card.wrong') : t('cogitaLearnRun.lesson.hinted')}</span>
          </li>
        ))}
      </ul>
      {onPractice !== undefined && (
        <button type="button" className="wk-btn" data-lesson-practice="" onClick={onPractice}>
          {t('cogitaLearnRun.lesson.again', { n: missed.length })}
        </button>
      )}
    </section>
  );
}
