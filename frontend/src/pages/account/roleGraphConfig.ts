import type { RoleGraphEdge } from '../../lib/api';

export const RELATION_TYPES = ['Owner', 'Write', 'Read'] as const;

export const RELATION_COLORS: Record<string, string> = {
  Owner: '#1d4ed8',
  Write: '#dc2626',
  Read: '#0284c7',
  Data: '#6b7280',
  RecoveryOwner: '#0f766e',
  RecoveryAccess: '#8b5cf6',
  link: '#374151'
};

export const DEFAULT_RELATION_COLOR = '#374151';

export const LEGEND_ENTRIES = [
  'Owner',
  'Write',
  'Read',
  'Data',
  'RecoveryOwner',
  'RecoveryAccess'
] as const;

export const AUX_HANDLE_IN = 'aux-in';
export const AUX_HANDLE_OUT = 'aux-out';
export const RECOVERY_HANDLE_IN = 'recovery-in';
export const RECOVERY_HANDLE_OUT = 'recovery-out';

export const buildTypeColors = (edges: RoleGraphEdge[]) => {
  const colors: Record<string, string> = { ...RELATION_COLORS };
  edges.forEach((edge) => {
    if (!colors[edge.type]) {
      colors[edge.type] = DEFAULT_RELATION_COLOR;
    }
  });
  return colors;
};

export const isRelationType = (type: string) => RELATION_TYPES.includes(type as (typeof RELATION_TYPES)[number]);

export const getEdgeHandles = (type: string) => {
  if (isRelationType(type)) {
    return { sourceHandle: `out-${type}`, targetHandle: `in-${type}` };
  }
  if (type === 'RecoveryOwner') {
    return { sourceHandle: `out-${RELATION_TYPES[0]}`, targetHandle: RECOVERY_HANDLE_IN };
  }
  if (type === 'RecoveryAccess') {
    return { sourceHandle: RECOVERY_HANDLE_OUT, targetHandle: `in-${RELATION_TYPES[0]}` };
  }
  return { sourceHandle: AUX_HANDLE_OUT, targetHandle: AUX_HANDLE_IN };
};
