/**
 * EIN TERMIN — anlegen und ändern.
 *
 * 2026-10-24 — AUFGERÄUMT: was ein neuer Termin wirklich braucht, steht da —
 * was (der Titel), wann (der Tag, von–bis oder ganztägig), ob er wiederkehrt,
 * und in welchem Kalender. Der Kalender bringt den Rest mit (0058): wer den
 * Termin sieht, wie lange er dauert, was er ist (Treffen, Messe), ob man ihn
 * reservieren kann. Alles Weitere kommt nur, wenn man es will — „+ Miejsce",
 * „+ Notatka", „+ Osoby", „+ Link", „+ Program" — und steht beim Ändern offen
 * da, sobald es etwas enthält. Jede Zeile trägt links ihr Zeichen statt einer
 * Überschrift.
 *
 * Fort sind: die Sichtbarkeit je Termin (wer ihn sieht, sagt sein Kalender;
 * ein älterer Termin, der es anders hat, behält es beim Speichern und sagt es —
 * nichts wird stillschweigend breiter sichtbar), die Wahl „Część programu"
 * (eingehängt wird vom Ganzen aus, „Podłącz istniejący termin") und die Art in
 * Kalendern, die nur Treffen führen.
 *
 * Gespeichert wird wie bisher (`saveEvent`): die Regeln liegen am Kalender, der
 * Termin trägt nur, was ihm eigen ist — NULL heisst „wie der Kalender".
 *
 * Neu beim Bedienen: ein anderer Beginn nimmt das Ende mit (die Dauer bleibt),
 * ein anderer Tag ebenso; die Wochentage einer wöchentlichen Reihe wandern mit
 * dem Tag, bis man sie selbst wählt; „Co tydzień / Co miesiąc / Co rok" sind
 * eine Wahl, „co 2 tygodnie" steht unter „Inaczej…".
 *
 * 2026-10-17 — PUNKTE DES PROGRAMMS TEILEN ALLES MIT IHREM GANZEN: ein neuer
 * Punkt übernimmt Kalender, Sichtbarkeit, Ort, Link und wer dabei ist; wird
 * das Ganze geändert (oder verschoben), ziehen die Punkte nach — jeder Punkt,
 * der das betreffende Feld noch so hat wie das Ganze vorher. Wer bei einem
 * Punkt etwas anders einträgt, behält es (`followParent`).
 */

import { useEffect, useRef, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { PRIVATE, Weekdays, bitOf, fromLocal, groupName, localDate, localTime } from '../areas/WhoSees';
import { addDays, monthOfName } from '../core/dayMath';
import type { Ring } from '../core/keys';
import type { Me } from '../core/me';
import { plural } from '../core/plural';
import { useRecent } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import { DEVOTION_NAMES } from '../masses/mass';
import { askText } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { type OpenedItem, type RepeatKind, cancelOne, deleteEvent, draftOf, endSeriesBefore, ensurePrivateArea, forever, handover, isLiturgy, moveOne, saveEvent } from './agenda';
import { type CalendarRow, ITEM_LABEL, type ItemKind, safeLink, setPeople, setProgramParent } from './calendar';
import { calendarLabel } from './calendarLabel';
import type { CalEvent } from './calendarModel';
import { ProgramOf } from './EventDetails';
import type { EventTarget } from './EventDialog';
import { dutyOf, peopleWord } from './eventWords';
import { PeoplePicker, type Pinned, useAreaPeople } from './PeoplePicker';
import { areaKeys, newestKey } from '../chat/chat';
import { useCalendarDocs } from './calendarDocs';
import { RecordsPanel } from './RecordsPanel';
import { type SchemeField, schemeOf, shownFields, shownLists, UNIVERSAL_ID } from './scheme';
import { SchemeInput } from './SchemeInput';
import { draftValues, editText, saveDayValues } from './schemeValues';

/** Was zu einem Termin dazukommen kann — jedes auf Wunsch („+ Miejsce"), in dieser Reihenfolge. */
type Extra = 'place' | 'notes' | 'people' | 'link' | 'program';

const EXTRAS: readonly { readonly key: Extra; readonly label: string }[] = [
  { key: 'place', label: 'Miejsce' },
  { key: 'notes', label: 'Notatka' },
  { key: 'people', label: 'Osoby' },
  { key: 'link', label: 'Link' },
  { key: 'program', label: 'Program' }
];

/** Die Wahl „Powtarzanie": die üblichen Abstände — und „Inaczej…" für co N, die Wochentage stehen bei „Co tydzień". */
type RepeatChoice = RepeatKind | 'custom';

type Scope = 'one' | 'following' | 'all';

const SCOPES: readonly { readonly value: Scope; readonly label: string }[] = [
  { value: 'one', label: 'Ten termin' }, { value: 'following', label: 'Ten i następne' }, { value: 'all', label: 'Całą serię' }
];

/** Bis zu so vielen Kalendern: Plättchen nebeneinander; mehr — eine Auswahlliste. */
const CHIP_CALENDARS = 5;

/** Wie ein neuer Eintrag heisst, nach seiner Art. */
const NEW_TITLE: Partial<Record<ItemKind, string>> = {
  mass: 'Nowa msza', confession: 'Nowa spowiedź', devotion: 'Nowe nabożeństwo', visit: 'Nowe odwiedziny'
};

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** Welche Arten ein Eintrag in diesem Kalender haben kann. Nur eine: es gibt nichts zu wählen. */
function kindsFor(calendarKind: ItemKind | undefined, now: ItemKind): readonly ItemKind[] {
  const offered: readonly ItemKind[] = isLiturgy(calendarKind) ? ['mass', 'confession', 'devotion', 'appointment']
    : calendarKind === 'visit' ? ['visit', 'appointment'] : ['appointment'];
  return offered.includes(now) ? offered : [...offered, now];
}

/* -- Anlegen und ändern -------------------------------------------------------------- */

export function Editor({ me, areas, calendars, scope: allowed, target, events, onClose, onSaved, onOpenPart }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  scope?: readonly string[];
  target: EventTarget;
  events?: readonly CalEvent[];
  onClose: () => void;
  onSaved: () => void;
  onOpenPart?: (part: CalEvent) => void;
}) {
  const recent = useRecent('calendar.cal');
  const item: OpenedItem | undefined = target.at === 'event' ? target.event.item : undefined;
  const occurrence = item?.occurrence;
  const series = occurrence?.series;
  const personal = areas.find((a) => a.personal === true);

  /* 2026-10-17 — das Ganze, unter dem ein NEUER Punkt entsteht: von ihm übernimmt er, was er nicht anders sagt. */
  const parentItem = target.at === 'new' && target.parentItemId !== undefined
    ? events?.find((e) => e.item?.occurrence.itemId === target.parentItemId)?.item : undefined;
  /* Wovon ein bestehender Punkt abhängt — für die Zeile „Punkt programu". */
  const ownParent = occurrence?.parentItemId == null ? undefined
    : events?.find((e) => e.item?.occurrence.itemId === occurrence.parentItemId)?.item;
  /* Die Punkte dieses Termins, je Punkt einmal (eine Reihe steht sonst mit jedem Vorkommen da). */
  const parts = item === undefined || events === undefined ? [] : [...new Map(events
    .filter((e) => e.item !== undefined && e.item.occurrence.parentItemId === item.occurrence.itemId)
    .map((e) => [e.item!.occurrence.itemId, e.item!] as const)).values()];

  /*
   * IN WELCHE KALENDER: die, in denen ich schreibe (auf einer Seite nur die
   * des Bausteins); private zuerst. Gibt es noch keinen privaten, steht
   * „Tylko ja" trotzdem da — er entsteht beim Speichern.
   */
  const writable = calendars.filter((c) => c.mayWrite === true && c.archived !== true
    && (allowed === undefined || allowed.includes(c.calendarId)));
  const privateCals = writable.filter((c) => c.areaId === personal?.areaId);
  const groupCals = writable.filter((c) => c.areaId !== personal?.areaId);
  const offerPrivate = allowed === undefined && privateCals.length === 0;

  /* Was vorher dastand: beim neuen die angeklickte Zeit, beim bestehenden die REIHE (für „cała seria"). */
  const start = target.at === 'new' ? target.start : new Date(target.event.start);
  const end = target.at === 'new' ? target.end : new Date(target.event.end);
  const seriesStart = series !== undefined ? new Date(series.startsAt) : start;
  const seriesEnd = series !== undefined ? new Date(series.endsAt) : end;
  const repeating = series !== undefined && series.repeatKind !== 'none';

  const [calendarId, setCalendarId] = useState<string>(() => {
    if (occurrence !== undefined) return occurrence.calendarId;
    if (target.at === 'new' && target.calendarId !== undefined && writable.some((c) => c.calendarId === target.calendarId)) return target.calendarId;
    const last = recent.ids.find((id) => writable.some((c) => c.calendarId === id));
    return last ?? privateCals[0]?.calendarId ?? (offerPrivate ? PRIVATE : writable[0]?.calendarId ?? PRIVATE);
  });
  const calendar = calendars.find((c) => c.calendarId === calendarId);
  const calendarArea = calendar?.areaId ?? personal?.areaId ?? null;
  const isPrivate = calendarId === PRIVATE || calendarArea === personal?.areaId;
  const defaultVisibility = calendar?.visibilityAreaId ?? calendar?.areaId ?? personal?.areaId ?? PRIVATE;

  /*
   * 0079 — „TA I NASTĘPNE": ab diesem Vorkommen. So ändert eine Pfarrei ihre
   * Messzeiten („ab November um 17:00"); die ganze Reihe zu ändern schriebe
   * die vergangenen Messen um. Beim Gottesdienst ist es deshalb die Vorgabe,
   * sobald es Vorkommen davor gibt.
   */
  const hasEarlier = series !== undefined && occurrence !== undefined && repeating
    && new Date(occurrence.occurrenceAt).getTime() > new Date(series.startsAt).getTime();
  const [scope, setScope] = useState<Scope>(() => (hasEarlier && isLiturgy(occurrence?.kind) ? 'following' : 'all'));

  /* Ein Eintrag ohne eigenen Namen („Msza") bekommt ein leeres Feld — sonst hiesse er nach dem Speichern so. */
  const [title, setTitle] = useState(item !== undefined && !item.named ? '' : item?.title ?? (target.at === 'new' ? target.title ?? '' : ''));

  /* 0079 — WAS es ist. Vorher entschied das allein der Kalender — und jedes geänderte Ding wurde zum Treffen. */
  const [kind, setKind] = useState<ItemKind>(() => (occurrence?.kind as ItemKind | undefined) ?? calendar?.itemKind ?? 'appointment');

  /* 0070 — Teil welches Termins: `undefined` heisst „bleibt", `null` „keiner mehr". */
  const [parentItemId, setParentItemId] = useState<string | null | undefined>(
    target.at === 'new' ? target.parentItemId : undefined);
  const [location, setLocation] = useState(item?.location ?? parentItem?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  /* 0073 — „Więcej informacji": wohin, und was auf dem Knopf steht. */
  const [link, setLink] = useState(item?.link ?? parentItem?.link ?? '');
  const [linkLabel, setLinkLabel] = useState(item?.linkLabel ?? parentItem?.linkLabel ?? '');

  /*
   * Wer ihn sieht: was der Kalender sagt. Nur ein älterer Termin (oder beim
   * neuen Punkt: sein Ganzes), der es anders hat, behält das — 2026-10-24
   * wählt man es nicht mehr je Termin, man nimmt die Ausnahme nur zurück.
   */
  const seenFrom = occurrence ?? (parentItem?.occurrence.calendarId === calendarId ? parentItem.occurrence : undefined);
  const [visibility, setVisibility] = useState<string | null>(
    seenFrom !== undefined && seenFrom.visibilityAreaId !== defaultVisibility ? seenFrom.visibilityAreaId : null);
  const [allDay, setAllDay] = useState(target.at === 'new' ? target.allDay : target.event.allDay);

  /* Die Felder zeigen die Reihe, wenn „cała seria" gemeint ist, sonst dieses Vorkommen. Ein neuer dauert, wie sein Kalender sagt. */
  const initialEnd = target.at === 'new' && !target.allDay && calendar?.durationMinutes !== undefined
    ? new Date(start.getTime() + calendar.durationMinutes * 60_000) : (repeating ? seriesEnd : end);
  const followStart = occurrence !== undefined ? new Date(occurrence.occurrenceAt) : start;
  const followEnd = new Date(followStart.getTime() + (seriesEnd.getTime() - seriesStart.getTime()));
  const opening = scope === 'following' ? { s: followStart, e: followEnd } : repeating ? { s: seriesStart, e: initialEnd } : { s: start, e: initialEnd };
  const [date, setDate] = useState(localDate(opening.s));
  const [from, setFrom] = useState(localTime(opening.s));
  const [endDate, setEndDate] = useState(localDate(new Date(opening.e.getTime() - (allDay ? 1 : 0))));
  const [to, setTo] = useState(localTime(opening.e));
  const [endTouched, setEndTouched] = useState(target.at !== 'new');
  /* 2026-10-24 — der Tag des Endes steht nur da, wenn er ein anderer ist — oder wenn man ihn will. */
  const [endWanted, setEndWanted] = useState(false);
  const endShown = endWanted || endDate !== date;

  const [repeat, setRepeat] = useState<RepeatKind>(series?.repeatKind ?? 'none');
  const [every, setEvery] = useState(series?.repeatEvery ?? 1);
  /* „co 2 tygodnie" und ähnliches: unter „Inaczej…". */
  const [custom, setCustom] = useState((series?.repeatEvery ?? 1) > 1);
  /* 2026-10-24 — die Wochentage: die eigene Wahl; ohne sie der Tag des Termins (er wandert mit dem Datum). */
  const [ownWeekdays, setOwnWeekdays] = useState<number | null>(series?.repeatKind === 'weekly' ? series.repeatWeekdays ?? null : null);
  const weekdays = ownWeekdays ?? (date === '' ? bitOf(start) : bitOf(fromLocal(date, '12:00')));
  const [ends, setEnds] = useState<'never' | 'date' | 'count'>(
    series?.repeatCount != null ? 'count' : series?.repeatUntil != null && new Date(series.repeatUntil).getFullYear() - seriesStart.getFullYear() < 9 ? 'date' : 'never');
  const [until, setUntil] = useState(series?.repeatUntil != null ? localDate(new Date(series.repeatUntil)) : localDate(new Date(start.getTime() + 90 * 86400_000)));
  const [count, setCount] = useState(series?.repeatCount ?? 10);

  /* 0058 — fürs Reservieren: `null` heisst „wie der Kalender". */
  const [bookable, setBookable] = useState<boolean | null>(occurrence?.bookable ?? null);
  const [capacity, setCapacity] = useState<string>(occurrence?.capacity != null ? String(occurrence.capacity) : '');
  const [reserveArea, setReserveArea] = useState<string>(occurrence?.reserveAreaId ?? '');

  /* 0058 — wer da sein muss. */
  const candidates = useAreaPeople(me, isPrivate ? null : calendarArea);
  const [pinned, setPinned] = useState<readonly Pinned[]>(occurrence?.people ?? parentItem?.occurrence.people ?? []);
  const pinnedChanged = JSON.stringify(pinned) !== JSON.stringify(occurrence?.people ?? []);

  /* 2026-10-24 — was offen dasteht: was etwas enthält, und was man mit „+ …" dazugenommen hat. */
  const [opened, setOpened] = useState<ReadonlySet<Extra>>(() => new Set<Extra>([
    ...(location !== '' ? ['place' as const] : []),
    ...(notes !== '' ? ['notes' as const] : []),
    ...(pinned.length > 0 ? ['people' as const] : []),
    ...(link !== '' ? ['link' as const] : []),
    ...(parts.length > 0 ? ['program' as const] : [])
  ]));
  /* Das eben Dazugenommene bekommt den Fokus. */
  const [fresh, setFresh] = useState<Extra | null>(null);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * 0132 — DAS SCHEMA: eines dieses Kalenders (versiegelt, `calendarDocs.ts`) oder das
   * universelle. Ein neuer Termin bekommt das zuletzt in diesem Kalender gewählte, sonst
   * das erste — einmal je Kalender, danach entscheidet, wer schreibt.
   */
  const docs = useCalendarDocs(me.ring, calendarId === PRIVATE ? null : calendarId);
  const recentScheme = useRecent('calendar.scheme');
  const [schemeId, setSchemeId] = useState<string | null>(occurrence?.schemeId ?? null);
  const offeredFor = useRef<string | null>(item !== undefined ? calendarId : null);
  const scheme = schemeOf(docs?.schemes ?? [], schemeId);
  const universal = scheme.id === UNIVERSAL_ID;
  const kindOfScheme = (id: string | null) => {
    const found = schemeOf(docs?.schemes ?? [], id);
    return found.id === UNIVERSAL_ID ? calendar?.itemKind ?? 'appointment' : found.def.kind ?? 'appointment';
  };
  useEffect(() => {
    if (docs === null || offeredFor.current === calendarId) return;
    offeredFor.current = calendarId;
    const ids = docs.schemes.map((one) => one.docId);
    const pick = recentScheme.ids.find((id) => ids.includes(id)) ?? docs.schemes[0]?.docId ?? null;
    setSchemeId(pick);
    setKind(kindOfScheme(pick));
  }, [docs, calendarId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickScheme = (id: string | null) => {
    setSchemeId(id);
    setKind(kindOfScheme(id));
  };

  /* Die Felder des Schemas: am Termin, und — für einen einzelnen Tag — am Vorkommen. */
  const [fieldTexts, setFieldTexts] = useState<Readonly<Record<string, string>>>({});
  const [fieldsOpen, setFieldsOpen] = useState<ReadonlySet<string>>(new Set());
  const [freshField, setFreshField] = useState<string | null>(null);
  const textOf = (f: SchemeField, level: 'item' | 'day') =>
    fieldTexts[`${level}:${f.key}`] ?? editText(f, (level === 'item' ? item?.itemValues : item?.dayValues)?.get(f.key));
  const setText = (f: SchemeField, level: 'item' | 'day', text: string) => setFieldTexts((was) => ({ ...was, [`${level}:${f.key}`]: text }));

  const booking = isPrivate ? null : calendar?.booking ?? null;
  const bookableNow = bookable ?? booking?.mode === 'all';
  const onlyTime = item !== undefined && repeating && scope === 'one';
  const liturgy = !isPrivate && (scheme.def.publicTitle ?? isLiturgy(kind));
  const kinds = isPrivate ? [] : universal ? kindsFor(calendar?.itemKind, kind) : scheme.def.kinds ?? [];

  /* 0132 — welche Felder dastehen: was Pflicht ist oder etwas enthält, und was man dazunahm; der Rest als „+ …". */
  const itemFields = isPrivate ? [] : shownFields(scheme.def, kind, 'item');
  /* Tageswerte: an einem einzelnen Termin, an „ten termin" einer Reihe — und beim neuen am ersten Tag. */
  const dayHere = item === undefined || !repeating || scope === 'one';
  const dayFields = isPrivate || !dayHere ? [] : shownFields(scheme.def, kind, 'day');
  const fieldShown = (f: SchemeField, level: 'item' | 'day') =>
    f.required === true || fieldsOpen.has(`${level}:${f.key}`) || textOf(f, level) !== '';
  const fieldAdds = [
    ...(onlyTime ? [] : itemFields.filter((f) => !fieldShown(f, 'item')).map((f) => ({ f, level: 'item' as const }))),
    ...dayFields.filter((f) => !fieldShown(f, 'day')).map((f) => ({ f, level: 'day' as const }))
  ];
  const lists = item === undefined || isPrivate ? [] : shownLists(scheme.def, item.occurrence.kind);

  /* Was dazukommen kann: Menschen nur in einem Kalender einer Gruppe, ein Programm nur an einem gespeicherten Termin. */
  const peopleHere = !isPrivate && calendarArea !== null;
  const programHere = item !== undefined && item.editable && events !== undefined;
  const offered = EXTRAS.filter((x) => (x.key !== 'people' || peopleHere) && (x.key !== 'program' || programHere));
  const shows = (x: Extra) => opened.has(x) && offered.some((o) => o.key === x);
  /* Bei „ten termin" einer Reihe lässt sich nur die Zeit verschieben und festlegen, wer da sein muss. */
  const adds = offered.filter((x) => !opened.has(x.key) && (!onlyTime || x.key === 'people'));
  const add = (x: Extra) => {
    setOpened((was) => new Set(was).add(x));
    setFresh(x);
  };

  /* Nur dieses Vorkommen, diese und die folgenden, die ganze Reihe: die Felder zeigen, was gemeint ist. */
  const pickScope = (next: Scope) => {
    setScope(next);
    const base = next === 'one' ? { s: start, e: end } : next === 'following' ? { s: followStart, e: followEnd } : { s: seriesStart, e: seriesEnd };
    setDate(localDate(base.s)); setFrom(localTime(base.s));
    setEndDate(localDate(new Date(base.e.getTime() - (allDay ? 1 : 0)))); setTo(localTime(base.e));
  };

  /* Ein anderer Tag: das Ende rückt mit — ein mehrtägiger Termin bleibt so lang. */
  const moveDate = (next: string) => {
    if (next === '' || date === '' || endDate === '') { setDate(next); return; }
    const shift = Math.round((fromLocal(next, '12:00').getTime() - fromLocal(date, '12:00').getTime()) / 86400_000);
    setDate(next);
    setEndDate(localDate(addDays(fromLocal(endDate, '12:00'), shift)));
  };

  /* Ein anderer Beginn nimmt das Ende mit — die Dauer bleibt, wie in jedem Kalender. */
  const moveFrom = (next: string) => {
    if (next === '' || from === '' || to === '' || date === '' || endDate === '') { setFrom(next); return; }
    const was = fromLocal(date, from).getTime();
    const length = fromLocal(endDate, to).getTime() - was;
    setFrom(next);
    if (length <= 0) return;
    const endAt = new Date(fromLocal(date, next).getTime() + length);
    setEndDate(localDate(endAt));
    setTo(localTime(endAt));
  };

  /*
   * Ganztägig — und zurück zu Stunden. Stand darin nichts Brauchbares
   * (00:00–00:00, wie bei einem Klick in die Zeile „cały dzień"), beginnt er um
   * 9:00 und dauert, wie sein Kalender sagt.
   */
  const toggleAllDay = (on: boolean) => {
    setAllDay(on);
    if (on) {
      if (endDate < date) setEndDate(date);
      return;
    }
    if (date === '' || endDate === '') return;
    if (from !== '' && to !== '' && fromLocal(endDate, to).getTime() > fromLocal(date, from).getTime()) return;
    const at = fromLocal(date, from !== '' && from !== '00:00' ? from : '09:00');
    const endAt = new Date(at.getTime() + (calendar?.durationMinutes ?? 60) * 60_000);
    setFrom(localTime(at));
    setEndDate(localDate(endAt));
    setTo(localTime(endAt));
  };

  /* Ein anderer Kalender: seine Art (beim neuen), seine Dauer (solange das Ende nicht von Hand gesetzt wurde), seine Sichtbarkeit. */
  const pickCalendar = (next: string) => {
    /* Derselbe noch einmal: nichts — sonst fiele die Ausnahme der Sichtbarkeit eines älteren Termins still weg. */
    if (next === calendarId) return;
    setCalendarId(next);
    /* 0132 — Schemata gehören einem Kalender: im anderen gilt erst das universelle, bis dessen eigene da sind. */
    setSchemeId(null);
    const chosen = calendars.find((c) => c.calendarId === next);
    /* Ein neuer Eintrag ist, was sein Kalender führt (Msze → msza) — man kann es danach ändern. */
    if (item === undefined) setKind(chosen?.itemKind ?? 'appointment');
    if (!endTouched && !allDay && chosen?.durationMinutes !== undefined && date !== '' && from !== '') {
      const endAt = new Date(fromLocal(date, from).getTime() + chosen.durationMinutes * 60_000);
      setEndDate(localDate(endAt)); setTo(localTime(endAt));
    }
    setVisibility(null);
  };

  const repeatChoice: RepeatChoice = repeat === 'none' ? 'none' : custom ? 'custom' : repeat;
  const pickRepeat = (next: RepeatChoice) => {
    if (next === 'custom') {
      setCustom(true);
      if (repeat === 'none') setRepeat('weekly');
      return;
    }
    setCustom(false);
    setEvery(1);
    setRepeat(next);
  };
  const shownDay = date === '' ? start : fromLocal(date, '12:00');

  /* Gleich beim Tippen: endet er vor seinem Beginn? */
  const endBeforeStart = date !== '' && endDate !== '' && (allDay || (from !== '' && to !== ''))
    && (allDay ? endDate < date : fromLocal(endDate, to).getTime() <= fromLocal(date, from).getTime());

  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await todo();
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    if (date === '' || (!allDay && (from === '' || to === '')) || endDate === '') throw new WorkspaceError('Podaj dzień i godziny.');
    const startAt = allDay ? fromLocal(date, '00:00') : fromLocal(date, from);
    const endAt = allDay ? new Date(fromLocal(endDate, '00:00').getTime() + 86400_000) : fromLocal(endDate, to);
    const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
    if (minutes <= 0) throw new WorkspaceError('Koniec musi być po początku.');

    /* 0132 — was das Schema verlangt. */
    const missing = [...(onlyTime ? [] : itemFields.map((f) => ({ f, level: 'item' as const }))), ...dayFields.map((f) => ({ f, level: 'day' as const }))]
      .find(({ f, level }) => f.required === true && textOf(f, level).trim() === '');
    if (missing !== undefined) throw new WorkspaceError(`Uzupełnij: ${missing.f.label}.`);
    const dayTexts = Object.fromEntries(dayFields.map((f) => [f.key, textOf(f, 'day')]));
    const dayTouched = dayFields.some((f) => fieldTexts[`day:${f.key}`] !== undefined);
    const writeDay = async (itemId: string, occurrenceAt: string, areaId: string) => {
      if (!dayTouched) return;
      const newest = newestKey(await areaKeys(me.ring, areaId, true));
      if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
      await saveDayValues(itemId, occurrenceAt, newest, areaId, draftValues(dayFields, dayTexts));
    };

    if (item !== undefined && repeating && scope === 'one') {
      await moveOne(item.occurrence.itemId, item.occurrence.occurrenceAt, startAt);
      if (pinnedChanged) await setPeople(item.occurrence.itemId, pinned, item.occurrence.occurrenceAt);
      await writeDay(item.occurrence.itemId, item.occurrence.occurrenceAt, item.occurrence.visibilityAreaId);
      return;
    }

    /* „Tylko ja" ohne eigenen Kalender: der private Bereich (und sein Standardkalender) entsteht jetzt. */
    const privateArea = calendarId === PRIVATE ? await ensurePrivateArea(me.ring, me.person, areas) : null;
    const seenBy = privateArea ?? (visibility ?? (defaultVisibility === PRIVATE ? personal?.areaId ?? PRIVATE : defaultVisibility));
    if (calendarId !== PRIVATE) recent.touch(calendarId);

    const cap = capacity.trim() === '' ? null : Math.max(1, Number(capacity) || 1);
    const following = item !== undefined && repeating && scope === 'following' && hasEarlier;
    /* 0132 — die Werte am Termin: nur, wenn das Schema Felder hat oder der Termin Werte trug (sonst bleiben sie). */
    const schemeChanged = (occurrence?.schemeId ?? null) !== (schemeId ?? null);
    const itemValues = itemFields.length > 0 || (item?.itemValues.size ?? 0) > 0 || schemeChanged
      ? draftValues(itemFields, Object.fromEntries(itemFields.map((f) => [f.key, textOf(f, 'item')])))
      : undefined;
    if (!isPrivate && schemeId !== null) recentScheme.touch(schemeId);
    const id = await saveEvent(me.ring, {
      /* Im eigenen Kalender gibt es keinen Gottesdienst — sonst bleibt die Art, was sie ist (auch ein Zadanie). */
      kind: isPrivate && isLiturgy(kind) ? 'appointment' : kind,
      parentItemId: following ? null : parentItemId,
      origin: target.at === 'new' ? target.origin ?? undefined : undefined,
      title, location, notes, link, linkLabel, areaId: seenBy,
      ownerRoleId: me.person.id,
      date, time: from, minutes, allDay,
      repeat, every: repeat === 'none' ? 1 : every, weekdays,
      until: repeat === 'none' ? null : ends === 'never' ? forever(startAt) : ends === 'date' ? until : null,
      count: repeat !== 'none' && ends === 'count' ? count : null,
      calendarId: calendarId === PRIVATE ? undefined : calendarId,
      bookable: booking === null ? null : bookable,
      capacity: booking === null ? null : cap,
      reserveAreaId: booking === null || reserveArea === '' ? null : reserveArea,
      /* Nur, was sich ändert: ein neuer bekommt sein Schema, ein bestehender nur ein anderes. */
      schemeId: isPrivate ? (occurrence?.schemeId != null ? null : undefined) : item === undefined || schemeChanged ? schemeId : undefined,
      values: isPrivate ? (item !== undefined && item.itemValues.size > 0 ? [] : undefined) : itemValues,
      publicTitle: isPrivate ? false : scheme.def.publicTitle
    }, following ? undefined : item?.occurrence.itemId);

    /* Die Werte des Tages: am neuen sein erster Tag, sonst dieses Vorkommen („ten i następne": eine neue Reihe — nicht). */
    if (!following && !isPrivate) {
      await writeDay(id, item !== undefined ? item.occurrence.occurrenceAt : startAt.toISOString(), seenBy);
    }

    /*
     * „TA I NASTĘPNE": die neue Reihe steht; jetzt endet die alte vor diesem
     * Tag und gibt ab, was an ihren Vorkommen hängt. Lehnt der Dienst ab (einer
     * Intention fehlte die Messe), fällt die neue Reihe wieder weg — sie trägt
     * noch nichts.
     */
    if (following && item !== undefined) {
      try {
        await handover(item.occurrence.itemId, id, item.occurrence.occurrenceAt);
      } catch (e) {
        await deleteEvent(id).catch(() => undefined);
        throw e;
      }
    }

    if (pinnedChanged && !isPrivate) await setPeople(id, pinned);

    /* Das Ganze ist geändert — seine Punkte ziehen nach („ten i następne" ist eine neue Reihe: deren Punkte bleiben am alten Teil). */
    if (item !== undefined && !following && parts.length > 0) {
      const failed = await followParent(me.ring, item, parts, {
        calendarId: calendarId === PRIVATE ? item.occurrence.calendarId : calendarId,
        areaId: seenBy, location, link, linkLabel,
        people: isPrivate ? null : pinned,
        shift: repeating || repeat !== 'none' ? 0 : startAt.getTime() - seriesStart.getTime()
      });
      if (failed > 0) throw new WorkspaceError(`Termin zapisany, ale ${failed} z ${parts.length} punktów programu nie udało się zmienić razem z nim.`);
    }
  });

  /* 0079 — die Reihe vor diesem Tag beenden: „od tego dnia już nie" (`endSeriesBefore`). */
  const endBefore = () => run(async () => {
    if (item !== undefined) await endSeriesBefore(me.ring, item);
  });

  const remove = async () => {
    if (item === undefined) return;
    if (repeating && scope === 'following' && hasEarlier) {
      if (await askText('Zakończyć serię przed tym dniem? Wcześniejsze terminy zostają.')) void endBefore();
      return;
    }
    const one = repeating && scope === 'one';
    if (!(await askText(one ? 'Odwołać tylko ten termin?' : 'Usunąć ten termin (całą serię)?'))) return;
    void run(() => one ? cancelOne(item.occurrence.itemId, item.occurrence.occurrenceAt) : deleteEvent(item.occurrence.itemId));
  };

  /* Die Kalender zur Wahl — „Tylko ja" zuerst; der eigene, falls er (archiviert, ausserhalb des Bausteins) nicht dabei ist, auch. */
  const calendarOptions = [
    ...(offerPrivate ? [{ value: PRIVATE, label: 'Tylko ja', mine: true }] : []),
    ...privateCals.map((c) => ({ value: c.calendarId, label: privateCals.length === 1 ? 'Tylko ja' : calendarLabel(areas, c), mine: true })),
    ...groupCals.map((c) => ({ value: c.calendarId, label: calendarLabel(areas, c), mine: false }))
  ];
  if (calendar !== undefined && !calendarOptions.some((o) => o.value === calendarId)) {
    calendarOptions.unshift({ value: calendarId, label: calendarLabel(areas, calendar), mine: calendar.areaId === personal?.areaId });
  }

  const heading = item === undefined ? (NEW_TITLE[kind] ?? 'Nowy termin')
    : kind === 'appointment' || kind === 'task' ? 'Termin' : capital(ITEM_LABEL[kind] ?? 'termin');

  return (
    <Modal title={heading} onClose={onClose}>
      {/* 0079/0132 — was an DIESEM Vorkommen steht (die Intentionen einer Messe, Anmeldungen …), hier und nicht in einer anderen Ansicht. */}
      {item !== undefined && lists.length > 0 && (
        <RecordsPanel me={me} item={item} start={start} calendar={calendar} lists={lists} writer onChanged={onSaved} />
      )}

      <form className="wk-form wk-ev-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {repeating && (
          <div className="wk-ev-scoperow">
            <span className="wk-ev-scope-q">Zmieniasz</span>
            <div className="wk-seg" role="group" aria-label="Co zmieniasz">
              {SCOPES.filter((one) => one.value !== 'following' || hasEarlier).map((one) => (
                <button key={one.value} type="button" aria-pressed={scope === one.value}
                  className={scope === one.value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => pickScope(one.value)}>{one.label}</button>
              ))}
            </div>
          </div>
        )}
        {scope === 'following' && hasEarlier && (
          <p className="wk-note">Od tego dnia — wcześniejsze terminy zostają, jak były. Intencje, obsada i zapisy przechodzą na nowe godziny według dnia.</p>
        )}
        {scope === 'all' && repeating && liturgy && hasEarlier && (
          <p className="wk-warn">Zmieniasz całą serię — także terminy, które już były. Zwykle właściwe jest „Ten i następne”.</p>
        )}

        {/* 0079 — was es ist: nur, wo der Kalender mehr als Treffen führt (Msze: msza, spowiedź, nabożeństwo). */}
        {!onlyTime && kinds.length > 1 && (
          <div className="wk-seg wk-ev-kinds" role="group" aria-label="Rodzaj">
            {kinds.map((one) => (
              <button key={one} type="button" aria-pressed={kind === one} className={kind === one ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                onClick={() => setKind(one)}>{capital(ITEM_LABEL[one])}</button>
            ))}
          </div>
        )}

        <input className="wk-ev-name" value={title} disabled={onlyTime} maxLength={200}
          aria-label={liturgy ? 'Nazwa (widoczna publicznie)' : 'Tytuł'}
          list={kind === 'devotion' ? 'wk-devotion-names' : undefined}
          placeholder={kind === 'mass' ? 'Nazwa, np. Suma — puste: sama godzina' : kind === 'devotion' ? 'Nazwa, np. Różaniec'
            : kind === 'confession' ? 'Nazwa — puste: „Spowiedź”' : 'Tytuł, np. Spotkanie z rodzicami'}
          onChange={(e) => setTitle(e.target.value)} />
        {kind === 'devotion' && <datalist id="wk-devotion-names">{DEVOTION_NAMES.map((n) => <option key={n} value={n} />)}</datalist>}
        {liturgy && !onlyTime && <p className="wk-hint">Nazwa jest jawna — stoi w planie i w gablocie. Miejsce i notatka zostają zaszyfrowane.</p>}

        {/* KIEDY — der Tag, von–bis; der Tag des Endes nur, wenn er ein anderer ist. */}
        <div className="wk-ev-row">
          <Icon name="clock" />
          <div className="wk-ev-body">
            <div className="wk-ev-times">
              <input type="date" aria-label={allDay && endShown ? 'Od dnia' : 'Dzień'} value={date} onChange={(e) => moveDate(e.target.value)} />
              {!allDay && <input type="time" aria-label="Początek" step={300} value={from} onChange={(e) => moveFrom(e.target.value)} />}
              {(!allDay || endShown) && <span className="wk-ev-dash" aria-hidden="true">–</span>}
              {endShown && (
                <input type="date" aria-label={allDay ? 'Do dnia' : 'Dzień końca'} min={date} value={endDate} disabled={onlyTime}
                  onChange={(e) => { setEndDate(e.target.value); setEndTouched(true); setEndWanted(true); }} />
              )}
              {!allDay && (
                <input type="time" aria-label="Koniec" step={300} value={to} disabled={onlyTime}
                  onChange={(e) => { setTo(e.target.value); setEndTouched(true); }} />
              )}
            </div>
            {!onlyTime && (
              <div className="wk-ev-opts">
                <label className="wk-check">
                  <input type="checkbox" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
                  <span>Cały dzień</span>
                </label>
                {!endShown && (
                  <button type="button" className="wk-link-btn" onClick={() => setEndWanted(true)}>{allDay ? 'Kilka dni' : 'Kończy się innego dnia'}</button>
                )}
              </div>
            )}
            {endBeforeStart && <p className="wk-error">Koniec musi być po początku.</p>}
          </div>
        </div>

        {/* POWTARZANIE — die üblichen Abstände; „Inaczej…": co N dni / tygodni / miesięcy / lat. */}
        {!onlyTime && (
          <div className="wk-ev-row">
            <Icon name="refresh" />
            <div className="wk-ev-body">
              <select aria-label="Powtarzanie" value={repeatChoice} onChange={(e) => pickRepeat(e.target.value as RepeatChoice)}>
                <option value="none">Nie powtarza się</option>
                <option value="daily">Codziennie</option>
                <option value="weekly">Co tydzień</option>
                <option value="monthly">Co miesiąc, {shownDay.getDate()}. dnia</option>
                <option value="yearly">Co rok, {shownDay.getDate()} {monthOfName(shownDay)}</option>
                <option value="custom">Inaczej…</option>
              </select>
              {repeatChoice === 'custom' && (
                <div className="wk-ev-inline">
                  <span>co</span>
                  <input type="number" min={1} max={52} aria-label="Co ile" value={every}
                    onChange={(e) => setEvery(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />
                  <select aria-label="Jednostka" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
                    <option value="daily">{plural(every, 'dzień', 'dni', 'dni')}</option>
                    <option value="weekly">{plural(every, 'tydzień', 'tygodnie', 'tygodni')}</option>
                    <option value="monthly">{plural(every, 'miesiąc', 'miesiące', 'miesięcy')}</option>
                    <option value="yearly">{plural(every, 'rok', 'lata', 'lat')}</option>
                  </select>
                </div>
              )}
              {repeat === 'weekly' && <Weekdays value={weekdays} onChange={setOwnWeekdays} />}
              {repeat !== 'none' && (
                <div className="wk-ev-inline">
                  <select aria-label="Do kiedy" value={ends} onChange={(e) => setEnds(e.target.value as typeof ends)}>
                    <option value="never">bez końca</option>
                    <option value="date">do dnia…</option>
                    <option value="count">tyle razy…</option>
                  </select>
                  {ends === 'date' && <input type="date" aria-label="Ostatni dzień" min={date} value={until} onChange={(e) => setUntil(e.target.value)} />}
                  {ends === 'count' && (
                    <>
                      <input type="number" min={1} max={999} aria-label="Ile razy" value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
                      <span>{plural(count, 'raz', 'razy', 'razy')}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* KALENDARZ — er sagt, wer den Termin sieht (0058). */}
        {!onlyTime && (
          <div className="wk-ev-row">
            <Icon name="calendar" />
            <div className="wk-ev-body">
              {calendarOptions.length <= 1 ? (
                <p className="wk-ev-calname">{calendarOptions[0]?.label ?? 'Tylko ja'}</p>
              ) : calendarOptions.length <= CHIP_CALENDARS ? (
                <div className="wk-ev-cals" role="group" aria-label="Kalendarz">
                  {calendarOptions.map((o) => (
                    <button key={o.value} type="button" className="wk-ev-cal" aria-pressed={o.value === calendarId} onClick={() => pickCalendar(o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <select aria-label="Kalendarz" value={calendarId} onChange={(e) => pickCalendar(e.target.value)}>
                  {calendarOptions.some((o) => o.mine) && (
                    <optgroup label="Tylko ja">
                      {calendarOptions.filter((o) => o.mine).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                  )}
                  {calendarOptions.some((o) => !o.mine) && (
                    <optgroup label="Kalendarze grup">
                      {calendarOptions.filter((o) => !o.mine).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                  )}
                </select>
              )}
              <p className="wk-ev-seen">
                {isPrivate ? 'Widzisz tylko Ty — zaszyfrowane Twoim kluczem.' : (
                  <>
                    Widzą: <strong>{groupName(areas, visibility ?? defaultVisibility)}</strong>
                    {visibility !== null && (
                      <> — inaczej niż kalendarz · <button type="button" className="wk-link-btn" onClick={() => setVisibility(null)}>
                        jak w kalendarzu ({groupName(areas, defaultVisibility)})
                      </button></>
                    )}
                  </>
                )}
              </p>
              {calendar?.description && <p className="wk-ev-rules">{calendar.description}</p>}
            </div>
          </div>
        )}

        {/* 0132 — DAS SCHEMA dieses Kalenders: was der Termin ist und welche Felder er hat. */}
        {!onlyTime && !isPrivate && (docs?.schemes.length ?? 0) > 0 && (
          <div className="wk-ev-row">
            <Icon name="layers" />
            <div className="wk-ev-body">
              <div className="wk-ev-cals" role="group" aria-label="Schemat">
                {[{ docId: null as string | null, name: 'Uniwersalny' }, ...docs!.schemes.map((one) => ({ docId: one.docId as string | null, name: one.def.name }))].map((one) => (
                  <button key={one.docId ?? UNIVERSAL_ID} type="button" className="wk-ev-cal" aria-pressed={(schemeId ?? null) === one.docId}
                    onClick={() => pickScheme(one.docId)}>{one.name}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {((!onlyTime && itemFields.some((f) => fieldShown(f, 'item'))) || dayFields.some((f) => fieldShown(f, 'day'))) && (
          <div className="wk-ev-row">
            <Icon name="list" />
            <div className="wk-ev-body wk-sc-fields">
              {!onlyTime && itemFields.filter((f) => fieldShown(f, 'item')).map((f) => (
                <label key={`item:${f.key}`} className="wk-sc-field">
                  <span>{f.label}{f.required ? ' *' : ''}</span>
                  <SchemeInput field={f} value={textOf(f, 'item')} people={candidates} autoFocus={freshField === `item:${f.key}`}
                    onChange={(v) => setText(f, 'item', v)} />
                </label>
              ))}
              {dayFields.filter((f) => fieldShown(f, 'day')).map((f) => (
                <label key={`day:${f.key}`} className="wk-sc-field">
                  <span>{f.label}{f.required ? ' *' : ''}{repeating ? ' (ten dzień)' : ''}</span>
                  <SchemeInput field={f} value={textOf(f, 'day')} people={candidates} autoFocus={freshField === `day:${f.key}`}
                    onChange={(v) => setText(f, 'day', v)} />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 0058 — reservieren: nur in einem Kalender, der Reservierungen führt. */}
        {!onlyTime && booking !== null && (
          <div className="wk-ev-row">
            <Icon name="bookmark" />
            <div className="wk-ev-body">
              <label className="wk-check">
                <input type="checkbox" checked={bookableNow}
                  onChange={(e) => setBookable(e.target.checked === (booking.mode === 'all') ? null : e.target.checked)} />
                <span>Można rezerwować</span>
              </label>
              {bookableNow && (
                <div className="wk-ev-inline">
                  <label className="wk-ev-mini">
                    <span>Miejsc</span>
                    <input type="number" min={1} max={10000} value={capacity} placeholder={String(booking.capacity)}
                      onChange={(e) => setCapacity(e.target.value)} />
                  </label>
                  <AreaPick
                    label="Kto może rezerwować" value={reserveArea} onChange={setReserveArea}
                    areas={areas} only={areas.filter((a) => a.personal !== true)}
                    extras={[{ value: '', label: `rezerwuje: jak w kalendarzu (${booking.reserveAreaId === null ? 'każdy, kto znajdzie termin' : groupName(areas, booking.reserveAreaId)})` }]}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Was dazugenommen wurde — in fester Reihenfolge. */}
        {!onlyTime && shows('place') && (
          <div className="wk-ev-row">
            <Icon name="place" />
            <input aria-label="Miejsce" value={location} maxLength={300} placeholder="Miejsce, np. salka parafialna" autoFocus={fresh === 'place'}
              onChange={(e) => setLocation(e.target.value)} />
          </div>
        )}

        {!onlyTime && shows('notes') && (
          <div className="wk-ev-row">
            <Icon name="compose" />
            <textarea aria-label="Notatka" rows={3} value={notes} placeholder="Notatka" autoFocus={fresh === 'notes'}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        {shows('people') && (
          <div className="wk-ev-row">
            <Icon name="users" />
            <div className="wk-ev-body">
              <span className="wk-ev-label">{peopleWord(kind)}{onlyTime ? ' — ten termin' : ''}</span>
              <PeoplePicker me={me} candidates={candidates} value={pinned} onChange={setPinned} defaultDuty={dutyOf(kind)} />
            </div>
          </div>
        )}

        {!onlyTime && shows('link') && (
          <div className="wk-ev-row">
            <Icon name="link" />
            <div className="wk-ev-body wk-ev-link">
              <input type="text" inputMode="url" autoComplete="url" spellCheck={false} aria-label="Link do informacji" value={link} maxLength={1000}
                placeholder="https://… albo #/strona na recreatio.pl" autoFocus={fresh === 'link'} onChange={(e) => setLink(e.target.value)} />
              <input aria-label="Napis na przycisku" value={linkLabel} maxLength={60} placeholder="Napis: Więcej informacji" disabled={link.trim() === ''}
                onChange={(e) => setLinkLabel(e.target.value)} />
              {link.trim() !== '' && safeLink(link) === null && <p className="wk-warn">Link musi zaczynać się od https:// (albo #/ dla strony na recreatio.pl).</p>}
            </div>
          </div>
        )}

        {/* 0070 — die Punkte des Programms (nur an einem gespeicherten Termin). */}
        {!onlyTime && shows('program') && item !== undefined && events !== undefined && (
          <div className="wk-ev-row">
            <Icon name="list" />
            <ProgramOf
              itemId={item.occurrence.itemId}
              start={fromLocal(date || localDate(start), allDay || from === '' ? '00:00' : from)}
              end={allDay || to === '' || endDate === '' ? undefined : fromLocal(endDate, to)}
              events={events}
              parentId={parentItemId === undefined ? item.occurrence.parentItemId ?? null : parentItemId}
              onQuickAdd={async (partTitle, at, minutes) => {
                /* Der Punkt teilt alles mit dem Ganzen, wie es gespeichert ist — nur Name und Zeit sind seine. */
                const id = await saveEvent(me.ring, {
                  ...draftOf(item), kind: 'appointment', title: partTitle, notes: '', schemeId: null, values: undefined, publicTitle: undefined,
                  date: localDate(at), time: localTime(at), minutes, allDay: false,
                  repeat: 'none', every: 1, weekdays: 0, until: null, count: null,
                  parentItemId: item.occurrence.itemId
                });
                const people = item.occurrence.people ?? [];
                if (people.length > 0) await setPeople(id, people);
                onSaved();
              }}
              onOpen={onOpenPart}
              onLink={async (child) => {
                try { await setProgramParent(child, item.occurrence.itemId); onSaved(); }
                catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się podłączyć terminu.'); }
              }}
              onUnlink={async (child) => {
                try { await setProgramParent(child, null); onSaved(); }
                catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się odłączyć terminu.'); }
              }} />
          </div>
        )}

        {/* 0070 — ein Punkt eines Programms: woran er hängt; 2026-10-24 — und „odłącz" statt der Wahl „Część programu". */}
        {target.at === 'new' && target.parentItemId !== undefined && parentItemId === target.parentItemId && (
          <p className="wk-note">
            Punkt programu: <strong>{target.parentTitle ?? 'termin nadrzędny'}</strong> — kalendarz, widoczność, miejsce, link i osoby
            są wspólne z nim. Zmień tutaj tylko to, co w tym punkcie ma być inaczej.
          </p>
        )}
        {!onlyTime && item !== undefined && item.occurrence.parentItemId != null && (parentItemId === null ? (
          <p className="wk-note">
            Po zapisaniu ten termin nie będzie już punktem programu.{' '}
            <button type="button" className="wk-link-btn" onClick={() => setParentItemId(undefined)}>Cofnij</button>
          </p>
        ) : (
          <p className="wk-note">
            Punkt programu: <strong>{ownParent?.title ?? 'termin spoza widoku'}</strong> — to, co ma tak samo jak on, zmienia się razem z nim.{' '}
            <button type="button" className="wk-link-btn" onClick={() => setParentItemId(null)}>Odłącz</button>
          </p>
        ))}
        {target.at === 'new' && target.origin !== undefined && (
          <p className="wk-note">Z rozmowy — termin zapamięta, z której wiadomości powstał.</p>
        )}
        {onlyTime && (
          <p className="wk-note">Przesuwasz tylko ten jeden termin — reszta serii zostaje, jak była. Rezerwacje przechodzą razem z nim.</p>
        )}

        {/* 2026-10-24 — was noch dazukommen kann. */}
        {(adds.length > 0 || fieldAdds.length > 0) && (
          <div className="wk-ev-adds" role="group" aria-label="Dodaj do terminu">
            {adds.map((x) => (
              <button key={x.key} type="button" className="wk-ev-add" aria-label={`Dodaj: ${x.label}`} onClick={() => add(x.key)}>
                <span aria-hidden="true">+</span> {x.label}
              </button>
            ))}
            {fieldAdds.map(({ f, level }) => (
              <button key={`${level}:${f.key}`} type="button" className="wk-ev-add" aria-label={`Dodaj: ${f.label}`}
                onClick={() => { setFieldsOpen((was) => new Set(was).add(`${level}:${f.key}`)); setFreshField(`${level}:${f.key}`); }}>
                <span aria-hidden="true">+</span> {f.label}
              </button>
            ))}
          </div>
        )}

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>Anuluj</button>
          {item !== undefined && (
            <button type="button" className="wk-link-btn wk-danger wk-ev-delete" disabled={busy} onClick={remove}>
              {repeating && scope === 'one' ? 'Odwołaj ten termin' : repeating && scope === 'following' && hasEarlier ? 'Zakończ serię przed tym dniem' : 'Usuń'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Was das Ganze nach dem Speichern sagt — `people: null`: dort niemanden (privat). */
interface ParentNow {
  readonly calendarId: string;
  readonly areaId: string;
  readonly location: string;
  readonly link: string;
  readonly linkLabel: string;
  readonly people: readonly Pinned[] | null;
  /** Um wie viel das Ganze (ein einzelner Termin) verschoben wurde — einzelne Punkte rücken mit. */
  readonly shift: number;
}

/**
 * 2026-10-17 — DIE PUNKTE ZIEHEN DEM GANZEN NACH. Ein Feld eines Punktes
 * folgt, wenn es vorher dasselbe war wie beim Ganzen; was ein Punkt anders
 * hat, bleibt. Punkte, die ich nicht ändern darf, bleiben, wie sie sind.
 * Gibt zurück, wie viele nicht gingen.
 */
async function followParent(ring: Ring, before: OpenedItem, parts: readonly OpenedItem[], now: ParentNow): Promise<number> {
  const was = before.occurrence;
  const samePeople = (a: readonly Pinned[] | undefined, b: readonly Pinned[] | undefined) =>
    JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  let failed = 0;

  for (const part of parts) {
    if (!part.editable) continue;
    const draft = draftOf(part);
    const next = {
      ...draft,
      calendarId: part.occurrence.calendarId === was.calendarId ? now.calendarId : draft.calendarId,
      areaId: part.occurrence.visibilityAreaId === was.visibilityAreaId ? now.areaId : draft.areaId,
      location: (part.location ?? '') === (before.location ?? '') ? now.location : draft.location,
      link: (part.link ?? '') === (before.link ?? '') ? now.link : draft.link,
      linkLabel: (part.linkLabel ?? '') === (before.linkLabel ?? '') ? now.linkLabel : draft.linkLabel
    };
    if (now.shift !== 0 && part.occurrence.series.repeatKind === 'none') {
      const at = new Date(new Date(part.occurrence.series.startsAt).getTime() + now.shift);
      next.date = localDate(at);
      next.time = localTime(at);
    }

    try {
      if (JSON.stringify(next) !== JSON.stringify(draft)) await saveEvent(ring, next, part.occurrence.itemId);
      if (now.people !== null && samePeople(part.occurrence.people, was.people) && !samePeople(now.people, was.people)) {
        await setPeople(part.occurrence.itemId, now.people);
      }
    } catch {
      failed += 1;
    }
  }
  return failed;
}
