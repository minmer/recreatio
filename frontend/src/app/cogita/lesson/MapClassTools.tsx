/**
 * 2026-11-22 (Part B, B1/B2/B7) — DIE KLASSE AUF DER KARTE: ein Menü (⚙), der Schalter „Prowadzę / Uczę się", „Prowadź tutaj"
 * und „Zadaj" an Türmen, Pfaden und Gabelungen, und die Zadania der Klasse für die Lernenden.
 *
 * <b>Wer leiten darf</b> (B1): wer die Klasse verwaltet (die Lehrerinnen sind Admin ihrer Klassen, `SchoolTools`) — in einem
 * Bereich, der diese Baza führt (Kurs oder Klasse, Schlüssel `base-<id>`, `courseBases.ts`) —, und wer den Bereich der Baza
 * selbst verwaltet. Nur sie sehen den Schalter. Im Modus „Prowadzę" stehen über einem Turm nur „Prowadź tutaj" und „Zadaj":
 * die Karte startet dann keine eigenen Läufe (die eigenen Antworten zählen nicht), sie führt die Klasse.
 *
 * <b>Zadania</b> (B7): eine Sitzung der Art `task` im Bereich der Klasse — Ziel, Klasse, Frist als EIN Ding. Erledigt wird nie
 * gespeichert, sondern aus dem Fortschritt gerechnet (`assignmentState`).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadAreas, myEpochKeys, type AreaRow } from '../../areas/area';
import { baseKey } from '../../areas/courseBases';
import { loadImportKeys } from '../../areas/profile';
import { fmtDate, useT } from '../../core/i18n';
import type { Me } from '../../core/me';
import type { Learner } from '../learn';
import { loadEvents, loadSessions, openEvent, seatSessions, sessionKeyOf, unwrapForSeat, type SessionRow } from '../live';
import type { CogitaLibrary } from '../store';
import type { TowerButton } from '../worldmap/WorldPillars';
import { createAssignment, createLesson } from './lessonApi';
import { assignmentState, readAssignConfig, sortAssignments, type AssignFacts, type AssignKind, type AssignState, type AssignTarget, type LessonFlowPart, type LessonPart, type ShowVotes } from './lessonTally';
import './lesson.css';

/* -- Wer leiten darf ----------------------------------------------------------------------------------------------- */

export interface LeadArea { readonly areaId: string; readonly name: string; readonly own: boolean }

let areasOnce: Promise<readonly AreaRow[]> | null = null;
const myAreas = (): Promise<readonly AreaRow[]> => { areasOnce ??= loadAreas().then((r) => r.areas, () => []); return areasOnce; };

/**
 * Die Bereiche, in denen ich mit dieser Baza leiten darf: der Bereich der Baza (verwalte ich ihn) und jede Klasse / jeder Kurs,
 * den ich verwalte und der die Baza führt. Leer: kein Schalter.
 */
const leadOnce = new Map<string, Promise<readonly LeadArea[]>>();

export function useLeadAreas(lib: CogitaLibrary, me: Me | null): readonly LeadArea[] | null {
  const [areas, setAreas] = useState<readonly LeadArea[] | null>(null);
  useEffect(() => {
    if (me === null) { setAreas([]); return undefined; }
    let alive = true;
    const slot = `${me.person.id}:${lib.libraryId}`;
    let found = leadOnce.get(slot);
    if (found === undefined) { found = findLeadAreas(lib); leadOnce.set(slot, found); }
    void found.then((list) => { if (alive) setAreas(list); }, () => { if (alive) setAreas([]); });
    return () => { alive = false; };
  }, [lib.libraryId, lib.areaId, me]); // eslint-disable-line react-hooks/exhaustive-deps
  return areas;
}

function findLeadAreas(lib: CogitaLibrary): Promise<readonly LeadArea[]> {
  return myAreas().then(async (rows) => {
      const admin = rows.filter((a) => a.myLevel === 'admin' && a.personal !== true).slice(0, 40);
      const key = baseKey(lib.libraryId);
      const found: LeadArea[] = [];
      for (const a of admin) {
        if (a.areaId.toLowerCase() === lib.areaId.toLowerCase()) { found.push({ areaId: a.areaId, name: a.name, own: true }); continue; }
        const keys = await loadImportKeys(a.areaId).then((r) => r.keys, () => []);
        if (keys.some((k) => k.kind === 'library' && (k.key === key || (k.refId ?? '').toLowerCase() === lib.libraryId.toLowerCase()))) found.push({ areaId: a.areaId, name: a.name, own: false });
      }
      /* Die Klassen zuerst — dorthin gehören die Antworten einer Stunde. */
      return [...found.filter((f) => !f.own), ...found.filter((f) => f.own)];
  });
}

const MODE = (libraryId: string) => `recreatio:cogita:teach:${libraryId}`;
const AREA = (libraryId: string) => `recreatio:cogita:teach-area:${libraryId}`;
const kept = (slot: string): string | null => { try { return localStorage.getItem(slot); } catch { return null; } };
const keep = (slot: string, value: string | null) => { try { if (value === null) localStorage.removeItem(slot); else localStorage.setItem(slot, value); } catch { /* nur jetzt */ } };

/* -- Was ein Ziel auf der Karte ist ---------------------------------------------------------------------------------- */

/** Ein Ziel, an dem man leitet oder zuweist: ein Turm, ein Pfad (Abschnitt) oder eine Gabelung. */
export interface MapTarget {
  readonly kind: 'place' | 'section' | 'junction';
  readonly id: string;
  readonly name: string;
  /** Die Erzählungen, die hierher führen (eine Stunde kann mehrere nacheinander gehen), mit ihrem Namen. */
  readonly flows: readonly { readonly flow: string; readonly name: string; readonly lesson: boolean; readonly start?: LessonFlowPart['start'] }[];
}

/* -- Das Menü und die Knöpfe -------------------------------------------------------------------------------------------- */

export interface ClassTools {
  /** 2026-11-24 — der Teil der Klasse im Menü der Karte (☰ oben links). */
  readonly menuBody: ReactNode;
  /** Im Modus „Prowadzę" (nur wer leiten darf). */
  readonly teaching: boolean;
  /** Statt der Knöpfe eines Lernenden: „Prowadź tutaj", „Zadaj" (und was die Karte sonst noch klein anhängt). */
  readonly buttons: (target: MapTarget | null, own: readonly TowerButton[]) => readonly TowerButton[];
  /** Dialoge (Stunde, Zadanie) und die Liste der Zadania. */
  readonly overlay: ReactNode;
  /** Türme mit einer offenen Zadanie (für ein Zeichen auf der Karte). */
  readonly marked: ReadonlySet<string>;
}

export function useMapClassTools({ lib, me, learner, facts, nameOf, href, onShow }: {
  lib: CogitaLibrary;
  me: Me | null;
  learner: Learner | null;
  facts: AssignFacts;
  nameOf: (id: string) => string;
  href: (...tail: readonly string[]) => string;
  onShow: (kind: 'place' | 'section', id: string) => void;
}): ClassTools {
  const t = useT();
  const areas = useLeadAreas(lib, me);
  const canLead = areas !== null && areas.length > 0;
  const [mode, setModeRaw] = useState<'lead' | 'learn'>(() => (kept(MODE(lib.libraryId)) === 'lead' ? 'lead' : 'learn'));
  const [areaId, setAreaRaw] = useState<string | null>(() => kept(AREA(lib.libraryId)));
  const [dialog, setDialog] = useState<{ readonly kind: 'lead' | 'assign'; readonly target: MapTarget } | null>(null);
  const teaching = canLead && mode === 'lead';
  const area = areas?.find((a) => a.areaId === areaId) ?? areas?.[0] ?? null;
  const setMode = (m: 'lead' | 'learn') => { setModeRaw(m); keep(MODE(lib.libraryId), m); };
  const setArea = (id: string) => { setAreaRaw(id); keep(AREA(lib.libraryId), id); };
  const tasks = useAssignments(lib, me, learner, facts);

  /*
    2026-11-24 — der Teil der Klasse im Menü der Karte (☰ oben links, `worldmap/MapMenu.tsx`): Textgrösse, „Prowadzę / Uczę się",
    die Klasse, offene Zadania. Kein eigener Knopf mehr.
  */
  const menuBody = (
    <div className="cg-class-menubody">
      <p><a className="wk-link" href="#/workspace/account/wyglad">{t('cogitaLesson.menu.textSize')}</a></p>
      {canLead && (
        <fieldset className="cg-class-mode" data-class-mode={mode}>
          <legend>{t('cogitaLesson.menu.mode')}</legend>
          <label className="wk-check"><input type="radio" name={`cg-mode-${lib.libraryId}`} checked={mode === 'learn'} onChange={() => setMode('learn')} data-class-mode-learn="" /><span>{t('cogitaLesson.menu.learn')}</span></label>
          <label className="wk-check"><input type="radio" name={`cg-mode-${lib.libraryId}`} checked={mode === 'lead'} onChange={() => setMode('lead')} data-class-mode-lead="" /><span>{t('cogitaLesson.menu.lead')}</span></label>
          <p className="cg-muted">{mode === 'lead' ? t('cogitaLesson.menu.leadSays') : t('cogitaLesson.menu.learnSays')}</p>
          {mode === 'lead' && areas !== null && areas.length > 1 && (
            <label className="wk-field"><span>{t('cogitaLesson.menu.class')}</span>
              <select value={area?.areaId ?? ''} onChange={(e) => setArea(e.target.value)} data-class-area="">
                {areas.map((a) => <option key={a.areaId} value={a.areaId}>{a.own ? t('cogitaLesson.menu.baseArea', { name: a.name }) : a.name}</option>)}
              </select>
            </label>
          )}
        </fieldset>
      )}
      {tasks.length > 0 && <p className="cg-muted">{t('cogitaLesson.tasks.count', { count: tasks.filter((x) => x.state !== 'done').length })}</p>}
    </div>
  );

  const buttons = (target: MapTarget | null, own: readonly TowerButton[]): readonly TowerButton[] => {
    if (!teaching || target === null) return own;
    const more = own.filter((b) => b.key === 'more');
    const lead: TowerButton = { key: 'lesson', label: t('cogitaLesson.map.lead'), title: t('cogitaLesson.map.leadSays'), onClick: () => setDialog({ kind: 'lead', target }), data: { 'class-lead': target.id } };
    const assign: TowerButton | null = target.kind === 'junction' ? null
      : { key: 'assign', label: t('cogitaLesson.map.assign'), line: true, onClick: () => setDialog({ kind: 'assign', target }), data: { 'class-assign': target.id } };
    return [...(target.flows.length > 0 ? [lead] : []), ...(assign === null ? [] : [assign]), ...more];
  };

  const overlay = (
    <>
      {dialog !== null && me !== null && area !== null && (dialog.kind === 'lead'
        ? <LeadDialog lib={lib} me={me} area={area} target={dialog.target} href={href} onClose={() => setDialog(null)} />
        : <AssignDialog lib={lib} me={me} area={area} target={dialog.target} onClose={() => setDialog(null)} />)}
      {!teaching && tasks.length > 0 && <AssignmentList tasks={tasks} nameOf={nameOf} onShow={onShow} />}
    </>
  );
  /* Fest, solange sich nichts ändert (die Karte zeichnet neu, wenn sich die Menge ändert). */
  const markKey = [...new Set(tasks.filter((x) => x.state !== 'done' && x.target.kind !== 'trail').map((x) => x.target.id))].sort().join('|');
  const marked = useMemo(() => new Set(markKey === '' ? [] : markKey.split('|')), [markKey]);
  return { menuBody, teaching, buttons, overlay, marked };
}

/* -- Eine Stunde beginnen -------------------------------------------------------------------------------------------- */

function LeadDialog({ lib, me, area, target, href, onClose }: { lib: CogitaLibrary; me: Me; area: LeadArea; target: MapTarget; href: (...tail: readonly string[]) => string; onClose: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(target.name);
  const ordered = useMemo(() => [...target.flows].sort((a, b) => Number(b.lesson) - Number(a.lesson)), [target]);
  const [picked, setPicked] = useState<readonly string[]>(() => (ordered[0] === undefined ? [] : [ordered[0].flow]));
  const [showVotes, setShowVotes] = useState<ShowVotes>('after');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const parts = ordered.filter((f) => picked.includes(f.flow)).map((f): LessonPart => ({ flow: f.flow, ...(f.start === undefined ? {} : { start: f.start }) }));
      const id = await createLesson(lib, me, { areaId: area.areaId, title: title.trim() || target.name, parts, showVotes });
      window.location.hash = href('sesje', id).replace(/^#/, '');
      onClose();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cg-class-dialog" role="dialog" aria-label={t('cogitaLesson.lead.title')} data-class-lead-dialog="">
      <h3>{t('cogitaLesson.lead.title')}</h3>
      <p className="cg-muted">{t('cogitaLesson.lead.says', { name: target.name, area: area.name })}</p>
      <label className="wk-field"><span>{t('cogitaViewsStats.sess.title')}</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
      <fieldset>
        <legend>{t('cogitaLesson.lead.trails')}</legend>
        {ordered.map((f) => (
          <label key={f.flow} className="wk-check" data-class-lead-flow={f.flow}>
            <input type="checkbox" checked={picked.includes(f.flow)} onChange={(e) => setPicked((was) => (e.target.checked ? [...was, f.flow] : was.filter((x) => x !== f.flow)))} />
            <span>{f.name}{f.lesson ? ` · ${t('cogitaLesson.lead.lessonRun')}` : ''}</span>
          </label>
        ))}
        <p className="cg-muted">{t('cogitaLesson.lead.sequence')}</p>
      </fieldset>
      <label className="wk-field"><span>{t('cogitaLesson.host.showVotes')}</span>
        <select value={showVotes} onChange={(e) => setShowVotes(e.target.value as ShowVotes)}>{(['after', 'live', 'never'] as const).map((v) => <option key={v} value={v}>{t(`cogitaLesson.showVotes.${v}`)}</option>)}</select>
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy || picked.length === 0} onClick={() => void start()} data-class-lead-start="">{busy ? t('cogitaLesson.lead.starting') : t('cogitaLesson.lead.start')}</button>
        {/* 2026-11-22 (I11) — eine längere Stunde: von einem Anfang zu diesem Turm, geplant (`LessonPlanner.tsx`). */}
        {target.kind === 'place' && <a className="wk-btn wk-btn-line" href={href('klasy', area.areaId, 'plan', 'nowy', target.id)} onClick={onClose} data-class-lead-plan="">{t('cogitaLesson.plan.fromMap')}</a>}
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

/* -- Eine Zadanie geben ---------------------------------------------------------------------------------------------- */

function AssignDialog({ lib, me, area, target, onClose }: { lib: CogitaLibrary; me: Me; area: LeadArea; target: MapTarget; onClose: () => void }) {
  const t = useT();
  const kinds: readonly AssignKind[] = target.kind === 'place' ? ['tower', 'review'] : ['trail'];
  const [kind, setKind] = useState<AssignKind>(kinds[0]!);
  const [until, setUntil] = useState(() => { const d = new Date(Date.now() + 7 * 864e5); d.setHours(20, 0, 0, 0); return toLocal(d); });
  const [title, setTitle] = useState(target.name);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const goal = (): AssignTarget => (kind === 'trail' ? { kind, id: target.flows[0]?.flow ?? target.id } : { kind, id: target.id });
  const give = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await createAssignment(lib, me, { areaId: area.areaId, title: title.trim() || target.name, target: goal(), name: target.name, until: until === '' ? null : new Date(until).toISOString() });
      setDone(true);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cg-class-dialog" role="dialog" aria-label={t('cogitaLesson.assign.title')} data-class-assign-dialog="">
      <h3>{t('cogitaLesson.assign.title')}</h3>
      {done ? (
        <>
          <p className="wk-done" role="status" data-class-assigned="">{t('cogitaLesson.assign.done', { name: target.name, area: area.name })}</p>
          <div className="wk-actions"><button type="button" className="wk-btn" onClick={onClose}>{t('common.close')}</button></div>
        </>
      ) : (
        <>
          <p className="cg-muted">{t('cogitaLesson.assign.says', { area: area.name })}</p>
          {kinds.length > 1 && (
            <label className="wk-field"><span>{t('cogitaLesson.assign.what')}</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as AssignKind)} data-class-assign-kind="">{kinds.map((k) => <option key={k} value={k}>{t(`cogitaLesson.task.kind.${k}`)}</option>)}</select>
            </label>
          )}
          <label className="wk-field"><span>{t('cogitaViewsStats.sess.title')}</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
          <label className="wk-field"><span>{t('cogitaLesson.assign.until')}</span><input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} data-class-assign-until="" /></label>
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void give()} data-class-assign-go="">{busy ? t('cogitaLesson.assign.giving') : t('cogitaLesson.assign.give')}</button>
            <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* -- Die Zadania eines Lernenden ------------------------------------------------------------------------------------- */

export interface Assignment {
  readonly sessionId: string;
  readonly title: string;
  readonly name: string;
  readonly target: AssignTarget;
  readonly at: number;
  readonly until: number | null;
  readonly state: AssignState;
}

/** Die Zadania dieser Baza, die der Lernende lesen kann (ein Konto: seine Bereiche; ein Platz: was ihm gegeben wurde). */
export function useAssignments(lib: CogitaLibrary, me: Me | null, learner: Learner | null, facts: AssignFacts): readonly Assignment[] {
  const [raw, setRaw] = useState<readonly Omit<Assignment, 'state'>[]>([]);
  const holder = learner?.holder ?? null;
  const holderSig = holder === null ? '' : holder.kind === 'role' ? `r:${holder.roleId}` : holder.kind === 'seat' ? `s:${holder.seatId}` : 'l';
  useEffect(() => {
    let alive = true;
    void (async () => {
      const found: Omit<Assignment, 'state'>[] = [];
      const add = async (s: SessionRow, key: Uint8Array | undefined, cred: { seat?: string }) => {
        if (key === undefined) return;
        const { events } = await loadEvents(s.sessionId, 0, cred);
        const config = events.filter((e) => e.kind === 'config').pop();
        if (config === undefined) return;
        const a = readAssignConfig(await openEvent(config, { session: (e) => (e === s.epoch ? key : undefined) }));
        if (a !== null) found.push({ sessionId: s.sessionId, title: a.title, name: a.name, target: a.target, at: a.at, until: s.endsAt === null ? null : Date.parse(s.endsAt) });
      };
      try {
        if (holder?.kind === 'seat') {
          const { sessions } = await seatSessions(holder.token);
          for (const one of sessions) {
            if (one.session.kind !== 'task' || one.session.state === 'closed' || (one.session.libraryId ?? '').toLowerCase() !== lib.libraryId.toLowerCase()) continue;
            const sealed = one.keys.find((k) => k.epoch === one.session.epoch);
            const key = sealed === undefined ? undefined : await unwrapForSeat(one.session.sessionId, holder.seatId, one.session.epoch, holder.wrapPrivate, sealed.keySealed) ?? undefined;
            await add(one.session, key, { seat: holder.token }).catch(() => undefined);
          }
        } else if (me !== null) {
          const { sessions } = await loadSessions(undefined, lib.libraryId);
          const keysOf = new Map<string, Map<number, Uint8Array>>();
          for (const s of sessions.filter((x) => x.kind === 'task' && x.state !== 'closed').slice(0, 30)) {
            if (!keysOf.has(s.areaId)) keysOf.set(s.areaId, await myEpochKeys(me.ring, s.areaId).catch(() => new Map<number, Uint8Array>()));
            const areaKey = keysOf.get(s.areaId)!.get(s.epoch);
            await add(s, areaKey === undefined ? undefined : await sessionKeyOf(areaKey, s.sessionId, s.epoch), {}).catch(() => undefined);
          }
        }
      } catch { /* ohne Zadania */ }
      if (alive) setRaw(found);
    })();
    return () => { alive = false; };
  }, [lib.libraryId, holderSig, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = Date.now();
  return sortAssignments(raw.map((a) => ({ ...a, state: assignmentState(a.target, facts, { at: a.at, until: a.until }, now) })));
}

function AssignmentList({ tasks, nameOf, onShow }: { tasks: readonly Assignment[]; nameOf: (id: string) => string; onShow: (kind: 'place' | 'section', id: string) => void }) {
  const t = useT();
  const [shut, setShut] = useState(false);
  const open = tasks.filter((x) => x.state !== 'done').length;
  if (shut) return <button type="button" className="wk-link-btn cg-class-tasks-open" onClick={() => setShut(false)} data-class-tasks-open="">{t('cogitaLesson.tasks.count', { count: open })}</button>;
  return (
    <section className="cg-class-tasks" aria-label={t('cogitaLesson.tasks.title')} data-class-tasks={tasks.length} data-class-tasks-open-n={open}>
      <p className="cg-row-between"><strong>{t('cogitaLesson.tasks.title')}</strong><button type="button" className="wk-link-btn" onClick={() => setShut(true)}>{t('cogitaLesson.tasks.hide')}</button></p>
      <ul>
        {tasks.map((x) => (
          <li key={x.sessionId} className={`is-${x.state}`} data-class-task={x.target.id} data-class-task-state={x.state}>
            <button type="button" className="wk-link-btn" disabled={x.target.kind === 'trail'} onClick={() => onShow('place', x.target.id)}>
              {x.title || (x.target.kind === 'trail' ? x.name : nameOf(x.target.id))}
            </button>
            <span className="cg-muted"> · {t(`cogitaLesson.task.kind.${x.target.kind}`)}{x.until !== null ? ` · ${t('cogitaLesson.tasks.until', { date: fmtDate(new Date(x.until), { dateStyle: 'medium', timeStyle: 'short' }, t.lang) })}` : ''}</span>
            <span className={`cg-tag${x.state === 'done' ? ' is-ok' : ''}`}>{t(`cogitaLesson.tasks.state.${x.state}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
