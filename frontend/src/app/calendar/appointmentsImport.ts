/**
 * 2026-10-24 — DIE TERMINE EINES SEITEN-JSON EINTRAGEN (gelesen von
 * `appointmentsJson.ts`): je Eingang in den gewählten Kalender, Punkte unter
 * ihrem Termin in ihrer Reihenfolge. Getrennt vom Lesen, damit der Editor der
 * Seite den Kalender erst lädt, wenn wirklich eingetragen wird.
 */

import type { CalendarRow } from './calendar';
import { saveEvent, type EventDraft } from './agenda';
import type { AppointmentDoc, AppointmentsPlan } from './appointmentsJson';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';

export interface AppointmentsDone {
  /** Termin („key") → Kennung und Kalender. */
  readonly items: Map<string, { itemId: string; calendarId: string }>;
  /** Eingang → Kalender. */
  readonly calendars: Map<string, string>;
  readonly created: number;
  readonly warnings: string[];
}

/**
 * Die Termine eintragen — je Eingang in den gewählten Kalender, Punkte unter
 * ihrem Termin in ihrer Reihenfolge. Ein Eingang ohne Kalender, ein Termin,
 * der nicht gespeichert werden kann: übersprungen, mit seinem Programm, und
 * gemeldet; der Rest geht weiter.
 */
export async function importAppointments(
  ring: Ring, ownerRoleId: string, plan: AppointmentsPlan, chosen: ReadonlyMap<string, CalendarRow>,
  stage: (what: string) => void
): Promise<AppointmentsDone> {
  const items = new Map<string, { itemId: string; calendarId: string }>();
  const calendars = new Map<string, string>();
  const warnings: string[] = [];
  let created = 0;

  for (const entry of plan.entries) {
    const calendar = chosen.get(entry.key);
    if (calendar !== undefined) calendars.set(entry.key, calendar.calendarId);
    else warnings.push(`Terminy „${entry.label}” pominięte — nie wybrano kalendarza.`);
  }

  const save = async (doc: AppointmentDoc, calendar: CalendarRow, parentItemId: string | null, position: number | null): Promise<void> => {
    const draft: EventDraft = {
      title: doc.title, location: doc.location, notes: doc.notes, link: doc.link, linkLabel: doc.linkLabel,
      areaId: calendar.visibilityAreaId ?? calendar.areaId,
      ownerRoleId,
      date: doc.date, time: doc.time, minutes: doc.minutes, allDay: doc.allDay,
      repeat: doc.repeat, every: doc.every, weekdays: doc.weekdays, until: doc.until, count: null,
      calendarId: calendar.calendarId,
      parentItemId, position
    };
    let itemId: string;
    try {
      stage(`Kalendarz: „${doc.title}”…`);
      itemId = await saveEvent(ring, draft);
    } catch (e) {
      warnings.push(`„${doc.title}” nie trafił do kalendarza: ${e instanceof WorkspaceError ? e.message : 'nie udało się'}${doc.points.length > 0 ? ' (razem z programem)' : ''}.`);
      return;
    }
    created++;
    if (doc.key !== null) items.set(doc.key, { itemId, calendarId: calendar.calendarId });
    for (const [i, point] of doc.points.entries()) await save(point, calendar, itemId, i + 1);
  };

  for (const doc of plan.items) {
    const calendar = chosen.get(doc.entry);
    if (calendar === undefined) continue;
    await save(doc, calendar, null, null);
  }

  return { items, calendars, created, warnings };
}
