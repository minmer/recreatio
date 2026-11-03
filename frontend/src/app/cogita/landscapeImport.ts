/**
 * 2026-11-03 — WAS DER KRAJOBRAZ BEIM IMPORT SAGT (die Vorschau, `json.ts` `planImport`): Kreise in der Reihenfolge des
 * Lernens (sie zählen als ein Schritt, gehören aber korrigiert), eine Achse eines Krajobraz, die es nicht gibt (dann
 * kommt die Richtung aus der Nähe im Graphen), und ein Krajobraz in einer Baza ohne jede Reihenfolge (dann liegt alles
 * auf dem Ring).
 */

import { fieldDependencies, prerequisiteGraph } from './prerequisites';
import { labelOf, type Entity, type KindDef, type Lookup } from './schema';
import { readView } from './views';

interface Planned {
  readonly kinds: readonly { readonly id: string; readonly def: KindDef }[];
  readonly entities: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Record<string, unknown> }[];
  readonly docs: readonly { readonly kind: string; readonly data: Record<string, unknown> }[];
}

interface BaseLike {
  kind(id: string): KindDef | undefined;
  entity(id: string): Entity | undefined;
  entities(): readonly Entity[];
}

const listed = (names: readonly string[]): string => `${names.slice(0, 5).map((n) => `„${n.slice(0, 60)}”`).join(', ')}${names.length > 5 ? ` i ${names.length - 5} innych` : ''}`;

export function landscapeImportWarnings(lib: BaseLike, plan: Planned): string[] {
  const out: string[] = [];
  const kindDefs = new Map(plan.kinds.map((k) => [k.id, k.def] as const));
  const planned = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: [...e.kinds], data: e.data } as Entity]));
  const look: Lookup = { kind: (id) => kindDefs.get(id) ?? lib.kind(id), entity: (id) => planned.get(id) ?? lib.entity(id) };
  const all = [...planned.values(), ...lib.entities().filter((e) => !planned.has(e.id))];
  const deps = fieldDependencies(all, look);
  const views = plan.docs.filter((d) => d.kind === 'view').map((d) => readView(d.data)).filter((v) => v.mode === 'landscape');

  if (planned.size > 0 && deps.length > 0) {
    const graph = prerequisiteGraph(deps);
    const touched = graph.circles.filter((d) => planned.has(d.parent) || planned.has(d.child));
    if (touched.length > 0) {
      const names = [...new Set(touched.flatMap((d) => [d.parent, d.child]))].map((id) => { const e = look.entity(id); return e === undefined ? id : labelOf(e, look); });
      out.push(`Kolejność nauki („Najpierw trzeba znać”) zamyka koło: ${listed(names)} — w krajobrazie koło liczy się jako jeden krok, a ścieżka i poziomy pomijają jedno połączenie. Popraw je.`);
    }
  }
  for (const v of views) {
    if (v.group?.by === 'axis' && look.kind(v.group.kind) === undefined) {
      out.push(`Krajobraz „${v.name}”: nie ma rodzaju-osi „${v.group.kind}” — kierunek przyjdzie z sąsiedztwa w kolejności nauki.`);
    }
    if (deps.length === 0) out.push(`Krajobraz „${v.name}”: baza nie ma jeszcze kolejności nauki (pól „Najpierw trzeba znać”) — wszystko, czego się nie umie, leży na pierścieniu, bez gór.`);
  }
  return out;
}
