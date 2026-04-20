import { useMemo, useState, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CogitaShell } from '../../../CogitaShell';
import { CogitaOverlay } from '../../CogitaOverlay';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';
import { useCogitaLibraryMeta } from '../../useCogitaLibraryMeta';
import {
  ApiError,
  createCogitaStoryboardShare,
  createCogitaStoryboardSession,
  createCogitaCreationProject,
  getCogitaStoryboardSessionResults,
  getCogitaStoryboardSessions,
  getCogitaNotionCheckcards,
  getCogitaLibraries,
  getCogitaCreationProjects,
  getCogitaStoryboardShares,
  importCogitaStoryboardFromJson,
  revokeCogitaStoryboardSession,
  revokeCogitaStoryboardShare,
  uploadDataItemFile,
  updateCogitaCreationProject,
  type CogitaCardSearchResult,
  type CogitaCreationProject,
  type CogitaStoryboardSession,
  type CogitaStoryboardSessionResults,
  type CogitaStoryboardShare
} from '../../../../../lib/api';
import { CogitaNotionSearchList as CogitaNotionSearch, type CogitaNotionSearchResult } from '../notion/CogitaNotionSearch';
import { buildCheckcardKey } from '../../../features/revision/cardDisplay';

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

type StoryboardNodeKind = 'start' | 'end' | 'static' | 'card' | 'group' | 'separator' | 'join';
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
  narrationImageEnabled: boolean;
  narrationImageFileId: string;
  narrationAudioEnabled: boolean;
  narrationAudioFileId: string;
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
  storyboardTopicNotionId?: string;
  storyboardManagedNotionIds?: string[];
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
  compact: boolean;
  ultraCompact: boolean;
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

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
}

function normalizeNodeKind(value: unknown): StoryboardNodeKind {
  if (
    value === 'start' ||
    value === 'end' ||
    value === 'static' ||
    value === 'card' ||
    value === 'group' ||
    value === 'separator' ||
    value === 'join'
  ) {
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
  if (sourceNode?.kind === 'card' || sourceNode?.kind === 'join') return 'out-right';
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
    narrationImageEnabled: false,
    narrationImageFileId: '',
    narrationAudioEnabled: false,
    narrationAudioFileId: '',
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
    narrationImageEnabled: false,
    narrationImageFileId: '',
    narrationAudioEnabled: false,
    narrationAudioFileId: '',
    notionId: '',
    cardCheckType: '',
    cardDirection: 'front_to_back'
  };
}

function createAuthorNode(kind: 'static' | 'card' | 'group' | 'separator' | 'join', index: number): StoryboardNodeRecord {
  const title =
    kind === 'card'
      ? `Card ${index}`
      : kind === 'group'
        ? `Group ${index}`
        : kind === 'separator'
          ? `Separator ${index}`
          : kind === 'join'
            ? `Join ${index}`
            : `Static ${index}`;
  return {
    nodeId: createId(kind),
    title,
    kind,
    description: '',
    position: {
      x: 220 + (index % 4) * 220,
      y: 80 + Math.floor(index / 4) * 170
    },
    staticType: 'text',
    staticBody: '',
    mediaUrl: '',
    narrationImageEnabled: false,
    narrationImageFileId: '',
    narrationAudioEnabled: false,
    narrationAudioFileId: '',
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
    rootGraph: createDefaultGraph(),
    storyboardTopicNotionId: '',
    storyboardManagedNotionIds: []
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
    const narration = node.narration && typeof node.narration === 'object' && !Array.isArray(node.narration)
      ? (node.narration as Record<string, unknown>)
      : null;
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
      narrationImageEnabled: toBoolean(node.narrationImageEnabled ?? narration?.imageEnabled),
      narrationImageFileId: toString(node.narrationImageFileId ?? narration?.imageFileId),
      narrationAudioEnabled: toBoolean(node.narrationAudioEnabled ?? narration?.audioEnabled),
      narrationAudioFileId: toString(node.narrationAudioFileId ?? narration?.audioFileId),
      notionId: toString(node.notionId ?? node.infoId ?? node.itemId),
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
      narrationImageEnabled: false,
      narrationImageFileId: '',
      narrationAudioEnabled: false,
      narrationAudioFileId: '',
      notionId: toString(item.notionId ?? item.infoId ?? item.itemId),
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
        rootGraph: parsedRootGraph,
        storyboardTopicNotionId: toString(root.storyboardTopicNotionId),
        storyboardManagedNotionIds: Array.isArray(root.storyboardManagedNotionIds)
          ? root.storyboardManagedNotionIds.map((entry) => toString(entry)).filter((entry) => entry.length > 0)
          : []
      };
    }

    if (root.schema === 'cogita_storyboard_graph' && Array.isArray(root.nodes)) {
      return {
        schema: 'cogita_storyboard_graph',
        version: 2,
        description: toString(root.description),
        script: toString(root.script),
        steps: Array.isArray(root.steps) ? root.steps.map((step) => toString(step)) : [],
        rootGraph: buildLegacyGraphFromV1(root),
        storyboardTopicNotionId: toString(root.storyboardTopicNotionId),
        storyboardManagedNotionIds: Array.isArray(root.storyboardManagedNotionIds)
          ? root.storyboardManagedNotionIds.map((entry) => toString(entry)).filter((entry) => entry.length > 0)
          : []
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
      return;
    }

    if (node.kind === 'separator') {
      lines.push(`${prefix}Separator: ${node.title}`);
      return;
    }

    if (node.kind === 'join') {
      lines.push(`${prefix}Join: ${node.title}`);
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
  if (kind === 'separator') {
    return {
      border: 'rgba(120, 222, 230, 0.95)',
      bg: 'rgba(20, 70, 79, 0.9)',
      badge: 'SEPARATOR'
    };
  }
  if (kind === 'join') {
    return {
      border: 'rgba(255, 196, 148, 0.96)',
      bg: 'rgba(86, 49, 21, 0.9)',
      badge: 'JOIN'
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
  const width = data.ultraCompact ? 128 : data.compact ? 168 : 218;
  const padY = data.ultraCompact ? '0.34rem' : data.compact ? '0.4rem' : '0.5rem';
  const padX = data.ultraCompact ? '0.4rem' : data.compact ? '0.48rem' : '0.58rem';
  const badgeFont = data.ultraCompact ? '0.52rem' : data.compact ? '0.56rem' : '0.62rem';
  const titleFont = data.ultraCompact ? '0.68rem' : data.compact ? '0.78rem' : '0.9rem';
  const subtitleFont = data.ultraCompact ? '0.62rem' : data.compact ? '0.66rem' : '0.73rem';
  const handleSize = data.ultraCompact ? 7 : data.compact ? 8 : 10;
  const handleBorder = data.ultraCompact ? 1 : 2;
  const handleOffset = data.ultraCompact ? -5 : -7;

  const handleBase = {
    width: handleSize,
    height: handleSize,
    borderRadius: 999,
    border: `${handleBorder}px solid rgba(9, 20, 36, 0.95)`,
    background: '#89d2ff'
  };

  return (
    <div
      style={{
        width,
        borderRadius: 12,
        border: `1px solid ${visual.border}`,
        background: visual.bg,
        color: 'rgba(238, 246, 255, 0.95)',
        padding: `${padY} ${padX}`,
        display: 'grid',
        gap: data.ultraCompact ? '0.14rem' : data.compact ? '0.18rem' : '0.22rem',
        boxShadow: '0 8px 22px rgba(0, 0, 0, 0.28)'
      }}
    >
      {data.kind !== 'start' ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="in-path"
            style={{ ...handleBase, left: handleOffset, top: '35%', background: 'rgba(148, 209, 255, 0.96)' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="in-dependency"
            style={{ ...handleBase, left: handleOffset, top: '72%', background: 'rgba(255, 207, 129, 0.98)' }}
          />
        </>
      ) : null}

      {data.kind === 'card' || data.kind === 'join' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="out-right"
            style={{ ...handleBase, right: handleOffset, top: '35%', background: 'rgba(154, 241, 178, 0.98)' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out-wrong"
            style={{ ...handleBase, right: handleOffset, top: '72%', background: 'rgba(252, 166, 166, 0.98)' }}
          />
        </>
      ) : null}

      {data.kind !== 'card' && data.kind !== 'join' && data.kind !== 'end' ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-path"
          style={{ ...handleBase, right: handleOffset, top: '53%', background: 'rgba(148, 209, 255, 0.96)' }}
        />
      ) : null}

      <div style={{ fontSize: badgeFont, letterSpacing: '0.12em', opacity: 0.9 }}>{visual.badge}</div>
      <strong style={{ fontSize: titleFont, lineHeight: 1.2 }}>{data.title}</strong>
      {!data.ultraCompact ? (
        <small style={{ fontSize: subtitleFont, color: 'rgba(205, 228, 249, 0.92)' }}>{data.subtitle}</small>
      ) : null}
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
  const separatorNodeKindLabel =
    language === 'pl' ? 'Separator' : language === 'de' ? 'Separator' : 'Separator';
  const joinNodeKindLabel =
    language === 'pl' ? 'Join' : language === 'de' ? 'Join' : 'Join';
  const addSeparatorActionLabel =
    language === 'pl' ? 'Dodaj separator' : language === 'de' ? 'Separator hinzufügen' : 'Add separator';
  const addJoinActionLabel =
    language === 'pl' ? 'Dodaj join' : language === 'de' ? 'Join hinzufügen' : 'Add join';

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
  const [viewportZoom, setViewportZoom] = useState(1);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [overlaySearchQuery, setOverlaySearchQuery] = useState('');
  const [overlaySortBy, setOverlaySortBy] = useState<OverlayKnowledgeSort>('relevance');
  const [overlayViewMode, setOverlayViewMode] = useState<OverlayKnowledgeView>('details');
  const [overlaySearchStatus, setOverlaySearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [overlayRawResults, setOverlayRawResults] = useState<CogitaNotionSearchResult[]>([]);
  const [cardNodeCards, setCardNodeCards] = useState<Record<string, CogitaCardSearchResult[]>>({});
  const [cardNodeInfoLabels, setCardNodeInfoLabels] = useState<Record<string, string>>({});
  const [cardNodeCardsStatus, setCardNodeCardsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [libraryRoleId, setLibraryRoleId] = useState('');
  const [mediaUploadTarget, setMediaUploadTarget] = useState<'image' | 'audio' | null>(null);
  const [activeShare, setActiveShare] = useState<CogitaStoryboardShare | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [activeSession, setActiveSession] = useState<CogitaStoryboardSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [sessionCopyStatus, setSessionCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [sessionResults, setSessionResults] = useState<CogitaStoryboardSessionResults | null>(null);
  const [sessionResultsStatus, setSessionResultsStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [importOverlayOpen, setImportOverlayOpen] = useState(false);
  const [importJsonInput, setImportJsonInput] = useState('');
  const [importDeleteOldNotions, setImportDeleteOldNotions] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'working'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const audioUploadInputRef = useRef<HTMLInputElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const authExpiredStatus = useMemo(
    () =>
      language === 'pl'
        ? 'Sesja wygasła. Zaloguj się ponownie i odśwież storyboard.'
        : language === 'de'
          ? 'Sitzung abgelaufen. Melde dich erneut an und lade das Storyboard neu.'
          : 'Session expired. Sign in again and reload the storyboard.',
    [language]
  );
  const sessionUiCopy = useMemo(
    () =>
      language === 'pl'
        ? {
            createAction: 'Utwórz sesję',
            copyAction: 'Kopiuj link sesji',
            revokeAction: 'Zamknij sesję',
            refreshResultsAction: 'Odśwież wyniki',
            working: 'Przetwarzanie...',
            linkLabel: 'Link sesji (z zapisem wyników)',
            linkEmpty: 'Brak aktywnej sesji. Utwórz sesję, aby zbierać wyniki użytkowników.',
            updateError: 'Nie udało się zaktualizować sesji.',
            copyError: 'Nie udało się skopiować linku sesji.',
            copied: 'Link sesji skopiowany.',
            resultsTitle: 'Wyniki sesji',
            noResults: 'Brak odpowiedzi w tej sesji.',
            participantsLabel: 'Uczestnicy',
            answersLabel: 'Odpowiedzi',
            correctLabel: 'Poprawne',
            participantResultsTitle: 'Wyniki uczestników',
            nodeResultsTitle: 'Wyniki pytań',
            rowNode: 'Węzeł',
            rowCheckType: 'Typ',
            rowParticipants: 'Uczestnicy'
          }
        : language === 'de'
          ? {
              createAction: 'Sitzung erstellen',
              copyAction: 'Sitzungslink kopieren',
              revokeAction: 'Sitzung beenden',
              refreshResultsAction: 'Ergebnisse aktualisieren',
              working: 'Wird verarbeitet...',
              linkLabel: 'Sitzungslink (mit Ergebnisspeicherung)',
              linkEmpty: 'Keine aktive Sitzung. Erstelle eine Sitzung, um Ergebnisse zu sammeln.',
              updateError: 'Sitzung konnte nicht aktualisiert werden.',
              copyError: 'Sitzungslink konnte nicht kopiert werden.',
              copied: 'Sitzungslink kopiert.',
              resultsTitle: 'Sitzungsergebnisse',
              noResults: 'Keine Antworten in dieser Sitzung.',
              participantsLabel: 'Teilnehmer',
              answersLabel: 'Antworten',
              correctLabel: 'Richtig',
              participantResultsTitle: 'Teilnehmerergebnisse',
              nodeResultsTitle: 'Fragen-Ergebnisse',
              rowNode: 'Knoten',
              rowCheckType: 'Typ',
              rowParticipants: 'Teilnehmer'
            }
          : {
              createAction: 'Create session',
              copyAction: 'Copy session link',
              revokeAction: 'Close session',
              refreshResultsAction: 'Refresh results',
              working: 'Working...',
              linkLabel: 'Session link (with result tracking)',
              linkEmpty: 'No active session. Create one to collect user results.',
              updateError: 'Unable to update the session.',
              copyError: 'Unable to copy the session link.',
              copied: 'Session link copied.',
              resultsTitle: 'Session results',
              noResults: 'No answers in this session yet.',
              participantsLabel: 'Participants',
              answersLabel: 'Answers',
              correctLabel: 'Correct',
              participantResultsTitle: 'Participant results',
              nodeResultsTitle: 'Question results',
              rowNode: 'Node',
              rowCheckType: 'Type',
              rowParticipants: 'Participants'
            },
    [language]
  );
  const importUiCopy = useMemo(
    () =>
      language === 'pl'
        ? {
            openAction: 'Import JSON',
            title: 'Import storyboardu z JSON',
            hint: 'Wklej JSON storyboardu lub import envelope. Import może utworzyć notions i połączyć je z card node.',
            deleteOldToggleLabel: 'Usuń stare notions tego storyboardu, których nie ma już w nowym JSON.',
            invalidJson: 'Wklejony tekst nie jest poprawnym JSON.',
            submitAction: 'Importuj',
            submittingAction: 'Importowanie...',
            clearAction: 'Wyczyść',
            statusDone: 'Import zakończony.',
            statusWarnings: (count: number) => `Import zakończony z ostrzeżeniami (${count}).`,
            workspaceAction: 'Otwórz workspace'
          }
        : language === 'de'
          ? {
              openAction: 'JSON importieren',
              title: 'Storyboard aus JSON importieren',
              hint: 'Füge ein Storyboard-JSON oder ein Import-Envelope ein. Der Import kann Notions erstellen und mit Card-Nodes verknüpfen.',
              deleteOldToggleLabel: 'Alte Storyboard-Notions löschen, die im neuen JSON nicht mehr verwendet werden.',
              invalidJson: 'Der eingefügte Text ist kein gültiges JSON.',
              submitAction: 'Importieren',
              submittingAction: 'Import läuft...',
              clearAction: 'Leeren',
              statusDone: 'Import abgeschlossen.',
              statusWarnings: (count: number) => `Import mit Warnungen abgeschlossen (${count}).`,
              workspaceAction: 'Workspace öffnen'
            }
          : {
              openAction: 'Import JSON',
              title: 'Import Storyboard From JSON',
              hint: 'Paste a storyboard JSON or import envelope. Import can create notions and attach them to card nodes.',
              deleteOldToggleLabel: 'Delete old storyboard notions that are not used by the new JSON.',
              invalidJson: 'The provided text is not valid JSON.',
              submitAction: 'Import',
              submittingAction: 'Importing...',
              clearAction: 'Clear',
              statusDone: 'Import completed.',
              statusWarnings: (count: number) => `Import completed with warnings (${count}).`,
              workspaceAction: 'Open workspace'
            },
    [language]
  );
  const hasLinkedTopicNotion = Boolean(documentState.storyboardTopicNotionId?.trim());

  useEffect(() => {
    if (!hasLinkedTopicNotion && importDeleteOldNotions) {
      setImportDeleteOldNotions(false);
    }
  }, [hasLinkedTopicNotion, importDeleteOldNotions]);

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
      .catch((error) => {
        if (cancelled) return;
        setItems([]);
        setLoadFailed(true);
        if (error instanceof ApiError && error.status === 401) {
          setStatus(authExpiredStatus);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authExpiredStatus, libraryId]);

  useEffect(() => {
    let cancelled = false;
    getCogitaLibraries()
      .then((libraries) => {
        if (cancelled) return;
        const library = libraries.find((item) => item.libraryId === libraryId);
        setLibraryRoleId(library?.roleId ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setLibraryRoleId('');
        }
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
      setImportOverlayOpen(false);
      setImportJsonInput('');
      setImportDeleteOldNotions(false);
      setImportStatus('idle');
      setImportError(null);
      setActiveShare(null);
      setShareStatus('idle');
      setShareCopyStatus('idle');
      setActiveSession(null);
      setSessionStatus('idle');
      setSessionCopyStatus('idle');
      setSessionResults(null);
      setSessionResultsStatus('idle');
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
    setActiveSession(null);
    setSessionStatus('idle');
    setSessionCopyStatus('idle');
    setSessionResults(null);
    setSessionResultsStatus('idle');
    setImportOverlayOpen(false);
    setImportJsonInput('');
    setImportDeleteOldNotions(false);
    setImportStatus('idle');
    setImportError(null);
  }, [selectedProject]);

  useEffect(() => {
    setShareCopyStatus('idle');
    setSessionCopyStatus('idle');
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

  useEffect(() => {
    if (!selectedProject || !isOverviewMode) {
      setActiveSession(null);
      setSessionStatus('idle');
      setSessionResults(null);
      setSessionResultsStatus('idle');
      return;
    }

    let cancelled = false;
    setSessionStatus('working');
    getCogitaStoryboardSessions({ libraryId, projectId: selectedProject.projectId })
      .then((sessions) => {
        if (cancelled) return;
        const current = sessions.find((session) => !session.revokedUtc) ?? null;
        setActiveSession(current);
        setSessionStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setActiveSession(null);
        setSessionStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isOverviewMode, libraryId, selectedProject]);

  useEffect(() => {
    if (!activeSession) {
      setSessionResults(null);
      setSessionResultsStatus('idle');
      return;
    }

    let cancelled = false;
    setSessionResultsStatus('working');
    getCogitaStoryboardSessionResults({ libraryId, sessionId: activeSession.sessionId })
      .then((results) => {
        if (cancelled) return;
        setSessionResults(results);
        setSessionResultsStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setSessionResults(null);
        setSessionResultsStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [activeSession, libraryId]);

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
    getCogitaNotionCheckcards({ libraryId, notionId: selectedNode.notionId.trim() })
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
        const compact = viewportZoom <= 0.5;
        const ultraCompact = viewportZoom <= 0.28;
        const kindLabel = node.kind === 'static'
          ? `${storyboardEditorCopy.nodeKindStatic} · ${staticTypeLabels[node.staticType]}`
          : node.kind === 'card'
            ? `${storyboardEditorCopy.nodeKindCard} · ${directionLabels[node.cardDirection]}`
            : node.kind === 'group'
              ? storyboardEditorCopy.nodeKindGroup
              : node.kind === 'separator'
                ? separatorNodeKindLabel
                : node.kind === 'join'
                  ? joinNodeKindLabel
              : node.kind === 'start'
                ? storyboardEditorCopy.nodeKindStart
                : storyboardEditorCopy.nodeKindEnd;

        return {
          id: node.nodeId,
          type: 'storyboardNode',
          data: {
            kind: node.kind,
            title: node.title || node.nodeId,
            subtitle: kindLabel,
            compact,
            ultraCompact
          },
          position: node.position,
          draggable: canEdit,
          selectable: true,
          selected: node.nodeId === selectedNodeId
        };
      }),
    [
      activeGraph.nodes,
      canEdit,
      directionLabels,
      joinNodeKindLabel,
      selectedNodeId,
      separatorNodeKindLabel,
      staticTypeLabels,
      viewportZoom,
      storyboardEditorCopy.nodeKindCard,
      storyboardEditorCopy.nodeKindEnd,
      storyboardEditorCopy.nodeKindGroup,
      storyboardEditorCopy.nodeKindStart,
      storyboardEditorCopy.nodeKindStatic
    ]
  );

  const fitActiveGraph = () => {
    reactFlowRef.current?.fitView({
      padding: 0.2,
      minZoom: 0.02,
      maxZoom: 1.2,
      duration: 180
    });
  };

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      fitActiveGraph();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeGroupPath, activeGraph.nodes.length, activeGraph.edges.length]);

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
        next.sort((a, b) => (a.info.notionType === b.info.notionType ? a.info.label.localeCompare(b.info.label) : a.info.notionType.localeCompare(b.info.notionType)));
        break;
      case 'type_desc':
        next.sort((a, b) => (a.info.notionType === b.info.notionType ? a.info.label.localeCompare(b.info.label) : b.info.notionType.localeCompare(a.info.notionType)));
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
      notionId: result.info.notionId,
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

  const uploadNarrationMedia = async (kind: 'image' | 'audio', file: File | null) => {
    if (!file || !selectedNode || selectedNode.kind !== 'static') return;
    if (!canEdit) return;
    if (!libraryRoleId) {
      setStatus(language === 'pl'
        ? 'Brak roli biblioteki. Nie można dodać zasobu.'
        : language === 'de'
          ? 'Bibliotheksrolle fehlt. Datei kann nicht angehängt werden.'
          : 'Library role is missing. Unable to attach media file.');
      return;
    }

    setMediaUploadTarget(kind);
    setStatus(null);
    try {
      const itemNameBase = selectedNode.title.trim() || 'storyboard-narration';
      const uploaded = await uploadDataItemFile(libraryRoleId, {
        file,
        itemName: `${itemNameBase}-${kind}`
      });

      updateSelectedNode((node) =>
        kind === 'image'
          ? { ...node, narrationImageEnabled: true, narrationImageFileId: uploaded.dataItemId }
          : { ...node, narrationAudioEnabled: true, narrationAudioFileId: uploaded.dataItemId }
      );

      setStatus(language === 'pl'
        ? `Dodano zaszyfrowany plik ${kind === 'image' ? 'obrazu' : 'audio'}.`
        : language === 'de'
          ? `Verschlüsselte ${kind === 'image' ? 'Bild' : 'Audio'}-Datei angehängt.`
          : `Encrypted ${kind} file attached.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setStatus(
        message ||
        (language === 'pl'
          ? 'Nie udało się przesłać pliku zaszyfrowanego.'
          : language === 'de'
            ? 'Verschlüsselte Datei konnte nicht hochgeladen werden.'
            : 'Failed to upload encrypted file.')
      );
    } finally {
      setMediaUploadTarget(null);
    }
  };

  const handleNarrationImagePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    void uploadNarrationMedia('image', file);
  };

  const handleNarrationAudioPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    void uploadNarrationMedia('audio', file);
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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSaveFailed(false);
        setStatus(authExpiredStatus);
      } else {
        setSaveFailed(true);
        setStatus(copy.cogita.library.modules.createFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  const addNode = (kind: 'static' | 'card' | 'group' | 'separator' | 'join') => {
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

  const setNodePosition = (nodeId: string, position: { x?: number; y?: number } | null | undefined) => {
    if (!canEdit) return;
    if (!position) return;
    const nextX = typeof position.x === 'number' && Number.isFinite(position.x) ? position.x : null;
    const nextY = typeof position.y === 'number' && Number.isFinite(position.y) ? position.y : null;
    if (nextX === null && nextY === null) return;

    updateActiveGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.nodeId !== nodeId) {
          return node;
        }

        const resolvedX = nextX ?? node.position.x;
        const resolvedY = nextY ?? node.position.y;
        if (resolvedX === node.position.x && resolvedY === node.position.y) {
          return node;
        }

        return {
          ...node,
          position: {
            x: resolvedX,
            y: resolvedY
          }
        };
      })
    }));
  };

  const getSourcePort = (sourceNode: StoryboardNodeRecord | undefined, handleId?: string | null): StoryboardSourcePort | null => {
    if (!sourceNode) return null;
    if (sourceNode.kind === 'card' || sourceNode.kind === 'join') {
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
      return `/#/cogita/public/storyboard/${encodeURIComponent(activeShare.shareCode)}`;
    }
    return `${window.location.origin}/#/cogita/public/storyboard/${encodeURIComponent(activeShare.shareCode)}`;
  }, [activeShare?.shareCode]);
  const storyboardSessionUrl = useMemo(() => {
    if (!activeSession?.sessionCode) return '';
    if (typeof window === 'undefined') {
      return `/#/cogita/public/storyboard-session/${encodeURIComponent(activeSession.sessionCode)}`;
    }
    return `${window.location.origin}/#/cogita/public/storyboard-session/${encodeURIComponent(activeSession.sessionCode)}`;
  }, [activeSession?.sessionCode]);

  const handleCopySharedLink = async () => {
    if (!storyboardSharedUrl) return;
    try {
      await navigator.clipboard.writeText(storyboardSharedUrl);
      setShareCopyStatus('copied');
    } catch {
      setShareCopyStatus('failed');
    }
  };

  const handleCopySessionLink = async () => {
    if (!storyboardSessionUrl) return;
    try {
      await navigator.clipboard.writeText(storyboardSessionUrl);
      setSessionCopyStatus('copied');
    } catch {
      setSessionCopyStatus('failed');
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

  const handleCreateSession = async () => {
    if (!selectedProject) return;
    setSessionStatus('working');
    setSessionCopyStatus('idle');
    try {
      const response = await createCogitaStoryboardSession({ libraryId, projectId: selectedProject.projectId });
      setActiveSession(response);
      setSessionStatus('ready');
      setSessionResultsStatus('working');
      try {
        const results = await getCogitaStoryboardSessionResults({ libraryId, sessionId: response.sessionId });
        setSessionResults(results);
        setSessionResultsStatus('idle');
      } catch {
        setSessionResults(null);
        setSessionResultsStatus('error');
      }
    } catch {
      setSessionStatus('error');
    }
  };

  const handleRevokeSession = async () => {
    if (!activeSession) return;
    setSessionStatus('working');
    try {
      await revokeCogitaStoryboardSession({ libraryId, sessionId: activeSession.sessionId });
      setActiveSession(null);
      setSessionResults(null);
      setSessionStatus('idle');
      setSessionCopyStatus('idle');
      setSessionResultsStatus('idle');
    } catch {
      setSessionStatus('error');
    }
  };

  const handleRefreshSessionResults = async () => {
    if (!activeSession) return;
    setSessionResultsStatus('working');
    try {
      const results = await getCogitaStoryboardSessionResults({ libraryId, sessionId: activeSession.sessionId });
      setSessionResults(results);
      setSessionResultsStatus('idle');
    } catch {
      setSessionResultsStatus('error');
    }
  };

  const handleImportJson = async () => {
    if (!canEdit || importStatus === 'working') return;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(importJsonInput);
    } catch {
      setImportError(importUiCopy.invalidJson);
      return;
    }

    setImportError(null);
    setImportStatus('working');
    setSaveFailed(false);
    setStatus(null);

    try {
      const targetProjectId = isEditMode ? selectedProject?.projectId ?? storyboardId ?? null : null;
      const targetGroupNodeId =
        targetProjectId && activeGroupPath.length > 0
          ? activeGroupPath[activeGroupPath.length - 1]
          : null;

      // Group-target import must resolve against persisted storyboard content.
      // Persist current editor state first to keep group path/node ids in sync.
      if (targetProjectId && targetGroupNodeId) {
        const prepared = buildDocumentForSave(documentState, projectDescription.trim());
        await updateCogitaCreationProject({
          libraryId,
          projectId: targetProjectId,
          name: (projectTitle.trim() || selectedProject?.name || 'Storyboard').trim(),
          content: prepared
        });
      }

      const result = await importCogitaStoryboardFromJson({
        libraryId,
        projectId: targetProjectId,
        name: projectTitle.trim() || selectedProject?.name || null,
        topicNotionId: documentState.storyboardTopicNotionId?.trim() || undefined,
        deleteOldStoryboardNotions: hasLinkedTopicNotion ? importDeleteOldNotions : false,
        targetGroupNodeId,
        json: parsedJson
      });

      const importedProject = result.project;
      setItems((current) => {
        const index = current.findIndex((item) => item.projectId === importedProject.projectId);
        if (index < 0) {
          return [importedProject, ...current];
        }
        const next = current.slice();
        next[index] = importedProject;
        return next;
      });

      const warningCount = result.warnings.length;
      const statusText = warningCount > 0 ? importUiCopy.statusWarnings(warningCount) : importUiCopy.statusDone;
      const notionStats = ` notions: +${result.createdNotions} / =${result.reusedNotions}`;
      const warningText = warningCount > 0 ? ` ${result.warnings[0]}` : '';
      setStatus(`${statusText}${notionStats}${warningText}`);

      setImportOverlayOpen(false);
      setImportJsonInput('');
      setImportDeleteOldNotions(false);
      setImportError(null);

      if (isCreateMode) {
        if (onCreated) {
          onCreated(importedProject);
        } else {
          navigateToEdit(importedProject.projectId);
        }
        return;
      }

      if (storyboardId && storyboardId !== importedProject.projectId) {
        navigateToEdit(importedProject.projectId);
        return;
      }

      const normalized = normalizeStoryboardDocument(importedProject.content);
      setProjectTitle(importedProject.name);
      setProjectDescription(normalized.description);
      setDocumentState(normalized);
      setActiveGroupPath([]);
      setSelectedNodeId(normalized.rootGraph.startNodeId);
      setSelectedEdgeId('');
      setCardPickerOpen(false);
      setCardNodeCards({});
      setCardNodeInfoLabels({});
      setCardNodeCardsStatus('idle');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setImportError(authExpiredStatus);
      } else {
        setImportError(copy.cogita.library.modules.createFailed);
      }
    } finally {
      setImportStatus('idle');
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
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleNarrationImagePicked}
      />
      <input
        ref={audioUploadInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleNarrationAudioPicked}
      />
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
              {canEdit ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setImportOverlayOpen(true);
                    setImportError(null);
                    setImportDeleteOldNotions(false);
                  }}
                  disabled={importStatus === 'working'}
                >
                  {importUiCopy.openAction}
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
                  <button type="button" className="cta ghost" onClick={() => void handleCreateSession()} disabled={sessionStatus === 'working'}>
                    {sessionStatus === 'working' ? sessionUiCopy.working : sessionUiCopy.createAction}
                  </button>
                  {storyboardSessionUrl ? (
                    <button type="button" className="cta ghost" onClick={() => void handleCopySessionLink()}>
                      {sessionUiCopy.copyAction}
                    </button>
                  ) : null}
                  {activeSession ? (
                    <>
                      <button type="button" className="cta ghost" onClick={() => void handleRefreshSessionResults()} disabled={sessionResultsStatus === 'working'}>
                        {sessionResultsStatus === 'working' ? sessionUiCopy.working : sessionUiCopy.refreshResultsAction}
                      </button>
                      <button type="button" className="cta ghost" onClick={() => void handleRevokeSession()} disabled={sessionStatus === 'working'}>
                        {sessionUiCopy.revokeAction}
                      </button>
                    </>
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

                  {storyboardSessionUrl ? (
                    <label className="cogita-field full">
                      <span>{sessionUiCopy.linkLabel}</span>
                      <input type="text" value={storyboardSessionUrl} readOnly />
                    </label>
                  ) : (
                    <p>{sessionUiCopy.linkEmpty}</p>
                  )}
                  {sessionStatus === 'error' ? <p className="cogita-form-error">{sessionUiCopy.updateError}</p> : null}
                  {sessionCopyStatus === 'copied' ? <p className="cogita-help">{sessionUiCopy.copied}</p> : null}
                  {sessionCopyStatus === 'failed' ? <p className="cogita-form-error">{sessionUiCopy.copyError}</p> : null}
                  {sessionResultsStatus === 'error' ? <p className="cogita-form-error">{sessionUiCopy.updateError}</p> : null}

                  {sessionResults ? (
                    <div className="cogita-share-list" style={{ gap: '0.65rem' }}>
                      <strong>{sessionUiCopy.resultsTitle}</strong>
                      <div className="cogita-storyboard-form-grid">
                        <label className="cogita-field">
                          <span>{sessionUiCopy.participantsLabel}</span>
                          <input type="text" value={String(sessionResults.participantCount)} readOnly />
                        </label>
                        <label className="cogita-field">
                          <span>{sessionUiCopy.answersLabel}</span>
                          <input type="text" value={String(sessionResults.totalAnswers)} readOnly />
                        </label>
                        <label className="cogita-field">
                          <span>{sessionUiCopy.correctLabel}</span>
                          <input type="text" value={String(sessionResults.correctAnswers)} readOnly />
                        </label>
                      </div>

                      {sessionResults.totalAnswers > 0 ? (
                        <>
                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <strong>{sessionUiCopy.participantResultsTitle}</strong>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="cogita-table">
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>{sessionUiCopy.answersLabel}</th>
                                    <th>{sessionUiCopy.correctLabel}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionResults.participants.map((row, index) => (
                                    <tr key={row.participantId}>
                                      <td>{index + 1}</td>
                                      <td>{row.totalAnswers}</td>
                                      <td>{row.correctAnswers}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <strong>{sessionUiCopy.nodeResultsTitle}</strong>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="cogita-table">
                                <thead>
                                  <tr>
                                    <th>{sessionUiCopy.rowNode}</th>
                                    <th>{sessionUiCopy.rowCheckType}</th>
                                    <th>{sessionUiCopy.rowParticipants}</th>
                                    <th>{sessionUiCopy.answersLabel}</th>
                                    <th>{sessionUiCopy.correctLabel}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionResults.nodes.map((row) => (
                                    <tr key={`${row.nodeKey}|${row.checkType ?? ''}`}>
                                      <td>{row.nodeKey}</td>
                                      <td>{row.checkType ?? '-'}</td>
                                      <td>{row.participantCount}</td>
                                      <td>{row.totalAnswers}</td>
                                      <td>{row.correctAnswers}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="cogita-help" style={{ margin: 0 }}>
                          {sessionUiCopy.noResults}
                        </p>
                      )}
                    </div>
                  ) : null}
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
                    <button type="button" className="ghost" onClick={() => addNode('separator')} disabled={!canEdit}>{addSeparatorActionLabel}</button>
                    <button type="button" className="ghost" onClick={() => addNode('join')} disabled={!canEdit}>{addJoinActionLabel}</button>
                    <button type="button" className="ghost" onClick={fitActiveGraph}>
                      {language === 'pl' ? 'Dopasuj widok' : language === 'de' ? 'Ansicht anpassen' : 'Fit view'}
                    </button>
                  </div>

                  <div className="cogita-storyboard-graph-canvas">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      nodeTypes={nodeTypes}
                      fitView
                      fitViewOptions={{ padding: 0.2, minZoom: 0.02, maxZoom: 1.2 }}
                      minZoom={0.02}
                      maxZoom={2}
                      elementsSelectable
                      nodesDraggable={canEdit}
                      onInit={(instance) => {
                        reactFlowRef.current = instance;
                        fitActiveGraph();
                      }}
                      onMove={(_, viewport) => {
                        setViewportZoom(viewport.zoom);
                      }}
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

                            {selectedNode.staticType === 'text' ? (
                              <>
                                <label className="cogita-field full" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedNode.narrationImageEnabled}
                                    disabled={!canEdit}
                                    onChange={(event) =>
                                      updateSelectedNode((node) => ({
                                        ...node,
                                        narrationImageEnabled: event.target.checked,
                                        narrationImageFileId: event.target.checked ? node.narrationImageFileId : ''
                                      }))
                                    }
                                  />
                                  <span>{language === 'pl' ? 'Włącz obraz nad narracją' : language === 'de' ? 'Bild über Narration aktivieren' : 'Enable image above narration'}</span>
                                </label>

                                {selectedNode.narrationImageEnabled ? (
                                  <div className="cogita-field full" style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{language === 'pl' ? 'Zaszyfrowany obraz' : language === 'de' ? 'Verschlüsseltes Bild' : 'Encrypted image'}</span>
                                    <input type="text" value={selectedNode.narrationImageFileId} readOnly placeholder="dataItemId" />
                                    <div className="cogita-card-actions">
                                      <button
                                        type="button"
                                        className="ghost"
                                        disabled={!canEdit || mediaUploadTarget === 'image'}
                                        onClick={() => imageUploadInputRef.current?.click()}
                                      >
                                        {mediaUploadTarget === 'image'
                                          ? (language === 'pl' ? 'Wysyłanie...' : language === 'de' ? 'Wird hochgeladen...' : 'Uploading...')
                                          : (language === 'pl' ? 'Dodaj zaszyfrowany obraz' : language === 'de' ? 'Verschlüsseltes Bild hochladen' : 'Upload encrypted image')}
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost"
                                        disabled={!canEdit}
                                        onClick={() => updateSelectedNode((node) => ({ ...node, narrationImageFileId: '' }))}
                                      >
                                        {language === 'pl' ? 'Wyczyść obraz' : language === 'de' ? 'Bild entfernen' : 'Clear image'}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                <label className="cogita-field full" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedNode.narrationAudioEnabled}
                                    disabled={!canEdit}
                                    onChange={(event) =>
                                      updateSelectedNode((node) => ({
                                        ...node,
                                        narrationAudioEnabled: event.target.checked,
                                        narrationAudioFileId: event.target.checked ? node.narrationAudioFileId : ''
                                      }))
                                    }
                                  />
                                  <span>{language === 'pl' ? 'Włącz audio narracji' : language === 'de' ? 'Narrations-Audio aktivieren' : 'Enable narration audio'}</span>
                                </label>

                                {selectedNode.narrationAudioEnabled ? (
                                  <div className="cogita-field full" style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{language === 'pl' ? 'Zaszyfrowane audio' : language === 'de' ? 'Verschlüsseltes Audio' : 'Encrypted audio'}</span>
                                    <input type="text" value={selectedNode.narrationAudioFileId} readOnly placeholder="dataItemId" />
                                    <div className="cogita-card-actions">
                                      <button
                                        type="button"
                                        className="ghost"
                                        disabled={!canEdit || mediaUploadTarget === 'audio'}
                                        onClick={() => audioUploadInputRef.current?.click()}
                                      >
                                        {mediaUploadTarget === 'audio'
                                          ? (language === 'pl' ? 'Wysyłanie...' : language === 'de' ? 'Wird hochgeladen...' : 'Uploading...')
                                          : (language === 'pl' ? 'Dodaj zaszyfrowane audio' : language === 'de' ? 'Verschlüsseltes Audio hochladen' : 'Upload encrypted audio')}
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost"
                                        disabled={!canEdit}
                                        onClick={() => updateSelectedNode((node) => ({ ...node, narrationAudioFileId: '' }))}
                                      >
                                        {language === 'pl' ? 'Wyczyść audio' : language === 'de' ? 'Audio entfernen' : 'Clear audio'}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </>
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
                                  {selectedNodeCards.map((card) => {
                                    const mappedDirection: StoryboardCardDirection =
                                      card.direction === 'back_to_front' || card.direction === 'front_to_back'
                                        ? card.direction
                                        : selectedNode.cardDirection;
                                    const key = `${card.checkType ?? ''}|${mappedDirection}`;
                                    return (
                                      <button
                                        key={buildCheckcardKey(card)}
                                        type="button"
                                        className={`ghost cogita-checkcard-row ${key === selectedCardKey ? 'active' : ''}`}
                                        onClick={() => {
                                          updateSelectedNode((node) => ({
                                            ...node,
                                            cardCheckType: card.checkType ?? '',
                                            cardDirection: mappedDirection
                                          }));
                                        }}
                                      >
                                        <span>{card.label}</span>
                                        <small>{card.checkType ?? ''}</small>
                                      </button>
                                    );
                                  })}
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
      <CogitaWorkspaceComponentOverlay
        open={importOverlayOpen && canEdit}
        title={importUiCopy.title}
        closeLabel={copy.cogita.shell.back}
        workspaceLinkTo={`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards`}
        workspaceLinkLabel={importUiCopy.workspaceAction}
        onClose={() => {
          setImportOverlayOpen(false);
          setImportError(null);
          setImportDeleteOldNotions(false);
        }}
      >
        <div className="cogita-storyboard-meta-form">
          <p className="cogita-help">{importUiCopy.hint}</p>
          <label className="cogita-field full">
            <span>JSON</span>
            <textarea
              value={importJsonInput}
              onChange={(event) => setImportJsonInput(event.target.value)}
              rows={18}
              placeholder="{ ... }"
              disabled={importStatus === 'working'}
            />
          </label>
          {hasLinkedTopicNotion ? (
            <label className="cogita-field full" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={importDeleteOldNotions}
                onChange={(event) => setImportDeleteOldNotions(event.target.checked)}
                disabled={importStatus === 'working'}
              />
              <span style={{ margin: 0 }}>{importUiCopy.deleteOldToggleLabel}</span>
            </label>
          ) : null}
          {importError ? <p className="cogita-form-error">{importError}</p> : null}
          <div className="cogita-form-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setImportJsonInput('');
                setImportError(null);
                setImportDeleteOldNotions(false);
              }}
              disabled={importStatus === 'working'}
            >
              {importUiCopy.clearAction}
            </button>
            <button
              type="button"
              className="cta"
              onClick={() => void handleImportJson()}
              disabled={importStatus === 'working' || !importJsonInput.trim()}
            >
              {importStatus === 'working' ? importUiCopy.submittingAction : importUiCopy.submitAction}
            </button>
          </div>
        </div>
      </CogitaWorkspaceComponentOverlay>
    </CogitaShell>
  );
}

function CogitaStoryboardSearch({
  items,
  query,
  onQueryChange,
  defaultQuery = '',
  searchLabel,
  searchPlaceholder,
  loading,
  loadingLabel,
  loadFailed,
  failedLabel,
  emptyLabel,
  showInput = true,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  buildStoryboardHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  onStoryboardSelect,
  onStoryboardOpen,
  onResultsChange
}: {
  items: CogitaCreationProject[];
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  searchLabel: string;
  searchPlaceholder: string;
  loading: boolean;
  loadingLabel: string;
  loadFailed: boolean;
  failedLabel: string;
  emptyLabel: string;
  showInput?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  buildStoryboardHref?: (item: CogitaCreationProject) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  onStoryboardSelect?: (item: CogitaCreationProject) => void;
  onStoryboardOpen?: (item: CogitaCreationProject) => void;
  onResultsChange?: (items: CogitaCreationProject[]) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  const filtered = useMemo(() => {
    const needle = effectiveQuery.trim().toLowerCase();
    return !needle
      ? items
      : items.filter((item) => item.name.toLowerCase().includes(needle) || item.projectId.toLowerCase().includes(needle));
  }, [effectiveQuery, items]);

  useEffect(() => {
    onResultsChangeRef.current?.(filtered);
  }, [filtered]);

  const handleQueryChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {showInput ? (
        <div className="cogita-search-field">
          <input
            aria-label={inputAriaLabel ?? searchLabel}
            className={inputClassName}
            value={effectiveQuery}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </div>
      ) : null}

      {loading ? <p>{loadingLabel}</p> : null}
      {!loading && loadFailed ? <p>{failedLabel}</p> : null}
      {!loading && !loadFailed && filtered.length === 0 ? <p>{emptyLabel}</p> : null}

      {!hideResultsList ? (
        <div className="cogita-card-list" data-view="list">
          {filtered.map((item) => {
            const href = buildStoryboardHref ? buildStoryboardHref(item) : null;
            return (
              <div key={item.projectId} className="cogita-card-item">
                <div className="cogita-info-result-row">
                  {href && !onStoryboardSelect ? (
                    <a className="cogita-info-result-main" href={href}>
                      <h3 className="cogita-card-title">{item.name}</h3>
                      <p className="cogita-card-subtitle">{item.projectId}</p>
                    </a>
                  ) : (
                    <button type="button" className="cogita-info-result-main" onClick={() => onStoryboardSelect?.(item)}>
                      <h3 className="cogita-card-title">{item.name}</h3>
                      <p className="cogita-card-subtitle">{item.projectId}</p>
                    </button>
                  )}
                  {showOpenAction && href ? (
                    <a className="ghost" href={href}>
                      {openActionLabel}
                    </a>
                  ) : showOpenAction && onStoryboardOpen ? (
                    <button type="button" className="ghost" onClick={() => onStoryboardOpen(item)}>
                      {openActionLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CogitaWorkspaceComponentOverlay({
  open,
  title,
  closeLabel,
  onClose,
  workspaceLinkTo,
  workspaceLinkLabel,
  children
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  workspaceLinkTo?: string;
  workspaceLinkLabel?: string;
  children: ReactNode;
}) {
  return (
    <CogitaOverlay
      open={open}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      size="wide"
      workspaceActionLabel={workspaceLinkLabel}
      workspaceActionTo={workspaceLinkTo}
    >
      {children}
    </CogitaOverlay>
  );
}
