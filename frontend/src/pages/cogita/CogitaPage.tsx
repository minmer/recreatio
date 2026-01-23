import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const introSlides = useMemo(
    () => [
      {
        id: 'entry',
        title: 'Cogita.',
        subtitle: 'Scena wiedzy na żywo dla nauki i dialogu.',
        micro: 'Wejdź i zobacz, jak działa przestrzeń pracy.',
        cta: 'Rozpocznij pokaz',
        panel: { x: '0px', y: '0px', scale: '1' },
        theme: {
          bg0: '#06162a',
          bg1: '#0c2d49',
          bg2: '#0a1c2f',
          bloom: 'rgba(120, 170, 220, 0.18)',
          sat: '1'
        }
      },
      {
        id: 'workspace',
        title: 'Twoja przestrzeń pracy.',
        body: 'Twórz sceny, prowadź sesje i buduj narrację — wszystko w jednym miejscu.',
        cta: 'Dalej: Biblioteka',
        bullets: ['Sceny', 'Sesje', 'Narracja'],
        panel: { x: '-6px', y: '-4px', scale: '1.01' },
        theme: {
          bg0: '#071a2a',
          bg1: '#0b3b56',
          bg2: '#081f33',
          bloom: 'rgba(129, 190, 235, 0.18)',
          sat: '1.05'
        }
      },
      {
        id: 'library',
        title: 'Biblioteka.',
        body: 'Układaj moduły wiedzy i quizów w stosy, zapisuj je i używaj ponownie.',
        micro: 'Raz tworzysz — wiele razy używasz.',
        cta: 'Dalej: Na żywo',
        panel: { x: '-2px', y: '4px', scale: '1.01' },
        theme: {
          bg0: '#0a1d33',
          bg1: '#0f334f',
          bg2: '#0a2037',
          bloom: 'rgba(110, 170, 230, 0.16)',
          sat: '1'
        }
      },
      {
        id: 'live',
        title: 'Na żywo.',
        body: 'Uruchom sesję, kontroluj tempo, zadawaj pytania i obserwuj odpowiedzi w czasie rzeczywistym.',
        micro: 'Prowadzący ma ster.',
        cta: 'Dalej: Quiz',
        panel: { x: '4px', y: '-2px', scale: '1.02' },
        theme: {
          bg0: '#08192f',
          bg1: '#123b5c',
          bg2: '#0a2239',
          bloom: 'rgba(130, 190, 235, 0.18)',
          sat: '1.03'
        }
      },
      {
        id: 'quiz',
        title: 'Quiz i udział.',
        body: 'Uczestnicy dołączają w sekundę. Odpowiadają — Ty widzisz trend i tempo.',
        micro: 'Wspólne myślenie, natychmiast.',
        cta: 'Dalej: Ochrona',
        panel: { x: '2px', y: '6px', scale: '1.01' },
        theme: {
          bg0: '#071424',
          bg1: '#0f2a4a',
          bg2: '#081a30',
          bloom: 'rgba(110, 180, 235, 0.16)',
          sat: '0.98'
        }
      },
      {
        id: 'protection',
        title: 'Otwarte, ale chronione.',
        body: 'To, co prywatne, pozostaje prywatne — dostęp jest kontrolowany, a dane chronione.',
        micro: 'Zaufanie jako fundament.',
        cta: 'Dalej: Dołącz',
        panel: { x: '-3px', y: '2px', scale: '1.01' },
        theme: {
          bg0: '#071a2a',
          bg1: '#0a2742',
          bg2: '#07192d',
          bloom: 'rgba(150, 200, 240, 0.16)',
          sat: '1'
        }
      },
      {
        id: 'register',
        title: 'Wejdź do Cogita.',
        body: 'Załóż konto i rozpocznij pierwszą scenę wiedzy.',
        micro: 'To zajmie chwilę.',
        cta: 'Zarejestruj się',
        secondary: 'Wróć do początku',
        panel: { x: '0px', y: '-4px', scale: '1.02' },
        theme: {
          bg0: '#081c30',
          bg1: '#0f3754',
          bg2: '#0b2239',
          bloom: 'rgba(160, 210, 245, 0.2)',
          sat: '1.05'
        }
      }
    ],
    []
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [introOpen, setIntroOpen] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSlideIndex = introSlides.length - 1;
  const markIntroSeen = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem('cogitaIntroSeen', 'true');
    } catch {
      // ignore
    }
  }, []);
  const handleRegister = useCallback(() => {
    markIntroSeen();
    onAuthAction();
  }, [markIntroSeen, onAuthAction]);
  const openIntro = useCallback(() => {
    setIntroOpen(true);
    setActiveSlideIndex(0);
  }, []);
  const closeIntro = useCallback(() => {
    setIntroOpen(false);
  }, []);
  const goToSlide = useCallback(
    (nextIndex: number) => {
      setActiveSlideIndex(Math.max(0, Math.min(lastSlideIndex, nextIndex)));
    },
    [lastSlideIndex]
  );
  const goNext = useCallback(() => {
    if (activeSlideIndex >= lastSlideIndex) {
      handleRegister();
    } else {
      goToSlide(activeSlideIndex + 1);
    }
  }, [activeSlideIndex, goToSlide, handleRegister, lastSlideIndex]);
  const goPrev = useCallback(() => {
    goToSlide(activeSlideIndex - 1);
  }, [activeSlideIndex, goToSlide]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (!introOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      if (event.key === 'Escape') {
        closeIntro();
        return;
      }
      if (event.key === 'ArrowLeft') {
        goPrev();
        return;
      }
      if (event.key === 'ArrowRight' || event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeIntro, goNext, goPrev, introOpen]);

  useEffect(() => {
    if (!introOpen) return;
    if (activeSlideIndex === lastSlideIndex) {
      markIntroSeen();
    }
  }, [activeSlideIndex, introOpen, lastSlideIndex, markIntroSeen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = homeRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const DPR_CAP = 1;
    const renderScaleDesktop = 0.6;
    const renderScaleMobile = 0.6;
    const targetFps = 16;
    const meshFps = 4;
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
      filamentCount: 60,
      segments: 24,
      waveBandPx: 190,
      crestX: 0.58,
      crestW: 0.3,
      crestThickness: 40,
      waveCenter: 0.74,
      amp1: 48,
      amp2: 22,
      freq1: 0.010,
      freq2: 0.021,
      speed1: 0.009,
      speed2: 0.012,
      jitterA: 12,
      jitterB: 8,
      xJitter: 4,
      crossThreadCount: 0,
      glowAlpha: 0.1,
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
        width < 820 ? 28 : 40,
        Math.max(width < 820 ? 16 : 24, Math.floor((width / 1200) * config.filamentCount))
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

  const activeSlide = introSlides[Math.min(activeSlideIndex, introSlides.length - 1)];
  const themedSlide = introOpen ? activeSlide : introSlides[introSlides.length - 1];
  const theme = themedSlide?.theme ?? introSlides[0].theme;
  const homeThemeStyle = {
    '--cogita-bg0': theme.bg0,
    '--cogita-bg1': theme.bg1,
    '--cogita-bg2': theme.bg2,
    '--cogita-bloom': theme.bloom,
    '--cogita-sat': theme.sat
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
          <CogitaIntroSlides
            slides={introSlides}
            activeIndex={activeSlideIndex}
            introOpen={introOpen}
            prefersReducedMotion={prefersReducedMotion}
            onNext={goNext}
            onPrev={goPrev}
            onSelect={goToSlide}
            onExit={closeIntro}
            onOpen={openIntro}
            onRegister={handleRegister}
          />
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

type IntroSlide = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  micro?: string;
  cta: string;
  secondary?: string;
  bullets?: string[];
  panel: { x: string; y: string; scale: string };
  theme: { bg0: string; bg1: string; bg2: string; bloom: string; sat: string };
};

function CogitaIntroSlides({
  slides,
  activeIndex,
  introOpen,
  prefersReducedMotion,
  onNext,
  onPrev,
  onSelect,
  onExit,
  onOpen,
  onRegister
}: {
  slides: IntroSlide[];
  activeIndex: number;
  introOpen: boolean;
  prefersReducedMotion: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSelect: (index: number) => void;
  onExit: () => void;
  onOpen: () => void;
  onRegister: () => void;
}) {
  const isFinal = activeIndex === slides.length - 1;
  const logoState = introOpen && activeIndex === 0 ? 'entry' : 'docked';
  const staticSlide = slides[slides.length - 1];
  const [logoEntered, setLogoEntered] = useState(false);
  const logoLayers = useMemo(
    () =>
      Array.from({ length: 20 }, (_, idx) => {
        const num = String(idx).padStart(2, '0');
        return {
          src: `/cogita/logo/Cogita${num}.png`,
          kind: idx <= 11 ? 'bubble' : idx <= 17 ? 'text' : 'recreatio'
        } as const;
      }),
    []
  );
  const isEntry = introOpen && activeIndex === 0;
  useEffect(() => {
    if (!introOpen) {
      setLogoEntered(false);
      return;
    }
    if (activeIndex > 0 && !logoEntered) {
      setLogoEntered(true);
    }
  }, [activeIndex, introOpen, logoEntered]);
  const wheelLockRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const answerDots = [
    { x: '62%', y: '66%' },
    { x: '70%', y: '70%' },
    { x: '78%', y: '72%' },
    { x: '66%', y: '75%' },
    { x: '74%', y: '78%' },
    { x: '82%', y: '70%' },
    { x: '60%', y: '72%' }
  ];

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!introOpen) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 520) return;
    if (Math.abs(event.deltaY) < 10) return;
    wheelLockRef.current = now;
    if (event.deltaY > 0) {
      onNext();
    } else {
      onPrev();
    }
    event.preventDefault();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!introOpen) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!introOpen) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
    if (dy < 0) {
      onNext();
    } else {
      onPrev();
    }
  };

  return (
    <div
      className={`cogita-intro ${introOpen ? 'is-open' : 'is-closed'} ${
        prefersReducedMotion ? 'is-reduced' : ''
      } ${isFinal ? 'is-final' : ''}`}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="cogita-intro-stage">
        <div className="cogita-intro-logo" data-state={logoState} aria-hidden="true">
          <div className={`cogita-logo-layers ${isEntry && !logoEntered ? 'is-entry' : ''}`}>
            {logoLayers.map((layer, idx) => (
              <img
                key={layer.src}
                src={layer.src}
                alt=""
                className={`cogita-logo-layer ${idx === 0 ? 'is-base' : ''} ${
                  layer.kind === 'text' ? 'is-text' : layer.kind === 'recreatio' ? 'is-recreatio' : ''
                } ${layer.kind === 'bubble' ? 'is-bubble' : ''}`}
              />
            ))}
          </div>
        </div>
        {introOpen &&
          slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <section
                key={slide.id}
                className={`cogita-intro-slide slide-${index + 1} ${isActive ? 'is-active' : ''}`}
                aria-hidden={!isActive}
              >
                <div className="cogita-intro-text">
                  {slide.subtitle ? (
                    <>
                      <p className="cogita-intro-kicker">Cogita</p>
                      <h1>{slide.title}</h1>
                      <p className="cogita-intro-subtitle">{slide.subtitle}</p>
                    </>
                  ) : (
                    <>
                      <p className="cogita-intro-kicker">Cogita</p>
                      <h2>{slide.title}</h2>
                      {slide.body && <p>{slide.body}</p>}
                    </>
                  )}
                  {slide.micro && <p className="cogita-intro-micro">{slide.micro}</p>}
                  <div className="cogita-intro-actions">
                    <button
                      type="button"
                      className="cta"
                      onClick={isFinal ? onRegister : onNext}
                    >
                      {slide.cta}
                    </button>
                    {isFinal && slide.secondary && (
                      <button type="button" className="ghost" onClick={() => onSelect(0)}>
                        {slide.secondary}
                      </button>
                    )}
                  </div>
                </div>
                <div className="cogita-intro-visual" aria-hidden="true">
                  {index === 1 && (
                    <ul className="cogita-glyph-list">
                      {slide.bullets?.map((item) => (
                        <li key={item} className="cogita-glyph-item">
                          <span className={`glyph glyph-${item.toLowerCase()}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {index === 2 && (
                    <div className="cogita-card-stack">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {index === 3 && (
                    <div className="cogita-card-stack is-timeline">
                      <span />
                      <span />
                      <span />
                      <span />
                      <div className="cogita-timeline-pulse" />
                    </div>
                  )}
                  {index === 4 && (
                    <div className="cogita-answers">
                      <div className="cogita-answers-bars">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="cogita-answers-dots">
                        {answerDots.map((dot, idx) => (
                          <span key={String(idx)} style={{ left: dot.x, top: dot.y }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {index === 5 && (
                    <div className="cogita-shield">
                      <svg viewBox="0 0 120 140" role="presentation">
                        <path
                          d="M60 10l42 16v44c0 30-19 54-42 62C37 124 18 100 18 70V26z"
                          fill="none"
                        />
                        <path d="M44 66l10 12 22-26" fill="none" />
                      </svg>
                      <span className="cogita-shield-glow" />
                    </div>
                  )}
                  {index === 6 && <div className="cogita-final-glow" />}
                </div>
              </section>
            );
          })}
        {!introOpen && (
          <section className="cogita-intro-static">
            <div className="cogita-intro-text">
              <p className="cogita-intro-kicker">Cogita</p>
              <h2>{staticSlide.title}</h2>
              {staticSlide.body && <p>{staticSlide.body}</p>}
              {staticSlide.micro && <p className="cogita-intro-micro">{staticSlide.micro}</p>}
              <div className="cogita-intro-actions">
                <button type="button" className="cta" onClick={onRegister}>
                  {staticSlide.cta}
                </button>
                <button type="button" className="ghost" onClick={onOpen}>
                  Otwórz pokaz
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      {introOpen && (
        <>
          <div className="cogita-intro-dots" aria-label="Nawigacja slajdów">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`dot ${activeIndex === index ? 'active' : ''}`}
                aria-label={slide.title}
                onClick={() => onSelect(index)}
              />
            ))}
          </div>
          <button type="button" className="cogita-intro-skip" onClick={onExit}>
            Pomiń
          </button>
          <div className="cogita-intro-nav">
            <button type="button" className="ghost" onClick={onPrev} disabled={activeIndex === 0}>
              Wstecz
            </button>
            <button type="button" className="ghost" onClick={onNext}>
              Dalej
            </button>
          </div>
        </>
      )}
    </div>
  );
}
