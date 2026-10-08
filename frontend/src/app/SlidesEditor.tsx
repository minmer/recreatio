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

import { newId } from './ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Layout } from './layout';
import { type DraftPart } from './page';
import { PartSettings } from './PageBuilder';
import { PageSlides, slideLabelOf } from './PageSlides';
import { partSize } from './part';
import { ImagePicker } from './PageFiles';
import { PARTS, partLabel, partOf } from './parts/registry';
import { usePrefersDark, type DeckControl } from './SlideDeck';
import {
  BLENDS, blankLayer, COLOR_KEYS, COVER_KEY, DEFAULT_THEMES, defaultLayers, ENTER_LABEL, ENTERS, readSlide, resolveTheme,
  STAGE_FRAME, TRANSITION_LABEL, TRANSITIONS, withSlide,
  type Blend, type Enter, type Layer, type LayerKind, type Look, type SlideColors, type SlideLook, type StageFrame,
  type Theme, type ThemeMode, type Transition
} from './slides';

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
  const hasCover = title.trim() !== '' || lead.trim() !== '';

  /*
   * Wo ein Slajd in der Vorschau steht: der Titelslajd zählt mit, wenn es ihn
   * gibt; ein Baustein auf der Bühne (0084) hat keinen eigenen — für ihn der
   * erste Slajd, auf dem er einen Platz hat.
   */
  const deck: { key: string; label: string }[] = [
    ...(hasCover ? [{ key: COVER_KEY, label: title.trim() || 'Start' }] : []),
    ...parts.filter((p) => readSlide(p.layout).stage === null).map((p) => ({ key: p.id, label: slideLabelOf(p) }))
  ];
  const deckIndex = (key: string) => deck.findIndex((one) => one.key === key);
  const showPart = (part: DraftPart) => {
    const stage = readSlide(part.layout).stage;
    const key = stage === null ? part.id : deck.find((one) => stage.frames[one.key] !== undefined)?.key;
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
    const own = next.filter((p) => readSlide(p.layout).stage === null);
    const at = own.findIndex((p) => p.id === parts[index].id);
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
            const setSlide = (next: SlideLook) => replace(part.id, { ...part, layout: withSlide(part.layout, next) });
            const def = partOf(part.kind);
            const todo = def !== undefined && (def.missing(part.config) !== null
              || Object.values(part.config).every((v) => v.trim() === ''));

            return (
              <li key={part.id} className={`se-item${expanded ? ' is-open' : ''}`}>
                <div className="se-row">
                  <button type="button" className={`se-num${onStage ? ' is-stage' : ''}`} title={onStage ? 'Na scenie — przechodzi między slajdami' : 'Pokaż w podglądzie'} onClick={() => show(index)}>
                    {onStage ? '◆' : deckIndex(part.id) + 1}
                  </button>
                  <button type="button" className="se-name" aria-expanded={expanded}
                    onClick={() => { setOpen(expanded ? null : part.id); show(index); }}>
                    <strong>{slideLabelOf(part)}</strong>
                    <span className="se-kind">
                      {partLabel(part.kind)}{onStage ? ' · na scenie, przechodzi między slajdami' : ''}
                      {!onStage && slide.transition !== 'scroll' ? ` · ${TRANSITION_LABEL[slide.transition].split(' — ')[0].toLowerCase()}` : ''}
                      {todo ? ' · do uzupełnienia' : ''}
                    </span>
                  </button>
                  <span className="se-tools">
                    <button type="button" aria-label="W górę" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" aria-label="W dół" disabled={busy || index === parts.length - 1} onClick={() => move(index, 1)}>↓</button>
                    <button type="button" aria-label="Usuń slajd" className="se-drop" disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Usunąć slajd „${slideLabelOf(part)}"?`)) return;
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
                    <label className="wk-check se-stage-toggle">
                      <input type="checkbox" checked={onStage} disabled={busy}
                        onChange={(e) => {
                          const first = deck[0]?.key ?? COVER_KEY;
                          setSlide({ ...slide, stage: e.target.checked ? { frames: { [first]: { ...STAGE_FRAME, x: 78, y: 22, w: 26 } }, bare: false } : null });
                        }} />
                      <span>
                        <strong>Przechodzi między slajdami</strong> — nie ma własnego slajdu; stoi nad wszystkimi i przy zmianie
                        slajdu przesuwa się na swoje miejsce na następnym (logo, przycisk „Zapisz się”, licznik, cytat).
                      </span>
                    </label>

                    {onStage ? (
                      <StageEditor slide={slide} deck={deck} busy={busy} onChange={setSlide} onShow={(key) => { const at = deckIndex(key); if (at >= 0) control.current?.go(at); }} />
                    ) : (
                      <>
                        <details className="wk-fold">
                          <summary>Przejście i wejście{slide.transition !== 'scroll' || slide.enter !== 'none' || slide.colors !== null ? ' (ustawione)' : ''}</summary>
                          <MotionEditor slide={slide} first={deckIndex(part.id) === 0} busy={busy} onChange={setSlide} />
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

/* -- 0084: der Wechsel, die Farben, die Bühne ------------------------------------- */

/** Wie der Slajd den vorigen ablöst, wie sein Inhalt erscheint, und seine eigenen Farben. */
function MotionEditor({ slide, first, busy, onChange }: {
  slide: SlideLook;
  /** Der erste Slajd hat keinen vorigen — sein Übergang zeigt sich nie. */
  first: boolean;
  busy: boolean;
  onChange: (next: SlideLook) => void;
}) {
  const colors: SlideColors = slide.colors ?? { accent: null, ink: null, ground: null, muted: null };
  const setColor = (key: (typeof COLOR_KEYS)[number], value: string) => {
    const next: SlideColors = { ...colors, [key]: value.trim() === '' ? null : value };
    onChange({ ...slide, colors: COLOR_KEYS.some((k) => next[k] !== null) ? next : null });
  };
  const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = { accent: 'Akcent', ink: 'Tekst', ground: 'Tło', muted: 'Tekst drugi' };

  return (
    <div className="se-motion">
      <label className="wk-field">
        <span>Jak ten slajd zastępuje poprzedni</span>
        <select value={slide.transition} disabled={busy} onChange={(e) => onChange({ ...slide, transition: e.target.value as Transition })}>
          {TRANSITIONS.map((t) => <option key={t} value={t}>{TRANSITION_LABEL[t]}</option>)}
        </select>
        <span className="wk-hint">
          {first
            ? 'To pierwszy slajd — przejście zobaczysz dopiero na następnych.'
            : 'Przejście idzie za przewijaniem: wolno przeciągnięte — wolno się dzieje, cofnięte — cofa się. Przy ustawieniu „mniej ruchu” w systemie zamienia się w przenikanie.'}
        </span>
      </label>
      <label className="wk-field">
        <span>Jak pojawia się treść</span>
        <select value={slide.enter} disabled={busy} onChange={(e) => onChange({ ...slide, enter: e.target.value as Enter })}>
          {ENTERS.map((t) => <option key={t} value={t}>{ENTER_LABEL[t]}</option>)}
        </select>
      </label>
      <div className="se-colors">
        <span className="wk-hint">Własne kolory tego slajdu (puste — jak strona). Między slajdami kolory przechodzą płynnie, także pasek z nazwami slajdów.</span>
        {COLOR_KEYS.map((key) => (
          <ColorField key={key} label={COLOR_LABEL[key]} value={colors[key] ?? ''} busy={busy} allowEmpty onChange={(v) => setColor(key, v)} />
        ))}
      </div>
    </div>
  );
}

/** Szybkie miejsca na scenie. */
const PLACES: readonly { label: string; frame: Partial<StageFrame> }[] = [
  { label: 'Środek', frame: { x: 50, y: 50 } },
  { label: 'Lewy górny', frame: { x: 18, y: 18 } },
  { label: 'Prawy górny', frame: { x: 82, y: 18 } },
  { label: 'Lewy dolny', frame: { x: 18, y: 82 } },
  { label: 'Prawy dolny', frame: { x: 82, y: 82 } },
  { label: 'Schowany', frame: { opacity: 0, scale: 0.6 } }
];

/**
 * DIE PLÄTZE EINES WANDERNDEN BAUSTEINS — je Slajd einer, oder keiner: dann
 * gleitet er zwischen den Nachbarn hindurch (vor dem ersten und nach dem
 * letzten bleibt er stehen).
 */
function StageEditor({ slide, deck, busy, onChange, onShow }: {
  slide: SlideLook;
  deck: readonly { key: string; label: string }[];
  busy: boolean;
  onChange: (next: SlideLook) => void;
  onShow: (key: string) => void;
}) {
  const stage = slide.stage!;
  const setFrame = (key: string, frame: StageFrame | null) => {
    const frames = { ...stage.frames };
    if (frame === null) delete frames[key]; else frames[key] = frame;
    onChange({ ...slide, stage: { ...stage, frames } });
  };
  const nearest = (index: number): StageFrame => {
    for (let i = index; i >= 0; i -= 1) { const f = stage.frames[deck[i].key]; if (f !== undefined) return f; }
    return STAGE_FRAME;
  };

  return (
    <div className="se-stage">
      <label className="wk-check">
        <input type="checkbox" checked={stage.bare} disabled={busy}
          onChange={(e) => onChange({ ...slide, stage: { ...stage, bare: e.target.checked } })} />
        <span>Bez ramki (logo, obraz, sam napis)</span>
      </label>
      <p className="wk-hint">
        Miejsce na każdym slajdzie: środek modułu w procentach sceny (x — od lewej, y — od góry), szerokość w procentach
        (na telefonie większa). Slajd bez własnego miejsca — moduł przepływa przez niego między sąsiednimi.
      </p>
      <ol className="se-stage-list">
        {deck.map((one, index) => {
          const frame = stage.frames[one.key];
          return (
            <li key={one.key} className={frame === undefined ? 'se-stage-slide' : 'se-stage-slide is-set'}>
              <div className="se-stage-head">
                <label className="wk-check">
                  <input type="checkbox" checked={frame !== undefined} disabled={busy}
                    onChange={(e) => setFrame(one.key, e.target.checked ? nearest(index) : null)} />
                  <span>{index + 1}. {one.label}</span>
                </label>
                <button type="button" className="wk-link-btn" onClick={() => onShow(one.key)}>pokaż</button>
              </div>
              {frame !== undefined && (
                <>
                  <div className="se-stage-places">
                    {PLACES.map((p) => (
                      <button key={p.label} type="button" className="wk-link-btn" disabled={busy}
                        onClick={() => setFrame(one.key, { ...frame, opacity: 1, scale: frame.scale < 0.7 ? 1 : frame.scale, ...p.frame })}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <StageNumber label="x %" value={frame.x} min={0} max={100} step={1} busy={busy} onChange={(x) => setFrame(one.key, { ...frame, x })} />
                  <StageNumber label="y %" value={frame.y} min={0} max={100} step={1} busy={busy} onChange={(y) => setFrame(one.key, { ...frame, y })} />
                  <StageNumber label="Szerokość %" value={frame.w} min={5} max={100} step={1} busy={busy} onChange={(w) => setFrame(one.key, { ...frame, w })} />
                  <StageNumber label="Skala" value={frame.scale} min={0.2} max={3} step={0.05} busy={busy} onChange={(scale) => setFrame(one.key, { ...frame, scale })} />
                  <StageNumber label="Obrót °" value={frame.rotate} min={-180} max={180} step={1} busy={busy} onChange={(rotate) => setFrame(one.key, { ...frame, rotate })} />
                  <StageNumber label="Krycie" value={frame.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => setFrame(one.key, { ...frame, opacity })} />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageNumber({ label, value, min, max, step, busy, onChange }: {
  label: string; value: number; min: number; max: number; step: number; busy: boolean; onChange: (value: number) => void;
}) {
  return (
    <label className="se-inline">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={busy} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}</output>
    </label>
  );
}

/* -- Das Thema ------------------------------------------------------------------ */

type ThemeChoice = 'auto' | ThemeMode;

export function ThemeEditor({ look, busy, onChange, legend = 'Wygląd slajdów' }: { look: Look; busy: boolean; onChange: (next: Look) => void; legend?: string }) {
  const choice: ThemeChoice = look.theme === null ? 'auto' : look.theme.mode;

  const pick = (next: ThemeChoice) => {
    if (next === choice) return;
    /* Wer den Modus wechselt, bekommt dessen Farben — dunkle Schrift auf dunklem Grund hilft niemandem. */
    onChange({ ...look, theme: next === 'auto' ? null : DEFAULT_THEMES[next] });
  };

  const set = (key: keyof Omit<Theme, 'mode'>, value: string) => {
    if (look.theme === null) return;
    onChange({ ...look, theme: { ...look.theme, [key]: value } });
  };

  return (
    <fieldset className="se-theme">
      <legend>{legend}</legend>
      <div className="wk-seg" role="group" aria-label="Motyw">
        {([['auto', 'Jak aplikacja'], ['dark', 'Ciemny'], ['light', 'Jasny']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={choice === value} disabled={busy}
            className={choice === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => pick(value)}>
            {label}
          </button>
        ))}
      </div>
      {look.theme === null ? (
        <p className="wk-hint">Kolory strony — jasne albo ciemne, tak jak urządzenie gościa.</p>
      ) : (
        <div className="se-colors">
          <ColorField label="Akcent" value={look.theme.accent} busy={busy} onChange={(v) => set('accent', v)} />
          <ColorField label="Tekst" value={look.theme.ink} busy={busy} onChange={(v) => set('ink', v)} />
          <ColorField label="Tło" value={look.theme.ground} busy={busy} onChange={(v) => set('ground', v)} />
          <ColorField label="Tekst drugi" value={look.theme.muted} busy={busy} onChange={(v) => set('muted', v)} />
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => onChange({ ...look, theme: DEFAULT_THEMES[look.theme!.mode] })}>
            Przywróć kolory
          </button>
        </div>
      )}
    </fieldset>
  );
}

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim());

/** Eine Farbe — mit dem Wähler des Systems und als Text, für den, der die Nummer kennt. */
export function ColorField({ label, value, busy, onChange, allowEmpty = false }: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="se-color">
      <span>{label}</span>
      <input type="color" value={isHex(value) ? value : '#000000'} disabled={busy} onChange={(e) => onChange(e.target.value)} />
      <input className="se-color-text" value={value} disabled={busy} maxLength={60}
        placeholder={allowEmpty ? 'jak tekst' : '#000000'} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* -- Die Schichten ---------------------------------------------------------------- */

const KIND_LABEL: Record<LayerKind, string> = { gradient: 'Gradient', image: 'Obraz', bigtext: 'Duży napis' };
const BLEND_LABEL: Record<Blend, string> = {
  normal: 'Zwykłe', multiply: 'Mnożenie', screen: 'Rozjaśnianie', overlay: 'Nakładka', 'soft-light': 'Miękkie światło'
};

/**
 * Die Schichten hinter einem Slajd, von hinten nach vorn (Altbestand: LayerEditor).
 * Leer heisst: das Tuch des Themas — es passt sich an hell und dunkel an.
 */
export function LayerEditor({ path, theme, label, layers, busy, onChange }: {
  path: string;
  theme: Theme;
  label: string;
  layers: readonly Layer[];
  busy: boolean;
  onChange: (next: readonly Layer[]) => void;
}) {
  if (layers.length === 0) {
    return (
      <div className="se-layers">
        <p className="wk-hint">
          Tło domyślne: gradient z koloru tła i nazwa slajdu jako duży, blady napis — dopasowuje się do motywu.
        </p>
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
          onClick={() => onChange(defaultLayers(label, theme))}>
          Dostosuj tło
        </button>
      </div>
    );
  }

  const update = (index: number, next: Layer) => onChange(layers.map((one, i) => (i === index ? next : one)));
  const shift = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= layers.length) return;
    const next = [...layers];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <div className="se-layers">
      <p className="wk-hint">Warstwy od tyłu do przodu. Tempo 0 — stoi, 1 — przesuwa się razem z treścią.</p>
      {layers.map((layer, index) => (
        <fieldset key={index} className="se-layer">
          <legend>
            {index + 1}. {KIND_LABEL[layer.kind]}
            <span className="se-tools">
              <button type="button" aria-label="Warstwa do tyłu" disabled={busy || index === 0} onClick={() => shift(index, -1)}>↑</button>
              <button type="button" aria-label="Warstwa do przodu" disabled={busy || index === layers.length - 1} onClick={() => shift(index, 1)}>↓</button>
              <button type="button" aria-label="Usuń warstwę" className="se-drop" disabled={busy}
                onClick={() => onChange(layers.filter((_, i) => i !== index))}>×</button>
            </span>
          </legend>

          <label className="se-inline">
            <span>Rodzaj</span>
            <select value={layer.kind} disabled={busy}
              onChange={(e) => update(index, { ...blankLayer(e.target.value as LayerKind, theme), speed: layer.speed })}>
              {(['gradient', 'image', 'bigtext'] as const).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>

          <Slider label={layer.kind === 'bigtext' ? 'Długość przejazdu' : 'Tempo'} value={layer.speed} busy={busy}
            hint={layer.kind === 'bigtext' ? 'Napis wędruje z dołu do góry; 1 = cała wysokość ekranu.' : undefined}
            onChange={(speed) => update(index, { ...layer, speed })} />

          {layer.kind === 'gradient' && (
            <>
              <label className="se-inline">
                <span>Kąt</span>
                <input type="number" min={0} max={360} value={layer.angle} disabled={busy}
                  onChange={(e) => update(index, { ...layer, angle: Number(e.target.value) || 0 })} />
              </label>
              <ColorField label="Od" value={layer.from} busy={busy} onChange={(from) => update(index, { ...layer, from })} />
              <ColorField label="Przez" value={layer.via ?? ''} busy={busy} allowEmpty
                onChange={(via) => update(index, { ...layer, via: via.trim() === '' ? null : via })} />
              <ColorField label="Do" value={layer.to} busy={busy} onChange={(to) => update(index, { ...layer, to })} />
            </>
          )}

          {layer.kind === 'image' && (
            <>
              <ImagePicker path={path} value={layer.url} busy={busy} onPick={(url) => update(index, { ...layer, url })} />
              <label className="se-inline">
                <span>Adres</span>
                <input value={layer.url} disabled={busy} placeholder="https://… albo wybierz powyżej"
                  onChange={(e) => update(index, { ...layer, url: e.target.value })} />
              </label>
              <Slider label="Krycie" value={layer.opacity} busy={busy} onChange={(opacity) => update(index, { ...layer, opacity })} />
              <label className="se-inline">
                <span>Mieszanie</span>
                <select value={layer.blend} disabled={busy} onChange={(e) => update(index, { ...layer, blend: e.target.value as Blend })}>
                  {BLENDS.map((b) => <option key={b} value={b}>{BLEND_LABEL[b]}</option>)}
                </select>
              </label>
              <label className="se-inline">
                <span>Pozycja</span>
                <input value={layer.position} disabled={busy} placeholder="center, top, 50% 30%"
                  onChange={(e) => update(index, { ...layer, position: e.target.value })} />
              </label>
            </>
          )}

          {layer.kind === 'bigtext' && (
            <>
              <label className="wk-field">
                <span>Linie napisu (najwyżej trzy)</span>
                <textarea rows={3} value={layer.lines.join('\n')} disabled={busy}
                  onChange={(e) => update(index, { ...layer, lines: e.target.value.split('\n').slice(0, 3) })} />
              </label>
              <Slider label="Krycie" value={layer.opacity} busy={busy} onChange={(opacity) => update(index, { ...layer, opacity })} />
              <ColorField label="Kolor" value={layer.color ?? ''} busy={busy} allowEmpty
                onChange={(color) => update(index, { ...layer, color: color.trim() === '' ? null : color })} />
            </>
          )}
        </fieldset>
      ))}

      <div className="wk-actions">
        {(['gradient', 'image', 'bigtext'] as const).map((k) => (
          <button key={k} type="button" className="wk-link-btn" disabled={busy || layers.length >= 6}
            onClick={() => onChange([...layers, blankLayer(k, theme)])}>
            + {KIND_LABEL[k]}
          </button>
        ))}
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onChange([])}>Tło domyślne</button>
      </div>
    </div>
  );
}

export function Slider({ label, value, busy, hint, onChange }: {
  label: string;
  value: number;
  busy: boolean;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="se-inline" title={hint}>
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} disabled={busy}
        onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value.toFixed(2)}</output>
    </label>
  );
}

export default SlidesEditor;
