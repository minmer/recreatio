import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  getStraightPath,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../content/types';
import {
  createRole,
  createRoleEdge,
  getRoleGraph,
  issueCsrf,
  shareRole,
  updateRoleField,
  ApiError,
  type RoleGraphEdge,
  type RoleGraphNode
} from '../../lib/api';

type RoleNodeData = {
  label: string;
  kind?: string | null;
  nodeType: string;
  value?: string | null;
  roleId?: string | null;
  fieldType?: string | null;
  dataKeyId?: string | null;
  incomingTypes: string[];
  outgoingTypes: string[];
  typeColors: Record<string, string>;
};

type RoleEdgeData = {
  relationType: string;
  color: string;
};

type PendingLink = {
  sourceId: string;
  targetId: string;
  relationType: string;
};

const RELATION_TYPES = ['Owner', 'AdminOf', 'Write', 'Read', 'MemberOf', 'DelegatedTo'] as const;
const RELATION_COLORS: Record<string, string> = {
  Owner: '#1d4ed8',
  AdminOf: '#c2410c',
  Write: '#dc2626',
  Read: '#0284c7',
  MemberOf: '#16a34a',
  DelegatedTo: '#7c3aed',
  Data: '#6b7280',
  RecoveryOwner: '#0f766e',
  RecoveryShare: '#8b5cf6',
  RecoveryAccess: '#a855f7',
  link: '#374151'
};
const DEFAULT_RELATION_COLOR = '#374151';

const buildTypeColors = (edges: RoleGraphEdge[]) => {
  const colors: Record<string, string> = { ...RELATION_COLORS };
  edges.forEach((edge) => {
    if (!colors[edge.type]) {
      colors[edge.type] = DEFAULT_RELATION_COLOR;
    }
  });
  return colors;
};

const defaultLayout = (nodes: RoleGraphNode[], edges: RoleGraphEdge[]) => {
  const roleNodes = nodes.filter((node) => node.nodeType === 'role');
  const roleIdSet = new Set(roleNodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  roleNodes.forEach((node) => {
    adjacency.set(node.id, []);
    indegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    if (!roleIdSet.has(edge.sourceRoleId) || !roleIdSet.has(edge.targetRoleId)) {
      return;
    }
    adjacency.get(edge.sourceRoleId)?.push(edge.targetRoleId);
    indegree.set(edge.targetRoleId, (indegree.get(edge.targetRoleId) ?? 0) + 1);
  });

  const queue: string[] = [];
  indegree.forEach((count, nodeId) => {
    if (count === 0) {
      queue.push(nodeId);
    }
  });

  const depth = new Map<string, number>();
  queue.forEach((nodeId) => depth.set(nodeId, 0));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentDepth = depth.get(current) ?? 0;
    const children = adjacency.get(current) ?? [];
    children.forEach((child) => {
      const nextDepth = currentDepth + 1;
      const existingDepth = depth.get(child);
      if (existingDepth === undefined || nextDepth > existingDepth) {
        depth.set(child, nextDepth);
      }
      const nextIn = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, nextIn);
      if (nextIn === 0) {
        queue.push(child);
      }
    });
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const depthGroups = new Map<number, string[]>();
  roleNodes.forEach((node) => {
    const nodeDepth = depth.get(node.id) ?? 0;
    if (!depthGroups.has(nodeDepth)) {
      depthGroups.set(nodeDepth, []);
    }
    depthGroups.get(nodeDepth)?.push(node.id);
  });

  const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);
  sortedDepths.forEach((level) => {
    const group = depthGroups.get(level) ?? [];
    group.forEach((nodeId, index) => {
      positions[nodeId] = {
        x: 140 + level * 280,
        y: 140 + index * 160
      };
    });
  });

  const dataOffsets = new Map<string, number>();
  const recoveryOffsets = new Map<string, number>();
  nodes.forEach((node) => {
    if (node.nodeType === 'data' && node.roleId && positions[`role:${node.roleId.replace(/-/g, '')}`]) {
      const roleNodeId = `role:${node.roleId.replace(/-/g, '')}`;
      const base = positions[roleNodeId];
      const offset = dataOffsets.get(roleNodeId) ?? 0;
      dataOffsets.set(roleNodeId, offset + 1);
      positions[node.id] = {
        x: base.x + 220,
        y: base.y + offset * 90
      };
    }
  });

  nodes.forEach((node) => {
    if (node.nodeType === 'recovery' && node.roleId) {
      const roleNodeId = `role:${node.roleId.replace(/-/g, '')}`;
      const base = positions[roleNodeId];
      if (base) {
        const offset = recoveryOffsets.get(roleNodeId) ?? 0;
        recoveryOffsets.set(roleNodeId, offset + 1);
        positions[node.id] = {
          x: base.x + 200,
          y: base.y - 120 - offset * 80
        };
      }
    }
  });

  nodes.forEach((node) => {
    if (node.nodeType !== 'recovery_shared') {
      return;
    }
    const edge = edges.find((item) => item.targetRoleId === node.id);
    if (!edge) return;
    const base = positions[edge.sourceRoleId];
    if (base) {
      positions[node.id] = {
        x: base.x + 200,
        y: base.y
      };
    }
  });

  nodes.forEach((node) => {
    if (!positions[node.id]) {
      positions[node.id] = { x: 140, y: 140 };
    }
  });

  return positions;
};

const stripRoleId = (id: string) => (id.startsWith('role:') ? id.slice(5) : id);

const formatApiError = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const text = error.message?.trim();
    if (!text) return fallback;
    if (text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) return parsed.error;
      } catch {
        return text;
      }
    }
    return text;
  }
  return fallback;
};

const GraphNode = ({ data }: NodeProps<RoleNodeData>) => {
  const spacing = 16;
  const isRoleNode = data.nodeType === 'role';
  const allowFallback = data.nodeType !== 'data';
  const incoming = isRoleNode
    ? [...RELATION_TYPES]
    : data.incomingTypes.length > 0
      ? data.incomingTypes
      : allowFallback
        ? ['link']
        : [];
  const outgoing = isRoleNode
    ? [...RELATION_TYPES]
    : data.outgoingTypes.length > 0
      ? data.outgoingTypes
      : allowFallback
        ? ['link']
        : [];
  const secondary = data.nodeType === 'data' ? data.value : data.kind;
  return (
    <div className={`role-flow-node role-flow-node--${data.nodeType}`}>
      {incoming.map((relationType, index) => {
        const offset = (index - (incoming.length - 1) / 2) * spacing;
        const color = data.typeColors[relationType] ?? 'var(--ink)';
        return (
          <Handle
            key={`in-${relationType}`}
            id={`in-${relationType}`}
            type="target"
            position={Position.Left}
            isConnectableStart
            isConnectableEnd
            className="role-handle role-handle-in"
            style={{
              '--edge-color': color,
              '--port-offset': `${offset}px`
            } as CSSProperties}
          />
        );
      })}
      {outgoing.map((relationType, index) => {
        const offset = (index - (outgoing.length - 1) / 2) * spacing;
        const color = data.typeColors[relationType] ?? 'var(--ink)';
        return (
          <Handle
            key={`out-${relationType}`}
            id={`out-${relationType}`}
            type="source"
            position={Position.Right}
            isConnectableStart
            isConnectableEnd
            className="role-handle role-handle-out"
            style={{
              '--edge-color': color,
              '--port-offset': `${offset}px`
            } as CSSProperties}
          />
        );
      })}
      <span>{data.label}</span>
      {secondary && (
        <small className={data.nodeType === 'data' ? 'role-node-value' : 'role-node-kind'}>{secondary}</small>
      )}
    </div>
  );
};

const RoleEdge = ({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<RoleEdgeData>) => {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return (
    <g className="react-flow__edge">
      <path
        id={id}
        className="react-flow__edge-path role-edge-path"
        d={path}
        markerEnd={markerEnd}
        style={{ stroke: data?.color }}
      >
        <title>{data?.relationType}</title>
      </path>
    </g>
  );
};

export function RoleGraphSection({ copy }: { copy: Copy }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<RoleNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RoleEdgeData>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showReachable, setShowReachable] = useState(false);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [searchIndex, setSearchIndex] = useState<Array<{ id: string; label: string; value?: string | null }>>([]);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [createOwnerId, setCreateOwnerId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'idle' | 'working' | 'success' | 'error'; message?: string }>({
    type: 'idle'
  });
  const [newRoleNick, setNewRoleNick] = useState('');
  const [newRoleKind, setNewRoleKind] = useState('');
  const [newRoleRelation, setNewRoleRelation] = useState('Owner');
  const [newFieldType, setNewFieldType] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [dataValue, setDataValue] = useState('');
  const [shareTargetRoleId, setShareTargetRoleId] = useState('');
  const [shareRelationType, setShareRelationType] = useState('Read');
  const nodeTypes = useMemo(
    () => ({
      role: GraphNode,
      data: GraphNode,
      recovery: GraphNode,
      recovery_shared: GraphNode
    }),
    []
  );
  const edgeTypes = useMemo(() => ({ role: RoleEdge }), []);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      await issueCsrf();
      const graph = await getRoleGraph();
      const layout = defaultLayout(graph.nodes, graph.edges);
      const typeColors = buildTypeColors(graph.edges);
      const perNode = graph.nodes.reduce<Record<string, { incoming: string[]; outgoing: string[] }>>((acc, node) => {
        acc[node.id] = { incoming: [], outgoing: [] };
        return acc;
      }, {});
      graph.edges.forEach((edge) => {
        perNode[edge.targetRoleId]?.incoming.push(edge.type);
        perNode[edge.sourceRoleId]?.outgoing.push(edge.type);
      });

      const nextNodes: Node<RoleNodeData>[] = graph.nodes.map((node) => {
        const nodeType = node.nodeType ?? 'role';
        return {
          id: node.id,
          type: nodeType,
          position: layout[node.id],
          data: {
            label: node.label,
            kind: node.kind,
            nodeType,
            value: node.value,
            roleId: node.roleId,
            fieldType: node.fieldType,
            dataKeyId: node.dataKeyId,
            incomingTypes: perNode[node.id]?.incoming ?? [],
            outgoingTypes: perNode[node.id]?.outgoing ?? [],
            typeColors
          }
        };
      });

      const nextEdges: Edge<RoleEdgeData>[] = graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceRoleId,
        target: edge.targetRoleId,
        type: 'role',
        data: {
          relationType: edge.type,
          color: typeColors[edge.type] ?? DEFAULT_RELATION_COLOR
        }
      }));

      const types = graph.edges.reduce<Record<string, boolean>>((acc, edge) => {
        acc[edge.type] = acc[edge.type] ?? true;
        return acc;
      }, {});

      setFilters(types);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSearchIndex(
        graph.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          value: node.value ?? node.kind
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => filters[edge.data?.relationType ?? ''] !== false);
  }, [edges, filters]);

  const reachableIds = useMemo(() => {
    if (!showReachable || !selectedNodeId) {
      return null;
    }
    const visited = new Set<string>([selectedNodeId]);
    const queue: string[] = [selectedNodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      filteredEdges.forEach((edge) => {
        if (edge.source === current && !visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
        }
      });
    }
    return visited;
  }, [filteredEdges, selectedNodeId, showReachable]);

  const visibleNodeIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    return new Set(
      searchIndex
        .filter((node) => {
          if (reachableIds && !reachableIds.has(node.id)) {
            return false;
          }
          if (!term) return true;
          return node.label.toLowerCase().includes(term) || node.id.toLowerCase().includes(term) ||
            (node.value ?? '').toLowerCase().includes(term);
        })
        .map((node) => node.id)
    );
  }, [reachableIds, search, searchIndex]);

  useEffect(() => {
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const hidden = !visibleNodeIds.has(node.id);
        if (hidden === node.hidden) {
          return node;
        }
        changed = true;
        return { ...node, hidden };
      });
      return changed ? next : prev;
    });
  }, [setNodes, visibleNodeIds]);

  useEffect(() => {
    setEdges((prev) => {
      let changed = false;
      const next = prev.map((edge) => {
        const visible =
          filters[edge.data?.relationType ?? ''] !== false &&
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target);
        const hidden = !visible;
        if (hidden === edge.hidden) {
          return edge;
        }
        changed = true;
        return { ...edge, hidden };
      });
      return changed ? next : prev;
    });
  }, [filters, setEdges, visibleNodeIds]);

  useEffect(() => {
    const incoming: Record<string, string[]> = {};
    const outgoing: Record<string, string[]> = {};
    filteredEdges.forEach((edge) => {
      if (!incoming[edge.target]) incoming[edge.target] = [];
      if (!outgoing[edge.source]) outgoing[edge.source] = [];
      if (!incoming[edge.target].includes(edge.data?.relationType ?? '')) {
        incoming[edge.target].push(edge.data?.relationType ?? '');
      }
      if (!outgoing[edge.source].includes(edge.data?.relationType ?? '')) {
        outgoing[edge.source].push(edge.data?.relationType ?? '');
      }
    });

    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const nextIncoming = incoming[node.id] ?? [];
        const nextOutgoing = outgoing[node.id] ?? [];
        if (
          node.data.incomingTypes.length === nextIncoming.length &&
          node.data.outgoingTypes.length === nextOutgoing.length &&
          node.data.incomingTypes.every((value, index) => value === nextIncoming[index]) &&
          node.data.outgoingTypes.every((value, index) => value === nextOutgoing[index])
        ) {
          return node;
        }
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            incomingTypes: nextIncoming,
            outgoingTypes: nextOutgoing
          }
        };
      });
      return changed ? next : prev;
    });
  }, [filteredEdges, setNodes]);

  const isValidConnection = (connection: Connection) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    if (!connection.sourceHandle || !connection.targetHandle) return false;
    if (!connection.source.startsWith('role:') || !connection.target.startsWith('role:')) {
      return false;
    }
    const relationType = connection.sourceHandle.replace(/^(in|out)-/, '') ||
      connection.targetHandle.replace(/^(in|out)-/, '');
    if (relationType && !RELATION_TYPES.includes(relationType as (typeof RELATION_TYPES)[number])) {
      return false;
    }
    const sourceIn = connection.sourceHandle.startsWith('in-');
    const targetIn = connection.targetHandle.startsWith('in-');
    return sourceIn !== targetIn;
  };

  const handleConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (!connection.sourceHandle || !connection.targetHandle) return;
    const sourceIsOut = connection.sourceHandle.startsWith('out-');
    const relationType = (sourceIsOut ? connection.sourceHandle : connection.targetHandle).replace(/^(in|out)-/, '');
    const parentNodeId = sourceIsOut ? connection.source : connection.target;
    const childNodeId = sourceIsOut ? connection.target : connection.source;
    if (!relationType) return;

    setPendingLink({
      sourceId: parentNodeId,
      targetId: childNodeId,
      relationType
    });
    setActionStatus({ type: 'working', message: copy.account.roles.linkWorking });

    try {
      await issueCsrf();
      await createRoleEdge(stripRoleId(parentNodeId), {
        childRoleId: stripRoleId(childNodeId),
        relationshipType: relationType
      });
      await loadGraph();
      setActionStatus({ type: 'success', message: copy.account.roles.linkSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.linkError) });
    }
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedRoleId = selectedNode?.data.roleId ?? (selectedNode?.id && selectedNode.id.startsWith('role:') ? stripRoleId(selectedNode.id) : null);

  useEffect(() => {
    if (selectedNode?.data.nodeType === 'data') {
      setDataValue(selectedNode.data.value ?? '');
    } else {
      setDataValue('');
    }
    if (!selectedNode || selectedNode.id !== createOwnerId) {
      setCreateOwnerId(null);
    }
    setActionStatus({ type: 'idle' });
  }, [createOwnerId, selectedNode, selectedNodeId, selectedNode?.data.nodeType, selectedNode?.data.value]);

  const handleCreateRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!createOwnerId) return;
    if (!newRoleNick.trim() || !newRoleKind.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.createRoleError });
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.createRoleWorking });
    try {
      await issueCsrf();
      const response = await createRole({
        parentRoleId: stripRoleId(createOwnerId),
        relationshipType: newRoleRelation,
        fields: [
          { fieldType: 'nick', plainValue: newRoleNick.trim() },
          { fieldType: 'role_kind', plainValue: newRoleKind.trim() }
        ]
      });
      const parentNodeId = createOwnerId;
      const newNodeId = `role:${response.roleId.replace(/-/g, '')}`;
      const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
      const parentNode = nodes.find((node) => node.id === parentNodeId);
      const outgoingCount = edges.filter((edge) => edge.source === parentNodeId).length;
      const position = parentNode
        ? { x: parentNode.position.x + 280, y: parentNode.position.y + outgoingCount * 140 }
        : { x: 280, y: 200 };

      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== parentNodeId) {
            return node;
          }
          const nextOutgoing = node.data.outgoingTypes.includes(newRoleRelation)
            ? node.data.outgoingTypes
            : [...node.data.outgoingTypes, newRoleRelation];
          return {
            ...node,
            data: {
              ...node.data,
              outgoingTypes: nextOutgoing
            }
          };
        }).concat({
          id: newNodeId,
          type: 'role',
          position,
          data: {
            label: newRoleNick.trim(),
            kind: newRoleKind.trim(),
            nodeType: 'role',
            value: null,
            roleId: response.roleId,
            fieldType: null,
            dataKeyId: null,
            incomingTypes: [newRoleRelation],
            outgoingTypes: [],
            typeColors
          }
        })
      );

      setEdges((prev) =>
        prev.concat({
          id: `${stripRoleId(parentNodeId)}:${response.roleId.replace(/-/g, '')}:${newRoleRelation}`,
          source: parentNodeId,
          target: newNodeId,
          type: 'role',
          data: {
            relationType: newRoleRelation,
            color: typeColors[newRoleRelation] ?? DEFAULT_RELATION_COLOR
          }
        })
      );

      setFilters((prev) => ({ ...prev, [newRoleRelation]: prev[newRoleRelation] ?? true }));
      setSearchIndex((prev) => prev.concat({ id: newNodeId, label: newRoleNick.trim(), value: newRoleKind.trim() }));
      setSelectedNodeId(newNodeId);
      setNewRoleNick('');
      setNewRoleKind('');
      setCreateOwnerId(null);
      setActionStatus({ type: 'success', message: copy.account.roles.createRoleSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.createRoleError) });
    }
  };

  const handleAddField = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRoleId) return;
    if (!newFieldType.trim() || !newFieldValue.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.dataAddError });
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.dataAddWorking });
    try {
      await issueCsrf();
      await updateRoleField(selectedRoleId, {
        fieldType: newFieldType.trim(),
        plainValue: newFieldValue.trim()
      });
      await loadGraph();
      setNewFieldType('');
      setNewFieldValue('');
      setActionStatus({ type: 'success', message: copy.account.roles.dataAddSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataAddError) });
    }
  };

  const handleUpdateField = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRoleId || !selectedNode?.data.fieldType) return;
    if (!dataValue.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.dataEditError });
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.dataEditWorking });
    try {
      await issueCsrf();
      await updateRoleField(selectedRoleId, {
        fieldType: selectedNode.data.fieldType,
        plainValue: dataValue.trim()
      });
      await loadGraph();
      setActionStatus({ type: 'success', message: copy.account.roles.dataEditSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataEditError) });
    }
  };

  const handleShareRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRoleId || !shareTargetRoleId.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.shareRoleError });
      return;
    }
    const targetRoleId = stripRoleId(shareTargetRoleId.trim());
    setActionStatus({ type: 'working', message: copy.account.roles.shareRoleWorking });
    try {
      await issueCsrf();
      await shareRole(selectedRoleId, {
        targetRoleId,
        relationshipType: shareRelationType
      });
      setShareTargetRoleId('');
      setActionStatus({ type: 'success', message: copy.account.roles.shareRoleSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.shareRoleError) });
    }
  };

  return (
    <section className="account-card" id="roles">
      <h3>{copy.account.sections.roles}</h3>
      <p className="note">{copy.account.roles.lead}</p>
      <div className="role-controls">
        <input
          type="search"
          placeholder={copy.account.roles.searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="role-toggle">
          <input
            type="checkbox"
            checked={showReachable}
            onChange={(event) => setShowReachable(event.target.checked)}
          />
          {copy.account.roles.reachableToggle}
        </label>
        <button type="button" className="chip" onClick={() => setIsFullscreen((prev) => !prev)}>
          {isFullscreen ? copy.account.roles.fullscreenExit : copy.account.roles.fullscreenEnter}
        </button>
      </div>
      <div className="role-filters">
        {Object.keys(filters).length === 0 && <span className="hint">{copy.account.roles.noFilters}</span>}
        {Object.entries(filters).map(([type, enabled]) => (
          <button
            key={type}
            type="button"
            className={`chip ${enabled ? 'active' : ''}`}
            onClick={() => setFilters((prev) => ({ ...prev, [type]: !enabled }))}
          >
            {type}
          </button>
        ))}
      </div>
      <div className={`role-graph ${isFullscreen ? 'is-fullscreen' : ''}`}>
        <div className="role-flow">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            fitView
            minZoom={0.4}
            maxZoom={1.8}
            onlyRenderVisibleElements
            zoomOnScroll
            panOnScroll={false}
            preventScrolling
          >
            <Background gap={24} size={1} color="rgba(40, 48, 56, 0.08)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {loading && <div className="role-loading">{copy.account.roles.loading}</div>}
          {!loading && nodes.length === 0 && <div className="role-loading">{copy.account.roles.noNodes}</div>}
        </div>
        <aside className="role-panel">
          <h4>{copy.account.roles.panelTitle}</h4>
          {selectedNode && (
            <div className="role-panel-block">
              <strong>{selectedNode.data.label}</strong>
              {selectedNode.data.kind && selectedNode.data.nodeType !== 'data' && (
                <span className="hint">{selectedNode.data.kind}</span>
              )}
              {selectedNode.data.nodeType === 'data' && selectedNode.data.value && (
                <span className="hint">{selectedNode.data.value}</span>
              )}
              <span className="hint">{selectedNode.id}</span>
            </div>
          )}
          {selectedEdge && (
            <div className="role-panel-block">
              <strong>{copy.account.roles.edgeTitle}</strong>
              <span className="hint">{selectedEdge.data?.relationType}</span>
              <span className="hint">
                {selectedEdge.source} {"->"} {selectedEdge.target}
              </span>
            </div>
          )}
          {pendingLink && (
            <div className="role-panel-block">
              <strong>{copy.account.roles.linkDraftTitle}</strong>
              <span className="hint">{copy.account.roles.linkDraftHint}</span>
              <span className="hint">
                {pendingLink.sourceId} {"->"} {pendingLink.targetId}
              </span>
              <span className="hint">{pendingLink.relationType}</span>
            </div>
          )}
          {actionStatus.type !== 'idle' && (
            <div className={`status ${actionStatus.type === 'working' ? '' : actionStatus.type}`}>
              <strong>{copy.access.statusTitle}</strong>
              <span>{actionStatus.message ?? copy.access.statusReady}</span>
            </div>
          )}
          {!selectedNode && !selectedEdge && <p className="hint">{copy.account.roles.panelEmpty}</p>}
          {selectedNode && selectedNode.data.nodeType === 'role' && (
            <>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setCreateOwnerId(selectedNode.id);
                  setPendingLink(null);
                }}
              >
                {copy.account.roles.createOwnedRole}
              </button>
              {createOwnerId && (
                <form className="role-panel-form" onSubmit={handleCreateRole}>
                  <strong>{copy.account.roles.createRoleTitle}</strong>
                  <span className="hint">{copy.account.roles.createOwnedRoleHint}</span>
                  <label>
                    {copy.account.roles.createRoleNickLabel}
                    <input
                      type="text"
                      value={newRoleNick}
                      onChange={(event) => setNewRoleNick(event.target.value)}
                    />
                  </label>
                  <label>
                    {copy.account.roles.createRoleKindLabel}
                    <input
                      type="text"
                      value={newRoleKind}
                      onChange={(event) => setNewRoleKind(event.target.value)}
                    />
                  </label>
                  <label>
                    {copy.account.roles.createRoleRelationLabel}
                    <select value={newRoleRelation} onChange={(event) => setNewRoleRelation(event.target.value)}>
                      {RELATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="role-panel-actions">
                    <button type="submit" className="chip">
                      {copy.account.roles.createRoleAction}
                    </button>
                    <button type="button" className="ghost" onClick={() => setCreateOwnerId(null)}>
                      {copy.account.roles.cancelAction}
                    </button>
                  </div>
                </form>
              )}
              <form className="role-panel-form" onSubmit={handleAddField}>
                <strong>{copy.account.roles.dataAddTitle}</strong>
                <label>
                  {copy.account.roles.dataFieldLabel}
                  <input
                    type="text"
                    value={newFieldType}
                    onChange={(event) => setNewFieldType(event.target.value)}
                  />
                </label>
                <label>
                  {copy.account.roles.dataValueLabel}
                  <input
                    type="text"
                    value={newFieldValue}
                    onChange={(event) => setNewFieldValue(event.target.value)}
                  />
                </label>
                <button type="submit" className="chip">
                  {copy.account.roles.dataAddAction}
                </button>
              </form>
              <form className="role-panel-form" onSubmit={handleShareRole}>
                <strong>{copy.account.roles.shareRoleTitle}</strong>
                <label>
                  {copy.account.roles.shareRoleTargetLabel}
                  <input
                    type="text"
                    value={shareTargetRoleId}
                    onChange={(event) => setShareTargetRoleId(event.target.value)}
                  />
                </label>
                <label>
                  {copy.account.roles.shareRoleRelationLabel}
                  <select value={shareRelationType} onChange={(event) => setShareRelationType(event.target.value)}>
                    {RELATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="chip">
                  {copy.account.roles.shareRoleAction}
                </button>
              </form>
            </>
          )}
          {selectedNode && selectedNode.data.nodeType === 'data' && (
            <form className="role-panel-form" onSubmit={handleUpdateField}>
              <strong>{copy.account.roles.dataEditTitle}</strong>
              <label>
                {copy.account.roles.dataValueLabel}
                <input type="text" value={dataValue} onChange={(event) => setDataValue(event.target.value)} />
              </label>
              <button type="submit" className="chip">
                {copy.account.roles.dataEditAction}
              </button>
            </form>
          )}
          {selectedNode && (
            <>
              <div className="role-panel-block">
                <strong>{copy.account.roles.incomingTitle}</strong>
                {selectedNode.data.incomingTypes.length === 0 && <span className="hint">{copy.account.roles.none}</span>}
                {selectedNode.data.incomingTypes.map((type) => (
                  <div key={type}>
                    <span className="note">{type}</span>
                  </div>
                ))}
              </div>
              <div className="role-panel-block">
                <strong>{copy.account.roles.outgoingTitle}</strong>
                {selectedNode.data.outgoingTypes.length === 0 && <span className="hint">{copy.account.roles.none}</span>}
                {selectedNode.data.outgoingTypes.map((type) => (
                  <div key={type}>
                    <span className="note">{type}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
