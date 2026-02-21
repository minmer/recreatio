import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, type Connection, type Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import {
  getCogitaDependencyGraph,
  previewCogitaDependencyGraph,
  saveCogitaDependencyGraph,
  type CogitaDependencyGraphEdge,
  type CogitaDependencyGraphPreview,
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
  libraryId
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
}) {
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CogitaDependencyGraphPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [quotePreview, setQuotePreview] = useState<{ title: string; fragments: Array<{ id: string; text: string; depth: number }> } | null>(null);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  useEffect(() => {
    let mounted = true;
    getCogitaDependencyGraph({ libraryId })
      .then((graph) => {
        if (!mounted) return;
        const mappedNodes: GraphNode[] = graph.nodes.map((node) => ({
          id: node.nodeId,
          type: 'default',
          position: { x: 80 + Math.random() * 300, y: 60 + Math.random() * 260 },
          data: {
            label: node.payload && typeof node.payload === 'object' && 'label' in node.payload ? String((node.payload as any).label) : 'Item',
            nodeType: node.nodeType,
            itemType: (node.payload as any)?.itemType ?? 'info',
            itemId: (node.payload as any)?.itemId ?? null,
            infoType: (node.payload as any)?.infoType ?? null
          }
        }));
        setNodes(mappedNodes);
        setEdges(graph.edges.map((edge) => ({ id: edge.edgeId, source: edge.fromNodeId, target: edge.toNodeId })));
      })
      .catch(() => {
        if (mounted) {
          setNodes([]);
          setEdges([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [libraryId]);

  useEffect(() => {
    previewCogitaDependencyGraph({ libraryId })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [libraryId, nodes, edges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev));
  }, []);

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
      await saveCogitaDependencyGraph({ libraryId, nodes: payloadNodes, edges: payloadEdges });
      setStatus(copy.cogita.library.graph.saveSuccess);
    } catch {
      setStatus(copy.cogita.library.graph.saveFail);
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
    if (!selectedNode || selectedNode.data.nodeType !== 'info' || selectedNode.data.infoType !== 'quote' || !selectedNode.data.itemId) {
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
            <button type="button" className="cta" onClick={handleSave}>
              {copy.cogita.library.graph.save}
            </button>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-collection-graph">
              <div className="cogita-graph-panel">
                <p className="cogita-user-kicker">{copy.cogita.library.graph.palette}</p>
                <button type="button" className="cta ghost" onClick={addCollectionNode}>
                  {copy.cogita.library.collections.create}
                </button>
                <button type="button" className="cta ghost" onClick={addInfoNode}>
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
                  onConnect={onConnect}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                >
                  <Background gap={18} size={1} />
                  <Controls />
                </ReactFlow>
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
                              } as any)
                            : null
                        }
                        onChange={updateSelectedCollection}
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
                              } as any)
                            : null
                        }
                        onChange={updateSelectedInfo}
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
