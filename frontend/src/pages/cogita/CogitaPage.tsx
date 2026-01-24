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
  const introSlides = useMemo(() => {
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
    return base.map((slide) => ({
      ...slide,
      ...(localizedMap.get(slide.id) ?? {})
    }));
  }, [copy.cogita.introSlides]);
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
      filamentCount: 120,
      segments: 64,
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

type LearningNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  level: number;
  role?: 'root' | 'goal';
};

type LearningLink = {
  from: string;
  to: string;
  key: string;
};

const LEARNING_MAP = {
  width: 420,
  height: 320,
  paddingX: 28,
  paddingY: 18,
  levels: [1, 4, 6, 6, 5, 4, 4]
} as const;

const EXPLORER_TIMING = {
  moveMs: 900,
  pauseMs: 220,
  errorMs: 900
} as const;

const createLearningTree = (seed = 11) => {
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const { width, height, paddingX, paddingY, levels } = LEARNING_MAP;
  const levelStep = (height - paddingY * 2) / (levels.length - 1);
  const nodes: LearningNode[] = [];
  const links: LearningLink[] = [];

  const levelNodes: LearningNode[][] = [];
  levels.forEach((count, levelIndex) => {
    const y = height - paddingY - levelIndex * levelStep;
    const spread = width - paddingX * 2;
    const row: LearningNode[] = [];
    for (let i = 0; i < count; i += 1) {
      const baseX = paddingX + ((i + 1) * spread) / (count + 1);
      const jitter = (rand() - 0.5) * 18;
      const x = Math.max(paddingX, Math.min(width - paddingX, baseX + jitter));
      const r = levelIndex === 0 ? 3 : levelIndex < 2 ? 2.1 : 1.4;
      const id = levelIndex === 0 ? 'root' : `l${levelIndex}-${i}`;
      row.push({
        id,
        x: levelIndex === 0 ? width / 2 : x,
        y,
        r,
        level: levelIndex,
        role: levelIndex === 0 ? 'root' : undefined
      });
    }
    levelNodes.push(row);
    nodes.push(...row);
  });

  const topLevel = levelNodes[levelNodes.length - 1];
  if (topLevel?.length) {
    const goal = topLevel[Math.floor(topLevel.length / 2)];
    goal.role = 'goal';
    goal.r = 2;
  }

  for (let level = 1; level < levelNodes.length; level += 1) {
    const parents = levelNodes[level - 1];
    const row = levelNodes[level];
    row.forEach((node) => {
      const sortedParents = [...parents].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x));
      const primary = sortedParents[0];
      const secondary = sortedParents[1] && rand() < 0.45 ? sortedParents[1] : null;
      const parentIds = secondary ? [primary, secondary] : [primary];
      parentIds.forEach((parent) => {
        links.push({ from: parent.id, to: node.id, key: `${parent.id}-${node.id}` });
      });
      if (rand() < 0.2 && sortedParents[2]) {
        links.push({ from: sortedParents[2].id, to: node.id, key: `${sortedParents[2].id}-${node.id}` });
      }
    });
  }

  const parentsById = new Map<string, string[]>();
  links.forEach((link) => {
    const list = parentsById.get(link.to) ?? [];
    list.push(link.from);
    parentsById.set(link.to, list);
  });

  const linksByFrom = new Map<string, string[]>();
  const childrenByFrom = new Map<string, string[]>();
  const neighborsById = new Map<string, string[]>();
  links.forEach((link) => {
    const list = linksByFrom.get(link.from) ?? [];
    list.push(link.key);
    linksByFrom.set(link.from, list);
    const children = childrenByFrom.get(link.from) ?? [];
    children.push(link.to);
    childrenByFrom.set(link.from, children);
    const fromNeighbors = neighborsById.get(link.from) ?? [];
    fromNeighbors.push(link.to);
    neighborsById.set(link.from, fromNeighbors);
    const toNeighbors = neighborsById.get(link.to) ?? [];
    toNeighbors.push(link.from);
    neighborsById.set(link.to, toNeighbors);
  });

  const nodesById = new Map<string, LearningNode>();
  nodes.forEach((node) => {
    nodesById.set(node.id, node);
  });

  return { nodes, links, parentsById, linksByFrom, childrenByFrom, neighborsById, nodesById };
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
  const cardCycleMs = 10000;
  const indexCards = useMemo(() => {
    let seed = 17;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const gridPositions = [
      { x: -180, y: -70 },
      { x: -60, y: -70 },
      { x: 60, y: -70 },
      { x: 180, y: -70 },
      { x: -120, y: 60 },
      { x: 0, y: 60 },
      { x: 120, y: 60 }
    ];
    return gridPositions.map((grid, index) => {
      const throwX = (rand() - 0.5) * 240;
      const throwY = (rand() - 0.5) * 180;
      const throwRot = (rand() - 0.5) * 24;
      return {
        id: `card-${index + 1}`,
        throw: { x: `${throwX.toFixed(0)}px`, y: `${throwY.toFixed(0)}px`, rot: `${throwRot.toFixed(1)}deg` },
        grid: { x: `${grid.x}px`, y: `${grid.y}px` },
        delay: `${index * 0.12}s`
      };
    });
  }, []);
  const stackTargets = useMemo(
    () => [
      { x: '-80px', y: '-120px' },
      { x: '-80px', y: '-15px' },
      { x: '-80px', y: '90px' },
      { x: '-80px', y: '195px' }
    ],
    []
  );
  const [stackOrder, setStackOrder] = useState<string[]>([]);
  const roundCards = useMemo(
    () => [
      { id: 'round-1', x: '14%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-2', x: '30%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-3', x: '46%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-4', x: '62%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-5', x: '78%', y: 'calc(80% + var(--round-card-drop))' }
    ],
    []
  );
  const roundPlayers = useMemo(() => {
    const count = 6;
    const positions: Array<{ x: number; y: number }> = [];
    const minDistance = 12;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const maxAttempts = 80;

    for (let i = 0; i < count; i += 1) {
      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const x = rand(14, 86);
        const y = rand(10, 34);
        const ok = positions.every((p) => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.hypot(dx, dy) >= minDistance;
        });
        if (ok) {
          positions.push({ x, y });
          placed = true;
          break;
        }
      }
      if (!placed) {
        positions.push({ x: rand(16, 84), y: rand(12, 32) });
      }
    }

    return positions.map((pos, idx) => ({
      id: `p${idx + 1}`,
      x: `${pos.x.toFixed(1)}%`,
      y: `${pos.y.toFixed(1)}%`,
      xNum: pos.x,
      yNum: pos.y,
      jitterX: `${(Math.random() - 0.5) * 12}px`,
      jitterY: `${(Math.random() - 0.5) * 10}px`,
      delay: `${(Math.random() * 1.2).toFixed(2)}s`
    }));
  }, []);
  const [roundKey, setRoundKey] = useState(0);
  const [activeRoundCard, setActiveRoundCard] = useState(0);
  const [roundResults, setRoundResults] = useState<Array<'good' | 'bad'>>([]);
  const roundCycleMs = 10000;
  const roundLinks = useMemo(() => {
    if (roundPlayers.length < 2) return [];
    const seeded = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (seed: number, max: number) => Math.floor(seeded(seed) * max);
    const pairs = new Set<string>();
    const links: Array<{
      id: string;
      from: typeof roundPlayers[number];
      to: typeof roundPlayers[number];
      delay: string;
    }> = [];
    const targetCount = Math.min(3, roundPlayers.length);
    let attempts = 0;
    while (links.length < targetCount && attempts < 30) {
      attempts += 1;
      const a = pick(roundKey * 13 + attempts * 5, roundPlayers.length);
      const b = pick(roundKey * 29 + attempts * 7, roundPlayers.length);
      if (a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      links.push({
        id: `link-${key}`,
        from: roundPlayers[a],
        to: roundPlayers[b],
        delay: `${(attempts * 0.35).toFixed(2)}s`
      });
    }
    return links;
  }, [roundKey, roundPlayers]);

  useEffect(() => {
    if (!introOpen || activeIndex !== 2) return;
    const pickOrder = () => {
      const ids = indexCards.map((card) => card.id);
      for (let i = ids.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.slice(0, 4);
    };
    setStackOrder(pickOrder());
    const interval = window.setInterval(() => {
      setStackOrder(pickOrder());
    }, cardCycleMs);
    return () => window.clearInterval(interval);
  }, [activeIndex, introOpen, indexCards, cardCycleMs]);

  useEffect(() => {
    if (!introOpen || activeIndex !== 3) return;
    const nextRound = () => {
      setActiveRoundCard(Math.floor(Math.random() * roundCards.length));
      setRoundResults(
        roundPlayers.map(() => (Math.random() < 0.6 ? 'good' : 'bad'))
      );
      setRoundKey((prev) => prev + 1);
    };
    nextRound();
    const interval = window.setInterval(nextRound, roundCycleMs);
    return () => window.clearInterval(interval);
  }, [activeIndex, introOpen, roundCards.length, roundPlayers, roundCycleMs]);
  const learningTree = useMemo(() => createLearningTree(11), []);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set(['root']));
  const [errorNodes, setErrorNodes] = useState<Set<string>>(new Set());
  const [errorLinks, setErrorLinks] = useState<Set<string>>(new Set());
  const [explorer, setExplorer] = useState<{ fromId: string; toId: string; key: number }>({
    fromId: 'root',
    toId: 'root',
    key: 0
  });
  const activeNodesRef = useRef(activeNodes);
  const explorerRef = useRef('root');
  const explorerKeyRef = useRef(0);
  const moveTimerRef = useRef<number | null>(null);
  const errorTargetRef = useRef<{ fromId: string; toId: string } | null>(null);
  const recoveryStackRef = useRef<string[]>([]);

  useEffect(() => {
    activeNodesRef.current = activeNodes;
  }, [activeNodes]);
  const activeLinks = useMemo(() => {
    const next = new Set<string>();
    activeNodes.forEach((nodeId) => {
      const list = learningTree.linksByFrom.get(nodeId);
      if (!list) return;
      list.forEach((key) => next.add(key));
    });
    return next;
  }, [activeNodes, learningTree]);
  const explorerNode =
    learningTree.nodesById.get(explorer.toId) ?? learningTree.nodesById.get('root');
  const explorerLeft = explorerNode
    ? `${(explorerNode.x / LEARNING_MAP.width) * 100}%`
    : '50%';
  const explorerTop = explorerNode
    ? `${(explorerNode.y / LEARNING_MAP.height) * 100}%`
    : '90%';

  useEffect(() => {
    if (!introOpen || activeIndex !== 1 || prefersReducedMotion) return;
    const reset = () => {
      const nextActive = new Set<string>(['root']);
      setActiveNodes(nextActive);
      setErrorNodes(new Set());
      setErrorLinks(new Set());
      setExplorer({ fromId: 'root', toId: 'root', key: 0 });
      errorTargetRef.current = null;
      explorerKeyRef.current = 0;
      explorerRef.current = 'root';
      recoveryStackRef.current = [];
    };
    reset();

    const pickNextTarget = () => {
      const currentId = explorerRef.current;
      const currentActive = activeNodesRef.current;
      const children = learningTree.childrenByFrom.get(currentId) ?? [];
      const unexploredChildren = children.filter((child) => !currentActive.has(child));
      if (unexploredChildren.length) {
        return unexploredChildren[Math.floor(Math.random() * unexploredChildren.length)];
      }
      if (currentActive.size >= learningTree.nodes.length) {
        const neighbors = learningTree.neighborsById.get(currentId) ?? [];
        return neighbors.length ? neighbors[Math.floor(Math.random() * neighbors.length)] : null;
      }
      const hasUnexploredChildren = (nodeId: string) => {
        const nodeChildren = learningTree.childrenByFrom.get(nodeId) ?? [];
        return nodeChildren.some((child) => !currentActive.has(child));
      };
      const queue: string[] = [currentId];
      const visited = new Set<string>([currentId]);
      const prev = new Map<string, string>();
      let target: string | null = null;
      while (queue.length) {
        const nodeId = queue.shift();
        if (!nodeId) break;
        if (nodeId !== currentId && hasUnexploredChildren(nodeId)) {
          target = nodeId;
          break;
        }
        const neighbors = learningTree.neighborsById.get(nodeId) ?? [];
        neighbors.forEach((neighbor) => {
          if (visited.has(neighbor)) return;
          visited.add(neighbor);
          prev.set(neighbor, nodeId);
          queue.push(neighbor);
        });
      }
      if (!target) return null;
      let step = target;
      while (prev.get(step) && prev.get(step) !== currentId) {
        step = prev.get(step) ?? step;
      }
      return step;
    };

    const scheduleMove = (fromId: string, toId: string) => {
      if (fromId === toId) {
        const nextTarget = pickNextTarget();
        if (nextTarget) {
          scheduleMove(fromId, nextTarget);
        }
        return;
      }
      explorerKeyRef.current += 1;
      setExplorer({ fromId, toId, key: explorerKeyRef.current });
      explorerRef.current = toId;
      moveTimerRef.current = window.setTimeout(() => {
        const parents = learningTree.parentsById.get(toId) ?? [];
        const currentActive = activeNodesRef.current;
        const missingParents = parents.filter((parent) => !currentActive.has(parent));
        if (!missingParents.length) {
          const nextActive = new Set(currentActive);
          nextActive.add(toId);
          setActiveNodes(nextActive);
          moveTimerRef.current = window.setTimeout(() => {
            while (recoveryStackRef.current.length) {
              const target = recoveryStackRef.current[recoveryStackRef.current.length - 1];
              if (!nextActive.has(target)) {
                if (target !== toId) {
                  scheduleMove(toId, target);
                  return;
                }
                break;
              }
              recoveryStackRef.current.pop();
            }
            const nextTarget = pickNextTarget();
            if (!nextTarget) return;
            scheduleMove(toId, nextTarget);
          }, EXPLORER_TIMING.pauseMs);
          return;
        }

        const nextErrorNodes = new Set<string>([toId, ...missingParents]);
        const nextErrorLinks = new Set<string>(
          missingParents.map((parent) => `${parent}-${toId}`)
        );
        setErrorNodes(nextErrorNodes);
        setErrorLinks(nextErrorLinks);
        if (!recoveryStackRef.current.includes(toId)) {
          recoveryStackRef.current.push(toId);
        }
        const fallback = missingParents[Math.floor(Math.random() * missingParents.length)];
        errorTargetRef.current = { fromId: toId, toId: fallback };
        moveTimerRef.current = window.setTimeout(() => {
          setErrorNodes(new Set());
          setErrorLinks(new Set());
          const next = errorTargetRef.current;
          if (!next) return;
          scheduleMove(next.fromId, next.toId);
        }, EXPLORER_TIMING.errorMs);
      }, EXPLORER_TIMING.moveMs);
    };

    moveTimerRef.current = window.setTimeout(() => {
      const target = pickNextTarget();
      if (!target) return;
      scheduleMove(explorerRef.current, target);
    }, EXPLORER_TIMING.pauseMs);

    return () => {
      if (moveTimerRef.current) {
        window.clearTimeout(moveTimerRef.current);
      }
    };
  }, [activeIndex, introOpen, learningTree, prefersReducedMotion]);

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
      data-slide={activeIndex + 1}
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
                      {slide.body && (
                        <p>
                          {slide.body.split('\n').map((line, lineIndex) => (
                            <span key={String(lineIndex)}>
                              {line}
                              {lineIndex === 0 && <br />}
                            </span>
                          ))}
                        </p>
                      )}
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
                    <div className="cogita-learning-map">
                      <svg
                        className="learning-map-svg"
                        viewBox={`0 0 ${LEARNING_MAP.width} ${LEARNING_MAP.height}`}
                        preserveAspectRatio="none"
                      >
                        {learningTree.links.map((link) => {
                          const start = learningTree.nodesById.get(link.from);
                          const end = learningTree.nodesById.get(link.to);
                          if (!start || !end) return null;
                          const isActive = activeLinks.has(link.key);
                          const isError = errorLinks.has(link.key);
                          return (
                            <line
                              key={link.key}
                              className={`map-link ${isActive ? 'is-active' : ''} ${
                                isError ? 'is-error' : ''
                              }`}
                              x1={start.x}
                              y1={start.y}
                              x2={end.x}
                              y2={end.y}
                            />
                          );
                        })}
                        {learningTree.nodes.map((node) => {
                          const isActive = activeNodes.has(node.id);
                          const isError = errorNodes.has(node.id);
                          return (
                            <circle
                              key={node.id}
                              className={`map-node ${node.role ? `is-${node.role}` : ''} ${
                                isActive ? 'is-active' : ''
                              } ${isError ? 'is-error' : ''}`}
                              cx={node.x}
                              cy={node.y}
                              r={node.r}
                            />
                          );
                        })}
                      </svg>
                      {explorerNode && (
                        <span
                          className="map-explorer-dot"
                          style={
                            {
                              left: explorerLeft,
                              top: explorerTop,
                              '--move': `${EXPLORER_TIMING.moveMs}ms`
                            } as CSSProperties
                          }
                        />
                      )}
                    </div>
                  )}
                  {index === 2 && (
                    <div className="cogita-index-cards">
                      {indexCards.map((card) => {
                        const stackIndex = stackOrder.indexOf(card.id);
                        const stackTarget = stackIndex >= 0 ? stackTargets[stackIndex] : null;
                        const stackX = stackTarget?.x ?? '140px';
                        const stackY = stackTarget?.y ?? '140px';
                        const stackOpacity = stackIndex >= 0 ? 1 : 0;
                        return (
                          <div
                            key={card.id}
                            className="cogita-index-card"
                            style={
                              {
                                '--throw-x': card.throw.x,
                                '--throw-y': card.throw.y,
                                '--throw-rot': card.throw.rot,
                                '--grid-x': card.grid.x,
                                '--grid-y': card.grid.y,
                                '--stack-x': stackX,
                                '--stack-y': stackY,
                                '--stack-opacity': stackOpacity,
                                '--delay': card.delay
                              } as CSSProperties
                            }
                          >
                            <span className="card-title" />
                            <span className="card-line" />
                            <span className="card-line short" />
                            <span className="card-quote" />
                            <span className="card-source" />
                            <span className="card-tags">
                              <i />
                              <i />
                              <i />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {index === 3 && (
                    <div className="cogita-round-board" key={`round-${roundKey}`}>
                      <div className="round-cards">
                        {roundCards.map((card, idx) => (
                          <div
                            key={card.id}
                            className={`round-card ${idx === activeRoundCard ? 'is-active' : ''}`}
                            style={
                              {
                                '--card-x': card.x,
                                '--card-y': card.y
                              } as CSSProperties
                            }
                          >
                            <span className="card-title" />
                            <span className="card-line" />
                            <span className="card-line short" />
                          </div>
                        ))}
                        {roundCards[activeRoundCard] && (
                          <span
                            className="round-ring"
                            style={
                              {
                                '--card-x': roundCards[activeRoundCard].x,
                                '--card-y': `calc(${roundCards[activeRoundCard].y} - var(--round-card-lift))`
                              } as CSSProperties
                            }
                          />
                        )}
                      </div>
                      <div className="round-players">
                        {roundPlayers.map((player, idx) => (
                          <span
                            key={player.id}
                            className="player-dot"
                            style={
                              {
                                left: player.x,
                                top: player.y,
                                '--jitter-x': player.jitterX,
                                '--jitter-y': player.jitterY,
                                '--breath-delay': player.delay
                              } as CSSProperties
                            }
                          />
                        ))}
                      </div>
                      <svg className="round-link-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {roundLinks.map((link) => (
                          <line
                            key={link.id}
                            className="round-link"
                            x1={link.from.xNum}
                            y1={link.from.yNum}
                            x2={link.to.xNum}
                            y2={link.to.yNum}
                            style={{ '--delay': link.delay } as CSSProperties}
                          />
                        ))}
                      </svg>
                      <div className="round-flows">
                        {roundPlayers.map((player, idx) => {
                          const result = roundResults[idx] ?? 'good';
                          const active = roundCards[activeRoundCard];
                          if (!active) return null;
                          const activeLiftedY = `calc(${active.y} - var(--round-card-lift))`;
                          return (
                            <div key={`${player.id}-${roundKey}`} className="round-flow">
                              <span
                                className="flow-dot"
                                style={
                                  {
                                    '--from-x': player.x,
                                    '--from-y': player.y,
                                    '--to-x': active.x,
                                    '--to-y': activeLiftedY,
                                    '--delay': `${idx * 0.12}s`
                                  } as CSSProperties
                                }
                              />
                              <span
                                className={`return-dot is-${result}`}
                                style={
                                  {
                                    '--from-x': active.x,
                                    '--from-y': activeLiftedY,
                                    '--to-x': player.x,
                                    '--to-y': player.y,
                                    '--delay': `${idx * 0.12}s`
                                  } as CSSProperties
                                }
                              />
                              <span
                                className={`result-pop is-${result}`}
                                style={
                                  {
                                    '--at-x': player.x,
                                    '--at-y': player.y,
                                    '--delay': `${idx * 0.12}s`
                                  } as CSSProperties
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {index === 4 && (
                    <div className="cogita-progress-story">
                      <div className="progress-chart progress-chart--steps">
                        <svg className="progress-svg" viewBox="0 0 300 200" role="presentation">
                          <g className="chart-grid">
                            <line x1="40" y1="30" x2="40" y2="170" />
                            <line x1="90" y1="30" x2="90" y2="170" />
                            <line x1="140" y1="30" x2="140" y2="170" />
                            <line x1="190" y1="30" x2="190" y2="170" />
                            <line x1="240" y1="30" x2="240" y2="170" />
                            <line x1="40" y1="170" x2="260" y2="170" />
                            <line x1="40" y1="130" x2="260" y2="130" />
                            <line x1="40" y1="90" x2="260" y2="90" />
                            <line x1="40" y1="50" x2="260" y2="50" />
                          </g>
                          <g className="chart-axes">
                            <line x1="40" y1="170" x2="260" y2="170" />
                            <line x1="40" y1="170" x2="40" y2="30" />
                          </g>
                          <g className="chart-paths">
                            <path className="chart-seg seg-1" d="M40 160 L80 140" pathLength="100" />
                            <path className="chart-seg seg-2" d="M80 140 L130 120" pathLength="100" />
                            <path className="chart-seg seg-3" d="M130 120 L190 90" pathLength="100" />
                            <path className="chart-seg seg-4" d="M190 90 L250 70" pathLength="100" />
                          </g>
                          <circle className="chart-dot-step" r="5" cx="40" cy="160">
                            <animate
                              attributeName="cx"
                              dur="6s"
                              begin="0.6s"
                              repeatCount="indefinite"
                              values="40;80;130;190;250"
                              keyTimes="0;0.25;0.5;0.75;1"
                              calcMode="spline"
                              keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                            />
                            <animate
                              attributeName="cy"
                              dur="6s"
                              begin="0.6s"
                              repeatCount="indefinite"
                              values="160;140;120;90;70"
                              keyTimes="0;0.25;0.5;0.75;1"
                              calcMode="spline"
                              keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                            />
                          </circle>
                        </svg>
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
        </>
      )}
    </div>
  );
}
