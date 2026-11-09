/**
 * Die Schritte eines Formulars einrichten (0047): Reihenfolge, Arten, Aufgaben mit eigenem Plan oder Kalenderterminen.
 */

import { Suspense, lazy, useState } from 'react';

import { PickResource } from '../bookings/PickResource';
import { PickCalendar, PickCalendarItem } from '../calendar/PickCalendar';
import { PickChatTarget } from '../chat/PickChatTarget';
import { newId } from '../core/ids';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';
import { rich, useT } from '../core/i18n';
import { WEEKDAYS, isoDay, perPeriod, periodText, planText } from './candidateTasks';
import { type DoneBy, type DutyDraft, type ExtensionInfo, type OpenStep, type StepDraft, type TaskDraft, type TaskSchedule, saveSteps, taskIn } from './steps';

const PickLearn = lazy(() => import('../cogita/LearnStep').then((m) => ({ default: m.PickLearn })));

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
  ...(s.kind === 'learn' ? { learn: { libraryId: s.learn?.libraryId ?? '', revisionId: s.learn?.revisionId ?? '', threshold: s.learn?.threshold ?? 0.8 } } : {}),
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
function taskProblem(task: TaskDraft): string | null {
  if (task.startsOn === '' || task.endsOn === '') return 'steps.problem.period';
  if (task.endsOn < task.startsOn) return 'steps.problem.endBeforeStart';
  if (task.schedule === 'weekly' && task.weekdays === 0) return 'steps.problem.weekdays';
  /* 0141 — wie oft je Woche / Monat: höchstens so oft, wie sie Tage hat. */
  if (task.schedule === 'week' && Number(task.needed) > 7) return 'steps.problem.perWeek';
  if (task.schedule === 'month' && Number(task.needed) > 31) return 'steps.problem.perMonth';
  if (task.showFrom !== '' && task.showFrom > task.startsOn) return 'steps.problem.showFrom';
  if (task.reportUntil !== '' && task.reportUntil < task.endsOn) return 'steps.problem.reportUntil';
  if (task.schedule === 'item' && (task.itemId ?? '') === '') return 'steps.problem.item';
  /* (Ein Schritt „Wybierz termin" ohne Zasób prüft `save`.) */
  if ((task.duties ?? []).some((d) => d.capacity.trim() !== '' && !(Number.isInteger(Number(d.capacity)) && Number(d.capacity) >= 1 && Number(d.capacity) <= 500)))
    return 'steps.problem.capacity';
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
  steps.map((s) => `${s.stepId}:${s.label ?? ''}:${s.help ?? ''}:${s.doneBy}:${s.visibleToPerson}:${s.dueAt ?? ''}:${s.kind ?? 'mark'}:${JSON.stringify(s.task ?? null)}:${JSON.stringify(s.booking ?? null)}:${JSON.stringify(s.chat ?? null)}:${JSON.stringify(s.learn ?? null)}`).join('|');

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
  const t = useT();
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
      onError(t('steps.editor.taskWrong', { name: wrong.label.trim(), problem: t(taskProblem(wrong.task!)!) }));
      return;
    }
    const unbooked = drafts.find((d) => d.kind === 'booking' && d.label.trim() !== '' && (d.resourceId ?? '') === '');
    if (unbooked !== undefined) {
      onError(t('steps.editor.unbooked', { name: unbooked.label.trim() }));
      return;
    }
    const unlearned = drafts.find((d) => d.kind === 'learn' && d.label.trim() !== '' && (d.learn?.libraryId ?? '') === '');
    if (unlearned !== undefined) {
      onError(t('steps.editor.unlearned', { name: unlearned.label.trim() }));
      return;
    }
    setSaving(true);
    onError(null);

    try {
      await saveSteps(partId, drafts.filter((d) => d.label.trim() !== ''), await formKey());
      await onSaved();
    } catch (e) {
      onError(e instanceof WorkspaceError ? e.message : t('steps.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="wk-panel">
      {formKey === null && (
        <p className="wk-warn">
          {t('steps.editor.noKey')}
        </p>
      )}
      {unreadable && (
        <p className="wk-warn">{t('steps.editor.unreadable')}</p>
      )}

      {/*
        0098 — ZADANIA DLA OSÓB: przez jakiś czas, z decyzją osoby i dniami
        („W październiku różaniec codziennie o 18:00", „Piątki: różaniec po
        angielsku", „Obejrzyj film do końca miesiąca"). Sie stehen oben: die
        Zakładka heißt im einfachen Weg „Zadania".
      */}
      <h3 className="wk-h2">{t('steps.editor.tasksTitle')}</h3>
      <p className="wk-hint">
        {t('steps.editor.tasksHint')}
      </p>
      {!drafts.some((d) => d.kind === 'task') && <p className="wk-empty">{t('steps.editor.noTasks')}</p>}

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
          {t('steps.editor.addTask')}
        </button>
      </div>

      <h3 className="wk-h2">{t('steps.editor.marksTitle')}</h3>
      <p className="wk-hint">
        {t('steps.editor.marksHint')}
      </p>

      {drafts.every((d) => d.kind === 'task') && <p className="wk-empty">{t('steps.editor.noMarks')}</p>}

      <ol className="wk-step-edit">
        {drafts.map((d, i) => d.kind === 'task' ? null : (
          <li key={d.stepId} className="wk-step-edit-row">
            <label className="wk-field">
              <span>{t('steps.editor.mark')}</span>
              <input value={d.label} placeholder={t('steps.editor.markHint')}
                onChange={(e) => set(i, { label: e.target.value })} />
            </label>
            <label className="wk-field">
              <span>{t('steps.editor.markHelp')}</span>
              <input value={d.help} placeholder={t('steps.editor.markHelpHint')}
                onChange={(e) => set(i, { help: e.target.value })} />
            </label>
            <div className="wk-inline">
              <label className="wk-inline">
                <span className="wk-hint">{t('steps.editor.ticks')}</span>
                {/* 0100 — „sam": der Schritt erledigt sich, wenn die Person bei einem Zasób einen Termin nimmt. */}
                {/* 0102 — „sam": oder er ist erledigt, solange in den gewählten Rozmowy nichts Ungelesenes liegt. */}
                <select value={d.kind === 'booking' || d.kind === 'chat' || d.kind === 'learn' ? d.kind : d.doneBy} data-mark-done-by=""
                  onChange={(e) => set(i, e.target.value === 'booking'
                    ? { kind: 'booking', doneBy: 'person', visibleToPerson: true, resourceId: d.resourceId ?? '' }
                    : e.target.value === 'chat'
                      ? { kind: 'chat', doneBy: 'person', visibleToPerson: true, dueAt: '', chat: d.chat ?? { kind: 'all', areaId: '' } }
                      : e.target.value === 'learn'
                        ? { kind: 'learn', doneBy: 'person', visibleToPerson: true, learn: d.learn ?? { libraryId: '', revisionId: '', threshold: 0.8 } }
                        : { kind: 'mark', doneBy: e.target.value as DoneBy })}>
                  <option value="office">{t('steps.editor.byOffice')}</option>
                  <option value="person">{t('steps.editor.byPerson')}</option>
                  <option value="booking">{t('steps.editor.byBooking')}</option>
                  <option value="chat">{t('steps.editor.byChat')}</option>
                  <option value="learn">{t('steps.editor.byLearn')}</option>
                </select>
              </label>
              {/* 0109 — „Naucz się": z której biblioteki, która powtórka, do ilu procent. */}
              {d.kind === 'learn' && (
                <span className="wk-inline" data-mark-learn="">
                  <Suspense fallback={<Loading lines={1} />}>
                    <PickLearn value={d.learn ?? { libraryId: '', revisionId: '', threshold: 0.8 }} onPick={(learn) => set(i, { learn })} />
                  </Suspense>
                </span>
              )}
              {d.kind === 'chat' && (
                <label className="wk-inline" data-mark-chat="">
                  <span className="wk-hint">{t('steps.editor.in')}</span>
                  <PickChatTarget value={d.chat} onPick={(chat) => set(i, { chat })} />
                </label>
              )}
              {d.kind === 'booking' && (
                <label className="wk-inline" data-mark-resource="">
                  <span className="wk-hint">{t('steps.editor.dateIn')}</span>
                  <PickResource value={d.resourceId ?? ''} busy={false} onPick={(resourceId) => set(i, { resourceId })} />
                </label>
              )}
              {d.kind !== 'booking' && d.kind !== 'chat' && d.kind !== 'learn' && d.doneBy === 'office' && (
                <label className="wk-inline">
                  <input type="checkbox" checked={d.visibleToPerson}
                    onChange={(e) => set(i, { visibleToPerson: e.target.checked })} />
                  <span>{t('steps.editor.personSees')}</span>
                </label>
              )}
              {/* 0102 — Nowe wiadomości przychodzą ciągle: to stan, nie termin. */}
              {d.kind !== 'chat' && (
                <label className="wk-inline">
                  <span className="wk-hint">{t('steps.editor.due')}</span>
                  <input type="date" value={d.dueAt} onChange={(e) => set(i, { dueAt: e.target.value })} />
                </label>
              )}
              <button type="button" className="wk-link-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('steps.editor.up')}>↑</button>
              <button type="button" className="wk-link-btn" disabled={i === drafts.length - 1} onClick={() => move(i, 1)} aria-label={t('steps.editor.down')}>↓</button>
              <button type="button" className="wk-link-btn wk-danger"
                onClick={() => setDrafts(drafts.filter((_, at) => at !== i))}>
                {t('common.remove')}
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
          {t('steps.editor.addMark')}
        </button>
        {/* 0102 — gleich fertig: „Przeczytaj wiadomości", erledigt, solange nichts Ungelesenes liegt. */}
        <button
          type="button" className="wk-link-btn" disabled={drafts.length >= 60} data-add-read=""
          onClick={() => setDrafts([...drafts, {
            stepId: newId(), label: t('steps.editor.readLabel'), help: '', doneBy: 'person', visibleToPerson: true, dueAt: '',
            kind: 'chat', chat: { kind: 'all', areaId: '' }
          }])}
        >
          {t('steps.editor.addRead')}
        </button>
        {/* 0109 — gleich fertig: „Naucz się", erledigt, sobald die Person die Karten bis zur Schwelle kann. */}
        <button
          type="button" className="wk-link-btn" disabled={drafts.length >= 60} data-add-learn=""
          onClick={() => setDrafts([...drafts, {
            stepId: newId(), label: t('steps.editor.learnLabel'), help: '', doneBy: 'person', visibleToPerson: true, dueAt: '',
            kind: 'learn', learn: { libraryId: '', revisionId: '', threshold: 0.8 }
          }])}
        >
          {t('steps.editor.addLearn')}
        </button>
      </div>

      {/* Ein Speichern für beide — Zadania und Znaczniki sind dieselben Zeilen (form_step). */}
      <div className="wk-actions">
        <button
          type="button" className="wk-btn"
          disabled={busy || saving || !changed || formKey === null}
          onClick={() => void save()}
        >
          {saving ? t('common.saving') : t('steps.editor.save')}
        </button>
        {changed && (
          <button type="button" className="wk-link-btn" disabled={saving} onClick={() => setDrafts(steps.map(draftOf))}>
            {t('steps.editor.revert')}
          </button>
        )}
      </div>
      {drafts.some((d) => d.label.trim() === '') && (
        <p className="wk-hint">{t('steps.editor.unnamed')}</p>
      )}

      <h3 className="wk-h2">{t('steps.editor.autoTitle')}</h3>
      <p className="wk-hint">
        {t('steps.editor.autoHint')}
      </p>
      <ul className="wk-step-list">
        <li className="wk-step">
          <div className="wk-step-head">
            <span className="wk-step-mark" aria-hidden="true">○</span>
            <div className="wk-step-text">
              <strong>{t('steps.auto.confirm')}</strong>
              <span className="wk-row-side"> · {t('steps.editor.confirmWho')}</span>
            </div>
          </div>
        </li>
        {extensions.map((e) => (
          <li className="wk-step" key={e.moduleId}>
            <div className="wk-step-head">
              <span className="wk-step-mark" aria-hidden="true">○</span>
              <div className="wk-step-text">
                <strong>{e.audience === 'person' ? t('steps.auto.fill', { name: e.name }) : e.name}</strong>
                <span className="wk-row-side">
                  {` · ${t(e.audience === 'person' ? 'steps.editor.personFills' : 'steps.editor.officeFills')}`}
                  {e.closed && ` · ${t('steps.editor.closed')}`}
                  {e.questions === 0 && ` · ${t('steps.editor.noQuestions')}`}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="wk-note">
        {rich(t('steps.editor.mapNote'), { b: (s, k) => <strong key={k}>{s}</strong> })}
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
  const t = useT();
  const tk = draft.task!;
  const setTask = (patch: Partial<TaskDraft>) => onChange({ task: { ...tk, ...patch } });
  const problem = taskProblem(tk);
  const plan = problem === null ? (() => {
    const p = taskIn(tk);
    return { ...p, schedule: tk.schedule, weekdays: p.weekdays } as const;
  })() : null;
  const item = tk.schedule === 'item';
  const period = perPeriod(tk);
  const duties = tk.duties ?? [];
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
        <span>{t('steps.task')}</span>
        <input value={draft.label} placeholder={t('steps.editor.taskHint')} data-task-label=""
          onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className="wk-field">
        <span>{t('steps.editor.taskHelp')}</span>
        <textarea rows={2} value={draft.help} placeholder={t('steps.editor.taskHelpHint')} data-task-help=""
          onChange={(e) => onChange({ help: e.target.value })} />
      </label>
      <div className="wk-inline wk-task-edit-line">
        <label className="wk-inline"><span className="wk-hint">{t('common.from')}</span>
          <input type="date" value={tk.startsOn} data-task-starts="" onChange={(e) => setTask({ startsOn: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">{t('steps.editor.toLower')}</span>
          <input type="date" value={tk.endsOn} data-task-ends="" onChange={(e) => setTask({ endsOn: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">{t('steps.editor.when')}</span>
          <select value={tk.schedule} data-task-schedule="" onChange={(e) => {
            const schedule = e.target.value as TaskSchedule;
            /* 0141 — je Woche / Monat heisst die Zahl etwas anderes („wie oft je Woche"): beim Wechsel neu. */
            setTask(perPeriod({ schedule }) !== period ? { schedule, needed: '' } : { schedule });
          }}>
            <option value="daily">{t('steps.schedule.daily')}</option>
            <option value="weekly">{t('steps.editor.weekly')}</option>
            <option value="week">{t('steps.editor.perWeek')}</option>
            <option value="month">{t('steps.editor.perMonth')}</option>
            <option value="any">{t('steps.editor.once')}</option>
            <option value="item">{t('steps.editor.fromCalendar')}</option>
          </select></label>
      </div>
      {item && (
        <div className="wk-task-item" data-task-item="">
          <div className="wk-inline wk-task-edit-line">
            <label className="wk-inline"><span className="wk-hint">{t('steps.editor.calendar')}</span>
              <PickCalendar value={tk.calendarId ?? ''} busy={false} allowAll={false} onPick={(calendarId) => setTask({ calendarId, itemId: '' })} /></label>
            <label className="wk-inline"><span className="wk-hint">{t('steps.sheet.date')}</span>
              <PickCalendarItem calendarId={tk.calendarId ?? ''} value={tk.itemId ?? ''} busy={false} withParts={false} onPick={pickItem} /></label>
          </div>
          <p className="wk-hint">
            {t('steps.editor.itemHint')}
          </p>
          <label className="wk-inline">
            <input type="checkbox" checked={tk.presence === true} data-task-presence=""
              onChange={(e) => setTask({ presence: e.target.checked })} />
            <span>{rich(t('steps.editor.askEach'), { em: (s, k) => <em key={k}>{s}</em> })}</span>
          </label>
          {tk.presence === true && (
            <div className="wk-task-duties" data-task-duties="">
              <span className="wk-hint">
                {t('steps.editor.dutiesHint')}
              </span>
              {duties.map((d, i) => (
                <div key={d.dutyId} className="wk-inline" data-task-duty={d.dutyId}>
                  <input value={d.label} placeholder={t('steps.editor.dutyHint')} aria-label={t('steps.card.duty')} data-duty-label=""
                    onChange={(e) => setDuty(i, { label: e.target.value })} />
                  <label className="wk-inline"><span className="wk-hint">{t('steps.editor.capacity')}</span>
                    <input type="number" min={1} max={500} value={d.capacity} style={{ width: '5em' }} data-duty-capacity=""
                      onChange={(e) => setDuty(i, { capacity: e.target.value })} /></label>
                  <button type="button" className="wk-link-btn wk-danger" onClick={() => setTask({ duties: duties.filter((_, at) => at !== i) })}>{t('common.remove')}</button>
                </div>
              ))}
              {duties.length < 30 && (
                <button type="button" className="wk-link-btn" data-add-duty=""
                  onClick={() => setTask({ duties: [...duties, { dutyId: newId(), label: '', capacity: '' }] })}>
                  {t('steps.editor.addDuty')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {tk.schedule === 'weekly' && (
        <div className="wk-inline wk-task-weekdays" role="group" aria-label={t('steps.editor.weekdays')}>
          {WEEKDAYS.map((w) => (
            <label key={w.bit} className="wk-inline">
              <input type="checkbox" checked={(tk.weekdays & w.bit) !== 0} data-task-weekday={w.bit}
                onChange={(e) => setTask({ weekdays: e.target.checked ? tk.weekdays | w.bit : tk.weekdays & ~w.bit })} />
              <span>{w.short}</span>
            </label>
          ))}
        </div>
      )}
      <div className="wk-inline wk-task-edit-line">
        {!item && (
          <>
            <label className="wk-inline"><span className="wk-hint">{t('steps.editor.hour')}</span>
              <input type="time" value={tk.at} data-task-at="" onChange={(e) => setTask({ at: e.target.value })} /></label>
            <label className="wk-inline"><span className="wk-hint">{t('steps.editor.duration')}</span>
              <input type="number" min={1} max={1440} value={tk.minutes} style={{ width: '6em' }} onChange={(e) => setTask({ minutes: e.target.value })} /></label>
          </>
        )}
        {/*
          ZROBIONE, GDY — meist reicht, dass die Person sich dazu stellt
          (przyjmuję / pomijam / odmawiam, oder zu jedem Termin będę / nie będę).
          Nur wer es verlangt, nennt eine Zahl: so oft da gewesen, so oft getan.
        */}
        {/* 0141 — je Woche / Monat: nur, wie oft darin (leer: einmal). */}
        {period ? (
          <label className="wk-inline"><span className="wk-hint">{t(tk.schedule === 'week' ? 'steps.editor.timesPerWeek' : 'steps.editor.timesPerMonth')}</span>
            <input type="number" min={1} max={tk.schedule === 'week' ? 7 : 31} value={tk.needed} placeholder="1" style={{ width: '5em' }} data-task-needed=""
              onChange={(e) => setTask({ needed: e.target.value })} /></label>
        ) : (
          <label className="wk-inline"><span className="wk-hint">{t('steps.editor.doneWhen')}</span>
            <select value={tk.needed.trim() === '' ? 'answer' : 'count'} data-task-done-when=""
              onChange={(e) => setTask({ needed: e.target.value === 'count' ? (tk.needed.trim() === '' ? '1' : tk.needed) : '' })}>
              <option value="answer">{tk.presence === true ? t('steps.editor.answerEachDate') : t('steps.editor.answerEachDay')}</option>
              <option value="count">{item ? t('steps.editor.presentTimes') : t('steps.editor.doneTimes')}</option>
            </select></label>
        )}
        {!period && tk.needed.trim() !== '' && (
          <label className="wk-inline"><span className="wk-hint">{t('steps.editor.howMany')}</span>
            <input type="number" min={1} max={400} value={tk.needed} style={{ width: '5em' }} data-task-needed=""
              onChange={(e) => setTask({ needed: e.target.value })} /></label>
        )}
        <label className="wk-inline"><span className="wk-hint">{t('steps.editor.marksDone')}</span>
          <select value={draft.doneBy} data-task-done-by="" onChange={(e) => onChange({ doneBy: e.target.value === 'office' ? 'office' : 'person' })}>
            <option value="person">{t('steps.editor.byPerson')}</option>
            <option value="office">{t('steps.editor.byOfficeList')}</option>
          </select></label>
      </div>
      <div className="wk-inline wk-task-edit-line">
        <label className="wk-inline"><span className="wk-hint">{t('steps.editor.showFrom')}</span>
          <input type="date" value={tk.showFrom} onChange={(e) => setTask({ showFrom: e.target.value })} /></label>
        <label className="wk-inline"><span className="wk-hint">{t('steps.editor.reportUntil')}</span>
          <input type="date" value={tk.reportUntil} onChange={(e) => setTask({ reportUntil: e.target.value })} /></label>
        <span className="wk-hint">{item ? t('steps.editor.emptyItem') : t('steps.editor.emptyPlan')}</span>
      </div>
      <p className={problem === null ? 'wk-hint' : 'wk-warn'} data-task-preview="">
        {problem !== null ? t('steps.editor.fix', { problem: t(problem) })
          : item ? t('steps.editor.previewItem', { period: periodText(plan!), ask: tk.presence === true ? t('steps.editor.previewAsk') : '', duty: duties.some((d) => d.label.trim() !== '') ? t('steps.editor.previewDuty') : '' })
          : t('steps.editor.preview', { plan: planText(plan!) })}
      </p>
      <div className="wk-inline">
        <button type="button" className="wk-link-btn" disabled={first} onClick={() => onMove(-1)} aria-label={t('steps.editor.up')}>↑</button>
        <button type="button" className="wk-link-btn" disabled={last} onClick={() => onMove(1)} aria-label={t('steps.editor.down')}>↓</button>
        <button type="button" className="wk-link-btn wk-danger" onClick={onRemove}>{t('common.remove')}</button>
      </div>
    </>
  );
}
