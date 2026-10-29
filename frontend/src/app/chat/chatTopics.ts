/**
 * TEMATY W ROZMOWIE (0068) — Fäden in einer Rozmowa, und was daran hängt.
 *
 * Der Titel eines Themas liegt unter dem CHATSCHLÜSSEL (wie die Nachrichten),
 * damit auch der Mensch mit dem Link ihn liest. Aufgaben und Termine, die aus
 * einer Nachricht entstehen, merken sich Rozmowa, Thema und Nachricht
 * (`tasks.ts` `origin`, `agenda.ts` `origin`) — die Rozmowa zeigt sie unter
 * „Zadania i terminy".
 */

import { areaKeys, newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import type { SealedField } from '../calendar/calendar';
import { call, WorkspaceError } from '../core/session';

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

export const closeTopic = (topicId: string, closed: boolean): Promise<{ updated: boolean }> =>
  call(`/workspace/chat/topic/${encodeURIComponent(topicId)}`, { method: 'POST', body: JSON.stringify({ closed }) });

/**
 * 2026-10-29 — EIN THEMA UMBENENNEN (der Import einer Rozmowa, `chatJson.ts`): der neue Titel versiegelt wie
 * beim Anlegen, unter dem jüngsten Chatschlüssel. Darf, wer es angelegt hat oder moderiert — der Dienst prüft.
 */
export async function renameTopic(keys: ReadonlyMap<number, Uint8Array>, topicId: string, title: string): Promise<void> {
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej rozmowy.');
  const name = title.trim();
  if (name === '') throw new WorkspaceError('Nazwij temat.');
  await call(`/workspace/chat/topic/${encodeURIComponent(topicId)}`, {
    method: 'POST',
    body: JSON.stringify({ epoch: newest.epoch, titleSealed: toBase64Url(await sealText(newest.key, topicAad(topicId), name.slice(0, 200))) })
  });
}

/**
 * 0101 — ZUSAMMENTRAGEN: mehrere Nachrichten in EIN Thema (`null`: ohne Thema).
 * `moved`: die eingeordneten; `notYours`: fremde in einer Gruppe — die
 * ordnet, wer moderiert.
 */
export const collectToTopic = (chatId: string, messageIds: readonly string[], topicId: string | null):
  Promise<{ topicId: string | null; moved: readonly string[]; skipped: number; notYours: number }> =>
  call(`/workspace/chat/${encodeURIComponent(chatId)}/topic/collect`, { method: 'POST', body: JSON.stringify({ messageIds, topicId }) });

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

const itemTitleAad = (itemId: string) => aad('calendar', 'item', itemId, Field.CalendarEventTitle, 1);

/**
 * Die Titel dieser Termine — versiegelt unter dem Schlüssel IHRES Bereichs; offen bleibt der öffentliche.
 * 2026-10-29 — eine Stelle für „Zadania i terminy" und den Export der Rozmowa (`ChatJsonDialog`).
 */
export async function openLinked(ring: Ring, rows: readonly LinkedItem[]): Promise<(LinkedItem & { readonly title: string })[]> {
  return Promise.all(rows.map(async (row) => {
    let title = row.titlePublic ?? 'Termin';
    const sealed = row.fields.find((f) => f.field === 'title');
    if (sealed !== undefined) {
      try {
        const key = (await areaKeys(ring, sealed.areaId)).get(sealed.epoch);
        if (key !== undefined) title = await openText(key, itemTitleAad(row.itemId), fromBase64Url(sealed.sealed));
      } catch { /* offener Titel */ }
    }
    return { ...row, title };
  }));
}

/** Der erste Satz einer Nachricht — als Vorschlag für den Titel einer Aufgabe oder eines Termins. */
export function titleFrom(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line;
  return (sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence);
}
