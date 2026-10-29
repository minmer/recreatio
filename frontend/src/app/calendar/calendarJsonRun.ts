/**
 * 2026-10-29 — TERMINE ALS JSON: laden, öffnen, schreiben. Geplant wird rein in `calendarJson.ts`.
 *
 * <b>Geladen wird, was der Kalender zeigt</b> (`/workspace/agenda`, je Anfrage höchstens 366 Tage — der Dienst
 * gibt nicht mehr als 400 her), und dazu die abgesagten Tage (`/workspace/masses` mit allen Arten): die Agenda
 * lässt sie aus, und ohne sie gingen sie im Export verloren. Geöffnet wird hier, mit den Schlüsseln dieses
 * Browsers; was nicht aufgeht, steht am Termin (`unreadable`), damit ihn der Import nicht überschreibt.
 *
 * <b>Geschrieben wird wie im Editor</b> (`saveEvent`, `saveDayValues`, `setOccurrence`, `setProgramParent`):
 * versiegelt unter dem jüngsten Schlüssel des Bereichs, der den Termin sieht. Erst jedes Ganze, dann seine
 * Punkte (sie brauchen seine Kennung), dann die Tage der Reihen (deren Namen am Dienst erst jetzt feststehen,
 * wenn eine Reihe neu ist oder ihre Zeit wechselt), zuletzt, was fallen soll.
 */

import { deleteEvent, loadAgenda, saveEvent, type AgendaOccurrence, type EventDraft } from './agenda';
import { emptyTexts, ITEM_KINDS, itemFieldAad, putText, setOccurrence, setProgramParent, type ItemKind } from './calendar';
import { docsOf } from './calendarDocs';
import {
  dayOf, docNeeds, exportCalendar, readDay, type CalendarExport, type CalendarInfo, type CalendarPlan, type CalendarState,
  type StateItem, type StateOccurrence, type StateScheme
} from './calendarJson';
import { loadProgram } from './program';
import { openValues, saveDayValues, type OpenValue } from './schemeValues';
import { areaKeys, newestKey } from '../chat/chat';
import { fromBase64Url, openText } from '../core/crypto';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { loadOffice, type OfficeMass } from '../masses/mass';

/** So viele Tage holt eine Anfrage — der Dienst gibt höchstens 400 her. */
const WINDOW_DAYS = 366;
/** So viele Zeiträume höchstens für einen Export oder ein Dokument (etwa fünfzehn Jahre). */
const MAX_WINDOWS = 15;
/** So viele Termine mit "id" ausserhalb der Tage des Dokuments sucht der Import einzeln (an ihrem Beginn). */
const MAX_LOOKUPS = 40;

export interface Span {
  readonly from: Date;
  /** Ausschliesslich: Mitternacht nach dem letzten Tag. */
  readonly to: Date;
}

const startOfDay = (at: Date): Date => new Date(at.getFullYear(), at.getMonth(), at.getDate());
const plusDays = (at: Date, n: number): Date => new Date(at.getFullYear(), at.getMonth(), at.getDate() + n);
const plusYears = (at: Date, n: number): Date => new Date(at.getFullYear() + n, at.getMonth(), at.getDate());
const sameId = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
const reason = (e: unknown): string => (e instanceof WorkspaceError || e instanceof Error ? e.message : 'nie udało się');

/** Ein Zeitraum in Stücken, die der Dienst nimmt. */
export function spansOf(from: Date, to: Date, max = MAX_WINDOWS): Span[] {
  const out: Span[] = [];
  let at = startOfDay(from);
  const end = to.getTime() > at.getTime() ? to : plusDays(at, 1);
  while (at.getTime() < end.getTime() && out.length < max) {
    const next = plusDays(at, WINDOW_DAYS);
    out.push({ from: at, to: next.getTime() < end.getTime() ? next : end });
    at = next;
  }
  return out;
}

/* -- Laden und öffnen -------------------------------------------------------------------------------- */

interface RawItem {
  readonly first: AgendaOccurrence;
  /** Je Vorkommen (sein Name in ms) — aus der Agenda. */
  readonly occurrences: Map<number, AgendaOccurrence>;
}

interface Gathered {
  readonly items: Map<string, RawItem>;
  /** Die abgesagten Tage (aus dem Plan der Kanzlei) — zugeordnet, wenn alles geladen ist. */
  readonly cancelled: OfficeMass[];
  /** Die Tage, deren Vorkommen vollständig bekannt sind (mit den abgesagten). */
  readonly spans: { from: string; to: string }[];
}

const fresh = (): Gathered => ({ items: new Map(), cancelled: [], spans: [] });

/** Die Zeiträume holen. Gibt zurück, wie viele Vorkommen dieses Kalenders darin standen. */
async function gather(info: CalendarInfo, spans: readonly Span[], into: Gathered): Promise<number> {
  let seen = 0;
  for (const span of spans) {
    const [agenda, office] = await Promise.all([
      loadAgenda(span.from, span.to),
      /* Ein älterer Dienst ohne diese Liste: dann eben ohne die abgesagten Tage — und der Zeitraum gilt nicht als ganz bekannt. */
      loadOffice(info.calendarId, span.from, span.to, ITEM_KINDS).catch(() => null)
    ]);
    for (const one of agenda.occurrences) {
      if (!sameId(one.calendarId, info.calendarId)) continue;
      seen += 1;
      const key = one.itemId.toLowerCase();
      let raw = into.items.get(key);
      if (raw === undefined) {
        raw = { first: one, occurrences: new Map() };
        into.items.set(key, raw);
      }
      raw.occurrences.set(Date.parse(one.occurrenceAt), one);
    }
    if (office !== null) {
      for (const one of office.masses) if (one.skipped === true) { into.cancelled.push(one); seen += 1; }
      into.spans.push({ from: dayOf(span.from), to: dayOf(plusDays(span.to, -1)) });
    }
  }
  return seen;
}

/** Einen Termin öffnen — jedes Feld mit dem Schlüssel SEINES Bereichs; was nicht aufgeht, wird vermerkt. */
async function openItem(ring: Ring, raw: RawItem, cancelled: readonly OfficeMass[]): Promise<StateItem> {
  const first = raw.first;
  const texts = emptyTexts();
  let unreadable = false;
  for (const field of first.fields) {
    try {
      const key = (await areaKeys(ring, field.areaId)).get(field.epoch);
      if (key === undefined) { unreadable = true; continue; }
      putText(texts, field.field, await openText(key, itemFieldAad(first.itemId, field.field), fromBase64Url(field.sealed)));
    } catch {
      unreadable = true;
    }
  }

  const itemRows = (first.values ?? []).filter((v) => v.occurrenceAt === null);
  const opened = itemRows.length === 0 ? { item: new Map<string, OpenValue>(), complete: true } : await openValues(ring, first.itemId, itemRows);

  const occurrences: StateOccurrence[] = [];
  for (const one of raw.occurrences.values()) {
    const rows = (one.values ?? []).filter((v) => v.occurrenceAt !== null && Date.parse(v.occurrenceAt) === Date.parse(one.occurrenceAt));
    const day = rows.length === 0 ? new Map<string, OpenValue>() : (await openValues(ring, one.itemId, rows)).day;
    occurrences.push({
      at: one.occurrenceAt, startsAt: one.startsAt, cancelled: false, moved: one.moved,
      values: day, valuesComplete: day.size === rows.length
    });
  }
  for (const one of cancelled) {
    if (!sameId(one.itemId, first.itemId) || raw.occurrences.has(Date.parse(one.occurrenceAt))) continue;
    if (occurrences.some((o) => Date.parse(o.at) === Date.parse(one.occurrenceAt))) continue;
    /* Die Werte eines abgesagten Tages kommen nicht mit (die Agenda lässt ihn aus) — also nicht neu schreiben. */
    occurrences.push({ at: one.occurrenceAt, startsAt: one.startsAt, cancelled: true, moved: false, values: new Map(), valuesComplete: false });
  }
  occurrences.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const series = first.series;
  const openTitle = (first.titlePublic ?? '').trim();
  return {
    itemId: first.itemId,
    kind: first.kind,
    visibilityAreaId: first.visibilityAreaId,
    title: texts.title ?? (openTitle === '' ? null : openTitle),
    location: texts.location,
    notes: texts.notes,
    link: texts.link,
    linkLabel: texts.linkLabel,
    unreadable,
    startsAt: series.startsAt,
    endsAt: series.endsAt,
    allDay: first.allDay,
    repeat: series.repeatKind,
    every: series.repeatEvery,
    weekdays: series.repeatWeekdays,
    until: series.repeatUntil,
    count: series.repeatCount,
    parentItemId: first.parentItemId ?? null,
    position: first.position ?? null,
    schemeId: first.schemeId ?? null,
    values: opened.item,
    valuesComplete: opened.complete,
    bookable: first.bookable ?? null,
    capacity: first.capacity ?? null,
    reserveAreaId: first.reserveAreaId ?? null,
    occurrences
  };
}

async function schemesOf(ring: Ring, info: CalendarInfo): Promise<StateScheme[]> {
  const { schemes } = await docsOf(ring, info.calendarId);
  return schemes.map((s) => ({ id: s.docId, def: s.def }));
}

async function stateOf(ring: Ring, info: CalendarInfo, gathered: Gathered): Promise<CalendarState> {
  const [items, schemes] = await Promise.all([
    Promise.all([...gathered.items.values()].map((raw) => openItem(ring, raw, gathered.cancelled))),
    schemesOf(ring, info)
  ]);
  return { calendar: info, items, schemes, spans: gathered.spans };
}

/**
 * Die Termine eines Kalenders in diesen Zeiträumen — und die Termine `ids`, die darin nicht vorkamen, einzeln
 * gesucht (ihr Programm nennt Kalender und Beginn; dort wird ein Jahr geholt).
 */
export async function loadCalendarState(ring: Ring, info: CalendarInfo, spans: readonly Span[], ids: readonly string[] = []): Promise<CalendarState> {
  const gathered = fresh();
  await gather(info, spans, gathered);
  const missing = ids.filter((id) => !gathered.items.has(id.toLowerCase())).slice(0, MAX_LOOKUPS);
  const extra: Span[] = [];
  for (const id of missing) {
    try {
      const tree = await loadProgram(id);
      if (!sameId(tree.calendarId, info.calendarId)) continue;
      const row = tree.items.find((r) => sameId(r.itemId, id));
      if (row === undefined) continue;
      const from = plusDays(startOfDay(new Date(row.startsAt)), -1);
      if ([...spans, ...extra].some((s) => s.from.getTime() <= from.getTime() && from.getTime() < s.to.getTime())) continue;
      extra.push({ from, to: plusDays(from, WINDOW_DAYS) });
    } catch {
      /* Nicht mehr da, oder nicht zu sehen — der Plan sagt es. */
    }
  }
  if (extra.length > 0) await gather(info, extra, gathered);
  return stateOf(ring, info, gathered);
}

/** Was der Plan für ein Dokument braucht: die Termine mit "id" (zuerst an seinen Tagen gesucht) und die Schemata. */
export async function loadDocState(ring: Ring, info: CalendarInfo, value: unknown): Promise<CalendarState> {
  const needs = docNeeds(value, info.calendarId);
  if (needs.ids.length === 0) return { calendar: info, items: [], schemes: await schemesOf(ring, info), spans: [] };
  const from = readDay(needs.from) ?? startOfDay(new Date());
  const to = readDay(needs.to) ?? from;
  return loadCalendarState(ring, info, spansOf(plusDays(from, -1), plusDays(to, 2)), needs.ids);
}

/* -- Export ------------------------------------------------------------------------------------------- */

export type ExportChoice =
  | { readonly kind: 'year' }
  | { readonly kind: 'around' }
  | { readonly kind: 'days'; readonly from: string; readonly to: string }
  | { readonly kind: 'all' };

/**
 * „WSZYSTKO": vorwärts, solange ein Jahr noch neue Termine bringt (eine Reihe „bez końca" reicht zehn Jahre
 * voraus, bringt aber nach dem ersten Jahr nichts Neues), rückwärts, solange ein Jahr noch Termine dieses
 * Kalenders hat. Höchstens fünfzehn Jahre.
 */
async function scanAll(ring: Ring, info: CalendarInfo): Promise<CalendarState> {
  const today = startOfDay(new Date());
  const gathered = fresh();
  let windows = 0;
  for (let k = 0; windows < MAX_WINDOWS; k += 1) {
    const before = gathered.items.size;
    const from = plusDays(today, k * WINDOW_DAYS);
    await gather(info, [{ from, to: plusDays(from, WINDOW_DAYS) }], gathered);
    windows += 1;
    if (k > 0 && gathered.items.size === before) break;
  }
  for (let k = 1; windows < MAX_WINDOWS; k += 1) {
    const to = plusDays(today, -(k - 1) * WINDOW_DAYS);
    const seen = await gather(info, [{ from: plusDays(to, -WINDOW_DAYS), to }], gathered);
    windows += 1;
    if (seen === 0) break;
  }
  return stateOf(ring, info, gathered);
}

/** DER EXPORT eines Zeitraums (Vorgabe: von heute ein Jahr) — mit den Reihen, die hineinreichen. */
export async function exportCalendarRange(ring: Ring, info: CalendarInfo, choice: ExportChoice): Promise<CalendarExport> {
  if (choice.kind === 'all') return exportCalendar(await scanAll(ring, info));
  const today = startOfDay(new Date());
  let from: Date | null = today;
  let to: Date | null = plusYears(today, 1);
  if (choice.kind === 'around') from = plusYears(today, -1);
  if (choice.kind === 'days') {
    from = readDay(choice.from);
    const last = readDay(choice.to);
    to = last === null ? null : plusDays(last, 1);
  }
  if (from === null || to === null || to.getTime() <= from.getTime()) throw new WorkspaceError('Podaj zakres eksportu: dzień „od” i dzień „do” (nie wcześniej niż „od”).');
  if (to.getTime() > plusDays(from, MAX_WINDOWS * WINDOW_DAYS).getTime()) throw new WorkspaceError(`Zakres eksportu najwyżej ${MAX_WINDOWS} lat — wybierz krótszy albo „wszystko”.`);
  return exportCalendar(await loadCalendarState(ring, info, spansOf(from, to)));
}

/* -- Import ------------------------------------------------------------------------------------------- */

/**
 * DEN PLAN AUSFÜHREN. Was nicht geht, wird gesagt und übersprungen (mit seinen Punkten); der Rest geht weiter.
 * `ownerRoleId`: wer einträgt (die eigene Person — wie im Editor).
 */
export async function runCalendarImport(input: {
  readonly ring: Ring;
  readonly ownerRoleId: string;
  readonly calendar: CalendarInfo;
  readonly plan: CalendarPlan;
  readonly stage: (what: string) => void;
}): Promise<{ lines: string[]; warnings: string[] }> {
  const { ring, ownerRoleId, calendar, plan, stage } = input;
  const failed: string[] = [];
  const ids = new Map<number, string>();
  const areas = new Map<number, string>();
  /* Termine, deren Speichern scheiterte: ihre Tage bleiben, wie sie sind (die Kennungen gehörten zur alten Zeit). */
  const broken = new Set<number>();
  for (const one of plan.items) {
    if (one.itemId === null || one.state === null) continue;
    ids.set(one.ref, one.itemId);
    areas.set(one.ref, one.state.visibilityAreaId);
  }

  /* 1 — die Termine, jedes Ganze vor seinen Punkten. */
  let created = 0;
  let changed = 0;
  const writes = plan.items.filter((one) => one.save !== null || one.program).length;
  let n = 0;
  for (const one of plan.items) {
    if (one.save === null && !one.program) continue;
    n += 1;
    stage(`Terminy: ${n} z ${writes} — „${one.label}”…`);
    const parentId = one.parent === undefined ? undefined
      : one.parent === null ? null
      : 'ref' in one.parent ? ids.get(one.parent.ref) : one.parent.itemId;
    if (one.parent != null && parentId === undefined) {
      failed.push(`„${one.label}” — jego termin nadrzędny nie powstał; pominięty.`);
      broken.add(one.ref);
      continue;
    }
    /* Ein neuer Punkt sieht, wer sein Ganzes sieht; ein neuer Termin, wer den Kalender sieht; ein bestehender bleibt. */
    const area = one.state?.visibilityAreaId
      ?? (one.parent != null && 'ref' in one.parent ? areas.get(one.parent.ref) : undefined)
      ?? calendar.visibilityAreaId;
    const target = parentId === undefined ? one.state?.parentItemId ?? null : parentId;
    try {
      if (one.save !== null) {
        const s = one.save;
        const program = one.itemId === null ? target !== null : one.program;
        const draft: EventDraft = {
          kind: s.kind as ItemKind,
          title: s.title, location: s.location, notes: s.notes, link: s.link, linkLabel: s.linkLabel,
          areaId: area, ownerRoleId,
          date: s.date, time: s.time, minutes: s.minutes, allDay: s.allDay,
          repeat: s.repeat, every: s.every, weekdays: s.weekdays, until: s.until, count: s.count,
          calendarId: calendar.calendarId,
          bookable: s.bookable, capacity: s.capacity, reserveAreaId: one.state?.reserveAreaId ?? null,
          ...(program ? { parentItemId: target, position: one.position ?? null } : {}),
          schemeId: s.schemeId,
          values: s.values,
          publicTitle: s.publicTitle
        };
        const id = await saveEvent(ring, draft, one.itemId ?? undefined);
        ids.set(one.ref, id);
        areas.set(one.ref, area);
        if (one.itemId === null) created += 1; else changed += 1;
      } else if (one.itemId !== null) {
        await setProgramParent(one.itemId, target, target === null ? null : one.position ?? one.state?.position ?? null);
        changed += 1;
      }
    } catch (e) {
      failed.push(`„${one.label}” — ${one.itemId === null ? 'nie dodano' : 'nie zmieniono'}: ${reason(e)}.`);
      broken.add(one.ref);
    }
  }

  /* 2 — die Tage der Reihen: ihr Name am Dienst — bekannt, oder jetzt gesucht. */
  const pending = plan.items.flatMap((one) => (broken.has(one.ref) || !ids.has(one.ref) ? [] : one.occurrences.map((op) => ({ one, op }))));
  let days = 0;
  if (pending.length > 0) {
    const found = new Map<string, string>();
    const unknown = pending.filter(({ op }) => op.at === null).map(({ op }) => op.day).sort();
    if (unknown.length > 0) {
      stage('Dni serii — szukanie w kalendarzu…');
      const spans: Span[] = [];
      for (const day of unknown) {
        const at = readDay(day);
        if (at === null || spans.some((s) => s.from.getTime() <= at.getTime() && at.getTime() < s.to.getTime())) continue;
        const from = plusDays(at, -1);
        spans.push({ from, to: plusDays(from, WINDOW_DAYS) });
      }
      for (const span of spans) {
        try {
          const office = await loadOffice(calendar.calendarId, span.from, span.to, ITEM_KINDS);
          for (const one of office.masses) found.set(`${one.itemId.toLowerCase()}|${dayOf(new Date(one.occurrenceAt))}`, one.occurrenceAt);
        } catch (e) {
          failed.push(`Dni serii od ${dayOf(span.from)}: ${reason(e)}.`);
        }
      }
    }
    const keys = new Map<string, { key: Uint8Array; epoch: number } | null>();
    const newest = async (areaId: string) => {
      if (!keys.has(areaId)) keys.set(areaId, newestKey(await areaKeys(ring, areaId, true)));
      return keys.get(areaId) ?? null;
    };
    for (const [i, { one, op }] of pending.entries()) {
      const itemId = ids.get(one.ref)!;
      const at = op.at ?? found.get(`${itemId.toLowerCase()}|${op.day}`);
      if (at === undefined) { failed.push(`„${one.label}”: dnia ${op.day} nie ma w serii — pominięty.`); continue; }
      stage(`Dni serii: ${i + 1} z ${pending.length}…`);
      try {
        if (op.cancel === true) await setOccurrence(itemId, at, { cancelled: true });
        else if (op.restore === true) await setOccurrence(itemId, at, { restore: true });
        else if (op.moveTo !== undefined) await setOccurrence(itemId, at, { movedTo: op.moveTo });
        if (op.values !== undefined) {
          const area = areas.get(one.ref) ?? calendar.visibilityAreaId;
          const key = await newest(area);
          if (key === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
          await saveDayValues(itemId, at, key, area, op.values);
        }
        days += 1;
      } catch (e) {
        failed.push(`„${one.label}”, ${op.day}: ${reason(e)}.`);
      }
    }
  }

  /* 3 — zuletzt, was fallen soll (mit seinen Punkten — so löscht der Dienst). */
  let removed = 0;
  for (const [i, one] of plan.removals.entries()) {
    stage(`Usuwanie: ${i + 1} z ${plan.removals.length} — „${one.label}”…`);
    try {
      await deleteEvent(one.itemId);
      removed += 1;
    } catch (e) {
      failed.push(`„${one.label}” — nie usunięto: ${reason(e)}.`);
    }
  }

  return {
    lines: [
      `Nowe terminy: ${created}.`,
      `Zmienione terminy: ${changed}.`,
      ...(days > 0 ? [`Dni serii: ${days}.`] : []),
      ...(plan.removals.length > 0 ? [`Usunięte terminy: ${removed} z ${plan.removals.length}.`] : [])
    ],
    warnings: failed
  };
}
