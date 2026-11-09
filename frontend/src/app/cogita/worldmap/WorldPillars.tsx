/**
 * 2026-11-09 — DIE WELTKARTE ZEICHNEN (spec §4): Canvas 2D, orthografisch, mit der Kamera der Landschaft (`WorldCam`: Mitte,
 * Zoom, Drehung, Neigung) — stufenlos drehbar (Regler, Umschalt+Ziehen, zwei Finger), Neigung 25°–88°, die Mitte des Bildes
 * bleibt beim Drehen und Neigen stehen.
 * <code>
 *   Boden    Insel, Scheiben der Blöcke, Gleise mit ihren Spuren, Pfeile, Schlösser, Tore, Umsteigeringe, das Haus — EINMAL je
 *            Stand in ein Bild gerastert (Weltkoordinaten) und je Bild mit einer affinen Abbildung gezeichnet
 *   Säulen   von hinten nach vorn; Farbe = Thema, der Stand nur als Sättigung; Höhe = was fehlt; Stufen als Bögen am Rand;
 *            der Punkt der Kenntnis nur auf eroberten; was fern ist, wird blasser — nie durchsichtig
 *   Namen    nur nah: sichtbar, wenn r_px > 24 + 0,32 · h_px; nie übereinander, die niedrigere Säule gewinnt
 * </code>
 * Bekommt fertige Daten (`wmScene.ts`); rechnet nichts am Modell.
 */

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';

import type { T } from '../../core/i18n';
import { placeLabels, type LabelCandidate, type WorldCam } from '../worldView';
import { mix, rgbCss, type Rgb } from './wmColors';
import type { LockSymbol } from './wmConditions';
import { showsName, type Scene, type SceneLane } from './wmScene';
import { pillarHeight } from './wmState';

/** Neigung als Stauchung des Bodens: sin(25°) bis sin(88°). */
export const FORE_LOW = Math.sin((25 * Math.PI) / 180);
export const FORE_HIGH = Math.sin((88 * Math.PI) / 180);
const FORE_FIRST = Math.sin((50 * Math.PI) / 180);
/** Ab diesem Zoom (Bildpunkte je Einheit) sind Vertiefungen zu sehen. */
const DEEP_FROM = 0.32;

export interface PillarsHandle {
  /** Die ganze Welt ins Bild. */
  fit(): void;
  /** Zu einem Ort fliegen. */
  focus(place: string): void;
  /** Für Messungen: die Kamera drehen (Grad) und neu zeichnen. */
  rotate(deg: number): void;
  readonly frames: { count: number; ms: number[] };
}

export interface PillarsProps {
  readonly scene: Scene;
  /** Breite der gezeichneten Säulen (0,4–1 des vollen Radius) — nur neu zeichnen. */
  readonly pillarWidth: number;
  /** Alle Höhen 0–1. */
  readonly heightScale: number;
  /** Die Abschnitte eines Weges, der leuchten soll (die Blase, die Navigation). */
  readonly route?: readonly string[] | null;
  /** Spätere Schritte nur blass (die Navigation, §8.3). */
  readonly faint?: readonly string[] | null;
  readonly chosen?: string | null;
  /** Die Navigation auf der Karte (§8.3): ein Wimpel am jetzigen Schritt, eine Fahne am Ziel, Gabeln, wo man abbiegen kann. */
  readonly marks?: { readonly start: string | null; readonly target: string | null; readonly forks: readonly string[] } | null;
  readonly memoryKey: string;
  readonly t: T;
  readonly onHover?: (place: string | null, at: { x: number; y: number } | null) => void;
  readonly onPick?: (place: string | null) => void;
  readonly onPickLane?: (section: string) => void;
  readonly onPickHome?: () => void;
  readonly compact?: boolean;
}

interface Palette {
  readonly floor: Rgb;
  readonly floorDeep: Rgb;
  readonly surface: Rgb;
  readonly ink: Rgb;
  readonly haze: Rgb;
  readonly lit: Rgb;
  readonly casing: Rgb;
  readonly dark: boolean;
}

const parse = (v: string): Rgb => {
  const s = v.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m !== null) { const p = m[1].split(/[ ,/]+/).map(Number); return [p[0] ?? 128, p[1] ?? 128, p[2] ?? 128]; }
  return [128, 128, 128];
};

function readPalette(el: HTMLElement): Palette {
  const probe = document.createElement('span');
  el.appendChild(probe);
  const cs = getComputedStyle(el);
  const get = (name: string, fallback: string): Rgb => {
    const raw = cs.getPropertyValue(name).trim();
    probe.style.color = raw === '' ? fallback : raw;
    return parse(getComputedStyle(probe).color);
  };
  const surface = get('--wk-surface', '#ffffff');
  const floor = get('--cg-ls-floor', '#f3f0ea');
  const ink = get('--wk-ink', '#222222');
  probe.remove();
  const dark = (surface[0] + surface[1] + surface[2]) / 3 < 110;
  return {
    floor, surface, ink, dark,
    floorDeep: mix(floor, ink, dark ? 0.16 : 0.1),
    haze: mix(surface, floor, 0.5),
    lit: parse(cs.getPropertyValue('--cg-ls-route').trim() || '#b07800'),
    casing: mix(floor, ink, dark ? 0.24 : 0.14)
  };
}

const camKey = (k: string) => `cg-wm2-cam:${k}`;
function keptCam(k: string): WorldCam | null {
  try {
    const raw = localStorage.getItem(camKey(k));
    if (raw === null) return null;
    const c = JSON.parse(raw) as WorldCam;
    return [c.s, c.cx, c.cy, c.rot, c.fore].every((v) => typeof v === 'number' && Number.isFinite(v)) ? c : null;
  } catch { return null; }
}
function keepCam(k: string, c: WorldCam): void { try { localStorage.setItem(camKey(k), JSON.stringify(c)); } catch { /* ohne Speicher */ } }

/** Die Abbildung: Boden (x, y, Höhe z) → Schirm. */
interface View { readonly ca: number; readonly sa: number; readonly fore: number; readonly lift: number; readonly s: number; readonly ox: number; readonly oy: number; readonly cx: number; readonly cy: number }
const viewOf = (c: WorldCam, w: number, h: number): View => {
  const a = (c.rot * Math.PI) / 180;
  const fore = Math.max(FORE_LOW, Math.min(FORE_HIGH, c.fore));
  return { ca: Math.cos(a), sa: Math.sin(a), fore, lift: Math.sqrt(Math.max(0, 1 - fore * fore)), s: c.s, ox: w / 2, oy: h / 2, cx: c.cx, cy: c.cy };
};
const toScr = (v: View, x: number, y: number, z = 0): [number, number] => {
  const dx = x - v.cx, dy = y - v.cy;
  return [v.ox + (dx * v.ca - dy * v.sa) * v.s, v.oy - (dx * v.sa + dy * v.ca) * v.fore * v.s - z * v.lift * v.s];
};
const toGrd = (v: View, sx: number, sy: number): [number, number] => {
  const rx = (sx - v.ox) / v.s, ry = -(sy - v.oy) / (v.fore * v.s);
  return [v.cx + rx * v.ca + ry * v.sa, v.cy - rx * v.sa + ry * v.ca];
};
const depth = (v: View, x: number, y: number) => -(x * v.sa + y * v.ca);

/** Ein Punkt in `t` (0–1) entlang einer Linie, mit ihrer Richtung. */
function along(p: readonly number[], t: number): { x: number; y: number; a: number } {
  let total = 0;
  for (let i = 2; i < p.length; i += 2) total += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  let want = total * t;
  for (let i = 2; i < p.length; i += 2) {
    const seg = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    if (want <= seg || i === p.length - 2) {
      const k = seg === 0 ? 0 : Math.min(1, want / seg);
      return { x: p[i - 2] + (p[i] - p[i - 2]) * k, y: p[i - 1] + (p[i + 1] - p[i - 1]) * k, a: Math.atan2(p[i + 1] - p[i - 1], p[i] - p[i - 2]) };
    }
    want -= seg;
  }
  return { x: p[0] ?? 0, y: p[1] ?? 0, a: 0 };
}

/** Das Schloss nach dem Typ der fehlenden Bedingung (§4.4, §10.3) — klein, in Bodeneinheiten. */
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, symbol: LockSymbol, colour: string, bg: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, size * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = size * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const s = size * 0.62;
  switch (symbol) {
    case 'review':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.8, -Math.PI * 0.2, Math.PI * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.75, -s * 0.75); ctx.lineTo(s * 0.68, -s * 0.05); ctx.lineTo(s * 0.05, -s * 0.35); ctx.stroke();
      break;
    case 'story':
      ctx.strokeRect(-s * 0.8, -s * 0.65, s * 1.6, s * 1.3); ctx.beginPath(); ctx.moveTo(0, -s * 0.65); ctx.lineTo(0, s * 0.65); ctx.stroke();
      break;
    case 'value':
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, 0); ctx.closePath(); ctx.fill();
      break;
    case 'time':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, 0); ctx.lineTo(s * 0.4, s * 0.2); ctx.stroke();
      break;
    case 'place':
      ctx.beginPath(); ctx.arc(0, -s * 0.25, s * 0.5, Math.PI, 0); ctx.lineTo(0, s * 0.9); ctx.closePath(); ctx.fill();
      break;
    case 'unknown':
      ctx.beginPath(); ctx.arc(0, -s * 0.25, s * 0.42, Math.PI * 1.1, Math.PI * 0.35); ctx.lineTo(0, s * 0.25); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, s * 0.72, s * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.42, Math.PI, 0); ctx.stroke();
      ctx.fillRect(-s * 0.62, -s * 0.15, s * 1.24, s * 0.95);
  }
  ctx.restore();
}

interface GroundLayer {
  readonly canvas: HTMLCanvasElement;
  /** Bildpunkte je Einheit. */
  readonly k: number;
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly stamp: string;
  readonly deep: boolean;
}

const DOT: Readonly<Record<'green' | 'yellow' | 'orange', string>> = { green: '#2f9e57', yellow: '#d9ad12', orange: '#e2701b' };
const HOME_MARK = '~home';

/** Eine Fahne (das Ziel) oder ein Wimpel (der jetzige Schritt) auf einer Säule — Schirmpunkte, deckend. */
function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette, colour: string, pennant = false): void {
  const h = 26;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgbCss(pal.surface); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.strokeStyle = rgbCss(pal.ink); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.beginPath();
  if (pennant) { ctx.moveTo(x + 1, y - h); ctx.lineTo(x + 13, y - h + 5); ctx.lineTo(x + 1, y - h + 10); }
  else { ctx.moveTo(x + 1, y - h); ctx.lineTo(x + 15, y - h); ctx.lineTo(x + 11, y - h + 5.5); ctx.lineTo(x + 15, y - h + 11); ctx.lineTo(x + 1, y - h + 11); }
  ctx.closePath();
  ctx.fillStyle = colour; ctx.fill();
  ctx.strokeStyle = rgbCss(pal.surface); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

/** Das Gabelzeichen an einem Umsteigeort, an dem man abbiegen kann (§8.3). */
function drawFork(ctx: CanvasRenderingContext2D, x: number, y: number, pal: Palette): void {
  ctx.save();
  ctx.fillStyle = rgbCss(pal.surface);
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgbCss(pal.lit); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = rgbCss(pal.ink); ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 4.5); ctx.lineTo(x, y); ctx.lineTo(x - 3.8, y - 4); ctx.moveTo(x, y); ctx.lineTo(x + 3.8, y - 4); ctx.stroke();
  ctx.restore();
}

export const WorldPillars = forwardRef<PillarsHandle, PillarsProps>(function WorldPillars(props, ref) {
  const { scene, pillarWidth, heightScale, route = null, faint = null, chosen = null, marks = null, memoryKey, t, onHover, onPick, onPickLane, onPickHome, compact = false } = props;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [palette, setPalette] = useState<Palette | null>(null);
  const fitCam = useCallback((w: number, h: number, rot = -20, fore = FORE_FIRST): WorldCam => {
    const e = scene.extent;
    const s = Math.max(0.02, Math.min((w - 24) / (2 * e.radius), (h - 24) / (2 * e.radius * fore + e.radius * 0.3)));
    return { s, cx: e.cx, cy: e.cy, rot, fore };
  }, [scene.extent]);
  const camRef = useRef<WorldCam | null>(keptCam(memoryKey));
  const groundRef = useRef<GroundLayer | null>(null);
  const drawnRef = useRef<{ id: string; x: number; top: number; bottom: number; rx: number; ry: number }[]>([]);
  const frames = useRef<{ count: number; ms: number[] }>({ count: 0, ms: [] });
  const raf = useRef(0);
  const settle = useRef(0);
  const [cam, setCamState] = useState<WorldCam | null>(camRef.current);

  /* Grösse und Farben (hell / dunkel). */
  useEffect(() => {
    const el = boxRef.current;
    if (el === null) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const repaint = () => { if (canvasRef.current !== null) { setPalette(readPalette(canvasRef.current)); groundRef.current = null; } };
    repaint();
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode', 'data-scheme', 'class', 'style'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', repaint);
    return () => { ro.disconnect(); mo.disconnect(); mq?.removeEventListener?.('change', repaint); };
  }, []);

  const setCam = useCallback((c: WorldCam) => {
    const next = { ...c, fore: Math.max(FORE_LOW, Math.min(FORE_HIGH, c.fore)), s: Math.max(0.01, Math.min(40, c.s)) };
    camRef.current = next;
    setCamState(next);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => keepCam(memoryKey, next), 300);
  }, [memoryKey]);

  useEffect(() => {
    if (size.w === 0 || camRef.current !== null) return;
    setCam(fitCam(size.w, size.h));
  }, [size, fitCam, setCam]);

  /* Der Boden: einmal je Stand, Breite, Farben und Ausschnitt gerastert. */
  const stampOf = useMemo(() => `${scene.lanes.length}:${scene.places.length}:${pillarWidth.toFixed(3)}`, [scene, pillarWidth]);
  const sceneId = useRef(0);
  const lastScene = useRef<Scene | null>(null);
  if (lastScene.current !== scene) { lastScene.current = scene; sceneId.current += 1; groundRef.current = null; }

  const rasterGround = (v: View, w: number, h: number, pal: Palette): GroundLayer | null => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const deep = v.s >= DEEP_FROM;
    /* Ein Quadrat um die Mitte, das jede Drehung deckt; nie grösser als die Welt. */
    const half = Math.hypot(w, h) / (2 * v.s * v.fore) + 40;
    const e = scene.extent;
    const x0 = Math.max(e.cx - e.radius - 80, v.cx - half), x1 = Math.min(e.cx + e.radius + 80, v.cx + half);
    const y0 = Math.max(e.cy - e.radius - 80, v.cy - half), y1 = Math.min(e.cy + e.radius + 80, v.cy + half);
    if (x1 <= x0 || y1 <= y0) return null;
    const k = Math.min(v.s * dpr, 6000 / Math.max(x1 - x0, y1 - y0));
    const cw = Math.max(1, Math.ceil((x1 - x0) * k)), ch = Math.max(1, Math.ceil((y1 - y0) * k));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const g = canvas.getContext('2d');
    if (g === null) return null;
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    const px = 1 / v.s;
    /* Die Insel. */
    g.fillStyle = rgbCss(pal.floor);
    g.beginPath(); g.arc(e.cx, e.cy, e.radius + 70, 0, Math.PI * 2); g.fill();
    /* Scheiben der Blöcke, knapp über dem Boden. */
    for (const b of scene.blocks) {
      g.fillStyle = rgbCss(pal.floorDeep);
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgbCss(pal.casing); g.lineWidth = 2 * px; g.stroke();
    }
    /* Gleise: das Bett unter den Spuren. */
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const tr of scene.tracks) {
      g.strokeStyle = rgbCss(pal.casing);
      g.lineWidth = Math.max(8, 8 + 5 * (tr.lanes - 1)) * (deep ? 1 : 0.8);
      g.beginPath();
      for (let i = 0; i < tr.points.length; i += 2) { if (i === 0) g.moveTo(tr.points[0], tr.points[1]); else g.lineTo(tr.points[i], tr.points[i + 1]); }
      g.stroke();
    }
    /* Die Spuren: befahren voll, offen etwas gedämpft, gesperrt gestrichelt und blass. */
    for (const lane of scene.lanes) {
      if (lane.deep && !deep) continue;
      const pts = withRims(lane, pillarWidth);
      const colour = lane.state === 'travelled' ? lane.color : lane.state === 'open' ? mix(lane.color, pal.floor, 0.2) : mix(lane.color, pal.floor, 0.55);
      g.strokeStyle = rgbCss(colour);
      g.lineWidth = (lane.state === 'travelled' ? 3.4 : lane.state === 'open' ? 2.4 : 2) * px;
      g.setLineDash(lane.state === 'locked' ? [6 * px, 5 * px] : []);
      g.beginPath();
      for (let i = 0; i < pts.length; i += 2) { if (i === 0) g.moveTo(pts[0], pts[1]); else g.lineTo(pts[i], pts[i + 1]); }
      g.stroke();
      g.setLineDash([]);
      /* Die Richtung in der Mitte jedes Abschnitts. */
      const m = along(pts, 0.55);
      const al = 4.5 * px;
      g.beginPath();
      g.moveTo(m.x - Math.cos(m.a) * al - Math.sin(m.a) * al, m.y - Math.sin(m.a) * al + Math.cos(m.a) * al);
      g.lineTo(m.x + Math.cos(m.a) * al * 0.8, m.y + Math.sin(m.a) * al * 0.8);
      g.lineTo(m.x - Math.cos(m.a) * al + Math.sin(m.a) * al, m.y - Math.sin(m.a) * al - Math.cos(m.a) * al);
      g.lineWidth = 1.8 * px;
      g.strokeStyle = rgbCss(lane.state === 'locked' ? mix(lane.color, pal.floor, 0.4) : lane.color);
      g.stroke();
      if (lane.state === 'locked' && lane.symbol !== null) {
        const at = along(pts, 0.2);
        drawLock(g, at.x, at.y, 5.5 * px, lane.symbol, rgbCss(lane.color), rgbCss(pal.floor));
      }
    }
    /* Tore: kleine Quadrate am gezeichneten Rand. */
    g.fillStyle = rgbCss(pal.casing);
    for (const lane of scene.lanes) {
      if (lane.deep && !deep) continue;
      const pts = withRims(lane, pillarWidth);
      for (const [x, y] of [[pts[0], pts[1]], [pts[pts.length - 2], pts[pts.length - 1]]]) g.fillRect(x - 2.6 * px, y - 2.6 * px, 5.2 * px, 5.2 * px);
    }
    /* Umsteigeorte: ein Ring auf dem Boden. */
    g.strokeStyle = rgbCss(mix(pal.ink, pal.floor, 0.45));
    g.lineWidth = 1.6 * px;
    for (const p of scene.places) {
      if (!p.station) continue;
      g.beginPath(); g.arc(p.x, p.y, p.r * pillarWidth + 7, 0, Math.PI * 2); g.stroke();
    }
    /* Das Haus: eine runde Platte. */
    if (scene.home !== null) {
      const hm = scene.home;
      g.fillStyle = rgbCss(pal.floorDeep);
      g.beginPath(); g.arc(hm.x, hm.y, hm.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgbCss(pal.casing); g.lineWidth = 2 * px; g.stroke();
    }
    return { canvas, k, x0, y0, w: cw, h: ch, stamp: `${sceneId.current}:${stampOf}:${pal.dark ? 'd' : 'l'}`, deep };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const c = camRef.current;
    const pal = palette;
    if (canvas === null || c === null || pal === null || size.w === 0) return;
    const t0 = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(size.w * dpr) || canvas.height !== Math.round(size.h * dpr)) { canvas.width = Math.round(size.w * dpr); canvas.height = Math.round(size.h * dpr); }
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const v = viewOf(c, size.w, size.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = rgbCss(pal.surface);
    ctx.fillRect(0, 0, size.w, size.h);

    /* Der Boden: neu, wenn er nicht mehr deckt, zu grob ist oder der Stand sich änderte. */
    let gl = groundRef.current;
    const stamp = `${sceneId.current}:${stampOf}:${pal.dark ? 'd' : 'l'}`;
    const need = (layer: GroundLayer | null): boolean => {
      if (layer === null || layer.stamp !== stamp || layer.deep !== (v.s >= DEEP_FROM)) return true;
      const half = Math.hypot(size.w, size.h) / (2 * v.s * v.fore);
      const e = scene.extent;
      const wantX0 = Math.max(e.cx - e.radius - 80, v.cx - half), wantX1 = Math.min(e.cx + e.radius + 80, v.cx + half);
      const wantY0 = Math.max(e.cy - e.radius - 80, v.cy - half), wantY1 = Math.min(e.cy + e.radius + 80, v.cy + half);
      const covers = wantX0 >= layer.x0 - 1 && wantY0 >= layer.y0 - 1 && wantX1 <= layer.x0 + layer.w / layer.k + 1 && wantY1 <= layer.y0 + layer.h / layer.k + 1;
      return !covers || layer.k < v.s * dpr * 0.45;
    };
    if (need(gl)) { gl = rasterGround(v, size.w, size.h, pal); groundRef.current = gl; }
    if (gl !== null) {
      /* Weltpunkt (u/k + x0, v/k + y0) → Schirm: eine affine Abbildung. */
      const a = (v.s * v.ca) / gl.k, cc = (-v.s * v.sa) / gl.k;
      const b = (-v.s * v.fore * v.sa) / gl.k, d = (-v.s * v.fore * v.ca) / gl.k;
      const dx = gl.x0 - v.cx, dy = gl.y0 - v.cy;
      const e = v.ox + v.s * (v.ca * dx - v.sa * dy), f = v.oy - v.s * v.fore * (v.sa * dx + v.ca * dy);
      ctx.setTransform(a * dpr, b * dpr, cc * dpr, d * dpr, e * dpr, f * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(gl.canvas, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Ein Weg leuchtet (Blase, Navigation): breit unter den Säulen. */
    const glowLanes = (ids: readonly string[] | null, strong: boolean) => {
      if (ids === null || ids.length === 0) return;
      const set = new Set(ids);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const lane of scene.lanes) {
        if (!set.has(lane.section)) continue;
        ctx.strokeStyle = rgbCss(strong ? pal.lit : mix(pal.lit, pal.floor, 0.55));
        ctx.globalAlpha = 1;
        ctx.lineWidth = strong ? 7 : 3;
        ctx.beginPath();
        for (let i = 0; i < lane.points.length; i += 2) { const [sx, sy] = toScr(v, lane.points[i], lane.points[i + 1]); if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); }
        ctx.stroke();
        ctx.strokeStyle = rgbCss(lane.color);
        ctx.lineWidth = strong ? 3 : 1.6;
        ctx.stroke();
      }
    };
    glowLanes(faint, false);
    glowLanes(route, true);

    /* Säulen von hinten nach vorn. */
    const list = scene.places.map((p) => ({ p, d: depth(v, p.x, p.y) })).sort((x, y) => x.d - y.d);
    let dmin = Infinity, dmax = -Infinity;
    for (const it of list) { dmin = Math.min(dmin, it.d); dmax = Math.max(dmax, it.d); }
    const drawn: { id: string; x: number; top: number; bottom: number; rx: number; ry: number }[] = [];
    const labels: LabelCandidate[] = [];
    for (const { p, d: dp } of list) {
      const [X, Yb] = toScr(v, p.x, p.y, 0);
      const rx = p.r * pillarWidth * v.s, ry = rx * v.fore;
      if (X + rx < -40 || X - rx > size.w + 40 || Yb + ry < -40) continue;
      const hWorld = pillarHeight(p.missing, p.conquered) * heightScale;
      const Yt = Yb - hWorld * v.lift * v.s - (p.conquered ? 1.5 * v.lift * v.s : 0);
      if (Yt - ry > size.h + 40) continue;
      /* Die Farbe: Thema; der Stand nur als Sättigung; fern blasser, nie durchsichtig. */
      const satMix = p.sat === 'never' ? 0.65 : p.sat === 'partly' ? 0.35 : 0;
      const far = dmax > dmin ? (dmax - dp) / (dmax - dmin) : 0;
      const base = mix(mix(p.color, pal.floor, satMix), pal.haze, far * 0.32);
      const top = mix(base, pal.dark ? pal.ink : pal.surface, 0.12);
      const side = mix(base, pal.dark ? pal.surface : pal.ink, 0.2);
      if (hWorld > 0.5) {
        ctx.beginPath();
        ctx.moveTo(X - rx, Yt);
        ctx.lineTo(X - rx, Yb);
        ctx.ellipse(X, Yb, rx, ry, 0, Math.PI, 0, true);
        ctx.lineTo(X + rx, Yt);
        ctx.ellipse(X, Yt, rx, ry, 0, 0, Math.PI, true);
        ctx.closePath();
        if (rx > 7) {
          const gr = ctx.createLinearGradient(X - rx, 0, X + rx, 0);
          gr.addColorStop(0, rgbCss(mix(side, pal.ink, 0.18)));
          gr.addColorStop(0.38, rgbCss(mix(side, pal.surface, 0.1)));
          gr.addColorStop(1, rgbCss(mix(side, pal.ink, 0.28)));
          ctx.fillStyle = gr;
        } else ctx.fillStyle = rgbCss(side);
        ctx.fill();
      }
      ctx.fillStyle = rgbCss(top);
      ctx.beginPath(); ctx.ellipse(X, Yt, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      if (chosen === p.id) { ctx.strokeStyle = rgbCss(pal.lit); ctx.lineWidth = 2.5; ctx.stroke(); }
      /* Die Stufen: der obere Rand in gleich grosse Bögen; erreicht leuchtet. */
      if (p.levels > 0 && rx > 3.5) {
        const gap = Math.min(0.12, Math.PI / (p.levels * 6));
        for (let i = 0; i < p.levels; i += 1) {
          const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / p.levels + gap, a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / p.levels - gap;
          ctx.beginPath(); ctx.ellipse(X, Yt, rx * 0.93, ry * 0.93, 0, a0, a1);
          ctx.strokeStyle = rgbCss(i < p.level ? pal.lit : mix(side, pal.ink, 0.25));
          ctx.lineWidth = Math.max(1.4, Math.min(3, rx * 0.12));
          ctx.stroke();
        }
      }
      /* Der Punkt der Kenntnis — nur auf eroberten Orten. */
      if (p.dot !== null && rx > 3) {
        ctx.fillStyle = DOT[p.dot];
        ctx.beginPath(); ctx.ellipse(X, Yt, Math.max(2.2, rx * 0.2), Math.max(2.2, rx * 0.2) * v.fore, 0, 0, Math.PI * 2); ctx.fill();
      }
      drawn.push({ id: p.id, x: X, top: Yt, bottom: Yb, rx, ry });
      const hPx = Yb - Yt;
      if (showsName(rx, hPx)) {
        const text = p.label.length > 42 ? `${p.label.slice(0, 40)}…` : p.label;
        const w = Math.min(rx * 2.4, 8 + text.length * 6.4);
        labels.push({ key: p.id, text, x: X, y: Yt - ry - 9, w, h: 16, weight: -hPx, alpha: 1 });
      }
    }
    /* Das Haus: ein Zeichen auf seiner Platte, „Start". */
    if (scene.home !== null) {
      const [hx, hy] = toScr(v, scene.home.x, scene.home.y, 0);
      const s = Math.max(6, Math.min(16, scene.home.r * v.s * 0.55));
      ctx.fillStyle = rgbCss(pal.ink);
      ctx.beginPath(); ctx.moveTo(hx - s, hy); ctx.lineTo(hx - s, hy - s * 0.9); ctx.lineTo(hx, hy - s * 1.7); ctx.lineTo(hx + s, hy - s * 0.9); ctx.lineTo(hx + s, hy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgbCss(pal.floorDeep); ctx.fillRect(hx - s * 0.25, hy - s * 0.7, s * 0.5, s * 0.7);
      ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 3; ctx.strokeStyle = rgbCss(pal.surface); ctx.strokeText(t('cogitaWorld.map.start'), hx, hy + 4);
      ctx.fillStyle = rgbCss(pal.ink); ctx.fillText(t('cogitaWorld.map.start'), hx, hy + 4);
    }
    /* Die Navigation (§8.3): Gabeln am Ring, die Fahne am Ziel, der Wimpel am jetzigen Schritt („Tu zacznij"). */
    if (marks !== null) {
      const topOf = (id: string): [number, number] | null => {
        if (id === HOME_MARK && scene.home !== null) { const [hx, hy] = toScr(v, scene.home.x, scene.home.y, 0); return [hx, hy - Math.max(6, Math.min(16, scene.home.r * v.s * 0.55)) * 1.7]; }
        const d = drawn.find((x) => x.id === id);
        if (d !== undefined) return [d.x, d.top];
        const p = scene.byId.get(id);
        if (p === undefined) return null;
        const [x, y] = toScr(v, p.x, p.y, 0);
        return [x, y];
      };
      for (const id of marks.forks) {
        const p = scene.byId.get(id);
        const r = p === undefined ? (scene.home?.r ?? 0) : p.r * pillarWidth + 7;
        const at = p ?? scene.home;
        if (at === null || at === undefined) continue;
        const [fx, fy] = toScr(v, at.x + r * 0.71, at.y - r * 0.71, 0);
        drawFork(ctx, fx, fy, pal);
      }
      if (marks.target !== null) { const at = topOf(marks.target); if (at !== null) drawFlag(ctx, at[0], at[1], pal, rgbCss(pal.lit)); }
      if (marks.start !== null && marks.start !== marks.target) {
        const at = topOf(marks.start);
        if (at !== null) {
          drawFlag(ctx, at[0], at[1], pal, rgbCss(pal.ink), true);
          ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = rgbCss(pal.surface); ctx.strokeText(t('cogitaWorld.nav.startHere'), at[0] + 14, at[1] - 22);
          ctx.fillStyle = rgbCss(pal.ink); ctx.fillText(t('cogitaWorld.nav.startHere'), at[0] + 14, at[1] - 22);
        }
      }
    }
    /* Namen: nie übereinander, die niedrigere Säule gewinnt. */
    const placed = placeLabels(labels, size.w, size.h);
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of placed) {
      if (!l.shown) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = rgbCss(pal.surface); ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = rgbCss(pal.ink); ctx.fillText(l.text, l.x, l.y);
    }
    drawnRef.current = drawn;
    frames.current.count += 1;
    frames.current.ms.push(performance.now() - t0);
    if (frames.current.ms.length > 600) frames.current.ms.splice(0, frames.current.ms.length - 600);
    canvas.dataset.wmFrame = String(frames.current.count);
    canvas.dataset.wmMs = (performance.now() - t0).toFixed(2);
    canvas.dataset.wmPillar = pillarWidth.toFixed(3);
    canvas.dataset.wmRadius = (scene.places.length === 0 ? 0 : scene.places[0].r * pillarWidth * v.s).toFixed(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, size, scene, pillarWidth, heightScale, route, faint, chosen, marks, stampOf, t]);

  const request = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(draw); }, [draw]);
  useEffect(() => { request(); }, [request, cam]);

  /* -- Zeigen und Wählen ------------------------------------------------------------------------------------------- */
  const hit = (x: number, y: number): string | null => {
    const list = drawnRef.current;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const d = list[i];
      if (Math.abs(x - d.x) > d.rx) continue;
      if (y >= d.top && y <= d.bottom) return d.id;
      const dt = ((x - d.x) / d.rx) ** 2 + ((y - d.top) / Math.max(1, d.ry)) ** 2;
      const db = ((x - d.x) / d.rx) ** 2 + ((y - d.bottom) / Math.max(1, d.ry)) ** 2;
      if (dt <= 1 || db <= 1) return d.id;
    }
    return null;
  };
  const hitHome = (x: number, y: number): boolean => {
    const c = camRef.current;
    if (scene.home === null || c === null) return false;
    const [hx, hy] = toScr(viewOf(c, size.w, size.h), scene.home.x, scene.home.y, 0);
    return Math.hypot(x - hx, y - hy) < Math.max(14, scene.home.r * c.s);
  };
  const hitLane = (x: number, y: number): string | null => {
    const c = camRef.current;
    if (c === null) return null;
    const v = viewOf(c, size.w, size.h);
    const [gx, gy] = toGrd(v, x, y);
    const tol = 7 / v.s;
    let best: string | null = null;
    let bd = tol;
    for (const lane of scene.lanes) {
      if (lane.deep && v.s < DEEP_FROM) continue;
      const p = lane.points;
      for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
        const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
        const k = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((gx - ax) * (bx - ax) + (gy - ay) * (by - ay)) / L2));
        const d = Math.hypot(gx - (ax + (bx - ax) * k), gy - (ay + (by - ay) * k));
        if (d < bd) { bd = d; best = lane.section; }
      }
    }
    return best;
  };

  /* -- Gesten ------------------------------------------------------------------------------------------------------------ */
  const drag = useRef<{ id: number; x: number; y: number; cam: WorldCam; turn: boolean; moved: boolean } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const two = useRef<{ d: number; a: number; cam: WorldCam; mx: number; my: number } | null>(null);
  const zoomAt = (factor: number, sx: number, sy: number) => {
    const c = camRef.current;
    if (c === null) return;
    const v = viewOf(c, size.w, size.h);
    const [gx, gy] = toGrd(v, sx, sy);
    const s = Math.max(0.01, Math.min(40, c.s * factor));
    const after = viewOf({ ...c, s }, size.w, size.h);
    const [hx, hy] = toGrd(after, sx, sy);
    setCam({ ...c, s, cx: c.cx + gx - hx, cy: c.cy + gy - hy });
  };
  useEffect(() => {
    const el = canvasRef.current;
    if (el === null) return undefined;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY / 400), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const local = (e: React.PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => {
    const c = camRef.current;
    if (c === null) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    touches.current.set(e.pointerId, p);
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      two.current = { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), cam: c, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag.current = null;
      return;
    }
    drag.current = { id: e.pointerId, x: p.x, y: p.y, cam: c, turn: e.shiftKey || e.button === 2, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const p = local(e);
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, p);
    const c = camRef.current;
    if (c === null) return;
    if (two.current !== null && touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const s = Math.max(0.01, Math.min(40, two.current.cam.s * (d / Math.max(1, two.current.d))));
      const rot = two.current.cam.rot - ((ang - two.current.a) * 180) / Math.PI;
      setCam({ ...two.current.cam, s, rot });
      return;
    }
    const dr = drag.current;
    if (dr === null || dr.id !== e.pointerId) {
      if (e.pointerType === 'mouse') { const id = hit(p.x, p.y); onHover?.(id, id === null ? null : { x: p.x, y: p.y }); }
      return;
    }
    const dx = p.x - dr.x, dy = p.y - dr.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
    if (!dr.moved) return;
    if (dr.turn) {
      /* Drehen und neigen um die Mitte des Bildes (sie bleibt stehen). */
      setCam({ ...dr.cam, rot: dr.cam.rot + dx * 0.35, fore: dr.cam.fore - dy * 0.004 });
      return;
    }
    const v = viewOf(dr.cam, size.w, size.h);
    const [ax, ay] = toGrd(v, dr.x, dr.y);
    const [bx, by] = toGrd(v, p.x, p.y);
    setCam({ ...dr.cam, cx: dr.cam.cx - (bx - ax), cy: dr.cam.cy - (by - ay) });
  };
  const up = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) two.current = null;
    const dr = drag.current;
    drag.current = null;
    if (dr === null || dr.id !== e.pointerId || dr.moved) return;
    const p = local(e);
    const id = hit(p.x, p.y);
    if (id !== null) { onPick?.(id); onHover?.(id, { x: p.x, y: p.y }); return; }
    if (hitHome(p.x, p.y)) { onPickHome?.(); return; }
    const lane = hitLane(p.x, p.y);
    if (lane !== null) { onPickLane?.(lane); return; }
    onPick?.(null);
    onHover?.(null, null);
  };
  const key = (e: React.KeyboardEvent) => {
    const c = camRef.current;
    if (c === null) return;
    const step = 60 / c.s;
    if (e.key === '+' || e.key === '=') zoomAt(1.4, size.w / 2, size.h / 2);
    else if (e.key === '-') zoomAt(1 / 1.4, size.w / 2, size.h / 2);
    else if (e.key === 'ArrowLeft') setCam({ ...c, cx: c.cx - step });
    else if (e.key === 'ArrowRight') setCam({ ...c, cx: c.cx + step });
    else if (e.key === 'ArrowUp') setCam({ ...c, cy: c.cy + step });
    else if (e.key === 'ArrowDown') setCam({ ...c, cy: c.cy - step });
    else if (e.key === 'q' || e.key === 'Q') setCam({ ...c, rot: c.rot - 10 });
    else if (e.key === 'e' || e.key === 'E') setCam({ ...c, rot: c.rot + 10 });
    else return;
    e.preventDefault();
  };

  /*
    Für Klickpfade (scripts/wm-click-paths.mjs): wo auf dem Bild ein Ort, das Haus oder ein Abschnitt getroffen wird — ein
    Punkt, den dieselben Treffer-Prüfungen wie ein Klick wirklich ergeben (sonst null).
  */
  useEffect(() => {
    type Hooked = HTMLCanvasElement & {
      wmLocate?: (kind: string, id: string) => [number, number] | null;
      wmLanes?: () => { section: string; line: string; state: string; from: string; to: string }[];
    };
    const el = canvasRef.current as Hooked | null;
    if (el === null) return undefined;
    const label = (id: string) => (id === HOME_MARK ? HOME_MARK : scene.byId.get(id)?.label ?? id);
    el.wmLanes = () => scene.lanes.map((l) => ({ section: l.section, line: l.line, state: l.state, from: label(l.fromId), to: label(l.toId) }));
    el.wmLocate = (kind, id) => {
      const c = camRef.current;
      if (c === null) return null;
      const v = viewOf(c, size.w, size.h);
      const inside = (x: number, y: number) => x > 4 && y > 4 && x < size.w - 4 && y < size.h - 4;
      if (kind === 'place' || kind === 'label') {
        const want = kind === 'label' ? scene.places.find((p) => p.label === id)?.id : id;
        const d = drawnRef.current.find((x) => x.id === want);
        if (d === undefined) return null;
        for (const y of [(d.top + d.bottom) / 2, d.top, d.bottom]) if (inside(d.x, y) && hit(d.x, y) === want) return [d.x, y];
        return null;
      }
      if (kind === 'home') {
        if (scene.home === null) return null;
        const [hx, hy] = toScr(v, scene.home.x, scene.home.y, 0);
        for (const [x, y] of [[hx, hy], [hx, hy + 4], [hx + 6, hy]]) if (inside(x, y) && hit(x, y) === null && hitHome(x, y)) return [x, y];
        return null;
      }
      const lane = scene.lanes.find((l) => l.section === id);
      if (lane === undefined) return null;
      const pts = withRims(lane, pillarWidth);
      for (const f of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
        const a = along(pts, f);
        const [x, y] = toScr(v, a.x, a.y, 0);
        if (inside(x, y) && hit(x, y) === null && !hitHome(x, y) && hitLane(x, y) === id) return [x, y];
      }
      return null;
    };
    return () => { delete el.wmLocate; delete el.wmLanes; };
  });

  useImperativeHandle(ref, () => ({
    fit: () => { if (size.w > 0) setCam(fitCam(size.w, size.h, camRef.current?.rot ?? -20, camRef.current?.fore ?? FORE_FIRST)); },
    focus: (id: string) => {
      const p = scene.byId.get(id);
      const c = camRef.current;
      if (p === undefined || c === null) return;
      setCam({ ...c, cx: p.x, cy: p.y, s: Math.max(c.s, 1.1) });
    },
    rotate: (deg: number) => { const c = camRef.current; if (c !== null) { setCam({ ...c, rot: c.rot + deg }); draw(); } },
    frames: frames.current
  }), [scene, size, setCam, fitCam, draw]);

  const c = cam;
  return (
    <div className={`cg-wm${compact ? ' is-compact' : ''}`} data-world-map={scene.places.length} data-world-lanes={scene.lanes.length}>
      <div ref={boxRef} className="cg-wm-stage">
        <canvas ref={canvasRef} className="cg-wm-canvas" tabIndex={0} aria-label={t('cogitaWorld.map.label', { count: scene.places.length })}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
          onPointerLeave={() => onHover?.(null, null)} onContextMenu={(e) => e.preventDefault()} data-world-canvas="" />
      </div>
      {c !== null && (
        <div className="cg-wm-tools" data-world-tools="">
          <button type="button" className="cg-rm-tool" onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)} aria-label={t('cogitaWorld.map.zoomIn')} title={t('cogitaWorld.map.zoomIn')} data-world-zoom="in">+</button>
          <button type="button" className="cg-rm-tool" onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)} aria-label={t('cogitaWorld.map.zoomOut')} title={t('cogitaWorld.map.zoomOut')} data-world-zoom="out">−</button>
          <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => setCam(fitCam(size.w, size.h, c.rot, c.fore))} data-world-fit="">{t('cogitaWorld.map.whole')}</button>
          <label className="cg-wm-range">
            <span>{t('cogitaWorld.map.rotate')}</span>
            <input type="range" min={0} max={360} step={1} value={Math.round((((c.rot % 360) + 360) % 360))} onChange={(e) => setCam({ ...c, rot: Number(e.target.value) })} data-world-rotate="" />
          </label>
          <label className="cg-wm-range">
            <span>{t('cogitaWorld.map.tilt')}</span>
            <input type="range" min={25} max={88} step={1} value={Math.round((Math.asin(Math.max(FORE_LOW, Math.min(FORE_HIGH, c.fore))) * 180) / Math.PI)} onChange={(e) => setCam({ ...c, fore: Math.sin((Number(e.target.value) * Math.PI) / 180) })} data-world-tilt="" />
          </label>
        </div>
      )}
    </div>
  );
});

/** Die Spur mit dem geraden Stück vom vollen bis zum gezeichneten Rand an beiden Enden (§4.7). */
function withRims(lane: SceneLane, width: number): number[] {
  const p = lane.points;
  if (p.length < 4) return [...p];
  const out = [...p];
  const ext = (cx: number, cy: number, r: number, px: number, py: number): [number, number] | null => {
    if (r <= 0) return null;
    const d = Math.hypot(px - cx, py - cy);
    if (d <= r + 0.5) return null;
    return [cx + ((px - cx) / d) * r, cy + ((py - cy) / d) * r];
  };
  const head = lane.fromHome ? null : ext(lane.from[0], lane.from[1], lane.fromR * width, p[0], p[1]);
  const tail = ext(lane.to[0], lane.to[1], lane.toR * width, p[p.length - 2], p[p.length - 1]);
  if (head !== null) out.unshift(head[0], head[1]);
  if (tail !== null) out.push(tail[0], tail[1]);
  return out;
}
