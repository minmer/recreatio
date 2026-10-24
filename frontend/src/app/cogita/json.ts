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
import { addFormDoc, COLUMN_SEPARATORS, KEY_ACTIONS, mapFormRefs, readAddForm, VALUE_SEPARATORS } from './addForm';
import { readTemplate } from './cards';
import { readFlow } from './flow';
import { graphJson, readGraph, type Graph, type GraphNode } from './graph';
import { DOC_KINDS, DOC_LABEL, isBaseKind, kindDoc, type DocKind } from './kinds';
import { FIELD_TYPE_LABEL, FIELD_TYPES, readKind, type Entity, type KindDef } from './schema';
import type { CogitaLibrary } from './store';
import { readView, viewJson } from './views';
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
  addform: 'forms'
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/* -- Hinaus ---------------------------------------------------------------------------- */

/** Ein Eintrag als JSON: seine Kennung als `ref`, Verweise als `@kennung`. */
function entityJson(lib: CogitaLibrary, entity: Entity): Record<string, unknown> {
  return {
    ref: `@${entity.id}`,
    kinds: entity.kinds.map((k) => (isBaseKind(k) ? k : lib.kind(k)?.name ?? k)),
    data: refsOut(lib, entity)
  };
}

function refsOut(lib: CogitaLibrary, entity: Entity): Record<string, unknown> {
  const fields = new Map(lib.kinds.flatMap((k) => k.fields).map((f) => [f.key, f]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity.data)) {
    const field = fields.get(key);
    if (field?.type !== 'ref') { out[key] = value; continue; }
    const swap = (one: unknown): unknown => (typeof one === 'string' && one !== '' ? `@${one}` : isObject(one) && typeof one.value === 'string' ? { ...one, value: `@${one.value}` } : one);
    out[key] = Array.isArray(value) ? value.map(swap) : swap(value);
  }
  return out;
}

/*
  2026-10-19 — EIN RODZAJ IN EINER VORLAGE („Wpisy rodzaju": welche Einträge)
  geht als `@kennung` hinaus, wie die Rodzaje der Vorlage selbst. Wörtlich
  stehen gelassen zeigte er in einer anderen Baza wiedzy ins Leere.
*/
const templateGraphJson = (graph: Graph): Record<string, unknown> => {
  const g = graphJson(graph);
  const nodes = (g.nodes as GraphNode[]).map((n) => (n.type === 'entries' && typeof n.config.kind === 'string' && n.config.kind !== '' && !n.config.kind.startsWith('@')
    ? { ...n, config: { ...n.config, kind: `@${n.config.kind}` } }
    : n));
  return { ...g, nodes };
};

const docJson = (kind: DocKind, id: string, data: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const { public: _public, ...rest } = data as Record<string, unknown>;
  if (kind === 'addform') return formJson(id, data);
  /* 2026-10-22 (Schritt 9) — ein Widok geht immer in der neuen Gestalt hinaus (Schritte statt Art und Filter). */
  if (kind === 'view') return { ref: `@${id}`, ...viewJson(readView(data)) };
  return { ref: `@${id}`, ...rest, ...(kind === 'template' ? { graph: templateGraphJson(readGraph(data.graph)) } : kind === 'revision' ? { graph: graphJson(readGraph(data.graph)) } : {}), ...(kind === 'flow' ? { graph: graphJson(readGraph(data.graph, true)) } : {}) };
};

/** 2026-10-17 — ein Formularz dodawania: seine Rodzaje und voreingestellten Einträge als `@kennung`, damit er auch in einer anderen Baza wiedzy gilt. */
function formJson(id: string, data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const form = readAddForm(id, data);
  return { ref: `@${id}`, ...addFormDoc(form), graph: mapFormRefs(form.graph, (k) => `@${k}`, (e) => `@${e}`) };
}

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
    docs[LIST_OF[kind]] = lib.docs(kind).filter((e) => lib.isOwn(e.id)).map((e) => docJson(kind, e.id, e.data));
  }
  return {
    format: COURSE_FORMAT,
    version: 1,
    name,
    kinds: lib.kinds.filter((k) => (!isBaseKind(k.id) && lib.isOwn(k.id)) || lib.docs('kind').some((e) => e.data.builtin === k.id)).map((k) => ({ ref: `@${k.id}`, ...kindDoc(k) })),
    entities: lib.entities().filter((e) => lib.isOwn(e.id) && (only?.entities === undefined || only.entities.has(e.id))).map((e) => entityJson(lib, e)),
    ...docs
  };
}

/** Das Schema mit seinen Vorlagen — eine unabhängige Kopie für eine andere Bibliothek [B12]. */
export function exportSchema(lib: CogitaLibrary, name: string, kinds: readonly KindDef[]): Record<string, unknown> {
  const ids = new Set(kinds.map((k) => k.id));
  return {
    format: SCHEMA_FORMAT,
    version: 1,
    name,
    kinds: kinds.map((k) => ({ ref: `@${k.id}`, ...kindDoc(k) })),
    templates: lib.templates().filter((t) => t.kinds.some((k) => ids.has(k))).map((t) => ({ ref: `@${t.id}`, name: t.name, kinds: t.kinds.map((k) => `@${k}`), direction: t.direction, graph: templateGraphJson(t.graph) })),
    /* 2026-10-17 — die Formularze dodawania gehören zum Schema: sie sagen, wie man seine Einträge anlegt. */
    forms: lib.docs('addform').filter((e) => lib.isOwn(e.id)).map((e) => formJson(e.id, e.data))
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
    kinds: kinds.map((k) => ({ ref: `@${k.id}`, ...kindDoc(k) })),
    forms: forms.map((f) => formJson(f.id, f.data))
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
    flow: docJson('flow', entry.id, entry.data),
    entities: [...shown].map((id) => lib.entity(id)).filter((e): e is Entity => e !== undefined).map((e) => entityJson(lib, e))
  };
}

/* -- Herein ------------------------------------------------------------------------------ */

export interface ImportPlan {
  readonly kinds: { readonly id: string; readonly def: KindDef; readonly isNew: boolean }[];
  readonly entities: { readonly id: string; readonly kinds: string[]; readonly data: Record<string, unknown>; readonly isNew: boolean }[];
  readonly docs: { readonly id: string; readonly kind: DocKind; readonly data: Record<string, unknown>; readonly isNew: boolean }[];
  readonly lines: string[];
  readonly warnings: string[];
}

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
  const refs = new Map<string, string>();
  const ref = (raw: unknown): string | null => {
    const r = str(raw).replace(/^@/, '');
    return r === '' ? null : r;
  };
  const idFor = (raw: unknown, exists: (id: string) => boolean): { id: string; isNew: boolean } => {
    const r = ref(raw);
    if (r !== null && exists(r)) { refs.set(r, r); return { id: r, isNew: false }; }
    if (r !== null && refs.has(r)) return { id: refs.get(r)!, isNew: false };
    const id = newId();
    if (r !== null) refs.set(r, id);
    return { id, isNew: true };
  };

  /* Rodzaje: eingebaute an ihrer Kennung, eigene an Kennung oder Namen — erst alle Kennungen, dann die Felder. */
  const kinds: ImportPlan['kinds'] = [];
  /* Auch die eingebauten, die hier (noch) nicht stehen: „Pytanie" im JSON fügt sie hinzu. */
  const byName = new Map(lib.refKinds.map((k) => [k.name.toLowerCase(), k.id]));
  const docNames = new Map<string, string>();
  const placed: { raw: Record<string, unknown>; id: string; isNew: boolean }[] = [];
  for (const raw of Array.isArray(doc.kinds) ? doc.kinds : []) {
    if (!isObject(raw)) continue;
    const builtin = str(raw.builtin);
    if (builtin !== '' && isBaseKind(builtin)) {
      placed.push({ raw, id: builtin, isNew: false });
      refs.set(ref(raw.ref) ?? builtin, builtin);
      continue;
    }
    /* 2026-10-23 — eine Änderung eines eingebauten Rodzaj, den es nicht mehr gibt (Temat, Wiedza, Komentarz): nicht als neuer Rodzaj. */
    if (builtin !== '') { warnings.push(`Rodzaj wbudowany „${builtin}” już nie istnieje (tematów, wiedzy i komentarzy wbudowanych nie ma) — pominięty.`); continue; }
    const named = byName.get(str(raw.name).toLowerCase());
    const r = ref(raw.ref);
    const known = r !== null && lib.kind(r) !== undefined ? r : named;
    const id = known ?? idFor(raw.ref, () => false).id;
    if (r !== null) refs.set(r, id);
    if (str(raw.name) !== '') docNames.set(str(raw.name).toLowerCase(), id);
    placed.push({ raw, id, isNew: known === undefined });
  }
  const kindId = (raw: unknown): string | null => {
    const r = ref(raw);
    if (r === null) return null;
    if (isBaseKind(r) || lib.kind(r) !== undefined) return r;
    if (refs.has(r)) return refs.get(r)!;
    return byName.get(r.toLowerCase()) ?? docNames.get(r.toLowerCase()) ?? null;
  };
  /*
    2026-10-17 — WOHIN EIN VERWEISFELD ZEIGT („to") gilt wie jeder andere
    Rodzaj im Dokument: als `@ref`, Kennung oder Name, auch auf einen weiter
    unten. Vorher blieb es wörtlich stehen — in einer anderen Baza wiedzy
    zeigte „Słowo → Język" dann auf eine Kennung, die es dort nicht gibt.
  */
  for (const { raw, id, isNew } of placed) {
    const fields = Array.isArray(raw.fields)
      ? raw.fields.map((f) => (isObject(f) && Array.isArray(f.to) ? { ...f, to: f.to.map((t) => kindId(t) ?? t) } : f))
      : raw.fields;
    kinds.push({ id, def: readKind(id, { ...raw, fields }), isNew });
  }

  /* Einträge: zuerst die Kennungen, dann die Verweise (sie dürfen nach vorn zeigen). */
  const rawEntities = Array.isArray(doc.entities) ? doc.entities.filter(isObject) : [];
  const ids = rawEntities.map((raw) => idFor(raw.ref ?? raw.id, (id) => lib.entity(id) !== undefined));
  const entities: ImportPlan['entities'] = [];
  rawEntities.forEach((raw, i) => {
    const entityKinds = (Array.isArray(raw.kinds) ? raw.kinds : [raw.kind]).map(kindId).filter((k): k is string => k !== null);
    if (entityKinds.length === 0) { warnings.push(`Wpis ${str(raw.ref) || i + 1}: nie ma takiego rodzaju — pominięty.`); return; }
    const data = isObject(raw.data) ? refsIn(raw.data, (r) => refs.get(r) ?? (lib.entity(r) !== undefined ? r : null), (missing) => warnings.push(`Wpis ${str(raw.ref) || i + 1}: odwołanie „@${missing}" prowadzi donikąd — pominięte.`)) : {};
    entities.push({ id: ids[i].id, kinds: entityKinds, data, isNew: ids[i].isNew });
  });

  /* Dokumente: Vorlagen, Wiederholungen, Abläufe, … */
  const docs: ImportPlan['docs'] = [];
  const docLists: [DocKind, unknown][] = [
    ['template', doc.templates], ['revision', doc.revisions], ['flow', format === FLOW_FORMAT ? [doc.flow] : doc.flows],
    ['look', doc.looks], ['rules', doc.rules], ['values', doc.values], ['collection', doc.collections], ['view', doc.views], ['settings', doc.settings],
    ['addform', doc.forms]
  ];
  for (const [kind, list] of docLists) {
    for (const raw of Array.isArray(list) ? list : isObject(list) ? [list] : []) {
      if (!isObject(raw)) continue;
      const { id, isNew } = idFor(raw.ref ?? raw.id, (one) => lib.docs(kind).some((e) => e.id === one));
      const { ref: _ref, id: _id, ...rest } = raw;
      let data = refsIn(rest, (r) => refs.get(r) ?? (lib.entity(r) !== undefined || lib.kind(r) !== undefined ? r : null), () => undefined);
      if (kind === 'template') {
        const t = readTemplate(id, data);
        data = { ...data, kinds: t.kinds.map((k) => kindId(k) ?? k), graph: graphJson(t.graph) };
      }
      if (kind === 'addform') {
        /* Ein Rodzaj darf auch beim Namen stehen; einer aus demselben Dokument hat schon seine neue Kennung. */
        const kindOf = (k: string) => (kinds.some((x) => x.id === k) ? k : kindId(k));
        data = addFormDoc(readAddForm(id, { ...data, graph: mapFormRefs(data.graph, kindOf, (e) => e) }));
      }
      /* 2026-10-22 (Schritt 9) — ein Widok in der alten Gestalt (Art und Filter) kommt als Schritte an. */
      if (kind === 'view') data = viewJson(readView(data));
      if (kind === 'settings') {
        const had = lib.settingsEntry();
        docs.push({ id: had?.id ?? id, kind, data: { ...(had?.data ?? {}), ...data }, isNew: had === undefined });
        continue;
      }
      docs.push({ id, kind, data, isNew });
    }
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

/** `@name` in den Daten zu Kennungen — in Werten, Listen und den Hüllen unsicherer Werte. */
function refsIn(data: Record<string, unknown>, resolve: (ref: string) => string | null, missing: (ref: string) => void): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string' && /^@[A-Za-z0-9_.:-]{1,80}$/.test(v)) {
      const id = resolve(v.slice(1));
      if (id === null) { missing(v.slice(1)); return undefined; }
      return id;
    }
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== undefined);
    if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]).filter(([, x]) => x !== undefined));
    return v;
  };
  return walk(data) as Record<string, unknown>;
}

/** Den Plan ausführen — erst die Arten, dann die Einträge, dann die Dokumente. Gibt zurück, was ging und was nicht. */
export async function applyImport(lib: CogitaLibrary, plan: ImportPlan, stage: (text: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  const warnings = [...plan.warnings];
  let done = 0;
  const total = plan.kinds.length + plan.entities.length + plan.docs.length;
  const step = () => { done += 1; stage(`Zapisywanie ${done} z ${total}…`); };
  for (const k of plan.kinds) {
    try { await lib.saveKind(k.def); } catch (e) { warnings.push(`Rodzaj „${k.def.name}": ${e instanceof Error ? e.message : 'nie udało się'}.`); }
    step();
  }
  for (const e of plan.entities) {
    try { await lib.saveEntity({ id: e.id, kinds: e.kinds, data: e.data }); } catch (err) { warnings.push(`Wpis ${e.id.slice(-4)}: ${err instanceof Error ? err.message : 'nie udało się'}.`); }
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

/** Was ein Formularz dodawania im JSON ist — im Kurs, im Schema und für sich. */
const formsSection = (): string => `"forms" — formularze dodawania (należą do schematu): {"ref", "name", "says", "graph", "keys", "paste", "order"}
  węzeł "pick" — wybór na początek, zostaje dla wszystkich wierszy: "config": {"label", "kinds": ["@rodzaj"], "many", "optional", "value": ["@wpis"]}
  węzeł "entry" — wpis z każdego wiersza: "config": {"kind": "@rodzaj", "also": ["@inny rodzaj"] (rodzaj wybierany przy każdej wartości; na liście przedrostek „Nazwa rodzaju: …”), "label", "many" (kilka w wierszu), "reuse": "same|never", "identity": ["pole"],
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
  "fields": [{"key", "label", "type", "multi", "uncertain", "unit", "quantity", "options", "to", "inverse", "symmetric", "locator", "media", "rangeOf", "says"}]
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
    templates/cogita/slownik.json (Język, Słowo, Tłumaczenie, Synonimy, Antonimy — z szablonami „Słówka”), templates/cogita/psalterz.json (psalm z miejscem w Piśmie, miejsca brewiarza)
  typy pól: ${FIELD_TYPES.map((t) => `"${t}" (${FIELD_TYPE_LABEL[t]})`).join(', ')}`;

/** 2026-10-19 — neben dem JSON eines Formulars: nur, was ihn betrifft. */
export function formDescription(lib?: CogitaLibrary): string {
  return `# Formularz dodawania jako JSON

Format: "${SCHEMA_FORMAT}" (ten sam co schemat), wersja 1:
  {"format", "version": 1, "name", "kinds": [...], "templates": [...], "forms": [...]}
  "kinds" — rodzaje, których formularze potrzebują; bez nich muszą już być w tej bazie wiedzy (rozpoznane po "ref", nazwie albo wbudowanym identyfikatorze).
  "templates" — szablony kart dla tych rodzajów (opcjonalnie): {"ref", "name", "kinds": ["@rodzaj"], "direction", "graph"}.
  Formularz z tym samym "ref" co istniejący zmienia go w miejscu; inny — powstaje nowy. Niczego się nie usuwa.
  "ref" — własna nazwa, np. "@miejsce"; w tym samym dokumencie odwołuje się nią do rodzaju ("kind": "@miejsce", "to": ["@miejsce"]).

${kindsSection()}

${formsSection()}
${kindsOfBase(lib)}`;
}

/** Was die Formate bedeuten — neben jedem Import. */
export function courseDescription(lib?: CogitaLibrary): string {
  const kinds = kindsOfBase(lib);
  return `# Cogita jako JSON

Formaty:
  "${COURSE_FORMAT}" — cały kurs: rodzaje, wpisy, szablony kart, powtórki, przebiegi, zbiory, wygląd, zasady, wartości
  "${SCHEMA_FORMAT}" — rodzaje z ich szablonami kart i formularzami dodawania (niezależna kopia do innej bazy wiedzy)
  "${ENTITIES_FORMAT}" — same wpisy (także wypowiedzi i pytania)
  "${FLOW_FORMAT}" — przebieg razem z tym, co pokazuje

Wspólne:
  "format", "version": 1, "name" — nazwa
  "ref" — własna nazwa wpisu, np. "@dawid"; inne pola odwołują się do niej tak samo: "@dawid".
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu); import zmienia je w miejscu i niczego nie usuwa.

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
  pytanie: "kinds": ["question"], "data": {"form": "text|number|date|one|many|truefalse|order|match|gap|flash|code|point|interactive", "prompt", "answers", "options", "correct", …}
    "interactive" — rysunek do poruszania: "drawing" (ten sam JSON co moduł strony „Animacja”: vars, let, sim, controls, rules z "goal": true, world, elements — jako tekst JSON),
    "goal" (wyrażenie celu, np. "abs(x - cel) < 0.5 && y <= 0"; puste — reguły rysunku z "goal"), "solution" ("kat = 45; v0 = sqrt(cel*g)" — rachunek z wartościami rysunku; w świecie także "w2.pos = 5"; puste — "task.solve" rysunku, a jego "task" losuje przy każdej próbie zadanie tak samo trudne);
    sprawdzane przez symulację ustawionych wartości do końca (świat — odtworzony według jego reguł: co zablokowane, zostaje); wartości z "random" losowane przy każdej próbie

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}}
  szablon może dotyczyć rodzaju z biblioteki ("quote", "work", "person") albo ze skryptorium ("text", "delivery", "project"), z których korzysta ta baza: wtedy karty powstają z ich wpisów, np. {"name": "Miejsce cytatu", "kinds": ["quote"], "direction": "locator", "graph": …}
"revisions" — powtórki: {"name", "graph"} (źródła → filtr → … → jeden „Sposób pytania")
  także kroki wspólne z widokami: {"type": "follow", "config": {"field": "authors", "back": false}} — karty wpisów, do których prowadzi odwołanie (albo, "back": true, które wskazują na te wpisy); {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field", "cmp", "value"}]}}} — karty wpisów spełniających regułę
  źródło „rodzaj z biblioteki": {"type": "source.kind", "config": {"kind": "quote", "from": "<identyfikator biblioteki>"}} — "from" puste: z tej bazy i ze wszystkich źródeł
"flows" — przebiegi: {"name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "slots", "goals", "lines", "narrators"}
  "narrators" — kto opowiada, według wartości: [{"character": "@piotr", "condition": {"type": "value", "value": "przewodnik", "op": "eq", "than": 1}}, {"character": "@maria"}] — opowiada pierwszy, którego warunek jest spełniony (bez warunku: zawsze); jego portret i imię stoją nad krokiem i zapowiadają jego tytuł
  krok "scene" {"page": "adres/strony", "scene": "klucz sceny", "title"} — scena prezentacji; wyjścia "next", przy pytaniu na scenie "right" / "wrong", przyciski "b0", "b1", …
  przebieg z prezentacji (jedna opowieść, nie kopia): {"name": "Droga", "look": "scenes", "presentation": "parafia/droga", "narrators": […]} — bez własnego "graph": jego mapą jest storyboard strony (sceny, przejścia, pytania, warunki, wartości — "story" w JSON strony); w Nauce gra tę prezentację, a odpowiedzi, wartości i miejsce, w którym ktoś skończył, liczą się w tej bazie (to samo miejsce co na stronie); zobaczy ją tylko ten, kto może zobaczyć stronę
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"views" — widoki (te same kroki co powtórka, po wpisach): {"name", "mode": "table|tree|matrix|map|canvas", "steps": [krok, …], "query", "group", "matrix", "columns": ["klucz pola" | "#axis:@oś"], "sort": {"key", "dir": 1|-1}}
  na początku źródła — kilka pod rząd sumuje się (np. kazania i komentarze): "source.all" | "source.kind" {"kind": "@rodzaj" albo "text" ze skryptorium, "from"} | "source.collection" {"collection": "@zbiór"} | "source.list" {"ids": ["@wpis"]};
  także "source.from" {"entry": "@kazanie"} — to, na co wskazuje wpis (kazanie: jego cytaty, wypowiedzi, słowa ze słownika, miejsca z planu; w powtórce: „Z wpisu" — powtórka z kazania);
  potem "follow" {"field", "back"} i "filter.rule" {"rule"} (źródło po innym kroku zaczyna od nowa);
  grupowanie (drzewo "group", wiersze i kolumny "matrix": {"rows": grupowanie, "cols": grupowanie}): {"by": "kind"} | {"by": "field", "field": "klucz"} | {"by": "axis", "kind": "@rodzaj", "via", "through", "sort", "group"} — OŚ: jej wartości to wpisy rodzaju
    "via": ["pole"] — przez które pola-odwołania wpis należy do wartości (puste: przez dowolne); "through": "pole" albo "*" — także o jeden krok dalej (wpis → przez to pole → inny wpis → przez "via" → wartość)
    "sort": {"field": "numer"} — kolejność według pola liczbowego wartości, albo {"list": "@rozaniec", "field": "tajemnice"} — według kolejności w polu-odwołaniu innego wpisu; bez "sort" — według nazwy
    "group": "czesc" — nagłówki: pole-odwołanie wartości (np. część tajemnic); w macierzy nad kolumnami i między wierszami
  kolumna "#axis:@rodzaj" — wartości tej osi (wpisy rodzaju), na które wskazuje wpis
  np. {"name": "Postacie według okresu", "mode": "tree", "steps": [{"type": "source.kind", "config": {"kind": "@postac"}}], "group": {"by": "axis", "kind": "@okres", "via": ["okres"], "sort": {"field": "od"}}}
  np. macierz 20 × 12 — Tajemnica × Obszar: {"name": "Tajemnica × Obszar", "mode": "matrix", "steps": [{"type": "source.kind", "config": {"kind": "text"}}, {"type": "source.kind", "config": {"kind": "@komentarz"}}], "matrix": {"rows": {"by": "axis", "kind": "@tajemnica", "sort": {"field": "numer"}, "group": "czesc"}, "cols": {"by": "axis", "kind": "@obszar", "group": "grupa"}}}
    — 20 tajemnic różańca (w czterech częściach) × 12 maryjnych obszarów (w grupach); w polu: kazania ze skryptorium (rodzaj tekstu „Kazanie maryjne” z polami "tajemnica" i "obszar") i komentarze, których "about" wskazuje tajemnicę i obszar; puste pola też są widoczne
  na stronie: moduł "view" {"library": "<id bazy>", "view": "<id widoku>", "mode": "tabela|drzewo|macierz|mapa"} — pole macierzy (klik) i wpis otwierają się pod spodem, droga w adresie osobno dla każdego modułu
${formsSection()}
${kinds}`;
}

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
    questions: 'Ułóż z tekstu pytania sprawdzające (rodzaj "question") w różnych formach odpowiedzi.',
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
