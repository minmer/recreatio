import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LanguageSelect } from '../../components/LanguageSelect';
import type { LibraryCopyStrings } from './libraryCopy';

type NavItem = { path: string; label: string };

export function LibraryShell({
  t,
  language,
  onLanguageChange,
  onExit,
  children
}: {
  t: LibraryCopyStrings;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  onExit: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items: NavItem[] = [
    { path: '/library', label: t.nav.dashboard },
    { path: '/library/quotes', label: t.nav.quotes },
    { path: '/library/works', label: t.nav.works },
    { path: '/library/shelf', label: t.nav.shelf },
    { path: '/library/arrangement', label: t.nav.arrangement },
    { path: '/library/people', label: t.nav.people },
    { path: '/library/publishers', label: t.nav.publishers },
    { path: '/library/shelves', label: t.nav.shelves },
    { path: '/library/groups', label: t.nav.groups },
    { path: '/library/tags', label: t.nav.tags },
    { path: '/library/loans', label: t.nav.loans },
    { path: '/library/reading', label: t.nav.reading },
    { path: '/library/data', label: t.nav.data }
  ];

  // The dashboard only lights up on an exact match; every other tab also owns
  // its detail routes (/library/works/12 keeps "Works" active).
  const isActive = (path: string) =>
    path === '/library' ? pathname === '/library' || pathname === '/library/' : pathname.startsWith(path);

  return (
    <div className="lib-page">
      <header className="lib-header">
        <button type="button" className="lib-brand" onClick={() => navigate('/library')}>
          <span className="lib-brand-name">{t.brand}</span>
          <span className="lib-brand-tagline">{t.tagline}</span>
        </button>
        <nav className="lib-nav">
          {items.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`lib-nav-link${isActive(item.path) ? ' is-active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="lib-header-actions">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={onExit}>
            {t.nav.back}
          </button>
        </div>
      </header>
      <main className="lib-main">{children}</main>
    </div>
  );
}
