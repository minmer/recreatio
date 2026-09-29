/**
 * Der eigene Kalender — die Rechnerei, getrennt vom Zeichnen, damit sie sich
 * prüfen lässt: welche Tage eine Ansicht zeigt, was ein Termin für eine Farbe
 * hat, und wie sich Termine, die sich überschneiden, eine Spalte teilen.
 *
 * <b>Termine und Reservierungen sind hier EIN Ding</b> (`CalEvent`): etwas,
 * das zu einer Zeit ist und Leuten gehört. Woher es kommt, sagt `source` —
 * gezeichnet wird es gleich, bedient verschieden.
 *
 * <b>Aufgaben sind es nicht</b> (0057). Ein Gebet mit einem Fenster von
 * sechs Stunden ist kein Termin, der sechs Stunden dauert: als Kasten im
 * Raster nahm es den Terminen den Platz, und an einem Tag mit fünf Horen
 * bestand die Woche aus Gebetszeiten. Aufgaben sind darum Marken
 * (`TaskMark`): eine schmale Schiene am Rand des Tages, eine Zeile mit dem
 * Stand je Tag — und die Liste zum Abhaken, wenn man sie aufmacht.
 */

import type { AgendaClaim, OpenedItem } from './agenda';
import {
  sameInstant, type AgendaBookings, type AgendaOffer, type BookingResource, type HeldClaim
} from './calendarBookings';
import { addDays, addMonths, firstOfMonth, mondayOf, startOfDay } from './dayMath';
import { afterState, windowState, type OpenTask, type TaskOccurrence, type WindowState } from './tasks';

export type CalView = 'day' | 'week' | 'month' | 'list';

export interface CalEvent {
  readonly key: string;
  /**
   * <code>
   *   item      ein Termin
   *   offer     ein angebotener Termin eines Dings — mit dem, was an ihm hängt
   *   booking   eine frei gewählte Zeit an einem Ding (ein Haus, ein Saal)
   *   claim     meine eigene Reservierung
   * </code>
   */
  readonly source: 'item' | 'offer' | 'booking' | 'claim';
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;

  /** Wer es sieht — daran hängt die Farbe und der Filter. */
  readonly areaId: string;
  readonly cancelled: boolean;

  readonly item?: OpenedItem;
  readonly claim?: AgendaClaim;
  readonly offer?: AgendaOffer;
  readonly booking?: HeldClaim;
  readonly resource?: BookingResource;
}

/** Welche Tage eine Ansicht zeigt. Das Ende ist ausschliesslich. */
export function viewRange(view: CalView, anchor: Date): { from: Date; to: Date } {
  const at = startOfDay(anchor);
  switch (view) {
    case 'day': return { from: at, to: addDays(at, 1) };
    case 'week': return { from: mondayOf(at), to: addDays(mondayOf(at), 7) };
    case 'month': {
      const start = mondayOf(firstOfMonth(at));
      return { from: start, to: addDays(start, 42) };
    }
    case 'list': return { from: at, to: addDays(at, 30) };
  }
}

/** Ein Schritt vor oder zurück: ein Tag, eine Woche, ein Monat, dreissig Tage. */
export function stepView(view: CalView, anchor: Date, direction: 1 | -1): Date {
  switch (view) {
    case 'day': return addDays(startOfDay(anchor), direction);
    case 'week': return addDays(startOfDay(anchor), direction * 7);
    case 'month': return addMonths(anchor, direction);
    case 'list': return addDays(startOfDay(anchor), direction * 30);
  }
}

/**
 * DIE FARBE EINER GRUPPE — aus ihrer Kennung, also immer dieselbe, auf jedem
 * Gerät, ohne dass sie irgendwo gespeichert wäre. Nur der Farbton; Helligkeit
 * und Sättigung setzt das Thema (hell oder dunkel).
 */
export function hueOf(areaId: string): number {
  let hash = 0;
  for (let i = 0; i < areaId.length; i++) hash = (hash * 31 + areaId.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

/**
 * Alles, was zu einer Zeit ist, in eine Liste: Termine, angebotene Termine mit
 * ihren Reservierungen, frei gewählte Zeiten an Dingen, meine eigenen
 * Reservierungen.
 *
 * <b>Ein angebotener Termin ist der Termin selbst</b> — er steht nicht ein
 * zweites Mal da. Heisst er nur „Termin", bekommt er den Namen seines Dings
 * („Spotkanie z księdzem"). Meine eigene Reservierung auf ihm steht nicht
 * doppelt: sie ist schon unter seinen Plätzen.
 */
export function buildEvents(
  items: readonly OpenedItem[], claims: readonly AgendaClaim[], reservations: AgendaBookings
): CalEvent[] {
  const out: CalEvent[] = [];
  const resources = new Map(reservations.resources.map((r) => [r.resourceId, r]));
  const used = new Set<AgendaOffer>();

  for (const one of items) {
    const o = one.occurrence;
    const offer = reservations.offers.find((x) => x.itemId === o.itemId && sameInstant(x.occurrenceAt, o.occurrenceAt));
    const resource = offer === undefined ? undefined : resources.get(offer.resourceId);
    if (offer !== undefined) used.add(offer);

    out.push({
      key: `i:${o.itemId}:${o.occurrenceAt}`,
      source: offer === undefined ? 'item' : 'offer',
      title: !one.named && resource !== undefined ? resource.name : one.title,
      start: new Date(o.startsAt),
      end: new Date(o.endsAt),
      allDay: o.allDay,
      areaId: o.visibilityAreaId,
      cancelled: o.status === 'cancelled',
      item: one,
      offer,
      resource
    });
  }

  /* Angebote in einem Terminarz, den ich nicht halte, aber am Ding lesen darf. */
  for (const offer of reservations.offers) {
    if (used.has(offer)) continue;
    const resource = resources.get(offer.resourceId);
    if (resource === undefined) continue;
    out.push({
      key: `o:${offer.itemId}:${offer.occurrenceAt}`,
      source: 'offer',
      title: resource.name,
      start: new Date(offer.startsAt),
      end: new Date(offer.endsAt),
      allDay: false,
      areaId: resource.areaId,
      cancelled: false,
      offer,
      resource
    });
  }

  for (const { resourceId, claim } of reservations.bookings) {
    const resource = resources.get(resourceId);
    if (resource === undefined) continue;
    out.push({
      key: `b:${claim.claimId}`,
      source: 'booking',
      title: resource.name,
      start: new Date(claim.startsAt),
      end: new Date(claim.endsAt),
      allDay: false,
      areaId: resource.areaId,
      cancelled: false,
      booking: claim,
      resource
    });
  }

  const shown = new Set([
    ...reservations.offers.flatMap((o) => o.claims.map((c) => c.claimId)),
    ...reservations.bookings.map((b) => b.claim.claimId)
  ]);

  for (const claim of claims) {
    if (shown.has(claim.claimId)) continue;
    out.push({
      key: `c:${claim.claimId}`,
      source: 'claim',
      title: claim.resourceName,
      start: new Date(claim.startsAt),
      end: new Date(claim.endsAt),
      allDay: false,
      areaId: claim.areaId,
      cancelled: false,
      claim
    });
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

/* -- Aufgaben: Marken, keine Termine (0057) ------------------------------------------- */

export type TaskState = WindowState | 'due' | 'late';

export interface TaskMark {
  readonly key: string;
  readonly task: OpenTask;
  /** Das Vorkommen eines Fensters — `null` bei „co pewien czas" (after). */
  readonly occurrence: TaskOccurrence | null;
  readonly start: Date;
  /** Ende des Fensters; bei „after" gleich dem Anfang. */
  readonly end: Date;
  readonly state: TaskState;
  readonly areaId: string;
}

/** Erledigt oder abgesagt — dann drängt es nicht mehr. */
export const settled = (mark: TaskMark): boolean => mark.state === 'done' || mark.state === 'skipped';

/** Jetzt dran — offen im Fenster, oder fällig. */
export const pressing = (mark: TaskMark): boolean => mark.state === 'open' || mark.state === 'due';

/** Versäumt — das Fenster ist vorbei, oder es ist überfällig. */
export const behind = (mark: TaskMark): boolean => mark.state === 'missed' || mark.state === 'late';

export function taskMarks(tasks: readonly OpenTask[], now: Date, range: { from: Date; to: Date }): TaskMark[] {
  const out: TaskMark[] = [];

  for (const task of tasks) {
    if (task.kind === 'window') {
      for (const occurrence of task.occurrences) {
        const start = new Date(occurrence.at);
        out.push({
          key: `t:${task.taskId}:${occurrence.at}`,
          task, occurrence, start,
          end: new Date(Math.max(new Date(occurrence.endsAt).getTime(), start.getTime())),
          state: windowState(occurrence, now),
          areaId: task.areaId
        });
      }
    } else {
      const { due, late } = afterState(task, now);
      /* Ist sie überfällig, steht sie HEUTE da — nicht an einem vergangenen Tag, den niemand mehr ansieht. */
      const shown = late && due < startOfDay(now) ? now : due;
      if (shown >= range.from && shown < range.to) {
        out.push({ key: `a:${task.taskId}`, task, occurrence: null, start: shown, end: shown, state: late ? 'late' : 'due', areaId: task.areaId });
      }
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Die Aufgaben EINES Tages — nach ihrem Anfang; ein Fenster über Mitternacht gehört zu dem Tag, an dem es aufgeht. */
export const marksOn = (marks: readonly TaskMark[], day: Date): TaskMark[] => {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();
  return marks.filter((m) => m.start.getTime() >= from && m.start.getTime() < to);
};

/** Der Stand eines Tages, für die Zeile über dem Raster und die Monatszelle. */
export function tally(marks: readonly TaskMark[]): { total: number; settled: number; pressing: number; behind: number } {
  return {
    total: marks.length,
    settled: marks.filter(settled).length,
    pressing: marks.filter(pressing).length,
    behind: marks.filter(behind).length
  };
}

export interface Railed {
  readonly mark: TaskMark;
  /** Minuten ab Mitternacht dieses Tages. */
  readonly top: number;
  readonly height: number;
  readonly lane: number;
}

/** Wie viele Fenster nebeneinander auf der Schiene stehen — mehr passt in ihre Breite nicht. */
export const RAIL_LANES = 3;

/**
 * DIE SCHIENE eines Tages: jedes Fenster ein Strich am Rand, nebeneinander,
 * wenn sie sich überschneiden — höchstens `RAIL_LANES`, dann teilen sie sich
 * einen. Ein Fenster über Mitternacht steht an beiden Tagen, jeweils bis zum Rand.
 */
export function railDay(marks: readonly TaskMark[], day: Date): Railed[] {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();
  const ends: number[] = [];
  const out: Railed[] = [];

  for (const mark of marks) {
    const start = mark.start.getTime();
    const end = Math.max(mark.end.getTime(), start + 20 * 60_000);
    if (end <= from || start >= to) continue;

    const top = (Math.max(start, from) - from) / 60_000;
    const bottom = (Math.min(end, to) - from) / 60_000;

    let lane = ends.findIndex((until) => until <= top);
    if (lane < 0) lane = ends.length < RAIL_LANES ? ends.length : out.length % RAIL_LANES;
    ends[lane] = Math.max(ends[lane] ?? 0, bottom);

    out.push({ mark, top, height: Math.max(bottom - top, 10), lane });
  }

  return out;
}

/** Ob etwas an diesem Tag stattfindet — auch ein Stück eines mehrtägigen. */
export const onDay = (event: CalEvent, day: Date): boolean => {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();
  return event.start.getTime() < to && Math.max(event.end.getTime(), event.start.getTime() + 1) > from;
};

/** Ganztägig — oder so lang, dass es im Tagesraster nichts zu suchen hat (über einen Tag). */
export const wholeDay = (event: CalEvent): boolean =>
  event.allDay || event.end.getTime() - event.start.getTime() >= 24 * 3600_000;

export interface Placed {
  readonly event: CalEvent;
  /** Minuten ab Mitternacht dieses Tages. */
  readonly top: number;
  readonly height: number;
  readonly column: number;
  readonly columns: number;
}

/**
 * WER NEBEN WEM STEHT. Termine eines Tages, die sich überschneiden, bilden
 * eine Gruppe und teilen sich die Breite: jeder bekommt die erste Spalte, in
 * der gerade nichts ist. So bleibt jeder lesbar, und keiner liegt über dem
 * anderen — wie in jedem Kalender, den man kennt.
 */
export function placeDay(events: readonly CalEvent[], day: Date): Placed[] {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();

  const timed = events
    .filter((e) => !wholeDay(e) && onDay(e, day))
    .map((event) => {
      const start = Math.max(event.start.getTime(), from);
      const end = Math.min(Math.max(event.end.getTime(), event.start.getTime() + 15 * 60_000), to);
      return { event, top: (start - from) / 60_000, bottom: Math.max((end - from) / 60_000, (start - from) / 60_000 + 20) };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const placed: Placed[] = [];
  let group: { top: number; bottom: number; column: number }[] = [];
  let groupEnd = -1;

  const flush = () => {
    const columns = Math.max(1, ...group.map((g) => g.column + 1));
    for (let i = placed.length - group.length; i < placed.length; i++) {
      placed[i] = { ...placed[i], columns };
    }
    group = [];
  };

  for (const one of timed) {
    if (one.top >= groupEnd && group.length > 0) flush();
    if (group.length === 0) groupEnd = one.bottom;

    const taken = new Set(group.filter((g) => g.bottom > one.top).map((g) => g.column));
    let column = 0;
    while (taken.has(column)) column++;

    group.push({ top: one.top, bottom: one.bottom, column });
    groupEnd = Math.max(groupEnd, one.bottom);
    placed.push({ event: one.event, top: one.top, height: one.bottom - one.top, column, columns: 1 });
  }
  if (group.length > 0) flush();

  return placed;
}
