import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import ReactFlow, {
  Background,
  ConnectionLineType,
  Controls,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../content/types';
import {
  AUX_HANDLE_IN,
  AUX_HANDLE_OUT,
  DEFAULT_RELATION_COLOR,
  RELATION_COLORS,
  RELATION_TYPES,
  buildTypeColors,
  getEdgeHandles
} from './roleGraphConfig';
import { defaultLayout } from './roleGraphLayout';
import { GraphNode, RoleEdge } from './RoleGraphNodes';
import { RoleGraphControls } from './RoleGraphControls';
import { RoleGraphPanel } from './RoleGraphPanel';
import type { ActionStatus, PendingLink, RoleEdgeData, RoleNodeData } from './roleGraphTypes';
import {
  createRole,
  createRoleEdge,
  getRoleParents,
  getPendingRoleShares,
  acceptRoleShare,
  deleteRoleParent,
  deleteRoleField,
  getRoleGraph,
  issueCsrf,
  shareRole,
  updateRoleField,
  verifyRoleLedger,
  ApiError,
  type PendingRoleShareResponse,
  type RoleLedgerVerificationResponse,
  type RoleParentsResponse,
  type RoleGraphEdge,
  type RoleGraphNode
} from '../../lib/api';

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
  const [isCompact, setIsCompact] = useState(false);
  const [compactView, setCompactView] = useState<'graph' | 'panel'>('graph');
  const [actionStatus, setActionStatus] = useState<ActionStatus>({ type: 'idle' });
  const [newRoleNick, setNewRoleNick] = useState('');
  const [newRoleKind, setNewRoleKind] = useState('');
  const [newRoleRelation, setNewRoleRelation] = useState('Owner');
  const [newFieldType, setNewFieldType] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [dataValue, setDataValue] = useState('');
  const [shareTargetRoleId, setShareTargetRoleId] = useState('');
  const [shareRelationType, setShareRelationType] = useState('Read');
  const [parents, setParents] = useState<RoleParentsResponse | null>(null);
  const [parentsState, setParentsState] = useState<'idle' | 'working' | 'error'>('idle');
  const [verification, setVerification] = useState<RoleLedgerVerificationResponse | null>(null);
  const [verificationState, setVerificationState] = useState<'idle' | 'working' | 'error'>('idle');
  const [pendingShares, setPendingShares] = useState<PendingRoleShareResponse[]>([]);
  const [pendingState, setPendingState] = useState<'idle' | 'working' | 'error'>('idle');
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 720px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const nextCompact = 'matches' in event ? event.matches : event.matches;
      setIsCompact(nextCompact);
      if (!nextCompact) {
        setCompactView('graph');
      }
    };
    handleChange(media);
    if ('addEventListener' in media) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

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
            canLink: node.canLink ?? false,
            canWrite: node.canWrite ?? false,
            incomingTypes: perNode[node.id]?.incoming ?? [],
            outgoingTypes: perNode[node.id]?.outgoing ?? [],
            typeColors
          }
        };
      });

      const nextEdges: Edge<RoleEdgeData>[] = graph.edges.map((edge) => {
        const handles = getEdgeHandles(edge.type);
        return {
          id: edge.id,
          source: edge.sourceRoleId,
          target: edge.targetRoleId,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'role',
          data: {
            relationType: edge.type,
            color: typeColors[edge.type] ?? DEFAULT_RELATION_COLOR
          }
        };
      });

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
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    if (!sourceNode?.data.canLink || !targetNode?.data.canLink) {
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
      const edgeId = `${stripRoleId(parentNodeId)}:${stripRoleId(childNodeId)}:${relationType}`;
      const handles = getEdgeHandles(relationType);
      setEdges((prev) =>
        prev.some((edge) => edge.id === edgeId)
          ? prev
          : prev.concat({
              id: edgeId,
              source: parentNodeId,
              target: childNodeId,
              sourceHandle: handles.sourceHandle,
              targetHandle: handles.targetHandle,
              type: 'role',
              data: {
                relationType,
                color: nodes[0]?.data.typeColors?.[relationType] ?? DEFAULT_RELATION_COLOR
              }
            })
      );
      setFilters((prev) => ({ ...prev, [relationType]: prev[relationType] ?? true }));
      setActionStatus({ type: 'success', message: copy.account.roles.linkSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.linkError) });
    }
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedRoleId = selectedNode?.data.roleId ?? (selectedNode?.id && selectedNode.id.startsWith('role:') ? stripRoleId(selectedNode.id) : null);
  const selectedRoleNode = selectedRoleId
    ? nodes.find((node) => node.id === `role:${selectedRoleId.replace(/-/g, '')}`) ?? null
    : null;
  const selectedRoleCanWrite = selectedRoleNode?.data.canWrite ?? false;
  const selectedRoleCanLink = selectedRoleNode?.data.canLink ?? false;
  const selectedDataOwner =
    selectedNode?.data.nodeType === 'data' && selectedNode.data.roleId
      ? nodes.find((node) => node.id === `role:${selectedNode.data.roleId.replace(/-/g, '')}`) ?? null
      : null;

  useEffect(() => {
    if (selectedNode?.data.nodeType === 'data') {
      setDataValue(selectedNode.data.value ?? '');
    } else {
      setDataValue('');
    }
    if (!selectedNode || selectedNode.id !== createOwnerId) {
      setCreateOwnerId(null);
    }
    setParents(null);
    setParentsState('idle');
    setVerification(null);
    setVerificationState('idle');
    setPendingShares([]);
    setPendingState('idle');
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
    const parentNodeId = createOwnerId;
    const parentNode = nodes.find((node) => node.id === parentNodeId);
    try {
      await issueCsrf();
      const response = await createRole({
        parentRoleId: parentNode?.data.roleId ?? stripRoleId(parentNodeId),
        relationshipType: newRoleRelation,
        fields: [
          { fieldType: 'nick', plainValue: newRoleNick.trim() },
          { fieldType: 'role_kind', plainValue: newRoleKind.trim() }
        ]
      });
      const newNodeId = `role:${response.roleId.replace(/-/g, '')}`;
      const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
      const allowsWrite = ['Owner', 'AdminOf', 'Write'].includes(newRoleRelation);
      const outgoingCount = edges.filter((edge) => edge.source === parentNodeId).length;
      const position = parentNode
        ? { x: parentNode.position.x + 392, y: parentNode.position.y + outgoingCount * 160 }
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
            canLink: newRoleRelation === 'Owner',
            canWrite: allowsWrite,
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
          sourceHandle: `out-${newRoleRelation}`,
          targetHandle: `in-${newRoleRelation}`,
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
      const response = await updateRoleField(selectedRoleId, {
        fieldType: newFieldType.trim(),
        plainValue: newFieldValue.trim()
      });
      const roleNodeId = `role:${selectedRoleId.replace(/-/g, '')}`;
      const dataNodeId = `data:${response.fieldId.replace(/-/g, '')}`;
      const edgeId = `${selectedRoleId.replace(/-/g, '')}:${response.fieldId.replace(/-/g, '')}:data`;
      const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
      setNodes((prev) => {
        const roleNode = prev.find((node) => node.id === roleNodeId);
        const dataCount = prev.filter((node) => node.data.nodeType === 'data' && node.data.roleId === selectedRoleId).length;
        const position = roleNode
          ? { x: roleNode.position.x + 240, y: roleNode.position.y + dataCount * 90 }
          : { x: 320, y: 220 };
        const exists = prev.some((node) => node.id === dataNodeId);
        if (exists) {
          return prev.map((node) =>
            node.id === dataNodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    label: response.fieldType,
                    kind: response.fieldType,
                    value: response.plainValue ?? null,
                    fieldType: response.fieldType,
                    dataKeyId: response.dataKeyId
                  }
                }
              : node
          );
        }
        return prev.concat({
          id: dataNodeId,
          type: 'data',
          position,
          data: {
            label: response.fieldType,
            kind: response.fieldType,
            nodeType: 'data',
            value: response.plainValue ?? null,
            roleId: selectedRoleId,
            fieldType: response.fieldType,
            dataKeyId: response.dataKeyId,
            canLink: false,
            incomingTypes: ['Data'],
            outgoingTypes: [],
            typeColors
          }
        });
      });
      setEdges((prev) => {
        const exists = prev.some((edge) => edge.id === edgeId);
        if (exists) {
          return prev;
        }
        return prev.concat({
          id: edgeId,
          source: roleNodeId,
          target: dataNodeId,
          sourceHandle: AUX_HANDLE_OUT,
          targetHandle: AUX_HANDLE_IN,
          type: 'role',
          data: {
            relationType: 'Data',
            color: typeColors.Data ?? DEFAULT_RELATION_COLOR
          }
        });
      });
      setSearchIndex((prev) => {
        const exists = prev.some((entry) => entry.id === dataNodeId);
        if (exists) {
          return prev.map((entry) =>
            entry.id === dataNodeId
              ? { ...entry, label: response.fieldType, value: response.plainValue ?? null }
              : entry
          );
        }
        return prev.concat({ id: dataNodeId, label: response.fieldType, value: response.plainValue ?? null });
      });
      setSelectedNodeId(dataNodeId);
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
      const response = await updateRoleField(selectedRoleId, {
        fieldType: selectedNode.data.fieldType,
        plainValue: dataValue.trim()
      });
      const dataNodeId = `data:${response.fieldId.replace(/-/g, '')}`;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === dataNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: response.fieldType,
                  kind: response.fieldType,
                  value: response.plainValue ?? null,
                  fieldType: response.fieldType,
                  dataKeyId: response.dataKeyId
                }
              }
            : node
        )
      );
      setSearchIndex((prev) =>
        prev.map((entry) =>
          entry.id === dataNodeId ? { ...entry, label: response.fieldType, value: response.plainValue ?? null } : entry
        )
      );
      setActionStatus({ type: 'success', message: copy.account.roles.dataEditSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataEditError) });
    }
  };

  const handleDeleteField = async () => {
    if (!selectedRoleId || !selectedNode || selectedNode.data.nodeType !== 'data') return;
    const fieldId = selectedNode.id.startsWith('data:') ? selectedNode.id.slice(5) : null;
    if (!fieldId) return;
    setActionStatus({ type: 'working', message: copy.account.roles.dataDeleteWorking });
    try {
      await issueCsrf();
      await deleteRoleField(selectedRoleId, fieldId);
      const dataNodeId = selectedNode.id;
      setNodes((prev) => prev.filter((node) => node.id !== dataNodeId));
      setEdges((prev) => prev.filter((edge) => edge.source !== dataNodeId && edge.target !== dataNodeId));
      setSearchIndex((prev) => prev.filter((entry) => entry.id !== dataNodeId));
      setSelectedNodeId(null);
      setActionStatus({ type: 'success', message: copy.account.roles.dataDeleteSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataDeleteError) });
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

  const handleLoadParents = async () => {
    if (!selectedRoleId) return;
    setParentsState('working');
    try {
      const response = await getRoleParents(selectedRoleId);
      setParents(response);
      setParentsState('idle');
    } catch {
      setParentsState('error');
    }
  };

  const handleVerifyRole = async () => {
    if (!selectedRoleId) return;
    setVerificationState('working');
    try {
      const response = await verifyRoleLedger(selectedRoleId);
      setVerification(response);
      setVerificationState('idle');
    } catch {
      setVerificationState('error');
    }
  };

  const handleLoadPendingShares = async () => {
    if (!selectedRoleId) return;
    setPendingState('working');
    try {
      const response = await getPendingRoleShares();
      setPendingShares(response.filter((share) => share.targetRoleId === selectedRoleId));
      setPendingState('idle');
    } catch {
      setPendingState('error');
    }
  };

  const handleAcceptShare = async (shareId: string) => {
    setPendingState('working');
    try {
      await issueCsrf();
      await acceptRoleShare(shareId, {});
      await loadGraph();
      if (selectedRoleId) {
        const response = await getPendingRoleShares();
        setPendingShares(response.filter((share) => share.targetRoleId === selectedRoleId));
      }
      setPendingState('idle');
    } catch {
      setPendingState('error');
    }
  };

  const handleDeleteParent = async (parentRoleId: string) => {
    if (!selectedRoleId) return;
    setActionStatus({ type: 'working', message: copy.account.roles.parentsWorking });
    try {
      await issueCsrf();
      await deleteRoleParent(selectedRoleId, parentRoleId);
      await loadGraph();
      const response = await getRoleParents(selectedRoleId);
      setParents(response);
      setActionStatus({ type: 'success', message: copy.account.roles.parentsRemoved });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.parentsError) });
    }
  };

  return (
    <section className="account-card" id="roles">
      <h3>{copy.account.sections.roles}</h3>
      <p className="note">{copy.account.roles.lead}</p>
      <RoleGraphControls
        copy={copy}
        search={search}
        onSearchChange={setSearch}
        showReachable={showReachable}
        onToggleReachable={setShowReachable}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        filters={filters}
        onToggleFilter={(type, next) => setFilters((prev) => ({ ...prev, [type]: next }))}
      />
      <div
        className={`role-graph ${isFullscreen ? 'is-fullscreen' : ''} ${isCompact ? 'is-compact' : ''} ${
          isCompact ? `view-${compactView}` : ''
        }`}
      >
        {isCompact && (
          <div className="role-view-toggle">
            <button
              type="button"
              className={`chip ${compactView === 'graph' ? 'active' : ''}`}
              onClick={() => setCompactView('graph')}
            >
              {copy.account.roles.viewGraph}
            </button>
            <button
              type="button"
              className={`chip ${compactView === 'panel' ? 'active' : ''}`}
              onClick={() => setCompactView('panel')}
            >
              {copy.account.roles.viewDetails}
            </button>
          </div>
        )}
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
              if (isCompact) {
                setCompactView('panel');
              }
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
              if (isCompact) {
                setCompactView('panel');
              }
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
            connectionLineType={ConnectionLineType.Bezier}
          >
            <Background gap={24} size={1} color="rgba(40, 48, 56, 0.08)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {loading && <div className="role-loading">{copy.account.roles.loading}</div>}
          {!loading && nodes.length === 0 && <div className="role-loading">{copy.account.roles.noNodes}</div>}
        </div>
        <RoleGraphPanel
          copy={copy}
          state={{
            selectedNode,
            selectedEdge,
            pendingLink,
            actionStatus,
            selectedRoleId,
            selectedRoleCanWrite,
            selectedRoleCanLink,
            selectedDataOwner,
            createOwnerId,
            pendingShares,
            pendingState,
            parents,
            parentsState,
            verification,
            verificationState,
            edges
          }}
          form={{
            newRoleNick,
            newRoleKind,
            newRoleRelation,
            newFieldType,
            newFieldValue,
            shareTargetRoleId,
            shareRelationType,
            dataValue
          }}
          setForm={{
            setNewRoleNick,
            setNewRoleKind,
            setNewRoleRelation,
            setNewFieldType,
            setNewFieldValue,
            setShareTargetRoleId,
            setShareRelationType,
            setDataValue
          }}
          handlers={{
            onStartCreateRole: (ownerId) => {
              setCreateOwnerId(ownerId);
              setPendingLink(null);
            },
            onCancelCreateRole: () => setCreateOwnerId(null),
            onCreateRole: handleCreateRole,
            onAddField: handleAddField,
            onShareRole: handleShareRole,
            onLoadPendingShares: handleLoadPendingShares,
            onAcceptShare: handleAcceptShare,
            onLoadParents: handleLoadParents,
            onDeleteParent: handleDeleteParent,
            onVerifyRole: handleVerifyRole,
            onUpdateField: handleUpdateField,
            onDeleteField: handleDeleteField
          }}
        />
      </div>
    </section>
  );
}
