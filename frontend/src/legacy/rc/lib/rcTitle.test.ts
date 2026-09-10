/**
 * Titel vom Namen trennen und wieder zusammensetzen.
 *
 * <b>Warum das geprüft wird.</b> Gespeichert wird EIN Anzeigename; das Formular
 * macht daraus wieder Stücke. Diese Trennung ist die einzige Stelle, an der aus
 * einer Zeichenkette mehrere Felder werden, und sie kann auf zwei Arten
 * schiefgehen: sie reisst einen Vornamen ab, oder sie erkennt einen Titel
 * nicht und schiebt ihn in den Namen.
 *
 * Rund läuft es nur, wenn Trennen und Zusammensetzen sich gegenseitig
 * aufheben. Das ist hier die eigentliche Zusicherung — nicht, wie die Stücke
 * dabei fallen.
 */

import { RC_TITLE_HINTS, RC_TITLE_WORDS, rcSplitTitles, rcJoinTitles } from './rcTitle';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Mehrere Titel, jeder für sich --------------------------------------------

ok(
  'Zwei Titel bleiben zwei',
  rcSplitTitles('ks. dr Michał Mleczek'),
  { titles: ['ks.', 'dr'], name: 'Michał Mleczek' }
);

ok(
  'Drei auch',
  rcSplitTitles('ks. dr hab. Jan Kowalski'),
  { titles: ['ks.', 'dr', 'hab.'], name: 'Jan Kowalski' }
);

ok(
  'Einer allein',
  rcSplitTitles('ks. Michał Mleczek'),
  { titles: ['ks.'], name: 'Michał Mleczek' }
);

/*
 * Ein selbst getippter Titel muss nicht in einer Liste stehen. Die Punktregel
 * erkennt ihn — und genau darum geht es: niemand soll auf eine gepflegte
 * Auswahl warten müssen, um seinen eigenen Titel zu führen.
 */
ok(
  'Ein unbekannter Titel mit Punkt wird erkannt',
  rcSplitTitles('abp. Jan Kowalski'),
  { titles: ['abp.'], name: 'Jan Kowalski' }
);

ok(
  'Und einer ohne Punkt aus der Wortliste',
  rcSplitTitles('bp Jan Kowalski'),
  { titles: ['bp'], name: 'Jan Kowalski' }
);

// -- Was KEIN Titel ist -------------------------------------------------------

ok('Kein Titel bleibt keiner', rcSplitTitles('Michał Mleczek'), { titles: [], name: 'Michał Mleczek' });
ok('Leer bleibt leer', rcSplitTitles(''), { titles: [], name: '' });
ok('Nur Leerraum wird leer', rcSplitTitles('   '), { titles: [], name: '' });

/*
 * Nach dem ersten Wort, das kein Titel ist, wird nicht weitergesucht. „Jan dr
 * Kowalski" hat keinen Titel — es ist ein Name mit einem seltsamen Wort darin,
 * und den zu zerlegen wäre eine Korrektur, um die niemand gebeten hat.
 */
ok(
  'Nach dem Namen faengt kein Titel mehr an',
  rcSplitTitles('Jan dr Kowalski'),
  { titles: [], name: 'Jan dr Kowalski' }
);

/*
 * Das LETZTE Wort wird nie zum Titel. Sonst bliebe bei „ks. dr" ein leerer
 * Name stehen, und beim nächsten Öffnen des Formulars wäre der einzige Text,
 * den es gibt, verschwunden.
 */
ok(
  'Ein Name aus lauter Titelwoertern behaelt einen Namen',
  rcSplitTitles('ks. dr'),
  { titles: ['ks.'], name: 'dr' }
);
ok('Ein einzelnes Wort ist immer der Name', rcSplitTitles('ks.'), { titles: [], name: 'ks.' });

/* Mehrfacher Leerraum zwischen den Wörtern zerlegt trotzdem richtig. */
ok(
  'Doppelte Leerzeichen stoeren nicht',
  rcSplitTitles('  ks.   dr    Michał  Mleczek '),
  { titles: ['ks.', 'dr'], name: 'Michał Mleczek' }
);

// -- Zusammensetzen -----------------------------------------------------------

ok('Mit zwei Titeln', rcJoinTitles(['ks.', 'dr'], 'Michał Mleczek'), 'ks. dr Michał Mleczek');
ok('Ohne Titel', rcJoinTitles([], 'Michał Mleczek'), 'Michał Mleczek');
ok('Leerraum wird abgeschnitten', rcJoinTitles(['ks. '], '  Michał  '), 'ks. Michał');
ok('Leere Stuecke fallen weg', rcJoinTitles(['ks.', '', '  '], 'Michał'), 'ks. Michał');
ok('Ohne Namen bleiben die Titel', rcJoinTitles(['ks.'], '   '), 'ks.');
ok('Ganz leer bleibt leer', rcJoinTitles([], '  '), '');

/* Die Reihenfolge wird NICHT sortiert: „dr ks." ist erlaubt, wenn jemand es so
   will. Eine Sortierregel wäre eine Behauptung über jede Gemeinschaft. */
ok('Die Reihenfolge bleibt, wie sie gesetzt wurde', rcJoinTitles(['dr', 'ks.'], 'Jan'), 'dr ks. Jan');

// -- Rund: trennen und wieder zusammensetzen ----------------------------------

/*
 * Die eigentliche Zusicherung. Wie die Stücke dabei fallen, darf sich
 * unterscheiden — „dr hab." kann als ein Stück getippt und als zwei
 * zurückgelesen werden. Die ZEICHENKETTE muss dieselbe bleiben, sonst wanderte
 * der Name bei jedem Öffnen und Sichern ein Stück weiter.
 */
const roundTrip = [
  'ks. Michał Mleczek',
  'ks. dr Michał Mleczek',
  'ks. dr hab. Jan Kowalski',
  'abp. dr Jan Kowalski',
  'o. Piotr Nowak',
  's. Maria',
  'bp Jan Kowalski',
  'dr hab. Anna Nowak',
  'Michał Mleczek',
  'ks.',
  'Jan dr Kowalski'
];

for (const full of roundTrip) {
  const { titles, name } = rcSplitTitles(full);
  ok(`„${full}" uebersteht den Umlauf`, rcJoinTitles(titles, name), full);
}

/* Und zweimal hintereinander ändert auch nichts mehr. */
for (const full of roundTrip) {
  const once = rcSplitTitles(full);
  const twice = rcSplitTitles(rcJoinTitles(once.titles, once.name));
  ok(`„${full}" ist nach dem zweiten Umlauf unveraendert`, twice, once);
}

// -- Die Vorschläge -----------------------------------------------------------

/*
 * Jeder Vorschlag muss beim Zurücklesen auch wieder als Titel erkannt werden.
 * Sonst böte das Formular etwas an, das nach dem Sichern im Namen landet — und
 * beim nächsten Öffnen stünde es dort statt oben.
 */
for (const hint of RC_TITLE_HINTS) {
  ok(
    `Vorschlag „${hint}" wird zurueckgelesen`,
    rcSplitTitles(`${hint} Jan Kowalski`).titles,
    [hint]
  );
}

ok('Alle Vorschlaege sind verschieden', new Set(RC_TITLE_HINTS).size, RC_TITLE_HINTS.length);
ok(
  'Kein Vorschlag traegt Leerraum an den Raendern',
  RC_TITLE_HINTS.filter((h) => h !== h.trim()).length,
  0
);

/* Die Wortliste enthält nur Wörter OHNE Punkt — mit Punkt greift ohnehin die
   allgemeine Regel, und ein doppelter Weg zum selben Ergebnis ist einer zu
   viel. */
ok(
  'Die Wortliste fuehrt keine Punkte',
  RC_TITLE_WORDS.filter((w) => w.endsWith('.')).length,
  0
);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
