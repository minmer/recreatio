import { useEffect, useMemo, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';

export function CogitaPage({
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
  const navItems = useMemo(() => copy.cogita.page.nav, [copy.cogita.page.nav]);
  const [activeSection, setActiveSection] = useState(navItems[0]?.id ?? 'home');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(`cogita-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.cogita-section'));
    if (!sections.length) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) {
          return;
        }
        const best = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const nextId = best.target.getAttribute('data-section');
        if (nextId) {
          setActiveSection((current) => (current === nextId ? current : nextId));
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.2, 0.5, 0.75] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const joinActions = [
    onAuthAction,
    () => scrollToSection('library'),
    () => onNavigate('legal')
  ];

  return (
    <div className="portal-page cogita">
      <header className="portal-header">
        <button type="button" className="portal-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt={copy.loginCard.title} />
        </button>
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
      </header>
      <main className="cogita-main">
        <section className="cogita-section cogita-hero" id="cogita-home" data-section="home">
          <div className="cogita-hero-grid">
            <div className="cogita-hero-copy">
              <p className="cogita-tag">{copy.cogita.page.hero.tag}</p>
              <h1>{copy.cogita.page.hero.title}</h1>
              <p className="lead">{copy.cogita.page.hero.subtitle}</p>
              <div className="cogita-hero-actions">
                <button type="button" className="cta" onClick={onAuthAction}>
                  {copy.cogita.page.hero.primaryCta}
                </button>
                <button type="button" className="ghost" onClick={() => scrollToSection('library')}>
                  {copy.cogita.page.hero.secondaryCta}
                </button>
              </div>
              <div className="cogita-stats">
                {copy.cogita.page.stats.map((stat) => (
                  <div key={stat.label} className="cogita-stat">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cogita-hero-panels">
              <div className="cogita-panel-card">
                <h3>{copy.cogita.title}</h3>
                <ul>
                  {copy.cogita.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="note">{copy.cogita.note}</p>
              </div>
              <div className="cogita-highlight-grid">
                {copy.cogita.page.highlights.map((item) => (
                  <div key={item.title} className="cogita-highlight">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="cogita-subpage-grid">
            {copy.cogita.page.sections.map((section) => (
              <button
                type="button"
                className="cogita-subpage-card"
                key={section.id}
                onClick={() => scrollToSection(section.id)}
              >
                <span>{section.tag}</span>
                <strong>{section.title}</strong>
                <em>{section.subtitle}</em>
              </button>
            ))}
          </div>
        </section>

        <nav className="cogita-subnav" aria-label={copy.cogita.title}>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className={activeSection === item.id ? 'active' : ''}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {copy.cogita.page.sections.map((section) => (
          <section
            key={section.id}
            className="cogita-section cogita-detail"
            id={`cogita-${section.id}`}
            data-section={section.id}
          >
            <div className="cogita-section-header">
              <p className="cogita-section-tag">{section.tag}</p>
              <div>
                <h2>{section.title}</h2>
                <p className="lead">{section.subtitle}</p>
              </div>
            </div>
            <div className="cogita-card-grid">
              {section.cards.map((card) => (
                <article key={card.title} className="cogita-card">
                  {card.meta && <span className="cogita-card-meta">{card.meta}</span>}
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </article>
              ))}
            </div>
            <ul className="cogita-bullets">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="cogita-section cogita-join" id="cogita-join" data-section="join">
          <div className="cogita-section-header">
            <p className="cogita-section-tag">{copy.cogita.page.hero.tag}</p>
            <div>
              <h2>{copy.cogita.page.join.title}</h2>
              <p className="lead">{copy.cogita.page.join.subtitle}</p>
            </div>
          </div>
          <div className="cogita-join-grid">
            {copy.cogita.page.join.cards.map((card, index) => (
              <article key={card.title} className="cogita-card cogita-join-card">
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <button type="button" className="ghost" onClick={joinActions[index]}>
                  {card.action}
                </button>
              </article>
            ))}
          </div>
          <div className="cogita-join-action">
            <button type="button" className="cta" onClick={onAuthAction}>
              {authLabel}
            </button>
          </div>
        </section>
      </main>
      <footer className="portal-footer cogita-footer">
        <span>{copy.footer.headline}</span>
        <button type="button" className="ghost" onClick={onAuthAction}>
          {authLabel}
        </button>
      </footer>
    </div>
  );
}
