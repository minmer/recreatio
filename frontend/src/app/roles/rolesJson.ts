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
import { plural } from '../core/plural';
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
  ['osoba', 'person'], ['rola', 'role'], ['grupa', 'group'], ['konto', 'account']
]);
const LEVELS = new Map<string, EdgeKind>([
  ['holds', 'holds'], ['write', 'write'], ['read', 'read'], ['prowadzi', 'holds'], ['pisze', 'write'], ['czyta', 'read']
]);

const KIND_WORD: Readonly<Record<Kind, string>> = { account: 'konto', person: 'osoba', role: 'rola', group: 'grupa' };
const LEVEL_ORDER: Readonly<Record<EdgeKind, number>> = { holds: 0, write: 1, read: 2 };

/* -- Was die Beschreibung sagt ------------------------------------------------------------------- */

const TOP_KEYS: Readonly<Record<string, string>> = {
  format: `zawsze "${ROLES_FORMAT}"`,
  version: `${ROLES_VERSION} (wersja formatu)`,
  roles: 'osoby, role i grupy (niżej: Wpis w "roles"); eksport podaje je od konta w dół — kto trzyma, stoi przed tym, co trzyma',
  sealed: 'tylko w eksporcie: ile ról widać w koncie, choć ta przeglądarka ich nie otwiera (w eksporcie ich nie ma); import tę liczbę pomija'
};

const ENTRY_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator roli z eksportu — wpis z "id" to rola, która już jest, i zmienia się w miejscu; nowa rola NIE ma "id" (dostaje go przy zakładaniu)',
  key: `krótka nazwa wpisu do odwołań "@klucz" w tym dokumencie — litery, cyfry, "-", "_", "." (do 40 znaków), np. "rada"; "${ACCOUNT_KEY}" jest zarezerwowane, "${SELF_KEY}" — tylko dla Twojej pierwszej osoby`,
  kind: '"person" (osoba — człowiek), "role" (rola — funkcja, którą ktoś pełni i przekazuje dalej) albo "group" (grupa — ci, którzy do niej należą); można też po polsku: "osoba", "rola", "grupa". Nowy wpis bez "kind" to "role". Rolę da się zmienić na grupę i z powrotem, osoby — nie',
  name: `nazwa (do ${MAX_NAME} znaków), pieczętowana w przeglądarce kluczem roli — usługa jej nie widzi; przy wpisie z "id" inna nazwa to zmiana nazwy; nowa rola musi ją mieć`,
  holders: 'kto trzyma tę rolę (niżej: Kto trzyma); nową rolę zakłada pierwszy z listy, kto ją prowadzi ("holds" z podpisem) i kogo Ty prowadzisz — reszta listy dochodzi potem',
  areas: 'tylko informacja z eksportu: do jakich obszarów prowadzi rola (sama albo przez role, które trzyma) — lista { "name", "level" } (niżej); import jej nie zmienia, dostęp do obszarów nadaje się w Obszarach',
  link: 'tylko informacja z eksportu: true — to rola linku dostępu; import jej nie zmienia (ani nazwy, ani kto ją trzyma, ani tego, co ona trzyma) — linki zmienia się przy linkach'
};

const AREA_KEYS: Readonly<Record<string, string>> = {
  name: 'nazwa obszaru',
  level: '"read" (czyta), "write" (pisze) albo "admin" (prowadzi — może też wpuszczać innych)'
};

const HOLDER_KEYS: Readonly<Record<string, string>> = {
  by: `kto trzyma: "@klucz" (wpis tego dokumentu), "${SELF_REF}" (Twoja pierwsza osoba — ta z rejestracji), "${ACCOUNT_REF}" (konto; trzyma tylko osoby) albo "id" roli z eksportu. Zamiast obiektu wystarczy sam ten napis — wtedy "level": "holds" i "sign": true`,
  level: '"holds" — prowadzi: zmienia, przekazuje dalej, przyjmuje innych (domyślnie); "write" — pisze: dopisuje to, co należy do roli; "read" — czyta: widzi. Można też po polsku: "prowadzi", "pisze", "czyta"',
  sign: 'tylko przy "holds": true (domyślnie) — dostaje też klucz podpisu i działa w imieniu roli; false — należy do roli bez podpisu (jak przez link „Członek”). Podpisu w powiązaniu, które już jest, import nie zmienia'
};

/** Jeder Schlüssel als Pfad (`roles[].holders[].by`) mit seinem Satz — für die Prüfung (`app-json-roles-check.mjs`). */
export const ROLES_PATHS: Readonly<Record<string, string>> = {
  ...TOP_KEYS,
  ...Object.fromEntries(Object.entries(ENTRY_KEYS).map(([k, v]) => [`roles[].${k}`, v])),
  ...Object.fromEntries(Object.entries(HOLDER_KEYS).map(([k, v]) => [`roles[].holders[].${k}`, v])),
  ...Object.fromEntries(Object.entries(AREA_KEYS).map(([k, v]) => [`roles[].areas[].${k}`, v]))
};

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
  if (level === 'holds') return sign ? 'prowadzi, z podpisem' : 'prowadzi, bez podpisu';
  return level === 'write' ? 'pisze' : 'czyta';
}

function readHolder(raw: unknown, where: string, warnings: string[]): HolderItem | null {
  if (typeof raw === 'string') {
    if (raw.trim() !== '') return { by: raw.trim(), level: 'holds', sign: true, signGiven: false };
    warnings.push(`${where}: puste odwołanie — pominięte.`);
    return null;
  }
  if (!isObject(raw)) { warnings.push(`${where}: to nie jest odwołanie ani obiekt — pominięte.`); return null; }
  for (const key of Object.keys(raw)) if (!HOLDER_SET.has(key)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);
  if (typeof raw.by !== 'string' || raw.by.trim() === '') { warnings.push(`${where}: brak "by" (kto trzyma) — pominięte.`); return null; }
  let level: EdgeKind = 'holds';
  if (raw.level !== undefined && raw.level !== null) {
    const found = typeof raw.level === 'string' ? LEVELS.get(raw.level.trim().toLowerCase()) : undefined;
    if (found === undefined) {
      warnings.push(`${where}: nieznany stopień ${cut(JSON.stringify(raw.level) ?? '?', 40)} — pominięte (dozwolone: "holds", "write", "read").`);
      return null;
    }
    level = found;
  }
  let sign = level === 'holds';
  const signGiven = raw.sign !== undefined && raw.sign !== null;
  if (signGiven) {
    if (typeof raw.sign !== 'boolean') warnings.push(`${where}: "sign" to true albo false — ${level === 'holds' ? 'przyjmuję true' : 'pominięte'}.`);
    else if (raw.sign && level !== 'holds') warnings.push(`${where}: klucz podpisu idzie tylko z "holds" — przy "${level}" pominięty.`);
    else sign = raw.sign;
  }
  return { by: raw.by.trim(), level, sign, signGiven: signGiven && typeof raw.sign === 'boolean' };
}

/**
 * WAS EIN DOKUMENT ÄNDERN WÜRDE — oder warum es nicht geht. Rein: der Stand ist vorher geladen
 * (`rolesStateOf`). Jede Zeile ist eine Änderung; alles Übergangene steht in den Warnungen.
 */
export function planRolesImport(doc: unknown, state: RolesState): RolesPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument ról — oczekiwano obiektu JSON z listą "roles".' };
  if (doc.format !== undefined && doc.format !== ROLES_FORMAT) return { error: `Inny format: "${String(doc.format)}" — oczekiwano "${ROLES_FORMAT}".` };
  if (!Array.isArray(doc.roles)) return { error: 'Brakuje listy "roles".' };
  if (state.accountId === null) return { error: 'To konto nie ma jeszcze struktury ról — nie ma do czego importować.' };
  const accountId = state.accountId;

  const warnings: string[] = [];
  const warn = (text: string) => warnings.push(text);
  for (const key of Object.keys(doc)) if (!TOP_SET.has(key)) warn(`Nieznany klucz "${key}" — pominięty.`);
  if (doc.version !== undefined && doc.version !== ROLES_VERSION) warn(`Wersja ${cut(String(doc.version), 20)} — czytam jak wersję ${ROLES_VERSION}.`);

  const facts = new Map(state.roles.filter((r) => r.readable).map((r) => [r.id, r]));
  const sealedIds = new Set(state.roles.filter((r) => !r.readable).map((r) => r.id));
  const list: readonly unknown[] = doc.roles.slice(0, MAX_ENTRIES);
  if (doc.roles.length > MAX_ENTRIES) warn(`Najwyżej ${MAX_ENTRIES} wpisów w jednym dokumencie — dalsze pominięte.`);

  /* 1 — die Einträge, jeder für sich. */
  const entries: Entry[] = [];
  const byKey = new Map<string, Entry>();
  const seenIds = new Set<string>();
  list.forEach((raw, i) => {
    const at = i + 1;
    if (!isObject(raw)) { warn(`Wpis ${at}: to nie jest obiekt — pominięty.`); return; }
    const given = typeof raw.name === 'string' ? raw.name.trim() : '';
    const label = given !== '' ? `„${cut(given, 60)}”` : typeof raw.key === 'string' && raw.key.trim() !== '' ? `„@${cut(raw.key.trim(), 40)}”` : `Wpis ${at}`;
    for (const key of Object.keys(raw)) if (!ENTRY_SET.has(key)) warn(`${label}: nieznany klucz "${key}" — pominięty.`);

    let fact: RoleFacts | null = null;
    if (raw.id !== undefined && raw.id !== null) {
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      if (id === '') { warn(`${label}: "id" musi być tekstem — wpis pominięty.`); return; }
      if (id === accountId) { warn(`${label}: to konto, nie rola — odwołuj się do niego przez "${ACCOUNT_REF}"; wpis pominięty.`); return; }
      if (seenIds.has(id)) { warn(`${label}: ta sama rola ("id") drugi raz — wpis pominięty.`); return; }
      const found = facts.get(id);
      if (found === undefined) {
        warn(sealedIds.has(id)
          ? `${label}: tej roli nie otwierasz w tej przeglądarce — pominięta.`
          : `${label}: nie ma takiej roli w tym koncie ("id" z innego konta?) — pominięta. Nowa rola nie ma "id".`);
        return;
      }
      fact = found;
      seenIds.add(id);
    }

    let key: string | null = null;
    if (raw.key !== undefined && raw.key !== null) {
      const k = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '') : '';
      if (!KEY_PATTERN.test(k)) warn(`${label}: klucz ${cut(JSON.stringify(raw.key) ?? '?', 50)} — tylko litery, cyfry, „-”, „_” i „.” (do 40 znaków); do tego wpisu nie da się odwołać.`);
      else if (k === ACCOUNT_KEY || (k === SELF_KEY && (fact === null || fact.id !== state.selfId))) warn(`${label}: klucz „${k}” jest zarezerwowany ("@${k}") — pominięty.`);
      else if (byKey.has(k)) warn(`${label}: klucz „${k}” drugi raz — odwołania „@${k}” prowadzą do pierwszego wpisu.`);
      else key = k;
    }

    let kind: Kind | null = null;
    if (raw.kind !== undefined && raw.kind !== null) {
      const found = typeof raw.kind === 'string' ? KINDS.get(raw.kind.trim().toLowerCase()) : undefined;
      if (found === undefined) warn(`${label}: nieznany rodzaj ${cut(JSON.stringify(raw.kind) ?? '?', 40)} — ${fact === null ? 'będzie „role”' : 'rodzaj zostaje'}.`);
      else kind = found;
    }

    let name: string | null = null;
    if (raw.name !== undefined && raw.name !== null) {
      if (typeof raw.name !== 'string') warn(`${label}: "name" musi być tekstem — pominięte.`);
      else if (given === '') { if (fact !== null) warn(`${label}: pusta nazwa — zostaje, jaka była.`); }
      else if (given.length > MAX_NAME) { warn(`${label}: nazwa dłuższa niż ${MAX_NAME} znaków — skrócona.`); name = given.slice(0, MAX_NAME).trim(); }
      else name = given;
    }

    const holders: HolderItem[] = [];
    if (raw.holders !== undefined && raw.holders !== null) {
      if (!Array.isArray(raw.holders)) warn(`${label}: "holders" musi być listą — pominięte.`);
      else raw.holders.forEach((one, j) => {
        const item = readHolder(one, `${label}, "holders" ${j + 1}`, warnings);
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
    if (kind === 'person') { dropped.add(e); warn(`${e.label}: osób import nie zakłada — osobę zakładasz sam (Role → Konto → „Nowa osoba”); pominięta.`); }
    else if (kind === 'account') { dropped.add(e); warn(`${e.label}: konta nie da się założyć importem — pominięte.`); }
    else if (e.name === null) { dropped.add(e); warn(`${e.label}: nowa rola potrzebuje nazwy ("name") — pominięta.`); }
  }

  const nameOf = (t: Target): string =>
    t.kind === 'account' ? 'Konto' : t.kind === 'role' ? t.fact.name ?? 'bez nazwy' : t.entry.name ?? t.entry.label;

  /** Wer mit „by" gemeint ist — oder warum niemand. */
  const resolve = (by: string): Target | string => {
    if (by === ACCOUNT_REF || by === accountId) return { kind: 'account' };
    if (by === SELF_REF) {
      const self = state.selfId === null ? undefined : facts.get(state.selfId);
      return self === undefined ? `„${SELF_REF}”: to konto nie prowadzi jeszcze żadnej osoby` : { kind: 'role', fact: self };
    }
    if (by.startsWith('@')) {
      const e = byKey.get(by.slice(1));
      if (e === undefined) return `odwołanie „${cut(by, 40)}” prowadzi donikąd`;
      if (dropped.has(e)) return `„${cut(by, 40)}” nie powstanie`;
      return e.fact !== null ? { kind: 'role', fact: e.fact } : { kind: 'new', entry: e };
    }
    const fact = facts.get(by);
    if (fact !== undefined) return { kind: 'role', fact };
    return sealedIds.has(by) ? `roli „${cut(by, 13)}” nie otwierasz w tej przeglądarce` : `nie wiadomo, kto to jest: „${cut(by, 40)}”`;
  };

  /* 3 — unter wem eine neue Rolle entsteht: der erste in "holders", der sie mit Unterschrift führt und den ich führe. */
  const creators = new Map<Entry, { readonly item: HolderItem; readonly target: Target }>();
  for (const e of entries) {
    if (e.fact !== null || dropped.has(e)) continue;
    const leading = e.holders.filter((h) => h.level === 'holds');
    let why: string | null = e.holders.length === 0
      ? `nowa rola potrzebuje "holders" — kogoś, kto ją poprowadzi (np. "${SELF_REF}")`
      : leading.length === 0 ? 'nikt jej nie prowadzi — potrzebny "level": "holds"' : null;
    for (const item of leading) {
      const t = resolve(item.by);
      if (typeof t === 'string') { why ??= t; continue; }
      if (!item.sign) { why ??= `„${cut(item.by, 40)}” ma "sign": false — kto zakłada rolę, prowadzi ją z podpisem`; continue; }
      if (t.kind === 'account') { why ??= `konto trzyma tylko osoby — rolę albo grupę załóż pod osobą (np. "${SELF_REF}")`; continue; }
      if (t.kind === 'new' && t.entry === e) { why ??= 'rola nie może trzymać samej siebie'; continue; }
      if (t.kind === 'role' && t.fact.link) { why ??= `„${nameOf(t)}” to rola linku dostępu`; continue; }
      if (t.kind === 'role' && !t.fact.leads) { why ??= `nie prowadzisz „${nameOf(t)}” z podpisem`; continue; }
      creators.set(e, { item, target: t });
      break;
    }
    if (!creators.has(e)) { dropped.add(e); warn(`${e.label}: ${why ?? 'nie ma pod kim jej założyć'} — pominięta.`); }
  }

  /* 4 — die Reihenfolge: wer unter einer neuen Rolle entsteht, nach ihr; ein Kreis entsteht nie. */
  const order: Entry[] = [];
  const placed = new Set<Entry>();
  for (let moved = true; moved;) {
    moved = false;
    for (const [e, { target }] of creators) {
      if (placed.has(e) || dropped.has(e)) continue;
      if (target.kind !== 'new' || placed.has(target.entry)) { order.push(e); placed.add(e); moved = true; }
      else if (dropped.has(target.entry)) { dropped.add(e); moved = true; warn(`${e.label}: nie powstanie ${target.entry.label}, więc i ta rola — pominięta.`); }
    }
  }
  for (const e of creators.keys()) {
    if (!placed.has(e) && !dropped.has(e)) { dropped.add(e); warn(`${e.label}: nowe role w "holders" trzymają się nawzajem w kółko — pominięta.`); }
  }
  if (order.length > MAX_NEW_ROLES) {
    const rest = order.splice(MAX_NEW_ROLES);
    for (const e of rest) dropped.add(e);
    warn(`Najwyżej ${MAX_NEW_ROLES} nowych ról w jednym imporcie — ${rest.length} pominięto (zaimportuj ten sam dokument jeszcze raz, gdy te powstaną).`);
  }

  const refOf = (t: Target): RoleRef => (t.kind === 'account' ? { id: accountId } : t.kind === 'role' ? { id: t.fact.id } : { key: t.entry.ref });
  const nodeOf = (t: Target): string => (t.kind === 'account' ? accountId : t.kind === 'role' ? t.fact.id : `#new:${t.entry.ref}`);
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
      if (fact.link) warn(`${e.label}: to rola linku dostępu — jej nazwę zmienia się przy linku; zostaje.`);
      else renames.push({ roleId: fact.id, from: fact.name, to: e.name });
    }
    if (e.kind !== null && e.kind !== fact.kind) {
      const swaps = (k: Kind) => k === 'role' || k === 'group';
      if (!swaps(e.kind) || !swaps(fact.kind)) warn(`${e.label}: rodzaju „${KIND_WORD[fact.kind]}” nie da się zmienić na „${KIND_WORD[e.kind]}” — zostaje.`);
      else if (fact.link) warn(`${e.label}: to rola linku dostępu — rodzaj zostaje.`);
      else retypes.push({ roleId: fact.id, name: e.name ?? fact.name ?? 'bez nazwy', to: e.kind === 'group' ? 'group' : 'role' });
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
      const t = resolve(item.by);
      const where = `${e.label}, „${cut(item.by, 40)}”`;
      if (typeof t === 'string') { warn(`${where}: ${t} — pominięte.`); continue; }
      const from = nodeOf(t);
      const to = nodeOf(role);
      if (from === to) { warn(`${where}: rola nie może trzymać samej siebie — pominięte.`); continue; }
      const label = `„${nameOf(t)}” trzyma „${nameOf(role)}” (${levelWords(item.level, item.sign)})`;
      const had = state.holdings.find((h) => h.from === from && h.to === to && h.level === item.level);
      if (had !== undefined) {
        if (item.level === 'holds' && item.signGiven && item.sign !== had.sign) {
          warn(`${where}: to powiązanie już jest, ${had.sign ? 'z podpisem' : 'bez podpisu'} — podpisu import nie zmienia (odbierz i nadaj w Rolach).`);
        } else unchanged += 1;
        continue;
      }
      const once = `${from}>${to}>${item.level}`;
      if (planned.has(once)) { warn(`${where}: to samo powiązanie drugi raz — pominięte.`); continue; }
      if (t.kind === 'account') {
        if (role.kind !== 'role' || role.fact.kind !== 'person' || item.level !== 'holds') {
          warn(`${where}: konto trzyma tylko osoby i tylko prowadząc ("holds") — pominięte.`);
          continue;
        }
        if (!state.accountLeads) { warn(`${where}: ta przeglądarka nie podpisuje w imieniu konta — pominięte.`); continue; }
      }
      if ((t.kind === 'role' && t.fact.link) || (role.kind === 'role' && role.fact.link)) {
        warn(`${where}: role linków dostępu zmienia się przy linkach, nie tutaj — pominięte.`);
        continue;
      }
      if (t.kind === 'role' && !t.fact.leads) { warn(`${where}: nie prowadzisz „${nameOf(t)}” z podpisem — w jej imieniu nikogo nie przyjmiesz; pominięte.`); continue; }
      if (item.level === 'holds' && item.sign && role.kind === 'role' && !role.fact.passesSign) {
        warn(`${where}: nie masz klucza podpisu „${nameOf(role)}” — ustaw "sign": false, żeby dać ją bez podpisu; pominięte.`);
        continue;
      }
      if (reaches(to, from)) { warn(`${where}: to zamknęłoby krąg — obie role otwierałyby się nawzajem; pominięte.`); continue; }
      planned.add(once);
      if (item.level === 'holds') addEdge(from, to);
      holdings.push({ role: refOf(role), holder: refOf(t), level: item.level, sign: item.level === 'holds' && item.sign, label });
      /* Eine andere Stufe derselben beiden bleibt stehen — wer im Export „read" zu „write" macht, hat danach beides. */
      const other = state.holdings.find((h) => h.from === from && h.to === to && h.level !== item.level);
      if (other !== undefined) {
        warn(`${where}: „${nameOf(t)}” trzyma już „${nameOf(role)}” (${levelWords(other.level, other.sign)}) — to powiązanie zostaje obok nowego; odbiera się je w Rolach.`);
      }
      /* Wer eine Person hält, handelt als dieser Mensch — das soll niemand übersehen. */
      if (role.kind === 'role' && role.fact.kind === 'person' && t.kind !== 'account') {
        warn(`Uwaga: „${nameOf(t)}” dostanie klucz osoby „${nameOf(role)}” — każdy, kto trzyma „${nameOf(t)}”, zobaczy to, co ta osoba${item.level === 'holds' && item.sign ? ', i będzie działać w jej imieniu' : ''}.`);
      }
    }
  }

  /* 7 — die Zeilen der Vorschau. */
  const lines: string[] = [];
  if (creates.length > 0) {
    lines.push(`Nowe role: ${creates.length} — każda to dwa klucze RSA-4096 liczone w tej przeglądarce, kilka sekund na rolę (na telefonie dłużej). Nie zamykaj karty, póki import trwa.`);
  }
  for (const c of creates) lines.push(`Nowa ${KIND_WORD[c.kind]} „${c.name}” pod „${c.holderName}”.`);
  for (const r of renames) lines.push(`Zmiana nazwy: „${r.from ?? 'bez nazwy'}” → „${r.to}”.`);
  for (const r of retypes) lines.push(`Zmiana rodzaju: „${r.name}” — ${r.to === 'group' ? 'rola → grupa' : 'grupa → rola'}.`);
  for (const h of holdings) lines.push(`Nowe powiązanie: ${h.label}.`);
  if (lines.length === 0) lines.push('Nic się nie zmieni.');
  const known = entries.filter((e) => e.fact !== null).map((e) => e.fact!.id);
  if (known.length > 0 || unchanged > 0) {
    lines.push(`Rozpoznane po "id": ${known.length} ${plural(known.length, 'rola', 'role', 'ról')}; powiązań, które już są: ${unchanged}. Niczego się nie usuwa.`);
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

const failure = (e: unknown): string => (e instanceof Error && e.message.trim() !== '' ? e.message : 'nie udało się');

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
    if (holder === null) { warnings.push(`„${c.name}”: nie powstała, bo nie powstała „${c.holderName}”.`); continue; }
    stage(`Rola ${i + 1} z ${plan.creates.length}: „${cut(c.name, 40)}” — liczenie kluczy…`);
    try {
      made.set(c.key, await ops.create(holder, c.kind, c.name));
      created += 1;
    } catch (e) {
      warnings.push(`„${c.name}”: ${failure(e)} — nie powstała.`);
    }
  }

  let renamed = 0;
  for (const [i, r] of plan.renames.entries()) {
    stage(`Zmiana nazwy ${i + 1} z ${plan.renames.length}…`);
    try { await ops.rename(r.roleId, r.to); renamed += 1; } catch (e) { warnings.push(`„${r.from ?? 'bez nazwy'}” → „${r.to}”: ${failure(e)}.`); }
  }

  let retyped = 0;
  for (const [i, r] of plan.retypes.entries()) {
    stage(`Zmiana rodzaju ${i + 1} z ${plan.retypes.length}…`);
    try { await ops.retype(r.roleId, r.to); retyped += 1; } catch (e) { warnings.push(`„${r.name}”: ${failure(e)}.`); }
  }

  let held = 0;
  for (const [i, h] of plan.holdings.entries()) {
    const role = idOf(h.role);
    const holder = idOf(h.holder);
    if (role === null || holder === null) { warnings.push(`${h.label}: pominięte — rola nie powstała.`); continue; }
    stage(`Powiązanie ${i + 1} z ${plan.holdings.length}…`);
    try { await ops.hold(role, holder, h.level, h.sign); held += 1; } catch (e) { warnings.push(`${h.label}: ${failure(e)}.`); }
  }

  const lines: string[] = [];
  if (plan.creates.length > 0) lines.push(`Nowe role: ${created} z ${plan.creates.length}.`);
  if (plan.renames.length > 0) lines.push(`Zmienione nazwy: ${renamed} z ${plan.renames.length}.`);
  if (plan.retypes.length > 0) lines.push(`Zmieniony rodzaj: ${retyped} z ${plan.retypes.length}.`);
  if (plan.holdings.length > 0) lines.push(`Nowe powiązania: ${held} z ${plan.holdings.length}.`);
  if (lines.length === 0) lines.push('Nic się nie zmieniło.');
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
    if (found === undefined) throw new WorkspaceError('Tej roli już nie ma — odśwież Role.');
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
const EXAMPLE_STATE: RolesState = {
  accountId: fakeId(9), accountLeads: true, selfId: fakeId(1),
  roles: [
    fake(1, 'person', 'Anna Nowak'),
    fake(2, 'role', 'Sekretarz parafii', { areas: [{ name: 'Parafia św. Józefa', level: 'write' }] }),
    fake(3, 'group', 'Lektorzy', { leads: false, passesSign: false })
  ],
  holdings: [
    { from: fakeId(9), to: fakeId(1), level: 'holds', sign: true, createdAt: '2026-01-01T10:00:00Z' },
    { from: fakeId(1), to: fakeId(2), level: 'holds', sign: true, createdAt: '2026-01-02T10:00:00Z' },
    { from: fakeId(2), to: fakeId(3), level: 'holds', sign: false, createdAt: '2026-01-03T10:00:00Z' }
  ]
};

/** Eine Pfarrei: Proboszcz unter mir, darunter Kancelaria, Rada und Schola — mit Lesekanten daneben. */
const PARISH_SAMPLE = {
  format: ROLES_FORMAT,
  version: ROLES_VERSION,
  roles: [
    { key: 'proboszcz', kind: 'role', name: 'Proboszcz', holders: [{ by: SELF_REF, level: 'holds', sign: true }] },
    { key: 'kancelaria', kind: 'role', name: 'Kancelaria parafialna', holders: [{ by: '@proboszcz', level: 'holds', sign: true }] },
    { key: 'rada', kind: 'group', name: 'Rada parafialna', holders: [{ by: '@proboszcz', level: 'holds', sign: true }, { by: '@kancelaria', level: 'read' }] },
    { key: 'schola', kind: 'group', name: 'Schola', holders: ['@proboszcz', { by: '@rada', level: 'read' }] }
  ]
};

/** Eine Schule: Dyrektor, Nauczyciele, ein Wychowawca, den die Nauczyciele mitschreiben. */
const SCHOOL_SAMPLE = {
  format: ROLES_FORMAT,
  version: ROLES_VERSION,
  roles: [
    { key: 'dyrektor', kind: 'role', name: 'Dyrektor szkoły', holders: [SELF_REF] },
    { key: 'nauczyciele', kind: 'group', name: 'Nauczyciele', holders: ['@dyrektor'] },
    { key: 'wychowawca-1a', kind: 'role', name: 'Wychowawca klasy 1a', holders: [{ by: '@dyrektor', level: 'holds', sign: true }, { by: '@nauczyciele', level: 'write' }] }
  ]
};

const ENTRY_JSON: JsonNode = {
  key: 'roles.entry',
  title: 'Wpis w "roles"',
  text: () => `${keyLines(ENTRY_KEYS, '')}
Obszar w "areas" (tylko informacja):
${keyLines(AREA_KEYS)}`
};

const HOLDER_JSON: JsonNode = {
  key: 'roles.holder',
  title: 'Kto trzyma ("holders[]")',
  short: 'Kto trzyma',
  text: () => `${keyLines(HOLDER_KEYS, '')}
Kto trzyma rolę, widzi wszystko, co ona widzi (jej obszary, rozmowy, kalendarze, role, które ona trzyma); z kluczem podpisu działa też w jej imieniu. Ta sama para na innym stopniu to osobne powiązanie (np. "read" obok "holds"). Konto trzyma tylko osoby i tylko z "holds".`
};

/*
 * 2026-10-30 — WAS DER GRAPH IM SYSTEM TRÄGT: jede Kante den Rollenschlüssel (`addHolder`), der Bund wird
 * gelaufen (`core/keys.ts`); Rechte des Dienstes nur über `holds` (`Workspace.RolesOfAsync`: Bereiche, Rozmowy,
 * Seiten, Wecken); Bereichszugang als Zertifikat an der Rolle, zwei Jahre, erneuert (`Area.Renew.cs`);
 * Formular und Link geben eine Rolle (`Form.Members.cs`); der Signierschlüssel nur mit „holds" und „sign".
 */
const USAGE_JSON: JsonNode = {
  key: 'roles.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Graf ról to graf kluczy. Każde powiązanie — także "write" i "read" — niesie klucz roli zapieczętowany dla tego, kto ją trzyma; przeglądarka idzie od konta w dół i otwiera tyle, ile sięgają powiązania. Usługa kluczy nie ma — sprawdza tylko podpisy.
- Dostęp do obszaru (czyta, pisze, prowadzi) dostaje rola: klucz obszaru i certyfikat podpisany przez rolę, która w obszarze przyjmuje. Certyfikat jest ważny dwa lata; po roku przeglądarka kogoś, kto przyjmuje w tym obszarze, odnawia go sama.
- Usługa wpuszcza do obszarów roli tylko po "holds" (konto → osoba → rola → …, także przez role pośrednie): ci, do których rola tak schodzi, widzą rozmowy, kalendarze i zgłoszenia jej obszarów, a nowości z nich budzą ich telefony.
- Adres strony (i wszystko pod nim) prowadzi jedna rola — stronę edytują ci, do których ta rola schodzi po "holds".
- Formularz i link dostępu dają swoim osobom rolę; do czego prowadzi, mówi sama rola — jedna zmiana dotyczy wszystkich, którzy ją dostali.
- Klucz podpisu ("sign": true, tylko przy "holds") to działanie w imieniu roli: nim podpisuje się jej wiadomości w rozmowach, powiązania, w których ona trzyma inne role (także nowe role zakładane pod nią), i certyfikaty, które wydaje.
- Nowe "holds" daje więc od razu wszystko, do czego rola prowadzi — także przez role, które ona trzyma. Import nie nadaje dostępu do obszarów ani adresów stron; powiązanie odbiera się ręcznie (Role → rola → „Odbierz”).`
};

/** DIE BESCHREIBUNG — neben dem Import und für einen Assistenten (MCP). Ohne Zusammenhang aufrufbar. */
export const ROLES_JSON: JsonNode = {
  key: 'roles',
  title: `Role konta jako JSON ("${ROLES_FORMAT}", wersja ${ROLES_VERSION})`,
  short: 'Role',
  text: () => `Struktura ról konta: osoby, role i grupy, kto kogo trzyma i na jakim stopniu, z nazwami. Konto (korzeń) trzyma tylko osoby; pod osobami są role i grupy. Gdzie: Role → „Więcej” (⋯) → „Import i eksport (JSON)” (#/workspace/roles).
Co robi import:
- Najpierw pokazuje listę zmian z ostrzeżeniami; zapisuje dopiero po „Importuj role”.
- Wpis z "id" (z eksportu) to rola, która już jest: inna "name" zmienia nazwę, "kind" "role" ↔ "group" zmienia rodzaj, nowe pozycje w "holders" dochodzą.
- Wpis bez "id" zakłada nową rolę albo grupę — pod pierwszą pozycją "holders", która ją prowadzi ("holds" z podpisem) i którą Ty prowadzisz z podpisem: Twoją osobę ("${SELF_REF}"), Twoją rolę albo inną nową rolę z tego dokumentu ("@klucz" — ta powstaje najpierw).
- Każda nowa rola to dwa klucze RSA-4096 liczone w przeglądarce — kilka sekund na rolę; najwyżej ${MAX_NEW_ROLES} nowych ról w jednym imporcie (najwyżej ${MAX_ENTRIES} wpisów w dokumencie).
- Niczego nie usuwa: role, nazwy i powiązania, których nie ma w dokumencie, zostają; podpisu w powiązaniu, które już jest, nie zmienia.
- Nie zakłada kont ani osób (osobę zakładasz sam: Role → Konto → „Nowa osoba”); nie rusza ról, których ta przeglądarka nie otwiera, ani ról linków dostępu ("link": true).
- Daje tylko to, co Ty możesz dać: rolę, której klucz masz (a z "sign": true — także jej klucz podpisu), komuś, w czyim imieniu podpisujesz. Czego nie możesz, pomija z ostrzeżeniem — tak samo powiązanie, które zamknęłoby krąg (dwie role trzymające się nawzajem).
- Nazwy są pieczętowane w przeglądarce kluczem roli; usługa widzi tylko, że rola jest i kto ją trzyma. Plik eksportu ma nazwy otwartym tekstem — to Twoja kopia.
Zwróć JEDEN obiekt JSON, bez komentarzy.

Dokument:
${keyLines(TOP_KEYS)}

Odwołania w "by": "@klucz" — wpis tego dokumentu (także nowy); "${SELF_REF}" — Twoja pierwsza osoba; "${ACCOUNT_REF}" — konto; albo "id" z eksportu.

Eksport wygląda tak (identyfikatory zmyślone) — "id" zostaw; zmień "name", dopisz "holders" albo dodaj wpisy bez "id":
${pretty(exportRoles(EXAMPLE_STATE))}

Przykład — nowe role pod Twoją osobą:
${pretty(PARISH_SAMPLE)}`,
  inside: () => [USAGE_JSON, ENTRY_JSON, HOLDER_JSON],
  samples: () => [
    { label: 'Parafia: proboszcz, kancelaria, rada, schola', doc: () => PARISH_SAMPLE },
    { label: 'Szkoła: dyrektor, nauczyciele, wychowawca', doc: () => SCHOOL_SAMPLE }
  ]
};

/** Die Beschreibung als Text — für den Katalog des MCP-Servers (`scripts/import-formats.mjs`). */
export const rolesDescription = (): string => describe(ROLES_JSON);
