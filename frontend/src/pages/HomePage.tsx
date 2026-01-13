import { useEffect, useMemo, useRef, useState } from 'react';
import type { Copy } from '../content/types';
import type { RouteKey } from '../types/navigation';
import { LanguageSelect } from '../components/LanguageSelect';
import { AuthAction } from '../components/AuthAction';

type PanelType = 'faq' | 'legal' | 'login';

type Slide = {
  id: string;
  title: string;
  text: string;
  ctaLabel: string;
  ctaAction: () => void;
  variant?: 'secondary';
};

export function HomePage({
  copy,
  language,
  onLanguageChange,
  onNavigate,
  onOpenPanel,
  onAuthAction,
  authLabel,
  authCtaLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  panelOpen,
  activeSectionId,
  onSectionChange
}: {
  copy: Copy;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  onNavigate: (route: RouteKey) => void;
  onOpenPanel: (panel: PanelType) => void;
  onAuthAction: () => void;
  authLabel: string;
  authCtaLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  panelOpen: boolean;
  activeSectionId?: string;
  onSectionChange?: (sectionId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const getViewportHeight = () => {
    const viewport = viewportRef.current;
    const height = viewport?.clientHeight ?? 0;
    if (Number.isFinite(height) && height > 1) return height;
    return window.innerHeight || 1;
  };

  const slides = useMemo<Slide[]>(() => {
    const faqText = copy.faq.items[0]?.a ?? copy.hero.subtitle;
    const legalText = copy.legal.items[0]?.desc ?? copy.hero.subtitle;

    return [
      {
        id: 'section-1',
        title: copy.hero.headline,
        text: copy.hero.subtitle,
        ctaLabel: authCtaLabel,
        ctaAction: onAuthAction
      },
      {
        id: 'section-2',
        title: copy.parish.title,
        text: copy.parish.subtitle,
        ctaLabel: copy.nav.parish,
        ctaAction: () => onNavigate('parish')
      },
      {
        id: 'section-3',
        title: copy.cogita.title,
        text: copy.cogita.subtitle,
        ctaLabel: copy.nav.cogita,
        ctaAction: () => onNavigate('cogita')
      },
      {
        id: 'section-4',
        title: copy.faq.title,
        text: faqText,
        ctaLabel: copy.nav.faq,
        ctaAction: () => onOpenPanel('faq'),
        variant: 'secondary'
      },
      {
        id: 'section-5',
        title: copy.legal.title,
        text: legalText,
        ctaLabel: copy.nav.legal,
        ctaAction: () => onOpenPanel('legal'),
        variant: 'secondary'
      }
    ];
  }, [authCtaLabel, copy, onAuthAction, onNavigate, onOpenPanel]);

  const initialIndex = useMemo(() => {
    const id = activeSectionId ?? 'section-1';
    const found = slides.findIndex((slide) => slide.id === id);
    return found >= 0 ? found : 0;
  }, [activeSectionId, slides]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    document.body.style.overflow = panelOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [panelOpen]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let timeout: number | undefined;
    const onScroll = () => {
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        const height = getViewportHeight();
        if (!Number.isFinite(height) || height <= 1) return;
        const index = Math.round(viewport.scrollTop / height);
        setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
      }, 40);
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [slides.length]);

  useEffect(() => {
    if (panelOpen) return;
    const id = slides[activeIndex]?.id ?? 'section-1';
    if (activeSectionId === id) return;
    onSectionChange?.(id);
  }, [activeIndex, activeSectionId, onSectionChange, panelOpen, slides]);

  useEffect(() => {
    if (panelOpen) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const index = slides.findIndex((slide) => slide.id === (activeSectionId ?? 'section-1'));
    if (index >= 0) {
      const height = getViewportHeight();
      if (Number.isFinite(height) && height > 1) {
        viewport.scrollTo({ top: index * height, behavior: 'smooth' });
        setActiveIndex(index);
      } else {
        const raf = window.requestAnimationFrame(() => {
          const nextHeight = getViewportHeight();
          if (Number.isFinite(nextHeight) && nextHeight > 1) {
            viewport.scrollTo({ top: index * nextHeight, behavior: 'smooth' });
            setActiveIndex(index);
          }
        });
        return () => window.cancelAnimationFrame(raf);
      }
    }
  }, [activeSectionId, panelOpen, slides]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (panelOpen) return;
      const viewport = viewportRef.current;
      const height = getViewportHeight();
      if (!viewport || !Number.isFinite(height) || height <= 1) return;
      if (['ArrowDown', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        const next = Math.min(activeIndex + 1, slides.length - 1);
        viewport.scrollTo({ top: next * height, behavior: 'auto' });
      }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        const next = Math.max(activeIndex - 1, 0);
        viewport.scrollTo({ top: next * height, behavior: 'auto' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, panelOpen, slides.length]);

  return (
    <div className={`home ${panelOpen ? 'home-panel-open' : ''}`}>
      <header className="home-header">
        <button type="button" className="brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt={copy.loginCard.title} />
        </button>
        <nav className="home-nav">
          <button type="button" onClick={() => onNavigate('parish')}>
            {copy.nav.parish}
          </button>
          <button type="button" onClick={() => onNavigate('cogita')}>
            {copy.nav.cogita}
          </button>
          <button type="button" onClick={() => onOpenPanel('faq')}>
            {copy.nav.faq}
          </button>
          <button type="button" onClick={() => onOpenPanel('legal')}>
            {copy.nav.legal}
          </button>
        </nav>
        <div className="home-actions">
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
            variant="cta"
          />
        </div>
      </header>

      <main ref={viewportRef} className="home-viewport" aria-hidden={panelOpen ? 'true' : 'false'}>
        {slides.map((slide, index) => (
          <section
            key={slide.id}
            id={slide.id}
            className={`home-section section-${index + 1} ${activeIndex === index ? 'is-active' : ''}`}
          >
            <div className="home-content">
              <h1>{slide.title}</h1>
              <p>{slide.text}</p>
              <button
                type="button"
                className={`cta ${slide.variant === 'secondary' ? 'ghost' : ''}`}
                onClick={slide.ctaAction}
              >
                {slide.ctaLabel}
              </button>
            </div>
          </section>
        ))}
      </main>

      <div className="home-dots">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            className={`dot ${activeIndex === index ? 'active' : ''}`}
            aria-label={slide.title}
            type="button"
            onClick={() => {
              const viewport = viewportRef.current;
              if (!viewport) return;
              viewport.scrollTo({ top: index * viewport.clientHeight, behavior: 'smooth' });
              setActiveIndex(index);
            }}
          />
        ))}
      </div>

      <footer className="home-footer">
        <span>{copy.footer.headline}</span>
        <div className="footer-links">
          <button type="button" onClick={() => onOpenPanel('legal')}>
            {copy.footer.imprint}
          </button>
          <button type="button" onClick={() => onOpenPanel('faq')}>
            {copy.footer.security}
          </button>
        </div>
      </footer>
    </div>
  );
}
