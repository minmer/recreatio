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

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
