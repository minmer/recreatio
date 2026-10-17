/**
 * 0099 — wie viele eine Funktion an einem Termin nehmen: Schlüssel `Tag|Funktion`.
 *
 * 2026-10-17 — aus `TaskCard.tsx` hierher (dort weitergereicht): wer nur die
 * Zählung brauchte, lud die ganze Karte mit dem Kalender mit.
 */

import type { DutyTaken } from './steps';

export type TakenMap = ReadonlyMap<string, number>;

export const takenKey = (day: string, dutyId: string): string => `${day}|${dutyId}`;

/** Die Zählung des Dienstes (je Aufgabe, Tag, Funktion) für eine Aufgabe. */
export const takenOf = (taken: readonly DutyTaken[] | undefined, stepId: string): TakenMap =>
  new Map((taken ?? []).filter((t) => t.stepId === stepId).map((t) => [takenKey(t.day, t.dutyId), t.count] as const));
