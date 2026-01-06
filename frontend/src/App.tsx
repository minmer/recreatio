import { useEffect, useMemo, useState } from 'react';
import { checkAvailability } from './lib/api';
import { useAuth } from './lib/authContext';
import { checkPasswordStrength } from './lib/passwordPolicy';
import { copy } from './content';
import type { RouteKey, Mode } from './types/navigation';
import { useRoute } from './routes/useRoute';
import { Topbar } from './components/Topbar';
import { Footer } from './components/Footer';
import { LoginCard } from './components/LoginCard';
import { AccessPanel } from './components/AccessPanel';
import { Dashboard } from './components/Dashboard';
import { HomePage } from './pages/HomePage';
import { ParishPage } from './pages/ParishPage';
import { CogitaPage } from './pages/CogitaPage';
import { FaqPage } from './pages/FaqPage';
import { LegalPage } from './pages/LegalPage';
import { AccountPage } from './pages/AccountPage';

const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [language, setLanguage] = useState<'pl' | 'en'>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('recreatio.lang') : null;
    return stored === 'en' ? 'en' : 'pl';
  });
  const { route, navigate, setRoute } = useRoute();
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [secureMode, setSecureMode] = useState(false);
  const [availability, setAvailability] = useState<string | null>(null);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [loginCardOpen, setLoginCardOpen] = useState(false);
  const [loginCardContext, setLoginCardContext] = useState<RouteKey>('home');
  const { session, status, register, login, logout, refresh, setSecureMode: updateMode, setStatus } = useAuth();
  const t = copy[language];

  const isCogitaHost = useMemo(() => window.location.hostname.includes('cogita'), []);
  const isParishHost = useMemo(() => window.location.hostname.includes('parish'), []);

  useEffect(() => {
    if (isCogitaHost && route === 'home') {
      setRoute('cogita');
      window.history.replaceState({}, '', '/cogita');
    }
    if (isParishHost && route === 'home') {
      setRoute('parish');
      window.history.replaceState({}, '', '/parish');
    }
  }, [isCogitaHost, isParishHost, route, setRoute]);

  useEffect(() => {
    if (!password) {
      setPasswordHint(null);
      return;
    }

    const check = checkPasswordStrength(password);
    setPasswordHint(check.message);
  }, [password]);

  useEffect(() => {
    if (!loginId || mode !== 'register') {
      setAvailability(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await checkAvailability(loginId);
        setAvailability(response.isAvailable ? `${t.access.loginId} ✓` : t.access.loginTaken);
      } catch {
        setAvailability(null);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [loginId, mode, t.access.loginId]);

  useEffect(() => {
    if (session) {
      setSecureMode(session.secureMode);
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem('recreatio.lang', language);
  }, [language]);

  const resetStatus = () => setStatus({ type: 'idle' });

  const openLoginCard = (context: RouteKey) => {
    setLoginCardContext(context);
    setLoginCardOpen(true);
  };

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    resetStatus();

    try {
      if (!loginId || !password) {
        setStatus({ type: 'error', message: t.access.loginRequired });
        return;
      }

      const strength = checkPasswordStrength(password);
      if (!strength.ok) {
        setStatus({ type: 'error', message: strength.message });
        return;
      }

      if (password !== passwordConfirm) {
        setStatus({ type: 'error', message: t.access.passwordMismatch });
        return;
      }

      const availabilityCheck = await checkAvailability(loginId);
      if (!availabilityCheck.isAvailable) {
        setStatus({ type: 'error', message: t.access.loginTaken });
        return;
      }

      setStatus({ type: 'working', message: t.access.loadingRegister });
      await register({
        loginId,
        password,
        displayName: displayName || undefined
      });

      setMode('login');
    } catch (error) {
      const message = error instanceof Error ? error.message : t.access.registerError;
      setStatus({ type: 'error', message });
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    resetStatus();

    try {
      if (!loginId || !password) {
        setStatus({ type: 'error', message: t.access.loginRequired });
        return;
      }

      setStatus({ type: 'working', message: t.access.loadingLogin });
      await login({
        loginId,
        password,
        secureMode,
        deviceInfo
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.access.loginError;
      setStatus({ type: 'error', message });
    }
  }

  async function handleLogout() {
    resetStatus();
    await logout();
  }

  async function handleCheckSession() {
    resetStatus();
    await refresh();
  }

  async function handleToggleMode() {
    resetStatus();
    await updateMode(!secureMode);
    setSecureMode(!secureMode);
  }

  const sessionInfo = session
    ? `${t.access.sessionLabel} ${session.sessionId} (${session.secureMode ? 'Secure' : 'Normal'} mode)`
    : null;

  return (
    <div className="app">
      <Topbar
        copy={t}
        onNavigate={navigate}
        onToggleLanguage={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
        language={language}
        showAccountLabel={Boolean(session)}
      />

      <main>
        {route === 'home' && (
          <HomePage
            copy={t}
            onNavigate={navigate}
            onPrimary={() => navigate('home')}
            onSecondary={() => navigate('parish')}
            accessMain={session ? <Dashboard copy={t} onNavigate={navigate} /> : null}
            accessPanel={
              <AccessPanel
                copy={t}
                mode={mode}
                onModeChange={setMode}
                loginId={loginId}
                onLoginIdChange={setLoginId}
                displayName={displayName}
                onDisplayNameChange={setDisplayName}
                password={password}
                onPasswordChange={setPassword}
                passwordConfirm={passwordConfirm}
                onPasswordConfirmChange={setPasswordConfirm}
                secureMode={secureMode}
                onSecureModeChange={setSecureMode}
                availability={availability}
                passwordHint={passwordHint}
                status={status}
                onSubmit={mode === 'login' ? handleLogin : handleRegister}
                onCheckSession={handleCheckSession}
                onToggleMode={handleToggleMode}
                onLogout={handleLogout}
                sessionInfo={sessionInfo}
              />
            }
          >
          </HomePage>
        )}

        {route === 'parish' && <ParishPage copy={t} onLogin={() => openLoginCard('parish')} />}
        {route === 'cogita' && <CogitaPage copy={t} onLogin={() => openLoginCard('cogita')} />}
        {route === 'faq' && <FaqPage copy={t} />}
        {route === 'legal' && <LegalPage copy={t} />}
        {route === 'account' && (
          <AccountPage copy={t} showLogin={!session ? () => openLoginCard('account') : undefined} />
        )}
      </main>

      <Footer copy={t} onNavigate={navigate} />

      <LoginCard
        copy={t}
        open={loginCardOpen}
        onClose={() => setLoginCardOpen(false)}
        context={loginCardContext}
        mode={mode}
        onModeChange={setMode}
        loginId={loginId}
        onLoginIdChange={setLoginId}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        password={password}
        onPasswordChange={setPassword}
        passwordConfirm={passwordConfirm}
        onPasswordConfirmChange={setPasswordConfirm}
        secureMode={secureMode}
        onSecureModeChange={setSecureMode}
        availability={availability}
        passwordHint={passwordHint}
        onSubmit={mode === 'login' ? handleLogin : handleRegister}
      />
    </div>
  );
}
