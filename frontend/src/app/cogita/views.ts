/**
 * WIDOKI (2026-10-22, Schritt 9) — ein Widok ist ein Dokument der Baza
 * (`view`): eine Auswahl (die Schritte aus `selection.ts`, dieselben wie die
 * Knoten einer Powtórka), eine Suche, Gruppen, Spalten, eine Reihenfolge, die
 * Plätze auf der Leinwand — und wie er sich zeigt.
 *
 * <code>
 *   { name, mode: "table" | "tree" | "canvas",
 *     steps: [{ type: "source.kind", config: { kind } }, { type: "follow", config: { field, back } },
 *             { type: "filter.rule", config: { rule } }],
 *     query, group: { by: "kind" | "field" | "topic", field?, axis? },
 *     columns: [klucze pól], sort: { key, dir }, positions: { id: { x, y } } }
 * </code>
 *
 * Gezeigt wird er in „Wpisy" (`EntityList.tsx`) und auf einer Seite (der
 * Baustein „Widok", `pages/parts/view.tsx`). Die alte Gestalt (bis Schritt 9:
 * `kind` + `rule`) wird gelesen und als Schritte verstanden; geschrieben wird
 * die neue.
 */

import { fieldsOf, fieldText, valuesOf, type Entity, type FieldDef, type Lookup } from './schema';
import {
  groupsOf, readGrouping, readRule, readSteps, runSteps, isSource,
  type Group, type Grouping, type RuleGroup, type SelectContext, type Step
} from './selection';

export type ListMode = 'table' | 'tree' | 'canvas';

export interface ViewDoc {
  readonly name: string;
  readonly mode: ListMode;
  readonly steps: readonly Step[];
  readonly query: string;
  readonly group: Grouping | null;
  readonly columns: readonly string[];
  readonly sort: { readonly key: string; readonly dir: 1 | -1 } | null;
  readonly positions: Readonly<Record<string, { x: number; y: number }>>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ein Widok aus seinem Dokument — auch aus der alten Gestalt (Art und Filter). */
export function readView(raw: unknown): ViewDoc {
  const d = isObject(raw) ? raw : {};
  const sort = isObject(d.sort) && typeof d.sort.key === 'string' ? { key: d.sort.key, dir: d.sort.dir === -1 ? -1 as const : 1 as const } : null;
  const positions: Record<string, { x: number; y: number }> = {};
  if (isObject(d.positions)) for (const [k, v] of Object.entries(d.positions)) if (isObject(v) && typeof v.x === 'number' && typeof v.y === 'number') positions[k] = { x: v.x, y: v.y };
  let steps = readSteps(d.steps);
  if (!Array.isArray(d.steps)) {
    /* Bis Schritt 9: eine Art und eine Regel — dasselbe als Schritte. */
    const kind = typeof d.kind === 'string' ? d.kind : '';
    const rule = readRule(d.rule);
    steps = [
      kind === '' ? { type: 'source.all', config: {} } : { type: 'source.kind', config: { kind } },
      ...(rule !== null && rule.items.length > 0 ? [{ type: 'filter.rule' as const, config: { rule } }] : [])
    ];
  }
  if (steps.length === 0 || !isSource(steps[0].type)) steps = [{ type: 'source.all', config: {} }, ...steps];
  return {
    name: typeof d.name === 'string' ? d.name : 'Widok',
    mode: d.mode === 'tree' || d.mode === 'canvas' ? d.mode : 'table',
    steps,
    query: typeof d.query === 'string' ? d.query : '',
    group: readGrouping(d.group),
    columns: Array.isArray(d.columns) ? d.columns.filter((c): c is string => typeof c === 'string') : [],
    sort,
    positions
  };
}

/** Wie ein Widok gespeichert wird — immer in der neuen Gestalt. */
export function viewJson(view: ViewDoc): Record<string, unknown> {
  return {
    name: view.name, mode: view.mode,
    steps: view.steps.map((s) => ({ type: s.type, config: s.config })),
    query: view.query,
    ...(view.group === null ? {} : { group: view.group }),
    columns: view.columns,
    ...(view.sort === null ? {} : { sort: view.sort }),
    positions: view.positions
  };
}

/** Die schnelle Wahl „Rodzaj": `''` alles, eine Art — oder `null`: die Quelle ist eine andere (Zbiór, Temat, Lista). */
export function sourceKind(view: ViewDoc): string | null {
  const first = view.steps[0];
  if (first === undefined || first.type === 'source.all') return '';
  if (first.type === 'source.kind' && (first.config.from === undefined || first.config.from === '')) return typeof first.config.kind === 'string' ? first.config.kind : '';
  return null;
}

export function withSourceKind(view: ViewDoc, kind: string): ViewDoc {
  const source: Step = kind === '' ? { type: 'source.all', config: {} } : { type: 'source.kind', config: { kind } };
  return { ...view, steps: [source, ...view.steps.slice(1)], columns: [] };
}

/** Die Regel des ersten „Filtr" — die Leiste „Filtr" in „Wpisy" bearbeitet sie. */
export function ruleOf(view: ViewDoc): RuleGroup | null {
  const step = view.steps.find((s) => s.type === 'filter.rule');
  return step === undefined ? null : readRule(step.config.rule);
}

export function withRule(view: ViewDoc, rule: RuleGroup): ViewDoc {
  const at = view.steps.findIndex((s) => s.type === 'filter.rule');
  const step: Step = { type: 'filter.rule', config: { rule } };
  return { ...view, steps: at < 0 ? [...view.steps, step] : view.steps.map((s, i) => (i === at ? step : s)) };
}

/** Was ein Widok von der Baza braucht — `CogitaLibrary` erfüllt es. */
export interface ViewLib {
  selectContext(): SelectContext;
  search(query: string): Entity[];
  label(entity: Entity): string;
  topics(): readonly Entity[];
  readonly look: Lookup;
}

/** Ein Wert zum Sortieren: das Etikett, eine Zahl, ein Text. */
function sortValue(lib: ViewLib, e: Entity, key: string): string | number {
  if (key === '_label') return lib.label(e);
  const f = fieldsOf(e, lib.look).find((x) => x.key === key);
  if (f === undefined) return '';
  const v = valuesOf(e, f)[0]?.value;
  return typeof v === 'number' ? v : typeof v === 'string' && f.type !== 'ref' ? v : fieldText(e, f, lib.look);
}

/** DIE EINTRÄGE EINES WIDOKU: die Schritte, dann die Suche, dann die Reihenfolge (sonst nach dem Etikett). */
export function viewList(lib: ViewLib, view: ViewDoc): Entity[] {
  const ctx = lib.selectContext();
  const { ids } = runSteps(ctx, view.steps);
  let out = ids.map((id) => ctx.entity(id)).filter((e): e is Entity => e !== undefined);
  if (view.query.trim() !== '') {
    const found = new Set(lib.search(view.query).map((e) => e.id));
    const words = view.query.trim().toLowerCase();
    out = out.filter((e) => found.has(e.id) || lib.label(e).toLowerCase().includes(words));
  }
  const sort = view.sort;
  if (sort !== null) {
    out.sort((a, b) => {
      const x = sortValue(lib, a, sort.key);
      const y = sortValue(lib, b, sort.key);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true })) * sort.dir;
    });
  } else {
    out.sort((a, b) => lib.label(a).localeCompare(lib.label(b), 'pl'));
  }
  return out;
}

/** Die Gruppen eines Widoku (Drzewo) — nach dem, was der Widok sagt; ohne Gruppen: nach Rodzaj. */
export function viewGroups(lib: ViewLib, view: ViewDoc, list: readonly Entity[]): Group[] {
  return groupsOf(lib.selectContext(), list.map((e) => e.id), view.group ?? { by: 'kind' }, lib.topics());
}

/** Die Spalten: die gewählten — sonst die ersten vier Felder (ohne Fliesstext) der Einträge. */
export function viewColumns(lib: ViewLib, view: ViewDoc, list: readonly Entity[]): FieldDef[] {
  const fields = new Map<string, FieldDef>();
  for (const e of list.slice(0, 200)) for (const f of fieldsOf(e, lib.look)) if (!fields.has(f.key)) fields.set(f.key, f);
  if (view.columns.length > 0) return view.columns.map((key) => fields.get(key)).filter((f): f is FieldDef => f !== undefined);
  return [...fields.values()].filter((f) => f.type !== 'markup' && f.type !== 'text' && f.type !== 'blocks' && f.type !== 'media').slice(0, 4);
}

/** Achsen zum Gruppieren: Tematy-Aspekte (`aspect: "yes"`) — sonst oberste Themen mit Unterthemen. */
export function axesOf(lib: ViewLib): Entity[] {
  const topics = lib.topics();
  const aspects = topics.filter((t) => t.data.aspect === 'yes');
  if (aspects.length > 0) return aspects;
  const parents = new Set<string>();
  for (const t of topics) for (const f of fieldsOf(t, lib.look)) if (f.key === 'parent') for (const v of valuesOf(t, f)) if (typeof v.value === 'string') parents.add(v.value);
  return topics.filter((t) => parents.has(t.id) && !fieldsOf(t, lib.look).some((f) => f.key === 'parent' && valuesOf(t, f).length > 0));
}
