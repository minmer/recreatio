import { useEffect, useMemo, useState } from 'react';
import {
  attachCogitaLiveRevisionSession,
  createCogitaLiveRevisionSession,
  getCogitaLiveRevisionSessionsByRevision,
  getCogitaRevision,
  updateCogitaLiveRevisionSession,
  type CogitaLiveRevisionSession,
  type CogitaLiveRevisionSessionListItem
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';

export type LiveSessionsPageMode = 'search' | 'create' | 'detail' | 'edit';

function toPrettyJson(value: unknown) {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function parseSettings(raw: string): { value: Record<string, unknown> | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: 'Settings JSON must be an object.' };
    }
    return { value: parsed as Record<string, unknown>, error: null };
  } catch {
    return { value: null, error: 'Invalid settings JSON.' };
  }
}

export function CogitaRevisionLiveSessionsPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  revisionId,
  mode = 'search',
  sessionId,
  onCreated,
  onOpenSession,
  onRequestEdit,
  onRequestOverview
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
  revisionId: string;
  mode?: LiveSessionsPageMode;
  sessionId?: string;
  onCreated?: (sessionId: string) => void;
  onOpenSession?: (sessionId: string) => void;
  onRequestEdit?: (sessionId: string) => void;
  onRequestOverview?: (sessionId: string) => void;
}) {
  const [revisionName, setRevisionName] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [items, setItems] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [formTitle, setFormTitle] = useState('');
  const [formSessionMode, setFormSessionMode] = useState<'simultaneous' | 'asynchronous'>('simultaneous');
  const [formHostViewMode, setFormHostViewMode] = useState<'panel' | 'question' | 'score'>('panel');
  const [formParticipantViewMode, setFormParticipantViewMode] = useState<'question' | 'score' | 'fullscreen'>('question');
  const [formSettingsJson, setFormSettingsJson] = useState('');
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attachedSession, setAttachedSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [busyAction, setBusyAction] = useState<'none' | 'create' | 'save'>('none');
  const [message, setMessage] = useState<string | null>(null);

  const baseHref = `/#/cogita/library/${libraryId}`;

  const loadSessions = async () => {
    setStatus('loading');
    try {
      const sessions = await getCogitaLiveRevisionSessionsByRevision({ libraryId, revisionId });
      setItems(sessions);
      setStatus('ready');
    } catch {
      setItems([]);
      setStatus('error');
    }
  };

  useEffect(() => {
    getCogitaRevision({ libraryId, revisionId })
      .then((revision) => {
        setRevisionName(revision.name);
        if (!formTitle.trim()) {
          setFormTitle(revision.name);
        }
      })
      .catch(() => setRevisionName(revisionId));
  }, [formTitle, libraryId, revisionId]);

  useEffect(() => {
    void loadSessions();
  }, [libraryId, revisionId]);

  const selectedItem = useMemo(
    () => (sessionId ? items.find((item) => item.sessionId === sessionId) ?? null : null),
    [items, sessionId]
  );

  useEffect(() => {
    if (!sessionId || (mode !== 'detail' && mode !== 'edit')) {
      setAttachedSession(null);
      setDetailStatus('idle');
      return;
    }

    let canceled = false;
    setDetailStatus('loading');
    attachCogitaLiveRevisionSession({ libraryId, sessionId })
      .then((session) => {
        if (canceled) return;
        setAttachedSession(session);
        const settingsObject =
          session.sessionSettings && typeof session.sessionSettings === 'object'
            ? (session.sessionSettings as Record<string, unknown>)
            : null;
        const settingsTitle = typeof settingsObject?.title === 'string' ? settingsObject.title : null;
        setFormTitle(settingsTitle ?? selectedItem?.title ?? revisionName);
        setFormSessionMode((session.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous') as 'simultaneous' | 'asynchronous');
        setFormHostViewMode(
          (session.hostViewMode === 'question' || session.hostViewMode === 'score' ? session.hostViewMode : 'panel') as
            | 'panel'
            | 'question'
            | 'score'
        );
        setFormParticipantViewMode(
          (session.participantViewMode === 'score' || session.participantViewMode === 'fullscreen' ? session.participantViewMode : 'question') as
            | 'question'
            | 'score'
            | 'fullscreen'
        );
        setFormSettingsJson(toPrettyJson(session.sessionSettings));
        setDetailStatus('ready');
      })
      .catch(() => {
        if (canceled) return;
        setAttachedSession(null);
        setDetailStatus('error');
      });

    return () => {
      canceled = true;
    };
  }, [libraryId, mode, revisionName, selectedItem?.title, sessionId]);

  useEffect(() => {
    if (mode !== 'create') return;
    setMessage(null);
    setFormSessionMode('simultaneous');
    setFormHostViewMode('panel');
    setFormParticipantViewMode('question');
    setFormSettingsJson('');
    if (!formTitle.trim()) {
      setFormTitle(revisionName || copy.cogita.library.revision.live.hostKicker);
    }
  }, [copy.cogita.library.revision.live.hostKicker, formTitle, mode, revisionName]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => values.add(item.status));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.title ?? ''} ${item.sessionId} ${item.status}`.toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, statusFilter]);

  const createSession = async () => {
    const settings = parseSettings(formSettingsJson);
    if (settings.error) {
      setMessage(settings.error);
      return;
    }
    setBusyAction('create');
    setMessage(null);
    try {
      const created = await createCogitaLiveRevisionSession({
        libraryId,
        revisionId,
        title: formTitle.trim() || null,
        sessionMode: formSessionMode,
        hostViewMode: formHostViewMode,
        participantViewMode: formParticipantViewMode,
        sessionSettings: settings.value
      });
      await loadSessions();
      onCreated?.(created.sessionId);
    } catch {
      setMessage(copy.cogita.library.revision.live.createSessionError);
    } finally {
      setBusyAction('none');
    }
  };

  const saveSession = async () => {
    if (!sessionId) return;
    const settings = parseSettings(formSettingsJson);
    if (settings.error) {
      setMessage(settings.error);
      return;
    }
    setBusyAction('save');
    setMessage(null);
    try {
      await updateCogitaLiveRevisionSession({
        libraryId,
        revisionId,
        sessionId,
        title: formTitle.trim() || null,
        sessionMode: formSessionMode,
        hostViewMode: formHostViewMode,
        participantViewMode: formParticipantViewMode,
        sessionSettings: settings.value
      });
      await loadSessions();
      if (mode === 'edit') {
        onRequestOverview?.(sessionId);
      }
    } catch {
      setMessage(copy.cogita.library.revision.shareError);
    } finally {
      setBusyAction('none');
    }
  };

  const joinUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision/${encodeURIComponent(attachedSession.code)}`
      : '';
  const presenterUrl =
    attachedSession?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision-screen/${encodeURIComponent(attachedSession.code)}`
      : '';
  const hostUrl =
    attachedSession?.sessionId && attachedSession?.hostSecret && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/live-revision-host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}?sessionId=${encodeURIComponent(attachedSession.sessionId)}&hostSecret=${encodeURIComponent(attachedSession.hostSecret)}&code=${encodeURIComponent(attachedSession.code)}`
      : '';

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard" data-mode="list">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                {mode === 'search' ? (
                  <>
                    <div className="cogita-library-controls">
                      <div className="cogita-library-search">
                        <p className="cogita-user-kicker">{copy.cogita.workspace.infoMode.search}</p>
                        <div className="cogita-search-field">
                          <input
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                          />
                        </div>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.revision.live.statusLabel}</span>
                          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">{copy.cogita.library.infoTypes.any}</option>
                            {statusOptions.map((value) => (
                              <option key={`status:${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="cogita-card-count">
                      <span>{`${filtered.length} / ${items.length}`}</span>
                      <span>
                        {status === 'loading'
                          ? copy.cogita.library.collections.loading
                          : status === 'error'
                            ? copy.cogita.library.revision.shareError
                            : copy.cogita.library.collections.ready}
                      </span>
                    </div>

                    <div className="cogita-card-list" data-view="list">
                      {filtered.length ? (
                        filtered.map((item) => (
                          <div key={item.sessionId} className="cogita-card-item">
                            <a
                              className="cogita-card-select"
                              href={`${baseHref}/revisions/${encodeURIComponent(revisionId)}/live-sessions/${encodeURIComponent(item.sessionId)}`}
                              onClick={(event) => {
                                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                                  return;
                                }
                                event.preventDefault();
                                onOpenSession?.(item.sessionId);
                              }}
                            >
                              <div className="cogita-card-type">{item.status}</div>
                              <h3 className="cogita-card-title">{item.title || item.sessionId}</h3>
                              <p className="cogita-card-subtitle">
                                {copy.cogita.library.revision.live.participantsTitle}: {item.participantCount}
                              </p>
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="cogita-card-empty">
                          <p>{copy.cogita.library.revision.shareListEmpty}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                {(mode === 'create' || mode === 'edit') ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.workspace.revisions.live}</p>
                        <h3 className="cogita-detail-title">
                          {mode === 'create' ? copy.cogita.workspace.infoMode.create : copy.cogita.workspace.infoActions.edit}
                        </h3>
                      </div>
                    </div>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.nameLabel}</span>
                      <input value={formTitle} onChange={(event) => setFormTitle(event.target.value)} />
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.live.sessionModeLabel}</span>
                      <select value={formSessionMode} onChange={(event) => setFormSessionMode(event.target.value as 'simultaneous' | 'asynchronous')}>
                        <option value="simultaneous">{copy.cogita.library.revision.live.modeSimultaneous}</option>
                        <option value="asynchronous">{copy.cogita.library.revision.live.modeAsynchronous}</option>
                      </select>
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.live.hostViewModeLabel}</span>
                      <select value={formHostViewMode} onChange={(event) => setFormHostViewMode(event.target.value as 'panel' | 'question' | 'score')}>
                        <option value="panel">{copy.cogita.library.revision.live.hostViewPanel}</option>
                        <option value="question">{copy.cogita.library.revision.live.hostViewQuestion}</option>
                        <option value="score">{copy.cogita.library.revision.live.hostViewScore}</option>
                      </select>
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.live.participantViewModeLabel}</span>
                      <select
                        value={formParticipantViewMode}
                        onChange={(event) => setFormParticipantViewMode(event.target.value as 'question' | 'score' | 'fullscreen')}
                      >
                        <option value="question">{copy.cogita.library.revision.live.participantViewQuestion}</option>
                        <option value="score">{copy.cogita.library.revision.live.participantViewScore}</option>
                        <option value="fullscreen">{copy.cogita.library.revision.live.participantViewFullscreen}</option>
                      </select>
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.live.sessionSettingsLabel}</span>
                      <textarea value={formSettingsJson} onChange={(event) => setFormSettingsJson(event.target.value)} rows={6} />
                    </label>
                    {message ? <p className="cogita-form-error">{message}</p> : null}
                    <div className="cogita-form-actions">
                      {mode === 'create' ? (
                        <button type="button" className="cta" onClick={() => void createSession()} disabled={busyAction !== 'none'}>
                          {copy.cogita.workspace.infoMode.create}
                        </button>
                      ) : (
                        <button type="button" className="cta" onClick={() => void saveSession()} disabled={busyAction !== 'none' || !sessionId}>
                          {copy.cogita.workspace.infoActions.edit}
                        </button>
                      )}
                    </div>
                  </section>
                ) : null}

                {mode === 'detail' ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.workspace.infoActions.overview}</p>
                        <h3 className="cogita-detail-title">{selectedItem?.title || sessionId || ''}</h3>
                      </div>
                    </div>
                    {detailStatus === 'loading' ? <p>{copy.cogita.library.collections.loading}</p> : null}
                    {detailStatus === 'error' ? <p className="cogita-form-error">{copy.cogita.library.revision.shareError}</p> : null}
                    {detailStatus === 'ready' && attachedSession ? (
                      <>
                        <div className="cogita-info-tree">
                          <div className="cogita-info-tree-row">
                            <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.statusLabel}</div>
                            <div className="cogita-info-tree-value">{selectedItem?.status ?? attachedSession.status}</div>
                          </div>
                          <div className="cogita-info-tree-row">
                            <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.participantsTitle}</div>
                            <div className="cogita-info-tree-value">{attachedSession.participants.length}</div>
                          </div>
                          <div className="cogita-info-tree-row">
                            <div className="cogita-info-tree-key">{copy.cogita.library.revision.live.joinCodeLabel}</div>
                            <div className="cogita-info-tree-value">{attachedSession.code}</div>
                          </div>
                        </div>
                        <div className="cogita-form-actions">
                          <button type="button" className="ghost" onClick={() => onRequestEdit?.(attachedSession.sessionId)}>
                            {copy.cogita.workspace.infoActions.edit}
                          </button>
                          {hostUrl ? (
                            <a className="ghost" href={hostUrl}>
                              Host
                            </a>
                          ) : null}
                          {presenterUrl ? (
                            <a className="ghost" href={presenterUrl} target="_blank" rel="noreferrer">
                              Screen
                            </a>
                          ) : null}
                          {joinUrl ? (
                            <a className="ghost" href={joinUrl} target="_blank" rel="noreferrer">
                              Login
                            </a>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </section>
                ) : null}
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.workspace.revisions.live}</p>
                      <h3 className="cogita-detail-title">
                        {mode === 'search'
                          ? copy.cogita.workspace.infoMode.search
                          : mode === 'create'
                            ? copy.cogita.workspace.infoMode.create
                            : mode === 'edit'
                              ? copy.cogita.workspace.infoActions.edit
                              : copy.cogita.workspace.infoActions.overview}
                      </h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.revision.live.hostTitle}</p>
                    <p>{copy.cogita.library.revision.live.participantsTitle}</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
