/**
 * DER EIGENE KALENDER (0054) — alles, was ich sehe, an einer Stelle, und so
 * zu bedienen, wie man es aus jedem Kalender kennt.
 *
 * <code>
 *   Dzień · Tydzień   ein Stundenraster; ein Klick in eine leere Stunde legt
 *                     dort einen Termin an, ein Klick auf einen Termin öffnet ihn
 *   Miesiąc           das Monatsblatt; ein Klick auf einen Tag öffnet diesen Tag
 *   Lista             die nächsten dreissig Tage, der Reihe nach
 * </code>
 *
 * <b>Was hier steht</b>: die Termine jeder Gruppe, deren Schlüssel ich halte
 * (auch Messen, wenn ich eine solche Gruppe halte), meine Buchungen — jede
 * Gruppe in ihrer eigenen Farbe, und jede lässt sich ausblenden. Welche
 * Ansicht und welche Gruppen, merkt sich der Arbeitsplatz (versiegelt, `prefs.ts`).
 *
 * <b>Die Termine sind die Hauptsache</b> (0057). Aufgaben stehen daneben, nicht
 * darin: als schmale Schiene am Rand jedes Tages (wann ein Fenster offen ist)
 * und als eine Zeile „zadania" mit dem Stand des Tages — ein Klick darauf,
 * und die Liste des Tages zum Abhaken geht auf (`TaskDay.tsx`). Ganz
 * ausblenden lassen sie sich auch.
 *
 * <b>Wer die Breite hat, entscheidet ein Klick</b> (2026-10-17). Ein Klick auf
 * die Schiene der Aufgaben (oder ihre Pille, oder „zadania") gibt ihnen den
 * Tag: sie stehen als Kästen im Raster, mit Häkchen und „pomiń", und die
 * Termine werden zur Schiene am rechten Rand — ein Klick darauf tauscht
 * zurück. Ein Klick ins Leere legt dann eine Aufgabe an, keinen Termin; die
 * Pille öffnet dann die Liste des Tages. Im Raster stehen nur die Aufgaben
 * mit ihrer Stunde; was von früher liegen blieb, zeigt die Liste.
 *
 * <b>Mehrere Termine zugleich</b> (2026-10-17): ein Rechteck mit der Maus,
 * ein langer Druck mit dem Finger, oder Strg + Klick wählt Termine — über das
 * Blättern hinweg; dann: ausschneiden / kopieren und auf einen Tag oder eine
 * Stunde einfügen, ziehen und fallen lassen, löschen, Serien beenden,
 * verschieben (`EventPick.tsx`, `usePickGestures.ts`). Blättern geht auch
 * mit ← → und mit einem Wisch über das Raster.
 *
 * <b>Reservierungen stehen am Termin</b> (0057): an einem angebotenen Termin,
 * wie viele Plätze besetzt sind und wer wartet; ein Klick zeigt die
 * Kandidaten und lässt die Kanzlei entscheiden (`ReservationDialog.tsx`).
 * Was irgendwo auf ein Ja wartet, sammelt „Do potwierdzenia".
 */

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { loadAgenda, openAgenda, type AgendaClaim, type OpenedItem } from './agenda';
import { loadAreas, type AreaRow } from '../areas/area';
import {
  holderName, loadBookings, NO_BOOKINGS, waitingOn, waitsForOffice, type AgendaBookings
} from './calendarBookings';
import {
  buildEvents, hueOf, laneDay, linkOfEvent, marksOn, monthsRange, treeOrder, onDay as happensOn, placeDay, railDay, settled, stepView, taskMarks, viewRange,
  wholeDay, type CalEvent, type CalView, type Laned, type Placed, type TaskMark
} from './calendarModel';
import { addDays, addMonths, firstOfMonth, fromKey, keyOf, longDate, monthOfName, monthTitle, rangeTitle, sameDay, startOfDay, WEEK_HEADS, weekdayName } from '../core/dayMath';
import { CALENDAR_KIND_LABEL, loadCalendars, type CalendarRow } from './calendar';
import { CalendarSettings } from './CalendarSettings';
import { calendarLabel } from './calendarLabel';
import type { EventTarget } from './EventDialog';
import { pasteClip, pickable, PickBar, tellPasted, terms, usePickActions, type Clip, type PasteAt } from './EventPick';
import { usePickGestures } from './usePickGestures';
import { ItemLink } from './ItemLink';
import { intentionsWord } from '../masses/mass';
import { useNow } from '../masses/MassParts';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/dialogs';
import { useMe, type Me } from '../core/me';
import { useRemembered } from '../core/prefs';
import { ReservationDialog, WaitingDialog } from '../bookings/ReservationDialog';
import type { Who } from '../core/session';
import { WorkspaceError } from '../core/session';
import { mayTick, maySkip, stateOf, TaskDay, TaskPill, toggleMark, whenOf } from './TaskDay';
/* 2026-10-17 — die Dialoge erst, wenn einer aufgeht: ein Kalender auf einer öffentlichen Seite lud beide mit. */
const EventDialog = lazy(() => import('./EventDialog').then((m) => ({ default: m.EventDialog })));
const TaskDialog = lazy(() => import('./TaskDialog').then((m) => ({ default: m.TaskDialog })));
import { loadTasks, markSkipped, openTasks, type OpenTask } from './tasks';
import { groupName } from '../areas/WhoSees';
import { Loading } from '../ui/Loading';

const VIEWS: readonly { value: CalView; label: string }[] = [
  { value: 'day', label: 'Dzień' }, { value: 'week', label: 'Tydzień' },
  { value: 'month', label: 'Miesiąc' }, { value: 'list', label: 'Lista' }
];

/** Wie hoch eine Stunde im Raster ist — von Haus aus. */
const HOUR = 48;

/** 2026-10-17 — die Stufen des Zoomens: so hoch darf eine Stunde sein (px). */
const HOURS = [24, 32, 40, 48, 64, 80, 96, 128] as const;

/** 2026-10-17 — was ausgeschnitten im Schoss liegt: blass, bis es eingefügt ist. */
const CutKeys = createContext<ReadonlySet<string>>(new Set());

/** Die Höhe einer Stunde, für alles, was im Raster steht (Schienen, Kästen). */
const HourHeight = createContext<number>(HOUR);

/** 0074 — die Kopfzeile eines Termins mit Teilen (20 px), in Minuten des Rasters: so weit rücken seine Teile, die mit ihm beginnen, nach unten. */
const partHead = (hour: number) => (20 / hour) * 60;

/**
 * 2026-10-17 — TEILE NEBEN IHREM GANZEN: ab so breiten Tagesspalten (px) steht
 * ein Termin mit Teilen als Streifen links (SIDE_INSET seiner Breite, mit Zeit
 * und Titel), seine Teile rechts daneben, jeder genau zu seiner Zeit. Schmaler
 * (die Woche, das Telefon): eine Kopfzeile oben, die Teile darunter.
 */
const SIDE_MIN = 420;
const SIDE_INSET = 0.3;

/** Höher als so viele Pixel: ein Termin hat Platz für eine zweite Zeile. */
const TALL = 36;

/** Wie viele Monate sich im Monatsblatt höchstens aufdecken lassen (der Dienst liefert höchstens 400 Tage). */
const MAX_MORE = 10;

/** Wie breit die Schiene der Aufgaben am Rand eines Tages ist. */
const RAIL = 13;

/** 2026-10-17 — wie breit die Termine als Schiene sind, wenn die Aufgaben den Tag haben. */
const EVENT_RAIL = 30;

/** Rechts in der Schiene bleibt so viel frei: dort liegt der Rollbalken des Rasters (über dem Inhalt, wo er schwebt). */
const SCROLL_GAP = 12;

/** Wie breit die Striche der Termine nebeneinander stehen dürfen. */
const RAIL_SPAN = EVENT_RAIL - SCROLL_GAP - 4;

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/**
 * `trail`: 0079 — `#/workspace/calendar/2026-10-05` schlägt den Kalender an diesem
 * Tag auf (aus „Msze i intencje": „W kalendarzu").
 */
export function CalendarApp({ who, trail = [] }: { who: Who; trail?: readonly string[] }) {
  const me = useMe(who);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(trail[0] ?? '') ? new Date(`${trail[0]}T00:00:00`) : undefined;

  if (me === undefined) return <Loading label="Wczytywanie…" />;
  if (me === null) {
    return <p className="wk-note">Bez klucza w tej karcie kalendarz jest zamknięty — zaloguj się ponownie albo odblokuj klucz.</p>;
  }

  return <Calendar key={trail[0] ?? ''} me={me} at={day} />;
}

interface Loaded {
  readonly from: number;
  readonly to: number;
  readonly items: readonly OpenedItem[];
  readonly claims: readonly AgendaClaim[];
  readonly tasks: readonly OpenTask[];
  readonly bookings: AgendaBookings;
  readonly calendars: readonly CalendarRow[];
}

/**
 * DER KALENDER — im Arbeitsplatz über alles, was ich sehe; als Baustein einer
 * Seite (0058, `scope`) nur über die Kalender, die der Baustein zeigt. Dann
 * gibt es keine Aufgaben und keine eigenen Buchungen darin, und neue Termine
 * gehen nur in diese Kalender.
 */
export function Calendar({ me, scope, startNew, at }: {
  me: Me;
  scope?: readonly string[];

  /** Aufschlagen an diesem Tag — statt heute. */
  at?: Date;

  /** Einmal gefragt, sobald die Kalender da sind: gleich einen neuen Termin aufmachen? („+ Termin" auf der Kachel einer Seite.) */
  startNew?: () => boolean;
}) {
  const scoped = scope !== undefined;
  /* 2026-10-17 — auf dem Telefon passen sieben Spalten nicht: ohne eigene Wahl beginnt es dort mit der Liste. */
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 40rem)').matches === true;
  const [viewText, setViewText] = useRemembered(scoped ? 'calendar.part.view' : 'calendar.view', narrow ? 'list' : 'week');
  /*
   * 0074 — WAS AUSGEBLENDET IST, GILT NUR HIER. Ein Baustein auf einer Seite
   * merkt sich seine eigene Auswahl (je Satz Kalender): wer im Arbeitsplatz
   * einen Kalender abwählt, soll ihn auf der Seite der Gruppe nicht verlieren.
   */
  const scopeKey = scoped ? [...scope].map((id) => id.slice(0, 8)).sort().join('.') : '';
  const [hiddenText, setHiddenText] = useRemembered(scoped ? `calendar.part.hidden.${scopeKey}` : 'calendar.hiddenCals', '');
  const [tasksText, setTasksText] = useRemembered('calendar.tasks', 'on');
  /* 2026-10-17 — wer im Raster die Breite hat: `events` (Aufgaben als Schiene) oder `tasks` (Termine als Schiene). */
  const [focusText, setFocusText] = useRemembered('calendar.focus', 'events');
  const [mineText, setMineText] = useRemembered(scoped ? `calendar.part.mine.${scopeKey}` : 'calendar.mine', 'off');
  const view: CalView = (['day', 'week', 'month', 'list'] as const).includes(viewText as CalView) ? viewText as CalView : 'week';
  const hidden = new Set(hiddenText.split(',').filter((one) => one !== ''));
  const tasksShown = tasksText !== 'off' && !scoped;
  const mineOnly = mineText === 'on';
  const [settings, setSettings] = useState<CalendarRow | 'new' | null>(null);
  const [calendarsOpen, setCalendarsOpen] = useState(false);

  const [anchor, setAnchor] = useState(() => startOfDay(at ?? new Date()));
  /* 2026-10-17 — der Tag, von dem aus ins Monatsblatt gewechselt wurde: dort umrandet. */
  const [markDay, setMarkDay] = useState<Date | null>(null);
  /* 2026-10-17 — wie hoch eine Stunde ist (Zoom), gemerkt. */
  const [hourText, setHourText] = useRemembered('calendar.hour', String(HOUR));
  const hour = (HOURS as readonly number[]).includes(Number(hourText)) ? Number(hourText) : HOUR;
  const zoom = (direction: 1 | -1) => {
    const at = (HOURS as readonly number[]).indexOf(hour);
    setHourText(String(HOURS[Math.max(0, Math.min(HOURS.length - 1, at + direction))]));
  };
  /* 2026-10-17 — im Monatsblatt aufgedeckte Monate davor/danach; gelten nur für den Monat, in dem sie aufgedeckt wurden. */
  const [more, setMore] = useState<{ key: string; before: number; after: number }>({ key: '', before: 0, after: 0 });
  const now = useNow();
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EventTarget | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ task: OpenTask | null; at?: Date } | null>(null);
  const [taskDay, setTaskDay] = useState<Date | null>(null);
  const [reservation, setReservation] = useState<string | null>(null);
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [tick, setTick] = useState(0);
  /* Die Aufgabe, an der gerade abgehakt wird — bis die frischen Daten da sind, sonst spränge das Häkchen kurz zurück. */
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [taskFailed, setTaskFailed] = useState<string | null>(null);
  /*
   * 2026-10-17 — MEHRERE TERMINE ZUGLEICH (`EventPick.tsx`): gewählt wird, solange
   * etwas gewählt ist; die Auswahl hält über das Blättern hinweg (darum die
   * Termine selbst, nicht nur ihre Schlüssel). `live`: was das Rechteck gerade
   * berührt (nur zum Zeigen); `clip`: was ausgeschnitten oder kopiert ist.
   */
  const [picked, setPicked] = useState<ReadonlyMap<string, CalEvent>>(new Map());
  const [live, setLive] = useState<{ keys: ReadonlySet<string>; add: boolean } | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [pasting, setPasting] = useState(false);
  const picking = picked.size > 0;
  /* Strg/⌘/Umschalt beim Klick — vor dem Klick des Termins gemerkt (onClickCapture). */
  const multi = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const moreKey = view === 'month' ? keyOf(firstOfMonth(anchor)) : '';
  const shownMore = more.key === moreKey && view === 'month' ? more : { before: 0, after: 0 };
  const range = shownMore.before + shownMore.after > 0 ? monthsRange(anchor, shownMore.before, shownMore.after) : viewRange(view, anchor);
  const reveal = (side: 'before' | 'after') => {
    if (shownMore.before + shownMore.after >= MAX_MORE) return;
    setMore({ key: moreKey, before: shownMore.before + (side === 'before' ? 1 : 0), after: shownMore.after + (side === 'after' ? 1 : 0) });
  };
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date(fromMs);
        const to = new Date(toMs);
        const [found, agenda, tasks, bookings, calendars] = await Promise.all([
          loadAreas(), loadAgenda(from, to), scoped ? Promise.resolve({ tasks: [] }) : loadTasks(from, to),
          /* Ohne Reservierungen ist der Kalender immer noch ein Kalender. */
          loadBookings(from, to).catch(() => NO_BOOKINGS),
          loadCalendars().then((got) => got.calendars).catch(() => [] as readonly CalendarRow[])
        ]);
        const items = await openAgenda(me.ring, agenda.occurrences, found.areas);
        const opened = await openTasks(me.ring, tasks.tasks);
        if (!alive) return;
        setAreas(found.areas);
        setData({ from: fromMs, to: toMs, items, claims: scoped ? [] : agenda.claims, tasks: opened, bookings, calendars });
        setFailed(null);
        setTaskBusy(null);
      } catch (e) {
        if (!alive) return;
        setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać kalendarza.');
        setTaskBusy(null);
      }
    })();
    return () => { alive = false; };
  }, [me.ring, fromMs, toMs, tick, scoped]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const calendars = data?.calendars ?? [];
  const inScope = (calendarId: string | undefined) => !scoped || (calendarId !== undefined && scope.includes(calendarId));
  const allBookings = data?.bookings ?? NO_BOOKINGS;

  /* Als Baustein: nur, was an SEINEN Kalendern hängt. */
  const bookings: AgendaBookings = scoped ? {
    resources: allBookings.resources.filter((r) => inScope(r.calendarId ?? undefined)),
    offers: allBookings.offers.filter((o) => inScope(allBookings.resources.find((r) => r.resourceId === o.resourceId)?.calendarId ?? undefined)),
    bookings: [],
    waiting: allBookings.waiting.filter((w) => inScope(allBookings.resources.find((r) => r.resourceId === w.resourceId)?.calendarId ?? undefined))
  } : allBookings;

  const all = data === null ? [] : buildEvents(data.items, data.claims, bookings).filter((e) => e.calendarId === undefined ? !scoped : inScope(e.calendarId));

  /* 0058 — gefiltert wird nach KALENDER; „przypisane do mnie" zeigt nur, wobei ich da sein muss. */
  const events = all.filter((e) => (e.calendarId === undefined || !hidden.has(e.calendarId)) && (!mineOnly || e.mine === true));
  const allMarks = data === null ? [] : taskMarks(data.tasks, now, { from: new Date(data.from), to: new Date(data.to) });
  const marks = tasksShown && !mineOnly ? allMarks : [];
  const focus = marks.length > 0 && focusText === 'tasks' ? 'tasks' : 'events';

  /* Was eine Aufgabe im Raster tut — dieselben Handgriffe wie in der Liste des Tages (`TaskDay`). */
  const taskActs: TaskActs = {
    busy: taskBusy,
    run: (mark, act) => {
      setTaskBusy(mark.key);
      setTaskFailed(null);
      void (act === 'tick' ? toggleMark(mark, me.person.id) : markSkipped(mark.task.taskId, me.person.id, mark.occurrence?.at))
        .then(reload, (e: unknown) => {
          setTaskBusy(null);
          setTaskFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
        });
    },
    open: (task) => setTaskDialog({ task }),
    /* Auch mit breiten Aufgaben: liegt etwas im Schoss, kommt es hierher. */
    add: (at) => { if (!claimClick({ day: at, at })) setTaskDialog({ task: null, at }); }
  };

  const shownCalendars = [...new Set(all.map((e) => e.calendarId).filter((id): id is string => id !== undefined))]
    .map((calendarId) => {
      const row = calendars.find((c) => c.calendarId === calendarId);
      return { calendarId, name: row !== undefined ? calendarLabel(areas, row) : 'kalendarz', personal: areas.find((a) => a.areaId === row?.areaId)?.personal === true };
    })
    .sort((a, b) => Number(b.personal) - Number(a.personal) || a.name.localeCompare(b.name, 'pl'));
  const anyMine = all.some((e) => e.mine === true);

  const toggleCalendar = (calendarId: string) => {
    const next = new Set(hidden);
    if (next.has(calendarId)) next.delete(calendarId); else next.add(calendarId);
    setHiddenText([...next].join(','));
  };

  const label = view === 'day' ? longDate(anchor)
    : view === 'month' ? (shownMore.before + shownMore.after > 0
      ? `${monthTitle(addMonths(anchor, -shownMore.before))} – ${monthTitle(addMonths(anchor, shownMore.after))}` : monthTitle(anchor))
    : rangeTitle(range.from, range.to);

  const newAt = (start: Date, allDay = false) =>
    setDialog({ at: 'new', start, end: allDay ? addDays(start, 1) : new Date(start.getTime() + 3600_000), allDay,
      calendarId: scoped ? scope.find((id) => calendars.some((c) => c.calendarId === id && c.mayWrite === true)) : undefined });
  const mayAdd = !scoped || scope.some((id) => calendars.some((c) => c.calendarId === id && c.mayWrite === true));

  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || data === null) return;
    asked.current = true;
    if (startNew?.() !== true || !mayAdd) return;

    const at = new Date();
    at.setMinutes(0, 0, 0);
    at.setHours(at.getHours() + 1);
    newAt(at);
  }, [data]);

  const togglePick = (event: CalEvent) => {
    setPicked((was) => {
      const next = new Map(was);
      if (next.has(event.key)) next.delete(event.key); else next.set(event.key, event);
      return next;
    });
  };
  const stopPicking = () => { setPicked(new Map()); setClip(null); };
  const byKey = new Map(all.map((e) => [e.key, e]));
  const eventOf = (key: string) => byKey.get(key) ?? picked.get(key);
  const pickActions = usePickActions(me, [...picked.values()], () => { setPicked(new Map()); reload(); });

  /* In den Schoss: die Auswahl wird zum Ausgeschnittenen (blass) oder Kopierten — und ist dann nicht mehr gewählt. */
  const toClip = (mode: Clip['mode']) => {
    if (picked.size === 0) return;
    setClip({ mode, events: [...picked.values()] });
    setPicked(new Map());
  };

  /* Einfügen: aus dem Schoss (nach dem Verschieben ist er leer, eine Kopie bleibt für die nächste Stelle) oder gezogen. */
  const paste = (target: PasteAt, from: Clip | null = clip, fromClip = true) => {
    if (from === null || pasting) return;
    setPasting(true);
    void pasteClip(me.ring, from, target, all).then((result) => {
      setPasting(false);
      if (fromClip && from.mode === 'cut') setClip(null);
      tellPasted(result, from.mode, reload);
      reload();
    });
  };

  /* Ein Klick ins Leere (eine Stunde, ein Tag): einfügen, was im Schoss liegt — sonst hebt er eine Auswahl auf. */
  const claimClick = (target: PasteAt): boolean => {
    if (clip !== null) { paste(target); return true; }
    if (picking) { setPicked(new Map()); return true; }
    return false;
  };

  /* Wohin es fällt, in Worten — am Zettel beim Ziehen. */
  const dropLabel = (count: number, target: PasteAt | null, copy: boolean) => {
    const what = `${copy ? 'Kopiuj' : 'Przenieś'} ${terms(count)}`;
    if (target === null) return what;
    const d = target.day;
    return `${what} → ${WEEK_HEADS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${monthOfName(d).slice(0, 3)}${target.at !== undefined ? `, ${time(target.at)}` : ''}`;
  };

  const gestures = usePickGestures(data !== null, {
    isPicked: (key) => picked.has(key),
    pickedKeys: () => [...picked.keys()],
    onLive: (keys, add) => setLive(keys === null ? null : { keys, add }),
    onLasso: (found, add) => {
      setLive(null);
      setPicked((was) => {
        const next = new Map(add ? was : []);
        for (const key of found) { const e = eventOf(key); if (e !== undefined) next.set(key, e); }
        return next;
      });
    },
    onLongPress: (key) => {
      const e = eventOf(key);
      if (e !== undefined) setPicked((was) => new Map(was).set(key, e));
    },
    onDrop: (keys, target, copy) => {
      const list = keys.map(eventOf).filter((e): e is CalEvent => e !== undefined);
      setPicked(new Map());
      paste(target, { mode: copy ? 'copy' : 'cut', events: list }, false);
    },
    dropLabel
  });

  const open = (event: CalEvent) => {
    if (picking || multi.current) {
      if (pickable(event)) { togglePick(event); return; }
      if (picking) { toast('Tego terminu nie zmienisz razem z innymi.'); return; }
    }
    if (event.source === 'offer' || event.source === 'booking') setReservation(event.key);
    else setDialog({ at: 'event', event });
  };

  /* Der Termin, dessen Reservierungen offen sind — aus den FRISCHEN Daten, damit ein Ja sofort dasteht. */
  const shownReservation = reservation === null ? null : all.find((e) => e.key === reservation) ?? null;

  const days = view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  const waiting = bookings.waiting.length;
  const step = (direction: 1 | -1) => setAnchor(stepView(view, anchor, direction));

  /*
   * TASTEN — nicht in einem Feld, nicht hinter einem Dialog, nicht als Baustein einer Seite:
   * ← → blättern; Esc hebt Auswahl und Schoss auf; Strg+X / Strg+C legen die Auswahl in den
   * Schoss, Strg+V fügt in der Tagesansicht auf diesen Tag ein; Entf löscht die Auswahl.
   */
  const quiet = dialog === null && taskDialog === null && taskDay === null && settings === null && !calendarsOpen && reservation === null && !waitingOpen;
  const pasteHere = () => {
    if (view === 'day') paste({ day: anchor });
    else toast('Kliknij dzień albo godzinę, gdzie mają trafić.');
  };
  const keys = useRef({ step, stopPicking, quiet, picking, hasClip: clip !== null, toClip, pasteHere, remove: pickActions.removeThese });
  keys.current = { step, stopPicking, quiet, picking, hasClip: clip !== null, toClip, pasteHere, remove: pickActions.removeThese };
  useEffect(() => {
    if (scoped) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const now = keys.current;
      if (!now.quiet || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target !== null && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[role="dialog"], [role="menu"]') !== null) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        /* Ist Text markiert, bleibt Strg+C beim Text. */
        if ((key === 'x' || key === 'c') && now.picking && (window.getSelection()?.toString() ?? '') === '') { e.preventDefault(); now.toClip(key === 'x' ? 'cut' : 'copy'); }
        else if (key === 'v' && now.hasClip) { e.preventDefault(); now.pasteHere(); }
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); now.step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); now.step(1); }
      else if (e.key === 'Escape') now.stopPicking();
      else if ((e.key === 'Delete' || e.key === 'Backspace') && now.picking) { e.preventDefault(); void now.remove(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scoped]);

  /* Ein Wisch quer über das Raster blättert — nur, wenn er deutlich waagrecht war. */
  const swiped = (x: number, y: number) => {
    const from = swipe.current;
    swipe.current = null;
    /* Hat diese Berührung gewählt (langer Druck, Rechteck), war sie kein Wisch. */
    if (from === null || gestures.used.current) return;
    const dx = x - from.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(y - from.y)) step(dx < 0 ? 1 : -1);
  };
  /* Gezeigt wird die Auswahl — während des Rechtecks samt dem, was es berührt. */
  const pickedKeys: ReadonlySet<string> = live === null ? new Set(picked.keys()) : live.add ? new Set([...picked.keys(), ...live.keys]) : live.keys;
  const cutKeys: ReadonlySet<string> = clip?.mode === 'cut' ? new Set(clip.events.map((e) => e.key)) : new Set();

  return (
    <div className="wk-cal2" onClickCapture={(e) => { multi.current = e.ctrlKey || e.metaKey || e.shiftKey; }}>
      <div className="wk-cal2-bar">
        <div className="wk-mass-nav">
          <button type="button" className="wk-mass-step" aria-label="Wcześniej" onClick={() => step(-1)}>‹</button>
          <button type="button" className="wk-mass-today" aria-pressed={sameDay(anchor, now)} onClick={() => setAnchor(startOfDay(new Date()))}>Dziś</button>
          <button type="button" className="wk-mass-step" aria-label="Później" onClick={() => step(1)}>›</button>
        </div>
        <p className="wk-mass-range" aria-live="polite">
          {label}
          {data !== null && (data.from !== fromMs || data.to !== toMs) && <span className="wk-mass-loading"> · wczytywanie…</span>}
        </p>
        <div className="wk-seg" role="group" aria-label="Widok">
          {VIEWS.map((one) => (
            <button key={one.value} type="button" aria-pressed={one.value === view}
              className={one.value === view ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => { if (one.value === 'month') setMarkDay(view === 'day' ? anchor : null); setViewText(one.value); }}>
              {one.label}
            </button>
          ))}
        </div>
        <div className="wk-cal2-add">
          {mayAdd && (
            <button type="button" className="wk-btn" onClick={() => {
              const at = new Date(Math.max(now.getTime(), anchor.getTime()));
              at.setMinutes(0, 0, 0);
              at.setHours(at.getHours() + 1);
              newAt(at);
            }}>+ Termin</button>
          )}
          {!scoped && <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setTaskDialog({ task: null })}>+ Zadanie</button>}
          {!scoped && <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setCalendarsOpen(true)}>Kalendarze</button>}
        </div>
      </div>

      {(shownCalendars.length > 0 || waiting > 0 || allMarks.length > 0) && (
        <div className="wk-cal2-groups" role="group" aria-label="Co pokazać">
          {waiting > 0 && (
            <button type="button" className="wk-cal2-waiting" onClick={() => setWaitingOpen(true)}>
              Do potwierdzenia <span className="wk-cal2-count">{waiting}</span>
            </button>
          )}
          {/* Auch ein einzelner Kalender bekommt seinen Knopf, wenn er abgewählt ist — sonst käme man nicht mehr an ihn heran. */}
          {(shownCalendars.length > 1 || shownCalendars.some((g) => hidden.has(g.calendarId))) && shownCalendars.map((g) => (
            <button key={g.calendarId} type="button" className={`wk-cal2-group${hidden.has(g.calendarId) ? ' is-off' : ''}`}
              aria-pressed={!hidden.has(g.calendarId)} style={{ '--ev-h': hueOf(g.calendarId) } as CSSProperties}
              onClick={() => toggleCalendar(g.calendarId)}>
              <span className="wk-cal2-dot" aria-hidden="true" />
              {g.name}
            </button>
          ))}
          {(anyMine || mineOnly) && (
            <button type="button" className={`wk-cal2-group wk-cal2-mine${mineOnly ? '' : ' is-off'}`} aria-pressed={mineOnly}
              title="Tylko terminy, przy których musisz być (np. msze, które odprawiasz)"
              onClick={() => setMineText(mineOnly ? 'off' : 'on')}>
              <span className="wk-cal2-me" aria-hidden="true">●</span>
              Przypisane do mnie
            </button>
          )}
          {allMarks.length > 0 && (
            <button type="button" className={`wk-cal2-group wk-cal2-tasks-toggle${tasksShown ? '' : ' is-off'}`}
              aria-pressed={tasksShown} onClick={() => setTasksText(tasksShown ? 'off' : 'on')}>
              <span className="wk-cal2-tick" aria-hidden="true">✓</span>
              Zadania
            </button>
          )}
        </div>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {taskFailed !== null && <p className="wk-error">{taskFailed}</p>}
      {data === null && failed === null && <Loading label="Wczytywanie…" />}

      {data !== null && (
        <CutKeys.Provider value={cutKeys}>
        <div ref={gestures.ref} className={`wk-cal2-views${clip !== null ? ' is-pasting' : ''}${pasting ? ' is-busy' : ''}`}

          onTouchStart={(e) => { swipe.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }}
          onTouchEnd={(e) => swiped(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}>
          {(view === 'day' || view === 'week') && (
            <TimeGrid days={days} events={events} marks={marks} now={now}
              /* 2026-10-17 — im Tag führt das Datum ins Monatsblatt (umrandet), in der Woche in den Tag. */
              onDay={(day) => {
                if (clip !== null) { paste({ day }); return; }
                setAnchor(day);
                if (view === 'day') { setMarkDay(day); setViewText('month'); } else setViewText('day');
              }}
              onSlot={(at, allDay) => { if (!claimClick(allDay ? { day: at } : { day: at, at })) newAt(at, allDay); }} onOpen={open} onTasks={setTaskDay} areas={areas}
              focus={focus} onFocus={setFocusText} tasks={taskActs} picked={pickedKeys} onStep={step} hour={hour} onZoom={zoom} />
          )}

          {view === 'month' && (
            <MonthGrid anchor={anchor} from={range.from} to={range.to} events={events} marks={marks} now={now}
              onDay={(day) => { if (clip !== null) { paste({ day }); return; } setAnchor(day); setMarkDay(day); setViewText('day'); }} onOpen={open} onTasks={setTaskDay} picked={pickedKeys}
              firstMonth={addMonths(anchor, -shownMore.before)} lastMonth={addMonths(anchor, shownMore.after)} marked={markDay}
              onReveal={shownMore.before + shownMore.after < MAX_MORE ? reveal : undefined} />
          )}

          {view === 'list' && (
            <ListView from={range.from} events={events} marks={marks} now={now} areas={areas} onOpen={open} onTasks={setTaskDay} picked={pickedKeys} />
          )}
        </div>
        </CutKeys.Provider>
      )}

      {/* Unter dem Kalender, beim Rollen unten am Bildschirm — oben stehen die Köpfe der Tage und des Monats. */}
      {(picking || clip !== null) && (
        <PickBar picked={[...picked.values()]} clip={clip} actions={pickActions}
          onCut={() => toClip('cut')} onCopy={() => toClip('copy')}
          onClear={() => setPicked(new Map())} onClearClip={() => setClip(null)} />
      )}

      {dialog !== null && (
        <Suspense fallback={null}>
        {/*
          2026-10-17 — EIN DIALOG JE ZIEL (`key`). Ohne ihn blieb beim Wechsel vom
          Ganzen zu „+ Nowy punkt programu" derselbe Editor stehen, mit dem Zustand
          des Ganzen — und der neue Punkt wurde ohne sein Ganzes gespeichert.
        */}
        <EventDialog key={dialog.at === 'event' ? dialog.event.key : `new:${dialog.parentItemId ?? ''}:${dialog.start.getTime()}`}
          me={me} areas={areas} calendars={calendars} scope={scope} target={dialog} events={all}
          onClose={() => setDialog(null)} onSaved={reload}
          onOpenPart={(part) => open(part)} />
        </Suspense>
      )}

      {calendarsOpen && (
        <CalendarsList areas={areas} calendars={calendars} onClose={() => setCalendarsOpen(false)}
          onNew={() => { setCalendarsOpen(false); setSettings('new'); }}
          onEdit={(row) => { setCalendarsOpen(false); setSettings(row); }} />
      )}

      {settings !== null && (
        <CalendarSettings me={me} areas={areas} calendar={settings === 'new' ? null : settings}
          onClose={() => setSettings(null)} onSaved={reload} />
      )}

      {taskDialog !== null && (
        <Suspense fallback={null}>
          <TaskDialog me={me} areas={areas} task={taskDialog.task} at={taskDialog.at}
            onClose={() => setTaskDialog(null)} onSaved={reload} />
        </Suspense>
      )}

      {taskDay !== null && (
        <TaskDay me={me} day={taskDay} marks={marksOn(marks, taskDay)} areas={areas} now={now}
          onClose={() => setTaskDay(null)} onChanged={reload}
          onOpenTask={(task) => { setTaskDay(null); setTaskDialog({ task }); }}
          onNew={() => { const at = new Date(taskDay); at.setHours(Math.max(now.getHours(), 8), 0, 0, 0); setTaskDay(null); setTaskDialog({ task: null, at }); }} />
      )}

      {shownReservation !== null && (
        <ReservationDialog event={shownReservation} onClose={() => setReservation(null)} onChanged={reload}
          onEdit={shownReservation.item?.editable === true
            ? () => { setReservation(null); setDialog({ at: 'event', event: { ...shownReservation, source: 'item' } }); }
            : undefined} />
      )}

      {waitingOpen && (
        <WaitingDialog reservations={bookings} onClose={() => setWaitingOpen(false)} onChanged={reload}
          onShow={(at) => { setWaitingOpen(false); setAnchor(startOfDay(at)); if (view === 'list' || view === 'month') setViewText('week'); }} />
      )}
    </div>
  );
}

/* -- Ein Termin, gezeichnet ----------------------------------------------------------- */

/** 0058 — die Farbe eines Termins: die seines Kalenders. */
const hueOfEvent = (event: CalEvent) => hueOf(event.calendarId ?? event.areaId);

function chipClass(event: CalEvent, picked?: ReadonlySet<string>, cut?: ReadonlySet<string>): string {
  const offer = event.offer;
  const waits = offer !== undefined ? waitingOn(offer) > 0 : event.booking !== undefined && waitsForOffice(event.booking);
  return ['wk-ev', `is-${event.source}`,
    event.cancelled && 'is-cancelled',
    event.mine === true && 'is-mine',
    offer !== undefined && offer.taken >= offer.capacity && 'is-full',
    offer !== undefined && offer.taken === 0 && 'is-empty',
    offer?.closedBy != null && 'is-closed',
    waits && 'has-waiting',
    picked?.has(event.key) === true && 'is-picked',
    cut?.has(event.key) === true && 'is-cut']
    .filter(Boolean).join(' ');
}

/** Wer auf einem Termin sitzt — für die zweite Zeile und den Hinweis beim Darüberfahren. */
function whoIsOn(event: CalEvent): string | null {
  if (event.offer !== undefined) {
    return event.offer.claims.length === 0 ? null : event.offer.claims.map(holderName).join(', ');
  }
  if (event.booking !== undefined) return holderName(event.booking);
  return null;
}

/** Plätze und Wartende als kleine Zeichen am Termin: „2/3", „1?". */
function Badges({ event }: { event: CalEvent }) {
  const offer = event.offer;
  if (offer !== undefined) {
    const waits = waitingOn(offer);
    return (
      <span className="wk-ev-badges">
        <span className="wk-ev-seats" title={`zajęte ${offer.taken} z ${offer.capacity}`}>{offer.taken}/{offer.capacity}</span>
        {waits > 0 && <span className="wk-ev-wait" title={`${waits} czeka na potwierdzenie`}>{waits}?</span>}
      </span>
    );
  }
  if (event.booking !== undefined && waitsForOffice(event.booking)) {
    return <span className="wk-ev-badges"><span className="wk-ev-wait" title="czeka na potwierdzenie">?</span></span>;
  }
  /* 0079 — an einer Messe: wie viele Intentionen. Eine Messe ohne ist eine Auskunft (noch frei). */
  const intentions = event.item?.occurrence.intentions;
  if (intentions != null && intentions > 0) {
    return <span className="wk-ev-badges"><span className="wk-ev-intcount" title={intentionsWord(intentions)}>{intentions} int.</span></span>;
  }
  return null;
}

function hint(event: CalEvent, areas: readonly AreaRow[]): string {
  const who = whoIsOn(event);
  const when = wholeDay(event) ? '' : `${time(event.start)}–${time(event.end)} `;
  return `${when}${event.title} · ${groupName(areas, event.areaId)}${who === null ? '' : `\n${who}`}`;
}

/* -- Tag und Woche: das Stundenraster ----------------------------------------------------- */

/** Was eine Aufgabe im Raster tut, wenn die Aufgaben die Breite haben. */
export interface TaskActs {
  /** Die Marke, an der gerade etwas geschieht — dann ruhen alle Handgriffe. */
  readonly busy: string | null;
  /** `tick`: abhaken oder zurücknehmen; `skip`: „pomiń". */
  readonly run: (mark: TaskMark, act: 'tick' | 'skip') => void;
  readonly open: (task: OpenTask) => void;
  /** Ein Klick ins Leere: eine neue Aufgabe um diese Zeit. */
  readonly add: (at: Date) => void;
}

/** Tag und Woche — auch für den Kalender-Baustein einer Seite (0058: `readOnly`, dann legt ein Klick nichts an). */
export function TimeGrid({ days, events, marks, now, onDay, onSlot, onOpen, onTasks, areas, readOnly = false, focus = 'events', onFocus, tasks, picked, onStep, hour = HOUR, onZoom }: {
  days: readonly Date[];
  events: readonly CalEvent[];
  marks: readonly TaskMark[];
  now: Date;
  onDay: (day: Date) => void;
  onSlot: (at: Date, allDay: boolean) => void;
  onOpen: (event: CalEvent) => void;
  onTasks: (day: Date) => void;
  areas: readonly AreaRow[];
  readOnly?: boolean;
  /** 2026-10-17 — wer die Breite hat; `tasks` nur mit `tasks` und `onFocus`. */
  focus?: 'events' | 'tasks';
  onFocus?: (focus: 'events' | 'tasks') => void;
  tasks?: TaskActs;
  /** 2026-10-17 — die zum gemeinsamen Ändern gewählten Termine (`EventPick.tsx`). */
  picked?: ReadonlySet<string>;
  /** 2026-10-17 — ‹ › als Streifen links und rechts des ganzen Rasters: zum vorigen / nächsten Tag (der Woche). */
  onStep?: (direction: 1 | -1) => void;
  /** 2026-10-17 — wie hoch eine Stunde ist, und − / + (oder Strg + Mausrad) zum Ändern. */
  hour?: number;
  onZoom?: (direction: 1 | -1) => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const cut = useContext(CutKeys);
  /* Wie breit eine Tagesspalte ist — davon hängt ab, ob Teile neben ihrem Ganzen Platz haben. */
  const [colWidth, setColWidth] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null) return undefined;
    const measure = () => setColWidth(el.querySelector('.wk-cal2-col')?.getBoundingClientRect().width ?? 0);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [days.length]);
  const sideParts = colWidth >= SIDE_MIN;
  const hourNow = useRef(hour);
  const zoomNow = useRef(onZoom);
  zoomNow.current = onZoom;
  const first = keyOf(days[0]);
  const count = days.length;
  const rail = marks.length > 0 ? RAIL : 0;
  const wide = focus === 'tasks' && marks.length > 0 && tasks !== undefined && onFocus !== undefined;

  /* Beim Öffnen und beim Blättern: dorthin, wo der Tag beginnt — nicht um Mitternacht. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    const today = new Date();
    const start = new Date(`${first}T00:00:00`);
    const inside = today >= start && today.getTime() < start.getTime() + count * 86400_000;
    const hour = inside ? Math.max(0, today.getHours() - 1) : 7;
    el.scrollTop = Math.min(hour, 16) * hourNow.current;
  }, [first, count]);

  /* Beim Zoomen bleibt die Mitte, wo sie war. */
  useLayoutEffect(() => {
    const el = scroller.current;
    const was = hourNow.current;
    hourNow.current = hour;
    if (el === null || was === hour) return;
    const middle = (el.scrollTop + el.clientHeight / 2) / was;
    el.scrollTop = Math.max(0, middle * hour - el.clientHeight / 2);
  }, [hour]);

  /* Strg + Mausrad (auch das Spreizen auf dem Touchpad) zoomt das Raster, nicht die Seite. */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return undefined;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || zoomNow.current === undefined) return;
      e.preventDefault();
      if (e.timeStamp - last < 150 || e.deltaY === 0) return;
      last = e.timeStamp;
      zoomNow.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const slotFrom = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((e.clientY - box.top) / hour) * 2) * 30;
    const at = new Date(day);
    at.setHours(0, Math.max(0, Math.min(minutes, 23 * 60 + 30)), 0, 0);
    /* Haben die Aufgaben die Breite, entsteht im Leeren eine Aufgabe. */
    if (wide) tasks.add(at);
    else onSlot(at, false);
  };

  const one = days.length === 1;
  const grid = (
    <HourHeight.Provider value={hour}>
    <div className={`wk-cal2-grid${readOnly ? ' is-readonly' : ''}${wide ? ' is-tasks' : ''}`}
      style={{ '--days': days.length, '--hour': `${hour}px`, '--rail': `${rail}px`, '--evrail': `${EVENT_RAIL}px` } as CSSProperties}>
      <div className="wk-cal2-head">
        {/* 2026-10-17 — in der Ecke über den Stunden: die Stunden niedriger / höher. */}
        {onZoom !== undefined ? (
          <span className="wk-cal2-corner wk-cal2-zoom" role="group" aria-label="Wysokość godziny">
            <button type="button" className="wk-cal2-zoombtn" aria-label="Pomniejsz" title="Pomniejsz (Ctrl + kółko myszy)"
              disabled={hour <= HOURS[0]} onClick={() => onZoom(-1)}>−</button>
            <button type="button" className="wk-cal2-zoombtn" aria-label="Powiększ" title="Powiększ (Ctrl + kółko myszy)"
              disabled={hour >= HOURS[HOURS.length - 1]} onClick={() => onZoom(1)}>+</button>
          </span>
        ) : <span className="wk-cal2-corner" />}
        {/* 2026-10-17 — wo Platz ist, der ganze Name des Tages und der Monat (`@container` in personal.css). */}
        {days.map((day) => (
          <button key={keyOf(day)} type="button" className={`wk-cal2-dayhead${sameDay(day, now) ? ' is-today' : ''}`} data-day={keyOf(day)}
            aria-label={longDate(day)} title={onStep === undefined ? undefined : one ? 'Pokaż cały miesiąc' : 'Pokaż ten dzień'} onClick={() => onDay(day)}>
            <span className="wk-cal2-dow">
              <span className="wk-cal2-short">{WEEK_HEADS[(day.getDay() + 6) % 7]}</span>
              <span className="wk-cal2-long">{weekdayName(day)}</span>
            </span>
            <span className="wk-cal2-date">{day.getDate()}</span>
            <span className="wk-cal2-mon wk-cal2-long">{monthOfName(day)}</span>
          </button>
        ))}
      </div>

      <div className="wk-cal2-allday">
        <span className="wk-cal2-corner wk-cal2-alllabel">cały dzień</span>
        {days.map((day) => (
          <div key={keyOf(day)} className="wk-cal2-allcell" data-day={keyOf(day)}
            onClick={(e) => { if (e.target === e.currentTarget) onSlot(startOfDay(day), true); }}>
            {events.filter((e) => wholeDay(e) && happensOn(e, day)).map((e) => (
              <button key={e.key} type="button" className={chipClass(e, picked, cut)} style={{ '--ev-h': hueOfEvent(e) } as CSSProperties}
                data-pick={pickable(e) ? e.key : undefined}
                title={hint(e, areas)} aria-pressed={picked?.has(e.key)} onClick={() => onOpen(e)}>
                <span className="wk-ev-title">{e.title}</span>
                <Badges event={e} />
              </button>
            ))}
          </div>
        ))}
      </div>

      {marks.length > 0 && (
        <div className="wk-cal2-taskrow">
          {onFocus !== undefined && tasks !== undefined ? (
            <button type="button" className="wk-cal2-corner wk-cal2-alllabel wk-cal2-focus" aria-pressed={wide}
              title={wide ? 'Terminy szeroko, zadania z boku' : 'Zadania szeroko, terminy z boku'}
              onClick={() => onFocus(wide ? 'events' : 'tasks')}>
              zadania
            </button>
          ) : <span className="wk-cal2-corner wk-cal2-alllabel">zadania</span>}
          {days.map((day) => (
            <div key={keyOf(day)} className="wk-cal2-taskcell">
              {/* Erst gibt die Pille den Aufgaben die Breite; stehen sie schon breit, öffnet sie die Liste des Tages. */}
              {/* Was von früher heute steht, hat keine Uhrzeit: es steht nicht im Raster, nur in der Liste („Wszystkie dni"). */}
              <TaskPill marks={marksOn(marks, day)} onOpen={() => (wide || onFocus === undefined || tasks === undefined ? onTasks(day) : onFocus('tasks'))} />
            </div>
          ))}
        </div>
      )}

      <div className="wk-cal2-scroll" ref={scroller}>
        <div className="wk-cal2-body">
          <div className="wk-cal2-hours" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => <span key={h} className="wk-cal2-hour">{h === 0 ? '' : `${h}:00`}</span>)}
          </div>

          {days.map((day) => (
            <div key={keyOf(day)} className={`wk-cal2-col${sameDay(day, now) ? ' is-today' : ''}`} data-day={keyOf(day)} data-slot=""
              onClick={(e) => { if (e.target === e.currentTarget) slotFrom(day, e); }}>
              {/* Ein Klick auf die Schiene gibt den Aufgaben die Breite; ohne das Umschalten öffnet er ihre Liste. */}
              {rail > 0 && !wide && <Rail marks={marks} day={day} onOpen={() => (onFocus !== undefined && tasks !== undefined ? onFocus('tasks') : onTasks(day))} />}

              {wide && laneDay(marks, day).map((p) => <TaskBlock key={p.mark.key} mark={p.mark} now={now} acts={tasks} placed={p} />)}
              {wide && <EventRail events={events} day={day} areas={areas} onOpen={() => onFocus('events')} />}

              {!wide && (sideParts ? placeDay(events, day, 0, SIDE_INSET) : placeDay(events, day, partHead(hour))).map((p) => {
                const who = whoIsOn(p.event);
                const tall = (p.height / 60) * hour;
                /* Neben den Teilen (breit) liest sich das Ganze wie jeder Termin, nur im Streifen links; schmal trägt es eine Kopfzeile. */
                const head = p.nested && !sideParts;
                return (
                  <button key={p.event.key} type="button"
                    aria-pressed={picked?.has(p.event.key)}
                    data-pick={pickable(p.event) ? p.event.key : undefined}
                    className={`${chipClass(p.event, picked, cut)}${tall < TALL ? ' is-short' : ''}${p.depth > 0 ? ' is-part' : ''}${head ? ' has-parts' : ''}${p.nested && sideParts ? ' has-side-parts' : ''}`}
                    style={{
                      '--ev-h': hueOfEvent(p.event),
                      top: `${(p.top / 60) * hour}px`,
                      height: `${Math.max(tall - 2, 18)}px`,
                      left: `calc(var(--rail) + (100% - var(--rail)) * ${p.x} + 2px)`,
                      width: `calc((100% - var(--rail)) * ${p.w} - 4px)`,
                      zIndex: 1 + p.depth,
                      '--band': `${SIDE_INSET * 100}%`
                    } as CSSProperties}
                    title={hint(p.event, areas)}
                    onClick={() => onOpen(p.event)}>
                    <span className="wk-ev-line">
                      <span className="wk-ev-time">{time(p.event.start)}</span>
                      {head && <span className="wk-ev-title is-head">{p.event.title}</span>}
                      <Badges event={p.event} />
                    </span>
                    {!head && <span className="wk-ev-title">{p.event.title}</span>}
                    {who !== null && tall >= hour && tall >= 48 && <span className="wk-ev-sub">{who}</span>}
                  </button>
                );
              })}

              {sameDay(day, now) && (
                <span className="wk-cal2-now" style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 60) * hour}px` }} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
    </HourHeight.Provider>
  );

  if (onStep === undefined) return grid;

  /* 2026-10-17 — blättern an den Seiten des ganzen Rasters: links zurück, rechts weiter. */
  return (
    <div className="wk-cal2-stage">
      <button type="button" className="wk-cal2-side" aria-label={one ? 'Poprzedni dzień' : 'Poprzedni tydzień'} title={one ? 'Poprzedni dzień' : 'Poprzedni tydzień'}
        onClick={() => onStep(-1)}><span aria-hidden="true">‹</span></button>
      {grid}
      <button type="button" className="wk-cal2-side" aria-label={one ? 'Następny dzień' : 'Następny tydzień'} title={one ? 'Następny dzień' : 'Następny tydzień'}
        onClick={() => onStep(1)}><span aria-hidden="true">›</span></button>
    </div>
  );
}

/**
 * DIE SCHIENE — jedes Fenster ein Strich am linken Rand des Tages, im Stand
 * seiner Farbe: offen, erledigt, versäumt, kommend. Sie nimmt den Terminen
 * keinen Platz; ein Klick gibt den Aufgaben die Breite (2026-10-17 — vorher:
 * die Liste des Tages, die jetzt an der Pille in der Zeile „zadania" hängt).
 */
function Rail({ marks, day, onOpen }: { marks: readonly TaskMark[]; day: Date; onOpen: () => void }) {
  const hour = useContext(HourHeight);
  const railed = railDay(marks, day);
  if (railed.length === 0) return null;

  return (
    <button type="button" className={`wk-cal2-rail${day < startOfDay(new Date()) ? ' is-past' : ''}`} aria-label={`Zadania: ${longDate(day)} — pokaż szeroko`}
      title="Zadania szeroko" onClick={onOpen}>
      {railed.map((r) => (
        <span key={r.mark.key} className={`wk-rail-bar is-${r.mark.state}`}
          title={`${r.mark.task.title} · ${time(r.mark.start)}${r.mark.end > r.mark.start ? `–${time(r.mark.end)}` : ''}`}
          style={{
            '--ev-h': hueOf(r.mark.areaId),
            top: `${(r.top / 60) * hour}px`,
            height: `${(r.height / 60) * hour}px`,
            left: `${2 + r.lane * 4}px`
          } as CSSProperties} />
      ))}
    </button>
  );
}

/** Wo ein Kasten einer Aufgabe steht: links, in der Breite des Tages ohne die Schiene der Termine. */
const taskPlace = (p: Laned, areaId: string, hour: number): CSSProperties => ({
  '--ev-h': hueOf(areaId),
  top: `${(p.top / 60) * hour}px`,
  height: `${Math.max((p.height / 60) * hour - 2, 22)}px`,
  left: `calc((100% - var(--evrail)) * ${p.x} + 2px)`,
  width: `calc((100% - var(--evrail)) * ${p.w} - 4px)`
} as CSSProperties);

/**
 * 2026-10-17 — EINE AUFGABE, BREIT: Häkchen (zurücknehmen geht auch), Zeit,
 * Name, der Stand in Worten und „pomiń" — dieselben Handgriffe wie in der
 * Liste des Tages. Ein Klick auf den Namen öffnet die Aufgabe. Was von früher
 * heute steht, steht hier nicht — nur in der Liste (`TaskDay`, „Wszystkie dni").
 */
function TaskBlock({ mark, now, acts, placed }: { mark: TaskMark; now: Date; acts: TaskActs; placed: Laned }) {
  const hour = useContext(HourHeight);
  const done = settled(mark);
  const short = (placed.height / 60) * hour < TALL;
  const busy = acts.busy === mark.key;
  return (
    <div
      className={`wk-tb is-${mark.state}${short ? ' is-short' : ''}${busy ? ' is-busy' : ''}`}
      style={taskPlace(placed, mark.areaId, hour)}
      aria-busy={busy || undefined}
    >
      <button type="button" role="checkbox" aria-checked={done} className={`wk-task-tick wk-tb-tick${done ? ' is-done' : ''}`}
        disabled={acts.busy !== null || !mayTick(mark, now)}
        aria-label={done ? `Cofnij: ${mark.task.title}` : `Zrobione: ${mark.task.title}`}
        title={done ? 'Cofnij' : 'Zrobione'}
        onClick={() => acts.run(mark, 'tick')}>
        {mark.state === 'done' ? '✓' : mark.state === 'skipped' ? '–' : ''}
      </button>
      <button type="button" className="wk-tb-main" title={`${mark.task.title} · ${whenOf(mark)} · ${stateOf(mark, now)}`} onClick={() => acts.open(mark.task)}>
        <span className="wk-tb-line">
          <span className="wk-tb-time">{time(mark.start)}</span>
          <span className="wk-tb-title">{mark.task.title}</span>
        </span>
        {!short && <span className={`wk-tb-state is-${mark.state}`}>{stateOf(mark, now)}</span>}
      </button>
      {maySkip(mark) && (
        <button type="button" className="wk-tb-skip" disabled={acts.busy !== null}
          aria-label={`Pomiń: ${mark.task.title}`} title="Pomiń" onClick={() => acts.run(mark, 'skip')}>
          <span className="wk-tb-skip-word">pomiń</span><span className="wk-tb-skip-mark" aria-hidden="true">»</span>
        </button>
      )}
    </div>
  );
}

/** Wo ein Termin auf seiner Schiene steht: ein Strich, nebeneinander, wo sie sich überschneiden. */
const railPlace = (p: Placed, hue: number, hour: number): CSSProperties => ({
  '--ev-h': hue,
  top: `${(p.top / 60) * hour}px`,
  height: `${Math.max((p.height / 60) * hour - 2, 6)}px`,
  left: `${2 + p.x * RAIL_SPAN}px`,
  width: `${Math.max(p.w * RAIL_SPAN - 1, 3)}px`
} as CSSProperties);

/**
 * 2026-10-17 — DIE TERMINE ALS SCHIENE, am rechten Rand, solange die Aufgaben
 * den Tag haben: jeder Termin ein Strich in seiner Farbe. Ein Klick darauf
 * gibt den Terminen die Breite zurück.
 */
function EventRail({ events, day, areas, onOpen }: { events: readonly CalEvent[]; day: Date; areas: readonly AreaRow[]; onOpen: () => void }) {
  const hour = useContext(HourHeight);
  const placed = placeDay(events, day, partHead(hour)).filter((p) => p.depth === 0);
  return (
    <button type="button" className="wk-cal2-evrail" aria-label={`Terminy: ${longDate(day)} — pokaż szeroko`} title="Terminy szeroko" onClick={onOpen}>
      {placed.map((p) => (
        <span key={p.event.key} className={`wk-evrail-bar${p.event.cancelled ? ' is-cancelled' : ''}`} title={hint(p.event, areas)}
          style={railPlace(p, hueOfEvent(p.event), hour)} />
      ))}
    </button>
  );
}

/* -- Der Monat --------------------------------------------------------------------------- */

/**
 * Der Monat. 2026-10-17 — ein Klick auf einen Tag ÖFFNET diesen Tag (auch ins
 * Leere der Zelle): wer im Monat blättert, sucht einen Tag; ein Termin um neun
 * Uhr, der bei jedem Klick aufging, war nie gemeint. Neu anlegen: „+ Termin".
 *
 * 2026-10-17 — DER KOPF BLEIBT OBEN: die Wochentage und, wie der Tag in den
 * Rozmowy, der Monat, in dem man gerade liest (bei mehreren aufgedeckten der
 * der obersten sichtbaren Woche — nach ihrem Donnerstag, wie die Kalenderwoche).
 */
export function MonthGrid({ anchor, from, to, events, marks, now, onDay, onOpen, onTasks, readOnly = false, picked, firstMonth = anchor, lastMonth = anchor, marked = null, onReveal }: {
  anchor: Date;
  from: Date;
  /** Bis wohin (ausschliesslich) — fehlt: sechs Wochen. */
  to?: Date;
  events: readonly CalEvent[];
  marks: readonly TaskMark[];
  now: Date;
  onDay: (day: Date) => void;
  onOpen: (event: CalEvent) => void;
  onTasks: (day: Date) => void;
  readOnly?: boolean;
  picked?: ReadonlySet<string>;
  /** 2026-10-17 — welche Monate aufgedeckt sind (der erste und der letzte); die Tage daneben treten zurück. */
  firstMonth?: Date;
  lastMonth?: Date;
  /** 2026-10-17 — der Tag, von dem man kam: umrandet. */
  marked?: Date | null;
  /** 2026-10-17 — oben und unten: den Monat davor / danach dazunehmen. */
  onReveal?: (side: 'before' | 'after') => void;
}) {
  const cut = useContext(CutKeys);
  const length = to === undefined ? 42 : Math.max(42, Math.round((to.getTime() - from.getTime()) / 86400_000));
  const days = Array.from({ length }, (_, i) => addDays(from, i));
  const shownFrom = firstOfMonth(firstMonth).getTime();
  const shownTo = addMonths(lastMonth, 1).getTime();
  const several = shownTo - shownFrom > 32 * 86400_000;
  const inside = (day: Date) => day.getTime() >= shownFrom && day.getTime() < shownTo;
  const SHOWN = 3;

  /* Welcher Monat oben steht: bei einem der Monat selbst, bei mehreren der der obersten sichtbaren Woche. */
  const head = useRef<HTMLDivElement | null>(null);
  const cells = useRef<HTMLDivElement | null>(null);
  const [topMonth, setTopMonth] = useState<number | null>(null);
  useEffect(() => {
    if (!several) { setTopMonth(null); return undefined; }
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (head.current === null || cells.current === null) return;
      const line = head.current.getBoundingClientRect().bottom + 2;
      const all = cells.current.querySelectorAll<HTMLElement>('[data-day]');
      for (let i = 0; i < all.length; i += 7) {
        if (all[i].getBoundingClientRect().bottom <= line) continue;
        const thursday = fromKey(all[Math.min(i + 3, all.length - 1)].dataset.day ?? '');
        const month = Math.min(Math.max(firstOfMonth(thursday).getTime(), shownFrom), addMonths(lastMonth, 0).getTime());
        setTopMonth(month);
        return;
      }
    };
    const onScroll = () => { if (frame === 0) frame = requestAnimationFrame(measure); };
    measure();
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [several, from.getTime(), length, shownFrom, shownTo]);
  const title = monthTitle(topMonth !== null ? new Date(topMonth) : several ? firstMonth : anchor);

  return (
    <div className="wk-cal2-monthwrap">
      {onReveal !== undefined && (
        <button type="button" className="wk-cal2-reveal" onClick={() => onReveal('before')}>
          <span aria-hidden="true">▲</span> Pokaż też {monthTitle(addMonths(firstMonth, -1))}
        </button>
      )}
      <div className="wk-cal2-monthhead" ref={head}>
        <span className="wk-cal2-monthname"><span aria-live="polite">{title}</span></span>
        <div className="wk-cal2-monthdows" aria-hidden="true">
          {WEEK_HEADS.map((one) => <span key={one} className="wk-mass-month-dow">{one}</span>)}
        </div>
      </div>
      <div className={`wk-cal2-month${readOnly ? ' is-readonly' : ''}`} ref={cells}>
        {days.map((day) => {
          /* 0074 — Teile stehen im Monat nicht einzeln: ihr Ganzes sagt, wie viele es hat. */
          const mine = treeOrder(events.filter((e) => happensOn(e, day))).filter((t) => t.depth === 0);
          return (
            <div key={keyOf(day)} data-day={keyOf(day)}
              className={`wk-cal2-cell${inside(day) ? '' : ' is-out'}${sameDay(day, now) ? ' is-today' : ''}${marked !== null && sameDay(day, marked) ? ' is-marked' : ''}`}
              onClick={(e) => { if ((e.target as Element).closest('button, a') === null) onDay(day); }}>
              <span className="wk-cal2-cellhead">
                <button type="button" className="wk-cal2-cellday" aria-label={longDate(day)} onClick={() => onDay(day)}>
                  {/* 2026-10-17 — an jedem Tag der Monat, kurz („31 paź", „1 lis"): an den Rändern und über mehrere Monate weiss man so immer, wo man ist. */}
                  {day.getDate()} <span className="wk-cal2-cellmon">{monthOfName(day).slice(0, 3)}</span>
                </button>
                <TaskPill marks={marksOn(marks, day)} onOpen={() => onTasks(day)} mini />
              </span>
              {mine.slice(0, SHOWN).map(({ event: e, parts }) => (
                <button key={e.key} type="button" className={`${chipClass(e, picked, cut)} is-line`} aria-pressed={picked?.has(e.key)} style={{ '--ev-h': hueOfEvent(e) } as CSSProperties}
                  data-pick={pickable(e) ? e.key : undefined}
                  title={parts > 0 ? `${e.title} — punkty programu: ${parts}` : e.title} onClick={() => onOpen(e)}>
                  {!wholeDay(e) && <span className="wk-ev-time">{time(e.start)}</span>}
                  <span className="wk-ev-title">{e.title}</span>
                  {parts > 0 && <span className="wk-ev-parts">+{parts}</span>}
                  <Badges event={e} />
                </button>
              ))}
              {mine.length > SHOWN && (
                <button type="button" className="wk-link-btn wk-cal2-more" onClick={() => onDay(day)}>+{mine.length - SHOWN} więcej</button>
              )}
            </div>
          );
        })}
      </div>
      {onReveal !== undefined && (
        <button type="button" className="wk-cal2-reveal" onClick={() => onReveal('after')}>
          <span aria-hidden="true">▼</span> Pokaż też {monthTitle(addMonths(lastMonth, 1))}
        </button>
      )}
    </div>
  );
}

/* -- Die Liste ------------------------------------------------------------------------------- */

export function ListView({ from, events, marks, now, areas, onOpen, onTasks, picked }: {
  from: Date;
  events: readonly CalEvent[];
  marks: readonly TaskMark[];
  now: Date;
  areas: readonly AreaRow[];
  onOpen: (event: CalEvent) => void;
  onTasks: (day: Date) => void;
  picked?: ReadonlySet<string>;
}) {
  const cut = useContext(CutKeys);
  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i))
    .map((day) => ({ day, list: events.filter((e) => happensOn(e, day)), tasks: marksOn(marks, day) }))
    .filter((one) => one.list.length > 0 || one.tasks.length > 0);

  if (days.length === 0) return <p className="wk-empty">W tych dniach nic nie ma.</p>;

  const side = (e: CalEvent): ReactNode => {
    if (e.offer !== undefined) {
      const waits = waitingOn(e.offer);
      return <>{e.offer.taken}/{e.offer.capacity} zajęte{waits > 0 && <strong className="wk-res-waitnote"> · {waits} czeka</strong>}</>;
    }
    if (e.booking !== undefined) return <>{holderName(e.booking)}{waitsForOffice(e.booking) && <strong className="wk-res-waitnote"> · czeka</strong>}</>;
    const intentions = e.item?.occurrence.intentions;
    return <>{groupName(areas, e.areaId)}{e.source === 'claim' ? ' · rezerwacja' : ''}{intentions != null && intentions > 0 ? ` · ${intentionsWord(intentions)}` : ''}</>;
  };

  return (
    <div className="wk-cal2-list">
      {days.map(({ day, list, tasks }) => (
        <section key={keyOf(day)} className={`wk-cal2-listday${sameDay(day, now) ? ' is-today' : ''}`} data-day={keyOf(day)}>
          <div className="wk-cal2-listhead">
            <h3 className="wk-mass-day-name">{longDate(day)}</h3>
            <TaskPill marks={tasks} onOpen={() => onTasks(day)} />
          </div>
          {treeOrder(list).map(({ event: e, depth }) => (
            <div key={e.key} className={`wk-cal2-listrow${depth > 0 ? ' is-part' : ''}${picked?.has(e.key) === true ? ' is-picked' : ''}${cut.has(e.key) ? ' is-cut' : ''}`} style={{ '--ev-h': hueOfEvent(e), '--depth': depth } as CSSProperties}>
              {depth > 0 && <span className="wk-cal2-partmark" aria-hidden="true">↳</span>}
              <span className="wk-cal2-dot" aria-hidden="true" />
              <span className="wk-cal2-listtime">{wholeDay(e) ? 'cały dzień' : `${time(e.start)}–${time(e.end)}`}</span>
              <button type="button" className={`wk-link-btn wk-cal2-listtitle${e.cancelled ? ' is-cancelled' : ''}`} aria-pressed={picked?.has(e.key)}
                data-pick={pickable(e) ? e.key : undefined} onClick={() => onOpen(e)}>
                {e.title}
              </button>
              <span className="wk-row-side">{side(e)}</span>
              {linkOfEvent(e) !== null && <ItemLink url={linkOfEvent(e)!.url} label={linkOfEvent(e)!.label} compact />}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/* -- Die Kalender (0058) --------------------------------------------------------------------- */

/**
 * WELCHE KALENDER ES GIBT — meine privaten und die meiner Gruppen, jeder mit
 * dem, wie seine Termine funktionieren. Wer einen führt, stellt hier seine
 * Regeln; ein neuer bekommt sie, bevor der erste Termin darin steht.
 */
function CalendarsList({ areas, calendars, onClose, onNew, onEdit }: {
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  onClose: () => void;
  onNew: () => void;
  onEdit: (row: CalendarRow) => void;
}) {
  const personal = areas.find((a) => a.personal === true);
  const live = calendars.filter((c) => c.archived !== true);
  const mine = live.filter((c) => c.areaId === personal?.areaId);
  const groups = live.filter((c) => c.areaId !== personal?.areaId);

  const line = (c: CalendarRow) => (
    <li key={c.calendarId} className="wk-callist-row" style={{ '--ev-h': hueOf(c.calendarId) } as CSSProperties}>
      <span className="wk-cal2-dot" aria-hidden="true" />
      <span className="wk-callist-main">
        <strong>{calendarLabel(areas, c)}</strong>
        <span className="wk-callist-rules">
          {c.itemKind !== undefined && c.itemKind !== 'appointment' && <span className="wk-tag">{CALENDAR_KIND_LABEL[c.itemKind]}</span>}
          {c.booking != null && (
            <span className="wk-tag">
              rezerwacje: {c.booking.mode === 'all' ? 'każdy termin' : 'oznaczone'} · {c.booking.capacity} miejsc
              {c.booking.reserveAreaId !== null ? ` · tylko ${groupName(areas, c.booking.reserveAreaId)}` : ''}
            </span>
          )}
          {c.visibilityAreaId != null && <span className="wk-tag">widzą: {groupName(areas, c.visibilityAreaId)}</span>}
          {c.mayWrite !== true && <span className="wk-tag">tylko podgląd</span>}
        </span>
        {c.description && <span className="wk-callist-desc">{c.description}</span>}
      </span>
      {c.mayWrite === true && (
        <button type="button" className="wk-link-btn" onClick={() => onEdit(c)}>Ustawienia</button>
      )}
    </li>
  );

  return (
    <Modal title="Kalendarze" onClose={onClose} wide>
      <p className="wk-hint">
        Grupa ma swój kalendarz od razu — a może mieć ich więcej (np. msze i spotkania osobno). Każdy mówi, jak działają
        jego terminy: kto je widzi, jak długo trwają i kto może je rezerwować.
      </p>
      {mine.length > 0 && (
        <section className="wk-callist">
          <h3 className="wk-res-h">Tylko ja</h3>
          <ul className="wk-callist-list">{mine.map(line)}</ul>
        </section>
      )}
      {groups.length > 0 && (
        <section className="wk-callist">
          <h3 className="wk-res-h">Kalendarze grup</h3>
          <ul className="wk-callist-list">{groups.map(line)}</ul>
        </section>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={onNew}>+ Nowy kalendarz</button>
        <button type="button" className="wk-btn wk-btn-quiet" onClick={onClose}>Zamknij</button>
      </div>
    </Modal>
  );
}

export default CalendarApp;
