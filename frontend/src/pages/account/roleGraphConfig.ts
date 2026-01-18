import type { RoleGraphEdge } from '../../lib/api';

export const RELATION_TYPES = ['Owner', 'AdminOf', 'Write', 'Read', 'MemberOf', 'DelegatedTo'] as const;

export const RELATION_COLORS: Record<string, string> = {
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

export const DEFAULT_RELATION_COLOR = '#374151';

export const LEGEND_ENTRIES = [
  'Owner',
  'AdminOf',
  'Write',
  'Read',
  'MemberOf',
  'DelegatedTo',
  'Data',
  'RecoveryOwner',
  'RecoveryShare',
  'RecoveryAccess'
] as const;

export const AUX_HANDLE_IN = 'aux-in';
export const AUX_HANDLE_OUT = 'aux-out';

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
  return { sourceHandle: AUX_HANDLE_OUT, targetHandle: AUX_HANDLE_IN };
};
