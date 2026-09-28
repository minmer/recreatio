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
 * </code>
 *
 * <b>Der Dienst liest keine Nachricht.</b> Sie wird HIER versiegelt, unter dem
 * Epochenschlüssel des Bereichs, und von der Rolle des Verfassers
 * unterschrieben — über genau dieselben Bytes wie `Kernel.MessageVersionRecord`
 * (Version 1). Der Dienst prüft die Unterschrift; fälschen kann er sie nicht.
 */

import { createArea, joinArea, myEpochKeys, type Member } from './area';
import { I, O, S, type Canon } from './canonical';
import {
  aad, Field, fromBase64Url, openText, sealText, sha256Bytes, signCanonical, toBase64Url
} from './crypto';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { call, WorkspaceError } from './session';

export type ChatKind = 'area' | 'group' | 'direct';

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
  readonly kind: ChatKind;
  readonly createdAt: string;
  readonly lastMessageAt: string | null;
  readonly unread: number;
  readonly members: readonly ChatMember[];
  readonly names: readonly SealedName[];
}

export interface ChatDetail extends Omit<ChatRow, 'unread'> {
  readonly currentEpoch: number;
  readonly readAt: string | null;

  /** Welche meiner Rollen hier schreiben dürfen — und welche hineinlassen. */
  readonly writers: readonly string[];
  readonly certifiers: readonly string[];
}

export interface SealedMessage {
  readonly messageId: string;
  readonly authorRoleId: string;
  readonly epoch: number;
  readonly bodySealed: string | null;
  readonly createdAt: string;
  readonly deletedAt: string | null;
}

/* -- Der Dienst ------------------------------------------------------------ */

export const loadChats = (): Promise<{ chats: readonly ChatRow[] }> => call('/workspace/chats');

export const loadChat = (chatId: string): Promise<ChatDetail> =>
  call(`/workspace/chat/${encodeURIComponent(chatId)}`);

export const loadMessages = (
  chatId: string, page: { before?: string; after?: string } = {}
): Promise<{ messages: readonly SealedMessage[] }> => {
  const q = new URLSearchParams();
  if (page.before !== undefined) q.set('before', page.before);
  if (page.after !== undefined) q.set('after', page.after);
  const tail = q.toString();
  return call(`/workspace/chat/${encodeURIComponent(chatId)}/messages${tail === '' ? '' : `?${tail}`}`);
};

export const markRead = (chatId: string): Promise<{ read: boolean }> =>
  call(`/workspace/chat/${encodeURIComponent(chatId)}/read`, { method: 'POST' });

export const deleteMessage = (messageId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/chat/message/${encodeURIComponent(messageId)}/delete`, { method: 'POST' });

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

const messageAad = (messageId: string) => aad('chat', 'message', messageId, Field.ChatMessage, 1);
const nameAad = (areaId: string, roleId: string) =>
  aad('area', 'member_name', `${areaId}.${roleId}`, Field.AreaMemberName, 1);

/** Die Schlüssel eines Bereichs, einmal je Tab ausgepackt — der RSA-Schritt ist der teure. */
const keyCache = new Map<string, Promise<Map<number, Uint8Array>>>();

export function areaKeys(ring: Ring, areaId: string, fresh = false): Promise<Map<number, Uint8Array>> {
  let found = fresh ? undefined : keyCache.get(areaId);
  if (found === undefined) {
    found = myEpochKeys(ring, areaId);
    keyCache.set(areaId, found);
    found.catch(() => keyCache.delete(areaId));
  }
  return found;
}

/** Eine Nachricht öffnen — `null`, wenn der Schlüssel dieser Epoche fehlt oder sie beschädigt ist. */
export async function openMessage(keys: ReadonlyMap<number, Uint8Array>, message: SealedMessage): Promise<string | null> {
  if (message.bodySealed === null) return null;
  const key = keys.get(message.epoch);
  if (key === undefined) return null;
  try {
    return await openText(key, messageAad(message.messageId), fromBase64Url(message.bodySealed));
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

const versionValue = (v: {
  messageId: string; authorRoleId: string; bodyHash: Uint8Array; createdAt: number;
}): Canon => O({
  authorRoleId: S(v.authorRoleId),
  bodyHash: S(hex(v.bodyHash)),
  createdAt: I(v.createdAt),
  id: S(v.messageId),
  messageId: S(v.messageId),
  version: I(1)
});

export async function sendMessage(
  ring: Ring, chatId: string, keys: ReadonlyMap<number, Uint8Array>, authorRoleId: string, text: string
): Promise<{ messageId: string; createdAt: string }> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej rozmowy — nie da się napisać.');
  if (!ring.maySign(authorRoleId)) throw new WorkspaceError('Ta rola nie może tu podpisywać wiadomości.');

  const messageId = newId();
  const sealedBody = await sealText(newest.key, messageAad(messageId), text);
  const signedAt = Math.floor(Date.now() / 1000);
  const signature = await signCanonical(await ring.signKey(authorRoleId), versionValue({
    messageId, authorRoleId, bodyHash: await sha256Bytes(sealedBody), createdAt: signedAt
  }));

  return call(`/workspace/chat/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messageId, authorRoleId, epoch: newest.epoch,
      bodySealed: toBase64Url(sealedBody), signature: toBase64Url(signature), signedAt
    })
  });
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
  chatId: string; areaId: string; kind: ChatKind; asRoleId: string; withRoleId?: string;
}) => call<{ chatId: string }>('/workspace/chats', { method: 'POST', body: JSON.stringify(body) });

/** Der Chat eines BESTEHENDEN Bereichs — wer dort schreibt, legt ihn an. */
export async function startAreaChat(areaId: string, asRoleId: string): Promise<string> {
  const chatId = newId();
  await createChat({ chatId, areaId, kind: 'area', asRoleId });
  return chatId;
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
      me.role.id, 'write');
  }

  const chatId = newId();
  await createChat({
    chatId, areaId: area.areaId, kind: what.kind, asRoleId: me.role.id,
    withRoleId: what.kind === 'direct' ? what.invitees[0].roleId : undefined
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
