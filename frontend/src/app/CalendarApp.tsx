/**
 * DER EIGENE KALENDER (0054) — alles, was ich sehe, an einer Stelle, und so
 * zu bedienen, wie man es aus jedem Kalender kennt.
 *
 * <code>
 *   Dzień · Tydzień   ein Stundenraster; ein Klick in eine leere Stunde legt
 *                     dort einen Termin an, ein Klick auf einen Termin öffnet ihn
 *   Miesiąc           das Monatsblatt; ein Tag darin öffnet diesen Tag
 *   Lista             die nächsten dreissig Tage, der Reihe nach
 * </code>
 *
 * <b>Was hier steht</b>: die Termine jeder Gruppe, deren Schlüssel ich halte
 * (auch Messen, wenn ich eine solche Gruppe halte), meine Buchungen, meine
 * Aufgaben — jede Gruppe in ihrer eigenen Farbe, und jede lässt sich
 * ausblenden. Welche Ansicht und welche Gruppen, merkt sich der Arbeitsplatz
 * (versiegelt, `prefs.ts`).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { loadAgenda, openAgenda, type AgendaClaim, type OpenedItem } from './agenda';
import { loadAreas, type AreaRow } from './area';
import {
  buildEvents, hueOf, onDay as happensOn, placeDay, stepView, viewRange, wholeDay, type CalEvent, type CalView
} from './calendarModel';
import { addDays, keyOf, longDate, monthTitle, rangeTitle, sameDay, sameMonth, startOfDay, WEEK_HEADS } from './dayMath';
import { EventDialog, type EventTarget } from './EventDialog';
import { useNow } from './MassParts';
import { useMe, type Me } from './me';
import { useRemembered } from './prefs';
import type { Who } from './session';
import { WorkspaceError } from './session';
import { TaskDialog } from './TaskDialog';
import { loadTasks, markDone, markUndone, openTasks, type OpenTask } from './tasks';
import { groupName } from './WhoSees';

const VIEWS: readonly { value: CalView; label: string }[] = [
  { value: 'day', label: 'Dzień' }, { value: 'week', label: 'Tydzień' },
  { value: 'month', label: 'Miesiąc' }, { value: 'list', label: 'Lista' }
];

/** Wie hoch eine Stunde im Raster ist. */
const HOUR = 48;

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

export function CalendarApp({ who }: { who: Who }) {
  const me = useMe(who);

  if (me === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null) {
    return <p className="wk-note">Bez klucza w tej karcie kalendarz jest zamknięty — zaloguj się ponownie albo odblokuj klucz.</p>;
  }

  return <Calendar me={me} />;
}

interface Loaded {
  readonly from: number;
  readonly to: number;
  readonly items: readonly OpenedItem[];
  readonly claims: readonly AgendaClaim[];
  readonly tasks: readonly OpenTask[];
}

function Calendar({ me }: { me: Me }) {
  const [viewText, setViewText] = useRemembered('calendar.view', 'week');
  const [hiddenText, setHiddenText] = useRemembered('calendar.hidden', '');
  const view: CalView = (['day', 'week', 'month', 'list'] as const).includes(viewText as CalView) ? viewText as CalView : 'week';
  const hidden = new Set(hiddenText.split(',').filter((one) => one !== ''));

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const now = useNow();
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EventTarget | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ task: OpenTask | null; at?: Date } | null>(null);
  const [tick, setTick] = useState(0);

  const range = viewRange(view, anchor);
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date(fromMs);
        const to = new Date(toMs);
        const [found, agenda, tasks] = await Promise.all([loadAreas(), loadAgenda(from, to), loadTasks(from, to)]);
        const items = await openAgenda(me.ring, agenda.occurrences, found.areas);
        const opened = await openTasks(me.ring, tasks.tasks);
        if (!alive) return;
        setAreas(found.areas);
        setData({ from: fromMs, to: toMs, items, claims: agenda.claims, tasks: opened });
        setFailed(null);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać kalendarza.');
      }
    })();
    return () => { alive = false; };
  }, [me.ring, fromMs, toMs, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const all = data === null ? [] : buildEvents(data.items, data.claims, data.tasks, now, { from: new Date(data.from), to: new Date(data.to) });
  const events = all.filter((e) => !hidden.has(e.areaId));
  const groups = [...new Set(all.map((e) => e.areaId))]
    .map((areaId) => ({ areaId, name: groupName(areas, areaId) }))
    .sort((a, b) => (a.name === 'Tylko ja' ? -1 : b.name === 'Tylko ja' ? 1 : a.name.localeCompare(b.name, 'pl')));

  const toggleGroup = (areaId: string) => {
    const next = new Set(hidden);
    if (next.has(areaId)) next.delete(areaId); else next.add(areaId);
    setHiddenText([...next].join(','));
  };

  const label = view === 'day' ? longDate(anchor)
    : view === 'month' ? monthTitle(anchor)
    : rangeTitle(range.from, range.to);

  const newAt = (start: Date, allDay = false) =>
    setDialog({ at: 'new', start, end: allDay ? addDays(start, 1) : new Date(start.getTime() + 3600_000), allDay });

  const open = (event: CalEvent) => {
    if (event.source === 'task' && event.task !== undefined) setTaskDialog({ task: event.task });
    else setDialog({ at: 'event', event });
  };

  const toggleTask = async (event: CalEvent) => {
    if (event.task === undefined) return;
    try {
      if (event.taskOccurrence !== undefined) {
        if (event.taskOccurrence.doneAt !== null) await markUndone(event.task.taskId, event.taskOccurrence.at);
        else await markDone(event.task.taskId, me.person.id, event.taskOccurrence.at);
      } else {
        await markDone(event.task.taskId, me.person.id);
      }
      reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się odhaczyć.');
    }
  };

  const days = view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i));

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
          <button type="button" className="wk-btn" onClick={() => {
            const at = new Date(Math.max(now.getTime(), anchor.getTime()));
            at.setMinutes(0, 0, 0);
            at.setHours(at.getHours() + 1);
            newAt(at);
          }}>+ Termin</button>
          <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setTaskDialog({ task: null })}>+ Zadanie</button>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="wk-cal2-groups" role="group" aria-label="Pokaż grupy">
          {groups.map((g) => (
            <button key={g.areaId} type="button" className={`wk-cal2-group${hidden.has(g.areaId) ? ' is-off' : ''}`}
              aria-pressed={!hidden.has(g.areaId)} style={{ '--ev-h': hueOf(g.areaId) } as CSSProperties}
              onClick={() => toggleGroup(g.areaId)}>
              <span className="wk-cal2-dot" aria-hidden="true" />
              {g.name}
            </button>
          ))}
        </div>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {data === null && failed === null && <p className="wk-hint">Wczytywanie…</p>}

      {data !== null && (view === 'day' || view === 'week') && (
        <TimeGrid days={days} events={events} now={now}
          onDay={(day) => { setAnchor(day); setViewText('day'); }}
          onSlot={(at, allDay) => newAt(at, allDay)} onOpen={open} onToggle={(e) => void toggleTask(e)} areas={areas} />
      )}

      {data !== null && view === 'month' && (
        <MonthGrid anchor={anchor} from={range.from} events={events} now={now}
          onDay={(day) => { setAnchor(day); setViewText('day'); }} onSlot={(at) => newAt(at)} onOpen={open} />
      )}

      {data !== null && view === 'list' && (
        <ListView from={range.from} events={events} now={now} areas={areas} onOpen={open} onToggle={(e) => void toggleTask(e)} />
      )}

      {dialog !== null && (
        <EventDialog me={me} areas={areas} target={dialog} onClose={() => setDialog(null)} onSaved={reload} />
      )}

      {taskDialog !== null && (
        <TaskDialog me={me} areas={areas} task={taskDialog.task} at={taskDialog.at}
          onClose={() => setTaskDialog(null)} onSaved={reload} />
      )}
    </div>
  );
}

/* -- Ein Termin, gezeichnet ----------------------------------------------------------- */

function chipClass(event: CalEvent): string {
  return ['wk-ev', `is-${event.source}`,
    event.cancelled && 'is-cancelled',
    event.taskState !== undefined && `is-task-${event.taskState}`]
    .filter(Boolean).join(' ');
}

/** Das Häkchen einer Aufgabe — im Raster, im Monat, in der Liste dasselbe. */
function TaskTick({ event, onToggle }: { event: CalEvent; onToggle: (event: CalEvent) => void }) {
  const done = event.taskState === 'done';
  return (
    <span
      role="checkbox"
      aria-checked={done}
      tabIndex={0}
      className={`wk-ev-tick${done ? ' is-done' : ''}`}
      title={done ? 'Cofnij odhaczenie' : 'Odhacz jako zrobione'}
      onClick={(e) => { e.stopPropagation(); onToggle(event); }}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onToggle(event); } }}
    >
      {done ? '✓' : ''}
    </span>
  );
}

/* -- Tag und Woche: das Stundenraster ----------------------------------------------------- */

function TimeGrid({ days, events, now, onDay, onSlot, onOpen, onToggle, areas }: {
  days: readonly Date[];
  events: readonly CalEvent[];
  now: Date;
  onDay: (day: Date) => void;
  onSlot: (at: Date, allDay: boolean) => void;
  onOpen: (event: CalEvent) => void;
  onToggle: (event: CalEvent) => void;
  areas: readonly AreaRow[];
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const first = keyOf(days[0]);
  const count = days.length;

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
    onSlot(at, false);
  };

  return (
    <div className="wk-cal2-grid" style={{ '--days': days.length, '--hour': `${HOUR}px` } as CSSProperties}>
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
              <button key={e.key} type="button" className={chipClass(e)} style={{ '--ev-h': hueOf(e.areaId) } as CSSProperties}
                title={`${e.title} · ${groupName(areas, e.areaId)}`} onClick={() => onOpen(e)}>
                {e.title}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="wk-cal2-scroll" ref={scroller}>
        <div className="wk-cal2-body">
          <div className="wk-cal2-hours" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => <span key={h} className="wk-cal2-hour">{h === 0 ? '' : `${h}:00`}</span>)}
          </div>

          {days.map((day) => (
            <div key={keyOf(day)} className={`wk-cal2-col${sameDay(day, now) ? ' is-today' : ''}`}
              onClick={(e) => { if (e.target === e.currentTarget) slotFrom(day, e); }}>
              {placeDay(events, day).map((p) => (
                <button key={p.event.key} type="button" className={`${chipClass(p.event)}${p.height < 45 ? ' is-short' : ''}`}
                  style={{
                    '--ev-h': hueOf(p.event.areaId),
                    top: `${(p.top / 60) * HOUR}px`,
                    height: `${Math.max((p.height / 60) * HOUR - 2, 18)}px`,
                    left: `calc(${(p.column / p.columns) * 100}% + 2px)`,
                    width: `calc(${100 / p.columns}% - 4px)`
                  } as CSSProperties}
                  title={`${time(p.event.start)}–${time(p.event.end)} ${p.event.title} · ${groupName(areas, p.event.areaId)}`}
                  onClick={() => onOpen(p.event)}>
                  {p.event.source === 'task' && <TaskTick event={p.event} onToggle={onToggle} />}
                  <span className="wk-ev-time">{time(p.event.start)}</span>
                  <span className="wk-ev-title">{p.event.title}</span>
                </button>
              ))}

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

/* -- Der Monat --------------------------------------------------------------------------- */

function MonthGrid({ anchor, from, events, now, onDay, onSlot, onOpen }: {
  anchor: Date;
  from: Date;
  events: readonly CalEvent[];
  now: Date;
  onDay: (day: Date) => void;
  onSlot: (at: Date) => void;
  onOpen: (event: CalEvent) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const SHOWN = 3;

  return (
    <div className="wk-cal2-month">
      {WEEK_HEADS.map((head) => <span key={head} className="wk-mass-month-dow" aria-hidden="true">{head}</span>)}
      {days.map((day) => {
        const mine = events.filter((e) => happensOn(e, day)).sort((a, b) => Number(wholeDay(b)) - Number(wholeDay(a)));
        return (
          <div key={keyOf(day)}
            className={`wk-cal2-cell${sameMonth(day, anchor) ? '' : ' is-out'}${sameDay(day, now) ? ' is-today' : ''}`}
            onClick={(e) => { if (e.target === e.currentTarget) { const at = new Date(day); at.setHours(9, 0, 0, 0); onSlot(at); } }}>
            <button type="button" className="wk-cal2-cellday" aria-label={longDate(day)} onClick={() => onDay(day)}>{day.getDate()}</button>
            {mine.slice(0, SHOWN).map((e) => (
              <button key={e.key} type="button" className={`${chipClass(e)} is-line`} style={{ '--ev-h': hueOf(e.areaId) } as CSSProperties}
                title={e.title} onClick={() => onOpen(e)}>
                {!wholeDay(e) && <span className="wk-ev-time">{time(e.start)}</span>}
                <span className="wk-ev-title">{e.title}</span>
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

function ListView({ from, events, now, areas, onOpen, onToggle }: {
  from: Date;
  events: readonly CalEvent[];
  now: Date;
  areas: readonly AreaRow[];
  onOpen: (event: CalEvent) => void;
  onToggle: (event: CalEvent) => void;
}) {
  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i))
    .map((day) => ({ day, list: events.filter((e) => happensOn(e, day)) }))
    .filter((one) => one.list.length > 0);

  if (days.length === 0) return <p className="wk-empty">W tych dniach nic nie ma.</p>;

  return (
    <div className="wk-cal2-list">
      {days.map(({ day, list }) => (
        <section key={keyOf(day)} className={`wk-cal2-listday${sameDay(day, now) ? ' is-today' : ''}`}>
          <h3 className="wk-mass-day-name">{longDate(day)}</h3>
          {list.map((e) => (
            <div key={e.key} className="wk-cal2-listrow" style={{ '--ev-h': hueOf(e.areaId) } as CSSProperties}>
              <span className="wk-cal2-dot" aria-hidden="true" />
              <span className="wk-cal2-listtime">{wholeDay(e) ? 'cały dzień' : `${time(e.start)}–${time(e.end)}`}</span>
              {e.source === 'task' && <TaskTick event={e} onToggle={onToggle} />}
              <button type="button" className={`wk-link-btn wk-cal2-listtitle${e.cancelled ? ' is-cancelled' : ''}`} onClick={() => onOpen(e)}>
                {e.title}
              </button>
              <span className="wk-row-side">{groupName(areas, e.areaId)}{e.source === 'claim' ? ' · rezerwacja' : ''}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default CalendarApp;
