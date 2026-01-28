import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, type Connection, type Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { CogitaLibrarySidebar } from './components/CogitaLibrarySidebar';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import {
  getCogitaDependencyGraph,
  previewCogitaDependencyGraph,
  saveCogitaDependencyGraph,
  type CogitaDependencyGraphEdge,
  type CogitaDependencyGraphPreview,
  type CogitaInfoSearchResult
} from '../../../lib/api';

type GraphNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; nodeType: string; collectionId?: string | null };
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
            label: node.payload && typeof node.payload === 'object' && 'label' in node.payload ? String((node.payload as any).label) : 'Collection',
            nodeType: node.nodeType,
            collectionId: (node.payload as any)?.collectionId ?? null
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
        data: { label: copy.cogita.library.infoTypes.collection, nodeType: 'collection', collectionId: null }
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
          collectionId: node.data.collectionId ?? null,
          label: node.data.label
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
                collectionId: value?.infoId ?? null,
                label: value?.label ?? copy.cogita.library.infoTypes.collection
              }
            }
          : node
      )
    );
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
    >
      <section className="cogita-library-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.graph.kicker}</p>
            <h1 className="cogita-library-title">{copy.cogita.library.sidebar.title}</h1>
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
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-collection-graph">
              <div className="cogita-graph-panel">
                <p className="cogita-user-kicker">{copy.cogita.library.graph.palette}</p>
                <button type="button" className="cta ghost" onClick={addCollectionNode}>
                  {copy.cogita.library.collections.create}
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
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="collection"
                      label={copy.cogita.library.graph.specificInfoLabel}
                      placeholder={copy.cogita.library.graph.specificInfoPlaceholder}
                      value={
                        selectedNode.data.collectionId
                          ? ({
                              id: selectedNode.data.collectionId,
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
