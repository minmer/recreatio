/**
 * Die Wege zwischen Katalog, Seite und Herausgeber.
 *
 * <b>Was hier still danebengeht.</b> Ein Verweis, der ins Leere fuehrt, sieht
 * aus wie ein Ausgang. Der Fussbereich der Veranstaltungsseite zeigte lange auf
 * `/#/event` — die Adresse des ALTEN Moduls, unter der im rc-Teil nichts liegt.
 * Niemand haette das gemeldet: man klickt, landet auf der Startseite und haelt
 * es fuer Absicht.
 *
 * Und die Zaehlung: `…/kal26/3` meint den dritten Teil, `…/kal26/edit` den
 * Herausgeber. Wuerde „edit" je als Zahl durchgehen oder eine Zahl je als
 * „edit", fuehrte ein verschickter Link woandershin, ohne dass etwas kaputt
 * aussieht.
 */

import { rcParsePath, rcPath } from '../lib/rcRoute';
import { rcIsReservedSlug, rcIsSlug } from '../lib/rcSlugs';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/** Wie RcApp die Adresse liest. */
function read(hash: string) {
  const address = rcParsePath(hash);
  if (address.part !== 'event' || address.slug === null) {
    return { collection: null, event: null, editing: false, at: null };
  }
  const nth = address.tail[1] ?? '';
  return {
    collection: address.slug,
    event: address.tail[0] ?? null,
    editing: nth === 'edit',
    at: /^[0-9]+$/.test(nth) ? Number(nth) : null
  };
}

// -- Die vier Adressen des Moduls ---------------------------------------------

ok('Katalog', rcPath('event', 'recreatio'), '#/new/event/recreatio');
ok('Veranstaltung', rcPath('event', 'recreatio', 'kal26'), '#/new/event/recreatio/kal26');
ok('Teil', `${rcPath('event', 'recreatio', 'kal26')}/3`, '#/new/event/recreatio/kal26/3');
ok('Herausgeber', rcPath('event', 'recreatio', 'kal26', 'edit'), '#/new/event/recreatio/kal26/edit');

// -- Gelesen ------------------------------------------------------------------

ok('Katalog gelesen', read('#/new/event/recreatio'),
  { collection: 'recreatio', event: null, editing: false, at: null });

ok('Veranstaltung gelesen', read('#/new/event/recreatio/kal26'),
  { collection: 'recreatio', event: 'kal26', editing: false, at: null });

ok('Teil gelesen', read('#/new/event/recreatio/kal26/3'),
  { collection: 'recreatio', event: 'kal26', editing: false, at: 3 });

ok('Herausgeber gelesen', read('#/new/event/recreatio/kal26/edit'),
  { collection: 'recreatio', event: 'kal26', editing: true, at: null });

/*
 * „edit" und eine Zahl duerfen sich NIE ueberschneiden. Der Teil ist eine
 * Position, kein Name — es gibt keinen Teil, der „edit" heisst.
 */
ok('Der Herausgeber ist kein Teil', read('#/new/event/recreatio/kal26/edit').at, null);
ok('Ein Teil ist kein Herausgeber', read('#/new/event/recreatio/kal26/0').editing, false);

/* Gross geschrieben ist es NICHT der Herausgeber — die Adresse ist genau. */
ok('EDIT ist nicht edit', read('#/new/event/recreatio/kal26/EDIT'),
  { collection: 'recreatio', event: 'EDIT'.length > 0 ? 'kal26' : null, editing: false, at: null });

// -- Der Kreator --------------------------------------------------------------

/*
 * `new` steht an der Stelle eines NAMENS und kann deshalb mit einem
 * kollidieren — anders als `edit`, das dort steht, wo sonst eine Zahl ist.
 * Deshalb ist es reserviert (RC_RESERVED_SLUGS), auf beiden Seiten.
 */
ok('Kreator', rcPath('event', 'recreatio', 'new'), '#/new/event/recreatio/new');

ok('Kreator gelesen', read('#/new/event/recreatio/new'),
  { collection: 'recreatio', event: 'new', editing: false, at: null });

ok('„new" ist reserviert', rcIsReservedSlug('new'), true);
ok('„edit" ist reserviert', rcIsReservedSlug('edit'), true);
ok('Ein gewoehnlicher Name nicht', rcIsReservedSlug('kal26'), false);

/* Die Form bleibt eine EIGENE Frage: „new" ist wohlgeformt und trotzdem tabu. */
ok('Reserviert heisst nicht formlos', rcIsSlug('new'), true);

// -- Hin und zurueck ----------------------------------------------------------

ok('Herausgeber, hin und zurueck', read(rcPath('event', 'grzegorzki', 'festyn-2026', 'edit')),
  { collection: 'grzegorzki', event: 'festyn-2026', editing: true, at: null });

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
