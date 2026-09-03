/**
 * Grösse ändern durch Ziehen an einer Kante.
 *
 * <b>Der Fehler, den man hier macht</b>, ist beim Ziehen an der LINKEN Kante:
 * es ist naheliegend, die Breite zu ändern und die Spalte stehenzulassen — dann
 * wächst der Baustein nach rechts, obwohl links gezogen wurde. Man merkt es
 * erst, wenn der Nachbar wegspringt.
 */

import { rcCells, rcResized, type RcHandle } from './rcResize';
import type { RcFrame } from './rcLayout';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const frame = (row: number, col: number, colSpan: number, rowSpan: number): RcFrame =>
  ({ position: { row, col }, size: { colSpan, rowSpan } });

// -- Nach rechts ziehen -------------------------------------------------------

ok(
  'Rechts ziehen macht breiter, der Anfang bleibt',
  rcResized(frame(1, 1, 2, 1), 'right', 1, 0, 6),
  frame(1, 1, 3, 1)
);

ok(
  'Rechts weit ziehen rastet auf die naechste Breite',
  rcResized(frame(1, 1, 2, 1), 'right', 2, 0, 6),
  frame(1, 1, 4, 1)
);

// -- Nach links ziehen: DIE Stelle --------------------------------------------

/*
 * Der Baustein steht in Spalte 3 und ist 2 breit — er endet also mit Spalte 4.
 * Zieht man die linke Kante eine Spalte nach links, muss er in Spalte 2
 * beginnen und 3 breit sein. Das ENDE bleibt bei Spalte 4.
 */
{
  const out = rcResized(frame(1, 3, 2, 1), 'left', -1, 0, 6);
  ok('Links ziehen: der Anfang wandert', out?.position.col, 2);
  ok('Links ziehen: die Breite waechst', out?.size.colSpan, 3);
  ok(
    'Links ziehen: das Ende bleibt stehen',
    out === null ? null : out.position.col + out.size.colSpan - 1,
    4
  );
}

/*
 * Und nach dem Einrasten stimmt es immer noch. Käme 2.4 heraus und rastete auf
 * 3, dürfte der Baustein trotzdem nicht rechts über seine alte Kante wachsen.
 */
{
  const out = rcResized(frame(1, 4, 3, 1), 'left', -2, 0, 6);
  ok(
    'Auch nach dem Einrasten bleibt das Ende stehen',
    out === null ? null : out.position.col + out.size.colSpan - 1,
    6
  );
}

// -- Oben und unten -----------------------------------------------------------

ok('Unten ziehen macht hoeher', rcResized(frame(1, 1, 2, 1), 'bottom', 0, 2, 6), frame(1, 1, 2, 3));

{
  const out = rcResized(frame(3, 1, 2, 3), 'top', 0, -2, 6);
  ok('Oben ziehen: der Anfang wandert nach oben', out?.position.row, 1);
  ok('Oben ziehen: die Hoehe waechst', out?.size.rowSpan, 5);
  ok(
    'Oben ziehen: der Fuss bleibt stehen',
    out === null ? null : out.position.row + out.size.rowSpan - 1,
    5
  );
}

// -- Ecken bewegen beide Kanten ----------------------------------------------

{
  const out = rcResized(frame(1, 1, 2, 1), 'bottom-right', 1, 2, 6);
  ok('Die Ecke macht breiter UND hoeher', out, frame(1, 1, 3, 3));
}

// -- Was nicht geht -----------------------------------------------------------

ok('Ueber den rechten Rand hinaus: nichts', rcResized(frame(1, 5, 2, 1), 'right', 2, 0, 6), null);
ok('Ueber den linken Rand hinaus: nichts', rcResized(frame(1, 1, 2, 1), 'left', -2, 0, 6), null);
ok('Ueber die erste Zeile hinaus: nichts', rcResized(frame(1, 1, 2, 1), 'top', 0, -2, 6), null);

/* Eine Bewegung, aus der dasselbe herauskommt, ist keine — der Aufrufer soll
   nicht bei jedem Pixel neu setzen. */
ok('Keine Aenderung ergibt nichts', rcResized(frame(1, 1, 2, 1), 'right', 0, 0, 6), null);

/* Unter das Mindestmass geht es nicht: zwei Spalten sind die kleinste Breite. */
{
  const out = rcResized(frame(1, 1, 4, 1), 'right', -5, 0, 6);
  ok('Schmaler als zwei Spalten wird es nicht', out?.size.colSpan, 2);
}

// -- Das schmale Raster -------------------------------------------------------

/*
 * Auf dem Telefon gibt es zwei Spalten. Jeder Zug endet dort bei 2 — und darf
 * nicht in einen Zustand führen, der aus dem Raster ragt.
 */
{
  const out = rcResized(frame(1, 1, 2, 1), 'right', 3, 0, 2);
  ok('Auf zwei Spalten bleibt es bei zwei', out, null);
}

// -- Pixel in Zellen ----------------------------------------------------------

ok('Eine halbe Zelle rundet auf', rcCells(50, 100), 1);
ok('Weniger als die halbe rundet ab', rcCells(40, 100), 0);
ok('Rueckwaerts genauso', rcCells(-50, 100), -1);
ok('Zwei Zellen sind zwei', rcCells(200, 100), 2);
ok('Ohne Zellbreite passiert nichts', rcCells(200, 0), 0);

// -- Jeder Griff tut ueberhaupt etwas ----------------------------------------

/*
 * Ein Griff, der nichts bewegt, ist ein Griff, den jemand vergeblich zieht.
 * Geprüft wird nur, DASS er wirkt — was er tut, steht oben.
 */
const handles: RcHandle[] = [
  'left', 'right', 'top', 'bottom',
  'top-left', 'top-right', 'bottom-left', 'bottom-right'
];

for (const handle of handles) {
  const out = rcResized(frame(3, 3, 2, 3), handle, handle.includes('left') ? -1 : 1, handle.includes('top') ? -2 : 2, 6);
  ok(`Der Griff „${handle}" bewirkt etwas`, out !== null, true);
}

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
