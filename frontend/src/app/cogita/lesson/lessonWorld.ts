/**
 * 2026-11-22 (I11) — DIE WELT, IN DER EINE STUNDE GEPLANT WIRD: dieselbe wie die der Weltkarte (`WorldLandscape.tsx`): die Orte nach
 * dem Widok mit `"style": "world"` (sonst abgeleitet), ihre Linien, die Stufen der Baza, die Wege zu einer Frage. Kein eigener
 * Graph — nur zusammengesetzt, was die Karte auch nimmt.
 */

import type { Card } from '../cardBasics';
import type { CogitaLibrary } from '../store';
import { readView } from '../views';
import { readWorld } from '../worldmap/wmGraph';
import { placeKindsOf, worldInputOf } from '../worldmap/wmInput';
import { linesOf } from '../worldmap/wmLines';
import { readPath, type QPath } from '../worldmap/wmPaths';
import { effectiveWorld, ownWorld } from '../worldmap/wmRuns';
import type { WorldSettings } from '../worldmap/wmState';
import type { Lines, World } from '../worldmap/wmTypes';

export interface PlanWorld {
  readonly world: World;
  readonly lines: Lines;
  readonly settings: WorldSettings;
  readonly paths: readonly QPath[];
}

export function planWorld(lib: CogitaLibrary, cards: readonly Card[]): PlanWorld {
  const views = lib.docs('view').map((d) => readView(d.data));
  const view = views.find((v) => v.mode === 'landscape' && v.landscape?.style === 'world') ?? views.find((v) => v.mode === 'landscape');
  const input = worldInputOf(lib, cards, { placeKinds: view === undefined ? [] : placeKindsOf(view) });
  const world = readWorld(input);
  const lines = linesOf(world, input.flows);
  /* Die Stufen der Baza (wie für einen neuen Lernenden — ohne eigene Einstellung). */
  const eff = effectiveWorld(lib.settings().levelsSetup, ownWorld(undefined));
  return {
    world, lines,
    settings: { levels: eff.levels, knownShare: eff.knownShare, openAt: eff.openAt },
    paths: lib.docs('qpath').map((e) => readPath(e.id, e.data))
  };
}
