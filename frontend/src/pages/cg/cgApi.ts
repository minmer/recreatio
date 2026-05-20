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

export type CgLibraryResponse = {
  id: number;
  name: string;
  createdUtc: string;
  updatedUtc: string;
};

export type CgTypeDefResponse = {
  id: number;
  name: string;
  fieldCount: number;
  createdUtc: string;
  updatedUtc: string;
};

export type CgFieldDefResponse = {
  id: number;
  label: string;
  sortOrder: number;
  inputType: string;
  multiple: boolean;
  isOrdered: boolean;
  targetTypeDefIds: number[];
};

export type CgTypeDefDetailResponse = {
  id: number;
  name: string;
  fields: CgFieldDefResponse[];
  createdUtc: string;
  updatedUtc: string;
};

export type CgTypeDeleteConflictEntry = {
  fieldDefId: number;
  fieldLabel: string;
  typeDefId: number;
  typeDefName: string;
};

export type CgTypeDeleteConflictResponse = {
  references: CgTypeDeleteConflictEntry[];
};

export type CgFieldDefSaveItem = {
  id?: number;
  label: string;
  inputType: string;
  multiple: boolean;
  isOrdered: boolean;
  targetTypeDefIds: number[];
};

export const getCgLibraries = () =>
  req<CgLibraryResponse[]>('/cg/libraries', { method: 'GET' });

export const createCgLibrary = (name: string) =>
  req<CgLibraryResponse>('/cg/libraries', { method: 'POST', body: JSON.stringify({ name }) });

export const renameCgLibrary = (id: number, name: string) =>
  req<void>(`/cg/libraries/${id}/name`, { method: 'PUT', body: JSON.stringify({ name }) });

export const deleteCgLibrary = (id: number) =>
  req<void>(`/cg/libraries/${id}`, { method: 'DELETE' });

export const getCgTypeDefs = (libId: number) =>
  req<CgTypeDefResponse[]>(`/cg/libraries/${libId}/types`, { method: 'GET' });

export const createCgTypeDef = (libId: number, name: string) =>
  req<CgTypeDefResponse>(`/cg/libraries/${libId}/types`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });

export const getCgTypeDefDetail = (libId: number, typeId: number) =>
  req<CgTypeDefDetailResponse>(`/cg/libraries/${libId}/types/${typeId}`, { method: 'GET' });

export const renameCgTypeDef = (libId: number, typeId: number, name: string) =>
  req<void>(`/cg/libraries/${libId}/types/${typeId}/name`, {
    method: 'PUT',
    body: JSON.stringify({ name })
  });

export const deleteCgTypeDef = (libId: number, typeId: number, force = false) =>
  req<void | CgTypeDeleteConflictResponse>(
    `/cg/libraries/${libId}/types/${typeId}${force ? '?force=true' : ''}`,
    { method: 'DELETE' }
  );

export const saveCgFields = (libId: number, typeId: number, fields: CgFieldDefSaveItem[]) =>
  req<CgTypeDefDetailResponse>(`/cg/libraries/${libId}/types/${typeId}/fields`, {
    method: 'PUT',
    body: JSON.stringify({ fields })
  });

// ── Entity types ──────────────────────────────────────────────────────────────

export type CgEntityValueResponse = {
  id: number;
  sortOrder: number;
  plainValue: string | null;
  refEntityId: number | null;
  refDisplayValue: string | null;
  refTypeDefId: number | null;
  refTypeDefName: string | null;
};

export type CgEntityFieldResponse = {
  fieldDefId: number;
  label: string;
  inputType: string;
  multiple: boolean;
  isOrdered: boolean;
  values: CgEntityValueResponse[];
};

export type CgEntityDetailResponse = {
  id: number;
  typeDefId: number;
  typeDefName: string;
  fields: CgEntityFieldResponse[];
  createdUtc: string;
  updatedUtc: string;
};

export type CgEntityListItem = {
  id: number;
  displayValue: string;
  createdUtc: string;
  updatedUtc: string;
};

export type CgEntitySearchItem = {
  id: number;
  displayValue: string;
  typeDefId: number;
  typeDefName: string;
};

export type CgEntityValueSaveItem = {
  fieldDefId: number;
  sortOrder: number;
  plainValue: string | null;
  refEntityId: number | null;
};

// ── Entity API functions ───────────────────────────────────────────────────────

export const getCgEntities = (libId: number, typeId: number, skip = 0, limit = 50) =>
  req<CgEntityListItem[]>(
    `/cg/libraries/${libId}/types/${typeId}/entities?skip=${skip}&limit=${limit}`,
    { method: 'GET' }
  );

export const createCgEntity = (libId: number, typeId: number, values: CgEntityValueSaveItem[]) =>
  req<CgEntityDetailResponse>(`/cg/libraries/${libId}/types/${typeId}/entities`, {
    method: 'POST',
    body: JSON.stringify({ values })
  });

export const getCgEntityDetail = (libId: number, entityId: number) =>
  req<CgEntityDetailResponse>(`/cg/libraries/${libId}/entities/${entityId}`, { method: 'GET' });

export const updateCgEntity = (libId: number, entityId: number, values: CgEntityValueSaveItem[]) =>
  req<CgEntityDetailResponse>(`/cg/libraries/${libId}/entities/${entityId}`, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });

export const deleteCgEntity = (libId: number, entityId: number) =>
  req<void>(`/cg/libraries/${libId}/entities/${entityId}`, { method: 'DELETE' });

export const searchCgEntities = (
  libId: number,
  term: string,
  typeIds?: number[],
  limit = 20
) => {
  const params = new URLSearchParams({ term, limit: String(limit) });
  if (typeIds && typeIds.length > 0) params.set('typeIds', typeIds.join(','));
  return req<CgEntitySearchItem[]>(`/cg/libraries/${libId}/entities/search?${params}`, {
    method: 'GET'
  });
};

export const resolveCgEntities = (libId: number, entityIds: number[]) =>
  req<CgEntitySearchItem[]>(`/cg/libraries/${libId}/entities/resolve`, {
    method: 'POST',
    body: JSON.stringify({ entityIds })
  });
