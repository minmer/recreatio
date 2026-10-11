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

import { isoDay, planText, WEEKDAYS } from './candidateTasks';
import { FormCard } from './FormCard';
import { newId } from './ids';
import type { SeatView } from './seatContext';
import {
  answerTask, answerTaskAsOffice, dueText, filledNow, markOwnStep, markStep, progressOf, saveSteps, stepsFor, taskIn,
  type DoneBy, type ExtensionInfo, type OpenStep, type StepDraft, type StepState, type TaskDraft, type TaskSchedule
} from './steps';
import { OwnSubmissions } from './Submission';
import { TaskCard } from './TaskCard';
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
        }).filter((s) => s.visibleToPerson);

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
                      <TaskCard label={s.label} help={s.help} task={s.task}
                        onChange={async (change) => { await answerTask(seat.token, form.registrationId, s.stepId!, change); seat.reload(); }} />
                    </li>
                  );
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
                      </div>

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
              onChange={async (change) => { await answerTaskAsOffice(registrationId, s.stepId!, change); await onChanged(); }} />
          </li>
        ) : (
          <li key={s.key} className={`wk-step is-${s.status}`}>
            <div className="wk-step-head">
              <Mark status={s.status} />
              <div className="wk-step-text">
                <strong>{s.label}</strong>
                <span className="wk-row-side">
                  {' · '}{STATUS_TEXT[s.status]}
                  {s.doneAt !== null && ` ${new Date(s.doneAt).toLocaleDateString('pl-PL')}`}
                  {s.dueAt !== null && s.status !== 'done' && ` · do ${dueText(s.dueAt)}`}
                  {s.source === 'auto' ? ' · automatycznie' : s.doneBy === 'person' ? ' · odhacza osoba' : ''}
                  {!s.visibleToPerson && ' · osoba tego nie widzi'}
                </span>
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
  ...(s.kind === 'task' && s.task != null ? {
    task: {
      startsOn: s.task.startsOn, endsOn: s.task.endsOn, schedule: s.task.schedule, weekdays: s.task.weekdays ?? 16,
      at: timeOf(s.task.atMinute), minutes: s.task.minutes === null ? '' : String(s.task.minutes),
      needed: s.task.needed === null ? '' : String(s.task.needed),
      showFrom: s.task.showFrom ?? '', reportUntil: s.task.reportUntil ?? ''
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
    task: { startsOn: isoDay(first), endsOn: isoDay(last), schedule: 'daily', weekdays: 16, at: '', minutes: '', needed: '', showFrom: '', reportUntil: '' }
  };
}

/** Was am Plan einer Aufgabe nicht stimmt — bevor der Dienst es sagt. */
function taskProblem(t: TaskDraft): string | null {
  if (t.startsOn === '' || t.endsOn === '') return 'podaj okres';
  if (t.endsOn < t.startsOn) return 'koniec przed początkiem';
  if (t.schedule === 'weekly' && t.weekdays === 0) return 'wybierz dni tygodnia';
  if (t.showFrom !== '' && t.showFrom > t.startsOn) return '„widoczne od" po początku';
  if (t.reportUntil !== '' && t.reportUntil < t.endsOn) return '„zaznaczać do" przed końcem';
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
  steps.map((s) => `${s.stepId}:${s.label ?? ''}:${s.help ?? ''}:${s.doneBy}:${s.visibleToPerson}:${s.dueAt ?? ''}:${s.kind ?? 'mark'}:${JSON.stringify(s.task ?? null)}`).join('|');

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
        kto odhacza — kancelaria (gdy to dostanie) albo osoba sama, w swoim linku.
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
                <select value={d.doneBy} onChange={(e) => set(i, { doneBy: e.target.value as DoneBy })}>
                  <option value="office">kancelaria</option>
                  <option value="person">osoba sama</option>
                </select>
              </label>
              {d.doneBy === 'office' && (
                <label className="wk-inline">
                  <input type="checkbox" checked={d.visibleToPerson}
                    onChange={(e) => set(i, { visibleToPerson: e.target.checked })} />
                  <span>osoba go widzi</span>
                </label>
              )}
              <label className="wk-inline">
                <span className="wk-hint">Termin</span>
                <input type="date" value={d.dueAt} onChange={(e) => set(i, { dueAt: e.target.value })} />
              </label>
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
          </select></label>
      </div>
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
        <label className="wk-inline"><span className="wk-hint">Godzina</span>
          <input type="time" value={t.at} data-task-at="" onChange={(e) => setTask({ at: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">Czas trwania (min)</span>
          <input type="number" min={1} max={1440} value={t.minutes} style={{ width: '6em' }} onChange={(e) => setTask({ minutes: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">Ile razy, by było wykonane</span>
          <input type="number" min={1} max={400} value={t.needed} placeholder="1" style={{ width: '5em' }} data-task-needed=""
            onChange={(e) => setTask({ needed: e.target.value })} /></label>
      </div>
      <div className="wk-inline wk-task-edit-line">
        <label className="wk-inline"><span className="wk-hint">Widoczne od</span>
          <input type="date" value={t.showFrom} onChange={(e) => setTask({ showFrom: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">Zaznaczać do</span>
          <input type="date" value={t.reportUntil} onChange={(e) => setTask({ reportUntil: e.target.value })} /></label>
        <span className="wk-hint">(puste: od początku okresu · do tygodnia po końcu)</span>
      </div>
      <p className={problem === null ? 'wk-hint' : 'wk-warn'} data-task-preview="">
        {problem === null ? `Osoba zobaczy: ${planText(plan!)}` : `Do poprawienia: ${problem}.`}
      </p>
      <div className="wk-inline">
        <button type="button" className="wk-link-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Wyżej">↑</button>
        <button type="button" className="wk-link-btn" disabled={last} onClick={() => onMove(1)} aria-label="Niżej">↓</button>
        <button type="button" className="wk-link-btn wk-danger" onClick={onRemove}>Usuń</button>
      </div>
    </>
  );
}
