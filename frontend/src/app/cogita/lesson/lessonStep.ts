/**
 * 2026-11-22 (Part B) — WAS DER SPIELER DER STUNDE SAGT UND WAS ER VON IHR NIMMT (nur Typen; `FlowPlayer` → `lesson`).
 *
 * Der Leiter spielt die Erzählung mit demselben Spieler wie ein Lernender (ohne eigenen Fortschritt). Der Spieler meldet
 * jeden Schritt (`onStep`) — die Stunde schickt ihn an die Klasse und an die Leinwand —, und er nimmt die Antwort der
 * Klasse (`decide`): bei einer Frage die Antwort selbst (sie wählt den Ausgang wie die eines Lernenden: richtig, falsch,
 * `wrong:<tag>`, `pick:<i>`, und sie steht im Lauf, so dass Bedingungen „session"/„lastAnswer" sie sehen), bei einer
 * Wahl oder Kapiteln den Ausgang.
 */

import type { Card } from '../cardBasics';
import type { PublicEntity } from '../publish';

export interface LessonOption {
  readonly exit: string;
  readonly label: string;
  /** Eine Möglichkeit, deren Bedingung nicht gilt, oder ein Kapitel, das schon durch ist. */
  readonly open: boolean;
}

export type LessonStep =
  | { readonly kind: 'show'; readonly flow: string; readonly step: string; readonly entity: PublicEntity | null; readonly title: string | null }
  /* 2026-11-22 (I3) — `predict`: eine Vorhersage — die Klasse stimmt ab, die Verteilung und die Antwort der Klasse gelten, aber nichts zählt für den Fortschritt. */
  | { readonly kind: 'question'; readonly flow: string; readonly step: string; readonly card: Card; readonly data: Readonly<Record<string, unknown>> | null; readonly predict?: boolean }
  | { readonly kind: 'choice' | 'chapters'; readonly flow: string; readonly step: string; readonly title: string | null; readonly options: readonly LessonOption[] }
  | { readonly kind: 'other'; readonly flow: string; readonly step: string; readonly type: string }
  | { readonly kind: 'end'; readonly flow: string };

export interface LessonDecision {
  readonly step: string;
  readonly at: number;
  /** Bei einer Frage: die Antwort der Klasse. */
  readonly given?: unknown;
  /** Bei einer Wahl oder Kapiteln: der gewählte Ausgang. */
  readonly exit?: string;
}

export interface LessonLink {
  readonly onStep: (step: LessonStep) => void;
  readonly decide: LessonDecision | null;
}
