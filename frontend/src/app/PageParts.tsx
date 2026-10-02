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

import { useEffect, useState, type CSSProperties } from 'react';

import {
  byReadingOrder, COLUMNS, frameFor, snapColSpan, snapRowSpan, useBreakpoint
} from './layout';
import { Fullscreen } from './Modal';
import type { DraftPart } from './page';
import { partSize, text, type PartModule, type PartSize, type RawConfig } from './part';
import { usePageLogic } from './pageLogic';
import { slideLabelOf } from './PageSlides';
import { partOf } from './parts/registry';
import { anchorOf } from './slides';

/**
 * 0063 — „#zapisy" IM RASTER. Ein Knopf im Tytuł oder ein Verweis im Text, der
 * auf einen Baustein zeigt, springt zu ihm — wie im Deck zum Slajd dieses
 * Namens. Ohne das wäre „#zapisy" eine neue Adresse der Seite, und die Weiche
 * der App führte ins Leere.
 */
function jumpWithin(event: React.MouseEvent<HTMLElement>) {
  const link = (event.target as HTMLElement).closest('a');
  const href = link?.getAttribute('href') ?? '';
  if (link === null || !href.startsWith('#') || href.startsWith('#/')) return;
  event.preventDefault();
  const name = decodeURIComponent(href.slice(1)).toLowerCase();
  const target = event.currentTarget.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(name)}"]`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
  /*
   * DIE KARTE DER SEITE (0048): was für den oben Gewählten gerade nicht gilt,
   * steht nicht da — oder an seiner Stelle der Satz, den die Karte dafür hat.
   */
  const logic = usePageLogic();

  /* Was jemand aus einem Streifen aufgeklappt hat — es bleibt offen, bis er die Seite verlässt. */
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());

  /* 0054 — welcher Baustein gerade das ganze Fenster hat. */
  const [whole, setWhole] = useState<string | null>(null);

  /*
   * NACH DEM VOLLBILD STEHT DIE KACHEL NEU DA. Im ganzen Fenster wird
   * gehandelt (ein Termin eingetragen, eine Nachricht geschrieben); die
   * Kachel darunter ist ein zweites Bild desselben Bausteins und wüsste davon
   * nichts — sie zeigte den Stand von vorher, bis jemand die Seite neu lädt.
   */
  const [rounds, setRounds] = useState<Readonly<Record<string, number>>>({});
  const closeWhole = () => {
    if (whole !== null) setRounds((was) => ({ ...was, [whole]: (was[whole] ?? 0) + 1 }));
    setWhole(null);
  };

  /* 0067 — aus einem Widget gekommen (`?part=<kennung>`): zu diesem Baustein springen. */
  useEffect(() => {
    const wanted = /[?&]part=([0-9a-f-]{36})/i.exec(window.location.hash)?.[1];
    if (wanted === undefined) return undefined;
    const timer = window.setTimeout(() => document.getElementById(`part-${wanted}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    return () => window.clearTimeout(timer);
  }, [parts.length]);

  const hidden = logic?.outcome.hidden ?? new Set<string>();
  const messages = logic?.outcome.messages ?? new Map<string, string>();

  const shown = byReadingOrder(parts.filter((part) => {
    if (hidden.has(part.id) && !messages.has(part.id)) return false;
    const def = partOf(part.kind);
    return def === undefined || def.hasContent(part.config);
  }));

  if (shown.length === 0) return null;

  return (
    <div className="wk-page-grid" style={{ '--page-cols': columns } as CSSProperties} onClick={jumpWithin}>
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

        /*
         * AUFGEKLAPPT gilt der Streifen als Block: der Baustein zeigt dann,
         * was er als Block zeigt, und die Kachel wächst mit.
         */
        const open = unfolded.has(part.id);
        const size = partSize(open ? { colSpan: box.colSpan, rowSpan: Math.max(box.rowSpan, 3) } : box);
        const folded = def !== undefined && def.strip !== null && size.height === 'strip';
        const canFull = def !== undefined && def.fullscreen && !hidden.has(part.id);

        return (
          <article
            key={part.id}
            id={`part-${part.id}`}
            data-anchor={anchorOf(slideLabelOf(part))}
            className={`wk-card wk-card-${part.kind}${canFull ? ' has-full' : ''}`}
            data-w={size.width}
            data-h={size.height}
            style={{
              gridColumn: `${frame.position.col} / span ${box.colSpan}`,
              gridRow: `span ${box.rowSpan}`
            }}
          >
            {hidden.has(part.id) ? (
              <p className="wk-card-muted">{messages.get(part.id)}</p>
            ) : def === undefined ? (
              <p className="wk-card-unknown">
                Moduł „{part.kind}" nie jest znany tej wersji strony.
              </p>
            ) : folded ? (
              <Folded
                def={def}
                raw={part.config}
                size={size}
                onOpen={() => setUnfolded((was) => new Set([...was, part.id]))}
              />
            ) : (
              <def.View
                key={rounds[part.id] ?? 0}
                raw={part.config}
                ctx={{ moduleId: part.moduleId ?? part.id, size, openWhole: canFull ? () => setWhole(part.id) : undefined }}
              />
            )}

            {canFull && (
              <button type="button" className="wk-card-full" aria-label="Pokaż na całym ekranie" title="Pełny ekran"
                onClick={() => setWhole(part.id)}>
                <FullIcon />
              </button>
            )}
          </article>
        );
      })}

      {/*
        IM GANZEN FENSTER zeigt sich ein Baustein in seiner grössten Gestalt —
        der Messplan mit Kalender daneben, die Rozmowa mit langem Verlauf —,
        gleich, wie klein er auf der Seite steht. Die Kachel bleibt, wo sie war.
      */}
      {whole !== null && (() => {
        const part = shown.find((one) => one.id === whole);
        const def = part === undefined ? undefined : partOf(part.kind);
        if (part === undefined || def === undefined) return null;
        const full = partSize({ colSpan: 6, rowSpan: 5 });

        return (
          <Fullscreen title={text(part.config, 'title') || def.label} onClose={closeWhole}>
            <article className={`wk-card wk-card-${part.kind} is-whole`} data-w={full.width} data-h={full.height}>
              <def.View raw={part.config} ctx={{ moduleId: part.moduleId ?? part.id, size: full, whole: true }} />
            </article>
          </Fullscreen>
        );
      })()}
    </div>
  );
}

/** Vier Ecken nach aussen — „grösser", ohne Emoji, auf jedem Gerät gleich. */
function FullIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * EIN BAUSTEIN IM STREIFEN, DER DORT NICHT HINEINPASST — ein Formular, eine
 * Buchung, eine Rozmowa. Seine Überschrift und ein Knopf; aufgeklappt wird er
 * an Ort und Stelle, und die Kachel wächst mit.
 *
 * Kein Abschneiden: ein halbes Formular ist schlechter als ein Knopf, der
 * sagt, dass hier eines ist.
 */
function Folded({ def, raw, size, onOpen }: {
  def: PartModule;
  raw: RawConfig;
  size: PartSize;
  onOpen: () => void;
}) {
  const title = text(raw, 'title') || def.strip?.title || def.label;

  return (
    <>
      <h2 className="wk-card-title">{title}</h2>
      <button type="button" className="wk-btn wk-card-open" onClick={onOpen} title={def.shows(raw, size)}>
        {def.strip?.open ?? 'Pokaż'}
      </button>
    </>
  );
}

export default PageParts;
