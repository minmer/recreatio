/**
 * Das Raster einer Seite — reine Rechnerei.
 *
 * <b>Warum das hier steht und nicht im Bauteil.</b> Welche Zellen frei sind,
 * wohin ein Baustein passt, auf welche Grösse eine gezogene Kante einrastet:
 * im Bauteil verschränkt sich das mit Zuständen, Zeigerereignissen und React —
 * und dann lässt es sich nicht mehr prüfen, obwohl es genau der Teil ist, bei
 * dem ein Fehler stumm bleibt. Ein Baustein landet eine Spalte daneben, zwei
 * überlappen sich, und man sieht es erst an der fertigen Seite.
 *
 * <b>Die Zahlen sind nicht erfunden</b>, sondern aus der Pfarrseite des
 * Altbestands übernommen: sechs Spalten am Schreibtisch, vier auf dem Tablet,
 * zwei auf dem Telefon. Breiten rasten auf 2, 3, 4 oder 6 ein, Höhen auf 1, 3
 * oder 5.
 *
 * <b>Warum Rastermasse und keine freien Grössen.</b> Ein Baustein, der 2,7
 * Spalten breit sein darf, ergibt eine Seite, auf der nichts mit nichts
 * fluchtet — und der Mensch davor kann es nicht ausrichten, weil es keine Linie
 * gibt, an der etwas ausgerichtet wäre. Einrasten ist keine Bevormundung, es
 * ist die Linie.
 */

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

export const COLUMNS: Record<Breakpoint, number> = { desktop: 6, tablet: 4, mobile: 2 };

/** Die erlaubten Breiten. Alles dazwischen rastet auf die nächste ein. */
export const COL_SPANS = [2, 3, 4, 6] as const;

export const MIN_COL_SPAN = 2;
export const MIN_ROW_SPAN = 1;
export const MAX_ROW_SPAN = 5;

export interface Frame {
  readonly position: { readonly row: number; readonly col: number };
  readonly size: { readonly colSpan: number; readonly rowSpan: number };
}

export type Layout = Partial<Record<Breakpoint, Frame>>;

/** Ein Baustein, so weit das Raster ihn kennt: Kennung, Art, Anordnung. */
export interface Placed {
  readonly id: string;
  readonly kind: string;
  readonly layout: Layout;
}

/**
 * Die nächstliegende erlaubte Breite, die in die Spaltenzahl passt.
 *
 * Auf dem Telefon gibt es zwei Spalten; dort fallen 3, 4 und 6 weg. Ohne diese
 * Beschränkung ragte ein Baustein aus dem Raster und schöbe die ganze Seite auf
 * — auf genau dem Gerät, auf dem am wenigsten Platz ist.
 */
export const snapColSpan = (value: number, columns: number): number => {
  const usable = COL_SPANS.filter((span) => span <= columns);
  if (usable.length === 0) return columns;

  return usable.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best);
};

/** Höhen rasten auf 1, 3 oder 5 — eine Zeile, ein Block, eine Spalte. */
export const snapRowSpan = (value: number): number => {
  if (value <= 2) return 1;
  if (value <= 4) return 3;
  return MAX_ROW_SPAN;
};

/**
 * Die Anordnung für eine Bildschirmgrösse.
 *
 * Fehlt sie, wird die des Schreibtischs genommen und eingerastet — ein
 * Baustein ohne eigene Anordnung für das Telefon soll dort nicht verschwinden,
 * sondern so gut wie möglich erscheinen.
 */
export const frameFor = (part: Placed, breakpoint: Breakpoint): Frame => {
  const own = part.layout[breakpoint];
  if (own !== undefined) return own;

  const fallback = part.layout.desktop ?? {
    position: { row: 1, col: 1 },
    size: { colSpan: MIN_COL_SPAN, rowSpan: MIN_ROW_SPAN }
  };

  const columns = COLUMNS[breakpoint];
  return {
    position: { row: fallback.position.row, col: Math.min(fallback.position.col, columns) },
    size: {
      colSpan: snapColSpan(fallback.size.colSpan, columns),
      rowSpan: snapRowSpan(fallback.size.rowSpan)
    }
  };
};

/** Welche Zellen belegt sind — je Baustein sein ganzes Rechteck. */
function occupancy(
  parts: readonly Placed[], columns: number, breakpoint: Breakpoint, exclude?: string | null
): { taken: Set<string>; maxRow: number } {
  const taken = new Set<string>();
  let maxRow = 4;

  for (const part of parts) {
    if (exclude != null && part.id === exclude) continue;

    const frame = frameFor(part, breakpoint);
    const colSpan = snapColSpan(frame.size.colSpan, columns);
    const rowSpan = snapRowSpan(frame.size.rowSpan);

    maxRow = Math.max(maxRow, frame.position.row + rowSpan - 1);

    for (let r = frame.position.row; r < frame.position.row + rowSpan; r += 1) {
      for (let c = frame.position.col; c < frame.position.col + colSpan; c += 1) {
        taken.add(`${r}:${c}`);
      }
    }
  }

  return { taken, maxRow };
}

/**
 * Wohin ein Baustein dieser Grösse passt.
 *
 * <b>Das Raster wächst nach unten mit.</b> Vier Zeilen über dem tiefsten
 * belegten Punkt bleiben frei — sonst gäbe es keinen Platz, an den man etwas
 * ziehen kann, sobald die Seite einmal voll ist, und der Editor wäre an dem Tag
 * zu Ende, an dem er gebraucht wird.
 */
export function validCells(
  parts: readonly Placed[],
  size: { colSpan: number; rowSpan: number },
  columns: number,
  breakpoint: Breakpoint,
  exclude?: string | null
): { valid: Set<string>; rows: number; size: { colSpan: number; rowSpan: number } } {
  const { taken, maxRow } = occupancy(parts, columns, breakpoint, exclude);

  const snapped = {
    colSpan: snapColSpan(size.colSpan, columns),
    rowSpan: snapRowSpan(size.rowSpan)
  };

  const rows = Math.max(4, maxRow + 4);
  const valid = new Set<string>();

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= columns; col += 1) {
      if (col + snapped.colSpan - 1 > columns) continue;

      let clash = false;
      for (let r = row; r < row + snapped.rowSpan && !clash; r += 1) {
        for (let c = col; c < col + snapped.colSpan; c += 1) {
          if (taken.has(`${r}:${c}`)) { clash = true; break; }
        }
      }

      if (!clash) valid.add(`${row}:${col}`);
    }
  }

  return { valid, rows, size: snapped };
}

/** Passt dieser Baustein genau hierhin? */
export function canPlace(
  parts: readonly Placed[],
  frame: Frame,
  columns: number,
  breakpoint: Breakpoint,
  exclude?: string | null
): boolean {
  const colSpan = snapColSpan(frame.size.colSpan, columns);
  const rowSpan = snapRowSpan(frame.size.rowSpan);
  const { row, col } = frame.position;

  if (row < 1 || col < 1) return false;
  if (col + colSpan - 1 > columns) return false;

  const { taken } = occupancy(parts, columns, breakpoint, exclude);

  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + colSpan; c += 1) {
      if (taken.has(`${r}:${c}`)) return false;
    }
  }

  return true;
}

/**
 * Der erste freie Platz, von oben links gelesen — dort, wo ihn jemand sucht,
 * der gerade einen Baustein aus der Palette gezogen hat.
 */
export function firstFreeCell(
  parts: readonly Placed[],
  size: { colSpan: number; rowSpan: number },
  columns: number,
  breakpoint: Breakpoint
): { row: number; col: number } {
  const { valid } = validCells(parts, size, columns, breakpoint);

  return [...valid]
    .map((key) => {
      const [row, col] = key.split(':');
      return { row: Number(row), col: Number(col) };
    })
    .sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row))[0]
    ?? { row: 1, col: 1 };
}

/**
 * Eine Anordnung setzen — und die anderen Bildschirmgrössen unangetastet lassen.
 *
 * <b>Heraus kommt, was hereinkam.</b> Der Editor reicht ganze Bausteine durch,
 * mitsamt ihrem Inhalt; das Raster kennt davon nur Kennung, Art und Anordnung.
 * Ohne die Typvariable käme hier ein blosses <c>Placed</c> heraus, und der
 * Inhalt wäre für den Übersetzer verloren — obwohl ihn die Kopie längst
 * mitnimmt. Genau so eine Lücke fällt erst auf, wenn jemand den Rückgabewert
 * weiterreicht.
 */
export const withFrame = <T extends Placed>(part: T, breakpoint: Breakpoint, frame: Frame): T => ({
  ...part,
  layout: { ...part.layout, [breakpoint]: frame }
});

/* -- Vom Raster in Pixel ---------------------------------------------------- */

/**
 * Wie breit eine einzelne Spalte wirklich ist.
 *
 * Bei `columns` Spalten liegen `columns + 1` Abstände auf der Fläche: einer
 * links, einer rechts, und die dazwischen. Rechnet man mit den inneren allein,
 * kommt jede Spalte zu breit heraus, und die Vorschau steht am rechten Rand um
 * mehrere Pixel daneben.
 */
export const cellWidth = (gridWidth: number, columns: number, gap: number): number =>
  columns <= 0 ? 0 : (gridWidth - gap * (columns + 1)) / columns;

/**
 * Wie gross ein Baustein dieser Rastergrösse in Pixeln ist.
 *
 * Zwischen `n` Zellen liegen `n - 1` Abstände — hier wirklich die inneren
 * allein, denn die äusseren gehören zur Fläche und nicht zum Baustein.
 * Derselbe Gedanke wie oben mit dem anderen Ergebnis, und genau deshalb stehen
 * beide getrennt da.
 */
export const pixelSize = (
  size: { colSpan: number; rowSpan: number }, cell: number, rowHeight: number, gap: number
): { width: number; height: number } => ({
  width: size.colSpan * cell + (size.colSpan - 1) * gap,
  height: size.rowSpan * rowHeight + (size.rowSpan - 1) * gap
});

/**
 * Welcher Kasten einen Punkt enthält — und bei mehreren der nächstgelegene.
 *
 * <b>Ein Baustein landet dort, wo seine LINKE OBERE ECKE liegt</b>, nicht dort,
 * wo der Zeiger ist. Wer ein Blatt Papier an der rechten unteren Ecke anfasst,
 * legt es trotzdem dorthin, wo das Blatt liegt.
 *
 * Genau auf einer Kante liegt der Punkt in zwei Zellen; ohne feste Regel
 * wechselte die Wahl mit der Reihenfolge der Liste, und das fühlt sich an wie
 * Zufall. Es entscheidet der Abstand zur Mitte, dann die Lage.
 */
export function hitAt(
  point: { x: number; y: number },
  boxes: readonly { id: string; rect: { left: number; top: number; width: number; height: number } }[]
): string | null {
  let best: { id: string; distance: number; left: number; top: number } | null = null;

  for (const box of boxes) {
    const { left, top, width, height } = box.rect;
    if (point.x < left || point.x > left + width) continue;
    if (point.y < top || point.y > top + height) continue;

    const dx = point.x - (left + width / 2);
    const dy = point.y - (top + height / 2);
    const distance = dx * dx + dy * dy;

    const better = best === null
      || distance < best.distance
      || (distance === best.distance && (left < best.left || (left === best.left && top < best.top)));

    if (better) best = { id: box.id, distance, left, top };
  }

  return best?.id ?? null;
}

/* -- Grösse ändern durch Ziehen an einer Kante ------------------------------ */

export type Handle =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Welche Kanten ein Griff bewegt. */
const MOVES: Record<Handle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
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
 * <b>Ziehen an der linken Kante bewegt die Kante, nicht den Baustein.</b> Die
 * rechte bleibt stehen, also ändern sich Spalte UND Breite gegenläufig. Das ist
 * der Unterschied, den man beim Schreiben übersieht.
 *
 * `null` heisst: daraus käme nichts Sinnvolles — zu schmal, links aus dem
 * Raster, rechts hinaus. Der Aufrufer lässt die alte Anordnung dann stehen.
 */
export function resized(
  frame: Frame, handle: Handle, dCol: number, dRow: number, columns: number
): Frame | null {
  const move = MOVES[handle];

  let { row, col } = frame.position;
  let { colSpan, rowSpan } = frame.size;

  if (move.x === 1) colSpan = colSpan + dCol;
  else if (move.x === -1) { col = col + dCol; colSpan = colSpan - dCol; }

  if (move.y === 1) rowSpan = rowSpan + dRow;
  else if (move.y === -1) { row = row + dRow; rowSpan = rowSpan - dRow; }

  const snappedCols = snapColSpan(Math.max(MIN_COL_SPAN, colSpan), columns);
  const snappedRows = snapRowSpan(Math.max(1, Math.min(MAX_ROW_SPAN, rowSpan)));

  /*
   * Nach dem Einrasten muss die Kante nachgezogen werden, die NICHT bewegt
   * wurde: sonst wüchse der Baustein über seine ruhende Kante hinaus — man
   * zöge links und verschöbe rechts etwas.
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
 * Vom Nullpunkt weg gerundet, nicht mit `Math.round`: jenes rundet immer nach
 * oben, `0.5` wird 1 und `-0.5` wird 0. Damit fasste sich das Ziehen nach links
 * zäher an als nach rechts, und auffallen würde es nur als „irgendwie hakelig".
 */
export const cells = (pixels: number, cellSize: number): number => {
  if (cellSize <= 0) return 0;
  const exact = pixels / cellSize;
  return Math.sign(exact) * Math.round(Math.abs(exact));
};

/**
 * Die Bausteine in LESEREIHENFOLGE — oben vor unten, links vor rechts.
 *
 * <b>Die Stelle im Raster IST die Ordnung.</b> Vorher war sie es nicht: ein
 * Baustein wurde ans Ende der Liste gehängt, und dort blieb er, wohin man ihn
 * auch schob. Gespeichert wird aber die Listenstelle (`slug_part.position`) —
 * also erzählte das Raster eine Anordnung und der Dienst eine andere, sobald
 * jemand einen neuen Baustein ÜBER einen älteren setzte.
 *
 * Woran das hängt, ist nicht nur Kosmetik: nach `position` richtet sich, was
 * ein Vorleseprogramm zuerst liest, in welcher Folge die Seite auf dem Telefon
 * untereinander fällt und in welcher Reihenfolge jemand mit der Tabulatortaste
 * hindurchgeht.
 *
 * <b>Massgeblich ist der DESKTOP-Rahmen</b>, nicht der gerade gezeigte: sonst
 * hinge die gespeicherte Folge davon ab, welche Ansicht beim Speichern offen
 * war. Die schmaleren Ansichten setzen ihre Bausteine ohnehin selbst
 * (`firstFreeCell`), und eine DOM-Folge kann es nur einmal geben.
 *
 * Bei gleichem Platz entscheidet die bisherige Folge — `sort` ist in modernem
 * JavaScript stabil, also wackelt nichts, was nicht wackeln muss.
 */
export function byReadingOrder<T extends Placed>(parts: readonly T[]): T[] {
  return [...parts].sort((a, b) => {
    const one = frameFor(a, 'desktop').position;
    const two = frameFor(b, 'desktop').position;

    return one.row === two.row ? one.col - two.col : one.row - two.row;
  });
}
