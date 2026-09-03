/**
 * Das Raster der Pfarr-Startseite — übernommen aus `pages/parish/ParishPage.tsx`.
 *
 * <b>Warum das hier steht und nicht im Bauteil.</b> Es ist reine Rechnerei:
 * welche Zellen frei sind, wohin ein Baustein passt, auf welche Grösse eine
 * gezogene Kante einrastet. Im Bauteil verschränkt sich das mit Zuständen,
 * Zeigerereignissen und React — und dann lässt es sich nicht mehr prüfen,
 * obwohl es genau der Teil ist, bei dem ein Fehler stumm bleibt: ein Baustein
 * landet einen Schritt daneben, und niemand kann sagen, warum.
 *
 * <b>Die Zahlen sind nicht neu erfunden.</b> Sechs Spalten am Schreibtisch,
 * vier auf dem Tablet, zwei auf dem Telefon. Breiten rasten auf 2, 3, 4 oder 6
 * ein — das sind die alten Namen `one-third`, `one-half`, `two-thirds`,
 * `full`. Höhen auf 1, 3 oder 5.
 *
 * <b>Warum Rastermasse und keine freien Grössen.</b> Ein Baustein, der 2.7
 * Spalten breit sein darf, ergibt eine Seite, auf der nichts mit nichts
 * fluchtet — und der Mensch davor kann es nicht ausrichten, weil es keine
 * Linie gibt, an der etwas ausgerichtet wäre. Einrasten ist keine
 * Bevormundung, es ist die Linie.
 */

export const RC_BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
export type RcBreakpoint = (typeof RC_BREAKPOINTS)[number];

export const RC_COLUMNS: Record<RcBreakpoint, number> = {
  desktop: 6,
  tablet: 4,
  mobile: 2
};

/** Die erlaubten Breiten. Alles dazwischen rastet auf die nächste ein. */
export const RC_COL_SPANS = [2, 3, 4, 6] as const;

export const RC_MIN_COL_SPAN = 2;
export const RC_MIN_ROW_SPAN = 1;
export const RC_MAX_ROW_SPAN = 5;

export type RcFrame = {
  readonly position: { readonly row: number; readonly col: number };
  readonly size: { readonly colSpan: number; readonly rowSpan: number };
};

export type RcModule = {
  readonly id: string;
  readonly type: string;
  /** Je Bildschirmgrösse eine eigene Anordnung. */
  readonly layouts: Partial<Record<RcBreakpoint, RcFrame>>;
};

/**
 * Die nächstliegende erlaubte Breite, die in die Spaltenzahl passt.
 *
 * Auf dem Telefon gibt es nur zwei Spalten; dort fallen 3, 4 und 6 weg, und
 * alles wird 2 breit. Ohne diese Beschränkung ragte ein Baustein aus dem
 * Raster heraus und schöbe die ganze Seite auf.
 */
export const rcSnapColSpan = (value: number, columns: number): number => {
  const usable = RC_COL_SPANS.filter((span) => span <= columns);
  if (usable.length === 0) return columns;
  return usable.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best
  );
};

/** Höhen rasten auf 1, 3 oder 5 — eine Zeile, ein Block, eine Spalte. */
export const rcSnapRowSpan = (value: number): number => {
  if (value <= 2) return 1;
  if (value <= 4) return 3;
  return RC_MAX_ROW_SPAN;
};

/**
 * Die Anordnung für eine Bildschirmgrösse.
 *
 * Fehlt sie, wird die des Schreibtischs genommen und eingerastet — ein
 * Baustein ohne Anordnung für das Telefon soll dort nicht verschwinden,
 * sondern so gut wie möglich erscheinen.
 */
export const rcFrameFor = (module: RcModule, breakpoint: RcBreakpoint): RcFrame => {
  const own = module.layouts[breakpoint];
  if (own) return own;

  const fallback = module.layouts.desktop ?? {
    position: { row: 1, col: 1 },
    size: { colSpan: RC_MIN_COL_SPAN, rowSpan: RC_MIN_ROW_SPAN }
  };

  const columns = RC_COLUMNS[breakpoint];
  return {
    position: { row: fallback.position.row, col: Math.min(fallback.position.col, columns) },
    size: {
      colSpan: rcSnapColSpan(fallback.size.colSpan, columns),
      rowSpan: rcSnapRowSpan(fallback.size.rowSpan)
    }
  };
};

/** Welche Zellen belegt sind — je Baustein sein ganzes Rechteck. */
function occupancy(
  modules: readonly RcModule[],
  columns: number,
  breakpoint: RcBreakpoint,
  exclude?: string | null
): { taken: Set<string>; maxRow: number } {
  const taken = new Set<string>();
  let maxRow = 4;

  for (const module of modules) {
    if (exclude != null && module.id === exclude) continue;

    const frame = rcFrameFor(module, breakpoint);
    const colSpan = rcSnapColSpan(frame.size.colSpan, columns);
    const rowSpan = rcSnapRowSpan(frame.size.rowSpan);

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
 * ziehen kann, sobald die Seite einmal voll ist, und der Editor wäre an dem
 * Tag zu Ende, an dem er gebraucht wird.
 */
export function rcValidCells(
  modules: readonly RcModule[],
  size: { colSpan: number; rowSpan: number },
  columns: number,
  breakpoint: RcBreakpoint,
  exclude?: string | null
): { valid: Set<string>; rows: number; size: { colSpan: number; rowSpan: number } } {
  const { taken, maxRow } = occupancy(modules, columns, breakpoint, exclude);

  const snapped = {
    colSpan: rcSnapColSpan(size.colSpan, columns),
    rowSpan: rcSnapRowSpan(size.rowSpan)
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
export function rcCanPlace(
  modules: readonly RcModule[],
  frame: RcFrame,
  columns: number,
  breakpoint: RcBreakpoint,
  exclude?: string | null
): boolean {
  const colSpan = rcSnapColSpan(frame.size.colSpan, columns);
  const rowSpan = rcSnapRowSpan(frame.size.rowSpan);
  const { row, col } = frame.position;

  if (row < 1 || col < 1) return false;
  if (col + colSpan - 1 > columns) return false;

  const { taken } = occupancy(modules, columns, breakpoint, exclude);

  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + colSpan; c += 1) {
      if (taken.has(`${r}:${c}`)) return false;
    }
  }
  return true;
}

/**
 * Der erste freie Platz, von oben links gelesen.
 *
 * Gebraucht beim Anlegen: ein Baustein, der aus der Palette kommt, muss
 * irgendwo landen, und „oben links das erste Loch" ist die Stelle, an der ihn
 * jemand sucht.
 */
export function rcFirstFreeCell(
  modules: readonly RcModule[],
  size: { colSpan: number; rowSpan: number },
  columns: number,
  breakpoint: RcBreakpoint
): { row: number; col: number } {
  const { valid } = rcValidCells(modules, size, columns, breakpoint);

  return [...valid]
    .map((key) => {
      const [row, col] = key.split(':');
      return { row: Number(row), col: Number(col) };
    })
    .sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row))[0]
    ?? { row: 1, col: 1 };
}

/** Eine Anordnung setzen — und die anderen Bildschirmgrössen unangetastet lassen. */
export const rcWithFrame = (
  module: RcModule,
  breakpoint: RcBreakpoint,
  frame: RcFrame
): RcModule => ({
  ...module,
  layouts: { ...module.layouts, [breakpoint]: frame }
});

/* -- Vom Raster in Pixel ---------------------------------------------------- */

/**
 * Wie breit eine einzelne Spalte wirklich ist.
 *
 * Bei `columns` Spalten liegen `columns + 1` Abstände auf der Fläche: einer
 * links, einer rechts, und die dazwischen. Rechnet man mit `columns - 1`
 * (den inneren allein), kommt jede Spalte zu breit heraus, und die Vorschau
 * steht am rechten Rand um mehrere Pixel daneben.
 */
export const rcCellWidth = (gridWidth: number, columns: number, gap: number): number =>
  columns <= 0 ? 0 : (gridWidth - gap * (columns + 1)) / columns;

/**
 * Wie gross ein Baustein von dieser Rastergrösse in Pixeln ist.
 *
 * Zwischen `n` Zellen liegen `n - 1` Abstände — hier wirklich die inneren
 * allein, denn die äusseren gehören schon zur Fläche und nicht zum Baustein.
 * Das ist derselbe Gedanke wie oben mit dem anderen Ergebnis, und genau
 * deshalb stehen beide getrennt da.
 */
export const rcPixelSize = (
  size: { colSpan: number; rowSpan: number },
  cellWidth: number,
  rowHeight: number,
  gap: number
): { width: number; height: number } => ({
  width: size.colSpan * cellWidth + (size.colSpan - 1) * gap,
  height: size.rowSpan * rowHeight + (size.rowSpan - 1) * gap
});
