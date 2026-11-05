/**
 * 2026-11-03 (Prompt 5) — DIE SPERRE VOR EINER ERZÄHLUNG, mit derselben Logik wie der Krajobraz: was in der ganzen Kette
 * vor ihrer Einheit lernbar und noch nicht gelernt ist (die Höhe des Berges — Einträge ohne Karten sind durchsichtig, eine
 * Erzählung davor zählt erst mit bestandenem Przegląd), und sonst die schwachen, schon gefragten Karten dieser Kette
 * (`lockCards` — „Najpierw powtórz"). Fehlt etwas, steht der Spieler zu; sind nur Karten schwach, bietet er die Powtórka an.
 *
 * 2026-11-04 (Prompt 11) — dieselbe Sperre für alles, was nach einer Erzählung kommt (`nextForStory`, `storyNext.ts`): die
 * Kenntnis wird einmal gerechnet, die Sperre je Nachfolger.
 */

import type { Card } from './cardBasics';
import { readFlow, type Flow } from './flow';
import { cardOfQuestion, flowQuestionsKnown, learnerFlows, storyStage, storyUnitsOf } from './flowFacts';
import { cardKnowness, chainNeeds, gaugeFromMarks, itemKnowness, withFlows, type Gauge } from './knowing';
import { KNOWN } from './knowness';
import { spacingFor } from './spacing';
import { isLearned } from './landscape';
import { lockCards } from './landscapeData';
import { answeredCards, renamer, type FlowPosition, type Learner } from './learn';
import { authorOrder } from './PathLearn';
import type { CogitaLibrary } from './store';
import { storyNext, type StoryNext } from './storyNext';

export interface StoryLock {
  /** Was vor der Einheit noch nicht gelernt ist, in der Reihenfolge des Weges (die Grundlagen zuerst). */
  readonly missing: readonly string[];
  /** Fehlt nichts: die schwachen, schon gefragten Karten der Kette (dieselbe Sperre wie „Najpierw powtórz" im Krajobraz). */
  readonly weak: readonly Card[];
  /** 2026-11-04 (Prompt 11) — die Einträge dieser schwachen Karten (zum Nennen). */
  readonly due?: readonly string[];
}

export const OPEN_LOCK: StoryLock = { missing: [], weak: [] };

/** Die Kenntnis des Lernenden über alle Karten der Baza (wie im Krajobraz: mit Antworten von Seiten und den Erzählungen). */
export function learnerGauge(lib: CogitaLibrary, cards: readonly Card[], learner: Learner): Gauge {
  const rename = renamer(lib.merges());
  const fp = new Map(cards.map((c) => [c.key, c.fingerprint] as const));
  const all = [...cards, ...answeredCards(learner.progress, new Set(fp.keys()))];
  return withFlows(gaugeFromMarks(all, (key) => learner.marks(key, fp.get(key), rename), lib.dependencies(), Date.now(), lib.prerequisites(), spacingFor(lib, learner)), learnerFlows(lib, learner.progress.positions));
}

interface LockContext {
  readonly lib: CogitaLibrary;
  readonly cards: readonly Card[];
  readonly learner: Learner;
  readonly gauge: Gauge;
  readonly graph: ReturnType<CogitaLibrary['prerequisites']>;
  readonly stories: ReadonlyMap<string, Flow>;
  readonly learned: (id: string) => boolean;
  readonly order: (a: string, b: string) => number;
}

function lockContext(lib: CogitaLibrary, cards: readonly Card[], learner: Learner): LockContext {
  const graph = lib.prerequisites();
  const gauge = learnerGauge(lib, cards, learner);
  const stories = storyUnitsOf(lib, (id) => gauge.testing.has(id));
  const flows = learnerFlows(lib, learner.progress.positions);
  const learned = (id: string): boolean => {
    const story = stories.get(id);
    /* 2026-11-05 (Prompt 23, C4) — auch, wenn jede ihrer Fragen gekonnt ist. */
    if (story !== undefined) return storyStage(story, flows.get(story.id), flowQuestionsKnown(story, cardOfQuestion(cards), (key) => cardKnowness(gauge, key) >= KNOWN)) === 'passed';
    return isLearned(itemKnowness(gauge, id));
  };
  return { lib, cards, learner, gauge, graph, stories, learned, order: authorOrder(lib) };
}

function lockWith(c: LockContext, unit: string): StoryLock {
  const { lib, graph, gauge, stories } = c;
  const missing = chainNeeds([unit], graph)
    .filter((id) => id !== unit && lib.entity(id) !== undefined && (gauge.askable.has(id) || stories.has(id)) && !c.learned(id))
    .sort((a, b) => (graph.level.get(a) ?? 0) - (graph.level.get(b) ?? 0) || c.order(a, b));
  if (missing.length > 0) return { missing, weak: [] };
  const groups = lockCards(gauge, graph, unit, c.cards).map((g) => ({ entry: g.entry, cards: g.cards.filter((x) => !c.learner.progress.suspended.has(x.key)) })).filter((g) => g.cards.length > 0);
  return { missing, weak: groups.flatMap((g) => g.cards), due: groups.map((g) => g.entry) };
}

export function storyLock(lib: CogitaLibrary, cards: readonly Card[], learner: Learner, unit: string): StoryLock {
  return lockWith(lockContext(lib, cards, learner), unit);
}

/**
 * 2026-11-04 (Prompt 11) — WAS NACH DIESER ERZÄHLUNG KOMMT, für diesen Lernenden: ihre Nachfolger in der Reihenfolge des
 * Lernens mit ihrer Sperre, sonst das nächste lernbare Feld (`storyNext.ts`). `taught`: was die Erzählung zeigt und fragt.
 */
export function nextForStory(lib: CogitaLibrary, cards: readonly Card[], learner: Learner, flow: Pick<Flow, 'unit'>, taught: readonly string[]): StoryNext & { readonly stories: ReadonlyMap<string, Flow> } {
  return nextWith(lockContext(lib, cards, learner), flow, taught);
}

/**
 * Beides auf einmal, mit EINER Rechnung der Kenntnis (der Spieler braucht es nach jeder Antwort): die Sperre vor einer
 * Einheit (`lockUnit`) und was nach einer Erzählung kommt (`after`).
 */
export function storyAround(lib: CogitaLibrary, cards: readonly Card[], learner: Learner, lockUnit: string | null, after: { readonly flow: Pick<Flow, 'unit'>; readonly taught: readonly string[] } | null): { readonly lock: StoryLock; readonly next: (StoryNext & { readonly stories: ReadonlyMap<string, Flow> }) | null } {
  if (lockUnit === null && after === null) return { lock: OPEN_LOCK, next: null };
  const c = lockContext(lib, cards, learner);
  return { lock: lockUnit === null ? OPEN_LOCK : lockWith(c, lockUnit), next: after === null ? null : nextWith(c, after.flow, after.taught) };
}

function nextWith(c: LockContext, flow: Pick<Flow, 'unit'>, taught: readonly string[]): StoryNext & { readonly stories: ReadonlyMap<string, Flow> } {
  const lib = c.lib;
  const unit = flow.unit !== undefined && lib.entity(flow.unit) !== undefined ? flow.unit : null;
  const isQuestion = (id: string) => lib.entity(id)?.kinds.includes('question') === true;
  const result = storyNext({
    unit,
    taught: taught.filter((id) => lib.entity(id) !== undefined),
    needs: (id) => c.graph.needs.get(id) ?? [],
    builds: (id) => c.graph.builds.get(id) ?? [],
    story: (id) => c.stories.has(id),
    topic: (id) => !c.stories.has(id) && c.gauge.askable.has(id) && lib.entity(id) !== undefined && !isQuestion(id),
    learned: c.learned,
    lock: (id) => { const l = lockWith(c, id); return { missing: l.missing, due: l.due ?? [] }; },
    order: (a, b) => (c.graph.level.get(a) ?? 0) - (c.graph.level.get(b) ?? 0) || c.order(a, b)
  });
  return { ...result, stories: c.stories };
}

/**
 * 2026-11-04 (Prompt 13) — WELCHE ERZÄHLUNGEN VOR DIESER ZU ENDE SEIN MÜSSEN, wenn sie DIREKT geöffnet wird (nicht als
 * Abstecher aus ihrem Überblick — der darf immer hinein): die Erzählungen, deren Einheit in der Kette vor ihrer Einheit
 * steht (ein Feld mit "prerequisite": "up", etwa „Wymaga" → die Einheit des Überblicks) und die der Lernende noch nicht
 * zu Ende erzählt hat — ihre Namen, die Grundlagen zuerst. `null`: keine. Rein über die Baza und die Stellen des Lernenden
 * (dieselbe Zeile im Spieler und im Krajobraz: „Najpierw: Etap 1").
 */
export function directStartLock(lib: CogitaLibrary, positions: ReadonlyMap<string, FlowPosition> | undefined, flow: Pick<Flow, 'id' | 'unit'>): string[] | null {
  const unit = flow.unit;
  if (unit === undefined || lib.entity(unit) === undefined) return null;
  const graph = lib.prerequisites();
  const byUnit = new Map<string, Flow>();
  for (const d of lib.docs('flow')) {
    const f = readFlow(d.id, d.data);
    if (f.unit !== undefined && f.id !== flow.id && !byUnit.has(f.unit)) byUnit.set(f.unit, f);
  }
  if (byUnit.size === 0) return null;
  const facts = learnerFlows(lib, positions);
  const first = chainNeeds([unit], graph)
    .filter((id) => id !== unit && byUnit.has(id) && facts.get(byUnit.get(id)!.id)?.done !== true)
    .sort((a, b) => (graph.level.get(a) ?? 0) - (graph.level.get(b) ?? 0));
  return first.length === 0 ? null : first.map((id) => byUnit.get(id)!.name);
}
