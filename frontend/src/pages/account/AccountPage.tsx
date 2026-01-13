import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';

export function AccountPage({
  copy,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  return (
    <div className="portal-page account-page">
      <header className="portal-header">
        <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt={copy.loginCard.title} />
        </button>
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <button type="button" className="ghost" onClick={() => onNavigate('home')}>
          {copy.nav.home}
        </button>
      </header>
      <main className="account-main">
        <div className="account-shell">
          <section className="account-intro">
            <p className="tag">{copy.nav.account}</p>
            <h2>{copy.account.title}</h2>
            <p className="lead">{copy.account.subtitle}</p>
          </section>
          <section className="account-card">
            <h3>{copy.account.title}</h3>
            <p>{copy.account.placeholder}</p>
            <div className="account-skeleton" aria-hidden="true">
              <span className="account-skeleton-line" />
              <span className="account-skeleton-line" />
              <span className="account-skeleton-line short" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
