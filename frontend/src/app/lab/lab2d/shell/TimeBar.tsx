/**
 * LABOR 2D (v2) — DIE LEISTE UNTEN (seit 2026-10-24): die Zeit. Links Start
 * oder Pause, ein Schritt, das Tempo und die Uhr; in der Mitte, was man sieht
 * (Einblendung, Schreiber); rechts Od nowa, Upiecz… und — wenn es einen gibt
 * — der Nachweis dieser Szene. Beim Backen steht hier der Fortschritt, bei der
 * Wiedergabe die Leiste der Wiedergabe (ClipControls.tsx).
 */

import { Icon } from '../../../ui/icons';
import type { ClipInfo } from '../clip/clip';
import { num, t, type TextKey } from '../i18n';
import { OVERLAYS, type Overlay } from '../render/frame';
import type { Phase } from './TopBar';

const OVERLAY_LABEL: Readonly<Record<Overlay, TextKey>> = {
  none: 'ovNone', temperature: 'ovTemperature', pressure: 'ovPressure', velocity: 'ovVelocity', humidity: 'ovHumidity', vapour: 'ovVapour', salt: 'ovSalt', phase: 'ovPhase'
};

export function TimeBar({ phase, paused, time, speed, onPlay, onStep, onSpeed, onRestart, overlay, onOverlay, chartsOn, onCharts, canBake, onBake, clip, onPlayClip, lagging, onLower }: {
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
  /** Backen geht (nicht im beschleunigten Weg). */
  canBake: boolean;
  onBake: () => void;
  clip: ClipInfo | null;
  onPlayClip: () => void;
  /** Der Rechner kommt nicht nach: das Tempo (sonst null); onLower: eine gröbere Stufe (undefined: es gibt keine). */
  lagging: number | null;
  onLower?: () => void;
}) {
  const playLabel = !paused ? t('pause') : phase === 'prepare' ? t('run') : t('resume');
  return (
    <footer className="l2d-time">
      <div className="l2d-time-run">
        <button type="button" className={`l2d-play${paused ? '' : ' is-running'}`} onClick={onPlay} aria-label={playLabel} title={`${playLabel} (␣)`}>
          <Icon name={paused ? 'play' : 'pause'} /><span>{playLabel}</span>
        </button>
        <button type="button" className="l2d-icon" disabled={!paused} onClick={onStep} aria-label={t('step')} title={t('step')}><Icon name="next" /></button>
        <button type="button" className="l2d-btn is-quiet l2d-speed" onClick={onSpeed} aria-label={`${t('speed')} ${speed}×`} title={t('speed')}>{num(speed, speed < 1 ? 2 : 0)}×</button>
        <output className="l2d-clock" aria-label={t('simTime')}>{num(time, time < 100 ? 2 : 1)} s</output>
        {lagging !== null && (
          onLower !== undefined
            ? <button type="button" className="l2d-lag" onClick={onLower} title={t('slow').replace('{x}', num(lagging, 2))}><Icon name="alert" />{num(lagging, 2)}× · {t('slowLower')}</button>
            : <span className="l2d-lag" title={t('slowLowest')}><Icon name="alert" />{num(lagging, 2)}×</span>
        )}
      </div>
      <div className="l2d-time-view">
        <label className="l2d-select" title={t('overlay')}>
          <Icon name="layers" />
          <select value={overlay} aria-label={t('overlay')} onChange={(e) => onOverlay(e.currentTarget.value as Overlay)}>
            {OVERLAYS.map((o) => <option key={o} value={o}>{t(OVERLAY_LABEL[o])}</option>)}
          </select>
        </label>
        <button type="button" className={`l2d-icon${chartsOn ? ' is-on' : ''}`} onClick={onCharts} aria-pressed={chartsOn} aria-label={t('charts')} title={t('charts')}><Icon name="table" /></button>
      </div>
      <div className="l2d-time-end">
        {phase !== 'prepare' && <button type="button" className="l2d-btn is-quiet" onClick={onRestart} title={t('restartTitle')}><Icon name="undo" /><span>{t('restart')}</span></button>}
        {clip !== null && <button type="button" className="l2d-btn is-quiet" onClick={onPlayClip} title={t('clipPlay')}><Icon name="play" /><span>{t('clipShort').replace('{s}', num(clip.duration, 0))}</span></button>}
        <button type="button" className="l2d-btn" disabled={!canBake} onClick={onBake} title={canBake ? t('bakeTitle') : t('clipAccel')}><Icon name="clock" /><span>{t('bakeOpen')}</span></button>
      </div>
    </footer>
  );
}
