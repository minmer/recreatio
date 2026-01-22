import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
  const homeRef = useRef<HTMLElement | null>(null);
  const homeViewportRef = useRef<HTMLDivElement | null>(null);
  const [activeHomeIndex, setActiveHomeIndex] = useState(0);
  const homeSlides = useMemo(() => copy.cogita.page.homeSlides, [copy.cogita.page.homeSlides]);
  const homeThemes = useMemo(
    () => [
      {
        bg0: '#06162a',
        bg1: '#0c2d49',
        glow: 'rgba(120, 200, 255, 0.85)',
        line: 'rgba(120, 200, 255, 0.18)',
        dot: 'rgba(190, 235, 255, 0.95)'
      },
      {
        bg0: '#071a2a',
        bg1: '#0b3b56',
        glow: 'rgba(129, 220, 255, 0.9)',
        line: 'rgba(120, 210, 255, 0.2)',
        dot: 'rgba(206, 241, 255, 0.98)'
      },
      {
        bg0: '#0a1d33',
        bg1: '#0f334f',
        glow: 'rgba(110, 195, 255, 0.88)',
        line: 'rgba(120, 200, 255, 0.16)',
        dot: 'rgba(180, 230, 255, 0.95)'
      },
      {
        bg0: '#08192f',
        bg1: '#123b5c',
        glow: 'rgba(140, 210, 255, 0.9)',
        line: 'rgba(130, 210, 255, 0.2)',
        dot: 'rgba(200, 240, 255, 0.98)'
      },
      {
        bg0: '#071424',
        bg1: '#0f2a4a',
        glow: 'rgba(120, 200, 255, 0.85)',
        line: 'rgba(120, 190, 255, 0.18)',
        dot: 'rgba(190, 230, 255, 0.95)'
      },
      {
        bg0: '#071a2a',
        bg1: '#0a2742',
        glow: 'rgba(160, 220, 255, 0.85)',
        line: 'rgba(120, 210, 255, 0.2)',
        dot: 'rgba(210, 240, 255, 0.98)'
      }
    ],
    []
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const scrollToSlide = (index: number) => {
    const viewport = homeViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: index * viewport.clientHeight, behavior: 'smooth' });
    setActiveHomeIndex(index);
  };

  useEffect(() => {
    const viewport = homeViewportRef.current;
    if (!viewport) return;

    let timeout: number | undefined;
    const onScroll = () => {
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        const height = viewport.clientHeight || 1;
        if (!Number.isFinite(height) || height <= 1) return;
        const index = Math.round(viewport.scrollTop / height);
        setActiveHomeIndex(Math.max(0, Math.min(index, homeSlides.length - 1)));
      }, 40);
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [homeSlides.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = homeRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let width = 0;
    let height = 0;
    let frame = 0;
    let rafId = 0;
    const nodes: Array<{ x: number; y: number; vx: number; vy: number; r: number }> = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const resize = () => {
      width = Math.floor(container.clientWidth);
      height = Math.floor(container.clientHeight);
      canvas.width = Math.floor(width * DPR);
      canvas.height = Math.floor(height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.max(26, Math.floor((width * height) / 26000));
      nodes.length = 0;
      for (let i = 0; i < count; i += 1) {
        nodes.push({
          x: rand(0, width),
          y: rand(0, height),
          vx: rand(-0.35, 0.35),
          vy: rand(-0.35, 0.35),
          r: rand(1.1, 2.6)
        });
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const drawDot = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.22;
      ctx.beginPath();
      ctx.arc(x, y, r * 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 4.5;
    };

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      frame += 1;

      ctx.fillStyle =
        getComputedStyle(container).getPropertyValue('--cogita-dust').trim() ||
        'rgba(180, 230, 255, 0.06)';
      for (let i = 0; i < 70; i += 1) {
        ctx.fillRect((i * 97) % width, (i * 193 + frame * 0.12) % height, 1, 1);
      }

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;
      }

      const lineColor =
        getComputedStyle(container).getPropertyValue('--cogita-line').trim() ||
        'rgba(120, 200, 255, 0.18)';
      const dotColor =
        getComputedStyle(container).getPropertyValue('--cogita-dot').trim() ||
        'rgba(180, 230, 255, 0.95)';

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      const linkDist = Math.min(160, Math.max(120, width * 0.12));
      const maxDist = linkDist * linkDist;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxDist) continue;
          const d = Math.sqrt(d2);
          const alpha = Math.max(0, 1 - d / linkDist) * 0.9;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = dotColor;
      for (const node of nodes) drawDot(node.x, node.y, node.r);

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    if (prefersReducedMotion) {
      tick();
    } else {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const slideActions = homeSlides.map((_, index) => {
    if (index === homeSlides.length - 1) return onAuthAction;
    return () => scrollToSlide(index + 1);
  });
  const activeSlide = homeSlides[activeHomeIndex];
  const theme = homeThemes[activeHomeIndex % homeThemes.length];
  const homeThemeStyle = {
    '--cogita-bg0': theme.bg0,
    '--cogita-bg1': theme.bg1,
    '--cogita-glow': theme.glow,
    '--cogita-line': theme.line,
    '--cogita-dot': theme.dot
  } as CSSProperties;

  return (
    <div className="portal-page cogita">
      <header className="portal-header cogita-header">
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
        <section ref={homeRef} className="cogita-section cogita-home" style={homeThemeStyle}>
          <div className="cogita-home-bg" aria-hidden="true">
            <canvas ref={canvasRef} className="cogita-home-canvas" />
            <div className="cogita-home-wave" />
            <div className="cogita-home-wave wave-2" />
            <div className="cogita-home-glow" />
          </div>
          <div ref={homeViewportRef} className="cogita-home-viewport">
            {homeSlides.map((slide, index) => (
              <section
                key={slide.id}
                className={`cogita-home-slide slide-${index + 1} ${
                  activeHomeIndex === index ? 'is-active' : ''
                }`}
              >
                <div className="cogita-home-content">
                  <p className="cogita-tag">{copy.cogita.page.hero.tag}</p>
                  <h1>{slide.title}</h1>
                  <p>{slide.text}</p>
                  <button
                    type="button"
                    className={`cta ${slide.variant === 'secondary' ? 'ghost' : ''}`}
                    onClick={slideActions[index] ?? onAuthAction}
                  >
                    {slide.ctaLabel}
                  </button>
                </div>
                <div className={`cogita-visual visual-${index + 1}`} aria-hidden="true">
                  {index === 0 && (
                    <>
                      <img className="cogita-logo-hero" src="/Cogita.svg" alt="" />
                      <div className="cogita-bubbles">
                        {Array.from({ length: 10 }).map((_, bubbleIndex) => (
                          <span key={`bubble-${bubbleIndex}`} />
                        ))}
                      </div>
                    </>
                  )}
                  {index !== 0 && <img className="cogita-logo-ghost" src="/Cogita.svg" alt="" />}
                  {index === 1 && (
                    <div className="cogita-card-stack">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {index === 2 && (
                    <div className="cogita-live-orbit">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {index === 3 && (
                    <div className="cogita-results-map">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {index === 4 && (
                    <div className="cogita-security-shield">
                      <span />
                      <span />
                    </div>
                  )}
                  {index === 5 && (
                    <div className="cogita-login-portal">
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
          <div className="cogita-home-dots">
            {homeSlides.map((slide, index) => (
              <button
                key={slide.id}
                className={`dot ${activeHomeIndex === index ? 'active' : ''}`}
                aria-label={slide.title}
                type="button"
                onClick={() => scrollToSlide(index)}
              />
            ))}
          </div>
          {activeSlide && (
            <div className="cogita-home-indicator">
              <span>{copy.cogita.page.hero.tag}</span>
              <strong>{activeSlide.title}</strong>
            </div>
          )}
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
