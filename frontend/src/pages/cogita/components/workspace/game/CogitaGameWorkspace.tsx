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
import { CogitaGameActions } from './CogitaGameActions';
import { CogitaGameCreate } from './CogitaGameCreate';
import { CogitaGameEdit } from './CogitaGameEdit';
import { CogitaGameLayout } from './CogitaGameLayout';
import { CogitaGameLiveSessions } from './CogitaGameLiveSessions';
import { CogitaGameOverview } from './CogitaGameOverview';
import { CogitaGameParticipants } from './CogitaGameParticipants';
import { CogitaGameSearch } from './CogitaGameSearch';
import { CogitaGameValues } from './CogitaGameValues';

export type GameWorkspaceView =
  | 'search'
  | 'create'
  | 'overview'
  | 'edit'
  | 'participants'
  | 'groups'
  | 'values'
  | 'actions'
  | 'layout'
  | 'layouts'
  | 'live_sessions';

type CanonicalGameWorkspaceView =
  | 'search'
  | 'create'
  | 'overview'
  | 'edit'
  | 'participants'
  | 'values'
  | 'actions'
  | 'layout'
  | 'live_sessions';

const GAME_VIEW_LABELS: Array<{ key: CanonicalGameWorkspaceView; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'edit', label: 'Edit' },
  { key: 'participants', label: 'Participants' },
  { key: 'values', label: 'Values' },
  { key: 'actions', label: 'Actions' },
  { key: 'layout', label: 'Layout' },
  { key: 'live_sessions', label: 'Live Sessions' }
];

function normalizeGameWorkspaceView(view: GameWorkspaceView | undefined | null): CanonicalGameWorkspaceView {
  if (!view) return 'search';
  if (view === 'groups') return 'participants';
  if (view === 'layouts') return 'layout';
  return view;
}

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

  const normalizedView = useMemo(() => normalizeGameWorkspaceView(view), [view]);

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

  const selectedGame = useMemo(() => games.find((item) => item.gameId === gameId) ?? null, [games, gameId]);
  const shouldRenderCreate = normalizedView === 'create' && !gameId;
  const shouldRenderSearch = normalizedView === 'search' || !gameId || !selectedGame;

  const renderSelectedGameSection = () => {
    if (!gameId || !selectedGame) {
      return null;
    }

    if (normalizedView === 'overview') {
      return (
        <CogitaGameOverview
          selectedGame={selectedGame}
          details={details}
          sessions={sessions}
          onOpenEdit={() => onNavigate({ gameId, view: 'edit' })}
          onOpenParticipants={() => onNavigate({ gameId, view: 'participants' })}
          onOpenValues={() => onNavigate({ gameId, view: 'values' })}
          onOpenActions={() => onNavigate({ gameId, view: 'actions' })}
          onOpenLayout={() => onNavigate({ gameId, view: 'layout' })}
          onOpenLiveSessions={() => onNavigate({ gameId, view: 'live_sessions' })}
        />
      );
    }

    if (normalizedView === 'edit') {
      return (
        <CogitaGameEdit
          details={details}
          onDetailsChange={setDetails}
          onSave={() => void saveGame()}
          onGoToLiveSessions={() => onNavigate({ gameId, view: 'live_sessions' })}
        />
      );
    }

    if (normalizedView === 'participants') {
      return (
        <CogitaGameParticipants
          sessionGroupsText={sessionGroupsText}
          sessionZonesText={sessionZonesText}
          onSessionGroupsTextChange={setSessionGroupsText}
          onSessionZonesTextChange={setSessionZonesText}
        />
      );
    }

    if (normalizedView === 'values') {
      return (
        <CogitaGameValues
          values={values}
          setValues={setValues}
          onAddValue={addValue}
          onSaveValues={() => void saveValues()}
        />
      );
    }

    if (normalizedView === 'actions') {
      return (
        <CogitaGameActions
          actionNodesText={actionNodesText}
          actionEdgesText={actionEdgesText}
          actionGraph={actionGraph}
          onActionNodesTextChange={setActionNodesText}
          onActionEdgesTextChange={setActionEdgesText}
          onSaveDraft={() => void saveActionGraph(false)}
          onPublish={() => void saveActionGraph(true)}
        />
      );
    }

    if (normalizedView === 'layout') {
      return (
        <CogitaGameLayout
          selectedLayoutRole={selectedLayoutRole}
          layoutText={layoutText}
          onSelectedLayoutRoleChange={setSelectedLayoutRole}
          onLayoutTextChange={setLayoutText}
          onSaveLayout={() => void saveLayout()}
        />
      );
    }

    if (normalizedView === 'live_sessions') {
      return (
        <CogitaGameLiveSessions
          libraryId={libraryId}
          sessionTitle={sessionTitle}
          sessionGroupsText={sessionGroupsText}
          sessionZonesText={sessionZonesText}
          sessions={sessions}
          onSessionTitleChange={setSessionTitle}
          onSessionGroupsTextChange={setSessionGroupsText}
          onSessionZonesTextChange={setSessionZonesText}
          onCreateSession={() => void createSession()}
        />
      );
    }

    return null;
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
            <button type="button" className={normalizedView === 'search' ? 'cta' : 'ghost'} onClick={() => onNavigate({ view: 'search' })}>Search</button>
            <button type="button" className={normalizedView === 'create' && !gameId ? 'cta' : 'ghost'} onClick={() => onNavigate({ view: 'create' })}>Create</button>
          </div>
        </header>
      </section>

      {shouldRenderCreate ? (
        <CogitaGameCreate
          name={newName}
          mode={newMode}
          onNameChange={setNewName}
          onModeChange={setNewMode}
          onCreate={() => void createGame()}
          onBack={() => onNavigate({ view: 'search' })}
        />
      ) : null}

      {shouldRenderSearch ? (
        <CogitaGameSearch
          query={query}
          loadingGames={loadingGames}
          filteredGames={filteredGames}
          onQueryChange={setQuery}
          onCreate={() => onNavigate({ view: 'create' })}
          onSelectGame={(selectedGameId) => onNavigate({ gameId: selectedGameId, view: 'overview' })}
        />
      ) : null}

      {!shouldRenderCreate && !shouldRenderSearch && selectedGame ? (
        <section className="cogita-section" style={{ display: 'grid', gap: '1rem' }}>
          <div className="cogita-panel" style={{ display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{selectedGame.name}</h3>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {GAME_VIEW_LABELS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={normalizedView === item.key ? 'cta' : 'ghost'}
                    onClick={() => onNavigate({ gameId, view: item.key })}
                  >
                    {item.label}
                  </button>
                ))}
                <button type="button" className="ghost" onClick={() => onNavigate({ view: 'search' })}>All Games</button>
              </div>
            </div>

            {renderSelectedGameSection()}
          </div>
        </section>
      ) : null}

      {status ? (
        <section className="cogita-section" style={{ maxWidth: 1280, margin: '0.5rem auto 0' }}>
          <p className="cogita-help">{status}</p>
        </section>
      ) : null}
    </>
  );
}
