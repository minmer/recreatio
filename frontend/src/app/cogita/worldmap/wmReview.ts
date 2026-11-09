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
import { readView } from '../views';
import { readWorld } from './wmGraph';
import { placeKindsOf, worldInputOf } from './wmInput';
import { runsOn } from './wmFeatures';
import { effectiveWorld, levelsByPlace, ownWorld, type EffectiveWorld, type LevelsSetup, type RunRecord } from './wmRuns';
import type { ReviewScope } from './wmState';

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

/** Die Ortsarten jedes Weltkarten-Widoku der Baza (`placeKindsOf`; leer: abgeleitet) — eine Liste je Widok, keine ohne Weltkarte. */
export function worldViewKinds(lib: Pick<CogitaLibrary, 'docs'>): string[][] {
  const out: string[][] = [];
  for (const doc of lib.docs('view')) {
    const view = readView(doc.data);
    if (view.mode === 'landscape' && view.landscape?.style === 'world') out.push(placeKindsOf(view));
  }
  return out;
}

/** Wozu eine Karte für die Wiederholungen gehört: die Orte, die eine Weltkarte der Baza zeigt (alle Weltkarten zusammen). */
export interface ReviewWorld {
  readonly cardPlaces: ReadonlyMap<string, readonly string[]>;
  readonly places: readonly string[];
}

const WORLDS = new WeakMap<object, { revision: number; count: number; world: ReviewWorld | null }>();

/**
 * Step 3 · 2 — DIE ORTE DER WIEDERHOLUNGEN sind die Orte der Weltkarten dieser Baza, mit denselben Ortsarten wie die Karte
 * (sonst schlösse die Regel Karten von Einträgen aus, die die Karte nie als Ort zeigt — und niemand könnte sie erobern).
 * `null`: die Baza hat keine Weltkarte — dann wirken Stufen nicht auf die Wiederholungen.
 */
export function reviewWorldOf(lib: CogitaLibrary, cards: readonly Card[]): ReviewWorld | null {
  const had = WORLDS.get(lib.store);
  if (had !== undefined && had.revision === lib.revision && had.count === cards.length) return had.world;
  const kinds = worldViewKinds(lib);
  let world: ReviewWorld | null = null;
  if (kinds.length > 0) {
    const cardPlaces = new Map<string, string[]>();
    const places = new Set<string>();
    for (const key of new Set(kinds.map((k) => JSON.stringify([...k].sort())))) {
      const one = readWorld(worldInputOf(lib, cards, { placeKinds: JSON.parse(key) as string[] }));
      for (const p of one.places.keys()) places.add(p);
      for (const [card, ps] of one.cardPlaces) {
        const list = cardPlaces.get(card) ?? [];
        for (const p of ps) if (!list.includes(p)) list.push(p);
        cardPlaces.set(card, list);
      }
    }
    world = { cardPlaces, places: [...places] };
  }
  WORLDS.set(lib.store, { revision: lib.revision, count: cards.length, world });
  return world;
}

const SCOPES = new WeakMap<object, { world: ReviewWorld; key: string; scope: ReviewScope }>();

/** Der Bereich für `reviewable` — `null` ohne Stufen oder ohne Weltkarte (dann ändert sich nichts). */
export function reviewScopeFor(lib: CogitaLibrary | null | undefined, cards: readonly Card[] | null | undefined, learner: LearnerLike | null | undefined): ReviewScope | null {
  if (lib == null || cards == null || learner == null) return null;
  const eff = effectiveWorldFor(lib, learner);
  if (eff.levels === 0) return null;
  const world = reviewWorldOf(lib, cards);
  if (world === null) return null;
  const key = JSON.stringify([eff.levels, eff.rules]);
  const had = SCOPES.get(learner.progress.runs);
  if (had !== undefined && had.world === world && had.key === key) return had.scope;
  const levels = levelsByPlace(learner.progress.runs.values(), eff.rules, eff.levels);
  const places = new Map<string, { conquered: boolean }>();
  for (const p of world.places) places.set(p, { conquered: (levels.get(p)?.level ?? 0) >= eff.levels });
  const scope: ReviewScope = { world: { cardPlaces: world.cardPlaces }, settings: { levels: eff.levels }, places };
  SCOPES.set(learner.progress.runs, { world, key, scope });
  return scope;
}

/** Was `reportDueFor` vom Lernenden braucht. */
interface DueReporter extends LearnerLike {
  reportDue(cards: readonly Card[], rename?: (key: string) => string, now?: number, scope?: ReviewScope | null): Promise<unknown>;
}

/**
 * Step 3 · 3 — DIE ERINNERUNG DES DIENSTES NEU ZÄHLEN, mit dem Bereich von jetzt: nach einem Durchgang (ein Ort kann erobert
 * sein), nach jeder Einstellung der Stufen (eigene oder der Baza) und wenn die Weltkarte öffnet und die Stufen sich seit der
 * letzten Meldung änderten. Sonst stand dort bis zum Ende der nächsten Wiederholung die alte Zahl.
 */
export async function reportDueFor(lib: CogitaLibrary, cards: readonly Card[], learner: DueReporter, rename?: (key: string) => string): Promise<void> {
  if (cards.length === 0) return;
  await Promise.resolve(learner.reportDue(cards, rename, undefined, reviewScopeFor(lib, cards, learner))).catch(() => undefined);
}

/** Wie viele dieser Karten mit diesen Stufen aus den Wiederholungen gingen (die Seite der Einstellungen sagt es vor dem Speichern). */
export function leavingReviews(world: Pick<ReviewWorld, 'cardPlaces'> | null, cards: readonly string[], runs: Iterable<RunRecord>, setup: Pick<EffectiveWorld, 'levels' | 'rules'>): number {
  if (setup.levels === 0 || world === null) return 0;
  const levels = levelsByPlace(runs, setup.rules, setup.levels);
  let n = 0;
  for (const k of cards) {
    const places = world.cardPlaces.get(k);
    if (places === undefined || places.length === 0) continue;
    if (!places.some((p) => (levels.get(p)?.level ?? 0) >= setup.levels)) n += 1;
  }
  return n;
}
