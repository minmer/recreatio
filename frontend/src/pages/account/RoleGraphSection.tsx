import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
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
import { getRoleGraph, issueCsrf, type RoleGraphEdge, type RoleGraphNode } from '../../lib/api';

type RoleNodeData = {
  label: string;
  kind: string;
  incomingTypes: string[];
  outgoingTypes: string[];
  typeColors: Record<string, string>;
};

type RoleEdgeData = {
  relationType: string;
  color: string;
  showLabel: boolean;
};

type PendingLink = {
  sourceId: string;
  targetId: string;
  relationType: string;
};


const buildTypeColors = (edges: RoleGraphEdge[]) => {
  const colors: Record<string, string> = {};
  edges.forEach((edge) => {
    if (colors[edge.type]) return;
    let hash = 0;
    for (let i = 0; i < edge.type.length; i += 1) {
      hash = (hash * 31 + edge.type.charCodeAt(i)) % 360;
    }
    colors[edge.type] = `hsl(${hash}, 55%, 48%)`;
  });
  return colors;
};

const defaultLayout = (nodes: RoleGraphNode[]) => {
  const radius = 240;
  const center = { x: 320, y: 240 };
  const count = Math.max(nodes.length, 1);
  return nodes.reduce<Record<string, { x: number; y: number }>>((acc, node, index) => {
    const angle = (index / count) * Math.PI * 2;
    acc[node.id] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
    return acc;
  }, {});
};

const RoleNode = ({ data }: NodeProps<RoleNodeData>) => {
  const incoming = data.incomingTypes.length > 0 ? data.incomingTypes : ['link'];
  const outgoing = data.outgoingTypes.length > 0 ? data.outgoingTypes : ['link'];
  const spacing = 16;
  return (
    <div className="role-flow-node">
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
      <small>{data.kind}</small>
    </div>
  );
};

const RoleEdge = ({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<RoleEdgeData>) => {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const showLabel = data?.showLabel;
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: data?.color }} className="role-edge-path" />
      {showLabel && data?.relationType && (
        <EdgeLabelRenderer>
          <div
            className="role-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
            }}
          >
            {data.relationType}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export function RoleGraphSection({ copy }: { copy: Copy }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<RoleNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RoleEdgeData>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [showReachable, setShowReachable] = useState(false);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [createOwnerId, setCreateOwnerId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    let active = true;
    const loadGraph = async () => {
      setLoading(true);
      try {
        await issueCsrf();
        const graph = await getRoleGraph();
        if (!active) return;
        const layout = defaultLayout(graph.nodes);
        const typeColors = buildTypeColors(graph.edges);
        const perNode = graph.nodes.reduce<Record<string, { incoming: string[]; outgoing: string[] }>>((acc, node) => {
          acc[node.id] = { incoming: [], outgoing: [] };
          return acc;
        }, {});
        graph.edges.forEach((edge) => {
          perNode[edge.targetRoleId]?.incoming.push(edge.type);
          perNode[edge.sourceRoleId]?.outgoing.push(edge.type);
        });

        const nextNodes: Node<RoleNodeData>[] = graph.nodes.map((node) => ({
          id: node.id,
          type: 'role',
          position: layout[node.id],
          data: {
            label: node.label,
            kind: node.kind,
            incomingTypes: perNode[node.id]?.incoming ?? [],
            outgoingTypes: perNode[node.id]?.outgoing ?? [],
            typeColors
          }
        }));

        const nextEdges: Edge<RoleEdgeData>[] = graph.edges.map((edge) => ({
          id: edge.id,
          source: edge.sourceRoleId,
          target: edge.targetRoleId,
          type: 'role',
          data: {
            relationType: edge.type,
            color: typeColors[edge.type] ?? 'rgba(28, 33, 38, 0.45)',
            showLabel: false
          }
        }));

        const types = graph.edges.reduce<Record<string, boolean>>((acc, edge) => {
          acc[edge.type] = acc[edge.type] ?? true;
          return acc;
        }, {});

        setFilters(types);
        setNodes(nextNodes);
        setEdges(nextEdges);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    loadGraph();
    return () => {
      active = false;
    };
  }, [setEdges, setNodes]);

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
      nodes
        .filter((node) => {
          if (reachableIds && !reachableIds.has(node.id)) {
            return false;
          }
          if (!term) return true;
          return (
            node.data.label.toLowerCase().includes(term) ||
            node.id.toLowerCase().includes(term)
          );
        })
        .map((node) => node.id)
    );
  }, [nodes, reachableIds, search]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        hidden: !visibleNodeIds.has(node.id)
      }))
    );
  }, [setNodes, visibleNodeIds]);

  useEffect(() => {
    setEdges((prev) =>
      prev.map((edge) => {
        const visible =
          filters[edge.data?.relationType ?? ''] !== false &&
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target);
        return {
          ...edge,
          hidden: !visible,
          data: {
            ...edge.data,
            showLabel: edge.id === hoveredEdgeId
          }
        };
      })
    );
  }, [filters, hoveredEdgeId, setEdges, visibleNodeIds]);

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

    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: {
          ...node.data,
          incomingTypes: incoming[node.id] ?? [],
          outgoingTypes: outgoing[node.id] ?? []
        }
      }))
    );
  }, [filteredEdges, setNodes]);

  const isValidConnection = (connection: Connection) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    if (!connection.sourceHandle || !connection.targetHandle) return false;
    const sourceIn = connection.sourceHandle.startsWith('in-');
    const targetIn = connection.targetHandle.startsWith('in-');
    return sourceIn !== targetIn;
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (!connection.sourceHandle || !connection.targetHandle) return;
    const relationType = connection.sourceHandle.replace(/^(in|out)-/, '') || 'link';
    setPendingLink({
      sourceId: connection.source,
      targetId: connection.target,
      relationType
    });
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

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
            nodeTypes={{ role: RoleNode }}
            edgeTypes={{ role: RoleEdge }}
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
            onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
            onEdgeMouseLeave={() => setHoveredEdgeId(null)}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            fitView
            minZoom={0.4}
            maxZoom={1.8}
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
              <span className="hint">{selectedNode.data.kind}</span>
              <span className="hint">{selectedNode.id}</span>
            </div>
          )}
          {selectedNode && (
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
          {createOwnerId && (
            <div className="role-panel-block">
              <strong>{copy.account.roles.createOwnedRole}</strong>
              <span className="hint">{copy.account.roles.createOwnedRoleHint}</span>
              <span className="hint">{createOwnerId}</span>
            </div>
          )}
          {!selectedNode && !selectedEdge && <p className="hint">{copy.account.roles.panelEmpty}</p>}
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
