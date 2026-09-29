/**
 * DER EIGENE KALENDER (0054) — die Browserseite.
 *
 * <b>Ein Termin gehört Leuten, nicht einem Kalender.</b> Wer einträgt, wählt,
 * WER ihn sieht: sich allein („Tylko ja" — der eigene Bereich, beim ersten Mal
 * hier angelegt) oder einen Bereich, in dem er schreibt. Der Terminarz dieses
 * Bereichs entsteht am Dienst von selbst.
 *
 * <b>Titel, Ort und Notiz liegen versiegelt</b> unter dem Schlüssel dieses
 * Bereichs — auch ein privater Titel steht nirgends offen, und der Dienst
 * sieht von einem privaten Termin nur, dass um 18 Uhr etwas ist.
 *
 * Was ich sehe: jeder Termin meiner Bereiche (auch die Messen, wenn ich einen
 * solchen Bereich halte), meine Buchungen, und — aus `tasks.ts` — meine
 * Aufgaben.
 */

import { createArea, loadAreas, type AreaRow } from './area';
import { setOccurrence, type SealedField } from './calendar';
import { areaKeys, newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { call, WorkspaceError } from './session';

export interface Series {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly repeatKind: RepeatKind;
  readonly repeatEvery: number;
  readonly repeatWeekdays: number | null;
  readonly repeatUntil: string | null;
  readonly repeatCount: number | null;
  readonly timeZone: string;
}

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AgendaOccurrence {
  readonly itemId: string;
  readonly calendarId: string;
  /** Der Bereich des Terminarzes. */
  readonly areaId: string;
  readonly ownerRoleId: string;
  readonly kind: string;
  readonly occurrenceAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly status: string;
  readonly titlePublic: string | null;
  readonly visibilityAreaId: string;
  readonly moved: boolean;
  readonly series: Series;
  readonly fields: readonly SealedField[];
}

export interface AgendaClaim {
  readonly claimId: string;
  readonly resourceId: string;
  readonly resourceName: string;
  readonly areaId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
  readonly roleId: string;
}

export const loadAgenda = (from: Date, to: Date): Promise<{ occurrences: readonly AgendaOccurrence[]; claims: readonly AgendaClaim[] }> =>
  call(`/workspace/agenda?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);

/* -- Geöffnet ------------------------------------------------------------------- */

/** Was man hier ändern darf — Messen und Beichten haben ihre eigene Stelle. */
export const OWN_KINDS: readonly string[] = ['appointment', 'visit', 'task'];

const KIND_WORD: Record<string, string> = {
  appointment: 'Termin', task: 'Zadanie', mass: 'Msza', confession: 'Spowiedź', visit: 'Odwiedziny'
};

export interface OpenedItem {
  readonly occurrence: AgendaOccurrence;
  readonly title: string;
  readonly location: string | null;
  readonly notes: string | null;

  /** Darf ich die Reihe ändern? Eigene Art, und Schreibrecht im Bereich des Terminarzes. */
  readonly editable: boolean;

  /** Hat er einen eigenen Titel — oder steht da nur die Art („Termin")? Ein angebotener Termin heisst dann wie sein Ding. */
  readonly named: boolean;
}

const fieldAad = (itemId: string, field: string) =>
  aad('calendar', 'item', itemId,
    field === 'title' ? Field.CalendarEventTitle : field === 'location' ? Field.CalendarEventLocation : Field.CalendarItemNotes, 1);

/**
 * Die Termine aufmachen — jedes Feld mit dem Schlüssel SEINES Bereichs.
 * Was nicht aufgeht, bleibt leer; der Titel fällt dann auf den offenen oder
 * auf die Art zurück („Msza"), damit nichts als leerer Kasten dasteht.
 */
export async function openAgenda(
  ring: Ring, occurrences: readonly AgendaOccurrence[], areas: readonly AreaRow[]
): Promise<OpenedItem[]> {
  const byArea = new Map(areas.map((a) => [a.areaId, a]));
  const opened = new Map<string, { title: string | null; location: string | null; notes: string | null }>();

  for (const one of occurrences) {
    if (opened.has(one.itemId)) continue;
    const found = { title: null as string | null, location: null as string | null, notes: null as string | null };

    for (const field of one.fields) {
      try {
        const key = (await areaKeys(ring, field.areaId)).get(field.epoch);
        if (key === undefined) continue;
        const text = await openText(key, fieldAad(one.itemId, field.field), fromBase64Url(field.sealed));
        if (field.field === 'title') found.title = text;
        else if (field.field === 'location') found.location = text;
        else if (field.field === 'notes') found.notes = text;
      } catch {
        // Nicht lesbar — dann eben ohne.
      }
    }

    opened.set(one.itemId, found);
  }

  return occurrences.map((one) => {
    const fields = opened.get(one.itemId)!;
    const level = byArea.get(one.areaId)?.myLevel ?? null;
    return {
      occurrence: one,
      title: fields.title ?? one.titlePublic ?? KIND_WORD[one.kind] ?? 'Termin',
      named: fields.title !== null || (one.titlePublic ?? '') !== '',
      location: fields.location,
      notes: fields.notes,
      editable: OWN_KINDS.includes(one.kind) && (level === 'write' || level === 'admin')
    };
  });
}

/* -- „Tylko ja" ------------------------------------------------------------------ */

/**
 * DER EIGENE BEREICH — der vorhandene, sonst jetzt angelegt. Zwei Fenster, die
 * es zugleich tun, bekommen denselben: der Dienst behält den ersten.
 */
export async function ensurePrivateArea(ring: Ring, person: SealedRole, areas: readonly AreaRow[]): Promise<string> {
  const had = areas.find((a) => a.personal === true);
  if (had !== undefined) return had.areaId;

  try {
    return (await createArea(ring, person, 'Prywatne', undefined, { personal: true })).areaId;
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict === 'personal-exists') {
      const again = (await loadAreas()).areas.find((a) => a.personal === true);
      if (again !== undefined) return again.areaId;
    }
    throw e;
  }
}

/* -- Eintragen und ändern ---------------------------------------------------------- */

/** Was das Formular hergibt. Datum und Uhrzeit in Ortszeit — „2026-10-04", „18:00". */
export interface EventDraft {
  readonly title: string;
  readonly location: string;
  readonly notes: string;

  /** Wer ihn sieht — ein Bereich; „Tylko ja" ist der eigene. */
  readonly areaId: string;
  readonly ownerRoleId: string;

  readonly date: string;
  readonly time: string;
  /** Wie lange — bei ganztägigen in ganzen Tagen × 1440. */
  readonly minutes: number;
  readonly allDay: boolean;

  readonly repeat: RepeatKind;
  readonly every: number;
  /** pn=1 … nd=64. */
  readonly weekdays: number;
  /** Letzter Tag der Reihe — `null` mit `count`, oder „bez końca" (dann weit voraus). */
  readonly until: string | null;
  readonly count: number | null;
}

/** „Bez końca" — eine Reihe braucht am Dienst ein Ende; zehn Jahre sind im Kalender keins. */
export const forever = (from: Date): string => {
  const at = new Date(from);
  at.setFullYear(at.getFullYear() + 10);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
};

/**
 * Einen Termin speichern — neu (`itemId` fehlt) oder die ganze Reihe eines
 * bestehenden. Die Felder werden HIER versiegelt, unter dem jüngsten
 * Schlüssel des gewählten Bereichs; die Kennung entsteht vorher, weil die AAD
 * sie nennt.
 */
export async function saveEvent(ring: Ring, draft: EventDraft, itemId?: string): Promise<string> {
  const id = itemId ?? newId();
  const newest = newestKey(await areaKeys(ring, draft.areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');

  const seal = async (field: 'title' | 'location' | 'notes', text: string): Promise<SealedField> => ({
    field,
    areaId: draft.areaId,
    epoch: newest.epoch,
    sealed: toBase64Url(await sealText(newest.key, fieldAad(id, field), text))
  });

  const fields: SealedField[] = [await seal('title', draft.title.trim() || 'Termin')];
  if (draft.location.trim() !== '') fields.push(await seal('location', draft.location.trim()));
  if (draft.notes.trim() !== '') fields.push(await seal('notes', draft.notes.trim()));

  const body = {
    itemId: id,
    ownerRoleId: draft.ownerRoleId,
    visibilityAreaId: draft.areaId,
    kind: 'appointment',
    date: draft.date,
    time: draft.allDay ? '00:00' : draft.time,
    minutes: draft.minutes,
    allDay: draft.allDay,
    titlePublic: null,
    status: 'planned',
    repeat: draft.repeat,
    every: draft.every,
    weekdays: draft.repeat === 'weekly' ? draft.weekdays : null,
    until: draft.repeat === 'none' ? null : draft.until,
    count: draft.repeat === 'none' ? null : draft.count,
    fields,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  if (itemId === undefined) {
    await call(`/workspace/area/${encodeURIComponent(draft.areaId)}/item`, { method: 'POST', body: JSON.stringify(body) });
  } else {
    await call(`/workspace/item/${encodeURIComponent(itemId)}`, { method: 'POST', body: JSON.stringify(body) });
  }

  return id;
}

export const deleteEvent = (itemId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/delete`, { method: 'POST' });

/** Nur dieses eine Vorkommen — absagen. */
export const cancelOne = (itemId: string, occurrenceAt: string) =>
  setOccurrence(itemId, occurrenceAt, { cancelled: true });

/** Nur dieses eine Vorkommen — verschieben. */
export const moveOne = (itemId: string, occurrenceAt: string, startsAt: Date) =>
  setOccurrence(itemId, occurrenceAt, { movedTo: startsAt.toISOString() });
