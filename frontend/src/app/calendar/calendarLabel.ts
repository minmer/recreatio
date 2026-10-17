/**
 * Wie ein Kalender heisst, wo man ihn auswählt: „Terminy · Parafia › Schola",
 * der eigene „(tylko ja)".
 *
 * 2026-10-17 — aus `EventDialog.tsx` hierher: der
 * Kalender brauchte nur diese Zeile und lud dafür den ganzen Dialog mit.
 */

import { areaPath, type AreaRow } from '../areas/area';
import type { CalendarRow } from './calendar';

export function calendarLabel(areas: readonly AreaRow[], calendar: CalendarRow): string {
  const area = areas.find((a) => a.areaId === calendar.areaId);
  if (area?.personal === true) return `${calendar.title} (tylko ja)`;
  const group = area !== undefined ? areaPath(areas, area.areaId).full : calendar.areaName;
  return calendar.title === calendar.areaName || calendar.title === group ? group : `${calendar.title} · ${group}`;
}
