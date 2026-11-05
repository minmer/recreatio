/**
 * LABOR 2D (v2) — DIE LEISTE UNTEN (seit 2026-10-24): die Zeit. Links Start
 * oder Pause, ein Schritt, das Tempo und die Uhr; in der Mitte, was man sieht
 * (Einblendung, Schreiber); rechts Od nowa, Upiecz… und — wenn es einen gibt
 * — der Nachweis dieser Szene. Beim Backen steht hier der Fortschritt, bei der
 * Wiedergabe die Leiste der Wiedergabe (ClipControls.tsx).
 */

import { useT } from '../../../core/i18n';
import { Icon } from '../../../ui/icons';
import type { ClipInfo } from '../clip/clip';
import { num, type TextKey } from '../i18n';
import { OVERLAYS, type Overlay } from '../render/frame';
import type { Phase } from './TopBar';

const OVERLAY_LABEL: Readonly<Record<Overlay, TextKey>> = {
  none: 'ovNone', temperature: 'ovTemperature', pressure: 'ovPressure', velocity: 'ovVelocity', humidity: 'ovHumidity', vapour: 'ovVapour', salt: 'ovSalt', phase: 'ovPhase'
};

export function TimeBar({ phase, paused, time, speed, onPlay, onStep, onSpeed, onRestart, overlay, onOverlay, chartsOn, onCharts, canBake, accel, onBake, clip, onPlayClip, lagging, onLower }: {
  phase: Phase;
  paused: boolean;
  /** Simulationszeit (s). */
  time: number;
  speed: number;
  onPlay: () => void;
  onStep: () => void;
  onSpeed: () => void;
  onRestart: () => void;
  overlay: Overlay;
  onOverlay: (o: Overlay) => void;
  chartsOn: boolean;
  onCharts: () => void;
  /** Backen geht; accel: im beschleunigten Weg — Backen und Nagranie wechseln erst in den normalen (seit 2026-10-25). */
  canBake: boolean;
  accel: boolean;
  onBake: () => void;
  clip: ClipInfo | null;
  onPlayClip: () => void;
  /** Der Rechner kommt nicht nach: das Tempo (sonst null); onLower: eine gröbere Stufe (undefined: es gibt keine). */
  lagging: number | null;
  onLower?: () => void;
}) {
  const t = useT();
  const playLabel = !paused ? t('lab2d.pause') : phase === 'prepare' ? t('lab2d.run') : t('lab2d.resume');
  return (
    <footer className="l2d-time">
      <div className="l2d-time-run">
        <button type="button" className={`l2d-play${paused ? '' : ' is-running'}`} onClick={onPlay} aria-label={playLabel} title={`${playLabel} (␣)`}>
          <Icon name={paused ? 'play' : 'pause'} /><span>{playLabel}</span>
        </button>
        <button type="button" className="l2d-icon" disabled={!paused} onClick={onStep} aria-label={t('lab2d.step')} title={t('lab2d.step')}><Icon name="next" /></button>
        <button type="button" className="l2d-btn is-quiet l2d-speed" onClick={onSpeed} aria-label={`${t('lab2d.speed')} ${speed}×`} title={t('lab2d.speed')}>{num(speed, speed < 1 ? 2 : 0)}×</button>
        <output className="l2d-clock" aria-label={t('lab2d.simTime')}>{num(time, time < 100 ? 2 : 1)} s</output>
        {lagging !== null && (
          onLower !== undefined
            ? <button type="button" className="l2d-lag" onClick={onLower} title={t('lab2d.slow', { x: num(lagging, 2) })}><Icon name="alert" />{num(lagging, 2)}× · {t('lab2d.slowLower')}</button>
            : <span className="l2d-lag" title={t('lab2d.slowLowest')}><Icon name="alert" />{num(lagging, 2)}×</span>
        )}
      </div>
      <div className="l2d-time-view">
        <label className="l2d-select" title={t('lab2d.overlay')}>
          <Icon name="layers" />
          <select value={overlay} aria-label={t('lab2d.overlay')} onChange={(e) => onOverlay(e.currentTarget.value as Overlay)}>
            {OVERLAYS.map((o) => <option key={o} value={o}>{t(`lab2d.${OVERLAY_LABEL[o]}`)}</option>)}
          </select>
        </label>
        <button type="button" className={`l2d-icon${chartsOn ? ' is-on' : ''}`} onClick={onCharts} aria-pressed={chartsOn} aria-label={t('lab2d.charts')} title={t('lab2d.charts')}><Icon name="table" /></button>
      </div>
      <div className="l2d-time-end">
        {phase !== 'prepare' && <button type="button" className="l2d-btn is-quiet" onClick={onRestart} title={t('lab2d.restartTitle')}><Icon name="undo" /><span>{t('lab2d.restart')}</span></button>}
        {clip !== null && <button type="button" className="l2d-btn is-quiet" onClick={onPlayClip} title={t(`lab2d.${accel ? 'clipPlayAccel' : 'clipPlay'}`)}><Icon name="play" /><span>{t('lab2d.clipShort', { s: num(clip.duration, 0) })}</span></button>}
        <button type="button" className="l2d-btn" disabled={!canBake} onClick={onBake} title={!canBake ? t('lab2d.clipAccel') : t(`lab2d.${accel ? 'bakeTitleAccel' : 'bakeTitle'}`)}><Icon name="clock" /><span>{t('lab2d.bakeOpen')}</span></button>
      </div>
    </footer>
  );
}
