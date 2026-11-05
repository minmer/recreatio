/**
 * REZERWACJE — was man sich für eine Zeit nehmen kann, und wer es hält.
 *
 * <code>
 *   #/workspace/bookings          die Dinge, als Baum
 *   #/workspace/bookings/new      ein neues
 *   #/workspace/bookings/&lt;id&gt;     eines ganz: Regeln, was wartet, wer was hält
 * </code>
 *
 * <b>Eine Ansicht für beides.</b> „Spotkania z księdzem" und „Dom św. Józefa"
 * stehen in derselben Liste, weil sie dieselbe Sache sind. Was sie
 * unterscheidet, steht auf ihrer eigenen Seite als Regel — nicht als zweite
 * Ansicht mit eigenen Knöpfen.
 *
 * <b>Was wartet, zuerst.</b> Wer hier hereinschaut, sucht fast immer die
 * Anfragen, auf die jemand eine Antwort braucht — nicht die, die schon stehen.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { loadCalendars, type CalendarRow } from '../calendar/calendar';
import { useCrumbs, type Crumb } from '../shell/crumbTrail';
import { fmtDate, useT, type T } from '../core/i18n';
import { newId } from '../core/ids';
import {
  createResource, KIND_LABEL, loadClaims, loadResources, minutesToTime, officeDecides,
  updateResource, type Kind, type Mode, type OfficeClaim, type ResourceChange, type ResourceRow
} from './resource';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { AreaPick } from '../areas/AreaPick';
import { useTouched } from '../workspace/Recent';
import { Loading } from '../ui/Loading';
import { later } from '../ui/later';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';

/* 2026-10-29 — das JSON-Fach kommt erst, wenn man es öffnet (Beschreibung und Plan sind nicht klein). */
const BookingsJsonDialog = later(() => import('./BookingsJsonDialog').then((m) => m.BookingsJsonDialog));

const NEW = 'new';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type View =
  | { readonly at: 'list' }
  | { readonly at: 'new' }
  | { readonly at: 'one'; readonly resourceId: string };

export function viewOf(trail: readonly string[]): View {
  const first = trail[0];
  if (first === undefined) return { at: 'list' };
  if (first === NEW) return { at: NEW };
  if (UUID.test(first)) return { at: 'one', resourceId: first };
  return { at: 'list' };
}

export function Reservations({ trail }: { trail: readonly string[] }) {
  const t = useT();
  const [rows, setRows] = useState<readonly ResourceRow[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [calendars, setCalendars] = useState<readonly CalendarRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  const view = viewOf(trail);

  /* 0054 — was offen ist, kommt in „Ostatnio" nach vorn (gemerkt versiegelt). */
  useTouched('bookings', view.at === 'one' ? view.resourceId : null);

  const look = useCallback(async () => {
    try {
      setRows((await loadResources()).resources);
      setAreas((await loadAreas()).areas);
      setCalendars((await loadCalendars()).calendars);
      setFailed(null);
    } catch (e) {
      setRows([]);
      setFailed(e instanceof WorkspaceError ? e.message : t('bookings.view.loadFailed'));
    }
  }, [t]);

  useEffect(() => { void look(); }, [look]);

  const all = rows ?? [];
  const mine = view.at === 'one' ? all.find((r) => r.resourceId === view.resourceId) : undefined;

  /* Der Weg oben: das Ding samt seiner Vorfahren — Hortus Dei › Dom › Kaplica. */
  const chain: ResourceRow[] = [];
  for (let at = mine; at !== undefined && !chain.includes(at);
       at = all.find((r) => r.resourceId === at!.parentId)) chain.unshift(at);

  const crumbs: Crumb[] = view.at === NEW
    ? [{ label: t('bookings.view.newCrumb'), href: null }]
    : chain.map((r) => ({ label: r.name, href: viewPath('bookings', r.resourceId) }));

  useCrumbs(crumbs);

  /* 2026-10-29 — die Liste trägt ihren Kopf selbst: rechts „Więcej" mit dem JSON aller Dinge. */
  const listHead = (
    <PageHeader title={t('bookings.view.title')} actions={rows === null ? undefined : (
      <MenuButton label={t('bookings.view.moreOf', { name: t('bookings.view.title') })} items={[
        { label: t('bookings.view.json'), icon: 'braces', onSelect: () => setJsonOpen(true) }
      ]} />
    )} />
  );

  if (rows === null) return <>{view.at === 'list' && listHead}<Loading label={t('common.loading')} /></>;

  const head = failed !== null ? <p className="wk-error">{failed}</p> : null;

  if (view.at === NEW) {
    return (
      <>
        {head}
        <Editor
          was={null}
          all={all}
          areas={areas}
          calendars={calendars}
          onSaved={(r) => { void look().then(() => { window.location.hash = viewPath('bookings', r.resourceId); }); }}
        />
      </>
    );
  }

  if (view.at === 'one') {
    if (mine === undefined) return <p className="wk-empty">{t('bookings.view.missing')}</p>;

    return (
      <>
        {head}
        <ResourcePage row={mine} all={all} areas={areas} calendars={calendars} onChanged={() => void look()} />
      </>
    );
  }

  /* -- Die Liste, als Baum ------------------------------------------------- */

  const depth = (r: ResourceRow): number => {
    let d = 0;
    for (let at = r.parentId; at !== null && d < 16; d++)
      at = all.find((x) => x.resourceId === at)?.parentId ?? null;
    return d;
  };

  const ordered: ResourceRow[] = [];
  const under = (parent: string | null) => {
    for (const r of all.filter((x) => x.parentId === parent)) { ordered.push(r); under(r.resourceId); }
  };
  under(null);

  return (
    <>
      {listHead}
      {head}

      <ul className="wk-tree">
        {ordered.map((r) => (
          <li key={r.resourceId}>
            <a className="wk-tree-row" href={viewPath('bookings', r.resourceId)}
              style={{ '--depth': depth(r) } as React.CSSProperties}>
              <span className="wk-tree-name">{r.name}</span>

              <span className="wk-tags">
                <span className="wk-tag">{KIND_LABEL[r.kind]}</span>
                <span className="wk-tag">{r.mode === 'offered' ? t('bookings.view.modeOffered') : t('bookings.view.modeOpen')}</span>
                {r.pending > 0 && <span className="wk-tag wk-tag-open">{t('bookings.view.pending', { count: r.pending })}</span>}
              </span>

              <span className="wk-tree-mine">
                {t('bookings.view.atOnce', { count: r.capacity })}
              </span>
            </a>
          </li>
        ))}

        <li>
          <a className="wk-tree-add" href={viewPath('bookings', NEW)}>
            <span aria-hidden="true">+</span> {t('bookings.view.newResource')}
          </a>
        </li>
      </ul>

      {all.length === 0 && (
        <p className="wk-empty">
          {t('bookings.view.empty')}
        </p>
      )}

      {jsonOpen && <BookingsJsonDialog only={null} onClose={() => setJsonOpen(false)} onImported={() => void look()} />}
    </>
  );
}

/* -- Ein Ding, ganz ------------------------------------------------------- */

function ResourcePage({ row, all, areas, calendars, onChanged }: {
  row: ResourceRow;
  all: readonly ResourceRow[];
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  onChanged: () => void;
}) {
  const t = useT();
  const [claims, setClaims] = useState<readonly OfficeClaim[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  const look = useCallback(async () => {
    try { setClaims((await loadClaims(row.resourceId)).claims); }
    catch { setClaims([]); }
  }, [row.resourceId]);

  useEffect(() => { void look(); }, [look]);

  const decide = (claimId: string, accept: boolean) => {
    setBusy(accept ? t('bookings.view.confirming') : t('bookings.view.rejecting'));
    setFailed(null);

    void officeDecides(claimId, accept)
      .then(() => look())
      .then(onChanged)
      .catch((e) => setFailed(e instanceof WorkspaceError ? e.message : t('common.failed')))
      .finally(() => setBusy(null));
  };

  const waiting = (claims ?? []).filter((c) => c.status === 'pending' && c.awaits === 'office');
  const standing = (claims ?? []).filter((c) => !(c.status === 'pending' && c.awaits === 'office'));

  /* Eine Anfrage ist eine GRUPPE — einmal ja, alle Teile. */
  const groups = new Map<string, OfficeClaim[]>();
  for (const c of waiting) groups.set(c.groupId, [...(groups.get(c.groupId) ?? []), c]);

  return (
    <>
      {/* 2026-10-29 — rechts „Więcej": dieses Ding als JSON, mit seinen Terminen und Reservierungen. */}
      <PageHeader title={row.name} actions={(
        <MenuButton label={t('bookings.view.moreOf', { name: row.name })} items={[
          { label: t('bookings.view.json'), icon: 'braces', onSelect: () => setJsonOpen(true) }
        ]} />
      )} />

      <dl className="wk-facts">
        <div className="wk-fact"><dt>{t('bookings.view.facts.kind')}</dt><dd>{KIND_LABEL[row.kind]}</dd></div>
        <div className="wk-fact"><dt>{t('bookings.view.facts.chooses')}</dt><dd>{row.mode === 'offered' ? t('bookings.view.facts.office') : t('bookings.view.facts.asker')}</dd></div>
        <div className="wk-fact"><dt>{t('bookings.view.facts.atOnce')}</dt><dd>{row.capacity}</dd></div>
        <div className="wk-fact"><dt>{t('bookings.view.facts.perPerson')}</dt><dd>{row.perPerson === 0 ? t('bookings.view.facts.noLimit') : row.perPerson}</dd></div>
        {row.mode === 'offered' && row.inviteHours > 0 && (
          <div className="wk-fact"><dt>{t('bookings.view.facts.groupFrom')}</dt><dd>{row.minPersons}</dd></div>
        )}
        <div className="wk-fact"><dt>{t('bookings.view.facts.approves')}</dt><dd>{row.approval === 'office' ? t('bookings.view.facts.office') : t('bookings.view.facts.nobody')}</dd></div>
      </dl>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}

      {/* -- Was wartet ---------------------------------------------------- */}

      {groups.size > 0 && (
        <section className="wk-panel">
          <h2 className="wk-h2">{t('bookings.view.waiting')}</h2>

          <ul className="wk-people">
            {[...groups.values()].map((group) => (
              <li className="wk-person" key={group[0].groupId}>
                <span className="wk-person-who">
                  <strong>{group[0].name ?? t('bookings.view.noName')}</strong>
                </span>

                <span className="wk-person-can">
                  {group.map((c) => (
                    <span className="wk-tag" key={c.claimId}>{when(c, row, t)}</span>
                  ))}
                </span>

                <button type="button" className="wk-btn" disabled={busy !== null}
                  onClick={() => decide(group[0].claimId, true)}>{t('bookings.dialog.confirm')}</button>
                <button type="button" className="wk-link-btn" disabled={busy !== null}
                  onClick={() => decide(group[0].claimId, false)}>{t('bookings.dialog.reject')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* -- Wer was hält -------------------------------------------------- */}

      <section className="wk-panel">
        <h2 className="wk-h2">{t('bookings.open.busy')}</h2>

        {claims === null ? (
          <Loading label={t('common.loading')} />
        ) : standing.length === 0 ? (
          <p className="wk-empty">
            {row.mode === 'offered'
              ? t('bookings.view.noneOffered')
              : t('bookings.view.noneOpen')}
          </p>
        ) : (
          <ul className="wk-people">
            {standing.map((c) => (
              <li className="wk-person" key={c.claimId}>
                <span className="wk-person-who">
                  <strong>{when(c, row, t)}</strong>
                  {c.name !== null && <span>{c.name}</span>}
                </span>

                <span className="wk-person-can">
                  <span className={c.status === 'confirmed' ? 'wk-tag wk-tag-open' : 'wk-tag'}>
                    {c.status === 'confirmed' ? t('bookings.open.status.confirmed')
                      : c.status === 'declined' ? t('bookings.open.status.declined')
                      : c.awaits === 'host' ? t('bookings.view.asksHost') : t('bookings.myTerm.waits.any')}
                  </span>
                  {c.hosting && <span className="wk-tag">{t('bookings.view.host')}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -- Die Regeln ---------------------------------------------------- */}

      <details className="wk-fold">
        <summary>{t('bookings.view.rules')}</summary>
        <Editor was={row} all={all} areas={areas} calendars={calendars} onSaved={onChanged} />
      </details>

      {jsonOpen && <BookingsJsonDialog only={row} onClose={() => setJsonOpen(false)} onImported={() => { void look(); onChanged(); }} />}
    </>
  );
}

function when(c: { startsAt: string; endsAt: string }, row: ResourceRow, t: T): string {
  const s = new Date(c.startsAt);
  const e = new Date(c.endsAt);
  const date = (d: Date) => fmtDate(d, { day: 'numeric', month: 'short' }, t.lang);
  const time = (d: Date) => fmtDate(d, { hour: '2-digit', minute: '2-digit' }, t.lang);

  if (row.byNight) return `${date(s)} → ${date(e)}`;
  return s.toDateString() === e.toDateString()
    ? `${date(s)} ${time(s)}–${time(e)}`
    : `${date(s)} ${time(s)} → ${date(e)} ${time(e)}`;
}

/* -- Die Regeln ------------------------------------------------------------ */

/**
 * Die Regeln eines Dings — ein Formular für beide Fälle.
 *
 * <b>Die Felder folgen dem, was man gewählt hat.</b> Wer „kancelaria podaje
 * terminy" wählt, bekommt den Kalender und das Einladungsfenster; wer
 * „pytający wybiera" wählt, bekommt Nächte oder Stunden und die Puffer. Beides
 * gleichzeitig hinzustellen hiesse, die Hälfte der Felder für nichts
 * auszufüllen — und nicht zu wissen, welche Hälfte.
 */
/**
 * WIE VIELE TERMINE EINER HALTEN DARF (0045) — 0 heisst: keine Grenze.
 * Gezählt wird, was noch steht oder wartet und nicht vorbei ist.
 */
export function PerPersonField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useT();
  return (
    <label className="wk-field">
      <span>{t('bookings.editor.perPerson')}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="wk-hint">{t('bookings.editor.perPersonHint')}</span>
    </label>
  );
}

function Editor({ was, all, areas, calendars, onSaved }: {
  was: ResourceRow | null;
  all: readonly ResourceRow[];
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  onSaved: (row: ResourceRow) => void;
}) {
  const t = useT();
  const [areaId, setAreaId] = useState(was?.areaId ?? '');
  const [name, setName] = useState(was?.name ?? '');
  const [kind, setKind] = useState<Kind>(was?.kind ?? 'person');
  const [mode, setMode] = useState<Mode>(was?.mode ?? 'offered');
  const [parentId, setParentId] = useState(was?.parentId ?? '');
  const [calendarId, setCalendarId] = useState(was?.calendarId ?? '');
  const [capacity, setCapacity] = useState(String(was?.capacity ?? 1));
  const [approval, setApproval] = useState<'none' | 'office'>(was?.approval ?? 'none');
  const [inviteHours, setInviteHours] = useState(String(was?.inviteHours ?? 0));
  const [perPerson, setPerPerson] = useState(String(was?.perPerson ?? 0));
  const [minPersons, setMinPersons] = useState(String(was?.minPersons ?? 2));
  const [byNight, setByNight] = useState(was?.byNight ?? false);
  const [checkIn, setCheckIn] = useState(minutesToTime(was?.checkInMin ?? 960));
  const [checkOut, setCheckOut] = useState(minutesToTime(was?.checkOutMin ?? 600));
  const [before, setBefore] = useState(String(was?.bufferBefore ?? 0));
  const [after, setAfter] = useState(String(was?.bufferAfter ?? 0));
  const [lead, setLead] = useState(String(was?.leadDays ?? 0));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const writable = areas.filter((a) => a.myLevel === 'admin' || a.myLevel === 'write');
  const area = was?.areaId ?? areaId;
  const ownCalendars = calendars.filter((c) => c.areaId === area);
  const parents = all.filter((r) => r.areaId === area && r.resourceId !== was?.resourceId);

  const toMin = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const blocker =
    name.trim() === '' ? t('bookings.editor.needName')
    : area === '' ? t('bookings.editor.needArea')
    : mode === 'offered' && calendarId === '' ? t('bookings.editor.needCalendar')
    : null;

  const save = async () => {
    setBusy(true);
    setFailed(null);

    const change: ResourceChange = {
      name: name.trim(), kind, mode,
      parentId: parentId, calendarId: calendarId,
      capacity: Math.max(1, Number(capacity) || 1),
      approval,
      inviteHours: mode === 'offered' ? Math.max(0, Number(inviteHours) || 0) : 0,
      byNight: mode === 'open' && byNight,
      checkInMin: toMin(checkIn), checkOutMin: toMin(checkOut),
      bufferBefore: Math.max(0, Number(before) || 0),
      bufferAfter: Math.max(0, Number(after) || 0),
      leadDays: Math.max(0, Number(lead) || 0),
      perPerson: Math.max(0, Number(perPerson) || 0),
      minPersons: Math.min(1000, Math.max(1, Number(minPersons) || 2))
    };

    try {
      const row = was === null
        ? await createResource(newId(), areaId, change)
        : await updateResource(was.resourceId, change);
      onSaved(row);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('bookings.editor.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (blocker === null) void save(); }}>
      {was === null && <h1 className="wk-h1">{t('bookings.view.newResource')}</h1>}

      {was === null && (
        <label className="wk-field">
          <span>{t('bookings.editor.area')}</span>
          <AreaPick label={t('bookings.editor.area')} value={areaId} onChange={setAreaId} areas={areas} only={writable} />
        </label>
      )}

      <label className="wk-field">
        <span>{t('common.name')}</span>
        <input value={name} placeholder={t('bookings.editor.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>{t('bookings.view.facts.kind')}</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>

      {parents.length > 0 && (
        <label className="wk-field">
          <span>{t('bookings.editor.inside')}</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t('bookings.editor.separate')}</option>
            {parents.map((r) => <option key={r.resourceId} value={r.resourceId}>{r.name}</option>)}
          </select>
        </label>
      )}

      {/* DIE ENTSCHEIDUNG, an der alles andere hängt. */}
      <label className="wk-field">
        <span>{t('bookings.editor.whoChooses')}</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="offered">{t('bookings.editor.modeOffered')}</option>
          <option value="open">{t('bookings.editor.modeOpen')}</option>
        </select>
      </label>

      {mode === 'offered' ? (
        <>
          <label className="wk-field">
            <span>{t('bookings.editor.calendar')}</span>
            <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              <option value="">{t('bookings.editor.pick')}</option>
              {ownCalendars.map((c) => <option key={c.calendarId} value={c.calendarId}>{c.title}</option>)}
            </select>
          </label>
          <p className="wk-hint">{t('bookings.editor.calendarHint')}</p>

          <label className="wk-field">
            <span>{t('bookings.editor.capacity')}</span>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>

          <label className="wk-field">
            <span>{t('bookings.editor.inviteHours')}</span>
            <input type="number" min={0} value={inviteHours} onChange={(e) => setInviteHours(e.target.value)} />
            <span className="wk-hint">{t('bookings.editor.inviteHoursHint')}</span>
          </label>

          {/* DIE MINDESTZAHL (0049) — nur mit einem Gastgeber von Belang. */}
          {Number(inviteHours) > 0 && (
            <label className="wk-field">
              <span>{t('bookings.editor.minPersons')}</span>
              <input type="number" min={1} value={minPersons} onChange={(e) => setMinPersons(e.target.value)} />
              <span className="wk-hint">
                {t('bookings.editor.minPersonsHint')}
              </span>
            </label>
          )}

          <PerPersonField value={perPerson} onChange={setPerPerson} />
        </>
      ) : (
        <>
          <label className="wk-field">
            <span>{t('bookings.editor.counted')}</span>
            <select value={byNight ? 'night' : 'hour'} onChange={(e) => setByNight(e.target.value === 'night')}>
              <option value="hour">{t('bookings.editor.byHour')}</option>
              <option value="night">{t('bookings.editor.byNight')}</option>
            </select>
          </label>

          {byNight && (
            <div className="wk-actions">
              <label className="wk-field"><span>{t('bookings.editor.checkIn')}</span>
                <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></label>
              <label className="wk-field"><span>{t('bookings.editor.checkOut')}</span>
                <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></label>
            </div>
          )}

          <label className="wk-field">
            <span>{t('bookings.editor.groups')}</span>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>

          <div className="wk-actions">
            <label className="wk-field"><span>{t('bookings.editor.before')}</span>
              <input type="number" min={0} value={before} onChange={(e) => setBefore(e.target.value)} /></label>
            <label className="wk-field"><span>{t('bookings.editor.after')}</span>
              <input type="number" min={0} value={after} onChange={(e) => setAfter(e.target.value)} /></label>
          </div>

          <label className="wk-field">
            <span>{t('bookings.editor.lead')}</span>
            <input type="number" min={0} value={lead} onChange={(e) => setLead(e.target.value)} />
          </label>
        </>
      )}

      <label className="wk-field">
        <span>{t('bookings.editor.approval')}</span>
        <select value={approval} onChange={(e) => setApproval(e.target.value as 'none' | 'office')}>
          <option value="none">{t('bookings.editor.approvalNone')}</option>
          <option value="office">{t('bookings.editor.approvalOffice')}</option>
        </select>
      </label>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>
          {busy ? t('bookings.myTerm.saving') : was === null ? t('bookings.editor.create') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

export default Reservations;
