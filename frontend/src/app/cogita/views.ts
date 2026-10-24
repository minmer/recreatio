/**
 * WIDOKI (2026-10-22, Schritt 9) — ein Widok ist ein Dokument der Baza
 * (`view`): eine Auswahl (die Schritte aus `selection.ts`, dieselben wie die
 * Knoten einer Powtórka), eine Suche, Gruppen, Spalten, eine Reihenfolge, die
 * Plätze auf der Leinwand — und wie er sich zeigt.
 *
 * <code>
 *   { name, mode: "table" | "tree" | "canvas" | "matrix" | "map" | "outline",
 *     steps: [{ type: "source.kind", config: { kind } }, { type: "follow", config: { field, back } },
 *             { type: "filter.rule", config: { rule } }],
 *     query, group: { by: "kind" } | { by: "field", field } | { by: "axis", kind, via, through?, sort?, group? },
 *     columns: [klucze pól | "#axis:<rodzaj>"], sort: { key, dir }, positions: { id: { x, y } },
 *     matrix: { rows: grupowanie, cols: grupowanie } }
 * </code>
 *
 * 2026-10-22 (Schritt 10) — <b>Macierz</b>: Zeilen und Spalten sind zwei
 * Gruppierungen, ein Feld hält, was zu beiden gehört. 2026-10-23 (Schritt 5):
 * eine Achse ist ein RODZAJ (`selection.ts`, `Axis`) — 20 Tajemnice × 12
 * Obszary, nach einem Feld geordnet, unter Überschriften (część, grupa); ein
 * Eintrag gehört zu einem Wert, wenn er über ein Verweisfeld auf ihn zeigt
 * (direkt oder über einen Schritt). Themen gibt es nicht mehr. <b>Mapa</b>:
 * die Einträge im Nebel des Lernens (aus „Mapa wiedzy"). Eine Spalte kann eine
 * Achse sein (`#axis:<rodzaj>`): die Werte, auf die der Eintrag zeigt. Und ein
 * Widok wird eine Powtórka (`viewToRevision`) — dieselben Schritte als Knoten.
 *
 * Gezeigt wird er in „Wpisy" (`EntityList.tsx`) und auf einer Seite (der
 * Baustein „Widok", `pages/parts/view.tsx`). Die alte Gestalt (bis Schritt 9:
 * `kind` + `rule`) wird gelesen und als Schritte verstanden; geschrieben wird
 * die neue.
 */

import { readGraph, type Graph } from './graph';
import { fieldsOf, fieldText, labelOf, valuesOf, type Entity, type FieldDef, type KindDef, type Lookup } from './schema';
import {
  axisMembers, groupsOf, readGrouping, readRule, readSteps, runSteps, isSource, wasTopicGrouping, RETIRED_STEP, RETIRED_TOPIC,
  type Group, type Grouping, type RuleGroup, type SelectContext, type Step
} from './selection';

/** 2026-10-24 — `outline` (Struktura): die Einträge mit dem, wohin ihre „Idź po odwołaniu"-Schritte führen, als ein lesbares Ganzes (`viewOutline`). */
export type ListMode = 'table' | 'tree' | 'canvas' | 'matrix' | 'map' | 'outline';

/** Zeilen und Spalten einer Macierz. */
export interface MatrixDef {
  readonly rows: Grouping;
  readonly cols: Grouping;
}

export interface ViewDoc {
  readonly name: string;
  readonly mode: ListMode;
  readonly steps: readonly Step[];
  readonly query: string;
  readonly group: Grouping | null;
  readonly columns: readonly string[];
  readonly sort: { readonly key: string; readonly dir: 1 | -1 } | null;
  readonly positions: Readonly<Record<string, { x: number; y: number }>>;
  readonly matrix: MatrixDef | null;
  /** 2026-10-23 (Schritt 5) — was dieser Widok nach Tematy tat und nicht mehr tut: Hinweise für den Autor und die Seite. */
  readonly retired: readonly string[];
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
  const matrixRaw = isObject(d.matrix) ? d.matrix : {};
  const retired = [
    ...(steps.some((st) => st.config[RETIRED_STEP] === 'source.topic') ? [RETIRED_TOPIC] : []),
    ...(wasTopicGrouping(d.group) ? ['Drzewo grupowało według tematów — tematów już nie ma. Wybierz oś (rodzaj) albo pole.'] : []),
    ...(wasTopicGrouping(matrixRaw.rows) || wasTopicGrouping(matrixRaw.cols) ? ['Macierz miała osie z tematów — tematów już nie ma. Wybierz osie: rodzaje (np. Tajemnica × Obszar).'] : [])
  ];
  return {
    name: typeof d.name === 'string' ? d.name : 'Widok',
    mode: d.mode === 'tree' || d.mode === 'canvas' || d.mode === 'matrix' || d.mode === 'map' || d.mode === 'outline' ? d.mode : 'table',
    steps,
    query: typeof d.query === 'string' ? d.query : '',
    group: readGrouping(d.group),
    columns: Array.isArray(d.columns) ? d.columns.filter((c): c is string => typeof c === 'string') : [],
    sort,
    positions,
    matrix: readMatrix(d.matrix),
    retired
  };
}

function readMatrix(raw: unknown): MatrixDef | null {
  if (!isObject(raw)) return null;
  const rows = readGrouping(raw.rows);
  const cols = readGrouping(raw.cols);
  return rows === null || cols === null ? null : { rows, cols };
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
    positions: view.positions,
    ...(view.matrix === null ? {} : { matrix: view.matrix })
  };
}

/** Die schnelle Wahl „Rodzaj": `''` alles, eine Art — oder `null`: die Quelle ist eine andere (Zbiór, Lista, Z wpisu). */
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
  /** 2026-10-23 — die Rodzaje mit ihren Einträgen (auch der Quellen): die möglichen Achsen. */
  readonly materialKinds: readonly KindDef[];
  material(kindId: string): readonly Entity[];
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
  return groupsOf(lib.selectContext(), list.map((e) => e.id), view.group ?? { by: 'kind' });
}

export interface ViewColumn {
  readonly key: string;
  readonly label: string;
}

export const AXIS_COLUMN = '#axis:';

/** Was in einer Zelle steht: ein Feld in Worten — oder die Werte einer Achse (eines Rodzaj), auf die der Eintrag zeigt. */
export function cellText(lib: ViewLib, e: Entity, key: string): string {
  if (key === '_label') return lib.label(e);
  if (key.startsWith(AXIS_COLUMN)) {
    const ctx = lib.selectContext();
    const kind = key.slice(AXIS_COLUMN.length);
    const values = new Set(lib.material(kind).map((v) => v.id));
    return axisMembers(ctx, e, { kind, via: [] }, values).map((id) => { const v = ctx.entity(id); return v === undefined ? '' : labelOf(v, lib.look); }).filter(Boolean).join(', ');
  }
  const f = fieldsOf(e, lib.look).find((x) => x.key === key);
  return f === undefined ? '' : fieldText(e, f, lib.look);
}

/** Die Spalten: die gewählten (Felder und Achsen) — sonst die ersten vier Felder (ohne Fliesstext) der Einträge. */
export function viewColumns(lib: ViewLib, view: ViewDoc, list: readonly Entity[]): ViewColumn[] {
  const fields = new Map<string, FieldDef>();
  for (const e of list.slice(0, 200)) for (const f of fieldsOf(e, lib.look)) if (!fields.has(f.key)) fields.set(f.key, f);
  if (view.columns.length > 0) {
    return view.columns.flatMap((key): ViewColumn[] => {
      if (key.startsWith(AXIS_COLUMN)) {
        const kind = lib.materialKinds.find((k) => k.id === key.slice(AXIS_COLUMN.length));
        return kind === undefined ? [] : [{ key, label: kind.name }];
      }
      const f = fields.get(key);
      return f === undefined ? [] : [{ key, label: f.label }];
    });
  }
  return [...fields.values()].filter((f) => f.type !== 'markup' && f.type !== 'text' && f.type !== 'blocks' && f.type !== 'media').slice(0, 4).map((f) => ({ key: f.key, label: f.label }));
}

/* -- Macierz ------------------------------------------------------------------------------------- */

export interface Matrix {
  readonly rows: readonly Group[];
  readonly cols: readonly Group[];
  /** Was in einem Feld steht — Zeile und Spalte nach ihrem Schlüssel. */
  readonly cell: (row: string, col: string) => readonly string[];
}

/** Ein Feld in der Adresse: `<zeile>~<spalte>`. */
export const cellKey = (row: string, col: string): string => `${row}~${col}`;

/**
 * DIE MACIERZ: Zeilen und Spalten nach ihren Gruppierungen — eine Achse mit
 * ALLEN ihren Werten (auch leeren: 20 × 12 bleibt 20 × 12), ein Feld mit den
 * Werten, die vorkommen; was in keine passt, zuletzt.
 */
export function viewMatrix(lib: ViewLib, view: ViewDoc, list: readonly Entity[]): Matrix | null {
  if (view.matrix === null) return null;
  const ctx = lib.selectContext();
  const ids = list.map((e) => e.id);
  const rows = groupsOf(ctx, ids, view.matrix.rows, { all: true });
  const cols = groupsOf(ctx, ids, view.matrix.cols, { all: true });
  const colSets = new Map(cols.map((c) => [c.key, new Set(c.ids)]));
  const cells = new Map<string, string[]>();
  for (const r of rows) for (const c of cols) cells.set(cellKey(r.key, c.key), r.ids.filter((id) => colSets.get(c.key)!.has(id)));
  return { rows, cols, cell: (row, col) => cells.get(cellKey(row, col)) ?? [] };
}

/* -- Ein Widok wird eine Powtórka, eine Powtórka ein Widok ------------------------------------------- */

/**
 * DIESELBEN SCHRITTE ALS KNOTEN: die Quellen am Anfang (mehrere über
 * „Razem"), dann „Idź po odwołaniu" und „Filtr wpisów", zuletzt ein „Sposób
 * pytania" (nach dem, was ich umiem). „Ucz się tego widoku".
 */
export function viewToRevision(view: ViewDoc): Record<string, unknown> {
  const nodes: { id: string; type: string; x: number; y: number; config: Readonly<Record<string, unknown>> }[] = [];
  const edges: { id: string; from: string; out: string; to: string; in: string }[] = [];
  const link = (from: string, to: string) => edges.push({ id: `e${edges.length + 1}`, from, out: 'cards', to, in: 'cards' });
  const sources = [];
  let at = 0;
  while (at < view.steps.length && isSource(view.steps[at].type)) { sources.push(view.steps[at]); at += 1; }
  sources.forEach((step, i) => nodes.push({ id: `s${i + 1}`, type: step.type, x: 40, y: 40 + i * 120, config: step.config }));
  let last = 's1';
  if (sources.length > 1) {
    nodes.push({ id: 'u', type: 'union', x: 300, y: 40, config: {} });
    sources.forEach((_, i) => link(`s${i + 1}`, 'u'));
    last = 'u';
  }
  for (const [i, step] of view.steps.slice(at).entries()) {
    const id = `k${i + 1}`;
    nodes.push({ id, type: isSource(step.type) ? 'filter.rule' : step.type, x: 560 + i * 260, y: 40, config: isSource(step.type) ? {} : step.config });
    link(last, id);
    last = id;
  }
  nodes.push({ id: 'plan', type: 'strategy', x: 560 + (view.steps.length - at) * 260, y: 40, config: { mode: 'temporal', stackSize: 20 } });
  link(last, 'plan');
  return { name: `Powtórka: ${view.name}`, graph: { nodes, edges } };
}

/**
 * Und zurück: welche Einträge eine Powtórka wählt, als Schritte (für die
 * Umstellung von „Mapa wiedzy" auf den Widok). Die Quellen werden zusammen
 * genommen, „Idź po odwołaniu" und „Filtr wpisów" in der Reihenfolge ihrer
 * Kanten; was nur Karten betrifft (Vorlage, Richtung, Stand, Sperre), fällt weg.
 */
export function stepsOfRevision(raw: unknown): Step[] {
  const graph: Graph = readGraph(raw);
  const sources = graph.nodes.filter((n) => isSource(n.type)).map((n): Step => ({ type: n.type as Step['type'], config: n.config }));
  const chain: Step[] = [];
  const seen = new Set<string>();
  const next = (from: readonly string[]): string[] => graph.edges.filter((e) => from.includes(e.from)).map((e) => e.to);
  let frontier = graph.nodes.filter((n) => isSource(n.type)).map((n) => n.id);
  for (let depth = 0; depth < 20 && frontier.length > 0; depth += 1) {
    const nodes = next(frontier).filter((id) => !seen.has(id));
    for (const id of nodes) {
      seen.add(id);
      const node = graph.nodes.find((n) => n.id === id);
      if (node !== undefined && (node.type === 'follow' || node.type === 'filter.rule')) chain.push({ type: node.type, config: node.config });
    }
    frontier = nodes;
  }
  return [...(sources.length === 0 ? [{ type: 'source.all' as const, config: {} }] : sources), ...chain];
}

/** 2026-10-23 (Schritt 5) — die Rodzaje, die eine Achse sein können: die mit Einträgen (eigene und der Quellen), ohne Pytanie. */
export function axesOf(lib: ViewLib): KindDef[] {
  return lib.materialKinds.filter((k) => k.id !== 'question' && lib.material(k.id).length > 0);
}

/* -- 2026-10-24: Struktura — ein Eintrag mit dem, worauf er zeigt, als ein Ganzes ----------------------- */

export interface OutlineGroup {
  /** Wie der Weg heisst: das Feld („Argumenty za") oder, rückwärts, „← Komentarz". */
  readonly label: string;
  readonly nodes: readonly OutlineNode[];
}

export interface OutlineNode {
  readonly id: string;
  readonly groups: readonly OutlineGroup[];
  /** Schon weiter oben auf diesem Weg — nicht noch einmal aufgeklappt. */
  readonly again?: true;
}

/**
 * DIE STRUKTUR EINES WIDOKS: die Einträge seiner Quellen (alles vor dem ersten „Idź po
 * odwołaniu") als Wurzeln; jeder weitere Schritt „Idź po odwołaniu" ist eine Ebene darunter,
 * nach Feldern gruppiert. So zeigt ein Widok über „Komentarz biblijny → Komentarz → wszystkie
 * odwołania" den Fragment, den Komentarz und darunter seine Argumenty za und Zarzuty. Was
 * gewählt wird, sagen die Schritte; dass es so erscheint, sagt nur der Modus.
 */
export function viewOutline(lib: ViewLib, view: ViewDoc, limit = 50): { roots: OutlineNode[]; more: boolean } {
  const ctx = lib.selectContext();
  const cut = view.steps.findIndex((step) => step.type === 'follow');
  const roots = viewList(lib, cut < 0 ? view : { ...view, steps: view.steps.slice(0, cut) });
  const follows = cut < 0 ? [] : view.steps.slice(cut).filter((step) => step.type === 'follow');
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const grow = (id: string, depth: number, path: ReadonlySet<string>): OutlineNode => {
    const step = follows[depth];
    const entity = ctx.entity(id);
    if (step === undefined || entity === undefined) return { id, groups: [] };
    const field = str(step.config.field);
    const groups: OutlineGroup[] = [];
    const add = (label: string, ids: readonly string[]) => {
      const unique = [...new Set(ids)].filter((x) => x !== id && ctx.entity(x) !== undefined);
      if (unique.length === 0) return;
      groups.push({ label, nodes: unique.map((x) => (path.has(x) ? { id: x, groups: [], again: true } : grow(x, depth + 1, new Set([...path, x])))) });
    };
    if (step.config.back === true) {
      const pointers = [...ctx.pointing(id)].map((x) => ctx.entity(x)).filter((e): e is Entity => e !== undefined);
      const byField = new Map<string, string[]>();
      for (const pointer of pointers) {
        for (const f of fieldsOf(pointer, ctx.look)) {
          if (f.type !== 'ref' || (field !== '' && f.key !== field)) continue;
          if (!valuesOf(pointer, f).some((v) => v.value === id)) continue;
          const label = `← ${f.label}`;
          byField.set(label, [...(byField.get(label) ?? []), pointer.id]);
        }
      }
      for (const [label, ids] of byField) add(label, ids);
    } else {
      for (const f of fieldsOf(entity, ctx.look)) {
        if (f.type !== 'ref' || (field !== '' && f.key !== field)) continue;
        add(f.label, valuesOf(entity, f).map((v) => v.value).filter((v): v is string => typeof v === 'string'));
      }
    }
    return { id, groups };
  };
  return { roots: roots.slice(0, limit).map((e) => grow(e.id, 0, new Set([e.id]))), more: roots.length > limit };
}
