/**
 * Kanonische Kennungen, Verweise, Prüfung des ganzen Graphen und Auflösen von Fragmenten — keine Kalenderentscheidungen.
 *
 * 2026-11-09 (2.0): Texte haben ein Brzmienie mit Struktur (`text.ts`). Gelesen wird hier: altes 1.0 (`migrate.ts`) und
 * Stücke eines Dokuments (`{"text": "…"}`) werden zu Einheiten mit Stellen und der Fassung (`text_version`), für die sie
 * gelten. Zusammengeführte Texte behalten ihre alten Kennungen als `aliases` — jeder Verweis bleibt gültig.
 */
import { EntitySchema, KIND, type Conditions, type LitEntity, type OfType, type ResourceRef, type TextResource, type Unit } from './schema';
import type { LibEntry } from '../libraryKinds';
import { isDate } from '../../calendar/flow/liturgy';
import { upgradeText } from './migrate';
import { layoutFaults, layoutOf, modeOf, placeUnits, textFromPieces, textVersion, unitIds, type PieceUnit } from './text';

export interface Problem { code: string; id: string; detail: string; params?: Record<string, string | number> }
export const canonicalJson = (value: unknown): string => JSON.stringify(sort(value));
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => [k, sort(v)]));
  return value;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Ein Text, wie ihn ein Dokument oder der Speicher bringt, in der gespeicherten Gestalt: 1.0 umgelesen, das Brzmienie
 * (wenn nötig aus den Stücken), seine Fassung, die Teilungen als Stellen. Was nicht auf das Brzmienie passt: `problems`.
 */
export function placeText(input: Record<string, unknown>): { raw: Record<string, unknown>; problems: Problem[]; migrated: boolean } {
  if (input.entity_type !== 'text_resource') return { raw: input, problems: [], migrated: false };
  const id = String(input.id ?? '');
  const { raw: upgraded, migrated } = upgradeText(input);
  const raw: Record<string, unknown> = { ...upgraded };
  const problems: Problem[] = [];
  const layoutPieces = Array.isArray(raw.layout) ? raw.layout.filter(isObj) as PieceUnit[] : null;
  if (typeof raw.text !== 'string' && layoutPieces !== null && layoutPieces.every((p) => typeof p.text === 'string')) raw.text = textFromPieces(layoutPieces);
  if (typeof raw.text !== 'string') return { raw, problems, migrated };
  const text = raw.text.normalize('NFC');
  raw.text = text;
  const version = textVersion(text);
  raw.text_version = version;
  const place = (pieces: readonly PieceUnit[], which: string): { on: string; units: Unit[] } | null => {
    const placed = placeUnits(text, pieces);
    if ('error' in placed) {
      const e = placed.error;
      problems.push(e.expected === ''
        ? { code: 'layout_unit', id, detail: which, params: { layout: which, unit: e.unit } }
        : { code: 'layout_mismatch', id, detail: `${which} ${e.unit}`, params: { layout: which, unit: e.unit, at: e.at, expected: e.expected, found: e.found } });
      return null;
    }
    return { on: version, units: placed.units };
  };
  if (layoutPieces !== null) {
    const placed = layoutPieces.length === 0 ? null : place(layoutPieces, 'layout');
    if (placed === null) delete raw.layout; else raw.layout = placed;
  }
  if (Array.isArray(raw.layouts)) {
    raw.layouts = raw.layouts.filter(isObj).flatMap((alt) => {
      if (!Array.isArray(alt.units) || alt.units.every((u) => isObj(u) && typeof u.at === 'number') && typeof alt.on === 'string') return [alt];
      const placed = place(alt.units.filter(isObj) as PieceUnit[], String(alt.id ?? 'layouts'));
      return placed === null ? [] : [{ ...alt, ...placed }];
    });
  }
  return { raw, problems, migrated };
}

export const entitiesOf = (entries: readonly LibEntry[]): LitEntity[] => entries.flatMap(e => {
  if (!Object.values(KIND).includes(e.kind)) return [];
  const data = Object.fromEntries(Object.entries(e.data).filter(([k]) => !k.startsWith('_')));
  /* 1.0 wird beim Lesen 2.0 — gespeichert bleibt es, bis es sich ändert (oder ein Import es neu schreibt). */
  const { raw } = placeText(data);
  const parsed = EntitySchema.safeParse(raw);
  return parsed.success && KIND[parsed.data.entity_type] === e.kind ? [parsed.data] : [];
});

/** Kennung → Encja, auch über die alten Kennungen zusammengeführter Texte. */
export const indexOf = (entities: readonly LitEntity[]): Map<string, LitEntity> => {
  const out = new Map<string, LitEntity>();
  for (const e of entities) out.set(e.id, e);
  for (const e of entities) if (e.entity_type === 'text_resource') for (const alias of e.aliases ?? []) if (!out.has(alias)) out.set(alias, e);
  return out;
};

export function dependencies(e: LitEntity): string[] {
  const conditions = (c: Conditions) => [...(c.observances ?? []), ...(c.commemorations ?? []), ...(c.edition_id ? [c.edition_id] : [])];
  switch (e.entity_type) {
    case 'text_resource': return [e.edition_id, ...(e.work_id ? [e.work_id] : []), ...(e.response_ref ? [e.response_ref] : []), ...(e.doxology_ref ? [e.doxology_ref] : []),
      ...(e.performance ?? []).flatMap(s => (s.resource ? [s.resource] : []))];
    case 'passage_definition': return [e.work_id, e.edition_id, ...(e.resource_id ? [e.resource_id] : [])];
    case 'liturgical_template': return [...conditions(e.applicability), ...e.slots.flatMap(s => [...conditions(s.conditions), ...(s.resource_ref ? [s.resource_ref.id] : [])])];
    case 'liturgical_assignment': return [e.resource_ref.id, ...(e.antiphon_ref ? [e.antiphon_ref] : []), ...(e.fallback_refs ?? []).map(r => r.id), ...conditions(e.target_context)];
    case 'calendar_observance': return [...(e.proper_references ?? []), ...(e.replaces ? [e.replaces] : [])];
    case 'liturgical_rule': return [...('observance_id' in e.action ? [e.action.observance_id] : []), ...('resource_ref' in e.action ? [e.action.resource_ref.id] : []), ...conditions(e.conditions)];
    case 'calendar_profile': return e.edition_id ? [e.edition_id] : [];
    default: return [];
  }
}
export const usageOf = (id: string, entities: readonly LitEntity[]): LitEntity[] => {
  const index = indexOf(entities);
  const ids = new Set([id, ...(index.get(id)?.entity_type === 'text_resource' ? (index.get(id) as TextResource).aliases ?? [] : [])]);
  return entities.filter(e => e.id !== id && (dependencies(e).some(d => ids.has(d)) || (e.entity_type === 'passage_definition' && e.resource_id === undefined && passageSource(e, index)?.id === id)));
};
/** Include offices reached through a passage, without repeating or looping through resources. */
export function allUsageOf(id: string, entities: readonly LitEntity[]): LitEntity[] {
  const seen = new Set([id]), result: LitEntity[] = [], queue = [id];
  for (let i = 0; i < queue.length; i++) for (const e of usageOf(queue[i], entities)) if (!seen.has(e.id)) { seen.add(e.id); queue.push(e.id); result.push(e); }
  return result;
}
const hasVerses = (e: TextResource) => (e.layout?.units ?? []).some(u => u.verse !== undefined);
export function passageSource(p: OfType<'passage_definition'>, index: ReadonlyMap<string, LitEntity>): TextResource | null {
  if (p.resource_id) { const r = index.get(p.resource_id); return r?.entity_type === 'text_resource' ? r : null; }
  const list = [...new Set(index.values())].filter((e): e is TextResource => e.entity_type === 'text_resource' && e.work_id === p.work_id && e.edition_id === p.edition_id && hasVerses(e));
  return list.length === 1 ? list[0] : null;
}

/** Ein Text oder ein Fragment (Podział) — sein Text, die Einheiten, die gelesen werden, und das Fragment. */
export function resolveText(id: string, index: ReadonlyMap<string, LitEntity>, layout?: string): { resource: TextResource; units: Unit[]; passage?: OfType<'passage_definition'> } | null {
  const e = index.get(id);
  if (e?.entity_type === 'text_resource') return { resource: e, units: [...layoutOf(e, layout)] };
  if (e?.entity_type !== 'passage_definition') return null;
  const source = passageSource(e, index);
  if (!source) return null;
  const omitted = new Set(e.omitted_verses ?? []);
  const units = layoutOf(source).filter(u => u.verse !== undefined && !omitted.has(u.verse) && e.ranges.some(r => u.verse! >= r.start_verse && u.verse! <= r.end_verse));
  return { resource: source, passage: e, units };
}

/** Der Text eines Fragments oder Texts als Zeichenfolge (für Leser: Cogita, AI) — das Brzmienie der gelesenen Einheiten. */
export const resolvedWording = (r: { resource: TextResource; units: readonly Unit[]; passage?: unknown }): string =>
  r.passage === undefined ? r.resource.text : r.units.map(u => r.resource.text.slice(u.at, u.to)).join(' ');

export function validateEntities(entities: readonly LitEntity[]): Problem[] {
  const index = indexOf(entities), problems: Problem[] = [];
  const fail = (e: LitEntity, code: string, detail: string, params?: Problem['params']) => problems.push({ id: e.id, code, detail, ...(params === undefined ? {} : { params }) });
  const seen = new Set<string>(), psalms = new Map<string, string>();
  const expect = (e: LitEntity, id: string, kinds: readonly LitEntity['entity_type'][]) => { const found = index.get(id); if (found && !kinds.includes(found.entity_type)) fail(e, 'reference_type', id); };
  const checkRef = (e: LitEntity, ref: ResourceRef) => expect(e, ref.id, ref.type === 'psalm_passage' || ref.type === 'passage_definition' ? ['passage_definition'] : ref.type ? ['text_resource'] : ['text_resource', 'passage_definition']);
  for (const e of entities) {
    if (seen.has(e.id)) fail(e, 'duplicate_id', e.id); seen.add(e.id);
    for (const id of dependencies(e)) if (!index.has(id)) fail(e, 'missing_reference', id);
    const walkDates = (value: unknown, key = '') => {
      if (typeof value === 'string' && ['date', 'from', 'until', 'reviewed_from', 'reviewed_until'].includes(key) && !isDate(value)) fail(e, 'invalid_date', value);
      if (Array.isArray(value)) { for (const v of value) walkDates(v, key === 'dates' ? 'date' : key); }
      else if (value && typeof value === 'object') {
        const v = value as Record<string, unknown>;
        if ((v.r === 'fixed' || v.r === 'sunday-after') && !isDate(`2000-${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')}`)) fail(e, 'invalid_date', `${v.month}/${v.day}`);
        if (typeof v.from === 'string' && typeof v.until === 'string' && v.until < v.from) fail(e, 'invalid_date', `${v.from}–${v.until}`);
        for (const [k, child] of Object.entries(v)) walkDates(child, k);
      }
    };
    if (e.entity_type !== 'text_resource') walkDates(e);
    if (e.entity_type === 'text_resource') {
      expect(e, e.edition_id, ['text_edition']); if (e.work_id) expect(e, e.work_id, ['canonical_work']);
      const edition = index.get(e.edition_id);
      if (edition?.entity_type === 'text_edition' && edition.language !== e.language) fail(e, 'edition_language', e.edition_id);
      /* Die Teilungen: auf dieses Brzmienie, für diese Fassung, ohne Lücken. */
      const layouts = [...(e.layout === undefined ? [] : [{ id: 'layout', ...e.layout }]), ...(e.layouts ?? [])];
      for (const l of layouts) {
        if (l.on !== e.text_version) fail(e, 'layout_stale', l.id, { layout: l.id });
        else for (const f of layoutFaults(e.text, l.units)) fail(e, f.code, `${l.id} ${f.detail}`, { layout: l.id, detail: f.detail });
      }
      const verses = (e.layout?.units ?? []).flatMap(u => (u.verse === undefined ? [] : [u.verse]));
      if (verses.some((v, i) => i > 0 && v < verses[i - 1])) fail(e, 'verse_numbers', e.id);
      if (e.resource_type === 'psalm') {
        if (!e.work_id) fail(e, 'psalm_work', e.id);
        if (e.complete) {
          const key = `${e.work_id}\n${e.edition_id}`;
          if (psalms.has(key)) fail(e, 'duplicate_psalm', psalms.get(key)!); else psalms.set(key, e.id);
        }
        const distinct = [...new Set(verses)];
        if (e.complete && (!e.expected_verses || distinct.length !== e.expected_verses || Array.from({ length: e.expected_verses }, (_, i) => i + 1).some(v => !distinct.includes(v)))) fail(e, 'incomplete_psalm', e.id);
      }
      if (e.status === 'approved' && (!e.complete || !e.source_citation && !e.source_reference)) fail(e, 'approval_source', e.id);
      /* Was sich auf Einheiten beruft, muss sie finden. */
      const ids = unitIds(e);
      (e.performance ?? []).forEach((s, n) => {
        const kinds = [s.say !== undefined, s.resource !== undefined, s.rubric !== undefined].filter(Boolean).length;
        if (kinds !== 1) { fail(e, 'performance_step', String(n + 1), { step: n + 1 }); return; }
        for (const u of s.say ?? []) if (!ids.has(u)) fail(e, 'performance_unit', `${n + 1}: ${u}`, { step: n + 1, unit: u });
        if (s.resource !== undefined) {
          expect(e, s.resource, ['text_resource']);
          const other = index.get(s.resource);
          if (other?.entity_type === 'text_resource') for (const u of s.units ?? []) if (!unitIds(other).has(u)) fail(e, 'performance_unit', `${n + 1}: ${s.resource}#${u}`, { step: n + 1, unit: `${s.resource}#${u}` });
        }
      });
      for (const note of e.notes ?? []) if (note.at !== 'start' && note.at !== 'end' && !ids.has(note.at)) fail(e, 'note_anchor', note.at, { unit: note.at });
      if (e.incipit !== undefined && 'unit' in e.incipit && !ids.has(e.incipit.unit)) fail(e, 'incipit_unit', e.incipit.unit, { unit: e.incipit.unit });
      for (const v of e.variants ?? []) if (v.replaces !== undefined && !ids.has(v.replaces)) fail(e, 'variant_unit', `${v.id} → ${v.replaces}`, { variant: v.id, unit: v.replaces });
      if (e.response_ref) expect(e, e.response_ref, ['text_resource']);
      if (e.doxology_ref) { expect(e, e.doxology_ref, ['text_resource']); const d = index.get(e.doxology_ref); if (d?.entity_type === 'text_resource' && d.resource_type !== 'doxology') fail(e, 'reference_type', e.doxology_ref); }
      if (modeOf(e.resource_type) === 'verse' && e.performance !== undefined && e.performance.length > 0) fail(e, 'performance_unsupported', e.resource_type, { type: e.resource_type });
    }
    if (e.entity_type === 'passage_definition') {
      expect(e, e.edition_id, ['text_edition']); expect(e, e.work_id, ['canonical_work']);
      const source = passageSource(e, index);
      if (!source) fail(e, 'passage_source', e.resource_id ?? `${e.work_id}/${e.edition_id}`);
      else if (e.on !== undefined && e.on !== source.text_version) fail(e, 'division_stale', source.id, { text: source.id, division: e.division ?? e.id });
      const verses = new Set((source?.layout?.units ?? []).flatMap(u => (u.verse === undefined ? [] : [u.verse]))), used = new Set<number>();
      const top = Math.max(0, ...verses);
      for (const r of e.ranges) {
        if (r.start_verse > r.end_verse || r.end_verse - r.start_verse > 10000) { fail(e, 'verse_range', `${r.start_verse}–${r.end_verse}`, { from: r.start_verse, to: r.end_verse, max: top }); continue; }
        const outside: number[] = [];
        for (let v = r.start_verse; v <= r.end_verse; v++) { if (!verses.has(v) || used.has(v)) outside.push(v); used.add(v); }
        if (outside.length > 0 && source) fail(e, 'verse_range', `${r.start_verse}–${r.end_verse}`, { from: r.start_verse, to: r.end_verse, max: top });
      }
      if ((e.omitted_verses?.length ?? 0) > 0 && !e.authority_reference) fail(e, 'omission_authority', e.id);
      for (const v of e.omitted_verses ?? []) if (!used.has(v)) fail(e, 'verse_range', String(v), { from: v, to: v, max: top });
    }
    if (e.entity_type === 'liturgical_template') {
      if (new Set(e.slots.map(s => s.name)).size !== e.slots.length) fail(e, 'duplicate_slot', e.id);
      for (const s of e.slots) if (s.resource_ref) checkRef(e, s.resource_ref);
    }
    if (e.entity_type === 'liturgical_assignment') {
      for (const r of [e.resource_ref, ...(e.fallback_refs ?? [])]) checkRef(e, r);
      if (e.antiphon_ref) {
        expect(e, e.antiphon_ref, ['text_resource']);
        const ant = index.get(e.antiphon_ref);
        if (ant?.entity_type === 'text_resource' && ant.resource_type !== 'antiphon') fail(e, 'reference_type', e.antiphon_ref);
        if (ant?.entity_type === 'text_resource' && e.antiphon_layout !== undefined && !(ant.layouts ?? []).some(l => l.id === e.antiphon_layout)) fail(e, 'layout_unknown', e.antiphon_layout, { layout: e.antiphon_layout, text: ant.id });
      }
      const main = index.get(e.resource_ref.id);
      if (main?.entity_type === 'text_resource' && e.main_layout !== undefined && !(main.layouts ?? []).some(l => l.id === e.main_layout)) fail(e, 'layout_unknown', e.main_layout, { layout: e.main_layout, text: main.id });
    }
    if (e.entity_type === 'liturgical_rule') {
      if ('observance_id' in e.action) expect(e, e.action.observance_id, ['calendar_observance']);
      if (e.action.type === 'transfer') { const obs = index.get(e.action.observance_id); if (obs?.entity_type === 'calendar_observance' && obs.liturgical_rank !== 'solemnity') fail(e, 'transfer_rank', obs.id); }
      if (e.action.type === 'replace') checkRef(e, e.action.resource_ref);
    }
    if (e.entity_type === 'calendar_observance' && e.replaces) {
      expect(e, e.replaces, ['calendar_observance']);
      const chain = new Set([e.id]); let at = index.get(e.replaces);
      while (at?.entity_type === 'calendar_observance') { if (chain.has(at.id)) { fail(e, 'reference_cycle', at.id); break; } chain.add(at.id); at = at.replaces ? index.get(at.replaces) : undefined; }
    }
    if (e.entity_type === 'calendar_profile') {
      if (e.edition_id) expect(e, e.edition_id, ['text_edition']);
      try { new Intl.DateTimeFormat('en', { timeZone: e.time_zone }).format(); } catch { fail(e, 'time_zone', e.time_zone); }
      if (e.coverage === 'reviewed' && (e.status !== 'approved' || !e.reviewed_from || !e.reviewed_until || e.reviewed_until < e.reviewed_from)) fail(e, 'calendar_review', e.id);
    }
    const contexts = e.entity_type === 'liturgical_assignment' ? [e.target_context] : e.entity_type === 'liturgical_rule' ? [e.conditions] : e.entity_type === 'liturgical_template' ? [e.applicability, ...e.slots.map(s => s.conditions)] : [];
    for (const c of contexts) { for (const id of [...(c.observances ?? []), ...(c.commemorations ?? [])]) expect(e, id, ['calendar_observance']); if (c.edition_id) expect(e, c.edition_id, ['text_edition']); }
  }
  return problems.slice(0, 200);
}
