/**
 * 2026-11-12 (Einstufung) — DIE WELT, DIE EINE EINSTUFUNG BRAUCHT, ausserhalb der Weltkarte (im Spieler einer Erzählung): Orte und
 * Linien wie auf der Karte (die Arten der Orte aus dem Widok „Mapa świata", sonst abgeleitet), der Stand des Lernenden mit seinen
 * Stufen, Gutschriften (\`~placed.<turm>\`) und ausgesetzten Karten.
 */

import type { Card } from '../cardBasics';
import { cardKnowness } from '../knowing';
import type { Learner } from '../learn';
import { positionFor } from '../learn';
import type { Facts } from '../logic';
import { learnerGauge } from '../storyLock';
import type { CogitaLibrary } from '../store';
import { readWorld } from './wmGraph';
import { placeKindsOf, worldInputOf } from './wmInput';
import { linesOf } from './wmLines';
import { PLACED_PREFIX } from './wmPlacement';
import { effectiveWorldFor } from './wmReview';
import { levelsByPlace, type LevelRule } from './wmRuns';
import { stateOf, type WorldState } from './wmState';
import type { Lines, World } from './wmTypes';

export interface PlacementWorld {
  readonly world: World;
  readonly lines: Lines;
  readonly state: WorldState;
  readonly rules: readonly LevelRule[];
  readonly levels: number;
}

/** Die Arten der Orte: aus einem Widok mit \`"style": "world"\` (wie die Weltkarte), sonst leer (abgeleitet). */
function worldKinds(lib: CogitaLibrary): string[] {
  for (const d of lib.docs('view')) {
    const data = d.data as { landscape?: { style?: unknown }; steps?: unknown };
    if (data.landscape?.style === 'world' && Array.isArray(data.steps)) return placeKindsOf(data as never);
  }
  return [];
}

export function placementWorld(lib: CogitaLibrary, cards: readonly Card[], learner: Learner): PlacementWorld {
  const input = worldInputOf(lib, cards, { placeKinds: worldKinds(lib) });
  const world = readWorld(input);
  const lines = linesOf(world, input.flows);
  const flowById = new Map(input.flows.map((f) => [f.id, f] as const));
  const eff = effectiveWorldFor(lib, learner);
  const progress = learner.progress;
  const levels = levelsByPlace(progress.runs.values(), eff.rules, eff.levels);
  const gauge = learnerGauge(lib, cards, learner);
  const know = (k: string) => cardKnowness(gauge, k);
  const facts: Facts = { values: progress.values, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date() };
  const state = stateOf(world, lines, {
    now: Date.now(), facts, knowness: know,
    progress: (flow) => {
      const f = flowById.get(flow);
      const p = f === undefined ? progress.positions.get(flow) : positionFor(progress.positions, f);
      return p === undefined ? undefined : { visited: new Set(p.visited), done: p.done === true };
    },
    level: (place) => levels.get(place)?.level ?? 0,
    perfect: (place) => levels.get(place)?.perfect === true,
    suspended: (card) => progress.suspended.has(card),
    placed: (place) => progress.values[`${PLACED_PREFIX}${place}`] ?? 0
  }, { levels: eff.levels, knownShare: eff.knownShare, openAt: eff.openAt });
  return { world, lines, state, rules: eff.rules, levels: eff.levels };
}
