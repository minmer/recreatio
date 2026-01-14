const apiBase = import.meta.env.VITE_API_BASE ?? 'https://recreatio.hostingasp.pl';
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

export type PersonFieldResponse = {
  fieldType: string;
  plainValue?: string | null;
  dataKeyId: string;
};

export type PersonResponse = {
  personRoleId: string;
  publicSigningKeyBase64?: string | null;
  publicSigningKeyAlg?: string | null;
  fields: PersonFieldResponse[];
};

export type RoleSummaryResponse = {
  roleId: string;
  roleType: string;
};

export type PersonAccessMemberResponse = {
  userId: string;
  loginId: string;
  displayName?: string | null;
  relationshipType: string;
  roles: RoleSummaryResponse[];
};

export type PersonAccessResponse = {
  personRoleId: string;
  members: PersonAccessMemberResponse[];
};

export function getPersons() {
  return request<PersonResponse[]>('/account/persons', {
    method: 'GET'
  });
}

export function createPerson(payload: {
  fields: Array<{
    fieldType: string;
    plainValue?: string | null;
    dataKeyId?: string | null;
    signatureBase64?: string | null;
  }>;
  publicSigningKeyBase64?: string | null;
  publicSigningKeyAlg?: string | null;
  signatureBase64?: string | null;
}) {
  return request<PersonResponse>('/account/persons', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updatePersonField(roleId: string, payload: {
  fieldType: string;
  plainValue?: string | null;
  dataKeyId?: string | null;
  signatureBase64?: string | null;
}) {
  return request<PersonFieldResponse>(`/account/persons/${roleId}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getPersonAccess(roleId: string) {
  return request<PersonAccessResponse>(`/account/persons/${roleId}/access`, {
    method: 'GET'
  });
}

export function addPersonMember(roleId: string, payload: {
  loginId: string;
  relationshipType: string;
  encryptedRoleKeyCopyBase64?: string | null;
  signatureBase64?: string | null;
}) {
  return request<void>(`/account/persons/${roleId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function shareRecovery(roleId: string, payload: {
  sharedWithRoleId: string;
  encryptedShareBase64: string;
  signatureBase64?: string | null;
}) {
  return request<void>(`/account/persons/${roleId}/recovery/shares`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createRecoveryRequest(roleId: string, payload: { initiatorRoleId: string; signatureBase64?: string | null }) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(`/account/persons/${roleId}/recovery/request`, {
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
    `/account/persons/${roleId}/recovery/request/${requestId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export function cancelRecoveryRequest(roleId: string, requestId: string) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(
    `/account/persons/${roleId}/recovery/request/${requestId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
}

export function completeRecoveryRequest(roleId: string, requestId: string) {
  return request<{ requestId: string; status: string; requiredApprovals: number }>(
    `/account/persons/${roleId}/recovery/request/${requestId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
}
