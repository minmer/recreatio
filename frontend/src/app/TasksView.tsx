/**
 * ZADANIA (0054) — was zu tun ist, geordnet danach, wann.
 *
 * <code>
 *   Teraz        ein Fenster ist offen, oder eine Aufgabe mit Abstand ist fällig
 *   Zaległe      versäumt (heute oder gestern) — zum Nachholen, nicht zum Vergessen
 *   Dziś później
 *   Wkrótce      die nächsten sieben Tage
 *   Co pewien czas   die Aufgaben mit Abstand, jede mit ihrer laufenden Uhr
 *   Zrobione dziś
 * </code>
 *
 * Abgehakt wird mit einem Klick; ein Häkchen aus Versehen nimmt ein zweiter
 * Klick zurück. In einer Gruppe steht dabei, WER es erledigt hat.
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

import { loadAreas, type AreaRow } from './area';
import { hueOf } from './calendarModel';
import { addDays, startOfDay } from './dayMath';
import { useNow } from './MassParts';
import { useMe, type Me } from './me';
import type { Who } from './session';
import { WorkspaceError } from './session';
import { TaskDialog } from './TaskDialog';
import {
  afterState, everyWords, howLong, loadTasks, markDone, markUndone, openTasks, windowState,
  type OpenTask, type TaskOccurrence
} from './tasks';
import { groupName } from './WhoSees';

export function TasksView({ who }: { who: Who }) {
  const me = useMe(who);
  if (me === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null) return <p className="wk-note">Bez klucza w tej karcie zadania są zamknięte — zaloguj się ponownie albo odblokuj klucz.</p>;
  return <Tasks me={me} />;
}

interface Row {
  readonly key: string;
  readonly task: OpenTask;
  readonly occurrence: TaskOccurrence | null;
  readonly at: Date;
}

const REPEAT_WORD: Record<string, string> = {
  none: 'raz', daily: 'codziennie', weekly: 'co tydzień', monthly: 'co miesiąc', yearly: 'co rok'
};

const clock = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const dayWord = (at: Date, now: Date) => {
  const d = startOfDay(at).getTime();
  const t = startOfDay(now).getTime();
  if (d === t) return 'dziś';
  if (d === addDays(startOfDay(now), 1).getTime()) return 'jutro';
  if (d === addDays(startOfDay(now), -1).getTime()) return 'wczoraj';
  return at.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' });
};

function Tasks({ me }: { me: Me }) {
  const now = useNow();
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [tasks, setTasks] = useState<readonly OpenTask[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ task: OpenTask | null } | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const today = startOfDay(now).getTime();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = addDays(new Date(today), -2);
        const to = addDays(new Date(today), 8);
        const [found, list] = await Promise.all([loadAreas(), loadTasks(from, to)]);
        const opened = await openTasks(me.ring, list.tasks);
        if (!alive) return;
        setAreas(found.areas);
        setTasks(opened);
        setFailed(null);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać zadań.');
      }
    })();
    return () => { alive = false; };
  }, [me.ring, today, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const toggle = async (task: OpenTask, occurrence: TaskOccurrence | null) => {
    const key = `${task.taskId}:${occurrence?.at ?? 'now'}`;
    setBusy(key);
    try {
      if (occurrence !== null && occurrence.doneAt !== null) await markUndone(task.taskId, occurrence.at);
      else await markDone(task.taskId, me.person.id, occurrence?.at);
      reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  const undoAfter = async (task: OpenTask) => {
    if (task.lastDoneAt === null) return;
    setBusy(task.taskId);
    try {
      await markUndone(task.taskId, task.history[0]?.doneAt ?? task.lastDoneAt);
      reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (tasks === null) {
    return failed !== null ? <p className="wk-error">{failed}</p> : <p className="wk-hint">Wczytywanie…</p>;
  }

  /* Die Fenster, sortiert nach dem, was sie gerade sind. */
  const windows: Row[] = tasks.filter((t) => t.kind === 'window')
    .flatMap((task) => task.occurrences.map((occurrence) => ({ key: `${task.taskId}:${occurrence.at}`, task, occurrence, at: new Date(occurrence.at) })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const endOfToday = addDays(new Date(today), 1);
  const yesterday = addDays(new Date(today), -1);
  const state = (row: Row) => windowState(row.occurrence!, now);

  const openNow = windows.filter((r) => state(r) === 'open');
  const missed = windows.filter((r) => state(r) === 'missed' && r.at >= yesterday);
  const later = windows.filter((r) => state(r) === 'upcoming' && r.at < endOfToday);
  const soon = windows.filter((r) => state(r) === 'upcoming' && r.at >= endOfToday && r.at < addDays(new Date(today), 7));
  /* Heute erledigt — auch was man für morgen früh schon abgehakt hat; sonst verschwände es aus jeder Gruppe. */
  const doneToday = windows.filter((r) => state(r) === 'done'
    && ((r.at >= new Date(today) && r.at < endOfToday) || new Date(r.occurrence!.doneAt!) >= new Date(today)));

  const afters = tasks.filter((t) => t.kind === 'after')
    .map((task) => ({ task, ...afterState(task, now) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  const dueAfters = afters.filter((a) => a.late || a.due < endOfToday);

  const line = (row: Row) => (
    <WindowLine key={row.key} row={row} now={now} areas={areas} busy={busy === row.key}
      onToggle={() => void toggle(row.task, row.occurrence)} onOpen={() => setDialog({ task: row.task })} />
  );

  return (
    <div className="wk-tasks">
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => setDialog({ task: null })}>+ Nowe zadanie</button>
      </div>

      {failed !== null && <p className="wk-error">{failed}</p>}

      {tasks.length === 0 && (
        <p className="wk-empty">
          Nie masz jeszcze zadań. Zadanie ma swoją porę (np. modlitwa o 21:00 codziennie) albo wraca co pewien
          czas od wykonania (np. podlać kwiaty co 3 dni).
        </p>
      )}

      {(openNow.length > 0 || dueAfters.length > 0) && (
        <section className="wk-tasks-group is-now">
          <h2 className="wk-h2">Teraz</h2>
          {openNow.map(line)}
          {dueAfters.map((a) => (
            <AfterLine key={a.task.taskId} task={a.task} now={now} areas={areas} busy={busy !== null}
              onDone={() => void toggle(a.task, null)} onUndo={() => void undoAfter(a.task)} onOpen={() => setDialog({ task: a.task })} />
          ))}
        </section>
      )}

      {missed.length > 0 && (
        <section className="wk-tasks-group is-missed">
          <h2 className="wk-h2">Przegapione</h2>
          {missed.map(line)}
        </section>
      )}

      {later.length > 0 && (
        <section className="wk-tasks-group">
          <h2 className="wk-h2">Dziś później</h2>
          {later.map(line)}
        </section>
      )}

      {soon.length > 0 && (
        <section className="wk-tasks-group">
          <h2 className="wk-h2">W najbliższych dniach</h2>
          {soon.map(line)}
        </section>
      )}

      {afters.length > 0 && (
        <section className="wk-tasks-group">
          <h2 className="wk-h2">Co pewien czas</h2>
          {afters.filter((a) => !dueAfters.includes(a)).map((a) => (
            <AfterLine key={a.task.taskId} task={a.task} now={now} areas={areas} busy={busy !== null}
              onDone={() => void toggle(a.task, null)} onUndo={() => void undoAfter(a.task)} onOpen={() => setDialog({ task: a.task })} />
          ))}
          {afters.every((a) => dueAfters.includes(a)) && <p className="wk-hint">Wszystkie są teraz do zrobienia — wyżej.</p>}
        </section>
      )}

      {doneToday.length > 0 && (
        <section className="wk-tasks-group is-done">
          <h2 className="wk-h2">Zrobione dziś</h2>
          {doneToday.map(line)}
        </section>
      )}

      {dialog !== null && (
        <TaskDialog me={me} areas={areas} task={dialog.task} onClose={() => setDialog(null)} onSaved={reload} />
      )}
    </div>
  );
}

function WindowLine({ row, now, areas, busy, onToggle, onOpen }: {
  row: Row;
  now: Date;
  areas: readonly AreaRow[];
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const occurrence = row.occurrence!;
  const done = occurrence.doneAt !== null;
  const state = windowState(occurrence, now);
  const end = new Date(occurrence.endsAt);
  const task = row.task;

  const badge = state === 'open' ? (end.getTime() - now.getTime() > 60_000 ? `jeszcze ${howLong(end, now).replace('za ', '')}` : 'teraz')
    : state === 'upcoming' ? howLong(row.at, now)
    : state === 'missed' ? 'przegapione'
    : `zrobione ${clock(new Date(occurrence.doneAt!))}`;

  return (
    <div className={`wk-task is-${state}`} style={{ '--ev-h': hueOf(task.areaId) } as CSSProperties}>
      <button type="button" role="checkbox" aria-checked={done} disabled={busy || state === 'upcoming' && row.at.getTime() - now.getTime() > 86400_000}
        className={`wk-task-tick${done ? ' is-done' : ''}`} aria-label={done ? `Cofnij: ${task.title}` : `Zrobione: ${task.title}`}
        onClick={onToggle}>
        {done ? '✓' : ''}
      </button>
      <button type="button" className="wk-task-main" onClick={onOpen}>
        <span className="wk-task-title">{task.title}</span>
        <span className="wk-task-when">
          {dayWord(row.at, now)} {clock(row.at)}
          {task.windowMinutes > 0 && `–${clock(end)}`}
          {' · '}{REPEAT_WORD[task.repeatKind] ?? ''}
          {' · '}{groupName(areas, task.areaId)}
        </span>
      </button>
      <span className={`wk-task-badge is-${state}`}>{badge}</span>
    </div>
  );
}

/** Eine Aufgabe mit Abstand: die laufende Uhr als Balken, und wann sie wieder dran ist. */
function AfterLine({ task, now, areas, busy, onDone, onUndo, onOpen }: {
  task: OpenTask;
  now: Date;
  areas: readonly AreaRow[];
  busy: boolean;
  onDone: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const { due, progress, late } = afterState(task, now);
  const doneRecently = task.lastDoneAt !== null && now.getTime() - new Date(task.lastDoneAt).getTime() < 10 * 60_000;

  return (
    <div className={`wk-task is-after${late ? ' is-late' : ''}`} style={{ '--ev-h': hueOf(task.areaId) } as CSSProperties}>
      <button type="button" className={`wk-task-tick${doneRecently ? ' is-done' : ''}`} disabled={busy}
        aria-label={`Zrobione: ${task.title}`} onClick={onDone}>
        {doneRecently ? '✓' : ''}
      </button>
      <button type="button" className="wk-task-main" onClick={onOpen}>
        <span className="wk-task-title">{task.title}</span>
        <span className="wk-task-when">
          {everyWords(task.everyMinutes ?? 0)}
          {' · '}{task.lastDoneAt === null ? 'jeszcze ani razu' : `ostatnio ${howLong(new Date(task.lastDoneAt), now)}`}
          {' · '}{groupName(areas, task.areaId)}
        </span>
        <span className="wk-task-meter" aria-hidden="true">
          <span className="wk-task-fill" style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }} />
        </span>
      </button>
      <span className={`wk-task-badge${late ? ' is-missed' : ''}`}>
        {late ? `zaległe ${howLong(due, now).replace(' temu', '')}` : `następne ${howLong(due, now)}`}
      </span>
      {doneRecently && <button type="button" className="wk-link-btn" disabled={busy} onClick={onUndo}>Cofnij</button>}
    </div>
  );
}

export default TasksView;
