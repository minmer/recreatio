/**
 * LABOR 2D (v2) — DIE LEISTE OBEN (seit 2026-10-24): der Titel (oder die Wahl
 * des Szenariusz), darunter klein die Aufgabe für die Schüler (ein Klick öffnet
 * sie ganz), in welcher Phase das Labor ist, und rechts Beschreibung,
 * Einstellungen und Schliessen.
 */

import { Icon } from '../../../ui/icons';
import { t, type TextKey } from '../i18n';

/** Vorbereiten (Zeit 0, alles lässt sich ändern), Rechnen, Backen, Wiedergabe eines Nachweises. */
export type Phase = 'prepare' | 'simulate' | 'baking' | 'clip';

const PHASE: Readonly<Record<Phase, TextKey>> = { prepare: 'phasePrepare', simulate: 'phaseSimulate', baking: 'phaseBaking', clip: 'phaseClip' };

export function TopBar({ title, task, scenarios, scenarioAt, onScenario, phase, onInfo, onSettings, onClose }: {
  title: string;
  /** Der erste Absatz der Aufgabe (leer: keine). */
  task: string;
  scenarios: readonly string[];
  scenarioAt: number;
  onScenario: (k: number) => void;
  phase: Phase;
  onInfo: () => void;
  onSettings: () => void;
  /** Nur in der eigenen Ebene über der Seite (im ganzen Fenster der Seite schliesst deren Leiste). */
  onClose?: () => void;
}) {
  return (
    <header className="l2d-top">
      <div className="l2d-top-head">
        {scenarios.length > 1 ? (
          <select className="l2d-scenario" value={scenarioAt} disabled={phase === 'baking'} aria-label={t('scenario')} onChange={(e) => onScenario(Number(e.currentTarget.value))}>
            {scenarios.map((s, k) => <option key={k} value={k}>{s || `${t('scenario')} ${k + 1}`}</option>)}
          </select>
        ) : <h2 className="l2d-title">{title}</h2>}
        {task !== '' && <button type="button" className="l2d-task" onClick={onInfo} title={t('infoOpen')}>{task}</button>}
      </div>
      <span className={`l2d-phase is-${phase}`}>{t(PHASE[phase])}</span>
      <div className="l2d-top-tools">
        <button type="button" className="l2d-icon" onClick={onInfo} aria-label={t('infoOpen')} title={t('infoOpen')}><Icon name="info" /></button>
        <button type="button" className="l2d-icon" onClick={onSettings} aria-label={t('settings')} title={t('settings')}><Icon name="settings" /></button>
        {onClose !== undefined && <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('closeLab')} title={t('closeLab')}><Icon name="x" /></button>}
      </div>
    </header>
  );
}
