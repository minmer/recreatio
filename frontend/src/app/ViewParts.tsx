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

import { AccessLinks } from './AccessLinks';
import { alertItems, useAlertSettings, type TodayItem } from './alerts';
import { AlertRows } from './AlertList';
import { loadMembers, type AreaRow } from './area';
import { namesInArea } from './called';
import { Calendar } from './CalendarApp';
import { areaKeys, loadAreaNames, openNames, type ChatRow } from './chat';
import { loadCalendars } from './calendar';
import { addDays, keyOf, startOfDay } from './dayMath';
import type { Desk } from './desk';
import { accessWords, linkState } from './linkAccess';
import { useNow } from './MassParts';
import { useMe } from './me';
import { useDisplay } from './display';
import { current, subscribe } from './notify';
import { partLabel } from './parts/registry';
import { RecentRow } from './Recent';
import { keysFor } from './ringOf';
import { selfOf } from './roles';
import { pageSteps, viewPath, VIEWS, type View } from './routes';
import { loadSeats } from './seat';
import { WorkspaceError, type Who } from './session';
import { plural } from './ChatKit';
import { ShareButton } from './Share';
import { Starters } from './Starters';
import { afterState, loadTasks, markDone, openTasks, windowState, type OpenTask, type TaskOccurrence } from './tasks';
import { agendaNow, areasNow, chatsNow, invalidate, linksNow, modulesNow, useLoaded } from './viewData';
import type { PartKind, ViewConfig } from './workspaceViews';

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
  return <p className="wk-hint">{what}</p>;
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
      <p className="wk-part-foot"><a className="wk-link-btn" href={viewPath('account', 'widok')}>Co tu się pokazuje i w jakiej kolejności</a></p>
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
  const forms = modules.filter((m) => m.kind === 'form' && m.extendsId === null && inScope(scope, m.areaId))
    .filter((m) => mode !== 'fresh' || (fresh.get(m.moduleId) ?? 0) > 0)
    .sort((a, b) => (fresh.get(b.moduleId) ?? 0) - (fresh.get(a.moduleId) ?? 0) || a.name.localeCompare(b.name, 'pl'));
  if (forms.length === 0) return <p className="wk-now-calm">{mode === 'fresh' ? 'W formularzach nic nowego.' : 'Nie ma tu formularzy.'}</p>;
  return (
    <ul className="wk-part-list">
      {forms.map((m) => (
        <li key={m.moduleId}>
          <a href={viewPath('modules', 'form', m.moduleId)}>{m.name}</a>
          <span className="wk-hint">{m.entries} {plural(m.entries, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')}{m.closed ? ' · zamknięty' : ''}</span>
          {(fresh.get(m.moduleId) ?? 0) > 0 && <span className="wk-tag wk-tag-new">nowe: {fresh.get(m.moduleId)}</span>}
        </li>
      ))}
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
      <p className="wk-part-foot">{share} <a className="wk-link-btn" href={viewPath('areas')}>Wszystkie linki</a></p>
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
  const areasDisplay = useDisplay('areas');
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
        <button type="button" className="wk-link-btn" data-area-details="" onClick={() => areasDisplay.pick('full')}>Role i poziomy dostępu</button>
      </p>
    </>
  );
}

/* -- Na skróty, Ostatnio, Co chcesz zrobić, Wszystko ---------------------------------------- */

function QuickPart() {
  return (
    <nav className="wk-now-quick" aria-label="Na skróty">
      <a href={viewPath('calendar')}>Kalendarz</a>
      <a href={viewPath('tasks')}>Zadania</a>
      <a href={viewPath('chat')}>Rozmowy</a>
      <a href={viewPath('modules')}>Formularze</a>
      <button type="button" onClick={() => window.dispatchEvent(new Event('recreatio:search'))}>Szukaj <kbd>Ctrl K</kbd></button>
    </nav>
  );
}

function RecentPart({ desk }: PartProps) {
  const modules = useLoaded(() => modulesNow(), []);
  const areas = useLoaded(() => areasNow(), []);
  const pages = desk.pages.filter((p) => p.aliasOf === null).map((p) => ({ id: p.path, label: p.path === '' ? 'recreatio.pl' : p.path, href: viewPath('pages', ...pageSteps(p.path)) }));
  return (
    <div className="wk-recent-block">
      <RecentRow scope="pages" items={pages} max={5} />
      <RecentRow scope="modules" items={(modules ?? []).map((m) => ({ id: m.moduleId, label: `${m.name} · ${partLabel(m.kind)}`, href: viewPath('modules', m.kind, m.moduleId) }))} max={5} />
      <RecentRow scope="areas" items={(areas ?? []).map((a) => ({ id: a.areaId, label: a.name, href: viewPath('areas', a.areaId) }))} max={5} />
      <p className="wk-hint wk-recent-empty">Tu pojawią się ostatnio otwierane strony, moduły i obszary.</p>
    </div>
  );
}

const TILE_SAYS: Partial<Record<View, string>> = {
  areas: 'Grupy i wspólnoty: co nowego, terminy, osoby, dostęp.',
  calendar: 'Twoje terminy i terminy Twoich grup.',
  tasks: 'Co masz zrobić — o porze albo co pewien czas.',
  masses: 'Msze, spowiedź, nabożeństwa, intencje i wydruk.',
  bookings: 'Terminy u księdza, sale, dom — i kto co zajął.',
  chat: 'Rozmowy grup i osób.',
  library: 'Źródła, cytaty i Twoje teksty.',
  registry: 'Adresy parafii, rodziny, plan kolędy.',
  modules: 'Formularze i inne elementy stron.',
  pages: 'Twoje strony — edycja i udostępnianie.',
  addresses: 'Drugie wejście na stronę: alias albo domena.',
  roles: 'Wszystkie role i kto kogo trzyma.',
  account: 'Hasło, klucz, urządzenia, wygląd warsztatu.'
};

const MAIN_TILES: readonly View[] = ['areas', 'calendar', 'tasks', 'chat', 'masses', 'bookings', 'modules', 'pages', 'library', 'registry', 'account'];
const ALL_TILES: readonly View[] = [...MAIN_TILES, 'roles', 'addresses'];

function TilesPart({ mode, desk }: PartProps) {
  return (
    <div className="wk-tiles">
      {(mode === 'all' ? ALL_TILES : MAIN_TILES).map((view) => (
        <a key={view} className="wk-tile" href={viewPath(view)} data-tile={view}>
          <span className="wk-tile-head">
            <span className="wk-tile-name">{VIEWS[view]}</span>
            {view === 'pages' && <span className="wk-tile-count">{desk.pages.filter((p) => p.aliasOf === null).length}</span>}
          </span>
          <p className="wk-empty">{TILE_SAYS[view]}</p>
        </a>
      ))}
    </div>
  );
}

function StartersPart({ who }: PartProps) {
  return <Starters who={who} />;
}

/* -- Die Zuordnung ------------------------------------------------------------------------ */

export const PART_VIEWS: Record<PartKind, (props: PartProps) => ReactNode> = {
  alerts: AlertsPart,
  agenda: AgendaPart,
  tasks: TasksPart,
  chats: ChatsPart,
  forms: FormsPart,
  pages: PagesPart,
  access: AccessPart,
  people: PeoplePart,
  quick: QuickPart,
  recent: RecentPart,
  starters: StartersPart,
  tiles: TilesPart
};
