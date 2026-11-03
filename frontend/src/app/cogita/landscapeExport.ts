/**
 * 2026-11-03 (H) — DIE FESTE KARTE JEDES KRAJOBRAZ FÜR AI (`get_knowledge_setup`, Abschnitt „landscapes"): weil die
 * Plätze seit E nur aus der Struktur kommen, ist die Karte eines Widoku im Modus „landscape" für jeden dieselbe — ohne
 * Höhen, ohne Bänder, ohne irgendetwas vom Lernen eines Menschen:
 * <code>
 *   cells     [q, r, "@eintrag", bereich] — die Zelle jedes Eintrags (axial; Bereich: Index in "areas", −1 die Mitte)
 *   ground    wie viele Zellen Boden dazwischen sind (das Raster ist Kante an Kante)
 *   areas     die Bereiche oben: Wert, Name, Bogen (Grad, 0 links), wie viele Einträge
 *   regions   alle Werte (auch die darunter): was ein Zoom öffnet und was das Budget zusammenfasst — ein Feld „+N"
 *             steht immer auf den Zellen eines Bereichs (und eines Bandes, das der Lernende erst mitbringt)
 * </code>
 * Gerechnet im Browser beim Bau des Odpis (`aiSnapshot.ts`), mit denselben Bausteinen wie die Ansicht.
 */

import type { Card } from './cardBasics';
import { nameIn } from './json';
import { LandscapeEngine } from './landscape';
import { landscapeInput } from './landscapeData';
import { cardEntities } from './prerequisites';
import { readFlow } from './flow';
import type { CogitaLibrary } from './store';
import { readView, viewList } from './views';

export interface LandscapeArea {
  readonly value: string;
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

export interface LandscapeRegion extends LandscapeArea {
  /** Der Wert darüber (`null`: oben). */
  readonly parent: string | null;
}

export interface LandscapeLayoutDoc {
  readonly view: string;
  readonly name: string;
  readonly cells: readonly (readonly [number, number, string, number])[];
  readonly ground: number;
  readonly areas: readonly LandscapeArea[];
  readonly regions: readonly LandscapeRegion[];
}

const round = (x: number): number => Math.round(x * 100) / 100;

export function landscapeLayouts(lib: CogitaLibrary, cards: readonly Card[]): LandscapeLayoutDoc[] {
  const name = nameIn(lib);
  const ref = (id: string): string => (id.startsWith('~') ? `~@${name(id.slice(1))}` : id === '#' ? '#' : `@${name(id)}`);
  /* Was gefragt werden kann — und die Einheiten von Erzählungen (sie stehen auch ohne eigene Karten). */
  const askable = new Set(cards.filter((c) => c.template !== '~page').flatMap((c) => cardEntities(c)));
  for (const d of lib.docs('flow')) { const unit = readFlow(d.id, d.data).unit; if (unit !== undefined) askable.add(unit); }
  const out: LandscapeLayoutDoc[] = [];
  for (const doc of lib.docs('view')) {
    const view = readView(doc.data);
    if (view.mode !== 'landscape') continue;
    /* Nur die Struktur: Schritte, die von der Kenntnis abhängen, fallen weg (die Karte ist für jeden dieselbe). */
    const plain = { ...view, query: '', steps: view.steps.filter((s) => s.type !== 'filter.when') };
    const list = viewList(lib, plain);
    const input = landscapeInput({ select: lib.selectContext(), deps: lib.dependencies(), label: (e) => lib.label(e) }, list, view.group, { askable });
    const engine = new LandscapeEngine();
    engine.setInput(input);
    const fixed = engine.map();
    if (fixed === null) continue;
    const dir = fixed.dir;
    const live = (x: number) => Number.isFinite(dir.from[x]);
    const valueOf = (x: number) => ref(dir.values[x].id);
    out.push({
      view: `@${name(doc.id)}`, name: view.name,
      cells: fixed.cells.filter((c) => c.node >= 0).map((c) => [c.q, c.r, `@${name(input.ids[c.node])}`, c.region] as const),
      ground: fixed.cells.filter((c) => c.node < 0).length,
      areas: dir.topLevel.map((x) => ({ value: valueOf(x), label: dir.values[x].label, from: round(dir.from[x]), to: round(dir.to[x]), count: dir.count[x] })),
      regions: dir.values.flatMap((v, x): LandscapeRegion[] => (live(x) ? [{
        value: valueOf(x), label: v.label, parent: dir.parent[x] === dir.root || !live(dir.parent[x]) ? null : valueOf(dir.parent[x]),
        from: round(dir.from[x]), to: round(dir.to[x]), count: dir.count[x]
      }] : []))
    });
  }
  return out;
}
