import { useEffect, useMemo, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  getRoleGraph,
  issueCsrf,
  type RoleGraphEdge,
  type RoleGraphNode
} from '../../lib/api';

type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const defaultLayout = (nodes: RoleGraphNode[]) => {
  const radius = 240;
  const center = { x: 320, y: 240 };
  const count = Math.max(nodes.length, 1);
  return nodes.reduce<Record<string, Point>>((acc, node, index) => {
    const angle = (index / count) * Math.PI * 2;
    acc[node.id] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
    return acc;
  }, {});
};

export function RoleGraphSection({ copy }: { copy: Copy }) {
  const [nodes, setNodes] = useState<RoleGraphNode[]>([]);
  const [edges, setEdges] = useState<RoleGraphEdge[]>([]);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showReachable, setShowReachable] = useState(false);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadGraph = async () => {
      setLoading(true);
      try {
        await issueCsrf();
        const graph = await getRoleGraph();
        if (!active) return;
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setPositions(defaultLayout(graph.nodes));
        const types = graph.edges.reduce<Record<string, boolean>>((acc, edge) => {
          acc[edge.type] = acc[edge.type] ?? true;
          return acc;
        }, {});
        setFilters(types);
      } catch {
        if (!active) return;
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    loadGraph();
    return () => {
      active = false;
    };
  }, []);

  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => filters[edge.type] !== false);
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
        if (edge.sourceRoleId === current && !visited.has(edge.targetRoleId)) {
          visited.add(edge.targetRoleId);
          queue.push(edge.targetRoleId);
        }
      });
    }
    return visited;
  }, [filteredEdges, selectedNodeId, showReachable]);

  const filteredNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return nodes.filter((node) => {
      if (reachableIds && !reachableIds.has(node.id)) {
        return false;
      }
      if (!term) return true;
      return node.label.toLowerCase().includes(term) || node.id.toLowerCase().includes(term);
    });
  }, [nodes, reachableIds, search]);

  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((node) => node.id));
    return filteredEdges.filter((edge) => visibleIds.has(edge.sourceRoleId) && visibleIds.has(edge.targetRoleId));
  }, [filteredEdges, filteredNodes]);

  const incomingByType = useMemo(() => {
    if (!selectedNodeId) return {};
    return visibleEdges
      .filter((edge) => edge.targetRoleId === selectedNodeId)
      .reduce<Record<string, RoleGraphEdge[]>>((acc, edge) => {
        acc[edge.type] = [...(acc[edge.type] ?? []), edge];
        return acc;
      }, {});
  }, [selectedNodeId, visibleEdges]);

  const outgoingByType = useMemo(() => {
    if (!selectedNodeId) return {};
    return visibleEdges
      .filter((edge) => edge.sourceRoleId === selectedNodeId)
      .reduce<Record<string, RoleGraphEdge[]>>((acc, edge) => {
        acc[edge.type] = [...(acc[edge.type] ?? []), edge];
        return acc;
      }, {});
  }, [selectedNodeId, visibleEdges]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingNodeId && dragStart) {
      const delta = { x: event.clientX - dragStart.x, y: event.clientY - dragStart.y };
      setPositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: prev[draggingNodeId].x + delta.x / zoom,
          y: prev[draggingNodeId].y + delta.y / zoom
        }
      }));
      setDragStart({ x: event.clientX, y: event.clientY });
      return;
    }

    if (panStart) {
      setPan((prev) => ({
        x: prev.x + (event.clientX - panStart.x),
        y: prev.y + (event.clientY - panStart.y)
      }));
      setPanStart({ x: event.clientX, y: event.clientY });
    }
  };

  const handlePointerUp = () => {
    setDraggingNodeId(null);
    setDragStart(null);
    setPanStart(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const next = clamp(zoom - event.deltaY * 0.001, 0.4, 1.8);
    setZoom(next);
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
      <div className="role-graph">
        <div
          ref={containerRef}
          className="role-canvas"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            setSelectedEdgeId(null);
            if ((event.target as HTMLElement).dataset.nodeId) return;
            setPanStart({ x: event.clientX, y: event.clientY });
          }}
        >
          <div
            className="role-viewport"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <svg className="role-edges" viewBox="0 0 640 480">
              {visibleEdges.map((edge) => {
                const source = positions[edge.sourceRoleId];
                const target = positions[edge.targetRoleId];
                if (!source || !target) return null;
                const selected = edge.id === selectedEdgeId;
                return (
                  <g key={edge.id} onClick={() => setSelectedEdgeId(edge.id)}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      className={selected ? 'selected' : ''}
                    />
                    <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2}>
                      {edge.type}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="role-nodes">
              {filteredNodes.map((node) => {
                const pos = positions[node.id] ?? { x: 0, y: 0 };
                const isSelected = node.id === selectedNodeId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-node-id={node.id}
                    className={`role-node ${isSelected ? 'selected' : ''}`}
                    style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelectedNodeId(node.id);
                      setSelectedEdgeId(null);
                      setDraggingNodeId(node.id);
                      setDragStart({ x: event.clientX, y: event.clientY });
                    }}
                  >
                    <span>{node.label}</span>
                    <small>{node.kind}</small>
                  </button>
                );
              })}
            </div>
          </div>
          {loading && <div className="role-loading">{copy.account.roles.loading}</div>}
          {!loading && nodes.length === 0 && (
            <div className="role-loading">{copy.account.roles.noNodes}</div>
          )}
        </div>
        <aside className="role-panel">
          <h4>{copy.account.roles.panelTitle}</h4>
          {selectedNode && (
            <div className="role-panel-block">
              <strong>{selectedNode.label}</strong>
              <span className="hint">{selectedNode.kind}</span>
              <span className="hint">{selectedNode.id}</span>
            </div>
          )}
          {selectedEdge && (
            <div className="role-panel-block">
              <strong>{copy.account.roles.edgeTitle}</strong>
              <span className="hint">{selectedEdge.type}</span>
              <span className="hint">
                {selectedEdge.sourceRoleId} {"->"} {selectedEdge.targetRoleId}
              </span>
            </div>
          )}
          {!selectedNode && !selectedEdge && <p className="hint">{copy.account.roles.panelEmpty}</p>}
          {selectedNode && (
            <>
              <div className="role-panel-block">
                <strong>{copy.account.roles.incomingTitle}</strong>
                {Object.keys(incomingByType).length === 0 && <span className="hint">{copy.account.roles.none}</span>}
                {Object.entries(incomingByType).map(([type, list]) => (
                  <div key={type}>
                    <span className="note">{type}</span>
                    <div className="hint">{list.length}</div>
                  </div>
                ))}
              </div>
              <div className="role-panel-block">
                <strong>{copy.account.roles.outgoingTitle}</strong>
                {Object.keys(outgoingByType).length === 0 && <span className="hint">{copy.account.roles.none}</span>}
                {Object.entries(outgoingByType).map(([type, list]) => (
                  <div key={type}>
                    <span className="note">{type}</span>
                    <div className="hint">{list.length}</div>
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
