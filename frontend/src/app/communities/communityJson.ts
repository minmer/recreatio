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
import {
  ASSIGN_WORD, COMMUNITY_FORMAT, FIELD_KINDS, flatten, isRights, KEY, RIGHTS, SETTINGS, settingDef, slug, STEP_TITLES,
  type Assign, type Blueprint, type CommunityDoc, type Council, type FieldDef, type FieldKind, type Person, type PersonPlace,
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
  if (!isRecord(raw)) { warnings.push(`${where}: "settings" to obiekt — pominięte.`); return undefined; }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [group, values] of Object.entries(raw)) {
    if (!isRecord(values)) { warnings.push(`${where}: "settings.${group}" to obiekt — pominięte.`); continue; }
    for (const [key, value] of Object.entries(values)) {
      const path = `${group}.${key}`;
      const def = settingDef(path);
      if (def === undefined) { warnings.push(`${where}: nieznane ustawienie "${path}" — pominięte.`); continue; }
      let ok: unknown = undefined;
      if (value === null) ok = null;
      else if (def.kind === 'bool') ok = typeof value === 'boolean' ? value : undefined;
      else if (def.kind === 'number') ok = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
      else if (def.kind === 'choice' || def.kind === 'day') ok = def.choices?.some((c) => c.value === value) ? value : undefined;
      else if (def.kind === 'date') ok = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
      else if (def.kind === 'time') ok = typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value) ? value : undefined;
      else ok = typeof value === 'string' ? value.slice(0, 2000) : undefined;
      if (ok === undefined) {
        warnings.push(`${where}: "${path}" — ${def.choices ? `dozwolone ${def.choices.map((c) => `"${c.value}"`).join(', ')}` : `oczekiwane: ${def.kind}`}; pominięte.`);
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
  if (!KEY.test(key) || name === '') { warnings.push(`${where}: "council" potrzebuje "key" i "name" — pominięte.`); return undefined; }
  return { key, name: name.slice(0, 120), own: list(r.own).map(str).filter((k) => k !== ''), below: list(r.below).map(str).filter((k) => k !== '') };
}

function readExtra(raw: unknown, where: string, warnings: string[]): Readonly<Record<string, unknown>> | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) { warnings.push(`${where}: "extra" to obiekt — pominięte.`); return undefined; }
  const allowed = new Set(['appointments', 'pages', 'subforms', 'card', 'category', 'listings', 'chats', 'publish']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (allowed.has(k)) out[k] = v; else warnings.push(`${where}: "extra.${k}" — w "extra" dozwolone: ${[...allowed].join(', ')}; pominięte.`);
  }
  return out;
}

interface Shorthand { readonly unit: string; readonly position: string; readonly names: readonly string[] }

function readUnit(raw: unknown, where: string, warnings: string[], seen: Set<string>, people: Shorthand[], depth: number): Unit | null {
  const r = rec(raw);
  const name = str(r.name);
  const key = str(r.key) || (name === '' ? '' : slug(name));
  if (!KEY.test(key)) { warnings.push(`${where}: "key" to krótka nazwa (małe litery, cyfry, - i _, do 40 znaków) — jednostka pominięta.`); return null; }
  if (seen.has(key)) { warnings.push(`Jednostka „${key}” powtarza się — liczy się pierwsza.`); return null; }
  if (name === '') { warnings.push(`Jednostka „${key}” bez "name" — pominięta.`); return null; }
  if (seen.size >= MAX_UNITS) { warnings.push(`Najwyżej ${MAX_UNITS} jednostek — reszta pominięta.`); return null; }
  if (depth > 12) { warnings.push(`Jednostka „${key}”: najwyżej 12 poziomów — pominięta.`); return null; }
  seen.add(key);
  const at = `Jednostka „${key}”`;
  const kindSaid = str(r.kind);
  if (kindSaid !== '' && !KINDS.has(kindSaid)) warnings.push(`${at}: "kind" — dozwolone ${[...KINDS].map((k) => `"${k}"`).join(', ')}; pominięte.`);
  const area = str(r.area);
  if (area !== '' && !/^[0-9a-f-]{36}$/i.test(area)) warnings.push(`${at}: "area" to identyfikator istniejącego obszaru — pominięte.`);
  const address = has(r, 'address') ? str(r.address).replace(/^\/+|\/+$/g, '').toLowerCase() : '';
  if (address !== '' && !address.split('/').every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) warnings.push(`${at}: "address" — małe litery, cyfry i „-”, części oddzielone „/”; pominięte.`);
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
  const extra = readExtra(r.extra, at, warnings);
  return {
    key, name: name.slice(0, 120),
    ...(KINDS.has(kindSaid) ? { kind: kindSaid as ProfileKind } : {}),
    ...(str(r.from) === '' ? {} : { from: str(r.from) }),
    ...(has(r, 'positions') ? { positions: list(r.positions).map(str).filter((k) => k !== '') } : {}),
    ...(settings === undefined ? {} : { settings }),
    ...(council === undefined ? {} : { council }),
    ...(units.length === 0 ? {} : { units }),
    ...(address === '' || !address.split('/').every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) ? {} : { address }),
    ...(/^[0-9a-f-]{36}$/i.test(area) ? { area: area.toLowerCase() } : {}),
    ...(r.remove === true ? { remove: true } : {}),
    ...(extra === undefined ? {} : { extra })
  };
}

/** DULDSAM LESEN — was nicht passt, fällt weg, mit einem Wort dazu. Ein Fehler nur, wenn es gar keine Wspólnota ist. */
export function readCommunity(value: unknown): { doc: CommunityDoc; warnings: string[] } | { error: string } {
  if (!isRecord(value)) return { error: 'Dokument wspólnoty to jeden obiekt JSON ({ … }).' };
  if (str(value.format) === 'recreatio/area') return { error: 'To dokument jednego obszaru ("recreatio/area") — zaimportuj go w zakładce rodzaju obszaru albo włóż jego części w "extra" jednostki.' };
  if (str(value.format) !== COMMUNITY_FORMAT) return { error: `To nie jest dokument wspólnoty — "format" ma być "${COMMUNITY_FORMAT}".` };
  const warnings: string[] = [];
  const known = new Set(['format', 'version', 'name', 'positions', 'fields', 'blueprints', 'unit', 'persons']);
  for (const k of Object.keys(value)) if (!known.has(k)) warnings.push(`Nieznany klucz "${k}" — pominięty.`);

  /* Positionen. */
  const positions: Position[] = [];
  for (const [i, raw] of list(value.positions).entries()) {
    const r = rec(raw);
    const name = str(r.name);
    const key = str(r.key) || (name === '' ? '' : slug(name, 32));
    if (!POSITION_KEY.test(key)) { warnings.push(`"positions"[${i}]: "key" do 32 znaków (małe litery, cyfry, - i _) — pominięta.`); continue; }
    if (positions.some((p) => p.key === key)) { warnings.push(`Pozycja „${key}” powtarza się — liczy się pierwsza.`); continue; }
    if (name === '') { warnings.push(`Pozycja „${key}” bez "name" — pominięta.`); continue; }
    const rights = isRights(r.rights) ? r.rights : 'member';
    if (!isRights(r.rights)) warnings.push(`Pozycja „${key}”: "rights" — ${RIGHTS.map((x) => `"${x.value}"`).join(', ')}; będzie "member".`);
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
    if (!POSITION_KEY.test(key) || label === '') { warnings.push(`"fields"[${i}]: potrzebne "key" i "label" — pominięte.`); continue; }
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
    if (!KEY.test(key) || name === '') { warnings.push(`"blueprints"[${i}]: potrzebne "key" i "name" — pominięty.`); continue; }
    if (blueprints.some((b) => b.key === key)) continue;
    const at = `Plan „${key}”`;
    const settings = readSettings(r.settings, at, warnings);
    const council = readCouncil(r.council, at, warnings);
    const extra = readExtra(r.extra, at, warnings);
    blueprints.push({
      key, name: name.slice(0, 120),
      ...(KINDS.has(str(r.kind)) ? { kind: str(r.kind) as ProfileKind } : {}),
      ...(has(r, 'positions') ? { positions: list(r.positions).map(str).filter((k) => k !== '') } : {}),
      ...(settings === undefined ? {} : { settings }),
      ...(council === undefined ? {} : { council }),
      ...(extra === undefined ? {} : { extra })
    });
  }

  /* Einheiten. */
  const shorthand: Shorthand[] = [];
  const seen = new Set<string>();
  const unit = isRecord(value.unit) ? readUnit(value.unit, '"unit"', warnings, seen, shorthand, 0) : null;
  if (unit === null) return { error: 'Brakuje "unit" — jednostki na górze wspólnoty (z "key" i "name").' };

  /* Prüfung der Verweise. */
  const unitKeys = new Set(flatten(unit).map((u) => u.unit.key));
  for (const { unit: u } of flatten(unit)) {
    if (u.from !== undefined && !blueprints.some((b) => b.key === u.from)) warnings.push(`Jednostka „${u.key}”: planu „${u.from}” nie ma w "blueprints".`);
    for (const p of u.positions ?? []) if (!positions.some((x) => x.key === p)) warnings.push(`Jednostka „${u.key}”: pozycji „${p}” nie ma w "positions" — pominięta.`);
  }
  for (const b of blueprints) for (const p of b.positions ?? []) if (!positions.some((x) => x.key === p)) warnings.push(`Plan „${b.key}”: pozycji „${p}” nie ma w "positions".`);

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
    if (!KEY.test(key)) { warnings.push(`"persons"[${i}]: "key" albo "name" — pominięta.`); continue; }
    if (name === '' && r.remove !== true) { warnings.push(`Osoba „${key}” bez "name" — pominięta.`); continue; }
    if (persons.length >= MAX_PERSONS) { warnings.push(`Najwyżej ${MAX_PERSONS} osób — reszta pominięta.`); break; }
    const places: PersonPlace[] = [];
    for (const pl of list(r.places)) {
      const p = rec(pl);
      const u = str(p.unit);
      const pos = str(p.position);
      if (!unitKeys.has(u)) { warnings.push(`Osoba „${key}”: jednostki „${u}” nie ma — miejsce pominięte.`); continue; }
      if (!positions.some((x) => x.key === pos)) { warnings.push(`Osoba „${key}”: pozycji „${pos}” nie ma — miejsce pominięte.`); continue; }
      places.push({ unit: u, position: pos });
    }
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec(r.fields))) {
      if (!fields.some((x) => x.key === k)) { warnings.push(`Osoba „${key}”: pola „${k}” nie ma w "fields" — pominięte.`); continue; }
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
    if (!positions.some((x) => x.key === s.position)) { warnings.push(`Jednostka „${s.unit}”: "people" — pozycji „${s.position}” nie ma; pominięte.`); continue; }
    for (const said of s.names) {
      const ref = said.startsWith('@') ? said.slice(1) : null;
      const key = ref ?? slug(said);
      if (ref !== null && !persons.some((p) => p.key === ref)) { warnings.push(`Jednostka „${s.unit}”: osoby „${said}” nie ma w "persons" — pominięta.`); continue; }
      add({ key, name: ref === null ? said.slice(0, 120) : persons.find((p) => p.key === ref)!.name, places: [{ unit: s.unit, position: s.position }] });
    }
  }
  for (const p of persons) if (p.pair !== undefined && !persons.some((o) => o.key === p.pair)) warnings.push(`Osoba „${p.key}”: pary „${p.pair}” nie ma w "persons".`);

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

const INTRO = (): string => `Jeden dokument opisuje całą wspólnotę: drzewo jednostek (np. diecezja → rejony → kręgi, szkoła → klasy, turnus → grupy), pozycje z ich prawami, plany budowy podobnych jednostek, osoby z ich pozycjami i ustawienia pięciu kroków prowadzonej konfiguracji. To ten sam dokument, który powstaje w „Wspólnoty” → „Nowa wspólnota” i który pokazuje zakładka JSON wspólnoty.
Co robi import:
- Najpierw pokazuje plan (listę zmian): nowe i przeniesione jednostki, role, dostępy, linki osób, części obszarów. Zapisuje dopiero po „Importuj”.
- Jednostka = obszar w Recreatio (pod obszarem jednostki wyżej). Pozycja w jednostce = rola tego obszaru („Para animatorska · Krąg 3”). Osoba = jeden osobisty link, który trzyma wszystkie jej role (w kręgu jest członkiem, w rejonie prowadzi). Narzędzia jednostki (rozmowy, kalendarz, strony, zapisy) powstają jako dokument obszaru („recreatio/area”) i idą tym samym importem.
- Wszystko nazywa się kluczami. Wspólnota pamięta, co pod którym kluczem powstało: ten sam dokument zaimportowany jeszcze raz ZMIENIA to samo (nazwy, położenie w drzewie, obsadę, ustawienia), zamiast dublować. Dokument z innej wspólnoty zakłada tu wszystko od nowa.
- Niczego nie kasuje bez słowa: jednostka z "remove": true przestaje być zarządzana (obszar i treści zostają), osoba z "remove": true traci link. Jednostka albo osoba, której brak w dokumencie, zostaje bez zmian.
- Zmiana ról osoby (nowa pozycja, oddana pozycja) daje jej NOWY link, a stary przestaje działać. Treści zostają przy pozycji — przejmuje je następca.
Zwróć JEDEN obiekt JSON, bez komentarzy.`;

const TOP = (): string => keyLines({
  format: `"${COMMUNITY_FORMAT}"`,
  version: '1',
  name: 'nazwa wspólnoty (pominięta — nazwa jednostki na górze)',
  positions: 'pozycje — każda opisana raz, używana w wielu jednostkach (niżej: Pozycje)',
  fields: 'pola osób z kroku 4 (niżej: Pola osób)',
  blueprints: 'plany budowy podobnych jednostek (niżej: Plany budowy)',
  unit: 'jednostka na górze, z jednostkami w "units" (niżej: Jednostki)',
  persons: 'osoby z ich miejscami (niżej: Osoby); osoby można też wpisać grupą w "people" jednostki'
});

const POSITIONS = (): string => `Wpis w "positions":
${keyLines({
  key: 'krótka nazwa (małe litery, cyfry, - i _, do 32 znaków), np. "para-animatorska"',
  name: 'nazwa, np. "Para animatorska"',
  rights: RIGHTS.map((r) => `"${r.value}" — ${r.label.toLowerCase()}: ${r.says}`).join('; '),
  pair: 'true — obsadza ją para; każde z dwojga to osobna osoba z własnym linkiem, oboje na tej samej pozycji (piszą jako ta sama rola, widać, kto pisał)',
  assign: `jak się ją obsadza: ${Object.entries(ASSIGN_WORD).map(([k, v]) => `"${k}" (${v})`).join(', ')} — informacja dla prowadzących`,
  term: 'kadencja słowami, np. "3 lata, +2 możliwe"',
  need: 'ilu potrzeba w każdej jednostce z tą pozycją (obsada: „brakuje 2”)',
  per: '{ "count": 4, "of": "uczestnik" } — jedna osoba na tylu z innej pozycji (albo na tyle miejsc z "intake.limit")',
  note: 'uwaga, np. "wybierana w czerwcu; na początku mianuje para pilotująca na rok"'
})}
Prawa przekładają się na dostęp: prowadzenie — "admin" w swojej jednostce i we wszystkich pod nią (i trzyma pozostałe pozycje swojej jednostki, więc może dawać ich linki); towarzyszenie — czyta swoją jednostkę i wszystkie pod nią; współpraca i członkostwo — piszą w swojej jednostce; uczestnictwo — czyta.`;

const FIELDS = (): string => `Wpis w "fields" — pole osoby (np. głos, stopień formacji, dieta):
${keyLines({
  key: 'krótka nazwa, np. "glos"',
  label: 'napis, np. "Głos"',
  kind: FIELD_KINDS.map((k) => `"${k}"`).join(', '),
  options: 'dla "choice": lista wartości, np. ["sopran", "alt", "tenor", "bas"]',
  leadersOnly: 'true — widzą tylko prowadzący (zdrowie, dieta, kontakt do rodziców)'
})}
Pole z "options" może dzielić jednostkę na podgrupy samo ("structure.subgroups": "byField", "structure.byField": "glos").`;

const UNITS = (): string => `Jednostka ("unit" i każdy wpis w "units"):
${keyLines({
  key: 'krótka nazwa (do 40 znaków), np. "krag-3"; pominięta — z nazwy',
  name: 'nazwa, np. "Krąg 3"',
  kind: `rodzaj obszaru: ${PROFILE_KINDS.map((k) => `"${k.kind}" (${k.label})`).join(', ')}; pominięty — z planu albo "group"`,
  from: 'klucz planu budowy z "blueprints" — jednostka bierze z niego pozycje, ustawienia i części; zmiana planu zmienia wszystkie jednostki z niego, poza tym, co jednostka ustawiła sama',
  positions: 'klucze pozycji tej jednostki (dodatkowo do tych z planu)',
  settings: 'ustawienia pięciu kroków (niżej: Ustawienia); czego nie ma, jest odziedziczone',
  council: '{ "key", "name", "own": [pozycje tej jednostki], "below": [pozycje jednostek bezpośrednio pod nią] } — grono (np. krąg rejonowy); obszar pod jednostką, jego skład liczy się sam z obsady',
  people: '{ "<pozycja>": ["Imię Nazwisko", "@klucz-osoby", …] } — osoby grupą, np. wszyscy uczniowie 2b; dokładniej — w "persons"',
  units: 'jednostki pod nią',
  address: 'adres stron jednostki, np. "dk/rejon-13"; pominięty — adres jednostki wyżej + "/" + klucz (na górze: z nazwy wspólnoty)',
  area: 'identyfikator ISTNIEJĄCEGO obszaru, który staje się tą jednostką i zostaje przeniesiony w to miejsce (np. dwa rejony pod nową diecezję) — tylko świadomie',
  remove: 'true — rozwiązana: wspólnota przestaje nią zarządzać (zdejmuje dostępy, które dała); obszar i treści zostają',
  extra: 'dodatkowe części dokumentu obszaru — "appointments", "pages", "subforms", "card", "category", "listings", "chats", "publish" — dokładnie jak w formacie „area”'
})}
Przeniesienie jednostki = ten sam "key" w innym miejscu drzewa: import przenosi obszar (osoba importująca prowadzi oba miejsca); zmienia też dostępy liczone z drzewa (prowadzący wyżej, towarzyszący, „jednostki niżej widzą tę”).`;

const SETTINGS_TEXT = (): string => {
  const lines: string[] = [];
  for (const step of [1, 2, 4, 5] as const) {
    lines.push(`Krok ${step} — ${STEP_TITLES[step]}`);
    for (const s of SETTINGS.filter((x) => x.step === step)) {
      const kind = s.choices ? s.choices.map((c) => `"${c.value}"${c.example ? ` (np. ${c.example})` : ` (${c.label})`}`).join(', ')
        : s.kind === 'bool' ? 'true / false' : s.kind === 'number' ? 'liczba' : s.kind === 'date' ? '"RRRR-MM-DD"' : s.kind === 'time' ? '"GG:MM"' : 'tekst';
      lines.push(`  "${s.path}" — ${s.label}: ${kind}; bez wartości: ${JSON.stringify(s.fallback)}${s.inherit ? '' : ' (nie dziedziczy się)'}${s.hint ? ` — ${s.hint}` : ''}`);
    }
  }
  return `"settings": { "life": { … }, "structure": { … }, "intake": { … }, "tools": { … }, "talk": { … }, "visibility": { … }, "public": { … } }. Krok 3 (kto co robi) to "positions" jednostki i "persons".
${lines.join('\n')}
Wartość ustawiona w jednostce wygrywa; bez niej — z jej planu budowy; bez niego — z jednostki wyżej (jej wartość, plan …); na końcu propozycja.`;
};

const PERSONS = (): string => `Wpis w "persons":
${keyLines({
  key: 'krótka nazwa (pominięta — z imienia i nazwiska), np. "anna-kowalska"',
  name: 'imię i nazwisko — zapieczętowane w obszarach jednostek; usługa ich nie widzi',
  places: '[{ "unit": "krag-3", "position": "czlonek" }, { "unit": "rejon-13", "position": "para-rejonowa" }] — wszystkie miejsca osoby; członkostwo i pozycja są osobno',
  fields: '{ "glos": "tenor" } — wartości pól z "fields"',
  pair: 'klucz drugiej osoby pary',
  remove: 'true — osoba odchodzi: jej link przestaje działać'
})}
Każda osoba dostaje JEDEN osobisty link (bez konta), który trzyma role wszystkich jej miejsc; otwiera się na „Moje wspólnoty” (#/moje): powitanie, jednostki z rolą, co nowego. Linki pokazuje import i zakładka „Osoby” wspólnoty; podpis linku nie zawiera imienia.`;

const USAGE = (): string => `- „Wspólnoty” (#/workspace/wspolnoty) pokazuje drzewo (mapa do przeciągania albo lista na telefonie), ustawienia każdej jednostki w pięciu krokach z „odziedziczone z …” / „ustawione tutaj” i „Przywróć odziedziczone”, osoby z linkami, obsadę (gdzie kogoś brakuje), JSON i historię zmian z „Przywróć tę wersję”.
- Każdy obszar jednostki pokazuje „Zarządzane przez wspólnotę …” z odnośnikiem; zmiany robione tam ręcznie następny import może nadpisać.
- Osoba z linkiem widzi tylko swoje jednostki: rozmowy (gdy "tools.chat"), kalendarz z terminami wyżej (gdy "visibility.subunitsSee" wyżej), stronę jednostki („dla nas”), „Napisz do prowadzących” ("tools.askLeaders").
- Grono (council) ma własną rozmowę; należą do niego role pozycji z "own" i "below" — gdy zmienia się obsada, zmienia się grono.
- Zapisy publiczne ("intake.mode": "signup") stoją na stronie jednostki; zgłoszeni dostają rolę pozycji uczestnika (pierwszej z prawem "participant" albo "member").
- Pole "leadersOnly" i "intake.health" — dane tylko dla prowadzących (pytania w podformularzu prowadzących albo w wymaganiach formularza).
- Czego import nie robi sam (ustawienie zostaje zapisane i pokazane w jednostce z drogą do narzędzia): lekcje i materiały (Skryptorium / Biblioteka, w klasie — zakładka Klasa), nauka z Cogitą (moduły powtórki na stronie jednostki), ankiety w dół, obecność i własne tabele (formularz z rozszerzeniami prowadzących), limit miejsc i lista rezerwowa (informacja w formularzu; liczenie miejsc nie jest zbudowane).`;

/** Der Knoten im Baum der Formate — die Beschreibung neben dem Import und im MCP. */
export const COMMUNITY_JSON: JsonNode = {
  key: 'community',
  title: `Wspólnota jako JSON ("${COMMUNITY_FORMAT}", wersja 1)`,
  text: INTRO,
  inside: () => [
    textNode('community.top', 'Wspólnota', TOP),
    textNode('community.usage', 'Jak aplikacja używa tych danych', USAGE),
    textNode('community.positions', 'Pozycje', POSITIONS),
    textNode('community.fields', 'Pola osób', FIELDS),
    textNode('community.units', 'Jednostki', UNITS),
    textNode('community.settings', 'Ustawienia (pięć kroków)', SETTINGS_TEXT),
    textNode('community.blueprints', 'Plany budowy', () => `Wpis w "blueprints": { "key", "name", "kind", "positions", "settings", "council", "extra" } — jak jednostka, bez "units". Jednostka z "from": "<klucz>" bierze z niego wszystko, czego nie ustawi sama. Plan powstaje też w aplikacji z istniejącej jednostki („Zapisz jako plan budowy”).`),
    textNode('community.persons', 'Osoby', PERSONS),
    ...EXAMPLES.map((e) => textNode(`community.example.${e.key}`, `Przykład: ${e.label}`, () => pretty(e.doc())))
  ],
  samples: () => EXAMPLES.map((e) => ({ label: e.label, doc: e.doc }))
};

export const communityDescription = (): string => describe(COMMUNITY_JSON);
