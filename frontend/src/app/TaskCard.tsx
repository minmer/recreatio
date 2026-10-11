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
 */

import { useEffect, useState } from 'react';

import {
  ANSWER_WORD, chipText, dayText, isoDay, neededText, nextDay, planText, reportsUntil, taskDays, timeText
} from './candidateTasks';
import { WorkspaceError } from './session';
import type { StepState, TaskAnswer, TaskChange } from './steps';

type Task = NonNullable<StepState['task']>;

export function TaskCard({ label, help, task, office = false, onChange }: {
  label: string;
  help: string | null;
  task: Task;
  /** Die Kanzlei trägt für den Menschen ein — auch nach „zaznaczać do". */
  office?: boolean;
  onChange: (change: TaskChange) => Promise<void>;
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

  const act = async (change: TaskChange) => {
    setBusy(true);
    setFailed(null);
    try {
      await onChange(change);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const answer = state?.answer ?? null;
  const mayAnswer = office || phase !== 'over';
  const mayMark = (office ? phase !== 'upcoming' && phase !== 'hidden' : phase === 'active' || phase === 'reporting') && answer !== 'refused';
  const choosable = taskDays(plan, today);
  const changed = [...days].sort().join(',') !== [...saved].sort().join(',');
  const toggle = (day: string) => setDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());

  const coming = phase === 'upcoming' || phase === 'active' ? nextDay(plan, today) : null;
  const at = timeText(plan);
  const need = neededText(plan);
  const you = office ? 'Osoba' : 'Ty';

  const status = task.fulfilled ? '✓ wykonane' : answer === null ? 'czeka na decyzję' : ANSWER_WORD[answer];

  return (
    <div className={`wk-task is-${task.fulfilled ? 'done' : answer ?? 'open'}`} data-task={state?.stepId ?? ''}>
      <div className="wk-task-head">
        <strong className="wk-task-title">{label}</strong>
        <span className={`wk-task-status is-${task.fulfilled ? 'done' : answer ?? 'open'}`}>{status}</span>
      </div>
      <p className="wk-task-plan">{planText(plan)}{need !== null && ` · potrzeba ${need}`}</p>
      {help !== null && help.trim() !== '' && <p className="wk-hint" style={{ whiteSpace: 'pre-wrap' }}>{help}</p>}

      <p className="wk-task-when">
        {phase === 'upcoming' && `Zaczyna się ${dayText(plan.startsOn)}.`}
        {coming !== null && phase === 'active' && (coming === today ? `Dziś${at === null ? '' : `, ${at}`}.` : `Najbliżej: ${dayText(coming)}${at === null ? '' : `, ${at}`}.`)}
        {phase === 'reporting' && `Zakończone — dni można zaznaczyć do ${dayText(reportsUntil(plan))}.`}
        {phase === 'over' && 'Zakończone.'}
        {task.done > 0 && ` Zaznaczone dni: ${task.done}${task.needed > 1 ? ` z ${task.needed}` : ''}.`}
      </p>

      {mayAnswer && (
        <div className="wk-task-answers" role="group" aria-label={`${label}: decyzja`}>
          {answer === null ? (
            <>
              <button type="button" className="wk-btn" disabled={busy} data-task-answer="accepted" onClick={() => void act({ answer: 'accepted' })}>Przyjmuję</button>
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-task-answer="passed" onClick={() => void act({ answer: 'passed' })}>Pomijam</button>
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} data-task-answer="refused" onClick={() => void act({ answer: 'refused' })}>Odmawiam</button>
            </>
          ) : (
            <span className="wk-hint">
              {you === 'Ty' ? 'Twoja decyzja' : 'Decyzja osoby'}: {ANSWER_WORD[answer]}
              {state?.byPerson === false && answer !== null && ' (wpisała kancelaria)'}
              {' · zmień: '}
              {(['accepted', 'passed', 'refused'] as const).filter((a) => a !== answer).map((a: TaskAnswer, i) => (
                <span key={a}>
                  {i > 0 && ' · '}
                  <button type="button" className="wk-link-btn" disabled={busy} data-task-answer={a} onClick={() => void act({ answer: a })}>
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
              <button type="button" className="wk-btn" disabled={busy} data-task-save="" onClick={() => void act({ days })}>
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
