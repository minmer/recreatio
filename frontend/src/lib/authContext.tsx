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
    issueCsrf().catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        const response = await me();
        if (!active) return;
        setSession({
          userId: response.userId,
          sessionId: response.sessionId,
          secureMode: response.isSecureMode
        });
      } catch {
        if (!active) return;
      }
    };
    loadSession();
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (options: { loginId: string; password: string; displayName?: string | null }) => {
    await registerWithPassword(options);
  }, []);

  const login = useCallback(async (options: { loginId: string; password: string; secureMode: boolean; deviceInfo?: string }) => {
    const response = await loginWithPassword(options);
    setSession({
      userId: response.userId,
      sessionId: response.sessionId,
      secureMode: response.secureMode
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort logout: always clear local session to avoid sticky auth UI.
    } finally {
      setSession(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const response = await me();
    setSession({
      userId: response.userId,
      sessionId: response.sessionId,
      secureMode: response.isSecureMode
    });
  }, []);

  const setSecureMode = useCallback(async (secureMode: boolean) => {
    const response = await setSessionMode(secureMode);
    setSession((current) =>
      current
        ? { ...current, sessionId: response.sessionId, secureMode: response.isSecureMode }
        : current
    );
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
