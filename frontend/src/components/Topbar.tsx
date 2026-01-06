import type { Copy } from '../content/types';
import type { RouteKey } from '../types/navigation';

export function Topbar({
  copy,
  onNavigate,
  onToggleLanguage,
  language,
  showAccountLabel
}: {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
  onToggleLanguage: () => void;
  language: 'pl' | 'en';
  showAccountLabel: boolean;
}) {
  return (
    <header className="topbar">
      <div
        className="brand"
        onClick={() => onNavigate('home')}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => event.key === 'Enter' && onNavigate('home')}
      >
        <img src="/logo_new.png" alt="ReCreatio" className="brand-logo" />
      </div>
      <nav className="nav">
        <button type="button" onClick={() => onNavigate('home')}>
          {copy.nav.home}
        </button>
        <button type="button" onClick={() => onNavigate('parish')}>
          {copy.nav.parish}
        </button>
        <button type="button" onClick={() => onNavigate('cogita')}>
          {copy.nav.cogita}
        </button>
        <button type="button" onClick={() => onNavigate('faq')}>
          {copy.nav.faq}
        </button>
        <button type="button" onClick={() => onNavigate('legal')}>
          {copy.nav.legal}
        </button>
      </nav>
      <div className="top-actions">
        <button type="button" className="ghost" onClick={onToggleLanguage}>
          {language === 'pl' ? 'EN' : 'PL'}
        </button>
        <button type="button" className="cta" onClick={() => onNavigate('home')}>
          {showAccountLabel ? copy.nav.account : copy.nav.login}
        </button>
      </div>
    </header>
  );
}
