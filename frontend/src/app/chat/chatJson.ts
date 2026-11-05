/**
 * 2026-10-29 — EINE ROZMOWA ALS JSON („recreatio/chat", Fassung 1): zum Aufheben, und damit ein Assistent (über
 * MCP, `get_import_format`) sie lesen, zusammenfassen und ordnen kann — mit der Beschreibung daneben
 * (`core/jsonTree.ts`) wie jedes JSON der App.
 *
 * <b>Hinaus geht, was der Leser in der Rozmowa sieht:</b> die Nachrichten eines Zeitraums oder eines Themas — wer
 * (wie in der Rozmowa: „Imię Nazwisko (Rola)", 0095), wann, Text, Antwort, Bearbeitung, Anhänge mit Namen und
 * Grösse, Reaktionen, Angeheftetes —, dazu die Tematy und die Aufgaben und Termine, die aus ihr entstanden.
 *
 * <b>Herein kommt nur, was niemandem Worte in den Mund legt.</b> Eine Nachricht ist die Aussage eines Menschen,
 * unterschrieben mit dem Schlüssel seiner Rolle. Darum:
 * <code>
 *   Tematy                ohne "id" neu (gleicher Name: der vorhandene), mit "id" umbenennen, schliessen, öffnen
 *   Nachricht mit "id"    nur ordnen: Thema, angeheftet (prowadzący), gemerkt (für sich) — nie Text, Verfasser, Zeit
 *   Nachricht ohne "id"   NEU, als die Person, die importiert, mit der Zeit des Sendens und „Z importu" in der Hülle
 *                         (`MessageExtras.imported`) — oder geplant ("sendAt", nur Zukunft)
 *   nie                   in fremdem Namen ("author" eines anderen), rückdatiert ("at"), aus einer anderen Rozmowa,
 *                         Dateien, Reaktionen, Löschen, ein Zitat aus dem Dokument
 * </code>
 *
 * Rein: kein Dienst, kein Schlüssel. Gelesen, versiegelt und gesendet wird in `ChatJsonDialog.tsx` — mit den Wegen,
 * die die Rozmowa ohnehin hat (`sendMessage`, `createTopic`, `collectToTopic`).
 */

import { describe, keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { fmtDate, t, texts } from '../core/i18n';
import type { Attachment, ChatKind, Opened, SealedMessage } from './chat';
import { authorText, messageAuthor } from './chatAuthor';
import type { Mark } from './chatFeatures';
import type { Topic } from './chatTopics';

export const CHAT_FORMAT = 'recreatio/chat';
export const CHAT_VERSION = 1;

/** Höchstens so viele Nachrichten in einem Export — darüber ist es ein Archiv des Dienstes, kein Dokument. */
export const MAX_EXPORT = 5000;
/** Höchstens so viele neue Nachrichten je Import — ein Import ist kein Massenversand. */
export const MAX_POSTS = 30;
export const MAX_NEW_TOPICS = 50;
/** Der Dienst nimmt 24 000 Bytes versiegelt — mit Hülle, Namen und Siegel bleibt das für den Text. */
export const MAX_TEXT_BYTES = 16_000;
export const MAX_TITLE = 200;
/** Zwischen Vorschau und „Importuj" vergehen Minuten — näher als das wäre beim Senden schon vorbei. */
export const SEND_AT_MIN_MINUTES = 5;
/** Der Dienst plant bis knapp unter ein Jahr. */
export const SEND_AT_MAX_DAYS = 360;

const MINUTE = 60_000;
const DAY = 86_400_000;

export const KIND_WORDS: Readonly<Record<ChatKind, string>> = texts({
  area: 'chatJson.kind.area',
  channel: 'chatJson.kind.channel',
  group: 'chatJson.kind.group',
  direct: 'chatJson.kind.direct',
  self: 'chatJson.kind.self',
  seat: 'chatJson.kind.seat'
});

/* -- Die Schlüssel ------------------------------------------------------------------------------------- */

/** Was in den Erklärungen eingesetzt wird — Grenzen und Format. */
const said = (): Record<string, string | number> => ({
  format: CHAT_FORMAT, version: CHAT_VERSION, maxExport: MAX_EXPORT, maxTitle: MAX_TITLE, maxText: MAX_TEXT_BYTES, minMinutes: SEND_AT_MIN_MINUTES,
  kinds: (Object.keys(KIND_WORDS) as ChatKind[]).map((k) => `"${k}" (${KIND_WORDS[k]})`).join(', ')
});

/** Eine Tabelle der Schlüssel, deren Erklärung erst beim Lesen geholt wird (in der Sprache der Anwendung). */
function lazy(group: string, names: readonly string[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of names) {
    Object.defineProperty(out, name, { get: () => t(`chatJson.keys.${group}.${name.replace('[].', '_')}`, said()), enumerable: true });
  }
  return out;
}

const DOC_KEYS = lazy('doc', ['format', 'version', 'chat', 'me', 'exportedAt', 'range', 'topics', 'messages', 'linked']);
const CHAT_KEYS = lazy('chat', ['id', 'kind', 'title']);
const ME_KEYS = lazy('me', ['name', 'writes', 'moderates']);
const RANGE_KEYS = lazy('range', ['from', 'to', 'topic', 'limited']);
const TOPIC_KEYS = lazy('topic', ['id', 'key', 'title', 'closed', 'createdAt', 'createdBy', 'messages', 'tasks', 'appointments']);
const MESSAGE_KEYS = lazy('message', [
  'id', 'at', 'author', 'mine', 'link', 'topic', 'text', 'replyTo', 'quote', 'attachments', 'attachments[].name', 'attachments[].type',
  'attachments[].size', 'forwarded', 'imported', 'edited', 'deleted', 'deletedBy', 'blocked', 'unreadable', 'reactions', 'reactions[].emoji',
  'reactions[].count', 'reactions[].mine', 'pinned', 'starred'
]);
const NEW_MESSAGE_KEYS = lazy('new', ['text', 'topic', 'replyTo', 'sendAt', 'silent']);
const LINKED_KEYS = lazy('linked', ['kind', 'title', 'topic', 'message', 'at', 'end', 'state']);

/** Jeder Pfad, den die Beschreibung erklärt (`messages[].attachments[].name`) — für die Prüfung. */
export const CHAT_PATHS: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  const add = (prefix: string, keys: Readonly<Record<string, string>>) => {
    for (const key of Object.keys(keys)) Object.defineProperty(out, `${prefix}${key}`, { get: () => keys[key], enumerable: true, configurable: true });
  };
  add('', DOC_KEYS);
  add('chat.', CHAT_KEYS);
  add('me.', ME_KEYS);
  add('range.', RANGE_KEYS);
  add('topics[].', TOPIC_KEYS);
  add('messages[].', MESSAGE_KEYS);
  add('messages[].', NEW_MESSAGE_KEYS);
  add('linked[].', LINKED_KEYS);
  return out;
})();

/* -- Kleinkram ------------------------------------------------------------------------------------------ */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ein eigener Schlüssel — `in` sähe auch „constructor" und „toString" als bekannt. */
const own = (keys: Readonly<Record<string, unknown>>, key: string): boolean => Object.prototype.hasOwnProperty.call(keys, key);

/** Eine Zeit, wie sie hinausgeht — UTC, auf die Millisekunde; was keine ist, bleibt, wie es war. */
const iso = (at: string): string => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? at : new Date(t).toISOString();
};

/** Zum Vergleichen: klein, ohne doppelte Leerzeichen. */
const norm = (text: string): string => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL');

/** Ein Schlüssel aus einem Namen: „Pielgrzymka — transport" → `pielgrzymka-transport`. */
const slug = (text: string): string => text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '') || 'temat'; // i18n-ignore

const KEY = /^[a-z0-9_-]{1,40}$/;

const bytes = (text: string): number => new TextEncoder().encode(text).length;

const short = (text: string, max = 160): string => {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** Eine Zeit in den Zeilen der Vorschau — wie in der Rozmowa. */
const when = (at: string): string => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? at : fmtDate(new Date(t), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Die Schlüssel der Themen im Dokument — aus dem Namen, eindeutig. */
export function topicKeys(topics: readonly Pick<Topic, 'topicId' | 'title'>[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const t of topics) {
    const base = slug(t.title);
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
    taken.add(key);
    out.set(t.topicId, key);
  }
  return out;
}

const topicRef = (keys: ReadonlyMap<string, string>, topicId: string): string => {
  const key = keys.get(topicId);
  return key === undefined ? topicId : `@${key}`;
};

function marksBy(marks: readonly Mark[]): Map<string, Mark[]> {
  const out = new Map<string, Mark[]>();
  for (const m of marks) {
    const list = out.get(m.messageId);
    if (list === undefined) out.set(m.messageId, [m]); else list.push(m);
  }
  return out;
}

/** Reaktionen gezählt, wie der Verlauf sie zeigt — die eigene dabei. */
function reactionsOf(marks: readonly Mark[]): { emoji: string; count: number; mine?: true }[] {
  const out: { emoji: string; count: number; mine?: true }[] = [];
  for (const m of marks) {
    if (m.kind !== 'reaction') continue;
    const had = out.find((r) => r.emoji === m.value);
    if (had === undefined) out.push({ emoji: m.value, count: 1, ...(m.mine ? { mine: true as const } : {}) });
    else { had.count += 1; if (m.mine) had.mine = true; }
  }
  return out;
}

/* -- Hinaus --------------------------------------------------------------------------------------------- */

export interface ExportItem {
  readonly message: SealedMessage;
  readonly opened: Opened | null;
}

/** Wie die Rozmowa Verfasser nennt (ohne „Ty" — der Name, wie ihn die anderen sehen) und welche meine sind. */
export interface ExportLook {
  readonly author: (message: SealedMessage, opened: Opened | null) => string;
  readonly mine: (message: SealedMessage) => boolean;
}

/** Eine Aufgabe oder ein Termin aus der Rozmowa — geöffnet (`ChatJsonDialog`). */
export interface LinkedEntry {
  readonly kind: 'task' | 'appointment';
  readonly title: string;
  readonly topicId: string | null;
  readonly messageId: string | null;
  readonly at: string | null;
  readonly end: string | null;
  readonly state: string;
}

export interface ChatExportInput {
  readonly chat: { readonly chatId: string; readonly kind: ChatKind; readonly title: string };
  readonly me: { readonly name: string | null; readonly writes: boolean; readonly moderates: boolean };
  /** Die Zeit des Exports. */
  readonly at: Date;
  /** Ab wann (`null`: von Anfang an) und nur welches Thema (`null`: alle). */
  readonly from: Date | null;
  readonly topicId: string | null;
  /** Die Grenze von `MAX_EXPORT` hat ältere abgeschnitten. */
  readonly limited: boolean;
  readonly topics: readonly Topic[];
  readonly topicBy?: (topic: Topic) => string | null;
  /** Die geladenen Nachrichten (die älteste zuerst) — gefiltert wird hier. */
  readonly items: readonly ExportItem[];
  readonly look: ExportLook;
  readonly marks: readonly Mark[];
  readonly linked?: readonly LinkedEntry[];
}

/** EINE NACHRICHT, wie sie hinausgeht — und wie der Import sie zum Vergleichen kennt (`ContextMessage.out`). */
export function messageOut(item: ExportItem, look: ExportLook, marks: readonly Mark[], keys: ReadonlyMap<string, string>): Record<string, unknown> {
  const { message, opened } = item;
  const out: Record<string, unknown> = { id: message.messageId, at: iso(message.createdAt), author: look.author(message, opened) };
  if (look.mine(message)) out.mine = true;
  if (message.authorSeatId !== null) out.link = true;
  if (message.topicId != null) out.topic = topicRef(keys, message.topicId);
  if (message.deletedAt !== null) {
    out.deleted = iso(message.deletedAt);
    if (message.deletedBy != null) out.deletedBy = message.deletedBy;
  } else if (message.blocked === true) {
    out.blocked = true;
  } else if (opened === null) {
    out.unreadable = true;
  } else {
    out.text = opened.text;
    if (opened.replyTo !== undefined) {
      out.replyTo = opened.replyTo;
      if (opened.replyText !== undefined && opened.replyText !== '') out.quote = opened.replyText;
    }
    const files = opened.attachments ?? [];
    if (files.length > 0) out.attachments = files.map((a) => ({ name: a.name, type: a.type, size: a.size }));
    if (opened.forwarded === true) out.forwarded = true;
    if (opened.imported === true) out.imported = true;
    if (message.editedAt != null) out.edited = iso(message.editedAt);
  }
  const reactions = reactionsOf(marks);
  if (reactions.length > 0) out.reactions = reactions;
  if (marks.some((m) => m.kind === 'pin')) out.pinned = true;
  if (marks.some((m) => m.kind === 'star' && m.mine)) out.starred = true;
  return out;
}

function topicOut(topic: Topic, keys: ReadonlyMap<string, string>, by: ((topic: Topic) => string | null) | undefined): Record<string, unknown> {
  const who = by?.(topic) ?? null;
  return {
    id: topic.topicId,
    key: keys.get(topic.topicId) ?? slug(topic.title),
    title: topic.title,
    closed: topic.closedAt !== null,
    createdAt: iso(topic.createdAt),
    ...(who !== null ? { createdBy: who } : {}),
    messages: topic.messages,
    tasks: topic.tasks,
    appointments: topic.items
  };
}

const linkedOut = (one: LinkedEntry, keys: ReadonlyMap<string, string>): Record<string, unknown> => ({
  kind: one.kind,
  title: one.title,
  topic: one.topicId === null ? null : topicRef(keys, one.topicId),
  ...(one.messageId !== null ? { message: one.messageId } : {}),
  ...(one.at !== null ? { at: iso(one.at) } : {}),
  ...(one.end !== null ? { end: iso(one.end) } : {}),
  state: one.state
});

/** DIE ROZMOWA ALS DOKUMENT — der Zeitraum und das Thema aus `input`, die Themen alle. */
export function exportChat(input: ChatExportInput): Record<string, unknown> {
  const keys = topicKeys(input.topics);
  const marks = marksBy(input.marks);
  const from = input.from === null ? null : input.from.getTime();
  const items = input.items.filter(({ message }) => (from === null || Date.parse(message.createdAt) >= from)
    && (input.topicId === null || message.topicId === input.topicId));
  const linked = input.linked ?? [];
  return {
    format: CHAT_FORMAT,
    version: CHAT_VERSION,
    chat: { id: input.chat.chatId, kind: input.chat.kind, title: input.chat.title },
    me: { name: input.me.name, writes: input.me.writes, moderates: input.me.moderates },
    exportedAt: input.at.toISOString(),
    range: {
      from: input.from === null ? null : input.from.toISOString(),
      to: input.at.toISOString(),
      topic: input.topicId === null ? null : topicRef(keys, input.topicId),
      ...(input.limited ? { limited: true } : {})
    },
    topics: input.topics.map((t) => topicOut(t, keys, input.topicBy)),
    messages: items.map((item) => messageOut(item, input.look, marks.get(item.message.messageId) ?? [], keys)),
    ...(linked.length > 0 ? { linked: linked.map((one) => linkedOut(one, keys)) } : {})
  };
}

/* -- Was der Import über die Rozmowa weiss ---------------------------------------------------------------- */

export interface ContextTopic {
  readonly topicId: string;
  readonly title: string;
  readonly closed: boolean;
  /** Umbenennen und schliessen: wer es angelegt hat oder moderiert (der Dienst prüft dasselbe). */
  readonly mayChange: boolean;
}

export interface ContextMessage {
  readonly id: string;
  readonly at: string;
  /** Wie der Export sie schreibt — daran misst der Import, was ein Dokument anders sagt. */
  readonly out: Readonly<Record<string, unknown>>;
  readonly topicId: string | null;
  readonly pinned: boolean;
  readonly starred: boolean;
  readonly myReactions: readonly string[];
  readonly mine: boolean;
  /** In ein Thema ordnen: ihr Verfasser, wer moderiert, zu zweit und in den Notatki jeder, der schreibt. */
  readonly mayFile: boolean;
  /** Nicht gelöscht, nicht gesperrt, lesbar — nur so lässt sie sich zitieren und anheften. */
  readonly live: boolean;
  readonly text: string | null;
  readonly files: number;
}

export interface ChatImportContext {
  readonly chatId: string;
  readonly kind: ChatKind;
  readonly now: Date;
  /** Eine eigene Person schreibt hier — neue Nachrichten und Themen. */
  readonly writes: boolean;
  readonly moderates: boolean;
  /** Wie die schreibende Person heisst — ein "author" mit einem dieser Namen ist sie. */
  readonly me: readonly string[];
  readonly topics: readonly ContextTopic[];
  readonly messages: readonly ContextMessage[];
  /** Die älteste geladene Nachricht — und ob es davor keine mehr gibt. */
  readonly from: string | null;
  readonly complete: boolean;
  /** Die eigenen geplanten Nachrichten: was schon wartet, geht nicht zweimal. */
  readonly scheduled: readonly { readonly text: string; readonly sendAt: string }[];
}

export interface ContextInput {
  readonly chatId: string;
  readonly kind: ChatKind;
  readonly now: Date;
  readonly writes: boolean;
  readonly moderates: boolean;
  readonly me: readonly string[];
  readonly topics: readonly Topic[];
  readonly topicMayChange: (topic: Topic) => boolean;
  readonly items: readonly ExportItem[];
  readonly look: ExportLook;
  readonly mayFile: (message: SealedMessage) => boolean;
  readonly marks: readonly Mark[];
  readonly from: string | null;
  readonly complete: boolean;
  readonly scheduled?: readonly { readonly text: string; readonly sendAt: string }[];
}

/** WAS DER IMPORT VERGLEICHT — dieselben Schlüssel und Verweise wie der Export, damit Unverändertes nichts tut. */
export function importContext(input: ContextInput): ChatImportContext {
  const keys = topicKeys(input.topics);
  const marks = marksBy(input.marks);
  return {
    chatId: input.chatId,
    kind: input.kind,
    now: input.now,
    writes: input.writes,
    moderates: input.moderates,
    me: input.me.filter((name) => name.trim() !== ''),
    topics: input.topics.map((t) => ({ topicId: t.topicId, title: t.title, closed: t.closedAt !== null, mayChange: input.topicMayChange(t) })),
    messages: input.items.map((item) => {
      const own = marks.get(item.message.messageId) ?? [];
      const { message, opened } = item;
      const live = message.deletedAt === null && message.blocked !== true && opened !== null;
      return {
        id: message.messageId,
        at: message.createdAt,
        out: messageOut(item, input.look, own, keys),
        topicId: message.topicId ?? null,
        pinned: own.some((m) => m.kind === 'pin'),
        starred: own.some((m) => m.kind === 'star' && m.mine),
        myReactions: own.filter((m) => m.kind === 'reaction' && m.mine).map((m) => m.value),
        mine: input.look.mine(message),
        mayFile: input.mayFile(message),
        live,
        text: live ? opened.text : null,
        files: live ? (opened.attachments ?? []).length : 0
      };
    }),
    from: input.from,
    complete: input.complete,
    scheduled: input.scheduled ?? []
  };
}

/**
 * Wie weit zurück die Rozmowa geladen sein muss, damit ein Dokument geplant werden kann: die älteste Nachricht
 * mit "id" (nach "at"). `null`: nichts Älteres nötig — oder ein Dokument einer anderen Rozmowa.
 */
export function neededFrom(doc: unknown, chatId: string): number | null {
  if (!isObject(doc)) return null;
  if (isObject(doc.chat) && typeof doc.chat.id === 'string' && doc.chat.id !== chatId) return null;
  let min: number | null = null;
  for (const one of Array.isArray(doc.messages) ? doc.messages : []) {
    if (!isObject(one) || typeof one.id !== 'string' || typeof one.at !== 'string') continue;
    const t = Date.parse(one.at);
    if (!Number.isNaN(t) && (min === null || t < min)) min = t;
  }
  return min;
}

/* -- Herein: der Plan ------------------------------------------------------------------------------------- */

export type TopicTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'topic'; readonly topicId: string }
  | { readonly kind: 'new'; readonly ref: string };

export interface NewTopic { readonly ref: string; readonly title: string; readonly closed: boolean }
export interface TopicChange { readonly topicId: string; readonly was: string; readonly title?: string; readonly closed?: boolean }
export interface Move { readonly messageId: string; readonly to: TopicTarget }
export interface MarkChange { readonly messageId: string; readonly kind: 'pin' | 'star'; readonly on: boolean }
export interface Post {
  readonly text: string;
  readonly to: TopicTarget;
  readonly replyTo: string | null;
  readonly replyText: string | null;
  readonly sendAt: string | null;
  readonly silent: boolean;
}

export interface ChatImportPlan {
  readonly newTopics: readonly NewTopic[];
  readonly topicChanges: readonly TopicChange[];
  readonly moves: readonly Move[];
  readonly marks: readonly MarkChange[];
  readonly posts: readonly Post[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

export const readOnlyImport = (): string => t('chatJson.readOnly');

/** Was an einer Nachricht aus dem Export nur zu lesen ist — ein anderer Wert ist eine Warnung, keine Änderung. */
const READ_ONLY_KEYS = ['at', 'author', 'mine', 'link', 'text', 'replyTo', 'quote', 'attachments', 'forwarded', 'imported', 'edited', 'deleted', 'deletedBy', 'blocked', 'unreadable'] as const;
const TIME_KEYS = new Set<string>(['at', 'edited', 'deleted']);
const FLAG_KEYS = new Set<string>(['mine', 'link', 'forwarded', 'imported', 'blocked', 'unreadable']);
/** Was eine neue Nachricht tragen darf, ohne dass es eine Warnung gibt ("author" nur, wenn es die importierende Person ist). */
const NEW_QUIET = new Set<string>([...Object.keys(NEW_MESSAGE_KEYS), 'id', 'author', 'mine', 'imported']);

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => sameValue(a[k], b[k]));
  }
  return false;
}

/** Sagt das Dokument an diesem Schlüssel dasselbe wie die Rozmowa? Zeiten nach dem Augenblick, Merkmale wahr/fehlt. */
function sameField(key: string, doc: unknown, now: unknown): boolean {
  if (FLAG_KEYS.has(key)) return (doc === undefined || doc === null || typeof doc === 'boolean') && (doc === true) === (now === true);
  if (TIME_KEYS.has(key)) {
    if (doc === undefined || doc === null) return now === undefined;
    const t = typeof doc === 'string' ? Date.parse(doc) : Number.NaN;
    return typeof now === 'string' && !Number.isNaN(t) && t === Date.parse(now);
  }
  /* Leer ist so viel wie nicht da: [] ohne Anhänge, "" ohne Zitat. */
  const blank = doc === undefined || doc === null || doc === '' || (Array.isArray(doc) && doc.length === 0);
  if (blank && now === undefined) return true;
  return sameValue(doc, now);
}

const sameTarget = (to: TopicTarget, topicId: string | null): boolean =>
  to.kind === 'none' ? topicId === null : to.kind === 'topic' ? to.topicId === topicId : false;

/** Wann eine geplante Nachricht hinausgeht — auf die Minute: daran erkennt der Import eine, die schon wartet. */
const minuteOf = (at: string | null): string => (at === null ? 'teraz' : String(Math.round(Date.parse(at) / MINUTE))); // i18n-ignore

/**
 * WAS EIN DOKUMENT IN DIESER ROZMOWA ÄNDERN WÜRDE — oder warum es nicht geht. Jede Zeile eine Änderung, jede
 * Warnung etwas, das ausgelassen wird; geschrieben wird erst auf „Importuj" (`ChatJsonDialog`).
 */
export function planChatImport(doc: unknown, ctx: ChatImportContext): ChatImportPlan | { error: string } {
  if (!isObject(doc)) return { error: t('chatJson.plan.notDoc') };
  if (doc.format !== undefined && doc.format !== CHAT_FORMAT) return { error: t('chatJson.plan.otherFormat', { found: String(doc.format), format: CHAT_FORMAT }) };
  if (!ctx.writes && !ctx.moderates) return { error: readOnlyImport() };

  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== CHAT_VERSION) warnings.push(t('chatJson.plan.version', { found: String(doc.version), version: CHAT_VERSION }));
  for (const key of Object.keys(doc)) if (!own(DOC_KEYS, key)) warnings.push(t('chatJson.plan.unknownTop', { key }));

  const source = isObject(doc.chat) ? doc.chat : null;
  const foreign = source !== null && typeof source.id === 'string' && source.id !== ctx.chatId;
  const sourceTitle = source !== null && typeof source.title === 'string' && source.title.trim() !== '' ? t('chatJson.plan.foreignSource', { title: source.title.trim() }) : '';

  /* -- Themen -- */
  const byId = new Map(ctx.topics.map((tp) => [tp.topicId, tp]));
  const byTitle = new Map(ctx.topics.map((tp) => [norm(tp.title), tp]));
  const refs = new Map<string, TopicTarget | null>();
  const newTopics: NewTopic[] = [];
  const newByTitle = new Map<string, NewTopic>();
  const topicChanges: TopicChange[] = [];
  const seenTopics = new Set<string>();

  if (doc.topics !== undefined && !Array.isArray(doc.topics)) warnings.push(t('chatJson.plan.topicsNotList'));
  (Array.isArray(doc.topics) ? doc.topics : []).forEach((raw, i) => {
    const where = t('chatJson.plan.topicN', { n: i + 1 });
    if (!isObject(raw)) { warnings.push(t('chatJson.plan.topic.notObject', { where })); return; }
    for (const key of Object.keys(raw)) if (!own(TOPIC_KEYS, key)) warnings.push(t('chatJson.plan.topic.unknownKey', { where, key }));

    let key: string | null = null;
    if (raw.key !== undefined && raw.key !== null) {
      const k = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '').toLowerCase() : '';
      if (KEY.test(k)) key = k;
      else warnings.push(t('chatJson.plan.topic.badKey', { where }));
    }
    let title: string | null = typeof raw.title === 'string' && raw.title.trim() !== '' ? raw.title.trim().replace(/\s+/g, ' ') : null;
    if (raw.title !== undefined && raw.title !== null && typeof raw.title !== 'string') warnings.push(t('chatJson.plan.topic.titleNotText', { where }));
    if (title !== null && title.length > MAX_TITLE) {
      warnings.push(t('chatJson.plan.topic.titleLong', { where, max: MAX_TITLE }));
      title = title.slice(0, MAX_TITLE).trim();
    }
    const closed = typeof raw.closed === 'boolean' ? raw.closed : undefined;
    if (raw.closed !== undefined && raw.closed !== null && closed === undefined) warnings.push(t('chatJson.plan.topic.closedBool', { where }));
    const id = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim() : null;
    const existing = id !== null && !foreign ? byId.get(id) : undefined;

    let target: TopicTarget | null = null;
    if (existing !== undefined) {
      target = { kind: 'topic', topicId: existing.topicId };
      if (seenTopics.has(existing.topicId)) warnings.push(t('chatJson.plan.topic.twice', { where, title: existing.title }));
      else {
        seenTopics.add(existing.topicId);
        if (raw.title !== undefined && title === null) warnings.push(t('chatJson.plan.topic.emptyTitle', { where, title: existing.title }));
        const rename = title !== null && title !== existing.title ? title : undefined;
        const close = closed !== undefined && closed !== existing.closed ? closed : undefined;
        if (rename !== undefined || close !== undefined) {
          if (!existing.mayChange) warnings.push(t('chatJson.plan.topic.mayNotChange', { where, title: existing.title }));
          else topicChanges.push({ topicId: existing.topicId, was: existing.title, ...(rename !== undefined ? { title: rename } : {}), ...(close !== undefined ? { closed: close } : {}) });
        }
      }
    } else {
      if (id !== null && !foreign) warnings.push(t(title === null ? 'chatJson.plan.topic.noIdSkipped' : 'chatJson.plan.topic.noIdNew', { where }));
      if (title === null) warnings.push(t('chatJson.plan.topic.noTitle', { where }));
      else {
        const same = byTitle.get(norm(title));
        const twin = newByTitle.get(norm(title));
        if (same !== undefined) target = { kind: 'topic', topicId: same.topicId };
        else if (twin !== undefined) target = { kind: 'new', ref: twin.ref };
        else if (ctx.kind === 'self') warnings.push(t('chatJson.plan.topic.inNotes', { where, title }));
        else if (!ctx.writes) warnings.push(t('chatJson.plan.topic.notWriter', { where, title }));
        else if (newTopics.length >= MAX_NEW_TOPICS) warnings.push(t('chatJson.plan.topic.tooMany', { where, title, max: MAX_NEW_TOPICS }));
        else {
          const made: NewTopic = { ref: `#${newTopics.length + 1}`, title, closed: closed === true };
          newTopics.push(made);
          newByTitle.set(norm(title), made);
          target = { kind: 'new', ref: made.ref };
        }
      }
    }
    if (key !== null) {
      if (refs.has(key)) warnings.push(t('chatJson.plan.topic.keyTwice', { where, key }));
      else refs.set(key, target);
    }
  });

  const derived = new Map([...topicKeys(ctx.topics)].map(([topicId, key]) => [key, topicId]));
  const topicTitle = (to: TopicTarget): string | null =>
    to.kind === 'none' ? null : to.kind === 'topic' ? byId.get(to.topicId)?.title ?? t('chatJson.plan.topicWord') : newTopics.find((tp) => tp.ref === to.ref)?.title ?? t('chatJson.plan.topicWord');

  /** Ein Verweis auf ein Thema — `null`: nicht zu finden (die Warnung steht schon da, mit `instead`). */
  const resolveTopic = (value: unknown, where: string, instead: string): TopicTarget | null => {
    if (value === null || value === '') return { kind: 'none' };
    if (typeof value !== 'string') { warnings.push(t('chatJson.plan.ref.notText', { where, instead })); return null; }
    const v = value.trim();
    if (v.startsWith('@')) {
      const key = v.slice(1).toLowerCase();
      if (!refs.has(key)) {
        /* Ohne Eintrag in "topics": der Schlüssel, den der Export dem Thema gibt — ein gekürztes Dokument trifft noch. */
        const topicId = derived.get(key);
        if (topicId !== undefined) return { kind: 'topic', topicId };
        warnings.push(t('chatJson.plan.ref.noKey', { where, key, instead }));
        return null;
      }
      const target = refs.get(key) ?? null;
      if (target === null) warnings.push(t('chatJson.plan.ref.skipped', { where, ref: v, instead }));
      return target;
    }
    const known = foreign ? undefined : byId.get(v);
    if (known === undefined) { warnings.push(t('chatJson.plan.ref.noTopic', { where, title: short(v, 40), instead })); return null; }
    return { kind: 'topic', topicId: known.topicId };
  };

  /* -- Nachrichten -- */
  const byMessage = new Map(ctx.messages.map((m) => [m.id, m]));
  const seenMessages = new Set<string>();
  const moves: Move[] = [];
  const marks: MarkChange[] = [];
  const posts: Post[] = [];
  /*
   * Was ich hier schon geschrieben habe oder was schon wartet, geht nicht noch einmal — weder beim zweiten Import
   * desselben Dokuments noch, wenn ein Assistent eine eigene Nachricht aus dem Export ohne ihr "id" zurückgibt.
   */
  const posted = new Set<string>([
    ...ctx.messages.filter((m) => m.mine && m.text !== null).map((m) => `${norm(m.text!)}|${minuteOf(null)}`),
    ...ctx.scheduled.map((s) => `${norm(s.text)}|${minuteOf(s.sendAt)}`)
  ]);
  const myName = ctx.me[0] ?? t('chatJson.plan.importer');
  let foreignSkipped = 0;
  let notWriting = 0;
  let over = 0;

  if (doc.messages !== undefined && !Array.isArray(doc.messages)) warnings.push(t('chatJson.plan.messagesNotList'));
  (Array.isArray(doc.messages) ? doc.messages : []).forEach((raw, i) => {
    const where = t('chatJson.plan.messageN', { n: i + 1 });
    if (!isObject(raw)) { warnings.push(t('chatJson.plan.msg.notObject', { where })); return; }

    if (raw.id !== undefined && raw.id !== null) {
      /* -- Eine aus der Rozmowa: nur ordnen. -- */
      if (typeof raw.id !== 'string' || raw.id.trim() === '') { warnings.push(t('chatJson.plan.msg.badId', { where })); return; }
      if (foreign) { foreignSkipped += 1; return; }
      const known = byMessage.get(raw.id.trim());
      if (known !== undefined && seenMessages.has(known.id)) { warnings.push(t('chatJson.plan.msg.twice', { where })); return; }
      if (known !== undefined) seenMessages.add(known.id);
      if (known === undefined) {
        const at = typeof raw.at === 'string' ? Date.parse(raw.at) : Number.NaN;
        const older = !ctx.complete && ctx.from !== null && !Number.isNaN(at) && at < Date.parse(ctx.from);
        warnings.push(older
          ? t('chatJson.plan.msg.older', { where, max: MAX_EXPORT })
          : t('chatJson.plan.msg.noId', { where }));
        return;
      }
      const label = t('chatJson.plan.msgLabel', { where, author: String(known.out.author), when: when(known.at) });
      for (const key of Object.keys(raw)) if (!own(MESSAGE_KEYS, key)) warnings.push(t('chatJson.plan.unknownKey', { label, key }));

      const differs = READ_ONLY_KEYS.filter((key) => key in raw && !sameField(key, raw[key], known.out[key]));
      if (differs.length > 0) {
        warnings.push(t('chatJson.plan.msg.differs', { label, keys: differs.map((k) => `"${k}"`).join(', ') }));
      }
      if ('reactions' in raw) {
        const mineNow = Array.isArray(raw.reactions)
          ? raw.reactions.filter((r) => isObject(r) && r.mine === true && typeof r.emoji === 'string').map((r) => String((r as Record<string, unknown>).emoji))
          : [];
        if (!Array.isArray(raw.reactions) || mineNow.slice().sort().join(' ') !== known.myReactions.slice().sort().join(' ')) {
          warnings.push(t('chatJson.plan.msg.reactions', { label }));
        }
      }

      if ('topic' in raw) {
        const to = resolveTopic(raw.topic, label, t('chatJson.plan.instead.stays'));
        if (to !== null && !sameTarget(to, known.topicId)) {
          if (!known.mayFile) warnings.push(t('chatJson.plan.msg.mayNotFile', { label }));
          else moves.push({ messageId: known.id, to });
        }
      }
      for (const kind of ['pinned', 'starred'] as const) {
        if (!(kind in raw)) continue;
        const value = raw[kind];
        if (value !== true && value !== false && value !== null) { warnings.push(t('chatJson.plan.msg.flagBool', { label, key: kind })); continue; }
        const on = value === true;
        const was = kind === 'pinned' ? known.pinned : known.starred;
        if (on === was) continue;
        if (kind === 'pinned' && !ctx.moderates) { warnings.push(t('chatJson.plan.msg.pinModerator', { label })); continue; }
        if (!known.live) { warnings.push(t(kind === 'pinned' ? 'chatJson.plan.msg.goneNoPin' : 'chatJson.plan.msg.goneNoStar', { label })); continue; }
        marks.push({ messageId: known.id, kind: kind === 'pinned' ? 'pin' : 'star', on });
      }
      return;
    }

    /* -- Ohne "id": eine NEUE, als die Person, die importiert. -- */
    if (!ctx.writes) { notWriting += 1; return; }
    const label = t('chatJson.plan.newN', { n: i + 1 });
    if ('deleted' in raw || raw.blocked === true || raw.unreadable === true) {
      warnings.push(t('chatJson.plan.new.gone', { label }));
      return;
    }
    if ('at' in raw) {
      warnings.push(t('chatJson.plan.new.at', { label }));
      return;
    }
    if ('author' in raw && raw.author !== null && !(typeof raw.author === 'string' && ctx.me.some((name) => norm(name) === norm(raw.author as string)))) {
      warnings.push(t('chatJson.plan.new.author', { label, author: short(String(raw.author), 60), me: myName }));
      return;
    }
    for (const key of Object.keys(raw)) {
      if (NEW_QUIET.has(key)) continue;
      if (key === 'attachments') warnings.push(t('chatJson.plan.new.files', { label }));
      else if (key === 'quote') warnings.push(t('chatJson.plan.new.quote', { label }));
      else if (own(MESSAGE_KEYS, key)) warnings.push(t('chatJson.plan.new.ignored', { label, key }));
      else warnings.push(t('chatJson.plan.unknownKey', { label, key }));
    }

    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (text === '') { warnings.push(t('chatJson.plan.new.noText', { label })); return; }
    /* Gemessen, wie der Text in der Hülle steht (JSON: Zeilenumbrüche und Anführungszeichen zählen doppelt). */
    const size = bytes(JSON.stringify(text)) - 2;
    if (size > MAX_TEXT_BYTES) { warnings.push(t('chatJson.plan.new.tooLong', { label, size, max: MAX_TEXT_BYTES })); return; }

    let sendAt: string | null = null;
    if (raw.sendAt !== undefined && raw.sendAt !== null) {
      const at = typeof raw.sendAt === 'string' ? Date.parse(raw.sendAt) : Number.NaN;
      const now = ctx.now.getTime();
      if (Number.isNaN(at)) { warnings.push(t('chatJson.plan.new.sendAtBad', { label })); return; }
      if (at < now + SEND_AT_MIN_MINUTES * MINUTE) { warnings.push(t('chatJson.plan.new.sendAtSoon', { label, when: when(new Date(at).toISOString()), min: SEND_AT_MIN_MINUTES })); return; }
      if (at > now + SEND_AT_MAX_DAYS * DAY) { warnings.push(t('chatJson.plan.new.sendAtFar', { label })); return; }
      sendAt = new Date(at).toISOString();
    }
    if (raw.silent !== undefined && typeof raw.silent !== 'boolean') warnings.push(t('chatJson.plan.new.silentBool', { label }));

    let to: TopicTarget = { kind: 'none' };
    if (raw.topic !== undefined) to = resolveTopic(raw.topic, label, t('chatJson.plan.instead.noTopic')) ?? { kind: 'none' };

    let replyTo: string | null = null;
    let replyText: string | null = null;
    if (raw.replyTo !== undefined && raw.replyTo !== null) {
      const target = typeof raw.replyTo === 'string' && !foreign ? byMessage.get(raw.replyTo.trim()) : undefined;
      if (target === undefined) warnings.push(t('chatJson.plan.new.replyMissing', { label }));
      else if (!target.live) warnings.push(t('chatJson.plan.new.replyGone', { label }));
      else { replyTo = target.id; replyText = (target.text !== null && target.text !== '' ? target.text : target.files > 0 ? t('chat.log.attachment') : '').slice(0, 500); }
    }

    const fingerprint = `${norm(text)}|${minuteOf(sendAt)}`;
    if (posted.has(fingerprint)) {
      warnings.push(t(sendAt === null ? 'chatJson.plan.new.dupSent' : 'chatJson.plan.new.dupWaiting', { label }));
      return;
    }
    if (posts.length >= MAX_POSTS) { over += 1; return; }
    posted.add(fingerprint);
    posts.push({ text, to, replyTo, replyText, sendAt, silent: raw.silent === true });
  });

  if (foreign) {
    warnings.unshift(t('chatJson.plan.foreign', { source: sourceTitle, skipped: foreignSkipped > 0 ? t('chatJson.plan.foreignSkipped', { count: foreignSkipped }) : '' }));
  }
  if (notWriting > 0) warnings.push(t('chatJson.plan.notWriting', { count: notWriting }));
  if (over > 0) warnings.push(t('chatJson.plan.over', { max: MAX_POSTS, count: over }));

  /* -- Die Zeilen der Vorschau -- */
  const lines: string[] = [];
  for (const tp of newTopics) lines.push(t(tp.closed ? 'chatJson.plan.line.newTopicClosed' : 'chatJson.plan.line.newTopic', { title: tp.title }));
  for (const c of topicChanges) {
    if (c.title !== undefined) lines.push(t('chatJson.plan.line.rename', { was: c.was, title: c.title }));
    if (c.closed !== undefined) lines.push(t(c.closed ? 'chatJson.plan.line.close' : 'chatJson.plan.line.reopen', { title: c.title ?? c.was }));
  }
  /* Je Ziel eine Zeile — `null`: aus den Themen. */
  const moved = new Map<string | null, number>();
  for (const m of moves) {
    const name = topicTitle(m.to);
    moved.set(name, (moved.get(name) ?? 0) + 1);
  }
  for (const [name, n] of moved) lines.push(name === null ? t('chatJson.plan.line.movedOut', { count: n }) : t('chatJson.plan.line.movedTo', { name, count: n }));
  const count = (kind: 'pin' | 'star', on: boolean) => marks.filter((m) => m.kind === kind && m.on === on).length;
  const markLines: readonly [number, string][] = [
    [count('pin', true), 'chatJson.plan.line.pin'], [count('pin', false), 'chatJson.plan.line.unpin'],
    [count('star', true), 'chatJson.plan.line.star'], [count('star', false), 'chatJson.plan.line.unstar']
  ];
  for (const [n, what] of markLines) if (n > 0) lines.push(t(what, { count: n }));
  for (const p of posts) {
    const topic = topicTitle(p.to);
    const reply = p.replyTo === null ? null : byMessage.get(p.replyTo);
    const how = [
      p.sendAt !== null ? t('chatJson.plan.how.planned', { when: when(p.sendAt) }) : null,
      topic !== null ? t('chatJson.plan.how.topic', { topic }) : null,
      reply != null ? t('chatJson.plan.how.reply', { author: String(reply.out.author) }) : null,
      p.silent ? t('chatJson.plan.how.silent') : null
    ].filter((x): x is string => x !== null);
    lines.push(t('chatJson.plan.line.post', { me: myName, how: how.length > 0 ? ` (${how.join(', ')})` : '', text: short(p.text) }));
  }
  if (lines.length === 0) lines.push(t('chatJson.plan.line.nothing'));

  return { newTopics, topicChanges, moves, marks, posts, lines, warnings };
}

/* -- Beispiele ---------------------------------------------------------------------------------------------- */

const EX_CHAT = '0192f0a0-7c1e-7000-8000-00000000c0a1';
const EX_T_TRANSPORT = '0192f0a0-7c1e-7000-8000-0000000007a1';
const EX_T_NOCLEGI = '0192f0a0-7c1e-7000-8000-0000000007a2';
const EX_ANNA = '0192f0a0-7c1e-7000-8000-00000000a001';
const EX_JAN = '0192f0a0-7c1e-7000-8000-00000000a002';
const EX_MARIA = '0192f0a0-7c1e-7000-8000-00000000a003';
const EX_RADA = '0192f0a0-7c1e-7000-8000-00000000a004';
const EX_PIOTR = '0192f0a0-7c1e-7000-8000-00000000a005';
const EX_EWA = '0192f0a0-7c1e-7000-8000-00000000a006';
const exMessage = (n: number) => `0192f0a0-7c1e-7000-8000-0000000001${String(n).padStart(2, '0')}`;
const EX_NAMES = new Map([[EX_ANNA, 'Anna Nowak'], [EX_JAN, 'Jan Kowalski'], [EX_MARIA, 'Maria Wiśniewska'], [EX_RADA, 'Rada'], [EX_PIOTR, 'Piotr Zieliński']]); // i18n-ignore

const EX_FIRST = 'Proponuję wynająć autokar na 50 osób — zna ktoś sprawdzoną firmę?'; // i18n-ignore
const EX_OFFER: Attachment = { id: '0192f0a0-7c1e-7000-8000-00000000f001', name: 'oferta-autokar.pdf', type: 'application/pdf', size: 182340, key: 'A'.repeat(43) };

const exItem = (n: number, at: string, author: { role?: string; person?: string; seat?: string }, opened: Opened | null, rest: Partial<SealedMessage> = {}): ExportItem => ({
  message: {
    messageId: exMessage(n), authorRoleId: author.role ?? null, authorSeatId: author.seat ?? null, authorPersonId: author.person ?? null,
    epoch: 1, bodySealed: opened === null ? null : 'zapieczętowana', createdAt: at, deletedAt: null, version: 1, editedAt: null, topicId: null, ...rest // i18n-ignore
  },
  opened
});

/**
 * Ein kleiner Verlauf (eine Pielgrzymka als Grupa) — das Beispiel des Exports in der Beschreibung, und für die
 * Prüfung (`app-json-chat-check.mjs`) der Stand, an dem ein unverändertes Dokument nichts ändert.
 */
export function chatExampleInput(): ChatExportInput {
  const topic = (topicId: string, title: string, createdAt: string, closedAt: string | null, by: string, messages: number, tasks: number): Topic => ({
    topicId, title, epoch: 1, createdAt, closedAt, lastMessageAt: null, createdByRoleId: by, createdBySeatId: null, messages, tasks, items: 0
  });
  return {
    chat: { chatId: EX_CHAT, kind: 'group', title: 'Pielgrzymka do Częstochowy 2027' }, // i18n-ignore
    me: { name: 'Jan Kowalski', writes: true, moderates: true },
    at: new Date('2026-10-29T10:00:00.000Z'),
    from: new Date('2026-09-29T10:00:00.000Z'),
    topicId: null,
    limited: false,
    topics: [
      topic(EX_T_TRANSPORT, 'Transport', '2026-10-02T17:00:00.000Z', null, EX_ANNA, 2, 1),
      topic(EX_T_NOCLEGI, 'Noclegi', '2026-10-03T07:55:00.000Z', '2026-10-20T10:00:00.000Z', EX_RADA, 1, 0)
    ],
    topicBy: (t) => (t.createdByRoleId === null ? null : EX_NAMES.get(t.createdByRoleId) ?? null),
    items: [
      exItem(1, '2026-10-02T17:05:00.000Z', { role: EX_ANNA, person: EX_ANNA }, { text: EX_FIRST, name: 'Anna Nowak' }, { topicId: EX_T_TRANSPORT }),
      exItem(2, '2026-10-02T17:20:00.000Z', { role: EX_JAN, person: EX_JAN }, {
        text: 'Dzwoniłem do firmy z Tarnowa: 6200 zł w obie strony, oferta w załączniku.', name: 'Jan Kowalski', // i18n-ignore
        replyTo: exMessage(1), replyText: EX_FIRST, attachments: [EX_OFFER]
      }, { topicId: EX_T_TRANSPORT }),
      exItem(3, '2026-10-03T08:00:00.000Z', { role: EX_RADA, person: EX_MARIA }, {
        text: 'Rezerwuję dom pielgrzyma na dwie noce — listę osób potrzebuję do piątku.', name: 'Maria Wiśniewska', via: 'Rada' // i18n-ignore
      }, { topicId: EX_T_NOCLEGI, version: 2, editedAt: '2026-10-03T08:12:00.000Z' }),
      exItem(4, '2026-10-04T12:00:00.000Z', { role: EX_PIOTR, person: EX_PIOTR }, null, { deletedAt: '2026-10-04T12:05:00.000Z', deletedBy: 'author' }),
      exItem(5, '2026-10-05T19:30:00.000Z', { seat: EX_EWA }, { text: 'Czy dzieci do lat 10 jadą za pół ceny?', name: 'Ewa Lis', via: 'Rodzice' }) // i18n-ignore
    ],
    look: {
      author: (message, opened) => authorText(messageAuthor(message, opened, { name: (id) => EX_NAMES.get(id) ?? null })),
      mine: (message) => message.authorRoleId === EX_JAN
    },
    marks: [
      { messageId: exMessage(1), mine: true, kind: 'reaction', value: '👍' },
      { messageId: exMessage(1), mine: false, kind: 'reaction', value: '👍' },
      { messageId: exMessage(2), mine: false, kind: 'pin', value: '1' },
      { messageId: exMessage(2), mine: true, kind: 'star', value: '1' }
    ],
    linked: [
      { kind: 'task', title: 'Wpłacić zaliczkę za autokar', topicId: EX_T_TRANSPORT, messageId: exMessage(2), at: '2026-11-15T09:00:00.000Z', end: null, state: 'zaplanowane' } // i18n-ignore
    ]
  };
}

/** Das Beispiel des Exports — so sieht ein Dokument aus, das die Rozmowa hinausgibt. */
export const chatExample = (): Record<string, unknown> => exportChat(chatExampleInput());

/** Ein Dokument, das sich in JEDE Rozmowa importieren lässt, in der man schreibt: zwei Themen und ein Satz in jedem. */
export const chatTopicsSample = (): Record<string, unknown> => ({
  format: CHAT_FORMAT,
  version: CHAT_VERSION,
  topics: [
    { key: 'transport', title: 'Pielgrzymka — transport' }, // i18n-ignore
    { key: 'noclegi', title: 'Pielgrzymka — noclegi' } // i18n-ignore
  ],
  messages: [
    { topic: '@transport', text: 'Podsumowanie ustaleń: jedziemy autokarem z Tarnowa (6200 zł w obie strony), wyjazd 5 maja o 6:00 spod kościoła. Zaliczka do 15 listopada.' }, // i18n-ignore
    { topic: '@noclegi', text: 'Kto jeszcze nie potwierdził noclegu w domu pielgrzyma, niech napisze tutaj do piątku.' } // i18n-ignore
  ]
});

/** Ein Erinnern für morgen früh, ohne Ton — die Zeit wird beim Einsetzen gerechnet (`now`), damit sie in der Zukunft liegt. */
export function chatReminderSample(now: Date = new Date()): Record<string, unknown> {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  return {
    format: CHAT_FORMAT,
    version: CHAT_VERSION,
    messages: [{ text: 'Przypomnienie: dziś o 19:00 spotkanie w salce przy zakrystii — zabierzcie kalendarze.', sendAt: at.toISOString(), silent: true }] // i18n-ignore
  };
}

/* -- Die Beschreibung als Baum ------------------------------------------------------------------------------- */

const INTRO = (): string => `${t('chatJson.desc.intro', { maxPosts: MAX_POSTS, maxExport: MAX_EXPORT })}

${t('chatJson.desc.document')}
${keyLines(DOC_KEYS)}
${t('chatJson.desc.inChat')}
${keyLines(CHAT_KEYS)}
${t('chatJson.desc.inMe')}
${keyLines(ME_KEYS)}
${t('chatJson.desc.inRange')}
${keyLines(RANGE_KEYS)}`;

const TOPIC_TEXT = (): string => `${t('chatJson.desc.topic', { max: MAX_NEW_TOPICS })}
${keyLines(TOPIC_KEYS)}`;

const MESSAGE_TEXT = (): string => `${t('chatJson.desc.message')}
${keyLines(MESSAGE_KEYS)}`;

const NEW_MESSAGE_TEXT = (): string => `${t('chatJson.desc.new')}
${keyLines(NEW_MESSAGE_KEYS)}
${t('chatJson.desc.newNever')}
${t('chatJson.desc.newExample')}
${pretty(chatTopicsSample())}
${t('chatJson.desc.newLater')}`;

const LINKED_TEXT = (): string => `${t('chatJson.desc.linked')}
${keyLines(LINKED_KEYS)}`;

/*
 * 2026-10-30 — WAS DIE APP MIT DEM IMPORTIERTEN TUT: Zugang = Bereich (`Chat.cs`), Unterschrift der Rolle
 * (`sendMessage`), der Name aus „Moje dane" (`myRoleNames`), Wecken ohne Inhalt (`Push.cs`, still bei `silent`),
 * geplant nur mit Recht zur Zeit des Sendens (`ChatDelivery.cs`), Themen (`TopicBar.tsx`).
 */
const USAGE_TEXT = (): string => t('chatJson.desc.usage');

export const CHAT_USAGE_JSON: JsonNode = { key: 'chat.usage', get title() { return t('chatJson.node.usage'); }, text: USAGE_TEXT };
export const CHAT_TOPIC_JSON: JsonNode = { key: 'chat.topic', get title() { return t('chatJson.node.topic'); }, text: TOPIC_TEXT };
export const CHAT_MESSAGE_JSON: JsonNode = {
  key: 'chat.message', get title() { return t('chatJson.node.message'); }, get short() { return t('chatJson.node.messageShort'); }, text: MESSAGE_TEXT
};
export const CHAT_NEW_MESSAGE_JSON: JsonNode = {
  key: 'chat.new', get title() { return t('chatJson.node.new'); }, get short() { return t('chatJson.node.newShort'); }, text: NEW_MESSAGE_TEXT
};
export const CHAT_LINKED_JSON: JsonNode = {
  key: 'chat.linked', get title() { return t('chatJson.node.linked'); }, get short() { return t('chatJson.node.linkedShort'); }, text: LINKED_TEXT
};
export const CHAT_EXAMPLE_JSON: JsonNode = { key: 'chat.example', get title() { return t('chatJson.node.example'); }, text: () => pretty(chatExample()) };

/** 2026-10-29 — DIE ROZMOWA ALS JSON: der Baum, aus dem ihre Beschreibung entsteht (und die Beispiele zum Einsetzen). */
export const CHAT_JSON: JsonNode = {
  key: 'chat',
  get title() { return t('chatJson.node.chat', { format: CHAT_FORMAT, version: CHAT_VERSION }); },
  get short() { return t('chatJson.node.chatShort'); },
  text: INTRO,
  inside: () => [CHAT_USAGE_JSON, CHAT_TOPIC_JSON, CHAT_MESSAGE_JSON, CHAT_NEW_MESSAGE_JSON, CHAT_LINKED_JSON, CHAT_EXAMPLE_JSON],
  samples: () => [
    { label: t('chatJson.sample.topics'), doc: chatTopicsSample },
    { label: t('chatJson.sample.reminder'), doc: () => chatReminderSample() }
  ]
};

/** Die Beschreibung als Text — ohne die App, für den Katalog des MCP-Servers. */
export const chatDescription = (): string => describe(CHAT_JSON);
