import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, type Connection, type Edge } from 'reactflow';
import { useLocation, useNavigate } from 'react-router-dom';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import {
  activateCogitaDependencyGraph,
  createCogitaDependencyGraph,
  deleteCogitaDependencyGraph,
  getCogitaDependencyGraph,
  getCogitaDependencyGraphs,
  previewCogitaDependencyGraph,
  saveCogitaDependencyGraph,
  updateCogitaDependencyGraph,
  type CogitaDependencyGraphPreview,
  type CogitaDependencyGraphSummary,
  getCogitaInfoDetail,
  type CogitaInfoSearchResult
} from '../../../lib/api';
import { buildQuoteFragmentTree } from '../../../cogita/revision/quote';

type GraphNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; nodeType: string; itemType: string; itemId?: string | null; infoType?: string | null };
};

function toNodeLabel(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'label' in payload) {
    const value = (payload as { label?: unknown }).label;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

export function CogitaDependencyGraphPage({
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
  mode = 'overview'
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
  mode?: 'search' | 'create' | 'overview' | 'edit';
}) {
  const baseHref = `/#/cogita/library/${libraryId}`;
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = mode === 'edit' || mode === 'create';
  const isSearchMode = mode === 'search';

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CogitaDependencyGraphPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [quotePreview, setQuotePreview] = useState<{ title: string; fragments: Array<{ id: string; text: string; depth: number }> } | null>(null);

  const [graphs, setGraphs] = useState<CogitaDependencyGraphSummary[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [graphSearch, setGraphSearch] = useState('');
  const [graphStatusFilter, setGraphStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [graphNameDraft, setGraphNameDraft] = useState('');
  const [graphRenameDraft, setGraphRenameDraft] = useState('');
  const [graphLoadTick, setGraphLoadTick] = useState(0);
  const [lastImportedKey, setLastImportedKey] = useState('');
  const [lastCreatePrefillKey, setLastCreatePrefillKey] = useState('');
  const [overviewItems, setOverviewItems] = useState<Array<{ infoId: string; label: string; infoType: string | null }>>([]);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedGraph = useMemo(
    () => graphs.find((graph) => graph.graphId === selectedGraphId) ?? null,
    [graphs, selectedGraphId]
  );

  const requestedInfoIds = useMemo(() => {
    const value = new URLSearchParams(location.search).get('infoIds') ?? '';
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
  }, [location.search]);
  const routeGraphId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('graphId');
    return value && value.trim().length > 0 ? value.trim() : null;
  }, [location.search]);

  const filteredGraphs = useMemo(() => {
    const query = graphSearch.trim().toLowerCase();
    return graphs.filter((graph) => {
      if (graphStatusFilter === 'active' && !graph.isActive) return false;
      if (graphStatusFilter === 'inactive' && graph.isActive) return false;
      if (!query) return true;
      return graph.name.toLowerCase().includes(query) || graph.graphId.toLowerCase().includes(query);
    });
  }, [graphSearch, graphStatusFilter, graphs]);

  const loadGraphs = useCallback(async () => {
    const response = await getCogitaDependencyGraphs({ libraryId });
    setGraphs(response.items ?? []);
    setSelectedGraphId((current) => {
      if (routeGraphId && response.items.some((item) => item.graphId === routeGraphId)) return routeGraphId;
      if (mode === 'create' || mode === 'search') return null;
      if (current && response.items.some((item) => item.graphId === current)) return current;
      if (!current && !routeGraphId) return null;
      const preferred = response.items.find((item) => item.isActive) ?? response.items[0];
      return preferred?.graphId ?? null;
    });
  }, [libraryId, mode, routeGraphId]);

  const toggleSelectedGraph = useCallback((graphId: string) => {
    setSelectedGraphId((current) => (current === graphId ? null : graphId));
  }, []);

  useEffect(() => {
    if (!selectedGraph) {
      setGraphRenameDraft('');
      return;
    }
    setGraphRenameDraft(selectedGraph.name ?? '');
  }, [selectedGraph]);

  useEffect(() => {
    void loadGraphs().catch(() => {
      setGraphs([]);
      setSelectedGraphId(null);
    });
  }, [loadGraphs]);

  useEffect(() => {
    if (!libraryId) return;
    const params = new URLSearchParams(location.search);
    const normalizedMode = mode === 'create' ? 'create' : mode === 'edit' ? 'edit' : mode === 'overview' ? 'overview' : 'search';
    const keepGraphInRoute = normalizedMode === 'overview' || normalizedMode === 'edit';
    if (keepGraphInRoute && selectedGraphId) {
      params.set('graphId', selectedGraphId);
    } else {
      params.delete('graphId');
    }
    if (normalizedMode === 'search') {
      params.delete('dependencyView');
    } else {
      params.set('dependencyView', normalizedMode);
    }
    const next = params.toString();
    const current = new URLSearchParams(location.search).toString();
    if (next === current) return;
    navigate(`/cogita/library/${libraryId}/dependencies${next ? `?${next}` : ''}`, { replace: true });
  }, [libraryId, location.search, mode, navigate, selectedGraphId]);

  useEffect(() => {
    if (!selectedGraphId) {
      if (mode !== 'create') {
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
      }
      return;
    }
    let mounted = true;
    getCogitaDependencyGraph({ libraryId, graphId: selectedGraphId })
      .then((graph) => {
        if (!mounted) return;
        const mappedNodes: GraphNode[] = graph.nodes.map((node) => ({
          id: node.nodeId,
          type: 'default',
          position: { x: 80 + Math.random() * 300, y: 60 + Math.random() * 260 },
          data: {
            label: toNodeLabel(node.payload, 'Item'),
            nodeType: node.nodeType,
            itemType: (node.payload as { itemType?: string })?.itemType ?? 'info',
            itemId: (node.payload as { itemId?: string | null })?.itemId ?? null,
            infoType: (node.payload as { infoType?: string | null })?.infoType ?? null
          }
        }));
        setNodes(mappedNodes);
        setEdges(graph.edges.map((edge) => ({ id: edge.edgeId, source: edge.fromNodeId, target: edge.toNodeId })));
        setSelectedNodeId(null);
        setGraphLoadTick((prev) => prev + 1);
      })
      .catch(() => {
        if (mounted) {
          setNodes([]);
          setEdges([]);
          setSelectedNodeId(null);
          setGraphLoadTick((prev) => prev + 1);
        }
      });
    return () => {
      mounted = false;
    };
  }, [libraryId, mode, selectedGraphId, setEdges, setNodes]);

  useEffect(() => {
    if (!selectedGraphId) {
      setPreview(null);
      return;
    }
    previewCogitaDependencyGraph({ libraryId, graphId: selectedGraphId })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [libraryId, nodes, edges, selectedGraphId]);

  useEffect(() => {
    if (mode !== 'overview' || !selectedGraphId) {
      setOverviewItems([]);
      return;
    }
    const linkedInfoIds = preview?.collectionIds ?? [];
    if (linkedInfoIds.length === 0) {
      setOverviewItems([]);
      return;
    }
    let mounted = true;
    Promise.all(
      linkedInfoIds.map(async (infoId) => {
        try {
          const detail = await getCogitaInfoDetail({ libraryId, infoId });
          const payload = (detail.payload ?? {}) as { title?: string; label?: string; name?: string };
          const label = payload.title || payload.label || payload.name || infoId;
          return { infoId, infoType: detail.infoType ?? null, label };
        } catch {
          return { infoId, infoType: null as string | null, label: infoId };
        }
      })
    ).then((items) => {
      if (!mounted) return;
      setOverviewItems(items);
    });
    return () => {
      mounted = false;
    };
  }, [libraryId, mode, preview, selectedGraphId]);

  useEffect(() => {
    if (mode !== 'create' || selectedGraphId || requestedInfoIds.length === 0) {
      return;
    }
    const prefillKey = `create|${requestedInfoIds.join(',')}`;
    if (lastCreatePrefillKey === prefillKey) {
      return;
    }
    let mounted = true;
    Promise.all(
      requestedInfoIds.map(async (infoId) => {
        try {
          const detail = await getCogitaInfoDetail({ libraryId, infoId });
          const payload = (detail.payload ?? {}) as { title?: string; label?: string; name?: string };
          const label = payload.title || payload.label || payload.name || infoId;
          return { infoId, infoType: detail.infoType ?? null, label };
        } catch {
          return { infoId, infoType: null as string | null, label: infoId };
        }
      })
    ).then((items) => {
      if (!mounted) return;
      const prefilledNodes: GraphNode[] = items.map((item, index) => ({
        id: crypto.randomUUID(),
        type: 'default',
        position: { x: 180 + (index % 5) * 140, y: 120 + Math.floor(index / 5) * 110 },
        data: {
          label: item.label,
          nodeType: item.infoType === 'collection' ? 'collection' : 'info',
          itemType: item.infoType === 'collection' ? 'collection' : 'info',
          itemId: item.infoId,
          infoType: item.infoType
        }
      }));
      setNodes(prefilledNodes);
      setEdges([]);
      setSelectedNodeId(null);
      setLastCreatePrefillKey(prefillKey);
      setStatus(`Prepared ${prefilledNodes.length} selected infos for a new dependency graph.`);
    });
    return () => {
      mounted = false;
    };
  }, [lastCreatePrefillKey, libraryId, mode, requestedInfoIds, selectedGraphId, setEdges, setNodes]);

  useEffect(() => {
    if (mode === 'create' && !selectedGraphId && requestedInfoIds.length > 0) return;
    setLastCreatePrefillKey('');
  }, [mode, requestedInfoIds.length, selectedGraphId]);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }
    if (!selectedGraphId || requestedInfoIds.length === 0) {
      return;
    }
    const importKey = `${selectedGraphId}|${requestedInfoIds.join(',')}`;
    if (lastImportedKey === importKey) {
      return;
    }

    let mounted = true;
    Promise.all(
      requestedInfoIds.map(async (infoId) => {
        try {
          const detail = await getCogitaInfoDetail({ libraryId, infoId });
          const payload = (detail.payload ?? {}) as { title?: string; label?: string; name?: string };
          const label = payload.title || payload.label || payload.name || infoId;
          return { infoId, infoType: detail.infoType ?? null, label };
        } catch {
          return { infoId, infoType: null as string | null, label: infoId };
        }
      })
    ).then((items) => {
      if (!mounted) return;
      setNodes((prev) => {
        const existing = new Set(prev.map((node) => node.data.itemId).filter((id): id is string => Boolean(id)));
        const additions: GraphNode[] = [];
        items.forEach((item, index) => {
          if (existing.has(item.infoId)) return;
          additions.push({
            id: crypto.randomUUID(),
            type: 'default',
            position: { x: 220 + ((prev.length + index) % 5) * 140, y: 120 + Math.floor((prev.length + index) / 5) * 110 },
            data: {
              label: item.label,
              nodeType: item.infoType === 'collection' ? 'collection' : 'info',
              itemType: item.infoType === 'collection' ? 'collection' : 'info',
              itemId: item.infoId,
              infoType: item.infoType
            }
          });
        });
        if (additions.length > 0) {
          setStatus(`Imported ${additions.length} selected infos into this dependency graph.`);
        }
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
      setLastImportedKey(importKey);
    });

    return () => {
      mounted = false;
    };
  }, [graphLoadTick, isEditMode, lastImportedKey, libraryId, requestedInfoIds, selectedGraphId, setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev));
  }, [setEdges]);

  const addCollectionNode = () => {
    const id = crypto.randomUUID();
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'default',
        position: { x: 140 + prev.length * 40, y: 120 + prev.length * 30 },
        data: {
          label: copy.cogita.library.infoTypes.collection,
          nodeType: 'collection',
          itemType: 'collection',
          itemId: null,
          infoType: 'collection'
        }
      }
    ]);
  };

  const addInfoNode = () => {
    const id = crypto.randomUUID();
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'default',
        position: { x: 180 + prev.length * 40, y: 160 + prev.length * 30 },
        data: {
          label: copy.cogita.library.infoTypes.any,
          nodeType: 'info',
          itemType: 'info',
          itemId: null,
          infoType: null
        }
      }
    ]);
  };

  const handleSave = async () => {
    if (!selectedGraphId) {
      setStatus('Create or select a dependency graph first.');
      return;
    }
    setStatus(null);
    try {
      const payloadNodes: Array<{ nodeId?: string; nodeType: string; payload: unknown }> = nodes.map((node) => ({
        nodeId: node.id,
        nodeType: node.data.nodeType,
        payload: {
          itemType: node.data.itemType,
          itemId: node.data.itemId ?? null,
          label: node.data.label,
          infoType: node.data.infoType ?? null
        }
      }));
      const payloadEdges = edges.map((edge) => ({
        edgeId: edge.id,
        fromNodeId: edge.source,
        toNodeId: edge.target
      }));
      await saveCogitaDependencyGraph({ libraryId, graphId: selectedGraphId, nodes: payloadNodes, edges: payloadEdges });
      setStatus(copy.cogita.library.graph.saveSuccess);
      await loadGraphs();
    } catch {
      setStatus(copy.cogita.library.graph.saveFail);
    }
  };

  const handleCreateGraph = async () => {
    setStatus(null);
    try {
      const created = await createCogitaDependencyGraph({ libraryId, name: graphNameDraft.trim() || null });
      setGraphNameDraft('');
      await loadGraphs();
      setSelectedGraphId(created.graphId);
      setStatus('Dependency graph created.');
    } catch {
      setStatus('Failed to create dependency graph.');
    }
  };

  const handleRenameGraph = async () => {
    if (!selectedGraphId) return;
    setStatus(null);
    try {
      await updateCogitaDependencyGraph({ libraryId, graphId: selectedGraphId, name: graphRenameDraft.trim() || null });
      await loadGraphs();
      setStatus('Dependency graph renamed.');
    } catch {
      setStatus('Failed to rename dependency graph.');
    }
  };

  const handleActivateGraph = async (graphId: string) => {
    setStatus(null);
    try {
      await activateCogitaDependencyGraph({ libraryId, graphId });
      await loadGraphs();
      setStatus('Active dependency graph updated.');
    } catch {
      setStatus('Failed to activate dependency graph.');
    }
  };

  const handleDeleteGraph = async () => {
    if (!selectedGraphId) return;
    if (!window.confirm('Delete this dependency graph? This cannot be undone.')) return;
    setStatus(null);
    try {
      await deleteCogitaDependencyGraph({ libraryId, graphId: selectedGraphId });
      await loadGraphs();
      setStatus('Dependency graph deleted.');
    } catch {
      setStatus('Failed to delete dependency graph.');
    }
  };

  const updateSelectedCollection = (value: CogitaInfoSearchResult | null) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                itemId: value?.infoId ?? null,
                itemType: 'collection',
                infoType: 'collection',
                label: value?.label ?? copy.cogita.library.infoTypes.collection
              }
            }
          : node
      )
    );
  };

  const updateSelectedInfo = (value: CogitaInfoSearchResult | null) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                itemId: value?.infoId ?? null,
                itemType: 'info',
                infoType: value?.infoType ?? null,
                label: value?.label ?? copy.cogita.library.infoTypes.any
              }
            }
          : node
      )
    );
  };

  useEffect(() => {
    if (!selectedNode || selectedNode.data.nodeType !== 'info' || selectedNode.data.infoType !== 'citation' || !selectedNode.data.itemId) {
      setQuotePreview(null);
      return;
    }
    let mounted = true;
    getCogitaInfoDetail({ libraryId, infoId: selectedNode.data.itemId })
      .then((detail) => {
        if (!mounted) return;
        const payload = detail.payload as { text?: string; title?: string };
        const text = payload?.text ?? '';
        if (!text) {
          setQuotePreview(null);
          return;
        }
        const tree = buildQuoteFragmentTree(text);
        const fragments = Object.values(tree.nodes)
          .sort((a, b) => a.depth - b.depth || a.start - b.start)
          .map((node) => ({ id: node.id, text: node.text, depth: node.depth }));
        setQuotePreview({ title: payload?.title ?? selectedNode.data.label, fragments });
      })
      .catch(() => setQuotePreview(null));
    return () => {
      mounted = false;
    };
  }, [libraryId, selectedNode]);

  if (isSearchMode) {
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
        <section className="cogita-library-dashboard cogita-flat-search-list" data-mode="list">
          <div className="cogita-library-layout">
            <div className="cogita-library-content">
              <div className="cogita-library-grid">
                <div className="cogita-flat-search-header">
                  <div className="cogita-library-controls">
                    <div className="cogita-library-search">
                      <p className="cogita-user-kicker">{copy.cogita.workspace.infoMode.search}</p>
                      <div className="cogita-search-field">
                        <input
                          type="text"
                          value={graphSearch}
                          onChange={(event) => setGraphSearch(event.target.value)}
                          placeholder="Search dependency graph"
                        />
                      </div>
                      <label className="cogita-field">
                        <span>{copy.cogita.library.revision.live.statusLabel}</span>
                        <select
                          value={graphStatusFilter}
                          onChange={(event) => setGraphStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                        >
                          <option value="all">{copy.cogita.library.infoTypes.any}</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="cogita-library-panel">
                  <div className="cogita-card-count">
                    <span>{`${filteredGraphs.length} / ${graphs.length}`}</span>
                    <span>{copy.cogita.library.collections.ready}</span>
                  </div>

                  <div className="cogita-card-list" data-view="list">
                    {filteredGraphs.length ? (
                      filteredGraphs.map((graph) => (
                        <button
                          key={graph.graphId}
                          type="button"
                          className={`cogita-card-item ${selectedGraphId === graph.graphId ? 'active' : ''}`}
                          onClick={() =>
                            navigate(
                              `/cogita/library/${libraryId}/dependencies?graphId=${encodeURIComponent(graph.graphId)}&dependencyView=overview`,
                              { replace: true }
                            )
                          }
                        >
                          <div className="cogita-card-select">
                            <div className="cogita-card-type">{graph.isActive ? 'active' : 'inactive'}</div>
                            <h3 className="cogita-card-title">{graph.name}</h3>
                            <p className="cogita-card-subtitle">{graph.nodeCount} nodes</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="cogita-card-empty">
                        <p>No dependency graphs yet.</p>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            navigate(`/cogita/library/${libraryId}/dependencies?dependencyView=create`, { replace: true })
                          }
                        >
                          Create dependency graph
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </CogitaShell>
    );
  }

  if (mode === 'overview') {
    const selectedGraphName = selectedGraph?.name?.trim() || 'Dependency graph';
    const updatedDate =
      selectedGraph?.updatedUtc && selectedGraph.updatedUtc.trim()
        ? new Date(selectedGraph.updatedUtc).toLocaleString(language)
        : 'n/a';
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
        <section className="cogita-library-dashboard" data-mode="detail">
          <header className="cogita-library-dashboard-header">
            <div>
              <p className="cogita-user-kicker">{copy.cogita.library.graph.kicker}</p>
              <h1 className="cogita-library-title">{selectedGraphName}</h1>
              <p className="cogita-library-subtitle">{copy.cogita.library.graph.subtitle}</p>
            </div>
            <div className="cogita-library-actions">
              <a className="cta ghost" href={baseHref}>
                {copy.cogita.library.actions.libraryOverview}
              </a>
              <button
                type="button"
                className="cta"
                onClick={() => navigate(`/cogita/library/${libraryId}/dependencies?graphId=${encodeURIComponent(selectedGraphId ?? '')}&dependencyView=edit`)}
                disabled={!selectedGraphId}
              >
                {copy.cogita.workspace.infoActions.edit}
              </button>
            </div>
          </header>

          <div className="cogita-library-layout">
            <div className="cogita-library-content">
              <div className="cogita-library-panel">
                <div className="cogita-card-count">
                  <span>{selectedGraph?.isActive ? 'Active' : 'Inactive'}</span>
                  <span>{copy.cogita.library.collections.ready}</span>
                </div>
                <div className="cogita-form-actions" style={{ marginTop: 12 }}>
                  <input
                    type="text"
                    value={graphRenameDraft}
                    onChange={(event) => setGraphRenameDraft(event.target.value)}
                    placeholder="Dependency name"
                    disabled={!selectedGraphId}
                  />
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => void handleRenameGraph()}
                    disabled={!selectedGraphId}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => void handleDeleteGraph()}
                    disabled={!selectedGraphId}
                  >
                    Delete
                  </button>
                </div>
                <div className="cogita-graph-summary">
                  <p>{`Nodes: ${selectedGraph?.nodeCount ?? nodes.length}`}</p>
                  <p>{`Linked infos: ${preview?.totalCollections ?? overviewItems.length}`}</p>
                  <p>{`Updated: ${updatedDate}`}</p>
                </div>
                <hr />
                <p className="cogita-user-kicker">{copy.cogita.library.actions.addInfo}</p>
                <div className="cogita-card-list" data-view="list">
                  {overviewItems.length > 0 ? (
                    overviewItems.map((item) => (
                      <div key={item.infoId} className="cogita-card-item">
                        <div className="cogita-card-select">
                          <div className="cogita-card-type">{item.infoType ?? copy.cogita.library.infoTypes.any}</div>
                          <h3 className="cogita-card-title">{item.label}</h3>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="cogita-card-empty">
                      <p>No linked information in this dependency graph yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </CogitaShell>
    );
  }

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
      <section className="cogita-library-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.graph.kicker}</p>
            <h1 className="cogita-library-title">{copy.cogita.library.navLabel}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.graph.subtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-collection-graph">
              <div className="cogita-graph-panel">
                <p className="cogita-user-kicker">Dependency Graphs</p>
                {selectedGraphId ? (
                  <button type="button" className="cta ghost" onClick={() => setSelectedGraphId(null)}>
                    Deselect graph
                  </button>
                ) : null}
                <div className="cogita-info-tree" style={{ maxHeight: 210, overflow: 'auto' }}>
                  {filteredGraphs.map((graph) => {
                    const isSelected = selectedGraphId === graph.graphId;
                    return (
                      <button
                        key={graph.graphId}
                        type="button"
                        className={`ghost cogita-checkcard-row ${isSelected ? 'active' : ''}`}
                        onClick={() => toggleSelectedGraph(graph.graphId)}
                      >
                        <span>{graph.name}{graph.isActive ? ' (active)' : ''}</span>
                        <small>{graph.nodeCount} nodes</small>
                      </button>
                    );
                  })}
                </div>
                <div className="cogita-form-actions" style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    value={graphNameDraft}
                    onChange={(event) => setGraphNameDraft(event.target.value)}
                    placeholder="New dependency graph name"
                  />
                  <button type="button" className="cta ghost" onClick={() => void handleCreateGraph()} disabled={!isEditMode}>
                    Create graph
                  </button>
                </div>
                <div className="cogita-form-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => selectedGraphId && void handleActivateGraph(selectedGraphId)}
                    disabled={!selectedGraphId || !isEditMode}
                  >
                    Set active
                  </button>
                </div>
                <hr />
                <p className="cogita-user-kicker">{copy.cogita.library.graph.palette}</p>
                <button type="button" className="cta ghost" onClick={addCollectionNode} disabled={!isEditMode}>
                  {copy.cogita.library.collections.create}
                </button>
                <button type="button" className="cta ghost" onClick={addInfoNode} disabled={!isEditMode}>
                  {copy.cogita.library.actions.addInfo}
                </button>
                {preview ? (
                  <div className="cogita-graph-summary">
                    <p>{copy.cogita.library.graph.previewLabel.replace('{total}', String(preview.totalCollections))}</p>
                  </div>
                ) : null}
                {status ? <p className="cogita-help">{status}</p> : null}
              </div>
              <div className="cogita-collection-graph-canvas">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={isEditMode ? onConnect : undefined}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                  nodesDraggable={isEditMode}
                  nodesConnectable={isEditMode}
                  elementsSelectable
                >
                  <Background gap={18} size={1} />
                  <Controls />
                </ReactFlow>
                {isEditMode ? (
                  <div className="cogita-form-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="cta" onClick={handleSave}>
                      {copy.cogita.library.graph.save}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="cogita-graph-panel">
                <p className="cogita-user-kicker">{copy.cogita.library.graph.inspector}</p>
                {selectedNode ? (
                  <div className="cogita-graph-inspector">
                    {selectedNode.data.nodeType === 'collection' ? (
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="collection"
                        label={copy.cogita.library.graph.specificInfoLabel}
                        placeholder={copy.cogita.library.graph.specificInfoPlaceholder}
                        value={
                          selectedNode.data.itemId
                            ? ({
                                id: selectedNode.data.itemId,
                                label: selectedNode.data.label,
                                infoType: 'collection'
                              } as never)
                            : null
                        }
                        onChange={isEditMode ? updateSelectedCollection : () => {}}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.collection)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    ) : (
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="any"
                        label={copy.cogita.library.graph.specificInfoLabel}
                        placeholder={copy.cogita.library.graph.specificInfoPlaceholder}
                        value={
                          selectedNode.data.itemId
                            ? ({
                                id: selectedNode.data.itemId,
                                label: selectedNode.data.label,
                                infoType: selectedNode.data.infoType ?? undefined
                              } as never)
                            : null
                        }
                        onChange={isEditMode ? updateSelectedInfo : () => {}}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.any)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    )}
                    {quotePreview ? (
                      <div className="cogita-quote-preview">
                        <p className="cogita-user-kicker">{quotePreview.title}</p>
                        <div className="cogita-detail-sample-grid">
                          {quotePreview.fragments.map((fragment) => (
                            <div key={fragment.id} className="cogita-detail-sample-item">
                              <span>{fragment.id}</span>
                              <span>{fragment.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="cogita-help">{copy.cogita.library.graph.emptyInspector}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
