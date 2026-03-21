import { useEffect, useMemo, useRef, useState } from 'react';

type LimanowaPointCloudProps = {
  className?: string;
};

const BASE_POINT_COUNT = 1450;
const DESKTOP_POINT_COUNT = 1900;
const POINTER_PARALLAX_STRENGTH = 0.33;
const MASK_MAX_DIMENSION = 640;
const STATE_HEADER_OFFSET = 106;

const MASK_SOURCE_CANDIDATES: string[][] = [
  [
    '/event/limanowa/gray00.png',
    '/event/limanowa/gray00.webp',
    '/event/limanowa/gray00.jpg',
    '/event/limanowa/gray00.jpeg',
    '/event/limanowa/gray-00.png',
    '/event/limanowa/pointcloud-gray-00.png'
  ],
  [
    '/event/limanowa/gray01.png',
    '/event/limanowa/gray01.webp',
    '/event/limanowa/gray01.jpg',
    '/event/limanowa/gray01.jpeg',
    '/event/limanowa/gray-01.png',
    '/event/limanowa/pointcloud-gray-01.png'
  ],
  [
    '/event/limanowa/gray02.png',
    '/event/limanowa/gray02.webp',
    '/event/limanowa/gray02.jpg',
    '/event/limanowa/gray02.jpeg',
    '/event/limanowa/gray-02.png',
    '/event/limanowa/pointcloud-gray-02.png'
  ]
];

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
  { scaleX: 1.62, scaleY: 1.04, depth: 0.58, jitter: 0.09, offsetY: -0.03 },
  { scaleX: 1.48, scaleY: 1.08, depth: 0.62, jitter: 0.08, offsetX: 0.12, offsetY: 0.02 },
  { scaleX: 1.7, scaleY: 1.02, depth: 0.56, jitter: 0.08, offsetY: -0.08 }
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

  for (let i = 0; i < count; i += 1) {
    const pointIndex = i * 3;
    const pick = pointSeeds[i] * mask.totalWeight;
    const sourceIndex = lowerBound(mask.cumulativeWeights, pick);
    const baseX = ((mask.xs[sourceIndex] / Math.max(1, mask.width - 1)) - 0.5) * 2;
    const baseY = (0.5 - (mask.ys[sourceIndex] / Math.max(1, mask.height - 1))) * 2;
    const lum = mask.luminance[sourceIndex];

    const jitterX = (fract(Math.sin((i + 1) * (stateIndex + 2) * 12.9898) * 43758.5453) - 0.5) * options.jitter;
    const jitterY = (fract(Math.sin((i + 1) * (stateIndex + 7) * 78.233) * 24634.6345) - 0.5) * options.jitter;

    state[pointIndex] = baseX * options.scaleX + (options.offsetX ?? 0) + jitterX;
    state[pointIndex + 1] = baseY * options.scaleY + (options.offsetY ?? 0) + jitterY;
    state[pointIndex + 2] = (lum - 0.5) * options.depth + (jitterX - jitterY) * 0.35;
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

function computeSlidePhase(scrollY: number, stateCount: number): { stateIndex: number; rawT: number } {
  const scenes = Array.from(document.querySelectorAll<HTMLElement>('.lim26-scene'));
  const anchors = scenes
    .slice(0, stateCount)
    .map((scene) => Math.max(0, scene.offsetTop - STATE_HEADER_OFFSET))
    .sort((a, b) => a - b);

  if (anchors.length < 2) {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = clamp01(scrollY / maxScroll);
    const span = Math.max(1, stateCount - 1);
    const scaled = progress * span;
    const stateIndex = Math.min(span - 1, Math.floor(scaled));
    return { stateIndex, rawT: scaled - stateIndex };
  }

  if (scrollY <= anchors[0]) {
    return { stateIndex: 0, rawT: 0 };
  }

  const lastAnchor = anchors[anchors.length - 1];
  if (scrollY >= lastAnchor) {
    return { stateIndex: Math.max(0, stateCount - 2), rawT: 1 };
  }

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const start = anchors[i];
    const end = anchors[i + 1];
    if (scrollY >= start && scrollY <= end) {
      const distance = Math.max(1, end - start);
      return {
        stateIndex: i,
        rawT: clamp01((scrollY - start) / distance)
      };
    }
  }

  return { stateIndex: Math.max(0, stateCount - 2), rawT: 1 };
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
        p.x += uParallax.x * 0.35;
        p.y += uParallax.y * 0.35;

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
        float alpha = smoothstep(0.52, 0.08, radius) * 0.74;
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

export function LimanowaPointCloud({ className }: LimanowaPointCloudProps) {
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
    const count = window.innerWidth >= 1200 ? DESKTOP_POINT_COUNT : BASE_POINT_COUNT;
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

      const span = Math.max(1, states.length - 1);
      const phase = computeSlidePhase(window.scrollY, states.length);
      const stateIndex = Math.min(span - 1, phase.stateIndex);
      const rawT = phase.rawT;
      const localT = rawT < 0.8
        ? smoothStep01(rawT / 0.8) * 0.25
        : 0.25 + smoothStep01((rawT - 0.8) / 0.2) * 0.75;

      const from = states[Math.min(stateIndex, states.length - 1)];
      const to = states[Math.min(stateIndex + 1, states.length - 1)];
      for (let i = 0; i < working.length; i += 1) {
        working[i] = from[i] + (to[i] - from[i]) * localT;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, working, gl.DYNAMIC_DRAW);

      gl.uniform2f(parallaxLocation, pointerRef.current.x, pointerRef.current.y);
      gl.uniform1f(pointSizeLocation, width >= 1200 ? 8.4 : 6.8);
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

    const onPointerMove = (event: PointerEvent) => {
      const nx = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      pointerRef.current = {
        x: Math.max(-1, Math.min(1, nx)) * POINTER_PARALLAX_STRENGTH,
        y: Math.max(-1, Math.min(1, -ny)) * POINTER_PARALLAX_STRENGTH
      };
      scheduleDraw();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    draw();

    return () => {
      disposed = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [staticStates, masks]);

  if (fallbackMode) {
    return (
      <div className={`lim26-pointcloud lim26-pointcloud--fallback ${className ?? ''}`.trim()} aria-hidden="true">
        <img src="/event/limanowa/pattern-pointcloud-fallback.svg" alt="" loading="lazy" />
      </div>
    );
  }

  return <canvas ref={canvasRef} className={`lim26-pointcloud ${className ?? ''}`.trim()} aria-hidden="true" />;
}
