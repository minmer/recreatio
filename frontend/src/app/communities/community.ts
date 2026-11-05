/**
 * 0137 — EINE WSPÓLNOTA: ein Baum von Einheiten (Bereichen) mit Positionen (Rollen), Personen
 * (persönliche Links) und den fünf Schritten der geführten Einrichtung je Einheit. Rein, ohne Dienst —
 * `scripts/app-json-community-check.mjs` prüft es.
 *
 * <b>Nichts Neues neben dem Vorhandenen.</b> Eine Einheit IST ein Bereich (`parent_area_id`), eine
 * Position IST eine Rolle des Bereichs (wie `roles` im Dokument eines Bereichs), ein persönlicher
 * Link IST ein Link, der die Rollen der Person hält (0091), die Werkzeuge einer Einheit SIND das
 * Dokument ihres Bereichs (`recreatio/area`: Rozmowy, Termine, Seiten, Formulare). Hier steht nur,
 * was die Teile zusammenhält: wer wo was darf, was geerbt wird, was ein Bauplan vorgibt.
 *
 * <b>Erben.</b> Eine Einstellung gilt, wie sie in der Einheit steht; sonst wie im Bauplan der
 * Einheit; sonst wie in der Einheit darüber (deren eigener Wert, Bauplan, Vater …); sonst der
 * Vorschlag. Was nicht vererbt wird (Gliederung), gilt nur, wo es steht.
 */

import { keyFrom } from '../areas/areaJson';
import type { ProfileKind } from '../areas/profile';
import { hasKey, t, texts } from '../core/i18n';

export const COMMUNITY_FORMAT = 'recreatio/community';

/* -- Positionen und ihre Rechte ---------------------------------------------------- */

export type Rights = 'lead' | 'accompany' | 'cooperate' | 'member' | 'participant';
export type Level = 'read' | 'write' | 'admin';

/** Bezeichnung und Erklärung eines Rechts — beim Lesen übersetzt. */
const right = (value: Rights, level: Level): { readonly value: Rights; readonly label: string; readonly says: string; readonly level: Level } => ({
  value, level,
  get label() { return t(`communities.rights.${value}.label`); },
  get says() { return t(`communities.rights.${value}.says`); }
});

export const RIGHTS: readonly { readonly value: Rights; readonly label: string; readonly says: string; readonly level: Level }[] = [
  right('lead', 'admin'), right('accompany', 'read'), right('cooperate', 'write'), right('member', 'write'), right('participant', 'read')
];

export const rightsLabel = (r: Rights): string => RIGHTS.find((x) => x.value === r)?.label ?? r;
export const levelOf = (r: Rights): Level => RIGHTS.find((x) => x.value === r)?.level ?? 'read';
export const isRights = (v: unknown): v is Rights => RIGHTS.some((r) => r.value === v);

export type Assign = 'appointed' | 'elected' | 'result';
export const ASSIGN_WORD: Readonly<Record<Assign, string>> = texts({ appointed: 'communities.assign.appointed', elected: 'communities.assign.elected', result: 'communities.assign.result' });

export interface Position {
  readonly key: string;
  readonly name: string;
  readonly rights: Rights;
  /** Eine Position für ein Paar (jeder der beiden bekommt einen eigenen Link). */
  readonly pair?: boolean;
  readonly assign?: Assign;
  /** Amtszeit in Worten, z. B. „3 lata, +2 możliwe”. */
  readonly term?: string;
  /** Wie viele in der Einheit gebraucht werden (Besetzung). */
  readonly need?: number;
  /** Oder: einer auf so viele einer anderen Position — z. B. ein Animator auf 4 Teilnehmer. */
  readonly per?: { readonly count: number; readonly of: string };
  readonly note?: string;
}

/* -- Personenfelder (Schritt 4)------------------------------------------------------------- */

export type FieldKind = 'line' | 'text' | 'choice' | 'date' | 'checkbox' | 'number';
export const FIELD_KINDS: readonly FieldKind[] = ['line', 'text', 'choice', 'date', 'checkbox', 'number'];

export interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly options?: readonly string[];
  /** Sehen nur die Leitenden (Gesundheit, Ernährung, Kontakt zu den Eltern). */
  readonly leadersOnly?: boolean;
}

/** Vorschläge für Felder — zur Auswahl in Schritt 4. */
export const FIELD_PRESETS: readonly FieldDef[] = [
  { key: 'glos', get label() { return t('communities.presets.voice'); }, kind: 'choice', options: ['sopran', 'alt', 'tenor', 'bas'] },
  { key: 'stopien', get label() { return t('communities.presets.stage'); }, kind: 'choice', options: ['ODB', 'OND', 'ONŻ I°', 'ONŻ II°', 'ONŻ III°'] }, // i18n-ignore
  { key: 'dieta', get label() { return t('communities.presets.diet'); }, kind: 'text', leadersOnly: true },
  { key: 'zdrowie', get label() { return t('communities.presets.health'); }, kind: 'text', leadersOnly: true },
  { key: 'rodzic', get label() { return t('communities.presets.parent'); }, kind: 'line', leadersOnly: true },
  { key: 'urodzony', get label() { return t('communities.presets.born'); }, kind: 'date', leadersOnly: true },
  { key: 'telefon', get label() { return t('communities.presets.phone'); }, kind: 'line', leadersOnly: true },
  { key: 'zgoda-wizerunek', get label() { return t('communities.presets.photos'); }, kind: 'checkbox' }
];

/* -- Die fünf Schritte ---------------------------------------------------------------- */

export type Step = 1 | 2 | 3 | 4 | 5;
export const STEP_TITLES = texts({
  1: 'communities.steps.s1', 2: 'communities.steps.s2', 3: 'communities.steps.s3', 4: 'communities.steps.s4', 5: 'communities.steps.s5'
}) as Readonly<Record<Step, string>>;

export interface Choice { readonly value: string; readonly label: string; readonly example?: string }

export interface SettingDef {
  readonly path: string;
  readonly step: Step;
  readonly label: string;
  readonly kind: 'choice' | 'bool' | 'text' | 'number' | 'date' | 'day' | 'time';
  readonly choices?: readonly Choice[];
  readonly fallback: string | number | boolean | null;
  /** Vererbt die Einheit darunter? */
  readonly inherit: boolean;
  /** Nur angezeigt, wenn … */
  readonly when?: (get: (path: string) => unknown) => boolean;
  /** Einstellung für Fortgeschrittene — hinter „Więcej”. */
  readonly fine?: boolean;
  readonly hint?: string;
}

/** Die Werte bleiben die polnischen Kürzel des Formats; die Bezeichnung kommt aus der Sprache. */
const DAY_VALUES = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const; // i18n-ignore
const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAYS: readonly Choice[] = DAY_VALUES.map((value, i) => ({ value, get label() { return t(`communities.weekday.${DAY_NAMES[i]}`); } }));

/** Eine Einstellung ohne Text: Bezeichnung, Hinweis und Wahl kommen beim Lesen aus `communities.settings.<pfad>`. */
type RawSetting = Omit<SettingDef, 'label' | 'hint' | 'choices'> & { readonly choices?: readonly string[] | readonly Choice[]; readonly hint?: true };

function setting(raw: RawSetting): SettingDef {
  const { choices, hint, ...rest } = raw;
  const path = raw.path;
  return {
    ...rest,
    get label() { return t(`communities.settings.${path}.label`); },
    get hint() { return hint === true ? t(`communities.settings.${path}.hint`) : undefined; },
    ...(choices === undefined ? {} : {
      choices: choices.map((c): Choice => (typeof c !== 'string' ? c : {
        value: c,
        get label() { return t(`communities.settings.${path}.choices.${c}.label`); },
        get example() { return hasKey(`communities.settings.${path}.choices.${c}.example`) ? t(`communities.settings.${path}.choices.${c}.example`) : undefined; }
      }))
    })
  };
}

const RAW_SETTINGS: readonly RawSetting[] = [
  /* Schritt 1 */
  { path: 'life.duration', step: 1, kind: 'choice', inherit: true, fallback: 'permanent', choices: ['permanent', 'limited'] },
  { path: 'life.from', step: 1, kind: 'date', inherit: false, fallback: null, when: (g) => g('life.duration') === 'limited' },
  { path: 'life.until', step: 1, kind: 'date', inherit: false, fallback: null, when: (g) => g('life.duration') === 'limited' },
  { path: 'life.place', step: 1, kind: 'choice', inherit: true, fallback: 'onsite', choices: ['onsite', 'online', 'both'] },
  { path: 'life.rhythm', step: 1, kind: 'choice', inherit: true, fallback: 'weekly', choices: ['weekly', 'monthly', 'once', 'asNeeded'] },
  { path: 'life.weekday', step: 1, kind: 'day', inherit: true, fallback: null, choices: WEEKDAYS,
    when: (g) => g('life.rhythm') === 'weekly' || g('life.rhythm') === 'monthly' },
  { path: 'life.time', step: 1, kind: 'time', inherit: true, fallback: null,
    when: (g) => g('life.rhythm') === 'weekly' || g('life.rhythm') === 'monthly' },
  { path: 'life.minutes', step: 1, kind: 'number', inherit: true, fallback: 90, fine: true,
    when: (g) => g('life.rhythm') === 'weekly' || g('life.rhythm') === 'monthly' },
  { path: 'life.location', step: 1, kind: 'text', inherit: true, fallback: null,
    when: (g) => g('life.place') !== 'online' },
  { path: 'life.yearFrom', step: 1, kind: 'text', inherit: true, fallback: '09-01', fine: true, hint: true },
  { path: 'life.yearUntil', step: 1, kind: 'text', inherit: true, fallback: '06-30', fine: true },
  { path: 'life.open', step: 1, kind: 'choice', inherit: true, fallback: 'invite', choices: ['anyone', 'invite'] },

  /* Schritt 2 — wird nicht vererbt (betrifft nur diese eine Einheit) */
  { path: 'structure.subgroups', step: 2, kind: 'choice', inherit: false, fallback: 'manual', choices: ['manual', 'byField'] },
  { path: 'structure.byField', step: 2, kind: 'text', inherit: false, fallback: null,
    when: (g) => g('structure.subgroups') === 'byField', hint: true },
  { path: 'structure.council', step: 2, kind: 'bool', inherit: false, fallback: false, hint: true },
  { path: 'structure.founders', step: 2, kind: 'choice', inherit: true, fallback: 'admin', fine: true, choices: ['admin', 'lead'] },

  /* Schritt 4 */
  { path: 'intake.mode', step: 4, kind: 'choice', inherit: true, fallback: 'leaders', choices: ['leaders', 'link', 'signup'] },
  { path: 'intake.limit', step: 4, kind: 'number', inherit: false, fallback: null, when: (g) => g('intake.mode') === 'signup' },
  { path: 'intake.waitlist', step: 4, kind: 'bool', inherit: true, fallback: false, when: (g) => g('intake.mode') === 'signup' },
  { path: 'intake.requires', step: 4, kind: 'text', inherit: true, fallback: null, when: (g) => g('intake.mode') === 'signup' },
  { path: 'intake.confirm', step: 4, kind: 'bool', inherit: true, fallback: true, when: (g) => g('intake.mode') === 'signup', hint: true },
  { path: 'intake.minors', step: 4, kind: 'bool', inherit: true, fallback: false, fine: true },
  { path: 'intake.health', step: 4, kind: 'bool', inherit: true, fallback: false, fine: true },

  /* Schritt 5 — Werkzeuge */
  { path: 'tools.chat', step: 5, kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.announcements', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.askLeaders', step: 5, kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.calendar', step: 5, kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.forms', step: 5, kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.polls', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.attendance', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.lessons', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.cogita', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.notes', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.tables', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.staffing', step: 5, kind: 'bool', inherit: true, fallback: false },
  { path: 'talk.direct', step: 5, kind: 'bool', inherit: true, fallback: false, fine: true },
  /* Schritt 5 — Sichtbarkeit */
  { path: 'visibility.default', step: 5, kind: 'choice', inherit: true, fallback: 'unit', choices: ['me', 'persons', 'position', 'unit', 'subtree', 'public'] },
  { path: 'visibility.subunitsSee', step: 5, kind: 'bool', inherit: false, fallback: false, hint: true },
  /* Schritt 5 — öffentliche Seite */
  { path: 'public.page', step: 5, kind: 'bool', inherit: false, fallback: false },
  { path: 'public.description', step: 5, kind: 'text', inherit: false, fallback: null, when: (g) => g('public.page') === true },
  { path: 'public.meetings', step: 5, kind: 'text', inherit: false, fallback: null, when: (g) => g('public.page') === true },
  { path: 'public.contact', step: 5, kind: 'text', inherit: false, fallback: null, when: (g) => g('public.page') === true },
  { path: 'public.events', step: 5, kind: 'bool', inherit: false, fallback: true, when: (g) => g('public.page') === true },
  { path: 'public.reports', step: 5, kind: 'bool', inherit: false, fallback: false, when: (g) => g('public.page') === true && g('life.duration') === 'limited' }
];

export const SETTINGS: readonly SettingDef[] = RAW_SETTINGS.map(setting);

export const settingDef = (path: string): SettingDef | undefined => SETTINGS.find((s) => s.path === path);

/** Einstellungen der Einheit, wie im JSON: { "life": { "duration": "limited" }, "tools": { … } }. */
export type Settings = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export function getSetting(settings: Settings | undefined, path: string): unknown {
  if (settings === undefined) return undefined;
  const [group, key] = path.split('.');
  const g = settings[group];
  return g === undefined || !Object.prototype.hasOwnProperty.call(g, key) ? undefined : g[key];
}

/** `undefined` entfernt (fällt zurück aufs Erben). */
export function setSetting(settings: Settings | undefined, path: string, value: unknown): Settings {
  const [group, key] = path.split('.');
  const was = settings ?? {};
  const g = { ...(was[group] ?? {}) };
  if (value === undefined) delete g[key]; else g[key] = value;
  const out: Record<string, Readonly<Record<string, unknown>>> = { ...was };
  if (Object.keys(g).length === 0) delete out[group]; else out[group] = g;
  return out;
}

/* -- Einheiten, Baupläne, Personen-------------------------------------------------- */

export interface Council {
  readonly key: string;
  readonly name: string;
  /** Positionen dieser Einheit im Gremium (z. B. Bezirkspaar, Moderator). */
  readonly own: readonly string[];
  /** Positionen der Einheiten direkt darunter (z. B. das Animatorenpaar jedes Kreises). */
  readonly below: readonly string[];
}

export interface Unit {
  readonly key: string;
  readonly name: string;
  readonly kind?: ProfileKind;
  /** Bauplan, aus dem die Einheit Positionen, Einstellungen und Felder übernimmt. */
  readonly from?: string;
  /** Positionen in dieser Einheit (ohne Plan — nur diese; mit Plan — zusätzlich). */
  readonly positions?: readonly string[];
  readonly settings?: Settings;
  readonly council?: Council;
  readonly units?: readonly Unit[];
  /** Adresse der Seiten der Einheit (z. B. "dk/rejon-13"); weggelassen — Adresse der Einheit darüber + Schlüssel. */
  readonly address?: string;
  /** Ein bestehender Bereich, der zu dieser Einheit wird (hierher verschoben) — nur bewusst, z. B. beim Zusammenführen. */
  readonly area?: string;
  /** Aufgelöst: Bereich und Inhalte bleiben, die Gemeinschaft verwaltet ihn nicht mehr. */
  readonly remove?: boolean;
  /** Zusätzliche Teile des Bereichsdokuments (Termine, Seiten, Unterformulare) — wie in „recreatio/area”. */
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface Blueprint {
  readonly key: string;
  readonly name: string;
  readonly kind?: ProfileKind;
  readonly positions?: readonly string[];
  readonly settings?: Settings;
  readonly council?: Council;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface PersonPlace { readonly unit: string; readonly position: string }

export interface Person {
  readonly key: string;
  readonly name: string;
  readonly places: readonly PersonPlace[];
  readonly fields?: Readonly<Record<string, string>>;
  /** Zweite Person des Paares (z. B. Ehepartner) — jeder hat einen eigenen Link, beide dieselbe Position. */
  readonly pair?: string;
  /** Entfernt: ihr Link hört auf zu funktionieren. */
  readonly remove?: boolean;
}

export interface CommunityDoc {
  readonly name: string;
  readonly positions: readonly Position[];
  readonly fields: readonly FieldDef[];
  readonly blueprints: readonly Blueprint[];
  readonly unit: Unit;
  readonly persons: readonly Person[];
}

/* -- Der Baum ------------------------------------------------------------------------- */

export interface FlatUnit {
  readonly unit: Unit;
  readonly parent: string | null;
  readonly depth: number;
  /** Schlüssel von der Wurzel bis zu dieser Einheit. */
  readonly path: readonly string[];
}

/** Einheiten in Baumreihenfolge (Eltern vor Kindern); aufgelöste — auch, mit `unit.remove`. */
export function flatten(root: Unit): FlatUnit[] {
  const out: FlatUnit[] = [];
  const walk = (unit: Unit, parent: string | null, path: readonly string[]) => {
    const here = [...path, unit.key];
    out.push({ unit, parent, depth: path.length, path: here });
    for (const child of unit.units ?? []) walk(child, unit.key, here);
  };
  walk(root, null, []);
  return out;
}

export const unitsOf = (doc: CommunityDoc): FlatUnit[] => flatten(doc.unit).filter((u) => u.unit.remove !== true);
export const findUnit = (doc: CommunityDoc, key: string): FlatUnit | undefined => flatten(doc.unit).find((u) => u.unit.key === key);

export const blueprintOf = (doc: CommunityDoc, unit: Unit): Blueprint | undefined =>
  unit.from === undefined ? undefined : doc.blueprints.find((b) => b.key === unit.from);

/** Positionen der Einheit: aus dem Bauplan und eigene, ohne Doppelungen, nur bekannte. */
export function positionsOf(doc: CommunityDoc, unit: Unit): Position[] {
  const keys = [...(blueprintOf(doc, unit)?.positions ?? []), ...(unit.positions ?? [])];
  const out: Position[] = [];
  for (const key of keys) {
    const p = doc.positions.find((x) => x.key === key);
    if (p !== undefined && !out.some((o) => o.key === key)) out.push(p);
  }
  return out;
}

export const kindOf = (doc: CommunityDoc, unit: Unit): ProfileKind => unit.kind ?? blueprintOf(doc, unit)?.kind ?? 'group';
export const councilOf = (doc: CommunityDoc, unit: Unit): Council | undefined => unit.council ?? blueprintOf(doc, unit)?.council;

/* -- Erben ----------------------------------------------------------------------------- */

export type Source =
  | { readonly kind: 'own' }
  | { readonly kind: 'blueprint'; readonly key: string; readonly name: string }
  | { readonly kind: 'unit'; readonly key: string; readonly name: string }
  | { readonly kind: 'default' };

export interface Resolved { readonly value: unknown; readonly source: Source }

/** Wert der Einstellung in der Einheit und woher er stammt. */
export function resolveSetting(doc: CommunityDoc, unitKey: string, path: string): Resolved {
  const def = settingDef(path);
  const chain = flatten(doc.unit);
  const here = chain.find((u) => u.unit.key === unitKey);
  if (here === undefined) return { value: def?.fallback ?? null, source: { kind: 'default' } };
  const steps = def?.inherit === false ? [here.unit.key] : [...here.path].reverse();
  for (const [i, key] of steps.entries()) {
    const unit = chain.find((u) => u.unit.key === key)!.unit;
    const own = getSetting(unit.settings, path);
    if (own !== undefined) return { value: own, source: i === 0 ? { kind: 'own' } : { kind: 'unit', key: unit.key, name: unit.name } };
    const bp = blueprintOf(doc, unit);
    const fromBp = getSetting(bp?.settings, path);
    if (bp !== undefined && fromBp !== undefined) return { value: fromBp, source: { kind: 'blueprint', key: bp.key, name: bp.name } };
  }
  return { value: def?.fallback ?? null, source: { kind: 'default' } };
}

export const valueOf = (doc: CommunityDoc, unitKey: string, path: string): unknown => resolveSetting(doc, unitKey, path).value;

export function sourceWords(source: Source): string {
  switch (source.kind) {
    case 'own': return t('communities.source.own');
    case 'blueprint': return t('communities.source.blueprint', { name: source.name });
    case 'unit': return t('communities.source.unit', { name: source.name });
    default: return t('communities.source.default');
  }
}

/* -- Schritt 1 schlägt die Schritte 2–5 vor------------------------------------------------------- */

/** Einstellungen, die aus den Antworten von Schritt 1 folgen — nur dort eingetragen, wo noch nichts steht. */
export function suggestFrom(life: Readonly<Record<string, unknown>>): Settings {
  const online = life.place === 'online';
  const limited = life.duration === 'limited';
  const open = life.open === 'anyone';
  return {
    intake: { mode: open ? (limited ? 'signup' : 'link') : 'leaders', ...(open && limited ? { confirm: true } : {}) },
    tools: {
      chat: true,
      announcements: limited || open,
      askLeaders: true,
      calendar: !online || life.rhythm === 'weekly' || life.rhythm === 'monthly',
      attendance: !online && (life.rhythm === 'weekly' || life.rhythm === 'monthly'),
      staffing: limited,
      cogita: online && life.rhythm === 'asNeeded',
      lessons: online && life.rhythm === 'asNeeded'
    },
    public: { page: open },
    visibility: { default: 'unit' }
  };
}

/** Ergänzt Vorschläge nur dort, wo die Einheit keinen eigenen Wert hat. */
export function withSuggestions(settings: Settings | undefined, suggested: Settings): Settings {
  let out: Settings = settings ?? {};
  for (const [group, values] of Object.entries(suggested)) {
    for (const [key, value] of Object.entries(values)) {
      if (getSetting(out, `${group}.${key}`) === undefined) out = setSetting(out, `${group}.${key}`, value);
    }
  }
  return out;
}

/* -- Besetzung------------------------------------------------------------------------------- */

export interface Staffing {
  readonly unit: string;
  readonly unitName: string;
  readonly position: string;
  readonly positionName: string;
  readonly have: number;
  readonly want: number;
}

/** Personen (aktiv) auf der Position in der Einheit. */
export const holdersOf = (doc: CommunityDoc, unitKey: string, positionKey: string): Person[] =>
  doc.persons.filter((p) => p.remove !== true && p.places.some((pl) => pl.unit === unitKey && pl.position === positionKey));

/** Wo jemand fehlt — Positionen mit "need" oder "per" (z. B. Animator auf 4 Teilnehmer, bei Platzlimit). */
export function staffing(doc: CommunityDoc): Staffing[] {
  const out: Staffing[] = [];
  for (const { unit } of unitsOf(doc)) {
    for (const p of positionsOf(doc, unit)) {
      if (p.need === undefined && p.per === undefined) continue;
      const have = holdersOf(doc, unit.key, p.key).length;
      let want = p.need ?? 0;
      if (p.per !== undefined && p.per.count > 0) {
        const base = Math.max(holdersOf(doc, unit.key, p.per.of).length, Number(valueOf(doc, unit.key, 'intake.limit') ?? 0) || 0);
        want = Math.max(want, Math.ceil(base / p.per.count));
      }
      if (want > 0) out.push({ unit: unit.key, unitName: unit.name, position: p.key, positionName: p.name, have, want });
    }
  }
  return out;
}

/* -- Untergruppen nach Merkmal------------------------------------------------------------------- */

/**
 * Eine Einheit mit "structure.subgroups": "byField" bekommt ihre Untergruppen SELBST: eine für jeden Wert
 * des Feldes (ohne Wert — keine), und die Personen dieser Einheit mit diesem Wert — auf die Position des Untergruppenmitglieds.
 * Schlüssel der Untergruppe: "<Einheit>-<Wert>". Beim Import berechnet; im Dokument gibt es sie nicht.
 */
export function withAutoSubgroups(doc: CommunityDoc): CommunityDoc {
  const memberish = (unit: Unit): Position | undefined => positionsOf(doc, unit).find((p) => p.rights === 'member' || p.rights === 'participant');
  let persons = [...doc.persons];
  const grow = (unit: Unit): Unit => {
    const children = (unit.units ?? []).map(grow);
    if (unit.remove === true || valueOf(doc, unit.key, 'structure.subgroups') !== 'byField') return { ...unit, units: children };
    const field = String(valueOf(doc, unit.key, 'structure.byField') ?? '');
    const def = doc.fields.find((f) => f.key === field);
    const member = memberish(unit);
    if (def === undefined || member === undefined) return { ...unit, units: children };
    const people = persons.filter((p) => p.remove !== true && p.places.some((pl) => pl.unit === unit.key));
    const values = [...new Set([...(def.options ?? []), ...people.map((p) => p.fields?.[field] ?? '').filter((v) => v !== '')])];
    const made: Unit[] = [];
    for (const value of values) {
      const key = `${unit.key}-${slug(value)}`.slice(0, 40);
      if (children.some((c) => c.key === key)) continue;
      made.push({ key, name: `${unit.name} — ${value}`, kind: 'group', positions: [member.key] });
      persons = persons.map((p) => (p.remove !== true && p.fields?.[field] === value && p.places.some((pl) => pl.unit === unit.key)
        && !p.places.some((pl) => pl.unit === key)
        ? { ...p, places: [...p.places, { unit: key, position: member.key }] } : p));
    }
    return { ...unit, units: [...children, ...made] };
  };
  const unit = grow(doc.unit);
  return { ...doc, unit, persons };
}

/** „Rejon XIII” → „rejon-xiii” — derselbe Schlüssel wie im Dokument eines Bereichs (`keyFrom`), hier bis 40 Zeichen. */
export const slug = (name: string, max = 40): string => keyFrom(name, max);

/** Die Stufen der Reihe nach — „wer darf mehr“. */
export const rankOf = (level: string): number => ({ read: 1, write: 2, admin: 3 } as Record<string, number>)[level] ?? 0;

export const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
