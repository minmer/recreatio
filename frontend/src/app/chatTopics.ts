/**
 * TEMATY W ROZMOWIE (0068) — Fäden in einer Rozmowa, und was daran hängt.
 *
 * Der Titel eines Themas liegt unter dem CHATSCHLÜSSEL (wie die Nachrichten),
 * damit auch der Mensch mit dem Link ihn liest. Aufgaben und Termine, die aus
 * einer Nachricht entstehen, merken sich Rozmowa, Thema und Nachricht
 * (`tasks.ts` `origin`, `agenda.ts` `origin`) — die Rozmowa zeigt sie unter
 * „Zadania i terminy".
 */

import { newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { newId } from './ids';
import type { SealedField } from './calendar';
import { call, WorkspaceError } from './session';

export interface TopicRow {
  readonly topicId: string;
  readonly titleSealed: string;
  readonly epoch: number;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly lastMessageAt: string | null;
  readonly createdByRoleId: string | null;
  readonly createdBySeatId: string | null;
  readonly messages: number;
  readonly tasks: number;
  readonly items: number;
}

export interface Topic extends Omit<TopicRow, 'titleSealed'> {
  readonly title: string;
}

const topicAad = (topicId: string) => aad('chat', 'topic', topicId, Field.TopicTitle, 1);

/** `endpoint`: `chatEndpoint(chatId)` — oder für den Platz `chatEndpoint(chatId, token)`. */
export const loadTopics = (endpoint: string): Promise<{ topics: readonly TopicRow[] }> => call(`${endpoint}/topics`);

export async function openTopics(keys: ReadonlyMap<number, Uint8Array>, rows: readonly TopicRow[]): Promise<Topic[]> {
  const out: Topic[] = [];
  for (const row of rows) {
    let title = 'Temat';
    const key = keys.get(row.epoch);
    if (key !== undefined) {
      try { title = await openText(key, topicAad(row.topicId), fromBase64Url(row.titleSealed)); } catch { /* bleibt „Temat" */ }
    }
    const { titleSealed: _sealed, ...rest } = row;
    out.push({ ...rest, title });
  }
  return out;
}

/** Ein Thema aufmachen — versiegelt unter dem jüngsten Chatschlüssel. `byRoleId`: null für den Platz. */
export async function createTopic(
  endpoint: string, keys: ReadonlyMap<number, Uint8Array>, title: string, byRoleId: string | null
): Promise<string> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej rozmowy.');
  const name = title.trim();
  if (name === '') throw new WorkspaceError('Nazwij temat.');
  const topicId = newId();
  await call(`${endpoint}/topics`, {
    method: 'POST',
    body: JSON.stringify({
      topicId, epoch: newest.epoch, byRoleId,
      titleSealed: toBase64Url(await sealText(newest.key, topicAad(topicId), name.slice(0, 200)))
    })
  });
  return topicId;
}

export async function renameTopic(topicId: string, keys: ReadonlyMap<number, Uint8Array>, title: string): Promise<void> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej rozmowy.');
  await call(`/workspace/chat/topic/${encodeURIComponent(topicId)}`, {
    method: 'POST',
    body: JSON.stringify({ epoch: newest.epoch, titleSealed: toBase64Url(await sealText(newest.key, topicAad(topicId), title.trim().slice(0, 200))) })
  });
}

export const closeTopic = (topicId: string, closed: boolean): Promise<{ updated: boolean }> =>
  call(`/workspace/chat/topic/${encodeURIComponent(topicId)}`, { method: 'POST', body: JSON.stringify({ closed }) });

export const moveToTopic = (messageId: string, topicId: string | null): Promise<{ topicId: string | null }> =>
  call(`/workspace/chat/message/${encodeURIComponent(messageId)}/topic`, { method: 'POST', body: JSON.stringify({ topicId }) });

/** Termine, die aus dieser Rozmowa entstanden — so weit ich ihren Bereich lese. */
export interface LinkedItem {
  readonly itemId: string;
  readonly topicId: string | null;
  readonly calendarId: string;
  readonly parentItemId: string | null;
  readonly kind: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly status: string;
  readonly repeatKind: string;
  readonly titlePublic: string | null;
  readonly visibilityAreaId: string;
  readonly fields: readonly SealedField[];
}

export const loadLinked = (chatId: string): Promise<{ items: readonly LinkedItem[] }> =>
  call(`/workspace/chat/${encodeURIComponent(chatId)}/linked`);

/** Der erste Satz einer Nachricht — als Vorschlag für den Titel einer Aufgabe oder eines Termins. */
export function titleFrom(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line;
  return (sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence);
}
