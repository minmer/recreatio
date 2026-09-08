/**
 * Gruppieren und Sieben im Terminplan.
 *
 * <b>Was hier still danebengeht.</b> Ein Plan, der falsch gruppiert, sieht
 * nicht kaputt aus — er zeigt einen Termin am falschen Tag. Niemand bemerkt
 * es, bis jemand zur falschen Zeit erscheint. Und ein Filter, der bei leerer
 * Auswahl NICHTS statt ALLES zeigt, macht aus dem ersten Blick auf den Plan
 * einen leeren Plan: als waere nichts eingetragen.
 */

import {
  rcDayLabel, rcFilterKinds, rcGroupByDay, rcKindLabel, rcKindsIn, rcLocalDay, rcTimeOf,
  type RcAgendaEntry
} from './rcAgenda';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const entry = (over: Partial<RcAgendaEntry> & { startsUtc: string }): RcAgendaEntry => ({
  kind: 'appointment',
  sourceId: 'c1',
  sourceTitle: 'Kalendarz',
  endsUtc: over.startsUtc,
  allDay: false,
  title: 'X',
  location: null,
  status: 'confirmed',
  mine: true,
  unreadable: null,
  href: null,
  ...over
} as RcAgendaEntry);

// -- Der Tag ist ein ORTSTAG --------------------------------------------------

/*
 * DIE ZEILE, DIE DEN GANZEN PUNKT TRAEGT.
 *
 * 00:30 am 29. in Warschau ist im Sommer 22:30 UTC am 28. Nach UTC gruppiert
 * stuende diese Andacht einen Tag zu frueh — und niemand saehe daran etwas
 * Falsches, bis jemand am falschen Abend kommt.
 */
ok('Nach Mitternacht bleibt am Ortstag',
  rcLocalDay('2026-08-28T22:30:00Z', 'Europe/Warsaw'), '2026-08-29');

ok('Und nach UTC waere es der Vortag',
  rcLocalDay('2026-08-28T22:30:00Z', 'UTC'), '2026-08-28');

/* Eine Messe um 18:00 Ortszeit ist im Sommer 16:00 UTC — derselbe Tag. */
ok('Abendmesse', rcLocalDay('2026-08-28T16:00:00Z', 'Europe/Warsaw'), '2026-08-28');

/* Eine unbekannte Zone darf den Plan nicht kosten. */
ok('Unsinnige Zone faellt zurueck',
  rcLocalDay('2026-08-28T12:00:00Z', 'Nirgendwo/Nie').length, 10);

ok('Kaputte Zeit', rcLocalDay('gestern', 'UTC'), '');

// -- Gruppieren ---------------------------------------------------------------

const mass = entry({ kind: 'mass', startsUtc: '2026-08-28T16:00:00Z', title: 'Msza' });
const confession = entry({ kind: 'confession', startsUtc: '2026-08-28T15:15:00Z', title: 'Spowiedź' });
const ride = entry({
  kind: 'event', startsUtc: '2026-08-28T00:00:00Z', endsUtc: '2026-08-29T00:00:00Z',
  allDay: true, title: 'Rowerowa Częstochowa'
});
const later = entry({ kind: 'appointment', startsUtc: '2026-08-30T09:00:00Z', title: 'Spotkanie' });

const days = rcGroupByDay([mass, later, confession, ride], 'Europe/Warsaw');

ok('Zwei Tage', days.map((d) => d.day), ['2026-08-28', '2026-08-30']);

/*
 * Ganztaegiges steht OBEN: es betrifft den ganzen Tag und gehoert nicht
 * zwischen zwei Uhrzeiten. Danach nach der Zeit.
 */
ok('Reihenfolge im Tag',
  days[0].entries.map((e) => e.title),
  ['Rowerowa Częstochowa', 'Spowiedź', 'Msza']);

/*
 * LEERE TAGE KOMMEN NICHT VOR. Dreissig leere Ueberschriften zwischen vier
 * Terminen machen aus einem Plan eine Suchaufgabe.
 */
ok('Der 29. fehlt, weil nichts ist', days.some((d) => d.day === '2026-08-29'), false);

ok('Kaputte Zeile faellt aus der Gruppierung',
  rcGroupByDay([entry({ startsUtc: 'kiedyś' })], 'UTC').length, 0);

// -- Die Uhrzeit --------------------------------------------------------------

ok('Uhrzeit im Ort', rcTimeOf(mass, 'Europe/Warsaw'), '18:00');
ok('Ganztaegiges hat keine', rcTimeOf(ride, 'Europe/Warsaw'), null);

// -- Sieben -------------------------------------------------------------------

const all = [mass, confession, ride, later];

/*
 * LEER HEISST ALLES, NICHT NICHTS. Andersherum waere der erste Blick auf den
 * Plan ein leerer Plan — und der sieht aus, als sei nichts eingetragen.
 */
ok('Leere Auswahl zeigt alles', rcFilterKinds(all, new Set()).length, 4);

ok('Nur Messen', rcFilterKinds(all, new Set(['mass'])).map((e) => e.title), ['Msza']);
ok('Messe und Beichte', rcFilterKinds(all, new Set(['mass', 'confession'])).length, 2);
ok('Art, die nicht vorkommt', rcFilterKinds(all, new Set(['task'])), []);

/* Der Filter baut sich aus den DATEN — eine Art ohne Termine steht nicht drin. */
ok('Vorkommende Arten', rcKindsIn(all), ['mass', 'event', 'confession', 'appointment']
  .sort((a, b) => rcKindLabel(a).localeCompare(rcKindLabel(b), 'pl')));

// -- Beschriftungen -----------------------------------------------------------

ok('Art bekommt ein Wort', rcKindLabel('sick_round'), 'Odwiedziny chorych');
ok('Unbekannte Art bleibt sie selbst', rcKindLabel('zeppelin'), 'zeppelin');

/* Das Jahr steht nur dabei, wenn es nicht das laufende ist. */
ok('Im laufenden Jahr ohne Jahr',
  rcDayLabel('2026-08-28', '2026-01-01').includes('2026'), false);
ok('Im anderen Jahr mit Jahr',
  rcDayLabel('2027-08-28', '2026-01-01').includes('2027'), true);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
