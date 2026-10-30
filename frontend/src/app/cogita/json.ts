/**
 * COGITA ALS JSON — hinaus und herein, mit Beschreibung und einem Auftrag
 * für die eigene KI (COGITA.md §14, [P13, F34, B12]).
 *
 * <code>
 *   recreatio.cogita.course     alles: Schema, Vorlagen, Einträge, Wiederholungen, Abläufe, Zbiory, Wygląd, Zasady, Wartości
 *   recreatio.cogita.schema     Rodzaje, ihre Kartenvorlagen und Formularze dodawania — als unabhängige Kopie für eine andere Bibliothek [B12]
 *   recreatio.cogita.entities   Einträge (auch Aussagen — Rodzaje mit Feld blocks — und Pytania)
 *   recreatio.cogita.flow       ein Ablauf MIT dem, was er zeigt [F34]
 * </code>
 *
 * <b>Verweise mit `@name`</b>: ein Eintrag trägt `ref` („@dawid"), ein Feld
 * verweist mit `"@dawid"` darauf — so lässt sich ein Dokument schreiben (von
 * Hand oder von einer KI), ohne Kennungen zu kennen. Rodzaje werden an ihrer
 * Kennung erkannt, an der eingebauten (`person`, `knowledge` …) oder an ihrem
 * Namen. Der Import ändert Bestehendes an Ort und Stelle und löscht nichts.
 *
 * <b>Die KI bleibt draussen</b>: die App ruft keine KI. Sie gibt einen
 * Auftrag zum Kopieren; was zurückkommt, wird hier geprüft, gezeigt und erst
 * dann gespeichert.
 */

import { newId } from '../core/ids';
import { plural } from '../core/plural';
import { addFormDoc, COLUMN_SEPARATORS, KEY_ACTIONS, mapFormRefs, readAddForm, VALUE_SEPARATORS } from './addForm';
import { readTemplate } from './cards';
import { migratePrerequisites, readFlow } from './flow';
import { graphJson, readGraph, type Graph, type GraphNode } from './graph';
import { migrateRevision } from './revision';
import { DOC_KINDS, DOC_LABEL, isBaseKind, kindDoc, QUESTION, type DocKind } from './kinds';
import { QUESTION_SHARED, QUESTION_TYPES, SHOW_MAX } from './questionTypes';
import { anchorData, readAnchor } from './anchors';
import { FIELD_TYPE_LABEL, FIELD_TYPES, fieldsOf, labelOf, readKind, valuesOf, type Entity, type FieldDef, type KindDef, type Lookup } from './schema';
import { childrenOf, isStructured, parentsOf, placeOf, rootsAbove, structureFields, structureTree, type StructNode, type StructureSource } from './structure';
import type { CogitaLibrary } from './store';
import { AXIS_COLUMN, readView, viewJson } from './views';
import { quantitiesDescription } from '../core/quantities';
import { THESIS_LIMIT } from '../library/blocks';

export const COURSE_FORMAT = 'recreatio.cogita.course';
export const SCHEMA_FORMAT = 'recreatio.cogita.schema';
export const ENTITIES_FORMAT = 'recreatio.cogita.entities';
export const FLOW_FORMAT = 'recreatio.cogita.flow';

/** Unter welchem Namen eine Art Dokumente im JSON steht. */
const LIST_OF: Record<DocKind, string> = {
  kind: 'kinds', template: 'templates', revision: 'revisions', flow: 'flows', look: 'looks', rules: 'rules',
  values: 'values', collection: 'collections', view: 'views', settings: 'settings', merge: 'merges', contribution: 'contributions',
  addform: 'forms',
  /* 2026-10-25 (Wywód) — die Wejścia z Biblioteki: Werk und Stellen → Eintrag und Widok. */
  anchor: 'anchors'
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/* -- Hinaus ---------------------------------------------------------------------------- */

/**
 * 2026-10-25 — DER NAME EINES EIGENEN EINTRAGS IM JSON: sein bleibender Name aus einem Import
 * (`_ref`, etwa `kowalski2020/pytanie`), sonst seine Kennung. So lässt sich ein Export wieder
 * einlesen — auch in einer anderen Baza — und ändert dort beim zweiten Mal dieselben Einträge.
 */
const nameIn = (lib: CogitaLibrary) => (id: string): string => {
  const r = lib.isOwn(id) ? lib.entry(id)?.data._ref : undefined;
  return typeof r === 'string' && r !== '' ? r : id;
};

/** Ein Eintrag als JSON: sein Name als `ref`, Verweise als `@name`. */
function entityJson(lib: CogitaLibrary, entity: Entity): Record<string, unknown> {
  const name = nameIn(lib);
  return {
    ref: `@${name(entity.id)}`,
    kinds: entity.kinds.map((k) => (isBaseKind(k) ? k : lib.kind(k)?.name ?? k)),
    data: refsOut(lib, entity, name)
  };
}

function refsOut(lib: CogitaLibrary, entity: Entity, name: (id: string) => string = (id) => id): Record<string, unknown> {
  const fields = new Map(lib.kinds.flatMap((k) => k.fields).map((f) => [f.key, f]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity.data)) {
    const field = fields.get(key);
    if (field?.type !== 'ref') { out[key] = value; continue; }
    const swap = (one: unknown): unknown => (typeof one === 'string' && one !== '' ? `@${name(one)}` : isObject(one) && typeof one.value === 'string' ? { ...one, value: `@${name(one.value)}` } : one);
    out[key] = Array.isArray(value) ? value.map(swap) : swap(value);
  }
  return out;
}

/**
 * 2026-10-25 — KENNUNGEN EIGENER EINTRÄGE, RODZAJE UND DOKUMENTE gehen als `@name` hinaus (der
 * bleibende Name oder die Kennung) — in Widokach, Vorlagen, Powtórki, Przebiegi, Zbiory, Formularzen:
 * beim Import in eine andere Baza werden sie deren Kennungen. Eingebaute Rodzaje, Werke der
 * Bibliothek und alles andere bleiben, wie sie sind. (2026-10-19: so schon der Rodzaj in „Wpisy rodzaju".)
 */
const idsOut = (lib: CogitaLibrary, name: (id: string) => string) => {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v !== '' && !v.startsWith('@') && !isBaseKind(v) && lib.isOwn(v) ? `@${name(v)}` : v;
    if (Array.isArray(v)) return v.map(walk);
    if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk;
};

/** Ein Graf hinaus: die Knoten mit `@name` statt eigener Kennungen. */
const graphOut = (graph: Graph, walk: (v: unknown) => unknown): Record<string, unknown> => {
  const g = graphJson(graph);
  return { ...g, nodes: (g.nodes as GraphNode[]).map((n) => ({ ...n, config: walk(n.config) as GraphNode['config'] })) };
};

/** Ohne die Buchhaltung mit `_` (der bleibende Name steht im `ref`). */
const plainData = (data: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !key.startsWith('_')));

const docJson = (lib: CogitaLibrary, kind: DocKind, id: string, data: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const name = nameIn(lib);
  const walk = idsOut(lib, name);
  const { public: _public, ...rest } = plainData(data);
  if (kind === 'addform') return formJson(lib, id, data);
  /* 2026-10-25 (Wywód) — ein Wejście: sein Eintrag und sein Widok unter ihren Namen, das Werk unter seiner Kennung. */
  if (kind === 'anchor') {
    const a = readAnchor(id, data);
    const { _ref: lastingRef, ...plain } = anchorData(a) as Record<string, unknown> & { _ref?: string };
    return {
      ref: `@${typeof data._ref === 'string' && data._ref !== '' ? data._ref : id}`, ...plain,
      ...(a.entry === '' ? {} : { entry: `@${name(a.entry)}` }), ...(a.view === '' ? {} : { view: `@${name(a.view)}` }), work: `@${a.work}`
    };
  }
  /* 2026-10-22 (Schritt 9) — ein Widok geht immer in der neuen Gestalt hinaus (Schritte statt Art und Filter); 2026-10-25: seine Schritte mit `@name`. */
  if (kind === 'view') {
    const v = viewJson(readView(data));
    /* Auch die Gruppen und Achsen (Rodzaje, die Liste einer Ordnung) und Spalten „#axis:<rodzaj>". */
    const axis = (c: unknown): unknown => (typeof c === 'string' && c.startsWith(AXIS_COLUMN) && lib.isOwn(c.slice(AXIS_COLUMN.length)) ? `${AXIS_COLUMN}@${name(c.slice(AXIS_COLUMN.length))}` : c);
    return {
      ref: `@${name(id)}`, ...v,
      steps: (v.steps as { type: string; config: unknown }[]).map((st) => ({ type: st.type, config: walk(st.config) })),
      ...(v.group === undefined ? {} : { group: walk(v.group) }),
      ...(v.matrix === undefined ? {} : { matrix: walk(v.matrix) }),
      columns: (v.columns as unknown[]).map(axis),
      ...(isObject(v.sort) ? { sort: { ...v.sort, key: axis(v.sort.key) } } : {})
    };
  }
  /* 2026-10-30 — eine Powtórka mit dem alten Knoten „Najpierw podstawy" geht in der neuen Gestalt hinaus (`migrateRevision`). */
  const graph = kind === 'template' ? { graph: graphOut(readGraph(data.graph), walk) }
    : kind === 'revision' ? { graph: graphOut(migrateRevision(readGraph(data.graph)), walk) }
    : kind === 'flow' ? { graph: graphOut(migratePrerequisites(readGraph(data.graph, true)), walk) } : {};
  return { ref: `@${name(id)}`, ...(walk(rest) as Record<string, unknown>), ...graph };
};

/** 2026-10-17 — ein Formularz dodawania: seine Rodzaje und voreingestellten Einträge als `@name`, damit er auch in einer anderen Baza wiedzy gilt. */
function formJson(lib: CogitaLibrary, id: string, data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const form = readAddForm(id, data);
  const name = nameIn(lib);
  return { ref: `@${name(id)}`, ...addFormDoc(form), graph: mapFormRefs(form.graph, (k) => `@${name(k)}`, (e) => `@${name(e)}`) };
}

/** Ein Rodzaj hinaus: sein Name im Dokument ist sein bleibender Name (aus einem Import) oder seine Kennung. */
const kindJson = (lib: CogitaLibrary, k: KindDef): Record<string, unknown> => ({ ref: `@${nameIn(lib)(k.id)}`, ...kindDoc({ ...k, fields: k.fields.map((f) => (f.to === undefined ? f : { ...f, to: f.to.map((t) => (isBaseKind(t) || !lib.isOwn(t) ? t :`@${nameIn(lib)(t)}`)) })) }) });

/**
 * Die ganze Baza wiedzy als Kurs — oder, mit `only`, ein Teil davon. 0110:
 * nur, was ihr selbst gehört; ihre Quellen stehen als Verweise in den
 * Einstellungen (`settings.sources`), nicht als Kopie.
 */
export function exportCourse(lib: CogitaLibrary, name: string, only?: { entities?: ReadonlySet<string>; docs?: ReadonlySet<DocKind> }): Record<string, unknown> {
  const docs: Record<string, unknown[]> = {};
  for (const kind of DOC_KINDS) {
    if (kind === 'kind' || kind === 'merge' || kind === 'contribution') continue;
    if (only?.docs !== undefined && !only.docs.has(kind)) continue;
    docs[LIST_OF[kind]] = lib.docs(kind).filter((e) => lib.isOwn(e.id)).map((e) => docJson(lib, kind, e.id, e.data));
  }
  return {
    format: COURSE_FORMAT,
    version: 1,
    name,
    kinds: lib.kinds.filter((k) => (!isBaseKind(k.id) && lib.isOwn(k.id)) || lib.docs('kind').some((e) => e.data.builtin === k.id)).map((k) => kindJson(lib, k)),
    entities: lib.entities().filter((e) => lib.isOwn(e.id) && (only?.entities === undefined || only.entities.has(e.id))).map((e) => entityJson(lib, e)),
    ...docs
  };
}

/** 2026-10-30 — wie viele Karten eine Vorlage tatsächlich gibt (für MCP: `get_knowledge_setup`). */
export interface TemplateCards {
  readonly ref: string;
  readonly name: string;
  readonly kinds: readonly string[];
  /** Die Vorlage gehört einer Quelle (einer anderen Baza wiedzy), nicht dieser. */
  readonly source?: true;
  readonly cards: number;
  /** Aus wie vielen Einträgen. */
  readonly entries: number;
  /** Die ersten Gründe, warum für einen Eintrag keine Karte entstand. */
  readonly problems?: readonly string[];
}

export interface KnowledgeSetup {
  /** Ein `recreatio.cogita.course` ohne Einträge: Schema, Vorlagen, Powtórki, Widoki, Przebiegi, Zbiory, Wejścia, Formularze, Einstellungen. */
  readonly course: Record<string, unknown>;
  readonly cards: { readonly total: number; readonly questions: number; readonly templates: readonly TemplateCards[]; readonly failed?: string };
}

/**
 * 2026-10-31 — NIE ETWAS VOM LERNEN EINES MENSCHEN: Schlüssel, die Antworten, Kenntnis oder Fortschritt tragen könnten,
 * fallen überall weg — heute steht keiner davon in einem Dokument der Baza; das bleibt so, auch wenn einmal einer
 * hineingerät. Derselbe Filter im Dienst (`AiMcpTools.Private`). Werte wie die Spalte „#knowness" eines Widoku bleiben:
 * sie sind Bau, kein Stand.
 */
export const PRIVATE_KEYS: ReadonlySet<string> = new Set(['marks', 'correctness', 'knowness', 'dueAt', 'progress', 'learners', 'accountId', 'answeredAt']);

/** Die Einstellungen einer Baza, die zu ihrem Bau gehören (nicht: wohin Antworten gehen, wohin Vorschläge). */
const SETUP_SETTINGS = ['sources', 'dependencies', 'tags', 'motivation', 'offline', 'joinPage'] as const;

/** Die Schlüssel eines Objekts unter „fields" sind Feldnamen eines Rodzaju (ein Formularz: „answers") — Bau, sie bleiben. */
const withoutPrivate = (v: unknown, named = false): unknown => {
  if (Array.isArray(v)) return v.map((x) => withoutPrivate(x));
  if (isObject(v)) return Object.fromEntries(Object.entries(v).filter(([k]) => named || !PRIVATE_KEYS.has(k)).map(([k, x]) => [k, withoutPrivate(x, !named && k === 'fields' && isObject(x))]));
  return v;
};

/**
 * 2026-10-30 — WAS DAS LERNEN STEUERT, ohne Einträge und ohne eine einzige Antwort: die Baza wiedzy als Kurs ohne
 * `entities` (dieselbe Gestalt und dieselben `@namen` wie der Export) und je Vorlage, wie viele Karten aus ihr
 * entstehen. Für die Abschrift des Links (`aiAccess/aiSnapshot.ts`) — ein Assistent vergleicht es mit dem Importformat.
 */
export async function exportSetup(lib: CogitaLibrary, name: string): Promise<KnowledgeSetup> {
  const course = exportCourse(lib, name, { entities: new Set() });
  const { entities: _none, settings, ...others } = course;
  const kept = (Array.isArray(settings) ? settings : []).map((one) => (isObject(one)
    ? Object.fromEntries(Object.entries(one).filter(([k]) => k === 'ref' || (SETUP_SETTINGS as readonly string[]).includes(k)))
    : one));
  const rest = withoutPrivate({ ...others, ...(Array.isArray(settings) ? { settings: kept } : {}) }) as Record<string, unknown>;
  /* Die Karten zu rechnen darf die Abschrift nicht kosten: misslingt es, kommt der Rest — mit dem Grund. */
  let made: Awaited<ReturnType<CogitaLibrary['cards']>>;
  let failed: string | undefined;
  try { made = await lib.cards(); } catch (e) { made = { cards: [], problems: new Map() }; failed = e instanceof Error && e.message !== '' ? e.message : 'karty się nie policzyły'; }
  const named = nameIn(lib);
  const kindName = (k: string): string => (isBaseKind(k) ? k : lib.kind(k)?.name ?? k);
  const templates = lib.templates().map((t): TemplateCards => {
    const cards = made.cards.filter((c) => c.template === t.id);
    const problems = made.problems.get(t.id) ?? [];
    return {
      ref: `@${named(t.id)}`, name: t.name, kinds: t.kinds.map(kindName),
      ...(lib.isOwn(t.id) ? {} : { source: true as const }),
      cards: cards.length, entries: new Set(cards.map((c) => c.entity ?? c.key)).size,
      ...(problems.length === 0 ? {} : { problems: [...new Set(problems)].slice(0, 5) })
    };
  });
  return { course: rest, cards: { total: made.cards.length, questions: made.cards.filter((c) => c.template === undefined).length, templates, ...(failed === undefined ? {} : { failed }) } };
}

/** Das Schema mit seinen Vorlagen — eine unabhängige Kopie für eine andere Bibliothek [B12]. */
export function exportSchema(lib: CogitaLibrary, name: string, kinds: readonly KindDef[]): Record<string, unknown> {
  const ids = new Set(kinds.map((k) => k.id));
  return {
    format: SCHEMA_FORMAT,
    version: 1,
    name,
    kinds: kinds.map((k) => kindJson(lib, k)),
    templates: lib.templates().filter((t) => t.kinds.some((k) => ids.has(k))).map((t) => ({
      ref: `@${nameIn(lib)(t.id)}`, name: t.name, kinds: t.kinds.map((k) => `@${nameIn(lib)(k)}`), direction: t.direction, graph: graphOut(t.graph, idsOut(lib, nameIn(lib))),
      /* 2026-10-30 — was ihre Karten prüfen, und wie stark. */
      ...(t.tests.length === 0 ? {} : { tests: t.tests })
    })),
    /* 2026-10-17 — die Formularze dodawania gehören zum Schema: sie sagen, wie man seine Einträge anlegt. */
    forms: lib.docs('addform').filter((e) => lib.isOwn(e.id)).map((e) => formJson(lib, e.id, e.data))
  };
}

/**
 * 2026-10-19 — FORMULARZE DODAWANIA ALS JSON, für sich: die Formulare und die
 * eigenen Rodzaje, die sie brauchen (die ihrer Knoten und, Schritt für
 * Schritt, die, auf die deren Verweisfelder zeigen). So trägt man einen
 * Formularz in eine andere Baza wiedzy — oder ändert ihn im Text und holt ihn
 * zurück: derselbe `ref` ändert ihn an Ort und Stelle. Das Format ist das des
 * Schemas; der Import dort nimmt dasselbe Dokument.
 */
export function exportForms(lib: CogitaLibrary, forms: readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[], name: string): Record<string, unknown> {
  const used = new Set<string>();
  for (const f of forms) {
    for (const n of readAddForm(f.id, f.data).graph.nodes) {
      if (typeof n.config.kind === 'string') used.add(n.config.kind);
      if (Array.isArray(n.config.kinds)) for (const k of n.config.kinds) if (typeof k === 'string') used.add(k);
    }
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const id of [...used]) {
      for (const f of lib.kind(id)?.fields ?? []) {
        for (const t of f.type === 'ref' ? f.to ?? [] : []) if (!used.has(t)) { used.add(t); grew = true; }
      }
    }
  }
  const kinds = lib.refKinds.filter((k) => used.has(k.id) && ((!isBaseKind(k.id) && lib.isOwn(k.id)) || lib.docs('kind').some((e) => e.data.builtin === k.id)));
  return {
    format: SCHEMA_FORMAT,
    version: 1,
    name,
    kinds: kinds.map((k) => kindJson(lib, k)),
    forms: forms.map((f) => formJson(lib, f.id, f.data))
  };
}

/**
 * Was der Import EINES FORMULARS nimmt: Rodzaje, Formulare und Kartenvorlagen
 * (ein Formular kommt oft mit den Vorlagen, die aus seinen Einträgen Karten
 * machen) — keine Einträge, keine Wiederholungen. Ohne Formular kein Import.
 */
export function planFormImport(lib: CogitaLibrary, doc: unknown): ImportPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument JSON.' };
  if (!Array.isArray(doc.forms) || doc.forms.length === 0) return { error: 'W dokumencie nie ma formularza — brak listy „forms".' };
  const extra = ['entities', 'revisions', 'flows', 'collections', 'looks', 'rules', 'values', 'views', 'settings'].filter((k) => doc[k] !== undefined);
  const plan = planImport(lib, { format: doc.format, version: doc.version, name: doc.name, kinds: doc.kinds, templates: doc.templates, forms: doc.forms });
  if ('error' in plan || extra.length === 0) return plan;
  return { ...plan, warnings: [...plan.warnings, `Pominięte (to importuje się w Schematach albo w Ustawieniach): ${extra.join(', ')}.`] };
}

/** Ein Ablauf mit allem, was er zeigt [F34]. */
export function exportFlow(lib: CogitaLibrary, flowId: string): Record<string, unknown> | null {
  const entry = lib.docs('flow').find((e) => e.id === flowId);
  if (entry === undefined) return null;
  const flow = readFlow(entry.id, entry.data);
  const shown = new Set<string>();
  for (const n of flow.graph.nodes) for (const v of Object.values(n.config)) if (typeof v === 'string' && lib.entity(v) !== undefined) shown.add(v);
  for (const l of flow.lines) { shown.add(l.character); shown.add(l.of); }
  /* 2026-10-22 (Schritt 12) — die Erzähler gehen mit. */
  for (const one of flow.narrators) shown.add(one.character);
  return {
    format: FLOW_FORMAT,
    version: 1,
    flow: docJson(lib, 'flow', entry.id, entry.data),
    entities: [...shown].map((id) => lib.entity(id)).filter((e): e is Entity => e !== undefined).map((e) => entityJson(lib, e))
  };
}

/* -- Herein ------------------------------------------------------------------------------ */

export interface ImportPlan {
  /** `marks`: was mit dem Rodzaj gespeichert wird, ohne Feld zu sein (2026-10-25: `_ref`, der bleibende Name aus dem Import). */
  readonly kinds: { readonly id: string; readonly def: KindDef; readonly isNew: boolean; readonly marks?: Record<string, unknown> }[];
  /** `marks`: was mit dem Eintrag gespeichert wird, ohne Feld zu sein (2026-10-25: `_ref`, der bleibende Name, und `_refDoc`, das Dokument, aus dem er kam). */
  readonly entities: { readonly id: string; readonly kinds: string[]; readonly data: Record<string, unknown>; readonly isNew: boolean; readonly marks?: Record<string, unknown> }[];
  readonly docs: { readonly id: string; readonly kind: DocKind; readonly data: Record<string, unknown>; readonly isNew: boolean }[];
  readonly lines: string[];
  readonly warnings: string[];
}

/**
 * 2026-10-25 — EIN BLEIBENDER NAME: ein `ref` mit „/" (`@kowalski2020/calosc/pytanie`, `@wywod/widok`)
 * bleibt am Eintrag, am Dokument, am Rodzaj (`_ref`, klein geschrieben). Dasselbe Dokument ein zweites
 * Mal ändert sie an Ort und Stelle, statt neue anzulegen — so kann ein Wywód aus der eigenen KI
 * verbessert und neu eingelesen werden. Namen ohne „/" (`@q`) gelten nur in ihrem Dokument.
 */
const lasting = (r: string): boolean => r.includes('/');
/** Ein bleibender Name gilt ohne Rücksicht auf Gross und klein — im Dokument wie in `byImportRef`. */
const refKey = (r: string): string => (lasting(r) ? r.toLowerCase() : r);
/** Hat der Eintrag schon einen bleibenden Namen? Dann bleibt er (auch einer, der über `_refs` gefunden wurde). */
const hasLastingName = (data: Readonly<Record<string, unknown>> | undefined): boolean => typeof data?._ref === 'string' && data._ref !== '';
/** Ein leerer Wert — den darf eine Zeile füllen, die einen zusammengeführten Eintrag nur über seinen alten Namen trifft. */
const isEmptyValue = (v: unknown): boolean => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const fillEmpty = (base: Readonly<Record<string, unknown>>, extra: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) if (isEmptyValue(out[key])) out[key] = value;
  return out;
};

/** Die Rodzaje einer Vorlage oder eines Formulars, sortiert — woran ein gleichnamiges wiedererkannt wird. */
function docKindsOf(kind: DocKind, data: Readonly<Record<string, unknown>>, map: (k: string) => string): string {
  const out = new Set<string>();
  if (kind === 'template') for (const k of readTemplate('', data).kinds) out.add(map(k));
  if (kind === 'addform') {
    for (const n of readAddForm('', data).graph.nodes) {
      if (typeof n.config.kind === 'string' && n.config.kind !== '') out.add(map(n.config.kind));
      if (Array.isArray(n.config.kinds)) for (const k of n.config.kinds) if (typeof k === 'string' && k !== '') out.add(map(k));
    }
  }
  return [...out].sort().join('|');
}

/**
 * 2026-10-25 — WORAUF EIN `@name` IN EINEM DOKUMENT ZEIGT, nach dem Schlüssel, unter dem er steht:
 * „collection" ein Zbiór, „view" ein Widok, … — erst in diesem Raum, dann wie sonst (Rodzaje und
 * Einträge zuerst). Seit jede Art Dokument ihre eigenen Namen hat, darf ein Zbiór „@q" neben einem
 * Eintrag „@q" stehen; der Schritt „source.collection" meint dann den Zbiór.
 */
const PREFER: Readonly<Record<string, DocKind>> = {
  collection: 'collection', collections: 'collection', view: 'view', views: 'view', revision: 'revision', flow: 'flow',
  template: 'template', templates: 'template', look: 'look', rules: 'rules', form: 'addform', addform: 'addform'
};
/** Wo in einem Dokument freier Text steht — ein „@a/b" dort ist Text, kein Verweis. */
const FREE_TEXT = new Set(['name', 'query', 'says', 'note', 'label', 'text', 'title', 'summary', 'description', 'prompt', 'direction', 'hint']);

/**
 * EIN DOKUMENT PLANEN — was angelegt, was geändert würde, und was nicht geht.
 * Nichts wird gespeichert; das tut `applyImport` nach der Rückfrage.
 */
export function planImport(lib: CogitaLibrary, doc: unknown): ImportPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument JSON.' };
  const format = str(doc.format);
  if (![COURSE_FORMAT, SCHEMA_FORMAT, ENTITIES_FORMAT, FLOW_FORMAT].includes(format)) {
    return { error: `Nieznany format „${format || '—'}". Oczekiwany: ${COURSE_FORMAT}, ${SCHEMA_FORMAT}, ${ENTITIES_FORMAT} albo ${FLOW_FORMAT}.` };
  }
  const warnings: string[] = [];
  /*
    2026-10-25 — NAMEN IM DOKUMENT: Rodzaje und Einträge in einem Raum (`refs`), jede Art von
    Dokument in einem eigenen (`docRefs`) — ein Wejście „@x" ändert nie den Eintrag „@x".
  */
  const refs = new Map<string, string>();
  const docRefs = new Map<DocKind, Map<string, string>>();
  const docRefsOf = (kind: DocKind): Map<string, string> => {
    let m = docRefs.get(kind);
    if (m === undefined) { m = new Map(); docRefs.set(kind, m); }
    return m;
  };
  const ref = (raw: unknown): string | null => {
    const r = str(raw).replace(/^@/, '');
    return r === '' ? null : r;
  };
  const idFor = (raw: unknown, exists: (id: string) => boolean): { id: string; isNew: boolean } => {
    const r = ref(raw);
    if (r !== null && exists(r)) { refs.set(refKey(r), r); return { id: r, isNew: false }; }
    if (r !== null && refs.has(refKey(r))) return { id: refs.get(refKey(r))!, isNew: false };
    const id = newId();
    if (r !== null) refs.set(refKey(r), id);
    return { id, isNew: true };
  };
  /*
    2026-10-25 — WESSEN NAME ES IST: ein Dokument mit Einträgen (das, was eine KI für ein Werk
    vorbereitet) gibt seinen Einträgen und Dokumenten seinen Namen mit (`_refDoc`). Trifft ein anderes
    Dokument dieselben bleibenden Namen, sagt die Vorschau, dass es fremde Einträge ändern würde —
    meist eine zweite Rekonstruktion mit denselben Namen. Ein Kurs (Export) tut das nicht.
  */
  const docName = format === ENTITIES_FORMAT ? str(doc.name).slice(0, 200) : '';
  const foreign = new Map<string, string[]>();
  /*
    Nur was an einem Werk hängt (ein Verweis auf ein Werk der Bibliothek, wie ein Krok, ein Element,
    ein Wejście): ein Begriff ÜBER den Werken („@pojecie/wolnosc") gehört allen Dokumenten zugleich.
  */
  const tiedToWork = (data: Readonly<Record<string, unknown>>): boolean => Object.entries(data).some(([key, value]) => !key.startsWith('_')
    && (Array.isArray(value) ? value : [value]).some((x) => {
      const id = typeof x === 'string' ? x : typeof x === 'object' && x !== null && typeof (x as { value?: unknown }).value === 'string' ? (x as { value: string }).value : undefined;
      return id !== undefined && lib.entity(id)?.kinds.includes('work') === true;
    }));
  const noteOwner = (data: Readonly<Record<string, unknown>>, r: string) => {
    const owner = typeof data._refDoc === 'string' ? data._refDoc : '';
    if (docName === '' || owner === '' || owner === docName || !tiedToWork(data)) return;
    foreign.set(owner, [...(foreign.get(owner) ?? []), r]);
  };
  const ownerMark = docName === '' ? {} : { _refDoc: docName };

  /* Rodzaje: eingebaute an ihrer Kennung, eigene an Kennung, bleibendem Namen oder Namen — erst alle Kennungen, dann die Felder. */
  const kinds: ImportPlan['kinds'] = [];
  /* Auch die eingebauten, die hier (noch) nicht stehen: „Pytanie" im JSON fügt sie hinzu. */
  const byName = new Map(lib.refKinds.map((k) => [k.name.toLowerCase(), k.id]));
  const docNames = new Map<string, string>();
  const placed: { raw: Record<string, unknown>; id: string; isNew: boolean; marks?: Record<string, unknown> }[] = [];
  for (const raw of Array.isArray(doc.kinds) ? doc.kinds : []) {
    if (!isObject(raw)) continue;
    const builtin = str(raw.builtin);
    if (builtin !== '' && isBaseKind(builtin)) {
      placed.push({ raw, id: builtin, isNew: false });
      refs.set(refKey(ref(raw.ref) ?? builtin), builtin);
      continue;
    }
    /* 2026-10-23 — eine Änderung eines eingebauten Rodzaj, den es nicht mehr gibt (Temat, Wiedza, Komentarz): nicht als neuer Rodzaj. */
    if (builtin !== '') { warnings.push(`Rodzaj wbudowany „${builtin}” już nie istnieje (tematów, wiedzy i komentarzy wbudowanych nie ma) — pominięty.`); continue; }
    const named = byName.get(str(raw.name).toLowerCase());
    const r = ref(raw.ref);
    /* 2026-10-25 — ein bleibender Name findet den Rodzaj wieder, auch wenn er inzwischen anders heisst. */
    const lastingRef = r !== null && lasting(r) ? r.toLowerCase() : undefined;
    const byLasting = lastingRef === undefined ? undefined : lib.byImportRef(lastingRef, 'kind');
    const known = r !== null && lib.kind(r) !== undefined ? r : byLasting?.id ?? named;
    const id = known ?? idFor(raw.ref, () => false).id;
    if (r !== null) refs.set(refKey(r), id);
    if (str(raw.name) !== '') docNames.set(str(raw.name).toLowerCase(), id);
    const stamp = lastingRef !== undefined && (known === undefined || !hasLastingName(lib.entry(id)?.data));
    placed.push({ raw, id, isNew: known === undefined, ...(stamp ? { marks: { _ref: lastingRef } } : {}) });
  }
  const kindId = (raw: unknown): string | null => {
    const r = ref(raw);
    if (r === null) return null;
    if (isBaseKind(r) || lib.kind(r) !== undefined) return r;
    if (refs.has(refKey(r))) return refs.get(refKey(r))!;
    /* 2026-10-25 — auch an seinem bleibenden Namen („@wywod/krok"): ein Dokument mit Einträgen nennt ihn so, auch wenn der Besitzer ihn umbenannt hat. */
    if (lasting(r)) { const known = lib.byImportRef(r, 'kind'); if (known !== undefined) return known.id; }
    return byName.get(r.toLowerCase()) ?? docNames.get(r.toLowerCase()) ?? null;
  };
  /*
    2026-10-17 — WOHIN EIN VERWEISFELD ZEIGT („to") gilt wie jeder andere
    Rodzaj im Dokument: als `@ref`, Kennung oder Name, auch auf einen weiter
    unten. Vorher blieb es wörtlich stehen — in einer anderen Baza wiedzy
    zeigte „Słowo → Język" dann auf eine Kennung, die es dort nicht gibt.
  */
  for (const { raw, id, isNew, marks } of placed) {
    const fields = Array.isArray(raw.fields)
      ? raw.fields.map((f) => (isObject(f) && Array.isArray(f.to) ? { ...f, to: f.to.map((t) => kindId(t) ?? t) } : f))
      : raw.fields;
    const def = readKind(id, { ...raw, fields });
    const withMarks = marks === undefined ? {} : { marks };
    /*
      2026-10-25 — EIN RODZAJ, DEN ES SCHON GIBT, WIRD ERGÄNZT, NICHT ERSETZT: die Felder, die das
      Dokument nennt, in seiner Reihenfolge (ein anderer Typ wird genannt); die übrigen bleiben, jedes
      hinter dem Feld, hinter dem es stand. Name, Muster des Etiketts, Unterscheidung und feste Art
      bleiben, wenn das Dokument sie nicht nennt — und was es ändert, sagt die Vorschau. Vorher löschte
      `komentarz-biblijny.json` nach `komentarz.json` das Feld „O czym" des Komentarz.
    */
    const before = isNew || isBaseKind(id) ? undefined : lib.kind(id);
    if (before === undefined) { kinds.push({ id, def, isNew, ...withMarks }); continue; }
    const name = str(raw.name) !== '' ? def.name : before.name;
    const incoming = new Set(def.fields.map((f) => f.key));
    for (const f of def.fields) {
      const old = before.fields.find((x) => x.key === f.key);
      if (old !== undefined && old.type !== f.type) warnings.push(`Rodzaj „${name}”: pole „${f.label}” zmienia typ (${FIELD_TYPE_LABEL[old.type]} → ${FIELD_TYPE_LABEL[f.type]}) — dotychczasowe wartości mogą trafić „poza schemat”.`);
    }
    const merged = [...def.fields];
    before.fields.forEach((f, i) => {
      if (incoming.has(f.key)) return;
      let at = 0;
      for (let j = i - 1; j >= 0; j -= 1) {
        const k = merged.findIndex((x) => x.key === before.fields[j]!.key);
        if (k >= 0) { at = k + 1; break; }
      }
      merged.splice(at, 0, f);
    });
    const kept = before.fields.filter((f) => !incoming.has(f.key));
    if (kept.length > 0) warnings.push(`Rodzaj „${name}”: pola, których nie ma w dokumencie, zostają (${kept.map((f) => f.label).join(', ')}).`);
    const label = str(raw.label) !== '' ? def.label : before.label;
    const wantTells = str(raw.tells);
    const tells = 'tells' in raw
      ? (merged.some((f) => f.key === wantTells) ? wantTells : undefined)
      : (before.tells !== undefined && merged.some((f) => f.key === before.tells) ? before.tells : undefined);
    const system = 'system' in raw ? def.system : before.system;
    if (name !== before.name) warnings.push(`Rodzaj „${before.name}” zmienia nazwę na „${name}”.`);
    if (label !== before.label) warnings.push(`Rodzaj „${name}”: wzór etykiety „${before.label}” → „${label}”.`);
    if (tells !== before.tells) warnings.push(`Rodzaj „${name}”: pole odróżniające imienników „${before.tells ?? '—'}” → „${tells ?? '—'}”.`);
    if (system !== before.system) warnings.push(`Rodzaj „${name}”: stała rola w silniku „${before.system ?? '—'}” → „${system ?? '—'}”.`);
    kinds.push({ id, isNew, ...withMarks, def: { ...def, name, fields: merged, label, tells, system } });
  }
  /* Wie ein Feld eines Eintrags seine Werte meint: aus den Rodzajen dieses Dokuments, sonst der Baza. */
  const planKinds = new Map(kinds.map((k) => [k.id, k.def]));
  const fieldOf = (entityKinds: readonly string[], key: string): FieldDef | undefined => {
    for (const k of entityKinds) {
      const f = (planKinds.get(k) ?? lib.kind(k))?.fields.find((x) => x.key === key);
      if (f !== undefined) return f;
    }
    return undefined;
  };

  /* Einträge: zuerst die Kennungen, dann die Verweise (sie dürfen nach vorn zeigen). */
  const rawEntities = Array.isArray(doc.entities) ? doc.entities.filter(isObject) : [];
  /* Welcher bleibende Name einen vorhandenen Eintrag schon genommen hat — zwei, die zu einem führen (zusammengeführt), werden genannt. */
  const takenBy = new Map<string, string>();
  /*
    2026-10-25 — ein bleibender Name (mit „/") findet den Eintrag eines früheren Imports wieder. `alias`:
    gefunden nur über einen mitgetragenen Namen (`_refs`) — der Eintrag wurde zusammengeführt, und was
    der Bleibende hat, gilt; diese Zeile füllt nur, was bei ihm leer ist.
  */
  const entityId = (raw: unknown): { id: string; isNew: boolean; marks?: Record<string, unknown>; alias?: true } => {
    const r = ref(raw);
    if (r !== null && lasting(r) && lib.entity(r) === undefined) {
      const lastingRef = r.toLowerCase();
      if (refs.has(lastingRef)) { warnings.push(`Nazwa „@${r}” stoi w dokumencie dwa razy — drugi wpis zmieni pierwszy.`); return { id: refs.get(lastingRef)!, isNew: false }; }
      const had = lib.byImportRef(lastingRef, 'entity');
      if (had !== undefined) {
        const other = takenBy.get(had.id);
        if (other !== undefined) warnings.push(`Wpisy „@${other}” i „@${r}” to dziś jeden wpis (połączone) — zapisze się jeden; to, co już w nim jest, zostaje.`);
        takenBy.set(had.id, r);
        refs.set(lastingRef, had.id);
        const own = typeof had.data._ref === 'string' && had.data._ref.toLowerCase() === lastingRef;
        if (!own && Array.isArray(had.data._refs)) return { id: had.id, isNew: false, alias: true };
        noteOwner(had.data, r);
        return { id: had.id, isNew: false, marks: { ...(hasLastingName(had.data) ? {} : { _ref: lastingRef }), ...ownerMark } };
      }
      const id = newId();
      refs.set(lastingRef, id);
      return { id, isNew: true, marks: { _ref: lastingRef, ...ownerMark } };
    }
    return idFor(raw, (id) => lib.entity(id) !== undefined);
  };
  const ids = rawEntities.map((raw) => entityId(raw.ref ?? raw.id));
  /*
    2026-10-25 — WORAUF EIN WERT ZEIGT: ein Name aus dem Dokument, eine Kennung, ein bleibender Name
    eines früheren Imports, ein Schlüssel dieser Baza oder ihrer ERKLÄRTEN Quellen (ein Werk der
    Bibliothek: `@kowalski2020`) — nie einer Bibliothek, die nur in diesem Tab offen ist.
  */
  const resolveRef = (r: string): string | null =>
    refs.get(refKey(r)) ?? (lib.entity(r) !== undefined ? r : null) ?? (lasting(r) ? lib.byImportRef(r, 'entity')?.id ?? null : null) ?? lib.resolveDeclared(r) ?? null;
  for (const raw of rawEntities) {
    const r = ref(raw.ref);
    const declared = r === null || lasting(r) ? undefined : lib.resolveDeclared(r);
    if (r !== null && declared !== undefined && declared !== refs.get(r)) warnings.push(`Nazwa „@${r}” w dokumencie jest też kluczem w bibliotece — odwołania „@${r}” w tym dokumencie prowadzą do wpisu z dokumentu. Nadaj wpisom inne nazwy (np. „@${r}/calosc/pytanie”).`);
  }
  /* Was nicht aufgeht, sagt, wo es fehlen könnte: ein Schlüssel ohne „/" ist meist ein Werk einer Bibliothek, die die Baza nicht nennt. */
  const missingWhy = (name: string): string => lasting(name)
    ? `odwołanie „@${name}” prowadzi donikąd (nie ma wpisu o tej nazwie ani w dokumencie, ani w bazie) — pominięte`
    : `odwołanie „@${name}” prowadzi donikąd — pominięte (jeśli to klucz dzieła z biblioteki: ta baza musi z niej korzystać — Więcej → Ustawienia → Źródła)`;
  const entities: ImportPlan['entities'] = [];
  const planned = new Map<string, number>();
  /* Welche geplanten Einträge eine Zeile mit ihrem eigenen Namen haben (nicht nur über einen mitgetragenen). */
  const primary = new Set<string>();
  rawEntities.forEach((raw, i) => {
    const entityKinds = (Array.isArray(raw.kinds) ? raw.kinds : [raw.kind]).map(kindId).filter((k): k is string => k !== null);
    if (entityKinds.length === 0) { warnings.push(`Wpis ${str(raw.ref) || i + 1}: nie ma takiego rodzaju — pominięty.`); return; }
    /* 2026-10-25 — dzieła, osoby, cytaty, teksty należą do Biblioteki i Skryptorium: tu się na nie wskazuje. */
    const foreignKind = entityKinds.find((k) => lib.isForeignKind(k));
    if (foreignKind !== undefined) warnings.push(`Wpis ${str(raw.ref) || i + 1} jest rodzaju „${lib.kind(foreignKind)?.name ?? foreignKind}” — zapisze się jako kopia w tej bazie. Zwykle wskazuje się istniejący wpis biblioteki jego kluczem albo identyfikatorem.`);
    /*
      2026-10-25 — Ein Name mit „/" ist nur dort ein Verweis, wo das Feld einer ist (ein Verweisfeld, der
      Verweis einer Zelle in einer Aussage); in einem Textfeld ist „@autor/rok" Text und bleibt.
    */
    const modeAt = (path: readonly string[]): RefMode => {
      const f = path[0] === undefined ? undefined : fieldOf(entityKinds, path[0]);
      return f?.type === 'ref' || (f?.type === 'blocks' && path[path.length - 1] === 'ref') ? 'all' : 'short';
    };
    const data = isObject(raw.data) ? refsIn(raw.data, (r) => resolveRef(r), (missing) => warnings.push(`Wpis ${str(raw.ref) || i + 1}: ${missingWhy(missing)}.`), modeAt) : {};
    const { id, isNew, marks, alias } = ids[i]!;
    /* Zwei Zeilen, ein Eintrag (derselbe Name zweimal, zusammengeführte): einer — die Zeile mit dem eigenen Namen gilt, die anderen füllen nur Leeres. */
    const at = planned.get(id);
    if (at !== undefined) {
      const was = entities[at]!;
      const next = alias === true ? fillEmpty(was.data, data) : primary.has(id) ? { ...was.data, ...data } : fillEmpty(data, was.data);
      if (alias !== true) primary.add(id);
      entities[at] = { ...was, kinds: [...was.kinds, ...entityKinds.filter((k) => !was.kinds.includes(k))], data: next, ...(marks === undefined ? {} : { marks: { ...(was.marks ?? {}), ...marks } }) };
      return;
    }
    planned.set(id, entities.length);
    if (alias !== true) primary.add(id);
    /*
      2026-10-25 — EIN EINTRAG, DEN ES SCHON GIBT, WIRD ERGÄNZT, NICHT ERSETZT: was das Dokument nennt,
      gilt; was es nicht nennt, bleibt; `null` entfernt ein Feld. So kann eine Korrektur (von der eigenen
      KI oder von Hand) nur die Felder nennen, die sie ändert — und die Vorschau zeigt jede Änderung einzeln.
      Seine Rodzaje bleiben, die des Dokuments kommen dazu.
    */
    const had = isNew ? undefined : lib.entity(id);
    const start = alias === true ? fillEmpty(had?.data ?? {}, data) : had === undefined ? data : { ...had.data, ...data };
    const startKinds = had === undefined ? entityKinds : [...had.kinds, ...entityKinds.filter((k) => !had.kinds.includes(k))];
    entities.push({ id, kinds: startKinds, data: start, isNew, ...(marks === undefined ? {} : { marks }) });
  });

  /* `null` heisst: dieses Feld entfernen (erst jetzt, nachdem alle Zeilen eines Eintrags beisammen sind). */
  entities.forEach((e, i) => {
    if (Object.values(e.data).some((v) => v === null)) entities[i] = { ...e, data: Object.fromEntries(Object.entries(e.data).filter(([, v]) => v !== null)) };
  });

  /* Dokumente: Vorlagen, Wiederholungen, Abläufe, … */
  const docs: ImportPlan['docs'] = [];
  const docLists: [DocKind, unknown][] = [
    ['template', doc.templates], ['revision', doc.revisions], ['flow', format === FLOW_FORMAT ? [doc.flow] : doc.flows],
    ['look', doc.looks], ['rules', doc.rules], ['values', doc.values], ['collection', doc.collections], ['view', doc.views], ['settings', doc.settings],
    ['addform', doc.forms],
    /* 2026-10-25 (Wywód) — nach den Widokach: ein Wejście nennt seinen Widok auch beim Namen. */
    ['anchor', doc.anchors]
  ];
  type Incoming = { kind: DocKind; raw: Record<string, unknown>; r: string | null; lastingRef?: string; id?: string; isNew?: boolean; byName?: true };
  const incoming: Incoming[] = [];
  for (const [kind, list] of docLists) {
    for (const raw of Array.isArray(list) ? list : isObject(list) ? [list] : []) {
      if (!isObject(raw)) continue;
      const r = ref(raw.ref ?? raw.id);
      incoming.push({ kind, raw, r, ...(r !== null && lasting(r) ? { lastingRef: r.toLowerCase() } : {}) });
    }
  }
  /*
    2026-10-25 — WELCHES DOKUMENT GEMEINT IST, in zwei Durchgängen. Zuerst nimmt jedes eingehende
    Dokument, was es BEIM NAMEN nennt: eine Kennung, einen Namen aus diesem Dokument (je Art von
    Dokument), einen bleibenden Namen (mit „/") eines früheren Imports. Erst danach werden Vorlagen und
    Formulare ohne solchen Treffer an Namen UND Rodzajen erkannt — nur ein vorhandenes, das noch keiner
    nahm und (für ein Dokument mit bleibendem Namen) selbst keinen trägt, und nur, wenn es genau eines
    gibt. So nimmt eine gleichnamige Kopie im Dokument nie das Original, und ein Name wird nie doppelt.
  */
  const claimed = new Set<string>();
  for (const d of incoming) {
    const own = docRefsOf(d.kind);
    if (d.r === null) continue;
    if (own.has(refKey(d.r))) {
      warnings.push(`${DOC_LABEL[d.kind]} „@${d.r}” stoi w dokumencie dwa razy — drugi zmieni pierwszy.`);
      Object.assign(d, { id: own.get(refKey(d.r))!, isNew: false });
      continue;
    }
    const exists = lib.docs(d.kind).find((e) => e.id === d.r);
    const had = exists ?? (d.lastingRef === undefined ? undefined : lib.byImportRef(d.lastingRef, d.kind));
    if (had !== undefined && !claimed.has(had.id)) {
      claimed.add(had.id);
      own.set(refKey(d.r), had.id);
      if (d.lastingRef !== undefined) noteOwner(had.data, d.r);
      Object.assign(d, { id: had.id, isNew: false });
    }
  }
  for (const d of incoming) {
    if (d.id !== undefined) continue;
    const own = docRefsOf(d.kind);
    if (d.r !== null && own.has(refKey(d.r))) {
      warnings.push(`${DOC_LABEL[d.kind]} „@${d.r}” stoi w dokumencie dwa razy — drugi zmieni pierwszy.`);
      Object.assign(d, { id: own.get(refKey(d.r))!, isNew: false });
      continue;
    }
    if ((d.kind === 'template' || d.kind === 'addform') && str(d.raw.name) !== '') {
      const want = docKindsOf(d.kind, d.raw, (k) => kindId(k) ?? k);
      const same = lib.docs(d.kind).filter((e) => lib.isOwn(e.id) && !claimed.has(e.id)
        && (d.lastingRef === undefined || !hasLastingName(e.data))
        && str(e.data.name).toLowerCase() === str(d.raw.name).toLowerCase() && docKindsOf(d.kind, e.data, (k) => k) === want);
      if (same.length === 1) {
        claimed.add(same[0]!.id);
        if (d.r !== null) own.set(refKey(d.r), same[0]!.id);
        Object.assign(d, { id: same[0]!.id, isNew: false, byName: true });
        continue;
      }
    }
    const id = newId();
    if (d.r !== null) own.set(refKey(d.r), id);
    Object.assign(d, { id, isNew: true });
  }
  const docRef = (r: string): string | null => {
    for (const m of docRefs.values()) { const hit = m.get(refKey(r)); if (hit !== undefined) return hit; }
    return null;
  };
  /* Worauf ein Dokument zeigt: der Raum, den der Schlüssel nennt; dann Rodzaje und Einträge, Dokumente (aus diesem Import oder schon in der Baza), bleibende Namen, Schlüssel. */
  const resolveDocRef = (r: string, path: readonly string[]): string | null => {
    const prefer = PREFER[path[path.length - 1] ?? ''];
    const preferred = prefer === undefined ? undefined : docRefsOf(prefer).get(refKey(r)) ?? (lasting(r) ? lib.byImportRef(r, prefer)?.id : undefined);
    return preferred ?? refs.get(refKey(r)) ?? docRef(r) ?? (lib.entity(r) !== undefined || lib.kind(r) !== undefined || DOC_KINDS.some((k) => lib.docs(k).some((e) => e.id === r)) ? r : null)
      ?? (lasting(r) ? (lib.byImportRef(r, 'entity') ?? lib.byImportRef(r, 'kind') ?? lib.byImportRef(r))?.id ?? null : null) ?? lib.resolveDeclared(r) ?? null;
  };
  const docModeAt = (path: readonly string[]): RefMode => (FREE_TEXT.has(path[path.length - 1] ?? '') ? 'none' : 'all');
  for (const d of incoming) {
    const { kind, raw, lastingRef, byName } = d;
    const id = d.id!;
    const isNew = d.isNew!;
    const { ref: _ref, id: _id, ...rest } = raw;
    const label = `${DOC_LABEL[kind]} „${str(rest.name) || '—'}”`;
    let data: Record<string, unknown>;
    if (kind === 'anchor') {
      /* Ein Wejście löst seinen Eintrag, seinen Widok und sein Werk selbst auf — jedes in seinem eigenen Raum. */
      data = planAnchor(lib, rest, {
        entity: (r) => { const hit = refs.get(refKey(r)); const at = hit === undefined ? undefined : planned.get(hit); return at === undefined ? null : { id: entities[at]!.id, kinds: entities[at]!.kinds }; },
        view: (r) => docRefsOf('view').get(refKey(r)) ?? null,
        planned: docs
      }, warnings);
    } else {
      data = refsIn(rest, resolveDocRef, (missing) => warnings.push(`${label}: ${missingWhy(missing)}.`), docModeAt);
    }
    if (kind === 'template') {
      const t = readTemplate(id, data);
      data = { ...data, kinds: t.kinds.map((k) => kindId(k) ?? k), graph: graphJson(t.graph), tests: t.tests.length === 0 ? undefined : t.tests };
    }
    /* 2026-10-30 — der alte Knoten „Najpierw podstawy" kommt als die allgemeinen Schritte an, die dasselbe tun (in einem Ablauf: ein „Warunek"). */
    if (kind === 'revision') data = { ...data, graph: graphJson(migrateRevision(readGraph(data.graph))) };
    if (kind === 'flow' && isObject(data.graph)) data = { ...data, graph: graphJson(migratePrerequisites(readGraph(data.graph, true))) };
    if (kind === 'addform') {
      /* Ein Rodzaj darf auch beim Namen stehen; einer aus demselben Dokument hat schon seine neue Kennung. */
      const kindOf = (k: string) => (kinds.some((x) => x.id === k) ? k : kindId(k));
      data = addFormDoc(readAddForm(id, { ...data, graph: mapFormRefs(data.graph, kindOf, (e) => e) }));
    }
    if (kind === 'view') {
      /* 2026-10-25 — eine Achse als Spalte („#axis:@rodzaj") wie jeder andere Rodzaj im Dokument. */
      const axis = (c: unknown): unknown => {
        if (typeof c !== 'string' || !c.startsWith(`${AXIS_COLUMN}@`)) return c;
        const target = resolveDocRef(c.slice(AXIS_COLUMN.length + 1), ['kind']);
        if (target === null) { warnings.push(`${label}: oś „${c.slice(AXIS_COLUMN.length)}” prowadzi donikąd — pominięta.`); return undefined; }
        return `${AXIS_COLUMN}${target}`;
      };
      const columns = Array.isArray(data.columns) ? data.columns.map(axis).filter((c) => c !== undefined) : data.columns;
      const sort = isObject(data.sort) && typeof data.sort.key === 'string' ? { ...data.sort, key: axis(data.sort.key) ?? data.sort.key } : data.sort;
      /* 2026-10-22 (Schritt 9) — ein Widok in der alten Gestalt (Art und Filter) kommt als Schritte an. */
      data = viewJson(readView({ ...data, columns, sort }));
    }
    /* Der bleibende Name zuletzt — die Gestalten oben (Widok, Formularz) kennen ihn nicht. */
    if (lastingRef !== undefined) data = { ...data, _ref: lastingRef, ...ownerMark };
    if (kind === 'settings') {
      const had = lib.settingsEntry();
      docs.push({ id: had?.id ?? id, kind, data: { ...(had?.data ?? {}), ...data }, isNew: had === undefined });
      continue;
    }
    if (byName === true) warnings.push(`${DOC_LABEL[kind]} „${str(rest.name)}” już jest — zostanie zastąpiony wersją z dokumentu.`);
    const twice = docs.findIndex((x) => x.id === id && x.kind === kind);
    if (twice >= 0) docs[twice] = { ...docs[twice]!, data };
    else docs.push({ id, kind, data, isNew });
  }

  /* 2026-10-25 — fremde Namen: ein anderes Dokument hat diese Einträge angelegt. */
  for (const [owner, names] of foreign) {
    warnings.push(`${names.length} ${plural(names.length, 'nazwa', 'nazwy', 'nazw')} z tego dokumentu ma już wpis z dokumentu „${owner}” (np. „@${names[0]}”) — ten import go zmieni. Jeśli to inna rekonstrukcja tego samego dzieła, nadaj jej inny środkowy człon nazw (np. „calosc-2”).`);
  }

  /* 2026-10-25 (Wywód) — Einträge einer Struktur, die kein Baum zeigt: in einem Kreis — oder nach oben auf sich selbst oder ins Leere. */
  const loose = unrootedOf(lib, { kinds, entities });
  const listed = (names: readonly string[]) => `${names.slice(0, 5).map((l) => `„${l.slice(0, 60)}”`).join(', ')}${names.length > 5 ? ` i ${names.length - 5} innych` : ''}`;
  if (loose.circle.length > 0) {
    warnings.push(`Wpisy w kole — każdy leży pod innym, żaden pod początkiem, więc nie pokaże ich żadne drzewo: ${listed(loose.circle)}. Popraw ich połączenie w strukturze.`);
  }
  if (loose.dangling.length > 0) {
    warnings.push(`Wpisy wskazują w górę na siebie albo na wpis, którego nie ma: ${listed(loose.dangling)} — w drzewie staną jako początek, ale widok, który bierze za początek wpisy z pustym polem (jak „Wywód”), ich nie pokaże. Popraw ich połączenie w strukturze.`);
  }

  const lines = [
    kinds.length === 0 ? '' : `Rodzaje: ${kinds.filter((k) => k.isNew).length} nowych, ${kinds.filter((k) => !k.isNew).length} do zmiany.`,
    entities.length === 0 ? '' : `Wpisy: ${entities.filter((e) => e.isNew).length} nowych, ${entities.filter((e) => !e.isNew).length} do zmiany.`,
    ...DOC_KINDS.map((k) => {
      const n = docs.filter((d) => d.kind === k);
      return n.length === 0 ? '' : `${DOC_LABEL[k]}: ${n.filter((d) => d.isNew).length} nowych, ${n.filter((d) => !d.isNew).length} do zmiany.`;
    })
  ].filter(Boolean);
  if (lines.length === 0) return { error: 'W dokumencie nie ma nic do zaimportowania.' };
  return { kinds, entities, docs, lines, warnings };
}

/**
 * 2026-10-25 (Wywód) — EIN WEJŚCIE AUS DEM DOKUMENT, aus seinen rohen Werten aufgelöst (nicht im
 * allgemeinen Durchgang, damit jeder Wert in seinem eigenen Raum gesucht wird):
 * <code>
 *   entry   ein Eintrag DIESER Baza (aus dem Dokument, eine Kennung, ein bleibender Name) — kein Werk, keine Person der Bibliothek
 *   view    ein Widok: aus dem Dokument, eine Kennung, ein bleibender Name — oder sein Name, mit oder ohne „@"
 *   work    ein Werk der Bibliothek: eine Kennung oder ein Schlüssel einer ERKLÄRTEN Quelle (Więcej → Ustawienia → Źródła)
 * </code>
 * Was fehlt, wird genannt; gespeichert wird die Gestalt aus `anchors.ts`.
 */
function planAnchor(
  lib: CogitaLibrary, raw: Record<string, unknown>,
  ctx: { entity: (r: string) => { id: string; kinds: readonly string[] } | null; view: (r: string) => string | null; planned: ImportPlan['docs'] },
  warnings: string[]
): Record<string, unknown> {
  const name = str(raw.name) || 'Wejście';
  const bare = (v: unknown) => str(v).replace(/^@/, '');
  /* Der Eintrag: aus dem Dokument, sonst einer, den es schon gibt. */
  let entry = bare(raw.entry);
  if (entry !== '') {
    /* Auch ein Schlüssel — meist ein Werk, und das wird unten als „nicht aus dieser Baza" genannt. */
    const known = lib.entity(entry) !== undefined ? entry : lasting(entry) ? lib.byImportRef(entry, 'entity')?.id : lib.resolveDeclared(entry);
    const existing = known === undefined ? undefined : lib.entity(known);
    const found = ctx.entity(entry) ?? (existing === undefined ? null : { id: existing.id, kinds: existing.kinds });
    if (found === null) { warnings.push(`Wejście „${name}”: wpisu „${str(raw.entry)}” nie ma — wejście poprowadzi do sposobu wyświetlania bez wpisu.`); entry = ''; }
    else if (found.kinds.some((k) => lib.isForeignKind(k))) { warnings.push(`Wejście „${name}”: „${str(raw.entry)}” to wpis biblioteki albo skryptorium, nie tej bazy — pominięty.`); entry = ''; }
    else entry = found.id;
  }
  /* Der Widok: aus dem Dokument, eine Kennung, ein bleibender Name, sein Name. */
  let view = bare(raw.view);
  if (view !== '') {
    const wanted = view.toLowerCase();
    const found = ctx.view(view) ?? (lib.docs('view').some((e) => e.id === view) ? view : null) ?? (lasting(view) ? lib.byImportRef(view, 'view')?.id ?? null : null)
      ?? ctx.planned.find((d) => d.kind === 'view' && str(d.data.name).toLowerCase() === wanted)?.id
      ?? lib.docs('view').find((e) => str(e.data.name).toLowerCase() === wanted)?.id ?? null;
    if (found === null) warnings.push(`Wejście „${name}”: nie ma sposobu wyświetlania „${str(raw.view)}” — wejście poprowadzi na stronę wpisu.`);
    view = found ?? '';
  }
  /* Das Werk: aus einer Bibliothek, die diese Baza nennt. */
  let work = bare(raw.work);
  if (work !== '') {
    const found = lib.entity(work) !== undefined ? work : lib.resolveDeclared(work) ?? null;
    const target = found === null ? undefined : lib.entity(found);
    if (found === null) { warnings.push(`Wejście „${name}”: dzieła „${str(raw.work)}” nie ma w bibliotekach, z których korzysta ta baza — dodaj bibliotekę w Więcej → Ustawienia → Źródła.`); work = ''; }
    else if (target !== undefined && !target.kinds.includes('work')) { warnings.push(`Wejście „${name}”: „${str(raw.work)}” nie jest dziełem z biblioteki — pominięte.`); work = ''; }
    else work = found;
  }
  if (work === '') warnings.push(`Wejście „${name}”: brak dzieła — przycisk w Bibliotece się nie pojawi.`);
  return anchorData(readAnchor('', { ...raw, entry, view, work }));
}

/**
 * Was ein `@name` an einer Stelle ist (2026-10-25): `all` — ein Verweis, auch mit „/" (ein Verweisfeld,
 * der Verweis einer Zelle, die Gestalt eines Dokuments); `short` — nur ein Name ohne „/" ist ein Verweis,
 * „@autor/rok" bleibt Text (die übrigen Felder eines Eintrags, wie bisher); `none` — freier Text (Name,
 * Suche, Hinweis eines Dokuments), nichts wird aufgelöst.
 */
type RefMode = 'all' | 'short' | 'none';

/**
 * `@name` in den Daten zu Kennungen — in Werten, Listen und den Hüllen unsicherer Werte; was nicht
 * aufgeht, fällt weg (mit Hinweis). Wo was ein Verweis ist, sagt `modeAt`; `resolve` bekommt den Weg
 * der Schlüssel dorthin (der letzte sagt, welche Art gemeint ist).
 */
function refsIn(
  data: Record<string, unknown>, resolve: (ref: string, path: readonly string[]) => string | null,
  missing: (ref: string) => void, modeAt: (path: readonly string[]) => RefMode
): Record<string, unknown> {
  const walk = (v: unknown, path: readonly string[]): unknown => {
    if (typeof v === 'string' && /^@[A-Za-z0-9_.:/-]{1,120}$/.test(v)) {
      const name = v.slice(1);
      const mode = modeAt(path);
      if (mode === 'none' || (mode === 'short' && lasting(name))) return v;
      const id = resolve(name, path);
      if (id !== null) return id;
      missing(name);
      return undefined;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, path)).filter((x) => x !== undefined);
    if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, [...path, k])]).filter(([, x]) => x !== undefined));
    return v;
  };
  return walk(data, []) as Record<string, unknown>;
}

/** Die geplanten Einträge über dem, was schon in der Baza steht — für die Vorschau und die Prüfung der Struktur. */
function plannedSource(lib: CogitaLibrary, plan: Pick<ImportPlan, 'kinds' | 'entities'>): { look: Lookup; src: StructureSource; planned: Map<string, Entity>; structured: Entity[] } {
  const planned = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const kindDefs = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const look: Lookup = { kind: (id) => kindDefs.get(id) ?? lib.kind(id), entity: (id) => planned.get(id) ?? lib.entity(id) };
  const structured = [...planned.values()].filter((e) => isStructured(e, look));
  /* Wer auf wen zeigt — die geplanten Einträge statt ihrer alten Fassung, dazu, was schon dasteht; erst, wenn jemand fragt. */
  const memo: { map: Map<string, Set<string>> | null } = { map: null };
  const pointing = (id: string): ReadonlySet<string> => {
    if (memo.map === null) {
      const map = new Map<string, Set<string>>();
      for (const e of [...planned.values(), ...lib.entities().filter((x) => !planned.has(x.id))]) {
        for (const f of fieldsOf(e, look)) {
          if (f.type !== 'ref') continue;
          for (const v of valuesOf(e, f)) if (typeof v.value === 'string') { const set = map.get(v.value) ?? new Set<string>(); set.add(e.id); map.set(v.value, set); }
        }
      }
      memo.map = map;
    }
    return memo.map.get(id) ?? new Set();
  };
  return { look, src: { entity: (id) => look.entity(id), look, pointing }, planned, structured };
}

/**
 * 2026-10-25 (Wywód) — WAS KEIN BAUM ZEIGT, unter den geplanten Einträgen einer Struktur:
 * <code>
 *   circle    über ihnen (Schritt um Schritt nach oben) kommt kein Eintrag ohne Oberen — ein Kreis („A unter B, B unter A") oder etwas unter einem Kreis
 *   dangling  ihr Feld nach oben nennt nur sich selbst oder einen Eintrag, den es nicht gibt: im Baum ein Anfang, doch ein Widok mit „Feld leer" als Anfang (wie „Wywód") zeigt sie nicht
 * </code>
 * Gibt ihre Etiketten.
 */
function unrootedOf(lib: CogitaLibrary, plan: Pick<ImportPlan, 'kinds' | 'entities'>, cap = 20000): { circle: string[]; dangling: string[] } {
  const { look, src, structured } = plannedSource(lib, plan);
  if (structured.length === 0) return { circle: [], dangling: [] };
  const parents = new Map<string, string[]>();
  const up = (id: string): string[] => { let p = parents.get(id); if (p === undefined) { p = parentsOf(id, src); parents.set(id, p); } return p; };
  const seen = new Set(structured.map((e) => e.id));
  let layer = [...seen];
  while (layer.length > 0) {
    if (seen.size > cap) return { circle: [], dangling: [] };
    const next: string[] = [];
    for (const id of layer) for (const p of up(id)) if (!seen.has(p)) { seen.add(p); next.push(p); }
    layer = next;
  }
  const reached = new Set([...seen].filter((id) => up(id).length === 0));
  let down = [...reached];
  while (down.length > 0) {
    const next: string[] = [];
    for (const id of down) for (const c of childrenOf(id, src)) if (seen.has(c.id) && !reached.has(c.id)) { reached.add(c.id); next.push(c.id); }
    down = next;
  }
  const declaresUp = (e: Entity): boolean => structureFields(e, look).some((f) => f.structure === 'up' && valuesOf(e, f).some((v) => typeof v.value === 'string' && v.value !== ''));
  return {
    circle: structured.filter((e) => !reached.has(e.id)).map((e) => labelOf(e, look)),
    dangling: structured.filter((e) => up(e.id).length === 0 && declaresUp(e)).map((e) => labelOf(e, look))
  };
}

/**
 * 2026-10-25 (Wywód) — WAS EIN IMPORT ALS STRUKTUR ERGIBT, bevor etwas gespeichert ist: die Bäume
 * über den Strukturfeldern (mit dem, was schon in der Baza steht), jede Zeile mit ihrer Stelle im
 * Werk und einem Zeichen — „+" neu, „~" geändert —, und die Wejścia z Biblioteki. Höchstens `max` Zeilen.
 */
export function structurePreview(lib: CogitaLibrary, plan: ImportPlan, max = 80): string[] {
  const isNew = new Map(plan.entities.map((e) => [e.id, e.isNew]));
  const { look, src, structured } = plannedSource(lib, plan);
  const out: string[] = [];
  if (structured.length > 0) {
    const roots = new Set<string>();
    for (const e of structured) for (const r of parentsOf(e.id, src).length === 0 ? [e.id] : rootsAbove(e.id, src)) roots.add(r);
    const line = (id: string, depth: number) => {
      const e = look.entity(id);
      if (e === undefined) return;
      const mark = isNew.get(id) === true ? '+' : isNew.has(id) ? '~' : ' ';
      const place = placeOf(e, src);
      out.push(`${mark} ${'  '.repeat(depth)}${labelOf(e, look).slice(0, 110)}${place !== null && place.locator !== '' ? `  [${place.locator}]` : ''}`);
    };
    const walk = (n: StructNode, depth: number) => {
      if (out.length >= max) return;
      line(n.id, depth);
      for (const c of n.children) walk(c, depth + 1);
    };
    out.push('Struktura (+ nowe, ~ zmienione):');
    for (const r of roots) walk(structureTree(r, src, { label: (e) => labelOf(e, look) }, { nodes: max }).root, 0);
    if (out.length >= max) out.push('… (dalsze kroki pominięte w podglądzie)');
  }
  const anchors = plan.docs.filter((d) => d.kind === 'anchor').map((d) => readAnchor(d.id, d.data));
  if (anchors.length > 0) {
    out.push('Wejścia z Biblioteki:');
    for (const a of anchors) {
      const work = lib.entity(a.work);
      const entry = a.entry === '' ? undefined : look.entity(a.entry);
      out.push(`  „${a.name}” — ${work === undefined ? 'dzieło niedostępne' : labelOf(work, look).slice(0, 80)}, ${a.locator === '' ? 'całe dzieło' : a.locator}${entry === undefined ? '' : ` → ${labelOf(entry, look).slice(0, 80)}`}`);
    }
  }
  return out;
}

/** Den Plan ausführen — erst die Arten, dann die Einträge, dann die Dokumente. Gibt zurück, was ging und was nicht. */
export async function applyImport(lib: CogitaLibrary, plan: ImportPlan, stage: (text: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  const warnings = [...plan.warnings];
  let done = 0;
  const total = plan.kinds.length + plan.entities.length + plan.docs.length;
  const step = () => { done += 1; stage(`Zapisywanie ${done} z ${total}…`); };
  for (const k of plan.kinds) {
    try { await lib.saveKind(k.def, k.marks); } catch (e) { warnings.push(`Rodzaj „${k.def.name}": ${e instanceof Error ? e.message : 'nie udało się'}.`); }
    step();
  }
  for (const e of plan.entities) {
    try { await lib.saveEntity({ id: e.id, kinds: e.kinds, data: e.data, ...(e.marks === undefined ? {} : { marks: e.marks }) }); } catch (err) { warnings.push(`Wpis ${e.id.slice(-4)}: ${err instanceof Error ? err.message : 'nie udało się'}.`); }
    step();
  }
  for (const d of plan.docs) {
    try { await lib.saveDoc(d.kind, d.data, d.id); } catch (err) { warnings.push(`${d.kind} ${d.id.slice(-4)}: ${err instanceof Error ? err.message : 'nie udało się'}.`); }
    step();
  }
  return { lines: [`Zapisano ${total - warnings.length + plan.warnings.length} z ${total}.`, ...plan.lines], warnings };
}

/* -- Beschreibung und Auftrag ------------------------------------------------------------------ */

/** Die Rodzaje dieser Baza wiedzy, kurz — damit ein Dokument sie beim Namen nennen kann. */
const kindsOfBase = (lib?: CogitaLibrary): string =>
  lib === undefined ? '' : `\nRodzaje tej bazy wiedzy:\n${lib.kinds.map((k) => `  "${isBaseKind(k.id) ? k.id : k.name}" — ${k.name}: ${k.fields.map((f) => `${f.key} (${FIELD_TYPE_LABEL[f.type]}${f.multi ? ', kilka' : ''}${f.uncertain ? ', niepewne' : ''})`).join(', ')}`).join('\n')}\n`;

/** Ein Beispielwert je Feld einer Frage — für die Beschreibung (die Art bestimmt, welche gelten). */
const QUESTION_EXAMPLE: Readonly<Record<string, string>> = {
  answers: '["siedem", "7"]', 'number.answers': '["12"]', 'date.answers': '["1410-07-15"]', 'gap.answers': '["Ojczyzno"]', 'date.tolerance': '0', options: '["Pięć", "Siedem", "Dwanaście"]', correct: '[1]', value: 'true',
  left: '["1410", "1569", "1791"]', right: '["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja"]', leftLabel: '"Rok"', rightLabel: '"Wydarzenie"', show: '4',
  items: '["1s", "2s", "2p", "3s"]', back: '["Najmniejsza część pierwiastka"]', tolerance: '0.5', relative: 'false', unit: '"N·m"', quantity: '"Torque"', precision: '"year"',
  task: '"…"', starter: '"def transform(x): …"', createInput: '"def create_input(seed): …"', reference: '"def reference(x): …"', cases: '5',
  place: '{"lat": 53.49, "lon": 20.1}', radius: '20000', drawing: '"{… JSON rysunku …}"', goal: '"abs(x - cel) < 0.5"', solution: '"v0 = 12"'
};

/**
 * 2026-10-27 — DAS SCHEMA DER FRAGE im JSON: ein Rodzaj, die Rodzaje pytań aus `questionTypes.ts`
 * (was der Lernende tut, welche Felder dazugehören) — erzeugt, nie abgeschrieben.
 */
export function questionSection(): string {
  const small = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
  const label = (key: string) => small(QUESTION.fields.find((f) => f.key === key)?.label ?? key);
  const example = (form: string, key: string) => QUESTION_EXAMPLE[`${form}.${key}`] ?? QUESTION_EXAMPLE[key] ?? '…';
  const types = QUESTION_TYPES.map((t) => `    "${t.form}" — ${t.label}: ${t.says} Pola: "prompt" (${small(t.prompt)})${t.fields.map((k) => `, "${k}" (${label(k)}, np. ${example(t.form, k)})`).join('')}`).join('\n');
  return `  pytanie — JEDEN rodzaj "question"; "form" (rodzaj pytania) mówi, jak się pyta, i od niego zależy, które pola się wypełnia:
${types}
    wspólne dla każdego: ${QUESTION_SHARED.map((k) => `"${k}" (${label(k)})`).join(', ')};
      "about": ["@wpis"] — co pytanie sprawdza: jego wynik liczy się do znajomości tych wpisów, a pytanie czeka, aż opanujesz to, co trzeba znać przed nimi;
      "needs": ["@wpis albo @pytanie"] — co trzeba opanować przed tym pytaniem (pytanie ogólne przed szczegółowym)
    pary: lewa i prawa strona w tej samej kolejności; długa lista z "show" (2–${SHOW_MAX}) — na karcie tyle par, każda para ma swoją kartę, wracają te, których uczący się jeszcze nie umie
    np. {"ref": "@q-lata", "kinds": ["question"], "data": {"form": "match", "prompt": "Połącz rok z wydarzeniem", "left": ["1410", "1569", "1791", "1918"], "right": ["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja", "Odzyskanie niepodległości"], "leftLabel": "Rok", "rightLabel": "Wydarzenie", "show": 3}}
    np. {"ref": "@q-atom", "kinds": ["question"], "data": {"form": "one", "prompt": "Co jest w jądrze atomu?", "options": ["Elektrony", "Protony i neutrony", "Tylko neutrony"], "correct": [1], "about": ["@atom"]}}
    np. {"ref": "@q-orbital", "kinds": ["question"], "data": {"form": "truefalse", "prompt": "Na jednym orbitalu mogą być najwyżej dwa elektrony.", "value": true, "about": ["@orbital"], "needs": ["@q-atom"]}}
    "gap" — w treści [[słowo]] to luka (uczący się widzi „…”), a bez "answers" dobrą odpowiedzią jest to słowo`;
}

/** Was ein Formularz dodawania im JSON ist — im Kurs, im Schema und für sich. */
const formsSection = (): string => `"forms" — formularze dodawania (należą do schematu): {"ref", "name", "says", "graph", "keys", "paste", "order"}
  węzeł "pick" — wybór na początek, zostaje dla wszystkich wierszy: "config": {"label", "kinds": ["@rodzaj"], "many", "optional", "value": ["@wpis"]}
  węzeł "entry" — wpis z każdego wiersza: "config": {"kind": "@rodzaj", "also": ["@inny rodzaj"] (rodzaj wybierany przy każdej wartości; na liście przedrostek „Nazwa rodzaju: …”), "label", "many" (kilka w wierszu), "optional": true (może zostać puste — wpisy, do których prowadzi, powstają i bez niego), "reuse": "same|never", "identity": ["pole"],
    "fields": {"pole": {"from": "type|ask|fixed", "value": "tekst"}}} — type: wpisywane w wierszu, ask: ustawiane na początek ("value" — domyślnie), fixed: stała wartość
  krawędź {"id", "from": węzeł, "out": "out", "to": węzeł "entry", "in": klucz pola-odwołania} — wypełnia to pole wpisem z węzła "from";
    kilka krawędzi do pola, które przyjmuje kilka: wartości po kolei według położenia węzłów (z góry na dół); wpis powstaje, gdy w wierszu są wszystkie połączone
  "order": ["id węzła entry"] — kolejność pól w wierszu (Enter, kolumny wklejanej listy); bez niej jak na płótnie
  "keys": {"enter", "ctrlEnter", "shiftEnter"}: ${KEY_ACTIONS.map((k) => `"${k}"`).join(', ')}
  "paste": {"columns": ${COLUMN_SEPARATORS.map((k) => `"${k}"`).join(', ')}, "values": ${VALUE_SEPARATORS.map((k) => `"${k}"`).join(', ')}, "header": true|false}`;

/** Was ein Rodzaj im JSON ist. */
const kindsSection = (): string => `"kinds" — rodzaje:
  "name" — nazwa, "label" — wzór etykiety, np. "{givenNames} {surname}", "tells" — pole, które odróżnia imienników,
  "builtin" — zmiana wbudowanego rodzaju (person, work, quote — z biblioteki; text, delivery, project — ze skryptorium; question);
    innych wbudowanych treści nie ma: rodzaje pisze właściciel bazy albo importuje gotowy schemat (niżej)
  "fields": [{"key", "label", "type", "multi", "uncertain", "unit", "quantity", "options", "to", "inverse", "symmetric", "locator", "structure", "prerequisite", "when", "media", "rangeOf", "says"}]
  "structure" (odwołanie) — połączenie w STRUKTURZE (np. wywód artykułu): "up" — ten wpis leży POD tym, na co wskazuje (krok → krok wyżej: „Należy do"); "down" — wskazane wpisy leżą pod nim („Argumenty za");
    widok „Struktura" z krokiem "structure" rysuje z tego drzewo w kolejności miejsc w dziele; takie pole nie czyni wypowiedzi „interpretacją"
  "prerequisite" (odwołanie) — KOLEJNOŚĆ NAUKI: "up" — to, na co wskazuje, trzeba znać WCZEŚNIEJ (pojęcie → „Wymaga": orbital wymaga elektronu i atomu); "down" — to, na co wskazuje, buduje na tym wpisie („Prowadzi do");
    z takich pól (i z pola "needs" pytań) aplikacja liczy poziomy od podstaw: karty szczegółu przychodzą, gdy podstawy są opanowane (widok albo powtórka z „Filtrem znajomości” "rel": "before" — np. gotowa „Najpierw podstawy”; Nauka → Ścieżka), z kolejnością "general" nowe karty idą od ogólnych do szczegółowych;
    to coś innego niż "structure" (co pod czym leży); koło (A wymaga B, B wymaga A) nie działa i stoi w „Do zrobienia"
    np. {"key": "wymaga", "label": "Wymaga", "type": "ref", "to": ["@pojecie"], "multi": true, "prerequisite": "up", "inverse": "Na tym budują"}
  "when" — pole tylko dla niektórych wartości pola-wyboru tego samego rodzaju: {"field": "typ", "values": ["bitwa", "traktat"]} — JEDEN rodzaj z polem „typ” zamiast osobnego rodzaju dla każdego typu; edytor pokazuje pole tylko przy tych wartościach
  "quantity" (liczba) — jaka wielkość (identyfikator z QUDT, np. "Torque", "Mass"); wtedy wartość wpisuje się w dowolnej jednostce tej wielkości, a zapisuje tak, jak wpisano, razem z SI:
    {"value": 1.5, "unit": "KiloN", "si": 1500} ("unit" — identyfikator jednostki z QUDT: "N", "KiloN", "N-M", "J", "KiloGM", "DEG_C" …; liczba bez jednostki — w jednostce pola);
    np. {"key": "moment", "label": "Moment obrotowy", "type": "number", "unit": "N·m", "quantity": "Torque"}, a we wpisie: "moment": {"value": 12, "unit": "N-M", "si": 12};
    bez "quantity" pole bierze wielkość z jednostki, gdy jest jednoznaczna ("kg" → Mass; "N·m" — moment siły albo energia — trzeba wybrać)
  pytanie z liczbą i wielkością: {"form": "number", "prompt": "Jaki moment siły…?", "answers": ["12"], "unit": "N·m", "quantity": "Torque", "tolerance": 0.1} — „12 N·m" i „0,012 kN·m" są dobre, „12 J" nie (energia, choć wymiar ten sam)
  wielkości i ich jednostki: ${quantitiesDescription()}
  "options" (wybór z listy) — [{"value", "label"}]
  "to" (odwołanie) — na jakie rodzaje wskazuje: ["@ref rodzaju z tego dokumentu", "Nazwa rodzaju", "work"]; puste — na dowolne
  "locator": true (odwołanie z miejscem) — każda wartość to {"value": "@dzielo", "locator": "Ps 110"}: psalm to Biblia z biblioteki + miejsce, hasło to leksykon + „s. 23"; miejsca w Piśmie aplikacja czyta (Ps 110 · Łk 1,46-55) i po nich szuka; tekstu Biblii się nie przechowuje
    np. {"key": "miejsce", "label": "Miejsce w Piśmie", "type": "ref", "to": ["work"], "locator": true}, a we wpisie: "miejsce": {"value": "@bt", "locator": "Ps 110,1-7"}
  "blocks" (treść w blokach) — lista bloków: {"type": "paragraph", "text": "zapis"} | {"type": "ordered"|"unordered", "items": [komórka, …]} | {"type": "table", "columns": ["nagłówek", …], "rows": [[komórka, …], …]};
    komórka to lista kawałków: {"text": "…"} albo {"ref": "@wpis", "locator": "Łk 1,35"} — prawdziwe odwołanie (do wpisu tej bazy, innej bazy albo źródła biblioteki), z miejscem albo bez
    każdy rodzaj z polem "blocks" jest rodzajem WYPOWIEDZI (np. Komentarz): teza = pierwsze zdanie pierwszego akapitu (najwyżej ${THESIS_LIMIT} znaków) — nazwa wpisu i pierwsza strona karty;
    teza zakończona „?” czyni wpis pytaniem — odpowiedzią jest wypowiedź, która się do niego odwołuje; „informacja” (odwołuje się tylko do źródeł biblioteki) albo „interpretacja” (do innej wypowiedzi albo do żadnego źródła) liczy się z odwołań i nie zapisuje się
  gotowe schematy to pliki w repozytorium, importowane jak każdy schemat (Wiedza → Schematy → Rodzaje wpisów → „Schemat jako JSON” → Import): templates/cogita/komentarz.json (Komentarz: „O czym” — odwołania z miejscem do dowolnego wpisu, „Treść” — bloki; z szablonami kart „Teza” i „Tabela z treści”),
    templates/cogita/slownik.json (Język, Słowo, Tłumaczenie, Synonimy, Antonimy — z szablonami „Słówka”), templates/cogita/psalterz.json (psalm z miejscem w Piśmie, miejsca brewiarza),
    templates/cogita/komentarz-biblijny.json (Komentarz z argumentami za i zarzutami, Komentarz biblijny do fragmentu Pisma),
    templates/cogita/pytania.json (jeden schemat pytań: wbudowany rodzaj „Pytanie” z jego rodzajami pytań i polami, sposoby dodawania wielu pytań naraz — prawda/fałsz, odpowiedź słowami, fiszki — i widok „Pytania według rodzaju”),
    templates/cogita/podstawy.json (kolejność nauki: „Pojęcie” z polem „Wymaga” — "prerequisite": "up" —, karty „czym jest”, widok „Od podstaw” i sposób dodawania pojęć z tym, czego wymagają; przykład z atomem do zaimportowania jako kurs: templates/cogita/przyklad-atom.json),
    templates/cogita/fakty.json (fakty i źródła — z dowolnego źródła: powieści o prawdziwej osobie, podręcznika, reportażu, wspomnień, nagrania: „Fakt” — jedno twierdzenie o świecie z hasłem, rodzajem, kiedy, gdzie, o kim, okresem, źródłem z miejscem, tym, jak je podaje źródło, oceną po sprawdzeniu (potwierdzone, sporne, uproszczone, nieprawdziwe, fikcja…) i innymi źródłami; „Okres” — epoka albo etap z czasem trwania; karty „Kiedy?”, „Co wiadomo?”, „Czy to się zgadza?”; widoki według okresów, oś czasu, według oceny i rodzaju, od podstaw),
    templates/cogita/zbior.json (zbiór pozycji do rozpoznania i rozróżnienia — prefacje i modlitwy, pieśni, psalmy, artykuły ustawy, utwory, obrazy: „Pozycja” z numerem, oznaczeniem, początkiem, tym, o czym jest, znakami rozpoznawczymi, obrazem albo dźwiękiem, grupą, miejscem w dziełach, pozycjami łatwymi do pomylenia i różnicą, użyciem; „Grupa” — dział z tym, co go wyróżnia; karty „Która to?” po początku albo obrazie, początki ↔ oznaczenia, „Czym się różni?”; widoki według numeru, grup, podobnych i różnic),
    templates/cogita/ksiazka-AI.md (jak przygotować dowolną książkę z KI w dwóch krokach: Biblioteka z całym tekstem, potem menu wyboru — zakres, warstwy, pytania, kolejność nauki, powtórki — i kurs Cogita),
    templates/cogita/wywod.json (opis dzieła: „Krok wywodu” — rola (pytanie, teza, argument, zarzut… albo wątek, część utworu, wydarzenie, etap, opis), miejsce w dziele, treść, ważny fragment, „Należy do” — połączenie w strukturze, także w kilku strukturach naraz, czas opowieści; „Element stały” — pojęcie, postać, miejsce, motyw… w dziele albo ponad dziełami („Ogólnie”); Komentarz — własna uwaga; widoki „Wywód” (drzewo, kolejność tekstu, czas opowieści), „Elementy stałe”; karty ze ścisłym sprawdzaniem: fragmenty ↔ tezy, teza do fragmentu, dzieło tezy, znaczenie elementu; jak przygotować tekst i strukturę dzieła dla KI w dwóch krokach: templates/cogita/wywod-AI.md)
  typy pól: ${FIELD_TYPES.map((t) => `"${t}" (${FIELD_TYPE_LABEL[t]})`).join(', ')}`;

/** 2026-10-19 — neben dem JSON eines Formulars: nur, was ihn betrifft. */
export function formDescription(lib?: CogitaLibrary): string {
  return `# Formularz dodawania jako JSON

Format: "${SCHEMA_FORMAT}" (ten sam co schemat), wersja 1:
  {"format", "version": 1, "name", "kinds": [...], "templates": [...], "forms": [...]}
  "kinds" — rodzaje, których formularze potrzebują; bez nich muszą już być w tej bazie wiedzy (rozpoznane po "ref", nazwie albo wbudowanym identyfikatorze).
  "templates" — szablony kart dla tych rodzajów (opcjonalnie): {"ref", "name", "kinds": ["@rodzaj"], "direction", "graph", "tests"} ("tests" — co sprawdzają ich karty i jak mocno, jak w kursie).
  Formularz z tym samym "ref" co istniejący zmienia go w miejscu; inny — powstaje nowy. Niczego się nie usuwa.
  "ref" — własna nazwa, np. "@miejsce"; w tym samym dokumencie odwołuje się nią do rodzaju ("kind": "@miejsce", "to": ["@miejsce"]).

${kindsSection()}

${formsSection()}
## Jak aplikacja używa tych danych
  Formularz staje w Wiedzy → „Dodaj” obok innych sposobów dodawania; wiersz po wierszu (albo wklejony tekst) robi z niego wpisy jego rodzajów — przed zapisem widać, co powstanie i co pominięto.
  Zapisane wpisy są zwykłymi wpisami bazy: stoją w „Wpisy” i w widokach, a szablony kart robią z nich karty do Nauki; nowe rodzaje i szablony z dokumentu działają jak dodane ręcznie.
  Kto widzi: ten, kto czyta bazę; dodaje ten, kto może w niej pisać. Import formularza sam niczego nie dodaje do wpisów.
${kindsOfBase(lib)}`;
}

/** Was die Formate bedeuten — neben jedem Import. */
export function courseDescription(lib?: CogitaLibrary): string {
  const kinds = kindsOfBase(lib);
  return `# Cogita jako JSON

Formaty:
  "${COURSE_FORMAT}" — cały kurs: rodzaje, wpisy, szablony kart, powtórki, przebiegi, zbiory, wygląd, zasady, wartości
  "${SCHEMA_FORMAT}" — rodzaje z ich szablonami kart i formularzami dodawania (niezależna kopia do innej bazy wiedzy); eksport schematu nie zawiera widoków, ale import przyjmuje je w każdym formacie, tak jak "anchors"
    schemat może nieść GOTOWE widoki i powtórki ("views", "revisions") — import tworzy je jak każde inne, użytkownik kopiuje je i zmienia; z trwałą nazwą ("@fakty/…") kolejny import schematu je uaktualnia;
    np. templates/cogita/fakty.json niesie widok i powtórkę „Od ogólnego do szczegółu”: {"views": [{"ref": "@fakty/w-ogolne", "name": "Od ogólnego do szczegółu", "steps": [{"type": "source.kind", "config": {"kind": "@czas/okres"}}, {"type": "source.kind", "config": {"kind": "@fakty/fakt"}}, {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "before", "op": "ge", "than": 1}}}]}], "revisions": [{"ref": "@fakty/p-ogolne", "name": "Od ogólnego do szczegółu", "graph": …}]}
  "${ENTITIES_FORMAT}" — same wpisy (także wypowiedzi i pytania)
  "${FLOW_FORMAT}" — przebieg razem z tym, co pokazuje

Wspólne:
  "format", "version": 1, "name" — nazwa
  "ref" — własna nazwa wpisu, np. "@dawid"; inne pola odwołują się do niej tak samo: "@dawid".
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu) albo po trwałej nazwie; import UZUPEŁNIA je w miejscu: pola, których dokument nie wymienia, zostają, a "pole": null usuwa pole; wpisów nie usuwa. Przed zapisem każdą zmianę w tym, co już jest, trzeba przyjąć (i można ją poprawić).
  Rodzaj można wskazać jego trwałą nazwą ("kinds": ["@wywod/krok"]) — znajdzie się także po zmianie nazwy.
  Nazwa z „/" jest TRWAŁA: zostaje przy wpisie (także przy widoku, wejściu, szablonie, formularzu, rodzaju), a ten sam dokument zaimportowany drugi raz zmienia te same rzeczy zamiast tworzyć nowe; wielkość liter nie ma znaczenia.
    Kroki rekonstrukcji: "@<klucz dzieła>/<rekonstrukcja>/<krok>", np. "@kowalski2020/calosc/pytanie", "@kowalski2020/wstep/arg1" — każda rekonstrukcja jednego dzieła ma własny środkowy człon.
    Trwałe nazwy są wspólne dla całej bazy: dokument, który trafia w nazwy wpisów z innego dokumentu, zmieni je (podgląd to mówi) — inna rekonstrukcja potrzebuje innego członu (np. "calosc-2").
    Nazwy bez „/" działają tylko w swoim dokumencie. Rodzaje i wpisy mają wspólne nazwy, każdy rodzaj dokumentów (widoki, wejścia, szablony…) własne: wejście "@q" nie zmieni wpisu "@q".
    W polu-odwołaniu i w odwołaniu komórki ("ref") nazwa, która nigdzie nie prowadzi, wypada (z ostrzeżeniem); w polu tekstowym "@autor/rok" jest tekstem i zostaje.
  Dzieło, osobę, cytat z biblioteki wskazuje się jej kluczem albo identyfikatorem ("@kowalski2020") — tylko z bibliotek, z których korzysta ta baza (Więcej → Ustawienia → Źródła); nie tworzy się ich tutaj.
  Eksport zapisuje trwałe nazwy, a identyfikatory własnych wpisów, rodzajów i dokumentów w widokach, szablonach, powtórkach, przebiegach, zbiorach i formularzach jako "@nazwa" — da się go zaimportować do innej bazy.

Kto czyta: bazę czyta ten, kto czyta jej obszar. W obszarze jawnym (gdy baza jest otwarta: Ustawienia → Kto czyta) każdy, bez konta — cała baza, także odpowiedzi pytań i szkice.
  Pojedynczych wpisów się nie publikuje: to, co ma być publiczne, trafia do osobnej bazy w obszarze jawnym (wpis → Kto widzi → Przenieś; identyfikator zostaje). Moduły stron (powtórka, przebieg, karta wpisu) czytają bazę tak, jak widzi ją czytelnik strony.

${kindsSection()}
  wartość niepewna: {"value": …, "state": "known|approximate|disputed|unknown|na|pending", "source": {"work": "@dzielo", "locator": "s. 23"}, "note": "…"}
  data: "1999", "1999-05", "1999-05-03", "-1000" (przed Chr.); zakres: {"segments": [{"from": 992, "to": 1000}]}

"entities" — wpisy: {"ref", "kinds": ["person", "Postać"], "data": {pole: wartość}}
  wypowiedź — wpis rodzaju z polem "blocks", np. komentarz z templates/cogita/komentarz.json:
    "kinds": ["Komentarz"], "data": {"about": [{"value": "@bt", "locator": "Łk 1,35"}], "content": [{"type": "paragraph", "text": "Duch Święty zstępuje na Maryję jak na Apostołów. Łukasz opisuje oba wydarzenia tymi samymi słowami."}, {"type": "table", "columns": ["Zwiastowanie", "Pięćdziesiątnica"], "rows": [[[{"ref": "@bt", "locator": "Łk 1,35"}], [{"ref": "@bt", "locator": "Dz 1,8"}]]]}]}
    rodzaju „wiedza” ("knowledge") już nie ma — stare takie wpisy stoją w Wiedzy pod „Stare wpisy”
    tematów i perspektyw nie ma — porządek dają własne rodzaje (np. "Tajemnica" z polami "numer" i "czesc" → rodzaj "Część"; "Obszar" z polem "grupa"), a wpisy wskazują na nie polami-odwołaniami (komentarz: "about"; kazanie: pola swojego rodzaju tekstu, np. "tajemnica", "obszar")
    rodzaj tekstu ze skryptorium, z którego korzysta baza, jest tu rodzajem: tekst ma jego pola obok stałych (tytuł, data, plan…) — widoki grupują i macierze ustawiają teksty według nich
    karty z wypowiedzi: szablon z "kinds": ["@rodzaj z polem blocks"] i węzłami "statement.thesis" (teza), "statement.part" ({"n": 2} — drugi kawałek; puste: akapity), "statement.table" ({"table": 1, "left": 1, "right": 2} — pary z kolumn), "statement.subjects" (o czym: wartości pól-odwołań, z miejscem)
    zapis tekstu w akapicie i w polach "markup" (ten sam co w Skryptorium): akapity oddziela pusta linia, "## śródtytuł", **pogrubienie**, *kursywa*, [opis](https://…), ^[przypis], "> cytat", "- punkt";
    [[słowo|@wpis]] — link do wpisu (tej bazy, innej bazy albo biblioteki) z tymi słowami; nigdy przypis;
    [@dzielo, s. 23] — źródło: dzieło, cytat, osoba z biblioteki staje się przypisem; ten sam zapis na wypowiedź, wpis czy tekst daje w tekście link „(zob. etykieta)”
${questionSection()}
    "interactive" — rysunek do poruszania: "drawing" (ten sam JSON co moduł strony „Animacja”: vars, let, sim, controls, rules z "goal": true, world, elements — jako tekst JSON),
    "goal" (wyrażenie celu, np. "abs(x - cel) < 0.5 && y <= 0"; puste — reguły rysunku z "goal"), "solution" ("kat = 45; v0 = sqrt(cel*g)" — rachunek z wartościami rysunku; w świecie także "w2.pos = 5"; puste — "task.solve" rysunku, a jego "task" losuje przy każdej próbie zadanie tak samo trudne);
    sprawdzane przez symulację ustawionych wartości do końca (świat — odtworzony według jego reguł: co zablokowane, zostaje); wartości z "random" losowane przy każdej próbie

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}, "tests"}
  szablon może dotyczyć rodzaju z biblioteki ("quote", "work", "person") albo ze skryptorium ("text", "delivery", "project"), z których korzysta ta baza: wtedy karty powstają z ich wpisów, np. {"name": "Miejsce cytatu", "kinds": ["quote"], "direction": "locator", "graph": …}
  "tests" — co sprawdzają karty szablonu i jak mocno: [{"of": "this" (ten wpis) | "klucz pola-odwołania" (wpisy, na które wskazuje), "weight": 0–10}]; bez "tests": ten wpis z wagą 1.
    Znajomość należy do wpisu, a karta jest jego dowodem: dokładne pytanie waży więcej niż ogólne, jedna karta może liczyć się dla kilku wpisów;
    np. karta „Co się wtedy stało?” faktu: "tests": [{"of": "this", "weight": 1}, {"of": "okres", "weight": 0.3}, {"of": "gdzie", "weight": 0.3}]

Znajomość — liczy ją aplikacja, tak samo wszędzie (nie ustawia się jej w JSON):
  każda odpowiedź zostaje zapisana; karta pamięta tylko kilka wartości: kiedy ostatnio odpowiedziano, ile czasu naprawdę minęło przed tą odpowiedzią, odstęp do następnego razu i najlepszy odstęp przed ostatnim błędem;
  dobrze (od 90%): odstęp = czas, który naprawdę minął × 3 (odpowiedź przed terminem go nie skraca); częściowo: jedna trzecia tego czasu, co najmniej dzień, jeśli minęły dni; źle (poniżej 25%): 5 minut; dobrze zaraz po błędzie: 0,4 × najlepszy odstęp sprzed błędu
    — np. źle po 5 dniach: wraca po 5 minutach; dobrze zaraz potem: za 2 dni; znów dobrze po 2 dniach: za 6 dni;
  znajomość karty: poprawność ostatniej odpowiedzi × 10^(0,5·(1 − czas od odpowiedzi ÷ odstęp)) — zaraz po dobrej 3,16, w dniu powtórki 1 („umiem” od 1), potem spada; po złej 0;
  znajomość wpisu: średnia znajomości jego kart Z ODPOWIEDZIĄ, ważona "weight" z "tests" (karta jeszcze nie pytana nie jest dowodem), plus to, co na nim buduje (pola z "prerequisite" — połowa znajomości tego, co od wpisu zależy — i zależności z Ustawień, z ich wagą)

"revisions" — powtórki: {"name", "graph"} (źródła → kroki → … → jeden „Sposób pytania")
  także kroki wspólne z widokami: {"type": "follow", "config": {"field": "authors", "back": false}} — karty wpisów, do których prowadzi odwołanie (albo, "back": true, które wskazują na te wpisy); {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field", "cmp", "value"}]}}} — karty wpisów spełniających regułę; {"type": "structure", "config": {"dir": "down|up", "one": true}} — karty wpisów, które leżą w strukturze pod tymi wpisami (albo nad nimi); "follow" i "structure" z "keep": true zostawiają też karty, od których wyszły
  źródło „rodzaj z biblioteki": {"type": "source.kind", "config": {"kind": "quote", "from": "<identyfikator biblioteki>"}} — "from" puste: z tej bazy i ze wszystkich źródeł
  źródło „widok”: {"type": "source.view", "config": {"view": "@widok"}} — karty wpisów, które pokazuje zapisany widok: widok decyduje, co wchodzi w grę, powtórka z tego wybiera; zmiana widoku zmienia powtórkę, a jego „Filtry znajomości” na końcu działają w trakcie powtórki
    np. {"name": "Od ogólnego do szczegółu", "graph": {"nodes": [{"id": "w", "type": "source.view", "config": {"view": "@fakty/w-ogolne"}}, {"id": "p", "type": "strategy", "config": {"mode": "temporal", "order": "general"}}], "edges": [{"id": "e1", "from": "w", "out": "cards", "to": "p", "in": "cards"}]}}
  „Filtr znajomości”: {"type": "filter.when", "config": {"when": warunek}} — zostają karty, dla których warunek jest spełniony, sprawdzany W TRAKCIE powtórki przy każdej karcie: co czekało, wchodzi, gdy warunek zacznie obowiązywać; karta już w stosie zostaje
    warunek to ta sama logika co w przebiegach: {"type": "knowness", "rel": "before", "op": "ge", "than": 1} — znajomość tego, co trzeba znać wcześniej, co najmniej 1;
    "rel": "self" (ten wpis) | "cards" (jego karty; w powtórce: ta karta) | "before" (to, co trzeba znać wcześniej — najbliższe wpisy z kartami w kolejności nauki) | "up" (to, pod czym leży w strukturze) | klucz pola-odwołania (to, na co wskazuje, np. "okres");
    "each": "all" (domyślnie — każdy) | "any" (choć jeden); gdy nic takiego nie ma, "all" jest spełnione; "of": "@wpis" zamiast "rel" — znajomość jednego wpisu; warunki łączą "and" / "or" / "not": {"type": "and", "items": [ … ]}
  „Idź po kolejności nauki”: {"type": "learning", "config": {"dir": "before" | "after", "one": true, "keep": true}} — karty tego, co trzeba znać wcześniej (albo, "after", co na tym buduje), aż do podstaw albo ("one") o krok; "keep": true dokłada je do kart wyjściowych
  „Sposób pytania” ("strategy"): {"mode": "temporal" (według tego, co umiem) | "levels" | "once" | "random", "order", "pick", "stackSize", "count", "levels", "minCorrectness", "rule"}
    "order" — kolejność: "general" (najpierw ogólne — według poziomów kolejności nauki) | "text" (jak w tekście źródła — miejsce w dziele) | "date" (według najwcześniejszej daty wpisu) | "random" | "given" (jak przychodzą) | "due" (najpierw zaległe); bez "order": w stosie "general", w stałej kolejce "random"
    "pick" — wybór ze stosu: "next" (ściśle następna według kolejności) | "weighted" (losowo, częściej to, co słabiej znane i dłużej czeka; domyślnie); przy każdej karcie uczący się widzi, dlaczego przyszła
  „Najpierw podstawy” to zwykłe kroki: {"type": "learning", "config": {"dir": "before", "keep": true}} → {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "before", "op": "ge", "than": 1}}} → „Sposób pytania” z "order": "general"; dawny krok "gate" import i eksport zamieniają na nie
"flows" — przebiegi: {"name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "slots", "goals", "lines", "narrators"}
  "narrators" — kto opowiada, według wartości: [{"character": "@piotr", "condition": {"type": "value", "value": "przewodnik", "op": "eq", "than": 1}}, {"character": "@maria"}] — opowiada pierwszy, którego warunek jest spełniony (bez warunku: zawsze); jego portret i imię stoją nad krokiem i zapowiadają jego tytuł
  krok "scene" {"page": "adres/strony", "scene": "klucz sceny", "title"} — scena prezentacji; wyjścia "next", przy pytaniu na scenie "right" / "wrong", przyciski "b0", "b1", …
  przebieg z prezentacji (jedna opowieść, nie kopia): {"name": "Droga", "look": "scenes", "presentation": "parafia/droga", "narrators": […]} — bez własnego "graph": jego mapą jest storyboard strony (sceny, przejścia, pytania, warunki, wartości — "story" w JSON strony); w Nauce gra tę prezentację, a odpowiedzi, wartości i miejsce, w którym ktoś skończył, liczą się w tej bazie (to samo miejsce co na stronie); zobaczy ją tylko ten, kto może zobaczyć stronę
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"views" — widoki (te same kroki co powtórka, po wpisach): {"name", "mode": "table|tree|matrix|map|canvas", "steps": [krok, …], "query", "group", "matrix", "columns": ["klucz pola" | "#axis:@oś"], "sort": {"key", "dir": 1|-1}}
  na początku źródła — kilka pod rząd sumuje się (np. kazania i komentarze): "source.all" | "source.kind" {"kind": "@rodzaj" albo "text" ze skryptorium, "from"} | "source.collection" {"collection": "@zbiór"} | "source.list" {"ids": ["@wpis"]};
  także "source.from" {"entry": "@kazanie"} — to, na co wskazuje wpis (kazanie: jego cytaty, wypowiedzi, słowa ze słownika, miejsca z planu; w powtórce: „Z wpisu" — powtórka z kazania);
  potem "follow" {"field", "back"}, "structure" {"dir": "down|up", "one": true} (po polach struktury — bez "one": do samego końca; "one": true — jeden poziom) i "filter.rule" {"rule"} (źródło po innym kroku zaczyna od nowa);
  także "filter.when" {"when": warunek} i "learning" {"dir", "one", "keep"} — te same co w powtórce; w widoku liczy się znajomość tego, kto patrzy (uczącego się na tym koncie; na stronie — osoby strony albo tej przeglądarki),
    np. fakty okresu dopiero, gdy okres jest znany: {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "okres", "op": "ge", "than": 1}}}; tylko wpisy, których podstawy są znane: "rel": "before";
  kolumny i "sort" ze znajomości: "#knowness" (znajomość wpisu), "#due" (kiedy powtórzyć), "#level" (poziom w kolejności nauki), np. "sort": {"key": "#knowness", "dir": 1} — najpierw najsłabsze;
  "mode": "outline" (Struktura) rysuje źródła jako korzenie, a pod nimi to, do czego prowadzą kroki; "outline": {"chip": "klucz pola nad każdym krokiem (np. rola)", "order": "tree|text" (bez "order": ostatni wybór czytelnika, a na początek kolejność tekstu u Tomasza i drzewo w innych dziełach), "by": "klucz pola, według którego najpierw układają się kroki jednego poziomu (np. czas — czas opowieści; bez \"by\": według miejsca w dziele)", "tie": "klucz pola przy tym samym miejscu (np. nr)"};
    widok otwarty od wpisu (wejście z Biblioteki) zastępuje tym wpisem wszystko przed pierwszym „Idź po…”; np. {"name": "Wywód", "mode": "outline", "steps": [{"type": "source.kind", "config": {"kind": "@krok"}}, {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field": "nalezy", "cmp": "empty"}]}}}, {"type": "structure", "config": {"dir": "down"}}], "outline": {"chip": "rola", "order": "tree", "tie": "nr"}}
  grupowanie (drzewo "group", wiersze i kolumny "matrix": {"rows": grupowanie, "cols": grupowanie}): {"by": "kind"} | {"by": "field", "field": "klucz"} | {"by": "axis", "kind": "@rodzaj", "via", "through", "sort", "group"} — OŚ: jej wartości to wpisy rodzaju
    "via": ["pole"] — przez które pola-odwołania wpis należy do wartości (puste: przez dowolne); "through": "pole" albo "*" — także o jeden krok dalej (wpis → przez to pole → inny wpis → przez "via" → wartość)
    "sort": {"field": "numer"} — kolejność według pola liczbowego wartości, albo {"list": "@rozaniec", "field": "tajemnice"} — według kolejności w polu-odwołaniu innego wpisu; bez "sort" — według nazwy
    "group": "czesc" — nagłówki: pole-odwołanie wartości (np. część tajemnic); w macierzy nad kolumnami i między wierszami
  kolumna "#axis:@rodzaj" — wartości tej osi (wpisy rodzaju), na które wskazuje wpis
  np. {"name": "Postacie według okresu", "mode": "tree", "steps": [{"type": "source.kind", "config": {"kind": "@postac"}}], "group": {"by": "axis", "kind": "@okres", "via": ["okres"], "sort": {"field": "od"}}}
  np. macierz 20 × 12 — Tajemnica × Obszar: {"name": "Tajemnica × Obszar", "mode": "matrix", "steps": [{"type": "source.kind", "config": {"kind": "text"}}, {"type": "source.kind", "config": {"kind": "@komentarz"}}], "matrix": {"rows": {"by": "axis", "kind": "@tajemnica", "sort": {"field": "numer"}, "group": "czesc"}, "cols": {"by": "axis", "kind": "@obszar", "group": "grupa"}}}
    — 20 tajemnic różańca (w czterech częściach) × 12 maryjnych obszarów (w grupach); w polu: kazania ze skryptorium (rodzaj tekstu „Kazanie maryjne” z polami "tajemnica" i "obszar") i komentarze, których "about" wskazuje tajemnicę i obszar; puste pola też są widoczne
  na stronie: moduł "view" {"library": "<id bazy>", "view": "<id widoku>", "mode": "tabela|drzewo|macierz|mapa"} — pole macierzy (klik) i wpis otwierają się pod spodem, droga w adresie osobno dla każdego modułu
"anchors" — wejścia z Biblioteki: {"ref", "name", "work": "@klucz dzieła albo identyfikator", "locator": "s. 45–60" | "s. 1–3; 27–30" | "I q. 2 a. 3; a. 4" | "" (całe dzieło), "entry": "@wpis tej bazy (nie dzieło)", "view": "@widok albo jego nazwa", "note"}
  przy dziele w Bibliotece pojawia się przycisk z nazwą wejścia — tylko dla tych, którzy mogą czytać tę bazę (Biblioteka niczego nie zapisuje); kilka wejść jednego dzieła może dotyczyć całości, początku, końca, także kilku części naraz
  części oddziela „;”; część, która zaczyna się niżej niż poprzednia, należy do jej ramy („I q. 2 a. 3; a. 4” — artykuł 4 tej samej kwestii; „t. 2, rozdz. 1; rozdz. 9” — rozdział 9 tego samego tomu)
${formsSection()}
${COURSE_USAGE}
${kinds}`;
}

/**
 * 2026-10-30 — WAS AUS DEM IMPORTIERTEN WIRD, im ganzen System (der Wunsch des Besitzers: neben jedem Import, wie die
 * Daten gebraucht werden). Jede Zeile ist im Code nachgeprüft.
 */
const COURSE_USAGE = `## Jak aplikacja używa tych danych
  Wiedza: wpisy stoją w „Wpisy” (tabela, drzewo, struktura, macierz, płótno — według widoków), każdy ze swoją stroną (pola, odwołania, kolejność nauki); rodzaje, szablony, widoki i sposoby dodawania — w „Schematach”; wejścia ("anchors") dają przy dziele w Bibliotece i w czytniku przycisk „W Wiedzy”.
  Nauka: szablony robią z wpisów karty (z kluczem „szablon:wpis”); powtórki wybierają z kart i pytają; „Ścieżka” pokazuje kolejność nauki; widoki i powtórki z „Filtrem znajomości” pokazują to, co uczący się już może.
  Odpowiedzi: każda zapisuje się zaszyfrowana w przeglądarce — dla uczącego się i dla obszaru przyjęć kursu (Ustawienia), gdzie nauczyciel widzi „Postępy”; z nich liczy się znajomość kart i wpisów. Serwis nie czyta odpowiedzi; widzi tylko, kiedy następna powtórka i ile kart czeka — na osobę i bazę (do przypomnienia).
  Strony: moduły „Widok” (tabela, drzewo, macierz, mapa), „Powtórka”, „Kurs / opowieść”, „Karta wpisu” czytają bazę tak, jak widzi ją czytelnik strony; uczy się osoba strony (zalogowana — ona sama, bez konta — ta przeglądarka).
  Inne bazy wiedzy, które korzystają z tej jako źródła, widzą jej rodzaje, wpisy, szablony, powtórki i przebiegi tylko do odczytu; link dla AI i MCP czytają ją bez zmian.
  Kto czyta: ten, kto czyta jej obszar (w obszarze jawnym — każdy); wpisy są szyfrowane kluczem obszaru.
  Import niczego nie usuwa i nie dotyka odpowiedzi ani postępów: nowa karta zaczyna bez historii, a karta, której poprawna odpowiedź się zmieniła, zaczyna historię od nowa (zmiana wag "tests" historii nie zmienia).
`;

/**
 * DER AUFTRAG FÜR DIE EIGENE KI [P13] — zum Kopieren: was sie tun soll, das
 * Format, die Rodzaje dieser Bibliothek, und der Text, aus dem sie schöpft.
 */
export function aiPrompt(lib: CogitaLibrary, what: 'entities' | 'statements' | 'questions' | 'flow' | 'schema', source: string): string {
  /* 2026-10-23 — Aussagen statt „Wiedza": Einträge eines Rodzaj mit Feld blocks; fehlt er, bringt das Dokument den Komentarz mit. */
  const said = lib.kinds.filter((k) => k.fields.some((f) => f.type === 'blocks')).map((k) => `"${k.name}"`);
  const task = {
    entities: 'Wypisz z tekstu osoby, miejsca, dzieła i inne rzeczy jako wpisy.',
    statements: `Rozbij tekst na wypowiedzi — wpisy rodzaju z polem "blocks" (${said.length > 0 ? `w tej bazie: ${said.join(', ')}` : 'w tej bazie jeszcze go nie ma: dodaj w "kinds" {"ref": "@komentarz", "name": "Komentarz", "label": "{content}", "fields": [{"key": "about", "label": "O czym", "type": "ref", "multi": true, "locator": true}, {"key": "content", "label": "Treść", "type": "blocks"}]}'}). Każda zaczyna się od tezy — jednego krótkiego zdania; dalej akapity, listy, tabele; odwołania do wpisów jako {"ref": "@…", "locator": "…"} w komórkach albo [[słowo|@ref]] w akapicie.`,
    /* 2026-10-27 — ein Schema mit Rodzaje pytań, und die Reihenfolge: das Allgemeine vor dem Besonderen. */
    questions: 'Ułóż z tekstu pytania sprawdzające (jeden rodzaj "question"), w różnych rodzajach pytań ("form": text, one, many, truefalse, match, order, gap, flash…) — dobierz rodzaj do tego, o co pytasz (daty i ich wydarzenia: "match" z "show"; zdanie do oceny: "truefalse"). Najpierw pytania o rzeczy ogólne, potem szczegółowe: pytanie, do którego trzeba znać odpowiedź na inne, ma "needs": ["@tamto"]; "about" wskazuje wpisy, które pytanie sprawdza.',
    flow: `Ułóż przebieg (format ${FLOW_FORMAT}): kroki pokazujące wypowiedzi i pytania; wszystkie teksty to wypowiedzi (wpisy z polem "blocks"), a nie tekst przebiegu.`,
    schema: 'Zaproponuj rodzaje (kinds) z polami, które opiszą takie wpisy.'
  }[what];
  return `${task}
Odpowiedz WYŁĄCZNIE dokumentem JSON w formacie "${what === 'flow' ? FLOW_FORMAT : what === 'schema' ? SCHEMA_FORMAT : ENTITIES_FORMAT}" (wersja 1), bez komentarzy.
Używaj własnych nazw "ref" (np. "@dawid") i odwołuj się nimi między wpisami.

${courseDescription(lib)}
Tekst źródłowy:
"""
${source.trim()}
"""
`;
}
