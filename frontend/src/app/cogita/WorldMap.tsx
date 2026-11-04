/**
 * 2026-11-04 (Prompt 13, C1–C7) — DIE EINE LANDSCHAFT: alle Themen als Säulen an festen Plätzen (`worldLayout.ts`), auf
 * einer Leinwand gezeichnet (5 000 Säulen bleiben beim Ziehen flüssig), darüber Namen und Zeichen.
 * <code>
 *   Zoom      stufenlos (Rad, zwei Finger, „+"/„−", Doppelklick auf ein Gebiet = sanft auf das Gebiet); fern nur Relief,
 *             Farben, je oberstem Gebiet ein Name und das eigene Land; näher die Namen der Teilgebiete im Bild und die
 *             Zeichen; nah die Namen der Themen. Namen blenden ein und aus, nie zwei übereinander.
 *   Klick     fern auf ein Gebiet: sanft hinein (dieselbe Karte, kein neues Bild); nah auf ein Thema: gewählt — dann
 *             seine eigenen Verbindungen als weiche Wege (was es braucht dunkler, was es öffnet heller)
 *   Kamera    gehört dem Lernenden: Strg + Ziehen (zwei Finger hoch/runter) neigt, Strg + Ziehen quer oder der Knopf dreht
 *             in 60°-Schritten; „Ansicht zurücksetzen"; gemerkt je Lernendem und Baza. Eine Stufenhöhe für alle (`STEP`).
 *   Land      was er kann, ist sein Gebiet: eine warme, kräftige Fläche mit weichem Rand; was jetzt geht, hat einen hellen
 *             Rand; wird etwas gekonnt, wächst das Land dort sichtbar
 * </code>
 * Keine Linien um oder zwischen Gebieten: ein Gebiet ist seine Farbe (die seines obersten Gebiets) und ein Streifen Boden.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import type { LsBand } from './landscape';
import type { WorldLayout } from './worldLayout';
import { cellPx, depthOf, FORE_MAX, FORE_MIN, FORE_START, fitCam, NAME_PX, PICK_PX, placeLabels, projection, regionLabelAlpha, SIGN_PX, toGround, toScreen, type LabelCandidate, type Projection, type WorldCam } from './worldView';
import type { LandscapeWords } from './landscapeWords';

export type SignKind = 'first' | 'due';

/** Was jedes Thema auf der Karte zeigt (in der Reihenfolge von `WorldLayout.cells`). */
export interface WorldTopic {
  readonly id: string;
  readonly label: string;
  readonly steps: number;
  readonly band: LsBand;
  /** Die Farbe seines obersten Gebiets (0–7; −1 grau). */
  readonly subject: number;
  readonly glow: boolean;
  readonly sign: SignKind | null;
}

export interface WorldCommand {
  readonly kind: 'fit' | 'region' | 'topic';
  readonly key?: string;
  readonly at: number;
}

/* -- Die Zeichen (dieselben in der Legende) ----------------------------------------------------------------------- */

const SIGN_PATH: Readonly<Record<SignKind, string>> = {
  due: 'M0.44,-0.46 A0.62,0.62 0 1 0 0.5,0.4 M0.44,-0.46 L-0.02,-0.5 M0.44,-0.46 L0.52,-0.02',
  first: 'M-0.26,-0.38 A0.36,0.36 0 1 0 0.06,0.18 M-0.26,-0.38 L-0.06,-0.54 M-0.26,-0.38 L-0.08,-0.22 M0.2,0 L0.8,0 M0.58,-0.2 L0.8,0 L0.58,0.2'
};
export function SignIcon({ kind, r, x = 0, y = 0 }: { kind: SignKind; r: number; x?: number; y?: number }) {
  return (
    <g className="cg-ls-sign" transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${r.toFixed(2)})`} data-ls-sign={kind}>
      <circle className="cg-ls-sign-disc" r={1} vectorEffect="non-scaling-stroke" />
      <path className="cg-ls-sign-line" d={SIGN_PATH[kind]} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
export function FlagIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className="cg-wm-flag" viewBox="-1 -13 10 14" width={size} height={size} aria-hidden data-ls-flag="">
      <path d="M0,0 V-12 L7.4,-9.4 L0,-6.7" />
    </svg>
  );
}

/* -- Farben aus dem Stil (hell und dunkel) -------------------------------------------------------------------------- */

interface Palette { readonly c: readonly number[][]; readonly cx: number[]; readonly light: number[]; readonly haze: number[]; readonly floor: number[]; readonly warm: number[]; readonly glow: number[]; readonly ink: number[]; readonly accent: number[]; readonly surface: number[] }
function parseColour(v: string): number[] {
  const s = v.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m !== null) return m[1].split(/[ ,/]+/).slice(0, 3).map(Number);
  return [128, 128, 128];
}
function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  /* Eine Farbe aus einer Variablen (auch color-mix): über eine Probe ausgerechnet. */
  const probe = document.createElement('span');
  el.appendChild(probe);
  const get = (name: string, fallback: string) => {
    const raw = cs.getPropertyValue(name).trim();
    if (raw === '') return parseColour(fallback);
    probe.style.color = raw;
    return parseColour(getComputedStyle(probe).color);
  };
  const out: Palette = {
    c: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => get(`--cg-ls-c${i}`, '#8899aa')), cx: get('--cg-ls-cx', '#999999'), light: get('--cg-ls-light', '#ffffff'),
    haze: get('--cg-ls-haze', '#f6f4ef'), floor: get('--cg-ls-floor', '#f3f0ea'), warm: get('--cg-ls-warm', '#f0a020'), glow: get('--cg-ls-glow', '#fff6c2'),
    ink: get('--wk-ink', '#222222'), accent: get('--wk-accent', '#7a5a2f'), surface: get('--wk-surface', '#ffffff')
  };
  probe.remove();
  return out;
}
const mix = (a: readonly number[], b: readonly number[], t: number): number[] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: readonly number[], alpha = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;

/* -- Wie breit ein Name ist (mit der Schrift der Seite gemessen, sonst geschätzt) --------------------------------- */

let measureCtx: CanvasRenderingContext2D | null | undefined;
let measureFont = '';
function textWidth(text: string, bold: boolean): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d');
      const px = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      measureFont = `${px * 0.75}px ${getComputedStyle(document.body).fontFamily}`;
    } catch { measureCtx = null; }
  }
  if (measureCtx === null || measureCtx === undefined) return text.length * (bold ? 7.2 : 6.8);
  measureCtx.font = `${bold ? '600 ' : ''}${measureFont}`;
  return measureCtx.measureText(text).width * 1.06 + 2;
}

/* -- Kamera, gemerkt je Lernendem und Baza ------------------------------------------------------------------------ */

function keptCam(key: string): WorldCam | null {
  try {
    const raw = localStorage.getItem(`cg-wm-cam:${key}`);
    if (raw === null) return null;
    const v = JSON.parse(raw) as Partial<WorldCam>;
    if ([v.s, v.cx, v.cy, v.rot, v.fore].every((x) => typeof x === 'number' && Number.isFinite(x))) return { s: v.s!, cx: v.cx!, cy: v.cy!, rot: ((Math.round(v.rot! / 60) * 60) % 360 + 360) % 360, fore: v.fore! };
  } catch { /* ohne Speicher */ }
  return null;
}
function keepCam(key: string, cam: WorldCam): void {
  try { localStorage.setItem(`cg-wm-cam:${key}`, JSON.stringify({ ...cam, rot: ((Math.round(cam.rot / 60) * 60) % 360 + 360) % 360 })); } catch { /* ohne Speicher */ }
}

/* -- Die Karte ------------------------------------------------------------------------------------------------- */

export function WorldMap({ world, topics, regionName, conquered, chosen, flash, home, links, route, width, compact, T, memoryKey, command, onPickTopic, onView, onBackground, legend }: {
  world: WorldLayout;
  topics: readonly WorldTopic[];
  regionName: (key: string) => string;
  /** Gebiete, in denen alles gekonnt ist (erobert). */
  conquered: ReadonlySet<string>;
  chosen: number | null;
  /** Kurz hervorgehoben (ein Name im Panel wurde angetippt). */
  flash: number | null;
  /** Der nächste Schritt (leise: hier am Rand des eigenen Landes). */
  home: number | null;
  /** Die eigenen Verbindungen des gewählten Themas. */
  links: { readonly needs: readonly number[]; readonly opens: readonly number[] } | null;
  /** Der Weg zum Ziel (nur, wenn nah genug). */
  route: readonly number[] | null;
  width: number;
  compact: boolean;
  T: LandscapeWords;
  memoryKey: string;
  command: WorldCommand | null;
  onPickTopic: (t: number) => void;
  /** Welche Gebiete gerade das Bild füllen (von oben) — die Brotkrumen. */
  onView: (chain: readonly string[]) => void;
  onBackground: () => void;
  legend: (visible: ReadonlySet<string>) => ReactNode;
}) {
  const height = Math.round(Math.max(320, Math.min(compact ? 420 : 700, width * (width < 520 ? 1.05 : 0.62))));
  const n = world.cells.length;
  /* Die ganze Karte: Mitte und Halbmesser. */
  const whole = useMemo(() => {
    if (n === 0) return { x: 0, y: 0, r: 1 };
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const c of world.cells) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) / 2 + 1.2 };
  }, [world, n]);
  const start: WorldCam = { s: 10, cx: whole.x, cy: whole.y, rot: 0, fore: FORE_START };
  const fitWhole = (c: WorldCam): WorldCam => fitCam(c, width, height, whole.x, whole.y, whole.r);
  const [cam, setCamNow] = useState<WorldCam>(() => keptCam(memoryKey) ?? fitWhole(start));
  const camRef = useRef(cam);
  const setCam = (c: WorldCam) => { camRef.current = c; setCamNow(c); };
  const sMin = () => fitWhole(camRef.current).s * 0.6;
  const sMax = () => 220;
  const clamp = (c: WorldCam): WorldCam => {
    const s = Math.max(sMin(), Math.min(sMax(), c.s));
    const pad = whole.r + 2;
    return { ...c, s, cx: Math.max(whole.x - pad, Math.min(whole.x + pad, c.cx)), cy: Math.max(whole.y - pad, Math.min(whole.y + pad, c.cy)), fore: Math.max(FORE_MIN, Math.min(FORE_MAX, c.fore)) };
  };
  /* Gemerkt, wenn er sich nicht mehr bewegt. */
  useEffect(() => { const id = window.setTimeout(() => keepCam(memoryKey, cam), 400); return () => window.clearTimeout(id); }, [cam, memoryKey]);

  /* -- Sanft: Gleiten (Zoom auf ein Gebiet), Drehen, Ausrollen --------------------------------------------------- */
  const frame = useRef(0);
  const stop = () => { if (frame.current !== 0) { cancelAnimationFrame(frame.current); frame.current = 0; } };
  useEffect(() => stop, []);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const glide = (to: WorldCam, ms = 420) => {
    stop();
    const target = clamp(to);
    if (reduced) { setCam(target); return; }
    const from = camRef.current;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      setCam({ s: from.s * (target.s / from.s) ** e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e, rot: from.rot + (target.rot - from.rot) * e, fore: from.fore + (target.fore - from.fore) * e });
      frame.current = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };
  const rotateBy = (k: number) => glide({ ...camRef.current, rot: Math.round(camRef.current.rot / 60) * 60 + 60 * k }, 260);
  const resetView = () => glide(fitWhole({ ...camRef.current, rot: 0, fore: FORE_START }));
  const regionCam = (key: string) => { const r = world.regions.get(key); return r === undefined ? null : fitCam(camRef.current, width, height, r.x, r.y, r.radius); };
  const topicCam = (t: number) => { const c = world.cells[t]; return { ...camRef.current, s: Math.max(camRef.current.s, 64 / (2 * 0.57735)), cx: c.x, cy: c.y }; };

  /* Von aussen: „Ganze Karte", ein Gebiet (Brotkrumen), ein Thema (aus dem Panel). */
  const seenCommand = useRef(command?.at ?? 0);
  useEffect(() => {
    if (command === null || command.at === seenCommand.current) return;
    seenCommand.current = command.at;
    if (command.kind === 'fit') { glide(fitWhole(camRef.current)); return; }
    if (command.kind === 'region' && command.key !== undefined) { const c = regionCam(command.key); if (c !== null) glide(c); return; }
    if (command.kind === 'topic' && command.key !== undefined) { const t = Number(command.key); if (Number.isInteger(t) && t >= 0 && t < n) glide(topicCam(t)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.at]);

  /* -- Farben ---------------------------------------------------------------------------------------------------- */
  const box = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const el = box.current;
    if (el === null) return undefined;
    const read = () => setPalette(readPalette(el));
    read();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', read);
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => { mq?.removeEventListener?.('change', read); watch.disconnect(); };
  }, []);

  /* Das eigene Land wächst: wann ein Thema gekonnt wurde (in diesem Fenster), für eine kurze Bewegung. */
  const knownAt = useRef(new Map<number, number>());
  const knownBefore = useRef<Set<number> | null>(null);
  useEffect(() => {
    const now = new Set<number>();
    topics.forEach((t, i) => { if (t.band === 'known' || t.band === 'due') now.add(i); });
    const was = knownBefore.current;
    if (was !== null) for (const i of now) if (!was.has(i)) knownAt.current.set(i, performance.now());
    knownBefore.current = now;
  }, [topics]);

  /* -- Zeichnen ------------------------------------------------------------------------------------------------- */
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [hoverTopic, setHoverTopic] = useState<number | null>(null);
  /* Die Mitte der Gebiete einer Ebene, die gerade benannt wird (für Klicks fern): je Thema das Gebiet, das den Namen trägt. */
  const px = cellPx(cam);
  const proj = useMemo(() => projection(cam, width, height), [cam, width, height]);
  const regionOfTopicNow = (t: number): string | null => {
    const chain = world.chain[t] ?? [];
    /* Das tiefste Gebiet, das bei diesem Zoom einen Namen trägt oder schon zu gross dafür ist (dessen Kind dann hinein führt). */
    let pick: string | null = null;
    for (const k of chain) {
      const r = world.regions.get(k);
      if (r === undefined) continue;
      pick = k;
      if (2 * r.radius * cam.s < 900) break;
    }
    return pick;
  };
  const animating = useRef(0);
  /*
    Ein grösseres Bild im Hintergrund (eine halbe Breite Rand ringsum): beim Ziehen wird es nur verschoben — neu gezeichnet erst,
    wenn sich Zoom, Winkel oder Daten ändern oder der Rand erreicht ist. So bleibt eine Baza mit 5 000 Themen flüssig.
  */
  const cache = useRef<{ canvas: HTMLCanvasElement; cam: WorldCam; sig: string; margin: number } | null>(null);
  const dataTick = useRef(0);
  const dataSig = useMemo(() => { dataTick.current += 1; return dataTick.current; }, [topics, chosen, flash, links, route, home, hoverRegion, palette, world]); // eslint-disable-line react-hooks/exhaustive-deps
  const paint = () => {
    const el = canvas.current;
    if (el === null || palette === null) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) { el.width = Math.round(width * dpr); el.height = Math.round(height * dpr); }
    const ctx = el.getContext('2d');
    if (ctx === null) return;
    const growing = [...knownAt.current.values()].some((x) => performance.now() - x < 900);
    if (n < 1200 || growing) { draw(ctx, dpr); return; }
    const margin = Math.round(Math.max(width, height) * 0.5);
    const sig = [cam.s.toFixed(4), cam.rot.toFixed(3), cam.fore.toFixed(4), dataSig, width, height].join('|');
    let c = cache.current;
    let dx = 0; let dy = 0;
    if (c !== null && c.sig === sig) {
      const [ox, oy] = toScreen(proj, c.cam.cx, c.cam.cy);
      dx = ox - width / 2; dy = oy - height / 2;
      if (Math.abs(dx) > margin * 0.9 || Math.abs(dy) > margin * 0.9) c = null;
    } else c = null;
    if (c === null) {
      const off = cache.current?.canvas ?? document.createElement('canvas');
      const cw = width + 2 * margin; const ch = height + 2 * margin;
      if (off.width !== Math.round(cw * dpr) || off.height !== Math.round(ch * dpr)) { off.width = Math.round(cw * dpr); off.height = Math.round(ch * dpr); }
      const octx = off.getContext('2d');
      if (octx === null) { draw(ctx, dpr); return; }
      const p2 = projection(cam, cw, ch);
      const scr = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 1) { const w0 = world.cells[i]; const [x, y] = toScreen(p2, w0.x, w0.y, topics[i]?.steps ?? 0); scr[i * 3] = x; scr[i * 3 + 1] = y; scr[i * 3 + 2] = depthOf(p2, w0.x, w0.y); }
      draw(octx, dpr, p2, scr, cw, ch);
      c = { canvas: off, cam, sig, margin };
      cache.current = c;
      dx = 0; dy = 0;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(c.canvas, Math.round((dx - c.margin) * dpr), Math.round((dy - c.margin) * dpr));
  };
  useLayoutEffect(() => {
    paint();
    /* Solange das Land wächst: weiter zeichnen. */
    const growing = [...knownAt.current.values()].some((x) => performance.now() - x < 900);
    if (growing && animating.current === 0) {
      const loop = () => { paint(); animating.current = [...knownAt.current.values()].some((x) => performance.now() - x < 900) ? requestAnimationFrame(loop) : 0; };
      animating.current = requestAnimationFrame(loop);
    }
  });
  useEffect(() => () => { if (animating.current !== 0) cancelAnimationFrame(animating.current); }, []);

  /** Die Schirm-Lage jeder Säule (Mitte der Oberseite) — für Klicks und Namen. */
  const screen = useMemo(() => {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const c = world.cells[i];
      const [x, y] = toScreen(proj, c.x, c.y, topics[i]?.steps ?? 0);
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = depthOf(proj, c.x, c.y);
    }
    return out;
  }, [proj, world, topics, n]);

  function draw(ctx: CanvasRenderingContext2D, dpr: number, p: Projection = proj, scr: Float32Array = screen, cw = width, ch = height) {
    const P = palette!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const corners = p.corners;
    const margin = Math.max(30, p.s * 2);
    const hexPath = (x: number, y: number) => { ctx.moveTo(x + corners[0][0], y + corners[0][1]); for (let k = 1; k < 6; k += 1) ctx.lineTo(x + corners[k][0], y + corners[k][1]); ctx.closePath(); };
    /* Der Boden: ein Platz um alles und die Streifen zwischen den Gebieten. */
    ctx.beginPath();
    for (const g of world.ground) { const [x, y] = toScreen(p, g.x, g.y); if (x < -margin || x > cw + margin || y < -margin || y > ch + margin) continue; hexPath(x, y); }
    ctx.fillStyle = css(P.floor);
    ctx.fill();
    /* Von hinten nach vorn. */
    const order: number[] = [];
    for (let i = 0; i < n; i += 1) { const x = scr[i * 3]; const y = scr[i * 3 + 1]; if (x < -margin || x > cw + margin || y < -margin - 400 || y > ch + margin + 200) continue; order.push(i); }
    order.sort((a, b) => scr[a * 3 + 2] - scr[b * 3 + 2]);
    const lift = p.lift * 0.1 * p.s;
    const now = performance.now();
    /* Welche Seiten nach vorn zeigen (ihre Mitte liegt unter der Mitte der Kachel). */
    const front = [0, 1, 2, 3, 4, 5].filter((k) => (corners[k][1] + corners[(k + 1) % 6][1]) / 2 > 1e-6);
    const regionHi = hoverRegion;
    const showGlow = px >= 6;
    for (const i of order) {
      const t = topics[i];
      if (t === undefined) continue;
      const x = scr[i * 3];
      const top = scr[i * 3 + 1];
      const h = t.steps * lift;
      const base = top + h;
      const regionC = t.subject >= 0 && t.subject < 8 ? P.c[t.subject] : P.cx;
      let face: number[];
      if (t.band === 'known' || t.band === 'due') {
        const since = knownAt.current.get(i);
        const grown = since === undefined ? 1 : Math.min(1, (now - since) / 900);
        const land = mix(P.warm, regionC, 0.18);
        face = mix(mix(regionC, P.light, 0.5), land, grown);
      } else if (t.band === 'ring') face = mix(regionC, P.light, 0.55);
      else face = mix(mix(regionC, P.light, 0.78), P.haze, Math.min(0.55, t.steps / 28));
      if (regionHi !== null && (world.chain[i] ?? []).includes(regionHi)) face = mix(face, P.surface, 0.28);
      /* Die Seiten (eine Fläche je sichtbarer Seite, dunkler). */
      if (h > 0.4) {
        for (const k of front) {
          const a = corners[k]; const b = corners[(k + 1) % 6];
          ctx.beginPath();
          ctx.moveTo(x + a[0], top + a[1]); ctx.lineTo(x + b[0], top + b[1]); ctx.lineTo(x + b[0], base + b[1]); ctx.lineTo(x + a[0], base + a[1]); ctx.closePath();
          const shade = 0.16 + 0.14 * Math.abs(Math.cos(((60 * k + 30) * Math.PI) / 180 + (p.sa >= 0 ? Math.asin(p.sa) : -Math.asin(-p.sa))));
          ctx.fillStyle = css(mix(face, [0, 0, 0], shade));
          ctx.fill();
        }
      }
      ctx.beginPath();
      hexPath(x, top);
      ctx.fillStyle = css(face);
      ctx.fill();
      if (px >= 9) { ctx.strokeStyle = css(mix(face, [0, 0, 0], 0.22), 0.7); ctx.lineWidth = 0.6; ctx.stroke(); }
      /* Was jetzt geht: ein heller Rand (die Grenze des eigenen Landes, wo es weitergeht). */
      if (showGlow && t.glow) { ctx.strokeStyle = css(P.glow, 0.95); ctx.lineWidth = Math.max(1.2, Math.min(2.4, px / 10)); ctx.stroke(); }
      if (i === chosen || i === flash) { ctx.strokeStyle = css(P.accent); ctx.lineWidth = i === flash ? 3.4 : 2.6; ctx.stroke(); }
    }
    /* Der weiche Rand des eigenen Landes: wo ein gekonntes Feld an ein nicht gekonntes stösst. */
    ctx.save();
    ctx.shadowColor = css(P.warm, 0.8);
    ctx.shadowBlur = Math.max(2, Math.min(10, px / 3));
    ctx.strokeStyle = css(P.warm, 0.85);
    ctx.lineWidth = Math.max(1, Math.min(3, px / 8));
    ctx.beginPath();
    const known = (i: number) => { const b = topics[i]?.band; return b === 'known' || b === 'due'; };
    const at = byCell.current;
    for (const i of order) {
      if (!known(i)) continue;
      const c = world.cells[i];
      const x = scr[i * 3]; const y = scr[i * 3 + 1];
      for (let k = 0; k < 6; k += 1) {
        const [dq, dr] = EDGE_DIR[k];
        const j = at.get(`${c.q + dq},${c.r + dr}`);
        if (j !== undefined && known(j)) continue;
        const a = corners[k]; const b = corners[(k + 1) % 6];
        ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]);
      }
    }
    ctx.stroke();
    ctx.restore();
    /* Die eigenen Verbindungen des gewählten Themas: weiche Wege (was es braucht dunkler, was es öffnet heller). */
    if (links !== null && chosen !== null) {
      const from: [number, number] = [scr[chosen * 3], scr[chosen * 3 + 1]];
      const draw1 = (list: readonly number[], colour: number[], alpha: number) => {
        ctx.beginPath();
        for (const j of list) {
          const to: [number, number] = [scr[j * 3], scr[j * 3 + 1]];
          const mx = (from[0] + to[0]) / 2; const my = (from[1] + to[1]) / 2 - Math.min(40, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.18);
          ctx.moveTo(from[0], from[1]); ctx.quadraticCurveTo(mx, my, to[0], to[1]);
        }
        ctx.strokeStyle = css(colour, alpha);
        ctx.lineWidth = Math.max(1.6, Math.min(4, px / 9));
        ctx.lineCap = 'round';
        ctx.stroke();
      };
      draw1(links.opens, mix(P.accent, P.light, 0.45), 0.75);
      draw1(links.needs, P.ink, 0.6);
    }
    /* Der Weg zum Ziel: erst, wenn nah genug. */
    if (route !== null && route.length > 1 && px >= SIGN_PX) {
      ctx.beginPath();
      route.forEach((j, k) => { const x = scr[j * 3]; const y = scr[j * 3 + 1]; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = css(P.accent, 0.85);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    /* Hier bist du: leise, am Rand des eigenen Landes. */
    if (home !== null && home >= 0 && home < n) {
      const x = scr[home * 3]; const y = scr[home * 3 + 1];
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, Math.min(5, px / 6)), 0, Math.PI * 2);
      ctx.fillStyle = css(P.ink, 0.75);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = css(P.surface, 0.9);
      ctx.stroke();
    }
  }
  /* Welches Thema an welchem Platz liegt (Nachbarn für den Rand des Landes). */
  const byCell = useRef(new Map<string, number>());
  useMemo(() => { const m = new Map<string, number>(); world.cells.forEach((c, i) => m.set(`${c.q},${c.r}`, i)); byCell.current = m; }, [world]);

  /* -- Treffen: welche Säule liegt unter dem Zeiger (vorn zuerst) ----------------------------------------------- */
  const hit = (sx: number, sy: number): number | null => {
    /* Die ganze Säule zählt (Oberseite und Seiten), die vorderste gewinnt. */
    const half = proj.s * 0.5;
    const face = proj.s * 0.5 * proj.fore;
    const per = 0.1 * proj.lift * proj.s;
    let best: number | null = null;
    let depth = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const x = screen[i * 3];
      if (sx < x - half || sx > x + half) continue;
      const top = screen[i * 3 + 1];
      const base = top + (topics[i]?.steps ?? 0) * per;
      if (sy < top - face || sy > base + face) continue;
      if (screen[i * 3 + 2] > depth) { depth = screen[i * 3 + 2]; best = i; }
    }
    return best;
  };

  /* -- Bewegen: ziehen, Rad, zwei Finger; Strg + Ziehen neigt und dreht ------------------------------------------- */
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const b = canvas.current?.getBoundingClientRect();
    return b === undefined ? [e.clientX, e.clientY] : [e.clientX - b.left, e.clientY - b.top];
  };
  const zoomAt = (factor: number, sx: number, sy: number) => {
    const c = camRef.current;
    const s = Math.max(sMin(), Math.min(sMax(), c.s * factor));
    const [gx, gy] = toGround(c, width, height, sx, sy);
    const next = { ...c, s };
    const [hx, hy] = toGround(next, width, height, sx, sy);
    setCam(clamp({ ...next, cx: c.cx + (gx - hx), cy: c.cy + (gy - hy) }));
  };
  useEffect(() => {
    const el = canvas.current;
    if (el === null) return undefined;
    const wheel = (e: WheelEvent) => { e.preventDefault(); stop(); const [x, y] = local(e); zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)), x, y); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; cam: WorldCam; moved: boolean; orbit: boolean; turned: number; vx: number; vy: number; t: number; two: { d: number; mx: number; my: number; s: number; fore: number } | null } | null>(null);
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    stop();
    const [x, y] = local(e);
    pointers.current.set(e.pointerId, { x, y });
    canvas.current?.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) drag.current = { x, y, cam: camRef.current, moved: false, orbit: e.ctrlKey || e.metaKey, turned: 0, vx: 0, vy: 0, t: performance.now(), two: null };
    else if (pointers.current.size === 2 && drag.current !== null) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { ...drag.current, moved: true, two: { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: camRef.current.s, fore: camRef.current.fore } };
    }
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const [x, y] = local(e);
    if (drag.current === null && e.pointerType === 'mouse') {
      const t = hit(x, y);
      setHoverTopic(px >= PICK_PX ? t : null);
      setHoverRegion(t === null || px >= PICK_PX ? null : regionOfTopicNow(t));
      if (tip.current !== null) { tip.current.style.left = `${Math.round(x)}px`; tip.current.style.top = `${Math.round(y - 16)}px`; }
      return;
    }
    if (!pointers.current.has(e.pointerId) || drag.current === null) return;
    const was = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x, y });
    const d = drag.current;
    if (pointers.current.size >= 2 && d.two !== null) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const ddist = Math.abs(dist - d.two.d);
      const dmy = my - d.two.my;
      /* Beide Finger hoch oder runter (Abstand bleibt): neigen; sonst zoomen. */
      if (Math.abs(dmy) > ddist * 1.4 && Math.abs(dmy) > 8) setCam(clamp({ ...camRef.current, fore: d.two.fore - dmy / 260 }));
      else zoomAt((d.two.s * (dist / Math.max(1, d.two.d))) / camRef.current.s, mx, my);
      return;
    }
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 6) return;
    d.moved = true;
    if (d.orbit) {
      /* Strg + Ziehen: hoch/runter neigt, quer dreht in 60°-Schritten. */
      const fore = d.cam.fore - (y - d.y) / 260;
      const steps = Math.trunc((x - d.x) / 90);
      if (steps !== d.turned) { rotateBy(steps - d.turned); d.turned = steps; }
      setCam(clamp({ ...camRef.current, fore }));
      return;
    }
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.vx = 0.8 * ((x - was.x) / dt) + 0.2 * d.vx;
    d.vy = 0.8 * ((y - was.y) / dt) + 0.2 * d.vy;
    d.t = now;
    const [g0x, g0y] = toGround(d.cam, width, height, d.x, d.y);
    const [g1x, g1y] = toGround(d.cam, width, height, x, y);
    setCam(clamp({ ...camRef.current, cx: d.cam.cx - (g1x - g0x), cy: d.cam.cy - (g1y - g0y) }));
  };
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const up = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    drag.current = null;
    if (d === null) return;
    if (!d.moved) {
      const [x, y] = local(e);
      const t = hit(x, y);
      const now = performance.now();
      const double = lastTap.current !== null && now - lastTap.current.at < 380 && Math.hypot(lastTap.current.x - x, lastTap.current.y - y) < 12;
      lastTap.current = { at: now, x, y };
      if (t === null) { onBackground(); return; }
      if (double || px < PICK_PX) {
        /* Ein Gebiet (fern) oder ein Doppelklick: sanft auf das Gebiet, das hier hineinführt. */
        const chain = world.chain[t] ?? [];
        let target: string | null = null;
        for (const k of chain) { const r = world.regions.get(k); if (r !== undefined && fitCam(camRef.current, width, height, r.x, r.y, r.radius).s > camRef.current.s * 1.25) { target = k; break; } }
        if (target !== null) { const c = regionCam(target); if (c !== null) { glide(c); return; } }
        if (double) { glide(topicCam(t)); return; }
      }
      onPickTopic(t);
      return;
    }
    if (d.orbit || reduced || Math.hypot(d.vx, d.vy) < 0.15) return;
    let vx = d.vx; let vy = d.vy;
    let last = performance.now();
    const tick = (time: number) => {
      const dt = Math.min(40, time - last);
      last = time;
      const c = camRef.current;
      const [a, b] = toGround(c, width, height, width / 2, height / 2);
      const [a2, b2] = toGround(c, width, height, width / 2 + vx * dt, height / 2 + vy * dt);
      const next = clamp({ ...c, cx: c.cx - (a2 - a), cy: c.cy - (b2 - b) });
      if (next.cx === c.cx && next.cy === c.cy) { vx = 0; vy = 0; }
      setCam(next);
      const k = 0.92 ** (dt / 16);
      vx *= k; vy *= k;
      frame.current = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); glide({ ...camRef.current, s: camRef.current.s * 1.5 }, 220); }
    else if (e.key === '-') { e.preventDefault(); glide({ ...camRef.current, s: camRef.current.s / 1.5 }, 220); }
    else if (e.key === 'Escape') { e.preventDefault(); zoomOutOne(); }
  };
  /* Eine Ebene hinaus: das Gebiet über dem, das gerade das Bild füllt. */
  const zoomOutOne = () => {
    const chain = viewChain.current;
    const up2 = chain.length >= 2 ? chain[chain.length - 2] : null;
    if (up2 !== null) { const c = regionCam(up2); if (c !== null) { glide(c); return; } }
    glide(fitWhole(camRef.current));
  };

  /* -- Was das Bild füllt (Brotkrumen), wenn die Kamera ruht ---------------------------------------------------- */
  const viewChain = useRef<readonly string[]>([]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      /* Das Thema nächst der Mitte; seine Gebiete, solange sie das Bild füllen. */
      let best = -1; let bd = Infinity;
      for (let i = 0; i < n; i += 1) { const dx = screen[i * 3] - width / 2; const dy = screen[i * 3 + 1] - height / 2; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      const chain: string[] = [];
      if (best >= 0) for (const k of world.chain[best] ?? []) { const r = world.regions.get(k); if (r === undefined) break; if (2 * r.radius * cam.s < Math.min(width, height) * 0.75) break; chain.push(k); }
      if (chain.join('|') !== viewChain.current.join('|')) { viewChain.current = chain; onView(chain); }
    }, 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, screen]);

  const measured = useRef(new Map<string, [number, number]>());
  /* Neu gemessene Namen: einmal neu verteilen (sonst blieben Schätzungen stehen, bis die Kamera sich bewegt). */
  const [measureTick, setMeasureTick] = useState(0);
  const measureSoon = useRef(0);
  /* -- Namen: Gebiete nach dem Zoom, nah die Themen ------------------------------------------------------------- */
  const labels = useMemo(() => {
    const list: LabelCandidate[] = [];
    for (const r of world.regions.values()) {
      const d = 2 * r.radius * cam.s;
      const parent = r.parent === null ? null : world.regions.get(r.parent) ?? null;
      const alpha = regionLabelAlpha(d, parent === null ? null : 2 * parent.radius * cam.s, r.level === 1);
      if (alpha <= 0.02) continue;
      const [x, y] = toScreen(proj, r.x, r.y);
      const text = regionName(r.key);
      const tw = textWidth(text, true) + (conquered.has(r.key) ? 16 : 0);
      const lines = Math.max(1, Math.ceil(tw / 200));
      const w = Math.min(tw, 208) + 16;
      list.push({ key: `r:${r.key}`, text, x, y, w, h: 17 * lines + 6, weight: 1000 + r.topics.length + (parent === null ? 5000 : 0), alpha });
    }
    if (px >= NAME_PX) {
      const inView: number[] = [];
      for (let i = 0; i < n; i += 1) { const x = screen[i * 3]; const y = screen[i * 3 + 1]; if (x > 0 && x < width && y > 0 && y < height) inView.push(i); }
      inView.sort((a, b) => Math.hypot(screen[a * 3] - width / 2, screen[a * 3 + 1] - height / 2) - Math.hypot(screen[b * 3] - width / 2, screen[b * 3 + 1] - height / 2));
      for (const i of inView.slice(0, 160)) {
        const t = topics[i];
        const text = t.label.length > 28 ? `${t.label.slice(0, 27)}…` : t.label;
        list.push({ key: `t:${i}`, text, x: screen[i * 3], y: screen[i * 3 + 1] + Math.max(8, px * 0.18), w: Math.min(px * 1.6, textWidth(text, false) + 10), h: 18, weight: (i === chosen ? 900 : t.glow ? 500 : 100) - Math.hypot(screen[i * 3] - width / 2, screen[i * 3 + 1] - height / 2) / 100, alpha: Math.min(1, (px - NAME_PX) / 14 + 0.2) });
      }
    }
    /* Die wirkliche Grösse (gemessen, sobald ein Name einmal stand) gilt vor der Schätzung. */
    return placeLabels(list.map((l) => { const m = measured.current.get(`${l.key}|${l.text}`); return m === undefined ? l : { ...l, w: Math.max(l.w, m[0]), h: Math.max(l.h, m[1]) }; }), width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, cam, proj, screen, regionName, topics, chosen, width, height, conquered, measureTick]);

  /* Zeichen auf Feldern, mit denen etwas zu tun ist (erst näher). */
  const signs = useMemo(() => {
    if (px < SIGN_PX) return [];
    const out: { i: number; x: number; y: number; kind: SignKind }[] = [];
    for (let i = 0; i < n && out.length < 300; i += 1) {
      const s = topics[i]?.sign;
      if (s == null) continue;
      const x = screen[i * 3]; const y = screen[i * 3 + 1];
      if (x < 0 || x > width || y < 0 || y > height) continue;
      out.push({ i, x, y, kind: s });
    }
    return out;
  }, [px, n, topics, screen, width, height]);

  const tip = useRef<HTMLDivElement>(null);
  const hovered = hoverTopic !== null ? { title: topics[hoverTopic]?.label ?? '', hint: hoverTopic === chosen ? (topics[hoverTopic]?.band === 'mountain' ? '' : T.hintStart) : T.hintSelect } : hoverRegion !== null ? { title: regionName(hoverRegion), hint: T.hintZoom } : null;
  const visible = new Set<string>();
  for (const l of labels) if (l.shown && l.key.startsWith('r:')) visible.add(l.key.slice(2));
  const rotNow = ((Math.round(cam.rot / 60) * 60) % 360 + 360) % 360;
  const tiltPct = Math.round(((cam.fore - FORE_MIN) / (FORE_MAX - FORE_MIN)) * 100);

  return (
    <div ref={box} className={`cg-wm${compact ? ' is-compact' : ''}`} tabIndex={-1} onKeyDown={keys} data-wm-scale={cam.s.toFixed(2)} data-wm-px={px.toFixed(1)} data-wm-rot={rotNow} data-wm-fore={cam.fore.toFixed(2)}
      data-wm-cells={n} data-wm-labels={labels.filter((l) => l.shown).map((l) => l.key).join('|')} data-wm-cam={[cam.s, cam.cx, cam.cy].map((v) => v.toFixed(3)).join(',')}>
      <div className="cg-wm-stage">
      <canvas ref={canvas} className="cg-wm-canvas" width={width} height={height} aria-label={T.mapLabel} role="img"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => { setHoverRegion(null); setHoverTopic(null); }} data-landscape-svg="" />
      <div className="cg-wm-over" aria-hidden>
        {labels.map((l) => {
          const isRegion = l.key.startsWith('r:');
          const rk = isRegion ? l.key.slice(2) : null;
          return (
            <span key={l.key} className={`cg-wm-label${isRegion ? ' is-region' : ' is-topic'}${l.shown ? ' is-shown' : ''}`} data-wm-label={l.key} data-wm-box={[l.x - l.w / 2, l.y - l.h / 2, l.w, l.h].map((v) => v.toFixed(0)).join(',')}
              onClick={rk === null ? undefined : () => { const c = regionCam(rk); if (c !== null) glide(c); }}
              ref={(el) => { if (el !== null) { const sk = `${l.key}|${l.text}`; if (!measured.current.has(sk) && el.offsetWidth > 0) { measured.current.set(sk, [el.offsetWidth, el.offsetHeight]); if (measureSoon.current === 0) measureSoon.current = window.setTimeout(() => { measureSoon.current = 0; setMeasureTick((x) => x + 1); }, 60); } el.style.left = `${l.x.toFixed(1)}px`; el.style.top = `${l.y.toFixed(1)}px`; el.style.width = `${l.w.toFixed(0)}px`; el.style.opacity = l.shown ? String(Math.min(1, l.alpha)) : '0'; } }}>
              {rk !== null && conquered.has(rk) && <FlagIcon />}{l.text}
            </span>
          );
        })}
        {signs.length > 0 && (
          <svg className="cg-wm-signs" width={width} height={height}>
            {signs.map((s) => <SignIcon key={s.i} kind={s.kind} r={Math.max(5, Math.min(9, px / 6))} x={s.x} y={s.y} />)}
          </svg>
        )}
      </div>
      {hovered !== null && <div ref={tip} className="cg-rm-tip" role="tooltip" data-landscape-tip="">{hovered.title}{hovered.hint === '' ? '' : <> · <strong>{hovered.hint}</strong></>}</div>}
      <div className="cg-rm-tools" role="group" aria-label={T.mapLabel}>
        <button type="button" className="cg-rm-tool" onClick={() => glide({ ...camRef.current, s: camRef.current.s * 1.6 }, 240)} aria-label={T.zoomIn} title={T.zoomIn} data-rm-zoom="in">+</button>
        <button type="button" className="cg-rm-tool" onClick={() => glide({ ...camRef.current, s: camRef.current.s / 1.6 }, 240)} aria-label={T.zoomOut} title={T.zoomOut} data-rm-zoom="out">−</button>
        <button type="button" className="cg-rm-tool is-icon" onClick={() => rotateBy(1)} aria-label={T.rotate} title={T.rotate} data-landscape-rotate={rotNow}>
          <svg viewBox="-8 -8 16 16" aria-hidden><path d="M5.2,-2.6 A6,6 0 1 0 6,1.4 M5.2,-2.6 L1.6,-3.2 M5.2,-2.6 L5.8,0.8" /></svg>
        </button>
      </div>
      <div className="cg-wm-view" data-wm-view="">
        <span className="cg-muted" data-wm-angle={rotNow}>{T.viewAngle(rotNow, tiltPct)}</span>
        <input type="range" min={0} max={100} value={tiltPct} aria-label={T.tilt} title={T.tiltHint} onChange={(e) => setCam(clamp({ ...camRef.current, fore: FORE_MIN + (Number(e.target.value) / 100) * (FORE_MAX - FORE_MIN) }))} data-wm-tilt="" />
        <button type="button" className="wk-link-btn" onClick={resetView} data-wm-reset="">{T.resetView}</button>
      </div>
      </div>
      {legend(visible)}
    </div>
  );
}

/** Die Kante k (Ecke k → k+1) stösst an den Nachbarn in dieser Richtung (Achsen q, r). */
const EDGE_DIR: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export type { Projection };
