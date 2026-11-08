import { TexText } from '../ui/tex/Tex';
import type { Words } from './lang';
import type { PathNext } from './PathMap';

/** Keep continuing, optional reading, prerequisites and completed paths distinct. */
export function StoryNextChoices({ choices, W, reviewOpen, onReview, onRestart }: {
  readonly choices: readonly PathNext[];
  readonly W: Words;
  readonly reviewOpen: boolean;
  readonly onReview: () => void;
  readonly onRestart: () => void;
}) {
  const available = choices.filter((x) => x.ready && x.state !== 'done' && x.action !== undefined);
  const onward = available.filter((x) => !x.optional && x.kind !== 'map');
  const optional = available.filter((x) => x.optional);
  const navigation = available.filter((x) => x.kind === 'map');
  const waiting = choices.filter((x) => !x.ready && x.state !== 'done');
  const completed = choices.filter((x) => x.state === 'done');
  const first = onward[0] ?? optional[0];
  const card = (x: PathNext) => (
    <li key={x.id}>
      <button type="button" className={`wk-btn cg-flow-next-card${x === first && !reviewOpen ? ' cg-run-next' : ' wk-btn-line'}${x.state === 'done' ? ' is-done' : ''}`}
        onClick={x.action?.run} disabled={x.action === undefined}
        {...(x === first ? { 'data-flow-next-go': x.id } : { 'data-flow-next-other': x.id })} data-flow-next-kind={x.kind} data-flow-next-state={x.state ?? 'new'}>
        <span className="cg-flow-next-copy">
          <span className="cg-flow-next-title"><TexText text={x.label} /></span>
          {x.work && <span className="cg-flow-next-work">{x.work}</span>}
          {x.note && <span className="cg-flow-next-note">{x.note}</span>}
          {x.state === 'started' && <span className="cg-flow-next-note">{W.detourStarted}</span>}
        </span>
        <span className="cg-flow-next-action">{x.state === 'done' ? W.detourRemind : x.state === 'started' ? W.nextContinue : x.action?.label}<span aria-hidden> →</span></span>
      </button>
    </li>
  );
  return (
    <div className="cg-flow-next" data-flow-next={choices.length}>
      {(choices.length > 0 || reviewOpen) && <div className="cg-flow-next-intro">
        <h3 className="cg-run-closing-h">{W.whatNext}</h3>
        {onward.length + optional.length > 0 && <p className="cg-muted">{W.nextChoose}</p>}
      </div>}
      {reviewOpen && <button type="button" className="wk-btn" onClick={onReview} data-flow-review-again="">{W.reviewAgain}</button>}
      {onward.length > 0 && <section className="cg-flow-next-group" data-flow-next-group="available">
        <h4>{W.nextAvailable}</h4>
        <ul className="cg-flow-next-list">{onward.map(card)}</ul>
      </section>}
      {optional.length > 0 && <section className="cg-flow-next-group" data-flow-next-group="optional">
        <h4>{W.nextOptional}</h4>
        <p className="cg-muted">{W.nextOptionalHint}</p>
        <ul className="cg-flow-next-list">{optional.map(card)}</ul>
      </section>}
      {waiting.length > 0 && <section className="cg-flow-next-group" data-flow-next-group="locked">
        <h4>{W.nextLocked}</h4>
        <p className="cg-muted">{W.nextLockedHint}</p>
        <ul className="cg-flow-next-wait" data-flow-next-wait={waiting.length}>
          {waiting.map((x) => <li key={x.id} data-flow-next-wait-item={x.id}>
            <strong><TexText text={x.label} /></strong>
            {x.work && <span className="cg-flow-next-work">{x.work}</span>}
            {(x.why ?? []).map((why) => <span className="cg-flow-next-requirement" key={why}>{why}</span>)}
            <div className="wk-actions">
              {x.action !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={x.action.run} data-flow-next-route={x.id}>{x.action.label}<span aria-hidden> →</span></button>}
              {x.goalAction !== undefined && <button type="button" className="wk-btn" onClick={x.goalAction.run} title={W.nextGoalHint} data-flow-next-goal={x.id}>{x.goalAction.label}</button>}
            </div>
          </li>)}
        </ul>
      </section>}
      {completed.length > 0 && <details className="cg-flow-next-group cg-flow-next-completed" data-flow-next-group="done">
        <summary><span aria-hidden>✓ </span>{W.nextCompleted} <span className="cg-muted">({completed.length})</span></summary>
        <p className="cg-muted">{W.nextCompletedHint}</p>
        <ul className="cg-flow-next-list">{completed.map(card)}</ul>
      </details>}
      <div className="cg-flow-next-footer">
        {navigation.map((x) => <button key={x.id} type="button" className="wk-btn wk-btn-line" onClick={x.action!.run} data-flow-next-other={x.id}>{x.label}</button>)}
        <button type="button" className="wk-link-btn" onClick={onRestart} data-flow-restart-end="">{W.fromStart}</button>
      </div>
    </div>
  );
}
