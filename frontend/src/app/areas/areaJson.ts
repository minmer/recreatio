/**
 * 0133 — DAS GANZE OBSZAR ALS EIN DOKUMENT („recreatio/area"): lesen, prüfen,
 * planen. Rein, ohne Dienst — `scripts/app-duty-check.mjs` prüft es; der Import
 * selbst steht in `areaImport.ts`, der Export in `areaExport.ts`.
 *
 * <b>Ein Dokument für alles, was ein Wydarzenie (eine Grupa, eine Parafia, ein
 * Kurs) braucht:</b> das Profil mit seiner Wizytówka, Rollen (mit Links),
 * Termine mit Programm, Seiten (je eine „recreatio/page", Formulare darin),
 * Unterformulare, Rozmowy und Listen, in denen es stehen will. Ein Sprachmodell
 * bekommt den Export des letzten Wydarzenie und schreibt daraus das nächste.
 *
 * <b>Schlüssel statt Kennungen.</b> Das Dokument nennt nichts beim Identifikator
 * des Dienstes: Rollen, Seiten, Termine, Bausteine heissen mit kurzen Namen
 * („organizatorzy", „zapisy", „main"). Der Bereich merkt sich, was ein Import
 * unter welchem Namen angelegt hat (`area_import_key`); derselbe Name beim
 * nächsten Import heisst „dieses ändern". Ein Dokument, das aus einem anderen
 * Bereich kommt, legt deshalb hier alles NEU an — es kann nie das Formular, die
 * Seite oder die Rolle des alten Wydarzenie treffen.
 *
 * <b>Verweise</b> (nur als ganzer Wert, nie mitten im Text): "@area" — dieser
 * Bereich; "@form:seite/baustein" (oder der Schlüssel eines Unterformulars);
 * "@page:seite" — die Adresse einer Seite; "@role:rolle" — eine Rolle; in den
 * Kalenderfeldern der Bausteine ("item", "calendar", "calendars") "@termin" und
 * "@kalendarz" (der Kalender des Bereichs), wie im Dokument einer Seite.
 */

import { readAppointments, DEFAULT_ENTRY, type AppointmentDoc, type AppointmentsPlan } from '../calendar/appointmentsJson';
import { PAGE_FORMAT, planImport, referenceFieldsOf, type ImportOptions, type PagePlan } from '../pages/pageJson';
import type { PageNowBase } from '../pages/pageImportRun';
import { previewImageNeeds } from '../pages/pageImageNeeds';
import type { DraftPart } from '../pages/page';
import { partOf } from '../pages/parts/registry';
import { NO_LOOK } from '../pages/slides/slideLook';
import { readModuleWish, type ModuleWish } from '../modules/moduleWish';
import type { ModuleRow } from '../modules/module';
import type { PageCard } from '../workspace/desk';
import { t, texts } from '../core/i18n';
import type { AreaRow } from './area';
import { defaultPublishArea, kindLabel, PROFILE_KINDS, type ImportKey, type ImportKeyKind, type ProfileKind, type ProfileState } from './profile';

export const AREA_FORMAT = 'recreatio/area';

/* -- Kleine Leser --------------------------------------------------------------- */

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const has = (row: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(row, key);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Polnische Mehrzahl mit der Zahl davor: „1 rola", „3 role", „5 ról". */
export const many = (n: number, one: string, few: string, lots: string): string =>
  `${n} ${n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : lots}`;

/* -- Schlüssel ------------------------------------------------------------------ */

/** Eine Rolle, ein Unterformular, ein Baustein auf seiner Seite. */
export const KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
/** Eine Seite — kürzer, weil ihre Bausteine „seite/baustein" heissen (der Dienst nimmt höchstens 60 Zeichen). */
export const PAGE_KEY = /^[a-z0-9][a-z0-9_-]{0,23}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);

/** Der Baustein „Napisz do nas" — sein Bereich der Antwortenden entsteht beim Import des Bereichs. */
export const ASK_KIND = 'seat-ask';

export const MAX_ROLES = 20;
export const MAX_PAGES = 30;
export const MAX_SUBFORMS = 20;
export const MAX_LISTINGS = 10;

/** Der Name eines Bausteins in den Schlüsseln des Bereichs: „zapisy/formularz". */
export const entryRef = (pageKey: string, entryKey: string): string => `${pageKey}/${entryKey}`;

/** Was ein Import in diesem Bereich schon angelegt hat — nach Art und Schlüssel. */
export interface KeyBook {
  readonly all: readonly ImportKey[];
  readonly get: (kind: ImportKeyKind, key: string) => ImportKey | undefined;
  /** Der Schlüssel, unter dem diese Kennung steht. */
  readonly keyOf: (kind: ImportKeyKind, refId: string) => ImportKey | undefined;
}

export function keyBook(keys: readonly ImportKey[]): KeyBook {
  const byKey = new Map(keys.map((k) => [`${k.kind}\u0000${k.key}`, k] as const));
  const byRef = new Map<string, ImportKey>();
  for (const k of keys) if (k.refId !== null && !byRef.has(`${k.kind}\u0000${k.refId}`)) byRef.set(`${k.kind}\u0000${k.refId}`, k);
  return {
    all: keys,
    get: (kind, key) => byKey.get(`${kind}\u0000${key}`),
    keyOf: (kind, refId) => byRef.get(`${kind}\u0000${refId.toLowerCase()}`) ?? byRef.get(`${kind}\u0000${refId}`)
  };
}

/** Ein Schlüssel aus einem Namen: „Rada parafialna" → „rada-parafialna" (höchstens `max` Zeichen). */
export function keyFrom(name: string, max = 32): string {
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l') // i18n-ignore — Schlüssel ohne Diakritika
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
  return slug === '' ? 'x' : slug;
}

/** Ein Schlüssel, den es noch nicht gibt: „x", „x-2", „x-3" … */
export function freeKey(wanted: string, taken: ReadonlySet<string>, max = 32): string {
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; n < 1000; n += 1) {
    const tail = `-${n}`;
    const one = `${wanted.slice(0, max - tail.length).replace(/-+$/g, '')}${tail}`;
    if (!taken.has(one)) return one;
  }
  return `${wanted.slice(0, max - 9)}-${Date.now() % 100_000_000}`;
}

/* -- Adressen ------------------------------------------------------------------- */

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_ROOTS = new Set(['workspace', 'seat', 'verify', 'dolacz', 'widget', 'plik', 'polacz-ai', 'zglos', 'moje']);
export const MAX_PATH = 200;

/** „/Parafia/Rekolekcje/" → „parafia/rekolekcje". */
export const normalisePath = (value: string): string => value.trim().replace(/^\/+|\/+$/g, '').toLowerCase();

/** Warum es keine Adresse sein kann — oder `null`. Dieselbe Regel wie der Dienst (`Slug.IsWellFormed`, `IsReserved`). */
export function pathProblem(path: string): string | null {
  if (path === '') return t('areasJson.path.empty');
  if (path.length > MAX_PATH) return t('areasJson.path.tooLong', { max: MAX_PATH });
  const parts = path.split('/');
  if (!parts.every((p) => SEGMENT.test(p))) return t('areasJson.path.chars');
  if (RESERVED_ROOTS.has(parts[0]) || parts.includes('portal')) return t('areasJson.path.reserved', { word: parts.includes('portal') ? 'portal' : parts[0] });
  return null;
}

/** Wo eine Seite steht: "" — die Adresse strony głównej; "zapisy" — darunter; "/inna/strona" — so, wie es steht. `null`: ohne Adresse strony głównej geht es nicht. */
export function resolvePath(base: string, path: string): string | null {
  const said = path.trim();
  if (said.startsWith('/')) return normalisePath(said);
  const rest = normalisePath(said);
  const root = normalisePath(base);
  if (root === '') return null;
  return rest === '' ? root : `${root}/${rest}`;
}

/** Die Adresse einer Seite, wie das Dokument sie schreibt — vom Grund aus. */
export function relativePath(base: string, path: string): string {
  const root = normalisePath(base);
  const at = normalisePath(path);
  if (root !== '' && at === root) return '';
  if (root !== '' && at.startsWith(`${root}/`)) return at.slice(root.length + 1);
  return `/${at}`;
}

export const parentOf = (path: string): string => path.split('/').slice(0, -1).join('/');

/* -- Wohin veröffentlicht wird --------------------------------------------------- */

/**
 * "area" — in den Bereich selbst (nur seine Menschen lesen es); "auto" — in den nächsten
 * jawnen Bereich darüber, den ich führe (sonst der Bereich selbst); oder die Kennung eines
 * Bereichs (aus dem Export eines anderen Wydarzenie: dieselbe „Wydarzenia").
 */
export type PublishSay = 'area' | 'auto' | { readonly areaId: string };

/** `undefined`: nicht gesagt; `null`: unleserlich. */
export function readPublish(value: unknown): PublishSay | undefined | null {
  if (value === undefined) return undefined;
  const said = text(value).replace(/^@/, '').toLowerCase();
  if (said === 'area' || said === 'self') return 'area';
  if (said === 'auto') return 'auto';
  if (isUuid(said)) return { areaId: said };
  return null;
}

export const publishJson = (say: PublishSay): string => (typeof say === 'string' ? say : say.areaId);

/** Der Bereich, in den es geht — `fallback`, wenn das Stück selbst nichts sagt. */
export function publishTarget(say: PublishSay | undefined, fallback: string, areas: readonly AreaRow[], areaId: string): string {
  if (say === undefined) return fallback;
  if (say === 'area') return areaId;
  if (say === 'auto') return defaultPublishArea(areas, areaId);
  return say.areaId;
}

/* -- Das Dokument --------------------------------------------------------------- */

export type RoleLevel = 'read' | 'write' | 'admin';
export const ROLE_LEVELS: readonly RoleLevel[] = ['read', 'write', 'admin'];
export const LEVEL_WORD: Readonly<Record<RoleLevel, string>> = texts({ read: 'areas.otherLevel.read', write: 'areas.otherLevel.write', admin: 'areas.otherLevel.admin' });

export interface AreaLinkDoc {
  /** Wie viele Tage er gilt. */
  readonly days: number;
  /** Nach dem ersten Einlösen nicht mehr. */
  readonly once: boolean;
  /** Wer ihn einlöst, führt die Rolle (nimmt andere auf). */
  readonly lead: boolean;
  readonly label: string | null;
}

export interface AreaRoleDoc {
  readonly key: string;
  readonly name: string;
  readonly level: RoleLevel;
  readonly link: AreaLinkDoc | null;
}

export interface AreaCardDoc {
  readonly title: string;
  readonly lead: string;
  /** "page-image:@schlüssel" (eine Datei aus "images" einer Seite), "page-image:<id>", `null` — ohne; fehlt — bleibt. */
  readonly image?: string | null;
  readonly publish?: PublishSay;
}

export interface AreaPageDoc {
  readonly key: string;
  /** Wie geschrieben: "" (die Adresse strony głównej), "zapisy", "/inna/adresa". */
  readonly path: string;
  readonly main: boolean;
  readonly after: boolean;
  /** "members": nur für die Menschen des Bereichs; fehlt: bleibt (neu: öffentlich). */
  readonly access?: 'public' | 'members';
  /** Die Seite selbst — ein Dokument „recreatio/page". */
  readonly page: Record<string, unknown>;
}

export interface AreaSubformDoc {
  readonly key: string;
  /** Das Formular, das es erweitert: „seite/baustein". */
  readonly of: string;
  readonly name: string;
  readonly audience: 'person' | 'office';
  readonly publish?: PublishSay;
  /** Fragen, Aufbau, Wymagania, Rollen … — wie im Dokument eines Moduls. */
  readonly raw: Record<string, unknown>;
  readonly wish: ModuleWish;
}

/** "area" — die Rozmowa aller Menschen des Bereichs; "channel" — Ogłoszenia (schreiben die Prowadzący). */
export interface AreaChatDoc {
  readonly kind: 'area' | 'channel';
  /** Formulare, deren Menschen (mit ihrem Link) dabei sind: „seite/baustein". */
  readonly forms: readonly string[];
}

export interface AreaItemExtra {
  readonly main: boolean;
  readonly publish?: PublishSay;
}

export interface AreaDocument {
  readonly kind?: ProfileKind;
  /** Nur zur Information (der Name des Bereichs ändert sich beim Import nicht). */
  readonly name?: string;
  readonly category?: string | null;
  /** Vorschlag für die Adresse strony głównej. */
  readonly address?: string;
  readonly publish?: PublishSay;
  readonly archive?: 'auto' | 'manual';
  /** `null`: die Wizytówka abnehmen. */
  readonly card?: AreaCardDoc | null;
  readonly roles: readonly AreaRoleDoc[];
  readonly appointments?: AppointmentsPlan;
  readonly itemExtras: ReadonlyMap<string, AreaItemExtra>;
  readonly pages: readonly AreaPageDoc[];
  readonly subforms: readonly AreaSubformDoc[];
  readonly chats?: readonly AreaChatDoc[];
  readonly listings: readonly string[];
}

const TOP_KEYS = new Set([
  'format', 'version', 'kind', 'name', 'category', 'address', 'publish', 'archive', 'card',
  'roles', 'appointments', 'pages', 'subforms', 'chats', 'listings'
]);
const PAGE_ENTRY_KEYS = new Set(['key', 'path', 'main', 'after', 'access', 'page']);

/** DULDSAM LESEN — was nicht passt, fällt weg, mit einem Wort dazu. Ein Fehler nur, wenn es gar kein Dokument eines Bereichs ist. */
export function readAreaDocument(value: unknown): { doc: AreaDocument; warnings: string[] } | { error: string } {
  if (!isRecord(value)) return { error: t('areasJson.read.notObject') };
  const root = value;
  const format = text(root.format);
  if (format === PAGE_FORMAT || (format === '' && Array.isArray(root.modules))) {
    return { error: t('areasJson.read.pageDoc') };
  }
  if (format !== AREA_FORMAT) return { error: t('areasJson.read.notArea', { format: AREA_FORMAT }) };

  const warnings: string[] = [];
  if (typeof root.version === 'number' && root.version > 1) warnings.push(t('areasJson.read.version', { version: root.version }));
  for (const key of Object.keys(root)) if (!TOP_KEYS.has(key)) warnings.push(t('areasJson.read.unknownKey', { key }));

  /* Die Art, das Wort für Filter, das Archiv. */
  let kind: ProfileKind | undefined;
  if (has(root, 'kind')) {
    const said = text(root.kind);
    if (PROFILE_KINDS.some((k) => k.kind === said)) kind = said as ProfileKind;
    else warnings.push(t('areasJson.read.kind', { said, allowed: PROFILE_KINDS.map((k) => `"${k.kind}"`).join(', ') }));
  }
  let category: string | null | undefined;
  if (has(root, 'category')) {
    if (root.category === null || text(root.category) === '') category = null;
    else {
      category = text(root.category);
      if (category.length > 40) { warnings.push(t('areasJson.read.category')); category = category.slice(0, 40).trim(); }
    }
  }
  const archive = has(root, 'archive')
    ? (text(root.archive) === 'auto' || text(root.archive) === 'manual' ? text(root.archive) as 'auto' | 'manual' : undefined)
    : undefined;
  if (has(root, 'archive') && archive === undefined) warnings.push(t('areasJson.read.archive'));

  const publish = readPublish(root.publish);
  if (publish === null) warnings.push(t('areasJson.read.publish'));

  const address = has(root, 'address') ? normalisePath(text(root.address)) : undefined;

  /* Die Wizytówka. */
  let card: AreaCardDoc | null | undefined;
  if (has(root, 'card')) {
    if (root.card === null) card = null;
    else if (!isRecord(root.card)) warnings.push(t('areasJson.read.card'));
    else {
      const c = root.card;
      let title = text(c.title);
      let lead = text(c.lead);
      if (title === '') warnings.push(t('areasJson.read.cardNoTitle'));
      else {
        if (title.length > 200) { warnings.push(t('areasJson.read.cardTitleLong')); title = title.slice(0, 200).trim(); }
        if (lead.length > 4000) { warnings.push(t('areasJson.read.cardLeadLong')); lead = lead.slice(0, 4000).trim(); }
        const cardPublish = readPublish(c.publish);
        if (cardPublish === null) warnings.push(t('areasJson.read.cardPublish'));
        let image: string | null | undefined;
        if (has(c, 'image')) {
          const said = c.image === null ? '' : text(c.image);
          if (said === '') image = null;
          else if (/^page-image:(@[A-Za-z0-9][A-Za-z0-9_-]{0,59}|[0-9a-f-]{36})$/i.test(said)) image = said;
          else warnings.push(t('areasJson.read.cardImage'));
        }
        card = {
          title, lead,
          ...(image === undefined ? {} : { image }),
          ...(cardPublish === undefined || cardPublish === null ? {} : { publish: cardPublish })
        };
      }
    }
  }

  /* Rollen. */
  const roles: AreaRoleDoc[] = [];
  if (has(root, 'roles') && !Array.isArray(root.roles)) warnings.push(t('areasJson.read.roles'));
  for (const [i, raw] of list(root.roles).entries()) {
    const one = record(raw);
    const key = text(one.key);
    const name = text(one.name);
    if (!KEY.test(key)) { warnings.push(t('areasJson.read.roleKey', { i })); continue; }
    if (roles.some((r) => r.key === key)) { warnings.push(t('areasJson.read.roleTwice', { key })); continue; }
    if (name === '') { warnings.push(t('areasJson.read.roleNoName', { key })); continue; }
    if (roles.length >= MAX_ROLES) { warnings.push(t('areasJson.read.rolesMax', { max: MAX_ROLES })); break; }
    const levelSaid = text(one.level) || 'read';
    const level = (ROLE_LEVELS as readonly string[]).includes(levelSaid) ? levelSaid as RoleLevel : 'read';
    if (level !== levelSaid) warnings.push(t('areasJson.read.roleLevel', { key }));
    let link: AreaLinkDoc | null = null;
    if (one.link === true) link = { days: 30, once: false, lead: false, label: null };
    else if (isRecord(one.link)) {
      const days = typeof one.link.days === 'number' && Number.isInteger(one.link.days) ? Math.min(365, Math.max(1, one.link.days)) : 30;
      link = { days, once: one.link.once === true, lead: one.link.lead === true, label: text(one.link.label).slice(0, 80) || null };
    } else if (one.link !== undefined && one.link !== false && one.link !== null) warnings.push(t('areasJson.read.roleLink', { key }));
    roles.push({ key, name: name.slice(0, 80), level, link });
  }

  /* Termine — jeder oben mit einem Schlüssel (ohne ihn träfe ein zweiter Import ihn nicht wieder). */
  let appointments: AppointmentsPlan | undefined;
  const itemExtras = new Map<string, AreaItemExtra>();
  if (has(root, 'appointments')) {
    if (!Array.isArray(root.appointments)) warnings.push(t('areasJson.read.appointments'));
    else {
      const taken = new Set(root.appointments.map((one) => text(record(one).key)).filter((k) => /^[a-z0-9][a-z0-9_-]{0,40}$/i.test(k)));
      let strippedCalendar = false;
      const prepared = root.appointments.map((raw, i) => {
        if (!isRecord(raw)) return raw;
        const { calendar, main: _main, publish: _publish, ...rest } = raw;
        if (calendar !== undefined) strippedCalendar = true;
        const said = text(raw.key);
        if (/^[a-z0-9][a-z0-9_-]{0,40}$/i.test(said)) return rest;
        const key = freeKey(`termin-${i + 1}`, taken, 41);
        taken.add(key);
        warnings.push(t('areasJson.read.itemKey', { title: text(raw.title) || i + 1, key }));
        return { ...rest, key };
      });
      if (strippedCalendar) warnings.push(t('areasJson.read.itemCalendar'));
      const read = readAppointments(prepared, undefined, warnings) ?? { entries: [], items: [], total: 0, keys: new Set<string>() };
      appointments = read;
      let mains = 0;
      for (const [i, raw] of root.appointments.entries()) {
        const one = record(raw);
        const key = text(record(prepared[i]).key);
        const item = read.items.find((a) => a.key === key) ?? null;
        if (item === null) continue;
        const itemPublish = readPublish(one.publish);
        if (itemPublish === null) warnings.push(t('areasJson.read.itemPublish', { title: item.title }));
        const main = one.main === true && mains === 0;
        if (one.main === true && mains > 0) warnings.push(t('areasJson.read.mainItemOne', { title: item.title }));
        if (main) mains += 1;
        itemExtras.set(key, { main, ...(itemPublish === undefined || itemPublish === null ? {} : { publish: itemPublish }) });
      }
      /* Ohne Angabe: ein einzelner Termin eines Wydarzenie ist sein Haupttermin. */
      if (mains === 0 && kind === 'event' && read.items.length === 1 && read.items[0].key !== null) {
        const only = read.items[0].key;
        itemExtras.set(only, { ...(itemExtras.get(only) ?? {}), main: true });
      }
      for (const item of read.items) {
        if (item.key !== null && itemExtras.get(item.key)?.main === true && item.repeat !== 'none') {
          warnings.push(t('areasJson.read.mainItemRepeat', { title: item.title }));
          itemExtras.set(item.key, { ...itemExtras.get(item.key)!, main: false });
        }
      }
    }
  }

  /* Seiten. */
  const pages: AreaPageDoc[] = [];
  if (has(root, 'pages') && !Array.isArray(root.pages)) warnings.push(t('areasJson.read.pages'));
  for (const [i, raw] of list(root.pages).entries()) {
    const one = record(raw);
    const key = text(one.key) || (pages.length === 0 && !list(root.pages).some((p) => text(record(p).key) === 'main') ? 'main' : '');
    if (!PAGE_KEY.test(key)) { warnings.push(t('areasJson.read.pageKey', { i })); continue; }
    if (pages.some((p) => p.key === key)) { warnings.push(t('areasJson.read.pageTwice', { key })); continue; }
    if (pages.length >= MAX_PAGES) { warnings.push(t('areasJson.read.pagesMax', { max: MAX_PAGES })); break; }
    let page: Record<string, unknown> | null = null;
    if (isRecord(one.page)) page = one.page;
    else if (has(one, 'modules') || has(one, 'title')) {
      /* Duldsam: die Seite gleich im Eintrag. */
      page = Object.fromEntries(Object.entries(one).filter(([k]) => !PAGE_ENTRY_KEYS.has(k)));
    }
    if (page === null) { warnings.push(t('areasJson.read.pageNoPage', { key })); continue; }
    if (has(page, 'format') && text(page.format) !== PAGE_FORMAT) { warnings.push(t('areasJson.read.pageFormat', { key, format: PAGE_FORMAT })); continue; }
    const main = one.main === true;
    const path = typeof one.path === 'string' ? one.path.trim() : main || key === 'main' ? '' : key;
    const relative = normalisePath(path);
    if (relative !== '' && !relative.split('/').every((s) => SEGMENT.test(s))) {
      warnings.push(t('areasJson.read.pagePath', { key, path }));
      continue;
    }
    if (path.startsWith('/') && relative === '') { warnings.push(t('areasJson.read.pageRoot', { key })); continue; }
    const accessSaid = text(one.access);
    const access = accessSaid === 'public' || accessSaid === 'members' ? accessSaid : undefined;
    if (has(one, 'access') && access === undefined) warnings.push(t('areasJson.read.pageAccess', { key }));
    pages.push({ key, path: path.startsWith('/') ? `/${relative}` : relative, main, after: one.after === true, ...(access === undefined ? {} : { access }), page });
  }
  {
    /* Eine strona główna, eine po wydarzeniu — und nicht dieselbe. */
    const mains = pages.filter((p) => p.main);
    for (const extra of mains.slice(1)) warnings.push(t('areasJson.read.mainOne', { key: extra.key }));
    const afters = pages.filter((p) => p.after);
    for (const extra of afters.slice(1)) warnings.push(t('areasJson.read.afterOne', { key: extra.key }));
    const mainKey = mains[0]?.key ?? pages.find((p) => p.path === '')?.key ?? null;
    const afterKey = afters.find((p) => p.key !== mainKey)?.key ?? null;
    if (afters.length > 0 && afters[0].key === mainKey) warnings.push(t('areasJson.read.mainAfter', { key: mainKey ?? '' }));
    for (const [i, p] of pages.entries()) pages[i] = { ...p, main: p.key === mainKey, after: p.key === afterKey };
    const paths = new Map<string, string>();
    for (const p of pages) {
      const was = paths.get(p.path);
      if (was !== undefined) warnings.push(t('areasJson.read.samePath', { first: was, second: p.key }));
      paths.set(p.path, p.key);
    }
  }

  /* Unterformulare. */
  const subforms: AreaSubformDoc[] = [];
  if (has(root, 'subforms') && !Array.isArray(root.subforms)) warnings.push(t('areasJson.read.subforms'));
  for (const [i, raw] of list(root.subforms).entries()) {
    const one = record(raw);
    const key = text(one.key);
    const of = text(one.of).replace(/^@form:/, '');
    const name = text(one.name);
    if (!KEY.test(key)) { warnings.push(t('areasJson.read.subformKey', { i })); continue; }
    if (subforms.some((s) => s.key === key)) { warnings.push(t('areasJson.read.subformTwice', { key })); continue; }
    if (!/^[a-z0-9][a-z0-9_-]{0,23}\/[a-z0-9][a-z0-9_-]{0,31}$/i.test(of)) { warnings.push(t('areasJson.read.subformOf', { key })); continue; }
    if (name === '') { warnings.push(t('areasJson.read.subformNoName', { key })); continue; }
    if (subforms.length >= MAX_SUBFORMS) { warnings.push(t('areasJson.read.subformsMax', { max: MAX_SUBFORMS })); break; }
    const subPublish = readPublish(one.publish);
    if (subPublish === null) warnings.push(t('areasJson.read.subformPublish', { key }));
    const wish = readModuleWish({ ...one, name });
    warnings.push(...wish.warnings.map((w) => t('areasJson.import.subformWarning', { name: key, warning: w })));
    subforms.push({
      key, of, name: name.slice(0, 120), audience: text(one.audience) === 'office' ? 'office' : 'person',
      ...(subPublish === undefined || subPublish === null ? {} : { publish: subPublish }),
      raw: one, wish
    });
  }

  /* Rozmowy. */
  let chats: AreaChatDoc[] | undefined;
  if (has(root, 'chats')) {
    if (!Array.isArray(root.chats)) warnings.push(t('areasJson.read.chats'));
    else {
      chats = [];
      for (const raw of root.chats) {
        const one: Record<string, unknown> = isRecord(raw) ? raw : { kind: raw };
        const kindSaid = text(one.kind);
        if (kindSaid !== 'area' && kindSaid !== 'channel') { warnings.push(t('areasJson.read.chatKind', { kind: kindSaid })); continue; }
        if (chats.some((c) => c.kind === kindSaid)) { warnings.push(t('areasJson.read.chatTwice', { kind: kindSaid })); continue; }
        const forms: string[] = [];
        for (const f of list(one.forms)) {
          const ref = text(f).replace(/^@form:/, '');
          if (/^[a-z0-9][a-z0-9_-]{0,23}\/[a-z0-9][a-z0-9_-]{0,31}$/i.test(ref) || KEY.test(ref)) { if (!forms.includes(ref)) forms.push(ref); }
          else warnings.push(t('areasJson.read.chatForm', { kind: kindSaid, form: text(f) }));
        }
        chats.push({ kind: kindSaid, forms });
      }
    }
  }

  /* Listen, in denen es stehen will. */
  const listings: string[] = [];
  if (has(root, 'listings') && !Array.isArray(root.listings)) warnings.push(t('areasJson.read.listings'));
  for (const raw of list(root.listings)) {
    const path = normalisePath(text(raw));
    const problem = pathProblem(path);
    if (problem !== null) { warnings.push(t('areasJson.read.listingProblem', { path: text(raw), problem })); continue; }
    if (listings.includes(path)) continue;
    if (listings.length >= MAX_LISTINGS) { warnings.push(t('areasJson.read.listingsMax', { max: MAX_LISTINGS })); break; }
    listings.push(path);
  }

  return {
    doc: {
      ...(kind === undefined ? {} : { kind }),
      ...(text(root.name) === '' ? {} : { name: text(root.name) }),
      ...(category === undefined ? {} : { category }),
      ...(address === undefined ? {} : { address }),
      ...(publish === undefined || publish === null ? {} : { publish }),
      ...(archive === undefined ? {} : { archive }),
      ...(card === undefined ? {} : { card }),
      roles, ...(appointments === undefined ? {} : { appointments }), itemExtras, pages, subforms,
      ...(chats === undefined ? {} : { chats }),
      listings
    },
    warnings
  };
}

/* -- Verweise ------------------------------------------------------------------- */

/** Die Kennungen, auf die die Verweise eines Dokuments zeigen. */
export interface RefIds {
  readonly areaId: string;
  /** Der Kalender des Bereichs ("@kalendarz") — `null`: noch keiner. */
  readonly calendarId: string | null;
  /** Termin → Kennung. */
  readonly items: ReadonlyMap<string, string>;
  /** „seite/baustein" oder Unterformular → Modul. */
  readonly forms: ReadonlyMap<string, string>;
  /** Seite → Adresse. */
  readonly pages: ReadonlyMap<string, string>;
  /** Rolle → Kennung. */
  readonly roles: ReadonlyMap<string, string>;
}

const TOKEN = /^@(area|form:[a-z0-9][a-z0-9_-]{0,31}(?:\/[a-z0-9][a-z0-9_-]{0,31})?|page:[a-z0-9][a-z0-9_-]{0,23}|role:[a-z0-9][a-z0-9_-]{0,31})$/i;

function swapToken(token: string, ids: RefIds, missing: Set<string>): string {
  const body = token.slice(1);
  let found: string | undefined;
  if (body.toLowerCase() === 'area') found = ids.areaId;
  else if (body.startsWith('form:')) found = ids.forms.get(body.slice(5));
  else if (body.startsWith('page:')) found = ids.pages.get(body.slice(5));
  else if (body.startsWith('role:')) found = ids.roles.get(body.slice(5));
  if (found === undefined) { missing.add(token); return token; }
  return found;
}

/** Ein ganzer Wert aus Verweisen (und Kennungen), mit Kommas — sonst `null`. */
function tokensIn(value: string): string[] | null {
  if (!value.includes('@')) return null;
  const parts = value.split(',').map((p) => p.trim());
  if (parts.length === 0 || !parts.every((p) => TOKEN.test(p) || UUID.test(p))) return null;
  return parts.some((p) => TOKEN.test(p)) ? parts : null;
}

/** Jeden Verweis im ganzen Wert ersetzen — nur, wo ein ganzer Wert einer ist (nie mitten im Text). */
export function resolveTokens(value: unknown, ids: RefIds, missing: Set<string>, depth = 0): unknown {
  if (typeof value === 'string') {
    const parts = tokensIn(value);
    return parts === null ? value : parts.map((p) => (TOKEN.test(p) ? swapToken(p, ids, missing) : p)).join(',');
  }
  if (depth > 48 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((one) => resolveTokens(one, ids, missing, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, one] of Object.entries(value)) out[key] = resolveTokens(one, ids, missing, depth + 1);
  return out;
}

/** "@termin" und "@kalendarz" in den Kalenderfeldern eines Bausteins (wie im Dokument einer Seite). */
export function resolveCalendarFields(entry: Record<string, unknown>, ids: RefIds, missing: Set<string>): Record<string, unknown> {
  const kind = text(entry.kind);
  const fields = kind === '' ? [] : referenceFieldsOf(kind);
  if (fields.length === 0 || !isRecord(entry.config)) return entry;
  const config: Record<string, unknown> = { ...entry.config };
  let itemFound = false;
  for (const field of fields) {
    const value = config[field];
    if (typeof value !== 'string' || !value.includes('@')) continue;
    config[field] = value.split(',').map((token) => {
      const t = token.trim();
      if (!t.startsWith('@') || t.includes(':') || t.toLowerCase() === '@area') return token;
      const name = t.slice(1);
      const item = ids.items.get(name);
      if (item !== undefined) { if (field === 'item') itemFound = true; return item; }
      if (name === DEFAULT_ENTRY && ids.calendarId !== null) return ids.calendarId;
      missing.add(t);
      return token;
    }).join(',');
  }
  /* Ein Programm ohne Kalender bekommt den des Bereichs — dort steht sein Termin. */
  if (kind === 'program' && itemFound && text(config.calendar) === '' && ids.calendarId !== null) config.calendar = ids.calendarId;
  return { ...entry, config };
}

/** Rollen eines Formulars ("memberRoles", "virtualAreas"): "@rolle", "@role:rolle" oder eine Kennung. */
export function resolveRoleRefs(entry: Record<string, unknown>, ids: RefIds, missing: Set<string>): Record<string, unknown> {
  const swap = (value: unknown): unknown => {
    const said = text(value);
    if (!said.startsWith('@')) return value;
    const key = said.replace(/^@(role:)?/, '');
    const found = ids.roles.get(key);
    if (found === undefined) { missing.add(said); return value; }
    return found;
  };
  let out = entry;
  if (Array.isArray(entry.memberRoles)) out = { ...out, memberRoles: entry.memberRoles.map(swap) };
  if (Array.isArray(entry.virtualAreas)) {
    out = {
      ...out,
      virtualAreas: entry.virtualAreas.map((va) => (isRecord(va) && Array.isArray(va.roles)
        ? { ...va, roles: va.roles.map((r) => (isRecord(r) ? { ...r, role: swap(r.role) } : r)) }
        : va))
    };
  }
  return out;
}

/** Was ein Export statt Kennungen schreibt. */
export interface ExportIds {
  readonly areaId: string;
  /** Kalender des Bereichs → "@kalendarz". */
  readonly calendars: ReadonlySet<string>;
  /** Termin → Schlüssel. */
  readonly items: ReadonlyMap<string, string>;
  /** Modul → „seite/baustein" (oder Schlüssel eines Unterformulars). */
  readonly forms: ReadonlyMap<string, string>;
  /** Adresse → Seite. */
  readonly pages: ReadonlyMap<string, string>;
  /** Rolle → Schlüssel. */
  readonly roles: ReadonlyMap<string, string>;
}

/** Eine Kennung (oder eine Liste mit Kommas) als Verweis — was keiner ist, bleibt. */
function tokenOf(id: string, ids: ExportIds): string | null {
  const low = id.toLowerCase();
  if (low === ids.areaId.toLowerCase()) return '@area';
  const form = ids.forms.get(low) ?? ids.forms.get(id);
  if (form !== undefined) return `@form:${form}`;
  const role = ids.roles.get(low) ?? ids.roles.get(id);
  if (role !== undefined) return `@role:${role}`;
  return null;
}

/** Kennungen als Verweise — in jedem ganzen Wert. */
export function tokenizeValues(value: unknown, ids: ExportIds, depth = 0): unknown {
  if (typeof value === 'string') {
    const parts = value.split(',').map((p) => p.trim());
    if (parts.length === 0 || !parts.every((p) => UUID.test(p))) return value;
    const swapped = parts.map((p) => tokenOf(p, ids) ?? p);
    return swapped.some((p, i) => p !== parts[i]) ? swapped.join(',') : value;
  }
  if (depth > 48 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((one) => tokenizeValues(one, ids, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, one] of Object.entries(value)) out[key] = tokenizeValues(one, ids, depth + 1);
  return out;
}

/** Termine und den Kalender des Bereichs in den Kalenderfeldern als "@termin", "@kalendarz". */
export function tokenizeCalendarFields(entry: Record<string, unknown>, ids: ExportIds): Record<string, unknown> {
  const kind = text(entry.kind);
  const fields = kind === '' ? [] : referenceFieldsOf(kind);
  if (fields.length === 0 || !isRecord(entry.config)) return entry;
  const config: Record<string, unknown> = { ...entry.config };
  for (const field of fields) {
    const value = config[field];
    if (typeof value !== 'string' || value.trim() === '') continue;
    config[field] = value.split(',').map((token) => {
      const t = token.trim();
      const item = ids.items.get(t.toLowerCase()) ?? ids.items.get(t);
      if (item !== undefined) return `@${item}`;
      if (ids.calendars.has(t) || ids.calendars.has(t.toLowerCase())) return `@${DEFAULT_ENTRY}`;
      return token;
    }).join(',');
  }
  /* Ein Programm, dessen Kalender der des Bereichs ist: der Termin genügt. */
  if (kind === 'program' && config.calendar === `@${DEFAULT_ENTRY}` && typeof config.item === 'string' && config.item.startsWith('@')) config.calendar = '';
  return { ...entry, config };
}

/** Adressen der Seiten dieses Dokuments als "@page:…" — nur dort, wo eine Adresse steht (Menü, Felder „Strona"). */
export function tokenizePaths(page: Record<string, unknown>, ids: ExportIds): Record<string, unknown> {
  const swap = (path: unknown): unknown => {
    const key = typeof path === 'string' ? ids.pages.get(normalisePath(path)) : undefined;
    return key === undefined ? path : `@page:${key}`;
  };
  const menuItems = (items: unknown): unknown => Array.isArray(items)
    ? items.map((item) => {
      if (!isRecord(item)) return item;
      return { ...item, ...(item.kind === 'abs' ? { target: swap(item.target) } : {}), ...(Array.isArray(item.children) ? { children: menuItems(item.children) } : {}) };
    })
    : items;
  let out = page;
  if (Array.isArray(page.menu)) out = { ...out, menu: menuItems(page.menu) };
  else if (isRecord(page.menu) && typeof page.menu.from === 'string') out = { ...out, menu: { ...page.menu, from: swap(page.menu.from) } };
  if (Array.isArray(page.modules)) {
    out = {
      ...out,
      modules: page.modules.map((raw) => {
        if (!isRecord(raw) || !isRecord(raw.config)) return raw;
        const pathFields = (partOf(text(raw.kind))?.fields ?? []).filter((f) => f.kind === 'page').map((f) => f.key);
        if (pathFields.length === 0) return raw;
        const config = { ...raw.config };
        for (const f of pathFields) config[f] = swap(config[f]);
        return { ...raw, config };
      })
    };
  }
  return out;
}

/* -- Eine Seite des Dokuments vorbereiten ------------------------------------------------- */

/** Ein Baustein der Seite, wie der Import ihn sieht. */
export interface PrepEntry {
  /** Sein Name auf der Seite („formularz"). */
  readonly key: string;
  /** „zapisy/formularz". */
  readonly ref: string;
  /** Die Stelle auf der Seite. */
  readonly partId: string;
  readonly kind: string;
  /** Neu — er hat noch keine Stelle. */
  readonly isNew: boolean;
  /** Nur für die Menschen des Bereichs? `undefined`: wie bisher. */
  readonly members: boolean | undefined;
  readonly form: null | {
    readonly moduleId: string;
    readonly name: string;
    readonly publish?: PublishSay;
    /** Es gibt das Modul noch nicht (es wird vor der Seite angelegt). */
    readonly isNew: boolean;
  };
  /** „Napisz do nas": wer antwortet (Rollen) und wessen Menschen schreiben (Formulare) — `null`: kein solcher Baustein. */
  readonly ask: AskWant | null;
}

/** „Napisz do nas" im Dokument: "answer" — Rollen ("@role:klucz"), "forms" — Formulare ("@form:strona/moduł"); fehlt — Standard. */
export interface AskWant {
  /** Schlüssel der Rollen; leer — die prowadzące Rollen des Dokuments (sonst nur, wer importiert). */
  readonly answer: readonly string[];
  /** Formulare; `null` — alle Formulare der Seiten des Dokuments. */
  readonly forms: readonly string[] | null;
}

/** "answer" und "forms" eines Bausteins „Napisz do nas" lesen — was nicht passt, mit einem Wort. */
export function readAsk(value: Record<string, unknown>, where: string, warnings: string[]): AskWant {
  const answer: string[] = [];
  if (has(value, 'answer') && !Array.isArray(value.answer)) warnings.push(t('areasJson.read.askAnswer', { where }));
  for (const raw of list(value.answer)) {
    const key = text(raw).replace(/^@(role:)?/, '');
    if (KEY.test(key)) { if (!answer.includes(key)) answer.push(key); } else warnings.push(t('areasJson.read.askAnswerRole', { where, said: text(raw) }));
  }
  let forms: string[] | null = null;
  if (has(value, 'forms')) {
    forms = [];
    if (!Array.isArray(value.forms)) warnings.push(t('areasJson.read.askForms', { where }));
    for (const raw of list(value.forms)) {
      const ref = text(raw).replace(/^@form:/, '');
      if (/^[a-z0-9][a-z0-9_-]{0,23}\/[a-z0-9][a-z0-9_-]{0,31}$/i.test(ref) || KEY.test(ref)) { if (!forms.includes(ref)) forms.push(ref); }
      else warnings.push(t('areasJson.read.askForm', { where, said: text(raw) }));
    }
  }
  return { answer, forms };
}

export interface PagePrep {
  /** Das Dokument der Seite, wie es in den Import der Seite geht. */
  readonly doc: Record<string, unknown>;
  /** Die Seite mit den Plätzen der neuen Bausteine (damit ihre Stellen feste Kennungen bekommen). */
  readonly now: PageNowBase;
  readonly synthetic: ReadonlySet<string>;
  readonly entries: readonly PrepEntry[];
  readonly warnings: readonly string[];
  /** Verweise, die nirgends hinführen. */
  readonly missing: ReadonlySet<string>;
}

/** Ein Formular dieser Seite: sein Name, sein Schlüssel, wohin seine Fragen gehen. */
export interface FormWant {
  readonly ref: string;
  readonly key: string;
  readonly name: string;
  readonly publish?: PublishSay;
}

/**
 * DIE NAMEN DER BAUSTEINE EINER SEITE: ein eigener ("id"), sonst einer nach Art und
 * Reihenfolge („text-2"). Ein Formular ohne eigenen Namen bekommt eine Warnung — nur
 * mit ihm trifft der nächste Import sicher dasselbe Formular (mit seinen Zgłoszenia).
 */
export function entryKeysOf(page: AreaPageDoc, now: readonly DraftPart[], book: KeyBook): { keys: (string | null)[]; warnings: string[] } {
  const entries = list(page.page.modules ?? page.page.parts);
  const warnings: string[] = [];
  const keys: (string | null)[] = entries.map(() => null);
  const taken = new Set<string>();
  /* Erst die eigenen Namen … */
  entries.forEach((raw, i) => {
    const one = record(raw);
    if (partOf(text(one.kind)) === undefined && !now.some((p) => p.id === text(one.id))) return;
    const id = text(one.id);
    if (KEY.test(id) && !taken.has(id)) { keys[i] = id; taken.add(id); return; }
    if (KEY.test(id)) warnings.push(t('areasJson.prep.moduleTwice', { page: page.key, id }));
    if (isUuid(id)) {
      const known = book.keyOf('page', id);
      const prefix = `${page.key}/`;
      if (known !== undefined && known.key.startsWith(prefix) && !taken.has(known.key.slice(prefix.length))) {
        keys[i] = known.key.slice(prefix.length);
        taken.add(keys[i]!);
      }
    }
  });
  /* … dann die nach Art und Reihenfolge. */
  const counts = new Map<string, number>();
  entries.forEach((raw, i) => {
    const one = record(raw);
    const kind = text(one.kind) || now.find((p) => p.id === text(one.id))?.kind || '';
    if (partOf(kind) === undefined) return;
    const n = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, n);
    if (keys[i] !== null) return;
    const key = freeKey(keyFrom(`${kind}-${n}`), taken);
    keys[i] = key;
    taken.add(key);
    if (kind === 'form') warnings.push(t('areasJson.prep.formNoId', { page: page.key, key }));
  });
  return { keys, warnings };
}

/** Die Formulare einer Seite — vor dem Import werden ihre Module angelegt (unter dem Schlüssel des Bereichs). */
export function formsOf(page: AreaPageDoc, now: readonly DraftPart[], book: KeyBook): FormWant[] {
  const entries = list(page.page.modules ?? page.page.parts);
  const { keys } = entryKeysOf(page, now, book);
  const out: FormWant[] = [];
  entries.forEach((raw, i) => {
    const one = record(raw);
    const key = keys[i];
    if (key === null || text(one.kind) !== 'form') return;
    const publish = readPublish(one.publish);
    out.push({ ref: entryRef(page.key, key), key, name: text(one.name) || 'Zapisy', ...(publish === undefined || publish === null ? {} : { publish }) });
  });
  return out;
}

/** Verweise auf Stellen der Seite ("id" im Dokument → Stelle) in Karte und Slajdy. */
function remapPartRefs(doc: Record<string, unknown>, ids: ReadonlyMap<string, string>): Record<string, unknown> {
  if (ids.size === 0) return doc;
  const swap = (value: unknown) => (typeof value === 'string' ? ids.get(value) ?? value : value);
  let out = doc;
  if (has(doc, 'logic') && doc.logic !== null) {
    let logic: unknown = doc.logic;
    if (typeof logic === 'string') { try { logic = JSON.parse(logic) as unknown; } catch { logic = null; } }
    if (isRecord(logic)) {
      out = { ...out, logic: { ...logic, nodes: list(logic.nodes).map((n) => (isRecord(n) ? { ...n, partId: swap(n.partId), goto: swap(n.goto) } : n)) } };
    }
  }
  if (Array.isArray(out.modules)) {
    out = {
      ...out,
      modules: out.modules.map((raw) => {
        if (!isRecord(raw) || !isRecord(raw.slide)) return raw;
        let slide: Record<string, unknown> = raw.slide;
        if (isRecord(slide.stage) && isRecord(slide.stage.frames)) {
          slide = { ...slide, stage: { ...slide.stage, frames: Object.fromEntries(Object.entries(slide.stage.frames).map(([k, v]) => [ids.get(k) ?? k, v])) } };
        }
        if (isRecord(slide.with)) slide = { ...slide, with: { ...slide.with, slide: swap(slide.with.slide) } };
        return { ...raw, slide };
      })
    };
  }
  return out;
}

/**
 * EINE SEITE DES DOKUMENTS FÜR DEN IMPORT DER SEITE (`pageImportRun.ts`):
 *
 * - jeder Baustein bekommt die Stelle, die sein Name im Bereich schon hat — sonst
 *   eine neue, feste (ein Platz in `now`, damit der Import der Seite sie behält und
 *   der nächste Import sie wiederfindet);
 * - "module" fällt weg: ein Dokument aus einem anderen Bereich darf nie dessen Module zeigen;
 * - Verweise werden ersetzt, Termine und Kalender der Seite gehören hier dem Bereich;
 * - die Antworten der Fragen gehen immer in diesen Bereich ("answersTo" fällt weg).
 */
export function preparePage(input: {
  readonly page: AreaPageDoc;
  readonly now: PageNowBase;
  readonly book: KeyBook;
  readonly ids: RefIds;
  /** „seite/baustein" → Modul eines Formulars (vorhanden, eben angelegt — oder für die Vorschau ein Platzhalter). */
  readonly formModules: ReadonlyMap<string, { readonly moduleId: string; readonly isNew: boolean }>;
  readonly newId: () => string;
  /** Die Wizytówka will eine Datei dieser Seite ("page-image:@schlüssel"). */
  readonly cardImage?: string | null;
  /** Für eine neue Seite ohne "title". */
  readonly fallbackTitle?: string;
}): PagePrep {
  const { page, now, book, ids } = input;
  const warnings: string[] = [];
  const missing = new Set<string>();
  const raw = page.page;
  const entries = list(raw.modules ?? raw.parts);
  const { keys, warnings: keyWarnings } = entryKeysOf(page, now.parts, book);
  warnings.push(...keyWarnings);

  const synthetic: DraftPart[] = [];
  const prepared: PrepEntry[] = [];
  const localIds = new Map<string, string>();
  const used = new Set<string>();
  let droppedModule = false;
  let droppedAnswers = 0;

  const modules = entries.map((value, i) => {
    if (!isRecord(value)) return value;
    const key = keys[i];
    if (key === null) return value;
    const ref = entryRef(page.key, key);
    const docId = text(value.id);
    const kind = text(value.kind) || now.parts.find((p) => p.id === docId)?.kind || '';
    const def = partOf(kind);

    /* Die Stelle: die, die sein Name hat, sonst die mit seiner Kennung, sonst eine neue. */
    const known = book.get('page', ref)?.refId ?? null;
    const real = (known !== null && !used.has(known) ? now.parts.find((p) => p.id === known) : undefined)
      ?? (isUuid(docId) && !used.has(docId) ? now.parts.find((p) => p.id === docId) : undefined);
    let partId: string;
    let isNew = false;
    let moduleId: string | null = null;
    let formNew = false;
    if (real !== undefined && real.kind === kind) {
      partId = real.id;
      moduleId = real.moduleId ?? real.id;
    } else {
      if (real !== undefined) warnings.push(t('areasJson.prep.otherKind', { page: page.key, key }));
      partId = input.newId();
      isNew = true;
      if (kind === 'form') {
        const given = input.formModules.get(ref);
        moduleId = given?.moduleId ?? book.get('form', ref)?.refId ?? null;
        formNew = given?.isNew ?? moduleId === null;
      }
      synthetic.push({ id: partId, moduleId: kind === 'form' ? moduleId : null, kind, layout: {}, config: {} });
    }
    used.add(partId);
    if (docId !== '') localIds.set(docId, partId);
    localIds.set(key, partId);

    const membersSaid = value.members;
    const members = membersSaid === true ? true : membersSaid === false ? false : undefined;
    if (membersSaid !== undefined && members === undefined) warnings.push(t('areasJson.prep.members', { page: page.key, key }));
    const publish = readPublish(value.publish);
    if (publish === null) warnings.push(t('areasJson.prep.publish', { page: page.key, key }));

    const { module: docModule, members: _members, publish: _publish, ...kept } = value;
    if (docModule !== undefined && docModule !== null && text(docModule) !== '') droppedModule = true;
    /* „Napisz do nas": wer antwortet und wer schreibt, richtet der Import des Bereichs ein — nicht die Seite. */
    const ask = kind === ASK_KIND ? readAsk(kept, t('areasJson.prep.moduleWhere', { page: page.key, key }), warnings) : null;
    const { answer: _answer, forms: _forms, ...rest } = kept;
    let entry: Record<string, unknown> = { ...(kind === ASK_KIND ? rest : kept), id: partId, kind };
    /* Eine neue Stelle ohne Platz: die Grösse ihrer Art (sonst bliebe sie ohne Platz). */
    if (isNew && def !== undefined && !has(entry, 'layout') && !has(entry, 'size')) entry = { ...entry, size: def.box };

    if (kind === 'form') {
      if (Array.isArray(entry.questions)) {
        entry = {
          ...entry,
          questions: entry.questions.map((q) => {
            if (!isRecord(q) || !has(q, 'answersTo')) return q;
            if (text(q.answersTo) !== '' && text(q.answersTo) !== '@area' && text(q.answersTo).toLowerCase() !== ids.areaId.toLowerCase()) droppedAnswers += 1;
            const { answersTo: _gone, ...question } = q;
            return question;
          })
        };
      }
      entry = resolveRoleRefs(entry, ids, missing);
    }
    entry = resolveCalendarFields(entry, ids, missing);

    prepared.push({
      key, ref, partId, kind, isNew, members, ask,
      form: kind !== 'form' || moduleId === null ? null : {
        moduleId, name: text(value.name) || 'Zapisy', ...(publish === undefined || publish === null ? {} : { publish }), isNew: formNew
      }
    });
    return entry;
  });

  if (droppedModule) warnings.push(t('areasJson.prep.module', { page: page.key }));
  if (droppedAnswers > 0) warnings.push(t('areasJson.prep.answersTo', { page: page.key, count: droppedAnswers }));

  const { path: _path, appointments, calendars, format: _format, version: _version, parts: _parts, ...pageRest } = raw;
  if (appointments !== undefined || calendars !== undefined) {
    warnings.push(t('areasJson.prep.appointments', { page: page.key }));
  }
  let doc: Record<string, unknown> = { format: PAGE_FORMAT, version: 1, ...pageRest, modules };
  if (now.title.trim() === '' && text(doc.title) === '' && (input.fallbackTitle ?? '').trim() !== '') doc = { ...doc, title: input.fallbackTitle!.trim() };
  doc = remapPartRefs(doc, localIds);
  doc = resolveTokens(doc, ids, missing) as Record<string, unknown>;
  /* Die Datei der Wizytówka steht hier, damit sie mit den Dateien dieser Seite erbeten wird. */
  if (typeof input.cardImage === 'string' && input.cardImage.startsWith('page-image:@')) doc = { ...doc, _cardImage: input.cardImage };

  return {
    doc,
    now: synthetic.length === 0 ? now : { ...now, parts: [...now.parts, ...synthetic] },
    synthetic: new Set(synthetic.map((p) => p.id)),
    entries: prepared,
    warnings,
    missing
  };
}

/**
 * NACH DEM PLAN DER SEITE: die Plätze, die keiner nahm, fallen weg (sie hätten keine
 * Stelle); was "members" sagt, wird gesetzt; die Zeile über die Bausteine zählt
 * neue als neu (der Plan der Seite hielt sie für vorhanden).
 */
export function adjustPagePlan(plan: PagePlan, prep: PagePrep, areaId: string, replace: boolean, before: readonly DraftPart[]): PagePlan {
  const members = new Map(prep.entries.filter((e) => e.members !== undefined).map((e) => [e.partId, e.members!] as const));
  const parts = plan.parts
    .filter((p) => !(prep.synthetic.has(p.id) && Object.keys(p.layout).length === 0))
    .map((p) => {
      const said = members.get(p.id);
      return said === undefined ? p : { ...p, audienceAreaId: said ? areaId : null };
    });
  return { ...plan, parts, lines: plan.lines.map((line) => (line.startsWith(t('areasJson.import.modulesLinePrefix')) ? moduleLine(prep, replace, before) : line)) };
}

/** „Moduły: zmienione w miejscu — 2, nowe — 3, pozostałe bez zmian — 1." */
export function moduleLine(prep: PagePrep, replace: boolean, before: readonly DraftPart[]): string {
  const changed = prep.entries.filter((e) => !e.isNew).length;
  const added = prep.entries.filter((e) => e.isNew).length;
  const touched = new Set(prep.entries.map((e) => e.partId));
  const rest = before.filter((p) => !touched.has(p.id)).length;
  const onlyMembers = prep.entries.filter((e) => e.members === true).length;
  const head = t(replace ? 'areasJson.prep.modulesReplace' : 'areasJson.prep.modulesKeep', { changed, added, rest });
  return onlyMembers > 0 ? t('areasJson.prep.modulesMembers', { head, members: onlyMembers }) : t('areasJson.prep.modulesEnd', { head });
}

/** Der Plan einer Seite, wie die Vorschau ihn zeigt (gewählte Dateien als Platzhalter, wie es der Import tun wird). */
export function planPrepared(prep: PagePrep, options: ImportOptions, chosen: ReadonlySet<string>): PagePlan | { error: string } {
  return planImport(previewImageNeeds(prep.doc, chosen), { ...prep.now, menu: null }, options);
}

/* -- Was ein Import tun wird -------------------------------------------------------- */

/** Wie eine Seite gerade ist — `missing`: noch keine. */
export type PageLoad =
  | { readonly state: 'missing' }
  | {
    readonly state: 'page';
    readonly now: PageNowBase;
    /** Führe ich sie (darf ich sie ändern)? */
    readonly editable: boolean;
    /** Der Bereich, der für sie geradesteht (sie selbst oder darüber) — `null`: niemand; fehlt: unbekannt. */
    readonly responsibleAreaId?: string | null;
  };

export const blankPage = (path: string): PageNowBase => ({
  path, title: '', lead: '', mode: 'page', look: NO_LOOK, parts: [], logic: null, subject: null
});

export interface AreaState {
  readonly areaId: string;
  readonly areaName: string;
  readonly profile: ProfileState;
  readonly book: KeyBook;
  readonly areas: readonly AreaRow[];
  /** Die Seiten, die ich führe. */
  readonly desk: readonly PageCard[];
  readonly modules: readonly ModuleRow[];
  /** Halte ich diese Rolle (gibt es sie noch)? */
  readonly holds: (roleId: string) => boolean;
  /** Die Rollen des Bereichs mit ihrem Namen (Rolle → Name) — ein Import ohne Schlüssel nimmt die gleichnamige. */
  readonly roleNames?: ReadonlyMap<string, string>;
  /** Adresse → wie die Seite gerade ist (fehlt: noch nicht gelesen). */
  readonly pages: ReadonlyMap<string, PageLoad>;
}

export interface AreaImportOptions {
  /** Die Adresse strony głównej. */
  readonly base: string;
  /** Wohin veröffentlicht wird (ein Bereich) — `null`: wie das Dokument sagt. */
  readonly publishAreaId: string | null;
  /** Bausteine der Seiten, die nicht im Dokument stehen, nehmen. */
  readonly replaceModules: boolean;
  /** Fragen und Wymagania, die nicht im Dokument stehen, nehmen. */
  readonly replaceQuestions: boolean;
  /** Seiten, die es schon gibt und die nicht diesem Bereich gehören, trotzdem ändern. */
  readonly adoptPages: boolean;
}

export const DEFAULT_AREA_IMPORT: AreaImportOptions = { base: '', publishAreaId: null, replaceModules: false, replaceQuestions: false, adoptPages: false };

export interface PlannedPage {
  readonly doc: AreaPageDoc;
  readonly path: string;
  /** Es gibt sie schon (ich führe sie). */
  readonly exists: boolean;
  /** Warum sie nicht importiert wird — oder `null`. */
  readonly problem: string | null;
  /** Es gibt sie, und sie gehört (noch) nicht diesem Bereich. */
  readonly foreign: boolean;
}

/** Ein Termin oder Punkt des Programms, in der Reihenfolge, in der sie entstehen (das Ganze vor seinen Teilen). */
export interface PlannedItem {
  /** Sein Schlüssel im Bereich: „main", „main/2", „main/2/1". */
  readonly importKey: string;
  readonly doc: AppointmentDoc;
  readonly parentKey: string | null;
  readonly position: number | null;
  /** Vorhanden (aus einem früheren Import). */
  readonly itemId: string | null;
  /** Unter wessen Schlüssel er liegt (wer ihn sieht). */
  readonly visibilityAreaId: string;
  readonly main: boolean;
  /** Ohne Schlüssel übernommen: der Haupttermin, den das Profil schon hat (seine Punkte der Reihe nach). */
  readonly adopted?: boolean;
}

export interface PlannedRole {
  readonly doc: AreaRoleDoc;
  /** Vorhanden (und ich halte sie noch). */
  readonly roleId: string | null;
  /** Ohne Schlüssel übernommen: die Rolle des Bereichs mit diesem Namen („Uczestnicy" — auch „Uczestnicy: Rekolekcje"). */
  readonly adopted?: boolean;
  /** Ein Link dieser Rolle stammt schon aus einem Import. */
  readonly linkMade: boolean;
}

export interface PlannedSubform {
  readonly doc: AreaSubformDoc;
  readonly moduleId: string | null;
  /** Das Formular, das es erweitert (vorhanden), oder `null`: entsteht mit seiner Seite. */
  readonly parentModuleId: string | null;
  readonly questionsAreaId: string;
}

export interface PlanStep {
  readonly key: 'profile' | 'roles' | 'appointments' | 'pages' | 'subforms' | 'chats' | 'card' | 'listings';
  readonly title: string;
  readonly lines: readonly string[];
}

export interface AreaPlan {
  readonly doc: AreaDocument;
  readonly base: string;
  readonly publishAreaId: string;
  readonly roles: readonly PlannedRole[];
  readonly items: readonly PlannedItem[];
  /** Punkte, die ein früherer Import anlegte und die das Programm nicht mehr hat. */
  readonly dropItems: readonly ImportKey[];
  readonly pages: readonly PlannedPage[];
  readonly subforms: readonly PlannedSubform[];
  readonly steps: readonly PlanStep[];
  readonly warnings: readonly string[];
  /** Warum nichts geht — oder `null`. */
  readonly blocked: string | null;
}

const areaName = (areas: readonly AreaRow[], id: string, self: { areaId: string; areaName: string }): string =>
  id === self.areaId ? t('areasJson.plan.selfArea', { name: self.areaName }) : t('areasJson.quoted', { name: areas.find((a) => a.areaId === id)?.name ?? t('areas.ctl.anArea') });

/** Die Adressen, deren Seiten der Plan braucht. */
export function pagePaths(doc: AreaDocument, base: string): string[] {
  const out: string[] = [];
  for (const p of doc.pages) {
    const path = resolvePath(base, p.path);
    if (path !== null && pathProblem(path) === null && !out.includes(path)) out.push(path);
  }
  return out;
}

/** Eine Seite ohne Bausteine (eben geholt) — sie darf ein Import füllen, auch wenn sie noch keinem Bereich gehört. */
export const isEmptyPage = (load: PageLoad | undefined): boolean => load?.state === 'page' && load.editable && load.now.parts.length === 0;

/** Die Adresse strony głównej, wenn niemand eine wählt: die bisherige, sonst der Vorschlag (oder neben ihm, nach dem Namen des Bereichs). */
export function suggestBase(doc: AreaDocument, state: Pick<AreaState, 'book' | 'profile' | 'desk' | 'areaName'> & { readonly pages?: ReadonlyMap<string, PageLoad> }): string {
  const main = doc.pages.find((p) => p.main);
  const keyed = main === undefined ? undefined : state.book.get('page', main.key)?.refText ?? undefined;
  const known = keyed ?? state.profile.profile?.main?.path ?? null;
  if (known !== null && known !== '') {
    /* Die Hauptseite steht vielleicht nicht auf der Adresse selbst. */
    if (main !== undefined && main.path !== '' && !main.path.startsWith('/') && known.endsWith(`/${main.path}`)) return known.slice(0, -(main.path.length + 1));
    return main !== undefined && main.path.startsWith('/') ? parentOf(known) : known;
  }
  const said = doc.address ?? '';
  const taken = new Set(state.desk.map((p) => p.path));
  if (said !== '' && pathProblem(said) === null && !taken.has(said)) return said;
  /* Die Adresse, die man vor dem Import für das Wydarzenie geholt hat — noch eine leere Seite: sie. */
  if (said !== '' && isEmptyPage(state.pages?.get(said))) return said;
  const under = said !== '' ? parentOf(said) : '';
  if (under === '') return '';
  const slug = keyFrom(state.areaName, 40);
  let one = `${under}/${slug}`;
  for (let n = 2; taken.has(one) && n < 100; n += 1) one = `${under}/${slug}-${n}`;
  return one;
}

/**
 * DER PLAN — was ein Import tun wird, Schritt für Schritt, noch ohne etwas zu tun.
 * Die Seiten plant `planAreaPages` (sie brauchen den Plan der Seite).
 */
export function planArea(doc: AreaDocument, state: AreaState, options: AreaImportOptions): AreaPlan {
  const warnings: string[] = [];
  const steps: PlanStep[] = [];
  const self = { areaId: state.areaId, areaName: state.areaName };
  const profile = state.profile.profile;
  let blocked: string | null = null;

  if (!state.profile.admin) blocked = t('areasJson.plan.onlyLeader');
  const kind = doc.kind ?? profile?.kind;
  if (kind === undefined && blocked === null) blocked = 'Podaj "kind" — rodzaj obszaru: "event", "group", "organisation" albo "course".';

  /* Wohin veröffentlicht wird. */
  const sayDefault = profile?.publishAreaId ?? defaultPublishArea(state.areas, state.areaId);
  const publishAreaId = options.publishAreaId ?? publishTarget(doc.publish, sayDefault, state.areas, state.areaId);
  const leads = (id: string) => id === state.areaId || state.areas.some((a) => a.areaId === id && a.myLevel === 'admin');
  const target = (say: PublishSay | undefined, what: string): string => {
    const id = publishTarget(say, publishAreaId, state.areas, state.areaId);
    if (!leads(id)) {
      warnings.push(t('areasJson.plan.publishOnlyLeader', { what, area: areaName(state.areas, id, self) }));
      return state.areaId;
    }
    return id;
  };
  if (!leads(publishAreaId)) {
    warnings.push(t('areasJson.plan.publishAllOnlyLeader', { area: areaName(state.areas, publishAreaId, self) }));
  }
  const publishTo = leads(publishAreaId) ? publishAreaId : state.areaId;
  const publicTarget = publishTo === state.areaId ? state.profile.public : state.areas.find((a) => a.areaId === publishTo)?.publicLevel !== 'none';

  /* 1 — das Profil. */
  {
    const lines: string[] = [];
    if (kind !== undefined) {
      lines.push(profile === null ? t('areasJson.plan.newProfile', { kind: kindLabel(kind) })
        : doc.kind !== undefined && doc.kind !== profile.kind ? t('areasJson.plan.profileWas', { kind: kindLabel(kind), was: kindLabel(profile.kind) })
        : t('areasJson.plan.profile', { kind: kindLabel(kind) }));
    }
    if (doc.category !== undefined) lines.push(doc.category === null ? t('areasJson.plan.categoryNone') : t('areasJson.plan.category', { category: doc.category }));
    lines.push(t(publicTarget ? 'areasJson.plan.publicTo' : 'areasJson.plan.publicToClosed', { area: areaName(state.areas, publishTo, self) }));
    if (doc.archive !== undefined) lines.push(doc.archive === 'auto' ? t('areasJson.plan.archiveAuto') : t('areasJson.plan.archiveManual'));
    steps.push({ key: 'profile', title: t('areasJson.step.profile'), lines });
  }
  if (state.profile.controller === null) {
    warnings.push(t('areasJson.plan.noController'));
  }

  /* 2 — Rollen. */
  /* Eine Rolle ohne Schlüssel: die des Bereichs mit demselben Namen (der Reiter der Art nennt sie „Uczestnicy: …") — sonst entstünde sie zweimal. */
  const claimedRoles = new Set(state.book.all.filter((k) => k.kind === 'role' && k.refId !== null).map((k) => k.refId!.toLowerCase()));
  const sameName = (r: AreaRoleDoc): string | null => {
    const wanted = r.name.trim().toLowerCase();
    for (const [roleId, name] of state.roleNames ?? new Map<string, string>()) {
      if (claimedRoles.has(roleId.toLowerCase())) continue;
      const have = name.trim().toLowerCase();
      if (have === wanted || have.startsWith(`${wanted}:`)) { claimedRoles.add(roleId.toLowerCase()); return roleId; }
    }
    return null;
  };
  const roles: PlannedRole[] = doc.roles.map((r) => {
    const known = state.book.get('role', r.key)?.refId ?? null;
    const linkMade = state.book.get('link', r.key) !== undefined;
    if (known !== null && state.holds(known)) return { doc: r, roleId: known, linkMade };
    const found = sameName(r);
    return found === null ? { doc: r, roleId: null, linkMade } : { doc: r, roleId: found, adopted: true, linkMade };
  });
  if (roles.length > 0) {
    const made = roles.filter((r) => r.roleId === null);
    const kept = roles.filter((r) => r.roleId !== null);
    const lines: string[] = [];
    if (made.length > 0) lines.push(t('areasJson.plan.rolesNew', { roles: made.map((r) => t('areasJson.plan.roleWithLevel', { name: r.doc.name, level: LEVEL_WORD[r.doc.level] })).join(', ') }));
    if (kept.length > 0) lines.push(t('areasJson.plan.rolesKept', { roles: kept.map((r) => t(r.adopted === true ? 'areasJson.plan.roleAdopted' : 'areasJson.quoted', { name: r.doc.name })).join(', ') }));
    const links = roles.filter((r) => r.doc.link !== null && !r.linkMade);
    if (links.length > 0) lines.push(t('areasJson.plan.links', { links: links.map((r) => t(r.doc.link!.once ? 'areasJson.plan.linkOnce' : 'areasJson.plan.link', { name: r.doc.name, count: r.doc.link!.days })).join(', ') }));
    steps.push({ key: 'roles', title: t('areasJson.step.roles'), lines });
  }

  /* 3 — Termine, das Ganze vor seinen Teilen. */
  const items: PlannedItem[] = [];
  const dropItems: ImportKey[] = [];
  if (doc.appointments !== undefined && doc.appointments.items.length > 0) {
    /* Der Haupttermin, den das Profil schon hat (aus dem Reiter oder einem Anfang): ihn ändern, nicht einen zweiten anlegen. */
    const keyedItems = new Set(state.book.all.filter((k) => k.kind === 'appointment' && k.refId !== null).map((k) => k.refId!.toLowerCase()));
    let profileItem = profile?.itemId ?? null;
    const walk = (one: AppointmentDoc, importKey: string, parentKey: string | null, position: number | null, visibility: string, main: boolean) => {
      const known = state.book.get('appointment', importKey)?.refId ?? null;
      const adopt = known === null && main && parentKey === null && profileItem !== null && !keyedItems.has(profileItem.toLowerCase()) ? profileItem : null;
      if (adopt !== null) profileItem = null;
      items.push({ importKey, doc: one, parentKey, position, itemId: known ?? adopt, visibilityAreaId: visibility, main, ...(adopt === null ? {} : { adopted: true }) });
      one.points.forEach((point, i) => walk(point, `${importKey}/${i + 1}`, importKey, i + 1, visibility, false));
    };
    for (const one of doc.appointments.items) {
      if (one.key === null) continue;
      const extra = doc.itemExtras.get(one.key);
      walk(one, one.key, null, null, target(extra?.publish, t('areasJson.plan.itemLabel', { title: one.title })), extra?.main === true);
    }
    const planned = new Set(items.map((i) => i.importKey));
    const tops = new Set(doc.appointments.items.map((a) => a.key).filter((k): k is string => k !== null));
    for (const k of state.book.all) {
      if (k.kind !== 'appointment' || planned.has(k.key)) continue;
      const top = k.key.split('/')[0];
      if (k.key.includes('/') && tops.has(top)) dropItems.push(k);
    }
    const fresh = items.filter((i) => i.itemId === null).length;
    const main = items.find((i) => i.main);
    const lines = [
      dropItems.length > 0
        ? t('areasJson.plan.itemsDrop', { fresh, changed: items.length - fresh, dropped: dropItems.length })
        : t('areasJson.plan.items', { fresh, changed: items.length - fresh }),
      ...(main === undefined ? [] : [t(main.adopted === true ? 'areasJson.plan.mainItemAdopted' : 'areasJson.plan.mainItem', {
        title: main.doc.title, when: main.doc.allDay ? main.doc.date : `${main.doc.date} ${main.doc.time}`, area: areaName(state.areas, main.visibilityAreaId, self)
      })])
    ];
    steps.push({ key: 'appointments', title: t('areasJson.step.appointments'), lines });
  } else if (kind === 'event' && profile?.itemId == null) {
    warnings.push(t('areasJson.plan.noMainItem'));
  }

  /* 4 — Seiten. */
  const base = normalisePath(options.base);
  const pages: PlannedPage[] = [];
  if (doc.pages.length > 0) {
    if (base === '' && doc.pages.some((p) => !p.path.startsWith('/'))) {
      if (blocked === null) blocked = t('areasJson.plan.needBase');
    } else if (base !== '' && pathProblem(base) !== null) {
      if (blocked === null) blocked = t('areasJson.plan.baseProblem', { base, problem: pathProblem(base) ?? '' });
    }
    const owned = new Set<string>([
      ...state.book.all.filter((k) => k.kind === 'page' && !k.key.includes('/') && k.refText !== null).map((k) => k.refText!),
      ...(profile?.main?.path == null ? [] : [profile.main.path]),
      ...(profile?.after?.path == null ? [] : [profile.after.path])
    ]);
    const led = new Set(state.desk.map((p) => p.path));
    const planned = new Set<string>();
    const ordered = [...doc.pages].map((p) => ({ p, path: resolvePath(base, p.path) }))
      .sort((a, b) => (a.path?.split('/').length ?? 0) - (b.path?.split('/').length ?? 0));
    for (const { p, path } of ordered) {
      if (path === null) { pages.push({ doc: p, path: '', exists: false, problem: t('areasJson.plan.noBase'), foreign: false }); continue; }
      const bad = pathProblem(path);
      if (bad !== null) { pages.push({ doc: p, path, exists: false, problem: bad, foreign: false }); continue; }
      const load = state.pages.get(path);
      const exists = led.has(path) || (load?.state === 'page');
      let problem: string | null = null;
      /* Eine leere Seite (eben für das Wydarzenie geholt) füllt der Import — eine mit Inhalt nur, wenn sie diesem Bereich gehört. */
      const empty = isEmptyPage(load);
      if (load?.state === 'page' && !load.editable && !led.has(path)) problem = t('areasJson.plan.pageNotLed');
      else if (exists && !owned.has(path) && !empty && !options.adoptPages) problem = t('areasJson.plan.pageForeign');
      else if (!exists) {
        const parent = parentOf(path);
        if (parent === '') problem = t('areasJson.plan.topLevel');
        else if (!led.has(parent) && !planned.has(parent)) problem = t('areasJson.plan.parentNotLed', { parent });
      }
      if (problem === null) planned.add(path);
      pages.push({ doc: p, path, exists, problem, foreign: exists && !owned.has(path) && !empty });
    }
    for (const one of pages) if (one.problem !== null) warnings.push(one.path === '' ? t('areasJson.plan.pageSkipped', { key: one.doc.key, problem: one.problem }) : t('areasJson.plan.pageSkippedPath', { key: one.doc.key, path: one.path, problem: one.problem }));
  }

  /* 5 — Unterformulare. */
  const subforms: PlannedSubform[] = doc.subforms.map((s) => {
    const known = state.book.get('form', s.key)?.refId ?? null;
    const exists = known !== null && state.modules.some((m) => m.moduleId === known);
    const parent = state.book.get('form', s.of)?.refId ?? null;
    return {
      doc: s, moduleId: exists ? known : null,
      parentModuleId: parent !== null && state.modules.some((m) => m.moduleId === parent) ? parent : null,
      questionsAreaId: target(s.publish, t('areasJson.import.subformLabel', { name: s.name }))
    };
  });
  {
    const forms = new Set(doc.pages.flatMap((p) => formsOf(p, [], state.book).map((f) => f.ref)));
    for (const s of subforms) {
      if (s.parentModuleId === null && !forms.has(s.doc.of)) warnings.push(t('areasJson.plan.subformNoParent', { name: s.doc.name, of: s.doc.of }));
    }
    if (subforms.length > 0) {
      const fresh = subforms.filter((s) => s.moduleId === null);
      steps.push({
        key: 'subforms', title: t('areasJson.step.subforms'),
        lines: [
          ...(fresh.length === 0 ? [] : [t('areasJson.plan.subformsNew', { list: fresh.map((s) => t(s.doc.audience === 'office' ? 'areasJson.plan.subformOffice' : 'areasJson.plan.subformPerson', { name: s.doc.name, of: s.doc.of })).join(', ') })]),
          ...(subforms.length - fresh.length === 0 ? [] : [t('areasJson.plan.subformsChanged', { list: subforms.filter((s) => s.moduleId !== null).map((s) => t('areasJson.quoted', { name: s.doc.name })).join(', ') })])
        ]
      });
    }
  }

  /* 6 — Rozmowy. */
  if (doc.chats !== undefined && doc.chats.length > 0) {
    steps.push({
      key: 'chats', title: t('areasJson.step.chats'),
      lines: doc.chats.map((c) => {
        const head = c.kind === 'area' ? t('areasJson.plan.chatArea') : t('areasJson.plan.chatChannel');
        return c.forms.length === 0 ? t('areasJson.plan.chatLine', { head }) : t('areasJson.plan.chatLineForms', { head, forms: c.forms.map((f) => t('areasJson.quoted', { name: f })).join(', ') });
      })
    });
  }

  /* 7 — die Wizytówka und die Teile des Profils. */
  {
    const lines: string[] = [];
    if (doc.card === null) lines.push(t('areasJson.plan.cardRemoved'));
    else if (doc.card !== undefined) {
      const at = target(doc.card.publish, t('areasJson.plan.card'));
      const cardSay = { title: doc.card.title, area: areaName(state.areas, at, self) };
      lines.push(doc.card.image === undefined ? t('areasJson.plan.cardSealed', cardSay) : doc.card.image === null ? t('areasJson.plan.cardSealedNoPhoto', cardSay) : t('areasJson.plan.cardSealedPhoto', cardSay));
    }
    const main = pages.find((p) => p.doc.main && p.problem === null);
    const after = pages.find((p) => p.doc.after && p.problem === null);
    if (main !== undefined) lines.push(t('areasJson.import.mainPage', { path: main.path }));
    if (after !== undefined) lines.push(t('areasJson.plan.afterPage', { path: after.path }));
    if (lines.length > 0) steps.push({ key: 'card', title: t('areasJson.step.card'), lines });
  }

  /* 8 — Listen. */
  if (doc.listings.length > 0) {
    steps.push({ key: 'listings', title: t('areasJson.step.listings'), lines: [t('areasJson.plan.listings', { list: doc.listings.map((p) => (p === 'events' ? t('areasJson.plan.catalogue') : p)).join(', ') })] });
  }

  return { doc, base, publishAreaId: publishTo, roles, items, dropItems, pages, subforms, steps, warnings, blocked };
}

/** Die Zeilen eines Plans für die Vorschau: „1. Profil — …". */
export function planLines(steps: readonly PlanStep[]): string[] {
  return steps.flatMap((step, i) => step.lines.map((line, j) => (j === 0 ? `${i + 1}. ${step.title} — ${line}` : `   ${line}`)));
}

/* -- Kennungen für Vorschau und Import ------------------------------------------------ */

/**
 * Das Modul, das ein Formular der Seite schon hat: das an seiner Stelle auf der Seite,
 * sonst das unter seinem Schlüssel (wenn es das Modul noch gibt) — `null`: es entsteht neu.
 */
export function existingFormModule(ref: string, now: readonly DraftPart[], book: KeyBook, modules: readonly Pick<ModuleRow, 'moduleId' | 'kind'>[]): string | null {
  const place = book.get('page', ref)?.refId ?? null;
  const part = place === null ? undefined : now.find((p) => p.id === place && p.kind === 'form');
  if (part !== undefined) return part.moduleId ?? part.id;
  const known = book.get('form', ref)?.refId ?? null;
  return known !== null && modules.some((m) => m.moduleId === known && m.kind === 'form') ? known : null;
}

/** Für die Vorschau: die Kennungen, die es schon gibt — und Platzhalter für das, was der Import anlegt. */
export function previewIds(plan: AreaPlan, state: AreaState, calendarId: string | null, newId: () => string): {
  ids: RefIds; formModules: Map<string, { moduleId: string; isNew: boolean }>;
} {
  const items = new Map<string, string>();
  for (const it of plan.items) if (it.doc.key !== null) items.set(it.doc.key, it.itemId ?? newId());
  const roles = new Map(plan.roles.map((r) => [r.doc.key, r.roleId ?? newId()] as const));
  const pages = new Map(plan.pages.filter((p) => p.problem === null).map((p) => [p.doc.key, p.path] as const));
  const formModules = new Map<string, { moduleId: string; isNew: boolean }>();
  for (const p of plan.pages) {
    const load = state.pages.get(p.path);
    const now = load?.state === 'page' ? load.now.parts : [];
    for (const f of formsOf(p.doc, now, state.book)) {
      const known = existingFormModule(f.ref, now, state.book, state.modules);
      formModules.set(f.ref, known === null ? { moduleId: newId(), isNew: true } : { moduleId: known, isNew: false });
    }
  }
  const forms = new Map([...formModules].map(([ref, m]) => [ref, m.moduleId] as const));
  for (const s of plan.subforms) forms.set(s.doc.key, s.moduleId ?? newId());
  return { ids: { areaId: state.areaId, calendarId: calendarId ?? newId(), items, forms, pages, roles }, formModules };
}

/** Ein Verweis, der nirgends hinführt, in Worten. */
export const missingLine = (where: string, token: string): string =>
  t('areasJson.plan.missing', { where, token });

/** Die Seite in der Vorschau: ihr Plan, als Zeilen dieser Seite. */
export function previewPage(input: {
  readonly planned: PlannedPage;
  readonly state: AreaState;
  readonly ids: RefIds;
  readonly formModules: ReadonlyMap<string, { readonly moduleId: string; readonly isNew: boolean }>;
  readonly options: AreaImportOptions;
  readonly cardImage: string | null;
  readonly fallbackTitle: string;
  /** Die Dateien, die der Mensch schon gewählt hat (Schlüssel). */
  readonly chosen: ReadonlySet<string>;
  readonly newId: () => string;
  readonly publishAreaId: string;
}): { lines: string[]; warnings: string[]; doc: Record<string, unknown> | null } {
  const { planned, state } = input;
  const label = t('areasJson.import.pageLabel', { key: planned.doc.key, path: planned.path });
  const load = state.pages.get(planned.path);
  const now = load?.state === 'page' ? load.now : blankPage(planned.path);
  const prep = preparePage({
    page: planned.doc, now, book: state.book, ids: input.ids, formModules: input.formModules, newId: input.newId,
    cardImage: input.cardImage, fallbackTitle: input.fallbackTitle
  });
  const options: ImportOptions = { replace: input.options.replaceModules, copyModules: false, legacyPage: 0, takeTheme: true };
  const done = planPrepared(prep, options, input.chosen);
  if ('error' in done) return { lines: [], warnings: [`${label}: ${done.error}`], doc: null };
  const adjusted = adjustPagePlan(done, prep, state.areaId, input.options.replaceModules, now.parts);
  const lines = [
    t('areasJson.plan.pageHead', { label, tags: [
      ...(planned.exists ? [] : [t('areasJson.plan.tagNew')]),
      ...(planned.doc.access === 'members' ? [t('areasJson.plan.tagMembers')] : planned.doc.access === 'public' ? [t('areasJson.plan.tagPublic')] : []),
      ...(planned.doc.main ? [t('areasJson.plan.tagMain')] : []),
      ...(planned.doc.after ? [t('areasJson.plan.tagAfter')] : [])
    ].map((tag, i) => (i === 0 && !planned.exists ? ` — ${tag}` : `, ${tag}`)).join('') }),
    ...adjusted.lines.map((line) => `   ${line}`)
  ];
  for (const e of prep.entries) {
    if (e.form === null) continue;
    const target = publishTarget(e.form.publish, input.publishAreaId, state.areas, state.areaId);
    const at = target === state.areaId ? t('areasJson.plan.inArea') : t('areasJson.plan.inNamed', { name: state.areas.find((a) => a.areaId === target)?.name ?? t('areas.ctl.anArea') });
    lines.push(`   ${t(e.form.isNew ? 'areasJson.plan.formNew' : 'areasJson.plan.form', { name: e.form.name, at })}`);
  }
  return {
    lines,
    warnings: [
      ...prep.warnings,
      ...done.warnings.map((w) => `${label}: ${w}`),
      ...[...prep.missing].map((token) => missingLine(label, token))
    ],
    doc: prep.doc
  };
}
