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

import type { Lang } from './lang';

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
  switch (lang) {
    case 'de': return { hit: 'richtig gewählt', missed: 'übersehen — auch richtig', wrong: 'falsch gewählt', left: 'richtig weggelassen' };
    case 'en': return { hit: 'correctly chosen', missed: 'missed — this is also true', wrong: 'wrongly chosen', left: 'correctly left out' };
    default: return { hit: 'dobrze zaznaczone', missed: 'pominięte — to też prawda', wrong: 'źle zaznaczone', left: 'słusznie pominięte' };
  }
}
