/**
 * COGITA — FORMULARZE DODAWANIA (COGITA.md §2.4), 2026-10-17.
 *
 * <b>Wozu.</b> Wer eine lange Liste Wörter, Übersetzungen, Daten einträgt,
 * will nicht jeden Eintrag einzeln öffnen, die Sprache wählen, das Thema
 * wählen, speichern, dann die Übersetzung anlegen und beide Wörter darin
 * suchen. Ein Formular sagt einmal, was aus EINER Zeile wird — und dann tippt
 * man nur noch: „car" Enter „samochód" Enter, nächste Zeile.
 *
 * <b>Ein Formular ist ein Graph</b> auf dem Modell von `graph.ts` (Knoten,
 * Anschlüsse, Kanten, JSON), mit zwei Arten von Knoten:
 *
 * <code>
 *   pick    „Na początek" — ein vorhandener Eintrag (Sprache, Thema), oben einmal
 *           gewählt; er bleibt für alle Zeilen, bis man ihn ändert
 *   entry   „W każdym wierszu" — ein Eintrag eines Rodzaj, der aus jeder Zeile
 *           entsteht (oder gefunden wird); je Feld, woher der Wert kommt:
 *             type    in der Zeile getippt
 *             ask     oben einmal gesetzt (wie ein Wahl-Knoten, nur für ein Feld)
 *             fixed   fest im Formular
 *           Verweisfelder sind Eingänge: eine Kante von einem Knoten füllt sie
 * </code>
 *
 * <b>Mehrere in einer Zeile.</b> Ein Knoten mit `many` nimmt mehrere Werte in
 * einer Zeile („car", „automobile" ↔ „samochód"). Ein Verweisfeld, das EINEN
 * Eintrag nimmt, macht dann einen Eintrag je Wert (jede Paarung: 2 × 1 = 2
 * Übersetzungen); eines, das mehrere nimmt, nimmt alle in einen.
 *
 * <b>Doppelt wird nichts.</b> Ein Eintrag, den es schon gibt — gleich in den
 * Feldern, an denen man ihn erkennt (Vorgabe: die einfachen Felder, die das
 * Formular setzt: Text und Sprache) —, wird benutzt statt neu angelegt; was
 * ihm fehlt (ein weiteres Thema), wird ergänzt. Das gilt auch innerhalb
 * derselben Liste: „zamek" (Schloss) und „zamek" (Burg) werden ein Wort mit
 * zwei Übersetzungen. Darum ist auch ein zweiter Versuch nach einem Fehler
 * harmlos.
 *
 * <b>Rein</b>: geplant wird hier, gespeichert in `store.ts` (`saveMany`), gezeigt
 * in `AddFormEditor.tsx` (bauen) und `AddFormRun.tsx` (ausfüllen).
 */

import { ANY, graphJson, order, paletteOf, readGraph, type Graph, type GraphEdge, type GraphNode, type Palette, type Ports } from './graph';
import {
  dateKey, parseRange, patternKeys, readDate, readNumber, readTyped, valuesOf,
  type Entity, type FieldDef, type KindDef, type Lookup
} from './schema';

/* -- Wörterbücher ------------------------------------------------------------------- */

export const KEY_ACTIONS = ['next', 'more', 'save', 'newline', 'none'] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number];

export const KEY_ACTION_LABEL: Record<KeyAction, string> = {
  next: 'następne pole (w ostatnim — zapisz wiersz)',
  more: 'kolejna wartość w tym samym miejscu',
  save: 'zapisz wiersz i zacznij następny',
  newline: 'nowa linia (w dłuższym tekście)',
  none: 'nic'
};

/** Kurz, für die Zeile unter dem Formular. */
export const KEY_ACTION_SHORT: Record<KeyAction, string> = {
  next: 'dalej', more: 'kolejna wartość tutaj', save: 'zapisz wiersz', newline: 'nowa linia', none: '—'
};

export interface KeyMap {
  readonly enter: KeyAction;
  readonly ctrlEnter: KeyAction;
  readonly shiftEnter: KeyAction;
}

export const KEY_NAMES: readonly (readonly [keyof KeyMap, string])[] = [['enter', 'Enter'], ['ctrlEnter', 'Ctrl+Enter'], ['shiftEnter', 'Shift+Enter']];

export const DEFAULT_KEYS: KeyMap = { enter: 'next', ctrlEnter: 'more', shiftEnter: 'save' };

/** Woran die Spalten einer eingefügten Liste getrennt sind. `auto`: am häufigsten Zeichen erkannt. */
export const COLUMN_SEPARATORS = ['auto', 'tab', ';', '=', ' - ', '|', ','] as const;
export type ColumnSeparator = (typeof COLUMN_SEPARATORS)[number];

export const COLUMN_SEPARATOR_LABEL: Record<ColumnSeparator, string> = {
  auto: 'rozpoznaj samo', tab: 'tabulator (z arkusza)', ';': 'średnik ;', '=': 'znak =', ' - ': 'myślnik –', '|': 'kreska |', ',': 'przecinek ,'
};

/** Woran mehrere Werte in einer Zelle getrennt sind („car, automobile"). */
export const VALUE_SEPARATORS = [',', ';', '/', '|'] as const;
export type ValueSeparator = (typeof VALUE_SEPARATORS)[number];

export const VALUE_SEPARATOR_LABEL: Record<ValueSeparator, string> = { ',': 'przecinek ,', ';': 'średnik ;', '/': 'ukośnik /', '|': 'kreska |' };

export interface PasteRule {
  readonly columns: ColumnSeparator;
  readonly values: ValueSeparator;
  /** Die erste Zeile sind Überschriften. */
  readonly header: boolean;
}

export const DEFAULT_PASTE: PasteRule = { columns: 'auto', values: ',', header: false };

export type SourceMode = 'type' | 'ask' | 'fixed';

export const SOURCE_LABEL: Record<SourceMode, string> = {
  type: 'wpisywane w każdym wierszu',
  ask: 'ustawiane na początek',
  fixed: 'stała wartość'
};

export interface FieldSource {
  readonly from: SourceMode;
  /** `ask`: was voreingestellt ist; `fixed`: der Wert — als Text, wie man ihn tippt. */
  readonly value?: string;
}

export type Reuse = 'same' | 'never';

export interface EntryConfig {
  readonly kind: string;
  /** Wie der Knoten im Formular heisst („angielski") — sonst der Name des Rodzaj. */
  readonly label?: string;
  /** Mehrere in einer Zeile. */
  readonly many: boolean;
  /** Je Feld (ohne Verweise — die kommen über Kanten), woher der Wert kommt. */
  readonly fields: Readonly<Record<string, FieldSource>>;
  /** `same`: einen gleichen vorhandenen benutzen · `never`: immer neu. */
  readonly reuse: Reuse;
  /** Woran man einen vorhandenen erkennt; fehlt: die einfachen Felder, die der Knoten setzt. */
  readonly identity?: readonly string[];
}

export interface PickConfig {
  readonly label?: string;
  /** Welche Rodzaje wählbar sind — leer: jeder. */
  readonly kinds: readonly string[];
  readonly many: boolean;
  /** Darf leer bleiben. */
  readonly optional: boolean;
  /** Was voreingestellt ist. */
  readonly value: readonly string[];
}

export interface AddForm {
  readonly id: string;
  readonly name: string;
  /** Ein Satz für die, die ausfüllen. */
  readonly says?: string;
  readonly graph: Graph;
  readonly keys: KeyMap;
  readonly paste: PasteRule;
}

/** Was man in einer Zeile tippen kann — Verweise kommen über Kanten, Dateien nicht aus einer Zeile. */
const TYPEABLE: ReadonlySet<string> = new Set(['line', 'text', 'markup', 'number', 'date', 'bool', 'choice', 'url', 'list', 'geo', 'range']);
export const isTypeable = (field: FieldDef): boolean => TYPEABLE.has(field.type);

/** Mehrzeilig — dort darf Enter eine neue Zeile sein. */
export const isLong = (field: FieldDef): boolean => field.type === 'text' || field.type === 'markup' || field.type === 'list';

/* -- Lesen und Schreiben ---------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);
const pickOf = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export function entryConfig(raw: unknown): EntryConfig {
  const c = isObject(raw) ? raw : {};
  const fields: Record<string, FieldSource> = {};
  if (isObject(c.fields)) {
    for (const [key, one] of Object.entries(c.fields)) {
      if (!isObject(one) || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) continue;
      const from = pickOf(['type', 'ask', 'fixed'] as const, one.from, 'type');
      const value = str(one.value);
      fields[key] = value === '' ? { from } : { from, value: value.slice(0, 2000) };
    }
  }
  const identity = strings(c.identity);
  return {
    kind: str(c.kind).trim(),
    ...(str(c.label).trim() === '' ? {} : { label: str(c.label).trim().slice(0, 80) }),
    many: c.many === true,
    fields,
    reuse: c.reuse === 'never' ? 'never' : 'same',
    ...(Array.isArray(c.identity) ? { identity } : {})
  };
}

export function pickConfig(raw: unknown): PickConfig {
  const c = isObject(raw) ? raw : {};
  return {
    ...(str(c.label).trim() === '' ? {} : { label: str(c.label).trim().slice(0, 80) }),
    kinds: strings(c.kinds),
    many: c.many === true,
    optional: c.optional === true,
    value: strings(c.value)
  };
}

export function readKeys(raw: unknown): KeyMap {
  const k = isObject(raw) ? raw : {};
  return {
    enter: pickOf(KEY_ACTIONS, k.enter, DEFAULT_KEYS.enter),
    ctrlEnter: pickOf(KEY_ACTIONS, k.ctrlEnter, DEFAULT_KEYS.ctrlEnter),
    shiftEnter: pickOf(KEY_ACTIONS, k.shiftEnter, DEFAULT_KEYS.shiftEnter)
  };
}

export function readPaste(raw: unknown): PasteRule {
  const p = isObject(raw) ? raw : {};
  return {
    columns: pickOf(COLUMN_SEPARATORS, p.columns, DEFAULT_PASTE.columns),
    values: pickOf(VALUE_SEPARATORS, p.values, DEFAULT_PASTE.values),
    header: p.header === true
  };
}

/**
 * Ein Formular aus seinem Dokument. Es fällt weg: ein Knoten anderer Art,
 * eine Kante, die nicht von einem Knoten in den Verweis eines Eintrags führt,
 * und alles, was einen Kreis schlösse (`readGraph`).
 */
export function readAddForm(id: string, raw: unknown): AddForm {
  const d = isObject(raw) ? raw : {};
  const read = readGraph(d.graph);
  const nodes = read.nodes.filter((n) => n.type === 'entry' || n.type === 'pick');
  const types = new Map(nodes.map((n) => [n.id, n.type]));
  const edges = read.edges.filter((e) => types.has(e.from) && types.get(e.to) === 'entry' && e.out === 'out');
  return {
    id,
    name: str(d.name).trim().slice(0, 120) || 'Formularz dodawania',
    ...(str(d.says).trim() === '' ? {} : { says: str(d.says).trim().slice(0, 1000) }),
    graph: { nodes, edges },
    keys: readKeys(d.keys),
    paste: readPaste(d.paste)
  };
}

/** Das Dokument eines Formulars — was in seinem Eintrag steht. */
export function addFormDoc(form: AddForm): Record<string, unknown> {
  return {
    name: form.name,
    ...(form.says === undefined ? {} : { says: form.says }),
    graph: graphJson(form.graph),
    keys: form.keys,
    paste: form.paste
  };
}

/**
 * Die Rodzaje und gewählten Einträge eines Formulars umgeschrieben — für das
 * JSON (`@kennung` hinaus) und den Import (zurück zu Kennungen dieser Baza).
 */
export function mapFormRefs(graph: unknown, kind: (id: string) => string | null, entity: (id: string) => string | null): Record<string, unknown> {
  const g = graphJson(readGraph(graph));
  const nodes = (g.nodes as GraphNode[]).map((n) => {
    const c: Record<string, unknown> = { ...n.config };
    if (typeof c.kind === 'string') { const k = kind(c.kind); if (k === null) delete c.kind; else c.kind = k; }
    if (Array.isArray(c.kinds)) c.kinds = strings(c.kinds).map(kind).filter((k): k is string => k !== null);
    if (Array.isArray(c.value)) c.value = strings(c.value).map(entity).filter((e): e is string => e !== null);
    return { ...n, config: c };
  });
  return { nodes, edges: g.edges };
}

/* -- Anschlüsse ------------------------------------------------------------------------ */

/** Ein Anschluss trägt den Rodzaj, wenn es genau einer ist — sonst passt er zu allem. */
const portType = (kinds: readonly string[] | undefined): string => (kinds !== undefined && kinds.length === 1 ? `kind:${kinds[0]}` : ANY);

export const refFields = (kind: KindDef | undefined): FieldDef[] => (kind?.fields ?? []).filter((f) => f.type === 'ref');

/**
 * Wie ein Knoten heisst: sein Name, sonst sein Rodzaj. Eine Wahl ohne Namen,
 * die nur EINEN Eintrag speist, heisst nach ihm — „Język — angielski" folgt
 * so von selbst, wenn man den Eintrag umbenennt.
 */
export function nodeLabel(node: GraphNode, look: Pick<Lookup, 'kind'>, graph?: Graph): string {
  if (node.type === 'pick') {
    const c = pickConfig(node.config);
    if (c.label !== undefined) return c.label;
    const kinds = c.kinds.map((k) => look.kind(k)?.name ?? k).join(' / ') || 'Wybór';
    const fed = [...new Set((graph?.edges ?? []).filter((e) => e.from === node.id).map((e) => e.to))];
    const target = fed.length === 1 ? graph!.nodes.find((n) => n.id === fed[0]) : undefined;
    return target === undefined || target.type !== 'entry' ? kinds : `${kinds} — ${nodeLabel(target, look)}`;
  }
  const c = entryConfig(node.config);
  return c.label ?? look.kind(c.kind)?.name ?? 'Wpis';
}

/**
 * DIE PALETTE: was ein Knoten an Anschlüssen hat. Ein Eintrag hat einen
 * Eingang je Verweisfeld seines Rodzaj (mehrere Kanten, wo das Feld mehrere
 * Werte nimmt) und einen Ausgang — sich selbst. Eine Wahl hat nur den Ausgang.
 */
export function formPalette(look: Pick<Lookup, 'kind'>): Palette<null> {
  const entryPorts = (config: Readonly<Record<string, unknown>>): Ports => {
    const c = entryConfig(config);
    const kind = look.kind(c.kind);
    return {
      inputs: refFields(kind).map((f) => ({ id: f.key, label: f.label, type: portType(f.to), many: f.multi })),
      outputs: [{ id: 'out', label: c.label ?? kind?.name ?? 'Wpis', type: portType(c.kind === '' ? undefined : [c.kind]) }]
    };
  };
  return paletteOf<null>('addform', [
    {
      type: 'pick', label: 'Na początek', group: 'Na początek',
      says: 'Istniejący wpis (język, temat) wybrany raz u góry — zostaje dla wszystkich wierszy, dopóki go nie zmienisz.',
      ports: (config) => ({ inputs: [], outputs: [{ id: 'out', label: pickConfig(config).label ?? 'Wybór', type: portType(pickConfig(config).kinds) }] }),
      run: () => ({})
    },
    {
      type: 'entry', label: 'W każdym wierszu', group: 'W każdym wierszu',
      says: 'Wpis, który powstaje z każdego wiersza (albo zostaje użyty, jeśli taki już jest).',
      ports: entryPorts,
      run: () => ({})
    }
  ]);
}

/* -- Was getippt und was oben gewählt wird --------------------------------------------------- */

/** Die Felder eines Knotens, die man in der Zeile tippt — in der Reihenfolge des Rodzaj. */
export function typedFields(kind: KindDef | undefined, c: EntryConfig): FieldDef[] {
  return (kind?.fields ?? []).filter((f) => c.fields[f.key]?.from === 'type' && isTypeable(f));
}

export interface FormGroup {
  readonly node: string;
  readonly label: string;
  readonly kind: KindDef;
  readonly fields: readonly FieldDef[];
  readonly many: boolean;
}

/**
 * WAS IN EINER ZEILE STEHT: je Knoten mit getippten Feldern eine Gruppe — in
 * der Reihenfolge der Leinwand, von links nach rechts, in einer Spalte von oben.
 */
export function groupsOf(form: AddForm, look: Pick<Lookup, 'kind'>): FormGroup[] {
  const placed = form.graph.nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.type === 'entry');
  placed.sort((a, b) => Math.round(a.n.x / 120) - Math.round(b.n.x / 120) || a.n.y - b.n.y || a.i - b.i);
  const out: FormGroup[] = [];
  for (const { n } of placed) {
    const c = entryConfig(n.config);
    const kind = look.kind(c.kind);
    const fields = typedFields(kind, c);
    if (kind === undefined || fields.length === 0) continue;
    out.push({ node: n.id, label: nodeLabel(n, look, form.graph), kind, fields, many: c.many });
  }
  return out;
}

export type TopItem =
  | { readonly type: 'pick'; readonly key: string; readonly node: string; readonly label: string; readonly config: PickConfig }
  | { readonly type: 'ask'; readonly key: string; readonly node: string; readonly label: string; readonly field: FieldDef; readonly value: string };

/** WAS OBEN STEHT: die Wahlen (von oben nach unten auf der Leinwand), dann die einmal gesetzten Felder. */
export function topOf(form: AddForm, look: Pick<Lookup, 'kind'>): TopItem[] {
  const nodes = [...form.graph.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const picks: TopItem[] = nodes.filter((n) => n.type === 'pick')
    .map((n) => ({ type: 'pick', key: n.id, node: n.id, label: nodeLabel(n, look, form.graph), config: pickConfig(n.config) }));
  const asks: TopItem[] = [];
  for (const n of nodes) {
    if (n.type !== 'entry') continue;
    const c = entryConfig(n.config);
    for (const f of look.kind(c.kind)?.fields ?? []) {
      const source = c.fields[f.key];
      if (source?.from === 'ask' && isTypeable(f)) asks.push({ type: 'ask', key: `${n.id}.${f.key}`, node: n.id, label: `${nodeLabel(n, look, form.graph)}: ${f.label}`, field: f, value: source.value ?? '' });
    }
  }
  return [...picks, ...asks];
}

/** Eine getippte Stelle: Feld → Text. */
export type Instance = Readonly<Record<string, string>>;
/** Eine Zeile: je Knoten seine Werte (einer, oder mehrere bei `many`). */
export type RowInput = Readonly<Record<string, readonly Instance[]>>;

/** Was oben gewählt ist — die Wahlen (Kennungen) und die einmal gesetzten Felder (Text), nach `TopItem.key`. */
export interface TopChoice {
  readonly picks: Readonly<Record<string, readonly string[]>>;
  readonly asks: Readonly<Record<string, string>>;
}

export const rowIsEmpty = (row: RowInput): boolean =>
  !Object.values(row).some((list) => list.some((one) => Object.values(one).some((t) => t.trim() !== '')));

/* -- Getippt → Wert ----------------------------------------------------------------------- */

const one = (field: FieldDef, text: string): { value: unknown } | { error: string } => {
  switch (field.type) {
    case 'line':
    case 'url':
      return { value: text.replace(/\s+/g, ' ') };
    case 'text':
    case 'markup':
      return { value: text };
    case 'number': {
      const n = readNumber(text);
      return n === null ? { error: `„${text}" to nie liczba` } : { value: n };
    }
    case 'date': {
      const d = readDate(text);
      return d === null ? { error: `„${text}" to nie data (rok, 1999-05 albo 1999-05-03)` } : { value: dateKey(d) };
    }
    case 'bool': {
      const b = readTyped(field, text);
      return b === undefined ? { error: `„${text}": wpisz tak, nie albo nie wiadomo` } : { value: b };
    }
    case 'choice': {
      const c = readTyped(field, text);
      return c === undefined ? { error: `„${text}": do wyboru jest ${(field.options ?? []).map((o) => o.label).join(', ')}` } : { value: c };
    }
    case 'list':
      return { value: text.split(/\s*[;\n]\s*/).map((x) => x.trim()).filter(Boolean) };
    case 'geo': {
      const m = /^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/.exec(text);
      const lat = m === null ? null : Number(m[1].replace(',', '.'));
      const lon = m === null ? null : Number(m[2].replace(',', '.'));
      return lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180 ? { error: `„${text}": wpisz szerokość i długość, np. 50.06, 19.94` } : { value: { lat, lon } };
    }
    case 'range': {
      const r = parseRange(text, field.rangeOf ?? 'number');
      return r === null ? { error: `„${text}": zakres jak 992–1000, 1002–1025` } : { value: r };
    }
    default:
      return { error: 'tego pola nie da się wpisać' };
  }
};

/**
 * WAS GETIPPT WURDE, ALS WERT DES FELDES. Ein Feld mit mehreren Werten nimmt
 * „a; b" als zwei; eine Liste ist ein Wert aus Stücken.
 */
export function typedValue(field: FieldDef, text: string): { value: unknown } | { error: string } {
  const t = text.trim();
  if (field.multi && field.type !== 'list') {
    const out: unknown[] = [];
    for (const part of t.split(/\s*[;\n]\s*/).filter(Boolean)) {
      const v = one(field, part);
      if ('error' in v) return v;
      out.push(v.value);
    }
    return { value: out };
  }
  return one(field, t);
}

/* -- Erkennen ---------------------------------------------------------------------------- */

const norm = (v: unknown): string =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);

/** Die Werte eines geplanten Feldes, gleich ob einer oder mehrere. */
const plannedValues = (field: FieldDef, raw: unknown): unknown[] =>
  raw === undefined || raw === null ? [] : field.type === 'list' ? [raw] : Array.isArray(raw) ? raw : [raw];

const existingValues = (entity: Entity, field: FieldDef): unknown[] =>
  valuesOf(entity, field).map((v) => v.value).filter((v) => v !== null);

const keyOf = (fields: readonly FieldDef[], valuesFor: (f: FieldDef) => unknown[]): string =>
  fields.map((f) => `${f.key}=${[...new Set(valuesFor(f).map(norm))].sort().join('\u0001')}`).join('\u0002');

/** Welche Felder ein Knoten setzt: getippt, oben gesetzt, fest — und die Verweise, in die eine Kante führt. */
export function fieldsSet(form: AddForm, node: GraphNode, kind: KindDef): FieldDef[] {
  const c = entryConfig(node.config);
  const wired = new Set(form.graph.edges.filter((e) => e.to === node.id).map((e) => e.in));
  return kind.fields.filter((f) => (f.type === 'ref' ? wired.has(f.key) : c.fields[f.key] !== undefined && isTypeable(f)));
}

/** Woran ein vorhandener Eintrag erkannt wird — gewählt, sonst die einfachen Felder, die der Knoten setzt. */
export function identityOf(form: AddForm, node: GraphNode, kind: KindDef): FieldDef[] {
  const c = entryConfig(node.config);
  const set = fieldsSet(form, node, kind);
  if (c.identity !== undefined) return set.filter((f) => c.identity!.includes(f.key));
  const single = set.filter((f) => !f.multi);
  return single.length > 0 ? single : set;
}

/* -- Planen ------------------------------------------------------------------------------- */

export interface PlanCtx {
  readonly look: Lookup;
  /** Die vorhandenen Einträge eines Rodzaj — dort wird gesucht, bevor ein neuer entsteht. */
  readonly pool: (kind: string) => readonly Entity[];
  /** Gehört er dieser Baza wiedzy (und darf ergänzt werden)? */
  readonly isOwn: (id: string) => boolean;
  readonly newId: () => string;
}

export interface PlannedEntry {
  readonly id: string;
  readonly kinds: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly isNew: boolean;
  readonly node: string;
  /** Wie weit hinten im Graphen — gespeichert wird von vorn (Wörter vor Übersetzungen). */
  readonly depth: number;
}

export interface Made {
  readonly node: string;
  readonly id: string;
  /** In diesem Plan neu angelegt. */
  readonly isNew: boolean;
  /** Ein vorhandener, dem etwas ergänzt wird. */
  readonly changed: boolean;
}

export interface RowPlan {
  readonly made: readonly Made[];
  /** Knoten, die in dieser Zeile nichts machen — und warum. */
  readonly skipped: readonly { readonly node: string; readonly why: string }[];
  /** Was die Zeile verhindert (ein „abc" im Zahlenfeld): sie wird dann ganz ausgelassen. */
  readonly problems: readonly string[];
  readonly empty: boolean;
}

export interface FormPlan {
  /** Was zu speichern ist — neue Einträge und ergänzte vorhandene, von vorn nach hinten. */
  readonly saves: readonly PlannedEntry[];
  readonly rows: readonly RowPlan[];
  /** Was das ganze Formular verhindert (keine Sprache gewählt). */
  readonly problems: readonly string[];
}

/** Mehr Einträge eines Knotens in einer Zeile gelten als Versehen (z. B. 20 × 20 Paarungen). */
export const MAX_PER_NODE = 100;

/** Wie tief ein Knoten liegt: eine Wahl 0, ein Eintrag 1 + der tiefste, auf den er zeigt. */
function depths(graph: Graph, sequence: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of sequence) {
    const before = graph.edges.filter((e) => e.to === id).map((e) => out.get(e.from) ?? 0);
    const node = graph.nodes.find((n) => n.id === id);
    out.set(id, node?.type === 'pick' ? 0 : 1 + Math.max(0, ...before));
  }
  return out;
}

/** Ergänzen: was ein Feld mit mehreren Werten noch nicht hat, und ein leeres einfaches Feld. */
function mergeData(fields: readonly FieldDef[], had: Readonly<Record<string, unknown>>, current: (f: FieldDef) => unknown[], want: Readonly<Record<string, unknown>>): Record<string, unknown> | null {
  const changes: Record<string, unknown> = {};
  for (const f of fields) {
    const wanted = plannedValues(f, want[f.key]);
    if (wanted.length === 0) continue;
    const have = current(f);
    if (f.multi && f.type !== 'list') {
      const seen = new Set(have.map(norm));
      const extra = wanted.filter((v) => !seen.has(norm(v)));
      if (extra.length === 0) continue;
      const raw = had[f.key];
      const list = Array.isArray(raw) ? [...raw] : raw === undefined || raw === null ? [] : [raw];
      changes[f.key] = [...list, ...extra];
    } else if (have.length === 0) {
      changes[f.key] = want[f.key];
    }
  }
  return Object.keys(changes).length === 0 ? null : { ...had, ...changes };
}

/**
 * DER PLAN: was aus diesen Zeilen wird, bei dieser Wahl oben — ohne etwas zu
 * speichern. Eine Zeile mit einem Fehler (ein Wert passt nicht in sein Feld)
 * fällt ganz weg, die anderen bleiben.
 */
export function planForm(form: AddForm, ctx: PlanCtx, rows: readonly RowInput[], top: TopChoice): FormPlan {
  const { look } = ctx;
  const problems: string[] = [];
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  const sequence = order(form.graph);
  if (sequence === null) return { saves: [], rows: rows.map(() => ({ made: [], skipped: [], problems: [], empty: true })), problems: ['Formularz ma koło — popraw go w Schemacie.'] };
  const depth = depths(form.graph, sequence);
  const position = new Map(form.graph.nodes.map((n, i) => [n.id, { x: n.x, y: n.y, i }]));

  /* Oben: die Wahlen, die einmal gesetzten Felder, die festen Werte. */
  const picked = new Map<string, string[]>();
  const unpicked: string[] = [];
  for (const node of [...form.graph.nodes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (node.type !== 'pick') continue;
    const c = pickConfig(node.config);
    let chosen = [...new Set(top.picks[node.id] ?? c.value)].filter((id) => look.entity(id) !== undefined);
    if (!c.many) chosen = chosen.slice(0, 1);
    if (chosen.length === 0 && !c.optional) unpicked.push(nodeLabel(node, look, form.graph));
    picked.set(node.id, chosen);
  }
  if (unpicked.length > 0) problems.push(`Wybierz na początek: ${unpicked.join(', ')}.`);
  const constant = new Map<string, Record<string, unknown>>();
  for (const node of form.graph.nodes) {
    if (node.type !== 'entry') continue;
    const c = entryConfig(node.config);
    const kind = look.kind(c.kind);
    if (kind === undefined) { problems.push(`„${nodeLabel(node, look, form.graph)}": nie ma już takiego rodzaju.`); continue; }
    const values: Record<string, unknown> = {};
    for (const f of kind.fields) {
      const source = c.fields[f.key];
      if (source === undefined || source.from === 'type' || !isTypeable(f)) continue;
      const text = (source.from === 'ask' ? top.asks[`${node.id}.${f.key}`] ?? source.value : source.value) ?? '';
      if (text.trim() === '') continue;
      const v = typedValue(f, text);
      if ('error' in v) problems.push(`${nodeLabel(node, look, form.graph)}: ${f.label} — ${v.error}.`);
      else values[f.key] = v.value;
    }
    constant.set(node.id, values);
  }
  if (problems.length > 0) return { saves: [], rows: rows.map((row) => ({ made: [], skipped: [], problems: [], empty: rowIsEmpty(row) })), problems };

  /* Was schon da ist — je Rodzaj und Erkennungsmerkmal einmal aufgeschrieben. */
  const committed = new Map<string, PlannedEntry>();
  const indexes = new Map<string, Map<string, string>>();
  const indexFor = (kind: KindDef, identity: readonly FieldDef[]): Map<string, string> => {
    const name = `${kind.id}|${identity.map((f) => f.key).join(',')}`;
    let index = indexes.get(name);
    if (index === undefined) {
      index = new Map();
      for (const e of ctx.pool(kind.id)) {
        const key = keyOf(identity, (f) => existingValues(e, f));
        const had = index.get(key);
        /* Gleich zweimal da: der eigene geht vor dem aus einer Quelle. */
        if (had === undefined || (!ctx.isOwn(had) && ctx.isOwn(e.id))) index.set(key, e.id);
      }
      for (const p of committed.values()) {
        if (p.isNew && p.kinds.includes(kind.id)) index.set(keyOf(identity, (f) => plannedValues(f, p.data[f.key])), p.id);
      }
      indexes.set(name, index);
    }
    return index;
  };

  const out: RowPlan[] = [];
  for (const row of rows) {
    if (rowIsEmpty(row)) { out.push({ made: [], skipped: [], problems: [], empty: true }); continue; }
    /* Eine Zeile wird erst übernommen, wenn sie ganz geht: bis dahin liegt alles auf der Seite. */
    const stage = new Map<string, PlannedEntry>();
    const stageIndex: [Map<string, string>, string, string][] = [];
    const outputs = new Map<string, string[]>();
    const made: Made[] = [];
    const skipped: { node: string; why: string }[] = [];
    const rowProblems: string[] = [];

    for (const id of sequence) {
      const node = byId.get(id)!;
      if (node.type === 'pick') { outputs.set(id, picked.get(id) ?? []); continue; }
      const c = entryConfig(node.config);
      const kind = look.kind(c.kind)!;
      const label = nodeLabel(node, look, form.graph);
      const typed = typedFields(kind, c);

      /* Was in der Zeile für diesen Knoten getippt wurde. */
      let combos: Record<string, unknown>[] = [];
      if (typed.length > 0) {
        for (const inst of row[id] ?? []) {
          if (typed.every((f) => (inst[f.key] ?? '').trim() === '')) continue;
          const data: Record<string, unknown> = {};
          for (const f of typed) {
            const text = (inst[f.key] ?? '').trim();
            if (text === '') continue;
            const v = typedValue(f, text);
            if ('error' in v) { rowProblems.push(`${label}: ${f.label} — ${v.error}.`); continue; }
            data[f.key] = v.value;
          }
          combos.push(data);
        }
        if (!c.many) combos = combos.slice(0, 1);
        if (combos.length === 0) { outputs.set(id, []); continue; }
      } else {
        combos = [{}];
      }
      const fixed = constant.get(id) ?? {};
      combos = combos.map((data) => ({ ...fixed, ...data }));

      /* Die Verweise: aus den Wahlen und den Einträgen dieser Zeile. */
      let missing: string | null = null;
      for (const field of refFields(kind)) {
        const edges = form.graph.edges.filter((e) => e.to === id && e.in === field.key).sort((a, b) => {
          const pa = position.get(a.from)!;
          const pb = position.get(b.from)!;
          return pa.y - pb.y || pa.x - pb.x || pa.i - pb.i;
        });
        if (edges.length === 0) continue;
        /*
          Ein Eintrag der Zeile, der fehlt, verhindert diesen — auch in einem Feld,
          das mehrere nimmt: eine Übersetzung aus „Word 1" und „Word 2" braucht
          beide, sonst wäre sie die Übersetzung eines einzigen Wortes.
        */
        const absent = edges.filter((e) => byId.get(e.from)?.type === 'entry' && (outputs.get(e.from) ?? []).length === 0);
        if (absent.length > 0) { missing = absent.map((e) => nodeLabel(byId.get(e.from)!, look, form.graph)).join(', '); break; }
        const values = [...new Set(edges.flatMap((e) => outputs.get(e.from) ?? []))];
        if (values.length === 0) continue;
        combos = field.multi
          ? combos.map((data) => ({ ...data, [field.key]: values }))
          : combos.flatMap((data) => values.map((v) => ({ ...data, [field.key]: v })));
      }
      if (missing !== null) { skipped.push({ node: id, why: `brak: ${missing}` }); outputs.set(id, []); continue; }
      if (combos.length > MAX_PER_NODE) { rowProblems.push(`${label}: wyszłoby ${combos.length} wpisów z jednego wiersza — sprawdź „kilka w wierszu".`); outputs.set(id, []); continue; }

      /* Jeden je Kombination: vorhanden, schon geplant, oder neu. */
      const identity = c.reuse === 'never' ? [] : identityOf(form, node, kind);
      const set = fieldsSet(form, node, kind);
      const ids: string[] = [];
      for (const data of combos) {
        let found: string | undefined;
        let index: Map<string, string> | undefined;
        let key = '';
        if (identity.length > 0) {
          index = indexFor(kind, identity);
          key = keyOf(identity, (f) => plannedValues(f, data[f.key]));
          found = stageIndex.find(([ix, k]) => ix === index && k === key)?.[2] ?? index.get(key);
        }
        if (found === undefined) {
          const fresh: PlannedEntry = { id: ctx.newId(), kinds: [kind.id], data, isNew: true, node: id, depth: depth.get(id) ?? 1 };
          stage.set(fresh.id, fresh);
          if (index !== undefined) stageIndex.push([index, key, fresh.id]);
          made.push({ node: id, id: fresh.id, isNew: true, changed: false });
          if (!ids.includes(fresh.id)) ids.push(fresh.id);
          continue;
        }
        const planned = stage.get(found) ?? committed.get(found);
        const entity = planned === undefined ? look.entity(found) : undefined;
        const merged = planned !== undefined
          ? mergeData(set, planned.data, (f) => plannedValues(f, planned.data[f.key]), data)
          : entity !== undefined && ctx.isOwn(found) ? mergeData(set, entity.data, (f) => existingValues(entity, f), data) : null;
        if (merged !== null) {
          const base = planned ?? { id: found, kinds: entity!.kinds, data: entity!.data, isNew: false, node: id, depth: depth.get(id) ?? 1 };
          stage.set(found, { ...base, data: merged });
        }
        made.push({ node: id, id: found, isNew: planned?.isNew === true, changed: merged !== null && planned?.isNew !== true });
        if (!ids.includes(found)) ids.push(found);
      }
      outputs.set(id, ids);
    }

    if (rowProblems.length > 0) { out.push({ made: [], skipped: [], problems: rowProblems, empty: false }); continue; }
    for (const [id, entry] of stage) committed.set(id, entry);
    for (const [index, key, id] of stageIndex) index.set(key, id);
    out.push({ made, skipped, problems: [], empty: false });
  }

  const saves = [...committed.values()].sort((a, b) => a.depth - b.depth);
  return { saves, rows: out, problems };
}

/* -- Eine eingefügte Liste ------------------------------------------------------------------ */

export interface PastedList {
  readonly rows: readonly RowInput[];
  /** Woran getrennt wurde (erkannt oder gewählt) — `''`: eine Spalte. */
  readonly separator: string;
  /** Zeilen mit mehr Spalten als das Formular hat (der Rest steht in der letzten). */
  readonly wide: number;
}

const SPLIT_CANDIDATES = ['\t', ' – ', ' — ', ' - ', ';', '=', '|', ','];

/** Woran die Spalten getrennt sind: das erste Zeichen, das in den meisten Zeilen steht. */
export function detectSeparator(lines: readonly string[]): string {
  for (const sep of SPLIT_CANDIDATES) {
    if (lines.length > 0 && lines.filter((l) => l.includes(sep)).length >= Math.ceil(lines.length * 0.6)) return sep;
  }
  return '\t';
}

/**
 * EINE LISTE AUS EINEM ARBEITSBLATT ODER TEXT: eine Zeile je Zeile des
 * Formulars, die Spalten in der Reihenfolge seiner getippten Felder. In einer
 * Zelle trennt das Wertzeichen mehrere Werte — nur dort, wo der Knoten
 * mehrere in einer Zeile nimmt.
 */
export function parsePaste(text: string, groups: readonly FormGroup[], rule: PasteRule): PastedList {
  let lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');
  if (rule.header) lines = lines.slice(1);
  const columns = groups.flatMap((g) => g.fields.map((f) => ({ g, f })));
  const separator = columns.length <= 1 ? '' : rule.columns === 'auto' ? detectSeparator(lines) : rule.columns === 'tab' ? '\t' : rule.columns;
  const splitValues = separator.trim() !== rule.values;
  let wide = 0;
  const rows = lines.map((line): RowInput => {
    let cells = separator === '' ? [line] : line.split(separator);
    if (cells.length > columns.length) {
      wide += 1;
      cells = [...cells.slice(0, columns.length - 1), cells.slice(columns.length - 1).join(separator)];
    }
    const row: Record<string, Instance[]> = {};
    let at = 0;
    for (const g of groups) {
      const parts = g.fields.map(() => {
        const cell = (cells[at++] ?? '').trim();
        if (!g.many || !splitValues) return [cell];
        return cell.split(rule.values).map((x) => x.trim()).filter(Boolean);
      });
      const count = Math.max(1, ...parts.map((p) => p.length));
      row[g.node] = Array.from({ length: count }, (_, k) => Object.fromEntries(g.fields.map((f, i) => [f.key, parts[i][k] ?? ''])));
    }
    return row;
  });
  return { rows, separator, wide };
}

/* -- Was das Formular falsch beschreibt --------------------------------------------------------- */

export function formProblems(form: AddForm, look: Pick<Lookup, 'kind'>): string[] {
  const out: string[] = [];
  const entries = form.graph.nodes.filter((n) => n.type === 'entry');
  if (entries.length === 0) out.push('Dodaj co najmniej jeden wpis „w każdym wierszu".');
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  let typed = 0;
  for (const node of entries) {
    const c = entryConfig(node.config);
    const kind = look.kind(c.kind);
    if (kind === undefined) { out.push(`„${nodeLabel(node, look, form.graph)}": wybierz rodzaj.`); continue; }
    typed += typedFields(kind, c).length;
    const incoming = form.graph.edges.filter((e) => e.to === node.id);
    if (typedFields(kind, c).length === 0 && !incoming.some((e) => byId.get(e.from)?.type === 'entry')) {
      out.push(`„${nodeLabel(node, look, form.graph)}" nie bierze niczego z wiersza — powstałby jeden taki sam wpis dla każdego wiersza.`);
    }
    for (const e of incoming) {
      const field = kind.fields.find((f) => f.key === e.in);
      const from = byId.get(e.from);
      if (field === undefined || field.type !== 'ref' || from === undefined) { out.push(`„${nodeLabel(node, look, form.graph)}": połączenie prowadzi do pola, którego już nie ma.`); continue; }
      const sourceKinds = from.type === 'pick' ? pickConfig(from.config).kinds : [entryConfig(from.config).kind];
      const to = field.to ?? [];
      if (to.length > 0 && sourceKinds.length > 0 && !sourceKinds.some((k) => to.includes(k))) {
        out.push(`„${nodeLabel(from, look, form.graph)}" nie pasuje do pola „${field.label}" (przyjmuje: ${to.map((k) => look.kind(k)?.name ?? k).join(', ')}).`);
      }
      if (!field.multi && from.type === 'pick' && pickConfig(from.config).many) {
        out.push(`„${nodeLabel(from, look, form.graph)}" może mieć kilka wpisów, a pole „${field.label}" przyjmuje jeden — powstanie osobny wpis dla każdego.`);
      }
    }
    for (const [key, source] of Object.entries(c.fields)) {
      const field = kind.fields.find((f) => f.key === key);
      if (field !== undefined && !isTypeable(field) && field.type !== 'ref') out.push(`„${nodeLabel(node, look, form.graph)}": pola „${field.label}" nie da się ${source.from === 'type' ? 'wpisywać' : 'ustawić'} w formularzu.`);
    }
  }
  if (entries.length > 0 && typed === 0) out.push('Żadne pole nie jest wpisywane w wierszu — nie byłoby czego dodawać.');
  if (order(form.graph) === null) out.push('Formularz ma koło.');
  return out;
}

/* -- Was das Formular tut, in Worten ------------------------------------------------------------ */

const quote = (text: string) => `„${text}"`;

/**
 * DIE BESCHREIBUNG — im Editor unter dem Graphen, beim Ausfüllen unter
 * „Jak działa ten formularz". Sie entsteht aus dem Formular selbst und ist
 * darum nie veraltet.
 */
export function describeForm(form: AddForm, look: Pick<Lookup, 'kind'>): string[] {
  const out: string[] = [];
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  const top = topOf(form, look);
  const picks = top.filter((t): t is Extract<TopItem, { type: 'pick' }> => t.type === 'pick');
  const asks = top.filter((t): t is Extract<TopItem, { type: 'ask' }> => t.type === 'ask');
  if (picks.length > 0) {
    out.push(`Na początek wybierasz: ${picks.map((p) => {
      const kinds = p.config.kinds.map((k) => look.kind(k)?.name ?? k).join(' / ');
      const more = [kinds, p.config.many ? 'kilka' : '', p.config.optional ? 'można pominąć' : ''].filter(Boolean).join('; ');
      return `${quote(p.label)}${more === '' ? '' : ` (${more})`}`;
    }).join(', ')}. Wybór zostaje dla wszystkich wierszy, dopóki go nie zmienisz.`);
  }
  if (asks.length > 0) out.push(`Na początek ustawiasz: ${asks.map((a) => `${a.label}${a.value === '' ? '' : ` (domyślnie: ${a.value})`}`).join(', ')}.`);
  const groups = groupsOf(form, look);
  if (groups.length > 0) {
    out.push(`W każdym wierszu wpisujesz: ${groups.map((g) => `${quote(g.label)} — ${g.fields.map((f) => f.label).join(', ')}${g.many ? ' (kilka)' : ''}`).join('; ')}.`);
  }
  const sequence = order(form.graph) ?? form.graph.nodes.map((n) => n.id);
  for (const id of sequence) {
    const node = byId.get(id);
    if (node === undefined || node.type !== 'entry') continue;
    const c = entryConfig(node.config);
    const kind = look.kind(c.kind);
    if (kind === undefined) continue;
    const parts: string[] = [];
    for (const f of kind.fields) {
      const source = c.fields[f.key];
      if (f.type === 'ref') {
        const from = form.graph.edges.filter((e) => e.to === id && e.in === f.key).map((e) => byId.get(e.from)).filter((n): n is GraphNode => n !== undefined);
        if (from.length > 0) parts.push(`${f.label} ← ${from.map((n) => quote(nodeLabel(n, look, form.graph))).join(' + ')}`);
      } else if (source !== undefined && isTypeable(f)) {
        parts.push(source.from === 'type' ? `${f.label} — wpisane` : source.from === 'ask' ? `${f.label} — z początku` : `${f.label} = ${source.value ?? ''}`);
      }
    }
    const pairs = refFields(kind).filter((f) => !f.multi && form.graph.edges.some((e) => e.to === id && e.in === f.key && entryConfig(byId.get(e.from)?.config).many && byId.get(e.from)?.type === 'entry'));
    const needs = [...new Set(form.graph.edges.filter((e) => e.to === id && byId.get(e.from)?.type === 'entry').map((e) => quote(nodeLabel(byId.get(e.from)!, look, form.graph))))];
    const identity = c.reuse === 'never' ? [] : identityOf(form, node, kind);
    const sentence = [
      `${quote(nodeLabel(node, look, form.graph))} (${kind.name}): ${parts.join('; ') || 'bez pól'}.`,
      c.many ? 'Kilka w jednym wierszu.' : '',
      pairs.length > 0 ? `Po jednym dla każdej pary (${pairs.map((f) => f.label).join(', ')} przyjmuje jeden wpis).` : '',
      needs.length > 0 ? `Powstaje tylko, gdy w wierszu jest ${needs.join(' i ')}.` : '',
      identity.length > 0 ? `Jeśli taki już jest (to samo: ${identity.map((f) => f.label).join(', ')}), zostaje użyty, a brakujące wartości są dopisane.` : 'Zawsze powstaje nowy.'
    ].filter(Boolean).join(' ');
    out.push(sentence);
  }
  out.push(`Klawisze: ${KEY_NAMES.map(([key, name]) => `${name} — ${KEY_ACTION_LABEL[form.keys[key]]}`).join('; ')}.`);
  const columns = groups.flatMap((g) => g.fields.map((f) => (g.fields.length > 1 ? `${g.label}: ${f.label}` : g.label)));
  if (columns.length > 0) {
    const sep = columns.length > 1 ? ` — kolumny: ${columns.join(' | ')}, oddzielone: ${COLUMN_SEPARATOR_LABEL[form.paste.columns]}` : '';
    const many = groups.some((g) => g.many) ? `; kilka wartości w komórce oddziel znakiem ${quote(form.paste.values)}` : '';
    out.push(`Wklejanie listy: jedna linia to jeden wiersz${sep}${many}.`);
  }
  return out;
}

/* -- Ein Formular aus einem Rodzaj ------------------------------------------------------------- */

/**
 * Die Felder, die man von einem Rodzaj tippt: die seines Etiketts, die man
 * tippen kann. Ein Rodzaj, dessen Etikett nur aus Verweisen besteht (eine
 * Übersetzung: „{z}"), tippt man nicht — er VERBINDET.
 */
export function defaultTyped(kind: KindDef): FieldDef[] {
  const inLabel = new Set(patternKeys(kind.label));
  const typed = kind.fields.filter((f) => inLabel.has(f.key) && isTypeable(f));
  if (typed.length > 0) return typed;
  if (kind.fields.some((f) => f.type === 'ref' && inLabel.has(f.key))) return [];
  return kind.fields.filter(isTypeable).slice(0, 1);
}

/**
 * EIN ANFANG AUS EINEM RODZAJ: ein Rodzaj, den man tippt (Słowo), bekommt
 * seine Verweise als Wahlen oben (Język, Temat). Einer, der verbindet
 * (Tłumaczenie: z → Słowo, na → Słowo), bekommt für jeden Verweis einen
 * Eintrag je Zeile — und deren Verweise als Wahlen oben: getrennt, wo das
 * Feld EINEN Eintrag nimmt (die Sprache von „z" ist nicht die von „na"),
 * gemeinsam, wo es mehrere nimmt (Themen).
 */
export function formFromKind(root: KindDef, look: Pick<Lookup, 'kind'>, makeId: () => string): { name: string; graph: Graph } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const fieldsOfConfig = (typed: readonly FieldDef[]) => Object.fromEntries(typed.map((f) => [f.key, { from: 'type' }]));
  const add = (type: 'entry' | 'pick', x: number, y: number, config: Record<string, unknown>): string => {
    const id = makeId();
    nodes.push({ id, type, x, y, config });
    return id;
  };
  const link = (from: string, to: string, field: string) => edges.push({ id: makeId(), from, out: 'out', to, in: field });
  const target = (f: FieldDef): KindDef | undefined => (f.to !== undefined && f.to.length === 1 ? look.kind(f.to[0]) : undefined);
  const shared = new Map<string, string>();
  let pickY = 0;
  /* Pflicht ist eine Wahl nur, wo das Feld genau EINEN Eintrag eines bestimmten Rodzaj nimmt (die Sprache). */
  const pickFor = (f: FieldDef, ownerLabel: string | null): string => {
    const kinds = f.to ?? [];
    const share = `${f.key}|${kinds.join(',')}`;
    if (f.multi && shared.has(share)) return shared.get(share)!;
    /* Eine Wahl je Zeilen-Eintrag bleibt ohne Namen: sie heisst nach ihm („Język — angielski", `nodeLabel`). */
    const named = f.multi || ownerLabel === null ? { label: f.label } : {};
    const id = add('pick', 0, pickY, { ...named, kinds: [...kinds], many: f.multi, optional: f.multi || target(f) === undefined, value: [] });
    pickY += 110;
    if (f.multi) shared.set(share, id);
    return id;
  };
  const rootTyped = defaultTyped(root);
  if (rootTyped.length > 0) {
    const id = add('entry', 340, 0, { kind: root.id, many: false, reuse: 'same', fields: fieldsOfConfig(rootTyped) });
    for (const f of refFields(root)) if (target(f)?.id !== root.id) link(pickFor(f, null), id, f.key);
    return { name: `Dodawanie: ${root.name}`, graph: { nodes, edges } };
  }
  const rootId = add('entry', 680, 0, { kind: root.id, many: false, reuse: 'same', fields: {} });
  let childY = 0;
  for (const f of refFields(root)) {
    const kind = target(f);
    if (kind === undefined || kind.id === root.id || defaultTyped(kind).length === 0) {
      link(pickFor(f, null), rootId, f.key);
      continue;
    }
    /* Ein Feld, das mehrere nimmt, verbindet mindestens zwei: eine Übersetzung zwei Wörter („Word 1", „Word 2"); weitere fügt man im Editor hinzu. */
    const copies = f.multi ? 2 : 1;
    for (let n = 1; n <= copies; n += 1) {
      const label = copies === 1 ? f.label : `${f.label} ${n}`;
      const child = add('entry', 340, childY, { kind: kind.id, label, many: false, reuse: 'same', fields: fieldsOfConfig(defaultTyped(kind)) });
      childY += 220;
      link(child, rootId, f.key);
      for (const g of refFields(kind)) if (target(g)?.id !== kind.id) link(pickFor(g, label), child, g.key);
    }
  }
  /* Der verbindende Eintrag steht in der Mitte seiner Zeilen-Einträge. */
  const at = nodes.findIndex((n) => n.id === rootId);
  nodes[at] = { ...nodes[at], y: Math.max(0, (childY - 220) / 2) };
  /*
    Die Wahlen oben stehen, wie die Leinwand sie zeigt — darum hier geordnet:
    erst die eines einzelnen Eintrags (die Sprache von „z", dann die von „na"),
    dann die gemeinsamen (Themen).
  */
  const fed = (id: string) => edges.filter((e) => e.from === id).map((e) => nodes.find((n) => n.id === e.to)?.y ?? 0);
  const picks = nodes.filter((n) => n.type === 'pick').sort((a, b) =>
    (fed(a.id).length === 1 ? 0 : 1) - (fed(b.id).length === 1 ? 0 : 1) || Math.min(...fed(a.id)) - Math.min(...fed(b.id)));
  picks.forEach((p, i) => { nodes[nodes.indexOf(p)] = { ...p, y: i * 110 }; });
  return { name: `Dodawanie: ${root.name}`, graph: { nodes, edges } };
}

/* -- Noch einer wie dieser, und die Reihenfolge darunter -------------------------------------- */

/** „Word" → „Word 2", „Word 2" → „Word 3": die nächste freie Nummer unter den Namen, die es gibt. */
export function nextLabel(label: string, taken: readonly string[]): string {
  const base = label.replace(/\s+\d+$/, '');
  let top = 1;
  for (const one of taken) {
    const rest = one.startsWith(`${base} `) ? one.slice(base.length + 1) : null;
    if (rest !== null && /^\d+$/.test(rest)) top = Math.max(top, Number(rest));
  }
  return `${base} ${top + 1}`;
}

/**
 * NOCH EINER WIE DIESER — die nächste Sprache: derselbe Rodzaj mit denselben
 * Feldern und einem freien Namen. Eine Wahl oben, die nur ihn speiste (seine
 * Sprache), bekommt der neue als eigene, leer; eine gemeinsame (Themen) speist
 * beide. Wohin er zeigte, zeigt der neue auch — dort, wo das Feld mehrere nimmt
 * (eine Übersetzung aus mehreren Wörtern); ein Feld für EINEN ist schon besetzt.
 */
export function duplicateEntry(graph: Graph, nodeId: string, look: Pick<Lookup, 'kind'>, makeId: () => string): { graph: Graph; id: string } | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (node === undefined || node.type !== 'entry') return null;
  const id = makeId();
  const label = nextLabel(nodeLabel(node, look), graph.nodes.filter((n) => n.type === 'entry').map((n) => nodeLabel(n, look)));
  const below = Math.max(...graph.nodes.filter((n) => Math.abs(n.x - node.x) < 120).map((n) => n.y)) + 220;
  const nodes: GraphNode[] = [...graph.nodes, { ...node, id, y: below, config: { ...node.config, label } }];
  const edges: GraphEdge[] = [...graph.edges];
  for (const e of graph.edges.filter((x) => x.to === nodeId)) {
    const from = graph.nodes.find((n) => n.id === e.from);
    if (from === undefined) continue;
    const own = from.type === 'pick' && graph.edges.every((x) => x.from !== from.id || x.to === nodeId);
    if (!own) { edges.push({ id: makeId(), from: e.from, out: e.out, to: id, in: e.in }); continue; }
    const pickId = makeId();
    const named = pickConfig(from.config).label;
    const taken = nodes.filter((n) => n.type === 'pick').map((n) => nodeLabel(n, look, { nodes, edges }));
    nodes.push({
      ...from, id: pickId, y: Math.max(0, ...nodes.filter((n) => n.type === 'pick').map((n) => n.y)) + 110,
      config: { ...from.config, value: [], ...(named === undefined ? {} : { label: nextLabel(named, taken) }) }
    });
    edges.push({ id: makeId(), from: pickId, out: 'out', to: id, in: e.in });
  }
  for (const e of graph.edges.filter((x) => x.from === nodeId)) {
    const target = graph.nodes.find((n) => n.id === e.to);
    const field = target === undefined ? undefined : refFields(look.kind(entryConfig(target.config).kind)).find((f) => f.key === e.in);
    if (field?.multi === true) edges.push({ id: makeId(), from: id, out: 'out', to: e.to, in: e.in });
  }
  return { graph: { nodes, edges }, id };
}

/** Wie die Knoten unter der Leinwand stehen: die Wahlen wie oben beim Ausfüllen, die Einträge wie in der Zeile (die verbindenden danach). */
export function designOrder(form: AddForm): { readonly picks: readonly GraphNode[]; readonly entries: readonly GraphNode[] } {
  const placed = form.graph.nodes.map((n, i) => ({ n, i }));
  return {
    picks: placed.filter(({ n }) => n.type === 'pick').sort((a, b) => a.n.y - b.n.y || a.n.x - b.n.x || a.i - b.i).map(({ n }) => n),
    entries: placed.filter(({ n }) => n.type === 'entry')
      .sort((a, b) => Math.round(a.n.x / 120) - Math.round(b.n.x / 120) || a.n.y - b.n.y || a.i - b.i).map(({ n }) => n)
  };
}
