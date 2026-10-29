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
import { plural } from '../core/plural';
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

export const KIND_WORDS: Readonly<Record<ChatKind, string>> = {
  area: 'rozmowa obszaru',
  channel: 'kanał ogłoszeń — piszą prowadzący',
  group: 'grupa',
  direct: 'rozmowa we dwoje',
  self: 'Notatki — tylko Ty',
  seat: 'rozmowa z jedną osobą z formularza'
};

/* -- Die Schlüssel ------------------------------------------------------------------------------------- */

const DOC_KEYS: Readonly<Record<string, string>> = {
  format: `zawsze "${CHAT_FORMAT}"`,
  version: `wersja formatu: ${CHAT_VERSION}`,
  chat: 'rozmowa, z której pochodzi eksport (niżej) — tylko informacja: import idzie zawsze do rozmowy otwartej w aplikacji',
  me: 'kto eksportował i co może w tej rozmowie (niżej) — tylko informacja',
  exportedAt: 'chwila eksportu (ISO 8601, UTC) — tylko informacja',
  range: 'co obejmuje eksport (niżej) — tylko informacja',
  topics: 'tematy rozmowy — wszystkie, także zamknięte (niżej: Temat)',
  messages: 'wiadomości, od najstarszej (niżej: Wiadomość z eksportu, Nowa wiadomość)',
  linked: 'zadania i terminy utworzone z wiadomości tej rozmowy (niżej) — tylko do odczytu, import je pomija'
};

const CHAT_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator rozmowy; inny niż rozmowy otwartej — dokument z innej rozmowy: jej wiadomości import pomija, jej tematy zakłada tu jako nowe',
  kind: `rodzaj: ${(Object.keys(KIND_WORDS) as ChatKind[]).map((k) => `"${k}" (${KIND_WORDS[k]})`).join(', ')}`,
  title: 'nazwa rozmowy, jak w jej nagłówku'
};

const ME_KEYS: Readonly<Record<string, string>> = {
  name: 'jak jest podpisana wiadomość tej osoby: „Imię Nazwisko”, a gdy pisze przez rolę — „Imię Nazwisko (Rola)”; jej wiadomości mają "mine": true',
  writes: 'true — pisze w tej rozmowie: import może dodać jej nowe wiadomości i tematy',
  moderates: 'true — prowadzi rozmowę: przypina, porządkuje także cudze wiadomości, zmienia każdy temat'
};

const RANGE_KEYS: Readonly<Record<string, string>> = {
  from: 'od kiedy (ISO 8601; null — od początku rozmowy)',
  to: 'do kiedy (chwila eksportu)',
  topic: 'tylko wiadomości tego tematu ("@klucz" z "topics") albo null — wszystkie',
  limited: `true — eksport doszedł do limitu ${MAX_EXPORT} wiadomości; starszych z tego okresu w nim nie ma`
};

const TOPIC_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator tematu z eksportu — z nim import zmienia TEN temat; bez niego zakłada nowy (a gdy temat o tej nazwie już jest, używa istniejącego)',
  key: 'krótka nazwa do odwołań w tym dokumencie (litery, cyfry, - i _): wiadomość wskazuje temat przez "topic": "@klucz"; eksport tworzy ją z nazwy',
  title: `nazwa tematu (wymagana przy nowym, do ${MAX_TITLE} znaków); inna niż w rozmowie przy temacie z "id" — zmiana nazwy`,
  closed: 'true — temat zamknięty (schowany pod „Zamknięte”), false — otwarty; zmiana zamyka albo otwiera go ponownie',
  createdAt: 'kiedy założony — tylko informacja',
  createdBy: 'kto założył — tylko informacja',
  messages: 'ile ma wiadomości — tylko informacja',
  tasks: 'ile zadań z niego powstało — tylko informacja',
  appointments: 'ile terminów z niego powstało — tylko informacja'
};

const MESSAGE_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator wiadomości — z nim import tylko porządkuje ("topic", "pinned", "starred"); treść, nadawca i czas zostają zawsze, jakie są',
  at: 'kiedy wysłana (ISO 8601, UTC)',
  author: 'kto napisał — jak w rozmowie: „Imię Nazwisko”, a przez rolę „Imię Nazwisko (Rola)”',
  mine: 'true — napisała ją osoba z "me"',
  link: 'true — napisała osoba z linku (bez konta)',
  topic: 'temat: "@klucz" z "topics" (albo "id" tematu); w eksporcie brak — bez tematu. W imporcie inny niż w rozmowie — przeniesienie (null — poza tematy), brak — bez zmian; przenosi autor wiadomości albo prowadzący (we dwoje i w Notatkach każdy, kto pisze)',
  text: 'treść',
  replyTo: '"id" wiadomości, na którą odpowiada',
  quote: 'cytat, który widział odpowiadający',
  attachments: 'załączniki — tylko opis; plików w JSON nie ma',
  'attachments[].name': 'nazwa pliku',
  'attachments[].type': 'typ (MIME), np. "application/pdf", "image/jpeg"',
  'attachments[].size': 'rozmiar w bajtach',
  forwarded: 'true — przekazana z innej rozmowy',
  imported: 'true — przyszła z importu JSON (w rozmowie oznaczona „Z importu”)',
  edited: 'kiedy ostatnio poprawiona (historia zmian jest w rozmowie)',
  deleted: 'kiedy usunięta — treści już nie ma',
  deletedBy: '"author" — usunął ją autor, "moderator" — prowadzący',
  blocked: 'true — zablokowana po zgłoszeniu; treści nie ma',
  unreadable: 'true — nie do odczytania w tej przeglądarce (brak klucza tej epoki rozmowy)',
  reactions: 'reakcje — tylko informacja (import ich nie zmienia)',
  'reactions[].emoji': 'znak reakcji, np. "👍"',
  'reactions[].count': 'ile osób tak zareagowało',
  'reactions[].mine': 'true — także osoba z "me"',
  pinned: 'true — przypięta dla wszystkich; w imporcie zmiana przypina albo odpina (false) — tylko prowadzący',
  starred: 'true — w „Zapisanych wiadomościach” osoby z "me" (widzi je tylko ona); w imporcie zmiana zapisuje albo usuwa z zapisanych (false)'
};

const NEW_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  text: `treść (wymagana; najwyżej ${MAX_TEXT_BYTES} bajtów UTF-8, licząc podwójnie znaki nowej linii i cudzysłowy — kilka tysięcy znaków)`,
  topic: 'temat: "@klucz" z "topics" (także nowego tematu z tego dokumentu) albo "id" istniejącego; brak albo null — bez tematu',
  replyTo: '"id" wiadomości z tej rozmowy, na którą to odpowiedź — cytat import bierze z tej wiadomości, nigdy z dokumentu',
  sendAt: `zaplanuj wysłanie (ISO 8601 ze strefą, np. "2026-12-01T09:00:00+01:00"; od ${SEND_AT_MIN_MINUTES} minut do roku naprzód) — czeka w „Zaplanowanych”, gdzie można ją wysłać od razu albo odwołać; bez "sendAt" wychodzi od razu`,
  silent: 'true — bez dźwięku: nikogo nie budzi powiadomieniem'
};

const LINKED_KEYS: Readonly<Record<string, string>> = {
  kind: '"task" — zadanie, "appointment" — termin w kalendarzu',
  title: 'tytuł',
  topic: 'temat ("@klucz") albo null',
  message: '"id" wiadomości, z której powstało zadanie',
  at: 'zadanie: najbliższy (albo ostatni) termin wykonania; termin: początek (ISO 8601)',
  end: 'koniec terminu',
  state: 'zadanie: „zaplanowane”, „teraz”, „przegapione”, „zrobione”, „zaległe”, „co pewien czas”; termin: „zaplanowany” albo „odwołany”'
};

const prefixed = (prefix: string, keys: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(keys).map(([key, says]) => [`${prefix}${key}`, says]));

/** Jeder Pfad, den die Beschreibung erklärt (`messages[].attachments[].name`) — für die Prüfung. */
export const CHAT_PATHS: Readonly<Record<string, string>> = {
  ...DOC_KEYS,
  ...prefixed('chat.', CHAT_KEYS),
  ...prefixed('me.', ME_KEYS),
  ...prefixed('range.', RANGE_KEYS),
  ...prefixed('topics[].', TOPIC_KEYS),
  ...prefixed('messages[].', MESSAGE_KEYS),
  ...prefixed('messages[].', NEW_MESSAGE_KEYS),
  ...prefixed('linked[].', LINKED_KEYS)
};

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
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '') || 'temat';

const KEY = /^[a-z0-9_-]{1,40}$/;

const bytes = (text: string): number => new TextEncoder().encode(text).length;

const short = (text: string, max = 160): string => {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** Eine Zeit in den Zeilen der Vorschau — wie in der Rozmowa. */
const when = (at: string): string => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? at : new Date(t).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

export const READ_ONLY_IMPORT = 'Tę rozmowę możesz tylko czytać — import (tematy, porządki, nowe wiadomości) jest dla tych, którzy w niej piszą. Eksport działa jak zawsze.';

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
const minuteOf = (at: string | null): string => (at === null ? 'teraz' : String(Math.round(Date.parse(at) / MINUTE)));

/**
 * WAS EIN DOKUMENT IN DIESER ROZMOWA ÄNDERN WÜRDE — oder warum es nicht geht. Jede Zeile eine Änderung, jede
 * Warnung etwas, das ausgelassen wird; geschrieben wird erst auf „Importuj" (`ChatJsonDialog`).
 */
export function planChatImport(doc: unknown, ctx: ChatImportContext): ChatImportPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument rozmowy — oczekiwano jednego obiektu JSON.' };
  if (doc.format !== undefined && doc.format !== CHAT_FORMAT) return { error: `Inny format: "${String(doc.format)}" — oczekiwano "${CHAT_FORMAT}".` };
  if (!ctx.writes && !ctx.moderates) return { error: READ_ONLY_IMPORT };

  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== CHAT_VERSION) warnings.push(`Wersja ${String(doc.version)} — czytana jak wersja ${CHAT_VERSION}.`);
  for (const key of Object.keys(doc)) if (!own(DOC_KEYS, key)) warnings.push(`Nieznany klucz "${key}" — pominięty.`);

  const source = isObject(doc.chat) ? doc.chat : null;
  const foreign = source !== null && typeof source.id === 'string' && source.id !== ctx.chatId;
  const sourceTitle = source !== null && typeof source.title === 'string' && source.title.trim() !== '' ? ` („${source.title.trim()}”)` : '';

  /* -- Themen -- */
  const byId = new Map(ctx.topics.map((t) => [t.topicId, t]));
  const byTitle = new Map(ctx.topics.map((t) => [norm(t.title), t]));
  const refs = new Map<string, TopicTarget | null>();
  const newTopics: NewTopic[] = [];
  const newByTitle = new Map<string, NewTopic>();
  const topicChanges: TopicChange[] = [];
  const seenTopics = new Set<string>();

  if (doc.topics !== undefined && !Array.isArray(doc.topics)) warnings.push('"topics" to nie lista — pominięte.');
  (Array.isArray(doc.topics) ? doc.topics : []).forEach((raw, i) => {
    const where = `Temat ${i + 1}`;
    if (!isObject(raw)) { warnings.push(`${where}: to nie obiekt — pominięty.`); return; }
    for (const key of Object.keys(raw)) if (!own(TOPIC_KEYS, key)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);

    let key: string | null = null;
    if (raw.key !== undefined && raw.key !== null) {
      const k = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '').toLowerCase() : '';
      if (KEY.test(k)) key = k;
      else warnings.push(`${where}: "key" może mieć tylko litery, cyfry, - i _ (do 40 znaków) — odwołania do niego nie zadziałają.`);
    }
    let title: string | null = typeof raw.title === 'string' && raw.title.trim() !== '' ? raw.title.trim().replace(/\s+/g, ' ') : null;
    if (raw.title !== undefined && raw.title !== null && typeof raw.title !== 'string') warnings.push(`${where}: "title" to nie tekst — pominięte.`);
    if (title !== null && title.length > MAX_TITLE) {
      warnings.push(`${where}: nazwa dłuższa niż ${MAX_TITLE} znaków — skrócona.`);
      title = title.slice(0, MAX_TITLE).trim();
    }
    const closed = typeof raw.closed === 'boolean' ? raw.closed : undefined;
    if (raw.closed !== undefined && raw.closed !== null && closed === undefined) warnings.push(`${where}: "closed" to true albo false — pominięte.`);
    const id = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim() : null;
    const existing = id !== null && !foreign ? byId.get(id) : undefined;

    let target: TopicTarget | null = null;
    if (existing !== undefined) {
      target = { kind: 'topic', topicId: existing.topicId };
      if (seenTopics.has(existing.topicId)) warnings.push(`${where}: ten sam temat („${existing.title}”) drugi raz — pominięty.`);
      else {
        seenTopics.add(existing.topicId);
        if (raw.title !== undefined && title === null) warnings.push(`${where}: pusta nazwa — zostaje „${existing.title}”.`);
        const rename = title !== null && title !== existing.title ? title : undefined;
        const close = closed !== undefined && closed !== existing.closed ? closed : undefined;
        if (rename !== undefined || close !== undefined) {
          if (!existing.mayChange) warnings.push(`${where} („${existing.title}”): nazwę zmienia i temat zamyka ten, kto go założył, albo prowadzący rozmowę — pominięte.`);
          else topicChanges.push({ topicId: existing.topicId, was: existing.title, ...(rename !== undefined ? { title: rename } : {}), ...(close !== undefined ? { closed: close } : {}) });
        }
      }
    } else {
      if (id !== null && !foreign) warnings.push(`${where}: w tej rozmowie nie ma tematu o tym "id" — ${title === null ? 'pominięty' : 'potraktowany jak nowy'}.`);
      if (title === null) warnings.push(`${where}: bez nazwy ("title") — pominięty.`);
      else {
        const same = byTitle.get(norm(title));
        const twin = newByTitle.get(norm(title));
        if (same !== undefined) target = { kind: 'topic', topicId: same.topicId };
        else if (twin !== undefined) target = { kind: 'new', ref: twin.ref };
        else if (ctx.kind === 'self') warnings.push(`${where} („${title}”): w Notatkach nie ma tematów — pominięty.`);
        else if (!ctx.writes) warnings.push(`${where} („${title}”): temat zakłada ktoś, kto pisze w tej rozmowie — pominięty.`);
        else if (newTopics.length >= MAX_NEW_TOPICS) warnings.push(`${where} („${title}”): najwyżej ${MAX_NEW_TOPICS} nowych tematów w jednym imporcie — pominięty.`);
        else {
          const made: NewTopic = { ref: `#${newTopics.length + 1}`, title, closed: closed === true };
          newTopics.push(made);
          newByTitle.set(norm(title), made);
          target = { kind: 'new', ref: made.ref };
        }
      }
    }
    if (key !== null) {
      if (refs.has(key)) warnings.push(`${where}: klucz "${key}" drugi raz — "@${key}" wskazuje pierwszy temat z tym kluczem.`);
      else refs.set(key, target);
    }
  });

  const derived = new Map([...topicKeys(ctx.topics)].map(([topicId, key]) => [key, topicId]));
  const topicTitle = (to: TopicTarget): string | null =>
    to.kind === 'none' ? null : to.kind === 'topic' ? byId.get(to.topicId)?.title ?? 'temat' : newTopics.find((t) => t.ref === to.ref)?.title ?? 'temat';

  /** Ein Verweis auf ein Thema — `null`: nicht zu finden (die Warnung steht schon da, mit `instead`). */
  const resolveTopic = (value: unknown, where: string, instead: string): TopicTarget | null => {
    if (value === null || value === '') return { kind: 'none' };
    if (typeof value !== 'string') { warnings.push(`${where}: "topic" to nie tekst — ${instead}.`); return null; }
    const v = value.trim();
    if (v.startsWith('@')) {
      const key = v.slice(1).toLowerCase();
      if (!refs.has(key)) {
        /* Ohne Eintrag in "topics": der Schlüssel, den der Export dem Thema gibt — ein gekürztes Dokument trifft noch. */
        const topicId = derived.get(key);
        if (topicId !== undefined) return { kind: 'topic', topicId };
        warnings.push(`${where}: w "topics" nie ma tematu z kluczem "${key}" — ${instead}.`);
        return null;
      }
      const target = refs.get(key) ?? null;
      if (target === null) warnings.push(`${where}: temat "${v}" jest pominięty (wyżej) — ${instead}.`);
      return target;
    }
    const known = foreign ? undefined : byId.get(v);
    if (known === undefined) { warnings.push(`${where}: w tej rozmowie nie ma tematu „${short(v, 40)}” — ${instead}.`); return null; }
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
    ...ctx.messages.filter((m) => m.mine && m.text !== null).map((m) => `${norm(m.text!)}|teraz`),
    ...ctx.scheduled.map((s) => `${norm(s.text)}|${minuteOf(s.sendAt)}`)
  ]);
  const myName = ctx.me[0] ?? 'osoba, która importuje';
  let foreignSkipped = 0;
  let notWriting = 0;
  let over = 0;

  if (doc.messages !== undefined && !Array.isArray(doc.messages)) warnings.push('"messages" to nie lista — pominięte.');
  (Array.isArray(doc.messages) ? doc.messages : []).forEach((raw, i) => {
    const where = `Wiadomość ${i + 1}`;
    if (!isObject(raw)) { warnings.push(`${where}: to nie obiekt — pominięta.`); return; }

    if (raw.id !== undefined && raw.id !== null) {
      /* -- Eine aus der Rozmowa: nur ordnen. -- */
      if (typeof raw.id !== 'string' || raw.id.trim() === '') { warnings.push(`${where}: nieczytelne "id" — pominięta.`); return; }
      if (foreign) { foreignSkipped += 1; return; }
      const known = byMessage.get(raw.id.trim());
      if (known !== undefined && seenMessages.has(known.id)) { warnings.push(`${where}: ta sama wiadomość drugi raz — pominięta.`); return; }
      if (known !== undefined) seenMessages.add(known.id);
      if (known === undefined) {
        const at = typeof raw.at === 'string' ? Date.parse(raw.at) : Number.NaN;
        const older = !ctx.complete && ctx.from !== null && !Number.isNaN(at) && at < Date.parse(ctx.from);
        warnings.push(older
          ? `${where}: starsza niż wczytane wiadomości tej rozmowy (najwyżej ${MAX_EXPORT}) — pominięta.`
          : `${where}: w tej rozmowie nie ma wiadomości o tym "id" — pominięta (import nie wstawia cudzych wiadomości).`);
        return;
      }
      const label = `${where} (${String(known.out.author)}, ${when(known.at)})`;
      for (const key of Object.keys(raw)) if (!own(MESSAGE_KEYS, key)) warnings.push(`${label}: nieznany klucz "${key}" — pominięty.`);

      const differs = READ_ONLY_KEYS.filter((key) => key in raw && !sameField(key, raw[key], known.out[key]));
      if (differs.length > 0) {
        warnings.push(`${label}: ${differs.map((k) => `"${k}"`).join(', ')} — inaczej niż w rozmowie. Import nie zmienia treści, nadawcy ani czasu wiadomości (swoją poprawisz w rozmowie: „Edytuj”); pominięte.`);
      }
      if ('reactions' in raw) {
        const mineNow = Array.isArray(raw.reactions)
          ? raw.reactions.filter((r) => isObject(r) && r.mine === true && typeof r.emoji === 'string').map((r) => String((r as Record<string, unknown>).emoji))
          : [];
        if (!Array.isArray(raw.reactions) || mineNow.slice().sort().join(' ') !== known.myReactions.slice().sort().join(' ')) {
          warnings.push(`${label}: reakcji import nie zmienia — swoją dodasz w rozmowie.`);
        }
      }

      if ('topic' in raw) {
        const to = resolveTopic(raw.topic, label, 'zostaje, gdzie była');
        if (to !== null && !sameTarget(to, known.topicId)) {
          if (!known.mayFile) warnings.push(`${label}: do tematu przenosi ją jej autor albo prowadzący rozmowę — zostaje, gdzie była.`);
          else moves.push({ messageId: known.id, to });
        }
      }
      for (const kind of ['pinned', 'starred'] as const) {
        if (!(kind in raw)) continue;
        const value = raw[kind];
        if (value !== true && value !== false && value !== null) { warnings.push(`${label}: "${kind}" to true albo false — pominięte.`); continue; }
        const on = value === true;
        const was = kind === 'pinned' ? known.pinned : known.starred;
        if (on === was) continue;
        if (kind === 'pinned' && !ctx.moderates) { warnings.push(`${label}: przypina i odpina prowadzący rozmowę — pominięte.`); continue; }
        if (!known.live) { warnings.push(`${label}: usunięta albo nieczytelna — nie da się jej ${kind === 'pinned' ? 'przypiąć' : 'zapisać'}.`); continue; }
        marks.push({ messageId: known.id, kind: kind === 'pinned' ? 'pin' : 'star', on });
      }
      return;
    }

    /* -- Ohne "id": eine NEUE, als die Person, die importiert. -- */
    if (!ctx.writes) { notWriting += 1; return; }
    const label = `Nowa wiadomość (pozycja ${i + 1})`;
    if ('deleted' in raw || raw.blocked === true || raw.unreadable === true) {
      warnings.push(`${label}: to opis usuniętej albo nieczytelnej wiadomości, bez "id" — pominięta.`);
      return;
    }
    if ('at' in raw) {
      warnings.push(`${label}: ma "at" — import nie pisze wstecz, wiadomość z importu nigdy nie udaje dawnej. Usuń "at" (wyjdzie od razu) albo podaj "sendAt" (zaplanuje ją); pominięta.`);
      return;
    }
    if ('author' in raw && raw.author !== null && !(typeof raw.author === 'string' && ctx.me.some((name) => norm(name) === norm(raw.author as string)))) {
      warnings.push(`${label}: "author" to „${short(String(raw.author), 60)}” — import pisze wyłącznie jako Ty (${myName}), nigdy w czyimś imieniu; pominięta.`);
      return;
    }
    for (const key of Object.keys(raw)) {
      if (NEW_QUIET.has(key)) continue;
      if (key === 'attachments') warnings.push(`${label}: plików nie ma w JSON — dołącz je w rozmowie; wiadomość pójdzie bez nich.`);
      else if (key === 'quote') warnings.push(`${label}: "quote" pominięte — cytat import bierze z wiadomości z "replyTo".`);
      else if (own(MESSAGE_KEYS, key)) warnings.push(`${label}: "${key}" w nowej wiadomości jest pomijane.`);
      else warnings.push(`${label}: nieznany klucz "${key}" — pominięty.`);
    }

    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (text === '') { warnings.push(`${label}: bez treści ("text") — pominięta.`); return; }
    /* Gemessen, wie der Text in der Hülle steht (JSON: Zeilenumbrüche und Anführungszeichen zählen doppelt). */
    const size = bytes(JSON.stringify(text)) - 2;
    if (size > MAX_TEXT_BYTES) { warnings.push(`${label}: za długa (${size} bajtów, najwyżej ${MAX_TEXT_BYTES}) — podziel ją na kilka; pominięta.`); return; }

    let sendAt: string | null = null;
    if (raw.sendAt !== undefined && raw.sendAt !== null) {
      const t = typeof raw.sendAt === 'string' ? Date.parse(raw.sendAt) : Number.NaN;
      const now = ctx.now.getTime();
      if (Number.isNaN(t)) { warnings.push(`${label}: "sendAt" to nie data ISO 8601 (np. "2026-12-01T09:00:00+01:00") — pominięta.`); return; }
      if (t < now + SEND_AT_MIN_MINUTES * MINUTE) { warnings.push(`${label}: "sendAt" (${when(new Date(t).toISOString())}) jest w przeszłości albo za blisko — zaplanować można od ${SEND_AT_MIN_MINUTES} minut naprzód; bez "sendAt" wyjdzie od razu. Pominięta.`); return; }
      if (t > now + SEND_AT_MAX_DAYS * DAY) { warnings.push(`${label}: "sendAt" dalej niż rok naprzód — pominięta.`); return; }
      sendAt = new Date(t).toISOString();
    }
    if (raw.silent !== undefined && typeof raw.silent !== 'boolean') warnings.push(`${label}: "silent" to true albo false — pominięte.`);

    let to: TopicTarget = { kind: 'none' };
    if (raw.topic !== undefined) to = resolveTopic(raw.topic, label, 'pójdzie bez tematu') ?? { kind: 'none' };

    let replyTo: string | null = null;
    let replyText: string | null = null;
    if (raw.replyTo !== undefined && raw.replyTo !== null) {
      const target = typeof raw.replyTo === 'string' && !foreign ? byMessage.get(raw.replyTo.trim()) : undefined;
      if (target === undefined) warnings.push(`${label}: "replyTo" nie wskazuje wczytanej wiadomości tej rozmowy — pójdzie bez cytatu.`);
      else if (!target.live) warnings.push(`${label}: wiadomość z "replyTo" jest usunięta albo nieczytelna — pójdzie bez cytatu.`);
      else { replyTo = target.id; replyText = (target.text !== null && target.text !== '' ? target.text : target.files > 0 ? 'Załącznik' : '').slice(0, 500); }
    }

    const fingerprint = `${norm(text)}|${minuteOf(sendAt)}`;
    if (posted.has(fingerprint)) {
      warnings.push(`${label}: ${sendAt === null ? 'Twoja wiadomość o tej treści już jest w rozmowie' : 'ta sama wiadomość już czeka w „Zaplanowanych”'} — pominięta, żeby nie było jej dwa razy.`);
      return;
    }
    if (posts.length >= MAX_POSTS) { over += 1; return; }
    posted.add(fingerprint);
    posts.push({ text, to, replyTo, replyText, sendAt, silent: raw.silent === true });
  });

  if (foreign) {
    warnings.unshift(`Dokument pochodzi z innej rozmowy${sourceTitle} — jej wiadomości nie zostaną tu przeniesione ani skopiowane${foreignSkipped > 0 ? ` (pominięto ${foreignSkipped})` : ''}; jej tematy powstaną tu jako nowe.`);
  }
  if (notWriting > 0) warnings.push(`Nowe wiadomości (${notWriting}) pominięte — w tej rozmowie nie piszesz.`);
  if (over > 0) warnings.push(`Najwyżej ${MAX_POSTS} nowych wiadomości w jednym imporcie — pominięto ${over}.`);

  /* -- Die Zeilen der Vorschau -- */
  const lines: string[] = [];
  for (const t of newTopics) lines.push(`Nowy temat: „${t.title}”${t.closed ? ' (od razu zamknięty)' : ''}`);
  for (const c of topicChanges) {
    if (c.title !== undefined) lines.push(`Zmiana nazwy tematu: „${c.was}” → „${c.title}”`);
    if (c.closed !== undefined) lines.push(`${c.closed ? 'Zamknięcie' : 'Ponowne otwarcie'} tematu „${c.title ?? c.was}”`);
  }
  const moved = new Map<string, number>();
  for (const m of moves) {
    const name = topicTitle(m.to);
    const line = name === null ? 'Poza tematy' : `Do tematu „${name}”`;
    moved.set(line, (moved.get(line) ?? 0) + 1);
  }
  for (const [line, n] of moved) lines.push(`${line}: ${n} ${plural(n, 'wiadomość', 'wiadomości', 'wiadomości')}`);
  const count = (kind: 'pin' | 'star', on: boolean) => marks.filter((m) => m.kind === kind && m.on === on).length;
  const markLines: readonly [number, string][] = [
    [count('pin', true), 'Przypięcie'], [count('pin', false), 'Odpięcie'],
    [count('star', true), 'Zapisanie (dla Ciebie)'], [count('star', false), 'Usunięcie z zapisanych']
  ];
  for (const [n, what] of markLines) if (n > 0) lines.push(`${what}: ${n} ${plural(n, 'wiadomość', 'wiadomości', 'wiadomości')}`);
  for (const p of posts) {
    const topic = topicTitle(p.to);
    const reply = p.replyTo === null ? null : byMessage.get(p.replyTo);
    const how = [
      p.sendAt !== null ? `zaplanowana na ${when(p.sendAt)}` : null,
      topic !== null ? `w temacie „${topic}”` : null,
      reply != null ? `odpowiedź na: ${String(reply.out.author)}` : null,
      p.silent ? 'bez dźwięku' : null
    ].filter((x): x is string => x !== null);
    lines.push(`Nowa wiadomość jako ${myName}${how.length > 0 ? ` (${how.join(', ')})` : ''}, oznaczona „Z importu”: „${short(p.text)}”`);
  }
  if (lines.length === 0) lines.push('Nic do zmiany — dokument zgadza się z rozmową.');

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
const EX_NAMES = new Map([[EX_ANNA, 'Anna Nowak'], [EX_JAN, 'Jan Kowalski'], [EX_MARIA, 'Maria Wiśniewska'], [EX_RADA, 'Rada'], [EX_PIOTR, 'Piotr Zieliński']]);

const EX_FIRST = 'Proponuję wynająć autokar na 50 osób — zna ktoś sprawdzoną firmę?';
const EX_OFFER: Attachment = { id: '0192f0a0-7c1e-7000-8000-00000000f001', name: 'oferta-autokar.pdf', type: 'application/pdf', size: 182340, key: 'A'.repeat(43) };

const exItem = (n: number, at: string, author: { role?: string; person?: string; seat?: string }, opened: Opened | null, rest: Partial<SealedMessage> = {}): ExportItem => ({
  message: {
    messageId: exMessage(n), authorRoleId: author.role ?? null, authorSeatId: author.seat ?? null, authorPersonId: author.person ?? null,
    epoch: 1, bodySealed: opened === null ? null : 'zapieczętowana', createdAt: at, deletedAt: null, version: 1, editedAt: null, topicId: null, ...rest
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
    chat: { chatId: EX_CHAT, kind: 'group', title: 'Pielgrzymka do Częstochowy 2027' },
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
        text: 'Dzwoniłem do firmy z Tarnowa: 6200 zł w obie strony, oferta w załączniku.', name: 'Jan Kowalski',
        replyTo: exMessage(1), replyText: EX_FIRST, attachments: [EX_OFFER]
      }, { topicId: EX_T_TRANSPORT }),
      exItem(3, '2026-10-03T08:00:00.000Z', { role: EX_RADA, person: EX_MARIA }, {
        text: 'Rezerwuję dom pielgrzyma na dwie noce — listę osób potrzebuję do piątku.', name: 'Maria Wiśniewska', via: 'Rada'
      }, { topicId: EX_T_NOCLEGI, version: 2, editedAt: '2026-10-03T08:12:00.000Z' }),
      exItem(4, '2026-10-04T12:00:00.000Z', { role: EX_PIOTR, person: EX_PIOTR }, null, { deletedAt: '2026-10-04T12:05:00.000Z', deletedBy: 'author' }),
      exItem(5, '2026-10-05T19:30:00.000Z', { seat: EX_EWA }, { text: 'Czy dzieci do lat 10 jadą za pół ceny?', name: 'Ewa Lis', via: 'Rodzice' })
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
      { kind: 'task', title: 'Wpłacić zaliczkę za autokar', topicId: EX_T_TRANSPORT, messageId: exMessage(2), at: '2026-11-15T09:00:00.000Z', end: null, state: 'zaplanowane' }
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
    { key: 'transport', title: 'Pielgrzymka — transport' },
    { key: 'noclegi', title: 'Pielgrzymka — noclegi' }
  ],
  messages: [
    { topic: '@transport', text: 'Podsumowanie ustaleń: jedziemy autokarem z Tarnowa (6200 zł w obie strony), wyjazd 5 maja o 6:00 spod kościoła. Zaliczka do 15 listopada.' },
    { topic: '@noclegi', text: 'Kto jeszcze nie potwierdził noclegu w domu pielgrzyma, niech napisze tutaj do piątku.' }
  ]
});

/** Ein Erinnern für morgen früh, ohne Ton — die Zeit wird beim Einsetzen gerechnet (`now`), damit sie in der Zukunft liegt. */
export function chatReminderSample(now: Date = new Date()): Record<string, unknown> {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  return {
    format: CHAT_FORMAT,
    version: CHAT_VERSION,
    messages: [{ text: 'Przypomnienie: dziś o 19:00 spotkanie w salce przy zakrystii — zabierzcie kalendarze.', sendAt: at.toISOString(), silent: true }]
  };
}

/* -- Die Beschreibung als Baum ------------------------------------------------------------------------------- */

const INTRO = (): string => `Jedna rozmowa (Rozmowy → rozmowa → ⋮ „Więcej opcji” → „Rozmowa jako JSON”): wiadomości z wybranego okresu albo jednego tematu — kto i kiedy napisał, odpowiedzi, poprawki, załączniki (nazwa i rozmiar), reakcje, przypięcia — do tego tematy oraz zadania i terminy, które z rozmowy powstały. Do archiwum i do przeczytania, streszczenia albo uporządkowania przez asystenta.

Co robi import (zawsze w rozmowie otwartej w aplikacji; najpierw lista zmian z ostrzeżeniami, zapis dopiero po „Importuj”):
- Tematy bez "id" — zakłada nowe (temat o tej samej nazwie, który już jest, zostaje użyty). Tematy z "id" — zmienia nazwę ("title") albo zamyka i otwiera ("closed"); może ten, kto temat założył, albo prowadzący.
- Wiadomości z "id" (z eksportu) — tylko porządki: przeniesienie do innego tematu ("topic"; autor wiadomości albo prowadzący), przypięcie ("pinned"; prowadzący) i zapisanie dla siebie ("starred").
- Wiadomości bez "id" — NOWE wiadomości osoby, która importuje: z jej imieniem i nazwiskiem (jak przy pisaniu ręcznym), z chwilą wysłania i z oznaczeniem „Z importu”, które widzą wszyscy; albo zaplanowane na później ("sendAt"). Najwyżej ${MAX_POSTS} w jednym imporcie; jej wiadomość o tej samej treści, która już jest w rozmowie (albo już czeka zaplanowana), nie idzie drugi raz.
- Treść wiadomości i nazwy tematów są szyfrowane w przeglądarce kluczem rozmowy — tak samo jak pisane ręcznie. Plik eksportu zawiera je jawnie: to Twoja kopia.

Czego import nigdy nie robi — i dlaczego. Wiadomość jest czyjąś wypowiedzią, podpisaną kluczem roli jej autora. Import może tylko dodać Twoje nowe słowa (widocznie oznaczone) i uporządkować rozmowę:
- nie pisze w czyimś imieniu — nowa wiadomość z "author" innej osoby jest pomijana;
- nie pisze wstecz — "at" mówi, kiedy wiadomość napisano; nowa wiadomość z "at" jest pomijana (zamiast tego "sendAt": wysłanie w przyszłości);
- nie zmienia treści, nadawcy ani czasu istniejących wiadomości — także Twoich (poprawisz je w rozmowie: „Edytuj”, z historią zmian);
- nie usuwa wiadomości ani tematów — czego nie ma w dokumencie, zostaje, jak jest;
- nie przenosi wiadomości z innej rozmowy i nie wkleja ich tu jako nowych;
- nie dodaje plików (JSON ma tylko ich nazwy), reakcji, zadań ani terminów;
- nie bierze cytatu z dokumentu — cytat odpowiedzi pochodzi z prawdziwej wiadomości ("replyTo").
Kto w rozmowie tylko czyta, ma sam eksport. Eksport obejmuje najwyżej ${MAX_EXPORT} wiadomości.
Zwróć JEDEN obiekt JSON, bez komentarzy.

Dokument:
${keyLines(DOC_KEYS)}
W "chat":
${keyLines(CHAT_KEYS)}
W "me":
${keyLines(ME_KEYS)}
W "range":
${keyLines(RANGE_KEYS)}`;

const TOPIC_TEXT = (): string => `Wpis w "topics". Zmienia nazwę i zamyka temat ten, kto go założył, albo prowadzący rozmowę; w Notatkach tematów nie ma. Nowych najwyżej ${MAX_NEW_TOPICS} w jednym imporcie.
${keyLines(TOPIC_KEYS)}`;

const MESSAGE_TEXT = (): string => `Eksport opisuje każdą wiadomość tak, jak widać ją w rozmowie. Import czyta z wiadomości z "id" tylko "topic", "pinned" i "starred" — reszta jest do czytania: inna treść, nadawca albo czas dają ostrzeżenie i nic nie zmieniają. Wiadomości, których w dokumencie nie ma, zostają.
${keyLines(MESSAGE_KEYS)}`;

const NEW_MESSAGE_TEXT = (): string => `Wiadomość bez "id" import wysyła w tej rozmowie jako osoba, która importuje (jej imię i nazwisko; gdy pisze przez rolę — z rolą w nawiasie), oznaczoną „Z importu”. Kolejność w dokumencie jest kolejnością wysyłania.
${keyLines(NEW_MESSAGE_KEYS)}
Nie podawaj "author" ani "at": wiadomość z "author" innej osoby albo z "at" jest pomijana. Pliki ("attachments"), reakcje, "pinned", "starred" i "quote" nowej wiadomości import pomija.
Przykład (dwa nowe tematy i po jednej wiadomości w każdym):
${pretty(chatTopicsSample())}
Wiadomość na później, bez dźwięku: {"text": "Przypomnienie: …", "sendAt": "2026-12-01T09:00:00+01:00", "silent": true}`;

const LINKED_TEXT = (): string => `Wpis w "linked" — zadanie albo termin, które ktoś utworzył z wiadomości tej rozmowy (menu wiadomości: „Utwórz zadanie”, „Dodaj do kalendarza”). Tylko do odczytu: import go pomija.
${keyLines(LINKED_KEYS)}`;

export const CHAT_TOPIC_JSON: JsonNode = { key: 'chat.topic', title: 'Temat ("topics[]")', text: TOPIC_TEXT };
export const CHAT_MESSAGE_JSON: JsonNode = { key: 'chat.message', title: 'Wiadomość z eksportu ("messages[]" z "id")', short: 'Wiadomość z eksportu', text: MESSAGE_TEXT };
export const CHAT_NEW_MESSAGE_JSON: JsonNode = { key: 'chat.new', title: 'Nowa wiadomość ("messages[]" bez "id")', short: 'Nowa wiadomość', text: NEW_MESSAGE_TEXT };
export const CHAT_LINKED_JSON: JsonNode = { key: 'chat.linked', title: 'Zadania i terminy z rozmowy ("linked[]")', short: 'Zadania i terminy', text: LINKED_TEXT };
export const CHAT_EXAMPLE_JSON: JsonNode = { key: 'chat.example', title: 'Przykład eksportu', text: () => pretty(chatExample()) };

/** 2026-10-29 — DIE ROZMOWA ALS JSON: der Baum, aus dem ihre Beschreibung entsteht (und die Beispiele zum Einsetzen). */
export const CHAT_JSON: JsonNode = {
  key: 'chat',
  title: `Rozmowa jako JSON ("${CHAT_FORMAT}", wersja ${CHAT_VERSION})`,
  short: 'Rozmowa',
  text: INTRO,
  inside: () => [CHAT_TOPIC_JSON, CHAT_MESSAGE_JSON, CHAT_NEW_MESSAGE_JSON, CHAT_LINKED_JSON, CHAT_EXAMPLE_JSON],
  samples: () => [
    { label: 'dwa nowe tematy i wiadomość w każdym', doc: chatTopicsSample },
    { label: 'przypomnienie na jutro rano, bez dźwięku', doc: () => chatReminderSample() }
  ]
};

/** Die Beschreibung als Text — ohne die App, für den Katalog des MCP-Servers. */
export const chatDescription = (): string => describe(CHAT_JSON);
