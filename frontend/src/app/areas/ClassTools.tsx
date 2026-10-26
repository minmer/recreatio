/**
 * 0134 — DIE WERKZEUGE EINER KLASA im Reiter der Art (`AreaKindPanel.tsx`).
 *
 * <code>
 *   Program        welche Programme der Schule die Klasse verwirklicht, wie weit sie ist
 *   Plan lekcji    die wöchentlichen Lekcje im Kalender der Klasse (Schlüssel `lekcja-…`)
 *   Dziennik       Termin für Termin: Thema, Stand, Notiz, Zadanie (`ClassJournal.tsx`)
 *   Uczniowie      das Formular der Klasse mit Obecność (täglich) und Uwagi (nur das Amt)
 *   Rozmowy, Role  wie bei einer Grupa: Kanał, Rozmowa klasy, Uczniowie, Rodzice
 * </code>
 *
 * Programme, Lekcje und Realizacje liegen im Skryptorium der Schule (`school.ts`); wer es nicht
 * liest, sieht hier nur, dass es den Dziennik für die Lehrer gibt.
 */

import { useEffect, useMemo, useState } from 'react';

import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { writeFormContent } from '../forms/formJson';
import type { LibraryRow } from '../library/library';
import { str } from '../library/libraryKinds';
import { useLibraryStore, type Entry, type LibraryStore } from '../library/libraryStore';
import { createModule, type ModuleRow } from '../modules/module';
import { formPath, PEOPLE_TAB, viewPath } from '../routes';
import { Loading } from '../ui/Loading';
import { modulesNow } from '../workspace/viewData';
import { ChatTool, MainPageTool, RolesTool, Tool, type Ctx, type RoleDef } from './AreaKindPanel';
import { ClassJournal, type JournalLesson } from './ClassJournal';
import { loadImportKeys, saveImportKeys, type ImportKey } from './profile';
import {
  addLessonSeries, classesOf, lessonSeries, lessonsOf, programHome, programsIn, programsOfClass, progressLine, progressOf,
  realizationsOf, schoolYear, setProgramClasses, WEEKDAYS
} from './school';
import './classes.css';

const STUDENTS: RoleDef = { key: 'students', label: 'Uczniowie', capability: 'read', says: 'czytają kalendarz, kanał i stronę klasy', link: 'Link dla uczniów' };
const PARENTS: RoleDef = { key: 'parents', label: 'Rodzice', capability: 'read', says: 'czytają kanał i kalendarz klasy', link: 'Link dla rodziców' };

/** Die Fragen der Liste der Uczniowie — Telefon und E-mail sind die der Eltern, darum ohne Identität. */
const ROSTER_QUESTIONS = [
  { id: 'imie', kind: 'line', label: 'Imię', required: true, halfWidth: true, identity: 'given_name' },
  { id: 'nazwisko', kind: 'line', label: 'Nazwisko', required: true, halfWidth: true, identity: 'surname' },
  { id: 'telefon', kind: 'phone', label: 'Telefon rodzica', required: false, halfWidth: true },
  { id: 'email', kind: 'email', label: 'E-mail rodzica', required: false, halfWidth: true }
] as const;

/** Unter diesen Schlüsseln merkt sich der Bereich die Liste und ihre Erweiterungen. */
const ROSTER = 'uczniowie';
const ATTENDANCE = 'obecnosc';
const NOTES = 'uwagi';

export function ClassTools({ ctx }: { ctx: Ctx }) {
  const classId = ctx.area.areaId;
  const parentId = ctx.area.parentAreaId;
  const [ring, setRing] = useState<Ring | null | undefined>(undefined);
  const [library, setLibrary] = useState<LibraryRow | null | undefined>(undefined);
  const [round, setRound] = useState(0);
  const again = () => setRound((n) => n + 1);

  /* Der frische Bund (nach einem Handgriff vergisst der Reiter ihn) — für den Skryptorium der Schule. */
  useEffect(() => {
    let alive = true;
    void keysFor(ctx.who).then((k) => { if (alive) setRing(k.ring); }, () => { if (alive) setRing(null); });
    return () => { alive = false; };
  }, [ctx.who]);

  /* Wo die Programme liegen: der Skryptorium der Schule über der Klasse. */
  useEffect(() => {
    let alive = true;
    void programHome(ctx.areas, classId).then((found) => { if (alive) setLibrary(found); }, () => { if (alive) setLibrary(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- die Liste der Bereiche zählt nur über die Klasse und ihre Schule
  }, [classId, parentId, round]);

  const { store, revision, failed } = useLibraryStore(ring ?? null, library ?? null);
  const ready = store !== null && store.loaded;
  /* Was die Abschnitte des Skryptorium zeigen: warten, keiner, zu (kein Passwort), Fehler, bereit. */
  const status: Status = library === undefined || ring === undefined ? 'wait'
    : library === null ? 'none'
    : ring === null ? 'locked'
    : ready ? 'ready'
    : failed !== null ? 'failed' : 'wait';

  /* Die Programme der Klasse und ihre Lekcje — neu, sobald sich im Skryptorium etwas ändert. */
  const programs = useMemo(() => (ready ? programsIn(store) : []), [ready, store, revision]);
  /* Dieselbe Frage wie `programsOfClass`, aber mit den Einträgen des Speichers (sie tragen ihre Fassung). */
  const mine = useMemo(() => programs.filter((p) => programsOfClass([p], classId).length > 0), [programs, classId]);
  const lessons = useMemo<JournalLesson[]>(() => (ready
    ? mine.flatMap((p) => lessonsOf(p, store).map((l) => ({ ...l, programId: p.id, programTitle: str(p.data, 'title') || 'Program' })))
    : []), [ready, store, mine, revision]);

  return (
    <>
      <ProgramTool ctx={ctx} status={status} library={library ?? null} store={ready ? store : null} failed={failed} programs={programs} mine={mine} revision={revision} />
      <ScheduleTool ctx={ctx} round={round} onChanged={again} />
      <Tool id="journal" name="Dziennik" ok={null}
        says="Termin po terminie: temat z programu, czy lekcja się odbyła, notatka i zadanie — także dla każdej klasy inaczej.">
        {status === 'wait' ? <Loading lines={2} />
          : status === 'none' ? <p className="wk-kind-small">Dziennik prowadzą nauczyciele w skryptorium szkoły — nie ma go jeszcze albo nie masz do niego dostępu.</p>
          : status === 'locked' ? <p className="wk-kind-small">Dziennik jest zapieczętowany — podaj hasło, żeby go otworzyć w tej karcie.</p>
          : status === 'failed' || store === null || library === null || library === undefined ? <p className="wk-error">{failed ?? 'Nie udało się otworzyć dziennika.'}</p>
          : <ClassJournal ctx={ctx} store={store} library={library} lessons={lessons} round={round} revision={revision} />}
      </Tool>
      <StudentsTool ctx={ctx} round={round} onChanged={again} />
      <ChatTool ctx={ctx} kind="channel" />
      <ChatTool ctx={ctx} kind="area" />
      <RolesTool ctx={ctx} defs={[STUDENTS, PARENTS]} />
      <MainPageTool ctx={ctx} optional />
    </>
  );
}

/* -- Program ------------------------------------------------------------------------------------ */

type Status = 'wait' | 'none' | 'locked' | 'failed' | 'ready';

function ProgramTool({ ctx, status, library, store, failed, programs, mine, revision }: {
  ctx: Ctx;
  status: Status;
  library: LibraryRow | null;
  store: LibraryStore | null;
  failed: string | null;
  programs: readonly Entry[];
  mine: readonly Entry[];
  revision: number;
}) {
  const classId = ctx.area.areaId;
  const school = ctx.area.parentAreaId;
  const lines = useMemo(() => (store === null ? [] : mine.map((p) => ({
    program: p, line: progressLine(progressOf(lessonsOf(p, store), realizationsOf(store.all(), classId)))
  }))), [store, mine, classId, revision]);

  if (status === 'wait') return <Tool id="program" name="Program" ok={null}><Loading lines={1} /></Tool>;
  if (status === 'locked') {
    return <Tool id="program" name="Program" ok={null} says="Programy są zapieczętowane — podaj hasło, żeby je zobaczyć w tej karcie." />;
  }
  if (status !== 'ready' || library === null || store === null) {
    return (
      <Tool id="program" name="Program" ok={false}
        says="Programy leżą w skryptorium szkoły — obszaru nad klasą. Nie ma go jeszcze albo nie masz do niego dostępu.">
        {school !== null && (
          <div className="wk-actions">
            <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', school, 'profil')}>Karta szkoły</a>
          </div>
        )}
        {failed !== null && <p className="wk-error">{failed}</p>}
      </Tool>
    );
  }

  const toggle = (program: Entry, on: boolean) => {
    const now = classesOf(program);
    const next = on ? [...now, classId.toLowerCase()] : now.filter((c) => c !== classId.toLowerCase());
    void ctx.run('Zapisywanie programu…', on ? 'Klasa realizuje program.' : 'Klasa nie realizuje już tego programu.', async () => {
      await setProgramClasses(store, program, next);
    });
  };

  return (
    <Tool id="program" name="Program" ok={mine.length > 0}
      says={mine.length > 0 ? 'Lekcje programu są tematami w dzienniku; „Rozłóż program” wpisze je na kolejne terminy.' : 'Wybierz, który program szkoły realizuje ta klasa.'}>
      {lines.length > 0 && (
        <ul className="wk-class-programs">
          {lines.map(({ program, line }) => (
            <li key={program.id} data-class-program-line={program.id}>
              <a className="wk-link" href={viewPath('scriptorium', library.libraryId, program.id)}>{str(program.data, 'title') || 'Program'}</a>
              <span className="wk-card-muted"> — {line}</span>
            </li>
          ))}
        </ul>
      )}
      {programs.length === 0 ? (
        <p className="wk-kind-small">
          Szkoła nie ma jeszcze programów — utworzysz je w {school !== null ? <a className="wk-link" href={viewPath('areas', school, 'profil')}>karcie szkoły</a> : 'karcie szkoły'}.
        </p>
      ) : library.writes ? (
        <fieldset className="wk-class-checks">
          <legend className="wk-kind-small">Realizuje program</legend>
          {programs.map((p) => {
            const on = mine.some((m) => m.id === p.id);
            return (
              <label key={p.id} className="wk-class-check">
                <input type="checkbox" checked={on} disabled={ctx.busy} data-class-program={p.id} onChange={(e) => toggle(p, e.target.checked)} />
                <span>{str(p.data, 'title') || 'Program'}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <p className="wk-kind-small">Programy zmienia ten, kto pisze w skryptorium szkoły.</p>
      )}
    </Tool>
  );
}

/* -- Plan lekcji ---------------------------------------------------------------------------------- */

function ScheduleTool({ ctx, round, onChanged }: { ctx: Ctx; round: number; onChanged: () => void }) {
  const classId = ctx.area.areaId;
  const year = useMemo(() => schoolYear(new Date()), []);
  const [series, setSeries] = useState<readonly { key: string; itemId: string; label: string }[] | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('08:00');
  const [minutes, setMinutes] = useState('45');
  const [from, setFrom] = useState(year.from);
  const [until, setUntil] = useState(year.until);

  useEffect(() => {
    let alive = true;
    void lessonSeries(classId).then((found) => { if (alive) setSeries(found); }, () => { if (alive) setSeries([]); });
    return () => { alive = false; };
  }, [classId, round]);

  const add = () => {
    const length = Number(minutes);
    void ctx.run('Dodawanie lekcji do planu…', 'Lekcja jest w planie.', async (held) => {
      await addLessonSeries(held.ring, {
        classAreaId: classId, className: ctx.area.name, ownerRoleId: held.person.id, title: `Lekcja — ${ctx.area.name}`,
        weekday, time, minutes: Number.isFinite(length) && length > 0 ? length : 45, from, until
      });
    }).then(onChanged);
  };

  return (
    <Tool id="schedule" name="Plan lekcji" ok={series === null ? null : series.length > 0}
      says="Lekcje w tygodniu stoją w kalendarzu klasy — widzą je uczniowie i rodzice z linkiem; z nich powstają terminy w dzienniku.">
      {series === null ? <Loading lines={1} /> : series.length > 0 && (
        <ul className="wk-kind-list" data-class-schedule="">
          {series.map((s) => <li key={s.key}>{s.label || s.key}</li>)}
        </ul>
      )}
      <form className="wk-kind-form" data-class-schedule-form="" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>Dzień</span>
            <select value={weekday} disabled={ctx.busy} data-class-weekday="" onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Godzina</span>
            <input type="time" value={time} disabled={ctx.busy} data-class-time="" onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Minut</span>
            <input type="number" min={5} max={600} value={minutes} disabled={ctx.busy} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        </div>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>Od</span>
            <input type="date" value={from} disabled={ctx.busy} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Do (koniec roku szkolnego)</span>
            <input type="date" value={until} min={from} disabled={ctx.busy} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </div>
        <div className="wk-actions">
          <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || time === '' || from === '' || until === ''} data-class-schedule-add="">
            Dodaj lekcję w tygodniu
          </button>
          <a className="wk-link-btn" href={viewPath('calendar')}>Kalendarz</a>
        </div>
      </form>
    </Tool>
  );
}

/* -- Uczniowie ------------------------------------------------------------------------------------ */

function StudentsTool({ ctx, round, onChanged }: { ctx: Ctx; round: number; onChanged: () => void }) {
  const classId = ctx.area.areaId;
  const [keys, setKeys] = useState<readonly ImportKey[] | null>(null);
  const [modules, setModules] = useState<readonly ModuleRow[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadImportKeys(classId), modulesNow()]).then(([k, m]) => {
      if (!alive) return;
      setKeys(k.keys);
      setModules(m);
      setFailed(false);
    }, () => { if (alive) { setKeys([]); setFailed(true); } });
    return () => { alive = false; };
  }, [classId, round]);

  if (keys === null) return <Tool id="students" name="Uczniowie" ok={null}><Loading lines={1} /></Tool>;

  /* Ein Modul unter seinem Schlüssel — nur, wenn es das Modul noch gibt. */
  const moduleOf = (key: string): ModuleRow | null => {
    const id = keys.find((k) => k.kind === 'form' && k.key === key)?.refId ?? null;
    return id === null ? null : modules.find((m) => m.moduleId.toLowerCase() === id.toLowerCase()) ?? null;
  };
  const roster = moduleOf(ROSTER);
  const attendance = moduleOf(ATTENDANCE);
  const notes = moduleOf(NOTES);

  const make = () => void ctx.run('Tworzenie listy uczniów…', 'Lista uczniów jest gotowa — dodaj uczniów.', async (held) => {
    const name = ctx.area.name;
    /* Je Stück der Schlüssel gleich danach: bricht ein späterer Schritt ab, findet der nächste Versuch, was schon steht. */
    let formId = roster?.moduleId ?? null;
    if (formId === null) {
      formId = newId();
      held.step('Lista uczniów…');
      await createModule(formId, 'form', `Uczniowie — ${name}`.slice(0, 120), classId, 'person');
      await saveImportKeys(classId, [{ kind: 'form', key: ROSTER, refId: formId, refText: 'Uczniowie' }]);
      await writeFormContent(ctx.who, { moduleId: formId, areaId: classId }, { questions: ROSTER_QUESTIONS },
        { replace: false, answersTo: classId, onStage: held.step });
    }
    if (attendance === null) {
      const id = newId();
      held.step('Obecność…');
      await createModule(id, 'form', 'Obecność', classId, 'person', undefined, { extendsId: formId, audience: 'office', repeat: 'day' });
      await saveImportKeys(classId, [{ kind: 'form', key: ATTENDANCE, refId: id, refText: 'Obecność' }]);
      await writeFormContent(ctx.who, { moduleId: id, areaId: classId }, { questions: [{ id: 'obecny', kind: 'checkbox', label: 'Obecny' }] },
        { replace: false, answersTo: classId, onStage: held.step });
    }
    if (notes === null) {
      const id = newId();
      held.step('Uwagi o uczniach…');
      await createModule(id, 'form', 'Uwagi', classId, 'person', undefined, { extendsId: formId, audience: 'office' });
      await saveImportKeys(classId, [{ kind: 'form', key: NOTES, refId: id, refText: 'Uwagi' }]);
      await writeFormContent(ctx.who, { moduleId: id, areaId: classId }, { questions: [{ id: 'uwagi', kind: 'text', label: 'Uwagi' }] },
        { replace: false, answersTo: classId, onStage: held.step });
    }
  }).then(onChanged);

  const complete = roster !== null && attendance !== null && notes !== null;
  return (
    <Tool id="students" name="Uczniowie" ok={roster !== null}
      says={roster === null
        ? 'Lista uczniów z obecnością (codziennie, zaznaczana przez nauczyciela) i uwagami o uczniach, które widzi tylko nauczyciel.'
        : `Uczniów na liście: ${roster.entries}.`}>
      {failed && <p className="wk-error">Nie udało się odczytać listy uczniów.</p>}
      {roster !== null && (
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(roster.moduleId, PEOPLE_TAB)} data-class-roster-link="">Lista i dodawanie uczniów</a>
          {attendance !== null && <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(attendance.moduleId, PEOPLE_TAB)} data-class-attendance-link="">Obecność (dziś)</a>}
          {notes !== null && <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(notes.moduleId, PEOPLE_TAB)} data-class-notes-link="">Uwagi o uczniach</a>}
        </div>
      )}
      {!complete && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy} data-class-roster="" onClick={make}>
            {roster === null ? 'Utwórz listę uczniów' : 'Dodaj obecność i uwagi'}
          </button>
        </div>
      )}
      <p className="wk-kind-small">
        Uczniowie dodani przez nauczyciela nie mają własnego linku. Kto zapisze się sam przez formularz na stronie klasy, dostaje swój.
      </p>
    </Tool>
  );
}
