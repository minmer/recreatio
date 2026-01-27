import type { ReactNode } from 'react';
import { AuthAction } from '../../components/AuthAction';
import { LanguageSelect } from '../../components/LanguageSelect';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

export function CogitaShell({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  children
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
  children: ReactNode;
}) {
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    onNavigate('home');
  };

  return (
    <div className="portal-page cogita">
      <header className="portal-header cogita-header">
        <div className="portal-header-left">
          <button type="button" className="ghost portal-back" onClick={handleBack}>
            Back
          </button>
          <button type="button" className="portal-brand" onClick={() => onNavigate('cogita')}>
            <img src="/cogita_plain.svg" alt="Cogita" />
          </button>
        </div>
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
      <main className="cogita-main">{children}</main>
      <footer className="portal-footer cogita-footer">
        <button type="button" className="portal-brand portal-footer-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt="Recreatio" />
        </button>
        <span>{copy.footer.headline}</span>
      </footer>
    </div>
  );
}
