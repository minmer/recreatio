/**
 * DIE AUFGABEN EINES TAGES (0057) — im Kalender kompakt, und hier zum Abhaken.
 *
 * <b>Warum nicht im Raster.</b> Ein Gebet mit einem Fenster von sechs Stunden
 * ist kein Termin, der sechs Stunden dauert. Als Kasten im Stundenraster nahm
 * es den Terminen den Platz; an einem Tag mit fünf Horen bestand die Woche
 * aus Gebetszeiten. Im Kalender stehen Aufgaben darum als Schiene am Rand und
 * als eine Zeile mit dem Stand des Tages — und wer sie aufmacht, findet sie
 * hier: mit Häkchen, mit „pomiń", und mit dem Weg zur Aufgabe selbst.
 *
 * 2026-10-17 — wer die Schiene anklickt, gibt den Aufgaben den Tag: dann
 * stehen sie breit im Raster, mit denselben Handgriffen (`TaskBlock` in
 * `CalendarApp.tsx`), und die Termine werden zur Schiene.
 *
 * 2026-10-17 — die Liste zeigt zuerst nur, was an DIESEM Tag dran ist; was
 * von früher heute steht (`carried`), kommt mit „Wszystkie dni" dazu. Sonst
 * fand man die Aufgaben des Tages unter fünfzig zaległych nicht.
 */

import { useState } from 'react';

import type { AreaRow } from '../areas/area';
import { behind, pressing, settled, tally, type TaskMark } from './calendarModel';
import { longDate } from '../core/dayMath';
import type { Me } from '../core/me';
import { Modal } from '../ui/Modal';
import { Segment } from '../ui/Segment';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { everyWords, howLong, markDone, markSkipped, markUndone, spanWord, type OpenTask } from './tasks';
import { groupName } from '../areas/WhoSees';
import { fmtDate, t, useT } from '../core/i18n';

const time = (at: Date) => fmtDate(at, { hour: '2-digit', minute: '2-digit' });

const shortDate = (at: Date) => fmtDate(at, { weekday: 'short', day: 'numeric', month: 'numeric' });

/** Wann — das Fenster, oder bei „co pewien czas" der Abstand. 0088: was von früher heute steht, mit seinem Tag. */
export function whenOf(mark: TaskMark): string {
  if (mark.occurrence === null) return t('calendarApp.taskDay.everyAt', { every: everyWords(mark.task.everyMinutes ?? 0), time: time(mark.start) });
  const hours = mark.end.getTime() - mark.start.getTime() >= 60_000 ? `${time(mark.start)}–${time(mark.end)}` : time(mark.start);
  return mark.carried ? `${shortDate(mark.start)}, ${hours}` : hours;
}

/** Der Stand in Worten — was man als Erstes wissen will. */
export function stateOf(mark: TaskMark, now: Date): string {
  switch (mark.state) {
    case 'done': return mark.occurrence?.doneAt ? t('calendarApp.taskDay.doneAt', { time: time(new Date(mark.occurrence.doneAt)) }) : t('calendarApp.taskDay.done');
    case 'skipped': return t('calendarApp.taskDay.skipped');
    case 'open': return t('calendarApp.taskDay.openLeft', { span: spanWord(mark.end, now) });
    case 'due': return t('calendarApp.taskDay.due');
    case 'missed': return mark.carried ? t('calendarApp.taskDay.lateFor', { span: spanWord(mark.start, now) }) : t('calendarApp.taskDay.missed');
    case 'late': return t('calendarApp.taskDay.lateFor', { span: spanWord(mark.start, now) });
    case 'upcoming': return howLong(mark.start, now);
  }
}

/**
 * Ob sich das Häkchen setzen oder zurücknehmen lässt: nicht für weit
 * Künftiges (mehr als einen Tag voraus), und „co pewien czas" nicht zurück.
 */
export const mayTick = (mark: TaskMark, now: Date): boolean =>
  !(mark.state === 'upcoming' && mark.start.getTime() - now.getTime() > 86400_000) && !(mark.occurrence === null && settled(mark));

/** „pomiń" — für das, was jetzt dran oder versäumt ist. */
export const maySkip = (mark: TaskMark): boolean => pressing(mark) || behind(mark);

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

/** Der Stand eines Tages — in Zahlen, in Worten und als Klassen der Pille. `null`: an dem Tag ist nichts. */
function dayTally(marks: readonly TaskMark[]) {
  const c = tally(marks);
  if (c.total === 0) return null;

  /*
     Was an einem VERGANGENEN Tag liegen blieb, ist vorbei, nicht dringend:
     es heisst „przegapione" und tritt zurück. Rot ist für heute — sonst wäre
     der Kalender nach zwei Tagen ohne Häkchen eine rote Wand.
  */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  /* 0088 — nach dem Tag, an dem es STEHT: was von früher heute steht, ist heute zu tun. */
  const past = marks.every((m) => m.on < today);
  const behindWord = past ? t('calendarApp.taskDay.behindPast') : t('calendarApp.taskDay.behindNow');

  const words = [t('calendarApp.taskDay.settled', { settled: c.settled, total: c.total })];
  if (c.pressing > 0) words.push(t('calendarApp.taskDay.pressing', { count: c.pressing }));
  if (c.behind > 0) words.push(t('calendarApp.taskDay.behindCount', { count: c.behind, word: behindWord }));

  return {
    c, behindWord,
    words: t('calendarApp.taskDay.words', { list: words.join(', ') }),
    classes: `${past ? ' is-past' : ''}${c.pressing > 0 ? ' is-pressing' : ''}${c.behind > 0 ? ' is-behind' : ''}${c.settled === c.total ? ' is-clear' : ''}`
  };
}

/** Der Stand eines Tages in Worten („Zadania: zrobione 1 z 3, 1 teraz") — für den Knopf, in dem die stille Marke steht. */
export const taskWords = (marks: readonly TaskMark[]): string | null => dayTally(marks)?.words ?? null;

/** Der Stand eines Tages als kleine Pille, die die Liste des Tages öffnet — in der Zeile „zadania" über dem Raster. */
export function TaskPill({ marks, onOpen }: { marks: readonly TaskMark[]; onOpen: () => void }) {
  const t = useT();
  const d = dayTally(marks);
  if (d === null) return null;
  const { c } = d;

  return (
    <button type="button" className={`wk-taskpill${d.classes}`} aria-label={d.words} title={d.words}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}>
      <span className="wk-taskpill-tick" aria-hidden="true">✓</span>
      <span className="wk-taskpill-count">{c.settled}/{c.total}</span>
      {c.pressing > 0 && <span className="wk-taskpill-note is-pressing">{t('calendarApp.taskDay.pressing', { count: c.pressing })}</span>}
      {c.behind > 0 && <span className="wk-taskpill-note is-behind">{t('calendarApp.taskDay.behindCount', { count: c.behind, word: d.behindWord })}</span>}
    </button>
  );
}

/**
 * 2026-10-24 — DER STAND EINES TAGES ALS STILLE MARKE, im Kopf eines Tages
 * (Monatszelle, Liste). Kein eigener Knopf: auf dem Telefon traf der Finger,
 * der das Datum meinte, die Pille daneben — und es ging die Liste der
 * Aufgaben auf statt des Tages. Jetzt gehört der ganze Kopf dem Datum; die
 * Aufgaben stehen im Tag (Zeile „zadania", Schiene).
 */
export function TaskTally({ marks }: { marks: readonly TaskMark[] }) {
  const d = dayTally(marks);
  if (d === null) return null;
  const { c } = d;

  return (
    <span className={`wk-taskpill is-mini is-quiet${d.classes}`} title={d.words} aria-hidden="true">
      <span className="wk-taskpill-tick">✓</span>
      <span className="wk-taskpill-count">{c.settled}/{c.total}</span>
      {/* Breit: nur, wenn etwas drängt oder liegen blieb. In einer schmalen Zelle (Telefon) steht nur er — in der Farbe des Standes. */}
      <span className="wk-taskpill-dot" />
    </span>
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
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /* Auch, was von früheren Tagen heute steht? */
  const [every, setEvery] = useState(false);

  const run = async (mark: TaskMark, todo: () => Promise<unknown>) => {
    setBusy(mark.key);
    setFailed(null);
    try {
      await todo();
      onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarApp.failed'));
    } finally {
      setBusy(null);
    }
  };

  const own = marks.filter((m) => !m.carried);
  const carried = marks.length - own.length;
  const shown = every ? marks : own;
  const c = tally(shown);

  /* 0088 — noch ältere Liegengebliebene, die nicht mitgekommen sind (je Aufgabe höchstens die jüngsten). */
  const more = !every ? 0 : [...new Map(marks.filter((m) => m.carried).map((m) => [m.task.taskId, m.task.overdueMore ?? 0])).values()]
    .reduce((n, one) => n + one, 0);

  return (
    <Modal title={t('calendarApp.taskDay.title', { date: longDate(day, t.lang) })} onClose={onClose}>
      {carried > 0 && (
        <Segment now={every ? 'all' : 'day'} busy={false} onPick={(value) => setEvery(value === 'all')}
          options={[{ value: 'day', label: t('calendarApp.taskDay.thisDay', { count: own.length }) }, { value: 'all', label: t('calendarApp.taskDay.allDays', { count: marks.length }) }]} />
      )}

      <p className="wk-hint">
        {t('calendarApp.taskDay.summary', { settled: c.settled, total: c.total })}{c.pressing > 0 ? t('calendarApp.taskDay.summaryPressing', { count: c.pressing }) : ''}{c.behind > 0 ? t('calendarApp.taskDay.summaryBehind', { count: c.behind }) : ''}
      </p>

      {shown.length === 0 && <p className="wk-empty">{t('calendarApp.taskDay.empty')}</p>}

      <ul className="wk-taskday">
        {shown.map((mark) => {
          const done = settled(mark);
          return (
            <li key={mark.key} className={`wk-taskday-row is-${mark.state}`}>
              <button
                type="button" role="checkbox" aria-checked={done}
                className={`wk-task-tick${done ? ' is-done' : ''}`}
                disabled={busy !== null || !mayTick(mark, now)}
                aria-label={done ? t('calendarApp.taskDay.undo', { title: mark.task.title }) : t('calendarApp.taskDay.markDone', { title: mark.task.title })}
                onClick={() => void run(mark, () => toggleMark(mark, me.person.id))}
              >
                {mark.state === 'done' ? '✓' : mark.state === 'skipped' ? '–' : ''}
              </button>
              <button type="button" className="wk-taskday-main" onClick={() => onOpenTask(mark.task)}>
                <span className="wk-taskday-title">{mark.task.title}</span>
                <span className="wk-taskday-when">{whenOf(mark)} · {groupName(areas, mark.areaId)}</span>
              </button>
              <span className={`wk-taskday-state is-${mark.state}`}>{stateOf(mark, now)}</span>
              {maySkip(mark) && (
                <button type="button" className="wk-link-btn" disabled={busy !== null}
                  onClick={() => void run(mark, () => markSkipped(mark.task.taskId, me.person.id, mark.occurrence?.at))}>
                  {t('calendarApp.taskDay.skip')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {more > 0 && (
        <p className="wk-hint">
          {t('calendarApp.taskDay.more', { count: more })}
        </p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" onClick={onNew}>{t('calendarApp.taskDay.new')}</button>
        <a className="wk-link" href={viewPath('tasks')}>{t('calendarApp.taskDay.all')}</a>
      </div>
    </Modal>
  );
}

export default TaskDay;
