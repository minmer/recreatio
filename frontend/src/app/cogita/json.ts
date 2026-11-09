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
import { appLang, t } from '../core/i18n';
import { addFormDoc, COLUMN_SEPARATORS, KEY_ACTIONS, mapFormRefs, readAddForm, VALUE_SEPARATORS } from './addForm';
import { readTemplate } from './cards';
import { migratePrerequisites, readFlow } from './flow';
import { flowProblems } from './flowCheck';
import { detourProblems } from './detour';
import { mountainProblems, type MountainContext } from './mountain';
import { graphJson, readGraph, type Graph, type GraphNode } from './graph';
import { migrateRevision, MODES, PICKS } from './revision';
import { readRewards, rewardsData } from './rewards';
import { DOC_KINDS, DOC_LABEL, isBaseKind, kindDoc, QUESTION, type DocKind } from './kinds';
import { QUESTION_SHARED, QUESTION_TYPES, SHOW_MAX } from './questionTypes';
import { anchorData, readAnchor } from './anchors';
import { FIELD_TYPE_LABEL, FIELD_TYPES, fieldsOf, labelOf, readKind, valuesOf, type Entity, type FieldDef, type KindDef, type Lookup } from './schema';
import { childrenOf, isStructured, parentsOf, placeOf, rootsAbove, structureFields, structureTree, type StructNode, type StructureSource } from './structure';
import type { BatchItem, CogitaLibrary } from './store';
import { AXIS_COLUMN, readView, viewJson } from './views';
import { landscapeImportWarnings } from './landscapeImport';
import { generatorImportWarnings } from './generatorImport';
import { slideImportWarnings } from './slideLint';
import { interactiveImportWarnings } from './interactiveCheck';
import { crossImportWarnings } from './worldsImport';
import { isCross } from './worlds';
import { quantitiesDescription } from '../core/quantities';
import { generatorExprDescription } from '../pages/motion/expr';
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
  anchor: 'anchors',
  /* 2026-11-02 — Nagrody: punkty, seria, cel dnia, poziomy, odznaki (`rewards.ts`). */
  reward: 'rewards',
  /* 2026-11-09 — die Lage der Weltkarte: gerechnet, nie exportiert oder eingespielt (spec §9.7). */
  worldmap: 'worldmaps'
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/* -- Hinaus ---------------------------------------------------------------------------- */

/**
 * 2026-10-25 — DER NAME EINES EIGENEN EINTRAGS IM JSON: sein bleibender Name aus einem Import
 * (`_ref`, etwa `kowalski2020/pytanie`), sonst seine Kennung. So lässt sich ein Export wieder
 * einlesen — auch in einer anderen Baza — und ändert dort beim zweiten Mal dieselben Einträge.
 */
export const nameIn = (lib: CogitaLibrary) => (id: string): string => {
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
    /* 2026-11-05 (Prompt 24) — ein Verweis in eine andere Baza ("@@historia:@…") geht hinaus, wie er steht. */
    const swap = (one: unknown): unknown => (typeof one === 'string' && one !== '' ? (isCross(one) ? one : `@${name(one)}`) : isObject(one) && typeof one.value === 'string' && !isCross(one.value) ? { ...one, value: `@${name(one.value)}` } : one);
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
    /* 2026-11-09 — die Lage der Weltkarte ist gerechnet (nie im JSON eines Kurses, spec §9.7). */
    if (kind === 'kind' || kind === 'merge' || kind === 'contribution' || kind === 'worldmap') continue;
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
/* 2026-11-05 (Prompt 24) — dazu der bleibende Name der Baza ("handle") und die anderen Welten, auf die sie verweist ("worlds"). */
const SETUP_SETTINGS = ['sources', 'dependencies', 'tags', 'motivation', 'dailyGoal', 'rewards', 'offline', 'joinPage', 'language', 'handle', 'worlds', 'levelsSetup'] as const;

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
  try { made = await lib.cards(); } catch (e) { made = { cards: [], problems: new Map() }; failed = e instanceof Error && e.message !== '' ? e.message : t('cogitaData.import.cardsFailed'); }
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
      /* 2026-10-30 — was ihre Karten prüfen, und wie stark; 2026-11-01 — welchen Fakt sie fragen (geteilte Antworten). */
      ...(t.tests.length === 0 ? {} : { tests: t.tests }),
      ...(t.asks.length === 0 ? {} : { asks: t.asks })
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
  if (!isObject(doc)) return { error: t('cogitaData.import.notJson') };
  if (!Array.isArray(doc.forms) || doc.forms.length === 0) return { error: t('cogitaData.import.noForms') };
  const extra = ['entities', 'revisions', 'flows', 'collections', 'looks', 'rules', 'values', 'views', 'settings', 'rewards'].filter((k) => doc[k] !== undefined);
  /* 2026-11-03 — die Kennungen des ganzen Dokuments: die Vorschau und das Speichern geben Neuem dieselben (`importIds`). */
  const plan = planImport(lib, { format: doc.format, version: doc.version, name: doc.name, kinds: doc.kinds, templates: doc.templates, forms: doc.forms }, { ids: importIds(lib, doc) });
  if ('error' in plan || extra.length === 0) return plan;
  return { ...plan, warnings: [...plan.warnings, t('cogitaData.import.skippedElsewhere', { list: extra.join(', ') })] };
}

/** Ein Ablauf mit allem, was er zeigt [F34]. */
export function exportFlow(lib: CogitaLibrary, flowId: string): Record<string, unknown> | null {
  const entry = lib.docs('flow').find((e) => e.id === flowId);
  if (entry === undefined) return null;
  const flow = readFlow(entry.id, entry.data);
  const shown = new Set<string>();
  for (const n of flow.graph.nodes) for (const v of Object.values(n.config)) if (typeof v === 'string' && lib.entity(v) !== undefined) shown.add(v);
  for (const l of flow.lines) { shown.add(l.character); shown.add(l.of); }
  /* 2026-10-22 (Schritt 12) — die Erzähler gehen mit; 2026-11-03 (G) — und die Einheit, die die Erzählung ist. */
  for (const one of flow.narrators) shown.add(one.character);
  if (flow.unit !== undefined && lib.entity(flow.unit) !== undefined) shown.add(flow.unit);
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
  /**
   * 2026-11-03 — Neues aus dem Dokument, das dieser Plan NICHT speichert (in der Durchsicht abgewählt), mit seinem Namen:
   * zeigt etwas, das gespeichert wird, darauf, geht der Zapis nicht (`importProblems`).
   */
  readonly unsaved?: ReadonlyMap<string, string>;
  /** 2026-11-03 — wie die Vorschau die Einträge nannte (ein Eintrag eines abgewählten Rodzaj hat sonst kein Etikett). */
  readonly titles?: ReadonlyMap<string, string>;
  /**
   * 2026-11-03 — WAS DERSELBE ZAPIS LÖSCHT (`{"ref": "<kennung>", "remove": true}` in "entities" oder einer Liste von
   * Dokumenten): eigene Einträge und Dokumente dieser Baza, jedes mit seinem Namen. Verweise darauf: `removalEffects`.
   */
  readonly removals?: readonly ImportRemoval[];
}

/** 2026-11-03 — eine Löschung eines Imports. */
export interface ImportRemoval {
  readonly id: string;
  readonly target: 'entity' | 'doc';
  /** Bei einem Dokument: seine Art. */
  readonly kind?: DocKind;
  readonly title: string;
}

/**
 * 2026-11-03 — DIESELBEN KENNUNGEN FÜR DASSELBE DOKUMENT. Die Vorschau, die Durchsicht und das Speichern planen ein
 * Dokument je für sich. Vorher bekam dabei jedes Neue jedes Mal eine neue Kennung: was die Durchsicht als angenommen
 * vermerkte (`k:<kennung>`, `e:<kennung>`), fand das Speichern nicht wieder — alles Neue fiel still weg, und die
 * angenommenen Änderungen an Bestehendem zeigten auf Kennungen, die nie gespeichert wurden. Jetzt merkt sich jedes
 * Dokument (dasselbe Objekt) je Baza, welche Kennung es welchem Neuen gab (je Stelle im Dokument), und jede Planung
 * gibt dieselbe — ausser, es gibt sie inzwischen (das Dokument ist schon gespeichert: ein Neues ohne bleibenden Namen
 * wird dann wieder neu, wie bisher).
 */
export type ImportIds = Map<string, string>;
const MINTED = new WeakMap<object, Map<string, ImportIds>>();

/** Die Kennungen, die dieses Dokument in dieser Baza vergibt (dasselbe Objekt — dieselbe Liste). */
export function importIds(lib: CogitaLibrary, doc: unknown): ImportIds {
  if (typeof doc !== 'object' || doc === null) return new Map();
  let per = MINTED.get(doc);
  if (per === undefined) { per = new Map(); MINTED.set(doc, per); }
  let ids = per.get(lib.libraryId);
  if (ids === undefined) { ids = new Map(); per.set(lib.libraryId, ids); }
  return ids;
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
  template: 'template', templates: 'template', look: 'look', rules: 'rules', form: 'addform', addform: 'addform',
  /* 2026-11-01 — die nächste Lektion einer Powtórka („Następna lekcja"). */
  next: 'revision',
  /* 2026-11-02 — die Nagrody der Nauka (Ustawienia `rewards`). */
  reward: 'reward', rewards: 'reward'
};
/** Wo in einem Dokument freier Text steht — ein „@a/b" dort ist Text, kein Verweis. */
const FREE_TEXT = new Set(['name', 'query', 'says', 'note', 'label', 'text', 'title', 'summary', 'description', 'prompt', 'direction', 'hint']);

/**
 * EIN DOKUMENT PLANEN — was angelegt, was geändert würde, und was nicht geht.
 * Nichts wird gespeichert; das tut `applyImport` nach der Rückfrage.
 */
export function planImport(lib: CogitaLibrary, doc: unknown, opts: { readonly ids?: ImportIds } = {}): ImportPlan | { error: string } {
  if (!isObject(doc)) return { error: t('cogitaData.import.notJson') };
  /* 2026-11-03 — eine neue Kennung je Stelle im Dokument, bei jeder Planung dieselbe (`importIds`). */
  const memo = opts.ids ?? importIds(lib, doc);
  const mint = (slot: string): string => {
    const had = memo.get(slot);
    if (had !== undefined && lib.entry(had) === undefined && lib.kind(had) === undefined) return had;
    const id = newId();
    memo.set(slot, id);
    return id;
  };
  const format = str(doc.format);
  if (format === 'recreatio/source-text') {
    return { error: t('cogitaData.import.sourceText') };
  }
  if (![COURSE_FORMAT, SCHEMA_FORMAT, ENTITIES_FORMAT, FLOW_FORMAT].includes(format)) {
    return { error: t('cogitaData.import.unknownFormat', { format: format || '—', course: COURSE_FORMAT, schema: SCHEMA_FORMAT, entities: ENTITIES_FORMAT, flow: FLOW_FORMAT }) };
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
  const idFor = (raw: unknown, exists: (id: string) => boolean, slot: string): { id: string; isNew: boolean } => {
    const r = ref(raw);
    if (r !== null && exists(r)) { refs.set(refKey(r), r); return { id: r, isNew: false }; }
    if (r !== null && refs.has(refKey(r))) return { id: refs.get(refKey(r))!, isNew: false };
    const id = mint(slot);
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
  let kindAt = -1;
  for (const raw of Array.isArray(doc.kinds) ? doc.kinds : []) {
    kindAt += 1;
    if (!isObject(raw)) continue;
    /* 2026-11-03 — ein Rodzaj samt seinen Einträgen geht nur in Schematy → „Usuń rodzaj" (dort steht, was alles mitgeht). */
    if (raw.remove === true) { warnings.push(t('cogitaData.import.kindNoRemove', { name: str(raw.name) || str(raw.ref) || '—' })); continue; }
    const builtin = str(raw.builtin);
    if (builtin !== '' && isBaseKind(builtin)) {
      placed.push({ raw, id: builtin, isNew: false });
      refs.set(refKey(ref(raw.ref) ?? builtin), builtin);
      continue;
    }
    /* 2026-10-23 — eine Änderung eines eingebauten Rodzaj, den es nicht mehr gibt (Temat, Wiedza, Komentarz): nicht als neuer Rodzaj. */
    if (builtin !== '') { warnings.push(t('cogitaData.import.builtinGone', { builtin })); continue; }
    const named = byName.get(str(raw.name).toLowerCase());
    const r = ref(raw.ref);
    /* 2026-10-25 — ein bleibender Name findet den Rodzaj wieder, auch wenn er inzwischen anders heisst. */
    const lastingRef = r !== null && lasting(r) ? r.toLowerCase() : undefined;
    const byLasting = lastingRef === undefined ? undefined : lib.byImportRef(lastingRef, 'kind');
    const known = r !== null && lib.kind(r) !== undefined ? r : byLasting?.id ?? named;
    const id = known ?? idFor(raw.ref, () => false, `k:${kindAt}`).id;
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
      if (old !== undefined && old.type !== f.type) warnings.push(t('cogitaData.import.fieldTypeChange', { kind: name, field: f.label, from: FIELD_TYPE_LABEL[old.type], to: FIELD_TYPE_LABEL[f.type] }));
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
    if (kept.length > 0) warnings.push(t('cogitaData.import.fieldsKept', { kind: name, fields: kept.map((f) => f.label).join(', ') }));
    const label = str(raw.label) !== '' ? def.label : before.label;
    const wantTells = str(raw.tells);
    const tells = 'tells' in raw
      ? (merged.some((f) => f.key === wantTells) ? wantTells : undefined)
      : (before.tells !== undefined && merged.some((f) => f.key === before.tells) ? before.tells : undefined);
    const system = 'system' in raw ? def.system : before.system;
    /* 2026-10-31 — der Wzór tekstu bleibt, wenn das Dokument ihn nicht nennt; "reading": "" nimmt ihn ab. */
    const reading = 'reading' in raw ? def.reading : before.reading;
    if (name !== before.name) warnings.push(t('cogitaData.import.kindRenamed', { from: before.name, to: name }));
    if (label !== before.label) warnings.push(t('cogitaData.import.labelChanged', { kind: name, from: before.label, to: label }));
    if (tells !== before.tells) warnings.push(t('cogitaData.import.tellsChanged', { kind: name, from: before.tells ?? '—', to: tells ?? '—' }));
    if (system !== before.system) warnings.push(t('cogitaData.import.systemChanged', { kind: name, from: before.system ?? '—', to: system ?? '—' }));
    if (reading !== before.reading) warnings.push(reading === undefined ? t('cogitaData.import.readingRemoved', { kind: name }) : t('cogitaData.import.readingNew', { kind: name }));
    const { reading: _named, ...rest } = def;
    kinds.push({ id, isNew, ...withMarks, def: { ...rest, name, fields: merged, label, tells, system, ...(reading === undefined ? {} : { reading }) } });
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
  const allRows = Array.isArray(doc.entities) ? doc.entities.filter(isObject) : [];
  /* 2026-11-03 — `"remove": true`: dieser Eintrag wird gelöscht (unten aufgelöst, mit seinem Namen in der Vorschau). */
  const removeRows = allRows.filter((raw) => raw.remove === true);
  const rawEntities = allRows.filter((raw) => raw.remove !== true);
  /* Welcher bleibende Name einen vorhandenen Eintrag schon genommen hat — zwei, die zu einem führen (zusammengeführt), werden genannt. */
  const takenBy = new Map<string, string>();
  /*
    2026-10-25 — ein bleibender Name (mit „/") findet den Eintrag eines früheren Imports wieder. `alias`:
    gefunden nur über einen mitgetragenen Namen (`_refs`) — der Eintrag wurde zusammengeführt, und was
    der Bleibende hat, gilt; diese Zeile füllt nur, was bei ihm leer ist.
  */
  const entityId = (raw: unknown, at: number): { id: string; isNew: boolean; marks?: Record<string, unknown>; alias?: true } => {
    const r = ref(raw);
    if (r !== null && lasting(r) && lib.entity(r) === undefined) {
      const lastingRef = r.toLowerCase();
      if (refs.has(lastingRef)) { warnings.push(t('cogitaData.import.nameTwice', { name: r })); return { id: refs.get(lastingRef)!, isNew: false }; }
      const had = lib.byImportRef(lastingRef, 'entity');
      if (had !== undefined) {
        const other = takenBy.get(had.id);
        if (other !== undefined) warnings.push(t('cogitaData.import.merged', { a: other, b: r }));
        takenBy.set(had.id, r);
        refs.set(lastingRef, had.id);
        const own = typeof had.data._ref === 'string' && had.data._ref.toLowerCase() === lastingRef;
        if (!own && Array.isArray(had.data._refs)) return { id: had.id, isNew: false, alias: true };
        noteOwner(had.data, r);
        return { id: had.id, isNew: false, marks: { ...(hasLastingName(had.data) ? {} : { _ref: lastingRef }), ...ownerMark } };
      }
      const id = mint(`e:${at}`);
      refs.set(lastingRef, id);
      return { id, isNew: true, marks: { _ref: lastingRef, ...ownerMark } };
    }
    return idFor(raw, (id) => lib.entity(id) !== undefined, `e:${at}`);
  };
  const ids = rawEntities.map((raw, at) => entityId(raw.ref ?? raw.id, at));
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
    if (r !== null && declared !== undefined && declared !== refs.get(r)) warnings.push(t('cogitaData.import.nameIsLibraryKey', { name: r }));
  }
  /* Was nicht aufgeht, sagt, wo es fehlen könnte: ein Schlüssel ohne „/" ist meist ein Werk einer Bibliothek, die die Baza nicht nennt. */
  const missingWhy = (name: string): string => lasting(name)
    ? t('cogitaData.import.refNowhere', { name })
    : t('cogitaData.import.refNowhereLibrary', { name });
  const entities: ImportPlan['entities'] = [];
  const planned = new Map<string, number>();
  /* Welche geplanten Einträge eine Zeile mit ihrem eigenen Namen haben (nicht nur über einen mitgetragenen). */
  const primary = new Set<string>();
  rawEntities.forEach((raw, i) => {
    let entityKinds = (Array.isArray(raw.kinds) ? raw.kinds : [raw.kind]).map(kindId).filter((k): k is string => k !== null);
    /* 2026-11-03 — eine Änderung an einem bestehenden Eintrag (an seiner Kennung) muss seine Rodzaje nicht nennen: er behält sie. */
    const existing = ids[i]!.isNew ? undefined : lib.entity(ids[i]!.id);
    if (entityKinds.length === 0 && !('kinds' in raw) && !('kind' in raw) && existing !== undefined) entityKinds = [...existing.kinds];
    if (entityKinds.length === 0) { warnings.push(t('cogitaData.import.noKind', { entry: str(raw.ref) || i + 1 })); return; }
    /* 2026-10-25 — dzieła, osoby, cytaty, teksty należą do Biblioteki i Skryptorium: tu się na nie wskazuje. */
    const foreignKind = entityKinds.find((k) => lib.isForeignKind(k));
    if (foreignKind !== undefined) warnings.push(t('cogitaData.import.foreignKind', { entry: str(raw.ref) || i + 1, kind: lib.kind(foreignKind)?.name ?? foreignKind }));
    /*
      2026-10-25 — Ein Name mit „/" ist nur dort ein Verweis, wo das Feld einer ist (ein Verweisfeld, der
      Verweis einer Zelle in einer Aussage); in einem Textfeld ist „@autor/rok" Text und bleibt.
    */
    const modeAt = (path: readonly string[]): RefMode => {
      const f = path[0] === undefined ? undefined : fieldOf(entityKinds, path[0]);
      return f?.type === 'ref' || (f?.type === 'blocks' && path[path.length - 1] === 'ref') ? 'all' : 'short';
    };
    /* 2026-11-03 — was wegfällt, mit dem Eintrag UND dem Feld (auf dem Bildschirm nach dem Zapis steht es so). */
    const fieldName = (path: readonly string[]) => { const f = path[0] === undefined ? undefined : fieldOf(entityKinds, path[0]); return f === undefined ? path.join('.') : `${f.label} (${f.key})`; };
    const data = isObject(raw.data) ? refsIn(raw.data, (r) => resolveRef(r), (missing, path) => warnings.push(t('cogitaData.import.entryFieldMissing', { entry: str(raw.ref) || i + 1, field: fieldName(path), why: missingWhy(missing) })), modeAt) : {};
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
    ['anchor', doc.anchors],
    /* 2026-11-02 — Nagrody: Punkte, Serie, Tagesziel, Stufen, Abzeichen (`rewards.ts`). */
    ['reward', doc.rewards]
  ];
  type Incoming = { kind: DocKind; raw: Record<string, unknown>; r: string | null; at: number; lastingRef?: string; id?: string; isNew?: boolean; byName?: true };
  const incoming: Incoming[] = [];
  const docRemoveRows: { kind: DocKind; raw: Record<string, unknown> }[] = [];
  for (const [kind, list] of docLists) {
    for (const raw of Array.isArray(list) ? list : isObject(list) ? [list] : []) {
      if (!isObject(raw)) continue;
      if (raw.remove === true) { docRemoveRows.push({ kind, raw }); continue; }
      const r = ref(raw.ref ?? raw.id);
      incoming.push({ kind, raw, r, at: incoming.length, ...(r !== null && lasting(r) ? { lastingRef: r.toLowerCase() } : {}) });
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
  /* 2026-11-05 (Prompt 23, C2) — ein unbekannter Wert in „Sposób pytania" fiele still auf die Vorgabe: der Import sagt es. */
  for (const d of incoming) {
    if (d.kind !== 'revision' || !isObject(d.raw.graph) || !Array.isArray(d.raw.graph.nodes)) continue;
    for (const n of d.raw.graph.nodes) {
      if (!isObject(n) || n.type !== 'strategy' || !isObject(n.config)) continue;
      const c = n.config;
      if (c.mode !== undefined && !(MODES as readonly unknown[]).includes(c.mode)) warnings.push(t('cogitaData.import.revisionMode', { name: str(d.raw.name) || d.r || '—', value: String(c.mode), list: MODES.join(', ') }));
      if (c.pick !== undefined && !(PICKS as readonly unknown[]).includes(c.pick)) warnings.push(t('cogitaData.import.revisionPick', { name: str(d.raw.name) || d.r || '—', value: String(c.pick), list: PICKS.join(', ') }));
    }
  }
  const claimed = new Set<string>();
  for (const d of incoming) {
    const own = docRefsOf(d.kind);
    if (d.r === null) continue;
    if (own.has(refKey(d.r))) {
      warnings.push(t('cogitaData.import.docTwice', { doc: DOC_LABEL[d.kind], name: d.r }));
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
      warnings.push(t('cogitaData.import.docTwice', { doc: DOC_LABEL[d.kind], name: d.r }));
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
    const id = mint(`d:${d.kind}:${d.at}`);
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
    const label = t('cogitaData.import.docTitle', { doc: DOC_LABEL[kind], name: str(rest.name) || '—' });
    let data: Record<string, unknown>;
    if (kind === 'anchor') {
      /* Ein Wejście löst seinen Eintrag, seinen Widok und sein Werk selbst auf — jedes in seinem eigenen Raum. */
      data = planAnchor(lib, rest, {
        entity: (r) => { const hit = refs.get(refKey(r)); const at = hit === undefined ? undefined : planned.get(hit); return at === undefined ? null : { id: entities[at]!.id, kinds: entities[at]!.kinds }; },
        view: (r) => docRefsOf('view').get(refKey(r)) ?? null,
        planned: docs
      }, warnings);
    } else {
      data = refsIn(rest, resolveDocRef, (missing, path) => warnings.push(t('cogitaData.import.docFieldMissing', { label, path: path.filter((p) => !/^d+$/.test(p)).join('.') || '—', why: missingWhy(missing) })), docModeAt);
    }
    if (kind === 'template') {
      const t = readTemplate(id, data);
      data = { ...data, kinds: t.kinds.map((k) => kindId(k) ?? k), graph: graphJson(t.graph), tests: t.tests.length === 0 ? undefined : t.tests, asks: t.asks.length === 0 ? undefined : t.asks };
    }
    /* 2026-10-30 — der alte Knoten „Najpierw podstawy" kommt als die allgemeinen Schritte an, die dasselbe tun (in einem Ablauf: ein „Warunek"). */
    if (kind === 'revision') data = { ...data, graph: graphJson(migrateRevision(readGraph(data.graph))) };
    if (kind === 'flow' && isObject(data.graph)) data = { ...data, graph: graphJson(migratePrerequisites(readGraph(data.graph, true))) };
    /* 2026-11-02 — Nagrody in der Gestalt, die `readRewards` liest: was fehlt, aus der eingebauten Regel. */
    if (kind === 'reward') data = rewardsData(readRewards(data));
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
        if (target === null) { warnings.push(t('cogitaData.import.axisNowhere', { label, axis: c.slice(AXIS_COLUMN.length) })); return undefined; }
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
    if (byName === true) warnings.push(t('cogitaData.import.docReplaced', { doc: DOC_LABEL[kind], name: str(rest.name) }));
    const twice = docs.findIndex((x) => x.id === id && x.kind === kind);
    if (twice >= 0) docs[twice] = { ...docs[twice]!, data };
    else docs.push({ id, kind, data, isNew });
  }

  /*
    2026-11-03 — LÖSCHEN: `{"ref": "<kennung>" | "@bleibender/name", "remove": true}`. Nur was es in DIESER Baza gibt;
    was dasselbe Dokument zugleich ändert, wird nur gelöscht (die Änderung fällt weg, mit Warnung). Was darauf zeigt,
    rechnet `removalEffects` (Vorschau und Speichern).
  */
  const removals: ImportRemoval[] = [];
  const removing = new Set<string>();
  const label = (raw: Record<string, unknown>) => str(raw.ref) || str(raw.id) || '—';
  for (const raw of removeRows) {
    const r = ref(raw.ref ?? raw.id);
    const byName = r !== null && lasting(r) ? lib.byImportRef(r.toLowerCase(), 'entity')?.id : undefined;
    const hit = r === null ? undefined : lib.entity(r) ?? (byName === undefined ? undefined : lib.entity(byName));
    if (r === null || hit === undefined) { warnings.push(t('cogitaData.import.removeNoEntry', { name: label(raw) })); continue; }
    if (!lib.isOwn(hit.id)) { warnings.push(t('cogitaData.import.removeForeignEntry', { name: lib.label(hit) })); continue; }
    if (removing.has(hit.id)) continue;
    removing.add(hit.id);
    removals.push({ id: hit.id, target: 'entity', title: lib.label(hit) || hit.id });
  }
  for (const { kind, raw } of docRemoveRows) {
    const r = ref(raw.ref ?? raw.id);
    const hit = r === null ? undefined : lib.docs(kind).find((d) => d.id === r) ?? (lasting(r) ? lib.byImportRef(r.toLowerCase(), kind) : undefined);
    if (r === null || hit === undefined) { warnings.push(t('cogitaData.import.removeNoDoc', { doc: DOC_LABEL[kind], name: label(raw) })); continue; }
    if (!lib.isOwn(hit.id)) { warnings.push(t('cogitaData.import.removeForeignDoc', { doc: DOC_LABEL[kind], name: str(hit.data.name) || hit.id })); continue; }
    if (removing.has(hit.id)) continue;
    removing.add(hit.id);
    removals.push({ id: hit.id, target: 'doc', kind, title: t('cogitaData.import.docTitle', { doc: DOC_LABEL[kind], name: str(hit.data.name) || '—' }) });
  }
  for (const list of [entities, docs] as const) {
    for (let at = list.length - 1; at >= 0; at -= 1) {
      const one = list[at]!;
      if (!removing.has(one.id)) continue;
      warnings.push(t('cogitaData.import.changedAndRemoved', { name: removals.find((x) => x.id === one.id)?.title ?? one.id }));
      list.splice(at, 1);
    }
  }

  /* 2026-10-25 — fremde Namen: ein anderes Dokument hat diese Einträge angelegt. */
  for (const [owner, names] of foreign) {
    warnings.push(t('cogitaData.import.namesOwned', { count: names.length, owner, example: names[0] ?? '' }));
  }

  /* 2026-10-25 (Wywód) — Einträge einer Struktur, die kein Baum zeigt: in einem Kreis — oder nach oben auf sich selbst oder ins Leere. */
  const loose = unrootedOf(lib, { kinds, entities });
  const listed = (names: readonly string[]) => {
    const list = names.slice(0, 5).map((l) => t('cogitaData.import.quoted', { name: l.slice(0, 60) })).join(', ');
    return names.length > 5 ? t('cogitaData.import.listedMore', { list, count: names.length - 5 }) : list;
  };
  if (loose.circle.length > 0) {
    warnings.push(t('cogitaData.import.circle', { list: listed(loose.circle) }));
  }
  if (loose.dangling.length > 0) {
    warnings.push(t('cogitaData.import.dangling', { list: listed(loose.dangling) }));
  }
  /* 2026-11-04 — die Ścieżka jedes Ablaufs: ein Anfang, ein Ende, keine Sackgassen (`flowCheck.ts`; ohne Anfang oder Ende geht der Zapis nicht). */
  warnings.push(...flowWarnings(lib, docs, entities));
  /* 2026-11-03 — der Krajobraz: Kreise in der Reihenfolge des Lernens, unbekannte Achsen, keine Reihenfolge (`landscapeImport.ts`). */
  warnings.push(...landscapeImportWarnings(lib, { kinds, entities, docs }));
  /* 2026-11-03 — die Generatoren: übersetzen ihre Ausdrücke, gelingen Proben (mit den Einträgen nach dem Import)? */
  warnings.push(...generatorImportWarnings(lib, { kinds, entities, docs }));
  /* 2026-11-05 (Prompt 23, A6) — die Folien: alte Zitate „Cytat (…):“, handgeschriebene „Przypisy“, „kliknij dalej“, Zitate ohne „> — Autor“, [@…] in Fragen. */
  warnings.push(...slideImportWarnings(lib, { kinds, entities }));
  /* 2026-11-05 (Prompt 23, D3) — die Rysunki do poruszania: unbekannte Namen in Ausdrücken, eine Lösung, die ihr Ziel verfehlt. */
  warnings.push(...interactiveImportWarnings({ entities }));
  /* 2026-11-05 (Prompt 24) — Verweise in andere Bazy: angenommen; hier nur ein "@@…" in einem Verweisfeld ohne "external": true (der Rest nach dem Öffnen jener Bazy, `crossCheckFor`). */
  warnings.push(...crossImportWarnings(lib, { kinds, entities, docs }));

  const lines = [
    kinds.length === 0 ? '' : t('cogitaData.import.summaryKinds', { fresh: kinds.filter((k) => k.isNew).length, changed: kinds.filter((k) => !k.isNew).length }),
    entities.length === 0 ? '' : t('cogitaData.import.summaryEntries', { fresh: entities.filter((e) => e.isNew).length, changed: entities.filter((e) => !e.isNew).length }),
    ...DOC_KINDS.map((k) => {
      const n = docs.filter((d) => d.kind === k);
      return n.length === 0 ? '' : t('cogitaData.import.summaryDocs', { doc: DOC_LABEL[k], fresh: n.filter((d) => d.isNew).length, changed: n.filter((d) => !d.isNew).length });
    }),
    removals.length === 0 ? '' : t('cogitaData.import.summaryRemove', { count: removals.length })
  ].filter(Boolean);
  if (lines.length === 0) return { error: t('cogitaData.import.nothingToImport') };
  return { kinds, entities, docs, lines, warnings, ...(removals.length === 0 ? {} : { removals }) };
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
  const name = str(raw.name) || t('cogitaData.import.anchorDefault');
  const bare = (v: unknown) => str(v).replace(/^@/, '');
  /* Der Eintrag: aus dem Dokument, sonst einer, den es schon gibt. */
  let entry = bare(raw.entry);
  if (entry !== '') {
    /* Auch ein Schlüssel — meist ein Werk, und das wird unten als „nicht aus dieser Baza" genannt. */
    const known = lib.entity(entry) !== undefined ? entry : lasting(entry) ? lib.byImportRef(entry, 'entity')?.id : lib.resolveDeclared(entry);
    const existing = known === undefined ? undefined : lib.entity(known);
    const found = ctx.entity(entry) ?? (existing === undefined ? null : { id: existing.id, kinds: existing.kinds });
    if (found === null) { warnings.push(t('cogitaData.import.anchorNoEntry', { name, entry: str(raw.entry) })); entry = ''; }
    else if (found.kinds.some((k) => lib.isForeignKind(k))) { warnings.push(t('cogitaData.import.anchorForeignEntry', { name, entry: str(raw.entry) })); entry = ''; }
    else entry = found.id;
  }
  /* Der Widok: aus dem Dokument, eine Kennung, ein bleibender Name, sein Name. */
  let view = bare(raw.view);
  if (view !== '') {
    const wanted = view.toLowerCase();
    const found = ctx.view(view) ?? (lib.docs('view').some((e) => e.id === view) ? view : null) ?? (lasting(view) ? lib.byImportRef(view, 'view')?.id ?? null : null)
      ?? ctx.planned.find((d) => d.kind === 'view' && str(d.data.name).toLowerCase() === wanted)?.id
      ?? lib.docs('view').find((e) => str(e.data.name).toLowerCase() === wanted)?.id ?? null;
    if (found === null) warnings.push(t('cogitaData.import.anchorNoView', { name, view: str(raw.view) }));
    view = found ?? '';
  }
  /* Das Werk: aus einer Bibliothek, die diese Baza nennt. */
  let work = bare(raw.work);
  if (work !== '') {
    const found = lib.entity(work) !== undefined ? work : lib.resolveDeclared(work) ?? null;
    const target = found === null ? undefined : lib.entity(found);
    if (found === null) { warnings.push(t('cogitaData.import.anchorNoWork', { name, work: str(raw.work) })); work = ''; }
    else if (target !== undefined && !target.kinds.includes('work')) { warnings.push(t('cogitaData.import.anchorNotWork', { name, work: str(raw.work) })); work = ''; }
    else work = found;
  }
  if (work === '') warnings.push(t('cogitaData.import.anchorWithoutWork', { name }));
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
  missing: (ref: string, path: readonly string[]) => void, modeAt: (path: readonly string[]) => RefMode
): Record<string, unknown> {
  const walk = (v: unknown, path: readonly string[]): unknown => {
    if (typeof v === 'string' && /^@[A-Za-z0-9_.:/-]{1,120}$/.test(v)) {
      const name = v.slice(1);
      const mode = modeAt(path);
      if (mode === 'none' || (mode === 'short' && lasting(name))) return v;
      const id = resolve(name, path);
      if (id !== null) return id;
      missing(name, path);
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
export function structurePreview(lib: CogitaLibrary, plan: ImportPlan, max = 80, changed?: ReadonlySet<string>): string[] {
  /* 2026-11-03 — `changed`: was sich wirklich ändert (die Durchsicht weiss es) — sonst trüge jedes Bestehende im Dokument ein „~“. */
  const isNew = new Map(plan.entities.filter((e) => e.isNew || changed === undefined || changed.has(e.id)).map((e) => [e.id, e.isNew]));
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
    out.push(t('cogitaData.import.preview.structure'));
    for (const r of roots) walk(structureTree(r, src, { label: (e) => labelOf(e, look) }, { nodes: max }).root, 0);
    if (out.length >= max) out.push(t('cogitaData.import.preview.more'));
  }
  const anchors = plan.docs.filter((d) => d.kind === 'anchor').map((d) => readAnchor(d.id, d.data));
  if (anchors.length > 0) {
    out.push(t('cogitaData.import.preview.anchors'));
    for (const a of anchors) {
      const work = lib.entity(a.work);
      const entry = a.entry === '' ? undefined : look.entity(a.entry);
      out.push(`  ${t('cogitaData.import.quoted', { name: a.name })} — ${work === undefined ? t('cogitaData.import.preview.workMissing') : labelOf(work, look).slice(0, 80)}, ${a.locator === '' ? t('cogitaData.import.preview.wholeWork') : a.locator}${entry === undefined ? '' : ` → ${labelOf(entry, look).slice(0, 80)}`}`);
    }
  }
  return out;
}

/**
 * 2026-11-03 — EIN IMPORT, DER NICHT GEHT, SAGT WARUM: jede Zeile ein Element und sein Feld. Gespeichert ist nichts.
 */
export class ImportBlocked extends Error {
  constructor(readonly problems: readonly string[], lead = t('cogitaData.import.blockedLead')) {
    super([lead, ...problems].join('\n'));
  }
}

/** 2026-11-04 — die Probleme der Ścieżka jedes Ablaufs eines Plans, beim Namen des Ablaufs und des Schrittes. */
function flowIssues(lib: CogitaLibrary, docs: ImportPlan['docs'], entities: ImportPlan['entities'] = []): { level: 'error' | 'warning'; text: string }[] {
  const planTitle = (id: string): string | undefined => { const d = entities.find((e) => e.id === id)?.data; if (d === undefined) return undefined; for (const v of Object.values(d)) if (typeof v === 'string' && v.trim() !== '') return v.trim().slice(0, 80); return undefined; };
  const label = (id: string) => { const e = lib.entity(id); return e === undefined ? planTitle(id) ?? id : lib.label(e); };
  /*
    2026-11-04 (Prompt 13) — die Abstecher: gegen alle Abläufe nach dem Zapis (die des Dokuments ersetzen die der Baza). Eine
    andere Erzählung, die es nicht gibt: Warnung; ein Kreis A → B → A: blockiert, beide beim Namen (einmal je Kreis).
  */
  const planned = docs.filter((d) => d.kind === 'flow').map((d) => readFlow(d.id, d.data));
  const all = [...planned, ...lib.docs('flow').filter((e) => !planned.some((f) => f.id === e.id)).map((e) => readFlow(e.id, e.data))];
  const resolve = (ref: string): string | null => {
    const r = ref.trim();
    if (all.some((f) => f.id === r)) return r;
    const name = r.startsWith('@') ? r.slice(1) : r;
    return all.find((f) => f.ref !== undefined && f.ref.toLowerCase() === name.toLowerCase())?.id ?? lib.byImportRef(name, 'flow')?.id ?? null;
  };
  const said = new Set<string>();
  /* 2026-11-06 — ein Sechseck mit inneren Wegen (`mountain.ts`): Einträge aus dem Plan und der Baza, beim Kennung oder @Namen. */
  const entityOf = (ref: string): string | null => {
    const r = ref.trim();
    if (r === '') return null;
    if (entities.some((e) => e.id === r) || lib.entity(r) !== undefined) return r;
    const name = r.startsWith('@') ? r.slice(1).toLowerCase() : null;
    if (name === null) return null;
    return entities.find((e) => typeof e.marks?._ref === 'string' && e.marks._ref.toLowerCase() === name)?.id ?? lib.byImportRef(name, 'entity')?.id ?? null;
  };
  const refsOf = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).flatMap((x) => {
    const r = typeof x === 'string' ? x : typeof x === 'object' && x !== null && typeof (x as { value?: unknown }).value === 'string' ? (x as { value: string }).value : '';
    const id = entityOf(r);
    return id === null ? [] : [id];
  });
  const mountain: MountainContext = {
    flow: (ref) => { const id = resolve(ref); return id === null ? undefined : all.find((f) => f.id === id); },
    entity: entityOf,
    question: (id) => {
      const planned = entities.find((e) => e.id === id);
      const kinds = planned?.kinds ?? lib.entity(id)?.kinds ?? [];
      if (!kinds.includes('question')) return null;
      const data = planned?.data ?? lib.entry(id)?.data ?? {};
      return { about: refsOf(data.about), explain: refsOf(data.explain) };
    },
    label
  };
  return docs.filter((d) => d.kind === 'flow').flatMap((d) => {
    const flow = readFlow(d.id, d.data);
    const detours = detourProblems(flow, all, resolve).filter((p) => { if (p.step !== undefined) return true; if (said.has(p.text)) return false; said.add(p.text); return true; });
    return [...flowProblems(flow, label, d.data), ...detours, ...mountainProblems(flow, mountain)].map((p) => ({ level: p.level, text: t('cogitaData.import.flowIssue', { name: flow.name, text: p.text }) }));
  });
}
const flowWarnings = (lib: CogitaLibrary, docs: ImportPlan['docs'], entities: ImportPlan['entities'] = []): string[] => flowIssues(lib, docs, entities).map((p) => (p.level === 'error' ? t('cogitaData.import.flowError', { text: p.text }) : p.text));

/** Was ein Widok an Rodzajen nennt — nur, was dort sicher ein Rodzaj ist (Quelle, Gruppe, Achse). */
function viewKindRefs(data: Readonly<Record<string, unknown>>): { where: string; id: string }[] {
  const out: { where: string; id: string }[] = [];
  const steps = Array.isArray(data.steps) ? data.steps : [];
  steps.forEach((step, i) => {
    const kind = isObject(step) && isObject(step.config) ? step.config.kind : undefined;
    if (typeof kind === 'string' && kind !== '') out.push({ where: t('cogitaData.import.where.step', { n: i + 1 }), id: kind });
  });
  if (isObject(data.group) && typeof data.group.kind === 'string' && data.group.kind !== '') out.push({ where: t('cogitaData.import.where.group'), id: data.group.kind });
  for (const c of Array.isArray(data.columns) ? data.columns : []) {
    if (typeof c === 'string' && c.startsWith(AXIS_COLUMN)) out.push({ where: t('cogitaData.import.where.columns'), id: c.slice(AXIS_COLUMN.length) });
  }
  return out;
}

/**
 * 2026-11-03 — WORAUF DER ZAPIS ZEIGT, BEVOR ER GESCHIEHT. Gespeichert wird nie ein Verweis auf einen Rodzaj oder
 * Eintrag, den es danach nicht gäbe:
 * <code>
 *   ein Neues, das nicht mitgespeichert wird (in der Durchsicht abgewählt)        → blockiert, mit seinem Namen
 *   ein Rodzaj (Feld „to", Rodzaj eines Eintrags, Quelle/Gruppe/Achse eines Widok)  → blockiert, wenn es ihn nicht gibt
 *   ein Eintrag in einem Verweisfeld                                               → blockiert, wenn es ihn nicht gibt
 * </code>
 * Gezählt wird nur, was dieser Zapis NEU hineinschreibt; ein Verweis ins Leere, der schon vorher gespeichert war und
 * bleibt, steht als Hinweis da (`kept`). Ein Verweis, den diese Baza nicht kennen kann, weil eine erklärte Quelle noch
 * nicht geladen ist, wird nicht blockiert (`unchecked`).
 */
export function importProblems(lib: CogitaLibrary, plan: ImportPlan): { blocked: string[]; kept: string[]; unchecked: number } {
  const blocked: string[] = [];
  const kept: string[] = [];
  let unchecked = 0;
  const unsaved = plan.unsaved ?? new Map<string, string>();
  const kinds = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const planned = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const look: Lookup = { kind: (id) => kinds.get(id) ?? lib.kind(id), entity: (id) => planned.get(id) ?? lib.entity(id) };
  const sure = lib.sourcesLoaded();
  const kindKnown = (id: string) => isBaseKind(id) || kinds.has(id) || lib.kind(id) !== undefined;
  const entityKnown = (id: string) => planned.has(id) || lib.entity(id) !== undefined || lib.entry(id) !== undefined;
  const notChosen = (problem: string, name: string) => t('cogitaData.import.notChosen', { problem, name });
  /* Wer schon auf ein Abgewähltes zeigt (Element|Ziel) — die Suche unten nennt es nicht ein zweites Mal. */
  const reported = new Set<string>();
  /* Ein Ziel, das fehlt: was nicht mitgespeichert wird, beim Namen; sonst die Kennung. */
  const check = (owner: string, id: string, sort: 'rodzaj' | 'wpis', known: boolean, problem: string, wasBefore: boolean): void => {
    if (known) return;
    const name = unsaved.get(id);
    if (name !== undefined) { reported.add(`${owner}|${id}`); blocked.push(notChosen(problem, name)); return; }
    if (!sure) { unchecked += 1; return; }
    if (wasBefore) { kept.push(sort === 'rodzaj' ? t('cogitaData.import.missingBefore.kind', { problem, id }) : t('cogitaData.import.missingBefore.entry', { problem, id })); return; }
    blocked.push(sort === 'rodzaj' ? t('cogitaData.import.missing.kind', { problem, id }) : t('cogitaData.import.missing.entry', { problem, id }));
  };

  /* Was dieser Zapis an einem Bestehenden nicht anfasst (ein Feld, das bleibt, wie es war), prüft er nicht — er schreibt dort nichts Neues. */
  const untouched = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const k of plan.kinds) {
    const before = lib.kind(k.id);
    for (const f of k.def.fields) {
      const old = before?.fields.find((x) => x.key === f.key);
      if (old !== undefined && untouched(old, f)) continue;
      const had = new Set(old?.to ?? []);
      for (const to of f.to ?? []) check(k.id, to, 'rodzaj', kindKnown(to), t('cogitaData.import.kindFieldTo', { kind: k.def.name, field: f.label }), had.has(to));
    }
  }
  for (const e of plan.entities) {
    const entity = planned.get(e.id)!;
    const before = lib.isOwn(e.id) ? lib.entity(e.id) : undefined;
    const title = t('cogitaData.import.entryTitle', { name: plan.titles?.get(e.id) || labelOf(entity, look) || e.id });
    for (const k of e.kinds) if (before?.kinds.includes(k) !== true) check(e.id, k, 'rodzaj', kindKnown(k), t('cogitaData.import.titleKind', { title }), false);
    for (const f of fieldsOf(entity, look)) {
      if (f.type !== 'ref') continue;
      if (before !== undefined && untouched(before.data[f.key], e.data[f.key])) continue;
      const had = new Set(before === undefined ? [] : valuesOf(before, f).map((v) => v.value).filter((v): v is string => typeof v === 'string'));
      for (const v of valuesOf(entity, f)) {
        /* 2026-11-05 (Prompt 24) — ein Verweis in eine andere Baza blockiert nie (geprüft wird er gegen jene: `worldsImport.ts`). */
        if (typeof v.value !== 'string' || v.value === '' || isCross(v.value)) continue;
        check(e.id, v.value, 'wpis', entityKnown(v.value), t('cogitaData.import.titleField', { title, field: f.label }), had.has(v.value));
      }
    }
  }
  /* 2026-11-04 — ein Ablauf ohne Anfang oder ohne Ende: kein Zapis (die Warnungen nennen die Schritte). */
  for (const p of flowIssues(lib, plan.docs)) if (p.level === 'error') blocked.push(p.text);
  for (const d of plan.docs) {
    if (d.kind !== 'view') continue;
    const title = t('cogitaData.import.docTitle', { doc: DOC_LABEL[d.kind], name: str(d.data.name) || '—' });
    const before = lib.docs('view').find((x) => x.id === d.id);
    const had = new Set(before === undefined ? [] : viewKindRefs(before.data).map((r) => r.id));
    for (const r of viewKindRefs(d.data)) check(d.id, r.id, 'rodzaj', kindKnown(r.id), `${title}, ${r.where}`, had.has(r.id));
  }
  /* Was abgewählt ist, darf nirgends stehen — auch nicht an einer Stelle, die oben keiner prüft (Szablony, Powtórki, Zbiory …). */
  if (unsaved.size > 0) {
    const scan = (owner: string, value: unknown, where: string): void => {
      if (typeof value === 'string') {
        const name = unsaved.get(value);
        if (name === undefined || reported.has(`${owner}|${value}`)) return;
        reported.add(`${owner}|${value}`);
        blocked.push(notChosen(where, name));
        return;
      }
      if (Array.isArray(value)) { for (const x of value) scan(owner, x, where); return; }
      if (isObject(value)) for (const [key, x] of Object.entries(value)) if (!key.startsWith('_')) scan(owner, x, where);
    };
    for (const d of plan.docs) for (const [key, value] of Object.entries(d.data)) if (!key.startsWith('_')) scan(d.id, value, t('cogitaData.import.titleKey', { title: t('cogitaData.import.docTitle', { doc: DOC_LABEL[d.kind], name: str(d.data.name) || '—' }), key }));
    for (const e of plan.entities) {
      const entity = planned.get(e.id)!;
      const fields = fieldsOf(entity, look);
      for (const [key, value] of Object.entries(e.data)) {
        if (key.startsWith('_')) continue;
        scan(e.id, value, t('cogitaData.import.entryField', { name: plan.titles?.get(e.id) || labelOf(entity, look) || e.id, field: fields.find((x) => x.key === key)?.label ?? key }));
      }
    }
  }
  return { blocked, kept, unchecked };
}

/**
 * 2026-11-03 — WAS EINE LÖSCHUNG MIT DEM MACHT, WAS DARAUF ZEIGT — gerechnet auf dem Stand NACH dem Zapis (was bleibt,
 * mit den Änderungen dieses Plans):
 * <code>
 *   Verweisfeld eines Eintrags   (wymaga, pole, about einer Frage, …) der Verweis wird herausgenommen — derselbe Zapis
 *                                schreibt den Eintrag; die Vorschau nennt jeden je Löschung
 *   Zbiór                        der gelöschte Eintrag fällt aus seiner Liste
 *   alles andere                 (ein Schritt eines Ablaufs, ein Widok, eine Powtórka, eine Vorlage, ein Wejście, eine
 *                                Zelle in einer Aussage …) blockiert: dort ein Stück herauszuschneiden, ändert, was es tut —
 *                                das Dokument ändert es selbst (im selben Import) oder löscht es mit, oder die Löschung wird
 *                                abgewählt
 * </code>
 * Rein; `withRemovals` wendet es auf einen Plan an.
 */
export function removalEffects(lib: CogitaLibrary, plan: Pick<ImportPlan, 'kinds' | 'entities' | 'docs'>, gone: ReadonlySet<string>, titles: ReadonlyMap<string, string> = new Map()): {
  readonly entities: ReadonlyMap<string, { readonly kinds: readonly string[]; readonly data: Record<string, unknown> }>;
  readonly docs: ReadonlyMap<string, { readonly kind: DocKind; readonly data: Record<string, unknown> }>;
  readonly blocked: string[];
  /** Je gelöschtem: wer seinen Verweis verliert („Etap 2 (Wymaga)"). */
  readonly unlinked: ReadonlyMap<string, string[]>;
} {
  const entities = new Map<string, { kinds: readonly string[]; data: Record<string, unknown> }>();
  const docs = new Map<string, { kind: DocKind; data: Record<string, unknown> }>();
  const blocked: string[] = [];
  const unlinked = new Map<string, string[]>();
  if (gone.size === 0) return { entities, docs, blocked, unlinked };
  const kinds = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const look: Lookup = { kind: (id) => kinds.get(id) ?? lib.kind(id), entity: (id) => lib.entity(id) };
  const nameOf = (id: string) => titles.get(id) ?? (() => { const e = lib.entity(id); if (e !== undefined) return lib.label(e) || id; const d = DOC_KINDS.flatMap((k) => lib.docs(k)).find((x) => x.id === id); return d === undefined ? id : str(d.data.name) || id; })();
  const note = (target: string, who: string) => unlinked.set(target, [...(unlinked.get(target) ?? []), who]);
  /* Ein Wert, irgendwo darin, der auf ein Gelöschtes zeigt. */
  const hits = (v: unknown, out: Set<string>): void => {
    if (typeof v === 'string') { if (gone.has(v)) out.add(v); return; }
    if (Array.isArray(v)) { for (const x of v) hits(x, out); return; }
    if (isObject(v)) for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) hits(x, out);
  };
  const refValue = (one: unknown): unknown => (isObject(one) && 'value' in one ? one.value : one);

  /* Einträge nach dem Zapis: die eigenen, die bleiben, mit dem, was dieser Plan an ihnen ändert; dazu das Neue. */
  const after = new Map<string, Entity>();
  for (const e of lib.entities()) if (lib.isOwn(e.id) && !gone.has(e.id)) after.set(e.id, e);
  for (const e of plan.entities) if (!gone.has(e.id)) after.set(e.id, { id: e.id, kinds: e.kinds, data: e.data });
  for (const e of after.values()) {
    const fields = fieldsOf(e, look);
    const title = titles.get(e.id) ?? (labelOf(e, look) || e.id);
    let data: Record<string, unknown> | null = null;
    for (const [key, value] of Object.entries(e.data)) {
      if (key.startsWith('_')) continue;
      const field = fields.find((x) => x.key === key);
      if (field?.type === 'ref') {
        const list = Array.isArray(value) ? value : [value];
        const kept = list.filter((one) => { const v = refValue(one); return !(typeof v === 'string' && gone.has(v)); });
        if (kept.length === list.length) continue;
        for (const one of list) { const v = refValue(one); if (typeof v === 'string' && gone.has(v)) note(v, `${title} (${field.label})`); }
        data ??= { ...e.data };
        if (kept.length === 0) delete data[key]; else data[key] = Array.isArray(value) ? kept : kept[0];
        continue;
      }
      const found = new Set<string>();
      hits(value, found);
      for (const g of found) blocked.push(t('cogitaData.import.removeBlockedField', { title, field: field?.label ?? key, target: nameOf(g) }));
    }
    if (data !== null) entities.set(e.id, { kinds: e.kinds, data });
  }

  /* Dokumente nach dem Zapis (ohne Zusammenführungen und Beiträge — die gehören zur Geschichte eines Eintrags). */
  const afterDocs = new Map<string, { kind: DocKind; data: Readonly<Record<string, unknown>> }>();
  for (const k of DOC_KINDS) {
    if (k === 'merge' || k === 'contribution' || k === 'kind' || k === 'worldmap') continue;
    for (const d of lib.docs(k)) if (lib.isOwn(d.id) && !gone.has(d.id)) afterDocs.set(d.id, { kind: k, data: d.data });
  }
  for (const d of plan.docs) if (!gone.has(d.id)) afterDocs.set(d.id, { kind: d.kind, data: d.data });
  for (const [id, d] of afterDocs) {
    const title = t('cogitaData.import.docTitle', { doc: DOC_LABEL[d.kind], name: str(d.data.name) || '—' });
    if (d.kind === 'collection' && Array.isArray(d.data.list)) {
      const kept = d.data.list.filter((x) => !(typeof x === 'string' && gone.has(x)));
      if (kept.length !== d.data.list.length) {
        for (const x of d.data.list) if (typeof x === 'string' && gone.has(x)) note(x, title);
        docs.set(id, { kind: d.kind, data: { ...d.data, list: kept } });
      }
      const rest = new Set<string>();
      for (const [key, value] of Object.entries(d.data)) if (key !== 'list' && !key.startsWith('_')) hits(value, rest);
      for (const g of rest) blocked.push(t('cogitaData.import.removeBlockedDoc', { title, target: nameOf(g) }));
      continue;
    }
    for (const [key, value] of Object.entries(d.data)) {
      if (key.startsWith('_')) continue;
      const found = new Set<string>();
      hits(value, found);
      for (const g of found) blocked.push(t('cogitaData.import.removeBlockedDocKey', { title, key, target: nameOf(g) }));
    }
  }
  return { entities, docs, blocked, unlinked };
}

/**
 * 2026-11-03 — DER PLAN MIT SEINEN LÖSCHUNGEN ZU ENDE GERECHNET: jeder Eintrag, der einen Verweis auf ein Gelöschtes
 * verliert, und jeder Zbiór, aus dem es fällt, wird im selben Zapis geschrieben; was blockiert, steht in `blocked`.
 * Zweimal angewandt ändert es nichts mehr.
 */
export function withRemovals(lib: CogitaLibrary, plan: ImportPlan): { plan: ImportPlan; blocked: string[] } {
  const gone = new Set((plan.removals ?? []).map((r) => r.id));
  if (gone.size === 0) return { plan, blocked: [] };
  const fx = removalEffects(lib, plan, gone, plan.titles);
  const entities = plan.entities.map((e) => { const s = fx.entities.get(e.id); return s === undefined ? e : { ...e, data: s.data }; });
  for (const [id, s] of fx.entities) {
    if (entities.some((e) => e.id === id)) continue;
    entities.push({ id, kinds: [...s.kinds], data: s.data, isNew: false });
  }
  const docs = plan.docs.map((d) => { const s = fx.docs.get(d.id); return s === undefined ? d : { ...d, data: s.data }; });
  for (const [id, s] of fx.docs) if (!docs.some((d) => d.id === id)) docs.push({ id, kind: s.kind, data: s.data, isNew: false });
  return { plan: { ...plan, entities, docs }, blocked: fx.blocked };
}

/** In welcher Reihenfolge Dokumente einer Art nach den anderen kommen: was andere nennen, zuerst. */
const DOC_ORDER: Readonly<Record<DocKind, number>> = {
  collection: 0, template: 1, addform: 1, look: 1, rules: 1, values: 1, settings: 1, reward: 1, kind: 1,
  view: 2, revision: 3, flow: 4, anchor: 5, merge: 6, contribution: 6, worldmap: 7
};

/**
 * DEN PLAN AUSFÜHREN — 2026-11-03: IN EINEM ZUG, ALLE ODER KEINER. Erst wird geprüft, worauf er zeigt
 * (`importProblems`): zeigt etwas ins Leere, geht nichts (`ImportBlocked`, je Element und Feld). Dann EIN Zapis, in der
 * Reihenfolge, in der eines auf dem anderen baut — neue Rodzaje (mit ihren bleibenden Namen), geänderte Rodzaje, neue
 * Einträge (mit ihren bleibenden Namen), geänderte Einträge, dann die Dokumente (Widoki nach dem, was sie nennen) —, den
 * der Dienst in einer Transaktion schreibt. Scheitert er, ist nichts gespeichert, und der Fehler sagt, woran es lag.
 * Danach entsteht die Abschrift für AI (MCP) gleich neu.
 */
export async function applyImport(lib: CogitaLibrary, planIn: ImportPlan, stage: (text: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  /* 2026-11-03 — Löschungen: was darauf zeigt, wird im selben Zapis mitgeschrieben — oder es blockiert. */
  const removed = withRemovals(lib, planIn);
  if (removed.blocked.length > 0) throw new ImportBlocked(removed.blocked, t('cogitaData.import.removalBlockedLead'));
  const plan = removed.plan;
  const gone = (plan.removals ?? []).map((r) => r.id);
  const checked = importProblems(lib, plan);
  if (checked.blocked.length > 0) throw new ImportBlocked(checked.blocked);
  const warnings = [...plan.warnings, ...checked.kept];
  if (checked.unchecked > 0) warnings.push(t('cogitaData.import.unchecked', { count: checked.unchecked }));

  const docs = plan.docs.map((d, i) => ({ d, i })).sort((a, b) => DOC_ORDER[a.d.kind] - DOC_ORDER[b.d.kind] || a.i - b.i).map((x) => x.d);
  const kindItem = (k: ImportPlan['kinds'][number]): BatchItem => ({ sort: 'kind', def: k.def, ...(k.marks === undefined ? {} : { marks: k.marks }) });
  const entityItem = (e: ImportPlan['entities'][number]): BatchItem => ({ sort: 'entity', id: e.id, kinds: e.kinds, data: e.data, ...(e.marks === undefined ? {} : { marks: e.marks }) });
  const items: BatchItem[] = [
    ...plan.kinds.filter((k) => k.isNew).map(kindItem),
    ...plan.kinds.filter((k) => !k.isNew).map(kindItem),
    ...plan.entities.filter((e) => e.isNew).map(entityItem),
    ...plan.entities.filter((e) => !e.isNew).map(entityItem),
    ...docs.map((d): BatchItem => ({ sort: 'doc', kind: d.kind, id: d.id, data: d.data }))
  ];
  if (items.length === 0 && gone.length === 0) return { lines: [t('cogitaData.import.nothingToSave')], warnings };

  /* Wie ein Element heisst — für einen Fehler des Dienstes, der nur Kennungen nennt. */
  const kindLook = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const entityLook = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const look: Lookup = { kind: (id) => kindLook.get(id) ?? lib.kind(id), entity: (id) => entityLook.get(id) ?? lib.entity(id) };
  const nameOf = (id: string): string => {
    const k = kindLook.get(id);
    if (k !== undefined) return t('cogitaData.import.kindTitle', { name: k.name });
    const e = entityLook.get(id);
    if (e !== undefined) return t('cogitaData.import.entryTitle', { name: labelOf(e, look) || id });
    const d = plan.docs.find((x) => x.id === id);
    if (d !== undefined) return t('cogitaData.import.docTitle', { doc: DOC_LABEL[d.kind], name: str(d.data.name) || '—' });
    const r = plan.removals?.find((x) => x.id === id);
    return r === undefined ? id : t('cogitaData.import.toBeRemoved', { title: r.title });
  };

  stage(gone.length === 0 ? t('cogitaData.import.saving', { count: items.length }) : t('cogitaData.import.savingRemoving', { count: items.length, removed: gone.length }));
  try {
    await lib.saveBatch(items, (done, total) => { if (done === total || done % 50 === 0) stage(t('cogitaData.import.sealing', { done, total })); }, gone);
  } catch (e) {
    const detail = (e as { detail?: unknown }).detail;
    const listed = isObject(detail) && Array.isArray(detail.problems) ? detail.problems.filter(isObject).map((p) => `${nameOf(str(p.entryId))}: ${str(p.error)}`) : [];
    if (listed.length > 0) throw new ImportBlocked(listed, t('cogitaData.import.serviceRejected'));
    const said = e instanceof Error && e.message !== '' ? e.message : t('cogitaData.import.saveFailed');
    throw new ImportBlocked([], said.startsWith(t('cogitaData.import.nothingSaved')) ? said : t('cogitaData.import.nothingSavedBecause', { reason: said }));
  }

  const both = (label: string, list: readonly { readonly isNew: boolean }[]): string => {
    const fresh = list.filter((x) => x.isNew).length;
    const changed = list.length - fresh;
    return list.length === 0 ? '' : `${label} — ${[fresh > 0 ? t('cogitaData.import.bothNew', { count: fresh }) : '', changed > 0 ? t('cogitaData.import.bothChanged', { count: changed }) : ''].filter(Boolean).join(', ')}`;
  };
  const parts = [both(t('cogitaData.import.kindsLabel'), plan.kinds), both(t('cogitaData.import.entriesLabel'), plan.entities), ...DOC_KINDS.map((k) => both(DOC_LABEL[k], plan.docs.filter((d) => d.kind === k))), gone.length === 0 ? '' : t('cogitaData.import.removedCount', { count: gone.length })].filter(Boolean);
  const lines = [t('cogitaData.import.savedAll', { count: items.length + gone.length, parts: parts.join('; ') })];

  stage(t('cogitaData.import.refreshingAi'));
  const ai = await lib.store.refreshAiNow().catch(() => null);
  if (ai !== null && ai.refreshed > 0) lines.push(t('cogitaData.import.aiRefreshed'));
  if (ai !== null && ai.failed > 0) warnings.push(ai.reason === undefined ? t('cogitaData.import.aiFailed') : t('cogitaData.import.aiFailedBecause', { reason: ai.reason }));
  return { lines, warnings };
}

/* -- Beschreibung und Auftrag ------------------------------------------------------------------ */

/** Die Rodzaje dieser Baza wiedzy, kurz — damit ein Dokument sie beim Namen nennen kann. */
const kindsOfBase = (lib?: CogitaLibrary): string =>
  lib === undefined ? '' : `\n${t('cogitaDataFormat.kindsOfBase.head')}\n${lib.kinds.map((k) => `  "${isBaseKind(k.id) ? k.id : k.name}" — ${k.name}: ${k.fields.map((f) => `${f.key} (${FIELD_TYPE_LABEL[f.type]}${f.multi ? t('cogitaDataFormat.kindsOfBase.multi') : ''}${f.uncertain ? t('cogitaDataFormat.kindsOfBase.uncertain') : ''})`).join(', ')}`).join('\n')}\n`;

/** Ein Beispielwert je Feld einer Frage — für die Beschreibung (die Art bestimmt, welche gelten). */
const QUESTION_EXAMPLE: Readonly<Record<string, string>> = {
  'number.answers': '["12"]', 'date.answers': '["1410-07-15"]', 'date.tolerance': '0', correct: '[1]', value: 'true',
  left: '["1410", "1569", "1791"]', show: '4',
  items: '["1s", "2s", "2p", "3s"]', tolerance: '0.5', relative: 'false', unit: '"N·m"', quantity: '"Torque"', precision: '"year"',
  task: '"…"', starter: '"def transform(x): …"', createInput: '"def create_input(seed): …"', reference: '"def reference(x): …"', cases: '5',
  place: '{"lat": 53.49, "lon": 20.1}', radius: '20000', solution: '"v0 = 12"',
  /* 2026-11-01 (Lemma) */
  'gap.choices': '[["Satz 2.1", "Lemma 3.4"], []]', choices: '[["…"]]',
  'build.items': '["$\\\\exists a\\\\in A$", "$:$", "$\\\\neg P(a)$"]', extra: '["$\\\\forall a\\\\in A$", "$P(a)$"]', alternatives: '[["…", "…"]]', preview: '"math"', 'order.preview': '"math"', join: '" "'
};
/* 2026-11-05 — Beispielwerte mit Wörtern: in der Sprache der Beschreibung (`cogitaDataFormat.questionExample.*`). */
const QUESTION_EXAMPLE_TEXT: Readonly<Record<string, string>> = {
  answers: 'answers', 'gap.answers': 'gapAnswers', options: 'options', right: 'right', leftLabel: 'leftLabel', rightLabel: 'rightLabel',
  back: 'back', drawing: 'drawing', goal: 'goal', feedback: 'feedback', tests: 'tests'
};
const questionExample = (key: string): string | undefined => {
  const text = QUESTION_EXAMPLE_TEXT[key];
  return text !== undefined ? t(`cogitaDataFormat.questionExample.${text}`) : QUESTION_EXAMPLE[key];
};

/**
 * 2026-10-27 — DAS SCHEMA DER FRAGE im JSON: ein Rodzaj, die Rodzaje pytań aus `questionTypes.ts`
 * (was der Lernende tut, welche Felder dazugehören) — erzeugt, nie abgeschrieben.
 */
export function questionSection(): string {
  /* Im Deutschen bleibt das Hauptwort gross. */
  const small = (text: string) => (appLang() === 'de' ? text : text.charAt(0).toLowerCase() + text.slice(1));
  const label = (key: string) => small(QUESTION.fields.find((f) => f.key === key)?.label ?? key);
  const example = (form: string, key: string) => questionExample(`${form}.${key}`) ?? questionExample(key) ?? '…';
  const types = QUESTION_TYPES.map((q) => `    ${t('cogitaDataFormat.question.typeLine', {
    form: q.form, label: q.label, says: q.says, prompt: small(q.prompt),
    fields: q.fields.map((k) => t('cogitaDataFormat.question.typeField', { key: k, label: label(k), example: example(q.form, k) })).join('')
  })}`).join('\n');
  return `${t('cogitaDataFormat.question.head')}
${types}
${t('cogitaDataFormat.question.body.s01', { shared: QUESTION_SHARED.map((k) => `"${k}" (${label(k)})`).join(', ') })}
${t('cogitaDataFormat.question.body.s02Show', { showMax: SHOW_MAX })}
${t('cogitaDataFormat.question.body.s03Show')}
${t('cogitaDataFormat.question.body.s04Ref')}
${t('cogitaDataFormat.question.body.s05Ref')}
${t('cogitaDataFormat.question.body.s06Ref')}
${t('cogitaDataFormat.question.body.s07Gap')}
${t('cogitaDataFormat.question.body.s08')}
${t('cogitaDataFormat.question.body.s09Hints')}
${t('cogitaDataFormat.question.body.s10Explanation')}
${t('cogitaDataFormat.question.body.s11Feedback')}
${t('cogitaDataFormat.question.body.s12Build')}
${t('cogitaDataFormat.question.body.s13Code')}
${t('cogitaDataFormat.question.body.s14Generate')}
${t('cogitaDataFormat.question.body.s15')}
${generatorExprDescription().split('\n').map((line) => `      ${line}`).join('\n')}`;
}

/** Was ein Formularz dodawania im JSON ist — im Kurs, im Schema und für sich. */
const formsSection = (): string => `${t('cogitaDataFormat.forms.s01Forms')}
${t('cogitaDataFormat.forms.s02Pick')}
${t('cogitaDataFormat.forms.s03Entry')}
${t('cogitaDataFormat.forms.s04Id')}
${t('cogitaDataFormat.forms.s05Order')}
${t('cogitaDataFormat.forms.s06Keys', { keyActions: KEY_ACTIONS.map((k) => `"${k}"`).join(', ') })}
${t('cogitaDataFormat.forms.s07Paste', { columnSeparators: COLUMN_SEPARATORS.map((k) => `"${k}"`).join(', '), valueSeparators: VALUE_SEPARATORS.map((k) => `"${k}"`).join(', ') })}`;

/** Was ein Rodzaj im JSON ist. */
const kindsSection = (): string => `${t('cogitaDataFormat.kinds.s01Kinds')}
${t('cogitaDataFormat.kinds.s02Name')}
${t('cogitaDataFormat.kinds.s03Reading')}
${t('cogitaDataFormat.kinds.s04Builtin')}
${t('cogitaDataFormat.kinds.s05Fields')}
${t('cogitaDataFormat.kinds.s06Structure')}
${t('cogitaDataFormat.kinds.s07Prerequisite')}
${t('cogitaDataFormat.kinds.s07Part')}
${t('cogitaDataFormat.kinds.s08External')}
${t('cogitaDataFormat.kinds.s09When')}
${t('cogitaDataFormat.kinds.s10Quantity')}
${t('cogitaDataFormat.kinds.s11Form')}
${t('cogitaDataFormat.kinds.s12', { quantities: quantitiesDescription() })}
${t('cogitaDataFormat.kinds.s13Options')}
${t('cogitaDataFormat.kinds.s14To')}
${t('cogitaDataFormat.kinds.s15Locator')}
${t('cogitaDataFormat.kinds.s16Blocks', { thesisLimit: THESIS_LIMIT })}
${t('cogitaDataFormat.kinds.s17')}
${t('cogitaDataFormat.kinds.s18', { fieldTypes: FIELD_TYPES.map((t) => `"${t}" (${FIELD_TYPE_LABEL[t]})`).join(', ') })}`;

/** 2026-10-19 — neben dem JSON eines Formulars: nur, was ihn betrifft. */
export function formDescription(lib?: CogitaLibrary): string {
  return `${t('cogitaDataFormat.form.head.s01')}

${t('cogitaDataFormat.form.head.s02', { schemaFormat: SCHEMA_FORMAT })}
${t('cogitaDataFormat.form.head.s03Format')}
${t('cogitaDataFormat.form.head.s04Kinds')}
${t('cogitaDataFormat.form.head.s05Templates')}
${t('cogitaDataFormat.form.head.s06Ref')}
${t('cogitaDataFormat.form.head.s07Ref')}

${kindsSection()}

${formsSection()}
${t('cogitaDataFormat.form.usage.s01')}
${t('cogitaDataFormat.form.usage.s02')}
${t('cogitaDataFormat.form.usage.s03')}
${t('cogitaDataFormat.form.usage.s04')}
${kindsOfBase(lib)}`;
}

/** Was die Formate bedeuten — neben jedem Import. */
export function courseDescription(lib?: CogitaLibrary): string {
  const kinds = kindsOfBase(lib);
  return `${t('cogitaDataFormat.course.head.s01')}

${t('cogitaDataFormat.course.head.s02')}
${t('cogitaDataFormat.course.head.s03', { courseFormat: COURSE_FORMAT })}
${t('cogitaDataFormat.course.head.s04Anchors', { schemaFormat: SCHEMA_FORMAT })}
${t('cogitaDataFormat.course.head.s05', { entitiesFormat: ENTITIES_FORMAT })}
${t('cogitaDataFormat.course.head.s06', { flowFormat: FLOW_FORMAT })}

${t('cogitaDataFormat.course.head.s07')}
${t('cogitaDataFormat.course.head.s08Format')}
${t('cogitaDataFormat.course.head.s09Ref')}
${t('cogitaDataFormat.course.head.s10Pole')}
${t('cogitaDataFormat.course.head.s11Ref')}
${t('cogitaDataFormat.course.head.s12Ref')}
${t('cogitaDataFormat.course.head.s13')}
${t('cogitaDataFormat.course.head.s14')}
${t('cogitaDataFormat.course.head.s15To')}
${t('cogitaDataFormat.course.head.s16Kinds')}
${t('cogitaDataFormat.course.head.s17')}
${t('cogitaDataFormat.course.head.s18')}
${t('cogitaDataFormat.course.head.s19')}
${t('cogitaDataFormat.course.head.s20')}

${t('cogitaDataFormat.course.head.s21')}
${t('cogitaDataFormat.course.head.s22')}

${kindsSection()}
${t('cogitaDataFormat.course.entities.s01Value')}
${t('cogitaDataFormat.course.entities.s02Segments')}

${t('cogitaDataFormat.course.entities.s03Entities')}
${t('cogitaDataFormat.course.entities.s04Blocks')}
${questionSection()}
${t('cogitaDataFormat.course.main.s01Interactive')}

${t('cogitaDataFormat.course.main.s02Templates')}
${t('cogitaDataFormat.course.main.s03Quote')}
${t('cogitaDataFormat.course.main.s04Tests')}
${t('cogitaDataFormat.course.main.s05Asks')}
${t('cogitaDataFormat.course.main.s06Random')}
${t('cogitaDataFormat.course.main.s07Generate')}
${t('cogitaDataFormat.course.main.s08Card')}

${t('cogitaDataFormat.course.main.s09')}
${t('cogitaDataFormat.course.main.s10')}
${t('cogitaDataFormat.course.main.s11')}
${t('cogitaDataFormat.course.main.s12')}
${t('cogitaDataFormat.course.main.s13')}
${t('cogitaDataFormat.course.main.s14Weight')}

${t('cogitaDataFormat.course.main.s15Revisions')}
${t('cogitaDataFormat.course.main.s16EndWhenDone')}
${t('cogitaDataFormat.course.main.s17Type')}
${t('cogitaDataFormat.course.main.s18Type')}
${t('cogitaDataFormat.course.main.s19Type')}
${t('cogitaDataFormat.course.main.s20Type')}
${t('cogitaDataFormat.course.main.s21Type')}
${t('cogitaDataFormat.course.main.s22Type')}
${t('cogitaDataFormat.course.main.s23Strategy')}
${t('cogitaDataFormat.course.main.s24Name')}
${t('cogitaDataFormat.course.main.s25Type')}
${t('cogitaDataFormat.course.main.s26Type')}
${t('cogitaDataFormat.course.main.s27Flows')}
${t('cogitaDataFormat.course.main.s28Graph')}
${t('cogitaDataFormat.course.main.s29End')}
${t('cogitaDataFormat.course.main.s30Type')}
${t('cogitaDataFormat.course.main.s31Goals')}
${t('cogitaDataFormat.course.main.s32Id')}
${t('cogitaDataFormat.course.main.s33DeszczPrzeglad')}
${t('cogitaDataFormat.course.main.s34About')}
${t('cogitaDataFormat.course.main.s35Narrators')}
${t('cogitaDataFormat.course.main.s36Unit')}
${t('cogitaDataFormat.course.main.s37Path')}
${t('cogitaDataFormat.course.main.s38')}
${t('cogitaDataFormat.course.main.s39Name')}
${t('cogitaDataFormat.course.main.s40Type')}
${t('cogitaDataFormat.course.main.s41Show')}
${t('cogitaDataFormat.course.main.s42RecreatioCogitaFlow')}
${t('cogitaDataFormat.course.main.s43Collections')}
${t('cogitaDataFormat.course.main.s44Views')}
${t('cogitaDataFormat.course.main.s45SourceAll')}
${t('cogitaDataFormat.course.main.s46SourceFrom')}
${t('cogitaDataFormat.course.main.s47Follow')}
${t('cogitaDataFormat.course.main.s48FilterWhen')}
${t('cogitaDataFormat.course.main.s49Sort')}
${t('cogitaDataFormat.course.main.s50Mode')}
${t('cogitaDataFormat.course.main.s51Mode')}
${t('cogitaDataFormat.course.main.s51World')}
${t('cogitaDataFormat.course.main.s52Mode')}
${t('cogitaDataFormat.course.main.s53Group')}
${t('cogitaDataFormat.course.main.s54')}
${t('cogitaDataFormat.course.main.s55Name')}
${t('cogitaDataFormat.course.main.s56Name')}
${t('cogitaDataFormat.course.main.s57View')}
${rewardsSection()}
${t('cogitaDataFormat.course.anchors.s01Anchors')}
${t('cogitaDataFormat.course.anchors.s02')}
${t('cogitaDataFormat.course.anchors.s03')}
${formsSection()}
${courseUsage()}
${kinds}`;
}

/**
 * 2026-11-02 — NAGRODY (`rewards.ts`): Punkte, Serie, Tagesziel, Stufen, Abzeichen — eine Regel als Dokument; was
 * fehlt, nimmt die eingebaute Regel („Punkty, seria i poziomy").
 */
/* In der Sprache, die beim Lesen gilt — nie beim Laden des Moduls. */
const rewardsSection = (): string => `${t('cogitaDataFormat.rewards.s01Rewards')}
${t('cogitaDataFormat.rewards.s02Ref')}
${t('cogitaDataFormat.rewards.s03Points')}
${t('cogitaDataFormat.rewards.s04Goal')}
${t('cogitaDataFormat.rewards.s05Badges')}
${t('cogitaDataFormat.rewards.s06')}`;

/**
 * 2026-10-30 — WAS AUS DEM IMPORTIERTEN WIRD, im ganzen System (der Wunsch des Besitzers: neben jedem Import, wie die
 * Daten gebraucht werden). Jede Zeile ist im Code nachgeprüft.
 */
const courseUsage = (): string => `${t('cogitaDataFormat.usage.s01')}
${t('cogitaDataFormat.usage.s02Anchors')}
${t('cogitaDataFormat.usage.s03')}
${t('cogitaDataFormat.usage.s04Landscape')}
${t('cogitaDataFormat.usage.s05About')}
${t('cogitaDataFormat.usage.s06')}
${t('cogitaDataFormat.usage.s07')}
${t('cogitaDataFormat.usage.s08Rewards')}
${t('cogitaDataFormat.usage.s09')}
${t('cogitaDataFormat.usage.s10')}
${t('cogitaDataFormat.usage.s11')}
${t('cogitaDataFormat.usage.s12Remove')}
`;

/**
 * DER AUFTRAG FÜR DIE EIGENE KI [P13] — zum Kopieren: was sie tun soll, das
 * Format, die Rodzaje dieser Bibliothek, und der Text, aus dem sie schöpft.
 */
export function aiPrompt(lib: CogitaLibrary, what: 'entities' | 'statements' | 'questions' | 'flow' | 'schema', source: string): string {
  /* 2026-10-23 — Aussagen statt „Wiedza": Einträge eines Rodzaj mit Feld blocks; fehlt er, bringt das Dokument den Komentarz mit. */
  const said = lib.kinds.filter((k) => k.fields.some((f) => f.type === 'blocks')).map((k) => `"${k.name}"`);
  const task = {
    entities: () => t('cogitaDataFormat.aiPrompt.entities'),
    statements: () => t('cogitaDataFormat.aiPrompt.statements', { kinds: said.length > 0 ? t('cogitaDataFormat.aiPrompt.statementsHave', { names: said.join(', ') }) : t('cogitaDataFormat.aiPrompt.statementsMissing') }),
    /* 2026-10-27 — ein Schema mit Rodzaje pytań, und die Reihenfolge: das Allgemeine vor dem Besonderen. */
    questions: () => t('cogitaDataFormat.aiPrompt.questions'),
    flow: () => t('cogitaDataFormat.aiPrompt.flow', { flowFormat: FLOW_FORMAT }),
    schema: () => t('cogitaDataFormat.aiPrompt.schema')
  }[what]();
  return `${task}
${t('cogitaDataFormat.aiPrompt.answerOnly', { format: what === 'flow' ? FLOW_FORMAT : what === 'schema' ? SCHEMA_FORMAT : ENTITIES_FORMAT })}
${t('cogitaDataFormat.aiPrompt.useRefs')}

${courseDescription(lib)}
${t('cogitaDataFormat.aiPrompt.source')}
"""
${source.trim()}
"""
`;
}
