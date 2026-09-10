/**
 * Der Ausdruck.
 *
 * <b>Was hier schiefgehen kann, merkt niemand rechtzeitig.</b> Ein Blatt, das
 * die falsche Pfarrei als Verantwortliche nennt, sieht richtig aus — bis es
 * unterschrieben zurückkommt. Und ein Nachname mit einem spitzen Zeichen darin
 * würde, ungeprüft, still die Seite zerlegen.
 *
 * Geprüft wird deshalb vor allem: steht das Richtige drauf, und steht das
 * Falsche NICHT drauf.
 */

import { rcApplyPrintHtml, type RcPrintParish } from './rcPrintApply';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const parish: RcPrintParish = {
  name: 'Parafia św. Jana Chrzciciela w Krakowie',
  address: 'ul. Dobrego Pasterza 117, 31-416 Kraków',
  email: 'parafia@example.pl',
  leader: 'ks. Michał Mleczko'
};

const fields = {
  given: 'Jan',
  surname: 'Kowalski',
  born: '2011-04-02',
  phone: '501234567\n0601111222',
  address: 'ul. Miodowa 3/5\n31-055 Kraków',
  school: 'SP nr 5, klasa 8a'
};

const html = rcApplyPrintHtml(fields, parish, 'Bierzmowanie 2026', '2 maja 2026');

// -- Was auf dem Blatt stehen muss --------------------------------------------

ok('Der Vorname steht da', html.includes('Jan'), true);
ok('Der Nachname auch', html.includes('Kowalski'), true);
ok('Die Schule', html.includes('SP nr 5, klasa 8a'), true);

/* Das Datum steht in der Form, in der man es auf ein Formular schreibt. */
ok('Das Geburtsdatum lesbar', html.includes('02.04.2011'), true);
ok('Und nicht in der Maschinenform', html.includes('2011-04-02'), false);
ok('Der Jahrgang', html.includes('Bierzmowanie 2026'), true);

/* Die Adresse steht zeilenweise — so, wie man sie auf einen Umschlag schreibt. */
ok('Adresse erste Zeile', html.includes('<li>ul. Miodowa 3/5</li>'), true);
ok('Adresse zweite Zeile', html.includes('<li>31-055 Kraków</li>'), true);

/*
 * Die Nummern gehen durch dieselbe Form wie im Formular. Wer sie ohne Vorwahl
 * eingetippt hat, findet sie auf dem Blatt trotzdem vollständig.
 */
ok('Erste Nummer mit Vorwahl', html.includes('<li>+48 501 234 567</li>'), true);
ok('Zweite Nummer ohne die fuehrende Null', html.includes('<li>+48 601 111 222</li>'), true);

// -- Drei Blätter --------------------------------------------------------------

ok('Drei Seiten', html.split('class="page"').length - 1 + html.split('class="page fine"').length - 1, 3);
ok('Die Anmeldung', html.includes('Zgłoszenie kandydata'), true);
ok('Die Einwilligung der Eltern', html.includes('Oświadczenie rodzica'), true);
ok('Die Klausel', html.includes('Klauzula informacyjna'), true);

/* Ohne Unterschriftszeilen ist das Blatt kein Formular, sondern ein Abzug. */
ok('Unterschrift der Eltern', html.includes('Podpis:'), true);

// -- Die Pfarrei ist DIESE Pfarrei ---------------------------------------------

/*
 * Der Text stammt von einer bestimmten Pfarrei. Er darf ihren Namen nicht
 * mitnehmen, wenn ihn eine andere druckt: sonst erklärt jemand seine
 * Zustimmung gegenüber einer Pfarrei, von der er nie gehört hat.
 */
const other = rcApplyPrintHtml(fields, {
  name: 'Parafia Matki Bożej Częstochowskiej',
  address: 'ul. Inna 1, 30-000 Kraków',
  email: '',
  leader: ''
}, '', '2 maja 2026');

ok('Die eigene Pfarrei steht da', other.includes('Parafia Matki Bożej Częstochowskiej'), true);
ok('Die fremde nicht', other.includes('św. Jana Chrzciciela'), false);
ok('Auch kein fremder Priester', other.includes('Mleczko'), false);

/* Ohne Angabe kein erfundener Leiter — der Satz endet einfach früher. */
ok('Kein leeres „prowadzonych przez"', other.includes('prowadzonych przez .'), false);
ok('Und keine leere Klammer', other.includes('prowadzonych przez ,'), false);

/* Die Aufsicht ist landesweit dieselbe und steht immer. */
ok('Der Aufsichtsweg steht immer', other.includes('kiod@episkopat.pl'), true);

/*
 * Der Datenschutzbeauftragte ist in jeder Diözese ein anderer. Eine geratene
 * Adresse zeigte auf einen Menschen, der von nichts weiss.
 */
ok('Keine geratene IOD-Adresse', html.includes('diecezja.krakow.pl'), false);
ok('Stattdessen eine Linie zum Ausfuellen', html.includes('Inspektorem Ochrony Danych jest możliwy pod adresem: ...'), true);

// -- Was fehlt, bleibt eine Linie ---------------------------------------------

const bare = rcApplyPrintHtml({ given: 'Anna' }, parish, '', '2 maja 2026');

ok('Der eine Name steht', bare.includes('Anna'), true);
ok('Fehlende Angaben werden zur Linie', bare.includes('class="blank"'), true);

/* Eine leere Angabe darf nicht als leere Liste durchgehen — sie muss auffallen. */
ok('Keine leere Nummernliste', bare.includes('<ul></ul>'), false);

// -- Fremder Text bleibt Text --------------------------------------------------

/*
 * Der Name kommt von einem Menschen, der ihn eintippt. Kaeme er ungeprueft in
 * die Seite, waere ein spitzes Zeichen darin das Ende der Seite.
 */
const risky = rcApplyPrintHtml(
  { given: '<script>alert(1)</script>', surname: 'O"Brien & Sons' },
  parish, '', '2 maja 2026');

ok('Kein eingeschleustes Skript', risky.includes('<script>alert(1)</script>'), false);
ok('Aber der Name ist lesbar da', risky.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
ok('Das Und-Zeichen bleibt ein Und-Zeichen', risky.includes('O&quot;Brien &amp; Sons'), true);

/*
 * Genau EIN Skript gehoert auf die Seite: das, welches den Druckdialog oeffnet.
 * Ein zweites waere eines, das jemand mitgeschickt hat.
 */
ok('Nur das eigene Skript', risky.split('<script').length - 1, 1);

// -- Ergebnis ------------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
