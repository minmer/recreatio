/**
 * EINE AUFGABE — anlegen oder ändern.
 *
 * Zuerst die Frage, WELCHE Art: „o określonej porze" (ein Fenster, das
 * wiederkehren kann — das Abendgebet) oder „co pewien czas od wykonania"
 * (ein Abstand, der nach dem Erledigen neu beginnt — Blumen gießen). Die
 * übrigen Felder folgen aus der Antwort.
 */

import { useState } from 'react';

import { ensurePrivateArea, type RepeatKind } from './agenda';
import type { AreaRow } from './area';
import type { Me } from './me';
import { Modal } from './Modal';
import { useRecent } from './prefs';
import { WorkspaceError } from './session';
import { archiveTask, saveTask, type OpenTask, type TaskKind } from './tasks';
import { bitOf, fromLocal, localDate, localTime, PRIVATE, Weekdays, WhoSees } from './WhoSees';

/** Das Ende eines Fensters, aus Anfang und Länge — nur für das erste Anzeigen. */
const endOf = (from: Date, minutes: number): Date => new Date(from.getTime() + Math.max(0, minutes) * 60_000);

/** Ein Jahr; darüber ist es kein Fenster mehr, sondern ein Vorsatz (0055). */
const MAX_WINDOW_MINUTES = 366 * 24 * 60;

const UNITS: readonly { minutes: number; label: string }[] = [
  { minutes: 60, label: 'godzin' }, { minutes: 1440, label: 'dni' }, { minutes: 10080, label: 'tygodni' }
];

const REPEATS: readonly { value: RepeatKind; label: string }[] = [
  { value: 'daily', label: 'Codziennie' }, { value: 'weekly', label: 'W wybrane dni tygodnia' },
  { value: 'monthly', label: 'Co miesiąc' }, { value: 'yearly', label: 'Co rok' }, { value: 'none', label: 'Raz' }
];

/** Ein Abstand in die grösste Einheit, die ihn glatt teilt. */
function split(minutes: number): { amount: number; unit: number } {
  for (const unit of [10080, 1440, 60]) if (minutes % unit === 0) return { amount: minutes / unit, unit };
  return { amount: Math.max(1, Math.round(minutes / 60)), unit: 60 };
}

export function TaskDialog({ me, areas, task, at, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  /** Eine bestehende — oder `null` für eine neue. */
  task: OpenTask | null;
  /** Für eine neue: wann (sonst jetzt). */
  at?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const recent = useRecent('calendar.who');
  const personal = areas.find((a) => a.personal === true);
  const start = task !== null ? new Date(task.startsAt) : (at ?? new Date());
  const every = split(task?.everyMinutes ?? 3 * 1440);

  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'window');
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [who, setWho] = useState(task?.areaId ?? personal?.areaId ?? PRIVATE);
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const startsAt = fromLocal(date, time);
  const endsAt = fromLocal(endDate, endTime);
  const windowMinutes = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));

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
    if (title.trim() === '') throw new WorkspaceError('Nazwij zadanie.');
    if (kind === 'window' && endsAt.getTime() < startsAt.getTime()) {
      throw new WorkspaceError('Koniec wypada przed początkiem.');
    }
    if (kind === 'window' && windowMinutes > MAX_WINDOW_MINUTES) {
      throw new WorkspaceError('Okno dłuższe niż rok — to już nie termin, tylko postanowienie.');
    }
    const areaId = who === PRIVATE ? await ensurePrivateArea(me.ring, me.person, areas) : who;
    if (who !== PRIVATE && areas.find((a) => a.areaId === who)?.personal !== true) recent.touch(who);

    await saveTask(me.ring, {
      title, notes, areaId, ownerRoleId: me.person.id, kind, date, time,
      windowMinutes, everyMinutes: kind === 'after' ? amount * unit : null,
      repeat, every: 1, weekdays, until: null
    }, task?.taskId);
  });

  const due = fromLocal(date, time);

  return (
    <Modal title={task === null ? 'Nowe zadanie' : 'Zadanie'} onClose={onClose} wide>
      <form className="wk-form wk-ev-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="wk-seg wk-ev-scope" role="group" aria-label="Rodzaj zadania">
          <button type="button" aria-pressed={kind === 'window'} className={kind === 'window' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
            onClick={() => setKind('window')}>O określonej porze</button>
          <button type="button" aria-pressed={kind === 'after'} className={kind === 'after' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
            onClick={() => setKind('after')}>Co pewien czas od wykonania</button>
        </div>
        <p className="wk-hint">
          {kind === 'window'
            ? 'Ma swoją porę, która może wracać — np. modlitwa o 21:00 każdego dnia. Odhaczasz każde wystąpienie; przegapione widać.'
            : 'Liczy czas od ostatniego wykonania — np. podlać kwiaty co 3 dni. Gdy odhaczysz, licznik zaczyna od nowa.'}
        </p>

        <label className="wk-field">
          <span>Co</span>
          <input value={title} maxLength={200} placeholder={kind === 'window' ? 'np. Apel Jasnogórski' : 'np. Podlać kwiaty'}
            onChange={(e) => setTitle(e.target.value)} />
        </label>

        {kind === 'window' ? (
          <>
            <div className="wk-ev-when-row">
              <label className="wk-field">
                <span>Od dnia</span>
                <input type="date" value={date} onChange={(e) => moveStart(e.target.value, time)} />
              </label>
              <label className="wk-field">
                <span>o godz.</span>
                <input type="time" value={time} step={300} onChange={(e) => moveStart(date, e.target.value)} />
              </label>
              <label className="wk-field">
                <span>Do dnia</span>
                <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>o godz.</span>
                <input type="time" value={endTime} step={300} onChange={(e) => setEndTime(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>Jak często</span>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
                  {REPEATS.map((one) => <option key={one.value} value={one.value}>{one.label}</option>)}
                </select>
              </label>
            </div>
            {repeat === 'weekly' && <Weekdays value={weekdays} onChange={setWeekdays} />}
          </>
        ) : (
          <div className="wk-ev-when-row">
            <label className="wk-field wk-ev-every">
              <span>Co</span>
              <input type="number" min={1} max={999} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label className="wk-field">
              <span>&nbsp;</span>
              <select value={unit} aria-label="Jednostka" onChange={(e) => setUnit(Number(e.target.value))}>
                {UNITS.map((one) => <option key={one.minutes} value={one.minutes}>{one.label}</option>)}
              </select>
            </label>
            <label className="wk-field">
              <span>{task?.lastDoneAt ? 'Pierwszy raz był' : 'Pierwszy raz'}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>o godz.</span>
              <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
        )}

        {kind === 'after' && task === null && (
          <p className="wk-hint">
            Pierwszy raz: {due.toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {' '}— potem co {amount} {UNITS.find((u) => u.minutes === unit)?.label} od każdego wykonania.
          </p>
        )}

        <WhoSees areas={areas} recent={recent.ids} value={who} onChange={setWho} />

        <label className="wk-field">
          <span>Notatka</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={onClose}>Anuluj</button>
          {task !== null && (
            <button type="button" className="wk-link-btn wk-danger wk-ev-delete" disabled={busy}
              onClick={() => { if (window.confirm('Usunąć to zadanie? Historia wykonania zostaje w archiwum.')) void run(() => archiveTask(task.taskId)); }}>
              Usuń
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default TaskDialog;
