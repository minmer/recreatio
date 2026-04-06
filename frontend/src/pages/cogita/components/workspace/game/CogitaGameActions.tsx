import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { CogitaGameActionGraph } from '../../../../../lib/api';

type ActionNodeRecord = {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
};

type ActionEdgeRecord = {
  edgeId: string;
  fromNodeId: string;
  fromPort: string | null;
  toNodeId: string;
  toPort: string | null;
};

type ActionHandleConfig = {
  id: string;
  label: string;
  multi?: boolean;
};

type ActionNodeMeta = {
  label: string;
  group: string;
  defaultConfig: Record<string, unknown>;
  inputHandles: ActionHandleConfig[];
  outputHandles: ActionHandleConfig[];
};

type ActionFlowNodeData = {
  nodeType: string;
  title: string;
  group: string;
  summary: string;
  config: Record<string, unknown>;
  inputHandles: ActionHandleConfig[];
  outputHandles: ActionHandleConfig[];
};

const ACTION_NODE_LIBRARY: Record<string, ActionNodeMeta> = {
  'logic.and': {
    label: 'And',
    group: 'Logic',
    defaultConfig: {},
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'bool' }]
  },
  'logic.or': {
    label: 'Or',
    group: 'Logic',
    defaultConfig: {},
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'bool' }]
  },
  'logic.if': {
    label: 'If',
    group: 'Logic',
    defaultConfig: {},
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'bool' }]
  },
  'math.add': {
    label: 'Add',
    group: 'Math',
    defaultConfig: {},
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'sum' }]
  },
  'math.multiply': {
    label: 'Multiply',
    group: 'Math',
    defaultConfig: {},
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'product' }]
  },
  'math.subtract': {
    label: 'Subtract',
    group: 'Math',
    defaultConfig: {},
    inputHandles: [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' }
    ],
    outputHandles: [{ id: 'out', label: 'value' }]
  },
  'math.divide': {
    label: 'Divide',
    group: 'Math',
    defaultConfig: {},
    inputHandles: [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' }
    ],
    outputHandles: [{ id: 'out', label: 'value' }]
  },
  'math.moreThan': {
    label: 'More Than',
    group: 'Math',
    defaultConfig: {},
    inputHandles: [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' }
    ],
    outputHandles: [{ id: 'out', label: 'bool' }]
  },
  'gps.geopoint': {
    label: 'Geopoint',
    group: 'GPS',
    defaultConfig: {},
    inputHandles: [
      { id: 'lat', label: 'lat' },
      { id: 'lon', label: 'lon' }
    ],
    outputHandles: [{ id: 'out', label: 'geo' }]
  },
  'gps.position': {
    label: 'GPS Position',
    group: 'GPS',
    defaultConfig: {},
    inputHandles: [],
    outputHandles: [{ id: 'out', label: 'geo' }]
  },
  'gps.distance': {
    label: 'Distance',
    group: 'GPS',
    defaultConfig: {},
    inputHandles: [
      { id: 'a', label: 'geo-a' },
      { id: 'b', label: 'geo-b' }
    ],
    outputHandles: [{ id: 'out', label: 'meters' }]
  },
  'game.value': {
    label: 'Value',
    group: 'Game',
    defaultConfig: {
      scope: 'participant',
      valueKey: 'points',
      delta: 1
    },
    inputHandles: [{ id: 'set', label: 'set' }],
    outputHandles: [{ id: 'out', label: 'value' }]
  },
  'trigger.onEnterZone': {
    label: 'On Enter Zone',
    group: 'Game',
    defaultConfig: {
      zoneKey: 'zone-1',
      latitude: 52.2297,
      longitude: 21.0122,
      radiusM: 120,
      cooldownSec: 15,
      scope: 'participant',
      valueKey: 'points',
      delta: 10
    },
    inputHandles: [],
    outputHandles: [{ id: 'out', label: 'event' }]
  },
  'trigger.onNGroupPresence': {
    label: 'On N Group Presence',
    group: 'Game',
    defaultConfig: {
      zoneKey: 'zone-1',
      n: 2,
      windowSec: 60,
      mode: 'cooperative',
      cooldownSec: 60,
      scope: 'group',
      valueKey: 'points',
      delta: 5
    },
    inputHandles: [],
    outputHandles: [{ id: 'out', label: 'event' }]
  },
  'trigger.everySec': {
    label: 'Every... Sec',
    group: 'Game',
    defaultConfig: {
      everySec: 30,
      executionMode: 'serial',
      maxBurst: 8,
      scope: 'session',
      valueKey: 'points',
      delta: 1
    },
    inputHandles: [],
    outputHandles: [{ id: 'out', label: 'event' }]
  },
  'condition.valueCompare': {
    label: 'Value Compare',
    group: 'Game',
    defaultConfig: {
      compareValueKey: 'points',
      compareScope: 'participant',
      compareOperator: 'gte',
      compareThreshold: 0
    },
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'bool' }]
  },
  'effect.setValue': {
    label: 'Set Value',
    group: 'Game',
    defaultConfig: {
      scope: 'participant',
      valueKey: 'points',
      delta: 10
    },
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: []
  }
};

const PALETTE_GROUP_ORDER = ['Logic', 'Math', 'GPS', 'Game'] as const;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseJsonArray(raw: string): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return Array.isArray(parsed) ? parsed : null;
}

function getNodeMeta(nodeType: string): ActionNodeMeta {
  return ACTION_NODE_LIBRARY[nodeType] ?? {
    label: nodeType,
    group: 'Game',
    defaultConfig: {},
    inputHandles: [{ id: 'in', label: 'in', multi: true }],
    outputHandles: [{ id: 'out', label: 'out' }]
  };
}

function parseNodesFromArray(parsed: unknown[]): ActionNodeRecord[] {
  return parsed.map((item, index) => {
    const root = toObject(item);
    const nodeType = toStringValue(root.nodeType, 'trigger.onEnterZone');
    const defaults = getNodeMeta(nodeType).defaultConfig;
    return {
      nodeId: toStringValue(root.nodeId, createId(`node-${index + 1}`)),
      nodeType,
      config: { ...defaults, ...toObject(root.config) },
      positionX: toNumber(root.positionX, 80 + index * 40),
      positionY: toNumber(root.positionY, 80 + index * 30)
    };
  });
}

function parseEdgesFromArray(parsed: unknown[], nodes: ActionNodeRecord[]): ActionEdgeRecord[] {
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  return parsed
    .map((item, index) => {
      const root = toObject(item);
      const fromNodeId = toStringValue(root.fromNodeId, '');
      const toNodeId = toStringValue(root.toNodeId, '');
      if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) return null;
      return {
        edgeId: toStringValue(root.edgeId, createId(`edge-${index + 1}`)),
        fromNodeId,
        fromPort: typeof root.fromPort === 'string' ? root.fromPort : null,
        toNodeId,
        toPort: typeof root.toPort === 'string' ? root.toPort : null
      } satisfies ActionEdgeRecord;
    })
    .filter((item): item is ActionEdgeRecord => Boolean(item));
}

function summarizeNode(nodeType: string, config: Record<string, unknown>): string {
  if (nodeType === 'trigger.onEnterZone') {
    const zoneKey = toStringValue(config.zoneKey, 'zone-1');
    const valueKey = toStringValue(config.valueKey, 'points');
    const delta = toNumber(config.delta, 0);
    return `${zoneKey} -> ${valueKey} ${delta >= 0 ? '+' : ''}${delta}`;
  }
  if (nodeType === 'trigger.onNGroupPresence') {
    return `${toStringValue(config.zoneKey, 'zone-1')} / n=${toNumber(config.n, 2)} / ${toStringValue(config.mode, 'cooperative')}`;
  }
  if (nodeType === 'trigger.everySec') {
    const rawMode = toStringValue(config.executionMode, 'serial');
    const mode = rawMode === 'parallel' ? 'simultaneous' : rawMode;
    return `${toNumber(config.everySec, 30)}s / ${mode}`;
  }
  if (nodeType === 'game.value') {
    return `${toStringValue(config.scope, 'participant')}.${toStringValue(config.valueKey, 'points')}`;
  }
  return getNodeMeta(nodeType).label;
}

function toFlowNode(record: ActionNodeRecord): Node<ActionFlowNodeData> {
  const meta = getNodeMeta(record.nodeType);
  return {
    id: record.nodeId,
    type: 'gameAction',
    position: { x: record.positionX, y: record.positionY },
    data: {
      nodeType: record.nodeType,
      title: meta.label,
      group: meta.group,
      summary: summarizeNode(record.nodeType, record.config),
      config: record.config,
      inputHandles: meta.inputHandles,
      outputHandles: meta.outputHandles
    }
  };
}

function toFlowEdge(record: ActionEdgeRecord): Edge {
  return {
    id: record.edgeId,
    source: record.fromNodeId,
    target: record.toNodeId,
    sourceHandle: record.fromPort ?? undefined,
    targetHandle: record.toPort ?? undefined
  };
}

function fromFlowNodes(nodes: Node<ActionFlowNodeData>[]): ActionNodeRecord[] {
  return nodes.map((node) => ({
    nodeId: node.id,
    nodeType: toStringValue(node.data?.nodeType, 'trigger.onEnterZone'),
    config: toObject(node.data?.config),
    positionX: toNumber(node.position?.x, 0),
    positionY: toNumber(node.position?.y, 0)
  }));
}

function fromFlowEdges(edges: Edge[]): ActionEdgeRecord[] {
  return edges.map((edge) => ({
    edgeId: edge.id || createId('edge'),
    fromNodeId: edge.source,
    fromPort: edge.sourceHandle ?? null,
    toNodeId: edge.target,
    toPort: edge.targetHandle ?? null
  }));
}

function compileExecutableNodes(nodes: ActionNodeRecord[], edges: ActionEdgeRecord[]): ActionNodeRecord[] {
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const next = outgoing.get(edge.fromNodeId) ?? [];
    next.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, next);
  }

  const collectReachable = (startNodeId: string, maxDepth: number): ActionNodeRecord[] => {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];
    const result: ActionNodeRecord[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (current.depth >= maxDepth) continue;
      const nextIds = outgoing.get(current.id) ?? [];
      for (const nextId of nextIds) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        const node = nodeById.get(nextId);
        if (node) result.push(node);
        queue.push({ id: nextId, depth: current.depth + 1 });
      }
    }
    return result;
  };

  return nodes.map((node) => {
    if (!node.nodeType.startsWith('trigger.')) return node;

    const reachable = collectReachable(node.nodeId, 4);
    const conditionNode = reachable.find((item) => item.nodeType === 'condition.valueCompare');
    const effectNode = reachable.find((item) => item.nodeType === 'effect.setValue') ??
      reachable.find((item) => item.nodeType === 'game.value');

    let nextConfig: Record<string, unknown> = { ...node.config };
    if (conditionNode) {
      nextConfig = {
        ...nextConfig,
        compareValueKey: conditionNode.config.compareValueKey,
        compareScope: conditionNode.config.compareScope,
        compareOperator: conditionNode.config.compareOperator,
        compareThreshold: conditionNode.config.compareThreshold
      };
    }
    if (effectNode) {
      nextConfig = {
        ...nextConfig,
        scope: effectNode.config.scope,
        valueKey: effectNode.config.valueKey,
        delta: effectNode.config.delta
      };
    }
    return { ...node, config: nextConfig };
  });
}

function ActionGraphNode({ data }: NodeProps<ActionFlowNodeData>) {
  const laneCount = Math.max(data.inputHandles.length, data.outputHandles.length, 1);
  const laneHeight = 24;
  const topBase = 44;

  return (
    <div className="cogita-graph-node" style={{ minHeight: 86 + laneCount * 14 }}>
      <div className="cogita-graph-node-labels">
        <strong>{data.title}</strong>
        <span>{data.group}</span>
      </div>
      <div className="cogita-graph-node-meta">{data.nodeType}</div>
      <div className="cogita-graph-node-value">{data.summary}</div>

      {data.inputHandles.map((handle, index) => (
        <Handle
          key={`in-${handle.id}`}
          type="target"
          id={handle.id}
          position={Position.Left}
          style={{ top: topBase + index * laneHeight }}
        >
          <span className="cogita-graph-handle-label">{handle.label}</span>
        </Handle>
      ))}

      {data.outputHandles.map((handle, index) => (
        <Handle
          key={`out-${handle.id}`}
          type="source"
          id={handle.id}
          position={Position.Right}
          style={{ top: topBase + index * laneHeight }}
        />
      ))}
    </div>
  );
}

export function CogitaGameActions({
  actionNodesText,
  actionEdgesText,
  actionGraph,
  onActionNodesTextChange,
  onActionEdgesTextChange,
  onSaveDraft,
  onPublish
}: {
  actionNodesText: string;
  actionEdgesText: string;
  actionGraph: CogitaGameActionGraph | null;
  onActionNodesTextChange: (value: string) => void;
  onActionEdgesTextChange: (value: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  const nodeTypes = useMemo(() => ({ gameAction: ActionGraphNode }), []);
  const [nodes, setNodes] = useState<Node<ActionFlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const lastEmitted = useRef<{ nodes: string; edges: string }>({ nodes: '', edges: '' });

  useEffect(() => {
    const isEcho = actionNodesText === lastEmitted.current.nodes && actionEdgesText === lastEmitted.current.edges;
    if (isEcho) return;

    const nodeArray = parseJsonArray(actionNodesText);
    const edgeArray = parseJsonArray(actionEdgesText);
    if (!nodeArray || !edgeArray) {
      setParseError('Invalid action graph JSON. Fix raw JSON or rebuild nodes from palette.');
      return;
    }

    const parsedNodes = parseNodesFromArray(nodeArray);
    const parsedEdges = parseEdgesFromArray(edgeArray, parsedNodes);
    setNodes(parsedNodes.map(toFlowNode));
    setEdges(parsedEdges.map(toFlowEdge));
    setParseError(null);
  }, [actionNodesText, actionEdgesText]);

  const emitGraph = useCallback((nextNodes: Node<ActionFlowNodeData>[], nextEdges: Edge[]) => {
    const rawNodes = fromFlowNodes(nextNodes);
    const rawEdges = fromFlowEdges(nextEdges);
    const executableNodes = compileExecutableNodes(rawNodes, rawEdges);
    const nodesText = JSON.stringify(executableNodes, null, 2);
    const edgesText = JSON.stringify(rawEdges, null, 2);
    lastEmitted.current = { nodes: nodesText, edges: edgesText };
    onActionNodesTextChange(nodesText);
    onActionEdgesTextChange(edgesText);
    setParseError(null);
  }, [onActionNodesTextChange, onActionEdgesTextChange]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId]
  );
  const selectedConfig = selectedNode ? toObject(selectedNode.data.config) : null;
  const selectedExecutionMode = useMemo(() => {
    if (!selectedConfig) return 'serial';
    const rawMode = toStringValue(selectedConfig.executionMode, 'serial');
    return rawMode === 'parallel' ? 'simultaneous' : rawMode;
  }, [selectedConfig]);

  const orphanActionNodes = useMemo(() => {
    if (nodes.length === 0) return [] as Node<ActionFlowNodeData>[];

    const triggerIds = new Set(
      nodes
        .filter((node) => node.data.nodeType.startsWith('trigger.'))
        .map((node) => node.id)
    );
    if (triggerIds.size === 0) {
      return nodes.filter((node) => !node.data.nodeType.startsWith('trigger.'));
    }

    const reachable = new Set<string>(triggerIds);
    const outgoing = new Map<string, string[]>();
    for (const edge of edges) {
      const next = outgoing.get(edge.source) ?? [];
      next.push(edge.target);
      outgoing.set(edge.source, next);
    }

    const queue = [...triggerIds];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const nextIds = outgoing.get(current) ?? [];
      for (const nextId of nextIds) {
        if (reachable.has(nextId)) continue;
        reachable.add(nextId);
        queue.push(nextId);
      }
    }

    return nodes.filter((node) => !node.data.nodeType.startsWith('trigger.') && !reachable.has(node.id));
  }, [nodes, edges]);

  const paletteGroups = useMemo(() => {
    const grouped = new Map<string, Array<{ nodeType: string; label: string }>>();
    for (const [nodeType, meta] of Object.entries(ACTION_NODE_LIBRARY)) {
      const list = grouped.get(meta.group) ?? [];
      list.push({ nodeType, label: meta.label });
      grouped.set(meta.group, list);
    }
    return grouped;
  }, []);

  const addNode = useCallback((nodeType: string) => {
    const meta = getNodeMeta(nodeType);
    const nodeId = createId('node');
    const config = { ...meta.defaultConfig };
    const nextNode: Node<ActionFlowNodeData> = {
      id: nodeId,
      type: 'gameAction',
      position: { x: 90 + nodes.length * 34, y: 76 + nodes.length * 24 },
      data: {
        nodeType,
        title: meta.label,
        group: meta.group,
        summary: summarizeNode(nodeType, config),
        config,
        inputHandles: meta.inputHandles,
        outputHandles: meta.outputHandles
      }
    };
    const nextNodes = [...nodes, nextNode];
    setNodes(nextNodes);
    setSelectedNodeId(nodeId);
    emitGraph(nextNodes, edges);
  }, [nodes, edges, emitGraph]);

  const addGpsTriggerTemplate = useCallback(() => {
    const triggerNodeId = createId('node');
    const valueNodeId = createId('node');
    const triggerMeta = getNodeMeta('trigger.onEnterZone');
    const valueMeta = getNodeMeta('game.value');
    const triggerConfig = { ...triggerMeta.defaultConfig };
    const valueConfig = { ...valueMeta.defaultConfig };

    const triggerNode: Node<ActionFlowNodeData> = {
      id: triggerNodeId,
      type: 'gameAction',
      position: { x: 130, y: 130 },
      data: {
        nodeType: 'trigger.onEnterZone',
        title: triggerMeta.label,
        group: triggerMeta.group,
        summary: summarizeNode('trigger.onEnterZone', triggerConfig),
        config: triggerConfig,
        inputHandles: triggerMeta.inputHandles,
        outputHandles: triggerMeta.outputHandles
      }
    };

    const valueNode: Node<ActionFlowNodeData> = {
      id: valueNodeId,
      type: 'gameAction',
      position: { x: 430, y: 130 },
      data: {
        nodeType: 'game.value',
        title: valueMeta.label,
        group: valueMeta.group,
        summary: summarizeNode('game.value', valueConfig),
        config: valueConfig,
        inputHandles: valueMeta.inputHandles,
        outputHandles: valueMeta.outputHandles
      }
    };

    const edge: Edge = {
      id: createId('edge'),
      source: triggerNodeId,
      sourceHandle: 'out',
      target: valueNodeId,
      targetHandle: 'set'
    };

    const nextNodes = [...nodes, triggerNode, valueNode];
    const nextEdges = [...edges, edge];
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(triggerNodeId);
    emitGraph(nextNodes, nextEdges);
  }, [nodes, edges, emitGraph]);

  const updateSelectedNode = useCallback((updater: (node: Node<ActionFlowNodeData>) => Node<ActionFlowNodeData>) => {
    if (!selectedNodeId) return;
    const nextNodes = nodes.map((node) => (node.id === selectedNodeId ? updater(node) : node));
    setNodes(nextNodes);
    emitGraph(nextNodes, edges);
  }, [selectedNodeId, nodes, edges, emitGraph]);

  const updateSelectedNodeType = useCallback((nextType: string) => {
    updateSelectedNode((node) => {
      const meta = getNodeMeta(nextType);
      const nextConfig = { ...meta.defaultConfig, ...toObject(node.data.config) };
      return {
        ...node,
        data: {
          ...node.data,
          nodeType: nextType,
          title: meta.label,
          group: meta.group,
          summary: summarizeNode(nextType, nextConfig),
          config: nextConfig,
          inputHandles: meta.inputHandles,
          outputHandles: meta.outputHandles
        }
      };
    });
  }, [updateSelectedNode]);

  const updateSelectedNodeConfig = useCallback((key: string, value: unknown) => {
    updateSelectedNode((node) => {
      const config = { ...toObject(node.data.config), [key]: value };
      return {
        ...node,
        data: {
          ...node.data,
          config,
          summary: summarizeNode(node.data.nodeType, config)
        }
      };
    });
  }, [updateSelectedNode]);

  const deleteSelection = useCallback(() => {
    const selectedNodeIds = new Set(selectedNodeId ? [selectedNodeId] : []);
    const selectedEdges = new Set(selectedEdgeIds);
    const nextNodes = nodes.filter((node) => !selectedNodeIds.has(node.id));
    const nextEdges = edges.filter((edge) =>
      !selectedEdges.has(edge.id) &&
      !selectedNodeIds.has(edge.source) &&
      !selectedNodeIds.has(edge.target)
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(null);
    setSelectedEdgeIds([]);
    emitGraph(nextNodes, nextEdges);
  }, [selectedNodeId, selectedEdgeIds, nodes, edges, emitGraph]);

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const sourceMeta = sourceNode ? getNodeMeta(sourceNode.data.nodeType) : null;
    const targetMeta = targetNode ? getNodeMeta(targetNode.data.nodeType) : null;

    const sourceHandle = connection.sourceHandle ??
      sourceMeta?.outputHandles[0]?.id ??
      'out';
    const targetHandle = connection.targetHandle ??
      targetMeta?.inputHandles[0]?.id ??
      'in';

    const targetHandleConfig = targetMeta?.inputHandles.find((item) => item.id === targetHandle);
    let nextEdges = edges;
    if (targetHandleConfig && !targetHandleConfig.multi) {
      nextEdges = nextEdges.filter((edge) => !(edge.target === connection.target && edge.targetHandle === targetHandle));
    }

    nextEdges = addEdge(
      {
        ...connection,
        id: createId('edge'),
        sourceHandle,
        targetHandle
      },
      nextEdges
    );

    setEdges(nextEdges);
    emitGraph(nodes, nextEdges);
  };

  const onNodesChange = (changes: Parameters<typeof applyNodeChanges>[0]) => {
    const filtered = changes.filter((change) => change.type !== 'select' && change.type !== 'dimensions');
    if (filtered.length === 0) return;
    const nextNodes = applyNodeChanges(filtered, nodes);
    setNodes(nextNodes);
    emitGraph(nextNodes, edges);
  };

  const onEdgesChange = (changes: Parameters<typeof applyEdgeChanges>[0]) => {
    const filtered = changes.filter((change) => change.type !== 'select');
    if (filtered.length === 0) return;
    const nextEdges = applyEdgeChanges(filtered, edges);
    setEdges(nextEdges);
    emitGraph(nodes, nextEdges);
  };

  const onSelectionChange = (selection: { nodes: Node[]; edges: Edge[] } | null) => {
    setSelectedNodeId(selection?.nodes[0]?.id ?? null);
    setSelectedEdgeIds((selection?.edges ?? []).map((edge) => edge.id));
  };

  const applyRawJsonToEditor = () => {
    const nodeArray = parseJsonArray(actionNodesText);
    const edgeArray = parseJsonArray(actionEdgesText);
    if (!nodeArray || !edgeArray) {
      setParseError('Invalid action graph JSON. Graph could not be loaded.');
      return;
    }
    const parsedNodes = parseNodesFromArray(nodeArray);
    const parsedEdges = parseEdgesFromArray(edgeArray, parsedNodes);
    setNodes(parsedNodes.map(toFlowNode));
    setEdges(parsedEdges.map(toFlowEdge));
    setParseError(null);
  };

  return (
    <div style={{ display: 'grid', gap: '0.8rem', maxWidth: 1280 }}>
      <div className="cogita-collection-graph">
        <aside className="cogita-graph-palette">
          <p className="cogita-user-kicker" style={{ margin: 0 }}>Action Nodes</p>
          <button type="button" className="ghost" onClick={addGpsTriggerTemplate}>
            Add GPS Trigger Template
          </button>
          {PALETTE_GROUP_ORDER.map((group) => {
            const list = paletteGroups.get(group) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={group} style={{ display: 'grid', gap: '0.4rem' }}>
                <p className="cogita-help" style={{ margin: 0 }}>
                  <strong>{group}</strong>
                </p>
                <div className="cogita-graph-palette-grid">
                  {list.map((entry) => (
                    <button
                      key={entry.nodeType}
                      type="button"
                      className="ghost"
                      onClick={() => addNode(entry.nodeType)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="ghost"
            onClick={deleteSelection}
            disabled={!selectedNodeId && selectedEdgeIds.length === 0}
          >
            Delete Selected
          </button>
          <p className="cogita-help" style={{ margin: 0 }}>
            Minimum executable flow: <strong>On Enter Zone</strong>{' -> '}<strong>Value</strong>.
          </p>
          <p className="cogita-help" style={{ margin: 0 }}>
            Nodes: {nodes.length} | Edges: {edges.length}
          </p>
          {orphanActionNodes.length > 0 ? (
            <p className="cogita-help" style={{ margin: 0 }}>
              Untriggered nodes: {orphanActionNodes.map((node) => node.data.title).join(', ')}.
            </p>
          ) : null}
        </aside>

        <div className="cogita-collection-graph-canvas">
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onSelectionChange={onSelectionChange}
            fitView
            nodesDraggable
            nodesConnectable
            elementsSelectable
          >
            <Background gap={18} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="cogita-graph-panel">
          <p className="cogita-user-kicker" style={{ margin: 0 }}>Inspector</p>
          {selectedNode && selectedConfig ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <label className="cogita-field">
                <span>Node Type</span>
                <select
                  value={selectedNode.data.nodeType}
                  onChange={(event) => updateSelectedNodeType(event.target.value)}
                >
                  {Object.entries(ACTION_NODE_LIBRARY).map(([nodeType, meta]) => (
                    <option key={nodeType} value={nodeType}>{meta.group} - {meta.label}</option>
                  ))}
                </select>
              </label>

              <p className="cogita-help" style={{ margin: 0 }}>
                Inputs: {selectedNode.data.inputHandles.map((h) => h.id).join(', ') || 'none'}
              </p>
              <p className="cogita-help" style={{ margin: 0 }}>
                Outputs: {selectedNode.data.outputHandles.map((h) => h.id).join(', ') || 'none'}
              </p>

              {selectedNode.data.nodeType === 'trigger.onEnterZone' ? (
                <>
                  <label className="cogita-field">
                    <span>Zone Key</span>
                    <input
                      value={toStringValue(selectedConfig.zoneKey, '')}
                      onChange={(event) => updateSelectedNodeConfig('zoneKey', event.target.value)}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Latitude</span>
                    <input
                      value={String(toNumber(selectedConfig.latitude, 0))}
                      onChange={(event) => updateSelectedNodeConfig('latitude', toNumber(event.target.value, 0))}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Longitude</span>
                    <input
                      value={String(toNumber(selectedConfig.longitude, 0))}
                      onChange={(event) => updateSelectedNodeConfig('longitude', toNumber(event.target.value, 0))}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Radius (m)</span>
                    <input
                      value={String(toNumber(selectedConfig.radiusM, 120))}
                      onChange={(event) => updateSelectedNodeConfig('radiusM', toNumber(event.target.value, 120))}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Cooldown (sec)</span>
                    <input
                      value={String(toNumber(selectedConfig.cooldownSec, 15))}
                      onChange={(event) => updateSelectedNodeConfig('cooldownSec', toNumber(event.target.value, 15))}
                    />
                  </label>
                </>
              ) : null}

              {selectedNode.data.nodeType === 'trigger.onNGroupPresence' ? (
                <>
                  <label className="cogita-field">
                    <span>Zone Key</span>
                    <input
                      value={toStringValue(selectedConfig.zoneKey, '')}
                      onChange={(event) => updateSelectedNodeConfig('zoneKey', event.target.value)}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Required Groups (n)</span>
                    <input
                      value={String(toNumber(selectedConfig.n, 2))}
                      onChange={(event) => updateSelectedNodeConfig('n', toNumber(event.target.value, 2))}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Window (sec)</span>
                    <input
                      value={String(toNumber(selectedConfig.windowSec, 60))}
                      onChange={(event) => updateSelectedNodeConfig('windowSec', toNumber(event.target.value, 60))}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Mode</span>
                    <select
                      value={toStringValue(selectedConfig.mode, 'cooperative')}
                      onChange={(event) => updateSelectedNodeConfig('mode', event.target.value)}
                    >
                      <option value="cooperative">cooperative</option>
                      <option value="competitive">competitive</option>
                    </select>
                  </label>
                </>
              ) : null}

              {selectedNode.data.nodeType === 'trigger.everySec' ? (
                <>
                  <label className="cogita-field">
                    <span>Every (sec)</span>
                    <input
                      value={String(toNumber(selectedConfig.everySec, 30))}
                      onChange={(event) => updateSelectedNodeConfig('everySec', Math.max(1, toNumber(event.target.value, 30)))}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Execution Mode</span>
                    <select
                      value={selectedExecutionMode}
                      onChange={(event) => updateSelectedNodeConfig('executionMode', event.target.value)}
                    >
                      <option value="serial">serial (start after previous ended)</option>
                      <option value="stack">stack (queue missed runs)</option>
                      <option value="simultaneous">simultaneous (parallel batch)</option>
                    </select>
                  </label>
                  <label className="cogita-field">
                    <span>Max Burst</span>
                    <input
                      value={String(toNumber(selectedConfig.maxBurst, 8))}
                      onChange={(event) => updateSelectedNodeConfig('maxBurst', Math.max(1, toNumber(event.target.value, 8)))}
                    />
                  </label>
                </>
              ) : null}

              {selectedNode.data.nodeType === 'game.value' || selectedNode.data.nodeType === 'effect.setValue' ? (
                <>
                  <label className="cogita-field">
                    <span>Scope</span>
                    <select
                      value={toStringValue(selectedConfig.scope, 'participant')}
                      onChange={(event) => updateSelectedNodeConfig('scope', event.target.value)}
                    >
                      <option value="participant">participant</option>
                      <option value="group">group</option>
                      <option value="session">session</option>
                    </select>
                  </label>
                  <label className="cogita-field">
                    <span>Value Key</span>
                    <input
                      value={toStringValue(selectedConfig.valueKey, 'points')}
                      onChange={(event) => updateSelectedNodeConfig('valueKey', event.target.value)}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Delta</span>
                    <input
                      value={String(toNumber(selectedConfig.delta, 0))}
                      onChange={(event) => updateSelectedNodeConfig('delta', toNumber(event.target.value, 0))}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : (
            <p className="cogita-help" style={{ margin: 0 }}>Select a node to edit details.</p>
          )}

          <div className="cogita-card-actions">
            <button type="button" className="ghost" onClick={onSaveDraft}>Save Draft</button>
            <button
              type="button"
              className="cta"
              onClick={onPublish}
              disabled={orphanActionNodes.length > 0}
            >
              Publish Graph
            </button>
          </div>

          {actionGraph ? (
            <p className="cogita-help" style={{ margin: 0 }}>
              Current graph version: {actionGraph.version} ({actionGraph.status})
            </p>
          ) : null}
        </aside>
      </div>

      <div className="cogita-panel" style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
          <strong>Raw JSON (Advanced)</strong>
          <button type="button" className="ghost" onClick={() => setShowRawJson((value) => !value)}>
            {showRawJson ? 'Hide' : 'Show'}
          </button>
        </div>
        {showRawJson ? (
          <>
            <label className="cogita-field full">
              <span>Nodes JSON</span>
              <textarea
                className="cogita-input"
                style={{ minHeight: 200, fontFamily: 'monospace' }}
                value={actionNodesText}
                onChange={(event) => onActionNodesTextChange(event.target.value)}
              />
            </label>
            <label className="cogita-field full">
              <span>Edges JSON</span>
              <textarea
                className="cogita-input"
                style={{ minHeight: 160, fontFamily: 'monospace' }}
                value={actionEdgesText}
                onChange={(event) => onActionEdgesTextChange(event.target.value)}
              />
            </label>
            <div className="cogita-card-actions">
              <button type="button" className="ghost" onClick={applyRawJsonToEditor}>Apply Raw JSON To Graph</button>
            </div>
          </>
        ) : null}
        {parseError ? <p className="cogita-help">{parseError}</p> : null}
      </div>
    </div>
  );
}
