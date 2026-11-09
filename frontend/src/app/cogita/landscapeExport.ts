/**
 * 2026-11-03 (H) — DIE FESTE KARTE JEDES KRAJOBRAZ FÜR AI (`get_knowledge_setup`, Abschnitt „landscapes"): die Lage kommt
 * nur aus der Struktur, die Karte eines Widoku im Modus „landscape" ist für jeden dieselbe — ohne Höhen, ohne Bänder,
 * ohne irgendetwas vom Lernen eines Menschen.
 *
 * 2026-11-04 (Prompt 11) — DIE GEBIETE (`regions.ts`, im verschachtelten Krajobraz die Knoten des Besitzers):
 * <code>
 *   levels    wie viele Ebenen von Gebieten (0: die oberste Ebene zeigt die Themen selbst)
 *   regions   je Gebiet: Schlüssel, Name (vom Besitzer, aus einem Abschnitt, sonst „Rund um …"), das Gebiet darüber, seine
 *             Ebene (1: darin stehen Themen), wie viele Themen darin sind und die Mitte seiner Fläche [x, y] (Bodeneinheiten)
 *   topics    [q, r, "@thema", "gebiet"] — 2026-11-04 (Prompt 13): jedes Thema auf seinem festen Platz der EINEN Landschaft
 *             (axial; die Themen eines Gebiets liegen als eine Fläche beisammen, `worldLayout.ts`)
 *   top       die oberste Ebene (Gebiete oder Themen)
 * </code>
 * Gerechnet im Browser beim Bau des Odpis (`aiSnapshot.ts`), mit denselben Bausteinen wie die Ansicht.
 */

import type { Card } from './cardBasics';
import { nameIn } from './json';
import { landscapeInput } from './landscapeData';
import { readNest } from './landscapeNest';
import { landscapeWords } from './landscapeWords';
import { baseLang } from './lang';
import { nestAsRegions, topicGraphOf } from './levelMap';
import { worldLayout } from './worldLayout';
import { cardEntities, questionIds } from './prerequisites';
import { readFlow } from './flow';
import { buildRegions, type RegionTree } from './regions';
import type { CogitaLibrary } from './store';
import { readView, viewList } from './views';

export interface LandscapeRegionDoc {
  readonly key: string;
  readonly name: string;
  readonly parent: string | null;
  readonly level: number;
  readonly topics: number;
  readonly at: readonly [number, number];
}

export interface LandscapeLayoutDoc {
  readonly view: string;
  readonly name: string;
  readonly levels: number;
  readonly top: readonly string[];
  readonly regions: readonly LandscapeRegionDoc[];
  readonly topics: readonly (readonly [number, number, string, string | null])[];
}

export function landscapeLayouts(lib: CogitaLibrary, cards: readonly Card[]): LandscapeLayoutDoc[] {
  const name = nameIn(lib);
  const ref = (id: string): string => `@${name(id)}`;
  const words = landscapeWords(baseLang(lib));
  /* Was gefragt werden kann — und die Einheiten von Erzählungen (sie stehen auch ohne eigene Karten). */
  const askable = new Set(cards.filter((c) => c.template !== '~page').flatMap((c) => cardEntities(c)));
  for (const d of lib.docs('flow')) { const unit = readFlow(d.id, d.data).unit; if (unit !== undefined) askable.add(unit); }
  const asks = questionIds(cards);
  const out: LandscapeLayoutDoc[] = [];
  for (const doc of lib.docs('view')) {
    const view = readView(doc.data);
    if (view.mode !== 'landscape') continue;
    /* 2026-11-09 — die Weltkarte hat ihre eigene Ausfuhr ([x, y], `worldmap/wmExport.ts`). */
    if (view.landscape?.style === 'world') continue;
    /* Nur die Struktur: Schritte, die von der Kenntnis abhängen, fallen weg (die Karte ist für jeden dieselbe). */
    const plain = { ...view, query: '', steps: view.steps.filter((s) => s.type !== 'filter.when') };
    const list = viewList(lib, plain);
    const input = landscapeInput({ select: lib.selectContext(), deps: lib.dependencies(), label: (e) => lib.label(e) }, list, view.group, { askable });
    const tg = topicGraphOf(input, (id) => asks.has(id));
    const nest = view.landscape?.nest === undefined ? null : readNest(lib, list.map((e) => e.id), view.landscape.nest, view.landscape.nestSort ?? 'nr');
    const tree: RegionTree = nest !== null ? nestAsRegions(nest, tg, words.otherTopics, words.wholeMap) : buildRegions(tg.graph, { around: words.around, ...(view.landscape?.regions?.moves === undefined ? {} : { overrides: { moves: view.landscape.regions.moves } }) });
    /* 2026-11-04 (Prompt 13) — die eine Landschaft: jedes Thema sein Platz, jedes Gebiet die Mitte seiner Fläche. */
    const world = worldLayout(tree, tg);
    const regionAt = new Map<string, readonly [number, number]>();
    for (const r of world.regions.values()) regionAt.set(r.key, [Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100]);
    const topicAt = new Map<string, readonly [number, number]>(tg.graph.ids.map((id, t) => [id, [world.cells[t].q, world.cells[t].r]] as const));
    out.push({
      view: ref(doc.id), name: view.name, levels: tree.levels,
      top: tree.top.map((k) => (tree.regions.has(k) ? k : ref(k))),
      regions: [...tree.regions.values()].map((r) => ({
        key: r.key, name: view.landscape?.regions?.names?.[r.key]?.name ?? r.name, parent: r.parent, level: r.level, topics: r.topics.length, at: regionAt.get(r.key) ?? [0, 0]
      })),
      topics: tg.graph.ids.map((id, t) => { const at = topicAt.get(id) ?? [0, 0]; return [at[0], at[1], ref(id), tree.leafOf[t] ?? null] as const; })
    });
  }
  return out;
}
