import { useRef } from 'react';
import { AuthAction } from '../../components/AuthAction';
import { LanguageSelect } from '../../components/LanguageSelect';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaLibrarySection } from './library/components/CogitaLibrarySection';
import { CogitaUserOverview } from './library/components/CogitaUserOverview';
import { useIndexCardLibrary } from './library/useIndexCardLibrary';

export function CogitaUserPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  const overviewRef = useRef<HTMLElement | null>(null);
  const libraryRef = useRef<HTMLElement | null>(null);
  const library = useIndexCardLibrary();

  const openLibrary = () => {
    libraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const backToOverview = () => {
    overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="portal-page cogita">
      <header className="portal-header cogita-header">
        <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_inv.svg" alt={copy.loginCard.title} />
        </button>
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <AuthAction
          copy={copy}
          label={authLabel}
          isAuthenticated={showProfileMenu}
          secureMode={secureMode}
          onLogin={() => onNavigate('home')}
          onProfileNavigate={onProfileNavigate}
          onToggleSecureMode={onToggleSecureMode}
          onLogout={onLogout}
          variant="ghost"
        />
      </header>
      <main className="cogita-main">
        <CogitaUserOverview
          ref={overviewRef}
          copy={copy}
          totalCards={library.totalCards}
          totalTags={library.totalTags}
          onAccount={() => onNavigate('account')}
          onOpenLibrary={openLibrary}
        />
        <CogitaLibrarySection ref={libraryRef} library={library} onBackToOverview={backToOverview} />
      </main>
      <footer className="portal-footer cogita-footer">
        <span>{copy.footer.headline}</span>
        <AuthAction
          copy={copy}
          label={authLabel}
          isAuthenticated={showProfileMenu}
          secureMode={secureMode}
          onLogin={() => onNavigate('home')}
          onProfileNavigate={onProfileNavigate}
          onToggleSecureMode={onToggleSecureMode}
          onLogout={onLogout}
          variant="ghost"
        />
      </footer>
    </div>
  );
}
