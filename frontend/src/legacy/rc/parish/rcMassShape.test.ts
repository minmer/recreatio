/**
 * Welche Gestalt der Baustein bei welcher Groesse annimmt.
 *
 * <b>Warum das geprueft wird und nicht angesehen.</b> Ein Baustein hat auf drei
 * Bildschirmbreiten je ein Dutzend moeglicher Groessen. Die sieht niemand alle
 * durch — und die falsche faellt gerade nicht auf: ein Messplan, der nach der
 * zweiten Zeile aufhoert, sieht vollstaendig aus. Wer ihn liest, kommt um neun
 * und erfaehrt nie, dass es auch achtzehn Uhr gab.
 */

import { rcMassShape, rcMassDays, rcShowsIntentions } from './rcMassShape';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Ein Wiegen: nichts passt darunter ----------------------------------------

ok('Schmaler Streifen zeigt die naechste Messe', rcMassShape(2, 1), 'next');
ok('Ein Feld auch', rcMassShape(1, 1), 'next');

/*
 * Der breite Streifen ist die Vorgabe des Bausteins (4x1). Er zeigt ALLE
 * Uhrzeiten des Tages — ohne Intentionen, aber ohne Luecke.
 */
ok('Breiter Streifen zeigt die Uhrzeiten', rcMassShape(4, 1), 'hours');
ok('Drei Felder breit schon', rcMassShape(3, 1), 'hours');
ok('Sehr breit bleibt Uhrzeiten', rcMassShape(6, 1), 'hours');

// -- Schmal und hoch ----------------------------------------------------------

/*
 * Eine Intention in zwei Feldern Breite bricht auf vier Zeilen um. Dann lieber
 * die Uhrzeiten untereinander — das ist bei dieser Breite die ganze Auskunft,
 * die traegt.
 */
ok('Schmal und hoch wird eine Spalte', rcMassShape(2, 4), 'list');
ok('Auch sehr hoch', rcMassShape(2, 8), 'list');
ok('Ein Feld breit ebenso', rcMassShape(1, 5), 'list');

// -- Mittel und gross ---------------------------------------------------------

ok('Mittel zeigt heute mit Intentionen', rcMassShape(3, 3), 'today');
ok('Die Vorgabe der Intentionen (3x3)', rcMassShape(3, 3), 'today');
ok('Gross zeigt mehrere Tage', rcMassShape(4, 5), 'days');
ok('Sehr gross auch', rcMassShape(6, 8), 'days');

/*
 * DIE FORM ENTSCHEIDET, NICHT DIE FLAECHE.
 *
 * 4x1 und 2x2 haben dieselbe Flaeche und sind zwei verschiedene Orte: in die
 * Zeile gehen Uhrzeiten nebeneinander, in das Quadrat Messen untereinander.
 * Waere hier die Flaeche massgeblich, stuende in einem davon das Falsche.
 */
ok('Gleiche Flaeche, andere Form: Zeile', rcMassShape(4, 1), 'hours');
ok('Gleiche Flaeche, andere Form: Quadrat', rcMassShape(2, 2), 'list');

// -- Unsinnige Angaben duerfen nichts kosten ----------------------------------

/*
 * Aus einer gespeicherten Anordnung kann alles kommen — eine aeltere Fassung,
 * ein Tippfehler von Hand. Eine Null darf keine leere Kachel ergeben.
 */
ok('Null wird wie eins behandelt', rcMassShape(0, 0), 'next');
ok('Negatives auch', rcMassShape(-3, -2), 'next');
ok('Bruchteile werden abgeschnitten', rcMassShape(3.9, 1.9), 'hours');

// -- Wie viele Tage -----------------------------------------------------------

ok('Nur die grosse Gestalt zeigt mehrere Tage', rcMassDays('today', 3), 1);
ok('Der Streifen erst recht nicht', rcMassDays('hours', 1), 1);
ok('Die Spalte auch nicht', rcMassDays('list', 8), 1);

ok('Gross zeigt mehrere', rcMassDays('days', 5), 2);
ok('Hoeher zeigt mehr', rcMassDays('days', 8), 4);

/* Ab irgendwann ist es ein Monatsplan — und den sucht man im Kalender. */
ok('Nach oben gedeckelt', rcMassDays('days', 40), 8);

/* Und niemals weniger als zwei: sonst waere es die mittlere Gestalt. */
ok('Nach unten mindestens zwei', rcMassDays('days', 1), 2);

// -- Intentionen --------------------------------------------------------------

/*
 * Dieselbe Frage stellt die Kachel und die ganze Seite. Zwei Stellen, die sie
 * getrennt beantworten, antworten irgendwann verschieden.
 */
ok('Der Streifen zeigt keine Intentionen', rcShowsIntentions('hours'), false);
ok('Die naechste Messe auch nicht', rcShowsIntentions('next'), false);
ok('Die Spalte auch nicht', rcShowsIntentions('list'), false);
ok('Heute schon', rcShowsIntentions('today'), true);
ok('Mehrere Tage auch', rcShowsIntentions('days'), true);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
