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
import type { AreaRow } from './area';
import type { Me } from './me';
import { Modal } from './Modal';
import { useRecent } from './prefs';
import { WorkspaceError } from './session';
import {
  archiveTask, everyWords, REMIND, REMIND_WORD, saveTask,
  type OpenTask, type ReminderKind, type TaskKind, type TaskOrigin
} from './tasks';
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

const KINDS: readonly { value: TaskKind; label: string; says: string }[] = [
  {
    value: 'window', label: 'O określonej porze',
    says: 'Ma swoją porę, która może wracać — np. modlitwa o 21:00 każdego dnia. Odhaczasz każde wystąpienie; przegapione widać.'
  },
  {
    value: 'period', label: 'Przez pewien czas, regularnie',
    says: 'Ma czas na wykonanie i wraca co jakiś czas — np. sprzątanie kościoła: 3 dni na wykonanie, co 2 tygodnie. Pojawia się na początku i staje się coraz pilniejsze aż do końca.'
  },
  {
    value: 'after', label: 'Co pewien czas od wykonania',
    says: 'Liczy czas od ostatniego wykonania — np. podlać kwiaty co 3 dni. Gdy odhaczysz, licznik zaczyna od nowa.'
  }
];

/** Ein Abstand in die grösste Einheit, die ihn glatt teilt. */
function split(minutes: number): { amount: number; unit: number } {
  for (const unit of [10080, 1440, 60]) if (minutes % unit === 0) return { amount: minutes / unit, unit };
  return { amount: Math.max(1, Math.round(minutes / 60)), unit: 60 };
}

/** Wieviel davon in Minuten — für Dauer und Abstand. */
function Amount({ label, amount, unit, onAmount, onUnit }: {
  label: string; amount: number; unit: number; onAmount: (n: number) => void; onUnit: (n: number) => void;
}) {
  return (
    <>
      <label className="wk-field wk-ev-every">
        <span>{label}</span>
        <input type="number" min={1} max={999} value={amount} onChange={(e) => onAmount(Math.max(1, Number(e.target.value) || 1))} />
      </label>
      <label className="wk-field">
        <span>&nbsp;</span>
        <select value={unit} aria-label="Jednostka" onChange={(e) => onUnit(Number(e.target.value))}>
          {UNITS.map((one) => <option key={one.minutes} value={one.minutes}>{one.label}</option>)}
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
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
    if (title.trim() === '') throw new WorkspaceError('Nazwij zadanie.');
    if (kind === 'window' && endsAt.getTime() < startsAt.getTime()) {
      throw new WorkspaceError('Koniec wypada przed początkiem.');
    }
    if (kind === 'window' && windowMinutes > MAX_WINDOW_MINUTES) {
      throw new WorkspaceError('Okno dłuższe niż rok — to już nie termin, tylko postanowienie.');
    }
    if (kind === 'period' && everyMinutes < periodMinutes) {
      throw new WorkspaceError('Zadanie nie może wracać częściej, niż trwa — wydłuż odstęp albo skróć czas na wykonanie.');
    }
    if (kind === 'period' && periodMinutes > MAX_WINDOW_MINUTES) {
      throw new WorkspaceError('Czas na wykonanie dłuższy niż rok — to już postanowienie, nie zadanie.');
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
  const says = KINDS.find((k) => k.value === kind)?.says ?? '';

  /* Was eine Erinnerung bei dieser Art heisst — bei „co pewien czas od wykonania" gibt es nur den Termin. */
  const reminderKinds: readonly ReminderKind[] = kind === 'after' ? ['start'] : ['start', 'middle', 'end'];

  return (
    <Modal title={task === null ? 'Nowe zadanie' : 'Zadanie'} onClose={onClose} wide>
      <form className="wk-form wk-ev-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {origin != null && task === null && (
          <p className="wk-note">Z rozmowy — zadanie zapamięta, z której wiadomości powstało, i pokaże się przy niej.</p>
        )}

        <div className="wk-seg wk-ev-scope" role="group" aria-label="Rodzaj zadania">
          {KINDS.map((one) => (
            <button key={one.value} type="button" aria-pressed={kind === one.value}
              className={kind === one.value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => setKind(one.value)}>{one.label}</button>
          ))}
        </div>
        <p className="wk-hint">{says}</p>

        <label className="wk-field">
          <span>Co</span>
          <input value={title} maxLength={200}
            placeholder={kind === 'window' ? 'np. Apel Jasnogórski' : kind === 'period' ? 'np. Posprzątać kościół' : 'np. Podlać kwiaty'}
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
        ) : kind === 'period' ? (
          <>
            <div className="wk-ev-when-row">
              <label className="wk-field">
                <span>Pierwszy raz od</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>o godz.</span>
                <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
              </label>
              <Amount label="Czas na wykonanie" amount={lastAmount} unit={lastUnit} onAmount={setLastAmount} onUnit={setLastUnit} />
              <Amount label="Wraca co" amount={amount} unit={unit} onAmount={setAmount} onUnit={setUnit} />
            </div>
            <p className="wk-hint">
              Pierwszy raz: od {due.toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              {' '}do {new Date(due.getTime() + periodMinutes * 60_000).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              {' '}— potem {everyWords(everyMinutes)}.
            </p>
          </>
        ) : (
          <div className="wk-ev-when-row">
            <Amount label="Co" amount={amount} unit={unit} onAmount={setAmount} onUnit={setUnit} />
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

        <fieldset className="wk-field wk-remind">
          <legend>Przypomnij</legend>
          <div className="wk-remind-row">
            {reminderKinds.map((r) => (
              <label key={r} className="wk-check">
                <input type="checkbox" checked={(remind & REMIND[r]) !== 0}
                  onChange={(e) => setRemind((was) => e.target.checked ? was | REMIND[r] : was & ~REMIND[r])} />
                <span>{kind === 'after' ? 'gdy przyjdzie pora' : REMIND_WORD[r]}</span>
              </label>
            ))}
          </div>
          <span className="wk-hint">Przypomnienie przychodzi na urządzenia, na których masz włączone powiadomienia.</span>
        </fieldset>

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
