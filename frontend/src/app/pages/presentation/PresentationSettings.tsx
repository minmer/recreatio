/**
 * Die Einstellungen am Rand des Präsentations-Editors: das Ganze, eine Szene, ein Baustein.
 */

import { useEffect, useState } from 'react';

import { rich, texts, useT } from '../../core/i18n';
import { MotionField } from '../motion/MotionField';
import type { DraftPart } from '../page';
import { PartSettings } from '../PageBuilder';
import { ImagePicker, MediaPicker } from '../PageFiles';
import { partSize } from '../part';
import { withLang } from '../layout';
import { partLabel } from '../parts/registry';
import { COLOR_KEYS, type SlideColors } from '../slides/slides';
import { DEFAULT_THEMES, type Look, resolveTheme } from '../slides/slideLook';
import { ColorField, ThemeEditor } from '../slides/SlideSettings';
import { LayerEditor } from '../slides/LayerEditor';
import { pieceLabelOf } from './PagePresentation';
import {
  ALIGNS, ARRIVALS, ARRIVAL_LABEL, type Align, DEPTH, EASES, EASE_LABEL, FONT_LABEL, FONT_PAIRS, FORMATS, FORMAT_LABEL, framesJson, MASK, type Mask,
  MASK_SHAPES, MEDIA, type Media, NAVS, NAV_LABEL, ORIGINS, ORIGIN_LABEL, type Piece, type Place, PROGRESS, readCrop, readFrames, SCENE_CHANGES,
  SCENE_CHANGE_LABEL, SKINS, SKIN_LABEL, type Scene, type Show, TEXT_TYPES, TEXT_TYPE_LABEL, THREADS, THREAD_LABEL, WORDS, placeFor, readPiece
} from './presentation';
import { END, EVERY, goOptions, targetLabel, targetOptions, withGo, withNext } from './showPaths';

const FULL = partSize({ colSpan: 6, rowSpan: 5 });

const ALIGN_LABEL: Record<Align, string> = texts({ start: 'pagePresentation.settings.align.start', center: 'pagePresentation.settings.align.center', end: 'pagePresentation.settings.align.end' });

const COLOR_LABEL: Record<(typeof COLOR_KEYS)[number], string> = texts({ accent: 'pagePresentation.settings.color.accent', ink: 'pagePresentation.settings.color.ink', ground: 'pagePresentation.settings.color.ground', muted: 'pagePresentation.settings.color.muted' });

/* 2026-10-19 — Maske, Fortschritt. */
const MASK_LABEL: Record<Mask['shape'], string> = texts({ circle: 'pagePresentation.settings.mask.circle', ellipse: 'pagePresentation.settings.mask.ellipse', inset: 'pagePresentation.settings.mask.inset' });
const PROGRESS_LABEL: Record<Place['by'], string> = texts({
  scene: 'pagePresentation.settings.progress.scene',
  enter: 'pagePresentation.settings.progress.enter',
  leave: 'pagePresentation.settings.progress.leave'
});

/* -- Die ganze Präsentation -------------------------------------------------------------- */

export function ShowSettings({ look, show, path, theme, busy, onLook, onShow }: {
  look: Look; show: Show; path: string; theme: ReturnType<typeof resolveTheme>; busy: boolean; onLook: (next: Look) => void; onShow: (next: Show) => void;
}) {
  const t = useT();
  const night = look.theme?.night ?? null;
  return (
    <details className="wk-fold pe-show">
      <summary>{t('pagePresentation.settings.showTitle')}</summary>
      <label className="wk-field">
        <span>{t('pagePresentation.settings.format')}</span>
        <select value={show.format} disabled={busy} onChange={(e) => onShow({ ...show, format: e.target.value as Show['format'] })}>
          {FORMATS.map((one) => <option key={one} value={one}>{FORMAT_LABEL[one]}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>{t('pagePresentation.settings.fonts')}</span>
        <select value={show.fonts} disabled={busy} onChange={(e) => onShow({ ...show, fonts: e.target.value as Show['fonts'] })}>
          {FONT_PAIRS.map((one) => <option key={one} value={one}>{FONT_LABEL[one]}</option>)}
        </select>
      </label>
      <label className="wk-field">
        <span>{t('pagePresentation.settings.nav')}</span>
        <select value={show.nav} disabled={busy} onChange={(e) => onShow({ ...show, nav: e.target.value as Show['nav'] })}>
          {NAVS.map((one) => <option key={one} value={one}>{NAV_LABEL[one]}</option>)}
        </select>
      </label>
      {/* 0108 — die Bühne höchstens so breit, und das Tuch hinter allen Szenen. */}
      <label className="wk-field">
        <span>{t('pagePresentation.settings.width')}</span>
        <input type="number" min={20} max={240} value={show.width ?? ''} placeholder={t('pagePresentation.settings.wholeWindow')} disabled={busy}
          onChange={(e) => onShow({ ...show, width: e.target.value.trim() === '' ? null : Math.min(240, Math.max(20, Number(e.target.value))) })} />
        <span className="wk-hint">{t('pagePresentation.settings.widthHint')}</span>
      </label>
      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.backdrop')}{show.backdrop.length > 0 ? ` (${show.backdrop.length})` : ''}</summary>
        <p className="wk-hint">
          {t('pagePresentation.settings.backdropHint')}
        </p>
        <LayerEditor path={path} theme={theme} label="" layers={show.backdrop} busy={busy} blank onChange={(backdrop) => onShow({ ...show, backdrop })} />
      </details>
      {/* 2026-10-19 — der Klang der Umgebung: nur auf Wunsch des Gastes, so laut, wie jede Szene sagt. */}
      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.sound')}{show.sound !== null ? ` — ${show.sound.label || t('pagePresentation.settings.soundOn')}` : ''}</summary>
        <MediaPicker path={path} kind="audio" value={show.sound?.url ?? ''} busy={busy}
          onPick={(url) => onShow({ ...show, sound: { url, label: show.sound?.label ?? '', volume: show.sound?.volume ?? 0.6 } })} />
        {show.sound !== null && (
          <>
            <label className="se-inline" title={t('pagePresentation.settings.soundHint')}>
              <span>{t('pagePresentation.settings.buttonText')}</span>
              <input value={show.sound.label} disabled={busy} maxLength={60} placeholder={t('pagePresentation.settings.soundPlaceholder')}
                onChange={(e) => onShow({ ...show, sound: { ...show.sound!, label: e.target.value } })} />
            </label>
            <Num label={t('pagePresentation.settings.volume')} value={show.sound.volume} min={0} max={1} step={0.05} busy={busy}
              onChange={(volume) => onShow({ ...show, sound: { ...show.sound!, volume } })} hint={t('pagePresentation.settings.volumeHint')} />
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onShow({ ...show, sound: null })}>{t('pagePresentation.settings.noSound')}</button>
          </>
        )}
      </details>
      <ThemeEditor look={look} busy={busy} onChange={onLook} legend={t('pagePresentation.settings.colors')} />
      {look.theme !== null && (
        <div className="pe-night">
          <label className="wk-check">
            <input type="checkbox" checked={night !== null} disabled={busy}
              onChange={(e) => {
                if (look.theme === null) return;
                const { mode: _m, night: _n, ...palette } = DEFAULT_THEMES.dark;
                onLook({ ...look, theme: { ...look.theme, mode: 'light', night: e.target.checked ? palette : null } });
              }} />
            <span>{t('pagePresentation.settings.night')}</span>
          </label>
          {night !== null && look.theme !== null && (
            <div className="se-colors">
              {(['accent', 'ink', 'ground', 'muted'] as const).map((key) => (
                <ColorField key={key} label={t('pagePresentation.settings.nightColor', { name: COLOR_LABEL[key] })} value={night[key]} busy={busy}
                  onChange={(v) => onLook({ ...look, theme: { ...look.theme!, night: { ...night, [key]: v } } })} />
              ))}
            </div>
          )}
        </div>
      )}
      <p className="wk-hint">
        {rich(t('pagePresentation.settings.colorHint'), { code: (s) => <code>{s}</code> })}
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
  const t = useT();
  const colors: SlideColors = scene.colors ?? { accent: null, ink: null, ground: null, muted: null };
  const setColor = (key: (typeof COLOR_KEYS)[number], value: string) => {
    const c: SlideColors = { ...colors, [key]: value.trim() === '' ? null : value };
    onChange({ ...scene, colors: COLOR_KEYS.some((k) => c[k] !== null) ? c : null });
  };
  const flown = next?.change === 'fly';

  return (
    <div className="pe-scene-settings">
      <label className="wk-field">
        <span>{t('pagePresentation.settings.sceneName')}</span>
        <input value={scene.label} disabled={busy} maxLength={80} onChange={(e) => onChange({ ...scene, label: e.target.value })} />
      </label>

      <label className="wk-field">
        <span>{t('pagePresentation.settings.change')}</span>
        <select value={scene.change} disabled={busy}
          onChange={(e) => {
            const change = e.target.value as Scene['change'];
            const duration = scene.duration === (scene.change === 'fly' ? 1700 : 700) ? (change === 'fly' ? 1700 : 700) : scene.duration;
            onChange({ ...scene, change, duration });
          }}>
          {SCENE_CHANGES.map((one) => <option key={one} value={one}>{SCENE_CHANGE_LABEL[one]}</option>)}
        </select>
        {first && <span className="wk-hint">{t('pagePresentation.settings.firstScene')}</span>}
      </label>
      {!first && (scene.change === 'fade' || scene.change === 'build' || scene.change === 'rise') && (
        <label className="wk-check">
          <input type="checkbox" checked={scene.keep} disabled={busy} onChange={(e) => onChange({ ...scene, keep: e.target.checked })} />
          <span>{t('pagePresentation.settings.keep')}</span>
        </label>
      )}
      <Num label={t('pagePresentation.settings.jumpTime')} value={scene.duration} min={0} max={4000} step={50} busy={busy} onChange={(duration) => onChange({ ...scene, duration })}
        hint={t('pagePresentation.settings.jumpHint')} />

      <Num label={t('pagePresentation.settings.steps')} value={scene.steps} min={need} max={50} step={1} busy={busy} onChange={(steps) => onChange({ ...scene, steps: Math.max(need, Math.round(steps)) })}
        hint={t('pagePresentation.settings.stepsHint')} />

      {/* 0089 — wohin „dalej" führt: die nächste der Liste, eine andere Szene, das Ende oder hinaus. */}
      <label className="wk-field">
        <span>{t('pagePresentation.settings.nextLeads')}</span>
        <select value={scene.next ?? ''} disabled={busy} onChange={(e) => onChange(withNext(scene, e.target.value === '' ? null : e.target.value))}>
          <option value="">{t('pagePresentation.map.nextInList', { target: next === undefined ? t('pagePresentation.settings.end') : next.label || t('pagePresentation.paths.scene') })}</option>
          {targetOptions(show).filter((o) => o.value !== scene.key).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="wk-hint">{t('pagePresentation.settings.branches')}</span>
      </label>
      <label className="wk-check">
        <input type="checkbox" checked={scene.emphasis} disabled={busy} onChange={(e) => onChange({ ...scene, emphasis: e.target.checked })} />
        <span>{t('pagePresentation.settings.emphasis')}</span>
      </label>
      <label className="se-inline">
        <span>{t('pagePresentation.settings.thread')}</span>
        <select value={scene.thread} disabled={busy} onChange={(e) => onChange({ ...scene, thread: e.target.value as Scene['thread'] })}>
          {THREADS.map((one) => <option key={one} value={one}>{THREAD_LABEL[one]}</option>)}
        </select>
      </label>
      <Num label={t('pagePresentation.settings.followWide')} value={scene.follow.wide} min={0} max={1} step={0.05} busy={busy}
        onChange={(wide) => onChange({ ...scene, follow: { ...scene.follow, wide } })} />
      <Num label={t('pagePresentation.settings.followTall')} value={scene.follow.tall} min={0} max={1} step={0.05} busy={busy}
        onChange={(t) => onChange({ ...scene, follow: { ...scene.follow, tall: t } })} />

      <label className="wk-check">
        <input type="checkbox" checked={scene.grow !== null} disabled={busy}
          onChange={(e) => onChange({ ...scene, grow: e.target.checked ? { from: 0.8, to: 1.08 } : null })} />
        <span>{t('pagePresentation.settings.grow')}</span>
      </label>
      {scene.grow !== null && (
        <>
          <Num label={t('pagePresentation.settings.atStart')} value={scene.grow.from} min={0.3} max={2} step={0.01} busy={busy} onChange={(from) => onChange({ ...scene, grow: { ...scene.grow!, from } })} />
          <Num label={t('pagePresentation.settings.atEnd')} value={scene.grow.to} min={0.3} max={2} step={0.01} busy={busy} onChange={(to) => onChange({ ...scene, grow: { ...scene.grow!, to } })} />
        </>
      )}

      {show.sound !== null && (
        <Num label={t('pagePresentation.settings.sceneVolume')} value={scene.volume ?? 1} min={0} max={1} step={0.05} busy={busy}
          onChange={(volume) => onChange({ ...scene, volume: volume >= 1 ? null : volume })}
          hint={t('pagePresentation.settings.sceneVolumeHint')} />
      )}

      <label className="wk-field">
        <span>{t('pagePresentation.settings.hintBelow')}</span>
        <input value={scene.hint} disabled={busy} maxLength={60} onChange={(e) => onChange({ ...scene, hint: e.target.value })} />
      </label>

      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.sceneColors')}{scene.colors !== null ? t('pagePresentation.settings.own') : ''}</summary>
        <div className="se-colors">
          <span className="wk-hint">{t('pagePresentation.settings.colorsEmpty')}</span>
          {COLOR_KEYS.map((key) => (
            <ColorField key={key} label={COLOR_LABEL[key]} value={colors[key] ?? ''} busy={busy} allowEmpty onChange={(v) => setColor(key, v)} />
          ))}
        </div>
      </details>

      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.color.ground')}{scene.layers.length > 0 ? ` (${scene.layers.length})` : ''}</summary>
        {scene.layers.length === 0 ? (
          <div className="wk-actions">
            <button type="button" className="wk-link-btn" disabled={busy}
              onClick={() => onChange({ ...scene, layers: [{ kind: 'gradient', speed: 0, angle: 168, from: theme.ground, via: null, to: theme.ground }] })}>
              {t('pagePresentation.settings.addLayer')}
            </button>
          </div>
        ) : (
          <LayerEditor path={path} theme={theme} label={scene.label} layers={scene.layers} busy={busy} onChange={(layers) => onChange({ ...scene, layers })} />
        )}
      </details>

      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.depth')}{scene.words !== null ? t('pagePresentation.settings.isSet') : ''}</summary>
        <p className="wk-hint">
          {t('pagePresentation.settings.depthHint')}
          {flown ? t('pagePresentation.settings.flown') : ''}
        </p>
        <Num label={t('pagePresentation.settings.perspective')} value={scene.depth.perspective} min={300} max={3000} step={50} busy={busy}
          onChange={(perspective) => onChange({ ...scene, depth: { ...scene.depth, perspective } })} />
        <Num label={t('pagePresentation.settings.travel')} value={scene.depth.travel} min={0} max={6000} step={50} busy={busy}
          onChange={(travel) => onChange({ ...scene, depth: { ...scene.depth, travel } })} />
        <label className="wk-check">
          <input type="checkbox" checked={scene.depth.linger} disabled={busy} onChange={(e) => onChange({ ...scene, depth: { ...scene.depth, linger: e.target.checked } })} />
          <span>{t('pagePresentation.settings.linger')}</span>
        </label>
        {scene.depth.perspective !== DEPTH.perspective || scene.depth.travel !== DEPTH.travel ? (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onChange({ ...scene, depth: DEPTH })}>{t('pagePresentation.settings.defaultDepth')}</button>
        ) : null}

        <label className="wk-field">
          <span>{t('pagePresentation.settings.words')}</span>
          <textarea rows={4} value={(scene.words?.list ?? []).join('\n')} disabled={busy}
            onChange={(e) => {
              const list = e.target.value.split('\n').map((w) => w.trim()).filter((w) => w !== '');
              onChange({ ...scene, words: list.length === 0 ? null : { ...(scene.words ?? WORDS), list } });
            }} />
        </label>
        {scene.words !== null && (
          <>
            <label className="se-inline">
              <span>{t('pagePresentation.settings.prefix')}</span>
              <input value={scene.words.prefix} disabled={busy} maxLength={12} placeholder={t('pagePresentation.settings.prefixPlaceholder')}
                onChange={(e) => onChange({ ...scene, words: { ...scene.words!, prefix: e.target.value } })} />
            </label>
            <Num label={t('pagePresentation.settings.wordCount')} value={scene.words.count} min={1} max={120} step={1} busy={busy}
              onChange={(count) => onChange({ ...scene, words: { ...scene.words!, count } })} />
            <Num label={t('pagePresentation.settings.seed')} value={scene.words.seed} min={0} max={9999} step={1} busy={busy}
              onChange={(seed) => onChange({ ...scene, words: { ...scene.words!, seed } })} />
            <ColorField label={t('pagePresentation.settings.wordColor')} value={scene.words.color ?? ''} busy={busy} allowEmpty
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
  const t = useT();
  const piece = readPiece(part.layout);
  const place = piece.places[scene.key];
  const e = placeFor(place, tall);
  const media: Media | null = piece.media;
  const setMedia = (patch: Partial<Media> | null) =>
    onPiece({ ...piece, media: patch === null ? null : { ...(media ?? MEDIA), ...patch } });
  /* 2026-10-19 — welcher Schlüssel den Knopf auf dieser Szene trägt: ihr eigener, sonst „*". */
  const goKey = piece.go[scene.key] !== undefined ? scene.key : piece.go[EVERY] !== undefined ? EVERY : null;
  const goLabel = (target: string) => {
    if (target === 'step') return t('pagePresentation.settings.ownStep');
    const step = /^step:(\d+)$/.exec(target);
    return step !== null ? t('pagePresentation.settings.stepN', { n: Number(step[1]) + 1 }) : targetLabel(show, target, t('pagePresentation.settings.nowhere'));
  };
  const framed = part.kind === 'image' || media !== null;

  return (
    <section className="pe-piece">
      <h4 className="pb-h">
        {pieceLabelOf(part)} <span className="wk-hint">· {partLabel(part.kind)}</span>
      </h4>

      <details className="wk-fold" open>
        <summary>{t('pagePresentation.settings.content')}</summary>
        <PartSettings
          part={part}
          size={FULL}
          busy={busy}
          path={path}
          onSet={(patch) => onPart({ ...part, config: { ...part.config, ...patch } })}
          onPickModule={(moduleId) => onPart({ ...part, moduleId })}
          onLang={(lang) => onPart({ ...part, layout: withLang(part.layout, lang) })}
          onMadeModule={onOpenModule}
        />
      </details>

      {/* 0089 — ein Knopf: auf dieser Szene ein Ausgang, mit eigenem Ziel; 2026-10-19 — oder auf jeder seiner Szenen („*"), oder zu einem Schritt. */}
      <details className="wk-fold pe-go" open={goKey !== null}>
        <summary>{t('pagePresentation.settings.button')}{goKey !== null ? ` → ${goLabel(piece.go[goKey])}${goKey === EVERY ? t('pagePresentation.settings.everyScene') : ''}` : ''}</summary>
        <label className="wk-check">
          <input type="checkbox" checked={goKey !== null} disabled={busy}
            onChange={(ev) => onPiece(withGo(piece, goKey ?? scene.key, ev.target.checked ? '' : undefined))} />
          <span>{t('pagePresentation.settings.isButton')}</span>
        </label>
        {goKey !== null && (
          <>
            <label className="wk-field">
              <span>{t('pagePresentation.settings.leadsTo')}</span>
              <select value={piece.go[goKey]} disabled={busy} onChange={(ev) => onPiece(withGo(piece, goKey, ev.target.value))}>
                <option value="">{t('pagePresentation.map.nowhereYet')}</option>
                {goOptions(show, scene.steps).filter((o) => o.value !== scene.key || o.value === END).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="wk-hint">{t('pagePresentation.settings.linksOutside')}</span>
            </label>
            <label className="wk-check" title={t('pagePresentation.settings.everyHint')}>
              <input type="checkbox" checked={goKey === EVERY} disabled={busy}
                onChange={(ev) => {
                  const target = piece.go[goKey];
                  const moved = withGo(piece, goKey, undefined);
                  onPiece(withGo(moved, ev.target.checked ? EVERY : scene.key, target));
                }} />
              <span>{t('pagePresentation.settings.sameTarget')}</span>
            </label>
          </>
        )}
      </details>

      <details className="wk-fold" open>
        <summary>{t('pagePresentation.settings.place')}{tall ? t('pagePresentation.settings.narrowScreen') : ''}</summary>
        {tall && (
          <p className="wk-hint">
            {place.tall === null ? t('pagePresentation.settings.tallSame') : t('pagePresentation.settings.tallOwn')}
            {place.tall !== null && (
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onPiece({ ...piece, places: { ...piece.places, [scene.key]: { ...place, tall: null } } })}>
                {t('pagePresentation.settings.likeWide')}
              </button>
            )}
          </p>
        )}
        <Num label="x %" value={e.x} min={-50} max={150} step={0.5} busy={busy} onChange={(x) => onPlace({ x })} />
        <Num label="y %" value={e.y} min={-50} max={150} step={0.5} busy={busy} onChange={(y) => onPlace({ y })} />
        <Num label={t('pagePresentation.settings.widthPct')} value={e.w} min={1} max={200} step={0.5} busy={busy} onChange={(w) => onPlace({ w })} />
        <label className="wk-check">
          <input type="checkbox" checked={e.max !== null} disabled={busy} onChange={(ev) => onPlace({ max: ev.target.checked ? 22 : null })} />
          <span>{t('pagePresentation.settings.maxWidth')}</span>
        </label>
        {e.max !== null && <Num label={t('pagePresentation.settings.maxRem')} value={e.max} min={1} max={120} step={0.5} busy={busy} onChange={(max) => onPlace({ max })} />}
        <label className="wk-check">
          <input type="checkbox" checked={e.h !== null} disabled={busy} onChange={(ev) => onPlace({ h: ev.target.checked ? 30 : null })} />
          <span>{t('pagePresentation.settings.fixedHeight')}</span>
        </label>
        {e.h !== null && <Num label={t('pagePresentation.settings.heightPct')} value={e.h} min={1} max={200} step={0.5} busy={busy} onChange={(h) => onPlace({ h })} />}
        <Num label={t('pagePresentation.settings.scale')} value={e.scale} min={0} max={30} step={0.01} busy={busy} onChange={(scale) => onPlace({ scale })} />
        <Num label={t('pagePresentation.settings.rotate')} value={e.rotate} min={-180} max={180} step={1} busy={busy} onChange={(rotate) => onPlace({ rotate })} />
        <Num label={t('pagePresentation.settings.opacity')} value={place.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => onPlace({ opacity })} />
        <Num label={t('pagePresentation.settings.z')} value={place.z} min={-3000} max={500} step={10} busy={busy} onChange={(z) => onPlace({ z })}
          hint={t('pagePresentation.settings.zHint')} />
        <label className="se-inline">
          <span>{t('pagePresentation.settings.step')}</span>
          <select value={place.step ?? ''} disabled={busy} onChange={(ev) => onPlace({ step: ev.target.value === '' ? null : Number(ev.target.value) })}>
            <option value="">{t('pagePresentation.settings.noStep')}</option>
            {Array.from({ length: Math.max(scene.steps + 1, (place.step ?? 0) + 1) }, (_, n) => <option key={n} value={n}>{n + 1}</option>)}
          </select>
        </label>
        {framed && <CropField value={e.crop} busy={busy} onChange={(crop) => onPlace({ crop })} />}
        <MaskField mask={e.mask} busy={busy} onChange={(mask) => onPlace({ mask })} />
      </details>

      <FramesField place={place} at={e} steps={scene.steps} busy={busy} onPlace={onPlace} />

      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.look')}</summary>
        <label className="se-inline">
          <span>{t('pagePresentation.settings.skin')}</span>
          <select value={piece.skin} disabled={busy} onChange={(ev) => onPiece({ ...piece, skin: ev.target.value as Piece['skin'] })}>
            {SKINS.map((one) => <option key={one} value={one}>{SKIN_LABEL[one]}</option>)}
          </select>
        </label>
        {part.kind === 'text' && (
          <label className="se-inline">
            <span>{t('pagePresentation.settings.textAs')}</span>
            <select value={piece.type} disabled={busy} onChange={(ev) => onPiece({ ...piece, type: ev.target.value as Piece['type'] })}>
              {TEXT_TYPES.map((one) => <option key={one} value={one}>{TEXT_TYPE_LABEL[one]}</option>)}
            </select>
          </label>
        )}
        <ColorField label={t('pagePresentation.settings.fill')} value={piece.fill ?? ''} busy={busy} allowEmpty onChange={(v) => onPiece({ ...piece, fill: v.trim() === '' ? null : v })} />
        <ColorField label={t('pagePresentation.settings.ink')} value={piece.ink ?? ''} busy={busy} allowEmpty onChange={(v) => onPiece({ ...piece, ink: v.trim() === '' ? null : v })} />
        <ColorField label={t('pagePresentation.settings.accent')} value={piece.accent ?? ''} busy={busy} allowEmpty onChange={(v) => onPiece({ ...piece, accent: v.trim() === '' ? null : v })} />
        <label className="se-inline">
          <span>{t('pagePresentation.settings.origin')}</span>
          <select value={piece.origin} disabled={busy} onChange={(ev) => onPiece({ ...piece, origin: ev.target.value as Piece['origin'] })}>
            {ORIGINS.map((one) => <option key={one} value={one}>{ORIGIN_LABEL[one]}</option>)}
          </select>
        </label>
        <label className="se-inline">
          <span>{t('pagePresentation.settings.alignLabel')}</span>
          <select value={piece.align} disabled={busy} onChange={(ev) => onPiece({ ...piece, align: ev.target.value as Align })}>
            {ALIGNS.map((one) => <option key={one} value={one}>{ALIGN_LABEL[one]}</option>)}
          </select>
        </label>
        <label className="se-inline">
          <span>{t('pagePresentation.settings.valign')}</span>
          <select value={piece.valign} disabled={busy} onChange={(ev) => onPiece({ ...piece, valign: ev.target.value as Align })}>
            {ALIGNS.map((one) => <option key={one} value={one}>{ALIGN_LABEL[one]}</option>)}
          </select>
        </label>

        <fieldset className="pe-media">
          <legend>{t('pagePresentation.settings.media')} {media === null ? '' : <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setMedia(null)}>{t('pagePresentation.settings.removeMedia')}</button>}</legend>
          <ImagePicker path={path} value={media?.url ?? ''} busy={busy} onPick={(url) => setMedia({ url })} />
          <label className="se-inline">
            <span>{t('pagePresentation.map.address')}</span>
            <input value={media?.url ?? ''} disabled={busy} placeholder={t('pagePresentation.settings.mediaPlaceholder')}
              onChange={(ev) => (ev.target.value.trim() === '' ? setMedia(null) : setMedia({ url: ev.target.value }))} />
          </label>
          {media !== null && (
            <>
              <label className="se-inline">
                <span>{t('pagePresentation.settings.where')}</span>
                <select value={media.side} disabled={busy} onChange={(ev) => setMedia({ side: ev.target.value as Media['side'] })}>
                  <option value="after">{t('pagePresentation.settings.below')}</option>
                  <option value="before">{t('pagePresentation.settings.above')}</option>
                  <option value="behind">{t('pagePresentation.settings.behind')}</option>
                </select>
              </label>
              <label className="se-inline">
                <span>{t('pagePresentation.settings.fit')}</span>
                <select value={media.fit} disabled={busy} onChange={(ev) => setMedia({ fit: ev.target.value as Media['fit'] })}>
                  <option value="cover">{t('pagePresentation.settings.cover')}</option>
                  <option value="contain">{t('pagePresentation.settings.contain')}</option>
                </select>
              </label>
              {media.fit === 'contain' && <Num label={t('pagePresentation.settings.size')} value={media.size} min={5} max={100} step={1} busy={busy} onChange={(size) => setMedia({ size })} />}
              {media.fit === 'contain' && (
                <label className="wk-check">
                  <input type="checkbox" checked={media.max !== null} disabled={busy} onChange={(ev) => setMedia({ max: ev.target.checked ? 13 : null })} />
                  <span>{t('pagePresentation.settings.maxWidthShort')}</span>
                </label>
              )}
              {media.fit === 'contain' && media.max !== null && <Num label={t('pagePresentation.settings.maxRem')} value={media.max} min={1} max={80} step={0.5} busy={busy} onChange={(max) => setMedia({ max })} />}
              <label className="se-inline">
                <span>{t('pagePresentation.settings.center')}</span>
                <input value={media.at} disabled={busy} maxLength={40} placeholder={'center, 57% 50%'} onChange={(ev) => setMedia({ at: ev.target.value })} />
              </label>
              <Num label={t('pagePresentation.settings.opacity')} value={media.opacity} min={0} max={1} step={0.05} busy={busy} onChange={(opacity) => setMedia({ opacity })} />
              <label className="wk-check">
                <input type="checkbox" checked={media.fade} disabled={busy} onChange={(ev) => setMedia({ fade: ev.target.checked })} />
                <span>{t('pagePresentation.settings.fade')}</span>
              </label>
            </>
          )}
        </fieldset>
      </details>

      {/* 0108 — Bewegungen nach der Uhr: ein Auftritt, wenn die Szene erreicht ist, eine Schleife, solange er zu sehen ist. */}
      <details className="wk-fold" open={piece.motion.length > 0}>
        <summary>{t('pageMotion.field.motion')}{piece.motion.length > 0 ? ` (${piece.motion.length})` : ''}</summary>
        <p className="wk-hint">{t('pagePresentation.settings.motionHint')}</p>
        <MotionField value={piece.motion} busy={busy} onChange={(motion) => onPiece({ ...piece, motion })} />
      </details>

      <details className="wk-fold">
        <summary>{t('pagePresentation.settings.arrive')}</summary>
        <label className="se-inline">
          <span>{t('pagePresentation.settings.how')}</span>
          <select value={piece.arrive} disabled={busy} onChange={(ev) => onPiece({ ...piece, arrive: ev.target.value as Piece['arrive'] })}>
            {ARRIVALS.map((one) => <option key={one} value={one}>{ARRIVAL_LABEL[one]}</option>)}
          </select>
        </label>
        <Num label={t('pagePresentation.settings.delay')} value={piece.delay} min={0} max={0.95} step={0.01} busy={busy} onChange={(delay) => onPiece({ ...piece, delay })}
          hint={t('pagePresentation.settings.delayHint')} />
        <Num label={t('pagePresentation.settings.span')} value={piece.span} min={0.05} max={1} step={0.01} busy={busy} onChange={(span) => onPiece({ ...piece, span })}
          hint={t('pagePresentation.settings.spanHint')} />
      </details>

      <details className="wk-fold" open={Object.keys(piece.places).length > 1 || piece.hold}>
        <summary>{t('pagePresentation.settings.travelTitle')}</summary>
        <p className="wk-hint">{t('pagePresentation.settings.travelHint')}</p>
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
                  <span>{i + 1}. {sc.label || t('pagePresentation.paths.scene')}{sc.key === scene.key ? t('pagePresentation.settings.thisOne') : ''}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <label className="se-inline">
          <span>{t('pageMotion.field.motion')}</span>
          <select value={piece.ease} disabled={busy} onChange={(ev) => onPiece({ ...piece, ease: ev.target.value as Piece['ease'] })}>
            {EASES.map((one) => <option key={one} value={one}>{EASE_LABEL[one]}</option>)}
          </select>
        </label>
        <label className="wk-check">
          <input type="checkbox" checked={piece.hold} disabled={busy} onChange={(ev) => onPiece({ ...piece, hold: ev.target.checked })} />
          <span>{t('pagePresentation.settings.hold')}</span>
        </label>
        {Object.keys(piece.places).length > 1 && (
          <label className="se-inline" title={t('pagePresentation.settings.betweenHint')}>
            <span>{t('pagePresentation.settings.between')}</span>
            <select value={piece.between} disabled={busy} onChange={(ev) => onPiece({ ...piece, between: ev.target.value as Piece['between'] })}>
              <option value="glide">{t('pagePresentation.settings.glide')}</option>
              <option value="leave">{t('pagePresentation.settings.leave')}</option>
            </select>
          </label>
        )}
        <Num label={t('pagePresentation.settings.layer')} value={piece.layer} min={-10} max={20} step={1} busy={busy} onChange={(layer) => onPiece({ ...piece, layer })}
          hint={t('pagePresentation.settings.layerHint')} />
      </details>

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => { const { [scene.key]: _gone, ...places } = piece.places; onPiece({ ...piece, places }); }}>
          {t('pagePresentation.settings.takeOff')}
        </button>
        <button type="button" className="wk-link-btn se-drop" disabled={busy} onClick={onDelete}>{t('pagePresentation.settings.removeModule')}</button>
      </div>
    </section>
  );
}

/* -- 2026-10-19: Ausschnitt, Maske, Klatki --------------------------------------------- */

/** Wo der Ausschnitt eines Bildes sitzt — getippt, gilt beim Verlassen des Feldes (halbe Eingaben sind keine Punkte). */
function CropField({ value, busy, onChange }: { value: string | null; busy: boolean; onChange: (crop: string | null) => void }) {
  const t = useT();
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  const bad = text.trim() !== '' && readCrop(text) === null;
  const commit = () => { if (!bad) onChange(text.trim() === '' ? null : readCrop(text)); };
  return (
    <label className="se-inline" title={t('pagePresentation.settings.cropHint')}>
      <span>{t('pagePresentation.settings.cropPoint')}{bad ? t('pagePresentation.settings.cropBad') : ''}</span>
      <input value={text} disabled={busy} maxLength={30} placeholder={t('pagePresentation.settings.asInPicture')} aria-invalid={bad}
        onChange={(ev) => setText(ev.target.value)} onBlur={commit} onKeyDown={(ev) => { if (ev.key === 'Enter') commit(); }} />
    </label>
  );
}

/** Was vom Baustein zu sehen ist: Kreis, Oval, Rechteck mit Rundung — oder alles. */
function MaskField({ mask, busy, onChange }: { mask: Mask | null; busy: boolean; onChange: (mask: Mask | null) => void }) {
  const t = useT();
  const set = (patch: Partial<Mask>) => onChange({ ...(mask ?? MASK), ...patch });
  return (
    <>
      <label className="se-inline">
        <span>{t('pagePresentation.settings.maskLabel')}</span>
        <select value={mask?.shape ?? ''} disabled={busy} onChange={(ev) => (ev.target.value === '' ? onChange(null) : set({ shape: ev.target.value as Mask['shape'] }))}>
          <option value="">{t('pagePresentation.settings.wholeModule')}</option>
          {MASK_SHAPES.map((one) => <option key={one} value={one}>{MASK_LABEL[one]}</option>)}
        </select>
      </label>
      {mask?.shape === 'circle' && (
        <Num label={t('pagePresentation.settings.radius')} value={mask.r} min={0} max={150} step={1} busy={busy} onChange={(r) => set({ r })} hint={t('pagePresentation.settings.radiusHint')} />
      )}
      {mask?.shape === 'ellipse' && (
        <>
          <Num label={t('pagePresentation.settings.ovalW')} value={mask.rx} min={0} max={300} step={1} busy={busy} onChange={(rx) => set({ rx })} />
          <Num label={t('pagePresentation.settings.ovalH')} value={mask.ry} min={0} max={300} step={1} busy={busy} onChange={(ry) => set({ ry })} />
        </>
      )}
      {(mask?.shape === 'circle' || mask?.shape === 'ellipse') && (
        <>
          <Num label={t('pagePresentation.settings.centerX')} value={mask.x} min={-100} max={200} step={1} busy={busy} onChange={(x) => set({ x })} />
          <Num label={t('pagePresentation.settings.centerY')} value={mask.y} min={-100} max={200} step={1} busy={busy} onChange={(y) => set({ y })} />
        </>
      )}
      {mask?.shape === 'inset' && (
        <>
          <Num label={t('pagePresentation.settings.insetTop')} value={mask.top} min={0} max={100} step={1} busy={busy} onChange={(top) => set({ top })} />
          <Num label={t('pagePresentation.settings.insetRight')} value={mask.right} min={0} max={100} step={1} busy={busy} onChange={(right) => set({ right })} />
          <Num label={t('pagePresentation.settings.insetBottom')} value={mask.bottom} min={0} max={100} step={1} busy={busy} onChange={(bottom) => set({ bottom })} />
          <Num label={t('pagePresentation.settings.insetLeft')} value={mask.left} min={0} max={100} step={1} busy={busy} onChange={(left) => set({ left })} />
          <Num label={t('pagePresentation.settings.corners')} value={mask.round} min={0} max={20} step={0.1} busy={busy} onChange={(round) => set({ round })} />
        </>
      )}
    </>
  );
}

const framesText = (place: Place) => (place.frames.length === 0 ? '' : JSON.stringify(framesJson(place.frames), null, 1));

/**
 * KLATKI: wie sich der Baustein mit dem Fortschritt der Szene ändert — als
 * JSON (dieselbe Liste wie im Import). Ein Knopf legt eine Klatka mit dem
 * Platz an, wie er jetzt ist: ein Anfang zum Abändern.
 */
function FramesField({ place, at, steps, busy, onPlace }: {
  place: Place; at: Place; steps: number; busy: boolean; onPlace: (patch: Partial<Place>) => void;
}) {
  const t = useT();
  const [text, setText] = useState(() => framesText(place));
  const [error, setError] = useState(false);
  const said = JSON.stringify(framesJson(place.frames));
  /* Von aussen geändert (ein anderer Baustein, ein Import): neu zeigen — die eigene Eingabe bleibt, wie sie getippt ist. */
  useEffect(() => {
    let same = false;
    try { same = JSON.stringify(framesJson(readFrames(text.trim() === '' ? [] : JSON.parse(text)))) === said; } catch { same = false; }
    if (!same) { setText(framesText(place)); setError(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said]);

  const type = (value: string) => {
    setText(value);
    try {
      const list: unknown = value.trim() === '' ? [] : JSON.parse(value);
      if (!Array.isArray(list)) throw new Error('not a list');
      setError(false);
      onPlace({ frames: readFrames(list) });
    } catch {
      setError(true);
    }
  };
  const here = () => {
    const frame = { at: 1, x: at.x, y: at.y, w: at.w, ...(at.h === null ? {} : { h: at.h }), scale: at.scale, opacity: at.opacity };
    onPlace({ frames: readFrames([...framesJson(place.frames), frame]) });
  };

  return (
    <details className="wk-fold" open={place.frames.length > 0}>
      <summary>{t('pagePresentation.settings.frames')}{place.frames.length > 0 ? ` (${place.frames.length})` : ''}</summary>
      <label className="se-inline" title={t('pagePresentation.settings.progressHint')}>
        <span>{t('pagePresentation.settings.progressLabel')}</span>
        <select value={place.by} disabled={busy} onChange={(ev) => onPlace({ by: ev.target.value as Place['by'] })}>
          {PROGRESS.map((one) => <option key={one} value={one}>{PROGRESS_LABEL[one]}</option>)}
        </select>
      </label>
      {place.by === 'scene' && steps < 2 && place.frames.length > 0 && <p className="wk-error">{t('pagePresentation.settings.oneStep')}</p>}
      <label className="wk-field" title={t('pagePresentation.settings.framesHint')}>
        <span>{t('pagePresentation.settings.framesJson')}{error ? t('pagePresentation.settings.notFrames') : ''}</span>
        <textarea rows={Math.min(12, Math.max(3, text.split('\n').length))} value={text} disabled={busy} spellCheck={false} aria-invalid={error}
          placeholder='[{ "at": 1, "x": 30, "w": 42, "h": 70 }]' onChange={(ev) => type(ev.target.value)} />
      </label>
      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={busy} onClick={here}>{t('pagePresentation.settings.frameHere')}</button>
        {place.frames.length > 0 && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onPlace({ frames: [] })}>{t('pagePresentation.settings.noFrames')}</button>}
      </div>
      <label className="se-inline" title={t('pagePresentation.settings.stillHint')}>
        <span>{t('pagePresentation.settings.still')}</span>
        <input type="number" min={0} max={1} step={0.05} value={place.still ?? ''} placeholder={t('pagePresentation.settings.stillPlaceholder')} disabled={busy}
          onChange={(ev) => onPlace({ still: ev.target.value.trim() === '' ? null : Math.min(1, Math.max(0, Number(ev.target.value))) })} />
      </label>
    </details>
  );
}
