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

import { useT } from '../../core/i18n';
import { Icon } from '../../ui/icons';
import type { ClipEngine, ClipInfo } from './clip/clip';
import type { ClipStats, WorkerMessage } from './engine/protocol';
import { num } from './i18n';

export type BakeProgress = Omit<Extract<WorkerMessage, { type: 'bake' }>, 'type'>;

/** Beim Backen (und auf dem Weg zum gezeigten Bild): Fortschritt, wer rechnet, Abbrechen. */
export function BakePanel({ progress, onStop }: { progress: BakeProgress; onStop: () => void }) {
  const t = useT();
  const share = progress.seconds > 0 ? Math.min(1, progress.t / progress.seconds) : 0;
  const label = progress.state === 'saving' ? t('lab2d.bakeSaving')
    : progress.state === 'preparing' ? t('lab2d.bakePreparing')
      : progress.state === 'seeking' ? t('lab2d.seeking', { p: num(100 * share, 0) })
        : t('lab2d.baking', { t: num(progress.t, 1), s: num(progress.seconds, 0) });
  const running = progress.state === 'running';
  const by = running && progress.engine !== undefined ? ` · ${t(`lab2d.${progress.engine === 'gpu' ? 'bakeGpu' : 'bakeCpu'}`)}` : '';
  return (
    <div className="l2d-bake" role="status">
      <span>{label}{running && progress.rate > 0 ? ` · ${t('lab2d.bakingRate', { x: num(progress.rate, 2) })}` : ''}{by}</span>
      {progress.state === 'preparing' ? <progress max={1} /> : <progress max={1} value={share} />}
      {(running || progress.state === 'preparing') && <button type="button" className="l2d-btn is-quiet" onClick={onStop} title={t('lab2d.bakeStopTitle')}><Icon name="x" />{t('lab2d.bakeStop')}</button>}
    </div>
  );
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

/** Wer gebacken hat — und, wenn es den Nachweis der anderen Engine gibt, die Wahl zwischen beiden (an derselben Stelle). */
function EngineSwitch({ clip, onEngine }: { clip: ClipInfo; onEngine: (e: ClipEngine) => void }) {
  const t = useT();
  const from = t(`lab2d.${clip.engine === 'gpu' ? 'clipFromGpu' : 'clipFromCpu'}`);
  if (clip.alt === null) return <span className="l2d-engine" title={from}>{clip.engine === 'gpu' ? 'GPU' : 'CPU'}</span>;
  return (
    <div className="l2d-seg l2d-engine-seg" role="radiogroup" aria-label={from}>
      {(['cpu', 'gpu'] as const).map((e) => (
        <button key={e} type="button" role="radio" aria-checked={clip.engine === e} className={clip.engine === e ? 'is-on' : ''}
          title={clip.engine === e ? from : t(`lab2d.${e === 'gpu' ? 'clipToGpu' : 'clipToCpu'}`)} onClick={() => { if (clip.engine !== e) onEngine(e); }}>
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
  const t = useT();
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
  const resumable = clip?.resumable !== false;
  const liveTitle = !resumable ? t('lab2d.clipEngine') : clip?.exact === false ? t('lab2d.clipLiveGpuTitle') : t('lab2d.clipLiveTitle');
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
      <button type="button" className={`l2d-play${stats.playing ? ' is-running' : ''}`} onClick={() => onPlay(!stats.playing)} aria-label={stats.playing ? t('lab2d.clipPause') : t('lab2d.clipPlay')} title={stats.playing ? t('lab2d.clipPause') : t('lab2d.clipPlay')}>
        <Icon name={stats.playing ? 'pause' : 'play'} />
      </button>
      <input type="range" className="l2d-timeline" min={0} max={stats.duration} step={1 / fps} value={shown}
        aria-label={t('lab2d.clipTime')} onChange={(e) => { const v = Number(e.currentTarget.value); setDrag(v); onSeek(v); }} />
      <span className="l2d-clock">{num(shown, fps > 30 ? 2 : 1)} / {num(stats.duration, 1)} s</span>
      <button type="button" className="l2d-btn is-quiet l2d-speed" onClick={() => onSpeed(next)} title={t('lab2d.clipSpeed')} aria-label={`${t('lab2d.clipSpeed')} ${speed}×`}>{num(speed, speed < 1 ? 2 : 0)}×</button>
      <button type="button" className={`l2d-icon${stats.loop ? ' is-on' : ''}`} onClick={() => onLoop(!stats.loop)} aria-pressed={stats.loop} aria-label={t('lab2d.clipLoop')} title={t('lab2d.clipLoop')}><Icon name="refresh" /></button>
      {clip !== null && <EngineSwitch clip={clip} onEngine={onEngine} />}
      <button type="button" className="l2d-btn" onClick={onLive} disabled={!resumable} title={liveTitle}><Icon name="next" /><span className="l2d-label">{t('lab2d.clipLive')}</span></button>
      <button type="button" className="l2d-icon" onClick={onDelete} aria-label={t('lab2d.clipDelete')} title={t('lab2d.clipDelete')}><Icon name="trash" /></button>
      <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('lab2d.clipClose')} title={t('lab2d.clipClose')}><Icon name="x" /></button>
    </div>
  );
}
