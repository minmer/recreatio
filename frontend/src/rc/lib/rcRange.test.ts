/**
 * §1.6a — Bereiche als Text.
 *
 * Die Frage, die diese Funktionen beantworten, ist nicht „wie sieht es hübsch
 * aus", sondern: **was behauptet die Darstellung?** Ein offenes Ende
 * wegzulassen sieht aus wie ein vergessenes Feld; ein ungefähres Datum als
 * genaues zu zeigen ist eine Genauigkeit, die es nicht gibt; zwei Abschnitte
 * als zwei Werte zu zeigen behauptet zwei Regierungen statt einer mit
 * Unterbrechung.
 */

import { rcRangeText, rcSegmentText, type RcSegment } from './rcGraph';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

function seg(over: Partial<RcSegment> = {}): RcSegment {
  return {
    sortOrder: 0,
    valueType: 'date',
    from: '0992',
    to: '1000',
    fromState: 'inclusive',
    toState: 'inclusive',
    ...over
  } as RcSegment;
}

// -- Der einfache Fall --------------------------------------------------------

ok('Ein geschlossener Abschnitt', rcSegmentText(seg()), '0992–1000');

// Ohne Ende ist ein PUNKT, kein halber Bereich.
ok('Ohne Ende ist es ein Punkt',
  rcSegmentText(seg({ to: null })), '0992');

// -- Was die Darstellung behaupten darf ---------------------------------------

// Ein offenes Ende wegzulassen sähe aus wie ein vergessenes Feld. „Ab 1002"
// ist eine Aussage und muss als solche erkennbar sein.
ok('Ein offenes Ende wird gezeigt, nicht weggelassen',
  rcSegmentText(seg({ from: '1002', to: null, toState: 'open' })), '1002 …');

ok('Und das Zeichen dafür lässt sich wählen',
  rcSegmentText(seg({ from: '1002', to: null, toState: 'open' }), '→'), '1002 →');

// Ein ungefähres Datum als genaues zu zeigen ist eine Genauigkeit, die es
// nicht gibt.
ok('Ungefähr steht dabei — am Anfang',
  rcSegmentText(seg({ fromState: 'approximate' })), '~0992–1000');

ok('Und am Ende',
  rcSegmentText(seg({ toState: 'approximate' })), '0992–~1000');

ok('Und an beiden',
  rcSegmentText(seg({ fromState: 'approximate', toState: 'approximate' })), '~0992–~1000');

// Ein offenes Ende schlägt „ungefähr": es gibt kein ungefähres Ende, wenn es
// gar kein Ende gibt.
ok('Offen schlägt ungefähr',
  rcSegmentText(seg({ to: null, toState: 'open', fromState: 'approximate' })), '~0992 …');

// -- Mehrere Abschnitte sind EIN Wert -----------------------------------------

{
  const reign = [
    seg({ sortOrder: 0, from: '0992', to: '1000' }),
    seg({ sortOrder: 1, from: '1002', to: '1025' })
  ];

  // Eine Regierung mit einer Unterbrechung — nicht zwei Regierungen.
  ok('Zwei Abschnitte stehen als ein Wert da',
    rcRangeText(reign), '0992–1000, 1002–1025');

  ok('Das Trennzeichen lässt sich wählen',
    rcRangeText(reign, ' · '), '0992–1000 · 1002–1025');
}

// Ein Bereich ohne Abschnitte ist die Aussage „hier gehört ein Zeitraum hin,
// wir kennen ihn noch nicht" — und ergibt eine leere Zeichenkette, keinen
// Fehler.
ok('Ein leerer Bereich ergibt nichts, aber keinen Fehler', rcRangeText([]), '');

// Zahlen und Text laufen durch dieselbe Darstellung: ein Manuskript, das auf
// den Seiten 3–7 und 41–43 zitiert wird, ist derselbe Fall wie eine Regierung.
{
  const pages = [
    seg({ valueType: 'number', from: '3', to: '7' }),
    seg({ valueType: 'number', from: '41', to: '43' })
  ];
  ok('Seitenzahlen sind derselbe Fall', rcRangeText(pages), '3–7, 41–43');
}

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
