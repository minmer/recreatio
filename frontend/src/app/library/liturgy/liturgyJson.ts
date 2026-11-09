/**
 * 2026-11-09 — DIE LITURGIA ALS JSON ("recreatio/liturgy", Fassung 1), in der Gestalt aller JSON-Importe der App
 * (documentation/JSON.md): Export, Vorschau, Import und die Beschreibung daneben — derselbe Text für Assistenten (MCP).
 *
 * <code>
 *   { "format": "recreatio/liturgy", "version": 1, "name": "…", "provenance": "…", "entities": [ … ] }
 *   bekannte "id"            AN ORT UND STELLE: nur die genannten Felder ändern sich, null leert eines, der Rest bleibt
 *   unbekannte "id"          neu ("entity_type" und alle Pflichtfelder)
 *   { "id", "remove": true } gelöscht — eine geänderte eingebaute kehrt zur Vorgabe zurück
 * </code>
 *
 * Geprüft wird der ganze Graph danach (`validateEntities`): was ins Leere zeigt oder Verse falsch schneidet, hält den
 * Import an, und die Vorschau nennt jedes. Gespeichert wird in EINEM Zapis (`persistence.ts`). Die Revision zählt die
 * App; Modi, erwartete Revisionen und ein Häkchen für Zatwierdzone gibt es nicht mehr — Zatwierdzone warnt die Vorschau.
 * Das erste Format (`recreatio.liturgy` 1.0/1.1 mit "operations") wird noch gelesen, mit einer Warnung.
 */

import { z } from 'zod';

import { t } from '../../core/i18n';
import { keyLines, pretty, type JsonNode } from '../../core/jsonTree';
import { BUILTINS } from './defaults';
import { canonicalJson, indexOf, validateEntities, type Problem } from './resources';
import { EntitySchema, HOURS, KIND, LAYERS, MAX_IMPORT_CHANGES, SEASONS, type EntityType, type LitEntity } from './schema';

export const LITURGY_FORMAT = 'recreatio/liturgy';
export const LITURGY_VERSION = 1;
/** Das erste Format (2026-11-09, früh): ein Umschlag mit "schema_version", "mode" und "operations". */
const FIRST_FORMAT = 'recreatio.liturgy';

const TYPES = Object.keys(KIND) as EntityType[];
/** Was jede Encja hat — einmal beschrieben, nicht bei jedem Rodzaj. */
const COMMON = ['entity_type', 'id', 'title', 'status', 'source_reference', 'metadata', 'revision', 'remove'] as const;
/** Zählt die App; im Dokument überlesen. */
const APP_KEYS = ['schema_version', 'revision'] as const;
const MAX_REVISION = 1000000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/* -- Hinaus ---------------------------------------------------------------------------------------- */

/** Eine Encja im Dokument: ohne das, was die App zählt; Rodzaj, Kennung und Titel zuerst. */
export function docEntity(e: LitEntity): Record<string, unknown> {
  const { schema_version: _version, revision: _revision, entity_type, id, title, ...rest } = e;
  return { entity_type, id, title, ...rest };
}

export function exportLiturgy(name: string, entities: readonly LitEntity[]): Record<string, unknown> {
  const order = new Map(TYPES.map((type, i) => [type, i]));
  const sorted = [...entities].sort((a, b) => (order.get(a.entity_type) ?? 99) - (order.get(b.entity_type) ?? 99) || a.id.localeCompare(b.id, 'en'));
  return { format: LITURGY_FORMAT, version: LITURGY_VERSION, name, entities: sorted.map(docEntity) };
}

/* -- Herein: lesen --------------------------------------------------------------------------------- */

interface Read { readonly items: readonly unknown[]; readonly provenance: string; readonly warnings: readonly string[] }

/** Das Dokument: unser Umschlag, eine blosse Liste, eine einzelne Encja — oder das erste Format. */
export function readLiturgyDoc(doc: unknown): Read | { error: string } {
  if (Array.isArray(doc)) return { items: doc, provenance: '', warnings: [] };
  if (!isObject(doc)) return { error: t('liturgy.json.err.notFormat', { format: LITURGY_FORMAT }) };
  const provenance = typeof doc.provenance === 'string' ? doc.provenance.trim() : '';
  if (doc.format === FIRST_FORMAT) {
    /* Volle Encjen ändern jetzt nur, was sie nennen; "patch" ist dasselbe, "remove" und "reset_default" sind "remove". */
    const operations = Array.isArray(doc.operations) ? doc.operations : [];
    const items = [
      ...(Array.isArray(doc.entities) ? doc.entities : []),
      ...operations.map((op) => !isObject(op) ? op : op.op === 'patch' ? { ...(isObject(op.patch) ? op.patch : {}), id: op.id } : { id: op.id, remove: true })
    ];
    return { items, provenance, warnings: [t('liturgy.json.warn.firstFormat', { given: FIRST_FORMAT, format: LITURGY_FORMAT })] };
  }
  if (doc.format !== undefined && doc.format !== LITURGY_FORMAT) return { error: t('liturgy.json.err.otherFormat', { given: String(doc.format), format: LITURGY_FORMAT }) };
  if (Array.isArray(doc.entities)) {
    const top: readonly string[] = ['format', 'version', 'name', 'provenance', 'entities'];
    const warnings = Object.keys(doc).filter((key) => !top.includes(key)).map((key) => t('liturgy.json.warn.unknownTop', { key }));
    return { items: doc.entities, provenance, warnings };
  }
  if (doc.format === undefined && (typeof doc.entity_type === 'string' || typeof doc.id === 'string')) return { items: [doc], provenance: '', warnings: [] };
  return { error: t('liturgy.json.err.notFormat', { format: LITURGY_FORMAT }) };
}

/** Kurzformen, wie Menschen und Assistenten sie schreiben: ein Psalm mit "verses", ein Gebet mit "text". */
function shorthand(raw: Record<string, unknown>, isNew: boolean): Record<string, unknown> {
  const r = { ...raw };
  if (isNew) r.title ??= r.canonical_name ?? r.label ?? r.id;
  delete r.canonical_name;
  delete r.label;
  if (r.entity_type === 'psalm_text' || r.entity_type === 'liturgical_text') {
    if (r.entity_type === 'psalm_text') r.resource_type = 'psalm';
    r.entity_type = 'text_resource';
  }
  if (Array.isArray(r.verses)) r.structured_content = r.verses.map((v) => isObject(v) ? { type: 'verse', verse: v.number ?? v.verse, text: v.text } : v);
  if (typeof r.text === 'string') r.structured_content = [{ type: 'paragraph', text: r.text }];
  if (r.numbering !== undefined) r.metadata = { ...(isObject(r.metadata) ? r.metadata : {}), numbering: r.numbering };
  delete r.verses;
  delete r.text;
  delete r.numbering;
  return r;
}

/** Wie die Bibliothek speichert (`cleanData`): leere Werte fallen weg — so ändert ein Rücklauf nichts. */
function clean(r: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).flatMap(([key, value]) => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) return [];
    return [[key, typeof value === 'string' ? value.trimEnd() : value]];
  }));
}

/** Schlüssel, die in JavaScript den Bauplan eines Objekts träfen — irgendwo in einer Encja: angehalten, nie gelesen. */
function unsafeKey(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  for (const [key, child] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return key;
    const below = unsafeKey(child);
    if (below !== null) return below;
  }
  return null;
}

/* -- Herein: planen -------------------------------------------------------------------------------- */

export interface LiturgyPlan {
  readonly create: readonly LitEntity[];
  readonly update: readonly { readonly before: LitEntity; readonly after: LitEntity }[];
  readonly remove: readonly LitEntity[];
  readonly reset: readonly { readonly before: LitEntity; readonly after: LitEntity }[];
  readonly unchanged: number;
  /** Halten den Import an. */
  readonly problems: readonly Problem[];
  readonly warnings: readonly string[];
  readonly lines: readonly string[];
  readonly provenance: string;
}

/** Ein Grund, der den Import anhält — als Zeile der Vorschau. */
export function problemLine(p: Problem): string {
  const what = t(`liturgy.errors.${p.code}`);
  return `${p.id === '' ? '' : `${p.id}: `}${what}${p.detail !== '' && p.detail !== p.id ? ` · ${p.detail}` : ''}`;
}

/**
 * Der Plan: `current` ist, was gilt (eigene und eingebaute, `effectiveEntities`), `owned`, was diese Sammlung gespeichert
 * hat — nur das lässt sich löschen.
 */
export function planLiturgyImport(doc: unknown, current: readonly LitEntity[], owned?: readonly LitEntity[]): LiturgyPlan | { error: string } {
  const read = readLiturgyDoc(doc);
  if ('error' in read) return read;
  const warnings = [...read.warnings];
  const problems: Problem[] = [];
  const existing = indexOf(current);
  const defaults = indexOf(BUILTINS);
  const stored = new Set((owned ?? current.filter((e) => canonicalJson(e) !== canonicalJson(defaults.get(e.id)))).map((e) => e.id));
  const final = new Map(existing);
  const create: LitEntity[] = [];
  const update: { before: LitEntity; after: LitEntity }[] = [];
  const remove: LitEntity[] = [];
  const reset: { before: LitEntity; after: LitEntity }[] = [];
  const seen = new Set<string>();
  let unchanged = 0;

  const parse = (record: Record<string, unknown>, id: string): LitEntity | null => {
    const parsed = EntitySchema.safeParse(record);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) problems.push({ code: 'schema', id, detail: `${issue.path.join('.')}: ${issue.message}` });
    return null;
  };
  /* Felder, die es beim Rodzaj nicht gibt: gewarnt und weggelassen, wie in jedem Import der App. */
  const known = (type: unknown, given: Record<string, unknown>, id: string): Record<string, unknown> => {
    const shape = EntitySchema.options.find((o) => o.shape.entity_type.value === type)?.shape;
    if (shape === undefined) return given;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(given)) {
      if (key in shape) out[key] = value;
      else warnings.push(t('liturgy.json.warn.unknownField', { id, key }));
    }
    return out;
  };

  read.items.forEach((raw, at) => {
    if (!isObject(raw)) { warnings.push(t('liturgy.json.warn.notObject', { n: at + 1 })); return; }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (id === '') { warnings.push(t('liturgy.json.warn.noId', { n: at + 1 })); return; }
    if (seen.has(id)) { problems.push({ code: 'duplicate_id', id, detail: '' }); return; }
    seen.add(id);
    const unsafe = unsafeKey(raw);
    if (unsafe !== null) { problems.push({ code: 'schema', id, detail: unsafe }); return; }
    const before = existing.get(id);

    if (raw.remove === true) {
      if (before === undefined) { warnings.push(t('liturgy.json.warn.nothingToRemove', { id })); return; }
      if (!stored.has(id)) { problems.push({ code: 'default_readonly', id, detail: '' }); return; }
      const builtin = defaults.get(id);
      if (builtin !== undefined) { reset.push({ before, after: builtin }); final.set(id, builtin); }
      else { remove.push(before); final.delete(id); }
      return;
    }

    const given = shorthand(raw, before === undefined);
    delete given.remove;
    for (const key of APP_KEYS) delete given[key];
    for (const key of Object.keys(given)) if (key.startsWith('_')) { warnings.push(t('liturgy.json.warn.internal', { id, key })); delete given[key]; }

    if (before !== undefined) {
      if (given.entity_type !== undefined && given.entity_type !== before.entity_type) {
        problems.push({ code: 'other_type', id, detail: `${before.entity_type} ≠ ${String(given.entity_type)}` });
        return;
      }
      /* An Ort und Stelle: was das Dokument nennt, ersetzt; null leert; der Rest bleibt. */
      const merged: Record<string, unknown> = { ...before };
      for (const [key, value] of Object.entries(known(before.entity_type, given, id))) {
        if (key === 'id' || key === 'entity_type') continue;
        if (value === null) delete merged[key]; else merged[key] = value;
      }
      const parsed = parse({ ...clean(merged), schema_version: '1.0', revision: before.revision }, id);
      if (parsed === null) return;
      if (canonicalJson(parsed) === canonicalJson(before)) { unchanged += 1; return; }
      if (before.revision >= MAX_REVISION) { problems.push({ code: 'schema', id, detail: `revision ≤ ${MAX_REVISION}` }); return; } // i18n-ignore — technical detail
      const after = { ...parsed, revision: before.revision + 1 } as LitEntity;
      update.push({ before, after });
      final.set(id, after);
      if (before.status === 'approved') warnings.push(t('liturgy.json.warn.approved', { title: before.title, id }));
      return;
    }

    if (typeof given.entity_type !== 'string' || !TYPES.includes(given.entity_type as EntityType)) {
      problems.push({ code: 'schema', id, detail: `entity_type: ${TYPES.join(' | ')}` }); // i18n-ignore — the key and its values
      return;
    }
    const fresh = Object.fromEntries(Object.entries(known(given.entity_type, given, id)).filter(([, v]) => v !== null));
    const parsed = parse({ ...clean(fresh), schema_version: '1.0' }, id);
    if (parsed === null) return;
    create.push(parsed);
    final.set(id, parsed);
  });

  problems.push(...validateEntities([...final.values()]));
  const changes = create.length + update.length + remove.length + reset.length;
  if (changes > MAX_IMPORT_CHANGES) problems.push({ code: 'batch_limit', id: '', detail: String(MAX_IMPORT_CHANGES) });

  const lines: string[] = [];
  if (changes === 0) lines.push(t('liturgy.json.line.nothing'));
  else {
    lines.push(t('liturgy.json.line.counts', { created: create.length, updated: update.length, removed: remove.length, reset: reset.length, unchanged }));
    const byType = TYPES.map((type) => [type, [...create, ...update.map((u) => u.after)].filter((e) => e.entity_type === type).length] as const).filter(([, n]) => n > 0);
    if (byType.length > 0) lines.push(byType.map(([type, n]) => `${t(`liturgy.types.${type}`)}: ${n}`).join(' · '));
    for (const e of remove) lines.push(t('liturgy.json.line.removed', { title: e.title, id: e.id }));
    for (const r of reset) lines.push(t('liturgy.json.line.reset', { title: r.after.title, id: r.after.id }));
  }
  return { create, update, remove, reset, unchanged, problems, warnings, lines, provenance: read.provenance };
}

/* -- Die Beschreibung ------------------------------------------------------------------------------ */

interface Prop { readonly enum?: readonly unknown[]; readonly default?: unknown; readonly items?: Prop }

/** Was das Schema über ein Feld weiss: Pflicht, erlaubte Werte, Vorgabe — an den Satz gehängt. */
function facts(prop: Prop, required: boolean): string {
  const values = prop.enum ?? prop.items?.enum;
  const parts = [
    required ? t('liturgy.json.required') : '',
    values === undefined ? '' : values.map((v) => JSON.stringify(v)).join(' | '),
    prop.default === undefined || typeof prop.default === 'object' ? '' : t('liturgy.json.byDefault', { value: JSON.stringify(prop.default) })
  ].filter((x) => x !== '');
  return parts.length === 0 ? '' : ` (${parts.join('; ')})`;
}

/** Die eigenen Felder eines Rodzaj (ohne die gemeinsamen), mit ihren Sätzen. */
export function typeFields(type: EntityType): Record<string, string> {
  const schema = EntitySchema.options.find((o) => o.shape.entity_type.value === type)!;
  /* Wie ein Dokument es schreibt (`io: input`): ein Feld mit Vorgabe ist keine Pflicht. */
  const json = z.toJSONSchema(schema, { io: 'input' }) as { properties?: Record<string, Prop>; required?: readonly string[] };
  const out: Record<string, string> = {};
  for (const [key, prop] of Object.entries(json.properties ?? {})) {
    if ((COMMON as readonly string[]).includes(key) || key === 'schema_version') continue;
    out[key] = `${t(`liturgy.json.field.${key}`)}${facts(prop, json.required?.includes(key) === true)}`;
  }
  return out;
}

const listed = (keys: readonly string[], group: string, values: Readonly<Record<string, string>> = {}): Record<string, string> =>
  Object.fromEntries(keys.map((key) => [key, t(`liturgy.json.${group}.${key}`, values[key] === undefined ? undefined : { values: values[key]! })]));

export const BLOCK_KEYS = ['type', 'text', 'verse', 'speaker', 'emphasis'] as const;
export const RANGE_KEYS = ['start_verse', 'end_verse'] as const;
export const REF_KEYS = ['id', 'type'] as const;
export const SLOT_KEYS = ['name', 'label', 'required', 'conditions', 'resource_ref', 'source_order'] as const;
export const CONDITION_KEYS = ['dates', 'seasons', 'weekdays', 'psalter_weeks', 'weeks', 'observances', 'commemorations', 'scopes', 'hours', 'sunday_cycles', 'weekday_cycles', 'vespers', 'psalmody', 'common', 'te_deum', 'after_invitatory', 'edition_id', 'language', 'office_cycle', 'from', 'until'] as const;
export const DATE_RULES = ['fixed', 'easter', 'advent', 'christmas-sunday', 'baptism', 'nth-weekday', 'sunday-after', 'date'] as const;
export const RULE_ACTIONS = ['date_override', 'transfer', 'replace', 'omit'] as const;

const quoted = (list: readonly string[]): string => list.map((x) => `"${x}"`).join(', ');

/** Ein kleines, stimmiges Beispiel: Wydanie, Psalm 117 (zwei Verse, Text erfunden), Fragment, Antyfona, Przypisanie, Fest. */
export const liturgySample = () => ({
  format: LITURGY_FORMAT,
  version: LITURGY_VERSION,
  provenance: t('liturgy.json.sample.provenance'),
  entities: [
    { entity_type: 'text_edition', id: 'sample.edition', title: t('liturgy.json.sample.edition'), language: 'pl-PL', license: t('liturgy.json.sample.license'), permitted_usage: ['private', 'print'] },
    { entity_type: 'canonical_work', id: 'sample.psalm117', title: t('liturgy.json.sample.work'), work_type: 'psalm', numbering_systems: { hebrew: 117, vulgate: 116 } },
    {
      entity_type: 'text_resource', id: 'sample.psalm117.text', title: t('liturgy.json.sample.text'), resource_type: 'psalm', work_id: 'sample.psalm117', edition_id: 'sample.edition',
      language: 'pl-PL', complete: true, expected_verses: 2,
      structured_content: [{ type: 'verse', verse: 1, text: t('liturgy.json.sample.verse', { n: 1 }) }, { type: 'verse', verse: 2, text: t('liturgy.json.sample.verse', { n: 2 }) }]
    },
    { entity_type: 'passage_definition', id: 'sample.psalm117.v1', title: t('liturgy.json.sample.passage'), work_id: 'sample.psalm117', edition_id: 'sample.edition', ranges: [{ start_verse: 1, end_verse: 1 }] },
    { entity_type: 'text_resource', id: 'sample.antiphon', title: t('liturgy.json.sample.antiphonTitle'), resource_type: 'antiphon', edition_id: 'sample.edition', language: 'pl-PL', complete: true, structured_content: [{ type: 'paragraph', text: t('liturgy.json.sample.antiphon') }] },
    {
      entity_type: 'liturgical_assignment', id: 'sample.lauds.monday', title: t('liturgy.json.sample.assignment'), slot_name: 'psalmody.1', resource_ref: { id: 'sample.psalm117.text' },
      antiphon_ref: 'sample.antiphon', source_layer: 'psalter', target_context: { hours: ['lauds'], weekdays: [1], psalter_weeks: [1] }, authority_reference: t('liturgy.json.sample.authority')
    },
    {
      entity_type: 'calendar_observance', id: 'sample.patron', title: t('liturgy.json.sample.observance'), precedence_class: 4, liturgical_rank: 'solemnity',
      date_rule: { r: 'fixed', month: 9, day: 29 }, calendar_scope: 'parish.sample', liturgical_color: 'white', first_vespers: true, authority_reference: t('liturgy.json.sample.authority')
    }
  ]
});

const typeNode = (type: EntityType): JsonNode => ({
  key: `liturgy:${type}`,
  get title() { return `"${type}" — ${t(`liturgy.types.${type}`)}`; },
  get short() { return t(`liturgy.types.${type}`); },
  text: () => `${t(`liturgy.json.type.${type}`)}\n${keyLines(typeFields(type))}`
});

const PARTS_JSON: JsonNode = {
  key: 'liturgy.parts',
  get title() { return t('liturgy.json.parts.title'); },
  text: () => [
    t('liturgy.json.parts.block'), keyLines(listed(BLOCK_KEYS, 'block')),
    '', t('liturgy.json.parts.range'), keyLines(listed(RANGE_KEYS, 'range')),
    '', t('liturgy.json.parts.ref'), keyLines(listed(REF_KEYS, 'ref')),
    '', t('liturgy.json.parts.slot'), keyLines(listed(SLOT_KEYS, 'slot', { source_order: quoted(LAYERS) })),
    '', t('liturgy.json.parts.conditions'), keyLines(listed(CONDITION_KEYS, 'cond', { seasons: quoted(SEASONS), hours: quoted(HOURS) })),
    '', t('liturgy.json.parts.date'), ...DATE_RULES.map((r) => `  ${t(`liturgy.json.date.${r}`)}`),
    '', t('liturgy.json.parts.action'), ...RULE_ACTIONS.map((a) => `  ${t(`liturgy.json.action.${a}`)}`)
  ].join('\n')
};

/** Was die App mitbringt — Kennungen, auf die ein Dokument zeigen darf (und die es ändern kann). */
const BUILTINS_JSON: JsonNode = {
  key: 'liturgy.builtins',
  get title() { return t('liturgy.json.builtins.title'); },
  text: () => {
    const lines = [t('liturgy.json.builtins.intro'), '', t('liturgy.json.builtins.observances')];
    for (const e of BUILTINS) if (e.entity_type === 'calendar_observance') lines.push(`  "${e.id}" — ${e.title} (${e.precedence_class}, ${e.calendar_scope})`);
    lines.push('', t('liturgy.json.builtins.rules'));
    for (const e of BUILTINS) if (e.entity_type === 'liturgical_rule') lines.push(`  "${e.id}" — ${e.action.type}${'observance_id' in e.action ? ` "${e.action.observance_id}"` : ''}`);
    lines.push('', t('liturgy.json.builtins.templates'));
    for (const e of BUILTINS) if (e.entity_type === 'liturgical_template') lines.push(`  "${e.id}" (${e.hour_or_rite}): ${e.slots.map((s) => s.name).join(', ')}`);
    return lines.join('\n');
  }
};

/* Jak aplikacja używa tych danych — nur, was der Code tut (Liturgia, Cogita als Quelle, Dostęp dla AI). */
const USAGE_JSON: JsonNode = {
  key: 'liturgy.usage',
  get title() { return t('liturgy.json.usage.title'); },
  text: () => t('liturgy.json.usage.text')
};

export const LITURGY_JSON: JsonNode = {
  key: 'liturgy',
  get title() { return t('liturgy.json.title', { format: LITURGY_FORMAT, version: LITURGY_VERSION }); },
  get short() { return t('liturgy.name'); },
  text: () => `${t('liturgy.json.intro')}

${t('liturgy.json.doc')}
${keyLines({ format: `"${LITURGY_FORMAT}"`, version: `${LITURGY_VERSION}`, name: t('liturgy.json.top.name'), provenance: t('liturgy.json.top.provenance'), entities: t('liturgy.json.top.entities') })}

${t('liturgy.json.entity')}
${keyLines(Object.fromEntries(COMMON.map((key) => [key, t(`liturgy.json.common.${key}`)])))}

${t('liturgy.json.rules')}

${t('liturgy.json.example')}
${pretty(liturgySample())}`,
  inside: () => [...TYPES.map(typeNode), PARTS_JSON, BUILTINS_JSON, USAGE_JSON],
  samples: () => [{ get label() { return t('liturgy.json.sampleLabel'); }, doc: liturgySample }]
};

/** Die gemeinsamen Schlüssel, die die Beschreibung erklärt — für die Prüfung. */
export const LITURGY_COMMON_KEYS: readonly string[] = COMMON;
