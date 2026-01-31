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

export type CogitaCollectionDependency = {
  parentCollectionId: string;
  childCollectionId: string;
};

export type CogitaCollectionDependencies = {
  parents: CogitaCollectionDependency[];
  children: CogitaCollectionDependency[];
};

export type CogitaCollectionItemRequest = {
  itemType: 'info' | 'connection';
  itemId: string;
};

export type CogitaCollectionGraphNode = {
  nodeId: string;
  nodeType: string;
  payload: unknown;
};

export type CogitaCollectionGraphEdge = {
  edgeId: string;
  fromNodeId: string;
  fromPort?: string | null;
  toNodeId: string;
  toPort?: string | null;
};

export type CogitaCollectionGraph = {
  graphId: string;
  nodes: CogitaCollectionGraphNode[];
  edges: CogitaCollectionGraphEdge[];
};

export type CogitaCollectionGraphPreview = {
  total: number;
  connections: number;
  infos: number;
};

export type CogitaDependencyGraphNode = {
  nodeId: string;
  nodeType: string;
  payload: unknown;
};

export type CogitaDependencyGraphEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
};

export type CogitaDependencyGraph = {
  graphId: string;
  nodes: CogitaDependencyGraphNode[];
  edges: CogitaDependencyGraphEdge[];
};

export type CogitaDependencyGraphPreview = {
  totalCollections: number;
  collectionIds: string[];
};

export type CogitaReviewEventResponse = {
  reviewId: string;
  createdUtc: string;
};

export type CogitaReviewer = {
  roleId: string;
  label: string;
};

export type CogitaReviewSummary = {
  itemType: string;
  itemId: string;
  totalReviews: number;
  correctReviews: number;
  lastReviewedUtc?: string | null;
  score: number;
};

export type CogitaRevisionShare = {
  shareId: string;
  collectionId: string;
  collectionName: string;
  shareCode: string;
  mode: string;
  check: string;
  limit: number;
  createdUtc: string;
  revokedUtc?: string | null;
};

export type CogitaRevisionShareCreateResponse = {
  shareId: string;
  collectionId: string;
  shareCode: string;
  mode: string;
  check: string;
  limit: number;
  createdUtc: string;
};

export type CogitaPublicRevisionShare = {
  shareId: string;
  libraryId: string;
  collectionId: string;
  collectionName: string;
  libraryName: string;
  mode: string;
  check: string;
  limit: number;
};

export type CogitaComputedSample = {
  prompt: string;
  expectedAnswer: string;
  expectedAnswers?: Record<string, string>;
  values: Record<string, number | string>;
  expectedAnswerIsSentence?: boolean;
  outputVariables?: Record<string, string>;
  variableValues?: Record<string, string>;
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

export function getCogitaCollectionDependencies(libraryId: string, collectionId: string) {
  return request<CogitaCollectionDependencies>(
    `/cogita/libraries/${libraryId}/collections/${collectionId}/dependencies`,
    { method: 'GET' }
  );
}

export function createCogitaCollectionDependency(
  libraryId: string,
  collectionId: string,
  payload: CogitaCollectionDependency
) {
  return request<CogitaCollectionDependency>(
    `/cogita/libraries/${libraryId}/collections/${collectionId}/dependencies`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
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

export function createCogitaReviewEvent(payload: {
  libraryId: string;
  itemType: 'info' | 'connection';
  itemId: string;
  direction?: string | null;
  payloadBase64: string;
  personRoleId?: string | null;
}) {
  return request<CogitaReviewEventResponse>(`/cogita/libraries/${payload.libraryId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      itemType: payload.itemType,
      itemId: payload.itemId,
      direction: payload.direction ?? null,
      payloadBase64: payload.payloadBase64,
      personRoleId: payload.personRoleId ?? null
    })
  });
}

export function getCogitaComputedSample(payload: { libraryId: string; infoId: string }) {
  return request<CogitaComputedSample>(`/cogita/libraries/${payload.libraryId}/computed/${payload.infoId}/sample`, {
    method: 'GET'
  });
}

export function getCogitaReviewers(payload: { libraryId: string }) {
  return request<CogitaReviewer[]>(`/cogita/libraries/${payload.libraryId}/reviewers`, {
    method: 'GET'
  });
}

export function getCogitaReviewSummary(payload: {
  libraryId: string;
  itemType: 'info' | 'connection';
  itemId: string;
  personRoleId?: string | null;
}) {
  const params = new URLSearchParams();
  if (payload.personRoleId) params.set('personRoleId', payload.personRoleId);
  const qs = params.toString();
  return request<CogitaReviewSummary>(
    `/cogita/libraries/${payload.libraryId}/reviews/${payload.itemType}/${payload.itemId}/summary${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function createCogitaRevisionShare(payload: {
  libraryId: string;
  collectionId: string;
  mode: string;
  check: string;
  limit: number;
  signatureBase64?: string | null;
}) {
  return request<CogitaRevisionShareCreateResponse>(`/cogita/libraries/${payload.libraryId}/revision-shares`, {
    method: 'POST',
    body: JSON.stringify({
      collectionId: payload.collectionId,
      mode: payload.mode,
      check: payload.check,
      limit: payload.limit,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function getCogitaRevisionShares(payload: { libraryId: string }) {
  return request<CogitaRevisionShare[]>(`/cogita/libraries/${payload.libraryId}/revision-shares`, {
    method: 'GET'
  });
}

export function revokeCogitaRevisionShare(payload: { libraryId: string; shareId: string }) {
  return request<void>(`/cogita/libraries/${payload.libraryId}/revision-shares/${payload.shareId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getCogitaPublicRevisionShare(payload: { shareId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<CogitaPublicRevisionShare>(
    `/cogita/public/revision/${payload.shareId}${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicRevisionInfos(payload: { shareId: string; key?: string; type?: string; query?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  return request<CogitaInfoSearchResult[]>(
    `/cogita/public/revision/${payload.shareId}/infos${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicRevisionCards(payload: {
  shareId: string;
  key?: string;
  limit?: number;
  cursor?: string | null;
}) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  if (payload.limit) params.set('limit', String(payload.limit));
  if (payload.cursor) params.set('cursor', payload.cursor);
  return request<CogitaCardSearchBundle>(
    `/cogita/public/revision/${payload.shareId}/cards${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicComputedSample(payload: { shareId: string; infoId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<CogitaComputedSample>(
    `/cogita/public/revision/${payload.shareId}/computed/${payload.infoId}/sample${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaDependencyGraph(payload: { libraryId: string }) {
  return request<CogitaDependencyGraph>(`/cogita/libraries/${payload.libraryId}/dependency-graph`, {
    method: 'GET'
  });
}

export function saveCogitaDependencyGraph(payload: {
  libraryId: string;
  nodes: Array<{ nodeId?: string | null; nodeType: string; payload: unknown }>;
  edges: Array<{ edgeId?: string | null; fromNodeId: string; toNodeId: string }>;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<CogitaDependencyGraph>(`/cogita/libraries/${payload.libraryId}/dependency-graph`, {
    method: 'PUT',
    body: JSON.stringify({
      nodes: payload.nodes,
      edges: payload.edges,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function previewCogitaDependencyGraph(payload: { libraryId: string }) {
  return request<CogitaDependencyGraphPreview>(`/cogita/libraries/${payload.libraryId}/dependency-graph/preview`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getCogitaCollectionGraph(payload: { libraryId: string; collectionId: string }) {
  return request<CogitaCollectionGraph>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/graph`,
    { method: 'GET' }
  );
}

export function saveCogitaCollectionGraph(payload: {
  libraryId: string;
  collectionId: string;
  nodes: Array<{ nodeId?: string | null; nodeType: string; payload: unknown }>;
  edges: Array<{ edgeId?: string | null; fromNodeId: string; fromPort?: string | null; toNodeId: string; toPort?: string | null }>;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<CogitaCollectionGraph>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/graph`,
    {
      method: 'PUT',
      body: JSON.stringify({
        nodes: payload.nodes,
        edges: payload.edges,
        dataKeyId: payload.dataKeyId ?? null,
        signatureBase64: payload.signatureBase64 ?? null
      })
    }
  );
}

export function previewCogitaCollectionGraph(payload: { libraryId: string; collectionId: string }) {
  return request<CogitaCollectionGraphPreview>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/graph/preview`,
    { method: 'POST', body: JSON.stringify({}) }
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

export function getCogitaInfoDetail(payload: { libraryId: string; infoId: string }) {
  return request<{ infoId: string; infoType: string; payload: unknown }>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicInfoDetail(payload: { shareCode: string; infoId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<{ infoId: string; infoType: string; payload: unknown }>(
    `/cogita/public/revision/${payload.shareCode}/infos/${payload.infoId}${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function updateCogitaInfo(payload: {
  libraryId: string;
  infoId: string;
  payload: unknown;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<{ infoId: string; infoType: string }>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        payload: payload.payload,
        dataKeyId: payload.dataKeyId ?? null,
        signatureBase64: payload.signatureBase64 ?? null
      })
    }
  );
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
  graph?: {
    nodes: Array<{ nodeId?: string | null; nodeType: string; payload: unknown }>;
    edges: Array<{ edgeId?: string | null; fromNodeId: string; fromPort?: string | null; toNodeId: string; toPort?: string | null }>;
    dataKeyId?: string | null;
    signatureBase64?: string | null;
  } | null;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<CogitaCollectionCreateResponse>(`/cogita/libraries/${payload.libraryId}/collections`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      notes: payload.notes ?? null,
      items: payload.items,
      graph: payload.graph
        ? {
            nodes: payload.graph.nodes,
            edges: payload.graph.edges,
            dataKeyId: payload.graph.dataKeyId ?? null,
            signatureBase64: payload.graph.signatureBase64 ?? null
          }
        : null,
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

export type TransferProgress = {
  loadedBytes: number;
  totalBytes?: number | null;
  percent?: number | null;
};

export type CogitaImportStage = 'infos' | 'connections' | 'collections';

export type CogitaImportProgress = {
  stage: CogitaImportStage;
  processed: number;
  total: number;
  infos: number;
  connections: number;
  collections: number;
};

function reportTransferProgress(
  handler: ((progress: TransferProgress) => void) | undefined,
  loadedBytes: number,
  totalBytes?: number | null
) {
  if (!handler) return;
  const percent = totalBytes && totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : null;
  handler({ loadedBytes, totalBytes: totalBytes ?? null, percent });
}

export async function exportCogitaLibraryStream(
  libraryId: string,
  onProgress?: (progress: TransferProgress) => void
) {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${apiBase}/cogita/libraries/${libraryId}/export`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  if (!response.body) {
    const blob = await response.blob();
    reportTransferProgress(onProgress, blob.size, blob.size);
    return blob;
  }

  const totalHeader = response.headers.get('Content-Length');
  const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loadedBytes += value.length;
      reportTransferProgress(onProgress, loadedBytes, totalBytes);
    }
  }

  reportTransferProgress(onProgress, loadedBytes, totalBytes ?? loadedBytes);
  return new Blob(chunks, { type: 'application/json' });
}

export function importCogitaLibraryStream(
  libraryId: string,
  file: Blob,
  onProgress?: (progress: TransferProgress) => void,
  onStageProgress?: (progress: CogitaImportProgress) => void
) {
  const csrfToken = getCsrfToken();
  return new Promise<CogitaLibraryImportResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}/cogita/libraries/${libraryId}/import/stream`);
    xhr.responseType = 'text';
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (csrfToken) {
      xhr.setRequestHeader('X-XSRF-TOKEN', csrfToken);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        reportTransferProgress(onProgress, event.loaded, null);
        return;
      }
      reportTransferProgress(onProgress, event.loaded, event.total);
    };

    let responseCursor = 0;
    const handleStreamText = (text: string) => {
      const chunk = text.slice(responseCursor);
      responseCursor = text.length;
      const lines = chunk.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('progress ')) {
          try {
            const payload = JSON.parse(trimmed.replace('progress ', '')) as CogitaImportProgress;
            onStageProgress?.(payload);
          } catch {
            // ignore malformed progress payloads
          }
        } else if (trimmed.startsWith('done ')) {
          try {
            const payload = JSON.parse(trimmed.replace('done ', '')) as CogitaLibraryImportResponse;
            resolve(payload);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Import parsing failed'));
          }
        }
      }
    };

    xhr.onprogress = () => {
      if (typeof xhr.responseText === 'string') {
        handleStreamText(xhr.responseText);
      }
    };

    xhr.onload = () => {
      if (typeof xhr.responseText === 'string') {
        handleStreamText(xhr.responseText);
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (typeof xhr.responseText === 'string' && xhr.responseText.includes('done ')) {
          return;
        }
        try {
          const fallback = JSON.parse(xhr.responseText || '{}') as CogitaLibraryImportResponse;
          resolve(fallback);
          return;
        } catch {
          resolve({ infosImported: 0, connectionsImported: 0, collectionsImported: 0 });
          return;
        }
      }
      const message =
        typeof xhr.response === 'string'
          ? xhr.response
          : xhr.response
            ? JSON.stringify(xhr.response)
            : xhr.statusText;
      reject(new ApiError(xhr.status, message || 'Import failed'));
    };

    xhr.onerror = () => {
      reject(new ApiError(xhr.status || 500, xhr.statusText || 'Import failed'));
    };

    xhr.send(file);
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
