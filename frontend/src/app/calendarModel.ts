/**
 * Der eigene Kalender — die Rechnerei, getrennt vom Zeichnen, damit sie sich
 * prüfen lässt: welche Tage eine Ansicht zeigt, was ein Termin für eine Farbe
 * hat, und wie sich Termine, die sich überschneiden, eine Spalte teilen.
 *
 * <b>Termine, Buchungen und Aufgaben sind hier EIN Ding</b> (`CalEvent`):
 * etwas, das zu einer Zeit ist und Leuten gehört. Woher es kommt, sagt
 * `source` — gezeichnet wird es gleich, bedient verschieden.
 */

import type { AgendaClaim, OpenedItem } from './agenda';
import { addDays, addMonths, firstOfMonth, mondayOf, startOfDay } from './dayMath';
import { afterState, windowState, type OpenTask, type TaskOccurrence, type WindowState } from './tasks';

export type CalView = 'day' | 'week' | 'month' | 'list';

export interface CalEvent {
  readonly key: string;
  readonly source: 'item' | 'claim' | 'task';
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;

  /** Wer es sieht — daran hängt die Farbe und der Filter. */
  readonly areaId: string;
  readonly cancelled: boolean;

  readonly item?: OpenedItem;
  readonly claim?: AgendaClaim;
  readonly task?: OpenTask;
  readonly taskOccurrence?: TaskOccurrence;
  readonly taskState?: WindowState | 'due' | 'late';
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

/** Alles in eine Liste: Termine, Buchungen, Aufgaben — jedes mit seiner Zeit. */
export function buildEvents(
  items: readonly OpenedItem[], claims: readonly AgendaClaim[], tasks: readonly OpenTask[], now: Date,
  range: { from: Date; to: Date }
): CalEvent[] {
  const out: CalEvent[] = [];

  for (const one of items) {
    const o = one.occurrence;
    out.push({
      key: `i:${o.itemId}:${o.occurrenceAt}`,
      source: 'item',
      title: one.title,
      start: new Date(o.startsAt),
      end: new Date(o.endsAt),
      allDay: o.allDay,
      areaId: o.visibilityAreaId,
      cancelled: o.status === 'cancelled',
      item: one
    });
  }

  for (const claim of claims) {
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

  for (const task of tasks) {
    if (task.kind === 'window') {
      for (const occ of task.occurrences) {
        const start = new Date(occ.at);
        const end = new Date(Math.max(new Date(occ.endsAt).getTime(), start.getTime() + 15 * 60_000));
        out.push({
          key: `t:${task.taskId}:${occ.at}`,
          source: 'task',
          title: task.title,
          start, end,
          allDay: false,
          areaId: task.areaId,
          cancelled: false,
          task,
          taskOccurrence: occ,
          taskState: windowState(occ, now)
        });
      }
    } else {
      const { due, late } = afterState(task, now);
      /* Ist sie überfällig, steht sie HEUTE da — nicht an einem vergangenen Tag, den niemand mehr ansieht. */
      const shown = late && due < startOfDay(now) ? now : due;
      if (shown >= range.from && shown < range.to) {
        out.push({
          key: `a:${task.taskId}`,
          source: 'task',
          title: task.title,
          start: shown,
          end: new Date(shown.getTime() + 30 * 60_000),
          allDay: false,
          areaId: task.areaId,
          cancelled: false,
          task,
          taskState: late ? 'late' : 'due'
        });
      }
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
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
