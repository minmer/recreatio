/**
 * LABOR 2D (v2) — BACKEN UND WIEDERGABE IN DER LEISTE UNTEN (B; seit
 * 2026-10-24 dort statt über der Bühne): der Fortschritt beim Backen und die
 * Leiste der Wiedergabe (wie bei einem Film: Start, Zeitleiste in den Bildern
 * des Nachweises, Tempo, Schleife, „Na żywo od tej chwili“, Löschen,
 * Beenden). Der Zustand selbst liegt im Arbeiter (clip/session.ts); hier
 * stehen nur, was er meldet, und die Knöpfe. Seit 2026-10-25 sagt die Leiste,
 * wer gebacken hat (CPU oder GPU), und schaltet um, wenn es beide Nachweise
 * der Szene gibt.
 */

import { useEffect, useState } from 'react';

import { Icon } from '../../ui/icons';
import type { ClipEngine, ClipInfo } from './clip/clip';
import type { ClipStats, WorkerMessage } from './engine/protocol';
import { num, t } from './i18n';

export type BakeProgress = Omit<Extract<WorkerMessage, { type: 'bake' }>, 'type'>;

/** Beim Backen (und auf dem Weg zum gezeigten Bild): Fortschritt, wer rechnet, Abbrechen. */
export function BakePanel({ progress, onStop }: { progress: BakeProgress; onStop: () => void }) {
  const share = progress.seconds > 0 ? Math.min(1, progress.t / progress.seconds) : 0;
  const label = progress.state === 'saving' ? t('bakeSaving')
    : progress.state === 'preparing' ? t('bakePreparing')
      : progress.state === 'seeking' ? t('seeking').replace('{p}', num(100 * share, 0))
        : t('baking').replace('{t}', num(progress.t, 1)).replace('{s}', num(progress.seconds, 0));
  const running = progress.state === 'running';
  const by = running && progress.engine !== undefined ? ` · ${t(progress.engine === 'gpu' ? 'bakeGpu' : 'bakeCpu')}` : '';
  return (
    <div className="l2d-bake" role="status">
      <span>{label}{running && progress.rate > 0 ? ` · ${t('bakingRate').replace('{x}', num(progress.rate, 2))}` : ''}{by}</span>
      {progress.state === 'preparing' ? <progress max={1} /> : <progress max={1} value={share} />}
      {(running || progress.state === 'preparing') && <button type="button" className="l2d-btn is-quiet" onClick={onStop} title={t('bakeStopTitle')}><Icon name="x" />{t('bakeStop')}</button>}
    </div>
  );
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

/** Wer gebacken hat — und, wenn es den Nachweis der anderen Engine gibt, die Wahl zwischen beiden (an derselben Stelle). */
function EngineSwitch({ clip, onEngine }: { clip: ClipInfo; onEngine: (e: ClipEngine) => void }) {
  const from = t(clip.engine === 'gpu' ? 'clipFromGpu' : 'clipFromCpu');
  if (clip.alt === null) return <span className="l2d-engine" title={from}>{clip.engine === 'gpu' ? 'GPU' : 'CPU'}</span>;
  return (
    <div className="l2d-seg l2d-engine-seg" role="radiogroup" aria-label={from}>
      {(['cpu', 'gpu'] as const).map((e) => (
        <button key={e} type="button" role="radio" aria-checked={clip.engine === e} className={clip.engine === e ? 'is-on' : ''}
          title={clip.engine === e ? from : t(e === 'gpu' ? 'clipToGpu' : 'clipToCpu')} onClick={() => { if (clip.engine !== e) onEngine(e); }}>
          {e === 'gpu' ? 'GPU' : 'CPU'}
        </button>
      ))}
    </div>
  );
}

/** Die Leiste der Wiedergabe. */
export function PlayerBar({ clip, stats, speed, onPlay, onSeek, onSpeed, onLoop, onLive, onClose, onDelete, onEngine }: {
  clip: ClipInfo | null;
  stats: ClipStats;
  speed: number;
  onPlay: (playing: boolean) => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
  onLoop: (on: boolean) => void;
  onLive: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEngine: (e: ClipEngine) => void;
}) {
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
  const resumable = clip?.resumable !== false;
  const liveTitle = !resumable ? t('clipEngine') : clip?.exact === false ? t('clipLiveGpuTitle') : t('clipLiveTitle');
  /* Beim Ziehen gilt die gezogene Zeit, bis der Arbeiter sie meldet (seine Zeit kommt nur fünfmal je Sekunde): sonst sprängen Regler und Uhr zurück. */
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    if (drag === null) return undefined;
    const id = window.setTimeout(() => setDrag(null), 600);
    return () => window.clearTimeout(id);
  }, [drag]);
  const shown = Math.min(drag ?? stats.t, stats.duration);
  const fps = clip?.fps ?? 30;
  return (
    <div className="l2d-player">
      <button type="button" className={`l2d-play${stats.playing ? ' is-running' : ''}`} onClick={() => onPlay(!stats.playing)} aria-label={stats.playing ? t('clipPause') : t('clipPlay')} title={stats.playing ? t('clipPause') : t('clipPlay')}>
        <Icon name={stats.playing ? 'pause' : 'play'} />
      </button>
      <input type="range" className="l2d-timeline" min={0} max={stats.duration} step={1 / fps} value={shown}
        aria-label={t('clipTime')} onChange={(e) => { const v = Number(e.currentTarget.value); setDrag(v); onSeek(v); }} />
      <span className="l2d-clock">{num(shown, fps > 30 ? 2 : 1)} / {num(stats.duration, 1)} s</span>
      <button type="button" className="l2d-btn is-quiet l2d-speed" onClick={() => onSpeed(next)} title={t('clipSpeed')} aria-label={`${t('clipSpeed')} ${speed}×`}>{num(speed, speed < 1 ? 2 : 0)}×</button>
      <button type="button" className={`l2d-icon${stats.loop ? ' is-on' : ''}`} onClick={() => onLoop(!stats.loop)} aria-pressed={stats.loop} aria-label={t('clipLoop')} title={t('clipLoop')}><Icon name="refresh" /></button>
      {clip !== null && <EngineSwitch clip={clip} onEngine={onEngine} />}
      <button type="button" className="l2d-btn" onClick={onLive} disabled={!resumable} title={liveTitle}><Icon name="next" /><span className="l2d-label">{t('clipLive')}</span></button>
      <button type="button" className="l2d-icon" onClick={onDelete} aria-label={t('clipDelete')} title={t('clipDelete')}><Icon name="trash" /></button>
      <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('clipClose')} title={t('clipClose')}><Icon name="x" /></button>
    </div>
  );
}
