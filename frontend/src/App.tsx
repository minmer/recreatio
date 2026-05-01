import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { checkAvailability } from './lib/api';
import { useAuth } from './lib/authContext';
import { checkPasswordStrength } from './lib/passwordPolicy';
import { copy } from './content';
import type { RouteKey, Mode } from './types/navigation';
import { LoginCard } from './components/LoginCard';
import { PersonCard } from './components/PersonCard';
import { PersonProvider } from './lib/personContext';
import { AuthPanel } from './components/AuthPanel';
import { FaqPage } from './pages/FaqPage';
import { LegalPage } from './pages/LegalPage';
import { HomePage } from './pages/HomePage';
const ParishPage = lazy(() => import('./pages/parish/ParishPage').then((module) => ({ default: module.ParishPage })));
const EventsPage = lazy(() => import('./pages/events/EventsPage').then((module) => ({ default: module.EventsPage })));
const CogitaPage = lazy(() => import('./pages/cogita/CogitaPage').then((module) => ({ default: module.CogitaPage })));
const CogitaDashboardPage = lazy(() =>
  import('./pages/cogita/CogitaDashboardPage').then((module) => ({ default: module.CogitaDashboardPage }))
);
const CogitaStoryboardRuntimePage = lazy(() =>
  import('./pages/cogita/CogitaStoryboardRuntimePage').then((module) => ({ default: module.CogitaStoryboardRuntimePage }))
);
const CogitaWritingRuntimePage = lazy(() =>
  import('./pages/cogita/CogitaWritingRuntimePage').then((module) => ({ default: module.CogitaWritingRuntimePage }))
);
const ChatPage = lazy(() => import('./pages/chat/ChatPage').then((module) => ({ default: module.ChatPage })));
const ChatPublicPage = lazy(() => import('./pages/chat/ChatPublicPage').then((module) => ({ default: module.ChatPublicPage })));
const ChatInvitePage = lazy(() => import('./pages/chat/ChatInvitePage').then((module) => ({ default: module.ChatInvitePage })));
const CalendarPage = lazy(() =>
  import('./pages/calendar/CalendarPage').then((module) => ({ default: module.CalendarPage }))
);
const CogitaWorkspacePage = lazy(() =>
  import('./pages/cogita/CogitaWorkspacePage').then((module) => ({ default: module.CogitaWorkspacePage }))
);
const CogitaRevisionSharedRuntimeEntryPage = lazy(() =>
  import('./pages/cogita/components/runtime/revision/RevisionRuntimeSharedEntry').then((module) => ({
    default: module.CogitaRevisionSharedRuntimeEntry
  }))
);
const CogitaLiveRevisionJoinPage = lazy(() =>
  import('./pages/cogita/live/CogitaLiveRevisionJoinPage').then((module) => ({ default: module.CogitaLiveRevisionJoinPage }))
);
const CogitaLiveLoginWallPage = lazy(() =>
  import('./pages/cogita/live/CogitaLiveLoginWallPage').then((module) => ({ default: module.CogitaLiveLoginWallPage }))
);
const CogitaLivePublicWallPage = lazy(() =>
  import('./pages/cogita/live/CogitaLivePublicWallPage').then((module) => ({ default: module.CogitaLivePublicWallPage }))
);
const CogitaLiveHostWallPage = lazy(() =>
  import('./pages/cogita/live/CogitaLiveHostWallPage').then((module) => ({ default: module.CogitaLiveHostWallPage }))
);
const CogitaLiveSessionsPage = lazy(() =>
  import('./pages/cogita/live/CogitaLiveSessionsPage').then((module) => ({ default: module.CogitaLiveSessionsPage }))
);
const CogitaGameJoinPage = lazy(() =>
  import('./pages/cogita/game/CogitaGameJoinPage').then((module) => ({ default: module.CogitaGameJoinPage }))
);
const CogitaGameHostPage = lazy(() =>
  import('./pages/cogita/game/CogitaGameHostPage').then((module) => ({ default: module.CogitaGameHostPage }))
);
const CogitaRevisionHomePage = lazy(() =>
  import('./pages/cogita/revision/CogitaRevisionHomePage').then((module) => ({ default: module.CogitaRevisionHomePage }))
);
const CogitaRevisionRunPage = lazy(() =>
  import('./pages/cogita/revision/CogitaRevisionRunPage').then((module) => ({ default: module.CogitaRevisionRunPage }))
);
const AccountPage = lazy(() => import('./pages/account/AccountPage').then((module) => ({ default: module.AccountPage })));

const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
const languages = ['pl', 'en', 'de'] as const;

type Language = (typeof languages)[number];

type PanelType = 'faq' | 'legal' | 'login' | null;

function decodeRouteSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCogitaLegacyPath(pathname: string, search: string): string | null {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (normalizedPath === '/cogita/core') {
    return `/cogita/revision${search ?? ''}`;
  }

  if (normalizedPath === '/cogita/persons') {
    return `/cogita/workspace/persons${search ?? ''}`;
  }

  if (normalizedPath === '/cogita/library') {
    return `/cogita/workspace${search ?? ''}`;
  }

  if (normalizedPath.startsWith('/cogita/library/')) {
    const tail = normalizedPath.slice('/cogita/library/'.length);
    return `/cogita/workspace/libraries/${tail}${search ?? ''}`;
  }

  if (normalizedPath === '/cogita/revision/shared-run') {
    return `/cogita/revision/shared${search ?? ''}`;
  }

  if (normalizedPath.startsWith('/cogita/revision/shared-run/')) {
    const tail = normalizedPath.slice('/cogita/revision/shared-run/'.length);
    return `/cogita/revision/shared/${tail}${search ?? ''}`;
  }

  if (normalizedPath.startsWith('/cogita/storyboard/shared/')) {
    const tail = normalizedPath.slice('/cogita/storyboard/shared/'.length);
    return `/cogita/public/storyboard/${tail}${search ?? ''}`;
  }

  if (normalizedPath.startsWith('/cogita/core/runs/')) {
    const segments = normalizedPath.split('/').filter(Boolean);
    const libraryId = segments[3];
    const runId = segments[4] ?? 'new';
    if (!libraryId) {
      return `/cogita/revision${search ?? ''}`;
    }
    return `/cogita/revision/solo/${libraryId}/${runId}${search ?? ''}`;
  }

  return null;
}

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
  const [rememberMe, setRememberMe] = useState(false);
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
  const pathSegments = pathname.split('/').filter(Boolean);
  const isHomePath = pathname === '/' || pathname.startsWith('/section-');
  const isCogitaPath = pathname.startsWith('/cogita');
  const isCogitaHomePath = pathname === '/cogita/home' || pathname === '/cogita/home/';
  const isCogitaStoryboardPublicPath = pathname.startsWith('/cogita/public/storyboard/') && pathSegments.length >= 4;
  const isCogitaStoryboardSessionPublicPath =
    pathname.startsWith('/cogita/public/storyboard-session/') && pathSegments.length >= 4;
  const isCogitaStoryboardSharedPath =
    (pathname.startsWith('/cogita/storyboard/shared/') && pathSegments.length >= 4) ||
    isCogitaStoryboardPublicPath;
  const isCogitaStoryboardPath =
    (pathname === '/cogita/storyboard' || pathname.startsWith('/cogita/storyboard/')) &&
    !isCogitaStoryboardSharedPath;
  const isCogitaStoryboardRuntimePath =
    pathname.startsWith('/cogita/runtime/storyboard/') && pathSegments.length >= 5;
  const isCogitaWritingPath = pathname === '/cogita/writing' || pathname.startsWith('/cogita/writing/');
  const isCogitaWorkspacePath = pathname === '/cogita/workspace' || pathname.startsWith('/cogita/workspace/');
  const isCogitaRevisionHomePath = pathname === '/cogita/revision' || pathname === '/cogita/revision/';
  const isCogitaRevisionSharedRuntimePath = pathname.startsWith('/cogita/revision/shared/') && pathSegments.length >= 5;
  const isCogitaRevisionRuntimePath =
    pathname.startsWith('/cogita/revision/solo/') ||
    pathname.startsWith('/cogita/revision/group-async/') ||
    pathname.startsWith('/cogita/revision/group-sync/') ||
    isCogitaRevisionSharedRuntimePath;
  const cogitaRevisionModeRaw = isCogitaRevisionRuntimePath ? pathSegments[2] : undefined;
  const cogitaRuntimeScope = cogitaRevisionModeRaw === 'group-async'
    ? 'group_async'
      : cogitaRevisionModeRaw === 'group-sync'
        ? 'group_sync'
      : cogitaRevisionModeRaw === 'shared' && isCogitaRevisionSharedRuntimePath
        ? 'shared'
      : cogitaRevisionModeRaw === 'solo'
        ? 'solo'
        : undefined;
  const cogitaRevisionRuntimeLibraryId = isCogitaRevisionRuntimePath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const cogitaRevisionRuntimeRunId = isCogitaRevisionRuntimePath
    ? decodeRouteSegment(pathSegments[4] ?? 'new')
    : undefined;
  const isEventsPath = pathname === '/event' || pathname.startsWith('/event/');
  const isLegacyLimanowaPath = pathname === '/limanowa' || pathname.startsWith('/limanowa/');
  const isChatPath = pathname === '/chat' || pathname.startsWith('/chat/');
  const isCalendarPath = pathname === '/calendar' || pathname.startsWith('/calendar/');
  const isChatPublicPath = pathname.startsWith('/chat/public/');
  const isChatInvitePath = pathname.startsWith('/chat/invite/');
  const isCogitaSharePath =
    pathname.startsWith('/cogita/public/revision') ||
    (pathname.startsWith('/cogita/revision/shared/') &&
      !isCogitaRevisionSharedRuntimePath);
  const isCogitaLiveJoinPath =
    pathname.startsWith('/cogita/public/live-revision/') ||
    pathname.startsWith('/cogita/live/join/');
  const isCogitaLiveWallLoginPath =
    pathname.startsWith('/cogita/live-wall/login/') ||
    pathname.startsWith('/cogita/live/wall/login/');
  const isCogitaLiveWallPublicPath =
    pathname.startsWith('/cogita/live-wall/public/') ||
    pathname.startsWith('/cogita/live/wall/public/') ||
    pathname.startsWith('/cogita/live/wall/participant/') ||
    pathname.startsWith('/cogita/live/wall/output/');
  const isCogitaLiveWallHostPath =
    pathname.startsWith('/cogita/live-wall/host/') ||
    pathname.startsWith('/cogita/live/wall/host/');
  const isCogitaLiveSessionsPath =
    pathname.startsWith('/cogita/live-sessions/') ||
    pathname.startsWith('/cogita/live/sessions/');
  const isCogitaGameJoinPath = pathname.startsWith('/cogita/game/join/') && pathSegments.length >= 4;
  const isCogitaGameHostPath = pathname.startsWith('/cogita/game/host/') && pathSegments.length >= 5;
  const chatPublicCode = isChatPublicPath ? decodeRouteSegment(pathSegments[2]) : undefined;
  const chatInviteCode = isChatInvitePath ? decodeRouteSegment(pathSegments[2]) : undefined;
  const cogitaStoryboardLibraryId = isCogitaStoryboardPath ? decodeRouteSegment(pathSegments[2]) : undefined;
  const cogitaStoryboardId = isCogitaStoryboardPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const cogitaStoryboardRuntimeLibraryId = isCogitaStoryboardRuntimePath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const cogitaStoryboardRuntimeId = isCogitaStoryboardRuntimePath ? decodeRouteSegment(pathSegments[4]) : undefined;
  const cogitaStoryboardShareCode = isCogitaStoryboardSharedPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const cogitaStoryboardSessionCode = isCogitaStoryboardSessionPublicPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const cogitaWritingLibraryId = isCogitaWritingPath ? decodeRouteSegment(pathSegments[2]) : undefined;
  const cogitaWritingProjectId = isCogitaWritingPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const shareId = isCogitaSharePath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const liveJoinCode = isCogitaLiveJoinPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const liveWallLoginCode = isCogitaLiveWallLoginPath
    ? decodeRouteSegment(pathSegments[pathSegments[1] === 'live-wall' ? 3 : 4])
    : undefined;
  const liveWallPublicCode = isCogitaLiveWallPublicPath
    ? decodeRouteSegment(pathSegments[pathSegments[1] === 'live-wall' ? 3 : 4])
    : undefined;
  const liveWallHostLibraryId = isCogitaLiveWallHostPath
    ? decodeRouteSegment(pathSegments[pathSegments[1] === 'live-wall' ? 3 : 4])
    : undefined;
  const liveWallHostRevisionId = isCogitaLiveWallHostPath
    ? decodeRouteSegment(pathSegments[pathSegments[1] === 'live-wall' ? 4 : 5])
    : undefined;
  const liveWallParams = useMemo(() => {
    const search = location.search ?? '';
    if (search.startsWith('?') && search.length > 1) {
      return new URLSearchParams(search);
    }
    if (typeof window !== 'undefined') {
      const hash = window.location.hash ?? '';
      const queryIndex = hash.indexOf('?');
      if (queryIndex >= 0) {
        return new URLSearchParams(hash.slice(queryIndex + 1));
      }
    }
    return new URLSearchParams();
  }, [location.search]);
  const liveWallSessionId = liveWallParams.get('sessionId') ?? undefined;
  const liveWallHostSecret = liveWallParams.get('hostSecret') ?? undefined;
  const liveSessionsLibraryId = isCogitaLiveSessionsPath
    ? decodeRouteSegment(pathSegments[pathSegments[1] === 'live-sessions' ? 2 : 3])
    : undefined;
  const gameJoinCode = isCogitaGameJoinPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const gameHostLibraryId = isCogitaGameHostPath ? decodeRouteSegment(pathSegments[3]) : undefined;
  const gameHostSessionId = isCogitaGameHostPath ? decodeRouteSegment(pathSegments[4]) : undefined;
  const gameHostParams = useMemo(() => {
    const search = location.search ?? '';
    if (search.startsWith('?') && search.length > 1) {
      return new URLSearchParams(search);
    }
    if (typeof window !== 'undefined') {
      const hash = window.location.hash ?? '';
      const queryIndex = hash.indexOf('?');
      if (queryIndex >= 0) {
        return new URLSearchParams(hash.slice(queryIndex + 1));
      }
    }
    return new URLSearchParams();
  }, [location.search]);
  const gameHostSecret = gameHostParams.get('hostSecret') ?? undefined;
  const gameHostCode = gameHostParams.get('code') ?? undefined;
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
      else if (next === 'events') navigate('/event');
      else if (next === 'limanowa') navigate('/event/limanowa/start');
      else if (next === 'cogita') navigate('/cogita');
      else if (next === 'chat') navigate('/chat');
      else if (next === 'calendar') navigate('/calendar');
      else if (next === 'faq') navigate('/faq');
      else if (next === 'legal') navigate('/legal');
      else if (next === 'login') navigate('/login');
      else if (next === 'account') navigate('/account');
      else navigate(lastHomePathRef.current || '/section-1');
    };
  }, [navigate]);

  useEffect(() => {
    const normalized = normalizeCogitaLegacyPath(pathname, location.search ?? '');
    if (normalized && normalized !== `${pathname}${location.search ?? ''}`) {
      navigate(normalized, { replace: true });
    }
  }, [location.search, navigate, pathname]);

  useEffect(() => {
    if (!isLegacyLimanowaPath) {
      return;
    }
    navigate('/event/limanowa/start', { replace: true });
  }, [isLegacyLimanowaPath, navigate]);

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    const meta = document.getElementById('app-content-language');
    if (meta) {
      meta.setAttribute('content', language);
    }
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
        rememberMe,
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
  const lazyFallback = <div className="note">{t.access.loadingLogin}</div>;

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
    <PersonProvider>
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
        <Suspense fallback={lazyFallback}>
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
            isAuthenticated={isAuthenticated}
            secureMode={secureMode}
            onProfileNavigate={() => handleProtectedNavigation('account', 'parish')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            parishSlug={pathname.startsWith('/parish/') ? pathname.split('/')[2] : undefined}
          />
        </Suspense>
      )}
      {isEventsPath && (
        <Suspense fallback={lazyFallback}>
          <EventsPage
            copy={t}
            onAuthAction={() => {
              if (isAuthenticated) {
                handleProtectedNavigation('account', 'events');
              } else {
                openLoginCard('events');
              }
            }}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'events')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
          />
        </Suspense>
      )}
      {isChatInvitePath && chatInviteCode ? (
        <Suspense fallback={lazyFallback}>
          <ChatInvitePage
            copy={t}
            code={chatInviteCode}
            onAuthAction={() => {
              if (isAuthenticated) {
                handleProtectedNavigation('account', 'chat');
              } else {
                openLoginCard('chat');
              }
            }}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'chat')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
          />
        </Suspense>
      ) : isChatPublicPath && chatPublicCode ? (
        <Suspense fallback={lazyFallback}>
          <ChatPublicPage
            copy={t}
            code={chatPublicCode}
            onAuthAction={() => {
              if (isAuthenticated) {
                handleProtectedNavigation('account', 'chat');
              } else {
                openLoginCard('chat');
              }
            }}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'chat')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
          />
        </Suspense>
      ) : isChatPath ? (
        <Suspense fallback={lazyFallback}>
          <ChatPage
            copy={t}
            onAuthAction={() => {
              if (isAuthenticated) {
                handleProtectedNavigation('account', 'chat');
              } else {
                openLoginCard('chat');
              }
            }}
            authLabel={isAuthenticated ? t.nav.account : t.chat.loginCta}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'chat')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
          />
        </Suspense>
      ) : null}
      {isCalendarPath && (
        <Suspense fallback={lazyFallback}>
          <CalendarPage
            copy={t}
            onAuthAction={() => {
              if (isAuthenticated) {
                handleProtectedNavigation('account', 'calendar');
              } else {
                openLoginCard('calendar');
              }
            }}
            authLabel={isAuthenticated ? t.nav.account : t.calendar.loginCta}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'calendar')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
          />
        </Suspense>
      )}
      {isCogitaLiveWallLoginPath && liveWallLoginCode ? (
        <Suspense fallback={lazyFallback}>
          <CogitaLiveLoginWallPage
            copy={t}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            code={liveWallLoginCode}
          />
        </Suspense>
      ) : isCogitaLiveWallPublicPath && liveWallPublicCode ? (
        <Suspense fallback={lazyFallback}>
          <CogitaLivePublicWallPage
            copy={t}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            code={liveWallPublicCode}
          />
        </Suspense>
      ) : isCogitaLiveWallHostPath && liveWallHostLibraryId && liveWallHostRevisionId && liveWallSessionId && liveWallHostSecret ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaLiveHostWallPage
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
              libraryId={liveWallHostLibraryId}
              revisionId={liveWallHostRevisionId}
              sessionId={liveWallSessionId}
              hostSecret={liveWallHostSecret}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaLiveJoinPath && liveJoinCode ? (
        <Suspense fallback={lazyFallback}>
          <CogitaLiveRevisionJoinPage
            copy={t}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            code={liveJoinCode}
          />
        </Suspense>
      ) : isCogitaGameJoinPath && gameJoinCode ? (
        <Suspense fallback={lazyFallback}>
          <CogitaGameJoinPage
            copy={t}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            code={gameJoinCode}
          />
        </Suspense>
      ) : isCogitaGameHostPath && gameHostLibraryId && gameHostSessionId && gameHostSecret ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaGameHostPage
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
              libraryId={gameHostLibraryId}
              sessionId={gameHostSessionId}
              hostSecret={gameHostSecret}
              code={gameHostCode}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaLiveSessionsPath && liveSessionsLibraryId ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaLiveSessionsPage
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
              libraryId={liveSessionsLibraryId}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaRevisionRuntimePath && cogitaRevisionRuntimeLibraryId && cogitaRevisionRuntimeRunId ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaRevisionRunPage
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
              libraryId={cogitaRevisionRuntimeLibraryId}
              runId={cogitaRevisionRuntimeRunId}
              runScopeHint={cogitaRuntimeScope}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaRevisionHomePath ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaRevisionHomePage
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
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaSharePath && shareId ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaRevisionSharedRuntimeEntryPage
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
              shareId={shareId}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaStoryboardSessionPublicPath && cogitaStoryboardSessionCode ? (
        <Suspense fallback={lazyFallback}>
          <CogitaStoryboardRuntimePage
            copy={t}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            sessionCode={cogitaStoryboardSessionCode}
          />
        </Suspense>
      ) : isCogitaStoryboardSharedPath && cogitaStoryboardShareCode ? (
        <Suspense fallback={lazyFallback}>
          <CogitaStoryboardRuntimePage
            copy={t}
            authLabel={isAuthenticated ? t.nav.account : t.nav.login}
            showProfileMenu={isAuthenticated}
            onProfileNavigate={() => handleProtectedNavigation('account', 'cogita')}
            onToggleSecureMode={handleToggleMode}
            onLogout={handleLogout}
            secureMode={secureMode}
            onNavigate={navigateRoute}
            language={language}
            onLanguageChange={setLanguage}
            shareCode={cogitaStoryboardShareCode}
          />
        </Suspense>
      ) : isCogitaStoryboardRuntimePath ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaStoryboardRuntimePage
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
              libraryId={cogitaStoryboardRuntimeLibraryId}
              storyboardId={cogitaStoryboardRuntimeId}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaStoryboardPath ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaStoryboardRuntimePage
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
              libraryId={cogitaStoryboardLibraryId}
              storyboardId={cogitaStoryboardId}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaWritingPath ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaWritingRuntimePage
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
              libraryId={cogitaWritingLibraryId}
              projectId={cogitaWritingProjectId}
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : isCogitaWorkspacePath ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaWorkspacePage
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
            />
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
          )}
        </Suspense>
      ) : isCogitaHomePath || pathname === '/cogita' || pathname === '/cogita/' ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaDashboardPage
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
            />
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
          )}
        </Suspense>
      ) : isCogitaPath ? (
        <Suspense fallback={lazyFallback}>
          {isAuthenticated ? (
            <CogitaDashboardPage
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
            />
          ) : (
            <CogitaPage
              copy={t}
              onAuthAction={() => openLoginCard('cogita')}
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
          )}
        </Suspense>
      ) : null}
      {pathname === '/account' && session && (
        <Suspense fallback={lazyFallback}>
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
        </Suspense>
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
                  rememberMe={rememberMe}
                  onRememberMeChange={setRememberMe}
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

      <PersonCard />
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
        rememberMe={rememberMe}
        onRememberMeChange={setRememberMe}
        availability={availability}
        passwordHint={passwordHint}
        status={status}
        onSubmit={mode === 'login' ? handleLogin : handleRegister}
      />
    </div>
    </PersonProvider>
  );
}
