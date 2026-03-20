import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  downloadCogitaPublicStoryboardFile,
  downloadDataItemFile,
  getCogitaCreationProjects,
  getCogitaInfoApproachProjection,
  getCogitaInfoCheckcards,
  getCogitaInfoDetail,
  getCogitaPublicStoryboardInfoApproachProjection,
  getCogitaPublicStoryboardInfoCheckcards,
  getCogitaPublicStoryboardInfoDetail,
  getCogitaPublicStoryboardShare,
  type CogitaCardSearchResult,
  type CogitaCreationProject
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaShell } from './CogitaShell';
import { CogitaLivePromptCard } from './live/components/CogitaLivePromptCard';
import { buildRevisionQuestionRuntime } from './components/runtime/revision/RevisionRuntimeShell';
import { parseQuestionDefinitionFromPayload } from './components/workspace/notion/types/notionQuestion';
import {
  evaluateCheckcardDetailed,
  type CheckcardAnswerModel,
  type CheckcardExpectedModel,
  type CheckcardPromptModel
} from './components/runtime/revision/primitives/RevisionCheckcardShell';

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
  version: number;
  description: string;
  script: string;
  steps: string[];
  rootGraph: StoryboardGraph;
  publicNotionPayloads: Record<string, unknown>;
};

type RuntimeBlock = {
  key: string;
  kind: StoryboardNodeKind;
  title: string;
  description: string;
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

type RuntimeCardState = {
  nodeKey: string;
  status: 'loading' | 'ready' | 'error' | 'evaluated';
  promptText: string;
  promptModel: CheckcardPromptModel;
  expectedModel: CheckcardExpectedModel;
  answerModel: CheckcardAnswerModel;
  notionType: string | null;
  cardType: string | null;
  checkType: string | null;
  isCorrect: boolean | null;
};

function toString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function toFinite(value: unknown, fallback: number) {
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
    position: { x: 820, y: 220 },
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

function normalizeDirection(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function directionMatchesNode(direction: string | null | undefined, nodeDirection: StoryboardCardDirection) {
  const normalized = normalizeDirection(direction);
  if (!normalized) return true;
  if (nodeDirection === 'front_to_back') {
    return normalized === 'front_to_back' || normalized === 'a-to-b' || normalized === 'forward';
  }
  return normalized === 'back_to_front' || normalized === 'b-to-a' || normalized === 'reverse';
}

function toQuestionCheckTypeFromPayload(payload: unknown): string | null {
  const parsed = parseQuestionDefinitionFromPayload(payload);
  if (!parsed) return null;
  return `question-${parsed.type}`;
}

function buildStoryboardQuestionRuntime(
  value: unknown,
  fallbackPrompt: string
): {
  promptText: string;
  promptModel: CheckcardPromptModel;
  expectedModel: CheckcardExpectedModel;
  initialAnswers: CheckcardAnswerModel;
} | null {
  const runtime = buildRevisionQuestionRuntime(value, fallbackPrompt);
  if (!runtime) return null;
  return {
    promptText: runtime.promptText,
    promptModel: runtime.promptModel,
    expectedModel: runtime.expectedModel,
    initialAnswers: {
      text: runtime.initialAnswers.text,
      selection: runtime.initialAnswers.selection,
      booleanAnswer: runtime.initialAnswers.booleanAnswer,
      ordering: runtime.initialAnswers.ordering,
      matchingPaths: runtime.initialAnswers.matchingRows,
      matchingSelection: runtime.initialAnswers.matchingSelection
    }
  };
}

function pickNodeCard(
  node: StoryboardNodeRecord,
  cards: CogitaCardSearchResult[],
  preferredQuestionCheckType?: string | null
) {
  if (cards.length === 0) return null;
  const wantedCheckType = node.cardCheckType.trim().toLowerCase();
  const preferredCheckType = (preferredQuestionCheckType ?? '').trim().toLowerCase();
  if (wantedCheckType === 'question' && preferredCheckType) {
    const exactPreferred = cards.filter(
      (card) => (card.checkType ?? '').trim().toLowerCase() === preferredCheckType
    );
    const directionPreferred = exactPreferred.filter((card) => directionMatchesNode(card.direction, node.cardDirection));
    if (directionPreferred.length > 0) return directionPreferred[0];
    if (exactPreferred.length > 0) return exactPreferred[0];
  }

  const checkFiltered = wantedCheckType
    ? cards.filter((card) => {
        const cardCheckType = (card.checkType ?? '').trim().toLowerCase();
        if (cardCheckType === wantedCheckType) return true;
        if (wantedCheckType === 'question' && cardCheckType.startsWith('question-')) return true;
        return false;
      })
    : cards;
  const directionFiltered = checkFiltered.filter((card) => directionMatchesNode(card.direction, node.cardDirection));
  if (directionFiltered.length > 0) return directionFiltered[0];
  if (checkFiltered.length > 0) return checkFiltered[0];
  return cards[0];
}

function buildCardPromptAndExpected(payload: {
  node: StoryboardNodeRecord;
  card: CogitaCardSearchResult | null;
  infoType: string | null;
  infoPayload: Record<string, unknown> | null;
  vocabProjection: Record<string, unknown> | null;
}): { prompt: string; expected: string } {
  const { node, card, infoType, infoPayload, vocabProjection } = payload;
  let prompt = card?.description?.trim() || node.description.trim() || card?.label || node.title;
  let expected = card?.label?.trim() || node.title;

  if (card?.cardType === 'vocab' && vocabProjection && Array.isArray(vocabProjection.words)) {
    const words = vocabProjection.words as Array<{ label?: string }>;
    const wordA = String(words[0]?.label ?? '?');
    const wordB = String(words[1]?.label ?? '?');
    const cardDirection = normalizeDirection(card.direction);
    if (cardDirection === 'b-to-a' || cardDirection === 'back_to_front') {
      prompt = wordB;
      expected = wordA;
    } else {
      prompt = wordA;
      expected = wordB;
    }
    return { prompt, expected };
  }

  if (infoPayload) {
    const questionText =
      (typeof infoPayload.question === 'string' && infoPayload.question.trim()) ||
      (typeof infoPayload.prompt === 'string' && infoPayload.prompt.trim()) ||
      (typeof infoPayload.text === 'string' && infoPayload.text.trim()) ||
      '';
    if (questionText) {
      prompt = questionText;
    } else if (infoType === 'citation') {
      const title =
        (typeof infoPayload.title === 'string' && infoPayload.title.trim()) ||
        (typeof infoPayload.label === 'string' && infoPayload.label.trim()) ||
        '';
      if (title) prompt = title;
    }
  }

  return { prompt, expected };
}

function buildLivePrompt(payload: {
  promptText: string;
  promptModel: CheckcardPromptModel;
}) {
  const { promptText, promptModel } = payload;
  if (promptModel.kind === 'selection') {
    return {
      kind: 'selection',
      prompt: promptText,
      options: Array.isArray(promptModel.options) ? promptModel.options : [],
      multiple: Boolean(promptModel.allowMultiple)
    } as const;
  }
  if (promptModel.kind === 'boolean') {
    return {
      kind: 'boolean',
      prompt: promptText
    } as const;
  }
  if (promptModel.kind === 'ordering') {
    return {
      kind: 'ordering',
      prompt: promptText,
      options: Array.isArray(promptModel.options) ? promptModel.options : []
    } as const;
  }
  if (promptModel.kind === 'matching') {
    return {
      kind: 'matching',
      prompt: promptText,
      columns: Array.isArray(promptModel.columns) ? promptModel.columns : []
    } as const;
  }
  if (promptModel.kind === 'citation-fragment') {
    return {
      kind: 'citation-fragment',
      prompt: promptText
    } as const;
  }

  return {
    kind: 'text',
    prompt: promptText,
    inputType: promptModel.inputType ?? 'text'
  } as const;
}

function hasAnswerForPrompt(promptModel: CheckcardPromptModel, answerModel: CheckcardAnswerModel) {
  if (promptModel.kind === 'selection') {
    return (answerModel.selection?.length ?? 0) > 0;
  }
  if (promptModel.kind === 'boolean') {
    return typeof answerModel.booleanAnswer === 'boolean';
  }
  if (promptModel.kind === 'ordering') {
    return (answerModel.ordering?.length ?? 0) > 0;
  }
  if (promptModel.kind === 'matching') {
    return (answerModel.matchingPaths?.length ?? 0) > 0;
  }
  return (answerModel.text ?? '').trim().length > 0;
}

function toRevealedAnswer(promptModel: CheckcardPromptModel, answerModel: CheckcardAnswerModel): unknown {
  if (promptModel.kind === 'selection') {
    return answerModel.selection ?? [];
  }
  if (promptModel.kind === 'boolean') {
    return answerModel.booleanAnswer ?? null;
  }
  if (promptModel.kind === 'ordering') {
    return answerModel.ordering ?? [];
  }
  if (promptModel.kind === 'matching') {
    return { paths: answerModel.matchingPaths ?? [] };
  }
  return answerModel.text ?? '';
}

function parseGraph(raw: unknown): StoryboardGraph {
  const fallback = createDefaultGraph();
  if (!raw || typeof raw !== 'object') return fallback;

  const root = raw as Record<string, unknown>;
  const rawNodes = Array.isArray(root.nodes) ? (root.nodes as Array<Record<string, unknown>>) : [];
  const nodes: StoryboardNodeRecord[] = rawNodes.map((item, index) => {
    const kind = normalizeNodeKind(item.kind ?? item.nodeType);
    const narration = item.narration && typeof item.narration === 'object' && !Array.isArray(item.narration)
      ? (item.narration as Record<string, unknown>)
      : null;
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
      narrationImageEnabled: toBoolean(item.narrationImageEnabled ?? narration?.imageEnabled),
      narrationImageFileId: toString(item.narrationImageFileId ?? narration?.imageFileId),
      narrationAudioEnabled: toBoolean(item.narrationAudioEnabled ?? narration?.audioEnabled),
      narrationAudioFileId: toString(item.narrationAudioFileId ?? narration?.audioFileId),
      notionId: toString(item.notionId ?? item.infoId ?? item.itemId),
      cardCheckType: toString(item.cardCheckType ?? item.checkType),
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
        rootGraph: parseGraph(root.rootGraph),
        publicNotionPayloads:
          root.publicNotionPayloads && typeof root.publicNotionPayloads === 'object' && !Array.isArray(root.publicNotionPayloads)
            ? (root.publicNotionPayloads as Record<string, unknown>)
            : {}
      };
    }
    if (root.schema === 'cogita_storyboard_graph' && Array.isArray(root.nodes)) {
      return {
        schema: 'cogita_storyboard_graph',
        version: typeof root.version === 'number' ? root.version : 1,
        description: toString(root.description),
        script: toString(root.script),
        steps: Array.isArray(root.steps) ? root.steps.map((entry) => toString(entry)).filter(Boolean) : [],
        rootGraph: parseGraph(root),
        publicNotionPayloads:
          root.publicNotionPayloads && typeof root.publicNotionPayloads === 'object' && !Array.isArray(root.publicNotionPayloads)
            ? (root.publicNotionPayloads as Record<string, unknown>)
            : {}
      };
    }
  }

  return {
    schema: 'cogita_storyboard_graph',
    version: 2,
    description: '',
    script: '',
    steps: [],
    rootGraph: createDefaultGraph(),
    publicNotionPayloads: {}
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
    narrationImageEnabled: node.narrationImageEnabled,
    narrationImageFileId: node.narrationImageFileId,
    narrationAudioEnabled: node.narrationAudioEnabled,
    narrationAudioFileId: node.narrationAudioFileId,
    notionId: node.notionId,
    cardCheckType: node.cardCheckType,
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
  storyboardId,
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
  storyboardId?: string;
  shareCode?: string;
}) {
  const navigate = useNavigate();
  const runtimeCopy = copy.cogita.library.modules.storyboardsRuntime;
  const [project, setProject] = useState<CogitaCreationProject | null>(null);
  const [runtimeLibraryId, setRuntimeLibraryId] = useState<string | undefined>(libraryId);
  const [documentState, setDocumentState] = useState<StoryboardDocument | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [cardState, setCardState] = useState<RuntimeCardState | null>(null);
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const cardTransitionTimer = useRef<number | null>(null);
  const mediaObjectUrlsRef = useRef<Record<string, string>>({});
  const mediaLoadingKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (shareCode) {
      let cancelled = false;
      setLoading(true);
      setStatus(null);
      setRuntimeLibraryId(undefined);

      getCogitaPublicStoryboardShare({ shareCode })
        .then((share) => {
          if (cancelled) return;
          const normalized = normalizeDocument(share.content);
          setRuntimeLibraryId(share.libraryId);
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

    if (!libraryId || !storyboardId) {
      setLoading(false);
      setStatus(runtimeCopy.statusMissingParams);
      setRuntimeLibraryId(undefined);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStatus(null);
    setRuntimeLibraryId(libraryId);

    getCogitaCreationProjects({ libraryId, projectType: 'storyboard' })
      .then((projects) => {
        if (cancelled) return;
        const found = projects.find((item) => item.projectId === storyboardId) ?? null;
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
  }, [libraryId, storyboardId, shareCode]);

  useEffect(() => {
    return () => {
      if (cardTransitionTimer.current != null) {
        window.clearTimeout(cardTransitionTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    mediaObjectUrlsRef.current = mediaObjectUrls;
  }, [mediaObjectUrls]);

  useEffect(() => {
    return () => {
      Object.values(mediaObjectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      mediaObjectUrlsRef.current = {};
      mediaLoadingKeysRef.current.clear();
    };
  }, []);

  const currentNode = useMemo(() => {
    if (!runtime) return null;
    return findNode(runtime.graph, runtime.currentNodeId);
  }, [runtime]);

  useEffect(() => {
    if (cardTransitionTimer.current != null) {
      window.clearTimeout(cardTransitionTimer.current);
      cardTransitionTimer.current = null;
    }

    if (!runtime || !currentNode || currentNode.kind !== 'card') {
      setCardState(null);
      return;
    }

    const nodeKey = buildNodeKey(runtime.graphPath, currentNode.nodeId);
    setCardState({
      nodeKey,
      status: 'loading',
      promptText: '',
      promptModel: { kind: 'text', inputType: 'text' },
      expectedModel: '',
      answerModel: { text: '' },
      notionType: null,
      cardType: null,
      checkType: null,
      isCorrect: null
    });

    let cancelled = false;
    const loadCard = async () => {
      let prompt = currentNode.description.trim() || currentNode.title;
      let expected = currentNode.title;
      let promptModel: CheckcardPromptModel = { kind: 'text', inputType: 'text' };
      let expectedModel: CheckcardExpectedModel = expected;
      let answerModel: CheckcardAnswerModel = { text: '' };
      let notionType: string | null = null;
      let cardType: string | null = null;
      let checkType: string | null = currentNode.cardCheckType.trim() || null;
      const isSharedRuntime = Boolean(shareCode);
      const notionId = currentNode.notionId.trim();
      const publicNotionPayload =
        notionId && documentState?.publicNotionPayloads
          ? documentState.publicNotionPayloads[notionId]
          : undefined;

      if ((isSharedRuntime || runtimeLibraryId) && notionId) {
        try {
          const [cardsBundle, detail] = await Promise.all([
            isSharedRuntime
              ? getCogitaPublicStoryboardInfoCheckcards({ shareCode: shareCode!, infoId: notionId })
              : getCogitaInfoCheckcards({ libraryId: runtimeLibraryId!, infoId: notionId }),
            (isSharedRuntime
              ? getCogitaPublicStoryboardInfoDetail({ shareCode: shareCode!, infoId: notionId })
              : getCogitaInfoDetail({ libraryId: runtimeLibraryId!, infoId: notionId })
            ).catch(() => null)
          ]);
          const preferredQuestionCheckType =
            currentNode.cardCheckType.trim().toLowerCase() === 'question'
              ? toQuestionCheckTypeFromPayload(
                  detail?.payload ??
                    cardsBundle.items.find((card) => (card.checkType ?? '').trim().toLowerCase().startsWith('question-'))?.payload ??
                    null
                )
              : null;
          const selectedCard = pickNodeCard(currentNode, cardsBundle.items, preferredQuestionCheckType);
          let vocabProjection: Record<string, unknown> | null = null;
          if (detail?.infoType === 'translation') {
            try {
              const projection = isSharedRuntime
                ? await getCogitaPublicStoryboardInfoApproachProjection({
                    shareCode: shareCode!,
                    infoId: notionId,
                    approachKey: 'vocab-card'
                  })
                : await getCogitaInfoApproachProjection({
                    libraryId: runtimeLibraryId!,
                    infoId: notionId,
                    approachKey: 'vocab-card'
                  });
              vocabProjection = (projection.projection ?? null) as Record<string, unknown> | null;
            } catch {
              vocabProjection = null;
            }
          }
          const built = buildCardPromptAndExpected({
            node: currentNode,
            card: selectedCard,
            infoType: detail?.infoType ?? selectedCard?.infoType ?? null,
            infoPayload: detail?.payload ? (detail.payload as Record<string, unknown>) : null,
            vocabProjection
          });
          notionType = detail?.infoType ?? selectedCard?.infoType ?? null;
          cardType = selectedCard?.cardType ?? null;
          checkType = selectedCard?.checkType ?? checkType;
          prompt = built.prompt;
          expected = built.expected;

          const questionRuntime =
            (detail?.infoType === 'question' || selectedCard?.infoType === 'question')
              ? buildStoryboardQuestionRuntime(
                  detail?.payload ??
                    selectedCard?.payload ??
                    cardsBundle.items.find((card) => (card.checkType ?? '').trim().toLowerCase().startsWith('question-'))?.payload ??
                    publicNotionPayload ??
                    null,
                  prompt
                )
              : null;
          if (questionRuntime) {
            prompt = questionRuntime.promptText || prompt;
            promptModel = questionRuntime.promptModel;
            expectedModel = questionRuntime.expectedModel;
            answerModel = questionRuntime.initialAnswers;
          } else {
            promptModel = { kind: 'text', inputType: 'text' };
            expectedModel = expected;
            answerModel = { text: '' };
          }
        } catch {
          const sharedQuestionRuntime = buildStoryboardQuestionRuntime(publicNotionPayload ?? null, prompt);
          if (sharedQuestionRuntime) {
            notionType = 'question';
            checkType = toQuestionCheckTypeFromPayload(publicNotionPayload ?? null) ?? checkType;
            prompt = sharedQuestionRuntime.promptText || prompt;
            promptModel = sharedQuestionRuntime.promptModel;
            expectedModel = sharedQuestionRuntime.expectedModel;
            answerModel = sharedQuestionRuntime.initialAnswers;
          } else {
            // Keep fallback prompt/expected from node metadata.
            promptModel = { kind: 'text', inputType: 'text' };
            expectedModel = expected;
            answerModel = { text: '' };
          }
        }
      } else {
        const sharedQuestionRuntime = buildStoryboardQuestionRuntime(publicNotionPayload ?? null, prompt);
        if (sharedQuestionRuntime) {
          notionType = 'question';
          checkType = toQuestionCheckTypeFromPayload(publicNotionPayload ?? null) ?? checkType;
          prompt = sharedQuestionRuntime.promptText || prompt;
          promptModel = sharedQuestionRuntime.promptModel;
          expectedModel = sharedQuestionRuntime.expectedModel;
          answerModel = sharedQuestionRuntime.initialAnswers;
        }
      }

      if (cancelled) return;
      setCardState({
        nodeKey,
        status: 'ready',
        promptText: prompt,
        promptModel,
        expectedModel,
        answerModel,
        notionType,
        cardType,
        checkType,
        isCorrect: null
      });
    };

    void loadCard();
    return () => {
      cancelled = true;
    };
  }, [currentNode, documentState, runtimeLibraryId, runtime, shareCode]);

  useEffect(() => {
    const required = new Map<string, { fileId: string; mediaType: 'image' | 'audio' }>();
    if (runtime) {
      runtime.displayedBlocks.forEach((block) => {
        if (block.kind !== 'static') return;
        if (block.narrationImageEnabled && block.narrationImageFileId.trim()) {
          const fileId = block.narrationImageFileId.trim();
          required.set(`image:${fileId}`, { fileId, mediaType: 'image' });
        }
        if (block.narrationAudioEnabled && block.narrationAudioFileId.trim()) {
          const fileId = block.narrationAudioFileId.trim();
          required.set(`audio:${fileId}`, { fileId, mediaType: 'audio' });
        }
      });
    }

    setMediaObjectUrls((current) => {
      let changed = false;
      const next: Record<string, string> = { ...current };
      Object.entries(current).forEach(([key, url]) => {
        if (!required.has(key)) {
          URL.revokeObjectURL(url);
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });

    let cancelled = false;
    required.forEach(({ fileId }, key) => {
      if (mediaObjectUrlsRef.current[key] || mediaLoadingKeysRef.current.has(key)) {
        return;
      }

      mediaLoadingKeysRef.current.add(key);
      const loader = shareCode
        ? downloadCogitaPublicStoryboardFile({ shareCode, dataItemId: fileId })
        : downloadDataItemFile(fileId);

      void loader
        .then((blob) => {
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(blob);
          setMediaObjectUrls((current) => {
            if (current[key]) {
              URL.revokeObjectURL(objectUrl);
              return current;
            }
            return { ...current, [key]: objectUrl };
          });
        })
        .catch(() => {
          if (!cancelled) {
            // Keep runtime resilient if media file is missing or inaccessible.
          }
        })
        .finally(() => {
          mediaLoadingKeysRef.current.delete(key);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [runtime, shareCode]);

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
      return advanceRuntime(current, edge.toNodeId, edge.displayMode);
    });
  };

  const restart = () => {
    if (!documentState) return;
    if (cardTransitionTimer.current != null) {
      window.clearTimeout(cardTransitionTimer.current);
      cardTransitionTimer.current = null;
    }
    setRuntime(createInitialRuntime(documentState.rootGraph));
    setCardState(null);
    setStatus(null);
  };

  const submitCardAnswer = () => {
    if (!cardState || cardState.status !== 'ready') return;
    const evaluation = evaluateCheckcardDetailed({
      prompt: cardState.promptModel,
      expected: cardState.expectedModel,
      answer: cardState.answerModel,
      context: {
        notionType: cardState.notionType,
        cardType: cardState.cardType,
        checkType: cardState.checkType ?? currentNode?.cardCheckType ?? null
      }
    });
    const isCorrect = evaluation.isCorrect;
    setCardState((current) => {
      if (!current) return current;
      if (current.nodeKey !== cardState.nodeKey) return current;
      return {
        ...current,
        status: 'evaluated',
        isCorrect
      };
    });

    const outcomeEdge = isCorrect ? cardRightEdge : cardWrongEdge;
    if (!outcomeEdge) {
      setStatus(runtimeCopy.noCardOutcomeLink);
      return;
    }
    setStatus(null);
    cardTransitionTimer.current = window.setTimeout(() => {
      chooseCardOutcome(outcomeEdge);
      cardTransitionTimer.current = null;
    }, 1100);
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
            onClick={() => navigate(`/cogita/workspace/libraries/${encodeURIComponent(libraryId)}/storyboards${storyboardId ? `/${encodeURIComponent(storyboardId)}` : ''}`)}
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
            {runtime.displayedBlocks
              .filter((block) => block.kind !== 'card')
              .map((block) => (
              <article key={block.key} className="cogita-library-detail" style={{ margin: 0 }}>
                <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.55rem' }}>
                  <h3 className="cogita-detail-title" style={{ margin: 0 }}>{block.title || runtimeCopy.blockUntitled}</h3>
                  {block.kind === 'static' ? (
                    <>
                      {block.narrationImageEnabled && block.narrationImageFileId.trim() && mediaObjectUrls[`image:${block.narrationImageFileId.trim()}`] ? (
                        <img
                          src={mediaObjectUrls[`image:${block.narrationImageFileId.trim()}`]}
                          alt={block.title || runtimeCopy.blockUntitled}
                          style={{
                            width: '100%',
                            maxHeight: '300px',
                            objectFit: 'contain',
                            borderRadius: '0.85rem',
                            border: '1px solid rgba(111, 214, 255, 0.2)'
                          }}
                        />
                      ) : null}
                      {block.staticBody ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{block.staticBody}</p> : null}
                      {block.description ? <p className="cogita-help" style={{ margin: 0 }}>{block.description}</p> : null}
                      {block.narrationAudioEnabled && block.narrationAudioFileId.trim() && mediaObjectUrls[`audio:${block.narrationAudioFileId.trim()}`] ? (
                        <audio
                          controls
                          autoPlay
                          preload="metadata"
                          src={mediaObjectUrls[`audio:${block.narrationAudioFileId.trim()}`]}
                        />
                      ) : null}
                      {(block.staticType === 'video' || block.staticType === 'audio' || block.staticType === 'image') && block.mediaUrl ? (
                        <a className="ghost" href={block.mediaUrl} target="_blank" rel="noreferrer">{runtimeCopy.openMediaAction}</a>
                      ) : null}
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
              <article className="cogita-library-detail" style={{ margin: 0 }}>
                <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.55rem' }}>
                  {cardState?.status === 'loading' ? (
                    <p className="cogita-help" style={{ margin: 0 }}>{runtimeCopy.cardLoading}</p>
                  ) : null}
                  {cardState && cardState.status !== 'loading' ? (
                    <>
                      {(() => {
                        const livePrompt = buildLivePrompt({
                          promptText: cardState.promptText,
                          promptModel: cardState.promptModel
                        });
                        const revealExpected = cardState.status === 'evaluated'
                          ? cardState.expectedModel
                          : undefined;
                        const revealedAnswer = cardState.status === 'evaluated'
                          ? toRevealedAnswer(cardState.promptModel, cardState.answerModel)
                          : undefined;
                        return (
                      <CogitaLivePromptCard
                        prompt={livePrompt}
                        revealExpected={revealExpected}
                        revealedAnswer={revealedAnswer}
                        surfaceState={cardState.status === 'evaluated' ? (cardState.isCorrect ? 'correct' : 'incorrect') : 'idle'}
                        mode={cardState.status === 'evaluated' ? 'readonly' : 'interactive'}
                        labels={{
                          answerLabel: runtimeCopy.cardAnswerLabel,
                          correctAnswerLabel: runtimeCopy.cardRevealLabel,
                          participantAnswerPlaceholder: runtimeCopy.cardAnswerPlaceholder,
                          trueLabel: runtimeCopy.rightAction,
                          falseLabel: runtimeCopy.wrongAction,
                          fragmentLabel: runtimeCopy.cardPromptLabel,
                          correctFragmentLabel: runtimeCopy.cardRevealLabel,
                          unsupportedPromptType: runtimeCopy.cardLoading,
                          waitingForReveal: '',
                          selectedPaths: '',
                          removePath: '',
                          columnPrefix: ''
                        }}
                        answers={{
                          text: cardState.answerModel.text ?? '',
                          selection: cardState.answerModel.selection ?? [],
                          booleanAnswer: typeof cardState.answerModel.booleanAnswer === 'boolean' ? cardState.answerModel.booleanAnswer : null,
                          ordering: cardState.answerModel.ordering ?? [],
                          matchingRows: cardState.answerModel.matchingPaths ?? [],
                          matchingSelection: cardState.answerModel.matchingSelection ?? []
                        }}
                        onTextChange={(value) =>
                          setCardState((current) => {
                            if (!current || current.nodeKey !== cardState.nodeKey || current.status === 'evaluated') return current;
                            return { ...current, answerModel: { ...current.answerModel, text: value } };
                          })
                        }
                        onSelectionToggle={(index) =>
                          setCardState((current) => {
                            if (!current || current.nodeKey !== cardState.nodeKey || current.status === 'evaluated') return current;
                            const existing = current.answerModel.selection ?? [];
                            const alreadySelected = existing.includes(index);
                            const allowMultiple = current.promptModel.kind === 'selection' ? Boolean(current.promptModel.allowMultiple) : false;
                            const nextSelection = allowMultiple
                              ? alreadySelected
                                ? existing.filter((value) => value !== index)
                                : [...existing, index]
                              : [index];
                            return { ...current, answerModel: { ...current.answerModel, selection: nextSelection } };
                          })
                        }
                        onBooleanChange={(value) =>
                          setCardState((current) => {
                            if (!current || current.nodeKey !== cardState.nodeKey || current.status === 'evaluated') return current;
                            return { ...current, answerModel: { ...current.answerModel, booleanAnswer: value } };
                          })
                        }
                        onOrderingMove={(index, delta) =>
                          setCardState((current) => {
                            if (!current || current.nodeKey !== cardState.nodeKey || current.status === 'evaluated') return current;
                            const ordering = [...(current.answerModel.ordering ?? [])];
                            const swapIndex = index + delta;
                            if (index < 0 || index >= ordering.length || swapIndex < 0 || swapIndex >= ordering.length) {
                              return current;
                            }
                            [ordering[index], ordering[swapIndex]] = [ordering[swapIndex], ordering[index]];
                            return { ...current, answerModel: { ...current.answerModel, ordering } };
                          })
                        }
                        onMatchingPick={(columnIndex, optionIndex) =>
                          setCardState((current) => {
                            if (!current || current.nodeKey !== cardState.nodeKey || current.status === 'evaluated') return current;
                            const width =
                              current.promptModel.kind === 'matching'
                                ? Math.max(2, current.promptModel.columns?.length ?? 2)
                                : 2;
                            const nextSelection = [...(current.answerModel.matchingSelection ?? new Array(width).fill(null))];
                            if (nextSelection.length < width) {
                              nextSelection.push(...new Array(width - nextSelection.length).fill(null));
                            }
                            nextSelection[columnIndex] = optionIndex;
                            const allSelected = nextSelection.every((value) => Number.isInteger(value));
                            if (!allSelected) {
                              return {
                                ...current,
                                answerModel: { ...current.answerModel, matchingSelection: nextSelection }
                              };
                            }

                            const nextPath = nextSelection.map((value) => Number(value));
                            const key = nextPath.join('|');
                            const existingPaths = current.answerModel.matchingPaths ?? [];
                            if (existingPaths.some((path) => path.join('|') === key)) {
                              return {
                                ...current,
                                answerModel: {
                                  ...current.answerModel,
                                  matchingSelection: new Array(width).fill(null)
                                }
                              };
                            }

                            return {
                              ...current,
                              answerModel: {
                                ...current.answerModel,
                                matchingPaths: [...existingPaths, nextPath],
                                matchingSelection: new Array(width).fill(null)
                              }
                            };
                          })
                        }
                        onMatchingRemovePath={(pathIndex) =>
                          setCardState((current) => {
                            if (!current || current.nodeKey !== cardState.nodeKey || current.status === 'evaluated') return current;
                            const existingPaths = current.answerModel.matchingPaths ?? [];
                            if (pathIndex < 0 || pathIndex >= existingPaths.length) return current;
                            return {
                              ...current,
                              answerModel: {
                                ...current.answerModel,
                                matchingPaths: existingPaths.filter((_, index) => index !== pathIndex)
                              }
                            };
                          })
                        }
                      />
                        );
                      })()}
                      <div className="cogita-card-actions">
                        <button
                          type="button"
                          className="cta"
                          onClick={submitCardAnswer}
                          disabled={cardState.status !== 'ready' || !hasAnswerForPrompt(cardState.promptModel, cardState.answerModel)}
                        >
                          {runtimeCopy.cardSubmitAction}
                        </button>
                      </div>
                      {cardState.status === 'evaluated' ? (
                        <>
                          <p className={cardState.isCorrect ? 'cogita-help' : 'cogita-form-error'} style={{ margin: 0 }}>
                            {cardState.isCorrect ? runtimeCopy.rightAction : runtimeCopy.wrongAction}
                          </p>
                          <p className="cogita-help" style={{ margin: 0 }}>
                            {runtimeCopy.cardAutoAdvance}
                          </p>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </article>
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
