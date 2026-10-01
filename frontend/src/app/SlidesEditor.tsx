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
  BLENDS, blankLayer, DEFAULT_THEMES, defaultLayers, readSlide, resolveTheme, withSlide,
  type Blend, type Layer, type LayerKind, type Look, type Theme, type ThemeMode
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

  /* Wo ein Slajd in der Vorschau steht: der Titelslajd zählt mit, wenn es ihn gibt. */
  const show = (index: number) => control.current?.go(index + (hasCover ? 1 : 0));

  const replace = (id: string, next: DraftPart) => onChange(parts.map((p) => (p.id === id ? next : p)));

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= parts.length) return;
    const next = [...parts];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
    window.setTimeout(() => show(to), 50);
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
    window.setTimeout(() => show(parts.length), 80);
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
            const def = partOf(part.kind);
            const todo = def !== undefined && (def.missing(part.config) !== null
              || Object.values(part.config).every((v) => v.trim() === ''));

            return (
              <li key={part.id} className={`se-item${expanded ? ' is-open' : ''}`}>
                <div className="se-row">
                  <button type="button" className="se-num" title="Pokaż w podglądzie" onClick={() => show(index)}>
                    {index + 1 + (hasCover ? 1 : 0)}
                  </button>
                  <button type="button" className="se-name" aria-expanded={expanded}
                    onClick={() => { setOpen(expanded ? null : part.id); show(index); }}>
                    <strong>{slideLabelOf(part)}</strong>
                    <span className="se-kind">{partLabel(part.kind)}{todo ? ' · do uzupełnienia' : ''}</span>
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

                    <details className="wk-fold">
                      <summary>Tło slajdu</summary>
                      <LayerEditor
                        path={path}
                        theme={theme}
                        label={slideLabelOf(part)}
                        layers={slide.layers}
                        busy={busy}
                        onChange={(layers) => replace(part.id, { ...part, layout: withSlide(part.layout, { ...slide, layers }) })}
                      />
                    </details>
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

/* -- Das Thema ------------------------------------------------------------------ */

type ThemeChoice = 'auto' | ThemeMode;

function ThemeEditor({ look, busy, onChange }: { look: Look; busy: boolean; onChange: (next: Look) => void }) {
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
      <legend>Wygląd slajdów</legend>
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
function ColorField({ label, value, busy, onChange, allowEmpty = false }: {
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
function LayerEditor({ path, theme, label, layers, busy, onChange }: {
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

function Slider({ label, value, busy, hint, onChange }: {
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
