import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  downloadCogitaPublicStoryboardFile,
  downloadCogitaPublicStoryboardSessionFile,
  downloadDataItemFile,
  getCogitaCreationProjects,
  getCogitaNotionApproachProjection,
  getCogitaNotionCheckcards,
  getCogitaNotionDetail,
  getCogitaPublicStoryboardSession,
  getCogitaPublicStoryboardSessionNotionApproachProjection,
  getCogitaPublicStoryboardSessionNotionCheckcards,
  getCogitaPublicStoryboardSessionNotionDetail,
  getCogitaPublicStoryboardNotionApproachProjection,
  getCogitaPublicStoryboardNotionCheckcards,
  getCogitaPublicStoryboardNotionDetail,
  getCogitaPublicStoryboardShare,
  submitCogitaPublicStoryboardSessionAnswer,
  touchCogitaPublicStoryboardSessionParticipant,
  type CogitaCardSearchResult,
  type CogitaCreationProject
} from '../../../../../lib/api';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';
import { CogitaShell } from '../../../CogitaShell';
import { CogitaLivePromptCard } from '../../../live/components/CogitaLivePromptCard';
import { buildRevisionQuestionRuntime } from '../revision/RevisionRuntimeShell';
import { parseQuestionDefinitionFromPayload } from '../../workspace/notion/types/notionQuestion';
import { parsePythonDefinitionFromPayload as parsePythonDefinitionPayload } from '../../workspace/notion/types/notionPython';
import {
  evaluateCheckcardDetailed,
  normalizeCheckcardAnswer,
  type CheckcardAnswerModel,
  type CheckcardExpectedModel,
  type CheckcardPromptModel
} from '../revision/primitives/RevisionCheckcardShell';
import {
  BrowserPythonRunnerClient,
  type BrowserPythonEvaluateResult,
  type BrowserPythonProgress
} from '../../../python/pythonRunnerClient';

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
  version: number;
  description: string;
  script: string;
  steps: string[];
  rootGraph: StoryboardGraph;
  storyboardTopicNotionId?: string;
  storyboardManagedNotionIds?: string[];
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
  activeSeparatorByGraphPath: Record<string, string>;
  activeChapterStartByGraphPath: Record<string, string>;
  finished: boolean;
};

type OutlineItemKind = 'node' | 'branch' | 'parallel' | 'merge' | 'note';

type StoryboardOutlineItem = {
  key: string;
  kind: OutlineItemKind;
  label: string;
  graphPath: string[];
  nodeId?: string;
  nodeKind?: StoryboardNodeKind;
  nodeKey?: string;
  children: StoryboardOutlineItem[];
  depth: number;
  reused?: boolean;
};

type RuntimeCardState = {
  nodeKey: string;
  status: 'loading' | 'ready' | 'submitting' | 'error' | 'evaluated';
  promptText: string;
  promptModel: CheckcardPromptModel;
  expectedModel: CheckcardExpectedModel;
  answerModel: CheckcardAnswerModel;
  notionType: string | null;
  cardType: string | null;
  checkType: string | null;
  isCorrect: boolean | null;
  pythonDefinition?: PythonRuntimeDefinition | null;
  pythonEvaluation?: PythonRuntimeEvaluation | null;
  pythonProgress?: BrowserPythonProgress | null;
};

type LoadedCardRuntime = {
  nodeKey: string;
  promptText: string;
  promptModel: CheckcardPromptModel;
  expectedModel: CheckcardExpectedModel;
  answerModel: CheckcardAnswerModel;
  notionType: string | null;
  cardType: string | null;
  checkType: string | null;
  pythonDefinition?: PythonRuntimeDefinition | null;
};

type PythonRuntimeDefinition = {
  createInputSource: string;
  referenceSource: string;
  starterSource: string;
  taskText: string;
  caseCount: number;
  seed: number;
};

type PythonRuntimeEvaluation = BrowserPythonEvaluateResult & {
  passed: boolean;
};

type ResolvedCardEntry = {
  nodeKey: string;
  title: string;
  promptText: string;
  promptModel: CheckcardPromptModel;
  expectedModel: CheckcardExpectedModel;
  answerModel: CheckcardAnswerModel;
  isCorrect: boolean;
  checkType: string | null;
  pythonEvaluation: PythonRuntimeEvaluation | null;
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

function createDeterministicSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = hash >>> 0;
  return normalized === 0 ? 1 : normalized;
}

function toPythonDefinitionNode(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>;
    if (source.definition && typeof source.definition === 'object' && !Array.isArray(source.definition)) {
      return source.definition as Record<string, unknown>;
    }
    return source;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return toPythonDefinitionNode(parsed);
  } catch {
    return null;
  }
}

function parsePythonRuntimeDefinition(payload: unknown, seedSource: string): PythonRuntimeDefinition | null {
  const definitionNode = toPythonDefinitionNode(payload);
  if (!definitionNode) return null;
  const rawCreateInputSource = typeof definitionNode.createInputSource === 'string' ? definitionNode.createInputSource.trim() : '';
  const rawReferenceSource = typeof definitionNode.referenceSource === 'string' ? definitionNode.referenceSource.trim() : '';
  const rawStarterSource = typeof definitionNode.starterSource === 'string' ? definitionNode.starterSource.trim() : '';
  if (!rawCreateInputSource || !rawReferenceSource || !rawStarterSource) {
    return null;
  }

  const parsed = parsePythonDefinitionPayload(payload);
  if (!parsed) return null;

  return {
    createInputSource: parsed.createInputSource,
    referenceSource: parsed.referenceSource,
    starterSource: parsed.starterSource,
    taskText: parsed.taskText,
    caseCount: parsed.caseCount,
    seed: createDeterministicSeed(seedSource)
  };
}

function toPythonRuntimeEvaluation(result: BrowserPythonEvaluateResult): PythonRuntimeEvaluation {
  const status = (result.status ?? 'sandbox_error').trim().toLowerCase();
  return {
    ...result,
    status: status as PythonRuntimeEvaluation['status'],
    passed: status === 'passed'
  };
}

function formatDiagnosticJson(raw: string | null | undefined) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return trimmed;
  }
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
    inputType: promptModel.inputType ?? 'text',
    multiLine: Boolean(promptModel.multiLine)
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
    return (answerModel.ordering?.length ?? 0) > 0 || (promptModel.options?.length ?? 0) > 0;
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
      const sourceNode = nodeById.get(fromNodeId);
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
              : sourceNode?.kind === 'card' || sourceNode?.kind === 'join'
                ? 'out-right'
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
        storyboardTopicNotionId: toString(root.storyboardTopicNotionId),
        storyboardManagedNotionIds: Array.isArray(root.storyboardManagedNotionIds)
          ? root.storyboardManagedNotionIds.map((entry) => toString(entry)).filter((entry) => entry.length > 0)
          : [],
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
        storyboardTopicNotionId: toString(root.storyboardTopicNotionId),
        storyboardManagedNotionIds: Array.isArray(root.storyboardManagedNotionIds)
          ? root.storyboardManagedNotionIds.map((entry) => toString(entry)).filter((entry) => entry.length > 0)
          : [],
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
    storyboardTopicNotionId: '',
    storyboardManagedNotionIds: [],
    publicNotionPayloads: {}
  };
}

function buildNodeKey(graphPath: string[], nodeId: string) {
  return `${graphPath.join('/') || 'root'}::${nodeId}`;
}

type OutlineLabels = {
  startLabel: string;
  endLabel: string;
  checkcardPrefix: string;
  chapterPrefix: string;
  subchapterPrefix: string;
  orphanPrefix: string;
};

function getOutlineNodeLabel(node: StoryboardNodeRecord, labels: OutlineLabels) {
  const title = node.title.trim() || 'Untitled';
  if (node.kind === 'start') return labels.startLabel;
  if (node.kind === 'end') return labels.endLabel;
  if (node.kind === 'card') return `${labels.checkcardPrefix}: ${title}`;
  if (node.kind === 'separator') return `${labels.chapterPrefix}: ${title}`;
  if (node.kind === 'group') return `${labels.subchapterPrefix}: ${title}`;
  return title;
}

function getOutlineEdgeRank(sourcePort: StoryboardSourcePort, sourceKind: StoryboardNodeKind) {
  if (sourceKind === 'card' || sourceKind === 'join') {
    if (sourcePort === 'out-right') return 0;
    if (sourcePort === 'out-wrong') return 1;
    if (sourcePort === 'out-path') return 2;
    return 3;
  }
  if (sourcePort === 'out-path') return 0;
  if (sourcePort === 'out-right') return 1;
  if (sourcePort === 'out-wrong') return 2;
  return 3;
}

function getOutlineOutgoingEdges(graph: StoryboardGraph, node: StoryboardNodeRecord) {
  const allowedPorts: StoryboardSourcePort[] =
    node.kind === 'card' || node.kind === 'join'
      ? ['out-right', 'out-wrong', 'out-path']
      : ['out-path'];

  return graph.edges
    .filter((edge) => edge.fromNodeId === node.nodeId && allowedPorts.includes(edge.sourcePort))
    .sort((left, right) => {
      const rankDiff = getOutlineEdgeRank(left.sourcePort, node.kind) - getOutlineEdgeRank(right.sourcePort, node.kind);
      if (rankDiff !== 0) return rankDiff;
      const leftLabel = left.label.trim().toLowerCase();
      const rightLabel = right.label.trim().toLowerCase();
      return leftLabel.localeCompare(rightLabel);
    });
}

function buildStoryboardOutline(
  graph: StoryboardGraph,
  graphPath: string[],
  labels: OutlineLabels
): StoryboardOutlineItem[] {
  return buildStoryboardOutlineLinear({
    graph,
    graphPath,
    nodeId: graph.startNodeId,
    depth: 0,
    seen: new Set<string>(),
    labels,
    includeOrphans: true
  }).items;
}

function buildStoryboardOutlineLinear(payload: {
  graph: StoryboardGraph;
  graphPath: string[];
  nodeId: string;
  depth: number;
  seen: Set<string>;
  labels: OutlineLabels;
  includeOrphans?: boolean;
}): { items: StoryboardOutlineItem[]; visitedNodeIds: Set<string> } {
  const { graph, graphPath, nodeId, depth, labels, includeOrphans = false } = payload;
  const items: StoryboardOutlineItem[] = [];
  const visitedNodeIds = new Set<string>();
  const seenNodeKeys = new Set(payload.seen);
  const stack: string[] = [nodeId];
  let guard = 0;

  while (stack.length > 0 && guard < 1000) {
    guard += 1;
    const nextNodeId = stack.pop();
    if (!nextNodeId) break;
    if (visitedNodeIds.has(nextNodeId)) continue;

    const node = findNode(graph, nextNodeId);
    if (!node) continue;

    const nodeKey = buildNodeKey(graphPath, node.nodeId);
    if (seenNodeKeys.has(nodeKey)) continue;
    seenNodeKeys.add(nodeKey);
    visitedNodeIds.add(node.nodeId);

    const item: StoryboardOutlineItem = {
      key: `node:${nodeKey}:${depth}:${items.length}`,
      kind: 'node',
      label: getOutlineNodeLabel(node, labels),
      graphPath,
      nodeId: node.nodeId,
      nodeKind: node.kind,
      nodeKey,
      children: [],
      depth
    };

    const includeInOutline = node.kind !== 'start' && node.kind !== 'end';
    if (includeInOutline) {
      if (node.kind === 'group' && node.groupGraph) {
        const groupOutline = buildStoryboardOutlineLinear({
          graph: node.groupGraph,
          graphPath: [...graphPath, node.nodeId],
          nodeId: node.groupGraph.startNodeId,
          depth: depth + 1,
          seen: new Set<string>(),
          labels,
          includeOrphans: true
        });
        item.children = groupOutline.items;
      }

      items.push(item);
    }

    const outgoing = getOutlineOutgoingEdges(graph, node);
    const nextIds = Array.from(new Set(outgoing.map((edge) => edge.toNodeId)));
    for (let index = nextIds.length - 1; index >= 0; index -= 1) {
      const candidateNodeId = nextIds[index];
      if (!visitedNodeIds.has(candidateNodeId)) {
        stack.push(candidateNodeId);
      }
    }
  }

  if (includeOrphans) {
    const orphanNodes = graph.nodes
      .filter((node) => !visitedNodeIds.has(node.nodeId))
      .sort((left, right) => {
        const yDiff = left.position.y - right.position.y;
        if (Math.abs(yDiff) > 1) return yDiff;
        const xDiff = left.position.x - right.position.x;
        if (Math.abs(xDiff) > 1) return xDiff;
        return left.title.localeCompare(right.title);
      });

    orphanNodes.forEach((node, index) => {
      if (node.kind === 'start' || node.kind === 'end') return;
      const nodeKey = buildNodeKey(graphPath, node.nodeId);
      if (seenNodeKeys.has(nodeKey)) return;
      seenNodeKeys.add(nodeKey);
      visitedNodeIds.add(node.nodeId);

      const orphanItem: StoryboardOutlineItem = {
        key: `orphan:${nodeKey}:${depth}:${index}`,
        kind: 'note',
        label: `${labels.orphanPrefix}: ${getOutlineNodeLabel(node, labels)}`,
        graphPath,
        nodeId: node.nodeId,
        nodeKind: node.kind,
        nodeKey,
        children: [],
        depth
      };

      if (node.kind === 'group' && node.groupGraph) {
        const orphanGroupOutline = buildStoryboardOutlineLinear({
          graph: node.groupGraph,
          graphPath: [...graphPath, node.nodeId],
          nodeId: node.groupGraph.startNodeId,
          depth: depth + 1,
          seen: new Set<string>(),
          labels,
          includeOrphans: true
        });
        orphanItem.children = orphanGroupOutline.items;
      }

      items.push(orphanItem);
    });
  }

  return { items, visitedNodeIds };
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
    activeSeparatorByGraphPath: { ...state.activeSeparatorByGraphPath },
    activeChapterStartByGraphPath: { ...state.activeChapterStartByGraphPath },
    finished: state.finished
  };
}

function buildGraphPathKey(graphPath: string[]) {
  return graphPath.join('/') || 'root';
}

function getSeparatorRemainingEdges(
  graph: StoryboardGraph,
  graphPath: string[],
  separatorNodeId: string,
  visited: Record<string, boolean>,
  onlyRemaining: boolean
) {
  const options = getOutgoingEdges(graph, graphPath, separatorNodeId, 'out-path', visited);
  if (!onlyRemaining) return options;
  return options.filter((edge) => visited[buildNodeKey(graphPath, edge.toNodeId)] !== true);
}

function findJoinNodeIdForSeparator(graph: StoryboardGraph, separatorNodeId: string) {
  const joinEdge = graph.edges.find(
    (edge) => edge.toNodeId === separatorNodeId && edge.sourcePort === 'out-wrong'
  );
  if (!joinEdge) return null;
  const joinNode = findNode(graph, joinEdge.fromNodeId);
  if (!joinNode || joinNode.kind !== 'join') return null;
  return joinNode.nodeId;
}

function collectUpcomingCardNodeLocations(payload: {
  graph: StoryboardGraph;
  graphPath: string[];
  startNodeIds: string[];
  visited: Record<string, boolean>;
  maxDepth?: number;
  maxCards?: number;
}) {
  const maxDepth = Math.max(1, payload.maxDepth ?? 3);
  const maxCards = Math.max(1, payload.maxCards ?? 10);
  const queue: Array<{ graph: StoryboardGraph; graphPath: string[]; nodeId: string; depth: number }> = payload.startNodeIds.map((nodeId) => ({
    graph: payload.graph,
    graphPath: payload.graphPath,
    nodeId,
    depth: 0
  }));
  const seen = new Set<string>();
  const cards: Array<{ graphPath: string[]; node: StoryboardNodeRecord }> = [];

  while (queue.length > 0 && cards.length < maxCards) {
    const next = queue.shift();
    if (!next) break;
    const locationKey = buildNodeKey(next.graphPath, next.nodeId);
    if (seen.has(locationKey)) continue;
    seen.add(locationKey);
    const node = findNode(next.graph, next.nodeId);
    if (!node) continue;

    if (node.kind === 'card') {
      cards.push({ graphPath: next.graphPath, node });
    }

    if (next.depth >= maxDepth) {
      continue;
    }

    if (node.kind === 'group' && node.groupGraph) {
      queue.push({
        graph: node.groupGraph,
        graphPath: [...next.graphPath, node.nodeId],
        nodeId: node.groupGraph.startNodeId,
        depth: next.depth + 1
      });
    }

    const sourcePorts: StoryboardSourcePort[] =
      node.kind === 'card' || node.kind === 'join'
        ? ['out-right', 'out-wrong', 'out-path']
        : ['out-path'];
    sourcePorts.forEach((sourcePort) => {
      const outgoing = getOutgoingEdges(next.graph, next.graphPath, node.nodeId, sourcePort, payload.visited);
      outgoing.forEach((edge) => {
        queue.push({
          graph: next.graph,
          graphPath: next.graphPath,
          nodeId: edge.toNodeId,
          depth: next.depth + 1
        });
      });
    });
  }

  return cards;
}

function collectUpcomingStaticMediaRefs(payload: {
  graph: StoryboardGraph;
  graphPath: string[];
  startNodeIds: string[];
  visited: Record<string, boolean>;
  maxDepth?: number;
  maxNodes?: number;
  maxMedia?: number;
}) {
  const maxDepth = Math.max(1, payload.maxDepth ?? 3);
  const maxNodes = Math.max(1, payload.maxNodes ?? 32);
  const maxMedia = Math.max(1, payload.maxMedia ?? 24);
  const queue: Array<{ graph: StoryboardGraph; graphPath: string[]; nodeId: string; depth: number }> = payload.startNodeIds.map((nodeId) => ({
    graph: payload.graph,
    graphPath: payload.graphPath,
    nodeId,
    depth: 0
  }));
  const seen = new Set<string>();
  const media = new Map<string, { fileId: string; mediaType: 'image' | 'audio' }>();
  let visitedNodes = 0;

  while (queue.length > 0 && visitedNodes < maxNodes && media.size < maxMedia) {
    const next = queue.shift();
    if (!next) break;
    const locationKey = buildNodeKey(next.graphPath, next.nodeId);
    if (seen.has(locationKey)) continue;
    seen.add(locationKey);
    visitedNodes += 1;

    const node = findNode(next.graph, next.nodeId);
    if (!node) continue;

    if (node.kind === 'static') {
      if (node.narrationImageEnabled && node.narrationImageFileId.trim()) {
        const fileId = node.narrationImageFileId.trim();
        media.set(`image:${fileId}`, { fileId, mediaType: 'image' });
      }
      if (node.narrationAudioEnabled && node.narrationAudioFileId.trim()) {
        const fileId = node.narrationAudioFileId.trim();
        media.set(`audio:${fileId}`, { fileId, mediaType: 'audio' });
      }
      if (media.size >= maxMedia) break;
    }

    if (next.depth >= maxDepth) {
      continue;
    }

    if (node.kind === 'group' && node.groupGraph) {
      queue.push({
        graph: node.groupGraph,
        graphPath: [...next.graphPath, node.nodeId],
        nodeId: node.groupGraph.startNodeId,
        depth: next.depth + 1
      });
    }

    const sourcePorts: StoryboardSourcePort[] =
      node.kind === 'card' || node.kind === 'join'
        ? ['out-right', 'out-wrong', 'out-path']
        : ['out-path'];
    sourcePorts.forEach((sourcePort) => {
      const outgoing = getOutgoingEdges(next.graph, next.graphPath, node.nodeId, sourcePort, payload.visited);
      outgoing.forEach((edge) => {
        queue.push({
          graph: next.graph,
          graphPath: next.graphPath,
          nodeId: edge.toNodeId,
          depth: next.depth + 1
        });
      });
    });
  }

  return Array.from(media.values());
}

function getRuntimeForwardStartNodeIds(runtime: RuntimeState, currentNode: StoryboardNodeRecord) {
  const startEdges =
    currentNode.kind === 'separator'
      ? getSeparatorRemainingEdges(
          runtime.graph,
          runtime.graphPath,
          currentNode.nodeId,
          runtime.visited,
          runtime.activeSeparatorByGraphPath[buildGraphPathKey(runtime.graphPath)] === currentNode.nodeId
        )
      : (currentNode.kind === 'card' || currentNode.kind === 'join'
          ? ([
              ...getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-right', runtime.visited),
              ...getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-wrong', runtime.visited),
              ...getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-path', runtime.visited)
            ] as StoryboardGraphEdge[])
          : getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-path', runtime.visited));
  return Array.from(new Set(startEdges.map((edge) => edge.toNodeId)));
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

    if (node.kind === 'join') {
      const graphPathKey = buildGraphPathKey(next.graphPath);
      const separatorNodeId = next.activeSeparatorByGraphPath[graphPathKey];
      const separatorNode = separatorNodeId ? findNode(next.graph, separatorNodeId) : null;

      if (separatorNode?.kind === 'separator') {
        const separatorEdges = getOutgoingEdges(next.graph, next.graphPath, separatorNode.nodeId, 'out-path', next.visited);
        const requiredTargets = Array.from(new Set(separatorEdges.map((edge) => edge.toNodeId)));
        const allFulfilled = requiredTargets.every(
          (targetNodeId) => next.visited[buildNodeKey(next.graphPath, targetNodeId)] === true
        );

        const preferredPort: StoryboardSourcePort = allFulfilled ? 'out-right' : 'out-wrong';
        const preferredEdge =
          getOutgoingEdges(next.graph, next.graphPath, node.nodeId, preferredPort, next.visited)[0] ??
          getOutgoingEdges(next.graph, next.graphPath, node.nodeId, 'out-path', next.visited)[0] ??
          null;

        if (allFulfilled) {
          delete next.activeSeparatorByGraphPath[graphPathKey];
          delete next.activeChapterStartByGraphPath[graphPathKey];
        }

        if (preferredEdge) {
          nodeId = preferredEdge.toNodeId;
          displayMode = preferredEdge.displayMode;
          continue;
        }
      }

      const fallbackEdge =
        getOutgoingEdges(next.graph, next.graphPath, node.nodeId, 'out-path', next.visited)[0] ??
        getOutgoingEdges(next.graph, next.graphPath, node.nodeId, 'out-right', next.visited)[0] ??
        getOutgoingEdges(next.graph, next.graphPath, node.nodeId, 'out-wrong', next.visited)[0] ??
        null;
      if (fallbackEdge) {
        nodeId = fallbackEdge.toNodeId;
        displayMode = fallbackEdge.displayMode;
        continue;
      }
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
    activeSeparatorByGraphPath: {},
    activeChapterStartByGraphPath: {},
    finished: false
  };
  return advanceRuntime(base, rootGraph.startNodeId, 'new_screen');
}

export type CogitaStoryboardRuntimeProps = {
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
  sessionCode?: string;
};

export function CogitaStoryboardRuntime({
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
  shareCode,
  sessionCode
}: CogitaStoryboardRuntimeProps) {
  const navigate = useNavigate();
  const runtimeCopy = copy.cogita.library.modules.storyboardsRuntime;
  const pythonRuntimeCopy = useMemo(
    () =>
      language === 'pl'
        ? {
            resignAction: 'Rezygnuję',
            retryHint: 'Błędna odpowiedź. Popraw kod i spróbuj ponownie albo zrezygnuj.'
          }
        : language === 'de'
          ? {
              resignAction: 'Ich gebe auf',
              retryHint: 'Falsche Antwort. Korrigiere den Code und versuche es erneut oder gib auf.'
            }
          : {
              resignAction: 'Resign',
              retryHint: 'Wrong answer. Fix the code and try again, or resign.'
            },
    [language]
  );
  const [project, setProject] = useState<CogitaCreationProject | null>(null);
  const [runtimeLibraryId, setRuntimeLibraryId] = useState<string | undefined>(libraryId);
  const [documentState, setDocumentState] = useState<StoryboardDocument | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [cardState, setCardState] = useState<RuntimeCardState | null>(null);
  const [resolvedCards, setResolvedCards] = useState<ResolvedCardEntry[]>([]);
  const [expandedResolvedCards, setExpandedResolvedCards] = useState<Record<string, boolean>>({});
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const cardTransitionTimer = useRef<number | null>(null);
  const mediaObjectUrlsRef = useRef<Record<string, string>>({});
  const mediaLoadingKeysRef = useRef<Set<string>>(new Set());
  const runtimeScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const previousRuntimeSignatureRef = useRef('');
  const cardRuntimeCacheRef = useRef<Record<string, LoadedCardRuntime>>({});
  const cardRuntimeInFlightRef = useRef<Record<string, Promise<LoadedCardRuntime | null>>>({});
  const pythonRunnerRef = useRef<BrowserPythonRunnerClient | null>(null);
  const runtimeHistoryRef = useRef<RuntimeState[]>([]);
  const runtimeHistoryIndexRef = useRef(-1);
  const [runtimeHistoryVersion, setRuntimeHistoryVersion] = useState(0);
  const [canNavigateBack, setCanNavigateBack] = useState(false);
  const [canNavigateForward, setCanNavigateForward] = useState(false);
  const [expandedOutlineNodes, setExpandedOutlineNodes] = useState<Record<string, boolean>>({});
  const [isNarrowScreen, setIsNarrowScreen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 980 : false
  );
  const [outlineOpenOnNarrow, setOutlineOpenOnNarrow] = useState(false);
  const sessionParticipantTokenRef = useRef<string | null>(null);
  const activeRuntimeSessionCode = useMemo(() => {
    const normalized = sessionCode?.trim();
    return normalized ? normalized : null;
  }, [sessionCode]);

  const ensureSessionParticipantToken = useCallback(async () => {
    if (!activeRuntimeSessionCode) return null;
    if (sessionParticipantTokenRef.current) return sessionParticipantTokenRef.current;

    const storageKey = `cogita.storyboard.session.participant.${activeRuntimeSessionCode}`;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    const fallbackToken =
      stored && stored.trim().length >= 8
        ? stored.trim()
        : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;

    const touched = await touchCogitaPublicStoryboardSessionParticipant({
      sessionCode: activeRuntimeSessionCode,
      participantToken: fallbackToken
    });
    const participantToken = (touched.participantToken ?? fallbackToken).trim() || fallbackToken;
    sessionParticipantTokenRef.current = participantToken;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, participantToken);
    }
    return participantToken;
  }, [activeRuntimeSessionCode]);

  const submitSessionOutcome = useCallback(async (
    nodeKey: string,
    notionId: string,
    checkType: string | null,
    isCorrect: boolean
  ) => {
    if (!activeRuntimeSessionCode) return;
    const participantToken = await ensureSessionParticipantToken();
    if (!participantToken) return;

    let notionIdValue: string | null = null;
    const normalizedNotionId = notionId.trim();
    if (normalizedNotionId && /^[0-9a-fA-F-]{32,36}$/.test(normalizedNotionId)) {
      notionIdValue = normalizedNotionId;
    }

    try {
      await submitCogitaPublicStoryboardSessionAnswer({
        sessionCode: activeRuntimeSessionCode,
        participantToken,
        nodeKey,
        notionId: notionIdValue,
        checkType,
        isCorrect
      });
    } catch {
      // Keep runtime flow uninterrupted even if telemetry submit fails.
    }
  }, [activeRuntimeSessionCode, ensureSessionParticipantToken]);

  const refreshRuntimeNavigation = useCallback(() => {
    const stack = runtimeHistoryRef.current;
    const index = runtimeHistoryIndexRef.current;
    setCanNavigateBack(index > 0);
    setCanNavigateForward(index >= 0 && index < stack.length - 1);
    setRuntimeHistoryVersion((value) => value + 1);
  }, []);

  const setInitialRuntimeState = useCallback(
    (nextRuntime: RuntimeState | null) => {
      setRuntime(nextRuntime);
      setResolvedCards([]);
      setExpandedResolvedCards({});
      setExpandedOutlineNodes({});
      if (nextRuntime) {
        runtimeHistoryRef.current = [nextRuntime];
        runtimeHistoryIndexRef.current = 0;
      } else {
        runtimeHistoryRef.current = [];
        runtimeHistoryIndexRef.current = -1;
      }
      refreshRuntimeNavigation();
    },
    [refreshRuntimeNavigation]
  );

  const pushRuntimeSnapshot = useCallback(
    (nextRuntime: RuntimeState) => {
      setRuntime(nextRuntime);
      const currentIndex = runtimeHistoryIndexRef.current;
      const base =
        currentIndex >= 0
          ? runtimeHistoryRef.current.slice(0, currentIndex + 1)
          : [];
      base.push(nextRuntime);
      runtimeHistoryRef.current = base;
      runtimeHistoryIndexRef.current = base.length - 1;
      refreshRuntimeNavigation();
    },
    [refreshRuntimeNavigation]
  );

  const applyRuntimeTransition = useCallback(
    (updater: (current: RuntimeState) => RuntimeState) => {
      if (!runtime) return;
      const nextRuntime = updater(runtime);
      pushRuntimeSnapshot(nextRuntime);
    },
    [pushRuntimeSnapshot, runtime]
  );

  const navigateRuntimeBack = useCallback(() => {
    const currentIndex = runtimeHistoryIndexRef.current;
    if (currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    const snapshot = runtimeHistoryRef.current[nextIndex];
    if (!snapshot) return;
    runtimeHistoryIndexRef.current = nextIndex;
    setRuntime(snapshot);
    refreshRuntimeNavigation();
  }, [refreshRuntimeNavigation]);

  const navigateRuntimeForward = useCallback(() => {
    const currentIndex = runtimeHistoryIndexRef.current;
    const nextIndex = currentIndex + 1;
    const snapshot = runtimeHistoryRef.current[nextIndex];
    if (!snapshot) return;
    runtimeHistoryIndexRef.current = nextIndex;
    setRuntime(snapshot);
    refreshRuntimeNavigation();
  }, [refreshRuntimeNavigation]);

  useEffect(() => {
    cardRuntimeCacheRef.current = {};
    cardRuntimeInFlightRef.current = {};
    sessionParticipantTokenRef.current = null;
  }, [libraryId, runtimeLibraryId, shareCode, sessionCode, storyboardId]);

  useEffect(() => {
    if (activeRuntimeSessionCode) {
      let cancelled = false;
      setLoading(true);
      setStatus(null);
      setRuntimeLibraryId(undefined);

      getCogitaPublicStoryboardSession({ sessionCode: activeRuntimeSessionCode })
        .then((session) => {
          if (cancelled) return;
          const normalized = normalizeDocument(session.content);
          setRuntimeLibraryId(session.libraryId);
          setProject({
            projectId: session.projectId,
            projectType: 'storyboard',
            name: session.projectName,
            content: session.content ?? null,
            createdUtc: session.createdUtc,
            updatedUtc: session.createdUtc
          });
          setDocumentState(normalized);
          setInitialRuntimeState(createInitialRuntime(normalized.rootGraph));
          setLoading(false);
          void ensureSessionParticipantToken().catch(() => {
            // Keep runtime usable even when participant registration fails.
          });
        })
        .catch((err) => {
          if (cancelled) return;
          setStatus(err instanceof Error ? err.message : runtimeCopy.statusLoadSharedFailed);
          setProject(null);
          setDocumentState(null);
          setInitialRuntimeState(null);
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

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
          setInitialRuntimeState(createInitialRuntime(normalized.rootGraph));
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setStatus(err instanceof Error ? err.message : runtimeCopy.statusLoadSharedFailed);
          setProject(null);
          setDocumentState(null);
          setInitialRuntimeState(null);
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
      setProject(null);
      setDocumentState(null);
      setInitialRuntimeState(null);
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
          setInitialRuntimeState(null);
          setStatus(runtimeCopy.statusNotFound);
          setLoading(false);
          return;
        }

        const normalized = normalizeDocument(found.content);
        setProject(found);
        setDocumentState(normalized);
        setInitialRuntimeState(createInitialRuntime(normalized.rootGraph));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : runtimeCopy.statusLoadFailed);
        setProject(null);
        setDocumentState(null);
        setInitialRuntimeState(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRuntimeSessionCode, ensureSessionParticipantToken, libraryId, storyboardId, setInitialRuntimeState, shareCode, runtimeCopy.statusLoadFailed, runtimeCopy.statusLoadSharedFailed, runtimeCopy.statusNotFound]);

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

  useEffect(() => {
    const updateLayoutMode = () => {
      const narrow = window.innerWidth < 980;
      setIsNarrowScreen(narrow);
      if (!narrow) {
        setOutlineOpenOnNarrow(false);
      }
    };

    updateLayoutMode();
    window.addEventListener('resize', updateLayoutMode);
    return () => {
      window.removeEventListener('resize', updateLayoutMode);
    };
  }, []);

  useEffect(() => {
    pythonRunnerRef.current = new BrowserPythonRunnerClient();
    return () => {
      pythonRunnerRef.current?.dispose();
      pythonRunnerRef.current = null;
    };
  }, []);

  const outlineLabels = useMemo<OutlineLabels>(() => {
    if (language === 'pl') {
      return {
        startLabel: 'Start',
        endLabel: 'Koniec',
        checkcardPrefix: 'Karta',
        chapterPrefix: 'Rozdział',
        subchapterPrefix: 'Podrozdział',
        orphanPrefix: 'Niespięte'
      };
    }
    if (language === 'de') {
      return {
        startLabel: 'Start',
        endLabel: 'Ende',
        checkcardPrefix: 'Karte',
        chapterPrefix: 'Kapitel',
        subchapterPrefix: 'Unterkapitel',
        orphanPrefix: 'Unverbunden'
      };
    }
    return {
      startLabel: 'Start',
      endLabel: 'End',
      checkcardPrefix: 'Card',
      chapterPrefix: 'Chapter',
      subchapterPrefix: 'Subchapter',
      orphanPrefix: 'Unlinked'
    };
  }, [language]);

  const runtimeHistoryCopy = useMemo(() => {
    if (language === 'pl') {
      return {
        title: 'Konspekt',
        back: 'Wstecz',
        forward: 'Dalej',
        show: 'Pokaż konspekt',
        hide: 'Ukryj konspekt',
        noOutline: 'Brak konspektu storyboardu.'
      };
    }
    if (language === 'de') {
      return {
        title: 'Gliederung',
        back: 'Zurück',
        forward: 'Vor',
        show: 'Gliederung anzeigen',
        hide: 'Gliederung ausblenden',
        noOutline: 'Keine Storyboard-Gliederung verfügbar.'
      };
    }
    return {
      title: 'Outline',
      back: 'Back',
      forward: 'Forward',
      show: 'Show outline',
      hide: 'Hide outline',
      noOutline: 'No storyboard outline available.'
    };
  }, [language]);

  const resolvedCardsCopy = useMemo(() => {
    if (language === 'pl') {
      return {
        title: 'Rozwiązane pytania',
        show: 'Pokaż pytanie',
        hide: 'Ukryj pytanie'
      };
    }
    if (language === 'de') {
      return {
        title: 'Beantwortete Fragen',
        show: 'Frage anzeigen',
        hide: 'Frage ausblenden'
      };
    }
    return {
      title: 'Answered Questions',
      show: 'Show question',
      hide: 'Hide question'
    };
  }, [language]);

  const currentRuntimeNodeKey = useMemo(() => {
    if (!runtime) return null;
    return buildNodeKey(runtime.graphPath, runtime.currentNodeId);
  }, [runtime]);

  const runtimeNodeHistoryKeys = useMemo(() => {
    if (runtimeHistoryVersion < 0) return [] as string[];
    return runtimeHistoryRef.current.map((entry) => buildNodeKey(entry.graphPath, entry.currentNodeId));
  }, [runtimeHistoryVersion]);

  const runtimeNodeHistoryKeySet = useMemo(() => {
    return new Set(runtimeNodeHistoryKeys);
  }, [runtimeNodeHistoryKeys]);

  const jumpToOutlineNode = useCallback(
    (nodeKey: string | undefined) => {
      if (!nodeKey) return;
      const history = runtimeHistoryRef.current;
      const currentIndex = runtimeHistoryIndexRef.current;
      if (history.length === 0 || currentIndex < 0) return;

      let targetIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < history.length; index += 1) {
        const key = buildNodeKey(history[index].graphPath, history[index].currentNodeId);
        if (key !== nodeKey) continue;
        const distance = Math.abs(index - currentIndex);
        if (distance < bestDistance) {
          bestDistance = distance;
          targetIndex = index;
        }
      }

      if (targetIndex < 0 || targetIndex === currentIndex) return;
      runtimeHistoryIndexRef.current = targetIndex;
      setRuntime(history[targetIndex]);
      refreshRuntimeNavigation();
    },
    [refreshRuntimeNavigation]
  );

  const runtimeOutline = useMemo(() => {
    if (!documentState) return [] as StoryboardOutlineItem[];
    return buildStoryboardOutline(documentState.rootGraph, [], outlineLabels);
  }, [documentState, outlineLabels]);

  const toggleOutlineNode = useCallback((itemKey: string) => {
    setExpandedOutlineNodes((previous) => ({ ...previous, [itemKey]: !(previous[itemKey] ?? true) }));
  }, []);

  const renderOutlineItem = useCallback(
    (item: StoryboardOutlineItem): JSX.Element => {
      const isActive = Boolean(item.nodeKey && item.nodeKey === currentRuntimeNodeKey);
      const isVisited = Boolean(item.nodeKey && runtime?.visited[item.nodeKey]);
      const isInHistory = Boolean(item.nodeKey && runtimeNodeHistoryKeySet.has(item.nodeKey));
      const canJump = Boolean(item.nodeKey && isInHistory);
      const hasChildren = item.children.length > 0;
      const expanded = expandedOutlineNodes[item.key] ?? true;

      return (
        <li key={item.key} style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {hasChildren ? (
              <button
                type="button"
                className="ghost"
                onClick={() => toggleOutlineNode(item.key)}
                style={{ minWidth: '2rem', paddingInline: '0.45rem' }}
                aria-label={expanded ? 'Collapse outline node' : 'Expand outline node'}
              >
                {expanded ? '−' : '+'}
              </button>
            ) : null}
            <button
              type="button"
              className="ghost"
              onClick={() => jumpToOutlineNode(item.nodeKey)}
              disabled={!canJump}
              style={{
                justifyContent: 'flex-start',
                opacity: canJump ? 1 : 0.65,
                borderColor: isActive ? 'rgba(111, 214, 255, 0.55)' : undefined,
                background: isActive
                  ? 'linear-gradient(120deg, rgba(111, 214, 255, 0.18), rgba(111, 214, 255, 0.06))'
                  : isVisited
                    ? 'rgba(111, 214, 255, 0.05)'
                    : 'transparent',
                flex: 1
              }}
            >
              {item.label}
            </button>
          </div>
          {hasChildren && expanded ? (
            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.35rem' }}>
              {item.children.map((child) => renderOutlineItem(child))}
            </ul>
          ) : null}
        </li>
      );
    },
    [currentRuntimeNodeKey, expandedOutlineNodes, jumpToOutlineNode, runtime?.visited, runtimeNodeHistoryKeySet, toggleOutlineNode]
  );

  const currentNode = useMemo(() => {
    if (!runtime) return null;
    return findNode(runtime.graph, runtime.currentNodeId);
  }, [runtime]);

  const resolveCardRuntime = useCallback(async (node: StoryboardNodeRecord, graphPath: string[]): Promise<LoadedCardRuntime> => {
    let prompt = node.description.trim() || node.title;
    let expected = node.title;
    let promptModel: CheckcardPromptModel = { kind: 'text', inputType: 'text' };
    let expectedModel: CheckcardExpectedModel = expected;
    let answerModel: CheckcardAnswerModel = { text: '' };
    let notionType: string | null = null;
    let cardType: string | null = null;
    let checkType: string | null = node.cardCheckType.trim() || null;
    let pythonDefinition: PythonRuntimeDefinition | null = null;
    const isSharedRuntime = Boolean(shareCode);
    const isSessionRuntime = Boolean(activeRuntimeSessionCode);
    const isPublicRuntime = isSharedRuntime || isSessionRuntime;
    const notionId = node.notionId.trim();
    const publicNotionPayload =
      notionId && documentState?.publicNotionPayloads
        ? documentState.publicNotionPayloads[notionId]
        : undefined;

    if ((isPublicRuntime || runtimeLibraryId) && notionId) {
      try {
        const cardsBundle = isSessionRuntime
          ? await getCogitaPublicStoryboardSessionNotionCheckcards({ sessionCode: activeRuntimeSessionCode!, notionId })
          : isSharedRuntime
            ? await getCogitaPublicStoryboardNotionCheckcards({ shareCode: shareCode!, notionId })
            : await getCogitaNotionCheckcards({ libraryId: runtimeLibraryId!, notionId });
        const initialQuestionPayload =
          cardsBundle.items.find((card: CogitaCardSearchResult) => (card.checkType ?? '').trim().toLowerCase().startsWith('question-'))?.payload ??
          null;
        const preferredQuestionCheckType =
          node.cardCheckType.trim().toLowerCase() === 'question'
            ? toQuestionCheckTypeFromPayload(
                initialQuestionPayload ??
                  null
              )
            : null;
        const selectedCard = pickNodeCard(node, cardsBundle.items, preferredQuestionCheckType);
        const selectedCheckType = (selectedCard?.checkType ?? node.cardCheckType ?? '').trim().toLowerCase();
        const selectedInfoType = (selectedCard?.notionType ?? '').trim().toLowerCase();
        const isPythonCard = selectedCheckType === 'python' || selectedInfoType === 'python';
        const detail = await (isSessionRuntime
          ? getCogitaPublicStoryboardSessionNotionDetail({ sessionCode: activeRuntimeSessionCode!, notionId })
          : isSharedRuntime
            ? getCogitaPublicStoryboardNotionDetail({ shareCode: shareCode!, notionId })
            : getCogitaNotionDetail({ libraryId: runtimeLibraryId!, notionId })
        ).catch(() => null);
        let vocabProjection: Record<string, unknown> | null = null;
        if (detail?.notionType === 'translation') {
          try {
            const projection = isSessionRuntime
              ? await getCogitaPublicStoryboardSessionNotionApproachProjection({
                  sessionCode: activeRuntimeSessionCode!,
                  notionId,
                  approachKey: 'vocab-card'
                })
              : isSharedRuntime
                ? await getCogitaPublicStoryboardNotionApproachProjection({
                    shareCode: shareCode!,
                    notionId,
                    approachKey: 'vocab-card'
                  })
                : await getCogitaNotionApproachProjection({
                    libraryId: runtimeLibraryId!,
                    notionId,
                    approachKey: 'vocab-card'
                  });
            vocabProjection = (projection.projection ?? null) as Record<string, unknown> | null;
          } catch {
            vocabProjection = null;
          }
        }
        const built = buildCardPromptAndExpected({
          node,
          card: selectedCard,
          infoType: detail?.notionType ?? selectedCard?.notionType ?? null,
          infoPayload: detail?.payload ? (detail.payload as Record<string, unknown>) : null,
          vocabProjection
        });
        notionType = detail?.notionType ?? selectedCard?.notionType ?? null;
        cardType = selectedCard?.cardType ?? null;
        checkType = selectedCard?.checkType ?? checkType;
        prompt = built.prompt;
        expected = built.expected;

        const parsedPythonDefinition = isPythonCard
          ? parsePythonRuntimeDefinition(
              detail?.payload ??
                selectedCard?.payload ??
                publicNotionPayload ??
                null,
              `${notionId}|${buildNodeKey(graphPath, node.nodeId)}`
            )
          : null;
        if (parsedPythonDefinition) {
          notionType = 'python';
          checkType = 'python';
          promptModel = { kind: 'text', inputType: 'text', multiLine: true };
          expectedModel = '';
          answerModel = { text: parsedPythonDefinition.starterSource };
          prompt = parsedPythonDefinition.taskText || prompt || (node.description.trim() || node.title);
          pythonDefinition = parsedPythonDefinition;
        } else if (isPythonCard) {
          const fallbackPythonDefinition = parsePythonDefinitionPayload(
            detail?.payload ??
              selectedCard?.payload ??
              publicNotionPayload ??
              null
          );
          notionType = 'python';
          checkType = 'python';
          promptModel = { kind: 'text', inputType: 'text', multiLine: true };
          expectedModel = '';
          answerModel = { text: fallbackPythonDefinition?.starterSource ?? '' };
          prompt = fallbackPythonDefinition?.taskText || prompt || (node.description.trim() || node.title);
          pythonDefinition = null;
        } else {
        const questionRuntime =
          (detail?.notionType === 'question' || selectedCard?.notionType === 'question')
            ? buildStoryboardQuestionRuntime(
                detail?.payload ??
                  selectedCard?.payload ??
                  cardsBundle.items.find((card: CogitaCardSearchResult) => (card.checkType ?? '').trim().toLowerCase().startsWith('question-'))?.payload ??
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
        }
      } catch {
        const wantsPython = node.cardCheckType.trim().toLowerCase() === 'python';
        const sharedQuestionRuntime = buildStoryboardQuestionRuntime(publicNotionPayload ?? null, prompt);
        const sharedPythonDefinition = parsePythonRuntimeDefinition(
          publicNotionPayload ?? null,
          `${notionId}|${buildNodeKey(graphPath, node.nodeId)}`
        );
        if (sharedPythonDefinition) {
          notionType = 'python';
          checkType = 'python';
          promptModel = { kind: 'text', inputType: 'text', multiLine: true };
          expectedModel = '';
          answerModel = { text: sharedPythonDefinition.starterSource };
          prompt = sharedPythonDefinition.taskText || prompt;
          pythonDefinition = sharedPythonDefinition;
        } else if (wantsPython) {
          const fallbackPythonDefinition = parsePythonDefinitionPayload(publicNotionPayload ?? null);
          notionType = 'python';
          checkType = 'python';
          promptModel = { kind: 'text', inputType: 'text', multiLine: true };
          expectedModel = '';
          answerModel = { text: fallbackPythonDefinition?.starterSource ?? '' };
          prompt = fallbackPythonDefinition?.taskText || prompt;
          pythonDefinition = null;
        } else if (sharedQuestionRuntime) {
          notionType = 'question';
          checkType = toQuestionCheckTypeFromPayload(publicNotionPayload ?? null) ?? checkType;
          prompt = sharedQuestionRuntime.promptText || prompt;
          promptModel = sharedQuestionRuntime.promptModel;
          expectedModel = sharedQuestionRuntime.expectedModel;
          answerModel = sharedQuestionRuntime.initialAnswers;
        } else {
          promptModel = { kind: 'text', inputType: 'text' };
          expectedModel = expected;
          answerModel = { text: '' };
        }
      }
    } else {
      const wantsPython = node.cardCheckType.trim().toLowerCase() === 'python';
      const sharedQuestionRuntime = buildStoryboardQuestionRuntime(publicNotionPayload ?? null, prompt);
      const sharedPythonDefinition = parsePythonRuntimeDefinition(
        publicNotionPayload ?? null,
        `${notionId}|${buildNodeKey(graphPath, node.nodeId)}`
      );
      if (sharedPythonDefinition) {
        notionType = 'python';
        checkType = 'python';
        promptModel = { kind: 'text', inputType: 'text', multiLine: true };
        expectedModel = '';
        answerModel = { text: sharedPythonDefinition.starterSource };
        prompt = sharedPythonDefinition.taskText || prompt;
        pythonDefinition = sharedPythonDefinition;
      } else if (wantsPython) {
        const fallbackPythonDefinition = parsePythonDefinitionPayload(publicNotionPayload ?? null);
        notionType = 'python';
        checkType = 'python';
        promptModel = { kind: 'text', inputType: 'text', multiLine: true };
        expectedModel = '';
        answerModel = { text: fallbackPythonDefinition?.starterSource ?? '' };
        prompt = fallbackPythonDefinition?.taskText || prompt;
        pythonDefinition = null;
      } else if (sharedQuestionRuntime) {
        notionType = 'question';
        checkType = toQuestionCheckTypeFromPayload(publicNotionPayload ?? null) ?? checkType;
        prompt = sharedQuestionRuntime.promptText || prompt;
        promptModel = sharedQuestionRuntime.promptModel;
        expectedModel = sharedQuestionRuntime.expectedModel;
        answerModel = sharedQuestionRuntime.initialAnswers;
      }
    }

    const nodeKey = buildNodeKey(graphPath, node.nodeId);
    answerModel = normalizeCheckcardAnswer(promptModel, answerModel);
    return {
      nodeKey,
      promptText: prompt,
      promptModel,
      expectedModel,
      answerModel,
      notionType,
      cardType,
      checkType,
      pythonDefinition
    };
  }, [activeRuntimeSessionCode, documentState, runtimeLibraryId, shareCode]);

  const getOrLoadCardRuntime = useCallback((node: StoryboardNodeRecord, graphPath: string[]) => {
    const nodeKey = buildNodeKey(graphPath, node.nodeId);
    const cached = cardRuntimeCacheRef.current[nodeKey];
    if (cached) {
      return Promise.resolve(cached);
    }
    const inFlight = cardRuntimeInFlightRef.current[nodeKey];
    if (inFlight) {
      return inFlight;
    }
    const request = resolveCardRuntime(node, graphPath)
      .then((loaded) => {
        cardRuntimeCacheRef.current[nodeKey] = loaded;
        return loaded;
      })
      .catch(() => null)
      .finally(() => {
        delete cardRuntimeInFlightRef.current[nodeKey];
      });
    cardRuntimeInFlightRef.current[nodeKey] = request;
    return request;
  }, [resolveCardRuntime]);

  useEffect(() => {
    if (!runtime || loading) return;
    const signature = `${runtime.currentNodeId}|${runtime.finished ? '1' : '0'}|${runtime.displayedBlocks.map((block) => block.key).join(',')}`;
    if (previousRuntimeSignatureRef.current === signature) return;
    previousRuntimeSignatureRef.current = signature;
    window.requestAnimationFrame(() => {
      runtimeScrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [loading, runtime]);

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
    const cached = cardRuntimeCacheRef.current[nodeKey];
    if (cached) {
      setCardState({
        ...cached,
        status: 'ready',
        isCorrect: null,
        pythonEvaluation: null,
        pythonProgress: null
      });
      return;
    }

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
      isCorrect: null,
      pythonDefinition: null,
      pythonEvaluation: null,
      pythonProgress: null
    });

    let cancelled = false;
    const loadCard = async () => {
      const loaded = await getOrLoadCardRuntime(currentNode, runtime.graphPath);
      if (cancelled) return;
      if (!loaded) {
        setCardState({
          nodeKey,
          status: 'ready',
          promptText: currentNode.description.trim() || currentNode.title,
          promptModel: { kind: 'text', inputType: 'text' },
          expectedModel: currentNode.title,
          answerModel: { text: '' },
          notionType: null,
          cardType: null,
          checkType: currentNode.cardCheckType.trim() || null,
          isCorrect: null,
          pythonDefinition: null,
          pythonEvaluation: null,
          pythonProgress: null
        });
        return;
      }
      setCardState({
        ...loaded,
        status: 'ready',
        isCorrect: null,
        pythonEvaluation: null,
        pythonProgress: null
      });
    };

    void loadCard();
    return () => {
      cancelled = true;
    };
  }, [currentNode, getOrLoadCardRuntime, runtime, shareCode]);

  useEffect(() => {
    if (!runtime || loading || !currentNode) return;
    const startNodeIds = getRuntimeForwardStartNodeIds(runtime, currentNode);
    if (startNodeIds.length === 0) return;
    const upcomingCards = collectUpcomingCardNodeLocations({
      graph: runtime.graph,
      graphPath: runtime.graphPath,
      startNodeIds,
      visited: runtime.visited,
      maxDepth: 3,
      maxCards: 10
    });
    upcomingCards.forEach((entry) => {
      void getOrLoadCardRuntime(entry.node, entry.graphPath);
    });
  }, [currentNode, getOrLoadCardRuntime, loading, runtime]);

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

      if (!runtime.finished) {
        const currentRuntimeNode = findNode(runtime.graph, runtime.currentNodeId);
        if (currentRuntimeNode) {
          const forwardStartNodeIds = getRuntimeForwardStartNodeIds(runtime, currentRuntimeNode);
          if (forwardStartNodeIds.length > 0) {
            const upcomingMediaRefs = collectUpcomingStaticMediaRefs({
              graph: runtime.graph,
              graphPath: runtime.graphPath,
              startNodeIds: forwardStartNodeIds,
              visited: runtime.visited,
              maxDepth: 3,
              maxNodes: 36,
              maxMedia: 28
            });
            upcomingMediaRefs.forEach((entry) => {
              required.set(`${entry.mediaType}:${entry.fileId}`, entry);
            });
          }
        }
      }
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
      const loader = activeRuntimeSessionCode
        ? downloadCogitaPublicStoryboardSessionFile({ sessionCode: activeRuntimeSessionCode, dataItemId: fileId })
        : shareCode
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
  }, [activeRuntimeSessionCode, runtime, shareCode]);

  const pathChoices = useMemo(() => {
    if (!runtime || !currentNode || currentNode.kind === 'card') return [];
    const edges =
      currentNode.kind === 'separator'
        ? getSeparatorRemainingEdges(
            runtime.graph,
            runtime.graphPath,
            currentNode.nodeId,
            runtime.visited,
            runtime.activeSeparatorByGraphPath[buildGraphPathKey(runtime.graphPath)] === currentNode.nodeId
          )
        : getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-path', runtime.visited);
    return edges.map((edge) => {
      return {
        edge,
        label: edge.label.trim() || runtimeCopy.choiceFallback
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

  const cardPathEdge = useMemo(() => {
    if (!runtime || !currentNode || currentNode.kind !== 'card') return null;
    return getOutgoingEdges(runtime.graph, runtime.graphPath, currentNode.nodeId, 'out-path', runtime.visited)[0] ?? null;
  }, [currentNode, runtime]);

  const chooseEdge = (edge: StoryboardGraphEdge) => {
    applyRuntimeTransition((current) => {
      const currentNodeRecord = findNode(current.graph, current.currentNodeId);
      if (currentNodeRecord?.kind !== 'separator') {
        return advanceRuntime(current, edge.toNodeId, edge.displayMode);
      }
      const prepared = cloneState(current);
      const graphPathKey = buildGraphPathKey(prepared.graphPath);
      prepared.activeSeparatorByGraphPath[graphPathKey] = currentNodeRecord.nodeId;
      prepared.activeChapterStartByGraphPath[graphPathKey] = edge.toNodeId;
      return advanceRuntime(prepared, edge.toNodeId, edge.displayMode);
    });
  };

  const restartChapter = () => {
    applyRuntimeTransition((current) => {
      const graphPathKey = buildGraphPathKey(current.graphPath);
      const chapterStartNodeId = current.activeChapterStartByGraphPath[graphPathKey];
      if (!chapterStartNodeId) return current;
      return advanceRuntime(cloneState(current), chapterStartNodeId, 'new_screen');
    });
  };

  const goToChapterEnd = () => {
    applyRuntimeTransition((current) => {
      const graphPathKey = buildGraphPathKey(current.graphPath);
      const separatorNodeId = current.activeSeparatorByGraphPath[graphPathKey];
      if (!separatorNodeId) return current;
      const joinNodeId = findJoinNodeIdForSeparator(current.graph, separatorNodeId);
      if (!joinNodeId) return current;
      return advanceRuntime(cloneState(current), joinNodeId, 'new_screen');
    });
  };

  const hasActiveChapterCycle = useMemo(() => {
    if (!runtime) return false;
    const graphPathKey = buildGraphPathKey(runtime.graphPath);
    return Boolean(runtime.activeSeparatorByGraphPath[graphPathKey]);
  }, [runtime]);

  const chapterFinishLabel = useMemo(() => {
    return runtimeCopy.chapterFinishAction.replace('{chapter}', runtimeCopy.choiceFallback);
  }, [runtimeCopy.chapterFinishAction, runtimeCopy.choiceFallback]);

  const canRestartChapter = useMemo(() => {
    if (!runtime) return false;
    const graphPathKey = buildGraphPathKey(runtime.graphPath);
    return Boolean(runtime.activeChapterStartByGraphPath[graphPathKey]);
  }, [runtime]);

  const canGoToChapterEnd = useMemo(() => {
    if (!runtime || !currentNode) return false;
    if (currentNode.kind === 'separator' || currentNode.kind === 'join' || currentNode.kind === 'end') return false;
    const graphPathKey = buildGraphPathKey(runtime.graphPath);
    const separatorNodeId = runtime.activeSeparatorByGraphPath[graphPathKey];
    if (!separatorNodeId) return false;
    return Boolean(findJoinNodeIdForSeparator(runtime.graph, separatorNodeId));
  }, [currentNode, runtime]);

  const resolveCardOutcomeEdge = useCallback(
    (state: RuntimeState, node: StoryboardNodeRecord, isCorrect: boolean): StoryboardGraphEdge | null => {
      const preferredSourcePorts: StoryboardSourcePort[] = isCorrect
        ? ['out-right', 'out-path', 'out-wrong']
        : ['out-wrong', 'out-path', 'out-right'];
      const dependencyAwareFallback = (
        preferredSourcePorts.flatMap((sourcePort) =>
          getOutgoingEdges(state.graph, state.graphPath, node.nodeId, sourcePort, state.visited)
        )
      )[0];
      const anyFallback = (
        preferredSourcePorts.flatMap((sourcePort) =>
          state.graph.edges.filter(
            (edge) => edge.fromNodeId === node.nodeId && edge.sourcePort === sourcePort
          )
        )
      )[0];
      return dependencyAwareFallback ?? anyFallback ?? null;
    },
    []
  );

  const evaluatedOutcomeEdge = useMemo(() => {
    if (!runtime || !currentNode || currentNode.kind !== 'card' || !cardState || cardState.status !== 'evaluated') {
      return null;
    }
    if (typeof cardState.isCorrect !== 'boolean') return null;
    return resolveCardOutcomeEdge(runtime, currentNode, cardState.isCorrect);
  }, [cardState, currentNode, resolveCardOutcomeEdge, runtime]);

  const archiveCurrentCard = useCallback(() => {
    if (!cardState || cardState.status !== 'evaluated') return;
    if (!currentNode || currentNode.kind !== 'card') return;
    if (typeof cardState.isCorrect !== 'boolean') return;

    const entry: ResolvedCardEntry = {
      nodeKey: cardState.nodeKey,
      title: currentNode.title.trim() || cardState.promptText || runtimeCopy.choiceFallback,
      promptText: cardState.promptText,
      promptModel: cardState.promptModel,
      expectedModel: cardState.expectedModel,
      answerModel: normalizeCheckcardAnswer(cardState.promptModel, cardState.answerModel),
      isCorrect: cardState.isCorrect,
      checkType: cardState.checkType,
      pythonEvaluation: cardState.pythonEvaluation ?? null
    };

    setResolvedCards((previous) => {
      const index = previous.findIndex((item) => item.nodeKey === entry.nodeKey);
      if (index < 0) return [...previous, entry];
      const next = [...previous];
      next[index] = entry;
      return next;
    });
  }, [cardState, currentNode, runtimeCopy.choiceFallback]);

  const toggleResolvedCard = useCallback((nodeKey: string) => {
    setExpandedResolvedCards((previous) => ({ ...previous, [nodeKey]: !previous[nodeKey] }));
  }, []);

  const chooseCardOutcome = (edge: StoryboardGraphEdge | null) => {
    if (!edge) return;
    applyRuntimeTransition((current) => {
      return advanceRuntime(current, edge.toNodeId, edge.displayMode);
    });
  };

  const restart = () => {
    if (!documentState) return;
    if (cardTransitionTimer.current != null) {
      window.clearTimeout(cardTransitionTimer.current);
      cardTransitionTimer.current = null;
    }
    setInitialRuntimeState(createInitialRuntime(documentState.rootGraph));
    setCardState(null);
    setStatus(null);
  };

  const submitCardAnswer = async () => {
    if (!cardState || cardState.status !== 'ready' || !runtime || !currentNode || currentNode.kind !== 'card') return;
    const normalizedAnswerModel = normalizeCheckcardAnswer(cardState.promptModel, cardState.answerModel);
    const normalizedCheckType = (cardState.checkType ?? currentNode?.cardCheckType ?? '').trim().toLowerCase();

    if (normalizedCheckType === 'python') {
      const pythonDefinition = cardState.pythonDefinition;
      if (!pythonDefinition) {
        const pythonEvaluation = toPythonRuntimeEvaluation({
          status: 'runner_unavailable',
          casesExecuted: 0,
          errorMessage: 'Python definition is unavailable for this card.',
          failingInputJson: null,
          userOutputJson: null
        });
        setCardState((current) => {
          if (!current || current.nodeKey !== cardState.nodeKey) return current;
          return {
            ...current,
            status: 'ready',
            answerModel: normalizedAnswerModel,
            isCorrect: null,
            pythonEvaluation,
            pythonProgress: null
          };
        });
        setStatus(null);
        return;
      }

      setCardState((current) => {
        if (!current || current.nodeKey !== cardState.nodeKey) return current;
        return {
          ...current,
          status: 'submitting',
          answerModel: normalizedAnswerModel,
          pythonEvaluation: null,
          pythonProgress: { phase: 'loading_pyodide', casesExecuted: 0, caseCount: pythonDefinition.caseCount }
        };
      });

      let pythonEvaluation: PythonRuntimeEvaluation;
      try {
        if (!pythonRunnerRef.current) {
          pythonRunnerRef.current = new BrowserPythonRunnerClient();
        }
        const rawEvaluation = await pythonRunnerRef.current.evaluate(
          {
            createInputSource: pythonDefinition.createInputSource,
            referenceSource: pythonDefinition.referenceSource,
            starterSource: pythonDefinition.starterSource,
            learnerSource: normalizedAnswerModel.text ?? '',
            caseCount: pythonDefinition.caseCount,
            seed: pythonDefinition.seed
          },
          {
            timeoutMs: 15000,
            onProgress: (progress) => {
              setCardState((current) => {
                if (!current || current.nodeKey !== cardState.nodeKey || current.status !== 'submitting') {
                  return current;
                }
                return {
                  ...current,
                  pythonProgress: progress
                };
              });
            }
          }
        );
        pythonEvaluation = toPythonRuntimeEvaluation(rawEvaluation);
      } catch (error) {
        pythonEvaluation = toPythonRuntimeEvaluation({
          status: 'sandbox_error',
          casesExecuted: 0,
          errorMessage: error instanceof Error ? error.message : 'Python evaluation failed.',
          failingInputJson: null,
          userOutputJson: null
        });
      }

      const isCorrect = Boolean(pythonEvaluation.passed);
      if (isCorrect) {
        setCardState((current) => {
          if (!current) return current;
          if (current.nodeKey !== cardState.nodeKey) return current;
          return {
            ...current,
            status: 'evaluated',
            answerModel: normalizedAnswerModel,
            isCorrect: true,
            pythonEvaluation,
            pythonProgress: null
          };
        });
        void submitSessionOutcome(
          cardState.nodeKey,
          currentNode.notionId,
          normalizedCheckType || null,
          true
        );

        const outcomeEdge =
          cardRightEdge ??
          cardPathEdge ??
          resolveCardOutcomeEdge(runtime, currentNode, true);
        setStatus(outcomeEdge ? null : runtimeCopy.noCardOutcomeLink);
        return;
      }

      setCardState((current) => {
        if (!current) return current;
        if (current.nodeKey !== cardState.nodeKey) return current;
        return {
          ...current,
          status: 'ready',
          answerModel: normalizedAnswerModel,
          isCorrect: null,
          pythonEvaluation,
          pythonProgress: null
        };
      });
      void submitSessionOutcome(
        cardState.nodeKey,
        currentNode.notionId,
        normalizedCheckType || null,
        false
      );
      setStatus(null);
      return;
    }

    const evaluation = evaluateCheckcardDetailed({
      prompt: cardState.promptModel,
      expected: cardState.expectedModel,
      answer: normalizedAnswerModel,
      context: {
        notionType: cardState.notionType,
        cardType: cardState.cardType,
        checkType: normalizedCheckType || null
      }
    });
    const isCorrect = evaluation.isCorrect;

    setCardState((current) => {
      if (!current) return current;
      if (current.nodeKey !== cardState.nodeKey) return current;
      return {
        ...current,
        status: 'evaluated',
        answerModel: normalizedAnswerModel,
        isCorrect,
        pythonEvaluation: null,
        pythonProgress: null
      };
    });
    void submitSessionOutcome(
      cardState.nodeKey,
      currentNode.notionId,
      normalizedCheckType || null,
      isCorrect
    );

    const outcomeEdge =
      (isCorrect ? cardRightEdge : cardWrongEdge) ??
      cardPathEdge ??
      resolveCardOutcomeEdge(runtime, currentNode, isCorrect);
    setStatus(outcomeEdge ? null : runtimeCopy.noCardOutcomeLink);
  };

  const resignPythonAnswer = () => {
    if (!cardState || cardState.status !== 'ready' || !runtime || !currentNode || currentNode.kind !== 'card') return;
    const normalizedCheckType = (cardState.checkType ?? currentNode.cardCheckType ?? '').trim().toLowerCase();
    if (normalizedCheckType !== 'python') return;

    const normalizedAnswerModel = normalizeCheckcardAnswer(cardState.promptModel, cardState.answerModel);
    setCardState((current) => {
      if (!current || current.nodeKey !== cardState.nodeKey) return current;
      return {
        ...current,
        status: 'evaluated',
        answerModel: normalizedAnswerModel,
        isCorrect: false,
        pythonProgress: null
      };
    });
    void submitSessionOutcome(
      cardState.nodeKey,
      currentNode.notionId,
      normalizedCheckType || null,
      false
    );

    const outcomeEdge =
      cardWrongEdge ??
      cardPathEdge ??
      resolveCardOutcomeEdge(runtime, currentNode, false);
    setStatus(outcomeEdge ? null : runtimeCopy.noCardOutcomeLink);
  };

  const showOutlinePanel = !isNarrowScreen || outlineOpenOnNarrow;
  const runtimeContentOffset = showOutlinePanel && !isNarrowScreen ? '19rem' : undefined;

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
      <section
        className="cogita-section cogita-storyboard-runtime"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          width: '100%',
          paddingInline: 'clamp(0.85rem, 2.6vw, 1.6rem)',
          paddingBottom: '1.25rem'
        }}
      >
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

        {!loading && runtime && isNarrowScreen ? (
          <div className="cogita-card-actions" style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="ghost"
              onClick={() => setOutlineOpenOnNarrow((value) => !value)}
            >
              {outlineOpenOnNarrow ? runtimeHistoryCopy.hide : runtimeHistoryCopy.show}
            </button>
          </div>
        ) : null}

        {!loading && runtime && showOutlinePanel ? (
          <article
            className="cogita-library-detail"
            style={{
              marginBottom: '1rem',
              width: isNarrowScreen ? '100%' : '18rem',
              float: isNarrowScreen ? 'none' : 'left',
              marginRight: isNarrowScreen ? 0 : '1rem',
              position: isNarrowScreen ? 'static' : 'sticky',
              top: isNarrowScreen ? undefined : '0.75rem'
            }}
          >
            <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.65rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <strong>{runtimeHistoryCopy.title}</strong>
                <div className="cogita-card-actions">
                  <button type="button" className="ghost" onClick={navigateRuntimeBack} disabled={!canNavigateBack}>
                    {runtimeHistoryCopy.back}
                  </button>
                  <button type="button" className="ghost" onClick={navigateRuntimeForward} disabled={!canNavigateForward}>
                    {runtimeHistoryCopy.forward}
                  </button>
                </div>
              </div>
              {runtimeOutline.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.35rem' }}>
                  {runtimeOutline.map((item) => renderOutlineItem(item))}
                </ul>
              ) : (
                <p className="cogita-help" style={{ margin: 0 }}>
                  {runtimeHistoryCopy.noOutline}
                </p>
              )}
            </div>
          </article>
        ) : null}

        {!loading && resolvedCards.length > 0 ? (
          <article
            className="cogita-library-detail"
            style={{ marginBottom: '1rem', marginLeft: runtimeContentOffset }}
          >
            <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.65rem' }}>
              <strong>{resolvedCardsCopy.title}</strong>
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {resolvedCards.map((entry) => {
                  const expanded = Boolean(expandedResolvedCards[entry.nodeKey]);
                  const isPythonCheckcard = (entry.checkType ?? '').trim().toLowerCase() === 'python';
                  const livePrompt = buildLivePrompt({
                    promptText: entry.promptText,
                    promptModel: entry.promptModel
                  });
                  const revealExpected = isPythonCheckcard ? undefined : entry.expectedModel;
                  const revealedAnswer = isPythonCheckcard
                    ? undefined
                    : toRevealedAnswer(entry.promptModel, entry.answerModel);

                  return (
                    <div key={entry.nodeKey} style={{ display: 'grid', gap: '0.45rem' }}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => toggleResolvedCard(entry.nodeKey)}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>{`${entry.isCorrect ? runtimeCopy.rightAction : runtimeCopy.wrongAction}: ${entry.title}`}</span>
                        <span>{expanded ? resolvedCardsCopy.hide : resolvedCardsCopy.show}</span>
                      </button>
                      {expanded ? (
                        <div style={{ display: 'grid', gap: '0.55rem' }}>
                          <CogitaLivePromptCard
                            prompt={livePrompt}
                            revealExpected={revealExpected}
                            revealedAnswer={revealedAnswer}
                            surfaceState={entry.isCorrect ? 'correct' : 'incorrect'}
                            mode="readonly"
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
                              text: entry.answerModel.text ?? '',
                              selection: entry.answerModel.selection ?? [],
                              booleanAnswer: typeof entry.answerModel.booleanAnswer === 'boolean' ? entry.answerModel.booleanAnswer : null,
                              ordering:
                                (entry.answerModel.ordering?.length ?? 0) > 0
                                  ? (entry.answerModel.ordering ?? [])
                                  : (entry.promptModel.kind === 'ordering' ? (entry.promptModel.options ?? []) : []),
                              matchingRows: entry.answerModel.matchingPaths ?? [],
                              matchingSelection: entry.answerModel.matchingSelection ?? []
                            }}
                          />
                          {isPythonCheckcard ? (
                            <div className="cogita-share-list" style={{ gap: '0.5rem' }}>
                              {entry.pythonEvaluation?.failingInputJson ? (
                                <div className="cogita-share-row" data-state="idle" style={{ display: 'grid', gap: '0.35rem' }}>
                                  <span>Failing input</span>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatDiagnosticJson(entry.pythonEvaluation.failingInputJson)}</pre>
                                </div>
                              ) : null}
                              {entry.pythonEvaluation?.userOutputJson ? (
                                <div className="cogita-share-row" data-state="idle" style={{ display: 'grid', gap: '0.35rem' }}>
                                  <span>User output</span>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatDiagnosticJson(entry.pythonEvaluation.userOutputJson)}</pre>
                                </div>
                              ) : null}
                              {entry.pythonEvaluation?.errorMessage ? (
                                <div className="cogita-share-row" data-state="incorrect" style={{ display: 'grid', gap: '0.35rem' }}>
                                  <span>Error</span>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{entry.pythonEvaluation.errorMessage}</pre>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </article>
        ) : null}

        {!loading && runtime ? (
          <div className="cogita-pane" style={{ display: 'grid', gap: '1rem', marginLeft: runtimeContentOffset }}>
            {runtime.displayedBlocks
              .filter((block) => block.kind !== 'card')
              .map((block) => (
              <article key={block.key} className="cogita-library-detail" style={{ margin: 0 }}>
                <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.55rem' }}>
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
                  {cardState?.status === 'loading' || cardState?.status === 'submitting' ? (
                    <p className="cogita-help" style={{ margin: 0 }}>
                      {cardState.status === 'submitting'
                        ? (() => {
                            const isPythonCheckcard = (cardState.checkType ?? '').trim().toLowerCase() === 'python';
                            if (!isPythonCheckcard) {
                              return `${runtimeCopy.cardSubmitAction}...`;
                            }
                            const progress = cardState.pythonProgress;
                            if (!progress) {
                              return `${runtimeCopy.cardSubmitAction}...`;
                            }
                            if (progress.phase === 'loading_pyodide') {
                              return 'Loading Python runtime...';
                            }
                            return `Running Python checks ${Math.max(0, progress.casesExecuted)}/${Math.max(1, progress.caseCount)}...`;
                          })()
                        : runtimeCopy.cardLoading}
                    </p>
                  ) : null}
                  {cardState && cardState.status !== 'loading' ? (
                    <>
                      {(() => {
                        const livePrompt = buildLivePrompt({
                          promptText: cardState.promptText,
                          promptModel: cardState.promptModel
                        });
                        const isPythonCheckcard = (cardState.checkType ?? '').trim().toLowerCase() === 'python';
                        const revealExpected = cardState.status === 'evaluated' && !isPythonCheckcard
                          ? cardState.expectedModel
                          : undefined;
                        const revealedAnswer = cardState.status === 'evaluated' && !isPythonCheckcard
                          ? toRevealedAnswer(cardState.promptModel, cardState.answerModel)
                          : undefined;
                        return (
                      <CogitaLivePromptCard
                        prompt={livePrompt}
                        revealExpected={revealExpected}
                        revealedAnswer={revealedAnswer}
                        surfaceState={cardState.status === 'evaluated' ? (cardState.isCorrect ? 'correct' : 'incorrect') : 'idle'}
                        mode={cardState.status === 'evaluated' || cardState.status === 'submitting' ? 'readonly' : 'interactive'}
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
                          ordering:
                            (cardState.answerModel.ordering?.length ?? 0) > 0
                              ? (cardState.answerModel.ordering ?? [])
                              : (cardState.promptModel.kind === 'ordering' ? (cardState.promptModel.options ?? []) : []),
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
                            const orderingBase =
                              (current.answerModel.ordering?.length ?? 0) > 0
                                ? (current.answerModel.ordering ?? [])
                                : (current.promptModel.kind === 'ordering' ? (current.promptModel.options ?? []) : []);
                            const ordering = [...orderingBase];
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
                        {(cardState.checkType ?? '').trim().toLowerCase() === 'python' ? (
                          <button
                            type="button"
                            className="ghost"
                            onClick={resignPythonAnswer}
                            disabled={cardState.status !== 'ready'}
                          >
                            {pythonRuntimeCopy.resignAction}
                          </button>
                        ) : null}
                      </div>
                      {(cardState.checkType ?? '').trim().toLowerCase() === 'python' &&
                      cardState.status === 'ready' &&
                      cardState.pythonEvaluation &&
                      !cardState.pythonEvaluation.passed ? (
                        <>
                          <p className="cogita-form-error" style={{ margin: 0 }}>
                            {pythonRuntimeCopy.retryHint}
                          </p>
                          <div className="cogita-share-list" style={{ gap: '0.5rem' }}>
                            {cardState.pythonEvaluation.failingInputJson ? (
                              <div className="cogita-share-row" data-state="idle" style={{ display: 'grid', gap: '0.35rem' }}>
                                <span>Failing input</span>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatDiagnosticJson(cardState.pythonEvaluation.failingInputJson)}</pre>
                              </div>
                            ) : null}
                            {cardState.pythonEvaluation.userOutputJson ? (
                              <div className="cogita-share-row" data-state="idle" style={{ display: 'grid', gap: '0.35rem' }}>
                                <span>User output</span>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatDiagnosticJson(cardState.pythonEvaluation.userOutputJson)}</pre>
                              </div>
                            ) : null}
                            {cardState.pythonEvaluation.errorMessage ? (
                              <div className="cogita-share-row" data-state="incorrect" style={{ display: 'grid', gap: '0.35rem' }}>
                                <span>Error</span>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{cardState.pythonEvaluation.errorMessage}</pre>
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                      {cardState.status === 'evaluated' ? (
                        <>
                          <p className={cardState.isCorrect ? 'cogita-help' : 'cogita-form-error'} style={{ margin: 0 }}>
                            {cardState.isCorrect ? runtimeCopy.rightAction : runtimeCopy.wrongAction}
                          </p>
                          {!cardState.isCorrect && (cardState.checkType ?? '').trim().toLowerCase() === 'python' ? (
                            <div className="cogita-share-list" style={{ gap: '0.5rem' }}>
                              {cardState.pythonEvaluation?.failingInputJson ? (
                                <div className="cogita-share-row" data-state="idle" style={{ display: 'grid', gap: '0.35rem' }}>
                                  <span>Failing input</span>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatDiagnosticJson(cardState.pythonEvaluation.failingInputJson)}</pre>
                                </div>
                              ) : null}
                              {cardState.pythonEvaluation?.userOutputJson ? (
                                <div className="cogita-share-row" data-state="idle" style={{ display: 'grid', gap: '0.35rem' }}>
                                  <span>User output</span>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatDiagnosticJson(cardState.pythonEvaluation.userOutputJson)}</pre>
                                </div>
                              ) : null}
                              {cardState.pythonEvaluation?.errorMessage ? (
                                <div className="cogita-share-row" data-state="incorrect" style={{ display: 'grid', gap: '0.35rem' }}>
                                  <span>Error</span>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{cardState.pythonEvaluation.errorMessage}</pre>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {evaluatedOutcomeEdge ? (
                            <div className="cogita-card-actions">
                              <button
                                type="button"
                                className="cta"
                                onClick={() => {
                                  setStatus(null);
                                  archiveCurrentCard();
                                  chooseCardOutcome(evaluatedOutcomeEdge);
                                }}
                              >
                                {runtimeCopy.cardContinueAction}
                              </button>
                            </div>
                          ) : (
                            <p className="cogita-form-error" style={{ margin: 0 }}>
                              {runtimeCopy.noCardOutcomeLink}
                            </p>
                          )}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </article>
            ) : null}

            {currentNode?.kind === 'separator' && !runtime.finished && pathChoices.length > 0 ? (
              <article className="cogita-library-detail" style={{ margin: 0 }}>
                <div className="cogita-detail-body" style={{ display: 'grid', gap: '0.7rem' }}>
                  <p className="cogita-help" style={{ margin: 0, fontWeight: 600 }}>{runtimeCopy.chapterChooseLabel}</p>
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {pathChoices.map((choice) => (
                      <button
                        key={choice.edge.edgeId}
                        type="button"
                        className="cta"
                        style={{ width: '100%', justifyContent: 'flex-start' }}
                        onClick={() => chooseEdge(choice.edge)}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ) : null}

            {currentNode && currentNode.kind !== 'card' && currentNode.kind !== 'separator' && !runtime.finished && pathChoices.length > 0 ? (
              <div className="cogita-card-actions" style={{ flexWrap: 'wrap' }}>
                {pathChoices.map((choice) => (
                  <button key={choice.edge.edgeId} type="button" className="cta ghost" onClick={() => chooseEdge(choice.edge)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}

            {hasActiveChapterCycle && !runtime.finished ? (
              <div className="cogita-card-actions" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="cta ghost" onClick={restartChapter} disabled={!canRestartChapter}>
                  {runtimeCopy.chapterRestartFromStartAction}
                </button>
                {canGoToChapterEnd ? (
                  <button type="button" className="cta ghost" onClick={goToChapterEnd}>
                    {chapterFinishLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div ref={runtimeScrollAnchorRef} />
          </div>
        ) : null}
        {!isNarrowScreen && showOutlinePanel ? <div style={{ clear: 'both' }} /> : null}
      </section>
    </CogitaShell>
  );
}
