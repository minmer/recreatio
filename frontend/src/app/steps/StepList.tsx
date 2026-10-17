/**
 * DIE SCHRITTE (0047) — beim Menschen, bei der Kanzlei, und wo sie angelegt werden.
 *
 * <code>
 *   SeatSteps     „Twoje kroki": was er noch tun muss — mit dem Formular zum
 *                 Ergänzen gleich an Ort und Stelle
 *   PersonSteps   bei der Kanzlei, in der Zeile eines Menschen: abhaken
 *   StepsEditor   im Reiter „Kroki": die von selbst entstandenen ansehen, die
 *                 von Hand anlegen, ordnen, mit Frist versehen — und (0098)
 *                 die Aufgaben mit Zeitraum (`TaskCard` zeigt sie)
 * </code>
 *
 * <b>Dieselbe Rechnung überall</b> (`steps.stepsFor`) — was die Kanzlei als
 * offen sieht, sieht der Mensch auch als offen.
 */

import { lazy, Suspense, useState } from 'react';

import { ChatStep, chatStepStatus } from './ChatStep';
import { useSeatChatRows } from '../seats/seatUnread';
import { FormCard } from '../forms/FormCard';
import type { SeatView } from '../seats/seatContext';
import { answerPresence, answerPresenceAsOffice, answerTask, answerTaskAsOffice, dueText, filledNow, markOwnStep, markStep, progressOf, stepsFor, chatTargetText, type StepState } from './steps';
import { OwnSubmissions } from '../forms/Submission';
import { TaskCard } from './TaskCard';
import { takenOf } from './taskTaken';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';

/* 0109 — „Naucz się" bringt Karten und Läufe mit: erst, wenn ein solcher Schritt dasteht. */
const LearnStep = lazy(() => import('../cogita/LearnStep').then((m) => ({ default: m.LearnStep })));

/** Das Zeichen vor einem Schritt — die Form trägt die Aussage, nicht nur die Farbe. */
function Mark({ status }: { status: StepState['status'] }) {
  return (
    <span className={`wk-step-mark is-${status}`} aria-hidden="true">
      {status === 'done' ? '✓' : status === 'overdue' ? '!' : '○'}
    </span>
  );
}

const STATUS_TEXT: Record<StepState['status'], string> = {
  done: 'zrobione',
  todo: 'do zrobienia',
  overdue: 'po terminie'
};

/** 0102 — bei „Przeczytaj wiadomości" heisst erledigt: gelesen. */
const statusText = (s: StepState): string =>
  s.chat === undefined ? STATUS_TEXT[s.status] : s.status === 'done' ? 'przeczytane' : 'nieprzeczytane';

/* -- Beim Menschen ---------------------------------------------------------------- */

/**
 * „TWOJE KROKI" — je Einsendung dieses Platzes, die keine Ergänzung ist.
 *
 * @param formId Nur die Schritte dieses Formulars; `null`: aller.
 */
export function SeatSteps({ seat, formId }: { seat: SeatView; formId: string | null }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const forms = seat.forms.filter((f) => formId === null || f.formId === formId);

  /* 0102 — „Przeczytaj wiadomości": der Stand live aus seinen Rozmowy (nur geholt, wenn es so einen Schritt gibt). */
  const reads = forms.some((f) => f.steps.some((s) => s.kind === 'chat'));
  const chatRows = useSeatChatRows(reads ? [seat.token] : []);

  if (forms.length === 0) {
    return <p className="wk-empty">Nie ma tu nic do zrobienia.</p>;
  }

  const tick = async (registrationId: string, stepId: string, done: boolean) => {
    setBusy(true);
    setFailed(null);

    try {
      await markOwnStep(seat.token, registrationId, stepId, done);
      seat.reload();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {forms.map((form) => {
        const states = stepsFor({
          hasSeat: true,
          confirmedAt: form.confirmedAt,
          extensions: form.extensions.map((e) => ({ moduleId: e.moduleId, name: e.name, audience: 'person' as const, repeat: e.repeat, questions: e.questions })),
          /* 0077 — eine wiederkehrende Ergänzung ist erledigt, wenn sie es für den LAUFENDEN Zeitraum ist. */
          filled: new Map(form.extensions.flatMap((e) => (e.registrationId === null || !filledNow(e.repeat, e) ? [] : [[e.moduleId, e.registrationId] as const]))),
          steps: form.steps,
          marks: form.marks,
          /* 0098 — die Aufgaben: was er gesagt hat, seine Tage; vor „widoczne od" noch nicht. */
          tasks: form.tasks,
          forPerson: true
        }).filter((s) => s.visibleToPerson)
          .map((s) => (s.chat === undefined ? s : { ...s, status: chatStepStatus(s, chatRows) }));

        const { done, total } = progressOf(states);
        /* 2026-10-17 — DER NÄCHSTE SCHRITT steht hervorgehoben da: was jetzt zu tun ist, ohne die Liste zu lesen. */
        const next = states.findIndex((one) => one.status !== 'done');

        return (
          <div key={form.registrationId} className="wk-steps">
            <p className="wk-hint">
              {done === total ? 'Wszystko zrobione. Dziękujemy!' : `Zrobione ${done} z ${total}.`}
            </p>
            <progress className="wk-progress" value={done} max={Math.max(total, 1)} aria-label="Postęp" />

            <ol className="wk-step-list">
              {states.map((s, at) => {
                const stepClass = `wk-step is-${s.status}${at === next ? ' is-next' : ''}`;
                const ext = s.extensionId === null ? undefined
                  : form.extensions.find((e) => e.moduleId === s.extensionId);
                const open = openKey === `${form.registrationId}|${s.key}`;
                const toggle = () => setOpenKey(open ? null : `${form.registrationId}|${s.key}`);

                /* 0098 — eine Aufgabe: ihre eigene Karte, mit Entscheidung und Tagen. */
                if (s.task !== undefined && s.stepId !== null) {
                  return (
                    <li key={s.key} className={stepClass}>
                      <TaskCard label={s.label} help={s.help} task={s.task} taken={takenOf(form.taken, s.stepId!)}
                        onChange={async (change) => { await answerTask(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }}
                        onPresence={async (change) => { await answerPresence(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }} />
                    </li>
                  );
                }

                /* 0102 — „Przeczytaj wiadomości": eine schmale Zeile wie eine Aufgabe, mit „Czytaj". */
                if (s.chat !== undefined) {
                  return <li key={s.key} className={stepClass}><ChatStep seat={seat} step={s} /></li>;
                }

                /* 0109 — „Naucz się": wie weit, und „Ucz się" an Ort und Stelle; die Schwelle hakt ab. */
                if (s.learn !== undefined) {
                  return <li key={s.key} className={stepClass}><Suspense fallback={<Loading label="Wczytywanie…" />}><LearnStep seat={seat} registrationId={form.registrationId} step={s} /></Suspense></li>;
                }

                return (
                  <li key={s.key} className={stepClass}>
                    <div className="wk-step-head">
                      <Mark status={s.status} />
                      <div className="wk-step-text">
                        <strong>{s.label}</strong>
                        <span className="wk-row-side">
                          {' · '}{STATUS_TEXT[s.status]}
                          {s.dueAt !== null && s.status !== 'done' && ` · do ${dueText(s.dueAt)}`}
                        </span>
                        {s.help !== null && s.key !== 'confirm' && <p className="wk-hint">{s.help}</p>}
                        {s.key === 'confirm' && s.status !== 'done' && (
                          <p className="wk-hint">Przejrzyj swoje dane w zgłoszeniu i potwierdź je.</p>
                        )}
                        {s.source === 'hand' && s.doneBy === 'office' && s.status !== 'done' && (
                          <p className="wk-hint">Odhacza kancelaria, gdy to otrzyma.</p>
                        )}
                        {s.booking !== undefined && <BookingLine booking={s.booking} />}
                      </div>

                      {/* 0100 — „Wybierz termin": dorthin, wo die Termine auf der Seite stehen. */}
                      {s.booking !== undefined && s.status !== 'done' && document.querySelector('.wk-card-slots') !== null && (
                        <button type="button" className="wk-btn" data-step-booking=""
                          onClick={() => document.querySelector('.wk-card-slots')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                          Wybierz termin
                        </button>
                      )}

                      {/* Was der Mensch selbst tun kann — gleich hier. */}
                      {ext !== undefined && (
                        <button type="button" className={s.status === 'done' ? 'wk-link-btn' : 'wk-btn'} onClick={toggle}>
                          {open ? 'Zwiń' : s.status === 'done' ? 'Zobacz' : 'Uzupełnij'}
                        </button>
                      )}
                      {s.source === 'hand' && s.doneBy === 'person' && s.stepId !== null && (
                        <button
                          type="button"
                          className={s.status === 'done' ? 'wk-link-btn' : 'wk-btn'}
                          disabled={busy}
                          onClick={() => void tick(form.registrationId, s.stepId!, s.status !== 'done')}
                        >
                          {s.status === 'done' ? 'Cofnij' : 'Zrobione'}
                        </button>
                      )}
                    </div>

                    {open && ext !== undefined && (
                      <div className="wk-step-body">
                        {ext.registrationId === null ? (
                          ext.closed
                            ? <p className="wk-note">Ten formularz jest już zamknięty.</p>
                            : <FormCard partId={ext.moduleId} title="" portalUnder="" seat={seat} />
                        ) : (
                          <OwnSubmissions seat={seat} formId={ext.moduleId} show={null} />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}

/** 0100 — „Wybierz termin": welcher Termin gewählt ist (und ob er noch auf ein Ja wartet) — oder wo man wählt. */
function BookingLine({ booking }: { booking: NonNullable<StepState['booking']> }) {
  const when = booking.chosen === null ? null : new Date(booking.chosen.startsAt).toLocaleString('pl-PL', {
    weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
  return (
    <p className="wk-hint" data-booking-line="">
      {when === null
        ? `Termin wybierasz w rezerwacji${booking.resourceName !== null ? ` „${booking.resourceName}"` : ''}.`
        : `Wybrany termin: ${when}${booking.chosen!.status === 'pending' ? ' — czeka na potwierdzenie' : ''}.`}
    </p>
  );
}

/* -- Bei der Kanzlei: in der Zeile eines Menschen ---------------------------------------- */

export function PersonSteps({ registrationId, states, onChanged, onError }: {
  registrationId: string;
  states: readonly StepState[];
  onChanged: () => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (states.length === 0) return null;

  const tick = async (stepId: string, done: boolean) => {
    setBusy(true);
    onError(null);

    try {
      await markStep(registrationId, stepId, done);
      await onChanged();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-steps">
      <h4 className="wk-h3">Postęp</h4>
      <ol className="wk-step-list">
        {states.map((s) => s.task !== undefined && s.stepId !== null ? (
          /* 0098 — eine Aufgabe: die Kanzlei trägt für den Menschen ein (er hat es gesagt, sie hat ihn gesehen). */
          <li key={s.key} className={`wk-step is-${s.status}`}>
            <TaskCard label={s.label} help={s.help} task={s.task} office
              onChange={async (change) => { await answerTaskAsOffice(registrationId, s.stepId!, change); await onChanged(); }}
              onPresence={async (change) => { await answerPresenceAsOffice(registrationId, s.stepId!, change); await onChanged(); }} />
          </li>
        ) : (
          <li key={s.key} className={`wk-step is-${s.status}`}>
            <div className="wk-step-head">
              <Mark status={s.status} />
              <div className="wk-step-text">
                <strong>{s.label}</strong>
                <span className="wk-row-side">
                  {' · '}{statusText(s)}
                  {s.doneAt !== null && ` ${new Date(s.doneAt).toLocaleDateString('pl-PL')}`}
                  {s.dueAt !== null && s.status !== 'done' && ` · do ${dueText(s.dueAt)}`}
                  {s.source === 'auto' ? ' · automatycznie' : s.doneBy === 'person' ? ' · odhacza osoba' : ''}
                  {!s.visibleToPerson && ' · osoba tego nie widzi'}
                </span>
                {s.booking !== undefined && <BookingLine booking={s.booking} />}
                {s.chat !== undefined && (
                  <p className="wk-hint" data-chat-line="">
                    Nowe wiadomości {chatTargetText(s.chat)} — {s.status === 'done' ? 'wszystko przeczytane' : 'jeszcze nieprzeczytane'}.
                  </p>
                )}
                {s.learn !== undefined && (
                  <p className="wk-hint" data-learn-line="">
                    Nauka do {Math.round(s.learn.threshold * 100)}% znajomości — {s.status === 'done' ? 'osiągnięte' : 'jeszcze nie'}. Postępy: Nauka → baza wiedzy → Postępy.
                  </p>
                )}
              </div>

              {/* Von Hand angelegt: die Kanzlei darf jeden abhaken — auch den, den sonst der Mensch abhakt. */}
              {s.source === 'hand' && s.stepId !== null && (
                <button
                  type="button"
                  className={s.status === 'done' ? 'wk-link-btn' : 'wk-btn wk-btn-quiet'}
                  disabled={busy}
                  onClick={() => void tick(s.stepId!, s.status !== 'done')}
                >
                  {s.status === 'done' ? 'Cofnij' : 'Odhacz'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
