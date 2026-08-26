/**
 * Die Entscheidungen des Kalenders, ohne Browser geprüft.
 *
 * Die interessante davon ist `rcOccurrenceLabel`: sie unterscheidet drei
 * Fälle, die alle „kein Titel" heissen und völlig verschiedenes bedeuten —
 * *dieser Leser hat den Schlüssel nicht*, *es gibt nichts Öffentliches zu
 * sagen*, und *hier steht etwas*. Sie gleich darzustellen wäre die Art
 * Fehler, die niemandem auffällt.
 */

import {
  rcByDay, rcOccurrenceLabel, rcOverlaps, type RcOccurrence
} from './rcCalendar';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

function at(day: number, hour: number, minute = 0): string {
  return new Date(Date.UTC(2026, 2, day, hour, minute)).toISOString();
}

function occ(over: Partial<RcOccurrence> = {}): RcOccurrence {
  return {
    itemId: '0190a1b2-0000-7000-8000-000000000001',
    originalStartUtc: at(2, 8),
    startsUtc: at(2, 8),
    endsUtc: at(2, 9),
    moved: false,
    allDay: false,
    itemType: 'appointment',
    visibility: 'area',
    status: 'planned',
    mine: true,
    ...over
  } as RcOccurrence;
}

// -- Die drei Arten von „kein Titel" -----------------------------------------

ok('Ein entschlüsselter Titel gewinnt',
  rcOccurrenceLabel(occ({ title: 'Gespräch mit Frau K.', titlePublic: 'Sitzung' })),
  { kind: 'named', text: 'Gespräch mit Frau K.', detailed: true });

ok('Ohne Schlüssel bleibt der öffentliche Titel',
  rcOccurrenceLabel(occ({ titlePublic: 'Sitzung', unreadable: 'crypto.missing_epoch' })),
  { kind: 'named', text: 'Sitzung', detailed: false });

// DER Fall: versiegelt UND ohne öffentlichen Titel. Das ist nicht „belegt",
// sondern „hier steht etwas, das du nicht öffnen kannst" — ein Unterschied,
// den die Oberfläche aussprechen muss (15.9).
ok('Versiegelt ohne öffentlichen Titel ist ein eigener Fall',
  rcOccurrenceLabel(occ({ unreadable: 'crypto.missing_epoch' })), { kind: 'sealed' });

// Und das hier ist echtes „belegt": es gibt nichts Verborgenes, nur nichts
// zu sagen.
ok('Kein Titel und nichts versiegelt heisst belegt',
  rcOccurrenceLabel(occ()), { kind: 'busy' });

ok('Ein leerer öffentlicher Titel heisst ebenfalls belegt',
  rcOccurrenceLabel(occ({ titlePublic: '' })), { kind: 'busy' });

ok('Ein öffentlicher Titel allein wird als solcher gekennzeichnet',
  rcOccurrenceLabel(occ({ titlePublic: 'Sitzung' })),
  { kind: 'named', text: 'Sitzung', detailed: false });

// -- Überschneidungen ---------------------------------------------------------

ok('Zwei getrennte Termine überschneiden sich nicht',
  rcOverlaps([occ({ startsUtc: at(2, 8), endsUtc: at(2, 9) }),
              occ({ startsUtc: at(2, 9), endsUtc: at(2, 10) })]).length, 0);

ok('Zwei überlappende werden gefunden',
  rcOverlaps([occ({ startsUtc: at(2, 8), endsUtc: at(2, 10) }),
              occ({ startsUtc: at(2, 9), endsUtc: at(2, 11) })]).length, 1);

// Ein Termin, der ganz in einem anderen liegt, ist auch eine Überschneidung —
// und der Fall, den eine reine Anfangs-Prüfung übersieht.
ok('Ein eingeschlossener Termin zählt auch',
  rcOverlaps([occ({ startsUtc: at(2, 8), endsUtc: at(2, 12) }),
              occ({ startsUtc: at(2, 9), endsUtc: at(2, 10) })]).length, 1);

// „Den ganzen Tag Urlaub" und „um zehn ein Termin" ist kein Konflikt, sondern
// der Normalfall.
ok('Ganztägige zählen nicht mit',
  rcOverlaps([occ({ startsUtc: at(2, 0), endsUtc: at(3, 0), allDay: true }),
              occ({ startsUtc: at(2, 10), endsUtc: at(2, 11) })]).length, 0);

ok('Abgesagte zählen nicht mit',
  rcOverlaps([occ({ startsUtc: at(2, 8), endsUtc: at(2, 10), status: 'cancelled' }),
              occ({ startsUtc: at(2, 9), endsUtc: at(2, 11) })]).length, 0);

ok('Drei überlappende ergeben drei Paare',
  rcOverlaps([occ({ startsUtc: at(2, 8), endsUtc: at(2, 12) }),
              occ({ startsUtc: at(2, 9), endsUtc: at(2, 13) }),
              occ({ startsUtc: at(2, 10), endsUtc: at(2, 14) })]).length, 3);

ok('Eine leere Liste hat keine Überschneidungen', rcOverlaps([]).length, 0);

// -- Nach Tagen gruppieren ----------------------------------------------------

ok('Zwei Termine desselben Tages landen zusammen',
  rcByDay([occ({ startsUtc: at(2, 8) }), occ({ startsUtc: at(2, 14) })], 'de', 'UTC').length, 1);

ok('Zwei Termine verschiedener Tage werden getrennt',
  rcByDay([occ({ startsUtc: at(2, 8) }), occ({ startsUtc: at(3, 8) })], 'de', 'UTC').length, 2);

// DER Grund, warum die Zeitzone mitgegeben wird: ein Termin um 23 Uhr UTC ist
// in Warschau schon der nächste Tag. Wer nach UTC gruppiert, zeigt ihn am
// falschen Tag an — und das fällt nur abends auf.
{
  const late = occ({ startsUtc: at(2, 23) });
  const early = occ({ startsUtc: at(3, 8) });

  ok('Nach UTC sind es zwei Tage',
    rcByDay([late, early], 'de', 'UTC').length, 2);

  ok('Nach Warschauer Zeit ist es derselbe Tag',
    rcByDay([late, early], 'de', 'Europe/Warsaw').length, 1);
}

// Eine Zeitzone, die dieser Browser nicht kennt, darf den Kalender nicht leer
// erscheinen lassen.
ok('Eine unbekannte Zeitzone lässt die Liste nicht verschwinden',
  rcByDay([occ()], 'de', 'Mars/Olympus').length, 1);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
