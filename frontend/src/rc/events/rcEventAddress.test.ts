/**
 * Die zweiteilige Adresse einer Veranstaltung.
 *
 * <b>Was hier still danebengeht.</b> Der Name einer Veranstaltung ist nur
 * INNERHALB ihrer Seite eindeutig: zwei Pfarreien duerfen beide ein
 * „festyn-2026" haben. Faellt der erste Teil der Adresse weg oder rutschen die
 * beiden Teile durcheinander, fuehrt ein Link auf ein fremdes Fest — und weder
 * die Seite noch der Link sehen dabei kaputt aus. Wer ihn oeffnet, liest ein
 * Programm, das ihn nichts angeht, und meldet sich womoeglich dort an.
 *
 * Der zweite Fall ist die Zaehlung der Teile. Sie stand bis zur Sammlung an
 * `tail[0]`; jetzt steht dort der Name der Veranstaltung und die Zahl eine
 * Stelle weiter. Ein alter Link (`/event/recreatio/3`) darf deshalb NICHT als
 * „dritter Teil" gelesen werden — er meint jetzt eine Veranstaltung namens
 * „3", und die gibt es schlicht nicht.
 */

import { rcParsePath, rcPath } from '../lib/rcRoute';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/** Wie RcApp die Adresse liest: Sammlung, Veranstaltung, Teil. */
function read(hash: string): {
  collection: string | null;
  event: string | null;
  at: number | null;
} {
  const address = rcParsePath(hash);
  if (address.part !== 'event' || address.slug === null) {
    return { collection: null, event: null, at: null };
  }
  const nth = address.tail[1] ?? '';
  return {
    collection: address.slug,
    event: address.tail[0] ?? null,
    at: /^[0-9]+$/.test(nth) ? Number(nth) : null
  };
}

// -- Bauen --------------------------------------------------------------------

ok('Katalog', rcPath('event', 'recreatio'), '#/new/event/recreatio');
ok('Eine Veranstaltung', rcPath('event', 'recreatio', 'kal26'), '#/new/event/recreatio/kal26');
ok('Ihr dritter Teil', `${rcPath('event', 'recreatio', 'kal26')}/3`, '#/new/event/recreatio/kal26/3');

/*
 * Zwei Pfarreien mit demselben Fest — der Sinn der ganzen Ebene. Waeren diese
 * beiden Adressen gleich, waere die Sammlung umsonst.
 */
ok('Gleiches Fest, andere Seite (A)',
  rcPath('event', 'grzegorzki', 'festyn-2026'), '#/new/event/grzegorzki/festyn-2026');
ok('Gleiches Fest, andere Seite (B)',
  rcPath('event', 'limanowa', 'festyn-2026'), '#/new/event/limanowa/festyn-2026');

// -- Lesen --------------------------------------------------------------------

ok('Katalog gelesen', read('#/new/event/recreatio'),
  { collection: 'recreatio', event: null, at: null });

ok('Veranstaltung gelesen', read('#/new/event/recreatio/kal26'),
  { collection: 'recreatio', event: 'kal26', at: null });

ok('Teil gelesen', read('#/new/event/recreatio/kal26/3'),
  { collection: 'recreatio', event: 'kal26', at: 3 });

ok('Nullter Teil', read('#/new/event/recreatio/kal26/0'),
  { collection: 'recreatio', event: 'kal26', at: 0 });

/*
 * Gebaut und wieder gelesen muss dasselbe herauskommen. Genau hier faellt ein
 * Vertauschen der beiden Teile auf.
 */
ok('Hin und zurueck', read(rcPath('event', 'grzegorzki', 'festyn-2026')),
  { collection: 'grzegorzki', event: 'festyn-2026', at: null });

// -- Was NICHT als Teil durchgehen darf ---------------------------------------

/*
 * Der alte einteilige Link. Er meint jetzt eine Veranstaltung namens „3" —
 * und das ist richtig so: ihn als dritten Teil zu lesen hiesse, eine Zahl mal
 * als Namen und mal als Zaehler zu deuten, je nachdem wie sie aussieht.
 */
ok('Alter Teil-Link ist keine Zaehlung mehr', read('#/new/event/recreatio/3'),
  { collection: 'recreatio', event: '3', at: null });

ok('Text an der Stelle der Zahl', read('#/new/event/recreatio/kal26/programm'),
  { collection: 'recreatio', event: 'kal26', at: null });

ok('Negative Zahl zaehlt nicht', read('#/new/event/recreatio/kal26/-1'),
  { collection: 'recreatio', event: 'kal26', at: null });

// -- Ränder -------------------------------------------------------------------

ok('Ohne Seite gar nichts', read('#/new/event'),
  { collection: null, event: null, at: null });

ok('Ein anderer Teil ist keine Veranstaltung', read('#/new/parish/grzegorzki'),
  { collection: null, event: null, at: null });

/* Ein Name mit Sonderzeichen reist kodiert und kommt heil zurueck. */
ok('Kodierung ueberlebt', read(rcPath('event', 'recreatio', 'a b')),
  { collection: 'recreatio', event: 'a b', at: null });

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
