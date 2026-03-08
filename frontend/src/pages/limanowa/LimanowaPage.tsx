import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import '../../styles/limanowa.css';

export function LimanowaPage({
  copy,
  onAuthAction,
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
  onAuthAction: () => void;
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
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    onNavigate('home');
  };

  return (
    <div className="portal-page limanowa-page">
      <header className="portal-header limanowa-header">
        <div className="portal-header-left">
          <button type="button" className="ghost portal-back" onClick={handleBack}>
            {copy.nav.home}
          </button>
          <a className="ghost limanowa-up" href="/#/limanowa">
            {copy.nav.limanowa}
          </a>
          <a className="portal-brand limanowa-brand" href="/#/limanowa">
            <img src="/logo_new.svg" alt={copy.limanowa.title} />
          </a>
        </div>
        <div className="limanowa-header-actions">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <AuthAction
            copy={copy}
            label={authLabel}
            isAuthenticated={showProfileMenu}
            secureMode={secureMode}
            onLogin={onAuthAction}
            onProfileNavigate={onProfileNavigate}
            onToggleSecureMode={onToggleSecureMode}
            onLogout={onLogout}
            variant="ghost"
          />
        </div>
      </header>

      <main className="limanowa-main">
        <section className="limanowa-hero">
          <p className="tag">REcreatio</p>
          <h1>{copy.limanowa.title}</h1>
          <p>{copy.limanowa.subtitle}</p>
        </section>

        <section className="limanowa-build-card">
          <h2>{copy.limanowa.inBuildTitle}</h2>
          <p>{copy.limanowa.inBuildText}</p>
        </section>
      </main>

      <footer className="portal-footer limanowa-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_new.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
      </footer>
    </div>
  );
}
