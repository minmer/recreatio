/**
 * DIE BAUSTEINE EINER SEITE ALS PRÄSENTATION (0085) — was `PageSlides` für die
 * Slajdy ist: aus den Bausteinen und dem Aussehen der Seite die Szenen und die
 * Dinge darauf.
 *
 * <b>Ein Text kann sich auf der Bühne selbst gestalten</b> (`type` ≠ `auto`):
 * ein Satz wie die Überschrift der Seite, ein Titel in Versalien, eine Pointe
 * in der Farbe des Akzents, ein kleiner Dopisek — so standen die Blasen der
 * Startseite im Altbestand. Alles andere zeigt sich, wie es sich auf der Seite
 * zeigt: ein Kalender bleibt ein Kalender, nur steht er, wo man ihn hinstellt.
 *
 * <b>Dieselben Regeln wie im Raster:</b> die Karte der Seite (0048) blendet aus
 * oder setzt ihren Satz an die Stelle; ein leerer Baustein verschwindet — ausser
 * ein Titel ohne Text, der auf einer Bühne sehr wohl etwas ist.
 */

import { useCallback, useContext, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { DraftPart } from '../page';
import { partSize, text } from '../part';
import { usePageLogic } from '../pageLogic';
import { PreviewControlContext } from '../previewControl';
import { partLabel, partOf } from '../parts/registry';
import { readPiece, readShow, type TextType } from './presentation';
import { PresentationView, type ShowPiece } from './PresentationView';
import { StoryContext } from './showContext';
import { NO_STORY } from './story';
import { useStoryRun } from './storyRun';
import { Loading } from '../../ui/Loading';
import { inline, RichLine } from '../../ui/richText';
import type { Look } from '../slides/slideLook';
import type { DriveControl } from './usePresentationDrive';
import type { Learner } from '../../cogita/learn';
import { BLOCKED_KIND, BLOCKED_PART_TEXT } from '../../reports/reportPath';

/** Diese Arten zeigen sich ohne Tafel — ein Bild ist ein Bild, ein Kształt eine Fläche. */
const BARE = new Set(['image', 'shape', 'animation', 'layers']);

/** Wie ein Baustein in der Liste heisst. */
export const pieceLabelOf = (part: DraftPart): string =>
  text(part.config, 'title') || text(part.config, 'alt') || firstLine(part.config.body ?? '') || partLabel(part.kind);

const firstLine = (body: string): string => {
  const line = body.split('\n').map((one) => one.trim()).find((one) => one !== '') ?? '';
  return line.replace(/^[#>]+\s*/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').slice(0, 60);
};

/**
 * EIN TEXT, DER SICH AUF DER BÜHNE SELBST GESTALTET. Die Überschrift ist je
 * Art eine andere Stufe: der Satz der Seite die erste (nur einmal), ein Titel
 * die zweite, ein Nagłówek die dritte.
 */
function ShowText({ raw, type, first }: { raw: Record<string, string>; type: TextType; first: boolean }) {
  const title = text(raw, 'title');
  const lines = (raw.body ?? '').replace(/\r/g, '').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  const Title = type === 'display' ? (first ? 'h1' : 'h2') : type === 'title' ? 'h2' : 'h3';

  return (
    <div className={`pz-text type-${type}`}>
      {title !== '' && <Title className="pz-title">{inline(title)}</Title>}
      {type === 'close' ? (
        lines.length > 0 && (
          <p className="pz-close">
            {lines.map((line, i) => (line.trim() === '' ? <span key={i} className="pz-gapline" aria-hidden="true" /> : <span key={i}>{inline(line.trim())}</span>))}
          </p>
        )
      ) : lines.map((line, i) => <RichLine key={i} line={line} />)}
    </div>
  );
}

export function PagePresentation({
  parts, look, title, extra, after, mode = 'page', frozen = null, boxAspect = null, selected = null, onPick, onStage, onActive, control,
  presentAt = null, presentRoute = null, onPresentEnd, virtual = null, pageId = null, learner = null
}: {
  parts: readonly DraftPart[];
  look: Look;
  title: string | null;
  extra?: ReactNode;
  after?: ReactNode;
  mode?: 'page' | 'box';
  frozen?: number | null;
  boxAspect?: number | null;
  selected?: string | null;
  onPick?: (key: string) => void;
  onStage?: (stage: HTMLDivElement | null) => void;
  onActive?: (index: number) => void;
  control?: MutableRefObject<DriveControl | null>;
  /** Der Editor: die Bühne in der Grösse eines echten Schirms, verkleinert. */
  virtual?: { readonly w: number; readonly h: number } | null;
  /** Von aussen: ein Vortrag ab dieser Stelle (der Editor) — und was danach. */
  presentAt?: number | null;
  /** 0089 — und auf welchem Weg (der Editor: der Weg zur gewählten Szene). */
  presentRoute?: readonly string[] | null;
  onPresentEnd?: () => void;
  /**
   * 2026-10-21 — die Kennung der Seite: unter ihr merkt sich ein Przebieg, was
   * der Lernende geantwortet hat und wo er war. `null` (der Editor): kein Lauf.
   */
  pageId?: string | null;
  /**
   * 2026-10-22 (Schritt 12) — in Nauka: der Lernende der Baza wiedzy, als der
   * der Przebieg läuft (statt der Person oben auf der Seite).
   */
  learner?: Learner | null;
}) {
  const logic = usePageLogic();
  /* Ein Vortrag auf dem ganzen Bildschirm — von der Stelle aus, an der die Seite gerade steht; sie selbst steht solange still. */
  const [presenting, setPresenting] = useState<{ readonly at: number; readonly route: readonly string[] | null } | null>(null);
  const own = useRef<DriveControl | null>(null);
  /* 2026-10-27 — in der Vorschau für Assistenten stellt sie die Bühne (`previewControl.ts`); sonst null. */
  const preview = useContext(PreviewControlContext);
  const ctl = control ?? preview?.show ?? own;
  const read = readShow(look.show);
  /*
   * 2026-10-21 — eine Präsentation mit Fragen hat einen Przebieg, auch wenn
   * der Editor keinen eingestellt hat: die Antworten bleiben im Browser.
   */
  const show = read.story === null && parts.some((part) => part.kind === 'question') ? { ...read, story: NO_STORY } : read;
  const editing = onPick !== undefined;
  /* 2026-10-21 — der Przebieg im Lauf: im Browser, oder in Cogita (`storyRun.tsx`). */
  const { run: story, ready } = useStoryRun(show, editing ? null : pageId, learner);

  const hidden = logic?.outcome.hidden ?? new Set<string>();
  const messages = logic?.outcome.messages ?? new Map<string, string>();

  let firstDisplay = true;
  const pieces: ShowPiece[] = parts.flatMap((part): ShowPiece[] => {
    const piece = readPiece(part.layout);
    if (Object.keys(piece.places).length === 0) return [];
    if (hidden.has(part.id) && !messages.has(part.id) && !editing) return [];
    const def = partOf(part.kind);
    const titled = part.kind === 'text' && text(part.config, 'title') !== '';
    if (def !== undefined && !def.hasContent(part.config) && !titled && !editing) return [];

    let content: ReactNode;
    if (hidden.has(part.id) && messages.has(part.id)) {
      content = <p className="wk-card-muted">{messages.get(part.id)}</p>;
    } else if (part.kind === BLOCKED_KIND) {
      /* 0130 — nach einer Meldung gesperrt. */
      content = <p className="wk-blocked">{BLOCKED_PART_TEXT}</p>;
    } else if (def === undefined) {
      content = <p className="wk-card-unknown">Moduł „{part.kind}" nie jest znany tej wersji strony.</p>;
    } else if (part.kind === 'text' && piece.type !== 'auto') {
      const first = piece.type === 'display' && firstDisplay;
      if (first) firstDisplay = false;
      content = <ShowText raw={part.config} type={piece.type} first={first} />;
    } else {
      const widest = Math.max(...Object.values(piece.places).map((p) => p.w));
      const size = partSize({ colSpan: widest >= 60 ? 6 : widest >= 45 ? 4 : widest >= 30 ? 3 : 2, rowSpan: 5 });
      const view = <def.View raw={part.config} ctx={{ moduleId: part.moduleId ?? part.id, size }} />;
      content = BARE.has(part.kind) ? view : (
        <article className={`wk-card wk-card-${part.kind} pz-card`} data-w={size.width} data-h={size.height}>{view}</article>
      );
    }

    return [{ key: part.id, kind: part.kind, label: pieceLabelOf(part), piece, content }];
  });

  const stop = useCallback(() => { setPresenting(null); onPresentEnd?.(); }, [onPresentEnd]);
  /* 0089 — der Vortrag geht den Weg weiter, den die Seite (oder der Editor) gerade geht. */
  const showing = presentAt !== null ? { at: presentAt, route: presentRoute } : presenting;
  const side = extra === undefined && after === undefined ? undefined : <>{extra}{after}</>;

  /* Ein Przebieg wartet auf seinen Lauf: sein Weg geht von Anfang an durch die Tore, und wer wiederkommt, steht dort, wo er war. */
  if (!ready) return <Loading />;

  return (
    <StoryContext.Provider value={story}>
      <PresentationView
        story={story}
        show={show}
        pieces={pieces}
        theme={look.theme}
        title={title}
        mode={mode}
        frozen={presenting?.at ?? frozen}
        boxAspect={boxAspect}
        virtual={virtual}
        extra={side}
        selected={selected}
        onPick={onPick}
        onStage={onStage}
        onActive={onActive}
        control={ctl}
        onPresent={mode === 'page' ? () => setPresenting({ at: ctl.current?.at() ?? 0, route: ctl.current?.route?.() ?? null }) : undefined}
      />
      {showing !== null && createPortal(
        <PresentationView show={show} pieces={pieces} theme={look.theme} title={title} mode="present" startAt={showing.at} startRoute={showing.route} onExit={stop} story={story} />,
        document.body
      )}
    </StoryContext.Provider>
  );
}

export default PagePresentation;
