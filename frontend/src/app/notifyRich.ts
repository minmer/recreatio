/**
 * WAS IN DER MELDUNG STEHT (0076) — geöffnet auf DIESEM Gerät, nie bei Firebase.
 *
 * Firebase bringt nur „sieh nach" (0075). Danach holt das Telefon die neuen
 * Nachrichten, Anmeldungen und Links VERSIEGELT über die eigene Verbindung
 * und öffnet sie hier — mit den Schlüsseln, die ohnehin auf dem Gerät liegen
 * (Klucz: Zachowany, im Android Keystore). Eine Antwort aus der Meldung wird
 * hier versiegelt und von der eigenen Rolle unterschrieben, genau wie in der
 * Rozmowa. Weder Firebase noch der Dienst sehen je einen Klartext.
 *
 * <b>Zwei Orte rufen das</b>: die Seite, wenn die App vorn ist (`notify.ts`),
 * und der Läufer im Hintergrund (`runner.ts` in einer unsichtbaren WebView,
 * RunnerHost.java). Was herauskommt, zeigt das Telefon (Notices.java): ein
 * Gespräch mit Antwortfeld, eine Liste der Anmeldungen, wer über einen Link
 * kam, Erinnerungen an Aufgaben mit „Zrobione".
 *
 * <b>Ohne offenen Schlüssel</b> (strenge Betriebsart, abgelaufene Sitzung)
 * kommt `locked` zurück — dann meldet das Telefon wie bisher nur Zahlen.
 */

import { loadAreas } from './area';
import {
  areaKeys, chatKeysOf, handOver, loadAreaNames, loadChat, loadMessages, markRead, openMessage, openNames, sendMessage,
  type ChatDetail, type Opened, type SealedMessage
} from './chat';
import { fullNameOf, loadFields, loadRegistrations, openSubmission, type Submission } from './form';
import { loadIntake, openIntakeKey } from './intake';
import type { Ring, SealedRole } from './keys';
import { loadLinks } from './linkAccess';
import type { Digest, DigestChat, DigestForm } from './notify';
import { keysFor } from './ringOf';
import { myRoleNames } from './roleNames';
import { viewPath } from './routes';
import { call, type Who, WorkspaceError } from './session';
import { loadTasks, markDone, openTasks, upcomingReminders, type ReminderKind } from './tasks';

/* -- Was das Telefon bekommt --------------------------------------------------- */

/** Eine Zeile im Gespräch. */
export interface NoticeLine {
  readonly id: string;
  readonly author: string;
  readonly text: string;
  readonly at: string;
  /** Dieselbe Zeit in Millisekunden — das Telefon (API 24) rechnet ohne java.time. */
  readonly ms: number;
  readonly mine: boolean;
}

/** Eine Rozmowa mit Ungelesenem — als Gespräch in der Meldung. */
export interface Conversation {
  readonly chatId: string;
  readonly title: string;
  /** Mehr als zwei Menschen: der Name steht an jeder Zeile. */
  readonly group: boolean;
  readonly unread: number;
  readonly lastMessageAt: string | null;
  /** Das Telefon zeigt schon genau diesen Stand — nichts geöffnet, nichts zu ändern. */
  readonly unchanged: boolean;
  readonly lines: readonly NoticeLine[];
  readonly open: string;
  /** Ein Antwortfeld — nur, wo ich schreiben darf und der Läufer die Schlüssel öffnen kann. */
  readonly canReply: boolean;
}

export interface FormNews {
  readonly moduleId: string;
  readonly name: string;
  readonly count: number;
  readonly unchanged: boolean;
  /** Die neuesten Einsendungen; `who`: der Name aus den Antworten, `null`, wenn er nicht aufgeht. */
  readonly entries: readonly { readonly id: string; readonly who: string | null; readonly at: string; readonly ms: number }[];
  readonly open: string;
}

export interface LinkNews {
  readonly count: number;
  readonly unchanged: boolean;
  readonly joined: readonly {
    readonly key: string;
    readonly name: string | null;
    readonly label: string | null;
    readonly area: string | null;
    readonly at: string;
    readonly ms: number;
  }[];
  readonly open: string;
}

/** Eine Erinnerung für den Wecker des Telefons. */
export interface ReminderNotice {
  readonly tag: string;
  readonly title: string;
  readonly body: string;
  readonly at: string;
  readonly ms: number;
  readonly open: string;
  readonly taskId: string;
  /** Das Vorkommen für „Zrobione" — `null` bei „nach Ablauf" (dort gibt es keines). */
  readonly occurrenceAt: string | null;
}

export interface News {
  readonly state: 'open' | 'locked';
  /** Warum zu: keine Sitzung, oder der Schlüssel liegt nicht auf diesem Gerät. */
  readonly reason?: 'session' | 'key';
  readonly conversations: readonly Conversation[];
  readonly forms: readonly FormNews[];
  readonly links: LinkNews | null;
  /** `null`: diesmal nicht neu geplant. */
  readonly reminders: readonly ReminderNotice[] | null;
}

export interface GatherOptions {
  /** Seit wann Anmeldungen und Links als neu gelten. */
  readonly since: string;
  /** Was das Telefon schon zeigt: Rozmowa → Zeit ihrer letzten Nachricht. */
  readonly shown?: Readonly<Record<string, string>>;
  readonly formsShown?: Readonly<Record<string, number>>;
  readonly linksShown?: number;
  /** Die offene Rozmowa (Seite vorn) — sie meldet sich nicht. */
  readonly skipChat?: string | null;
  /** Erinnerungen neu planen? */
  readonly reminders?: boolean;
  /** Kann der Läufer antworten (Schlüssel auf dem Gerät)? Sonst kein Antwortfeld. */
  readonly replyable?: boolean;
  readonly settings: { readonly chats: boolean; readonly forms: boolean; readonly links: boolean; readonly reminders: boolean };
}

/* -- Rein, und deshalb geprüft (app-platform-check.mjs) ------------------------- */

/** Höchstens so viele Zeilen je Gespräch — Android zeigt ohnehin nicht mehr. */
export const MAX_LINES = 8;
/** Höchstens so viele Rozmowy auf einmal. */
export const MAX_CHATS = 8;

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** Eine Nachricht als Zeile: Text, sonst was angehängt ist; „Przekazane" davor. */
export function lineText(opened: Opened | null): string {
  if (opened === null) return 'Wiadomość, której to urządzenie nie może otworzyć';
  const text = opened.text.replace(/\s+/g, ' ').trim();
  const files = opened.attachments ?? [];
  let out = text;
  if (out === '' && files.length > 0) {
    const first = files[0];
    const what = first.type.startsWith('image/') ? 'Zdjęcie'
      : first.type.startsWith('audio/') ? 'Wiadomość głosowa'
      : first.type.startsWith('video/') ? 'Film'
      : `Plik: ${first.name}`;
    out = files.length > 1 ? `${what} (+${files.length - 1})` : what;
  } else if (files.length > 0) {
    out = `${out} (załączniki: ${files.length})`;
  }
  if (out === '') out = 'Pusta wiadomość';
  return clip(opened.forwarded === true ? `Przekazane: ${out}` : out, 600);
}

/** Wer in einer Rozmowa spricht: zuerst eine Person, dann eine Rolle — wie die Rozmowa selbst. */
export function pickSpeaker(writers: readonly string[], maySign: (roleId: string) => boolean, kindOf: (roleId: string) => string | undefined): string | null {
  const speakers = writers.filter(maySign);
  return speakers.find((id) => kindOf(id) === 'person') ?? speakers[0] ?? null;
}

/** Die ungelesenen fremden Nachrichten, die neuesten zuletzt — höchstens `MAX_LINES`. */
export function unreadOf(
  messages: readonly SealedMessage[], readAt: string | null, mine: (roleId: string) => boolean, unread: number
): SealedMessage[] {
  const after = readAt === null ? null : Date.parse(readAt);
  const theirs = messages.filter((m) => m.deletedAt === null && !(m.authorRoleId !== null && mine(m.authorRoleId))
    && (after === null || Date.parse(m.createdAt) > after));
  const wanted = Math.max(1, Math.min(MAX_LINES, after === null ? unread : theirs.length));
  return theirs.slice(-wanted);
}

/** Wie das Gespräch heisst: die andere Person, der Mensch vom Formular, sonst der Bereich. */
export function conversationTitle(
  chat: Pick<ChatDetail, 'kind' | 'members' | 'seats'>, row: Pick<DigestChat, 'areaName' | 'seatName'>,
  names: ReadonlyMap<string, string>, mine: (roleId: string) => boolean
): string {
  if (chat.kind === 'self') return 'Notatki';
  if (chat.kind === 'seat') return `Rozmowa z: ${row.seatName ?? chat.seats[0]?.name ?? 'osobą z formularza'}`;
  if (chat.kind === 'direct') {
    const other = chat.members.find((m) => !mine(m.roleId));
    const name = other === undefined ? undefined : names.get(other.roleId);
    if (name !== undefined && name.trim() !== '') return name;
  }
  /* 0080 — der Kanał steht neben der Rozmowa desselben Bereichs. */
  return chat.kind === 'channel' ? `Kanał: ${row.areaName}` : row.areaName;
}

/* -- Öffnen --------------------------------------------------------------------- */

interface Opener {
  readonly who: Who;
  readonly ring: Ring;
  readonly roles: readonly SealedRole[];
}

/** Schlüsselbund und Rollen — oder warum nicht. */
async function opener(who: Who | null): Promise<Opener | 'session' | 'key'> {
  if (who === null) return 'session';
  const { ring, graph } = await keysFor(who);
  if (ring === null) return 'key';
  return { who, ring, roles: graph.roles.filter((r) => r.kind !== 'account' && ring.has(r.id)) };
}

/**
 * 0081 — WER AUF SEINEN SCHLÜSSEL WARTET, bekommt ihn von dieser App: die
 * Glocke nennt die Rozmowy (`waiting`), der Schlüsselbund dieses Geräts
 * verpackt ihn. Ohne offenen Schlüsselbund geschieht nichts — beim nächsten Mal.
 */
export async function handOverWaiting(who: Who, chatIds: readonly string[]): Promise<number> {
  if (chatIds.length === 0) return 0;
  const me = await opener(who);
  if (me === 'session' || me === 'key') return 0;
  return handOver(me.ring, chatIds);
}

const locked = (reason: 'session' | 'key'): News => ({ state: 'locked', reason, conversations: [], forms: [], links: null, reminders: null });

async function conversationOf(me: Opener, row: DigestChat, replyable: boolean, shownAt: string | undefined): Promise<Conversation> {
  const open = viewPath('chat', row.chatId);
  if (shownAt !== undefined && shownAt === row.lastMessageAt) {
    return { chatId: row.chatId, title: '', group: false, unread: row.unread, lastMessageAt: row.lastMessageAt, unchanged: true, lines: [], open, canReply: false };
  }

  const chat = await loadChat(row.chatId);
  let held = await areaKeys(me.ring, chat.areaId);
  let talk = await chatKeysOf(chat.chatId, held);
  const { messages } = await loadMessages(chat.chatId);
  if (messages.some((m) => !talk.has(m.epoch))) {
    held = await areaKeys(me.ring, chat.areaId, true);
    talk = await chatKeysOf(chat.chatId, held);
  }
  const names = await openNames(held, chat.areaId, chat.names);
  const mine = (roleId: string) => me.ring.has(roleId);

  const lines: NoticeLine[] = [];
  for (const message of unreadOf(messages, chat.readAt, mine, row.unread)) {
    const opened = await openMessage(talk, message);
    const author = message.authorSeatId !== null
      ? opened?.name ?? chat.seats.find((one) => one.seatId === message.authorSeatId)?.name ?? 'Osoba z linkiem'
      : names.get(message.authorRoleId ?? '') ?? opened?.name ?? 'Ktoś';
    lines.push({ id: message.messageId, author, text: lineText(opened), at: message.createdAt, ms: Date.parse(message.createdAt), mine: false });
  }

  const kindOf = (roleId: string) => me.roles.find((r) => r.id === roleId)?.kind;
  return {
    chatId: chat.chatId,
    title: conversationTitle(chat, row, names, mine),
    group: chat.kind === 'area' || chat.kind === 'channel' || chat.kind === 'group',
    unread: row.unread,
    lastMessageAt: row.lastMessageAt,
    unchanged: false,
    lines,
    open,
    canReply: replyable && chat.kind !== 'self' && pickSpeaker(chat.writers, (id) => me.ring.maySign(id), kindOf) !== null
  };
}

/** Die neuen Einsendungen eines Formulars, mit dem Namen aus den Antworten, wo er aufgeht. */
async function formOf(me: Opener, row: DigestForm, since: string, shownCount: number | undefined): Promise<FormNews> {
  const open = viewPath('modules', 'form', row.moduleId);
  if (shownCount !== undefined && shownCount === row.count) {
    return { moduleId: row.moduleId, name: row.name, count: row.count, unchanged: true, entries: [], open };
  }

  const after = Date.parse(since);
  const { registrations } = await loadRegistrations(row.moduleId);
  const fresh = registrations
    /* 0077 — nur, was ein Mensch eingesandt hat: was die Kanzlei selbst einträgt, ist für sie keine Neuigkeit. */
    .filter((r) => !r.hidden && r.withdrawnAt === null && r.byOffice !== true && Date.parse(r.submittedAt) > after)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
    .slice(0, 6);

  let named: (submission: Submission) => Promise<string | null> = async () => null;
  try {
    const { fields } = await loadFields(row.moduleId);
    const keys: { privateKey: Uint8Array; officeKey: Uint8Array | undefined }[] = [];
    for (const areaId of [...new Set(fields.map((f) => f.areaId))]) {
      try {
        const intake = await loadIntake(areaId);
        keys.push({
          privateKey: await openIntakeKey(intake, me.ring),
          officeKey: me.ring.has(intake.sealedForRoleId) ? me.ring.keyOf(intake.sealedForRoleId) : undefined
        });
      } catch {
        // Ein Bereich, dessen Annahme ich nicht öffne — dann fehlen nur seine Antworten.
      }
    }
    named = async (submission) => {
      const values = new Map<string, string>();
      for (const key of keys) {
        for (const [id, value] of await openSubmission(submission, key.privateKey, key.officeKey).catch(() => new Map<string, string>())) values.set(id, value);
      }
      return fullNameOf(fields, (fieldId) => values.get(fieldId));
    };
  } catch {
    // Ohne Fragen kein Name — die Meldung steht trotzdem.
  }

  const entries = [];
  for (const one of fresh) entries.push({ id: one.registrationId, who: await named(one).catch(() => null), at: one.submittedAt, ms: Date.parse(one.submittedAt) });
  return { moduleId: row.moduleId, name: row.name, count: row.count, unchanged: false, entries, open };
}

/** Die Namen der Mitglieder eines Bereichs, geöffnet. */
const loadAreaNamesOpened = async (ring: Ring, areaId: string): Promise<ReadonlyMap<string, string>> =>
  openNames(await areaKeys(ring, areaId), areaId, (await loadAreaNames(areaId)).names);

/** Wer seit `since` über einen meiner Links kam — mit dem Namen, den der Bereich trägt. */
async function linksOf(me: Opener, count: number, since: string, shown: number | undefined): Promise<LinkNews | null> {
  if (count === 0) return null;
  const open = viewPath('areas');
  if (shown !== undefined && shown === count) return { count, unchanged: true, joined: [], open };

  const after = Date.parse(since);
  const { invites } = await loadLinks();
  const fresh = invites.flatMap((invite) => invite.redeemed
    .filter((r) => Date.parse(r.at) > after)
    .map((r) => ({ invite, r })))
    .sort((a, b) => Date.parse(b.r.at) - Date.parse(a.r.at))
    .slice(0, 8);

  const namesOf = new Map<string, Promise<ReadonlyMap<string, string>>>();
  const joined = [];
  for (const { invite, r } of fresh) {
    const area = invite.areas[0] ?? null;
    let name: string | null = null;
    if (area !== null) {
      let found = namesOf.get(area.areaId);
      if (found === undefined) {
        found = loadAreaNamesOpened(me.ring, area.areaId).catch(() => new Map<string, string>());
        namesOf.set(area.areaId, found);
      }
      name = (await found).get(r.roleId) ?? null;
    }
    joined.push({ key: `${invite.invitationId}:${r.roleId}:${r.at}`, name, label: invite.label, area: area?.name ?? null, at: r.at, ms: Date.parse(r.at) });
  }
  return { count, unchanged: false, joined, open };
}

const REMINDER_WORD: Record<ReminderKind, string> = {
  start: 'Czas zacząć',
  middle: 'Połowa czasu minęła',
  end: 'Zbliża się koniec'
};

/**
 * DIE ERINNERUNGEN DER NÄCHSTEN SIEBEN TAGE — mit Titel, wenn der Schlüssel
 * offen ist (sonst „Zadanie"; die Zeit stimmt trotzdem).
 */
export async function remindersFor(ring: Ring | null): Promise<ReminderNotice[]> {
  const now = new Date();
  const { tasks } = await loadTasks(new Date(now.getTime() - 86400_000), new Date(now.getTime() + 7 * 86400_000));
  const withReminders = tasks.filter((t) => (t.remind ?? 0) !== 0);
  if (withReminders.length === 0) return [];

  const named = ring === null ? withReminders.map((t) => ({ ...t, title: 'Zadanie', notes: null })) : await openTasks(ring, withReminders);
  const areaName = new Map((await loadAreas().catch(() => ({ areas: [] }))).areas.map((a) => [a.areaId, a.name]));

  return named.flatMap((task) => upcomingReminders(task, now).map((r) => {
    const where = areaName.get(task.areaId);
    return {
      tag: `task:${task.taskId}:${r.occurrenceAt}:${r.kind}`,
      title: task.title,
      body: where === undefined ? REMINDER_WORD[r.kind] : `${REMINDER_WORD[r.kind]} · ${where}`,
      at: r.at.toISOString(),
      ms: r.at.getTime(),
      open: viewPath('tasks'),
      taskId: task.taskId,
      occurrenceAt: task.kind === 'after' ? null : r.occurrenceAt
    };
  })).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(0, 60);
}

/**
 * ALLES NEUE, GEÖFFNET. Die Zahlen kommen vom Dienst (`/workspace/notifications`),
 * die Inhalte versiegelt und werden hier geöffnet. Was das Telefon schon zeigt
 * (`shown`), wird nicht noch einmal geöffnet.
 */
export async function gatherNews(who: Who | null, o: GatherOptions): Promise<News> {
  const me = await opener(who);
  if (me === 'session' || me === 'key') return locked(me);

  const digest = await call<Digest>(`/workspace/notifications?since=${encodeURIComponent(o.since)}`);
  const replyable = o.replyable ?? true;

  const conversations: Conversation[] = [];
  if (o.settings.chats) {
    const loud = digest.chats.list.filter((c) => !c.quiet && c.unread > 0 && c.chatId !== (o.skipChat ?? null)).slice(0, MAX_CHATS);
    for (const row of loud) {
      try {
        conversations.push(await conversationOf(me, row, replyable, o.shown?.[row.chatId]));
      } catch {
        // Eine Rozmowa, die nicht aufgeht, hält die anderen nicht auf.
      }
    }
  }

  const forms: FormNews[] = [];
  if (o.settings.forms) {
    for (const row of digest.registrations.list.slice(0, 6)) {
      try {
        forms.push(await formOf(me, row, o.since, o.formsShown?.[row.moduleId]));
      } catch {
        forms.push({ moduleId: row.moduleId, name: row.name, count: row.count, unchanged: false, entries: [], open: viewPath('modules', 'form', row.moduleId) });
      }
    }
  }

  const links = o.settings.links ? await linksOf(me, digest.links, o.since, o.linksShown).catch(() => null) : null;
  const reminders = o.reminders === true
    ? (o.settings.reminders ? await remindersFor(me.ring).catch(() => null) : [])
    : null;

  return { state: 'open', conversations, forms, links, reminders };
}

/* -- Handeln aus der Meldung -------------------------------------------------------- */

/**
 * ANTWORTEN — versiegelt unter dem Chatschlüssel, unterschrieben von der Rolle,
 * die hier spricht (zuerst die Person). Danach gilt die Rozmowa als gelesen
 * (der Dienst setzt das beim eigenen Schreiben).
 *
 * `messageId` kommt vom Telefon: ein zweiter Versuch (nach einem Abbruch
 * unterwegs) findet die Nachricht schon vor und schickt sie nicht doppelt.
 */
export async function replyIn(
  who: Who | null, chatId: string, text: string, messageId?: string
): Promise<{ messageId: string; at: string; author: string; already?: boolean }> {
  const me = await opener(who);
  if (me === 'session') throw new WorkspaceError('Sesja wygasła — otwórz aplikację i zaloguj się.');
  if (me === 'key') throw new WorkspaceError('Klucz nie jest zachowany na tym urządzeniu — odpowiedz w aplikacji.');
  const body = text.trim();
  if (body === '') throw new WorkspaceError('Pusta odpowiedź.');

  const chat = await loadChat(chatId);
  if (messageId !== undefined) {
    const sent = (await loadMessages(chat.chatId)).messages.find((m) => m.messageId === messageId);
    if (sent !== undefined) return { messageId, at: sent.createdAt, author: 'Ty', already: true };
  }
  const held = await areaKeys(me.ring, chat.areaId, true);
  const talk = await chatKeysOf(chat.chatId, held);
  const as = pickSpeaker(chat.writers, (id) => me.ring.maySign(id), (id) => me.roles.find((r) => r.id === id)?.kind);
  if (as === null) throw new WorkspaceError('W tej rozmowie tylko czytasz.');

  /* Der Name reist mit — für die, die die Namen des Bereichs nicht lesen (0053). */
  const names = await openNames(held, chat.areaId, chat.names);
  const name = names.get(as) ?? (await myRoleNames(me.who).catch(() => new Map<string, string>())).get(as) ?? null;
  const done = await sendMessage(me.ring, chat.chatId, talk, as, body, name, messageId === undefined ? {} : { messageId });
  return { messageId: done.messageId, at: done.createdAt, author: name ?? 'Ty' };
}

/** „Przeczytane" aus der Meldung — dazu braucht es keinen Schlüssel, nur die Sitzung. */
export async function readIn(who: Who | null, chatId: string): Promise<void> {
  if (who === null) throw new WorkspaceError('Sesja wygasła — otwórz aplikację i zaloguj się.');
  await markRead(chatId);
}

/** „Zrobione" aus einer Erinnerung — im Namen meiner Person, wie in der Liste der Zadania. */
export async function doneIn(who: Who | null, taskId: string, occurrenceAt: string | null): Promise<void> {
  if (who === null) throw new WorkspaceError('Sesja wygasła — otwórz aplikację i zaloguj się.');
  const { graph } = await keysFor(who);
  const person = graph.roles.find((r) => r.kind === 'person');
  if (person === undefined) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby.');
  await markDone(taskId, person.id, occurrenceAt ?? undefined);
}
