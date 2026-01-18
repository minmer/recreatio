import type { RoleGraphEdge, RoleGraphNode } from '../../lib/api';

export const defaultLayout = (nodes: RoleGraphNode[], edges: RoleGraphEdge[]) => {
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

  const xStart = 140;
  const xStep = 424;
  const yStart = 140;
  const yStep = 200;
  const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);
  sortedDepths.forEach((level) => {
    const group = depthGroups.get(level) ?? [];
    group.forEach((nodeId, index) => {
      positions[nodeId] = {
        x: xStart + level * xStep,
        y: yStart + index * yStep
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
        x: base.x + 272,
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
          x: base.x + 252,
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
        x: base.x + 252,
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
