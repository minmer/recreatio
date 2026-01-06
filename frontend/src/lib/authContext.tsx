import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { issueCsrf, logout as apiLogout, me, setSessionMode } from './api';
import { loginWithPassword, registerWithPassword } from './authClient';

type SessionInfo = {
  userId: string;
  sessionId: string;
  secureMode: boolean;
};

type AuthStatus = {
  type: 'idle' | 'working' | 'success' | 'error';
  message?: string;
};

type AuthContextValue = {
  session: SessionInfo | null;
  status: AuthStatus;
  register: (options: { loginId: string; password: string; displayName?: string | null }) => Promise<void>;
  login: (options: { loginId: string; password: string; secureMode: boolean; deviceInfo?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSecureMode: (secureMode: boolean) => Promise<void>;
  setStatus: (status: AuthStatus) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<AuthStatus>({ type: 'idle' });

  useEffect(() => {
    issueCsrf().catch(() => {
      setStatus({ type: 'error', message: 'Unable to initialize security token.' });
    });
  }, []);

  const register = useCallback(async (options: { loginId: string; password: string; displayName?: string | null }) => {
    setStatus({ type: 'working', message: 'Registering account…' });
    await registerWithPassword(options);
    setStatus({ type: 'success', message: 'Account created. You can now log in.' });
  }, []);

  const login = useCallback(async (options: { loginId: string; password: string; secureMode: boolean; deviceInfo?: string }) => {
    setStatus({ type: 'working', message: 'Signing in…' });
    const response = await loginWithPassword(options);
    setSession({
      userId: response.userId,
      sessionId: response.sessionId,
      secureMode: response.secureMode
    });
    setStatus({ type: 'success', message: 'Signed in.' });
  }, []);

  const logout = useCallback(async () => {
    setStatus({ type: 'working', message: 'Signing out…' });
    await apiLogout();
    setSession(null);
    setStatus({ type: 'success', message: 'Signed out.' });
  }, []);

  const refresh = useCallback(async () => {
    setStatus({ type: 'working', message: 'Checking session…' });
    const response = await me();
    setSession({
      userId: response.userId,
      sessionId: response.sessionId,
      secureMode: response.isSecureMode
    });
    setStatus({ type: 'success', message: 'Session active.' });
  }, []);

  const setSecureMode = useCallback(async (secureMode: boolean) => {
    setStatus({ type: 'working', message: 'Updating session mode…' });
    const response = await setSessionMode(secureMode);
    setSession((current) =>
      current
        ? { ...current, sessionId: response.sessionId, secureMode: response.isSecureMode }
        : current
    );
    setStatus({ type: 'success', message: 'Mode updated.' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      register,
      login,
      logout,
      refresh,
      setSecureMode,
      setStatus
    }),
    [session, status, register, login, logout, refresh, setSecureMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
