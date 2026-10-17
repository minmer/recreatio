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
 * Pille öffnet dann die Liste des Tages.
 *
 * <b>Reservierungen stehen am Termin</b> (0057): an einem angebotenen Termin,
 * wie viele Plätze besetzt sind und wer wartet; ein Klick zeigt die
 * Kandidaten und lässt die Kanzlei entscheiden (`ReservationDialog.tsx`).
 * Was irgendwo auf ein Ja wartet, sammelt „Do potwierdzenia".
 */

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { loadAgenda, openAgenda, type AgendaClaim, type OpenedItem } from './agenda';
import { loadAreas, type AreaRow } from '../areas/area';
import {
  holderName, loadBookings, NO_BOOKINGS, waitingOn, waitsForOffice, type AgendaBookings
} from './calendarBookings';
import {
  buildEvents, hueOf, laneDay, linkOfEvent, marksOn, treeOrder, onDay as happensOn, placeDay, railDay, settled, stepView, taskMarks, viewRange,
  wholeDay, type CalEvent, type CalView, type Laned, type Placed, type TaskMark
} from './calendarModel';
import { addDays, keyOf, longDate, monthTitle, rangeTitle, sameDay, sameMonth, startOfDay, WEEK_HEADS } from '../core/dayMath';
import { CALENDAR_KIND_LABEL, loadCalendars, type CalendarRow } from './calendar';
import { CalendarSettings } from './CalendarSettings';
import { calendarLabel } from './calendarLabel';
import type { EventTarget } from './EventDialog';
import { ItemLink } from './ItemLink';
import { intentionsWord } from '../masses/mass';
import { useNow } from '../masses/MassParts';
import { Modal } from '../ui/Modal';
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

/** Wie hoch eine Stunde im Raster ist. */
const HOUR = 48;

/** 0074 — die Kopfzeile eines Termins mit Teilen, in Minuten des Rasters: so weit rücken seine Teile, die mit ihm beginnen, nach unten. */
const PART_HEAD = (20 / HOUR) * 60;

/** Wie breit die Schiene der Aufgaben am Rand eines Tages ist. */
const RAIL = 13;

/** 2026-10-17 — wie breit die Termine als Schiene sind, wenn die Aufgaben den Tag haben. */
const EVENT_RAIL = 16;

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

  const range = viewRange(view, anchor);
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
    add: (at) => setTaskDialog({ task: null, at })
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
    : view === 'month' ? monthTitle(anchor)
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

  const open = (event: CalEvent) => {
    if (event.source === 'offer' || event.source === 'booking') setReservation(event.key);
    else setDialog({ at: 'event', event });
  };

  /* Der Termin, dessen Reservierungen offen sind — aus den FRISCHEN Daten, damit ein Ja sofort dasteht. */
  const shownReservation = reservation === null ? null : all.find((e) => e.key === reservation) ?? null;

  const days = view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  const waiting = bookings.waiting.length;

  return (
    <div className="wk-cal2">
      <div className="wk-cal2-bar">
        <div className="wk-mass-nav">
          <button type="button" className="wk-mass-step" aria-label="Wcześniej" onClick={() => setAnchor(stepView(view, anchor, -1))}>‹</button>
          <button type="button" className="wk-mass-today" aria-pressed={sameDay(anchor, now)} onClick={() => setAnchor(startOfDay(new Date()))}>Dziś</button>
          <button type="button" className="wk-mass-step" aria-label="Później" onClick={() => setAnchor(stepView(view, anchor, 1))}>›</button>
        </div>
        <p className="wk-mass-range" aria-live="polite">
          {label}
          {data !== null && (data.from !== fromMs || data.to !== toMs) && <span className="wk-mass-loading"> · wczytywanie…</span>}
        </p>
        <div className="wk-seg" role="group" aria-label="Widok">
          {VIEWS.map((one) => (
            <button key={one.value} type="button" aria-pressed={one.value === view}
              className={one.value === view ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => setViewText(one.value)}>
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

      {data !== null && (view === 'day' || view === 'week') && (
        <TimeGrid days={days} events={events} marks={marks} now={now}
          onDay={(day) => { setAnchor(day); setViewText('day'); }}
          onSlot={(at, allDay) => newAt(at, allDay)} onOpen={open} onTasks={setTaskDay} areas={areas}
          focus={focus} onFocus={setFocusText} tasks={taskActs} />
      )}

      {data !== null && view === 'month' && (
        <MonthGrid anchor={anchor} from={range.from} events={events} marks={marks} now={now}
          onDay={(day) => { setAnchor(day); setViewText('day'); }} onOpen={open} onTasks={setTaskDay} />
      )}

      {data !== null && view === 'list' && (
        <ListView from={range.from} events={events} marks={marks} now={now} areas={areas} onOpen={open} onTasks={setTaskDay} />
      )}

      {dialog !== null && (
        <Suspense fallback={null}>
        <EventDialog me={me} areas={areas} calendars={calendars} scope={scope} target={dialog} events={all}
          onClose={() => setDialog(null)} onSaved={reload}
          onAddPart={(parent) => setDialog({
            at: 'new', start: parent.start, end: new Date(parent.start.getTime() + 3_600_000), allDay: false,
            calendarId: parent.item?.occurrence.calendarId, parentItemId: parent.item?.occurrence.itemId, parentTitle: parent.item?.title
          })} />
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

function chipClass(event: CalEvent): string {
  const offer = event.offer;
  const waits = offer !== undefined ? waitingOn(offer) > 0 : event.booking !== undefined && waitsForOffice(event.booking);
  return ['wk-ev', `is-${event.source}`,
    event.cancelled && 'is-cancelled',
    event.mine === true && 'is-mine',
    offer !== undefined && offer.taken >= offer.capacity && 'is-full',
    offer !== undefined && offer.taken === 0 && 'is-empty',
    offer?.closedBy != null && 'is-closed',
    waits && 'has-waiting']
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
export function TimeGrid({ days, events, marks, now, onDay, onSlot, onOpen, onTasks, areas, readOnly = false, focus = 'events', onFocus, tasks }: {
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
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
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
    el.scrollTop = Math.min(hour, 16) * HOUR;
  }, [first, count]);

  const slotFrom = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((e.clientY - box.top) / HOUR) * 2) * 30;
    const at = new Date(day);
    at.setHours(0, Math.max(0, Math.min(minutes, 23 * 60 + 30)), 0, 0);
    /* Haben die Aufgaben die Breite, entsteht im Leeren eine Aufgabe. */
    if (wide) tasks.add(at);
    else onSlot(at, false);
  };

  return (
    <div className={`wk-cal2-grid${readOnly ? ' is-readonly' : ''}${wide ? ' is-tasks' : ''}`}
      style={{ '--days': days.length, '--hour': `${HOUR}px`, '--rail': `${rail}px`, '--evrail': `${EVENT_RAIL}px` } as CSSProperties}>
      <div className="wk-cal2-head">
        <span className="wk-cal2-corner" />
        {days.map((day) => (
          <button key={keyOf(day)} type="button" className={`wk-cal2-dayhead${sameDay(day, now) ? ' is-today' : ''}`}
            aria-label={longDate(day)} onClick={() => onDay(day)}>
            <span className="wk-cal2-dow">{WEEK_HEADS[(day.getDay() + 6) % 7]}</span>
            <span className="wk-cal2-date">{day.getDate()}</span>
          </button>
        ))}
      </div>

      <div className="wk-cal2-allday">
        <span className="wk-cal2-corner wk-cal2-alllabel">cały dzień</span>
        {days.map((day) => (
          <div key={keyOf(day)} className="wk-cal2-allcell"
            onClick={(e) => { if (e.target === e.currentTarget) onSlot(startOfDay(day), true); }}>
            {events.filter((e) => wholeDay(e) && happensOn(e, day)).map((e) => (
              <button key={e.key} type="button" className={chipClass(e)} style={{ '--ev-h': hueOfEvent(e) } as CSSProperties}
                title={hint(e, areas)} onClick={() => onOpen(e)}>
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
              <TaskPill marks={marksOn(marks, day)} onOpen={() => (wide || onFocus === undefined || tasks === undefined ? onTasks(day) : onFocus('tasks'))} />
              {/* Was von früher heute steht, hat keine Uhrzeit — breit steht es hier, zum Abhaken. */}
              {wide && marksOn(marks, day).filter((m) => m.carried).map((m) => <TaskBlock key={m.key} mark={m} now={now} acts={tasks} />)}
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
            <div key={keyOf(day)} className={`wk-cal2-col${sameDay(day, now) ? ' is-today' : ''}`}
              onClick={(e) => { if (e.target === e.currentTarget) slotFrom(day, e); }}>
              {/* Ein Klick auf die Schiene gibt den Aufgaben die Breite; ohne das Umschalten öffnet er ihre Liste. */}
              {rail > 0 && !wide && <Rail marks={marks} day={day} onOpen={() => (onFocus !== undefined && tasks !== undefined ? onFocus('tasks') : onTasks(day))} />}

              {wide && laneDay(marks, day).map((p) => <TaskBlock key={p.mark.key} mark={p.mark} now={now} acts={tasks} placed={p} />)}
              {wide && <EventRail events={events} day={day} areas={areas} onOpen={() => onFocus('events')} />}

              {!wide && placeDay(events, day, PART_HEAD).map((p) => {
                const who = whoIsOn(p.event);
                return (
                  <button key={p.event.key} type="button"
                    className={`${chipClass(p.event)}${p.height < 45 ? ' is-short' : ''}${p.depth > 0 ? ' is-part' : ''}${p.nested ? ' has-parts' : ''}`}
                    style={{
                      '--ev-h': hueOfEvent(p.event),
                      top: `${(p.top / 60) * HOUR}px`,
                      height: `${Math.max((p.height / 60) * HOUR - 2, 18)}px`,
                      left: `calc(var(--rail) + (100% - var(--rail)) * ${p.x} + 2px)`,
                      width: `calc((100% - var(--rail)) * ${p.w} - 4px)`,
                      zIndex: 1 + p.depth
                    } as CSSProperties}
                    title={hint(p.event, areas)}
                    onClick={() => onOpen(p.event)}>
                    <span className="wk-ev-line">
                      <span className="wk-ev-time">{time(p.event.start)}</span>
                      {p.nested && <span className="wk-ev-title is-head">{p.event.title}</span>}
                      <Badges event={p.event} />
                    </span>
                    {!p.nested && <span className="wk-ev-title">{p.event.title}</span>}
                    {who !== null && p.height >= 60 && <span className="wk-ev-sub">{who}</span>}
                  </button>
                );
              })}

              {sameDay(day, now) && (
                <span className="wk-cal2-now" style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR}px` }} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
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
            top: `${(r.top / 60) * HOUR}px`,
            height: `${(r.height / 60) * HOUR}px`,
            left: `${2 + r.lane * 4}px`
          } as CSSProperties} />
      ))}
    </button>
  );
}

/** Wo ein Kasten einer Aufgabe steht: links, in der Breite des Tages ohne die Schiene der Termine. */
const taskPlace = (p: Laned, areaId: string): CSSProperties => ({
  '--ev-h': hueOf(areaId),
  top: `${(p.top / 60) * HOUR}px`,
  height: `${Math.max((p.height / 60) * HOUR - 2, 22)}px`,
  left: `calc((100% - var(--evrail)) * ${p.x} + 2px)`,
  width: `calc((100% - var(--evrail)) * ${p.w} - 4px)`
} as CSSProperties);

/**
 * 2026-10-17 — EINE AUFGABE, BREIT: Häkchen (zurücknehmen geht auch), Zeit,
 * Name, der Stand in Worten und „pomiń" — dieselben Handgriffe wie in der
 * Liste des Tages. Ein Klick auf den Namen öffnet die Aufgabe. Ohne `placed`
 * steht sie in der Zeile „zadania" (was von früher heute steht).
 */
function TaskBlock({ mark, now, acts, placed }: { mark: TaskMark; now: Date; acts: TaskActs; placed?: Laned }) {
  const done = settled(mark);
  const short = placed !== undefined && placed.height < 45;
  const busy = acts.busy === mark.key;
  return (
    <div
      className={`wk-tb is-${mark.state}${placed === undefined ? ' is-chip' : ''}${short ? ' is-short' : ''}${busy ? ' is-busy' : ''}`}
      style={placed === undefined ? { '--ev-h': hueOf(mark.areaId) } as CSSProperties : taskPlace(placed, mark.areaId)}
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
          {placed !== undefined && <span className="wk-tb-time">{time(mark.start)}</span>}
          <span className="wk-tb-title">{mark.task.title}</span>
        </span>
        {/* In der Zeile des Tages steht, was von früher liegen blieb: dort zählt, seit wann. */}
        {!short && <span className={`wk-tb-state is-${mark.state}`}>{stateOf(mark, now)}{placed === undefined ? ` · ${whenOf(mark)}` : ''}</span>}
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
const railPlace = (p: Placed, hue: number): CSSProperties => ({
  '--ev-h': hue,
  top: `${(p.top / 60) * HOUR}px`,
  height: `${Math.max((p.height / 60) * HOUR - 2, 6)}px`,
  left: `${2 + p.x * (EVENT_RAIL - 4)}px`,
  width: `${Math.max(p.w * (EVENT_RAIL - 4) - 1, 3)}px`
} as CSSProperties);

/**
 * 2026-10-17 — DIE TERMINE ALS SCHIENE, am rechten Rand, solange die Aufgaben
 * den Tag haben: jeder Termin ein Strich in seiner Farbe. Ein Klick darauf
 * gibt den Terminen die Breite zurück.
 */
function EventRail({ events, day, areas, onOpen }: { events: readonly CalEvent[]; day: Date; areas: readonly AreaRow[]; onOpen: () => void }) {
  const placed = placeDay(events, day, PART_HEAD).filter((p) => p.depth === 0);
  return (
    <button type="button" className="wk-cal2-evrail" aria-label={`Terminy: ${longDate(day)} — pokaż szeroko`} title="Terminy szeroko" onClick={onOpen}>
      {placed.map((p) => (
        <span key={p.event.key} className={`wk-evrail-bar${p.event.cancelled ? ' is-cancelled' : ''}`} title={hint(p.event, areas)}
          style={railPlace(p, hueOfEvent(p.event))} />
      ))}
    </button>
  );
}

/* -- Der Monat --------------------------------------------------------------------------- */

/**
 * Der Monat. 2026-10-17 — ein Klick auf einen Tag ÖFFNET diesen Tag (auch ins
 * Leere der Zelle): wer im Monat blättert, sucht einen Tag; ein Termin um neun
 * Uhr, der bei jedem Klick aufging, war nie gemeint. Neu anlegen: „+ Termin".
 */
export function MonthGrid({ anchor, from, events, marks, now, onDay, onOpen, onTasks, readOnly = false }: {
  anchor: Date;
  from: Date;
  events: readonly CalEvent[];
  marks: readonly TaskMark[];
  now: Date;
  onDay: (day: Date) => void;
  onOpen: (event: CalEvent) => void;
  onTasks: (day: Date) => void;
  readOnly?: boolean;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const SHOWN = 3;

  return (
    <div className={`wk-cal2-month${readOnly ? ' is-readonly' : ''}`}>
      {WEEK_HEADS.map((head) => <span key={head} className="wk-mass-month-dow" aria-hidden="true">{head}</span>)}
      {days.map((day) => {
        /* 0074 — Teile stehen im Monat nicht einzeln: ihr Ganzes sagt, wie viele es hat. */
        const mine = treeOrder(events.filter((e) => happensOn(e, day))).filter((t) => t.depth === 0);
        return (
          <div key={keyOf(day)}
            className={`wk-cal2-cell${sameMonth(day, anchor) ? '' : ' is-out'}${sameDay(day, now) ? ' is-today' : ''}`}
            onClick={(e) => { if ((e.target as Element).closest('button, a') === null) onDay(day); }}>
            <span className="wk-cal2-cellhead">
              <button type="button" className="wk-cal2-cellday" aria-label={longDate(day)} onClick={() => onDay(day)}>{day.getDate()}</button>
              <TaskPill marks={marksOn(marks, day)} onOpen={() => onTasks(day)} mini />
            </span>
            {mine.slice(0, SHOWN).map(({ event: e, parts }) => (
              <button key={e.key} type="button" className={`${chipClass(e)} is-line`} style={{ '--ev-h': hueOfEvent(e) } as CSSProperties}
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
  );
}

/* -- Die Liste ------------------------------------------------------------------------------- */

export function ListView({ from, events, marks, now, areas, onOpen, onTasks }: {
  from: Date;
  events: readonly CalEvent[];
  marks: readonly TaskMark[];
  now: Date;
  areas: readonly AreaRow[];
  onOpen: (event: CalEvent) => void;
  onTasks: (day: Date) => void;
}) {
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
        <section key={keyOf(day)} className={`wk-cal2-listday${sameDay(day, now) ? ' is-today' : ''}`}>
          <div className="wk-cal2-listhead">
            <h3 className="wk-mass-day-name">{longDate(day)}</h3>
            <TaskPill marks={tasks} onOpen={() => onTasks(day)} />
          </div>
          {treeOrder(list).map(({ event: e, depth }) => (
            <div key={e.key} className={`wk-cal2-listrow${depth > 0 ? ' is-part' : ''}`} style={{ '--ev-h': hueOfEvent(e), '--depth': depth } as CSSProperties}>
              {depth > 0 && <span className="wk-cal2-partmark" aria-hidden="true">↳</span>}
              <span className="wk-cal2-dot" aria-hidden="true" />
              <span className="wk-cal2-listtime">{wholeDay(e) ? 'cały dzień' : `${time(e.start)}–${time(e.end)}`}</span>
              <button type="button" className={`wk-link-btn wk-cal2-listtitle${e.cancelled ? ' is-cancelled' : ''}`} onClick={() => onOpen(e)}>
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
