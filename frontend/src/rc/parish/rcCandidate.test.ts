/**
 * Der Portalzugang eines Firmkandidaten.
 *
 * <b>Was hier wirklich geprüft wird, ist eine VERABREDUNG zwischen zwei
 * Sprachen.</b> Der Browser würfelt das Geheimnis und schickt nur dessen
 * Abdruck; der Dienst schlägt damit nach. Rechnen beide nicht dasselbe, sieht
 * niemand einen Fehler: die Anmeldung geht durch, und der Link führt danach
 * ins Leere.
 *
 * Genau diese Sorte Verabredung ist im Anmeldeweg der Veranstaltungen schon
 * einmal auseinandergelaufen — der Browser verpackte an einem Platz, der
 * Server packte an einem anderen aus, beide für sich schlüssig. Gefunden hat
 * es damals erst ein Durchgang gegen den laufenden Dienst.
 *
 * Deshalb steht hier ein fester Wert, und derselbe steht in den reinen
 * Prüfungen von `Rc.Api.Tests`. Ändert sich eine der beiden Seiten, scheitert
 * eine der beiden Reihen.
 */

import { createHash, webcrypto } from 'node:crypto';

import { rcDay, rcPortalHash, rcNewPortalSecret, RC_APPLY_FIELDS } from './rcCandidate';

/*
 * Der Läufer übersetzt für node, und dort gibt es `crypto.subtle` nur über
 * `webcrypto`. Ohne diese Zeile scheitert die Prüfung an der Umgebung statt an
 * der Sache.
 */
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as unknown as { crypto: unknown }).crypto = webcrypto;
}

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Der gemeinsame Testvektor ------------------------------------------------

/*
 * DERSELBE WERT STEHT IN Rc.Api.Tests.
 *
 * SHA-256 über die UTF-8-Bytes der ZEICHENKETTE — nicht über die Bytes, die
 * darin kodiert sind. Der Unterschied ist der ganze Fehlerraum.
 */
const VECTOR_SECRET = 'rc-portal-testvektor-2026';
const VECTOR_HASH = 'qDpC0+r7lHRs8NybJBSe2YJSEJpfyWdxGQrRKu+deeM=';

ok('Der Abdruck stimmt mit dem Dienst ueberein', await rcPortalHash(VECTOR_SECRET), VECTOR_HASH);

/*
 * Ein Link aus einer Nachricht bringt gern ein Leerzeichen mit. Beide Seiten
 * schneiden den Rand ab — täte es nur eine, führte ein kopierter Link ins
 * Leere, und zwar nur manchmal.
 */
ok('Leerraum am Rand aendert nichts', await rcPortalHash(`  ${VECTOR_SECRET}\n`), VECTOR_HASH);

/* Und die Gegenprobe: es ist wirklich der Text und nicht dessen Bytes. */
ok(
  'Gerechnet wird ueber den TEXT, nicht ueber die kodierten Bytes',
  createHash('sha256').update(VECTOR_SECRET, 'utf8').digest('base64'),
  VECTOR_HASH
);

// -- Das Geheimnis ------------------------------------------------------------

const secret = rcNewPortalSecret();

/* 18 Byte in base64url sind 24 Zeichen ohne Füllzeichen. */
ok('Das Geheimnis ist 24 Zeichen lang', secret.length, 24);
ok('Es traegt keine Fuellzeichen', secret.includes('='), false);

/*
 * base64url und nicht base64: das Geheimnis steht in einer Adresse. Ein `+`
 * oder `/` darin überlebt nicht jeden Weg, auf dem ein Link weitergegeben
 * wird — und ein Link, der beim Kopieren kaputtgeht, ist schlimmer als einer,
 * der zwei Zeichen länger ist.
 */
ok('Es ist adressfest', /^[A-Za-z0-9_-]+$/.test(secret), true);

/* Zwei Geheimnisse sind zwei. Ein Zufallsgenerator, der wiederholt, wäre der
   Fehler, den man erst bemerkt, wenn zwei Kinder dieselbe Seite sehen. */
const many = new Set(Array.from({ length: 200 }, () => rcNewPortalSecret()));
ok('Zweihundert Geheimnisse sind zweihundert verschiedene', many.size, 200);

/* Verschiedene Geheimnisse haben verschiedene Abdruecke. */
const a = rcNewPortalSecret();
const b = rcNewPortalSecret();
ok('Verschiedene Geheimnisse, verschiedene Abdruecke',
  (await rcPortalHash(a)) === (await rcPortalHash(b)), false);

// -- Die Felder ---------------------------------------------------------------

/*
 * Die Namen sind die des Dienstes. Ein fuenfter Name hier waere ein Feld, das
 * der Server wegwirft, ohne etwas zu sagen — die Anmeldung ginge durch und
 * eine Angabe fehlte.
 */
ok('Es sind sechs Felder', [...RC_APPLY_FIELDS],
  ['given', 'surname', 'born', 'phone', 'address', 'school']);

/*
 * Name und Anschrift stehen jeweils in ZWEI Feldern, nicht in einem.
 *
 * Zwei Dinge unter einem Etikett sind ein Ding: eine Liste nach Nachnamen
 * laesst sich daraus nicht mehr sortieren, und eine Anschrift nicht mehr auf
 * einen Umschlag schreiben, ohne sie von Hand auseinanderzunehmen.
 */
ok('Vorname und Nachname getrennt',
  RC_APPLY_FIELDS.includes('given') && RC_APPLY_FIELDS.includes('surname'), true);
ok('Telefon und Anschrift getrennt',
  RC_APPLY_FIELDS.includes('phone') && RC_APPLY_FIELDS.includes('address'), true);

/*
 * Die alten Sammelfelder sind weg und duerfen nicht zurueckkehren.
 *
 * Ueber die breitere Sicht gefragt: der Typ kennt die alten Namen nicht mehr,
 * und genau deshalb muss die LAUFENDE Liste gefragt werden — sonst prueft man
 * nur, was der Uebersetzer ohnehin schon weiss.
 */
const gone = (name: string) => (RC_APPLY_FIELDS as readonly string[]).includes(name);
ok('Kein gemeinsames Namensfeld mehr', gone('name'), false);
ok('Kein gemeinsames Kontaktfeld mehr', gone('contact'), false);

// -- Das Geburtsdatum ---------------------------------------------------------

/*
 * Auf Papier ist `2011-04-02` keine Hilfe: wer es abschreibt, vertauscht Tag
 * und Monat, und man merkt es erst, wenn der Jahrgang nicht passt.
 */
ok('Aus der Maschinenform wird die Formularform', rcDay('2011-04-02'), '02.04.2011');
ok('Leerraum am Rand faellt weg', rcDay('  2011-04-02  '), '02.04.2011');

/*
 * Was kein Datum ist, bleibt stehen. Geraten wird nichts — ein Feld, das
 * jemand von Hand gefuellt hat, gehoert ihm und nicht dem Umformer.
 */
ok('Ein Wort bleibt ein Wort', rcDay('nie pamiętam'), 'nie pamiętam');
ok('Zwei Teile sind kein Datum', rcDay('2011-04'), '2011-04');
ok('Buchstaben darin machen es ungueltig', rcDay('20aa-04-02'), '20aa-04-02');
ok('Einstellige Teile bleiben stehen', rcDay('2011-4-2'), '2011-4-2');
ok('Leer bleibt leer', rcDay(''), '');

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
