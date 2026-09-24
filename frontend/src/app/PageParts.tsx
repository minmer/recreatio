/**
 * Die Bausteine einer öffentlichen Seite — gezeichnet, nicht bearbeitet.
 *
 * <b>Diese Datei kennt keine einzige Bausteinart mehr.</b> Vorher stand hier
 * eine Verzweigung über zehn Namen, und in einem ihrer Zweige noch einmal eine
 * über drei; die Feldnamen, die sie las, standen in einer anderen Datei, und
 * nichts hielt die beiden zusammen. Jetzt steht hier das Raster, die Stelle im
 * Raster und die Frage „hast du etwas zu zeigen" — und jede Art beantwortet sie
 * selbst (`part.ts`, `parts/`).
 *
 * <b>Die Bildschirmgrösse wird hier entschieden</b> und nicht per Medienabfrage:
 * die Anordnung liegt je Grösse als Rechteck vor, und ein Rechteck lässt sich
 * nicht in CSS umrechnen, ohne es noch einmal zu beschreiben.
 *
 * <b>Ein leerer Baustein verschwindet für den Besucher</b> und bleibt für den,
 * der die Seite führt: der eine soll ihn füllen, dem anderen sagt er nichts.
 */

import { type CSSProperties } from 'react';

import {
  byReadingOrder, COLUMNS, frameFor, snapColSpan, snapRowSpan, useBreakpoint
} from './layout';
import type { DraftPart } from './page';
import { partOf } from './parts/registry';

/*
 * OHNE die Adresse der Seite. Sie stand hier, weil der Messplan sie brauchte —
 * seit 0020 nennt er stattdessen einen KALENDER, der in seiner eigenen
 * Einstellung steht. Ein Baustein ist dasselbe, gleich wo er hängt.
 */
export function PageParts({ parts }: { parts: readonly DraftPart[] }) {
  const breakpoint = useBreakpoint();
  const columns = COLUMNS[breakpoint];

  /*
   * WAS ETWAS ZU ZEIGEN HAT — und jede Art weiss es selbst.
   *
   * Eine unbekannte Art bleibt stehen: dass dort etwas ist, das diese Fassung
   * nicht zeichnen kann, ist eine Auskunft. Sie stillschweigend wegzulassen
   * hiesse, eine Seite zu zeigen, die vollständig aussieht und keine ist.
   */
  const shown = byReadingOrder(parts.filter((part) => {
    const def = partOf(part.kind);
    return def === undefined || def.hasContent(part.config);
  }));

  if (shown.length === 0) return null;

  return (
    <div className="wk-page-grid" style={{ '--page-cols': columns } as CSSProperties}>
      {shown.map((part) => {
        const frame = frameFor(part, breakpoint);

        /*
         * Einmal gerechnet und weitergereicht: der Messplan entscheidet an
         * DIESEN Zahlen, was er zeigt. Sie im Stil noch einmal auszurechnen
         * hiesse, zwei Stellen zu haben, die sich einig sein müssen.
         */
        const box = {
          colSpan: snapColSpan(frame.size.colSpan, columns),
          rowSpan: snapRowSpan(frame.size.rowSpan)
        };

        const def = partOf(part.kind);

        return (
          <article
            key={part.id}
            className={`wk-card wk-card-${part.kind}`}
            style={{
              gridColumn: `${frame.position.col} / span ${box.colSpan}`,
              gridRow: `span ${box.rowSpan}`
            }}
          >
            {def === undefined ? (
              <p className="wk-card-unknown">
                Moduł „{part.kind}" nie jest znany tej wersji strony.
              </p>
            ) : (
              <def.View
                raw={part.config}
                ctx={{ moduleId: part.moduleId ?? part.id, box }}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

export default PageParts;
