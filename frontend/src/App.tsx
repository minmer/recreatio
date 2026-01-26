import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { checkAvailability } from './lib/api';
import { useAuth } from './lib/authContext';
import { checkPasswordStrength } from './lib/passwordPolicy';
import { copy } from './content';
import type { RouteKey, Mode } from './types/navigation';
import { LoginCard } from './components/LoginCard';
import { AuthPanel } from './components/AuthPanel';
import { FaqPage } from './pages/FaqPage';
import { LegalPage } from './pages/LegalPage';
import { HomePage } from './pages/HomePage';
import { ParishPage } from './pages/parish/ParishPage';
import { CogitaPage } from './pages/cogita/CogitaPage';
import { CogitaUserPage } from './pages/cogita/CogitaUserPage';
import { CogitaLibraryOverviewPage } from './pages/cogita/library/CogitaLibraryOverviewPage';
import { CogitaLibraryListPage } from './pages/cogita/library/CogitaLibraryListPage';
import { CogitaLibraryAddPage } from './pages/cogita/library/CogitaLibraryAddPage';
import type { CogitaLibraryMode } from './pages/cogita/library/types';
import { AccountPage } from './pages/account/AccountPage';

const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
const languages = ['pl', 'en', 'de'] as const;

type Language = (typeof languages)[number];

type PanelType = 'faq' | 'legal' | 'login' | null;

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [language, setLanguage] = useState<Language>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('recreatio.lang') : null;
    if (stored === 'en' || stored === 'de') return stored;
    return 'pl';
  });
  const navigate = useNavigate();
  const location = useLocation();
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
  const lastHomePathRef = useRef('/section-1');
  const panelTouchRef = useRef<number | null>(null);
  const isAuthenticated = Boolean(session);
  const protectedRoutes = useMemo(() => new Set<RouteKey>(['account']), []);
  const protectedPathMap = useMemo(() => new Map<string, RouteKey>([['/account', 'account']]), []);

  const pathname = location.pathname;
  const isHomePath = pathname === '/' || pathname.startsWith('/section-');
  const isCogitaPath = pathname.startsWith('/cogita');
  const isCogitaLibraryPath = pathname.startsWith('/cogita/library');
  const cogitaSegments = pathname.split('/').filter(Boolean);
  const cogitaLibraryId = cogitaSegments[1] === 'library' ? cogitaSegments[2] : undefined;
  const libraryModeSegment = cogitaSegments[3];
  const libraryMode: CogitaLibraryMode =
    libraryModeSegment === 'collection' || libraryModeSegment === 'list' || libraryModeSegment === 'detail'
      ? libraryModeSegment
      : 'detail';
  const libraryView =
    libraryModeSegment === 'new' || libraryModeSegment === 'add'
      ? 'add'
      : libraryModeSegment === 'list' || libraryModeSegment === 'collection' || libraryModeSegment === 'detail'
        ? 'list'
        : 'overview';
  const sectionFromPath = isHomePath && pathname !== '/' ? pathname.slice(1) : 'section-1';
  const panel: PanelType =
    pathname === '/faq' || pathname === '/legal' || pathname === '/login'
      ? (pathname.slice(1) as PanelType)
      : null;
  const [panelState, setPanelState] = useState<'closed' | 'opening' | 'open' | 'closing'>(() =>
    panel ? 'open' : 'closed'
  );

  const navigateRoute = useMemo(() => {
    return (next: RouteKey) => {
      if (next === 'parish') navigate('/parish');
      else if (next === 'cogita') navigate('/cogita');
      else if (next === 'faq') navigate('/faq');
      else if (next === 'legal') navigate('/legal');
      else if (next === 'login') navigate('/login');
      else if (next === 'account') navigate('/account');
      else navigate(lastHomePathRef.current || '/section-1');
    };
  }, [navigate]);

  useEffect(() => {
    if (!password) {
      setPasswordHint(null);
      return;
    }

    const check = checkPasswordStrength(password, {
      tooShort: t.access.passwordTooShort,
      common: t.access.passwordCommon,
      weak: t.access.passwordWeak,
      strong: t.access.passwordStrong
    });
    setPasswordHint(check.message);
  }, [password, t.access.passwordCommon, t.access.passwordStrong, t.access.passwordTooShort, t.access.passwordWeak]);

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
  }, [loginId, mode, t.access.loginId, t.access.loginTaken]);

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

  const closeLoginCard = () => {
    setLoginCardOpen(false);
    if (protectedPathMap.has(pathname) && !session) {
      navigate(lastHomePathRef.current || '/section-1');
    }
  };

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    resetStatus();

    try {
      if (!loginId || !password) {
        setStatus({ type: 'error', message: t.access.loginRequired });
        return;
      }

      const strength = checkPasswordStrength(password, {
        tooShort: t.access.passwordTooShort,
        common: t.access.passwordCommon,
        weak: t.access.passwordWeak,
        strong: t.access.passwordStrong
      });
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

      setStatus({ type: 'success', message: t.access.statusReady });
      setMode('login');
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'Login ID is already in use.'
          ? t.access.loginTaken
          : t.access.registerError;
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
      setStatus({ type: 'success', message: t.access.statusReady });
      setLoginCardOpen(false);
      if (pathname === '/login') {
        closePanel();
      }
    } catch (error) {
      setStatus({ type: 'error', message: t.access.loginError });
    }
  }

  async function handleLogout() {
    resetStatus();
    await logout();
    const protectedRoute = protectedPathMap.get(pathname);
    if (protectedRoute) {
      openLoginCard(protectedRoute);
      navigate(lastHomePathRef.current || '/section-1');
    }
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

  useEffect(() => {
    if (isHomePath) {
      lastHomePathRef.current = pathname === '/' ? '/section-1' : pathname;
    }
  }, [isHomePath, pathname]);

  useEffect(() => {
    const requiredRoute = protectedPathMap.get(pathname);
    if (requiredRoute && !session) {
      openLoginCard(requiredRoute);
    }
  }, [pathname, session, protectedPathMap]);

  useEffect(() => {
    const requiredRoute = protectedPathMap.get(pathname);
    if (requiredRoute && session && loginCardOpen && loginCardContext === requiredRoute) {
      setLoginCardOpen(false);
    }
  }, [loginCardContext, loginCardOpen, pathname, protectedPathMap, session]);

  const homeAuthLabel = isAuthenticated ? t.nav.account : t.nav.login;
  const homeHeroLabel = isAuthenticated ? t.nav.account : t.hero.ctaPrimary;
  const handleProtectedNavigation = (route: RouteKey, context: RouteKey) => {
    if (protectedRoutes.has(route) && !session) {
      openLoginCard(context);
      return;
    }
    navigateRoute(route);
  };

  const openPanel = (next: PanelType) => {
    if (!next) return;
    lastHomePathRef.current = isHomePath ? (pathname === '/' ? '/section-1' : pathname) : '/section-1';
    navigate(`/${next}`);
    setPanelState('opening');
  };

  const closePanel = () => {
    if (!panel) return;
    setPanelState('closing');
    window.setTimeout(() => {
      navigate(lastHomePathRef.current || '/section-1');
      setPanelState('closed');
    }, 220);
  };

  useEffect(() => {
    if (panel && panelState === 'opening') {
      const raf = window.requestAnimationFrame(() => setPanelState('open'));
      return () => window.cancelAnimationFrame(raf);
    }
    if (panel && panelState === 'closed') {
      setPanelState('opening');
    }
    if (!panel && panelState !== 'closed') {
      setPanelState('closed');
    }
  }, [panel, panelState]);

  const showHome = isHomePath || panel !== null;

  return (
    <div className={`app ${panel ? 'panel-open' : ''}`}>
      {showHome && (
        <HomePage
          copy={t}
          language={language}
          onLanguageChange={setLanguage}
          onNavigate={navigateRoute}
          onOpenPanel={openPanel}
          onAuthAction={() => {
            if (isAuthenticated) {
              handleProtectedNavigation('account', 'account');
            } else {
              openPanel('login');
            }
          }}
          authLabel={homeAuthLabel}
          authCtaLabel={homeHeroLabel}
          showProfileMenu={isAuthenticated}
          onProfileNavigate={() => handleProtectedNavigation('account', 'account')}
          onToggleSecureMode={handleToggleMode}
          onLogout={handleLogout}
          secureMode={secureMode}
          panelOpen={panel !== null}
          activeSectionId={sectionFromPath}
          onSectionChange={(nextSection) => {
            if (!isHomePath) return;
            const nextPath = `/${nextSection}`;
            if (pathname !== nextPath) {
              navigate(nextPath, { replace: true });
              lastHomePathRef.current = nextPath;
            }
          }}
        />
      )}

      {pathname.startsWith('/parish') && (
        <ParishPage
          copy={t}
          onAuthAction={() => {
            if (isAuthenticated) {
              handleProtectedNavigation('account', 'parish');
            } else {
              openLoginCard('parish');
            }
          }}
          authLabel={isAuthenticated ? t.nav.account : t.parish.loginCta}
          onNavigate={navigateRoute}
          language={language}
          onLanguageChange={setLanguage}
          parishSlug={pathname.startsWith('/parish/') ? pathname.split('/')[2] : undefined}
        />
      )}
      {isCogitaPath &&
        (isAuthenticated ? (
          isCogitaLibraryPath && cogitaLibraryId ? (
            libraryView === 'add' ? (
              <CogitaLibraryAddPage
                copy={t}
                authLabel={t.nav.account}
                showProfileMenu
                onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
                onToggleSecureMode={handleToggleMode}
                onLogout={handleLogout}
                secureMode={secureMode}
                onNavigate={navigateRoute}
                language={language}
                onLanguageChange={setLanguage}
                libraryId={cogitaLibraryId}
                onBackToOverview={() => navigate(`/cogita/library/${cogitaLibraryId}`)}
                onBackToList={() => navigate(`/cogita/library/${cogitaLibraryId}/list`)}
                onBackToCogita={() => navigate('/cogita')}
              />
            ) : libraryView === 'list' ? (
              <CogitaLibraryListPage
                copy={t}
                authLabel={t.nav.account}
                showProfileMenu
                onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
                onToggleSecureMode={handleToggleMode}
                onLogout={handleLogout}
                secureMode={secureMode}
                onNavigate={navigateRoute}
                language={language}
                onLanguageChange={setLanguage}
                libraryId={cogitaLibraryId}
                mode={libraryMode}
                onModeChange={(nextMode) => {
                  navigate(`/cogita/library/${cogitaLibraryId}/${nextMode}`);
                }}
                onBackToOverview={() => navigate(`/cogita/library/${cogitaLibraryId}`)}
                onBackToCogita={() => navigate('/cogita')}
                onOpenAdd={() => navigate(`/cogita/library/${cogitaLibraryId}/new`)}
              />
            ) : (
              <CogitaLibraryOverviewPage
                copy={t}
                authLabel={t.nav.account}
                showProfileMenu
                onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
                onToggleSecureMode={handleToggleMode}
                onLogout={handleLogout}
                secureMode={secureMode}
                onNavigate={navigateRoute}
                language={language}
                onLanguageChange={setLanguage}
                libraryId={cogitaLibraryId}
                onBackToCogita={() => navigate('/cogita')}
                onOpenList={() => navigate(`/cogita/library/${cogitaLibraryId}/list`)}
                onOpenAdd={() => navigate(`/cogita/library/${cogitaLibraryId}/new`)}
              />
            )
          ) : (
            <CogitaUserPage
              copy={t}
              authLabel={t.nav.account}
              showProfileMenu
              onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
              onToggleSecureMode={handleToggleMode}
              onLogout={handleLogout}
              secureMode={secureMode}
              onNavigate={navigateRoute}
              language={language}
              onLanguageChange={setLanguage}
              onOpenLibrary={(libraryId) => navigate(`/cogita/library/${libraryId}`)}
            />
          )
        ) : (
          <CogitaPage
            copy={t}
            onAuthAction={() => {
              if (isAuthenticated) {
                handleProtectedNavigation('account', 'cogita');
              } else {
                openLoginCard('cogita');
              }
            }}
            authLabel={isAuthenticated ? t.nav.account : t.cogita.loginCta}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
          />
        ))}
      {pathname === '/account' && session && (
        <AccountPage
          copy={t}
          onNavigate={navigateRoute}
          language={language}
          onLanguageChange={setLanguage}
          loginId={loginId}
          onLoginIdChange={setLoginId}
          secureMode={secureMode}
          onToggleSecureMode={handleToggleMode}
          onLogout={handleLogout}
        />
      )}

      {panelState !== 'closed' && (
        <div
          className={`panel-overlay ${panelState === 'open' ? 'is-open' : ''} ${
            panelState === 'closing' ? 'is-closing' : ''
          }`}
        >
          <button type="button" className="panel-scrim" onClick={closePanel} aria-label={t.nav.home} />
          <div
            className={`side-panel side-panel-${panel}`}
            onTouchStart={(event) => {
              panelTouchRef.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = panelTouchRef.current;
              const end = event.changedTouches[0]?.clientX ?? null;
              if (start === null || end === null) return;
              if (end - start > 80) closePanel();
              panelTouchRef.current = null;
            }}
          >
            <div className="panel-handle">
              <button type="button" className="ghost" onClick={closePanel}>
                {t.nav.home}
              </button>
            </div>
            <div className="panel-content">
              {panel === 'faq' && <FaqPage copy={t} />}
              {panel === 'legal' && <LegalPage copy={t} />}
              {panel === 'login' && (
                <AuthPanel
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
                  showSessionActions={Boolean(session)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <LoginCard
        copy={t}
        open={loginCardOpen}
        onClose={closeLoginCard}
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
        status={status}
        onSubmit={mode === 'login' ? handleLogin : handleRegister}
      />
    </div>
  );
}
