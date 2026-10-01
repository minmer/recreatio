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
 * Klick zurück. In einer Gruppe steht dabei, WER es erledigt hat. Daneben steht
 * „Pomiń" — dieses eine Mal nicht: das Vorkommen ist entschieden und drängt
 * nicht mehr, aber es behauptet niemand, es sei getan.
 *
 * Wie sehr etwas drängt, ist keine Frage der Uhrzeit allein, sondern der
 * DRINGLICHKEIT (urgency.ts): sie beginnt bei 0, wenn das Fenster aufgeht, ist
 * 1, wenn es zugeht, und wächst danach weiter — einen Punkt je Fensterlänge.
 * Darum überholt eine verpasste Viertelstunde binnen einer Stunde eine
 * versäumte Monatsaufgabe: wer die enge Zeit gesetzt hat, meinte sie. Innerhalb
 * jeder Gruppe steht das Dringlichste oben, der Balken unter dem Titel zeigt
 * den Stand, und nach dem Ende sagt das Abzeichen, um wie viel es zu spät ist.
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
  afterState, everyWords, howLong, loadTasks, markDone, markSkipped, markUndone, openTasks,
  taskLevel, taskUrgency, windowState, type OpenTask, type TaskOccurrence
} from './tasks';
import { DUE } from './urgency';
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

  const skip = async (task: OpenTask, occurrence: TaskOccurrence | null) => {
    const key = `${task.taskId}:${occurrence?.at ?? 'now'}`;
    setBusy(key);
    try {
      if (occurrence !== null && occurrence.skippedAt !== null) await markUndone(task.taskId, occurrence.at);
      else await markSkipped(task.taskId, me.person.id, occurrence?.at);
      reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  const undoAfter = async (task: OpenTask) => {
    if (task.lastSettledAt === null) return;
    setBusy(task.taskId);
    try {
      await markUndone(task.taskId, task.lastSettledAt);
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
  /* 0066 — ein Zeitraum (`period`) ist ein Fenster mit freiem Abstand: dieselben Zeilen. */
  const windows: Row[] = tasks.filter((t) => t.kind !== 'after')
    .flatMap((task) => task.occurrences.map((occurrence) => ({ key: `${task.taskId}:${occurrence.at}`, task, occurrence, at: new Date(occurrence.at) })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  /*
     Was offen ist, steht nach Dringlichkeit — das Überfälligste zuoberst, und
     unter dem Überfälligen zuerst, was am längsten wartet. Nach der Uhrzeit zu
     ordnen setzte das, was heute früh fällig war, unter das von vorgestern.
  */
  const byUrgency = (a: Row, b: Row) =>
    taskUrgency(b.task, b.occurrence, now) - taskUrgency(a.task, a.occurrence, now);

  const endOfToday = addDays(new Date(today), 1);
  const yesterday = addDays(new Date(today), -1);
  const state = (row: Row) => windowState(row.occurrence!, now);

  const openNow = windows.filter((r) => state(r) === 'open').sort(byUrgency);
  const missed = windows.filter((r) => state(r) === 'missed' && r.at >= yesterday).sort(byUrgency);
  const later = windows.filter((r) => state(r) === 'upcoming' && r.at < endOfToday);
  const soon = windows.filter((r) => state(r) === 'upcoming' && r.at >= endOfToday && r.at < addDays(new Date(today), 7));
  /*
     Heute entschieden — erledigt oder abgesagt. Auch was man für morgen früh
     schon abgehakt hat, sonst verschwände es aus jeder Gruppe; und das Abgesagte
     steht eigens da, damit ein „Pomiń" aus Versehen nicht spurlos verschwindet.
  */
  const doneToday = windows.filter((r) => state(r) === 'done'
    && ((r.at >= new Date(today) && r.at < endOfToday) || new Date(r.occurrence!.doneAt!) >= new Date(today)));
  const skippedToday = windows.filter((r) => state(r) === 'skipped'
    && ((r.at >= new Date(today) && r.at < endOfToday) || new Date(r.occurrence!.skippedAt!) >= new Date(today)));

  const afters = tasks.filter((t) => t.kind === 'after')
    .map((task) => ({ task, ...afterState(task, now), urge: taskUrgency(task, null, now) }))
    .sort((a, b) => b.urge - a.urge);
  const dueAfters = afters.filter((a) => a.late || a.due < endOfToday);

  const line = (row: Row) => (
    <WindowLine key={row.key} row={row} now={now} areas={areas} busy={busy === row.key}
      onToggle={() => void toggle(row.task, row.occurrence)} onSkip={() => void skip(row.task, row.occurrence)}
      onOpen={() => setDialog({ task: row.task })} />
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
              onDone={() => void toggle(a.task, null)} onSkip={() => void skip(a.task, null)}
              onUndo={() => void undoAfter(a.task)} onOpen={() => setDialog({ task: a.task })} />
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
              onDone={() => void toggle(a.task, null)} onSkip={() => void skip(a.task, null)}
              onUndo={() => void undoAfter(a.task)} onOpen={() => setDialog({ task: a.task })} />
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

      {skippedToday.length > 0 && (
        <section className="wk-tasks-group is-done">
          <h2 className="wk-h2">Pominięte dziś</h2>
          {skippedToday.map(line)}
        </section>
      )}

      {dialog !== null && (
        <TaskDialog me={me} areas={areas} task={dialog.task} onClose={() => setDialog(null)} onSaved={reload} />
      )}
    </div>
  );
}

/**
 * Eine Zeile mit Fenster.
 *
 * Die Dringlichkeit steht zweimal da: als Balken, der sich über das Fenster
 * füllt, und als Abzeichen. Der Balken kann nur voll werden — was DANACH
 * geschieht, sagt das Abzeichen („2 dni po czasie"), denn dort wächst die
 * Dringlichkeit weiter, und nur so ist zu sehen, wie weit.
 */
function WindowLine({ row, now, areas, busy, onToggle, onSkip, onOpen }: {
  row: Row;
  now: Date;
  areas: readonly AreaRow[];
  busy: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onOpen: () => void;
}) {
  const occurrence = row.occurrence!;
  const done = occurrence.doneAt !== null;
  const skipped = occurrence.skippedAt !== null;
  const state = windowState(occurrence, now);
  const end = new Date(occurrence.endsAt);
  const task = row.task;

  const urge = taskUrgency(task, occurrence, now);
  const level = taskLevel(urge);
  /* Was übermorgen ist, lässt sich weder abhaken noch absagen — der Dienst nimmt es nicht an. */
  const far = state === 'upcoming' && row.at.getTime() - now.getTime() > 86400_000;

  const badge = state === 'open' ? (end.getTime() - now.getTime() > 60_000 ? `jeszcze ${howLong(end, now).replace('za ', '')}` : 'teraz')
    : state === 'upcoming' ? howLong(row.at, now)
    : state === 'missed' ? `${howLong(end, now).replace(' temu', '')} po czasie`
    : state === 'skipped' ? `pominięte ${clock(new Date(occurrence.skippedAt!))}`
    : `zrobione ${clock(new Date(occurrence.doneAt!))}`;

  return (
    <div className={`wk-task is-${state} is-urge-${level}`} style={{ '--ev-h': hueOf(task.areaId) } as CSSProperties}>
      <button type="button" role="checkbox" aria-checked={done} disabled={busy || far}
        className={`wk-task-tick${done ? ' is-done' : ''}`} aria-label={done ? `Cofnij: ${task.title}` : `Zrobione: ${task.title}`}
        onClick={onToggle}>
        {done ? '✓' : ''}
      </button>
      <button type="button" className="wk-task-main" onClick={onOpen}>
        <span className="wk-task-title">{task.title}</span>
        <span className="wk-task-when">
          {dayWord(row.at, now)} {clock(row.at)}
          {task.windowMinutes > 0 && `–${clock(end)}`}
          {' · '}{task.kind === 'period' ? everyWords(task.everyMinutes ?? 0) : REPEAT_WORD[task.repeatKind] ?? ''}
          {task.chatId != null && ' · z rozmowy'}
          {(task.remind ?? 0) !== 0 && ' · z przypomnieniem'}
          {' · '}{groupName(areas, task.areaId)}
        </span>
        {!done && !skipped && (
          <span className="wk-task-meter" aria-hidden="true">
            <span className={`wk-task-fill is-${level}`} style={{ width: `${bar(urge)}%` }} />
          </span>
        )}
      </button>
      <span className={`wk-task-badge is-${state}`}>{badge}</span>
      {!done && !far && (
        <button type="button" className="wk-link-btn wk-task-skip" disabled={busy}
          aria-label={skipped ? `Cofnij pominięcie: ${task.title}` : `Pomiń: ${task.title}`} onClick={onSkip}>
          {skipped ? 'Cofnij' : 'Pomiń'}
        </button>
      )}
    </div>
  );
}

/** Der Balken: der Anteil des Fensters, der um ist — voll, sobald es fällig ist. */
const bar = (urge: number) => Math.min(100, Math.max(2, (urge / DUE) * 100));

/** Eine Aufgabe mit Abstand: die laufende Uhr als Balken, und wann sie wieder dran ist. */
function AfterLine({ task, now, areas, busy, onDone, onSkip, onUndo, onOpen }: {
  task: OpenTask;
  now: Date;
  areas: readonly AreaRow[];
  busy: boolean;
  onDone: () => void;
  onSkip: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const { due, late } = afterState(task, now);
  const urge = taskUrgency(task, null, now);
  const level = taskLevel(urge);
  const doneRecently = task.lastDoneAt !== null && now.getTime() - new Date(task.lastDoneAt).getTime() < 10 * 60_000;
  const skippedRecently = task.skippedAt !== null && now.getTime() - new Date(task.skippedAt).getTime() < 10 * 60_000;

  return (
    <div className={`wk-task is-after is-urge-${level}${late ? ' is-late' : ''}`} style={{ '--ev-h': hueOf(task.areaId) } as CSSProperties}>
      <button type="button" className={`wk-task-tick${doneRecently ? ' is-done' : ''}`} disabled={busy}
        aria-label={`Zrobione: ${task.title}`} onClick={onDone}>
        {doneRecently ? '✓' : ''}
      </button>
      <button type="button" className="wk-task-main" onClick={onOpen}>
        <span className="wk-task-title">{task.title}</span>
        <span className="wk-task-when">
          {everyWords(task.everyMinutes ?? 0)}
          {' · '}{task.lastDoneAt === null ? 'jeszcze ani razu' : `ostatnio ${howLong(new Date(task.lastDoneAt), now)}`}
          {skippedRecently && ' · pominięte'}
          {' · '}{groupName(areas, task.areaId)}
        </span>
        <span className="wk-task-meter" aria-hidden="true">
          <span className={`wk-task-fill is-${level}`} style={{ width: `${bar(urge)}%` }} />
        </span>
      </button>
      <span className={`wk-task-badge${late ? ' is-missed' : ''}`}>
        {late ? `zaległe ${howLong(due, now).replace(' temu', '')}` : `następne ${howLong(due, now)}`}
      </span>
      {doneRecently || skippedRecently
        ? <button type="button" className="wk-link-btn wk-task-skip" disabled={busy} onClick={onUndo}>Cofnij</button>
        : <button type="button" className="wk-link-btn wk-task-skip" disabled={busy}
            aria-label={`Pomiń ten raz: ${task.title}`} onClick={onSkip}>Pomiń</button>}
    </div>
  );
}

export default TasksView;
