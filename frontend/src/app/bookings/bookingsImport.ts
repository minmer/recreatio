/**
 * 2026-10-29 — REZERWACJE ALS JSON, der Teil mit dem Dienst: laden, was der Plan braucht (Dinge, Bereiche,
 * Kalender, die Termine geöffnet, die Reservierungen mit geöffneten Namen), und einen Plan ausführen.
 *
 * <b>Dieselben Wege wie von Hand</b>: Dinge über die der Kanzlei (`createResource`, `updateResource`), ein
 * neuer Kalender wie in den Einstellungen des Kalenders (`addCalendar`), Termine über den jedes Termins
 * (`saveEvent`) — ihre Felder versiegelt hier im Browser unter dem Schlüssel ihres Bereichs. Kein Weg, der
 * offen schickte, was sonst versiegelt geht.
 *
 * <b>Erst noch einmal planen</b>, mit frischem Stand: zwischen Vorschau und Knopf kann die Kanzlei am
 * anderen Rechner etwas geändert haben. Ein Stück, das nicht geht, wird gemeldet — der Rest geht weiter.
 */

import { loadAreas, type AreaRow } from '../areas/area';
import { draftOf, loadAgenda, openAgenda, saveEvent, type AgendaOccurrence, type OpenedItem } from '../calendar/agenda';
import { addCalendar, loadCalendars, type CalendarRow } from '../calendar/calendar';
import { newId } from '../core/ids';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import type { JsonPreview } from '../ui/JsonPanel';
import { EXPORT_DAYS, planBookingsImport, type BookingsOptions, type BookingsState, type SlotState } from './bookingsJson';
import { createResource, loadClaims, loadResources, updateResource } from './resource';

/** Was der Import vom Menschen braucht: den offenen Schlüsselbund, seine Person und Rollen (wie `Me`). */
export type BookingKeys = Pick<Me, 'ring' | 'person' | 'roles'>;

export interface LoadedBookings {
  readonly state: BookingsState;
  /** Für die Wahl des Bereichs neuer Dinge (`AreaPick`). */
  readonly areas: readonly AreaRow[];
  readonly calendars: readonly CalendarRow[];
}

const DAY_MS = 86_400_000;
const mayWrite = (a: AreaRow) => a.myLevel === 'write' || a.myLevel === 'admin';

/** Ging jedes versiegelte Feld auf? Sonst verlöre ein neues Versiegeln das eine, das hier verschlossen blieb. */
const readable = (item: OpenedItem): boolean => item.occurrence.fields.every((f) =>
  f.field === 'title' ? item.named
  : f.field === 'location' ? item.location !== null
  : f.field === 'notes' ? item.notes !== null
  : f.field === 'link' ? item.link !== null
  : f.field === 'link_label' ? item.linkLabel !== null
  : true);

/**
 * ALLES, WAS DER PLAN KENNT — die Dinge, die ich sehe, ihre Termine (Treffen ihres Kalenders, deren Reihe ab
 * gestern noch ein Vorkommen hat; so weit, wie der Dienst Angebote zeigt) und was die Kanzlei an
 * Reservierungen sieht. Ohne den Schlüsselbund gingen die Titel nicht auf — er ist Pflicht.
 */
export async function loadBookings(me: Pick<BookingKeys, 'ring'>): Promise<LoadedBookings> {
  const now = new Date();
  const from = new Date(now.getTime() - DAY_MS);
  /* Der Dienst gibt höchstens 400 Tage auf einmal (`Calendar.MaxWindow`). */
  const to = new Date(from.getTime() + (EXPORT_DAYS - 1) * DAY_MS);

  const [{ resources }, { areas }, { calendars }] = await Promise.all([loadResources(), loadAreas(), loadCalendars()]);

  /* Die Treffen der Kalender, in denen Dinge ihre Termine anbieten — je Termin sein erstes Vorkommen (es trägt die ganze Reihe). */
  const offered = new Set(resources.filter((r) => r.mode === 'offered' && r.calendarId !== null).map((r) => r.calendarId!.toLowerCase()));
  const firsts = new Map<string, AgendaOccurrence>();
  if (offered.size > 0) {
    const { occurrences } = await loadAgenda(from, to);
    for (const one of occurrences) {
      if (one.kind === 'appointment' && offered.has(one.calendarId.toLowerCase()) && !firsts.has(one.itemId)) firsts.set(one.itemId, one);
    }
  }
  const opened = await openAgenda(me.ring, [...firsts.values()], areas);
  const slotsOf = new Map<string, SlotState[]>();
  for (const item of opened) {
    const key = item.occurrence.calendarId.toLowerCase();
    slotsOf.set(key, [...(slotsOf.get(key) ?? []), { itemId: item.occurrence.itemId, draft: draftOf(item), readable: readable(item) }]);
  }
  for (const list of slotsOf.values()) list.sort((a, b) => `${a.draft.date}T${a.draft.time}`.localeCompare(`${b.draft.date}T${b.draft.time}`));

  /* Wer was hält — mit geöffneten Namen; ein Ding, dessen Liste nicht kommt, hat eben keine. */
  const claims = await Promise.all(resources.map((r) => loadClaims(r.resourceId, from, to).then((got) => got.claims, () => [])));

  return {
    state: {
      resources: resources.map((row, i) => ({
        row,
        slots: row.mode === 'offered' && row.calendarId !== null ? slotsOf.get(row.calendarId.toLowerCase()) ?? [] : [],
        claims: claims[i]
      })),
      areas: areas.map((a) => ({ areaId: a.areaId, name: a.name, mayWrite: mayWrite(a) })),
      calendars: calendars.map((c) => ({ calendarId: c.calendarId, areaId: c.areaId, title: c.title })),
      now
    },
    areas,
    calendars
  };
}

const failure = (e: unknown): string =>
  (e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : 'nie udało się').replace(/[.\s]+$/, '');

/** DER IMPORT — noch einmal geplant mit frischem Stand, dann Dinge, Väter, Termine. */
export async function runBookingsImport(input: {
  readonly doc: unknown;
  readonly options: BookingsOptions;
  readonly me: BookingKeys;
  readonly stage: (what: string) => void;
}): Promise<JsonPreview> {
  const { doc, options, me, stage } = input;
  stage('Sprawdzanie…');
  const loaded = await loadBookings(me);
  const plan = planBookingsImport(doc, loaded.state, options);
  if ('error' in plan) throw new WorkspaceError(plan.error);
  if (plan.changes === 0) return { lines: plan.lines, warnings: plan.warnings };

  const lines: string[] = [];
  const warnings: string[] = [...plan.warnings];
  const made = new Map<number, string>();
  const calendarOf = new Map<number, string | null>();

  /* -- 1. Die Dinge — und für ein Ding, das Termine anbietet und keinen Kalender hat, seinen eigenen. -- */
  for (const r of plan.resources) {
    try {
      let calendarId = r.calendarId;
      if (r.newCalendar !== null) {
        stage(`Kalendarz „${r.newCalendar}”…`);
        calendarId = (await addCalendar(r.areaId, r.newCalendar, { itemKind: 'appointment' })).calendarId;
        lines.push(`Utworzono kalendarz „${r.newCalendar}”.`);
      }
      const change = r.newCalendar !== null && calendarId !== null ? { ...r.change, calendarId } : r.change;
      stage(`Zasób „${r.name}”…`);
      if (r.resourceId === null) {
        const row = await createResource(newId(), r.areaId, change);
        made.set(r.index, row.resourceId);
        lines.push(`Utworzono zasób „${r.name}”.`);
      } else {
        if (Object.keys(change).length > 0) {
          await updateResource(r.resourceId, change);
          lines.push(`Zmieniono zasób „${r.name}”.`);
        }
        made.set(r.index, r.resourceId);
      }
      calendarOf.set(r.index, calendarId);
    } catch (e) {
      warnings.push(`Zasób „${r.name}”: ${failure(e)} — pominięty${r.slots.length > 0 ? ' razem z jego terminami' : ''}.`);
    }
  }

  /* -- 2. Väter, die erst mit diesem Import entstanden sind. -- */
  for (const r of plan.resources) {
    if (r.parentLater === null) continue;
    const id = made.get(r.index);
    const parent = made.get(r.parentLater);
    if (id === undefined) continue;
    if (parent === undefined) { warnings.push(`Zasób „${r.name}”: zasób nadrzędny nie powstał — zostaje osobno.`); continue; }
    try {
      await updateResource(id, { parentId: parent });
    } catch (e) {
      warnings.push(`Zasób „${r.name}”: nie udało się umieścić go w nadrzędnym — ${failure(e)}.`);
    }
  }

  /* -- 3. Die Termine — versiegelt wie jeder Termin, unter dem Schlüssel des Bereichs, der sie sieht. -- */
  const calendars = new Map(loaded.calendars.map((c) => [c.calendarId.toLowerCase(), c]));
  const writable = new Set(loaded.areas.filter(mayWrite).map((a) => a.areaId.toLowerCase()));
  const mine = new Set(me.roles.map((role) => role.id.toLowerCase()));
  let created = 0;
  let changed = 0;

  for (const r of plan.resources) {
    if (r.slots.length === 0 || !made.has(r.index)) continue;
    const calendarId = calendarOf.get(r.index) ?? null;
    /* Wer einen neuen Termin sieht: wie der Kalender es für neue vorgibt — wenn ich dort schreibe; sonst der Bereich des Dings. */
    const calendar = calendarId === null ? undefined : calendars.get(calendarId.toLowerCase());
    const preset = calendar?.visibilityAreaId ?? calendar?.areaId ?? r.areaId;
    const seenBy = writable.has(preset.toLowerCase()) ? preset : r.areaId;

    for (const slot of r.slots) {
      stage(`Termin „${slot.label}”…`);
      try {
        if (slot.itemId === null) {
          if (calendarId === null) throw new WorkspaceError('zasób nie ma kalendarza');
          await saveEvent(me.ring, { ...slot.fields, kind: 'appointment', areaId: seenBy, ownerRoleId: me.person.id, calendarId });
          created += 1;
        } else {
          const base = slot.base!;
          /* Der Dienst nimmt nur eine eigene Person oder Rolle als Halter — eine fremde wird zu meiner (wie im Editor). */
          const owner = mine.has(base.ownerRoleId.toLowerCase()) ? base.ownerRoleId : me.person.id;
          /* Die Werte eines Schemas bleiben, wie sie liegen (`values` fehlt) — der Import kennt sie nicht. */
          await saveEvent(me.ring, { ...base, ...slot.fields, ownerRoleId: owner, values: undefined }, slot.itemId);
          changed += 1;
        }
      } catch (e) {
        warnings.push(`Termin „${slot.label}” (zasób „${r.name}”): ${failure(e)}.`);
      }
    }
  }

  if (created > 0) lines.push(`Nowe terminy: ${created}.`);
  if (changed > 0) lines.push(`Zmienione terminy: ${changed}.`);
  if (lines.length === 0) lines.push('Nic nie zostało zapisane — zobacz ostrzeżenia.');
  return { lines, warnings };
}
