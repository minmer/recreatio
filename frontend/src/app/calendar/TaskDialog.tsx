/**
 * EINE AUFGABE — anlegen oder ändern.
 *
 * Zuerst die Frage, WELCHE Art: „o określonej porze" (ein Fenster, das
 * wiederkehren kann — das Abendgebet), „co pewien czas od wykonania" (ein
 * Abstand, der nach dem Erledigen neu beginnt — Blumen gießen) oder (0066)
 * „przez pewien czas, regularnie" (ein Zeitraum mit Dauer, der in festem
 * Abstand wiederkommt — drei Tage Zeit, alle zwei Wochen). Die übrigen
 * Felder folgen aus der Antwort.
 *
 * <b>Erinnerungen</b> (0066): am Anfang, in der Mitte, pod koniec. Erinnert
 * wird auf diesem Gerät (`notify.ts`) — in der App auch, wenn sie zu ist.
 */

import { useState } from 'react';

import { ensurePrivateArea, type RepeatKind } from './agenda';
import type { AreaRow } from '../areas/area';
import type { Me } from '../core/me';
import { Modal } from '../ui/Modal';
import { useRecent } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import {
  archiveTask, everyWords, REMIND, saveTask,
  type OpenTask, type ReminderKind, type TaskKind, type TaskOrigin
} from './tasks';
import { bitOf, fromLocal, localDate, localTime, PRIVATE, Weekdays, WhoSees } from '../areas/WhoSees';
import { askText } from '../ui/dialogs';
import { fmtDate, useT } from '../core/i18n';

/** Das Ende eines Fensters, aus Anfang und Länge — nur für das erste Anzeigen. */
const endOf = (from: Date, minutes: number): Date => new Date(from.getTime() + Math.max(0, minutes) * 60_000);

/** Ein Jahr; darüber ist es kein Fenster mehr, sondern ein Vorsatz (0055). */
const MAX_WINDOW_MINUTES = 366 * 24 * 60;

/* Schlüssel `calendarApp.taskDialog.unit.<minutes>` und `….everyUnit.<minutes>`. */
const UNITS: readonly number[] = [60, 1440, 10080];

const REPEATS: readonly RepeatKind[] = ['daily', 'weekly', 'monthly', 'yearly', 'none'];

const KINDS: readonly TaskKind[] = ['window', 'period', 'after'];

const LONG: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

/** Ein Abstand in die grösste Einheit, die ihn glatt teilt. */
function split(minutes: number): { amount: number; unit: number } {
  for (const unit of [10080, 1440, 60]) if (minutes % unit === 0) return { amount: minutes / unit, unit };
  return { amount: Math.max(1, Math.round(minutes / 60)), unit: 60 };
}

/** Wieviel davon in Minuten — für Dauer und Abstand. */
function Amount({ label, amount, unit, onAmount, onUnit }: {
  label: string; amount: number; unit: number; onAmount: (n: number) => void; onUnit: (n: number) => void;
}) {
  const t = useT();
  return (
    <>
      <label className="wk-field wk-ev-every">
        <span>{label}</span>
        <input type="number" min={1} max={999} value={amount} onChange={(e) => onAmount(Math.max(1, Number(e.target.value) || 1))} />
      </label>
      <label className="wk-field">
        <span>&nbsp;</span>
        <select value={unit} aria-label={t('calendarApp.taskDialog.unitLabel')} onChange={(e) => onUnit(Number(e.target.value))}>
          {UNITS.map((one) => <option key={one} value={one}>{t(`calendarApp.taskDialog.unit.u${one}`)}</option>)}
        </select>
      </label>
    </>
  );
}

export function TaskDialog({ me, areas, task, at, origin, initialTitle, initialArea, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  /** Eine bestehende — oder `null` für eine neue. */
  task: OpenTask | null;
  /** Für eine neue: wann (sonst jetzt). */
  at?: Date;
  /** 0066 — eine neue aus einer Rozmowa: woher, mit welchem Titel, für welche Leute. */
  origin?: TaskOrigin | null;
  initialTitle?: string;
  initialArea?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const recent = useRecent('calendar.who');
  const personal = areas.find((a) => a.personal === true);
  const start = task !== null ? new Date(task.startsAt) : (at ?? new Date());
  const every = split(task?.everyMinutes ?? (task?.kind === 'period' ? 14 * 1440 : 3 * 1440));
  const lasts = split(task?.kind === 'period' ? Math.max(60, task.windowMinutes) : 3 * 1440);

  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'window');
  const [title, setTitle] = useState(task?.title ?? initialTitle ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [who, setWho] = useState(task?.areaId ?? initialArea ?? personal?.areaId ?? PRIVATE);
  const [date, setDate] = useState(localDate(start));
  const [time, setTime] = useState(localTime(start));
  /*
     Anfang UND Ende, beide frei wählbar.

     Vorher gab es eine Liste fertiger Längen — fünf Minuten, eine Stunde, ein
     ganzer Tag. Das reicht für ein Gebet um 21:00 und für nichts, was über
     einen Tag hinausgeht: „zwischen dem 1. und dem 15. Oktober" liess sich
     nicht sagen. Aus zwei Zeitpunkten ergibt sich die Länge von selbst, und
     die Dringlichkeit weiss damit, worüber sie steigen soll.
  */
  const [endDate, setEndDate] = useState(localDate(endOf(start, task?.windowMinutes ?? 15)));
  const [endTime, setEndTime] = useState(localTime(endOf(start, task?.windowMinutes ?? 15)));
  const [repeat, setRepeat] = useState<RepeatKind>(task?.repeatKind ?? 'daily');
  const [weekdays, setWeekdays] = useState(task?.repeatWeekdays ?? bitOf(start));
  const [amount, setAmount] = useState(every.amount);
  const [unit, setUnit] = useState(every.unit);
  const [lastAmount, setLastAmount] = useState(lasts.amount);
  const [lastUnit, setLastUnit] = useState(lasts.unit);
  const [remind, setRemind] = useState<number>(task?.remind ?? 0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await todo();
      onSaved();
      onClose();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('calendarApp.taskDialog.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const startsAt = fromLocal(date, time);
  const endsAt = fromLocal(endDate, endTime);
  const windowMinutes = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  const periodMinutes = lastAmount * lastUnit;
  const everyMinutes = amount * unit;

  /*
     Verschiebt man den Anfang, wandert das Ende mit und das Fenster behält
     seine Länge. Sonst stünde nach jedem Umstellen des Tages „Koniec wypada
     przed początkiem" — und der Mensch müsste zwei Felder pflegen, wo er eines
     gemeint hat.
  */
  const moveStart = (nextDate: string, nextTime: string) => {
    const span = Math.max(0, endsAt.getTime() - startsAt.getTime());
    const shifted = new Date(fromLocal(nextDate, nextTime).getTime() + span);
    setDate(nextDate);
    setTime(nextTime);
    setEndDate(localDate(shifted));
    setEndTime(localTime(shifted));
  };

  const save = () => run(async () => {
    if (title.trim() === '') throw new WorkspaceError(t('calendarApp.taskDialog.needsTitle'));
    if (kind === 'window' && endsAt.getTime() < startsAt.getTime()) {
      throw new WorkspaceError(t('calendarApp.taskDialog.endBeforeStart'));
    }
    if (kind === 'window' && windowMinutes > MAX_WINDOW_MINUTES) {
      throw new WorkspaceError(t('calendarApp.taskDialog.windowTooLong'));
    }
    if (kind === 'period' && everyMinutes < periodMinutes) {
      throw new WorkspaceError(t('calendarApp.taskDialog.tooOften'));
    }
    if (kind === 'period' && periodMinutes > MAX_WINDOW_MINUTES) {
      throw new WorkspaceError(t('calendarApp.taskDialog.periodTooLong'));
    }
    const areaId = who === PRIVATE ? await ensurePrivateArea(me.ring, me.person, areas) : who;
    if (who !== PRIVATE && areas.find((a) => a.areaId === who)?.personal !== true) recent.touch(who);

    await saveTask(me.ring, {
      title, notes, areaId, ownerRoleId: me.person.id, kind, date, time,
      windowMinutes: kind === 'period' ? periodMinutes : windowMinutes,
      everyMinutes: kind === 'window' ? null : everyMinutes,
      repeat, every: 1, weekdays, until: null,
      remind: kind === 'after' ? remind & REMIND.start : remind,
      origin: task === null ? origin ?? null : null
    }, task?.taskId);
  });

  const due = fromLocal(date, time);
  const says = t(`calendarApp.taskDialog.kind.${kind}.says`);

  /* Was eine Erinnerung bei dieser Art heisst — bei „co pewien czas od wykonania" gibt es nur den Termin. */
  const reminderKinds: readonly ReminderKind[] = kind === 'after' ? ['start'] : ['start', 'middle', 'end'];

  return (
    <Modal title={task === null ? t('calendarApp.taskDialog.newTitle') : t('calendarApp.kindWord.task')} onClose={onClose} wide>
      <form className="wk-form wk-ev-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {origin != null && task === null && (
          <p className="wk-note">{t('calendarApp.taskDialog.fromChat')}</p>
        )}

        <div className="wk-seg wk-ev-scope" role="group" aria-label={t('calendarApp.taskDialog.kindLabel')}>
          {KINDS.map((one) => (
            <button key={one} type="button" aria-pressed={kind === one}
              className={kind === one ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => setKind(one)}>{t(`calendarApp.taskDialog.kind.${one}.label`)}</button>
          ))}
        </div>
        <p className="wk-hint">{says}</p>

        <label className="wk-field">
          <span>{t('calendarApp.taskDialog.what')}</span>
          <input value={title} maxLength={200}
            placeholder={t(`calendarApp.taskDialog.kind.${kind}.placeholder`)}
            onChange={(e) => setTitle(e.target.value)} />
        </label>

        {kind === 'window' ? (
          <>
            <div className="wk-ev-when-row">
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.fromDay')}</span>
                <input type="date" value={date} onChange={(e) => moveStart(e.target.value, time)} />
              </label>
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.atTime')}</span>
                <input type="time" value={time} step={300} onChange={(e) => moveStart(date, e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.toDay')}</span>
                <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.atTime')}</span>
                <input type="time" value={endTime} step={300} onChange={(e) => setEndTime(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.howOften')}</span>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
                  {REPEATS.map((one) => <option key={one} value={one}>{t(`calendarApp.taskDialog.repeat.${one}`)}</option>)}
                </select>
              </label>
            </div>
            {repeat === 'weekly' && <Weekdays value={weekdays} onChange={setWeekdays} />}
          </>
        ) : kind === 'period' ? (
          <>
            <div className="wk-ev-when-row">
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.firstFrom')}</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('calendarApp.taskDialog.atTime')}</span>
                <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
              </label>
              <Amount label={t('calendarApp.taskDialog.timeToDo')} amount={lastAmount} unit={lastUnit} onAmount={setLastAmount} onUnit={setLastUnit} />
              <Amount label={t('calendarApp.taskDialog.returnsEvery')} amount={amount} unit={unit} onAmount={setAmount} onUnit={setUnit} />
            </div>
            <p className="wk-hint">
              {t('calendarApp.taskDialog.periodHint', {
                from: fmtDate(due, LONG, t.lang),
                to: fmtDate(new Date(due.getTime() + periodMinutes * 60_000), LONG, t.lang),
                every: everyWords(everyMinutes)
              })}
            </p>
          </>
        ) : (
          <div className="wk-ev-when-row">
            <Amount label={t('calendarApp.taskDialog.every')} amount={amount} unit={unit} onAmount={setAmount} onUnit={setUnit} />
            <label className="wk-field">
              <span>{task?.lastDoneAt ? t('calendarApp.taskDialog.firstWas') : t('calendarApp.taskDialog.first')}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>{t('calendarApp.taskDialog.atTime')}</span>
              <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
        )}

        {kind === 'after' && task === null && (
          <p className="wk-hint">
            {t('calendarApp.taskDialog.afterHint', {
              first: fmtDate(due, LONG, t.lang),
              every: t(`calendarApp.taskDialog.everyUnit.u${UNITS.includes(unit) ? unit : 60}`, { count: amount })
            })}
          </p>
        )}

        <fieldset className="wk-field wk-remind">
          <legend>{t('calendarApp.taskDialog.remind')}</legend>
          <div className="wk-remind-row">
            {reminderKinds.map((r) => (
              <label key={r} className="wk-check">
                <input type="checkbox" checked={(remind & REMIND[r]) !== 0}
                  onChange={(e) => setRemind((was) => e.target.checked ? was | REMIND[r] : was & ~REMIND[r])} />
                <span>{kind === 'after' ? t('calendarApp.taskDialog.whenDue') : t(`calendarApp.remind.${r}`)}</span>
              </label>
            ))}
          </div>
          <span className="wk-hint">{t('calendarApp.taskDialog.remindHint')}</span>
        </fieldset>

        <WhoSees areas={areas} recent={recent.ids} value={who} onChange={setWho} />

        <label className="wk-field">
          <span>{t('calendarApp.taskDialog.notes')}</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          {task !== null && (
            <button type="button" className="wk-link-btn wk-danger wk-ev-delete" disabled={busy}
              onClick={async () => { if (await askText(t('calendarApp.taskDialog.deleteAsk'))) void run(() => archiveTask(task.taskId)); }}>
              {t('common.delete')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default TaskDialog;
