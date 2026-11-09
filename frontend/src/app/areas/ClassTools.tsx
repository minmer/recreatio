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

import { rich, t as tApp, useT } from '../core/i18n';
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
  realizationsOf, schoolYear, setProgramClasses, WEEKDAYS, weekdayName
} from './school';
import './classes.css';

const STUDENTS: RoleDef = {
  key: 'students', capability: 'read', legacy: 'Uczniowie', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasSchool.class.students'); }, get says() { return tApp('areasSchool.class.studentsSay'); }, get link() { return tApp('areasSchool.class.studentsLink'); }
};
const PARENTS: RoleDef = {
  key: 'parents', capability: 'read', legacy: 'Rodzice', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasSchool.class.parents'); }, get says() { return tApp('areasSchool.class.parentsSay'); }, get link() { return tApp('areasSchool.class.parentsLink'); }
};

/** Die Fragen der Liste der Uczniowie — Telefon und E-mail sind die der Eltern, darum ohne Identität. */
const rosterQuestions = () => [
  { id: 'imie', kind: 'line', label: tApp('areasSchool.class.qGiven'), required: true, halfWidth: true, identity: 'given_name' },
  { id: 'nazwisko', kind: 'line', label: tApp('areasSchool.class.qSurname'), required: true, halfWidth: true, identity: 'surname' },
  { id: 'telefon', kind: 'phone', label: tApp('areasSchool.class.qPhone'), required: false, halfWidth: true },
  { id: 'email', kind: 'email', label: tApp('areasSchool.class.qEmail'), required: false, halfWidth: true }
] as const;

/** Unter diesen Schlüsseln merkt sich der Bereich die Liste und ihre Erweiterungen. */
const ROSTER = 'uczniowie';
const ATTENDANCE = 'obecnosc';
const NOTES = 'uwagi';

export function ClassTools({ ctx }: { ctx: Ctx }) {
  const t = useT();
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
    ? mine.flatMap((p) => lessonsOf(p, store).map((l) => ({ ...l, programId: p.id, programTitle: str(p.data, 'title') || t('areasSchool.program') })))
    : []), [ready, store, mine, revision]);

  return (
    <>
      <ProgramTool ctx={ctx} status={status} library={library ?? null} store={ready ? store : null} failed={failed} programs={programs} mine={mine} revision={revision} />
      <ScheduleTool ctx={ctx} round={round} onChanged={again} />
      <Tool id="journal" name={t('areasSchool.class.journal')} ok={null}
        says={t('areasSchool.class.journalSays')}>
        {status === 'wait' ? <Loading lines={2} />
          : status === 'none' ? <p className="wk-kind-small">{t('areasSchool.class.journalNone')}</p>
          : status === 'locked' ? <p className="wk-kind-small">{t('areasSchool.class.journalLocked')}</p>
          : status === 'failed' || store === null || library === null || library === undefined ? <p className="wk-error">{failed ?? t('areasSchool.class.journalFailed')}</p>
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
  const t = useT();
  const classId = ctx.area.areaId;
  const school = ctx.area.parentAreaId;
  const lines = useMemo(() => (store === null ? [] : mine.map((p) => ({
    program: p, line: progressLine(progressOf(lessonsOf(p, store), realizationsOf(store.all(), classId)))
  }))), [store, mine, classId, revision]);

  if (status === 'wait') return <Tool id="program" name={t('areasSchool.program')} ok={null}><Loading lines={1} /></Tool>;
  if (status === 'locked') {
    return <Tool id="program" name={t('areasSchool.program')} ok={null} says={t('areasSchool.class.programsLocked')} />;
  }
  if (status !== 'ready' || library === null || store === null) {
    return (
      <Tool id="program" name={t('areasSchool.program')} ok={false}
        says={t('areasSchool.class.programsNone')}>
        {school !== null && (
          <div className="wk-actions">
            <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', school, 'profil')}>{t('areasSchool.class.schoolTab')}</a>
          </div>
        )}
        {failed !== null && <p className="wk-error">{failed}</p>}
      </Tool>
    );
  }

  const toggle = (program: Entry, on: boolean) => {
    const now = classesOf(program);
    const next = on ? [...now, classId.toLowerCase()] : now.filter((c) => c !== classId.toLowerCase());
    void ctx.run(t('areasSchool.class.savingProgram'), on ? t('areasSchool.class.programOn') : t('areasSchool.class.programOff'), async () => {
      await setProgramClasses(store, program, next);
    });
  };

  return (
    <Tool id="program" name={t('areasSchool.program')} ok={mine.length > 0}
      says={mine.length > 0 ? t('areasSchool.class.programSays') : t('areasSchool.class.programChoose')}>
      {lines.length > 0 && (
        <ul className="wk-class-programs">
          {lines.map(({ program, line }) => (
            <li key={program.id} data-class-program-line={program.id}>
              <a className="wk-link" href={viewPath('scriptorium', library.libraryId, program.id)}>{str(program.data, 'title') || t('areasSchool.program')}</a>
              <span className="wk-card-muted"> — {line}</span>
            </li>
          ))}
        </ul>
      )}
      {programs.length === 0 ? (
        <p className="wk-kind-small">
          {rich(t('areasSchool.class.noPrograms'), { a: (s) => (school !== null ? <a className="wk-link" href={viewPath('areas', school, 'profil')}>{s}</a> : s) })}
        </p>
      ) : library.writes ? (
        <fieldset className="wk-class-checks">
          <legend className="wk-kind-small">{t('areasSchool.class.delivers')}</legend>
          {programs.map((p) => {
            const on = mine.some((m) => m.id === p.id);
            return (
              <label key={p.id} className="wk-class-check">
                <input type="checkbox" checked={on} disabled={ctx.busy} data-class-program={p.id} onChange={(e) => toggle(p, e.target.checked)} />
                <span>{str(p.data, 'title') || t('areasSchool.program')}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <p className="wk-kind-small">{t('areasSchool.class.programsWriter')}</p>
      )}
    </Tool>
  );
}

/* -- Plan lekcji ---------------------------------------------------------------------------------- */

function ScheduleTool({ ctx, round, onChanged }: { ctx: Ctx; round: number; onChanged: () => void }) {
  const t = useT();
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
    void ctx.run(t('areasSchool.class.addingLesson'), t('areasSchool.class.lessonAdded'), async (held) => {
      await addLessonSeries(held.ring, {
        classAreaId: classId, className: ctx.area.name, ownerRoleId: held.person.id, title: t('areasSchool.lessonTitle', { name: ctx.area.name }),
        weekday, time, minutes: Number.isFinite(length) && length > 0 ? length : 45, from, until
      });
    }).then(onChanged);
  };

  return (
    <Tool id="schedule" name={t('areasSchool.class.schedule')} ok={series === null ? null : series.length > 0}
      says={t('areasSchool.class.scheduleSays')}>
      {series === null ? <Loading lines={1} /> : series.length > 0 && (
        <ul className="wk-kind-list" data-class-schedule="">
          {series.map((s) => <li key={s.key}>{s.label || s.key}</li>)}
        </ul>
      )}
      <form className="wk-kind-form" data-class-schedule-form="" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>{t('areasSchool.class.day')}</span>
            <select value={weekday} disabled={ctx.busy} data-class-weekday="" onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{weekdayName(i + 1, t.lang)}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>{t('areasSchool.class.time')}</span>
            <input type="time" value={time} disabled={ctx.busy} data-class-time="" onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>{t('areasSchool.class.minutes')}</span>
            <input type="number" min={5} max={600} value={minutes} disabled={ctx.busy} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        </div>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>{t('common.from')}</span>
            <input type="date" value={from} disabled={ctx.busy} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>{t('areasSchool.class.until')}</span>
            <input type="date" value={until} min={from} disabled={ctx.busy} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </div>
        <div className="wk-actions">
          <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || time === '' || from === '' || until === ''} data-class-schedule-add="">
            {t('areasSchool.class.addLesson')}
          </button>
          <a className="wk-link-btn" href={viewPath('calendar')}>{t('areasSchool.class.calendar')}</a>
        </div>
      </form>
    </Tool>
  );
}

/* -- Uczniowie ------------------------------------------------------------------------------------ */

function StudentsTool({ ctx, round, onChanged }: { ctx: Ctx; round: number; onChanged: () => void }) {
  const t = useT();
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

  if (keys === null) return <Tool id="students" name={t('areasSchool.class.students')} ok={null}><Loading lines={1} /></Tool>;

  /* Ein Modul unter seinem Schlüssel — nur, wenn es das Modul noch gibt. */
  const moduleOf = (key: string): ModuleRow | null => {
    const id = keys.find((k) => k.kind === 'form' && k.key === key)?.refId ?? null;
    return id === null ? null : modules.find((m) => m.moduleId.toLowerCase() === id.toLowerCase()) ?? null;
  };
  const roster = moduleOf(ROSTER);
  const attendance = moduleOf(ATTENDANCE);
  const notes = moduleOf(NOTES);

  const make = () => void ctx.run(t('areasSchool.class.makingRoster'), t('areasSchool.class.rosterReady'), async (held) => {
    const name = ctx.area.name;
    /* Je Stück der Schlüssel gleich danach: bricht ein späterer Schritt ab, findet der nächste Versuch, was schon steht. */
    let formId = roster?.moduleId ?? null;
    if (formId === null) {
      formId = newId();
      held.step(t('areasSchool.class.stepRoster'));
      await createModule(formId, 'form', t('areasSchool.class.rosterName', { name }).slice(0, 120), classId, 'person');
      await saveImportKeys(classId, [{ kind: 'form', key: ROSTER, refId: formId, refText: 'Uczniowie' }]); // i18n-ignore — gemerkter Name
      await writeFormContent(ctx.who, { moduleId: formId, areaId: classId }, { questions: rosterQuestions() },
        { replace: false, answersTo: classId, onStage: held.step });
    }
    if (attendance === null) {
      const id = newId();
      held.step(t('areasSchool.class.stepAttendance'));
      await createModule(id, 'form', t('areasSchool.class.attendance'), classId, 'person', undefined, { extendsId: formId, audience: 'office', repeat: 'day' });
      await saveImportKeys(classId, [{ kind: 'form', key: ATTENDANCE, refId: id, refText: 'Obecność' }]); // i18n-ignore — gemerkter Name
      await writeFormContent(ctx.who, { moduleId: id, areaId: classId }, { questions: [{ id: 'obecny', kind: 'checkbox', label: t('areasSchool.class.present') }] },
        { replace: false, answersTo: classId, onStage: held.step });
    }
    if (notes === null) {
      const id = newId();
      held.step(t('areasSchool.class.stepNotes'));
      await createModule(id, 'form', t('areasSchool.class.notes'), classId, 'person', undefined, { extendsId: formId, audience: 'office' });
      await saveImportKeys(classId, [{ kind: 'form', key: NOTES, refId: id, refText: 'Uwagi' }]);
      await writeFormContent(ctx.who, { moduleId: id, areaId: classId }, { questions: [{ id: 'uwagi', kind: 'text', label: t('areasSchool.class.notes') }] },
        { replace: false, answersTo: classId, onStage: held.step });
    }
  }).then(onChanged);

  const complete = roster !== null && attendance !== null && notes !== null;
  return (
    <Tool id="students" name={t('areasSchool.class.students')} ok={roster !== null}
      says={roster === null
        ? t('areasSchool.class.studentsSays')
        : t('areasSchool.class.onList', { count: roster.entries })}>
      {failed && <p className="wk-error">{t('areasSchool.class.rosterFailed')}</p>}
      {roster !== null && (
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(roster.moduleId, PEOPLE_TAB)} data-class-roster-link="">{t('areasSchool.class.rosterLink')}</a>
          {attendance !== null && <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(attendance.moduleId, PEOPLE_TAB)} data-class-attendance-link="">{t('areasSchool.class.attendanceToday')}</a>}
          {notes !== null && <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(notes.moduleId, PEOPLE_TAB)} data-class-notes-link="">{t('areasSchool.class.notesLink')}</a>}
        </div>
      )}
      {!complete && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy} data-class-roster="" onClick={make}>
            {roster === null ? t('areasSchool.class.makeRoster') : t('areasSchool.class.addAttendance')}
          </button>
        </div>
      )}
      <p className="wk-kind-small">
        {t('areasSchool.class.linksNote')}
      </p>
    </Tool>
  );
}
