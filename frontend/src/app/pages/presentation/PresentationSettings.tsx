/**
 * Die Einstellungen am Rand des Präsentations-Editors: das Ganze, eine Szene, ein Baustein.
 */

import { MotionField } from '../motion/MotionField';
import type { DraftPart } from '../page';
import { PartSettings } from '../PageBuilder';
import { ImagePicker } from '../PageFiles';
import { partSize } from '../part';
import { partLabel } from '../parts/registry';
import { COLOR_KEYS, type SlideColors } from '../slides/slides';
import { DEFAULT_THEMES, type Look, resolveTheme } from '../slides/slideLook';
import { ColorField, ThemeEditor } from '../slides/SlideSettings';
import { LayerEditor } from '../slides/LayerEditor';
import { pieceLabelOf } from './PagePresentation';
import { ALIGNS, ARRIVALS, ARRIVAL_LABEL, type Align, DEPTH, EASES, EASE_LABEL, FONT_LABEL, FONT_PAIRS, FORMATS, FORMAT_LABEL, MEDIA, type Media, NAVS, NAV_LABEL, ORIGINS, ORIGIN_LABEL, type Piece, type Place, SCENE_CHANGES, SCENE_CHANGE_LABEL, SKINS, SKIN_LABEL, type Scene, type Show, TEXT_TYPES, TEXT_TYPE_LABEL, THREADS, THREAD_LABEL, WORDS, placeFor, readPiece } from './presentation';
import { END, targetLabel, targetOptions, withGo, withNext } from './showPaths';

const FULL = partSize({ colSpan: 6, rowSpan: 5 });

const ALIGN_LABEL: Record<Align, string> = { start: 'Do początku', center: 'Środek', end: 'Do końca' };

const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = { accent: 'Akcent', ink: 'Tekst', ground: 'Tło sceny', muted: 'Tekst drugi' };

/* -- Die ganze Präsentation -------------------------------------------------------------- */

export function ShowSettings({ look, show, path, theme, busy, onLook, onShow }: {
  look: Look; show: Show; path: string; theme: ReturnType<typeof resolveTheme>; busy: boolean; onLook: (next: Look) => void; onShow: (next: Show) => void;
}) {
  const night = look.theme?.night ?? null;
  return (
    <details className="wk-fold pe-show">
      <summary>Prezentacja: format, pismo, kolory</summary>
      <label className="wk-field">
        <span>Format</span>
        <select value={show.format} disabled={busy} onChange={(e) => onShow({ ...show, format: e.target.value as Show['format'] })}>
          {FORMATS.map((one) => <option key={one} value={one}>{FORMAT_LABEL[one]}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>Pismo</span>
        <select value={show.fonts} disabled={busy} onChange={(e) => onShow({ ...show, fonts: e.target.value as Show['fonts'] })}>
          {FONT_PAIRS.map((one) => <option key={one} value={one}>{FONT_LABEL[one]}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>Pasek scen</span>
        <select value={show.nav} disabled={busy} onChange={(e) => onShow({ ...show, nav: e.target.value as Show['nav'] })}>
          {NAVS.map((one) => <option key={one} value={one}>{NAV_LABEL[one]}</option>)}
        </select>
      </label>
      {/* 0108 — die Bühne höchstens so breit, und das Tuch hinter allen Szenen. */}
      <label className="wk-field">
        <span>Szerokość sceny (rem)</span>
        <input type="number" min={20} max={240} value={show.width ?? ''} placeholder="całe okno" disabled={busy}
          onChange={(e) => onShow({ ...show, width: e.target.value.trim() === '' ? null : Math.min(240, Math.max(20, Number(e.target.value))) })} />
        <span className="wk-hint">W tej szerokości liczą się miejsca modułów — na szerokim ekranie obraz zostaje razem (80 rem — jak pokaz Cogita). Tło zostaje na całym ekranie.</span>
      </label>
      <details className="wk-fold">
        <summary>Tło wspólne{show.backdrop.length > 0 ? ` (${show.backdrop.length})` : ''}</summary>
        <p className="wk-hint">
          Stoi za wszystkimi scenami. Gdy jest, sceny są przezroczyste, a ich własne tła (kolor sceny, jej warstwy) leżą w nim i przechodzą płynnie jedno w drugie — nici, fale i mgła zostają.
        </p>
        <LayerEditor path={path} theme={theme} label="" layers={show.backdrop} busy={busy} blank onChange={(backdrop) => onShow({ ...show, backdrop })} />
      </details>
      <ThemeEditor look={look} busy={busy} onChange={onLook} legend="Kolory" />
      {look.theme !== null && (
        <div className="pe-night">
          <label className="wk-check">
            <input type="checkbox" checked={night !== null} disabled={busy}
              onChange={(e) => {
                if (look.theme === null) return;
                const { mode: _m, night: _n, ...palette } = DEFAULT_THEMES.dark;
                onLook({ ...look, theme: { ...look.theme, mode: 'light', night: e.target.checked ? palette : null } });
              }} />
            <span>Inne kolory, gdy urządzenie gościa jest w trybie ciemnym</span>
          </label>
          {night !== null && look.theme !== null && (
            <div className="se-colors">
              {(['accent', 'ink', 'ground', 'muted'] as const).map((key) => (
                <ColorField key={key} label={`${COLOR_LABEL[key]} (noc)`} value={night[key]} busy={busy}
                  onChange={(v) => onLook({ ...look, theme: { ...look.theme!, night: { ...night, [key]: v } } })} />
              ))}
            </div>
          )}
        </div>
      )}
      <p className="wk-hint">
        Kolor modułu może też być parą „jasny|ciemny” (np. <code>#ece0c9|#2a2113</code>) albo nazwą: <code>accent</code>, <code>ink</code>,
        {' '}<code>ground</code>, <code>muted</code> — wtedy idzie za kolorami sceny.
      </p>
    </details>
  );
}

/* -- Eine Szene --------------------------------------------------------------------------- */

function Num({ label, value, min, max, step, busy, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number; busy: boolean; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label className="se-inline pe-num-field" title={hint}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} disabled={busy}
        onChange={(e) => onChange(Number(e.target.value))} />
      <input type="number" min={min} max={max} step={step} value={Number.isInteger(step) ? Math.round(value) : Math.round(value * 1000) / 1000}
        disabled={busy} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

export function SceneSettings({ scene, show, first, next, path, theme, need, busy, onChange }: {
  scene: Scene; show: Show; first: boolean; next: Scene | undefined; path: string; theme: ReturnType<typeof resolveTheme>; need: number; busy: boolean;
  onChange: (next: Scene) => void;
}) {
  const colors: SlideColors = scene.colors ?? { accent: null, ink: null, ground: null, muted: null };
  const setColor = (key: (typeof COLOR_KEYS)[number], value: string) => {
    const c: SlideColors = { ...colors, [key]: value.trim() === '' ? null : value };
    onChange({ ...scene, colors: COLOR_KEYS.some((k) => c[k] !== null) ? c : null });
  };
  const flown = next?.change === 'fly';

  return (
    <div className="pe-scene-settings">
      <label className="wk-field">
        <span>Nazwa (w pasku scen; link „#nazwa” w tekście prowadzi tutaj)</span>
        <input value={scene.label} disabled={busy} maxLength={80} onChange={(e) => onChange({ ...scene, label: e.target.value })} />
      </label>

      <label className="wk-field">
        <span>Jak ta scena zastępuje poprzednią</span>
        <select value={scene.change} disabled={busy}
          onChange={(e) => {
            const change = e.target.value as Scene['change'];
            const duration = scene.duration === (scene.change === 'fly' ? 1700 : 700) ? (change === 'fly' ? 1700 : 700) : scene.duration;
            onChange({ ...scene, change, duration });
          }}>
          {SCENE_CHANGES.map((one) => <option key={one} value={one}>{SCENE_CHANGE_LABEL[one]}</option>)}
        </select>
        {first && <span className="wk-hint">To pierwsza scena — jej przejście nie jest widoczne.</span>}
      </label>
      {!first && (scene.change === 'fade' || scene.change === 'build' || scene.change === 'rise') && (
        <label className="wk-check">
          <input type="checkbox" checked={scene.keep} disabled={busy} onChange={(e) => onChange({ ...scene, keep: e.target.checked })} />
          <span>Poprzednia scena zostaje pod spodem, aż przejście się skończy</span>
        </label>
      )}
      <Num label="Czas skoku (ms)" value={scene.duration} min={0} max={4000} step={50} busy={busy} onChange={(duration) => onChange({ ...scene, duration })}
        hint="Jak długo trwa przejście, gdy wywoła je strzałka albo jeden ruch kółkiem." />

      <Num label="Kroki" value={scene.steps} min={need} max={50} step={1} busy={busy} onChange={(steps) => onChange({ ...scene, steps: Math.max(need, Math.round(steps)) })}
        hint="Ile postojów ma scena. Moduł z krokiem jest wtedy wyróżniony." />

      {/* 0089 — wohin „dalej" führt: die nächste der Liste, eine andere Szene, das Ende oder hinaus. */}
      <label className="wk-field">
        <span>„Dalej” (strzałki, przewijanie) prowadzi do</span>
        <select value={scene.next ?? ''} disabled={busy} onChange={(e) => onChange(withNext(scene, e.target.value === '' ? null : e.target.value))}>
          <option value="">następnej na liście ({next === undefined ? 'koniec' : next.label || 'Scena'})</option>
          {targetOptions(show).filter((o) => o.value !== scene.key).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="wk-hint">Rozgałęzienia, przyciski i linki na zewnątrz — w widoku „Przejścia”.</span>
      </label>
      <label className="wk-check">
        <input type="checkbox" checked={scene.emphasis} disabled={busy} onChange={(e) => onChange({ ...scene, emphasis: e.target.checked })} />
        <span>Kroki wyróżniają swoje moduły (pozostałe bledną i odsuwają się)</span>
      </label>
      <label className="se-inline">
        <span>Nitka między krokami</span>
        <select value={scene.thread} disabled={busy} onChange={(e) => onChange({ ...scene, thread: e.target.value as Scene['thread'] })}>
          {THREADS.map((one) => <option key={one} value={one}>{THREAD_LABEL[one]}</option>)}
        </select>
      </label>
      <Num label="Idzie za wyróżnionym (szeroki)" value={scene.follow.wide} min={0} max={1} step={0.05} busy={busy}
        onChange={(wide) => onChange({ ...scene, follow: { ...scene.follow, wide } })} />
      <Num label="Idzie za wyróżnionym (wąski)" value={scene.follow.tall} min={0} max={1} step={0.05} busy={busy}
        onChange={(t) => onChange({ ...scene, follow: { ...scene.follow, tall: t } })} />

      <label className="wk-check">
        <input type="checkbox" checked={scene.grow !== null} disabled={busy}
          onChange={(e) => onChange({ ...scene, grow: e.target.checked ? { from: 0.8, to: 1.08 } : null })} />
        <span>Scena rośnie, gdy po niej idziesz</span>
      </label>
      {scene.grow !== null && (
        <>
          <Num label="Na początku" value={scene.grow.from} min={0.3} max={2} step={0.01} busy={busy} onChange={(from) => onChange({ ...scene, grow: { ...scene.grow!, from } })} />
          <Num label="Na końcu" value={scene.grow.to} min={0.3} max={2} step={0.01} busy={busy} onChange={(to) => onChange({ ...scene, grow: { ...scene.grow!, to } })} />
        </>
      )}

      <label className="wk-field">
        <span>Podpowiedź na dole (np. „Przewiń”)</span>
        <input value={scene.hint} disabled={busy} maxLength={60} onChange={(e) => onChange({ ...scene, hint: e.target.value })} />
      </label>

      <details className="wk-fold">
        <summary>Kolory sceny{scene.colors !== null ? ' (własne)' : ''}</summary>
        <div className="se-colors">
          <span className="wk-hint">Puste — jak cała prezentacja. Także „jasny|ciemny”.</span>
          {COLOR_KEYS.map((key) => (
            <ColorField key={key} label={COLOR_LABEL[key]} value={colors[key] ?? ''} busy={busy} allowEmpty onChange={(v) => setColor(key, v)} />
          ))}
        </div>
      </details>

      <details className="wk-fold">
        <summary>Tło sceny{scene.layers.length > 0 ? ` (${scene.layers.length})` : ''}</summary>
        {scene.layers.length === 0 ? (
          <div className="wk-actions">
            <button type="button" className="wk-link-btn" disabled={busy}
              onClick={() => onChange({ ...scene, layers: [{ kind: 'gradient', speed: 0, angle: 168, from: theme.ground, via: null, to: theme.ground }] })}>
              + Warstwa tła
            </button>
          </div>
        ) : (
          <LayerEditor path={path} theme={theme} label={scene.label} layers={scene.layers} busy={busy} onChange={(layers) => onChange({ ...scene, layers })} />
        )}
      </details>

      <details className="wk-fold">
        <summary>Głębia i chmura słów{scene.words !== null ? ' (ustawione)' : ''}</summary>
        <p className="wk-hint">
          Moduły z głębią (z mniejszym od zera) stoją w przestrzeni sceny. Gdy NASTĘPNA scena ma przejście „Przelot”,
          kamera przelatuje przez tę scenę — bliższe mijają pierwsze, najgłębszy zostaje na chwilę sam.
          {flown ? ' Następna scena przelatuje przez tę.' : ''}
        </p>
        <Num label="Perspektywa (px)" value={scene.depth.perspective} min={300} max={3000} step={50} busy={busy}
          onChange={(perspective) => onChange({ ...scene, depth: { ...scene.depth, perspective } })} />
        <Num label="Przelot kamery (px)" value={scene.depth.travel} min={0} max={6000} step={50} busy={busy}
          onChange={(travel) => onChange({ ...scene, depth: { ...scene.depth, travel } })} />
        <label className="wk-check">
          <input type="checkbox" checked={scene.depth.linger} disabled={busy} onChange={(e) => onChange({ ...scene, depth: { ...scene.depth, linger: e.target.checked } })} />
          <span>Zwolnij przy najgłębszym (zdanie zostaje chwilę samo)</span>
        </label>
        {scene.depth.perspective !== DEPTH.perspective || scene.depth.travel !== DEPTH.travel ? (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onChange({ ...scene, depth: DEPTH })}>Domyślna głębia</button>
        ) : null}

        <label className="wk-field">
          <span>Chmura słów — słowa (jedno w wierszu; puste — bez chmury)</span>
          <textarea rows={4} value={(scene.words?.list ?? []).join('\n')} disabled={busy}
            onChange={(e) => {
              const list = e.target.value.split('\n').map((w) => w.trim()).filter((w) => w !== '');
              onChange({ ...scene, words: list.length === 0 ? null : { ...(scene.words ?? WORDS), list } });
            }} />
        </label>
        {scene.words !== null && (
          <>
            <label className="se-inline">
              <span>Przed każdym słowem</span>
              <input value={scene.words.prefix} disabled={busy} maxLength={12} placeholder="np. RE"
                onChange={(e) => onChange({ ...scene, words: { ...scene.words!, prefix: e.target.value } })} />
            </label>
            <Num label="Ile słów w przestrzeni" value={scene.words.count} min={1} max={120} step={1} busy={busy}
              onChange={(count) => onChange({ ...scene, words: { ...scene.words!, count } })} />
            <Num label="Rozrzut (los)" value={scene.words.seed} min={0} max={9999} step={1} busy={busy}
              onChange={(seed) => onChange({ ...scene, words: { ...scene.words!, seed } })} />
            <ColorField label="Kolor słów" value={scene.words.color ?? ''} busy={busy} allowEmpty
              onChange={(v) => onChange({ ...scene, words: { ...scene.words!, color: v.trim() === '' ? null : v } })} />
          </>
        )}
      </details>
    </div>
  );
}

/* -- Ein Baustein ------------------------------------------------------------------------- */

export function PieceSettings({ part, show, scene, scenes, tall, path, busy, onPiece, onPart, onPlace, onDelete, onOpenModule }: {
  part: DraftPart;
  show: Show;
  scene: Scene;
  scenes: readonly Scene[];
  tall: boolean;
  path: string;
  busy: boolean;
  onPiece: (piece: Piece) => void;
  onPart: (part: DraftPart) => void;
  onPlace: (patch: Partial<Place>) => void;
  onDelete: () => void;
  onOpenModule: (moduleId: string) => void;
}) {
  const piece = readPiece(part.layout);
  const place = piece.places[scene.key];
  const e = placeFor(place, tall);
  const media: Media | null = piece.media;
  const setMedia = (patch: Partial<Media> | null) =>
    onPiece({ ...piece, media: patch === null ? null : { ...(media ?? MEDIA), ...patch } });

  return (
    <section className="pe-piece">
      <h4 className="pb-h">
        {pieceLabelOf(part)} <span className="wk-hint">· {partLabel(part.kind)}</span>
      </h4>

      <details className="wk-fold" open>
        <summary>Treść</summary>
        <PartSettings
          part={part}
          size={FULL}
          busy={busy}
          path={path}
          onSet={(patch) => onPart({ ...part, config: { ...part.config, ...patch } })}
          onPickModule={(moduleId) => onPart({ ...part, moduleId })}
          onMadeModule={onOpenModule}
        />
      </details>

      {/* 0089 — ein Knopf: auf dieser Szene ein Ausgang, mit eigenem Ziel. */}
      <details className="wk-fold pe-go" open={piece.go[scene.key] !== undefined}>
        <summary>Przycisk{piece.go[scene.key] !== undefined ? ` → ${targetLabel(show, piece.go[scene.key], 'nigdzie')}` : ''}</summary>
        <label className="wk-check">
          <input type="checkbox" checked={piece.go[scene.key] !== undefined} disabled={busy}
            onChange={(ev) => onPiece(withGo(piece, scene.key, ev.target.checked ? '' : undefined))} />
          <span>Na tej scenie to przycisk — kliknięcie prowadzi dalej</span>
        </label>
        {piece.go[scene.key] !== undefined && (
          <label className="wk-field">
            <span>Prowadzi do</span>
            <select value={piece.go[scene.key]} disabled={busy} onChange={(ev) => onPiece(withGo(piece, scene.key, ev.target.value))}>
              <option value="">— nigdzie (jeszcze) —</option>
              {targetOptions(show).filter((o) => o.value !== scene.key || o.value === END).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="wk-hint">Linki na zewnątrz dodasz w widoku „Przejścia”.</span>
          </label>
        )}
      </details>

      <details className="wk-fold" open>
        <summary>Miejsce na tej scenie{tall ? ' — wąski ekran' : ''}</summary>
        {tall && (
          <p className="wk-hint">
            Na wąskim ekranie: {place.tall === null ? 'jak na szerokim — zmiana tutaj zrobi osobne miejsce.' : 'osobne miejsce. '}
            {place.tall !== null && (
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onPiece({ ...piece, places: { ...piece.places, [scene.key]: { ...place, tall: null } } })}>
                Jak na szerokim
              </button>
            )}
          </p>
        )}
        <Num label="x %" value={e.x} min={-50} max={150} step={0.5} busy={busy} onChange={(x) => onPlace({ x })} />
        <Num label="y %" value={e.y} min={-50} max={150} step={0.5} busy={busy} onChange={(y) => onPlace({ y })} />
        <Num label="Szerokość %" value={e.w} min={1} max={200} step={0.5} busy={busy} onChange={(w) => onPlace({ w })} />
        <label className="wk-check">
          <input type="checkbox" checked={e.max !== null} disabled={busy} onChange={(ev) => onPlace({ max: ev.target.checked ? 22 : null })} />
          <span>Najwyżej tyle szerokości (rem) — na dużym ekranie nie rośnie dalej</span>
        </label>
        {e.max !== null && <Num label="Najwyżej (rem)" value={e.max} min={1} max={120} step={0.5} busy={busy} onChange={(max) => onPlace({ max })} />}
        <label className="wk-check">
          <input type="checkbox" checked={e.h !== null} disabled={busy} onChange={(ev) => onPlace({ h: ev.target.checked ? 30 : null })} />
          <span>Stała wysokość (pole, obraz w kadrze)</span>
        </label>
        {e.h !== null && <Num label="Wysokość %" value={e.h} min={1} max={200} step={0.5} busy={busy} onChange={(h) => onPlace({ h })} />}
        <Num label="Skala" value={e.scale} min={0} max={30} step={0.01} busy={busy} onChange={(scale) => onPlace({ scale })} />
        <Num label="Obrót °" value={e.rotate} min={-180} max={180} step={1} busy={busy} onChange={(rotate) => onPlace({ rotate })} />
        <Num label="Krycie" value={place.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => onPlace({ opacity })} />
        <Num label="Głębia (z)" value={place.z} min={-3000} max={500} step={10} busy={busy} onChange={(z) => onPlace({ z })}
          hint="0 — płasko. Mniej niż zero — w głąb sceny (widać przy przelocie kamery)." />
        <label className="se-inline">
          <span>Krok</span>
          <select value={place.step ?? ''} disabled={busy} onChange={(ev) => onPlace({ step: ev.target.value === '' ? null : Number(ev.target.value) })}>
            <option value="">— bez kroku</option>
            {Array.from({ length: Math.max(scene.steps + 1, (place.step ?? 0) + 1) }, (_, n) => <option key={n} value={n}>{n + 1}</option>)}
          </select>
        </label>
      </details>

      <details className="wk-fold">
        <summary>Wygląd</summary>
        <label className="se-inline">
          <span>Oprawa</span>
          <select value={piece.skin} disabled={busy} onChange={(ev) => onPiece({ ...piece, skin: ev.target.value as Piece['skin'] })}>
            {SKINS.map((one) => <option key={one} value={one}>{SKIN_LABEL[one]}</option>)}
          </select>
        </label>
        {part.kind === 'text' && (
          <label className="se-inline">
            <span>Tekst jako</span>
            <select value={piece.type} disabled={busy} onChange={(ev) => onPiece({ ...piece, type: ev.target.value as Piece['type'] })}>
              {TEXT_TYPES.map((one) => <option key={one} value={one}>{TEXT_TYPE_LABEL[one]}</option>)}
            </select>
          </label>
        )}
        <ColorField label="Tło" value={piece.fill ?? ''} busy={busy} allowEmpty onChange={(v) => onPiece({ ...piece, fill: v.trim() === '' ? null : v })} />
        <ColorField label="Pismo" value={piece.ink ?? ''} busy={busy} allowEmpty onChange={(v) => onPiece({ ...piece, ink: v.trim() === '' ? null : v })} />
        <ColorField label="Akcent" value={piece.accent ?? ''} busy={busy} allowEmpty onChange={(v) => onPiece({ ...piece, accent: v.trim() === '' ? null : v })} />
        <label className="se-inline">
          <span>Punkt miejsca</span>
          <select value={piece.origin} disabled={busy} onChange={(ev) => onPiece({ ...piece, origin: ev.target.value as Piece['origin'] })}>
            {ORIGINS.map((one) => <option key={one} value={one}>{ORIGIN_LABEL[one]}</option>)}
          </select>
        </label>
        <label className="se-inline">
          <span>Wyrównanie</span>
          <select value={piece.align} disabled={busy} onChange={(ev) => onPiece({ ...piece, align: ev.target.value as Align })}>
            {ALIGNS.map((one) => <option key={one} value={one}>{ALIGN_LABEL[one]}</option>)}
          </select>
        </label>
        <label className="se-inline">
          <span>W pionie</span>
          <select value={piece.valign} disabled={busy} onChange={(ev) => onPiece({ ...piece, valign: ev.target.value as Align })}>
            {ALIGNS.map((one) => <option key={one} value={one}>{ALIGN_LABEL[one]}</option>)}
          </select>
        </label>

        <fieldset className="pe-media">
          <legend>Obraz w oprawie {media === null ? '' : <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setMedia(null)}>usuń</button>}</legend>
          <ImagePicker path={path} value={media?.url ?? ''} busy={busy} onPick={(url) => setMedia({ url })} />
          <label className="se-inline">
            <span>Adres</span>
            <input value={media?.url ?? ''} disabled={busy} placeholder="/Hortus.jpg albo wybierz powyżej"
              onChange={(ev) => (ev.target.value.trim() === '' ? setMedia(null) : setMedia({ url: ev.target.value }))} />
          </label>
          {media !== null && (
            <>
              <label className="se-inline">
                <span>Gdzie</span>
                <select value={media.side} disabled={busy} onChange={(ev) => setMedia({ side: ev.target.value as Media['side'] })}>
                  <option value="after">Pod tekstem (zajmuje resztę)</option>
                  <option value="before">Nad tekstem</option>
                  <option value="behind">Za tekstem</option>
                </select>
              </label>
              <label className="se-inline">
                <span>Wypełnienie</span>
                <select value={media.fit} disabled={busy} onChange={(ev) => setMedia({ fit: ev.target.value as Media['fit'] })}>
                  <option value="cover">Kadr</option>
                  <option value="contain">Całe</option>
                </select>
              </label>
              {media.fit === 'contain' && <Num label="Wielkość %" value={media.size} min={5} max={100} step={1} busy={busy} onChange={(size) => setMedia({ size })} />}
              {media.fit === 'contain' && (
                <label className="wk-check">
                  <input type="checkbox" checked={media.max !== null} disabled={busy} onChange={(ev) => setMedia({ max: ev.target.checked ? 13 : null })} />
                  <span>Najwyżej tyle szerokości (rem)</span>
                </label>
              )}
              {media.fit === 'contain' && media.max !== null && <Num label="Najwyżej (rem)" value={media.max} min={1} max={80} step={0.5} busy={busy} onChange={(max) => setMedia({ max })} />}
              <label className="se-inline">
                <span>Środek</span>
                <input value={media.at} disabled={busy} maxLength={40} placeholder="center, 57% 50%" onChange={(ev) => setMedia({ at: ev.target.value })} />
              </label>
              <Num label="Krycie" value={media.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => setMedia({ opacity })} />
              <label className="wk-check">
                <input type="checkbox" checked={media.fade} disabled={busy} onChange={(ev) => setMedia({ fade: ev.target.checked })} />
                <span>Miękkie przejście w tekst</span>
              </label>
            </>
          )}
        </fieldset>
      </details>

      {/* 0108 — Bewegungen nach der Uhr: ein Auftritt, wenn die Szene erreicht ist, eine Schleife, solange er zu sehen ist. */}
      <details className="wk-fold" open={piece.motion.length > 0}>
        <summary>Ruch{piece.motion.length > 0 ? ` (${piece.motion.length})` : ''}</summary>
        <p className="wk-hint">Po dotarciu sceny (raz) albo w kółko, dopóki widać — przesuwa się, rośnie, obraca, rozjaśnia, rysuje; albo gotowy ruch z pokazu Cogita.</p>
        <MotionField value={piece.motion} busy={busy} onChange={(motion) => onPiece({ ...piece, motion })} />
      </details>

      <details className="wk-fold">
        <summary>Pojawienie się</summary>
        <label className="se-inline">
          <span>Jak</span>
          <select value={piece.arrive} disabled={busy} onChange={(ev) => onPiece({ ...piece, arrive: ev.target.value as Piece['arrive'] })}>
            {ARRIVALS.map((one) => <option key={one} value={one}>{ARRIVAL_LABEL[one]}</option>)}
          </select>
        </label>
        <Num label="Opóźnienie" value={piece.delay} min={0} max={0.95} step={0.01} busy={busy} onChange={(delay) => onPiece({ ...piece, delay })}
          hint="Część przejścia, po której zaczyna (0 — od razu, 0,5 — w połowie)." />
        <Num label="Trwa" value={piece.span} min={0.05} max={1} step={0.01} busy={busy} onChange={(span) => onPiece({ ...piece, span })}
          hint="Jaką część przejścia zajmuje jego pojawienie się." />
      </details>

      <details className="wk-fold" open={Object.keys(piece.places).length > 1 || piece.hold}>
        <summary>Wędrówka między scenami</summary>
        <p className="wk-hint">Zaznacz sceny, na których moduł ma swoje miejsce — przy zmianie sceny przejdzie płynnie z jednego na drugie (także przez sceny bez miejsca).</p>
        <ul className="pe-travel">
          {scenes.map((sc, i) => {
            const has = piece.places[sc.key] !== undefined;
            return (
              <li key={sc.key}>
                <label className="wk-check">
                  <input type="checkbox" checked={has} disabled={busy || (has && Object.keys(piece.places).length === 1)}
                    onChange={(ev) => {
                      const places = { ...piece.places };
                      if (ev.target.checked) places[sc.key] = { ...place, step: null };
                      else delete places[sc.key];
                      onPiece({ ...piece, places });
                    }} />
                  <span>{i + 1}. {sc.label || 'Scena'}{sc.key === scene.key ? ' (ta)' : ''}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <label className="se-inline">
          <span>Ruch</span>
          <select value={piece.ease} disabled={busy} onChange={(ev) => onPiece({ ...piece, ease: ev.target.value as Piece['ease'] })}>
            {EASES.map((one) => <option key={one} value={one}>{EASE_LABEL[one]}</option>)}
          </select>
        </label>
        <label className="wk-check">
          <input type="checkbox" checked={piece.hold} disabled={busy} onChange={(ev) => onPiece({ ...piece, hold: ev.target.checked })} />
          <span>Stoi też przed pierwszym i po ostatnim swoim miejscu</span>
        </label>
        <Num label="Warstwa" value={piece.layer} min={-10} max={20} step={1} busy={busy} onChange={(layer) => onPiece({ ...piece, layer })}
          hint="Wyżej — z przodu. Wędrujący od 10 w górę stoi nad wszystkimi scenami." />
      </details>

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => { const { [scene.key]: _gone, ...places } = piece.places; onPiece({ ...piece, places }); }}>
          Zdejmij z tej sceny
        </button>
        <button type="button" className="wk-link-btn se-drop" disabled={busy} onClick={onDelete}>Usuń moduł ze strony</button>
      </div>
    </section>
  );
}
