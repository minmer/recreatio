/**
 * Die Bewegung durch die Messen beim schnellen Eintragen.
 *
 * <b>Warum das geprueft wird.</b> Die Kanzlei tippt einen Stapel Zettel am
 * Stueck ab, und der Stapel endet nicht mit dem Tag. Bleibt die Bewegung an
 * der Tagesgrenze stehen, muss nach jeder siebten Intention zur Maus gegriffen
 * werden — und dann wird der Modus nicht benutzt, sondern umgangen.
 *
 * Der Fehler faellt dabei nicht als Fehler auf: es sieht aus, als sei der Tag
 * eben zu Ende. Dass es weitergehen SOLLTE, sieht man der Oberflaeche nicht an.
 */

import { rcFirstOnOrAfter, rcPositionInDay } from './rcMass';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/*
 * Ein Fenster, wie es wirklich aussieht: ein voller Sonntag, ein magerer
 * Montag, ein leerer Dienstag, ein Mittwoch.
 *
 * Die Zeiten stehen als „Z", weil der Dienst sie so herausgibt; die Gruppierung
 * rechnet in Ortszeit, und beides muss zusammenpassen.
 */
const mass = (startsUtc: string) => ({
  itemId: 'i', startsUtc, endsUtc: startsUtc, itemType: 'mass', duties: [],
  title: null, location: null, status: 'confirmed', intentions: []
});

const plan = [
  mass('2026-09-06T05:00:00Z'),  // Sonntag, drei Messen
  mass('2026-09-06T07:00:00Z'),
  mass('2026-09-06T16:00:00Z'),
  mass('2026-09-07T16:00:00Z'),  // Montag, eine
  // Dienstag: keine
  mass('2026-09-09T16:00:00Z')   // Mittwoch, eine
];

// -- Ueber die Tagesgrenze -----------------------------------------------------

ok('Der erste des ersten Tages', rcFirstOnOrAfter(plan, '2026-09-06'), 0);

/*
 * DAS IST DER FALL, UM DEN ES GEHT.
 *
 * Nach der letzten Messe des Sonntags (Index 2) kommt nicht „nichts", sondern
 * die erste des Montags.
 */
ok('Nach dem Sonntag kommt der Montag', rcFirstOnOrAfter(plan, '2026-09-07'), 3);

/*
 * Und ein LEERER Tag haelt die Reihe nicht an. Wer am Montag fertig ist,
 * springt ueber den Dienstag hinweg auf den Mittwoch — ein Tag ohne Messe ist
 * keine Station, an der man haelt.
 */
ok('Ein leerer Tag wird uebersprungen', rcFirstOnOrAfter(plan, '2026-09-08'), 4);

ok('Der letzte Tag findet sich selbst', rcFirstOnOrAfter(plan, '2026-09-09'), 4);

/* Am Ende ist Ende — und das sagt sich als -1, nicht als 0. */
ok('Hinter dem letzten Tag ist nichts mehr', rcFirstOnOrAfter(plan, '2026-09-10'), -1);
ok('Ein leeres Fenster ergibt nichts', rcFirstOnOrAfter([], '2026-09-06'), -1);

/* Ein Tag VOR dem Fenster trifft dessen Anfang und faellt nicht durch. */
ok('Davor trifft den Anfang', rcFirstOnOrAfter(plan, '2026-01-01'), 0);

// -- Die Stelle im Tag ---------------------------------------------------------

/*
 * Gezaehlt wird im TAG, nicht im Fenster. „14 z 96" sagt niemandem etwas;
 * „2 z 3" sagt, wie viel von diesem Tag noch aussteht.
 */
ok('Erste von drei', rcPositionInDay(plan, 0), { at: 1, of: 3 });
ok('Zweite von drei', rcPositionInDay(plan, 1), { at: 2, of: 3 });
ok('Dritte von drei', rcPositionInDay(plan, 2), { at: 3, of: 3 });

/* Der naechste Tag faengt wieder bei eins an — nicht bei vier. */
ok('Der Montag beginnt bei eins', rcPositionInDay(plan, 3), { at: 1, of: 1 });
ok('Der Mittwoch auch', rcPositionInDay(plan, 4), { at: 1, of: 1 });

/* Unsinnige Stellen kosten nichts. */
ok('Vor dem Anfang', rcPositionInDay(plan, -1), { at: 0, of: 0 });
ok('Hinter dem Ende', rcPositionInDay(plan, 99), { at: 0, of: 0 });
ok('Leeres Fenster', rcPositionInDay([], 0), { at: 0, of: 0 });

// -- Ergebnis ------------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
