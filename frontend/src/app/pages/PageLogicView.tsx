/**
 * DIE KARTE EINER SEITE, AUF DER SEITE (0048).
 *
 * <code>
 *   PageLogicProvider   rechnet für den oben Gewählten aus, was zu sehen ist
 *                       und wie seine Schritte stehen — neu, sobald er wechselt
 *                       oder sein Platz neu geladen wird
 *   PageSteps           die Liste des Bausteins „Kroki osoby"
 * </code>
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { usePerson } from './pagePerson';
import {
  evaluatePage, factsOfSeat, inputValue, NO_ONE, PageLogicContext, readLogic, usePageLogic,
  type Facts, type PageStep
} from './pageLogic';
import type { SeatView } from './seatContext';
import { markOwnStep } from './steps';
import { WorkspaceError } from './session';

export function PageLogicProvider({ logic: text, children }: { logic: string | null | undefined; children: ReactNode }) {
  const logic = useMemo(() => readLogic(text), [text]);
  const person = usePerson();
  const chosen = person?.chosen ?? null;
  const loggedIn = person?.options.some((one) => one.kind === 'role') ?? false;

  const [facts, setFacts] = useState<Facts>(NO_ONE);

  useEffect(() => {
    if (logic === null) return;
    let alive = true;

    if (chosen === null) {
      setFacts({ ...NO_ONE, loggedIn, now: new Date() });
    } else if (chosen.kind === 'role') {
      /* Eine eigene Person ohne Link: bekannt ist, dass sie gewählt und angemeldet ist. */
      setFacts({ ...NO_ONE, chosen: true, loggedIn: true, now: new Date() });
    } else {
      void factsOfSeat(chosen.seat, logic, loggedIn).then((found) => { if (alive) setFacts(found); });
    }

    return () => { alive = false; };
  }, [logic, chosen, loggedIn]);

  const state = useMemo(
    () => logic === null ? null : { logic, outcome: evaluatePage(logic, (node) => inputValue(node, facts), facts.now) },
    [logic, facts]);

  return <PageLogicContext.Provider value={state}>{children}</PageLogicContext.Provider>;
}

const MARK: Record<PageStep['status'], string> = { done: '✓', overdue: '!', todo: '○' };
const STATUS: Record<PageStep['status'], string> = { done: 'zrobione', todo: 'do zrobienia', overdue: 'po terminie' };

/**
 * „KROKI OSOBY" — die Liste, die auf der Karte der Seite entstanden ist.
 *
 * Was ein Schritt verlangt, sagt er selbst; führt er zu einem Baustein der
 * Seite, steht daneben „Przejdź". Hängt sein „zrobione" an einem Znacznik, den
 * der Mensch selbst setzt, setzt er ihn gleich hier.
 */
export function PageSteps({ seat }: { seat: SeatView | null }) {
  const state = usePageLogic();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (state === null || state.outcome.steps.length === 0) {
    return <p className="wk-empty">Nie ma tu nic do zrobienia.</p>;
  }

  const steps = state.outcome.steps;
  const done = steps.filter((s) => s.status === 'done').length;

  const tick = async (step: PageStep, on: boolean) => {
    if (seat === null || step.ownMark === null) return;
    const registrationId = seat.forms.find((f) => f.formId === step.ownMark!.formId)?.registrationId;
    if (registrationId === undefined) return;

    setBusy(true);
    setFailed(null);

    try {
      await markOwnStep(seat.token, registrationId, step.ownMark.stepId, on);
      seat.reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-steps">
      <p className="wk-hint">{done === steps.length ? 'Wszystko zrobione. Dziękujemy!' : `Zrobione ${done} z ${steps.length}.`}</p>

      <ol className="wk-step-list">
        {steps.map((s) => (
          <li key={s.nodeId} className={`wk-step is-${s.status}`}>
            <div className="wk-step-head">
              <span className={`wk-step-mark is-${s.status}`} aria-hidden="true">{MARK[s.status]}</span>
              <div className="wk-step-text">
                <strong>{s.label}</strong>
                <span className="wk-row-side">
                  {' · '}{STATUS[s.status]}
                  {s.dueAt !== null && s.status !== 'done'
                    && ` · do ${new Date(s.dueAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </span>
                {s.help !== null && <p className="wk-hint">{s.help}</p>}
              </div>

              {s.goto !== null && s.status !== 'done' && (
                <button
                  type="button" className="wk-link-btn"
                  onClick={() => document.getElementById(`part-${s.goto}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Przejdź
                </button>
              )}

              {s.ownMark !== null && seat !== null && seat.seatKey !== null && (
                <button
                  type="button" className={s.status === 'done' ? 'wk-link-btn' : 'wk-btn'} disabled={busy}
                  onClick={() => void tick(s, s.status !== 'done')}
                >
                  {s.status === 'done' ? 'Cofnij' : 'Zrobione'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
