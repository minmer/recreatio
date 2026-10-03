/**
 * ROZMOWY (0052) — Chats auf dem Kern der Bereiche.
 *
 * <b>Jeder Chat liegt an einem Bereich, und der Zugang IST der Bereich.</b>
 * Wer den Bereich lesen darf, liest mit; wer darin schreibt, schreibt; wer
 * darin hineinlässt, nimmt Menschen in den Chat. Hier gibt es deshalb keine
 * eigene Mitgliederliste und keine eigenen Schlüssel — nur die Wege, die der
 * Bereich schon hat (`joinArea`, `dropFromArea`), und eine zweite Tür dazu:
 * die Einstellungen des Chats.
 *
 * <code>
 *   area     ein bestehender Bereich bekommt seinen Chat
 *   group    für die Gruppe entsteht hier ein eigener Bereich
 *   direct   zu zweit — zwei Personen oder Rollen, ebenfalls mit Bereich
 *   self     Notatki (0062) — mit sich selbst, im eigenen Bereich der Person
 *   seat     (0069) mit EINEM Menschen vom Formular (einem Platz) — am Bereich
 *            des Platzes, sein Chatschlüssel geht nur an ihn
 * </code>
 *
 * <b>Der Dienst liest keine Nachricht.</b> Sie wird HIER versiegelt und von der
 * Rolle des Verfassers unterschrieben — über genau dieselben Bytes wie
 * `Kernel.MessageVersionRecord` (Version 1). Der Dienst prüft die
 * Unterschrift; fälschen kann er sie nicht.
 *
 * <b>Versiegelt unter dem CHATSCHLÜSSEL (0053)</b>, nicht unter dem des
 * Bereichs: abgeleitet aus dem Epochenschlüssel, je Chat und Epoche. Wer den
 * Bereich hält, rechnet ihn sich aus; der Mensch mit dem Link bekommt NUR ihn
 * (`seatChat.ts`) — unter dem Bereichsschlüssel liegt mehr als der Chat.
 */

import { createArea, joinArea, myEpochKeys, type Member } from './area';
import { I, O, S, type Canon } from './canonical';
import {
  aad, derive, Field, fromBase64Url, KEY_SIZE, openText, sealText, sha256Bytes, signCanonical, toBase64Url,
  wrapKeyP256
} from './crypto';
import type { AudienceForm, AudienceMode } from './audience';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { call, WorkspaceError } from './session';

export type ChatKind = 'area' | 'channel' | 'group' | 'direct' | 'self' | 'seat';

/**
 * 0080 — DIE DREI ZUGÄNGE (`audience.ts`) als Rozmowy eines Bereichs: der
 * Kanał (`channel`), die Rozmowa aller (`area`), die mit einem Menschen
 * (`seat`). Ein Bereich kann Kanał und Rozmowa nebeneinander haben. Gruppen,
 * zu zweit und Notatki haben keine Menschen mit Link.
 */
export const chatMode = (kind: ChatKind): AudienceMode | null =>
  kind === 'channel' ? 'channel' : kind === 'area' ? 'together' : kind === 'seat' ? 'one' : null;

/** Wo Menschen mit Link dabei sind (0053/0069/0080). */
export const hasSeats = (kind: ChatKind): boolean => chatMode(kind) !== null;

/** In der Rozmowa des Bereichs und im Kanał sagt die Art, wer schreibt — keine umstellbare Zasada (0080). */
export const fixedPolicy = (kind: ChatKind): boolean => kind === 'area' || kind === 'channel' || kind === 'self';

export interface ChatMember {
  readonly roleId: string;
  readonly kind: 'account' | 'person' | 'role' | 'group';
  readonly wrapPublicKey: string;
  readonly signPublicKey?: string;
  readonly capabilities: readonly string[];
}

export interface SealedName {
  readonly roleId: string;
  readonly nameSealed: string;
  readonly epoch: number;
}

export interface ChatRow {
  readonly chatId: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly preferences?: import('./chatFeatures').Preferences;
  readonly kind: ChatKind;
  readonly createdAt: string;
  readonly lastMessageAt: string | null;
  readonly unread: number;
  readonly members: readonly ChatMember[];
  readonly names: readonly SealedName[];

  /** 0053 — die Menschen mit Link in der Rozmowa eines Bereichs, und wie viele auf ihren Schlüssel warten. */
  readonly seats: number;
  readonly pendingSeats: number;

  /** 0069 — die Rozmowa mit einem Platz: welcher, und wie die Kanzlei ihn führt. */
  readonly seatId?: string | null;
  readonly seatName?: string | null;

  /** 0080 — die Formulare, deren Menschen in dieser Rozmowa (diesem Kanał) dabei sind. */
  readonly formIds?: readonly string[];
}

/** Ein Mensch mit Link in der Rozmowa seines Bereichs (0053). */
export interface ChatSeat {
  readonly seatId: string;
  readonly name: string | null;

  /** `null`: er hat die Rozmowa noch nie geöffnet — dann ist nichts zu verpacken. */
  readonly wrapPublicKey: string | null;

  /** Für welche Epochen sein Chatschlüssel schon bei ihm ist. */
  readonly epochs: readonly number[];
}

export interface ChatDetail extends Omit<ChatRow, 'unread' | 'seats' | 'pendingSeats' | 'seatName'> {
  readonly postingPolicy: string;
  readonly currentEpoch: number;
  readonly readAt: string | null;

  /** Welche meiner Rollen hier schreiben dürfen — und welche hineinlassen. */
  readonly writers: readonly string[];
  readonly certifiers: readonly string[];

  readonly seats: readonly ChatSeat[];

  /** 0080 — nur in der Rozmowa und im Kanał eines Bereichs; ein alter Dienst schickt sie nicht. */
  readonly forms?: readonly AudienceForm[];
}

export interface SealedMessage {
  readonly messageId: string;

  /** Eine Rolle ODER ein Platz (0053) — genau eines. */
  readonly authorRoleId: string | null;
  readonly authorSeatId: string | null;
  readonly epoch: number;
  readonly bodySealed: string | null;
  readonly createdAt: string;
  readonly deletedAt: string | null;

  /** 0058 — die wievielte Fassung (1: nie bearbeitet), und seit wann bearbeitet. */
  readonly version?: number;
  readonly editedAt?: string | null;

  /** Wer gelöscht hat — davon hängt ab, wer zurückholen darf. */
  readonly deletedBy?: 'author' | 'moderator' | null;

  /** 0068 — zu welchem Thema. */
  readonly topicId?: string | null;
}

/** Eine Fassung aus der Geschichte einer Nachricht (0058). */
export interface SealedVersion {
  readonly version: number;
  readonly epoch: number;
  readonly bodySealed: string;
  readonly signedAt: string;
  readonly createdAt: string;
}

/* -- Der Dienst ------------------------------------------------------------ */

export const loadChats = (): Promise<{ chats: readonly ChatRow[] }> => call('/workspace/chats');

export const loadChat = (chatId: string): Promise<ChatDetail> =>
  call(`/workspace/chat/${encodeURIComponent(chatId)}`);

export const loadMessages = (
  chatId: string, page: { before?: string; after?: string; changed?: string; beforeId?: string; afterId?: string } = {}
): Promise<{ messages: readonly SealedMessage[]; asOf?: string }> => {
  const q = new URLSearchParams();
  if (page.beforeId !== undefined) q.set('beforeId', page.beforeId);
  if (page.afterId !== undefined) q.set('afterId', page.afterId);
  if (page.before !== undefined) q.set('before', page.before);
  if (page.after !== undefined) q.set('after', page.after);
  /* 0059 — was sich an schon gezeigten Nachrichten geändert hat (bearbeitet, gelöscht, zurückgeholt). */
  if (page.changed !== undefined) q.set('changed', page.changed);
  const tail = q.toString();
  return call(`/workspace/chat/${encodeURIComponent(chatId)}/messages${tail === '' ? '' : `?${tail}`}`);
};

export const markRead = (chatId: string): Promise<{ read: boolean }> =>
  call(`/workspace/chat/${encodeURIComponent(chatId)}/read`, { method: 'POST' });

export const deleteMessage = (messageId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/chat/message/${encodeURIComponent(messageId)}/delete`, { method: 'POST' });

/** 0058 — eine gelöschte Nachricht zurückholen (Verfasser, wenn er selbst löschte; wer moderiert). */
export const restoreMessage = (messageId: string): Promise<{ restored: boolean }> =>
  call(`/workspace/chat/message/${encodeURIComponent(messageId)}/restore`, { method: 'POST' });

/** 0058 — alle Fassungen einer Nachricht, versiegelt. */
export const loadVersions = (messageId: string): Promise<{ versions: readonly SealedVersion[] }> =>
  call(`/workspace/chat/message/${encodeURIComponent(messageId)}/versions`);

/**
 * DIE VISITENKARTE zu einem Kod do rozmów — Art und öffentlicher Schlüssel.
 * Damit lässt sich jemand aus einem anderen Konto in den Bereich nehmen.
 */
export const roleCard = (roleId: string): Promise<{ roleId: string; kind: ChatMember['kind']; wrapPublicKey: string }> =>
  call(`/workspace/role/${encodeURIComponent(roleId.trim().toLowerCase())}/card`);

/** Die versiegelten Namen der Mitglieder eines Bereichs — auch ohne Chat. */
export const loadAreaNames = (areaId: string): Promise<{ names: readonly SealedName[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/names`);

/* -- Versiegeln ------------------------------------------------------------ */

/**
 * Das Etikett einer Nachricht — MIT ihrem Verfasser. Schöbe der Dienst eine
 * Nachricht einem anderen unter, ginge sie nicht mehr auf.
 */
const messageAad = (messageId: string, authorId: string) =>
  aad('chat', 'message', `${messageId}.${authorId}`, Field.ChatMessage, 1);

/** Der Chatschlüssel einer Epoche, verpackt für einen Platz. */
export const chatSeatAad = (chatId: string, seatId: string, epoch: number) =>
  aad('chat', 'seat_key', `${chatId}.${seatId}.${epoch}`, Field.ChatSeatKey, 1);

export const authorOf = (message: SealedMessage): string => message.authorRoleId ?? message.authorSeatId ?? '';
const nameAad = (areaId: string, roleId: string) =>
  aad('area', 'member_name', `${areaId}.${roleId}`, Field.AreaMemberName, 1);

/** Die Schlüssel eines Bereichs, einmal je Tab ausgepackt — der RSA-Schritt ist der teure. */
const keyCache = new Map<string, Promise<Map<number, Uint8Array>>>();

/** Bei der Abmeldung: die Schlüssel des einen gehören nicht in die Karte des nächsten. */
export function forgetAreaKeys(): void {
  keyCache.clear();
}

export function areaKeys(ring: Ring, areaId: string, fresh = false): Promise<Map<number, Uint8Array>> {
  let found = fresh ? undefined : keyCache.get(areaId);
  if (found === undefined) {
    found = myEpochKeys(ring, areaId);
    keyCache.set(areaId, found);
    found.catch(() => keyCache.delete(areaId));
  }
  return found;
}

/**
 * DIE CHATSCHLÜSSEL, aus denen des Bereichs abgeleitet — je Epoche einer.
 * Einbahnstrasse: wer nur sie hält, kommt nicht zum Bereich zurück.
 */
export async function chatKeysOf(
  chatId: string, areaKeys: ReadonlyMap<number, Uint8Array>
): Promise<Map<number, Uint8Array>> {
  const out = new Map<number, Uint8Array>();
  for (const [epoch, key] of areaKeys) {
    out.set(epoch, await derive(key, `recreatio:v1:chat:${chatId}:${epoch}`, KEY_SIZE));
  }
  return out;
}

/**
 * WAS IN DER HÜLLE STEHT: der Text, und wie sich der Verfasser nennt. Der
 * Name reist mit, weil nicht jeder die Namen des Bereichs lesen kann — der
 * Mensch mit dem Link hält nur den Chatschlüssel.
 */
export interface Attachment { id: string; name: string; type: string; size: number; key: string; }
export interface MessageExtras { forwarded?: boolean; attachments?: readonly Attachment[]; replyTo?: string; replyText?: string; }
export interface SendOptions extends MessageExtras {
  sendAt?: string;
  /** 0068 — in welches Thema. */
  topicId?: string | null;
  /** 0076 — eine Kennung von aussen (die Antwort aus der Meldung): ein zweiter Versuch schickt nicht doppelt. */
  messageId?: string;
}

export interface Opened extends MessageExtras {
  readonly text: string;
  readonly name: string | null;
}

const encodeBody = (text: string, name: string | null, extras: MessageExtras = {}) => JSON.stringify({ text, name, forwarded: extras.forwarded, attachments: extras.attachments, replyTo: extras.replyTo, replyText: extras.replyText });

function decodeBody(plain: string): Opened {
  try {
    const found = JSON.parse(plain) as { text?: unknown; name?: unknown } & MessageExtras;
    if (typeof found.text === 'string') {
      const attachments = Array.isArray(found.attachments) ? found.attachments.filter((a): a is Attachment =>
        a !== null && typeof a === 'object' && typeof a.id === 'string' && /^[0-9a-f-]{36}$/i.test(a.id)
        && typeof a.name === 'string' && a.name.length <= 512 && typeof a.type === 'string'
        && typeof a.key === 'string' && /^[A-Za-z0-9_-]{43}$/.test(a.key) && typeof a.size === 'number' && a.size >= 0
      ).slice(0, 8) : [];
      return { attachments, forwarded: found.forwarded === true, replyTo: typeof found.replyTo === 'string' ? found.replyTo : undefined,
        replyText: typeof found.replyText === 'string' ? found.replyText.slice(0, 500) : undefined, text: found.text, name: typeof found.name === 'string' && found.name.trim() !== '' ? found.name : null };
    }
  } catch {
    // Kein Umschlag — dann ist es der Text selbst.
  }
  return { text: plain, name: null };
}

/** Eine Nachricht öffnen — `null`, wenn der Schlüssel dieser Epoche fehlt oder sie beschädigt ist. */
export async function openMessage(keys: ReadonlyMap<number, Uint8Array>, message: SealedMessage): Promise<Opened | null> {
  if (message.bodySealed === null) return null;
  const key = keys.get(message.epoch);
  if (key === undefined) return null;
  try {
    return decodeBody(await openText(key, messageAad(message.messageId, authorOf(message)), fromBase64Url(message.bodySealed)));
  } catch {
    return null;
  }
}

/** Die Namen der Mitglieder, geöffnet. */
export async function openNames(
  keys: ReadonlyMap<number, Uint8Array>, areaId: string, names: readonly SealedName[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const one of names) {
    const key = keys.get(one.epoch);
    if (key === undefined) continue;
    try {
      out.set(one.roleId, await openText(key, nameAad(areaId, one.roleId), fromBase64Url(one.nameSealed)));
    } catch {
      // Nicht lesbar — dann steht dort die Art und die halbe Kennung.
    }
  }
  return out;
}

/** Die jüngste Epoche, die ich halte — unter ihr wird geschrieben. */
export function newestKey(keys: ReadonlyMap<number, Uint8Array>): { epoch: number; key: Uint8Array } | null {
  const epochs = [...keys.keys()].sort((a, b) => b - a);
  const epoch = epochs[0];
  return epoch === undefined ? null : { epoch, key: keys.get(epoch)! };
}

/* -- Schreiben ------------------------------------------------------------- */

/**
 * Was unterschrieben wird — Feld für Feld `Kernel.MessageVersionRecord`:
 * nicht der Text, sondern der Abdruck der versiegelten Hülle. So lässt sich
 * die Unterschrift prüfen, ohne den Inhalt zu öffnen.
 */
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

export const versionValue = (v: {
  messageId: string; authorRoleId: string; bodyHash: Uint8Array; createdAt: number; version?: number;
}): Canon => O({
  authorRoleId: S(v.authorRoleId),
  bodyHash: S(hex(v.bodyHash)),
  createdAt: I(v.createdAt),
  id: S(v.messageId),
  messageId: S(v.messageId),
  version: I(v.version ?? 1)
});

/**
 * EINE NEUE FASSUNG versiegeln — dieselbe Nachricht, dieselbe Kennung in der
 * AAD; die Nummer steht in dem, was unterschrieben wird (0058).
 */
export async function sealVersion(
  keys: ReadonlyMap<number, Uint8Array>, messageId: string, authorId: string, text: string, name: string | null, extras: MessageExtras = {}
): Promise<{ epoch: number; sealedBody: Uint8Array; signedAt: number; bodyHash: Uint8Array }> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej rozmowy — nie da się zmienić.');
  const sealedBody = await sealText(newest.key, messageAad(messageId, authorId), encodeBody(text, name, extras));
  return { epoch: newest.epoch, sealedBody, signedAt: Math.floor(Date.now() / 1000), bodyHash: await sha256Bytes(sealedBody) };
}

/** Eine Fassung aus der Geschichte öffnen. */
export async function openVersion(
  keys: ReadonlyMap<number, Uint8Array>, messageId: string, authorId: string, version: SealedVersion
): Promise<Opened | null> {
  const key = keys.get(version.epoch);
  if (key === undefined) return null;
  try {
    return decodeBody(await openText(key, messageAad(messageId, authorId), fromBase64Url(version.bodySealed)));
  } catch {
    return null;
  }
}

/** Die eigene Nachricht bearbeiten — als Fassung `version` (die bisherige + 1). */
export async function editMessage(
  ring: Ring, messageId: string, keys: ReadonlyMap<number, Uint8Array>, authorRoleId: string, text: string,
  name: string | null, version: number, extras: MessageExtras = {}
): Promise<{ version: number; editedAt: string; epoch: number; bodySealed: string }> {
  if (!ring.maySign(authorRoleId)) throw new WorkspaceError('Ta rola nie może tu podpisywać wiadomości.');
  const { epoch, sealedBody, signedAt, bodyHash } = await sealVersion(keys, messageId, authorRoleId, text, name, extras);
  const signature = await signCanonical(await ring.signKey(authorRoleId), versionValue({
    messageId, authorRoleId, bodyHash, createdAt: signedAt, version
  }));
  const done = await call<{ version: number; editedAt: string }>(`/workspace/chat/message/${encodeURIComponent(messageId)}/edit`, {
    method: 'POST',
    body: JSON.stringify({ version, epoch, bodySealed: toBase64Url(sealedBody), signature: toBase64Url(signature), signedAt })
  });
  return { ...done, epoch, bodySealed: toBase64Url(sealedBody) };
}

/** Eine Nachricht versiegeln — unter dem jüngsten Chatschlüssel, mit Verfasser im Etikett. */
export async function sealMessage(
  keys: ReadonlyMap<number, Uint8Array>, authorId: string, text: string, name: string | null, extras: MessageExtras & { messageId?: string } = {}
): Promise<{ messageId: string; epoch: number; sealedBody: Uint8Array; signedAt: number; bodyHash: Uint8Array }> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej rozmowy — nie da się napisać.');

  const messageId = extras.messageId ?? newId();
  const sealedBody = await sealText(newest.key, messageAad(messageId, authorId), encodeBody(text, name, extras));
  return {
    messageId, epoch: newest.epoch, sealedBody,
    signedAt: Math.floor(Date.now() / 1000),
    bodyHash: await sha256Bytes(sealedBody)
  };
}

export async function sendMessage(
  ring: Ring, chatId: string, keys: ReadonlyMap<number, Uint8Array>, authorRoleId: string, text: string,
  name: string | null, options: SendOptions = {}
): Promise<{ messageId: string; createdAt: string; epoch: number }> {
  if (!ring.maySign(authorRoleId)) throw new WorkspaceError('Ta rola nie może tu podpisywać wiadomości.');

  const { messageId, epoch, sealedBody, signedAt, bodyHash } = await sealMessage(keys, authorRoleId, text, name, options);
  const signature = await signCanonical(await ring.signKey(authorRoleId), versionValue({
    messageId, authorRoleId, bodyHash, createdAt: signedAt
  }));

  const done = await call<{ messageId: string; createdAt: string }>(`/workspace/chat/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messageId, authorRoleId, epoch,
      bodySealed: toBase64Url(sealedBody), signature: toBase64Url(signature), signedAt, sendAt: options.sendAt,
      topicId: options.topicId ?? null
    })
  });
  return { ...done, epoch };
}

/* -- Die Menschen mit dem Link (0053) --------------------------------------- */

/**
 * DEN CHATSCHLÜSSEL WEITERGEBEN — an jeden Platz des Bereichs, der die
 * Rozmowa schon einmal geöffnet hat (und damit einen öffentlichen Schlüssel
 * trägt), aber den Schlüssel einer Epoche noch nicht hat.
 *
 * <b>Das tut jedes Mitglied, das den Bereich hält</b>, sobald es die Rozmowa
 * sieht — der Mensch mit dem Link kann niemanden fragen, und der Schlüssel
 * soll nicht davon abhängen, dass die Kanzlei an etwas denkt.
 *
 * Gibt zurück, wie vielen er gegeben wurde.
 */
export async function deliverSeatKeys(
  chat: ChatDetail, areaKeys: ReadonlyMap<number, Uint8Array>, byRoleId: string
): Promise<number> {
  /* 0069 — auch in der Rozmowa mit EINEM Platz: der Dienst nimmt dort nur seinen Schlüssel an. 0080 — und im Kanał. */
  if (!hasSeats(chat.kind)) return 0;

  const mine = await chatKeysOf(chat.chatId, areaKeys);
  const keys: { seatId: string; epoch: number; keyWrapped: string }[] = [];

  for (const seat of chat.seats) {
    if (seat.wrapPublicKey === null) continue;
    for (const [epoch, key] of mine) {
      if (seat.epochs.includes(epoch)) continue;
      try {
        keys.push({
          seatId: seat.seatId, epoch,
          keyWrapped: toBase64Url(await wrapKeyP256(fromBase64Url(seat.wrapPublicKey), chatSeatAad(chat.chatId, seat.seatId, epoch), key))
        });
      } catch {
        // Ein kaputter Schlüssel an einem Platz hält die übrigen nicht auf.
      }
    }
  }

  /* 0080 — ein Kanał mit einem ganzen Formular: der Dienst nimmt höchstens 500 auf einmal. */
  let granted = 0;
  for (let at = 0; at < keys.length; at += 400) {
    const done = await call<{ granted: number }>(`/workspace/chat/${encodeURIComponent(chat.chatId)}/seats`, {
      method: 'POST',
      body: JSON.stringify({ byRoleId, keys: keys.slice(at, at + 400) })
    });
    granted += done.granted;
  }
  return granted;
}

/**
 * Für jede Rozmowa aus der Liste, in der jemand mit Link wartet: nachsehen
 * und weitergeben. Leise — was nicht klappt, klappt beim nächsten Mal.
 */
export async function deliverPending(ring: Ring, chats: readonly ChatRow[]): Promise<void> {
  await handOver(ring, chats.filter((row) => hasSeats(row.kind) && row.pendingSeats > 0).map((row) => row.chatId));
}

/**
 * Welche meiner Rollen den Schlüssel weitergibt — wer schreibt, sonst wer
 * den Bereich liest (im Kanał schreibt nicht jeder, der den Schlüssel hat).
 */
export const keyHolderOf = (chat: ChatDetail, ring: Ring): string | undefined =>
  chat.writers[0] ?? chat.members.find((m) => ring.has(m.roleId) && m.kind !== 'account'
    && (m.capabilities.includes('read') || m.capabilities.includes('write') || m.capabilities.includes('admin')))?.roleId;

/**
 * 0081 — DEN SCHLÜSSEL WEITERGEBEN, ohne die Rozmowa zu öffnen: für die, die
 * die Glocke als wartend meldet (`waiting`), oder die die Liste zeigt. Leise
 * — was nicht klappt, klappt beim nächsten Mal.
 */
export async function handOver(ring: Ring, chatIds: readonly string[]): Promise<number> {
  let granted = 0;
  for (const chatId of chatIds) {
    try {
      const chat = await loadChat(chatId);
      const by = keyHolderOf(chat, ring);
      if (by === undefined) continue;
      granted += await deliverSeatKeys(chat, await areaKeys(ring, chat.areaId), by);
    } catch {
      // Beim nächsten Mal.
    }
  }
  return granted;
}

/** Wie jemand in diesem Bereich heisst — versiegelt, nur für seine Mitglieder lesbar. */
export async function setMemberName(
  areaId: string, keys: ReadonlyMap<number, Uint8Array>, roleId: string, name: string, byRoleId: string
): Promise<void> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru.');

  await call(`/workspace/area/${encodeURIComponent(areaId)}/names`, {
    method: 'POST',
    body: JSON.stringify({
      roleId, byRoleId, epoch: newest.epoch,
      nameSealed: toBase64Url(await sealText(newest.key, nameAad(areaId, roleId), name.trim()))
    })
  });
}

/* -- Anlegen --------------------------------------------------------------- */

/** Wer mit in den Chat soll — eine Rolle mit ihrem öffentlichen Schlüssel, und wie sie heissen soll. */
export interface Invitee {
  readonly roleId: string;
  readonly kind: ChatMember['kind'];
  readonly wrapPublicKey: string;
  readonly name: string;
}

const createChat = (body: {
  chatId: string; areaId: string; kind: ChatKind; asRoleId: string; withRoleId?: string; postingPolicy?: string; seatId?: string;
}) => call<{ chatId: string }>('/workspace/chats', { method: 'POST', body: JSON.stringify(body) });

/**
 * 0069 — DIE ROZMOWA MIT EINEM MENSCHEN VOM FORMULAR. Alle, die ihren Bereich
 * lesen, lesen mit, aber nur ER bekommt ihren Schlüssel — nicht die anderen,
 * die dasselbe Formular ausgefüllt haben. Gibt es sie schon, ist SIE es.
 *
 * 0080 — <b>an welchem Bereich</b>, wählt, wer sie anlegt: an dem seines
 * Platzes, dem des Formulars, einem seiner Fragen — oder einem darüber
 * (etwa „Ksiądz" statt allen, die „Kandydaci" lesen). Je Bereich eine.
 */
export async function startSeatChat(areaId: string, asRoleId: string, seatId: string): Promise<string> {
  const chatId = newId();
  try {
    await createChat({ chatId, areaId, kind: 'seat', asRoleId, seatId, postingPolicy: 'members' });
    return chatId;
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict === 'exists') {
      const had = (await loadChats()).chats.find((c) => c.seatId === seatId && c.areaId === areaId);
      if (had !== undefined) return had.chatId;
    }
    throw e;
  }
}

/**
 * Der Chat eines BESTEHENDEN Bereichs — wer dort schreibt, legt ihn an.
 *
 * 0080 — <b>`channel`</b>: der Kanał (es schreiben die Schreibenden, die
 * anderen lesen), sonst die Rozmowa, in der jeder schreibt. Ein Bereich hat
 * höchstens einen von jedem; gibt es ihn schon, ist ER es.
 */
export async function startAreaChat(areaId: string, asRoleId: string, channel = false): Promise<string> {
  const chatId = newId();
  try {
    await createChat({ chatId, areaId, kind: channel ? 'channel' : 'area', asRoleId, postingPolicy: channel ? 'writers' : 'legacy' });
    return chatId;
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict === 'exists') {
      const had = (await loadChats()).chats.find((c) => c.areaId === areaId && c.kind === (channel ? 'channel' : 'area'));
      if (had !== undefined) return had.chatId;
    }
    throw e;
  }
}


/**
 * 0062 — NOTATKI: die Rozmowa mit sich selbst. Sie liegt im EIGENEN Bereich
 * der Person (`ensurePrivateArea`) — dort ist niemand sonst, und je Person
 * gibt es ihn nur einmal. Hat er schon eine Rozmowa (zwei Fenster, ein
 * Doppelklick), dann ist SIE es.
 */
export async function startSelfChat(areaId: string, personRoleId: string): Promise<string> {
  const chatId = newId();
  try {
    await createChat({ chatId, areaId, kind: 'self', asRoleId: personRoleId, postingPolicy: 'legacy' });
    return chatId;
  } catch (e) {
    const had = (await loadChats().catch(() => ({ chats: [] as readonly ChatRow[] }))).chats.find((c) => c.areaId === areaId);
    if (had !== undefined) return had.chatId;
    throw e;
  }
}

/**
 * Ein Chat MIT EIGENEM BEREICH — für eine Gruppe oder zu zweit.
 *
 * <b>Drei Schritte, und die Reihenfolge ist eine Entscheidung.</b> Erst der
 * Bereich (ich führe ihn), dann die anderen hinein (mit Schlüssel und
 * Zertifikat), dann der Chat — erst dann steht er in ihren Listen, und dann
 * haben sie auch schon den Schlüssel dazu. Zuletzt die Namen, versiegelt.
 */
export async function startOwnChat(ring: Ring, me: { role: SealedRole; name: string }, what: {
  kind: 'group' | 'direct';
  title: string;
  invitees: readonly Invitee[];
  channel?: boolean;
}): Promise<string> {
  if (what.kind === 'direct' && what.invitees.length !== 1) {
    throw new WorkspaceError('Rozmowa we dwoje to dokładnie jedna druga osoba albo rola.');
  }

  const areaName = what.kind === 'direct' ? 'Rozmowa' : what.title.trim();
  if (areaName === '') throw new WorkspaceError('Nazwij rozmowę.');

  const area = await createArea(ring, me.role, areaName);
  const keys = new Map([[area.epoch, area.key]]);
  keyCache.set(area.areaId, Promise.resolve(keys));

  for (const one of what.invitees) {
    const member: Member = { roleId: one.roleId, kind: one.kind, wrapPublicKey: one.wrapPublicKey, capabilities: [] };
    await joinArea(ring, area.areaId, { id: member.roleId, kind: member.kind, wrapPublicKey: member.wrapPublicKey },
      me.role.id, what.channel ? 'read' : 'write');
  }

  const chatId = newId();
  await createChat({
    chatId, areaId: area.areaId, kind: what.kind, asRoleId: me.role.id,
    withRoleId: what.kind === 'direct' ? what.invitees[0].roleId : undefined, postingPolicy: what.channel ? 'writers' : 'legacy'
  });

  await setMemberName(area.areaId, keys, me.role.id, me.name, me.role.id).catch(() => undefined);
  for (const one of what.invitees) {
    if (one.name.trim() !== '') {
      await setMemberName(area.areaId, keys, one.roleId, one.name, me.role.id).catch(() => undefined);
    }
  }

  return chatId;
}

/** Jemanden in den Chat nehmen — das heisst: in seinen Bereich, mit allen Schlüsseln, die ich halte. */
export async function addToChat(
  ring: Ring, chat: ChatDetail, invitee: Invitee, issuerRoleId: string, level: 'read' | 'write' | 'admin' = 'write'
): Promise<void> {
  await joinArea(ring, chat.areaId, { id: invitee.roleId, kind: invitee.kind, wrapPublicKey: invitee.wrapPublicKey },
    issuerRoleId, level);
  if (invitee.name.trim() !== '') {
    const keys = await areaKeys(ring, chat.areaId, true);
    await setMemberName(chat.areaId, keys, invitee.roleId, invitee.name, issuerRoleId).catch(() => undefined);
  }
}

/**
 * Ist die Kennung eine? Ein Kod do rozmów ist die Kennung einer Person oder
 * Rolle — lang, damit ihn niemand errät; kopiert, nicht abgetippt.
 */
export const looksLikeCode = (text: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim());
