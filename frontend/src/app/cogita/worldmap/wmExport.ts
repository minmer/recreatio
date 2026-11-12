/**
 * 2026-11-09 — DIE WELTKARTE FÜR AI (Entscheidung 13; `get_knowledge_setup`, Abschnitt „landscapes"): ein Widok mit
 * `landscape.style: "world"` geht als Weltkarte hinaus, nur zum Ansehen —
 * <code>
 *   places    [x, y, "@ort", "@block" | null] — Bodeneinheiten (eine Säule hat den Radius 28), die Lage, die jeder sieht
 *             (die abgelegte Lage `worldmap`, Neues deterministisch eingefügt)
 *   home      [x, y] des Hauses (null: keine Linie beginnt dort)
 *   lines     je Linie (eine Erzählung): ihr Ablauf, Name, die Halte des Stammes, ob sie eine Vertiefung ist, wie viele Zweige
 *   stations  die Umsteigeorte
 * </code>
 * Keine Höhen, kein Stand eines Lernenden. Die Sechseck-Widoki bleiben bei [q, r] (`landscapeExport.ts`).
 * Dazu, was Ansicht und Ausfuhr teilen: welche Arten Orte sind (`placeKindsOf`) und wozu ein Ort farblich gehört (`colourKeys`,
 * davon hängt ab, wo Orte ohne Verbindung am Rand stehen).
 */

import type { Card } from '../cardBasics';
import { anchorKey, readPath, type QAnchor, type QPath } from './wmPaths';
import { nameIn } from '../json';
import { readNest } from '../landscapeNest';
import { buildRegions, type RegionTree } from '../regions';
import type { CogitaLibrary } from '../store';
import { readView, type ViewDoc } from '../views';
import { geometryInputOf } from './wmGeometry';
import { geometryFor } from './wmGeometryClient';
import { readWorld } from './wmGraph';
import { placeKindsOf, worldInputOf } from './wmInput';
import { linesOf } from './wmLines';
import { storedLayout } from './wmStore';
import { HOME, type World } from './wmTypes';

/** Welche Arten Orte sind (`wmInput.ts`; dieselbe Regel für Karte, Ausfuhr und Wiederholungen). */
export { placeKindsOf };

/** Der Graph der Orte, wie `regions.ts` ihn liest. */
export function regionGraphOf(world: World): { ids: string[]; labels: string[]; needs: number[][] } {
  const ids = [...world.order];
  const index = new Map(ids.map((id, i) => [id, i] as const));
  return { ids, labels: ids.map((id) => world.places.get(id)!.label), needs: ids.map((id) => world.places.get(id)!.needs.map((n) => index.get(n)!).filter((i) => i !== undefined)) };
}

/**
 * Wozu ein Ort farblich gehört (wie im Krajobraz): der oberste Knoten des Widoku (`nest`), sonst sein oberstes Gebiet
 * (`regions.ts`, aus den Voraussetzungen gerechnet), sonst seine Grundlage ganz unten.
 */
export function colourKeys(lib: CogitaLibrary, world: World, view: ViewDoc, regions: RegionTree | null): Map<string, string> {
  const out = new Map<string, string>();
  const nestField = view.landscape?.nest;
  if (nestField !== undefined) {
    const tree = readNest(lib, world.order, nestField, view.landscape?.nestSort ?? 'nr');
    for (const id of world.order) {
      let at = tree.home.get(id) ?? null;
      let guard = 0;
      while (at !== null && guard < 32) { const parent = tree.nodes.get(at)?.parent ?? null; if (parent === null) break; at = parent; guard += 1; }
      if (at !== null) out.set(id, at);
    }
  }
  if (regions !== null) for (const id of world.order) { const top = regions.assignment[id]?.[0]; if (top !== undefined && !out.has(id)) out.set(id, top); }
  for (const id of world.order) {
    if (out.has(id)) continue;
    const roots = [...world.base(id)].filter((b) => world.places.get(b)?.depth === 0);
    out.set(id, roots.sort()[0] ?? id);
  }
  return out;
}

export interface WorldLayoutDoc {
  readonly view: string;
  readonly name: string;
  readonly style: 'world';
  readonly home: readonly [number, number] | null;
  readonly places: readonly (readonly [number, number, string, string | null])[];
  readonly lines: readonly { readonly flow: string; readonly name: string; readonly stops: readonly string[]; readonly deepening: boolean; readonly branches: number }[];
  readonly stations: readonly string[];
  /**
   * 2026-11-12 (Prompt 25) — DIE WEGWEISER der Wege zu einer Frage: ihr Anker ("home", ein Ort, {"flow", "step"}), die Wege, die
   * dort hängen, und wo die App das Schild hinstellt ([x, y] neben dem Anker; ohne Lage, wo der Anker nicht auf der Karte ist).
   */
  readonly signs: readonly { readonly anchor: string | { readonly flow: string; readonly step: string }; readonly paths: readonly string[]; readonly at: readonly [number, number] | null }[];
}

/** Die Wegweiser: je Anker die Wege (bleibende Namen), mit der Lage, die `at` gibt. */
function signsFor(paths: readonly QPath[], at: (a: QAnchor) => readonly [number, number] | null, ref: (id: string) => string): WorldLayoutDoc['signs'] {
  const by = new Map<string, { anchor: QAnchor; paths: string[] }>();
  for (const p of paths) for (const a of p.anchors) { const k = anchorKey(a); const s = by.get(k) ?? { anchor: a, paths: [] }; s.paths.push(ref(p.id)); by.set(k, s); }
  return [...by.values()].map(({ anchor, paths: list }) => ({
    anchor: anchor.kind === 'home' ? 'home' : anchor.kind === 'place' ? ref(anchor.place) : { flow: ref(anchor.flow), step: anchor.step },
    paths: list, at: at(anchor)
  }));
}

/** Die Weltkarte jedes Widoku `style: "world"` — dieselbe Lage wie in der Ansicht (abgelegt, sonst im Worker gerechnet). */
export async function worldLayouts(lib: CogitaLibrary, cards: readonly Card[]): Promise<WorldLayoutDoc[]> {
  const name = nameIn(lib);
  const ref = (id: string): string => (id === HOME ? 'home' : `@${name(id)}`);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const out: WorldLayoutDoc[] = [];
  for (const doc of lib.docs('view')) {
    const view = readView(doc.data);
    if (view.mode !== 'landscape' || view.landscape?.style !== 'world') continue;
    const input = worldInputOf(lib, cards, { placeKinds: placeKindsOf(view) });
    const world = readWorld(input);
    if (world.places.size === 0) continue;
    const lines = linesOf(world, input.flows);
    const regions = view.landscape?.nest !== undefined ? null : buildRegions(regionGraphOf(world), {});
    const keys = colourKeys(lib, world, view, regions);
    const stored = storedLayout(lib)?.positions;
    const g = await geometryFor(geometryInputOf(world, lines, { ...(stored === undefined ? {} : { previous: stored }), color: (id) => keys.get(id) }));
    const home = g.positions[HOME];
    out.push({
      view: `@${name(doc.id)}`, name: view.name, style: 'world',
      home: home === undefined ? null : [r1(home[0]), r1(home[1])],
      places: world.order.map((id) => {
        const p = g.positions[id] ?? [0, 0];
        const block = world.places.get(id)!.block;
        return [r1(p[0]), r1(p[1]), ref(id), block === undefined ? null : ref(block)] as const;
      }),
      lines: [...lines.lines.values()].map((l) => ({ flow: `@${name(l.id)}`, name: l.name, stops: l.stops.map(ref), deepening: l.deepening, branches: Math.max(0, l.branches.length - 1) })),
      stations: [...lines.stations.keys()].filter((k) => k !== HOME).map(ref),
      signs: signsFor(lib.docs('qpath').map((e) => readPath(e.id, e.data)), (anchor) => {
        if (anchor.kind === 'home') return home === undefined ? null : [r1(home[0] + 30), r1(home[1] + 8)];
        if (anchor.kind === 'place') { const p = g.positions[anchor.place]; const r = g.radii[anchor.place] ?? 28; return p === undefined ? null : [r1(p[0] + r * 1.05), r1(p[1] + r * 0.75)]; }
        const jn = [...lines.junctions.values()].find((j) => j.line === anchor.flow && j.step === anchor.step);
        const p = jn === undefined ? undefined : g.positions[jn.id];
        return p === undefined ? null : [r1(p[0] + 14), r1(p[1] + 10)];
      }, ref)
    });
  }
  return out;
}
