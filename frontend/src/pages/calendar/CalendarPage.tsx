import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';

export function CalendarPage({
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
  if (!showProfileMenu) {
    return (
      <div className="calendar-page calendar-page-guest">
        <header className="calendar-header">
          <a href="/#/section-1" className="calendar-brand" onClick={() => onNavigate('home')}>
            REcreatio
          </a>
          <div className="calendar-header-actions">
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
        <main className="calendar-guest-main">
          <h1>{copy.calendar.title}</h1>
          <p>{copy.calendar.subtitle}</p>
          <button type="button" className="cta" onClick={onAuthAction}>
            {copy.calendar.loginCta}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <a href="/#/section-1" className="calendar-brand" onClick={() => onNavigate('home')}>
          REcreatio
        </a>
        <nav className="calendar-top-nav">
          <a href="/#/parish">{copy.nav.parish}</a>
          <a href="/#/event">{copy.nav.events}</a>
          <a href="/#/cogita">{copy.nav.cogita}</a>
          <a href="/#/chat">{copy.nav.chat}</a>
        </nav>
        <div className="calendar-header-actions">
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

      <main className="calendar-main">
        <aside className="calendar-panel">
          <h1>{copy.calendar.title}</h1>
          <p>{copy.calendar.subtitle}</p>
          <h2>{copy.calendar.roadmapTitle}</h2>
          <ul>
            {copy.calendar.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>

        <section className="calendar-chat">
          <article className="calendar-chat-message">
            <h2>{copy.calendar.examplesTitle}</h2>
            <ul>
              {copy.calendar.examples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="calendar-chat-message calendar-chat-note">
            <p>{copy.calendar.note}</p>
          </article>
        </section>
      </main>
    </div>
  );
}
