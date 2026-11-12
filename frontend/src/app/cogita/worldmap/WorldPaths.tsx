/**
 * 2026-11-12 (Prompt 25) — WEGE ZU EINER FRAGE auf der Weltkarte (die Regeln: `wmPaths.ts`):
 * <code>
 *   PathList    die Fragen an einer Stelle (am Haus alle: „Czego chcesz się dowiedzieć?"), jede ein Knopf
 *   PathPanel   eine Frage: nur die eine Handlung — „Odkryj" (geführt wie „Prowadź mnie tutaj"; sind die Schritte gegangen, der
 *               Abschluss) oder, erledigt, „Powtórz" (umrandet); danach „Głębiej", wenn es einen tieferen Weg gibt
 * </code>
 * 2026-11-12 (Eigentümer: „alles steht auf der Karte, es soll nicht ausgeschrieben werden") — keine Liste der Schritte, keine Längen,
 * kein Versprechen im Feld: der gewählte Weg leuchtet auf der Karte, seine Schritte mit ihrem Stand stehen dort.
 */

import type { T } from '../../core/i18n';
import { PanelTop } from './WorldPanels';
import { pathStatus, stepsDone, type PathCtx, type PathStatus, type QPath } from './wmPaths';
import './worldmap.css';

/** Das Zeichen des Standes (auch auf dem Wegweiser): leer · halb · Haken. */
export function StatusMark({ status, t }: { status: PathStatus; t: T }) {
  return <span className={`cg-wm-qmark is-${status}`} title={t(`cogitaWorld.paths.status.${status}`)} aria-label={t(`cogitaWorld.paths.status.${status}`)} data-world-path-status={status} />;
}

/** Die Fragen an einer Stelle: jede ein ganzer Knopf — offene voll, erledigte umrandet. */
export function PathList({ paths, pctx, t, onOpen, title = null }: { paths: readonly QPath[]; pctx: PathCtx; t: T; onOpen: (id: string) => void; title?: string | null }) {
  if (paths.length === 0) return null;
  return (
    <section className="cg-wm-qlist" aria-label={title ?? t('cogitaWorld.paths.hereTitle')} data-world-path-list={paths.length}>
      {title !== null && <h4 className="cg-wm-qhead">{title}</h4>}
      <div className="cg-wm-qbtns">
        {paths.map((p) => {
          const status = pathStatus(pctx, p);
          return (
            <button key={p.id} type="button" className={status === 'done' ? 'wk-btn wk-btn-line cg-wm-qbtn' : 'wk-btn cg-wm-qbtn'} onClick={() => onOpen(p.id)}
              title={t(`cogitaWorld.paths.status.${status}`)} data-world-path-open={p.id} data-world-path-status={status}>
              {p.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PathPanel({ path, pctx, t, canLearn, onClose, onGo, onCheck, onRepeat, deeper, onOpen }: {
  path: QPath;
  pctx: PathCtx;
  t: T;
  canLearn: boolean;
  onClose: () => void;
  /** „Odkryj": geführt den Weg entlang. */
  onGo: () => void;
  /** Den Abschluss beginnen (null: kein Abschluss). */
  onCheck: (() => void) | null;
  /** Erledigt: die Karten des Weges wiederholen (null: nichts zu wiederholen). */
  onRepeat: (() => void) | null;
  /** Der tiefere Weg, wenn es ihn gibt. */
  deeper: QPath | null;
  onOpen: (id: string) => void;
}) {
  const status = pathStatus(pctx, path);
  const ready = stepsDone(pctx, path);
  return (
    <section className="cg-wm-panel cg-wm-qpanel" data-world-panel="path" data-world-path={path.id} data-world-path-state={status}>
      <PanelTop t={t} onClose={onClose} title={<><StatusMark status={status} t={t} /> {path.title}</>} />
      {canLearn && (
        <div className="wk-actions cg-wm-qactions">
          {status !== 'done' && (ready && onCheck !== null
            ? <button type="button" className="wk-btn cg-wm-go" onClick={onCheck} data-world-path-check="">{t('cogitaWorld.paths.checkNow')}</button>
            : <button type="button" className="wk-btn cg-wm-go" onClick={onGo} data-world-path-go="">{t('cogitaWorld.paths.go')}</button>)}
          {status === 'done' && onRepeat !== null && <button type="button" className="wk-btn wk-btn-line" onClick={onRepeat} data-world-path-repeat="">{t('cogitaWorld.panel.review')}</button>}
          {status === 'done' && deeper !== null && (
            <button type="button" className="wk-btn" onClick={() => onOpen(deeper.id)} data-world-path-deeper={deeper.id}>{t('cogitaWorld.paths.deeper', { name: deeper.title })}</button>
          )}
        </div>
      )}
    </section>
  );
}
