/**
 * 2026-11-12 (Prompt 25) — WEGE ZU EINER FRAGE auf der Weltkarte (die Regeln: `wmPaths.ts`):
 * <code>
 *   PathList    die Fragen an einer Stelle (am Haus alle: „Czego chcesz się dowiedzieć?"), je mit ihrem Stand
 *   PathPanel   eine Frage: das Versprechen, die Schritte mit Stand (erledigt / offen / gesperrt) und „warum", die Länge,
 *               „Idź tą drogą" (geführt wie „Prowadź mnie tutaj", Bekanntes fällt weg), „Ustaw jako cel", am Ende der Abschluss
 *               und, wenn erledigt, „Głębiej"
 * </code>
 */

import type { ReactNode } from 'react';

import type { T } from '../../core/i18n';
import { PanelTop } from './WorldPanels';
import { pathLength, pathStatus, stepState, stepsDone, type PathCtx, type PathStatus, type QPath, type QStep, type StepState } from './wmPaths';
import './worldmap.css';

/** Das Zeichen des Standes (auch auf dem Wegweiser): leer · halb · Haken. */
export function StatusMark({ status, t }: { status: PathStatus; t: T }) {
  return <span className={`cg-wm-qmark is-${status}`} title={t(`cogitaWorld.paths.status.${status}`)} aria-label={t(`cogitaWorld.paths.status.${status}`)} data-world-path-status={status} />;
}

export function PathList({ paths, pctx, t, onOpen, title }: { paths: readonly QPath[]; pctx: PathCtx; t: T; onOpen: (id: string) => void; title?: string }) {
  if (paths.length === 0) return null;
  return (
    <section className="cg-wm-qlist" aria-label={title ?? t('cogitaWorld.paths.homeTitle')} data-world-path-list={paths.length}>
      <h4 className="cg-wm-qhead">{title ?? t('cogitaWorld.paths.homeTitle')}</h4>
      <ul>
        {paths.map((p) => (
          <li key={p.id}>
            <button type="button" className="cg-wm-qitem" onClick={() => onOpen(p.id)} data-world-path-open={p.id}>
              <StatusMark status={pathStatus(pctx, p)} t={t} />
              <span className="cg-wm-qtitle">{p.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const stepLabel = (step: QStep, t: T, nameOf: (id: string) => string): string =>
  step.kind === 'place'
    ? (step.level === undefined ? nameOf(step.place) : t('cogitaWorld.paths.stepLevel', { name: nameOf(step.place), level: step.level }))
    : t('cogitaWorld.paths.stepFlow', { name: nameOf(step.flow) });

export function PathPanel({ path, pctx, t, nameOf, canLearn, onClose, onGo, onShowStep, goal, onCheck, deeper, onOpen }: {
  path: QPath;
  pctx: PathCtx;
  t: T;
  nameOf: (id: string) => string;
  canLearn: boolean;
  onClose: () => void;
  /** „Idź tą drogą". */
  onGo: () => void;
  /** Ein Schritt angeklickt: die Karte zeigt ihn. */
  onShowStep: (step: QStep) => void;
  goal: { readonly isGoal: boolean; readonly set: () => void; readonly clear: () => void };
  /** Den Abschluss beginnen (null: kein Abschluss). */
  onCheck: (() => void) | null;
  /** Der tiefere Weg, wenn es ihn gibt. */
  deeper: QPath | null;
  onOpen: (id: string) => void;
}) {
  const status = pathStatus(pctx, path);
  const states: StepState[] = path.steps.map((s) => stepState(pctx, s));
  const len = pathLength(pctx.state, pctx.lines, path);
  const ready = stepsDone(pctx, path);
  const left = states.filter((s) => s !== 'done').length;
  const lengthText = [
    len.slides > 0 ? t('cogitaWorld.panel.slides', { count: len.slides }) : '',
    len.questions > 0 ? t('cogitaWorld.panel.questionsN', { count: len.questions }) : '',
    len.cards > 0 ? t('cogitaWorld.paths.cards', { count: len.cards }) : ''
  ].filter(Boolean).join(' · ');
  const checkText: ReactNode = path.check === null ? null
    : path.check.kind === 'questions' ? t('cogitaWorld.paths.checkQuestions', { count: path.check.questions.length })
      : t('cogitaWorld.paths.checkSlide');
  return (
    <section className="cg-wm-panel cg-wm-qpanel" data-world-panel="path" data-world-path={path.id} data-world-path-state={status}>
      <PanelTop t={t} onClose={onClose} title={<><StatusMark status={status} t={t} /> {path.title}</>} />
      {path.promise !== '' && <p className="cg-wm-qpromise">{path.promise}</p>}
      <p className="cg-wm-meta" data-world-path-length="">{[t(`cogitaWorld.paths.status.${status}`), lengthText].filter(Boolean).join(' · ')}</p>
      <ol className="cg-wm-qsteps">
        {path.steps.map((s, i) => (
          <li key={i} className={`cg-wm-qstep is-${states[i]}`} data-world-path-step={states[i]}>
            <button type="button" className="cg-wm-qstepbtn" onClick={() => onShowStep(s)}>
              <span className="cg-wm-qstepmark" aria-label={t(`cogitaWorld.paths.step.${states[i]}`)} title={t(`cogitaWorld.paths.step.${states[i]}`)}>{states[i] === 'done' ? '✓' : states[i] === 'open' ? '○' : '–'}</span>
              <span className="cg-wm-qsteptext">
                <strong>{stepLabel(s, t, nameOf)}</strong>
                {s.why !== undefined && <span className="cg-wm-qwhy">{s.why}</span>}
              </span>
            </button>
          </li>
        ))}
        {path.check !== null && (
          <li className={`cg-wm-qstep is-check is-${status === 'done' ? 'done' : ready ? 'open' : 'locked'}`} data-world-path-step="check">
            <span className="cg-wm-qstepbtn">
              <span className="cg-wm-qstepmark" aria-hidden="true">{status === 'done' ? '✓' : '?'}</span>
              <span className="cg-wm-qsteptext"><strong>{checkText}</strong><span className="cg-wm-qwhy">{t('cogitaWorld.paths.checkSays', { question: path.title })}</span></span>
            </span>
          </li>
        )}
      </ol>
      {canLearn && (
        <div className="wk-actions cg-wm-qactions">
          {status !== 'done' && left > 0 && <button type="button" className="wk-btn cg-wm-go" onClick={onGo} data-world-path-go="">{t('cogitaWorld.paths.go')} ▶</button>}
          {status !== 'done' && ready && onCheck !== null && <button type="button" className="wk-btn cg-wm-go" onClick={onCheck} data-world-path-check="">{t('cogitaWorld.paths.checkNow')} ▶</button>}
          {status !== 'done' && (goal.isGoal
            ? <button type="button" className="wk-link-btn" onClick={goal.clear} data-world-path-goal-clear="">{t('cogitaWorld.paths.goalClear')}</button>
            : <button type="button" className="wk-btn wk-btn-line" onClick={goal.set} data-world-path-goal="">{t('cogitaWorld.paths.goal')}</button>)}
        </div>
      )}
      {status === 'done' && <p className="wk-note" role="status" data-world-path-done="">{t('cogitaWorld.paths.done')}</p>}
      {status === 'done' && deeper !== null && (
        <button type="button" className="wk-btn wk-btn-line cg-wm-qdeeper" onClick={() => onOpen(deeper.id)} data-world-path-deeper={deeper.id}>{t('cogitaWorld.paths.deeper', { name: deeper.title })} ▶</button>
      )}
    </section>
  );
}
