import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCogitaCreationProjects,
  getCogitaPublicStoryboardShare,
  type CogitaCreationProject
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaShell } from './CogitaShell';

type StoryboardNodeKind = 'start' | 'end' | 'static' | 'card' | 'group';
type StoryboardStaticType = 'text' | 'video' | 'audio' | 'image' | 'other';
type StoryboardCardDirection = 'front_to_back' | 'back_to_front';
type StoryboardEdgeKind = 'path' | 'dependency' | 'card_right' | 'card_wrong';
type StoryboardSourcePort = 'out-path' | 'out-right' | 'out-wrong';
type StoryboardTargetPort = 'in-path' | 'in-dependency';
type StoryboardEdgeDisplayMode = 'new_screen' | 'expand';

type StoryboardGraphEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: StoryboardEdgeKind;
  sourcePort: StoryboardSourcePort;
  targetPort: StoryboardTargetPort;
  label: string;
  displayMode: StoryboardEdgeDisplayMode;
};

type StoryboardNodeRecord = {
  nodeId: string;
  title: string;
  kind: StoryboardNodeKind;
  description: string;
  position: { x: number; y: number };
  staticType: StoryboardStaticType;
  staticBody: string;
  mediaUrl: string;
  knowledgeItemId: string;
  cardDirection: StoryboardCardDirection;
  groupGraph?: StoryboardGraph;
};

type StoryboardGraph = {
  startNodeId: string;
  endNodeId: string;
  nodes: StoryboardNodeRecord[];
  edges: StoryboardGraphEdge[];
};

type StoryboardDocument = {
  schema: 'cogita_storyboard_graph';
  version: number;
  description: string;
  script: string;
  steps: string[];
  rootGraph: StoryboardGraph;
};

type RuntimeBlock = {
  key: string;
  kind: StoryboardNodeKind;
  title: string;
  description: string;
  staticType: StoryboardStaticType;
  staticBody: string;
  mediaUrl: string;
  knowledgeItemId: string;
  cardDirection: StoryboardCardDirection;
};

type RuntimeFrame = {
  parentGraph: StoryboardGraph;
  parentGraphPath: string[];
  parentGroupNodeId: string;
};

type RuntimeState = {
  graph: StoryboardGraph;
  graphPath: string[];
  stack: RuntimeFrame[];
  currentNodeId: string;
  displayedBlocks: RuntimeBlock[];
  visited: Record<string, boolean>;
  completedGroups: Record<string, boolean>;
  finished: boolean;
};

function toString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function toFinite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function createStartNode(nodeId?: string): StoryboardNodeRecord {
  return {
    nodeId: nodeId ?? createId('start'),
    title: 'Start',
    kind: 'start',
    description: '',
    position: { x: 80, y: 220 },
    staticType: 'text',
    staticBody: '',
    mediaUrl: '',
    knowledgeItemId: '',
    cardDirection: 'front_to_back'
  };
}

function createEndNode(nodeId?: string): StoryboardNodeRecord {
  return {
    nodeId: nodeId ?? createId('end'),
    title: 'End',
    kind: 'end',
    description: '',
    position: { x: 820, y: 220 },
    staticType: 'text',
    staticBody: '',
    mediaUrl: '',
    knowledgeItemId: '',
    cardDirection: 'front_to_back'
  };
}

function createDefaultGraph(): StoryboardGraph {
  const start = createStartNode();
  const end = createEndNode();
  return {
    startNodeId: start.nodeId,
    endNodeId: end.nodeId,
    nodes: [start, end],
    edges: [
      {
        edgeId: createId('edge'),
        fromNodeId: start.nodeId,
        toNodeId: end.nodeId,
        sourcePort: 'out-path',
        targetPort: 'in-path',
        kind: 'path',
        label: '',
        displayMode: 'new_screen'
      }
    ]
  };
}

function normalizeNodeKind(value: unknown): StoryboardNodeKind {
  if (value === 'start' || value === 'end' || value === 'static' || value === 'card' || value === 'group') return value;
  if (value === 'text' || value === 'video' || value === 'audio' || value === 'image' || value === 'revision') return 'static';
  return 'static';
}

function normalizeStaticType(value: unknown): StoryboardStaticType {
  if (value === 'text' || value === 'video' || value === 'audio' || value === 'image' || value === 'other') return value;
  if (value === 'revision') return 'other';
  return 'text';
}

function normalizeCardDirection(value: unknown): StoryboardCardDirection {
  return value === 'back_to_front' ? 'back_to_front' : 'front_to_back';
}

function deriveEdgeKind(sourcePort: StoryboardSourcePort, targetPort: StoryboardTargetPort): StoryboardEdgeKind {
  if (targetPort === 'in-dependency') return 'dependency';
  if (sourcePort === 'out-right') return 'card_right';
  if (sourcePort === 'out-wrong') return 'card_wrong';
  return 'path';
}

function parseGraph(raw: unknown): StoryboardGraph {
  const fallback = createDefaultGraph();
  if (!raw || typeof raw !== 'object') return fallback;

  const root = raw as Record<string, unknown>;
  const rawNodes = Array.isArray(root.nodes) ? (root.nodes as Array<Record<string, unknown>>) : [];
  const nodes: StoryboardNodeRecord[] = rawNodes.map((item, index) => {
    const kind = normalizeNodeKind(item.kind ?? item.nodeType);
    return {
      nodeId: toString(item.nodeId).trim() || createId(`node-${index + 1}`),
      title: toString(item.title).trim() || `Node ${index + 1}`,
      kind,
      description: toString(item.description),
      position: {
        x: toFinite((item.position as Record<string, unknown> | undefined)?.x, 120 + (index % 4) * 220),
        y: toFinite((item.position as Record<string, unknown> | undefined)?.y, 100 + Math.floor(index / 4) * 160)
      },
      staticType: normalizeStaticType(item.staticType ?? item.nodeType),
      staticBody: toString(item.staticBody ?? item.text),
      mediaUrl: toString(item.mediaUrl ?? item.videoUrl),
      knowledgeItemId: toString(item.knowledgeItemId),
      cardDirection: normalizeCardDirection(item.cardDirection),
      groupGraph: kind === 'group' && item.groupGraph ? parseGraph(item.groupGraph) : undefined
    };
  });

  const startNodeIdRaw = toString(root.startNodeId).trim();
  const endNodeIdRaw = toString(root.endNodeId).trim();

  const startNodeId =
    (startNodeIdRaw && nodes.some((node) => node.nodeId === startNodeIdRaw && node.kind === 'start') ? startNodeIdRaw : '') ||
    nodes.find((node) => node.kind === 'start')?.nodeId ||
    createId('start');
  const endNodeId =
    (endNodeIdRaw && nodes.some((node) => node.nodeId === endNodeIdRaw && node.kind === 'end') ? endNodeIdRaw : '') ||
    nodes.find((node) => node.kind === 'end')?.nodeId ||
    createId('end');

  const normalizedNodes = nodes
    .filter((node) => {
      if (node.kind === 'start') return node.nodeId === startNodeId;
      if (node.kind === 'end') return node.nodeId === endNodeId;
      return true;
    })
    .concat(nodes.some((node) => node.nodeId === endNodeId && node.kind === 'end') ? [] : [createEndNode(endNodeId)]);

  if (!normalizedNodes.some((node) => node.nodeId === startNodeId && node.kind === 'start')) {
    normalizedNodes.unshift(createStartNode(startNodeId));
  }

  const nodeById = new Map(normalizedNodes.map((node) => [node.nodeId, node]));
  const rawEdges = Array.isArray(root.edges) ? (root.edges as Array<Record<string, unknown>>) : [];

  const edges: StoryboardGraphEdge[] = rawEdges
    .map((edge) => {
      const fromNodeId = toString(edge.fromNodeId).trim();
      const toNodeId = toString(edge.toNodeId).trim();
      if (!fromNodeId || !toNodeId) return null;
      const sourcePortRaw = toString(edge.sourcePort).trim();
      const targetPortRaw = toString(edge.targetPort).trim();
      const kindRaw = toString(edge.kind).trim();
      const sourcePort: StoryboardSourcePort =
        sourcePortRaw === 'out-right' || sourcePortRaw === 'out-wrong' || sourcePortRaw === 'out-path'
          ? sourcePortRaw
          : kindRaw === 'card_right'
            ? 'out-right'
            : kindRaw === 'card_wrong'
              ? 'out-wrong'
              : 'out-path';
      const targetPort: StoryboardTargetPort =
        targetPortRaw === 'in-dependency' || targetPortRaw === 'in-path'
          ? targetPortRaw
          : kindRaw === 'dependency'
            ? 'in-dependency'
            : 'in-path';
      return {
        edgeId: toString(edge.edgeId).trim() || createId('edge'),
        fromNodeId,
        toNodeId,
        sourcePort,
        targetPort,
        kind: deriveEdgeKind(sourcePort, targetPort),
        label: toString(edge.label ?? edge.buttonLabel ?? edge.edgeLabel),
        displayMode: edge.displayMode === 'expand' ? 'expand' : 'new_screen'
      } satisfies StoryboardGraphEdge;
    })
    .filter((edge): edge is StoryboardGraphEdge => Boolean(edge))
    .filter((edge) => nodeById.has(edge.fromNodeId) && nodeById.has(edge.toNodeId) && edge.fromNodeId !== edge.toNodeId);

  return {
    startNodeId,
    endNodeId,
    nodes: normalizedNodes,
    edges:
      edges.length > 0
        ? edges
        : [
            {
              edgeId: createId('edge'),
              fromNodeId: startNodeId,
              toNodeId: endNodeId,
              sourcePort: 'out-path',
              targetPort: 'in-path',
              kind: 'path',
              label: '',
              displayMode: 'new_screen'
            }
          ]
  };
}

function normalizeDocument(content: unknown): StoryboardDocument {
  if (content && typeof content === 'object') {
    const root = content as Record<string, unknown>;
    if (root.schema === 'cogita_storyboard_graph' && root.rootGraph) {
      return {
        schema: 'cogita_storyboard_graph',
        version: typeof root.version === 'number' ? root.version : 2,
        description: toString(root.description),
        script: toString(root.script),
        steps: Array.isArray(root.steps) ? root.steps.map((entry) => toString(entry)).filter(Boolean) : [],
        rootGraph: parseGraph(root.rootGraph)
      };
    }
    if (root.schema === 'cogita_storyboard_graph' && Array.isArray(root.nodes)) {
      return {
        schema: 'cogita_storyboard_graph',
        version: typeof root.version === 'number' ? root.version : 1,
        description: toString(root.description),
        script: toString(root.script),
        steps: Array.isArray(root.steps) ? root.steps.map((entry) => toString(entry)).filter(Boolean) : [],
        rootGraph: parseGraph(root)
      };
    }
  }

  return {
    schema: 'cogita_storyboard_graph',
    version: 2,
    description: '',
    script: '',
    steps: [],
    rootGraph: createDefaultGraph()
  };
}

function buildNodeKey(graphPath: string[], nodeId: string) {
  return `${graphPath.join('/') || 'root'}::${nodeId}`;
}

function buildRuntimeBlock(graphPath: string[], node: StoryboardNodeRecord): RuntimeBlock {
  return {
    key: buildNodeKey(graphPath, node.nodeId),
    kind: node.kind,
    title: node.title,
    description: node.description,
    staticType: node.staticType,
    staticBody: node.staticBody,
    mediaUrl: node.mediaUrl,
    knowledgeItemId: node.knowledgeItemId,
    cardDirection: node.cardDirection
  };
}

function findNode(graph: StoryboardGraph, nodeId: string) {
  return graph.nodes.find((node) => node.nodeId === nodeId) ?? null;
}

function getDependencyEdges(graph: StoryboardGraph, targetNodeId: string) {
  return graph.edges.filter((edge) => edge.toNodeId === targetNodeId && edge.targetPort === 'in-dependency');
}

function isNodeAvailable(graph: StoryboardGraph, graphPath: string[], targetNodeId: string, visited: Record<string, boolean>) {
  const deps = getDependencyEdges(graph, targetNodeId);
  return deps.every((edge) => visited[buildNodeKey(graphPath, edge.fromNodeId)] === true);
}

function getOutgoingEdges(
  graph: StoryboardGraph,
  graphPath: string[],
  nodeId: string,
  sourcePort: StoryboardSourcePort,
  visited: Record<string, boolean>
) {
  return graph.edges.filter(
    (edge) =>
      edge.fromNodeId === nodeId &&
      edge.sourcePort === sourcePort &&
      isNodeAvailable(graph, graphPath, edge.toNodeId, visited)
  );
}

function cloneState(state: RuntimeState): RuntimeState {
  return {
    graph: state.graph,
    graphPath: [...state.graphPath],
    stack: [...state.stack],
    currentNodeId: state.currentNodeId,
    displayedBlocks: [...state.displayedBlocks],
    visited: { ...state.visited },
    completedGroups: { ...state.completedGroups },
    finished: state.finished
  };
}

function advanceRuntime(
  state: RuntimeState,
  nextNodeId: string,
  transition: StoryboardEdgeDisplayMode
): RuntimeState {
  const next = cloneState(state);
  let nodeId = nextNodeId;
  let displayMode = transition;
  let guard = 0;

  while (guard < 80) {
    guard += 1;
    const node = findNode(next.graph, nodeId);
    if (!node) {
      next.finished = true;
      return next;
    }

    next.currentNodeId = node.nodeId;
    next.visited[buildNodeKey(next.graphPath, node.nodeId)] = true;

    if (node.kind === 'start') {
      const options = getOutgoingEdges(next.graph, next.graphPath, node.nodeId, 'out-path', next.visited);
      if (options.length === 0) {
        next.finished = true;
        return next;
      }
      if (options.length === 1) {
        nodeId = options[0].toNodeId;
        displayMode = options[0].displayMode;
        continue;
      }
      next.displayedBlocks = [buildRuntimeBlock(next.graphPath, node)];
      next.finished = false;
      return next;
    }

    if (node.kind === 'end') {
      if (next.stack.length === 0) {
        next.finished = true;
        return next;
      }
      const frame = next.stack.pop();
      if (!frame) {
        next.finished = true;
        return next;
      }
      const groupKey = buildNodeKey(frame.parentGraphPath, frame.parentGroupNodeId);
      next.completedGroups[groupKey] = true;
      next.graph = frame.parentGraph;
      next.graphPath = frame.parentGraphPath;
      nodeId = frame.parentGroupNodeId;
      displayMode = 'expand';
      continue;
    }

    if (node.kind === 'group' && !next.completedGroups[buildNodeKey(next.graphPath, node.nodeId)] && node.groupGraph) {
      next.stack.push({
        parentGraph: next.graph,
        parentGraphPath: [...next.graphPath],
        parentGroupNodeId: node.nodeId
      });
      next.graph = node.groupGraph;
      next.graphPath = [...next.graphPath, node.nodeId];
      nodeId = node.groupGraph.startNodeId;
      continue;
    }

    const block = buildRuntimeBlock(next.graphPath, node);
    next.displayedBlocks = displayMode === 'expand' ? [...next.displayedBlocks, block] : [block];
    next.finished = false;
    return next;
  }

  next.finished = true;
  return next;
}

function createInitialRuntime(rootGraph: StoryboardGraph): RuntimeState {
  const base: RuntimeState = {
    graph: rootGraph,
    graphPath: [],
    stack: [],
    currentNodeId: rootGraph.startNodeId,
    displayedBlocks: [],
    visited: {},
    completedGroups: {},
    finished: false
  };
  return advanceRuntime(base, rootGraph.startNodeId, 'new_screen');
}

export function CogitaStoryboardRuntimePage({
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
  projectId,
  shareCode
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
  libraryId?: string;
  projectId?: string;
  shareCode?: string;
}) {
  const navigate = useNavigate();
  const runtimeCopy = copy.cogita.library.modules.storyboardsRuntime;
  const [project, setProject] = useState<CogitaCreationProject | null>(null);
  const [documentState, setDocumentState] = useState<StoryboardDocument | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (shareCode) {
      let cancelled = false;
      setLoading(true);
      setStatus(null);

      getCogitaPublicStoryboardShare({ shareCode })
        .then((share) => {
          if (cancelled) return;
          const normalized = normalizeDocument(share.content);
          setProject({
            projectId: share.projectId,
            projectType: 'storyboard',
            name: share.projectName,
            content: share.content ?? null,
            createdUtc: share.createdUtc,
            updatedUtc: share.createdUtc
          });
          setDocumentState(normalized);
          setRuntime(createInitialRuntime(normalized.rootGraph));
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setStatus(err instanceof Error ? err.message : runtimeCopy.statusLoadSharedFailed);
          setProject(null);
          setDocumentState(null);
          setRuntime(null);
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (!libraryId || !projectId) {
      setLoading(false);
      setStatus(runtimeCopy.statusMissingParams);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStatus(null);

    getCogitaCreationProjects({ libraryId, projectType: 'storyboard' })
      .then((projects) => {
        if (cancelled) return;
        const found = projects.find((item) => item.projectId === projectId) ?? null;
        if (!found) {
          setProject(null);
          setDocumentState(null);
          setRuntime(null);
          setStatus(runtimeCopy.statusNotFound);
          setLoading(false);
          return;
        }

        const normalized = normalizeDocument(found.content);
        setProject(found);
        setDocumentState(normalized);
        setRuntime(createInitialRuntime(normalized.rootGraph));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : runtimeCopy.statusLoadFailed);
        setProject(null);
        setDocumentState(null);
        setRuntime(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [libraryId, projectId, shareCode]);

  const currentNode = useMemo(() => {
    if (!runtime) return null;
    return findNode(runtime.graph, runtime.currentNodeId);
  }, [runtime]);

  const pathChoices = useMemo(() => {
    if (!runtime || !currentNode || currentNode.kind === 'card') return [];
    return getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-path', runtime.visited).map((edge) => {
      const target = findNode(runtime.graph, edge.toNodeId);
      return {
        edge,
        label: edge.label.trim() || target?.title || runtimeCopy.choiceFallback
      };
    });
  }, [currentNode, runtime, runtimeCopy.choiceFallback]);

  const cardRightEdge = useMemo(() => {
    if (!runtime || !currentNode || currentNode.kind !== 'card') return null;
    return getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-right', runtime.visited)[0] ?? null;
  }, [currentNode, runtime]);

  const cardWrongEdge = useMemo(() => {
    if (!runtime || !currentNode || currentNode.kind !== 'card') return null;
    return getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-wrong', runtime.visited)[0] ?? null;
  }, [currentNode, runtime]);

  const chooseEdge = (edge: StoryboardGraphEdge) => {
    setRuntime((current) => {
      if (!current) return current;
      return advanceRuntime(current, edge.toNodeId, edge.displayMode);
    });
  };

  const chooseCardOutcome = (edge: StoryboardGraphEdge | null) => {
    if (!edge) return;
    setRuntime((current) => {
      if (!current) return current;
      return advanceRuntime(current, edge.toNodeId, 'new_screen');
    });
  };

  const restart = () => {
    if (!documentState) return;
    setRuntime(createInitialRuntime(documentState.rootGraph));
    setStatus(null);
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
      headerExtra={
        libraryId && !shareCode ? (
          <button
            type="button"
            className="ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards${projectId ? `/${encodeURIComponent(projectId)}` : ''}`)}
          >
            {runtimeCopy.backAction}
          </button>
        ) : null
      }
    >
      <section className="cogita-section cogita-storyboard-runtime" style={{ maxWidth: 980, margin: '0 auto', width: '100%' }}>
        <header className="cogita-library-header" style={{ marginBottom: '1rem' }}>
          <div>
            <p className="cogita-user-kicker">{runtimeCopy.kicker}</p>
            <h1 className="cogita-library-title" style={{ marginBottom: '0.35rem' }}>{project?.name ?? runtimeCopy.titleFallback}</h1>
            {documentState?.description ? <p className="cogita-library-subtitle">{documentState.description}</p> : null}
          </div>
          <div className="cogita-card-actions">
            <button type="button" className="ghost" onClick={restart} disabled={!documentState || loading}>{runtimeCopy.restartAction}</button>
          </div>
        </header>

        {loading ? <p>{runtimeCopy.loading}</p> : null}
        {status ? <p className="cogita-form-error">{status}</p> : null}

        {!loading && runtime ? (
          <div className="cogita-pane" style={{ display: 'grid', gap: '1rem' }}>
            {runtime.displayedBlocks.map((block) => (
              <article key={block.key} className="cogita-library-detail" style={{ margin: 0 }}>
                <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.55rem' }}>
                  <h3 className="cogita-detail-title" style={{ margin: 0 }}>{block.title || runtimeCopy.blockUntitled}</h3>
                  {block.kind === 'static' ? (
                    <>
                      {block.staticBody ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{block.staticBody}</p> : null}
                      {block.description ? <p className="cogita-help" style={{ margin: 0 }}>{block.description}</p> : null}
                      {(block.staticType === 'video' || block.staticType === 'audio' || block.staticType === 'image') && block.mediaUrl ? (
                        <a className="ghost" href={block.mediaUrl} target="_blank" rel="noreferrer">{runtimeCopy.openMediaAction}</a>
                      ) : null}
                    </>
                  ) : null}
                  {block.kind === 'card' ? (
                    <>
                      <p style={{ margin: 0 }}>
                        {runtimeCopy.knowledgeItemLabel}: <strong>{block.knowledgeItemId || runtimeCopy.knowledgeItemNotSet}</strong>
                      </p>
                      <p className="cogita-help" style={{ margin: 0 }}>
                        {runtimeCopy.directionLabel}: {block.cardDirection === 'back_to_front' ? runtimeCopy.directionBackToFront : runtimeCopy.directionFrontToBack}
                      </p>
                    </>
                  ) : null}
                  {block.kind === 'group' ? (
                    <p className="cogita-help" style={{ margin: 0 }}>{runtimeCopy.groupCompleted}</p>
                  ) : null}
                </div>
              </article>
            ))}

            {runtime.finished ? (
              <div className="cogita-library-detail">
                <div className="cogita-detail-body">
                  <p>{runtimeCopy.finished}</p>
                </div>
              </div>
            ) : null}

            {currentNode?.kind === 'card' && !runtime.finished ? (
              <div className="cogita-card-actions">
                <button type="button" className="cta" onClick={() => chooseCardOutcome(cardRightEdge)} disabled={!cardRightEdge}>{runtimeCopy.rightAction}</button>
                <button type="button" className="ghost" onClick={() => chooseCardOutcome(cardWrongEdge)} disabled={!cardWrongEdge}>{runtimeCopy.wrongAction}</button>
              </div>
            ) : null}

            {currentNode && currentNode.kind !== 'card' && !runtime.finished && pathChoices.length > 0 ? (
              <div className="cogita-card-actions" style={{ flexWrap: 'wrap' }}>
                {pathChoices.map((choice) => (
                  <button key={choice.edge.edgeId} type="button" className="cta ghost" onClick={() => chooseEdge(choice.edge)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </CogitaShell>
  );
}
