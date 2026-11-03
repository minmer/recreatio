/**
 * 2026-11-03 (G) — WORAUF EIN BAUSTEIN EINER ERZÄHLUNG ANTWORTET (eine Frage, ein Labor mit Ziel, ein Bild zum Anfassen
 * mit Ziel), damit die Antwort in Cogita zählt:
 * <code>
 *   "question": "@kurs/pytanie-1"   eine echte Frage der Baza (Kennung oder @name): die Antwort liegt auf IHRER Karte —
 *                                   sie zählt für das, worüber die Frage ist, und teilt die Geschichte der Karte mit den
 *                                   Powtórki
 *   "about": ["@kurs/temat-a"]      die eigene Karte des Bausteins (wie bisher), die zusätzlich für diese Einträge zählt
 *   nichts davon                    wie bisher: die eigene Karte des Bausteins (Tore lesen „odpowiedziano dobrze")
 * </code>
 * Ausserhalb einer Erzählung mit Baza bleibt alles wie bisher.
 */

import { useContext, useRef } from 'react';

import type { Card } from '../../cogita/cardBasics';
import { ShowArrival, StoryContext, type StoryRun } from './showContext';

/** Die Zeilen eines Feldes „about" (eine je Zeile, oder durch Kommas). */
export const aboutOf = (raw: string | undefined): string[] =>
  (raw ?? '').split(/[\n,]/).map((x) => x.trim()).filter((x) => x !== '');

export function storyCard(story: StoryRun | null, own: Card | null, question: string, about: readonly string[]): Card | null {
  const ref = question.trim();
  if (ref !== '' && story?.card !== undefined) {
    const real = story.card(ref);
    if (real !== null) return real;
  }
  if (own === null) return null;
  const ids = story?.resolve === undefined ? [] : about.map((a) => story.resolve!(a)).filter((x): x is string => x !== null);
  return ids.length === 0 ? own : { ...own, about: [...new Set([...(own.about ?? []), ...ids])] };
}

/** Die eigene Karte eines Ziels (Labor, Bild zum Anfassen): erreicht = richtig. */
export function goalCard(moduleId: string, label: string): Card {
  return {
    question: moduleId, direction: 'goal', key: `${moduleId}|goal`, prompt: [{ text: label }], answer: { form: 'flash', back: ['✓'] },
    explain: [], fingerprint: 'goal', varies: false, requires: []
  };
}

/**
 * EIN ZIEL, DAS ZÄHLT (ein Labor, ein Bild zum Anfassen): in einer Erzählung — einmal je Ankunft an der Szene — die
 * Antwort „richtig" auf der Karte, die `question`/`about` des Bausteins nennen (sonst seine eigene Karte des Ziels).
 * Ausserhalb einer Erzählung: nichts (`undefined`).
 */
export function useStoryGoal(question: string, about: readonly string[], moduleId: string, label: string): (() => void) | undefined {
  const story = useContext(StoryContext);
  const arrival = useContext(ShowArrival);
  const last = useRef<number | null>(null);
  if (story === null) return undefined;
  return () => {
    if (last.current === arrival) return;
    last.current = arrival;
    const card = storyCard(story, goalCard(moduleId, label), question, about);
    if (card !== null) story.record(card, 1);
  };
}
