import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  ApiError,
  archiveCalendarItem,
  completeCalendarTask,
  completeCalendarTaskAndRunGraph,
  createCalendarItem,
  createCalendarShare,
  executeCalendarGraph,
  getCalendarEvents,
  getCalendarGraph,
  getCalendarGraphExecutions,
  getCalendarGraphTemplates,
  getCalendarItem,
  getCalendars,
  getPublicSharedCalendarItem,
  getRoles,
  listCalendarShares,
  revokeCalendarShare,
  upsertCalendarGraph,
  type CalendarConflictResponse,
  type CalendarEventResponse,
  type CalendarEventShare,
  type CalendarGraphExecution,
  type CalendarGraphTemplate,
  type CalendarOccurrenceResponse,
  type CalendarPublicEventResponse
} from '../../lib/api';

type ViewMode = 'month' | 'week' | 'day' | 'list';

const VIEW_MODES: ViewMode[] = ['month', 'week', 'day', 'list'];

function parseShareCode(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 3 && segments[0] === 'calendar' && (segments[1] === 'shared' || segments[1] === 'public')) {
    return decodeURIComponent(segments[2]);
  }

  return null;
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ' UTC';
}

function rangeFromView(anchor: Date, view: ViewMode): { fromUtc: string; toUtc: string } {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);

  if (view === 'day') {
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (view === 'week') {
    const dayOfWeek = start.getUTCDay();
    const mondayShift = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setUTCDate(start.getUTCDate() + mondayShift);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (view === 'month') {
    start.setUTCDate(1);
    end.setTime(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    end.setUTCDate(end.getUTCDate() + 30);
  }

  return { fromUtc: start.toISOString(), toUtc: end.toISOString() };
}

function shiftAnchor(anchor: Date, view: ViewMode, direction: -1 | 1): Date {
  const next = new Date(anchor);
  if (view === 'day') next.setUTCDate(next.getUTCDate() + direction);
  else if (view === 'week') next.setUTCDate(next.getUTCDate() + direction * 7);
  else if (view === 'month') next.setUTCMonth(next.getUTCMonth() + direction);
  else next.setUTCDate(next.getUTCDate() + direction * 30);
  return next;
}

function readError(error: unknown): string {
  if (error instanceof ApiError) return 'API ' + error.status + ': ' + error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

export function CalendarPage({
  copy,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  const location = useLocation();
  const shareCode = useMemo(() => parseShareCode(location.pathname), [location.pathname]);

  const [error, setError] = useState<string | null>(null);
  const [publicItem, setPublicItem] = useState<CalendarPublicEventResponse | null>(null);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [ownerRoleId, setOwnerRoleId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [occurrences, setOccurrences] = useState<CalendarOccurrenceResponse[]>([]);
  const [conflicts, setConflicts] = useState<CalendarConflictResponse[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventResponse | null>(null);
  const [shares, setShares] = useState<CalendarEventShare[]>([]);
  const [latestShareCode, setLatestShareCode] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CalendarGraphTemplate[]>([]);
  const [executions, setExecutions] = useState<CalendarGraphExecution[]>([]);
  const [graphTemplateKey, setGraphTemplateKey] = useState('');
  const [graphStatus, setGraphStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [graphConfigJson, setGraphConfigJson] = useState('{}');
  const [graphNodesJson, setGraphNodesJson] = useState('[]');
  const [graphEdgesJson, setGraphEdgesJson] = useState('[]');

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [itemType, setItemType] = useState<'appointment' | 'task'>('appointment');
  const [visibility, setVisibility] = useState<'private' | 'role' | 'public'>('private');
  const [startUtcLocal, setStartUtcLocal] = useState(new Date().toISOString().slice(0, 16));
  const [endUtcLocal, setEndUtcLocal] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'appointment' | 'task' | ''>('');
  const [taskStateFilter, setTaskStateFilter] = useState('');

  const range = useMemo(() => rangeFromView(anchor, view), [anchor, view]);
  const shareUrl = useMemo(() => {
    if (!latestShareCode) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin + '/#/calendar/shared/' + encodeURIComponent(latestShareCode);
  }, [latestShareCode]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrenceResponse[]>();
    for (const row of occurrences) {
      const day = row.occurrenceStartUtc.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [occurrences]);

  useEffect(() => {
    if (!shareCode) {
      setPublicItem(null);
      return;
    }

    getPublicSharedCalendarItem(shareCode)
      .then((item) => {
        setPublicItem(item);
        setError(null);
      })
      .catch((err) => setError(readError(err)));
  }, [shareCode]);

  useEffect(() => {
    if (!showProfileMenu || shareCode) return;

    Promise.all([getCalendars(), getRoles(), getCalendarGraphTemplates()])
      .then(([calendarList, roleList, templateList]) => {
        setCalendars(calendarList.map((row) => ({ id: row.calendarId, name: row.name })));
        setCalendarId((current) => current ?? (calendarList[0]?.calendarId ?? null));
        setOwnerRoleId((current) => current ?? (roleList[0]?.roleId ?? null));
        setTemplates(templateList);
        if (templateList.length > 0 && !graphTemplateKey) {
          setGraphTemplateKey(templateList[0].templateKey);
          setGraphConfigJson(templateList[0].defaultConfigJson || '{}');
          setGraphNodesJson(JSON.stringify(templateList[0].nodes, null, 2));
          setGraphEdgesJson(JSON.stringify(templateList[0].edges, null, 2));
        }
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareCode, graphTemplateKey]);

  useEffect(() => {
    if (!showProfileMenu || !calendarId || shareCode) return;

    getCalendarEvents({
      calendarId,
      view,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      status: statusFilter || undefined,
      visibility: visibilityFilter || undefined,
      itemType: itemTypeFilter || undefined,
      taskState: taskStateFilter || undefined,
      includeProtected: true
    })
      .then((bundle) => {
        setOccurrences(bundle.occurrences);
        setConflicts(bundle.conflicts);
        setSelectedEventId((current) => current ?? (bundle.occurrences[0]?.eventId ?? null));
      })
      .catch((err) => setError(readError(err)));
  }, [showProfileMenu, shareCode, calendarId, range.fromUtc, range.toUtc, view, statusFilter, visibilityFilter, itemTypeFilter, taskStateFilter]);

  useEffect(() => {
    if (!selectedEventId || shareCode || !showProfileMenu) {
      setSelectedEvent(null);
      return;
    }

    Promise.allSettled([
      getCalendarItem(selectedEventId, true),
      listCalendarShares(selectedEventId),
      getCalendarGraphExecutions(selectedEventId, 20),
      getCalendarGraph(selectedEventId)
    ]).then((results) => {
      if (results[0].status === 'fulfilled') setSelectedEvent(results[0].value);
      if (results[1].status === 'fulfilled') setShares(results[1].value);
      if (results[2].status === 'fulfilled') setExecutions(results[2].value);
      if (results[3].status === 'fulfilled') {
        const graph = results[3].value;
        setGraphTemplateKey(graph.templateKey);
        setGraphStatus(graph.status === 'draft' || graph.status === 'archived' ? graph.status : 'active');
        setGraphConfigJson(graph.templateConfigJson || '{}');
        setGraphNodesJson(JSON.stringify(graph.nodes, null, 2));
        setGraphEdgesJson(JSON.stringify(graph.edges, null, 2));
      }
    });
  }, [selectedEventId, shareCode, showProfileMenu]);

  const applyTemplate = (templateKey: string) => {
    const template = templates.find((entry) => entry.templateKey === templateKey);
    if (!template) return;
    setGraphTemplateKey(template.templateKey);
    setGraphConfigJson(template.defaultConfigJson || '{}');
    setGraphNodesJson(JSON.stringify(template.nodes, null, 2));
    setGraphEdgesJson(JSON.stringify(template.edges, null, 2));
    setGraphStatus('active');
  };

  const refresh = () => {
    if (!calendarId) return;
    getCalendarEvents({
      calendarId,
      view,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      status: statusFilter || undefined,
      visibility: visibilityFilter || undefined,
      itemType: itemTypeFilter || undefined,
      taskState: taskStateFilter || undefined,
      includeProtected: true
    })
      .then((bundle) => {
        setOccurrences(bundle.occurrences);
        setConflicts(bundle.conflicts);
      })
      .catch((err) => setError(readError(err)));
  };

  const createItem = async () => {
    if (!calendarId || !ownerRoleId) {
      setError('No calendar or owner role available.');
      return;
    }

    try {
      const parsedNodes = JSON.parse(graphNodesJson || '[]');
      const parsedEdges = JSON.parse(graphEdgesJson || '[]');
      await createCalendarItem({
        calendarId,
        ownerRoleId,
        titlePublic: title,
        summaryPublic: summary,
        visibility,
        status: 'planned',
        startUtc: new Date(startUtcLocal).toISOString(),
        endUtc: new Date(endUtcLocal).toISOString(),
        itemType,
        taskState: itemType === 'task' ? 'todo' : null,
        taskProgressPercent: itemType === 'task' ? 0 : null,
        graph: {
          templateKey: graphTemplateKey || 'daily',
          status: 'active',
          templateConfigJson: graphConfigJson,
          nodes: parsedNodes,
          edges: parsedEdges
        }
      });
      setTitle('');
      setSummary('');
      refresh();
    } catch (err) {
      setError(readError(err));
    }
  };

  const header = (
    <header className="calendar-header">
      <a href="/#/section-1" className="calendar-brand" onClick={() => onNavigate('home')}>REcreatio</a>
      <nav className="calendar-top-nav">
        <a href="/#/parish">{copy.nav.parish}</a>
        <a href="/#/event">{copy.nav.events}</a>
        <a href="/#/cogita">{copy.nav.cogita}</a>
        <a href="/#/chat">{copy.nav.chat}</a>
      </nav>
      <div className="calendar-header-actions">
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <AuthAction
          copy={copy}
          label={authLabel}
          isAuthenticated={showProfileMenu}
          secureMode={secureMode}
          onLogin={onAuthAction}
          onProfileNavigate={onProfileNavigate}
          onToggleSecureMode={onToggleSecureMode}
          onLogout={onLogout}
          variant="ghost"
        />
      </div>
    </header>
  );

  if (shareCode) {
    return (
      <div className="calendar-page">
        {header}
        <main className="calendar-main calendar-main-public">
          <section className="calendar-panel">
            <h1>Shared Calendar Item</h1>
            <p>Code: {shareCode}</p>
            {error && <p className="calendar-error">{error}</p>}
            {publicItem && (
              <div className="calendar-public-card">
                <h2>{publicItem.titlePublic}</h2>
                <p>{publicItem.summaryPublic ?? 'No summary'}</p>
                <p>{formatUtc(publicItem.startUtc)} - {formatUtc(publicItem.endUtc)}</p>
                <p>Type: {publicItem.itemType}</p>
                <p>Status: {publicItem.status}</p>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (!showProfileMenu) {
    return (
      <div className="calendar-page calendar-page-guest">
        {header}
        <main className="calendar-guest-main">
          <h1>{copy.calendar.title}</h1>
          <p>{copy.calendar.subtitle}</p>
          <button type="button" className="cta" onClick={onAuthAction}>{copy.calendar.loginCta}</button>
        </main>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      {header}
      <main className="calendar-main calendar-workspace">
        <aside className="calendar-sidebar">
          <h1>{copy.calendar.title}</h1>
          <div className="calendar-field-row">
            <label>Calendar</label>
            <select value={calendarId ?? ''} onChange={(event) => setCalendarId(event.target.value || null)}>
              {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
            </select>
          </div>
          <div className="calendar-view-switch">
            {VIEW_MODES.map((mode) => (
              <button key={mode} type="button" className={view === mode ? 'is-active' : ''} onClick={() => setView(mode)}>{mode}</button>
            ))}
          </div>
          <div className="calendar-range-nav">
            <button type="button" onClick={() => setAnchor((current) => shiftAnchor(current, view, -1))}>Previous</button>
            <button type="button" onClick={() => setAnchor(new Date())}>Today</button>
            <button type="button" onClick={() => setAnchor((current) => shiftAnchor(current, view, 1))}>Next</button>
          </div>
          <div className="calendar-field-row">
            <label>Status filter</label>
            <input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
          </div>
          <div className="calendar-field-row">
            <label>Visibility filter</label>
            <input value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} />
          </div>
          <div className="calendar-field-row">
            <label>Type filter</label>
            <select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value as '' | 'appointment' | 'task')}>
              <option value="">all</option>
              <option value="appointment">appointment</option>
              <option value="task">task</option>
            </select>
          </div>
          <div className="calendar-field-row">
            <label>Task state filter</label>
            <input value={taskStateFilter} onChange={(event) => setTaskStateFilter(event.target.value)} />
          </div>
          <div className="calendar-create-form">
            <h2>Create item</h2>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
            <textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Summary" />
            <div className="calendar-inline-grid">
              <select value={itemType} onChange={(event) => setItemType(event.target.value as 'appointment' | 'task')}>
                <option value="appointment">appointment</option>
                <option value="task">task</option>
              </select>
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'role' | 'public')}>
                <option value="private">private</option>
                <option value="role">role</option>
                <option value="public">public</option>
              </select>
            </div>
            <div className="calendar-inline-grid">
              <input type="datetime-local" value={startUtcLocal} onChange={(event) => setStartUtcLocal(event.target.value)} />
              <input type="datetime-local" value={endUtcLocal} onChange={(event) => setEndUtcLocal(event.target.value)} />
            </div>
            <button type="button" className="cta" onClick={() => void createItem()}>Create</button>
          </div>
          {error && <p className="calendar-error">{error}</p>}
        </aside>

        <section className="calendar-board-section">
          <div className="calendar-board-header">
            <h2>{view.toUpperCase()} VIEW</h2>
            <p>{formatUtc(range.fromUtc)} - {formatUtc(range.toUtc)}</p>
          </div>
          {view === 'month' && (
            <div className="calendar-month-grid">
              {Array.from(groupedByDay.keys()).sort().map((day) => (
                <article key={day} className="calendar-day-card">
                  <h3>{day}</h3>
                  <ul>
                    {(groupedByDay.get(day) ?? []).slice(0, 6).map((row) => (
                      <li key={row.eventId + '-' + row.occurrenceStartUtc}>
                        <button type="button" onClick={() => setSelectedEventId(row.eventId)}>{row.event.titlePublic} ({row.event.itemType})</button>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
          {view !== 'month' && (
            <div className="calendar-occurrence-list">
              {occurrences.map((row) => (
                <article key={row.eventId + '-' + row.occurrenceStartUtc} className={'calendar-occurrence-row' + (selectedEventId === row.eventId ? ' is-selected' : '')}>
                  <button type="button" onClick={() => setSelectedEventId(row.eventId)}>
                    <strong>{row.event.titlePublic}</strong>
                    <span>{formatUtc(row.occurrenceStartUtc)} - {formatUtc(row.occurrenceEndUtc)}</span>
                    <span>{row.event.itemType} / {row.event.status}</span>
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="calendar-conflicts">
            <h3>Conflicts ({conflicts.length})</h3>
            <ul>
              {conflicts.slice(0, 20).map((conflict) => (
                <li key={conflict.eventId + '-' + conflict.startUtc}>{conflict.titlePublic}: {formatUtc(conflict.startUtc)} - {formatUtc(conflict.endUtc)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="calendar-detail-panel">
          <h2>Item Detail</h2>
          {!selectedEvent && <p>Select an item from the board.</p>}
          {selectedEvent && (
            <>
              <h3>{selectedEvent.titlePublic}</h3>
              <p>{selectedEvent.summaryPublic ?? 'No summary'}</p>
              <p>{formatUtc(selectedEvent.startUtc)} - {formatUtc(selectedEvent.endUtc)}</p>
              <p>Type: {selectedEvent.itemType}</p>
              <p>Status: {selectedEvent.status}</p>
              {selectedEvent.taskState && <p>Task state: {selectedEvent.taskState}</p>}
              <div className="calendar-detail-actions">
                {selectedEvent.itemType === 'task' && (
                  <>
                    <button type="button" onClick={() => void completeCalendarTask(selectedEvent.eventId, { taskState: 'done' }).then(refresh).catch((err) => setError(readError(err)))}>Complete</button>
                    <button type="button" onClick={() => void completeCalendarTaskAndRunGraph(selectedEvent.eventId).then(refresh).catch((err) => setError(readError(err)))}>Complete + Run Graph</button>
                  </>
                )}
                <button type="button" onClick={() => void executeCalendarGraph(selectedEvent.eventId, { triggerType: 'manual' }).then(refresh).catch((err) => setError(readError(err)))}>Run Graph</button>
                <button type="button" onClick={() => void archiveCalendarItem(selectedEvent.eventId).then(refresh).catch((err) => setError(readError(err)))}>Archive</button>
              </div>
              <div className="calendar-share-panel">
                <h3>Graph editor</h3>
                <div className="calendar-inline-grid">
                  <select value={graphTemplateKey} onChange={(event) => applyTemplate(event.target.value)}>
                    <option value="">template</option>
                    {templates.map((template) => (
                      <option key={template.templateKey} value={template.templateKey}>{template.name}</option>
                    ))}
                  </select>
                  <select value={graphStatus} onChange={(event) => setGraphStatus(event.target.value as 'draft' | 'active' | 'archived')}>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <textarea rows={4} value={graphConfigJson} onChange={(event) => setGraphConfigJson(event.target.value)} placeholder="Graph config JSON" />
                <textarea rows={6} value={graphNodesJson} onChange={(event) => setGraphNodesJson(event.target.value)} placeholder="Nodes JSON" />
                <textarea rows={6} value={graphEdgesJson} onChange={(event) => setGraphEdgesJson(event.target.value)} placeholder="Edges JSON" />
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedEvent) return;
                    try {
                      const nodes = JSON.parse(graphNodesJson);
                      const edges = JSON.parse(graphEdgesJson);
                      void upsertCalendarGraph(selectedEvent.eventId, {
                        templateKey: graphTemplateKey || 'daily',
                        templateConfigJson: graphConfigJson,
                        status: graphStatus,
                        nodes,
                        edges
                      })
                        .then(() => getCalendarGraphExecutions(selectedEvent.eventId, 20))
                        .then((history) => setExecutions(history))
                        .catch((err) => setError(readError(err)));
                    } catch (err) {
                      setError(readError(err));
                    }
                  }}
                >
                  Save graph
                </button>
              </div>
              <div className="calendar-share-panel">
                <h3>Shared View + QR</h3>
                <button type="button" onClick={() => void createCalendarShare(selectedEvent.eventId, { mode: 'readonly', expiresInHours: 72 }).then((share) => {
                  setLatestShareCode(share.code);
                  return listCalendarShares(selectedEvent.eventId);
                }).then(setShares).catch((err) => setError(readError(err)))}>Create share</button>
                {shareUrl && (
                  <div className="calendar-qr-block">
                    <p>{shareUrl}</p>
                    <QRCodeSVG value={shareUrl} size={128} />
                  </div>
                )}
                <ul>
                  {shares.map((share) => (
                    <li key={share.linkId}>
                      <span>{share.label} ({share.isActive ? 'active' : 'revoked'})</span>
                      {share.isActive && <button type="button" onClick={() => void revokeCalendarShare(selectedEvent.eventId, share.linkId).then(() => listCalendarShares(selectedEvent.eventId)).then(setShares).catch((err) => setError(readError(err)))}>Revoke</button>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="calendar-graph-history">
                <h3>Graph executions</h3>
                <ul>
                  {executions.map((execution) => (
                    <li key={execution.executionId}>
                      <span>{execution.triggerType} / {execution.status}</span>
                      <span>{formatUtc(execution.createdUtc)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
