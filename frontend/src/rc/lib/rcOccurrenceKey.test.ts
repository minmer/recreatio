/**
 * Ein Vorkommen als Adressteil.
 *
 * <b>Was hier schiefgeht, sieht nach etwas anderem aus.</b> Steht ein
 * Zeitpunkt mit Zonenversatz im Pfad, wird das Pluszeichen zu <code>%2B</code>,
 * und IIS weist die Anfrage mit 404 ab, BEVOR die Anwendung sie sieht. Es gibt
 * dann keinen Protokolleintrag und keine CORS-Kopfzeile — im Browser steht ein
 * Zugriffsfehler, und man sucht stundenlang an der falschen Stelle.
 *
 * Nachgemessen am laufenden Dienst:
 *
 * <code>
 *   .../occurrences/XYZ/intentions                        → 401  (Route da)
 *   .../occurrences/2026-09-06T06%3A00%3A00Z/intentions   → 401  (Doppelpunkte gehen)
 *   .../occurrences/2026-09-06T06%3A00%3A00%2B00%3A00/... → 404  (Plus nicht)
 * </code>
 */

import { rcOccurrenceKey } from './rcCalendar';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Kein Pluszeichen, niemals -------------------------------------------------

/*
 * Das ist die eigentliche Zusicherung. Alles andere hier beschreibt sie nur
 * genauer: was auch hereinkommt, im Pfad darf kein `+` landen.
 */
const shapes = [
  '2026-09-06T06:00:00+00:00',
  '2026-09-06T08:00:00+02:00',
  '2026-01-06T07:00:00+01:00',
  '2026-09-06T06:00:00Z',
  '2026-09-06T06:00:00.000Z',
  '2026-12-31T23:00:00-05:00'
];

for (const shape of shapes) {
  ok(`„${shape}" traegt kein Plus`, rcOccurrenceKey(shape).includes('+'), false);
  ok(`„${shape}" endet auf Z`, rcOccurrenceKey(shape).endsWith('Z'), true);
}

// -- Derselbe Augenblick bleibt derselbe ---------------------------------------

/*
 * Die Schreibweise aendert sich, der Zeitpunkt nicht. Waere das nicht so,
 * haenge die Intention an einer anderen Messe als der, bei der sie steht —
 * und zwar lautlos, weil beide Zeichenketten plausibel aussehen.
 */
ok('Versatz +02:00 meint denselben Augenblick',
  rcOccurrenceKey('2026-09-06T08:00:00+02:00'),
  rcOccurrenceKey('2026-09-06T06:00:00Z'));

ok('Und +00:00 erst recht',
  rcOccurrenceKey('2026-09-06T06:00:00+00:00'),
  rcOccurrenceKey('2026-09-06T06:00:00Z'));

ok('Auch ueber die Datumsgrenze',
  rcOccurrenceKey('2026-12-31T23:00:00-05:00'),
  rcOccurrenceKey('2027-01-01T04:00:00Z'));

/* Zweimal durchlaufen aendert nichts mehr. */
for (const shape of shapes) {
  ok(`„${shape}" ist nach dem zweiten Lauf gleich`,
    rcOccurrenceKey(rcOccurrenceKey(shape)), rcOccurrenceKey(shape));
}

// -- Was kein Zeitpunkt ist ----------------------------------------------------

/*
 * Unveraendert weiterreichen und nicht in etwas verwandeln, das niemand
 * gemeint hat. Der Dienst antwortet darauf mit einer klaren Meldung; ein
 * stillschweigend erfundener Zeitpunkt traefe dagegen irgendeine Messe.
 */
ok('Unsinn bleibt unveraendert', rcOccurrenceKey('XYZ'), 'XYZ');
ok('Leeres bleibt leer', rcOccurrenceKey(''), '');

// -- Ergebnis ------------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
