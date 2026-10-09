/**
 * DER EDITOR EINER PRÄSENTATION (0085) — Szenen links, die Leinwand rechts.
 *
 * <b>Die Leinwand ist die Bühne selbst</b> (`PresentationView`), stehend an der
 * gewählten Stelle: was man zieht, steht genau so auf der Seite. Ein Klick
 * wählt einen Baustein; der Rahmen darum verschiebt ihn, die Griffe ändern
 * Breite und Höhe; die Pfeiltasten rücken ihn (mit Umschalt weiter). Er rastet
 * an der Mitte und an den anderen ein — mit Alt nicht.
 *
 * <b>Breit und hoch</b> (beim Format „cały ekran"): wer auf „wąski" stellt,
 * sieht das Telefon hochkant, und was er dort zieht, gilt nur dort (`tall`).
 *
 * <b>Wege</b> (0089): „Przejścia" zeigt statt der Leinwand die Karte der Szenen
 * (`PathsEditor`) — Ausgänge, Knöpfe, Wege hinaus.
 *
 * <b>Ein Baustein ist derselbe wie auf der Seite</b>: ein Text bleibt ein Text,
 * ein Kalender ein Kalender — hier bekommt er dazu einen Platz je Szene, eine
 * Hülle und eine Art zu kommen. Steht er auf mehreren Szenen, wandert er.
 */

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

import { newId } from './ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Layout } from './layout';
import type { DraftPart } from './page';
import { PartSettings } from './PageBuilder';
import { ImagePicker } from './PageFiles';
import { PagePresentation, pieceLabelOf } from './PagePresentation';
import { partSize } from './part';
import { PARTS, partLabel, partOf } from './parts/registry';
import {
  ALIGNS, ARRIVAL_LABEL, ARRIVALS, ASPECT, blankScene, DEPTH, EASE_LABEL, EASES, FONT_LABEL, FONT_PAIRS, FORMAT_LABEL, FORMATS,
  MEDIA, NAV_LABEL, NAVS, ORIGIN_AT, ORIGIN_LABEL, ORIGINS, PIECE, PLACE, placeFor, readPiece, readShow, SCENE_CHANGE_LABEL, SCENE_CHANGES, showJson,
  SKIN_LABEL, SKINS, stepsNeeded, TEXT_TYPE_LABEL, TEXT_TYPES, THREAD_LABEL, THREADS, withPiece, WORDS,
  type Align, type Media, type Piece, type Place, type Scene, type Show, type TallPlace
} from './presentation';
import { ARRANGEMENT_LABEL, ARRANGEMENTS, arrange, depthScale, zonesOf, type Arrangement } from './presentationMotion';
import { PathsEditor } from './PathsEditor';
import { END, routeTo, targetLabel, targetOptions, withGo, withNext } from './showPaths';
import { ColorField, LayerEditor, ThemeEditor } from './SlidesEditor';
import { usePrefersDark } from './SlideDeck';
import { COLOR_KEYS, DEFAULT_THEMES, resolveTheme, type Look, type SlideColors } from './slides';
import type { DriveControl } from './usePresentationDrive';

const FULL = partSize({ colSpan: 6, rowSpan: 5 });

const ALIGN_LABEL: Record<Align, string> = { start: 'Do początku', center: 'Środek', end: 'Do końca' };
const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = { accent: 'Akcent', ink: 'Tekst', ground: 'Tło sceny', muted: 'Tekst drugi' };

/** Eine kurze, eigene Kennung für eine Szene — die Plätze zeigen darauf. */
const sceneKey = (): string => newId().replace(/-/g, '').slice(0, 10);

/** Was ein neuer Baustein auf der Bühne trägt — je Art passend. */
function freshPiece(kind: string, key: string, at: { x: number; y: number }): Piece {
  const text = kind === 'text';
  const bare = kind === 'image' || kind === 'shape';
  return {
    ...PIECE,
    skin: text ? 'bubble' : bare ? 'plain' : 'card',
    type: text ? 'body' : 'auto',
    places: { [key]: { ...PLACE, x: at.x, y: at.y, w: kind === 'shape' ? 14 : bare ? 22 : text ? 28 : 46 } }
  };
}

/** Eine Stelle im Raster für jede Grösse — falls die Seite wieder eine Seite mit Modulen wird. */
function gridLayout(parts: readonly DraftPart[], kind: string): Layout {
  const def = partOf(kind);
  const layout: Record<string, unknown> = {};
  for (const bp of BREAKPOINTS) {
    const cols = COLUMNS[bp];
    const size = { colSpan: snapColSpan(def?.box.colSpan ?? 6, cols), rowSpan: snapRowSpan(def?.box.rowSpan ?? 3) };
    layout[bp] = { position: firstFreeCell(parts, size, cols, bp), size };
  }
  return layout as Layout;
}

export function PresentationEditor({ path, parts, look, title, busy, onChange, onLook, onOpenModule }: {
  path: string;
  parts: readonly DraftPart[];
  look: Look;
  title: string;
  busy: boolean;
  onChange: (next: readonly DraftPart[]) => void;
  onLook: (next: Look) => void;
  onOpenModule: (moduleId: string, parts: readonly DraftPart[]) => void;
}) {
  const show = readShow(look.show);
  const dark = usePrefersDark();
  const theme = resolveTheme(look.theme, dark);
  const setShow = (next: Show) => onLook({ ...look, show: showJson(next) });

  const [sceneAt, setSceneAt] = useState(0);
  const [step, setStep] = useState(0);
  const [tallView, setTallView] = useState(false);
  const [playing, setPlaying] = useState(false);
  /* 0089 — die Karte der Wege statt der Leinwand. */
  const [mapping, setMapping] = useState(false);
  /* Ein Vortrag auf dem ganzen Bildschirm, mit dem, was gerade im Editor steht — ab der gewählten Szene, auf dem Weg dorthin. */
  const [present, setPresent] = useState<{ readonly at: number; readonly route: readonly string[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const scenes = show.scenes;
  const index = Math.min(sceneAt, Math.max(0, scenes.length - 1));
  const scene: Scene | undefined = scenes[index];
  const tall = show.format === 'screen' && tallView;
  const zones = zonesOf(scenes.map((sc) => sc.steps));
  const at = scene === undefined ? 0 : zones[index].at + Math.min(step, scene.steps - 1);

  const replacePart = (next: DraftPart) => onChange(parts.map((p) => (p.id === next.id ? next : p)));
  const setPiece = (part: DraftPart, piece: Piece) => replacePart({ ...part, layout: withPiece(part.layout, piece) });

  /* -- Szenen -------------------------------------------------------------------- */

  const setScene = (next: Scene) => setShow({ ...show, scenes: scenes.map((sc, i) => (i === index ? next : sc)) });

  const addScene = (copy: boolean) => {
    const key = sceneKey();
    const made: Scene = copy && scene !== undefined
      ? { ...scene, key, label: scene.label === '' ? '' : `${scene.label} (2)` }
      : blankScene(key, scenes.length === 0 ? (title.trim() || 'Start') : `Scena ${scenes.length + 1}`);
    const next = [...scenes.slice(0, index + 1), made, ...scenes.slice(index + 1)];
    setShow({ ...show, scenes: scenes.length === 0 ? [made] : next });
    /* Eine Kopie nimmt ihre Bausteine mit — an dieselben Plätze. */
    if (copy && scene !== undefined) {
      onChange(parts.map((part) => {
        const piece = readPiece(part.layout);
        const place = piece.places[scene.key];
        return place === undefined ? part : { ...part, layout: withPiece(part.layout, { ...piece, places: { ...piece.places, [key]: place } }) };
      }));
    }
    setSceneAt(scenes.length === 0 ? 0 : index + 1);
    setStep(0);
  };

  const dropScene = () => {
    if (scene === undefined) return;
    if (!window.confirm(`Usunąć scenę „${scene.label || index + 1}"? Moduły zostają na stronie; znikają tylko ich miejsca na tej scenie.`)) return;
    onChange(parts.map((part) => {
      const piece = readPiece(part.layout);
      if (piece.places[scene.key] === undefined && piece.go[scene.key] === undefined) return part;
      const { [scene.key]: _gone, ...places } = piece.places;
      return { ...part, layout: withPiece(part.layout, withGo({ ...piece, places }, scene.key, undefined)) };
    }));
    setShow({ ...show, scenes: scenes.filter((_, i) => i !== index) });
    setSceneAt(Math.max(0, index - 1));
    setStep(0);
  };

  const moveScene = (by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= scenes.length) return;
    const next = [...scenes];
    [next[index], next[to]] = [next[to], next[index]];
    setShow({ ...show, scenes: next });
    setSceneAt(to);
  };

  /** Jede Szene so viele Schritte, wie ihre Bausteine brauchen — nie weniger. */
  const withSteps = (nextParts: readonly DraftPart[]) => {
    const pieces = nextParts.map((p) => readPiece(p.layout));
    let changed = false;
    const fixed = scenes.map((sc) => {
      const need = stepsNeeded(sc.key, pieces);
      if (need > sc.steps) { changed = true; return { ...sc, steps: need }; }
      return sc;
    });
    if (changed) setShow({ ...show, scenes: fixed });
    onChange(nextParts);
  };

  /* -- Bausteine ----------------------------------------------------------------- */

  const here = scene === undefined ? [] : parts.filter((part) => readPiece(part.layout).places[scene.key] !== undefined);
  const elsewhere = parts.filter((part) => !here.includes(part));
  const chosen = parts.find((part) => part.id === selected) ?? null;

  const add = (kind: string) => {
    if (scene === undefined) return;
    const id = newId();
    const piece = freshPiece(kind, scene.key, { x: 50, y: 50 });
    const made: DraftPart = { id, moduleId: null, kind, layout: withPiece(gridLayout(parts, kind), piece), config: {} };
    onChange([...parts, made]);
    setSelected(id);
  };

  const placeHere = (part: DraftPart) => {
    if (scene === undefined) return;
    const piece = readPiece(part.layout);
    const fresh = Object.keys(piece.places).length === 0 ? freshPiece(part.kind, scene.key, { x: 50, y: 50 }) : piece;
    const all = Object.values(piece.places);
    const last = all.length === 0 ? undefined : all[all.length - 1];
    setPiece(part, { ...fresh, places: { ...fresh.places, [scene.key]: last ?? fresh.places[scene.key] } });
    setSelected(part.id);
  };

  /** Plätze für alle Bausteine dieser Szene — breit und (beim vollen Bildschirm) hoch zugleich. */
  const arrangeAll = (kind: Arrangement) => {
    if (scene === undefined || here.length === 0) return;
    const ordered = [...here].sort((a, b) => (readPiece(a.layout).places[scene.key].step ?? 99) - (readPiece(b.layout).places[scene.key].step ?? 99));
    const wide = arrange(kind, ordered.length, false, index);
    const high = arrange(kind, ordered.length, true, index);
    const byId = new Map(ordered.map((part, i) => [part.id, i]));
    withSteps(parts.map((part) => {
      const i = byId.get(part.id);
      if (i === undefined) return part;
      const piece = readPiece(part.layout);
      const place = piece.places[scene.key];
      const w = wide[i], h = high[i];
      const tallPlace: TallPlace | null = show.format === 'screen'
        ? { x: h.x, y: h.y, ...(h.w !== undefined ? { w: h.w } : {}), ...(h.h !== undefined ? { h: h.h } : {}) }
        : null;
      return {
        ...part,
        layout: withPiece(part.layout, {
          ...piece,
          places: { ...piece.places, [scene.key]: { ...place, x: w.x, y: w.y, ...(w.w !== undefined ? { w: w.w } : {}), ...(w.h !== undefined ? { h: w.h } : {}), tall: tallPlace } }
        })
      };
    }));
  };

  const stepsInOrder = (on: boolean) => {
    if (scene === undefined) return;
    const order = new Map(here.map((part, i) => [part.id, i]));
    withSteps(parts.map((part) => {
      const i = order.get(part.id);
      if (i === undefined) return part;
      const piece = readPiece(part.layout);
      return { ...part, layout: withPiece(part.layout, { ...piece, places: { ...piece.places, [scene.key]: { ...piece.places[scene.key], step: on ? i : null } } }) };
    }));
    if (on) setScene({ ...scene, steps: Math.max(scene.steps, here.length) });
  };

  /* -- Die Leinwand: wählen, ziehen, Griffe ---------------------------------------- */

  const control = useRef<DriveControl | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const drag = useRef<{ mode: 'move' | 'w' | 'h' | 'wh'; x0: number; y0: number; place: Place; factor: number } | null>(null);
  const [live, setLive] = useState<{ id: string; place: Place } | null>(null);

  /* Was gerade gezogen wird, steht schon auf der Leinwand — gespeichert wird beim Loslassen. */
  const shown = live === null || scene === undefined ? parts : parts.map((part) => {
    if (part.id !== live.id) return part;
    const piece = readPiece(part.layout);
    return { ...part, layout: withPiece(part.layout, { ...piece, places: { ...piece.places, [scene.key]: live.place } }) };
  });

  const chosenPlace: Place | null = chosen === null || scene === undefined ? null : readPiece(chosen.layout).places[scene.key] ?? null;

  /* Wo der Rahmen steht: dort, wo die Bühne den Baustein gemalt hat — gemessen nach jedem Bauen und jedem Malen. */
  /*
   * Nur setzen, was sich WIRKLICH geändert hat — verglichen mit dem, was steht.
   * Ein setState mit demselben Wert lässt React den Editor trotzdem noch einmal
   * zeichnen, die Bühne malt neu, und dieser Haken misst wieder: ohne den
   * Vergleich vorher drehte sich das im Kreis (React #185).
   */
  const frameNow = useRef<typeof frame>(null);
  frameNow.current = frame;
  const measureFrame = useCallback(() => {
    const put = (next: typeof frame) => {
      const was = frameNow.current;
      const same = was === null || next === null ? was === next
        : Math.abs(was.left - next.left) < 0.5 && Math.abs(was.top - next.top) < 0.5
          && Math.abs(was.width - next.width) < 0.5 && Math.abs(was.height - next.height) < 0.5;
      if (same) return;
      frameNow.current = next;
      setFrame(next);
    };
    if (selected === null || canvas.current === null || playing) { put(null); return; }
    const el = canvas.current.querySelector<HTMLElement>(`[data-pz-piece="${CSS.escape(selected)}"]`);
    if (el === null || el.style.visibility === 'hidden') { put(null); return; }
    const box = el.getBoundingClientRect();
    const base = canvas.current.getBoundingClientRect();
    put({ left: box.left - base.left, top: box.top - base.top, width: box.width, height: box.height });
  }, [selected, playing]);

  useLayoutEffect(measureFrame);

  /* Die Bühne malt auch ohne den Editor (ihre eigene Grösse, ein Bild, das lädt): dann mit. */
  useLayoutEffect(() => {
    const node = canvas.current;
    if (node === null || selected === null) return undefined;
    /* Gemessen wird im nächsten Bild — erst dann hat die Bühne ihre neue Grösse und ihren neuen Massstab gemalt. */
    let frame = 0;
    const soon = () => { if (frame === 0) frame = requestAnimationFrame(() => { frame = 0; measureFrame(); }); };
    const el = node.querySelector(`[data-pz-piece="${CSS.escape(selected)}"]`);
    const fitting = node.querySelector('.pz-frame');
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    sizes?.observe(node);
    if (el !== null) sizes?.observe(el);
    if (fitting !== null) sizes?.observe(fitting);
    const styles = new MutationObserver(soon);
    if (el !== null) styles.observe(el, { attributes: true, attributeFilter: ['style'] });
    const stage = node.querySelector('.pz-stage');
    if (stage !== null) styles.observe(stage, { attributes: true, attributeFilter: ['style'] });
    return () => { sizes?.disconnect(); styles.disconnect(); if (frame !== 0) cancelAnimationFrame(frame); };
  }, [selected, measureFrame, tall, playing]);

  /** Die Werte, die gerade gelten (hoch: mit den eigenen) — und wie man sie zurückschreibt. */
  const effective = (place: Place) => placeFor(place, tall);
  const patchPlace = (place: Place, patch: Partial<Place>): Place => {
    if (!tall) return { ...place, ...patch };
    const { x, y, w, h, max, scale, rotate, ...rest } = patch;
    const tallPatch: Record<string, unknown> = {};
    if (x !== undefined) tallPatch.x = x;
    if (y !== undefined) tallPatch.y = y;
    if (w !== undefined) tallPatch.w = w;
    if (h !== undefined) tallPatch.h = h;
    if (max !== undefined) tallPatch.max = max;
    if (scale !== undefined) tallPatch.scale = scale;
    if (rotate !== undefined) tallPatch.rotate = rotate;
    return { ...place, ...rest, tall: Object.keys(tallPatch).length === 0 ? place.tall : { ...(place.tall ?? {}), ...tallPatch } };
  };

  const commitPlace = (part: DraftPart, place: Place) => {
    if (scene === undefined) return;
    const piece = readPiece(part.layout);
    withSteps(parts.map((p) => (p.id === part.id ? { ...p, layout: withPiece(p.layout, { ...piece, places: { ...piece.places, [scene.key]: place } }) } : p)));
  };

  const snapTargets = useCallback((skip: string): { xs: number[]; ys: number[] } => {
    const xs = [50], ys = [50];
    if (scene === undefined) return { xs, ys };
    for (const part of parts) {
      if (part.id === skip) continue;
      const place = readPiece(part.layout).places[scene.key];
      if (place === undefined) continue;
      const e = placeFor(place, tall);
      xs.push(e.x);
      ys.push(e.y);
    }
    return { xs, ys };
  }, [parts, scene, tall]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'w' | 'h' | 'wh') => {
    if (chosen === null || chosenPlace === null || scene === undefined || busy) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const z = chosenPlace.z;
    /* In der Tiefe erscheint ein Schritt grösser — gezogen wird im Raum, nicht auf dem Bild. */
    const factor = z !== 0 ? 1 / depthScale(z, scene.depth.perspective) : 1;
    drag.current = { mode, x0: event.clientX, y0: event.clientY, place: chosenPlace, factor };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d === null || chosen === null || stageEl === null) return;
    const rect = stageEl.getBoundingClientRect();
    const dx = ((event.clientX - d.x0) / rect.width) * 100 * d.factor;
    const dy = ((event.clientY - d.y0) / rect.height) * 100 * d.factor;
    const base = effective(d.place);
    const round = (v: number) => Math.round(v * 10) / 10;
    let patch: Partial<Place>;
    if (d.mode === 'move') {
      let x = base.x + dx, y = base.y + dy;
      let gx: number | null = null, gy: number | null = null;
      if (!event.altKey) {
        const { xs, ys } = snapTargets(chosen.id);
        for (const t of xs) if (Math.abs(x - t) < 1.2) { x = t; gx = t; break; }
        for (const t of ys) if (Math.abs(y - t) < 1.2) { y = t; gy = t; break; }
      }
      setGuides({ x: gx, y: gy });
      patch = { x: round(x), y: round(y) };
    } else {
      /* Der Punkt des Bausteins bleibt stehen: steht er mit der Mitte dort, wächst jede Seite um den Weg der Hand. */
      const pin = ORIGIN_AT[readPiece(chosen.layout).origin];
      const kx = 1 / Math.max(0.5, 1 - pin.x), ky = 1 / Math.max(0.5, 1 - pin.y);
      const w = d.mode === 'w' || d.mode === 'wh' ? round(Math.max(2, base.w + kx * dx / Math.max(0.05, base.scale))) : undefined;
      const h = (d.mode === 'h' || d.mode === 'wh') && base.h !== null ? round(Math.max(2, base.h + ky * dy / Math.max(0.05, base.scale))) : undefined;
      patch = { ...(w === undefined ? {} : { w }), ...(h === undefined ? {} : { h }) };
    }
    setLive({ id: chosen.id, place: patchPlace(d.place, patch) });
  };

  const endDrag = () => {
    if (drag.current === null) return;
    drag.current = null;
    setGuides({ x: null, y: null });
    if (live !== null && chosen !== null && live.id === chosen.id) commitPlace(chosen, live.place);
    setLive(null);
  };

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (chosen === null || chosenPlace === null || playing) return;
    const by = event.shiftKey ? 5 : 0.5;
    const e = effective(chosenPlace);
    const move: Partial<Place> | null =
      event.key === 'ArrowLeft' ? { x: e.x - by } : event.key === 'ArrowRight' ? { x: e.x + by }
      : event.key === 'ArrowUp' ? { y: e.y - by } : event.key === 'ArrowDown' ? { y: e.y + by } : null;
    if (event.key === 'Escape') { setSelected(null); return; }
    if (move === null) return;
    event.preventDefault();
    commitPlace(chosen, patchPlace(chosenPlace, move));
  };

  /* Die Leinwand ist ein echter Schirm, verkleinert: breit 1440 × 810, ein Telefon 390 × 760, feste Formate in ihrem Verhältnis. */
  const fixedAspect = ASPECT[show.format];
  const virtual = fixedAspect !== null ? { w: 1280, h: Math.round(1280 / fixedAspect) } : tall ? { w: 390, h: 760 } : { w: 1440, h: 810 };
  const aspect = virtual.w / virtual.h;

  /* -- Zeichnen ----------------------------------------------------------------------- */

  return (
    <div className="pe">
      <div className="pe-side">
        <ShowSettings look={look} show={show} busy={busy} onLook={onLook} onShow={setShow} />

        <h4 className="pb-h">Sceny ({scenes.length})</h4>
        {scenes.length === 0 && (
          <div className="pe-empty">
            <p className="pb-empty">Prezentacja nie ma jeszcze sceny. Scena to jeden ekran — moduły stoją na niej tam, gdzie je postawisz.</p>
            <div className="wk-actions">
              <button type="button" className="wk-btn" disabled={busy} onClick={() => addScene(false)}>Dodaj pierwszą scenę</button>
              {parts.length > 0 && (
                <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
                  onClick={() => {
                    /* Wie die Slajdy: jeder Baustein eine Szene für sich, in der Mitte. */
                    const made = parts.map((part) => blankScene(sceneKey(), pieceLabelOf(part)));
                    setShow({ ...show, scenes: made });
                    onChange(parts.map((part, i) => {
                      const piece = freshPiece(part.kind, made[i].key, { x: 50, y: 50 });
                      return { ...part, layout: withPiece(part.layout, { ...piece, skin: 'card', type: 'auto', places: { [made[i].key]: { ...piece.places[made[i].key], w: 64 } } }) };
                    }));
                  }}>
                  Każdy moduł jako osobna scena
                </button>
              )}
            </div>
          </div>
        )}

        <ol className="pe-scenes">
          {scenes.map((sc, i) => (
            <li key={sc.key} className={i === index ? 'is-on' : ''}>
              <button type="button" className="pe-scene" onClick={() => { setSceneAt(i); setStep(0); setSelected(null); }}>
                <span className="pe-num">{i + 1}</span>
                <span className="pe-scene-name">
                  <strong>{sc.label || `Scena ${i + 1}`}</strong>
                  <span>
                    {i === 0 ? 'początek' : SCENE_CHANGE_LABEL[sc.change].split(' — ')[0].toLowerCase()}{sc.steps > 1 ? ` · ${sc.steps} kroków` : ''}
                    {sc.next !== null ? ` · dalej: ${targetLabel(show, sc.next, 'następna')}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        {scenes.length > 0 && (
          <div className="wk-actions pe-scene-tools">
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => addScene(false)}>+ Nowa scena</button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => addScene(true)}>+ Kopia tej sceny</button>
            <button type="button" className="wk-link-btn" disabled={busy || index === 0} onClick={() => moveScene(-1)}>↑</button>
            <button type="button" className="wk-link-btn" disabled={busy || index === scenes.length - 1} onClick={() => moveScene(1)}>↓</button>
            <button type="button" className="wk-link-btn se-drop" disabled={busy} onClick={dropScene}>Usuń scenę</button>
          </div>
        )}

        {scene !== undefined && (
          <details className="wk-fold pe-scene-fold" open>
            <summary>Scena „{scene.label || index + 1}"</summary>
            <SceneSettings key={scene.key} scene={scene} show={show} first={index === 0} next={scenes[index + 1]} path={path} theme={theme}
              need={stepsNeeded(scene.key, parts.map((p) => readPiece(p.layout)))} busy={busy} onChange={setScene} />
          </details>
        )}

        {scene !== undefined && (
          <>
            <h4 className="pb-h">Na tej scenie ({here.length})</h4>
            <ol className="pe-pieces">
              {here.map((part) => {
                const piece = readPiece(part.layout);
                const place = piece.places[scene.key];
                const moving = Object.keys(piece.places).length > 1 || piece.hold;
                return (
                  <li key={part.id} className={part.id === selected ? 'is-on' : ''}>
                    <button type="button" onClick={() => setSelected(part.id === selected ? null : part.id)}>
                      <strong>{pieceLabelOf(part)}</strong>
                      <span>
                        {partLabel(part.kind)}
                        {place.step !== null ? ` · krok ${place.step + 1}` : ''}
                        {moving ? ' · wędruje' : ''}
                        {place.z !== 0 ? ' · w głębi' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="pe-arrange">
              <span className="wk-hint">Ułóż wszystkie moduły tej sceny{show.format === 'screen' ? ' (od razu też na wąskim ekranie)' : ''}:</span>
              <div className="wk-actions">
                {ARRANGEMENTS.map((kind) => (
                  <button key={kind} type="button" className="wk-link-btn" disabled={busy || here.length === 0} onClick={() => arrangeAll(kind)}>
                    {ARRANGEMENT_LABEL[kind]}
                  </button>
                ))}
              </div>
              <div className="wk-actions">
                <button type="button" className="wk-link-btn" disabled={busy || here.length === 0} onClick={() => stepsInOrder(true)}>Kroki po kolei</button>
                <button type="button" className="wk-link-btn" disabled={busy || here.length === 0} onClick={() => stepsInOrder(false)}>Bez kroków</button>
              </div>
            </div>

            <div className="pe-add">
              <span className="pb-h">Dodaj na scenę</span>
              <div className="pb-palette">
                {[...PARTS.filter((one) => ['text', 'image', 'shape'].includes(one.kind)), ...PARTS.filter((one) => !['text', 'image', 'shape'].includes(one.kind))].map((one) => (
                  <button key={one.kind} type="button" className="pb-pill" title={one.use} disabled={busy} onClick={() => add(one.kind)}>
                    <span className="pb-pill-name">+ {one.label}</span>
                    <span className="pb-pill-use">{one.use}</span>
                  </button>
                ))}
              </div>
              {elsewhere.length > 0 && (
                <details className="wk-fold">
                  <summary>Moduły tej strony, których tu nie ma ({elsewhere.length})</summary>
                  <ul className="pe-elsewhere">
                    {elsewhere.map((part) => (
                      <li key={part.id}>
                        <span>{pieceLabelOf(part)} <span className="wk-hint">· {partLabel(part.kind)}{Object.keys(readPiece(part.layout).places).length === 0 ? ' · poza prezentacją' : ''}</span></span>
                        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => placeHere(part)}>Postaw tutaj</button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </>
        )}

        {chosen !== null && scene !== undefined && chosenPlace !== null && (
          <PieceSettings
            key={chosen.id}
            part={chosen}
            show={show}
            scene={scene}
            scenes={scenes}
            tall={tall}
            path={path}
            busy={busy}
            onPiece={(piece) => {
              const nextParts = parts.map((p) => (p.id === chosen.id ? { ...p, layout: withPiece(p.layout, piece) } : p));
              withSteps(nextParts);
              if (piece.places[scene.key] === undefined) setSelected(null);
            }}
            onPart={replacePart}
            onPlace={(patch) => commitPlace(chosen, patchPlace(chosenPlace, patch))}
            onDelete={() => {
              if (!window.confirm(`Usunąć moduł „${pieceLabelOf(chosen)}" ze strony?`)) return;
              onChange(parts.filter((p) => p.id !== chosen.id));
              setSelected(null);
            }}
            onOpenModule={(moduleId) => {
              const next = parts.map((p) => (p.id === chosen.id ? { ...p, moduleId } : p));
              onChange(next);
              onOpenModule(moduleId, next);
            }}
          />
        )}
      </div>

      <div className="pe-main">
        <div className="pe-bar">
          <button type="button" className="wk-link-btn" disabled={index === 0} onClick={() => { setSceneAt(index - 1); setStep(0); }}>◀</button>
          <span className="pe-bar-scene">{scene === undefined ? '—' : `${index + 1}. ${scene.label || 'Scena'}`}</span>
          <button type="button" className="wk-link-btn" disabled={index >= scenes.length - 1} onClick={() => { setSceneAt(index + 1); setStep(0); }}>▶</button>
          {scene !== undefined && scene.steps > 1 && !playing && (
            <span className="pe-steps" role="group" aria-label="Krok sceny">
              {Array.from({ length: scene.steps }, (_, n) => (
                <button key={n} type="button" className={n === step ? 'is-on' : ''} onClick={() => setStep(n)}>{n + 1}</button>
              ))}
            </span>
          )}
          {show.format === 'screen' && (
            <span className="wk-seg pe-format" role="group" aria-label="Ekran">
              <button type="button" className={!tallView ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={!tallView} onClick={() => setTallView(false)}>Szeroki</button>
              <button type="button" className={tallView ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={tallView} onClick={() => setTallView(true)}>Wąski (telefon)</button>
            </span>
          )}
          <span className="wk-seg" role="group" aria-label="Widok">
            <button type="button" className={!playing && !mapping ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={!playing && !mapping} onClick={() => { setPlaying(false); setMapping(false); }}>Układanie</button>
            <button type="button" className={playing ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={playing} onClick={() => { setPlaying(true); setMapping(false); setSelected(null); }}>Podgląd</button>
            <button type="button" className={mapping ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={mapping} onClick={() => { setMapping(true); setPlaying(false); setSelected(null); }}>Przejścia</button>
          </span>
          <button type="button" className="wk-btn wk-btn-quiet pe-present" disabled={scenes.length === 0} onClick={() => {
            if (scene === undefined) return;
            /* 0089 — auf dem Weg zu dieser Szene: von der ersten dorthin, dann „dalej". */
            const route = routeTo(show, parts.map((p) => readPiece(p.layout)), scene.key);
            const along = zonesOf(route.map((key) => scenes.find((sc) => sc.key === key)?.steps ?? 1));
            const here = Math.max(0, route.indexOf(scene.key));
            /* Der Vortrag läuft aus der Leinwand — aus der Karte heraus geht es dorthin zurück. */
            setMapping(false);
            setPresent({ at: (along[here]?.at ?? 0) + Math.min(step, scene.steps - 1), route });
          }}
            title="Na pełnym ekranie: strzałki, spacja albo kliknięcie — dalej; Esc — koniec">
            Pokaz
          </button>
        </div>

        {mapping ? (
          <PathsEditor
            show={show}
            parts={parts}
            busy={busy}
            onShow={setShow}
            onParts={onChange}
            onOpenScene={(i) => { setSceneAt(i); setStep(0); setMapping(false); }}
          />
        ) : (<>
        <p className="wk-hint pe-main-hint">
          {playing
            ? 'Podgląd — przewijaj w ramce (kółko, palec, strzałki po kliknięciu w ramkę). Tak zobaczy to gość, bez zapisywania.'
            : 'Kliknij moduł, żeby go wybrać; przeciągnij ramkę, żeby go przesunąć; uchwyty zmieniają szerokość i wysokość. Strzałki przesuwają (z Shift — dalej), Alt wyłącza przyciąganie.'}
        </p>

        <div className={`pe-canvas${tall ? ' is-tall' : ''}`} ref={canvas} tabIndex={0} onKeyDown={nudge}
          onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <PagePresentation
            key={playing ? 'play' : 'edit'}
            parts={shown}
            look={look}
            title={title}
            mode="box"
            frozen={playing ? null : at}
            boxAspect={aspect}
            selected={playing ? null : selected}
            onPick={playing ? undefined : (key) => setSelected(key === '' ? null : key)}
            onStage={setStageEl}
            control={control}
            presentAt={present?.at ?? null}
            presentRoute={present?.route ?? null}
            onPresentEnd={() => setPresent(null)}
            virtual={virtual}
          />
          {frame !== null && !playing && (
            <div className="pe-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height } as CSSProperties}
              onPointerDown={(e) => startDrag(e, 'move')}>
              <span className="pe-grip is-w" onPointerDown={(e) => startDrag(e, 'w')} title="Szerokość" />
              {chosenPlace?.h !== null && chosenPlace !== null && effective(chosenPlace).h !== null && (
                <>
                  <span className="pe-grip is-h" onPointerDown={(e) => startDrag(e, 'h')} title="Wysokość" />
                  <span className="pe-grip is-wh" onPointerDown={(e) => startDrag(e, 'wh')} title="Szerokość i wysokość" />
                </>
              )}
            </div>
          )}
          {guides.x !== null && stageEl !== null && canvas.current !== null && (
            <span className="pe-guide is-x" style={{
              left: stageEl.getBoundingClientRect().left - canvas.current.getBoundingClientRect().left + (guides.x / 100) * stageEl.clientWidth,
              top: stageEl.getBoundingClientRect().top - canvas.current.getBoundingClientRect().top, height: stageEl.clientHeight
            }} />
          )}
          {guides.y !== null && stageEl !== null && canvas.current !== null && (
            <span className="pe-guide is-y" style={{
              top: stageEl.getBoundingClientRect().top - canvas.current.getBoundingClientRect().top + (guides.y / 100) * stageEl.clientHeight,
              left: stageEl.getBoundingClientRect().left - canvas.current.getBoundingClientRect().left, width: stageEl.clientWidth
            }} />
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}

/* -- Die ganze Präsentation -------------------------------------------------------------- */

function ShowSettings({ look, show, busy, onLook, onShow }: {
  look: Look; show: Show; busy: boolean; onLook: (next: Look) => void; onShow: (next: Show) => void;
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

function SceneSettings({ scene, show, first, next, path, theme, need, busy, onChange }: {
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

function PieceSettings({ part, show, scene, scenes, tall, path, busy, onPiece, onPart, onPlace, onDelete, onOpenModule }: {
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

export default PresentationEditor;
