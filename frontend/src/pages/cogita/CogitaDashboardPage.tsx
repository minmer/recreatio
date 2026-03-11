import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCogitaDashboardPreferences,
  getCogitaLibraries,
  getCogitaLibraryStats,
  updateCogitaDashboardPreferences,
  type CogitaLibrary
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaShell } from './CogitaShell';

type DashboardModuleKey =
  | 'quick-actions'
  | 'running-sessions'
  | 'recent-libraries'
  | 'aggregate-stats'
  | 'pinned-revisions';

type DashboardRunMode = 'solo' | 'shared' | 'group-async' | 'group-sync';
type RecentRevisionEntry = {
  libraryId: string;
  runId: string;
  mode: DashboardRunMode;
  title?: string | null;
  updatedUtc?: string | null;
};

const RECENT_REVISIONS_STORAGE_KEY = 'cogita.revision.recent';

type DashboardPrefs = {
  version: 1;
  enabled: DashboardModuleKey[];
  order: DashboardModuleKey[];
  pinnedRevisions: Array<{
    libraryId: string;
    runId: string;
    label: string;
    mode: DashboardRunMode;
  }>;
};

const DASHBOARD_PREFS_VERSION = 'v1';
const DASHBOARD_PREFS_FALLBACK: DashboardPrefs = {
  version: 1,
  enabled: ['quick-actions', 'running-sessions', 'recent-libraries', 'aggregate-stats', 'pinned-revisions'],
  order: ['quick-actions', 'running-sessions', 'aggregate-stats', 'recent-libraries', 'pinned-revisions'],
  pinnedRevisions: []
};

const MODULE_META: Record<DashboardModuleKey, { title: string; subtitle: string }> = {
  'quick-actions': {
    title: 'Quick run launcher',
    subtitle: 'Start workspace and revision flows immediately.'
  },
  'running-sessions': {
    title: 'Running session shortcuts',
    subtitle: 'Jump to active session surfaces.'
  },
  'recent-libraries': {
    title: 'Recent libraries',
    subtitle: 'Continue from your latest structural context.'
  },
  'aggregate-stats': {
    title: 'Large aggregate statistics',
    subtitle: 'Cross-library item, collection, and language totals.'
  },
  'pinned-revisions': {
    title: 'Pinned revisions',
    subtitle: 'Your always-ready run shortcuts.'
  }
};

function normalizeDashboardRunMode(raw: unknown): DashboardRunMode | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'group_async' || value === 'group-async') return 'group-async';
  if (value === 'group_sync' || value === 'group-sync') return 'group-sync';
  if (value === 'shared' || value === 'shared-run') return 'shared';
  if (value === 'solo') return 'solo';
  return null;
}

function normalizePrefs(raw: unknown): DashboardPrefs {
  if (!raw || typeof raw !== 'object') {
    return DASHBOARD_PREFS_FALLBACK;
  }
  const source = raw as Partial<DashboardPrefs>;
  const enabled = Array.isArray(source.enabled)
    ? source.enabled.filter((value): value is DashboardModuleKey => value in MODULE_META)
    : DASHBOARD_PREFS_FALLBACK.enabled;
  const orderSource = Array.isArray(source.order)
    ? source.order.filter((value): value is DashboardModuleKey => value in MODULE_META)
    : DASHBOARD_PREFS_FALLBACK.order;
  const order = Array.from(new Set([...orderSource, ...Object.keys(MODULE_META) as DashboardModuleKey[]]));
  const pinnedRaw = Array.isArray(source.pinnedRevisions) ? source.pinnedRevisions : [];
  const pinnedRevisions = pinnedRaw
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const item = entry as DashboardPrefs['pinnedRevisions'][number];
      const mode = normalizeDashboardRunMode((entry as { mode?: unknown }).mode) ?? 'solo';
      return {
        libraryId: String(item.libraryId ?? '').trim(),
        runId: String(item.runId ?? '').trim(),
        label: String(item.label ?? '').trim(),
        mode
      };
    })
    .filter((entry) => entry.libraryId.length > 0 && entry.runId.length > 0);

  return {
    version: 1,
    enabled: enabled.length > 0 ? enabled : DASHBOARD_PREFS_FALLBACK.enabled,
    order,
    pinnedRevisions
  };
}

function toPersistedJson(prefs: DashboardPrefs) {
  return JSON.stringify({
    version: prefs.version,
    enabled: prefs.enabled,
    order: prefs.order,
    pinnedRevisions: prefs.pinnedRevisions
  });
}

export function CogitaDashboardPage({
  copy,
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
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<CogitaLibrary[]>([]);
  const [statsByLibrary, setStatsByLibrary] = useState<Record<string, {
    totalInfos: number;
    totalCollections: number;
    totalLanguages: number;
    totalWords: number;
    totalSentences: number;
    totalTopics: number;
  }>>({});
  const [prefs, setPrefs] = useState<DashboardPrefs>(DASHBOARD_PREFS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [newPinnedLibraryId, setNewPinnedLibraryId] = useState('');
  const [newPinnedRunId, setNewPinnedRunId] = useState('');
  const [newPinnedLabel, setNewPinnedLabel] = useState('');
  const [newPinnedMode, setNewPinnedMode] = useState<DashboardRunMode>('solo');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [storedPrefs, loadedLibraries] = await Promise.all([
          getCogitaDashboardPreferences(),
          getCogitaLibraries()
        ]);
        if (cancelled) return;

        let parsedPrefs = DASHBOARD_PREFS_FALLBACK;
        try {
          const parsed = JSON.parse(storedPrefs.preferencesJson ?? '{}');
          parsedPrefs = normalizePrefs(parsed);
        } catch {
          parsedPrefs = DASHBOARD_PREFS_FALLBACK;
        }
        setPrefs(parsedPrefs);
        setLibraries(loadedLibraries);
        if (loadedLibraries.length > 0) {
          const statsRows = await Promise.all(
            loadedLibraries.map(async (library) => {
              try {
                const stats = await getCogitaLibraryStats(library.libraryId);
                return [library.libraryId, stats] as const;
              } catch {
                return null;
              }
            })
          );
          if (cancelled) return;
          const mapped: Record<string, {
            totalInfos: number;
            totalCollections: number;
            totalLanguages: number;
            totalWords: number;
            totalSentences: number;
            totalTopics: number;
          }> = {};
          for (const row of statsRows) {
            if (!row) continue;
            mapped[row[0]] = row[1];
          }
          setStatsByLibrary(mapped);
        } else {
          setStatsByLibrary({});
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load Cogita dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePreferences = useCallback(async (nextPrefs: DashboardPrefs) => {
    setSaving(true);
    setError(null);
    try {
      await updateCogitaDashboardPreferences({
        layoutVersion: DASHBOARD_PREFS_VERSION,
        preferencesJson: toPersistedJson(nextPrefs)
      });
      setPrefs(nextPrefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard preferences.');
    } finally {
      setSaving(false);
    }
  }, []);

  const orderedVisibleModules = useMemo(() => {
    const enabled = new Set(prefs.enabled);
    return prefs.order.filter((key) => enabled.has(key));
  }, [prefs.enabled, prefs.order]);

  const aggregates = useMemo(() => {
    const rows = Object.values(statsByLibrary);
    return {
      libraries: libraries.length,
      items: rows.reduce((sum, row) => sum + row.totalInfos, 0),
      collections: rows.reduce((sum, row) => sum + row.totalCollections, 0),
      languages: rows.reduce((sum, row) => sum + row.totalLanguages, 0),
      words: rows.reduce((sum, row) => sum + row.totalWords, 0),
      sentences: rows.reduce((sum, row) => sum + row.totalSentences, 0),
      topics: rows.reduce((sum, row) => sum + row.totalTopics, 0)
    };
  }, [libraries.length, statsByLibrary]);

  const lastWorkspacePath = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('cogita.workspace.last.path');
  }, []);

  const defaultLibraryId = libraries[0]?.libraryId ?? '';
  const recentRevisions = useMemo<RecentRevisionEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(RECENT_REVISIONS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const row = item as Record<string, unknown>;
          const mode = normalizeDashboardRunMode(row.mode);
          return {
            libraryId: String(row.libraryId ?? '').trim(),
            runId: String(row.runId ?? '').trim(),
            mode,
            title: row.title ? String(row.title) : null,
            updatedUtc: row.updatedUtc ? String(row.updatedUtc) : null
          };
        })
        .filter((item): item is RecentRevisionEntry =>
          Boolean(item.mode) && item.libraryId.length > 0 && item.runId.length > 0)
        .slice(0, 8);
    } catch {
      return [];
    }
  }, [libraries.length]);

  const toggleModule = (key: DashboardModuleKey) => {
    const nextEnabled = prefs.enabled.includes(key)
      ? prefs.enabled.filter((item) => item !== key)
      : prefs.enabled.concat(key);
    void savePreferences({
      ...prefs,
      enabled: nextEnabled
    });
  };

  const moveModule = (key: DashboardModuleKey, direction: -1 | 1) => {
    const currentIndex = prefs.order.indexOf(key);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= prefs.order.length) return;
    const nextOrder = prefs.order.slice();
    const swap = nextOrder[nextIndex];
    nextOrder[nextIndex] = key;
    nextOrder[currentIndex] = swap;
    void savePreferences({
      ...prefs,
      order: nextOrder
    });
  };

  const addPinnedRevision = () => {
    const libraryId = newPinnedLibraryId.trim();
    const runId = newPinnedRunId.trim();
    if (!libraryId || !runId) return;
    const label = newPinnedLabel.trim() || `${newPinnedMode} · ${runId}`;
    const next: DashboardPrefs = {
      ...prefs,
      pinnedRevisions: prefs.pinnedRevisions.concat({
        libraryId,
        runId,
        label,
        mode: newPinnedMode
      })
    };
    void savePreferences(next);
    setNewPinnedLibraryId('');
    setNewPinnedRunId('');
    setNewPinnedLabel('');
    setNewPinnedMode('solo');
  };

  const removePinnedRevision = (index: number) => {
    const next: DashboardPrefs = {
      ...prefs,
      pinnedRevisions: prefs.pinnedRevisions.filter((_, idx) => idx !== index)
    };
    void savePreferences(next);
  };

  const openRun = (mode: DashboardRunMode, libraryId: string, runId: string) => {
    const routeMode = mode === 'shared' ? 'shared' : mode;
    navigate(`/cogita/revision/${routeMode}/${encodeURIComponent(libraryId)}/${encodeURIComponent(runId)}`);
  };

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
      headerExtra={(
        <button type="button" className="ghost" onClick={() => setManagerOpen((value) => !value)}>
          {managerOpen ? 'Close modules' : 'Manage modules'}
        </button>
      )}
    >
      <section className="cogita-section" style={{ maxWidth: 1260, margin: '0 auto', width: '100%' }}>
        <header className="cogita-library-header" style={{ marginBottom: '1rem' }}>
          <div>
            <p className="cogita-user-kicker">Cogita Dashboard</p>
            <h1 className="cogita-library-title" style={{ marginBottom: '0.35rem' }}>Logged Home</h1>
            <p className="cogita-library-subtitle">
              Configurable operational home with continuation shortcuts and aggregate knowledge statistics.
            </p>
          </div>
        </header>

        {error ? <p className="cogita-form-error">{error}</p> : null}
        {loading ? <p className="cogita-library-subtitle">Loading dashboard...</p> : null}

        {managerOpen ? (
          <article className="cogita-pane" style={{ marginBottom: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>Dashboard Module Manager</h2>
            <p className="cogita-library-subtitle">
              Enable/disable modules and set display order. Preferences are persisted in backend storage.
            </p>
            <div className="cogita-card-list" data-view="list">
              {prefs.order.map((key, index) => (
                <div key={key} className="cogita-card-item">
                  <div>
                    <p className="cogita-card-type">{MODULE_META[key].title}</p>
                    <h3 className="cogita-card-title">{MODULE_META[key].subtitle}</h3>
                  </div>
                  <div className="cogita-card-actions">
                    <button type="button" className="ghost" onClick={() => toggleModule(key)} disabled={saving}>
                      {prefs.enabled.includes(key) ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="ghost" onClick={() => moveModule(key, -1)} disabled={saving || index === 0}>
                      Up
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => moveModule(key, 1)}
                      disabled={saving || index === prefs.order.length - 1}
                    >
                      Down
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        <div className="cogita-library-grid">
          {orderedVisibleModules.includes('quick-actions') ? (
            <article className="cogita-pane">
              <p className="cogita-user-kicker">{MODULE_META['quick-actions'].title}</p>
              <div className="cogita-card-actions">
                <button type="button" className="ghost" onClick={() => navigate('/cogita/workspace')}>
                  Workspace home
                </button>
                {defaultLibraryId ? (
                  <button type="button" className="ghost" onClick={() => navigate(`/cogita/workspace/libraries/${encodeURIComponent(defaultLibraryId)}`)}>
                    First library
                  </button>
                ) : null}
                {defaultLibraryId ? (
                  <button type="button" className="ghost" onClick={() => openRun('solo', defaultLibraryId, 'new')}>
                    Start solo run
                  </button>
                ) : null}
                {defaultLibraryId ? (
                  <button type="button" className="ghost" onClick={() => openRun('shared', defaultLibraryId, 'new')}>
                    Start shared run
                  </button>
                ) : null}
                {defaultLibraryId ? (
                  <button type="button" className="ghost" onClick={() => openRun('group-sync', defaultLibraryId, 'new')}>
                    Start group sync run
                  </button>
                ) : null}
                {defaultLibraryId ? (
                  <button type="button" className="ghost" onClick={() => openRun('group-async', defaultLibraryId, 'new')}>
                    Start group async run
                  </button>
                ) : null}
                {defaultLibraryId ? (
                  <button type="button" className="ghost" onClick={() => navigate(`/cogita/live/sessions/${encodeURIComponent(defaultLibraryId)}`)}>
                    Live sessions
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    navigate(
                      defaultLibraryId
                        ? `/cogita/workspace/libraries/${encodeURIComponent(defaultLibraryId)}/storyboards`
                        : '/cogita/workspace'
                    )
                  }
                >
                  Storyboard mode
                </button>
                <button type="button" className="ghost" onClick={() => navigate(defaultLibraryId ? `/cogita/writing/${encodeURIComponent(defaultLibraryId)}` : '/cogita/writing')}>
                  Writing mode
                </button>
                {lastWorkspacePath ? (
                  <button type="button" className="ghost" onClick={() => navigate(lastWorkspacePath)}>
                    Continue last change
                  </button>
                ) : null}
              </div>
              {recentRevisions.length > 0 ? (
                <div style={{ marginTop: '0.8rem' }}>
                  <p className="cogita-card-type" style={{ marginBottom: '0.35rem' }}>Last revisions</p>
                  <div className="cogita-card-actions" style={{ flexWrap: 'wrap' }}>
                    {recentRevisions.slice(0, 4).map((item) => (
                      <button
                        key={`${item.mode}:${item.libraryId}:${item.runId}`}
                        type="button"
                        className="ghost"
                        onClick={() => openRun(item.mode, item.libraryId, item.runId)}
                        title={item.title ?? item.runId}
                      >
                        {item.title?.trim() || `${item.mode} · ${item.runId.slice(0, 8)}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}

          {orderedVisibleModules.includes('running-sessions') ? (
            <article className="cogita-pane">
              <p className="cogita-user-kicker">{MODULE_META['running-sessions'].title}</p>
              {libraries.length === 0 ? <p className="cogita-library-subtitle">No libraries available.</p> : null}
              {libraries.slice(0, 8).map((library) => (
                <div key={library.libraryId} className="cogita-card-actions" style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{library.name}</span>
                  <button type="button" className="ghost" onClick={() => navigate(`/cogita/live/sessions/${encodeURIComponent(library.libraryId)}`)}>
                    Open sessions
                  </button>
                </div>
              ))}
            </article>
          ) : null}

          {orderedVisibleModules.includes('aggregate-stats') ? (
            <article className="cogita-pane" style={{ gridColumn: '1 / -1' }}>
              <p className="cogita-user-kicker">{MODULE_META['aggregate-stats'].title}</p>
              <div className="cogita-card-list" data-view="list">
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Libraries</div>
                  <h3 className="cogita-card-title">{aggregates.libraries}</h3>
                </div>
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Knowledge Items</div>
                  <h3 className="cogita-card-title">{aggregates.items}</h3>
                </div>
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Collections</div>
                  <h3 className="cogita-card-title">{aggregates.collections}</h3>
                </div>
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Languages</div>
                  <h3 className="cogita-card-title">{aggregates.languages}</h3>
                </div>
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Words</div>
                  <h3 className="cogita-card-title">{aggregates.words}</h3>
                </div>
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Sentences</div>
                  <h3 className="cogita-card-title">{aggregates.sentences}</h3>
                </div>
                <div className="cogita-card-item">
                  <div className="cogita-card-type">Topics</div>
                  <h3 className="cogita-card-title">{aggregates.topics}</h3>
                </div>
              </div>
            </article>
          ) : null}

          {orderedVisibleModules.includes('recent-libraries') ? (
            <article className="cogita-pane">
              <p className="cogita-user-kicker">{MODULE_META['recent-libraries'].title}</p>
              {libraries.length === 0 ? <p className="cogita-library-subtitle">No libraries available.</p> : null}
              {libraries.map((library) => (
                <div key={library.libraryId} className="cogita-card-actions" style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{library.name}</span>
                  <button type="button" className="ghost" onClick={() => navigate(`/cogita/workspace/libraries/${encodeURIComponent(library.libraryId)}`)}>
                    Open
                  </button>
                </div>
              ))}
            </article>
          ) : null}

          {orderedVisibleModules.includes('pinned-revisions') ? (
            <article className="cogita-pane">
              <p className="cogita-user-kicker">{MODULE_META['pinned-revisions'].title}</p>
              <div className="cogita-form-grid">
                <label className="cogita-field full">
                  <span>Library ID</span>
                  <input
                    type="text"
                    value={newPinnedLibraryId}
                    onChange={(event) => setNewPinnedLibraryId(event.target.value)}
                    placeholder={defaultLibraryId || 'library-guid'}
                  />
                </label>
                <label className="cogita-field full">
                  <span>Run ID</span>
                  <input
                    type="text"
                    value={newPinnedRunId}
                    onChange={(event) => setNewPinnedRunId(event.target.value)}
                    placeholder="run-guid or new"
                  />
                </label>
                <label className="cogita-field full">
                  <span>Label</span>
                  <input
                    type="text"
                    value={newPinnedLabel}
                    onChange={(event) => setNewPinnedLabel(event.target.value)}
                    placeholder="Optional title"
                  />
                </label>
                <label className="cogita-field full">
                  <span>Mode</span>
                  <select value={newPinnedMode} onChange={(event) => setNewPinnedMode(event.target.value as DashboardRunMode)}>
                    <option value="solo">solo</option>
                    <option value="shared">shared</option>
                    <option value="group-async">group-async</option>
                    <option value="group-sync">group-sync</option>
                  </select>
                </label>
                <div className="cogita-form-actions full">
                  <button type="button" className="ghost" onClick={addPinnedRevision} disabled={saving}>
                    Add pinned revision
                  </button>
                </div>
              </div>
              {prefs.pinnedRevisions.length === 0 ? (
                <p className="cogita-library-subtitle">No pinned revisions yet.</p>
              ) : (
                <div className="cogita-card-list" data-view="list">
                  {prefs.pinnedRevisions.map((item, index) => (
                    <div key={`${item.libraryId}:${item.runId}:${index}`} className="cogita-card-item">
                      <div>
                        <p className="cogita-card-type">{item.mode}</p>
                        <h3 className="cogita-card-title">{item.label || item.runId}</h3>
                        <p className="cogita-card-subtitle">{item.libraryId}</p>
                      </div>
                      <div className="cogita-card-actions">
                        <button type="button" className="ghost" onClick={() => openRun(item.mode, item.libraryId, item.runId)}>
                          Open
                        </button>
                        <button type="button" className="ghost" onClick={() => removePinnedRevision(index)} disabled={saving}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ) : null}
        </div>
      </section>
    </CogitaShell>
  );
}
