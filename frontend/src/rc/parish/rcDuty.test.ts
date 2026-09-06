/**
 * Wer Dienst hat — der stehende Plan und die Ausnahme.
 *
 * <b>Die Regel, an der es still schiefgeht.</b> Wer fuer den 24. Dezember eine
 * Vertretung eintraegt, will, dass der stehende Diensthabende an diesem Tag
 * VERSCHWINDET. Ergaenzte die Ausnahme den Plan, stuende der Vertretene weiter
 * daneben — und im Schaukasten haenge ein Name, der an dem Tag nicht kommt.
 *
 * Das faellt beim Eintragen nicht auf: die Liste sieht voller aus, nicht
 * falscher.
 */

import { rcDutyAt } from './rcDuty';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const duty = (dutyId: string, name: string, occurrenceUtc: string | null) => ({
  dutyId, name, occurrenceUtc, roleId: null, sortOrder: 0, note: null, isPublic: false
});

const plan = [
  duty('s1', 'ks. Jan', null),          // stehend: jeden Samstag
  duty('s2', 'ks. Piotr', null),        // stehend: auch
  duty('x1', 'ks. Adam', '2026-12-24T16:00:00Z')  // nur am 24.
];

// -- Der stehende Plan --------------------------------------------------------

ok('Ein gewoehnlicher Samstag: die stehenden',
  rcDutyAt(plan, '2026-12-19T16:00:00Z').map((d) => d.name),
  ['ks. Jan', 'ks. Piotr']);

// -- Die Ausnahme ERSETZT -----------------------------------------------------

/*
 * DAS IST DER PUNKT. Am 24. steht NUR ks. Adam — nicht Adam neben Jan und
 * Piotr, die an dem Abend anderswo sind.
 */
ok('Am Tag der Vertretung nur diese',
  rcDutyAt(plan, '2026-12-24T16:00:00Z').map((d) => d.name), ['ks. Adam']);

/*
 * Dieselbe Chwila, andere Schreibweise. Der Dienst gibt „+00:00" heraus, im
 * Pfad steht „Z" — beide muessen denselben Tag treffen, sonst faende die
 * Ausnahme ihr Vorkommen nicht und der stehende Plan gaelte weiter.
 */
ok('Auch mit Zonenversatz geschrieben',
  rcDutyAt(plan, '2026-12-24T17:00:00+01:00').map((d) => d.name), ['ks. Adam']);

ok('Und mit Millisekunden',
  rcDutyAt(plan, '2026-12-24T16:00:00.000Z').map((d) => d.name), ['ks. Adam']);

// -- Raender ------------------------------------------------------------------

ok('Ohne Plan niemand', rcDutyAt([], '2026-12-19T16:00:00Z'), []);

ok('Nur Ausnahmen: an einem anderen Tag niemand',
  rcDutyAt([duty('x', 'ks. Adam', '2026-12-24T16:00:00Z')], '2026-12-19T16:00:00Z'), []);

ok('Nur stehende: an jedem Tag dieselben',
  rcDutyAt([duty('s', 'ks. Jan', null)], '2026-12-19T16:00:00Z').map((d) => d.name),
  ['ks. Jan']);

/*
 * Eine Ausnahme kann auch „an dem Tag niemand" heissen — dafuer traegt man
 * einen Namen ein und entfernt ihn wieder. Dass daraus dann der stehende Plan
 * zurueckkehrt, ist richtig: es gibt keine Zeile mehr, die etwas anderes sagt.
 */
ok('Ohne Zeile fuer den Tag gilt wieder der stehende Plan',
  rcDutyAt([duty('s', 'ks. Jan', null)], '2026-12-24T16:00:00Z').map((d) => d.name),
  ['ks. Jan']);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
