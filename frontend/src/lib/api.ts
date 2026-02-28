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

export type CogitaInfoPayloadFieldSpec = {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  searchable: boolean;
  keepOnCreate: boolean;
};

export type CogitaInfoLinkFieldSpec = {
  key: string;
  label: string;
  targetTypes: string[];
  required: boolean;
  multiple: boolean;
  keepOnCreate: boolean;
};

export type CogitaInfoTypeSpecification = {
  infoType: string;
  entityKind: string;
  payloadFields: CogitaInfoPayloadFieldSpec[];
  linkFields: CogitaInfoLinkFieldSpec[];
};

export type CogitaInfoApproachSpecification = {
  approachKey: string;
  label: string;
  category: string;
  sourceInfoTypes: string[];
};

export type CogitaInfoApproachProjection = {
  approachKey: string;
  sourceInfoId: string;
  sourceInfoType: string;
  projection: unknown;
};

export type CogitaEntitySearchResult = {
  entityId: string;
  entityKind: string;
  entityType: string;
  title: string;
  summary: string;
  infoId?: string | null;
  connectionId?: string | null;
};

export type CogitaCardSearchResult = {
  cardId: string;
  cardType: string;
  label: string;
  description: string;
  infoType?: string | null;
  checkType?: string | null;
  direction?: string | null;
  payload?: unknown | null;
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

export type CogitaRevision = {
  revisionId: string;
  collectionId: string;
  name: string;
  revisionType?: string | null;
  revisionSettings?: Record<string, unknown> | null;
  mode: string;
  check: string;
  limit: number;
  createdUtc: string;
  updatedUtc: string;
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

export type CogitaItemDependency = {
  parentItemType: string;
  parentItemId: string;
  parentCheckType?: string | null;
  parentDirection?: string | null;
  childItemType: string;
  childItemId: string;
  childCheckType?: string | null;
  childDirection?: string | null;
};

export type CogitaItemDependencyBundle = {
  items: CogitaItemDependency[];
};

export type CogitaReviewEventResponse = {
  reviewId: string;
  createdUtc: string;
};

export type CogitaReviewer = {
  roleId: string;
  label: string;
  roleKind?: string | null;
};

export type CogitaReviewSummary = {
  itemType: string;
  itemId: string;
  totalReviews: number;
  correctReviews: number;
  lastReviewedUtc?: string | null;
  score: number;
};

export type CogitaReviewOutcomeRequest = {
  itemType: string;
  itemId: string;
  checkType?: string | null;
  direction?: string | null;
  revisionType: string;
  evalType: string;
  correct: boolean;
  clientId: string;
  clientSequence: number;
  maskBase64?: string | null;
  payloadHashBase64?: string | null;
  payloadBase64?: string | null;
  personRoleId?: string | null;
};

export type CogitaReviewOutcomeResponse = {
  outcomeId: string;
  createdUtc: string;
};

export type CogitaRevisionShare = {
  shareId: string;
  revisionId: string;
  revisionName: string;
  collectionId: string;
  collectionName: string;
  shareCode: string;
  revisionType?: string | null;
  revisionSettings?: Record<string, unknown> | null;
  mode: string;
  check: string;
  limit: number;
  createdUtc: string;
  revokedUtc?: string | null;
};

export type CogitaRevisionShareCreateResponse = {
  shareId: string;
  revisionId: string;
  revisionName: string;
  collectionId: string;
  collectionName: string;
  shareCode: string;
  revisionType?: string | null;
  revisionSettings?: Record<string, unknown> | null;
  mode: string;
  check: string;
  limit: number;
  createdUtc: string;
};

export type CogitaLiveRevisionParticipantScore = {
  participantId: string;
  displayName: string;
  score: number;
};

export type CogitaLiveRevisionParticipant = {
  participantId: string;
  displayName: string;
  score: number;
  isConnected: boolean;
  joinedUtc: string;
};

export type CogitaLiveRevisionAnswer = {
  participantId: string;
  roundIndex: number;
  cardKey?: string | null;
  answer?: unknown;
  isCorrect?: boolean | null;
  pointsAwarded: number;
  submittedUtc: string;
};

export type CogitaLiveRevisionReloginRequest = {
  requestId: string;
  displayName: string;
  status: string;
  requestedUtc: string;
  approvedUtc?: string | null;
};

export type CogitaLiveRevisionSessionListItem = {
  sessionId: string;
  libraryId: string;
  revisionId: string;
  collectionId: string;
  sessionMode: string;
  hostViewMode?: string | null;
  participantViewMode?: string | null;
  status: string;
  currentRoundIndex: number;
  updatedUtc: string;
  title?: string | null;
  participantCount: number;
};

export type CogitaLiveRevisionParticipantSessionListItem = {
  sessionId: string;
  libraryId: string;
  revisionId: string;
  collectionId: string;
  sessionMode: string;
  hostViewMode?: string | null;
  participantViewMode?: string | null;
  status: string;
  currentRoundIndex: number;
  updatedUtc: string;
  title?: string | null;
  participantCount: number;
  participantScore: number;
  isConnected: boolean;
};

export type CogitaLiveRevisionSession = {
  sessionId: string;
  code: string;
  hostSecret: string;
  libraryId: string;
  revisionId?: string | null;
  collectionId?: string | null;
  sessionMode: string;
  hostViewMode?: string | null;
  participantViewMode?: string | null;
  sessionSettings?: Record<string, unknown> | null;
  status: string;
  currentRoundIndex: number;
  revealVersion: number;
  currentPrompt?: unknown;
  currentReveal?: unknown;
  participants: CogitaLiveRevisionParticipant[];
  scoreboard: CogitaLiveRevisionParticipantScore[];
  currentRoundAnswers: CogitaLiveRevisionAnswer[];
  pendingReloginRequests: CogitaLiveRevisionReloginRequest[];
};

export type CogitaLiveRevisionJoinResponse = {
  sessionId: string;
  participantId: string;
  participantToken: string;
  name: string;
};

export type CogitaLiveRevisionReloginRequestCreateResponse = {
  sessionId: string;
  requestId: string;
  status: string;
  name: string;
};

export type CogitaLiveRevisionPublicState = {
  sessionId: string;
  sessionMode: string;
  participantViewMode?: string | null;
  sessionSettings?: Record<string, unknown> | null;
  status: string;
  currentRoundIndex: number;
  revealVersion: number;
  currentPrompt?: unknown;
  currentReveal?: unknown;
  scoreboard: CogitaLiveRevisionParticipantScore[];
  answerSubmitted: boolean;
};

export type CogitaPublicRevisionShare = {
  shareId: string;
  revisionId: string;
  revisionName: string;
  libraryId: string;
  collectionId: string;
  collectionName: string;
  libraryName: string;
  revisionType?: string | null;
  revisionSettings?: Record<string, unknown> | null;
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

export function searchCogitaInfos(payload: {
  libraryId: string;
  type?: string;
  query?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  if (payload.limit) params.set('limit', String(payload.limit));
  const qs = params.toString();
  return request<CogitaInfoSearchResult[]>(
    `/cogita/libraries/${payload.libraryId}/infos${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function searchCogitaEntities(payload: {
  libraryId: string;
  type?: string;
  query?: string;
  filters?: Record<string, string>;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  if (payload.limit) params.set('limit', String(payload.limit));
  if (payload.filters && Object.keys(payload.filters).length > 0) {
    params.set('filters', JSON.stringify(payload.filters));
  }
  const qs = params.toString();
  return request<CogitaEntitySearchResult[]>(
    `/cogita/libraries/${payload.libraryId}/entities/search${qs ? `?${qs}` : ''}`,
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

export function getCogitaInfoCollections(payload: { libraryId: string; infoId: string }) {
  return request<CogitaCollectionSummary[]>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}/collections`,
    { method: 'GET' }
  );
}

export function getCogitaRevisions(payload: { libraryId: string; collectionId?: string }) {
  if (!payload.collectionId) {
    return request<CogitaRevision[]>(
      `/cogita/libraries/${payload.libraryId}/revisions`,
      { method: 'GET' }
    );
  }
  return request<CogitaRevision[]>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/revisions`,
    { method: 'GET' }
  );
}

export function getCogitaRevision(payload: { libraryId: string; revisionId: string; collectionId?: string }) {
  if (!payload.collectionId) {
    return request<CogitaRevision>(
      `/cogita/libraries/${payload.libraryId}/revisions/${payload.revisionId}`,
      { method: 'GET' }
    );
  }
  return request<CogitaRevision>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/revisions/${payload.revisionId}`,
    { method: 'GET' }
  );
}

export function createCogitaRevision(payload: {
  libraryId: string;
  collectionId: string;
  name: string;
  revisionType?: string | null;
  revisionSettings?: Record<string, unknown> | null;
  mode: string;
  check: string;
  limit: number;
}) {
  return request<CogitaRevision>(
    `/cogita/libraries/${payload.libraryId}/revisions`,
    {
      method: 'POST',
      body: JSON.stringify({
        collectionId: payload.collectionId,
        name: payload.name,
        revisionType: payload.revisionType ?? null,
        revisionSettings: payload.revisionSettings ?? null,
        mode: payload.mode,
        check: payload.check,
        limit: payload.limit
      })
    }
  );
}

export function updateCogitaRevision(payload: {
  libraryId: string;
  collectionId: string;
  revisionId: string;
  targetCollectionId?: string;
  name: string;
  revisionType?: string | null;
  revisionSettings?: Record<string, unknown> | null;
  mode: string;
  check: string;
  limit: number;
}) {
  return request<CogitaRevision>(
    `/cogita/libraries/${payload.libraryId}/revisions/${payload.revisionId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        collectionId: payload.targetCollectionId ?? null,
        name: payload.name,
        revisionType: payload.revisionType ?? null,
        revisionSettings: payload.revisionSettings ?? null,
        mode: payload.mode,
        check: payload.check,
        limit: payload.limit
      })
    }
  );
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

export function createCogitaReviewOutcome(payload: {
  libraryId: string;
  outcome: CogitaReviewOutcomeRequest;
}) {
  return request<CogitaReviewOutcomeResponse>(`/cogita/libraries/${payload.libraryId}/review-outcomes`, {
    method: 'POST',
    body: JSON.stringify(payload.outcome)
  });
}

export function createCogitaReviewOutcomesBulk(payload: {
  libraryId: string;
  outcomes: CogitaReviewOutcomeRequest[];
}) {
  return request<{ stored: number }>(`/cogita/libraries/${payload.libraryId}/review-outcomes/bulk`, {
    method: 'POST',
    body: JSON.stringify({
      outcomes: payload.outcomes
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
  checkType?: string | null;
  direction?: string | null;
  personRoleId?: string | null;
}) {
  const params = new URLSearchParams();
  if (payload.personRoleId) params.set('personRoleId', payload.personRoleId);
  if (payload.checkType) params.set('checkType', payload.checkType);
  if (payload.direction) params.set('direction', payload.direction);
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
  revisionId: string;
  signatureBase64?: string | null;
}) {
  return request<CogitaRevisionShareCreateResponse>(`/cogita/libraries/${payload.libraryId}/revision-shares`, {
    method: 'POST',
    body: JSON.stringify({
      revisionId: payload.revisionId,
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

export function createCogitaLiveRevisionSession(payload: {
  libraryId: string;
  revisionId: string;
  collectionId?: string | null;
  title?: string | null;
  sessionMode?: 'simultaneous' | 'asynchronous';
  hostViewMode?: 'panel' | 'question' | 'score';
  participantViewMode?: 'question' | 'score' | 'fullscreen';
  sessionSettings?: Record<string, unknown> | null;
}) {
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/revisions/${payload.revisionId}/live-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({
        revisionId: payload.revisionId,
        collectionId: payload.collectionId ?? null,
        title: payload.title ?? null,
        sessionMode: payload.sessionMode ?? 'simultaneous',
        hostViewMode: payload.hostViewMode ?? 'panel',
        participantViewMode: payload.participantViewMode ?? 'question',
        sessionSettings: payload.sessionSettings ?? null
      })
    }
  );
}

export function updateCogitaLiveRevisionSession(payload: {
  libraryId: string;
  revisionId: string;
  sessionId: string;
  title?: string | null;
  sessionMode?: 'simultaneous' | 'asynchronous' | null;
  hostViewMode?: 'panel' | 'question' | 'score' | null;
  participantViewMode?: 'question' | 'score' | 'fullscreen' | null;
  sessionSettings?: Record<string, unknown> | null;
}) {
  return request<CogitaLiveRevisionSessionListItem>(
    `/cogita/libraries/${payload.libraryId}/revisions/${payload.revisionId}/live-sessions/${payload.sessionId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        title: payload.title ?? null,
        sessionMode: payload.sessionMode ?? null,
        hostViewMode: payload.hostViewMode ?? null,
        participantViewMode: payload.participantViewMode ?? null,
        sessionSettings: payload.sessionSettings ?? null
      })
    }
  );
}

export function getCogitaLiveRevisionSessions(payload: { libraryId: string }) {
  return request<CogitaLiveRevisionSessionListItem[]>(
    `/cogita/libraries/${payload.libraryId}/live-sessions`,
    { method: 'GET' }
  );
}

export function getCogitaLiveRevisionSessionsByRevision(payload: { libraryId: string; revisionId: string }) {
  return request<CogitaLiveRevisionSessionListItem[]>(
    `/cogita/libraries/${payload.libraryId}/revisions/${payload.revisionId}/live-sessions`,
    { method: 'GET' }
  );
}

export function getCogitaParticipatingLiveRevisionSessions(payload: { libraryId: string }) {
  return request<CogitaLiveRevisionParticipantSessionListItem[]>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/participating`,
    { method: 'GET' }
  );
}

export function attachCogitaLiveRevisionSession(payload: { libraryId: string; sessionId: string }) {
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/attach`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function getCogitaLiveRevisionSession(payload: { libraryId: string; sessionId: string; hostSecret: string }) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}?${params.toString()}`,
    { method: 'GET' }
  );
}

export function updateCogitaLiveRevisionHostState(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  status: string;
  currentRoundIndex: number;
  revealVersion: number;
  currentPrompt?: unknown | null;
  currentReveal?: unknown | null;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/state?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        status: payload.status,
        currentRoundIndex: payload.currentRoundIndex,
        revealVersion: payload.revealVersion,
        currentPrompt: payload.currentPrompt ?? null,
        currentReveal: payload.currentReveal ?? null
      })
    }
  );
}

export function scoreCogitaLiveRevisionRound(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  scores: Array<{ participantId: string; isCorrect?: boolean | null; pointsAwarded: number }>;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/score?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({ scores: payload.scores })
    }
  );
}

export function approveCogitaLiveRevisionReloginRequest(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  requestId: string;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/relogin-requests/${payload.requestId}/approve?${params.toString()}`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function closeCogitaLiveRevisionSession(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/close?${params.toString()}`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function joinCogitaLiveRevision(payload: { code: string; name: string }) {
  return request<CogitaLiveRevisionJoinResponse>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/join`,
    { method: 'POST', body: JSON.stringify({ name: payload.name }) }
  );
}

export function createCogitaLiveRevisionReloginRequest(payload: { code: string; name: string }) {
  return request<CogitaLiveRevisionReloginRequestCreateResponse>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/relogin-request`,
    { method: 'POST', body: JSON.stringify({ name: payload.name }) }
  );
}

export function getCogitaLiveRevisionReloginRequest(payload: { code: string; requestId: string }) {
  return request<CogitaLiveRevisionReloginRequest>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/relogin-request/${encodeURIComponent(payload.requestId)}`,
    { method: 'GET' }
  );
}

export function getCogitaLiveRevisionPublicState(payload: { code: string; participantToken?: string | null }) {
  const params = new URLSearchParams();
  if (payload.participantToken) params.set('participantToken', payload.participantToken);
  return request<CogitaLiveRevisionPublicState>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/state${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function submitCogitaLiveRevisionAnswer(payload: {
  code: string;
  participantToken: string;
  roundIndex: number;
  cardKey?: string | null;
  answer?: unknown | null;
}) {
  return request<void>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        roundIndex: payload.roundIndex,
        cardKey: payload.cardKey ?? null,
        answer: payload.answer ?? null
      })
    }
  );
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

export function getCogitaItemDependencies(payload: { libraryId: string }) {
  return request<CogitaItemDependencyBundle>(`/cogita/libraries/${payload.libraryId}/dependencies/items`, {
    method: 'GET'
  });
}

export function getCogitaPublicRevisionDependencies(payload: { shareId: string; key?: string | null }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  const qs = params.toString();
  return request<CogitaItemDependencyBundle>(`/cogita/public/revision/${payload.shareId}/dependencies${qs ? `?${qs}` : ''}`, {
    method: 'GET'
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
  links?: Record<string, string | string[] | null | undefined>;
  signatureBase64?: string | null;
}) {
  return request<CogitaInfoCreateResponse>(`/cogita/libraries/${payload.libraryId}/infos`, {
    method: 'POST',
    body: JSON.stringify({
      infoType: payload.infoType,
      payload: payload.payload,
      links: payload.links ?? null,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function getCogitaInfoDetail(payload: { libraryId: string; infoId: string }) {
  return request<{ infoId: string; infoType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}`,
    { method: 'GET' }
  );
}

export function getCogitaApproachSpecifications(payload: { libraryId: string }) {
  return request<CogitaInfoApproachSpecification[]>(
    `/cogita/libraries/${payload.libraryId}/approaches/specification`,
    { method: 'GET' }
  );
}

export function getCogitaInfoApproachProjection(payload: { libraryId: string; infoId: string; approachKey: string }) {
  return request<CogitaInfoApproachProjection>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}/approaches/${encodeURIComponent(payload.approachKey)}`,
    { method: 'GET' }
  );
}

export function getCogitaInfoCheckcards(payload: { libraryId: string; infoId: string }) {
  return request<CogitaCardSearchBundle>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}/checkcards`,
    { method: 'GET' }
  );
}

export function getCogitaInfoCheckcardDependencies(payload: { libraryId: string; infoId: string }) {
  return request<CogitaItemDependencyBundle>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}/checkcards/dependencies`,
    { method: 'GET' }
  );
}

export function getCogitaPublicInfoDetail(payload: { shareCode: string; infoId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<{ infoId: string; infoType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/public/revision/${payload.shareCode}/infos/${payload.infoId}${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaInfoTypeSpecification(payload: { libraryId: string }) {
  return request<CogitaInfoTypeSpecification[]>(
    `/cogita/libraries/${payload.libraryId}/info-types/specification`,
    { method: 'GET' }
  );
}

export function updateCogitaInfo(payload: {
  libraryId: string;
  infoId: string;
  payload: unknown;
  links?: Record<string, string | string[] | null | undefined>;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<{ infoId: string; infoType: string }>(
    `/cogita/libraries/${payload.libraryId}/infos/${payload.infoId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        payload: payload.payload,
        links: payload.links ?? null,
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

export function deleteCogitaConnection(payload: { libraryId: string; connectionId: string }) {
  return request<{ deleted: boolean }>(`/cogita/libraries/${payload.libraryId}/connections/${payload.connectionId}`, {
    method: 'DELETE'
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

export function updateCogitaCollection(payload: {
  libraryId: string;
  collectionId: string;
  name: string;
  notes?: string | null;
}) {
  return request<CogitaCollectionDetail>(`/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name,
      notes: payload.notes ?? null
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

export type ParishLayoutFrame = {
  position: { row: number; col: number };
  size: { colSpan: number; rowSpan: number };
};

export type ParishLayoutBreakpoint = 'desktop' | 'tablet' | 'mobile';

export type ParishLayoutItem = {
  id: string;
  type: string;
  layouts?: Partial<Record<ParishLayoutBreakpoint, ParishLayoutFrame>>;
  position?: { row: number; col: number };
  size?: { colSpan: number; rowSpan: number };
  props?: Record<string, string>;
};

export type ParishHomepageConfig = {
  modules: ParishLayoutItem[];
};

export type ParishSummary = {
  id: string;
  slug: string;
  name: string;
  location: string;
  theme: string;
  heroImageUrl?: string | null;
};

export type ParishSite = ParishSummary & {
  homepage: ParishHomepageConfig;
};

export type ParishPublicIntention = {
  id: string;
  massDateTime: string;
  churchName: string;
  publicText: string;
  status: string;
};

export type ParishPublicMass = {
  id: string;
  massDateTime: string;
  churchName: string;
  title: string;
  note?: string | null;
  isCollective?: boolean;
  durationMinutes?: number | null;
  kind?: string | null;
  beforeService?: string | null;
  afterService?: string | null;
  intentionsJson?: string | null;
  donationSummary?: string | null;
};

export type ParishMassRuleNode = {
  id: string;
  type: string;
  nextId?: string | null;
  elseId?: string | null;
  config?: Record<string, string> | null;
};

export type ParishMassRuleGraph = {
  startNodeId: string;
  nodes: ParishMassRuleNode[];
  metadata?: Record<string, string> | null;
};

export type ParishMassRule = {
  id: string;
  name: string;
  description?: string | null;
  graph: ParishMassRuleGraph;
  updatedUtc: string;
};

export function listParishes() {
  return request<ParishSummary[]>('/parish', {
    method: 'GET'
  });
}

export function getParishSite(slug: string) {
  return request<ParishSite>(`/parish/${slug}`, {
    method: 'GET'
  });
}

export function createParishSite(payload: {
  name: string;
  location: string;
  slug: string;
  theme: string;
  heroImageUrl?: string | null;
  homepage: ParishHomepageConfig;
}) {
  return request<ParishSite>('/parish', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateParishSite(parishId: string, payload: { homepage: ParishHomepageConfig; isPublished: boolean }) {
  return request<void>(`/parish/${parishId}/site`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getParishPublicIntentions(slug: string, params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<ParishPublicIntention[]>(`/parish/${slug}/public/intentions${suffix}`, {
    method: 'GET'
  });
}

export function getParishPublicMasses(slug: string, params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<ParishPublicMass[]>(`/parish/${slug}/public/masses${suffix}`, {
    method: 'GET'
  });
}

export function createParishIntention(
  parishId: string,
  payload: {
    massDateTime: string;
    churchName: string;
    publicText: string;
    internalText?: string | null;
    donorReference?: string | null;
    status?: string | null;
  }
) {
  return request<void>(`/parish/${parishId}/intentions`, {
    method: 'POST',
    body: JSON.stringify({
      massDateTime: payload.massDateTime,
      churchName: payload.churchName,
      publicText: payload.publicText,
      internalText: payload.internalText ?? null,
      donorReference: payload.donorReference ?? null,
      status: payload.status ?? 'Active'
    })
  });
}

export function createParishMass(
  parishId: string,
  payload: {
    massDateTime: string;
    churchName: string;
    title: string;
    note?: string | null;
    isCollective?: boolean;
    durationMinutes?: number | null;
    kind?: string | null;
    beforeService?: string | null;
    afterService?: string | null;
    intentions?: Array<{ text: string; donation?: string | null }> | null;
    donationSummary?: string | null;
  }
) {
  return request<void>(`/parish/${parishId}/masses`, {
    method: 'POST',
    body: JSON.stringify({
      massDateTime: payload.massDateTime,
      churchName: payload.churchName,
      title: payload.title,
      note: payload.note ?? null,
      isCollective: payload.isCollective ?? false,
      durationMinutes: payload.durationMinutes ?? null,
      kind: payload.kind ?? null,
      beforeService: payload.beforeService ?? null,
      afterService: payload.afterService ?? null,
      intentions: payload.intentions ?? [],
      donationSummary: payload.donationSummary ?? null
    })
  });
}

export function updateParishMass(
  parishId: string,
  massId: string,
  payload: {
    massDateTime: string;
    churchName: string;
    title: string;
    note?: string | null;
    isCollective?: boolean;
    durationMinutes?: number | null;
    kind?: string | null;
    beforeService?: string | null;
    afterService?: string | null;
    intentions?: Array<{ text: string; donation?: string | null }> | null;
    donationSummary?: string | null;
  }
) {
  return request<void>(`/parish/${parishId}/masses/${massId}`, {
    method: 'PUT',
    body: JSON.stringify({
      massDateTime: payload.massDateTime,
      churchName: payload.churchName,
      title: payload.title,
      note: payload.note ?? null,
      isCollective: payload.isCollective ?? false,
      durationMinutes: payload.durationMinutes ?? null,
      kind: payload.kind ?? null,
      beforeService: payload.beforeService ?? null,
      afterService: payload.afterService ?? null,
      intentions: payload.intentions ?? [],
      donationSummary: payload.donationSummary ?? null
    })
  });
}

export function listParishMassRules(parishId: string) {
  return request<ParishMassRule[]>(`/parish/${parishId}/mass-rules`, { method: 'GET' });
}

export function createParishMassRule(
  parishId: string,
  payload: { name: string; description?: string | null; graph: ParishMassRuleGraph }
) {
  return request<string>(`/parish/${parishId}/mass-rules`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateParishMassRule(
  parishId: string,
  ruleId: string,
  payload: { name: string; description?: string | null; graph: ParishMassRuleGraph }
) {
  return request<void>(`/parish/${parishId}/mass-rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function simulateParishMassRule(
  parishId: string,
  ruleId: string,
  payload: { fromDate: string; toDate: string; includeExisting?: boolean }
) {
  return request<ParishPublicMass[]>(`/parish/${parishId}/mass-rules/${ruleId}/simulate`, {
    method: 'POST',
    body: JSON.stringify({
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      includeExisting: payload.includeExisting ?? false
    })
  });
}

export function applyParishMassRule(
  parishId: string,
  ruleId: string,
  payload: { fromDate: string; toDate: string; replaceExisting?: boolean }
) {
  return request<{ added: number }>(`/parish/${parishId}/mass-rules/${ruleId}/apply`, {
    method: 'POST',
    body: JSON.stringify({
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      replaceExisting: payload.replaceExisting ?? false
    })
  });
}
