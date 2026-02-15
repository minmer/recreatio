import { useCallback, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, type Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  createCogitaCollection,
  saveCogitaCollectionGraph
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';
import { InfoSearchSelect } from '../components/InfoSearchSelect';
import { CogitaLibrarySidebar } from '../components/CogitaLibrarySidebar';

type GraphNodeParams = {
  infoType?: string;
  infoId?: string | null;
  infoLabel?: string | null;
  connectionType?: string;
  connectionId?: string | null;
  tagId?: string | null;
  tagLabel?: string | null;
  languageId?: string | null;
  languageLabel?: string | null;
  scope?: string;
};

type GraphNodeData = {
  nodeType: string;
  label: string;
  params: GraphNodeParams;
};

const NODE_CATALOG = [
  { type: 'source.translation', label: 'Translation source' },
  { type: 'source.info.all', label: 'All infos' },
  { type: 'source.info', label: 'Info source' },
  { type: 'source.connection', label: 'Connection source' },
  { type: 'filter.tag', label: 'Tag filter' },
  { type: 'filter.language', label: 'Language filter' },
  { type: 'logic.and', label: 'AND' },
  { type: 'logic.or', label: 'OR' },
  { type: 'output.collection', label: 'Collection output' }
];

const DEFAULT_NODE_PARAMS: Record<string, GraphNodeParams> = {
  'filter.tag': { scope: 'any' },
  'filter.language': { scope: 'any' },
  'source.info': { infoType: 'word' },
  'source.connection': { connectionType: 'translation' }
};

const CONNECTION_TYPES = [
  { value: 'translation', label: 'Translation' },
  { value: 'word-language', label: 'Word ↔ Language' },
  { value: 'language-sentence', label: 'Language ↔ Sentence' },
  { value: 'word-topic', label: 'Word ↔ Topic' }
];

const INFO_TYPES = [
  { value: 'word', label: 'Word' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'language', label: 'Language' },
  { value: 'topic', label: 'Topic' },
  { value: 'computed', label: 'Computed' }
];

export function CogitaCollectionCreatePage({
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
  onCreated
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
  onCreated: (collectionId: string) => void;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const handleAddNode = (type: string) => {
    const id = crypto.randomUUID();
    const label = NODE_CATALOG.find((entry) => entry.type === type)?.label ?? type;
    const params = { ...DEFAULT_NODE_PARAMS[type] };
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'default',
        position: { x: 120 + prev.length * 40, y: 120 + prev.length * 40 },
        data: { nodeType: type, label, params }
      }
    ]);
    setSelectedNodeId(id);
  };

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((prev) => addEdge({ ...connection, id: crypto.randomUUID() }, prev));
    },
    [setEdges]
  );

  const updateNodeParams = (next: GraphNodeParams) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id ? { ...node, data: { ...node.data, params: next } } : node
      )
    );
  };

  const handleCreate = async () => {
    setStatusMessage(null);
    if (!name.trim()) {
      setStatusMessage(copy.cogita.library.collections.saveRequiredName);
      return;
    }

    try {
      const graphPayload = {
        nodes: nodes.map((node) => ({
          nodeId: node.id,
          nodeType: node.data.nodeType,
          payload: {
            position: node.position,
            params: node.data.params
          }
        })),
        edges: edges.map((edge) => ({
          edgeId: edge.id,
          fromNodeId: edge.source,
          fromPort: edge.sourceHandle ?? null,
          toNodeId: edge.target,
          toPort: edge.targetHandle ?? null
        }))
      };
      let activeCollectionId = collectionId;
      let createdNow = false;
      if (!activeCollectionId) {
        const created = await createCogitaCollection({
          libraryId,
          name: name.trim(),
          notes: notes.trim() || undefined,
          items: [],
          graph: graphPayload
        });
        activeCollectionId = created.collectionId;
        createdNow = true;
        setCollectionId(created.collectionId);
      } else {
        await saveCogitaCollectionGraph({
          libraryId,
          collectionId: activeCollectionId,
          nodes: graphPayload.nodes,
          edges: graphPayload.edges
        });
      }
      setStatusMessage(createdNow ? copy.cogita.library.collections.saveSuccess : copy.cogita.library.graph.saveSuccess);
      onCreated(activeCollectionId);
    } catch {
      setStatusMessage(collectionId ? copy.cogita.library.graph.saveFail : copy.cogita.library.collections.saveFail);
    }
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
            <p className="cogita-user-kicker">{copy.cogita.library.collections.createKicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.collections.createSubtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              {copy.cogita.library.actions.collections}
            </a>
            <button type="button" className="cta" onClick={handleCreate}>
              {copy.cogita.library.actions.saveCollection}
            </button>
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-collection-graph">
              <div className="cogita-graph-palette">
                <p className="cogita-user-kicker">{copy.cogita.library.collections.collectionInfoTitle}</p>
                <label className="cogita-field">
                  <span>{copy.cogita.library.collections.nameLabel}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={copy.cogita.library.collections.namePlaceholder}
                  />
                </label>
                <label className="cogita-field">
                  <span>{copy.cogita.library.collections.notesLabel}</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={copy.cogita.library.collections.notesPlaceholder}
                  />
                </label>
                {statusMessage ? <p className="cogita-help">{statusMessage}</p> : null}

                <p className="cogita-user-kicker">{copy.cogita.library.graph.palette}</p>
                <div className="cogita-graph-palette-grid">
                  {NODE_CATALOG.map((node) => (
                    <button key={node.type} type="button" className="ghost" onClick={() => handleAddNode(node.type)}>
                      {node.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cogita-graph-canvas">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={handleConnect}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                >
                  <Background color="rgba(120,160,200,0.2)" />
                  <Controls />
                </ReactFlow>
              </div>

              <div className="cogita-graph-panel">
                <p className="cogita-user-kicker">{copy.cogita.library.graph.inspector}</p>
                {selectedNode ? (
                  <div className="cogita-graph-panel-body">
                    <p className="cogita-graph-node-title">{selectedNode.data.label}</p>
                    {selectedNode.data.nodeType === 'filter.tag' && (
                      <>
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="topic"
                          label={copy.cogita.library.graph.tagLabel}
                          placeholder={copy.cogita.library.graph.tagPlaceholder}
                          value={
                            selectedNode.data.params.tagId
                              ? { id: selectedNode.data.params.tagId, label: selectedNode.data.params.tagLabel ?? '', infoType: 'topic' }
                              : null
                          }
                          onChange={(value) =>
                            updateNodeParams({
                              ...selectedNode.data.params,
                              tagId: value?.id ?? null,
                              tagLabel: value?.label ?? null
                            })
                          }
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                        <label className="cogita-field">
                          <span>{copy.cogita.library.graph.scopeLabel}</span>
                          <select
                            value={selectedNode.data.params.scope ?? 'any'}
                            onChange={(event) => updateNodeParams({ ...selectedNode.data.params, scope: event.target.value })}
                          >
                            <option value="any">{copy.cogita.library.graph.scopeAny}</option>
                            <option value="translation">{copy.cogita.library.graph.scopeTranslation}</option>
                            <option value="wordA">{copy.cogita.library.graph.scopeWordA}</option>
                            <option value="wordB">{copy.cogita.library.graph.scopeWordB}</option>
                          </select>
                        </label>
                      </>
                    )}
                    {selectedNode.data.nodeType === 'filter.language' && (
                      <>
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="language"
                          label={copy.cogita.library.graph.languageLabel}
                          placeholder={copy.cogita.library.graph.languagePlaceholder}
                          value={
                            selectedNode.data.params.languageId
                              ? {
                                  id: selectedNode.data.params.languageId,
                                  label: selectedNode.data.params.languageLabel ?? '',
                                  infoType: 'language'
                                }
                              : null
                          }
                          onChange={(value) =>
                            updateNodeParams({
                              ...selectedNode.data.params,
                              languageId: value?.id ?? null,
                              languageLabel: value?.label ?? null
                            })
                          }
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                        <label className="cogita-field">
                          <span>{copy.cogita.library.graph.scopeLabel}</span>
                          <select
                            value={selectedNode.data.params.scope ?? 'any'}
                            onChange={(event) => updateNodeParams({ ...selectedNode.data.params, scope: event.target.value })}
                          >
                            <option value="any">{copy.cogita.library.graph.scopeAny}</option>
                            <option value="wordA">{copy.cogita.library.graph.scopeWordA}</option>
                            <option value="wordB">{copy.cogita.library.graph.scopeWordB}</option>
                          </select>
                        </label>
                      </>
                    )}
                    {selectedNode.data.nodeType === 'source.info' && (
                      <>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.graph.infoTypeLabel}</span>
                          <select
                            value={selectedNode.data.params.infoType ?? 'word'}
                            onChange={(event) => updateNodeParams({ ...selectedNode.data.params, infoType: event.target.value })}
                          >
                            {INFO_TYPES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType={(selectedNode.data.params.infoType ?? 'word') as 'word' | 'sentence' | 'language' | 'topic'}
                          label={copy.cogita.library.graph.specificInfoLabel}
                          placeholder={copy.cogita.library.graph.specificInfoPlaceholder}
                          value={
                            selectedNode.data.params.infoId
                              ? {
                                  id: selectedNode.data.params.infoId,
                                  label: selectedNode.data.params.infoLabel ?? '',
                                  infoType: (selectedNode.data.params.infoType ?? 'word') as any
                                }
                              : null
                          }
                          onChange={(value) =>
                            updateNodeParams({
                              ...selectedNode.data.params,
                              infoId: value?.id ?? null,
                              infoLabel: value?.label ?? null
                            })
                          }
                          searchFailedText={copy.cogita.library.lookup.searchFailed}
                          createFailedText={copy.cogita.library.lookup.createFailed}
                          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                          savingLabel={copy.cogita.library.lookup.saving}
                          loadMoreLabel={copy.cogita.library.lookup.loadMore}
                        />
                      </>
                    )}
                    {selectedNode.data.nodeType === 'source.connection' && (
                      <>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.graph.connectionTypeLabel}</span>
                          <select
                            value={selectedNode.data.params.connectionType ?? 'translation'}
                            onChange={(event) =>
                              updateNodeParams({ ...selectedNode.data.params, connectionType: event.target.value })
                            }
                          >
                            {CONNECTION_TYPES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="cogita-field">
                          <span>{copy.cogita.library.graph.connectionIdLabel}</span>
                          <input
                            value={selectedNode.data.params.connectionId ?? ''}
                            onChange={(event) =>
                              updateNodeParams({ ...selectedNode.data.params, connectionId: event.target.value || null })
                            }
                            placeholder={copy.cogita.library.graph.connectionIdPlaceholder}
                          />
                        </label>
                      </>
                    )}
                    {['logic.and', 'logic.or', 'output.collection', 'source.translation', 'source.info.all'].includes(selectedNode.data.nodeType) && (
                      <p className="cogita-help">{copy.cogita.library.graph.noParams}</p>
                    )}
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
