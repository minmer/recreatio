/** Versioned, strict import contract. The same schema validates imports and generates JSON Schema. */
import { z } from 'zod';
import { isLiturgyKind, KIND as KIND_NAMES } from './names';

export const HOURS = ['invitatory', 'readings', 'lauds', 'terce', 'sext', 'none', 'vespers', 'compline', 'mass'] as const;
export const LAYERS = ['psalter', 'time', 'saints', 'common', 'ordinary', 'lectionary', 'local'] as const;
export const SEASONS = ['advent', 'christmas', 'ordinary', 'lent', 'holy_week', 'triduum', 'easter_octave', 'easter'] as const;
const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = z.string().min(1).max(200000);
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const base = {
  schema_version: z.literal('1.0'), id, title: text, revision: integer(1, 1000000).default(1),
  status: z.enum(['draft', 'approved', 'incomplete']).default('draft'), source_reference: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.json()).optional()
};
const range = z.strictObject({ start_verse: integer(1, 100000), end_verse: integer(1, 100000) });
const ref = z.strictObject({ id, type: z.enum(['text_resource', 'psalm_passage', 'passage_definition', 'liturgical_text']).optional() });
const conditions = z.strictObject({
  dates: z.array(date).max(400).optional(), seasons: z.array(z.enum(SEASONS)).optional(), weekdays: z.array(integer(1, 7)).optional(),
  psalter_weeks: z.array(integer(1, 4)).optional(), weeks: z.array(integer(0, 34)).optional(),
  observances: z.array(id).optional(), commemorations: z.array(id).optional(), scopes: z.array(id).optional(), hours: z.array(z.enum(HOURS)).optional(),
  sunday_cycles: z.array(z.enum(['A', 'B', 'C'])).optional(), weekday_cycles: z.array(z.enum(['I', 'II'])).optional(),
  vespers: z.enum(['first', 'second']).optional(), psalmody: z.enum(['current', 'complementary']).optional(),
  common: id.optional(), te_deum: z.boolean().optional(), after_invitatory: z.boolean().optional(),
  edition_id: id.optional(), language: z.string().max(80).optional(), office_cycle: z.string().max(40).optional(),
  from: date.optional(), until: date.optional()
});
export const DateRuleSchema = z.discriminatedUnion('r', [
  z.strictObject({ r: z.literal('fixed'), month: integer(1, 12), day: integer(1, 31) }),
  z.strictObject({ r: z.literal('easter'), offset: integer(-100, 200) }),
  z.strictObject({ r: z.literal('advent'), offset: integer(-100, 50) }),
  z.strictObject({ r: z.literal('christmas-sunday') }), z.strictObject({ r: z.literal('baptism') }),
  z.strictObject({ r: z.literal('nth-weekday'), n: z.union([z.literal(-1), integer(1, 5)]), weekday: integer(1, 7), month: integer(1, 12).optional() }),
  z.strictObject({ r: z.literal('sunday-after'), month: integer(1, 12), day: integer(1, 31) }),
  z.strictObject({ r: z.literal('date'), date })
]);
export const BlockSchema = z.strictObject({
  type: z.enum(['verse', 'paragraph', 'stanza', 'response', 'rubric', 'heading']), text,
  verse: integer(1, 100000).optional(), speaker: z.string().max(120).optional(),
  emphasis: z.enum(['italic', 'bold']).optional()
});
const work = z.strictObject({ ...base, entity_type: z.literal('canonical_work'), work_type: id,
  alternative_names: z.array(text).optional(), numbering_systems: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])).optional(), biblical_book_id: id.optional(),
  library_entry_id: z.string().uuid().optional()
});
const edition = z.strictObject({ ...base, entity_type: z.literal('text_edition'), language: text,
  publisher: z.string().optional(), translator: z.string().optional(), edition: z.string().optional(), publication_year: integer(1, 9999).optional(),
  copyright_holder: z.string().optional(), license: text, permitted_usage: z.array(z.enum(['private', 'print', 'share'])).min(1),
  library_entry_id: z.string().uuid().optional()
});
const resource = z.strictObject({ ...base, entity_type: z.literal('text_resource'), resource_type: id, work_id: id.optional(), edition_id: id,
  language: text, structured_content: z.array(BlockSchema).min(1).max(10000), source_citation: z.string().optional(), attribution: z.string().optional(),
  complete: z.boolean().default(false), expected_verses: integer(1, 100000).optional()
});
const passage = z.strictObject({ ...base, entity_type: z.literal('passage_definition'), work_id: id, edition_id: id,
  resource_id: id.optional(), ranges: z.array(range).min(1).max(200), numbering_system: z.string().optional(),
  omitted_verses: z.array(integer(1, 100000)).optional(), authority_reference: z.string().optional()
});
const template = z.strictObject({ ...base, entity_type: z.literal('liturgical_template'), hour_or_rite: z.enum(HOURS),
  applicability: conditions.default({}), priority: integer(-10000, 10000).default(0),
  slots: z.array(z.strictObject({ name: id, label: text, required: z.boolean().default(true), conditions: conditions.default({}),
    resource_ref: ref.optional(), source_order: z.array(z.enum(LAYERS)).min(1).optional() })).min(1).max(200),
  authority_reference: text
});
const observance = z.strictObject({ ...base, entity_type: z.literal('calendar_observance'),
  precedence_class: integer(1, 13), liturgical_rank: z.enum(['solemnity', 'feast', 'memorial', 'optional', 'day']),
  date_rule: DateRuleSchema, calendar_scope: id, liturgical_color: z.enum(['white', 'red', 'violet', 'green', 'rose', 'black']),
  common_type: id.optional(), first_vespers: z.boolean().default(false), replaces: id.optional(),
  proper_references: z.array(id).optional(), authority_reference: text
});
const assignment = z.strictObject({ ...base, entity_type: z.literal('liturgical_assignment'), target_context: conditions.default({}),
  slot_name: id, resource_ref: ref, antiphon_ref: id.optional(), priority: integer(-10000, 10000).default(0),
  source_layer: z.enum(LAYERS), authority_reference: text, fallback_refs: z.array(ref).max(20).optional()
});
const rule = z.strictObject({ ...base, entity_type: z.literal('liturgical_rule'), conditions: conditions.default({}),
  applicable_calendar: id, authority_reference: text, priority: integer(-10000, 10000).default(0),
  action: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('date_override'), observance_id: id, date_rule: DateRuleSchema, year: integer(1583, 4099).optional() }),
    z.strictObject({ type: z.literal('transfer'), observance_id: id, strategy: z.enum(['next_free', 'previous_free']),
      max_days: integer(1, 60), earliest: DateRuleSchema.optional(), latest: DateRuleSchema.optional() }),
    z.strictObject({ type: z.literal('replace'), slot_name: id, resource_ref: ref }),
    z.strictObject({ type: z.literal('omit'), slot_name: id })
  ])
});
const calendar = z.strictObject({ ...base, entity_type: z.literal('calendar_profile'), scopes: z.array(id).min(1).max(20),
  time_zone: text, country: z.enum(['PL', 'roman']), language: text, edition_id: id.optional(), office_cycle: z.string().optional(),
  coverage: z.enum(['partial', 'reviewed']), reviewed_from: date.optional(), reviewed_until: date.optional(), authority_reference: text
});
export const EntitySchema = z.discriminatedUnion('entity_type', [work, edition, resource, passage, template, observance, assignment, rule, calendar]);
export const MAX_IMPORT_ENTITIES = 50000;
// Reserve one of LibraryStore's 5000 atomic operations for the import receipt.
export const MAX_IMPORT_CHANGES = 4999;
const operationBase = { id, expected_revision: integer(1, 1000000) };
export const OperationSchema = z.discriminatedUnion('op', [
  z.strictObject({ ...operationBase, op: z.literal('patch'), patch: z.record(z.string(), z.json()) }),
  z.strictObject({ ...operationBase, op: z.literal('remove') }),
  z.strictObject({ ...operationBase, op: z.literal('reset_default') })
]);
export const BatchSchema = z.strictObject({ format: z.literal('recreatio.liturgy'), schema_version: z.enum(['1.0', '1.1']),
  mode: z.enum(['add', 'update']).optional(), entities: z.array(EntitySchema).max(MAX_IMPORT_ENTITIES).default([]),
  operations: z.array(OperationSchema).max(MAX_IMPORT_ENTITIES).default([]), provenance: z.string().max(4000).optional() });
export const ImportSchema = z.union([EntitySchema, BatchSchema]);
export const jsonSchema = () => z.toJSONSchema(ImportSchema);
export type LitEntity = z.infer<typeof EntitySchema>;
export type ImportOperation = z.infer<typeof OperationSchema>;
export type EntityType = LitEntity['entity_type'];
export type OfType<T extends EntityType> = Extract<LitEntity, { entity_type: T }>;
export type TextBlock = z.infer<typeof BlockSchema>;
export type Conditions = z.infer<typeof conditions>;
export type DateRule = z.infer<typeof DateRuleSchema>;
export type Hour = typeof HOURS[number];
export type Season = typeof SEASONS[number];
export type SourceLayer = typeof LAYERS[number];
export type ResourceRef = z.infer<typeof ref>;
export type CalendarContext = { scopes: readonly string[]; country: 'PL' | 'roman'; time_zone: string; language: string; edition_id?: string; office_cycle?: string; optional_observance?: string };
export const DEFAULT_CONTEXT: CalendarContext = { scopes: ['roman', 'PL'], country: 'PL', time_zone: 'Europe/Warsaw', language: 'pl-PL' };
/* Die Arten stehen in `names.ts` (ohne zod); fehlt dort ein Rodzaj des Schemas, scheitert schon diese Zuweisung. */
export const KIND: Readonly<Record<EntityType, string>> = KIND_NAMES;
export { isLiturgyKind };
