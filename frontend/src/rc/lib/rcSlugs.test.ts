/**
 * Die Namen einzelner Dinge.
 *
 * Geprüft wird vor allem, was NICHT durchgeht. Ein Name, der in zwei
 * Schreibweisen existiert, ist zwei Dinge; einer mit polnischen
 * Sonderzeichen überlebt nicht jeden Weg, auf dem eine Adresse weitergegeben
 * wird. Beides fällt erst auf, wenn jemand einen Link verschickt hat.
 */

import { rcIsSlug, rcAllowedSlugs, rcIsAllowedSlug, RC_ALLOWED_SLUGS } from './rcSlugs';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Was ein Name sein darf ---------------------------------------------------

for (const good of ['grzegorzki', 'jan', 'sw-jan', 'limanowa-2026', 'a', 'x1']) {
  ok(`„${good}" ist ein Name`, rcIsSlug(good), true);
}

// -- Und was nicht ------------------------------------------------------------

const bad: readonly [string, string][] = [
  ['Grzegorzki', 'Grossbuchstaben — sonst wären es zwei Dinge'],
  ['grzegórzki', 'polnische Diakritika'],
  ['św-jan', 'polnische Diakritika'],
  ['', 'leer'],
  ['-jan', 'Bindestrich am Anfang'],
  ['jan-', 'Bindestrich am Ende'],
  ['jan--pawel', 'zwei Bindestriche nebeneinander'],
  ['jan pawel', 'Leerzeichen'],
  ['jan.pawel', 'Punkt — sähe aus wie ein Dateiname'],
  ['jan/pawel', 'Schrägstrich — wäre ein weiteres Segment'],
  ['jan?x', 'Fragezeichen — beginnt die Abfrage'],
  ['jan#x', 'Raute'],
  ['jan_pawel', 'Unterstrich'],
  ['ja n', 'Leerzeichen in der Mitte'],
  ['x'.repeat(49), 'zu lang']
];

for (const [word, why] of bad) {
  ok(`„${word}" ist keiner (${why})`, rcIsSlug(word), false);
}

// -- Die Liste ----------------------------------------------------------------

ok('Grzegorzki darf angelegt werden', rcIsAllowedSlug('parish', 'grzegorzki'), true);
ok('Ein nicht vorgesehener Name darf nicht', rcIsAllowedSlug('parish', 'jan'), false);
ok('Ein Teil ohne Eintrag hat keine Namen', rcAllowedSlugs('account'), []);
ok('Ein Teil mit leerem Eintrag ebenso', rcAllowedSlugs('event'), []);

/*
 * Die wichtigste Zusicherung der Datei: JEDER eingetragene Name muss die Form
 * erfüllen. Sonst steht in der Liste eine Adresse, die es nicht geben kann —
 * und die öffentliche Seite verlinkt sie.
 */
{
  const wrong: string[] = [];
  for (const [part, slugs] of Object.entries(RC_ALLOWED_SLUGS)) {
    for (const slug of slugs as readonly string[]) {
      if (!rcIsSlug(slug)) wrong.push(`${part}/${slug}`);
    }
  }
  ok('Jeder eingetragene Name hat die richtige Form', wrong, []);
}

/* Und keiner doppelt — zwei gleiche Einträge wären zwei Verweise auf eines. */
{
  const twice: string[] = [];
  for (const [part, slugs] of Object.entries(RC_ALLOWED_SLUGS)) {
    const list = slugs as readonly string[];
    if (new Set(list).size !== list.length) twice.push(part);
  }
  ok('Kein Name steht doppelt', twice, []);
}

/*
 * `invite` darf NIE in der Liste stehen: sein Name ist das Geheimnis der
 * Einladung, und eine Liste davon wäre eine Liste offener Türen.
 */
ok(
  'Einladungen stehen nicht in der Liste',
  Object.prototype.hasOwnProperty.call(RC_ALLOWED_SLUGS, 'invite'),
  false
);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
