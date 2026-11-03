/**
 * 2026-11-03 — DIE VORSCHAU DES IMPORTS FRAGT DIE GENERATOREN (`generator.ts`): je Pytanie mit `params`/`let` und je
 * Szablon mit einem Knoten „Generator" — übersetzen die Ausdrücke, und gelingen Proben (mit den Einträgen, wie sie NACH
 * dem Import wären)? Was nicht gelingt, steht als Warnung da: so eine Aufgabe käme nach dem Import gar nicht als Karte.
 */

import { rngOf } from './cardBasics';
import { drawInstance, readParamsSpec, specErrors, type GenWorld, type ParamsSpec } from './generator';
import { readGraph } from './graph';
import type { DocKind } from './kinds';
import type { Entity, KindDef, Lookup } from './schema';
import type { CogitaLibrary } from './store';

interface PlanPart {
  readonly kinds: readonly { readonly id: string; readonly def: KindDef; readonly marks?: Readonly<Record<string, unknown>> }[];
  readonly entities: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }[];
  readonly docs: readonly { readonly id: string; readonly kind: DocKind; readonly data: Readonly<Record<string, unknown>> }[];
}

/** So viele Proben je Generator. */
const PROBES = 20;

const clip = (text: string, n: number): string => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat; };

/** Die Welt nach dem Import: geplante Arten und Einträge über dem, was schon in der Baza steht. */
function plannedWorld(lib: CogitaLibrary, plan: PlanPart): GenWorld {
  const kinds = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const planned = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const look: Lookup = { kind: (id) => kinds.get(id) ?? lib.kind(id), entity: (id) => planned.get(id) ?? lib.entity(id) };
  const pool = (kind: string): Entity[] => {
    const out = new Map<string, Entity>();
    for (const e of lib.material(kind)) out.set(e.id, planned.get(e.id) ?? e);
    for (const e of planned.values()) if (e.kinds.includes(kind)) out.set(e.id, e);
    return [...out.values()];
  };
  const kindOf = (ref: string): string | undefined => {
    const bare = ref.trim().replace(/^@/, '');
    if (kinds.has(bare)) return bare;
    const lower = bare.toLowerCase();
    const byRef = plan.kinds.find((k) => typeof k.marks?._ref === 'string' && (k.marks._ref as string).toLowerCase() === lower);
    if (byRef !== undefined) return byRef.id;
    const byName = plan.kinds.find((k) => k.def.name.toLocaleLowerCase('pl-PL') === bare.toLocaleLowerCase('pl-PL'));
    return byName?.id ?? lib.kindOf(ref);
  };
  return { look, pool, kindOf };
}

/** Proben: wie viele misslingen, und warum (der erste Grund). */
function probe(spec: ParamsSpec, world: GenWorld, salt: string): { failed: number; why: string | null } {
  let failed = 0;
  let why: string | null = null;
  for (let i = 0; i < PROBES; i += 1) {
    const made = drawInstance(spec, rngOf(`import:${salt}:${i}`), world);
    if (made.held) continue;
    failed += 1;
    why ??= made.problem;
  }
  return { failed, why };
}

/** DIE WARNUNGEN der Generatoren eines geplanten Imports — leer: alles gut (oder keine Generatoren). */
export function generatorImportWarnings(lib: CogitaLibrary, plan: PlanPart): string[] {
  const out: string[] = [];
  let world: GenWorld | null = null;
  const worldNow = (): GenWorld => (world ??= plannedWorld(lib, plan));
  for (const e of plan.entities) {
    if (!e.kinds.includes('question')) continue;
    const spec = readParamsSpec(e.data);
    if (spec === null) continue;
    const name = `Pytanie „${clip(typeof e.data.prompt === 'string' ? e.data.prompt : e.id, 60)}”`;
    const errors = specErrors(spec);
    if (errors.length > 0) { out.push(`${name}: generator — ${errors.join(' ')} Taka karta nie powstanie.`); continue; }
    const { failed, why } = probe(spec, worldNow(), e.id);
    if (failed > 0) out.push(`${name}: generator nie wylosował zadania w ${failed} z ${PROBES} prób — ${why ?? 'warunki niespełnione'}${failed === PROBES ? ' Ta karta nie powstanie.' : ' Wtedy karta w danym przebiegu nie powstaje.'}`);
  }
  for (const d of plan.docs) {
    if (d.kind !== 'template') continue;
    const graph = readGraph(d.data.graph);
    const nodes = graph.nodes.filter((n) => n.type === 'generate');
    if (nodes.length === 0) continue;
    const tkinds = Array.isArray(d.data.kinds) ? d.data.kinds.filter((k): k is string => typeof k === 'string') : [];
    const w = worldNow();
    const self = tkinds.flatMap((k) => w.pool(k))[0];
    for (const node of nodes) {
      const spec = readParamsSpec(node.config);
      const name = `Szablon „${clip(typeof d.data.name === 'string' ? d.data.name : d.id, 60)}”, generator „${node.id}”`;
      if (spec === null) { out.push(`${name}: nie ma nic do losowania (params, let albo texts).`); continue; }
      const errors = specErrors(spec);
      if (errors.length > 0) { out.push(`${name}: ${errors.join(' ')} Karty z niego nie powstaną.`); continue; }
      if (self === undefined) continue;
      const { failed, why } = probe(spec, { ...w, self }, `${d.id}:${node.id}`);
      if (failed > 0) out.push(`${name}: dla wpisu „${clip(w.look.entity(self.id) === undefined ? self.id : String(self.data.name ?? self.id), 40)}” nie wylosował zadania w ${failed} z ${PROBES} prób — ${why ?? 'warunki niespełnione'}`);
    }
  }
  return out;
}
