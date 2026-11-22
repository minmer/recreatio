/**
 * 2026-11-22 (Eigentümer: „eine Welt ist kein Text") — DIE DIMENSIONEN EINER WELT. Ein Text hat eine Ordnung: Satz nach Satz.
 * Eine Welt hat mehrere über DIESELBEN Türme (nichts wird kopiert, Leitfaden 1.1 Nr. 5):
 *
 * <code>
 *   Folge      die Ordnung der Quelle (Kapitel nach Kapitel, Szene nach Szene) — die „Wymaga"-Kette
 *   Tiefe      Ebenen der Ausführlichkeit: ein Überblick, unter ihm die Szenen, unter ihnen die Einzelheiten
 *              — Blöcke („part": "up"), Vertiefungen (`detour`), Überblickstürme, auf die mehrere aufbauen
 *   Fäden      Ordnungen QUER zur Folge: einer Hauptfigur folgen, einem Thema von der ersten zur letzten Szene
 *              — Wege zu einer Frage (`paths`) über mehrere Türme, Tags, deren Türme in der Folge auseinander liegen,
 *              Türme, die mehrere Szenen verbinden (zwei und mehr direkte Voraussetzungen)
 * </code>
 *
 * Rein, aus dem, was die Karte schon liest (`World`, `Lines`, das Tag-Netz, die Wege zu einer Frage). `worldChecks.ts` macht
 * daraus die Befunde `world.*`; dieselben Zahlen kann jede Ansicht zeigen.
 */

import type { TagNetwork } from './tags';
import type { QPath } from './worldmap/wmPaths';
import type { Lines, World } from './worldmap/wmTypes';

/** Ab so vielen Türmen wird die Form einer Welt beurteilt (darunter ist jede Welt ein kurzer Weg). */
export const DIMENSIONS_FROM = 6;
/** So viele Türme direkt auf einem aufbauen: ein Überblick, unter dem Szenen stehen. */
export const OVERVIEW_BUILDS = 3;
/** Ab diesem Anteil von Türmen mit höchstens einem davor und einem danach ist die Welt eine Linie. */
export const LINEAR_SHARE = 0.9;

export interface WorldDimensions {
  readonly towers: number;
  /** Türme mit höchstens einem direkt davor und einem direkt danach — Glieder einer Kette. */
  readonly inChain: number;
  readonly linear: boolean;
  /** Ebenen der Ausführlichkeit. */
  readonly depth: {
    readonly blocks: number;
    readonly deepenings: number;
    /** Türme, auf die mindestens `OVERVIEW_BUILDS` Türme direkt aufbauen. */
    readonly overviews: readonly string[];
    /** Wie viele Ebenen: 1 (nur Folge) bis 3 und mehr. */
    readonly levels: number;
  };
  /** Ordnungen quer zur Folge. */
  readonly threads: {
    readonly questionPaths: readonly string[];
    /** Tags, deren Türme in der Folge nicht zusammenhängen (eine Figur, ein Thema über die Szenen). */
    readonly crossTags: readonly string[];
    /** Türme mit zwei und mehr direkten Voraussetzungen, die selbst nicht aufeinander aufbauen. */
    readonly joins: readonly string[];
  };
}

/** Hängen diese Türme über direkte Voraussetzungen untereinander zusammen (eine Strecke der Folge)? */
function connected(world: World, towers: readonly string[]): boolean {
  if (towers.length < 2) return true;
  const set = new Set(towers);
  const seen = new Set<string>([towers[0]!]);
  const todo = [towers[0]!];
  while (todo.length > 0) {
    const p = world.places.get(todo.pop()!);
    if (p === undefined) continue;
    for (const n of [...p.needs, ...p.builds]) if (set.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); }
  }
  return seen.size === set.size;
}

export function worldDimensions(world: World, lines: Lines, net: TagNetwork, paths: readonly QPath[]): WorldDimensions {
  const places = [...world.places.values()];
  const inChain = places.filter((p) => p.needs.length <= 1 && p.builds.length <= 1).length;
  const blocks = [...world.blocks.values()].filter((b) => b.parts.length > 0).length;
  const deepenings = new Set(lines.loops.map((l) => l.target)).size;
  const overviews = places.filter((p) => p.builds.length >= OVERVIEW_BUILDS).map((p) => p.id);
  const levels = 1 + (blocks > 0 ? 1 : 0) + (deepenings > 0 ? 1 : 0) + (overviews.length > 0 ? 1 : 0);

  /* Ein Weg zu einer Frage, der durch mehrere Türme geht (seine Orte und die Türme seiner Abläufe). */
  const towersOfFlow = (flow: string): string[] => {
    const line = lines.lines.get(flow);
    return line === undefined ? [] : line.stops.filter((s) => world.places.has(s));
  };
  const questionPaths = paths.filter((qp) => {
    const towers = new Set<string>();
    for (const s of qp.steps) for (const id of s.kind === 'place' ? [s.place] : towersOfFlow(s.flow)) if (world.places.has(id)) towers.add(id);
    return towers.size >= 2;
  }).map((qp) => qp.id);

  const crossTags = net.order.filter((id) => {
    const below = [...net.below(id)].filter((x) => world.places.has(x));
    return below.length >= 2 && !connected(world, below);
  });

  /* Ein Turm, der zwei Szenen zusammenführt: zwei Voraussetzungen, von denen keine auf der anderen aufbaut. */
  const joins = places.filter((p) => {
    if (p.needs.length < 2) return false;
    for (let i = 0; i < p.needs.length; i += 1) for (let j = i + 1; j < p.needs.length; j += 1) {
      const a = p.needs[i]!;
      const b = p.needs[j]!;
      if (!world.base(a).has(b) && !world.base(b).has(a)) return true;
    }
    return false;
  }).map((p) => p.id);

  return {
    towers: places.length,
    inChain,
    linear: places.length >= DIMENSIONS_FROM && inChain / Math.max(1, places.length) >= LINEAR_SHARE,
    depth: { blocks, deepenings, overviews, levels },
    threads: { questionPaths, crossTags, joins }
  };
}
