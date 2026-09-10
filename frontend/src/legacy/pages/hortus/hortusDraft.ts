import type { HortusPlaceView, HortusReservationItemRequest, HortusResourceView } from '../../lib/api';
import { addDays, shortTime, today } from './hortusTime';

/** A row in the basket before it is sent anywhere. */
export interface HortusDraftItem {
  key: string;
  resourceId: string;
  unit: 'night' | 'slot';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  technicalMinutesBefore: number | null;
  technicalMinutesAfter: number | null;
  note: string;
}

let keyCounter = 0;

export function createDraftItem(resource: HortusResourceView, place: HortusPlaceView): HortusDraftItem {
  const unit = resource.bookingUnit === 'night' ? 'night' : 'slot';
  const start = today();
  return {
    key: `draft-${++keyCounter}`,
    resourceId: resource.id,
    unit,
    startDate: start,
    endDate: addDays(start, 1),
    startTime: unit === 'night' ? shortTime(place.checkInTime) : '09:00',
    endTime: unit === 'night' ? shortTime(place.checkOutTime) : '11:00',
    technicalMinutesBefore: null,
    technicalMinutesAfter: null,
    note: ''
  };
}

export function toItemRequest(item: HortusDraftItem): HortusReservationItemRequest {
  return {
    resourceId: item.resourceId,
    unit: item.unit,
    startDate: item.startDate,
    endDate: item.unit === 'night' ? item.endDate : null,
    startTime: item.unit === 'slot' ? item.startTime : null,
    endTime: item.unit === 'slot' ? item.endTime : null,
    technicalMinutesBefore: item.technicalMinutesBefore,
    technicalMinutesAfter: item.technicalMinutesAfter,
    note: item.note.trim() ? item.note.trim() : null
  };
}

/**
 * The instants a draft row would occupy, used to draw it on the timeline before anything is saved.
 * Built from local date parts so drafts line up with the bars already on screen.
 */
export function draftInterval(item: HortusDraftItem, place: HortusPlaceView): { startUtc: string; endUtc: string } | null {
  const parse = (dateInput: string, timeInput: string): Date | null => {
    const [year, month, day] = dateInput.split('-').map(Number);
    const [hour, minute] = timeInput.split(':').map(Number);
    if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
      return null;
    }
    return new Date(year, month - 1, day, hour, minute);
  };

  if (item.unit === 'night') {
    const start = parse(item.startDate, shortTime(place.checkInTime));
    const end = parse(item.endDate, shortTime(place.checkOutTime));
    if (!start || !end || end <= start) return null;
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
  }

  const start = parse(item.startDate, item.startTime);
  if (!start) return null;
  let end = parse(item.startDate, item.endTime);
  if (!end) return null;
  // A slot that ends earlier than it starts runs past midnight, e.g. a vigil from 22:00 to 01:00.
  if (end <= start) {
    end = parse(addDays(item.startDate, 1), item.endTime);
    if (!end) return null;
  }
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export function describeDraft(item: HortusDraftItem, resourceName: string): string {
  return item.unit === 'night'
    ? `${resourceName}: ${item.startDate} → ${item.endDate}`
    : `${resourceName}: ${item.startDate} ${item.startTime}–${item.endTime}`;
}
