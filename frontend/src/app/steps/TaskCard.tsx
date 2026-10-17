/**
 * EINE AUFGABE (0098) — beim Menschen und bei der Kanzlei dieselbe Karte.
 *
 * <b>0100 — NUR DER KALENDER</b> (Wunsch der Kanzlei): die Tage der Aufgabe
 * im Monatsblatt, und ein Klick auf einen Tag sagt etwas dazu — einmal tak,
 * zweimal nie, dreimal jeszcze nie wiem, ein viertes Mal nichts. Vorher
 * standen hier Przyjmuję / Pomijam / Odmawiam für das Ganze und darunter die
 * Tage zum Abhaken; jetzt stellt man sich zu jedem Tag.
 *
 * <code>
 *   Różaniec                                            tak 5 · nie 2
 *   1–31 października · codziennie · 18:00, 30 min
 *   Kliknij dzień: raz — tak, dwa razy — nie, trzy razy — jeszcze nie wiem, cztery razy — bez odpowiedzi.
 *   ‹  październik 2026  ›
 *   pn wt śr czw pt sob ndz
 *          1  2  3   4   5 …          (ein Tag, der nicht dazugehört, ist nur eine Zahl)
 * </code>
 *
 * Ein „tak" an einem vergangenen Tag zählt als getan. Bei Terminen mit Fragen
 * vorher (0099) antwortet der Mensch bis zum Beginn; ob er da war, trägt danach
 * die Liste ein (ein Punkt im Tag), und unter dem Blatt wählt, wer „tak" sagt,
 * seine Funktion. Bei der Kanzlei steht für solche Termine je Termin eine Zeile
 * mit der Liste (obecność / nieobecność / usprawiedliwiona).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  answerOpen, ATTENDANCE_WORD, attendanceOn, chipText, datesOf, dateOf, dayText, dutyRoom, hoursOf, isoDay,
  neededText, nextDay, planText, PRESENCE_THEY, PRESENCE_WORD, presenceOn, reportsUntil, taskDays, timeText
} from './candidateTasks';
import { WorkspaceError } from '../core/session';
import { takenKey, type TakenMap } from './taskTaken';
import type { PresenceAnswer, PresenceChange, StepState, TaskChange, TaskDate, TaskDuty } from './steps';

type Task = NonNullable<StepState['task']>;

/** Ein Klick weiter: nichts → tak → nie → jeszcze nie wiem → nichts. */
const NEXT: Record<PresenceAnswer | 'none', PresenceAnswer | 'none'> = { none: 'yes', yes: 'no', no: 'maybe', maybe: 'none' };

const WORD: Record<PresenceAnswer | 'none', string> = { yes: 'tak', no: 'nie', maybe: 'jeszcze nie wiem', none: 'bez odpowiedzi' };
const MARK: Record<PresenceAnswer, string> = { yes: '✓', no: '✕', maybe: '?' };

export function TaskCard({ label, help, task, office = false, taken, onPresence }: {
  label: string;
  help: string | null;
  task: Task;
  /** Die Kanzlei sagt für den Menschen — auch nach „zaznaczać do". */
  office?: boolean;
  /** 0099 — wie voll die Funktionen sind (beim Menschen vom Dienst gezählt). */
  taken?: TakenMap;
  /** 0098 — die Entscheidung für das Ganze; seit 0100 nicht mehr angeboten (bleibt für Aufrufer). */
  onChange?: (change: TaskChange) => Promise<void>;
  /** Zu einem Tag: Antwort, Funktion, Liste. */
  onPresence?: (change: PresenceChange) => Promise<void>;
}) {
  const { plan, phase, state } = task;
  const today = isoDay(new Date());
  const days = useMemo(() => taskDays(plan), [plan]);
  const item = plan.schedule === 'item';
  const asked = plan.presence === true;

  const coming = phase === 'upcoming' || phase === 'active' ? nextDay(plan, today) : null;
  const at = item
    ? (() => { const d = datesOf(plan).find((one) => one.day === coming); return d === undefined ? null : hoursOf(d); })()
    : timeText(plan);
  const need = neededText(plan);

  /* Das Schild: erledigt (mit einer Zahl), sonst was zu den Tagen gesagt ist. */
  const said = days.map((d) => presenceOn(state, d)?.answer ?? null);
  const yes = said.filter((a) => a === 'yes').length;
  const no = said.filter((a) => a === 'no').length;
  const maybe = said.filter((a) => a === 'maybe').length;
  const counted = task.needed !== null;
  const words = office ? PRESENCE_THEY : PRESENCE_WORD;
  /*
   * 0101 — ERFÜLLT IST GRÜN: mit einer Zahl „wykonane"; ohne, wenn zu jedem Tag
   * bis heute etwas gesagt ist, „na bieżąco" — und nach dem letzten Tag
   * „wykonane". (`is-fulfilled`, nicht `is-done`: das ist die durchgestrichene,
   * blasse Aufgabe der eigenen Liste.)
   */
  const over = phase === 'reporting' || phase === 'over' || coming === null;
  const status = task.fulfilled ? (counted || over ? '✓ wykonane' : '✓ na bieżąco')
    : days.length === 1 ? (said[0] === null ? 'czeka na odpowiedź' : asked ? words[said[0]] : WORD[said[0]])
    : yes + no + maybe === 0 ? 'czeka na odpowiedź'
    : [yes > 0 && `tak ${yes}`, no > 0 && `nie ${no}`, maybe > 0 && `? ${maybe}`].filter(Boolean).join(' · ');
  const tone = task.fulfilled ? 'fulfilled' : yes > 0 ? 'accepted' : no > 0 ? 'refused' : maybe > 0 ? 'passed' : 'open';

  /* 0101 — zugeklappt am Anfang: erst die Karte, der Kalender auf einen Klick. */
  const [open, setOpen] = useState(false);
  const rows = office && asked;

  /*
   * 0101 — EINE SCHMALE ZEILE: links ○ oder ✓, der Name, daneben klein und
   * blass der Zeitraum, rechts das Schild und ein Pfeil. Erst aufgeklappt die
   * Beschreibung, wann es ist, und der Kalender. (`wk-ptask`, nicht `wk-task`:
   * so heissen die eigenen Aufgaben im Kalender — dieselben Klassen hatten
   * deren Liste mitgestaltet.)
   */
  return (
    <div className={`wk-ptask is-${tone}${open ? ' is-open' : ''}`} data-task={state?.stepId ?? ''}>
      <button type="button" className="wk-ptask-row" aria-expanded={open} data-task-open="" onClick={() => setOpen(!open)}>
        <span className={`wk-ptask-dot${task.fulfilled ? ' is-ok' : ''}`} aria-hidden="true">
          {task.fulfilled && (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          )}
        </span>
        <span className="wk-ptask-name">
          <strong className="wk-ptask-title">{label}</strong>
          <span className="wk-ptask-plan">{planText(plan)}{need !== null && ` · potrzeba ${need}`}</span>
        </span>
        <span className={`wk-ptask-status is-${tone}`}>{status}</span>
        <span className="wk-ptask-chev" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>

      {/* Zugeklappt nur versteckt, nicht fort: was eben geklickt wurde, wird trotzdem gespeichert. */}
      <div hidden={!open} className="wk-ptask-body">
        {help !== null && help.trim() !== '' && <p className="wk-hint" style={{ whiteSpace: 'pre-wrap' }}>{help}</p>}
        <p className="wk-ptask-when">
          {phase === 'upcoming' && `Zaczyna się ${dayText(coming ?? plan.startsOn)}${at === null ? '' : `, ${at}`}.`}
          {coming !== null && phase === 'active' && at !== null && (coming === today ? `Dziś, ${at}.` : `Najbliżej: ${dayText(coming)}, ${at}.`)}
          {phase === 'reporting' && `Zakończone — odpowiadać można do ${dayText(reportsUntil(plan))}.`}
          {phase === 'over' && 'Zakończone.'}
          {task.done > 0 && ` ${item ? 'Obecność' : 'Zrobione'}: ${task.done}${task.needed !== null && task.needed > 1 ? ` z ${task.needed}` : ''}.`}
        </p>
        {onPresence !== undefined && (rows
          /* Bei der Kanzlei, für Termine mit Fragen vorher: je Termin eine Zeile, mit der Liste. */
          ? <PresenceDates plan={plan} task={task} taken={taken} onPresence={onPresence} />
          : <TaskCalendar task={task} days={days} office={office} taken={taken} onPresence={onPresence} />)}
      </div>
    </div>
  );
}

/* -- 0100: das Monatsblatt ----------------------------------------------------------------------- */

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const WEEK = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'ndz'];

/** Die Monate von … bis, als `YYYY-MM`. */
function monthsOf(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first.slice(0, 7)}-01T12:00:00`);
  while (isoDay(d).slice(0, 7) <= last.slice(0, 7)) {
    out.push(isoDay(d).slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function TaskCalendar({ task, days, office, taken, onPresence }: {
  task: Task;
  days: readonly string[];
  office: boolean;
  taken?: TakenMap;
  onPresence: (change: PresenceChange) => Promise<void>;
}) {
  const { plan, phase, state } = task;
  const today = isoDay(new Date());
  const inPlan = useMemo(() => new Set(days), [days]);
  const dates = useMemo(() => new Map(datesOf(plan).map((d) => [d.day, d] as const)), [plan]);
  const months = useMemo(() => (days.length === 0 ? [] : monthsOf(days[0], days[days.length - 1])), [days]);
  /* Das Blatt des heutigen Monats — vorher das erste, danach das letzte. */
  const [month, setMonth] = useState(() => {
    const here = months.indexOf(today.slice(0, 7));
    return here >= 0 ? here : months.length > 0 && months[0] > today.slice(0, 7) ? 0 : Math.max(0, months.length - 1);
  });
  const shown = months[Math.min(month, months.length - 1)] ?? null;

  /*
   * SOFORT sichtbar, kurz danach gespeichert: wer viermal klickt, um zu
   * „nichts" zurückzukommen, soll nicht vier Anfragen abwarten. Je Tag wartet
   * die letzte Wahl einen Augenblick; gespeichert wird der Reihe nach.
   */
  const [local, setLocal] = useState<ReadonlyMap<string, PresenceAnswer | null>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const timers = useRef(new Map<string, number>());
  const chain = useRef<Promise<void>>(Promise.resolve());

  const server = (day: string) => presenceOn(state, day)?.answer ?? null;
  const shownAnswer = (day: string) => (local.has(day) ? local.get(day)! : server(day));

  /* Was der Dienst inzwischen genauso hat, braucht keinen Vorrang mehr. */
  useEffect(() => {
    setLocal((was) => {
      let changed = false;
      const next = new Map(was);
      for (const [day, answer] of was) {
        if (!timers.current.has(day) && server(day) === answer) { next.delete(day); changed = true; }
      }
      return changed ? next : was;
    });
  }, [state]);

  useEffect(() => () => { for (const t of timers.current.values()) window.clearTimeout(t); }, []);

  /* Wer hier noch etwas sagen darf: die Kanzlei immer; der Mensch bis zum Beginn (Termine mit Fragen vorher) bzw. bis „zaznaczać do". */
  const locked = (day: string): boolean => {
    if (office) return false;
    if (phase === 'over') return true;
    const date = dates.get(day);
    return plan.presence === true && date !== undefined && !answerOpen(date);
  };

  const click = (day: string) => {
    if (locked(day)) return;
    const next = NEXT[shownAnswer(day) ?? 'none'];
    const value = next === 'none' ? null : next;
    setFailed(null);
    setLocal((was) => new Map(was).set(day, value));

    const before = timers.current.get(day);
    if (before !== undefined) window.clearTimeout(before);
    timers.current.set(day, window.setTimeout(() => {
      timers.current.delete(day);
      setSaving((n) => n + 1);
      chain.current = chain.current
        .then(() => onPresence({ day, answer: value ?? 'none' }))
        .catch((e: unknown) => {
          setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
          setLocal((was) => { const n = new Map(was); n.delete(day); return n; });
        })
        .finally(() => setSaving((n) => n - 1));
    }, 700));
  };

  if (days.length === 0 || shown === null) {
    return <p className="wk-hint">W tym okresie nie ma dni tego zadania (termin zmieniony albo usunięty z kalendarza).</p>;
  }

  const first = dateOf(`${shown}-01`);
  const lead = (first.getDay() + 6) % 7;
  const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(lead).fill(null)];
  for (let n = 1; n <= length; n += 1) cells.push(`${shown}-${String(n).padStart(2, '0')}`);

  /* Unter dem Blatt: wer an einem Termin „tak" sagt, wählt seine Funktion. */
  const choosing = task.duties.length > 0 && plan.presence === true
    ? datesOf(plan).filter((d) => shownAnswer(d.day) === 'yes' && (office || answerOpen(d)))
    : [];

  return (
    <div className="wk-taskcal" data-task-calendar="">
      <p className="wk-taskcal-how">
        Kliknij dzień: raz — <span className="wk-taskcal-word is-yes">tak</span>, dwa razy — <span className="wk-taskcal-word is-no">nie</span>,
        {' '}trzy razy — <span className="wk-taskcal-word is-maybe">jeszcze nie wiem</span>, cztery razy — bez odpowiedzi.
      </p>

      <div className="wk-taskcal-sheet">
        <div className="wk-taskcal-head">
          <button type="button" className="wk-taskcal-nav" disabled={month <= 0} aria-label="Poprzedni miesiąc" onClick={() => setMonth(month - 1)}>‹</button>
          <strong>{MONTHS[first.getMonth()]} {first.getFullYear()}</strong>
          <button type="button" className="wk-taskcal-nav" disabled={month >= months.length - 1} aria-label="Następny miesiąc" onClick={() => setMonth(month + 1)}>›</button>
        </div>
        <div className="wk-taskcal-grid" role="group" aria-label={`${MONTHS[first.getMonth()]} ${first.getFullYear()}`}>
          {WEEK.map((w) => <span key={w} className="wk-taskcal-dow" aria-hidden="true">{w}</span>)}
          {cells.map((day, i) => {
            if (day === null) return <span key={`gap-${i}`} className="wk-taskcal-gap" aria-hidden="true" />;
            const number = Number(day.slice(8));
            if (!inPlan.has(day)) return <span key={day} className="wk-taskcal-off" aria-hidden="true">{number}</span>;
            const answer = shownAnswer(day);
            const was = attendanceOn(state, day);
            const date = dates.get(day);
            const shut = locked(day);
            const name = `${chipText(day)}${date !== undefined ? `, ${hoursOf(date)}` : ''}: ${WORD[answer ?? 'none']}${was !== null ? ` · ${ATTENDANCE_WORD[was]}` : ''}`;
            return (
              <button key={day} type="button" data-task-cal-day={day} data-answer={answer ?? 'none'}
                className={`wk-taskcal-day is-${answer ?? 'none'}${day === today ? ' is-today' : ''}${shut ? ' is-shut' : ''}`}
                aria-label={name} title={name} disabled={shut} onClick={() => click(day)}>
                <span className="wk-taskcal-num">{number}</span>
                {answer !== null && <span className="wk-taskcal-mark" aria-hidden="true">{MARK[answer]}</span>}
                {was !== null && <span className={`wk-taskcal-was is-${was}`} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {choosing.map((d) => (
        <div key={d.day} className="wk-duties" role="group" aria-label={`${chipText(d.day)}: funkcja`} data-duties-day={d.day}>
          <span className="wk-hint">{chipText(d.day)} — {office ? 'funkcja:' : 'co chcesz robić?'}</span>
          <DutyChips day={d.day} task={task} taken={taken} onPresence={onPresence} onFailed={setFailed} />
        </div>
      ))}

      {saving > 0 && <p className="wk-hint" role="status">Zapisywanie…</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/** Die Funktionen eines Termins — volle sind zu, ausser der eigenen. */
function DutyChips({ day, task, taken, onPresence, onFailed }: {
  day: string;
  task: Task;
  taken?: TakenMap;
  onPresence: (change: PresenceChange) => Promise<void>;
  onFailed: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const said = presenceOn(task.state, day);

  const pick = async (dutyId: string) => {
    setBusy(true);
    onFailed(null);
    try {
      await onPresence({ day, answer: 'yes', dutyId });
    } catch (e) {
      onFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {task.duties.map((d: TaskDuty) => {
        const mine = said?.dutyId === d.dutyId;
        const count = taken?.get(takenKey(day, d.dutyId)) ?? 0;
        const room = dutyRoom(d.capacity, count);
        return (
          <button key={d.dutyId} type="button" className={mine ? 'wk-duty is-on' : 'wk-duty'} aria-pressed={mine}
            disabled={busy || (room.full && !mine)} data-duty={d.dutyId}
            onClick={() => void pick(mine ? '' : d.dutyId)}>
            {d.label ?? 'funkcja'}
            {mine ? ' ✓' : taken !== undefined && room.free !== null && (
              <span className="wk-duty-room">{room.full ? ' · zajęte' : ` · wolne ${room.free}`}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

/* -- 0099: bei der Kanzlei je Termin eine Zeile (Termine mit Fragen vorher) ------------------------- */

function PresenceDates({ plan, task, taken, onPresence }: {
  plan: Task['plan'];
  task: Task;
  taken?: TakenMap;
  onPresence: (change: PresenceChange) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const dates = datesOf(plan);
  const now = new Date();
  const ahead = dates.filter((d) => answerOpen(d, now));
  const behind = dates.filter((d) => !answerOpen(d, now)).reverse();

  if (dates.length === 0) return <p className="wk-hint">W tym okresie nie ma terminów (termin zmieniony albo usunięty z kalendarza).</p>;

  const act = (change: PresenceChange) => {
    setBusy(true);
    setFailed(null);
    void onPresence(change)
      .catch((e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.'))
      .finally(() => setBusy(false));
  };

  const row = (date: TaskDate) => <DateRow key={date.day} date={date} task={task} taken={taken} busy={busy} onPresence={act} />;

  return (
    <div className="wk-task-dates" data-presence-dates="">
      {ahead.length > 0 && <ul className="wk-date-list">{ahead.map(row)}</ul>}
      {behind.length > 0 && <ul className="wk-date-list">{behind.map(row)}</ul>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

function DateRow({ date, task, taken, busy, onPresence }: {
  date: TaskDate;
  task: Task;
  taken?: TakenMap;
  busy: boolean;
  onPresence: (change: PresenceChange) => void;
}) {
  const said = presenceOn(task.state, date.day);
  const answer = said?.answer ?? null;
  const markable = date.day <= isoDay(new Date());
  const attendance = attendanceOn(task.state, date.day);

  return (
    <li className={`wk-date is-${attendance ?? answer ?? 'open'}`} data-presence-day={date.day}>
      <div className="wk-date-head">
        <span className="wk-date-when">{chipText(date.day)} · {hoursOf(date)}</span>
        <span className="wk-seg" role="group" aria-label={`${chipText(date.day)}: odpowiedź`}>
          {(['yes', 'maybe', 'no'] as const).map((a) => (
            <button key={a} type="button" className={answer === a ? 'wk-seg-opt is-on' : 'wk-seg-opt'} aria-pressed={answer === a}
              disabled={busy} data-presence-answer={a} onClick={() => onPresence({ day: date.day, answer: answer === a ? 'none' : a })}>
              {a === 'yes' ? 'Będzie' : a === 'maybe' ? 'Nie wie' : 'Nie będzie'}
            </button>
          ))}
        </span>
      </div>

      {answer === 'yes' && task.duties.length > 0 && (
        <div className="wk-duties" role="group" aria-label="Funkcja">
          <span className="wk-hint">Funkcja:</span>
          {task.duties.map((d: TaskDuty) => {
            const mine = said?.dutyId === d.dutyId;
            const room = dutyRoom(d.capacity, taken?.get(takenKey(date.day, d.dutyId)) ?? 0);
            return (
              <button key={d.dutyId} type="button" className={mine ? 'wk-duty is-on' : 'wk-duty'} aria-pressed={mine}
                disabled={busy || (room.full && !mine)} data-duty={d.dutyId}
                onClick={() => onPresence({ day: date.day, dutyId: mine ? '' : d.dutyId })}>
                {d.label ?? 'funkcja'}{mine && ' ✓'}
              </button>
            );
          })}
        </div>
      )}

      {/* NACHHER: da gewesen? */}
      {markable && (
        <span className="wk-seg" role="group" aria-label={`${chipText(date.day)}: obecność`}>
          {(['present', 'absent', 'excused'] as const).map((a) => (
            <button key={a} type="button" className={attendance === a ? 'wk-seg-opt is-on' : 'wk-seg-opt'} aria-pressed={attendance === a}
              disabled={busy} data-attendance={a} onClick={() => onPresence({ day: date.day, attendance: attendance === a ? 'none' : a })}>
              {a === 'present' ? '✓ Obecność' : a === 'absent' ? 'Nieobecność' : 'Usprawiedliwiona'}
            </button>
          ))}
        </span>
      )}
    </li>
  );
}
