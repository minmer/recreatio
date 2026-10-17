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
import { plural } from '../core/plural';
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

const clock = (iso: string) => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

function Waiting({ what }: { what: string }) {
  return <Loading label={what} lines={2} />;
}

/** Ohne offenen Schlüssel in dieser Karte — gesagt, nicht leer. */
function Locked() {
  return <p className="wk-hint">Klucze nie są otwarte w tej karcie — zaloguj się ponownie albo odblokuj klucz, żeby to zobaczyć.</p>;
}

/* -- Czeka na Ciebie --------------------------------------------------------------------- */

function AlertsPart({ mode, scope, who }: PartProps) {
  const { digest } = useSyncExternalStore(subscribe, current);
  const [settings] = useAlertSettings();
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
      {digest === null ? <Waiting what="Sprawdzanie…" />
        : items.length === 0 ? <p className="wk-now-calm">Nic nie czeka — wszystko przejrzane.</p>
        : <AlertRows items={items} compact={mode === 'compact'} />}
    </>
  );
}

/* -- Najbliższe terminy ----------------------------------------------------------------- */

function AgendaPart({ mode, scope, who }: PartProps) {
  const me = useMe(who);
  const days = mode === 'week' ? 7 : 2;
  const items = useLoaded(me && mode !== 'calendar' ? () => agendaNow(me.ring, days) : null, [me, days, mode]);
  const areas = useLoaded(() => areasNow(), []);
  const calendars = useLoaded(mode === 'calendar' && scope !== null ? async () => (await loadCalendars()).calendars : null, [mode, scope]);

  if (me === undefined) return <Waiting what="Wczytywanie…" />;
  if (me === null) return <Locked />;

  if (mode === 'calendar') {
    if (scope === null) return <Calendar me={me} />;
    if (calendars === undefined) return <Waiting what="Wczytywanie kalendarzy…" />;
    const ids = (calendars ?? []).filter((c) => scope.has(c.areaId)).map((c) => c.calendarId);
    return ids.length === 0 ? <p className="wk-hint">Ten obszar nie ma jeszcze kalendarza.</p> : <Calendar me={me} scope={ids} />;
  }

  if (items === undefined) return <Waiting what="Wczytywanie terminów…" />;
  if (items === null) return <p className="wk-error">Nie udało się wczytać terminów.</p>;

  const shown = items.filter((one) => inScope(scope, one.occurrence.areaId) && new Date(one.occurrence.endsAt) > new Date());
  if (shown.length === 0) return <p className="wk-now-calm">{mode === 'week' ? 'Nic w najbliższym tygodniu.' : 'Nic dziś ani jutro.'}</p>;

  const today = startOfDay(new Date());
  const dayName = (at: Date) => {
    const d = startOfDay(at).getTime();
    if (d === today.getTime()) return 'Dziś';
    if (d === addDays(today, 1).getTime()) return 'Jutro';
    return at.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
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
                <span className="wk-agenda-time">{one.occurrence.allDay ? 'cały dzień' : clock(one.occurrence.startsAt)}</span>
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
  const me = useMe(who);
  const now = useNow();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const tasks = useLoaded(me ? async () => {
    const today = startOfDay(new Date());
    return openTasks(me.ring, (await loadTasks(addDays(today, -2), addDays(today, 8))).tasks);
  } : null, [me, tick]);

  if (me === undefined || tasks === undefined) return <Waiting what="Wczytywanie zadań…" />;
  if (me === null) return <Locked />;
  if (tasks === null) return <p className="wk-error">Nie udało się wczytać zadań.</p>;

  const rows: TaskRowShown[] = [];
  for (const task of tasks.filter((t) => inScope(scope, t.areaId))) {
    if (task.kind === 'after') {
      const state = afterState(task, now);
      if (mode === 'all' || state.late || state.due < addDays(startOfDay(now), 1)) {
        rows.push({ key: task.taskId, task, occurrence: null, late: state.late, when: state.late ? 'zaległe' : `do ${state.due.toLocaleDateString('pl-PL')}` });
      }
      continue;
    }
    for (const occurrence of [...(task.overdue ?? []), ...task.occurrences]) {
      const state = windowState(occurrence, now);
      if (state === 'open' || state === 'missed' || (mode === 'all' && state === 'upcoming')) {
        rows.push({ key: `${task.taskId}:${occurrence.at}`, task, occurrence, late: state === 'missed', when: state === 'missed' ? 'zaległe' : state === 'open' ? 'teraz' : new Date(occurrence.at).toLocaleString('pl-PL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) });
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {rows.length === 0 ? <p className="wk-now-calm">Nic do zrobienia teraz.</p> : (
        <ul className="wk-part-list">
          {rows.slice(0, 12).map((row) => (
            <li key={row.key} className={row.late ? 'is-late' : undefined}>
              <a href={viewPath('tasks')}>{row.task.title ?? 'Zadanie'}</a>
              <span className="wk-hint">{row.when}</span>
              <button type="button" className="wk-btn wk-btn-small" disabled={busy !== null} onClick={() => void done(row)}>Zrobione</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -- Rozmowy ------------------------------------------------------------------------------ */

export const chatName = (c: ChatRow): string =>
  c.kind === 'seat' && c.seatName != null ? `Rozmowa z: ${c.seatName}`
  : c.kind === 'self' ? 'Notatki'
  : c.kind === 'channel' ? `Kanał: ${c.areaName}`
  : c.kind === 'area' ? c.areaName
  : `Rozmowa · ${c.areaName}`;

function ChatsPart({ mode, scope }: PartProps) {
  const chats = useLoaded(() => chatsNow(), []);
  if (chats === undefined) return <Waiting what="Wczytywanie rozmów…" />;
  if (chats === null) return <p className="wk-error">Nie udało się wczytać rozmów.</p>;
  const shown = chats.filter((c) => inScope(scope, c.areaId) && (mode === 'all' || c.unread > 0))
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  if (shown.length === 0) return <p className="wk-now-calm">{mode === 'all' ? 'Nie ma tu jeszcze rozmowy.' : 'Wszystko przeczytane.'}</p>;
  return (
    <ul className="wk-part-list">
      {shown.slice(0, 10).map((c) => (
        <li key={c.chatId}>
          <a href={viewPath('chat', c.chatId)}>{chatName(c)}</a>
          {c.unread > 0 && <span className="wk-alert-n">{c.unread}</span>}
          {c.lastMessageAt !== null && <span className="wk-hint">{new Date(c.lastMessageAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>}
        </li>
      ))}
    </ul>
  );
}

/* -- Formularze --------------------------------------------------------------------------- */

function FormsPart({ mode, scope }: PartProps) {
  const { digest } = useSyncExternalStore(subscribe, current);
  const modules = useLoaded(() => modulesNow(), []);
  if (modules === undefined) return <Waiting what="Wczytywanie formularzy…" />;
  if (modules === null) return <p className="wk-error">Nie udało się wczytać formularzy.</p>;
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
  if (forms.length === 0) return <p className="wk-now-calm">{mode === 'fresh' ? 'W formularzach nic nowego.' : 'Nie ma tu formularzy.'}</p>;
  return (
    <ul className="wk-part-list">
      {forms.flatMap((m) => [
        <li key={m.moduleId}>
          <a href={newIn(m.moduleId) > 0 ? formNewsPath(m.moduleId) : formPath(m.moduleId)}>{m.name}</a>
          <span className="wk-hint">{m.entries} {plural(m.entries, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')}{m.closed ? ' · zamknięty' : ''}</span>
          {newIn(m.moduleId) > 0 && <span className="wk-tag wk-tag-new">nowe: {newIn(m.moduleId)}</span>}
        </li>,
        ...freshSubs(m.moduleId).map((s) => (
          <li key={s.moduleId} className="is-sub" data-fresh-sub={s.moduleId}>
            <a href={formNewsPath(s.moduleId)}><span aria-hidden="true">↳ </span>{s.name}</a>
            <span className="wk-tag wk-tag-new">nowe: {newIn(s.moduleId)}</span>
          </li>
        ))
      ])}
    </ul>
  );
}

/* -- Strony ------------------------------------------------------------------------------- */

function PagesPart({ scope, desk, who }: PartProps) {
  const pages = desk.pages.filter((p) => p.aliasOf === null)
    .filter((p) => scope === null || (p.accessAreaIds ?? []).some((id) => scope.has(id)));
  if (pages.length === 0) {
    return <p className="wk-now-calm">{scope === null ? 'Nie prowadzisz jeszcze żadnej strony.' : 'Żadna strona nie jest tylko dla tego obszaru. Ustawisz to w edytorze strony („Kto widzi").'}</p>;
  }
  return (
    <ul className="wk-part-list">
      {pages.slice(0, 12).map((p) => (
        <li key={p.path}>
          <a href={`#/${p.path}`} className="wk-part-path">{p.path === '' ? 'recreatio.pl' : p.path}</a>
          {(p.accessAreaIds ?? []).length > 0 && <span className="wk-tag">z dostępem</span>}
          <span className="wk-part-acts">
            <a className="wk-link-btn" href={viewPath('pages', ...pageSteps(p.path))}>Edytuj</a>
            <ShareButton who={who} label="Udostępnij" className="wk-link-btn"
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

const WHY: Record<'own' | 'area' | 'editor' | 'seat', string> = {
  own: 'prowadzisz tę stronę',
  area: 'strona Twojej grupy',
  editor: 'możesz ją edytować',
  seat: 'Twoja strona (z Twojego linku)'
};

/**
 * 0106 — „TWOJE STRONY": wo man arbeitet. Für einen Animator und einen
 * Kandydaten mit Konto ist das die Seite, die jemand anderes vorbereitet hat
 * (nur mit Zugang für seine Gruppe, oder die seines Links) — dort tut er fast
 * alles. Wer Seiten führt, findet hier auch seine eigenen, mit „Edytuj".
 */
function MyPagesPart({ mode, desk }: PartProps) {
  const own = desk.pages.filter((p) => p.aliasOf === null)
    .map((p) => ({ path: p.path, title: p.title ?? null, why: 'own' as const, edit: true }));
  const open = (desk.open ?? []).map((p) => ({ path: p.path, title: p.title, why: p.why, edit: p.edit }));
  const all = [...open, ...own];

  if (all.length === 0) {
    return (
      <p className="wk-now-calm">
        Nie masz jeszcze żadnej strony. Stronę Twojej grupy przygotowuje osoba, która ją prowadzi — gdy da Ci do niej
        dostęp, pojawi się tutaj.
      </p>
    );
  }

  if (mode === 'list') {
    return (
      <ul className="wk-part-list">
        {all.slice(0, 20).map((p) => (
          <li key={p.path} data-my-page={p.path}>
            <a href={`#/${p.path}`}>{pageName(p.path, p.title)}</a>
            <span className="wk-hint">{WHY[p.why]}</span>
            {p.edit && <span className="wk-part-acts"><a className="wk-link-btn" href={viewPath('pages', ...pageSteps(p.path))}>Edytuj</a></span>}
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
            <span className="wk-mypage-why">{WHY[p.why]}</span>
          </a>
          {p.edit && <a className="wk-link-btn wk-mypage-edit" href={viewPath('pages', ...pageSteps(p.path))}>Edytuj</a>}
        </div>
      ))}
    </div>
  );
}

/* -- Dostęp -------------------------------------------------------------------------------- */

function AccessPart({ mode, scope, view, who }: PartProps) {
  const links = useLoaded(mode === 'links' ? () => linksNow() : null, [mode]);
  const share = scope !== null && (
    <ShareButton who={who} label={`Udostępnij: ${view.name}`} className="wk-btn wk-btn-small"
      target={{ title: view.name, aim: null, areaIds: view.areaIds }} />
  );

  if (mode === 'full') return <AccessFull view={view} who={who} />;
  if (links === undefined) return <Waiting what="Wczytywanie linków…" />;
  if (links === null) return <p className="wk-error">Nie udało się wczytać linków.</p>;

  const working = links.filter((l) => linkState(l) === 'działa' && (scope === null || l.areas.some((a) => scope.has(a.areaId))));
  return (
    <>
      {working.length === 0 ? <p className="wk-now-calm">Nie ma działających linków{scope === null ? '' : ' do tego obszaru'}.</p> : (
        <ul className="wk-part-list">
          {working.slice(0, 10).map((l) => (
            <li key={l.invitationId}>
              <span>{l.label ?? 'Link'}</span>
              <span className="wk-hint">{accessWords(l.areas)} · użyty {l.used}×</span>
            </li>
          ))}
        </ul>
      )}
      <p className="wk-part-foot">{share} <a className="wk-link-btn" href={scope === null ? viewPath('areas') : viewPath('areas', view.areaIds[0], 'dostep')}>Wszystkie linki</a></p>
    </>
  );
}

function AccessFull({ view, who }: { view: ViewConfig; who: Who }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const keys = useLoaded(() => keysFor(who), [who, tick]);
  const areas = useLoaded(() => areasNow(), [tick]);
  if (keys === undefined || areas === undefined) return <Waiting what="Wczytywanie…" />;
  if (keys === null || areas === null) return <p className="wk-error">Nie udało się wczytać.</p>;
  const self = selfOf(keys.graph);
  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <AccessLinks ring={keys.ring} self={self} areas={areas as AreaRow[]} focusAreaId={view.areaIds[0]} busy={busy !== null}
        onAct={async (what, todo) => {
          setBusy(what);
          setFailed(null);
          try { await todo(); invalidate(); setTick((n) => n + 1); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.'); } finally { setBusy(null); }
        }} />
    </>
  );
}

/* -- Osoby (Widok obszaru) ----------------------------------------------------------------- */

const OTHER_LEVEL: Record<string, string> = { read: 'czyta', write: 'pisze', admin: 'prowadzi' };

function PeoplePart({ mode, view, who }: PartProps) {
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

  if (people === undefined) return <Waiting what="Wczytywanie osób…" />;
  if (people === null) return <p className="wk-error">Nie udało się wczytać osób.</p>;

  const level = (caps: readonly string[]) => (caps.includes('admin') ? 'admin' : caps.includes('write') ? 'write' : caps.includes('read') ? 'read' : null);
  const shown = people.members.filter((m) => m.kind !== 'account');
  return (
    <>
      <ul className="wk-part-list">
        {shown.map((m) => {
          const lvl = level(m.capabilities);
          return (
            <li key={m.roleId}>
              <span>{people.named.get(m.roleId) ?? (m.kind === 'person' ? 'osoba' : m.kind === 'group' ? 'grupa' : 'rola')}</span>
              {lvl !== null && <span className="wk-hint">{OTHER_LEVEL[lvl]}</span>}
              {mode === 'full' && m.capabilities.includes('certify') && <span className="wk-tag">wpuszcza</span>}
            </li>
          );
        })}
      </ul>
      <p className="wk-part-foot">
        {people.seats > 0 && <span className="wk-hint">Osoby z linkiem (z formularzy): {people.seats}. </span>}
        <a className="wk-link-btn" data-area-details="" href={viewPath('areas', areaId, 'osoby')}>Role i poziomy dostępu</a>
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
