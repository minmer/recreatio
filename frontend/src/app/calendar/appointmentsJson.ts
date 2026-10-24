/**
 * 2026-10-24 — TERMINE IM JSON EINER SEITE: was eine Seite an Terminen
 * mitbringt (Rekolekcje, eine Wallfahrt, ein Festyn) — mit ihren Punkten und
 * Unterpunkten (dem Programm, 0070).
 *
 * <code>
 *   "calendars":    [{ "key": "rekolekcje", "label": "Kalendarz rekolekcji", "calendar": "<id>" }]   Eingänge
 *   "appointments": [{ "key": "dzien1", "calendar": "rekolekcje", "title": "…", "start": "2026-12-05T18:00",
 *                      "end": "21:00", "points": [{ "title": "Msza", "start": "18:00", "end": "19:00" }] }]
 * </code>
 *
 * <b>Die Eingänge wählt, wer importiert</b> — wie bei einem Formular der
 * Bereich, in den neue Antworten gehen: je Eingang ein Kalender, in dem er
 * schreibt. Das Dokument kann einen vorschlagen (`calendar`), entscheiden tut
 * die Auswahl beim Import. Ein Termin ohne `calendar` geht in den Eingang
 * "kalendarz".
 *
 * <b>Module verweisen mit „@key"</b> — "program": `item` "@dzien1",
 * `calendar` "@rekolekcje"; "calendar": `calendars` "@rekolekcje". Nach dem
 * Anlegen stehen dort die echten Kennungen.
 *
 * <b>Der Import legt an, er ändert nichts.</b> Zweimal importiert heisst
 * zweimal eingetragen — die Vorschau sagt es. Ein Termin, den es schon gibt,
 * steht im Export als Kennung am Modul, nicht hier.
 */

import type { RepeatKind } from './agenda';

/** Der Eingang eines Termins ohne eigenen. */
export const DEFAULT_ENTRY = 'kalendarz';

/** Höchstens so viele Termine samt Punkten je Dokument — mehr ist ein Kalender, keine Seite. */
export const MAX_APPOINTMENTS = 300;

/** So tief verschachtelt das Programm höchstens (Termin → Punkt → Unterpunkt → …). */
export const MAX_DEPTH = 4;

const REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const;

export interface EntryPoint {
  readonly key: string;
  readonly label: string;
  /** Ein Kalender, den das Dokument vorschlägt (seine Kennung) — oder keiner. */
  readonly suggested: string | null;
  /** Wie viele Termine (ohne Punkte) hineingehen. */
  readonly count: number;
}

export interface AppointmentDoc {
  readonly key: string | null;
  /** Der Eingang (nur oben; Punkte folgen ihrem Termin). */
  readonly entry: string;
  readonly title: string;
  /** Ortszeit — „2026-12-05", „18:00" („00:00" ganztägig). */
  readonly date: string;
  readonly time: string;
  readonly minutes: number;
  readonly allDay: boolean;
  readonly location: string;
  readonly notes: string;
  readonly link: string;
  readonly linkLabel: string;
  readonly repeat: RepeatKind;
  readonly every: number;
  /** pn=1 … nd=64 (nur bei "weekly"). */
  readonly weekdays: number;
  readonly until: string | null;
  readonly points: readonly AppointmentDoc[];
}

export interface AppointmentsPlan {
  readonly entries: readonly EntryPoint[];
  readonly items: readonly AppointmentDoc[];
  /** Alle Termine samt Punkten. */
  readonly total: number;
  /** Die Namen, auf die Module mit „@" verweisen dürfen: Termine und Eingänge. */
  readonly keys: ReadonlySet<string>;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const KEY = /^[a-z0-9][a-z0-9_-]{0,40}$/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const AT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const CLOCK = /^(\d{2}):(\d{2})$/;

const two = (n: number) => String(n).padStart(2, '0');
const dayText = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** Ein Tag, den es gibt („2026-02-30" gibt es nicht). */
function validDay(y: number, m: number, d: number): Date | null {
  const at = new Date(y, m - 1, d);
  return at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d ? at : null;
}

interface When { readonly day: Date; readonly minute: number | null }

/** „2026-12-05T18:00", „2026-12-05" — oder, unter einem Termin, „18:00" an seinem Tag. */
function readWhen(value: unknown, sameDay: Date | null): When | null {
  const text = str(value);
  let m = AT.exec(text);
  if (m !== null) {
    const day = validDay(Number(m[1]), Number(m[2]), Number(m[3]));
    const h = Number(m[4]), min = Number(m[5]);
    return day === null || h > 23 || min > 59 ? null : { day, minute: h * 60 + min };
  }
  m = DAY.exec(text);
  if (m !== null) {
    const day = validDay(Number(m[1]), Number(m[2]), Number(m[3]));
    return day === null ? null : { day, minute: null };
  }
  m = CLOCK.exec(text);
  if (m !== null && sameDay !== null) {
    const h = Number(m[1]), min = Number(m[2]);
    return h > 23 || min > 59 ? null : { day: sameDay, minute: h * 60 + min };
  }
  return null;
}

const dayBit = (day: Date) => 1 << ((day.getDay() + 6) % 7);

/** „Bez końca", wie im Kalender: zehn Jahre voraus (eine Reihe braucht am Dienst ein Ende). */
const tenYears = (from: Date): string => dayText(new Date(from.getFullYear() + 10, from.getMonth(), from.getDate()));

/**
 * DULDSAM LESEN — was kein Termin ist, fällt weg, mit einem Wort dazu.
 * `undefined`: das Dokument bringt keine Termine (der Schlüssel fehlt).
 */
export function readAppointments(value: unknown, calendars: unknown, warnings: string[]): AppointmentsPlan | undefined {
  if (value === undefined) {
    if (calendars !== undefined) warnings.push('"calendars" bez "appointments" — nie ma czego dodać do kalendarza.');
    return undefined;
  }
  if (!Array.isArray(value)) {
    warnings.push('"appointments" to nie lista — pominięte.');
    return { entries: [], items: [], total: 0, keys: new Set() };
  }

  /* Die Eingänge, die das Dokument beschreibt. */
  const described = new Map<string, { label: string; suggested: string | null }>();
  for (const [at, one] of (Array.isArray(calendars) ? calendars : []).entries()) {
    const row = record(one);
    const key = str(row.key);
    if (!KEY.test(key)) { warnings.push(`"calendars"[${at}]: "key" to krótka nazwa (litery, cyfry, - i _) — pominięty.`); continue; }
    if (described.has(key)) { warnings.push(`Kalendarz „${key}” powtarza się — liczy się pierwszy.`); continue; }
    described.set(key, { label: str(row.label) || key, suggested: str(row.calendar) || null });
  }
  if (calendars !== undefined && !Array.isArray(calendars)) warnings.push('"calendars" to nie lista — pominięte.');

  const keys = new Set<string>();
  const used = new Map<string, number>();
  let total = 0;

  const readOne = (raw: unknown, where: string, depth: number, parent: AppointmentDoc | null): AppointmentDoc | null => {
    const row = record(raw);
    const title = str(row.title);
    if (title === '') { warnings.push(`${where}: termin bez "title" — pominięty.`); return null; }
    if (total >= MAX_APPOINTMENTS) {
      if (total === MAX_APPOINTMENTS) warnings.push(`Najwyżej ${MAX_APPOINTMENTS} terminów (z punktami) w jednym dokumencie — reszta pominięta.`);
      total++;
      return null;
    }

    /* Der Anfang: oben Pflicht; ein Punkt ohne eigenen beginnt mit seinem Termin. */
    const parentDay = parent === null ? null : readWhen(parent.date, null)?.day ?? null;
    let start = readWhen(row.start, parentDay);
    if (start === null) {
      if (parent === null || row.start !== undefined) {
        warnings.push(`${where} „${title}”: "start" to "RRRR-MM-DDTGG:MM" albo "RRRR-MM-DD"${parent === null ? '' : ' (w punkcie także "GG:MM")'} — pominięty.`);
        return null;
      }
      start = { day: parentDay!, minute: parent.allDay ? null : Number(parent.time.slice(0, 2)) * 60 + Number(parent.time.slice(3, 5)) };
    }
    const allDay = start.minute === null || row.allDay === true;

    /* Das Ende: ganztägig ein Tag (einschliesslich), sonst eine Uhrzeit — fehlt es, eine Stunde. */
    let minutes: number;
    const end = readWhen(row.end, start.day);
    if (allDay) {
      const last = end?.day ?? start.day;
      const days = Math.round((last.getTime() - start.day.getTime()) / 86_400_000) + 1;
      if (days < 1) warnings.push(`${where} „${title}”: "end" przed "start" — jeden dzień.`);
      minutes = Math.max(1, days) * 1440;
    } else {
      const begin = start.day.getTime() + start.minute! * 60_000;
      const finish = end === null ? null : end.day.getTime() + (end.minute ?? 0) * 60_000;
      if (row.end !== undefined && end === null) warnings.push(`${where} „${title}”: nieczytelne "end" — godzina.`);
      minutes = finish === null || finish <= begin ? 60 : Math.round((finish - begin) / 60_000);
      if (finish !== null && finish <= begin) warnings.push(`${where} „${title}”: "end" nie jest po "start" — godzina.`);
    }

    /* Der Name, auf den Module verweisen. */
    let key: string | null = null;
    if (row.key !== undefined) {
      const wanted = str(row.key);
      if (!KEY.test(wanted)) warnings.push(`${where} „${title}”: "key" to krótka nazwa (litery, cyfry, - i _) — bez nazwy.`);
      else if (keys.has(wanted)) warnings.push(`${where} „${title}”: "key" „${wanted}” już jest — bez nazwy.`);
      else { key = wanted; keys.add(wanted); }
    }

    /* Der Eingang — nur oben; ein Punkt geht, wohin sein Termin geht. */
    let entry = parent?.entry ?? DEFAULT_ENTRY;
    if (parent === null && row.calendar !== undefined) {
      const wanted = str(row.calendar);
      if (KEY.test(wanted)) entry = wanted;
      else warnings.push(`${where} „${title}”: "calendar" to nazwa wejścia z "calendars" — do „${DEFAULT_ENTRY}”.`);
    } else if (parent !== null && row.calendar !== undefined) {
      warnings.push(`${where} „${title}”: punkt idzie do kalendarza swojego terminu — "calendar" pominięte.`);
    }

    /* Wiederholung — nur ein Termin oben, kein Punkt. */
    let repeat: RepeatKind = 'none';
    let every = 1;
    let weekdays = 0;
    let until: string | null = null;
    if (row.repeat !== undefined) {
      const wanted = str(row.repeat) as RepeatKind;
      if (parent !== null) warnings.push(`${where} „${title}”: punkt programu się nie powtarza — "repeat" pominięte.`);
      else if (!REPEATS.includes(wanted)) warnings.push(`${where} „${title}”: "repeat" to "none", "daily", "weekly", "monthly" albo "yearly" — bez powtarzania.`);
      else {
        repeat = wanted;
        every = typeof row.every === 'number' && Number.isInteger(row.every) && row.every >= 1 && row.every <= 99 ? row.every : 1;
        if (repeat === 'weekly') {
          const words = Array.isArray(row.weekdays) ? row.weekdays.map(str) : [];
          for (const w of words) {
            const at = (WEEKDAY_WORDS as readonly string[]).indexOf(w);
            if (at >= 0) weekdays |= 1 << at; else warnings.push(`${where} „${title}”: dzień „${w}” — dni to ${WEEKDAY_WORDS.join(', ')}.`);
          }
          if (weekdays === 0) weekdays = dayBit(start.day);
        }
        if (repeat !== 'none') {
          const last = readWhen(row.until, null);
          if (row.until !== undefined && last === null) warnings.push(`${where} „${title}”: "until" to "RRRR-MM-DD" — bez końca.`);
          until = last === null ? tenYears(start.day) : dayText(last.day);
        }
      }
    }

    total++;
    const base: AppointmentDoc = {
      key, entry, title,
      date: dayText(start.day),
      time: allDay ? '00:00' : `${two(Math.floor(start.minute! / 60))}:${two(start.minute! % 60)}`,
      minutes, allDay,
      location: str(row.location), notes: str(row.notes), link: str(row.link), linkLabel: str(row.linkLabel),
      repeat, every, weekdays, until,
      points: []
    };
    if (parent === null) used.set(entry, (used.get(entry) ?? 0) + 1);

    const rawPoints = row.points;
    if (rawPoints !== undefined && !Array.isArray(rawPoints)) warnings.push(`${where} „${title}”: "points" to lista — pominięte.`);
    if (!Array.isArray(rawPoints) || rawPoints.length === 0) return base;
    if (depth >= MAX_DEPTH) {
      warnings.push(`${where} „${title}”: program głębszy niż ${MAX_DEPTH} poziomy — dalsze podpunkty pominięte.`);
      return base;
    }
    const points = rawPoints.map((p, i) => readOne(p, `${where}.points[${i}]`, depth + 1, base)).filter((p): p is AppointmentDoc => p !== null);
    return { ...base, points };
  };

  const items = value.map((one, i) => readOne(one, `"appointments"[${i}]`, 1, null)).filter((a): a is AppointmentDoc => a !== null);

  /* Eingänge: die beschriebenen, die gebraucht werden, und die nur genannten. */
  const entries: EntryPoint[] = [];
  for (const [key, count] of used) {
    const said = described.get(key);
    entries.push({ key, label: said?.label ?? (key === DEFAULT_ENTRY ? 'Kalendarz' : key), suggested: said?.suggested ?? null, count });
  }
  for (const key of described.keys()) {
    if (!used.has(key)) warnings.push(`Kalendarz „${key}” z "calendars" nie ma żadnego terminu.`);
  }
  for (const entry of entries) {
    if (keys.has(entry.key)) warnings.push(`„${entry.key}” to nazwa i terminu, i kalendarza — „@${entry.key}” wskaże termin.`);
  }

  return { entries, items, total: Math.min(total, MAX_APPOINTMENTS), keys: new Set([...keys, ...entries.map((e) => e.key)]) };
}

/** Felder eines Bausteins, die auf Kalender oder Termine zeigen — nur dort gilt „@name". */
export const REFERENCE_FIELDS: readonly string[] = ['calendar', 'calendars', 'calendarItem'];

/** „@name"-Verweise in den genannten Feldern einer Tafel (ein Wert, oder eine Liste mit Kommas). */
export function referencesIn(config: Readonly<Record<string, string>>, fields: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const field of fields) {
    const value = config[field];
    if (typeof value !== 'string' || !value.includes('@')) continue;
    for (const token of value.split(',')) {
      const t = token.trim();
      if (t.startsWith('@') && KEY.test(t.slice(1)) && !out.includes(t.slice(1))) out.push(t.slice(1));
    }
  }
  return out;
}

/**
 * Die Verweise einer Tafel durch Kennungen ersetzen: erst Termine, dann
 * Eingänge. Ein "program" mit Termin, aber ohne Kalender, bekommt den
 * Kalender seines Termins. Was nicht aufgeht, bleibt stehen (und wird gemeldet).
 */
export function resolveReferences(
  kind: string, config: Readonly<Record<string, string>>, fields: readonly string[],
  items: ReadonlyMap<string, { readonly itemId: string; readonly calendarId: string }>,
  calendars: ReadonlyMap<string, string>
): { config: Record<string, string>; missing: string[] } {
  const missing: string[] = [];
  const next: Record<string, string> = {};
  for (const [field, value] of Object.entries(config)) {
    if (!fields.includes(field) || typeof value !== 'string' || !value.includes('@')) { next[field] = value; continue; }
    next[field] = value.split(',').map((token) => {
      const t = token.trim();
      if (!t.startsWith('@') || !KEY.test(t.slice(1))) return token;
      const name = t.slice(1);
      const id = items.get(name)?.itemId ?? calendars.get(name);
      if (id === undefined) { if (!missing.includes(name)) missing.push(name); return token; }
      return token.replace(t, id);
    }).join(',');
  }
  if (kind === 'program' && (next.calendar ?? '').trim() === '') {
    const itemRef = (config.item ?? '').trim();
    const found = itemRef.startsWith('@') ? items.get(itemRef.slice(1)) : undefined;
    if (found !== undefined) next.calendar = found.calendarId;
  }
  return { config: next, missing };
}

/** Vorschau: wie viele, wohin. */
export function describePlan(plan: AppointmentsPlan): string {
  const top = plan.items.length;
  const points = plan.total - top;
  const where = plan.entries.map((e) => `„${e.label}” (${e.count})`).join(', ');
  return `Terminy do kalendarza: ${top}${points > 0 ? ` (z punktami programu: ${points})` : ''} — ${where}. Każdy import dodaje je od nowa.`;
}
