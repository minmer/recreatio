import { ApiError } from '../../../lib/api';

const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export interface CgLibrary {
  id: string;
  ownerAccountId: string;
  name: string;
  template: 'vocabulary' | 'phonebook' | 'lesson' | 'custom';
  createdUtc: string;
  updatedUtc: string;
}

export interface CgNodeKind {
  id: string;
  libraryId: string;
  name: string;
  isSubentity: boolean;
  sortOrder: number;
  createdUtc: string;
  updatedUtc: string;
}

export interface CgFieldDef {
  id: string;
  nodeKindId: string;
  libraryId: string;
  fieldName: string;
  fieldType: 'Text' | 'Number' | 'Date' | 'Boolean' | 'Media' | 'Ref';
  refNodeKindId: string | null;
  isMultiValue: boolean;
  isRangeCapable: boolean;
  sortOrder: number;
  createdUtc: string;
}

export interface CgNode {
  id: string;
  libraryId: string;
  nodeType: 'Entity' | 'Knowledge' | 'Text' | 'Topic' | 'Question';
  nodeKindId: string | null;
  parentNodeId: string | null;
  label: string | null;
  bodyJson: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface CgFieldValue {
  id: string;
  nodeId: string;
  fieldDefId: string;
  textValue: string | null;
  numberValue: number | null;
  dateValue: string | null;
  boolValue: boolean | null;
  refNodeId: string | null;
  pvState: string | null;
  pvNote: string | null;
  sortOrder: number;
  createdUtc: string;
}

export interface CgEdge {
  id: string;
  libraryId: string;
  edgeKindId: string | null;
  sourceNodeId: string;
  targetNodeId: string;
  pvState: string | null;
  pvNote: string | null;
  sortOrder: number;
  createdUtc: string;
}

export interface CgLibraryDetail {
  library: CgLibrary;
  nodeKinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];
  nodeCount: number;
}

export interface CgNodeDetail {
  node: CgNode;
  fieldValues: CgFieldValue[];
  outEdges: CgEdge[];
  inEdges: CgEdge[];
}

// Libraries
export const listLibraries = () => request<CgLibrary[]>('/cg/libraries');

export const createLibrary = (name: string, template: string) =>
  request<CgLibrary>('/cg/libraries', { method: 'POST', body: JSON.stringify({ name, template }) });

export const getLibrary = (libId: string) =>
  request<CgLibraryDetail>(`/cg/libraries/${libId}`);

export const updateLibrary = (libId: string, name: string) =>
  request<CgLibrary>(`/cg/libraries/${libId}`, { method: 'PUT', body: JSON.stringify({ name }) });

export const deleteLibrary = (libId: string) =>
  request<{ deleted: boolean }>(`/cg/libraries/${libId}`, { method: 'DELETE' });

// Node Kinds
export const listNodeKinds = (libId: string) =>
  request<CgNodeKind[]>(`/cg/libraries/${libId}/node-kinds`);

export const createNodeKind = (libId: string, name: string, isSubentity = false, sortOrder = 0) =>
  request<CgNodeKind>(`/cg/libraries/${libId}/node-kinds`, {
    method: 'POST',
    body: JSON.stringify({ name, isSubentity, sortOrder }),
  });

export const updateNodeKind = (libId: string, kindId: string, name: string, isSubentity: boolean, sortOrder: number) =>
  request<CgNodeKind>(`/cg/libraries/${libId}/node-kinds/${kindId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, isSubentity, sortOrder }),
  });

export const deleteNodeKind = (libId: string, kindId: string) =>
  request<{ deleted: boolean }>(`/cg/libraries/${libId}/node-kinds/${kindId}`, { method: 'DELETE' });

// Field Defs
export const listFieldDefs = (libId: string, kindId: string) =>
  request<CgFieldDef[]>(`/cg/libraries/${libId}/node-kinds/${kindId}/field-defs`);

export const createFieldDef = (
  libId: string, kindId: string,
  fieldName: string, fieldType: string,
  isMultiValue = false, isRangeCapable = false, sortOrder = 0,
  refNodeKindId?: string,
) =>
  request<CgFieldDef>(`/cg/libraries/${libId}/node-kinds/${kindId}/field-defs`, {
    method: 'POST',
    body: JSON.stringify({ fieldName, fieldType, isMultiValue, isRangeCapable, sortOrder, refNodeKindId }),
  });

export const deleteFieldDef = (libId: string, kindId: string, defId: string) =>
  request<{ deleted: boolean }>(`/cg/libraries/${libId}/node-kinds/${kindId}/field-defs/${defId}`, { method: 'DELETE' });

// Nodes
export const listNodes = (libId: string, params?: { q?: string; nodeType?: string; kindId?: string; limit?: number }) => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.nodeType) qs.set('nodeType', params.nodeType);
  if (params?.kindId) qs.set('kindId', params.kindId);
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs}` : '';
  return request<CgNode[]>(`/cg/libraries/${libId}/nodes${query}`);
};

export const createNode = (libId: string, body: {
  nodeType?: string; nodeKindId?: string; parentNodeId?: string; label?: string; bodyJson?: string;
}) =>
  request<CgNode>(`/cg/libraries/${libId}/nodes`, { method: 'POST', body: JSON.stringify(body) });

export const getNode = (libId: string, nodeId: string) =>
  request<CgNodeDetail>(`/cg/libraries/${libId}/nodes/${nodeId}`);

export const updateNode = (libId: string, nodeId: string, label?: string, bodyJson?: string) =>
  request<CgNode>(`/cg/libraries/${libId}/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify({ label, bodyJson }),
  });

export const deleteNode = (libId: string, nodeId: string) =>
  request<{ deleted: boolean }>(`/cg/libraries/${libId}/nodes/${nodeId}`, { method: 'DELETE' });

// Field Values
export const upsertFieldValue = (libId: string, nodeId: string, body: {
  fieldDefId: string; textValue?: string; numberValue?: number; dateValue?: string;
  boolValue?: boolean; refNodeId?: string; pvState?: string; pvNote?: string; sortOrder?: number;
}) =>
  request<CgFieldValue[]>(`/cg/libraries/${libId}/nodes/${nodeId}/field-values`, {
    method: 'POST',
    body: JSON.stringify({ ...body, sortOrder: body.sortOrder ?? 0 }),
  });

export const deleteFieldValue = (libId: string, nodeId: string, valueId: string) =>
  request<{ deleted: boolean }>(`/cg/libraries/${libId}/nodes/${nodeId}/field-values/${valueId}`, { method: 'DELETE' });

// Edges
export const listEdges = (libId: string, sourceNodeId?: string) => {
  const qs = sourceNodeId ? `?sourceNodeId=${sourceNodeId}` : '';
  return request<CgEdge[]>(`/cg/libraries/${libId}/edges${qs}`);
};

export const createEdge = (libId: string, sourceNodeId: string, targetNodeId: string, edgeKindId?: string) =>
  request<CgEdge>(`/cg/libraries/${libId}/edges`, {
    method: 'POST',
    body: JSON.stringify({ sourceNodeId, targetNodeId, edgeKindId, sortOrder: 0 }),
  });

export const deleteEdge = (libId: string, edgeId: string) =>
  request<{ deleted: boolean }>(`/cg/libraries/${libId}/edges/${edgeId}`, { method: 'DELETE' });
