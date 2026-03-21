import { useEffect, useMemo, useRef, useState } from 'react';

type LimanowaPointCloudProps = {
  className?: string;
  viewportRef?: { current: HTMLElement | null };
};

const BASE_POINT_COUNT = 12000;
const DESKTOP_POINT_COUNT = 22000;
const LARGE_DESKTOP_POINT_COUNT = 32000;
const POINTER_PARALLAX_STRENGTH = 0.52;
const POINTER_DEAD_ZONE = 0.08;
const POINTER_CURVE_POWER = 1.8;
const POINTER_VERTICAL_RATIO = 0.44;
const MASK_MAX_DIMENSION = 1400;

const MASK_SOURCE_CANDIDATES: string[][] = [
  ['/event/limanowa/gray00.png'],
  ['/event/limanowa/gray01.png'],
  ['/event/limanowa/gray02.png']
];
const STATE_ANCHOR_IDS = ['top', 'o-wydarzeniu', 'gra', 'historia-i-wartosci', 'zapisy'];

type PointMask = {
  width: number;
  height: number;
  xs: Float32Array;
  ys: Float32Array;
  luminance: Float32Array;
  cumulativeWeights: Float32Array;
  totalWeight: number;
};

type MaskStateOptions = {
  scaleX: number;
  scaleY: number;
  depth: number;
  jitter: number;
  offsetX?: number;
  offsetY?: number;
};

const MASK_STATE_OPTIONS: MaskStateOptions[] = [
  { scaleX: 1.9, scaleY: 1.86, depth: 0.22, jitter: 0.014, offsetY: -0.01 },
  { scaleX: 1.78, scaleY: 1.22, depth: 0.24, jitter: 0.014, offsetX: 0.2, offsetY: 0.01 },
  { scaleX: 2.02, scaleY: 1.28, depth: 0.23, jitter: 0.014, offsetY: -0.06 }
];

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function smoothStep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function createLcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function lowerBound(values: Float32Array, target: number): number {
  let low = 0;
  let high = values.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function createPointSeeds(count: number): Float32Array {
  const random = createLcg(20260703);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    seeds[i] = random();
  }
  return seeds;
}

function buildMaskState(count: number, mask: PointMask, options: MaskStateOptions, pointSeeds: Float32Array, stateIndex: number): Float32Array {
  const state = new Float32Array(count * 3);
  const maskAspect = mask.width / Math.max(1, mask.height);

  for (let i = 0; i < count; i += 1) {
    const pointIndex = i * 3;
    const pick = pointSeeds[i] * mask.totalWeight;
    const sourceIndex = lowerBound(mask.cumulativeWeights, pick);
    let baseX = ((mask.xs[sourceIndex] / Math.max(1, mask.width - 1)) - 0.5) * 2;
    let baseY = (0.5 - (mask.ys[sourceIndex] / Math.max(1, mask.height - 1))) * 2;
    const lum = mask.luminance[sourceIndex];

    // Preserve source image proportions so silhouettes are readable.
    if (maskAspect >= 1) {
      baseX *= maskAspect;
    } else {
      baseY /= Math.max(maskAspect, 0.001);
    }

    const jitterX = (fract(Math.sin((i + 1) * (stateIndex + 2) * 12.9898) * 43758.5453) - 0.5) * options.jitter;
    const jitterY = (fract(Math.sin((i + 1) * (stateIndex + 7) * 78.233) * 24634.6345) - 0.5) * options.jitter;

    state[pointIndex] = baseX * options.scaleX + (options.offsetX ?? 0) + jitterX;
    state[pointIndex + 1] = baseY * options.scaleY + (options.offsetY ?? 0) + jitterY;
    state[pointIndex + 2] = (lum - 0.5) * options.depth;
  }

  return state;
}

function createStates(count: number, masks: Array<PointMask | null> | null): Float32Array[] {
  const random = createLcg(20260619);
  const hero = new Float32Array(count * 3);
  const route = new Float32Array(count * 3);
  const network = new Float32Array(count * 3);
  const values = new Float32Array(count * 3);
  const cta = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    const t = i / Math.max(1, count - 1);

    const a = random() * Math.PI * 2;
    const radius = 0.18 + Math.pow(random(), 0.72) * 1.2;
    const height = (random() - 0.5) * 1.6;

    hero[index] = Math.cos(a) * radius;
    hero[index + 1] = height;
    hero[index + 2] = (random() - 0.5) * 1.8;

    const routeX = t * 2.8 - 1.4;
    const routeY = Math.sin(t * Math.PI * 2.1) * 0.28 + (random() - 0.5) * 0.12;
    const routeZ = Math.cos(t * Math.PI * 3.0) * 0.18 + (random() - 0.5) * 0.22;
    route[index] = routeX;
    route[index + 1] = routeY;
    route[index + 2] = routeZ;

    const branchRoot = t < 0.34 ? -0.9 : t < 0.67 ? 0 : 0.9;
    const branchDir = t < 0.34 ? -1 : t < 0.67 ? 0 : 1;
    const along = (t % 0.34) / 0.34;
    network[index] = branchRoot + branchDir * along * 0.75 + (random() - 0.5) * 0.14;
    network[index + 1] = 1.0 - along * 2.0 + (random() - 0.5) * 0.12;
    network[index + 2] = (random() - 0.5) * 0.46;

    const diag = t * 2.0 - 1.0;
    values[index] = diag * 0.95 + (random() - 0.5) * 0.12;
    values[index + 1] = diag * 0.72 + (random() - 0.5) * 0.16;
    values[index + 2] = (0.45 - Math.abs(diag) * 0.45) + (random() - 0.5) * 0.14;

    const arrowArm = t < 0.7 ? t / 0.7 : (t - 0.7) / 0.3;
    cta[index] = -0.95 + arrowArm * (t < 0.7 ? 2.0 : 1.2) + (random() - 0.5) * 0.08;
    cta[index + 1] = t < 0.7
      ? (random() - 0.5) * 0.28
      : (t < 0.85 ? (0.85 - t) * 2.8 : (t - 0.85) * 2.8) + (random() - 0.5) * 0.2;
    cta[index + 2] = (random() - 0.5) * 0.28;
  }

  const states = [hero, route, network, values, cta];

  if (masks) {
    const pointSeeds = createPointSeeds(count);
    for (let i = 0; i < Math.min(3, masks.length); i += 1) {
      const mask = masks[i];
      if (!mask) {
        continue;
      }
      states[i] = buildMaskState(count, mask, MASK_STATE_OPTIONS[i], pointSeeds, i);
    }
  }

  return states;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Nie udało się wczytać obrazu: ${url}`));
    image.src = url;
  });
}

async function loadFirstAvailableImage(urls: string[]): Promise<HTMLImageElement | null> {
  for (const url of urls) {
    try {
      const image = await loadImage(url);
      return image;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function buildMaskFromImage(image: HTMLImageElement): PointMask | null {
  const ratio = Math.min(1, MASK_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height).data;

  const xs: number[] = [];
  const ys: number[] = [];
  const luminance: number[] = [];
  const cumulative: number[] = [];
  let totalWeight = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = imageData[index] / 255;
      const g = imageData[index + 1] / 255;
      const b = imageData[index + 2] / 255;
      const a = imageData[index + 3] / 255;
      const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) * a;
      if (lum < 0.06) {
        continue;
      }

      const weight = Math.pow(lum, 1.65);
      totalWeight += weight;
      xs.push(x);
      ys.push(y);
      luminance.push(lum);
      cumulative.push(totalWeight);
    }
  }

  if (totalWeight <= 0 || xs.length === 0) {
    return null;
  }

  return {
    width,
    height,
    xs: Float32Array.from(xs),
    ys: Float32Array.from(ys),
    luminance: Float32Array.from(luminance),
    cumulativeWeights: Float32Array.from(cumulative),
    totalWeight
  };
}

async function loadMask(urls: string[]): Promise<PointMask | null> {
  const image = await loadFirstAvailableImage(urls);
  if (!image) {
    return null;
  }
  return buildMaskFromImage(image);
}

function computeSlidePhase(
  scrollTop: number,
  stateCount: number,
  viewportHeight: number,
  viewport: HTMLElement | null
): { stateIndex: number; rawT: number } {
  const computeFromAnchors = (anchors: number[]): { stateIndex: number; rawT: number } => {
    if (scrollTop <= anchors[0]) {
      return { stateIndex: 0, rawT: 0 };
    }

    const maxPairIndex = Math.max(0, Math.min(stateCount - 2, anchors.length - 2));
    const transitionBand = Math.max(70, Math.round(viewportHeight * 0.14));
    const transitionTail = Math.round(transitionBand * 0.42);

    for (let pairIndex = 0; pairIndex <= maxPairIndex; pairIndex += 1) {
      const boundary = anchors[pairIndex + 1];
      const transitionStart = boundary - transitionBand;
      const transitionEnd = boundary + transitionTail;

      if (scrollTop < transitionStart) {
        return { stateIndex: pairIndex, rawT: 0 };
      }

      if (scrollTop <= transitionEnd) {
        return {
          stateIndex: pairIndex,
          rawT: clamp01((scrollTop - transitionStart) / Math.max(1, transitionEnd - transitionStart))
        };
      }
    }

    return { stateIndex: maxPairIndex, rawT: 1 };
  };

  const header = document.querySelector<HTMLElement>('.lim26-header');
  const headerOffset = (header?.offsetHeight ?? 0) + 10;
  const anchorElements = STATE_ANCHOR_IDS
    .slice(0, stateCount)
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => Boolean(element));
  const viewportRect = viewport?.getBoundingClientRect() ?? null;
  const anchors = anchorElements
    .map((element) => {
      if (viewport && viewportRect) {
        return Math.max(0, element.getBoundingClientRect().top - viewportRect.top + scrollTop - headerOffset);
      }
      return Math.max(0, element.offsetTop - headerOffset);
    })
    .sort((a, b) => a - b);

  if (anchors.length < 2) {
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('.lim26-scene'));
    const fallbackAnchors = scenes
      .slice(0, stateCount)
      .map((scene) => {
        if (viewport && viewportRect) {
          return Math.max(0, scene.getBoundingClientRect().top - viewportRect.top + scrollTop - headerOffset);
        }
        return Math.max(0, scene.offsetTop - headerOffset);
      })
      .sort((a, b) => a - b);
    if (fallbackAnchors.length >= 2) {
      return computeFromAnchors(fallbackAnchors);
    }

    const maxScroll = viewport
      ? Math.max(1, viewport.scrollHeight - viewportHeight)
      : Math.max(1, document.documentElement.scrollHeight - viewportHeight);
    const progress = clamp01(scrollTop / maxScroll);
    const span = Math.max(1, stateCount - 1);
    const scaled = progress * span;
    const stateIndex = Math.min(span - 1, Math.floor(scaled));
    return { stateIndex, rawT: scaled - stateIndex };
  }

  return computeFromAnchors(anchors);
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Nie udało się utworzyć shadera.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Brak szczegółów.';
    gl.deleteShader(shader);
    throw new Error(`Błąd kompilacji shadera: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec3 aPosition;
      uniform vec2 uParallax;
      uniform float uPointSize;

      void main() {
        vec3 p = aPosition;
        float depthNorm = clamp((p.z + 0.35) / 0.7, 0.0, 1.0);
        float depthParallax = mix(0.72, 1.48, depthNorm);
        p.x += uParallax.x * 0.34 * depthParallax;
        p.y += uParallax.y * 0.26 * depthParallax;

        float z = p.z + 3.2;
        float x = p.x / z;
        float y = p.y / z;

        gl_Position = vec4(x, y, 0.0, 1.0);
        gl_PointSize = max(1.6, uPointSize / z);
      }
    `
  );
  const fragment = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform vec3 uColorA;
      uniform vec3 uColorB;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5, 0.5);
        float radius = length(center);
        float alpha = smoothstep(0.52, 0.08, radius) * 0.88;
        vec3 color = mix(uColorA, uColorB, gl_PointCoord.y);
        gl_FragColor = vec4(color, alpha);
      }
    `
  );

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Nie udało się utworzyć programu WebGL.');
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Brak szczegółów.';
    gl.deleteProgram(program);
    throw new Error(`Błąd linkowania programu WebGL: ${log}`);
  }

  return program;
}

export function LimanowaPointCloud({ className, viewportRef }: LimanowaPointCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [masks, setMasks] = useState<Array<PointMask | null> | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const staticStates = useMemo(() => createStates(BASE_POINT_COUNT, masks), [masks]);

  useEffect(() => {
    let active = true;

    Promise.all(MASK_SOURCE_CANDIDATES.map((candidateGroup) => loadMask(candidateGroup)))
      .then((loadedMasks) => {
        if (!active) {
          return;
        }
        setMasks(loadedMasks);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setMasks(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowPower = window.innerWidth <= 860;
    if (reducedMotion || lowPower) {
      setFallbackMode(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      premultipliedAlpha: true
    });

    if (!gl) {
      setFallbackMode(true);
      return;
    }

    let disposed = false;
    const count = window.innerWidth >= 1720
      ? LARGE_DESKTOP_POINT_COUNT
      : window.innerWidth >= 1200
        ? DESKTOP_POINT_COUNT
        : BASE_POINT_COUNT;
    const states = count === BASE_POINT_COUNT ? staticStates : createStates(count, masks);
    const working = new Float32Array(count * 3);

    const program = createProgram(gl);
    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const parallaxLocation = gl.getUniformLocation(program, 'uParallax');
    const pointSizeLocation = gl.getUniformLocation(program, 'uPointSize');
    const colorALocation = gl.getUniformLocation(program, 'uColorA');
    const colorBLocation = gl.getUniformLocation(program, 'uColorB');

    const buffer = gl.createBuffer();
    if (!buffer || positionLocation < 0 || !parallaxLocation || !pointSizeLocation || !colorALocation || !colorBLocation) {
      setFallbackMode(true);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const scheduleDraw = () => {
      if (rafRef.current !== null || disposed) {
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        draw();
      });
    };

    const scrollContainer = viewportRef?.current ?? document.querySelector<HTMLElement>('.lim26-slide-viewport');

    const draw = () => {
      if (disposed) {
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const currentViewport = viewportRef?.current ?? scrollContainer ?? null;
      const viewportHeight = currentViewport?.clientHeight ?? window.innerHeight;
      const scrollTop = currentViewport ? currentViewport.scrollTop : window.scrollY;
      const span = Math.max(1, states.length - 1);
      const phase = computeSlidePhase(scrollTop, states.length, viewportHeight, currentViewport);
      const stateIndex = Math.min(span - 1, phase.stateIndex);
      const rawT = phase.rawT;
      const localT = rawT < 0.56
        ? smoothStep01(rawT / 0.56) * 0.12
        : 0.12 + smoothStep01((rawT - 0.56) / 0.44) * 0.88;

      const from = states[Math.min(stateIndex, states.length - 1)];
      const to = states[Math.min(stateIndex + 1, states.length - 1)];
      for (let i = 0; i < working.length; i += 1) {
        working[i] = from[i] + (to[i] - from[i]) * localT;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, working, gl.DYNAMIC_DRAW);

      gl.uniform2f(parallaxLocation, pointerRef.current.x, pointerRef.current.y);
      gl.uniform1f(pointSizeLocation, width >= 1200 ? 6.1 : 5.3);
      gl.uniform3f(colorALocation, 0.46, 0.51, 0.39);
      gl.uniform3f(colorBLocation, 0.82, 0.74, 0.61);

      gl.drawArrays(gl.POINTS, 0, count);
    };

    const onResize = () => {
      scheduleDraw();
    };

    const onScroll = () => {
      scheduleDraw();
    };

    const axisResponse = (value: number) => {
      const limited = Math.max(-1, Math.min(1, value));
      const magnitude = Math.abs(limited);
      if (magnitude <= POINTER_DEAD_ZONE) {
        return 0;
      }
      const normalized = (magnitude - POINTER_DEAD_ZONE) / Math.max(0.001, 1 - POINTER_DEAD_ZONE);
      const curved = Math.pow(Math.max(0, Math.min(1, normalized)), POINTER_CURVE_POWER);
      return Math.sign(limited) * curved;
    };

    const onPointerMove = (event: PointerEvent) => {
      const nx = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      const xResponse = axisResponse(nx);
      const yResponse = axisResponse(-ny);

      pointerRef.current = {
        x: xResponse * POINTER_PARALLAX_STRENGTH,
        y: yResponse * POINTER_PARALLAX_STRENGTH * POINTER_VERTICAL_RATIO
      };
      scheduleDraw();
    };

    const onPointerLeave = () => {
      pointerRef.current = { x: 0, y: 0 };
      scheduleDraw();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    draw();

    return () => {
      disposed = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [staticStates, masks, viewportRef]);

  if (fallbackMode) {
    return (
      <div className={`lim26-pointcloud lim26-pointcloud--fallback ${className ?? ''}`.trim()} aria-hidden="true">
        <img src="/event/limanowa/pattern-pointcloud-fallback.svg" alt="" loading="lazy" />
      </div>
    );
  }

  return <canvas ref={canvasRef} className={`lim26-pointcloud ${className ?? ''}`.trim()} aria-hidden="true" />;
}
