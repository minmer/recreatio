/**
 * LISTA OBECNOŚCI (0099) — bei der Kanzlei, je Aufgabe an Terminen und je
 * Termin: wer kommt, wer nicht weiss, wer abgesagt hat, wer keine Antwort gab;
 * welche Funktion wer nimmt (das Fest der Ministranten von innen); und nach
 * dem Termin, wer da war.
 *
 * <code>
 *   Spotkanie formacyjne — lista              [sob 11.10] [sob 18.10] [sob 25.10]
 *   będzie 12 · nie wie 3 · nie będzie 2 · bez odpowiedzi 5
 *   Krzyż 1/1: Jan Kowalski · Świece 1/2: Ewa Lis · Kadzidło 0/1
 *   Jan Kowalski     [Będzie][Nie wie][Nie będzie]  [Krzyż ▾]   [✓ Obecność][Nieobecność][Usprawiedliwiona]
 * </code>
 *
 * Dieselben Zeilen wie beim Menschen und in seiner Karte (`TaskCard`); hier nur
 * alle untereinander, für einen Termin.
 */

import { useMemo, useState } from 'react';

import {
  attendanceOn, chipText, datesOf, hoursOf, isoDay, planText, PRESENCE_THEY, presenceOn
} from './candidateTasks';
import type { DeskRow } from '../forms/entryDesk';
import { WorkspaceError } from '../core/session';
import { answerPresenceAsOffice, type OpenStep, type PresenceAnswer, type PresenceChange } from './steps';
import { useT } from '../core/i18n';

export function TaskSheets({ steps, rows, onChanged }: {
  steps: readonly OpenStep[];
  rows: readonly DeskRow[];
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const sheets = steps.filter((s) => s.kind === 'task' && s.task?.schedule === 'item');
  if (sheets.length === 0) return null;

  return (
    <section className="wk-panel wk-sheets" data-task-sheets="">
      <h3 className="wk-h2">{t('steps.sheet.title')}</h3>
      <p className="wk-hint">
        {t('steps.sheet.hint')}
      </p>
      {sheets.map((step) => <TaskSheet key={step.stepId} step={step} rows={rows} onChanged={onChanged} />)}
    </section>
  );
}

function TaskSheet({ step, rows, onChanged }: { step: OpenStep; rows: readonly DeskRow[]; onChanged: () => Promise<void> }) {
  const t = useT();
  const plan = step.task!;
  const dates = datesOf(plan);
  const today = isoDay(new Date());
  const [day, setDay] = useState<string | null>(() => (dates.find((d) => d.day >= today) ?? dates[dates.length - 1])?.day ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const duties = step.duties ?? [];
  const asked = plan.presence === true;

  const people = useMemo(() => rows.filter((r) => r.s.withdrawnAt === null && !r.s.hidden), [rows]);
  const stateOf = (r: DeskRow) => r.s.tasks?.find((x) => x.stepId === step.stepId);
  const date = dates.find((d) => d.day === day) ?? null;

  if (dates.length === 0) {
    return (
      <article className="wk-sheet" data-task-sheet={step.stepId}>
        <h4 className="wk-h3">{step.label ?? t('steps.task')}</h4>
        <p className="wk-hint">{t('steps.sheet.noDates')}</p>
      </article>
    );
  }

  const change = async (r: DeskRow, what: Omit<PresenceChange, 'day'>) => {
    if (day === null) return;
    setBusy(r.s.registrationId);
    setFailed(null);
    try {
      await answerPresenceAsOffice(r.s.registrationId, step.stepId, { day, ...what });
      await onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? `${r.name}: ${e.message}` : t('steps.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  /* Die Zählung des Termins — Antworten vorher, Funktionen, und nachher die Liste. */
  const said = (r: DeskRow) => (day === null ? undefined : presenceOn(stateOf(r), day));
  const count = (a: PresenceAnswer) => people.filter((r) => said(r)?.answer === a).length;
  const silent = people.filter((r) => (said(r)?.answer ?? null) === null).length;
  const was = (a: 'present' | 'absent' | 'excused') => people.filter((r) => day !== null && attendanceOn(stateOf(r), day) === a).length;
  const after = date !== null && date.day <= today;

  return (
    <article className="wk-sheet" data-task-sheet={step.stepId}>
      <h4 className="wk-h3">{step.label ?? t('steps.task')}</h4>
      <p className="wk-hint">{planText(plan)}</p>

      <div className="wk-task-chips" role="group" aria-label={t('steps.sheet.date')}>
        {dates.map((d) => (
          <button key={d.day} type="button" className={d.day === day ? 'wk-task-day is-on' : 'wk-task-day'} aria-pressed={d.day === day}
            data-sheet-day={d.day} onClick={() => setDay(d.day)}>
            {chipText(d.day)}
          </button>
        ))}
      </div>

      {date !== null && (
        <>
          <p className="wk-sheet-sum" data-sheet-sum="">
            <strong>{chipText(date.day)} · {hoursOf(date)}</strong>
            {asked && ` · ${PRESENCE_THEY.yes} ${count('yes')} · ${PRESENCE_THEY.maybe} ${count('maybe')} · ${PRESENCE_THEY.no} ${count('no')} · ${t('steps.sheet.noAnswer', { count: silent })}`}
            {after && ` · ${t('steps.sheet.attendance', { present: was('present'), absent: was('absent'), excused: was('excused') })}`}
          </p>

          {duties.length > 0 && (
            <ul className="wk-sheet-duties" data-sheet-duties="">
              {duties.map((d) => {
                const takers = people.filter((r) => said(r)?.answer === 'yes' && said(r)?.dutyId === d.dutyId);
                return (
                  <li key={d.dutyId}>
                    <strong>{d.label ?? t('steps.duty')}</strong>{' '}
                    <span className="wk-hint">{takers.length}{d.capacity === null ? '' : `/${d.capacity}`}</span>
                    {takers.length > 0 && `: ${takers.map((r) => r.name).join(', ')}`}
                  </li>
                );
              })}
            </ul>
          )}

          <ul className="wk-sheet-rows">
            {people.map((r) => {
              const p = said(r);
              const answer = p?.answer ?? null;
              const attendance = attendanceOn(stateOf(r), date.day);
              const working = busy === r.s.registrationId;
              return (
                <li key={r.s.registrationId} className="wk-sheet-row" data-sheet-row={r.s.registrationId}>
                  <span className="wk-sheet-name">{r.name}</span>
                  {asked && (
                    <span className="wk-seg" role="group" aria-label={t('steps.sheet.answerOf', { name: r.name })}>
                      {(['yes', 'maybe', 'no'] as const).map((a) => (
                        <button key={a} type="button" className={answer === a ? 'wk-seg-opt is-on' : 'wk-seg-opt'} aria-pressed={answer === a}
                          disabled={busy !== null} data-sheet-answer={a} onClick={() => void change(r, { answer: answer === a ? 'none' : a })}>
                          {a === 'yes' ? t('steps.sheet.yes') : a === 'maybe' ? t('steps.sheet.maybe') : t('steps.sheet.no')}
                        </button>
                      ))}
                    </span>
                  )}
                  {asked && duties.length > 0 && answer === 'yes' && (
                    <select value={p?.dutyId ?? ''} disabled={busy !== null} aria-label={t('steps.sheet.dutyOf', { name: r.name })} data-sheet-duty=""
                      onChange={(e) => void change(r, { dutyId: e.target.value })}>
                      <option value="">{t('steps.noDuty')}</option>
                      {duties.map((d) => <option key={d.dutyId} value={d.dutyId}>{d.label ?? t('steps.duty')}</option>)}
                    </select>
                  )}
                  {after && (
                    <span className="wk-seg" role="group" aria-label={t('steps.sheet.attendanceOf', { name: r.name })}>
                      {(['present', 'absent', 'excused'] as const).map((a) => (
                        <button key={a} type="button" className={attendance === a ? 'wk-seg-opt is-on' : 'wk-seg-opt'} aria-pressed={attendance === a}
                          disabled={busy !== null} data-sheet-attendance={a}
                          onClick={() => void change(r, { attendance: attendance === a ? 'none' : a })}>
                          {a === 'present' ? t('steps.sheet.present') : a === 'absent' ? t('steps.sheet.absent') : t('steps.sheet.excused')}
                        </button>
                      ))}
                    </span>
                  )}
                  {working && <span className="wk-hint">{t('common.saving')}</span>}
                </li>
              );
            })}
          </ul>
          {people.length === 0 && <p className="wk-empty">{t('steps.sheet.nobody')}</p>}
        </>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </article>
  );
}
