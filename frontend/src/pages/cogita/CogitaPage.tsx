import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import { CogitaIntroSlides, type IntroSlide } from './components/CogitaIntroSlides';

const WAVE_LAYER_COUNT = 10;
const MESH_LAYER_COUNT = 8;

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
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    onNavigate('home');
  };
  const homeRef = useRef<HTMLElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const waveLayers = useMemo(() => {
    let seed = Date.now() % 2147483647;
    const next = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: WAVE_LAYER_COUNT }, (_, idx) => {
      const swayDuration = 6 + next() * 8;
      const scaleDuration = 7 + next() * 10;
      const driftDuration = 6 + next() * 9;
      const swayDelay = -next() * swayDuration;
      const scaleDelay = -next() * scaleDuration;
      const driftDelay = -next() * driftDuration;
      const scale = 0.18 + next() * 0.28;
      const shift = 12 + next() * 18;
      const xShift = 4 + next() * 8;
      const baseX = (next() - 0.5) * 3.2;
      const baseY = (next() - 0.5) * 3.8;
      const swayDir = next() > 0.5 ? 'alternate' : 'alternate-reverse';
      const scaleDir = next() > 0.5 ? 'alternate' : 'alternate-reverse';
      const driftDir = next() > 0.5 ? 'alternate' : 'alternate-reverse';
      const opacity = 0.18 + next() * 0.42;
      const blur = 30 + next() * 60;
      const bottom = -45 - next() * 38;
      const hue = 188 + next() * 32;
      const glow = 0.1 + next() * 0.2;
      return {
        id: `wave-${idx + 1}`,
        style: {
          '--wave-sway-duration': `${swayDuration}s`,
          '--wave-scale-duration': `${scaleDuration}s`,
          '--wave-drift-duration': `${driftDuration}s`,
          '--wave-sway-delay': `${swayDelay}s`,
          '--wave-scale-delay': `${scaleDelay}s`,
          '--wave-drift-delay': `${driftDelay}s`,
          '--wave-sway-dir': swayDir,
          '--wave-scale-dir': scaleDir,
          '--wave-drift-dir': driftDir,
          '--wave-scale': `${scale}`,
          '--wave-shift': `${shift}%`,
          '--wave-xshift': `${xShift}%`,
          '--wave-x0': `${baseX}%`,
          '--wave-y0': `${baseY}%`,
          '--wave-opacity': `${opacity}`,
          '--wave-blur': `${blur}px`,
          '--wave-bottom': `${bottom}%`,
          '--wave-hue': `${hue}`,
          '--wave-glow': `${glow}`
        } as CSSProperties
      };
    });
  }, []);
  const meshLayers = useMemo(() => {
    let seed = (Date.now() * 3) % 2147483647;
    const next = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: MESH_LAYER_COUNT }, (_, idx) => {
      const swayDuration = 180 + next() * 220;
      const driftDuration = 220 + next() * 280;
      const swayDelay = -next() * swayDuration;
      const driftDelay = -next() * driftDuration;
      const scale = 0.12 + next() * 0.22;
      const shift = 3 + next() * 7;
      const xShift = 1 + next() * 3;
      const yOffset = (next() - 0.5) * 2.8;
      const xOffset = (next() - 0.5) * 2.2;
      return {
        id: `mesh-${idx + 1}`,
        seed: 1000 + idx * 991 + Math.floor(next() * 999),
        style: {
          '--mesh-sway-duration': `${swayDuration}s`,
          '--mesh-drift-duration': `${driftDuration}s`,
          '--mesh-sway-delay': `${swayDelay}s`,
          '--mesh-drift-delay': `${driftDelay}s`,
          '--mesh-scale': `${scale}`,
          '--mesh-shift': `${shift}%`,
          '--mesh-xshift': `${xShift}%`,
          '--mesh-x0': `${xOffset}%`,
          '--mesh-y0': `${yOffset}%`
        } as CSSProperties
      };
    });
  }, []);
  const introSlides = useMemo<IntroSlide[]>(() => {
    const base = [
      {
        id: 'entry',
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
        panel: { x: '-2px', y: '4px', scale: '1.01' },
        theme: {
          bg0: '#071a2f',
          bg1: '#0c2f4a',
          bg2: '#081f33',
          bloom: 'rgba(120, 175, 230, 0.14)',
          sat: '0.96'
        }
      },
      {
        id: 'live',
        panel: { x: '4px', y: '-2px', scale: '1.02' },
        theme: {
          bg0: '#07182d',
          bg1: '#0c2a4a',
          bg2: '#081f35',
          bloom: 'rgba(115, 170, 225, 0.15)',
          sat: '0.98'
        }
      },
      {
        id: 'quiz',
        panel: { x: '2px', y: '6px', scale: '1.01' },
        theme: {
          bg0: '#071526',
          bg1: '#0d2946',
          bg2: '#081a30',
          bloom: 'rgba(120, 175, 230, 0.14)',
          sat: '0.97'
        }
      },
      {
        id: 'protection',
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
        panel: { x: '0px', y: '-4px', scale: '1.02' },
        theme: {
          bg0: '#081c30',
          bg1: '#0f3754',
          bg2: '#0b2239',
          bloom: 'rgba(160, 210, 245, 0.2)',
          sat: '1.05'
        }
      }
    ];
    const localized = copy.cogita.introSlides;
    const localizedMap = new Map(localized.map((slide) => [slide.id, slide]));
    return base.map((slide) => {
      const localizedSlide = localizedMap.get(slide.id);
      return {
        ...slide,
        ...localizedSlide,
        title: localizedSlide?.title ?? 'Cogita',
        cta: localizedSlide?.cta ?? 'Dalej',
        secondary: localizedSlide?.secondary
      };
    });
  }, [copy.cogita.introSlides]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [introOpen, setIntroOpen] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
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
    setActiveSlideIndex(lastSlideIndex);
  }, [lastSlideIndex]);
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
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        goPrev();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.code === 'Space' || event.key === ' ') {
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
    const container = homeRef.current;
    if (!container) return;
    const canvases = canvasRefs.current.filter((entry): entry is HTMLCanvasElement => Boolean(entry));
    if (!canvases.length) return;

    const DPR_CAP = 1;
    const renderScaleDesktop = 0.6;
    const renderScaleMobile = 0.6;
    const DPR = Math.max(1, Math.min(DPR_CAP, window.devicePixelRatio || 1));
    let width = 0;
    let height = 0;
    let renderScale = renderScaleDesktop;
    let canvasWidth = 0;
    let canvasHeight = 0;

    const makeRand = (seedBase: number) => {
      let seed = seedBase % 2147483647;
      if (seed <= 0) seed += 2147483646;
      return (a: number, b: number) => {
        seed = (seed * 48271) % 2147483647;
        const t = seed / 2147483647;
        return a + t * (b - a);
      };
    };
    const config = {
      colors: {
        filaments: 'rgba(143, 208, 255, 0.25)',
        glow: 'rgba(167, 224, 255, 0.35)'
      },
      filamentCount: 1,
      segments: 20,
      waveBandPx: 120,
      crestThickness: 40,
      waveCenter: 0.82,
      amp1: 48,
      amp2: 22,
      freq1: 0.010,
      freq2: 0.021,
      jitterA: 12,
      jitterB: 8,
      xJitter: 4,
      glowAlpha: 0.25,
      depthLayers: 2
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

    const buildFilaments = (seedBase: number) => {
      const rand = makeRand(seedBase);
      const adaptiveCount = Math.min(
        4,
        Math.max(4, Math.floor((width / 1200) * config.filamentCount))
      );
      return Array.from({ length: adaptiveCount }, (_, idx) => {
        const offset = Math.max(-1, Math.min(1, gaussian(seedBase + idx * 0.37)));
        const depth = Math.min(1, Math.max(0, seededRand(seedBase + idx * 1.31)));
        const layer = Math.min(config.depthLayers - 1, Math.floor(depth * config.depthLayers));
        return {
          seed: rand(0, Math.PI * 2) + seedBase * 0.01,
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

    const drawDust = (ctx: CanvasRenderingContext2D, drawWidth: number, xOffset: number) => {
      const count = Math.max(30, Math.floor((width * height) / 140000));
      ctx.save();
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < count; i += 1) {
        const x = (seededRand(i * 9.1 + width * 0.11) * drawWidth) + xOffset;
        const y = seededRand(i * 3.7 + height * 0.23) * height;
        const size = 1.2 + seededRand(i * 5.9) * 2.4;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        gradient.addColorStop(0, 'rgba(10, 30, 60, 0.45)');
        gradient.addColorStop(1, 'rgba(10, 30, 60, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawMesh = (
      ctx: CanvasRenderingContext2D,
      filaments: Array<{
        seed: number;
        offset: number;
        freqA: number;
        freqB: number;
        ampA: number;
        ampB: number;
        width: number;
        depth: number;
        layer: number;
      }>
    ) => {
      ctx.clearRect(0, 0, width, height);
      const baseY = height * config.waveCenter;
      const band = config.waveBandPx;
      const segments = config.segments;
      const lineColor = config.colors.filaments;
      const drawWidth = canvasWidth || width;
      const xOffset = 0;
      drawDust(ctx, drawWidth, xOffset);
      ctx.strokeStyle = lineColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < filaments.length; i += 1) {
        const filament = filaments[i];
        const offset = filament.offset * band * (0.85 + seededRand(filament.seed) * 0.4);
        const depthFade = 1 - Math.min(1, Math.abs(offset) / band);
        const crestWeight = Math.exp(-Math.pow(offset / config.crestThickness, 2));
        const layerBoost = filament.layer === 0 ? 1.1 : filament.layer === 1 ? 0.85 : 0.6;
        const depthBoost = 0.35 + (1 - filament.depth) * 0.65;
        const alpha = depthFade * depthBoost * layerBoost * (0.34 + crestWeight * 0.45);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = filament.width * (1 + (1 - filament.depth) * 0.8);
        const points: Array<{ x: number; y: number }> = [];
        for (let s = 0; s <= segments; s += 1) {
          const xRaw = (s / segments) * drawWidth + xOffset;
          const xJitter = (noise1D(xRaw * 0.012, filament.seed) - 0.5) * config.xJitter;
          const x = xRaw + xJitter;
          const noiseA =
            (noise1D(x * filament.freqA, filament.seed) - 0.5) * config.jitterA;
          const noiseB =
            (noise1D(x * filament.freqB, filament.seed * 1.7) - 0.5) * config.jitterB;
          const y =
            baseY +
            Math.sin(x * filament.freqA + filament.seed) * filament.ampA +
            Math.sin(x * filament.freqB + filament.seed * 1.3) * filament.ampB +
            offset +
            noiseA +
            noiseB;
          points.push({ x, y });
        }
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let p = 1; p < points.length - 1; p += 1) {
          const midX = (points[p].x + points[p + 1].x) / 2;
          const midY = (points[p].y + points[p + 1].y) / 2;
          ctx.quadraticCurveTo(points[p].x, points[p].y, midX, midY);
        }
        const last = points[points.length - 1];
        ctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
        ctx.stroke();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = config.colors.glow;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < filaments.length; i += 1) {
        const filament = filaments[i];
        if (Math.abs(filament.offset) * band > config.crestThickness) continue;
        const alpha = config.glowAlpha * (0.7 + (1 - filament.depth) * 0.6);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.6 + (1 - filament.depth) * 1.2;
        const glowPoints: Array<{ x: number; y: number }> = [];
        for (let s = 0; s <= segments; s += 1) {
          const x = (s / segments) * drawWidth + xOffset;
          const noise = Math.sin(x * 0.02 + filament.seed) * 3;
          const y =
            baseY +
            Math.sin(x * filament.freqA + filament.seed) * filament.ampA +
            Math.sin(x * filament.freqB + filament.seed * 1.3) * filament.ampB +
            filament.offset * band * 0.35 +
            noise;
          glowPoints.push({ x, y });
        }
        ctx.beginPath();
        ctx.moveTo(glowPoints[0].x, glowPoints[0].y);
        for (let p = 1; p < glowPoints.length - 1; p += 1) {
          const midX = (glowPoints[p].x + glowPoints[p + 1].x) / 2;
          const midY = (glowPoints[p].y + glowPoints[p + 1].y) / 2;
          ctx.quadraticCurveTo(glowPoints[p].x, glowPoints[p].y, midX, midY);
        }
        const last = glowPoints[glowPoints.length - 1];
        ctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const resize = () => {
      width = Math.floor(container.clientWidth);
      height = Math.floor(container.clientHeight);
      canvasWidth = Math.floor(width * 1.8);
      canvasHeight = height;
      renderScale = width < 820 ? renderScaleMobile : renderScaleDesktop;
      canvases.forEach((canvas) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = Math.floor(canvasWidth * DPR * renderScale);
        canvas.height = Math.floor(canvasHeight * DPR * renderScale);
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        canvas.style.left = `${-(canvasWidth - width) / 2}px`;
        ctx.setTransform(DPR * renderScale, 0, 0, DPR * renderScale, 0, 0);
        const layerSeed = Number(canvas.dataset.seed || 1);
        const filaments = buildFilaments(layerSeed);
        drawMesh(ctx, filaments);
      });
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    return () => window.removeEventListener('resize', resize);
  }, [meshLayers]);

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
        <div className="portal-header-left">
          <button type="button" className="ghost portal-back" onClick={handleBack}>
            Back
          </button>
          <button type="button" className="portal-brand" onClick={() => onNavigate('cogita')}>
            <img src="/cogita_plain.svg" alt="Cogita" />
          </button>
        </div>
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
            {meshLayers.map((layer, idx) => (
              <canvas
                key={layer.id}
                className="cogita-home-canvas cogita-home-canvas-layer"
                style={layer.style}
                data-seed={layer.seed}
                ref={(node) => {
                  canvasRefs.current[idx] = node;
                }}
              />
            ))}
            {waveLayers.map((layer) => (
              <div key={layer.id} className="cogita-home-wave" style={layer.style}>
                <div className="cogita-home-wave-sway">
                  <div className="cogita-home-wave-shape" />
                </div>
              </div>
            ))}
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
        <button type="button" className="portal-brand portal-footer-brand" onClick={() => onNavigate('home')}>
          <img src="/logo_new.svg" alt="Recreatio" />
        </button>
        <span>{copy.footer.headline}</span>
      </footer>
    </div>
  );
}
