import type { HortusResourceView } from '../../lib/api';

/** Formatting and date arithmetic shared by the public page and the coordinator panel. */

export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateInput: string, days: number): string {
  const [year, month, day] = dateInput.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return toDateInput(date);
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86400000);
}

export function today(): string {
  return toDateInput(new Date());
}

/**
 * Windows time-zone ids for the zones this place is plausibly in. The server converts its stored
 * id before sending it, but that conversion needs ICU and quietly passes the Windows id through
 * when the host has not got it — and `Intl` throws on those, taking the page down with it.
 */
const WINDOWS_TIME_ZONES: Record<string, string> = {
  'central european standard time': 'Europe/Warsaw',
  'central europe standard time': 'Europe/Budapest',
  'w. europe standard time': 'Europe/Berlin',
  'romance standard time': 'Europe/Paris',
  'gmt standard time': 'Europe/London',
  'e. europe standard time': 'Europe/Chisinau',
  'fle standard time': 'Europe/Kiev',
  'utc': 'UTC'
};

const DEFAULT_TIME_ZONE = 'Europe/Warsaw';
const resolvedTimeZones = new Map<string, string>();

/**
 * Turns whatever the server sent into something `Intl` accepts. Anything unrecognised falls back
 * to the house clock rather than throwing: a wrong-looking hour is a nuisance, a blank page is not.
 */
export function resolveTimeZone(candidate: string | null | undefined): string {
  const raw = candidate?.trim();
  if (!raw) {
    return DEFAULT_TIME_ZONE;
  }

  const cached = resolvedTimeZones.get(raw);
  if (cached) {
    return cached;
  }

  const mapped = WINDOWS_TIME_ZONES[raw.toLowerCase()] ?? raw;
  let resolved = DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('pl-PL', { timeZone: mapped });
    resolved = mapped;
  } catch {
    resolved = DEFAULT_TIME_ZONE;
  }

  resolvedTimeZones.set(raw, resolved);
  return resolved;
}

/**
 * Times are always shown in the clock of the place itself, not of whoever is looking, so a group
 * abroad reads the same hours the coordinator does.
 */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: resolveTimeZone(timeZone)
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    timeZone: resolveTimeZone(timeZone)
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: resolveTimeZone(timeZone)
  }).format(new Date(iso));
}

export function formatDayLabel(dateInput: string): { weekday: string; day: string; isWeekend: boolean } {
  const [year, month, day] = dateInput.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return {
    weekday: new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(date),
    day: `${day}`,
    isWeekend: date.getDay() === 0 || date.getDay() === 6
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return 'brak';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Trims a time value to HH:mm, whether it arrives as 16:00 or 16:00:00. */
export function shortTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export const RESOURCE_KIND_LABELS: Record<string, string> = {
  whole: 'całe miejsce',
  house: 'dom',
  room: 'pokój',
  chapel: 'kaplica',
  dining: 'jadalnia',
  grill: 'grill',
  garden: 'ogród',
  other: 'inne'
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'oczekuje',
  confirmed: 'potwierdzona',
  rejected: 'odrzucona',
  cancelled: 'odwołana'
};

export interface HortusResourceNode extends HortusResourceView {
  depth: number;
}

/**
 * Flattens the resource tree in reading order — a part always follows the part that contains it —
 * so both the picker and the timeline show the place the way somebody walks through it.
 */
export function flattenResources(resources: HortusResourceView[]): HortusResourceNode[] {
  const byParent = new Map<string | null, HortusResourceView[]>();
  for (const resource of resources) {
    const key = resource.parentId ?? null;
    const bucket = byParent.get(key);
    if (bucket) {
      bucket.push(resource);
    } else {
      byParent.set(key, [resource]);
    }
  }

  for (const bucket of byParent.values()) {
    bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pl'));
  }

  const known = new Set(resources.map((resource) => resource.id));
  const result: HortusResourceNode[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const resource of byParent.get(parentId) ?? []) {
      result.push({ ...resource, depth });
      visit(resource.id, depth + 1);
    }
  };

  visit(null, 0);
  // Anything whose parent was filtered out (inactive, say) still deserves a row.
  for (const resource of resources) {
    if (resource.parentId && !known.has(resource.parentId) && !result.some((node) => node.id === resource.id)) {
      result.push({ ...resource, depth: 0 });
    }
  }

  return result;
}

export function bookingUnitLabel(unit: string): string {
  if (unit === 'night') return 'noclegi';
  if (unit === 'slot') return 'godziny';
  return 'noclegi lub godziny';
}
