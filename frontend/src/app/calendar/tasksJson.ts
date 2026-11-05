/**
 * 2026-10-29 — ZADANIA ALS JSON („recreatio/tasks"; Wunsch: JSON für jeden Teil
 * von Recreatio): Export, Import mit Plan, und die Beschreibung daneben — wie
 * überall (Erinnerung „json-import-export"). Dieselbe Beschreibung bekommt eine
 * KI über den MCP-Server (`scripts/import-formats.mjs`).
 *
 * <b>Rein</b> — kein Dienst, kein Schlüssel. Hinein kommen die geöffneten
 * Aufgaben (`openTasks`) und die Gruppen; heraus ein Dokument, ein Plan und je
 * Änderung ein `TaskDraft`. Versiegelt und gespeichert wird mit `saveTask`
 * (`TasksJsonPanel.tsx`) — derselbe Weg wie im Fenster einer Aufgabe; kein Klartext
 * geht zum Dienst, der heute nicht schon hinginge.
 *
 * <b>An Ort und Stelle</b>: mit "id" ändert der Import diese Aufgabe, und nur die
 * Schlüssel, die im Dokument stehen; ohne "id" legt er eine neue an. Fort kommt
 * eine Aufgabe nur mit "remove": true — ins Archiv, wie „Usuń".
 *
 * <b>Was erledigt wurde, gehört nicht hinein</b>: ein Häkchen setzt ein Mensch
 * in der App, kein Dokument — schon gar nicht für andere.
 *
 * <b>Nur, was das Fenster einer Aufgabe kennt.</b> Ein Ende der Reihe und „jede
 * zweite Woche" kann der Dienst, aber `TaskDialog` zeigt beides nicht und
 * schickt beim Speichern 1 und kein Ende — ein importiertes Ende verschwände
 * beim ersten Bearbeiten still. Darum fehlen sie im Format.
 */

import { t, texts } from '../core/i18n';
import { describe, keyLines, pretty, type JsonNode, type JsonSample } from '../core/jsonTree';
import { fold } from '../shell/search';
import type { RepeatKind } from './agenda';
import type { OpenTask, ReminderKind, TaskDraft, TaskKind } from './tasks';

export const TASKS_FORMAT = 'recreatio/tasks';
export const TASKS_VERSION = 1;

/** So viele Aufgaben liest ein Import höchstens — jede ist ein eigener Aufruf mit eigenem Siegel. */
export const MAX_TASKS = 500;
/** Wie das Feld „Co" im Fenster einer Aufgabe. */
export const MAX_TITLE = 200;
/** Weit unter dem, was der Dienst nimmt (64 KiB versiegelt). */
export const MAX_NOTES = 20_000;
/** 366 Tage: so lange steht ein Fenster oder Zeitraum höchstens offen, so selten kehrt eine Aufgabe höchstens wieder (der Dienst: `MaxWindowMinutes`, `MaxEveryMinutes`). */
export const MAX_SPAN_MINUTES = 366 * 1440;

/** Was das Fenster einer Aufgabe vorschlägt, wenn nichts gesagt ist (`TaskDialog`). */
export const TASK_DEFAULTS = { windowMinutes: 15, lasts: 3 * 1440, periodEvery: 14 * 1440, afterEvery: 3 * 1440 } as const;

export const TASK_KINDS: readonly TaskKind[] = ['window', 'period', 'after'];

export const KIND_WORD: Readonly<Record<TaskKind, string>> = texts({
  window: 'calendarDataTasks.kind.window',
  period: 'calendarDataTasks.kind.period',
  after: 'calendarDataTasks.kind.after'
});

/** Eine Tabelle, deren Texte erst beim Lesen geholt werden (mit Werten darin). */
function lazy(table: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(table)) Object.defineProperty(out, key, { get: text, enumerable: true });
  return out;
}

const REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

const REPEAT_WORD: Readonly<Record<RepeatKind, string>> = texts({
  none: 'calendarDataTasks.repeat.none', daily: 'calendarDataTasks.repeat.daily', weekly: 'calendarDataTasks.repeat.weekly', monthly: 'calendarDataTasks.repeat.monthly', yearly: 'calendarDataTasks.repeat.yearly'
});

/** Die Bits von `REMIND` (tasks.ts) — hier noch einmal, damit dieses Modul ohne Schlüsselbund lädt; die Probe vergleicht beide. */
export const REMIND_BITS: Readonly<Record<ReminderKind, number>> = { start: 1, middle: 2, end: 4 };
const REMIND_KINDS = Object.keys(REMIND_BITS) as ReminderKind[];
const REMIND_WORD: Readonly<Record<ReminderKind, string>> = texts({ start: 'calendarDataTasks.remind.start', middle: 'calendarDataTasks.remind.middle', end: 'calendarDataTasks.remind.end' });
/** Gelesen wird auch, was das Fenster dazu sagt („na początku") — ohne Zeichen, klein. */
const REMIND_READ = new Map<string, ReminderKind>([
  ['start', 'start'], ['middle', 'middle'], ['end', 'end'],
  ['na poczatku', 'start'], ['poczatek', 'start'], ['w polowie', 'middle'], ['polowa', 'middle'], ['pod koniec', 'end'], ['koniec', 'end']
]);

/** Die Tage wie im JSON der Termine (`appointmentsJson.ts`): pn = 1 … nd = 64. */
export const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const; // i18n-ignore
/** Gelesen wird auch, wie die Knöpfe heissen („czw", „sob"), und ohne Zeichen („sr"). */
const WEEKDAY_READ = new Map<string, number>([['pn', 0], ['wt', 1], ['sr', 2], ['cz', 3], ['czw', 3], ['pt', 4], ['so', 5], ['sob', 5], ['nd', 6], ['ndz', 6]]);

/** Die Einheiten einer Dauer ("lasts", "every") — in Minuten, die grösste zuerst. */
const SPAN_UNITS: readonly (readonly [string, number])[] = [['weeks', 10080], ['days', 1440], ['hours', 60], ['minutes', 1]];

/** Wie eine Gruppe heisst, die ich nicht kenne (wie `groupName`). */
const otherGroup = (): string => t('calendarDataTasks.otherGroup');
/** Wie „Tylko ja" heisst. */
const onlyMe = (): string => t('calendarDataTasks.onlyMe');

/* -- Die Schlüssel, je mit ihrem Satz (Beschreibung und Probe lesen dieselben) --------------------- */

export const TASKS_DOC_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => t('calendarDataTasks.keys.doc.format', { format: TASKS_FORMAT }),
  version: () => t('calendarDataTasks.keys.doc.version', { version: TASKS_VERSION }),
  groups: () => t('calendarDataTasks.keys.doc.groups'),
  tasks: () => t('calendarDataTasks.keys.doc.tasks', { max: MAX_TASKS })
});

export const TASK_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('calendarDataTasks.keys.task.id'),
  title: () => t('calendarDataTasks.keys.task.title', { max: MAX_TITLE }),
  kind: () => t('calendarDataTasks.keys.task.kind', { kinds: TASK_KINDS.map((k) => `"${k}" (${KIND_WORD[k]})`).join(', ') }),
  who: () => t('calendarDataTasks.keys.task.who'),
  start: () => t('calendarDataTasks.keys.task.start'),
  end: () => t('calendarDataTasks.keys.task.end', { minutes: TASK_DEFAULTS.windowMinutes }),
  repeat: () => t('calendarDataTasks.keys.task.repeat', { repeats: REPEATS.map((r) => `"${r}" (${REPEAT_WORD[r]})`).join(', ') }),
  weekdays: () => t('calendarDataTasks.keys.task.weekdays', { days: WEEKDAY_WORDS.map((w) => `"${w}"`).join(', ') }),
  lasts: () => t('calendarDataTasks.keys.task.lasts'),
  every: () => t('calendarDataTasks.keys.task.every'),
  remind: () => t('calendarDataTasks.keys.task.remind', { kinds: REMIND_KINDS.map((r) => `"${r}" (${REMIND_WORD[r]})`).join(', ') }),
  notes: () => t('calendarDataTasks.keys.task.notes', { max: MAX_NOTES }),
  remove: () => t('calendarDataTasks.keys.task.remove'),
  locked: () => t('calendarDataTasks.keys.task.locked')
});

export const TASK_GROUP_KEYS: Readonly<Record<string, string>> = lazy({
  key: () => t('calendarDataTasks.keys.group.key'),
  id: () => t('calendarDataTasks.keys.group.id'),
  name: () => t('calendarDataTasks.keys.group.name'),
  readOnly: () => t('calendarDataTasks.keys.group.readOnly')
});

/** Die Einheiten einer Dauer und ihr Wort. */
export const TASK_SPAN_KEYS: Readonly<Record<string, string>> = texts({
  minutes: 'calendarDataTasks.keys.span.minutes', hours: 'calendarDataTasks.keys.span.hours', days: 'calendarDataTasks.keys.span.days', weeks: 'calendarDataTasks.keys.span.weeks'
});

/* -- Was der Plan kennt ------------------------------------------------------------------------- */

/** Eine Gruppe, in der Aufgaben liegen können — „Tylko ja" eingeschlossen. */
export interface TaskGroup {
  readonly areaId: string;
  /** Wie sie heisst — der Weg im Baum („Parafia › Schola"), „Tylko ja" für den eigenen Bereich. */
  readonly name: string;
  /** Darf ich hier Aufgaben anlegen, ändern und entfernen? */
  readonly write: boolean;
  /** Der eigene Bereich („Tylko ja"). */
  readonly personal?: boolean;
  /** Eine Rozmowa (ihr eigener Bereich): in der Liste des Exports nur, wenn eine Aufgabe sie nennt. */
  readonly chat?: boolean;
}

/** Was Export und Plan von einer gespeicherten Aufgabe brauchen. */
export type TaskSource = Pick<OpenTask,
  'taskId' | 'areaId' | 'kind' | 'startsAt' | 'windowMinutes' | 'everyMinutes' | 'repeatKind' | 'repeatWeekdays' | 'remind' | 'title' | 'notes' | 'locked'>;

/** Was eine Aufgabe IST — ohne das, was an ihr erledigt wurde. So vergleicht der Plan, so speichert das Fenster. */
export interface TaskSpec {
  readonly title: string;
  readonly notes: string;
  readonly kind: TaskKind;
  /** Eine Gruppe — oder `null`: „Tylko ja" (den es vielleicht noch nicht gibt). */
  readonly areaId: string | null;
  /** Ortszeit, wie im Fenster: „2026-11-02", „21:00". */
  readonly date: string;
  readonly time: string;
  readonly windowMinutes: number;
  readonly everyMinutes: number | null;
  readonly repeat: RepeatKind;
  readonly weekdays: number;
  readonly remind: number;
}

export interface PlannedTask {
  readonly action: 'new' | 'change' | 'remove';
  /** Die Kennung einer bestehenden Aufgabe — `null` bei einer neuen. */
  readonly taskId: string | null;
  readonly title: string;
  /** Was gespeichert wird (nicht beim Entfernen). */
  readonly spec: TaskSpec | null;
  /** Was sich ändert, in Worten (nur bei `change`). */
  readonly what: readonly string[];
}

export interface TasksPlan {
  readonly changes: readonly PlannedTask[];
  readonly created: number;
  readonly updated: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

export interface TasksBase {
  /** Die Aufgaben, die ich sehe (`openTasks`). */
  readonly tasks: readonly TaskSource[];
  /** Meine Gruppen — mit „Tylko ja", sobald es ihn gibt. */
  readonly groups: readonly TaskGroup[];
  /** Jetzt — für „beginnt in der Vergangenheit". */
  readonly now: Date;
}

/* -- Kleinigkeiten -------------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const has = (keys: Readonly<Record<string, string>>, key: string): boolean => Object.prototype.hasOwnProperty.call(keys, key);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9][a-z0-9_-]{0,40}$/i;
const quote = (text: string): string => `„${text.length > 60 ? `${text.slice(0, 59)}…` : text}”`;
const shown = (value: unknown): string => quote(typeof value === 'string' ? value : JSON.stringify(value) ?? String(value));

/** „nieznany klucz "x" — pominięty" — oder `null`, wenn alle bekannt sind. */
function unknownKeys(value: Json, keys: Readonly<Record<string, string>>): string | null {
  const odd = Object.keys(value).filter((key) => !has(keys, key));
  if (odd.length === 0) return null;
  const list = odd.map((key) => `"${key}"`).join(', ');
  return t('calendarDataTasks.unknownKeys', { count: odd.length, list });
}

/* -- Ortszeit ------------------------------------------------------------------------------------- */

const two = (n: number): string => String(n).padStart(2, '0');
const dayOf = (at: Date): string => `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
const clockOf = (at: Date): string => `${two(at.getHours())}:${two(at.getMinutes())}`;

/** „2026-11-02" und „21:00" in Ortszeit — als Augenblick (wie `fromLocal` im Fenster). */
function localAt(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

const nextDay = (date: string): string => {
  const at = localAt(date, '00:00');
  at.setDate(at.getDate() + 1);
  return dayOf(at);
};

const AT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const CLOCK = /^(\d{1,2}):(\d{2})$/;

/**
 * „2026-11-02T21:00" oder „2026-11-02" (`time: null`) — ein Tag, den es gibt („2026-02-30" gibt es nicht).
 * Ein Zeitpunkt mit Zone („…Z", „+01:00"), wie ihn eine KI gern schreibt, ist eindeutig: er wird Ortszeit.
 */
function readMoment(value: unknown): { date: string; time: string | null } | null {
  if (typeof value !== 'string') return null;
  if (ZONED.test(value.trim())) {
    const at = new Date(value.trim());
    return Number.isNaN(at.getTime()) ? null : { date: dayOf(at), time: clockOf(at) };
  }
  const m = AT.exec(value.trim());
  if (m === null) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const day = new Date(y, mo - 1, d);
  if (day.getFullYear() !== y || day.getMonth() !== mo - 1 || day.getDate() !== d) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined) return { date, time: null };
  const h = Number(m[4]), min = Number(m[5]);
  return h > 23 || min > 59 ? null : { date, time: `${two(h)}:${two(min)}` };
}

/** Das Ende des ersten Fensters → seine Länge in Minuten; sonst, was daran nicht stimmt. */
function readEnd(value: unknown, date: string, time: string): number | string {
  const begin = localAt(date, time).getTime();
  const text = typeof value === 'string' ? value.trim() : '';
  let end: number;
  const clock = CLOCK.exec(text);
  if (clock !== null) {
    const h = Number(clock[1]), min = Number(clock[2]);
    if (h > 23 || min > 59) return t('calendarDataTasks.end.noSuchTime');
    const at = `${two(h)}:${two(min)}`;
    end = localAt(date, at).getTime();
    /* Eine Stunde vor dem Anfang meint die Nacht: 23:00–01:00. */
    if (end < begin) end = localAt(nextDay(date), at).getTime();
  } else {
    const moment = readMoment(text);
    if (moment === null) return t('calendarDataTasks.end.format');
    /* Ein Tag allein: bis zu seinem Ende — wie ein ganztägiger Termin. */
    end = moment.time === null ? localAt(nextDay(moment.date), '00:00').getTime() : localAt(moment.date, moment.time).getTime();
  }
  const minutes = Math.round((end - begin) / 60_000);
  if (minutes < 0) return t('calendarDataTasks.end.beforeStart');
  if (minutes > MAX_SPAN_MINUTES) return t('calendarDataTasks.end.tooLong');
  return minutes;
}

/** Eine Dauer: `{"days": 3}`, mehrere Einheiten zusammengezählt — oder, was daran nicht stimmt. */
function readSpan(value: unknown): number | string {
  if (typeof value === 'number') return t('calendarDataTasks.span.bare', { value });
  if (!isObject(value)) return t('calendarDataTasks.span.notObject');
  let total = 0;
  let any = false;
  for (const [unit, amount] of Object.entries(value)) {
    const size = SPAN_UNITS.find(([name]) => name === unit)?.[1];
    if (size === undefined) return t('calendarDataTasks.span.unknownUnit', { unit, units: SPAN_UNITS.map(([name]) => `"${name}"`).join(', ') });
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return t('calendarDataTasks.span.negative', { unit });
    total += amount * size;
    any = true;
  }
  if (!any) return t('calendarDataTasks.span.empty');
  const minutes = Math.round(total);
  return minutes < 1 || minutes > MAX_SPAN_MINUTES ? t('calendarDataTasks.span.range') : minutes;
}

/** Eine Dauer, wie der Export sie schreibt — in der grössten Einheit, die sie glatt teilt. */
export function spanOut(minutes: number): Record<string, number> {
  const [unit, size] = SPAN_UNITS.find(([, one]) => minutes > 0 && minutes % one === 0) ?? ['minutes', 1];
  return { [unit]: minutes / size };
}

/** „3 dni", „2 tyg.", „36 godz.", „90 min". */
function spanWords(minutes: number): string {
  if (minutes > 0 && minutes % 10080 === 0) return t('calendarDataTasks.spanWords.weeks', { count: minutes / 10080 });
  if (minutes > 0 && minutes % 1440 === 0) return t('calendarDataTasks.spanWords.days', { count: minutes / 1440 });
  if (minutes > 0 && minutes % 60 === 0) return t('calendarDataTasks.spanWords.hours', { count: minutes / 60 });
  return t('calendarDataTasks.spanWords.minutes', { count: minutes });
}

/** Wie `everyWords` (tasks.ts): „co 3 dni", „co tydzień", „codziennie". */
function everyWords(minutes: number): string {
  if (minutes > 0 && minutes % 10080 === 0) return t('calendarDataTasks.everyWords.weeks', { count: minutes / 10080 });
  if (minutes > 0 && minutes % 1440 === 0) return t('calendarDataTasks.everyWords.days', { count: minutes / 1440 });
  if (minutes > 0 && minutes % 60 === 0) return t('calendarDataTasks.everyWords.hours', { count: minutes / 60 });
  return t('calendarDataTasks.everyWords.minutes', { count: minutes });
}

const bitOfDay = (date: string): number => 1 << ((localAt(date, '00:00').getDay() + 6) % 7);
const weekdayList = (bits: number): string[] => WEEKDAY_WORDS.filter((_, i) => (bits & (1 << i)) !== 0);
const remindList = (bits: number): ReminderKind[] => REMIND_KINDS.filter((k) => (bits & REMIND_BITS[k]) !== 0);
const remindText = (bits: number): string => (bits === 0 ? t('calendarDataTasks.noReminders') : remindList(bits).map((k) => REMIND_WORD[k]).join(', '));

/** Die Tage einer Woche: Wörter (oder 1–7); was keiner ist, steht in `bad`. */
function readWeekdays(value: unknown): { bits: number; bad: string[] } {
  const list: unknown[] = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/).filter((w) => w !== '') : [value];
  let bits = 0;
  const bad: string[] = [];
  for (const one of list) {
    if (typeof one === 'number' && Number.isInteger(one) && one >= 1 && one <= 7) { bits |= 1 << (one - 1); continue; }
    const day = typeof one === 'string' ? WEEKDAY_READ.get(fold(one.trim()).replace(/\.$/, '')) : undefined;
    if (day === undefined) bad.push(typeof one === 'string' ? one : JSON.stringify(one) ?? String(one));
    else bits |= 1 << day;
  }
  return { bits, bad };
}

/** Wann erinnert wird: eine Liste von Wörtern (`null`, `[]` — nie). */
function readRemind(value: unknown): { bits: number; bad: string[]; ok: boolean } {
  if (value === null) return { bits: 0, bad: [], ok: true };
  const list: unknown[] | null = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null;
  if (list === null) return { bits: 0, bad: [JSON.stringify(value) ?? String(value)], ok: false };
  let bits = 0;
  const bad: string[] = [];
  for (const one of list) {
    const kind = typeof one === 'string' ? REMIND_READ.get(fold(one.trim())) : undefined;
    if (kind === undefined) bad.push(typeof one === 'string' ? one : JSON.stringify(one) ?? String(one));
    else bits |= REMIND_BITS[kind];
  }
  return { bits, bad, ok: true };
}

/* -- Eine Aufgabe, wie sie ist ---------------------------------------------------------------------- */

/** Was zu einer Art gehört — wie `saveTask` es schickt und der Dienst es liest. */
function normalized(spec: TaskSpec): TaskSpec {
  const window = spec.kind === 'window';
  return {
    ...spec,
    windowMinutes: spec.kind === 'after' ? 0 : spec.windowMinutes,
    everyMinutes: window ? null : spec.everyMinutes,
    repeat: window ? spec.repeat : 'none',
    weekdays: window && spec.repeat === 'weekly' ? (spec.weekdays & 127) || bitOfDay(spec.date) : 0,
    remind: spec.remind & (spec.kind === 'after' ? REMIND_BITS.start : 7)
  };
}

/** Eine gespeicherte Aufgabe als `TaskSpec` — in Ortszeit, „Tylko ja" als `null`. */
function specOf(task: TaskSource, groups: readonly TaskGroup[]): TaskSpec {
  const start = new Date(task.startsAt);
  const personal = groups.some((g) => g.personal === true && g.areaId === task.areaId);
  return normalized({
    title: task.title,
    notes: task.notes ?? '',
    kind: task.kind,
    areaId: personal ? null : task.areaId,
    date: dayOf(start),
    time: clockOf(start),
    windowMinutes: task.windowMinutes,
    everyMinutes: task.everyMinutes,
    repeat: task.repeatKind,
    weekdays: task.repeatWeekdays ?? 0,
    remind: task.remind ?? 0
  });
}

/** Das Ende des ersten Fensters, wie der Export es schreibt: „21:15" am selben Tag, sonst mit Tag. */
function endOut(spec: Pick<TaskSpec, 'date' | 'time' | 'windowMinutes'>): string {
  const end = new Date(localAt(spec.date, spec.time).getTime() + spec.windowMinutes * 60_000);
  return dayOf(end) === spec.date ? clockOf(end) : `${dayOf(end)}T${clockOf(end)}`;
}

const repeatWords = (spec: TaskSpec): string =>
  spec.repeat === 'weekly' ? t('calendarDataTasks.weeklyOn', { days: weekdayList(spec.weekdays).join(', ') }) : REPEAT_WORD[spec.repeat];

/** Wann, in Worten — für die Vorschau. */
function whenWords(spec: TaskSpec): string {
  const from = `${spec.date} ${spec.time}`;
  if (spec.kind === 'window') return `${from}${spec.windowMinutes > 0 ? `–${endOut(spec).replace('T', ' ')}` : ''}, ${repeatWords(spec)}`;
  if (spec.kind === 'period') return t('calendarDataTasks.when.period', { from, span: spanWords(spec.windowMinutes), every: everyWords(spec.everyMinutes ?? 0) });
  return t('calendarDataTasks.when.after', { every: everyWords(spec.everyMinutes ?? 0), from });
}

/** Was sich zwischen zwei Fassungen ändert — in Worten; leer: nichts. */
function differences(was: TaskSpec, next: TaskSpec, whoName: (areaId: string | null) => string): string[] {
  const out: string[] = [];
  if (was.title !== next.title) out.push(t('calendarDataTasks.diff.title', { was: quote(was.title), next: quote(next.title) }));
  if (was.kind !== next.kind) {
    out.push(t('calendarDataTasks.diff.kind', { was: KIND_WORD[was.kind], next: KIND_WORD[next.kind], when: whenWords(next) }));
  } else {
    if (was.date !== next.date || was.time !== next.time) out.push(t('calendarDataTasks.diff.start', { was: `${was.date} ${was.time}`, next: `${next.date} ${next.time}` }));
    if (next.kind === 'window') {
      /* Dasselbe Ende nach einem verschobenen Anfang ist ein anderes Fenster — gesagt wird, wie lang es nun ist. */
      if (endOut(was) !== endOut(next)) out.push(t('calendarDataTasks.diff.end', { was: endOut(was).replace('T', ' '), next: endOut(next).replace('T', ' ') }));
      else if (was.windowMinutes !== next.windowMinutes) out.push(t('calendarDataTasks.diff.window', { was: spanWords(was.windowMinutes), next: spanWords(next.windowMinutes) }));
      if (was.repeat !== next.repeat || was.weekdays !== next.weekdays) out.push(t('calendarDataTasks.diff.repeat', { was: repeatWords(was), next: repeatWords(next) }));
    } else {
      if (next.kind === 'period' && was.windowMinutes !== next.windowMinutes) out.push(t('calendarDataTasks.diff.lasts', { was: spanWords(was.windowMinutes), next: spanWords(next.windowMinutes) }));
      if (was.everyMinutes !== next.everyMinutes) out.push(t('calendarDataTasks.diff.every', { was: everyWords(was.everyMinutes ?? 0), next: everyWords(next.everyMinutes ?? 0) }));
    }
  }
  if (was.remind !== next.remind) out.push(t('calendarDataTasks.diff.remind', { was: remindText(was.remind), next: remindText(next.remind) }));
  if (was.areaId !== next.areaId) out.push(t('calendarDataTasks.diff.who', { was: whoName(was.areaId), next: whoName(next.areaId) }));
  if (was.notes !== next.notes) out.push(t(was.notes === '' ? 'calendarDataTasks.diff.notesNew' : next.notes === '' ? 'calendarDataTasks.diff.notesGone' : 'calendarDataTasks.diff.notes'));
  return out;
}

/* -- Gruppen -------------------------------------------------------------------------------------- */

/** Klein, ohne Zeichen, der Weg mit „›" — „Parafia > Schola" ist „parafia › schola". */
const plain = (text: string): string => fold(text).replace(/\s*(?:›|»|>|\/)\s*/g, ' › ').replace(/\s+/g, ' ').trim();
const lastPart = (name: string): string => name.split('›').pop()?.trim() ?? name;

/** Eine Gruppe nach Kennung oder Namen — der ganze Weg vor dem eigenen Namen, Gruppen vor Rozmowy. */
function groupBy(text: string, groups: readonly TaskGroup[]): { group: TaskGroup } | { error: string } {
  if (UUID.test(text)) {
    const found = groups.find((g) => g.areaId.toLowerCase() === text.toLowerCase());
    return found === undefined ? { error: t('calendarDataTasks.group.noId', { id: quote(text) }) } : { group: found };
  }
  const want = plain(text);
  const named = groups.filter((g) => g.personal !== true);
  for (const pool of [named.filter((g) => g.chat !== true), named.filter((g) => g.chat === true)]) {
    const full = pool.filter((g) => plain(g.name) === want);
    if (full.length === 1) return { group: full[0] };
    const own = full.length > 1 ? full : pool.filter((g) => plain(lastPart(g.name)) === want);
    if (own.length === 1) return { group: own[0] };
    if (own.length > 1) {
      return { error: t('calendarDataTasks.group.ambiguous', { text: quote(text), groups: own.slice(0, 4).map((g) => quote(g.name)).join(', ') }) };
    }
  }
  return { error: t('calendarDataTasks.group.none', { text: quote(text) }) };
}

/** Die Gruppen des Dokuments: Schlüssel → Gruppe (`null`: nicht gefunden — Aufgaben mit ihr fallen weg). */
function readGroups(value: unknown, groups: readonly TaskGroup[], warnings: string[]): Map<string, TaskGroup | null> {
  const refs = new Map<string, TaskGroup | null>();
  if (value === undefined || value === null) return refs;
  if (!Array.isArray(value)) { warnings.push(t('calendarDataTasks.group.notList')); return refs; }
  value.forEach((raw, index) => {
    if (!isObject(raw)) { warnings.push(t('calendarDataTasks.group.notObject', { n: index + 1 })); return; }
    const key = typeof raw.key === 'string' ? raw.key.trim().replace(/^@/, '') : '';
    if (!KEY.test(key)) { warnings.push(t('calendarDataTasks.group.keyBad', { n: index + 1 })); return; }
    if (refs.has(key.toLowerCase())) { warnings.push(t('calendarDataTasks.group.twice', { key })); return; }
    const odd = unknownKeys(raw, TASK_GROUP_KEYS);
    if (odd !== null) warnings.push(t('calendarDataTasks.group.odd', { key, odd }));

    /* Erst die Kennung (aus dem Export), dann der Name. */
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const byId = UUID.test(id) ? groups.find((g) => g.areaId.toLowerCase() === id.toLowerCase()) : undefined;
    if (byId !== undefined) { refs.set(key.toLowerCase(), byId); return; }
    const byName = name === '' ? null : groupBy(name, groups);
    if (byName !== null && 'group' in byName) {
      /* Eine fremde Kennung (der Export eines anderen) — gemeint ist die Gruppe gleichen Namens; gesagt wird es trotzdem. */
      if (id !== '') warnings.push(t('calendarDataTasks.group.byName', { key, id: quote(id), name: quote(byName.group.name) }));
      refs.set(key.toLowerCase(), byName.group);
      return;
    }
    const why = byName !== null && 'error' in byName ? byName.error
      : id !== '' ? t('calendarDataTasks.group.noId', { id: quote(id) })
      : t('calendarDataTasks.group.noIdName');
    warnings.push(t('calendarDataTasks.group.unknown', { key, why }));
    refs.set(key.toLowerCase(), null);
  });
  return refs;
}

/** Wer eine Aufgabe sieht: „me" (`null`), „@klucz", eine Kennung oder ein Name. */
function whoOf(value: unknown, refs: ReadonlyMap<string, TaskGroup | null>, groups: readonly TaskGroup[]): { areaId: string | null } | { error: string } {
  if (typeof value !== 'string' || value.trim() === '') return { error: t('calendarDataTasks.who.bad') };
  const text = value.trim();
  if (['me', 'ja', 'tylko ja'].includes(fold(text))) return { areaId: null };
  if (text.startsWith('@')) {
    const key = text.slice(1).toLowerCase();
    if (!refs.has(key)) return { error: t('calendarDataTasks.who.noKey', { text: quote(text) }) };
    const group = refs.get(key) ?? null;
    if (group === null) return { error: t('calendarDataTasks.who.unknown', { text: quote(text) }) };
    return { areaId: group.personal === true ? null : group.areaId };
  }
  const found = groupBy(text, groups);
  if ('error' in found) return { error: t('calendarDataTasks.who.error', { error: found.error }) };
  return { areaId: found.group.personal === true ? null : found.group.areaId };
}

/** Kurze, eindeutige Schlüssel der Gruppen im Export: „schola", „schola-2". */
function groupKeys(list: readonly TaskGroup[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const g of list) {
    const base = fold(lastPart(g.name)).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || 'grupa';
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    taken.add(key);
    out.set(g.areaId, key);
  }
  return out;
}

/* -- Export --------------------------------------------------------------------------------------- */

/**
 * DIE AUFGABEN ALS DOKUMENT — jede mit allen Schlüsseln ihrer Art (auch leer:
 * "notes": "", "remind": []), damit, wer es bearbeitet, Werte ändert, statt
 * Schlüssel zu löschen; ein fehlender Schlüssel hiesse beim Import „wie es war".
 */
export function exportTasks(tasks: readonly TaskSource[], groups: readonly TaskGroup[]): Json {
  const known = new Map(groups.map((g) => [g.areaId, g]));
  const listed = new Map<string, TaskGroup>();
  for (const g of groups) if (g.personal !== true && g.write && g.chat !== true) listed.set(g.areaId, g);
  for (const t of tasks) {
    const g = known.get(t.areaId);
    if (g?.personal === true || listed.has(t.areaId)) continue;
    listed.set(t.areaId, g ?? { areaId: t.areaId, name: otherGroup(), write: false });
  }
  const keys = groupKeys([...listed.values()]);

  return {
    format: TASKS_FORMAT,
    version: TASKS_VERSION,
    groups: [...listed.values()].map((g) => ({ key: keys.get(g.areaId)!, id: g.areaId, name: g.name, ...(g.write ? {} : { readOnly: true }) })),
    tasks: tasks.map((t) => {
      const spec = specOf(t, groups);
      const out: Json = { id: t.taskId };
      if (t.locked === true) out.locked = true;
      else out.title = spec.title;
      out.kind = spec.kind;
      out.who = spec.areaId === null ? 'me' : `@${keys.get(spec.areaId)}`;
      out.start = `${spec.date}T${spec.time}`;
      if (spec.kind === 'window') {
        out.end = endOut(spec);
        out.repeat = spec.repeat;
        if (spec.repeat === 'weekly') out.weekdays = weekdayList(spec.weekdays);
      } else {
        if (spec.kind === 'period') out.lasts = spanOut(spec.windowMinutes);
        out.every = spanOut(spec.everyMinutes ?? (spec.kind === 'period' ? TASK_DEFAULTS.periodEvery : TASK_DEFAULTS.afterEvery));
      }
      out.remind = remindList(spec.remind);
      if (t.locked !== true) out.notes = spec.notes;
      return out;
    })
  };
}

/* -- Import: der Plan ------------------------------------------------------------------------------ */

/**
 * WAS EIN DOKUMENT ÄNDERN WÜRDE — jede neue, geänderte und entfernte Aufgabe
 * mit ihrem Satz, und was übergangen wird, als Warnung. Nichts wird gespeichert.
 */
export function planTasksImport(doc: unknown, base: TasksBase): TasksPlan | { error: string } {
  const root = isObject(doc) ? doc : null;
  if (root === null && !Array.isArray(doc)) return { error: t('calendarDataTasks.plan.notDoc', { format: TASKS_FORMAT }) };
  if (root !== null && root.format !== undefined && root.format !== TASKS_FORMAT) {
    return { error: t('calendarDataTasks.plan.otherFormat', { given: shown(root.format), format: TASKS_FORMAT }) };
  }
  const list: unknown = root === null ? doc : root.tasks;
  if (!Array.isArray(list)) return { error: t('calendarDataTasks.plan.noTasks') };

  const warnings: string[] = [];
  if (root !== null) {
    if (root.version !== undefined && root.version !== TASKS_VERSION) warnings.push(t('calendarDataTasks.plan.version', { given: shown(root.version), version: TASKS_VERSION }));
    const odd = unknownKeys(root, TASKS_DOC_KEYS);
    if (odd !== null) warnings.push(t('calendarDataTasks.plan.docOdd', { odd }));
  }
  if (list.length > MAX_TASKS) warnings.push(t('calendarDataTasks.plan.tooMany', { max: MAX_TASKS, rest: list.length - MAX_TASKS }));

  /* Die Gruppen: meine — und die der Aufgaben, die ich sehe, aber nicht kenne (nur zum Lesen). */
  const known: TaskGroup[] = [...base.groups];
  for (const t of base.tasks) if (!known.some((g) => g.areaId === t.areaId)) known.push({ areaId: t.areaId, name: otherGroup(), write: false });
  const refs = readGroups(root?.groups, known, warnings);

  const byId = new Map(base.tasks.map((t) => [t.taskId.toLowerCase(), t]));
  const specs = new Map(base.tasks.map((t) => [t.taskId, specOf(t, known)]));
  const groupOf = (areaId: string | null): TaskGroup | null => (areaId === null ? null : known.find((g) => g.areaId === areaId) ?? null);
  const mayWrite = (areaId: string | null): boolean => areaId === null || groupOf(areaId)?.write === true;
  const whoName = (areaId: string | null): string => (areaId === null ? onlyMe() : groupOf(areaId)?.name ?? otherGroup());

  const seen = new Set<string>();
  const changes: PlannedTask[] = [];
  let unchanged = 0;

  list.slice(0, MAX_TASKS).forEach((raw, index) => {
    if (!isObject(raw)) { warnings.push(t('calendarDataTasks.plan.notObject', { n: index + 1 })); return; }

    /* Wer: eine bekannte Aufgabe (Kennung) — oder eine neue. */
    let existing: TaskSource | undefined;
    let idNote: string | null = null;
    if (raw.id !== undefined && raw.id !== null) {
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      existing = id === '' ? undefined : byId.get(id.toLowerCase());
      if (existing === undefined) idNote = UUID.test(id) ? t('calendarDataTasks.plan.idUnknown') : t('calendarDataTasks.plan.idBad', { id: shown(raw.id) });
    }
    const was = existing === undefined ? null : specs.get(existing.taskId) ?? null;
    const given = typeof raw.title === 'string' ? raw.title.trim() : '';
    const named = given !== '' ? t('calendarDataTasks.plan.named', { title: quote(given) })
      : existing !== undefined && existing.locked !== true ? t('calendarDataTasks.plan.named', { title: quote(existing.title) })
      : t('calendarDataTasks.plan.numbered', { n: index + 1 });
    const say = (text: string) => { warnings.push(`${named}: ${text}`); };

    const odd = unknownKeys(raw, TASK_KEYS);
    if (odd !== null) say(`${odd}.`);

    if (existing !== undefined) {
      if (seen.has(existing.taskId)) { say(t('calendarDataTasks.plan.idTwice')); return; }
      seen.add(existing.taskId);
    }

    /* Fort — nur, was es gibt, und nur, wo ich schreibe. Ein unklares "remove" tut gar nichts. */
    if (raw.remove !== undefined && raw.remove !== false) {
      if (raw.remove !== true) { say(t('calendarDataTasks.plan.removeBad')); return; }
      if (existing === undefined || was === null) { say(idNote === null ? t('calendarDataTasks.plan.removeNone') : t('calendarDataTasks.plan.removeNoneWhy', { why: idNote })); return; }
      if (!mayWrite(was.areaId)) { say(t('calendarDataTasks.plan.readOnlyRemove', { group: quote(whoName(was.areaId)) })); return; }
      changes.push({ action: 'remove', taskId: existing.taskId, title: existing.locked === true ? t('calendarDataTasks.plan.lockedTitle') : existing.title, spec: null, what: [] });
      return;
    }
    if (idNote !== null) say(t('calendarDataTasks.plan.asNew', { why: idNote }));

    const fresh = was === null;
    const kept = fresh ? t('calendarDataTasks.plan.keptNew') : t('calendarDataTasks.plan.keptOld');

    /*
       Die Art — fehlt sie bei einer neuen, sagen es die übrigen Schlüssel. Wer
       "end" oder "repeat" schreibt, meint ein Fenster, auch mit einem "every"
       daneben (das es dort nicht gibt — gesagt wird es unten).
    */
    const windowish = raw.end !== undefined || raw.repeat !== undefined || raw.weekdays !== undefined;
    let kind: TaskKind = was?.kind ?? (raw.lasts !== undefined ? 'period' : raw.every !== undefined && !windowish ? 'after' : 'window');
    if (raw.kind !== undefined) {
      const wanted = typeof raw.kind === 'string' ? raw.kind.trim() : '';
      if ((TASK_KINDS as readonly string[]).includes(wanted)) kind = wanted as TaskKind;
      else say(t(fresh ? 'calendarDataTasks.plan.kindBadNew' : 'calendarDataTasks.plan.kindBadOld', { given: shown(raw.kind), kinds: TASK_KINDS.map((k) => `"${k}"`).join(', '), kind }));
    }

    let title = was?.title ?? '';
    if (raw.title !== undefined) {
      if (given === '') say(t(fresh ? 'calendarDataTasks.plan.titleEmptyNew' : 'calendarDataTasks.plan.titleEmptyOld'));
      else if (given.length > MAX_TITLE) { title = given.slice(0, MAX_TITLE).trimEnd(); say(t('calendarDataTasks.plan.titleLong', { max: MAX_TITLE })); }
      else title = given;
    }

    let notes = was?.notes ?? '';
    if (raw.notes !== undefined) {
      if (raw.notes === null) notes = '';
      else if (typeof raw.notes !== 'string') say(t(fresh ? 'calendarDataTasks.plan.notesBadNew' : 'calendarDataTasks.plan.notesBadOld'));
      else if (raw.notes.trim().length > MAX_NOTES) { notes = raw.notes.trim().slice(0, MAX_NOTES); say(t('calendarDataTasks.plan.notesLong', { max: MAX_NOTES })); }
      else notes = raw.notes.trim();
    }

    let areaId: string | null = was?.areaId ?? null;
    if (raw.who !== undefined) {
      const found = whoOf(raw.who, refs, known);
      if ('error' in found) { say(t('calendarDataTasks.plan.whoSkipped', { error: found.error })); return; }
      areaId = found.areaId;
    }

    let date = was?.date ?? null;
    let time = was?.time ?? null;
    if (raw.start !== undefined) {
      const moment = readMoment(raw.start);
      if (moment === null) {
        say(t(fresh ? 'calendarDataTasks.plan.startBadNew' : 'calendarDataTasks.plan.startBadOld', { given: shown(raw.start) }));
        if (fresh) return;
      } else {
        date = moment.date;
        time = moment.time ?? '00:00';
      }
    }
    if (title === '' || date === null || time === null) {
      say(t(title === '' && date === null ? 'calendarDataTasks.plan.needsBoth' : title === '' ? 'calendarDataTasks.plan.needsTitle' : 'calendarDataTasks.plan.needsStart'));
      return;
    }

    /*
       Was zur Art gehört: bei gleicher Art, wie es war; bei neuer Art, was das
       Fenster einer Aufgabe dafür vorschlägt (ein Abstand bleibt zwischen
       „period" und „after", ein Zeitraum wird zum Fenster).
    */
    const same = was !== null && was.kind === kind;
    let windowMinutes = same ? was.windowMinutes
      : kind === 'window' ? (was !== null && was.kind === 'period' ? was.windowMinutes : TASK_DEFAULTS.windowMinutes)
      : kind === 'period' ? TASK_DEFAULTS.lasts : 0;
    let everyMinutes: number | null = kind === 'window' ? null : was?.everyMinutes ?? null;
    let repeat: RepeatKind = same ? was.repeat : 'none';
    let weekdays = same ? was.weekdays : 0;
    let remind = was?.remind ?? 0;

    const only = (key: string, kinds: readonly TaskKind[]): boolean => {
      if (raw[key] === undefined) return false;
      if (kinds.includes(kind)) return true;
      say(t('calendarDataTasks.plan.onlyKinds', { key, kinds: kinds.map((k) => `"${k}"`).join(t('calendarDataTasks.plan.and')) }));
      return false;
    };

    if (only('end', ['window'])) {
      const read = readEnd(raw.end, date, time);
      if (typeof read === 'string') say(t(fresh ? 'calendarDataTasks.plan.endBadNew' : 'calendarDataTasks.plan.endBadOld', { given: shown(raw.end), why: read, minutes: windowMinutes }));
      else windowMinutes = read;
    }
    if (only('repeat', ['window'])) {
      const wanted = typeof raw.repeat === 'string' ? raw.repeat.trim() : '';
      if ((REPEATS as readonly string[]).includes(wanted)) repeat = wanted as RepeatKind;
      else say(t(fresh ? 'calendarDataTasks.plan.repeatBadNew' : 'calendarDataTasks.plan.repeatBadOld', { given: shown(raw.repeat), repeats: REPEATS.map((r) => `"${r}"`).join(', ') }));
    }
    if (only('weekdays', ['window'])) {
      if (repeat !== 'weekly') say(t('calendarDataTasks.plan.weekdaysNotWeekly'));
      else {
        const read = readWeekdays(raw.weekdays);
        if (read.bad.length > 0) say(t('calendarDataTasks.plan.weekdaysBad', { bad: read.bad.map(quote).join(', '), days: WEEKDAY_WORDS.join(', ') }));
        if (read.bits !== 0) weekdays = read.bits;
      }
    }
    if (only('lasts', ['period'])) {
      const read = readSpan(raw.lasts);
      if (typeof read === 'string') say(fresh ? t('calendarDataTasks.plan.lastsBadNew', { why: read, span: spanWords(windowMinutes) }) : t('calendarDataTasks.plan.lastsBadOld', { why: read }));
      else windowMinutes = read;
    }
    if (only('every', ['period', 'after'])) {
      const read = readSpan(raw.every);
      if (typeof read === 'string') say(t(fresh ? 'calendarDataTasks.plan.everyBadNew' : 'calendarDataTasks.plan.everyBadOld', { why: read }));
      else everyMinutes = read;
    }
    if (kind === 'period' && everyMinutes === null) everyMinutes = Math.max(TASK_DEFAULTS.periodEvery, windowMinutes);
    if (kind === 'after' && everyMinutes === null) everyMinutes = TASK_DEFAULTS.afterEvery;

    if (raw.remind !== undefined) {
      const read = readRemind(raw.remind);
      if (!read.ok) say(t('calendarDataTasks.plan.remindBad', { kept }));
      else {
        if (read.bad.length > 0) say(t('calendarDataTasks.plan.remindUnknown', { bad: read.bad.map(quote).join(', '), kinds: REMIND_KINDS.map((r) => `"${r}"`).join(', ') }));
        remind = read.bits;
        if (kind === 'after' && (remind & ~REMIND_BITS.start) !== 0) say(t('calendarDataTasks.plan.remindAfter'));
      }
    }

    if (kind === 'period' && (everyMinutes ?? 0) < windowMinutes) {
      say(t('calendarDataTasks.plan.everyShort', { every: everyWords(everyMinutes ?? 0), span: spanWords(windowMinutes) }));
      return;
    }

    const spec = normalized({ title, notes, kind, areaId, date, time, windowMinutes, everyMinutes, repeat, weekdays, remind });

    /* Was gespeichert würde, aber nicht darf — oder nichts ändert. */
    let what: string[] = [];
    if (was !== null && existing !== undefined) {
      what = differences(was, spec, whoName);
      if (what.length === 0) { unchanged += 1; return; }
      if (existing.locked === true) { say(t('calendarDataTasks.plan.locked')); return; }
      if (!mayWrite(was.areaId)) { say(t('calendarDataTasks.plan.readOnlyChange', { group: quote(whoName(was.areaId)) })); return; }
    }
    if (!mayWrite(spec.areaId)) { say(t('calendarDataTasks.plan.readOnly', { group: quote(whoName(spec.areaId)) })); return; }

    /* 0088 — was vor heute beginnt, steht mit jedem versäumten Vorkommen als „przegapione" da. */
    if (spec.kind !== 'after' && (was === null || was.date !== spec.date || was.time !== spec.time)) {
      const firstEnd = localAt(spec.date, spec.time).getTime() + spec.windowMinutes * 60_000;
      if (firstEnd < base.now.getTime()) {
        say(spec.kind === 'window' && spec.repeat === 'none'
          ? t('calendarDataTasks.plan.past', { at: `${spec.date} ${spec.time}` })
          : t('calendarDataTasks.plan.pastSeries', { at: `${spec.date} ${spec.time}` }));
      }
    }

    if (was === null || existing === undefined) {
      const twin = base.tasks.find((t) => t.locked !== true && fold(t.title) === fold(spec.title)
        && specs.get(t.taskId)?.date === spec.date && specs.get(t.taskId)?.time === spec.time);
      if (twin !== undefined) say(t('calendarDataTasks.plan.twin'));
      changes.push({ action: 'new', taskId: null, title: spec.title, spec, what: [] });
      return;
    }
    changes.push({ action: 'change', taskId: existing.taskId, title: spec.title, spec, what });
  });

  const created = changes.filter((c) => c.action === 'new').length;
  const updated = changes.filter((c) => c.action === 'change').length;
  const removed = changes.filter((c) => c.action === 'remove').length;
  const lines = [
    t('calendarDataTasks.plan.total', { created, updated, removed, unchanged }),
    ...changes.map((c) => (c.action === 'new' && c.spec !== null
      ? (c.spec.remind === 0
        ? t('calendarDataTasks.plan.lineNew', { title: quote(c.title), when: whenWords(c.spec), who: whoName(c.spec.areaId) })
        : t('calendarDataTasks.plan.lineNewRemind', { title: quote(c.title), when: whenWords(c.spec), who: whoName(c.spec.areaId), remind: remindText(c.spec.remind) }))
      : c.action === 'change' ? t('calendarDataTasks.plan.lineChange', { title: quote(c.title), what: c.what.join('; ') })
      : t('calendarDataTasks.plan.lineRemove', { title: quote(c.title) }))),
    ...(changes.length === 0 ? [t('calendarDataTasks.plan.nothing')] : [])
  ];
  return { changes, created, updated, removed, unchanged, lines, warnings };
}

/** Was `saveTask` aus einer geplanten Aufgabe bekommt — wie aus dem Fenster: einmal je Schritt, ohne Ende, ohne Rozmowa (beim Ändern bleibt sie). */
export function draftOf(spec: TaskSpec, areaId: string, ownerRoleId: string): TaskDraft {
  return {
    title: spec.title,
    notes: spec.notes,
    areaId,
    ownerRoleId,
    kind: spec.kind,
    date: spec.date,
    time: spec.time,
    windowMinutes: spec.windowMinutes,
    everyMinutes: spec.everyMinutes,
    repeat: spec.repeat,
    every: 1,
    weekdays: spec.weekdays,
    until: null,
    remind: spec.remind,
    origin: null
  };
}

/* -- Beispiele ------------------------------------------------------------------------------------ */

/** Das Beispiel der Beschreibung — mit festen Tagen, damit die Beschreibung (und `ImportFormats.json`) jeden Tag dieselbe ist. */
export function tasksExample(): Json {
  return {
    format: TASKS_FORMAT,
    version: TASKS_VERSION,
    groups: [{ key: 'schola', id: '0190a0a0-0000-7000-8000-00000000000a', name: t('calendarDataTasks.sample.parishSchola') }],
    tasks: [
      {
        id: '0190a0a0-0000-7000-8000-000000000001', title: t('calendarDataTasks.sample.apel'), kind: 'window', who: 'me',
        start: '2026-11-02T21:00', end: '21:15', repeat: 'daily', remind: ['start'], notes: ''
      },
      {
        title: t('calendarDataTasks.sample.cleanHall'), kind: 'period', who: '@schola', start: '2026-11-06T09:00',
        lasts: { days: 3 }, every: { weeks: 2 }, remind: ['start', 'end'], notes: t('calendarDataTasks.sample.keys')
      },
      {
        title: t('calendarDataTasks.sample.music'), kind: 'window', who: '@schola', start: '2026-11-05T19:00', end: '2026-11-07T20:00',
        repeat: 'weekly', weekdays: ['cz'], remind: ['end']
      },
      { title: t('calendarDataTasks.sample.flowers'), kind: 'after', who: 'me', start: '2026-11-02T18:00', every: { days: 3 }, remind: ['start'] },
      { id: '0190a0a0-0000-7000-8000-000000000002', remove: true }
    ]
  };
}

/** Der nächste Tag dieses Wochentags ab morgen (0 = pn … 6 = nd) — ein eingesetztes Beispiel beginnt nie in der Vergangenheit. */
function nextWeekday(now: Date, weekday: number): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  while ((at.getDay() + 6) % 7 !== weekday) at.setDate(at.getDate() + 1);
  return at;
}

const plusDays = (at: Date, days: number): Date => new Date(at.getFullYear(), at.getMonth(), at.getDate() + days);

/** Eigene Aufgaben: ein Gebet jeden Abend, Blumen alle drei Tage, freitags ein Rachunek sumienia. */
export function ownTasksSample(now: Date = new Date()): Json {
  const tomorrow = dayOf(plusDays(now, 1));
  return {
    format: TASKS_FORMAT,
    version: TASKS_VERSION,
    tasks: [
      { title: t('calendarDataTasks.sample.prayer'), kind: 'window', who: 'me', start: `${tomorrow}T21:00`, end: '21:15', repeat: 'daily', remind: ['start'] },
      { title: t('calendarDataTasks.sample.flowers'), kind: 'after', who: 'me', start: `${tomorrow}T18:00`, every: { days: 3 }, remind: ['start'] },
      {
        title: t('calendarDataTasks.sample.examen'), kind: 'window', who: 'me', start: `${dayOf(nextWeekday(now, 4))}T20:00`, end: '20:30',
        repeat: 'weekly', weekdays: ['pt'], notes: t('calendarDataTasks.sample.silence')
      }
    ]
  };
}

/** Aufgaben einer Gruppe: aufräumen alle zwei Wochen (drei Tage Zeit), Noten von Donnerstag bis Samstag. */
export function groupTasksSample(now: Date = new Date()): Json {
  const thursday = nextWeekday(now, 3);
  return {
    format: TASKS_FORMAT,
    version: TASKS_VERSION,
    groups: [{ key: 'schola', name: t('calendarDataTasks.sample.schola') }],
    tasks: [
      {
        title: t('calendarDataTasks.sample.cleanHall'), kind: 'period', who: '@schola', start: `${dayOf(nextWeekday(now, 0))}T09:00`,
        lasts: { days: 3 }, every: { weeks: 2 }, remind: ['start', 'end'], notes: t('calendarDataTasks.sample.keys')
      },
      {
        title: t('calendarDataTasks.sample.music'), kind: 'window', who: '@schola', start: `${dayOf(thursday)}T19:00`,
        end: `${dayOf(plusDays(thursday, 2))}T20:00`, repeat: 'weekly', weekdays: ['cz'], remind: ['end']
      }
    ]
  };
}

/* -- Die Beschreibung als Baum (`core/jsonTree.ts`) ------------------------------------------------- */

const INTRO = (): string => `${t('calendarDataTasks.node.intro')}
${keyLines(TASKS_DOC_KEYS)}`;

const KINDS_TEXT = (): string => t('calendarDataTasks.node.kinds', {
  window: KIND_WORD.window, period: KIND_WORD.period, after: KIND_WORD.after,
  units: Object.entries(TASK_SPAN_KEYS).map(([unit, word]) => `"${unit}" (${word})`).join(', '),
  minutes: TASK_DEFAULTS.windowMinutes
});

const GROUPS_TEXT = (): string => `${t('calendarDataTasks.node.groupsLead')}
${keyLines(TASK_GROUP_KEYS)}
${t('calendarDataTasks.node.groupsTail')}`;

export const TASK_JSON: JsonNode = {
  key: 'tasks.task',
  get title() { return t('calendarDataTasks.node.task.title'); },
  get short() { return t('calendarDataTasks.node.task.short'); },
  text: () => `${t('calendarDataTasks.node.task.lead')}
${keyLines(TASK_KEYS)}`
};

export const TASK_KINDS_JSON: JsonNode = {
  key: 'tasks.kinds',
  get title() { return t('calendarDataTasks.node.kindsNode.title'); },
  get short() { return t('calendarDataTasks.node.kindsNode.short'); },
  text: KINDS_TEXT
};

export const TASK_GROUPS_JSON: JsonNode = {
  key: 'tasks.groups',
  get title() { return t('calendarDataTasks.node.groupsNode.title'); },
  get short() { return t('calendarDataTasks.node.groupsNode.short'); },
  text: GROUPS_TEXT
};

/*
 * 2026-10-30 — WAS DIE APP MIT DEN AUFGABEN TUT: Zadania und das Raster des Kalenders (`TasksView.tsx`,
 * `CalendarApp.tsx` — nicht im Baustein einer Seite), Teraz und „Czeka na Ciebie" (`ViewParts.tsx`, `alerts.ts`);
 * wer sieht (`Agenda.HeldAreasAsync`), wer abhakt (`Tasks.Done.cs`: wer schreibt; ein Häkchen je Vorkommen,
 * `pk_task_done`); Erinnerungen plant das Gerät (`notifyRich.remindersFor`, `platform.ts`, `Reminders.java`), der
 * Dienst schickt keine (`Push.cs`); Aufgaben aus Rozmowy (`TopicBar.tsx`) und die anderen der Schritte (`Form.Tasks.cs`).
 */
export const TASKS_USAGE_JSON: JsonNode = {
  key: 'tasks.usage',
  get title() { return t('calendarDataTasks.node.usage.title'); },
  text: () => t('calendarDataTasks.node.usage.text')
};

export const TASKS_EXAMPLE_JSON: JsonNode = {
  key: 'tasks.example',
  get title() { return t('calendarDataTasks.node.example.title'); },
  text: () => `${t('calendarDataTasks.node.example.lead')}
${pretty(tasksExample())}`
};

/** 2026-10-29 — DIE ZADANIA ALS JSON: der Baum, aus dem die Beschreibung entsteht (neben dem Import und für den MCP-Server). */
export const TASKS_JSON: JsonNode = {
  key: 'tasks',
  get title() { return t('calendarDataTasks.node.root.title', { format: TASKS_FORMAT, version: TASKS_VERSION }); },
  get short() { return t('calendarDataTasks.node.root.short'); },
  text: INTRO,
  inside: () => [TASKS_USAGE_JSON, TASK_JSON, TASK_KINDS_JSON, TASK_GROUPS_JSON, TASKS_EXAMPLE_JSON],
  samples: (): readonly JsonSample[] => [
    { label: t('calendarDataTasks.node.root.sampleOwn'), doc: () => ownTasksSample() },
    { label: t('calendarDataTasks.node.root.sampleGroup'), doc: () => groupTasksSample() }
  ]
};

/** Die ganze Beschreibung als Text — ohne App, für den MCP-Server und zum Kopieren. */
export const tasksDescription = (): string => describe(TASKS_JSON);
