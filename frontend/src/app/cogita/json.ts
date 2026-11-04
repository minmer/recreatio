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
import { flowProblems } from './flowCheck';
import { detourProblems } from './detour';
import { graphJson, readGraph, type Graph, type GraphNode } from './graph';
import { migrateRevision } from './revision';
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
  reward: 'rewards'
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
const SETUP_SETTINGS = ['sources', 'dependencies', 'tags', 'motivation', 'dailyGoal', 'rewards', 'offline', 'joinPage', 'language'] as const;

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
  if (!isObject(doc)) return { error: 'To nie jest dokument JSON.' };
  if (!Array.isArray(doc.forms) || doc.forms.length === 0) return { error: 'W dokumencie nie ma formularza — brak listy „forms".' };
  const extra = ['entities', 'revisions', 'flows', 'collections', 'looks', 'rules', 'values', 'views', 'settings', 'rewards'].filter((k) => doc[k] !== undefined);
  /* 2026-11-03 — die Kennungen des ganzen Dokuments: die Vorschau und das Speichern geben Neuem dieselben (`importIds`). */
  const plan = planImport(lib, { format: doc.format, version: doc.version, name: doc.name, kinds: doc.kinds, templates: doc.templates, forms: doc.forms }, { ids: importIds(lib, doc) });
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
  if (!isObject(doc)) return { error: 'To nie jest dokument JSON.' };
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
    return { error: 'To jest tekst źródła ("recreatio/source-text") — importuje się go w Bibliotece, nie w Cogicie: z nowym dziełem w Źródłach „Dzieło z tekstem (JSON)”; do dzieła, które już jest — na jego stronie, w ramce „Tekst źródła”.' };
  }
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
    if (raw.remove === true) { warnings.push(`Rodzaj „${str(raw.name) || str(raw.ref) || '—'}”: rodzajów nie usuwa się importem — Schematy → rodzaj → „Usuń rodzaj” pokazuje, co zniknie razem z nim. Pominięte.`); continue; }
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
    /* 2026-10-31 — der Wzór tekstu bleibt, wenn das Dokument ihn nicht nennt; "reading": "" nimmt ihn ab. */
    const reading = 'reading' in raw ? def.reading : before.reading;
    if (name !== before.name) warnings.push(`Rodzaj „${before.name}” zmienia nazwę na „${name}”.`);
    if (label !== before.label) warnings.push(`Rodzaj „${name}”: wzór etykiety „${before.label}” → „${label}”.`);
    if (tells !== before.tells) warnings.push(`Rodzaj „${name}”: pole odróżniające imienników „${before.tells ?? '—'}” → „${tells ?? '—'}”.`);
    if (system !== before.system) warnings.push(`Rodzaj „${name}”: stała rola w silniku „${before.system ?? '—'}” → „${system ?? '—'}”.`);
    if (reading !== before.reading) warnings.push(`Rodzaj „${name}”: ${reading === undefined ? 'bez wzoru tekstu do czytania (jak dotąd: streszczenie albo pierwszy akapit, potem pola z tekstem)' : 'nowy wzór tekstu do czytania'}.`);
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
    let entityKinds = (Array.isArray(raw.kinds) ? raw.kinds : [raw.kind]).map(kindId).filter((k): k is string => k !== null);
    /* 2026-11-03 — eine Änderung an einem bestehenden Eintrag (an seiner Kennung) muss seine Rodzaje nicht nennen: er behält sie. */
    const existing = ids[i]!.isNew ? undefined : lib.entity(ids[i]!.id);
    if (entityKinds.length === 0 && !('kinds' in raw) && !('kind' in raw) && existing !== undefined) entityKinds = [...existing.kinds];
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
    /* 2026-11-03 — was wegfällt, mit dem Eintrag UND dem Feld (auf dem Bildschirm nach dem Zapis steht es so). */
    const fieldName = (path: readonly string[]) => { const f = path[0] === undefined ? undefined : fieldOf(entityKinds, path[0]); return f === undefined ? path.join('.') : `${f.label} (${f.key})`; };
    const data = isObject(raw.data) ? refsIn(raw.data, (r) => resolveRef(r), (missing, path) => warnings.push(`Wpis ${str(raw.ref) || i + 1}, pole „${fieldName(path)}”: ${missingWhy(missing)}.`), modeAt) : {};
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
      data = refsIn(rest, resolveDocRef, (missing, path) => warnings.push(`${label}, „${path.filter((p) => !/^d+$/.test(p)).join('.') || '—'}”: ${missingWhy(missing)}.`), docModeAt);
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
    if (r === null || hit === undefined) { warnings.push(`Usuwanie „${label(raw)}”: nie ma takiego wpisu w tej bazie — nie ma czego usunąć.`); continue; }
    if (!lib.isOwn(hit.id)) { warnings.push(`Usuwanie „${lib.label(hit)}”: ten wpis pochodzi z innej biblioteki — usuwa się go tam. Pominięte.`); continue; }
    if (removing.has(hit.id)) continue;
    removing.add(hit.id);
    removals.push({ id: hit.id, target: 'entity', title: lib.label(hit) || hit.id });
  }
  for (const { kind, raw } of docRemoveRows) {
    const r = ref(raw.ref ?? raw.id);
    const hit = r === null ? undefined : lib.docs(kind).find((d) => d.id === r) ?? (lasting(r) ? lib.byImportRef(r.toLowerCase(), kind) : undefined);
    if (r === null || hit === undefined) { warnings.push(`Usuwanie: ${DOC_LABEL[kind]} „${label(raw)}” — nie ma takiego w tej bazie, nie ma czego usunąć.`); continue; }
    if (!lib.isOwn(hit.id)) { warnings.push(`Usuwanie: ${DOC_LABEL[kind]} „${str(hit.data.name) || hit.id}” pochodzi z innej biblioteki — pominięte.`); continue; }
    if (removing.has(hit.id)) continue;
    removing.add(hit.id);
    removals.push({ id: hit.id, target: 'doc', kind, title: `${DOC_LABEL[kind]} „${str(hit.data.name) || '—'}”` });
  }
  for (const list of [entities, docs] as const) {
    for (let at = list.length - 1; at >= 0; at -= 1) {
      const one = list[at]!;
      if (!removing.has(one.id)) continue;
      warnings.push(`„${removals.find((x) => x.id === one.id)?.title ?? one.id}”: ten sam dokument go zmienia i usuwa — zostanie tylko usunięty.`);
      list.splice(at, 1);
    }
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
  /* 2026-11-04 — die Ścieżka jedes Ablaufs: ein Anfang, ein Ende, keine Sackgassen (`flowCheck.ts`; ohne Anfang oder Ende geht der Zapis nicht). */
  warnings.push(...flowWarnings(lib, docs));
  /* 2026-11-03 — der Krajobraz: Kreise in der Reihenfolge des Lernens, unbekannte Achsen, keine Reihenfolge (`landscapeImport.ts`). */
  warnings.push(...landscapeImportWarnings(lib, { kinds, entities, docs }));
  /* 2026-11-03 — die Generatoren: übersetzen ihre Ausdrücke, gelingen Proben (mit den Einträgen nach dem Import)? */
  warnings.push(...generatorImportWarnings(lib, { kinds, entities, docs }));

  const lines = [
    kinds.length === 0 ? '' : `Rodzaje: ${kinds.filter((k) => k.isNew).length} nowych, ${kinds.filter((k) => !k.isNew).length} do zmiany.`,
    entities.length === 0 ? '' : `Wpisy: ${entities.filter((e) => e.isNew).length} nowych, ${entities.filter((e) => !e.isNew).length} do zmiany.`,
    ...DOC_KINDS.map((k) => {
      const n = docs.filter((d) => d.kind === k);
      return n.length === 0 ? '' : `${DOC_LABEL[k]}: ${n.filter((d) => d.isNew).length} nowych, ${n.filter((d) => !d.isNew).length} do zmiany.`;
    }),
    removals.length === 0 ? '' : `Do usunięcia: ${removals.length}.`
  ].filter(Boolean);
  if (lines.length === 0) return { error: 'W dokumencie nie ma nic do zaimportowania.' };
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

/**
 * 2026-11-03 — EIN IMPORT, DER NICHT GEHT, SAGT WARUM: jede Zeile ein Element und sein Feld. Gespeichert ist nichts.
 */
export class ImportBlocked extends Error {
  constructor(readonly problems: readonly string[], lead = 'Nic nie zapisano — import wskazuje na coś, czego nie ma:') {
    super([lead, ...problems].join('\n'));
  }
}

/** 2026-11-04 — die Probleme der Ścieżka jedes Ablaufs eines Plans, beim Namen des Ablaufs und des Schrittes. */
function flowIssues(lib: CogitaLibrary, docs: ImportPlan['docs']): { level: 'error' | 'warning'; text: string }[] {
  const label = (id: string) => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
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
  return docs.filter((d) => d.kind === 'flow').flatMap((d) => {
    const flow = readFlow(d.id, d.data);
    const detours = detourProblems(flow, all, resolve).filter((p) => { if (p.step !== undefined) return true; if (said.has(p.text)) return false; said.add(p.text); return true; });
    return [...flowProblems(flow, label, d.data), ...detours].map((p) => ({ level: p.level, text: `Przebieg „${flow.name}”: ${p.text}` }));
  });
}
const flowWarnings = (lib: CogitaLibrary, docs: ImportPlan['docs']): string[] => flowIssues(lib, docs).map((p) => (p.level === 'error' ? `${p.text} Bez tego zapis się nie uda.` : p.text));

/** Was ein Widok an Rodzajen nennt — nur, was dort sicher ein Rodzaj ist (Quelle, Gruppe, Achse). */
function viewKindRefs(data: Readonly<Record<string, unknown>>): { where: string; id: string }[] {
  const out: { where: string; id: string }[] = [];
  const steps = Array.isArray(data.steps) ? data.steps : [];
  steps.forEach((step, i) => {
    const kind = isObject(step) && isObject(step.config) ? step.config.kind : undefined;
    if (typeof kind === 'string' && kind !== '') out.push({ where: `krok ${i + 1} (źródło)`, id: kind });
  });
  if (isObject(data.group) && typeof data.group.kind === 'string' && data.group.kind !== '') out.push({ where: 'grupowanie (group.kind)', id: data.group.kind });
  for (const c of Array.isArray(data.columns) ? data.columns : []) {
    if (typeof c === 'string' && c.startsWith(AXIS_COLUMN)) out.push({ where: 'kolumny (oś)', id: c.slice(AXIS_COLUMN.length) });
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
  const notChosen = (problem: string, name: string) => `${problem}: wskazuje na nowy element — ${name} — który nie jest zaznaczony do zapisu; zaznacz go albo odznacz to, co na niego wskazuje.`;
  /* Wer schon auf ein Abgewähltes zeigt (Element|Ziel) — die Suche unten nennt es nicht ein zweites Mal. */
  const reported = new Set<string>();
  /* Ein Ziel, das fehlt: was nicht mitgespeichert wird, beim Namen; sonst die Kennung. */
  const check = (owner: string, id: string, sort: 'rodzaj' | 'wpis', known: boolean, problem: string, wasBefore: boolean): void => {
    if (known) return;
    const name = unsaved.get(id);
    if (name !== undefined) { reported.add(`${owner}|${id}`); blocked.push(notChosen(problem, name)); return; }
    if (!sure) { unchecked += 1; return; }
    if (wasBefore) { kept.push(`${problem}: wskazuje ${sort} „${id}”, którego nie ma (tak było już przed importem) — popraw to pole.`); return; }
    blocked.push(`${problem}: wskazuje ${sort} „${id}”, którego nie ma ani w dokumencie, ani w bazie.`);
  };

  /* Was dieser Zapis an einem Bestehenden nicht anfasst (ein Feld, das bleibt, wie es war), prüft er nicht — er schreibt dort nichts Neues. */
  const untouched = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const k of plan.kinds) {
    const before = lib.kind(k.id);
    for (const f of k.def.fields) {
      const old = before?.fields.find((x) => x.key === f.key);
      if (old !== undefined && untouched(old, f)) continue;
      const had = new Set(old?.to ?? []);
      for (const t of f.to ?? []) check(k.id, t, 'rodzaj', kindKnown(t), `Rodzaj „${k.def.name}”, pole „${f.label}” (to)`, had.has(t));
    }
  }
  for (const e of plan.entities) {
    const entity = planned.get(e.id)!;
    const before = lib.isOwn(e.id) ? lib.entity(e.id) : undefined;
    const title = `Wpis „${plan.titles?.get(e.id) || labelOf(entity, look) || e.id}”`;
    for (const k of e.kinds) if (before?.kinds.includes(k) !== true) check(e.id, k, 'rodzaj', kindKnown(k), `${title}, rodzaj`, false);
    for (const f of fieldsOf(entity, look)) {
      if (f.type !== 'ref') continue;
      if (before !== undefined && untouched(before.data[f.key], e.data[f.key])) continue;
      const had = new Set(before === undefined ? [] : valuesOf(before, f).map((v) => v.value).filter((v): v is string => typeof v === 'string'));
      for (const v of valuesOf(entity, f)) {
        if (typeof v.value !== 'string' || v.value === '') continue;
        check(e.id, v.value, 'wpis', entityKnown(v.value), `${title}, pole „${f.label}”`, had.has(v.value));
      }
    }
  }
  /* 2026-11-04 — ein Ablauf ohne Anfang oder ohne Ende: kein Zapis (die Warnungen nennen die Schritte). */
  for (const p of flowIssues(lib, plan.docs)) if (p.level === 'error') blocked.push(p.text);
  for (const d of plan.docs) {
    if (d.kind !== 'view') continue;
    const title = `${DOC_LABEL[d.kind]} „${str(d.data.name) || '—'}”`;
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
    for (const d of plan.docs) for (const [key, value] of Object.entries(d.data)) if (!key.startsWith('_')) scan(d.id, value, `${DOC_LABEL[d.kind]} „${str(d.data.name) || '—'}”, „${key}”`);
    for (const e of plan.entities) {
      const entity = planned.get(e.id)!;
      const fields = fieldsOf(entity, look);
      for (const [key, value] of Object.entries(e.data)) {
        if (key.startsWith('_')) continue;
        scan(e.id, value, `Wpis „${plan.titles?.get(e.id) || labelOf(entity, look) || e.id}”, pole „${fields.find((x) => x.key === key)?.label ?? key}”`);
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
      for (const g of found) blocked.push(`Wpis „${title}”, pole „${field?.label ?? key}”: wskazuje w treści na usuwany element „${nameOf(g)}” — popraw to pole w tym samym dokumencie, usuń też ten wpis albo nie usuwaj.`);
    }
    if (data !== null) entities.set(e.id, { kinds: e.kinds, data });
  }

  /* Dokumente nach dem Zapis (ohne Zusammenführungen und Beiträge — die gehören zur Geschichte eines Eintrags). */
  const afterDocs = new Map<string, { kind: DocKind; data: Readonly<Record<string, unknown>> }>();
  for (const k of DOC_KINDS) {
    if (k === 'merge' || k === 'contribution' || k === 'kind') continue;
    for (const d of lib.docs(k)) if (lib.isOwn(d.id) && !gone.has(d.id)) afterDocs.set(d.id, { kind: k, data: d.data });
  }
  for (const d of plan.docs) if (!gone.has(d.id)) afterDocs.set(d.id, { kind: d.kind, data: d.data });
  for (const [id, d] of afterDocs) {
    const title = `${DOC_LABEL[d.kind]} „${str(d.data.name) || '—'}”`;
    if (d.kind === 'collection' && Array.isArray(d.data.list)) {
      const kept = d.data.list.filter((x) => !(typeof x === 'string' && gone.has(x)));
      if (kept.length !== d.data.list.length) {
        for (const x of d.data.list) if (typeof x === 'string' && gone.has(x)) note(x, title);
        docs.set(id, { kind: d.kind, data: { ...d.data, list: kept } });
      }
      const rest = new Set<string>();
      for (const [key, value] of Object.entries(d.data)) if (key !== 'list' && !key.startsWith('_')) hits(value, rest);
      for (const g of rest) blocked.push(`${title}: wskazuje na usuwany element „${nameOf(g)}” — popraw go w tym samym dokumencie, usuń go też albo nie usuwaj.`);
      continue;
    }
    for (const [key, value] of Object.entries(d.data)) {
      if (key.startsWith('_')) continue;
      const found = new Set<string>();
      hits(value, found);
      for (const g of found) blocked.push(`${title}, „${key}”: wskazuje na usuwany element „${nameOf(g)}” — popraw go w tym samym dokumencie, usuń go też albo nie usuwaj.`);
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
  view: 2, revision: 3, flow: 4, anchor: 5, merge: 6, contribution: 6
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
  if (removed.blocked.length > 0) throw new ImportBlocked(removed.blocked, 'Nic nie zapisano ani nie usunięto — na usuwane elementy wskazuje coś, co zostaje:');
  const plan = removed.plan;
  const gone = (plan.removals ?? []).map((r) => r.id);
  const checked = importProblems(lib, plan);
  if (checked.blocked.length > 0) throw new ImportBlocked(checked.blocked);
  const warnings = [...plan.warnings, ...checked.kept];
  if (checked.unchecked > 0) warnings.push(`Nie wszystkie źródła tej bazy są wczytane — ${checked.unchecked} ${plural(checked.unchecked, 'odwołania', 'odwołań', 'odwołań')} do nich nie dało się sprawdzić.`);

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
  if (items.length === 0 && gone.length === 0) return { lines: ['Nic do zapisania — dokument zgadza się z tym, co już jest.'], warnings };

  /* Wie ein Element heisst — für einen Fehler des Dienstes, der nur Kennungen nennt. */
  const kindLook = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const entityLook = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const look: Lookup = { kind: (id) => kindLook.get(id) ?? lib.kind(id), entity: (id) => entityLook.get(id) ?? lib.entity(id) };
  const nameOf = (id: string): string => {
    const k = kindLook.get(id);
    if (k !== undefined) return `Rodzaj „${k.name}”`;
    const e = entityLook.get(id);
    if (e !== undefined) return `Wpis „${labelOf(e, look) || id}”`;
    const d = plan.docs.find((x) => x.id === id);
    if (d !== undefined) return `${DOC_LABEL[d.kind]} „${str(d.data.name) || '—'}”`;
    const r = plan.removals?.find((x) => x.id === id);
    return r === undefined ? id : `${r.title} (do usunięcia)`;
  };

  stage(`Zapisywanie ${items.length} ${plural(items.length, 'elementu', 'elementów', 'elementów')}${gone.length === 0 ? '' : ` i usuwanie ${gone.length}`} w jednym zapisie…`);
  try {
    await lib.saveBatch(items, (done, total) => { if (done === total || done % 50 === 0) stage(`Pieczętowanie ${done} z ${total}…`); }, gone);
  } catch (e) {
    const detail = (e as { detail?: unknown }).detail;
    const listed = isObject(detail) && Array.isArray(detail.problems) ? detail.problems.filter(isObject).map((p) => `${nameOf(str(p.entryId))}: ${str(p.error)}`) : [];
    if (listed.length > 0) throw new ImportBlocked(listed, 'Nic nie zapisano — usługa nie przyjęła tych elementów (pozostałe czekały razem z nimi):');
    const said = e instanceof Error && e.message !== '' ? e.message : 'zapis się nie udał';
    throw new ImportBlocked([], said.startsWith('Nic nie zapisano') ? said : `Nic nie zapisano: ${said}`);
  }

  const both = (label: string, list: readonly { readonly isNew: boolean }[]): string => {
    const fresh = list.filter((x) => x.isNew).length;
    const changed = list.length - fresh;
    return list.length === 0 ? '' : `${label} — ${[fresh > 0 ? `nowe: ${fresh}` : '', changed > 0 ? `zmienione: ${changed}` : ''].filter(Boolean).join(', ')}`;
  };
  const parts = [both('rodzaje', plan.kinds), both('wpisy', plan.entities), ...DOC_KINDS.map((k) => both(DOC_LABEL[k], plan.docs.filter((d) => d.kind === k))), gone.length === 0 ? '' : `usunięte: ${gone.length}`].filter(Boolean);
  const lines = [`Zapisano wszystko w jednym zapisie (${items.length + gone.length} ${plural(items.length + gone.length, 'element', 'elementy', 'elementów')}) — ${parts.join('; ')}.`];

  stage('Odświeżanie kopii dla AI…');
  const ai = await lib.store.refreshAiNow().catch(() => null);
  if (ai !== null && ai.refreshed > 0) lines.push('Kopia dla AI (MCP) odświeżona — asystent widzi już ten stan.');
  if (ai !== null && ai.failed > 0) warnings.push(`Kopii dla AI (MCP) nie udało się odświeżyć${ai.reason === undefined ? '' : `: ${ai.reason}`} — odświeży się przy następnej zmianie.`);
  return { lines, warnings };
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
  place: '{"lat": 53.49, "lon": 20.1}', radius: '20000', drawing: '"{… JSON rysunku …}"', goal: '"abs(x - cel) < 0.5"', solution: '"v0 = 12"',
  /* 2026-11-01 (Lemma) */
  feedback: '["Za mało — policz też zbiór pusty.", "", "Tak: 2^3 = 8.", "Za dużo."]', 'gap.choices': '[["Satz 2.1", "Lemma 3.4"], []]', choices: '[["…"]]',
  'build.items': '["$\\\\exists a\\\\in A$", "$:$", "$\\\\neg P(a)$"]', extra: '["$\\\\forall a\\\\in A$", "$P(a)$"]', alternatives: '[["…", "…"]]', preview: '"math"', 'order.preview': '"math"', join: '" "',
  tests: '[{"input": [3, 1, 2], "output": [1, 2, 3], "note": "rosnąco"}]'
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
    części (2026-11-01): każde pytanie pyta o części, a każda część jest faktem liczonym osobno — para (match), zdanie (many: dobrze zaznaczone albo dobrze pominięte, wynik to średnia; z "show" każde zdanie ma swoją kartę), słowo w luce (gap z kilkoma lukami); pytanie bez części (text, number, date, one, truefalse, flash, order…) ma jedną część tylko z "fact" (nazwa faktu; "#strona" = ta strona wpisu z "about", ten sam fakt co karta szablonu z "asks"); "share" (nazwa) sprawia, że pytania z tą samą nazwą dzielą te same części — jedna odpowiedź liczy się dla każdej karty, która o nią pyta; "truefalse" z "share" to zdanie, to samo co w "many" z tym samym "share"
    np. {"ref": "@q-lata", "kinds": ["question"], "data": {"form": "match", "prompt": "Połącz rok z wydarzeniem", "left": ["1410", "1569", "1791", "1918"], "right": ["Bitwa pod Grunwaldem", "Unia lubelska", "Konstytucja 3 maja", "Odzyskanie niepodległości"], "leftLabel": "Rok", "rightLabel": "Wydarzenie", "show": 3}}
    np. {"ref": "@q-atom", "kinds": ["question"], "data": {"form": "one", "prompt": "Co jest w jądrze atomu?", "options": ["Elektrony", "Protony i neutrony", "Tylko neutrony"], "correct": [1], "about": ["@atom"]}}
    np. {"ref": "@q-orbital", "kinds": ["question"], "data": {"form": "truefalse", "prompt": "Na jednym orbitalu mogą być najwyżej dwa elektrony.", "value": true, "about": ["@orbital"], "needs": ["@q-atom"]}}
    "gap" — w treści [[słowo]] to luka (uczący się widzi „…”), a bez "answers" dobrą odpowiedzią jest to słowo; kilka luk — każda osobno (wynik: część dobrych luk);
      "choices" — do każdej luki po kolei lista ZŁYCH możliwości: luka z listą jest do wybrania (dobre słowo dochodzi samo, mogą być wzory), z pustą [] — do wpisania
    WZORY: $…$ w zdaniu, $$…$$ osobno — w pytaniu, możliwościach, parach, elementach, kafelkach, podpowiedziach, wyjaśnieniu; \\$ to zwykły dolar; wpisywanie odpowiedzi nigdy nie wymaga LaTeX-a
    "hints" — podpowiedzi przed odpowiedzią (1–3, od łagodnej do konkretnej): każda odsłonięta obniża najwyższy wynik tej odpowiedzi o 0,25 (jedna — najwyżej 0,75);
    "explanation" — wyjaśnienie (zapis, 2–4 zdania, wzory, źródła [@dzieło, s. 12]) zaraz po odpowiedzi, rozwinięte; "explain" — wpisy po nim, zwinięte;
    "feedback" (one, many) — po jednym zdaniu do każdej możliwości, w kolejności "options" ("" — bez zdania): po odpowiedzi stoi pod wybraną i pod dobrymi
    "build" — kafelki dobrej odpowiedzi po kolei w "items", zbędne w "extra", inne dobre kolejności w "alternatives" (lista list), "preview": "math" (całość jako jeden wzór; kafelek $…$ wchodzi bez dolarów) albo "text", "join" — co stoi między kafelkami (domyślnie spacja);
      np. {"form": "build", "prompt": "Bilden Sie die Negation von $\\\\forall a\\\\in A: P(a)$.", "items": ["$\\\\exists a\\\\in A$", "$:$", "$\\\\neg P(a)$"], "extra": ["$\\\\forall a\\\\in A$", "$P(a)$"], "preview": "math"}
      "order" z "preview" pokazuje nad listą ułożone razem (jak "build"); "extra" przy "order" nic nie zmienia — zmiana "form" na "build" je włącza
    "code" — "tests": widoczne przykłady [{"input": …, "output": …, "note": "…"}] (wartości JSON albo tekst JSON), sprawdzane przed ukrytymi przypadkami z "createInput"/"reference"; każdy przypadek ma 2 s; wynik: część zdanych
    GENERATOR — PARAMETRY (każdy rodzaj; zadanie losowane od nowa przy każdym pokazaniu karty; ten sam mechanizm ma szablon w węźle "generate"):
      "params" — losowane po kolei: {"name": "a", "random": [20, 99], "step": 1} (liczba z przedziału; całe granice — krok 1) · {"name": "f", "values": ["sin", "cos"]} (jedna z listy; element może być listą)
        · {"name": "kation", "entry": {"kind": "@rodzaj", "where": "it.ladunek > 0"}} — jeden wpis z bazy · {"name": "zd", "entries": {"kind": "@rodzaj", "count": 4}} — kilka RÓŻNYCH (bez "count": wszystkie pasujące, w ich kolejności);
        "where" — wyrażenie z "it" (kandydat), może czytać wcześniejsze parametry (anion pasujący do kationu); "rule" — reguła jak w zbiorach ({"op": "and", "items": [{"field": "data", "cmp": "filled"}]}); wpis wylosowany już w tym zadaniu nie wraca ("repeat": true — może);
        wylosowany wpis to rekord: kation.label, kation.id, kation.kind i każde pole po kluczu — liczba (z wielkością: pole_si w SI, pole_unit), tekst, wybór (pole_label — nazwa), tak/nie jako 1/0, data jako liczba rrrrmmdd do porównań (pole_text — słowami), odwołanie jako rekord jeden krok dalej (zd[0].okres.label)
      "let": [{"name": "n", "value": "lcm(kation.ladunek, -anion.ladunek)"}] — liczone po kolei (język wyrażeń niżej); "require": ["isint(x)", "a != b"] — losuje od nowa (do 60 razy), aż wszystkie są spełnione; gdy się nie da — karta NIE powstaje (nigdy zepsuta), a autor widzi powód w edytorze, w „Do zrobienia” i w podglądzie importu
      w tekstach (prompt, options, answers, items, left, right, back, hints, explanation, feedback, extra, choices) {wyrażenie} to wartość — liczby z przecinkiem, we wzorze {,}, wpis — jego nazwa, lista — przez przecinek;
        cały element listy jako jedna lista: "options": ["{dobra}", "{zle}"] — gdy {zle} to lista, każdy jej element jest osobną możliwością (tak samo items, left, right, answers); "correct": ["{k}"], "value": "{a.data < b.data}" (prawda/fałsz), "tolerance": "{tol}" — też liczone;
        {…} z nazwą spoza parametrów to zwykły tekst (LaTeX: \\mathbb{N}, x^{2}); kto chce literę parametru jako grupę LaTeX-a, pisze ją ze spacjami: \\frac{ a }{2}
      odpowiedź zapisuje numer losowania ("seed") i wylosowane wartości (wpisy jako "@id", krótkie listy); karta zostaje ta sama (klucz pytania) — historia zaczyna się od nowa TYLKO, gdy zmieni się generator (params, let, require) albo wzór odpowiedzi (answers, options, correct, items …), nigdy przy losowaniu
      "rule" przy form "text": {"spaces": true} — spacje się nie liczą; {"scripts": true} — indeksy (₂, ²) jak zwykłe cyfry: Al2(SO4)3 = Al₂(SO₄)₃
      np. {"form": "number", "prompt": "Bestimmen Sie $r$ mit $0\\\\le r<{n}$ und \${a} = q\\\\cdot {n} + r$.", "params": [{"name": "a", "random": [20, 99]}, {"name": "n", "random": [3, 9]}], "let": [{"name": "r", "value": "mod(a, n)"}], "answers": ["{r}"]}
      np. {"form": "number", "prompt": "Samochód przejechał {s} m w {t} s. Jaka była jego średnia prędkość?", "params": [{"name": "s", "random": [20, 500], "step": 10}, {"name": "t", "random": [2, 60]}], "let": [{"name": "v", "value": "s / t"}], "answers": ["{v}"], "unit": "m/s", "quantity": "Velocity", "tolerance": 0.01, "relative": true}
      np. {"form": "one", "prompt": "Co było wcześniej?", "params": [{"name": "a", "entry": {"kind": "@hist/zdarzenie"}}, {"name": "b", "entry": {"kind": "@hist/zdarzenie", "where": "it.data != a.data"}}], "let": [{"name": "pierwsze", "value": "minby([a, b], it.data)"}, {"name": "drugie", "value": "maxby([a, b], it.data)"}], "options": ["{pierwsze.label}", "{drugie.label}"], "correct": [0]}
    JĘZYK WYRAŻEŃ w generatorach (let, require, where, {…}, „Oblicz”):
${generatorExprDescription().split('\n').map((line) => `      ${line}`).join('\n')}`;
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
  "reading" — tekst do czytania: jak uczący się widzi wpis tego rodzaju („Nowy temat” przed pierwszym pytaniem o ten wpis, wyjaśnienie po odpowiedzi) — zapis z polami w klamrach, jak "label",
    np. "{streszczenie}\\n\\n{opis}\\n\\n**Wydarzenia**\\n{wydarzenia}\\n\\n*{czas}*"; pierwszy akapit to zapowiedź (krótko; reszta po „Czytaj dalej”);
    pole "markup" zostaje zapisem (pogrubienia, przypisy [@dzielo, s. 12]), "text" — tekstem, "list" sama w linii — punktami (pod pogrubionym śródtytułem zwinięta, aż uczący się ją otworzy),
    "ref" — link z nazwą wpisu, "ref" z "locator" — przypis do źródła z miejscem (z „pokaż w tekście”), data, liczba, wybór — tekstem; pliki i miejsca na mapie się nie pokazują;
    część wzoru do pustej linii, w której wszystkie pola są puste, znika razem ze swoim śródtytułem;
    bez "reading": streszczenie (pole "streszczenie" albo "summary") albo pierwszy akapit tekstu, potem pola z tekstem, daty i miejsca; "reading": "" usuwa wzór
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
  "templates" — szablony kart dla tych rodzajów (opcjonalnie): {"ref", "name", "kinds": ["@rodzaj"], "direction", "graph", "tests", "asks"} ("tests" — co sprawdzają ich karty i jak mocno, "asks" — o jaki fakt pytają, jak w kursie).
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
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu) albo po trwałej nazwie; import UZUPEŁNIA je w miejscu: pola, których dokument nie wymienia, zostają, a "pole": null usuwa pole; pole-lista podana w dokumencie zastępuje całą dotychczasową listę. Przed zapisem każdą zmianę w tym, co już jest, trzeba przyjąć (i można ją poprawić).
  ZMIANA PO IDENTYFIKATORZE: {"ref": "<identyfikator>", "data": {"nazwa": "Nowa nazwa"}} — "kinds" można pominąć (wpis zachowuje swoje rodzaje); "id" działa tak samo jak "ref".
  USUWANIE: {"ref": "<identyfikator albo @trwała/nazwa>", "remove": true} — w "entities" (wpis) i w listach dokumentów ("flows", "views", "revisions", "templates", "collections", "forms", "anchors", "looks", "rules", "values", "rewards"); rodzajów import nie usuwa (Schematy → „Usuń rodzaj”).
    Podgląd wymienia każde usunięcie z nazwą i tym, co na nie wskazuje; każde można odznaczyć; nic nie znika po cichu.
    Odwołania do usuwanego wpisu w polach-odwołaniach innych wpisów (np. "wymaga", "pole", "about" pytania) i w zbiorach zostają z nich usunięte w tym samym zapisie — podgląd mówi, z których. Jeśli wskazuje na niego coś innego (krok albo "unit" przebiegu, widok, powtórka, szablon, wejście, komórka wypowiedzi), zapis nie przejdzie: popraw to w tym samym dokumencie, usuń to też albo odznacz usunięcie.
    Odpowiedzi i historia uczących się zostają: karty usuniętych wpisów po prostu się nie liczą (postępy, statystyki, krajobraz); wpis da się przywrócić z historii wersji, a wtedy jego odpowiedzi liczą się znowu.
    Ten sam wpis zmieniany i usuwany w jednym dokumencie — zostaje tylko usunięty (z ostrzeżeniem).
  Zapis jest JEDEN: nowe rodzaje (z trwałymi nazwami), zmiany rodzajów, nowe wpisy, zmiany wpisów, widoki i reszta oraz usunięcia — wszystko albo nic. Identyfikatory nowych rzeczy w podglądzie to te, które się zapiszą.
  Rozmiar: jeden plik do ok. 20 MB JSON (najwyżej 5000 elementów razem z usunięciami; jeden wpis do 4 MB) — plik 4 MB to jeden podgląd i jeden zapis (ok. 6 MB przesyłu).
  Zapis nie przejdzie, jeśli coś wskazywałoby na rodzaj albo wpis, którego nie ma (np. pole "to" z nieznanym rodzajem, wartość z nieistniejącym identyfikatorem, odwołanie do nowej rzeczy odznaczonej w przeglądzie) — lista mówi, który element i które pole.
  Rodzaj można wskazać jego trwałą nazwą ("kinds": ["@wywod/krok"]) — znajdzie się także po zmianie nazwy.
  Nazwa z „/" jest TRWAŁA: zostaje przy wpisie (także przy widoku, wejściu, szablonie, formularzu, rodzaju), a ten sam dokument zaimportowany drugi raz zmienia te same rzeczy zamiast tworzyć nowe; wielkość liter nie ma znaczenia.
    Kroki rekonstrukcji: "@<klucz dzieła>/<rekonstrukcja>/<krok>", np. "@kowalski2020/calosc/pytanie", "@kowalski2020/wstep/arg1" — każda rekonstrukcja jednego dzieła ma własny środkowy człon.
    Trwałe nazwy są wspólne dla całej bazy: dokument, który trafia w nazwy wpisów z innego dokumentu, zmieni je (podgląd to mówi) — inna rekonstrukcja potrzebuje innego członu (np. "calosc-2").
    Nazwy bez „/" działają tylko w swoim dokumencie. Rodzaje i wpisy mają wspólne nazwy, każdy rodzaj dokumentów (widoki, wejścia, szablony…) własne: wejście "@q" nie zmieni wpisu "@q".
    W polu-odwołaniu i w odwołaniu komórki ("ref") nazwa, która nigdzie nie prowadzi, wypada (z ostrzeżeniem, które podaje wpis i pole); w polu tekstowym "@autor/rok" jest tekstem i zostaje.
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

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}, "tests", "asks"}
  szablon może dotyczyć rodzaju z biblioteki ("quote", "work", "person") albo ze skryptorium ("text", "delivery", "project"), z których korzysta ta baza: wtedy karty powstają z ich wpisów, np. {"name": "Miejsce cytatu", "kinds": ["quote"], "direction": "locator", "graph": …}
  "tests" — co sprawdzają karty szablonu i jak mocno: [{"of": "this" (ten wpis) | "klucz pola-odwołania" (wpisy, na które wskazuje), "weight": 0–10}]; bez "tests": ten wpis z wagą 1.
    Znajomość należy do wpisu, a karta jest jego dowodem: dokładne pytanie waży więcej niż ogólne, jedna karta może liczyć się dla kilku wpisów;
    np. karta „Co się wtedy stało?” faktu: "tests": [{"of": "this", "weight": 1}, {"of": "okres", "weight": 0.3}, {"of": "gdzie", "weight": 0.3}]
  "asks" — o jaki FAKT pytają karty szablonu: [{"of": "this" | "klucz pola-odwołania", "facet": "nazwa faktu"}] albo krótko ["data"]; karty, które pytają o ten sam fakt tego samego wpisu, dzielą każdą odpowiedź
    — np. „Kiedy było X?” i „Co było w listopadzie 1829?” z "asks": ["data"]: dobra odpowiedź na jedną liczy się dla obu; w pętli „Dla każdej wartości” fakt jest osobny dla każdej wartości; bez "asks": karta liczy się tylko dla siebie;
    pary pytania „Połącz w pary” są faktami same z siebie: każda pokazana para liczy się dla karty swojej pary
  węzły liczące: "random" ({"min", "max", "step"} albo {"list": ["3", "5"]}, albo lista z wejścia "items"; "count": 4 — tyle RÓŻNYCH naraz) — losuje przy każdej karcie; "calc" („Oblicz”): {"expr": "p0 * p1; p0 + 1", "inputs": 2, "decimals": 2} — wyrażenia językiem rysunków (mod, round, fmt, sqrt …), jedno w wierszu albo po „;”, każde daje wartość (lista — kilka); p0…p7 — pierwsza liczba z wejścia, n0…n7 — ile wartości przyszło, l0…l7 — wszystkie wartości wejścia jako lista (wpisy jako rekordy: sum(l0, it.masa)); "aggregate" („Zbierz”): {"op": "sum"|"count"|"min"|"max"|"avg", "decimals"} — wejście "values" (np. "follow" → "field" liczbowe); wyjście "value" łączy się z "pattern", "answer.number" ("expected") i "answer.one" ("expected" albo "distractors", np. "p0 + 1; p0 - 1; p0 * 2")
  węzeł "generate" („Generator”) — TEN SAM generator co w pytaniach (GENERATOR wyżej): "config": {"params": […], "let": […], "require": […], "texts": [{"name": "pytanie", "value": "Jaki wzór ma {kation.label} z {anion.label}?"}]} — "this" w wyrażeniach to wpis tej karty (this.symbol); "only": "this.ladunek > 0" — kartę dostają tylko takie wpisy rodzaju (pozostałe bez ostrzeżenia);
    każda nazwa (parametr, wartość liczona, tekst) ma swoje wyjście o tej nazwie: liczby i teksty jako wartości, wpisy jako wpisy, lista jako kilka wartości — do "prompt" (przez "pattern" albo prosto tekst z "texts"), "answer.*" ("expected", "distractors", "items", "left", "right"), "card"
    gdy zadania nie da się wylosować (60 prób), dla tego wpisu nie powstaje karta — z powodem w podglądzie szablonu; karta zapisuje wylosowane wartości i numer losowania; historia karty zaczyna się od nowa tylko po zmianie grafu szablonu
  węzeł "card" przyjmuje też "hints" (podpowiedzi — teksty, od łagodnej do konkretnej) i "solution" (rozwiązanie — tekst z wartościami zadania, po odpowiedzi)

Znajomość — liczy ją aplikacja, tak samo wszędzie (nie ustawia się jej w JSON):
  każda odpowiedź zostaje zapisana; karta pamięta tylko kilka wartości: kiedy ostatnio odpowiedziano, ile czasu naprawdę minęło przed tą odpowiedzią, odstęp do następnego razu i najlepszy odstęp przed ostatnim błędem;
  dobrze (od 90%): odstęp = czas, który naprawdę minął × 3 (odpowiedź przed terminem go nie skraca); częściowo: jedna trzecia tego czasu, co najmniej dzień, jeśli minęły dni; źle (poniżej 25%): 5 minut; dobrze zaraz po błędzie: 0,4 × najlepszy odstęp sprzed błędu
    — np. źle po 5 dniach: wraca po 5 minutach; dobrze zaraz potem: za 2 dni; znów dobrze po 2 dniach: za 6 dni;
  znajomość karty: poprawność ostatniej odpowiedzi × √(10 ÷ (1 + 9 · czas od odpowiedzi ÷ odstęp)) — zaraz po dobrej 3,16, w dniu powtórki 1, potem spada coraz wolniej (10 % dopiero po 111 odstępach, nigdy 0); po złej 0;
  trzy pasma (stałe): „znane” od 1 (100 %) — jeszcze nie pora; „do powtórki” od 0,1 do 1 — umiesz, a teraz (albo zaraz) trzeba powtórzyć: termin powtórki NIE znaczy „nie umiem”; „nieznane” poniżej 0,1 — nigdy nie pytane, ostatnio źle albo zapomniane (111 odstępów po terminie);
  znajomość wpisu: średnia znajomości jego kart Z ODPOWIEDZIĄ, ważona "weight" z "tests" (karta jeszcze nie pytana nie jest dowodem); to, co na nim buduje (pola z "prerequisite" — połowa — i zależności z Ustawień, z ich wagą), podnosi ją co najmniej do tej części najlepszego z nich — nigdy do ich sumy

"revisions" — powtórki: {"name", "graph", "next"} (źródła → kroki → … → jeden „Sposób pytania")
  LEKCJA — zwykła powtórka z "endWhenDone": true, "pick": "next", "order": "general": w trakcie pasek „x z y kart”, na końcu podsumowanie (zrobione, dobrze za pierwszym razem, czas, karty ze złą odpowiedzią i „Ćwicz te jeszcze raz”);
    "next": "@kurs/lekcja-2" — trwała nazwa (albo identyfikator) powtórki, która idzie po tej: na końcu przycisk „Następna lekcja”
  także kroki wspólne z widokami: {"type": "follow", "config": {"field": "authors", "back": false}} — karty wpisów, do których prowadzi odwołanie (albo, "back": true, które wskazują na te wpisy); {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field", "cmp", "value"}]}}} — karty wpisów spełniających regułę; {"type": "structure", "config": {"dir": "down|up", "one": true}} — karty wpisów, które leżą w strukturze pod tymi wpisami (albo nad nimi); "follow" i "structure" z "keep": true zostawiają też karty, od których wyszły
  źródło „rodzaj z biblioteki": {"type": "source.kind", "config": {"kind": "quote", "from": "<identyfikator biblioteki>"}} — "from" puste: z tej bazy i ze wszystkich źródeł
  źródło „widok”: {"type": "source.view", "config": {"view": "@widok"}} — karty wpisów, które pokazuje zapisany widok: widok decyduje, co wchodzi w grę, powtórka z tego wybiera; zmiana widoku zmienia powtórkę, a jego „Filtry znajomości” na końcu działają w trakcie powtórki
    np. {"name": "Od ogólnego do szczegółu", "graph": {"nodes": [{"id": "w", "type": "source.view", "config": {"view": "@fakty/w-ogolne"}}, {"id": "p", "type": "strategy", "config": {"mode": "temporal", "order": "general"}}], "edges": [{"id": "e1", "from": "w", "out": "cards", "to": "p", "in": "cards"}]}}
  „Filtr znajomości”: {"type": "filter.when", "config": {"when": warunek}} — zostają karty, dla których warunek jest spełniony, sprawdzany W TRAKCIE powtórki przy każdej karcie: co czekało, wchodzi, gdy warunek zacznie obowiązywać; karta już w stosie zostaje
    warunek to ta sama logika co w przebiegach: {"type": "knowness", "rel": "before", "band": "learned"} — to, co trzeba znać wcześniej, jest poznane;
    "band" — pasmo zamiast liczby: "learned" (poznane: do powtórki albo znane — termin powtórki nie zamyka tego, co dalej) | "known" (znane, od 100 %) | "due" (do powtórki) | "unknown" (nieznane); albo liczba: "op": "ge", "than": 0.5 (dawne "rel": "before" / "up" z "than": 1 czyta się jako "learned");
    "rel": "self" (ten wpis) | "cards" (jego karty; w powtórce: ta karta) | "before" (to, co trzeba znać wcześniej — najbliższe wpisy z kartami w kolejności nauki) | "up" (to, pod czym leży w strukturze) | "chain" (już pytane karty CAŁEJ drogi przed nim — przez wszystkie stopnie, także przez wpisy bez pytań i koła; nigdy niepytane się nie liczą) | klucz pola-odwołania (to, na co wskazuje, np. "okres");
    blokada krajobrazu jako warunek do każdego widoku i powtórki: {"type": "knowness", "rel": "chain", "band": "known"} — każda już pytana karta całej drogi przed wpisem jest znana (nic w niej nie blednie, nic nie było ostatnio źle);
    "each": "all" (domyślnie — każdy) | "any" (choć jeden); gdy nic takiego nie ma, "all" jest spełnione; "of": "@wpis" zamiast "rel" — znajomość jednego wpisu; warunki łączą "and" / "or" / "not": {"type": "and", "items": [ … ]}
  „Idź po kolejności nauki”: {"type": "learning", "config": {"dir": "before" | "after", "one": true, "keep": true}} — karty tego, co trzeba znać wcześniej (albo, "after", co na tym buduje), aż do podstaw albo ("one") o krok; "keep": true dokłada je do kart wyjściowych
  „Sposób pytania” ("strategy"): {"mode": "temporal" (według tego, co umiem) | "levels" | "once" | "random", "order", "pick", "stackSize", "count", "levels", "minCorrectness", "endWhenDone", "rule"}
    "temporal": stos "stackSize" kart; karta wychodzi ze stosu dopiero po całkiem dobrej odpowiedzi ("minCorrectness", domyślnie 1); wolne miejsce bierze najpierw to, co do powtórki (najsłabsze najpierw), potem nieznane (nowe, ostatnio złe, zapomniane — w "order"), a gdy obu nie ma — znane, które zna się najsłabiej („na zapas”: powtórka sama się nie kończy); "endWhenDone": true — koniec, gdy nic nie czeka i nie ma nic nowego
    "order" — kolejność: "general" (najpierw ogólne — według poziomów kolejności nauki) | "text" (jak w tekście źródła — miejsce w dziele) | "date" (według najwcześniejszej daty wpisu) | "random" | "given" (jak przychodzą) | "due" (najpierw zaległe); bez "order": w stosie "general", w stałej kolejce "random"
    "pick" — wybór ze stosu: "next" (ściśle następna według kolejności) | "weighted" (losowo, częściej to, co słabiej znane i dłużej czeka; domyślnie); przy każdej karcie uczący się widzi, dlaczego przyszła
  „Najpierw podstawy” to zwykłe kroki: {"type": "learning", "config": {"dir": "before", "keep": true}} → {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "before", "band": "learned"}}} → „Sposób pytania” z "order": "general"; dawny krok "gate" import i eksport zamieniają na nie
"flows" — przebiegi (opowieści, kursy krok po kroku): {"ref", "name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "goals", "lines", "narrators", "slots", "template", "fill", "overrides", "presentation", "unit", "review"}
  "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in": "in"}]} — kroki i przejścia ("out" — wyjście kroku); "start": id pierwszego kroku (pominięte — jedyny krok, do którego nic nie prowadzi);
  ŚCIEŻKA MUSI BYĆ LOGICZNA: dokładnie jeden początek i jeden koniec (krok "end", "return" albo "handoff"), każdy krok osiągalny z początku, z każdego kroku da się dojść do końca, każde wyjście ("right" I "wrong" pytania, każda możliwość wyboru) prowadzi do kroku; podgląd importu wymienia z nazwy każdy krok, który to łamie (drugi początek, krok nieosiągalny, ślepy zaułek, pętla bez wyjścia), a przebieg bez początku albo bez końca się nie zapisze;
  kroki ("type") i ich wyjścia:
    "show" {"of": "@wpis", "title", "media"} → "next" — pokazuje wpis (wypowiedź z „Treść w blokach” w całości, inne wpisy z polami);
    "question" {"of": "@pytanie"} → "right" | "wrong" — pytanie z bazy; odpowiedź leży na JEGO karcie: liczy się dla tego, o czym jest ("about"), i wspólnie z powtórkami; ODTWARZACZ PYTA TYLKO O TO, CZEGO UCZĄCY SIĘ NIE UMIE: pytanie, którego karta jest już znana (od 100 %, z całej historii — opowieści, powtórki, ćwiczenia), pomija po cichu wyjściem "right" — bez odpowiedzi i bez zmiany planu karty; slajdy pokazuje zawsze; nie dopisuj do tego warunków — dotyczy każdej bazy i każdego przebiegu (przegląd z samymi znanymi pytaniami od razu się kończy, opowieść da się wtedy przeczytać); po złej odpowiedzi to samo pytanie nie wraca od razu — najpierw jedno znane („przerywnik”, nie liczy się i nic nie zmienia, chyba że odpowiedź jest zła);
    "choice" {"title", "options": [{"label", "condition", "actions"}]} → "o0", "o1", … — wybór („Którędy dalej?”): opowieść zatrzymuje się i pokazuje WSZYSTKIE możliwości z nazwy i z tym, co czeka za każdą („3 slajdy do przeczytania · 5 pytań do odpowiedzi”); możliwość, której "condition" nie jest spełniony, stoi zamknięta i mówi, co ją otworzy (z warunkiem "not" — dlaczego jest zamknięta); aplikacja nigdy nie wybiera sama; drogi mogą wracać do wyboru (wtedy zostają otwarte na później);
    "chapters" {"title", "chapters": [{"title"}]} → "c0", "c1", … i "done" — ROZWIDLENIE, KTÓRE SIĘ SCHODZI: pokazuje wszystkie drogi z tym, co czeka za każdą; przerobione (w tej opowieści albo takie, których każdy krok uczący się już umie) stoją jako „ukończone”, „Ukończono 2 z 3 ścieżek”, a gdy wszystkie są za nim — idzie wyjściem "done"; "chapterEnd" — koniec drogi (wraca do wyboru); "restart" — ta droga od nowa;
    "condition" {"condition": warunek} → "yes" | "no" — bez ekranu, np. „pomiń, gdy umie”: {"type": "knowness", "of": "@temat", "band": "known"}; na ścieżce NIGDY nie jest wyborem uczącego się: rysuje się tylko gałąź, która go teraz dotyczy, a gdy tego jeszcze nie wiadomo — obie razem jako jedna część ze znakiem „automatycznie”; droga, która wraca do wyboru, ma na ścieżce krótką strzałkę z powrotem; ścieżka ma jeden „Koniec” na górze, a nad nim to, co w kolejności nauki przychodzi po tej opowieści (bez ręcznych odnośników); "set" {"actions": [{"type": "set"|"add", "value", "to"|"by"}]} → "next";
    "expand" {"of", "threshold"} → "next" (wyjaśnia, gdy jeszcze nie umie); "opening" {"mode": "discovery"|"recall"}; "line" {"character", "of", "mood"}; "subflow" {"flow"}; "each" {"collection"|"kind", "flow"}; "handoff" {"flow"}; "detour" {"flow": "@inna-opowiesc", "label": "Chcesz wiedzieć więcej: …", "optional": true} → "done" | "skip"; "end"; "return"
    ZAGŁĘBIENIE ("detour") — opowieści układaj jak drabinę: jedna ogólna, pod nią krótkie przeglądy etapów, pod nimi głębsze opowieści; PRZEGLĄD ZOSTAW KRÓTKI, głębszą treść daj do WŁASNEJ opowieści (własny przebieg, zwykle z własnym "unit") i połącz ją krokiem "detour" z "optional": true w miejscu, w którym pasuje; odtwarzacz pokazuje kartę: nazwę tamtej opowieści, co w niej czeka („7 slajdów · 16 pytań”), „Wejdź” i „Dalej bez tego” (gdy już ukończona: „już znasz”, „Przypomnij” i „Dalej”); „Wejdź” gra ją w środku (tytuł, ścieżka i liczniki są wtedy jej, nad nią pasek „Etap 1 › Dom w Becchi” z „Wróć do: Etap 1” — powrót na krok zagłębienia bez ukończenia), jej koniec wraca wyjściem "done", „Dalej bez tego” idzie wyjściem "skip" (zwykle oba do tego samego następnego kroku); postęp należy do opowieści: tamta jest ukończona raz, gdziekolwiek ją skończono, a jej pytania liczą się jak zawsze; pominięte zagłębienie niczego nie blokuje, na ścieżce liczy się jako przerobione (cienki obrys), a w „Co dalej” po końcu opowieści stoi jako pierwsze; przegląd opowieści obejmuje tylko jej własne pytania; "optional": false (rzadko) — tylko „Wejdź”, a koniec opowieści go wymaga (wtedy bez wyjścia "skip"); najwyżej 3 zagłębienia jedno w drugim; KOŁO (A → B → A) import odrzuca z nazwami obu; głębsza opowieść, której "unit" wymaga (pole z "prerequisite": "up") jednostki przeglądu, otwarta wprost przed ukończeniem przeglądu mówi „Najpierw: Etap 1” — z przeglądu wchodzi się zawsze; przykład: {"id": "z1", "type": "detour", "config": {"flow": "@bosko/becchi", "label": "Chcesz wiedzieć więcej: Dom w Becchi bez ojca", "optional": true}}, krawędzie {"from": "z1", "out": "done", "to": "s5"} i {"from": "z1", "out": "skip", "to": "s5"}
    krok "scene" {"page": "adres/strony", "scene": "klucz sceny", "title"} — scena prezentacji; wyjścia "next", przy pytaniu na scenie "right" / "wrong", przyciski "b0", "b1", …
  "goals": [{"id", "title", "condition"}] — cele (przebieg z celami to zadanie); osiągnięte zapisują się przy miejscu uczącego się i zostają osiągnięte; przebieg z celami opuszcza swoją jednostkę do doliny dopiero, gdy jest ukończony I każdy cel osiągnięty (bez celów: gdy ukończony);
  PRZEGLĄD NA KOŃCU OPOWIEŚCI (w tym samym przebiegu, te same pytania co w opowieści — ta sama historia kart, nigdy kopie): licznik z nazwą opowieści na początku ("deszcz.przeglad" — wartości należą do uczącego się, nie do jednej opowieści); krok "set" zeruje go na początku przeglądu, a "review": "<id tego kroku>" mówi, dokąd prowadzi „Powtórz przegląd” (bez "review": na początek); każde pytanie "right" → krok "set" {"actions": [{"type": "add", "value": "deszcz.przeglad", "by": 1}]} → następne pytanie, "wrong" → od razu następne pytanie; na końcu "condition" {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3} — "yes" → koniec, "no" → wraca na początek przeglądu (albo do wyboru „Spróbuj jeszcze raz” / „Zakończ na razie”: zakończona bez zdanego przeglądu opowieść zostaje na równinie jako „przegląd jeszcze niezdany”); cel z TYM SAMYM warunkiem: "goals": [{"id": "przeglad", "title": "Przegląd zdany", "condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}]
    {"ref": "@kurs/deszcz", "name": "Skąd się bierze deszcz", "look": "dialogue", "unit": "@kurs/lekcja/deszcz", "review": "p0", "goals": [{"id": "przeglad", "title": "Przegląd zdany", "condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}],
     "graph": {"nodes": [{"id": "p0", "type": "set", "config": {"actions": [{"type": "set", "value": "deszcz.przeglad", "to": 0}]}}, {"id": "p1", "type": "question", "config": {"of": "@kurs/q/parowanie"}}, {"id": "p1ok", "type": "set", "config": {"actions": [{"type": "add", "value": "deszcz.przeglad", "by": 1}]}}, …, {"id": "pz", "type": "condition", "config": {"condition": {"type": "value", "value": "deszcz.przeglad", "op": "ge", "than": 3}}}, {"id": "koniec", "type": "end"}],
      "edges": [{"from": "p0", "out": "next", "to": "p1"}, {"from": "p1", "out": "right", "to": "p1ok"}, {"from": "p1", "out": "wrong", "to": "p2"}, {"from": "p1ok", "out": "next", "to": "p2"}, …, {"from": "pz", "out": "yes", "to": "koniec"}, {"from": "pz", "out": "no", "to": "p0"}]}}
  PYTANIA O TEMATACH, NIGDY O JEDNOSTCE: "about" pytań opowieści wymienia tematy; jednostka ("unit") nie ma własnych kart — inaczej opadłaby po kilku dobrych odpowiedziach bez opowieści, a jej przycisk ćwiczyłby karty zamiast grać opowieść;
  "narrators" — kto opowiada, według wartości: [{"character": "@piotr", "condition": {"type": "value", "value": "przewodnik", "op": "eq", "than": 1}}, {"character": "@maria"}] — opowiada pierwszy, którego warunek jest spełniony (bez warunku: zawsze); jego portret i imię stoją nad krokiem i zapowiadają jego tytuł
  "unit": "@wpis" — JEDNOSTKA, którą jest ta opowieść: w krajobrazie jedno pole (także gdy sama nie ma kart), „Pokaż ścieżkę” pokazuje ścieżkę opowieści, a gdy opowieść dobiegnie końca (z celami: i przegląd jest zdany), pole opada do doliny; pole-odwołanie jednostki z "prerequisite": "up" (np. „Wymaga” → tematy) zamyka opowieść, dopóki tego nie umiesz — w krajobrazie stoi jako góra z drogą do niej
  przycisk opowieści (pole w krajobrazie, węzeł w Nauce → Ścieżka i w module "path"): „Zacznij opowieść” (nowa), „Kontynuuj opowieść” (w drodze — od miejsca, w którym skończył), „Powtórz przegląd” (ukończona, cel nieosiągnięty — od "review"), „Otwórz opowieść” (zdana); nigdy nie ćwiczy kart jednostki
  ekran zamknięcia (odtwarzacz przed opowieścią, ta sama logika co krajobraz): brakuje czegoś przed jednostką — lista od podstaw z odnośnikami i „Ucz się” przy każdym, do tego „Ustaw jako cel” (cel w krajobrazie); wszystko poznane, ale w łańcuchu są słabe karty — „Najpierw powtórz (N)” z dokładnie tymi kartami, potem od razu opowieść; kto pisze w bazie, ma „Podgląd mimo to”
  przebieg z prezentacji (JEDNA opowieść = strona-prezentacja + ten przebieg, bez kopii): {"name": "Droga", "look": "scenes", "presentation": "parafia/droga", "unit": "@lekcja", "narrators": […]} — bez własnego "graph": jego mapą jest storyboard strony (sceny, przyciski, pytania, bramki, wartości — "story" w JSON strony, z "base": id tej bazy); w Nauce gra tę prezentację, a odpowiedzi, wartości i miejsce, w którym ktoś skończył, liczą się w tej bazie (to samo miejsce co na stronie); zobaczy ją tylko ten, kto może zobaczyć stronę; pytanie na scenie z "question": "@pytanie" liczy się jak tu krok "question", a "about" sceny mówi, czego scena dotyczy (dla ścieżki); przegląd na stronie: wartość w "story.values", bramki "set" (zero, +1 przy "right") i bramka "condition" z wynikiem, "review": "<klucz sceny początku przeglądu>", "goals" przebiegu jak wyżej (liczą się z wartości strony); strona otwiera się na scenie z adresu "?scena=<klucz>"
  miejsce uczącego się (prywatne, jak postępy; nigdy w eksporcie ani w MCP): krok, odwiedzone, przerobione drogi rozdziałów, „ukończony” (osiągnięty koniec — zostaje także po „od początku”), osiągnięte cele — warunek {"type": "flow", "flow": "@przebieg", "state": "done" | "started" | "goal", "goal": "id celu"} czyta je w widokach ("filter.when"), powtórkach i krokach widoku krajobrazu (np. tematy dopiero po ukończonej opowieści)
  ścieżka obok opowieści (2026-11-04): mapa CZĘŚCI przebiegu, liczona z samego grafu — początek i koniec jako własne znaki; „slajdy do przeczytania” (kolejne kroki "show"/"line"/"expand"/"opening"/scena bez pytań), „pytania do odpowiedzi” (kolejne "question"/scena z pytaniami; krok z jednym i drugim — oba liczniki), „przegląd” (pętla wracająca do pytań, aż wszystkie umiesz, i krok z "review"; pojedynczy slajd tuż przed nią należy do niej), „wybór drogi” ("choice", "chapters" i scena z kilkoma przyciskami — rysowany jako rozwidlenie z licznikiem „wybierz 1 z 3” / „wybrano 1 z 3” / „ukończono 2 z 3 ścieżek”); kroki "condition"/"set" są przezroczyste; zawsze od dołu (początek) do góry (koniec), cała w ramce (zmniejszona; „+”, „−”, „Dopasuj”, „Pełny ekran”), obecna część większa, obrysowana i z nazwą obok, inne nazwy po wskazaniu (pierwsze dotknięcie — okienko, drugie — otwiera), legenda zawsze pod mapą; „X z Y” liczy dokładnie narysowane sześciokąty; część jest ukończona, gdy ją przeszedł (pytania: i nauczył się, przegląd: i wszystko umie); dawny opis: mała mapa ścieżki idzie za krokiem; wskazana możliwość wyboru podświetla swoją drogę; klik w wolny krok przenosi opowieść do niego; na stronie stoi też osobno jako moduł "path" ({"library", "flow": "<id przebiegu>"} — także dla przebiegu z prezentacji)
  "recreatio.cogita.flow" — JEDEN przebieg razem z tym, co pokazuje (eksport z edytora przebiegów): {"format": "recreatio.cogita.flow", "version": 1, "flow": {przebieg jak wyżej}, "entities": [wpisy, które pokazuje — także postacie i jednostka "unit"]} — importuje się w tym samym miejscu co kurs; wpisy z "ref" łączą się z istniejącymi
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"views" — widoki (te same kroki co powtórka, po wpisach): {"name", "mode": "table|tree|matrix|map|canvas|outline|quilt|landscape", "steps": [krok, …], "query", "group", "matrix", "columns": ["klucz pola" | "#axis:@oś"], "sort": {"key", "dir": 1|-1}, "landscape": {"nest": "pole"}}
  na początku źródła — kilka pod rząd sumuje się (np. kazania i komentarze): "source.all" | "source.kind" {"kind": "@rodzaj" albo "text" ze skryptorium, "from"} | "source.collection" {"collection": "@zbiór"} | "source.list" {"ids": ["@wpis"]};
  także "source.from" {"entry": "@kazanie"} — to, na co wskazuje wpis (kazanie: jego cytaty, wypowiedzi, słowa ze słownika, miejsca z planu; w powtórce: „Z wpisu" — powtórka z kazania);
  potem "follow" {"field", "back"}, "structure" {"dir": "down|up", "one": true} (po polach struktury — bez "one": do samego końca; "one": true — jeden poziom) i "filter.rule" {"rule"} (źródło po innym kroku zaczyna od nowa);
  także "filter.when" {"when": warunek} i "learning" {"dir", "one", "keep"} — te same co w powtórce; w widoku liczy się znajomość tego, kto patrzy (uczącego się na tym koncie; na stronie — osoby strony albo tej przeglądarki),
    np. fakty okresu dopiero, gdy okres jest znany: {"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "okres", "op": "ge", "than": 1}}}; tylko wpisy, których podstawy są znane: "rel": "before";
  kolumny i "sort" ze znajomości: "#knowness" (znajomość wpisu), "#due" (kiedy powtórzyć), "#level" (poziom w kolejności nauki), np. "sort": {"key": "#knowness", "dir": 1} — najpierw najsłabsze;
  "mode": "quilt" (Mapa postępów) — kafelek na wpis w kolorze tego, jak dobrze uczący się go zna (nowe, uczę się, do powtórki, umiem), pogrupowany jak "group" (np. idee według lekcji pod rozdziałami: {"by": "axis", "kind": "@lekcja", "via": ["lekcja"], "sort": {"field": "nr"}, "group": "rozdzial"}); klik: tekst, pytania, „Ćwicz to”, „Otwórz w źródle”; widać go w Nauka → Postępy (też nauczycielowi) i w module „Widok”
  "mode": "landscape" (Krajobraz) — osobisty krajobraz wiedzy tego, kto patrzy: ŚWIAT OBSZARÓW W OBSZARACH. Obszary tworzą się same z połączeń „Najpierw trzeba znać” — grupy po ok. 5–12 tematów, które dużo od siebie zależą, a mało od reszty, poziom po poziomie, aż na górze jest ok. 7–20 obszarów; między obszarami nie ma pętli (każdy ma swoje „przed” i „po”); NIE z rozdziałów ani przedmiotów ("group" widoku i rozdziały to tylko kolor); te same dla każdego uczącego się, liczone od nowa tylko po zmianie bazy (te same nazwy i miejsca); na każdym poziomie kilka do kilkunastu pól: albo obszary, albo tematy — nigdy razem, nigdy pojedyncze pytania (pytania należą do swojego tematu); dotknięcie obszaru otwiera jego mapę, okruszki i „−” wracają wyżej, bramy na brzegu (sąsiednie obszary z nazwą, po stronie, w którą biegnie połączenie) prowadzą dalej; nazwa obszaru: z bazy, gdy pasuje (rozdział, sekcja „§4 …”), inaczej „Wokół: <temat, od którego zależy w nim najwięcej>”; właściciel zmienia nazwę na mapie („Zmień nazwę”) i przenosi temat do innego obszaru (w okienku tematu) — zostaje po przeliczeniu; miejsca tylko ze struktury: każda mapa to wachlarz przed uczącym się (początek tuż przy nim), każde pole zaczyna się tuż obok tego, na czym się opiera, nigdy bliżej środka niż jego warunki — łańcuch wije się wokół początku (wąż), zamiast biec prostą schodami, mapa jest zwarta i okrągła, między obszarami najwyżej jeden rząd ziemi; gałęzie dostają swoje kierunki (jak doliny do różnych gór), droga do celu idzie od sąsiada do sąsiada;
    WYSOKOŚĆ = STOPNIE: najdłuższy łańcuch tematów, których jeszcze brakuje, ten temat też — dolina 0 (umiem, także to, co do powtórki), jeden stopień — można zacząć teraz, każdy dalszy stopień wyżej; OBSZAR NIE JEST KOLUMNĄ: to obrysowana, lekko uniesiona powierzchnia w jego kolorze, na której jego tematy stoją jako własne małe kolumny (własna wysokość, własny kolor — jak poziom niżej); za duży — jego podobszary tak samo (każdy z obrysem i reliefem) albo mały szkic (najniższe, najwyższe i to, czego można się uczyć teraz); na mapie obszarów relief jest bardziej płaski (najwyższa kolumna ok. jednej trzeciej głębokości mapy, wysokości dalej w proporcji); JEDEN stopień na cały widok: największy, przy którym każde pole widać co najmniej w połowie (gdy trzeba — widok bardziej z góry, potem skrócone kolumny przed zakrytym polem, z widoczną krawędzią cięcia; nigdy mniej niż 6 px na stopień), bez perspektywy (wieża z tyłu tak wysoka jak z przodu), po obrocie o 60° od nowa — dolina zostaje doliną; TEMATY: ile tematów trzeba jeszcze poznać, ten też — tyle kroków ma lista „krok po kroku”; okienko mówi „6 stopni · 10 tematów”, nad listą „10 tematów do celu”, liczba przy celu na mapie to tematy (legenda to mówi);
    "landscape": {"nest": "<pole odwołania>", "nestSort": "nr", "regions": {"names": {"<klucz obszaru>": {"name": "Restklassen", "topics": ["@temat", …]}}, "moves": {"@temat": "<klucz obszaru>"}}} — "regions" zapisuje aplikacja: nazwy właściciela razem z tematami obszaru (po przeliczeniu nazwa znajduje swój obszar po wspólnych tematach) i tematy przeniesione do innego obszaru; "budget" i "bands" ze starszych baz są czytane i nie mają wpływu;
    "nest": KRAJOBRAZ ZAGNIEŻDŻONY — grupy pochodzą z danych, nie z obliczeń: węzeł mapy to zwykły wpis własnego rodzaju (np. „Pole mapy”: "nazwa", "nr" — kolejność, pole odwołania do rodzaju węzłów z "structure": "up" — węzeł nadrzędny; puste: węzeł najwyższy; gałęzie mogą mieć różną głębokość), a wpis treści wskazuje swój węzeł polem odwołania o kluczu z "nest" (bez węzła stoi na najwyższym poziomie); "nestSort" — liczbowe pole kolejności węzłów (domyślnie "nr"); całość pokazuje TYLKO najwyższy poziom, każde przybliżenie dokładnie jeden poziom (węzły niżej ALBO wpisy węzła — wpisy węzła, który ma też węzły niżej, stoją we własnym obszarze „Pozostałe w: …”, żeby żadna mapa nie mieszała obszarów z tematami), okruszki prowadzą z powrotem; węzeł jest prawdziwym polem: pierścień = znane / wszystkie karty całego poddrzewa, kolor z tej znajomości (im więcej umie, tym głębszy), wysokość = odległość do najbliższego wpisu w środku, którego można się uczyć (0, gdy coś w środku jest gotowe), zapada się w dolinę, gdy wszystko w środku jest opanowane (z oznaczeniem powtórki, gdy coś jest do powtórzenia), zamek, gdy wszystko, co w środku czeka na naukę, wymaga najpierw powtórki; okienko węzła: nazwa, pierścień, stan słowami, JEDEN główny przycisk („Wejdź”, „Powtórz” — karty do powtórki w poddrzewie, „Ustaw jako cel” — najbliższy wpis w środku; przy węźle-jednostce opowieści — przycisk opowieści) i lista tego, co w środku; miejsca są stałe: pola poziomu ciasno w pierścieniach wokół uczącego się, bliżej to, czego trzeba się nauczyć wcześniej (najwcześniejszy wpis w środku), potem węzły przed wpisami i kolejność autora — nigdy według postępów; jednostka opowieści może być węzłem albo wpisem treści;
    język mapy: barwa = rozdział, nasycenie = znajomość (głębokie — umiem, najjaśniejsze — nowe), wysokość = stopnie; dalekie (więcej stopni) bledną jak góry we mgle, to, czego można się uczyć teraz, ma jasny brzeg (bez znaku); najwyżej JEDEN mały znak na polu — jasny krążek z cienką ciemną linią, leżący na polu, tylko gdy pole jest dość duże (wybrane i następny krok zawsze): „najpierw powtórka, potem dalej” przed „do powtórki”; brzeg obszaru biegnie po wierzchu jego skrajnych kolumn, jasna część brzegu — tyle z niego umiesz; nazwa w całości na tabliczce obok (dwa wiersze, nigdy obcięta), zdobyty (umiesz wszystko) — ciepły kolor i flagę („Obszar zdobyty: …”, „3 z 12 obszarów zdobytych”); nazwy na polach dopiero po przybliżeniu; legenda zwinięta w „Legenda”, tylko to, co jest na mapie; mapę się przesuwa, przybliża kółkiem, dwoma palcami i „+”/„−”, obraca o 60°; „Do mnie” — do następnego kroku, „Cała mapa” — najwyższy poziom; otwiera się tam, gdzie leży następny krok, a nad mapą jedno zdanie „Dalej: X (gotowe) · 10 kart do powtórki” z dwoma przyciskami;
    klik: obszar (wszystko, co zawiera więcej niż jedno) — płynnie przybliża do jego mapy, bez okienka (z boku: nazwa, tematy, zdobyte, „Dalej tutaj” — KAŻDY temat, którego można się uczyć teraz, czego wymaga wcześniej, co otwiera dalej, „Powtórz” zaległe w nim); dwuklik tak samo; okruszki, „Wyżej”, Escape i zsunięcie palców — poziom wyżej; po najechaniu podpowiedź, co zrobi klik („przybliż” / „wybierz”); temat — wybiera go i od razu pokazuje drogę na mapie, drugi klik zaczyna (gdy można); okienko: stan, „N stopni · M tematów”, jeden główny przycisk („Zacznij”, „Powtórz”, „Ustaw jako cel”, przy temacie z opowieścią — przycisk opowieści), „Pokaż drogę” (linia na mapie w kolejności listy — długa: następne 5 i cel, reszta jako obrys i „+N kolejnych”; obok ścieżka z tymi samymi tematami od dołu, tematami po nazwie, i tym, co otwiera), „Pytania w tym temacie” (osobno, nie na drodze), „Co dalej”, „Otwórz wpis”; cel zapisuje się prywatnie jak postępy; temat na równinie ze słabymi kartami w drodze przed nim mówi „najpierw powtórz te N kart”; poziom, wybrane pole i kamera zostają (adres, ta przeglądarka);
    np. {"ref": "@swiat/w-krajobraz", "name": "Krajobraz wiedzy", "mode": "landscape", "steps": [{"type": "source.kind", "config": {"kind": "@swiat/temat"}}], "group": {"by": "axis", "kind": "@swiat/tag", "via": ["tagi"]}}; zagnieżdżony: rodzaj węzłów {"ref": "@swiat/pole", "name": "Pole mapy", "label": "{nazwa}", "fields": [{"key": "nazwa", "type": "line"}, {"key": "nr", "type": "number"}, {"key": "nad", "type": "ref", "to": ["@swiat/pole"], "structure": "up"}]}, węzły {"ref": "@swiat/m-ruch", "kinds": ["@swiat/pole"], "data": {"nazwa": "Ruch", "nr": 1, "nad": "@swiat/m-fizyka"}}, temat z polem {"key": "pole", "type": "ref", "to": ["@swiat/pole"]} → "data": {"pole": "@swiat/m-ruch"}, widok {"ref": "@swiat/w-pola", "name": "Krajobraz pól", "mode": "landscape", "steps": [{"type": "source.kind", "config": {"kind": "@swiat/temat"}}], "landscape": {"nest": "pole"}}
  "mode": "outline" (Struktura) rysuje źródła jako korzenie, a pod nimi to, do czego prowadzą kroki; "outline": {"chip": "klucz pola nad każdym krokiem (np. rola)", "order": "tree|text" (bez "order": ostatni wybór czytelnika, a na początek kolejność tekstu u Tomasza i drzewo w innych dziełach), "by": "klucz pola, według którego najpierw układają się kroki jednego poziomu (np. czas — czas opowieści; bez \"by\": według miejsca w dziele)", "tie": "klucz pola przy tym samym miejscu (np. nr)"};
    widok otwarty od wpisu (wejście z Biblioteki) zastępuje tym wpisem wszystko przed pierwszym „Idź po…”; np. {"name": "Wywód", "mode": "outline", "steps": [{"type": "source.kind", "config": {"kind": "@krok"}}, {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field": "nalezy", "cmp": "empty"}]}}}, {"type": "structure", "config": {"dir": "down"}}], "outline": {"chip": "rola", "order": "tree", "tie": "nr"}}
  grupowanie (drzewo "group", wiersze i kolumny "matrix": {"rows": grupowanie, "cols": grupowanie}): {"by": "kind"} | {"by": "field", "field": "klucz"} | {"by": "axis", "kind": "@rodzaj", "via", "through", "depth", "sort", "group"} — OŚ: jej wartości to wpisy rodzaju
    "via": ["pole"] — przez które pola-odwołania wpis należy do wartości (puste: przez dowolne); "through": "pole" albo "*" — także o jeden krok dalej (wpis → przez to pole → inny wpis → przez "via" → wartość); "depth": "all" albo liczba — "through" przez wszystkie (albo n) poziomy: na każdej drodze w górę wartość najbliższego wpisu, który ją ma, a wpis z własną wartością ma tylko ją (np. {"by": "axis", "kind": "@obszar", "via": ["obszar"], "through": "wymaga", "depth": "all", "sort": {"field": "nr"}}; w krajobrazie pole struktury w górę działa tak samo bez "depth")
    "sort": {"field": "numer"} — kolejność według pola liczbowego wartości, albo {"list": "@rozaniec", "field": "tajemnice"} — według kolejności w polu-odwołaniu innego wpisu; bez "sort" — według nazwy
    "group": "czesc" — nagłówki: pole-odwołanie wartości (np. część tajemnic); w macierzy nad kolumnami i między wierszami
  kolumna "#axis:@rodzaj" — wartości tej osi (wpisy rodzaju), na które wskazuje wpis
  np. {"name": "Postacie według okresu", "mode": "tree", "steps": [{"type": "source.kind", "config": {"kind": "@postac"}}], "group": {"by": "axis", "kind": "@okres", "via": ["okres"], "sort": {"field": "od"}}}
  np. macierz 20 × 12 — Tajemnica × Obszar: {"name": "Tajemnica × Obszar", "mode": "matrix", "steps": [{"type": "source.kind", "config": {"kind": "text"}}, {"type": "source.kind", "config": {"kind": "@komentarz"}}], "matrix": {"rows": {"by": "axis", "kind": "@tajemnica", "sort": {"field": "numer"}, "group": "czesc"}, "cols": {"by": "axis", "kind": "@obszar", "group": "grupa"}}}
    — 20 tajemnic różańca (w czterech częściach) × 12 maryjnych obszarów (w grupach); w polu: kazania ze skryptorium (rodzaj tekstu „Kazanie maryjne” z polami "tajemnica" i "obszar") i komentarze, których "about" wskazuje tajemnicę i obszar; puste pola też są widoczne
  na stronie: moduł "view" {"library": "<id bazy>", "view": "<id widoku>", "mode": "tabela|drzewo|macierz|mapa|postepy|krajobraz", "answers": "<id obszaru kursu>", "rewards": "<id nagród>"} — pole macierzy (klik) i wpis otwierają się pod spodem, droga w adresie osobno dla każdego modułu; w krajobrazie uczy się osoba strony: "answers" i "rewards" jak w module „Powtórka”, nauka liczy się dla modułów „Punkty i seria” i „Statystyki na żywo” tej strony
${REWARDS_SECTION}
"anchors" —wejścia z Biblioteki: {"ref", "name", "work": "@klucz dzieła albo identyfikator", "locator": "s. 45–60" | "s. 1–3; 27–30" | "I q. 2 a. 3; a. 4" | "" (całe dzieło), "entry": "@wpis tej bazy (nie dzieło)", "view": "@widok albo jego nazwa", "note"}
  przy dziele w Bibliotece pojawia się przycisk z nazwą wejścia — tylko dla tych, którzy mogą czytać tę bazę (Biblioteka niczego nie zapisuje); kilka wejść jednego dzieła może dotyczyć całości, początku, końca, także kilku części naraz
  części oddziela „;”; część, która zaczyna się niżej niż poprzednia, należy do jej ramy („I q. 2 a. 3; a. 4” — artykuł 4 tej samej kwestii; „t. 2, rozdz. 1; rozdz. 9” — rozdział 9 tego samego tomu)
${formsSection()}
${COURSE_USAGE}
${kinds}`;
}

/**
 * 2026-11-02 — NAGRODY (`rewards.ts`): Punkte, Serie, Tagesziel, Stufen, Abzeichen — eine Regel als Dokument; was
 * fehlt, nimmt die eingebaute Regel („Punkty, seria i poziomy").
 */
const REWARDS_SECTION = `"rewards" — nagrody (punkty, seria dni, cel dnia, poziomy, odznaki); kilka w bazie, każde miejsce wybiera swoje (moduł „Punkty i seria” / „Statystyki na żywo” na stronie, Ustawienia → Motywacja → „Punkty i nagrody” w Nauce):
  {"ref": "@kurs/punkty", "name": "Punkty i seria",
   "points": {"correct": 10, "partial": 5, "wrong": 1, "first": 5, "known": 20, "fast": 0, "combo": 15, "goal": 50, "streak": 5},
   "known": {"days": 1}, "fast": {"seconds": 8}, "combo": {"every": 5}, "goal": {"amount": 20, "unit": "cards|answers|points|minutes"},
   "streak": {"counts": "goal|any", "grace": 0, "max": 10},
   "levels": [{"at": 0, "name": "Początkujący"}, {"at": 100, "name": "Uczeń"}],
   "badges": [{"id": "tydzien", "name": "Tydzień z rzędu", "icon": "star|flame|target|book|bolt|crown|medal|leaf|check|rocket", "measure": "points|streak|best|known|cards|answers|correct|days|combo|goals|level", "atLeast": 7, "points": 0, "says": "…"}]}
  "points": "correct" × poprawność za dobrą odpowiedź (od 90%), "partial" × poprawność za częściowo dobrą, "wrong" za złą (za próbę), "first" za pierwszą odpowiedź na kartę, "known" za kartę utrwaloną (następna powtórka co najmniej "known.days" dni dalej), "fast" za dobrą w "fast.seconds" s, "combo" co "combo.every" dobrych z rzędu (przerwa ponad 30 min zaczyna od nowa), "goal" za cel dnia, "streak" × dzień serii (do "streak.max")
  "goal": cel dnia — "cards" różnych kart, "answers" odpowiedzi, "points" punktów (bez premii za cel i serię), "minutes" minut nauki; "streak": dzień serii to dzień z celem ("goal") albo z jakąkolwiek nauką ("any"), "grace" — tyle dni przerwy nie przerywa serii
  punkty nie są zapisywane: liczy je aplikacja z odpowiedzi uczącego się — zmiana zasad zmienia punkty wszystkich; czego brakuje, bierze się z zasad wbudowanych; rankingów nie ma (tylko w sesjach na żywo)`;

/**
 * 2026-10-30 — WAS AUS DEM IMPORTIERTEN WIRD, im ganzen System (der Wunsch des Besitzers: neben jedem Import, wie die
 * Daten gebraucht werden). Jede Zeile ist im Code nachgeprüft.
 */
const COURSE_USAGE = `## Jak aplikacja używa tych danych
  Wiedza: wpisy stoją w „Wpisy” (tabela, drzewo, struktura, macierz, płótno — według widoków), każdy ze swoją stroną (pola, odwołania, kolejność nauki); rodzaje, szablony, widoki i sposoby dodawania — w „Schematach”; wejścia ("anchors") dają przy dziele w Bibliotece i w czytniku przycisk „W Wiedzy”.
  Nauka: szablony robią z wpisów karty (z kluczem „szablon:wpis”); powtórki wybierają z kart i pytają; „Ścieżka” pokazuje kolejność nauki; widoki i powtórki z „Filtrem znajomości” pokazują to, co uczący się już może.
  Krajobraz (widok "landscape", na stronie "krajobraz"): z kolejności nauki i znajomości liczy dla każdego wpisu wysokość (dolina, pierścień, góry), z grupowania widoku — kierunek; uczący się wybiera tam, czego się uczyć, ustawia cel (zapisany prywatnie jak postępy), a blokada każe najpierw powtórzyć słabe karty z drogi przed wpisem.
  Czytanie w Nauce: przed pierwszym pytaniem o wpis z "about" stoi „Nowy temat” (tytuł i zapowiedź, „Czytaj dalej”, „Czytaj tekst” do miejsca w źródle), po odpowiedzi — wyjaśnienie; oba według "reading" jego rodzaju, a bez niego — streszczenie albo pierwszy akapit, potem pola z tekstem.
  Odpowiedzi: każda zapisuje się zaszyfrowana w przeglądarce — dla uczącego się i dla obszaru przyjęć kursu (Ustawienia), gdzie nauczyciel widzi „Postępy”; z nich liczy się znajomość kart i wpisów. Serwis nie czyta odpowiedzi; widzi tylko, kiedy następna powtórka i ile kart czeka — na osobę i bazę (do przypomnienia).
  Strony: moduły „Widok” (tabela, drzewo, macierz, mapa), „Powtórka”, „Kurs / opowieść”, „Karta wpisu” czytają bazę tak, jak widzi ją czytelnik strony; uczy się osoba strony (zalogowana — ona sama, bez konta — ta przeglądarka).
  Nagrody ("rewards"): moduły „Punkty i seria” i „Statystyki na żywo” na stronie oraz Nauka (Motywacja „Punkty i nagrody”, zakładka „Nagrody”) liczą z odpowiedzi punkty, serię, cel dnia, poziom i odznaki — na żywo, przy każdej odpowiedzi; nic z tego nie jest zapisywane.
  Inne bazy wiedzy, które korzystają z tej jako źródła, widzą jej rodzaje, wpisy, szablony, powtórki i przebiegi tylko do odczytu; link dla AI i MCP czytają ją bez zmian.
  Kto czyta: ten, kto czyta jej obszar (w obszarze jawnym — każdy); wpisy są szyfrowane kluczem obszaru.
  Import usuwa tylko to, co dokument wymienia z "remove": true (podgląd pokazuje każde), i nie dotyka odpowiedzi ani postępów: nowa karta zaczyna bez historii, a karta, której poprawna odpowiedź się zmieniła, zaczyna historię od nowa (zmiana wag "tests" historii nie zmienia).
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
