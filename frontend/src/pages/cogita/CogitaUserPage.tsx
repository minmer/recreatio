import { AuthAction } from '../../components/AuthAction';
import { LanguageSelect } from '../../components/LanguageSelect';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

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
        <section className="cogita-section cogita-user">
          <div className="cogita-user-panel">
            <p className="cogita-user-kicker">Cogita</p>
            <h1 className="cogita-user-title">{copy.cogita.title}</h1>
            <p className="cogita-user-subtitle">{copy.cogita.subtitle}</p>
            <ul className="cogita-user-list">
              {copy.cogita.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="cogita-user-note">{copy.cogita.note}</p>
            <button type="button" className="cta" onClick={() => onNavigate('account')}>
              {copy.nav.account}
            </button>
          </div>
        </section>
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
