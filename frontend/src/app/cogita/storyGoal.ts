import type { Card } from './cardBasics';
import type { Flow } from './flow';
import type { Learner } from './learn';
import { cardsAbout } from './prerequisites';
import { storyRoute, type StoryRouteStep } from './storyLock';
import type { CogitaLibrary } from './store';
import { readView } from './views';

export type StoryGoalStep =
  | { readonly id: string; readonly kind: 'story'; readonly story: Flow }
  | { readonly id: string; readonly kind: 'review' | 'topic'; readonly cards: readonly Card[] };

/** Start at the first unfinished, accessible step, including a review needed to unlock it. */
export function firstStoryGoalStep(route: readonly StoryRouteStep[], cards: readonly Card[], suspended: ReadonlySet<string>): StoryGoalStep | null {
  const target = route[route.length - 1]?.id;
  for (const step of route) {
    if ((step.learned && step.id !== target) || step.lock.missing.length > 0) continue;
    const active = (list: readonly Card[]) => [...new Map(list.filter((c) => !suspended.has(c.key)).map((c) => [c.key, c])).values()];
    const weak = active(step.lock.weak);
    if (weak.length > 0) return { id: step.id, kind: 'review', cards: weak };
    if (step.story !== undefined) return { id: step.id, kind: 'story', story: step.story };
    const own = active(cardsAbout(cards, step.id));
    if (own.length > 0) return { id: step.id, kind: 'topic', cards: own };
  }
  return null;
}

/** Save the destination and its ordered route using the landscape's existing goal format. */
export async function keepStoryGoal(lib: CogitaLibrary, cards: readonly Card[], learner: Learner, target: string): Promise<StoryGoalStep | null> {
  const route = storyRoute(lib, cards, learner, target);
  if (firstStoryGoalStep(route, cards, learner.progress.suspended) === null) return null;
  const views = lib.docs('view').filter((d) => readView(d.data).mode === 'landscape');
  const keys = new Set(['landscape:wpisy', ...views.map((v) => `landscape:${v.id}`), ...[...learner.progress.positions.keys()].filter((key) => key.startsWith('landscape:'))]);
  const visited = route.map((step) => step.id);
  const at = Date.now();
  for (const flow of keys) await learner.keepPosition({ flow, step: target, visited, at });
  return firstStoryGoalStep(storyRoute(lib, cards, learner, target), cards, learner.progress.suspended);
}
