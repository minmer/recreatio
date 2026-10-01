/**
 * DIE BAUSTEINE EINER SEITE ALS SLAJDY (0062) — was `PageParts` im Raster ist,
 * hier als Folge.
 *
 * <b>Jeder Baustein ein Bildschirm</b>, in seiner grössten Gestalt (6 × 5):
 * auf einem Slajd ist Platz für alles, was er zeigen kann. Was er im Vollbild
 * zusätzlich anbietet (der Kalender das Eintragen), bleibt hinter seinem Knopf.
 *
 * <b>Dieselben Regeln wie im Raster:</b> ein leerer Baustein verschwindet, die
 * Karte der Seite (0048) blendet aus oder setzt ihren Satz an die Stelle.
 *
 * <b>Vorne der Titelslajd</b> — Titel und Vorspann der Seite, darunter, für wen
 * gehandelt wird (`PersonPicker`) und die Leiste der Links (`SeatBar`). Ohne
 * Titel und Vorspann stehen die beiden auf dem ersten Slajd.
 */

import { useState, type ReactNode } from 'react';

import { Fullscreen } from './Modal';
import type { DraftPart } from './page';
import { partSize, text } from './part';
import { usePageLogic } from './pageLogic';
import { partLabel, partOf } from './parts/registry';
import { SlideDeck, type DeckSlide } from './SlideDeck';
import { readSlide, type Look } from './slides';

/** Diese Arten brauchen Breite — ein Kalender in 52 rem ist ein gequetschter Kalender. */
const WIDE = new Set(['calendar', 'masses', 'slots', 'chat', 'form']);

/** Wie ein Slajd im Menü heisst: sein eigener Name, sonst der Titel des Bausteins, sonst seine Art. */
export const slideLabelOf = (part: DraftPart): string =>
  readSlide(part.layout).label || text(part.config, 'title') || partLabel(part.kind);

export function PageSlides({ parts, look, title, lead, extra, after, embedded = false, control }: {
  parts: readonly DraftPart[];
  look: Look;
  title: string | null;
  lead: string | null;
  /** Für wen, und die Links — auf dem Titelslajd oder dem ersten. */
  extra?: ReactNode;
  /** Die eingebauten Abschnitte, wenn es keine persönlichen Bausteine gibt — als letzter Slajd. */
  after?: ReactNode;
  embedded?: boolean;
  control?: Parameters<typeof SlideDeck>[0]['control'];
}) {
  const logic = usePageLogic();
  const [whole, setWhole] = useState<string | null>(null);

  const hidden = logic?.outcome.hidden ?? new Set<string>();
  const messages = logic?.outcome.messages ?? new Map<string, string>();

  const shown = parts.filter((part) => {
    if (hidden.has(part.id) && !messages.has(part.id)) return false;
    const def = partOf(part.kind);
    return def === undefined || def.hasContent(part.config) || embedded;
  });

  const full = partSize({ colSpan: 6, rowSpan: 5 });
  const hasCover = (title ?? '').trim() !== '' || (lead ?? '').trim() !== '';
  const slides: DeckSlide[] = [];

  if (hasCover) {
    slides.push({
      key: 'cover',
      label: (title ?? '').trim() || 'Start',
      layers: look.cover,
      content: (
        <div className="wk-deck-cover">
          {(title ?? '').trim() !== '' && <h1>{title}</h1>}
          {(lead ?? '').trim() !== '' && <p>{lead}</p>}
          {extra !== undefined && <div className="wk-deck-extra">{extra}</div>}
        </div>
      )
    });
  }

  shown.forEach((part, index) => {
    const def = partOf(part.kind);
    const slide = readSlide(part.layout);
    const canFull = def !== undefined && def.fullscreen && !hidden.has(part.id);

    slides.push({
      key: part.id,
      label: slideLabelOf(part),
      layers: slide.layers,
      wide: WIDE.has(part.kind),
      content: (
        <>
          {!hasCover && index === 0 && extra !== undefined && <div className="wk-deck-extra">{extra}</div>}
          <article className={`wk-card wk-card-${part.kind} wk-deck-card${canFull ? ' has-full' : ''}`} data-w={full.width} data-h={full.height}>
            {hidden.has(part.id) ? (
              <p className="wk-card-muted">{messages.get(part.id)}</p>
            ) : def === undefined ? (
              <p className="wk-card-unknown">Moduł „{part.kind}" nie jest znany tej wersji strony.</p>
            ) : (
              <def.View raw={part.config} ctx={{ moduleId: part.moduleId ?? part.id, size: full }} />
            )}
            {canFull && (
              <button type="button" className="wk-card-full" aria-label="Pokaż na całym ekranie" title="Pełny ekran"
                onClick={() => setWhole(part.id)}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                  <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            )}
          </article>
        </>
      )
    });
  });

  if (after !== undefined && after !== null) {
    slides.push({ key: 'personal', label: 'Twoje sprawy', layers: [], content: <div className="wk-deck-card">{after}</div> });
  }

  if (!hasCover && shown.length === 0 && extra !== undefined) {
    slides.push({ key: 'extra', label: 'Start', layers: look.cover, content: <div className="wk-deck-extra">{extra}</div> });
  }

  const opened = whole === null ? undefined : shown.find((one) => one.id === whole);
  const openedDef = opened === undefined ? undefined : partOf(opened.kind);

  return (
    <>
      <SlideDeck slides={slides} theme={look.theme} title={title} embedded={embedded} control={control} />

      {opened !== undefined && openedDef !== undefined && (
        <Fullscreen title={text(opened.config, 'title') || openedDef.label} onClose={() => setWhole(null)}>
          <article className={`wk-card wk-card-${opened.kind} is-whole`} data-w={full.width} data-h={full.height}>
            <openedDef.View raw={opened.config} ctx={{ moduleId: opened.moduleId ?? opened.id, size: full, whole: true }} />
          </article>
        </Fullscreen>
      )}
    </>
  );
}

export default PageSlides;
