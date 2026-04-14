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
  const hasFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(!hasFormDataBody ? { 'Content-Type': 'application/json' } : {}),
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
  rememberMe: boolean;
  deviceInfo?: string | null;
}) {
  return request<{ userId: string; sessionId: string; secureMode: boolean }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      loginId: payload.loginId,
      h3Base64: payload.h3Base64,
      secureMode: payload.secureMode,
      rememberMe: payload.rememberMe,
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

export type DataFileUploadResponse = {
  dataItemId: string;
  itemName: string;
  itemType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
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

export function uploadDataItemFile(roleId: string, payload: {
  file: File | Blob;
  itemName?: string | null;
  fileName?: string | null;
}) {
  const form = new FormData();
  if (payload.itemName && payload.itemName.trim().length > 0) {
    form.append('itemName', payload.itemName.trim());
  }

  const fallbackName = payload.fileName?.trim()
    || (payload.file instanceof File ? payload.file.name : '')
    || 'upload.bin';
  form.append('file', payload.file, fallbackName);

  return request<DataFileUploadResponse>(`/account/roles/${roleId}/data/files`, {
    method: 'POST',
    body: form
  });
}

export async function downloadDataItemFile(dataItemId: string) {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${apiBase}/account/data/${dataItemId}/file`, {
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

  return response.blob();
}

export async function downloadCogitaPublicStoryboardFile(payload: { shareCode: string; dataItemId: string }) {
  const response = await fetch(
    `${apiBase}/cogita/public/storyboard/${encodeURIComponent(payload.shareCode)}/files/${encodeURIComponent(payload.dataItemId)}`,
    {
      method: 'GET'
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  return response.blob();
}

export async function downloadCogitaPublicStoryboardSessionFile(payload: { sessionCode: string; dataItemId: string }) {
  const response = await fetch(
    `${apiBase}/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/files/${encodeURIComponent(payload.dataItemId)}`,
    {
      method: 'GET'
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  return response.blob();
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

export type CogitaStoryboardImportNotionResult = {
  reference: string;
  notionId: string;
  created: boolean;
  infoType: string;
};

export type CogitaStoryboardImportResult = {
  project: CogitaCreationProject;
  createdNotions: number;
  reusedNotions: number;
  notions: CogitaStoryboardImportNotionResult[];
  warnings: string[];
};

export type CogitaNotionSearchResult = {
  notionId: string;
  notionType: string;
  label: string;
};

export type CogitaNotionPayloadFieldSpec = {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  searchable: boolean;
  keepOnCreate: boolean;
};

export type CogitaNotionLinkFieldSpec = {
  key: string;
  label: string;
  targetTypes: string[];
  required: boolean;
  multiple: boolean;
  keepOnCreate: boolean;
};

export type CogitaNotionTypeSpecification = {
  notionType: string;
  entityKind: string;
  payloadFields: CogitaNotionPayloadFieldSpec[];
  linkFields: CogitaNotionLinkFieldSpec[];
};

export type CogitaNotionApproachSpecification = {
  approachKey: string;
  label: string;
  category: string;
  sourceNotionTypes: string[];
};

export type CogitaNotionApproachProjection = {
  approachKey: string;
  sourceNotionId: string;
  sourceNotionType: string;
  projection: unknown;
};

export type CogitaEntitySearchResult = {
  entityId: string;
  entityKind: string;
  entityType: string;
  title: string;
  summary: string;
  notionId?: string | null;
  connectionId?: string | null;
};

export type CogitaCardSearchResult = {
  cardId: string;
  cardType: string;
  label: string;
  description: string;
  notionType?: string | null;
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
  notionId: string;
  notionType: string;
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

export type CogitaStoryboardSession = {
  sessionId: string;
  projectId: string;
  projectName: string;
  sessionCode: string;
  createdUtc: string;
  revokedUtc?: string | null;
  participantCount: number;
  totalAnswers: number;
  correctAnswers: number;
};

export type CogitaPublicStoryboardSession = {
  sessionId: string;
  projectId: string;
  projectName: string;
  libraryId: string;
  libraryName: string;
  content?: unknown | null;
  createdUtc: string;
};

export type CogitaPublicStoryboardSessionParticipant = {
  sessionId: string;
  participantId: string;
  participantToken: string;
  joinedUtc: string;
  updatedUtc: string;
};

export type CogitaPublicStoryboardSessionAnswerSubmitResponse = {
  accepted: boolean;
  attemptCount: number;
  isCorrect: boolean;
  updatedUtc: string;
};

export type CogitaStoryboardSessionParticipantResult = {
  participantId: string;
  totalAnswers: number;
  correctAnswers: number;
  joinedUtc: string;
  updatedUtc: string;
};

export type CogitaStoryboardSessionNodeResult = {
  nodeKey: string;
  notionId?: string | null;
  checkType?: string | null;
  participantCount: number;
  totalAnswers: number;
  correctAnswers: number;
};

export type CogitaStoryboardSessionResults = {
  sessionId: string;
  projectId: string;
  projectName: string;
  participantCount: number;
  totalAnswers: number;
  correctAnswers: number;
  participants: CogitaStoryboardSessionParticipantResult[];
  nodes: CogitaStoryboardSessionNodeResult[];
};

export type CogitaLiveRevisionParticipantScore = {
  participantId: string;
  displayName: string;
  groupName?: string | null;
  score: number;
};

export type CogitaLiveRevisionParticipant = {
  participantId: string;
  displayName: string;
  groupName?: string | null;
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
  groupName?: string | null;
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
  groupName?: string | null;
};

export type CogitaLiveRevisionReloginRequestCreateResponse = {
  sessionId: string;
  requestId: string;
  status: string;
  name: string;
  groupName?: string | null;
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
  participantGroupName?: string | null;
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

export type CogitaPythonEvaluateResponse = {
  passed: boolean;
  status:
    | 'passed'
    | 'wrong_output'
    | 'runtime_error'
    | 'timeout'
    | 'invalid_submission'
    | 'runner_unavailable'
    | 'sandbox_error'
    | string;
  casesExecuted: number;
  failingInputJson?: string | null;
  userOutputJson?: string | null;
  errorMessage?: string | null;
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

export type CogitaNotionCreateResponse = {
  notionId: string;
  notionType: string;
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

export function importCogitaStoryboardFromJson(payload: {
  libraryId: string;
  projectId?: string | null;
  name?: string | null;
  topicNotionId?: string | null;
  deleteOldStoryboardNotions?: boolean;
  json: unknown;
}) {
  return request<CogitaStoryboardImportResult>(
    `/cogita/libraries/${payload.libraryId}/storyboard-imports`,
    {
      method: 'POST',
      body: JSON.stringify({
        projectId: payload.projectId ?? null,
        name: payload.name ?? null,
        topicNotionId: payload.topicNotionId ?? null,
        deleteOldStoryboardNotions: Boolean(payload.deleteOldStoryboardNotions),
        json: payload.json
      })
    }
  );
}

export function searchCogitaNotions(payload: {
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
  return request<CogitaNotionSearchResult[]>(
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

export function getCogitaNotionCollections(payload: { libraryId: string; notionId: string }) {
  return request<CogitaCollectionSummary[]>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}/collections`,
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

export function getCogitaComputedSample(payload: { libraryId: string; notionId: string }) {
  return request<CogitaComputedSample>(`/cogita/libraries/${payload.libraryId}/computed/${payload.notionId}/sample`, {
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

export function createCogitaStoryboardSession(payload: {
  libraryId: string;
  projectId: string;
  signatureBase64?: string | null;
}) {
  return request<CogitaStoryboardSession>(`/cogita/libraries/${payload.libraryId}/storyboard-sessions`, {
    method: 'POST',
    body: JSON.stringify({
      projectId: payload.projectId,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function getCogitaStoryboardSessions(payload: { libraryId: string; projectId?: string | null }) {
  const params = new URLSearchParams();
  if (payload.projectId) params.set('projectId', payload.projectId);
  const qs = params.toString();
  return request<CogitaStoryboardSession[]>(
    `/cogita/libraries/${payload.libraryId}/storyboard-sessions${qs ? `?${qs}` : ''}`,
    {
      method: 'GET'
    }
  );
}

export function revokeCogitaStoryboardSession(payload: { libraryId: string; sessionId: string }) {
  return request<void>(`/cogita/libraries/${payload.libraryId}/storyboard-sessions/${payload.sessionId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getCogitaStoryboardSessionResults(payload: { libraryId: string; sessionId: string }) {
  return request<CogitaStoryboardSessionResults>(
    `/cogita/libraries/${payload.libraryId}/storyboard-sessions/${payload.sessionId}/results`,
    {
      method: 'GET'
    }
  );
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
  groupName?: string | null;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaLiveRevisionSession>(
    `/cogita/libraries/${payload.libraryId}/live-sessions/${payload.sessionId}/host/participants?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({ name: payload.name, groupName: payload.groupName ?? null })
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

export function joinCogitaLiveRevision(payload: { code: string; name: string; groupName?: string | null; useExistingName?: boolean }) {
  return request<CogitaLiveRevisionJoinResponse>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        groupName: payload.groupName ?? null,
        useExistingName: Boolean(payload.useExistingName)
      })
    }
  );
}

export function createCogitaLiveRevisionReloginRequest(payload: { code: string; name: string; groupName?: string | null }) {
  return request<CogitaLiveRevisionReloginRequestCreateResponse>(
    `/cogita/public/live-revision/${encodeURIComponent(payload.code)}/relogin-request`,
    { method: 'POST', body: JSON.stringify({ name: payload.name, groupName: payload.groupName ?? null }) }
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

export type CogitaGameSummary = {
  gameId: string;
  libraryId: string;
  name: string;
  mode: 'solo' | 'group' | 'mixed' | string;
  storyboardProjectId?: string | null;
  isArchived: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type CogitaGameDetail = {
  gameId: string;
  libraryId: string;
  name: string;
  mode: string;
  storyboardProjectId?: string | null;
  isArchived: boolean;
  settings?: Record<string, unknown> | null;
  createdUtc: string;
  updatedUtc: string;
};

export type CogitaGameValue = {
  valueId: string;
  valueKey: string;
  name: string;
  scopeType: 'session' | 'group' | 'participant' | string;
  visibility: 'public' | 'group' | 'private' | string;
  dataType: 'number' | 'bool' | 'string' | string;
  defaultValue?: unknown;
  constraints?: Record<string, unknown> | null;
  isScore: boolean;
  updatedUtc: string;
};

export type CogitaGameActionNode = {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
};

export type CogitaGameActionEdge = {
  edgeId: string;
  fromNodeId: string;
  fromPort?: string | null;
  toNodeId: string;
  toPort?: string | null;
};

export type CogitaGameActionGraph = {
  graphId: string;
  version: number;
  status: 'draft' | 'published' | string;
  nodes: CogitaGameActionNode[];
  edges: CogitaGameActionEdge[];
};

export type CogitaGameLayout = {
  layoutId: string;
  roleType: 'host' | 'groupLeader' | 'participant' | string;
  layout: Record<string, unknown>;
  updatedUtc: string;
};

export type CogitaGameSessionSummary = {
  sessionId: string;
  gameId: string;
  status: string;
  phase: string;
  roundIndex: number;
  version: number;
  createdUtc: string;
  updatedUtc: string;
};

export type CogitaGameSessionGroup = {
  groupId: string;
  groupKey: string;
  displayName: string;
  capacity: number;
  isActive: boolean;
};

export type CogitaGameZone = {
  zoneId: string;
  zoneKey: string;
  triggerRadiusM: number;
  geometry?: Record<string, unknown> | null;
  isEnabled: boolean;
  activeFromUtc?: string | null;
  activeToUtc?: string | null;
};

export type CogitaGameSessionParticipant = {
  participantId: string;
  groupId?: string | null;
  roleType: string;
  displayName: string;
  isConnected: boolean;
  spoofRiskScore: number;
  lastSeenUtc: string;
};

export type CogitaGameScoreRow = {
  groupId?: string | null;
  participantId?: string | null;
  score: number;
  rank: number;
};

export type CogitaGameEvent = {
  eventId: string;
  seqNo: number;
  eventType: string;
  correlationId: string;
  actorParticipantId?: string | null;
  payload?: Record<string, unknown> | null;
  createdUtc: string;
};

export type CogitaGameSessionState = {
  sessionId: string;
  libraryId: string;
  gameId: string;
  status: string;
  phase: string;
  roundIndex: number;
  version: number;
  groups: CogitaGameSessionGroup[];
  zones: CogitaGameZone[];
  participants: CogitaGameSessionParticipant[];
  scoreboard: CogitaGameScoreRow[];
  events: CogitaGameEvent[];
  hostRealtimeToken?: string | null;
  participantRealtimeToken?: string | null;
  lastSeqNo: number;
};

export type CogitaGameHostCreateResponse = {
  sessionId: string;
  code: string;
  hostSecret: string;
  state: CogitaGameSessionState;
};

export type CogitaGameJoinResponse = {
  sessionId: string;
  participantId: string;
  participantToken: string;
  state: CogitaGameSessionState;
};

export type CogitaGameStateResponse = {
  state: CogitaGameSessionState;
  eTag: string;
};

export function getCogitaGames(payload: { libraryId: string; q?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (payload.q && payload.q.trim().length > 0) params.set('q', payload.q.trim());
  if (typeof payload.limit === 'number') params.set('limit', String(payload.limit));
  const query = params.toString();
  return request<CogitaGameSummary[]>(
    `/cogita/libraries/${payload.libraryId}/games${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
}

export function createCogitaGame(payload: {
  libraryId: string;
  name: string;
  mode?: 'solo' | 'group' | 'mixed' | string;
  storyboardProjectId?: string | null;
  settings?: Record<string, unknown> | null;
}) {
  return request<CogitaGameSummary>(`/cogita/libraries/${payload.libraryId}/games`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      mode: payload.mode ?? 'mixed',
      storyboardProjectId: payload.storyboardProjectId ?? null,
      settings: payload.settings ?? {}
    })
  });
}

export function getCogitaGame(payload: { libraryId: string; gameId: string }) {
  return request<CogitaGameDetail>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}`,
    { method: 'GET' }
  );
}

export function updateCogitaGame(payload: {
  libraryId: string;
  gameId: string;
  name?: string;
  mode?: string;
  storyboardProjectId?: string | null;
  settings?: Record<string, unknown> | null;
  isArchived?: boolean;
}) {
  return request<CogitaGameSummary>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        mode: payload.mode,
        storyboardProjectId: payload.storyboardProjectId ?? null,
        settings: payload.settings,
        isArchived: payload.isArchived
      })
    }
  );
}

export function getCogitaGameValues(payload: { libraryId: string; gameId: string }) {
  return request<CogitaGameValue[]>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}/values`,
    { method: 'GET' }
  );
}

export function upsertCogitaGameValues(payload: {
  libraryId: string;
  gameId: string;
  values: Array<{
    valueId?: string;
    valueKey: string;
    name: string;
    scopeType: string;
    visibility: string;
    dataType: string;
    defaultValue?: unknown;
    constraints?: Record<string, unknown> | null;
    isScore: boolean;
  }>;
}) {
  return request<CogitaGameValue[]>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}/values`,
    {
      method: 'PUT',
      body: JSON.stringify(payload.values)
    }
  );
}

export function getCogitaGameActionGraph(payload: { libraryId: string; gameId: string }) {
  return request<CogitaGameActionGraph>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}/actions/graph`,
    { method: 'GET' }
  );
}

export function upsertCogitaGameActionGraph(payload: {
  libraryId: string;
  gameId: string;
  nodes: Array<{
    nodeId?: string;
    nodeType: string;
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
  }>;
  edges: Array<{
    edgeId?: string;
    fromNodeId: string;
    fromPort?: string | null;
    toNodeId: string;
    toPort?: string | null;
  }>;
  publish?: boolean;
}) {
  return request<CogitaGameActionGraph>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}/actions/graph`,
    {
      method: 'PUT',
      body: JSON.stringify({
        nodes: payload.nodes,
        edges: payload.edges,
        publish: Boolean(payload.publish)
      })
    }
  );
}

export function getCogitaGameLayouts(payload: { libraryId: string; gameId: string }) {
  return request<CogitaGameLayout[]>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}/layouts`,
    { method: 'GET' }
  );
}

export function upsertCogitaGameLayout(payload: {
  libraryId: string;
  gameId: string;
  roleType: string;
  layout: Record<string, unknown>;
}) {
  return request<CogitaGameLayout>(
    `/cogita/libraries/${payload.libraryId}/games/${payload.gameId}/layouts/${encodeURIComponent(payload.roleType)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ roleType: payload.roleType, layout: payload.layout })
    }
  );
}

export function getCogitaGameSessions(payload: { libraryId: string; gameId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (payload.gameId) params.set('gameId', payload.gameId);
  if (typeof payload.limit === 'number') params.set('limit', String(payload.limit));
  const query = params.toString();
  return request<CogitaGameSessionSummary[]>(
    `/cogita/libraries/${payload.libraryId}/game-sessions${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
}

export function createCogitaGameSession(payload: {
  libraryId: string;
  gameId: string;
  title?: string | null;
  sessionSettings?: Record<string, unknown> | null;
  zones?: Array<{ zoneKey: string; latitude: number; longitude: number; triggerRadiusM: number; sourceType?: string }>;
  groups?: Array<{ groupKey: string; displayName: string; capacity?: number }>;
}) {
  return request<CogitaGameHostCreateResponse>(
    `/cogita/libraries/${payload.libraryId}/game-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({
        gameId: payload.gameId,
        title: payload.title ?? null,
        sessionSettings: payload.sessionSettings ?? {},
        zones: payload.zones ?? [],
        groups: payload.groups ?? []
      })
    }
  );
}

export function attachCogitaGameHost(payload: { libraryId: string; sessionId: string; hostSecret: string }) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaGameSessionState>(
    `/cogita/libraries/${payload.libraryId}/game-sessions/${payload.sessionId}/host/attach?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
}

export function updateCogitaGameHostPhase(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  phase: string;
  roundIndex: number;
  status?: string;
  meta?: Record<string, unknown> | null;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaGameSessionState>(
    `/cogita/libraries/${payload.libraryId}/game-sessions/${payload.sessionId}/host/phase?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        phase: payload.phase,
        roundIndex: payload.roundIndex,
        status: payload.status ?? null,
        meta: payload.meta ?? null
      })
    }
  );
}

export function sendCogitaGameHostCommand(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  command: string;
  payload?: Record<string, unknown> | null;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaGameSessionState>(
    `/cogita/libraries/${payload.libraryId}/game-sessions/${payload.sessionId}/host/commands?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        command: payload.command,
        payload: payload.payload ?? null
      })
    }
  );
}

export function updateCogitaGameHostGroups(payload: {
  libraryId: string;
  sessionId: string;
  hostSecret: string;
  groups: Array<{ groupKey: string; displayName: string; capacity?: number }>;
}) {
  const params = new URLSearchParams({ hostSecret: payload.hostSecret });
  return request<CogitaGameSessionGroup[]>(
    `/cogita/libraries/${payload.libraryId}/game-sessions/${payload.sessionId}/host/groups?${params.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(payload.groups)
    }
  );
}

export function cleanupCogitaGameLocations() {
  return request<{ removed: number }>('/cogita/game/maintenance/cleanup-location', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function joinCogitaGame(payload: {
  code: string;
  name: string;
  groupKey?: string | null;
  deviceId?: string | null;
}) {
  return request<CogitaGameJoinResponse>(
    `/cogita/public/game/${encodeURIComponent(payload.code)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        groupKey: payload.groupKey ?? null,
        deviceId: payload.deviceId ?? null
      })
    }
  );
}

export function getCogitaGamePublicState(payload: {
  code: string;
  participantToken?: string | null;
  sinceSeq?: number;
}) {
  const params = new URLSearchParams();
  if (payload.participantToken) params.set('participantToken', payload.participantToken);
  if (typeof payload.sinceSeq === 'number') params.set('sinceSeq', String(payload.sinceSeq));
  const query = params.toString();
  const path = `/cogita/public/game/${encodeURIComponent(payload.code)}/state${query ? `?${query}` : ''}`;
  return requestLiveStateCached<CogitaGameStateResponse>(
    `game-public:${payload.code}:${payload.participantToken ?? '-'}:${payload.sinceSeq ?? 0}`,
    path
  );
}

export function submitCogitaGameLocationPings(payload: {
  code: string;
  participantToken: string;
  samples: Array<{
    latitude: number;
    longitude: number;
    accuracyM: number;
    speedMps?: number | null;
    headingDeg?: number | null;
    deviceTimeUtc: string;
  }>;
  batchId?: string | null;
}) {
  return request<{ accepted: boolean; events: number; lastSeqNo: number }>(
    `/cogita/public/game/${encodeURIComponent(payload.code)}/location-pings`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        samples: payload.samples,
        batchId: payload.batchId ?? null
      })
    }
  );
}

export function submitCogitaGameAnswer(payload: {
  code: string;
  participantToken: string;
  interactionKey: string;
  answer?: unknown;
}) {
  return request<{ accepted: boolean; seqNo: number }>(
    `/cogita/public/game/${encodeURIComponent(payload.code)}/answers`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        interactionKey: payload.interactionKey,
        answer: payload.answer ?? null
      })
    }
  );
}

export function completeCogitaGameInteraction(payload: {
  code: string;
  participantToken: string;
  interactionKey: string;
  value?: Record<string, unknown> | null;
}) {
  return request<{ accepted: boolean; seqNo: number }>(
    `/cogita/public/game/${encodeURIComponent(payload.code)}/interactions/${encodeURIComponent(payload.interactionKey)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        interactionKey: payload.interactionKey,
        payload: payload.value ?? null
      })
    }
  );
}

export function leaveCogitaGame(payload: {
  code: string;
  participantToken: string;
}) {
  return request<{ left: boolean }>(
    `/cogita/public/game/${encodeURIComponent(payload.code)}/leave`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken
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

export function getCogitaPublicStoryboardSession(payload: { sessionCode: string }) {
  return request<CogitaPublicStoryboardSession>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}`,
    {
      method: 'GET'
    }
  );
}

export function touchCogitaPublicStoryboardSessionParticipant(payload: {
  sessionCode: string;
  participantToken: string;
}) {
  return request<CogitaPublicStoryboardSessionParticipant>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/participants`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken
      })
    }
  );
}

export function submitCogitaPublicStoryboardSessionAnswer(payload: {
  sessionCode: string;
  participantToken: string;
  nodeKey: string;
  notionId?: string | null;
  checkType?: string | null;
  isCorrect: boolean;
}) {
  return request<CogitaPublicStoryboardSessionAnswerSubmitResponse>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/answers`,
    {
      method: 'POST',
      body: JSON.stringify({
        participantToken: payload.participantToken,
        nodeKey: payload.nodeKey,
        notionId: payload.notionId ?? null,
        checkType: payload.checkType ?? null,
        isCorrect: payload.isCorrect
      })
    }
  );
}

export function getCogitaPublicRevisionInfos(payload: { shareId: string; key?: string; type?: string; query?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  if (payload.type) params.set('type', payload.type);
  if (payload.query) params.set('query', payload.query);
  return request<CogitaNotionSearchResult[]>(
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

export function getCogitaPublicComputedSample(payload: { shareId: string; notionId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<CogitaComputedSample>(
    `/cogita/public/revision/${encodeURIComponent(payload.shareId)}/computed/${payload.notionId}/sample${params.toString() ? `?${params.toString()}` : ''}`,
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

export function createCogitaNotion(payload: {
  libraryId: string;
  notionType: string;
  dataKeyId?: string | null;
  payload: unknown;
  links?: Record<string, string | string[] | null | undefined>;
  signatureBase64?: string | null;
}) {
  return request<CogitaNotionCreateResponse>(`/cogita/libraries/${payload.libraryId}/notions`, {
    method: 'POST',
    body: JSON.stringify({
      notionType: payload.notionType,
      payload: payload.payload,
      links: payload.links ?? null,
      dataKeyId: payload.dataKeyId ?? null,
      signatureBase64: payload.signatureBase64 ?? null
    })
  });
}

export function getCogitaNotionDetail(payload: { libraryId: string; notionId: string }) {
  return request<{ notionId: string; notionType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}`,
    { method: 'GET' }
  );
}

export function getCogitaApproachSpecifications(payload: { libraryId: string }) {
  return request<CogitaNotionApproachSpecification[]>(
    `/cogita/libraries/${payload.libraryId}/approaches/specification`,
    { method: 'GET' }
  );
}

export function getCogitaNotionApproachProjection(payload: { libraryId: string; notionId: string; approachKey: string }) {
  return request<CogitaNotionApproachProjection>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}/approaches/${encodeURIComponent(payload.approachKey)}`,
    { method: 'GET' }
  );
}

export function getCogitaNotionCheckcards(payload: { libraryId: string; notionId: string }) {
  return request<CogitaCardSearchBundle>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}/cards`,
    { method: 'GET' }
  );
}

export function evaluateCogitaPythonNotion(payload: {
  libraryId: string;
  notionId: string;
  submissionSource: string;
}) {
  return request<CogitaPythonEvaluateResponse>(
    `/cogita/libraries/${payload.libraryId}/python/${payload.notionId}/evaluate`,
    {
      method: 'POST',
      body: JSON.stringify({
        submissionSource: payload.submissionSource
      })
    }
  );
}

export function getCogitaNotionCheckcardDependencies(payload: { libraryId: string; notionId: string }) {
  return request<CogitaItemDependencyBundle>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}/cards/dependencies`,
    { method: 'GET' }
  );
}

export function getCogitaPublicNotionDetail(payload: { shareCode: string; notionId: string; key?: string }) {
  const params = new URLSearchParams();
  if (payload.key) params.set('key', payload.key);
  return request<{ notionId: string; notionType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/public/revision/${encodeURIComponent(payload.shareCode)}/notions/${payload.notionId}${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicStoryboardNotionDetail(payload: { shareCode: string; notionId: string }) {
  return request<{ notionId: string; notionType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/public/storyboard/${encodeURIComponent(payload.shareCode)}/notions/${payload.notionId}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicStoryboardSessionNotionDetail(payload: { sessionCode: string; notionId: string }) {
  return request<{ notionId: string; notionType: string; payload: unknown; links?: Record<string, string | string[] | null> | null }>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/notions/${payload.notionId}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicStoryboardNotionCheckcards(payload: { shareCode: string; notionId: string }) {
  return request<CogitaCardSearchBundle>(
    `/cogita/public/storyboard/${encodeURIComponent(payload.shareCode)}/notions/${payload.notionId}/cards`,
    { method: 'GET' }
  );
}

export function getCogitaPublicStoryboardSessionNotionCheckcards(payload: { sessionCode: string; notionId: string }) {
  return request<CogitaCardSearchBundle>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/notions/${payload.notionId}/cards`,
    { method: 'GET' }
  );
}

export function evaluateCogitaPublicStoryboardPythonNotion(payload: {
  shareCode: string;
  notionId: string;
  submissionSource: string;
}) {
  return request<CogitaPythonEvaluateResponse>(
    `/cogita/public/storyboard/${encodeURIComponent(payload.shareCode)}/python/${payload.notionId}/evaluate`,
    {
      method: 'POST',
      body: JSON.stringify({
        submissionSource: payload.submissionSource
      })
    }
  );
}

export function evaluateCogitaPublicStoryboardSessionPythonNotion(payload: {
  sessionCode: string;
  notionId: string;
  submissionSource: string;
}) {
  return request<CogitaPythonEvaluateResponse>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/python/${payload.notionId}/evaluate`,
    {
      method: 'POST',
      body: JSON.stringify({
        submissionSource: payload.submissionSource
      })
    }
  );
}

export function getCogitaPublicStoryboardNotionApproachProjection(payload: {
  shareCode: string;
  notionId: string;
  approachKey: string;
}) {
  return request<CogitaNotionApproachProjection>(
    `/cogita/public/storyboard/${encodeURIComponent(payload.shareCode)}/notions/${payload.notionId}/approaches/${encodeURIComponent(payload.approachKey)}`,
    { method: 'GET' }
  );
}

export function getCogitaPublicStoryboardSessionNotionApproachProjection(payload: {
  sessionCode: string;
  notionId: string;
  approachKey: string;
}) {
  return request<CogitaNotionApproachProjection>(
    `/cogita/public/storyboard-session/${encodeURIComponent(payload.sessionCode)}/notions/${payload.notionId}/approaches/${encodeURIComponent(payload.approachKey)}`,
    { method: 'GET' }
  );
}

export function getCogitaNotionTypeSpecification(payload: { libraryId: string }) {
  return request<CogitaNotionTypeSpecification[]>(
    `/cogita/libraries/${payload.libraryId}/notion-types/specification`,
    { method: 'GET' }
  );
}

export function updateCogitaNotion(payload: {
  libraryId: string;
  notionId: string;
  payload: unknown;
  links?: Record<string, string | string[] | null | undefined>;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<{ notionId: string; notionType: string }>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}`,
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

export function deleteCogitaNotion(payload: { libraryId: string; notionId: string }) {
  return request<{ deleted: boolean }>(
    `/cogita/libraries/${payload.libraryId}/notions/${payload.notionId}`,
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

export type CogitaExportNotion = {
  notionId: string;
  notionType: string;
  payload: unknown;
};

export type CogitaExportConnection = {
  connectionId: string;
  connectionType: string;
  notionIds: string[];
  payload?: unknown | null;
};

export type CogitaExportCollectionItem = {
  itemType: 'info' | 'connection';
  itemId: string;
  sortOrder: number;
};

export type CogitaExportCollection = {
  collectionNotionId: string;
  items: CogitaExportCollectionItem[];
};

export type CogitaLibraryExport = {
  version: number;
  notions: CogitaExportNotion[];
  connections: CogitaExportConnection[];
  collections: CogitaExportCollection[];
};

export type CogitaLibraryImportResponse = {
  notionsImported: number;
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

export type ParishConfirmationSmsTemplates = {
  verificationInvite: string;
  verificationWarning: string;
  portalInvite: string;
};

export type ParishConfirmationSmsTemplatesResponse = {
  templates?: ParishConfirmationSmsTemplates | null;
  updatedUtc?: string | null;
};

export type ParishHomepageConfig = {
  modules: ParishLayoutItem[];
  sacramentParishPages?: Record<string, ParishSacramentParishPage> | null;
  confirmationSmsTemplates?: ParishConfirmationSmsTemplates | null;
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
  paperConsentReceived?: boolean;
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
  requiresInviteCode: boolean;
  isSelected: boolean;
  visualStatus: 'free' | 'hosted' | 'closed' | string;
};

export type ParishConfirmationMeetingJoinRequest = {
  id: string;
  slotId: string;
  candidateId: string;
  candidateName: string;
  candidateSurname: string;
  createdUtc: string;
  status: string;
};

export type ParishConfirmationMeetingAvailability = {
  candidateId: string;
  candidateName: string;
  paperConsentReceived: boolean;
  selectedSlotId?: string | null;
  bookedUtc?: string | null;
  canInviteToSelectedSlot: boolean;
  selectedSlotInviteCode?: string | null;
  selectedSlotInviteExpiresUtc?: string | null;
  pendingJoinRequests: ParishConfirmationMeetingJoinRequest[];
  slots: ParishConfirmationMeetingPublicSlot[];
};

export type ParishConfirmationPortalCandidate = {
  candidateId: string;
  name: string;
  surname: string;
  phoneNumbers: ParishConfirmationPhone[];
  address: string;
  schoolShort: string;
  paperConsentReceived: boolean;
  portalToken: string;
  selectedSlotId?: string | null;
  bookedUtc?: string | null;
  canInviteToSelectedSlot: boolean;
  selectedSlotInviteCode?: string | null;
  selectedSlotInviteExpiresUtc?: string | null;
};

export type ParishConfirmationMessage = {
  id: string;
  senderType: 'candidate' | 'admin' | string;
  messageText: string;
  createdUtc: string;
};

export type ParishConfirmationCelebration = {
  id: string;
  name: string;
  shortInfo: string;
  startsAtUtc: string;
  endsAtUtc: string;
  description: string;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string;
  candidateComment?: string | null;
  candidateCommentUpdatedUtc?: string | null;
};

export type ParishConfirmationNote = {
  id: string;
  noteText: string;
  isPublic: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationAggregatedNote = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateSurname: string;
  noteText: string;
  isPublic: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationAggregatedMessage = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateSurname: string;
  senderType: string;
  messageText: string;
  createdUtc: string;
};

export type ParishConfirmationPortal = {
  candidate: ParishConfirmationPortalCandidate;
  firstYearStartSlots: ParishConfirmationMeetingPublicSlot[];
  pendingJoinRequests: ParishConfirmationMeetingJoinRequest[];
  secondMeetingAnnouncement: string;
  upcomingCelebrations: ParishConfirmationCelebration[];
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
  paperConsentReceived: boolean;
  createdUtc: string;
  updatedUtc: string;
  meetingToken?: string | null;
  meetingSlotId?: string | null;
};

export type ParishConfirmationExportPhoneVerification = {
  id: string;
  candidateId: string;
  phoneIndex: number;
  verificationToken: string;
  verifiedUtc?: string | null;
  createdUtc: string;
};

export type ParishConfirmationExportMeetingSlot = {
  id: string;
  startsAtUtc: string;
  durationMinutes: number;
  capacity: number;
  label?: string | null;
  stage: string;
  hostCandidateId?: string | null;
  hostInviteCode?: string | null;
  hostInviteExpiresUtc?: string | null;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationExportMeetingLink = {
  id: string;
  candidateId: string;
  bookingToken: string;
  slotId?: string | null;
  bookedUtc?: string | null;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationExportMessage = {
  id: string;
  candidateId: string;
  senderType: string;
  messageText: string;
  createdUtc: string;
};

export type ParishConfirmationExportNote = {
  id: string;
  candidateId: string;
  noteText: string;
  isPublic: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationExportCelebration = {
  id: string;
  name: string;
  shortInfo: string;
  startsAtUtc: string;
  endsAtUtc: string;
  description: string;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationExportCelebrationParticipation = {
  id: string;
  candidateId: string;
  candidateMeetingToken?: string | null;
  celebrationId: string;
  commentText: string;
  createdUtc: string;
  updatedUtc: string;
};

export type ParishConfirmationExport = {
  version: number;
  parishId: string;
  exportedUtc: string;
  candidates: ParishConfirmationExportCandidate[];
  phoneVerifications?: ParishConfirmationExportPhoneVerification[];
  meetingSlots?: ParishConfirmationExportMeetingSlot[];
  meetingLinks?: ParishConfirmationExportMeetingLink[];
  messages?: ParishConfirmationExportMessage[];
  notes?: ParishConfirmationExportNote[];
  celebrations?: ParishConfirmationExportCelebration[];
  celebrationParticipations?: ParishConfirmationExportCelebrationParticipation[];
};

export type ParishConfirmationImport = {
  candidates: ParishConfirmationExportCandidate[];
  replaceExisting: boolean;
  celebrations?: ParishConfirmationExportCelebration[];
  celebrationParticipations?: ParishConfirmationExportCelebrationParticipation[];
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

export function getParishConfirmationSmsTemplates(parishId: string) {
  return request<ParishConfirmationSmsTemplatesResponse>(`/parish/${parishId}/confirmation-sms-templates`, {
    method: 'GET'
  });
}

export function updateParishConfirmationSmsTemplates(
  parishId: string,
  payload: { templates?: ParishConfirmationSmsTemplates | null }
) {
  return request<ParishConfirmationSmsTemplatesResponse>(`/parish/${parishId}/confirmation-sms-templates`, {
    method: 'PUT',
    body: JSON.stringify(payload)
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
      replaceExisting: payload.replaceExisting,
      celebrations: payload.celebrations ?? [],
      celebrationParticipations: payload.celebrationParticipations ?? []
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

export function getParishConfirmationMeetingAvailability(slug: string, token: string, inviteCode?: string | null) {
  return request<ParishConfirmationMeetingAvailability>(`/parish/${slug}/public/confirmation-meeting-availability`, {
    method: 'POST',
    body: JSON.stringify({
      token,
      inviteCode: inviteCode ?? null
    })
  });
}

export function bookParishConfirmationMeetingSlot(
  slug: string,
  payload: { token: string; slotId: string; inviteCode?: string | null }
) {
  return request<{ status: string; slotId?: string | null; bookedUtc?: string | null }>(
    `/parish/${slug}/public/confirmation-meeting-book`,
    {
      method: 'POST',
      body: JSON.stringify({
        token: payload.token,
        slotId: payload.slotId,
        inviteCode: payload.inviteCode ?? null
      })
    }
  );
}

export function releaseParishConfirmationMeetingHost(slug: string, token: string) {
  return request<{ status: string; slotId?: string | null }>(`/parish/${slug}/public/confirmation-meeting-release-host`, {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export function resignParishConfirmationMeetingSlot(slug: string, token: string) {
  return request<{ status: string; slotId?: string | null }>(`/parish/${slug}/public/confirmation-meeting-resign`, {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export function requestParishConfirmationMeetingJoin(slug: string, payload: { token: string; slotId: string }) {
  return request<{ status: string; requestId?: string | null }>(`/parish/${slug}/public/confirmation-meeting-join-request`, {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      slotId: payload.slotId
    })
  });
}

export function decideParishConfirmationMeetingJoinRequest(
  slug: string,
  payload: { token: string; requestId: string; decision: 'accept' | 'reject' }
) {
  return request<{ status: string; requestId?: string | null; candidateId?: string | null }>(
    `/parish/${slug}/public/confirmation-meeting-join-request-decision`,
    {
      method: 'POST',
      body: JSON.stringify({
        token: payload.token,
        requestId: payload.requestId,
        decision: payload.decision
      })
    }
  );
}

export function getParishConfirmationCandidatePortal(slug: string, token: string, inviteCode?: string | null) {
  return request<ParishConfirmationPortal>(`/parish/${slug}/public/confirmation-candidate-portal`, {
    method: 'POST',
    body: JSON.stringify({
      token,
      inviteCode: inviteCode ?? null
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

export function sendParishConfirmationCelebrationComment(
  slug: string,
  payload: { token: string; celebrationId: string; commentText: string }
) {
  return request<{ status: string; participationId?: string | null; updatedUtc?: string | null }>(
    `/parish/${slug}/public/confirmation-celebration-comment`,
    {
      method: 'POST',
      body: JSON.stringify({
        token: payload.token,
        celebrationId: payload.celebrationId,
        commentText: payload.commentText
      })
    }
  );
}

export function listParishConfirmationCelebrations(parishId: string) {
  return request<ParishConfirmationCelebration[]>(`/parish/${parishId}/confirmation-celebrations`, {
    method: 'GET'
  });
}

export function createParishConfirmationCelebration(
  parishId: string,
  payload: {
    name: string;
    shortInfo: string;
    startsAtUtc: string;
    endsAtUtc: string;
    description: string;
    isActive: boolean;
  }
) {
  return request<ParishConfirmationCelebration>(`/parish/${parishId}/confirmation-celebrations`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateParishConfirmationCelebration(
  parishId: string,
  celebrationId: string,
  payload: {
    name: string;
    shortInfo: string;
    startsAtUtc: string;
    endsAtUtc: string;
    description: string;
    isActive: boolean;
  }
) {
  return request<ParishConfirmationCelebration>(`/parish/${parishId}/confirmation-celebrations/${celebrationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
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

export function updateParishConfirmationCandidatePaperConsent(
  parishId: string,
  candidateId: string,
  paperConsentReceived: boolean
) {
  return request<void>(`/parish/${parishId}/confirmation-candidates/${candidateId}/paper-consent`, {
    method: 'PUT',
    body: JSON.stringify({ paperConsentReceived })
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

export function listParishConfirmationNotes(parishId: string) {
  return request<ParishConfirmationAggregatedNote[]>(`/parish/${parishId}/confirmation-notes`, {
    method: 'GET'
  });
}

export function listParishConfirmationMessages(parishId: string) {
  return request<ParishConfirmationAggregatedMessage[]>(`/parish/${parishId}/confirmation-messages`, {
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

export type EdkRoutePoint = {
  type: 'start' | 'station' | 'finish' | 'distance';
  title_pl: string;
  url: string;
  distance_km: string;
};

export type EdkSiteDocument = {
  routePoints: EdkRoutePoint[];
};

export type EdkSite = {
  id?: string | null;
  slug: string;
  name: string;
  motto: string;
  startDate: string;
  endDate: string;
  startLocation: string;
  endLocation: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  site: EdkSiteDocument;
  isProvisioned: boolean;
};

export type EdkRegistrationRequest = {
  fullName: string;
  phone: string;
  participantStatus: 'adult' | 'minor_with_guardian' | 'adult_guardian_for_minor';
  additionalInfo?: string | null;
};

export type EdkRegistrationResponse = {
  registrationId: string;
  submittedUtc: string;
};

export type EdkOrganizerRegistrationRow = {
  id: string;
  fullName: string;
  phone: string;
  participantStatus: string;
  additionalInfo?: string | null;
  createdUtc: string;
};

export type EdkOrganizerStats = {
  registrations: number;
  adults: number;
  minorsWithGuardian: number;
  adultGuardiansForMinor: number;
};

export type EdkOrganizerDashboard = {
  stats: EdkOrganizerStats;
  registrations: EdkOrganizerRegistrationRow[];
};

export type EdkRegistrationExport = {
  eventId: string;
  slug: string;
  exportedUtc: string;
  rows: EdkOrganizerRegistrationRow[];
};

export function getEdkSite(slug: string) {
  return request<EdkSite>(`/edk/${slug}`, {
    method: 'GET'
  });
}

export function createEdkRegistration(slug: string, payload: EdkRegistrationRequest) {
  return request<EdkRegistrationResponse>(`/edk/${slug}/public/registrations`, {
    method: 'POST',
    body: JSON.stringify({
      fullName: payload.fullName,
      phone: payload.phone,
      participantStatus: payload.participantStatus,
      additionalInfo: payload.additionalInfo ?? null
    })
  });
}

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
  return request<PilgrimageSite>('/pilgrimage/admin/events-limanowa/bootstrap-kal26', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function bootstrapEdk26Event() {
  return request<EdkSite>('/edk/admin/events-limanowa/bootstrap-edk26', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export type LimanowaGroupStatus =
  | 'nowe zgłoszenie'
  | 'oczekuje na kontakt'
  | 'oczekuje na uzupełnienie'
  | 'gotowe organizacyjnie'
  | 'zamknięte';

export type LimanowaParticipantStatus =
  | 'nieuzupełniony'
  | 'w trakcie'
  | 'gotowy'
  | 'wymaga poprawy';

export type LimanowaPolicyLinks = {
  privacyPolicyUrl: string;
  eventRulesUrl: string;
  thingsToBringUrl: string;
};

export type LimanowaEventSite = {
  id?: string | null;
  slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  startDate: string;
  endDate: string;
  capacityTotal: number;
  registrationOpen: boolean;
  registrationGroupsDeadline: string;
  registrationParticipantsDeadline: string;
  published: boolean;
  policyLinks: LimanowaPolicyLinks;
  isProvisioned: boolean;
};

export type LimanowaGroup = {
  id: string;
  parishName: string;
  responsibleName: string;
  phone: string;
  email: string;
  expectedParticipantCount: number;
  expectedGuardianCount: number;
  notes?: string | null;
  status: LimanowaGroupStatus | string;
  createdAt: string;
  updatedAt: string;
};

export type LimanowaParticipant = {
  id: string;
  groupId: string;
  fullName: string;
  phone: string;
  parishName: string;
  parentContactName?: string | null;
  parentContactPhone?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
  healthNotes?: string | null;
  accommodationType?: string | null;
  status: LimanowaParticipantStatus | string;
  rulesAccepted: boolean;
  privacyAccepted: boolean;
  consentSubmittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LimanowaQuestionMessage = {
  id: string;
  authorType: string;
  message: string;
  createdAt: string;
};

export type LimanowaQuestionThread = {
  id: string;
  relatedType: string;
  relatedId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: LimanowaQuestionMessage[];
};

export type LimanowaAnnouncement = {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  publishedAt: string;
};

export type LimanowaGroupAdminZone = {
  event: LimanowaEventSite;
  group: LimanowaGroup;
  participants: LimanowaParticipant[];
  announcements: LimanowaAnnouncement[];
  questionThread?: LimanowaQuestionThread | null;
  policyLinks: LimanowaPolicyLinks;
};

export type LimanowaParticipantZone = {
  event: LimanowaEventSite;
  group: LimanowaGroup;
  participant: LimanowaParticipant;
  announcements: LimanowaAnnouncement[];
  questionThread?: LimanowaQuestionThread | null;
  policyLinks: LimanowaPolicyLinks;
};

export type LimanowaAdminStatus = {
  hasAdmin: boolean;
  isCurrentUserAdmin: boolean;
  adminDisplayName?: string | null;
  limanowaProvisioned: boolean;
};

export type LimanowaAdminStats = {
  groups: number;
  participants: number;
  participantsReady: number;
  participantsNeedsFix: number;
  accommodationAssigned: number;
  openThreads: number;
  announcements: number;
};

export type LimanowaAdminDashboard = {
  event: LimanowaEventSite;
  stats: LimanowaAdminStats;
  groups: LimanowaGroup[];
  participants: LimanowaParticipant[];
  announcements: LimanowaAnnouncement[];
  questionThreads: LimanowaQuestionThread[];
  policyLinks: LimanowaPolicyLinks;
};

export type LimanowaAccessLink = {
  accessId: string;
  token: string;
  link: string;
  smsHref: string;
  sentAt: string;
};

export type LimanowaExportKind =
  | 'groups'
  | 'participants'
  | 'statuses'
  | 'accommodation'
  | 'consents'
  | 'questions';

export function getLimanowaEventSite(slug: string) {
  return request<LimanowaEventSite>(`/limanowa/${slug}`, {
    method: 'GET'
  });
}

export function createLimanowaGroupRegistration(
  slug: string,
  payload: {
    parishName: string;
    responsibleName: string;
    phone: string;
    email: string;
    expectedParticipantCount: number;
    expectedGuardianCount: number;
    notes?: string | null;
  }
) {
  return request<{ groupId: string; status: string; createdAt: string }>(`/limanowa/${slug}/public/group-registrations`, {
    method: 'POST',
    body: JSON.stringify({
      parishName: payload.parishName,
      responsibleName: payload.responsibleName,
      phone: payload.phone,
      email: payload.email,
      expectedParticipantCount: payload.expectedParticipantCount,
      expectedGuardianCount: payload.expectedGuardianCount,
      notes: payload.notes ?? null
    })
  });
}

export function getLimanowaGroupAdminZone(token: string) {
  const query = new URLSearchParams({ token });
  return request<LimanowaGroupAdminZone>(`/limanowa/group-admin/zone?${query.toString()}`, {
    method: 'GET'
  });
}

export function updateLimanowaGroupAdminGroup(
  token: string,
  payload: {
    parishName: string;
    responsibleName: string;
    phone: string;
    email: string;
    expectedParticipantCount: number;
    expectedGuardianCount: number;
    notes?: string | null;
  }
) {
  const query = new URLSearchParams({ token });
  return request<LimanowaGroup>(`/limanowa/group-admin/group?${query.toString()}`, {
    method: 'PUT',
    body: JSON.stringify({
      parishName: payload.parishName,
      responsibleName: payload.responsibleName,
      phone: payload.phone,
      email: payload.email,
      expectedParticipantCount: payload.expectedParticipantCount,
      expectedGuardianCount: payload.expectedGuardianCount,
      notes: payload.notes ?? null
    })
  });
}

export function createLimanowaGroupAdminParticipant(
  token: string,
  payload: {
    fullName: string;
    phone: string;
    parishName: string;
    parentContactName?: string | null;
    parentContactPhone?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    notes?: string | null;
    healthNotes?: string | null;
    accommodationType?: string | null;
    status?: string | null;
  }
) {
  const query = new URLSearchParams({ token });
  return request<LimanowaParticipant>(`/limanowa/group-admin/participants?${query.toString()}`, {
    method: 'POST',
    body: JSON.stringify({
      fullName: payload.fullName,
      phone: payload.phone,
      parishName: payload.parishName,
      parentContactName: payload.parentContactName ?? null,
      parentContactPhone: payload.parentContactPhone ?? null,
      guardianName: payload.guardianName ?? null,
      guardianPhone: payload.guardianPhone ?? null,
      notes: payload.notes ?? null,
      healthNotes: payload.healthNotes ?? null,
      accommodationType: payload.accommodationType ?? null,
      status: payload.status ?? null
    })
  });
}

export function updateLimanowaGroupAdminParticipant(
  token: string,
  participantId: string,
  payload: {
    fullName: string;
    phone: string;
    parishName: string;
    parentContactName?: string | null;
    parentContactPhone?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    notes?: string | null;
    healthNotes?: string | null;
    accommodationType?: string | null;
    status?: string | null;
  }
) {
  const query = new URLSearchParams({ token });
  return request<LimanowaParticipant>(`/limanowa/group-admin/participants/${participantId}?${query.toString()}`, {
    method: 'PUT',
    body: JSON.stringify({
      fullName: payload.fullName,
      phone: payload.phone,
      parishName: payload.parishName,
      parentContactName: payload.parentContactName ?? null,
      parentContactPhone: payload.parentContactPhone ?? null,
      guardianName: payload.guardianName ?? null,
      guardianPhone: payload.guardianPhone ?? null,
      notes: payload.notes ?? null,
      healthNotes: payload.healthNotes ?? null,
      accommodationType: payload.accommodationType ?? null,
      status: payload.status ?? null
    })
  });
}

export function createLimanowaGroupAdminQuestion(token: string, message: string) {
  const query = new URLSearchParams({ token });
  return request<LimanowaQuestionThread>(`/limanowa/group-admin/questions?${query.toString()}`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export function getLimanowaParticipantZone(token: string) {
  const query = new URLSearchParams({ token });
  return request<LimanowaParticipantZone>(`/limanowa/participant/zone?${query.toString()}`, {
    method: 'GET'
  });
}

export function updateLimanowaParticipantProfile(
  token: string,
  payload: {
    fullName: string;
    phone: string;
    parishName: string;
    parentContactName?: string | null;
    parentContactPhone?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    notes?: string | null;
    healthNotes?: string | null;
    rulesAccepted: boolean;
    privacyAccepted: boolean;
  }
) {
  const query = new URLSearchParams({ token });
  return request<LimanowaParticipant>(`/limanowa/participant/profile?${query.toString()}`, {
    method: 'PUT',
    body: JSON.stringify({
      fullName: payload.fullName,
      phone: payload.phone,
      parishName: payload.parishName,
      parentContactName: payload.parentContactName ?? null,
      parentContactPhone: payload.parentContactPhone ?? null,
      guardianName: payload.guardianName ?? null,
      guardianPhone: payload.guardianPhone ?? null,
      notes: payload.notes ?? null,
      healthNotes: payload.healthNotes ?? null,
      rulesAccepted: payload.rulesAccepted,
      privacyAccepted: payload.privacyAccepted
    })
  });
}

export function createLimanowaParticipantQuestion(token: string, message: string) {
  const query = new URLSearchParams({ token });
  return request<LimanowaQuestionThread>(`/limanowa/participant/questions?${query.toString()}`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export function getLimanowaAdminStatus() {
  return request<LimanowaAdminStatus>('/limanowa/admin/events-limanowa/status', {
    method: 'GET'
  });
}

export function claimLimanowaAdmin() {
  return request<{ claimed: boolean; alreadyOwner: boolean }>('/limanowa/admin/events-limanowa/claim', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function bootstrapLimanowaEvent() {
  return request<LimanowaEventSite>('/limanowa/admin/events-limanowa/bootstrap-limanowa', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getLimanowaAdminDashboard(eventId: string) {
  return request<LimanowaAdminDashboard>(`/limanowa/${eventId}/admin/dashboard`, {
    method: 'GET'
  });
}

export function updateLimanowaAdminEventSettings(
  eventId: string,
  payload: {
    title: string;
    subtitle: string;
    tagline: string;
    capacityTotal: number;
    registrationOpen: boolean;
    registrationGroupsDeadline: string;
    registrationParticipantsDeadline: string;
    published: boolean;
    privacyPolicyUrl: string;
    eventRulesUrl: string;
    thingsToBringUrl: string;
  }
) {
  return request<LimanowaEventSite>(`/limanowa/${eventId}/admin/event-settings`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      subtitle: payload.subtitle,
      tagline: payload.tagline,
      capacityTotal: payload.capacityTotal,
      registrationOpen: payload.registrationOpen,
      registrationGroupsDeadline: payload.registrationGroupsDeadline,
      registrationParticipantsDeadline: payload.registrationParticipantsDeadline,
      published: payload.published,
      privacyPolicyUrl: payload.privacyPolicyUrl,
      eventRulesUrl: payload.eventRulesUrl,
      thingsToBringUrl: payload.thingsToBringUrl
    })
  });
}

export function updateLimanowaAdminGroupStatus(eventId: string, groupId: string, status: string) {
  return request<LimanowaGroup>(`/limanowa/${eventId}/admin/groups/${groupId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

export function updateLimanowaAdminParticipantStatus(eventId: string, participantId: string, status: string) {
  return request<LimanowaParticipant>(`/limanowa/${eventId}/admin/participants/${participantId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

export function updateLimanowaAdminAccommodation(
  eventId: string,
  participantId: string,
  payload: { type: string; note?: string | null }
) {
  return request<LimanowaParticipant>(`/limanowa/${eventId}/admin/accommodation/${participantId}`, {
    method: 'PUT',
    body: JSON.stringify({
      type: payload.type,
      note: payload.note ?? null
    })
  });
}

export function createLimanowaAdminAnnouncement(
  eventId: string,
  payload: {
    title: string;
    body: string;
    audienceType: 'all' | 'group-admin' | 'participant' | 'admin';
  }
) {
  return request<LimanowaAnnouncement>(`/limanowa/${eventId}/admin/announcements`, {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      audienceType: payload.audienceType
    })
  });
}

export function replyLimanowaAdminThread(
  eventId: string,
  threadId: string,
  payload: {
    message: string;
    status?: 'open' | 'answered' | 'closed';
  }
) {
  return request<LimanowaQuestionThread>(`/limanowa/${eventId}/admin/questions/${threadId}/reply`, {
    method: 'POST',
    body: JSON.stringify({
      message: payload.message,
      status: payload.status ?? null
    })
  });
}

export function generateLimanowaGroupAdminAccess(eventId: string, groupId: string) {
  return request<LimanowaAccessLink>(`/limanowa/${eventId}/admin/groups/${groupId}/generate-access`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function generateLimanowaParticipantAccess(eventId: string, participantId: string) {
  return request<LimanowaAccessLink>(`/limanowa/${eventId}/admin/participants/${participantId}/generate-access`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getLimanowaAdminExportUrl(eventId: string, kind: LimanowaExportKind) {
  return `${apiBase}/limanowa/${eventId}/admin/exports/${kind}.csv`;
}

export function getEdkOrganizerDashboard(eventId: string) {
  return request<EdkOrganizerDashboard>(`/edk/${eventId}/organizer/dashboard`, {
    method: 'GET'
  });
}

export function exportEdkRegistrations(eventId: string) {
  return request<EdkRegistrationExport>(`/edk/${eventId}/organizer/registrations/export`, {
    method: 'GET'
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

export function deletePilgrimageParticipant(eventId: string, participantId: string) {
  return request<void>(`/pilgrimage/${eventId}/organizer/participants/${participantId}`, {
    method: 'DELETE'
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

export function deletePilgrimageInquiry(eventId: string, inquiryId: string) {
  return request<void>(`/pilgrimage/${eventId}/organizer/inquiries/${inquiryId}`, {
    method: 'DELETE'
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

// Calendar core v1
export type CalendarRoleBindingRequest = {
  roleId: string;
  accessType: 'viewer' | 'editor' | 'manager';
};

export type CalendarRoleBindingResponse = {
  bindingId: string;
  roleId: string;
  accessType: string;
  createdUtc: string;
  revokedUtc?: string | null;
};

export type CalendarResponse = {
  calendarId: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  organizationScope?: string | null;
  ownerRoleId: string;
  defaultTimeZoneId?: string | null;
  isArchived: boolean;
  createdUtc: string;
  updatedUtc: string;
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  roleBindings: CalendarRoleBindingResponse[];
};

export type CalendarReminderRequest = {
  minutesBefore: number;
  channel: 'inapp' | 'email' | 'sms' | 'push' | 'webhook';
  targetRoleId?: string | null;
  targetUserId?: string | null;
  channelConfigJson?: string | null;
};

export type CalendarReminderResponse = {
  reminderId: string;
  minutesBefore: number;
  channel: string;
  targetRoleId?: string | null;
  targetUserId?: string | null;
  status: string;
  createdUtc: string;
  updatedUtc: string;
  channelConfigJson?: string | null;
};

export type CalendarEventRoleScopeResponse = {
  scopeId: string;
  roleId: string;
  scopeType: string;
  canSeeTitle: boolean;
  canSeeGraph: boolean;
  createdUtc: string;
  revokedUtc?: string | null;
};

export type CalendarViewerScopeRequest = {
  roleId: string;
  canSeeTitle?: boolean;
  canSeeGraph?: boolean;
};

export type CalendarGraphNode = {
  nodeId: string;
  nodeType: string;
  nodeKey: string;
  configJson: string;
  positionX: number;
  positionY: number;
};

export type CalendarGraphEdge = {
  edgeId: string;
  fromNodeId: string;
  fromPort?: string | null;
  toNodeId: string;
  toPort?: string | null;
  edgeType?: string | null;
  conditionJson?: string | null;
};

export type CalendarGraphSummary = {
  graphId: string;
  templateKey: string;
  status: string;
  version: number;
  updatedUtc: string;
};

export type CalendarGraph = {
  graphId: string;
  eventId: string;
  templateKey: string;
  templateConfigJson: string;
  status: string;
  version: number;
  createdUtc: string;
  updatedUtc: string;
  nodes: CalendarGraphNode[];
  edges: CalendarGraphEdge[];
};

export type CalendarGraphTemplate = {
  templateKey: string;
  name: string;
  description: string;
  category: string;
  defaultConfigJson: string;
  nodes: CalendarGraphNode[];
  edges: CalendarGraphEdge[];
};

export type CalendarGraphExecution = {
  executionId: string;
  graphId: string;
  eventId: string;
  idempotencyKey: string;
  triggerType: string;
  status: string;
  triggerPayloadJson?: string | null;
  resultPayloadJson?: string | null;
  createdUtc: string;
  startedUtc: string;
  finishedUtc?: string | null;
};

export type CalendarEventResponse = {
  eventId: string;
  calendarId: string;
  eventGroupId?: string | null;
  eventGroupName?: string | null;
  ownerRoleId: string;
  titlePublic: string;
  summaryPublic?: string | null;
  locationPublic?: string | null;
  visibility: string;
  status: string;
  startUtc: string;
  endUtc: string;
  allDay: boolean;
  timeZoneId?: string | null;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceByWeekday?: string | null;
  recurrenceUntilUtc?: string | null;
  recurrenceCount?: number | null;
  recurrenceRule?: string | null;
  linkedModule?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  sourceFieldStart?: string | null;
  sourceFieldEnd?: string | null;
  conflictScopeMode: string;
  isArchived: boolean;
  createdUtc: string;
  updatedUtc: string;
  hasProtectedDetails: boolean;
  canReadProtectedDetails: boolean;
  protectedDetailsJson?: string | null;
  roleScopes: CalendarEventRoleScopeResponse[];
  reminders: CalendarReminderResponse[];
  itemType: 'appointment' | 'task';
  taskState?: string | null;
  completedUtc?: string | null;
  taskProgressPercent?: number | null;
  requiresCompletionProof: boolean;
  completionProofDataItemId?: string | null;
  assigneeRoleId?: string | null;
  graph?: CalendarGraphSummary | null;
};

export type CalendarOccurrenceResponse = {
  eventId: string;
  occurrenceStartUtc: string;
  occurrenceEndUtc: string;
  isRecurringInstance: boolean;
  event: CalendarEventResponse;
  graphExecutionId?: string | null;
  occurrenceSource?: string | null;
};

export type CalendarConflictResponse = {
  eventId: string;
  titlePublic: string;
  startUtc: string;
  endUtc: string;
  conflictReason: string;
};

export type CalendarEventsQueryResponse = {
  view: string;
  fromUtc: string;
  toUtc: string;
  occurrences: CalendarOccurrenceResponse[];
  conflicts: CalendarConflictResponse[];
};

export type CalendarEventShare = {
  linkId: string;
  code: string;
  label: string;
  mode: string;
  createdUtc: string;
  expiresUtc?: string | null;
  isActive: boolean;
  sharedViewId?: string | null;
  qrPayload?: string | null;
};

export type CalendarPublicEventResponse = {
  eventId: string;
  calendarId: string;
  titlePublic: string;
  summaryPublic?: string | null;
  locationPublic?: string | null;
  visibility: string;
  status: string;
  startUtc: string;
  endUtc: string;
  allDay: boolean;
  timeZoneId?: string | null;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceByWeekday?: string | null;
  recurrenceUntilUtc?: string | null;
  recurrenceCount?: number | null;
  recurrenceRule?: string | null;
  linkedModule?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  createdUtc: string;
  updatedUtc: string;
  itemType: 'appointment' | 'task';
  taskState?: string | null;
  completedUtc?: string | null;
  taskProgressPercent?: number | null;
};

export type CalendarReminderDispatchResponse = {
  dispatchId: string;
  reminderId: string;
  eventId: string;
  occurrenceStartUtc: string;
  channel: string;
  status: string;
  attemptCount: number;
  nextRetryUtc?: string | null;
  lastAttemptUtc?: string | null;
  deliveredUtc?: string | null;
  lastError?: string | null;
  createdUtc: string;
  updatedUtc: string;
};

export type CalendarGraphLinkResponse = {
  linkId: string;
  eventId: string;
  graphId: string;
  isPrimary: boolean;
  createdUtc: string;
  revokedUtc?: string | null;
};

export type CalendarEventGroupResponse = {
  eventGroupId: string;
  calendarId: string;
  ownerRoleId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isArchived: boolean;
  createdUtc: string;
  updatedUtc: string;
  itemCount: number;
};

export type CalendarEventGroupShareResponse = {
  linkId: string;
  code: string;
  label: string;
  mode: string;
  createdUtc: string;
  expiresUtc?: string | null;
  isActive: boolean;
  sharedViewId: string;
};

export type CalendarPublicGroupResponse = {
  eventGroupId: string;
  calendarId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  createdUtc: string;
  updatedUtc: string;
  items: CalendarPublicEventResponse[];
};

export function getCalendars(payload?: { organizationScope?: string; includeArchived?: boolean }) {
  const params = new URLSearchParams();
  if (payload?.organizationScope) params.set('organizationScope', payload.organizationScope);
  if (typeof payload?.includeArchived === 'boolean') params.set('includeArchived', String(payload.includeArchived));
  return request<CalendarResponse[]>(`/calendar/calendars${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET'
  });
}

export function getCalendar(calendarId: string) {
  return request<CalendarResponse>(`/calendar/calendars/${calendarId}`, {
    method: 'GET'
  });
}

export function createCalendar(payload: {
  name: string;
  description?: string | null;
  slug?: string | null;
  organizationScope?: string | null;
  ownerRoleId: string;
  defaultTimeZoneId?: string | null;
  roleBindings?: CalendarRoleBindingRequest[];
}) {
  return request<CalendarResponse>('/calendar/calendars', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? null,
      slug: payload.slug ?? null,
      organizationScope: payload.organizationScope ?? null,
      ownerRoleId: payload.ownerRoleId,
      defaultTimeZoneId: payload.defaultTimeZoneId ?? null,
      roleBindings: payload.roleBindings ?? []
    })
  });
}

export function updateCalendar(calendarId: string, payload: {
  name?: string | null;
  description?: string | null;
  defaultTimeZoneId?: string | null;
  isArchived?: boolean;
}) {
  return request<CalendarResponse>(`/calendar/calendars/${calendarId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name ?? null,
      description: payload.description ?? null,
      defaultTimeZoneId: payload.defaultTimeZoneId ?? null,
      isArchived: typeof payload.isArchived === 'boolean' ? payload.isArchived : null
    })
  });
}

export function bindCalendarRole(calendarId: string, payload: CalendarRoleBindingRequest) {
  return request<CalendarRoleBindingResponse[]>(`/calendar/calendars/${calendarId}/roles`, {
    method: 'POST',
    body: JSON.stringify({
      roleId: payload.roleId,
      accessType: payload.accessType
    })
  });
}

export function unbindCalendarRole(calendarId: string, roleId: string) {
  return request<CalendarRoleBindingResponse[]>(`/calendar/calendars/${calendarId}/roles/${roleId}`, {
    method: 'DELETE'
  });
}

export function getCalendarItem(eventId: string, includeProtected = true) {
  const params = new URLSearchParams();
  params.set('includeProtected', String(includeProtected));
  return request<CalendarEventResponse>(`/calendar/events/${eventId}?${params.toString()}`, {
    method: 'GET'
  });
}

export function createCalendarItem(payload: {
  calendarId: string;
  eventGroupId?: string | null;
  ownerRoleId: string;
  titlePublic: string;
  summaryPublic?: string | null;
  locationPublic?: string | null;
  visibility: 'private' | 'role' | 'public';
  status: 'planned' | 'confirmed' | 'cancelled' | 'completed';
  startUtc: string;
  endUtc: string;
  allDay?: boolean;
  timeZoneId?: string | null;
  protectedDetailsJson?: string | null;
  linkedModule?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  sourceFieldStart?: string | null;
  sourceFieldEnd?: string | null;
  conflictScopeMode?: 'role' | 'calendar' | null;
  scopedRoleIds?: string[];
  viewerScopes?: CalendarViewerScopeRequest[];
  reminders?: CalendarReminderRequest[];
  allowConflicts?: boolean;
  itemType?: 'appointment' | 'task';
  taskState?: string | null;
  taskProgressPercent?: number | null;
  requiresCompletionProof?: boolean;
  completionProofJson?: string | null;
  assigneeRoleId?: string | null;
  graph?: {
    templateKey: string;
    templateConfigJson?: string | null;
    status: 'draft' | 'active' | 'archived';
    nodes: Array<{
      nodeId?: string | null;
      nodeType: string;
      nodeKey: string;
      configJson?: string | null;
      positionX: number;
      positionY: number;
    }>;
    edges: Array<{
      edgeId?: string | null;
      fromNodeId: string;
      fromPort?: string | null;
      toNodeId: string;
      toPort?: string | null;
      edgeType?: string | null;
      conditionJson?: string | null;
    }>;
  } | null;
}) {
  return request<CalendarEventResponse>('/calendar/events', {
    method: 'POST',
    body: JSON.stringify({
      calendarId: payload.calendarId,
      eventGroupId: payload.eventGroupId ?? null,
      ownerRoleId: payload.ownerRoleId,
      titlePublic: payload.titlePublic,
      summaryPublic: payload.summaryPublic ?? null,
      locationPublic: payload.locationPublic ?? null,
      visibility: payload.visibility,
      status: payload.status,
      startUtc: payload.startUtc,
      endUtc: payload.endUtc,
      allDay: payload.allDay ?? false,
      timeZoneId: payload.timeZoneId ?? null,
      recurrenceType: 'none',
      recurrenceInterval: 1,
      recurrenceByWeekday: null,
      recurrenceUntilUtc: null,
      recurrenceCount: null,
      recurrenceRule: null,
      protectedDetailsJson: payload.protectedDetailsJson ?? null,
      linkedModule: payload.linkedModule ?? null,
      linkedEntityType: payload.linkedEntityType ?? null,
      linkedEntityId: payload.linkedEntityId ?? null,
      sourceFieldStart: payload.sourceFieldStart ?? null,
      sourceFieldEnd: payload.sourceFieldEnd ?? null,
      conflictScopeMode: payload.conflictScopeMode ?? null,
      scopedRoleIds: payload.scopedRoleIds ?? [],
      viewerScopes: (payload.viewerScopes ?? []).map((viewer) => ({
        roleId: viewer.roleId,
        canSeeTitle: viewer.canSeeTitle ?? true,
        canSeeGraph: viewer.canSeeGraph ?? false
      })),
      reminders: payload.reminders ?? [],
      allowConflicts: payload.allowConflicts ?? false,
      itemType: payload.itemType ?? 'appointment',
      taskState: payload.taskState ?? null,
      taskProgressPercent: payload.taskProgressPercent ?? null,
      requiresCompletionProof: payload.requiresCompletionProof ?? false,
      completionProofJson: payload.completionProofJson ?? null,
      assigneeRoleId: payload.assigneeRoleId ?? null,
      graph: payload.graph
        ? {
            templateKey: payload.graph.templateKey,
            templateConfigJson: payload.graph.templateConfigJson ?? null,
            status: payload.graph.status,
            nodes: payload.graph.nodes.map((node) => ({
              nodeId: node.nodeId ?? null,
              nodeType: node.nodeType,
              nodeKey: node.nodeKey,
              configJson: node.configJson ?? null,
              positionX: node.positionX,
              positionY: node.positionY
            })),
            edges: payload.graph.edges.map((edge) => ({
              edgeId: edge.edgeId ?? null,
              fromNodeId: edge.fromNodeId,
              fromPort: edge.fromPort ?? null,
              toNodeId: edge.toNodeId,
              toPort: edge.toPort ?? null,
              edgeType: edge.edgeType ?? null,
              conditionJson: edge.conditionJson ?? null
            }))
          }
        : null
    })
  });
}

export function updateCalendarItem(eventId: string, payload: {
  titlePublic?: string | null;
  summaryPublic?: string | null;
  locationPublic?: string | null;
  visibility?: 'private' | 'role' | 'public' | null;
  status?: 'planned' | 'confirmed' | 'cancelled' | 'completed' | null;
  startUtc?: string | null;
  endUtc?: string | null;
  allDay?: boolean;
  timeZoneId?: string | null;
  replaceProtectedDetails?: boolean;
  protectedDetailsJson?: string | null;
  linkedModule?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  eventGroupId?: string | null;
  sourceFieldStart?: string | null;
  sourceFieldEnd?: string | null;
  conflictScopeMode?: 'role' | 'calendar' | null;
  scopedRoleIds?: string[];
  replaceRoleScopes?: boolean;
  viewerScopes?: CalendarViewerScopeRequest[];
  replaceViewerScopes?: boolean;
  reminders?: CalendarReminderRequest[];
  replaceReminders?: boolean;
  isArchived?: boolean;
  allowConflicts?: boolean;
  itemType?: 'appointment' | 'task' | null;
  taskState?: string | null;
  taskProgressPercent?: number | null;
  requiresCompletionProof?: boolean | null;
  completionProofJson?: string | null;
  assigneeRoleId?: string | null;
  upsertGraph?: boolean;
  graph?: {
    templateKey: string;
    templateConfigJson?: string | null;
    status: 'draft' | 'active' | 'archived';
    nodes: Array<{
      nodeId?: string | null;
      nodeType: string;
      nodeKey: string;
      configJson?: string | null;
      positionX: number;
      positionY: number;
    }>;
    edges: Array<{
      edgeId?: string | null;
      fromNodeId: string;
      fromPort?: string | null;
      toNodeId: string;
      toPort?: string | null;
      edgeType?: string | null;
      conditionJson?: string | null;
    }>;
  } | null;
}) {
  return request<CalendarEventResponse>(`/calendar/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      titlePublic: payload.titlePublic ?? null,
      summaryPublic: payload.summaryPublic ?? null,
      locationPublic: payload.locationPublic ?? null,
      visibility: payload.visibility ?? null,
      status: payload.status ?? null,
      startUtc: payload.startUtc ?? null,
      endUtc: payload.endUtc ?? null,
      allDay: typeof payload.allDay === 'boolean' ? payload.allDay : null,
      timeZoneId: payload.timeZoneId ?? null,
      recurrenceType: null,
      recurrenceInterval: null,
      recurrenceByWeekday: null,
      recurrenceUntilUtc: null,
      recurrenceCount: null,
      recurrenceRule: null,
      replaceProtectedDetails: payload.replaceProtectedDetails ?? false,
      protectedDetailsJson: payload.protectedDetailsJson ?? null,
      linkedModule: payload.linkedModule ?? null,
      linkedEntityType: payload.linkedEntityType ?? null,
      linkedEntityId: payload.linkedEntityId ?? null,
      eventGroupId: payload.eventGroupId ?? null,
      sourceFieldStart: payload.sourceFieldStart ?? null,
      sourceFieldEnd: payload.sourceFieldEnd ?? null,
      conflictScopeMode: payload.conflictScopeMode ?? null,
      scopedRoleIds: payload.scopedRoleIds ?? [],
      replaceRoleScopes: payload.replaceRoleScopes ?? false,
      viewerScopes: (payload.viewerScopes ?? []).map((viewer) => ({
        roleId: viewer.roleId,
        canSeeTitle: viewer.canSeeTitle ?? true,
        canSeeGraph: viewer.canSeeGraph ?? false
      })),
      replaceViewerScopes: payload.replaceViewerScopes ?? false,
      reminders: payload.reminders ?? [],
      replaceReminders: payload.replaceReminders ?? false,
      isArchived: typeof payload.isArchived === 'boolean' ? payload.isArchived : null,
      allowConflicts: payload.allowConflicts ?? false,
      itemType: payload.itemType ?? null,
      taskState: payload.taskState ?? null,
      taskProgressPercent: payload.taskProgressPercent ?? null,
      requiresCompletionProof: typeof payload.requiresCompletionProof === 'boolean' ? payload.requiresCompletionProof : null,
      completionProofJson: payload.completionProofJson ?? null,
      assigneeRoleId: payload.assigneeRoleId ?? null,
      upsertGraph: payload.upsertGraph ?? false,
      graph: payload.graph
        ? {
            templateKey: payload.graph.templateKey,
            templateConfigJson: payload.graph.templateConfigJson ?? null,
            status: payload.graph.status,
            nodes: payload.graph.nodes.map((node) => ({
              nodeId: node.nodeId ?? null,
              nodeType: node.nodeType,
              nodeKey: node.nodeKey,
              configJson: node.configJson ?? null,
              positionX: node.positionX,
              positionY: node.positionY
            })),
            edges: payload.graph.edges.map((edge) => ({
              edgeId: edge.edgeId ?? null,
              fromNodeId: edge.fromNodeId,
              fromPort: edge.fromPort ?? null,
              toNodeId: edge.toNodeId,
              toPort: edge.toPort ?? null,
              edgeType: edge.edgeType ?? null,
              conditionJson: edge.conditionJson ?? null
            }))
          }
        : null
    })
  });
}

export function archiveCalendarItem(eventId: string) {
  return request<{ archived: boolean }>(`/calendar/events/${eventId}`, {
    method: 'DELETE',
    body: JSON.stringify({})
  });
}

export function getCalendarEvents(payload: {
  calendarId: string;
  view?: 'month' | 'week' | 'day' | 'list';
  fromUtc?: string;
  toUtc?: string;
  status?: string;
  visibility?: string;
  itemType?: 'appointment' | 'task';
  taskState?: string;
  linkedModule?: string;
  linkedEntityId?: string;
  includeArchived?: boolean;
  includeProtected?: boolean;
}) {
  const params = new URLSearchParams();
  if (payload.view) params.set('view', payload.view);
  if (payload.fromUtc) params.set('fromUtc', payload.fromUtc);
  if (payload.toUtc) params.set('toUtc', payload.toUtc);
  if (payload.status) params.set('status', payload.status);
  if (payload.visibility) params.set('visibility', payload.visibility);
  if (payload.itemType) params.set('itemType', payload.itemType);
  if (payload.taskState) params.set('taskState', payload.taskState);
  if (payload.linkedModule) params.set('linkedModule', payload.linkedModule);
  if (payload.linkedEntityId) params.set('linkedEntityId', payload.linkedEntityId);
  if (typeof payload.includeArchived === 'boolean') params.set('includeArchived', String(payload.includeArchived));
  if (typeof payload.includeProtected === 'boolean') params.set('includeProtected', String(payload.includeProtected));
  return request<CalendarEventsQueryResponse>(`/calendar/calendars/${payload.calendarId}/events?${params.toString()}`, {
    method: 'GET'
  });
}

export function checkCalendarConflicts(payload: {
  calendarId: string;
  startUtc: string;
  endUtc: string;
  scopeRoleIds: string[];
  ignoreEventId?: string | null;
}) {
  return request<CalendarConflictResponse[]>('/calendar/calendars/conflicts', {
    method: 'POST',
    body: JSON.stringify({
      calendarId: payload.calendarId,
      startUtc: payload.startUtc,
      endUtc: payload.endUtc,
      scopeRoleIds: payload.scopeRoleIds,
      ignoreEventId: payload.ignoreEventId ?? null
    })
  });
}

export function getCalendarItemConflicts(eventId: string) {
  return request<CalendarConflictResponse[]>(`/calendar/events/${eventId}/conflicts`, {
    method: 'GET'
  });
}

export function getCalendarGraphTemplates() {
  return request<CalendarGraphTemplate[]>('/calendar/graph/templates', {
    method: 'GET'
  });
}

export function getCalendarGraph(eventId: string) {
  return request<CalendarGraph>(`/calendar/events/${eventId}/graph`, {
    method: 'GET'
  });
}

export function getCalendarGraphs(calendarId: string) {
  return request<Array<{
    graphId: string;
    sourceEventId: string;
    titlePublic: string;
    templateKey: string;
    status: string;
    version: number;
    updatedUtc: string;
  }>>(`/calendar/calendars/${calendarId}/graphs`, {
    method: 'GET'
  });
}

export function upsertCalendarGraph(eventId: string, payload: {
  templateKey: string;
  templateConfigJson?: string | null;
  status: 'draft' | 'active' | 'archived';
  nodes: Array<{
    nodeId?: string | null;
    nodeType: string;
    nodeKey: string;
    configJson?: string | null;
    positionX: number;
    positionY: number;
  }>;
  edges: Array<{
    edgeId?: string | null;
    fromNodeId: string;
    fromPort?: string | null;
    toNodeId: string;
    toPort?: string | null;
    edgeType?: string | null;
    conditionJson?: string | null;
  }>;
}) {
  return request<CalendarGraph>(`/calendar/events/${eventId}/graph`, {
    method: 'PUT',
    body: JSON.stringify({
      templateKey: payload.templateKey,
      templateConfigJson: payload.templateConfigJson ?? null,
      status: payload.status,
      nodes: payload.nodes.map((node) => ({
        nodeId: node.nodeId ?? null,
        nodeType: node.nodeType,
        nodeKey: node.nodeKey,
        configJson: node.configJson ?? null,
        positionX: node.positionX,
        positionY: node.positionY
      })),
      edges: payload.edges.map((edge) => ({
        edgeId: edge.edgeId ?? null,
        fromNodeId: edge.fromNodeId,
        fromPort: edge.fromPort ?? null,
        toNodeId: edge.toNodeId,
        toPort: edge.toPort ?? null,
        edgeType: edge.edgeType ?? null,
        conditionJson: edge.conditionJson ?? null
      }))
    })
  });
}

export function executeCalendarGraph(eventId: string, payload: {
  triggerType?: 'manual' | 'completion' | 'schedule';
  completionAction?: 'complete_only' | 'run_graph' | null;
  idempotencyKey?: string | null;
  triggerPayloadJson?: string | null;
}) {
  return request<CalendarGraphExecution>(`/calendar/events/${eventId}/graph/execute`, {
    method: 'POST',
    body: JSON.stringify({
      triggerType: payload.triggerType ?? 'manual',
      completionAction: payload.completionAction ?? null,
      idempotencyKey: payload.idempotencyKey ?? null,
      triggerPayloadJson: payload.triggerPayloadJson ?? null
    })
  });
}

export function getCalendarGraphExecutions(eventId: string, take?: number) {
  const params = new URLSearchParams();
  if (typeof take === 'number') params.set('take', String(take));
  return request<CalendarGraphExecution[]>(`/calendar/events/${eventId}/graph/executions${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET'
  });
}

export function linkCalendarEventGraph(eventId: string, graphId: string) {
  return request<CalendarGraphLinkResponse>(`/calendar/events/${eventId}/graph/link`, {
    method: 'POST',
    body: JSON.stringify({ graphId })
  });
}

export function upsertCalendarViewer(eventId: string, payload: CalendarViewerScopeRequest) {
  return request<CalendarEventRoleScopeResponse[]>(`/calendar/events/${eventId}/viewers`, {
    method: 'POST',
    body: JSON.stringify({
      roleId: payload.roleId,
      canSeeTitle: payload.canSeeTitle ?? true,
      canSeeGraph: payload.canSeeGraph ?? false
    })
  });
}

export function removeCalendarViewer(eventId: string, roleId: string) {
  return request<{ revoked: boolean }>(`/calendar/events/${eventId}/viewers/${roleId}`, {
    method: 'DELETE',
    body: JSON.stringify({})
  });
}

export function completeCalendarTask(eventId: string, payload?: {
  completionProofJson?: string | null;
  taskState?: string | null;
  triggerPayloadJson?: string | null;
  idempotencyKey?: string | null;
}) {
  return request<{ eventId: string; taskState: string; completedUtc?: string | null; graphExecution?: CalendarGraphExecution | null }>(`/calendar/events/${eventId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      completionProofJson: payload?.completionProofJson ?? null,
      taskState: payload?.taskState ?? null,
      triggerPayloadJson: payload?.triggerPayloadJson ?? null,
      idempotencyKey: payload?.idempotencyKey ?? null
    })
  });
}

export function completeCalendarTaskAndRunGraph(eventId: string, payload?: {
  completionProofJson?: string | null;
  triggerPayloadJson?: string | null;
  idempotencyKey?: string | null;
}) {
  return request<{ eventId: string; taskState: string; completedUtc?: string | null; graphExecution?: CalendarGraphExecution | null }>(`/calendar/events/${eventId}/complete-and-run-graph`, {
    method: 'POST',
    body: JSON.stringify({
      completionProofJson: payload?.completionProofJson ?? null,
      taskState: 'done',
      triggerPayloadJson: payload?.triggerPayloadJson ?? null,
      idempotencyKey: payload?.idempotencyKey ?? null
    })
  });
}

export function createCalendarShare(eventId: string, payload?: { label?: string | null; expiresInHours?: number | null; mode?: 'readonly' }) {
  return request<CalendarEventShare>(`/calendar/events/${eventId}/shares`, {
    method: 'POST',
    body: JSON.stringify({
      label: payload?.label ?? null,
      expiresInHours: typeof payload?.expiresInHours === 'number' ? payload.expiresInHours : null,
      mode: payload?.mode ?? 'readonly'
    })
  });
}

export function listCalendarEventGroups(calendarId: string, payload?: { includeArchived?: boolean }) {
  const params = new URLSearchParams();
  if (typeof payload?.includeArchived === 'boolean') params.set('includeArchived', String(payload.includeArchived));
  return request<CalendarEventGroupResponse[]>(`/calendar/calendars/${calendarId}/event-groups${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET'
  });
}

export function createCalendarEventGroup(calendarId: string, payload: {
  name: string;
  ownerRoleId: string;
  description?: string | null;
  category?: string | null;
}) {
  return request<CalendarEventGroupResponse>(`/calendar/calendars/${calendarId}/event-groups`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      ownerRoleId: payload.ownerRoleId,
      description: payload.description ?? null,
      category: payload.category ?? null
    })
  });
}

export function updateCalendarEventGroup(eventGroupId: string, payload: {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  isArchived?: boolean;
}) {
  return request<CalendarEventGroupResponse>(`/calendar/event-groups/${eventGroupId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name ?? null,
      description: payload.description ?? null,
      category: payload.category ?? null,
      isArchived: typeof payload.isArchived === 'boolean' ? payload.isArchived : null
    })
  });
}

export function createWeeklyCalendarSeries(eventGroupId: string, payload: {
  ownerRoleId: string;
  titlePublic: string;
  summaryPublic?: string | null;
  locationPublic?: string | null;
  visibility: 'private' | 'role' | 'public';
  firstStartUtc: string;
  firstEndUtc: string;
  untilUtc: string;
  intervalWeeks?: number;
  scopedRoleIds?: string[];
  viewerScopes?: CalendarViewerScopeRequest[];
  graphId?: string | null;
  allowConflicts?: boolean;
}) {
  return request<{ eventGroupId: string; createdCount: number; eventIds: string[] }>(`/calendar/event-groups/${eventGroupId}/series/weekly`, {
    method: 'POST',
    body: JSON.stringify({
      ownerRoleId: payload.ownerRoleId,
      titlePublic: payload.titlePublic,
      summaryPublic: payload.summaryPublic ?? null,
      locationPublic: payload.locationPublic ?? null,
      visibility: payload.visibility,
      firstStartUtc: payload.firstStartUtc,
      firstEndUtc: payload.firstEndUtc,
      untilUtc: payload.untilUtc,
      intervalWeeks: payload.intervalWeeks ?? 1,
      scopedRoleIds: payload.scopedRoleIds ?? [],
      viewerScopes: (payload.viewerScopes ?? []).map((viewer) => ({
        roleId: viewer.roleId,
        canSeeTitle: viewer.canSeeTitle ?? true,
        canSeeGraph: viewer.canSeeGraph ?? false
      })),
      graphId: payload.graphId ?? null,
      allowConflicts: payload.allowConflicts ?? false
    })
  });
}

export function createCalendarEventGroupShare(eventGroupId: string, payload?: { label?: string | null; expiresInHours?: number | null; mode?: 'readonly' }) {
  return request<CalendarEventGroupShareResponse>(`/calendar/event-groups/${eventGroupId}/shares`, {
    method: 'POST',
    body: JSON.stringify({
      label: payload?.label ?? null,
      expiresInHours: typeof payload?.expiresInHours === 'number' ? payload.expiresInHours : null,
      mode: payload?.mode ?? 'readonly'
    })
  });
}

export function listCalendarEventGroupShares(eventGroupId: string) {
  return request<CalendarEventGroupShareResponse[]>(`/calendar/event-groups/${eventGroupId}/shares`, {
    method: 'GET'
  });
}

export function revokeCalendarEventGroupShare(eventGroupId: string, linkId: string) {
  return request<{ revoked: boolean }>(`/calendar/event-groups/${eventGroupId}/shares/${linkId}`, {
    method: 'DELETE',
    body: JSON.stringify({})
  });
}

export function listCalendarShares(eventId: string) {
  return request<CalendarEventShare[]>(`/calendar/events/${eventId}/shares`, {
    method: 'GET'
  });
}

export function revokeCalendarShare(eventId: string, linkId: string) {
  return request<{ revoked: boolean }>(`/calendar/events/${eventId}/shares/${linkId}`, {
    method: 'DELETE',
    body: JSON.stringify({})
  });
}

export function getCalendarReminderDispatches(eventId: string, take?: number) {
  const params = new URLSearchParams();
  if (typeof take === 'number') params.set('take', String(take));
  return request<CalendarReminderDispatchResponse[]>(`/calendar/events/${eventId}/reminder-dispatches${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET'
  });
}

export function getPublicCalendarEvents(calendarId: string, payload?: { view?: string; fromUtc?: string; toUtc?: string; status?: string }) {
  const params = new URLSearchParams();
  if (payload?.view) params.set('view', payload.view);
  if (payload?.fromUtc) params.set('fromUtc', payload.fromUtc);
  if (payload?.toUtc) params.set('toUtc', payload.toUtc);
  if (payload?.status) params.set('status', payload.status);
  return request<CalendarPublicEventResponse[]>(`/calendar/calendars/${calendarId}/public/events${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET'
  });
}

export function getPublicSharedCalendarItem(code: string) {
  return request<CalendarPublicEventResponse>(`/calendar/public/shared/${encodeURIComponent(code)}`, {
    method: 'GET'
  });
}

export function getPublicSharedCalendarGroup(code: string) {
  return request<CalendarPublicGroupResponse>(`/calendar/public/group-shared/${encodeURIComponent(code)}`, {
    method: 'GET'
  });
}
