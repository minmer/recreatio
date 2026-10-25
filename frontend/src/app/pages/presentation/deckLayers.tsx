/**
 * 0107 — WIE EINE SCHICHT AUSSIEHT: die Luft des Altbestands von Cogita
 * (`legacy/pages/cogita/CogitaPage.tsx`, `legacy/styles/cogita.css`) als
 * Schichten für Slajdy, ihr gemeinsames Tuch und die Szenen einer Präsentation.
 *
 * <code>
 *   glow       der Schein (`.cogita-home-bg`: radial-gradient(closest-side at 58% 42%, bloom, transparent 60%))
 *   vignette   die dunklen Ecken (radial-gradient(farthest-corner, transparent 55%, rgba(0,0,0,.35)))
 *   haze       der Dunst (`::before`: zwei dunkle Flecken, ein heller Strich, blur 60px, treibt 18 s)
 *   mesh       die Nici (vier Leinwände mit Wellenlinien und Staub, jede faluje für sich, 180–400 s)
 *   waves      die Fale (sechs verwischte Bänder mit hellen Säumen; im Altbestand still)
 * </code>
 *
 * <b>Was dort `Math.random()` und `Date.now()` war, ist hier ein Samen</b>
 * (`seed`): dieselbe Zahl gibt dasselbe Bild, auf jedem Gerät und nach jedem
 * Neuladen — ein Tuch, das man einstellt, soll so bleiben, wie man es sah.
 *
 * Farben dürfen die Namen des Themas sein (`ground`, `accent`, `ink`, `muted`):
 * sie gehen dann mit den Farben der Slajdy mit.
 */

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

import { MotionBox } from '../motion/MotionBox';
import { readMotionUse, type MotionUse } from '../motion/motion';
import { imageUrl, type Layer, type MeshLayer, type WavesLayer } from '../slides/slideLook';
import { useImageReady } from '../../ui/fadeImage';

/** Eine Farbe einer Schicht: die vier Namen des Themas als seine Variablen — sie gehen mit den Slajdy mit. */
export function layerPaint(color: string): string {
  const name = color.trim();
  return name === 'accent' || name === 'ink' || name === 'ground' || name === 'muted' ? `var(--wk-${name})` : name;
}

/** Was eine Schicht als Grund malt (Verlauf, Bild, Schein, Ecken) — der Rest ist ihr Inhalt (`LayerArt`). */
export function layerBackground(layer: Layer): CSSProperties {
  switch (layer.kind) {
    case 'gradient': {
      const stops = layer.via ? `${layerPaint(layer.from)}, ${layerPaint(layer.via)}, ${layerPaint(layer.to)}` : `${layerPaint(layer.from)}, ${layerPaint(layer.to)}`;
      return { background: `linear-gradient(${layer.angle}deg, ${stops})` };
    }
    /* 2026-10-25 — das Bild selbst malt `LayerArt` (`LayerImage`): es blendet ein, sobald es geladen ist. Hier nur, wie die Schicht deckt und mischt. */
    case 'image':
      return layer.url === '' ? {} : { opacity: layer.opacity, mixBlendMode: layer.blend };
    case 'glow':
      return {
        background: `radial-gradient(closest-side at ${layer.x}% ${layer.y}%, ${layerPaint(layer.color)}, transparent ${layer.size}%)`,
        opacity: layer.opacity, mixBlendMode: layer.blend
      };
    case 'vignette':
      return {
        background: `radial-gradient(farthest-corner at 50% 50%, transparent ${layer.reach}%, color-mix(in srgb, ${layerPaint(layer.color)} ${Math.round(layer.strength * 100)}%, transparent) 100%)`
      };
    default:
      return {};
  }
}

/* -- Zufall mit Samen (wie im Altbestand: Lehmer, 48271) -------------------------------- */

/** Eine Folge von Zahlen 0–1 aus einem Samen — dieselbe jedes Mal. */
export function seeded(seed: number): () => number {
  let state = Math.floor(Math.abs(seed)) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/** Der Altbestand: `sin(seed · 12.9898) · 43758.5453`, der gebrochene Teil. */
const hashed = (seed: number): number => {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const gaussian = (seed: number): number => {
  const u = hashed(seed + 0.1) || 0.0001;
  const v = hashed(seed + 0.7) || 0.0001;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const noise1D = (x: number, seed: number): number => {
  const x0 = Math.floor(x);
  const t = x - x0;
  const fade = t * t * (3 - 2 * t);
  const n0 = hashed(x0 * 12.9898 + seed * 78.233);
  const n1 = hashed((x0 + 1) * 12.9898 + seed * 78.233);
  return n0 + (n1 - n0) * fade;
};

/* -- Nici ------------------------------------------------------------------------------- */

interface Filament {
  readonly seed: number; readonly offset: number; readonly freqA: number; readonly freqB: number;
  readonly ampA: number; readonly ampB: number; readonly width: number; readonly depth: number; readonly layer: number;
}

/** Die vier Fäden einer Leinwand (`buildFilaments`). */
function filaments(seedBase: number, amplitude: number): Filament[] {
  const rand = seeded(seedBase);
  const between = (a: number, b: number) => a + rand() * (b - a);
  return Array.from({ length: 4 }, (_, idx) => {
    const offset = Math.max(-1, Math.min(1, gaussian(seedBase + idx * 0.37)));
    const depth = Math.min(1, Math.max(0, hashed(seedBase + idx * 1.31)));
    return {
      seed: between(0, Math.PI * 2) + seedBase * 0.01,
      offset,
      freqA: 0.010 * (0.75 + between(0, 0.5)),
      freqB: 0.021 * (0.75 + between(0, 0.5)),
      ampA: 48 * (0.6 + between(0, 0.7)) * amplitude,
      ampB: 22 * (0.6 + between(0, 0.7)) * amplitude,
      width: 2 + (idx % 5) * 0.32,
      depth,
      layer: Math.min(1, Math.floor(depth * 2))
    };
  });
}

/** Eine Leinwand zeichnen (`drawMesh` des Altbestands — Staub, Fäden, und der Glanz auf dem Kamm). */
export function drawMesh(ctx: CanvasRenderingContext2D, width: number, height: number, layer: MeshLayer, seedBase: number, paint: { line: string; glow: string; dust: string }): void {
  ctx.clearRect(0, 0, width, height);
  const baseY = height * layer.center;
  const band = 120;
  const crest = 40;
  const smooth = (points: { x: number; y: number }[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let p = 1; p < points.length - 1; p += 1) {
      ctx.quadraticCurveTo(points[p].x, points[p].y, (points[p].x + points[p + 1].x) / 2, (points[p].y + points[p + 1].y) / 2);
    }
    const last = points[points.length - 1];
    ctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
    ctx.stroke();
  };

  if (layer.dust) {
    const count = Math.max(30, Math.floor((width * height) / 140000));
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < count; i += 1) {
      const x = hashed(i * 9.1 + width * 0.11) * width;
      const y = hashed(i * 3.7 + height * 0.23) * height;
      const size = 1.2 + hashed(i * 5.9) * 2.4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
      g.addColorStop(0, paint.dust);
      g.addColorStop(1, 'rgba(10, 30, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const all = filaments(seedBase, layer.amplitude);
  ctx.strokeStyle = paint.line;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const f of all) {
    const offset = f.offset * band * (0.85 + hashed(f.seed) * 0.4);
    const depthFade = 1 - Math.min(1, Math.abs(offset) / band);
    const crestWeight = Math.exp(-Math.pow(offset / crest, 2));
    const layerBoost = f.layer === 0 ? 1.1 : 0.85;
    const depthBoost = 0.35 + (1 - f.depth) * 0.65;
    ctx.globalAlpha = depthFade * depthBoost * layerBoost * (0.34 + crestWeight * 0.45);
    ctx.lineWidth = f.width * (1 + (1 - f.depth) * 0.8);
    const points: { x: number; y: number }[] = [];
    for (let s = 0; s <= 20; s += 1) {
      const raw = (s / 20) * width;
      const x = raw + (noise1D(raw * 0.012, f.seed) - 0.5) * 4;
      const y = baseY + Math.sin(x * f.freqA + f.seed) * f.ampA + Math.sin(x * f.freqB + f.seed * 1.3) * f.ampB + offset
        + (noise1D(x * f.freqA, f.seed) - 0.5) * 12 + (noise1D(x * f.freqB, f.seed * 1.7) - 0.5) * 8;
      points.push({ x, y });
    }
    smooth(points);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = paint.glow;
  for (const f of all) {
    if (Math.abs(f.offset) * band > crest) continue;
    ctx.globalAlpha = 0.25 * (0.7 + (1 - f.depth) * 0.6);
    ctx.lineWidth = 1.6 + (1 - f.depth) * 1.2;
    const points: { x: number; y: number }[] = [];
    for (let s = 0; s <= 20; s += 1) {
      const x = (s / 20) * width;
      const y = baseY + Math.sin(x * f.freqA + f.seed) * f.ampA + Math.sin(x * f.freqB + f.seed * 1.3) * f.ampB
        + f.offset * band * 0.35 + Math.sin(x * 0.02 + f.seed) * 3;
      points.push({ x, y });
    }
    smooth(points);
  }
  ctx.restore();
}

/** Eine Farbe für die Leinwand: ein Name des Themas wird zur berechneten Farbe des Elements. */
function canvasColor(el: Element, color: string): string {
  const name = color.trim();
  if (name !== 'accent' && name !== 'ink' && name !== 'ground' && name !== 'muted') return name;
  return getComputedStyle(el).getPropertyValue(`--wk-${name}`).trim() || '#8fd0ff';
}

/**
 * Wie jede Schicht der Nici sich bewegt: der Altbestand gab jeder eigene
 * Dauer (180–400 s), eigenen Versatz und eigene Ausschläge. Hier aus dem Samen
 * — und die Bewegung der Schicht (meist `sway`) gibt die Mitte vor.
 */
export function meshMotions(layer: MeshLayer): MotionUse[][] {
  const rand = seeded(layer.seed * 3 + 11);
  return Array.from({ length: layer.count }, () => {
    const pick = { sway: rand(), drift: rand(), delay: rand(), scale: rand(), shift: rand(), xShift: rand(), y0: rand(), x0: rand() };
    return layer.motion.map((use): MotionUse => {
      if (use.name !== 'sway') return use;
      const base = use.duration ?? 240_000;
      const duration = Math.round(base * (0.75 + pick.sway * 0.92));
      return readMotionUse({
        name: 'sway', duration, delay: use.delay ?? -Math.round(pick.delay * duration),
        x: use.params.x ?? 1 + pick.xShift * 3, y: use.params.y ?? 3 + pick.shift * 7,
        stretch: use.params.stretch ?? 0.12 + pick.scale * 0.22,
        x0: use.params.x0 ?? (pick.x0 - 0.5) * 2.2, y0: use.params.y0 ?? (pick.y0 - 0.5) * 2.8
      })!;
    });
  });
}

/** Eine Leinwand der Nici — gezeichnet, wenn sich ihre Grösse ändert, nicht in jedem Bild. */
function MeshCanvas({ layer, index }: { layer: MeshLayer; index: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const seedBase = 1000 + index * 991 + Math.floor(hashed(layer.seed + index * 7.7) * 999);

  useEffect(() => {
    const canvas = ref.current;
    const box = canvas?.closest<HTMLElement>('.wk-air-mesh') ?? null;
    if (canvas === null || box === null) return undefined;
    let frame = 0;
    const draw = () => {
      const width = Math.floor(box.clientWidth * 1.8);
      const height = Math.floor(box.clientHeight);
      if (width <= 0 || height <= 0) return;
      /* Wie im Altbestand: höchstens eine Pixeldichte von 1, und 0,6 davon — die Fäden sind weich, nicht scharf. */
      const scale = Math.min(1, window.devicePixelRatio || 1) * 0.6;
      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx === null) return;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawMesh(ctx, width, height, layer, seedBase, {
        line: canvasColor(canvas, layer.color), glow: canvasColor(canvas, layer.glow), dust: 'rgba(10, 30, 60, 0.45)'
      });
    };
    const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    draw();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    observer?.observe(box);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [layer, seedBase]);

  return <canvas ref={ref} className="wk-air-mesh-canvas" />;
}

/* -- Fale ------------------------------------------------------------------------------- */

interface Wave {
  readonly opacity: number; readonly blur: number; readonly bottom: number; readonly hue: number; readonly glow: number;
  readonly motion: MotionUse[];
}

/** Die Bänder — in der Reihenfolge, in der der Altbestand seinen Zufall zog. */
export function waves(layer: WavesLayer): Wave[] {
  const rand = seeded(layer.seed);
  return Array.from({ length: layer.count }, () => {
    const sway = 6 + rand() * 8;
    rand(); rand();
    const swayDelay = -rand() * sway;
    rand(); rand();
    rand();
    const shift = 12 + rand() * 18;
    const xShift = 4 + rand() * 8;
    const x0 = (rand() - 0.5) * 3.2;
    const y0 = (rand() - 0.5) * 3.8;
    /* Richtungen der drei Bewegungen — die Welle hier läuft nur vorwärts, gezogen werden sie trotzdem (dieselbe Folge). */
    rand(); rand(); rand();
    const opacity = (0.18 + rand() * 0.42) * layer.opacity;
    const blur = (30 + rand() * 60) * layer.blur;
    const bottom = -45 - rand() * 38;
    const hue = layer.hue + rand() * layer.spread;
    const glow = 0.1 + rand() * 0.2;
    const motion = layer.motion.map((use): MotionUse => use.name !== 'wave' ? use : readMotionUse({
      name: 'wave', duration: use.duration ?? Math.round(sway * 1000), delay: use.delay ?? Math.round(swayDelay * 1000),
      x: use.params.x ?? xShift, y: use.params.y ?? shift, x0: use.params.x0 ?? x0, y0: use.params.y0 ?? y0
    })!);
    return { opacity, blur, bottom, hue, glow, motion };
  });
}

/**
 * 2026-10-25 — DAS BILD EINER SCHICHT, unter ihrer Deckkraft und Mischung: unsichtbar,
 * solange es lädt, dann blendet es ein (Wunsch des Nutzers; `ui/fadeImage.tsx`). Was
 * schon geladen ist, steht sofort da — ein Wechsel blendet nichts neu ein.
 */
function LayerImage({ layer }: { layer: Extract<Layer, { kind: 'image' }> }) {
  const src = imageUrl(layer.url);
  const ready = useImageReady(src);
  const look: CSSProperties = { backgroundImage: `url(${JSON.stringify(src)})`, backgroundPosition: layer.position };
  return <div className={ready ? 'wk-layer-image is-ready' : 'wk-layer-image'} style={look} />;
}

/**
 * WAS IN EINER SCHICHT LIEGT — bei den Schichten der Luft, die mehr sind als
 * ein Grund: Dunst, Nici, Fale; 2026-10-25 auch das Bild (es blendet ein, sobald es
 * geladen ist). Die anderen malen nur ihren Grund (`layerBackground`).
 */
export function LayerArt({ layer }: { layer: Layer }) {
  const wavesOf = useMemo(() => (layer.kind === 'waves' ? waves(layer) : []), [layer]);
  const meshOf = useMemo(() => (layer.kind === 'mesh' ? meshMotions(layer) : []), [layer]);

  if (layer.kind === 'image') return layer.url === '' ? null : <LayerImage layer={layer} />;

  if (layer.kind === 'haze') {
    const style: CSSProperties = {
      background: `radial-gradient(circle at 30% 40%, ${layerPaint(layer.depth)}, transparent 55%), `
        + `radial-gradient(circle at 70% 35%, color-mix(in srgb, ${layerPaint(layer.depth)} 80%, transparent), transparent 60%), `
        + `linear-gradient(120deg, ${layerPaint(layer.color)}, transparent 45%)`,
      filter: `blur(${layer.blur}px)`,
      opacity: layer.opacity
    };
    return <MotionBox motions={layer.motion} className="wk-air-haze" style={style}><span /></MotionBox>;
  }

  if (layer.kind === 'mesh') {
    return (
      <div className="wk-air-mesh" style={{ opacity: layer.opacity }}>
        {meshOf.map((motions, index) => (
          <MotionBox key={index} motions={motions} className="wk-air-mesh-sheet">
            <MeshCanvas layer={layer} index={index} />
          </MotionBox>
        ))}
      </div>
    );
  }

  if (layer.kind === 'waves') {
    return (
      <div className="wk-air-waves">
        {wavesOf.map((wave, index) => (
          <div key={index} className="wk-air-wave" style={{ bottom: `${wave.bottom}%`, filter: `blur(${wave.blur}px)`, opacity: wave.opacity }}>
            <MotionBox motions={wave.motion} className="wk-air-wave-sway">
              <div className="wk-air-wave-shape" style={{
                background: 'linear-gradient(180deg, rgba(6, 16, 32, 0.45) 0%, rgba(6, 16, 32, 0.2) 45%, rgba(6, 16, 32, 0.3) 70%, rgba(6, 16, 32, 0) 100%), '
                  + `linear-gradient(180deg, transparent 0%, transparent 46%, hsla(${wave.hue}, 60%, 72%, ${(wave.glow * 0.7).toFixed(3)}) 50%, transparent 54%, transparent 100%), `
                  + `linear-gradient(180deg, transparent 0%, transparent 52%, hsla(${wave.hue}, 55%, 68%, ${(wave.glow * 0.5).toFixed(3)}) 56%, transparent 60%, transparent 100%)`
              }} />
            </MotionBox>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default LayerArt;
