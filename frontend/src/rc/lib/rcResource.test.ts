/**
 * Belegung — das Monatsraster.
 *
 * Die Frage ist nicht „sieht der Kalender hübsch aus", sondern: **behauptet er
 * etwas Falsches?** Ein Tag, der als frei dasteht und belegt ist, kostet eine
 * Gruppe eine Anfrage und uns eine Absage. Ein Tag, der als belegt dasteht und
 * frei ist, kostet eine Buchung, von der niemand je erfährt.
 */

import { rcMonthDays, rcMonthRange, type RcBusyPeriod } from './rcResource';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const stateOf = (days: readonly { date: string; state: string }[], date: string) =>
  days.find((d) => d.date === date)?.state;

// -- Die Spanne ---------------------------------------------------------------

ok('Juli 2027 beginnt am Ersten und endet am 31.',
  rcMonthRange(2027, 6), ['2027-07-01', '2027-07-31']);

ok('Februar 2028 hat 29 Tage', rcMonthRange(2028, 1), ['2028-02-01', '2028-02-29']);

// -- Das Raster ---------------------------------------------------------------

{
  // Juli 2027 beginnt an einem Donnerstag. Bei Montag als Wochenanfang stehen
  // davor drei Tage aus dem Juni.
  const days = rcMonthDays(2027, 6, []);

  ok('Das Raster beginnt am Montag', days[0].date, '2027-06-28');
  ok('Die Vortage sind als ausserhalb erkennbar', days[0].outside, true);
  ok('Der Erste liegt drinnen', stateOf(days, '2027-07-01'), 'free');
  ok('Das Raster geht in ganzen Wochen auf', days.length % 7, 0);
  ok('Ohne Belegung ist alles frei', days.every((d) => d.state === 'free'), true);
}

// -- Die Ränder eines Zeitraums ----------------------------------------------

{
  const periods: RcBusyPeriod[] = [{ from: '2027-07-10', to: '2027-07-14', state: 'confirmed' }];
  const days = rcMonthDays(2027, 6, periods);

  // Beide Ränder gehören DAZU. Ein Zeitraum „vom 10. bis 14." schliesst den
  // 14. ein; ihn auszunehmen ist der Fehler, der eine Gruppe am Abreisetag
  // auf eine andere treffen lässt.
  ok('Der erste Tag ist belegt', stateOf(days, '2027-07-10'), 'confirmed');
  ok('Der letzte Tag ist belegt', stateOf(days, '2027-07-14'), 'confirmed');
  ok('Der Tag davor ist frei', stateOf(days, '2027-07-09'), 'free');
  ok('Der Tag danach ist frei', stateOf(days, '2027-07-15'), 'free');
}

// -- Der strengere Zustand gewinnt -------------------------------------------

{
  // Ein vorgemerkter und ein bestätigter Zeitraum überlappen sich. Stünde der
  // Tag als „vorgemerkt" da, fragte jemand an — und bekäme eine Absage.
  const periods: RcBusyPeriod[] = [
    { from: '2027-07-01', to: '2027-07-20', state: 'held' },
    { from: '2027-07-10', to: '2027-07-12', state: 'confirmed' }
  ];
  const days = rcMonthDays(2027, 6, periods);

  ok('Bestätigt schlägt vorgemerkt', stateOf(days, '2027-07-11'), 'confirmed');
  ok('Daneben bleibt es vorgemerkt', stateOf(days, '2027-07-05'), 'held');
}

// Die Reihenfolge der Zeiträume darf das Ergebnis nicht ändern.
{
  const a = rcMonthDays(2027, 6, [
    { from: '2027-07-10', to: '2027-07-12', state: 'confirmed' },
    { from: '2027-07-01', to: '2027-07-20', state: 'held' }
  ]);
  ok('Die Reihenfolge der Zeiträume ist gleichgültig', stateOf(a, '2027-07-11'), 'confirmed');
}

// -- Ein Zeitraum über die Monatsgrenze ---------------------------------------

{
  const periods: RcBusyPeriod[] = [{ from: '2027-06-28', to: '2027-07-02', state: 'confirmed' }];
  const days = rcMonthDays(2027, 6, periods);

  // Die Tage aus dem Vormonat stehen im Raster und müssen mitgefärbt werden —
  // sonst sieht die letzte Juniwoche im Julibild frei aus.
  ok('Ein Tag aus dem Vormonat wird mitgefärbt', stateOf(days, '2027-06-28'), 'confirmed');
  ok('Und er bleibt als ausserhalb erkennbar',
    days.find((d) => d.date === '2027-06-28')?.outside, true);
  ok('Im Monat selbst ebenso', stateOf(days, '2027-07-02'), 'confirmed');
}

// -- Der Monat, an dem sich Datumsrechnungen blamieren ------------------------

{
  // Februar in einem Schaltjahr, und der 1. März darf nicht hineinrutschen.
  const days = rcMonthDays(2028, 1, []);
  const inside = days.filter((d) => !d.outside);
  ok('Februar 2028 hat 29 eigene Tage', inside.length, 29);
  ok('Der letzte eigene Tag ist der 29.', inside[inside.length - 1].date, '2028-02-29');
}

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
