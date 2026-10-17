/**
 * DER EDITOR DER SLAJDY (0062) — die Folge, das Aussehen, und daneben, wie es aussieht.
 *
 * <b>Aus dem Altbestand übernommen</b> (`legacy/pages/events/admin`: PartEditor,
 * LayerEditor, das Thema im EventAdminPage): je Slajd sein Name im Menü, seine
 * Schichten und sein Inhalt; für die ganze Seite hell oder dunkel und vier
 * Farben; dazu der Titelslajd. Neu ist die Vorschau daneben: dieselbe Hülle wie
 * auf der Seite, mit dem, was gerade im Editor steht — ein Klick auf einen
 * Slajd in der Liste fährt sie dorthin.
 *
 * <b>Die Reihenfolge ist die Liste</b> — nicht das Raster. Wer die Seite später
 * wieder als Raster zeigt, findet die Bausteine dort, wo sie im Raster standen;
 * ein neuer Slajd bekommt deshalb auch eine Stelle im Raster.
 *
 * <b>0084 — der Wechsel:</b> je Slajd, wie er den vorigen ablöst, wie sein
 * Inhalt erscheint, eigene Farben; und je Baustein, ob er „auf der Bühne" steht
 * — keinen eigenen Slajd hat, sondern über allen, mit einem Platz je Slajd, zu
 * dem er beim Wechsel gleitet.
 */

import { useRef, useState } from 'react';

import { newId } from '../../core/ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Layout } from '../layout';
import { type DraftPart } from '../page';
import { PartSettings } from '../PageBuilder';
import { deckParts, PageSlides, slideLabelOf } from './PageSlides';
import { partSize } from '../part';
import { PARTS, partLabel, partOf } from '../parts/registry';
import { usePrefersDark, type DeckControl } from './SlideDeck';
import { MotionField } from '../motion/MotionField';
import { COVER_KEY, readSlide, STAGE_FRAME, TRANSITION_LABEL, withSlide, type SlideLook } from './slides';
import { deckOf, resolveTheme, type Look } from './slideLook';
import { askText } from '../../ui/dialogs';
import { CompanionEditor, LayoutEditor, MotionEditor, StageEditor, ThemeEditor } from './SlideSettings';
import { DeckEditor, LayerEditor } from './LayerEditor';

const FULL = partSize({ colSpan: 6, rowSpan: 5 });

export function SlidesEditor({ path, parts, look, title, lead, busy, onChange, onLook, onOpenModule }: {
  path: string;
  parts: readonly DraftPart[];
  look: Look;
  title: string;
  lead: string;
  busy: boolean;
  onChange: (next: readonly DraftPart[]) => void;
  onLook: (next: Look) => void;
  onOpenModule: (moduleId: string, parts: readonly DraftPart[]) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const control = useRef<DeckControl | null>(null);
  const dark = usePrefersDark();
  const theme = resolveTheme(look.theme, dark);
  const whole = deckOf(look);
  const hasCover = whole.titleSlide && (title.trim() !== '' || lead.trim() !== '');

  /*
   * Wo ein Slajd in der Vorschau steht: der Titelslajd zählt mit, wenn es ihn
   * gibt; ein Baustein auf der Bühne (0084) hat keinen eigenen — für ihn der
   * erste Slajd, auf dem er einen Platz hat; einer neben einem anderen (0107)
   * steht auf dessen Slajd.
   */
  const own = deckParts(parts).own;
  const deck: { key: string; label: string }[] = [
    ...(hasCover ? [{ key: COVER_KEY, label: title.trim() || 'Start' }] : []),
    ...own.map((p) => ({ key: p.id, label: slideLabelOf(p) }))
  ];
  const deckIndex = (key: string) => deck.findIndex((one) => one.key === key);
  const showPart = (part: DraftPart) => {
    const slide = readSlide(part.layout);
    const stage = slide.stage;
    const key = stage !== null ? deck.find((one) => stage.frames[one.key] !== undefined)?.key
      : slide.with !== null && deckIndex(slide.with.slide) >= 0 ? slide.with.slide : part.id;
    const at = key === undefined ? -1 : deckIndex(key);
    if (at >= 0) control.current?.go(at);
  };
  const show = (index: number) => { const part = parts[index]; if (part !== undefined) showPart(part); };

  const replace = (id: string, next: DraftPart) => onChange(parts.map((p) => (p.id === id ? next : p)));

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= parts.length) return;
    const next = [...parts];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
    /* Wohin der verschobene Slajd in der Vorschau gerückt ist — gezählt in der NEUEN Folge. */
    const mine = deckParts(next).own;
    const at = mine.findIndex((p) => p.id === parts[index].id);
    if (at >= 0) window.setTimeout(() => control.current?.go(at + (hasCover ? 1 : 0)), 50);
  };

  /** Ein neuer Slajd am Ende — mit einer Stelle im Raster für jede Grösse, falls die Seite wieder eine wird. */
  const add = (kind: string) => {
    const def = partOf(kind);
    const layout: Record<string, unknown> = {};
    for (const bp of BREAKPOINTS) {
      const cols = COLUMNS[bp];
      const size = { colSpan: snapColSpan(def?.box.colSpan ?? 6, cols), rowSpan: snapRowSpan(def?.box.rowSpan ?? 3) };
      layout[bp] = { position: firstFreeCell(parts, size, cols, bp), size };
    }
    const made: DraftPart = { id: newId(), moduleId: null, kind, layout: layout as Layout, config: {} };
    onChange([...parts, made]);
    setOpen(made.id);
    window.setTimeout(() => control.current?.go(deck.length), 80);
  };

  return (
    <div className="se">
      <div className="se-side">
        <ThemeEditor look={look} busy={busy} onChange={onLook} />

        <DeckEditor path={path} theme={theme} deck={whole} busy={busy} onChange={(deck) => onLook({ ...look, deck })} />

        <details className="wk-fold se-cover">
          <summary>Slajd tytułowy {hasCover ? '' : '(pojawi się, gdy strona ma tytuł albo tekst)'}</summary>
          <p className="wk-hint">Tytuł i tekst strony — na pierwszym slajdzie. Tutaj jego tło.</p>
          <LayerEditor
            path={path}
            theme={theme}
            label={title}
            layers={look.cover}
            busy={busy}
            onChange={(cover) => onLook({ ...look, cover })}
          />
        </details>

        <h4 className="pb-h">Slajdy ({parts.length})</h4>
        {parts.length === 0 && <p className="pb-empty">Nie ma jeszcze slajdu. Dodaj pierwszy poniżej.</p>}

        <ol className="se-list">
          {parts.map((part, index) => {
            const slide = readSlide(part.layout);
            const expanded = open === part.id;
            const onStage = slide.stage !== null;
            /* 0107 — neben einem anderen, auf dessen Slajd (nur, wenn es den gibt). */
            const beside = slide.with !== null && own.some((p) => p.id === slide.with!.slide) && slide.with.slide !== part.id;
            const mainOf = beside ? parts.find((p) => p.id === slide.with!.slide) : undefined;
            const setSlide = (next: SlideLook) => replace(part.id, { ...part, layout: withSlide(part.layout, next) });
            const def = partOf(part.kind);
            const todo = def !== undefined && (def.missing(part.config) !== null
              || Object.values(part.config).every((v) => v.trim() === ''));

            return (
              <li key={part.id} className={`se-item${expanded ? ' is-open' : ''}`}>
                <div className="se-row">
                  <button type="button" className={`se-num${onStage ? ' is-stage' : ''}${beside ? ' is-beside' : ''}`}
                    title={onStage ? 'Na scenie — przechodzi między slajdami' : beside ? 'Obok innego modułu, na jego slajdzie' : 'Pokaż w podglądzie'} onClick={() => show(index)}>
                    {onStage ? '◆' : beside ? '↳' : deckIndex(part.id) + 1}
                  </button>
                  <button type="button" className="se-name" aria-expanded={expanded}
                    onClick={() => { setOpen(expanded ? null : part.id); show(index); }}>
                    <strong>{slideLabelOf(part)}</strong>
                    <span className="se-kind">
                      {partLabel(part.kind)}{onStage ? ' · na scenie, przechodzi między slajdami' : ''}
                      {mainOf !== undefined ? ` · obok „${slideLabelOf(mainOf)}”` : ''}
                      {!onStage && !beside && slide.transition !== 'scroll' ? ` · ${TRANSITION_LABEL[slide.transition].split(' — ')[0].toLowerCase()}` : ''}
                      {todo ? ' · do uzupełnienia' : ''}
                    </span>
                  </button>
                  <span className="se-tools">
                    <button type="button" aria-label="W górę" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" aria-label="W dół" disabled={busy || index === parts.length - 1} onClick={() => move(index, 1)}>↓</button>
                    <button type="button" aria-label="Usuń slajd" className="se-drop" disabled={busy}
                      onClick={async () => {
                        if (!(await askText(`Usunąć slajd „${slideLabelOf(part)}"?`))) return;
                        onChange(parts.filter((p) => p.id !== part.id));
                      }}>×</button>
                  </span>
                </div>

                {expanded && (
                  <div className="se-body">
                    <label className="wk-field">
                      <span>Nazwa w menu slajdów</span>
                      <input value={slide.label} placeholder={slideLabelOf({ ...part, layout: withSlide(part.layout, { ...slide, label: '' }) })}
                        disabled={busy} maxLength={60}
                        onChange={(e) => replace(part.id, { ...part, layout: withSlide(part.layout, { ...slide, label: e.target.value }) })} />
                      <span className="wk-hint">Puste: nagłówek modułu. Link w tekście „#{'{'}nazwa{'}'}" prowadzi do tego slajdu.</span>
                    </label>

                    <details className="wk-fold" open>
                      <summary>Treść</summary>
                      <PartSettings
                        part={part}
                        size={FULL}
                        busy={busy}
                        path={path}
                        onSet={(patch) => replace(part.id, { ...part, config: { ...part.config, ...patch } })}
                        onPickModule={(moduleId) => replace(part.id, { ...part, moduleId })}
                        onMadeModule={(moduleId) => {
                          const next = parts.map((p) => (p.id === part.id ? { ...p, moduleId } : p));
                          onChange(next);
                          onOpenModule(moduleId, next);
                        }}
                      />
                    </details>

                    {/*
                      0084 — AUF DER BÜHNE: kein eigener Slajd, sondern über allen,
                      mit einem Platz je Slajd, zu dem er beim Wechsel gleitet.
                    */}
                    <fieldset className="se-where">
                      <legend>Gdzie stoi</legend>
                      <label className="wk-check">
                        <input type="radio" name={`where-${part.id}`} checked={!onStage && !beside} disabled={busy}
                          onChange={() => setSlide({ ...slide, stage: null, with: null })} />
                        <span><strong>Własny slajd</strong></span>
                      </label>
                      <label className="wk-check se-stage-toggle">
                        <input type="radio" name={`where-${part.id}`} checked={onStage} disabled={busy}
                          onChange={() => {
                            const first = deck[0]?.key ?? COVER_KEY;
                            setSlide({ ...slide, with: null, stage: { frames: { [first]: { ...STAGE_FRAME, x: 78, y: 22, w: 26 } }, bare: false } });
                          }} />
                        <span>
                          <strong>Przechodzi między slajdami</strong> — nie ma własnego slajdu; stoi nad wszystkimi i przy zmianie
                          slajdu przesuwa się na swoje miejsce na następnym (logo, przycisk „Zapisz się”, licznik, cytat).
                        </span>
                      </label>
                      {own.some((p) => p.id !== part.id) && (
                        <label className="wk-check">
                          <input type="radio" name={`where-${part.id}`} checked={beside} disabled={busy}
                            onChange={() => {
                              const main = own.find((p) => p.id !== part.id);
                              if (main !== undefined) setSlide({ ...slide, stage: null, with: { slide: main.id, side: 'end', share: 45, tallSide: 'start' } });
                            }} />
                          <span>
                            <strong>Obok innego modułu</strong> — na jego slajdzie, w jednym rzędzie (obraz, animacja obok tekstu); na telefonie nad nim albo pod nim.
                          </span>
                        </label>
                      )}
                    </fieldset>

                    {beside && slide.with !== null && (
                      <CompanionEditor slide={slide} mains={own.filter((p) => p.id !== part.id)} busy={busy} onChange={setSlide} />
                    )}

                    {/* 0107 — jeder, wo er auch steht, darf sich bewegen: ein Auftritt, wenn sein Slajd erreicht ist, eine Schleife. */}
                    <details className="wk-fold">
                      <summary>Ruch{slide.motion.length > 0 ? ` (${slide.motion.length})` : ''}</summary>
                      <MotionField value={slide.motion} busy={busy} onChange={(motion) => setSlide({ ...slide, motion })} />
                    </details>

                    {onStage ? (
                      <StageEditor slide={slide} deck={deck} busy={busy} onChange={setSlide} onShow={(key) => { const at = deckIndex(key); if (at >= 0) control.current?.go(at); }} />
                    ) : beside ? null : (
                      <>
                        <details className="wk-fold">
                          <summary>Przejście i wejście{slide.transition !== 'scroll' || slide.enter !== 'none' || slide.colors !== null ? ' (ustawione)' : ''}</summary>
                          <MotionEditor slide={slide} first={deckIndex(part.id) === 0} busy={busy} onChange={setSlide} />
                        </details>

                        <details className="wk-fold">
                          <summary>Układ{slide.layout !== null ? ' (ustawiony)' : ''}</summary>
                          <LayoutEditor slide={slide} busy={busy} onChange={setSlide} />
                        </details>

                        <details className="wk-fold">
                          <summary>Tło slajdu</summary>
                          <LayerEditor
                            path={path}
                            theme={theme}
                            label={slideLabelOf(part)}
                            layers={slide.layers}
                            busy={busy}
                            onChange={(layers) => setSlide({ ...slide, layers })}
                          />
                        </details>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="se-add">
          <span className="pb-h">Dodaj slajd</span>
          <div className="pb-palette">
            {PARTS.map((one) => (
              <button key={one.kind} type="button" className="pb-pill" title={one.use} disabled={busy} onClick={() => add(one.kind)}>
                <span className="pb-pill-name">+ {one.label}</span>
                <span className="pb-pill-use">{one.use}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="se-preview">
        <p className="wk-hint">Podgląd — przewijaj w ramce, klikaj nazwy slajdów. Tak zobaczy to gość (bez zapisywania).</p>
        <PageSlides parts={parts} look={look} title={title} lead={lead} embedded control={control} />
      </div>
    </div>
  );
}

export default SlidesEditor;
