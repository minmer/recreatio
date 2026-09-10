/**
 * Die Kurve des Übergangs.
 *
 * Geprüft wird nicht, ob sie sich gut anfühlt — das kann keine Prüfreihe.
 * Geprüft wird das eine, was sich beim Lesen nicht zeigt und beim Scrollen nur
 * als schlechtes Gefühl ankommt: dass die Bewegung nie über ihr Ziel
 * hinausläuft und nie zurückfährt.
 */

import { rcGlide, rcGlideSlope, rcGlideLead, RC_GLIDE_MAX } from './rcGlide';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

function near(name: string, actual: number, expected: number, tol = 1e-9): void {
  if (Math.abs(actual - expected) <= tol) passed++;
  else failures.push(`  ${name}\n    erwartet: ${expected}\n    erhalten: ${actual}`);
}

// -- Die Enden liegen fest ----------------------------------------------------

for (const m of [0, 1, 2, RC_GLIDE_MAX]) {
  near(`m=${m}: fängt bei null an`, rcGlide(0, m), 0);
  near(`m=${m}: kommt genau an`, rcGlide(1, m), 1);
}

// -- Die Anfangssteigung ist die vorgegebene ----------------------------------

// Das ist der ganze Zweck: der Übergang fängt mit der Geschwindigkeit an, mit
// der die Hand schiebt. Stimmte das nicht, wäre er eine zweite Bewegung neben
// der Geste statt ihre Fortsetzung.
for (const m of [0, 0.5, 1.7, RC_GLIDE_MAX]) {
  near(`m=${m}: Anfangssteigung`, rcGlideSlope(0, m), m);
  near(`m=${m}: Endsteigung ist null`, rcGlideSlope(1, m), 0);
}

// -- Kein Überschwingen bis zur Grenze ----------------------------------------

{
  const violations: string[] = [];

  for (let mi = 0; mi <= RC_GLIDE_MAX * 20; mi++) {
    const m = mi / 20;
    let previous = -1;

    for (let i = 0; i <= 1000; i++) {
      const p = rcGlide(i / 1000, m);
      if (p < previous - 1e-12) { violations.push(`m=${m} fällt zurück`); break; }
      if (p > 1 + 1e-9) { violations.push(`m=${m} schwingt über`); break; }
      previous = p;
    }
  }

  ok('Bis zur Grenze läuft die Kurve monoton und über nichts hinaus', violations, []);
}

// Und die Grenze ist wirklich die Grenze — sonst wäre die Deckelung eine
// willkürliche Zahl, die beim nächsten Anfassen jemand höher setzt.
{
  let over = 0;
  for (let i = 0; i <= 1000; i++) over = Math.max(over, rcGlide(i / 1000, RC_GLIDE_MAX + 0.1));

  ok('Knapp über der Grenze schwingt sie über', over > 1 + 1e-9, true);
}

// -- Ohne Anfangssteigung die gewöhnliche Ausblendkurve -----------------------

near('m=0 ist die glatte Ausblendkurve', rcGlide(0.5, 0), 0.5);
near('m=0: die Hälfte der Zeit, die Hälfte des Weges', rcGlide(0.25, 0), 0.15625);

// -- Die Umrechnung aus einer Geschwindigkeit ---------------------------------

// 0.5 px/ms über 700 ms sind 350 px — die Hälfte einer Strecke von 700 px.
near('Halbe Strecke in der ganzen Zeit ergibt Steigung 0.5', rcGlideLead(0.5, 700, 700), 0.5);

ok('Ein harter Wurf wird gedeckelt', rcGlideLead(9, 700, 540), RC_GLIDE_MAX);
ok('Eine Hand, die dagegen schiebt, zählt nicht', rcGlideLead(-4, 700, 540), 0);
ok('Ohne Strecke keine Steigung', rcGlideLead(2, 700, 0), 0);
ok('Ohne Zeit keine Steigung', rcGlideLead(2, 0, 540), 0);

// Rückwärts ist derselbe Fall mit umgekehrten Vorzeichen: beide negativ, der
// Quotient positiv. Sonst führe jeder Schritt nach oben mit Steigung null an.
near('Rückwärts zählt die Geschwindigkeit genauso', rcGlideLead(-0.5, 700, -700), 0.5);

// -- Der Anschluss: ein Übergang geht in den nächsten -------------------------

// Wird auf halbem Weg neu gezielt, darf die Geschwindigkeit nicht springen.
{
  const span = 700;
  const reach = 600;
  const jumps: string[] = [];

  for (const [k, m] of [[0.2, 1.5], [0.5, 0.8], [0.85, 3]] as const) {
    const here = (rcGlideSlope(k, m) * reach) / span;
    const left = span * (1 - k);
    const rest = reach * (1 - rcGlide(k, m));

    const lead = rcGlideLead(here, left, rest);
    const after = (rcGlideSlope(0, lead) * rest) / left;

    if (Math.abs(here - after) > 1e-9) jumps.push(`k=${k}: ${here} → ${after}`);
  }

  ok('Beim Anschluss springt die Geschwindigkeit nicht', jumps, []);
}

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
