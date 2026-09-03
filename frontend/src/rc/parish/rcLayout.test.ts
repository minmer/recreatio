/**
 * Das Raster der Pfarr-Startseite.
 *
 * <b>Warum gerade das geprüft wird.</b> Ein Fehler hier bleibt stumm: ein
 * Baustein landet eine Spalte daneben, zwei überlappen sich, oder ein Platz
 * gilt als frei, obwohl er es nicht ist. Man sieht es erst an der fertigen
 * Seite und kann dann nicht mehr sagen, ob es am Ziehen lag, am Einrasten oder
 * am Speichern.
 */

import {
  RC_COLUMNS, RC_COL_SPANS, RC_MAX_ROW_SPAN, RC_MIN_COL_SPAN,
  rcCanPlace, rcFirstFreeCell, rcFrameFor, rcSnapColSpan, rcSnapRowSpan,
  rcValidCells, rcWithFrame, type RcModule
} from './rcLayout';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const at = (id: string, row: number, col: number, colSpan: number, rowSpan: number): RcModule => ({
  id,
  type: 'news',
  layouts: { desktop: { position: { row, col }, size: { colSpan, rowSpan } } }
});

// -- Einrasten ----------------------------------------------------------------

ok('2 bleibt 2', rcSnapColSpan(2, 6), 2);
ok('3 bleibt 3', rcSnapColSpan(3, 6), 3);
ok('5 rastet auf 4 oder 6', [4, 6].includes(rcSnapColSpan(5, 6)), true);
ok('7 rastet auf 6 herunter', rcSnapColSpan(7, 6), 6);

/*
 * Auf dem Telefon gibt es zwei Spalten. Ohne die Beschränkung ragte ein
 * Baustein aus dem Raster und schöbe die Seite auf — auf genau dem Gerät, auf
 * dem am wenigsten Platz ist.
 */
ok('Auf zwei Spalten wird alles 2 breit', rcSnapColSpan(6, 2), 2);
ok('Auch eine 4', rcSnapColSpan(4, 2), 2);
ok('Auf vier Spalten gibt es keine 6', rcSnapColSpan(6, 4), 4);

ok('Kleine Höhen werden 1', rcSnapRowSpan(1), 1);
ok('Mittlere werden 3', rcSnapRowSpan(3), 3);
ok('Grosse werden 5', rcSnapRowSpan(5), 5);
ok('Und mehr geht nicht', rcSnapRowSpan(99), RC_MAX_ROW_SPAN);

// -- Belegung -----------------------------------------------------------------

/*
 * Ein Baustein belegt sein ganzes Rechteck und nicht nur seine linke obere
 * Ecke. Das ist der Fehler, den man beim Schreiben macht — und er fällt erst
 * auf, wenn zwei Bausteine übereinanderliegen.
 */
const one = [at('a', 1, 1, 3, 3)];

ok('Die eigene Ecke ist besetzt', rcCanPlace(one, { position: { row: 1, col: 1 }, size: { colSpan: 2, rowSpan: 1 } }, 6, 'desktop'), false);
ok('Die Mitte des Rechtecks auch', rcCanPlace(one, { position: { row: 2, col: 2 }, size: { colSpan: 2, rowSpan: 1 } }, 6, 'desktop'), false);
ok('Die letzte Zeile des Rechtecks auch', rcCanPlace(one, { position: { row: 3, col: 1 }, size: { colSpan: 2, rowSpan: 1 } }, 6, 'desktop'), false);
ok('Daneben ist frei', rcCanPlace(one, { position: { row: 1, col: 4 }, size: { colSpan: 3, rowSpan: 1 } }, 6, 'desktop'), true);
ok('Darunter ist frei', rcCanPlace(one, { position: { row: 4, col: 1 }, size: { colSpan: 3, rowSpan: 1 } }, 6, 'desktop'), true);

// -- Der Rand -----------------------------------------------------------------

ok('Was rechts hinausragt, passt nicht', rcCanPlace([], { position: { row: 1, col: 5 }, size: { colSpan: 3, rowSpan: 1 } }, 6, 'desktop'), false);
ok('Was genau aufgeht, passt', rcCanPlace([], { position: { row: 1, col: 4 }, size: { colSpan: 3, rowSpan: 1 } }, 6, 'desktop'), true);
ok('Zeile 0 gibt es nicht', rcCanPlace([], { position: { row: 0, col: 1 }, size: { colSpan: 2, rowSpan: 1 } }, 6, 'desktop'), false);
ok('Spalte 0 auch nicht', rcCanPlace([], { position: { row: 1, col: 0 }, size: { colSpan: 2, rowSpan: 1 } }, 6, 'desktop'), false);

// -- Sich selbst im Weg -------------------------------------------------------

/*
 * Wer einen Baustein verschiebt, darf ihn dorthin legen, wo er schon liegt.
 * Ohne `exclude` verbietet sich jeder Baustein seinen eigenen Platz — und dann
 * lässt sich nichts mehr bewegen, sobald die Seite etwas voller ist.
 */
ok(
  'Der bewegte Baustein steht sich nicht selbst im Weg',
  rcCanPlace(one, { position: { row: 1, col: 1 }, size: { colSpan: 3, rowSpan: 3 } }, 6, 'desktop', 'a'),
  true
);

// -- Freie Zellen -------------------------------------------------------------

const { valid, rows } = rcValidCells(one, { colSpan: 3, rowSpan: 1 }, 6, 'desktop');

ok('Neben dem Baustein ist Platz', valid.has('1:4'), true);
ok('Auf ihm nicht', valid.has('1:1'), false);
ok('Und nicht dort, wo er rechts hinausragte', valid.has('1:5'), false);

/*
 * Das Raster wächst nach unten mit. Ohne freie Zeilen unter dem Belegten gäbe
 * es keinen Platz, an den man etwas ziehen kann, sobald die Seite voll ist —
 * der Editor wäre an dem Tag zu Ende, an dem er gebraucht wird.
 */
ok('Unter dem Belegten bleiben Zeilen frei', rows >= 3 + 4, true);
ok('Und dort ist wirklich Platz', valid.has(`${rows}:1`), true);

// -- Der erste freie Platz ----------------------------------------------------

ok('Auf leerer Seite oben links', rcFirstFreeCell([], { colSpan: 2, rowSpan: 1 }, 6, 'desktop'), { row: 1, col: 1 });

ok(
  'Sonst die erste Lücke, von oben links gelesen',
  rcFirstFreeCell(one, { colSpan: 3, rowSpan: 1 }, 6, 'desktop'),
  { row: 1, col: 4 }
);

// -- Bildschirmgrössen --------------------------------------------------------

const solo: RcModule = at('a', 2, 3, 6, 3);

ok('Die eigene Anordnung gewinnt', rcFrameFor(solo, 'desktop').position, { row: 2, col: 3 });

/*
 * Ohne eigene Anordnung wird die des Schreibtischs eingerastet — und die
 * Spalte in das schmalere Raster gezogen. Ein Baustein, der auf dem Telefon
 * in Spalte 3 von zwei stünde, wäre unsichtbar.
 */
const small = rcFrameFor(solo, 'mobile');
ok('Auf dem Telefon rastet die Breite ein', small.size.colSpan, 2);
ok('Und die Spalte bleibt im Raster', small.position.col <= RC_COLUMNS.mobile, true);

// -- Setzen -------------------------------------------------------------------

const moved = rcWithFrame(solo, 'mobile', { position: { row: 1, col: 1 }, size: { colSpan: 2, rowSpan: 1 } });

ok('Die gesetzte Anordnung steht da', rcFrameFor(moved, 'mobile').position, { row: 1, col: 1 });
ok('Und die andere bleibt unberuehrt', rcFrameFor(moved, 'desktop').position, { row: 2, col: 3 });

// -- Die Zahlen selbst --------------------------------------------------------

ok('Sechs Spalten am Schreibtisch', RC_COLUMNS.desktop, 6);
ok('Vier auf dem Tablet', RC_COLUMNS.tablet, 4);
ok('Zwei auf dem Telefon', RC_COLUMNS.mobile, 2);
ok('Die Breiten sind die alten', [...RC_COL_SPANS], [2, 3, 4, 6]);
ok('Die kleinste Breite ist zwei', RC_MIN_COL_SPAN, 2);

/* Jede erlaubte Breite geht in sechs Spalten auf oder füllt sie. */
ok('Alle Breiten passen in sechs Spalten', RC_COL_SPANS.every((s) => s <= 6), true);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
