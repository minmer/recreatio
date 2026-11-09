/**
 * 2026-11-04 (Prompt 15) — „KILKA Z KILKU" NACH DER PRÜFUNG: jede Möglichkeit trägt die Entscheidung des Lernenden, nicht
 * nur ihre Wahrheit. Eine richtige, aber nicht gewählte Möglichkeit sah bisher aus wie gewählt (grün mit ✓) — jetzt:
 * <code>
 *   richtig + gewählt        grün   ✓                      'hit'
 *   richtig, nicht gewählt   bernsteinfarben, ohne ✓       'missed'   („pominięte — to też prawda")
 *   falsch + gewählt         rot    ✗                      'wrong'
 *   falsch, nicht gewählt    neutral                       'left'     (klein: „słusznie pominięte")
 * </code>
 * Die Wertung bleibt, wie sie war (`checkMany`). Die Farbe ist nie das einzige Zeichen: jeder Zustand hat sein Wort.
 */

import { tFor, type Lang } from '../core/i18n';

export type ChoiceMark = 'hit' | 'missed' | 'wrong' | 'left';

/** Der Zustand einer Möglichkeit nach der Prüfung — aus „ist richtig" und „wurde gewählt". */
export function choiceMark(right: boolean, chosen: boolean): ChoiceMark {
  if (right) return chosen ? 'hit' : 'missed';
  return chosen ? 'wrong' : 'left';
}

/** Die Klasse der Möglichkeit (`cogita.css`): grün, bernsteinfarben, rot, neutral. */
export const CHOICE_CLASS: Readonly<Record<ChoiceMark, string>> = { hit: ' is-right', missed: ' is-missed', wrong: ' is-wrong', left: ' is-left' };

/** Das Zeichen an der Möglichkeit — eine übersehene trägt kein ✓ (sie wurde nicht gewählt). */
export const CHOICE_GLYPH: Readonly<Record<ChoiceMark, string>> = { hit: '✓', missed: '', wrong: '✗', left: '' };

/** Ob unter der Möglichkeit ihr Satz (`feedback`) steht: unter den gewählten und unter den übersehenen richtigen. */
export const choiceSaid = (mark: ChoiceMark): boolean => mark !== 'left';

/** Die Worte je Zustand, in der Sprache der Baza (`lang.ts`). */
export function choiceWords(lang: Lang): Readonly<Record<ChoiceMark, string>> {
  const t = tFor(lang);
  return { hit: t('cogitaLearn.choice.hit'), missed: t('cogitaLearn.choice.missed'), wrong: t('cogitaLearn.choice.wrong'), left: t('cogitaLearn.choice.left') };
}

/** 2026-11-05 (Durchsicht) — die Zeile unter einer Möglichkeit sagt dem Vorleser in der Sprache der Baza, ob sie stimmt. */
export function answerWords(lang: Lang): { readonly right: string; readonly wrong: string } {
  const t = tFor(lang);
  return { right: t('cogitaLearn.choice.right'), wrong: t('cogitaLearn.choice.wrongAnswer') };
}
