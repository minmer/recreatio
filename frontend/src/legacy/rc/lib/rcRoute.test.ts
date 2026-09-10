/**
 * Die Adressregel — der Teil steht vor dem einzelnen Ding.
 *
 * Geprüft wird nicht, ob die Zeichenketten hübsch aussehen, sondern was die
 * Regel leisten soll: dass sich eine Adresse ohne Rückfrage beim Dienst
 * auflösen lässt, dass zwei Teile denselben Namen vergeben dürfen, und dass
 * eine Adresse OHNE Teil auffällt statt still auf der Startseite zu landen.
 */

import {
  RC_HASH_BASE, rcNeedsIdentity, rcParsePath, rcPartOf, rcPath, type RcPart
} from './rcRoute';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Die Regel ----------------------------------------------------------------

ok('Der Teil steht vor dem Namen',
  rcPath('parish', 'jan'), '#/new/parish/jan');

ok('Und er wird auch so wieder gelesen',
  rcParsePath('#/new/parish/jan'), { part: 'parish', slug: 'jan', tail: [], stray: null });

// DER Grund für die Regel: ohne den Teil wüsste der Browser nicht, was `jan`
// ist, und müsste den Dienst fragen — vor dem ersten Bild, bei jedem Aufruf.
ok('Ein Name ohne Teil davor faellt auf',
  rcParsePath('#/new/jan'), { part: 'home', slug: null, tail: [], stray: 'jan' });

// Und er landet NICHT stillschweigend auf der Startseite: `stray` steht da,
// damit die Oberflaeche sagen kann, was der Adresse fehlt.
ok('Er wird nicht zur Startseite verschwiegen',
  rcParsePath('#/new/jan').stray !== null, true);

// Der zweite Grund: eigene Namensraeume. Beide duerfen ein `jan` haben.
{
  const parish = rcParsePath('#/new/parish/jan');
  const library = rcParsePath('#/new/cogita/jan');
  ok('Zwei Teile duerfen denselben Namen vergeben',
    [parish.part, parish.slug, library.part, library.slug], ['parish', 'jan', 'cogita', 'jan']);
}

// Eine Pfarrei namens `chat` verschluckt kein Modul mehr, weil sie hinter
// ihrem Teil steht.
ok('Ein Modulname als Pfarreiname ist harmlos',
  rcParsePath('#/new/parish/chat'), { part: 'parish', slug: 'chat', tail: [], stray: null });

// -- Was hinter dem Namen kommt ----------------------------------------------

ok('Was danach kommt, bleibt erhalten',
  rcParsePath('#/new/parish/jan/intentions'),
  { part: 'parish', slug: 'jan', tail: ['intentions'], stray: null });

// Ein Teil, der keine einzelnen Dinge benennt, hat auch keinen Namen — das
// naechste Segment ist eine Ansicht.
ok('Ein Konto heisst nicht "keys"',
  rcParsePath('#/new/account/keys'),
  { part: 'account', slug: null, tail: ['keys'], stray: null });

// -- Hin und zurueck ----------------------------------------------------------

for (const [part, slug] of [['parish', 'kazimierz'], ['event', 'limanowa'], ['cogita', 'jan']] as const) {
  const address = rcParsePath(rcPath(part, slug));
  ok(`Hin und zurueck: ${part}/${slug}`, [address.part, address.slug], [part, slug]);
}

// Namen mit Zeichen, die kodiert werden muessen, ueberstehen die Reise. Ohne
// das waere jeder Pfarreiname mit einem polnischen Buchstaben ein kaputter Link.
{
  const slug = 'święty-jan/2';
  ok('Ein Name mit Sonderzeichen kommt heil zurueck',
    rcParsePath(rcPath('parish', slug)).slug, slug);
  ok('Und der Schraegstrich darin trennt keine Segmente',
    rcParsePath(rcPath('parish', slug)).tail, []);
}

// -- Die Wurzel ---------------------------------------------------------------

ok('Die Wurzel ist die Startseite',
  rcParsePath('#/new'), { part: 'home', slug: null, tail: [], stray: null });

ok('Auch mit Schraegstrich am Ende',
  rcParsePath('#/new/'), { part: 'home', slug: null, tail: [], stray: null });

ok('Die Wurzel baut sich ohne Anhaengsel',
  rcPath('home'), RC_HASH_BASE);

// Eine Adresse ausserhalb der Plattform ist nicht unsere.
ok('Der Altbestand gehoert nicht hierher',
  rcParsePath('#/section-1'), { part: 'home', slug: null, tail: [], stray: null });

ok('Eine leere Adresse ergibt die Startseite',
  rcParsePath(''), { part: 'home', slug: null, tail: [], stray: null });

// Ein ganzer Link tut es auch — genau so kommt er aus `rcInviteLink` zurueck.
ok('Ein vollstaendiger Link wird gelesen',
  rcParsePath('https://recreatio.pl/#/new/parish/jan').slug, 'jan');

// -- Der Teil sagt, ob jemand bekannt sein muss -------------------------------
//
// Der dritte Grund fuer die Regel, und der, an dem der Eintritt haengt.

ok('Der Messplan haengt im Schaukasten',
  rcNeedsIdentity(rcParsePath('#/new/parish/jan')), false);

ok('Die Firmung nicht',
  rcNeedsIdentity(rcParsePath('#/new/confirmation/2027')), true);

ok('Die Stiftung auch nicht',
  rcNeedsIdentity(rcParsePath('#/new/foundation')), false);

// Wer ueber einen Einladungslink kommt, soll sofort erfahren, ob er schon
// angemeldet ist — sonst liest er, wohin es fuehrt, und stoesst dann an eine Wand.
ok('Ein Einladungslink will es wissen',
  rcNeedsIdentity(rcParsePath('#/new/invite/abc123')), true);

// -- Falsch gebaute Adressen fallen beim Bauen auf, nicht beim Benutzer -------

{
  let threw = false;
  try {
    // `contact` benennt keine einzelnen Dinge.
    rcPath('contact' as RcPart, 'jan');
  } catch {
    threw = true;
  }
  ok('Ein Name an einem Teil ohne Namen wirft', threw, true);
}

ok('Ein erfundenes Wort ist kein Teil', rcPartOf('kazimierz'), null);
ok('Und ein echtes schon', rcPartOf('parish'), 'parish');

// `hasOwnProperty` und nicht `in`: sonst waere `#/new/constructor` ein Teil.
ok('Geerbte Eigenschaften sind keine Teile', rcPartOf('constructor'), null);
ok('Und eine solche Adresse ist eine ohne Teil',
  rcParsePath('#/new/toString').stray, 'toString');

// -- Der Arbeitsplatz ---------------------------------------------------------
//
// Er ist das erste Ziel, das gebaut wird, und alles Weitere haengt daran.
// Was hier gepruefft wird, sind die drei Eigenschaften, aus denen sein
// Verhalten folgt — nicht die Seite, sondern die Regeln davor.

ok('Der Arbeitsplatz ist ein Teil', rcPartOf('workspace'), 'workspace');

/*
 * ER VERLANGT, DASS JEMAND BEKANNT IST.
 *
 * Daran haengt, dass `rcBoot` VOR dem ersten Bild fragt, wer hier ist.
 * Stuende hier `false`, malte die Anwendung erst eine leere Halle und
 * schoebe danach das Anmeldeformular davor — ein Aufblitzen, das aussieht
 * wie ein Fehler.
 */
ok('Er verlangt eine Identitaet',
  rcNeedsIdentity(rcParsePath('#/new/workspace')), true);

/* Zum Vergleich: eine Pfarrseite haengt im Schaukasten und verlangt nichts. */
ok('Eine Pfarrseite nicht',
  rcNeedsIdentity(rcParsePath('#/new/parish/grzegorzki')), false);

/*
 * ES GIBT NUR EINEN ARBEITSPLATZ — DEINEN.
 *
 * `slugged: false` heisst nicht „hat keine Unterseiten": was danach kommt,
 * sind Ansichten desselben Platzes. Ein Name dort waere der Platz eines
 * anderen, und den gibt es nicht zu sehen.
 */
ok('Er benennt keine einzelnen Dinge',
  rcParsePath('#/new/workspace').slug, null);

ok('Was danach kommt, ist eine Ansicht',
  rcParsePath('#/new/workspace/groups').tail, ['groups']);

ok('Die Adresse baut sich', rcPath('workspace'), '#/new/workspace');

/*
 * DAS WORT IST BELEGT — plattformweit.
 *
 * `RC_PARTS` IST das zentrale Register der ersten Segmente: steht ein Wort
 * darin, kann keine Pfarrei und keine Veranstaltung es mehr als Namen
 * tragen. Genau das macht `#/new/<wort>` eindeutig aufloesbar, ohne den
 * Dienst zu fragen.
 */
ok('Es ist kein Streuname mehr',
  rcParsePath('#/new/workspace').stray, null);

/*
 * DER ALTE NAME IST WEG.
 *
 * `workshop` hat nie etwas gezeigt, und genau ein Verweis zeigte darauf —
 * der Anmeldeknopf im Veranstaltungskatalog, der damit in einer leeren
 * Huelle landete. Zwei fast gleiche Woerter im Register waeren die naechste
 * Verwechslung gewesen.
 */
ok('workshop ist kein Teil mehr', rcPartOf('workshop'), null);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
