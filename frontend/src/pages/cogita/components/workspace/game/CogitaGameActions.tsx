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

type ActionNodeMeta = {
  label: string;
  category: string;
  defaultConfig: Record<string, unknown>;
};

type ActionFlowNodeData = {
  nodeType: string;
  title: string;
  subtitle: string;
  summary: string;
  config: Record<string, unknown>;
};

const ACTION_NODE_LIBRARY: Record<string, ActionNodeMeta> = {
  'trigger.onEnterZone': {
    label: 'On Enter Zone',
    category: 'Trigger',
    defaultConfig: {
      zoneKey: 'zone-1',
      latitude: 52.2297,
      longitude: 21.0122,
      radiusM: 120,
      cooldownSec: 15,
      scope: 'participant',
      valueKey: 'points',
      delta: 10
    }
  },
  'trigger.onNGroupPresence': {
    label: 'On N Group Presence',
    category: 'Trigger',
    defaultConfig: {
      zoneKey: 'zone-1',
      n: 2,
      windowSec: 60,
      mode: 'cooperative',
      cooldownSec: 60,
      scope: 'group',
      valueKey: 'points',
      delta: 5
    }
  },
  'condition.valueCompare': {
    label: 'Value Compare',
    category: 'Condition',
    defaultConfig: {
      compareValueKey: 'points',
      compareScope: 'participant',
      compareOperator: 'gte',
      compareThreshold: 0
    }
  },
  'effect.setValue': {
    label: 'Set Value',
    category: 'Effect',
    defaultConfig: {
      scope: 'participant',
      valueKey: 'points',
      delta: 10
    }
  },
  'effect.message': {
    label: 'Send Message',
    category: 'Effect',
    defaultConfig: {
      channel: 'session',
      message: 'Checkpoint unlocked.'
    }
  }
};

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

function parseNodesFromArray(parsed: unknown[]): ActionNodeRecord[] {
  return parsed.map((item, index) => {
    const root = toObject(item);
    const nodeType = toStringValue(root.nodeType, 'trigger.onEnterZone');
    const defaults = ACTION_NODE_LIBRARY[nodeType]?.defaultConfig ?? {};
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
    const deltaText = delta >= 0 ? `+${delta}` : `${delta}`;
    return `${zoneKey} -> ${valueKey} ${deltaText}`;
  }
  if (nodeType === 'trigger.onNGroupPresence') {
    const zoneKey = toStringValue(config.zoneKey, 'zone-1');
    const n = toNumber(config.n, 2);
    const mode = toStringValue(config.mode, 'cooperative');
    return `${zoneKey} / n=${n} / ${mode}`;
  }
  if (nodeType === 'condition.valueCompare') {
    const key = toStringValue(config.compareValueKey, 'points');
    const op = toStringValue(config.compareOperator, 'gte');
    const threshold = toNumber(config.compareThreshold, 0);
    return `${key} ${op} ${threshold}`;
  }
  if (nodeType === 'effect.setValue') {
    const scope = toStringValue(config.scope, 'participant');
    const key = toStringValue(config.valueKey, 'points');
    const delta = toNumber(config.delta, 0);
    const deltaText = delta >= 0 ? `+${delta}` : `${delta}`;
    return `${scope}.${key} ${deltaText}`;
  }
  if (nodeType === 'effect.message') {
    const channel = toStringValue(config.channel, 'session');
    const message = toStringValue(config.message, 'Message');
    return `${channel}: ${message.slice(0, 28)}`;
  }
  return nodeType;
}

function toFlowNode(record: ActionNodeRecord): Node<ActionFlowNodeData> {
  const meta = ACTION_NODE_LIBRARY[record.nodeType] ?? {
    label: record.nodeType,
    category: 'Node'
  };

  return {
    id: record.nodeId,
    type: 'gameAction',
    position: { x: record.positionX, y: record.positionY },
    data: {
      nodeType: record.nodeType,
      title: meta.label,
      subtitle: meta.category,
      summary: summarizeNode(record.nodeType, record.config),
      config: record.config
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
    const list = outgoing.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, list);
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
    if (!node.nodeType.startsWith('trigger.')) {
      return node;
    }
    const reachable = collectReachable(node.nodeId, 3);
    const conditionNode = reachable.find((item) => item.nodeType === 'condition.valueCompare');
    const effectNode = reachable.find((item) => item.nodeType === 'effect.setValue');

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

    return {
      ...node,
      config: nextConfig
    };
  });
}

function ActionGraphNode({ data }: NodeProps<ActionFlowNodeData>) {
  return (
    <div className="cogita-graph-node">
      <div className="cogita-graph-node-labels">
        <strong>{data.title}</strong>
        <span>{data.subtitle}</span>
      </div>
      <div className="cogita-graph-node-meta">{data.nodeType}</div>
      <div className="cogita-graph-node-value">{data.summary}</div>
      <Handle type="target" id="in" position={Position.Left} />
      <Handle type="source" id="out" position={Position.Right} />
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

  const emitGraph = useCallback(
    (nextNodes: Node<ActionFlowNodeData>[], nextEdges: Edge[]) => {
      const rawNodes = fromFlowNodes(nextNodes);
      const rawEdges = fromFlowEdges(nextEdges);
      const executableNodes = compileExecutableNodes(rawNodes, rawEdges);
      const nodesText = JSON.stringify(executableNodes, null, 2);
      const edgesText = JSON.stringify(rawEdges, null, 2);
      lastEmitted.current = { nodes: nodesText, edges: edgesText };
      onActionNodesTextChange(nodesText);
      onActionEdgesTextChange(edgesText);
      setParseError(null);
    },
    [onActionNodesTextChange, onActionEdgesTextChange]
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId]
  );

  const addNode = useCallback((nodeType: string) => {
    const meta = ACTION_NODE_LIBRARY[nodeType] ?? {
      label: nodeType,
      category: 'Node',
      defaultConfig: {}
    };
    const nodeId = createId('node');
    const config = { ...meta.defaultConfig };
    const nextNode: Node<ActionFlowNodeData> = {
      id: nodeId,
      type: 'gameAction',
      position: {
        x: 80 + nodes.length * 36,
        y: 70 + nodes.length * 28
      },
      data: {
        nodeType,
        title: meta.label,
        subtitle: meta.category,
        summary: summarizeNode(nodeType, config),
        config
      }
    };
    const nextNodes = [...nodes, nextNode];
    setNodes(nextNodes);
    setSelectedNodeId(nodeId);
    emitGraph(nextNodes, edges);
  }, [nodes, edges, emitGraph]);

  const addGpsTriggerTemplate = useCallback(() => {
    const triggerNodeId = createId('node');
    const effectNodeId = createId('node');
    const triggerConfig = { ...ACTION_NODE_LIBRARY['trigger.onEnterZone'].defaultConfig };
    const effectConfig = { ...ACTION_NODE_LIBRARY['effect.setValue'].defaultConfig };

    const triggerNode: Node<ActionFlowNodeData> = {
      id: triggerNodeId,
      type: 'gameAction',
      position: { x: 120, y: 120 },
      data: {
        nodeType: 'trigger.onEnterZone',
        title: ACTION_NODE_LIBRARY['trigger.onEnterZone'].label,
        subtitle: ACTION_NODE_LIBRARY['trigger.onEnterZone'].category,
        summary: summarizeNode('trigger.onEnterZone', triggerConfig),
        config: triggerConfig
      }
    };

    const effectNode: Node<ActionFlowNodeData> = {
      id: effectNodeId,
      type: 'gameAction',
      position: { x: 420, y: 120 },
      data: {
        nodeType: 'effect.setValue',
        title: ACTION_NODE_LIBRARY['effect.setValue'].label,
        subtitle: ACTION_NODE_LIBRARY['effect.setValue'].category,
        summary: summarizeNode('effect.setValue', effectConfig),
        config: effectConfig
      }
    };

    const edge: Edge = {
      id: createId('edge'),
      source: triggerNodeId,
      target: effectNodeId,
      sourceHandle: 'out',
      targetHandle: 'in'
    };

    const nextNodes = [...nodes, triggerNode, effectNode];
    const nextEdges = [...edges, edge];
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(triggerNodeId);
    emitGraph(nextNodes, nextEdges);
  }, [nodes, edges, emitGraph]);

  const updateSelectedNode = useCallback(
    (updater: (node: Node<ActionFlowNodeData>) => Node<ActionFlowNodeData>) => {
      if (!selectedNodeId) return;
      const nextNodes = nodes.map((node) => (node.id === selectedNodeId ? updater(node) : node));
      setNodes(nextNodes);
      emitGraph(nextNodes, edges);
    },
    [selectedNodeId, nodes, edges, emitGraph]
  );

  const updateSelectedNodeType = useCallback((nodeType: string) => {
    updateSelectedNode((node) => {
      const meta = ACTION_NODE_LIBRARY[nodeType] ?? {
        label: nodeType,
        category: 'Node',
        defaultConfig: {}
      };
      const mergedConfig = { ...meta.defaultConfig, ...toObject(node.data.config) };
      return {
        ...node,
        data: {
          ...node.data,
          nodeType,
          title: meta.label,
          subtitle: meta.category,
          summary: summarizeNode(nodeType, mergedConfig),
          config: mergedConfig
        }
      };
    });
  }, [updateSelectedNode]);

  const updateSelectedNodeConfig = useCallback(
    (key: string, value: unknown) => {
      updateSelectedNode((node) => {
        const config = {
          ...toObject(node.data.config),
          [key]: value
        };
        return {
          ...node,
          data: {
            ...node.data,
            config,
            summary: summarizeNode(node.data.nodeType, config)
          }
        };
      });
    },
    [updateSelectedNode]
  );

  const deleteSelection = useCallback(() => {
    const nodeIdSet = new Set(selectedNodeId ? [selectedNodeId] : []);
    const edgeIdSet = new Set(selectedEdgeIds);

    const nextNodes = nodes.filter((node) => !nodeIdSet.has(node.id));
    const nextEdges = edges.filter(
      (edge) =>
        !edgeIdSet.has(edge.id) &&
        !nodeIdSet.has(edge.source) &&
        !nodeIdSet.has(edge.target)
    );

    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(null);
    setSelectedEdgeIds([]);
    emitGraph(nextNodes, nextEdges);
  }, [selectedNodeId, selectedEdgeIds, nodes, edges, emitGraph]);

  const onConnect = (connection: Connection) => {
    const nextEdges = addEdge(
      {
        ...connection,
        id: createId('edge'),
        sourceHandle: connection.sourceHandle ?? 'out',
        targetHandle: connection.targetHandle ?? 'in'
      },
      edges
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

  const selectedConfig = selectedNode ? toObject(selectedNode.data.config) : null;

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
          <div className="cogita-graph-palette-grid">
            <button type="button" className="ghost" onClick={addGpsTriggerTemplate}>
              Add GPS Trigger Template
            </button>
            <button type="button" className="ghost" onClick={() => addNode('trigger.onEnterZone')}>
              Add On Enter Zone
            </button>
            <button type="button" className="ghost" onClick={() => addNode('trigger.onNGroupPresence')}>
              Add N Group Presence
            </button>
            <button type="button" className="ghost" onClick={() => addNode('condition.valueCompare')}>
              Add Value Compare
            </button>
            <button type="button" className="ghost" onClick={() => addNode('effect.setValue')}>
              Add Set Value
            </button>
            <button type="button" className="ghost" onClick={() => addNode('effect.message')}>
              Add Message
            </button>
            <button
              type="button"
              className="ghost"
              onClick={deleteSelection}
              disabled={!selectedNodeId && selectedEdgeIds.length === 0}
            >
              Delete Selected
            </button>
          </div>
          <p className="cogita-help" style={{ margin: 0 }}>
            Minimum executable flow: <strong>On Enter Zone</strong>
            {' -> '}
            <strong>Set Value</strong>.
          </p>
          <p className="cogita-help" style={{ margin: 0 }}>
            Trigger config uses <code>zoneKey</code>; it must match a zone configured in live session settings.
          </p>
          <p className="cogita-help" style={{ margin: 0 }}>
            Nodes: {nodes.length} | Edges: {edges.length}
          </p>
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
                  {Object.keys(ACTION_NODE_LIBRARY).map((nodeType) => (
                    <option key={nodeType} value={nodeType}>{nodeType}</option>
                  ))}
                </select>
              </label>

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
                    <span>Required Group Count (n)</span>
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

              {selectedNode.data.nodeType === 'condition.valueCompare' ? (
                <>
                  <label className="cogita-field">
                    <span>Value Key</span>
                    <input
                      value={toStringValue(selectedConfig.compareValueKey, '')}
                      onChange={(event) => updateSelectedNodeConfig('compareValueKey', event.target.value)}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Scope</span>
                    <select
                      value={toStringValue(selectedConfig.compareScope, 'participant')}
                      onChange={(event) => updateSelectedNodeConfig('compareScope', event.target.value)}
                    >
                      <option value="participant">participant</option>
                      <option value="group">group</option>
                      <option value="session">session</option>
                    </select>
                  </label>
                  <label className="cogita-field">
                    <span>Operator</span>
                    <select
                      value={toStringValue(selectedConfig.compareOperator, 'gte')}
                      onChange={(event) => updateSelectedNodeConfig('compareOperator', event.target.value)}
                    >
                      <option value="eq">eq</option>
                      <option value="neq">neq</option>
                      <option value="gt">gt</option>
                      <option value="gte">gte</option>
                      <option value="lt">lt</option>
                      <option value="lte">lte</option>
                    </select>
                  </label>
                  <label className="cogita-field">
                    <span>Threshold</span>
                    <input
                      value={String(toNumber(selectedConfig.compareThreshold, 0))}
                      onChange={(event) => updateSelectedNodeConfig('compareThreshold', toNumber(event.target.value, 0))}
                    />
                  </label>
                </>
              ) : null}

              {selectedNode.data.nodeType === 'effect.setValue' ? (
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

              {selectedNode.data.nodeType === 'effect.message' ? (
                <>
                  <label className="cogita-field">
                    <span>Channel</span>
                    <select
                      value={toStringValue(selectedConfig.channel, 'session')}
                      onChange={(event) => updateSelectedNodeConfig('channel', event.target.value)}
                    >
                      <option value="session">session</option>
                      <option value="group">group</option>
                      <option value="participant">participant</option>
                    </select>
                  </label>
                  <label className="cogita-field">
                    <span>Message</span>
                    <textarea
                      rows={4}
                      value={toStringValue(selectedConfig.message, '')}
                      onChange={(event) => updateSelectedNodeConfig('message', event.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : (
            <p className="cogita-help" style={{ margin: 0 }}>Select a node to edit its configuration.</p>
          )}

          <div className="cogita-card-actions">
            <button type="button" className="ghost" onClick={onSaveDraft}>Save Draft</button>
            <button type="button" className="cta" onClick={onPublish}>Publish Graph</button>
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
          <button type="button" className="ghost" onClick={() => setShowRawJson((current) => !current)}>
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
