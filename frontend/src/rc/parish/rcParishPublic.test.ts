/**
 * Die öffentlich erreichbaren Pfarrseiten.
 *
 * <b>Zwei Listen, die auseinanderlaufen können.</b> `RC_ALLOWED_SLUGS` sagt,
 * welche Namen vergeben werden DÜRFEN; `RC_PARISH_PUBLIC` sagt, welche Seiten
 * es GIBT. Das sind verschiedene Dinge — aber eine Seite unter einem Namen,
 * den der Server gar nicht zulässt, kann nicht existieren.
 *
 * Genau das fiele sonst niemandem auf: das Verzeichnis führte einen Verweis,
 * der Server wiese die Adresse ab, und man sähe eine leere Seite statt einer
 * Erklärung.
 */

import { RC_PARISH_PUBLIC, rcPublicParishes } from './rcParishPublic';
import { rcIsAllowedSlug, rcIsSlug } from '../lib/rcSlugs';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const slugs = Object.keys(RC_PARISH_PUBLIC);

// -- Jede öffentliche Seite steht auch auf der erlaubten Liste ----------------

for (const slug of slugs) {
  ok(`„${slug}" ist ein gueltiger Name`, rcIsSlug(slug), true);
  ok(`„${slug}" ist fuer Pfarreien zugelassen`, rcIsAllowedSlug('parish', slug), true);
}

// -- Und trägt einen Namen, der kein Slug ist ---------------------------------

/*
 * Der Sinn der Liste. Stünde als Name „grzegorzki", wäre sie überflüssig — dann
 * könnte das Verzeichnis die Adresse anzeigen. Sie existiert, weil Menschen
 * ihre Pfarrei unter „św. Grzegorza Wielkiego" suchen.
 */
for (const [slug, parish] of Object.entries(RC_PARISH_PUBLIC)) {
  ok(`„${slug}" traegt einen anderen Namen als die Adresse`, parish.name === slug, false);
  ok(`„${slug}" hat einen nicht leeren Namen`, parish.name.trim().length > 0, true);
  ok(`„${slug}" nennt einen Ort`, parish.place.trim().length > 0, true);
  ok(`„${slug}" hat einen Satz fuers Verzeichnis`, parish.lead.trim().length > 0, true);
}

// -- Die Reihenfolge ----------------------------------------------------------

const listed = rcPublicParishes();

ok('Es werden alle aufgezaehlt', listed.length, slugs.length);
ok('Jeder Eintrag traegt seine Adresse mit', listed.every((p) => slugs.includes(p.slug)), true);

/*
 * Nach dem NAMEN sortiert und nicht nach der Adresse: das Verzeichnis wird
 * gelesen, nicht getippt. Polnische Sortierung, damit „Ś" nicht ans Ende fällt.
 */
const names = listed.map((p) => p.name);
const sorted = [...names].sort((a, b) => a.localeCompare(b, 'pl'));
ok('Nach dem Namen sortiert', names, sorted);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
