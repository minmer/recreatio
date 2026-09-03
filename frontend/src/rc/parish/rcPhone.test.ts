/**
 * Telefonnummern in Form bringen.
 *
 * <b>Was hier schiefgehen kann, ist teuer.</b> Eine Nummer, die falsch
 * zusammengesetzt wird, ist eine Nummer, unter der niemand erreichbar ist —
 * und man merkt es erst, wenn jemand anruft und danebengreift. Die Prüfung
 * fragt deshalb vor allem, was NICHT angefasst werden darf.
 */

import { rcPhone, rcPhones, RC_DEFAULT_DIAL } from './rcPhone';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Die polnische Nummer in ihren Schreibweisen ------------------------------

const want = '+48 501 234 567';

ok('Neun Ziffern bekommen die Vorwahl', rcPhone('501234567'), want);
ok('Leerzeichen stoeren nicht', rcPhone('501 234 567'), want);
ok('Bindestriche auch nicht', rcPhone('501-234-567'), want);
ok('Klammern ebenso', rcPhone('(501) 234 567'), want);

/* Die fuehrende Null ist Inlandsvorwahl und faellt international weg. */
ok('Fuehrende Null faellt weg', rcPhone('0501234567'), want);

/* `00` ist dasselbe wie `+`, nur aelter. */
ok('Doppelnull wird zum Plus', rcPhone('0048501234567'), want);

ok('Mit Plus bleibt es', rcPhone('+48501234567'), want);
ok('Mit Plus und Leerzeichen', rcPhone('+48 501 234 567'), want);
ok('48 ohne Plus', rcPhone('48501234567'), want);

// -- Was NICHT angefasst werden darf ------------------------------------------

/*
 * Eine fremde Vorwahl bleibt fremd. Ein Kandidat mit slowakischer Nummer soll
 * keine polnische bekommen, bloss weil das Formular in einer polnischen
 * Pfarrei steht.
 */
ok('Slowakische Nummer behaelt ihre Vorwahl', rcPhone('+421905123456').startsWith('+421'), true);
ok('Deutsche auch', rcPhone('+4915112345678').startsWith('+49'), true);

/*
 * Was nicht nach Nummer aussieht, bleibt Wort fuer Wort stehen. Lieber eine
 * Zeile unveraendert weiterreichen als sie zu etwas machen, das niemand
 * gemeint hat.
 */
ok('Text bleibt Text', rcPhone('Kancelaria'), 'Kancelaria');
ok('Zu kurz bleibt stehen', rcPhone('12345'), '12345');
ok('Zu lang bleibt stehen', rcPhone('1234567890123456789'), '1234567890123456789');
ok('Leer bleibt leer', rcPhone(''), '');
ok('Nur Leerraum wird leer', rcPhone('   '), '');

/* Eine Hausnummer im falschen Feld soll keine Telefonnummer werden. */
ok('Eine kurze Zahl bleibt eine Zahl', rcPhone('3E'), '3E');

// -- Mehrere Nummern ----------------------------------------------------------

ok(
  'Eine je Zeile',
  rcPhones('501234567\n+48 601 111 222'),
  ['+48 501 234 567', '+48 601 111 222']
);

ok('Leere Zeilen fallen weg', rcPhones('501234567\n\n\n'), ['+48 501 234 567']);

/*
 * Zweimal dieselbe Nummer ist keine zweite Erreichbarkeit, sondern ein
 * Versehen beim Einfuegen — und zwar eines, das man in verschiedenen
 * Schreibweisen nicht sieht.
 */
ok(
  'Dieselbe Nummer zweimal geschrieben zaehlt einmal',
  rcPhones('501234567\n0501234567\n+48 501 234 567'),
  ['+48 501 234 567']
);

ok('Nichts ergibt nichts', rcPhones(''), []);

// -- Rund ---------------------------------------------------------------------

/*
 * Zweimal durchlaufen aendert nichts mehr. Ohne diese Eigenschaft wanderte
 * eine Nummer bei jedem Speichern ein Stueck weiter — und niemand saehe, wann
 * es anfing.
 */
for (const raw of ['501234567', '+48 501 234 567', '+421905123456', 'Kancelaria', '12345']) {
  ok(`„${raw}" ist nach dem zweiten Lauf unveraendert`, rcPhone(rcPhone(raw)), rcPhone(raw));
}

// -- Die Vorgabe --------------------------------------------------------------

ok('Die ergaenzte Vorwahl ist die polnische', RC_DEFAULT_DIAL, '+48');
ok('Und sie steht wirklich davor', rcPhone('501234567').startsWith(RC_DEFAULT_DIAL), true);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
