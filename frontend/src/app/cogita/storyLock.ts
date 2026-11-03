/**
 * 2026-11-03 (Prompt 5) — DIE SPERRE VOR EINER ERZÄHLUNG, mit derselben Logik wie der Krajobraz: was in der ganzen Kette
 * vor ihrer Einheit lernbar und noch nicht gelernt ist (die Höhe des Berges — Einträge ohne Karten sind durchsichtig, eine
 * Erzählung davor zählt erst mit bestandenem Przegląd), und sonst die schwachen, schon gefragten Karten dieser Kette
 * (`lockCards` — „Najpierw powtórz"). Fehlt etwas, steht der Spieler zu; sind nur Karten schwach, bietet er die Powtórka an.
 */

import type { Card } from './cardBasics';
import { learnerFlows, storyStage, storyUnitsOf } from './flowFacts';
import { chainNeeds, gaugeFromMarks, itemKnowness, withFlows, type Gauge } from './knowing';
import { isLearned } from './landscape';
import { lockCards } from './landscapeData';
import { answeredCards, renamer, type Learner } from './learn';
import { authorOrder } from './PathLearn';
import type { CogitaLibrary } from './store';

export interface StoryLock {
  /** Was vor der Einheit noch nicht gelernt ist, in der Reihenfolge des Weges (die Grundlagen zuerst). */
  readonly missing: readonly string[];
  /** Fehlt nichts: die schwachen, schon gefragten Karten der Kette (dieselbe Sperre wie „Najpierw powtórz" im Krajobraz). */
  readonly weak: readonly Card[];
}

export const OPEN_LOCK: StoryLock = { missing: [], weak: [] };

/** Die Kenntnis des Lernenden über alle Karten der Baza (wie im Krajobraz: mit Antworten von Seiten und den Erzählungen). */
export function learnerGauge(lib: CogitaLibrary, cards: readonly Card[], learner: Learner): Gauge {
  const rename = renamer(lib.merges());
  const fp = new Map(cards.map((c) => [c.key, c.fingerprint] as const));
  const all = [...cards, ...answeredCards(learner.progress, new Set(fp.keys()))];
  return withFlows(gaugeFromMarks(all, (key) => learner.marks(key, fp.get(key), rename), lib.dependencies(), Date.now(), lib.prerequisites()), learnerFlows(lib, learner.progress.positions));
}

export function storyLock(lib: CogitaLibrary, cards: readonly Card[], learner: Learner, unit: string): StoryLock {
  const graph = lib.prerequisites();
  const gauge = learnerGauge(lib, cards, learner);
  const stories = storyUnitsOf(lib, (id) => gauge.testing.has(id));
  const flows = learnerFlows(lib, learner.progress.positions);
  const learned = (id: string): boolean => {
    const story = stories.get(id);
    if (story !== undefined) return storyStage(story, flows.get(story.id)) === 'passed';
    return isLearned(itemKnowness(gauge, id));
  };
  const order = authorOrder(lib);
  const missing = chainNeeds([unit], graph)
    .filter((id) => id !== unit && lib.entity(id) !== undefined && (gauge.askable.has(id) || stories.has(id)) && !learned(id))
    .sort((a, b) => (graph.level.get(a) ?? 0) - (graph.level.get(b) ?? 0) || order(a, b));
  if (missing.length > 0) return { missing, weak: [] };
  const weak = lockCards(gauge, graph, unit, cards).flatMap((g) => g.cards).filter((c) => !learner.progress.suspended.has(c.key));
  return { missing, weak };
}
