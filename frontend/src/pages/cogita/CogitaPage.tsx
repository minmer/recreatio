import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';

export function CogitaPage({
  copy,
  onAuthAction,
  authLabel,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  return (
    <div className="portal-page cogita">
      <header className="portal-header">
        <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt={copy.loginCard.title} />
        </button>
        <LanguageSelect value={language} onChange={onLanguageChange} />
        <button type="button" className="ghost portal-login" onClick={onAuthAction}>
          {authLabel}
        </button>
      </header>
      <main className="portal">
        <div className="portal-hero">
          <div>
            <p className="tag">{copy.nav.cogita}</p>
            <h2>{copy.cogita.title}</h2>
            <p className="lead">{copy.cogita.subtitle}</p>
            <button type="button" className="cta portal-login" onClick={onAuthAction}>
              {authLabel}
            </button>
          </div>
          <div className="portal-card">
            <h3>{copy.cogita.title}</h3>
            <ul>
              {copy.cogita.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="note">{copy.cogita.note}</p>
          </div>
        </div>
      </main>
      <footer className="portal-footer">
        <span>{copy.footer.headline}</span>
        <button type="button" className="ghost" onClick={onAuthAction}>
          {authLabel}
        </button>
      </footer>
    </div>
  );
}
