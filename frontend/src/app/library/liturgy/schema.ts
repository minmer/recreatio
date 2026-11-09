/**
 * Die neun Rodzaje der Liturgia, streng (zod): so gespeichert, so geprüft — und daraus die Felder der Beschreibung
 * (`liturgyJson.ts`). Gespeichert trägt jede Encja `schema_version` und ihre `revision`; beides zählt die App.
 *
 * 2026-11-09 (2.0) — EIN BRZMIENIE, ZWEI ANSICHTEN: ein Text hat genau ein `text` (das ganze Brzmienie in seiner Ausgabe,
 * mit natürlicher Zeichensetzung und Absätzen). Alles Weitere — Verse und ihre Nummern, Pausen (* und †), Zeilen und
 * Strophen, Rollen (K./W.), Teile, Kreuzzeichen — ist STRUKTUR: Einheiten über Zeichenstellen des Brzmienie (`layout`),
 * bezeugte andere Teilungen (`layouts`), die Folge des Vortrags mit Wiederholungen als Verweise (`performance`), Hinweise
 * (`notes`: Überschriften, Rubriken, Quellen) und bezeugte Varianten (`variants`: Schlüsse, Doxologien). Jede Teilung
 * trägt die Fassung des Brzmienie, für die sie gemacht ist (`on` = `text_version`) — ändert sich der Text, fällt sie auf,
 * statt sich still zu verschieben. Gespeichertes 1.0 (`structured_content`) liest `migrate.ts` beim Laden um.
 */
import { z } from 'zod';
import { isLiturgyKind, KIND as KIND_NAMES } from './names';

export const HOURS = ['invitatory', 'readings', 'lauds', 'terce', 'sext', 'none', 'vespers', 'compline', 'mass'] as const;
export const LAYERS = ['psalter', 'time', 'saints', 'common', 'ordinary', 'lectionary', 'local'] as const;
export const SEASONS = ['advent', 'christmas', 'ordinary', 'lent', 'holy_week', 'triduum', 'easter_octave', 'easter'] as const;
/** Was ein Text ist — bestimmt Prüfung und Darstellung (Verszeilen, Strophen oder Prosa). */
export const RESOURCE_TYPES = ['antiphon', 'hymn', 'psalm', 'canticle', 'reading', 'responsory', 'dialog', 'versicle', 'intercessions', 'response', 'prayer', 'doxology', 'blessing', 'rubric', 'other'] as const;
/** Wer spricht: Vorsteher, Kantor (K.), Lektor, alle (W.), Chorhälften. */
export const ROLES = ['presider', 'cantor', 'reader', 'all', 'choir1', 'choir2'] as const;
/** Wie eine Einheit endet: Mediante (*), Flexa (†), Zeile, Vers, Strophe, Teil. */
export const ENDS = ['mediant', 'flex', 'line', 'verse', 'stanza', 'part'] as const;
/** Was eine Einheit im Text ist (Bitten, Schluss eines Gebets, Incipit …). */
export const UNIT_KINDS = ['intro', 'petition', 'petition_response', 'response', 'body', 'conclusion', 'incipit', 'title'] as const;
export const NOTE_TYPES = ['heading', 'subtitle', 'sentence', 'rubric', 'source', 'part'] as const;
export const ANTIPHON_REPEATS = ['around', 'before', 'after', 'strophes', 'none'] as const;
const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = z.string().min(1).max(200000);
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Die Fassung eines Brzmienie (`text.ts` `textVersion`) — woran eine Teilung erkennt, dass sich ihr Text geändert hat. */
const version = z.string().regex(/^v[0-9a-f]{16}$/);
const base = {
  schema_version: z.enum(['1.0', '2.0']), id, title: text, revision: integer(1, 1000000).default(1),
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
/** 1.0: ein Text in Blöcken — nur noch beim Lesen alter Daten (`migrate.ts`). */
export const BlockSchema = z.strictObject({
  type: z.enum(['verse', 'paragraph', 'stanza', 'response', 'rubric', 'heading']), text,
  verse: integer(1, 100000).optional(), speaker: z.string().max(120).optional(),
  emphasis: z.enum(['italic', 'bold']).optional()
});
/** Eine Einheit: Zeichen [at, to) des Brzmienie, und was sie im Vortrag ist. */
export const UnitSchema = z.strictObject({
  at: integer(0, 5000000), to: integer(1, 5000000), id: id.optional(),
  /** Innere Nummer (stabil, für Verweise und Bereiche); `label`: wie die Ausgabe zählt („2a", „116"). */
  verse: integer(1, 100000).optional(), label: z.string().min(1).max(40).optional(),
  end: z.enum(ENDS).optional(), role: z.enum(ROLES).optional(), kind: z.enum(UNIT_KINDS).optional(),
  cross: z.boolean().optional(), style: z.enum(['italic', 'bold']).optional()
});
const layoutSchema = z.strictObject({ on: version, units: z.array(UnitSchema).min(1).max(50000) });
const altLayout = z.strictObject({ id, title: z.string().max(400).optional(), source: z.string().max(4000).optional(), on: version, units: z.array(UnitSchema).min(1).max(50000) });
/** Ein Schritt des Vortrags: Einheiten dieses Texts (`say`), ein anderer Text (`resource`, wahlweise seine Einheiten), oder eine Rubrik. */
const StepSchema = z.strictObject({
  say: z.array(id).min(1).max(100).optional(), resource: id.optional(), units: z.array(id).max(100).optional(),
  role: z.enum(ROLES).optional(), rubric: z.string().min(1).max(4000).optional()
});
const NoteSchema = z.strictObject({ type: z.enum(NOTE_TYPES), text, at: id.default('start'), source: z.string().max(4000).optional() });
const work = z.strictObject({ ...base, entity_type: z.literal('canonical_work'), work_type: id,
  alternative_names: z.array(text).optional(), numbering_systems: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])).optional(), biblical_book_id: id.optional(),
  library_entry_id: z.string().uuid().optional()
});
const edition = z.strictObject({ ...base, entity_type: z.literal('text_edition'), language: text,
  publisher: z.string().optional(), translator: z.string().optional(), edition: z.string().optional(), publication_year: integer(1, 9999).optional(),
  copyright_holder: z.string().optional(), license: text, permitted_usage: z.array(z.enum(['private', 'print', 'share'])).min(1),
  library_entry_id: z.string().uuid().optional()
});
const resource = z.strictObject({ ...base, entity_type: z.literal('text_resource'), resource_type: z.enum(RESOURCE_TYPES), work_id: id.optional(), edition_id: id,
  language: text,
  /** Das ganze Brzmienie — ein Mal; Absätze mit einer Leerzeile. */
  text: z.string().min(1).max(2000000), text_version: version,
  layout: layoutSchema.optional(), layouts: z.array(altLayout).max(20).optional(),
  performance: z.array(StepSchema).max(500).optional(), notes: z.array(NoteSchema).max(200).optional(),
  /** Lesung: woher (Herkunftszeile), Stelle, Incipit (eigener Text oder eine Einheit des Brzmienie), Einleitungsformel. */
  origin: z.string().max(4000).optional(), reference: z.string().max(400).optional(),
  incipit: z.union([z.strictObject({ text }), z.strictObject({ unit: id })]).optional(), intro_formula: z.string().max(400).optional(),
  /** Bezeugte Varianten: eine Einheit (oder das Ganze) anders, wahlweise unter Bedingungen (z. B. der kurze Schluss). */
  variants: z.array(z.strictObject({ id, replaces: id.optional(), text, when: conditions.optional(), source: z.string().max(4000).optional() })).max(50).optional(),
  /** Die Antwort der Gemeinde (Amen, der Ruf der Bitten) — ein eigener, wiederverwendbarer Text. */
  response_ref: id.optional(),
  /** Psalm/Canticum: „Ehre sei dem Vater" danach (Vorgabe) oder bezeugt nicht; welcher Text. */
  doxology: z.enum(['after', 'none']).optional(), doxology_ref: id.optional(),
  variant_group: id.optional(), aliases: z.array(id).max(200).optional(), missing: z.array(z.string().min(1).max(80)).max(40).optional(),
  numbering: z.string().max(80).optional(), biblical_reference: z.string().max(400).optional(),
  source_citation: z.string().optional(), attribution: z.string().optional(),
  complete: z.boolean().default(false), expected_verses: integer(1, 100000).optional()
});
const passage = z.strictObject({ ...base, entity_type: z.literal('passage_definition'), work_id: id, edition_id: id,
  resource_id: id.optional(), ranges: z.array(range).min(1).max(200), numbering_system: z.string().optional(),
  omitted_verses: z.array(integer(1, 100000)).optional(), authority_reference: z.string().optional(),
  /** Ein benannter Podział (z. B. „dwie części", „Ps 119 — 22 części") und welcher Teil dieser ist. */
  division: z.string().min(1).max(120).optional(), part: z.string().min(1).max(80).optional(), order: integer(0, 10000).optional(),
  /** Die Fassung des Quelltexts, für die die Bereiche gelten. */
  on: version.optional()
});
const template = z.strictObject({ ...base, entity_type: z.literal('liturgical_template'), hour_or_rite: z.enum(HOURS),
  applicability: conditions.default({}), priority: integer(-10000, 10000).default(0),
  slots: z.array(z.strictObject({ name: id, label: text, required: z.boolean().default(true), conditions: conditions.default({}),
    resource_ref: ref.optional(), source_order: z.array(z.enum(LAYERS)).min(1).optional(),
    /** Nach diesem Platz „Ehre sei dem Vater" (Psalmen, Cantica); Antiphon-Wiederkehr als Vorgabe (Invitatorium: nach Strophen). */
    doxology: z.boolean().optional(), antiphon_repeat: z.enum(ANTIPHON_REPEATS).optional() })).min(1).max(200),
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
  source_layer: z.enum(LAYERS), authority_reference: text, fallback_refs: z.array(ref).max(20).optional(),
  /** Welche bezeugte Teilung der Antiphon, wo sie wiederkehrt, ob „Ehre sei dem Vater" folgt, welche Teilung des Haupttexts. */
  antiphon_layout: id.optional(), antiphon_repeat: z.enum(ANTIPHON_REPEATS).optional(), doxology: z.boolean().optional(), main_layout: id.optional()
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
/* Ein Import ist ein Zapis (`LibraryStore.saveAll`, höchstens 5000) — einer davon ist die Quittung. Das Dokument: `liturgyJson.ts`. */
export const MAX_IMPORT_CHANGES = 4999;
export type LitEntity = z.infer<typeof EntitySchema>;
export type EntityType = LitEntity['entity_type'];
export type OfType<T extends EntityType> = Extract<LitEntity, { entity_type: T }>;
export type TextBlock = z.infer<typeof BlockSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Role = typeof ROLES[number];
export type End = typeof ENDS[number];
export type ResourceType = typeof RESOURCE_TYPES[number];
export type TextResource = Extract<z.infer<typeof EntitySchema>, { entity_type: 'text_resource' }>;
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
