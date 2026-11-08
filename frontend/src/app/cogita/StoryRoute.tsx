import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { TexText } from '../ui/tex/Tex';
import type { Card } from './cardBasics';
import type { Flow } from './flow';
import type { Words } from './lang';
import type { Learner } from './learn';
import { cardsAbout } from './prerequisites';
import { readPlan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import { storyRoute } from './storyLock';
import type { CogitaLibrary } from './store';

/** A route remains open while its prerequisites are studied; cancelling never unlocks it. */
export function StoryRoute({ target, lib, cards, learner, W, label, onClose, onOpen, renderStory }: {
  readonly target: string;
  readonly lib: CogitaLibrary;
  readonly cards: readonly Card[];
  readonly learner: Learner;
  readonly W: Words;
  readonly label: (id: string) => string;
  readonly onClose: () => void;
  readonly onOpen: (id: string, story?: Flow) => void;
  readonly renderStory: (story: Flow, back: () => void) => ReactNode;
}) {
  const [tick, setTick] = useState(0);
  const [story, setStory] = useState<Flow | null>(null);
  const [run, setRun] = useState<RunSource | null>(null);
  useEffect(() => learner.subscribe(() => setTick((n) => n + 1)), [learner]);
  const route = useMemo(() => storyRoute(lib, cards, learner, target), [target, lib, lib.revision, cards, learner, tick]);
  const name = (id: string) => route.find((x) => x.id === id)?.story?.name ?? label(id);
  const back = () => { setStory(null); setRun(null); setTick((n) => n + 1); };
  const practice = (id: string, list: readonly Card[]) => {
    const unique = [...new Map(list.filter((c) => !learner.progress.suspended.has(c.key)).map((c) => [c.key, c])).values()];
    if (unique.length === 0) return;
    setRun({ plan: readPlan(unique, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), cards, title: name(id) });
  };
  return <section className="cg-flow cg-story-route" data-story-route={target}>
    <header className="cg-story-route-head">
      <button type="button" className="wk-btn wk-btn-line" onClick={story !== null || run !== null ? back : onClose}>{W.back}</button>
      <h2><TexText text={W.nextRouteTo(name(target))} /></h2>
    </header>
    {story !== null ? renderStory(story, back) : run !== null ? <RevisionRun lib={lib} learner={learner} source={run} onClose={back} onDone={back} /> : <div className="cg-flow-step">
      <p className="cg-muted">{W.nextRouteHint}</p>
      <ol className="cg-story-route-list">
        {route.map((step) => {
          const missing = step.lock.missing;
          const weak = step.lock.weak;
          const ready = missing.length === 0 && weak.length === 0;
          const own = cardsAbout(cards, step.id).filter((c) => !learner.progress.suspended.has(c.key));
          return <li key={step.id} data-story-route-step={step.id} className={step.id === target ? 'is-target' : ''}>
            <div className="cg-flow-next-copy">
              <strong><TexText text={name(step.id)} /></strong>
              <span className="cg-muted">{step.learned && weak.length === 0 ? `✓ ${W.nextDone}` : ready ? W.nextReady : W.nextNotYet}</span>
              {missing.length > 0 && <span>{W.needsFirst(missing.map(name).join(', '))}</span>}
              {weak.length > 0 && <span>{W.dueFirst((step.lock.due ?? []).map(name).join(', '))}</span>}
            </div>
            {missing.length === 0 && weak.length > 0 ? <button type="button" className="wk-btn wk-btn-line" onClick={() => practice(step.id, weak)} data-story-route-review={step.id}>{W.reviewFirst(weak.length)}</button>
              : ready && (step.story !== undefined || own.length > 0) ? <button type="button" className={`wk-btn${step.id === target ? '' : ' wk-btn-line'}`} data-story-route-open={step.id}
                onClick={() => { if (step.id === target) onOpen(step.id, step.story); else if (step.story !== undefined) setStory(step.story); else practice(step.id, own); }}>
                {step.learned ? W.detourRemind : step.story !== undefined ? W.startStory : W.learn}
              </button> : null}
          </li>;
        })}
      </ol>
    </div>}
  </section>;
}
