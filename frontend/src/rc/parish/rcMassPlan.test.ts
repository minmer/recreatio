/**
 * Die Wochentagsbits und der Wiederholungstext.
 *
 * <b>Warum gerade das geprueft wird.</b> Eine falsche Bitzuordnung faellt beim
 * Anlegen NICHT auf: der Eintrag entsteht, sieht richtig aus, und die Messe
 * faellt eine Woche spaeter in einer leeren Kirche aus. `Date.getDay()` zaehlt
 * ab Sonntag, der Dienst ab Montag — genau die Sorte Verschiebung, die sechs
 * von sieben Tagen funktioniert.
 */

import {
  RC_SUNDAY_MASK, RC_WEEKDAYS_MASK, RC_WEEKDAY_BITS, rcBitOf, rcDefaultUntil, rcRepeatLabel
} from './rcMassPlan';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Die Bits stimmen mit dem Dienst ueberein ---------------------------------

/*
 * Dieselben Werte stehen in `RcRecurrence.WeekdayBit`. Sie stehen hier als
 * Literale und nicht als zweite Rechnung: eine Pruefung, die dieselbe Formel
 * noch einmal anstellt, prueft nichts.
 */
ok('Montag ist 1', RC_WEEKDAY_BITS[0].bit, 1);
ok('Dienstag ist 2', RC_WEEKDAY_BITS[1].bit, 2);
ok('Mittwoch ist 4', RC_WEEKDAY_BITS[2].bit, 4);
ok('Donnerstag ist 8', RC_WEEKDAY_BITS[3].bit, 8);
ok('Freitag ist 16', RC_WEEKDAY_BITS[4].bit, 16);
ok('Samstag ist 32', RC_WEEKDAY_BITS[5].bit, 32);
ok('Sonntag ist 64', RC_WEEKDAY_BITS[6].bit, 64);

ok('Sieben Tage und nicht mehr', RC_WEEKDAY_BITS.length, 7);
ok('Die Werktagsmaske ist alles ausser Sonntag', RC_WEEKDAYS_MASK, 63);
ok('Und der Sonntag steht allein', RC_SUNDAY_MASK, 64);

// -- Aus einem Datum wird das richtige Bit ------------------------------------

/*
 * Der 7. September 2026 ist ein Montag. Von dort aus die ganze Woche — wenn
 * hier etwas um eins verschoben ist, faellt es genau an einem Tag auf.
 */
ok('Montag', rcBitOf(new Date('2026-09-07T10:00:00')), 1);
ok('Dienstag', rcBitOf(new Date('2026-09-08T10:00:00')), 2);
ok('Mittwoch', rcBitOf(new Date('2026-09-09T10:00:00')), 4);
ok('Donnerstag', rcBitOf(new Date('2026-09-10T10:00:00')), 8);
ok('Freitag', rcBitOf(new Date('2026-09-11T10:00:00')), 16);
ok('Samstag', rcBitOf(new Date('2026-09-12T10:00:00')), 32);

/*
 * DER SONNTAG IST DER FALL, AN DEM ES BRICHT.
 *
 * `getDay()` gibt hier 0. Ohne die Sonderbehandlung ergaebe die Verschiebung
 * `1 << -1` — und das ist in JavaScript nicht null, sondern eine sehr grosse
 * Zahl. Die Reihe faende dann nie einen Tag.
 */
ok('Sonntag', rcBitOf(new Date('2026-09-13T10:00:00')), 64);

/* Und keine Wiederholung ergibt jemals mehr als einen Tag. */
for (const day of ['07', '08', '09', '10', '11', '12', '13']) {
  const bit = rcBitOf(new Date(`2026-09-${day}T10:00:00`));
  ok(`Der ${day}. ergibt genau ein Bit`, (bit & (bit - 1)) === 0 && bit > 0, true);
}

// -- Was der Mensch liest -----------------------------------------------------

const once = {
  date: '2026-09-08', time: '18:00', minutes: 45, titlePublic: '',
  repeat: 'none' as const, weekdays: 0, until: ''
};

ok('Eine einzelne Messe', rcRepeatLabel(once), 'raz, 2026-09-08 o 18:00');

ok('Eine Reihe an drei Tagen',
  rcRepeatLabel({ ...once, repeat: 'weekly', weekdays: 1 + 4 + 16, until: '2026-12-24' }),
  'w pn, śr, pt o 18:00, do 2026-12-24');

/*
 * OHNE ENDE STEHT NICHT „bez końca" — DENN DAS GIBT ES NICHT.
 *
 * Der Kalender verlangt fuer jede Wiederholung ein Ende (ck_rc_item_repeat_end),
 * und der Dienst weist eine ohne mit 400 ab. Der Text hat das eine Weile
 * versprochen: „w nd o 18:00, bez końca". Wer darauf klickte, bekam einen
 * Fehler, den er sich nicht erklaeren konnte.
 *
 * Ein Text, der etwas zusagt, was das System nicht haelt, ist schlimmer als
 * gar keiner.
 */
ok('Ohne Ende sagt der Text, dass es fehlt',
  rcRepeatLabel({ ...once, repeat: 'weekly', weekdays: 64 }),
  'w nd o 18:00, brakuje daty końca');

ok('Taeglich ebenso',
  rcRepeatLabel({ ...once, repeat: 'daily' }),
  'codziennie o 18:00, brakuje daty końca');

ok('Mit Ende steht das Ende',
  rcRepeatLabel({ ...once, repeat: 'daily', until: '2026-12-31' }),
  'codziennie o 18:00, do 2026-12-31');

/* Die Vorgabe ist das Jahresende — der Punkt, an dem ein Plan ohnehin neu entsteht. */
ok('Das vorgeschlagene Ende ist das Jahresende', rcDefaultUntil('2026-09-08'), '2026-12-31');
ok('Auch im Dezember noch dasselbe Jahr', rcDefaultUntil('2026-12-24'), '2026-12-31');
ok('Aus Unsinn wird kein Datum', rcDefaultUntil('kein datum'), '');

/*
 * Eine woechentliche Reihe ohne gewaehlte Tage ist kein Fehler — dann gilt der
 * Tag der ersten Messe. Der Text sagt das, statt eine leere Aufzaehlung zu
 * zeigen, bei der niemand weiss, ob er etwas vergessen hat.
 */
ok('Ohne gewaehlte Tage sagt es der Text',
  rcRepeatLabel({ ...once, repeat: 'weekly', weekdays: 0, until: '2026-12-31' }),
  'w dniu pierwszej mszy o 18:00, do 2026-12-31');

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
