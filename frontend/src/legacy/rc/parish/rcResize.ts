/**
 * Grösse ändern durch Ziehen an einer Kante.
 *
 * <b>Warum das gerechnet und nicht gemessen wird.</b> Der Zeiger bewegt sich in
 * Pixeln, das Raster zählt in Zellen. Dazwischen steht eine Umrechnung, und die
 * ist der Ort, an dem es schiefgeht: ein Baustein wächst um zwei Spalten
 * statt einer, oder er wächst nach rechts, obwohl links gezogen wurde.
 *
 * <b>Ziehen an der linken Kante bewegt die Kante, nicht den Baustein.</b> Das
 * ist der Unterschied, den man beim Schreiben übersieht: die rechte Kante bleibt
 * stehen, also ändern sich Spalte UND Breite gegenläufig. Zieht man 2 Spalten
 * nach links, beginnt er 2 früher und ist 2 breiter.
 *
 * Reine Rechnerei, damit sie prüfbar ist — die Zeigerereignisse stehen im
 * Bauteil.
 */

import { rcSnapColSpan, rcSnapRowSpan, RC_MAX_ROW_SPAN, RC_MIN_COL_SPAN, type RcFrame } from './rcLayout';

export type RcHandle =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Welche Kanten ein Griff bewegt. */
const MOVES: Record<RcHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  'top-left': { x: -1, y: -1 },
  'top-right': { x: 1, y: -1 },
  'bottom-left': { x: -1, y: 1 },
  'bottom-right': { x: 1, y: 1 }
};

/**
 * Die neue Anordnung, wenn ein Griff um so viele ZELLEN gezogen wurde.
 *
 * <c>dCol</c> und <c>dRow</c> sind bereits in Zellen umgerechnet — das Bauteil
 * teilt die Pixel durch Zellbreite und Zellhöhe. Hier steht, was daraus folgt.
 *
 * Gibt <c>null</c> zurück, wenn nichts Sinnvolles herauskäme: eine Breite
 * unter dem Mindestmass, ein Anfang links vom Raster, ein Ende rechts davon.
 * Der Aufrufer lässt die alte Anordnung dann einfach stehen.
 */
export function rcResized(
  frame: RcFrame,
  handle: RcHandle,
  dCol: number,
  dRow: number,
  columns: number
): RcFrame | null {
  const move = MOVES[handle];

  let { row, col } = frame.position;
  let { colSpan, rowSpan } = frame.size;

  if (move.x === 1) {
    colSpan = colSpan + dCol;
  } else if (move.x === -1) {
    // Die rechte Kante bleibt, wo sie ist: die linke wandert, und die Breite
    // ändert sich gegenläufig.
    col = col + dCol;
    colSpan = colSpan - dCol;
  }

  if (move.y === 1) {
    rowSpan = rowSpan + dRow;
  } else if (move.y === -1) {
    row = row + dRow;
    rowSpan = rowSpan - dRow;
  }

  const snappedCols = rcSnapColSpan(Math.max(RC_MIN_COL_SPAN, colSpan), columns);
  const snappedRows = rcSnapRowSpan(Math.max(1, Math.min(RC_MAX_ROW_SPAN, rowSpan)));

  /*
   * Nach dem Einrasten muss die Kante nachgezogen werden, die NICHT bewegt
   * wurde. Zieht man links auf 3 Spalten Breite, während 2.4 herauskam, würde
   * der Baustein sonst rechts über seine alte Kante hinauswachsen — man hätte
   * links gezogen und rechts etwas verschoben.
   */
  if (move.x === -1) col = frame.position.col + frame.size.colSpan - snappedCols;
  if (move.y === -1) row = frame.position.row + frame.size.rowSpan - snappedRows;

  if (row < 1 || col < 1) return null;
  if (col + snappedCols - 1 > columns) return null;

  const same =
    row === frame.position.row && col === frame.position.col
    && snappedCols === frame.size.colSpan && snappedRows === frame.size.rowSpan;

  return same ? null : { position: { row, col }, size: { colSpan: snappedCols, rowSpan: snappedRows } };
}

/**
 * Pixel in Zellen — mit der halben Zelle als Umschlagpunkt.
 *
 * <b>Vom Nullpunkt weg gerundet, nicht mit `Math.round`.</b> Jenes rundet
 * immer nach oben: `0.5` wird 1, aber `-0.5` wird 0. Damit fasst sich das
 * Ziehen nach links zaeher an als nach rechts — man zieht eine halbe Zelle
 * und nichts geschieht, waehrend dieselbe Bewegung nach rechts schon greift.
 * Auffallen wuerde das nur als „irgendwie hakelig".
 */
export const rcCells = (pixels: number, cellSize: number): number => {
  if (cellSize <= 0) return 0;
  const exact = pixels / cellSize;
  return Math.sign(exact) * Math.round(Math.abs(exact));
};
