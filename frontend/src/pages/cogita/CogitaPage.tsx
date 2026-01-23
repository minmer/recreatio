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
    const DPR_CAP = 1.1;
    const renderScaleDesktop = 0.8;
    const renderScaleMobile = 0.75;
    const targetFps = 24;
    const meshFps = 8;
    const DPR = Math.max(1, Math.min(DPR_CAP, window.devicePixelRatio || 1));
    let width = 0;
    let height = 0;
    let frame = 0;
    let rafId = 0;
    let paused = false;
    let renderScale = renderScaleDesktop;
    let lastTime = 0;
    let acc = 0;
    let lastMeshTime = 0;
    let meshCanvas: HTMLCanvasElement | null = null;
    let meshCtx: CanvasRenderingContext2D | null = null;
    let filaments: Array<{
      seed: number;
      offset: number;
      freqA: number;
      freqB: number;
      ampA: number;
      ampB: number;
      width: number;
      depth: number;
      layer: number;
    }> = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const config = {
      colors: {
        filaments: 'rgba(143, 208, 255, 0.52)',
        glow: 'rgba(167, 224, 255, 0.42)',
        nodes: 'rgba(210, 240, 255, 0.92)'
      },
      filamentCount: 120,
      segments: 48,
      waveBandPx: 190,
      crestX: 0.58,
      crestW: 0.3,
      crestThickness: 40,
      waveCenter: 0.74,
      amp1: 48,
      amp2: 22,
      freq1: 0.010,
      freq2: 0.021,
      speed1: 0.006,
      speed2: 0.009,
      jitterA: 12,
      jitterB: 8,
      xJitter: 4,
      crossThreadCount: 160,
      glowAlpha: 0.18,
      depthLayers: 3
    };

    const resize = () => {
      width = Math.floor(container.clientWidth);
      height = Math.floor(container.clientHeight);
      renderScale = width < 820 ? renderScaleMobile : renderScaleDesktop;
      canvas.width = Math.floor(width * DPR * renderScale);
      canvas.height = Math.floor(height * DPR * renderScale);
      ctx.setTransform(DPR * renderScale, 0, 0, DPR * renderScale, 0, 0);
      if (!meshCanvas) {
        meshCanvas = document.createElement('canvas');
        meshCtx = meshCanvas.getContext('2d');
      }
      if (meshCanvas && meshCtx) {
        meshCanvas.width = canvas.width;
        meshCanvas.height = canvas.height;
        meshCtx.setTransform(DPR * renderScale, 0, 0, DPR * renderScale, 0, 0);
      }
      const adaptiveCount = Math.min(
        width < 820 ? 50 : 70,
        Math.max(width < 820 ? 30 : 45, Math.floor((width / 1200) * config.filamentCount))
      );
      filaments = Array.from({ length: adaptiveCount }, (_, idx) => {
        const offset = Math.max(-1, Math.min(1, gaussian(idx * 0.37)));
        const depth = Math.min(1, Math.max(0, seededRand(idx * 1.31)));
        const layer = Math.min(config.depthLayers - 1, Math.floor(depth * config.depthLayers));
        return {
          seed: rand(0, Math.PI * 2),
          offset,
          freqA: config.freq1 * (0.75 + rand(0, 0.5)),
          freqB: config.freq2 * (0.75 + rand(0, 0.5)),
          ampA: config.amp1 * (0.6 + rand(0, 0.7)),
          ampB: config.amp2 * (0.6 + rand(0, 0.7)),
          width: 2 + (idx % 5) * 0.32,
          depth,
          layer
        };
      });
    };

    const drawMesh = (time: number) => {
      if (!meshCtx || !meshCanvas) return;
      const mctx = meshCtx;
      mctx.clearRect(0, 0, width, height);
      const baseY = height * config.waveCenter;
      const band = config.waveBandPx;
      const segments = config.segments;
      const lineColor = config.colors.filaments;
      const breathe = 0.7 + Math.sin(time * config.speed1) * 0.3;
      const shimmer = 0.6 + Math.sin(time * config.speed2) * 0.4;
      mctx.strokeStyle = lineColor;
      for (let i = 0; i < filaments.length; i += 1) {
        const filament = filaments[i];
        const offset = filament.offset * band * (0.85 + seededRand(filament.seed) * 0.4);
        const breatheLocal =
          0.65 +
          Math.sin(time * config.speed1 + filament.seed * 0.7) * 0.25 +
          Math.sin(time * config.speed2 * 0.6 + filament.seed * 1.2) * 0.1;
        const depthFade = 1 - Math.min(1, Math.abs(offset) / band);
        const crestWeight = Math.exp(-Math.pow(offset / config.crestThickness, 2));
        const layerBoost = filament.layer === 0 ? 1.1 : filament.layer === 1 ? 0.85 : 0.6;
        const depthBoost = 0.35 + (1 - filament.depth) * 0.65;
        const alpha = depthFade * depthBoost * layerBoost * (0.34 + crestWeight * 0.45);
        mctx.globalAlpha = alpha;
        mctx.lineWidth = filament.width * (0.8 + (1 - filament.depth) * 0.9);
        mctx.beginPath();
        for (let s = 0; s <= segments; s += 1) {
          const xRaw = (s / segments) * width;
          const xJitter = (noise1D(xRaw * 0.012, filament.seed) - 0.5) * config.xJitter;
          const x = xRaw + xJitter;
          const noiseA =
            (noise1D(x * filament.freqA, filament.seed) - 0.5) * config.jitterA;
          const noiseB =
            (noise1D(x * filament.freqB, filament.seed * 1.7) - 0.5) *
            config.jitterB *
            shimmer;
          const y =
            baseY +
            Math.sin(x * filament.freqA + filament.seed) * filament.ampA * breatheLocal +
            Math.sin(x * filament.freqB + filament.seed * 1.3) * filament.ampB * breatheLocal +
            offset +
            noiseA +
            noiseB;
          if (s === 0) mctx.moveTo(x, y);
          else mctx.lineTo(x, y);
        }
        mctx.stroke();
      }

      mctx.save();
      mctx.globalCompositeOperation = 'lighter';
      mctx.strokeStyle = config.colors.glow;
      for (let i = 0; i < filaments.length; i += 1) {
        const filament = filaments[i];
        if (Math.abs(filament.offset) * band > config.crestThickness) continue;
        const breatheLocal =
          0.65 +
          Math.sin(time * config.speed1 + filament.seed * 0.7) * 0.25 +
          Math.sin(time * config.speed2 * 0.6 + filament.seed * 1.2) * 0.1;
        const alpha = config.glowAlpha * (0.7 + (1 - filament.depth) * 0.6);
        mctx.globalAlpha = alpha;
        mctx.lineWidth = 1.4 + (1 - filament.depth) * 1.4;
        mctx.beginPath();
        for (let s = 0; s <= segments; s += 1) {
          const x = (s / segments) * width;
          const noise = Math.sin(x * 0.02 + filament.seed) * 3 * shimmer;
          const y =
            baseY +
            Math.sin(x * filament.freqA + filament.seed) * filament.ampA * breatheLocal +
            Math.sin(x * filament.freqB + filament.seed * 1.3) * filament.ampB * breatheLocal +
            filament.offset * band * 0.35 +
            noise;
          if (s === 0) mctx.moveTo(x, y);
          else mctx.lineTo(x, y);
        }
        mctx.stroke();
      }
      mctx.restore();

      mctx.strokeStyle = lineColor;
      mctx.lineWidth = 0.6;
      for (let i = 0; i < config.crossThreadCount; i += 1) {
        const seed = seededRand(i * 13.7);
        const x = seed * width;
        const y =
          baseY +
          Math.sin(x * config.freq1 + seed) * config.amp1 * breathe +
          Math.sin(x * config.freq2 + seed * 1.3) * config.amp2 * breathe +
          (seededRand(seed + 4.2) * 2 - 1) * band * 0.5;
        const len = 8 + seededRand(seed + 9.1) * 20;
        const angle = (seededRand(seed + 1.3) * 0.6 - 0.3) * Math.PI;
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        mctx.globalAlpha = 0.08;
        mctx.beginPath();
        mctx.moveTo(x, y);
        mctx.lineTo(x2, y2);
        mctx.stroke();
      }
    };

    const seededRand = (seed: number) => {
      const s = Math.sin(seed * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    };

    const gaussian = (seed: number) => {
      const u = seededRand(seed + 0.1) || 0.0001;
      const v = seededRand(seed + 0.7) || 0.0001;
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const noise1D = (x: number, seed: number) => {
      const x0 = Math.floor(x);
      const x1 = x0 + 1;
      const t = x - x0;
      const fade = t * t * (3 - 2 * t);
      const n0 = seededRand(x0 * 12.9898 + seed * 78.233);
      const n1 = seededRand(x1 * 12.9898 + seed * 78.233);
      return n0 + (n1 - n0) * fade;
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const tick = (now: number) => {
      if (paused) return;
      if (!lastTime) lastTime = now;
      const delta = now - lastTime;
      lastTime = now;
      acc += delta;
      const step = 1000 / targetFps;
      if (acc < step && !prefersReducedMotion) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      acc = acc % step;
      ctx.clearRect(0, 0, width, height);
      frame += 1;

      const t = frame;
      if (!meshCanvas || !meshCtx) {
        drawMesh(t);
      } else {
        if (prefersReducedMotion || now - lastMeshTime > 1000 / meshFps) {
          lastMeshTime = now;
          drawMesh(t);
        }
        ctx.globalAlpha = 1;
        ctx.drawImage(meshCanvas, 0, 0, width, height);
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onVisibilityChange = () => {
      paused = document.hidden;
      if (!paused && !prefersReducedMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    if (prefersReducedMotion) {
      tick(performance.now());
    } else {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
                {index !== 0 && (
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
                )}
                {index !== 0 && (
                  <div className={`cogita-visual visual-${index + 1}`} aria-hidden="true">
                    <img className="cogita-logo-ghost" src="/Cogita.svg" alt="" />
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
                )}
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
