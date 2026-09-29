/**
 * DRINGLICHKEIT — wie weit eine Aufgabe ihrer Zeit nachläuft.
 *
 * Eine Aufgabe hat einen Anfang und ein Ende: ab wann sie getan werden kann,
 * und wann sie getan sein soll. Dazwischen steigt die Dringlichkeit gleichmäßig
 * von 0 auf 1 — zu Beginn ist nichts eilig, am Ende ist es fällig.
 *
 * Nach dem Ende hört sie NICHT auf zu steigen, und das ist der ganze Sinn:
 * etwas, das seit einer Woche überfällig ist, muss lauter sein als etwas, das
 * gerade erst fällig wurde. Sie wächst dort linear weiter, und zwar IM MASS DES
 * EIGENEN FENSTERS — ein ganzer Punkt je Fensterlänge.
 *
 * Damit überholt das Kurze das Lange, und so soll es sein. Wer eine enge Zeit
 * setzt, sagt damit: genau dann. Ein Gebet mit einem Fenster von fünfzehn
 * Minuten ist eine Stunde später vier Fenster zu spät; eine Aufgabe, die einen
 * Monat Zeit hatte, ist nach derselben Stunde kaum vom Termin entfernt. Im
 * Augenblick des Verpassens steht das Kurze noch unten — es überholt erst,
 * wenn genug von SEINER Zeit verstrichen ist, und das ist der Punkt, an dem es
 * wirklich drängt.
 */

/**
 * Das kürzeste Fenster, mit dem gerechnet wird.
 *
 * Eine Aufgabe „um 21:00" hat gar kein Fenster; ohne Untergrenze wäre die
 * Teilung unendlich. Eine Minute ist auch sonst das Kleinste, was die Liste
 * unterscheidet (siehe `windowState`).
 */
export const MIN_SPAN_MS = 60 * 1000;

/** Ab hier ist etwas fällig; darunter liegt es noch in seinem Fenster. */
export const DUE = 1;

export type UrgencyLevel = 'later' | 'soon' | 'due' | 'late' | 'overdue';

/**
 * Die Zahl selbst.
 *
 * <code>
 *   vor dem Anfang   0
 *   im Fenster       0 → 1, gleichmäßig
 *   nach dem Ende    1 + (wie lange zu spät) / (Fensterlänge), ohne Obergrenze
 * </code>
 *
 * Ohne Obergrenze heisst: die Zahl darf gross werden. Sie wird nirgends
 * angezeigt — sie ordnet die Liste und färbt den Balken; was dasteht, ist die
 * Zeit in Worten.
 */
export function urgency(startMs: number, endMs: number, nowMs: number): number {
  const end = Math.max(endMs, startMs);

  if (nowMs >= end) return DUE + (nowMs - end) / Math.max(end - startMs, MIN_SPAN_MS);
  if (nowMs <= startMs) return 0;

  return (nowMs - startMs) / (end - startMs);
}

/**
 * Dieselbe Zahl in Worten, für Farbe und Reihenfolge in der Liste.
 *
 * Die Schwellen sind Anteile des Fensters, nicht Minuten: bei einer Aufgabe
 * über zwei Wochen ist „bald" etwas anderes als bei einem Gebet um 21:00, und
 * beides soll sich richtig anfühlen. `overdue` heisst darum: ein ganzes
 * Fenster zu spät — bei der Viertelstunde eine Viertelstunde, beim Monat ein
 * Monat.
 */
export function levelOf(value: number): UrgencyLevel {
  if (value >= DUE + 1) return 'overdue';
  if (value >= DUE) return 'late';
  if (value >= 0.75) return 'due';
  if (value >= 0.35) return 'soon';
  return 'later';
}

/** Wie viele ganze Fenster zu spät — 0, solange noch Zeit ist. */
export function spansLate(value: number): number {
  return value <= DUE ? 0 : value - DUE;
}
