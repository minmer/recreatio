/**
 * Die Bedingung, unter der eine Veranstaltung entstehen darf.
 *
 * <b>Was hier still danebengeht.</b> Das alte Formular liess eine
 * Veranstaltung anlegen, sobald ein Titel dastand. Sie nahm danach Anmeldungen
 * entgegen, und unter dem Formular stand keine vollstaendige Klausel: nirgends
 * war gesagt, WER die Daten verarbeitet und unter welcher Anschrift. Das sieht
 * an keiner Stelle kaputt aus — es faellt erst auf, wenn jemand danach fragt,
 * und dann sind die Daten schon da.
 *
 * Deshalb wird hier NICHT geprueft, ob der Knopf huebsch aussieht, sondern ob
 * er ohne Verantwortlichen ueberhaupt angeht.
 */

import { rcFoundReady, rcSlugComplaint, type RcFoundDraft } from './rcFound';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/** Ein vollstaendiger Entwurf — von hier aus wird jeweils EIN Feld verdorben. */
const whole: RcFoundDraft = {
  founderRoleId: '3f2a9c10-0000-4000-8000-000000000001',
  slug: 'festyn-2026',
  title: 'Festyn parafialny 2026',
  organizerName: 'Parafia sw. Kazimierza Krolewicza w Krakowie',
  organizerAddress: 'ul. Gwiazdzista 1, 30-000 Krakow'
};

const but = (patch: Partial<RcFoundDraft>): RcFoundDraft => ({ ...whole, ...patch });

// -- Der vollstaendige Fall ---------------------------------------------------

ok('Alles da', rcFoundReady(whole), true);

// -- Ohne Klausel geht nichts -------------------------------------------------

/*
 * Die zwei wichtigsten Zeilen dieser Reihe. Faellt eine von ihnen auf `true`,
 * kann wieder eine Veranstaltung entstehen, die Anmeldungen annimmt, ohne dass
 * jemand fuer die Daten einsteht.
 */
ok('Ohne Namen des Verantwortlichen', rcFoundReady(but({ organizerName: '' })), false);
ok('Ohne Anschrift', rcFoundReady(but({ organizerAddress: '' })), false);

ok('Name nur aus Leerzeichen', rcFoundReady(but({ organizerName: '   ' })), false);
ok('Anschrift nur aus Leerzeichen', rcFoundReady(but({ organizerAddress: '\t \n' })), false);

// -- Die uebrigen Pflichtfelder -----------------------------------------------

ok('Ohne gruendende Rolle', rcFoundReady(but({ founderRoleId: '' })), false);
ok('Gruendende Rolle nur Leerzeichen', rcFoundReady(but({ founderRoleId: ' ' })), false);
ok('Ohne Titel', rcFoundReady(but({ title: '' })), false);
ok('Titel nur aus Leerzeichen', rcFoundReady(but({ title: '  ' })), false);

/*
 * Eine leere Adresse ist nicht „noch nicht getippt, also in Ordnung": ohne sie
 * gibt es die Veranstaltung nirgends.
 */
ok('Ohne Adresse', rcFoundReady(but({ slug: '' })), false);

// -- Die Form der Adresse -----------------------------------------------------

ok('Grossbuchstaben', rcFoundReady(but({ slug: 'Festyn' })), false);
ok('Leerzeichen darin', rcFoundReady(but({ slug: 'festyn 2026' })), false);
ok('Diakritika', rcFoundReady(but({ slug: 'swięty-jan' })), false);
ok('Punkt darin', rcFoundReady(but({ slug: 'festyn.2026' })), false);
ok('Strich am Anfang', rcFoundReady(but({ slug: '-festyn' })), false);
ok('Strich am Ende', rcFoundReady(but({ slug: 'festyn-' })), false);
ok('Nur Ziffern', rcFoundReady(but({ slug: '2026' })), true);
ok('Der Name des Hauses', rcFoundReady(but({ slug: 'recreatio' })), true);

// -- Serverseitige Laengen ----------------------------------------------------

/*
 * Der Server weist laengere Angaben mit 400 ab (`FoundAsync`). Ein Knopf, der
 * angeht und dann eine Absage holt, ist schlechter als einer, der grau bleibt.
 */
ok('Titel genau 200', rcFoundReady(but({ title: 'a'.repeat(200) })), true);
ok('Titel 201', rcFoundReady(but({ title: 'a'.repeat(201) })), false);
ok('Name genau 200', rcFoundReady(but({ organizerName: 'a'.repeat(200) })), true);
ok('Name 201', rcFoundReady(but({ organizerName: 'a'.repeat(201) })), false);
ok('Anschrift genau 400', rcFoundReady(but({ organizerAddress: 'a'.repeat(400) })), true);
ok('Anschrift 401', rcFoundReady(but({ organizerAddress: 'a'.repeat(401) })), false);

/* Die Adresse ist bei 48 zu Ende — das sagt `rcIsSlug`, nicht diese Reihe. */
ok('Adresse genau 48', rcFoundReady(but({ slug: 'a'.repeat(48) })), true);
ok('Adresse 49', rcFoundReady(but({ slug: 'a'.repeat(49) })), false);

// -- Der Hinweistext unter dem Adressfeld -------------------------------------

/*
 * Ein Formular, das beim Oeffnen sofort ruegt, was noch niemand getippt hat,
 * liest sich wie ein Vorwurf. Leer heisst also: kein Hinweis.
 */
ok('Leer ruegt nicht', rcSlugComplaint(''), false);
ok('Richtig geschrieben ruegt nicht', rcSlugComplaint('festyn-2026'), false);
ok('Falsch geschrieben ruegt', rcSlugComplaint('Festyn 2026'), true);
ok('Halb getippter Strich ruegt', rcSlugComplaint('festyn-'), true);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
