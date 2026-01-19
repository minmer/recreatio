export type RoleNodeData = {
  label: string;
  kind?: string | null;
  nodeType: string;
  value?: string | null;
  roleId?: string | null;
  fieldType?: string | null;
  dataKeyId?: string | null;
  recoveryDraft?: boolean;
  canLink?: boolean;
  canWrite?: boolean;
  incomingTypes: string[];
  outgoingTypes: string[];
  typeColors: Record<string, string>;
};

export type RoleEdgeData = {
  relationType: string;
  color: string;
};

export type PendingLink = {
  sourceId: string;
  targetId: string;
  relationType: string;
};

export type ActionStatus = {
  type: 'idle' | 'working' | 'success' | 'error';
  message?: string;
};
