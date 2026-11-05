/**
 * DIE TEILE EINES WIDOKS (0094) — jeder klein, jeder mit seinen Wegen, sich
 * zu zeigen (`workspaceViews.ts`, PART_DEFS).
 *
 * Jeder Teil bekommt seinen Weg (`mode`) und die Bereiche des Widoks
 * (`scope`, `null`: alle) und holt, was er braucht, über `viewData.ts` —
 * einmal je Karte, auch wenn mehrere Teile dasselbe brauchen. Was einer nicht
 * öffnen kann (kein Schlüssel in dieser Karte), sagt er, statt leer zu bleiben.
 */

import { useState, useSyncExternalStore, type ReactNode } from 'react';

import { AccessLinks } from '../links/AccessLinks';
import { alertItems, useAlertSettings, type TodayItem } from './alerts';
import { AlertRows } from './AlertList';
import { loadMembers, type AreaRow } from '../areas/area';
import { namesInArea } from '../roles/called';
import { Calendar } from '../calendar/CalendarApp';
import { areaKeys, loadAreaNames, openNames, type ChatRow } from '../chat/chat';
import { loadCalendars } from '../calendar/calendar';
import { addDays, keyOf, startOfDay } from '../core/dayMath';
import type { Desk } from './desk';
import { accessWords, linkState } from '../links/linkAccess';
import { useNow } from '../masses/MassParts';
import { useMe } from '../core/me';
import { current, subscribe } from '../notify/notify';
import { keysFor } from '../core/ringOf';
import { selfOf } from '../roles/roles';
import { formNewsPath, formPath, pageSteps, viewPath } from '../routes';
import { loadSeats } from '../seats/seat';
import { WorkspaceError, type Who } from '../core/session';
import { t as tApp, useT } from '../core/i18n';
import { ShareButton } from '../links/Share';
import { afterState, loadTasks, markDone, openTasks, windowState, type OpenTask, type TaskOccurrence } from '../calendar/tasks';
import { agendaNow, areasNow, chatsNow, invalidate, linksNow, modulesNow, useLoaded } from './viewData';
import type { PartKind, ViewConfig } from './workspaceViews';
import { Loading } from '../ui/Loading';
import { LearnPart } from '../cogita/LearnPart';

export interface PartProps {
  readonly mode: string;
  readonly scope: ReadonlySet<string> | null;
  readonly view: ViewConfig;
  readonly who: Who;
  readonly desk: Desk;
}

const inScope = (scope: ReadonlySet<string> | null, areaId: string | null | undefined) =>
  scope === null || (areaId != null && scope.has(areaId));

const clock = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

function Waiting({ what }: { what: string }) {
  return <Loading label={what} lines={2} />;
}

/** Ohne offenen Schlüssel in dieser Karte — gesagt, nicht leer. */
function Locked() {
  const t = useT();
  return <p className="wk-hint">{t('workspace.parts.locked')}</p>;
}

/* -- Czeka na Ciebie --------------------------------------------------------------------- */

function AlertsPart({ mode, scope, who }: PartProps) {
  const { digest } = useSyncExternalStore(subscribe, current);
  const [settings] = useAlertSettings();
  const t = useT();
  const me = useMe(who);
  const now = useNow();
  const agenda = useLoaded(me ? () => agendaNow(me.ring, 1) : null, [me]);

  const today: TodayItem[] = (agenda ?? [])
    .filter((one) => new Date(one.occurrence.endsAt) > now)
    .map((one) => ({
      key: `${one.occurrence.itemId}${one.occurrence.occurrenceAt}`, title: one.title, at: one.occurrence.startsAt,
      areaId: one.occurrence.areaId, href: viewPath('calendar', keyOf(new Date(one.occurrence.startsAt)))
    }));
  const items = alertItems(digest, today, settings, scope);

  return (
    <>
      {digest === null ? <Waiting what={t('workspace.parts.checking')} />
        : items.length === 0 ? <p className="wk-now-calm">{t('workspace.parts.nothingWaits')}</p>
        : <AlertRows items={items} compact={mode === 'compact'} />}
    </>
  );
}

/* -- Najbliższe terminy ----------------------------------------------------------------- */

function AgendaPart({ mode, scope, who }: PartProps) {
  const t = useT();
  const me = useMe(who);
  const days = mode === 'week' ? 7 : 2;
  const items = useLoaded(me && mode !== 'calendar' ? () => agendaNow(me.ring, days) : null, [me, days, mode]);
  const areas = useLoaded(() => areasNow(), []);
  const calendars = useLoaded(mode === 'calendar' && scope !== null ? async () => (await loadCalendars()).calendars : null, [mode, scope]);

  if (me === undefined) return <Waiting what={t('common.loading')} />;
  if (me === null) return <Locked />;

  if (mode === 'calendar') {
    if (scope === null) return <Calendar me={me} />;
    if (calendars === undefined) return <Waiting what={t('workspace.parts.loadingCalendars')} />;
    const ids = (calendars ?? []).filter((c) => scope.has(c.areaId)).map((c) => c.calendarId);
    return ids.length === 0 ? <p className="wk-hint">{t('workspace.parts.noCalendar')}</p> : <Calendar me={me} scope={ids} />;
  }

  if (items === undefined) return <Waiting what={t('workspace.parts.loadingAgenda')} />;
  if (items === null) return <p className="wk-error">{t('workspace.parts.agendaFailed')}</p>;

  const shown = items.filter((one) => inScope(scope, one.occurrence.areaId) && new Date(one.occurrence.endsAt) > new Date());
  if (shown.length === 0) return <p className="wk-now-calm">{mode === 'week' ? t('workspace.parts.nothingWeek') : t('workspace.parts.nothingTwoDays')}</p>;

  const today = startOfDay(new Date());
  const dayName = (at: Date) => {
    const d = startOfDay(at).getTime();
    if (d === today.getTime()) return t('workspace.parts.today');
    if (d === addDays(today, 1).getTime()) return t('workspace.parts.tomorrow');
    return at.toLocaleDateString(t.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const byDay = new Map<string, typeof shown>();
  for (const one of shown) {
    const key = keyOf(new Date(one.occurrence.startsAt));
    byDay.set(key, [...(byDay.get(key) ?? []), one]);
  }
  const areaName = (id: string) => (areas ?? []).find((a) => a.areaId === id)?.name ?? '';

  return (
    <div className="wk-agenda">
      {[...byDay].map(([key, list]) => (
        <section key={key}>
          <h4 className="wk-agenda-day"><a href={viewPath('calendar', key)}>{dayName(new Date(list[0].occurrence.startsAt))}</a></h4>
          <ul className="wk-agenda-list">
            {list.map((one) => (
              <li key={`${one.occurrence.itemId}${one.occurrence.occurrenceAt}`}>
                <span className="wk-agenda-time">{one.occurrence.allDay ? t('workspace.parts.allDay') : clock(one.occurrence.startsAt, t.locale)}</span>
                <a href={viewPath('calendar', key)} className="wk-agenda-what">{one.title}</a>
                {scope === null && <span className="wk-hint">{areaName(one.occurrence.areaId)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* -- Zadania ------------------------------------------------------------------------------ */

interface TaskRowShown { readonly key: string; readonly task: OpenTask; readonly occurrence: TaskOccurrence | null; readonly late: boolean; readonly when: string }

function TasksPart({ mode, scope, who }: PartProps) {
  const t = useT();
  const me = useMe(who);
  const now = useNow();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const tasks = useLoaded(me ? async () => {
    const today = startOfDay(new Date());
    return openTasks(me.ring, (await loadTasks(addDays(today, -2), addDays(today, 8))).tasks);
  } : null, [me, tick]);

  if (me === undefined || tasks === undefined) return <Waiting what={t('workspace.parts.loadingTasks')} />;
  if (me === null) return <Locked />;
  if (tasks === null) return <p className="wk-error">{t('workspace.parts.tasksFailed')}</p>;

  const rows: TaskRowShown[] = [];
  for (const task of tasks.filter((one) => inScope(scope, one.areaId))) {
    if (task.kind === 'after') {
      const state = afterState(task, now);
      if (mode === 'all' || state.late || state.due < addDays(startOfDay(now), 1)) {
        rows.push({ key: task.taskId, task, occurrence: null, late: state.late, when: state.late ? t('workspace.parts.late') : t('workspace.parts.dueBy', { date: state.due.toLocaleDateString(t.locale) }) });
      }
      continue;
    }
    for (const occurrence of [...(task.overdue ?? []), ...task.occurrences]) {
      const state = windowState(occurrence, now);
      if (state === 'open' || state === 'missed' || (mode === 'all' && state === 'upcoming')) {
        rows.push({ key: `${task.taskId}:${occurrence.at}`, task, occurrence, late: state === 'missed', when: state === 'missed' ? t('workspace.parts.late') : state === 'open' ? t('workspace.parts.now') : new Date(occurrence.at).toLocaleString(t.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) });
      }
    }
  }
  rows.sort((a, b) => Number(b.late) - Number(a.late));

  const done = async (row: TaskRowShown) => {
    setBusy(row.key);
    setFailed(null);
    try {
      await markDone(row.task.taskId, me.person.id, row.occurrence?.at);
      setTick((n) => n + 1);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {rows.length === 0 ? <p className="wk-now-calm">{t('workspace.parts.nothingToDo')}</p> : (
        <ul className="wk-part-list">
          {rows.slice(0, 12).map((row) => (
            <li key={row.key} className={row.late ? 'is-late' : undefined}>
              <a href={viewPath('tasks')}>{row.task.title ?? t('workspace.parts.task')}</a>
              <span className="wk-hint">{row.when}</span>
              <button type="button" className="wk-btn wk-btn-small" disabled={busy !== null} onClick={() => void done(row)}>{t('workspace.parts.done')}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -- Rozmowy ------------------------------------------------------------------------------ */

export const chatName = (c: ChatRow): string =>
  c.kind === 'seat' && c.seatName != null ? tApp('workspace.parts.chat.seat', { name: c.seatName })
  : c.kind === 'self' ? tApp('workspace.parts.chat.self')
  : c.kind === 'channel' ? tApp('workspace.parts.chat.channel', { name: c.areaName })
  : c.kind === 'area' ? c.areaName
  : tApp('workspace.parts.chat.other', { name: c.areaName });

function ChatsPart({ mode, scope }: PartProps) {
  const t = useT();
  const chats = useLoaded(() => chatsNow(), []);
  if (chats === undefined) return <Waiting what={t('workspace.parts.loadingChats')} />;
  if (chats === null) return <p className="wk-error">{t('workspace.parts.chatsFailed')}</p>;
  const shown = chats.filter((c) => inScope(scope, c.areaId) && (mode === 'all' || c.unread > 0))
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  if (shown.length === 0) return <p className="wk-now-calm">{mode === 'all' ? t('workspace.parts.noChats') : t('workspace.parts.allRead')}</p>;
  return (
    <ul className="wk-part-list">
      {shown.slice(0, 10).map((c) => (
        <li key={c.chatId}>
          <a href={viewPath('chat', c.chatId)}>{chatName(c)}</a>
          {c.unread > 0 && <span className="wk-alert-n">{c.unread}</span>}
          {c.lastMessageAt !== null && <span className="wk-hint">{new Date(c.lastMessageAt).toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })}</span>}
        </li>
      ))}
    </ul>
  );
}

/* -- Formularze --------------------------------------------------------------------------- */

function FormsPart({ mode, scope }: PartProps) {
  const { digest } = useSyncExternalStore(subscribe, current);
  const t = useT();
  const modules = useLoaded(() => modulesNow(), []);
  if (modules === undefined) return <Waiting what={t('workspace.parts.loadingForms')} />;
  if (modules === null) return <p className="wk-error">{t('workspace.parts.formsFailed')}</p>;
  const fresh = new Map((digest?.registrations.list ?? []).map((f) => [f.moduleId, f.count]));
  const newIn = (moduleId: string) => fresh.get(moduleId) ?? 0;

  /*
   * 0103 — EIN UNTERFORMULAR MIT NEUEM steht unter seinem Hauptformular und
   * führt zu SICH: vorher standen hier nur Hauptformulare, und was eine
   * Person in „Cele" eintrug, sah man nirgends — oder landete im Hauptformular.
   */
  const freshSubs = (mainId: string) => modules
    .filter((m) => m.kind === 'form' && m.extendsId === mainId && newIn(m.moduleId) > 0)
    .sort((a, b) => newIn(b.moduleId) - newIn(a.moduleId) || a.name.localeCompare(b.name, 'pl'));
  const newAll = (mainId: string) => newIn(mainId) + freshSubs(mainId).reduce((n, s) => n + newIn(s.moduleId), 0);
  const forms = modules.filter((m) => m.kind === 'form' && m.extendsId === null && inScope(scope, m.areaId))
    .filter((m) => mode !== 'fresh' || newAll(m.moduleId) > 0)
    .sort((a, b) => newAll(b.moduleId) - newAll(a.moduleId) || a.name.localeCompare(b.name, 'pl'));
  if (forms.length === 0) return <p className="wk-now-calm">{mode === 'fresh' ? t('workspace.parts.formsNothingNew') : t('workspace.parts.noForms')}</p>;
  return (
    <ul className="wk-part-list">
      {forms.flatMap((m) => [
        <li key={m.moduleId}>
          <a href={newIn(m.moduleId) > 0 ? formNewsPath(m.moduleId) : formPath(m.moduleId)}>{m.name}</a>
          <span className="wk-hint">{t(m.closed ? 'workspace.parts.entriesClosed' : 'workspace.parts.entries', { count: m.entries })}</span>
          {newIn(m.moduleId) > 0 && <span className="wk-tag wk-tag-new">{t('workspace.parts.newN', { count: newIn(m.moduleId) })}</span>}
        </li>,
        ...freshSubs(m.moduleId).map((s) => (
          <li key={s.moduleId} className="is-sub" data-fresh-sub={s.moduleId}>
            <a href={formNewsPath(s.moduleId)}><span aria-hidden="true">↳ </span>{s.name}</a>
            <span className="wk-tag wk-tag-new">{t('workspace.parts.newN', { count: newIn(s.moduleId) })}</span>
          </li>
        ))
      ])}
    </ul>
  );
}

/* -- Strony ------------------------------------------------------------------------------- */

function PagesPart({ scope, desk, who }: PartProps) {
  const t = useT();
  const pages = desk.pages.filter((p) => p.aliasOf === null)
    .filter((p) => scope === null || (p.accessAreaIds ?? []).some((id) => scope.has(id)));
  if (pages.length === 0) {
    return <p className="wk-now-calm">{scope === null ? t('workspace.parts.noPages') : t('workspace.parts.noAreaPages')}</p>;
  }
  return (
    <ul className="wk-part-list">
      {pages.slice(0, 12).map((p) => (
        <li key={p.path}>
          <a href={`#/${p.path}`} className="wk-part-path">{p.path === '' ? 'recreatio.pl' : p.path}</a>
          {(p.accessAreaIds ?? []).length > 0 && <span className="wk-tag">{t('workspace.parts.withAccess')}</span>}
          <span className="wk-part-acts">
            <a className="wk-link-btn" href={viewPath('pages', ...pageSteps(p.path))}>{t('common.edit')}</a>
            <ShareButton who={who} label={t('workspace.parts.share')} className="wk-link-btn"
              target={{ title: p.path === '' ? 'recreatio.pl' : p.path, aim: p.path === '' ? null : p.path, areaIds: p.accessAreaIds ?? [], open: (p.accessAreaIds ?? []).length === 0 }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -- 0106: Twoje strony ------------------------------------------------------------------- */

/** Wie eine Seite heisst: ihr Titel, sonst ihre Adresse. */
const pageName = (path: string, title: string | null | undefined): string =>
  title != null && title.trim() !== '' ? title.trim() : path === '' ? 'recreatio.pl' : path;

const WHY: Record<'own' | 'area' | 'seat', string> = {
  own: 'workspace.parts.why.own',
  area: 'workspace.parts.why.area',
  seat: 'workspace.parts.why.seat'
};

/**
 * 0106 — „TWOJE STRONY": wo man arbeitet. Für einen Animator und einen
 * Kandydaten mit Konto ist das die Seite, die jemand anderes vorbereitet hat
 * (nur mit Zugang für seine Gruppe, oder die seines Links) — dort tut er fast
 * alles. Wer Seiten führt, findet hier auch seine eigenen, mit „Edytuj".
 */
function MyPagesPart({ mode, desk }: PartProps) {
  const t = useT();
  const own = desk.pages.filter((p) => p.aliasOf === null)
    .map((p) => ({ path: p.path, title: p.title ?? null, why: 'own' as const, edit: true }));
  const open = (desk.open ?? []).map((p) => ({ path: p.path, title: p.title, why: p.why, edit: false }));
  const all = [...open, ...own];

  if (all.length === 0) {
    return (
      <p className="wk-now-calm">{t('workspace.parts.noMyPages')}</p>
    );
  }

  if (mode === 'list') {
    return (
      <ul className="wk-part-list">
        {all.slice(0, 20).map((p) => (
          <li key={p.path} data-my-page={p.path}>
            <a href={`#/${p.path}`}>{pageName(p.path, p.title)}</a>
            <span className="wk-hint">{t(WHY[p.why])}</span>
            {p.edit && <span className="wk-part-acts"><a className="wk-link-btn" href={viewPath('pages', ...pageSteps(p.path))}>{t('common.edit')}</a></span>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="wk-mypages">
      {all.slice(0, 12).map((p) => (
        <div key={p.path} className="wk-mypage" data-my-page={p.path} data-why={p.why}>
          <a className="wk-mypage-open" href={`#/${p.path}`}>
            <strong className="wk-mypage-title">{pageName(p.path, p.title)}</strong>
            <span className="wk-mypage-why">{t(WHY[p.why])}</span>
          </a>
          {p.edit && <a className="wk-link-btn wk-mypage-edit" href={viewPath('pages', ...pageSteps(p.path))}>{t('common.edit')}</a>}
        </div>
      ))}
    </div>
  );
}

/* -- Dostęp -------------------------------------------------------------------------------- */

function AccessPart({ mode, scope, view, who }: PartProps) {
  const t = useT();
  const links = useLoaded(mode === 'links' ? () => linksNow() : null, [mode]);
  const share = scope !== null && (
    <ShareButton who={who} label={t('workspace.parts.shareNamed', { name: view.name })} className="wk-btn wk-btn-small"
      target={{ title: view.name, aim: null, areaIds: view.areaIds }} />
  );

  if (mode === 'full') return <AccessFull view={view} who={who} />;
  if (links === undefined) return <Waiting what={t('workspace.parts.loadingLinks')} />;
  if (links === null) return <p className="wk-error">{t('workspace.parts.linksFailed')}</p>;

  const working = links.filter((l) => linkState(l) === 'active' && (scope === null || l.areas.some((a) => scope.has(a.areaId))));
  return (
    <>
      {working.length === 0 ? <p className="wk-now-calm">{scope === null ? t('workspace.parts.noLinks') : t('workspace.parts.noAreaLinks')}</p> : (
        <ul className="wk-part-list">
          {working.slice(0, 10).map((l) => (
            <li key={l.invitationId}>
              <span>{l.label ?? t('workspace.parts.link')}</span>
              <span className="wk-hint">{t('workspace.parts.linkUsed', { access: accessWords(l.areas), count: l.used })}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="wk-part-foot">{share} <a className="wk-link-btn" href={scope === null ? viewPath('areas') : viewPath('areas', view.areaIds[0], 'dostep')}>{t('workspace.parts.allLinks')}</a></p>
    </>
  );
}

function AccessFull({ view, who }: { view: ViewConfig; who: Who }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const keys = useLoaded(() => keysFor(who), [who, tick]);
  const areas = useLoaded(() => areasNow(), [tick]);
  if (keys === undefined || areas === undefined) return <Waiting what={t('common.loading')} />;
  if (keys === null || areas === null) return <p className="wk-error">{t('workspace.parts.loadFailed')}</p>;
  const self = selfOf(keys.graph);
  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <AccessLinks ring={keys.ring} self={self} areas={areas as AreaRow[]} focusAreaId={view.areaIds[0]} busy={busy !== null}
        onAct={async (what, todo) => {
          setBusy(what);
          setFailed(null);
          try { await todo(); invalidate(); setTick((n) => n + 1); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : t('common.failed')); } finally { setBusy(null); }
        }} />
    </>
  );
}

/* -- Osoby (Widok obszaru) ----------------------------------------------------------------- */

const OTHER_LEVEL: Record<string, string> = { read: 'workspace.parts.level.read', write: 'workspace.parts.level.write', admin: 'workspace.parts.level.admin' };

function PeoplePart({ mode, view, who }: PartProps) {
  const t = useT();
  const areaId = view.areaIds[0];
  const people = useLoaded(areaId === undefined ? null : async () => {
    const { members } = await loadMembers(areaId);
    const named = new Map<string, string>();
    try {
      const { ring, graph } = await keysFor(who);
      if (ring !== null) {
        for (const [roleId, called] of await namesInArea(ring, graph, areaId, members.map((m) => m.roleId))) named.set(roleId, called.name);
        const sealed = (await loadAreaNames(areaId)).names;
        for (const [roleId, name] of await openNames(await areaKeys(ring, areaId), areaId, sealed)) if (!named.has(roleId)) named.set(roleId, name);
      }
    } catch { /* ohne Namen */ }
    const seats = await loadSeats(areaId).then((s) => s.seats.filter((x) => x.revokedAt === null).length, () => 0);
    return { members, named, seats };
  }, [areaId, who]);

  if (people === undefined) return <Waiting what={t('workspace.parts.loadingPeople')} />;
  if (people === null) return <p className="wk-error">{t('workspace.parts.peopleFailed')}</p>;

  const level = (caps: readonly string[]) => (caps.includes('admin') ? 'admin' : caps.includes('write') ? 'write' : caps.includes('read') ? 'read' : null);
  const shown = people.members.filter((m) => m.kind !== 'account');
  return (
    <>
      <ul className="wk-part-list">
        {shown.map((m) => {
          const lvl = level(m.capabilities);
          return (
            <li key={m.roleId}>
              <span>{people.named.get(m.roleId) ?? (m.kind === 'person' ? t('workspace.parts.person') : m.kind === 'group' ? t('workspace.parts.group') : t('workspace.parts.role'))}</span>
              {lvl !== null && <span className="wk-hint">{t(OTHER_LEVEL[lvl])}</span>}
              {mode === 'full' && m.capabilities.includes('certify') && <span className="wk-tag">{t('workspace.parts.certifies')}</span>}
            </li>
          );
        })}
      </ul>
      <p className="wk-part-foot">
        {people.seats > 0 && <span className="wk-hint">{t('workspace.parts.seats', { count: people.seats })} </span>}
        <a className="wk-link-btn" data-area-details="" href={viewPath('areas', areaId, 'osoby')}>{t('workspace.parts.rolesLevels')}</a>
      </p>
    </>
  );
}

/* -- Die Zuordnung ------------------------------------------------------------------------ */

export const PART_VIEWS: Record<PartKind, (props: PartProps) => ReactNode> = {
  mypages: MyPagesPart,
  alerts: AlertsPart,
  agenda: AgendaPart,
  tasks: TasksPart,
  chats: ChatsPart,
  forms: FormsPart,
  pages: PagesPart,
  access: AccessPart,
  people: PeoplePart,
  learn: LearnPart
};
