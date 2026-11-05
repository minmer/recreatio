/**
 * 0137 — DAS DOKUMENT EINER WSPÓLNOTA („recreatio/community"): lesen (duldsam, mit Warnungen),
 * ausgeben, beschreiben (ein Knoten des JSON-Baums, `core/jsonTree.ts`). Rein — der Import steht in
 * `communityImport.ts`, das Übersetzen in Dokumente der Bereiche in `communityCompile.ts`.
 *
 * <b>Schlüssel statt Kennungen.</b> Einheiten, Positionen, Baupläne und Personen heissen mit kurzen
 * Schlüsseln; die Wspólnota merkt sich (versiegelt, `CommunityState`), welcher Bereich, welche Rolle
 * und welcher Link unter welchem Schlüssel entstand. Derselbe Schlüssel beim nächsten Import heisst
 * „dieses ändern" — ein Dokument aus einer anderen Wspólnota legt alles neu an.
 */

import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { PROFILE_KINDS, type ProfileKind } from '../areas/profile';
import { t } from '../core/i18n';
import {
  ASSIGN_WORD, COMMUNITY_FORMAT, FIELD_KINDS, flatten, isRights, KEY, PAGES_BY, RIGHTS, SETTINGS, settingDef, slug, STEP_TITLES,
  type Assign, type Blueprint, type CommunityDoc, type Council, type FieldDef, type FieldKind, type PagesBy, type Person, type PersonPlace,
  type Position, type Settings, type Unit
} from './community';
import { EXAMPLES } from './communityExamples';

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const rec = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const has = (r: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(r, k);

/** Der Schlüssel der Position geht als Rollenschlüssel ins Dokument des Bereichs — dort höchstens 32 Zeichen. */
const POSITION_KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const KINDS = new Set<string>(PROFILE_KINDS.map((k) => k.kind));

const MAX_UNITS = 300;
const MAX_PERSONS = 2000;

/* -- Was die Wspólnota sich merkt ------------------------------------------------------- */

export interface LinkMark {
  readonly invitationId: string;
  /** Die Rolle des Links — an ihr erkennt der Mensch mit dem Link sich selbst. */
  readonly linkRoleId: string;
  /** Die Rollen, die der Link hält (sortiert): ändern sie sich, entsteht ein neuer Link. */
  readonly roles: readonly string[];
  readonly at: string;
}

export interface CommunityState {
  /** Schlüssel der Einheit → Bereich. */
  readonly units: Readonly<Record<string, string>>;
  /** Schlüssel des Gremiums → Bereich. */
  readonly councils: Readonly<Record<string, string>>;
  /** "einheit/position" → Rolle. */
  readonly roles: Readonly<Record<string, string>>;
  readonly links: Readonly<Record<string, LinkMark>>;
  /** Zugänge, die die Wspólnota gab: "bereich|rolle|stufe" — nur diese nimmt sie wieder. */
  readonly joins: readonly string[];
  /** Halten unter Positionen: "hält|gehalten" — die Leitung hält die übrigen Positionen ihrer Einheit. */
  readonly holds: readonly string[];
}

export const EMPTY_STATE: CommunityState = { units: {}, councils: {}, roles: {}, links: {}, joins: [], holds: [] };

/** Was ein Mensch einer Einheit liest (versiegelt in IHREM Bereich) — auch die Wurzel trägt es. */
export interface UnitView {
  readonly community: { readonly areaId: string; readonly name: string };
  readonly unit: { readonly key: string; readonly name: string; readonly areaId: string };
  readonly positions: readonly { readonly key: string; readonly name: string; readonly rights: string; readonly roleId: string | null }[];
  readonly people: readonly { readonly name: string; readonly linkRoleId: string | null; readonly positions: readonly string[] }[];
  /** Die Seite für die Menschen der Einheit (Adresse ohne #/), sonst die öffentliche. */
  readonly home: string | null;
  readonly updatedAt: string;
}

export interface StoredCommunity {
  readonly kind: 'community';
  readonly doc: CommunityDoc;
  readonly state: CommunityState;
  readonly view: UnitView;
}

export interface StoredUnit {
  readonly kind: 'unit';
  readonly view: UnitView;
}

export type Stored = StoredCommunity | StoredUnit;

/* -- Lesen --------------------------------------------------------------------------- */

function readSettings(raw: unknown, where: string, warnings: string[]): Settings | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) { warnings.push(t('communitiesJson.read.settingsObject', { where })); return undefined; }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [group, values] of Object.entries(raw)) {
    if (!isRecord(values)) { warnings.push(t('communitiesJson.read.groupObject', { where, group })); continue; }
    for (const [key, value] of Object.entries(values)) {
      const path = `${group}.${key}`;
      const def = settingDef(path);
      if (def === undefined) { warnings.push(t('communitiesJson.read.unknownSetting', { where, path })); continue; }
      let ok: unknown = undefined;
      if (value === null) ok = null;
      else if (def.kind === 'bool') ok = typeof value === 'boolean' ? value : undefined;
      else if (def.kind === 'number') ok = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
      else if (def.kind === 'choice' || def.kind === 'day') ok = def.choices?.some((c) => c.value === value) ? value : undefined;
      else if (def.kind === 'date') ok = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
      else if (def.kind === 'time') ok = typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value) ? value : undefined;
      else ok = typeof value === 'string' ? value.slice(0, 2000) : undefined;
      if (ok === undefined) {
        warnings.push(def.choices
          ? t('communitiesJson.read.settingAllowed', { where, path, allowed: def.choices.map((c) => `"${c.value}"`).join(', ') })
          : t('communitiesJson.read.settingExpected', { where, path, kind: def.kind }));
        continue;
      }
      (out[group] ??= {})[key] = ok;
    }
  }
  return out;
}

function readCouncil(raw: unknown, where: string, warnings: string[]): Council | undefined {
  if (raw === undefined || raw === null || raw === false) return undefined;
  const r = rec(raw);
  const key = str(r.key);
  const name = str(r.name);
  if (!KEY.test(key) || name === '') { warnings.push(t('communitiesJson.read.council', { where })); return undefined; }
  return { key, name: name.slice(0, 120), own: list(r.own).map(str).filter((k) => k !== ''), below: list(r.below).map(str).filter((k) => k !== '') };
}

function readPagesBy(raw: unknown, where: string, warnings: string[]): PagesBy | undefined {
  if (raw === undefined || raw === null) return undefined;
  const r = rec(raw);
  const out: { inside?: string; public?: string } = {};
  for (const k of ['inside', 'public'] as const) {
    if (!has(r, k)) continue;
    const v = str(r[k]);
    if (PAGES_BY.test(v)) out[k] = v; else warnings.push(t('communitiesJson.read.pagesBy', { where, key: k }));
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function readExtra(raw: unknown, where: string, warnings: string[]): Readonly<Record<string, unknown>> | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) { warnings.push(t('communitiesJson.read.extraObject', { where })); return undefined; }
  const allowed = new Set(['appointments', 'pages', 'subforms', 'card', 'category', 'listings', 'chats', 'publish']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (allowed.has(k)) out[k] = v; else warnings.push(t('communitiesJson.read.extraKey', { where, key: k, allowed: [...allowed].join(', ') }));
  }
  return out;
}

interface Shorthand { readonly unit: string; readonly position: string; readonly names: readonly string[] }

function readUnit(raw: unknown, where: string, warnings: string[], seen: Set<string>, people: Shorthand[], depth: number): Unit | null {
  const r = rec(raw);
  const name = str(r.name);
  const key = str(r.key) || (name === '' ? '' : slug(name));
  if (!KEY.test(key)) { warnings.push(t('communitiesJson.read.unitKey', { where })); return null; }
  if (seen.has(key)) { warnings.push(t('communitiesJson.read.unitRepeats', { key })); return null; }
  if (name === '') { warnings.push(t('communitiesJson.read.unitNoName', { key })); return null; }
  if (seen.size >= MAX_UNITS) { warnings.push(t('communitiesJson.read.maxUnits', { max: MAX_UNITS })); return null; }
  if (depth > 12) { warnings.push(t('communitiesJson.read.maxDepth', { key })); return null; }
  seen.add(key);
  const at = t('communitiesJson.read.unitAt', { key });
  const kindSaid = str(r.kind);
  if (kindSaid !== '' && !KINDS.has(kindSaid)) warnings.push(t('communitiesJson.read.kind', { at, allowed: [...KINDS].map((k) => `"${k}"`).join(', ') }));
  const area = str(r.area);
  if (area !== '' && !/^[0-9a-f-]{36}$/i.test(area)) warnings.push(t('communitiesJson.read.area', { at }));
  const address = has(r, 'address') ? str(r.address).replace(/^\/+|\/+$/g, '').toLowerCase() : '';
  if (address !== '' && !address.split('/').every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) warnings.push(t('communitiesJson.read.address', { at }));
  for (const [position, names] of Object.entries(rec(r.people))) {
    const got = list(names).map(str).filter((n) => n !== '');
    if (got.length > 0) people.push({ unit: key, position, names: got });
  }
  const units: Unit[] = [];
  for (const [i, child] of list(r.units).entries()) {
    const one = readUnit(child, `${at}, "units"[${i}]`, warnings, seen, people, depth + 1);
    if (one !== null) units.push(one);
  }
  const settings = readSettings(r.settings, at, warnings);
  const council = readCouncil(r.council, at, warnings);
  const pagesBy = readPagesBy(r.pagesBy, at, warnings);
  const extra = readExtra(r.extra, at, warnings);
  return {
    key, name: name.slice(0, 120),
    ...(KINDS.has(kindSaid) ? { kind: kindSaid as ProfileKind } : {}),
    ...(str(r.from) === '' ? {} : { from: str(r.from) }),
    ...(has(r, 'positions') ? { positions: list(r.positions).map(str).filter((k) => k !== '') } : {}),
    ...(settings === undefined ? {} : { settings }),
    ...(council === undefined ? {} : { council }),
    ...(pagesBy === undefined ? {} : { pagesBy }),
    ...(units.length === 0 ? {} : { units }),
    ...(address === '' || !address.split('/').every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) ? {} : { address }),
    ...(/^[0-9a-f-]{36}$/i.test(area) ? { area: area.toLowerCase() } : {}),
    ...(r.remove === true ? { remove: true } : {}),
    ...(extra === undefined ? {} : { extra })
  };
}

/** DULDSAM LESEN — was nicht passt, fällt weg, mit einem Wort dazu. Ein Fehler nur, wenn es gar keine Wspólnota ist. */
export function readCommunity(value: unknown): { doc: CommunityDoc; warnings: string[] } | { error: string } {
  if (!isRecord(value)) return { error: t('communitiesJson.read.notObject') };
  if (str(value.format) === 'recreatio/area') return { error: t('communitiesJson.read.isArea') };
  if (str(value.format) !== COMMUNITY_FORMAT) return { error: t('communitiesJson.read.wrongFormat', { format: COMMUNITY_FORMAT }) };
  const warnings: string[] = [];
  const known = new Set(['format', 'version', 'name', 'positions', 'fields', 'blueprints', 'unit', 'persons']);
  for (const k of Object.keys(value)) if (!known.has(k)) warnings.push(t('communitiesJson.read.unknownKey', { key: k }));

  /* Positionen. */
  const positions: Position[] = [];
  for (const [i, raw] of list(value.positions).entries()) {
    const r = rec(raw);
    const name = str(r.name);
    const key = str(r.key) || (name === '' ? '' : slug(name, 32));
    if (!POSITION_KEY.test(key)) { warnings.push(t('communitiesJson.read.positionKey', { i })); continue; }
    if (positions.some((p) => p.key === key)) { warnings.push(t('communitiesJson.read.positionRepeats', { key })); continue; }
    if (name === '') { warnings.push(t('communitiesJson.read.positionNoName', { key })); continue; }
    const rights = isRights(r.rights) ? r.rights : 'member';
    if (!isRights(r.rights)) warnings.push(t('communitiesJson.read.positionRights', { key, allowed: RIGHTS.map((x) => `"${x.value}"`).join(', ') }));
    const assign = str(r.assign);
    const per = rec(r.per);
    positions.push({
      key, name: name.slice(0, 60), rights,
      ...(r.pair === true ? { pair: true } : {}),
      ...(assign in ASSIGN_WORD ? { assign: assign as Assign } : {}),
      ...(str(r.term) === '' ? {} : { term: str(r.term).slice(0, 120) }),
      ...(typeof r.need === 'number' && r.need > 0 ? { need: Math.round(r.need) } : {}),
      ...(typeof per.count === 'number' && per.count > 0 && str(per.of) !== '' ? { per: { count: Math.round(per.count), of: str(per.of) } } : {}),
      ...(str(r.note) === '' ? {} : { note: str(r.note).slice(0, 400) })
    });
  }

  /* Felder. */
  const fields: FieldDef[] = [];
  for (const [i, raw] of list(value.fields).entries()) {
    const r = rec(raw);
    const label = str(r.label);
    const key = str(r.key) || (label === '' ? '' : slug(label, 32));
    if (!POSITION_KEY.test(key) || label === '') { warnings.push(t('communitiesJson.read.field', { i })); continue; }
    if (fields.some((f) => f.key === key)) continue;
    const kind = (FIELD_KINDS as readonly string[]).includes(str(r.kind)) ? str(r.kind) as FieldKind : 'line';
    fields.push({
      key, label: label.slice(0, 80), kind,
      ...(kind === 'choice' ? { options: list(r.options).map(str).filter((o) => o !== '').slice(0, 40) } : {}),
      ...(r.leadersOnly === true ? { leadersOnly: true } : {})
    });
  }

  /* Baupläne. */
  const blueprints: Blueprint[] = [];
  for (const [i, raw] of list(value.blueprints).entries()) {
    const r = rec(raw);
    const key = str(r.key);
    const name = str(r.name);
    if (!KEY.test(key) || name === '') { warnings.push(t('communitiesJson.read.blueprint', { i })); continue; }
    if (blueprints.some((b) => b.key === key)) continue;
    const at = t('communitiesJson.read.blueprintAt', { key });
    const settings = readSettings(r.settings, at, warnings);
    const council = readCouncil(r.council, at, warnings);
    const pagesBy = readPagesBy(r.pagesBy, at, warnings);
    const extra = readExtra(r.extra, at, warnings);
    blueprints.push({
      key, name: name.slice(0, 120),
      ...(KINDS.has(str(r.kind)) ? { kind: str(r.kind) as ProfileKind } : {}),
      ...(has(r, 'positions') ? { positions: list(r.positions).map(str).filter((k) => k !== '') } : {}),
      ...(settings === undefined ? {} : { settings }),
      ...(council === undefined ? {} : { council }),
      ...(pagesBy === undefined ? {} : { pagesBy }),
      ...(extra === undefined ? {} : { extra })
    });
  }

  /* Einheiten. */
  const shorthand: Shorthand[] = [];
  const seen = new Set<string>();
  const unit = isRecord(value.unit) ? readUnit(value.unit, '"unit"', warnings, seen, shorthand, 0) : null;
  if (unit === null) return { error: t('communitiesJson.read.noUnit') };

  /* Prüfung der Verweise. */
  const unitKeys = new Set(flatten(unit).map((u) => u.unit.key));
  for (const { unit: u } of flatten(unit)) {
    if (u.from !== undefined && !blueprints.some((b) => b.key === u.from)) warnings.push(t('communitiesJson.read.unitNoBlueprint', { key: u.key, from: u.from }));
    for (const p of u.positions ?? []) if (!positions.some((x) => x.key === p)) warnings.push(t('communitiesJson.read.unitNoPosition', { key: u.key, position: p }));
  }
  for (const b of blueprints) for (const p of b.positions ?? []) if (!positions.some((x) => x.key === p)) warnings.push(t('communitiesJson.read.blueprintNoPosition', { key: b.key, position: p }));

  /* Personen — zuerst als Gruppe ("people" in der Einheit), dann einzeln. */
  const persons: Person[] = [];
  const add = (one: Person) => {
    const was = persons.findIndex((p) => p.key === one.key);
    if (was < 0) { persons.push(one); return; }
    const old = persons[was];
    const places = [...old.places];
    for (const pl of one.places) if (!places.some((x) => x.unit === pl.unit && x.position === pl.position)) places.push(pl);
    persons[was] = { ...old, ...one, places, fields: { ...(old.fields ?? {}), ...(one.fields ?? {}) } };
  };
  for (const [i, raw] of list(value.persons).entries()) {
    const r = rec(raw);
    const name = str(r.name);
    const key = str(r.key) || (name === '' ? '' : slug(name));
    if (!KEY.test(key)) { warnings.push(t('communitiesJson.read.person', { i })); continue; }
    if (name === '' && r.remove !== true) { warnings.push(t('communitiesJson.read.personNoName', { key })); continue; }
    if (persons.length >= MAX_PERSONS) { warnings.push(t('communitiesJson.read.maxPersons', { max: MAX_PERSONS })); break; }
    const places: PersonPlace[] = [];
    for (const pl of list(r.places)) {
      const p = rec(pl);
      const u = str(p.unit);
      const pos = str(p.position);
      if (!unitKeys.has(u)) { warnings.push(t('communitiesJson.read.personNoUnit', { key, unit: u })); continue; }
      if (!positions.some((x) => x.key === pos)) { warnings.push(t('communitiesJson.read.personNoPosition', { key, position: pos })); continue; }
      places.push({ unit: u, position: pos });
    }
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec(r.fields))) {
      if (!fields.some((x) => x.key === k)) { warnings.push(t('communitiesJson.read.personNoField', { key, field: k })); continue; }
      f[k] = typeof v === 'boolean' ? (v ? 'tak' : '') : String(v ?? '').slice(0, 400);
    }
    add({
      key, name: name.slice(0, 120), places,
      ...(Object.keys(f).length === 0 ? {} : { fields: f }),
      ...(str(r.pair) === '' ? {} : { pair: str(r.pair) }),
      ...(r.remove === true ? { remove: true } : {})
    });
  }
  for (const s of shorthand) {
    if (!positions.some((x) => x.key === s.position)) { warnings.push(t('communitiesJson.read.peopleNoPosition', { unit: s.unit, position: s.position })); continue; }
    for (const said of s.names) {
      const ref = said.startsWith('@') ? said.slice(1) : null;
      const key = ref ?? slug(said);
      if (ref !== null && !persons.some((p) => p.key === ref)) { warnings.push(t('communitiesJson.read.peopleNoPerson', { unit: s.unit, name: said })); continue; }
      add({ key, name: ref === null ? said.slice(0, 120) : persons.find((p) => p.key === ref)!.name, places: [{ unit: s.unit, position: s.position }] });
    }
  }
  for (const p of persons) if (p.pair !== undefined && !persons.some((o) => o.key === p.pair)) warnings.push(t('communitiesJson.read.personNoPair', { key: p.key, pair: p.pair }));

  return {
    doc: { name: str(value.name).slice(0, 120) || unit.name, positions, fields, blueprints, unit, persons },
    warnings
  };
}

/* -- Ausgeben -------------------------------------------------------------------------- */

const settingsOut = (s: Settings | undefined) => (s === undefined || Object.keys(s).length === 0 ? {} : { settings: s });

function unitOut(u: Unit, names: ReadonlyMap<string, string>): Record<string, unknown> {
  return {
    key: u.key, name: names.get(u.key) ?? u.name,
    ...(u.kind === undefined ? {} : { kind: u.kind }),
    ...(u.from === undefined ? {} : { from: u.from }),
    ...(u.positions === undefined ? {} : { positions: u.positions }),
    ...settingsOut(u.settings),
    ...(u.council === undefined ? {} : { council: u.council }),
    ...(u.pagesBy === undefined ? {} : { pagesBy: u.pagesBy }),
    ...(u.address === undefined ? {} : { address: u.address }),
    ...(u.remove === true ? { remove: true } : {}),
    ...(u.extra === undefined ? {} : { extra: u.extra }),
    ...((u.units ?? []).length === 0 ? {} : { units: u.units!.map((c) => unitOut(c, names)) })
  };
}

/** Das Dokument zum Weitergeben — ohne Kennungen; `names`: wie die Bereiche jetzt heissen (umbenannt in der App). */
export function exportCommunity(doc: CommunityDoc, names: ReadonlyMap<string, string> = new Map()): Record<string, unknown> {
  return {
    format: COMMUNITY_FORMAT,
    version: 1,
    name: doc.name,
    positions: doc.positions,
    fields: doc.fields,
    blueprints: doc.blueprints.map((b) => ({ ...b })),
    unit: unitOut(doc.unit, names),
    persons: doc.persons.filter((p) => p.remove !== true).map((p) => ({
      key: p.key, name: p.name, places: p.places,
      ...(p.fields === undefined || Object.keys(p.fields).length === 0 ? {} : { fields: p.fields }),
      ...(p.pair === undefined ? {} : { pair: p.pair })
    }))
  };
}

/* -- Beschreibung (für die App und den MCP) -------------------------------------------------- */

const keysOf = (group: string, keys: readonly string[], params: Readonly<Record<string, Readonly<Record<string, string>>>> = {}): Record<string, string> =>
  Object.fromEntries(keys.map((k) => [k, t(`communitiesJson.desc.${group}.${k}`, params[k])]));

const INTRO = (): string => t('communitiesJson.desc.intro');

const TOP = (): string => keyLines({
  format: `"${COMMUNITY_FORMAT}"`,
  version: '1',
  ...keysOf('top', ['name', 'positions', 'fields', 'blueprints', 'unit', 'persons'])
});

const POSITIONS = (): string => t(`communitiesJson.desc.positions.text`, { keys: keyLines({
  ...keysOf('positions', ['key', 'name']),
  rights: RIGHTS.map((r) => `"${r.value}" — ${r.label.toLowerCase()}: ${r.says}`).join('; '),
  ...keysOf('positions', ['pair', 'assign', 'term', 'need', 'per', 'note'], {
    assign: { words: Object.entries(ASSIGN_WORD).map(([k, v]) => `"${k}" (${v})`).join(', ') }
  })
}) });

const FIELDS = (): string => t(`communitiesJson.desc.fields.text`, { keys: keyLines({
  ...keysOf('fields', ['key', 'label']),
  kind: FIELD_KINDS.map((k) => `"${k}"`).join(', '),
  ...keysOf('fields', ['options', 'leadersOnly'])
}) });

const UNITS = (): string => t(`communitiesJson.desc.units.text`, { keys: keyLines(keysOf('units',
  ['key', 'name', 'kind', 'from', 'positions', 'settings', 'council', 'pagesBy', 'people', 'units', 'address', 'area', 'remove', 'extra'],
  {
    kind: { kinds: PROFILE_KINDS.map((k) => `"${k.kind}" (${k.label})`).join(', ') },
    people: { slot: `<${t('communitiesJson.desc.slotPosition')}>` }
  })) });

const SETTINGS_TEXT = (): string => {
  const lines: string[] = [];
  for (const step of [1, 2, 4, 5] as const) {
    lines.push(t(`communitiesJson.desc.settings.step`, { step, title: STEP_TITLES[step] }));
    for (const s of SETTINGS.filter((x) => x.step === step)) {
      const kind = s.choices ? s.choices.map((c) => (c.example ? t(`communitiesJson.desc.settings.choiceExample`, { value: c.value, example: c.example }) : `"${c.value}" (${c.label})`)).join(', ')
        : s.kind === 'bool' ? 'true / false' : s.kind === 'number' ? t(`communitiesJson.desc.settings.number`) : s.kind === 'date' ? t(`communitiesJson.desc.settings.date`) : s.kind === 'time' ? t(`communitiesJson.desc.settings.time`) : t(`communitiesJson.desc.settings.text`);
      const line = t(s.inherit ? `communitiesJson.desc.settings.line` : `communitiesJson.desc.settings.lineNotInherited`, { path: s.path, label: s.label, kind, fallback: JSON.stringify(s.fallback) });
      lines.push(`  ${line}${s.hint ? ` — ${s.hint}` : ''}`);
    }
  }
  return t(`communitiesJson.desc.settings.body`, { lines: lines.join('\n') });
};

const PERSONS = (): string => t(`communitiesJson.desc.persons.text`, { keys: keyLines(keysOf('persons', ['key', 'name', 'places', 'fields', 'pair', 'remove'])) });

const USAGE = (): string => t('communitiesJson.desc.usage');

/** Der Knoten im Baum der Formate — die Beschreibung neben dem Import und im MCP. */
export const COMMUNITY_JSON: JsonNode = {
  key: 'community',
  get title() { return t('communitiesJson.desc.title', { format: COMMUNITY_FORMAT }); },
  text: INTRO,
  inside: () => [
    textNode('community.top', t('communitiesJson.desc.section.top'), TOP),
    textNode('community.usage', t('communitiesJson.desc.section.usage'), USAGE),
    textNode('community.positions', t('communitiesJson.desc.section.positions'), POSITIONS),
    textNode('community.fields', t('communitiesJson.desc.section.fields'), FIELDS),
    textNode('community.units', t('communitiesJson.desc.section.units'), UNITS),
    textNode('community.settings', t('communitiesJson.desc.section.settings'), SETTINGS_TEXT),
    textNode('community.blueprints', t('communitiesJson.desc.section.blueprints'), () => t('communitiesJson.desc.blueprints', { slot: `<${t('communitiesJson.desc.slotKey')}>` })),
    textNode('community.persons', t('communitiesJson.desc.section.persons'), PERSONS),
    ...EXAMPLES.map((e) => textNode(`community.example.${e.key}`, t('communitiesJson.desc.section.example', { label: e.label }), () => pretty(e.doc())))
  ],
  samples: () => EXAMPLES.map((e) => ({ label: e.label, doc: e.doc }))
};

export const communityDescription = (): string => describe(COMMUNITY_JSON);
