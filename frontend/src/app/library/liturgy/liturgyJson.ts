/**
 * 2026-11-09 — DIE LITURGIA ALS JSON ("recreatio/liturgy"), in der Gestalt aller JSON-Importe der App
 * (documentation/JSON.md): Export, Vorschau, Import und die Beschreibung daneben — derselbe Text für Assistenten (MCP).
 *
 * <code>
 *   { "format": "recreatio/liturgy", "version": 2, "name": "…", "provenance": "…", "entities": [ … ] }
 *   bekannte "id"            AN ORT UND STELLE: nur die genannten Felder ändern sich, null leert eines, der Rest bleibt
 *   unbekannte "id"          neu ("entity_type" und alle Pflichtfelder)
 *   { "id", "remove": true } gelöscht — eine geänderte eingebaute kehrt zur Vorgabe zurück
 * </code>
 *
 * Fassung 2 (2026-11-09): ein Text hat EIN Brzmienie (`text`); seine Struktur steht als Stücke daneben (`layout`:
 * `[{"text": "…", "end": "mediant", …}]`), die der Import auf das Brzmienie legt (`text.ts`). Gleiche Brzmienie derselben
 * Ausgabe und Art werden zusammengeführt (die übrigen Kennungen bleiben als `aliases`); ähnliche — gleicher Anfang,
 * einer ein Anfang des anderen — nennt die Vorschau nur als Kandidaten. Was einem Text fehlt, steht in `missing`.
 * Fassung 1 und das erste Format (`recreatio.liturgy`) werden gelesen und umgeschrieben (`migrate.ts`), mit Warnung.
 */

import { z } from 'zod';

import { t } from '../../core/i18n';
import { keyLines, pretty, type JsonNode } from '../../core/jsonTree';
import { BUILTINS } from './defaults';
import { canonicalJson, indexOf, passageSource, placeText, validateEntities, type Problem } from './resources';
import { ANTIPHON_REPEATS, EntitySchema, ENDS, HOURS, KIND, LAYERS, MAX_IMPORT_CHANGES, NOTE_TYPES, RESOURCE_TYPES, ROLES, SEASONS, UNIT_KINDS, type EntityType, type LitEntity, type TextResource } from './schema';
import { normalizeWording, placeUnits, unitPieces } from './text';
import { upgradeText } from './migrate';

export const LITURGY_FORMAT = 'recreatio/liturgy';
export const LITURGY_VERSION = 2;
/** Das erste Format (2026-11-09, früh): ein Umschlag mit "schema_version", "mode" und "operations". */
const FIRST_FORMAT = 'recreatio.liturgy';

const TYPES = Object.keys(KIND) as EntityType[];
/** Was jede Encja hat — einmal beschrieben, nicht bei jedem Rodzaj. */
const COMMON = ['entity_type', 'id', 'title', 'status', 'source_reference', 'metadata', 'revision', 'remove'] as const;
/** Zählt die App; im Dokument überlesen. */
const APP_KEYS = ['schema_version', 'revision', 'text_version'] as const;
/** Gefolgert, nicht geprüft — fällt weg, sobald ein Dokument die Struktur selbst angibt (oder `missing` leert). */
const INFERRED = ['verses_inferred', 'lines_inferred', 'roles_inferred', 'incipit_unverified', 'performance_inferred', 'doxology_removed'];
/** Was die App an einem Text selbst feststellt — bei jedem Import neu. */
const STRUCTURAL = ['verses', 'work', 'lines', 'origin', 'reference', 'roles', 'response', 'petitions', 'conclusion'];
const MAX_REVISION = 1000000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/* -- Hinaus ---------------------------------------------------------------------------------------- */

/** Eine Encja im Dokument: ohne das, was die App zählt; Teilungen als Stücke; Rodzaj, Kennung und Titel zuerst. */
export function docEntity(e: LitEntity): Record<string, unknown> {
  const { schema_version: _version, revision: _revision, entity_type, id, title, ...rest } = e;
  const out: Record<string, unknown> = { entity_type, id, title, ...rest };
  if (e.entity_type === 'text_resource') {
    delete out.text_version;
    if (e.layout !== undefined) out.layout = unitPieces(e.text, e.layout.units);
    if (e.layouts !== undefined) out.layouts = e.layouts.map(({ on: _on, units, ...alt }) => ({ ...alt, units: unitPieces(e.text, units) }));
  }
  if (e.entity_type === 'passage_definition') delete out.on;
  return out;
}

export function exportLiturgy(name: string, entities: readonly LitEntity[]): Record<string, unknown> {
  const order = new Map(TYPES.map((type, i) => [type, i]));
  const sorted = [...entities].sort((a, b) => (order.get(a.entity_type) ?? 99) - (order.get(b.entity_type) ?? 99) || a.id.localeCompare(b.id, 'en'));
  return { format: LITURGY_FORMAT, version: LITURGY_VERSION, name, entities: sorted.map(docEntity) };
}

/* -- Herein: lesen --------------------------------------------------------------------------------- */

interface Read { readonly items: readonly unknown[]; readonly provenance: string; readonly warnings: readonly string[] }

/** Das Dokument: unser Umschlag (Fassung 2 oder 1), eine blosse Liste, eine einzelne Encja — oder das erste Format. */
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
    if (typeof doc.version === 'number' && doc.version !== LITURGY_VERSION) warnings.unshift(t('liturgy.json.warn.olderVersion', { given: doc.version, version: LITURGY_VERSION }));
    return { items: doc.entities, provenance, warnings };
  }
  if (doc.format === undefined && (typeof doc.entity_type === 'string' || typeof doc.id === 'string')) return { items: [doc], provenance: '', warnings: [] };
  return { error: t('liturgy.json.err.notFormat', { format: LITURGY_FORMAT }) };
}

/** Kurzformen, wie Menschen und Assistenten sie schreiben: ein Psalm mit "verses" (Fassung 1), der Titel aus einem Namen. */
function shorthand(raw: Record<string, unknown>, isNew: boolean): Record<string, unknown> {
  const r = { ...raw };
  if (isNew) r.title ??= r.canonical_name ?? r.label ?? r.id;
  delete r.canonical_name;
  delete r.label;
  if (r.entity_type === 'psalm_text' || r.entity_type === 'liturgical_text') {
    if (r.entity_type === 'psalm_text') r.resource_type = 'psalm';
    r.entity_type = 'text_resource';
  }
  if (Array.isArray(r.verses) && r.layout === undefined) {
    r.layout = r.verses.filter(isObject).map((v) => ({ text: v.text, verse: v.number ?? v.verse, ...(v.number ?? v.verse) !== undefined ? { label: String(v.number ?? v.verse) } : {}, end: 'verse' }));
  }
  if (isObject(r.numbering)) { r.metadata = { ...(isObject(r.metadata) ? r.metadata : {}), numbering: r.numbering }; delete r.numbering; }
  delete r.verses;
  return r;
}

/** Wie die Bibliothek speichert (`cleanData`): leere Werte fallen weg — so ändert ein Rücklauf nichts. */
function clean(r: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).flatMap(([key, value]) => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '' && key !== 'text') || (Array.isArray(value) && value.length === 0)) return [];
    return [[key, typeof value === 'string' && key !== 'text' ? value.trimEnd() : value]];
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

/** Was einem Text strukturell fehlt — je nach Art (die Codes übersetzt `liturgy.missing.*`). */
export function structuralMissing(e: TextResource): string[] {
  const units = e.layout?.units ?? [];
  const out: string[] = [];
  const roles = units.some((u) => u.role !== undefined) || (e.performance ?? []).some((s) => s.role !== undefined);
  switch (e.resource_type) {
    case 'psalm': case 'canticle':
      if (!units.some((u) => u.verse !== undefined)) out.push('verses');
      if (e.resource_type === 'psalm' && e.work_id === undefined) out.push('work');
      if (e.resource_type === 'canticle' && e.biblical_reference === undefined && e.reference === undefined) out.push('reference');
      break;
    case 'hymn': if (!units.some((u) => u.end === 'line')) out.push('lines'); break;
    case 'reading':
      if (e.origin === undefined) out.push('origin');
      if (e.reference === undefined) out.push('reference');
      break;
    case 'responsory': case 'dialog': case 'versicle': if (!roles) out.push('roles'); break;
    case 'intercessions':
      if (e.response_ref === undefined && !units.some((u) => u.kind === 'response')) out.push('response');
      if (!units.some((u) => u.kind === 'petition')) out.push('petitions');
      break;
    case 'prayer': if (!units.some((u) => u.kind === 'conclusion')) out.push('conclusion'); break;
    default: break;
  }
  return out;
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

/** Ein Grund, der den Import anhält — als Zeile der Vorschau (mit den Angaben des Grundes, wo es sie gibt). */
export function problemLine(p: Problem): string {
  if (p.params !== undefined) return `${p.id === '' ? '' : `${p.id}: `}${t(`liturgy.errors.${p.code}`, p.params)}`;
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
  /* Was gilt, je Kennung (ohne Aliasse) — der Stand nach diesem Dokument. */
  const final = new Map(current.map((e) => [e.id, e] as const));
  const create = new Map<string, LitEntity>();
  const update = new Map<string, { before: LitEntity; after: LitEntity }>();
  const remove = new Map<string, LitEntity>();
  const reset: { before: LitEntity; after: LitEntity }[] = [];
  const seen = new Set<string>();
  const mentioned = new Set<string>();
  let unchanged = 0, migrated = 0;

  const parse = (record: Record<string, unknown>, id: string): LitEntity | null => {
    const parsed = EntitySchema.safeParse(record);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues.slice(0, 20)) problems.push({ code: 'schema', id, detail: `${issue.path.join('.')}: ${issue.message}` });
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
  /** Was dem Text fehlt: was die App feststellt, und Gefolgertes — es sei denn, das Dokument gab die Struktur selbst an. */
  const withMissing = (record: Record<string, unknown>, given: Record<string, unknown>, before: LitEntity | undefined, fromMigration: readonly string[]): Record<string, unknown> => {
    if (record.entity_type !== 'text_resource') return record;
    const probe = EntitySchema.safeParse({ ...record, missing: undefined, schema_version: '2.0' });
    if (!probe.success || probe.data.entity_type !== 'text_resource') return record;
    const explicitLayout = Array.isArray(given.layout) && !Array.isArray(given.structured_content);
    let kept: string[] = 'missing' in given ? (Array.isArray(given.missing) ? given.missing.filter((x): x is string => typeof x === 'string') : [])
      : [...new Set([...(before?.entity_type === 'text_resource' ? before.missing ?? [] : []), ...fromMigration])];
    if (explicitLayout) kept = kept.filter((x) => !INFERRED.includes(x) || fromMigration.includes(x));
    kept = kept.filter((x) => !STRUCTURAL.includes(x));
    const missing = [...new Set([...kept, ...structuralMissing(probe.data)])];
    const status = missing.length > 0 && record.status !== 'approved' && record.status !== 'incomplete' ? 'incomplete' : record.status;
    return { ...record, ...(missing.length > 0 ? { missing } : { missing: undefined }), ...(status === undefined ? {} : { status }) };
  };
  const keep = (e: LitEntity, before: LitEntity | undefined) => {
    if (before === undefined) { create.set(e.id, e); final.set(e.id, e); return; }
    if (canonicalJson(e) === canonicalJson(before)) { unchanged += 1; return; }
    if (before.revision >= MAX_REVISION) { problems.push({ code: 'schema', id: e.id, detail: `revision ≤ ${MAX_REVISION}` }); return; } // i18n-ignore — technical detail
    const after = { ...e, revision: before.revision + 1 } as LitEntity;
    update.set(e.id, { before, after });
    final.set(e.id, after);
    if (before.status === 'approved') warnings.push(t('liturgy.json.warn.approved', { title: before.title, id: e.id }));
  };

  read.items.forEach((raw, at) => {
    if (!isObject(raw)) { warnings.push(t('liturgy.json.warn.notObject', { n: at + 1 })); return; }
    const given0 = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (given0 === '') { warnings.push(t('liturgy.json.warn.noId', { n: at + 1 })); return; }
    /* Eine alte Kennung eines zusammengeführten Texts meint den Text, in dem er aufging. */
    const owner = existing.get(given0);
    const id = owner !== undefined && owner.id !== given0 ? owner.id : given0;
    if (id !== given0) warnings.push(t('liturgy.json.warn.alias', { alias: given0, id }));
    if (seen.has(id)) { problems.push({ code: 'duplicate_id', id, detail: '' }); return; }
    seen.add(id);
    mentioned.add(id);
    const unsafe = unsafeKey(raw);
    if (unsafe !== null) { problems.push({ code: 'schema', id, detail: unsafe }); return; }
    const before = final.get(id);

    if (raw.remove === true) {
      if (before === undefined) { warnings.push(t('liturgy.json.warn.nothingToRemove', { id })); return; }
      if (!stored.has(id)) { problems.push({ code: 'default_readonly', id, detail: '' }); return; }
      const builtin = defaults.get(id);
      if (builtin !== undefined) { reset.push({ before, after: builtin }); final.set(id, builtin); }
      else { remove.set(id, before); final.delete(id); }
      return;
    }

    let given = shorthand({ ...raw, id }, before === undefined);
    delete given.remove;
    for (const key of APP_KEYS) delete given[key];
    for (const key of Object.keys(given)) if (key.startsWith('_')) { warnings.push(t('liturgy.json.warn.internal', { id, key })); delete given[key]; }
    /* Fassung 1 (Blöcke) wird erst umgelesen, dann gemischt — sonst wären die Blöcke „unbekannte Felder". */
    let fromMigration: string[] = [];
    if (Array.isArray(given.structured_content)) {
      const type = given.entity_type ?? before?.entity_type;
      const up = upgradeText({ ...given, entity_type: type, resource_type: given.resource_type ?? (before?.entity_type === 'text_resource' ? before.resource_type : undefined) });
      if (up.migrated) { migrated += 1; fromMigration = Array.isArray(up.raw.missing) ? up.raw.missing as string[] : []; const { missing: _m, ...rest } = up.raw; given = { ...rest, structured_content: given.structured_content }; }
    }
    const contentGiven = Array.isArray(given.structured_content);
    delete given.structured_content;

    let record: Record<string, unknown>;
    if (before !== undefined) {
      if (given.entity_type !== undefined && given.entity_type !== before.entity_type) {
        problems.push({ code: 'other_type', id, detail: `${before.entity_type} ≠ ${String(given.entity_type)}` });
        return;
      }
      /* An Ort und Stelle: was das Dokument nennt, ersetzt; null leert; der Rest bleibt. Neue Blöcke ersetzen die ganze Struktur. */
      record = { ...before };
      if (contentGiven) for (const key of ['text', 'layout', 'layouts', 'performance', 'notes', 'incipit']) delete record[key];
      for (const [key, value] of Object.entries(given)) {
        if (key === 'id' || key === 'entity_type') continue;
        if (value === null) delete record[key]; else record[key] = value;
      }
    } else {
      if (typeof given.entity_type !== 'string' || !TYPES.includes(given.entity_type as EntityType)) {
        problems.push({ code: 'schema', id, detail: `entity_type: ${TYPES.join(' | ')}` }); // i18n-ignore — the key and its values
        return;
      }
      record = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== null));
    }
    const placed = placeText(record);
    problems.push(...placed.problems);
    const ready = withMissing(clean(known(record.entity_type, placed.raw, id)), given, before, fromMigration);
    const parsed = parse({ ...ready, schema_version: '2.0', ...(before === undefined ? {} : { revision: before.revision }) }, id);
    if (parsed === null) return;
    keep(parsed, before);
  });

  /* Fragmente gelten für die Fassung ihres Texts: wer eines nennt (oder seinen Text ändert und es mitschickt), bindet es neu. */
  const lookNow = () => indexOf([...final.values()]);
  for (const id of mentioned) {
    const p = final.get(id);
    if (p?.entity_type !== 'passage_definition') continue;
    const source = passageSource(p, lookNow());
    if (source === null || p.on === source.text_version) continue;
    const next = { ...p, on: source.text_version } as LitEntity;
    const was = create.get(id) ?? update.get(id)?.after;
    if (create.has(id)) { create.set(id, next); final.set(id, next); }
    else if (update.has(id)) { const u = update.get(id)!; update.set(id, { before: u.before, after: next }); final.set(id, next); }
    else if (was === undefined) { unchanged -= 1; keep({ ...next, revision: p.revision } as LitEntity, p); }
  }

  /* Gleiches Brzmienie derselben Ausgabe und Art: EIN Text; die anderen Kennungen bleiben als Aliasse, ihre Quellen und Teilungen als bezeugt. */
  const mergedLines: string[] = [];
  const texts = () => [...final.values()].filter((e): e is TextResource => e.entity_type === 'text_resource');
  const groups = new Map<string, TextResource[]>();
  for (const e of texts()) {
    const key = `${e.edition_id}\n${e.resource_type}\n${normalizeWording(e.text)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keeper = [...group].sort((a, b) => Number(stored.has(b.id)) - Number(stored.has(a.id)) || a.id.localeCompare(b.id, 'en'))[0];
    const others = group.filter((e) => e !== keeper);
    const aliases = new Set(keeper.aliases ?? []);
    const layouts = [...(keeper.layouts ?? [])];
    const mergedFrom = Array.isArray(keeper.metadata?.merged_from) ? [...keeper.metadata!.merged_from as unknown[]] : [];
    for (const o of others) {
      aliases.add(o.id);
      for (const a of o.aliases ?? []) aliases.add(a);
      /* Eine andere bezeugte Teilung desselben Brzmienie bleibt — als eigene Teilung des behaltenen Texts. */
      const theirs = o.layout === undefined ? null : placeUnits(keeper.text, unitPieces(o.text, o.layout.units));
      const same = (x: readonly { at: number; to: number; end?: string }[], y: readonly { at: number; to: number; end?: string }[]) => canonicalJson(x.map((u) => [u.at, u.to, u.end])) === canonicalJson(y.map((u) => [u.at, u.to, u.end]));
      if (theirs !== null && 'units' in theirs && !same(theirs.units, keeper.layout?.units ?? []) && !layouts.some((l) => same(l.units, theirs.units)) && layouts.length < 20) {
        layouts.push({ id: `attested-${o.id.replace(/[^A-Za-z0-9._:-]/g, '-').slice(-60)}`, source: o.source_citation ?? o.source_reference ?? o.id, on: keeper.text_version, units: theirs.units });
      }
      mergedFrom.push({ id: o.id, title: o.title, ...(o.source_reference === undefined ? {} : { source_reference: o.source_reference }), ...(o.source_citation === undefined ? {} : { source_citation: o.source_citation }),
        ...(o.notes === undefined ? {} : { notes: o.notes }), ...(o.metadata === undefined ? {} : { metadata: o.metadata }) });
      final.delete(o.id);
      if (create.has(o.id)) create.delete(o.id);
      else { update.delete(o.id); if (stored.has(o.id)) remove.set(o.id, existing.get(o.id) ?? o); }
    }
    const next = { ...keeper, aliases: [...aliases].sort(), ...(layouts.length > 0 ? { layouts } : {}), metadata: { ...(keeper.metadata ?? {}), merged_from: mergedFrom } } as LitEntity;
    if (create.has(keeper.id)) { create.set(keeper.id, next); final.set(keeper.id, next); }
    else if (update.has(keeper.id)) { const u = update.get(keeper.id)!; update.set(keeper.id, { before: u.before, after: { ...next, revision: u.after.revision } as LitEntity }); final.set(keeper.id, update.get(keeper.id)!.after); }
    else { const before = final.get(keeper.id)!; keep({ ...next, revision: before.revision } as LitEntity, before); }
    mergedLines.push(t('liturgy.json.line.merged', { title: keeper.title, id: keeper.id, ids: others.map((o) => o.id).join(', ') }));
  }

  /* Kandidaten zum Vergleichen: gleicher Anfang, oder einer ist der Anfang des anderen — nie zusammengeführt. Der kürzere: vielleicht ein Ausfall. */
  const touched = new Set([...create.keys(), ...update.keys()]);
  const candidates: string[] = [];
  const buckets = new Map<string, TextResource[]>();
  for (const e of texts()) {
    const words = normalizeWording(e.text).toLowerCase().split(' ');
    if (words.length < 3) continue;
    const key = `${e.edition_id}\n${e.resource_type}\n${words.slice(0, 3).join(' ')}`;
    buckets.set(key, [...(buckets.get(key) ?? []), e]);
  }
  for (const list of buckets.values()) {
    if (list.length < 2 || list.length > 200) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i], list[j]];
      if (!touched.has(a.id) && !touched.has(b.id)) continue;
      const na = normalizeWording(a.text), nb = normalizeWording(b.text);
      const shorter = na.length <= nb.length ? a : b, longer = shorter === a ? b : a;
      const prefix = normalizeWording(longer.text).startsWith(normalizeWording(shorter.text));
      candidates.push(t(prefix ? 'liturgy.json.warn.candidatePrefix' : 'liturgy.json.warn.candidateIncipit', { a: shorter.id, b: longer.id }));
      if (prefix && touched.has(shorter.id) && shorter.status !== 'approved') {
        const marked = { ...shorter, status: 'incomplete', missing: [...new Set([...(shorter.missing ?? []), 'possibly_truncated'])] } as LitEntity;
        if (create.has(shorter.id)) create.set(shorter.id, marked);
        else if (update.has(shorter.id)) update.set(shorter.id, { ...update.get(shorter.id)!, after: marked });
        final.set(shorter.id, marked);
      }
    }
  }
  warnings.push(...candidates.slice(0, 30));
  if (candidates.length > 30) warnings.push(t('liturgy.json.warn.moreCandidates', { count: candidates.length - 30 }));

  problems.push(...validateEntities([...final.values()]));
  const created = [...create.values()], updated = [...update.values()], removed = [...remove.values()];
  const changes = created.length + updated.length + removed.length + reset.length;
  if (changes > MAX_IMPORT_CHANGES) problems.push({ code: 'batch_limit', id: '', detail: String(MAX_IMPORT_CHANGES) });

  const lines: string[] = [];
  if (changes === 0) lines.push(t('liturgy.json.line.nothing'));
  else {
    lines.push(t('liturgy.json.line.counts', { created: created.length, updated: updated.length, removed: removed.length, reset: reset.length, unchanged }));
    const byType = TYPES.map((type) => [type, [...created, ...updated.map((u) => u.after)].filter((e) => e.entity_type === type).length] as const).filter(([, n]) => n > 0);
    if (byType.length > 0) lines.push(byType.map(([type, n]) => `${t(`liturgy.types.${type}`)}: ${n}`).join(' · '));
    if (migrated > 0) lines.push(t('liturgy.json.line.migrated', { count: migrated }));
    const incomplete = [...created, ...updated.map((u) => u.after)].filter((e) => e.entity_type === 'text_resource' && (e.missing?.length ?? 0) > 0).length;
    if (incomplete > 0) lines.push(t('liturgy.json.line.incomplete', { count: incomplete }));
    lines.push(...mergedLines.slice(0, 30));
    for (const e of removed.slice(0, 50)) lines.push(t('liturgy.json.line.removed', { title: e.title, id: e.id }));
    for (const r of reset) lines.push(t('liturgy.json.line.reset', { title: r.after.title, id: r.after.id }));
  }
  return { create: created, update: updated, remove: removed, reset, unchanged, problems, warnings, lines, provenance: read.provenance };
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
    /* Die Teilungen stehen im Dokument als Stücke — erklärt bei den Teilen, nicht als Stellen. */
    const required = json.required?.includes(key) === true && key !== 'text_version' && !(type === 'text_resource' && key === 'text');
    /* Ein Schlüssel, der je Rodzaj Anderes heisst (`doxology` am Text oder am Przypisanie), hat seinen eigenen Satz. */
    const own = `liturgy.json.field.${type}.${key}`;
    const sentence = t(own) === own ? t(`liturgy.json.field.${key}`) : t(own);
    out[key] = `${sentence}${key === 'layout' || key === 'layouts' ? '' : facts(prop, required)}`;
  }
  return out;
}

const listed = (keys: readonly string[], group: string, values: Readonly<Record<string, string>> = {}): Record<string, string> =>
  Object.fromEntries(keys.map((key) => [key, t(`liturgy.json.${group}.${key}`, values[key] === undefined ? undefined : { values: values[key]! })]));

export const UNIT_KEYS = ['text', 'id', 'verse', 'label', 'end', 'role', 'kind', 'cross', 'style'] as const;
export const ALT_KEYS = ['id', 'title', 'source', 'units'] as const;
export const STEP_KEYS = ['say', 'resource', 'units', 'role', 'rubric'] as const;
export const NOTE_KEYS = ['type', 'text', 'at', 'source'] as const;
export const VARIANT_KEYS = ['id', 'replaces', 'text', 'when', 'source'] as const;
export const RANGE_KEYS = ['start_verse', 'end_verse'] as const;
export const REF_KEYS = ['id', 'type'] as const;
export const SLOT_KEYS = ['name', 'label', 'required', 'conditions', 'resource_ref', 'source_order', 'doxology', 'antiphon_repeat'] as const;
export const CONDITION_KEYS = ['dates', 'seasons', 'weekdays', 'psalter_weeks', 'weeks', 'observances', 'commemorations', 'scopes', 'hours', 'sunday_cycles', 'weekday_cycles', 'vespers', 'psalmody', 'common', 'te_deum', 'after_invitatory', 'edition_id', 'language', 'office_cycle', 'from', 'until'] as const;
export const DATE_RULES = ['fixed', 'easter', 'advent', 'christmas-sunday', 'baptism', 'nth-weekday', 'sunday-after', 'date'] as const;
export const RULE_ACTIONS = ['date_override', 'transfer', 'replace', 'omit'] as const;

const quoted = (list: readonly string[]): string => list.map((x) => `"${x}"`).join(', ');

/**
 * Ein kleines, stimmiges Beispiel (Texte erfunden): Wydanie, Psalm 117 in zwei Versen mit Mediante, ein Fragment, eine
 * Antyfona mit Teilung (und einer bezeugten anderen), eine Doxologie, ein Gebet mit Schluss, Amen und kurzem Schluss, ein
 * Przypisanie (Antyfona davor und danach, Doxologie danach) und ein Fest.
 */
export const liturgySample = () => {
  const s = (key: string, params?: Record<string, string | number>) => t(`liturgy.json.sample.${key}`, params);
  const halves = [s('half', { v: 1, h: 1 }), s('half', { v: 1, h: 2 }), s('half', { v: 2, h: 1 }), s('half', { v: 2, h: 2 })];
  const ant = [s('antiphonA'), s('antiphonB')];
  const dox = [s('doxologyA'), s('doxologyB')];
  const prayer = [s('prayerBody'), s('prayerEnd'), s('amen')];
  return {
    format: LITURGY_FORMAT,
    version: LITURGY_VERSION,
    provenance: s('provenance'),
    entities: [
      { entity_type: 'text_edition', id: 'sample.edition', title: s('edition'), language: 'pl-PL', license: s('license'), permitted_usage: ['private', 'print'] },
      { entity_type: 'canonical_work', id: 'sample.psalm117', title: s('work'), work_type: 'psalm', numbering_systems: { hebrew: 117, vulgate: 116 } },
      {
        entity_type: 'text_resource', id: 'sample.psalm117.text', title: s('text'), resource_type: 'psalm', work_id: 'sample.psalm117', edition_id: 'sample.edition',
        language: 'pl-PL', complete: true, expected_verses: 2, doxology: 'after', doxology_ref: 'sample.doxology',
        text: halves.join(' '),
        layout: [
          { text: halves[0], verse: 1, label: '1', end: 'mediant' }, { text: halves[1], verse: 1, end: 'verse' },
          { text: halves[2], verse: 2, label: '2', end: 'mediant' }, { text: halves[3], verse: 2, end: 'verse' }
        ],
        notes: [{ type: 'subtitle', text: s('psalmTitle') }]
      },
      { entity_type: 'passage_definition', id: 'sample.psalm117.v1', title: s('passage'), work_id: 'sample.psalm117', edition_id: 'sample.edition', ranges: [{ start_verse: 1, end_verse: 1 }], division: 'sample.two', part: 'I', order: 1 },
      {
        entity_type: 'text_resource', id: 'sample.antiphon', title: s('antiphonTitle'), resource_type: 'antiphon', edition_id: 'sample.edition', language: 'pl-PL', complete: true,
        text: ant.join(' '), layout: [{ text: ant[0], end: 'mediant' }, { text: ant[1] }]
      },
      {
        entity_type: 'text_resource', id: 'sample.doxology', title: s('doxologyTitle'), resource_type: 'doxology', edition_id: 'sample.edition', language: 'pl-PL', complete: true,
        text: dox.join(' '), layout: [{ text: dox[0], end: 'mediant' }, { text: dox[1], end: 'verse' }]
      },
      {
        entity_type: 'text_resource', id: 'sample.prayer', title: s('prayerTitle'), resource_type: 'prayer', edition_id: 'sample.edition', language: 'pl-PL', complete: true,
        intro_formula: s('letUsPray'), text: prayer.join(' '),
        layout: [{ text: prayer[0], kind: 'body' }, { text: prayer[1], id: 'conclusion', kind: 'conclusion' }, { text: prayer[2], id: 'amen', kind: 'response', role: 'all' }],
        variants: [{ id: 'short', replaces: 'conclusion', text: s('prayerShortEnd'), when: { hours: ['terce', 'sext', 'none'] } }]
      },
      {
        entity_type: 'liturgical_assignment', id: 'sample.lauds.monday', title: s('assignment'), slot_name: 'psalmody.1', resource_ref: { id: 'sample.psalm117.text' },
        antiphon_ref: 'sample.antiphon', antiphon_repeat: 'around', doxology: true, source_layer: 'psalter', target_context: { hours: ['lauds'], weekdays: [1], psalter_weeks: [1] }, authority_reference: s('authority')
      },
      {
        entity_type: 'calendar_observance', id: 'sample.patron', title: s('observance'), precedence_class: 4, liturgical_rank: 'solemnity',
        date_rule: { r: 'fixed', month: 9, day: 29 }, calendar_scope: 'parish.sample', liturgical_color: 'white', first_vespers: true, authority_reference: s('authority')
      }
    ]
  };
};

const typeNode = (type: EntityType): JsonNode => ({
  key: `liturgy:${type}`,
  get title() { return `"${type}" — ${t(`liturgy.types.${type}`)}`; },
  get short() { return t(`liturgy.types.${type}`); },
  text: () => `${t(`liturgy.json.type.${type}`)}\n${keyLines(typeFields(type))}`
});

/** Ein Text: ein Brzmienie, darüber seine Struktur — die Schlüssel der Stücke, Teilungen, Schritte, Hinweise, Varianten. */
const WORDING_JSON: JsonNode = {
  key: 'liturgy.wording',
  get title() { return t('liturgy.json.wording.title'); },
  text: () => [
    t('liturgy.json.wording.intro'),
    '', t('liturgy.json.wording.unit'), keyLines(listed(UNIT_KEYS, 'unit', { end: quoted(ENDS), role: quoted(ROLES), kind: quoted(UNIT_KINDS) })),
    '', t('liturgy.json.wording.layouts'), keyLines(listed(ALT_KEYS, 'alt')),
    '', t('liturgy.json.wording.performance'), keyLines(listed(STEP_KEYS, 'step', { role: quoted(ROLES) })),
    '', t('liturgy.json.wording.notes'), keyLines(listed(NOTE_KEYS, 'note', { type: quoted(NOTE_TYPES) })),
    '', t('liturgy.json.wording.variants'), keyLines(listed(VARIANT_KEYS, 'variant')),
    '', t('liturgy.json.wording.types', { types: quoted(RESOURCE_TYPES) }),
    '', t('liturgy.json.wording.checks')
  ].join('\n')
};

/** Wie eine Hore zusammengesetzt wird: Antiphonen, Doxologie, Schlüsse, Antworten, Fragmente. */
const HOURS_JSON: JsonNode = {
  key: 'liturgy.hours',
  get title() { return t('liturgy.json.hours.title'); },
  text: () => t('liturgy.json.hours.text', { repeats: quoted(ANTIPHON_REPEATS) })
};

const PARTS_JSON: JsonNode = {
  key: 'liturgy.parts',
  get title() { return t('liturgy.json.parts.title'); },
  text: () => [
    t('liturgy.json.parts.range'), keyLines(listed(RANGE_KEYS, 'range')),
    '', t('liturgy.json.parts.ref'), keyLines(listed(REF_KEYS, 'ref')),
    '', t('liturgy.json.parts.slot'), keyLines(listed(SLOT_KEYS, 'slot', { source_order: quoted(LAYERS), antiphon_repeat: quoted(ANTIPHON_REPEATS) })),
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
    for (const e of BUILTINS) if (e.entity_type === 'liturgical_template') lines.push(`  "${e.id}" (${e.hour_or_rite}): ${e.slots.map((s) => `${s.name}${s.doxology ? '+' : ''}`).join(', ')}`);
    return lines.join('\n');
  }
};

/** Wie Fassung 1 und das erste Format in Fassung 2 übergehen (`migrate.ts`). */
const MIGRATION_JSON: JsonNode = {
  key: 'liturgy.migration',
  get title() { return t('liturgy.json.migration.title'); },
  text: () => t('liturgy.json.migration.text')
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
  inside: () => [...TYPES.map(typeNode), WORDING_JSON, HOURS_JSON, PARTS_JSON, BUILTINS_JSON, MIGRATION_JSON, USAGE_JSON],
  samples: () => [{ get label() { return t('liturgy.json.sampleLabel'); }, doc: liturgySample }]
};

/** Die gemeinsamen Schlüssel, die die Beschreibung erklärt — für die Prüfung. */
export const LITURGY_COMMON_KEYS: readonly string[] = COMMON;
