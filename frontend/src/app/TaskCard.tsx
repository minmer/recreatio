/**
 * EINE AUFGABE (0098) — beim Menschen und bei der Kanzlei dieselbe Karte.
 *
 * <code>
 *   Różaniec w kościele                                  ✓ wykonane
 *   1–31 października · codziennie · 18:00, 30 min · potrzeba 5 razy
 *   [Przyjmuję] [Pomijam] [Odmawiam]            (oder: Twoja decyzja … zmień)
 *   Zaznacz dni wykonania:  [pn 6.10] [wt 7.10] [śr 8.10] …          [Zapisz dni]
 * </code>
 *
 * Wer Tage einträgt, hat angenommen. Tage aus der Zukunft gibt es nicht zum
 * Anklicken; nach „zaznaczać do" trägt nur noch die Kanzlei ein.
 *
 * <b>0099 — ZAPROSZENIE (Termine mit Fragen vorher):</b> statt der Entscheidung
 * und der Tage je Termin eine Zeile.
 *
 * <code>
 *   Odpust parafialny — służba                          będę
 *   sobota, 18 października · 10:00–12:00
 *   sob 18.10 · 10:00–12:00   [Będę] [Jeszcze nie wiem] [Nie będę]
 *       Co chcesz robić?  [Krzyż · wolne 1] [Świece · 1 z 2 wolne] [Kadzidło · zajęte]
 *   (nach dem Termin)   obecność ✓ · funkcja: Świece
 * </code>
 *
 * Bei der Kanzlei je Termin dazu die Liste: obecność / nieobecność /
 * usprawiedliwiona — dieselbe Zeile, die sie in „Lista obecności" für alle sieht.
 */

import { useEffect, useState } from 'react';

import {
  ANSWER_WORD, answerOpen, ATTENDANCE_WORD, attendanceOn, chipText, datesOf, dayText, dutyRoom, hoursOf, isoDay,
  neededText, nextDay, planText, PRESENCE_THEY, PRESENCE_WORD, presenceOn, reportsUntil, taskDays, timeText
} from './candidateTasks';
import { WorkspaceError } from './session';
import type { DutyTaken, PresenceAnswer, PresenceChange, StepState, TaskAnswer, TaskChange, TaskDate, TaskDuty } from './steps';

type Task = NonNullable<StepState['task']>;

/** 0099 — wie viele eine Funktion an einem Termin nehmen: Schlüssel `Tag|Funktion`. */
export type TakenMap = ReadonlyMap<string, number>;

export const takenKey = (day: string, dutyId: string): string => `${day}|${dutyId}`;

/** Die Zählung des Dienstes (je Aufgabe, Tag, Funktion) für eine Aufgabe. */
export const takenOf = (taken: readonly DutyTaken[] | undefined, stepId: string): TakenMap =>
  new Map((taken ?? []).filter((t) => t.stepId === stepId).map((t) => [takenKey(t.day, t.dutyId), t.count] as const));

export function TaskCard({ label, help, task, office = false, taken, onChange, onPresence }: {
  label: string;
  help: string | null;
  task: Task;
  /** Die Kanzlei trägt für den Menschen ein — auch nach „zaznaczać do". */
  office?: boolean;
  /** 0099 — wie voll die Funktionen sind (beim Menschen vom Dienst gezählt). */
  taken?: TakenMap;
  onChange: (change: TaskChange) => Promise<void>;
  /** 0099 — zu einem Termin: Antwort, Funktion, Liste. */
  onPresence?: (change: PresenceChange) => Promise<void>;
}) {
  const { plan, phase, state } = task;
  const today = isoDay(new Date());
  const saved = state?.days ?? [];
  const [days, setDays] = useState<readonly string[]>(saved);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState('');
  const savedKey = saved.join(',');

  useEffect(() => { setDays(savedKey === '' ? [] : savedKey.split(',')); }, [savedKey]);

  const act = async (change: () => Promise<void>) => {
    setBusy(true);
    setFailed(null);
    try {
      await change();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const asked = plan.presence === true && onPresence !== undefined;
  const answer = state?.answer ?? null;
  const mayAnswer = !asked && (office || phase !== 'over');
  /* 0099 — trägt die Kanzlei die Teilnahme ein, zeigt der Mensch keine Tage an. */
  const selfMarks = task.doneBy !== 'office';
  const mayMark = !asked && (office || selfMarks)
    && (office ? phase !== 'upcoming' && phase !== 'hidden' : phase === 'active' || phase === 'reporting') && answer !== 'refused';
  const choosable = taskDays(plan, today);
  const changed = [...days].sort().join(',') !== [...saved].sort().join(',');
  const toggle = (day: string) => setDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());

  const coming = phase === 'upcoming' || phase === 'active' ? nextDay(plan, today) : null;
  const at = plan.schedule === 'item'
    ? (() => { const d = datesOf(plan).find((one) => one.day === coming); return d === undefined ? null : hoursOf(d); })()
    : timeText(plan);
  const need = neededText(plan);
  const you = office ? 'Osoba' : 'Ty';

  /* 0099 — beim Zaproszenie: was zum nächsten Termin gesagt ist, auf den man noch antworten kann. */
  const nextOpen = asked ? datesOf(plan).find((d) => answerOpen(d)) ?? null : null;
  const nextSaid = nextOpen !== null ? presenceOn(state, nextOpen.day)?.answer ?? null : null;
  const status = task.fulfilled ? '✓ wykonane'
    : asked ? (task.declined ? (office ? 'nie będzie' : 'nie będę') : nextSaid !== null ? (office ? PRESENCE_THEY : PRESENCE_WORD)[nextSaid] : nextOpen === null ? '' : 'czeka na odpowiedź')
    : answer === null ? 'czeka na decyzję' : ANSWER_WORD[answer];
  const tone = task.fulfilled ? 'done' : asked ? (nextSaid === 'yes' ? 'accepted' : nextSaid === 'no' || task.declined ? 'refused' : nextSaid === 'maybe' ? 'passed' : 'open') : answer ?? 'open';

  return (
    <div className={`wk-task is-${tone}`} data-task={state?.stepId ?? ''}>
      <div className="wk-task-head">
        <strong className="wk-task-title">{label}</strong>
        {status !== '' && <span className={`wk-task-status is-${tone}`}>{status}</span>}
      </div>
      <p className="wk-task-plan">{planText(plan)}{need !== null && ` · potrzeba ${need}`}</p>
      {help !== null && help.trim() !== '' && <p className="wk-hint" style={{ whiteSpace: 'pre-wrap' }}>{help}</p>}

      <p className="wk-task-when">
        {phase === 'upcoming' && `Zaczyna się ${dayText(coming ?? plan.startsOn)}${at === null ? '' : `, ${at}`}.`}
        {coming !== null && phase === 'active' && (coming === today ? `Dziś${at === null ? '' : `, ${at}`}.` : `Najbliżej: ${dayText(coming)}${at === null ? '' : `, ${at}`}.`)}
        {phase === 'reporting' && (asked || !selfMarks ? 'Zakończone.' : `Zakończone — dni można zaznaczyć do ${dayText(reportsUntil(plan))}.`)}
        {phase === 'over' && 'Zakończone.'}
        {task.done > 0 && ` ${plan.schedule === 'item' ? 'Obecność' : 'Zaznaczone dni'}: ${task.done}${task.needed > 1 ? ` z ${task.needed}` : ''}.`}
        {!office && !selfMarks && !asked && ' Obecność zaznacza kancelaria.'}
      </p>

      {asked && (
        <PresenceDates plan={plan} task={task} office={office} taken={taken} busy={busy}
          onPresence={(change) => void act(() => onPresence!(change))} />
      )}

      {mayAnswer && (
        <div className="wk-task-answers" role="group" aria-label={`${label}: decyzja`}>
          {answer === null ? (
            <>
              <button type="button" className="wk-btn" disabled={busy} data-task-answer="accepted" onClick={() => void act(() => onChange({ answer: 'accepted' }))}>Przyjmuję</button>
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-task-answer="passed" onClick={() => void act(() => onChange({ answer: 'passed' }))}>Pomijam</button>
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-task-answer="refused" onClick={() => void act(() => onChange({ answer: 'refused' }))}>Odmawiam</button>
            </>
          ) : (
            <span className="wk-hint">
              {you === 'Ty' ? 'Twoja decyzja' : 'Decyzja osoby'}: {ANSWER_WORD[answer]}
              {state?.byPerson === false && answer !== null && ' (wpisała kancelaria)'}
              {' · zmień: '}
              {(['accepted', 'passed', 'refused'] as const).filter((a) => a !== answer).map((a: TaskAnswer, i) => (
                <span key={a}>
                  {i > 0 && ' · '}
                  <button type="button" className="wk-link-btn" disabled={busy} data-task-answer={a} onClick={() => void act(() => onChange({ answer: a }))}>
                    {a === 'accepted' ? 'przyjmuję' : a === 'passed' ? 'pomijam' : 'odmawiam'}
                  </button>
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {mayMark && choosable.length > 0 && (
        <div className="wk-task-days">
          <span className="wk-hint">{office ? 'Dni wykonania (wpisuje kancelaria):' : plan.schedule === 'any' ? 'Dzień wykonania:' : 'Zaznacz dni wykonania:'}</span>
          {plan.schedule === 'any' && choosable.length > 14 ? (
            <div className="wk-inline">
              {days.map((day) => (
                <button key={day} type="button" className="wk-task-day is-on" disabled={busy} aria-pressed="true" onClick={() => toggle(day)} title="Usuń">
                  {chipText(day)} ×
                </button>
              ))}
              <input type="date" value={picked} min={plan.startsOn} max={choosable[choosable.length - 1]} aria-label="Dzień"
                onChange={(e) => setPicked(e.target.value)} />
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || picked === '' || !choosable.includes(picked) || days.includes(picked)}
                onClick={() => { toggle(picked); setPicked(''); }}>Dodaj dzień</button>
            </div>
          ) : (
            <div className="wk-task-chips">
              {choosable.map((day) => (
                <button key={day} type="button" className={days.includes(day) ? 'wk-task-day is-on' : 'wk-task-day'} disabled={busy}
                  aria-pressed={days.includes(day)} data-task-day={day} onClick={() => toggle(day)}>
                  {chipText(day)}
                </button>
              ))}
            </div>
          )}
          {changed && (
            <div className="wk-actions">
              <button type="button" className="wk-btn" disabled={busy} data-task-save="" onClick={() => void act(() => onChange({ days }))}>
                {busy ? 'Zapisywanie…' : `Zapisz dni (${days.length})`}
              </button>
              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setDays(saved)}>Cofnij</button>
            </div>
          )}
        </div>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/* -- 0099: je Termin eine Zeile ------------------------------------------------------------------- */

const SHOWN = 3;

function PresenceDates({ plan, task, office, taken, busy, onPresence }: {
  plan: Task['plan'];
  task: Task;
  office: boolean;
  taken?: TakenMap;
  busy: boolean;
  onPresence: (change: PresenceChange) => void;
}) {
  const [all, setAll] = useState(false);
  const dates = datesOf(plan);
  const now = new Date();
  const ahead = dates.filter((d) => answerOpen(d, now));
  const behind = dates.filter((d) => !answerOpen(d, now)).reverse();

  if (dates.length === 0) return <p className="wk-hint">W tym okresie nie ma terminów (termin zmieniony albo usunięty z kalendarza).</p>;

  /* Bei der Kanzlei alle Termine; beim Menschen die nächsten — und die vergangenen zugeklappt. */
  const shownAhead = office || all ? ahead : ahead.slice(0, SHOWN);
  const row = (date: TaskDate) => (
    <DateRow key={date.day} date={date} task={task} office={office} taken={taken} busy={busy} onPresence={onPresence} />
  );

  return (
    <div className="wk-task-dates" data-presence-dates="">
      {shownAhead.length > 0 && <ul className="wk-date-list">{shownAhead.map(row)}</ul>}
      {!office && ahead.length > SHOWN && (
        <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>
          {all ? 'Pokaż mniej' : `Pokaż wszystkie terminy (${ahead.length})`}
        </button>
      )}
      {behind.length > 0 && (office || ahead.length === 0
        ? <ul className="wk-date-list">{behind.map(row)}</ul>
        : (
          <details className="wk-fold">
            <summary>Minione terminy ({behind.length})</summary>
            <ul className="wk-date-list">{behind.map(row)}</ul>
          </details>
        ))}
    </div>
  );
}

function DateRow({ date, task, office, taken, busy, onPresence }: {
  date: TaskDate;
  task: Task;
  office: boolean;
  taken?: TakenMap;
  busy: boolean;
  onPresence: (change: PresenceChange) => void;
}) {
  const said = presenceOn(task.state, date.day);
  const answer = said?.answer ?? null;
  const open = answerOpen(date);
  const today = isoDay(new Date());
  const markable = date.day <= today;
  const attendance = attendanceOn(task.state, date.day);
  const duties = task.duties;
  const dutyName = (id: string | null) => duties.find((d) => d.dutyId === id)?.label ?? 'funkcja';
  const words = office ? PRESENCE_THEY : PRESENCE_WORD;

  const say = (a: PresenceAnswer) => onPresence({ day: date.day, answer: answer === a ? 'none' : a });

  return (
    <li className={`wk-date is-${attendance ?? answer ?? 'open'}`} data-presence-day={date.day}>
      <div className="wk-date-head">
        <span className="wk-date-when">{chipText(date.day)} · {hoursOf(date)}</span>

        {/* VORHER: będę / jeszcze nie wiem / nie będę — beim Menschen bis zum Beginn, bei der Kanzlei immer. */}
        {(open || office) && (
          <span className="wk-seg" role="group" aria-label={`${chipText(date.day)}: odpowiedź`}>
            {(['yes', 'maybe', 'no'] as const).map((a) => (
              <button key={a} type="button" className={answer === a ? 'wk-seg-opt is-on' : 'wk-seg-opt'} aria-pressed={answer === a}
                disabled={busy} data-presence-answer={a} onClick={() => say(a)} title={a === 'maybe' && !office ? 'Jeszcze nie wiem' : undefined}>
                {a === 'yes' ? (office ? 'Będzie' : 'Będę') : a === 'maybe' ? (office ? 'Nie wie' : 'Nie wiem') : (office ? 'Nie będzie' : 'Nie będę')}
              </button>
            ))}
          </span>
        )}
        {!open && !office && answer !== null && <span className="wk-hint">{words[answer]}</span>}
      </div>

      {/* DIE FUNKTION — wer kommt, wählt, was er macht; volle sind zu, ausser der eigenen. */}
      {answer === 'yes' && duties.length > 0 && (open || office) && (
        <div className="wk-duties" role="group" aria-label="Funkcja">
          <span className="wk-hint">{office ? 'Funkcja:' : 'Co chcesz robić?'}</span>
          {duties.map((d: TaskDuty) => {
            const mine = said?.dutyId === d.dutyId;
            const count = taken?.get(takenKey(date.day, d.dutyId)) ?? 0;
            const room = dutyRoom(d.capacity, mine ? Math.max(0, count - 1) : count);
            return (
              <button key={d.dutyId} type="button" className={mine ? 'wk-duty is-on' : 'wk-duty'} aria-pressed={mine}
                disabled={busy || (room.full && !mine)} data-duty={d.dutyId}
                onClick={() => onPresence({ day: date.day, dutyId: mine ? '' : d.dutyId })}>
                {d.label ?? 'funkcja'}
                {mine ? ' ✓' : taken !== undefined && room.free !== null && (
                  <span className="wk-duty-room">{room.full ? ' · zajęte' : ` · wolne ${room.free}`}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {answer === 'yes' && said?.dutyId != null && !open && !office && <p className="wk-hint">Funkcja: {dutyName(said.dutyId)}</p>}

      {/* NACHHER: da gewesen? Die Kanzlei nach der Liste; der Mensch selbst, wenn er es einträgt. */}
      {!open && (
        office ? (
          markable && (
            <span className="wk-seg" role="group" aria-label={`${chipText(date.day)}: obecność`}>
              {(['present', 'absent', 'excused'] as const).map((a) => (
                <button key={a} type="button" className={attendance === a ? 'wk-seg-opt is-on' : 'wk-seg-opt'} aria-pressed={attendance === a}
                  disabled={busy} data-attendance={a} onClick={() => onPresence({ day: date.day, attendance: attendance === a ? 'none' : a })}>
                  {a === 'present' ? '✓ Obecność' : a === 'absent' ? 'Nieobecność' : 'Usprawiedliwiona'}
                </button>
              ))}
            </span>
          )
        ) : attendance !== null ? (
          <p className={`wk-date-was is-${attendance}`}>{attendance === 'present' ? '✓ obecność' : ATTENDANCE_WORD[attendance]}</p>
        ) : task.doneBy !== 'office' && markable && task.phase !== 'over' ? (
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-attendance="present"
            onClick={() => onPresence({ day: date.day, attendance: 'present' })}>
            Zaznacz obecność
          </button>
        ) : markable ? (
          <p className="wk-hint">Obecność zaznacza kancelaria.</p>
        ) : null
      )}
      {!office && attendance === 'present' && task.doneBy !== 'office' && task.phase !== 'over' && (
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onPresence({ day: date.day, attendance: 'none' })}>Cofnij</button>
      )}
    </li>
  );
}
