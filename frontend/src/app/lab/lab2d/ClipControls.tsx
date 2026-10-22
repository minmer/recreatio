/**
 * LABOR 2D (v2) — DIE BEDIENUNG DER NACHWEISE (B): der Anfang (das Labor
 * wartet, bis man es startet oder backt), der Fortschritt beim Backen, die
 * Leiste der Wiedergabe (wie bei einem Film: Start, Zeitleiste, Tempo,
 * Schleife, „Na żywo od tej chwili“) und der Abschnitt „Nagranie“ an der
 * Seite. Der Zustand selbst liegt im Arbeiter (clip/session.ts); hier stehen
 * nur, was er meldet, und die Knöpfe.
 */

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { Icon } from '../../ui/icons';
import { LabSection } from '../LabFrame';
import type { ClipInfo } from './clip/clip';
import type { ClipStats, WorkerMessage } from './engine/protocol';
import { num, t } from './i18n';

/** Wie lange gebacken werden kann (Sekunden Simulationszeit). */
export const BAKE_SECONDS: readonly number[] = [10, 30, 60, 120, 300];

export type BakeProgress = Omit<Extract<WorkerMessage, { type: 'bake' }>, 'type'>;

/** Klicks auf die Bedienung über der Bühne malen nicht in die Kiste. */
const keep = (e: ReactPointerEvent): void => e.stopPropagation();

function SecondsPicker({ value, onChange, disabled }: { value: number; onChange: (s: number) => void; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} aria-label={t('bakeFor')} title={t('bakeFor')} onChange={(e) => onChange(Number(e.currentTarget.value))}>
      {BAKE_SECONDS.map((s) => <option key={s} value={s}>{s} s</option>)}
    </select>
  );
}

/** Der Anfang: nichts rechnet, bis man startet, backt oder ein Nachweis abspielt. */
export function StartPanel({ clip, seconds, onSeconds, onLive, onBake, onPlay, canBake }: {
  clip: ClipInfo | null;
  seconds: number;
  onSeconds: (s: number) => void;
  onLive: () => void;
  onBake: () => void;
  onPlay: () => void;
  canBake: boolean;
}) {
  return (
    <div className="l2d-cta" onPointerDown={keep}>
      <p>{t('ctaLead')}</p>
      <div className="lab-row">
        {clip !== null && (
          <button type="button" className="lab-tool is-on" onClick={onPlay}><Icon name="play" />{t('clipPlayN').replace('{s}', num(clip.duration, 0))}</button>
        )}
        <button type="button" className={`lab-tool${clip === null ? ' is-on' : ''}`} onClick={onLive}><Icon name="play" />{t('startLive')}</button>
        {canBake && (
          <span className="l2d-bake-pick">
            <button type="button" className="lab-tool" onClick={onBake} title={t('bakeTitle')}><Icon name="clock" />{t('bake')}</button>
            <SecondsPicker value={seconds} onChange={onSeconds} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Beim Backen (und auf dem Weg zum gezeigten Bild): Fortschritt und Abbrechen. */
export function BakePanel({ progress, onStop }: { progress: BakeProgress; onStop: () => void }) {
  const share = progress.seconds > 0 ? Math.min(1, progress.t / progress.seconds) : 0;
  const label = progress.state === 'saving' ? t('bakeSaving')
    : progress.state === 'seeking' ? t('seeking').replace('{p}', num(100 * share, 0))
      : t('baking').replace('{t}', num(progress.t, 1)).replace('{s}', num(progress.seconds, 0));
  return (
    <div className="l2d-bake" onPointerDown={keep} role="status">
      <span>{label}{progress.state === 'running' && progress.rate > 0 ? ` · ${t('bakingRate').replace('{x}', num(progress.rate, 2))}` : ''}</span>
      <progress max={1} value={share} />
      {progress.state === 'running' && <button type="button" className="lab-tool" onClick={onStop} title={t('bakeStopTitle')}><Icon name="x" />{t('bakeStop')}</button>}
    </div>
  );
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

/** Die Leiste der Wiedergabe unten auf der Bühne. */
export function PlayerBar({ clip, stats, speed, onPlay, onSeek, onSpeed, onLoop, onLive, onClose }: {
  clip: ClipInfo | null;
  stats: ClipStats;
  speed: number;
  onPlay: (playing: boolean) => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
  onLoop: (on: boolean) => void;
  onLive: () => void;
  onClose: () => void;
}) {
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
  const resumable = clip?.resumable !== false;
  /* Beim Ziehen gilt die gezogene Zeit, bis der Arbeiter sie meldet (seine Zeit kommt nur fünfmal je Sekunde): sonst sprängen Regler und Uhr zurück. */
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    if (drag === null) return undefined;
    const id = window.setTimeout(() => setDrag(null), 600);
    return () => window.clearTimeout(id);
  }, [drag]);
  const shown = Math.min(drag ?? stats.t, stats.duration);
  return (
    <div className="l2d-player" onPointerDown={keep}>
      <button type="button" className="lab-tool" onClick={() => onPlay(!stats.playing)} aria-label={stats.playing ? t('clipPause') : t('clipPlay')} title={stats.playing ? t('clipPause') : t('clipPlay')}>
        <Icon name={stats.playing ? 'pause' : 'play'} />
      </button>
      <input type="range" className="l2d-timeline" min={0} max={stats.duration} step={1 / 30} value={shown}
        aria-label={t('clipTime')} onChange={(e) => { const v = Number(e.currentTarget.value); setDrag(v); onSeek(v); }} />
      <span className="l2d-clock">{num(shown, 1)} / {num(stats.duration, 1)} s</span>
      <button type="button" className="lab-tool" onClick={() => onSpeed(next)} title={t('clipSpeed')} aria-label={`${t('clipSpeed')} ${speed}×`}>{num(speed, speed < 1 ? 2 : 0)}×</button>
      <button type="button" className={`lab-tool${stats.loop ? ' is-on' : ''}`} onClick={() => onLoop(!stats.loop)} aria-pressed={stats.loop} title={t('clipLoop')}><Icon name="refresh" /></button>
      <button type="button" className="lab-tool" onClick={onLive} disabled={!resumable} title={resumable ? t('clipLiveTitle') : t('clipEngine')}><Icon name="next" /><span className="l2d-label">{t('clipLive')}</span></button>
      <button type="button" className="lab-tool" onClick={onClose} aria-label={t('clipClose')} title={t('clipClose')}><Icon name="x" /></button>
    </div>
  );
}

/** Der Abschnitt „Nagranie“ an der Seite: backen (mit Länge), abspielen, löschen; was gespeichert ist. */
export function ClipSection({ clip, seconds, onSeconds, onBake, onPlay, onDelete, busy, accel }: {
  clip: ClipInfo | null;
  seconds: number;
  onSeconds: (s: number) => void;
  onBake: () => void;
  onPlay: () => void;
  onDelete: () => void;
  busy: boolean;
  accel: boolean;
}) {
  return (
    <LabSection title={t('clipSection')} open={clip !== null}>
      {accel ? <p className="lab-muted">{t('clipAccel')}</p> : (
        <>
          <p className="lab-muted">{t('bakeTitle')}</p>
          <div className="lab-row">
            <button type="button" className="lab-tool" disabled={busy} onClick={onBake}><Icon name="clock" />{t('bake')}</button>
            <SecondsPicker value={seconds} onChange={onSeconds} disabled={busy} />
          </div>
          {clip === null ? <p className="lab-muted">{t('clipNone')}</p> : (
            <>
              <p className="lab-muted">{t('clipInfo').replace('{s}', num(clip.duration, 1)).replace('{mb}', num(clip.bytes / 1e6, 1)).replace('{date}', new Date(clip.created).toLocaleString())}</p>
              {!clip.resumable && <p className="lab-muted">{t('clipOld')}</p>}
              <div className="lab-row">
                <button type="button" className="lab-tool" disabled={busy} onClick={onPlay}><Icon name="play" />{t('clipPlay')}</button>
                <button type="button" className="lab-tool" disabled={busy} onClick={onDelete}><Icon name="trash" />{t('clipDelete')}</button>
              </div>
            </>
          )}
          <p className="lab-muted">{t('clipStore')}</p>
        </>
      )}
    </LabSection>
  );
}
