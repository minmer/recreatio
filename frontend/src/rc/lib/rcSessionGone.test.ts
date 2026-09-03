/**
 * Wann eine Sitzung als fort gilt.
 *
 * <b>Warum das geprüft wird.</b> Diese Liste entscheidet, wer aus der
 * Anwendung fliegt. Steht ein Code zu viel darin, wird jemand abgemeldet, weil
 * er einmal irgendwo nicht hindurfte — ein Fehler, der wie Willkür aussieht.
 * Fehlt einer, sitzt jemand vor einer Werkstatt, in der jeder Handgriff
 * scheitert, während die Kopfleiste weiter „angemeldet" sagt.
 *
 * <b>Der Anlass war ein echter Vorfall.</b> Ein Ausrollen hat die
 * Schutzschlüssel der Cookies verloren. Jedes vorher ausgestellte Cookie war
 * danach unlesbar — der Browser schickte es weiter, der Dienst konnte nichts
 * damit anfangen, und die Anwendung merkte es nicht. Nur Abmelden und neu
 * Anmelden half, und darauf muss man erst kommen.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const repo = (...parts: string[]) => resolve(process.cwd(), '..', ...parts);

/*
 * Gelesen wird die QUELLE, nicht eine Kopie.
 *
 * Die Liste steht in `rcApi.ts` und laesst sich von hier nicht einfuehren,
 * ohne den ganzen Netzweg mitzubringen — der braucht `fetch`, `crypto` und
 * einen Browser. Eine zweite Liste zum Abgleichen waere eine dritte Stelle,
 * an der derselbe Tippfehler stehen kann.
 */
const api = readFileSync('src/rc/lib/rcApi.ts', 'utf8');

const block = api.slice(
  api.indexOf('const SESSION_GONE'),
  api.indexOf(']);', api.indexOf('const SESSION_GONE'))
);

const listed = [...block.matchAll(/'([a-z._]+)'/g)].map((m) => m[1]);

// -- Was abmelden MUSS --------------------------------------------------------

/*
 * Alle drei bedeuten dasselbe fuer den Menschen davor: du bist draussen.
 *
 * `not_signed_in` ist der Fall aus dem Vorfall — kein Cookie, oder eines, das
 * sich nicht mehr oeffnen liess.
 */
for (const code of ['session.not_signed_in', 'session.expired', 'session.revoked']) {
  ok(`„${code}" meldet ab`, listed.includes(code), true);
}

ok('Und es sind genau diese drei', listed.length, 3);

// -- Was NICHT abmelden darf --------------------------------------------------

/*
 * Eine fehlende Berechtigung ist keine fehlende Sitzung. Wer eine Pfarrei
 * nicht verwalten darf, ist trotzdem angemeldet — ihn hinauszuwerfen waere
 * eine Strafe fuer eine Tuer, die er einmal angefasst hat.
 */
for (const code of [
  'permission.denied',
  'role.unreachable',
  'crypto.missing_epoch',
  'auth.csrf_missing',
  'parish.slug_not_allowed',
  'portal.revoked'
]) {
  ok(`„${code}" meldet NICHT ab`, listed.includes(code), false);
}

// -- Die Codes gibt es wirklich ----------------------------------------------

/*
 * Ein Code, den der Dienst nie schickt, ist eine Zeile, die nichts tut — und
 * sie faellt niemandem auf, weil nichts kaputtgeht. Geprueft wird deshalb
 * gegen die Aufzaehlung des Dienstes.
 */
const codes = readFileSync(repo('backend/Rc.Kernel/RcError.cs'), 'utf8');

for (const code of listed) {
  ok(`Der Dienst kennt „${code}"`, codes.includes(`"${code}"`), true);
}

// -- Der Weg hinaus ist verdrahtet -------------------------------------------

/*
 * Die Liste allein meldet niemanden ab. Ohne diese beiden Stellen bliebe sie
 * eine Aufzaehlung, die niemand liest — genau der Zustand, den sie beheben
 * soll.
 */
ok('Ein 401 loest das Abmelden aus', /failure\.status === 401 && SESSION_GONE\.has/.test(api), true);
ok('Das Oeffnungsstueck wird verworfen', /rcSessionGone[\s\S]{0,200}rcSetUnlockPiece\(null\)/.test(api), true);

const app = readFileSync('src/rc/RcApp.tsx', 'utf8');
ok('Die Anwendung hoert zu', app.includes('rcOnSessionGone('), true);
ok('Und meldet sich beim Abraeumen ab', /return \(\) => rcOnSessionGone\(null\)/.test(app), true);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
