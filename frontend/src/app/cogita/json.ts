/**
 * COGITA ALS JSON — hinaus und herein, mit Beschreibung und einem Auftrag
 * für die eigene KI (COGITA.md §14, [P13, F34, B12]).
 *
 * <code>
 *   recreatio.cogita.course     alles: Schema, Vorlagen, Einträge, Wiederholungen, Abläufe, Zbiory, Wygląd, Zasady, Wartości
 *   recreatio.cogita.schema     Rodzaje, ihre Kartenvorlagen und Formularze dodawania — als unabhängige Kopie für eine andere Bibliothek [B12]
 *   recreatio.cogita.entities   Einträge (auch Wiedza und Pytania)
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
import { graphJson, readGraph } from './graph';
import { DOC_KINDS, isBaseKind, kindDoc, type DocKind } from './kinds';
import { FIELD_TYPE_LABEL, FIELD_TYPES, readKind, type Entity, type KindDef } from './schema';
import type { CogitaLibrary } from './store';

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

const docJson = (kind: DocKind, id: string, data: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const { public: _public, ...rest } = data as Record<string, unknown>;
  if (kind === 'addform') return formJson(id, data);
  return { ref: `@${id}`, ...rest, ...(kind === 'template' || kind === 'revision' ? { graph: graphJson(readGraph(data.graph)) } : {}), ...(kind === 'flow' ? { graph: graphJson(readGraph(data.graph, true)) } : {}) };
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
    templates: lib.templates().filter((t) => t.kinds.some((k) => ids.has(k))).map((t) => ({ ref: `@${t.id}`, name: t.name, kinds: t.kinds.map((k) => `@${k}`), direction: t.direction, graph: graphJson(t.graph) })),
    /* 2026-10-17 — die Formularze dodawania gehören zum Schema: sie sagen, wie man seine Einträge anlegt. */
    forms: lib.docs('addform').filter((e) => lib.isOwn(e.id)).map((e) => formJson(e.id, e.data))
  };
}

/** Ein Ablauf mit allem, was er zeigt [F34]. */
export function exportFlow(lib: CogitaLibrary, flowId: string): Record<string, unknown> | null {
  const entry = lib.docs('flow').find((e) => e.id === flowId);
  if (entry === undefined) return null;
  const flow = readFlow(entry.id, entry.data);
  const shown = new Set<string>();
  for (const n of flow.graph.nodes) for (const v of Object.values(n.config)) if (typeof v === 'string' && lib.entity(v) !== undefined) shown.add(v);
  for (const l of flow.lines) { shown.add(l.character); shown.add(l.of); }
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
  const byName = new Map(lib.kinds.map((k) => [k.name.toLowerCase(), k.id]));
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
      return n.length === 0 ? '' : `${k}: ${n.filter((d) => d.isNew).length} nowych, ${n.filter((d) => !d.isNew).length} do zmiany.`;
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

/** Was die Formate bedeuten — neben jedem Import. */
export function courseDescription(lib?: CogitaLibrary): string {
  const kinds = lib === undefined ? '' : `\nRodzaje tej bazy wiedzy:\n${lib.kinds.map((k) => `  "${isBaseKind(k.id) ? k.id : k.name}" — ${k.name}: ${k.fields.map((f) => `${f.key} (${FIELD_TYPE_LABEL[f.type]}${f.multi ? ', kilka' : ''}${f.uncertain ? ', niepewne' : ''})`).join(', ')}`).join('\n')}\n`;
  return `# Cogita jako JSON

Formaty:
  "${COURSE_FORMAT}" — cały kurs: rodzaje, wpisy, szablony kart, powtórki, przebiegi, zbiory, wygląd, zasady, wartości
  "${SCHEMA_FORMAT}" — rodzaje z ich szablonami kart i formularzami dodawania (niezależna kopia do innej bazy wiedzy)
  "${ENTITIES_FORMAT}" — same wpisy (także wiedza i pytania)
  "${FLOW_FORMAT}" — przebieg razem z tym, co pokazuje

Wspólne:
  "format", "version": 1, "name" — nazwa
  "ref" — własna nazwa wpisu, np. "@dawid"; inne pola odwołują się do niej tak samo: "@dawid".
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu); import zmienia je w miejscu i niczego nie usuwa.

"kinds" — rodzaje:
  "name" — nazwa, "label" — wzór etykiety, np. "{givenNames} {surname}", "tells" — pole, które odróżnia imienników,
  "builtin" — zmiana wbudowanego rodzaju (person, work, quote, topic, text, project, knowledge, question),
  "fields": [{"key", "label", "type", "multi", "uncertain", "unit", "options", "to", "inverse", "symmetric", "media", "rangeOf", "says"}]
  "to" (odwołanie) — na jakie rodzaje wskazuje: ["@ref rodzaju z tego dokumentu", "Nazwa rodzaju", "topic"]; puste — na dowolne
  typy pól: ${FIELD_TYPES.map((t) => `"${t}" (${FIELD_TYPE_LABEL[t]})`).join(', ')}
  wartość niepewna: {"value": …, "state": "known|approximate|disputed|unknown|na|pending", "source": {"work": "@dzielo", "locator": "s. 23"}, "note": "…"}
  data: "1999", "1999-05", "1999-05-03", "-1000" (przed Chr.); zakres: {"segments": [{"from": 992, "to": 1000}]}

"entities" — wpisy: {"ref", "kinds": ["person", "Postać"], "data": {pole: wartość}}
  wiedza: "kinds": ["knowledge"], "data": {"text": "Dawid był [[królem|@izrael]]…", "tags": ["historyczna"], "about": ["@dawid"]}
  pytanie: "kinds": ["question"], "data": {"form": "text|number|date|one|many|truefalse|order|match|gap|flash|code|point|interactive", "prompt", "answers", "options", "correct", …}
    "interactive" — rysunek do poruszania: "drawing" (ten sam JSON co moduł strony „Animacja”: vars, let, sim, controls, rules z "goal": true, world, elements — jako tekst JSON),
    "goal" (wyrażenie celu, np. "abs(x - cel) < 0.5 && y <= 0"; puste — reguły rysunku z "goal"), "solution" ("kat = 45; v0 = sqrt(cel*g)" — rachunek z wartościami rysunku; w świecie także "w2.pos = 5");
    sprawdzane przez symulację ustawionych wartości do końca (świat — odtworzony według jego reguł: co zablokowane, zostaje); wartości z "random" losowane przy każdej próbie

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}}
"revisions" — powtórki: {"name", "graph"} (źródła → filtr → … → jeden „Sposób pytania")
"flows" — przebiegi: {"name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "slots", "goals", "lines"}
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"forms" — formularze dodawania (należą do schematu): {"name", "says", "graph", "keys", "paste", "order"}
  węzeł "pick" — wybór na początek, zostaje dla wszystkich wierszy: "config": {"label", "kinds": ["@rodzaj"], "many", "optional", "value": ["@wpis"]}
  węzeł "entry" — wpis z każdego wiersza: "config": {"kind": "@rodzaj", "label", "many" (kilka w wierszu), "reuse": "same|never", "identity": ["pole"],
    "fields": {"pole": {"from": "type|ask|fixed", "value": "tekst"}}} — type: wpisywane w wierszu, ask: ustawiane na początek, fixed: stała wartość
  krawędź {"id", "from": węzeł, "out": "out", "to": węzeł "entry", "in": klucz pola-odwołania} — wypełnia to pole wpisem z węzła "from"
  "order": ["id węzła entry"] — kolejność pól w wierszu (Enter, kolumny wklejanej listy); bez niej jak na płótnie
  "keys": {"enter", "ctrlEnter", "shiftEnter"}: ${KEY_ACTIONS.map((k) => `"${k}"`).join(', ')}
  "paste": {"columns": ${COLUMN_SEPARATORS.map((k) => `"${k}"`).join(', ')}, "values": ${VALUE_SEPARATORS.map((k) => `"${k}"`).join(', ')}, "header": true|false}
${kinds}`;
}

/**
 * DER AUFTRAG FÜR DIE EIGENE KI [P13] — zum Kopieren: was sie tun soll, das
 * Format, die Rodzaje dieser Bibliothek, und der Text, aus dem sie schöpft.
 */
export function aiPrompt(lib: CogitaLibrary, what: 'entities' | 'knowledge' | 'questions' | 'flow' | 'schema', source: string): string {
  const task = {
    entities: 'Wypisz z tekstu osoby, miejsca, dzieła i inne rzeczy jako wpisy.',
    knowledge: 'Rozbij tekst na pojedyncze stwierdzenia wiedzy (rodzaj "knowledge"); słowa, które są wpisami, oznacz [[słowo|@ref]].',
    questions: 'Ułóż z tekstu pytania sprawdzające (rodzaj "question") w różnych formach odpowiedzi.',
    flow: `Ułóż przebieg (format ${FLOW_FORMAT}): kroki pokazujące wiedzę i pytania; wszystkie teksty to wpisy wiedzy, a nie tekst przebiegu.`,
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
