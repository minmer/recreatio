/**
 * 0133 — EIN TERMIN EINES BEREICHS, VERÖFFENTLICHT IN EINEM ANDEREN: der Haupttermin
 * eines Wydarzenie (und sein Programm) steht im Kalender des Bereichs, seine Felder
 * (Titel, Ort, Notiz) liegen aber unter dem Schlüssel des Bereichs, in dem er zu sehen
 * ist („Wydarzenia", jawny) — der Dienst erlaubt es, wenn man in beiden schreibt.
 *
 * Dieselbe Anfrage wie der Kalender (`calendar/agenda.ts` → `saveEvent`), nur mit einem
 * anderen Sichtbereich; hier, damit der Kalender selbst davon nichts wissen muss.
 */

import { sealText, toBase64Url } from '../core/crypto';
import type { Ring } from '../core/keys';
import { newId } from '../core/ids';
import { call, WorkspaceError } from '../core/session';
import { itemFieldAad } from '../calendar/calendar';
import { areaKeys, newestKey } from '../chat/chat';

export interface PublishedItem {
  readonly title: string;
  readonly location?: string;
  readonly notes?: string;
  /** Ortszeit: „2026-11-14", „18:00" („00:00" ganztägig). */
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly allDay: boolean;
}

/**
 * Anlegen (ohne `itemId`) oder ändern. `areaId`: der Bereich, in dessen Kalender der
 * Termin steht (ohne Kalender legt der Dienst einen an); `visibilityAreaId`: unter
 * wessen Schlüssel er liegt und wer ihn sieht.
 */
export async function savePublishedItem(ring: Ring, input: {
  readonly areaId: string;
  readonly visibilityAreaId: string;
  readonly ownerRoleId: string;
  readonly item: PublishedItem;
  readonly itemId?: string;
  readonly parentItemId?: string | null;
  readonly position?: number | null;
  /** Beim Ändern der bisherige Status (sonst `planned`). */
  readonly status?: string | null;
  /**
   * Beim Ändern sein Kalender — NÖTIG: ohne ihn zöge der Dienst den Termin in den Kalender
   * des Sichtbereichs um („andere Leute, anderer Terminarz") und er stünde nicht mehr im Bereich.
   */
  readonly calendarId?: string | null;
}): Promise<string> {
  const id = input.itemId ?? newId();
  const newest = newestKey(await areaKeys(ring, input.visibilityAreaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza obszaru, w którym ma być widoczny termin.');

  const seal = async (field: string, text: string) => ({
    field, areaId: input.visibilityAreaId, epoch: newest.epoch,
    sealed: toBase64Url(await sealText(newest.key, itemFieldAad(id, field), text))
  });
  const fields = [await seal('title', input.item.title.trim() || 'Termin')];
  if ((input.item.location ?? '').trim() !== '') fields.push(await seal('location', input.item.location!.trim()));
  if ((input.item.notes ?? '').trim() !== '') fields.push(await seal('notes', input.item.notes!.trim()));

  const body = {
    itemId: id,
    ownerRoleId: input.ownerRoleId,
    visibilityAreaId: input.visibilityAreaId,
    kind: 'appointment',
    calendarId: input.itemId === undefined ? null : input.calendarId ?? null,
    bookable: null,
    capacity: null,
    reserveAreaId: null,
    date: input.item.date,
    time: input.item.allDay ? '00:00' : input.item.time,
    minutes: input.item.minutes,
    allDay: input.item.allDay,
    titlePublic: null,
    status: input.status === 'confirmed' || input.status === 'cancelled' ? input.status : 'planned',
    repeat: 'none',
    every: 1,
    weekdays: null,
    until: null,
    count: null,
    fields,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    parentItemId: input.parentItemId === undefined ? null : input.parentItemId ?? '',
    position: input.position ?? null,
    chatId: null,
    topicId: null
  };

  if (input.itemId === undefined) {
    await call(`/workspace/area/${encodeURIComponent(input.areaId)}/item`, { method: 'POST', body: JSON.stringify(body) });
  } else {
    await call(`/workspace/item/${encodeURIComponent(input.itemId)}`, { method: 'POST', body: JSON.stringify(body) });
  }
  return id;
}

/** „2026-11-14T18:00" + „2026-11-16T14:00" (oder nur Tage) → Tag, Uhrzeit, Minuten, ganztägig. `null`: kein gültiger Beginn. */
export function itemWhen(start: string, end: string | null): Pick<PublishedItem, 'date' | 'time' | 'minutes' | 'allDay'> | null {
  const at = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(start.trim());
  if (at === null) return null;
  const startDay = new Date(`${at[1]}T00:00:00`);
  if (Number.isNaN(startDay.getTime())) return null;
  const allDay = at[2] === undefined;
  const startMinute = allDay ? 0 : Number(at[2]) * 60 + Number(at[3]);
  const time = allDay ? '00:00' : `${at[2]}:${at[3]}`;

  const until = end === null ? null : /^(?:(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?|(\d{2}):(\d{2}))$/.exec(end.trim());
  if (until === null) return { date: at[1], time, minutes: allDay ? 1440 : 120, allDay };
  const endDay = until[1] !== undefined ? new Date(`${until[1]}T00:00:00`) : startDay;
  const days = Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 0) return { date: at[1], time, minutes: allDay ? 1440 : 120, allDay };
  if (allDay) return { date: at[1], time, minutes: (days + 1) * 1440, allDay };
  const endMinute = until[2] !== undefined ? Number(until[2]) * 60 + Number(until[3])
    : until[4] !== undefined ? Number(until[4]) * 60 + Number(until[5]) : startMinute + 120;
  return { date: at[1], time, minutes: Math.max(15, days * 1440 + endMinute - startMinute), allDay };
}
