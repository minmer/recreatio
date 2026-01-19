import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useEdgesState, useNodesState, type Connection, type Edge, type Node } from 'reactflow';
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
import { GraphNode, RecoveryNode, RoleEdge } from './RoleGraphNodes';
import type { ActionStatus, PendingLink, RoleEdgeData, RoleNodeData } from './roleGraphTypes';
import { createDraftId, formatApiError, isExternalNode, isRecoveryNode, stripRoleId } from './roleNetworkHelpers';
import {
  acceptDataShare,
  acceptRoleShare,
  activateRecoveryKey,
  createDataItem,
  createRole,
  createRoleEdge,
  deleteDataItem,
  deleteRoleParent,
  getPendingDataShares,
  getPendingRoleShares,
  getRoleGraph,
  getRoleParents,
  issueCsrf,
  lookupRole,
  shareDataItem,
  shareRole,
  updateDataItem,
  verifyRoleLedger,
  type PendingDataShareResponse,
  type PendingRoleShareResponse,
  type RoleLedgerVerificationResponse,
  type RoleParentsResponse
} from '../../lib/api';

export function useRoleNetwork(copy: Copy) {
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
  const [newDataKind, setNewDataKind] = useState('data');
  const [newFieldType, setNewFieldType] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [dataValue, setDataValue] = useState('');
  const [shareTargetRoleId, setShareTargetRoleId] = useState('');
  const [shareRelationType, setShareRelationType] = useState('Read');
  const [shareDataTargetRoleId, setShareDataTargetRoleId] = useState('');
  const [shareDataPermission, setShareDataPermission] = useState('Read');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'canvas' | 'node'; nodeId?: string } | null>(null);
  const [contextRoleId, setContextRoleId] = useState('');
  const [parents, setParents] = useState<RoleParentsResponse | null>(null);
  const [parentsState, setParentsState] = useState<'idle' | 'working' | 'error'>('idle');
  const [verification, setVerification] = useState<RoleLedgerVerificationResponse | null>(null);
  const [verificationState, setVerificationState] = useState<'idle' | 'working' | 'error'>('idle');
  const [pendingShares, setPendingShares] = useState<PendingRoleShareResponse[]>([]);
  const [pendingState, setPendingState] = useState<'idle' | 'working' | 'error'>('idle');
  const [pendingDataShares, setPendingDataShares] = useState<PendingDataShareResponse[]>([]);
  const [pendingDataState, setPendingDataState] = useState<'idle' | 'working' | 'error'>('idle');
  const [recoveryDrafts, setRecoveryDrafts] = useState<Record<string, { targetRoleId: string; sharedRoleIds: string[] }>>({});

  const nodeTypes = useMemo(
    () => ({
      role: GraphNode,
      data: GraphNode,
      key: GraphNode,
      external: GraphNode,
      recovery: RecoveryNode,
      recovery_plan: RecoveryNode
    }),
    []
  );
  const edgeTypes = useMemo(() => ({ role: RoleEdge }), []);

  const buildDraftId = useCallback(() => createDraftId(), []);

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

  const nodeVisibility = useMemo(() => {
    if (!reachableIds) {
      return null;
    }
    return new Set<string>(reachableIds);
  }, [reachableIds]);

  const visibleNodes = useMemo(() => {
    if (!nodeVisibility) {
      return nodes;
    }
    return nodes.filter((node) => nodeVisibility.has(node.id));
  }, [nodes, nodeVisibility]);

  const visibleEdges = useMemo(() => {
    if (!nodeVisibility) {
      return filteredEdges;
    }
    return filteredEdges.filter((edge) => nodeVisibility.has(edge.source) && nodeVisibility.has(edge.target));
  }, [filteredEdges, nodeVisibility]);

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 960);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isValidConnection = (connection: Connection) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    if (!connection.sourceHandle || !connection.targetHandle) return false;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    if (!sourceNode || !targetNode) {
      return false;
    }

    const sourceIsRecovery = isRecoveryNode(sourceNode);
    const targetIsRecovery = isRecoveryNode(targetNode);
    const sourceIsExternal = isExternalNode(sourceNode);
    const targetIsExternal = isExternalNode(targetNode);
    if (sourceIsRecovery || targetIsRecovery) {
      if (sourceIsRecovery && targetIsRecovery) return false;
      if (sourceIsRecovery) return false;
      const roleNode = sourceNode;
      const recoveryNode = targetNode;
      return connection.sourceHandle === 'out-Owner' && connection.targetHandle === 'in-Owner';
    }

    const sourceIsRole = connection.source.startsWith('role:');
    const targetIsRole = connection.target.startsWith('role:');
    const sourceIsData = connection.source.startsWith('data:') || connection.source.startsWith('key:');
    const targetIsData = connection.target.startsWith('data:') || connection.target.startsWith('key:');
    if (sourceIsData || targetIsData) {
      if (!sourceIsRole && !targetIsRole) return false;
      if (sourceIsData && targetIsData) return false;
      const roleHandle = sourceIsRole ? connection.sourceHandle : connection.targetHandle;
      const dataHandle = sourceIsData ? connection.sourceHandle : connection.targetHandle;
      if (!roleHandle?.startsWith('out-') || !dataHandle?.startsWith('in-')) {
        return false;
      }
      const relationType = roleHandle.replace(/^(in|out)-/, '');
      if (!RELATION_TYPES.includes(relationType as (typeof RELATION_TYPES)[number])) {
        return false;
      }
      return true;
    }
    if (!sourceIsRole || !targetIsRole) {
      return false;
    }
    if (sourceIsExternal && targetIsExternal) {
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
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    if (!sourceNode || !targetNode) return;

    const sourceIsRecovery = isRecoveryNode(sourceNode);
    const targetIsRecovery = isRecoveryNode(targetNode);
    const sourceIsExternal = isExternalNode(sourceNode);
    const targetIsExternal = isExternalNode(targetNode);
    if (sourceIsRecovery || targetIsRecovery) {
      const recoveryNode = sourceIsRecovery ? sourceNode : targetNode;
      const roleNode = sourceIsRecovery ? targetNode : sourceNode;
      const recoveryHandle = sourceIsRecovery ? connection.sourceHandle : connection.targetHandle;
      const roleHandle = sourceIsRecovery ? connection.targetHandle : connection.sourceHandle;
      if (recoveryHandle !== 'in-Owner' && recoveryHandle !== 'out-Owner') {
        return;
      }
      if (roleHandle !== 'in-Owner' && roleHandle !== 'out-Owner') {
        return;
      }
      if (recoveryNode.data.nodeType !== 'recovery_plan') {
        return;
      }
      if (recoveryHandle !== 'in-Owner') {
        return;
      }
      if (recoveryNode.data.recoveryDraft) {
        const edgeId = `${stripRoleId(roleNode.id)}:${stripRoleId(recoveryNode.id)}:Owner`;
        setEdges((prev) =>
          prev.some((edge) => edge.id === edgeId)
            ? prev
            : prev.concat({
                id: edgeId,
                source: roleNode.id,
                target: recoveryNode.id,
                sourceHandle: 'out-Owner',
                targetHandle: 'in-Owner',
                type: 'role',
                data: {
                  relationType: 'Owner',
                  color: nodes[0]?.data.typeColors?.Owner ?? DEFAULT_RELATION_COLOR
                }
              })
        );
        setRecoveryDrafts((prev) => {
          const draft = prev[recoveryNode.id] ?? {
            targetRoleId: recoveryNode.data.roleId ?? stripRoleId(roleNode.id),
            sharedRoleIds: []
          };
          const sharedRoleId = stripRoleId(roleNode.id);
          if (draft.sharedRoleIds.includes(sharedRoleId)) {
            return prev;
          }
          return {
            ...prev,
            [recoveryNode.id]: {
              ...draft,
              sharedRoleIds: draft.sharedRoleIds.concat(sharedRoleId)
            }
          };
        });
        setFilters((prev) => ({ ...prev, Owner: prev.Owner ?? true }));
        setActionStatus({ type: 'success', message: copy.account.roles.recoveryShareSuccess });
      } else {
        setActionStatus({ type: 'error', message: copy.account.roles.recoveryPlanError });
      }
      return;
    }

    const sourceIsData = sourceNode.data.nodeType === 'data' || sourceNode.data.nodeType === 'key';
    const targetIsData = targetNode.data.nodeType === 'data' || targetNode.data.nodeType === 'key';
    if (sourceIsData || targetIsData) {
      const dataNode = sourceIsData ? sourceNode : targetNode;
      const roleNode = sourceIsData ? targetNode : sourceNode;
      const roleHandle = sourceIsData ? connection.targetHandle : connection.sourceHandle;
      const dataHandle = sourceIsData ? connection.sourceHandle : connection.targetHandle;
      if (!roleHandle || !dataHandle) return;
      if (!roleHandle.startsWith('out-') || !dataHandle.startsWith('in-')) {
        return;
      }
      if (!dataNode.data.canLink) {
        setActionStatus({ type: 'error', message: copy.account.roles.linkPermissionNeeded });
        return;
      }
      const relationType = roleHandle.replace(/^(in|out)-/, '');
      if (!RELATION_TYPES.includes(relationType as (typeof RELATION_TYPES)[number])) {
        return;
      }
      const dataItemId = dataNode.id.replace(/^data:|^key:/, '');
      const roleId = stripRoleId(roleNode.id);
      setActionStatus({ type: 'working', message: copy.account.roles.dataShareWorking });
      try {
        await issueCsrf();
        await shareDataItem(dataItemId, {
          targetRoleId: roleId,
          permissionType: relationType
        });
        const edgeId = `${roleId}:${dataItemId}:${relationType}`;
        const handles = getEdgeHandles(relationType);
        setEdges((prev) =>
          prev.some((edge) => edge.id === edgeId)
            ? prev
            : prev.concat({
                id: edgeId,
                source: roleNode.id,
                target: dataNode.id,
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
        setActionStatus({ type: 'success', message: copy.account.roles.dataShareSuccess });
      } catch (error) {
        setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataShareError) });
      }
      return;
    }

    const sourceIsOut = connection.sourceHandle.startsWith('out-');
    const relationType = (sourceIsOut ? connection.sourceHandle : connection.targetHandle).replace(/^(in|out)-/, '');
    const parentNodeId = sourceIsOut ? connection.source : connection.target;
    const childNodeId = sourceIsOut ? connection.target : connection.source;
    if (!relationType) return;

    if (sourceIsExternal || targetIsExternal) {
      const externalNode = sourceIsExternal ? sourceNode : targetNode;
      const localNode = sourceIsExternal ? targetNode : sourceNode;
      if (!localNode.data.canLink) {
        setActionStatus({ type: 'error', message: copy.account.roles.linkPermissionNeeded });
        return;
      }
      setActionStatus({ type: 'working', message: copy.account.roles.shareRoleWorking });
      try {
        await issueCsrf();
        await shareRole(stripRoleId(localNode.id), {
          targetRoleId: stripRoleId(externalNode.id),
          relationshipType: relationType
        });
        setActionStatus({ type: 'success', message: copy.account.roles.shareRoleSuccess });
      } catch (error) {
        setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.shareRoleError) });
      }
      return;
    }

    if (!sourceNode.data.canLink || !targetNode.data.canLink) {
      setActionStatus({ type: 'error', message: copy.account.roles.linkPermissionNeeded });
      return;
    }

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
  const selectedEdgeTargetNode = selectedEdge ? nodes.find((node) => node.id === selectedEdge.target) ?? null : null;
  const selectedEdgeSourceNode = selectedEdge ? nodes.find((node) => node.id === selectedEdge.source) ?? null : null;
  const selectedEdgeCanDelete = Boolean(selectedEdgeTargetNode?.data.canLink || selectedEdgeSourceNode?.data.canLink);
  const selectedRoleCanWrite = selectedNode?.data.nodeType === 'data' || selectedNode?.data.nodeType === 'key'
    ? Boolean(selectedNode.data.canWrite)
    : selectedRoleNode?.data.canWrite ?? false;
  const selectedRoleCanLink = selectedNode?.data.nodeType === 'data' || selectedNode?.data.nodeType === 'key'
    ? Boolean(selectedNode.data.canLink)
    : selectedRoleNode?.data.canLink ?? false;
  const selectedRecoveryPlanId =
    selectedNode?.data.nodeType === 'recovery_plan' ? selectedNode.id.replace('recovery-plan:', '') : null;
  const selectedRecoveryCanLink = selectedNode?.data.nodeType?.startsWith('recovery') ? Boolean(selectedNode.data.canLink) : false;
  const selectedRecoveryHasShares =
    selectedNode?.data.nodeType === 'recovery_plan'
      ? edges.some((edge) => edge.target === selectedNode.id && edge.data?.relationType === 'Owner')
      : false;
  const selectedRecoveryNeedsShares = selectedNode?.data.nodeType === 'recovery_plan' && !selectedRecoveryHasShares;
  const selectedRecoveryIsDraft = Boolean(selectedNode?.data.recoveryDraft);
  const selectedDataOwner =
    selectedNode?.data.nodeType === 'data' && selectedNode.data.roleId
      ? nodes.find((node) => node.id === `role:${selectedNode.data.roleId.replace(/-/g, '')}`) ?? null
      : null;
  const contextNode = contextMenu?.nodeId ? nodes.find((node) => node.id === contextMenu.nodeId) ?? null : null;
  const contextNodeCanWrite = contextNode?.data.canWrite ?? false;
  const contextNodeCanLink = contextNode?.data.canLink ?? false;

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
  }, [createOwnerId, selectedNode]);

  useEffect(() => {
    if (search.trim() === '') return;
    const normalized = search.trim().toLowerCase();
    const matches = searchIndex.filter((entry) => entry.label.toLowerCase().includes(normalized) || entry.id.toLowerCase().includes(normalized));
    if (matches.length === 0) return;
    const match = matches[0];
    setSelectedNodeId(match.id);
    setSelectedEdgeId(null);
  }, [search, searchIndex]);

  const handleCreateRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!createOwnerId || !newRoleNick.trim() || !newRoleKind.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.createRoleError });
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.createRoleWorking });
    const parentNodeId = createOwnerId;
    const relationType = 'Owner';
    try {
      await issueCsrf();
      const response = await createRole({
        parentRoleId: stripRoleId(parentNodeId),
        relationshipType: relationType,
        fields: [
          { fieldType: 'nick', plainValue: newRoleNick.trim() },
          { fieldType: 'role_kind', plainValue: newRoleKind.trim() }
        ]
      });
      const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
      const newNodeId = `role:${response.roleId.replace(/-/g, '')}`;
      const parentNode = nodes.find((node) => node.id === parentNodeId);
      const parentChildren = edges.filter((edge) => edge.source === parentNodeId);
      const position = parentNode
        ? { x: parentNode.position.x + 300, y: parentNode.position.y + parentChildren.length * 110 }
        : { x: 300, y: 200 };
      const allowsWrite = relationType !== 'Read';
      setNodes((prev) =>
        prev
          .map((node) => {
            if (node.id !== parentNodeId) return node;
            const nextOutgoing = [...new Set([...node.data.outgoingTypes, relationType])];
            return {
              ...node,
              data: {
                ...node.data,
                outgoingTypes: nextOutgoing
              }
            };
          })
          .concat({
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
              canLink: true,
              canWrite: allowsWrite,
              incomingTypes: [relationType],
              outgoingTypes: [],
              typeColors
            }
          })
      );

      setEdges((prev) =>
        prev.concat({
          id: `${stripRoleId(parentNodeId)}:${response.roleId.replace(/-/g, '')}:${relationType}`,
          source: parentNodeId,
          target: newNodeId,
          sourceHandle: `out-${relationType}`,
          targetHandle: `in-${relationType}`,
          type: 'role',
          data: {
            relationType: relationType,
            color: typeColors[relationType] ?? DEFAULT_RELATION_COLOR
          }
        })
      );

      setFilters((prev) => ({ ...prev, [relationType]: prev[relationType] ?? true }));
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
    if (!selectedRoleId || !selectedRoleCanLink) return;
    if (!newFieldType.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.dataAddError });
      return;
    }
    if (newDataKind === 'data' && !newFieldValue.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.dataAddError });
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.dataAddWorking });
    try {
      await issueCsrf();
      const response = await createDataItem(selectedRoleId, {
        itemName: newFieldType.trim(),
        itemType: newDataKind,
        plainValue: newFieldValue.trim() || null
      });
      const roleNodeId = `role:${selectedRoleId.replace(/-/g, '')}`;
      const nodePrefix = response.itemType === 'key' ? 'key' : 'data';
      const dataNodeId = `${nodePrefix}:${response.dataItemId.replace(/-/g, '')}`;
      const accessType = 'Owner';
      const edgeId = `${selectedRoleId.replace(/-/g, '')}:${response.dataItemId.replace(/-/g, '')}:${accessType}`;
      const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
      setNodes((prev) => {
        const roleNode = prev.find((node) => node.id === roleNodeId);
        const dataCount = prev.filter((node) => node.data.nodeType === nodePrefix && node.data.roleId === selectedRoleId).length;
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
                    label: response.itemName,
                    kind: response.itemType,
                    value: response.plainValue ?? null,
                    fieldType: response.itemName,
                    dataKeyId: response.dataItemId
                  }
                }
              : node
          );
        }
        return prev.concat({
          id: dataNodeId,
          type: nodePrefix,
          position,
          data: {
            label: response.itemName,
            kind: response.itemType,
            nodeType: nodePrefix,
            value: response.plainValue ?? null,
            roleId: selectedRoleId,
            fieldType: response.itemName,
            dataKeyId: response.dataItemId,
            canLink: true,
            canWrite: true,
            incomingTypes: [accessType],
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
        const handles = getEdgeHandles(accessType);
        return prev.concat({
          id: edgeId,
          source: roleNodeId,
          target: dataNodeId,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'role',
          data: {
            relationType: accessType,
            color: typeColors[accessType] ?? DEFAULT_RELATION_COLOR
          }
        });
      });
      setSearchIndex((prev) => {
        const exists = prev.some((entry) => entry.id === dataNodeId);
        if (exists) {
          return prev.map((entry) =>
            entry.id === dataNodeId
              ? { ...entry, label: response.itemName, value: response.plainValue ?? null }
              : entry
          );
        }
        return prev.concat({ id: dataNodeId, label: response.itemName, value: response.plainValue ?? null });
      });
      setSelectedNodeId(dataNodeId);
      setNewFieldType('');
      setNewFieldValue('');
      setNewDataKind('data');
      setActionStatus({ type: 'success', message: copy.account.roles.dataAddSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataAddError) });
    }
  };

  const handleUpdateField = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedNode || selectedNode.data.nodeType !== 'data') return;
    if (!dataValue.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.dataEditError });
      return;
    }
    const dataItemId = selectedNode.id.replace(/^data:/, '');
    setActionStatus({ type: 'working', message: copy.account.roles.dataEditWorking });
    try {
      await issueCsrf();
      const response = await updateDataItem(dataItemId, {
        plainValue: dataValue.trim()
      });
      const nodePrefix = selectedNode.data.nodeType === 'key' ? 'key' : 'data';
      const dataNodeId = `${nodePrefix}:${response.dataItemId.replace(/-/g, '')}`;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === dataNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: response.itemName,
                  kind: response.itemType,
                  value: response.plainValue ?? null,
                  fieldType: response.itemName,
                  dataKeyId: response.dataItemId
                }
              }
            : node
        )
      );
      setSearchIndex((prev) =>
        prev.map((entry) =>
          entry.id === dataNodeId ? { ...entry, label: response.itemName, value: response.plainValue ?? null } : entry
        )
      );
      setActionStatus({ type: 'success', message: copy.account.roles.dataEditSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataEditError) });
    }
  };

  const handleDeleteField = async () => {
    if (!selectedNode || (selectedNode.data.nodeType !== 'data' && selectedNode.data.nodeType !== 'key')) return;
    const dataItemId = selectedNode.id.replace(/^data:|^key:/, '');
    if (!dataItemId) return;
    setActionStatus({ type: 'working', message: copy.account.roles.dataDeleteWorking });
    try {
      await issueCsrf();
      await deleteDataItem(dataItemId);
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

  const handleShareRole = async (event: React.FormEvent) => {
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

  const handleShareData = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedNode || (selectedNode.data.nodeType !== 'data' && selectedNode.data.nodeType !== 'key')) {
      return;
    }
    if (!shareDataTargetRoleId.trim()) {
      setActionStatus({ type: 'error', message: copy.account.roles.dataShareError });
      return;
    }
    const dataItemId = selectedNode.id.replace(/^data:|^key:/, '');
    setActionStatus({ type: 'working', message: copy.account.roles.dataShareWorking });
    try {
      await issueCsrf();
      await shareDataItem(dataItemId, {
        targetRoleId: stripRoleId(shareDataTargetRoleId.trim()),
        permissionType: shareDataPermission
      });
      await loadGraph();
      setShareDataTargetRoleId('');
      setActionStatus({ type: 'success', message: copy.account.roles.dataShareSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.dataShareError) });
    }
  };

  const handleLoadPendingDataShares = async () => {
    setPendingDataState('working');
    try {
      const response = await getPendingDataShares();
      setPendingDataShares(response);
      setPendingDataState('idle');
    } catch {
      setPendingDataState('error');
    }
  };

  const handleAcceptDataShare = async (shareId: string) => {
    setPendingDataState('working');
    try {
      await issueCsrf();
      await acceptDataShare(shareId, {});
      await loadGraph();
      setPendingDataShares((prev) => prev.filter((share) => share.shareId !== shareId));
      setPendingDataState('idle');
    } catch {
      setPendingDataState('error');
    }
  };

  const handlePrepareRecovery = async (roleId: string) => {
    setActionStatus({ type: 'working', message: copy.account.roles.recoveryPrepareWorking });
    const roleNodeId = `role:${roleId.replace(/-/g, '')}`;
    const planNodeId = buildDraftId();
    const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
    const roleNode = nodes.find((node) => node.id === roleNodeId);
    const position = roleNode
      ? { x: roleNode.position.x + 260, y: roleNode.position.y - 120 }
      : { x: 320, y: 200 };

    setNodes((prev) =>
      prev.concat({
        id: planNodeId,
        type: 'recovery_plan',
        position,
        data: {
          label: copy.account.roles.recoveryPlanLabel,
          kind: 'RecoveryKey',
          nodeType: 'recovery_plan',
          value: null,
          roleId,
          fieldType: null,
          dataKeyId: null,
          canLink: true,
          canWrite: false,
          incomingTypes: [],
          outgoingTypes: [],
          typeColors,
          recoveryDraft: true
        }
      })
    );
    setRecoveryDrafts((prev) => ({
      ...prev,
      [planNodeId]: {
        targetRoleId: roleId,
        sharedRoleIds: []
      }
    }));
    setSelectedNodeId(planNodeId);
    setActionStatus({ type: 'success', message: copy.account.roles.recoveryPrepareSuccess });
  };

  const handleActivateRecovery = async (planId: string) => {
    const plan = recoveryDrafts[planId];
    if (!plan) {
      setActionStatus({ type: 'error', message: copy.account.roles.recoveryPlanError });
      return;
    }
    if (!plan.sharedRoleIds.length) {
      setActionStatus({ type: 'error', message: copy.account.roles.recoveryPlanNeedsShares });
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.recoveryActivateWorking });
    try {
      await issueCsrf();
      await activateRecoveryKey(plan.targetRoleId, {
        sharedRoleIds: plan.sharedRoleIds
      });
      setNodes((prev) => prev.filter((node) => node.id !== planId));
      setEdges((prev) => prev.filter((edge) => edge.target !== planId && edge.source !== planId));
      setRecoveryDrafts((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      await loadGraph();
      setActionStatus({ type: 'success', message: copy.account.roles.recoveryActivateSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.recoveryActivateError) });
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

  const handleDeleteEdge = async () => {
    if (!selectedEdge) {
      return;
    }
    const parentRoleId = stripRoleId(selectedEdge.source);
    const childRoleId = stripRoleId(selectedEdge.target);
    setActionStatus({ type: 'working', message: copy.account.roles.edgeDeleteWorking });
    try {
      await issueCsrf();
      await deleteRoleParent(childRoleId, parentRoleId);
      setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdge.id));
      setActionStatus({ type: 'success', message: copy.account.roles.edgeDeleteSuccess });
    } catch (error) {
      setActionStatus({ type: 'error', message: formatApiError(error, copy.account.roles.edgeDeleteError) });
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

  const handleContextAddRole = () => {
    const trimmed = contextRoleId.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.replace(/^role:/i, '').trim();
    const nodeId = `role:${normalized.replace(/-/g, '')}`;
    const node = nodes.find((item) => item.id === nodeId);
    if (node) {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setContextMenu(null);
      setContextRoleId('');
      return;
    }
    setActionStatus({ type: 'working', message: copy.account.roles.contextAddRoleWorking });
    lookupRole(normalized)
      .then((lookup) => {
        const typeColors = nodes[0]?.data.typeColors ?? { ...RELATION_COLORS };
        setNodes((prev) =>
          prev.concat({
            id: lookup.id,
            type: lookup.nodeType,
            position: { x: 140, y: 140 },
            data: {
              label: lookup.label,
              kind: lookup.kind,
              nodeType: lookup.nodeType,
              value: null,
              roleId: lookup.roleId,
              fieldType: null,
              dataKeyId: null,
              canLink: lookup.canLink,
              canWrite: lookup.canWrite,
              incomingTypes: [],
              outgoingTypes: [],
              typeColors
            }
          })
        );
        setSelectedNodeId(lookup.id);
        setSelectedEdgeId(null);
        setContextMenu(null);
        setContextRoleId('');
        setActionStatus({ type: 'success', message: copy.account.roles.contextAddRoleSuccess });
      })
      .catch(() => {
        setActionStatus({ type: 'error', message: copy.account.roles.contextAddRoleError });
      });
  };

  const panelState = {
    selectedNode,
    selectedEdge,
    selectedEdgeCanDelete,
    pendingLink,
    actionStatus,
    selectedRoleId,
    selectedRoleCanWrite,
    selectedRoleCanLink,
    selectedRecoveryPlanId,
    selectedRecoveryCanLink,
    selectedRecoveryHasShares,
    selectedRecoveryNeedsShares,
    selectedDataOwner,
    createOwnerId,
    pendingShares,
    pendingState,
    pendingDataShares,
    pendingDataState,
    parents,
    parentsState,
    verification,
    verificationState,
    edges
  };

  const panelForm = {
    newRoleNick,
    newRoleKind,
    newDataKind,
    newFieldType,
    newFieldValue,
    shareTargetRoleId,
    shareRelationType,
    shareDataTargetRoleId,
    shareDataPermission,
    dataValue
  };

  const panelSetters = {
    setNewRoleNick,
    setNewRoleKind,
    setNewDataKind,
    setNewFieldType,
    setNewFieldValue,
    setShareTargetRoleId,
    setShareRelationType,
    setShareDataTargetRoleId,
    setShareDataPermission,
    setDataValue
  };

  const panelHandlers = {
    onStartCreateRole: (ownerId: string) => {
      setCreateOwnerId(ownerId);
      setPendingLink(null);
    },
    onCancelCreateRole: () => setCreateOwnerId(null),
    onCreateRole: handleCreateRole,
    onAddField: handleAddField,
    onShareRole: handleShareRole,
    onShareData: handleShareData,
    onPrepareRecovery: handlePrepareRecovery,
    onActivateRecovery: handleActivateRecovery,
    onLoadPendingShares: handleLoadPendingShares,
    onAcceptShare: handleAcceptShare,
    onLoadPendingDataShares: handleLoadPendingDataShares,
    onAcceptDataShare: handleAcceptDataShare,
    onLoadParents: handleLoadParents,
    onDeleteParent: handleDeleteParent,
    onDeleteEdge: handleDeleteEdge,
    onVerifyRole: handleVerifyRole,
    onUpdateField: handleUpdateField,
    onDeleteField: handleDeleteField
  };

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    nodeTypes,
    edgeTypes,
    onNodesChange,
    onEdgesChange,
    loading,
    search,
    setSearch,
    showReachable,
    setShowReachable,
    isFullscreen,
    setIsFullscreen,
    isCompact,
    compactView,
    setCompactView,
    filters,
    setFilters,
    contextMenu,
    setContextMenu,
    contextRoleId,
    setContextRoleId,
    contextNode,
    contextNodeCanWrite,
    contextNodeCanLink,
    handleContextAddRole,
    handlePrepareRecovery,
    handleConnect,
    isValidConnection,
    panelState,
    panelForm,
    panelSetters,
    panelHandlers,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNodeId,
    setSelectedEdgeId
  };
}
