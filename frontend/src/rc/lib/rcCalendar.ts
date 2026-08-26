/**
 * Kalender im Browser — Termine, Aufgaben, Wiederholungen.
 *
 * **Zeit ist nicht Inhalt.** WANN jemand belegt ist, kommt im Klartext; WOMIT
 * er belegt ist, kommt versiegelt und geht nur mit dem Schlüssel auf. Das ist
 * kein Verlust an Schutz, sondern die Grenze, die dieses Modul benutzbar
 * macht: freie Zeiten finden, Überschneidungen melden und Wiederholungen
 * ausrechnen geht sonst nicht ohne alles herunterzuladen.
 *
 * **`titlePublic` ist kein entschlüsselter Titel.** Es ist, was andere sehen
 * dürfen — oft nichts. `null` heisst dann nicht „kein Titel", sondern „nur
 * belegt", und die Oberfläche muss das so sagen.
 *
 * Der Dienst rechnet die Wiederholungen aus und liefert VORKOMMEN, keine
 * Regeln. Das ist Absicht: die Sommerzeit ist die Stelle, an der sich
 * Kalender blamieren, und zwei Umsetzungen davon wären zwei Gelegenheiten.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcCalendar = RcApi<'CalendarCalendarSummary'>;
export type RcOccurrence = RcApi<'CalendarOccurrenceView'>;

export const RC_REPEAT_KINDS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export const RC_VISIBILITIES = ['private', 'area', 'public'] as const;
export const RC_TASK_STATES = ['todo', 'doing', 'done', 'cancelled'] as const;

export type RcRepeatKind = (typeof RC_REPEAT_KINDS)[number];
export type RcVisibility = (typeof RC_VISIBILITIES)[number];
export type RcTaskState = (typeof RC_TASK_STATES)[number];

/** Mo=1, Di=2, Mi=4, Do=8, Fr=16, Sa=32, So=64 — dieselbe Maske wie im Kernel. */
export const RC_WEEKDAY_BITS = [1, 2, 4, 8, 16, 32, 64] as const;

// -- Kalender -----------------------------------------------------------------

export const rcCalendars = () =>
  rcFetch<RcApi<'RcCalendarsResponse'>>('/calendars', { withUnlock: true });

export const rcCreateCalendar = (areaId: string, title: string, timeZone?: string) =>
  rcFetch<RcApi<'RcCalendarCreatedResponse'>>('/calendars', {
    body: { areaId, title, timeZone: timeZone ?? null },
    withUnlock: true
  });

// -- Eintraege ----------------------------------------------------------------

export interface RcItemOptions {
  readonly itemType?: 'appointment' | 'task';
  readonly allDay?: boolean;
  readonly titlePublic?: string;
  readonly visibility?: RcVisibility;
  readonly status?: string;
  readonly title?: string;
  readonly location?: string;
  readonly notes?: string;
  readonly repeatKind?: RcRepeatKind;
  readonly repeatEvery?: number;
  readonly repeatWeekdays?: number;
  readonly repeatUntil?: string;
  readonly repeatCount?: number;
  readonly taskState?: RcTaskState;
}

export const rcAddItem = (
  calendarId: string, ownerRoleId: string,
  startsUtc: string, endsUtc: string, options: RcItemOptions = {}
) =>
  rcFetch<RcApi<'RcCalendarItemCreatedResponse'>>(`/calendars/${calendarId}/items`, {
    body: {
      ownerRoleId, startsUtc, endsUtc,
      itemType: options.itemType ?? 'appointment',
      allDay: options.allDay ?? false,
      titlePublic: options.titlePublic ?? null,
      visibility: options.visibility ?? 'private',
      status: options.status ?? 'planned',
      title: options.title ?? null,
      location: options.location ?? null,
      notes: options.notes ?? null,
      repeatKind: options.repeatKind ?? 'none',
      repeatEvery: options.repeatEvery ?? 1,
      repeatWeekdays: options.repeatWeekdays ?? null,
      repeatUntil: options.repeatUntil ?? null,
      repeatCount: options.repeatCount ?? null,
      taskState: options.taskState ?? null
    },
    withUnlock: true
  });

export const rcOccurrences = (calendarId: string, fromUtc: string, toUtc: string) =>
  rcFetch<RcApi<'RcCalendarItemsResponse'>>(
    `/calendars/${calendarId}/items?from=${encodeURIComponent(fromUtc)}&to=${encodeURIComponent(toUtc)}`,
    { withUnlock: true });

/**
 * Ein einzelnes Vorkommen absagen oder verschieben.
 *
 * Angesprochen wird es über seinen URSPRÜNGLICHEN Anfang — das ist sein Name
 * in der Reihe. Er bleibt auch nach einer Verschiebung stehen; verlöre er ihn,
 * liesse sich die Verschiebung nie wieder aufheben.
 */
export const rcCancelOccurrence = (itemId: string, originalStartUtc: string) =>
  rcFetch<RcApi<'RcOccurrenceChangedResponse'>>(
    `/calendar-items/${itemId}/occurrences/${encodeURIComponent(originalStartUtc)}/cancel`,
    { method: 'POST', withUnlock: true });

export const rcMoveOccurrence = (
  itemId: string, originalStartUtc: string, newStartUtc: string, newEndUtc: string
) =>
  rcFetch<RcApi<'RcOccurrenceChangedResponse'>>(
    `/calendar-items/${itemId}/occurrences/${encodeURIComponent(originalStartUtc)}/move`,
    { body: { newStartUtc, newEndUtc }, withUnlock: true });

// -- Was die Oberfläche wissen muss ------------------------------------------

/**
 * Was in der Liste stehen soll.
 *
 * Drei Fälle, und sie dürfen nicht gleich aussehen:
 *
 *   `sealed`  — es gibt einen Inhalt, aber dieser Leser hat den Schlüssel
 *               nicht. Die Zeit steht trotzdem da (15.9).
 *   `busy`    — es gibt keinen öffentlichen Titel. Das ist kein Mangel,
 *               sondern die Aussage: „belegt, mehr geht dich nichts an".
 *   `named`   — es gibt einen Titel, öffentlich oder entschlüsselt.
 */
export type RcOccurrenceLabel =
  | { readonly kind: 'named'; readonly text: string; readonly detailed: boolean }
  | { readonly kind: 'busy' }
  | { readonly kind: 'sealed' };

export function rcOccurrenceLabel(occurrence: RcOccurrence): RcOccurrenceLabel {
  // Der entschlüsselte Titel gewinnt: wer ihn hat, will ihn sehen und nicht
  // die Zusammenfassung, die für andere gedacht war.
  if (occurrence.title !== null && occurrence.title !== undefined && occurrence.title.length > 0) {
    return { kind: 'named', text: occurrence.title, detailed: true };
  }

  if (occurrence.unreadable !== null && occurrence.unreadable !== undefined) {
    // Ein öffentlicher Titel bleibt lesbar, auch wenn der versiegelte Teil
    // zu ist — er war nie verschlüsselt.
    if (occurrence.titlePublic !== null && occurrence.titlePublic !== undefined) {
      return { kind: 'named', text: occurrence.titlePublic, detailed: false };
    }
    return { kind: 'sealed' };
  }

  if (occurrence.titlePublic !== null && occurrence.titlePublic !== undefined
      && occurrence.titlePublic.length > 0) {
    return { kind: 'named', text: occurrence.titlePublic, detailed: false };
  }

  return { kind: 'busy' };
}

/**
 * Vorkommen nach örtlichen Tagen gruppieren.
 *
 * Nach dem Datum des LESERS, nicht nach UTC: eine Abendmesse um 22 Uhr
 * rutscht sonst auf den Folgetag, und der Plan stimmt für niemanden mehr.
 * Die Zeitzone des Kalenders kommt mit der Antwort — wer in einer anderen
 * anzeigt, trifft damit eine eigene Entscheidung und soll das wissen.
 */
export function rcByDay(
  occurrences: readonly RcOccurrence[],
  lang: string,
  timeZone?: string
): readonly (readonly [string, readonly RcOccurrence[]])[] {
  const days = new Map<string, RcOccurrence[]>();

  const format: Intl.DateTimeFormatOptions = {
    weekday: 'long', day: 'numeric', month: 'long'
  };
  if (timeZone !== undefined) format.timeZone = timeZone;

  for (const occurrence of occurrences) {
    let day: string;
    try {
      day = new Date(occurrence.startsUtc).toLocaleDateString(lang, format);
    } catch {
      // Eine Zeitzone, die dieser Browser nicht kennt, darf den Kalender nicht
      // leer erscheinen lassen. Dann eben ohne — sichtbar anders ist besser
      // als gar nichts.
      day = new Date(occurrence.startsUtc).toLocaleDateString(lang,
        { weekday: 'long', day: 'numeric', month: 'long' });
    }

    const list = days.get(day);
    if (list === undefined) days.set(day, [occurrence]);
    else list.push(occurrence);
  }

  return [...days];
}

/**
 * Überschneidungen finden — der Grund, warum die Zeiten im Klartext liegen.
 *
 * Zwei Vorkommen überschneiden sich, wenn eines beginnt, bevor das andere
 * endet. Ganztägige zählen nicht mit: „den ganzen Tag Urlaub" und „um zehn ein
 * Termin" ist kein Konflikt, sondern der Normalfall.
 */
export function rcOverlaps(
  occurrences: readonly RcOccurrence[]
): readonly (readonly [RcOccurrence, RcOccurrence])[] {
  const timed = occurrences
    .filter((o) => !o.allDay && o.status !== 'cancelled')
    .slice()
    .sort((a, b) => rcInstant(a.startsUtc) - rcInstant(b.startsUtc));

  const found: (readonly [RcOccurrence, RcOccurrence])[] = [];

  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      // Sortiert: sobald der nächste erst nach dem Ende beginnt, kann keiner
      // der folgenden mehr überschneiden.
      if (rcInstant(timed[j].startsUtc) >= rcInstant(timed[i].endsUtc)) break;
      found.push([timed[i], timed[j]]);
    }
  }

  return found;
}

/**
 * Ein Zeitstempel als Zahl.
 *
 * **Zeitstempel werden NICHT als Zeichenketten verglichen.** Derselbe
 * Augenblick sieht je nach Absender anders aus: der Dienst schreibt
 * `2026-03-02T08:00:00+00:00`, JavaScript schreibt
 * `2026-03-02T08:00:00.000Z`. Als Text sind das zwei verschiedene Dinge, als
 * Augenblick derselbe.
 *
 * Aufgefallen ist das erst im Durchgang gegen den laufenden Dienst — die
 * Prüfungen mit gebauten Daten liefen grün, weil dort beide Seiten dasselbe
 * Format hatten. Genau dafür gibt es den Durchgang.
 */
export function rcInstant(iso: string): number {
  return new Date(iso).getTime();
}

/** Zwei Zeitstempel bezeichnen denselben Augenblick, egal wie sie geschrieben sind. */
export function rcSameInstant(a: string, b: string): boolean {
  return rcInstant(a) === rcInstant(b);
}
