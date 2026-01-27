const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';
let csrfTokenCache: string | null = null;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getCsrfToken(): string | null {
  return getCookie('XSRF-TOKEN') ?? csrfTokenCache;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
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

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export function register(payload: {
  loginId: string;
  userSaltBase64: string;
  h3Base64: string;
  displayName?: string | null;
}) {
  return request<{ userId: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      loginId: payload.loginId,
      userSaltBase64: payload.userSaltBase64,
      h3Base64: payload.h3Base64,
      displayName: payload.displayName ?? null
    })
  });
}

export function issueCsrf() {
  return request<{ token: string }>('/auth/csrf', {
    method: 'GET'
  }).then((response) => {
    csrfTokenCache = response.token;
    return response;
  });
}

export function getSalt(loginId: string) {
  const query = new URLSearchParams({ loginId });
  return request<{ userSaltBase64: string }>(`/auth/salt?${query.toString()}`, {
    method: 'GET'
  });
}

export function checkAvailability(loginId: string) {
  const query = new URLSearchParams({ loginId });
  return request<{ isAvailable: boolean }>(`/auth/availability?${query.toString()}`, {
    method: 'GET'
  });
}

export function login(payload: {
  loginId: string;
  h3Base64: string;
  secureMode: boolean;
  deviceInfo?: string | null;
}) {
  return request<{ userId: string; sessionId: string; secureMode: boolean }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      loginId: payload.loginId,
      h3Base64: payload.h3Base64,
      secureMode: payload.secureMode,
      deviceInfo: payload.deviceInfo ?? null
    })
  });
}

export function me() {
  return request<{ userId: string; sessionId: string; isSecureMode: boolean }>('/auth/me', {
    method: 'GET'
  });
}

export function logout() {
  return request<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function setSessionMode(secureMode: boolean) {
  return request<{ sessionId: string; isSecureMode: boolean }>('/auth/session/mode', {
    method: 'POST',
    body: JSON.stringify({ secureMode })
  });
}

export function changePassword(payload: { h3OldBase64: string; h3NewBase64: string }) {
  return request<void>('/auth/password-change', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getProfile() {
  return request<{ loginId: string; displayName?: string | null }>('/account/profile', {
    method: 'GET'
  });
}

export function updateProfile(payload: { displayName?: string | null }) {
  return request<{ loginId: string; displayName?: string | null }>('/account/profile', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type RoleFieldResponse = {
  fieldId: string;
  fieldType: string;
  plainValue?: string | null;
  dataKeyId: string;
};

export type RoleResponse = {
  roleId: string;
  publicSigningKeyBase64?: string | null;
  publicSigningKeyAlg?: string | null;
  fields: RoleFieldResponse[];
};

export type RoleAccessRoleResponse = {
  roleId: string;
  roleKind: string;
  relationshipType: string;
};

export type RoleAccessResponse = {
  roleId: string;
  roles: RoleAccessRoleResponse[];
};

export type PendingRoleShareResponse = {
  shareId: string;
  sourceRoleId: string;
  targetRoleId: string;
  relationshipType: string;
  createdUtc: string;
};

export function getRoles() {
  return request<RoleResponse[]>('/account/roles', {
    method: 'GET'
  });
}

export function createRole(payload: {
  fields: Array<{
    fieldType: string;
    plainValue?: string | null;
    dataKeyId?: string | null;
    signatureBase64?: string | null;
  }>;
  parentRoleId?: string | null;
  relationshipType?: string | null;
  publicSigningKeyBase64?: string | null;
  publicSigningKeyAlg?: string | null;
  signatureBase64?: string | null;
}) {
  return request<RoleResponse>('/account/roles', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateRoleField(roleId: string, payload: {
  fieldType: string;
  plainValue?: string | null;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<RoleFieldResponse>(`/account/roles/${roleId}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteRoleField(roleId: string, fieldId: string) {
  return request<void>(`/account/roles/${roleId}/fields/${fieldId}`, {
    method: 'DELETE'
  });
}

export type DataItemResponse = {
  dataItemId: string;
  itemName: string;
  itemType: string;
  plainValue?: string | null;
};

export function createDataItem(roleId: string, payload: {
  itemName: string;
  itemType?: string | null;
  plainValue?: string | null;
}) {
  return request<DataItemResponse>(`/account/roles/${roleId}/data`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateDataItem(dataItemId: string, payload: { plainValue?: string | null }) {
  return request<DataItemResponse>(`/account/data/${dataItemId}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteDataItem(dataItemId: string) {
  return request<void>(`/account/data/${dataItemId}`, {
    method: 'DELETE'
  });
}

export function shareDataItem(dataItemId: string, payload: {
  targetRoleId: string;
  permissionType: string;
}) {
  return request<void>(`/account/data/${dataItemId}/shares`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type PendingDataShareResponse = {
  shareId: string;
  dataItemId: string;
  sourceRoleId: string;
  targetRoleId: string;
  permissionType: string;
  createdUtc: string;
};

export function getPendingDataShares() {
  return request<PendingDataShareResponse[]>('/account/data/shares', {
    method: 'GET'
  });
}

export function acceptDataShare(shareId: string, payload: { signatureBase64?: string | null }) {
  return request<void>(`/account/data/shares/${shareId}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getRoleAccess(roleId: string) {
  return request<RoleAccessResponse>(`/account/roles/${roleId}/access`, {
    method: 'GET'
  });
}

export function shareRole(roleId: string, payload: {
  targetRoleId: string;
  relationshipType: string;
  signatureBase64?: string | null;
}) {
  return request<void>(`/account/roles/${roleId}/shares`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getPendingRoleShares() {
  return request<PendingRoleShareResponse[]>('/account/shares', {
    method: 'GET'
  });
}

export function acceptRoleShare(shareId: string, payload: { signatureBase64?: string | null }) {
  return request<void>(`/account/shares/${shareId}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type RoleSearchResponse = {
  roleId: string;
  roleKind: string;
  nick: string;
};

export function searchRolesByNick(query: string) {
  const params = new URLSearchParams({ query });
  return request<RoleSearchResponse[]>(`/account/roles/search?${params.toString()}`, { method: 'GET' });
}

export function createRoleEdge(parentRoleId: string, payload: {
  childRoleId: string;
  relationshipType: string;
  signatureBase64?: string | null;
}) {
  return request<void>(`/roles/${parentRoleId}/edges`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type RoleGraphNode = {
  id: string;
  label: string;
  nodeType: string;
  kind?: string | null;
  value?: string | null;
  roleId?: string | null;
  fieldType?: string | null;
  dataKeyId?: string | null;
  canLink?: boolean;
  canWrite?: boolean;
};

export type RoleGraphEdge = {
  id: string;
  sourceRoleId: string;
  targetRoleId: string;
  type: string;
};

export type RoleGraphResponse = {
  nodes: RoleGraphNode[];
  edges: RoleGraphEdge[];
};

export type RoleLookupResponse = {
  id: string;
  label: string;
  kind: string;
  nodeType: string;
  roleId: string;
  canLink: boolean;
  canWrite: boolean;
};

export function getRoleGraph() {
  return request<RoleGraphResponse>('/account/roles/graph', { method: 'GET' });
}

export function lookupRole(roleId: string) {
  return request<RoleLookupResponse>(`/account/roles/${roleId}/lookup`, { method: 'GET' });
}

export type RoleParentLinkResponse = {
  parentRoleId: string;
  relationshipType: string;
};

export type RoleParentsResponse = {
  roleId: string;
  parents: RoleParentLinkResponse[];
};

export function getRoleParents(roleId: string) {
  return request<RoleParentsResponse>(`/account/roles/${roleId}/parents`, { method: 'GET' });
}

export function deleteRoleParent(roleId: string, parentRoleId: string) {
  return request<void>(`/account/roles/${roleId}/parents/${parentRoleId}`, { method: 'DELETE' });
}

export type LedgerVerificationSummary = {
  ledger: string;
  totalEntries: number;
  hashMismatches: number;
  previousHashMismatches: number;
  signaturesVerified: number;
  signaturesMissing: number;
  signaturesInvalid: number;
  roleSignedEntries: number;
  roleInvalidSignatures: number;
};

export type RoleLedgerVerificationResponse = {
  roleId: string;
  ledgers: LedgerVerificationSummary[];
};

export function verifyRoleLedger(roleId: string) {
  return request<RoleLedgerVerificationResponse>(`/account/roles/${roleId}/verify`, { method: 'GET' });
}

export function shareRecovery(roleId: string, payload: {
  sharedWithRoleId: string;
  encryptedShareBase64: string;
  signatureBase64?: string | null;
}) {
  return request<void>(`/account/roles/${roleId}/recovery/shares`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function activateRecoveryKey(roleId: string, payload: { sharedWithRoleIds: string[]; signatureBase64?: string | null }) {
  return request<void>(`/account/roles/${roleId}/recovery/activate`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createRecoveryRequest(roleId: string, payload: { initiatorRoleId: string; signatureBase64?: string | null }) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(`/account/roles/${roleId}/recovery/request`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function approveRecoveryRequest(
  roleId: string,
  requestId: string,
  payload: { approverRoleId: string; encryptedApprovalBase64: string; signatureBase64?: string | null }
) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(
    `/account/roles/${roleId}/recovery/request/${requestId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export function cancelRecoveryRequest(roleId: string, requestId: string) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(
    `/account/roles/${roleId}/recovery/request/${requestId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
}

export function completeRecoveryRequest(roleId: string, requestId: string) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(
    `/account/roles/${roleId}/recovery/request/${requestId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
}

export type CogitaLibrary = {
  libraryId: string;
  roleId: string;
  name: string;
  createdUtc: string;
};

export type CogitaLibraryStats = {
  totalInfos: number;
  totalConnections: number;
  totalGroups: number;
  totalCollections: number;
  totalLanguages: number;
  totalWords: number;
  totalSentences: number;
  totalTopics: number;
};

export type CogitaInfoSearchResult = {
  infoId: string;
  infoType: string;
  label: string;
};

export type CogitaCardSearchResult = {
  cardId: string;
  cardType: string;
  label: string;
  description: string;
  infoType?: string | null;
};

export type CogitaCardSearchBundle = {
  total: number;
  pageSize: number;
  nextCursor?: string | null;
  items: CogitaCardSearchResult[];
};

export type CogitaCollectionSummary = {
  collectionId: string;
  name: string;
  notes?: string | null;
  itemCount: number;
  createdUtc: string;
};

export type CogitaCollectionBundle = {
  total: number;
  pageSize: number;
  nextCursor?: string | null;
  items: CogitaCollectionSummary[];
};

export type CogitaCollectionDetail = {
  collectionId: string;
  name: string;
  notes?: string | null;
  itemCount: number;
  createdUtc: string;
};

export type CogitaCollectionItemRequest = {
  itemType: 'info' | 'connection';
  itemId: string;
};

export type CogitaCollectionCreateResponse = {
  collectionId: string;
};

export type CogitaMockDataResponse = {
  languages: number;
  words: number;
  wordLanguageLinks: number;
  translations: number;
};

export type CogitaInfoCreateResponse = {
  infoId: string;
  infoType: string;
};

export type CogitaConnectionCreateResponse = {
  connectionId: string;
  connectionType: string;
};

export type CogitaGroupCreateResponse = {
  groupType: string;
  infoIds: string[];
  connectionIds: string[];
};

export type CogitaWordLanguageCheck = {
  exists: boolean;
};

export function getCogitaLibraries() {
  return request<CogitaLibrary[]>('/cogita/libraries', {
    method: 'GET'
  });
}

export function createCogitaLibrary(payload: { name: string; signatureBase64?: string | null }) {
  return request<CogitaLibrary>('/cogita/libraries', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function getCogitaLibraryStats(libraryId: string) {
  return request<CogitaLibraryStats>(`/cogita/libraries/${libraryId}/stats`, {
    method: 'GET'
  });
}

export function searchCogitaInfos(payload: { libraryId: string; type?: string; query?: string }) {
  const params = new URLSearchParams();
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  const qs = params.toString();
  return request<CogitaInfoSearchResult[]>(
    `/cogita/libraries/${payload.libraryId}/infos${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function searchCogitaCards(payload: {
  libraryId: string;
  type?: string;
  query?: string;
  limit?: number;
  cursor?: string | null;
  languageAId?: string;
  languageBId?: string;
  topicId?: string;
  levelId?: string;
}) {
  const params = new URLSearchParams();
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  if (payload.limit) params.set('limit', String(payload.limit));
  if (payload.cursor) params.set('cursor', payload.cursor);
  if (payload.languageAId) params.set('languageAId', payload.languageAId);
  if (payload.languageBId) params.set('languageBId', payload.languageBId);
  if (payload.topicId) params.set('topicId', payload.topicId);
  if (payload.levelId) params.set('levelId', payload.levelId);
  const qs = params.toString();
  return request<CogitaCardSearchBundle>(
    `/cogita/libraries/${payload.libraryId}/cards${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function getCogitaCollections(payload: { libraryId: string; query?: string; limit?: number; cursor?: string | null }) {
  const params = new URLSearchParams();
  if (payload.query) params.set('query', payload.query);
  if (payload.limit) params.set('limit', String(payload.limit));
  if (payload.cursor) params.set('cursor', payload.cursor);
  const qs = params.toString();
  return request<CogitaCollectionBundle>(
    `/cogita/libraries/${payload.libraryId}/collections${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function getCogitaCollection(libraryId: string, collectionId: string) {
  return request<CogitaCollectionDetail>(`/cogita/libraries/${libraryId}/collections/${collectionId}`, {
    method: 'GET'
  });
}

export function getCogitaCollectionCards(payload: { libraryId: string; collectionId: string; limit?: number; cursor?: string | null }) {
  const params = new URLSearchParams();
  if (payload.limit) params.set('limit', String(payload.limit));
  if (payload.cursor) params.set('cursor', payload.cursor);
  const qs = params.toString();
  return request<CogitaCardSearchBundle>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/cards${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function createCogitaInfo(payload: {
  libraryId: string;
  infoType: string;
  dataKeyId?: string | null;
  payload: unknown;
  signatureBase64?: string | null;
}) {
  return request<CogitaInfoCreateResponse>(`/cogita/libraries/${payload.libraryId}/infos`, {
    method: 'POST',
    body: JSON.stringify({
      infoType: payload.infoType,
      payload: payload.payload,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function createCogitaConnection(payload: {
  libraryId: string;
  connectionType: string;
  infoIds: string[];
  dataKeyId?: string | null;
  payload?: unknown;
  signatureBase64?: string | null;
}) {
  return request<CogitaConnectionCreateResponse>(`/cogita/libraries/${payload.libraryId}/connections`, {
    method: 'POST',
    body: JSON.stringify({
      connectionType: payload.connectionType,
      infoIds: payload.infoIds,
      payload: payload.payload ?? null,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function createCogitaGroup(payload: {
  libraryId: string;
  groupType: string;
  infoItems: Array<{ infoId?: string | null; infoType: string; payload: unknown }>;
  connections: Array<{ connectionId?: string | null; connectionType: string; infoIds: string[]; payload?: unknown }>;
  payload?: unknown;
  signatureBase64?: string | null;
}) {
  return request<CogitaGroupCreateResponse>(`/cogita/libraries/${payload.libraryId}/groups`, {
    method: 'POST',
    body: JSON.stringify({
      groupType: payload.groupType,
      infoItems: payload.infoItems,
      connections: payload.connections,
      payload: payload.payload ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function createCogitaCollection(payload: {
  libraryId: string;
  name: string;
  notes?: string | null;
  items: CogitaCollectionItemRequest[];
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<CogitaCollectionCreateResponse>(`/cogita/libraries/${payload.libraryId}/collections`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      notes: payload.notes ?? null,
      items: payload.items,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function createCogitaMockData(libraryId: string) {
  return request<CogitaMockDataResponse>(`/cogita/libraries/${libraryId}/mock-data`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export type CogitaExportInfo = {
  infoId: string;
  infoType: string;
  payload: unknown;
};

export type CogitaExportConnection = {
  connectionId: string;
  connectionType: string;
  infoIds: string[];
  payload?: unknown | null;
};

export type CogitaExportCollectionItem = {
  itemType: 'info' | 'connection';
  itemId: string;
  sortOrder: number;
};

export type CogitaExportCollection = {
  collectionInfoId: string;
  items: CogitaExportCollectionItem[];
};

export type CogitaLibraryExport = {
  version: number;
  infos: CogitaExportInfo[];
  connections: CogitaExportConnection[];
  collections: CogitaExportCollection[];
};

export type CogitaLibraryImportResponse = {
  infosImported: number;
  connectionsImported: number;
  collectionsImported: number;
};

export function exportCogitaLibrary(libraryId: string) {
  return request<CogitaLibraryExport>(`/cogita/libraries/${libraryId}/export`, {
    method: 'GET'
  });
}

export function importCogitaLibrary(libraryId: string, payload: CogitaLibraryExport) {
  return request<CogitaLibraryImportResponse>(`/cogita/libraries/${libraryId}/import`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function checkCogitaWordLanguage(payload: { libraryId: string; languageId: string; wordId: string }) {
  const params = new URLSearchParams({
    languageId: payload.languageId,
    wordId: payload.wordId
  });
  return request<CogitaWordLanguageCheck>(
    `/cogita/libraries/${payload.libraryId}/word-languages?${params.toString()}`,
    {
      method: 'GET'
    }
  );
}
