const saltPrefix = 'recreatio.salt.';
const tokenKey = 'recreatio.token';

export function storeSalt(loginId: string, salt: string): void {
  localStorage.setItem(`${saltPrefix}${loginId.toLowerCase()}`, salt);
}

export function loadSalt(loginId: string): string | null {
  return localStorage.getItem(`${saltPrefix}${loginId.toLowerCase()}`);
}

export function storeToken(token: string): void {
  localStorage.setItem(tokenKey, token);
}

export function loadToken(): string | null {
  return localStorage.getItem(tokenKey);
}

export function clearToken(): void {
  localStorage.removeItem(tokenKey);
}
