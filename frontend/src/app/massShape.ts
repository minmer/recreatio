/**
 * Wie gross die Kachel ist — und was dann hineinpasst.
 *
 * <b>Eine kleinere Kachel ist nicht dieselbe Ansicht, abgeschnitten.</b> Ein
 * halbierter Messplan lügt: wer „7:00, 9:00" liest, kommt um 9 Uhr und weiss
 * nicht, dass es noch 18:00 gibt. Deshalb zeigt jede Grösse etwas ANDERES und
 * nicht weniger vom Gleichen — eine Zeile blosser Uhrzeiten sagt die Wahrheit,
 * eine nach der zweiten Messe abgebrochene Liste nicht.
 *
 * <b>Die Form zählt mehr als die Fläche.</b> Vier Felder in einer Zeile und
 * vier im Quadrat sind zwei verschiedene Orte: in die Zeile gehen Uhrzeiten
 * nebeneinander, ins Quadrat Messen untereinander. Deshalb entscheidet zuerst
 * die Zahl der Zeilen.
 *
 * Diese Entscheidung steht getrennt vom Zeichnen, weil sie sich nur so prüfen
 * lässt — eine Kachel mit zehn Grössen sieht sich niemand zehnmal an.
 *
 * Übernommen aus `rcMassShape.ts`; die Schwellen sind dort abgelesen und nicht
 * gerundet, und sie hier zu ändern hiesse, sie neu abzulesen.
 */

/** Was die Kachel bei dieser Grösse zeigt. */
export type MassShape =
  /** Die eine nächste Messe: „dziś 18:00". Für Streifen von zwei Feldern. */
  | 'next'
  /** Nur die Uhrzeiten des Tages nebeneinander: „7:00 · 9:00 · 18:00". */
  | 'hours'
  /** Uhrzeiten untereinander, mit Namen — schmale, hohe Kachel. */
  | 'list'
  /** Die Messen des Tages mitsamt Intentionen, je eine Zeile. */
  | 'today'
  /** Mehrere Tage gruppiert, mit Intentionen und dem Hinweis auf Zusammengelegte. */
  | 'days';

export function massShape(colSpan: number, rowSpan: number): MassShape {
  const cols = Math.max(1, Math.trunc(colSpan));
  const rows = Math.max(1, Math.trunc(rowSpan));

  /*
   * EINE ZEILE — darunter ist kein Platz für irgendetwas.
   *
   * Schmal zeigt die nächste Messe, weil eine Uhrzeit das Einzige ist, was
   * hineinpasst und noch zu etwas taugt. Breiter zeigt alle Uhrzeiten des
   * Tages: ohne Intentionen, aber ohne Lücke — und genau das ist der
   * Unterschied zwischen einer Kürzung und einem Verschweigen.
   */
  if (rows <= 1) return cols <= 2 ? 'next' : 'hours';

  /*
   * SCHMAL UND HOCH — die Uhrzeiten gehen in die Spalte. Eine Intention bricht
   * in dieser Breite auf vier Zeilen und ist dann nicht mehr zu lesen.
   */
  if (cols <= 2) return 'list';

  /*
   * MITTEL — ein Tag mit seinen Intentionen. Mehr Tage passen nicht hinein,
   * und ein halb abgeschnittener Tag wäre schlechter als ein ganzer.
   */
  if (rows <= 3) return 'today';

  // GROSS — mehrere Tage, jeder mit seinen Intentionen.
  return 'days';
}

/**
 * Wie viele Tage bei dieser Grösse.
 *
 * Gibt überall dort 1 zurück, wo ohnehin nur heute hineinpasst — so muss der
 * Aufrufer nicht selbst entscheiden, was eine Form bedeutet.
 */
export function massDays(shape: MassShape, rowSpan: number): number {
  if (shape !== 'days') return 1;

  /*
   * Ungefähr zwei Rasterzeilen je Tag: Überschrift und ein paar Messen. Deckel
   * bei acht, denn weiter wird die Kachel zum Monatsplan — und den sucht man
   * im Kalender, nicht auf der Startseite.
   */
  return Math.max(2, Math.min(8, Math.floor(Math.max(1, rowSpan) / 2)));
}

/**
 * Ob bei dieser Form Intentionen zu sehen sind.
 *
 * Getrennt, weil dieselbe Frage die Kachel UND die volle Seite stellen — und
 * zwei Stellen, die dasselbe getrennt beantworten, antworten irgendwann
 * verschieden.
 */
export const showsIntentions = (shape: MassShape): boolean =>
  shape === 'today' || shape === 'days';
