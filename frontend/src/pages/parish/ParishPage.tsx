import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';

export function ParishPage({
  copy,
  onLogin,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onLogin: () => void;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  return (
    <div className="portal-page">
      <header className="portal-header">
        <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt={copy.loginCard.title} />
        </button>
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <button type="button" className="ghost portal-login" onClick={onLogin}>
          {copy.parish.loginCta}
        </button>
      </header>
      <main className="portal">
        <div className="portal-hero">
          <div>
            <p className="tag">{copy.nav.parish}</p>
            <h2>{copy.parish.title}</h2>
            <p className="lead">{copy.parish.subtitle}</p>
            <button type="button" className="cta portal-login" onClick={onLogin}>
              {copy.parish.loginCta}
            </button>
          </div>
          <div className="portal-card">
            <h3>{copy.parish.title}</h3>
            <ul>
              {copy.parish.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="note">{copy.parish.note}</p>
          </div>
        </div>
      </main>
      <footer className="portal-footer">
        <span>{copy.footer.headline}</span>
        <button type="button" className="ghost" onClick={onLogin}>
          {copy.parish.loginCta}
        </button>
      </footer>
    </div>
  );
}
