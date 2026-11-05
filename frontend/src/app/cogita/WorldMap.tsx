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
import { cellPx, deepestS, depthOf, detailPx, fitCam, fitInfo, FORE_MAX, keepLabels, FORE_MIN, FORE_START, INFO_FORE, infoAngle, NAME_PX, PICK_PX, placeLabels, projection, RING_PX, toGround, toScreen, type LabelCandidate, type PlacedLabel, type Projection, type WorldCam } from './worldView';
import type { LandscapeWords } from './landscapeWords';
import { motionLevel, useMotion, type MotionLevel } from '../ui/motion';
import { flyPoints } from './rewardBus';
import { clamp01, easeInOut, easeOut, FLY_GAP, FLY_MS, FLY_SINGLE, LINE_MS, playPoints, playTimes, PULSE_MS, REGION_MS, SHIMMER_MS, WALK_MS, waveDelays, type PlaybackEvent, type PlayTimes, type WorldPlayback } from './worldPlay';

/** 2026-11-04 (Prompt 15, 4b) — was die Karte zeigt: alles, nur das Gekonnte (mit dem Rand), nur das Fällige. */
export type WorldMode = 'all' | 'known' | 'discover' | 'due';
/** 2026-11-04 (Prompt 16, 4) — die Höhe der Säulen: ein Faktor auf die Stufe der Baza (die Verhältnisse bleiben). */
export type WorldHeight = 'low' | 'mid' | 'high';
const HEIGHT_FACTOR: Readonly<Record<WorldHeight, number>> = { low: 0.5, mid: 1, high: 2 };

/** Was jedes Thema auf der Karte zeigt (in der Reihenfolge von `WorldLayout.cells`). */
export interface WorldTopic {
  readonly id: string;
  readonly label: string;
  readonly steps: number;
  readonly band: LsBand;
  /** Die Farbe seines obersten Gebiets (0–7; −1 grau). */
  readonly subject: number;
  readonly glow: boolean;
  /** 2026-11-04 (Prompt 15) — die mittlere Kenntnis seiner Karten (0–1, der Ring am Rand) und ein Wort zum Stand („umiesz"). */
  readonly share: number;
  readonly todo: string;
  /** Etwas daran ist fällig (der Punkt am Ring, die Ansicht „Do powtórki"). */
  readonly due: boolean;
}

/** Eine Spielfigur: auf einem Thema, das er zu lernen begann (`single`), oder auf dem Weg zu seinem Ziel (`goal`). */
export interface WorldPiece {
  readonly t: number;
  readonly kind: 'single' | 'goal';
}

export interface WorldCommand {
  readonly kind: 'fit' | 'region' | 'topic';
  readonly key?: string;
  readonly at: number;
}

/* 2026-11-04 (Prompt 15, 4b) — keine Zeichen auf den Feldern mehr (Figuren und Fahnen bleiben). */
export function FlagIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className="cg-wm-flag" viewBox="-1 -13 10 14" width={size} height={size} aria-hidden data-ls-flag="">
      <path d="M0,0 V-12 L7.4,-9.4 L0,-6.7" />
    </svg>
  );
}

/* -- Farben aus dem Stil (hell und dunkel) -------------------------------------------------------------------------- */

interface Palette { readonly c: readonly number[][]; readonly cx: number[]; readonly light: number[]; readonly haze: number[]; readonly floor: number[]; readonly warm: number[]; readonly glow: number[]; readonly ink: number[]; readonly accent: number[]; readonly surface: number[]; readonly land: number[]; readonly ready: number[] }
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
    ink: get('--wk-ink', '#222222'), accent: get('--wk-accent', '#7a5a2f'), surface: get('--wk-surface', '#ffffff'),
    land: get('--cg-ls-land', '#e0482a'), ready: get('--cg-ls-ready', '#ffe46b')
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
    /* 2026-11-04 (Prompt 14) — der freie Winkel, wie er war (nicht mehr auf 60° gerundet). */
    if ([v.s, v.cx, v.cy, v.rot, v.fore].every((x) => typeof x === 'number' && Number.isFinite(x))) return { s: v.s!, cx: v.cx!, cy: v.cy!, rot: ((v.rot! % 360) + 360) % 360, fore: v.fore! };
  } catch { /* ohne Speicher */ }
  return null;
}
function keepCam(key: string, cam: WorldCam): void {
  try { localStorage.setItem(`cg-wm-cam:${key}`, JSON.stringify({ ...cam, rot: ((cam.rot % 360) + 360) % 360 })); } catch { /* ohne Speicher */ }
}

function keptMode(key: string): WorldMode {
  try { const v = localStorage.getItem(`cg-wm-mode:${key}`); if (v === 'known' || v === 'discover' || v === 'due') return v; } catch { /* ohne Speicher */ }
  return 'all';
}

function keptHeight(key: string): WorldHeight {
  try { const v = localStorage.getItem(`cg-wm-height:${key}`); if (v === 'low' || v === 'high') return v; } catch { /* ohne Speicher */ }
  return 'mid';
}

/* -- Spielfiguren und Fahne (SVG, dieselben in der Legende) ---------------------------------------------------------- */

/** Eine Figur (Fuss auf dem Feld bei 0,0): einzeln dunkel, auf dem Weg zum Ziel in der Farbe des Ziels; mit Zahl: mehrere. */
export function PieceIcon({ kind, h, count = 1 }: { kind: 'single' | 'goal'; h: number; count?: number }) {
  const r = h * 0.2;
  return (
    <g className={`cg-wm-piece is-${kind}`}>
      <ellipse className="cg-wm-piece-foot" cx={0} cy={0} rx={h * 0.3} ry={h * 0.1} />
      <path className="cg-wm-piece-body" d={`M${(-h * 0.24).toFixed(2)},0 Q${(-h * 0.2).toFixed(2)},${(-h * 0.5).toFixed(2)} 0,${(-h * 0.62).toFixed(2)} Q${(h * 0.2).toFixed(2)},${(-h * 0.5).toFixed(2)} ${(h * 0.24).toFixed(2)},0 Z`} />
      <circle className="cg-wm-piece-head" cx={0} cy={-h * 0.78} r={r} />
      {count > 1 && <text className="cg-wm-piece-count" x={h * 0.34} y={-h * 0.72}>{count}</text>}
    </g>
  );
}
export function GoalFlagIcon({ h }: { h: number }) {
  return (
    <g className="cg-wm-goalflag">
      <path d={`M0,0 V${(-h).toFixed(2)}`} className="cg-wm-goalflag-pole" />
      <path d={`M0,${(-h).toFixed(2)} L${(h * 0.62).toFixed(2)},${(-h * 0.8).toFixed(2)} L0,${(-h * 0.58).toFixed(2)} Z`} className="cg-wm-goalflag-cloth" />
    </g>
  );
}

/* -- Die Karte ------------------------------------------------------------------------------------------------- */

export function WorldMap({ world, topics, regionName, conquered, chosen, flash, home, links, route, width, compact, T, memoryKey, command, onPickTopic, onView, onBackground, legend, step, pieces, goalFlag, onPiece, onFlag, onStart, onHome, playback = null, onPlayback, replayLabel }: {
  world: WorldLayout;
  /** Die Höhe eines Schrittes dieser Baza (`stepFor`). */
  step: number;
  /** Die Spielfiguren des Lernenden (nur aus seinem eigenen Tun). */
  pieces: readonly WorldPiece[];
  /** Die Fahne auf seinem Ziel. */
  goalFlag: number | null;
  /** Eine Figur angetippt: das Thema dort, wo er war. */
  onPiece: (t: number) => void;
  /** Die Fahne angetippt: das Ziel mit seinem Weg. */
  onFlag: () => void;
  /** 2026-11-05 — das Haus in der Mitte: ein Klick (`false`) oder ein Doppelklick (`true`); fehlt es, wählt das Haus das Startthema. */
  onHome?: (double: boolean) => void;
  /** Ein Doppelklick auf ein Thema (nah): zum Lernen öffnen. */
  onStart: (t: number) => void;
  /** 2026-11-05 (Prompt 17) — was sich seit dem letzten Zeigen änderte: einmal abspielen (je neuer `id`; `worldPlay.ts`). */
  playback?: WorldPlayback | null;
  /** Was beim Abspielen geschieht: die Punkte kommen an, ein Gebiet ist erobert, das Ende. */
  onPlayback?: (e: PlaybackEvent) => void;
  /** „Pokaż zmiany" — eine Weile nach dem Zurückkommen (fehlt es: kein Knopf). */
  replayLabel?: string;
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
  /*
   * 2026-11-05 — höher (der Eigentümer: auf einer Seite „zu schmal, sollte höher sein"): klein bis 620 px statt 420,
   * gross bis 820 statt 700 — aber nie höher als drei Viertel des Fensters (klein) bzw. 85 % (gross), damit unter der
   * Karte noch etwas zu sehen bleibt.
   */
  const winH = typeof window === 'undefined' ? 900 : window.innerHeight;
  /* Im Vollbild eines Bausteins (`.wk-full`): so hoch, wie das Fenster unter Kopf und Knöpfen Platz lässt. */
  const [inFull, setInFull] = useState(false);
  const cap = inFull && !compact ? Math.max(320, winH - 230) : Math.max(320, Math.min(compact ? 620 : 820, winH * (compact ? 0.75 : 0.85)));
  const height = Math.round(Math.max(320, Math.min(cap, width * (width < 520 ? 1.05 : 0.7))));
  const n = world.cells.length;
  /* Die ganze Karte: Mitte und Halbmesser. */
  const whole = useMemo(() => {
    if (n === 0) return { x: 0, y: 0, r: 1 };
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const c of world.cells) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
    /* 2026-11-04 (Prompt 16, 1) — die ganze Karte um das Haus (die Mitte ist das Startthema). */
    if (world.home >= 0) { let r = 0; for (const c of world.cells) r = Math.max(r, Math.hypot(c.x, c.y)); return { x: 0, y: 0, r: r + 1.2 }; }
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) / 2 + 1.2 };
  }, [world, n]);
  const start: WorldCam = { s: 10, cx: whole.x, cy: whole.y, rot: 0, fore: FORE_START };
  const fitWhole = (c: WorldCam): WorldCam => fitCam(c, width, height, whole.x, whole.y, whole.r);
  const [cam, setCamNow] = useState<WorldCam>(() => keptCam(memoryKey) ?? fitWhole(start));
  const camRef = useRef(cam);
  const setCam = (c: WorldCam) => { camRef.current = c; setCamNow(c); };
  const sMin = () => fitWhole(camRef.current).s * 0.6;
  /* 2026-11-04 (vom Nutzer): tief hinein — bis nur noch zwei, drei Kacheln das Bild füllen. */
  const sMax = () => deepestS(width, height, camRef.current.fore);
  const clamp = (c: WorldCam): WorldCam => {
    const s = Math.max(sMin(), Math.min(sMax(), c.s));
    const pad = whole.r + 2;
    return { ...c, s, cx: Math.max(whole.x - pad, Math.min(whole.x + pad, c.cx)), cy: Math.max(whole.y - pad, Math.min(whole.y + pad, c.cy)), fore: Math.max(FORE_MIN, Math.min(FORE_MAX, c.fore)) };
  };
  /* 2026-11-04 (Prompt 15, 4b) — die Ansicht, gemerkt mit dem Blick. */
  const [mode, setModeNow] = useState<WorldMode>(() => keptMode(memoryKey));
  const setMode = (m: WorldMode) => { setModeNow(m); try { localStorage.setItem(`cg-wm-mode:${memoryKey}`, m); } catch { /* ohne Speicher */ } };
  /* 2026-11-04 (Prompt 16, 4) — die Höhe der Säulen, gemerkt mit dem Blick. */
  const [height3, setHeightNow] = useState<WorldHeight>(() => keptHeight(memoryKey));
  const setHeight = (h: WorldHeight) => { setHeightNow(h); try { localStorage.setItem(`cg-wm-height:${memoryKey}`, h); } catch { /* ohne Speicher */ } };
  const stepNow = step * HEIGHT_FACTOR[height3];
  /* Das oberste Gebiet, das gerade das Bild füllt (dann tragen seine Teilgebiete eigene Töne). */
  const [focusTop, setFocusTop] = useState<string | null>(null);
  /* Gemerkt, wenn er sich nicht mehr bewegt. */
  useEffect(() => { const id = window.setTimeout(() => keepCam(memoryKey, cam), 400); return () => window.clearTimeout(id); }, [cam, memoryKey]);

  /* -- Sanft: Gleiten (Zoom auf ein Gebiet), Drehen, Ausrollen --------------------------------------------------- */
  const frame = useRef(0);
  const stop = () => { if (frame.current !== 0) { cancelAnimationFrame(frame.current); frame.current = 0; } };
  useEffect(() => stop, []);
  /* 2026-11-05 (Prompt 17) — die Wahl „Animacje“ des Geräts (sonst das Betriebssystem): ohne volle Bewegung kein Gleiten. */
  const motion = useMotion();
  const reduced = motion !== 'full';
  const glide = (to: WorldCam, ms = 420) => {
    stop();
    const target = clamp(to);
    if (reduced) { setCam(target); return; }
    const from = camRef.current;
    const turn = ((((target.rot - from.rot) % 360) + 540) % 360) - 180;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      /* 2026-11-05 (Durchsicht) — gedreht wird auf dem kürzeren Weg (350° → 0° sind 10°, nicht 350°). */
      setCam({ s: from.s * (target.s / from.s) ** e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e, rot: from.rot + turn * e, fore: from.fore + (target.fore - from.fore) * e });
      frame.current = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };
  /* 2026-11-04 (Prompt 14) — frei drehen: der Knopf um 45°, sanft (keine Raster mehr). */
  const rotateBy = (k: number) => glide({ ...camRef.current, rot: camRef.current.rot + 45 * k }, 300);
  const resetView = () => glide(fitWhole({ ...camRef.current, rot: 0, fore: FORE_START }));
  /* 2026-11-04 (Prompt 15) — zu einem Gebiet: sein Rechteck füllt das Bild (ein Keil reicht vom Zuhause bis zum Rand; um seine Mitte gemessen wäre es fast die ganze Karte). */
  const regionCam = (key: string) => {
    const r = world.regions.get(key);
    if (r === undefined || r.topics.length === 0) return null;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const t of r.topics) { const c = world.cells[t]; x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
    return fitCam(camRef.current, width, height, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2 + 0.8);
  };
  /* Zu einem Thema: mindestens so nah, dass die Namen in den Kacheln stehen. */
  const topicCam = (t: number) => { const c = world.cells[t]; return { ...camRef.current, s: Math.max(camRef.current.s, (NAME_PX * 1.25) / (2 * 0.57735)), cx: c.x, cy: c.y }; };

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
  useLayoutEffect(() => { setInFull(box.current?.closest('.wk-full') != null); }, []);
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

  /*
    2026-11-05 (Prompt 17) — DAS ABSPIELEN (ersetzt das kurze Wachsen des Landes): was sich seit dem letzten Zeigen änderte,
    in einer Folge — Kamera, Säulen und Ringe, Umrisse und Schimmer, Figuren, Punkte, Gebiete. Gezeichnet wird dabei jedes
    Bild direkt (ohne das grosse Bild im Hintergrund); ein Klick oder eine Taste irgendwo überspringt den Rest.
  */
  const playRef = useRef<Play | null>(null);
  const playedId = useRef(0);
  const lastPb = useRef<WorldPlayback | null>(null);
  const [phase, setPhase] = useState<PlayPhase | null>(null);
  const [replayUntil, setReplayUntil] = useState(0);
  const onPlaybackRef = useRef(onPlayback);
  onPlaybackRef.current = onPlayback;
  const emit = (e: PlaybackEvent) => onPlaybackRef.current?.(e);
  const skipOff = useRef<(() => void) | null>(null);
  const playScr = useRef<Float32Array | null>(null);

  /* -- Zeichnen ------------------------------------------------------------------------------------------------- */
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [hoverTopic, setHoverTopic] = useState<number | null>(null);
  /* Die Mitte der Gebiete einer Ebene, die gerade benannt wird (für Klicks fern): je Thema das Gebiet, das den Namen trägt. */
  const px = cellPx(cam);
  const proj = useMemo(() => projection(cam, width, height, stepNow), [cam, width, height, stepNow]);
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
  /*
    Ein grösseres Bild im Hintergrund (eine halbe Breite Rand ringsum): beim Ziehen wird es nur verschoben — neu gezeichnet erst,
    wenn sich Zoom, Winkel oder Daten ändern oder der Rand erreicht ist. So bleibt eine Baza mit 5 000 Themen flüssig.
  */
  const cache = useRef<{ canvas: HTMLCanvasElement; cam: WorldCam; sig: string; margin: number } | null>(null);
  const lastChange = useRef(0);
  const idleRepaint = useRef(0);
  /* 2026-11-05 (Durchsicht) — das grosse Bild nur neu, wenn die Kamera ruht (nicht schon beim ersten Schritt einer Bewegung). */
  const rebuild = useRef(false);
  const dataTick = useRef(0);
  const dataSig = useMemo(() => { dataTick.current += 1; return dataTick.current; }, [topics, chosen, flash, links, route, home, hoverRegion, palette, world, mode, focusTop]); // eslint-disable-line react-hooks/exhaustive-deps
  const paint = () => {
    const el = canvas.current;
    if (el === null || palette === null) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) { el.width = Math.round(width * dpr); el.height = Math.round(height * dpr); }
    const ctx = el.getContext('2d');
    if (ctx === null) return;
    const A = playRef.current;
    if (A !== null) { drawPlay(ctx, dpr, A); return; }
    if (n < 1200) { draw(ctx, dpr); return; }
    const margin = Math.round(Math.max(width, height) * 0.5);
    const sig = [cam.s.toFixed(4), cam.rot.toFixed(3), cam.fore.toFixed(4), dataSig, width, height, stepNow].join('|');
    let c = cache.current;
    let dx = 0; let dy = 0;
    /*
      2026-11-04 (Prompt 14) — Drehen, Neigen, Zoomen ändern das Bild in jedem Schritt: dann direkt ins sichtbare Bild (das
      grosse mit Rand neu zu zeichnen kostete je Schritt das Vierfache); ruht die Kamera, wird das grosse wieder gebaut.
    */
    if (c !== null && c.sig !== sig && !rebuild.current) {
      lastChange.current = performance.now();
      draw(ctx, dpr);
      if (idleRepaint.current !== 0) window.clearTimeout(idleRepaint.current);
      idleRepaint.current = window.setTimeout(() => { idleRepaint.current = 0; lastChange.current = 0; rebuild.current = true; paintRef.current(); }, 280);
      return;
    }
    rebuild.current = false;
    if (c === null || c.sig !== sig) lastChange.current = performance.now();
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
      const p2 = projection(cam, cw, ch, stepNow);
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
  /* 2026-11-05 (Durchsicht) — Zeitgeber und Schleifen zeichnen mit dem neuesten `paint` (Kamera, Zeiger, Daten von jetzt). */
  const paintRef = useRef(paint);
  paintRef.current = paint;
  /* Die Leinwand so gross, wie gerechnet (sonst stauchte die Seite sie, Namen und Tipps lägen daneben). */
  useLayoutEffect(() => { const el = canvas.current; if (el !== null) { el.style.width = `${width}px`; el.style.height = `${height}px`; } }, [width, height]);
  /*
    2026-11-04 (Prompt 15, 4/4c) — WAS IN DEN KACHELN STEHT, gezeichnet mit ihrer Säule (`draw`): eine Säule davor deckt es zu.
    Gemessen wird einmal je Thema, Grösse und Ebene.
  */
  const fontFamily = useRef('');
  const fontCap = useRef(16);
  const fitCache = useRef(new Map<string, ReturnType<typeof fitInfo>>());
  useEffect(() => { fitCache.current.clear(); }, [topics]);
  /* Die Farbe jedes Themas: der Ton seines obersten Gebiets; im Gebiet, das das Bild füllt, je Teilgebiet ein benachbarter Ton. */
  const colourOf = useMemo((): number[][] => {
    if (palette === null) return [];
    return topics.map((t, i) => {
      const base = t.subject >= 0 && t.subject < 8 ? palette.c[t.subject] : palette.cx;
      const chain = world.chain[i] ?? [];
      if (focusTop === null || chain[0] !== focusTop || chain.length < 2) return base as number[];
      return shiftHue(base, SHADE_SHIFT[world.regions.get(chain[1])?.shade ?? 0] ?? 0);
    });
  }, [palette, topics, world, focusTop]);
  /** Welche Säule davor deckt den Punkt (sx, sy) auf der Oberseite von i — die Höhe ihrer Oberkante dort, sonst null. */
  const coverAt = (i: number, sx: number, sy: number, p: Projection, scr: Float32Array): number | null => {
    const c = world.cells[i];
    const di = scr[i * 3 + 2];
    const per = p.lift * p.step * p.s;
    let best: number | null = null;
    for (const [dq, dr] of NEAR3) {
      const j = byCell.current.get(`${c.q + dq},${c.r + dr}`);
      if (j === undefined || scr[j * 3 + 2] <= di + 1e-9) continue;
      const span = spanAt(p.corners, sx - scr[j * 3]);
      if (span === null) continue;
      const top = scr[j * 3 + 1] + span[0];
      const bottom = scr[j * 3 + 1] + (topics[j]?.steps ?? 0) * per + span[1];
      if (sy > top + 0.5 && sy < bottom) best = best === null ? top : Math.min(best, top);
    }
    return best;
  };
  /* 2026-11-05 (Prompt 17) — ein neues Abspielen beginnt VOR dem Zeichnen (das erste Bild zeigt schon den alten Stand). */
  useLayoutEffect(() => {
    if (playback === null || playback.id === playedId.current || palette === null || n === 0) return;
    playedId.current = playback.id;
    startPlay(playback, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.id, palette, n]);
  useLayoutEffect(() => { paint(); });
  useEffect(() => () => {
    const A = playRef.current;
    playRef.current = null;
    if (A !== null) { cancelAnimationFrame(A.raf); A.finishFlights?.(); }
    skipOff.current?.();
  }, []);

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
  const screenRef = useRef(screen);
  screenRef.current = screen;

  /* -- 2026-11-05 (Prompt 17): das Abspielen ------------------------------------------------------------------------ */
  /** Nah genug, dass die Namen in den Kacheln stehen (wie `topicCam`) — weiter hinein geht das Abspielen nie. */
  const nearS = (NAME_PX * 1.25) / (2 * 0.57735);
  /** Wohin die Kamera gleitet: alles, was sich änderte, im Bild (Neigung und Drehung bleiben); `null`: es ist schon zu sehen. */
  const changesCam = (pb: WorldPlayback): WorldCam | null => {
    const list = new Set<number>([...pb.learned, ...pb.reviewed, ...pb.opened, ...pb.points.map((x) => x.t)]);
    for (const k of pb.conquered) for (const t of world.regions.get(k)?.topics ?? []) list.add(t);
    if (list.size === 0) return null;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    let seen = true;
    const scr = screenRef.current;
    for (const t of list) {
      const c = world.cells[t];
      if (c === undefined) continue;
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
      const sx = scr[t * 3]; const sy = scr[t * 3 + 1];
      if (!(sx >= 24 && sx <= width - 24 && sy >= 24 && sy <= height - 24)) seen = false;
    }
    if (!Number.isFinite(x0)) return null;
    const far = fitWhole(camRef.current).s;
    if (seen && camRef.current.s >= far * 0.98 && cellPx(camRef.current) >= 6) return null;
    const fit = fitCam(camRef.current, width, height, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(2.6, Math.max(x1 - x0, y1 - y0) / 2 + 1.2));
    return clamp({ ...fit, s: Math.max(far, Math.min(fit.s, Math.max(nearS, far))) });
  };
  const camDiffers = (a: WorldCam, b: WorldCam): boolean => Math.abs(Math.log(b.s / a.s)) > 0.1 || Math.hypot(b.cx - a.cx, b.cy - a.cy) * a.s > Math.min(width, height) * 0.1;
  /** „+N" von den Feldern zum Zähler (die grössten einzeln, der Rest als eine Summe aus der Mitte der übrigen). */
  const flyAll = (A: Play): (() => void) | null => {
    const el = canvas.current;
    const counter = box.current?.closest('.cg-ls')?.querySelector('[data-rw-counter]') ?? null;
    const total = playPoints(A.pb);
    if (el === null || total <= 0) { if (total > 0) emit({ kind: 'points', id: A.pb.id, n: total }); return null; }
    const r = el.getBoundingClientRect();
    const scr = screenRef.current;
    const inside = (x: number, y: number): [number, number] => [r.left + Math.max(8, Math.min(width - 8, Number.isFinite(x) ? x : width / 2)), r.top + Math.max(8, Math.min(height - 8, Number.isFinite(y) ? y : height / 2))];
    const sorted = [...A.pb.points].sort((a, b) => b.n - a.n);
    const items = sorted.slice(0, FLY_SINGLE).map((x) => { const [fx, fy] = inside(scr[x.t * 3], scr[x.t * 3 + 1] - 6); return { n: x.n, x: fx, y: fy }; });
    const others = sorted.slice(FLY_SINGLE);
    const restN = others.reduce((sum, x) => sum + x.n, 0) + A.pb.rest;
    if (restN > 0) {
      let sx = 0; let sy = 0;
      for (const x of others) { sx += scr[x.t * 3]; sy += scr[x.t * 3 + 1]; }
      const [fx, fy] = others.length === 0 ? inside(width / 2, height / 2) : inside(sx / others.length, sy / others.length);
      items.push({ n: restN, x: fx, y: fy });
    }
    return flyPoints(items, counter, undefined, { ms: FLY_MS, gap: FLY_GAP, onEach: (k) => emit({ kind: 'points', id: A.pb.id, n: k }) });
  };
  const finishPlay = (skipped: boolean) => {
    const A = playRef.current;
    if (A === null) return;
    playRef.current = null;
    if (A.raf !== 0) cancelAnimationFrame(A.raf);
    skipOff.current?.();
    skipOff.current = null;
    if (skipped && A.camTo !== null) { stop(); setCam(clamp(A.camTo)); }
    if (!A.sentPoints) { A.sentPoints = true; const left = playPoints(A.pb); if (left > 0) emit({ kind: 'points', id: A.pb.id, n: left }); } else A.finishFlights?.();
    if (!A.sentRegions) { A.sentRegions = true; if (A.regions.length > 0) emit({ kind: 'regions', id: A.pb.id, keys: A.regions }); }
    walks.current.clear();
    setPhase(null);
    emit({ kind: 'end', id: A.pb.id, skipped });
    if (A.pb.kind === 'return' && A.motion !== 'off') setReplayUntil(Date.now() + 60_000);
    paintRef.current();
  };
  const startPlay = (pb: WorldPlayback, replay: boolean) => {
    if (playRef.current !== null) finishPlay(true);
    const motion = motionLevel();
    lastPb.current = pb;
    const N = topics.length;
    const h0 = new Float32Array(N).fill(Number.NaN);
    const s0 = new Float32Array(N).fill(Number.NaN);
    const b0 = new Uint8Array(N).fill(255);
    const d0 = new Uint8Array(N);
    const land0 = new Uint8Array(N);
    const ready0 = new Uint8Array(N);
    const mark = new Uint8Array(N);
    const glow = new Uint8Array(N);
    for (let i = 0; i < N; i += 1) {
      const t = topics[i];
      d0[i] = t.due ? 1 : 0; land0[i] = t.band === 'known' || t.band === 'due' ? 1 : 0; ready0[i] = t.band === 'ring' ? 1 : 0;
      if (pb.kind === 'first') { h0[i] = 0; s0[i] = 0; continue; }
      const b = pb.before[i] ?? null;
      /* Neu auf der Karte: steigt auf, sein Rand zeichnet sich. */
      if (b === null) { h0[i] = 0; s0[i] = 0; land0[i] = 0; ready0[i] = 0; continue; }
      d0[i] = b.due ? 1 : 0; land0[i] = b.band === 'known' || b.band === 'due' ? 1 : 0; ready0[i] = b.band === 'ring' ? 1 : 0;
      if (b.steps !== t.steps) h0[i] = b.steps;
      if (Math.abs(b.share - t.share) > 0.004) s0[i] = b.share;
      if (b.band !== t.band) b0[i] = BAND_IX[b.band ?? ''] ?? 0;
    }
    for (const i of pb.reviewed) if (i < N) mark[i] = 1;
    for (const i of pb.opened) if (i < N) mark[i] = 2;
    for (const key of pb.conquered) for (const i of world.regions.get(key)?.topics ?? []) if (i < N) glow[i] = 1;
    const late = pb.kind === 'first' ? [] : [...pb.lowered, ...pb.moved, ...pb.fresh].filter((i) => i < N && !Number.isNaN(h0[i]));
    const delay = waveDelays(world.cells, pb.kind, pb.learned.length > 0 ? pb.learned : pb.opened, late);
    let wave = 0;
    for (let i = 0; i < delay.length; i += 1) wave = Math.max(wave, delay[i]);
    const camFrom = camRef.current;
    const target = pb.kind === 'return' && !replay ? changesCam(pb) : null;
    const camTo = target !== null && camDiffers(camFrom, target) ? target : null;
    const flights = pb.kind === 'return' ? Math.min(FLY_SINGLE + 1, pb.points.length + (pb.rest > 0 ? 1 : 0)) : 0;
    const times = playTimes({ kind: pb.kind, motion, camMove: camTo !== null, wave, lines: pb.learned.length + pb.opened.length + pb.fresh.length > 0, pulses: pb.reviewed.length > 0, walks: pb.walks.length > 0, flights, regions: pb.conquered.length > 0 });
    const A: Play = { pb, t0: performance.now(), times, motion, delay, h0, s0, b0, d0, land0, ready0, mark, glow, regions: pb.conquered, camFrom, camTo, fade: null, raf: 0, sentPoints: pb.kind !== 'return', sentRegions: false, finishFlights: null, left: false };
    playRef.current = A;
    emit({ kind: 'start', id: pb.id, points: pb.kind === 'return' ? playPoints(pb) : 0 });
    if (motion === 'off') { if (camTo !== null) setCam(clamp(camTo)); finishPlay(false); return; }
    /* „ograniczone": nur eine Überblendung — das alte Bild (alte Kamera, alter Stand), darüber vergehend. */
    if (motion === 'reduced') {
      const el = canvas.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const off = document.createElement('canvas');
      off.width = Math.round(width * dpr); off.height = Math.round(height * dpr);
      const octx = off.getContext('2d');
      if (octx !== null && el !== null && palette !== null) {
        const scr = new Float32Array(n * 3);
        for (let i = 0; i < n; i += 1) { const c = world.cells[i]; const [x, y] = toScreen(proj, c.x, c.y, stepsAt(A, i, topics[i]?.steps ?? 0, -1)); scr[i * 3] = x; scr[i * 3 + 1] = y; scr[i * 3 + 2] = depthOf(proj, c.x, c.y); }
        draw(octx, dpr, proj, scr, width, height, -1);
        A.fade = off;
      }
      if (camTo !== null) setCam(clamp(camTo));
    }
    walks.current.clear();
    if (motion === 'full') for (const w of pb.walks) walks.current.set(w.to, { from: w.from, at: A.t0 + times.walk0, ms: WALK_MS });
    setPhase({ id: pb.id, flags: false, hide: new Set(pb.conquered), rise: new Set(pb.conquered), leaving: pb.leaving, left: false });
    skipOff.current = listenSkip(() => finishPlay(true));
    const loop = () => {
      if (playRef.current !== A) return;
      if (topics.length !== A.h0.length && topicsRef.current.length !== A.h0.length) { finishPlay(true); return; }
      const tau = performance.now() - A.t0;
      let rendered = false;
      if (A.camTo !== null && A.times.cam1 > 0 && tau <= A.times.cam1 + 40) { setCam(lerpCam(A.camFrom, A.camTo, easeInOut(clamp01(tau / A.times.cam1)))); rendered = true; }
      if (!A.sentPoints && tau >= A.times.pts0) { A.sentPoints = true; A.finishFlights = flyAll(A); }
      if (!A.left && tau >= A.times.walk0) { A.left = true; if (A.pb.leaving.length > 0) { setPhase((ph) => (ph === null ? ph : { ...ph, left: true })); rendered = true; } }
      if (!A.sentRegions && tau >= A.times.reg0) {
        A.sentRegions = true;
        if (A.regions.length > 0) { setPhase((ph) => (ph === null ? ph : { ...ph, flags: true, hide: new Set() })); emit({ kind: 'regions', id: A.pb.id, keys: A.regions }); rendered = true; }
      }
      if (A.pb.walks.length > 0 && A.motion === 'full' && tau >= A.times.walk0 - 20 && tau <= A.times.walk1 + 20) { setWalkTick((x) => x + 1); rendered = true; }
      if (tau >= A.times.end) { finishPlay(false); return; }
      /* Ein neues Rendern zeichnet von selbst (`useLayoutEffect`); sonst hier. */
      if (!rendered) paintRef.current();
      A.raf = requestAnimationFrame(loop);
    };
    A.raf = requestAnimationFrame(loop);
    paintRef.current();
  };
  const topicsRef = useRef(topics);
  topicsRef.current = topics;
  /** Ein Bild beim Abspielen: die Säulen auf ihrer Höhe von jetzt — „ograniczone": das neue Bild, das alte vergeht darüber. */
  const drawPlay = (ctx: CanvasRenderingContext2D, dpr: number, A: Play) => {
    const tau = performance.now() - A.t0;
    if (A.fade !== null) {
      draw(ctx, dpr);
      const k = clamp01(tau / Math.max(1, A.times.fade));
      if (k < 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - k; ctx.drawImage(A.fade, 0, 0); ctx.globalAlpha = 1; }
      return;
    }
    let scr = playScr.current;
    if (scr === null || scr.length !== n * 3) { scr = new Float32Array(n * 3); playScr.current = scr; }
    for (let i = 0; i < n; i += 1) { const c = world.cells[i]; const [x, y] = toScreen(proj, c.x, c.y, stepsAt(A, i, topics[i]?.steps ?? 0, tau)); scr[i * 3] = x; scr[i * 3 + 1] = y; scr[i * 3 + 2] = depthOf(proj, c.x, c.y); }
    draw(ctx, dpr, proj, scr, width, height, tau);
  };
  /* Der Knopf „Pokaż zmiany" geht nach einer Weile. */
  useEffect(() => {
    if (replayUntil === 0) return undefined;
    const id = window.setTimeout(() => setReplayUntil(0), Math.max(0, replayUntil - Date.now()) + 50);
    return () => window.clearTimeout(id);
  }, [replayUntil]);

  function draw(ctx: CanvasRenderingContext2D, dpr: number, p: Projection = proj, scr: Float32Array = screen, cw = width, ch = height, tauAt?: number) {
    const P = palette!;
    /* 2026-11-05 (Prompt 17) — beim Abspielen: wie weit jeder Teil ist (`tauAt`, ms seit dem Anfang; -1: der alte Stand). */
    const A = tauAt === undefined ? null : playRef.current;
    const tau = tauAt ?? 0;
    const kOf = (i: number): number => (A === null ? 1 : easeOut(colK(A, i, tau)));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const corners = p.corners;
    const margin = Math.max(30, p.s * 2);
    const hexPath = (x: number, y: number) => { ctx.moveTo(x + corners[0][0], y + corners[0][1]); for (let k = 1; k < 6; k += 1) ctx.lineTo(x + corners[k][0], y + corners[k][1]); ctx.closePath(); };
    /* Der Boden: das Zuhause und ein Platz um alles. */
    ctx.beginPath();
    for (const g of world.ground) { const [x, y] = toScreen(p, g.x, g.y); if (x < -margin || x > cw + margin || y < -margin || y > ch + margin) continue; hexPath(x, y); }
    ctx.fillStyle = css(P.floor);
    ctx.fill();
    /* Von hinten nach vorn. */
    const order: number[] = [];
    for (let i = 0; i < n; i += 1) { const x = scr[i * 3]; const y = scr[i * 3 + 1]; if (x < -margin || x > cw + margin || y < -margin - 400 || y > ch + margin + 200) continue; order.push(i); }
    order.sort((a, b) => scr[a * 3 + 2] - scr[b * 3 + 2]);
    const lift = p.lift * p.step * p.s;
    const now = performance.now();
    /* Welche Seiten nach vorn zeigen (ihre Mitte liegt unter der Mitte der Kachel). */
    const front = [0, 1, 2, 3, 4, 5].filter((k) => (corners[k][1] + corners[(k + 1) % 6][1]) / 2 > 1e-6);
    /* Dieselben Seiten als zusammenhängende Folge (über die Ecke 5→0 hinweg), für die eine Fläche fern. */
    const frontRun = (() => { const set = new Set(front); let s0 = front[0] ?? 0; while (set.has((s0 + 5) % 6) && set.size < 6) s0 = (s0 + 5) % 6; const out: number[] = []; for (let k = s0; set.has(k % 6) && out.length < set.size; k += 1) out.push(k % 6); return out.length > 0 ? out : [0]; })();
    const regionHi = hoverRegion;
    const showGlow = px >= 6;
    /* Blass ist im Dunkeln ein mittleres Grau (nicht das dunkle Licht des Stils): ferne Berge bleiben lesbar. */
    const dark = (P.floor[0] + P.floor[1] + P.floor[2]) / 3 < 90;
    const pale = dark ? [128, 126, 122] : P.light;
    /* Hell und satt sind für das Wissen: gekonnt kräftig, lernbar mittel, fern blass (die Farbe nur für das Gebiet). */
    const faceFor = (band: LsBand | null, steps: number, regionC: number[]): number[] => (band === 'known' || band === 'due' ? regionC
      : band === 'ring' ? mix(regionC, pale, dark ? 0.3 : 0.55) : mix(mix(regionC, pale, dark ? 0.55 : 0.78), P.haze, Math.min(dark ? 0.35 : 0.55, steps / 28)));
    const shine = dark ? [255, 246, 214] : [255, 255, 255];
    const regionK = A === null ? -1 : (tau - A.times.reg0) / REGION_MS;
    const at = byCell.current;
    const isLand = (i: number) => { const b = topics[i]?.band; return b === 'known' || b === 'due'; };
    const isReady = (i: number) => topics[i]?.band === 'ring';
    /*
      2026-11-04 (Prompt 16, 3) — die Ansicht: „Co umiem" nur Gekonntes in Farbe (mit dem orangeroten Umriss), „Do odkrycia"
      nur das jetzt Lernbare (mit dem hellgelben Umriss, das Gekonnte blass darum), „Do powtórki" nur Fälliges.
    */
    const greyed = (i: number): boolean => { const t = topics[i]; if (t === undefined) return false; if (mode === 'known') return !isLand(i); if (mode === 'discover') return !isReady(i); if (mode === 'due') return !t.due; return false; };
    const showLand = mode === 'all' || mode === 'known';
    const showReady = mode === 'all' || mode === 'discover';
    const outlines = showLand || showReady;
    const line = Math.max(1.2, Math.min(3.2, px / 9));
    /* Die Kanten eines Feldes, an denen die Menge endet (der Rand des eigenen Landes). */
    const edges = (i: number, x: number, y: number, inSet: (j: number) => boolean) => {
      const c = world.cells[i];
      for (let k = 0; k < 6; k += 1) {
        const [dq, dr] = EDGE_DIR[k];
        const j = at.get(`${c.q + dq},${c.r + dr}`);
        if (j !== undefined && inSet(j)) continue;
        const a = corners[k]; const b = corners[(k + 1) % 6];
        ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]);
      }
    };
    const strokeEdges = (colour: number[], w: number, alpha: number) => { ctx.strokeStyle = css(colour, alpha); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
    /**
     * 2026-11-05 (Prompt 17) — die Kanten beim Abspielen: was beide Male Rand ist, ganz; was neu Rand ist, so weit gezeichnet,
     * wie `k` sagt (von seiner ersten Ecke aus); was nicht mehr Rand ist, vergeht.
     */
    const animEdges = (i: number, x: number, y: number, inNow: (j: number) => boolean, inWas: (j: number) => boolean, k: number, colour: number[], w: number) => {
      const iNow = inNow(i); const iWas = inWas(i);
      if (!iNow && !iWas) return;
      const c = world.cells[i];
      let fading = false;
      ctx.beginPath();
      for (let e = 0; e < 6; e += 1) {
        const [dq, dr] = EDGE_DIR[e];
        const j = at.get(`${c.q + dq},${c.r + dr}`);
        const nowEdge = iNow && !(j !== undefined && inNow(j));
        const wasEdge = iWas && !(j !== undefined && inWas(j));
        const a = corners[e]; const b = corners[(e + 1) % 6];
        if (nowEdge && (wasEdge || k >= 1)) { ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]); }
        else if (nowEdge && k > 0) { ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + a[0] + (b[0] - a[0]) * k, y + a[1] + (b[1] - a[1]) * k); }
        else if (wasEdge && !nowEdge && k < 1) fading = true;
      }
      strokeEdges(colour, w, 0.95);
      if (!fading) return;
      ctx.beginPath();
      for (let e = 0; e < 6; e += 1) {
        const [dq, dr] = EDGE_DIR[e];
        const j = at.get(`${c.q + dq},${c.r + dr}`);
        const nowEdge = iNow && !(j !== undefined && inNow(j));
        const wasEdge = iWas && !(j !== undefined && inWas(j));
        if (!wasEdge || nowEdge) continue;
        const a = corners[e]; const b = corners[(e + 1) % 6];
        ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]);
      }
      strokeEdges(colour, w, 0.95 * (1 - k));
    };
    /*
      2026-11-04 (Prompt 15, 4) — DER RING AM RAND DER KACHEL: auf einem etwas kleineren Sechseck, von oben im Uhrzeigersinn;
      kräftig, was sitzt (mittlere Kenntnis der Karten), blass der Rest, ein Punkt oben: etwas ist fällig. Unabhängig von der
      Farbe des Gebiets. Für alle Kacheln derselbe Weg (eine Kamera): einmal je Bild gerechnet.
    */
    const ringOn = px >= RING_PX && !far;
    const ring = ringOn ? ringPath(corners, 0.8) : null;
    const ringW = Math.max(1.3, Math.min(3.2, px * 0.035));
    const strokeRing = (x: number, y: number, share: number, due: number) => {
      if (ring === null) return;
      ctx.beginPath();
      ring.pts.forEach(([rx, ry], k) => { if (k === 0) ctx.moveTo(x + rx, y + ry); else ctx.lineTo(x + rx, y + ry); });
      ctx.strokeStyle = css(P.ink, dark ? 0.22 : 0.16); ctx.lineWidth = ringW; ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.stroke();
      const len = Math.max(0, Math.min(1, share)) * ring.total;
      if (len > 0.5) {
        ctx.beginPath();
        ctx.moveTo(x + ring.pts[0][0], y + ring.pts[0][1]);
        for (let k = 1; k < ring.pts.length; k += 1) {
          if (ring.acc[k] <= len) { ctx.lineTo(x + ring.pts[k][0], y + ring.pts[k][1]); continue; }
          const f = (len - ring.acc[k - 1]) / Math.max(1e-9, ring.acc[k] - ring.acc[k - 1]);
          ctx.lineTo(x + ring.pts[k - 1][0] + (ring.pts[k][0] - ring.pts[k - 1][0]) * f, y + ring.pts[k - 1][1] + (ring.pts[k][1] - ring.pts[k - 1][1]) * f);
          break;
        }
        ctx.strokeStyle = css(P.ink, dark ? 0.8 : 0.62); ctx.lineCap = 'round'; ctx.stroke();
      }
      /* 2026-11-05 (Prompt 17) — der Punkt kann vergehen (`due` 0–1): eine Wiederholung ist erledigt. */
      if (due > 0.01) {
        ctx.beginPath(); ctx.arc(x + ring.pts[0][0], y + ring.pts[0][1], ringW * 1.35, 0, Math.PI * 2);
        ctx.fillStyle = css(P.warm, Math.min(1, due)); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = css(P.surface, 0.9 * Math.min(1, due)); ctx.stroke();
      }
    };
    /* Die Namen in der Kachel (nah), nur wenn ihre Mitte nicht von einer Säule davor verdeckt ist. */
    const textOn = palette !== null && px >= NAME_PX && cam.fore >= INFO_FORE && !far;
    const deep = textOn && px >= detailPx(width, height, cam.fore) * 0.98;
    /* Die normale serifenlose Schrift (nicht die der Überschriften), nie grösser als die Schrift der Seite. */
    if (textOn && fontFamily.current === '') { fontFamily.current = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; try { fontCap.current = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; } catch { fontCap.current = 16; } }
    const ang = (infoAngle(cam.rot) * Math.PI) / 180;
    const ca = Math.cos(ang); const sa = Math.sin(ang);
    const textR = p.s * 0.42;
    const measure = (text: string, size: number, bold: boolean) => { ctx.font = `${bold ? '600 ' : ''}${size}px ${fontFamily.current}`; return ctx.measureText(text).width; };
    let drawnText = 0; let insideText = 0; let hiddenText = 0; let rings = 0;
    /*
      2026-11-04 (Prompt 16, 1; vom Nutzer) — DAS HAUS hat ein eigenes Feld in der Mitte (kein Thema darauf): eine flache helle
      Kachel, darauf ein einfaches Haus wie ein Name — liegend, mit der Neigung gestaucht und mit der Kachel gedreht; in der
      Reihenfolge der Säulen gezeichnet (davor Stehendes deckt es).
    */
    const [homeX, homeY] = toScreen(p, 0, 0, 0);
    const homeDepth = depthOf(p, 0, 0);
    let homeDrawn = n === 0;
    const drawHome = () => {
      homeDrawn = true;
      ctx.beginPath(); hexPath(homeX, homeY);
      ctx.fillStyle = css(mix(P.surface, P.light, 0.4)); ctx.fill();
      ctx.lineWidth = Math.max(1, line * 0.7); ctx.strokeStyle = css(P.ink, 0.35); ctx.stroke();
      const hs = p.s * 0.5;
      ctx.setTransform(dpr * ca, dpr * sa * cam.fore, -dpr * sa, dpr * ca * cam.fore, homeX * dpr, homeY * dpr);
      houseIcon(ctx, hs, P);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    for (const i of order) {
      const t = topics[i];
      if (t === undefined) continue;
      if (!homeDrawn && scr[i * 3 + 2] > homeDepth) drawHome();
      const x = scr[i * 3];
      const top = scr[i * 3 + 1];
      const h = (A === null ? t.steps : stepsAt(A, i, t.steps, tau)) * lift;
      const base = top + h;
      const regionC = colourOf[i] ?? P.cx;
      let face = faceFor(t.band, t.steps, regionC);
      /* 2026-11-05 (Prompt 17) — beim Abspielen: die Farbe geht vom alten Band zum neuen (eine gelernte Säule füllt sich). */
      if (A !== null && A.b0[i] !== 255) face = mix(faceFor(BAND_OF[A.b0[i]] ?? null, Number.isNaN(A.h0[i]) ? t.steps : A.h0[i], regionC), face, kOf(i));
      const g1 = greyed(i) ? 1 : 0;
      const g0 = A === null ? g1 : greyedBefore(A, i, mode);
      /* In „Do powtórki" wird eine erledigte Wiederholung grau — mit ihrem Puls. */
      const grayK = A === null || g0 === g1 ? g1 : g0 + (g1 - g0) * (A.mark[i] === 1 && mode === 'due' ? pulseK(A, i, tau) : kOf(i));
      if (grayK > 0) { const l = face[0] * 0.3 + face[1] * 0.59 + face[2] * 0.11; const grey = mix([l, l, l], P.haze, 0.45); face = mix(face, mode === 'discover' && isLand(i) ? mix(grey, face, 0.4) : grey, grayK); }
      /* Ein eben erobertes Gebiet leuchtet einmal. */
      if (A !== null && A.glow[i] === 1 && regionK > 0 && regionK < 1) face = mix(face, P.surface, 0.3 * Math.sin(Math.PI * regionK));
      /* 2026-11-04 (Prompt 15, 3) — ein Gebiet unter dem Zeiger leuchtet, die anderen treten zurück. */
      if (regionHi !== null) face = (world.chain[i] ?? []).includes(regionHi) ? mix(face, P.surface, 0.16) : mix(face, P.haze, 0.6);
      /* Die Seiten (eine Fläche je sichtbarer Seite, dunkler). */
      if (h > 0.4 && px < 12) {
        /* Fern (kleine Kacheln): alle Seiten als EINE Fläche — so bleiben 5 000 Säulen auch beim Drehen flüssig. */
        const first = frontRun[0]; const last = frontRun[frontRun.length - 1];
        ctx.beginPath();
        ctx.moveTo(x + corners[first][0], top + corners[first][1]);
        for (const k of frontRun) { const b = corners[(k + 1) % 6]; ctx.lineTo(x + b[0], top + b[1]); }
        ctx.lineTo(x + corners[(last + 1) % 6][0], base + corners[(last + 1) % 6][1]);
        for (let j = frontRun.length - 1; j >= 0; j -= 1) { const a = corners[frontRun[j]]; ctx.lineTo(x + a[0], base + a[1]); }
        ctx.closePath();
        ctx.fillStyle = css(mix(face, [0, 0, 0], 0.24));
        ctx.fill();
      } else if (h > 0.4) {
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
      if (i === chosen || i === flash) { ctx.strokeStyle = css(P.accent); ctx.lineWidth = i === flash ? 3.4 : 2.6; ctx.stroke(); }
      /* 2026-11-05 (Prompt 17) — neu lernbar: ein heller Schimmer läuft einmal über die Oberseite. */
      if (A !== null && A.mark[i] === 2) {
        const sk = (tau - A.times.line0) / SHIMMER_MS;
        if (sk > 0 && sk < 1) {
          const R = p.s * 0.62;
          const sx0 = x - R * 1.2 + 2.4 * R * sk;
          ctx.save(); ctx.beginPath(); hexPath(x, top); ctx.clip();
          const g = ctx.createLinearGradient(sx0 - R * 0.45, top - R * 0.4, sx0 + R * 0.45, top + R * 0.4);
          g.addColorStop(0, css(shine, 0)); g.addColorStop(0.5, css(shine, 0.72)); g.addColorStop(1, css(shine, 0));
          ctx.fillStyle = g; ctx.fillRect(x - R * 1.3, top - R * 1.3, R * 2.6, R * 2.6);
          ctx.restore();
        }
      }
      /*
        2026-11-04 (Prompt 15, 4c) — was auf der Oberseite liegt, in der Reihenfolge der Säulen: Umriss (voll), Ring, Name.
        Eine Säule davor deckt es zu; wo sie es deckt, bleibt der Umriss dünn sichtbar (der zweite Durchgang unten).
      */
      if (A === null) {
        if (showLand && isLand(i)) { ctx.beginPath(); edges(i, x, top, isLand); strokeEdges(P.land, line * 1.15, 0.95); }
        if (showReady && showGlow && isReady(i)) { ctx.beginPath(); edges(i, x, top, isReady); strokeEdges(P.ready, line, 0.95); }
      } else {
        /* 2026-11-05 (Prompt 17) — der Rand wächst entlang der neuen Grenze (zeichnet sich), der alte vergeht. */
        const lk = easeOut(clamp01((tau - A.times.line0) / LINE_MS));
        if (showLand) animEdges(i, x, top, isLand, (j) => A.land0[j] === 1, lk, P.land, line * 1.15);
        if (showReady && showGlow) animEdges(i, x, top, isReady, (j) => A.ready0[j] === 1, lk, P.ready, line);
      }
      const dueWas = A !== null && A.d0[i] === 1;
      if (ringOn && (mode !== 'due' || t.due || (A !== null && dueWas && pulseK(A, i, tau) < 1)) && grayK < 1) {
        /* Der Ring füllt sich im Uhrzeigersinn, der Punkt vergeht (oder erscheint). */
        const share = A === null || Number.isNaN(A.s0[i]) ? t.share : A.s0[i] + (t.share - A.s0[i]) * kOf(i);
        const dot = A === null || dueWas === t.due ? (t.due ? 1 : 0) : t.due ? kOf(i) : 1 - kOf(i);
        strokeRing(x, top, share, dot);
        rings += 1;
      }
      /* Eine erledigte Wiederholung: ein Puls in der Farbe ihres Gebiets. */
      if (A !== null && A.mark[i] === 1) {
        const pk = pulseK(A, i, tau);
        if (pk > 0 && pk < 1) {
          const f = 1 + 0.32 * easeOut(pk);
          ctx.beginPath(); ctx.moveTo(x + corners[0][0] * f, top + corners[0][1] * f);
          for (let k = 1; k < 6; k += 1) ctx.lineTo(x + corners[k][0] * f, top + corners[k][1] * f);
          ctx.closePath();
          ctx.strokeStyle = css(regionC, 0.9 * (1 - pk)); ctx.lineWidth = Math.max(1.5, line * 1.5); ctx.stroke();
        }
      }
      if (textOn && x > -textR && x < cw + textR && top > -textR && top < ch + textR) {
        if (coverAt(i, x, top, p, scr) !== null) { hiddenText += 1; continue; }
        const fk = `${i}|${Math.round(textR)}|${deep ? 1 : 0}|${t.todo}`;
        let fit = fitCache.current.get(fk);
        if (fit === undefined) { fit = fitInfo(t.label, t.todo, deep, textR, measure, fontCap.current); if (fitCache.current.size > 6000) fitCache.current.clear(); fitCache.current.set(fk, fit); }
        drawnText += 1;
        if (x >= 0 && x <= cw && top >= 0 && top <= ch) insideText += 1;
        /* Auf die Fläche: drehen wie die Kachel, die Tiefe stauchen wie die Neigung. */
        ctx.setTransform(dpr * ca, dpr * sa * cam.fore, -dpr * sa, dpr * ca * cam.fore, x * dpr, top * dpr);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const l of fit.lines) {
          ctx.font = `${l.bold ? '600 ' : ''}${l.size}px ${fontFamily.current}`;
          ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = css(P.surface, 0.42); ctx.strokeText(l.text, 0, l.y);
          ctx.fillStyle = css(P.ink); ctx.fillText(l.text, 0, l.y);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    if (!homeDrawn) drawHome();
    /* Wo eine Säule davor den Umriss deckt: dünn (etwa ein Drittel) und etwas heller darüber — der Rand bleibt lesbar. */
    if (outlines && A === null) {
      ctx.beginPath();
      if (showLand) for (const i of order) if (isLand(i)) edges(i, scr[i * 3], scr[i * 3 + 1], isLand);
      strokeEdges(mix(P.land, P.surface, 0.3), Math.max(0.8, line * 0.38), 0.9);
      if (showGlow && showReady) {
        ctx.beginPath();
        for (const i of order) if (isReady(i)) edges(i, scr[i * 3], scr[i * 3 + 1], isReady);
        strokeEdges(mix(P.ready, P.surface, 0.3), Math.max(0.7, line * 0.33), 0.9);
      }
    }
    /* 2026-11-05 (Prompt 17) — das eroberte Gebiet: sein Rand leuchtet einmal auf. */
    if (A !== null && A.regions.length > 0 && regionK > 0 && regionK < 1) {
      const a = Math.sin(Math.PI * regionK);
      for (const key of A.regions) {
        const r = world.regions.get(key);
        if (r === undefined) continue;
        const inR = (j: number) => (world.chain[j] ?? []).includes(key);
        const ti = world.top.indexOf(r.top);
        ctx.beginPath();
        for (const t2 of r.topics) edges(t2, scr[t2 * 3], scr[t2 * 3 + 1], inR);
        strokeEdges(P.surface, line * 3.2, 0.8 * a);
        strokeEdges(ti < 0 ? P.land : (P.c[ti % 8] as number[]), line * 1.5, 0.95 * a);
      }
    }
    /* Das Gebiet unter dem Zeiger: sein Rand leuchtet. */
    if (regionHi !== null) {
      const r = world.regions.get(regionHi);
      if (r !== undefined) {
        const inR = (j: number) => (world.chain[j] ?? []).includes(regionHi);
        ctx.beginPath();
        for (const i of r.topics) edges(i, scr[i * 3], scr[i * 3 + 1], inR);
        strokeEdges(P.surface, line * 2.2, 0.85);
      }
    }
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
    if (route !== null && route.length > 1 && px >= RING_PX) {
      ctx.beginPath();
      route.forEach((j, k) => { const x = scr[j * 3]; const y = scr[j * 3 + 1]; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = css(P.accent, 0.85);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    /* 2026-11-04 (Prompt 16) — kein Punkt „hier bist du“ mehr (das Haus und die Figuren zeigen, wo man ist). */
    /* Für Prüfungen: was im sichtbaren Bild steht. */
    {
      const el = box.current;
      if (el !== null) {
        el.dataset.wmInfo = String(drawnText); el.dataset.wmInfoIn = String(insideText); el.dataset.wmInfoHidden = String(hiddenText); el.dataset.wmRings = String(rings);
        el.dataset.wmTier = textOn ? (deep ? 'deep' : 'names') : '';
        el.dataset.wmHomeXy = scr === screen ? `${homeX.toFixed(0)},${homeY.toFixed(0)}` : el.dataset.wmHomeXy ?? '';
        el.dataset.wmChosenXy = chosen === null ? '' : `${screen[chosen * 3].toFixed(0)},${screen[chosen * 3 + 1].toFixed(0)}`;
      }
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
    const per = proj.step * proj.lift * proj.s;
    let best: number | null = null;
    let depth = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const x = screen[i * 3];
      if (sx < x - half || sx > x + half) continue;
      const top = screen[i * 3 + 1];
      const base = top + (topics[i]?.steps ?? 0) * per;
      /* 2026-11-05 — der Umriss des Sechsecks, nicht sein Rechteck: zu den Ecken links und rechts wird es niedriger (dort sieht man das Feld dahinter, etwa das Haus). */
      const reach = face * Math.min(1, Math.max(0, (half - Math.abs(sx - x)) / (half / 2)));
      if (sy < top - reach || sy > base + reach) continue;
      if (screen[i * 3 + 2] > depth) { depth = screen[i * 3 + 2]; best = i; }
    }
    return best;
  };

  /** Ein Tippen auf eine Figur, die Fahne oder den Namen eines Gebiets — „true", wenn es etwas traf. */
  /* 2026-11-05 — wann das Haus zuletzt angetippt wurde (der zweite Tipp kurz danach: alles im ganzen Fenster). */
  const homeTap = useRef<number | null>(null);
  const tapOverlay = (x: number, y: number): boolean => {
    for (const p of [...shownPieces].reverse()) {
      const [px0, py0] = p.region !== null ? (() => { const r = world.regions.get(p.region!); return r === undefined ? placeOf(p.t) : toScreen(proj, r.x, r.y); })() : placeOf(p.t);
      /* 2026-11-05 (Durchsicht) — eine Figur hinter einer Säule (nur ein Punkt zu sehen) fängt keinen Tipp. */
      if (p.region === null && coverAt(p.t, px0, py0, proj, screen) !== null) continue;
      if (Math.abs(x - px0) <= pieceH * 0.42 && y >= py0 - pieceH * 1.05 && y <= py0 + pieceH * 0.2) {
        if (p.region !== null) { const c = regionCam(p.region); if (c !== null) glide(c); } else onPiece(p.t);
        return true;
      }
    }
    if (goalFlag !== null && goalFlag >= 0 && goalFlag < n) {
      const fx = screen[goalFlag * 3]; const fy = screen[goalFlag * 3 + 1];
      if (coverAt(goalFlag, fx, fy, proj, screen) === null && x >= fx - 4 && x <= fx + pieceH * 0.75 && y >= fy - pieceH * 1.15 && y <= fy + 4) { onFlag(); return true; }
    }
    /* Das Feld des Hauses: wählt das Startthema (wenn keine Säule davor steht). */
    if (world.home >= 0 && world.home < n && hit(x, y) === null) {
      const [gx, gy] = toGround(camRef.current, width, height, x, y);
      if (Math.hypot(gx, gy) <= 0.5) {
        if (onHome === undefined) { onPickTopic(world.home); return true; }
        const now = performance.now();
        const double = homeTap.current !== null && now - homeTap.current < 380;
        homeTap.current = double ? null : now;
        onHome(double);
        return true;
      }
    }
    for (const l of labels) {
      if (!l.shown || !l.key.startsWith('r:')) continue;
      if (Math.abs(x - l.x) <= l.w / 2 && Math.abs(y - l.y) <= l.h / 2) { const c = regionCam(l.key.slice(2)); if (c !== null) glide(c); return true; }
    }
    return false;
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
    let cam2 = clamp({ ...next, cx: c.cx + (gx - hx), cy: c.cy + (gy - hy) });
    /* 2026-11-04 (Prompt 14) — liegt unter dem Zeiger eine Säule, bleibt IHRE Oberseite dort (nicht der Boden darunter) — so
       wandern hohe Säulen beim tiefen Zoomen nicht aus dem Bild. */
    const t = hit(sx, sy);
    if (t !== null) {
      const cell = world.cells[t];
      const [ox, oy] = toScreen(projection(cam2, width, height, stepNow), cell.x, cell.y, topics[t]?.steps ?? 0);
      const [ax, ay] = toGround(cam2, width, height, ox, oy);
      const [bx, by] = toGround(cam2, width, height, sx, sy);
      cam2 = clamp({ ...cam2, cx: cam2.cx + (ax - bx), cy: cam2.cy + (ay - by) });
    }
    setCam(cam2);
  };
  useEffect(() => {
    const el = canvas.current;
    if (el === null) return undefined;
    const wheel = (e: WheelEvent) => { e.preventDefault(); stop(); const [x, y] = local(e); zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)), x, y); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; cam: WorldCam; moved: boolean; orbit: boolean; turned: number; vx: number; vy: number; t: number; two: { d: number; mx: number; my: number; s: number; fore: number; ang: number; rot: number } | null } | null>(null);
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    stop();
    const [x, y] = local(e);
    pointers.current.set(e.pointerId, { x, y });
    canvas.current?.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) drag.current = { x, y, cam: camRef.current, moved: false, orbit: e.ctrlKey || e.metaKey || e.button === 2 || e.button === 1, turned: 0, vx: 0, vy: 0, t: performance.now(), two: null };
    else if (pointers.current.size === 2 && drag.current !== null) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { ...drag.current, moved: true, two: { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: camRef.current.s, fore: camRef.current.fore, ang: Math.atan2(b.y - a.y, b.x - a.x), rot: camRef.current.rot } };
    }
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const [x, y] = local(e);
    if (drag.current === null && e.pointerType === 'mouse') {
      /* 2026-11-04 (Prompt 15, 3) — über dem Namen eines Gebiets: das ganze Gebiet leuchtet. */
      const over = labels.find((l) => l.shown && l.key.startsWith('r:') && Math.abs(x - l.x) <= l.w / 2 && Math.abs(y - l.y) <= l.h / 2);
      pointerAt.current = [x, y];
      if (tip.current !== null) { tip.current.style.left = `${Math.round(x)}px`; tip.current.style.top = `${Math.round(y - 16)}px`; }
      if (over !== undefined) { setHoverTopic(null); setHoverRegion(over.key.slice(2)); return; }
      const t = hit(x, y);
      setHoverTopic(px >= PICK_PX ? t : null);
      setHoverRegion(t === null || px >= PICK_PX ? null : regionOfTopicNow(t));
      pointerAt.current = [x, y];
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
      /* 2026-11-04 (Prompt 14): zwei Finger drehen (Drehen der Finger), neigen (beide hoch oder runter) und zoomen (Abstand) — frei. */
      const twist = ((Math.atan2(b.y - a.y, b.x - a.x) - d.two.ang) * 180) / Math.PI;
      /* 2026-11-04 (Prompt 15, 2): hoch — flacher (zum Horizont), runter — mehr von oben. */
      if (Math.abs(dmy) > ddist * 1.4 && Math.abs(dmy) > 8) setCam(clamp({ ...camRef.current, fore: d.two.fore + dmy / 260 }));
      else { zoomAt((d.two.s * (dist / Math.max(1, d.two.d))) / camRef.current.s, mx, my); if (Math.abs(twist) > 2) setCam(clamp({ ...camRef.current, rot: d.two.rot - twist })); }
      return;
    }
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 6) return;
    d.moved = true;
    if (d.orbit) {
      /* 2026-11-04 (Prompt 14) — FREI UM DIE MITTE: Strg + Ziehen (oder mit der rechten Taste): quer dreht stufenlos, hoch/runter neigt. */
      /* 2026-11-04 (Prompt 15, 2): nach oben ziehen — flacher (zum Horizont), nach unten — mehr von oben. */
      const fore = d.cam.fore + (y - d.y) / 260;
      setCam(clamp({ ...camRef.current, fore, rot: d.cam.rot + (x - d.x) * 0.4 }));
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
  const lastTap = useRef<{ at: number; x: number; y: number; px: number } | null>(null);
  const up = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    /* 2026-11-05 (Durchsicht) — nach zwei Fingern einer: der Rest zieht von hier und vom Stand nach dem Kneifen weiter. */
    if (pointers.current.size === 1 && d !== null && d.two !== null) {
      const rest = [...pointers.current.values()][0]!;
      drag.current = { ...d, x: rest.x, y: rest.y, cam: camRef.current, two: null, moved: true, orbit: false, vx: 0, vy: 0, t: performance.now() };
    }
    if (pointers.current.size > 0) return;
    drag.current = null;
    if (d === null) return;
    if (!d.moved) {
      const [x, y] = local(e);
      /* Figuren, Fahne und Namen der Gebiete zuerst (sie liegen über der Karte, ein Ziehen auf ihnen bewegt aber die Kamera). */
      if (tapOverlay(x, y)) return;
      const t = hit(x, y);
      const now = performance.now();
      const double = lastTap.current !== null && now - lastTap.current.at < 380 && Math.hypot(lastTap.current.x - x, lastTap.current.y - y) < 12;
      const firstPx = lastTap.current?.px ?? px;
      lastTap.current = { at: now, x, y, px };
      if (t === null) { onBackground(); return; }
      /* 2026-11-04 (Prompt 14) — ein Doppelklick auf ein Thema (nah): zum Lernen öffnen (stellt eine Figur darauf). */
      if (double && px >= PICK_PX && firstPx >= PICK_PX) { onStart(t); return; }
      if (double || px < PICK_PX) {
        /* Ein Gebiet (fern) oder ein Doppelklick: sanft auf das Gebiet, das hier hineinführt. */
        const chain = world.chain[t] ?? [];
        let target: string | null = null;
        for (const k of chain) { const r = world.regions.get(k); if (r !== undefined && fitCam(camRef.current, width, height, r.x, r.y, r.radius).s > camRef.current.s * 1.25) { target = k; break; } }
        if (target !== null) { const c = regionCam(target); if (c !== null) { glide(c); lastTap.current = null; return; } }
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
      setFocusTop(chain[0] ?? null);
    }, 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, screen]);

  const measured = useRef(new Map<string, [number, number]>());
  /* Neu gemessene Namen: einmal neu verteilen (sonst blieben Schätzungen stehen, bis die Kamera sich bewegt). */
  const [measureTick, setMeasureTick] = useState(0);
  const measureSoon = useRef(0);
  /* -- Namen: Gebiete nach dem Zoom, nah die Themen ------------------------------------------------------------- */
  /*
    2026-11-04 (Prompt 15, 3) — fern trägt JEDES oberste Gebiet seinen Namen (in seiner Farbe); passt er nicht auf seine
    Fläche, steht er am Rand des Bildes mit einer Linie zu ihr — nie fällt er weg.
  */
  /* Fern: kleine Kacheln oder die ganze Karte im Bild (eine kleine Baza ist ganz gezeigt schon gross) — Namen der Gebiete, keine in den Kacheln. */
  const far = px < RING_PX || cam.s <= fitWhole(cam).s * 1.08;
  /*
    2026-11-04 (Prompt 16; vom Nutzer) — JE EBENE EINE ZOOMSTUFE: fern die obersten Gebiete, dann (bis die Namen in den Kacheln
    stehen) ihre Teilgebiete, dann deren Teilgebiete … — die Strecke zwischen fern und nah ist gleichmässig (im Mass des
    Zooms) auf die Ebenen aufgeteilt, auf jeder stehen nur die Namen dieser Ebene.
  */
  const depthOfRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of world.regions.values()) { let d = 0; for (let q = r.parent; q !== null && d < 64; q = world.regions.get(q)?.parent ?? null) d += 1; m.set(r.key, d); }
    return m;
  }, [world]);
  const deepest = useMemo(() => Math.max(0, ...depthOfRegion.values()), [depthOfRegion]);
  const pxFar = Math.max(RING_PX, cellPx(fitWhole(cam)) * 1.08);
  const levelNow = far || deepest === 0 ? 0 : 1 + Math.min(deepest - 1, Math.floor(Math.max(0, Math.min(0.999, Math.log(px / pxFar) / Math.log(Math.max(1.01, NAME_PX / pxFar)))) * deepest));
  const labels = useMemo((): (PlacedLabel & { readonly leader?: readonly [number, number] })[] => {
    const list: LabelCandidate[] = [];
    /* Nah steht alles in den Kacheln: dann keine Namen der Gebiete darüber. */
    for (const r of px >= NAME_PX && !far ? [] : world.regions.values()) {
      const d = 2 * r.radius * cam.s;
      const parent = r.parent === null ? null : world.regions.get(r.parent) ?? null;
      const alpha = (depthOfRegion.get(r.key) ?? 0) === levelNow ? 1 : 0;
      void d;
      if (alpha <= 0.02) continue;
      const [x, y] = toScreen(proj, r.x, r.y);
      const text = regionName(r.key);
      const tw = textWidth(text, true) + (conquered.has(r.key) ? 16 : 0);
      const lines = Math.max(1, Math.ceil(tw / 200));
      const w = Math.min(tw, 208) + 16;
      list.push({ key: `r:${r.key}`, text, x, y, w, h: 17 * lines + 6, weight: 1000 + r.topics.length + (parent === null ? 5000 : 0), alpha });
    }
    /* 2026-11-04 (Prompt 14, 3): keine schwebenden Namen der Themen mehr — nah steht alles in der Kachel (`drawInfo`). */
    /* Die wirkliche Grösse (gemessen, sobald ein Name einmal stand) gilt vor der Schätzung. */
    const placed = placeLabels(list.map((l) => { const m = measured.current.get(`${l.key}|${l.text}`); return m === undefined ? l : { ...l, w: Math.max(l.w, m[0]), h: Math.max(l.h, m[1]) }; }), width, height);
    if (!far) return placed;
    /* Die obersten, die nicht passten: an den Rand, nächst ihrer Fläche, mit einer Linie hin (`keepLabels`). */
    /* 2026-11-04 (Prompt 16) — erst auf der eigenen Fläche (ohne Linie), nur wo sie zu klein ist: kurz daneben mit Linie. */
    const spots = (l: PlacedLabel): [number, number][] => {
      const r = world.regions.get(l.key.slice(2));
      if (r === undefined) return [];
      const step2 = Math.max(1, Math.floor(r.topics.length / 60));
      const out: [number, number][] = [];
      for (let k = 0; k < r.topics.length; k += step2) { const t = r.topics[k]; out.push([screen[t * 3], screen[t * 3 + 1]]); }
      return out.sort((a, b) => Math.hypot(a[0] - l.x, a[1] - l.y) - Math.hypot(b[0] - l.x, b[1] - l.y));
    };
    return keepLabels(placed, (l) => levelNow === 0 && l.key.startsWith('r:') && (depthOfRegion.get(l.key.slice(2)) ?? 0) === 0, width, height, spots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, cam, proj, screen, regionName, topics, chosen, width, height, conquered, measureTick, far, levelNow]);
  /* Die Farbe eines Gebiets für seinen Namen (Teilgebiete im gefüllten Gebiet: ihr eigener Ton). */
  const labelColour = (key: string): string => {
    const r = world.regions.get(key);
    if (r === undefined || palette === null) return '';
    const i = world.top.indexOf(r.top);
    const base = i < 0 ? palette.cx : palette.c[i % 8];
    return css(r.parent !== null && r.top === focusTop ? shiftHue(base, SHADE_SHIFT[r.shade] ?? 0) : base);
  };

  /*
    2026-11-04 (Prompt 14, 1) — DIE SPIELFIGUREN: wo sie stehen (auf der Oberseite ihres Feldes); fern mehrere in einem Gebiet
    als eine Figur mit Zahl. Die Figur auf dem Weg zum Ziel geht, wenn ihr Feld wechselt, kurz von Feld zu Feld.
  */
  /* 2026-11-05 (Prompt 17) — je Ziel-Thema ein Weg (beim Abspielen gehen mehrere Figuren; vor ihrem Start stehen sie am alten Platz). */
  const walks = useRef(new Map<number, { readonly from: number; readonly at: number; readonly ms: number }>());
  const goalNow = pieces.find((p) => p.kind === 'goal')?.t ?? null;
  const goalSeen = useRef<number | null>(goalNow);
  const [walkTick, setWalkTick] = useState(0);
  useEffect(() => {
    const was = goalSeen.current;
    goalSeen.current = goalNow;
    /* Läuft das Abspielen, geht die Figur mit ihm (nach den Säulen). */
    if (was === null || goalNow === null || was === goalNow || reduced || playRef.current !== null) return undefined;
    const w = { from: was, at: performance.now(), ms: 750 };
    walks.current.set(goalNow, w);
    let id = 0;
    const loop = () => { setWalkTick((x) => x + 1); id = walks.current.get(goalNow) === w && performance.now() - w.at < w.ms ? requestAnimationFrame(loop) : 0; if (id === 0 && walks.current.get(goalNow) === w) walks.current.delete(goalNow); };
    id = requestAnimationFrame(loop);
    return () => { if (id !== 0) cancelAnimationFrame(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalNow]);
  const placeOf = (t: number): [number, number] => {
    const w = walks.current.get(t);
    if (w !== undefined && performance.now() - w.at < w.ms) {
      const k = clamp01((performance.now() - w.at) / w.ms);
      const e = 1 - (1 - k) ** 2;
      const a = world.cells[w.from]; const b = world.cells[t];
      const sa = topics[w.from]?.steps ?? 0; const sb = topics[t]?.steps ?? 0;
      return toScreen(proj, a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, sa + (sb - sa) * e + Math.sin(Math.PI * k) * 2);
    }
    return [screen[t * 3], screen[t * 3 + 1]];
  };
  const pieceH = Math.max(14, Math.min(34, px * 0.45));
  const shownPieces = useMemo(() => {
    if (px >= 18) return pieces.map((p) => ({ key: `${p.kind}:${p.t}`, kind: p.kind, t: p.t, region: null as string | null, count: 1 }));
    /* Fern: je oberstem Gebiet eine Figur mit der Zahl (die Figur zum Ziel bleibt für sich). */
    const groups = new Map<string, { t: number; count: number; kind: 'single' | 'goal' }>();
    for (const p of pieces) {
      const top = world.chain[p.t]?.[0] ?? `t:${p.t}`;
      const k = `${p.kind}:${top}`;
      const g = groups.get(k);
      if (g === undefined) groups.set(k, { t: p.t, count: 1, kind: p.kind }); else g.count += 1;
    }
    return [...groups.entries()].map(([k, g]) => ({ key: k, kind: g.kind, t: g.t, region: g.count > 1 ? (world.chain[g.t]?.[0] ?? null) : null, count: g.count }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, px >= 18, world]);
  void walkTick;
  const tip = useRef<HTMLDivElement | null>(null);
  /* Wo der Zeiger zuletzt war (der Hinweis erscheint dort, auch wenn er erst nach dem Zeigen entsteht). */
  const pointerAt = useRef<[number, number]>([0, 0]);
  const placeTip = (el: HTMLDivElement | null) => { tip.current = el; if (el !== null) { el.style.left = `${Math.round(pointerAt.current[0])}px`; el.style.top = `${Math.round(pointerAt.current[1] - 16)}px`; } };
  const hovered = hoverTopic !== null ? { title: topics[hoverTopic]?.label ?? '', hint: hoverTopic === chosen ? (topics[hoverTopic]?.band === 'mountain' ? '' : T.hintStart) : T.hintSelect } : hoverRegion !== null ? { title: regionName(hoverRegion), hint: T.hintZoom } : null;
  const visible = new Set<string>();
  for (const l of labels) if (l.shown && l.key.startsWith('r:')) visible.add(l.key.slice(2));
  const rotNow = Math.round(((cam.rot % 360) + 360) % 360);
  const tiltPct = Math.round(((cam.fore - FORE_MIN) / (FORE_MAX - FORE_MIN)) * 100);

  return (
    <div ref={box} className={`cg-wm${compact ? ' is-compact' : ''}`} tabIndex={-1} onKeyDown={keys} data-wm-scale={cam.s.toFixed(2)} data-wm-px={px.toFixed(1)} data-wm-rot={rotNow} data-wm-fore={cam.fore.toFixed(2)}
      data-wm-far={far ? '1' : '0'} data-wm-level={levelNow} data-wm-tops={world.top.length} data-wm-hot={hoverRegion ?? ''} data-wm-cells={n} data-wm-step={stepNow.toFixed(3)} data-wm-height={height3} data-wm-home={world.home} data-wm-labels={labels.filter((l) => l.shown).map((l) => l.key).join('|')} data-wm-cam={[cam.s, cam.cx, cam.cy].map((v) => v.toFixed(3)).join(',')} data-wm-playing={phase === null ? '' : String(phase.id)} data-wm-played={lastPb.current?.id ?? ''} data-wm-played-kind={lastPb.current?.kind ?? ''}>
      <div className="cg-wm-modes" role="group" aria-label={T.modeLabel} data-wm-modes={mode}>
        {(['all', 'known', 'discover', 'due'] as const).map((m) => (
          <button key={m} type="button" className={`cg-wm-mode${mode === m ? ' is-on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)} data-wm-mode={m}>{m === 'all' ? T.modeAll : m === 'known' ? T.modeKnown : m === 'discover' ? T.modeDiscover : T.modeDue}</button>
        ))}
      </div>
      <div className="cg-wm-stage">
      <canvas ref={canvas} className="cg-wm-canvas" width={width} height={height} aria-label={T.mapLabel} role="img"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()} onPointerLeave={() => { setHoverRegion(null); setHoverTopic(null); }} data-landscape-svg="" />
      <div className="cg-wm-over" aria-hidden>
        {labels.map((l) => {
          const isRegion = l.key.startsWith('r:');
          const rk = isRegion ? l.key.slice(2) : null;
          return (
            <span key={l.key} className={`cg-wm-label${isRegion ? ' is-region' : ' is-topic'}${l.shown ? ' is-shown' : ''}${rk !== null && rk === hoverRegion ? ' is-hot' : ''}${rk !== null && world.regions.get(rk)?.parent === null ? ' is-top' : ''}${rk !== null && phase !== null && phase.flags && phase.rise.has(rk) ? ' is-rising' : ''}`} data-wm-leader={l.leader === undefined ? undefined : ''} data-wm-label={l.key} data-wm-box={[l.x - l.w / 2, l.y - l.h / 2, l.w, l.h].map((v) => v.toFixed(0)).join(',')}
              ref={(el) => { if (el !== null) { const sk = `${l.key}|${l.text}`; if (!measured.current.has(sk) && el.offsetWidth > 0) { measured.current.set(sk, [el.offsetWidth, el.offsetHeight]); if (measureSoon.current === 0) measureSoon.current = window.setTimeout(() => { measureSoon.current = 0; setMeasureTick((x) => x + 1); }, 60); } if (rk !== null) el.style.setProperty('--wm-label-c', labelColour(rk)); el.style.left = `${l.x.toFixed(1)}px`; el.style.top = `${l.y.toFixed(1)}px`; el.style.width = `${l.w.toFixed(0)}px`; el.style.opacity = l.shown ? String(Math.min(1, l.alpha)) : '0'; } }}>
              {rk !== null && conquered.has(rk) && !(phase !== null && phase.hide.has(rk)) && <FlagIcon />}{l.text}
            </span>
          );
        })}
        {labels.some((l) => l.shown && l.leader !== undefined) && (
          <svg className="cg-wm-leaders" width={width} height={height}>
            {labels.filter((l) => l.shown && l.leader !== undefined).map((l) => <line key={l.key} x1={l.x} y1={l.y} x2={l.leader![0]} y2={l.leader![1]} />)}
          </svg>
        )}
      </div>
      {(shownPieces.length > 0 || goalFlag !== null || (phase !== null && phase.leaving.length > 0)) && (
        <svg className="cg-wm-pieces" width={width} height={height} data-wm-pieces={shownPieces.length}>
          {goalFlag !== null && goalFlag >= 0 && goalFlag < n && (() => {
            const [x, y] = [screen[goalFlag * 3], screen[goalFlag * 3 + 1]];
            const hidden = coverAt(goalFlag, x, y, proj, screen);
            if (hidden !== null) return <circle className="cg-wm-piece-behind is-flag" cx={x} cy={hidden} r={3.2} data-wm-flag-behind={goalFlag} />;
            return (
              <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className="cg-wm-hit" aria-label={T.goalFlagLabel(topics[goalFlag]?.label ?? '')} data-wm-flag={goalFlag}>
                <GoalFlagIcon h={pieceH * 1.1} />
              </g>
            );
          })()}
          {/* 2026-11-05 (Prompt 17) — eine Figur, deren Thema jetzt gekonnt ist, steht noch, bis die Säulen sitzen, dann vergeht sie. */}
          {phase !== null && phase.leaving.map((p) => {
            if (p.t < 0 || p.t >= n) return null;
            const [x, y] = [screen[p.t * 3], screen[p.t * 3 + 1]];
            return <g key={`leave:${p.kind}:${p.t}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className={`cg-wm-leaving${phase.left ? ' is-going' : ''}`} data-wm-leaving={p.t}><PieceIcon kind={p.kind} h={pieceH} /></g>;
          })}
          {shownPieces.map((p) => {
            if (p.t < 0 || p.t >= n) return null;
            const [x, y] = p.region !== null ? (() => { const r = world.regions.get(p.region!); return r === undefined ? placeOf(p.t) : toScreen(proj, r.x, r.y); })() : placeOf(p.t);
            if (x < -40 || x > width + 40 || y < -40 || y > height + 60) return null;
            /* 2026-11-04 (Prompt 15, 4c) — eine Säule davor verdeckt die Figur: nur ein kleines Zeichen an ihrer Oberkante. */
            const hidden = p.region === null ? coverAt(p.t, x, y, proj, screen) : null;
            if (hidden !== null) return <circle key={p.key} className="cg-wm-piece-behind" cx={x} cy={hidden} r={3.2} data-wm-piece-behind={p.t} />;
            return (
              <g key={p.key} transform={`translate(${x.toFixed(1)},${(y + (p.kind === 'goal' && goalFlag === p.t ? 0 : 0)).toFixed(1)})`} className="cg-wm-hit" data-wm-piece={p.kind} data-wm-piece-t={p.t} data-wm-piece-count={p.count}
                aria-label={p.region !== null ? T.piecesHere(p.count, regionName(p.region)) : T.pieceLabel(topics[p.t]?.label ?? '')}
                >
                <PieceIcon kind={p.kind} h={pieceH} count={p.count} />
              </g>
            );
          })}
        </svg>
      )}
      {mode === 'due' && !topics.some((t) => t.due) && <div className="cg-wm-note" role="status" data-wm-note="due">{T.nothingDue}</div>}
      {mode === 'discover' && !topics.some((t) => t.band === 'ring') && <div className="cg-wm-note" role="status" data-wm-note="discover">{T.nothingReady}</div>}
      {replayLabel !== undefined && replayUntil > 0 && phase === null && lastPb.current !== null && (
        <button type="button" className="cg-wm-replay" onClick={() => { const pb = lastPb.current; if (pb !== null) startPlay(pb, true); }} data-wm-replay="">
          <svg viewBox="-8 -8 16 16" aria-hidden><path d="M5.2,-2.6 A6,6 0 1 0 6,1.4 M5.2,-2.6 L1.6,-3.2 M5.2,-2.6 L5.8,0.8" /></svg>{replayLabel}
        </button>
      )}
      {hovered !== null && <div ref={placeTip} className="cg-rm-tip" role="tooltip" data-landscape-tip="">{hovered.title}{hovered.hint === '' ? '' : <> · <strong>{hovered.hint}</strong></>}</div>}
      <div className="cg-rm-tools" role="group" aria-label={T.mapLabel}>
        <button type="button" className="cg-rm-tool" onClick={() => glide({ ...camRef.current, s: camRef.current.s * 1.6 }, 240)} aria-label={T.zoomIn} title={T.zoomIn} data-rm-zoom="in">+</button>
        <button type="button" className="cg-rm-tool" onClick={() => glide({ ...camRef.current, s: camRef.current.s / 1.6 }, 240)} aria-label={T.zoomOut} title={T.zoomOut} data-rm-zoom="out">−</button>
        <button type="button" className="cg-rm-tool is-icon" onClick={() => rotateBy(1)} aria-label={T.rotate} title={T.rotate} data-landscape-rotate={rotNow}>
          <svg viewBox="-8 -8 16 16" aria-hidden><path d="M5.2,-2.6 A6,6 0 1 0 6,1.4 M5.2,-2.6 L1.6,-3.2 M5.2,-2.6 L5.8,0.8" /></svg>
        </button>
      </div>
      <div className="cg-wm-view" data-wm-view="">
        <span className="cg-muted" data-wm-angle={rotNow}>{T.viewAngle(rotNow, tiltPct)}</span>
        <span className="cg-wm-tilt">
          <svg className="cg-wm-tilt-icon" viewBox="-9 -7 18 14" aria-hidden data-wm-tilt-side=""><title>{T.tiltSide}</title><path d="M-8,4 L8,4 M-5,4 L-5,-1 L-1,-1 L-1,4 M1,4 L1,-4 L5,-4 L5,4" /></svg>
          <span className="cg-sr">{T.tiltSide}</span>
          <input type="range" min={0} max={100} value={tiltPct} aria-label={`${T.tilt}: ${T.tiltSide} – ${T.tiltAbove}`} title={T.tiltHint2} onChange={(e) => setCam(clamp({ ...camRef.current, fore: FORE_MIN + (Number(e.target.value) / 100) * (FORE_MAX - FORE_MIN) }))} data-wm-tilt="" />
          <svg className="cg-wm-tilt-icon" viewBox="-9 -9 18 18" aria-hidden data-wm-tilt-above=""><title>{T.tiltAbove}</title><path d="M0,-7 L6,-3.5 L6,3.5 L0,7 L-6,3.5 L-6,-3.5 Z M0,-2.5 L2.2,-1.25 L2.2,1.25 L0,2.5 L-2.2,1.25 L-2.2,-1.25 Z" /></svg>
          <span className="cg-sr">{T.tiltAbove}</span>
        </span>
        <span className="cg-wm-heights" role="group" aria-label={T.heightLabel} data-wm-heights={height3}>
          {(['low', 'mid', 'high'] as const).map((h, k) => (
            <button key={h} type="button" className={`cg-wm-height${height3 === h ? ' is-on' : ''}`} aria-pressed={height3 === h} onClick={() => setHeight(h)} title={`${T.heightLabel}: ${h === 'low' ? T.heightLow : h === 'mid' ? T.heightMid : T.heightHigh}`} data-wm-height-pick={h}>
              <svg viewBox="0 0 14 14" aria-hidden><path d={k === 0 ? 'M2,12 V9 H5 V12 M6,12 V8 H9 V12 M10,12 V10 H13 V12' : k === 1 ? 'M2,12 V7 H5 V12 M6,12 V5 H9 V12 M10,12 V8 H13 V12' : 'M2,12 V4 H5 V12 M6,12 V1 H9 V12 M10,12 V5 H13 V12'} /></svg>
              <span>{h === 'low' ? T.heightLow : h === 'mid' ? T.heightMid : T.heightHigh}</span>
            </button>
          ))}
        </span>
        <button type="button" className="wk-link-btn" onClick={resetView} data-wm-reset="">{T.resetView}</button>
      </div>
      </div>
      {legend(visible)}
    </div>
  );
}

/* -- 2026-11-05 (Prompt 17): das Abspielen, ausserhalb der Komponente ------------------------------------------------ */

/** Ein laufendes Abspielen (je Thema in Feldern, damit 5 000 Säulen je Bild billig bleiben). */
interface Play {
  readonly pb: WorldPlayback;
  readonly t0: number;
  readonly times: PlayTimes;
  readonly motion: MotionLevel;
  /** Je Thema: wann seine Säule beginnt (die Welle). */
  readonly delay: Float32Array;
  /** Vorher: die Höhe, der Ring (NaN: wie jetzt), das Band (Code, 255: wie jetzt), fällig, Land, lernbar. */
  readonly h0: Float32Array;
  readonly s0: Float32Array;
  readonly b0: Uint8Array;
  readonly d0: Uint8Array;
  readonly land0: Uint8Array;
  readonly ready0: Uint8Array;
  /** 1: ein Puls (eine Wiederholung erledigt), 2: ein Schimmer (neu lernbar). */
  readonly mark: Uint8Array;
  /** In einem eben eroberten Gebiet. */
  readonly glow: Uint8Array;
  readonly regions: readonly string[];
  readonly camFrom: WorldCam;
  readonly camTo: WorldCam | null;
  /** „ograniczone": das alte Bild. */
  fade: HTMLCanvasElement | null;
  raf: number;
  sentPoints: boolean;
  sentRegions: boolean;
  left: boolean;
  finishFlights: (() => void) | null;
}

/** Was die Oberfläche beim Abspielen braucht (Fahnen, Figuren, die gehen). */
interface PlayPhase {
  readonly id: number;
  /** Die Fahnen der eben eroberten Gebiete stehen (sie steigen jetzt). */
  readonly flags: boolean;
  readonly hide: ReadonlySet<string>;
  readonly rise: ReadonlySet<string>;
  readonly leaving: readonly { readonly t: number; readonly kind: 'single' | 'goal' }[];
  readonly left: boolean;
}

const BAND_IX: Readonly<Record<string, number>> = { mountain: 1, ring: 2, due: 3, known: 4 };
const BAND_OF: readonly (LsBand | null)[] = [null, 'mountain', 'ring', 'due', 'known'];

/** Wie weit die Säule i ist (0–1, ohne Glättung). */
function colK(A: Play, i: number, tau: number): number {
  return clamp01((tau - A.times.col0 - A.delay[i]) / Math.max(1, A.times.colMs));
}
/** Ihre Höhe jetzt. */
function stepsAt(A: Play, i: number, final: number, tau: number): number {
  const h0 = A.h0[i];
  if (h0 === undefined || Number.isNaN(h0)) return final;
  return h0 + (final - h0) * easeOut(colK(A, i, tau));
}
/** Der Puls einer erledigten Wiederholung: kurz bevor ihre Säule sitzt. */
function pulseK(A: Play, i: number, tau: number): number {
  return clamp01((tau - (A.times.col0 + A.delay[i] + A.times.colMs - 120)) / PULSE_MS);
}
/** War es vorher in dieser Ansicht grau? */
function greyedBefore(A: Play, i: number, mode: WorldMode): number {
  if (mode === 'known') return A.land0[i] === 1 ? 0 : 1;
  if (mode === 'discover') return A.ready0[i] === 1 ? 0 : 1;
  if (mode === 'due') return A.d0[i] === 1 ? 0 : 1;
  return 0;
}
/** Zwischen zwei Blicken (Drehung auf dem kürzeren Weg). */
function lerpCam(a: WorldCam, b: WorldCam, k: number): WorldCam {
  const turn = ((((b.rot - a.rot) % 360) + 540) % 360) - 180;
  return { s: a.s * (b.s / a.s) ** k, cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, rot: a.rot + turn * k, fore: a.fore + (b.fore - a.fore) * k };
}
/** Irgendein Klick, eine Taste, das Rad: der Rest wird übersprungen (die Eingabe geht trotzdem weiter, wohin sie wollte). */
function listenSkip(f: () => void): () => void {
  const h = () => f();
  window.addEventListener('pointerdown', h, true);
  window.addEventListener('keydown', h, true);
  window.addEventListener('wheel', h, { capture: true, passive: true });
  return () => { window.removeEventListener('pointerdown', h, true); window.removeEventListener('keydown', h, true); window.removeEventListener('wheel', h, true); };
}

/** Die Kante k (Ecke k → k+1) stösst an den Nachbarn in dieser Richtung (Achsen q, r). */
const EDGE_DIR: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];


/* -- 2026-11-04 (Prompt 15) — Ring, Verdecken, Farbtöne ------------------------------------------------------------ */

/** Der Ring am Rand: die Ecken (verkleinert um `k`) von oben im Uhrzeigersinn, mit der Länge bis zu jedem Punkt. */
function ringPath(corners: readonly (readonly [number, number])[], k: number): { pts: [number, number][]; acc: number[]; total: number } {
  const span = spanAt(corners, 0);
  const topY = (span === null ? -1 : span[0]) * k;
  const angle = (x: number, y: number) => { const a = Math.atan2(y, x) + Math.PI / 2; return a < 0 ? a + 2 * Math.PI : a; };
  const list = corners.map(([x, y]) => [x * k, y * k] as [number, number]).map((c) => ({ c, a: angle(c[0], c[1]) })).filter((e) => e.a > 1e-6).sort((a, b) => a.a - b.a);
  const pts: [number, number][] = [[0, topY], ...list.map((e) => e.c), [0, topY]];
  const acc = [0];
  for (let i = 1; i < pts.length; i += 1) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, acc, total: acc[acc.length - 1] };
}
/** Wie weit ein (konvexes) Sechseck auf dem Schirm bei der waagrechten Lage `dx` (von der Mitte) nach oben und unten reicht. */
function spanAt(corners: readonly (readonly [number, number])[], dx: number): [number, number] | null {
  let lo = Infinity; let hi = -Infinity;
  for (let k = 0; k < corners.length; k += 1) {
    const a = corners[k]; const b = corners[(k + 1) % corners.length];
    const x0 = Math.min(a[0], b[0]); const x1 = Math.max(a[0], b[0]);
    if (dx < x0 - 1e-9 || dx > x1 + 1e-9) continue;
    const y = Math.abs(b[0] - a[0]) < 1e-9 ? Math.min(a[1], b[1]) : a[1] + ((dx - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    const y2 = Math.abs(b[0] - a[0]) < 1e-9 ? Math.max(a[1], b[1]) : y;
    lo = Math.min(lo, y, y2); hi = Math.max(hi, y, y2);
  }
  return lo <= hi ? [lo, hi] : null;
}
/** Die Plätze bis drei Schritte weit (eine hohe Säule davor kann so weit decken). */
const NEAR3: readonly (readonly [number, number])[] = (() => { const out: [number, number][] = []; for (let q = -3; q <= 3; q += 1) for (let r = -3; r <= 3; r += 1) { const d = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2; if (d >= 1 && d <= 3) out.push([q, r]); } return out; })();
/** Ein Farbton gedreht (Grad), Helligkeit und Sättigung bleiben (sie gehören dem Wissen). */
function shiftHue(c: readonly number[], deg: number): number[] {
  if (deg === 0) return [...c];
  const r = c[0] / 255; const g = c[1] / 255; const b = c[2] / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max - min < 1e-6) return [...c];
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p0 = 2 * l - q;
  const f = (t: number) => { let x = t; if (x < 0) x += 1; if (x > 1) x -= 1; return x < 1 / 6 ? p0 + (q - p0) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p0 + (q - p0) * (2 / 3 - x) * 6 : p0; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
/**
 * 2026-11-04 (Prompt 16, 1; vom Nutzer) — DAS HAUS, einfach und flach: ein Umriss aus Dach und Wand mit Tür, liegend auf der
 * Kachel (die Umgebung setzt Drehung und Neigung). `hs`: Grösse in Bildpunkten, Mitte bei 0,0.
 */
function houseIcon(ctx: CanvasRenderingContext2D, hs: number, P: Palette): void {
  const w = hs * 0.9; const roof = hs * 0.42; const body = hs * 0.5;
  const top = -(roof + body) / 2; const eave = top + roof; const bottom = eave + body;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - hs * 0.08, eave); ctx.lineTo(0, top); ctx.lineTo(w / 2 + hs * 0.08, eave);
  ctx.moveTo(-w / 2 + hs * 0.08, eave); ctx.lineTo(-w / 2 + hs * 0.08, bottom); ctx.lineTo(w / 2 - hs * 0.08, bottom); ctx.lineTo(w / 2 - hs * 0.08, eave);
  ctx.moveTo(-w * 0.1, bottom); ctx.lineTo(-w * 0.1, bottom - body * 0.55); ctx.lineTo(w * 0.1, bottom - body * 0.55); ctx.lineTo(w * 0.1, bottom);
  ctx.lineWidth = Math.max(1.4, hs * 0.075); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = css(P.ink, 0.8); ctx.stroke();
}

/** Die Teilgebiete eines Gebiets, in das man hineinzoomt: je Farbklasse ein benachbarter Ton (15–25° auseinander). */
const SHADE_SHIFT: readonly number[] = [0, 20, -20, 40];

export type { Projection };
