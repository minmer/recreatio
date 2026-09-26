/**
 * DIE SCHRITTE (0047) — beim Menschen, bei der Kanzlei, und wo sie angelegt werden.
 *
 * <code>
 *   SeatSteps     „Twoje kroki": was er noch tun muss — mit dem Formular zum
 *                 Ergänzen gleich an Ort und Stelle
 *   PersonSteps   bei der Kanzlei, in der Zeile eines Menschen: abhaken
 *   StepsEditor   im Reiter „Kroki": die von selbst entstandenen ansehen, die
 *                 von Hand anlegen, ordnen, mit Frist versehen
 * </code>
 *
 * <b>Dieselbe Rechnung überall</b> (`steps.stepsFor`) — was die Kanzlei als
 * offen sieht, sieht der Mensch auch als offen.
 */

import { useState } from 'react';

import { FormCard } from './FormCard';
import { newId } from './ids';
import type { SeatView } from './seatContext';
import {
  dueText, markOwnStep, markStep, progressOf, saveSteps, stepsFor,
  type DoneBy, type ExtensionInfo, type OpenStep, type StepDraft, type StepState
} from './steps';
import { OwnSubmissions } from './Submission';
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
          extensions: form.extensions.map((e) => ({ moduleId: e.moduleId, name: e.name, audience: 'person' as const })),
          filled: new Map(form.extensions.flatMap((e) => (e.registrationId === null ? [] : [[e.moduleId, e.registrationId] as const]))),
          steps: form.steps,
          marks: form.marks
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
                          <p className="wk-hint">Przejrzyj swoje dane u góry strony i potwierdź je.</p>
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
        {states.map((s) => (
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

const draftOf = (s: OpenStep): StepDraft => ({
  stepId: s.stepId,
  label: s.label ?? '',
  help: s.help ?? '',
  doneBy: s.doneBy,
  visibleToPerson: s.visibleToPerson,
  dueAt: s.dueAt === null ? '' : new Date(s.dueAt).toLocaleDateString('sv-SE')
});

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
  steps.map((s) => `${s.stepId}:${s.label ?? ''}:${s.help ?? ''}:${s.doneBy}:${s.visibleToPerson}:${s.dueAt ?? ''}`).join('|');

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
      <p className="wk-note">
        <strong>Kroki osoby układasz na stronie</strong> — w „Mapie logiki strony", pod modułami:
        każdy krok to węzeł, który jest zrobiony, gdy spełnione jest to, co do niego podłączysz.
        Tutaj są <strong>znaczniki</strong>: to, czego nie widać w danych, więc ktoś musi to
        odhaczyć. Mapa może ich używać jako wejść („Znacznik").
      </p>

      <h3 className="wk-h2">Postęp liczony sam</h3>
      <p className="wk-hint">
        Z linku osoby i z rozszerzeń tego formularza — widać go przy każdej osobie w zakładce „Osoby".
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
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="wk-h2">Znaczniki</h3>
      <p className="wk-hint">
        Wszystko, czego nie widać w danych: „Zgoda rodzica dostarczona", „Quiz sprawdzony". Wybierz,
        kto odhacza — kancelaria (gdy to dostanie) albo osoba sama, w swoim linku.
      </p>

      {formKey === null && (
        <p className="wk-warn">
          Znaczniki pieczętuje się kluczem obszaru formularza — ustaw obszar w „Ustawieniach"
          albo otwórz formularz kontem, które ten obszar czyta.
        </p>
      )}
      {unreadable && (
        <p className="wk-warn">Części znaczników nie da się odczytać tym kluczem — zapisanie ich nadpisze.</p>
      )}

      {drafts.length === 0 && <p className="wk-empty">Jeszcze żadnego.</p>}

      <ol className="wk-step-edit">
        {drafts.map((d, i) => (
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
          type="button" className="wk-link-btn" disabled={drafts.length >= 30}
          onClick={() => setDrafts([...drafts, {
            stepId: newId(), label: '', help: '', doneBy: 'office', visibleToPerson: true, dueAt: ''
          }])}
        >
          + Dodaj znacznik
        </button>
        <button
          type="button" className="wk-btn"
          disabled={busy || saving || !changed || formKey === null}
          onClick={() => void save()}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz znaczniki'}
        </button>
        {changed && (
          <button type="button" className="wk-link-btn" disabled={saving} onClick={() => setDrafts(steps.map(draftOf))}>
            Cofnij zmiany
          </button>
        )}
      </div>
      {drafts.some((d) => d.label.trim() === '') && (
        <p className="wk-hint">Znaczniki bez nazwy nie zostaną zapisane.</p>
      )}
    </section>
  );
}
