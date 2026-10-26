/**
 * 0134 — SCHULE UND KLASSEN: ein Programm einmal für alle, verwirklicht in jeder Klasse.
 *
 * <code>
 *   Szkoła (Bereich, Art school)
 *     Skryptorium der Schule      versiegelt unter ihrem Schlüssel — die Lehrer lesen es
 *       Programm = Projekt         Titel, Gliederung (Überschriften, Lekcje = Texte mit Plan),
 *                                  die Klassen, die es verwirklichen (`classes`)
 *       Lekcja = Text              Titel, Plan (Punkte mit festen Kennungen), Treść, Materialien
 *       Realizacja = Wygłoszenie   Text, Tag, Klasse (`classArea`), Stand (geplant, gehalten,
 *                                  teilweise, nicht gehalten), was vom Plan, Notiz, Zadanie
 *     Klasa (Bereich darin, Art class)
 *       Stundenplan                wöchentliche Termine im Kalender der Klasse (Schlüssel `lekcja-…`)
 *       Uczniowie                  Formular (Schlüssel `uczniowie`), Obecność (`obecnosc`, täglich,
 *                                  nur das Amt), Uwagi (`uwagi`, nur das Amt)
 *       Rozmowa, Kanał, Rollen     wie bei einer Grupa
 * </code>
 *
 * <b>Individuell je Klasse</b>, ohne eigenes Gerüst: eine Klasse hält eine Lekcja an ihrem Tag,
 * lässt eine aus („nie odbyła się" — sie wird neu verteilt), nimmt eine Lekcja ausserhalb des
 * Programms dazu; die Notizen stehen an ihrer Realizacja.
 *
 * Das Rechnen hier ist rein (getestet in `scripts/app-duty-check.mjs`); was liest und schreibt, steht
 * am Ende.
 */

import { saveEvent } from '../calendar/agenda';
import { createCalendar, loadCalendars, loadItems, type CalendarRow, type Occurrence } from '../calendar/calendar';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { createLibrary, libraryKindOf, loadLibraries, type LibraryRow } from '../library/library';
import { ids, itemsOf, LESSON_STATES, outline, str, type EntryData, type LibEntry, type Lookup } from '../library/libraryKinds';
import { storeOf, type Entry, type LibraryStore } from '../library/libraryStore';
import { areaKeys, chatKeysOf, loadChats, sendMessage } from '../chat/chat';
import { loadMembers, type AreaRow } from './area';
import { loadImportKeys, saveImportKeys } from './profile';

/* == Rein: Programme ====================================================================== */

export type LessonState = (typeof LESSON_STATES)[number]['value'];

export const STATE_SIGN: Readonly<Record<LessonState, string>> = { planned: '·', done: '✓', partial: '◐', skipped: '✕' };
export const STATE_WORD: Readonly<Record<LessonState, string>> = Object.fromEntries(LESSON_STATES.map((s) => [s.value, s.label])) as Record<LessonState, string>;

/** Ein Projekt der Schule, das ein Programm ist. */
export const PROGRAM_TYPE = 'program';

/** Eine Lekcja eines Programms, in seiner Reihenfolge. */
export interface Lesson {
  readonly textId: string;
  readonly title: string;
  /** Die Überschrift darüber („Dział I") — `null`: keine. */
  readonly heading: string | null;
  /** 1, 2, 3 … über das ganze Programm. */
  readonly number: number;
}

/** Die Lekcje eines Programms: die Texte seiner Gliederung, mit der Überschrift darüber. Texte, die dieser Leser nicht öffnet, fallen weg. */
export function lessonsOf(program: LibEntry, look: Lookup): Lesson[] {
  const out: Lesson[] = [];
  let heading: string | null = null;
  for (const item of outline(program.data)) {
    if ('heading' in item) { heading = item.heading.trim() === '' ? null : item.heading.trim(); continue; }
    const text = look.get(item.text);
    if (text === undefined || text.kind !== 'text') continue;
    out.push({ textId: text.id, title: str(text.data, 'title').trim() || 'Bez tytułu', heading, number: out.length + 1 });
  }
  return out;
}

/** Die Klassen, die ein Programm verwirklichen. */
export function classesOf(program: LibEntry): string[] {
  const out: string[] = [];
  for (const item of itemsOf(program.data, 'classes')) {
    const area = typeof item.area === 'string' ? item.area.trim().toLowerCase() : '';
    if (area !== '' && !out.includes(area)) out.push(area);
  }
  return out;
}

/** Das Programm mit diesen Klassen — die anderen Felder bleiben. */
export const withClasses = (data: EntryData, classes: readonly string[]): EntryData =>
  ({ ...data, classes: [...new Set(classes.map((c) => c.toLowerCase()))].map((area) => ({ area })) });

/** Ist dieses Projekt ein Programm (eigens so markiert — oder es nennt Klassen)? */
export const isProgram = (entry: LibEntry): boolean =>
  entry.kind === 'project' && (str(entry.data, 'projectType') === PROGRAM_TYPE || classesOf(entry).length > 0);

/** Die Programme, die eine Klasse verwirklicht. */
export const programsOfClass = (programs: readonly LibEntry[], classAreaId: string): LibEntry[] =>
  programs.filter((p) => classesOf(p).includes(classAreaId.toLowerCase()));

/** Eine Liste von Lekcje, wie man sie tippt: eine je Zeile; „# Dział" oder „Dział:" ist eine Überschrift; „1.", „1)", „-" davor fallen weg. */
export function parseLessonList(raw: string): ({ heading: string } | { title: string })[] {
  const out: ({ heading: string } | { title: string })[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const said = line.trim();
    if (said === '') continue;
    if (said.startsWith('#')) { const h = said.replace(/^#+\s*/, '').trim(); if (h !== '') out.push({ heading: h }); continue; }
    if (said.endsWith(':') && said.length > 1) { out.push({ heading: said.slice(0, -1).trim() }); continue; }
    const title = said.replace(/^(?:\d+[.)]|[-–•*])\s*/, '').trim();
    if (title !== '') out.push({ title: title.slice(0, 200) });
  }
  return out;
}

/** Namen von Klassen, wie man sie tippt: „1a, 1b; 2a" oder je Zeile. Doppelte fallen weg. */
export function parseClassNames(raw: string): string[] {
  const out: string[] = [];
  for (const one of raw.split(/[,;\n]/)) {
    const name = one.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (name !== '' && !out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

/* == Rein: Realizacja ======================================================================== */

/** Eine Lekcja in einer Klasse — ein Wygłoszenie mit Klasse. */
export interface Realization {
  readonly id: string;
  /** Der Text (die Lekcja) — `null`: keiner gewählt (ein Tag ohne Thema). */
  readonly textId: string | null;
  readonly date: string;
  readonly state: LessonState;
  readonly classAreaId: string;
  readonly summary: string;
  readonly homework: string;
  readonly updatedAt: string;
}

const STATES = new Set<string>(LESSON_STATES.map((s) => s.value));

/** Der Stand eines Wygłoszenie: bei einer Lekcja der eingetragene, sonst (und ohne Angabe) „gehalten". */
export const stateOf = (data: EntryData): LessonState => {
  const said = str(data, 'state');
  return STATES.has(said) ? said as LessonState : 'done';
};

/** Was eine Klasse verwirklicht hat und vorhat — nach Tag; ohne `classAreaId` die aller Klassen. */
export function realizationsOf(entries: readonly (LibEntry & { readonly updatedAt?: string })[], classAreaId?: string): Realization[] {
  const want = classAreaId?.toLowerCase();
  const out: Realization[] = [];
  for (const e of entries) {
    if (e.kind !== 'delivery') continue;
    const area = str(e.data, 'classArea').trim().toLowerCase();
    if (area === '' || (want !== undefined && area !== want)) continue;
    out.push({
      id: e.id, textId: ids(e.data, 'texts')[0] ?? null, date: str(e.data, 'date'), state: stateOf(e.data), classAreaId: area,
      summary: str(e.data, 'summary'), homework: str(e.data, 'homework'), updatedAt: e.updatedAt ?? ''
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
}

/** Was in der Matrix an einer Lekcja einer Klasse steht: gehalten (die letzte), sonst geplant (die früheste), sonst ausgefallen. */
export function cellOf(given: readonly Realization[]): Realization | null {
  const realizations = [...given].sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
  const held = realizations.filter((r) => r.state === 'done' || r.state === 'partial');
  if (held.length > 0) return held[held.length - 1];
  const planned = realizations.filter((r) => r.state === 'planned');
  if (planned.length > 0) return planned[0];
  const skipped = realizations.filter((r) => r.state === 'skipped');
  return skipped.length > 0 ? skipped[skipped.length - 1] : null;
}

export interface Progress {
  readonly total: number;
  readonly done: number;
  readonly partial: number;
  readonly planned: number;
}

/** Wie weit eine Klasse mit einem Programm ist. */
export function progressOf(lessons: readonly Lesson[], realizations: readonly Realization[]): Progress {
  let done = 0; let partial = 0; let planned = 0;
  for (const l of lessons) {
    const cell = cellOf(realizations.filter((r) => r.textId === l.textId));
    if (cell?.state === 'done') done += 1;
    else if (cell?.state === 'partial') partial += 1;
    else if (cell?.state === 'planned') planned += 1;
  }
  return { total: lessons.length, done, partial, planned };
}

export const progressLine = (p: Progress): string =>
  p.total === 0 ? 'Program nie ma jeszcze lekcji.'
    : `Zrealizowane ${p.done} z ${p.total}${p.partial > 0 ? `, częściowo ${p.partial}` : ''}${p.planned > 0 ? `, zaplanowane ${p.planned}` : ''}.`;

/* == Rein: Stundenplan und Dziennik ============================================================ */

/** Ein Termin einer Lekcja im Kalender der Klasse. */
export interface LessonSlot {
  readonly itemId: string;
  /** Der Tag in Ortszeit, RRRR-MM-DD. */
  readonly date: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly occurrenceAt: string;
  readonly cancelled: boolean;
}

const two = (n: number): string => String(n).padStart(2, '0');
export const dayOf = (d: Date): string => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** Die Termine der Lekcje (die Reihen `seriesIds`) — nach Beginn. */
export function lessonSlots(occurrences: readonly Pick<Occurrence, 'itemId' | 'startsAt' | 'endsAt' | 'occurrenceAt' | 'status'>[], seriesIds: ReadonlySet<string>): LessonSlot[] {
  return occurrences
    .filter((o) => seriesIds.has(o.itemId.toLowerCase()) || seriesIds.has(o.itemId))
    .map((o) => ({
      itemId: o.itemId, date: dayOf(new Date(o.startsAt)), startsAt: o.startsAt, endsAt: o.endsAt, occurrenceAt: o.occurrenceAt,
      cancelled: o.status === 'cancelled'
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Eine Zeile des Dziennik: ein Termin (oder ein Tag ohne Termin), was an ihm verwirklicht wurde oder geplant ist. */
export interface JournalRow {
  readonly date: string;
  readonly slot: LessonSlot | null;
  readonly realization: Realization | null;
}

/**
 * DER DZIENNIK einer Klasse: Tag für Tag die Termine, und an jedem die Realizacja dieses Tages —
 * mehrere Lekcje an einem Tag der Reihe nach. Eine Realizacja ohne Termin (eine Zastępstwo, ein
 * verlegter Tag) steht trotzdem da.
 */
export function journalRows(slots: readonly LessonSlot[], realizations: readonly Realization[]): JournalRow[] {
  const days = [...new Set([...slots.map((s) => s.date), ...realizations.map((r) => r.date)])].filter((d) => d !== '').sort();
  const out: JournalRow[] = [];
  for (const date of days) {
    const here = slots.filter((s) => s.date === date);
    const done = realizations.filter((r) => r.date === date);
    const n = Math.max(here.length, done.length);
    for (let i = 0; i < n; i += 1) out.push({ date, slot: here[i] ?? null, realization: done[i] ?? null });
  }
  return out;
}

/**
 * DAS PROGRAMM AUF DIE TERMINE VERTEILEN: die Lekcje, die in dieser Klasse noch weder gehalten noch
 * geplant sind (eine ausgefallene kommt wieder dran), der Reihe nach auf die freien Termine ab heute
 * — frei heisst: an diesem Tag sind weniger Realizacje (ausser ausgefallenen) als Termine.
 */
export function distribute(lessons: readonly Lesson[], realizations: readonly Realization[], slots: readonly LessonSlot[], today: string): { textId: string; date: string }[] {
  const covered = new Set(realizations.filter((r) => r.state !== 'skipped' && r.textId !== null).map((r) => r.textId));
  const remaining = lessons.filter((l) => !covered.has(l.textId));
  const taken = new Map<string, number>();
  for (const r of realizations) if (r.state !== 'skipped') taken.set(r.date, (taken.get(r.date) ?? 0) + 1);
  const free: string[] = [];
  const seen = new Map<string, number>();
  for (const s of slots) {
    if (s.cancelled || s.date < today) continue;
    const at = (seen.get(s.date) ?? 0) + 1;
    seen.set(s.date, at);
    if (at > (taken.get(s.date) ?? 0)) free.push(s.date);
  }
  return remaining.slice(0, free.length).map((l, i) => ({ textId: l.textId, date: free[i] }));
}

/** Der Rok szkolny, in dem dieser Tag liegt: 1. September bis zum letzten Freitag im Juni. */
export function schoolYear(today: Date): { from: string; until: string } {
  const start = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const end = new Date(start + 1, 5, 30);
  while (end.getDay() !== 5) end.setDate(end.getDate() - 1);
  return { from: `${start}-09-01`, until: dayOf(end) };
}

/** pn=1 … nd=64, wie der Kalender. 1 = poniedziałek … 7 = niedziela. */
export const weekdayBit = (weekday: number): number => 1 << (Math.min(7, Math.max(1, weekday)) - 1);

export const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'] as const;

/** Der erste Tag ab `from` (RRRR-MM-DD), der dieser Wochentag ist (1 = poniedziałek). */
export function firstWeekday(from: string, weekday: number): string {
  const d = new Date(`${from}T12:00:00`);
  const want = weekday % 7; /* JS: niedziela = 0 */
  while (d.getDay() !== want) d.setDate(d.getDate() + 1);
  return dayOf(d);
}

/* == Lesen und Schreiben ======================================================================= */

/** Der Skryptorium eines Bereichs (es gibt höchstens einen) — `null`: keiner. */
export async function scriptoriumOf(areaId: string): Promise<LibraryRow | null> {
  const { libraries } = await loadLibraries();
  return libraries.find((l) => l.areaId.toLowerCase() === areaId.toLowerCase() && libraryKindOf(l) === 'writing') ?? null;
}

/** Wo die Programme einer Klasse liegen: der Bereich selbst oder der nächste darüber mit einem Skryptorium (die Schule). */
export async function programHome(areas: readonly AreaRow[], areaId: string): Promise<LibraryRow | null> {
  const { libraries } = await loadLibraries();
  const byId = new Map(areas.map((a) => [a.areaId.toLowerCase(), a]));
  let at: string | null = areaId.toLowerCase();
  for (let depth = 0; at !== null && depth < 16; depth += 1) {
    const here: string = at;
    const found = libraries.find((l) => l.areaId.toLowerCase() === here && libraryKindOf(l) === 'writing');
    if (found !== undefined) return found;
    at = byId.get(here)?.parentAreaId?.toLowerCase() ?? null;
  }
  return null;
}

/** Der Skryptorium der Schule — angelegt, wenn sie noch keinen hat. */
export async function ensureScriptorium(ring: Ring, schoolAreaId: string, name: string): Promise<LibraryRow> {
  const had = await scriptoriumOf(schoolAreaId);
  if (had !== null) return had;
  await createLibrary(ring, schoolAreaId, `Programy — ${name}`.slice(0, 200), 'writing');
  const made = await scriptoriumOf(schoolAreaId);
  if (made === null) throw new WorkspaceError('Skryptorium szkoły nie powstało.');
  return made;
}

/** Den Speicher eines Skryptorium öffnen und lesen. */
export async function openStore(ring: Ring | null, library: Pick<LibraryRow, 'libraryId' | 'areaId'>): Promise<LibraryStore> {
  if (ring === null) throw new WorkspaceError('Najpierw podaj hasło — programy są zapieczętowane.');
  const store = storeOf(ring, library);
  await store.sync();
  return store;
}

/** Die Programme im Skryptorium der Schule. */
export const programsIn = (store: LibraryStore): Entry[] =>
  store.ofKind('project').filter(isProgram).sort((a, b) => str(a.data, 'title').localeCompare(str(b.data, 'title'), 'pl'));

/** Ein neues Programm — leer, mit den Klassen, die es verwirklichen. */
export const createProgram = (store: LibraryStore, title: string, classes: readonly string[] = []): Promise<Entry> =>
  store.save({ kind: 'project', data: withClasses({ projectType: PROGRAM_TYPE, title: title.trim() || 'Program', outline: [], status: 'writing' }, classes) });

/** Die Klassen eines Programms setzen. */
export const setProgramClasses = (store: LibraryStore, program: Entry, classes: readonly string[]): Promise<Entry> =>
  store.save({ id: program.id, kind: 'project', data: withClasses(program.data, classes) });

/** Lekcje (und Überschriften) ans Ende eines Programms: jede Lekcja ein Text des Projekts. */
export async function addLessons(store: LibraryStore, program: Entry, items: readonly ({ heading: string } | { title: string })[]): Promise<Entry> {
  const added: ({ heading: string } | { text: string })[] = [];
  for (const one of items) {
    if ('heading' in one) { added.push({ heading: one.heading }); continue; }
    const text = await store.save({ kind: 'text', data: { title: one.title, project: program.id, status: 'draft' } });
    added.push({ text: text.id });
  }
  const now = store.own(program.id) ?? program;
  return store.save({ id: now.id, kind: 'project', data: { ...now.data, outline: [...outline(now.data), ...added] } });
}

/** Eine Realizacja anlegen oder ändern — was fehlt, bleibt, wie es war. */
export async function saveRealization(store: LibraryStore, input: {
  readonly id?: string;
  readonly textId?: string | null;
  readonly date?: string;
  readonly classAreaId: string;
  readonly state?: LessonState;
  readonly summary?: string;
  readonly homework?: string;
}): Promise<Entry> {
  const was = input.id === undefined ? undefined : store.own(input.id);
  const data: EntryData = { ...(was?.data ?? {}), classArea: input.classAreaId.toLowerCase() };
  if (input.textId !== undefined) data.texts = input.textId === null ? [] : [input.textId];
  if (input.date !== undefined) data.date = input.date;
  if (input.state !== undefined) data.state = input.state;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.homework !== undefined) data.homework = input.homework;
  return store.save({ ...(was === undefined ? {} : { id: was.id }), kind: 'delivery', data });
}

/* -- Der Stundenplan einer Klasse: wöchentliche Termine in ihrem Kalender -------------------------- */

export const LESSON_KEY = /^lekcja-\d+$/;

/** Die Reihen des Stundenplans (aus den Schlüsseln des Bereichs). */
export async function lessonSeries(classAreaId: string): Promise<{ key: string; itemId: string; label: string }[]> {
  const { keys } = await loadImportKeys(classAreaId);
  return keys.filter((k) => k.kind === 'appointment' && LESSON_KEY.test(k.key) && k.refId !== null)
    .map((k) => ({ key: k.key, itemId: k.refId!, label: k.refText ?? '' }));
}

/** Der Kalender der Klasse (der ihres Bereichs; angelegt, wenn es keinen gibt). */
export async function classCalendar(classAreaId: string, title: string): Promise<CalendarRow | { calendarId: string }> {
  const { calendars } = await loadCalendars();
  const own = calendars.filter((c) => c.areaId.toLowerCase() === classAreaId.toLowerCase() && c.archived !== true);
  const found = own.find((c) => c.isDefault !== false) ?? own[0];
  if (found !== undefined) return found;
  return createCalendar({ areaId: classAreaId, title, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

/** Eine Lekcja in der Woche: ein wöchentlicher Termin im Kalender der Klasse, gemerkt unter `lekcja-<n>`. */
export async function addLessonSeries(ring: Ring, input: {
  readonly classAreaId: string;
  readonly className: string;
  readonly ownerRoleId: string;
  readonly title: string;
  /** 1 = poniedziałek … 7 = niedziela. */
  readonly weekday: number;
  readonly time: string;
  readonly minutes: number;
  readonly from: string;
  readonly until: string;
}): Promise<string> {
  if (!/^\d{2}:\d{2}$/.test(input.time)) throw new WorkspaceError('Podaj godzinę lekcji (GG:MM).');
  const calendar = await classCalendar(input.classAreaId, input.className);
  const itemId = await saveEvent(ring, {
    title: input.title.trim() || `Lekcja — ${input.className}`, location: '', notes: '',
    areaId: input.classAreaId, ownerRoleId: input.ownerRoleId, calendarId: calendar.calendarId,
    date: firstWeekday(input.from, input.weekday), time: input.time, minutes: Math.max(5, Math.min(600, input.minutes)), allDay: false,
    repeat: 'weekly', every: 1, weekdays: weekdayBit(input.weekday), until: input.until, count: null
  });
  const had = await lessonSeries(input.classAreaId);
  let n = had.length + 1;
  while (had.some((h) => h.key === `lekcja-${n}`)) n += 1;
  await saveImportKeys(input.classAreaId, [{ kind: 'appointment', key: `lekcja-${n}`, refId: itemId, refText: `${WEEKDAYS[input.weekday - 1]} ${input.time}` }]);
  return itemId;
}

/** Die Termine der Lekcje einer Klasse in einem Zeitraum. */
export async function lessonSlotsOf(classAreaId: string, from: Date, to: Date): Promise<LessonSlot[]> {
  const series = await lessonSeries(classAreaId);
  if (series.length === 0) return [];
  const { calendars } = await loadCalendars();
  const own = calendars.filter((c) => c.areaId.toLowerCase() === classAreaId.toLowerCase());
  const ids = new Set(series.map((s) => s.itemId.toLowerCase()));
  const all: Occurrence[] = [];
  for (const c of own) all.push(...(await loadItems(c.calendarId, from, to)).occurrences);
  return lessonSlots(all, ids);
}

/* -- Der Klasse etwas sagen --------------------------------------------------------------------- */

/**
 * EINE NACHRICHT AN DIE KLASSE: in ihren Kanał (sonst ihre Rozmowa) — als die Rolle, die dort
 * schreibt (prowadzi zuerst); spricht sie für eine Person, steht die Person dabei (0095).
 */
export async function postToClass(ring: Ring, input: { readonly classAreaId: string; readonly text: string; readonly personId: string }): Promise<{ chatId: string }> {
  const { chats } = await loadChats();
  const here = chats.filter((c) => c.areaId.toLowerCase() === input.classAreaId.toLowerCase());
  const chat = here.find((c) => c.kind === 'channel') ?? here.find((c) => c.kind === 'area');
  if (chat === undefined) throw new WorkspaceError('Klasa nie ma jeszcze kanału ani rozmowy — załóż je w karcie klasy.');
  const { members } = await loadMembers(input.classAreaId);
  const mine = members.filter((m) => ring.has(m.roleId));
  const writer = mine.find((m) => m.capabilities.includes('admin')) ?? mine.find((m) => m.capabilities.includes('write'));
  if (writer === undefined) throw new WorkspaceError('Żadna z Twoich ról nie pisze w tej klasie.');
  const keys = await chatKeysOf(chat.chatId, await areaKeys(ring, input.classAreaId, true));
  await sendMessage(ring, chat.chatId, keys, writer.roleId, input.text, null, writer.roleId === input.personId ? {} : { personId: input.personId });
  return { chatId: chat.chatId };
}

/** Was die Klasse über eine Lekcja liest: Tag, Thema, was war, Zadanie. */
export function lessonMessage(input: { readonly date: string; readonly title: string | null; readonly summary?: string; readonly homework?: string }): string {
  const day = new Date(`${input.date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  const summary = (input.summary ?? '').trim();
  const homework = (input.homework ?? '').trim();
  return [
    `Lekcja, ${day}${input.title === null || input.title.trim() === '' ? '' : `: ${input.title.trim()}`}`,
    ...(summary === '' ? [] : [summary]),
    ...(homework === '' ? [] : [`Zadanie: ${homework}`])
  ].join('\n');
}
