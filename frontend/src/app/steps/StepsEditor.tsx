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
import { WEEKDAYS, isoDay, periodText, planText } from './candidateTasks';
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
    const unlearned = drafts.find((d) => d.kind === 'learn' && d.label.trim() !== '' && (d.learn?.libraryId ?? '') === '');
    if (unlearned !== undefined) {
      onError(`Znacznik „${unlearned.label.trim()}": wybierz bibliotekę, z której osoba ma się nauczyć.`);
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
        Osoba odpowiada w kalendarzu przy każdym dniu zadania; kancelaria widzi to przy osobie i może wpisać za nią.
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
        To, czego nie widać w danych („Zgoda rodzica dostarczona”). Odhacza kancelaria, osoba w swoim linku — albo znacznik sam (wybrany termin, przeczytane wiadomości).
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
                <select value={d.kind === 'booking' || d.kind === 'chat' || d.kind === 'learn' ? d.kind : d.doneBy} data-mark-done-by=""
                  onChange={(e) => set(i, e.target.value === 'booking'
                    ? { kind: 'booking', doneBy: 'person', visibleToPerson: true, resourceId: d.resourceId ?? '' }
                    : e.target.value === 'chat'
                      ? { kind: 'chat', doneBy: 'person', visibleToPerson: true, dueAt: '', chat: d.chat ?? { kind: 'all', areaId: '' } }
                      : e.target.value === 'learn'
                        ? { kind: 'learn', doneBy: 'person', visibleToPerson: true, learn: d.learn ?? { libraryId: '', revisionId: '', threshold: 0.8 } }
                        : { kind: 'mark', doneBy: e.target.value as DoneBy })}>
                  <option value="office">kancelaria</option>
                  <option value="person">osoba sama</option>
                  <option value="booking">sam — gdy osoba wybierze termin</option>
                  <option value="chat">sam — gdy osoba przeczyta wiadomości</option>
                  <option value="learn">sam — gdy osoba się nauczy (baza wiedzy)</option>
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
              {d.kind !== 'booking' && d.kind !== 'chat' && d.kind !== 'learn' && d.doneBy === 'office' && (
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
        {/* 0109 — gleich fertig: „Naucz się", erledigt, sobald die Person die Karten bis zur Schwelle kann. */}
        <button
          type="button" className="wk-link-btn" disabled={drafts.length >= 60} data-add-learn=""
          onClick={() => setDrafts([...drafts, {
            stepId: newId(), label: 'Naucz się', help: '', doneBy: 'person', visibleToPerson: true, dueAt: '',
            kind: 'learn', learn: { libraryId: '', revisionId: '', threshold: 0.8 }
          }])}
        >
          + Dodaj: naucz się
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
        Z linku osoby i z podformularzy — widać go przy każdej osobie.
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
            <option value="answer">{t.presence === true ? 'osoba odpowie na każdy termin (będę / nie będę)' : 'osoba odpowie przy każdym dniu (tak / nie)'}</option>
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
