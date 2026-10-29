/**
 * 2026-10-29 — MESSEN UND INTENTIONEN AUS DEM JSON: laden, was der Plan
 * braucht (`massesJson.ts`), und ausführen, was er sagt.
 *
 * <b>Dieselben Wege wie die Kanzlei.</b> Eine Messe wird angelegt und geändert
 * wie im Termin-Dialog (`saveEvent` — Ort versiegelt, Name offen), „ta i
 * następne" ist `handover`, wer feiert `setPeople`; eine Intention entsteht
 * über `addIntention`, Geber und Gabe werden HIER versiegelt — unter dem
 * Bereich des Kalenders, mit dem Etikett der Messintention (`recordAad`), wie
 * „Kto zamówił" in der Kanzlei. Kein Weg schickt Klartext, den die App
 * versiegelt.
 *
 * <b>Nach den Messen die Tage neu.</b> Bekommt eine Reihe eine neue Stunde,
 * hat jedes Vorkommen einen neuen ursprünglichen Beginn (der Dienst trägt die
 * Intentionen mit). Darum wird nach dem Anlegen und Ändern der Plan neu
 * geholt und jedes Vorkommen über Messe und Tag gefunden.
 *
 * <b>Was nicht geht, hält den Rest nicht auf</b> — es steht danach unter den
 * Warnungen, mit dem Tag und dem Wort des Dienstes.
 */

import { type AreaRow, loadMembers } from '../areas/area';
import { type AgendaOccurrence, deleteEvent, draftOf, type EventDraft, forever, handover, loadAgenda, openAgenda, type OpenedItem, restoreOne, saveEvent } from '../calendar/agenda';
import { type CalendarRow, type Duty, type SealedField, setOccurrence, setPeople } from '../calendar/calendar';
import { recordAad } from '../calendar/records';
import { areaKeys, loadAreaNames, newestKey, openNames } from '../chat/chat';
import { fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { addIntention, loadOffice, type OfficeIntention, type OfficeMass, updateIntention } from './mass';
import {
  addDays, dateOf, dayOfDate, type CalendarNow, type IntentionNow, type IntentionStatus, type MassesPlan, type MassesState,
  type OccurrenceNow, type OccurrencePlan, type Person, type PinnedNow, type SeriesDef, type SeriesNow, timeOfDate, untilOf
} from './massesJson';

const SERVICES = ['mass', 'confession', 'devotion'];

export interface LoadedMasses {
  readonly state: MassesState;
  /** Die Reihen, geöffnet — `draftOf` braucht sie zum Ändern. */
  readonly opened: ReadonlyMap<string, OpenedItem>;
  /** Wie viele versiegelte Felder hier nicht aufgingen (der Export sagt es). */
  readonly unreadable: number;
}

const messageOf = (e: unknown): string =>
  e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : 'nie udało się';

/** Die Menschen einer Gruppe mit Namen — wie `useAreaPeople`, nur ohne Hook. */
async function loadPeople(me: Me | null, areaId: string): Promise<Person[]> {
  try {
    const [{ members }, sealed] = await Promise.all([loadMembers(areaId), loadAreaNames(areaId).catch(() => ({ names: [] }))]);
    let names = new Map<string, string>();
    if (me !== null) {
      try { names = await openNames(await areaKeys(me.ring, areaId), areaId, sealed.names); } catch { /* ohne Namen */ }
    }
    return members
      .filter((m) => m.kind === 'person' || m.kind === 'role')
      .map((m) => ({ roleId: m.roleId, name: names.get(m.roleId) ?? me?.names.get(m.roleId) ?? '' }));
  } catch {
    return [];
  }
}

/** Geber und Gabe öffnen — `null`, wenn ein Feld da ist und nicht aufgeht. */
async function openIntention(me: Me | null, one: OfficeIntention, unreadable: { n: number }): Promise<IntentionNow> {
  const opened: Record<string, string | null> = { giver: '', offering: '' };
  for (const f of one.fields) {
    if (f.field !== 'giver' && f.field !== 'offering') continue;
    opened[f.field] = null;
    if (me === null) { unreadable.n++; continue; }
    try {
      const key = (await areaKeys(me.ring, f.areaId)).get(f.epoch);
      if (key !== undefined) opened[f.field] = await openText(key, recordAad('intencje', one.intentionId, f.field), fromBase64Url(f.sealed));
    } catch { /* nicht für mich */ }
    if (opened[f.field] === null) unreadable.n++;
  }
  return {
    id: one.intentionId, ordinal: one.ordinal, text: one.text,
    kind: one.kind === 'collective' ? 'collective' : 'single',
    status: (['accepted', 'celebrated', 'cancelled'].includes(one.status) ? one.status : 'accepted') as IntentionStatus,
    celebrant: one.celebrantRoleId, giver: opened.giver, offering: opened.offering
  };
}

const pinnedOf = (people: readonly { roleId: string; duty: string }[] | null | undefined): PinnedNow[] =>
  (people ?? []).map((p) => ({ roleId: p.roleId, duty: p.duty as Duty }));

/** Die Liste, die an den meisten Vorkommen einer Reihe steht — das ist die der Reihe. */
function mostCommon(lists: readonly (readonly PinnedNow[])[]): readonly PinnedNow[] {
  const tally = new Map<string, { n: number; list: readonly PinnedNow[] }>();
  for (const list of lists) {
    const key = list.map((p) => `${p.roleId}|${p.duty}`).sort().join(',');
    const was = tally.get(key);
    tally.set(key, { n: (was?.n ?? 0) + 1, list });
  }
  let best: { n: number; list: readonly PinnedNow[] } | null = null;
  for (const one of tally.values()) if (best === null || one.n > best.n) best = one;
  return best?.list ?? [];
}

/** Alles, was der Plan über einen Zeitraum und einige Kalender wissen muss. */
export async function loadMassesState(input: {
  me: Me | null;
  calendars: readonly CalendarRow[];
  areas: readonly AreaRow[];
  chosen: string;
  calendarIds: readonly string[];
  from: string;
  to: string;
}): Promise<LoadedMasses> {
  const { me } = input;
  const start = dateOf(input.from);
  const end = dateOf(addDays(input.to, 1));
  const unreadable = { n: 0 };

  const office: OfficeMass[] = [];
  for (const calendarId of input.calendarIds) office.push(...(await loadOffice(calendarId, start, end)).masses);

  /* Die Reihen dahinter: aus dem eigenen Kalender (er kennt Wiederholung, Ort, Menschen). */
  let agenda: readonly AgendaOccurrence[] = [];
  try {
    agenda = (await loadAgenda(new Date(start.getTime() - 86_400_000), new Date(end.getTime() + 86_400_000))).occurrences;
  } catch { /* ohne Reihen: der Plan kann dann keine bestehende Messe ändern */ }
  const firsts = new Map<string, AgendaOccurrence>();
  for (const o of agenda) if (SERVICES.includes(o.kind) && !firsts.has(o.itemId)) firsts.set(o.itemId, o);
  const opened = new Map<string, OpenedItem>();
  if (me !== null && firsts.size > 0) {
    for (const item of await openAgenda(me.ring, [...firsts.values()], input.areas)) opened.set(item.occurrence.itemId, item);
  }

  const occurrences: OccurrenceNow[] = [];
  for (const m of office) {
    const at = new Date(m.startsAt);
    occurrences.push({
      itemId: m.itemId, calendarId: m.calendarId, kind: m.kind, occurrenceAt: m.occurrenceAt,
      date: dayOfDate(at), time: timeOfDate(at), addressDate: dayOfDate(new Date(m.occurrenceAt)),
      status: m.status, skipped: m.skipped === true, moved: m.moved === true,
      people: pinnedOf(m.people),
      intentions: await Promise.all(m.intentions.map((i) => openIntention(me, i, unreadable)))
    });
  }

  const peopleByItem = new Map<string, PinnedNow[][]>();
  for (const o of occurrences) peopleByItem.set(o.itemId, [...(peopleByItem.get(o.itemId) ?? []), [...o.people]]);

  const series = new Map<string, SeriesNow>();
  for (const o of firsts.values()) {
    const item = opened.get(o.itemId);
    const s = o.series;
    const startAt = new Date(s.startsAt);
    const date = dayOfDate(startAt);
    const sealedPlace = o.fields.some((f) => f.field === 'location');
    series.set(o.itemId, {
      itemId: o.itemId, calendarId: o.calendarId, kind: o.kind,
      title: item !== undefined ? (item.named ? item.title : '') : (o.titlePublic ?? ''),
      date, time: timeOfDate(startAt),
      minutes: Math.max(5, Math.round((new Date(s.endsAt).getTime() - startAt.getTime()) / 60_000)),
      repeat: s.repeatKind, every: Math.max(1, s.repeatEvery || 1), weekdays: s.repeatWeekdays ?? 0,
      until: s.repeatKind === 'none' || s.repeatUntil == null ? null : untilOf(date, dayOfDate(new Date(s.repeatUntil))),
      place: item?.location ?? (sealedPlace ? null : ''),
      people: peopleByItem.has(o.itemId) ? mostCommon(peopleByItem.get(o.itemId)!) : pinnedOf(o.people),
      editable: item?.editable ?? false
    });
  }

  const calendars: CalendarNow[] = input.calendars.map((c) => ({
    calendarId: c.calendarId, title: c.title, areaName: c.areaName,
    mayWrite: c.mayWrite !== false && c.archived !== true,
    ...(c.durationMinutes === undefined ? {} : { durationMinutes: c.durationMinutes })
  }));
  const people = new Map<string, readonly Person[]>();
  for (const calendarId of input.calendarIds) {
    const c = input.calendars.find((one) => one.calendarId === calendarId);
    if (c !== undefined) people.set(calendarId, await loadPeople(me, c.areaId));
  }

  return {
    state: {
      calendars, chosen: input.chosen, loaded: [...input.calendarIds], from: input.from, to: input.to,
      series, occurrences, people, today: dayOfDate(new Date())
    },
    opened,
    unreadable: unreadable.n
  };
}

/* -- Ausführen ------------------------------------------------------------------------------------ */

/** Eine Reihe als Entwurf des Termin-Dialogs: was der Plan ändert, über das, was sie ist. */
function applyDef(draft: EventDraft, def: Partial<SeriesDef>): EventDraft {
  const date = def.date ?? draft.date;
  const time = def.time ?? draft.time;
  const repeat = def.repeat ?? draft.repeat;
  const until = def.until === undefined ? draft.until : def.until === null ? forever(dateOf(date)) : def.until;
  return {
    ...draft,
    ...(def.title === undefined ? {} : { title: def.title }),
    ...(def.place === undefined ? {} : { location: def.place }),
    date, time,
    ...(def.minutes === undefined ? {} : { minutes: def.minutes }),
    repeat,
    every: repeat === 'none' ? 1 : def.every ?? draft.every,
    weekdays: def.weekdays ?? draft.weekdays,
    until: repeat === 'none' ? null : until ?? forever(dateOf(date)),
    count: repeat === 'none' ? null : def.until !== undefined ? null : draft.count
  };
}

/** Ein neuer Gottesdienst — wie „Nowy wpis", nur über den Termin-Dialog (der Ort wird versiegelt). */
function freshDraft(def: SeriesDef, calendar: CalendarRow, ownerRoleId: string): EventDraft {
  return {
    kind: def.kind as EventDraft['kind'],
    title: def.title, location: def.place, notes: '',
    /* Wer die Termine dieses Kalenders sieht (0058) — wie der Termin-Dialog es vorgibt. */
    areaId: calendar.visibilityAreaId ?? calendar.areaId,
    ownerRoleId,
    date: def.date, time: def.time, minutes: def.minutes, allDay: false,
    repeat: def.repeat, every: def.repeat === 'none' ? 1 : def.every, weekdays: def.weekdays,
    until: def.repeat === 'none' ? null : def.until ?? forever(dateOf(def.date)),
    count: null,
    calendarId: calendar.calendarId
  };
}

/** Geber und Gabe versiegeln — unter dem Bereich des Kalenders, mit dem Etikett der Messintention. */
async function sealGift(me: Me, areaId: string | null, intentionId: string, gift: { giver?: string; offering?: string }): Promise<SealedField[]> {
  const given = (['giver', 'offering'] as const).filter((f) => gift[f] !== undefined);
  if (given.length === 0) return [];
  if (areaId === null) throw new WorkspaceError('nie wiadomo, kluczem której grupy zapieczętować ofiarodawcę i ofiarę');
  const newest = newestKey(await areaKeys(me.ring, areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tej grupy — ofiarodawcy i ofiary nie da się zapisać.');
  const out: SealedField[] = [];
  for (const field of given) {
    out.push({ field, areaId, epoch: newest.epoch, sealed: toBase64Url(await sealText(newest.key, recordAad('intencje', intentionId, field), gift[field]!.trim())) });
  }
  return out;
}

/** Mittag des Tages — der Dienst schneidet „ta i następne" am Ortstag, auch wenn die Zone anders rechnet. */
const noonOf = (day: string): string => { const d = dateOf(day); d.setHours(12, 0, 0, 0); return d.toISOString(); };

export async function runMassesImport(input: {
  me: Me;
  plan: MassesPlan;
  loaded: LoadedMasses;
  calendars: readonly CalendarRow[];
  stage: (what: string) => void;
}): Promise<{ lines: string[]; warnings: string[] }> {
  const { me, plan, loaded, stage } = input;
  const warnings: string[] = [];
  const done = { masses: 0, intentions: 0, changes: 0, days: 0 };
  const freshIds = new Map<number, string>();
  const calendarOf = (id: string) => input.calendars.find((c) => c.calendarId === id);

  /* -- 1. Neue Gottesdienste -------------------------------------------------------------- */
  for (const c of plan.creates) {
    if (c.handover !== null) continue;
    const calendar = calendarOf(c.calendarId);
    if (calendar === undefined) { warnings.push(`${c.label}: nie ma tego kalendarza — nie założono.`); continue; }
    stage(`Zakładanie: ${c.label}…`);
    let id: string;
    try {
      id = await saveEvent(me.ring, freshDraft(c.def, calendar, me.person.id));
    } catch (e) {
      warnings.push(`${c.label}: nie założono — ${messageOf(e)}.`);
      continue;
    }
    freshIds.set(c.fresh, id);
    done.masses++;
    if (c.people !== null && c.people.length > 0) {
      try { await setPeople(id, c.people); } catch (e) { warnings.push(`${c.label}: założono, ale bez osób — ${messageOf(e)}.`); }
    }
  }

  /* -- 2. Geänderte Reihen (die ganze Reihe) ---------------------------------------------- */
  for (const u of plan.updates) {
    const item = loaded.opened.get(u.itemId);
    stage(`Zmiana: ${u.label}…`);
    try {
      if (Object.keys(u.change).length > 0) {
        if (item === undefined) throw new WorkspaceError('tego wpisu nie da się tu otworzyć');
        await saveEvent(me.ring, applyDef(draftOf(item), u.change), u.itemId);
      }
      if (u.people !== null) await setPeople(u.itemId, u.people);
      done.masses++;
    } catch (e) {
      warnings.push(`${u.label}: nie zmieniono — ${messageOf(e)}.`);
    }
  }

  /* -- 3. „Ta i następne": neue Reihe ab dem Tag, die alte gibt ab (0079) --------------------- */
  for (const c of plan.creates) {
    if (c.handover === null) continue;
    const item = loaded.opened.get(c.handover.itemId);
    stage(`Zmiana od ${c.handover.from}: ${c.label}…`);
    let id: string | null = null;
    try {
      if (item === undefined) throw new WorkspaceError('tego wpisu nie da się tu otworzyć');
      id = await saveEvent(me.ring, applyDef(draftOf(item), c.def));
      await handover(c.handover.itemId, id, noonOf(c.handover.from));
    } catch (e) {
      /* Wie im Termin-Dialog: lehnt der Dienst die Übergabe ab, fällt die neue Reihe wieder weg — sie trägt noch nichts. */
      if (id !== null) await deleteEvent(id).catch(() => undefined);
      warnings.push(`${c.label}: zmiana od ${c.handover.from} nie przeszła — ${messageOf(e)}.`);
      continue;
    }
    freshIds.set(c.fresh, id);
    done.masses++;
    /* Die Menschen der REIHE gehen bei der Übergabe nicht mit (nur die einzelner Tage) — also hier. */
    if (c.people !== null && c.people.length > 0) {
      try { await setPeople(id, c.people); } catch (e) { warnings.push(`${c.label}: zmieniono, ale bez osób — ${messageOf(e)}.`); }
    }
  }

  /* -- 4. Die Tage: nach den Messen neu geholt (neue Reihen, neue Stunden) -------------------- */
  const byDay = new Map<string, OfficeMass>();
  const start = dateOf(plan.from);
  const end = dateOf(addDays(plan.to, 1));
  if (plan.creates.length > 0 || plan.updates.length > 0) {
    for (const calendarId of plan.calendars) {
      try {
        for (const m of (await loadOffice(calendarId, start, end)).masses) {
          const key = `${m.itemId}|${dayOfDate(new Date(m.startsAt))}`;
          if (!byDay.has(key)) byDay.set(key, m);
        }
      } catch (e) {
        warnings.push(`Nie udało się odczytać planu po zmianach — ${messageOf(e)}.`);
      }
    }
  }
  /* Eine Reihe, die der Import nicht angefasst hat, behält ihre Adressen genau; neue und geänderte werden am Tag gefunden. */
  const reshaped = new Set([...plan.updates.map((u) => u.itemId), ...plan.creates.flatMap((c) => (c.handover === null ? [] : [c.handover.itemId]))]);
  const occurrenceOf = (s: OccurrencePlan, itemId: string): { occurrenceAt: string; areaId: string | null } | null => {
    const found = byDay.get(`${itemId}|${s.date}`);
    /* Die alte Adresse gilt nur für eine Messe, die es schon gab — bei „ta i następne" gehört sie der alten Reihe. */
    const was = 'existing' in s.mass ? s.occurrenceAt : null;
    if (was !== null && !reshaped.has(itemId)) return { occurrenceAt: was, areaId: found?.areaId ?? null };
    if (found !== undefined) return { occurrenceAt: found.occurrenceAt, areaId: found.areaId ?? null };
    return was !== null && byDay.size === 0 ? { occurrenceAt: was, areaId: null } : null;
  };
  const areaOfCalendar = (calendarId: string): string | null => calendarOf(calendarId)?.areaId ?? null;

  /* -- 5. Die Tage, in Schritten über alle: zurückholen, verlegen und ändern, neu, wer feiert, zuletzt absagen —
         so hat eine verlegte Intention ihren alten Tag schon verlassen, wenn er abgesagt wird. ------------------- */
  interface Ready { readonly s: OccurrencePlan; readonly itemId: string; readonly occurrenceAt: string; readonly areaId: string | null }
  const ready: Ready[] = [];
  for (const s of plan.occurrences) {
    const itemId = 'existing' in s.mass ? s.mass.existing : freshIds.get(s.mass.fresh);
    if (itemId === undefined) { warnings.push(`${s.label}: msza nie powstała — pominięte.`); continue; }
    const at = occurrenceOf(s, itemId);
    if (at === null) { warnings.push(`${s.label}: tej mszy nie ma w planie po zmianach — pominięte.`); continue; }
    ready.push({ s, itemId, occurrenceAt: at.occurrenceAt, areaId: at.areaId ?? areaOfCalendar(s.calendarId) });
  }
  const step = async (r: Ready, what: string, todo: () => Promise<unknown>): Promise<boolean> => {
    try {
      await todo();
      return true;
    } catch (e) {
      warnings.push(`${r.s.label}: ${what} — ${messageOf(e)}.`);
      return false;
    }
  };

  for (const r of ready) {
    if (r.s.restore && await step(r, 'nie przywrócono', () => restoreOne(r.itemId, r.occurrenceAt))) done.days++;
  }

  for (const r of ready) {
    if (r.s.changes.length > 0) stage(`${r.s.label}: zmiany intencji…`);
    for (const c of r.s.changes) {
      const ok = await step(r, 'intencja nie zmieniona', async () => {
        const fields = c.giver === undefined && c.offering === undefined ? undefined
          : await sealGift(me, r.areaId, c.id, { ...(c.giver === undefined ? {} : { giver: c.giver }), ...(c.offering === undefined ? {} : { offering: c.offering }) });
        await updateIntention(c.id, {
          ...(c.text === undefined ? {} : { text: c.text }),
          ...(c.kind === undefined ? {} : { kind: c.kind }),
          ...(c.status === undefined ? {} : { status: c.status }),
          ...(c.ordinal === undefined ? {} : { ordinal: c.ordinal }),
          ...(c.celebrant === undefined ? {} : { celebrantRoleId: c.celebrant }),
          ...(fields === undefined ? {} : { fields }),
          ...(c.move === true ? { itemId: r.itemId, occurrenceAt: r.occurrenceAt } : {})
        });
      });
      if (ok) done.changes++;
    }
  }

  for (const r of ready) {
    if (r.s.adds.length > 0) stage(`${r.s.label}: nowe intencje…`);
    for (const a of r.s.adds) {
      let id: string;
      try {
        id = (await addIntention(r.itemId, r.occurrenceAt, { text: a.text, kind: a.kind, ...(a.ordinal === null ? {} : { ordinal: a.ordinal }) })).intentionId;
      } catch (e) {
        warnings.push(`${r.s.label}: intencja „${a.text.slice(0, 40)}” nie dodana — ${messageOf(e)}.`);
        continue;
      }
      done.intentions++;
      /* Was `addIntention` nicht trägt: Stand, wer sie liest, Geber und Gabe (versiegelt mit IHRER Kennung). */
      const gift = { ...(a.giver === '' ? {} : { giver: a.giver }), ...(a.offering === '' ? {} : { offering: a.offering }) };
      if (a.status !== 'accepted' || a.celebrant !== null || Object.keys(gift).length > 0) {
        await step(r, `intencja „${a.text.slice(0, 40)}” dodana, ale bez stanu, odprawiającego albo ofiary`, async () => {
          const fields = await sealGift(me, r.areaId, id, gift);
          await updateIntention(id, {
            ...(a.status === 'accepted' ? {} : { status: a.status }),
            ...(a.celebrant === null ? {} : { celebrantRoleId: a.celebrant }),
            ...(fields.length === 0 ? {} : { fields })
          });
        });
      }
    }
  }

  for (const r of ready) {
    const people = r.s.people;
    if (people !== null && await step(r, 'osoby nie zapisane', () => setPeople(r.itemId, people, r.occurrenceAt))) done.days++;
  }
  for (const r of ready) {
    if (r.s.cancel && await step(r, 'nie odwołano', () => setOccurrence(r.itemId, r.occurrenceAt, { cancelled: true }))) done.days++;
  }

  return {
    lines: [`Zapisano: msze i nabożeństwa ${done.masses}, nowe intencje ${done.intentions}, zmiany intencji ${done.changes}, zmiany dni ${done.days}.`, ...plan.lines],
    warnings: [...plan.warnings, ...warnings]
  };
}
