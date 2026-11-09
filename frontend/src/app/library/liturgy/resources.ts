/** Canonical identities, dependency validation, and passage resolution. No calendar decisions here. */
import { EntitySchema, ImportSchema, KIND, type LitEntity, type OfType, type TextBlock } from './schema';
import type { LibEntry } from '../libraryKinds';
import { isDate } from '../../calendar/flow/liturgy';

export interface Problem { code: string; id: string; detail: string }
export const canonicalJson = (value: unknown): string => JSON.stringify(sort(value));
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => [k, sort(v)]));
  return value;
}
export const entitiesOf = (entries: readonly LibEntry[]): LitEntity[] => entries.flatMap(e => {
  if (!Object.values(KIND).includes(e.kind)) return [];
  const data = Object.fromEntries(Object.entries(e.data).filter(([k]) => !k.startsWith('_')));
  const parsed = EntitySchema.safeParse(data);
  return parsed.success ? [parsed.data] : [];
});
export const indexOf = (entities: readonly LitEntity[]): Map<string, LitEntity> => new Map(entities.map(e => [e.id, e]));

/** Accept the document's shorthand for a psalm or a single prayer; keep one canonical representation. */
function normalize(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const r = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(r.entities)) return { ...r, entities: r.entities.map(normalize) };
  if (typeof r.entity_type !== 'string') return r;
  r.title ??= r.canonical_name ?? r.label ?? r.id;
  delete r.canonical_name; delete r.label;
  if (r.entity_type === 'psalm_text' || r.entity_type === 'liturgical_text') {
    if (r.entity_type === 'psalm_text') r.resource_type = 'psalm';
    r.entity_type = 'text_resource';
  }
  if (r.entity_type === 'text_resource') {
    if (Array.isArray(r.verses)) r.structured_content = r.verses.map(v => typeof v === 'object' && v !== null ? { type: 'verse', verse: (v as Record<string, unknown>).number, text: (v as Record<string, unknown>).text } : v);
    if (typeof r.text === 'string') r.structured_content = [{ type: 'paragraph', text: r.text }];
    if (r.numbering !== undefined) r.metadata = { ...(r.metadata as object ?? {}), numbering: r.numbering };
    delete r.verses; delete r.text; delete r.numbering;
  }
  return r;
}
export function readImport(raw: unknown): { entities: LitEntity[]; provenance: string } | { problems: Problem[] } {
  const parsed = ImportSchema.safeParse(normalize(raw));
  if (!parsed.success) return { problems: parsed.error.issues.map(p => ({ code: 'schema', id: p.path.join('.'), detail: p.message })) };
  return 'entities' in parsed.data ? { entities: parsed.data.entities, provenance: parsed.data.provenance ?? '' } : { entities: [parsed.data], provenance: '' };
}

export function dependencies(e: LitEntity): string[] {
  switch (e.entity_type) {
    case 'text_resource': return [e.edition_id, ...(e.work_id ? [e.work_id] : [])];
    case 'passage_definition': return [e.work_id, e.edition_id, ...(e.resource_id ? [e.resource_id] : [])];
    case 'liturgical_template': return e.slots.flatMap(s => s.resource_ref ? [s.resource_ref.id] : []);
    case 'liturgical_assignment': return [e.resource_ref.id, ...(e.antiphon_ref ? [e.antiphon_ref] : []), ...(e.fallback_refs ?? []).map(r => r.id), ...(e.target_context.observances ?? []), ...(e.target_context.edition_id ? [e.target_context.edition_id] : [])];
    case 'calendar_observance': return [...(e.proper_references ?? []), ...(e.replaces ? [e.replaces] : [])];
    case 'liturgical_rule': return [...('observance_id' in e.action ? [e.action.observance_id] : []), ...('resource_ref' in e.action ? [e.action.resource_ref.id] : []), ...(e.conditions.observances ?? [])];
    case 'calendar_profile': return e.edition_id ? [e.edition_id] : [];
    default: return [];
  }
}
export const usageOf = (id: string, entities: readonly LitEntity[]): LitEntity[] => entities.filter(e => dependencies(e).includes(id) || (e.entity_type === 'passage_definition' && e.resource_id === undefined && passageSource(e, indexOf(entities))?.id === id));
export function passageSource(p: OfType<'passage_definition'>, index: ReadonlyMap<string, LitEntity>): OfType<'text_resource'> | null {
  const list = [...index.values()].filter((e): e is OfType<'text_resource'> => e.entity_type === 'text_resource' && e.work_id === p.work_id && e.edition_id === p.edition_id && e.structured_content.some(b => b.type === 'verse'));
  return (p.resource_id ? list.find(e => e.id === p.resource_id) : list.length === 1 ? list[0] : null) ?? null;
}
export function resolveText(id: string, index: ReadonlyMap<string, LitEntity>): { resource: OfType<'text_resource'>; blocks: TextBlock[]; passage?: OfType<'passage_definition'> } | null {
  const e = index.get(id);
  if (e?.entity_type === 'text_resource') return { resource: e, blocks: e.structured_content };
  if (e?.entity_type !== 'passage_definition') return null;
  const source = passageSource(e, index);
  if (!source) return null;
  const blocks = e.ranges.flatMap(r => source.structured_content.filter(b => b.verse !== undefined && b.verse >= r.start_verse && b.verse <= r.end_verse && !(e.omitted_verses ?? []).includes(b.verse)));
  return { resource: source, passage: e, blocks };
}

export function validateEntities(entities: readonly LitEntity[]): Problem[] {
  const index = indexOf(entities), problems: Problem[] = [];
  const fail = (e: LitEntity, code: string, detail: string) => problems.push({ id: e.id, code, detail });
  const seen = new Set<string>(), psalms = new Map<string, string>();
  const expect = (e: LitEntity, id: string, kinds: readonly LitEntity['entity_type'][]) => { const found = index.get(id); if (found && !kinds.includes(found.entity_type)) fail(e, 'reference_type', id); };
  for (const e of entities) {
    if (seen.has(e.id)) fail(e, 'duplicate_id', e.id); seen.add(e.id);
    for (const id of dependencies(e)) if (!index.has(id)) fail(e, 'missing_reference', id);
    const walkDates = (value: unknown, key = '') => {
      if (typeof value === 'string' && ['date', 'from', 'until', 'reviewed_from', 'reviewed_until'].includes(key) && !isDate(value)) fail(e, 'invalid_date', value);
      if (Array.isArray(value)) { for (const v of value) walkDates(v, key === 'dates' ? 'date' : key); }
      else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walkDates(v, k);
    };
    walkDates(e);
    if (e.entity_type === 'text_resource') {
      expect(e, e.edition_id, ['text_edition']); if (e.work_id) expect(e, e.work_id, ['canonical_work']);
      const edition = index.get(e.edition_id);
      if (edition?.entity_type === 'text_edition' && edition.language !== e.language) fail(e, 'edition_language', e.edition_id);
      const verses = e.structured_content.filter(b => b.type === 'verse').map(b => b.verse);
      if (verses.some(v => v === undefined) || new Set(verses).size !== verses.length) fail(e, 'verse_numbers', e.id);
      if (e.resource_type === 'psalm') {
        if (!e.work_id || verses.length === 0) fail(e, 'psalm_work', e.id);
        const key = `${e.work_id}\n${e.edition_id}`;
        if (psalms.has(key)) fail(e, 'duplicate_psalm', psalms.get(key)!); else psalms.set(key, e.id);
        if (e.complete && (!e.expected_verses || verses.length !== e.expected_verses || Array.from({ length: e.expected_verses }, (_, i) => i + 1).some(v => !verses.includes(v)))) fail(e, 'incomplete_psalm', e.id);
      }
      if (e.status === 'approved' && (!e.complete || !e.source_citation && !e.source_reference)) fail(e, 'approval_source', e.id);
    }
    if (e.entity_type === 'passage_definition') {
      expect(e, e.edition_id, ['text_edition']); expect(e, e.work_id, ['canonical_work']);
      const source = passageSource(e, index);
      if (!source) fail(e, 'passage_source', e.resource_id ?? `${e.work_id}/${e.edition_id}`);
      const verses = new Set(source?.structured_content.map(b => b.verse) ?? []), used = new Set<number>();
      for (const r of e.ranges) {
        if (r.start_verse > r.end_verse || r.end_verse - r.start_verse > 10000) { fail(e, 'verse_range', `${r.start_verse}–${r.end_verse}`); continue; }
        for (let v = r.start_verse; v <= r.end_verse; v++) { if (!verses.has(v) || used.has(v)) fail(e, 'verse_range', String(v)); used.add(v); }
      }
      if ((e.omitted_verses?.length ?? 0) > 0 && !e.authority_reference) fail(e, 'omission_authority', e.id);
      for (const v of e.omitted_verses ?? []) if (!used.has(v)) fail(e, 'verse_range', String(v));
    }
    if (e.entity_type === 'liturgical_template') {
      if (new Set(e.slots.map(s => s.name)).size !== e.slots.length) fail(e, 'duplicate_slot', e.id);
      for (const s of e.slots) if (s.resource_ref) expect(e, s.resource_ref.id, ['text_resource', 'passage_definition']);
    }
    if (e.entity_type === 'liturgical_assignment') {
      for (const r of [e.resource_ref, ...(e.fallback_refs ?? [])]) expect(e, r.id, ['text_resource', 'passage_definition']);
      if (e.antiphon_ref) { expect(e, e.antiphon_ref, ['text_resource']); const ant = index.get(e.antiphon_ref); if (ant?.entity_type === 'text_resource' && ant.resource_type !== 'antiphon') fail(e, 'reference_type', e.antiphon_ref); }
    }
    if (e.entity_type === 'liturgical_rule') {
      if ('observance_id' in e.action) expect(e, e.action.observance_id, ['calendar_observance']);
      if (e.action.type === 'transfer') { const obs = index.get(e.action.observance_id); if (obs?.entity_type === 'calendar_observance' && obs.liturgical_rank !== 'solemnity') fail(e, 'transfer_rank', obs.id); }
      if (e.action.type === 'replace') expect(e, e.action.resource_ref.id, ['text_resource', 'passage_definition']);
    }
    if (e.entity_type === 'calendar_observance' && e.replaces) {
      expect(e, e.replaces, ['calendar_observance']);
      const chain = new Set([e.id]); let at = index.get(e.replaces);
      while (at?.entity_type === 'calendar_observance') { if (chain.has(at.id)) { fail(e, 'reference_cycle', at.id); break; } chain.add(at.id); at = at.replaces ? index.get(at.replaces) : undefined; }
    }
    if (e.entity_type === 'calendar_profile') {
      try { new Intl.DateTimeFormat('en', { timeZone: e.time_zone }).format(); } catch { fail(e, 'time_zone', e.time_zone); }
      if (e.coverage === 'reviewed' && (e.status !== 'approved' || !e.reviewed_from || !e.reviewed_until || e.reviewed_until < e.reviewed_from)) fail(e, 'calendar_review', e.id);
    }
  }
  return problems.slice(0, 200);
}

export interface ImportPlan { entities: LitEntity[]; create: LitEntity[]; update: { before: LitEntity; after: LitEntity }[]; unchanged: number; problems: Problem[]; provenance: string }
export function planImport(raw: unknown, current: readonly LitEntity[], mode: 'add' | 'update' = 'add', allowApproved = false): ImportPlan {
  const parsed = readImport(raw);
  if ('problems' in parsed) return { entities: [], create: [], update: [], unchanged: 0, problems: parsed.problems, provenance: '' };
  const plan: ImportPlan = { ...parsed, create: [], update: [], unchanged: 0, problems: [] };
  const existing = indexOf(current), incoming = new Set<string>();
  for (const e of parsed.entities) {
    if (incoming.has(e.id)) plan.problems.push({ code: 'duplicate_id', id: e.id, detail: e.id }); incoming.add(e.id);
    const before = existing.get(e.id);
    if (!before) plan.create.push(e);
    else if (canonicalJson(before) === canonicalJson(e)) plan.unchanged++;
    else if (mode !== 'update' || before.entity_type !== e.entity_type || e.revision <= before.revision || before.status === 'approved' && !allowApproved || !parsed.provenance) plan.problems.push({ code: 'update_conflict', id: e.id, detail: String(before.revision) });
    else plan.update.push({ before, after: e });
  }
  const combined = [...current.filter(e => !incoming.has(e.id)), ...parsed.entities];
  plan.problems.push(...validateEntities(combined));
  return plan;
}
