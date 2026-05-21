import { ApiError } from '../../lib/api';

export { ApiError };

const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function req<T>(path: string, options: RequestInit): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
      ...(options.headers ?? {})
    }
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type CgTemplateListItem = {
  id: number;
  name: string;
  nodeCount: number;
  createdUtc: string;
  updatedUtc: string;
};

export type CgTemplateNodeResponse = {
  id: number;
  nodeKey: string;
  nodeType: string;
  configJson: string;
  positionX: number;
  positionY: number;
};

export type CgTemplateEdgeResponse = {
  id: number;
  edgeKey: string;
  sourceKey: string;
  targetKey: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

export type CgTemplateGraphResponse = {
  id: number;
  name: string;
  nodes: CgTemplateNodeResponse[];
  edges: CgTemplateEdgeResponse[];
  createdUtc: string;
  updatedUtc: string;
};

export type CgTemplateNodeSaveItem = {
  nodeKey: string;
  nodeType: string;
  configJson: string;
  positionX: number;
  positionY: number;
};

export type CgTemplateEdgeSaveItem = {
  edgeKey: string;
  sourceKey: string;
  targetKey: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

export type CgQuizStimulus = {
  label: string;
  values: string[];
};

export type CgQuizQuestion = {
  templateId: number;
  templateName: string;
  entityId: number;
  stimulus: CgQuizStimulus[];
  answerType: string;
  answerConfigJson: string;
  expected: string[];
  distractors: string[];
};

// ── API functions ─────────────────────────────────────────────────────────────

export function getCgTemplates(libId: number, typeId: number): Promise<CgTemplateListItem[]> {
  return req(`/cg/libraries/${libId}/types/${typeId}/templates`, { method: 'GET' });
}

export function createCgTemplate(libId: number, typeId: number, name: string): Promise<CgTemplateListItem> {
  return req(`/cg/libraries/${libId}/types/${typeId}/templates`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export function getCgTemplate(libId: number, typeId: number, graphId: number): Promise<CgTemplateGraphResponse> {
  return req(`/cg/libraries/${libId}/types/${typeId}/templates/${graphId}`, { method: 'GET' });
}

export function saveCgTemplate(
  libId: number,
  typeId: number,
  graphId: number,
  name: string,
  nodes: CgTemplateNodeSaveItem[],
  edges: CgTemplateEdgeSaveItem[]
): Promise<void> {
  return req(`/cg/libraries/${libId}/types/${typeId}/templates/${graphId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, nodes, edges })
  });
}

export function deleteCgTemplate(libId: number, typeId: number, graphId: number): Promise<void> {
  return req(`/cg/libraries/${libId}/types/${typeId}/templates/${graphId}`, { method: 'DELETE' });
}

export function generateCgQuiz(
  libId: number,
  typeId: number,
  graphId: number,
  entityId: number
): Promise<CgQuizQuestion> {
  return req(`/cg/libraries/${libId}/types/${typeId}/templates/${graphId}/quiz`, {
    method: 'POST',
    body: JSON.stringify({ entityId })
  });
}
