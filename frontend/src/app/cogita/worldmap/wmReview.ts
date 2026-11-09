/**
 * 2026-11-09 — WAS IN DIE WIEDERHOLUNGEN DARF, für die Stellen der Anwendung (Korrektur 5): die Stufen, die für diesen
 * Lernenden gelten (`wmRuns.ts`), und — nur wenn es Stufen gibt — welche Orte er erobert hat. Ohne Stufen ist der Bereich
 * `null` und nichts wird gerechnet (`reviewable` sagt dann immer ja, wie bisher).
 * <code>
 *   Powtórki    revision.ts (eligible, spacerFor) über RevisionRun; die Abschrift ohne Netz nimmt es beim Ablegen mit
 *   Zahlen      CogitaHome, Baustein „Powtórki", Krajobraz (dueCards), Learner.reportDue (die Erinnerung des Dienstes)
 *   Sperren     storyLock („Najpierw powtórz"), Krajobraz (reviewFirst)
 *   nicht       neue Karten, Fragen in Erzählungen, der Przegląd einer Erzählung, Üben einer Folie — das ist Lernen
 * </code>
 */

import type { Card } from '../cardBasics';
import type { CogitaLibrary } from '../store';
import { readWorld } from './wmGraph';
import { worldInputOf } from './wmInput';
import { runsOn } from './wmFeatures';
import { effectiveWorld, levelsByPlace, ownWorld, type EffectiveWorld, type LevelsSetup, type RunRecord } from './wmRuns';
import type { ReviewScope } from './wmState';
import type { World } from './wmTypes';

interface LearnerLike {
  readonly progress: { readonly values: Readonly<Record<string, number>>; readonly runs: ReadonlyMap<string, RunRecord> };
  /** Wer lernt: ohne Konto (`local`) bleiben Durchgänge im Browser; mit Konto braucht es den Dienst nach 0140. */
  readonly holder?: { readonly kind: string };
}

/**
 * Die Stufen, die für diesen Lernenden in dieser Baza gelten. 2026-11-09 (PR A) — speichert der Dienst noch keine Durchgänge
 * (`wmFeatures.ts`), gelten 0 Stufen: keine Durchgänge, keine Bögen, jede Wiederholung wie bisher (`serverOld` sagt warum).
 */
export function effectiveWorldFor(lib: Pick<CogitaLibrary, 'settings'> | null | undefined, learner: LearnerLike | null | undefined, area?: LevelsSetup): EffectiveWorld {
  const eff = effectiveWorld(lib?.settings().levelsSetup ?? area, ownWorld(learner?.progress.values));
  return eff.levels === 0 || runsOn(learner?.holder) ? eff : { ...eff, levels: 0, rules: [], serverOld: true };
}

const WORLDS = new WeakMap<object, { revision: number; count: number; world: World }>();

/** Die Welt einer Baza (Orte und ihre Karten), einmal je Stand. */
export function worldOf(lib: CogitaLibrary, cards: readonly Card[]): World {
  const had = WORLDS.get(lib.store);
  if (had !== undefined && had.revision === lib.revision && had.count === cards.length) return had.world;
  const world = readWorld(worldInputOf(lib, cards));
  WORLDS.set(lib.store, { revision: lib.revision, count: cards.length, world });
  return world;
}

const SCOPES = new WeakMap<object, { world: World; key: string; scope: ReviewScope }>();

/** Der Bereich für `reviewable` — `null` ohne Stufen (dann ändert sich nichts). */
export function reviewScopeFor(lib: CogitaLibrary | null | undefined, cards: readonly Card[] | null | undefined, learner: LearnerLike | null | undefined): ReviewScope | null {
  if (lib == null || cards == null || learner == null) return null;
  const eff = effectiveWorldFor(lib, learner);
  if (eff.levels === 0) return null;
  const world = worldOf(lib, cards);
  const key = JSON.stringify([eff.levels, eff.rules]);
  const had = SCOPES.get(learner.progress.runs);
  if (had !== undefined && had.world === world && had.key === key) return had.scope;
  const levels = levelsByPlace(learner.progress.runs.values(), eff.rules, eff.levels);
  const places = new Map<string, { conquered: boolean }>();
  for (const p of world.places.keys()) places.set(p, { conquered: (levels.get(p)?.level ?? 0) >= eff.levels });
  const scope: ReviewScope = { world, settings: { levels: eff.levels }, places };
  SCOPES.set(learner.progress.runs, { world, key, scope });
  return scope;
}

/** Wie viele dieser Karten mit diesen Stufen aus den Wiederholungen gingen (die Seite der Einstellungen sagt es vor dem Speichern). */
export function leavingReviews(world: World, cards: readonly string[], runs: Iterable<RunRecord>, setup: Pick<EffectiveWorld, 'levels' | 'rules'>): number {
  if (setup.levels === 0) return 0;
  const levels = levelsByPlace(runs, setup.rules, setup.levels);
  let n = 0;
  for (const k of cards) {
    const places = world.cardPlaces.get(k);
    if (places === undefined || places.length === 0) continue;
    if (!places.some((p) => (levels.get(p)?.level ?? 0) >= setup.levels)) n += 1;
  }
  return n;
}
