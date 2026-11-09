/**
 * 2026-10-29 — DIE ROLLEN EINES KONTOS ALS JSON („recreatio/roles", Fassung 1): Personen, Rollen und Gruppen,
 * wer wen hält (auf welcher Stufe, mit oder ohne Signierschlüssel) und die Namen, im Browser geöffnet. Export,
 * Import mit Vorschau und die Beschreibung daneben wie bei allen Importen (`ui/JsonPanel.tsx`); dieselbe
 * Beschreibung liest ein Assistent über MCP (`get_import_format`).
 *
 * <code>
 *   mit "id"    die Rolle gibt es: Name und Art (rola ↔ grupa) an Ort und Stelle, neue Halter dazu
 *   ohne "id"   eine neue Rolle oder Gruppe — angelegt unter dem ersten, der sie führt; ein „@klucz" darf
 *               eine andere neue Rolle desselben Dokuments sein (die entsteht dann zuerst)
 * </code>
 *
 * <b>Weggenommen wird nichts</b> — keine Rolle, keine Kante, keine Unterschrift. <b>Gegeben wird nur, was
 * dieses Konto geben kann</b>: den Schlüssel der Rolle (für „sign" auch ihren Signierschlüssel) und die
 * Unterschrift dessen, der sie halten soll — genau, was der Dienst prüft (`Roles.Edit.cs`). Keine Personen
 * (ein Mensch wird von Hand angelegt), kein Konto, nichts an den Rollen der Links, nichts, was der Bund nicht
 * öffnet. Die Namen versiegelt wie immer `roles.ts` mit dem Schlüssel der Rolle.
 *
 * Rein bis auf `liveRolesOps`: Planen und Ausführen kennen nur die Schritte (`RolesOps`) — so prüft
 * `scripts/app-json-roles-check.mjs` Plan, Reihenfolge und Fortschritt ohne Dienst.
 */

import { describe, keyLines, pretty, type JsonNode } from '../core/jsonTree';
import type { Ring, SealedRole } from '../core/keys';
import { t } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import type { RoleReach } from './commonRole';
import {
  addHolder, createRoleWithKeys, EDGE_KINDS, renameRole, retypeRole, selfOf, type EdgeKind, type RoleGraphData
} from './roles';

export const ROLES_FORMAT = 'recreatio/roles';
export const ROLES_VERSION = 1;

/** Höchstens so viele neue Rollen je Import — jede sind zwei RSA-4096-Paare, Sekunden im Browser. */
export const MAX_NEW_ROLES = 50;
/** Höchstens so viele Einträge je Dokument. */
export const MAX_ENTRIES = 1000;
/** So lang darf ein Name sein. */
export const MAX_NAME = 200;

/** Zwei feste Verweise: die Wurzel des Kontos und seine erste Person (`selfOf`). */
const ACCOUNT_REF = '@konto';
const SELF_REF = '@ja';
const ACCOUNT_KEY = 'konto';
const SELF_KEY = 'ja';

/* Buchstaben auch polnisch: ein Assistent schreibt gern „@żywy-różaniec". */
const KEY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,39}$/u;

type Kind = SealedRole['kind'];

/* Als Map, nicht als Objekt: ein Schlüssel wie "constructor" fände sonst etwas auf dem Prototyp. */
const KINDS = new Map<string, Kind>([
  ['person', 'person'], ['role', 'role'], ['group', 'group'], ['account', 'account'],
  ['osoba', 'person'], ['rola', 'role'], ['grupa', 'group'], ['konto', 'account'] // i18n-ignore — Wörter des Formats
]);
const LEVELS = new Map<string, EdgeKind>([
  ['holds', 'holds'], ['write', 'write'], ['read', 'read'], ['prowadzi', 'holds'], ['pisze', 'write'], ['czyta', 'read']
]);

/** Die Schlüssel des Exports ohne Namen („rola-2") — Wörter des Formats, nicht der Oberfläche. */
const KIND_WORD: Readonly<Record<Kind, string>> = { account: 'konto', person: 'osoba', role: 'rola', group: 'grupa' }; // i18n-ignore

/** Sätze, die erst beim Lesen übersetzt werden (Sprache der Anwendung zu diesem Zeitpunkt). */
const lazy = (entries: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [k, read] of Object.entries(entries)) Object.defineProperty(out, k, { get: read, enumerable: true });
  return out;
};
const quote = (text: string): string => t('roles.json.quote', { text });
const LEVEL_ORDER: Readonly<Record<EdgeKind, number>> = { holds: 0, write: 1, read: 2 };

/* -- Was die Beschreibung sagt ------------------------------------------------------------------- */

const TOP_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => t('roles.json.top.format', { format: ROLES_FORMAT }),
  version: () => t('roles.json.top.version', { version: ROLES_VERSION }),
  roles: () => t('roles.json.top.roles'),
  sealed: () => t('roles.json.top.sealed')
});

const ENTRY_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('roles.json.entryKey.id'),
  key: () => t('roles.json.entryKey.key', { account: ACCOUNT_KEY, self: SELF_KEY }),
  kind: () => t('roles.json.entryKey.kind'),
  name: () => t('roles.json.entryKey.name', { max: MAX_NAME }),
  holders: () => t('roles.json.entryKey.holders'),
  areas: () => t('roles.json.entryKey.areas'),
  link: () => t('roles.json.entryKey.link')
});

const AREA_KEYS: Readonly<Record<string, string>> = lazy({
  name: () => t('roles.json.areaKey.name'),
  level: () => t('roles.json.areaKey.level')
});

const HOLDER_KEYS: Readonly<Record<string, string>> = lazy({
  by: () => t('roles.json.holderKey.by', { self: SELF_REF, account: ACCOUNT_REF }),
  level: () => t('roles.json.holderKey.level'),
  sign: () => t('roles.json.holderKey.sign')
});

/** Jeder Schlüssel als Pfad (`roles[].holders[].by`) mit seinem Satz — für die Prüfung (`app-json-roles-check.mjs`). */
export const ROLES_PATHS: Readonly<Record<string, string>> = lazy({
  ...Object.fromEntries(Object.keys(TOP_KEYS).map((k) => [k, () => TOP_KEYS[k]!])),
  ...Object.fromEntries(Object.keys(ENTRY_KEYS).map((k) => [`roles[].${k}`, () => ENTRY_KEYS[k]!])),
  ...Object.fromEntries(Object.keys(HOLDER_KEYS).map((k) => [`roles[].holders[].${k}`, () => HOLDER_KEYS[k]!])),
  ...Object.fromEntries(Object.keys(AREA_KEYS).map((k) => [`roles[].areas[].${k}`, () => AREA_KEYS[k]!]))
});

/* Was bekannt ist, als Mengen: `in` sähe auch den Prototyp. */
const TOP_SET = new Set(Object.keys(TOP_KEYS));
const ENTRY_SET = new Set(Object.keys(ENTRY_KEYS));
const HOLDER_SET = new Set(Object.keys(HOLDER_KEYS));

/* -- Was das Konto weiss — vor dem Planen geladen ------------------------------------------------- */

export interface RoleArea {
  readonly name: string;
  /** Die Stufe im Bereich: `read`, `write`, `admin`. */
  readonly level: string;
}

/** Eine Rolle des Graphen, so weit dieser Bund sie kennt. */
export interface RoleFacts {
  readonly id: string;
  readonly kind: Kind;
  /** Der geöffnete Name — `null`: keiner gesetzt, oder verschlossen. */
  readonly name: string | null;
  /** Der Bund hält ihren Schlüssel (`Ring.has`) — nur solche gehen in den Export und lassen sich ändern. */
  readonly readable: boolean;
  /** In ihrem Namen unterschreiben (`Ring.maySign`): unter ihr anlegen, sie als Halter eintragen. */
  readonly leads: boolean;
  /** Ihren Signierschlüssel weitergeben (`Ring.signKeyOf`): „sign": true an einen neuen Halter. */
  readonly passesSign: boolean;
  /** Die Rolle eines Links mit Zugang (0065) — an ihr ändert der Import nichts. */
  readonly link: boolean;
  readonly areas: readonly RoleArea[];
  readonly createdAt: string;
}

/** Eine Kante: `from` hält `to`. */
export interface RoleHolding {
  readonly from: string;
  readonly to: string;
  readonly level: EdgeKind;
  /** Nur bei `holds`: ging der Signierschlüssel mit (eine Zuteilung `role_sign`)? */
  readonly sign: boolean;
  readonly createdAt: string;
}

export interface RolesState {
  /** Die Wurzel des Kontos (0040) — hält nur Personen, wird nie gehalten. */
  readonly accountId: string | null;
  /** Unterschreibt der Bund als Konto (eine Person an das Konto hängen)? */
  readonly accountLeads: boolean;
  /** Die erste Person des Kontos (`selfOf`) — „@ja". */
  readonly selfId: string | null;
  /** Alle Rollen des Graphen ausser dem Konto — auch verschlossene (`readable: false`). */
  readonly roles: readonly RoleFacts[];
  readonly holdings: readonly RoleHolding[];
}

/** Was vom Bund gebraucht wird — so lässt er sich in der Prüfung nachbilden. */
export type RingView = Pick<Ring, 'has' | 'maySign' | 'signKeyOf'>;

/**
 * Der Stand aus dem Graphen (`loadRoles`), dem Bund, den geöffneten Namen (`Ring.names`) und — wenn der Dienst
 * sie gab — den Bereichen je Rolle (`loadRoleReach`; `null`: ohne). Eine Linkrolle von früher, die der Dienst
 * nicht als solche kennt, verrät sich am Namen (wie in `givableRoles`).
 */
export function rolesStateOf(
  graph: RoleGraphData, ring: RingView, names: ReadonlyMap<string, string>, reach: readonly RoleReach[] | null
): RolesState {
  const accountId = graph.personRoleId ?? graph.roles.find((r) => r.isPersonal)?.id ?? null;
  const reachOf = new Map((reach ?? []).map((r) => [r.roleId, r]));
  const signs = new Set(graph.grants.filter((g) => g.keyKind === 'role_sign').map((g) => `${g.holderRoleId}>${g.roleId}`));
  const roles: RoleFacts[] = graph.roles.filter((r) => r.id !== accountId && !r.isPersonal).map((r) => {
    const readable = ring.has(r.id);
    const opened = readable ? names.get(r.id)?.trim() ?? '' : '';
    const name = opened === '' ? null : opened;
    const reached = reachOf.get(r.id);
    return {
      id: r.id,
      kind: r.kind,
      name,
      readable,
      leads: readable && ring.maySign(r.id),
      passesSign: readable && ring.signKeyOf(r.id) !== null,
      link: reached?.link === true || (name !== null && name.startsWith('Link: ')),
      areas: (reached?.areas ?? []).map((a) => ({ name: a.name, level: a.capability })),
      createdAt: r.createdAt
    };
  });
  const holdings: RoleHolding[] = graph.edges
    .filter((e) => (EDGE_KINDS as readonly string[]).includes(e.edgeKind))
    .map((e) => ({
      from: e.fromRoleId, to: e.toRoleId, level: e.edgeKind as EdgeKind,
      sign: e.edgeKind === 'holds' && signs.has(`${e.fromRoleId}>${e.toRoleId}`),
      createdAt: e.createdAt
    }));
  return {
    accountId,
    accountLeads: accountId !== null && ring.maySign(accountId),
    selfId: selfOf(graph)?.id ?? null,
    roles,
    holdings
  };
}

/* -- Export ---------------------------------------------------------------------------------------- */

/** Ein Schlüssel aus dem Namen: „Rada parafialna" → „rada-parafialna". */
function slugOf(text: string): string {
  return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
}

function freeKey(base: string, taken: Set<string>): string {
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  taken.add(key);
  return key;
}

/**
 * DER EXPORT — was dieses Konto lesen kann. Vom Konto aus Ebene für Ebene: wer hält, steht vor dem, was er
 * hält, und die erste Person heisst „ja". Verschlossene Rollen fehlen (gezählt in "sealed"), mit ihnen ihre
 * Kanten; der Halter Konto heisst „@konto".
 */
export function exportRoles(state: RolesState): Record<string, unknown> {
  const readable = state.roles.filter((r) => r.readable);
  const byId = new Map(readable.map((r) => [r.id, r]));
  const byAge = (a: RoleFacts, b: RoleFacts) => a.createdAt.localeCompare(b.createdAt);

  const order: RoleFacts[] = [];
  const seen = new Set<string>();
  let frontier = state.accountId === null ? [] : [state.accountId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const from of frontier) {
      const held = state.holdings
        .filter((h) => h.from === from && h.level === 'holds')
        .map((h) => byId.get(h.to))
        .filter((r): r is RoleFacts => r !== undefined)
        .sort(byAge);
      for (const r of held) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        order.push(r);
        next.push(r.id);
      }
    }
    frontier = next;
  }
  /* Was nur über eine verschlossene Rolle erreichbar ist, steht hinten — gelesen werden kann es trotzdem. */
  for (const r of [...readable].sort(byAge)) if (!seen.has(r.id)) { seen.add(r.id); order.push(r); }

  const taken = new Set([ACCOUNT_KEY, SELF_KEY]);
  const keys = new Map<string, string>();
  for (const r of order) keys.set(r.id, r.id === state.selfId ? SELF_KEY : freeKey(slugOf(r.name ?? '') || KIND_WORD[r.kind], taken));
  const refOf = (id: string): string | null => (id === state.accountId ? ACCOUNT_REF : keys.has(id) ? `@${keys.get(id)}` : null);

  const roles = order.map((r) => {
    const holders = state.holdings
      .filter((h) => h.to === r.id && refOf(h.from) !== null)
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.createdAt.localeCompare(b.createdAt))
      .map((h) => ({ by: refOf(h.from), level: h.level, ...(h.level === 'holds' ? { sign: h.sign } : {}) }));
    return {
      id: r.id,
      key: keys.get(r.id),
      kind: r.kind,
      ...(r.name === null ? {} : { name: r.name }),
      holders,
      ...(r.areas.length === 0 ? {} : { areas: r.areas.map((a) => ({ name: a.name, level: a.level })) }),
      ...(r.link ? { link: true } : {})
    };
  });
  const sealed = state.roles.filter((r) => !r.readable).length;
  return { format: ROLES_FORMAT, version: ROLES_VERSION, roles, ...(sealed > 0 ? { sealed } : {}) };
}

/* -- Lesen und planen ----------------------------------------------------------------------------- */

/** Eine Rolle, die es gibt (`id`), oder eine, die dieser Import anlegt (ihr Schlüssel im Plan). */
export type RoleRef = { readonly id: string } | { readonly key: string };

export interface PlannedCreate {
  readonly key: string;
  readonly kind: 'role' | 'group';
  readonly name: string;
  /** Unter wem sie entsteht — er führt sie, mit beiden Schlüsseln. */
  readonly holder: RoleRef;
  readonly holderName: string;
}

export interface PlannedRename { readonly roleId: string; readonly from: string | null; readonly to: string }
export interface PlannedRetype { readonly roleId: string; readonly name: string; readonly to: 'role' | 'group' }

export interface PlannedHolding {
  readonly role: RoleRef;
  readonly holder: RoleRef;
  readonly level: EdgeKind;
  /** Nur bei `holds`: der Signierschlüssel geht mit. */
  readonly sign: boolean;
  /** „„Rada" trzyma „Schola" (czyta)" — für Zeilen und Meldungen. */
  readonly label: string;
}

export interface RolesPlan {
  /** In der Reihenfolge, in der sie entstehen — wer unter einer neuen Rolle entsteht, nach ihr. */
  readonly creates: readonly PlannedCreate[];
  readonly renames: readonly PlannedRename[];
  readonly retypes: readonly PlannedRetype[];
  readonly holdings: readonly PlannedHolding[];
  /** Die Rollen, die das Dokument mit ihrer Kennung nennt — sie bleiben, was sie sind. */
  readonly known: readonly string[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

interface HolderItem {
  readonly by: string;
  readonly level: EdgeKind;
  readonly sign: boolean;
  /** Stand "sign" im Dokument — sonst ist es die Vorgabe, und eine bestehende Kante zählt als gleich. */
  readonly signGiven: boolean;
}

interface Entry {
  readonly at: number;
  readonly label: string;
  /** Der Schlüssel im Plan: der eigene oder „#3" (dann ist der Eintrag nicht verweisbar). */
  readonly ref: string;
  readonly fact: RoleFacts | null;
  readonly kind: Kind | null;
  readonly name: string | null;
  readonly holders: readonly HolderItem[];
}

type Target =
  | { readonly kind: 'account' }
  | { readonly kind: 'role'; readonly fact: RoleFacts }
  | { readonly kind: 'new'; readonly entry: Entry };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const cut = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** „prowadzi, z podpisem" — wie die Punkte im Graphen heissen (`RoleNode.DOTS`). */
export function levelWords(level: EdgeKind, sign: boolean): string {
  if (level === 'holds') return sign ? t('roles.json.level.holdsSign') : t('roles.json.level.holdsNoSign');
  return level === 'write' ? t('roles.json.level.write') : t('roles.json.level.read');
}

function readHolder(raw: unknown, where: string, warnings: string[]): HolderItem | null {
  if (typeof raw === 'string') {
    if (raw.trim() !== '') return { by: raw.trim(), level: 'holds', sign: true, signGiven: false };
    warnings.push(t('roles.json.warn.emptyRef', { where }));
    return null;
  }
  if (!isObject(raw)) { warnings.push(t('roles.json.warn.notRef', { where })); return null; }
  for (const key of Object.keys(raw)) if (!HOLDER_SET.has(key)) warnings.push(t('roles.json.warn.unknownKey', { where, key }));
  if (typeof raw.by !== 'string' || raw.by.trim() === '') { warnings.push(t('roles.json.warn.noBy', { where })); return null; }
  let level: EdgeKind = 'holds';
  if (raw.level !== undefined && raw.level !== null) {
    const found = typeof raw.level === 'string' ? LEVELS.get(raw.level.trim().toLowerCase()) : undefined;
    if (found === undefined) {
      warnings.push(t('roles.json.warn.badLevel', { where, level: cut(JSON.stringify(raw.level) ?? '?', 40) }));
      return null;
    }
    level = found;
  }
  let sign = level === 'holds';
  const signGiven = raw.sign !== undefined && raw.sign !== null;
  if (signGiven) {
    if (typeof raw.sign !== 'boolean') warnings.push(t(level === 'holds' ? 'roles.json.warn.signBoolTrue' : 'roles.json.warn.signBoolSkip', { where }));
    else if (raw.sign && level !== 'holds') warnings.push(t('roles.json.warn.signOnlyHolds', { where, level }));
    else sign = raw.sign;
  }
  return { by: raw.by.trim(), level, sign, signGiven: signGiven && typeof raw.sign === 'boolean' };
}

/**
 * WAS EIN DOKUMENT ÄNDERN WÜRDE — oder warum es nicht geht. Rein: der Stand ist vorher geladen
 * (`rolesStateOf`). Jede Zeile ist eine Änderung; alles Übergangene steht in den Warnungen.
 */
export function planRolesImport(doc: unknown, state: RolesState): RolesPlan | { error: string } {
  if (!isObject(doc)) return { error: t('roles.json.error.notDoc') };
  if (doc.format !== undefined && doc.format !== ROLES_FORMAT) return { error: t('roles.json.error.format', { format: String(doc.format), expected: ROLES_FORMAT }) };
  if (!Array.isArray(doc.roles)) return { error: t('roles.json.error.noRoles') };
  if (state.accountId === null) return { error: t('roles.json.error.noStructure') };
  const accountId = state.accountId;

  const warnings: string[] = [];
  const warn = (text: string) => warnings.push(text);
  for (const key of Object.keys(doc)) if (!TOP_SET.has(key)) warn(t('roles.json.warn.unknownTop', { key }));
  if (doc.version !== undefined && doc.version !== ROLES_VERSION) warn(t('roles.json.warn.version', { version: cut(String(doc.version), 20), current: ROLES_VERSION }));

  const facts = new Map(state.roles.filter((r) => r.readable).map((r) => [r.id, r]));
  const sealedIds = new Set(state.roles.filter((r) => !r.readable).map((r) => r.id));
  const list: readonly unknown[] = doc.roles.slice(0, MAX_ENTRIES);
  if (doc.roles.length > MAX_ENTRIES) warn(t('roles.json.warn.tooMany', { max: MAX_ENTRIES }));

  /* 1 — die Einträge, jeder für sich. */
  const entries: Entry[] = [];
  const byKey = new Map<string, Entry>();
  const seenIds = new Set<string>();
  list.forEach((raw, i) => {
    const at = i + 1;
    if (!isObject(raw)) { warn(t('roles.json.warn.notObject', { n: at })); return; }
    const given = typeof raw.name === 'string' ? raw.name.trim() : '';
    const label = given !== '' ? quote(cut(given, 60)) : typeof raw.key === 'string' && raw.key.trim() !== '' ? quote(`@${cut(raw.key.trim(), 40)}`) : t('roles.json.entry', { n: at });
    for (const key of Object.keys(raw)) if (!ENTRY_SET.has(key)) warn(t('roles.json.warn.unknownKey', { where: label, key }));

    let fact: RoleFacts | null = null;
    if (raw.id !== undefined && raw.id !== null) {
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      if (id === '') { warn(t('roles.json.warn.idText', { where: label })); return; }
      if (id === accountId) { warn(t('roles.json.warn.idAccount', { where: label, ref: ACCOUNT_REF })); return; }
      if (seenIds.has(id)) { warn(t('roles.json.warn.idTwice', { where: label })); return; }
      const found = facts.get(id);
      if (found === undefined) {
        warn(sealedIds.has(id)
          ? t('roles.json.warn.idSealed', { where: label })
          : t('roles.json.warn.idUnknown', { where: label }));
        return;
      }
      fact = found;
      seenIds.add(id);
    }

    let key: string | null = null;
    if (raw.key !== undefined && raw.key !== null) {
      const k = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '') : '';
      if (!KEY_PATTERN.test(k)) warn(t('roles.json.warn.badKey', { where: label, key: cut(JSON.stringify(raw.key) ?? '?', 50) }));
      else if (k === ACCOUNT_KEY || (k === SELF_KEY && (fact === null || fact.id !== state.selfId))) warn(t('roles.json.warn.reservedKey', { where: label, key: k }));
      else if (byKey.has(k)) warn(t('roles.json.warn.keyTwice', { where: label, key: k }));
      else key = k;
    }

    let kind: Kind | null = null;
    if (raw.kind !== undefined && raw.kind !== null) {
      const found = typeof raw.kind === 'string' ? KINDS.get(raw.kind.trim().toLowerCase()) : undefined;
      if (found === undefined) warn(t(fact === null ? 'roles.json.warn.unknownKindNew' : 'roles.json.warn.unknownKindKept', { where: label, kind: cut(JSON.stringify(raw.kind) ?? '?', 40) }));
      else kind = found;
    }

    let name: string | null = null;
    if (raw.name !== undefined && raw.name !== null) {
      if (typeof raw.name !== 'string') warn(t('roles.json.warn.nameText', { where: label }));
      else if (given === '') { if (fact !== null) warn(t('roles.json.warn.nameEmpty', { where: label })); }
      else if (given.length > MAX_NAME) { warn(t('roles.json.warn.nameLong', { where: label, max: MAX_NAME })); name = given.slice(0, MAX_NAME).trim(); }
      else name = given;
    }

    const holders: HolderItem[] = [];
    if (raw.holders !== undefined && raw.holders !== null) {
      if (!Array.isArray(raw.holders)) warn(t('roles.json.warn.holdersList', { where: label }));
      else raw.holders.forEach((one, j) => {
        const item = readHolder(one, t('roles.json.whereHolder', { where: label, n: j + 1 }), warnings);
        if (item !== null) holders.push(item);
      });
    }

    const entry: Entry = { at, label, ref: key ?? `#${at}`, fact, kind, name, holders };
    entries.push(entry);
    if (key !== null) byKey.set(key, entry);
  });

  /* 2 — neue Einträge, die gar nicht entstehen können: Personen, das Konto, ohne Namen. */
  const dropped = new Set<Entry>();
  for (const e of entries) {
    if (e.fact !== null) continue;
    const kind = e.kind ?? 'role';
    if (kind === 'person') { dropped.add(e); warn(t('roles.json.warn.noPersons', { where: e.label })); }
    else if (kind === 'account') { dropped.add(e); warn(t('roles.json.warn.noAccount', { where: e.label })); }
    else if (e.name === null) { dropped.add(e); warn(t('roles.json.warn.needName', { where: e.label })); }
  }

  const nameOf = (x: Target): string =>
    x.kind === 'account' ? t('roles.json.account') : x.kind === 'role' ? x.fact.name ?? t('roles.json.noName') : x.entry.name ?? x.entry.label;

  /** Wer mit „by" gemeint ist — oder warum niemand. */
  const resolve = (by: string): Target | string => {
    if (by === ACCOUNT_REF || by === accountId) return { kind: 'account' };
    if (by === SELF_REF) {
      const self = state.selfId === null ? undefined : facts.get(state.selfId);
      return self === undefined ? t('roles.json.why.noSelf', { self: SELF_REF }) : { kind: 'role', fact: self };
    }
    if (by.startsWith('@')) {
      const e = byKey.get(by.slice(1));
      if (e === undefined) return t('roles.json.why.nowhere', { ref: cut(by, 40) });
      if (dropped.has(e)) return t('roles.json.why.notMade', { ref: cut(by, 40) });
      return e.fact !== null ? { kind: 'role', fact: e.fact } : { kind: 'new', entry: e };
    }
    const fact = facts.get(by);
    if (fact !== undefined) return { kind: 'role', fact };
    return sealedIds.has(by) ? t('roles.json.why.sealed', { ref: cut(by, 13) }) : t('roles.json.why.unknown', { ref: cut(by, 40) });
  };

  /* 3 — unter wem eine neue Rolle entsteht: der erste in "holders", der sie mit Unterschrift führt und den ich führe. */
  const creators = new Map<Entry, { readonly item: HolderItem; readonly target: Target }>();
  for (const e of entries) {
    if (e.fact !== null || dropped.has(e)) continue;
    const leading = e.holders.filter((h) => h.level === 'holds');
    let why: string | null = e.holders.length === 0
      ? t('roles.json.why.noHolders', { self: SELF_REF })
      : leading.length === 0 ? t('roles.json.why.noLeader') : null;
    for (const item of leading) {
      const got = resolve(item.by);
      if (typeof got === 'string') { why ??= got; continue; }
      if (!item.sign) { why ??= t('roles.json.why.noSign', { ref: cut(item.by, 40) }); continue; }
      if (got.kind === 'account') { why ??= t('roles.json.why.accountOnlyPersons', { self: SELF_REF }); continue; }
      if (got.kind === 'new' && got.entry === e) { why ??= t('roles.json.why.self'); continue; }
      if (got.kind === 'role' && got.fact.link) { why ??= t('roles.json.why.link', { name: nameOf(got) }); continue; }
      if (got.kind === 'role' && !got.fact.leads) { why ??= t('roles.json.why.notLeading', { name: nameOf(got) }); continue; }
      creators.set(e, { item, target: got });
      break;
    }
    if (!creators.has(e)) { dropped.add(e); warn(t('roles.json.warn.skippedWhy', { where: e.label, why: why ?? t('roles.json.why.nowhereToCreate') })); }
  }

  /* 4 — die Reihenfolge: wer unter einer neuen Rolle entsteht, nach ihr; ein Kreis entsteht nie. */
  const order: Entry[] = [];
  const placed = new Set<Entry>();
  for (let moved = true; moved;) {
    moved = false;
    for (const [e, { target }] of creators) {
      if (placed.has(e) || dropped.has(e)) continue;
      if (target.kind !== 'new' || placed.has(target.entry)) { order.push(e); placed.add(e); moved = true; }
      else if (dropped.has(target.entry)) { dropped.add(e); moved = true; warn(t('roles.json.warn.parentNotMade', { where: e.label, parent: target.entry.label })); }
    }
  }
  for (const e of creators.keys()) {
    if (!placed.has(e) && !dropped.has(e)) { dropped.add(e); warn(t('roles.json.warn.circle', { where: e.label })); }
  }
  if (order.length > MAX_NEW_ROLES) {
    const rest = order.splice(MAX_NEW_ROLES);
    for (const e of rest) dropped.add(e);
    warn(t('roles.json.warn.tooManyNew', { max: MAX_NEW_ROLES, rest: rest.length }));
  }

  const refOf = (x: Target): RoleRef => (x.kind === 'account' ? { id: accountId } : x.kind === 'role' ? { id: x.fact.id } : { key: x.entry.ref });
  const nodeOf = (x: Target): string => (x.kind === 'account' ? accountId : x.kind === 'role' ? x.fact.id : `#new:${x.entry.ref}`);
  const creates: PlannedCreate[] = order.map((e) => {
    const { target } = creators.get(e)!;
    return { key: e.ref, kind: e.kind === 'group' ? 'group' : 'role', name: e.name!, holder: refOf(target), holderName: nameOf(target) };
  });

  /* 5 — Name und Art an Ort und Stelle. */
  const renames: PlannedRename[] = [];
  const retypes: PlannedRetype[] = [];
  for (const e of entries) {
    const fact = e.fact;
    if (fact === null) continue;
    if (e.name !== null && e.name !== (fact.name ?? '')) {
      if (fact.link) warn(t('roles.json.warn.linkName', { where: e.label }));
      else renames.push({ roleId: fact.id, from: fact.name, to: e.name });
    }
    if (e.kind !== null && e.kind !== fact.kind) {
      const swaps = (k: Kind) => k === 'role' || k === 'group';
      if (!swaps(e.kind) || !swaps(fact.kind)) warn(t('roles.json.warn.kindFixed', { where: e.label, from: t(`roles.json.kind.${fact.kind}`), to: t(`roles.json.kind.${e.kind}`) }));
      else if (fact.link) warn(t('roles.json.warn.linkKind', { where: e.label }));
      else retypes.push({ roleId: fact.id, name: e.name ?? fact.name ?? t('roles.json.noName'), to: e.kind === 'group' ? 'group' : 'role' });
    }
  }

  /* 6 — wer hält: nur, was ich geben kann, und nie im Kreis (wie `RoleGraph.WouldCreateCycle`, nur über `holds`). */
  const out = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => out.set(from, (out.get(from) ?? new Set<string>()).add(to));
  for (const h of state.holdings) if (h.level === 'holds') addEdge(h.from, h.to);
  for (const e of order) addEdge(nodeOf(creators.get(e)!.target), nodeOf({ kind: 'new', entry: e }));
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set([from]);
    for (let queue = [from]; queue.length > 0;) {
      const next: string[] = [];
      for (const one of queue) {
        for (const step of out.get(one) ?? []) {
          if (step === to) return true;
          if (!seen.has(step)) { seen.add(step); next.push(step); }
        }
      }
      queue = next;
    }
    return false;
  };

  const holdings: PlannedHolding[] = [];
  /* Die Kante, mit der eine neue Rolle entsteht, ist schon geplant — ein zweites „@ja" wäre dieselbe Zusage doppelt. */
  const planned = new Set(order.map((e) => `${nodeOf(creators.get(e)!.target)}>${nodeOf({ kind: 'new', entry: e })}>holds`));
  let unchanged = 0;
  for (const e of entries) {
    if (dropped.has(e)) continue;
    const role: Target = e.fact !== null ? { kind: 'role', fact: e.fact } : { kind: 'new', entry: e };
    const creator = creators.get(e)?.item;
    for (const item of e.holders) {
      if (item === creator) continue;
      const got = resolve(item.by);
      const where = t('roles.json.whereBy', { where: e.label, by: cut(item.by, 40) });
      if (typeof got === 'string') { warn(t('roles.json.warn.skipped', { where, why: got })); continue; }
      const from = nodeOf(got);
      const to = nodeOf(role);
      if (from === to) { warn(t('roles.json.warn.selfHold', { where })); continue; }
      const label = t('roles.json.holdLabel', { holder: nameOf(got), role: nameOf(role), level: levelWords(item.level, item.sign) });
      const had = state.holdings.find((h) => h.from === from && h.to === to && h.level === item.level);
      if (had !== undefined) {
        if (item.level === 'holds' && item.signGiven && item.sign !== had.sign) {
          warn(t(had.sign ? 'roles.json.warn.signFixedWith' : 'roles.json.warn.signFixedWithout', { where }));
        } else unchanged += 1;
        continue;
      }
      const once = `${from}>${to}>${item.level}`;
      if (planned.has(once)) { warn(t('roles.json.warn.twice', { where })); continue; }
      if (got.kind === 'account') {
        if (role.kind !== 'role' || role.fact.kind !== 'person' || item.level !== 'holds') {
          warn(t('roles.json.warn.accountPersons', { where }));
          continue;
        }
        if (!state.accountLeads) { warn(t('roles.json.warn.accountSign', { where })); continue; }
      }
      if ((got.kind === 'role' && got.fact.link) || (role.kind === 'role' && role.fact.link)) {
        warn(t('roles.json.warn.linkRoles', { where }));
        continue;
      }
      if (got.kind === 'role' && !got.fact.leads) { warn(t('roles.json.warn.notLeading', { where, name: nameOf(got) })); continue; }
      if (item.level === 'holds' && item.sign && role.kind === 'role' && !role.fact.passesSign) {
        warn(t('roles.json.warn.noSignKey', { where, name: nameOf(role) }));
        continue;
      }
      if (reaches(to, from)) { warn(t('roles.json.warn.ring', { where })); continue; }
      planned.add(once);
      if (item.level === 'holds') addEdge(from, to);
      holdings.push({ role: refOf(role), holder: refOf(got), level: item.level, sign: item.level === 'holds' && item.sign, label });
      /* Eine andere Stufe derselben beiden bleibt stehen — wer im Export „read" zu „write" macht, hat danach beides. */
      const other = state.holdings.find((h) => h.from === from && h.to === to && h.level !== item.level);
      if (other !== undefined) {
        warn(t('roles.json.warn.otherLevel', { where, holder: nameOf(got), role: nameOf(role), level: levelWords(other.level, other.sign) }));
      }
      /* Wer eine Person hält, handelt als dieser Mensch — das soll niemand übersehen. */
      if (role.kind === 'role' && role.fact.kind === 'person' && got.kind !== 'account') {
        warn(t(item.level === 'holds' && item.sign ? 'roles.json.warn.personKeySign' : 'roles.json.warn.personKey', { holder: nameOf(got), role: nameOf(role) }));
      }
    }
  }

  /* 7 — die Zeilen der Vorschau. */
  const lines: string[] = [];
  if (creates.length > 0) {
    lines.push(t('roles.json.line.newRoles', { n: creates.length }));
  }
  for (const c of creates) lines.push(t(c.kind === 'group' ? 'roles.json.line.newGroup' : 'roles.json.line.newRole', { name: c.name, holder: c.holderName }));
  for (const r of renames) lines.push(t('roles.json.line.rename', { from: r.from ?? t('roles.json.noName'), to: r.to }));
  for (const r of retypes) lines.push(t(r.to === 'group' ? 'roles.json.line.toGroup' : 'roles.json.line.toRole', { name: r.name }));
  for (const h of holdings) lines.push(t('roles.json.line.newHolding', { label: h.label }));
  if (lines.length === 0) lines.push(t('roles.json.line.nothing'));
  const known = entries.filter((e) => e.fact !== null).map((e) => e.fact!.id);
  if (known.length > 0 || unchanged > 0) {
    lines.push(t('roles.json.line.known', { count: known.length, unchanged }));
  }

  return { creates, renames, retypes, holdings, known, lines, warnings };
}

/* -- Ausführen ----------------------------------------------------------------------------------- */

/** Die Schritte des Imports — `liveRolesOps` gegen den Dienst, in der Prüfung nachgebildet. */
export interface RolesOps {
  /** Legt an und gibt die neue Kennung zurück. */
  create(holderId: string, kind: 'role' | 'group', name: string): Promise<string>;
  rename(roleId: string, name: string): Promise<void>;
  retype(roleId: string, kind: 'role' | 'group'): Promise<void>;
  hold(roleId: string, holderId: string, level: EdgeKind, sign: boolean): Promise<void>;
}

const failure = (e: unknown): string => (e instanceof Error && e.message.trim() !== '' ? e.message : t('roles.json.apply.failed'));

/**
 * DEN PLAN AUSFÜHREN — erst die neuen Rollen (je eine Zeile Fortschritt: das sind die Sekunden), dann Namen,
 * Arten, zuletzt die Halter. Was scheitert, steht in den Warnungen; was an einer gescheiterten neuen Rolle
 * hängt, unterbleibt.
 */
export async function applyRolesImport(
  plan: RolesPlan, ops: RolesOps, stage: (what: string) => void = () => undefined
): Promise<{ lines: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const made = new Map<string, string>();
  const idOf = (ref: RoleRef): string | null => ('id' in ref ? ref.id : made.get(ref.key) ?? null);

  let created = 0;
  for (const [i, c] of plan.creates.entries()) {
    const holder = idOf(c.holder);
    if (holder === null) { warnings.push(t('roles.json.apply.holderMissing', { name: c.name, holder: c.holderName })); continue; }
    stage(t('roles.json.apply.stageRole', { n: i + 1, total: plan.creates.length, name: cut(c.name, 40) }));
    try {
      made.set(c.key, await ops.create(holder, c.kind, c.name));
      created += 1;
    } catch (e) {
      warnings.push(t('roles.json.apply.createFailed', { name: c.name, reason: failure(e) }));
    }
  }

  let renamed = 0;
  for (const [i, r] of plan.renames.entries()) {
    stage(t('roles.json.apply.stageRename', { n: i + 1, total: plan.renames.length }));
    try { await ops.rename(r.roleId, r.to); renamed += 1; } catch (e) { warnings.push(t('roles.json.apply.renameFailed', { from: r.from ?? t('roles.json.noName'), to: r.to, reason: failure(e) })); }
  }

  let retyped = 0;
  for (const [i, r] of plan.retypes.entries()) {
    stage(t('roles.json.apply.stageRetype', { n: i + 1, total: plan.retypes.length }));
    try { await ops.retype(r.roleId, r.to); retyped += 1; } catch (e) { warnings.push(t('roles.json.apply.namedFailed', { name: r.name, reason: failure(e) })); }
  }

  let held = 0;
  for (const [i, h] of plan.holdings.entries()) {
    const role = idOf(h.role);
    const holder = idOf(h.holder);
    if (role === null || holder === null) { warnings.push(t('roles.json.apply.holdSkipped', { label: h.label })); continue; }
    stage(t('roles.json.apply.stageHold', { n: i + 1, total: plan.holdings.length }));
    try { await ops.hold(role, holder, h.level, h.sign); held += 1; } catch (e) { warnings.push(t('roles.json.apply.holdFailed', { label: h.label, reason: failure(e) })); }
  }

  const lines: string[] = [];
  if (plan.creates.length > 0) lines.push(t('roles.json.apply.roles', { n: created, total: plan.creates.length }));
  if (plan.renames.length > 0) lines.push(t('roles.json.apply.renames', { n: renamed, total: plan.renames.length }));
  if (plan.retypes.length > 0) lines.push(t('roles.json.apply.retypes', { n: retyped, total: plan.retypes.length }));
  if (plan.holdings.length > 0) lines.push(t('roles.json.apply.holdings', { n: held, total: plan.holdings.length }));
  if (lines.length === 0) lines.push(t('roles.json.apply.nothing'));
  return { lines, warnings };
}

/**
 * Die Schritte gegen den Dienst — dieselben Wege wie der Graph (`roles.ts`): Schlüssel, Hüllen, Namen und
 * Unterschriften entstehen hier im Browser. Eine eben angelegte Rolle kennt der Bund sofort (`withRole`): wer
 * unter ihr entsteht oder sie weitergibt, braucht ihre Schlüssel, bevor der Graph neu geladen ist.
 */
export function liveRolesOps(start: Ring, graph: RoleGraphData): RolesOps {
  let ring = start;
  const known = new Map<string, SealedRole>(graph.roles.map((r) => [r.id, r]));
  const roleOf = (id: string): SealedRole => {
    const found = known.get(id) ?? ring.roleOf(id);
    if (found === undefined) throw new WorkspaceError(t('roles.json.apply.gone'));
    return found;
  };
  return {
    create: async (holderId, kind, name) => {
      const made = await createRoleWithKeys(ring, roleOf(holderId), { kind, name });
      ring = ring.withRole(made.role, made.roleKey, made.signKey);
      known.set(made.id, made.role);
      return made.id;
    },
    rename: async (roleId, name) => { await renameRole(ring, roleId, name); },
    retype: async (roleId, kind) => { await retypeRole(roleId, kind); },
    hold: async (roleId, holderId, level, sign) => { await addHolder(ring, roleId, roleOf(holderId), level, sign); }
  };
}

/* -- Die Beschreibung ------------------------------------------------------------------------------ */

/* Ein erfundenes Konto für das Beispiel des Exports — die Kennungen sind sichtbar unecht. */
const fakeId = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const fake = (n: number, kind: Kind, name: string, more: Partial<RoleFacts> = {}): RoleFacts => ({
  id: fakeId(n), kind, name, readable: true, leads: true, passesSign: true, link: false, areas: [],
  createdAt: `2026-01-0${n}T10:00:00Z`, ...more
});
const exampleState = (): RolesState => ({
  accountId: fakeId(9), accountLeads: true, selfId: fakeId(1),
  roles: [
    fake(1, 'person', t('roles.json.example.anna')),
    fake(2, 'role', t('roles.json.example.secretary'), { areas: [{ name: t('roles.json.example.parish'), level: 'write' }] }),
    fake(3, 'group', t('roles.json.example.readers'), { leads: false, passesSign: false })
  ],
  holdings: [
    { from: fakeId(9), to: fakeId(1), level: 'holds', sign: true, createdAt: '2026-01-01T10:00:00Z' },
    { from: fakeId(1), to: fakeId(2), level: 'holds', sign: true, createdAt: '2026-01-02T10:00:00Z' },
    { from: fakeId(2), to: fakeId(3), level: 'holds', sign: false, createdAt: '2026-01-03T10:00:00Z' }
  ]
});

/** Eine Pfarrei: Proboszcz unter mir, darunter Kancelaria, Rada und Schola — mit Lesekanten daneben. */
const parishSample = () => ({
  format: ROLES_FORMAT,
  version: ROLES_VERSION,
  roles: [
    { key: 'proboszcz', kind: 'role', name: t('roles.json.example.pastor'), holders: [{ by: SELF_REF, level: 'holds', sign: true }] },
    { key: 'kancelaria', kind: 'role', name: t('roles.json.example.office'), holders: [{ by: '@proboszcz', level: 'holds', sign: true }] },
    { key: 'rada', kind: 'group', name: t('roles.json.example.council'), holders: [{ by: '@proboszcz', level: 'holds', sign: true }, { by: '@kancelaria', level: 'read' }] },
    { key: 'schola', kind: 'group', name: t('roles.json.example.schola'), holders: ['@proboszcz', { by: '@rada', level: 'read' }] }
  ]
});

/** Eine Schule: Dyrektor, Nauczyciele, ein Wychowawca, den die Nauczyciele mitschreiben. */
const schoolSample = () => ({
  format: ROLES_FORMAT,
  version: ROLES_VERSION,
  roles: [
    { key: 'dyrektor', kind: 'role', name: t('roles.json.example.director'), holders: [SELF_REF] },
    { key: 'nauczyciele', kind: 'group', name: t('roles.json.example.teachers'), holders: ['@dyrektor'] },
    { key: 'wychowawca-1a', kind: 'role', name: t('roles.json.example.tutor'), holders: [{ by: '@dyrektor', level: 'holds', sign: true }, { by: '@nauczyciele', level: 'write' }] }
  ]
});

const ENTRY_JSON: JsonNode = {
  key: 'roles.entry',
  get title() { return t('roles.json.node.entry'); },
  text: () => t('roles.json.node.entryText', { keys: keyLines(ENTRY_KEYS, ''), areas: keyLines(AREA_KEYS) })
};

const HOLDER_JSON: JsonNode = {
  key: 'roles.holder',
  get title() { return t('roles.json.node.holder'); },
  get short() { return t('roles.json.node.holderShort'); },
  text: () => t('roles.json.node.holderText', { keys: keyLines(HOLDER_KEYS, '') })
};

/*
 * 2026-10-30 — WAS DER GRAPH IM SYSTEM TRÄGT: jede Kante den Rollenschlüssel (`addHolder`), der Bund wird
 * gelaufen (`core/keys.ts`); Rechte des Dienstes nur über `holds` (`Workspace.RolesOfAsync`: Bereiche, Rozmowy,
 * Seiten, Wecken); Bereichszugang als Zertifikat an der Rolle, zwei Jahre, erneuert (`Area.Renew.cs`);
 * Formular und Link geben eine Rolle (`Form.Members.cs`); der Signierschlüssel nur mit „holds" und „sign".
 */
const USAGE_JSON: JsonNode = {
  key: 'roles.usage',
  get title() { return t('roles.json.node.usage'); },
  text: () => t('roles.json.node.usageText')
};

/** DIE BESCHREIBUNG — neben dem Import und für einen Assistenten (MCP). Ohne Zusammenhang aufrufbar. */
export const ROLES_JSON: JsonNode = {
  key: 'roles',
  get title() { return t('roles.json.node.root', { format: ROLES_FORMAT, version: ROLES_VERSION }); },
  get short() { return t('roles.json.node.rootShort'); },
  text: () => t('roles.json.node.rootText', {
    self: SELF_REF, account: ACCOUNT_REF, maxNew: MAX_NEW_ROLES, maxEntries: MAX_ENTRIES, top: keyLines(TOP_KEYS),
    export: pretty(exportRoles(exampleState())), sample: pretty(parishSample())
  }),
  inside: () => [USAGE_JSON, ENTRY_JSON, HOLDER_JSON],
  samples: () => [
    { label: t('roles.json.sample.parish'), doc: parishSample },
    { label: t('roles.json.sample.school'), doc: schoolSample }
  ]
};

/** Die Beschreibung als Text — für den Katalog des MCP-Servers (`scripts/import-formats.mjs`). */
export const rolesDescription = (): string => describe(ROLES_JSON);
