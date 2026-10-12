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

import { useState } from 'react';

import { isoDay, periodText, planText, WEEKDAYS } from './candidateTasks';
import { PickCalendar, PickCalendarItem } from './PickCalendar';
import { PickResource } from './PickResource';
import { PickChatTarget } from './PickChatTarget';
import { ChatStep, chatStepStatus } from './ChatStep';
import { useSeatChatRows } from './seatUnread';
import { FormCard } from './FormCard';
import { newId } from './ids';
import type { SeatView } from './seatContext';
import {
  answerPresence, answerPresenceAsOffice, answerTask, answerTaskAsOffice, dueText, filledNow, markOwnStep, markStep, progressOf,
  saveSteps, stepsFor, taskIn, chatTargetText,
  type DoneBy, type DutyDraft, type ExtensionInfo, type OpenStep, type StepDraft, type StepState, type TaskDraft,
  type TaskSchedule
} from './steps';
import { OwnSubmissions } from './Submission';
import { TaskCard, takenOf } from './TaskCard';
import { WorkspaceError } from './session';

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

        return (
          <div key={form.registrationId} className="wk-steps">
            <p className="wk-hint">
              {done === total ? 'Wszystko zrobione. Dziękujemy!' : `Zrobione ${done} z ${total}.`}
            </p>

            <ol className="wk-step-list">
              {states.map((s) => {
                const ext = s.extensionId === null ? undefined
                  : form.extensions.find((e) => e.moduleId === s.extensionId);
                const open = openKey === `${form.registrationId}|${s.key}`;
                const toggle = () => setOpenKey(open ? null : `${form.registrationId}|${s.key}`);

                /* 0098 — eine Aufgabe: ihre eigene Karte, mit Entscheidung und Tagen. */
                if (s.task !== undefined && s.stepId !== null) {
                  return (
                    <li key={s.key} className={`wk-step is-${s.status}`}>
                      <TaskCard label={s.label} help={s.help} task={s.task} taken={takenOf(form.taken, s.stepId!)}
                        onChange={async (change) => { await answerTask(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }}
                        onPresence={async (change) => { await answerPresence(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }} />
                    </li>
                  );
                }

                /* 0102 — „Przeczytaj wiadomości": eine schmale Zeile wie eine Aufgabe, mit „Czytaj". */
                if (s.chat !== undefined) {
                  return <li key={s.key} className={`wk-step is-${s.status}`}><ChatStep seat={seat} step={s} /></li>;
                }

                return (
                  <li key={s.key} className={`wk-step is-${s.status}`}>
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

/* -- Wo sie angelegt werden ---------------------------------------------------------------- */

const timeOf = (minute: number | null): string =>
  minute === null ? '' : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

const draftOf = (s: OpenStep): StepDraft => ({
  stepId: s.stepId,
  label: s.label ?? '',
  help: s.help ?? '',
  doneBy: s.doneBy,
  visibleToPerson: s.visibleToPerson,
  dueAt: s.dueAt === null ? '' : new Date(s.dueAt).toLocaleDateString('sv-SE'),
  kind: s.kind ?? 'mark',
  ...(s.kind === 'booking' ? { resourceId: s.booking?.resourceId ?? '' } : {}),
  ...(s.kind === 'chat' ? { chat: { kind: s.chat?.kind ?? 'all', areaId: s.chat?.areaId ?? '' } } : {}),
  ...(s.kind === 'task' && s.task != null ? {
    task: {
      startsOn: s.task.startsOn, endsOn: s.task.endsOn, schedule: s.task.schedule, weekdays: s.task.weekdays ?? 16,
      at: timeOf(s.task.atMinute), minutes: s.task.minutes === null ? '' : String(s.task.minutes),
      needed: s.task.needed === null ? '' : String(s.task.needed),
      showFrom: s.task.showFrom ?? '', reportUntil: s.task.reportUntil ?? '',
      /* 0099 — an Terminen: der Kalender, der Eintrag, vorher fragen, die Funktionen. */
      calendarId: s.task.calendarId ?? '', itemId: s.task.itemId ?? '', presence: s.task.presence === true,
      duties: (s.duties ?? []).map((d) => ({ dutyId: d.dutyId, label: d.label ?? '', capacity: d.capacity === null ? '' : String(d.capacity) }))
    }
  } : {})
});

/** Eine neue Aufgabe: der nächste Monat, jeden Tag. */
function newTask(): StepDraft {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    stepId: newId(), label: '', help: '', doneBy: 'person', visibleToPerson: true, dueAt: '', kind: 'task',
    task: {
      startsOn: isoDay(first), endsOn: isoDay(last), schedule: 'daily', weekdays: 16, at: '', minutes: '', needed: '', showFrom: '', reportUntil: '',
      calendarId: '', itemId: '', presence: false, duties: []
    }
  };
}

/** Was am Plan einer Aufgabe nicht stimmt — bevor der Dienst es sagt. */
function taskProblem(t: TaskDraft): string | null {
  if (t.startsOn === '' || t.endsOn === '') return 'podaj okres';
  if (t.endsOn < t.startsOn) return 'koniec przed początkiem';
  if (t.schedule === 'weekly' && t.weekdays === 0) return 'wybierz dni tygodnia';
  if (t.showFrom !== '' && t.showFrom > t.startsOn) return '„widoczne od" po początku';
  if (t.reportUntil !== '' && t.reportUntil < t.endsOn) return '„zaznaczać do" przed końcem';
  if (t.schedule === 'item' && (t.itemId ?? '') === '') return 'wybierz termin z kalendarza';
  /* (Ein Schritt „Wybierz termin" ohne Zasób prüft `save`.) */
  if ((t.duties ?? []).some((d) => d.capacity.trim() !== '' && !(Number.isInteger(Number(d.capacity)) && Number(d.capacity) >= 1 && Number(d.capacity) <= 500)))
    return 'ile osób w funkcji: liczba od 1 do 500 albo puste';
  return null;
}

/**
 * Der Reiter „Kroki".
 *
 * <b>Oben, was von selbst entsteht</b> — nicht zum Bearbeiten, sondern damit
 * man sieht, dass es da ist: wer eine Erweiterung anlegt, hat ihren Schritt
 * schon. <b>Darunter, was von Hand kommt</b> — als EINE Liste gespeichert, wie
 * der Aufbau eines Formulars.
 *
 * Der Aufrufer schlüsselt die Komponente nach dem geladenen Stand
 * (`stepsKey`): neu geladen heisst neu angefangen.
 */
export const stepsKey = (steps: readonly OpenStep[]): string =>
  steps.map((s) => `${s.stepId}:${s.label ?? ''}:${s.help ?? ''}:${s.doneBy}:${s.visibleToPerson}:${s.dueAt ?? ''}:${s.kind ?? 'mark'}:${JSON.stringify(s.task ?? null)}:${JSON.stringify(s.booking ?? null)}:${JSON.stringify(s.chat ?? null)}`).join('|');

export function StepsEditor({ partId, steps, extensions, formKey, busy, onSaved, onError }: {
  partId: string;
  steps: readonly OpenStep[];
  extensions: readonly ExtensionInfo[];

  /** Der Schlüssel des Formularbereichs — ohne ihn lässt sich nichts versiegeln. `null`: es gibt keinen. */
  formKey: (() => Promise<{ readonly areaId: string; readonly epoch: number; readonly key: Uint8Array }>) | null;
  busy: boolean;
  onSaved: () => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [drafts, setDrafts] = useState<readonly StepDraft[]>(() => steps.map(draftOf));
  const [saving, setSaving] = useState(false);

  const changed = JSON.stringify(drafts) !== JSON.stringify(steps.map(draftOf));
  const unreadable = steps.some((s) => s.label === null);

  const set = (i: number, patch: Partial<StepDraft>) =>
    setDrafts(drafts.map((one, at) => (at === i ? { ...one, ...patch } : one)));

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= drafts.length) return;
    const next = [...drafts];
    [next[i], next[j]] = [next[j], next[i]];
    setDrafts(next);
  };

  const save = async () => {
    if (formKey === null) return;
    const wrong = drafts.find((d) => d.kind === 'task' && d.label.trim() !== '' && d.task !== undefined && taskProblem(d.task) !== null);
    if (wrong !== undefined) {
      onError(`Zadanie „${wrong.label.trim()}": ${taskProblem(wrong.task!)}.`);
      return;
    }
    const unbooked = drafts.find((d) => d.kind === 'booking' && d.label.trim() !== '' && (d.resourceId ?? '') === '');
    if (unbooked !== undefined) {
      onError(`Znacznik „${unbooked.label.trim()}": wybierz, przy czym osoba wybiera termin.`);
      return;
    }
    setSaving(true);
    onError(null);

    try {
      await saveSteps(partId, drafts.filter((d) => d.label.trim() !== ''), await formKey());
      await onSaved();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać kroków.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="wk-panel">
      {formKey === null && (
        <p className="wk-warn">
          Zadania i znaczniki pieczętuje się kluczem obszaru formularza — ustaw obszar w „Ustawieniach"
          albo otwórz formularz kontem, które ten obszar czyta.
        </p>
      )}
      {unreadable && (
        <p className="wk-warn">Części zadań lub znaczników nie da się odczytać tym kluczem — zapisanie ich nadpisze.</p>
      )}

      {/*
        0098 — ZADANIA DLA OSÓB: przez jakiś czas, z decyzją osoby i dniami
        („W październiku różaniec codziennie o 18:00", „Piątki: różaniec po
        angielsku", „Obejrzyj film do końca miesiąca"). Sie stehen oben: die
        Zakładka heißt im einfachen Weg „Zadania".
      */}
      <h3 className="wk-h2">Zadania dla osób</h3>
      <p className="wk-hint">
        Zadanie stoi u osoby przez swój okres. Osoba je przyjmuje, pomija albo odmawia — i zaznacza dni,
        w które je wykonała. Kancelaria widzi to przy każdej osobie i może wpisać za nią.
      </p>
      {!drafts.some((d) => d.kind === 'task') && <p className="wk-empty">Jeszcze żadnego zadania.</p>}

      <ol className="wk-step-edit" data-task-editor="">
        {drafts.map((d, i) => d.kind !== 'task' || d.task === undefined ? null : (
          <li key={d.stepId} className="wk-step-edit-row wk-task-edit" data-task-draft={d.stepId}>
            <TaskEdit draft={d} onChange={(patch) => set(i, patch)}
              onMove={(by) => move(i, by)} first={i === drafts.findIndex((x) => x.kind === 'task')}
              last={i === drafts.length - 1 - [...drafts].reverse().findIndex((x) => x.kind === 'task')}
              onRemove={() => setDrafts(drafts.filter((_, at) => at !== i))} />
          </li>
        ))}
      </ol>

      <div className="wk-actions">
        <button type="button" className="wk-link-btn" disabled={drafts.length >= 60} data-add-task=""
          onClick={() => setDrafts([...drafts, newTask()])}>
          + Dodaj zadanie
        </button>
      </div>

      <h3 className="wk-h2">Znaczniki</h3>
      <p className="wk-hint">
        Wszystko, czego nie widać w danych: „Zgoda rodzica dostarczona", „Quiz sprawdzony". Wybierz,
        kto odhacza — kancelaria (gdy to dostanie) albo osoba sama, w swoim linku. Znacznik może też odhaczać
        się sam: gdy osoba wybierze termin albo dopóki ma przeczytane wiadomości (kanał, rozmowa grupy, rozmowa z prowadzącymi).
      </p>

      {drafts.every((d) => d.kind === 'task') && <p className="wk-empty">Jeszcze żadnego.</p>}

      <ol className="wk-step-edit">
        {drafts.map((d, i) => d.kind === 'task' ? null : (
          <li key={d.stepId} className="wk-step-edit-row">
            <label className="wk-field">
              <span>Znacznik</span>
              <input value={d.label} placeholder="np. Zgoda rodzica dostarczona"
                onChange={(e) => set(i, { label: e.target.value })} />
            </label>
            <label className="wk-field">
              <span>Wyjaśnienie dla osoby (opcjonalnie)</span>
              <input value={d.help} placeholder="np. Formularz zgody jest w zakrystii."
                onChange={(e) => set(i, { help: e.target.value })} />
            </label>
            <div className="wk-inline">
              <label className="wk-inline">
                <span className="wk-hint">Odhacza</span>
                {/* 0100 — „sam": der Schritt erledigt sich, wenn die Person bei einem Zasób einen Termin nimmt. */}
                {/* 0102 — „sam": oder er ist erledigt, solange in den gewählten Rozmowy nichts Ungelesenes liegt. */}
                <select value={d.kind === 'booking' || d.kind === 'chat' ? d.kind : d.doneBy} data-mark-done-by=""
                  onChange={(e) => set(i, e.target.value === 'booking'
                    ? { kind: 'booking', doneBy: 'person', visibleToPerson: true, resourceId: d.resourceId ?? '' }
                    : e.target.value === 'chat'
                      ? { kind: 'chat', doneBy: 'person', visibleToPerson: true, dueAt: '', chat: d.chat ?? { kind: 'all', areaId: '' } }
                      : { kind: 'mark', doneBy: e.target.value as DoneBy })}>
                  <option value="office">kancelaria</option>
                  <option value="person">osoba sama</option>
                  <option value="booking">sam — gdy osoba wybierze termin</option>
                  <option value="chat">sam — gdy osoba przeczyta wiadomości</option>
                </select>
              </label>
              {d.kind === 'chat' && (
                <label className="wk-inline" data-mark-chat="">
                  <span className="wk-hint">W</span>
                  <PickChatTarget value={d.chat} onPick={(chat) => set(i, { chat })} />
                </label>
              )}
              {d.kind === 'booking' && (
                <label className="wk-inline" data-mark-resource="">
                  <span className="wk-hint">Termin w</span>
                  <PickResource value={d.resourceId ?? ''} busy={false} onPick={(resourceId) => set(i, { resourceId })} />
                </label>
              )}
              {d.kind !== 'booking' && d.kind !== 'chat' && d.doneBy === 'office' && (
                <label className="wk-inline">
                  <input type="checkbox" checked={d.visibleToPerson}
                    onChange={(e) => set(i, { visibleToPerson: e.target.checked })} />
                  <span>osoba go widzi</span>
                </label>
              )}
              {/* 0102 — Nowe wiadomości przychodzą ciągle: to stan, nie termin. */}
              {d.kind !== 'chat' && (
                <label className="wk-inline">
                  <span className="wk-hint">Termin</span>
                  <input type="date" value={d.dueAt} onChange={(e) => set(i, { dueAt: e.target.value })} />
                </label>
              )}
              <button type="button" className="wk-link-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Wyżej">↑</button>
              <button type="button" className="wk-link-btn" disabled={i === drafts.length - 1} onClick={() => move(i, 1)} aria-label="Niżej">↓</button>
              <button type="button" className="wk-link-btn wk-danger"
                onClick={() => setDrafts(drafts.filter((_, at) => at !== i))}>
                Usuń
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="wk-actions">
        <button
          type="button" className="wk-link-btn" disabled={drafts.length >= 60}
          onClick={() => setDrafts([...drafts, {
            stepId: newId(), label: '', help: '', doneBy: 'office', visibleToPerson: true, dueAt: '', kind: 'mark'
          }])}
        >
          + Dodaj znacznik
        </button>
        {/* 0102 — gleich fertig: „Przeczytaj wiadomości", erledigt, solange nichts Ungelesenes liegt. */}
        <button
          type="button" className="wk-link-btn" disabled={drafts.length >= 60} data-add-read=""
          onClick={() => setDrafts([...drafts, {
            stepId: newId(), label: 'Przeczytaj nowe wiadomości', help: '', doneBy: 'person', visibleToPerson: true, dueAt: '',
            kind: 'chat', chat: { kind: 'all', areaId: '' }
          }])}
        >
          + Dodaj: przeczytaj wiadomości
        </button>
      </div>

      {/* Ein Speichern für beide — Zadania und Znaczniki sind dieselben Zeilen (form_step). */}
      <div className="wk-actions">
        <button
          type="button" className="wk-btn"
          disabled={busy || saving || !changed || formKey === null}
          onClick={() => void save()}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz zadania i znaczniki'}
        </button>
        {changed && (
          <button type="button" className="wk-link-btn" disabled={saving} onClick={() => setDrafts(steps.map(draftOf))}>
            Cofnij zmiany
          </button>
        )}
      </div>
      {drafts.some((d) => d.label.trim() === '') && (
        <p className="wk-hint">Zadania i znaczniki bez nazwy nie zostaną zapisane.</p>
      )}

      <h3 className="wk-h2">Postęp liczony sam</h3>
      <p className="wk-hint">
        Z linku osoby i z rozszerzeń tego formularza — widać go przy każdej osobie w jej zgłoszeniu.
      </p>
      <ul className="wk-step-list">
        <li className="wk-step">
          <div className="wk-step-head">
            <span className="wk-step-mark" aria-hidden="true">○</span>
            <div className="wk-step-text">
              <strong>Sprawdzenie i potwierdzenie danych</strong>
              <span className="wk-row-side"> · osoba, po pierwszym otwarciu linku</span>
            </div>
          </div>
        </li>
        {extensions.map((e) => (
          <li className="wk-step" key={e.moduleId}>
            <div className="wk-step-head">
              <span className="wk-step-mark" aria-hidden="true">○</span>
              <div className="wk-step-text">
                <strong>{e.audience === 'person' ? `Uzupełnij: ${e.name}` : e.name}</strong>
                <span className="wk-row-side">
                  {e.audience === 'person' ? ' · wypełnia osoba przez swój link' : ' · wypełnia koordynator, osoba tego nie widzi'}
                  {e.closed && ' · zamknięte'}
                  {e.questions === 0 && ' · bez pytań — nie liczy się, dopóki ich nie dodasz'}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="wk-note">
        <strong>Kroki osoby układasz na stronie</strong> — w „Mapie logiki strony", pod modułami:
        każdy krok to węzeł, który jest zrobiony, gdy spełnione jest to, co do niego podłączysz.
        Zadania i znaczniki mapa może używać jako wejść („Znacznik"; zadanie liczy się, gdy osoba
        zaznaczyła dość dni).
      </p>
    </section>
  );
}

/* -- 0098: eine Aufgabe bearbeiten ---------------------------------------------------------------- */

function TaskEdit({ draft, onChange, onMove, onRemove, first, last }: {
  draft: StepDraft;
  onChange: (patch: Partial<StepDraft>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
}) {
  const t = draft.task!;
  const setTask = (patch: Partial<TaskDraft>) => onChange({ task: { ...t, ...patch } });
  const problem = taskProblem(t);
  const plan = problem === null ? (() => {
    const p = taskIn(t);
    return { ...p, schedule: t.schedule, weekdays: p.weekdays } as const;
  })() : null;
  const item = t.schedule === 'item';
  const duties = t.duties ?? [];
  const setDuty = (i: number, patch: Partial<DutyDraft>) => setTask({ duties: duties.map((d, at) => (at === i ? { ...d, ...patch } : d)) });

  /*
   * 0099 — EINEN TERMIN GEWÄHLT: der Zeitraum beginnt an seinem (nächsten) Tag;
   * ein einzelner endet dort auch, eine Reihe mit ihrem letzten Termin im Jahr
   * — höchstens drei Monate, zum Anpassen.
   */
  const pickItem = (itemId: string, found?: { readonly start: Date; readonly last: Date; readonly count: number }) => {
    if (found === undefined) { setTask({ itemId }); return; }
    const limit = new Date(found.start);
    limit.setMonth(limit.getMonth() + 3);
    const end = found.count <= 1 ? found.start : found.last < limit ? found.last : limit;
    setTask({ itemId, startsOn: isoDay(found.start), endsOn: isoDay(end) });
  };

  return (
    <>
      <label className="wk-field">
        <span>Zadanie</span>
        <input value={draft.label} placeholder="np. Różaniec w kościele" data-task-label=""
          onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className="wk-field">
        <span>Opis dla osoby — gdzie, co zabrać (opcjonalnie)</span>
        <textarea rows={2} value={draft.help} placeholder="np. Kościół parafialny, boczna nawa." data-task-help=""
          onChange={(e) => onChange({ help: e.target.value })} />
      </label>
      <div className="wk-inline wk-task-edit-line">
        <label className="wk-inline"><span className="wk-hint">Od</span>
          <input type="date" value={t.startsOn} data-task-starts="" onChange={(e) => setTask({ startsOn: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">do</span>
          <input type="date" value={t.endsOn} data-task-ends="" onChange={(e) => setTask({ endsOn: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">Kiedy</span>
          <select value={t.schedule} data-task-schedule="" onChange={(e) => setTask({ schedule: e.target.value as TaskSchedule })}>
            <option value="daily">codziennie</option>
            <option value="weekly">w wybrane dni tygodnia</option>
            <option value="any">raz, w dowolnym dniu okresu</option>
            <option value="item">terminy z kalendarza (spotkanie, nabożeństwo, uroczystość)</option>
          </select></label>
      </div>
      {item && (
        <div className="wk-task-item" data-task-item="">
          <div className="wk-inline wk-task-edit-line">
            <label className="wk-inline"><span className="wk-hint">Kalendarz</span>
              <PickCalendar value={t.calendarId ?? ''} busy={false} allowAll={false} onPick={(calendarId) => setTask({ calendarId, itemId: '' })} /></label>
            <label className="wk-inline"><span className="wk-hint">Termin</span>
              <PickCalendarItem calendarId={t.calendarId ?? ''} value={t.itemId ?? ''} busy={false} withParts={false} onPick={pickItem} /></label>
          </div>
          <p className="wk-hint">
            Osoba zobaczy terminy tego wpisu z okresu powyżej — przesunięte tak jak w kalendarzu, bez odwołanych.
            Seria (np. spotkania co tydzień): ustaw okres, z którego terminy się liczą.
          </p>
          <label className="wk-inline">
            <input type="checkbox" checked={t.presence === true} data-task-presence=""
              onChange={(e) => setTask({ presence: e.target.checked })} />
            <span>Pytaj przed każdym terminem: <em>będę / jeszcze nie wiem / nie będę</em></span>
          </label>
          {t.presence === true && (
            <div className="wk-task-duties" data-task-duties="">
              <span className="wk-hint">
                Funkcje do wyboru dla tych, którzy będą (np. ministranci: krzyż, świece, kadzidło) — puste „ile osób": bez limitu.
              </span>
              {duties.map((d, i) => (
                <div key={d.dutyId} className="wk-inline" data-task-duty={d.dutyId}>
                  <input value={d.label} placeholder="np. Kadzidło" aria-label="Funkcja" data-duty-label=""
                    onChange={(e) => setDuty(i, { label: e.target.value })} />
                  <label className="wk-inline"><span className="wk-hint">ile osób</span>
                    <input type="number" min={1} max={500} value={d.capacity} style={{ width: '5em' }} data-duty-capacity=""
                      onChange={(e) => setDuty(i, { capacity: e.target.value })} /></label>
                  <button type="button" className="wk-link-btn wk-danger" onClick={() => setTask({ duties: duties.filter((_, at) => at !== i) })}>Usuń</button>
                </div>
              ))}
              {duties.length < 30 && (
                <button type="button" className="wk-link-btn" data-add-duty=""
                  onClick={() => setTask({ duties: [...duties, { dutyId: newId(), label: '', capacity: '' }] })}>
                  + Dodaj funkcję
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {t.schedule === 'weekly' && (
        <div className="wk-inline wk-task-weekdays" role="group" aria-label="Dni tygodnia">
          {WEEKDAYS.map((w) => (
            <label key={w.bit} className="wk-inline">
              <input type="checkbox" checked={(t.weekdays & w.bit) !== 0} data-task-weekday={w.bit}
                onChange={(e) => setTask({ weekdays: e.target.checked ? t.weekdays | w.bit : t.weekdays & ~w.bit })} />
              <span>{w.short}</span>
            </label>
          ))}
        </div>
      )}
      <div className="wk-inline wk-task-edit-line">
        {!item && (
          <>
            <label className="wk-inline"><span className="wk-hint">Godzina</span>
              <input type="time" value={t.at} data-task-at="" onChange={(e) => setTask({ at: e.target.value })} /></label>
            <label className="wk-inline"><span className="wk-hint">Czas trwania (min)</span>
              <input type="number" min={1} max={1440} value={t.minutes} style={{ width: '6em' }} onChange={(e) => setTask({ minutes: e.target.value })} /></label>
          </>
        )}
        {/*
          ZROBIONE, GDY — meist reicht, dass die Person sich dazu stellt
          (przyjmuję / pomijam / odmawiam, oder zu jedem Termin będę / nie będę).
          Nur wer es verlangt, nennt eine Zahl: so oft da gewesen, so oft getan.
        */}
        <label className="wk-inline"><span className="wk-hint">Zrobione, gdy</span>
          <select value={t.needed.trim() === '' ? 'answer' : 'count'} data-task-done-when=""
            onChange={(e) => setTask({ needed: e.target.value === 'count' ? (t.needed.trim() === '' ? '1' : t.needed) : '' })}>
            <option value="answer">{t.presence === true ? 'osoba odpowie na każdy termin (będę / nie będę)' : 'osoba się ustosunkuje (przyjmuję / pomijam / odmawiam)'}</option>
            <option value="count">{item ? 'obecność określoną liczbę razy' : 'wykonane określoną liczbę razy'}</option>
          </select></label>
        {t.needed.trim() !== '' && (
          <label className="wk-inline"><span className="wk-hint">ile razy</span>
            <input type="number" min={1} max={400} value={t.needed} style={{ width: '5em' }} data-task-needed=""
              onChange={(e) => setTask({ needed: e.target.value })} /></label>
        )}
        <label className="wk-inline"><span className="wk-hint">Wykonanie zaznacza</span>
          <select value={draft.doneBy} data-task-done-by="" onChange={(e) => onChange({ doneBy: e.target.value === 'office' ? 'office' : 'person' })}>
            <option value="person">osoba sama</option>
            <option value="office">kancelaria (lista obecności)</option>
          </select></label>
      </div>
      <div className="wk-inline wk-task-edit-line">
        <label className="wk-inline"><span className="wk-hint">Widoczne od</span>
          <input type="date" value={t.showFrom} onChange={(e) => setTask({ showFrom: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">Zaznaczać do</span>
          <input type="date" value={t.reportUntil} onChange={(e) => setTask({ reportUntil: e.target.value })} /></label>
        <span className="wk-hint">{item ? '(puste: od razu · do tygodnia po końcu)' : '(puste: od początku okresu · do tygodnia po końcu)'}</span>
      </div>
      <p className={problem === null ? 'wk-hint' : 'wk-warn'} data-task-preview="">
        {problem !== null ? `Do poprawienia: ${problem}.`
          : item ? `Osoba zobaczy terminy z okresu ${periodText(plan!)}${t.presence === true ? ' i odpowie przed każdym: będę / jeszcze nie wiem / nie będę' : ''}${duties.some((d) => d.label.trim() !== '') ? ', potem wybierze funkcję' : ''}.`
          : `Osoba zobaczy: ${planText(plan!)}`}
      </p>
      <div className="wk-inline">
        <button type="button" className="wk-link-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Wyżej">↑</button>
        <button type="button" className="wk-link-btn" disabled={last} onClick={() => onMove(1)} aria-label="Niżej">↓</button>
        <button type="button" className="wk-link-btn wk-danger" onClick={onRemove}>Usuń</button>
      </div>
    </>
  );
}
