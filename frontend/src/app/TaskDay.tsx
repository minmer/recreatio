/**
 * DIE AUFGABEN EINES TAGES (0057) — im Kalender kompakt, und hier zum Abhaken.
 *
 * <b>Warum nicht im Raster.</b> Ein Gebet mit einem Fenster von sechs Stunden
 * ist kein Termin, der sechs Stunden dauert. Als Kasten im Stundenraster nahm
 * es den Terminen den Platz; an einem Tag mit fünf Horen bestand die Woche
 * aus Gebetszeiten. Im Kalender stehen Aufgaben darum als Schiene am Rand und
 * als eine Zeile mit dem Stand des Tages — und wer sie aufmacht, findet sie
 * hier: mit Häkchen, mit „pomiń", und mit dem Weg zur Aufgabe selbst.
 */

import { useState } from 'react';

import type { AreaRow } from './area';
import { pressing, settled, tally, type TaskMark } from './calendarModel';
import { longDate } from './dayMath';
import type { Me } from './me';
import { Modal } from './Modal';
import { viewPath } from './routes';
import { WorkspaceError } from './session';
import { everyWords, howLong, markDone, markSkipped, markUndone, type OpenTask } from './tasks';
import { groupName } from './WhoSees';

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/** Wann — das Fenster, oder bei „co pewien czas" der Abstand. */
function whenOf(mark: TaskMark): string {
  if (mark.occurrence === null) return `${everyWords(mark.task.everyMinutes ?? 0)} · na ${time(mark.start)}`;
  return mark.end.getTime() - mark.start.getTime() >= 60_000 ? `${time(mark.start)}–${time(mark.end)}` : time(mark.start);
}

/** Der Stand in Worten — was man als Erstes wissen will. */
function stateOf(mark: TaskMark, now: Date): string {
  switch (mark.state) {
    case 'done': return mark.occurrence?.doneAt ? `zrobione ${time(new Date(mark.occurrence.doneAt))}` : 'zrobione';
    case 'skipped': return 'pominięte';
    case 'open': return `teraz · jeszcze ${howLong(mark.end, now).replace('za ', '')}`;
    case 'due': return 'do zrobienia';
    case 'missed': return 'przegapione';
    case 'late': return `zaległe ${howLong(mark.start, now).replace(' temu', '')}`;
    case 'upcoming': return howLong(mark.start, now);
  }
}

/**
 * Häkchen setzen oder zurücknehmen — für den Kalender, die Schiene und diese
 * Liste dieselbe Handlung.
 */
export async function toggleMark(mark: TaskMark, byRoleId: string): Promise<void> {
  if (mark.occurrence === null) {
    await markDone(mark.task.taskId, byRoleId);
    return;
  }
  if (settled(mark)) await markUndone(mark.task.taskId, mark.occurrence.at);
  else await markDone(mark.task.taskId, byRoleId, mark.occurrence.at);
}

/** Der Stand eines Tages als kleine Pille — im Raster über dem Tag, in der Monatszelle, in der Liste. */
export function TaskPill({ marks, onOpen, mini = false }: { marks: readonly TaskMark[]; onOpen: () => void; mini?: boolean }) {
  const t = tally(marks);
  if (t.total === 0) return null;

  /*
     Was an einem VERGANGENEN Tag liegen blieb, ist vorbei, nicht dringend:
     es heisst „przegapione" und tritt zurück. Rot ist für heute — sonst wäre
     der Kalender nach zwei Tagen ohne Häkchen eine rote Wand.
  */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = marks.every((m) => m.start < today);
  const behindWord = past ? 'przegapione' : 'zaległe';

  const words = [`zrobione ${t.settled} z ${t.total}`];
  if (t.pressing > 0) words.push(`${t.pressing} teraz`);
  if (t.behind > 0) words.push(`${t.behind} ${behindWord}`);

  return (
    <button
      type="button"
      className={`wk-taskpill${mini ? ' is-mini' : ''}${past ? ' is-past' : ''}${t.pressing > 0 ? ' is-pressing' : ''}${t.behind > 0 ? ' is-behind' : ''}${t.settled === t.total ? ' is-clear' : ''}`}
      aria-label={`Zadania: ${words.join(', ')}`}
      title={`Zadania: ${words.join(', ')}`}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
    >
      <span className="wk-taskpill-tick" aria-hidden="true">✓</span>
      <span className="wk-taskpill-count">{t.settled}/{t.total}</span>
      {!mini && t.pressing > 0 && <span className="wk-taskpill-note is-pressing">{t.pressing} teraz</span>}
      {!mini && t.behind > 0 && <span className="wk-taskpill-note is-behind">{t.behind} {behindWord}</span>}
      {mini && (t.pressing > 0 || t.behind > 0) && <span className="wk-taskpill-dot" aria-hidden="true" />}
    </button>
  );
}

export function TaskDay({ me, day, marks, areas, now, onClose, onChanged, onOpenTask, onNew }: {
  me: Me;
  day: Date;
  marks: readonly TaskMark[];
  areas: readonly AreaRow[];
  now: Date;
  onClose: () => void;
  onChanged: () => void;
  onOpenTask: (task: OpenTask) => void;
  onNew: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (mark: TaskMark, todo: () => Promise<unknown>) => {
    setBusy(mark.key);
    setFailed(null);
    try {
      await todo();
      onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  const t = tally(marks);

  return (
    <Modal title={`Zadania · ${longDate(day)}`} onClose={onClose}>
      <p className="wk-hint">
        Zrobione {t.settled} z {t.total}{t.pressing > 0 ? ` · ${t.pressing} teraz` : ''}{t.behind > 0 ? ` · ${t.behind} zaległe` : ''}
      </p>

      {marks.length === 0 && <p className="wk-empty">Tego dnia nie ma zadań.</p>}

      <ul className="wk-taskday">
        {marks.map((mark) => {
          const done = settled(mark);
          const future = mark.state === 'upcoming' && mark.start.getTime() - now.getTime() > 86400_000;
          return (
            <li key={mark.key} className={`wk-taskday-row is-${mark.state}`}>
              <button
                type="button" role="checkbox" aria-checked={done}
                className={`wk-task-tick${done ? ' is-done' : ''}`}
                disabled={busy !== null || future || (mark.occurrence === null && done)}
                aria-label={done ? `Cofnij: ${mark.task.title}` : `Zrobione: ${mark.task.title}`}
                onClick={() => void run(mark, () => toggleMark(mark, me.person.id))}
              >
                {mark.state === 'done' ? '✓' : mark.state === 'skipped' ? '–' : ''}
              </button>
              <button type="button" className="wk-taskday-main" onClick={() => onOpenTask(mark.task)}>
                <span className="wk-taskday-title">{mark.task.title}</span>
                <span className="wk-taskday-when">{whenOf(mark)} · {groupName(areas, mark.areaId)}</span>
              </button>
              <span className={`wk-taskday-state is-${mark.state}`}>{stateOf(mark, now)}</span>
              {(pressing(mark) || mark.state === 'missed' || mark.state === 'late') && (
                <button type="button" className="wk-link-btn" disabled={busy !== null}
                  onClick={() => void run(mark, () => markSkipped(mark.task.taskId, me.person.id, mark.occurrence?.at))}>
                  pomiń
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" onClick={onNew}>+ Zadanie</button>
        <a className="wk-link" href={viewPath('tasks')}>Wszystkie zadania</a>
      </div>
    </Modal>
  );
}

export default TaskDay;
