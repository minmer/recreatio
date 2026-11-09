/**
 * 2026-10-26 — SCHEMAT I PLAN JAKO JSON (0132): eksport, import i opis formatu
 * obok importu (jak przy stronach, modułach i bibliotece — patrz
 * `app-json-check.mjs`). Rein: kein Dienst, kein Schlüssel.
 *
 * Ein Schema (`recreatio/scheme`) und ein Plan (`recreatio/plan`) gehen so
 * hinaus, wie sie gespeichert sind; beim Import wird geprüft, was ein Browser
 * später lesen muss — fehlende Schlüssel entstehen aus der Beschriftung, Unbekanntes
 * fällt mit einer Warnung weg. Ein Plan aus einem anderen Kalender verliert
 * seinen Verweis auf ein Schema (es gibt dort ein anderes) — mit einer Warnung.
 *
 * Die Beschreibung ist ein Teil des Baums der JSON-Formate (`core/jsonTree.ts`):
 * Schema → Feld, Liste → Regel → Ablauf, Bedingung, Datum; Plan → Ablauf des
 * Plans → dieselben Knoten. Jeder steht einmal; die Vorlagen sind die Beispiele.
 */

import { t } from '../core/i18n';
import { keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { ITEM_KINDS, ITEM_LABEL, type ItemKind } from './calendar';
import {
  type DateRule, type FlowDoc, type FlowEdge, type FlowNode, type FlowNodeType, NODE_INFO, PLAN_NODES, PLAN_TESTS, RULE_NODES, RULE_TESTS,
  SEASONS, type Test
} from './flow/flowModel';
import {
  KEY_PATTERN, keyOf, LITURGICAL_COLOURS, type PlanDef, type RecordList, SCHEME_FIELD_LABEL, SCHEME_FIELD_TYPES, type SchemeChoice,
  type SchemeDef, type SchemeField, type SchemeFieldType
} from './scheme';
import { PLAN_TEMPLATES } from './templates/planTemplates';
import { SCHEME_TEMPLATES } from './templates/schemeTemplates';

export const SCHEME_FORMAT = 'recreatio/scheme';
export const PLAN_FORMAT = 'recreatio/plan';

export const exportScheme = (def: SchemeDef) => ({ format: SCHEME_FORMAT, version: 1, ...def });
export const exportPlan = (def: PlanDef) => ({ format: PLAN_FORMAT, version: 1, ...def });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 400): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined);

function readChoices(value: unknown, where: string, warnings: string[]): SchemeChoice[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) { warnings.push(t('calendarDataScheme.read.optionsList', { where })); return undefined; }
  const out: SchemeChoice[] = [];
  for (const one of value) {
    if (typeof one === 'string' && one.trim() !== '') out.push({ value: one.trim(), label: one.trim() });
    else if (isObject(one) && text(one.label) !== undefined) out.push({ value: text(one.value) ?? text(one.label)!, label: text(one.label)! });
    else warnings.push(t('calendarDataScheme.read.optionNoName', { where }));
  }
  return out;
}

const readKinds = (value: unknown): ItemKind[] | undefined =>
  Array.isArray(value) ? value.filter((k): k is ItemKind => typeof k === 'string' && (ITEM_KINDS as readonly string[]).includes(k)) : undefined;

function readFields(value: unknown, where: string, warnings: string[]): SchemeField[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { warnings.push(t('calendarDataScheme.read.fieldsList', { where })); return []; }
  const out: SchemeField[] = [];
  for (const [i, one] of value.entries()) {
    if (!isObject(one) || text(one.label) === undefined) { warnings.push(t('calendarDataScheme.read.fieldNoName', { where, n: i + 1 })); continue; }
    const label = text(one.label, 120)!;
    const type = (SCHEME_FIELD_TYPES as readonly string[]).includes(String(one.type)) ? one.type as SchemeFieldType : 'text';
    if (one.type !== undefined && type !== one.type) warnings.push(t('calendarDataScheme.read.fieldType', { where, label, type: String(one.type) }));
    let key = typeof one.key === 'string' && KEY_PATTERN.test(one.key) ? one.key : keyOf(label, out.map((f) => f.key));
    if (out.some((f) => f.key === key)) key = keyOf(label, out.map((f) => f.key));
    out.push({
      key, label, type,
      ...(one.level === 'day' ? { level: 'day' as const } : {}),
      ...(one.public === true ? { public: true } : {}),
      ...(one.required === true ? { required: true } : {}),
      ...(readChoices(one.options, `${where} „${label}”`, warnings) !== undefined ? { options: readChoices(one.options, '', []) } : {}),
      ...(text(one.unit, 20) !== undefined ? { unit: text(one.unit, 20) } : {}),
      ...(readKinds(one.onlyKinds) !== undefined ? { onlyKinds: readKinds(one.onlyKinds) } : {}),
      ...(text(one.says) !== undefined ? { says: text(one.says) } : {})
    });
  }
  return out;
}

/** Ein Ablauf — Knoten, die es gibt, und Kanten zwischen ihnen. */
export function readFlow(value: unknown, kind: 'plan' | 'rule', where: string, warnings: string[]): FlowDoc | null {
  if (value === undefined || value === null) return null;
  if (!isObject(value) || !Array.isArray(value.nodes)) { warnings.push(t('calendarDataScheme.read.flowNoNodes', { where })); return null; }
  const allowed: readonly string[] = kind === 'plan' ? PLAN_NODES : RULE_NODES;
  const nodes: FlowNode[] = [];
  for (const one of value.nodes) {
    if (!isObject(one) || typeof one.id !== 'string' || !allowed.includes(String(one.type))) {
      warnings.push(t(kind === 'plan' ? 'calendarDataScheme.read.nodeNotPlan' : 'calendarDataScheme.read.nodeNotRule', { where, type: isObject(one) ? String(one.type) : '?' }));
      continue;
    }
    nodes.push({
      id: one.id, type: one.type as FlowNodeType,
      x: typeof one.x === 'number' ? one.x : 0, y: typeof one.y === 'number' ? one.y : 0,
      data: isObject(one.data) ? one.data : {}
    });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: FlowEdge[] = [];
  for (const one of Array.isArray(value.edges) ? value.edges : []) {
    if (!isObject(one) || typeof one.from !== 'string' || typeof one.to !== 'string' || !ids.has(one.from) || !ids.has(one.to)) continue;
    const out = one.out === 'yes' || one.out === 'no' ? one.out : 'out';
    edges.push({ id: typeof one.id === 'string' ? one.id : `${one.from}-${out}-${one.to}`, from: one.from, to: one.to, ...(out === 'out' ? {} : { out }) });
  }
  return { v: 1, nodes, edges };
}

function readLists(value: unknown, warnings: string[]): RecordList[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { warnings.push(t('calendarDataScheme.read.listsList')); return []; }
  const out: RecordList[] = [];
  for (const [i, one] of value.entries()) {
    if (!isObject(one) || text(one.label) === undefined) { warnings.push(t('calendarDataScheme.read.listNoName', { n: i + 1 })); continue; }
    const label = text(one.label, 120)!;
    const key = typeof one.key === 'string' && KEY_PATTERN.test(one.key) && !out.some((l) => l.key === one.key) ? one.key : keyOf(label, out.map((l) => l.key));
    const where = t('calendarDataScheme.read.listWhere', { label });
    const rule = readFlow(one.rule, 'rule', where, warnings);
    out.push({
      key, label,
      ...(text(one.itemLabel, 60) !== undefined ? { itemLabel: text(one.itemLabel, 60) } : {}),
      ...(readChoices(one.modes, where, warnings) !== undefined ? { modes: readChoices(one.modes, '', []) } : {}),
      ...(text(one.textLabel, 120) !== undefined ? { textLabel: text(one.textLabel, 120) } : {}),
      ...(text(one.person, 120) !== undefined ? { person: text(one.person, 120) } : {}),
      fields: readFields(one.fields, where, warnings),
      ...(one.outside === true ? { outside: true } : {}),
      ...(readKinds(one.onlyKinds) !== undefined ? { onlyKinds: readKinds(one.onlyKinds) } : {}),
      ...(rule !== null ? { rule } : {}),
      ...(text(one.says) !== undefined ? { says: text(one.says) } : {})
    });
  }
  return out;
}

export function readScheme(value: unknown, warnings: string[]): SchemeDef | null {
  if (!isObject(value)) { warnings.push(t('calendarDataScheme.read.notObject')); return null; }
  if (value.format !== undefined && value.format !== SCHEME_FORMAT) { warnings.push(t('calendarDataScheme.read.notScheme', { format: String(value.format) })); return null; }
  const name = text(value.name, 120);
  if (name === undefined) { warnings.push(t('calendarDataScheme.read.schemeNoName')); return null; }
  const kind = (ITEM_KINDS as readonly string[]).includes(String(value.kind)) ? value.kind as ItemKind : undefined;
  if (value.kind !== undefined && kind === undefined) warnings.push(t('calendarDataScheme.read.unknownKind', { kind: String(value.kind) }));
  return {
    name,
    ...(kind !== undefined ? { kind } : {}),
    ...(readKinds(value.kinds) !== undefined ? { kinds: readKinds(value.kinds) } : {}),
    ...(typeof value.publicTitle === 'boolean' ? { publicTitle: value.publicTitle } : {}),
    fields: readFields(value.fields, t('calendarDataScheme.read.schemeWhere'), warnings),
    lists: readLists(value.lists, warnings),
    ...(text(value.says, 1000) !== undefined ? { says: text(value.says, 1000) } : {})
  };
}

/** `schemeIds`: die Schemata DIESES Kalenders — ein Verweis auf ein anderes fällt fort. */
export function readPlan(value: unknown, schemeIds: readonly string[], warnings: string[]): PlanDef | null {
  if (!isObject(value)) { warnings.push(t('calendarDataScheme.read.notObject')); return null; }
  if (value.format !== undefined && value.format !== PLAN_FORMAT) { warnings.push(t('calendarDataScheme.read.notPlan', { format: String(value.format) })); return null; }
  const name = text(value.name, 120);
  if (name === undefined) { warnings.push(t('calendarDataScheme.read.planNoName')); return null; }
  const flow = readFlow(value.flow, 'plan', t('calendarDataScheme.read.planWhere'), warnings);
  if (flow === null) { warnings.push(t('calendarDataScheme.read.planNoFlow')); return null; }
  let schemeId = typeof value.schemeId === 'string' ? value.schemeId : null;
  if (schemeId !== null && !schemeIds.includes(schemeId)) {
    warnings.push(t('calendarDataScheme.read.otherScheme'));
    schemeId = null;
  }
  const kind = (ITEM_KINDS as readonly string[]).includes(String(value.kind)) ? value.kind as ItemKind : undefined;
  const weeks = typeof value.weeks === 'number' && value.weeks >= 1 && value.weeks <= 60 ? Math.round(value.weeks) : undefined;
  return {
    name, schemeId, flow,
    ...(kind !== undefined ? { kind } : {}),
    ...(weeks !== undefined ? { weeks } : {}),
    ...(text(value.says, 1000) !== undefined ? { says: text(value.says, 1000) } : {})
  };
}

/* -- Der Baum der Formate ---------------------------------------------------------------------- */

/** Beispiele und ihre Sätze, eine Zeile je Beispiel: `  {"t":"sunday"} — niedziela`. */
const rows = (pairs: readonly (readonly [string, string])[]): string => pairs.map(([what, says]) => `  ${what} — ${says}`).join('\n');

const nodeLines = (types: readonly FlowNodeType[]): string => rows(types.map((type) => [`"${type}"`, `${NODE_INFO[type].label}: ${NODE_INFO[type].says}`]));

/** Jede Regel eines Datums mit einem Beispiel — ein `Record`, damit keine fehlt. */
const DATE_ROWS: Readonly<Record<DateRule['r'], readonly [string, string]>> = {
  fixed: ['{"r":"fixed","month":11,"day":1}', 'calendarDataScheme.date.fixed'],
  easter: ['{"r":"easter","offset":-46}', 'calendarDataScheme.date.easter'],
  advent: ['{"r":"advent","offset":-7}', 'calendarDataScheme.date.advent'],
  'christmas-sunday': ['{"r":"christmas-sunday"}', 'calendarDataScheme.date.christmasSunday'],
  baptism: ['{"r":"baptism"}', 'calendarDataScheme.date.baptism'],
  'nth-weekday': ['{"r":"nth-weekday","n":1,"weekday":5}', 'calendarDataScheme.date.nthWeekday'],
  'sunday-after': ['{"r":"sunday-after","month":1,"day":6}', 'calendarDataScheme.date.sundayAfter']
};
/** Zeilen, deren Satz ein Schlüssel ist — übersetzt beim Schreiben. */
const said = (pairs: readonly (readonly [string, string])[]): [string, string][] => pairs.map(([what, key]) => [what, t(key, { seasons: SEASONS.join(', ') })]);

/** Jede Bedingung mit einem Beispiel — ein `Record`, damit keine fehlt. */
const TEST_ROWS: Readonly<Record<Test['t'], readonly [string, string]>> = {
  weekday: ['{"t":"weekday","days":[3]}', 'calendarDataScheme.test.weekday'],
  slot: ['{"t":"slot","keys":["p1800"]}', 'calendarDataScheme.test.slot'],
  time: ['{"t":"time","from":"17:00","to":"21:00"}', 'calendarDataScheme.test.time'],
  season: ['{"t":"season","seasons":["adwent"]}', 'calendarDataScheme.test.season'],
  week: ['{"t":"week","op":">=","n":2}', 'calendarDataScheme.test.week'],
  rank: ['{"t":"rank","op":"<=","n":12}', 'calendarDataScheme.test.rank'],
  celebration: ['{"t":"celebration","is":"any"}', 'calendarDataScheme.test.celebration'],
  festive: ['{"t":"festive"}', 'calendarDataScheme.test.festive'],
  sunday: ['{"t":"sunday"}', 'calendarDataScheme.test.sunday'],
  date: ['{"t":"date","rule":{"r":"easter","offset":60}}', 'calendarDataScheme.test.date'],
  between: ['{"t":"between","from":"12-24","to":"01-06"}', 'calendarDataScheme.test.between'],
  var: ['{"t":"var","name":"colour","op":"=","value":"biały"}', 'calendarDataScheme.test.var'], // i18n-ignore
  mode: ['{"t":"mode","modes":["single"]}', 'calendarDataScheme.test.mode'],
  count: ['{"t":"count","scope":"occurrence","op":">=","n":1}', 'calendarDataScheme.test.count'],
  actor: ['{"t":"actor","is":"office"}', 'calendarDataScheme.test.actor'],
  field: ['{"t":"field","key":"giver","op":"set"}', 'calendarDataScheme.test.field']
};

/** Ein Datum, das sich jedes Jahr verschiebt — im Kalender der Feste ("when") und in der Bedingung "date". */
export const FLOW_DATE_JSON: JsonNode = {
  key: 'flow.date',
  get title() { return t('calendarDataScheme.node.date.title'); },
  text: () => `${t('calendarDataScheme.node.date.lead')}
${rows(said(Object.values(DATE_ROWS)))}
${t('calendarDataScheme.node.date.tail')}`
};

/** Die Bedingungen des Knotens "if" — in einem Plan und in einer Regel. */
export const FLOW_TEST_JSON: JsonNode = {
  key: 'flow.test',
  get title() { return t('calendarDataScheme.node.test.title'); },
  text: () => `${t('calendarDataScheme.node.test.lead')}
${t('calendarDataScheme.node.test.plan')}
${rows(said(PLAN_TESTS.map((test) => TEST_ROWS[test])))}
${t('calendarDataScheme.node.test.rule')}
${rows(said(RULE_TESTS.map((test) => TEST_ROWS[test])))}`,
  inside: () => [FLOW_DATE_JSON]
};

/** Wie ein Ablauf gespeichert ist — Knoten und Kanten, gleich in Plan und Regel. */
export const FLOW_JSON: JsonNode = {
  key: 'flow',
  get title() { return t('calendarDataScheme.node.flow.title'); },
  text: () => `${t('calendarDataScheme.node.flow.lead')}
${keyLines({
    'nodes[]': t('calendarDataScheme.node.flow.nodes'),
    'edges[]': t('calendarDataScheme.node.flow.edges')
  })}
${t('calendarDataScheme.node.flow.tail')}`
};

/** Die Regel einer Liste: wer etwas einträgt, kommt durch sie. */
export const RULE_FLOW_JSON: JsonNode = {
  key: 'flow.rule',
  get title() { return t('calendarDataScheme.node.rule.title'); },
  text: () => `${t('calendarDataScheme.node.rule.lead')}
${t('calendarDataScheme.node.nodes')}
${nodeLines(RULE_NODES)}
${t('calendarDataScheme.node.rule.data')}`,
  inside: () => [FLOW_JSON, FLOW_TEST_JSON]
};

/** Der Ablauf eines Plans: Tage, ihre Messen, was jede ist. */
export const PLAN_FLOW_JSON: JsonNode = {
  key: 'flow.plan',
  get title() { return t('calendarDataScheme.node.plan.title'); },
  text: () => `${t('calendarDataScheme.node.plan.lead')}
${t('calendarDataScheme.node.nodes')}
${nodeLines(PLAN_NODES)}
${t('calendarDataScheme.node.plan.dataHead')}
${keyLines({
    season: `{"colours":{"adwent":"fioletowy",…}, "special":{"gaudete":"różowy","laetare":"różowy","palm":"czerwony","goodFriday":"czerwony","pentecost":"czerwony"}} — ${t('calendarDataScheme.node.plan.season', { seasons: SEASONS.join(', ') })}`, // i18n-ignore
    feasts: `{"rows":[{"name","when","rank","colour","festive","title","moveIfImpeded"}]} — ${t('calendarDataScheme.node.plan.feasts')}`,
    set: `{"target":"title"|"field"|"var", "key", "value"} — ${t('calendarDataScheme.node.plan.set')}`,
    slots: `{"festive":[{"key","label","time":"HH:MM","minutes"}], "weekdays":[{"key","label","time","minutes","days":[1,…,6]}]} — ${t('calendarDataScheme.node.plan.slots')}`,
    record: `{"list":"intencje","mode":"single","text":"${t('calendarDataScheme.node.plan.recordText')}"} — ${t('calendarDataScheme.node.plan.record')}`,
    'if, skip, end': t('calendarDataScheme.node.plan.ifSkipEnd')
  })}
${t('calendarDataScheme.node.plan.texts')}`,
  inside: () => [FLOW_JSON, FLOW_DATE_JSON, FLOW_TEST_JSON]
};

/** Ein Feld — am Termin, an einem Tag der Serie, an einem Eintrag. */
export const SCHEME_FIELD_JSON: JsonNode = {
  key: 'scheme.field',
  get title() { return t('calendarDataScheme.node.field.title'); },
  text: () => `${keyLines({
    key: t('calendarDataScheme.node.field.key'),
    label: t('calendarDataScheme.node.field.label'),
    type: SCHEME_FIELD_TYPES.map((type) => `"${type}" (${SCHEME_FIELD_LABEL[type]})`).join(', '),
    level: t('calendarDataScheme.node.field.level'),
    public: t('calendarDataScheme.node.field.public'),
    required: t('calendarDataScheme.node.field.required'),
    options: t('calendarDataScheme.node.field.options'),
    unit: t('calendarDataScheme.node.field.unit'),
    onlyKinds: t('calendarDataScheme.node.field.onlyKinds'),
    says: t('calendarDataScheme.node.field.says')
  }, '')}
${t('calendarDataScheme.node.field.tail', { colours: LITURGICAL_COLOURS.map((c) => c.value).join(', ') })}`
};

/** Eine Liste von Einträgen am Termin. */
export const RECORD_LIST_JSON: JsonNode = {
  key: 'scheme.list',
  get title() { return t('calendarDataScheme.node.list.title'); },
  text: () => `${t('calendarDataScheme.node.list.lead')}
${keyLines({
    key: t('calendarDataScheme.node.list.key'),
    label: t('calendarDataScheme.node.field.label'),
    itemLabel: t('calendarDataScheme.node.list.itemLabel'),
    modes: t('calendarDataScheme.node.list.modes'),
    textLabel: t('calendarDataScheme.node.list.textLabel'),
    person: t('calendarDataScheme.node.list.person'),
    fields: t('calendarDataScheme.node.list.fields'),
    outside: t('calendarDataScheme.node.list.outside'),
    onlyKinds: t('calendarDataScheme.node.list.onlyKinds'),
    rule: t('calendarDataScheme.node.list.rule'),
    says: t('calendarDataScheme.node.list.says')
  }, '')}`,
  inside: () => [SCHEME_FIELD_JSON, RULE_FLOW_JSON]
};

/*
 * 2026-10-30 — WAS DIE APP MIT EINEM SCHEMA TUT: Editor und Details eines Termins (`EventEditor.tsx`,
 * `EventDetails.tsx`); offene Werte gehen nur in den offenen Plan und den Bogen (`Calendar.ValuesAsync` publicOnly,
 * `MassParts.tsx`, `sheet.ts`), die anderen liegen unter dem Bereich, der den Termin sieht (`schemeValues.ts`);
 * Listen mit Regel im Browser (`records.ts`, `RecordsPanel.tsx`), wer welche Einträge sieht (`Calendar.Records.cs`),
 * Wartendes an die Kanzlei (`Notify.cs`, `alerts.ts`); die Liste `intencje` (`Mass.cs`); Pläne (`PlanApply.tsx`).
 */
export const SCHEME_USAGE_JSON: JsonNode = {
  key: 'scheme.usage',
  get title() { return t('calendarDataScheme.node.usageTitle'); },
  text: () => t('calendarDataScheme.node.schemeUsage')
};

/*
 * 2026-10-30 — WAS EIN PLAN BEWIRKT: nichts, bis „Zastosuj…" (`PlanApply.tsx`: einzelne Termine aus diesem Browser —
 * Art, Schema, Titel, Werte, feste Einträge „z reguły", `planOrigin`); „już jest" und „Plany do przedłużenia"
 * (`Notify.cs`, `alerts.ts`); versiegelt unter dem eigenen Bereich des Kalenders (`scheme.docAreaOf`).
 */
export const PLAN_USAGE_JSON: JsonNode = {
  key: 'plan.usage',
  get title() { return t('calendarDataScheme.node.usageTitle'); },
  text: () => t('calendarDataScheme.node.planUsage')
};

/** Das Schema — die Wurzel neben seinem Import. */
export const SCHEME_JSON: JsonNode = {
  key: 'scheme',
  get title() { return t('calendarDataScheme.node.scheme.title', { format: SCHEME_FORMAT }); },
  get short() { return t('calendarDataScheme.node.scheme.short'); },
  text: () => `${t('calendarDataScheme.node.scheme.lead')}
${keyLines({
    format: `"${SCHEME_FORMAT}", "version": 1`,
    name: t('calendarDataScheme.node.scheme.name'),
    kind: t('calendarDataScheme.node.scheme.kind', { kinds: ITEM_KINDS.map((k) => `"${k}" (${ITEM_LABEL[k]})`).join(', ') }),
    kinds: t('calendarDataScheme.node.scheme.kinds'),
    publicTitle: t('calendarDataScheme.node.scheme.publicTitle'),
    fields: t('calendarDataScheme.node.scheme.fields'),
    lists: t('calendarDataScheme.node.scheme.lists'),
    says: t('calendarDataScheme.node.scheme.says')
  })}
${t('calendarDataScheme.node.scheme.example')}
${pretty(exportScheme(SCHEME_TEMPLATES.find((one) => one.id === 'spotkanie-zapisy')?.def ?? SCHEME_TEMPLATES[0].def))}`,
  inside: () => [SCHEME_USAGE_JSON, SCHEME_FIELD_JSON, RECORD_LIST_JSON],
  samples: () => SCHEME_TEMPLATES.map((one) => ({ label: t('calendarDataScheme.node.template', { name: one.def.name }), doc: () => exportScheme(one.def) }))
};

/** Der Plan — die Wurzel neben seinem Import. */
export const PLAN_JSON: JsonNode = {
  key: 'plan',
  get title() { return t('calendarDataScheme.node.planRoot.title', { format: PLAN_FORMAT }); },
  get short() { return t('calendarDataScheme.node.planRoot.short'); },
  text: () => `${t('calendarDataScheme.node.planRoot.lead')}
${keyLines({
    format: `"${PLAN_FORMAT}", "version": 1`,
    name: t('calendarDataScheme.node.planRoot.name'),
    schemeId: t('calendarDataScheme.node.planRoot.schemeId'),
    kind: t('calendarDataScheme.node.planRoot.kind'),
    weeks: t('calendarDataScheme.node.planRoot.weeks'),
    flow: t('calendarDataScheme.node.planRoot.flow'),
    says: t('calendarDataScheme.node.planRoot.says')
  })}`,
  inside: () => [PLAN_USAGE_JSON, PLAN_FLOW_JSON],
  samples: () => PLAN_TEMPLATES.map((one) => ({ label: t('calendarDataScheme.node.template', { name: one.def.name }), doc: () => exportPlan(one.def) }))
};
