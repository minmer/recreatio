const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';
let csrfTokenCache: string | null = null;
const liveStateCache = new Map<string, { etag: string; payload: unknown }>();

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

async function requestLiveStateCached<T>(cacheKey: string, path: string): Promise<T> {
  const csrfToken = getCsrfToken();
  const cached = liveStateCache.get(cacheKey);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {})
  };
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers
  });

  if (response.status === 304) {
    if (cached) {
      return cached.payload as T;
    }
    // Fallback safety: no local payload for this ETag state, force full fetch.
    const retry = await fetch(`${apiBase}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {})
      }
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new ApiError(retry.status, text || retry.statusText);
    }
    const retryText = await retry.text();
    const retryPayload = retryText ? (JSON.parse(retryText) as T) : (undefined as T);
    const retryEtag = retry.headers.get('ETag');
    if (retryEtag && retryText) {
      liveStateCache.set(cacheKey, { etag: retryEtag, payload: retryPayload as unknown });
    }
    return retryPayload;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (undefined as T);
  const etag = response.headers.get('ETag');
  if (etag && text) {
    liveStateCache.set(cacheKey, { etag, payload: payload as unknown });
  }
  return payload;
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

export type CogitaCreationProject = {
  projectId: string;
  projectType: 'storyboard' | 'text' | string;
  name: string;
  content?: unknown | null;
  createdUtc: string;
  updatedUtc: string;
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

export type CogitaDependencyGraphSummary = {
  graphId: string;
  name: string;
  isActive: boolean;
  updatedUtc: string;
  nodeCount: number;
};

export type CogitaDependencyGraphList = {
  items: CogitaDependencyGraphSummary[];
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

export type CogitaStatisticsParticipantSummary = {
  participantKey: string;
  participantKind: 'person' | 'participant' | 'system' | string;
  personRoleId?: string | null;
  participantId?: string | null;
  label: string;
  eventCount: number;
  answerCount: number;
  correctCount: number;
  averageCorrectness: number;
  totalPoints: number;
  lastActivityUtc?: string | null;
  knownessScore: number;
  averageDurationMs?: number | null;
  averagePointsPerCorrectAnswer?: number | null;
  averageBasePointsPerCorrectAnswer?: number | null;
  averageFirstBonusPointsPerCorrectAnswer?: number | null;
  averageSpeedBonusPointsPerCorrectAnswer?: number | null;
  averageStreakBonusPointsPerCorrectAnswer?: number | null;
};

export type CogitaStatisticsTimelinePoint = {
  index: number;
  recordedUtc: string;
  participantKey: string;
  participantKind: 'person' | 'participant' | 'system' | string;
  personRoleId?: string | null;
  participantId?: string | null;
  label: string;
  eventType: string;
  roundIndex?: number | null;
  isCorrect?: boolean | null;
  correctness?: number | null;
  pointsAwarded?: number | null;
  durationMs?: number | null;
  runningPoints: number;
  knownessScore: number;
};

export type CogitaStatisticsKnownessItem = {
  infoId: string;
  infoType: string;
  label: string;
  answerCount: number;
  correctCount: number;
  averageCorrectness: number;
  knownessScore: number;
};

export type CogitaStatisticsResponse = {
  scopeType: string;
  scopeId?: string | null;
  totalEvents: number;
  totalAnswers: number;
  totalCorrectAnswers: number;
  averageCorrectness: number;
  totalPoints: number;
  participants: CogitaStatisticsParticipantSummary[];
  timeline: CogitaStatisticsTimelinePoint[];
  bestKnownWords?: CogitaStatisticsKnownessItem[];
  worstKnownWords?: CogitaStatisticsKnownessItem[];
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
  durationMs?: number | null;
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

export type CogitaStoryboardShare = {
  shareId: string;
  projectId: string;
  projectName: string;
  shareCode: string;
  createdUtc: string;
  revokedUtc?: string | null;
};

export type CogitaStoryboardShareCreateResponse = {
  shareId: string;
  projectId: string;
  projectName: string;
  shareCode: string;
  createdUtc: string;
};

export type CogitaPublicStoryboardShare = {
  shareId: string;
  projectId: string;
  projectName: string;
  libraryId: string;
  libraryName: string;
  content?: unknown | null;
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
  participantStatus: string;
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
  title?: string | null;
  participantViewMode?: string | null;
  sessionSettings?: Record<string, unknown> | null;
  status: string;
  currentRoundIndex: number;
  revealVersion: number;
  currentPrompt?: unknown;
  currentReveal?: unknown;
  scoreboard: CogitaLiveRevisionParticipantScore[];
  scoreHistory: Array<{
    roundIndex: number;
    recordedUtc: string;
    scoreboard: CogitaLiveRevisionParticipantScore[];
  }>;
  correctnessHistory: Array<{
    roundIndex: number;
    recordedUtc: string;
    entries: Array<{
      participantId: string;
      displayName: string;
      isCorrect?: boolean | null;
      pointsAwarded: number;
      submittedUtc: string;
      durationMs?: number | null;
      basePoints?: number | null;
      firstBonusPoints?: number | null;
      speedBonusPoints?: number | null;
      streakBonusPoints?: number | null;
    }>;
  }>;
  answerSubmitted: boolean;
  participantId?: string | null;
  participantName?: string | null;
  participantToken?: string | null;
};

export type CogitaLiveRevisionReviewRound = {
  roundIndex: number;
  cardKey: string;
  prompt: unknown;
  reveal: unknown;
  participantAnswer?: unknown;
  isCorrect?: boolean | null;
  pointsAwarded: number;
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

export type CogitaDashboardPreferences = {
  layoutVersion: string;
  preferencesJson: string;
  createdUtc: string;
  updatedUtc: string;
};

export function getCogitaDashboardPreferences() {
  return request<CogitaDashboardPreferences>('/cogita/dashboard/preferences', {
    method: 'GET'
  });
}

export function updateCogitaDashboardPreferences(payload: {
  layoutVersion?: string | null;
  preferencesJson: string;
}) {
  return request<CogitaDashboardPreferences>('/cogita/dashboard/preferences', {
    method: 'POST',
    body: JSON.stringify({
      layoutVersion: payload.layoutVersion ?? 'v1',
      preferencesJson: payload.preferencesJson
    })
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

export function getCogitaCreationProjects(payload: { libraryId: string; projectType?: 'storyboard' | 'text' | string }) {
  const params = new URLSearchParams();
  if (payload.projectType) {
    params.set('projectType', payload.projectType);
  }
  const qs = params.toString();
  return request<CogitaCreationProject[]>(
    `/cogita/libraries/${payload.libraryId}/creation-projects${qs ? `?${qs}` : ''}`,
    { method: 'GET' }
  );
}

export function createCogitaCreationProject(payload: {
  libraryId: string;
  projectType: 'storyboard' | 'text' | string;
  name: string;
  content?: unknown | null;
}) {
  return request<CogitaCreationProject>(
    `/cogita/libraries/${payload.libraryId}/creation-projects`,
    {
      method: 'POST',
      body: JSON.stringify({
        projectType: payload.projectType,
        name: payload.name,
        content: payload.content ?? null
      })
    }
  );
}

export function updateCogitaCreationProject(payload: {
  libraryId: string;
  projectId: string;
  name: string;
  content?: unknown | null;
}) {
  return request<CogitaCreationProject>(
    `/cogita/libraries/${payload.libraryId}/creation-projects/${payload.projectId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        content: payload.content ?? null
      })
    }
  );
}

export function deleteCogitaCreationProject(payload: { libraryId: string; projectId: string }) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/creation-projects/${payload.projectId}`,
    { method: 'DELETE' }
  );
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
    `/cogita/libraries/${payload.libraryId}/notions${qs ? `?${qs}` : ''}`,
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
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}/collections`,
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

export function deleteCogitaRevision(payload: { libraryId: string; revisionId: string }) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/revisions/${payload.revisionId}`,
    { method: 'DELETE' }
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

export function deleteCogitaCollectionDependency(payload: {
  libraryId: string;
  collectionId: string;
  parentCollectionId: string;
  childCollectionId: string;
}) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}/dependencies/${payload.parentCollectionId}/${payload.childCollectionId}`,
    { method: 'DELETE' }
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

export function getCogitaStatistics(payload: {
  libraryId: string;
  scopeType?: 'library' | 'info' | 'connection' | 'collection' | 'revision' | 'live-session';
  scopeId?: string | null;
  personRoleId?: string | null;
  participantId?: string | null;
  persistentOnly?: boolean;
  limit?: number;
  fromUtc?: string | null;
  toUtc?: string | null;
}) {
  const params = new URLSearchParams();
  if (payload.scopeType) params.set('scopeType', payload.scopeType);
  if (payload.scopeId) params.set('scopeId', payload.scopeId);
  if (payload.personRoleId) params.set('personRoleId', payload.personRoleId);
  if (payload.participantId) params.set('participantId', payload.participantId);
  if (payload.persistentOnly === true) params.set('persistentOnly', 'true');
  if (typeof payload.limit === 'number' && Number.isFinite(payload.limit)) params.set('limit', String(payload.limit));
  if (payload.fromUtc) params.set('fromUtc', payload.fromUtc);
  if (payload.toUtc) params.set('toUtc', payload.toUtc);
  const qs = params.toString();
  return request<CogitaStatisticsResponse>(
    `/cogita/libraries/${payload.libraryId}/statistics${qs ? `?${qs}` : ''}`,
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

export function createCogitaStoryboardShare(payload: {
  libraryId: string;
  projectId: string;
  signatureBase64?: string | null;
}) {
  return request<CogitaStoryboardShareCreateResponse>(`/cogita/libraries/${payload.libraryId}/storyboard-shares`, {
    method: 'POST',
    body: JSON.stringify({
      projectId: payload.projectId,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function getCogitaStoryboardShares(payload: { libraryId: string }) {
  return request<CogitaStoryboardShare[]>(`/cogita/libraries/${payload.libraryId}/storyboard-shares`, {
    method: 'GET'
  });
}

export function revokeCogitaStoryboardShare(payload: { libraryId: string; shareId: string }) {
  return request<void>(`/cogita/libraries/${payload.libraryId}/storyboard-shares/${payload.shareId}/revoke`, {
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
  const path = `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}?${params.toString()}`;
  return requestLiveStateCached<CogitaLiveRevisionSession>(
    `live-host:${payload.libraryId}:${payload.sessionId}:${payload.hostSecret}`,
    path
  );
}

export function deleteCogitaLiveRevisionSession(payload: { libraryId: string; sessionId: string }) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}`,
    { method: 'DELETE' }
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

export function addCogitaLiveRevisionParticipant(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  name: string;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/participants?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({ name: payload.name })
    }
  );
}

export function removeCogitaLiveRevisionParticipant(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  participantId: string;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/participants/${payload.participantId}?${params.toString()}`,
    { method: 'DELETE' }
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

export function resetCogitaLiveRevisionSession(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/reset?${params.toString()}`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function joinCogitaLiveRevision(payload: { code: string; name: string; useExistingName?: boolean }) {
  return request<CogitaLiveRevisionJoinResponse>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        useExistingName: Boolean(payload.useExistingName)
      })
    }
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
  const path = `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/state${params.toString() ? `?${params.toString()}` : ''}`;
  return requestLiveStateCached<CogitaLiveRevisionPublicState>(
    `live-public:${payload.code}:${payload.participantToken ?? '-'}`,
    path
  );
}

export function getCogitaLiveRevisionReview(payload: { code: string; participantToken?: string | null }) {
  const params = new URLSearchParams();
  if (payload.participantToken) params.set('participantToken', payload.participantToken);
  return request<CogitaLiveRevisionReviewRound[]>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/review${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function submitCogitaLiveRevisionAnswer(payload: {
  code: string;
  participantToken: string;
  roundIndex: number;
  cardKey?: string | null;
  answer?: unknown;
}) {
  const body: Record<string, unknown> = {
    participantToken: payload.participantToken,
    roundIndex: payload.roundIndex,
    cardKey: payload.cardKey ?? null
  };
  if (Object.prototype.hasOwnProperty.call(payload, 'answer')) {
    body.answer = payload.answer ?? null;
  }
  return request<void>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  );
}

export function controlCogitaLiveRevisionTimer(payload: {
  code: string;
  participantToken: string;
  action: 'pause' | 'resume';
  roundIndex?: number;
  source?: string;
}) {
  return request<{ paused: boolean }>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/timer`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        action: payload.action,
        roundIndex: typeof payload.roundIndex === 'number' ? payload.roundIndex : null,
        source: payload.source ?? null
      })
    }
  );
}

export function leaveCogitaLiveRevision(payload: {
  code: string;
  participantToken: string;
  roundIndex?: number;
}) {
  return request<{ left: boolean; paused?: boolean; roundIndex?: number; phase?: string }>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/leave`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        roundIndex: typeof payload.roundIndex === 'number' ? payload.roundIndex : null
      })
    }
  );
}

export function getCogitaPublicRevisionShare(payload: { shareId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<CogitaPublicRevisionShare>(
    `/cogita/public/revision/${encodeURIComponent(payload.shareId)}${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicStoryboardShare(payload: { shareCode: string }) {
  return request<CogitaPublicStoryboardShare>(`/cogita/public/storyboard/${encodeURIComponent(payload.shareCode)}`, {
    method: 'GET'
  });
}

export function getCogitaPublicRevisionInfos(payload: { shareId: string; key?: string; type?: string; query?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  return request<CogitaInfoSearchResult[]>(
    `/cogita/public/revision/${encodeURIComponent(payload.shareId)}/notions${params.toString() ? `?${params.toString()}` : ''}`,
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
    `/cogita/public/revision/${encodeURIComponent(payload.shareId)}/cards${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicComputedSample(payload: { shareId: string; infoId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<CogitaComputedSample>(
    `/cogita/public/revision/${encodeURIComponent(payload.shareId)}/computed/${payload.infoId}/sample${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaDependencyGraphs(payload: { libraryId: string }) {
  return request<CogitaDependencyGraphList>(`/cogita/libraries/${payload.libraryId}/dependency-graphs`, {
    method: 'GET'
  });
}

export function createCogitaDependencyGraph(payload: {
  libraryId: string;
  name?: string | null;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<CogitaDependencyGraphSummary>(`/cogita/libraries/${payload.libraryId}/dependency-graphs`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name ?? null,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function activateCogitaDependencyGraph(payload: { libraryId: string; graphId: string }) {
  return request<void>(`/cogita/libraries/${payload.libraryId}/dependency-graphs/${payload.graphId}/activate`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function updateCogitaDependencyGraph(payload: { libraryId: string; graphId: string; name?: string | null }) {
  return request<CogitaDependencyGraphSummary>(`/cogita/libraries/${payload.libraryId}/dependency-graphs/${payload.graphId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: payload.name ?? null
    })
  });
}

export function deleteCogitaDependencyGraph(payload: { libraryId: string; graphId: string }) {
  return request<{ deleted: boolean }>(`/cogita/libraries/${payload.libraryId}/dependency-graphs/${payload.graphId}`, {
    method: 'DELETE'
  });
}

export function getCogitaDependencyGraph(payload: { libraryId: string; graphId?: string | null }) {
  const query = payload.graphId ? `?graphId=${encodeURIComponent(payload.graphId)}` : '';
  return request<CogitaDependencyGraph>(`/cogita/libraries/${payload.libraryId}/dependency-graph${query}`, {
    method: 'GET'
  });
}

export function saveCogitaDependencyGraph(payload: {
  libraryId: string;
  graphId?: string | null;
  nodes: Array<{ nodeId?: string | null; nodeType: string; payload: unknown }>;
  edges: Array<{ edgeId?: string | null; fromNodeId: string; toNodeId: string }>;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  const query = payload.graphId ? `?graphId=${encodeURIComponent(payload.graphId)}` : '';
  return request<CogitaDependencyGraph>(`/cogita/libraries/${payload.libraryId}/dependency-graph${query}`, {
    method: 'PUT',
    body: JSON.stringify({
      nodes: payload.nodes,
      edges: payload.edges,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function previewCogitaDependencyGraph(payload: { libraryId: string; graphId?: string | null }) {
  const query = payload.graphId ? `?graphId=${encodeURIComponent(payload.graphId)}` : '';
  return request<CogitaDependencyGraphPreview>(`/cogita/libraries/${payload.libraryId}/dependency-graph/preview${query}`, {
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
  return request<CogitaItemDependencyBundle>(`/cogita/public/revision/${encodeURIComponent(payload.shareId)}/dependencies${qs ? `?${qs}` : ''}`, {
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
  return request<CogitaInfoCreateResponse>(`/cogita/libraries/${payload.libraryId}/notions`, {
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
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}`,
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
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}/approaches/${encodeURIComponent(payload.approachKey)}`,
    { method: 'GET' }
  );
}

export function getCogitaInfoCheckcards(payload: { libraryId: string; infoId: string }) {
  return request<CogitaCardSearchBundle>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}/cards`,
    { method: 'GET' }
  );
}

export function getCogitaInfoCheckcardDependencies(payload: { libraryId: string; infoId: string }) {
  return request<CogitaItemDependencyBundle>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}/cards/dependencies`,
    { method: 'GET' }
  );
}

export function getCogitaPublicInfoDetail(payload: { shareCode: string; infoId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<{ infoId: string; infoType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/public/revision/${encodeURIComponent(payload.shareCode)}/notions/${payload.infoId}${params.toString() ? `?${params.toString()}` : ''}`,
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
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}`,
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

export function deleteCogitaInfo(payload: { libraryId: string; infoId: string }) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.infoId}`,
    { method: 'DELETE' }
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

export function deleteCogitaCollection(payload: { libraryId: string; collectionId: string }) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/collections/${payload.collectionId}`,
    { method: 'DELETE' }
  );
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

export type CogitaCoreRunSummary = {
  runId: string;
  libraryId: string;
  revisionPatternId: string;
  runScope: 'solo' | 'shared' | 'group_async' | 'group_sync' | string;
  title?: string | null;
  status: 'draft' | 'lobby' | 'active' | 'paused' | 'finished' | 'archived' | string;
  createdUtc: string;
  updatedUtc: string;
  participantCount: number;
  totalCards: number;
};

export type CogitaCoreRunParticipant = {
  participantId: string;
  runId: string;
  personRoleId?: string | null;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
  joinedUtc: string;
  updatedUtc: string;
  recoveryToken?: string | null;
  recoveryExpiresUtc?: string | null;
};

export type CogitaCoreRunState = {
  run: CogitaCoreRunSummary;
  participants: CogitaCoreRunParticipant[];
  participantProgress: {
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    blankTimeoutCount: number;
    completionPct: number;
  };
  totalAttempts: number;
  totalEvents: number;
};

export type CogitaCoreNextCard = {
  cardKey?: string | null;
  roundIndex?: number | null;
  reason: string;
  reasonTrace: string[];
  totalCards: number;
  blockedCards: number;
};

export type CogitaCoreScoreFactor = {
  factor: string;
  points: number;
};

export type CogitaCoreReveal = {
  runId: string;
  participantId: string;
  roundIndex: number;
  cardKey: string;
  correctAnswer?: string | null;
  participantAnswer?: string | null;
  pastAnswers: Array<{
    roundIndex: number;
    submittedUtc: string;
    outcomeClass: string;
    answer?: string | null;
  }>;
  outcomeDistribution: {
    correctCount: number;
    wrongCount: number;
    blankTimeoutCount: number;
    correctPct: number;
    wrongPct: number;
    blankTimeoutPct: number;
  };
  scoreFactors: CogitaCoreScoreFactor[];
  totalPoints: number;
};

export type CogitaCoreRunAttemptResult = {
  attemptId: string;
  runId: string;
  participantId: string;
  roundIndex: number;
  cardKey: string;
  outcomeClass: string;
  submittedUtc: string;
  revealedUtc?: string | null;
  responseDurationMs?: number | null;
  totalPoints: number;
  scoreFactors: CogitaCoreScoreFactor[];
  reveal: CogitaCoreReveal;
  charComparison?: {
    comparedLength: number;
    mismatchCount: number;
    similarityPct: number;
    mismatchesPreview: Array<{
      index: number;
      expected?: string | null;
      actual?: string | null;
    }>;
  } | null;
  knownessSnapshot?: {
    snapshotId: string;
    libraryId: string;
    personRoleId: string;
    cardKey: string;
    knownessPct: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    snapshotUtc: string;
    sourceRunId?: string | null;
    sourceParticipantId?: string | null;
  } | null;
  knownessPropagation: Array<{
    parentCardKey: string;
    parentDirectKnowness: number;
    childContribution: number;
    parentKnowness: number;
  }>;
};

export type CogitaCoreRunStatistics = {
  runId: string;
  runScope: string;
  status: string;
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  totalBlankTimeout: number;
  knownessScore: number;
  totalPoints: number;
  participants: Array<{
    participantId: string;
    displayName: string;
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    blankTimeoutCount: number;
    knownessScore: number;
    totalPoints: number;
    averageDurationMs: number;
  }>;
  timeline: Array<{
    index: number;
    createdUtc: string;
    participantId: string;
    participantLabel: string;
    roundIndex?: number | null;
    cardKey?: string | null;
    outcomeClass: string;
    points: number;
    durationMs: number;
  }>;
};

export function createCogitaCoreRun(payload: {
  libraryId: string;
  revisionPatternId?: string | null;
  runScope: 'solo' | 'shared' | 'group_async' | 'group_sync' | string;
  title?: string | null;
  status?: 'draft' | 'lobby' | 'active' | 'paused' | 'finished' | 'archived' | string;
  settingsJson?: string | null;
  promptBundleJson?: string | null;
}) {
  return request<CogitaCoreRunSummary>(`/cogita/revision/libraries/${payload.libraryId}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      revisionPatternId: payload.revisionPatternId ?? null,
      runScope: payload.runScope,
      title: payload.title ?? null,
      status: payload.status ?? null,
      settingsJson: payload.settingsJson ?? null,
      promptBundleJson: payload.promptBundleJson ?? null
    })
  });
}

export function joinCogitaCoreRun(payload: {
  libraryId: string;
  runId: string;
  personRoleId?: string | null;
  displayName?: string | null;
  isHost?: boolean;
  recoveryToken?: string | null;
}) {
  return request<CogitaCoreRunParticipant>(`/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/participants`, {
    method: 'POST',
    body: JSON.stringify({
      personRoleId: payload.personRoleId ?? null,
      displayName: payload.displayName ?? null,
      isHost: Boolean(payload.isHost),
      recoveryToken: payload.recoveryToken ?? null
    })
  });
}

export function setCogitaCoreRunStatus(payload: {
  libraryId: string;
  runId: string;
  status: 'draft' | 'lobby' | 'active' | 'paused' | 'finished' | 'archived' | string;
  reason?: string | null;
}) {
  return request<{
    runId: string;
    status: string;
    startedUtc?: string | null;
    finishedUtc?: string | null;
    updatedUtc: string;
  }>(`/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/status`, {
    method: 'POST',
    body: JSON.stringify({
      status: payload.status,
      reason: payload.reason ?? null
    })
  });
}

export function getCogitaCoreRunState(payload: {
  libraryId: string;
  runId: string;
  participantId?: string | null;
}) {
  const params = new URLSearchParams();
  if (payload.participantId) params.set('participantId', payload.participantId);
  return request<CogitaCoreRunState>(
    `/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/runtime/state${params.toString() ? `?${params.toString()}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function getCogitaCoreNextCard(payload: {
  libraryId: string;
  runId: string;
  participantId: string;
  participantSeed?: string | null;
}) {
  return request<CogitaCoreNextCard>(`/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/runtime/next-card`, {
    method: 'POST',
    body: JSON.stringify({
      participantId: payload.participantId,
      participantSeed: payload.participantSeed ?? payload.participantId
    })
  });
}

export function submitCogitaCoreRunAttempt(payload: {
  libraryId: string;
  runId: string;
  participantId: string;
  roundIndex: number;
  cardKey: string;
  answer?: string | null;
  outcomeClass: 'correct' | 'wrong' | 'blank_timeout' | string;
  responseDurationMs?: number | null;
  promptShownUtc?: string | null;
  revealedUtc?: string | null;
}) {
  return request<CogitaCoreRunAttemptResult>(`/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/runtime/attempt`, {
    method: 'POST',
    body: JSON.stringify({
      participantId: payload.participantId,
      roundIndex: payload.roundIndex,
      cardKey: payload.cardKey,
      answer: payload.answer ?? null,
      outcomeClass: payload.outcomeClass,
      responseDurationMs: payload.responseDurationMs ?? null,
      promptShownUtc: payload.promptShownUtc ?? null,
      revealedUtc: payload.revealedUtc ?? null
    })
  });
}

export function getCogitaCoreRunReveal(payload: {
  libraryId: string;
  runId: string;
  participantId: string;
  roundIndex: number;
  cardKey?: string | null;
}) {
  const params = new URLSearchParams({
    participantId: payload.participantId,
    roundIndex: String(payload.roundIndex)
  });
  if (payload.cardKey) params.set('cardKey', payload.cardKey);
  return request<CogitaCoreReveal>(
    `/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/runtime/reveal?${params.toString()}`,
    {
      method: 'GET'
    }
  );
}

export function getCogitaCoreRunStatistics(payload: {
  libraryId: string;
  runId: string;
}) {
  return request<CogitaCoreRunStatistics>(
    `/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/runtime/statistics`,
    {
      method: 'GET'
    }
  );
}

export function appendCogitaCoreRunEvent(payload: {
  libraryId: string;
  runId: string;
  participantId?: string | null;
  eventType: string;
  roundIndex?: number | null;
  payloadJson?: string | null;
}) {
  return request<{
    eventId: string;
    runId: string;
    participantId?: string | null;
    eventType: string;
    roundIndex?: number | null;
    payloadJson?: string | null;
    createdUtc: string;
  }>(`/cogita/revision/libraries/${payload.libraryId}/runs/${payload.runId}/runtime/events`, {
    method: 'POST',
    body: JSON.stringify({
      participantId: payload.participantId ?? null,
      eventType: payload.eventType,
      roundIndex: payload.roundIndex ?? null,
      payloadJson: payload.payloadJson ?? null
    })
  });
}

export function syncCogitaLegacyReviewOutcomesToCore(payload: {
  libraryId: string;
  outcomes: Array<{
    itemType: 'info' | 'connection' | string;
    itemId: string;
    checkType?: string | null;
    direction?: string | null;
    revisionType?: string | null;
    evalType?: string | null;
    correct: boolean;
    clientId: string;
    clientSequence: number;
    durationMs?: number | null;
    personRoleId?: string | null;
  }>;
}) {
  return request<{ synced: number; skipped: number }>(`/cogita/revision/libraries/${payload.libraryId}/legacy/review-outcomes/sync`, {
    method: 'POST',
    body: JSON.stringify({
      outcomes: payload.outcomes
    })
  });
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

export type ParishSacramentSection = {
  title: string;
  body: string;
};

export type ParishSacramentParishPage = {
  title: string;
  lead: string;
  notice?: string | null;
  sections: ParishSacramentSection[];
};

export type ParishHomepageConfig = {
  modules: ParishLayoutItem[];
  sacramentParishPages?: Record<string, ParishSacramentParishPage> | null;
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

export type ParishConfirmationPhone = {
  index: number;
  number: string;
  isVerified: boolean;
  verifiedUtc?: string | null;
  verificationToken: string;
};

export type ParishConfirmationCandidate = {
  id: string;
  name: string;
  surname: string;
  phoneNumbers: ParishConfirmationPhone[];
  address: string;
  schoolShort: string;
  acceptedRodo: boolean;
  createdUtc: string;
  meetingToken: string;
  meetingSlotId?: string | null;
};

export type ParishConfirmationMeetingSlotCandidate = {
  candidateId: string;
  name: string;
  surname: string;
};

export type ParishConfirmationMeetingSlot = {
  id: string;
  startsAtUtc: string;
  durationMinutes: number;
  capacity: number;
  label?: string | null;
  stage: string;
  isActive: boolean;
  reservedCount: number;
  candidates: ParishConfirmationMeetingSlotCandidate[];
};

export type ParishConfirmationMeetingSummary = {
  slots: ParishConfirmationMeetingSlot[];
  unassignedCount: number;
};

export type ParishConfirmationMeetingPublicSlot = {
  id: string;
  startsAtUtc: string;
  durationMinutes: number;
  capacity: number;
  label?: string | null;
  stage: string;
  reservedCount: number;
  isAvailable: boolean;
  requiresInviteLink: boolean;
  isSelected: boolean;
};

export type ParishConfirmationMeetingAvailability = {
  candidateId: string;
  candidateName: string;
  selectedSlotId?: string | null;
  bookedUtc?: string | null;
  canInviteToSelectedSlot: boolean;
  selectedSlotInviteToken?: string | null;
  selectedSlotInviteExpiresUtc?: string | null;
  slots: ParishConfirmationMeetingPublicSlot[];
};

export type ParishConfirmationPortalCandidate = {
  candidateId: string;
  name: string;
  surname: string;
  phoneNumbers: ParishConfirmationPhone[];
  address: string;
  schoolShort: string;
  portalToken: string;
  selectedSlotId?: string | null;
  bookedUtc?: string | null;
  canInviteToSelectedSlot: boolean;
  selectedSlotInviteToken?: string | null;
  selectedSlotInviteExpiresUtc?: string | null;
};

export type ParishConfirmationMessage = {
  id: string;
  senderType: 'candidate' | 'admin' | string;
  messageText: string;
  createdUtc: string;
};

export type ParishConfirmationNote = {
  id: string;
  noteText: string;
  isPublic: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationPortal = {
  candidate: ParishConfirmationPortalCandidate;
  firstYearStartSlots: ParishConfirmationMeetingPublicSlot[];
  secondMeetingAnnouncement: string;
  messages: ParishConfirmationMessage[];
  publicNotes: ParishConfirmationNote[];
  privateNotes?: ParishConfirmationNote[] | null;
};

export type ParishConfirmationExportPhone = {
  index: number;
  number: string;
  isVerified: boolean;
  verifiedUtc?: string | null;
  verificationToken: string;
  createdUtc?: string | null;
};

export type ParishConfirmationExportCandidate = {
  name: string;
  surname: string;
  phoneNumbers: ParishConfirmationExportPhone[];
  address: string;
  schoolShort: string;
  acceptedRodo: boolean;
  createdUtc: string;
  updatedUtc: string;
  meetingToken?: string | null;
  meetingSlotId?: string | null;
};

export type ParishConfirmationExport = {
  version: number;
  parishId: string;
  exportedUtc: string;
  candidates: ParishConfirmationExportCandidate[];
};

export type ParishConfirmationImport = {
  candidates: ParishConfirmationExportCandidate[];
  replaceExisting: boolean;
};

export type ParishConfirmationImportResponse = {
  importedCandidates: number;
  importedPhoneNumbers: number;
  skippedCandidates: number;
  replaceExisting: boolean;
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

export function createParishConfirmationCandidate(
  slug: string,
  payload: {
    name: string;
    surname: string;
    phoneNumbers: string[];
    address: string;
    schoolShort: string;
    acceptedRodo: boolean;
  }
) {
  return request<{ id: string }>(`/parish/${slug}/public/confirmation-candidates`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      surname: payload.surname,
      phoneNumbers: payload.phoneNumbers,
      address: payload.address,
      schoolShort: payload.schoolShort,
      acceptedRodo: payload.acceptedRodo
    })
  });
}

export function verifyParishConfirmationPhone(slug: string, token: string) {
  return request<{ status: string; verifiedUtc?: string | null }>(`/parish/${slug}/public/confirmation-phone-verify`, {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export function listParishConfirmationCandidates(parishId: string) {
  return request<ParishConfirmationCandidate[]>(`/parish/${parishId}/confirmation-candidates`, {
    method: 'GET'
  });
}

export function exportParishConfirmationCandidates(parishId: string) {
  return request<ParishConfirmationExport>(`/parish/${parishId}/confirmation-candidates/export`, {
    method: 'GET'
  });
}

export function importParishConfirmationCandidates(parishId: string, payload: ParishConfirmationImport) {
  return request<ParishConfirmationImportResponse>(`/parish/${parishId}/confirmation-candidates/import`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: payload.candidates,
      replaceExisting: payload.replaceExisting
    })
  });
}

export function listParishConfirmationMeetingSlots(parishId: string) {
  return request<ParishConfirmationMeetingSummary>(`/parish/${parishId}/confirmation-meeting-slots`, {
    method: 'GET'
  });
}

export function createParishConfirmationMeetingSlot(
  parishId: string,
  payload: {
    startsAtUtc: string;
    durationMinutes: number;
    capacity: number;
    label?: string | null;
    stage?: string | null;
  }
) {
  return request<ParishConfirmationMeetingSlot>(`/parish/${parishId}/confirmation-meeting-slots`, {
    method: 'POST',
    body: JSON.stringify({
      startsAtUtc: payload.startsAtUtc,
      durationMinutes: payload.durationMinutes,
      capacity: payload.capacity,
      label: payload.label ?? null,
      stage: payload.stage ?? null
    })
  });
}

export function deleteParishConfirmationMeetingSlot(parishId: string, slotId: string) {
  return request<void>(`/parish/${parishId}/confirmation-meeting-slots/${slotId}`, {
    method: 'DELETE'
  });
}

export function getParishConfirmationMeetingAvailability(slug: string, token: string, inviteToken?: string | null) {
  return request<ParishConfirmationMeetingAvailability>(`/parish/${slug}/public/confirmation-meeting-availability`, {
    method: 'POST',
    body: JSON.stringify({
      token,
      inviteToken: inviteToken ?? null
    })
  });
}

export function bookParishConfirmationMeetingSlot(
  slug: string,
  payload: { token: string; slotId: string; inviteToken?: string | null }
) {
  return request<{ status: string; slotId?: string | null; bookedUtc?: string | null }>(
    `/parish/${slug}/public/confirmation-meeting-book`,
    {
      method: 'POST',
      body: JSON.stringify({
        token: payload.token,
        slotId: payload.slotId,
        inviteToken: payload.inviteToken ?? null
      })
    }
  );
}

export function getParishConfirmationCandidatePortal(slug: string, token: string, inviteToken?: string | null) {
  return request<ParishConfirmationPortal>(`/parish/${slug}/public/confirmation-candidate-portal`, {
    method: 'POST',
    body: JSON.stringify({
      token,
      inviteToken: inviteToken ?? null
    })
  });
}

export function sendParishConfirmationCandidateMessage(slug: string, payload: { token: string; messageText: string }) {
  return request<ParishConfirmationMessage>(`/parish/${slug}/public/confirmation-candidate-message`, {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      messageText: payload.messageText
    })
  });
}

export function getParishConfirmationCandidatePortalAdmin(parishId: string, candidateId: string) {
  return request<ParishConfirmationPortal>(`/parish/${parishId}/confirmation-candidates/${candidateId}/portal`, {
    method: 'GET'
  });
}

export function updateParishConfirmationCandidate(
  parishId: string,
  candidateId: string,
  payload: {
    name: string;
    surname: string;
    phoneNumbers: string[];
    address: string;
    schoolShort: string;
  }
) {
  return request<void>(`/parish/${parishId}/confirmation-candidates/${candidateId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function mergeParishConfirmationCandidates(
  parishId: string,
  payload: {
    targetCandidateId: string;
    sourceCandidateId: string;
    name: string;
    surname: string;
    phoneNumbers: string[];
    address: string;
    schoolShort: string;
    selectedMeetingSlotId?: string | null;
    portalTokenFromCandidateId?: string | null;
  }
) {
  return request<{ candidateId: string; removedCandidateId: string }>(`/parish/${parishId}/confirmation-candidates/merge`, {
    method: 'POST',
    body: JSON.stringify({
      targetCandidateId: payload.targetCandidateId,
      sourceCandidateId: payload.sourceCandidateId,
      name: payload.name,
      surname: payload.surname,
      phoneNumbers: payload.phoneNumbers,
      address: payload.address,
      schoolShort: payload.schoolShort,
      selectedMeetingSlotId: payload.selectedMeetingSlotId ?? null,
      portalTokenFromCandidateId: payload.portalTokenFromCandidateId ?? null
    })
  });
}

export function sendParishConfirmationAdminMessage(parishId: string, candidateId: string, messageText: string) {
  return request<ParishConfirmationMessage>(`/parish/${parishId}/confirmation-candidates/${candidateId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messageText })
  });
}

export function addParishConfirmationNote(
  parishId: string,
  candidateId: string,
  payload: { noteText: string; isPublic: boolean }
) {
  return request<ParishConfirmationNote>(`/parish/${parishId}/confirmation-candidates/${candidateId}/notes`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateParishConfirmationNote(
  parishId: string,
  candidateId: string,
  noteId: string,
  payload: { noteText: string; isPublic: boolean }
) {
  return request<ParishConfirmationNote>(`/parish/${parishId}/confirmation-candidates/${candidateId}/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
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

export type PilgrimageCard = {
  id: string;
  title: string;
  body: string;
  meta?: string | null;
  accent?: string | null;
};

export type PilgrimageSection = {
  id: string;
  title: string;
  lead?: string | null;
  cards: PilgrimageCard[];
};

export type PilgrimagePublicConfig = {
  heroTitle: string;
  heroSubtitle: string;
  dateLabel: string;
  routeLabel: string;
  heroFacts: PilgrimageCard[];
  sections: PilgrimageSection[];
};

export type PilgrimageZoneConfig = {
  sections: PilgrimageSection[];
};

export type PilgrimageSiteDocument = {
  public: PilgrimagePublicConfig;
  participant: PilgrimageZoneConfig;
  organizer: PilgrimageZoneConfig;
};

export type PilgrimageSite = {
  id?: string | null;
  slug: string;
  name: string;
  motto: string;
  startDate: string;
  endDate: string;
  startLocation: string;
  endLocation: string;
  distanceKm?: number | null;
  theme: string;
  site: PilgrimageSiteDocument;
  isProvisioned: boolean;
};

export type PilgrimageRegistrationRequest = {
  fullName: string;
  phone: string;
  email?: string | null;
  parish?: string | null;
  birthDate?: string | null;
  isMinor: boolean;
  participationVariant: string;
  needsLodging: boolean;
  needsBaggageTransport: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  healthNotes?: string | null;
  dietNotes?: string | null;
  acceptedTerms: boolean;
  acceptedRodo: boolean;
  acceptedImageConsent: boolean;
};

export type PilgrimageRegistrationResponse = {
  participantId: string;
  accessToken: string;
  accessLink: string;
  expiresUtc: string;
};

export type PilgrimageRegistrationTransferRow = {
  fullName: string;
  phone: string;
  email?: string | null;
  parish?: string | null;
  birthDate?: string | null;
  isMinor: boolean;
  participationVariant: string;
  needsLodging: boolean;
  needsBaggageTransport: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  healthNotes?: string | null;
  dietNotes?: string | null;
  acceptedTerms: boolean;
  acceptedRodo: boolean;
  acceptedImageConsent: boolean;
  registrationStatus?: string | null;
  paymentStatus?: string | null;
  attendanceStatus?: string | null;
  groupName?: string | null;
  createdUtc?: string | null;
  updatedUtc?: string | null;
};

export type PilgrimageRegistrationExport = {
  eventId: string;
  slug: string;
  exportedUtc: string;
  rows: PilgrimageRegistrationTransferRow[];
};

export type PilgrimageRegistrationImportRequest = {
  rows: PilgrimageRegistrationTransferRow[];
  replaceExisting: boolean;
};

export type PilgrimageRegistrationImportResponse = {
  importedRegistrations: number;
  skippedRegistrations: number;
  replaceExisting: boolean;
};

export type PilgrimageParticipantProfile = {
  participantId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  parish?: string | null;
  birthDate?: string | null;
  isMinor: boolean;
  participationVariant: string;
  groupName?: string | null;
  needsLodging: boolean;
  needsBaggageTransport: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  healthNotes?: string | null;
  dietNotes?: string | null;
  registrationStatus: string;
  paymentStatus: string;
  attendanceStatus: string;
  createdUtc: string;
};

export type PilgrimageAnnouncement = {
  id: string;
  audience: string;
  title: string;
  body: string;
  isCritical: boolean;
  createdUtc: string;
};

export type PilgrimageParticipantZone = {
  participant: PilgrimageParticipantProfile;
  zone: PilgrimageZoneConfig;
  announcements: PilgrimageAnnouncement[];
};

export type PilgrimageOrganizerStats = {
  registrations: number;
  confirmed: number;
  paid: number;
  withLodging: number;
  oneDay: number;
  minors: number;
  openTasks: number;
  criticalAnnouncements: number;
};

export type PilgrimageOrganizerParticipantRow = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  participationVariant: string;
  groupName?: string | null;
  needsLodging: boolean;
  needsBaggageTransport: boolean;
  isMinor: boolean;
  registrationStatus: string;
  paymentStatus: string;
  attendanceStatus: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  healthNotes?: string | null;
  dietNotes?: string | null;
  createdUtc: string;
};

export type PilgrimageTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  comments?: string | null;
  attachments?: string | null;
  dueUtc?: string | null;
  createdUtc: string;
  updatedUtc: string;
};

export type PilgrimageParticipantIssue = {
  id: string;
  participantId: string;
  participantName: string;
  kind: string;
  message: string;
  status: string;
  resolutionNote?: string | null;
  createdUtc: string;
  updatedUtc: string;
};

export type PilgrimageContactInquiry = {
  id: string;
  name: string;
  phone?: string | null;
  isPublicQuestion: boolean;
  email?: string | null;
  topic: string;
  message: string;
  status: string;
  publicAnswer?: string | null;
  publicAnsweredBy?: string | null;
  publicAnsweredUtc?: string | null;
  createdUtc: string;
  updatedUtc: string;
};

export type PilgrimagePublicInquiryAnswer = {
  id: string;
  name: string;
  topic: string;
  message: string;
  publicAnswer: string;
  publicAnsweredBy?: string | null;
  publicAnsweredUtc?: string | null;
  createdUtc: string;
};

export type PilgrimageOrganizerDashboard = {
  stats: PilgrimageOrganizerStats;
  participants: PilgrimageOrganizerParticipantRow[];
  announcements: PilgrimageAnnouncement[];
  tasks: PilgrimageTask[];
  issues: PilgrimageParticipantIssue[];
  inquiries: PilgrimageContactInquiry[];
  zone: PilgrimageZoneConfig;
};

export function getPilgrimageSite(slug: string) {
  return request<PilgrimageSite>(`/pilgrimage/${slug}`, {
    method: 'GET'
  });
}

export function createPilgrimageRegistration(slug: string, payload: PilgrimageRegistrationRequest) {
  return request<PilgrimageRegistrationResponse>(`/pilgrimage/${slug}/public/registrations`, {
    method: 'POST',
    body: JSON.stringify({
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email ?? null,
      parish: payload.parish ?? null,
      birthDate: payload.birthDate ?? null,
      isMinor: payload.isMinor,
      participationVariant: payload.participationVariant,
      needsLodging: payload.needsLodging,
      needsBaggageTransport: payload.needsBaggageTransport,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
      healthNotes: payload.healthNotes ?? null,
      dietNotes: payload.dietNotes ?? null,
      acceptedTerms: payload.acceptedTerms,
      acceptedRodo: payload.acceptedRodo,
      acceptedImageConsent: payload.acceptedImageConsent
    })
  });
}

export function getPilgrimageParticipantZone(slug: string, token: string) {
  const query = new URLSearchParams({ token });
  return request<PilgrimageParticipantZone>(`/pilgrimage/${slug}/participant-zone?${query.toString()}`, {
    method: 'GET'
  });
}

export function createPilgrimageParticipantIssue(
  slug: string,
  token: string,
  payload: { kind?: string; message: string }
) {
  const query = new URLSearchParams({ token });
  return request<string>(`/pilgrimage/${slug}/participant-zone/issues?${query.toString()}`, {
    method: 'POST',
    body: JSON.stringify({
      kind: payload.kind ?? 'problem',
      message: payload.message
    })
  });
}

export function createPilgrimageContactInquiry(
  slug: string,
  payload: { name: string; phone?: string | null; isPublicQuestion: boolean; email?: string | null; topic: string; message: string }
) {
  return request<string>(`/pilgrimage/${slug}/public/contact`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      phone: payload.phone ?? null,
      isPublicQuestion: payload.isPublicQuestion,
      email: payload.email ?? null,
      topic: payload.topic,
      message: payload.message
    })
  });
}

export type EventsLimanowaAdminStatus = {
  hasAdmin: boolean;
  isCurrentUserAdmin: boolean;
  adminDisplayName?: string | null;
  kal26Provisioned: boolean;
};

export function getEventsLimanowaAdminStatus() {
  return request<EventsLimanowaAdminStatus>('/pilgrimage/admin/events-limanowa/status', {
    method: 'GET'
  });
}

export function claimEventsLimanowaAdmin() {
  return request<{ claimed: boolean }>('/pilgrimage/admin/events-limanowa/claim', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function bootstrapKal26Event() {
  return request('/pilgrimage/admin/events-limanowa/bootstrap-kal26', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getPilgrimagePublicInquiryAnswers(slug: string) {
  return request<PilgrimagePublicInquiryAnswer[]>(`/pilgrimage/${slug}/public/contact/answers`, {
    method: 'GET'
  });
}

export function getPilgrimageOrganizerDashboard(eventId: string) {
  return request<PilgrimageOrganizerDashboard>(`/pilgrimage/${eventId}/organizer/dashboard`, {
    method: 'GET'
  });
}

export function createPilgrimageAnnouncement(
  eventId: string,
  payload: { audience: string; title: string; body: string; isCritical?: boolean }
) {
  return request<string>(`/pilgrimage/${eventId}/organizer/announcements`, {
    method: 'POST',
    body: JSON.stringify({
      audience: payload.audience,
      title: payload.title,
      body: payload.body,
      isCritical: payload.isCritical ?? false
    })
  });
}

export function createPilgrimageTask(
  eventId: string,
  payload: {
    title: string;
    description: string;
    status?: string;
    priority?: string;
    assignee?: string;
    comments?: string | null;
    attachments?: string | null;
    dueUtc?: string | null;
  }
) {
  return request<string>(`/pilgrimage/${eventId}/organizer/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      status: payload.status ?? 'todo',
      priority: payload.priority ?? 'normal',
      assignee: payload.assignee ?? '',
      comments: payload.comments ?? null,
      attachments: payload.attachments ?? null,
      dueUtc: payload.dueUtc ?? null
    })
  });
}

export function updatePilgrimageTask(
  eventId: string,
  taskId: string,
  payload: {
    title: string;
    description: string;
    status?: string;
    priority?: string;
    assignee?: string;
    comments?: string | null;
    attachments?: string | null;
    dueUtc?: string | null;
  }
) {
  return request<void>(`/pilgrimage/${eventId}/organizer/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      status: payload.status ?? 'todo',
      priority: payload.priority ?? 'normal',
      assignee: payload.assignee ?? '',
      comments: payload.comments ?? null,
      attachments: payload.attachments ?? null,
      dueUtc: payload.dueUtc ?? null
    })
  });
}

export function updatePilgrimageParticipant(
  eventId: string,
  participantId: string,
  payload: {
    registrationStatus: string;
    paymentStatus: string;
    attendanceStatus: string;
    groupName?: string | null;
    needsLodging?: boolean;
    needsBaggageTransport?: boolean;
  }
) {
  return request<void>(`/pilgrimage/${eventId}/organizer/participants/${participantId}`, {
    method: 'PUT',
    body: JSON.stringify({
      registrationStatus: payload.registrationStatus,
      paymentStatus: payload.paymentStatus,
      attendanceStatus: payload.attendanceStatus,
      groupName: payload.groupName ?? null,
      needsLodging: payload.needsLodging ?? null,
      needsBaggageTransport: payload.needsBaggageTransport ?? null
    })
  });
}

export function updatePilgrimageIssue(
  eventId: string,
  issueId: string,
  payload: { status: string; resolutionNote?: string | null }
) {
  return request<void>(`/pilgrimage/${eventId}/organizer/issues/${issueId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: payload.status,
      resolutionNote: payload.resolutionNote ?? null
    })
  });
}

export function updatePilgrimageInquiry(
  eventId: string,
  inquiryId: string,
  payload: { status: string; publicAnswer?: string | null }
) {
  return request<void>(`/pilgrimage/${eventId}/organizer/inquiries/${inquiryId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: payload.status,
      publicAnswer: payload.publicAnswer ?? null
    })
  });
}

export type PilgrimageExportKind =
  | 'participants'
  | 'lodging'
  | 'payments'
  | 'contacts'
  | 'groups'
  | 'attendance';

export function getPilgrimageExportUrl(eventId: string, kind: PilgrimageExportKind) {
  return `${apiBase}/pilgrimage/${eventId}/organizer/exports/${kind}.csv`;
}

export function getPilgrimageParticipantsExportUrl(eventId: string) {
  return getPilgrimageExportUrl(eventId, 'participants');
}

export function exportPilgrimageRegistrations(eventId: string) {
  return request<PilgrimageRegistrationExport>(`/pilgrimage/${eventId}/organizer/registrations/export`, {
    method: 'GET'
  });
}

export function importPilgrimageRegistrations(eventId: string, payload: PilgrimageRegistrationImportRequest) {
  return request<PilgrimageRegistrationImportResponse>(`/pilgrimage/${eventId}/organizer/registrations/import`, {
    method: 'POST',
    body: JSON.stringify({
      rows: payload.rows,
      replaceExisting: payload.replaceExisting
    })
  });
}

export type ChatParticipant = {
  participantId: string;
  subjectType: 'role' | 'user';
  subjectId: string;
  displayLabel?: string | null;
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  canRespondPublic: boolean;
  joinedUtc: string;
  removedUtc?: string | null;
};

export type ChatSummary = {
  conversationId: string;
  chatType: 'group' | 'direct' | 'public-board';
  scopeType: 'global' | 'parish' | 'event' | 'limanowa' | 'cogita';
  scopeId?: string | null;
  title: string;
  description?: string | null;
  isPublic: boolean;
  publicReadEnabled: boolean;
  publicQuestionEnabled: boolean;
  lastMessageSequence: number;
  lastReadSequence: number;
  unreadCount: number;
  updatedUtc: string;
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  canRespondPublic: boolean;
  hasActivePublicLink: boolean;
};

export type ChatDetail = {
  summary: ChatSummary;
  participants: ChatParticipant[];
};

export type ChatMessage = {
  messageId: string;
  conversationId: string;
  sequence: number;
  senderUserId?: string | null;
  senderRoleId?: string | null;
  senderDisplay: string;
  messageType: 'text' | 'question' | 'answer' | 'system';
  visibility: 'internal' | 'public';
  text: string;
  clientMessageId?: string | null;
  createdUtc: string;
  editedUtc?: string | null;
  deletedUtc?: string | null;
};

export type ChatMessagesResponse = {
  conversationId: string;
  lastSequence: number;
  messages: ChatMessage[];
};

export type ChatPublicConversation = {
  conversationId: string;
  title: string;
  scopeType: string;
  scopeId?: string | null;
  messages: ChatMessagesResponse;
};

export type ChatPublicLinkResponse = {
  linkId: string;
  code: string;
  label: string;
  createdUtc: string;
  expiresUtc?: string | null;
  isActive: boolean;
};

export function listChatConversations(payload?: { scopeType?: string; scopeId?: string }) {
  const params = new URLSearchParams();
  if (payload?.scopeType) params.set('scopeType', payload.scopeType);
  if (payload?.scopeId) params.set('scopeId', payload.scopeId);
  const query = params.toString();
  return request<ChatSummary[]>(`/chat/conversations${query ? `?${query}` : ''}`, {
    method: 'GET'
  });
}

export function createChatConversation(payload: {
  chatType: 'group' | 'direct' | 'public-board';
  scopeType: 'global' | 'parish' | 'event' | 'limanowa' | 'cogita';
  scopeId?: string | null;
  title: string;
  description?: string | null;
  isPublic?: boolean;
  publicReadEnabled?: boolean;
  publicQuestionEnabled?: boolean;
  createdByRoleId?: string | null;
  participants: Array<{
    subjectType: 'role' | 'user';
    subjectId: string;
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
    canRespondPublic: boolean;
  }>;
}) {
  return request<ChatDetail>('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({
      chatType: payload.chatType,
      scopeType: payload.scopeType,
      scopeId: payload.scopeId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      isPublic: payload.isPublic ?? false,
      publicReadEnabled: payload.publicReadEnabled ?? false,
      publicQuestionEnabled: payload.publicQuestionEnabled ?? false,
      createdByRoleId: payload.createdByRoleId ?? null,
      participants: payload.participants
    })
  });
}

export function getChatConversation(conversationId: string) {
  return request<ChatDetail>(`/chat/conversations/${conversationId}`, {
    method: 'GET'
  });
}

export function getChatMessages(payload: { conversationId: string; afterSequence?: number; take?: number }) {
  const params = new URLSearchParams();
  if (typeof payload.afterSequence === 'number') params.set('afterSequence', String(payload.afterSequence));
  if (typeof payload.take === 'number') params.set('take', String(payload.take));
  return request<ChatMessagesResponse>(
    `/chat/conversations/${payload.conversationId}/messages${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function pollChatMessages(payload: { conversationId: string; afterSequence: number; waitSeconds?: number; take?: number }) {
  const params = new URLSearchParams();
  params.set('afterSequence', String(payload.afterSequence));
  if (typeof payload.waitSeconds === 'number') params.set('waitSeconds', String(payload.waitSeconds));
  if (typeof payload.take === 'number') params.set('take', String(payload.take));
  return request<ChatMessagesResponse>(`/chat/conversations/${payload.conversationId}/messages/poll?${params.toString()}`, {
    method: 'GET'
  });
}

export function sendChatMessage(
  conversationId: string,
  payload: {
    text: string;
    visibility?: 'internal' | 'public';
    messageType?: 'text' | 'question' | 'answer' | 'system';
    clientMessageId?: string | null;
    senderRoleId?: string | null;
  }
) {
  return request<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: payload.text,
      visibility: payload.visibility ?? null,
      messageType: payload.messageType ?? null,
      clientMessageId: payload.clientMessageId ?? null,
      senderRoleId: payload.senderRoleId ?? null
    })
  });
}

export function markChatConversationRead(conversationId: string, lastReadSequence: number) {
  return request<{ conversationId: string; lastReadSequence: number }>(`/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastReadSequence })
  });
}

export function addChatParticipants(
  conversationId: string,
  payload: {
    includeHistory?: boolean;
    participants: Array<{
      subjectType: 'role' | 'user';
      subjectId: string;
      canRead: boolean;
      canWrite: boolean;
      canManage: boolean;
      canRespondPublic: boolean;
    }>;
  }
) {
  return request<ChatParticipant[]>(`/chat/conversations/${conversationId}/participants`, {
    method: 'POST',
    body: JSON.stringify({
      includeHistory: payload.includeHistory ?? true,
      participants: payload.participants
    })
  });
}

export function removeChatParticipant(conversationId: string, participantId: string) {
  return request<{ removed: boolean }>(`/chat/conversations/${conversationId}/participants/${participantId}`, {
    method: 'DELETE',
    body: JSON.stringify({})
  });
}

export function createChatPublicLink(conversationId: string, payload?: { label?: string; expiresInHours?: number }) {
  return request<ChatPublicLinkResponse>(`/chat/conversations/${conversationId}/public-links`, {
    method: 'POST',
    body: JSON.stringify({
      label: payload?.label ?? null,
      expiresInHours: payload?.expiresInHours ?? null
    })
  });
}

export function getPublicChatConversation(payload: { code: string; afterSequence?: number; take?: number }) {
  const params = new URLSearchParams();
  if (typeof payload.afterSequence === 'number') params.set('afterSequence', String(payload.afterSequence));
  if (typeof payload.take === 'number') params.set('take', String(payload.take));
  return request<ChatPublicConversation>(`/chat/public/${encodeURIComponent(payload.code)}${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET'
  });
}

export function pollPublicChatConversation(payload: { code: string; afterSequence: number; waitSeconds?: number; take?: number }) {
  const params = new URLSearchParams();
  params.set('afterSequence', String(payload.afterSequence));
  if (typeof payload.waitSeconds === 'number') params.set('waitSeconds', String(payload.waitSeconds));
  if (typeof payload.take === 'number') params.set('take', String(payload.take));
  return request<ChatPublicConversation>(`/chat/public/${encodeURIComponent(payload.code)}/poll?${params.toString()}`, {
    method: 'GET'
  });
}

export function askPublicChatQuestion(payload: { code: string; text: string; displayName?: string; clientMessageId?: string }) {
  return request<ChatMessage>(`/chat/public/${encodeURIComponent(payload.code)}/questions`, {
    method: 'POST',
    body: JSON.stringify({
      text: payload.text,
      displayName: payload.displayName ?? null,
      clientMessageId: payload.clientMessageId ?? null
    })
  });
}
