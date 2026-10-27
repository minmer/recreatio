/**
 * 2026-10-27 — EIN BAUSTEIN IN JEDER GRÖSSE, die das Raster auf diesem
 * Bildschirm erlaubt (Breiten 2/3/4/6 Spalten, Höhen Streifen/Block/hoch) —
 * für die Vorschau der Assistenten (`preview_module`).
 *
 * <b>Dieselbe Kachel wie auf der Seite</b> (`PageParts`): dieselbe Breite
 * im selben Raster, dieselbe Mindesthöhe, `data-w`/`data-h`, im Streifen
 * zugeklappt, wo die Art es so will. Nur steht jede Grösse für sich in einer
 * Zeile, mit dem Satz darüber, den der Editor an die Kachel schreibt
 * (`shows`) — so sieht man, ob eine grössere Kachel wirklich mehr zeigt und
 * eine kleinere eine eigene Gestalt hat, statt abgeschnitten zu sein.
 */

import type { CSSProperties } from 'react';

import { COLUMNS, useBreakpoint, type Breakpoint } from '../pages/layout';
import type { DraftPart } from '../pages/page';
import { Folded } from '../pages/PageParts';
import { partSize, SIZE_WORD } from '../pages/part';
import { partOf } from '../pages/parts/registry';
import { sizesFor } from './previewDoc';

/** Das Raster der Seite, aber als Spalte von Zeilen: dieselbe Breite, dieselben Abstände. */
const gridStyle = (columns: number): CSSProperties => ({ '--page-cols': columns, '--page-gap': '1rem', height: 'auto' } as CSSProperties);

/** Die Kachel so breit und so hoch wie in `PageParts` — nur nicht frei gestellt. */
function cardStyle(box: { colSpan: number; rowSpan: number }, columns: number, breakpoint: Breakpoint): CSSProperties {
  const across = `(100% - ${columns - 1} * var(--page-gap)) / ${columns} * ${box.colSpan}`;
  return {
    position: 'relative',
    width: `calc(${across} + ${box.colSpan - 1} * var(--page-gap))`,
    minHeight: breakpoint === 'mobile'
      ? `min(${box.rowSpan} * 5.25rem + ${box.rowSpan - 1} * var(--page-gap), 10.5rem + var(--page-gap))`
      : `calc(${box.rowSpan} * 5.25rem + ${box.rowSpan - 1} * var(--page-gap))`
  };
}

export function ModuleMatrix({ part, n }: { part: DraftPart; n: number }) {
  const breakpoint = useBreakpoint();
  const columns = COLUMNS[breakpoint];
  const def = partOf(part.kind);

  return (
    <div className="pv-matrix" data-pv-matrix={part.kind} data-pv-breakpoint={breakpoint}>
      <h1 className="wk-h1">M{n} · {def?.label ?? part.kind} — {breakpoint} ({columns} kolumny)</h1>
      {sizesFor(columns).map((box) => {
        const size = partSize(box);
        const folded = def !== undefined && def.strip !== null && size.height === 'strip';
        const shows = def?.shows(part.config, size) ?? '';
        return (
          <section key={`${box.colSpan}x${box.rowSpan}`} className="pv-cell" data-pv-cell={`${box.colSpan}x${box.rowSpan}`}>
            <p className="pv-cell-label">
              <b>{box.colSpan}×{box.rowSpan}</b> · {SIZE_WORD.width[size.width]} {SIZE_WORD.height[size.height]} ({size.width} · {size.height})
              {folded ? ' · zwinięty' : ''} — {shows}
            </p>
            {/* Je Grösse ein eigenes Raster der Seite — die Kachel ist sein Kind, wie dort (dieselben Regeln gelten). */}
            <div className="wk-page-grid is-packed pv-cell-grid" style={gridStyle(columns)}>
              <article
                className={`wk-card wk-card-${part.kind}`}
                data-w={size.width}
                data-h={size.height}
                data-part={part.id}
                style={cardStyle(box, columns, breakpoint)}
              >
                {def === undefined ? (
                  <p className="wk-card-unknown">Moduł „{part.kind}" nie jest znany tej wersji strony.</p>
                ) : folded ? (
                  <Folded def={def} raw={part.config} moduleId={part.moduleId ?? part.id} size={size} onOpen={() => undefined} />
                ) : (
                  <def.View raw={part.config} ctx={{ moduleId: part.moduleId ?? part.id, size }} />
                )}
              </article>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ModuleMatrix;
