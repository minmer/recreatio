import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createCogitaGame,
  createCogitaGameSession,
  getCogitaGame,
  getCogitaGameActionGraph,
  getCogitaGameLayouts,
  getCogitaGameSessions,
  getCogitaGames,
  getCogitaGameValues,
  type CogitaGameActionGraph,
  type CogitaGameLayout,
  type CogitaGameSessionSummary,
  type CogitaGameSummary,
  type CogitaGameValue,
  updateCogitaGame,
  upsertCogitaGameActionGraph,
  upsertCogitaGameLayout,
  upsertCogitaGameValues
} from '../../../../../lib/api';
import type { Copy } from '../../../../../content/types';

export type GameWorkspaceView =
  | 'search'
  | 'create'
  | 'overview'
  | 'edit'
  | 'groups'
  | 'values'
  | 'actions'
  | 'layouts'
  | 'live_sessions';

const VIEW_LABELS: Array<{ key: GameWorkspaceView; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'edit', label: 'Edit' },
  { key: 'groups', label: 'Groups' },
  { key: 'values', label: 'Values' },
  { key: 'actions', label: 'Actions' },
  { key: 'layouts', label: 'Layouts' },
  { key: 'live_sessions', label: 'Live Sessions' }
];

function parseJsonObject<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function toErrorText(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function normalizeLayoutRoleType(value: string | undefined | null): 'host' | 'groupLeader' | 'participant' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'host') return 'host';
  if (normalized === 'groupleader' || normalized === 'group_leader' || normalized === 'group-leader') return 'groupLeader';
  return 'participant';
}

export function CogitaGameWorkspace({
  copy,
  libraryId,
  gameId,
  view,
  onNavigate
}: {
  copy: Copy;
  libraryId: string;
  gameId?: string;
  view: GameWorkspaceView;
  onNavigate: (next: { gameId?: string; view?: GameWorkspaceView }) => void;
}) {
  const [games, setGames] = useState<CogitaGameSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loadingGames, setLoadingGames] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'solo' | 'group' | 'mixed'>('mixed');

  const [details, setDetails] = useState<{ name: string; mode: string; settingsText: string } | null>(null);
  const [values, setValues] = useState<CogitaGameValue[]>([]);
  const [actionGraph, setActionGraph] = useState<CogitaGameActionGraph | null>(null);
  const [actionNodesText, setActionNodesText] = useState('[]');
  const [actionEdgesText, setActionEdgesText] = useState('[]');
  const [layouts, setLayouts] = useState<CogitaGameLayout[]>([]);
  const [selectedLayoutRole, setSelectedLayoutRole] = useState<'host' | 'groupLeader' | 'participant'>('participant');
  const [layoutText, setLayoutText] = useState('{}');
  const [sessions, setSessions] = useState<CogitaGameSessionSummary[]>([]);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionGroupsText, setSessionGroupsText] = useState(
    JSON.stringify(
      [
        { groupKey: 'group-a', displayName: 'Group A', capacity: 8 },
        { groupKey: 'group-b', displayName: 'Group B', capacity: 8 }
      ],
      null,
      2
    )
  );
  const [sessionZonesText, setSessionZonesText] = useState(
    JSON.stringify(
      [{ zoneKey: 'zone-1', latitude: 52.2297, longitude: 21.0122, triggerRadiusM: 120, sourceType: 'manual' }],
      null,
      2
    )
  );

  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return games;
    return games.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [games, query]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingGames(true);
      try {
        const list = await getCogitaGames({ libraryId, limit: 400 });
        if (!cancelled) {
          setGames(list);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(toErrorText(error, 'Failed to load games.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingGames(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  useEffect(() => {
    if (!gameId) {
      setDetails(null);
      setValues([]);
      setActionGraph(null);
      setLayouts([]);
      setSessions([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const [game, gameValues, graph, gameLayouts, gameSessions] = await Promise.all([
          getCogitaGame({ libraryId, gameId }),
          getCogitaGameValues({ libraryId, gameId }),
          getCogitaGameActionGraph({ libraryId, gameId }),
          getCogitaGameLayouts({ libraryId, gameId }),
          getCogitaGameSessions({ libraryId, gameId, limit: 100 })
        ]);
        if (cancelled) return;

        setDetails({
          name: game.name,
          mode: game.mode,
          settingsText: JSON.stringify(game.settings ?? {}, null, 2)
        });
        setValues(gameValues);
        setActionGraph(graph);
        setActionNodesText(JSON.stringify(graph.nodes ?? [], null, 2));
        setActionEdgesText(JSON.stringify(graph.edges ?? [], null, 2));
        setLayouts(gameLayouts);
        setSessions(gameSessions);

        const selectedLayout = gameLayouts.find((item) => normalizeLayoutRoleType(item.roleType) === selectedLayoutRole);
        setLayoutText(JSON.stringify(selectedLayout?.layout ?? {}, null, 2));
      } catch (error) {
        if (!cancelled) {
          setStatus(toErrorText(error, 'Failed to load game details.'));
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [gameId, libraryId, selectedLayoutRole]);

  useEffect(() => {
    const selectedLayout = layouts.find((item) => normalizeLayoutRoleType(item.roleType) === selectedLayoutRole);
    setLayoutText(JSON.stringify(selectedLayout?.layout ?? {}, null, 2));
  }, [layouts, selectedLayoutRole]);

  const createGame = async () => {
    const normalized = newName.trim();
    if (!normalized) {
      setStatus('Name is required.');
      return;
    }
    setStatus(null);
    try {
      const created = await createCogitaGame({
        libraryId,
        name: normalized,
        mode: newMode,
        settings: {}
      });
      setGames((current) => [created, ...current]);
      setNewName('');
      onNavigate({ gameId: created.gameId, view: 'overview' });
    } catch (error) {
      setStatus(toErrorText(error, 'Failed to create game.'));
    }
  };

  const saveGame = async () => {
    if (!gameId || !details) return;
    const normalized = details.name.trim();
    if (!normalized) {
      setStatus('Game name cannot be empty.');
      return;
    }
    setStatus(null);
    try {
      const parsedSettings = parseJsonObject<Record<string, unknown>>(details.settingsText, {});
      const updated = await updateCogitaGame({
        libraryId,
        gameId,
        name: normalized,
        mode: details.mode,
        settings: parsedSettings
      });
      setGames((current) => current.map((item) => (item.gameId === updated.gameId ? updated : item)));
      setStatus('Game settings saved.');
    } catch (error) {
      setStatus(toErrorText(error, 'Failed to save game settings.'));
    }
  };

  const addValue = () => {
    setValues((current) => [
      ...current,
      {
        valueId: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        valueKey: 'points',
        name: 'Points',
        scopeType: 'participant',
        visibility: 'public',
        dataType: 'number',
        defaultValue: 0,
        constraints: null,
        isScore: true,
        updatedUtc: new Date().toISOString()
      }
    ]);
  };

  const saveValues = async () => {
    if (!gameId) return;
    setStatus(null);
    try {
      const saved = await upsertCogitaGameValues({
        libraryId,
        gameId,
        values: values.map((item) => ({
          valueId: item.valueId.startsWith('temp-') ? undefined : item.valueId,
          valueKey: item.valueKey,
          name: item.name,
          scopeType: item.scopeType,
          visibility: item.visibility,
          dataType: item.dataType,
          defaultValue: item.defaultValue,
          constraints: item.constraints ?? null,
          isScore: item.isScore
        }))
      });
      setValues(saved);
      setStatus('Values saved.');
    } catch (error) {
      setStatus(toErrorText(error, 'Failed to save values.'));
    }
  };

  const saveActionGraph = async (publish: boolean) => {
    if (!gameId) return;
    setStatus(null);
    try {
      const nodes = parseJsonObject<Array<Record<string, unknown>>>(actionNodesText, []).map((node) => ({
        nodeId: typeof node.nodeId === 'string' ? node.nodeId : undefined,
        nodeType: typeof node.nodeType === 'string' ? node.nodeType : 'trigger.onEnterZone',
        config: typeof node.config === 'object' && node.config ? (node.config as Record<string, unknown>) : {},
        positionX: Number(node.positionX ?? 0),
        positionY: Number(node.positionY ?? 0)
      }));
      const edges = parseJsonObject<Array<Record<string, unknown>>>(actionEdgesText, []).map((edge) => ({
        edgeId: typeof edge.edgeId === 'string' ? edge.edgeId : undefined,
        fromNodeId: String(edge.fromNodeId ?? ''),
        fromPort: typeof edge.fromPort === 'string' ? edge.fromPort : null,
        toNodeId: String(edge.toNodeId ?? ''),
        toPort: typeof edge.toPort === 'string' ? edge.toPort : null
      }));

      if (nodes.some((node) => !node.nodeType) || edges.some((edge) => !edge.fromNodeId || !edge.toNodeId)) {
        setStatus('Invalid action graph JSON. Check node and edge identifiers.');
        return;
      }

      const saved = await upsertCogitaGameActionGraph({
        libraryId,
        gameId,
        nodes,
        edges,
        publish
      });
      setActionGraph(saved);
      setActionNodesText(JSON.stringify(saved.nodes, null, 2));
      setActionEdgesText(JSON.stringify(saved.edges, null, 2));
      setStatus(publish ? 'Action graph published.' : 'Action graph saved as draft.');
    } catch (error) {
      setStatus(toErrorText(error, 'Failed to save action graph.'));
    }
  };

  const saveLayout = async () => {
    if (!gameId) return;
    setStatus(null);
    try {
      const parsed = parseJsonObject<Record<string, unknown>>(layoutText, {});
      const saved = await upsertCogitaGameLayout({
        libraryId,
        gameId,
        roleType: selectedLayoutRole,
        layout: parsed
      });
      setLayouts((current) => {
        const normalizedSavedRole = normalizeLayoutRoleType(saved.roleType);
        const withoutCurrent = current.filter((item) => normalizeLayoutRoleType(item.roleType) !== normalizedSavedRole);
        return [...withoutCurrent, saved].sort((a, b) =>
          normalizeLayoutRoleType(a.roleType).localeCompare(normalizeLayoutRoleType(b.roleType))
        );
      });
      setStatus('Layout saved.');
    } catch (error) {
      setStatus(toErrorText(error, 'Failed to save layout.'));
    }
  };

  const createSession = async () => {
    if (!gameId) return;
    setStatus(null);
    try {
      const parsedGroups = parseJsonObject<Array<{ groupKey: string; displayName: string; capacity?: number }>>(
        sessionGroupsText,
        []
      );
      const parsedZones = parseJsonObject<Array<{ zoneKey: string; latitude: number; longitude: number; triggerRadiusM: number; sourceType?: string }>>(
        sessionZonesText,
        []
      );

      const created = await createCogitaGameSession({
        libraryId,
        gameId,
        title: sessionTitle.trim() || null,
        sessionSettings: {},
        groups: parsedGroups,
        zones: parsedZones
      });

      const storageKey = `cogita.game.host.${created.sessionId}`;
      window.localStorage.setItem(storageKey, created.hostSecret);

      setSessions((current) => [
        {
          sessionId: created.sessionId,
          gameId,
          status: created.state.status,
          phase: created.state.phase,
          roundIndex: created.state.roundIndex,
          version: created.state.version,
          createdUtc: new Date().toISOString(),
          updatedUtc: new Date().toISOString()
        },
        ...current
      ]);

      const hostLink = `/#/cogita/game/host/${encodeURIComponent(libraryId)}/${encodeURIComponent(created.sessionId)}?hostSecret=${encodeURIComponent(created.hostSecret)}&code=${encodeURIComponent(created.code)}`;
      const joinLink = `/#/cogita/game/join/${encodeURIComponent(created.code)}`;
      setStatus(`Session created. Host: ${hostLink} Participant: ${joinLink}`);
    } catch (error) {
      setStatus(toErrorText(error, 'Failed to create session.'));
    }
  };

  const renderGameSelector = () => {
    return (
      <section className="cogita-section" style={{ display: 'grid', gap: '1rem' }}>
        <div className="cogita-panel" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="cogita-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games"
              style={{ maxWidth: 360 }}
            />
            <button type="button" className="cta" onClick={() => onNavigate({ view: 'create' })}>
              Create Game
            </button>
          </div>
          {loadingGames ? <p>Loading games...</p> : null}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {filteredGames.map((item) => (
              <button
                key={item.gameId}
                type="button"
                className="ghost"
                style={{ textAlign: 'left', padding: '0.65rem 0.8rem', border: '1px solid #d5d5d5', borderRadius: 8 }}
                onClick={() => onNavigate({ gameId: item.gameId, view: 'overview' })}
              >
                <strong>{item.name}</strong>
                <span style={{ marginLeft: 8, opacity: 0.7 }}>{item.mode}</span>
              </button>
            ))}
            {filteredGames.length === 0 && !loadingGames ? <p>No games found.</p> : null}
          </div>
        </div>
      </section>
    );
  };

  const renderCreate = () => {
    return (
      <section className="cogita-section" style={{ maxWidth: 720 }}>
        <div className="cogita-panel" style={{ display: 'grid', gap: '0.75rem' }}>
          <h3>Create Game</h3>
          <label>
            Name
            <input className="cogita-input" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="City Hunt" />
          </label>
          <label>
            Mode
            <select className="cogita-input" value={newMode} onChange={(event) => setNewMode(event.target.value as 'solo' | 'group' | 'mixed')}>
              <option value="mixed">Mixed</option>
              <option value="group">Group</option>
              <option value="solo">Solo</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="cta" onClick={createGame}>Create</button>
            <button type="button" className="ghost" onClick={() => onNavigate({ view: 'search' })}>Back</button>
          </div>
        </div>
      </section>
    );
  };

  const selectedGame = useMemo(() => games.find((item) => item.gameId === gameId) ?? null, [games, gameId]);

  const renderGameView = () => {
    if (!gameId || !selectedGame) {
      return renderGameSelector();
    }

    return (
      <section className="cogita-section" style={{ display: 'grid', gap: '1rem' }}>
        <div className="cogita-panel" style={{ display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{selectedGame.name}</h3>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {VIEW_LABELS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={view === item.key ? 'cta' : 'ghost'}
                  onClick={() => onNavigate({ gameId, view: item.key })}
                >
                  {item.label}
                </button>
              ))}
              <button type="button" className="ghost" onClick={() => onNavigate({ view: 'search' })}>All Games</button>
            </div>
          </div>

          {(view === 'overview' || view === 'edit') && details ? (
            <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 880 }}>
              <label>
                Name
                <input
                  className="cogita-input"
                  value={details.name}
                  onChange={(event) => setDetails((current) => (current ? { ...current, name: event.target.value } : current))}
                />
              </label>
              <label>
                Mode
                <select
                  className="cogita-input"
                  value={details.mode}
                  onChange={(event) => setDetails((current) => (current ? { ...current, mode: event.target.value } : current))}
                >
                  <option value="mixed">Mixed</option>
                  <option value="group">Group</option>
                  <option value="solo">Solo</option>
                </select>
              </label>
              <label>
                Settings JSON
                <textarea
                  className="cogita-input"
                  style={{ minHeight: 180, fontFamily: 'monospace' }}
                  value={details.settingsText}
                  onChange={(event) => setDetails((current) => (current ? { ...current, settingsText: event.target.value } : current))}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="cta" onClick={saveGame}>Save Game</button>
                <button type="button" className="ghost" onClick={() => onNavigate({ gameId, view: 'live_sessions' })}>Go To Live Sessions</button>
              </div>
            </div>
          ) : null}

          {view === 'groups' ? (
            <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 880 }}>
              <p>Session group template JSON</p>
              <textarea
                className="cogita-input"
                style={{ minHeight: 180, fontFamily: 'monospace' }}
                value={sessionGroupsText}
                onChange={(event) => setSessionGroupsText(event.target.value)}
              />
              <p>Session zone template JSON</p>
              <textarea
                className="cogita-input"
                style={{ minHeight: 180, fontFamily: 'monospace' }}
                value={sessionZonesText}
                onChange={(event) => setSessionZonesText(event.target.value)}
              />
              <p>These templates are used when creating a new live session for this game.</p>
            </div>
          ) : null}

          {view === 'values' ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {values.map((item) => (
                <div key={item.valueId} style={{ display: 'grid', gap: '0.45rem', border: '1px solid #e4e4e4', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <input
                      className="cogita-input"
                      value={item.valueKey}
                      onChange={(event) =>
                        setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, valueKey: event.target.value } : row)))
                      }
                      placeholder="value key"
                    />
                    <input
                      className="cogita-input"
                      value={item.name}
                      onChange={(event) =>
                        setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, name: event.target.value } : row)))
                      }
                      placeholder="display name"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                    <select
                      className="cogita-input"
                      value={item.scopeType}
                      onChange={(event) =>
                        setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, scopeType: event.target.value } : row)))
                      }
                    >
                      <option value="participant">participant</option>
                      <option value="group">group</option>
                      <option value="session">session</option>
                    </select>
                    <select
                      className="cogita-input"
                      value={item.visibility}
                      onChange={(event) =>
                        setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, visibility: event.target.value } : row)))
                      }
                    >
                      <option value="public">public</option>
                      <option value="group">group</option>
                      <option value="private">private</option>
                    </select>
                    <select
                      className="cogita-input"
                      value={item.dataType}
                      onChange={(event) =>
                        setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, dataType: event.target.value } : row)))
                      }
                    >
                      <option value="number">number</option>
                      <option value="bool">bool</option>
                      <option value="string">string</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={item.isScore}
                        onChange={(event) =>
                          setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, isScore: event.target.checked } : row)))
                        }
                      />
                      score
                    </label>
                  </div>
                  <textarea
                    className="cogita-input"
                    style={{ minHeight: 90, fontFamily: 'monospace' }}
                    value={JSON.stringify(item.defaultValue ?? 0, null, 2)}
                    onChange={(event) => {
                      const next = parseJsonObject<unknown>(event.target.value, item.defaultValue ?? 0);
                      setValues((current) => current.map((row) => (row.valueId === item.valueId ? { ...row, defaultValue: next } : row)));
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setValues((current) => current.filter((row) => row.valueId !== item.valueId))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ghost" onClick={addValue}>Add Value</button>
                <button type="button" className="cta" onClick={saveValues}>Save Values</button>
              </div>
            </div>
          ) : null}

          {view === 'actions' ? (
            <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 980 }}>
              <p>Nodes JSON</p>
              <textarea
                className="cogita-input"
                style={{ minHeight: 220, fontFamily: 'monospace' }}
                value={actionNodesText}
                onChange={(event) => setActionNodesText(event.target.value)}
              />
              <p>Edges JSON</p>
              <textarea
                className="cogita-input"
                style={{ minHeight: 220, fontFamily: 'monospace' }}
                value={actionEdgesText}
                onChange={(event) => setActionEdgesText(event.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="ghost" onClick={() => void saveActionGraph(false)}>Save Draft</button>
                <button type="button" className="cta" onClick={() => void saveActionGraph(true)}>Publish Graph</button>
              </div>
              {actionGraph ? <p>Current graph version: {actionGraph.version} ({actionGraph.status})</p> : null}
            </div>
          ) : null}

          {view === 'layouts' ? (
            <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 980 }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className={selectedLayoutRole === 'host' ? 'cta' : 'ghost'} onClick={() => setSelectedLayoutRole('host')}>Host</button>
                <button type="button" className={selectedLayoutRole === 'groupLeader' ? 'cta' : 'ghost'} onClick={() => setSelectedLayoutRole('groupLeader')}>Group Leader</button>
                <button type="button" className={selectedLayoutRole === 'participant' ? 'cta' : 'ghost'} onClick={() => setSelectedLayoutRole('participant')}>Participant</button>
              </div>
              <textarea
                className="cogita-input"
                style={{ minHeight: 260, fontFamily: 'monospace' }}
                value={layoutText}
                onChange={(event) => setLayoutText(event.target.value)}
              />
              <button type="button" className="cta" onClick={saveLayout}>Save Layout</button>
            </div>
          ) : null}

          {view === 'live_sessions' ? (
            <div style={{ display: 'grid', gap: '0.8rem', maxWidth: 980 }}>
              <label>
                Session title
                <input className="cogita-input" value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder="Saturday city run" />
              </label>
              <details>
                <summary>Groups JSON</summary>
                <textarea
                  className="cogita-input"
                  style={{ minHeight: 140, fontFamily: 'monospace', marginTop: 8 }}
                  value={sessionGroupsText}
                  onChange={(event) => setSessionGroupsText(event.target.value)}
                />
              </details>
              <details>
                <summary>Zones JSON</summary>
                <textarea
                  className="cogita-input"
                  style={{ minHeight: 140, fontFamily: 'monospace', marginTop: 8 }}
                  value={sessionZonesText}
                  onChange={(event) => setSessionZonesText(event.target.value)}
                />
              </details>
              <button type="button" className="cta" onClick={createSession}>Create Live Session</button>

              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {sessions.map((item) => {
                  const storageKey = `cogita.game.host.${item.sessionId}`;
                  const hostSecret = window.localStorage.getItem(storageKey);
                  const hostLink = hostSecret
                    ? `/#/cogita/game/host/${encodeURIComponent(libraryId)}/${encodeURIComponent(item.sessionId)}?hostSecret=${encodeURIComponent(hostSecret)}`
                    : null;
                  return (
                    <div key={item.sessionId} style={{ border: '1px solid #e4e4e4', borderRadius: 8, padding: '0.7rem' }}>
                      <div><strong>{item.sessionId}</strong></div>
                      <div>Status: {item.status} | Phase: {item.phase} | Round: {item.roundIndex}</div>
                      {hostLink ? (
                        <a href={hostLink}>Open host console</a>
                      ) : (
                        <span style={{ opacity: 0.7 }}>Host secret not available locally for this session.</span>
                      )}
                    </div>
                  );
                })}
                {sessions.length === 0 ? <p>No sessions yet.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  };

  return (
    <>
      <section className="cogita-section" style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <header className="cogita-library-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h1>{copy.cogita.workspace.targets.games}</h1>
            <p>{copy.cogita.workspace.path.currentRoute}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className={view === 'search' ? 'cta' : 'ghost'} onClick={() => onNavigate({ view: 'search' })}>Search</button>
            <button type="button" className={view === 'create' ? 'cta' : 'ghost'} onClick={() => onNavigate({ view: 'create' })}>Create</button>
          </div>
        </header>
      </section>

      {view === 'create' && !gameId ? renderCreate() : renderGameView()}

      {status ? (
        <section className="cogita-section" style={{ maxWidth: 1280, margin: '0.5rem auto 0' }}>
          <p className="cogita-help">{status}</p>
        </section>
      ) : null}
    </>
  );
}
