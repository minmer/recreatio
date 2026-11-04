/**
 * 2026-11-04 (Prompt 11) — DIE KARTE EINER EBENE DES KRAJOBRAZ: eine Handvoll Säulen (Gebiete oder Themen, nie gemischt),
 * senkrecht ohne Fluchtpunkt, EIN Schritt für alle (`levelMap.ts` viewScale), ziehen, Rad, zwei Finger, „+"/„−", sanftes
 * Ausrollen bis zum Rand; „Zu mir", „Ganze Karte", 60°. Was weit weg ist, verblasst; was jetzt geht, hat einen hellen Rand;
 * höchstens EIN Zeichen je Feld (erst wiederholen > zu wiederholen), klein, hell, auf der Fläche liegend — erst, wenn das
 * Feld gross genug ist (das gewählte und der nächste Schritt immer). Namen erst im Nahen. Tore am Rand führen hinaus.
 * Passt sich seinem Behälter an (Breite gemessen), nicht dem Fenster.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import type { LsBand } from './landscape';
import { HEX_CORNER, HEX_CORNERS, HEX_FLOOR, rotated, viewScale } from './levelMap';
import type { LandscapeWords } from './landscapeWords';

export type SignKind = 'first' | 'due';

export interface MapField {
  readonly key: string;
  readonly kind: 'region' | 'topic';
  readonly label: string;
  /** Wie es sich ansagt (Vorleser, Zeigen). */
  readonly title: string;
  readonly x: number;
  readonly y: number;
  /** Stufen (Tal 0, jetzt lernbar 1). */
  readonly steps: number;
  readonly band: LsBand;
  readonly sign: SignKind | null;
  /** Die Farbe (der Abschnitt, 0–7; −1 grau). */
  readonly subject: number;
  /** Wie viel davon sitzt (0–1): die Tiefe der Farbe, bei einem Gebiet sein Ring. */
  readonly share: number;
  /** Jetzt lernbar (ein Thema auf dem Ring, ein Gebiet mit Lernbarem). */
  readonly glow: boolean;
  /** Ein erobertes Gebiet (alles darin gelernt): warm, mit Fahne. */
  readonly conquered: boolean;
  /** Hier steht der Lernende (sein nächster Schritt liegt hier). */
  readonly home: boolean;
  /** Eine leise Vorschau der Ebene darunter (Lage −1…1). */
  readonly preview?: readonly { readonly x: number; readonly y: number; readonly band: LsBand }[];
  /** Am Ziel: so viele Themen bis dorthin. */
  readonly badge?: number | null;
}

export interface MapGate {
  readonly key: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly before: boolean;
  readonly after: boolean;
}

export interface MapRoute {
  /** Die gezeichneten Schritte in der Reihenfolge der Liste (der erste ist „als Nächstes", der letzte das Ziel). */
  readonly keys: readonly string[];
  /** Felder des Weges, die nicht als Linie kommen (ein langer Weg: nur ihr Umriss). */
  readonly rest: readonly string[];
}

export interface MapCommand {
  readonly kind: 'fit' | 'focus';
  readonly at: number;
}

interface Cam { s: number; cx: number; cy: number }

/* -- Kamera und Drehung, gemerkt je Lernendem, Baza und Ebene ------------------------------------------------------ */

interface Kept { cams: Record<string, Cam>; rot: number }
const KEPT = new Map<string, Kept>();
function keptOf(key: string): Kept {
  let k = KEPT.get(key);
  if (k === undefined) {
    k = { cams: {}, rot: 0 };
    try {
      const raw = localStorage.getItem(`cg-ls-cam:${key}`);
      if (raw !== null) {
        const v = JSON.parse(raw) as Partial<Kept>;
        if (v !== null && typeof v === 'object') k = { cams: typeof v.cams === 'object' && v.cams !== null ? v.cams : {}, rot: Number.isInteger(v.rot) ? Number(v.rot) % 6 : 0 };
      }
    } catch { /* ohne Speicher */ }
    KEPT.set(key, k);
  }
  return k;
}
function keepSoon(key: string): void {
  const k = KEPT.get(key);
  if (k === undefined) return;
  try {
    const cams = Object.entries(k.cams).slice(-40);
    localStorage.setItem(`cg-ls-cam:${key}`, JSON.stringify({ cams: Object.fromEntries(cams), rot: k.rot }));
  } catch { /* ohne Speicher */ }
}

/* -- Die Zeichen: EIN kleiner Satz, dieselben auf der Karte und in der Legende ---------------------------------------- */

/** Die Linien eines Zeichens im Einheitskreis (Radius 1, y nach unten). */
const SIGN_PATH: Readonly<Record<SignKind, string>> = {
  /* „do powtórki": ein Pfeil im Kreis. */
  due: 'M0.44,-0.46 A0.62,0.62 0 1 0 0.5,0.4 M0.44,-0.46 L-0.02,-0.5 M0.44,-0.46 L0.52,-0.02',
  /* „erst wiederholen, dann weiter": links ein kleiner Pfeil im Kreis, aus ihm ein Pfeil nach rechts (weiter) — liegend gut zu lesen. */
  first: 'M-0.26,-0.38 A0.36,0.36 0 1 0 0.06,0.18 M-0.26,-0.38 L-0.06,-0.54 M-0.26,-0.38 L-0.08,-0.22 M0.2,0 L0.8,0 M0.58,-0.2 L0.8,0 L0.58,0.2'
};

/** Ein Zeichen: eine helle Scheibe mit dünnem dunklem Rand und eine dünne Linienzeichnung — auf der Fläche liegend (`fore`). */
export function SignIcon({ kind, r, fore = 1, x = 0, y = 0 }: { kind: SignKind; r: number; fore?: number; x?: number; y?: number }) {
  /* Liegend wie die Fläche — doch nie so flach, dass ein Kreis zum Auge wird. */
  const flat = Math.max(0.82, Math.min(1, fore));
  return (
    <g className="cg-ls-sign" transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${r.toFixed(2)},${(r * flat).toFixed(2)})`} data-ls-sign={kind}>
      <circle className="cg-ls-sign-disc" r={1} vectorEffect="non-scaling-stroke" />
      <path className="cg-ls-sign-line" d={SIGN_PATH[kind]} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** Die Fahne eines eroberten Gebiets (eine Linienzeichnung, Mitte unten am Mast). */
function FlagIcon({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g className="cg-ls-flagmark" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} aria-hidden data-ls-flag="">
      <path d={`M0,0 V${(-h).toFixed(1)} L${(h * 0.62).toFixed(1)},${(-h * 0.78).toFixed(1)} L0,${(-h * 0.56).toFixed(1)}`} />
    </g>
  );
}

/** Der Lernende (eine kleine Gestalt): hier bist du. */
function MeIcon({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g className="cg-ls-meicon" transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} aria-hidden data-ls-home="">
      <circle cx={0} cy={-h * 0.78} r={h * 0.2} />
      <path d={`M${(-h * 0.32).toFixed(1)},0 Q0,${(-h * 0.72).toFixed(1)} ${(h * 0.32).toFixed(1)},0 Z`} />
    </g>
  );
}

/* -- Die Karte ------------------------------------------------------------------------------------------------- */

const MIN_SIGN = 12;
const NAME_AT = 104;

export function RegionMap({ levelKey, fields, gates, ground, route, chosen, next, focus, width, compact, T, memoryKey, canUp, command, onChoose, onGate, onUp, onBackground, legend }: {
  levelKey: string;
  fields: readonly MapField[];
  gates: readonly MapGate[];
  ground: readonly { readonly x: number; readonly y: number }[];
  route: MapRoute | null;
  chosen: string | null;
  next: string | null;
  focus: string | null;
  width: number;
  compact: boolean;
  T: LandscapeWords;
  memoryKey: string;
  canUp: boolean;
  command: MapCommand | null;
  onChoose: (key: string) => void;
  onGate: (key: string) => void;
  onUp: () => void;
  onBackground: () => void;
  /** Was die Legende zeigt (die Ansicht weiss, was auf der Karte ist) — mit den Feldern, die gerade im Bild sind. */
  legend: (fore: number, visible: ReadonlySet<string>) => ReactNode;
}) {
  const kept = keptOf(memoryKey);
  const [rot, setRot] = useState(kept.rot);
  const height = Math.round(Math.max(300, Math.min(compact ? 420 : 680, width * (width < 520 ? 1 : 0.62))));
  const pid = useId().replace(/:/g, '');

  /* Die Mitte des Fächers: um sie wird gedreht. */
  const centre = useMemo(() => {
    if (fields.length === 0) return { x: 0, y: 0 };
    return { x: fields.reduce((s, f) => s + f.x, 0) / fields.length, y: fields.reduce((s, f) => s + f.y, 0) / fields.length };
  }, [fields]);
  const turnedFields = useMemo(() => rotated(fields, rot, centre.x, centre.y), [fields, rot, centre]);
  const turnedGates = useMemo(() => rotated(gates, rot, centre.x, centre.y), [gates, rot, centre]);
  const turnedGround = useMemo(() => rotated(ground, rot, centre.x, centre.y), [ground, rot, centre]);
  const important = (f: MapField) => f.glow || f.sign !== null || f.key === chosen || f.key === next;
  /* Der Fussabdruck am Boden: wie gross eine Bodeneinheit bei „Ganze Karte" etwa wird (für die kleinste lesbare Stufe). */
  const footprint = useMemo(() => {
    const xs = [...turnedFields, ...turnedGates].map((f) => f.x);
    const ys = [...turnedFields, ...turnedGates].map((f) => f.y);
    const spanX = (xs.length === 0 ? 1 : Math.max(...xs) - Math.min(...xs)) + 2 * HEX_CORNER;
    const spanY = (ys.length === 0 ? 1 : Math.max(...ys) - Math.min(...ys)) * 0.52 + 1;
    return Math.max(8, Math.min((width - 24) / spanX, (height - 24) / spanY));
  }, [turnedFields, turnedGates, width, height]);
  /*
    Die grösste Stufe, die es gibt: so, dass die höchste Säule nicht weit über die Karte hinauswächst (ein Faktor für ALLE
    Felder — eine Karte mit drei Türmen wird sonst ein Hochhaus); nie unter die kleinste lesbare Stufe.
  */
  const tallest = Math.max(1, ...turnedFields.map((f) => f.steps));
  const depthSpan = turnedFields.length === 0 ? 1 : Math.max(...turnedFields.map((f) => f.y)) - Math.min(...turnedFields.map((f) => f.y));
  const scale = useMemo(() => viewScale(turnedFields.map((f) => ({ x: f.x, y: f.y, steps: f.steps, important: important(f) })), { minStep: 6 / footprint, maxStep: Math.min(0.3, (2.2 + depthSpan * 0.6) / tallest) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turnedFields, footprint, chosen, next, tallest, depthSpan]);
  const { fore, step } = scale;

  /* Wo alles in der Welt liegt (Bodeneinheiten; y nach unten). */
  const world = useMemo(() => {
    const faceH = HEX_CORNERS[1][1] * fore;
    const cols = turnedFields.map((f, i) => {
      const lift = scale.drawn[i];
      const bx = f.x;
      const by = -f.y * fore;
      return { f, i, bx, by, ty: by - lift * step, lift };
    });
    let x0 = Number.POSITIVE_INFINITY; let x1 = Number.NEGATIVE_INFINITY; let y0 = Number.POSITIVE_INFINITY; let y1 = Number.NEGATIVE_INFINITY;
    for (const c of cols) { x0 = Math.min(x0, c.bx - HEX_CORNER); x1 = Math.max(x1, c.bx + HEX_CORNER); y0 = Math.min(y0, c.ty - faceH - 0.25); y1 = Math.max(y1, c.by + faceH + HEX_FLOOR); }
    for (const g of [...turnedGates, ...turnedGround]) { const by = -g.y * fore; x0 = Math.min(x0, g.x - HEX_CORNER); x1 = Math.max(x1, g.x + HEX_CORNER); y0 = Math.min(y0, by - faceH - 0.3); y1 = Math.max(y1, by + faceH + 0.05); }
    if (!Number.isFinite(x0)) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; }
    return { cols, faceH, x0, x1, y0, y1 };
  }, [turnedFields, turnedGates, turnedGround, scale, fore, step]);
  const fitCam = (): Cam => {
    const s = Math.max(4, Math.min((width - 24) / Math.max(0.5, world.x1 - world.x0), (height - 24) / Math.max(0.5, world.y1 - world.y0)));
    return { s, cx: (world.x0 + world.x1) / 2, cy: (world.y0 + world.y1) / 2 };
  };
  const focusCam = (key: string | null): Cam => {
    const fit = fitCam();
    const col = key === null ? undefined : world.cols.find((c) => c.f.key === key);
    if (col === undefined) return fit;
    /* Ist die ganze Ebene schon gross genug zum Lesen, bleibt sie ganz im Bild; sonst nah genug für Namen und Zeichen. */
    if (2 * HEX_CORNER * fit.s >= 40) return fit;
    const s = Math.max(fit.s, Math.min(fit.s * 1.8, 84 / (2 * HEX_CORNER)));
    return clampCam({ s, cx: col.bx, cy: (col.ty + col.by) / 2 });
  };
  const sMin = () => fitCam().s * 0.7;
  const sMax = () => Math.max(fitCam().s * 6, 320 / (2 * HEX_CORNER));
  const clampCam = (c: Cam): Cam => {
    const s = Math.max(sMin(), Math.min(sMax(), c.s));
    return { s, cx: Math.max(world.x0, Math.min(world.x1, c.cx)), cy: Math.max(world.y0, Math.min(world.y1, c.cy)) };
  };
  const [cam, setCamNow] = useState<Cam>(() => kept.cams[levelKey] ?? focusCam(focus));
  const camRef = useRef(cam);
  /* Solange der Lernende die Kamera nicht selbst bewegt hat, folgt sie der Karte (die Höhen kommen nach, die Breite ändert sich). */
  const auto = useRef(kept.cams[levelKey] === undefined);
  const setCam = (c: Cam, byHand = true) => { camRef.current = c; setCamNow(c); if (byHand) { auto.current = false; kept.cams[levelKey] = c; } };
  /* Eine andere Ebene: ihre gemerkte Kamera, sonst beim nächsten Schritt (nah) — sonst das Ganze. */
  const seenLevel = useRef(levelKey);
  useLayoutEffect(() => {
    if (seenLevel.current === levelKey) return;
    seenLevel.current = levelKey;
    auto.current = kept.cams[levelKey] === undefined;
    setCam(kept.cams[levelKey] ?? focusCam(focus), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);
  /* Neue Breite oder andere Höhen: die Kamera bleibt im Land — und folgt ihr, solange niemand sie bewegt hat. */
  useEffect(() => { setCam(auto.current ? focusCam(focus) : clampCam(camRef.current), false); }, [width, world]); // eslint-disable-line react-hooks/exhaustive-deps
  /* „Ganze Karte", „Zu mir" von aussen. */
  const seenCommand = useRef<number>(command?.at ?? 0);
  useEffect(() => {
    if (command === null || command.at === seenCommand.current) return;
    seenCommand.current = command.at;
    glide(command.kind === 'fit' ? fitCam() : focusCam(focus));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.at]);
  useEffect(() => { kept.rot = rot; keepSoon(memoryKey); }, [rot, kept, memoryKey]);
  useEffect(() => () => keepSoon(memoryKey), [memoryKey]);

  /* -- Bewegung: ziehen (mit Ausrollen), zwei Finger, Rad, Knöpfe — sanft ------------------------------------- */
  const frame = useRef(0);
  const stop = () => { if (frame.current !== 0) { cancelAnimationFrame(frame.current); frame.current = 0; } };
  useEffect(() => stop, []);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const glide = (to: Cam) => {
    stop();
    const target = clampCam(to);
    if (reduced) { setCam(target); return; }
    const from = camRef.current;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 260);
      const e = 1 - (1 - k) ** 3;
      setCam({ s: from.s * (target.s / from.s) ** e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e });
      frame.current = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };
  const zoomAt = (factor: number, sx: number, sy: number) => {
    const c = camRef.current;
    const s = Math.max(sMin(), Math.min(sMax(), c.s * factor));
    if (s <= sMin() + 1e-6 && factor < 1 && canUp && c.s <= fitCam().s * 0.75 + 1e-6) { onUp(); return; }
    const wx = c.cx + (sx - width / 2) / c.s;
    const wy = c.cy + (sy - height / 2) / c.s;
    setCam(clampCam({ s, cx: wx - (sx - width / 2) / s, cy: wy - (sy - height / 2) / s }));
  };
  const svg = useRef<SVGSVGElement>(null);
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const box = svg.current?.getBoundingClientRect();
    return box === undefined ? [e.clientX, e.clientY] : [((e.clientX - box.left) / Math.max(1, box.width)) * width, ((e.clientY - box.top) / Math.max(1, box.height)) * height];
  };
  useEffect(() => {
    const el = svg.current;
    if (el === null) return undefined;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      const [x, y] = local(e);
      zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)), x, y);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; cam: Cam; moved: boolean; vx: number; vy: number; t: number; pinch: { d: number; s: number } | null; target: Element | null } | null>(null);
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    stop();
    const [x, y] = local(e);
    pointers.current.set(e.pointerId, { x, y });
    svg.current?.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 1) drag.current = { x, y, cam: camRef.current, moved: false, vx: 0, vy: 0, t: performance.now(), pinch: null, target: e.target as Element | null };
    else if (pointers.current.size === 2 && drag.current !== null) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { ...drag.current, moved: true, pinch: { d: Math.hypot(a.x - b.x, a.y - b.y), s: camRef.current.s } };
    }
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || drag.current === null) return;
    const [x, y] = local(e);
    const was = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x, y });
    const d = drag.current;
    if (pointers.current.size >= 2 && d.pinch !== null) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = (d.pinch.s * (dist / Math.max(1, d.pinch.d))) / camRef.current.s;
      zoomAt(factor, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 6) return;
    d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.vx = 0.8 * ((x - was.x) / dt) + 0.2 * d.vx;
    d.vy = 0.8 * ((y - was.y) / dt) + 0.2 * d.vy;
    d.t = now;
    setCam(clampCam({ s: d.cam.s, cx: d.cam.cx - (x - d.x) / d.cam.s, cy: d.cam.cy - (y - d.y) / d.cam.s }));
  };
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    drag.current = null;
    if (d === null) return;
    if (!d.moved) {
      /* Gefangen ist der Zeiger beim Bild: was getroffen wurde, sagt der Anfang. */
      const el = d.target?.closest?.('[data-ls-key],[data-ls-gate]');
      const key = el?.getAttribute('data-ls-key');
      const gate = el?.getAttribute('data-ls-gate');
      if (key != null) onChoose(key); else if (gate != null) onGate(gate); else onBackground();
      return;
    }
    /* Ausrollen: die Geschwindigkeit nimmt ab, am Rand hält die Karte. */
    if (reduced || Math.hypot(d.vx, d.vy) < 0.15) return;
    let vx = d.vx;
    let vy = d.vy;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(40, t - last);
      last = t;
      const c = camRef.current;
      const next = clampCam({ s: c.s, cx: c.cx - (vx * dt) / c.s, cy: c.cy - (vy * dt) / c.s });
      if (Math.abs(next.cx - (c.cx - (vx * dt) / c.s)) > 1e-6) vx = 0;
      if (Math.abs(next.cy - (c.cy - (vy * dt) / c.s)) > 1e-6) vy = 0;
      setCam(next);
      const k = 0.92 ** (dt / 16);
      vx *= k;
      vy *= k;
      frame.current = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };

  /* -- Auf den Schirm ---------------------------------------------------------------------------------------- */
  const sx = (x: number) => width / 2 + (x - cam.cx) * cam.s;
  const sy = (y: number) => height / 2 + (y - cam.cy) * cam.s;
  const P = (x: number, y: number) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
  const topWidth = 2 * HEX_CORNER * cam.s;
  const signR = topWidth / 6;
  const showSigns = signR * 2 >= MIN_SIGN;
  const showNames = topWidth >= NAME_AT;
  const face = (x: number, y: number, k = 1) => HEX_CORNERS.map(([cx, cy]) => P(x + cx * k, y - cy * fore * k)).join(' ');
  const sides = (x: number, top: number, base: number) => [[3, 4], [4, 5], [5, 0]].map(([a, b]) => [
    P(x + HEX_CORNERS[a][0], base - HEX_CORNERS[a][1] * fore + HEX_FLOOR), P(x + HEX_CORNERS[b][0], base - HEX_CORNERS[b][1] * fore + HEX_FLOOR),
    P(x + HEX_CORNERS[b][0], top - HEX_CORNERS[b][1] * fore), P(x + HEX_CORNERS[a][0], top - HEX_CORNERS[a][1] * fore)
  ].join(' '));
  const far = (steps: number) => (steps >= 12 ? 4 : steps >= 8 ? 3 : steps >= 5 ? 2 : steps >= 3 ? 1 : 0);
  const routeIndex = new Map((route?.keys ?? []).map((k, i) => [k, i] as const));
  const restSet = new Set(route?.rest ?? []);
  /* Von hinten nach vorn: Tore und Felder zusammen. */
  const order = [
    ...world.cols.map((c) => ({ kind: 'field' as const, y: turnedFields[c.i].y, c })),
    ...turnedGates.map((g, j) => ({ kind: 'gate' as const, y: g.y, j }))
  ].sort((a, b) => b.y - a.y);

  /* Namen im Nahen: AUF der eigenen Fläche (so deckt kein Name ein anderes Feld; eine Säule davor deckt ihn wie die Fläche). */
  const nameOf = (f: MapField): string | null => {
    if (!showNames) return null;
    const fit = Math.max(4, Math.floor((topWidth * 0.86) / 6.3));
    const plain = f.label.replace(/^(Wokół: |Rund um |Around )/, '');
    return plain.length > fit ? `${plain.slice(0, fit - 1)}…` : plain;
  };

  const [hover, setHover] = useState<string | null>(null);
  const hovered = hover === null ? undefined : world.cols.find((c) => c.f.key === hover);
  const tip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = tip.current;
    if (el === null || hovered === undefined) return;
    el.style.left = `${Math.round(sx(hovered.bx))}px`;
    el.style.top = `${Math.round(sy(hovered.ty - world.faceH) - 8)}px`;
  });

  const keys = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); glide({ ...camRef.current, s: camRef.current.s * 1.4 }); return; }
    if (e.key === '-') { e.preventDefault(); if (camRef.current.s <= fitCam().s * 1.01 && canUp) onUp(); else glide({ ...camRef.current, s: camRef.current.s / 1.4 }); return; }
    if (e.key === 'Escape' || e.key === 'Backspace') { if (canUp) { e.preventDefault(); onUp(); } return; }
    const el = (e.target as Element).closest('[data-ls-key]');
    const at = el === null ? undefined : world.cols.find((c) => c.f.key === el.getAttribute('data-ls-key'));
    if (at === undefined) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(at.f.key); return; }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (d === undefined) return;
    e.preventDefault();
    let best: (typeof world.cols)[number] | undefined;
    let score = Number.POSITIVE_INFINITY;
    for (const c of world.cols) {
      if (c === at) continue;
      const dx = sx(c.bx) - sx(at.bx);
      const dy = sy(c.ty) - sy(at.ty);
      const along = dx * d[0] + dy * d[1];
      if (along <= 4) continue;
      const s = along + Math.abs(dx * d[1] - dy * d[0]) * 2;
      if (s < score) { score = s; best = c; }
    }
    if (best !== undefined) svg.current?.querySelector<SVGGElement>(`[data-ls-key="${CSS.escape(best.f.key)}"]`)?.focus();
  };

  const routePts = (route?.keys ?? []).map((k) => world.cols.find((c) => c.f.key === k)).filter((c): c is (typeof world.cols)[number] => c !== undefined);
  const subject = (f: MapField) => (f.subject >= 0 && f.subject < 8 ? f.subject : 'x');
  const shareStep = (f: MapField) => Math.min(4, Math.floor(f.share * 5));

  return (
    <div className={`cg-rm${compact ? ' is-compact' : ''}`} data-rm-level={levelKey} data-rm-fore={fore.toFixed(2)} data-rm-step={step.toFixed(4)} data-rm-scale={cam.s.toFixed(2)}
      data-rm-cut={scale.cut.filter(Boolean).length} data-rm-world={[world.x0, world.x1, world.y0, world.y1].map((v) => v.toFixed(2)).join(',')} data-rm-cam={[cam.s, cam.cx, cam.cy].map((v) => v.toFixed(2)).join(',')} data-rm-auto={auto.current ? '1' : '0'} data-rm-signs={showSigns ? '1' : '0'} data-rm-names={showNames ? '1' : '0'} data-rm-rot={rot}>
      <svg ref={svg} className="cg-rm-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={T.mapLabel} tabIndex={-1}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keys}
        onPointerOver={(e) => { if (e.pointerType !== 'mouse') return; const k = (e.target as Element).closest?.('[data-ls-key]')?.getAttribute('data-ls-key'); setHover(k ?? null); }}
        onPointerLeave={() => setHover(null)} data-landscape-svg="">
        <defs>
          <pattern id={`${pid}-cut`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} className="cg-rm-hatch" />
          </pattern>
        </defs>
        {/* Der Boden: ein Raster, Kante an Kante — kein Wissen, nur Land. */}
        <g className="cg-rm-ground" aria-hidden>
          {turnedGround.map((g, i) => <polygon key={i} points={face(g.x, -g.y * fore)} />)}
        </g>
        {order.map((o) => {
          if (o.kind === 'gate') {
            const g = turnedGates[o.j];
            const by = -g.y * fore;
            return (
              <g key={`gate:${g.key}`} className={`cg-rm-gate${g.before ? ' is-before' : ''}${g.after ? ' is-after' : ''}`} data-ls-gate={g.key} role="button" tabIndex={0} aria-label={T.gate(g.label)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGate(g.key); } }}>
                <polygon className="cg-rm-gate-face" points={face(g.x, by)} />
                <polygon className="cg-rm-gate-door" points={face(g.x, by, 0.5)} />
              </g>
            );
          }
          const { c } = o;
          const f = c.f;
          const cut = scale.cut[c.i];
          const cls = `cg-rm-col is-${f.band} is-s${subject(f)}${f.kind === 'region' ? ' is-region' : ''}${f.glow ? ' is-glow' : ''}${f.conquered ? ' is-conquered' : ''}`
            + `${far(f.steps) > 0 ? ` is-far${far(f.steps)}` : ''}${f.kind === 'region' && f.band !== 'known' && f.band !== 'due' ? ` is-k${shareStep(f)}` : ''}`
            + `${f.key === chosen ? ' is-on' : ''}${f.key === hover ? ' is-hover' : ''}${routeIndex.has(f.key) ? ' is-route' : ''}${restSet.has(f.key) ? ' is-route-rest' : ''}${cut ? ' is-cut' : ''}`;
          const cx = sx(c.bx);
          const cy = sy(c.ty);
          const ring = f.kind === 'region' && f.share > 0 && f.band !== 'known' && f.band !== 'due';
          const signShown = f.sign !== null && (showSigns || f.key === chosen || f.key === next);
          return (
            <g key={f.key} className={cls} data-ls-key={f.key} data-ls-field={f.key} data-ls-band={f.band} data-ls-kind={f.kind} data-ls-steps={f.steps} data-ls-drawn={scale.drawn[c.i]}
              data-ls-visible={scale.visible[c.i].toFixed(2)} data-ls-x={cx.toFixed(1)} data-ls-top={cy.toFixed(1)} data-ls-base={sy(c.by).toFixed(1)}
              tabIndex={0} role="button" aria-pressed={f.key === chosen} aria-label={f.title}>
              {sides(c.bx, c.ty, c.by).map((p, j) => <polygon key={j} className={`cg-rm-side is-${['l', 'f', 'r'][j]}`} points={p} />)}
              <polygon className="cg-rm-face" points={face(c.bx, c.ty)} />
              {cut && <polygon className="cg-rm-cutface" points={face(c.bx, c.ty)} fill={`url(#${pid}-cut)`} data-ls-cut="" />}
              {f.kind === 'region' && <polygon className="cg-rm-plateau" points={face(c.bx, c.ty, 0.62)} />}
              {ring && (() => {
                const r = HEX_CORNER * 0.78 * cam.s;
                const k = Math.max(0.02, Math.min(1, f.share));
                const pts: string[] = [];
                for (let a = 0; a <= 48; a += 1) { const t = -Math.PI / 2 + (a / 48) * k * 2 * Math.PI; pts.push(`${(cx + Math.cos(t) * r).toFixed(1)},${(cy + Math.sin(t) * r * fore).toFixed(1)}`); }
                return <polyline className="cg-rm-ring" points={pts.join(' ')} data-ls-ring={f.share.toFixed(2)} />;
              })()}
              {f.preview !== undefined && f.preview.length > 0 && topWidth >= 84 && !signShown && (
                <g className="cg-rm-preview" aria-hidden>
                  {f.preview.map((p, j) => <circle key={j} className={`is-${p.band}`} cx={cx + p.x * HEX_CORNER * 0.42 * cam.s} cy={cy + p.y * HEX_CORNER * 0.42 * cam.s * fore} r={Math.max(1.2, topWidth / 70)} />)}
                </g>
              )}
              {signShown && <SignIcon kind={f.sign!} r={Math.max(MIN_SIGN / 2, signR)} fore={fore} x={cx} y={cy} />}
              {f.conquered && !signShown && topWidth >= 30 && <FlagIcon x={cx + HEX_CORNER * 0.35 * cam.s} y={cy - HEX_CORNERS[1][1] * fore * 0.2 * cam.s} h={Math.max(8, topWidth * 0.22)} />}
              {f.home && <MeIcon x={cx - HEX_CORNER * 0.42 * cam.s} y={cy + HEX_CORNERS[1][1] * fore * 0.35 * cam.s} h={Math.max(9, topWidth * 0.24)} />}
              {(() => {
                const name = nameOf(f);
                if (name === null) return null;
                const below = signShown ? Math.max(MIN_SIGN / 2, signR) * Math.max(0.72, fore) + 9 : 4;
                return <text className={`cg-rm-name${f.key === chosen ? ' is-on' : ''}`} x={cx} y={cy + below} textAnchor="middle" aria-hidden data-ls-name={f.key}>{name}</text>;
              })()}
            </g>
          );
        })}
        {/* Der Weg: EINE Linie in der Reihenfolge der Liste, Schritt 1 hervorgehoben. */}
        {routePts.length > 0 && (
          <g className="cg-rm-route" aria-hidden data-ls-route={routePts.length}>
            {routePts.length > 1 && <polyline className="cg-rm-routeline" points={routePts.map((c) => P(c.bx, c.ty - world.faceH * 0.55)).join(' ')} />}
            {routePts.map((c, k) => {
              const first = k === 0 && routePts.length > 1;
              const goal = k === routePts.length - 1;
              const r = first ? 7 : 5.5;
              return (
                <g key={c.f.key} className={`cg-rm-step${first ? ' is-first' : ''}${goal ? ' is-goal' : ''}`} data-ls-route-step={k + 1}>
                  {/* Hinten auf der Fläche (das Zeichen in ihrer Mitte bleibt frei). */}
                  <circle cx={sx(c.bx)} cy={sy(c.ty - world.faceH * 0.55)} r={r} />
                  {topWidth >= 40 && !goal && <text x={sx(c.bx)} y={sy(c.ty - world.faceH * 0.55) + 3.5} textAnchor="middle">{k + 1}</text>}
                </g>
              );
            })}
          </g>
        )}
        {/* Die Zahl am Ziel: so viele Themen bis dorthin (die Legende sagt es). */}
        {world.cols.filter((c) => c.f.badge != null && c.f.badge > 0).map((c) => (
          <g key={`badge:${c.f.key}`} className="cg-rm-badge" aria-hidden data-ls-badge={c.f.badge}>
            <rect x={sx(c.bx) + HEX_CORNER * 0.5 * cam.s} y={sy(c.ty - world.faceH) - 18} width={String(c.f.badge).length * 7 + 10} height={16} rx={8} />
            <text x={sx(c.bx) + HEX_CORNER * 0.5 * cam.s + (String(c.f.badge).length * 7 + 10) / 2} y={sy(c.ty - world.faceH) - 6} textAnchor="middle">{c.f.badge}</text>
          </g>
        ))}
        {(() => {
          /* Die Namen der Tore: ohne einander zu decken (sonst nur beim Zeigen, als Hinweis). */
          if (topWidth < 40) return null;
          const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
          return turnedGates.map((g) => {
            const text = g.label.length > 24 ? `${g.label.slice(0, 22)}…` : g.label;
            const x = sx(g.x);
            const y = sy(-g.y * fore) - world.faceH * cam.s - 6;
            const w = text.length * 6.4 + 8;
            const box = { x0: x - w / 2, x1: x + w / 2, y0: y - 12, y1: y + 3 };
            if (placed.some((p) => p.x0 < box.x1 && box.x0 < p.x1 && p.y0 < box.y1 && box.y0 < p.y1)) return null;
            placed.push(box);
            return <text key={`gname:${g.key}`} className="cg-rm-gate-name" x={x} y={y} textAnchor="middle" aria-hidden>{text}</text>;
          });
        })()}
      </svg>
      {hovered !== undefined && <div ref={tip} className="cg-rm-tip" role="tooltip" data-landscape-tip="">{hovered.f.title}</div>}
      <div className="cg-rm-tools" role="group" aria-label={T.mapLabel}>
        <button type="button" className="cg-rm-tool" onClick={() => glide({ ...camRef.current, s: camRef.current.s * 1.5 })} aria-label={T.zoomIn} title={T.zoomIn} data-rm-zoom="in">+</button>
        <button type="button" className="cg-rm-tool" onClick={() => { if (camRef.current.s <= fitCam().s * 1.01 && canUp) onUp(); else glide({ ...camRef.current, s: camRef.current.s / 1.5 }); }} aria-label={T.zoomOut} title={T.zoomOut} data-rm-zoom="out">−</button>
        <button type="button" className="cg-rm-tool is-icon" onClick={() => setRot((r) => (r + 1) % 6)} aria-label={T.rotate} title={T.rotate} data-landscape-rotate={rot}>
          <svg viewBox="-8 -8 16 16" aria-hidden><path d="M5.2,-2.6 A6,6 0 1 0 6,1.4 M5.2,-2.6 L1.6,-3.2 M5.2,-2.6 L5.8,0.8" /></svg>
        </button>
      </div>
      {legend(fore, new Set(world.cols.filter((c) => { const x = sx(c.bx); const y = sy(c.ty); return x > -20 && x < width + 20 && y > -20 && y < height + 20; }).map((c) => c.f.key)))}
    </div>
  );
}
