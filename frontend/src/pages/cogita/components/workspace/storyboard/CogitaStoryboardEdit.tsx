import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CogitaShell } from '../../../CogitaShell';
import type { Copy } from '../../../../../conte../../types';
import type { RouteKey } from '../../../../../../types/navigation';
import { useCogitaLibraryMeta } from '../../useCogitaLibraryMeta';
import {
  createCogitaStoryboardShare,
  createCogitaCreationProject,
  getCogitaInfoCheckcards,
  getCogitaCreationProjects,
  getCogitaStoryboardShares,
  revokeCogitaStoryboardShare,
  updateCogitaCreationProject,
  type CogitaCardSearchResult,
  type CogitaCreationProject,
  type CogitaStoryboardShare
} from '../../../../../lib/api';
import { CogitaCheckcardList } from '../../shared/CogitaCheckcardList';
import { CogitaNotionSearch, type CogitaNotionSearchResult } from '../../shared/search/CogitaNotionSearch';
import { CogitaWorkspaceComponentOverlay } from '../../shared/search/overlays/CogitaWorkspaceComponentOverlay';
import { CogitaStoryboardSearch } from '../../shared/search/CogitaStoryboardSearch';
import { buildCheckcardKey } from '../../checkcards/checkcardDisplay';

export type StoryboardWorkspaceMode = 'search' | 'create' | 'overview' | 'edit';
export type CogitaStoryboardEditProps = {
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
  mode?: StoryboardWorkspaceMode;
  storyboardId?: string;
  onCreated?: (project: CogitaCreationProject) => void;
  knowledgeSearchLayout?: 'basic' | 'workspace';
};

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
  notionId: string;
  cardCheckType: string;
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
  version: 2;
  description: string;
  script: string;
  steps: string[];
  rootGraph: StoryboardGraph;
};

type StoryboardMetaFormProps = {
  title: string;
  description: string;
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  onSubmit?: () => void;
  readOnly?: boolean;
};

type StoryboardFlowNodeData = {
  kind: StoryboardNodeKind;
  title: string;
  subtitle: string;
};

type StoryboardGraphStats = {
  totalNodes: number;
  staticNodes: number;
  cardNodes: number;
  groupNodes: number;
  totalLinks: number;
  textStatics: number;
  videoStatics: number;
  audioStatics: number;
  imageStatics: number;
  otherStatics: number;
};

type OverlayKnowledgeSort = 'relevance' | 'label_asc' | 'label_desc' | 'type_asc' | 'type_desc';
type OverlayKnowledgeView = 'details' | 'wide' | 'grid';

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function toString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeNodeKind(value: unknown): StoryboardNodeKind {
  if (value === 'start' || value === 'end' || value === 'static' || value === 'card' || value === 'group') {
    return value;
  }
  if (value === 'text' || value === 'video' || value === 'audio' || value === 'image' || value === 'revision') {
    return 'static';
  }
  return 'static';
}

function normalizeStaticType(value: unknown, fallback: StoryboardStaticType = 'text'): StoryboardStaticType {
  if (value === 'text' || value === 'video' || value === 'audio' || value === 'image' || value === 'other') {
    return value;
  }
  if (value === 'revision') return 'other';
  return fallback;
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

function inferSourcePort(raw: Record<string, unknown>, sourceNode: StoryboardNodeRecord | undefined): StoryboardSourcePort {
  const sourcePort = toString(raw.sourcePort).trim();
  if (sourcePort === 'out-right' || sourcePort === 'out-wrong' || sourcePort === 'out-path') {
    return sourcePort;
  }
  const kind = toString(raw.kind).trim();
  if (kind === 'card_right') return 'out-right';
  if (kind === 'card_wrong') return 'out-wrong';
  if (sourceNode?.kind === 'card') return 'out-right';
  return 'out-path';
}

function inferTargetPort(raw: Record<string, unknown>): StoryboardTargetPort {
  const targetPort = toString(raw.targetPort).trim();
  if (targetPort === 'in-path' || targetPort === 'in-dependency') {
    return targetPort;
  }
  const kind = toString(raw.kind).trim();
  if (kind === 'dependency') return 'in-dependency';
  return 'in-path';
}

function isStructuralNode(node: StoryboardNodeRecord) {
  return node.kind === 'start' || node.kind === 'end';
}

function createStartNode(nodeId?: string): StoryboardNodeRecord {
  return {
    nodeId: nodeId ?? createId('start'),
    title: 'Start',
    kind: 'start',
    description: '',
    position: { x: 80, y: 200 },
    staticType: 'text',
    staticBody: '',
    mediaUrl: '',
    notionId: '',
    cardCheckType: '',
    cardDirection: 'front_to_back'
  };
}

function createEndNode(nodeId?: string): StoryboardNodeRecord {
  return {
    nodeId: nodeId ?? createId('end'),
    title: 'End',
    kind: 'end',
    description: '',
    position: { x: 760, y: 200 },
    staticType: 'text',
    staticBody: '',
    mediaUrl: '',
    notionId: '',
    cardCheckType: '',
    cardDirection: 'front_to_back'
  };
}

function createAuthorNode(kind: 'static' | 'card' | 'group', index: number): StoryboardNodeRecord {
  return {
    nodeId: createId(kind),
    title: kind === 'card' ? `Card ${index}` : kind === 'group' ? `Group ${index}` : `Static ${index}`,
    kind,
    description: '',
    position: {
      x: 220 + (index % 4) * 220,
      y: 80 + Math.floor(index / 4) * 170
    },
    staticType: 'text',
    staticBody: '',
    mediaUrl: '',
    notionId: '',
    cardCheckType: '',
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

function createEmptyDocument(description = ''): StoryboardDocument {
  return {
    schema: 'cogita_storyboard_graph',
    version: 2,
    description,
    script: '',
    steps: [],
    rootGraph: createDefaultGraph()
  };
}

function parseGraph(raw: unknown): StoryboardGraph {
  const fallback = createDefaultGraph();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const graphRoot = raw as Record<string, unknown>;
  const rawNodes = Array.isArray(graphRoot.nodes) ? (graphRoot.nodes as Array<Record<string, unknown>>) : [];

  const provisionalNodes = rawNodes.map((node, index) => {
    const kind = normalizeNodeKind(node.kind ?? node.nodeType);
    return {
      nodeId: toString(node.nodeId).trim() || createId(`node${index + 1}`),
      title: toString(node.title).trim() || (kind === 'start' ? 'Start' : kind === 'end' ? 'End' : `Node ${index + 1}`),
      kind,
      description: toString(node.description),
      position: {
        x: toFiniteNumber((node.position as Record<string, unknown> | undefined)?.x, 120 + (index % 4) * 220),
        y: toFiniteNumber((node.position as Record<string, unknown> | undefined)?.y, 80 + Math.floor(index / 4) * 170)
      },
      staticType: normalizeStaticType(node.staticType ?? node.nodeType),
      staticBody: toString(node.staticBody ?? node.text),
      mediaUrl: toString(node.mediaUrl ?? node.videoUrl),
      notionId: toString(node.notionId),
      cardCheckType: toString(node.cardCheckType ?? node.checkType),
      cardDirection: normalizeCardDirection(node.cardDirection),
      groupGraph: kind === 'group' && node.groupGraph ? parseGraph(node.groupGraph) : undefined
    } satisfies StoryboardNodeRecord;
  });

  const uniqueNodes: StoryboardNodeRecord[] = [];
  const knownIds = new Set<string>();
  provisionalNodes.forEach((node) => {
    if (knownIds.has(node.nodeId)) return;
    knownIds.add(node.nodeId);
    uniqueNodes.push(node);
  });

  const startFromRoot = toString(graphRoot.startNodeId).trim();
  const endFromRoot = toString(graphRoot.endNodeId).trim();
  const explicitStart = uniqueNodes.find((node) => node.kind === 'start');
  const explicitEnd = uniqueNodes.find((node) => node.kind === 'end');

  const startNodeId =
    (startFromRoot && uniqueNodes.some((node) => node.nodeId === startFromRoot && node.kind === 'start') ? startFromRoot : undefined) ??
    explicitStart?.nodeId ??
    createId('start');
  const endNodeId =
    (endFromRoot && uniqueNodes.some((node) => node.nodeId === endFromRoot && node.kind === 'end') ? endFromRoot : undefined) ??
    explicitEnd?.nodeId ??
    createId('end');

  const nodesWithoutExtraStructural = uniqueNodes.filter((node) => {
    if (node.kind === 'start') return node.nodeId === startNodeId;
    if (node.kind === 'end') return node.nodeId === endNodeId;
    return true;
  });

  const hasStart = nodesWithoutExtraStructural.some((node) => node.nodeId === startNodeId && node.kind === 'start');
  const hasEnd = nodesWithoutExtraStructural.some((node) => node.nodeId === endNodeId && node.kind === 'end');

  const normalizedNodes = [...nodesWithoutExtraStructural];
  if (!hasStart) normalizedNodes.unshift(createStartNode(startNodeId));
  if (!hasEnd) normalizedNodes.push(createEndNode(endNodeId));

  const nodeById = new Map(normalizedNodes.map((node) => [node.nodeId, node]));

  const rawEdges = Array.isArray(graphRoot.edges) ? (graphRoot.edges as Array<Record<string, unknown>>) : [];
  const provisionalEdges = rawEdges
    .map((edge) => {
      const fromNodeId = toString(edge.fromNodeId).trim();
      const toNodeId = toString(edge.toNodeId).trim();
      if (!fromNodeId || !toNodeId) return null;
      const sourceNode = nodeById.get(fromNodeId);
      const sourcePort = inferSourcePort(edge, sourceNode);
      const targetPort = inferTargetPort(edge);
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
    .filter((edge): edge is StoryboardGraphEdge => Boolean(edge));

  const edgeKeys = new Set<string>();
  const normalizedEdges = provisionalEdges.filter((edge) => {
    const sourceNode = nodeById.get(edge.fromNodeId);
    const targetNode = nodeById.get(edge.toNodeId);
    if (!sourceNode || !targetNode) return false;
    if (edge.fromNodeId === edge.toNodeId) return false;
    if (targetNode.kind === 'start') return false;
    if (sourceNode.kind === 'end') return false;
    const uniqueKey = `${edge.fromNodeId}:${edge.sourcePort}->${edge.toNodeId}:${edge.targetPort}`;
    if (edgeKeys.has(uniqueKey)) return false;
    edgeKeys.add(uniqueKey);
    return true;
  });

  const finalEdges: StoryboardGraphEdge[] = normalizedEdges.length > 0
    ? normalizedEdges
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
        } satisfies StoryboardGraphEdge
      ];

  return {
    startNodeId,
    endNodeId,
    nodes: normalizedNodes,
    edges: finalEdges
  };
}

function buildLegacyGraphFromV1(root: Record<string, unknown>): StoryboardGraph {
  const base = createDefaultGraph();
  const rawNodes = Array.isArray(root.nodes) ? (root.nodes as Array<Record<string, unknown>>) : [];
  const convertedNodes = rawNodes.map((item, index) => {
    const nodeType = toString(item.nodeType).trim().toLowerCase();
    const kind: StoryboardNodeKind = nodeType === 'card' ? 'card' : nodeType === 'group' ? 'group' : 'static';
    return {
      nodeId: toString(item.nodeId).trim() || createId(`legacy-${index + 1}`),
      title: toString(item.title).trim() || `Step ${index + 1}`,
      kind,
      description: toString(item.description),
      position: {
        x: toFiniteNumber((item.position as Record<string, unknown> | undefined)?.x, 220 + (index % 4) * 220),
        y: toFiniteNumber((item.position as Record<string, unknown> | undefined)?.y, 80 + Math.floor(index / 4) * 170)
      },
      staticType: normalizeStaticType(item.nodeType, 'text'),
      staticBody: toString(item.text),
      mediaUrl: toString(item.videoUrl),
      notionId: toString(item.notionId),
      cardCheckType: toString(item.cardCheckType ?? item.checkType),
      cardDirection: normalizeCardDirection(item.cardDirection)
    } satisfies StoryboardNodeRecord;
  });

  const nodes: StoryboardNodeRecord[] = [
    ...base.nodes,
    ...convertedNodes.filter((node) => node.nodeId !== base.startNodeId && node.nodeId !== base.endNodeId)
  ];

  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const edges: StoryboardGraphEdge[] = [];

  const configuredStart = toString(root.startNodeId).trim();
  const startTarget = configuredStart && nodeIds.has(configuredStart) ? configuredStart : convertedNodes[0]?.nodeId;
  if (startTarget) {
    edges.push({
      edgeId: createId('edge'),
      fromNodeId: base.startNodeId,
      toNodeId: startTarget,
      sourcePort: 'out-path',
      targetPort: 'in-path',
      kind: 'path',
      label: '',
      displayMode: 'new_screen'
    });
  }

  convertedNodes.forEach((node) => {
    const raw = rawNodes.find((item) => toString(item.nodeId).trim() === node.nodeId);
    const dependencies = Array.isArray(raw?.dependencies) ? (raw?.dependencies as Array<Record<string, unknown>>) : [];
    const outcomes = Array.isArray(raw?.outcomes) ? (raw?.outcomes as Array<Record<string, unknown>>) : [];

    const firstDependency = dependencies
      .map((dependency) => toString(dependency.nodeId).trim())
      .find((depNodeId) => depNodeId && nodeIds.has(depNodeId));

    if (firstDependency) {
      edges.push({
        edgeId: createId('edge'),
        fromNodeId: firstDependency,
        toNodeId: node.nodeId,
        sourcePort: 'out-path',
        targetPort: 'in-dependency',
        kind: 'dependency',
        label: '',
        displayMode: 'new_screen'
      });
    }

    const validTargets = outcomes
      .map((outcome) => toString(outcome.toNodeId).trim())
      .filter((toNodeId) => toNodeId && nodeIds.has(toNodeId));

    if (node.kind === 'card') {
      if (validTargets[0]) {
        edges.push({
          edgeId: createId('edge'),
          fromNodeId: node.nodeId,
          toNodeId: validTargets[0],
          sourcePort: 'out-right',
          targetPort: 'in-path',
          kind: 'card_right',
          label: '',
          displayMode: 'new_screen'
        });
      }
      if (validTargets[1]) {
        edges.push({
          edgeId: createId('edge'),
          fromNodeId: node.nodeId,
          toNodeId: validTargets[1],
          sourcePort: 'out-wrong',
          targetPort: 'in-path',
          kind: 'card_wrong',
          label: '',
          displayMode: 'new_screen'
        });
      }
    } else if (validTargets[0]) {
      edges.push({
        edgeId: createId('edge'),
        fromNodeId: node.nodeId,
        toNodeId: validTargets[0],
        sourcePort: 'out-path',
        targetPort: 'in-path',
        kind: 'path',
        label: '',
        displayMode: 'new_screen'
      });
    }
  });

  if (edges.length === 0) {
    edges.push(...base.edges);
  }

  return {
    startNodeId: base.startNodeId,
    endNodeId: base.endNodeId,
    nodes,
    edges
  };
}

function buildLegacyGraphFromScript(content: unknown): StoryboardGraph {
  const base = createDefaultGraph();
  let script = '';

  if (typeof content === 'string') {
    script = content;
  } else if (content && typeof content === 'object') {
    const root = content as Record<string, unknown>;
    if (typeof root.script === 'string') {
      script = root.script;
    } else if (Array.isArray(root.steps)) {
      script = root.steps.map((step) => toString(step).trim()).filter(Boolean).join('\n\n');
    } else if (typeof root.body === 'string') {
      script = root.body;
    }
  }

  const normalized = script.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return base;
  }

  const parts = normalized
    .split(/\n{2,}|\n---+\n/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parts.length === 0) {
    return base;
  }

  const nodes = [...base.nodes];
  const edges: StoryboardGraphEdge[] = [];

  let previous = base.startNodeId;
  parts.forEach((part, index) => {
    const node = createAuthorNode('static', index + 1);
    node.title = `Step ${index + 1}`;
    node.staticBody = part;
    nodes.push(node);
    edges.push({
      edgeId: createId('edge'),
      fromNodeId: previous,
      toNodeId: node.nodeId,
      sourcePort: 'out-path',
      targetPort: 'in-path',
      kind: 'path',
      label: '',
      displayMode: 'new_screen'
    });
    previous = node.nodeId;
  });

  edges.push({
    edgeId: createId('edge'),
    fromNodeId: previous,
    toNodeId: base.endNodeId,
    sourcePort: 'out-path',
    targetPort: 'in-path',
    kind: 'path',
    displayMode: 'new_screen',
    label: ''
  });

  return {
    startNodeId: base.startNodeId,
    endNodeId: base.endNodeId,
    nodes,
    edges
  };
}

function normalizeStoryboardDocument(content: unknown): StoryboardDocument {
  if (content && typeof content === 'object') {
    const root = content as Record<string, unknown>;
    if (root.schema === 'cogita_storyboard_graph' && root.rootGraph) {
      const parsedRootGraph = parseGraph(root.rootGraph);
      const script = toString(root.script);
      const steps = Array.isArray(root.steps)
        ? root.steps.map((step) => toString(step).trim()).filter((step) => step.length > 0)
        : [];
      return {
        schema: 'cogita_storyboard_graph',
        version: 2,
        description: toString(root.description),
        script,
        steps,
        rootGraph: parsedRootGraph
      };
    }

    if (root.schema === 'cogita_storyboard_graph' && Array.isArray(root.nodes)) {
      return {
        schema: 'cogita_storyboard_graph',
        version: 2,
        description: toString(root.description),
        script: toString(root.script),
        steps: Array.isArray(root.steps) ? root.steps.map((step) => toString(step)) : [],
        rootGraph: buildLegacyGraphFromV1(root)
      };
    }
  }

  return {
    schema: 'cogita_storyboard_graph',
    version: 2,
    description: '',
    script: '',
    steps: [],
    rootGraph: buildLegacyGraphFromScript(content)
  };
}

function collectScriptLines(graph: StoryboardGraph, depth = 0): string[] {
  const lines: string[] = [];
  const nodes = graph.nodes
    .filter((node) => !isStructuralNode(node))
    .slice()
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  const prefix = depth > 0 ? `${'  '.repeat(depth)}- ` : '';

  nodes.forEach((node) => {
    if (node.kind === 'static') {
      const payload = node.staticBody.trim() || node.description.trim() || node.title;
      lines.push(`${prefix}Static (${node.staticType}): ${payload}`);
      return;
    }

    if (node.kind === 'card') {
      const payload = node.notionId.trim() || node.title;
      const checkTag = node.cardCheckType.trim() ? ` / ${node.cardCheckType.trim()}` : '';
      lines.push(`${prefix}Card (${node.cardDirection}${checkTag}): ${payload}`);
      return;
    }

    if (node.kind === 'group') {
      lines.push(`${prefix}Group: ${node.title}`);
      if (node.groupGraph) {
        lines.push(...collectScriptLines(node.groupGraph, depth + 1));
      }
    }
  });

  return lines;
}

function buildDocumentForSave(documentState: StoryboardDocument, description: string): StoryboardDocument {
  const nextDescription = description.trim();
  const lines = collectScriptLines(documentState.rootGraph);
  return {
    ...documentState,
    description: nextDescription,
    steps: lines,
    script: lines.join('\n\n---\n\n')
  };
}

function collectGraphStats(rootGraph: StoryboardGraph): StoryboardGraphStats {
  const stats: StoryboardGraphStats = {
    totalNodes: 0,
    staticNodes: 0,
    cardNodes: 0,
    groupNodes: 0,
    totalLinks: 0,
    textStatics: 0,
    videoStatics: 0,
    audioStatics: 0,
    imageStatics: 0,
    otherStatics: 0
  };

  const walk = (graph: StoryboardGraph) => {
    stats.totalLinks += graph.edges.length;
    graph.nodes.forEach((node) => {
      if (isStructuralNode(node)) return;
      stats.totalNodes += 1;
      if (node.kind === 'static') {
        stats.staticNodes += 1;
        if (node.staticType === 'text') stats.textStatics += 1;
        else if (node.staticType === 'video') stats.videoStatics += 1;
        else if (node.staticType === 'audio') stats.audioStatics += 1;
        else if (node.staticType === 'image') stats.imageStatics += 1;
        else stats.otherStatics += 1;
        return;
      }
      if (node.kind === 'card') {
        stats.cardNodes += 1;
        return;
      }
      if (node.kind === 'group') {
        stats.groupNodes += 1;
        if (node.groupGraph) {
          walk(node.groupGraph);
        }
      }
    });
  };

  walk(rootGraph);
  return stats;
}

function getGraphAtPath(rootGraph: StoryboardGraph, groupPath: string[]): StoryboardGraph {
  let currentGraph = rootGraph;
  for (const nodeId of groupPath) {
    const groupNode = currentGraph.nodes.find((node) => node.nodeId === nodeId && node.kind === 'group');
    if (!groupNode?.groupGraph) {
      return currentGraph;
    }
    currentGraph = groupNode.groupGraph;
  }
  return currentGraph;
}

function updateGraphAtPath(
  graph: StoryboardGraph,
  groupPath: string[],
  updater: (target: StoryboardGraph) => StoryboardGraph
): StoryboardGraph {
  if (groupPath.length === 0) {
    return updater(graph);
  }

  const [head, ...tail] = groupPath;
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.nodeId !== head || node.kind !== 'group') return node;
      const baseGraph = node.groupGraph ?? createDefaultGraph();
      return {
        ...node,
        groupGraph: updateGraphAtPath(baseGraph, tail, updater)
      };
    })
  };
}

function getGroupPathLabels(rootGraph: StoryboardGraph, groupPath: string[]) {
  const labels: Array<{ nodeId: string; title: string }> = [];
  let currentGraph = rootGraph;

  for (const nodeId of groupPath) {
    const groupNode = currentGraph.nodes.find((node) => node.nodeId === nodeId && node.kind === 'group');
    if (!groupNode) break;
    labels.push({ nodeId, title: groupNode.title || nodeId });
    currentGraph = groupNode.groupGraph ?? currentGraph;
  }

  return labels;
}

function getEdgeKindLabel(
  kind: StoryboardEdgeKind,
  labels: { dependency: string; right: string; wrong: string }
) {
  if (kind === 'dependency') return labels.dependency;
  if (kind === 'card_right') return labels.right;
  if (kind === 'card_wrong') return labels.wrong;
  return '';
}

function getEdgeVisual(kind: StoryboardEdgeKind, selected: boolean) {
  if (kind === 'dependency') {
    return {
      stroke: selected ? 'rgba(255, 229, 180, 0.98)' : 'rgba(255, 206, 133, 0.9)',
      dash: '7 4',
      labelColor: 'rgba(255, 231, 196, 0.96)'
    };
  }
  if (kind === 'card_right') {
    return {
      stroke: selected ? 'rgba(196, 255, 214, 0.98)' : 'rgba(135, 236, 165, 0.95)',
      dash: undefined,
      labelColor: 'rgba(204, 252, 220, 0.95)'
    };
  }
  if (kind === 'card_wrong') {
    return {
      stroke: selected ? 'rgba(255, 205, 205, 0.98)' : 'rgba(246, 146, 146, 0.95)',
      dash: undefined,
      labelColor: 'rgba(255, 218, 218, 0.95)'
    };
  }
  return {
    stroke: selected ? 'rgba(194, 230, 255, 0.98)' : 'rgba(147, 208, 255, 0.95)',
    dash: undefined,
    labelColor: 'rgba(206, 235, 255, 0.94)'
  };
}

function getNodeVisual(kind: StoryboardNodeKind) {
  if (kind === 'start') {
    return {
      border: 'rgba(126, 236, 172, 0.95)',
      bg: 'rgba(15, 66, 38, 0.92)',
      badge: 'START'
    };
  }
  if (kind === 'end') {
    return {
      border: 'rgba(255, 166, 166, 0.94)',
      bg: 'rgba(83, 32, 32, 0.9)',
      badge: 'END'
    };
  }
  if (kind === 'card') {
    return {
      border: 'rgba(245, 205, 127, 0.96)',
      bg: 'rgba(74, 53, 19, 0.9)',
      badge: 'CARD'
    };
  }
  if (kind === 'group') {
    return {
      border: 'rgba(205, 174, 255, 0.95)',
      bg: 'rgba(56, 36, 86, 0.9)',
      badge: 'GROUP'
    };
  }
  return {
    border: 'rgba(141, 214, 255, 0.95)',
    bg: 'rgba(18, 48, 77, 0.92)',
    badge: 'STATIC'
  };
}

function StoryboardFlowNode({ data }: NodeProps<StoryboardFlowNodeData>) {
  const visual = getNodeVisual(data.kind);

  const handleBase = {
    width: 10,
    height: 10,
    borderRadius: 999,
    border: '2px solid rgba(9, 20, 36, 0.95)',
    background: '#89d2ff'
  };

  return (
    <div
      style={{
        width: 218,
        borderRadius: 12,
        border: `1px solid ${visual.border}`,
        background: visual.bg,
        color: 'rgba(238, 246, 255, 0.95)',
        padding: '0.5rem 0.58rem',
        display: 'grid',
        gap: '0.22rem',
        boxShadow: '0 8px 22px rgba(0, 0, 0, 0.28)'
      }}
    >
      {data.kind !== 'start' ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="in-path"
            style={{ ...handleBase, left: -7, top: '35%', background: 'rgba(148, 209, 255, 0.96)' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="in-dependency"
            style={{ ...handleBase, left: -7, top: '72%', background: 'rgba(255, 207, 129, 0.98)' }}
          />
        </>
      ) : null}

      {data.kind === 'card' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="out-right"
            style={{ ...handleBase, right: -7, top: '35%', background: 'rgba(154, 241, 178, 0.98)' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out-wrong"
            style={{ ...handleBase, right: -7, top: '72%', background: 'rgba(252, 166, 166, 0.98)' }}
          />
        </>
      ) : null}

      {data.kind !== 'card' && data.kind !== 'end' ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-path"
          style={{ ...handleBase, right: -7, top: '53%', background: 'rgba(148, 209, 255, 0.96)' }}
        />
      ) : null}

      <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', opacity: 0.9 }}>{visual.badge}</div>
      <strong style={{ fontSize: '0.9rem', lineHeight: 1.2 }}>{data.title}</strong>
      <small style={{ fontSize: '0.73rem', color: 'rgba(205, 228, 249, 0.92)' }}>{data.subtitle}</small>
    </div>
  );
}

function StoryboardMetaForm({
  title,
  description,
  titleLabel,
  titlePlaceholder,
  descriptionLabel,
  descriptionPlaceholder,
  onTitleChange,
  onDescriptionChange,
  submitLabel,
  submitDisabled,
  onSubmit,
  readOnly = false
}: StoryboardMetaFormProps) {
  return (
    <div className="cogita-storyboard-meta-form">
      <label className="cogita-field full">
        <span>{titleLabel}</span>
        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          disabled={readOnly}
        />
      </label>
      <label className="cogita-field full">
        <span>{descriptionLabel}</span>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={descriptionPlaceholder}
          rows={4}
          disabled={readOnly}
        />
      </label>
      {onSubmit && submitLabel ? (
        <div className="cogita-form-actions">
          <button type="button" className="cta" onClick={onSubmit} disabled={submitDisabled || readOnly}>
            {submitLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CogitaStoryboardEdit({
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
  mode,
  storyboardId,
  onCreated,
  knowledgeSearchLayout
}: CogitaStoryboardEditProps) {
  const resolvedMode: StoryboardWorkspaceMode = mode ?? (storyboardId ? 'edit' : 'create');
  const resolvedKnowledgeSearchLayout: 'basic' | 'workspace' =
    knowledgeSearchLayout ?? (resolvedMode === 'create' || resolvedMode === 'edit' ? 'workspace' : 'basic');
  const navigate = useNavigate();
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const storyboardEditorCopy = copy.cogita.library.modules.storyboardsEditor;
  const listCopy = copy.cogita.library.list;
  const overlaySortOptions: Array<{ value: OverlayKnowledgeSort; label: string }> = [
    { value: 'relevance', label: listCopy.sortRelevance },
    { value: 'label_asc', label: listCopy.sortLabelAsc },
    { value: 'label_desc', label: listCopy.sortLabelDesc },
    { value: 'type_asc', label: listCopy.sortTypeAsc },
    { value: 'type_desc', label: listCopy.sortTypeDesc }
  ];
  const staticTypeOptions: Array<{ value: StoryboardStaticType; label: string }> = [
    { value: 'text', label: storyboardEditorCopy.staticTypeText },
    { value: 'video', label: storyboardEditorCopy.staticTypeVideo },
    { value: 'audio', label: storyboardEditorCopy.staticTypeAudio },
    { value: 'image', label: storyboardEditorCopy.staticTypeImage },
    { value: 'other', label: storyboardEditorCopy.staticTypeOther }
  ];
  const staticTypeLabels: Record<StoryboardStaticType, string> = {
    text: storyboardEditorCopy.staticTypeText,
    video: storyboardEditorCopy.staticTypeVideo,
    audio: storyboardEditorCopy.staticTypeAudio,
    image: storyboardEditorCopy.staticTypeImage,
    other: storyboardEditorCopy.staticTypeOther
  };
  const directionLabels: Record<StoryboardCardDirection, string> = {
    front_to_back: storyboardEditorCopy.cardDirectionFrontToBack,
    back_to_front: storyboardEditorCopy.cardDirectionBackToFront
  };

  const isSearchMode = resolvedMode === 'search';
  const isCreateMode = resolvedMode === 'create';
  const isOverviewMode = resolvedMode === 'overview';
  const isEditMode = resolvedMode === 'edit';
  const canEdit = isCreateMode || isEditMode;

  const [items, setItems] = useState<CogitaCreationProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [documentState, setDocumentState] = useState<StoryboardDocument>(() => createEmptyDocument(''));
  const [activeGroupPath, setActiveGroupPath] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [overlaySearchQuery, setOverlaySearchQuery] = useState('');
  const [overlaySortBy, setOverlaySortBy] = useState<OverlayKnowledgeSort>('relevance');
  const [overlayViewMode, setOverlayViewMode] = useState<OverlayKnowledgeView>('details');
  const [overlaySearchStatus, setOverlaySearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [overlayRawResults, setOverlayRawResults] = useState<CogitaNotionSearchResult[]>([]);
  const [cardNodeCards, setCardNodeCards] = useState<Record<string, CogitaCardSearchResult[]>>({});
  const [cardNodeInfoLabels, setCardNodeInfoLabels] = useState<Record<string, string>>({});
  const [cardNodeCardsStatus, setCardNodeCardsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [activeShare, setActiveShare] = useState<CogitaStoryboardShare | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    getCogitaCreationProjects({ libraryId, projectType: 'storyboard' })
      .then((projects) => {
        if (cancelled) return;
        setItems(projects);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setLoadFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  const selectedProject = useMemo(
    () => (storyboardId ? items.find((item) => item.projectId === storyboardId) ?? null : null),
    [items, storyboardId]
  );

  useEffect(() => {
    if (!selectedProject) {
      setProjectTitle('');
      setProjectDescription('');
      setDocumentState(createEmptyDocument(''));
      setActiveGroupPath([]);
      setSelectedNodeId('');
      setSelectedEdgeId('');
      setCardPickerOpen(false);
      setCardNodeCards({});
      setCardNodeInfoLabels({});
      setCardNodeCardsStatus('idle');
      return;
    }

    const normalized = normalizeStoryboardDocument(selectedProject.content);
    const initialGraph = normalized.rootGraph;
    setProjectTitle(selectedProject.name);
    setProjectDescription(normalized.description);
    setDocumentState(normalized);
    setActiveGroupPath([]);
    setSelectedNodeId(initialGraph.startNodeId);
    setSelectedEdgeId('');
    setCardPickerOpen(false);
    setCardNodeCards({});
    setCardNodeInfoLabels({});
    setCardNodeCardsStatus('idle');
    setActiveShare(null);
    setShareStatus('idle');
    setShareCopyStatus('idle');
  }, [selectedProject]);

  useEffect(() => {
    setShareCopyStatus('idle');
  }, [resolvedMode]);

  useEffect(() => {
    if (!selectedProject || !isOverviewMode) {
      setActiveShare(null);
      setShareStatus('idle');
      return;
    }

    let cancelled = false;
    setShareStatus('working');
    getCogitaStoryboardShares({ libraryId })
      .then((shares) => {
        if (cancelled) return;
        const current = shares.find((share) => share.projectId === selectedProject.projectId && !share.revokedUtc) ?? null;
        setActiveShare(current);
        setShareStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setActiveShare(null);
        setShareStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isOverviewMode, libraryId, selectedProject]);

  const activeGraph = useMemo(
    () => getGraphAtPath(documentState.rootGraph, activeGroupPath),
    [documentState.rootGraph, activeGroupPath]
  );

  useEffect(() => {
    if (selectedNodeId && !activeGraph.nodes.some((node) => node.nodeId === selectedNodeId)) {
      setSelectedNodeId(activeGraph.startNodeId);
    }
    if (selectedEdgeId && !activeGraph.edges.some((edge) => edge.edgeId === selectedEdgeId)) {
      setSelectedEdgeId('');
    }
  }, [activeGraph, selectedEdgeId, selectedNodeId]);

  const selectedNode = useMemo(
    () => activeGraph.nodes.find((node) => node.nodeId === selectedNodeId) ?? null,
    [activeGraph.nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => activeGraph.edges.find((edge) => edge.edgeId === selectedEdgeId) ?? null,
    [activeGraph.edges, selectedEdgeId]
  );

  useEffect(() => {
    if (!selectedNode || selectedNode.kind !== 'card' || !selectedNode.notionId.trim()) {
      setCardNodeCardsStatus('idle');
      return;
    }
    if (cardNodeCards[selectedNode.nodeId]) {
      return;
    }

    let cancelled = false;
    setCardNodeCardsStatus('loading');
    getCogitaInfoCheckcards({ libraryId, infoId: selectedNode.notionId.trim() })
      .then((bundle) => {
        if (cancelled) return;
        setCardNodeCards((current) => ({ ...current, [selectedNode.nodeId]: bundle.items }));
        setCardNodeCardsStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setCardNodeCards((current) => ({ ...current, [selectedNode.nodeId]: [] }));
        setCardNodeCardsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [cardNodeCards, libraryId, selectedNode]);

  const groupPathLabels = useMemo(
    () => getGroupPathLabels(documentState.rootGraph, activeGroupPath),
    [activeGroupPath, documentState.rootGraph]
  );

  const flowNodes = useMemo<Node<StoryboardFlowNodeData>[]>(
    () =>
      activeGraph.nodes.map((node) => {
        const kindLabel = node.kind === 'static'
          ? `${storyboardEditorCopy.nodeKindStatic} · ${staticTypeLabels[node.staticType]}`
          : node.kind === 'card'
            ? `${storyboardEditorCopy.nodeKindCard} · ${directionLabels[node.cardDirection]}`
            : node.kind === 'group'
              ? storyboardEditorCopy.nodeKindGroup
              : node.kind === 'start'
                ? storyboardEditorCopy.nodeKindStart
                : storyboardEditorCopy.nodeKindEnd;

        return {
          id: node.nodeId,
          type: 'storyboardNode',
          data: {
            kind: node.kind,
            title: node.title || node.nodeId,
            subtitle: kindLabel
          },
          position: node.position,
          draggable: canEdit,
          selectable: true,
          selected: node.nodeId === selectedNodeId
        };
      }),
    [activeGraph.nodes, canEdit, directionLabels, selectedNodeId, staticTypeLabels, storyboardEditorCopy.nodeKindCard, storyboardEditorCopy.nodeKindEnd, storyboardEditorCopy.nodeKindGroup, storyboardEditorCopy.nodeKindStart, storyboardEditorCopy.nodeKindStatic]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      activeGraph.edges.map((edge) => {
        const isSelected = edge.edgeId === selectedEdgeId;
        const visual = getEdgeVisual(edge.kind, isSelected);
        const edgeLabel = edge.kind === 'path'
          ? edge.label.trim()
          : getEdgeKindLabel(edge.kind, {
              dependency: storyboardEditorCopy.edgeKindDependency,
              right: storyboardEditorCopy.edgeKindRight,
              wrong: storyboardEditorCopy.edgeKindWrong
            });
        return {
          id: edge.edgeId,
          source: edge.fromNodeId,
          target: edge.toNodeId,
          sourceHandle: edge.sourcePort,
          targetHandle: edge.targetPort,
          focusable: true,
          selected: edge.edgeId === selectedEdgeId,
          interactionWidth: 32,
          label: edgeLabel || undefined,
          animated: edge.kind === 'dependency',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: visual.stroke
          },
          style: {
            stroke: visual.stroke,
            strokeWidth: isSelected ? 2.3 : 1.7,
            strokeDasharray: visual.dash
          },
          labelStyle: {
            fill: visual.labelColor,
            fontSize: 11,
            fontWeight: 600
          }
        } satisfies Edge;
      }),
    [activeGraph.edges, selectedEdgeId, storyboardEditorCopy.edgeKindDependency, storyboardEditorCopy.edgeKindRight, storyboardEditorCopy.edgeKindWrong]
  );

  const nodeTypes = useMemo(() => ({ storyboardNode: StoryboardFlowNode }), []);

  const selectedNodeCards = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== 'card') return [] as CogitaCardSearchResult[];
    return cardNodeCards[selectedNode.nodeId] ?? [];
  }, [cardNodeCards, selectedNode]);

  const selectedCardKey = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== 'card') return '';
    return `${selectedNode.cardCheckType || ''}|${selectedNode.cardDirection || ''}`;
  }, [selectedNode]);

  const overlayVisibleResults = useMemo(() => {
    const next = [...overlayRawResults];
    switch (overlaySortBy) {
      case 'label_asc':
        next.sort((a, b) => a.info.label.localeCompare(b.info.label));
        break;
      case 'label_desc':
        next.sort((a, b) => b.info.label.localeCompare(a.info.label));
        break;
      case 'type_asc':
        next.sort((a, b) => (a.info.infoType === b.info.infoType ? a.info.label.localeCompare(b.info.label) : a.info.infoType.localeCompare(b.info.infoType)));
        break;
      case 'type_desc':
        next.sort((a, b) => (a.info.infoType === b.info.infoType ? a.info.label.localeCompare(b.info.label) : b.info.infoType.localeCompare(a.info.infoType)));
        break;
      default:
        break;
    }
    return next;
  }, [overlayRawResults, overlaySortBy]);

  const handleOverlayKnowledgeSelect = (result: CogitaNotionSearchResult) => {
    if (!selectedNode || selectedNode.kind !== 'card') return;
    const fallbackDirection: StoryboardCardDirection =
      result.cards[0]?.direction === 'back_to_front' || result.cards[0]?.direction === 'front_to_back'
        ? result.cards[0].direction
        : selectedNode.cardDirection;
    updateSelectedNode((node) => ({
      ...node,
      notionId: result.info.infoId,
      cardCheckType: result.cards[0]?.checkType ?? '',
      cardDirection: fallbackDirection
    }));
    setCardNodeInfoLabels((current) => ({
      ...current,
      [selectedNode.nodeId]: result.info.label
    }));
    setCardNodeCards((current) => ({
      ...current,
      [selectedNode.nodeId]: result.cards
    }));
    setCardNodeCardsStatus('idle');
    setCardPickerOpen(false);
    setOverlaySearchQuery('');
    setOverlaySearchStatus('idle');
    setOverlayRawResults([]);
  };

  const updateActiveGraph = (updater: (graph: StoryboardGraph) => StoryboardGraph) => {
    setDocumentState((current) => ({
      ...current,
      rootGraph: updateGraphAtPath(current.rootGraph, activeGroupPath, updater)
    }));
  };

  const updateSelectedNode = (updater: (node: StoryboardNodeRecord) => StoryboardNodeRecord) => {
    if (!selectedNode || !canEdit || isStructuralNode(selectedNode)) return;
    updateActiveGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => (node.nodeId === selectedNode.nodeId ? updater(node) : node))
    }));
  };

  const navigateToSearch = () => {
    navigate(`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards`);
  };

  const navigateToCreate = () => {
    navigate(`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards/new`);
  };

  const navigateToOverview = (projectId: string) => {
    navigate(`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards/${encodeURIComponent(projectId)}`);
  };

  const navigateToEdit = (projectId: string) => {
    navigate(`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards/${encodeURIComponent(projectId)}/edit`);
  };

  const saveProject = async () => {
    if (saving) return;
    const trimmedTitle = projectTitle.trim();
    const trimmedDescription = projectDescription.trim();
    if (!trimmedTitle) {
      setSaveFailed(true);
      setStatus(storyboardEditorCopy.titleRequired);
      return;
    }

    setSaveFailed(false);
    setSaving(true);
    setStatus(null);

    try {
      const prepared = buildDocumentForSave(documentState, trimmedDescription);
      if (isCreateMode) {
        const created = await createCogitaCreationProject({
          libraryId,
          projectType: 'storyboard',
          name: trimmedTitle,
          content: prepared
        });
        setItems((current) => [created, ...current]);
        setStatus(storyboardEditorCopy.createdStatus);
        if (onCreated) {
          onCreated(created);
        } else {
          navigateToEdit(created.projectId);
        }
      } else {
        const editProjectId = selectedProject?.projectId ?? storyboardId;
        if (!editProjectId) {
          setSaveFailed(true);
          setStatus(storyboardEditorCopy.idMissing);
          return;
        }
        const updated = await updateCogitaCreationProject({
          libraryId,
          projectId: editProjectId,
          name: trimmedTitle,
          content: prepared
        });
        setItems((current) => {
          const index = current.findIndex((item) => item.projectId === updated.projectId);
          if (index < 0) {
            return [updated, ...current];
          }
          const next = current.slice();
          next[index] = updated;
          return next;
        });
        setStatus(storyboardEditorCopy.savedStatus);
      }
    } catch {
      setSaveFailed(true);
      setStatus(copy.cogita.library.modules.createFailed);
    } finally {
      setSaving(false);
    }
  };

  const addNode = (kind: 'static' | 'card' | 'group') => {
    if (!canEdit) return;
    updateActiveGraph((graph) => {
      const authorCount = graph.nodes.filter((node) => !isStructuralNode(node)).length;
      const newNode = createAuthorNode(kind, authorCount + 1);
      setSelectedNodeId(newNode.nodeId);
      return {
        ...graph,
        nodes: [...graph.nodes, newNode]
      };
    });
  };

  const removeSelectedNode = () => {
    if (!selectedNode || !canEdit || isStructuralNode(selectedNode)) return;
    const removedNodeId = selectedNode.nodeId;
    updateActiveGraph((graph) => {
      const nextNodes = graph.nodes.filter((node) => node.nodeId !== removedNodeId);
      const nextEdges = graph.edges.filter((edge) => edge.fromNodeId !== removedNodeId && edge.toNodeId !== removedNodeId);
      return {
        ...graph,
        nodes: nextNodes,
        edges: nextEdges
      };
    });
    setSelectedNodeId(activeGraph.startNodeId);
    setSelectedEdgeId('');
  };

  const removeSelectedEdge = () => {
    if (!selectedEdge || !canEdit) return;
    updateActiveGraph((graph) => ({
      ...graph,
      edges: graph.edges.filter((edge) => edge.edgeId !== selectedEdge.edgeId)
    }));
    setSelectedEdgeId('');
  };

  const setNodePosition = (nodeId: string, position: { x: number; y: number }) => {
    if (!canEdit) return;
    updateActiveGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              position: {
                x: Number.isFinite(position.x) ? position.x : node.position.x,
                y: Number.isFinite(position.y) ? position.y : node.position.y
              }
            }
          : node
      )
    }));
  };

  const getSourcePort = (sourceNode: StoryboardNodeRecord | undefined, handleId?: string | null): StoryboardSourcePort | null => {
    if (!sourceNode) return null;
    if (sourceNode.kind === 'card') {
      if (handleId === 'out-right' || handleId === 'out-wrong') return handleId;
      return null;
    }
    if (sourceNode.kind === 'end') return null;
    return 'out-path';
  };

  const getTargetPort = (targetNode: StoryboardNodeRecord | undefined, handleId?: string | null): StoryboardTargetPort | null => {
    if (!targetNode) return null;
    if (targetNode.kind === 'start') return null;
    if (handleId === 'in-dependency') return 'in-dependency';
    return 'in-path';
  };

  const handleConnect = (connection: Connection) => {
    if (!canEdit) return;
    if (!connection.source || !connection.target) return;

    const sourceNode = activeGraph.nodes.find((node) => node.nodeId === connection.source);
    const targetNode = activeGraph.nodes.find((node) => node.nodeId === connection.target);

    const sourcePort = getSourcePort(sourceNode, connection.sourceHandle);
    const targetPort = getTargetPort(targetNode, connection.targetHandle);

    if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
      setStatus(storyboardEditorCopy.invalidLinkStatus);
      return;
    }

    if (sourceNode.nodeId === targetNode.nodeId) {
      setStatus(storyboardEditorCopy.selfLinkStatus);
      return;
    }

    if (targetNode.kind === 'start') {
      setStatus(storyboardEditorCopy.startIncomingStatus);
      return;
    }

    if (sourceNode.kind === 'end') {
      setStatus(storyboardEditorCopy.endOutgoingStatus);
      return;
    }

    const edgeKind = deriveEdgeKind(sourcePort, targetPort);

    updateActiveGraph((graph) => {
      const duplicateExists = graph.edges.some(
        (edge) =>
          edge.fromNodeId === sourceNode.nodeId &&
          edge.toNodeId === targetNode.nodeId &&
          edge.sourcePort === sourcePort &&
          edge.targetPort === targetPort
      );

      if (duplicateExists) {
        return graph;
      }

      return {
        ...graph,
        edges: [
          ...graph.edges,
          {
            edgeId: createId('edge'),
            fromNodeId: sourceNode.nodeId,
            toNodeId: targetNode.nodeId,
            sourcePort,
            targetPort,
            kind: edgeKind,
            label: '',
            displayMode: 'new_screen'
          }
        ]
      };
    });

    setStatus(null);
  };

  const enterGroupById = (groupNodeId: string) => {
    const groupNode = activeGraph.nodes.find((node) => node.nodeId === groupNodeId && node.kind === 'group');
    if (!groupNode) return;

    const nextRoot = updateGraphAtPath(documentState.rootGraph, activeGroupPath, (graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.nodeId !== groupNode.nodeId || node.kind !== 'group') return node;
        return {
          ...node,
          groupGraph: node.groupGraph ?? createDefaultGraph()
        };
      })
    }));

    const nextPath = [...activeGroupPath, groupNode.nodeId];
    const nextGraph = getGraphAtPath(nextRoot, nextPath);

    setDocumentState((current) => ({ ...current, rootGraph: nextRoot }));
    setActiveGroupPath(nextPath);
    setSelectedNodeId(nextGraph.startNodeId);
    setSelectedEdgeId('');
    setCardPickerOpen(false);
  };

  const enterSelectedGroup = () => {
    if (!selectedNode || selectedNode.kind !== 'group') return;
    enterGroupById(selectedNode.nodeId);
  };

  const leaveToLevel = (depth: number) => {
    const nextPath = activeGroupPath.slice(0, depth);
    const nextGraph = getGraphAtPath(documentState.rootGraph, nextPath);
    setActiveGroupPath(nextPath);
    setSelectedNodeId(nextGraph.startNodeId);
    setSelectedEdgeId('');
  };

  const graphStats = useMemo(() => collectGraphStats(documentState.rootGraph), [documentState.rootGraph]);
  const storyboardSharedUrl = useMemo(() => {
    if (!activeShare?.shareCode) return '';
    if (typeof window === 'undefined') {
      return `/#/cogita/storyboard/shared/${encodeURIComponent(activeShare.shareCode)}`;
    }
    return `${window.location.origin}/#/cogita/storyboard/shared/${encodeURIComponent(activeShare.shareCode)}`;
  }, [activeShare?.shareCode]);

  const handleCopySharedLink = async () => {
    if (!storyboardSharedUrl) return;
    try {
      await navigator.clipboard.writeText(storyboardSharedUrl);
      setShareCopyStatus('copied');
    } catch {
      setShareCopyStatus('failed');
    }
  };

  const handleCreateShare = async () => {
    if (!selectedProject) return;
    setShareStatus('working');
    setShareCopyStatus('idle');
    try {
      const response = await createCogitaStoryboardShare({ libraryId, projectId: selectedProject.projectId });
      setActiveShare({
        shareId: response.shareId,
        projectId: response.projectId,
        projectName: response.projectName,
        shareCode: response.shareCode,
        createdUtc: response.createdUtc,
        revokedUtc: null
      });
      setShareStatus('ready');
    } catch {
      setShareStatus('error');
    }
  };

  const handleRevokeShare = async () => {
    if (!activeShare) return;
    setShareStatus('working');
    try {
      await revokeCogitaStoryboardShare({ libraryId, shareId: activeShare.shareId });
      setActiveShare(null);
      setShareStatus('idle');
      setShareCopyStatus('idle');
    } catch {
      setShareStatus('error');
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
      {isSearchMode ? (
        <section className="cogita-library-dashboard cogita-flat-search-list" data-mode="list">
          <div className="cogita-library-layout">
            <div className="cogita-library-content">
              <div className="cogita-library-grid">
                <div className="cogita-flat-search-header">
                  <div className="cogita-library-controls">
                    <button type="button" className="cta" onClick={navigateToCreate}>
                      {copy.cogita.library.modules.storyboardsCreate}
                    </button>
                  </div>
                </div>

                <div className="cogita-library-panel">
                  <CogitaStoryboardSearch
                    items={items}
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    searchLabel={copy.cogita.workspace.infoMode.search}
                    searchPlaceholder={copy.cogita.library.modules.storyboardsNewPlaceholder}
                    loading={loading}
                    loadingLabel={copy.cogita.library.modules.loading}
                    loadFailed={loadFailed}
                    failedLabel={copy.cogita.library.modules.loadFailed}
                    emptyLabel={copy.cogita.library.modules.storyboardsEmpty}
                    inputAriaLabel={copy.cogita.library.modules.storyboardsNewPlaceholder}
                    buildStoryboardHref={(item) => `/#/cogita/workspace/libraries/${libraryId}/storyboards/${encodeURIComponent(item.projectId)}`}
                    openActionLabel={copy.cogita.workspace.infoActions.overview}
                    onStoryboardSelect={(item) => navigateToOverview(item.projectId)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="cogita-library-dashboard cogita-storyboard-dashboard" data-mode="detail">
          <header className="cogita-library-dashboard-header">
            <div>
              <h1 className="cogita-library-title">
                {(isCreateMode || isEditMode)
                  ? (projectTitle.trim() || selectedProject?.name || copy.cogita.library.modules.storyboardsNewPlaceholder)
                  : libraryName}
              </h1>
            </div>
            <div className="cogita-library-actions">
              {!isCreateMode && !isEditMode ? (
                <button type="button" className="ghost" onClick={navigateToSearch}>
                  {copy.cogita.workspace.infoMode.search}
                </button>
              ) : null}
              {isCreateMode ? (
                <button
                  type="button"
                  className="cta"
                  onClick={() => void saveProject()}
                  disabled={saving || !projectTitle.trim()}
                >
                  {saving ? storyboardEditorCopy.creatingAction : copy.cogita.library.modules.storyboardsCreate}
                </button>
              ) : null}
              {isEditMode ? (
                <button type="button" className="cta" onClick={() => void saveProject()} disabled={saving}>
                  {saving ? storyboardEditorCopy.savingAction : storyboardEditorCopy.saveAction}
                </button>
              ) : null}
              {isOverviewMode && selectedProject ? (
                <>
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => navigate(`/cogita/runtime/storyboard/${encodeURIComponent(libraryId)}/${encodeURIComponent(selectedProject.projectId)}`)}
                  >
                    {storyboardEditorCopy.runAction}
                  </button>
                  <button type="button" className="cta ghost" onClick={() => void handleCreateShare()} disabled={shareStatus === 'working'}>
                    {shareStatus === 'working' ? storyboardEditorCopy.shareWorking : storyboardEditorCopy.shareCreateAction}
                  </button>
                  {storyboardSharedUrl ? (
                    <button type="button" className="cta ghost" onClick={() => void handleCopySharedLink()}>
                      {storyboardEditorCopy.shareCopyAction}
                    </button>
                  ) : null}
                  {activeShare ? (
                    <button type="button" className="cta ghost" onClick={() => void handleRevokeShare()} disabled={shareStatus === 'working'}>
                      {storyboardEditorCopy.shareRevokeAction}
                    </button>
                  ) : null}
                  <button type="button" className="cta" onClick={() => navigateToEdit(selectedProject.projectId)}>
                    {copy.cogita.workspace.infoActions.edit}
                  </button>
                </>
              ) : null}
            </div>
          </header>

          {isOverviewMode && selectedProject ? (
            <div className="cogita-storyboard-main">
              <section className="cogita-library-detail cogita-storyboard-top-panel">
                <div className="cogita-detail-body">
                  <h3 className="cogita-detail-title" style={{ marginTop: 0 }}>{projectTitle || selectedProject.name}</h3>
                  <p>{projectDescription || documentState.description || storyboardEditorCopy.overviewNoDescription}</p>
                  <div className="cogita-storyboard-form-grid">
                    <label className="cogita-field">
                      <span>{storyboardEditorCopy.overviewNodes}</span>
                      <input type="text" value={String(graphStats.totalNodes)} readOnly />
                    </label>
                    <label className="cogita-field">
                      <span>{storyboardEditorCopy.overviewLinks}</span>
                      <input type="text" value={String(graphStats.totalLinks)} readOnly />
                    </label>
                    <label className="cogita-field">
                      <span>{storyboardEditorCopy.overviewStatic}</span>
                      <input type="text" value={String(graphStats.staticNodes)} readOnly />
                    </label>
                    <label className="cogita-field">
                      <span>{storyboardEditorCopy.overviewCards}</span>
                      <input type="text" value={String(graphStats.cardNodes)} readOnly />
                    </label>
                    <label className="cogita-field">
                      <span>{storyboardEditorCopy.overviewGroups}</span>
                      <input type="text" value={String(graphStats.groupNodes)} readOnly />
                    </label>
                    <label className="cogita-field">
                      <span>{storyboardEditorCopy.overviewStaticBreakdown}</span>
                      <input
                        type="text"
                        value={`${graphStats.textStatics} / ${graphStats.videoStatics} / ${graphStats.audioStatics} / ${graphStats.imageStatics} / ${graphStats.otherStatics}`}
                        readOnly
                      />
                    </label>
                  </div>
                  {storyboardSharedUrl ? (
                    <label className="cogita-field full">
                      <span>{storyboardEditorCopy.sharedLinkLabel}</span>
                      <input type="text" value={storyboardSharedUrl} readOnly />
                    </label>
                  ) : (
                    <p>{storyboardEditorCopy.sharedLinkEmpty}</p>
                  )}
                  {shareStatus === 'error' ? <p className="cogita-form-error">{storyboardEditorCopy.shareUpdateError}</p> : null}
                  {shareCopyStatus === 'copied' ? <p className="cogita-help">{storyboardEditorCopy.shareCopied}</p> : null}
                  {shareCopyStatus === 'failed' ? <p className="cogita-form-error">{storyboardEditorCopy.shareCopyError}</p> : null}
                </div>
              </section>
            </div>
          ) : (isCreateMode || selectedProject) ? (
            <div className="cogita-storyboard-main">
              <section className="cogita-library-detail cogita-storyboard-top-panel">
                <div className="cogita-detail-body">
                  <StoryboardMetaForm
                    title={projectTitle}
                    description={projectDescription}
                    titleLabel={copy.cogita.library.modules.storyboardsNewLabel}
                    titlePlaceholder={copy.cogita.library.modules.storyboardsNewPlaceholder}
                    descriptionLabel={storyboardEditorCopy.descriptionLabel}
                    descriptionPlaceholder={storyboardEditorCopy.descriptionPlaceholder}
                    onTitleChange={setProjectTitle}
                    onDescriptionChange={setProjectDescription}
                    readOnly={!canEdit}
                  />

                  <div className="cogita-storyboard-graph-nav">
                    <button type="button" className="ghost" onClick={() => leaveToLevel(0)} disabled={activeGroupPath.length === 0}>
                      {storyboardEditorCopy.rootGraphAction}
                    </button>
                    {groupPathLabels.map((item, index) => (
                      <button
                        key={item.nodeId}
                        type="button"
                        className="ghost"
                        onClick={() => leaveToLevel(index + 1)}
                        disabled={index === groupPathLabels.length - 1}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                  <div className="cogita-card-actions">
                    <button type="button" className="ghost" onClick={() => addNode('static')} disabled={!canEdit}>{storyboardEditorCopy.addStaticAction}</button>
                    <button type="button" className="ghost" onClick={() => addNode('card')} disabled={!canEdit}>{storyboardEditorCopy.addCardAction}</button>
                    <button type="button" className="ghost" onClick={() => addNode('group')} disabled={!canEdit}>{storyboardEditorCopy.addGroupAction}</button>
                  </div>

                  <div className="cogita-storyboard-graph-canvas">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      nodeTypes={nodeTypes}
                      fitView
                      elementsSelectable
                      nodesDraggable={canEdit}
                      onConnect={handleConnect}
                      onNodeClick={(event, node) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.id);
                        setSelectedEdgeId('');
                      }}
                      onNodeDoubleClick={(_, node) => {
                        const fullNode = activeGraph.nodes.find((item) => item.nodeId === node.id);
                        if (fullNode?.kind === 'group') {
                          setSelectedNodeId(fullNode.nodeId);
                          enterGroupById(fullNode.nodeId);
                        }
                      }}
                      onEdgeClick={(event, edge) => {
                        event.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId('');
                      }}
                      onPaneClick={() => {
                        setSelectedEdgeId('');
                        setSelectedNodeId('');
                      }}
                      onNodeDrag={(_, node) => setNodePosition(node.id, node.position)}
                      onNodeDragStop={(_, node) => setNodePosition(node.id, node.position)}
                    >
                      <MiniMap zoomable pannable />
                      <Background gap={18} size={1} />
                      <Controls />
                    </ReactFlow>
                  </div>

                  {status ? <p className="cogita-help">{status}</p> : null}
                  {saveFailed ? <p className="cogita-form-error">{copy.cogita.library.modules.createFailed}</p> : null}
                </div>
              </section>

              <section className="cogita-library-detail cogita-storyboard-bottom-panel">
                <div className="cogita-detail-header">
                  <div className="cogita-card-actions">
                    {selectedNode && !isStructuralNode(selectedNode) ? (
                      <button type="button" className="ghost" onClick={removeSelectedNode} disabled={!canEdit}>{storyboardEditorCopy.deleteNodeAction}</button>
                    ) : null}
                    {selectedEdge ? (
                      <button type="button" className="ghost" onClick={removeSelectedEdge} disabled={!canEdit}>{storyboardEditorCopy.deleteLinkAction}</button>
                    ) : null}
                  </div>
                </div>

                <div className="cogita-detail-body">
                  {selectedNode ? (
                    <>
                      <div className="cogita-storyboard-form-grid">
                        <label className="cogita-field full">
                          <span>{storyboardEditorCopy.nodeTitleLabel}</span>
                          <input
                            type="text"
                            value={selectedNode.title}
                            disabled={!canEdit || isStructuralNode(selectedNode)}
                            onChange={(event) => updateSelectedNode((node) => ({ ...node, title: event.target.value }))}
                          />
                        </label>

                        <label className="cogita-field full">
                          <span>{storyboardEditorCopy.nodeDescriptionLabel}</span>
                          <textarea
                            value={selectedNode.description}
                            rows={2}
                            disabled={!canEdit || isStructuralNode(selectedNode)}
                            onChange={(event) => updateSelectedNode((node) => ({ ...node, description: event.target.value }))}
                          />
                        </label>

                        {selectedNode.kind === 'static' ? (
                          <>
                            <label className="cogita-field">
                              <span>{storyboardEditorCopy.staticTypeLabel}</span>
                              <select
                                value={selectedNode.staticType}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateSelectedNode((node) => ({
                                    ...node,
                                    staticType: normalizeStaticType(event.target.value, node.staticType)
                                  }))
                                }
                              >
                                {staticTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>

                            <label className="cogita-field full">
                              <span>{storyboardEditorCopy.staticBodyLabel}</span>
                              <textarea
                                value={selectedNode.staticBody}
                                rows={4}
                                disabled={!canEdit}
                                onChange={(event) => updateSelectedNode((node) => ({ ...node, staticBody: event.target.value }))}
                              />
                            </label>

                            {(selectedNode.staticType === 'video' || selectedNode.staticType === 'audio' || selectedNode.staticType === 'image') ? (
                              <label className="cogita-field full">
                                <span>{storyboardEditorCopy.mediaUrlLabel}</span>
                                <input
                                  type="text"
                                  value={selectedNode.mediaUrl}
                                  disabled={!canEdit}
                                  onChange={(event) => updateSelectedNode((node) => ({ ...node, mediaUrl: event.target.value }))}
                                  placeholder="https://..."
                                />
                              </label>
                            ) : null}
                          </>
                        ) : null}

                        {selectedNode.kind === 'card' ? (
                          <>
                            <label className="cogita-field full">
                              <span>{storyboardEditorCopy.selectedNotionLabel}</span>
                              <input type="text" value={cardNodeInfoLabels[selectedNode.nodeId] ?? selectedNode.notionId} readOnly />
                            </label>
                            <div className="cogita-card-actions">
                              <button type="button" className="ghost" disabled={!canEdit} onClick={() => setCardPickerOpen(true)}>
                                {storyboardEditorCopy.selectNotionAction}
                              </button>
                            </div>

                            {cardNodeCardsStatus === 'loading' ? <p className="cogita-help">{storyboardEditorCopy.checkcardsLoading}</p> : null}
                            {cardNodeCardsStatus === 'error' ? <p className="cogita-form-error">{storyboardEditorCopy.checkcardsLoadFailed}</p> : null}
                            {selectedNode.notionId && selectedNodeCards.length === 0 && cardNodeCardsStatus !== 'loading' ? (
                              <p className="cogita-help">{storyboardEditorCopy.checkcardsEmpty}</p>
                            ) : null}
                            {selectedNodeCards.length > 0 ? (
                              <div className="cogita-storyboard-checkcards-panel">
                                <p className="cogita-help">{storyboardEditorCopy.selectCheckingcardHint}</p>
                                <div className="cogita-storyboard-checkcards-list">
                                  <CogitaCheckcardList
                                    cards={selectedNodeCards}
                                    keyForCard={(card) => buildCheckcardKey(card)}
                                    isActive={(card) => {
                                      const mappedDirection: StoryboardCardDirection =
                                        card.direction === 'back_to_front' || card.direction === 'front_to_back'
                                          ? card.direction
                                          : selectedNode.cardDirection;
                                      const key = `${card.checkType ?? ''}|${mappedDirection}`;
                                      return key === selectedCardKey;
                                    }}
                                    onSelect={(card) => {
                                      const mappedDirection: StoryboardCardDirection =
                                        card.direction === 'back_to_front' || card.direction === 'front_to_back'
                                          ? card.direction
                                          : selectedNode.cardDirection;
                                      updateSelectedNode((node) => ({
                                        ...node,
                                        cardCheckType: card.checkType ?? '',
                                        cardDirection: mappedDirection
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        {selectedNode.kind === 'group' ? (
                          <div className="cogita-form-actions">
                            <button type="button" className="ghost" onClick={enterSelectedGroup}>
                              {storyboardEditorCopy.enterGroupAction}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {isStructuralNode(selectedNode) ? (
                        <p className="cogita-help">
                          {storyboardEditorCopy.structuralNodeHelp.replace('{kind}', selectedNode.kind.toUpperCase())}
                        </p>
                      ) : null}
                    </>
                  ) : selectedEdge ? (
                    <div className="cogita-storyboard-form-grid">
                      <label className="cogita-field full">
                        <span>{storyboardEditorCopy.linkLabelLabel}</span>
                        <input
                          type="text"
                          value={selectedEdge.label}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateActiveGraph((graph) => ({
                              ...graph,
                              edges: graph.edges.map((edge) =>
                                edge.edgeId === selectedEdge.edgeId
                                  ? { ...edge, label: value }
                                  : edge
                              )
                            }));
                          }}
                          placeholder={storyboardEditorCopy.linkLabelPlaceholder}
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{storyboardEditorCopy.displayModeLabel}</span>
                        <select
                          value={selectedEdge.displayMode}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const nextMode = event.target.value === 'expand' ? 'expand' : 'new_screen';
                            updateActiveGraph((graph) => ({
                              ...graph,
                              edges: graph.edges.map((edge) =>
                                edge.edgeId === selectedEdge.edgeId
                                  ? { ...edge, displayMode: nextMode }
                                  : edge
                              )
                            }));
                          }}
                        >
                          <option value="new_screen">{storyboardEditorCopy.displayModeNewScreen}</option>
                          <option value="expand">{storyboardEditorCopy.displayModeExpand}</option>
                        </select>
                      </label>
                    </div>
                  ) : (
                    <p>{storyboardEditorCopy.inspectorEmpty}</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <section className="cogita-library-detail cogita-storyboard-top-panel">
              <div className="cogita-detail-body">
                <p>{copy.cogita.library.modules.storyboardsEmpty}</p>
              </div>
            </section>
          )}
        </section>
      )}
      <CogitaWorkspaceComponentOverlay
        open={cardPickerOpen && !!selectedNode && selectedNode.kind === 'card'}
        title={storyboardEditorCopy.selectNotionAction}
        closeLabel={copy.cogita.shell.back}
        workspaceLinkTo={`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/notions`}
        workspaceLinkLabel={copy.cogita.workspace.targets.allCards}
        onClose={() => {
          setCardPickerOpen(false);
          setOverlaySearchQuery('');
          setOverlaySearchStatus('idle');
          setOverlayRawResults([]);
        }}
      >
        {resolvedKnowledgeSearchLayout === 'workspace' ? (
          <>
            <div className="cogita-search-toolbar">
              <div className="cogita-search-field-main">
                <CogitaNotionSearch
                  libraryId={libraryId}
                  query={overlaySearchQuery}
                  onQueryChange={setOverlaySearchQuery}
                  minQueryLength={0}
                  debounceMs={240}
                  searchLabel={storyboardEditorCopy.overlaySearchLabel}
                  searchPlaceholder={storyboardEditorCopy.overlaySearchPlaceholder}
                  searchingLabel={storyboardEditorCopy.overlaySearching}
                  emptyLabel={storyboardEditorCopy.overlayNoLinkedCheckcards}
                  failedLabel={copy.cogita.library.modules.loadFailed}
                  resultSuffixLabel={storyboardEditorCopy.overlayResultCardsSuffix}
                  requireLinkedCheckcards
                  showInput
                  inputAriaLabel={storyboardEditorCopy.overlaySearchLabel}
                  showStatusMessages={false}
                  hideResultsList
                  onStatusChange={(nextStatus) => {
                    setOverlaySearchStatus(nextStatus === 'error' ? 'ready' : nextStatus === 'idle' ? 'ready' : nextStatus);
                  }}
                  onResultsChange={setOverlayRawResults}
                />
              </div>
              <div className="cogita-search-field-right">
                <select
                  aria-label={listCopy.sortLabel}
                  value={overlaySortBy}
                  onChange={(event) => setOverlaySortBy(event.target.value as OverlayKnowledgeSort)}
                >
                  {overlaySortOptions.map((option) => (
                    <option key={`storyboard:overlay:sort:${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={listCopy.viewLabel}
                  value={overlayViewMode}
                  onChange={(event) => setOverlayViewMode(event.target.value as OverlayKnowledgeView)}
                >
                  <option value="details">{listCopy.viewDetails}</option>
                  <option value="wide">{listCopy.viewWide}</option>
                  <option value="grid">{listCopy.viewGrid}</option>
                </select>
              </div>
            </div>
            <div className="cogita-card-count">
              <span>{listCopy.cardCount.replace('{shown}', String(overlayVisibleResults.length)).replace('{total}', String(overlayRawResults.length))}</span>
              <span>{overlaySearchStatus === 'loading' ? listCopy.loading : listCopy.ready}</span>
            </div>
            <CogitaNotionSearch
              libraryId={libraryId}
              searchLabel={storyboardEditorCopy.overlaySearchLabel}
              searchPlaceholder={storyboardEditorCopy.overlaySearchPlaceholder}
              searchingLabel={storyboardEditorCopy.overlaySearching}
              emptyLabel={storyboardEditorCopy.overlayNoLinkedCheckcards}
              failedLabel={copy.cogita.library.modules.loadFailed}
              resultSuffixLabel={storyboardEditorCopy.overlayResultCardsSuffix}
              showInput={false}
              showStatusMessages={false}
              displayMode={overlayViewMode}
              detailColumnNameLabel={listCopy.detailColumnName}
              detailColumnTypeLabel={listCopy.detailColumnType}
              detailColumnIdLabel={listCopy.detailColumnId}
              resultsOverride={overlayVisibleResults}
              onNotionSelect={handleOverlayKnowledgeSelect}
            />
          </>
        ) : (
          <CogitaNotionSearch
            libraryId={libraryId}
            searchLabel={storyboardEditorCopy.overlaySearchLabel}
            searchPlaceholder={storyboardEditorCopy.overlaySearchPlaceholder}
            searchingLabel={storyboardEditorCopy.overlaySearching}
            emptyLabel={storyboardEditorCopy.overlayNoLinkedCheckcards}
            failedLabel={copy.cogita.library.modules.loadFailed}
            resultSuffixLabel={storyboardEditorCopy.overlayResultCardsSuffix}
            requireLinkedCheckcards
            onNotionSelect={handleOverlayKnowledgeSelect}
          />
        )}
      </CogitaWorkspaceComponentOverlay>
    </CogitaShell>
  );
}
