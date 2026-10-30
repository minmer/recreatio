/**
 * 2026-10-29 — DIE TERMINE EINES KALENDERS ALS JSON („recreatio/calendar"): Export eines Zeitraums, Import an
 * Ort und Stelle, die Beschreibung daneben (`core/jsonTree.ts` — dieselbe für die App und den MCP-Katalog).
 * Rein: kein Dienst, kein Schlüssel. Geladen, versiegelt und geschrieben wird in `calendarJsonRun.ts`.
 *
 * <b>Dieselben Schlüssel wie die Termine einer Seite</b> (`appointmentsJson.ts`: "title", "start", "end",
 * "location", "points", "repeat" …) — ein Termin liest sich überall gleich. Anders als dort ändert dieser
 * Import AN ORT UND STELLE: was ein "id" aus dem Export trägt, wird geändert; was keines hat, entsteht. Ein
 * Schlüssel, der fehlt, lässt sein Feld, wie es ist — `{"id": …, "location": …}` genügt. Gelöscht wird nur,
 * was "remove": true sagt; die Vorschau nennt jede Änderung.
 *
 * <b>Eine Reihe hat Tage</b> ("occurrences"): abgesagt, verlegt, mit eigenen Werten ihres Schemas. Ein Tag
 * heisst nach seinem DATUM — so bleibt er derselbe, wenn sich die Uhrzeit der Reihe ändert; seine Kennung am
 * Dienst (den ursprünglichen Beginn) sucht der Import erst beim Schreiben, wenn er sie nicht schon kennt.
 *
 * <b>Was nicht hierher gehört, bleibt unberührt:</b> Intentionen (das Format der Messen), Einträge der Listen,
 * Reservierungen, wer da sein muss, wer den Termin sieht (das sagt der Kalender).
 */

import { keyLines, pretty, type JsonNode, type JsonSample } from '../core/jsonTree';
import { ITEM_KINDS, ITEM_LABEL, REPEAT_KINDS, REPEAT_LABEL, safeLink, type CalendarRow, type ItemKind, type RepeatKind } from './calendar';
import { LITURGICAL_COLOURS, shownFields, UNIVERSAL, UNIVERSAL_ID, type SchemeDef, type SchemeField } from './scheme';
import { SCHEME_FIELD_JSON } from './schemeJson';
import { draftValues, editText, type DraftValue, type OpenValue } from './schemeValues';

export const CALENDAR_FORMAT = 'recreatio/calendar';
export const CALENDAR_VERSION = 1;

/** Höchstens so viele Termine samt Punkten je Dokument — ein Jahr Messen aus einem Plan passt hinein. */
export const MAX_ENTRIES = 3000;
/** So tief steckt ein Programm höchstens (Termin → Punkt → …) — wie am Dienst (`MaxProgramDepth`). */
export const MAX_DEPTH = 8;
/** Höchstens so viele Tage einer Reihe in "occurrences". */
export const MAX_OCCURRENCES = 500;
/** Die Grenzen des Editors — dieselben hier. */
export const LIMITS = { title: 200, location: 300, notes: 10_000, link: 1000, linkLabel: 60 } as const;
const MAX_EVERY = 52;
const MAX_COUNT = 999;
const MAX_CAPACITY = 10_000;
/** Wie lange ein Termin höchstens dauert — wie am Dienst (14 Tage, ganztägig 60 Tage). */
const MAX_TIMED_MINUTES = 14 * 1440;
const MAX_ALL_DAYS = 60;
/** Ein offener Wert hängt aus (am Dienst höchstens 400 Zeichen); ein versiegelter darf länger sein. */
const PUBLIC_VALUE = 400;
const SEALED_VALUE = 4000;
/** „Bez końca" steht im Kalender als zehn Jahre voraus — ab neun Jahren schreibt der Export kein "until". */
const ENDLESS_DAYS = 9 * 365;
/** So viele Zeilen je Art zeigt die Vorschau einzeln — der Rest steht als Zahl da. */
const SHOWN_LINES = 100;

const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const;
/** Die Arten, die ein Dokument nennen darf — `task` nur, wo er schon steht (Altbestand). */
const KINDS: readonly string[] = ITEM_KINDS.filter((k) => k !== 'task');
/** Der Gottesdienst: sein Name hängt offen aus (Messplan, Gablota). */
const LITURGY: readonly string[] = ['mass', 'confession', 'devotion'];
const KIND_WORD: Readonly<Record<string, string>> = {
  appointment: 'Termin', task: 'Zadanie', mass: 'Msza', confession: 'Spowiedź', visit: 'Odwiedziny', devotion: 'Nabożeństwo'
};

/* -- Was der Plan vom Kalender weiss (geladen in `calendarJsonRun.ts`) --------------------------------- */

/** Der Kalender, in den importiert wird. */
export interface CalendarInfo {
  readonly calendarId: string;
  readonly title: string;
  /** Die Art seiner Termine — ein neuer ohne "kind" ist das. */
  readonly itemKind: string;
  /** Hat er Regeln fürs Reservieren — nur dann gelten "bookable" und "capacity". */
  readonly booking: boolean;
  /** Der private Kalender („Tylko ja"): dort gibt es keinen Gottesdienst und keinen offenen Titel. */
  readonly personal: boolean;
  /** Wer seine Termine sieht — darunter wird ein neuer versiegelt. */
  readonly visibilityAreaId: string;
  /** Wie lange ein neuer Termin ohne "end" dauert. */
  readonly durationMinutes: number;
}

/** Ein Vorkommen einer Reihe, wie der Kalender es kennt. */
export interface StateOccurrence {
  /** Sein Name: der ursprüngliche Beginn (ISO). */
  readonly at: string;
  /** Wann es wirklich ist (verlegt: nicht `at`). */
  readonly startsAt: string;
  readonly cancelled: boolean;
  readonly moved: boolean;
  /** Die Werte dieses Tages, geöffnet. */
  readonly values: ReadonlyMap<string, OpenValue>;
  /** Ging jeder Wert dieses Tages auf? Sonst wird er nicht neu geschrieben (das Ungeöffnete fiele weg). */
  readonly valuesComplete: boolean;
}

/** Ein Termin (die ganze Reihe), geöffnet. */
export interface StateItem {
  readonly itemId: string;
  readonly kind: string;
  readonly visibilityAreaId: string;
  /** Der eigene Name (versiegelt oder offen) — `null`: keiner („Msza"). */
  readonly title: string | null;
  readonly location: string | null;
  readonly notes: string | null;
  readonly link: string | null;
  readonly linkLabel: string | null;
  /** Ein versiegeltes Feld ging nicht auf: dann wird der Termin nicht neu gespeichert — es fiele sonst weg. */
  readonly unreadable: boolean;
  /** Die Reihe: Beginn und Ende des ersten Vorkommens (ISO). */
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly repeat: RepeatKind;
  readonly every: number;
  readonly weekdays: number | null;
  readonly until: string | null;
  readonly count: number | null;
  readonly parentItemId: string | null;
  readonly position: number | null;
  /** `null`: das universelle Schema. */
  readonly schemeId: string | null;
  readonly values: ReadonlyMap<string, OpenValue>;
  readonly valuesComplete: boolean;
  readonly bookable: boolean | null;
  readonly capacity: number | null;
  readonly reserveAreaId: string | null;
  /** Die geladenen Vorkommen (nur aus den geladenen Tagen). */
  readonly occurrences: readonly StateOccurrence[];
}

export interface StateScheme {
  readonly id: string;
  readonly def: SchemeDef;
}

export interface CalendarState {
  readonly calendar: CalendarInfo;
  readonly items: readonly StateItem[];
  readonly schemes: readonly StateScheme[];
  /** Welche Tage geladen sind (Ortszeit, einschliesslich) — darin ist jedes Vorkommen bekannt. */
  readonly spans: readonly { readonly from: string; readonly to: string }[];
}

/** Was eine Zeile der Kalenderliste dem Plan sagt. */
export function infoOf(calendar: CalendarRow, personalAreaId: string | null): CalendarInfo {
  return {
    calendarId: calendar.calendarId,
    title: calendar.title,
    itemKind: calendar.itemKind ?? 'appointment',
    booking: calendar.booking != null,
    personal: personalAreaId !== null && sameId(calendar.areaId, personalAreaId),
    visibilityAreaId: calendar.visibilityAreaId ?? calendar.areaId,
    durationMinutes: calendar.durationMinutes ?? 60
  };
}

/* -- Kleinigkeiten ------------------------------------------------------------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const two = (n: number) => String(n).padStart(2, '0');
/** Ein Tag in Ortszeit — „2026-11-05". */
export const dayOf = (at: Date): string => `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
/** Eine Uhrzeit in Ortszeit — „19:00". */
export const clockOf = (at: Date): string => `${two(at.getHours())}:${two(at.getMinutes())}`;
const stampOf = (at: Date): string => `${dayOf(at)}T${clockOf(at)}`;
/** Kennungen kommen mal gross, mal klein geschrieben — dieselbe ist dieselbe. */
const sameId = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AT_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/;
const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;
const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/i;

/** Ein Tag, den es gibt („2026-02-30" gibt es nicht). */
function validDay(y: number, m: number, d: number): Date | null {
  const at = new Date(y, m - 1, d);
  return at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d ? at : null;
}

/** „RRRR-MM-DD" → lokale Mitternacht, sonst `null`. */
export function readDay(value: unknown): Date | null {
  const m = typeof value === 'string' ? DAY_RE.exec(value.trim()) : null;
  return m === null ? null : validDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

interface When { readonly day: Date; readonly minute: number | null }

/** „2026-12-05T18:00", „2026-12-05" — oder, wo ein Tag schon feststeht, „18:00" an ihm. */
function readWhen(value: unknown, sameDay: Date | null): When | null {
  const text = typeof value === 'string' ? value.trim() : '';
  let m = AT_RE.exec(text);
  if (m !== null) {
    const day = validDay(Number(m[1]), Number(m[2]), Number(m[3]));
    const h = Number(m[4]), min = Number(m[5]);
    return day === null || h > 23 || min > 59 ? null : { day, minute: h * 60 + min };
  }
  m = DAY_RE.exec(text);
  if (m !== null) {
    const day = validDay(Number(m[1]), Number(m[2]), Number(m[3]));
    return day === null ? null : { day, minute: null };
  }
  m = CLOCK_RE.exec(text);
  if (m !== null && sameDay !== null) {
    const h = Number(m[1]), min = Number(m[2]);
    return h > 23 || min > 59 ? null : { day: sameDay, minute: h * 60 + min };
  }
  return null;
}

const atOf = (day: Date, minute: number): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60);
const plusDays = (day: Date, n: number): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
/** Kalendertage zwischen zwei Tagen — nicht 24-Stunden-Schritte (die Umstellung der Uhr). */
const daysBetween = (a: Date, b: Date): number =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
const minuteOf = (clock: string): number => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
const clockText = (minute: number): string => `${two(Math.floor(minute / 60))}:${two(minute % 60)}`;
/** Der Tag der Woche als Bit — pn=1 … nd=64, wie `Zones.BitOf` am Dienst. */
const bitOf = (day: Date): number => 1 << ((day.getDay() + 6) % 7);
const startOfDay = (at: Date): Date => new Date(at.getFullYear(), at.getMonth(), at.getDate());
const tenYears = (day: Date): string => dayOf(new Date(day.getFullYear() + 10, day.getMonth(), day.getDate()));

/** Wie ein Eintrag ohne eigenen Namen heisst: „Msza", „Nabożeństwo". */
export const kindWord = (kind: string): string => KIND_WORD[kind] ?? 'Termin';

/** Geht der Titel offen hinaus? Wie im Editor: das Schema sagt es, sonst beim Gottesdienst — im privaten Kalender nie. */
const publicTitleOf = (calendar: CalendarInfo, def: SchemeDef | null, kind: string): boolean =>
  !calendar.personal && (def?.publicTitle ?? LITURGY.includes(kind));

/** Zwei Zuordnungen Feld → Text, gleich? */
const sameTexts = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if ((a[key] ?? '') !== (b[key] ?? '')) return false;
  return true;
};

/** Die Texte der Werte, wie im Editor (eine Wahl als ihr Wert, eine Zahl ohne Einheit). Unbekanntes Schema: wie sie liegen. */
function textsOf(def: SchemeDef | null, fields: readonly SchemeField[], values: ReadonlyMap<string, OpenValue>): Record<string, string> {
  const out: Record<string, string> = {};
  if (def === null) {
    for (const [key, value] of values) if (value.text !== '') out[key] = value.text;
    return out;
  }
  for (const f of fields) {
    const text = editText(f, values.get(f.key));
    if (text !== '') out[f.key] = text;
  }
  return out;
}

/* -- Ein Termin, wie er ist (zum Vergleichen) ---------------------------------------------------------- */

interface Core {
  readonly kind: string;
  readonly title: string;
  readonly location: string;
  readonly notes: string;
  readonly link: string;
  readonly linkLabel: string;
  readonly day: string;
  readonly clock: string;
  readonly minutes: number;
  readonly allDay: boolean;
  readonly repeat: RepeatKind;
  readonly every: number;
  readonly weekdays: number;
  readonly until: string | null;
  /** „Bez końca": zehn Jahre voraus. */
  readonly endless: boolean;
  readonly count: number | null;
}

function coreOf(item: StateItem): Core {
  const start = new Date(item.startsAt);
  const repeat = item.repeat;
  const until = repeat === 'none' || item.until === null ? null : dayOf(new Date(item.until));
  const count = repeat === 'none' ? null : item.count;
  return {
    kind: item.kind,
    title: item.title ?? '',
    location: item.location ?? '',
    notes: item.notes ?? '',
    link: item.link ?? '',
    linkLabel: item.linkLabel ?? '',
    day: dayOf(start),
    clock: item.allDay ? '00:00' : clockOf(start),
    minutes: Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000),
    allDay: item.allDay,
    repeat,
    every: repeat === 'none' ? 1 : Math.max(1, item.every),
    weekdays: repeat === 'weekly' ? (item.weekdays ?? 0) & 127 || bitOf(start) : 0,
    until,
    endless: until !== null && count === null && daysBetween(startOfDay(start), readDay(until) ?? startOfDay(start)) >= ENDLESS_DAYS,
    count
  };
}

/** Die Reihenfolge unter einem Ganzen: erst die Stelle, sonst die Zeit (wie `program.byPlace`). */
const byPlace = (a: StateItem, b: StateItem): number =>
  ((a.position ?? 1e9) - (b.position ?? 1e9)) || Date.parse(a.startsAt) - Date.parse(b.startsAt);

/* -- Export -------------------------------------------------------------------------------------------- */

export interface CalendarExport {
  readonly doc: Record<string, unknown>;
  /** Was im Export fehlt und warum (versiegelt mit einem Schlüssel, den man nicht hat …). */
  readonly warnings: readonly string[];
}

/** Ein Feld eines Schemas, wie es im Format der Schemata steht (`schemeJson.ts`). */
function fieldOut(f: SchemeField): Record<string, unknown> {
  return {
    key: f.key, label: f.label, type: f.type,
    ...(f.level === 'day' ? { level: 'day' } : {}),
    ...(f.public === true ? { public: true } : {}),
    ...(f.required === true ? { required: true } : {}),
    ...(f.options !== undefined && f.options.length > 0
      ? { options: f.options.map((o) => (o.value === o.label ? o.value : { value: o.value, label: o.label })) } : {}),
    ...(f.unit ? { unit: f.unit } : {}),
    ...(f.onlyKinds !== undefined && f.onlyKinds.length > 0 ? { onlyKinds: [...f.onlyKinds] } : {}),
    ...(f.says ? { says: f.says } : {})
  };
}

/**
 * DER EXPORT — die Termine des geladenen Zeitraums, Punkte unter ihrem Ganzen. Ein Punkt, dessen Ganzes nicht
 * mitkommt, steht oben, mit "parent".
 */
export function exportCalendar(state: CalendarState): CalendarExport {
  const warnings: string[] = [];
  const schemeById = new Map(state.schemes.map((s) => [s.id.toLowerCase(), s]));
  const names = new Map<string, number>();
  for (const s of state.schemes) names.set(s.def.name.trim().toLowerCase(), (names.get(s.def.name.trim().toLowerCase()) ?? 0) + 1);
  /* Ein Schema beim Namen, wenn der eindeutig ist — sonst bei seiner Kennung. */
  const schemeRef = (id: string): string => {
    const found = schemeById.get(id.toLowerCase());
    return found !== undefined && names.get(found.def.name.trim().toLowerCase()) === 1 ? found.def.name : id;
  };
  const defOf = (id: string | null): SchemeDef | null => (id === null ? UNIVERSAL : schemeById.get(id.toLowerCase())?.def ?? null);

  const items = [...state.items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.itemId.localeCompare(b.itemId));
  const byId = new Map(items.map((i) => [i.itemId.toLowerCase(), i]));
  const childrenOf = new Map<string, StateItem[]>();
  const tops: StateItem[] = [];
  for (const item of items) {
    const parent = item.parentItemId === null ? undefined : byId.get(item.parentItemId.toLowerCase());
    if (parent !== undefined && parent !== item) {
      const key = parent.itemId.toLowerCase();
      childrenOf.set(key, [...(childrenOf.get(key) ?? []), item]);
    } else {
      tops.push(item);
    }
  }

  const done = new Set<string>();
  const entryOf = (item: StateItem, top: boolean, depth: number): Record<string, unknown> => {
    done.add(item.itemId.toLowerCase());
    const core = coreOf(item);
    const def = defOf(item.schemeId);
    const label = item.title ?? kindWord(item.kind);
    if (item.unreadable) warnings.push(`„${label}” (${core.day}): część pól jest zaszyfrowana kluczem, którego nie masz — w eksporcie bez nich.`);
    if (def === null && item.schemeId !== null) warnings.push(`„${label}” (${core.day}): schematu tego terminu nie da się odczytać — wartości bez opisu.`);

    const out: Record<string, unknown> = { id: item.itemId, kind: item.kind };
    if (item.title !== null && item.title !== '') out.title = item.title;
    if (item.allDay) {
      const days = Math.max(1, Math.round(core.minutes / 1440));
      out.start = core.day;
      out.end = dayOf(plusDays(readDay(core.day)!, days - 1));
    } else {
      const end = new Date(item.endsAt);
      out.start = stampOf(new Date(item.startsAt));
      out.end = dayOf(end) === core.day ? clockOf(end) : stampOf(end);
    }
    if (core.location !== '') out.location = core.location;
    if (core.notes !== '') out.notes = core.notes;
    if (core.link !== '') {
      out.link = core.link;
      if (core.linkLabel !== '') out.linkLabel = core.linkLabel;
    }
    if (core.repeat !== 'none') {
      out.repeat = core.repeat;
      if (core.every > 1) out.every = core.every;
      if (core.repeat === 'weekly') out.weekdays = WEEKDAY_WORDS.filter((_, i) => (core.weekdays & (1 << i)) !== 0);
      if (core.count !== null) out.count = core.count;
      else if (core.until !== null && !core.endless) out.until = core.until;
    }
    if (item.bookable !== null) out.bookable = item.bookable;
    if (item.capacity !== null) out.capacity = item.capacity;
    /* Hat der Kalender Schemata, sagt das Dokument auch „das universelle" (null) — eine Kopie bekäme sonst das Schema ihrer Art. */
    if (item.schemeId !== null) out.scheme = schemeRef(item.schemeId);
    else if (state.schemes.length > 0) out.scheme = null;

    const itemValues = textsOf(def, def === null ? [] : shownFields(def, item.kind, 'item'), item.values);
    if (Object.keys(itemValues).length > 0) out.values = itemValues;

    const dayFields = def === null ? [] : shownFields(def, item.kind, 'day');
    const days: Record<string, unknown>[] = [];
    for (const one of [...item.occurrences].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      const entry: Record<string, unknown> = { date: dayOf(new Date(one.at)) };
      if (one.cancelled) entry.cancelled = true;
      else if (one.moved) entry.start = stampOf(new Date(one.startsAt));
      const values = textsOf(def, dayFields, one.values);
      if (Object.keys(values).length > 0) entry.values = values;
      if (Object.keys(entry).length > 1) days.push(entry);
    }
    if (days.length > MAX_OCCURRENCES) {
      warnings.push(`„${label}”: ${days.length} wyjątkowych dni — w eksporcie pierwsze ${MAX_OCCURRENCES} (wybierz krótszy zakres, aby zobaczyć resztę).`);
      days.length = MAX_OCCURRENCES;
    }
    if (days.length > 0) out.occurrences = days;

    const kids = (childrenOf.get(item.itemId.toLowerCase()) ?? []).filter((k) => !done.has(k.itemId.toLowerCase())).sort(byPlace);
    if (kids.length > 0 && depth + 1 < MAX_DEPTH) out.points = kids.map((k) => entryOf(k, false, depth + 1));
    if (top && item.parentItemId !== null) out.parent = item.parentItemId;
    return out;
  };

  const appointments = tops.map((one) => entryOf(one, true, 0));
  /* Was in keinem Baum landete (ein Kreis, zu tief): oben, mit seinem Ganzen als "parent". */
  for (const item of items) if (!done.has(item.itemId.toLowerCase())) appointments.push(entryOf(item, true, 0));

  const spans = state.spans;
  const doc: Record<string, unknown> = {
    format: CALENDAR_FORMAT,
    version: CALENDAR_VERSION,
    calendar: { id: state.calendar.calendarId, title: state.calendar.title, kind: state.calendar.itemKind },
    ...(spans.length > 0 ? {
      range: { from: spans.map((s) => s.from).sort()[0], to: spans.map((s) => s.to).sort()[spans.length - 1] }
    } : {}),
    ...(state.schemes.length > 0 ? {
      schemes: state.schemes.map((s) => ({
        id: s.id, name: s.def.name,
        ...(s.def.kind !== undefined ? { kind: s.def.kind } : {}),
        ...(s.def.kinds !== undefined && s.def.kinds.length > 0 ? { kinds: [...s.def.kinds] } : {}),
        fields: s.def.fields.map(fieldOut)
      }))
    } : {}),
    appointments
  };
  return { doc, warnings };
}

/* -- Was ein Dokument braucht (bevor geplant wird) ----------------------------------------------------- */

/** Der Name eines anderen Kalenders, wenn das Dokument aus ihm stammt — sonst `null`. */
function foreignTitle(value: Record<string, unknown>, calendarId: string): string | null {
  const calendar = value.calendar;
  if (!isRecord(calendar) || typeof calendar.id !== 'string' || calendar.id.trim() === '') return null;
  if (sameId(calendar.id.trim(), calendarId)) return null;
  return typeof calendar.title === 'string' ? calendar.title.trim() : '';
}

/** Ein Dokument, das sich gar nicht lesen lässt — sofort, ohne den Kalender zu laden. */
export function docProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'To nie są terminy kalendarza (oczekiwano obiektu JSON).';
  if (value.format !== undefined && value.format !== CALENDAR_FORMAT) {
    return `To nie są terminy kalendarza („format”: ${String(value.format)}) — oczekiwano "${CALENDAR_FORMAT}".`;
  }
  if (!Array.isArray(value.appointments)) return 'Brakuje listy "appointments".';
  return null;
}

export interface DocNeeds {
  /** Termine mit "id" und Ganze ausserhalb des Dokuments ("parent") — die muss der Plan kennen. */
  readonly ids: readonly string[];
  /** Die Tage, an denen sie stehen, und "range" — dort wird zuerst gesucht. */
  readonly from: string | null;
  readonly to: string | null;
}

/**
 * Was der Plan vom Kalender braucht: die Termine mit "id" — gesucht an den Tagen des Exports ("range"), an den
 * Tagen einzelner Termine und den genannten Tagen der Reihen (eine Reihe findet sich in jedem Zeitraum, in den
 * sie reicht). Ein Dokument ohne "id" braucht keinen Termin des Kalenders.
 */
export function docNeeds(value: unknown, calendarId: string): DocNeeds {
  if (docProblem(value) !== null || !isRecord(value) || foreignTitle(value, calendarId) !== null) return { ids: [], from: null, to: null };
  const ids = new Set<string>();
  const days: string[] = [];
  const range = isRecord(value.range) ? value.range : {};
  for (const one of [range.from, range.to]) {
    const day = readDay(one);
    if (day !== null) days.push(dayOf(day));
  }
  let seen = 0;
  const walk = (list: readonly unknown[], depth: number) => {
    for (const one of list) {
      if (!isRecord(one) || seen >= MAX_ENTRIES) continue;
      seen += 1;
      const id = typeof one.id === 'string' ? one.id.trim() : '';
      if (id !== '') {
        ids.add(id.toLowerCase());
        if (one.repeat === undefined || one.repeat === 'none') {
          const when = readWhen(one.start, null);
          if (when !== null) days.push(dayOf(when.day));
        }
        for (const day of Array.isArray(one.occurrences) ? one.occurrences : []) {
          const at = isRecord(day) ? readDay(day.date) : null;
          if (at !== null) days.push(dayOf(at));
        }
      }
      if (typeof one.parent === 'string' && one.parent.trim() !== '' && !one.parent.trim().startsWith('@')) ids.add(one.parent.trim().toLowerCase());
      if (Array.isArray(one.points) && depth < MAX_DEPTH) walk(one.points, depth + 1);
    }
  };
  walk(value.appointments as unknown[], 0);
  days.sort();
  return { ids: [...ids], from: days[0] ?? null, to: days[days.length - 1] ?? null };
}

/* -- Der Plan ------------------------------------------------------------------------------------------ */

/** Was ein Termin am Dienst wird — so, wie `saveEvent` es nimmt (ohne Bereich, Person, Kalender). */
export interface ItemSave {
  readonly kind: string;
  readonly title: string;
  readonly location: string;
  readonly notes: string;
  readonly link: string;
  readonly linkLabel: string;
  /** Ortszeit — „2026-11-05", „19:00" („00:00" ganztägig). */
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly allDay: boolean;
  readonly repeat: RepeatKind;
  readonly every: number;
  readonly weekdays: number;
  readonly until: string | null;
  readonly count: number | null;
  readonly bookable: boolean | null;
  readonly capacity: number | null;
  /** `undefined`: bleibt (beim Ändern); `null`: das universelle. */
  readonly schemeId: string | null | undefined;
  /** `undefined`: bleiben, wie sie sind. */
  readonly values: readonly DraftValue[] | undefined;
  /** Der Titel offen (das Schema sagt es) — `undefined`: wie die Art es will. */
  readonly publicTitle: boolean | undefined;
}

/** Unter welchem Ganzen: einem Termin des Dokuments (seine Stelle im Plan) oder einem bestehenden. */
export type ParentRef = { readonly ref: number } | { readonly itemId: string };

/** Was an einem Tag einer Reihe geschieht. */
export interface OccurrenceOp {
  /** Der Tag (Ortszeit) — daran wird das Vorkommen beim Schreiben gefunden. */
  readonly day: string;
  /** Sein Name am Dienst, wenn schon bekannt (die Zeit der Reihe ändert sich nicht). */
  readonly at: string | null;
  readonly cancel?: true;
  readonly restore?: true;
  /** Verlegt auf (ISO). */
  readonly moveTo?: string;
  /** Die Werte des Tages — ersetzen, was dort steht. */
  readonly values?: readonly DraftValue[];
}

export interface PlannedItem {
  /** Die Stelle im Dokument (für Verweise der Punkte). */
  readonly ref: number;
  readonly label: string;
  /** Ein bestehender Termin — oder `null` (neu). */
  readonly itemId: string | null;
  readonly state: StateItem | null;
  /** Was gespeichert wird — `null`: am Termin selbst nichts. */
  readonly save: ItemSave | null;
  /** Unter welches Ganze: `undefined` — bleibt; `null` — keines (mehr). */
  readonly parent: ParentRef | null | undefined;
  /** An welche Stelle unter seinem Ganzen — `undefined`: bleibt. */
  readonly position: number | null | undefined;
  /** Ganzes oder Stelle ändern sich (beim bestehenden). */
  readonly program: boolean;
  readonly occurrences: readonly OccurrenceOp[];
  /** Die Reihe ändert ihre Zeit: am Dienst fallen dann ihre Ausnahmen (die aus dem Dokument kommen wieder). */
  readonly retimed: boolean;
  /** Was sich ändert, in Worten (beim bestehenden). */
  readonly changes: readonly string[];
}

export interface PlannedRemoval {
  readonly itemId: string;
  readonly label: string;
  /** Wie viele Punkte darunter (soweit geladen) mitgehen. */
  readonly points: number;
}

export interface CalendarPlan {
  /** In der Reihenfolge des Schreibens: jedes Ganze vor seinen Punkten. */
  readonly items: readonly PlannedItem[];
  readonly removals: readonly PlannedRemoval[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  /** Aus einem anderen Kalender: alles wird neu angelegt. */
  readonly foreign: boolean;
  readonly counts: {
    readonly created: number;
    readonly changed: number;
    readonly unchanged: number;
    readonly removed: number;
    readonly days: number;
    readonly skipped: number;
  };
}

/** Wohin ein Termin des Dokuments gehört — wie er es sagt. */
type ParentWish =
  | { readonly kind: 'keep' }
  | { readonly kind: 'none' }
  | { readonly kind: 'ref'; readonly ref: number }
  | { readonly kind: 'id'; readonly itemId: string };

interface Raw {
  readonly ref: number;
  readonly where: string;
  readonly row: Record<string, unknown>;
  readonly enclosing: number | null;
}

/** Wie ein Termin in der Vorschau heisst: „Próba scholi" (2026-11-05 19:00). */
const named = (title: string, kind: string): string => (title.trim() !== '' ? title.trim() : kindWord(kind));

/** Ein Wert eines Feldes aus dem Dokument — `undefined`: unlesbar (mit Warnung); `''`: leeren. */
function readValue(field: SchemeField, raw: unknown, warn: (text: string) => void): string | undefined {
  let text: string;
  if (raw === null) return '';
  if (typeof raw === 'boolean') text = field.type === 'bool' ? (raw ? 'tak' : 'nie') : String(raw);
  else if (typeof raw === 'number' && Number.isFinite(raw)) text = String(raw);
  else if (typeof raw === 'string') text = raw.trim();
  else { warn(`wartość pola „${field.label}” to tekst — pominięta.`); return undefined; }
  if (text === '') return '';

  switch (field.type) {
    case 'choice':
    case 'colour': {
      const options = field.options !== undefined && field.options.length > 0 ? field.options : field.type === 'colour' ? LITURGICAL_COLOURS : [];
      if (options.length === 0) break;
      const low = text.toLowerCase();
      const found = options.find((o) => o.value.toLowerCase() === low) ?? options.find((o) => o.label.toLowerCase() === low);
      if (found === undefined) {
        warn(`„${text}” nie ma na liście pola „${field.label}” (${options.map((o) => o.value).join(', ')}) — pominięte.`);
        return undefined;
      }
      return found.value;
    }
    case 'number':
      if (!/^-?\d+(?:[.,]\d+)?$/.test(text)) { warn(`pole „${field.label}” to liczba — „${text}” pominięte.`); return undefined; }
      return text.replace(',', '.');
    case 'bool': {
      const low = text.toLowerCase();
      if (low === 'tak' || low === 'true') return 'tak';
      if (low === 'nie' || low === 'false') return 'nie';
      warn(`pole „${field.label}” to "tak" albo "nie" — „${text}” pominięte.`);
      return undefined;
    }
    case 'date':
      if (readDay(text) === null) { warn(`pole „${field.label}” to dzień "RRRR-MM-DD" — „${text}” pominięte.`); return undefined; }
      return text;
    case 'time': {
      const m = CLOCK_RE.exec(text);
      if (m === null || Number(m[1]) > 23 || Number(m[2]) > 59) { warn(`pole „${field.label}” to godzina "GG:MM" — „${text}” pominięte.`); return undefined; }
      return `${two(Number(m[1]))}:${m[2]}`;
    }
    case 'link':
      if (safeLink(text) === null) { warn(`pole „${field.label}” to link https://… albo #/… — „${text}” pominięte.`); return undefined; }
      break;
    default:
      break;
  }
  const limit = field.public === true ? PUBLIC_VALUE : SEALED_VALUE;
  if (text.length > limit) {
    warn(`wartość pola „${field.label}” ma ponad ${limit} znaków — przycięta.`);
    return text.slice(0, limit);
  }
  return text;
}

/** Die Tage der Woche — Wörter („pn" … „nd", auch „sb") oder Zahlen 1–7 (1 = poniedziałek). */
function readWeekdays(value: unknown, warn: (text: string) => void): number {
  if (!Array.isArray(value)) { warn(`"weekdays" to lista dni (${WEEKDAY_WORDS.join(', ')}) — bez zmian.`); return 0; }
  let bits = 0;
  for (const one of value) {
    const word = typeof one === 'string' ? one.trim().toLowerCase() : '';
    const at = typeof one === 'number' && Number.isInteger(one) && one >= 1 && one <= 7 ? one - 1
      : word === 'sb' ? 5 : (WEEKDAY_WORDS as readonly string[]).indexOf(word);
    if (at >= 0) bits |= 1 << at;
    else warn(`dzień „${String(one)}” — dni to ${WEEKDAY_WORDS.join(', ')} (albo 1–7).`);
  }
  if (bits === 0) warn('"weekdays" bez żadnego dnia — bez zmian.');
  return bits;
}

/** Das Wann einer Vorschauzeile: „2026-11-05 19:00, co tydzień (cz) do 2027-06-24". */
function whenWords(save: ItemSave): string {
  const day = readDay(save.date)!;
  const days = Math.max(1, Math.round(save.minutes / 1440));
  const at = save.allDay ? `${save.date}${days > 1 ? ` – ${dayOf(plusDays(day, days - 1))}` : ''} (cały dzień)` : `${save.date} ${save.time}`;
  if (save.repeat === 'none') return at;
  const weekdays = save.repeat === 'weekly' ? ` (${WEEKDAY_WORDS.filter((_, i) => (save.weekdays & (1 << i)) !== 0).join(', ')})` : '';
  const every = save.every > 1 ? `, co ${save.every}` : '';
  const end = save.count !== null ? `, ${save.count} razy`
    : save.until !== null && daysBetween(day, readDay(save.until) ?? day) < ENDLESS_DAYS ? ` do ${save.until}` : ', bez końca';
  return `${at}, ${REPEAT_LABEL[save.repeat]}${weekdays}${every}${end}`;
}

/**
 * DER PLAN — was ein Dokument am Kalender ändern würde, mit jeder Warnung. Ändert nichts; `calendarJsonRun.ts`
 * führt ihn aus. `state`: die Termine, auf die das Dokument mit "id" zeigt (`docNeeds`), und die Schemata.
 */
export function planCalendar(value: unknown, state: CalendarState): CalendarPlan | { error: string } {
  const problem = docProblem(value);
  if (problem !== null || !isRecord(value)) return { error: problem ?? 'To nie są terminy kalendarza.' };
  const calendar = state.calendar;
  const warnings: string[] = [];

  for (const key of Object.keys(value)) if (!(key in DOC_KEYS)) warnings.push(`Nieznany klucz "${key}" — pominięty.`);
  if (value.version !== undefined && value.version !== CALENDAR_VERSION) {
    warnings.push(`"version": ${JSON.stringify(value.version)} — ta aplikacja czyta wersję ${CALENDAR_VERSION}.`);
  }
  if (value.calendar !== undefined && !isRecord(value.calendar)) warnings.push('"calendar" to obiekt {"id","title","kind"} — pominięty.');
  const foreign = foreignTitle(value, calendar.calendarId);
  if (foreign !== null) {
    warnings.push(`Dokument z innego kalendarza${foreign === '' ? '' : ` („${foreign}”)`} — jego terminy zostaną dodane tutaj jako nowe; "remove" i "parent" z identyfikatorem pominięte.`);
  }

  /* 1 — die Termine flach, Punkte mit ihrem Ganzen. */
  const raws: Raw[] = [];
  let overflow = 0;
  const flatten = (list: readonly unknown[], where: string, enclosing: number | null, depth: number) => {
    list.forEach((one, i) => {
      const at = `${where}[${i}]`;
      if (!isRecord(one)) { warnings.push(`${at}: to nie obiekt — pominięty.`); return; }
      if (raws.length >= MAX_ENTRIES) { overflow += 1; return; }
      const ref = raws.length;
      raws.push({ ref, where: at, row: one, enclosing });
      if (one.points === undefined) return;
      if (!Array.isArray(one.points)) { warnings.push(`${at}: "points" to lista — pominięte.`); return; }
      if (depth + 1 >= MAX_DEPTH) { warnings.push(`${at}: program głębszy niż ${MAX_DEPTH} poziomów — dalsze punkty pominięte.`); return; }
      flatten(one.points, `${at}.points`, ref, depth + 1);
    });
  };
  flatten(value.appointments as unknown[], 'appointments', null, 0);
  if (overflow > 0) warnings.push(`Najwyżej ${MAX_ENTRIES} terminów (z punktami) w jednym dokumencie — pominięto ${overflow}.`);

  const who = (raw: Raw): string => {
    const title = typeof raw.row.title === 'string' ? raw.row.title.trim() : '';
    return title === '' ? raw.where : `${raw.where} „${title}”`;
  };
  for (const raw of raws) {
    for (const key of Object.keys(raw.row)) if (!(key in APPOINTMENT_KEYS)) warnings.push(`${who(raw)}: nieznany klucz "${key}" — pominięty.`);
  }

  /* 2 — welche es schon gibt ("id"), ihre Namen ("key"), was fallen soll ("remove"). */
  const stateById = new Map(state.items.map((i) => [i.itemId.toLowerCase(), i]));
  const itemOf: (StateItem | null)[] = raws.map(() => null);
  const skipped = new Set<number>();
  const seenIds = new Set<string>();
  const keyRef = new Map<string, number>();
  for (const raw of raws) {
    const { row } = raw;
    if (row.id !== undefined && row.id !== null && foreign === null) {
      const id = typeof row.id === 'string' ? row.id.trim().toLowerCase() : '';
      if (id === '') {
        warnings.push(`${who(raw)}: "id" to identyfikator z eksportu — pominięty.`);
        skipped.add(raw.ref);
      } else if (seenIds.has(id)) {
        warnings.push(`${who(raw)}: to samo "id" drugi raz — pominięty.`);
        skipped.add(raw.ref);
      } else {
        seenIds.add(id);
        const found = stateById.get(id);
        if (found === undefined) {
          warnings.push(`${who(raw)}: nie ma terminu o tym "id" w tym kalendarzu — pominięty (bez "id" zostanie dodany jako nowy).`);
          skipped.add(raw.ref);
        } else {
          itemOf[raw.ref] = found;
        }
      }
    }
    if (row.key !== undefined) {
      const key = typeof row.key === 'string' ? row.key.trim() : '';
      if (!KEY_RE.test(key)) warnings.push(`${who(raw)}: "key" to krótka nazwa (litery, cyfry, - i _) — pominięty.`);
      else if (keyRef.has(key.toLowerCase())) warnings.push(`${who(raw)}: "key" „${key}” już jest — pominięty.`);
      else keyRef.set(key.toLowerCase(), raw.ref);
    }
  }

  const removing = new Set<number>();
  for (const raw of raws) {
    const wish = raw.row.remove;
    if (wish === undefined || wish === false || skipped.has(raw.ref)) continue;
    if (wish !== true) { warnings.push(`${who(raw)}: "remove" to true — pominięte.`); continue; }
    if (foreign !== null) { skipped.add(raw.ref); continue; }
    if (itemOf[raw.ref] === null) {
      warnings.push(`${who(raw)}: "remove" działa tylko z "id" z eksportu — pominięty.`);
      skipped.add(raw.ref);
      continue;
    }
    removing.add(raw.ref);
  }

  /* 3 — unter welchem Ganzen: wo er steht ("points"), "@key", eine Kennung, null. */
  const parentOf: ParentWish[] = raws.map((raw) => {
    if (raw.enclosing !== null) {
      if (raw.row.parent !== undefined) warnings.push(`${who(raw)}: punkt należy do terminu, pod którym stoi — "parent" pominięte.`);
      return { kind: 'ref', ref: raw.enclosing };
    }
    const wish = raw.row.parent;
    if (wish === undefined) return { kind: 'keep' };
    if (wish === null) return { kind: 'none' };
    const text = typeof wish === 'string' ? wish.trim() : '';
    if (text.startsWith('@')) {
      const ref = keyRef.get(text.slice(1).toLowerCase());
      if (ref === undefined) { warnings.push(`${who(raw)}: "parent" ${text} — nie ma terminu z takim "key"; bez zmian.`); return { kind: 'keep' }; }
      if (ref === raw.ref) { warnings.push(`${who(raw)}: termin nie może być punktem samego siebie — "parent" pominięte.`); return { kind: 'keep' }; }
      return { kind: 'ref', ref };
    }
    if (text === '') { warnings.push(`${who(raw)}: "parent" to "@key" terminu z dokumentu, "id" terminu albo null — bez zmian.`); return { kind: 'keep' }; }
    if (foreign !== null) return { kind: 'keep' };
    if (sameId(text, itemOf[raw.ref]?.itemId)) { warnings.push(`${who(raw)}: termin nie może być punktem samego siebie — "parent" pominięte.`); return { kind: 'keep' }; }
    return { kind: 'id', itemId: text };
  });
  /* Ein Kreis über "@key" (A unter B, B unter A): der Verweis, der ihn schliesst, fällt. */
  for (const raw of raws) {
    let at = parentOf[raw.ref];
    for (let steps = 0; at.kind === 'ref' && steps <= raws.length; steps += 1) {
      if (at.ref === raw.ref) {
        warnings.push(`${who(raw)}: "parent" tworzy krąg — pominięte.`);
        parentOf[raw.ref] = { kind: 'keep' };
        break;
      }
      at = parentOf[at.ref];
    }
  }

  /* 4 — die Reihenfolge des Schreibens: jedes Ganze vor seinen Punkten (auch über "@key"). */
  const children = new Map<number, number[]>();
  for (const raw of raws) {
    const p = parentOf[raw.ref];
    if (p.kind === 'ref') children.set(p.ref, [...(children.get(p.ref) ?? []), raw.ref]);
  }
  const order: { ref: number; depth: number }[] = [];
  const visit = (ref: number, depth: number) => {
    order.push({ ref, depth });
    for (const child of children.get(ref) ?? []) visit(child, depth + 1);
  };
  for (const raw of raws) if (parentOf[raw.ref].kind !== 'ref') visit(raw.ref, parentOf[raw.ref].kind === 'id' ? 1 : 0);

  /* 5 — jeder Termin: was er wird, und was sich an ihm ändert. */
  const schemeById = new Map(state.schemes.map((s) => [s.id.toLowerCase(), s]));
  const defOf = (id: string | null): SchemeDef | null => (id === null ? UNIVERSAL : schemeById.get(id.toLowerCase())?.def ?? null);
  const schemeFound = (text: string): { id: string | null } | undefined => {
    const low = text.trim().toLowerCase();
    if (low === '' || low === 'uniwersalny' || low === UNIVERSAL_ID) return { id: null };
    const byId = schemeById.get(low);
    if (byId !== undefined) return { id: byId.id };
    const byName = state.schemes.filter((s) => s.def.name.trim().toLowerCase() === low);
    return byName.length === 1 ? { id: byName[0].id } : undefined;
  };
  /* Ein neuer ohne "scheme": das Schema seiner Art, wenn der Kalender genau eines hat — sonst das universelle. */
  const schemeForKind = (kind: string): string | null => {
    const matching = state.schemes.filter((s) => (s.def.kind ?? 'appointment') === kind || (s.def.kinds ?? []).includes(kind as ItemKind));
    return matching.length === 1 ? matching[0].id : null;
  };
  const covered = (day: string): boolean => state.spans.some((s) => s.from <= day && day <= s.to);
  const now = Date.now();
  /* Was fällt, nimmt seine Punkte mit (so löscht der Dienst) — auch die, die nicht darunter stehen. */
  const removedIds = new Set([...removing].map((ref) => itemOf[ref]!.itemId.toLowerCase()));

  interface Planned {
    ref: number;
    label: string;
    itemId: string | null;
    state: StateItem | null;
    save: ItemSave | null;
    parent: ParentRef | null | undefined;
    parentChanged: boolean;
    position: number | null | undefined;
    program: boolean;
    occurrences: OccurrenceOp[];
    retimed: boolean;
    changes: string[];
  }
  const planned = new Map<number, Planned>();
  const startOf = new Map<number, When>();

  for (const { ref, depth } of order) {
    const raw = raws[ref];
    const row = raw.row;
    const name = who(raw);
    const warn = (text: string) => warnings.push(`${name}: ${text}`);
    const wish = parentOf[ref];

    if (skipped.has(ref) || removing.has(ref)) continue;
    const under = itemOf[ref]?.parentItemId?.toLowerCase() ?? null;
    if ((wish.kind === 'ref' && removing.has(wish.ref)) || (wish.kind === 'id' && removedIds.has(wish.itemId.toLowerCase()))
      || (wish.kind === 'keep' && under !== null && removedIds.has(under))) {
      warn('stoi pod usuwanym terminem — zniknie razem z nim; pominięty.');
      skipped.add(ref);
      continue;
    }
    if (wish.kind === 'ref' && !planned.has(wish.ref)) {
      warn('termin nadrzędny jest pominięty — pominięty także ten punkt.');
      skipped.add(ref);
      continue;
    }
    if (depth >= MAX_DEPTH) {
      warn(`program głębszy niż ${MAX_DEPTH} poziomów — pominięty.`);
      skipped.add(ref);
      continue;
    }

    const s = itemOf[ref];
    const was = s === null ? null : coreOf(s);
    const skip = (text: string) => { warn(text); skipped.add(ref); };

    /* Art und Schema — beim neuen das Schema seiner Art, beim bestehenden bleibt es, was es war. */
    let kindWanted: string | undefined;
    if (row.kind !== undefined) {
      const kind = typeof row.kind === 'string' ? row.kind.trim().toLowerCase() : '';
      if (KINDS.includes(kind) || (kind === 'task' && s?.kind === 'task')) kindWanted = kind;
      else warn(`"kind" to ${KINDS.map((k) => `"${k}"`).join(', ')} — ${s === null ? 'rodzaj kalendarza' : 'bez zmian'}.`);
    }
    let schemeId: string | null | undefined;
    if (row.scheme !== undefined) {
      if (row.scheme === null) schemeId = null;
      else if (typeof row.scheme === 'string') {
        if (s !== null && s.schemeId !== null && sameId(row.scheme.trim(), s.schemeId)) schemeId = s.schemeId;
        else {
          const found = schemeFound(row.scheme);
          if (found === undefined) warn(`schematu „${row.scheme.trim()}” nie ma w tym kalendarzu — ${s === null ? 'schemat domyślny' : 'bez zmian'}.`);
          else schemeId = found.id;
        }
      } else warn('"scheme" to nazwa albo "id" schematu (null — uniwersalny) — bez zmian.');
    }
    let kind: string;
    if (s !== null) {
      if (schemeId === undefined) schemeId = s.schemeId;
      kind = kindWanted ?? s.kind;
      /* Ein anderes Schema bringt seine Art mit — wie im Editor. */
      const def = defOf(schemeId);
      if (!sameId(schemeId, s.schemeId) && kindWanted === undefined && def !== null && def !== UNIVERSAL) kind = def.kind ?? 'appointment';
    } else if (schemeId === undefined) {
      kind = kindWanted ?? calendar.itemKind;
      /* Ein neuer Punkt eines Programms bekommt das universelle — wie „+ punkt" im Editor. */
      schemeId = wish.kind === 'ref' || wish.kind === 'id' ? null : schemeForKind(kind);
    } else {
      const def = defOf(schemeId);
      kind = kindWanted ?? (def !== null && def !== UNIVERSAL ? def.kind ?? 'appointment' : calendar.itemKind);
    }
    const def = defOf(schemeId);
    if (def !== null && def !== UNIVERSAL) {
      const allowed: readonly string[] = def.kinds !== undefined && def.kinds.length > 0 ? def.kinds : [def.kind ?? 'appointment'];
      if (!allowed.includes(kind)) {
        const next = allowed.includes(def.kind ?? 'appointment') ? def.kind ?? 'appointment' : allowed[0];
        if (kindWanted !== undefined) warn(`rodzaj „${kind}” nie pasuje do schematu „${def.name}” — „${next}”.`);
        kind = next;
      }
    }
    if (calendar.personal && LITURGY.includes(kind) && kind !== s?.kind) {
      warn('w kalendarzu prywatnym nie ma mszy ani nabożeństw — rodzaj „appointment”.');
      kind = 'appointment';
    }
    const titleIsPublic = publicTitleOf(calendar, def, kind);

    /* Texte: was fehlt, bleibt; "" und null leeren. */
    const text = (field: keyof typeof LIMITS, current: string): string => {
      const given = row[field];
      if (given === undefined) return current;
      if (given === null) return '';
      if (typeof given !== 'string' && typeof given !== 'number') { warn(`"${field}" to tekst — ${s === null ? 'pominięte' : 'bez zmian'}.`); return current; }
      const out = String(given).trim();
      if (out.length > LIMITS[field]) { warn(`"${field}" ma ponad ${LIMITS[field]} znaków — przycięte.`); return out.slice(0, LIMITS[field]); }
      return out;
    };
    let title = text('title', was?.title ?? '');
    if (title === '' && !titleIsPublic) {
      if (s === null) { skip('termin bez "title" — pominięty.'); continue; }
      if (row.title !== undefined && was!.title !== '') { warn('"title" nie może być pusty — bez zmian.'); title = was!.title; }
    }
    const location = text('location', was?.location ?? '');
    const notes = text('notes', was?.notes ?? '');
    let link = text('link', was?.link ?? '');
    if (link !== '' && safeLink(link) === null) {
      warn('"link" zaczyna się od https:// (albo #/ dla strony na recreatio.pl) — bez zmian.');
      link = was?.link ?? '';
    }
    const linkLabel = text('linkLabel', was?.linkLabel ?? '');

    /* Wann: "start" (ein Punkt auch „GG:MM" am Tag seines Ganzen), sonst wie bisher, sonst mit seinem Ganzen. */
    const parentState = wish.kind === 'id' ? stateById.get(wish.itemId.toLowerCase()) ?? null
      : wish.kind === 'keep' && s?.parentItemId != null ? stateById.get(s.parentItemId.toLowerCase()) ?? null : null;
    const parentStart: When | null = wish.kind === 'ref' ? startOf.get(wish.ref) ?? null
      : parentState === null ? null : { day: startOfDay(new Date(parentState.startsAt)), minute: parentState.allDay ? null : minuteOf(clockOf(new Date(parentState.startsAt))) };
    let start: When;
    if (row.start !== undefined) {
      const read = readWhen(row.start, parentStart?.day ?? null);
      if (read !== null) start = read;
      else if (was !== null) {
        warn(`"start" to "RRRR-MM-DDTGG:MM" albo "RRRR-MM-DD"${parentStart !== null ? ' (w punkcie także "GG:MM")' : ''} — bez zmian.`);
        start = { day: readDay(was.day)!, minute: was.allDay ? null : minuteOf(was.clock) };
      } else {
        skip(`"start" to "RRRR-MM-DDTGG:MM" albo "RRRR-MM-DD"${parentStart !== null ? ' (w punkcie także "GG:MM")' : ''} — pominięty.`);
        continue;
      }
    } else if (was !== null) {
      start = { day: readDay(was.day)!, minute: was.allDay ? null : minuteOf(was.clock) };
    } else if (parentStart !== null) {
      start = parentStart;
    } else {
      skip('termin bez "start" — pominięty.');
      continue;
    }
    let allDay = start.minute === null;
    if (row.allDay !== undefined) {
      if (typeof row.allDay !== 'boolean') warn('"allDay" to true albo false — pominięte.');
      else if (row.allDay) allDay = true;
      else if (start.minute === null) warn('"allDay": false potrzebuje godziny w "start" — cały dzień.');
      else allDay = false;
    }
    const startMinute = allDay ? 0 : start.minute ?? 0;

    let minutes: number;
    if (allDay) {
      let days = was !== null && was.allDay ? Math.max(1, Math.round(was.minutes / 1440)) : 1;
      if (row.end !== undefined && row.end !== null) {
        const end = readWhen(row.end, start.day);
        if (end === null) warn('"end" przy całym dniu to ostatni dzień "RRRR-MM-DD" — długość bez zmian.');
        else {
          const n = daysBetween(start.day, end.day) + 1;
          if (n < 1) warn('"end" przed "start" — jeden dzień.');
          days = Math.max(1, n);
        }
      }
      if (days > MAX_ALL_DAYS) { warn(`cały dzień trwa najwyżej ${MAX_ALL_DAYS} dni — skrócony.`); days = MAX_ALL_DAYS; }
      minutes = days * 1440;
    } else {
      minutes = was !== null && !was.allDay ? was.minutes : calendar.durationMinutes;
      if (row.end !== undefined && row.end !== null) {
        const end = readWhen(row.end, start.day);
        const begin = atOf(start.day, startMinute).getTime();
        if (end === null) warn('nieczytelne "end" — długość bez zmian.');
        else {
          const finish = atOf(end.day, end.minute ?? 0).getTime();
          if (finish <= begin) warn('"end" nie jest po "start" — długość bez zmian.');
          else minutes = Math.round((finish - begin) / 60_000);
        }
      }
      if (minutes > MAX_TIMED_MINUTES) { warn('termin trwa najwyżej 14 dni — skrócony.'); minutes = MAX_TIMED_MINUTES; }
      minutes = Math.max(1, minutes);
    }

    /* Wiederholung: was fehlt, bleibt; eine neue Art beginnt von vorn (jeden 1., Tag des Beginns). */
    let repeat: RepeatKind = was?.repeat ?? 'none';
    let every = was?.every ?? 1;
    let weekdays = was?.weekdays ?? 0;
    let until: string | null = was?.until ?? null;
    let count: number | null = was?.count ?? null;
    let endless = was?.endless ?? false;
    if (row.repeat !== undefined) {
      const wanted = typeof row.repeat === 'string' ? row.repeat.trim().toLowerCase() : '';
      if (!(REPEAT_KINDS as readonly string[]).includes(wanted)) warn(`"repeat" to ${REPEAT_KINDS.map((k) => `"${k}"`).join(', ')} — bez zmian.`);
      else if (wanted !== repeat) {
        const before = repeat;
        repeat = wanted as RepeatKind;
        every = 1;
        weekdays = 0;
        if (before === 'none') { until = null; count = null; endless = false; }
      }
    }
    if (row.every !== undefined) {
      if (typeof row.every === 'number' && Number.isInteger(row.every) && row.every >= 1 && row.every <= MAX_EVERY) every = row.every;
      else warn(`"every" to liczba 1–${MAX_EVERY} — bez zmian.`);
    }
    if (row.weekdays !== undefined) {
      if (repeat !== 'weekly') warn('"weekdays" tylko przy "repeat": "weekly" — pominięte.');
      else {
        const bits = readWeekdays(row.weekdays, warn);
        if (bits > 0) weekdays = bits;
      }
    }
    let untilSaid = false;
    if (row.until !== undefined) {
      if (row.until === null) { until = null; count = null; endless = true; }
      else {
        const last = readDay(row.until);
        if (last === null) warn('"until" to ostatni dzień "RRRR-MM-DD" (null — bez końca) — bez zmian.');
        else if (last < start.day) warn('"until" przed "start" — bez zmian.');
        else { until = dayOf(last); count = null; endless = false; untilSaid = true; }
      }
    }
    if (row.count !== undefined) {
      if (row.count === null) { count = null; if (until === null) endless = true; }
      else if (typeof row.count !== 'number' || !Number.isInteger(row.count) || row.count < 1 || row.count > MAX_COUNT) warn(`"count" to liczba 1–${MAX_COUNT} — bez zmian.`);
      else if (untilSaid) warn('"until" albo "count" — liczy się "until".');
      else { count = row.count; until = null; endless = false; }
    }
    if (repeat === 'none') {
      every = 1; weekdays = 0; until = null; count = null; endless = false;
    } else {
      if (repeat !== 'weekly') weekdays = 0;
      else if (weekdays === 0) weekdays = bitOf(start.day);
      if (until === null && count === null) endless = true;
      /* „Bez końca": das Ende, das schon dasteht — sonst zehn Jahre voraus, wie im Editor. */
      if (endless) until = was !== null && was.endless && was.until !== null ? was.until : tenYears(start.day);
    }

    /* Reservieren — nur in einem Kalender, der es kennt. */
    let bookable = s?.bookable ?? null;
    let capacity = s?.capacity ?? null;
    if (row.bookable !== undefined) {
      if (!calendar.booking) warn('ten kalendarz nie ma rezerwacji — "bookable" pominięte.');
      else if (row.bookable === null || typeof row.bookable === 'boolean') bookable = row.bookable;
      else warn('"bookable" to true, false albo null — bez zmian.');
    }
    if (row.capacity !== undefined) {
      if (!calendar.booking) warn('ten kalendarz nie ma rezerwacji — "capacity" pominięte.');
      else if (row.capacity === null) capacity = null;
      else if (typeof row.capacity === 'number' && Number.isInteger(row.capacity) && row.capacity >= 1 && row.capacity <= MAX_CAPACITY) capacity = row.capacity;
      else warn(`"capacity" to liczba 1–${MAX_CAPACITY} (null — jak kalendarz) — bez zmian.`);
    }

    /* Die Werte am Termin: was fehlt, bleibt; ein anderes Schema nimmt mit, was unter demselben Schlüssel stand. */
    const itemFields = def === null ? [] : shownFields(def, kind, 'item');
    const schemeChanged = s !== null && !sameId(schemeId, s.schemeId);
    const baseValues = s === null ? {} : textsOf(def, itemFields, s.values);
    const texts: Record<string, string> = { ...baseValues };
    let touched = false;
    if (row.values !== undefined) {
      if (!isRecord(row.values)) warn('"values" to obiekt {"klucz pola": "tekst"} — bez zmian.');
      else if (def === null) warn('schematu tego terminu nie da się odczytać — "values" bez zmian.');
      else {
        for (const [key, given] of Object.entries(row.values)) {
          const field = itemFields.find((f) => f.key === key);
          if (field === undefined) {
            const other = def.fields.find((f) => f.key === key);
            warn(other === undefined ? `schemat „${def.name}” nie ma pola „${key}” — pominięte.`
              : other.level === 'day' ? `„${key}” to pole jednego dnia — wpisz je w "occurrences"; pominięte.`
              : `pole „${key}” jest tylko przy rodzajach ${(other.onlyKinds ?? []).map((k) => `„${k}”`).join(', ')} — pominięte.`);
            continue;
          }
          const read = readValue(field, given, warn);
          if (read === undefined) continue;
          touched = true;
          if (read === '') delete texts[key];
          else texts[key] = read;
        }
      }
    }
    let values: DraftValue[] | undefined;
    if (s === null) values = itemFields.length > 0 && Object.keys(texts).length > 0 ? draftValues(itemFields, texts) : undefined;
    else if (schemeChanged) values = draftValues(itemFields, texts);
    else if (touched && !sameTexts(texts, baseValues)) {
      if (s.valuesComplete) values = draftValues(itemFields, texts);
      else warn('nie wszystkie wartości tego terminu da się odczytać — "values" bez zmian.');
    }
    const missing = itemFields.filter((f) => f.required === true && (texts[f.key] ?? '').trim() === '');

    /* Unter welchem Ganzen — geändert, wenn es ein anderes ist als bisher. */
    let parent: ParentRef | null | undefined;
    let parentChanged = false;
    if (wish.kind === 'ref') {
      parent = { ref: wish.ref };
      const target = planned.get(wish.ref)?.itemId ?? null;
      parentChanged = s === null || target === null || !sameId(s.parentItemId, target);
    } else if (wish.kind === 'id') {
      parent = { itemId: wish.itemId };
      parentChanged = s === null || !sameId(s.parentItemId, wish.itemId);
    } else if (wish.kind === 'none') {
      parent = null;
      parentChanged = s !== null && s.parentItemId !== null;
    }

    const save: ItemSave = {
      kind, title, location, notes, link, linkLabel,
      date: dayOf(start.day), time: allDay ? '00:00' : clockText(startMinute), minutes, allDay,
      repeat, every, weekdays: repeat === 'weekly' ? weekdays : 0,
      until: repeat === 'none' || count !== null ? null : until,
      count: repeat === 'none' ? null : count,
      bookable, capacity,
      schemeId: s === null || schemeChanged ? schemeId : undefined,
      values,
      publicTitle: calendar.personal ? false : def?.publicTitle
    };

    /* Was sich am bestehenden ändert, in Worten — und ob die Zeit der Reihe (dann fallen ihre Ausnahmen). */
    const changes: string[] = [];
    let retimed = false;
    if (was !== null) {
      if (kind !== was.kind) changes.push('rodzaj');
      if (title !== was.title) changes.push('tytuł');
      if (location !== was.location) changes.push('miejsce');
      if (notes !== was.notes) changes.push('notatka');
      if (link !== was.link) changes.push('link');
      if (linkLabel !== was.linkLabel && link !== '') changes.push('napis linku');
      const timeChanged = save.date !== was.day || save.time !== was.clock || minutes !== was.minutes || allDay !== was.allDay;
      const repeatChanged = repeat !== was.repeat
        || (repeat !== 'none' && (every !== was.every || save.weekdays !== was.weekdays || save.count !== was.count || save.until !== was.until));
      if (timeChanged) changes.push('czas');
      if (repeatChanged) changes.push('powtarzanie');
      retimed = timeChanged || repeatChanged;
      if (bookable !== s!.bookable || capacity !== s!.capacity) changes.push('rezerwacje');
      if (schemeChanged) changes.push('schemat');
      else if (values !== undefined) changes.push('wartości');
    }

    let saveNow: ItemSave | null = null;
    if (s === null || changes.length > 0) {
      if (missing.length > 0) {
        const fields = missing.map((f) => `„${f.label}”`).join(', ');
        if (s === null) { skip(`wymagane pole ${fields} nie ma wartości ("values") — pominięty.`); continue; }
        warn(`wymagane pole ${fields} nie ma wartości — zmiany pominięte.`);
      } else if (s !== null && s.unreadable) {
        warn('część pól tego terminu jest zaszyfrowana kluczem, którego nie masz — zmiany pominięte (zapis by je skasował).');
      } else {
        saveNow = save;
      }
    }
    if (saveNow === null) retimed = false;
    startOf.set(ref, { day: start.day, minute: allDay ? null : startMinute });

    /* Die Tage der Reihe: absagen, zurückholen, verlegen, Werte des Tages. */
    const ops: OccurrenceOp[] = [];
    const dayFields = def === null ? [] : shownFields(def, kind, 'day');
    const seenDays = new Set<string>();
    const firstDay = dayOf(start.day);
    const lastDay = repeat === 'none' ? firstDay : count === null && until !== null ? until : null;
    if (row.occurrences !== undefined && !Array.isArray(row.occurrences)) warn('"occurrences" to lista — pominięte.');
    const entries = Array.isArray(row.occurrences) ? row.occurrences : [];
    if (entries.length > MAX_OCCURRENCES) warn(`najwyżej ${MAX_OCCURRENCES} dni w "occurrences" — reszta pominięta.`);
    entries.slice(0, MAX_OCCURRENCES).forEach((one, i) => {
      const at = `occurrences[${i}]`;
      if (!isRecord(one)) { warn(`${at}: to nie obiekt — pominięty.`); return; }
      for (const key of Object.keys(one)) if (!(key in OCCURRENCE_KEYS)) warn(`${at}: nieznany klucz "${key}" — pominięty.`);
      const date = readDay(one.date);
      if (date === null) { warn(`${at}: "date" to dzień serii "RRRR-MM-DD" — pominięty.`); return; }
      const day = dayOf(date);
      if (seenDays.has(day)) { warn(`${at}: dzień ${day} drugi raz — pominięty.`); return; }
      seenDays.add(day);
      if (day < firstDay || (lastDay !== null && day > lastDay)) {
        warn(`${at}: ${day} — ${repeat === 'none' ? `termin nie powtarza się, jego dzień to ${firstDay}` : 'poza serią'}; pominięty.`);
        return;
      }
      const old = s === null ? null : s.occurrences.find((o) => dayOf(new Date(o.at)) === day) ?? null;
      /* Was der Dienst schon hat, gilt nur, solange die Zeit der Reihe bleibt — sonst fallen die Ausnahmen. */
      const known = retimed ? null : old;
      if (s !== null && !retimed && old === null && covered(day)) { warn(`${at}: ${day} nie jest dniem tej serii — pominięty.`); return; }

      let cancelled: boolean | undefined;
      if (one.cancelled !== undefined) {
        if (typeof one.cancelled === 'boolean') cancelled = one.cancelled;
        else warn(`${at}: "cancelled" to true albo false — pominięte.`);
      }
      let moveTo: Date | null = null;
      if (one.start !== undefined && one.start !== null) {
        const when = readWhen(one.start, date);
        if (when === null || (when.minute === null && !allDay)) warn(`${at}: "start" to "RRRR-MM-DDTGG:MM" albo "GG:MM" — pominięte.`);
        else if (cancelled === true) warn(`${at}: odwołany dzień nie ma nowego "start" — pominięte.`);
        else moveTo = atOf(when.day, when.minute ?? 0);
      }
      const op: { cancel?: true; restore?: true; moveTo?: string; values?: DraftValue[] } = {};
      const seriesAt = atOf(date, startMinute).getTime();
      if (cancelled === true) {
        if (known === null || !known.cancelled) op.cancel = true;
      } else if (moveTo !== null && moveTo.getTime() !== seriesAt) {
        if (known === null || known.cancelled || !known.moved || Date.parse(known.startsAt) !== moveTo.getTime()) op.moveTo = moveTo.toISOString();
      } else if ((cancelled === false || moveTo !== null) && known !== null && (known.cancelled || known.moved)) {
        op.restore = true;
      }

      const baseDay = old === null ? {} : textsOf(def, dayFields, old.values);
      const dayTexts: Record<string, string> = { ...baseDay };
      let dayTouched = false;
      if (one.values !== undefined) {
        if (!isRecord(one.values)) warn(`${at}: "values" to obiekt {"klucz pola": "tekst"} — bez zmian.`);
        else if (def === null) warn(`${at}: schematu tego terminu nie da się odczytać — "values" bez zmian.`);
        else {
          for (const [key, given] of Object.entries(one.values)) {
            const field = dayFields.find((f) => f.key === key);
            if (field === undefined) {
              const whole = def.fields.some((f) => f.key === key && (f.level ?? 'item') === 'item');
              warn(whole ? `${at}: „${key}” to pole całego terminu — wpisz je w "values" terminu; pominięte.` : `${at}: schemat „${def.name}” nie ma pola dnia „${key}” — pominięte.`);
              continue;
            }
            const read = readValue(field, given, (text) => warn(`${at}: ${text}`));
            if (read === undefined) continue;
            dayTouched = true;
            if (read === '') delete dayTexts[key];
            else dayTexts[key] = read;
          }
        }
      }
      if (old !== null && !old.valuesComplete) {
        if (dayTouched) warn(`${at}: ${old.cancelled ? 'wartości odwołanego dnia zostają, jak są (przywróć go najpierw)' : 'nie wszystkie wartości tego dnia da się odczytać'} — "values" bez zmian.`);
      } else if ((dayTouched && !sameTexts(dayTexts, baseDay)) || (retimed && Object.keys(dayTexts).length > 0)) {
        /* Nach einer neuen Zeit der Reihe neu versiegelt — das Etikett eines Wertes nennt den Beginn des Tages. */
        op.values = draftValues(dayFields, dayTexts);
      }
      if (Object.keys(op).length > 0) ops.push({ day, at: known?.at ?? null, ...op });
    });
    /* Eine neue Zeit: auch die Werte der übrigen geladenen Tage neu versiegeln (der Dienst trägt sie zum neuen Beginn). */
    if (retimed && s !== null && def !== null) {
      for (const one of s.occurrences) {
        const day = dayOf(new Date(one.at));
        if (seenDays.has(day) || !one.valuesComplete || one.values.size === 0) continue;
        const dayTexts = textsOf(def, dayFields, one.values);
        if (Object.keys(dayTexts).length > 0) ops.push({ day, at: null, values: draftValues(dayFields, dayTexts) });
      }
    }
    if (retimed && s !== null && s.repeat !== 'none') {
      warn(`zmiana czasu serii zmienia wszystkie jej dni${Date.parse(s.startsAt) < now ? ', także te, które już były' : ''}; odwołane i przeniesione dni, których nie ma w "occurrences", wrócą do serii.`);
    }

    planned.set(ref, {
      ref, label: named(title, kind), itemId: s?.itemId ?? null, state: s, save: saveNow,
      parent, parentChanged, position: undefined, program: s !== null && parentChanged,
      occurrences: ops, retimed, changes
    });
  }

  /* 6 — die Stellen unter jedem Ganzen: neu gezählt, wenn einer neu dazukommt, umzieht oder die Reihenfolge anders ist. */
  const groups = new Map<string, Planned[]>();
  for (const { ref } of order) {
    const one = planned.get(ref);
    if (one === undefined || one.parent == null) continue;
    const key = 'ref' in one.parent ? `ref:${one.parent.ref}` : `id:${one.parent.itemId.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }
  for (const members of groups.values()) {
    const staying = members.filter((m) => m.state !== null && !m.parentChanged);
    const before = [...staying].sort((a, b) => byPlace(a.state!, b.state!));
    const reordered = staying.some((m, i) => before[i] !== m);
    if (!reordered && members.every((m) => m.state !== null && !m.parentChanged)) continue;
    members.forEach((m, i) => {
      if (m.state === null) { m.position = i + 1; return; }
      if (m.parentChanged || m.state.position !== i + 1) { m.position = i + 1; m.program = true; }
    });
  }

  /* 7 — die Vorschau. */
  const items: PlannedItem[] = [];
  const created: string[] = [];
  const changedLines: string[] = [];
  const dayLines: string[] = [];
  let unchanged = 0;
  let days = 0;
  for (const { ref } of order) {
    const one = planned.get(ref);
    if (one === undefined) continue;
    if (one.program && !one.changes.includes('program')) one.changes.push('program');
    items.push({
      ref: one.ref, label: one.label, itemId: one.itemId, state: one.state, save: one.save,
      parent: one.parent, position: one.position, program: one.program, occurrences: one.occurrences,
      retimed: one.retimed, changes: one.changes
    });
    const under = one.parent != null && 'ref' in one.parent ? planned.get(one.parent.ref)?.label : undefined;
    if (one.itemId === null && one.save !== null) {
      created.push(`Nowy: „${one.label}” — ${whenWords(one.save)}${under !== undefined ? ` · punkt programu „${under}”` : ''}`);
    } else if (one.save !== null || one.program) {
      const shown = one.save !== null ? one.changes : one.changes.filter((c) => c === 'program');
      changedLines.push(`Zmiana: „${one.label}” — ${shown.join(', ')}`);
    }
    if (one.occurrences.length > 0) {
      const count = (test: (op: OccurrenceOp) => boolean) => one.occurrences.filter(test).length;
      const parts = [
        [count((op) => op.cancel === true), 'odwołane'],
        [count((op) => op.restore === true), 'przywrócone'],
        [count((op) => op.moveTo !== undefined), 'przeniesione'],
        [count((op) => op.values !== undefined), 'wartości dnia']
      ].filter(([n]) => (n as number) > 0).map(([n, word]) => `${word} ${n}`);
      dayLines.push(`Dni serii „${one.label}”: ${parts.join(', ')}`);
      days += one.occurrences.length;
    }
    if (one.itemId !== null && one.save === null && !one.program && one.occurrences.length === 0) unchanged += 1;
  }

  const removals: PlannedRemoval[] = [...removing].map((ref) => {
    const s = itemOf[ref]!;
    const points = state.items.filter((i) => sameId(i.parentItemId, s.itemId)).length;
    return { itemId: s.itemId, label: named(s.title ?? '', s.kind), points };
  });
  const removeLines = removals.map((r) => `Usunięcie: „${r.label}” — cały termin${r.points > 0 ? ` razem z punktami programu (${r.points})` : ''}`);

  const capped = (list: readonly string[], rest: (n: number) => string): string[] =>
    list.length <= SHOWN_LINES ? [...list] : [...list.slice(0, SHOWN_LINES), rest(list.length - SHOWN_LINES)];
  const changedCount = items.filter((i) => i.itemId !== null && (i.save !== null || i.program)).length;
  const createdCount = items.filter((i) => i.itemId === null && i.save !== null).length;
  const lines = [
    ...capped(created, (n) => `… i jeszcze ${n} nowych.`),
    ...capped(changedLines, (n) => `… i jeszcze ${n} zmian.`),
    ...capped(dayLines, (n) => `… i jeszcze ${n} terminów ze zmianami dni.`),
    ...removeLines
  ];
  if (lines.length === 0) lines.push('Bez zmian — terminy w kalendarzu są takie jak w dokumencie.');
  else {
    lines.push(`Razem: nowe ${createdCount}, zmienione ${changedCount}, usunięte ${removals.length}, bez zmian ${unchanged}${days > 0 ? `, dni serii ${days}` : ''}.`);
  }

  return {
    items, removals, lines, warnings, foreign: foreign !== null,
    counts: { created: createdCount, changed: changedCount, unchanged, removed: removals.length, days, skipped: skipped.size }
  };
}

/* -- Die Beschreibung ---------------------------------------------------------------------------------- */

export const DOC_KEYS: Readonly<Record<string, string>> = {
  format: `zawsze "${CALENDAR_FORMAT}"`,
  version: `wersja formatu: ${CALENDAR_VERSION}`,
  calendar: 'kalendarz, z którego jest eksport (niżej) — tylko informacja; po "id" import poznaje dokument z innego kalendarza',
  range: 'dni, które objął eksport (niżej) — tylko informacja; w nich import szuka terminów z "id"',
  schemes: 'schematy terminów tego kalendarza do wglądu (niżej) — jakie "values" mogą mieć terminy; import ich nie zmienia (schematy zmienia się w „Schematy terminów”)',
  appointments: 'terminy (niżej) — wymagane'
};

export const CALENDAR_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator kalendarza',
  title: 'nazwa kalendarza',
  kind: `rodzaj jego terminów: ${KINDS.map((k) => `"${k}"`).join(', ')}`
};

export const RANGE_KEYS: Readonly<Record<string, string>> = {
  from: 'pierwszy dzień eksportu "RRRR-MM-DD"',
  to: 'ostatni dzień eksportu "RRRR-MM-DD"'
};

export const SCHEMES_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator schematu — do "scheme" terminu',
  name: 'nazwa schematu — do "scheme" terminu (gdy jednoznaczna)',
  kind: 'rodzaj terminów tego schematu',
  kinds: 'rodzaje do wyboru przy terminie tego schematu',
  fields: 'pola schematu — klucze "values" terminu ("level": "day" — klucze "values" dnia w "occurrences"); opis pola niżej'
};

export const APPOINTMENT_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator terminu z eksportu — termin zostanie zmieniony; bez "id" — nowy termin',
  key: 'krótka nazwa (litery, cyfry, - i _) do odwołań "@key" w tym dokumencie ("parent")',
  remove: 'true — usuń ten termin (całą serię, razem z jego punktami programu); tylko z "id"; termin z przyjętymi intencjami, wpisami albo rezerwacjami zostaje (import to powie)',
  kind: `rodzaj: ${KINDS.map((k) => `"${k}" (${ITEM_LABEL[k as ItemKind]})`).join(', ')}; brak przy nowym: rodzaj schematu albo kalendarza`,
  title: `tytuł (do ${LIMITS.title} znaków); wymagany przy nowym terminie — poza mszą, spowiedzią i nabożeństwem: ich nazwa jest jawna (plan mszy, gablota), a bez niej stoi sam rodzaj („Msza”)`,
  start: 'początek: "RRRR-MM-DDTGG:MM", albo "RRRR-MM-DD" — cały dzień; w punkcie programu także "GG:MM" (w dniu terminu nadrzędnego); nowy punkt bez "start" zaczyna się z terminem nadrzędnym',
  end: 'koniec: "GG:MM" (tego samego dnia) albo "RRRR-MM-DDTGG:MM"; przy całym dniu ostatni dzień "RRRR-MM-DD"; brak: nowy trwa tyle, ile mówi kalendarz (cały dzień — jeden dzień), zmieniany zachowuje swoją długość; najwyżej 14 dni (cały dzień: 60 dni)',
  allDay: 'true — cały dzień (to samo daje "start" bez godziny)',
  location: `miejsce (do ${LIMITS.location} znaków)`,
  notes: `notatka (do ${LIMITS.notes} znaków)`,
  link: '„Więcej informacji”: "https://…" albo "#/adres" strony na recreatio.pl',
  linkLabel: `napis na przycisku linku (do ${LIMITS.linkLabel} znaków)`,
  repeat: `powtarzanie: ${REPEAT_KINDS.map((k) => `"${k}" (${REPEAT_LABEL[k]})`).join(', ')}`,
  every: `co ile (1–${MAX_EVERY}): co 2 tygodnie = "repeat": "weekly" i "every": 2`,
  weekdays: `przy "weekly": dni ${WEEKDAY_WORDS.map((w) => `"${w}"`).join(', ')} (albo liczby 1–7, 1 = poniedziałek); brak: dzień "start"`,
  until: 'ostatni dzień serii "RRRR-MM-DD"; null — bez końca; brak przy nowej serii: bez końca',
  count: `zamiast "until": ile razy (1–${MAX_COUNT})`,
  bookable: 'true / false — czy ten termin można rezerwować (tylko w kalendarzu z rezerwacjami); null — jak kalendarz',
  capacity: `miejsc na ten termin (1–${MAX_CAPACITY}); null — jak kalendarz`,
  scheme: 'schemat terminu: "name" albo "id" ze "schemes"; null — uniwersalny (eksport kalendarza ze schematami pisze null przy terminach bez schematu); brak przy nowym terminie: schemat jego rodzaju, jeśli kalendarz ma dokładnie jeden, inaczej uniwersalny; nowy punkt programu — uniwersalny',
  values: 'wartości pól schematu całego terminu: {"klucz pola": "tekst"}; "" albo null czyści pole; brak — bez zmian',
  occurrences: 'wybrane dni serii (niżej): odwołany, przeniesiony, z wartościami pól dnia',
  points: 'punkty programu: terminy pod tym terminem, w tej kolejności — z tymi samymi kluczami',
  parent: 'termin nadrzędny terminu z "appointments": "@key" terminu z tego dokumentu albo "id" terminu spoza dokumentu; null — odłącz od programu; brak — bez zmian'
};

export const OCCURRENCE_KEYS: Readonly<Record<string, string>> = {
  date: 'dzień serii "RRRR-MM-DD" — ten, na który przypada według serii (także gdy jest przeniesiony); wymagany',
  cancelled: 'true — odwołaj ten dzień (msza z przyjętymi intencjami albo termin z wpisami zostaje — import to powie); false — przywróć go do serii (bez odwołania i bez przeniesienia)',
  start: 'przenieś ten dzień: "RRRR-MM-DDTGG:MM" albo "GG:MM" (tego dnia); długość zostaje',
  values: 'wartości pól schematu tego dnia ("level": "day"): {"klucz pola": "tekst"}; "" albo null czyści pole; brak — bez zmian'
};

/** Ein Plan der Lekcje: Reihen bis zum Ende des Schuljahres, ein freier Tag, eine verlegte Stunde, ein ganzer Tag. */
const sampleLessons = () => ({
  format: CALENDAR_FORMAT,
  version: CALENDAR_VERSION,
  calendar: { title: 'Klasa 4b' },
  appointments: [
    {
      key: 'matematyka',
      title: 'Matematyka',
      start: '2026-09-07T08:00',
      end: '08:45',
      location: 'sala 12',
      repeat: 'weekly',
      weekdays: ['pn', 'śr'],
      until: '2027-06-25',
      occurrences: [
        { date: '2026-11-11', cancelled: true },
        { date: '2026-11-16', start: '2026-11-16T09:50' }
      ]
    },
    { title: 'Religia', start: '2026-09-08T10:00', end: '10:45', location: 'sala 5', repeat: 'weekly', every: 1, weekdays: ['wt'], count: 34 },
    { title: 'Dzień Edukacji Narodowej', start: '2026-10-14', end: '2026-10-14', notes: 'Bez lekcji — akademia o 10:00 w auli.' }
  ]
});

/** Rekolekcje mit Programm: Punkte unter dem Termin, einer über "@key" daneben. */
const sampleProgram = () => ({
  format: CALENDAR_FORMAT,
  version: CALENDAR_VERSION,
  appointments: [
    {
      key: 'rekolekcje',
      title: 'Rekolekcje adwentowe — dzień 1',
      start: '2026-12-06T17:00',
      end: '21:00',
      location: 'Kościół parafialny',
      link: '#/parafia/rekolekcje',
      linkLabel: 'Program i zapisy',
      points: [
        { title: 'Nauka dla młodzieży', start: '17:00', end: '18:00' },
        { title: 'Msza święta z nauką', kind: 'mass', start: '18:00', end: '19:00' },
        { title: 'Spowiedź', kind: 'confession', start: '19:15', end: '21:00', location: 'kaplica' }
      ]
    },
    { title: 'Agapa', parent: '@rekolekcje', start: '21:00', end: '22:00', location: 'salka parafialna', allDay: false }
  ]
});

/** Messen mit Schema: ein Wert am Termin, einer an einem Tag; eine Andacht; ein Treffen mit Plätzen (Kalender mit Reservierungen). */
const sampleMasses = () => ({
  format: CALENDAR_FORMAT,
  version: CALENDAR_VERSION,
  calendar: { title: 'Msze parafialne', kind: 'mass' },
  schemes: [{
    name: 'Msza',
    kind: 'mass',
    fields: [
      { key: 'celebrans', label: 'Celebrans', type: 'text', public: true },
      { key: 'kolor', label: 'Kolor szat', type: 'colour', level: 'day' }
    ]
  }],
  appointments: [
    {
      kind: 'mass',
      title: 'Msza wieczorna',
      start: '2026-11-02T18:00',
      end: '19:00',
      repeat: 'weekly',
      weekdays: ['pn', 'wt', 'śr', 'cz', 'pt'],
      scheme: 'Msza',
      values: { celebrans: 'ks. proboszcz' },
      occurrences: [{ date: '2026-11-09', values: { kolor: 'biały' } }]
    },
    { kind: 'devotion', title: 'Różaniec', start: '2026-10-30T17:30', end: '18:00' },
    { kind: 'appointment', title: 'Spotkanie z kandydatami do bierzmowania', start: '2026-11-05T19:00', end: '20:00', location: 'salka parafialna', bookable: true, capacity: 30 }
  ]
});

/** Was nach einem Export geändert wird — für die Beschreibung (die Kennungen sind Platzhalter). */
const UPDATE_EXAMPLE = {
  format: CALENDAR_FORMAT,
  version: CALENDAR_VERSION,
  calendar: { id: '…identyfikator kalendarza z eksportu…' },
  appointments: [
    { id: '…identyfikator terminu A…', location: 'Duża sala' },
    { id: '…identyfikator terminu B…', remove: true },
    { id: '…identyfikator serii C…', occurrences: [{ date: '2026-12-24', cancelled: true }] },
    { title: 'Spotkanie opłatkowe', start: '2026-12-20T16:00', end: '18:00' }
  ]
};

export const CALENDAR_SAMPLES: readonly JsonSample[] = [
  { label: 'plan lekcji (serie co tydzień)', doc: sampleLessons },
  { label: 'rekolekcje z programem', doc: sampleProgram },
  { label: 'msze ze schematem i dniami serii', doc: sampleMasses }
];

/** Ein Tag einer Reihe. */
export const OCCURRENCE_JSON: JsonNode = {
  key: 'calendar.occurrence',
  title: 'Dzień serii ("occurrences[]")',
  short: 'Dzień serii',
  text: () => `Wybrany dzień terminu — zwykle serii. Dzień nazywa się swoją datą: dniem, na który przypada według serii, także gdy jest przeniesiony. Dni bez wpisu zostają, jak są.
${keyLines(OCCURRENCE_KEYS)}
Eksport wypisuje dni z zakresu, które są odwołane, przeniesione albo mają wartości. Termin, który się nie powtarza, ma jeden dzień — dzień swojego "start".`
};

/** Ein Termin — oben in "appointments" und als Punkt in "points". */
export const APPOINTMENT_JSON: JsonNode = {
  key: 'calendar.appointment',
  title: 'Termin ("appointments[]", "points[]")',
  short: 'Termin',
  text: () => `Termin ma te same klucze co terminy strony i obszaru ("title", "start", "end", "location", "points", "repeat" …) — oraz "id", "kind", "scheme", "values" i "occurrences". Przy zmienianym terminie klucz, którego nie ma, zostaje bez zmian.
${keyLines(APPOINTMENT_KEYS)}
Zmiana czasu serii ("start", "end", "repeat", "every", "weekdays", "until", "count") zmienia wszystkie jej dni — także te, które już były. Odwołane i przeniesione dni, których nie ma w "occurrences", wracają wtedy do serii; te z "occurrences" import zapisze ponownie. Intencje i wpisy idą za dniem; gdy dnia już nie ma, termin zostaje bez zmian (import to powie). „Od tego dnia inaczej” („ten i następne”) robi się w edytorze terminu.
Wartości ("values"): "choice" i "colour" — wartość albo nazwa z listy pola; "number" — liczba; "bool" — "tak" albo "nie" (także true / false); "date" — "RRRR-MM-DD"; "time" — "GG:MM"; "link" — https://… albo #/…; "person" — identyfikator roli. Jawne pola do ${PUBLIC_VALUE} znaków. Pole wymagane ("required") musi mieć wartość — inaczej nowy termin zostaje pominięty, a zmiany istniejącego nie są zapisane.`,
  inside: () => [OCCURRENCE_JSON]
};

/*
 * 2026-10-30 — WAS DIE APP MIT DEN TERMINEN TUT: wer sie sieht, ist ein Schlüssel (`calendar.ts`,
 * `Calendar.ReadableAreasAsync`: Zuteilung, Link, offengelegte Epoche); Kalender und Teraz (`CalendarApp.tsx`,
 * `ViewParts.tsx`, `alerts.ts`); Bausteine (`calendar.tsx`, `program.tsx`, `live.tsx`, `events.tsx`, `Widget.tsx`);
 * der offene Plan der Gottesdienste und der Bogen (`Mass.Show.cs`, `MassParts.tsx`, `sheet.ts`); Angebote
 * (`calendarModel.ts`); Erinnerungen gibt es nur für Aufgaben (`notifyRich.remindersFor`), Push nicht (`Push.cs`).
 */
export const CALENDAR_USAGE_JSON: JsonNode = {
  key: 'calendar.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Terminy widzi każdy, kto ma klucz obszaru, który widzi kalendarz („Kto widzi” w ustawieniach kalendarza) — także przez link z dostępem; gdy ten obszar jest jawny („każdy czyta”), każdy, również bez konta.
- Kalendarz (Dzień, Tydzień, Miesiąc, Lista): punkty programu stoją w siatce przy swoim terminie; szczegóły terminu pokazują miejsce, notatkę, link, wartości schematu i listy wpisów dnia (intencje, zapisy). „Teraz”: „Najbliższe terminy” (dziś i jutro), a w „Czeka na Ciebie” — „Terminy dziś”.
- Moduły stron: „Kalendarz” (wybrane kalendarze), „Program wydarzenia” (termin z punktami — "points"), „Rezerwacja” (terminy do wyboru); termin ustawiony jako główny termin obszaru — w modułach „Wydarzenia” i „Wizytówka”, gdy widzi go każdy. Na stronie każdy widzi to, co może otworzyć; moduł strony jawnej można też osadzić jako widżet na innej witrynie.
- Msze, spowiedzi i nabożeństwa ("kind") są też w „Msze i nabożeństwa” (kancelaria). Gdy obszar, który widzi kalendarz, jest jawny, ich nazwy i godziny (przy mszy także jawne pola schematu) idą do jawnego planu — modułu strony „Msze i nabożeństwa” — a msze także na wydruk do gabloty; miejsca i notatki tam nie ma.
- "bookable" i "capacity" (kalendarz z rezerwacjami): termin można wybrać w module „Rezerwacja”; w Kalendarzu stoi przy nim liczba zajętych miejsc, a prośby czekają w „Do potwierdzenia”.
- Terminy nie mają przypomnień (mają je zadania), a import nikogo nie powiadamia.`
};

/** Die Termine eines Kalenders — die Wurzel neben ihrem Import und im MCP-Katalog. */
export const CALENDAR_JSON: JsonNode = {
  key: 'calendar',
  title: `Terminy kalendarza ("${CALENDAR_FORMAT}")`,
  short: 'Terminy kalendarza',
  text: () => `Terminy JEDNEGO kalendarza: pojedyncze i powtarzające się (serie — np. tygodniowy plan lekcji albo msze w dni powszednie), całodniowe, z miejscem, notatką i linkiem, z programem (punkty pod terminem), ze schematem kalendarza i jego wartościami oraz z wybranymi dniami serii (odwołany, przeniesiony, z własnymi wartościami). Msze, spowiedzi i nabożeństwa są tu terminami jak inne ("kind").
Eksport (ustawienia kalendarza → „Terminy jako JSON”; kto kalendarz tylko widzi: „Kalendarze” → „Eksport JSON”): terminy z wybranego zakresu (domyślnie od dziś na rok) i serie, które w niego sięgają — każdy z "id".
Import zmienia NA MIEJSCU: termin z "id" (z eksportu tego kalendarza) zostaje zmieniony, termin bez "id" zostaje dodany. Klucz, którego nie ma, zostaje bez zmian — wystarczy "id" i to, co się zmienia; "" albo null czyści tekst. Nic nie znika, chyba że termin ma "remove": true. Przed importem widać listę zmian i ostrzeżenia; ten sam dokument zaimportowany drugi raz niczego już nie zmienia.
Tytuły, miejsca, notatki, linki i niejawne wartości są szyfrowane w przeglądarce kluczem obszaru, który widzi kalendarz — tak jak w edytorze terminu. Plik eksportu zawiera je jawnie: to Twoja kopia.
Import nie zmienia: intencji mszy (osobny format mszy i intencji), wpisów list (zapisy), rezerwacji, osób przy terminie ani tego, kto widzi termin (to mówi kalendarz).
Dokument z innego kalendarza ("calendar" z innym "id") jest kopią: jego terminy zostaną dodane jako nowe.
${keyLines(DOC_KEYS)}
"calendar":
${keyLines(CALENDAR_KEYS, '    ')}
"range":
${keyLines(RANGE_KEYS, '    ')}
"schemes[]":
${keyLines(SCHEMES_KEYS, '    ')}
Czas jest lokalny (strefa kalendarza), bez strefy: chwila "RRRR-MM-DDTGG:MM", dzień "RRRR-MM-DD", godzina "GG:MM".
Limity: ${MAX_ENTRIES} terminów razem z punktami w jednym dokumencie, program do ${MAX_DEPTH} poziomów, ${MAX_OCCURRENCES} dni na termin w "occurrences".
Zmiany po eksporcie — nowe miejsce, usunięcie, odwołany dzień serii i nowy termin:
${pretty(UPDATE_EXAMPLE)}
Przykład (plan lekcji klasy):
${pretty(sampleLessons())}`,
  inside: () => [CALENDAR_USAGE_JSON, APPOINTMENT_JSON, SCHEME_FIELD_JSON],
  samples: () => CALENDAR_SAMPLES
};
