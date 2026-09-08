/**
 * Eine Veranstaltung aus fremdem JSON.
 *
 * <b>Was hier still danebengeht.</b> Eingespielte Dateien sind die Stelle, an
 * der ein Programm am leisesten scheitert: ein Feld heisst anders, eine Liste
 * ist keine, eine Art gibt es nicht — und heraus kommt eine Veranstaltung, der
 * die Haelfte fehlt. Sie SIEHT vollstaendig aus. Wer sie einspielt, sucht den
 * Fehler dann bei sich.
 *
 * Deshalb steht unten zu jedem Bruchstueck ein Fall, und zu jedem
 * uebergangenen Abschnitt die Zusicherung, dass er GEMELDET wird.
 */

import { rcImportSize, rcReadImport } from './rcEventImport';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const read = (value: unknown) => rcReadImport(JSON.stringify(value));

// -- Der vollstaendige Fall ---------------------------------------------------

const whole = read({
  title: 'Rowerowa Częstochowa 2026',
  pages: [{
    slug: 'start',
    title: 'Strona publiczna',
    parts: [
      { kind: 'title', menuLabel: 'Start', title: 'Rowerowa Częstochowa' },
      { kind: 'plan', menuLabel: 'Trasa' }
    ]
  }]
});

ok('Gelesen', whole.ok, true);
if (whole.ok) {
  ok('Titel', whole.plan.title, 'Rowerowa Częstochowa 2026');
  ok('Umfang', rcImportSize(whole.plan), { pages: 1, parts: 2, fields: 0 });
  ok('Nichts uebergangen', whole.plan.skipped, []);

  /* Ohne `slug` in der Datei gibt es keinen Vorschlag — und das ist kein Fehler. */
  ok('Ohne Adresse kein Vorschlag', whole.plan.head.slug, null);
  ok('Standard ist oeffentlich', whole.plan.pages[0].parts[0].isPublic, true);
}

// -- Streng an der Wurzel -----------------------------------------------------

ok('Leerer Text', rcReadImport('   '), { ok: false, error: 'Nie wklejono niczego.' });
ok('Kein JSON', rcReadImport('{nicht'), { ok: false, error: 'To nie jest poprawny JSON.' });
ok('Ohne Titel', read({ pages: [] }), { ok: false, error: 'Brakuje pola „title".' });
ok('Ohne Seiten', read({ title: 'X' }), { ok: false, error: 'Brakuje stron („pages").' });
ok('Seiten sind keine Liste', read({ title: 'X', pages: 'start' }),
  { ok: false, error: 'Brakuje stron („pages").' });

// -- Nachsichtig in den Blaettern ---------------------------------------------

const sparse = read({ title: 'X', pages: [{ slug: 's', title: 'S', parts: [{ kind: 'text' }] }] });
ok('Ohne Vorspann ist kein Fehler', sparse.ok, true);
if (sparse.ok) {
  ok('Und der Vorspann ist leer', sparse.plan.pages[0].parts[0].intro, null);
  ok('Einstellung fehlt', sparse.plan.pages[0].parts[0].configJson, null);
}

/*
 * Die Einstellung darf Text ODER Objekt sein: von Hand geschrieben ist sie ein
 * Objekt, ausgegeben ist sie Text. Beides abzulehnen waere Pedanterie.
 */
const asObject = read({
  title: 'X',
  pages: [{ slug: 's', title: 'S', parts: [{ kind: 'text', config: { blocks: ['a'] } }] }]
});
ok('Einstellung als Objekt', asObject.ok && asObject.plan.pages[0].parts[0].configJson !== null, true);

const asString = read({
  title: 'X',
  pages: [{ slug: 's', title: 'S', parts: [{ kind: 'text', configJson: '{"blocks":[]}' }] }]
});
/*
  Der Leser gibt die Einstellung EINHEITLICH formatiert zurueck: er muss sie
  ohnehin oeffnen, um die Schichten hineinzulegen. Verglichen wird darum der
  Inhalt und nicht die Schreibweise — sonst pruefte diese Zeile die Einrueckung.
*/
ok('Einstellung als Text',
  asString.ok ? JSON.parse(asString.plan.pages[0].parts[0].configJson ?? 'null') : null,
  { blocks: [] });

// -- Was uebergangen wird, wird GEMELDET --------------------------------------

/*
 * DER WICHTIGSTE FALL DIESER REIHE.
 *
 * Eine unbekannte Art stillschweigend wegzulassen hiesse: die Veranstaltung
 * entsteht, sieht ganz aus, und ein Abschnitt fehlt, den niemand vermisst — bis
 * jemand ihn sucht.
 */
const unknown = read({
  title: 'X',
  pages: [{ slug: 's', title: 'S', parts: [{ kind: 'text' }, { kind: 'zeppelin' }] }]
});

ok('Der Rest kommt trotzdem', unknown.ok && rcImportSize(unknown.plan).parts, 1);
ok('Und das Fehlende steht da',
  unknown.ok ? unknown.plan.skipped : [], ['S · część 2: nieznany rodzaj „zeppelin".']);

const namelessPage = read({
  title: 'X',
  pages: [{ slug: '', title: 'Ohne Adresse' }, { slug: 's', title: 'S' }]
});
ok('Seite ohne Adresse faellt weg', namelessPage.ok && namelessPage.plan.pages.length, 1);
ok('Und wird genannt',
  namelessPage.ok ? namelessPage.plan.skipped : [], ['Strona 1: brak adresu albo tytułu.']);

/* Faellt ALLES weg, ist das ein Fehler und keine leere Veranstaltung. */
ok('Keine lesbare Seite', read({ title: 'X', pages: [{ slug: '', title: '' }] }),
  { ok: false, error: 'Żadnej strony nie dało się odczytać.' });

// -- Verborgene Abschnitte ----------------------------------------------------

const sealed = read({
  title: 'X',
  pages: [{ slug: 's', title: 'S', parts: [{ kind: 'text', isPublic: false }] }]
});
ok('isPublic false wird uebernommen',
  sealed.ok ? sealed.plan.pages[0].parts[0].isPublic : null, false);

/*
 * DIE SEITE KANN NUR VERSIEGELN, NIE OEFFNEN.
 *
 * Auf einer internen Seite hilft es nichts, wenn die Datei „oeffentlich" sagt:
 * der Inhalt laege sonst im Klartext, und die Adresse allein genuegte zum
 * Lesen. Umgekehrt gilt es nicht — ein einzelner versiegelter Abschnitt auf
 * einer oeffentlichen Seite ist erlaubt und bleibt versiegelt.
 */
const internalPage = read({
  title: 'X',
  pages: [{
    kind: 'internal', slug: 's', title: 'S',
    parts: [{ kind: 'text', isPublic: true }]
  }]
});

ok('Interne Seite ueberstimmt „oeffentlich"',
  internalPage.ok ? internalPage.plan.pages[0].parts[0].isPublic : null, false);

ok('Und die Seite weiss, was sie ist',
  internalPage.ok ? internalPage.plan.pages[0].kind : null, 'internal');

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
