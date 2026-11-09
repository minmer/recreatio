/**
 * 2026-10-29 — REZERWACJE ALS JSON ("recreatio/bookings", Fassung 1): die Dinge (0039) mit ihren Regeln
 * und ihren angebotenen Terminen hinaus und herein — und, nur hinaus, was die Kanzlei an Reservierungen
 * sieht. Wie jedes JSON der App (`ui/JsonPanel.tsx`, `core/jsonTree.ts`): Export, Vorschau mit Warnungen,
 * erst dann der Import; daneben die Beschreibung, aus der auch der Katalog des MCP-Servers entsteht.
 *
 * <code>
 *   mit "id" (aus dem Export)   Ding oder Termin wird AN ORT UND STELLE geändert — nur, was das Dokument nennt
 *   ohne "id"                    neu (ein neues Ding "offered" ohne "calendar" bekommt einen eigenen Kalender)
 *   "claims"                     nur hinaus — ein Import ändert keine Reservierung eines anderen Menschen
 * </code>
 *
 * Gelöscht wird nichts. <b>Rein</b>: kein Dienst, kein Schlüssel — gelesen, geplant und beschrieben wird
 * hier; geladen und gespeichert in `bookingsImport.ts` (die Felder der Termine versiegelt wie bei jedem
 * Termin, `saveEvent`).
 *
 * <b>Ob etwas passt, entscheidet der Dienst</b> (`Bookings.JudgeOffer`, `Busiest`) — bei jeder Reservierung,
 * nicht hier. Die Vorschau zählt nur, was an einem geänderten Termin schon hängt, und sagt es.
 */

import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { t } from '../core/i18n';
import type { EventDraft, RepeatKind } from '../calendar/agenda';
import { KIND_LABEL, type Kind, type Mode, type OfficeClaim, type ResourceChange, type ResourceRow } from './resource';

export const BOOKINGS_FORMAT = 'recreatio/bookings';
export const BOOKINGS_VERSION = 1;

/** Höchstens so viele Dinge und Termine je Dokument — mehr ist ein Umzug, kein Import zum Durchsehen. */
export const MAX_RESOURCES = 200;
export const MAX_SLOTS = 1000;

/** So weit reicht der Export: so weit, wie der Dienst Angebote zeigt (`OffersAsync`, 400 Tage). */
export const EXPORT_DAYS = 400;

/* Wie im Dienst (`Bookings.MaxName`, `Calendar.ItemRulesAsync`) und im Editor eines Termins. */
const MAX_NAME = 200;
const MAX_TITLE = 200;
const MAX_LOCATION = 300;
const MAX_NOTES = 4000;
const MAX_LINK = 1000;
const MAX_LINK_LABEL = 60;
const MAX_CAPACITY = 10000;

const KINDS: readonly Kind[] = ['person', 'room', 'house', 'place', 'other'];
const MODES: readonly Mode[] = ['offered', 'open'];
const APPROVALS = ['none', 'office'] as const;
const REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
/** Dieselben Wörter wie im JSON der Termine einer Seite (`appointmentsJson.ts`): pn = Bit 0 … nd = Bit 6. */
const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const; // i18n-ignore — Wörter des Formats

/* -- Was der Plan kennt ----------------------------------------------------------------------------- */

/** Ein Termin im Kalender eines Dings — geöffnet, so wie er gespeichert ist (`draftOf`). */
export interface SlotState {
  readonly itemId: string;
  readonly draft: EventDraft;
  /**
   * `false`: ein versiegeltes Feld ging hier nicht auf (kein Schlüssel dafür). Ihn zu ändern hiesse, alle
   * Felder neu zu versiegeln — und das eine leer: dann ändert der Import ihn nicht.
   */
  readonly readable?: boolean;
}

export interface ResourceState {
  readonly row: ResourceRow;
  /** Nur "offered": die Treffen seines Kalenders, deren Reihe ab gestern noch ein Vorkommen hat. */
  readonly slots: readonly SlotState[];
  /** Was die Kanzlei an Reservierungen sieht (Namen geöffnet) — für den Export und die Warnungen. */
  readonly claims: readonly OfficeClaim[];
}

export interface AreaState {
  readonly areaId: string;
  readonly name: string;
  readonly mayWrite: boolean;
}

export interface CalendarState {
  readonly calendarId: string;
  readonly areaId: string;
  readonly title: string;
}

export interface BookingsState {
  readonly resources: readonly ResourceState[];
  readonly areas: readonly AreaState[];
  readonly calendars: readonly CalendarState[];
  /** Jetzt — was noch kommt, zählt (in den Prüfungen fest). */
  readonly now: Date;
}

export interface BookingsOptions {
  /** Wohin ein neues Ding ohne "area" geht — beim Import gewählt. */
  readonly areaId?: string | null;
}

/** Ein Termin, wie er nach dem Import ist — vollständig, über dem gespeicherten. */
export interface SlotFields {
  readonly title: string;
  readonly location: string;
  readonly notes: string;
  readonly link: string;
  readonly linkLabel: string;
  /** Ortszeit — „2026-11-03", „17:00" („00:00" ganztägig). */
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly allDay: boolean;
  readonly repeat: RepeatKind;
  readonly every: number;
  /** pn = 1 … nd = 64 (nur "weekly"). */
  readonly weekdays: number;
  readonly until: string | null;
  readonly count: number | null;
  readonly bookable: boolean | null;
  readonly capacity: number | null;
  readonly reserveAreaId: string | null;
}

export interface PlannedSlot {
  /** `null`: neu im Kalender des Dings. */
  readonly itemId: string | null;
  /** Der gespeicherte Termin, über den sich die Änderung legt (`null` bei einem neuen). */
  readonly base: EventDraft | null;
  readonly fields: SlotFields;
  readonly label: string;
}

export interface PlannedResource {
  /** Die Stelle im Dokument — ein neues Ding wird über sie zum Vater eines anderen. */
  readonly index: number;
  /** `null`: neu. */
  readonly resourceId: string | null;
  readonly areaId: string;
  readonly name: string;
  /** Was sich ändert (bei einem neuen: alles) — ohne `calendarId` eines neuen Kalenders, ohne Vater aus diesem Import. */
  readonly change: ResourceChange;
  /** Der Vater entsteht erst mit diesem Import — seine Stelle im Dokument. */
  readonly parentLater: number | null;
  /** Ein neuer Kalender für die Termine — sein Name. */
  readonly newCalendar: string | null;
  /** Der Kalender der Termine danach (ein bestehender) — `null` mit `newCalendar` oder ohne Termine. */
  readonly calendarId: string | null;
  readonly slots: readonly PlannedSlot[];
}

export interface BookingsPlan {
  /** Nur, was etwas zu tun hat — in der Reihenfolge des Dokuments. */
  readonly resources: readonly PlannedResource[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  /** Wie viele Dinge, Kalender und Termine angelegt oder geändert werden — 0: nichts zu tun. */
  readonly changes: number;
}

/* -- Kleinkram -------------------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const AT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/;
const CLOCK = /^(\d{1,2}):(\d{2})$/;

const two = (n: number): string => String(n).padStart(2, '0');
const dayText = (d: Date): string => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const clock = (minutes: number): string => `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
/** Ein Augenblick in Ortszeit — „2026-11-03T17:00". */
const localAt = (at: Date): string => `${dayText(at)}T${clock(at.getHours() * 60 + at.getMinutes())}`;

/** Ein Tag, den es gibt („2026-02-30" gibt es nicht). */
function validDay(y: number, m: number, d: number): Date | null {
  const at = new Date(y, m - 1, d);
  return at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d ? at : null;
}

const dayOf = (text: string): Date | null => {
  const m = DAY.exec(text);
  return m === null ? null : validDay(Number(m[1]), Number(m[2]), Number(m[3]));
};

const minuteOf = (time: string): number => {
  const m = CLOCK.exec(time);
  return m === null ? 0 : Number(m[1]) * 60 + Number(m[2]);
};

/** Die Wanduhr eines Tages — auch an den Tagen der Zeitumstellung die Stunde, die man liest. */
const wall = (day: Date, minute: number): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60);

const plusDays = (day: Date, n: number): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
const daysBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / 86_400_000);

interface When { readonly day: Date; readonly minute: number | null }

/** „2026-11-03T17:00", „2026-11-03" — oder, mit einem Tag, „17:40" an ihm. */
function readWhen(value: unknown, sameDay: Date | null): When | null {
  const text = typeof value === 'string' ? value.trim() : '';
  let m = AT.exec(text);
  if (m !== null) {
    const day = validDay(Number(m[1]), Number(m[2]), Number(m[3]));
    const h = Number(m[4]), min = Number(m[5]);
    return day === null || h > 23 || min > 59 ? null : { day, minute: h * 60 + min };
  }
  const day = dayOf(text);
  if (day !== null) return { day, minute: null };
  m = CLOCK.exec(text);
  if (m !== null && sameDay !== null) {
    const h = Number(m[1]), min = Number(m[2]);
    return h > 23 || min > 59 ? null : { day: sameDay, minute: h * 60 + min };
  }
  return null;
}

const weekdayBit = (day: Date): number => 1 << ((day.getDay() + 6) % 7);
const weekdayWords = (mask: number): string[] => WEEKDAY_WORDS.filter((_, i) => (mask & (1 << i)) !== 0);
const weekdayWord = (day: Date): string => WEEKDAY_WORDS[(day.getDay() + 6) % 7];

/** Ganze Zahlen — auch als Text („3"), wie sie eine KI gern schreibt. */
function intOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

const lower = (text: string): string => text.trim().toLowerCase();
const quote = (text: string): string => t('bookings.plan.quote', { text });

/** Sätze, die erst beim Lesen übersetzt werden (Sprache der Anwendung zu diesem Zeitpunkt). */
const lazy = (entries: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [k, read] of Object.entries(entries)) Object.defineProperty(out, k, { get: read, enumerable: true });
  return out;
};

/* -- Die Gestalt eines Termins ---------------------------------------------------------------------- */

/** Ein gespeicherter Termin, wie der Plan ihn vergleicht — jede Grösse an genau einer Stelle. */
export function slotFieldsOf(d: EventDraft): SlotFields {
  return normalise({
    title: d.title, location: d.location, notes: d.notes, link: d.link ?? '', linkLabel: d.linkLabel ?? '',
    date: d.date, time: d.time, minutes: d.minutes, allDay: d.allDay,
    repeat: d.repeat, every: d.every, weekdays: d.weekdays, until: d.until, count: d.count,
    bookable: d.bookable ?? null, capacity: d.capacity ?? null, reserveAreaId: d.reserveAreaId ?? null
  });
}

/** Was ohne Bedeutung ist, fällt auf einen festen Wert — sonst sähe ein unveränderter Termin geändert aus. */
function normalise(f: SlotFields): SlotFields {
  const once = f.repeat === 'none';
  return {
    ...f,
    title: f.title.trim(), location: f.location.trim(), notes: f.notes.trim(), link: f.link.trim(),
    linkLabel: f.link.trim() === '' ? '' : f.linkLabel.trim(),
    time: f.allDay ? '00:00' : f.time,
    every: once ? 1 : f.every,
    weekdays: f.repeat === 'weekly' ? f.weekdays : 0,
    until: once ? null : f.until,
    count: once ? null : f.count,
    reserveAreaId: f.reserveAreaId === null ? null : lower(f.reserveAreaId)
  };
}

const TIMING: readonly (keyof SlotFields)[] = ['date', 'time', 'minutes', 'allDay', 'repeat', 'every', 'weekdays', 'until', 'count'];
const SLOT_FIELDS: readonly (keyof SlotFields)[] = [
  'title', 'location', 'notes', 'link', 'linkLabel', ...TIMING, 'bookable', 'capacity', 'reserveAreaId'
];

const changedKeys = (a: SlotFields, b: SlotFields): (keyof SlotFields)[] => SLOT_FIELDS.filter((k) => a[k] !== b[k]);

/** Das Ende als Text: „17:40" am selben Tag, sonst ganz; ganztägig der letzte Tag (bei einem Tag keiner). */
function endText(f: SlotFields): string | null {
  const day = dayOf(f.date);
  if (day === null) return null;
  if (f.allDay) {
    const days = Math.max(1, Math.round(f.minutes / 1440));
    return days <= 1 ? null : dayText(plusDays(day, days - 1));
  }
  const end = new Date(wall(day, minuteOf(f.time)).getTime() + f.minutes * 60_000);
  return dayText(end) === f.date ? clock(end.getHours() * 60 + end.getMinutes()) : localAt(end);
}

/** „2026-11-03 (wt) 17:00–17:40, co tydzień (wt) do 2026-12-15" — ohne Sprache des Browsers, überall gleich. */
export function slotWhen(f: SlotFields): string {
  const day = dayOf(f.date);
  if (day === null) return f.date;
  const end = endText(f);
  const at = f.allDay
    ? `${f.date} (${weekdayWord(day)})${end === null ? t('bookings.format.when.allDay') : ` – ${end}`}`
    : `${f.date} (${weekdayWord(day)}) ${f.time}–${end ?? '?'}`;
  return f.repeat === 'none' ? at : `${at}, ${repeatWords(f)}`;
}

function repeatWords(f: SlotFields): string {
  const n = f.every;
  const days = weekdayWords(f.weekdays).join(', ');
  const how = f.repeat === 'daily' ? (n === 1 ? t('bookings.format.repeat.daily') : t('bookings.format.repeat.days', { count: n }))
    : f.repeat === 'weekly' ? (n === 1 ? t('bookings.format.repeat.weekly', { days }) : t('bookings.format.repeat.weeks', { count: n, days }))
    : f.repeat === 'monthly' ? (n === 1 ? t('bookings.format.repeat.monthly') : t('bookings.format.repeat.months', { count: n }))
    : (n === 1 ? t('bookings.format.repeat.yearly') : t('bookings.format.repeat.years', { count: n }));
  const until = f.until !== null ? ` ${t('bookings.format.repeat.until', { until: f.until })}` : '';
  const count = f.count !== null ? ` ${t('bookings.format.repeat.count', { count: f.count })}` : '';
  return `${how}${until}${count}`;
}

/* -- Export ------------------------------------------------------------------------------------------ */

function exportSlot(s: SlotState): Record<string, unknown> {
  const f = slotFieldsOf(s.draft);
  const end = endText(f);
  return {
    id: s.itemId,
    ...(f.title === '' ? {} : { title: f.title }),
    start: f.allDay ? f.date : `${f.date}T${f.time}`,
    ...(end === null ? {} : { end }),
    ...(f.allDay ? { allDay: true } : {}),
    ...(f.repeat === 'none' ? {} : {
      repeat: f.repeat,
      ...(f.every === 1 ? {} : { every: f.every }),
      ...(f.repeat === 'weekly' ? { weekdays: weekdayWords(f.weekdays) } : {}),
      ...(f.until === null ? {} : { until: f.until }),
      ...(f.count === null ? {} : { count: f.count })
    }),
    ...(f.location === '' ? {} : { location: f.location }),
    ...(f.notes === '' ? {} : { notes: f.notes }),
    ...(f.link === '' ? {} : { link: f.link, ...(f.linkLabel === '' ? {} : { linkLabel: f.linkLabel }) }),
    capacity: f.capacity,
    bookable: f.bookable,
    reserveArea: f.reserveAreaId
  };
}

function exportClaim(c: OfficeClaim): Record<string, unknown> {
  return {
    id: c.claimId,
    slot: c.itemId,
    start: localAt(new Date(c.startsAt)),
    end: localAt(new Date(c.endsAt)),
    status: c.status,
    awaits: c.awaits,
    host: c.hosting,
    name: c.name,
    byOffice: c.byOffice === true,
    group: c.groupId,
    created: localAt(new Date(c.createdAt))
  };
}

function exportResource(r: ResourceState, areas: ReadonlyMap<string, AreaState>): Record<string, unknown> {
  const row = r.row;
  const offered = row.mode === 'offered';
  const area = areas.get(lower(row.areaId));
  return {
    id: row.resourceId,
    area: row.areaId,
    ...(area === undefined ? {} : { areaName: area.name }),
    name: row.name,
    kind: row.kind,
    mode: row.mode,
    parent: row.parentId,
    ...(offered ? { calendar: row.calendarId } : {}),
    capacity: row.capacity,
    approval: row.approval,
    perPerson: row.perPerson,
    ...(offered
      ? { inviteHours: row.inviteHours, minPersons: row.minPersons, bookableDefault: row.bookableDefault ?? true }
      : {
        byNight: row.byNight,
        ...(row.byNight ? { checkIn: clock(row.checkInMin), checkOut: clock(row.checkOutMin) } : {}),
        bufferBefore: row.bufferBefore, bufferAfter: row.bufferAfter, leadDays: row.leadDays
      }),
    reserveArea: row.reserveAreaId ?? null,
    ...(offered ? { slots: r.slots.map(exportSlot) } : {}),
    claims: r.claims.map(exportClaim)
  };
}

/** DER EXPORT — alle Dinge, die ich sehe, oder nur eines (`only`, auf seiner Seite). */
export function exportBookings(state: BookingsState, only?: string | null): Record<string, unknown> {
  const areas = new Map(state.areas.map((a) => [lower(a.areaId), a]));
  const list = state.resources.filter((r) => only == null || lower(r.row.resourceId) === lower(only));
  return {
    format: BOOKINGS_FORMAT,
    version: BOOKINGS_VERSION,
    exported: localAt(state.now),
    resources: list.map((r) => exportResource(r, areas))
  };
}

/* -- Die Beschreibung --------------------------------------------------------------------------------- */

export const TOP_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => t('bookings.format.top.format', { format: BOOKINGS_FORMAT }),
  version: () => t('bookings.format.top.version', { version: BOOKINGS_VERSION }),
  exported: () => t('bookings.format.top.exported'),
  resources: () => t('bookings.format.top.resources', { max: MAX_RESOURCES })
});

export const RESOURCE_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('bookings.format.resource.id'),
  key: () => t('bookings.format.resource.key'),
  area: () => t('bookings.format.resource.area'),
  areaName: () => t('bookings.format.resource.areaName'),
  name: () => t('bookings.format.resource.name', { max: MAX_NAME }),
  kind: () => t('bookings.format.resource.kind', { list: KINDS.map((k) => `"${k}" (${KIND_LABEL[k].toLowerCase()})`).join(', ') }),
  mode: () => t('bookings.format.resource.mode'),
  parent: () => t('bookings.format.resource.parent'),
  calendar: () => t('bookings.format.resource.calendar'),
  capacity: () => t('bookings.format.resource.capacity', { max: MAX_CAPACITY }),
  approval: () => t('bookings.format.resource.approval'),
  perPerson: () => t('bookings.format.resource.perPerson'),
  inviteHours: () => t('bookings.format.resource.inviteHours'),
  minPersons: () => t('bookings.format.resource.minPersons'),
  byNight: () => t('bookings.format.resource.byNight'),
  checkIn: () => t('bookings.format.resource.checkIn'),
  checkOut: () => t('bookings.format.resource.checkOut'),
  bufferBefore: () => t('bookings.format.resource.bufferBefore'),
  bufferAfter: () => t('bookings.format.resource.bufferAfter'),
  leadDays: () => t('bookings.format.resource.leadDays'),
  bookableDefault: () => t('bookings.format.resource.bookableDefault'),
  reserveArea: () => t('bookings.format.resource.reserveArea'),
  slots: () => t('bookings.format.resource.slots', { max: MAX_SLOTS }),
  claims: () => t('bookings.format.resource.claims')
});

export const SLOT_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('bookings.format.slot.id'),
  title: () => t('bookings.format.slot.title', { max: MAX_TITLE }),
  start: () => t('bookings.format.slot.start'),
  end: () => t('bookings.format.slot.end'),
  allDay: () => t('bookings.format.slot.allDay'),
  repeat: () => t('bookings.format.slot.repeat'),
  every: () => t('bookings.format.slot.every'),
  weekdays: () => t('bookings.format.slot.weekdays'),
  until: () => t('bookings.format.slot.until'),
  count: () => t('bookings.format.slot.count'),
  location: () => t('bookings.format.slot.location', { max: MAX_LOCATION }),
  notes: () => t('bookings.format.slot.notes', { max: MAX_NOTES }),
  link: () => t('bookings.format.slot.link', { max: MAX_LINK }),
  linkLabel: () => t('bookings.format.slot.linkLabel', { max: MAX_LINK_LABEL }),
  capacity: () => t('bookings.format.slot.capacity', { max: MAX_CAPACITY }),
  bookable: () => t('bookings.format.slot.bookable'),
  reserveArea: () => t('bookings.format.slot.reserveArea')
});

export const CLAIM_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('bookings.format.claim.id'),
  slot: () => t('bookings.format.claim.slot'),
  start: () => t('bookings.format.claim.start'),
  end: () => t('bookings.format.claim.end'),
  status: () => t('bookings.format.claim.status'),
  awaits: () => t('bookings.format.claim.awaits'),
  host: () => t('bookings.format.claim.host'),
  name: () => t('bookings.format.claim.name'),
  byOffice: () => t('bookings.format.claim.byOffice'),
  group: () => t('bookings.format.claim.group'),
  created: () => t('bookings.format.claim.created')
});

const INTRO = (): string => t('bookings.format.intro', { days: EXPORT_DAYS, top: keyLines(TOP_KEYS) });

const RESOURCE_TEXT = (): string => t('bookings.format.resourceText', { keys: keyLines(RESOURCE_KEYS) });

const SLOT_TEXT = (): string => t('bookings.format.slotText', { keys: keyLines(SLOT_KEYS) });

const CLAIM_TEXT = (): string => t('bookings.format.claimText', { keys: keyLines(CLAIM_KEYS) });

/** Spotkania mit dem Priester: Termine aus dem Kalender, drei Plätze, der Erste lädt ein. */
export function priestSample(): Record<string, unknown> {
  return {
    format: BOOKINGS_FORMAT,
    version: BOOKINGS_VERSION,
    resources: [{
      key: 'ksiadz',
      name: t('bookings.format.sample.priestName'),
      kind: 'person',
      mode: 'offered',
      capacity: 3,
      approval: 'none',
      perPerson: 1,
      inviteHours: 48,
      minPersons: 2,
      slots: [
        { title: t('bookings.format.sample.priestSlot'), start: '2026-11-03T17:00', end: '17:40', repeat: 'weekly', weekdays: ['wt'], until: '2026-12-15', location: t('bookings.format.sample.office') },
        { title: t('bookings.format.sample.priestSlotSat'), start: '2026-11-07T10:00', end: '10:40', location: t('bookings.format.sample.office'), capacity: 5 }
      ]
    }]
  };
}

/** Ein Haus nach Nächten, die Kapelle darin nach Stunden — die Kanzlei sagt ja. */
export function houseSample(): Record<string, unknown> {
  return {
    format: BOOKINGS_FORMAT,
    version: BOOKINGS_VERSION,
    resources: [
      {
        key: 'dom', name: t('bookings.format.sample.house1'), kind: 'house', mode: 'open',
        byNight: true, checkIn: '16:00', checkOut: '10:00', capacity: 1, approval: 'office', perPerson: 0,
        bufferBefore: 0, bufferAfter: 120, leadDays: 2
      },
      {
        key: 'kaplica', name: t('bookings.format.sample.chapel'), kind: 'room', mode: 'open', parent: '@dom',
        byNight: false, capacity: 1, approval: 'office', bufferBefore: 30, bufferAfter: 30
      }
    ]
  };
}

/*
 * 2026-10-30 — WAS DIE APP MIT DEN DINGEN UND TERMINEN TUT: der Baustein „Rezerwacja" (`live.tsx`, `SlotCard.tsx`,
 * `OfferList.tsx`, `MyTerm.tsx`); frei und belegt für jeden, ohne Namen (`Bookings.Offers.cs`), „für wen"
 * (`Bookings.Take.cs`); Wartendes an die, die schreiben (`Reservations.tsx`, „Do potwierdzenia", `Notify.cs`,
 * `alerts.ts`); Angebote im Kalender (`calendarModel.ts`), eigene Reservierungen (`Agenda.cs`); der Schritt `booking`
 * (`Form.Extension.cs`); kein Push (`Push.cs`) — die Antwort steht in der Karte (`SlotCard.tsx`).
 */
const USAGE_TEXT = (): string => t('bookings.format.usage');

export const BOOKINGS_RESOURCE_JSON: JsonNode = { key: 'bookings.resource', get title() { return t('bookings.format.node.resource'); }, get short() { return t('bookings.format.node.resourceShort'); }, text: RESOURCE_TEXT };
export const BOOKINGS_SLOT_JSON: JsonNode = { key: 'bookings.slot', get title() { return t('bookings.format.node.slot'); }, get short() { return t('bookings.format.node.slotShort'); }, text: SLOT_TEXT };
export const BOOKINGS_CLAIM_JSON: JsonNode = { key: 'bookings.claim', get title() { return t('bookings.format.node.claim'); }, get short() { return t('bookings.format.node.claimShort'); }, text: CLAIM_TEXT };

/** 2026-10-29 — DIE REZERWACJE ALS JSON: der Baum ihrer Beschreibung und die Beispiele zum Einsetzen. Ohne Ort aufrufbar. */
export const BOOKINGS_JSON: JsonNode = {
  key: 'bookings',
  get title() { return t('bookings.format.node.root', { format: BOOKINGS_FORMAT, version: BOOKINGS_VERSION }); },
  get short() { return t('bookings.format.node.rootShort'); },
  text: INTRO,
  inside: () => [
    textNode('bookings.usage', t('bookings.format.node.usage'), USAGE_TEXT),
    BOOKINGS_RESOURCE_JSON, BOOKINGS_SLOT_JSON, BOOKINGS_CLAIM_JSON,
    textNode('bookings.example', t('bookings.format.node.priest'), () => pretty(priestSample())),
    textNode('bookings.house', t('bookings.format.node.house'), () => pretty(houseSample()))
  ],
  samples: () => [
    { label: t('bookings.format.sample.priest'), doc: priestSample },
    { label: t('bookings.format.sample.house'), doc: houseSample }
  ]
};

export const bookingsDescription = (): string => describe(BOOKINGS_JSON);

/* -- Der Plan ------------------------------------------------------------------------------------------- */

const MODE_WORD: Record<Mode, string> = { offered: 'bookings.plan.mode.offered', open: 'bookings.plan.mode.open' };
const OFFERED_ONLY = ['calendar', 'inviteHours', 'minPersons', 'bookableDefault', 'slots'] as const;
const OPEN_ONLY = ['byNight', 'checkIn', 'checkOut', 'bufferBefore', 'bufferAfter', 'leadDays'] as const;
const LIVE = (c: OfficeClaim, now: Date): boolean =>
  (c.status === 'pending' || c.status === 'confirmed') && new Date(c.endsAt).getTime() > now.getTime();

/** Die Regeln eines Dings — vollständig, wie sie nach dem Import gelten. */
interface Rules {
  name: string;
  kind: Kind;
  mode: Mode;
  capacity: number;
  approval: 'none' | 'office';
  perPerson: number;
  inviteHours: number;
  minPersons: number;
  byNight: boolean;
  checkInMin: number;
  checkOutMin: number;
  bufferBefore: number;
  bufferAfter: number;
  leadDays: number;
  bookableDefault: boolean;
  reserveAreaId: string | null;
}

const DEFAULT_RULES: Rules = {
  name: '', kind: 'other', mode: 'offered', capacity: 1, approval: 'none', perPerson: 0, inviteHours: 0, minPersons: 2,
  byNight: false, checkInMin: 960, checkOutMin: 600, bufferBefore: 0, bufferAfter: 0, leadDays: 0, bookableDefault: true, reserveAreaId: null
};

const rulesOf = (row: ResourceRow): Rules => ({
  name: row.name, kind: row.kind, mode: row.mode, capacity: row.capacity, approval: row.approval, perPerson: row.perPerson,
  inviteHours: row.inviteHours, minPersons: row.minPersons, byNight: row.byNight, checkInMin: row.checkInMin,
  checkOutMin: row.checkOutMin, bufferBefore: row.bufferBefore, bufferAfter: row.bufferAfter, leadDays: row.leadDays,
  bookableDefault: row.bookableDefault ?? true, reserveAreaId: row.reserveAreaId == null ? null : lower(row.reserveAreaId)
});

/** Ein einzelnes Ding ohne Hülle — so, wie man es aus einem Export herauskopiert. */
const bareResource = (doc: Record<string, unknown>): boolean =>
  doc.resources === undefined && (doc.name !== undefined || doc.id !== undefined || doc.slots !== undefined);

/** Wie viele neue Dinge (ohne "id") kein "area" tragen — für sie fragt der Import nach dem Bereich. */
export function newWithoutArea(doc: unknown): number {
  const list = Array.isArray(doc) ? doc
    : isObject(doc) ? (Array.isArray(doc.resources) ? doc.resources : bareResource(doc) ? [doc] : [])
    : [];
  return list.filter((one) => isObject(one) && (one.id === undefined || one.id === null)
    && (one.area === undefined || one.area === null || one.area === '')).length;
}

/** Ein Ding des Dokuments nach dem ersten Lesen: wer es ist, wo es liegt. */
interface Head {
  readonly index: number;
  readonly raw: Record<string, unknown>;
  readonly where: string;
  readonly existing: ResourceState | null;
  readonly key: string | null;
  readonly areaId: string;
}

/** Der Vater, wie das Dokument ihn will: bleibt, ein bestehender (oder keiner), eines aus dem Dokument. */
type ParentWish = { readonly to: 'keep' } | { readonly to: 'id'; readonly id: string | null } | { readonly to: 'doc'; readonly head: number };

/**
 * DER PLAN — was ein Dokument ändern würde, mit Warnungen. Rein: dieselben Eingaben, derselbe Plan
 * (die Vorschau ruft ihn bei jedem Tastendruck, der Import noch einmal mit frischem Stand).
 */
export function planBookingsImport(doc: unknown, state: BookingsState, options: BookingsOptions = {}): BookingsPlan | { error: string } {
  const warnings: string[] = [];
  let list: unknown[];

  if (Array.isArray(doc)) {
    list = doc;
  } else if (isObject(doc)) {
    if (doc.format !== undefined && doc.format !== BOOKINGS_FORMAT) {
      return { error: t('bookings.plan.error.format', { format: String(doc.format), expected: BOOKINGS_FORMAT }) };
    }
    if (Array.isArray(doc.resources)) {
      list = doc.resources;
      for (const key of Object.keys(doc)) if (TOP_KEYS[key] === undefined) warnings.push(t('bookings.plan.warn.unknownTop', { key }));
      if (doc.version !== undefined && doc.version !== BOOKINGS_VERSION) warnings.push(t('bookings.plan.warn.version', { version: String(doc.version), current: BOOKINGS_VERSION }));
    } else if (doc.resources !== undefined) {
      return { error: t('bookings.plan.error.resourcesList') };
    } else if (bareResource(doc)) {
      list = [doc];
    } else {
      return { error: t('bookings.plan.error.noResources') };
    }
  } else {
    return { error: t('bookings.plan.error.notDoc') };
  }

  if (list.length > MAX_RESOURCES) {
    warnings.push(t('bookings.plan.warn.tooManyResources', { max: MAX_RESOURCES }));
    list = list.slice(0, MAX_RESOURCES);
  }

  const byId = new Map(state.resources.map((r) => [lower(r.row.resourceId), r]));
  const areaOf = new Map(state.areas.map((a) => [lower(a.areaId), a]));
  const calendarOf = new Map(state.calendars.map((c) => [lower(c.calendarId), c]));
  const areaName = (id: string) => areaOf.get(lower(id))?.name ?? t('bookings.plan.areaFallback');
  const resourceName = (id: string) => byId.get(lower(id))?.row.name ?? t('bookings.plan.resourceFallback');

  /* -- 1. Wer ist wer, und wo — bevor ein Vater auf ein anderes Ding des Dokuments zeigen kann. -- */

  const heads: Head[] = [];
  const keyAt = new Map<string, number>();
  const seenIds = new Set<string>();
  let claimsShown = 0;

  list.forEach((one, i) => {
    if (!isObject(one)) { warnings.push(t('bookings.plan.warn.notObject', { n: i + 1 })); return; }
    const named = typeof one.name === 'string' && one.name.trim() !== '' ? ` (${quote(one.name.trim())})` : '';
    const where = `${t('bookings.plan.where', { n: i + 1 })}${named}`;
    if (Array.isArray(one.claims)) claimsShown += one.claims.length;

    let existing: ResourceState | null = null;
    if (one.id !== undefined && one.id !== null) {
      const id = typeof one.id === 'string' ? lower(one.id) : '';
      if (!UUID.test(id)) { warnings.push(t('bookings.plan.warn.badId', { where })); return; }
      existing = byId.get(id) ?? null;
      if (existing === null) { warnings.push(t('bookings.plan.warn.noSuchId', { where })); return; }
      if (seenIds.has(id)) { warnings.push(t('bookings.plan.warn.sameTwice', { where })); return; }
      seenIds.add(id);
    }

    /* Wo es liegt: ein bestehendes bleibt, wo es ist; ein neues, wo das Dokument oder die Wahl beim Import sagt. */
    let areaId: string | null = existing === null ? null : lower(existing.row.areaId);
    if (one.area !== undefined && one.area !== null) {
      const wanted = typeof one.area === 'string' ? one.area.trim() : '';
      const byName = state.areas.filter((a) => lower(a.name) === lower(wanted));
      const found = UUID.test(wanted) ? areaOf.get(lower(wanted)) : byName.length === 1 ? byName[0] : undefined;
      if (existing !== null) {
        if (found === undefined || lower(found.areaId) !== areaId) warnings.push(t('bookings.plan.warn.cannotMove', { where }));
      } else if (found === undefined) {
        warnings.push(t(byName.length > 1 ? 'bookings.plan.warn.noAreaMany' : 'bookings.plan.warn.noArea', { where, name: quote(wanted) }));
      } else {
        areaId = lower(found.areaId);
      }
    }
    if (areaId === null && options.areaId != null && options.areaId !== '') areaId = lower(options.areaId);
    if (areaId === null) { warnings.push(t('bookings.plan.warn.newWithoutArea', { where })); return; }
    if (existing === null && areaOf.get(areaId)?.mayWrite !== true) {
      warnings.push(t('bookings.plan.warn.cannotCreate', { where, name: quote(areaName(areaId)) }));
      return;
    }

    let key: string | null = null;
    if (one.key !== undefined) {
      const wanted = typeof one.key === 'string' ? one.key.trim() : '';
      if (!KEY.test(wanted)) warnings.push(t('bookings.plan.warn.badKey', { where }));
      else if (keyAt.has(wanted)) warnings.push(t('bookings.plan.warn.keyTaken', { where, key: quote(wanted) }));
      else { key = wanted; keyAt.set(wanted, heads.length); }
    }

    heads.push({ index: heads.length, raw: one, where, existing, key, areaId });
  });

  /* -- 2. Jedes Ding ganz: Regeln, Vater, Kalender, Termine. -- */

  interface Read {
    readonly head: Head;
    readonly before: Rules | null;
    readonly after: Rules;
    readonly parent: ParentWish;
    readonly calendar: { readonly id: string | null; readonly fresh: boolean };
    readonly slots: PlannedSlot[];
    readonly unchangedSlots: number;
    readonly mayWrite: boolean;
  }

  const reads: Read[] = [];
  const seenSlots = new Set<string>();
  let slotBudget = MAX_SLOTS;

  for (const head of heads) {
    const { raw, where, existing } = head;
    const before = existing === null ? null : rulesOf(existing.row);
    const r: Rules = { ...(before ?? DEFAULT_RULES) };

    for (const key of Object.keys(raw)) if (RESOURCE_KEYS[key] === undefined) warnings.push(t('bookings.plan.warn.unknownKey', { where, key }));

    /* Der Name. */
    if (raw.name !== undefined) {
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (name === '') warnings.push(t(before === null ? 'bookings.plan.warn.emptyName' : 'bookings.plan.warn.emptyNameKept', { where }));
      else {
        if (name.length > MAX_NAME) warnings.push(t('bookings.plan.warn.nameLong', { where, max: MAX_NAME }));
        r.name = name.slice(0, MAX_NAME);
      }
    }
    if (r.name === '') { warnings.push(t('bookings.plan.warn.needName', { where })); continue; }

    const pick = <T extends string>(key: string, allowed: readonly T[], was: T): T => {
      const value = raw[key];
      if (value === undefined) return was;
      const wanted = typeof value === 'string' ? lower(value) : '';
      if ((allowed as readonly string[]).includes(wanted)) return wanted as T;
      warnings.push(t('bookings.plan.warn.pick', { where, key, allowed: allowed.map((a) => `"${a}"`).join(', '), was }));
      return was;
    };
    const number = (key: string, min: number, max: number, was: number): number => {
      const value = raw[key];
      if (value === undefined) return was;
      const n = intOf(value);
      if (n !== null && n >= min && n <= max) return n;
      warnings.push(t('bookings.plan.warn.number', { where, key, min, max, was }));
      return was;
    };
    const flag = (key: string, was: boolean): boolean => {
      const value = raw[key];
      if (value === undefined) return was;
      if (typeof value === 'boolean') return value;
      warnings.push(t('bookings.plan.warn.flag', { where, key, was: String(was) }));
      return was;
    };
    const time = (key: string, was: number): number => {
      const value = raw[key];
      if (value === undefined) return was;
      const m = typeof value === 'string' ? CLOCK.exec(value.trim()) : null;
      if (m !== null && Number(m[1]) <= 23 && Number(m[2]) <= 59) return Number(m[1]) * 60 + Number(m[2]);
      warnings.push(t('bookings.plan.warn.time', { where, key, was: clock(was) }));
      return was;
    };

    r.kind = pick('kind', KINDS, r.kind);
    r.mode = pick('mode', MODES, r.mode);
    r.approval = pick('approval', APPROVALS, r.approval);
    r.capacity = number('capacity', 1, MAX_CAPACITY, r.capacity);
    r.perPerson = number('perPerson', 0, 1000, r.perPerson);

    /* Was nur der eine Fall kennt, gilt im anderen nicht — gesagt, nicht still verworfen. */
    const other = r.mode === 'offered' ? OPEN_ONLY : OFFERED_ONLY;
    for (const key of other) {
      if (raw[key] !== undefined) warnings.push(t('bookings.plan.warn.otherMode', { where, key, mode: r.mode === 'offered' ? 'open' : 'offered' }));
    }
    if (r.mode === 'offered') {
      r.inviteHours = number('inviteHours', 0, 1440, r.inviteHours);
      r.minPersons = number('minPersons', 1, 1000, r.minPersons);
      r.bookableDefault = flag('bookableDefault', r.bookableDefault);
      /* Wie der Editor: ein Termin, den die Kanzlei anbietet, zählt keine Nächte. */
      if (before !== null && before.mode === 'open') r.byNight = false;
    } else {
      r.byNight = flag('byNight', r.byNight);
      r.checkInMin = time('checkIn', r.checkInMin);
      r.checkOutMin = time('checkOut', r.checkOutMin);
      r.bufferBefore = number('bufferBefore', 0, 1440, r.bufferBefore);
      r.bufferAfter = number('bufferAfter', 0, 1440, r.bufferAfter);
      r.leadDays = number('leadDays', 0, 3650, r.leadDays);
      /* Wie der Editor: wer die Zeit selbst wählt, hat keinen Gastgeber. */
      if (before !== null && before.mode === 'offered') r.inviteHours = 0;
    }

    if (raw.reserveArea !== undefined) {
      const wanted = typeof raw.reserveArea === 'string' ? lower(raw.reserveArea) : raw.reserveArea === null ? '' : '?';
      if (wanted === '') r.reserveAreaId = null;
      else if (UUID.test(wanted) && areaOf.has(wanted)) r.reserveAreaId = wanted;
      else warnings.push(t('bookings.plan.warn.reserveArea', { where }));
    }

    /* Der Vater — ein Ding desselben Bereichs, aus dem Dokument ("@key") oder schon da. */
    let parent: ParentWish = { to: 'keep' };
    if (raw.parent !== undefined) {
      const wanted = raw.parent === null ? '' : typeof raw.parent === 'string' ? raw.parent.trim() : '?';
      if (wanted === '') {
        parent = { to: 'id', id: null };
      } else if (wanted.startsWith('@')) {
        const at = keyAt.get(wanted.slice(1));
        const target = at === undefined ? undefined : heads[at];
        if (target === undefined) warnings.push(t('bookings.plan.warn.parentNoKey', { where, key: quote(wanted) }));
        else if (target.index === head.index) warnings.push(t('bookings.plan.warn.parentSelf', { where }));
        else if (target.areaId !== head.areaId) warnings.push(t('bookings.plan.warn.parentArea', { where }));
        else parent = target.existing !== null ? { to: 'id', id: lower(target.existing.row.resourceId) } : { to: 'doc', head: target.index };
      } else if (UUID.test(wanted)) {
        const target = byId.get(lower(wanted));
        if (target === undefined) warnings.push(t('bookings.plan.warn.parentMissing', { where }));
        else if (existing !== null && lower(target.row.resourceId) === lower(existing.row.resourceId)) warnings.push(t('bookings.plan.warn.parentSelf', { where }));
        else if (lower(target.row.areaId) !== head.areaId) warnings.push(t('bookings.plan.warn.parentArea', { where }));
        else parent = { to: 'id', id: lower(target.row.resourceId) };
      } else {
        warnings.push(t('bookings.plan.warn.parentBad', { where }));
      }
      if (parent.to === 'id' && existing !== null && parent.id === (existing.row.parentId === null ? null : lower(existing.row.parentId))) parent = { to: 'keep' };
    }

    /* Der Kalender der Termine — nur, wenn die Kanzlei die Termine vorgibt. */
    let calendarId = existing?.row.calendarId == null ? null : lower(existing.row.calendarId);
    /* Derselbe wie bisher: nichts zu prüfen (die Liste der Kalender kennt ihn vielleicht gar nicht). */
    if (r.mode === 'offered' && raw.calendar !== undefined && !(typeof raw.calendar === 'string' && calendarId !== null && lower(raw.calendar) === calendarId)) {
      const wanted = typeof raw.calendar === 'string' ? raw.calendar.trim() : '';
      const titled = state.calendars.filter((c) => lower(c.areaId) === head.areaId && lower(c.title) === lower(wanted));
      const found = UUID.test(wanted) ? calendarOf.get(lower(wanted)) : titled.length === 1 ? titled[0] : undefined;
      if (raw.calendar === null) {
        if (calendarId !== null) warnings.push(t('bookings.plan.warn.calendarNull', { where }));
      } else if (found === undefined || lower(found.areaId) !== head.areaId) {
        warnings.push(t(calendarId === null ? 'bookings.plan.warn.calendarNew' : 'bookings.plan.warn.calendarKept', { where }));
      } else {
        calendarId = lower(found.calendarId);
      }
    }
    const freshCalendar = r.mode === 'offered' && calendarId === null;
    const calendarMoves = existing !== null && existing.row.calendarId != null && calendarId !== lower(existing.row.calendarId);

    /* Die Termine — Treffen im Kalender des Dings. */
    const slots: PlannedSlot[] = [];
    let unchangedSlots = 0;
    if (r.mode === 'offered' && raw.slots !== undefined) {
      if (!Array.isArray(raw.slots)) warnings.push(t('bookings.plan.warn.slotsList', { where }));
      else {
        const own = new Map((calendarMoves || freshCalendar ? [] : existing?.slots ?? []).map((s) => [lower(s.itemId), s]));
        raw.slots.forEach((one, j) => {
          const titled = isObject(one) && typeof one.title === 'string' && one.title.trim() !== '' ? ` (${quote(one.title.trim())})` : '';
          const at = `${t('bookings.plan.whereSlot', { where, n: j + 1 })}${titled}`;
          if (!isObject(one)) { warnings.push(t('bookings.plan.warn.slotNotObject', { where: at })); return; }
          if (slotBudget <= 0) {
            if (slotBudget === 0) warnings.push(t('bookings.plan.warn.tooManySlots', { max: MAX_SLOTS }));
            slotBudget -= 1;
            return;
          }
          slotBudget -= 1;
          let base: SlotState | null = null;
          if (one.id !== undefined && one.id !== null) {
            const id = typeof one.id === 'string' ? lower(one.id) : '';
            base = own.get(id) ?? null;
            if (base === null) {
              warnings.push(t('bookings.plan.warn.noSuchSlot', { where: at }));
              return;
            }
            if (seenSlots.has(id)) { warnings.push(t('bookings.plan.warn.slotTwice', { where: at })); return; }
            seenSlots.add(id);
          }
          const was = base === null ? null : slotFieldsOf(base.draft);
          const fields = readSlot(one, at, was, areaOf, warnings);
          if (fields === null) return;
          if (was !== null && changedKeys(was, fields).length === 0) { unchangedSlots += 1; return; }
          if (base !== null && base.readable === false) {
            warnings.push(t('bookings.plan.warn.sealed', { where: at }));
            return;
          }
          slots.push({
            itemId: base === null ? null : base.itemId,
            base: base === null ? null : base.draft,
            fields,
            label: fields.title === '' ? t('bookings.plan.slotLabel') : fields.title
          });
        });
      }
    }

    reads.push({
      head, before, after: r, parent,
      calendar: { id: calendarId, fresh: freshCalendar },
      slots, unchangedSlots,
      mayWrite: areaOf.get(head.areaId)?.mayWrite === true
    });
  }

  /* -- 3. Kein Ring aus Vätern: wer in sich selbst läge, behält seinen Vater. -- */

  const nodeOf = (read: Read): string => read.head.existing !== null ? lower(read.head.existing.row.resourceId) : `#${read.head.index}`;
  const readOfHead = new Map(reads.map((read) => [read.head.index, read]));
  const parents = new Map<number, ParentWish>();
  for (const read of reads) {
    /* Ein Vater aus dem Dokument, der selbst übersprungen wurde, ist keiner. */
    if (read.parent.to === 'doc' && !readOfHead.has(read.parent.head)) {
      warnings.push(t('bookings.plan.warn.parentSkipped', { where: read.head.where }));
      parents.set(read.head.index, { to: 'keep' });
    } else {
      parents.set(read.head.index, read.parent);
    }
  }
  const parentOf = new Map<string, string | null>();
  for (const one of state.resources) parentOf.set(lower(one.row.resourceId), one.row.parentId === null ? null : lower(one.row.parentId));
  const target = (wish: ParentWish): string | null => wish.to === 'id' ? wish.id : wish.to === 'doc' ? nodeOf(readOfHead.get(wish.head)!) : null;
  for (const read of reads) {
    const wish = parents.get(read.head.index)!;
    if (wish.to !== 'keep') parentOf.set(nodeOf(read), target(wish));
  }
  const ringed = (start: string): boolean => {
    let at = parentOf.get(start) ?? null;
    for (let step = 0; at !== null && step < 64; step++) {
      if (at === start) return true;
      at = parentOf.get(at) ?? null;
    }
    return false;
  };
  for (const read of reads) {
    if (parents.get(read.head.index)!.to === 'keep' || !ringed(nodeOf(read))) continue;
    warnings.push(t('bookings.plan.warn.parentRing', { where: read.head.where }));
    parentOf.set(nodeOf(read), read.head.existing?.row.parentId == null ? null : lower(read.head.existing.row.parentId));
    parents.set(read.head.index, { to: 'keep' });
  }

  /* -- 4. Was sich ändert, in Worten — und was an Reservierungen daran hängt. -- */

  const resources: PlannedResource[] = [];
  const lines: string[] = [];
  let changes = 0;
  let unchangedResources = 0;
  let unchangedSlotsAll = 0;

  for (const read of reads) {
    const { head, before, after, calendar } = read;
    const { where, existing } = head;
    const wish = parents.get(head.index) ?? { to: 'keep' };
    const label = quote(after.name);
    const owner = t('bookings.plan.owner', { label });

    const change: Record<string, unknown> = {};
    const said: string[] = [];
    const put = (key: keyof ResourceChange, value: unknown, word: string, from: string, to: string) => {
      change[key] = value;
      if (before !== null) said.push(`${word}: ${from} → ${to}`);
    };
    const yesNo = (b: boolean, yes: string, no: string) => (b ? yes : no);
    const capWord = after.mode === 'offered' ? t('bookings.plan.word.capOffered') : t('bookings.plan.word.capOpen');
    const area = (id: string | null) => (id === null ? t('bookings.plan.word.anyone') : quote(areaName(id)));
    const office = (a: 'none' | 'office' | undefined) => (a === 'office' ? t('bookings.plan.word.office') : t('bookings.plan.word.nobody'));
    const limit = (n: number | undefined) => (n === 0 ? t('bookings.plan.word.noLimit') : String(n));

    if (before === null || before.name !== after.name) put('name', after.name, t('bookings.plan.word.name'), quote(before?.name ?? ''), label);
    if (before === null || before.kind !== after.kind) put('kind', after.kind, t('bookings.plan.word.kind'), KIND_LABEL[before?.kind ?? 'other'].toLowerCase(), KIND_LABEL[after.kind].toLowerCase());
    if (before === null || before.mode !== after.mode) put('mode', after.mode, t('bookings.plan.word.mode'), t(MODE_WORD[before?.mode ?? 'offered']), t(MODE_WORD[after.mode]));
    if (before === null || before.capacity !== after.capacity) put('capacity', after.capacity, capWord, String(before?.capacity), String(after.capacity));
    if (before === null || before.approval !== after.approval) put('approval', after.approval, t('bookings.plan.word.approval'), office(before?.approval), office(after.approval));
    if (before === null || before.perPerson !== after.perPerson) put('perPerson', after.perPerson, t('bookings.plan.word.perPerson'), limit(before?.perPerson), limit(after.perPerson));
    if (before === null || before.inviteHours !== after.inviteHours) put('inviteHours', after.inviteHours, t('bookings.plan.word.inviteHours'), String(before?.inviteHours), String(after.inviteHours));
    if (before === null || before.minPersons !== after.minPersons) put('minPersons', after.minPersons, t('bookings.plan.word.minPersons'), String(before?.minPersons), String(after.minPersons));
    if (before === null || before.byNight !== after.byNight) put('byNight', after.byNight, t('bookings.plan.word.byNight'), yesNo(before?.byNight === true, t('bookings.plan.word.nights'), t('bookings.plan.word.hours')), yesNo(after.byNight, t('bookings.plan.word.nights'), t('bookings.plan.word.hours')));
    if (before === null || before.checkInMin !== after.checkInMin) put('checkInMin', after.checkInMin, t('bookings.plan.word.checkIn'), clock(before?.checkInMin ?? 0), clock(after.checkInMin));
    if (before === null || before.checkOutMin !== after.checkOutMin) put('checkOutMin', after.checkOutMin, t('bookings.plan.word.checkOut'), clock(before?.checkOutMin ?? 0), clock(after.checkOutMin));
    if (before === null || before.bufferBefore !== after.bufferBefore) put('bufferBefore', after.bufferBefore, t('bookings.plan.word.bufferBefore'), String(before?.bufferBefore), String(after.bufferBefore));
    if (before === null || before.bufferAfter !== after.bufferAfter) put('bufferAfter', after.bufferAfter, t('bookings.plan.word.bufferAfter'), String(before?.bufferAfter), String(after.bufferAfter));
    if (before === null || before.leadDays !== after.leadDays) put('leadDays', after.leadDays, t('bookings.plan.word.leadDays'), String(before?.leadDays), String(after.leadDays));
    if (before === null || before.bookableDefault !== after.bookableDefault) put('bookableDefault', after.bookableDefault, t('bookings.plan.word.bookableDefault'), yesNo(before?.bookableDefault !== false, t('bookings.plan.word.all'), t('bookings.plan.word.marked')), yesNo(after.bookableDefault, t('bookings.plan.word.all'), t('bookings.plan.word.marked')));
    if (before === null || before.reserveAreaId !== after.reserveAreaId) put('reserveAreaId', after.reserveAreaId ?? '', t('bookings.plan.word.reserves'), area(before?.reserveAreaId ?? null), area(after.reserveAreaId));

    /* Der Vater: ein bestehender gleich, einer aus dem Dokument erst, wenn es ihn gibt. */
    let parentLater: number | null = null;
    if (wish.to === 'id') {
      put('parentId', wish.id ?? '', t('bookings.plan.word.inside'), existing?.row.parentId == null ? t('bookings.plan.word.separate') : quote(resourceName(existing.row.parentId)), wish.id === null ? t('bookings.plan.word.separate') : quote(resourceName(wish.id)));
    } else if (wish.to === 'doc') {
      parentLater = wish.head;
      if (before !== null) said.push(t('bookings.plan.word.insideNew', { name: quote(readOfHead.get(wish.head)!.after.name) }));
    }

    /* Der Kalender: ein bestehender gleich, ein neuer beim Import. */
    const calendarBefore = existing?.row.calendarId == null ? null : lower(existing.row.calendarId);
    if (after.mode === 'offered' && !calendar.fresh && calendar.id !== calendarBefore) {
      const title = (id: string | null) => (id === null ? t('bookings.plan.word.none') : quote(calendarOf.get(id)?.title ?? t('bookings.plan.calendarFallback')));
      put('calendarId', calendar.id ?? '', t('bookings.plan.word.calendar'), title(calendarBefore), title(calendar.id));
    }
    if (calendar.fresh && before !== null) said.push(t('bookings.plan.word.calendarNew', { label }));

    const resourceChanged = Object.keys(change).length > 0 || parentLater !== null || calendar.fresh;

    /* Nur lesen: was sich ändern würde, wird gesagt und nicht getan. */
    if (!read.mayWrite) {
      if (resourceChanged || read.slots.length > 0) warnings.push(t('bookings.plan.warn.readOnly', { where }));
      else unchangedResources += 1;
      unchangedSlotsAll += read.unchangedSlots;
      continue;
    }

    /* -- Was an Reservierungen daran hängt (der Dienst entscheidet weiter selbst). -- */
    const claims = (existing?.claims ?? []).filter((c) => LIVE(c, state.now));
    if (existing !== null && before !== null && claims.length > 0) {
      warnAboutClaims({ where, before, after, existing, claims, slots: read.slots, calendarMoves: calendar.id !== calendarBefore && calendarBefore !== null }, warnings);
    }
    if (after.mode === 'offered') warnAboutOverlaps(read.slots, owner, claims, warnings);

    if (resourceChanged) {
      changes += 1 + (calendar.fresh ? 1 : 0);
      if (before === null) {
        const fresh = { label, kind: KIND_LABEL[after.kind].toLowerCase(), mode: t(MODE_WORD[after.mode]), area: quote(areaName(head.areaId)) };
        lines.push(parentLater !== null ? t('bookings.plan.line.newResourceInside', { ...fresh, parent: quote(readOfHead.get(parentLater)!.after.name) }) : t('bookings.plan.line.newResource', fresh));
      } else {
        lines.push(t('bookings.plan.line.changeResource', { label, said: said.join('; ') }));
      }
      if (calendar.fresh) lines.push(t('bookings.plan.line.newCalendar', { label, area: quote(areaName(head.areaId)) }));
    } else {
      unchangedResources += 1;
    }

    for (const slot of read.slots) {
      changes += 1;
      if (slot.itemId === null) {
        lines.push(t('bookings.plan.line.newSlot', { name: quote(slot.label), owner, when: slotWhen(slot.fields) }));
      } else {
        lines.push(t('bookings.plan.line.changeSlot', { name: quote(slot.label), owner, diff: slotDiff(slotFieldsOf(slot.base!), slot.fields, areaName) }));
      }
    }
    unchangedSlotsAll += read.unchangedSlots;

    if (resourceChanged || read.slots.length > 0) {
      resources.push({
        index: head.index,
        resourceId: existing === null ? null : existing.row.resourceId,
        areaId: head.areaId,
        name: after.name,
        change: change as ResourceChange,
        parentLater,
        newCalendar: calendar.fresh ? after.name : null,
        calendarId: calendar.fresh ? null : calendar.id,
        slots: read.slots
      });
    }
  }

  const opening = changes > 0 ? lines
    : warnings.length === 0 ? [t('bookings.plan.line.same')] : [t('bookings.plan.line.nothing')];
  const tail = [
    unchangedResources + unchangedSlotsAll > 0 && (changes > 0 || warnings.length > 0)
      ? t('bookings.plan.line.unchanged', { resources: t('bookings.plan.line.resources', { count: unchangedResources }), slots: t('bookings.plan.line.slots', { count: unchangedSlotsAll }) })
      : null,
    claimsShown > 0 ? t('bookings.plan.line.claims', { n: claimsShown }) : null
  ].filter((one): one is string => one !== null);

  return { resources, lines: [...opening, ...tail], warnings, changes };
}

/* -- Ein Termin --------------------------------------------------------------------------------------- */

const EMPTY_SLOT: SlotFields = {
  title: '', location: '', notes: '', link: '', linkLabel: '', date: '', time: '00:00', minutes: 60, allDay: false,
  repeat: 'none', every: 1, weekdays: 0, until: null, count: null, bookable: null, capacity: null, reserveAreaId: null
};

/** Einen Termin lesen — über dem gespeicherten (`was`) oder neu. `null`: geht nicht (gesagt in `warnings`). */
function readSlot(raw: Record<string, unknown>, where: string, was: SlotFields | null,
  areaOf: ReadonlyMap<string, AreaState>, warnings: string[]): SlotFields | null {
  for (const key of Object.keys(raw)) if (SLOT_KEYS[key] === undefined) warnings.push(t('bookings.plan.warn.unknownKey', { where, key }));
  const f: { -readonly [K in keyof SlotFields]: SlotFields[K] } = { ...(was ?? EMPTY_SLOT) };
  const timingNotes: string[] = [];

  const text = (key: 'title' | 'location' | 'notes' | 'link' | 'linkLabel', max: number) => {
    const value = raw[key];
    if (value === undefined) return;
    if (value !== null && typeof value !== 'string') { warnings.push(t('bookings.plan.warn.text', { where, key })); return; }
    const v = (value ?? '').trim();
    if (v.length > max) warnings.push(t('bookings.plan.warn.textLong', { where, key, max }));
    f[key] = v.slice(0, max);
  };
  text('title', MAX_TITLE);
  text('location', MAX_LOCATION);
  text('notes', MAX_NOTES);
  text('link', MAX_LINK);
  text('linkLabel', MAX_LINK_LABEL);

  /* -- Wann: Anfang, Ende, ganztägig. -- */
  const allDayGiven = raw.allDay === undefined ? null : typeof raw.allDay === 'boolean' ? raw.allDay : null;
  if (raw.allDay !== undefined && allDayGiven === null) warnings.push(t('bookings.plan.warn.allDay', { where }));

  const timedBefore = !f.allDay;
  if (raw.start !== undefined) {
    const start = readWhen(raw.start, null);
    if (start === null) {
      warnings.push(t(was === null ? 'bookings.plan.warn.startSkipped' : 'bookings.plan.warn.startKept', { where }));
      if (was === null) return null;
    } else {
      f.date = dayText(start.day);
      f.allDay = start.minute === null || allDayGiven === true;
      f.time = f.allDay ? '00:00' : clock(start.minute!);
    }
  } else if (was === null) {
    warnings.push(t('bookings.plan.warn.needStart', { where }));
    return null;
  } else if (allDayGiven !== null) {
    f.allDay = allDayGiven;
  }
  const day = dayOf(f.date)!;
  const fallback = (): string => t(was !== null ? 'bookings.plan.fallback.keep' : f.allDay ? 'bookings.plan.fallback.oneDay' : 'bookings.plan.fallback.hour');

  if (raw.end !== undefined) {
    const end = readWhen(raw.end, day);
    if (end === null) warnings.push(t('bookings.plan.warn.endUnreadable', { where, fallback: fallback() }));
    else if (f.allDay) {
      const days = daysBetween(day, end.day) + 1;
      if (days < 1) warnings.push(t('bookings.plan.warn.endBeforeStart', { where, fallback: fallback() }));
      else f.minutes = days * 1440;
    } else if (end.minute === null) {
      warnings.push(t('bookings.plan.warn.endNeedsTime', { where, fallback: fallback() }));
    } else {
      const minutes = Math.round((wall(end.day, end.minute).getTime() - wall(day, minuteOf(f.time)).getTime()) / 60_000);
      if (minutes <= 0) warnings.push(t('bookings.plan.warn.endNotAfter', { where, fallback: fallback() }));
      else f.minutes = minutes;
    }
  }
  /* Ganztägig hin oder zurück, ohne ein Ende: ein Tag, eine Stunde. */
  if (raw.end === undefined && f.allDay !== !timedBefore) f.minutes = f.allDay ? 1440 : 60;
  if (f.allDay && f.minutes % 1440 !== 0) f.minutes = Math.max(1, Math.round(f.minutes / 1440)) * 1440;
  if (f.allDay && f.minutes > 60 * 1440) { warnings.push(t('bookings.plan.warn.max60', { where })); f.minutes = 60 * 1440; }
  if (!f.allDay && f.minutes > 14 * 1440) { warnings.push(t('bookings.plan.warn.max14', { where })); f.minutes = 14 * 1440; }

  /* -- Wiederholung. -- */
  if (raw.repeat !== undefined) {
    const wanted = typeof raw.repeat === 'string' ? lower(raw.repeat) : raw.repeat === null ? 'none' : '?';
    if ((REPEATS as readonly string[]).includes(wanted)) f.repeat = wanted as RepeatKind;
    else warnings.push(t('bookings.plan.warn.repeat', { where, was: f.repeat }));
  }
  if (f.repeat === 'none') {
    for (const key of ['every', 'weekdays', 'until', 'count']) {
      if (raw[key] !== undefined && raw[key] !== null) warnings.push(t('bookings.plan.warn.onlyRepeat', { where, key }));
    }
  } else {
    if (raw.every !== undefined) {
      const n = intOf(raw.every);
      if (n !== null && n >= 1 && n <= 52) f.every = n;
      else warnings.push(t('bookings.plan.warn.every', { where, was: f.every }));
    }
    if (f.repeat === 'weekly') {
      if (raw.weekdays !== undefined) {
        const words = Array.isArray(raw.weekdays) ? raw.weekdays : [raw.weekdays];
        let mask = 0;
        for (const w of words) {
          const at = typeof w === 'string' ? (WEEKDAY_WORDS as readonly string[]).indexOf(lower(w)) : -1;
          if (at >= 0) mask |= 1 << at;
          else warnings.push(t('bookings.plan.warn.weekday', { where, day: quote(String(w)), days: WEEKDAY_WORDS.join(', ') }));
        }
        if (mask !== 0) f.weekdays = mask;
      }
      if (f.weekdays === 0) f.weekdays = weekdayBit(day);
      if ((f.weekdays & weekdayBit(day)) === 0) {
        timingNotes.push(t('bookings.plan.warn.startNotInWeekdays', { where, day: weekdayWord(day), days: weekdayWords(f.weekdays).join(', ') }));
      }
    }
    if (raw.until !== undefined) {
      if (raw.until === null) f.until = null;
      else {
        const last = typeof raw.until === 'string' ? dayOf(raw.until.trim()) : null;
        if (last === null) warnings.push(t('bookings.plan.warn.until', { where }));
        else if (last.getTime() < day.getTime()) warnings.push(t('bookings.plan.warn.untilBefore', { where }));
        else f.until = dayText(last);
      }
    }
    if (raw.count !== undefined) {
      if (raw.count === null) f.count = null;
      else {
        const n = intOf(raw.count);
        if (n !== null && n >= 1 && n <= 1000) f.count = n;
        else warnings.push(t('bookings.plan.warn.count', { where }));
      }
    }
    /* Eine Reihe braucht am Dienst ein Ende — „bez końca" wie im Kalender: zehn Jahre. */
    if (f.until === null && f.count === null) {
      f.until = dayText(new Date(day.getFullYear() + 10, day.getMonth(), day.getDate()));
      timingNotes.push(t('bookings.plan.warn.tenYears', { where, until: f.until }));
    }
  }

  /* -- Fürs Reservieren. -- */
  if (raw.capacity !== undefined) {
    const n = raw.capacity === null ? null : intOf(raw.capacity);
    if (raw.capacity === null) f.capacity = null;
    else if (n !== null && n >= 1 && n <= MAX_CAPACITY) f.capacity = n;
    else warnings.push(t('bookings.plan.warn.capacity', { where, max: MAX_CAPACITY }));
  }
  if (raw.bookable !== undefined) {
    if (raw.bookable === null || typeof raw.bookable === 'boolean') f.bookable = raw.bookable;
    else warnings.push(t('bookings.plan.warn.bookable', { where }));
  }
  if (raw.reserveArea !== undefined) {
    const wanted = typeof raw.reserveArea === 'string' ? lower(raw.reserveArea) : raw.reserveArea === null ? '' : '?';
    if (wanted === '') f.reserveAreaId = null;
    else if (UUID.test(wanted) && areaOf.has(wanted)) f.reserveAreaId = wanted;
    else warnings.push(t('bookings.plan.warn.reserveArea', { where }));
  }

  /* Was die Zeit einer Reihe betrifft, sagt nur, wer sie anlegt oder ändert — nicht jeder unveränderte Export. */
  const out = normalise(f);
  if (was === null || TIMING.some((k) => was[k] !== out[k])) warnings.push(...timingNotes);
  return out;
}

/** Was sich an einem Termin ändert, in Worten. */
function slotDiff(a: SlotFields, b: SlotFields, areaName: (id: string) => string): string {
  const keys = changedKeys(a, b);
  const out: string[] = [];
  if (keys.some((k) => TIMING.includes(k))) out.push(`${t('bookings.plan.word.time')}: ${slotWhen(a)} → ${slotWhen(b)}`);
  const text = (key: 'title' | 'location' | 'link', word: string) => {
    if (keys.includes(key)) out.push(`${word}: ${a[key] === '' ? '—' : quote(a[key])} → ${b[key] === '' ? '—' : quote(b[key])}`);
  };
  text('title', t('bookings.plan.word.title'));
  text('location', t('bookings.plan.word.location'));
  if (keys.includes('notes')) out.push(b.notes === '' ? t('bookings.plan.word.notesRemoved') : t('bookings.plan.word.notesChanged'));
  text('link', t('bookings.plan.word.link'));
  if (keys.includes('linkLabel')) out.push(t('bookings.plan.word.linkLabel', { label: quote(b.linkLabel) }));
  const own = (n: number | null) => (n === null ? t('bookings.plan.word.asResource') : String(n));
  if (keys.includes('capacity')) out.push(`${t('bookings.plan.word.places')}: ${own(a.capacity)} → ${own(b.capacity)}`);
  const choose = (v: boolean | null) => (v === null ? t('bookings.plan.word.asResource') : v ? t('bookings.plan.word.yes') : t('bookings.plan.word.no'));
  if (keys.includes('bookable')) out.push(`${t('bookings.plan.word.bookable')}: ${choose(a.bookable)} → ${choose(b.bookable)}`);
  const who = (id: string | null) => (id === null ? t('bookings.plan.word.asResource') : quote(areaName(id)));
  if (keys.includes('reserveAreaId')) out.push(`${t('bookings.plan.word.reserves')}: ${who(a.reserveAreaId)} → ${who(b.reserveAreaId)}`);
  return out.join('; ');
}

/* -- Was an Reservierungen hängt ------------------------------------------------------------------------- */

const claimWhen = (c: OfficeClaim): string => {
  const s = new Date(c.startsAt);
  const e = new Date(c.endsAt);
  return `${dayText(s)} ${clock(s.getHours() * 60 + s.getMinutes())}–${dayText(e) === dayText(s) ? '' : `${dayText(e)} `}${clock(e.getHours() * 60 + e.getMinutes())}`;
};

/**
 * DIE RESERVIERUNGEN AN EINEM GEÄNDERTEN DING. Nichts davon ist eine Entscheidung — die trifft der Dienst bei
 * jeder Reservierung; hier wird nur gezählt, was schon dasteht, und gesagt, was mit ihm geschieht.
 */
function warnAboutClaims(input: {
  where: string; before: Rules; after: Rules; existing: ResourceState; claims: readonly OfficeClaim[];
  slots: readonly PlannedSlot[]; calendarMoves: boolean;
}, warnings: string[]): void {
  const { where, before, after, existing, claims, slots } = input;
  /* Die Zahl in Klammern — „rezerwacje (2)" stimmt im Polnischen für jede Zahl, ohne Fall und Endung. */
  const n = claims.length;

  if (before.mode !== after.mode) {
    warnings.push(t('bookings.plan.warn.modeChange', { where, n }));
  }
  if (after.mode === 'open' && before.mode === 'open') {
    const stricter = after.capacity < before.capacity || after.bufferBefore > before.bufferBefore || after.bufferAfter > before.bufferAfter
      || after.byNight !== before.byNight || after.checkInMin !== before.checkInMin || after.checkOutMin !== before.checkOutMin;
    if (stricter) warnings.push(t('bookings.plan.warn.stricter', { where, n }));
    return;
  }
  if (after.mode !== 'offered' || before.mode !== 'offered') return;
  if (input.calendarMoves) {
    warnings.push(t('bookings.plan.warn.calendarMoves', { where, n }));
    return;
  }

  /* Je Termin: was der Import an ihm ändert, und wer darauf sitzt. */
  const planned = new Map(slots.filter((s) => s.itemId !== null).map((s) => [lower(s.itemId!), s]));
  for (const slot of existing.slots) {
    const id = lower(slot.itemId);
    const on = claims.filter((c) => c.itemId !== null && lower(c.itemId) === id);
    if (on.length === 0) continue;
    const was = slotFieldsOf(slot.draft);
    const now = planned.get(id)?.fields ?? was;
    const name = quote(was.title === '' ? t('bookings.plan.slotLabel') : was.title);

    if (TIMING.some((k) => was[k] !== now[k])) {
      const days = new Set(on.map((c) => c.occurrenceAt ?? c.startsAt)).size;
      warnings.push(was.repeat === 'none' && now.repeat === 'none'
        ? t('bookings.plan.warn.slotMoves', { where, name, was: slotWhen(was), n: on.length, now: slotWhen(now) })
        : t('bookings.plan.warn.seriesMoves', { where, name, n: on.length, days }));
    }

    const capBefore = was.capacity ?? before.capacity;
    const capAfter = now.capacity ?? after.capacity;
    if (capAfter < capBefore) {
      const taken = new Map<string, number>();
      for (const c of on) {
        const at = c.occurrenceAt ?? c.startsAt;
        taken.set(at, (taken.get(at) ?? 0) + 1);
      }
      const over = [...taken.entries()].filter(([, k]) => k > capAfter);
      if (over.length > 0) {
        const first = on.find((c) => (c.occurrenceAt ?? c.startsAt) === over[0][0])!;
        warnings.push(t(over.length > 1 ? 'bookings.plan.warn.overCapacityDays' : 'bookings.plan.warn.overCapacity', { where, name, day: dayText(new Date(first.startsAt)), taken: over[0][1], before: capBefore, after: capAfter, days: over.length }));
      }
    }

    const offeredBefore = was.bookable ?? before.bookableDefault;
    const offeredAfter = now.bookable ?? after.bookableDefault;
    if (offeredBefore && !offeredAfter) {
      warnings.push(t('bookings.plan.warn.notChoosable', { where, name, n: on.length }));
    }
  }
}

/** Ein neuer oder verlegter einzelner Termin in der Zeit einer Reservierung auf einem anderen Termin desselben Dings. */
function warnAboutOverlaps(slots: readonly PlannedSlot[], label: string, claims: readonly OfficeClaim[], warnings: string[]): void {
  for (const slot of slots) {
    const f = slot.fields;
    if (f.repeat !== 'none') continue;
    if (slot.base !== null) {
      const was = slotFieldsOf(slot.base);
      if (!TIMING.some((k) => was[k] !== f[k])) continue;
    }
    const day = dayOf(f.date);
    if (day === null) continue;
    const from = wall(day, f.allDay ? 0 : minuteOf(f.time)).getTime();
    const to = from + f.minutes * 60_000;
    const hit = claims.find((c) => (slot.itemId === null || c.itemId === null || lower(c.itemId) !== lower(slot.itemId))
      && new Date(c.startsAt).getTime() < to && new Date(c.endsAt).getTime() > from);
    if (hit !== undefined) {
      warnings.push(t(slot.itemId === null ? 'bookings.plan.warn.overlapNew' : 'bookings.plan.warn.overlapMoved', { name: quote(slot.label), owner: label, when: slotWhen(f), claim: claimWhen(hit) }));
    }
  }
}
