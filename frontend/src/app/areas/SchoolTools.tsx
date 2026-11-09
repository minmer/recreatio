/**
 * 0134 — DIE WERKZEUGE EINER SZKOŁA im Reiter ihrer Art: Klasy, Programy, Realizacja w klasach,
 * Nauczyciele, die Seite der Schule.
 *
 * <code>
 *   Klasy        die Bereiche darin mit der Art Klasa (dort ihr Dziennik); „Dodaj klasy" legt
 *                sie an — unter der Schule, also mit ihrem Administrator danych — und gibt
 *                ihnen die Nauczyciele
 *   Programy     Projekte im Skryptorium der Schule (versiegelt unter ihrem Schlüssel): die
 *                Lekcje sind Texte mit Plan, die Klassen, die es verwirklichen, stehen am Programm
 *   Realizacja   je Programm die Matrix Lekcje × Klassen (`SchoolMatrix.tsx`)
 * </code>
 *
 * Alles geht über die Stücke, die es schon gibt (Bereich, Profil, Skryptorium, Rolle) — das Rechnen
 * steht in `school.ts`.
 */

import { useEffect, useState } from 'react';

import { areaKeys, setMemberName } from '../chat/chat';
import { t as tApp, useT } from '../core/i18n';
import type { Ring, SealedRole } from '../core/keys';
import { keysFor } from '../core/ringOf';
import type { LibraryRow } from '../library/library';
import { str } from '../library/libraryKinds';
import { useLibraryStore, type Entry, type LibraryStore } from '../library/libraryStore';
import { viewPath } from '../routes';
import { Loading } from '../ui/Loading';
import { areasNow } from '../workspace/viewData';
import { createArea, joinArea, loadMembers } from './area';
import {
  failure, Fix, MainPageTool, roleFor, RolesTool, Tool,
  type Ctx, type Held, type RoleDef, type RoleSeen
} from './AreaKindPanel';
import { loadChildren, saveProfile, type ChildProfile } from './profile';
import {
  addLessons, classesOf, createProgram, dayOf, ensureScriptorium, lessonsOf, parseClassNames, parseLessonList, programsIn,
  programsOfClass, progressLine, progressOf, realizationsOf, scriptoriumOf, setProgramClasses
} from './school';
import { SchoolMatrix } from './SchoolMatrix';
import './school.css';

/** Die Lehrer einer Schule — sie schreiben Programme und den Dziennik, und jede neue Klasse bekommt sie. */
export const TEACHERS: RoleDef = {
  key: 'teachers', capability: 'write', legacy: 'Nauczyciele', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasSchool.school.teachers'); },
  get says() { return tApp('areasSchool.school.teachersSay'); },
  get link() { return tApp('areasSchool.school.teachersLink'); }
};

/** Eine Rolle, die in neue Klassen kommt (mit ihrem Namen dort). */
export interface ClassJoiner {
  readonly roleId: string;
  readonly wrapPublicKey: string;
  readonly name: string | null;
}

/**
 * KLASSEN ANLEGEN — Bereiche unter der Schule (ihr Administrator danych gilt), jede mit der Art
 * Klasa; wer sie anlegt, führt sie, und die Nauczyciele kommen hinein (sie führen sie mit).
 * Gibt zurück, was nicht ging — als Satz, oder `null`. Auch vom Anfang „Nowa szkoła" genommen.
 */
export async function addClassesTo(ring: Ring, person: SealedRole, schoolAreaId: string, names: readonly string[],
  teachers: ClassJoiner | null, step: (what: string) => void): Promise<{ made: string[]; note: string | null }> {
  const notes: string[] = [];
  const made: string[] = [];
  for (const name of names) {
    step(tApp('areasSchool.school.stepClass', { name }));
    const area = await createArea(ring, person, name, schoolAreaId);
    made.push(area.areaId);
    await saveProfile(area.areaId, { kind: 'class' }).catch((e: unknown) => {
      notes.push(tApp('areasSchool.school.kindNotSaved', { name, error: failure(e, tApp('areasSchool.school.error')) }));
    });
    if (teachers === null) continue;
    try {
      await joinArea(ring, area.areaId, { id: teachers.roleId, kind: 'group', wrapPublicKey: teachers.wrapPublicKey }, person.id, 'admin');
      if (teachers.name !== null) {
        await setMemberName(area.areaId, new Map([[area.epoch, area.key]]), teachers.roleId, teachers.name, person.id).catch(() => undefined);
      }
    } catch (e) {
      notes.push(tApp('areasSchool.school.teachersNotAdded', { name, error: failure(e, tApp('areasSchool.school.error')) }));
    }
  }
  return { made, note: notes.length === 0 ? null : notes.join(' ') };
}

/* == Was der Reiter der Schule lädt ======================================================= */

interface SchoolWorld {
  readonly children: readonly ChildProfile[];
  /** Bereich (klein geschrieben) → Name. */
  readonly names: ReadonlyMap<string, string>;
  readonly library: LibraryRow | null;
  readonly ring: Ring | null;
  /** Klasse → sitzen die Nauczyciele schon darin? (nur, wenn es die Rolle gibt) */
  readonly teachersIn: ReadonlyMap<string, boolean>;
}

async function loadSchool(ctx: Ctx, teachers: RoleSeen | null): Promise<SchoolWorld> {
  const [children, areas, library, keys] = await Promise.all([
    loadChildren(ctx.area.areaId).then((r) => r.children, () => [] as readonly ChildProfile[]),
    areasNow().catch(() => ctx.areas),
    scriptoriumOf(ctx.area.areaId).catch(() => null),
    keysFor(ctx.who).catch(() => null)
  ]);
  const names = new Map<string, string>();
  for (const a of [...ctx.areas, ...areas]) names.set(a.areaId.toLowerCase(), a.name);
  const teachersIn = new Map<string, boolean>();
  if (teachers !== null) {
    await Promise.all(children.filter((c) => c.kind === 'class').map(async (c) => {
      const inside = await loadMembers(c.areaId).then((r) => r.members.some((m) => m.roleId.toLowerCase() === teachers.roleId.toLowerCase()), () => true);
      teachersIn.set(c.areaId.toLowerCase(), inside);
    }));
  }
  return { children, names, library, ring: keys?.ring ?? null, teachersIn };
}

/* == Der Reiter ============================================================================ */

export function SchoolTools({ ctx }: { ctx: Ctx }) {
  const t = useT();
  const [world, setWorld] = useState<SchoolWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const teachers = roleFor(ctx.world.roles, TEACHERS);

  /* Neu nach jedem Handgriff: der Reiter lädt dann ein neues Profil (`onChanged`). */
  useEffect(() => {
    let alive = true;
    setFailed(false);
    void loadSchool(ctx, teachers).then((found) => { if (alive) setWorld(found); }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mit jedem Profil und jeder Welt des Reiters
  }, [ctx.area.areaId, ctx.profile, ctx.world]);

  const { store, failed: storeFailed } = useLibraryStore(world?.ring ?? null, world?.library ?? null);

  if (world === null) {
    return <li className="wk-kind-tool">{failed ? <p className="wk-error">{t('areasSchool.school.loadFailed')}</p> : <Loading lines={2} />}</li>;
  }

  const classes = world.children.filter((c) => c.kind === 'class').map((c) => c.areaId.toLowerCase())
    .sort((a, b) => (world.names.get(a) ?? '').localeCompare(world.names.get(b) ?? '', t.locale, { numeric: true }));
  const plain = world.children.filter((c) => c.kind === null).map((c) => c.areaId.toLowerCase());
  const ready = store !== null && store.loaded;
  const programs = ready ? programsIn(store) : [];

  return (
    <>
      <ClassesTool ctx={ctx} world={world} classes={classes} plain={plain} store={ready ? store : null} programs={programs} teachers={teachers} />
      <ProgramsTool ctx={ctx} world={world} classes={classes} store={ready ? store : null} storeFailed={storeFailed} programs={programs} />
      <RealizationTool world={world} classes={classes} store={ready ? store : null} programs={programs} />
      <RolesTool ctx={ctx} defs={[TEACHERS]} />
      <MainPageTool ctx={ctx} optional />
    </>
  );
}

/* -- Klasy -- */

function ClassesTool({ ctx, world, classes, plain, store, programs, teachers }: {
  ctx: Ctx; world: SchoolWorld; classes: readonly string[]; plain: readonly string[];
  store: LibraryStore | null; programs: readonly Entry[]; teachers: RoleSeen | null;
}) {
  const t = useT();
  const [names, setNames] = useState('');
  const wanted = parseClassNames(names);
  const missing = teachers === null ? [] : classes.filter((c) => world.teachersIn.get(c) === false);
  const all = store === null ? [] : realizationsOf(store.all());
  const controller = ctx.state.controller;

  const add = () => {
    const list = wanted;
    if (list.length === 0) return;
    void ctx.run(t('areasSchool.school.creatingClasses', { count: list.length }), list.length === 1 ? t('areasSchool.school.classReady', { name: list[0] }) : t('areasSchool.school.classesReady', { count: list.length }), async (held: Held) => {
      const done = await addClassesTo(held.ring, held.person, ctx.area.areaId, list,
        teachers === null ? null : { roleId: teachers.roleId, wrapPublicKey: teachers.wrapPublicKey, name: teachers.name }, held.step);
      setNames('');
      return done.note ?? undefined;
    });
  };

  return (
    <Tool id="classes" name={t('areasSchool.school.classes')} ok={classes.length > 0}
      says={t('areasSchool.school.classesSays', { controller: controller !== null ? controller.name : t('areasSchool.school.noController') })}>
      {classes.length > 0 && (
        <ul className="sc-classes" data-school-classes="">
          {classes.map((c) => {
            const mine = programsOfClass(programs, c);
            const lines = store === null ? [] : mine.map((p) => {
              const lessons = lessonsOf(p, store);
              return `${str(p.data, 'title') || t('areasSchool.program')}: ${progressLine(progressOf(lessons, all.filter((r) => r.classAreaId === c)))}`;
            });
            return (
              <li key={c} data-class={c}>
                <a className="wk-link sc-class-name" href={viewPath('areas', c, 'profil')}>{world.names.get(c) ?? t('areasSchool.aClass')}</a>
                <span className="wk-kind-small">{mine.length === 0 ? t('areasSchool.school.noProgram') : lines.join(' · ') || mine.map((p) => str(p.data, 'title')).join(', ')}</span>
              </li>
            );
          })}
        </ul>
      )}
      {missing.length > 0 && teachers !== null && (
        <div className="wk-actions">
          <Fix ctx={ctx} label={t('areasSchool.school.addTeachers', { count: missing.length })} what={t('areasSchool.school.addingTeachers')} done={t('areasSchool.school.teachersEverywhere')}
            act={async (held) => {
              const notes: string[] = [];
              for (const c of missing) {
                held.step(t('areasSchool.school.stepTeachers', { name: world.names.get(c) ?? t('areasSchool.aClass') }));
                try {
                  await joinArea(held.ring, c, { id: teachers.roleId, kind: 'group', wrapPublicKey: teachers.wrapPublicKey }, held.person.id, 'admin');
                  if (teachers.name !== null) await setMemberName(c, await areaKeys(held.ring, c, true), teachers.roleId, teachers.name, held.person.id).catch(() => undefined);
                } catch (e) {
                  notes.push(t('areasSchool.school.classError', { name: world.names.get(c) ?? t('areasSchool.aClass'), error: failure(e, t('areasJson.import.failedWord')) }));
                }
              }
              return notes.join(' ') || undefined;
            }} />
        </div>
      )}
      {plain.length > 0 && (
        <div className="sc-plain">
          <p className="wk-kind-small">{t('areasSchool.school.plain')}</p>
          <ul className="wk-kind-list">
            {plain.map((c) => (
              <li key={c}>
                {world.names.get(c) ?? t('areas.ctl.anArea')}{' '}
                <Fix ctx={ctx} label={t('areasSchool.school.markClass')} what={t('common.saving')} done={t('areasSchool.school.isClass', { name: world.names.get(c) ?? t('areas.ctl.anArea') })}
                  act={async () => { await saveProfile(c, { kind: 'class' }); }} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <form className="wk-kind-form wk-kind-inline" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label className="wk-field">
          <span>{t('areasSchool.school.addClasses')}</span>
          <input value={names} maxLength={600} disabled={ctx.busy} placeholder={t('areasSchool.school.addClassesPlaceholder')} data-school-add-classes="" onChange={(e) => setNames(e.target.value)} />
        </label>
        <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || wanted.length === 0} data-school-add-classes-go="">
          {wanted.length > 1 ? t('areasSchool.school.addN', { count: wanted.length }) : t('common.add')}
        </button>
      </form>
      <p className="wk-kind-small">
        {teachers === null
          ? t('areasSchool.school.makeTeachers')
          : t('areasSchool.school.teachersAuto')}
      </p>
    </Tool>
  );
}

/* -- Programy -- */

function ProgramsTool({ ctx, world, classes, store, storeFailed, programs }: {
  ctx: Ctx; world: SchoolWorld; classes: readonly string[]; store: LibraryStore | null; storeFailed: string | null; programs: readonly Entry[];
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const library = world.library;

  if (library === null) {
    return (
      <Tool id="programs" name={t('areasSchool.school.programs')} ok={false}
        says={t('areasSchool.school.programsSaysNone')}>
        <div className="wk-actions">
          <Fix ctx={ctx} label={t('areasSchool.school.makeScriptorium')} what={t('areasSchool.school.makingScriptorium')} done={t('areasSchool.school.scriptoriumReady')}
            act={async (held) => { await ensureScriptorium(held.ring, ctx.area.areaId, ctx.area.name); }} />
        </div>
      </Tool>
    );
  }

  const writes = library.writes;
  const make = () => {
    const name = title.trim();
    if (name === '' || store === null) return;
    void ctx.run(t('areasSchool.school.makingProgram'), t('areasSchool.school.programReady', { name }), async () => {
      await createProgram(store, name, chosen);
      setTitle('');
      setChosen([]);
    });
  };

  return (
    <Tool id="programs" name={t('areasSchool.school.programs')} ok={programs.length > 0}
      says={t('areasSchool.school.programsSays')}>
      {store === null ? (storeFailed !== null ? <p className="wk-error">{storeFailed}</p> : <Loading lines={2} />) : (
        <>
          {programs.length === 0 && <p className="wk-kind-small">{t('areasSchool.school.noPrograms')}</p>}
          <ul className="sc-programs">
            {programs.map((p) => <ProgramRow key={p.id} ctx={ctx} world={world} classes={classes} store={store} library={library} program={p} />)}
          </ul>
          {writes && (
            <form className="wk-kind-form sc-new-program" onSubmit={(e) => { e.preventDefault(); make(); }}>
              <label className="wk-field">
                <span>{t('areasSchool.school.newProgram')}</span>
                <input value={title} maxLength={200} disabled={ctx.busy} placeholder={t('areasSchool.school.newProgramPlaceholder')} data-school-program-title="" onChange={(e) => setTitle(e.target.value)} />
              </label>
              {classes.length > 0 && (
                <fieldset className="sc-checks">
                  <legend>{t('areasSchool.school.classesOfProgram')}</legend>
                  {classes.map((c) => (
                    <label key={c} className="wk-check">
                      <input type="checkbox" checked={chosen.includes(c)} disabled={ctx.busy}
                        onChange={(e) => setChosen((was) => (e.target.checked ? [...was, c] : was.filter((x) => x !== c)))} />
                      <span>{world.names.get(c) ?? t('areasSchool.aClass')}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="wk-actions">
                <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || title.trim() === ''} data-school-program-go="">{t('areasSchool.school.makeProgram')}</button>
              </div>
            </form>
          )}
        </>
      )}
    </Tool>
  );
}

function ProgramRow({ ctx, world, classes, store, library, program }: {
  ctx: Ctx; world: SchoolWorld; classes: readonly string[]; store: LibraryStore; library: LibraryRow; program: Entry;
}) {
  const t = useT();
  const [list, setList] = useState('');
  const lessons = lessonsOf(program, store);
  const mine = classesOf(program);
  const items = parseLessonList(list);
  const count = items.filter((i) => 'title' in i).length;
  const name = str(program.data, 'title') || t('areasSchool.program');
  const writes = library.writes;
  /* Klassen, die das Programm nennt, die aber nicht (mehr) in der Schule stehen — sie bleiben, bis man sie abwählt. */
  const others = mine.filter((c) => !classes.includes(c));

  const toggle = (c: string, on: boolean) => {
    const next = on ? [...mine, c] : mine.filter((x) => x !== c);
    void ctx.run(t('common.saving'), t('areasSchool.school.programClassesSaved', { name }), async () => { await setProgramClasses(store, program, next); });
  };
  const add = () => {
    if (count === 0) return;
    void ctx.run(t('areasSchool.school.addingLessons', { count }), t('areasSchool.school.lessonsAdded', { count }), async () => {
      await addLessons(store, program, items);
      setList('');
    });
  };

  return (
    <li className="sc-program" data-program={program.id}>
      <div className="sc-program-head">
        <strong>{name}</strong>
        <span className="wk-kind-small">{lessons.length === 0 ? t('areasSchool.school.noLessons') : t('areasSchool.school.lessonCount', { count: lessons.length })}</span>
        <a className="wk-link-btn" href={viewPath('scriptorium', library.libraryId, program.id)}>{t('areasSchool.school.openInScriptorium')}</a>
      </div>
      {classes.length > 0 && (
        <fieldset className="sc-checks" disabled={!writes || ctx.busy}>
          <legend>{t('areasSchool.school.classesOfProgram')}</legend>
          {classes.map((c) => (
            <label key={c} className="wk-check">
              <input type="checkbox" checked={mine.includes(c)} data-program-class={c} onChange={(e) => toggle(c, e.target.checked)} />
              <span>{world.names.get(c) ?? t('areasSchool.aClass')}</span>
            </label>
          ))}
        </fieldset>
      )}
      {others.length > 0 && <p className="wk-kind-small">{t('areasSchool.school.otherClasses', { count: others.length })}</p>}
      {lessons.length > 0 && (
        <details className="wk-fold sc-lessons">
          <summary>{t('areasSchool.school.lessons', { count: lessons.length })}</summary>
          <ol>
            {lessons.map((l) => (
              <li key={l.textId}>
                {l.heading !== null && (l.number === 1 || lessons[l.number - 2]?.heading !== l.heading) && <span className="sc-lesson-heading">{l.heading}</span>}
                <a className="wk-link" href={viewPath('scriptorium', library.libraryId, l.textId)}>{l.title}</a>
              </li>
            ))}
          </ol>
        </details>
      )}
      {writes && (
        <form className="wk-kind-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label className="wk-field">
            <span>{t('areasSchool.school.addLessonsLabel')}</span>
            <textarea rows={4} value={list} disabled={ctx.busy} placeholder={t('areasSchool.school.addLessonsPlaceholder')} data-school-lessons={program.id} onChange={(e) => setList(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || count === 0} data-school-lessons-go={program.id}>
              {count > 0 ? t('areasSchool.school.addLessonsN', { count }) : t('areasSchool.school.addLessons')}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

/* -- Realizacja w klasach -- */

function RealizationTool({ world, classes, store, programs }: {
  world: SchoolWorld; classes: readonly string[]; store: LibraryStore | null; programs: readonly Entry[];
}) {
  const t = useT();
  const library = world.library;
  if (library === null) return null;
  const today = dayOf(new Date());
  /* Je Klasse die Texte aller ihrer Programme — was sie sonst hält, ist „poza programem". */
  const programTexts = new Map<string, Set<string>>();
  if (store !== null) {
    for (const p of programs) {
      const texts = lessonsOf(p, store).map((l) => l.textId);
      for (const c of classesOf(p)) {
        const set = programTexts.get(c) ?? new Set<string>();
        for (const id of texts) set.add(id);
        programTexts.set(c, set);
      }
    }
  }
  const withClasses = programs.filter((p) => classesOf(p).length > 0);
  return (
    <Tool id="realization" name={t('areasSchool.school.realization')} ok={null}
      says={t('areasSchool.school.realizationSays')}>
      {store === null ? <Loading lines={2} /> : withClasses.length === 0 ? (
        <p className="wk-kind-small">{t('areasSchool.school.realizationEmpty')}</p>
      ) : withClasses.map((p) => (
        <section key={p.id} className="sc-matrix-sec" aria-label={str(p.data, 'title') || t('areasSchool.program')}>
          <h4 className="sc-matrix-title">{str(p.data, 'title') || t('areasSchool.program')}</h4>
          <SchoolMatrix store={store} library={library} program={p}
            classes={classes.filter((c) => classesOf(p).includes(c)).concat(classesOf(p).filter((c) => !classes.includes(c)))}
            names={world.names} programTexts={programTexts} today={today} />
        </section>
      ))}
    </Tool>
  );
}
