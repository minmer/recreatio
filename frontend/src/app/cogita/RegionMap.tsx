/**
 * 2026-11-04 (Prompt 11) — DIE KARTE EINER EBENE DES KRAJOBRAZ: Gebiete oder Themen (nie gemischt), senkrecht ohne
 * Fluchtpunkt, EIN Schritt für alle (`levelMap.ts` viewScale), ziehen, Rad, zwei Finger, „+"/„−", sanftes Ausrollen bis
 * zum Rand; „Zu mir", „Ganze Karte", 60°. Was weit weg ist, verblasst; was jetzt geht, hat einen hellen Rand; höchstens
 * EIN Zeichen je Feld (erst wiederholen > zu wiederholen), klein, hell, auf der Fläche liegend. Tore am Rand führen hinaus.
 * Passt sich seinem Behälter an (Breite gemessen), nicht dem Fenster.
 *
 * 2026-11-04 (Prompt 12) — EIN GEBIET ZEIGT SEIN INNERES: keine Säule, sondern eine umrandete, leicht erhabene Fläche in
 * seiner Farbe, auf der seine Themen als eigene kleine Säulen stehen (eigene Höhe, eigene Farbe — wie eine Ebene tiefer);
 * ist es zu gross, seine Teilgebiete ebenso (je ein Umriss mit Relief) oder eine kleine Skizze (`levelMap.ts` unitsOf).
 * Der Rand trägt den Fortschritt (der helle Teil: so viel ist gelernt) und das Eroberte; der Name steht ganz auf einem
 * Schild neben der Fläche (zwei Zeilen, nie gekürzt). Ein Tippen auf ein Gebiet zoomt hinein, auf ein Thema wählt es.
 * Das Relief liegt in Weltmassen in einer Gruppe, die nur verschoben wird — so bleiben Hunderte Säulen beim Ziehen flüssig.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import type { LsBand } from './landscape';
import { HEX_CORNER, HEX_CORNERS, HEX_FLOOR, rotated, stepRange, viewScale } from './levelMap';
import type { LandscapeWords } from './landscapeWords';

export type SignKind = 'first' | 'due';

/** Eine Säule im Inneren eines Gebiets (ein Thema — oder eines, das in der Skizze für mehrere steht). */
export interface MapCell {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly steps: number;
  readonly band: LsBand;
  readonly subject: number;
  readonly glow: boolean;
  readonly home: boolean;
  /** Das Stück der Fläche (Teilgebiet), zu dem es gehört. */
  readonly part: number;
  /** Seine Kanten am Rand des Gebiets (k: von Ecke k zu Ecke k+1, ungedreht); `lit`: im hellen Teil (so viel ist gelernt). */
  readonly rim?: readonly { readonly k: number; readonly lit: boolean }[];
}

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
  /** Wie viel davon sitzt (0–1): die Tiefe der Farbe, bei einem Gebiet der helle Teil seines Randes. */
  readonly share: number;
  /** Jetzt lernbar (ein Thema auf dem Ring, ein Gebiet mit Lernbarem). */
  readonly glow: boolean;
  /** Ein erobertes Gebiet (alles darin gelernt): warm, mit Fahne. */
  readonly conquered: boolean;
  /** Hier steht der Lernende (sein nächster Schritt liegt hier). */
  readonly home: boolean;
  /** Am Ziel: so viele Themen bis dorthin. */
  readonly badge?: number | null;
  /** Ein Thema, das ein zweites Tippen beginnt. */
  readonly startable?: boolean;
  /** Ein Gebiet: seine Säulen (das Relief) … */
  readonly cells?: readonly MapCell[];
  /** … sein Umriss (Bodeneinheiten, geschlossene Linien) und die Umrisse seiner Teilgebiete. */
  readonly outline?: readonly (readonly (readonly [number, number])[])[];
  readonly parts?: readonly (readonly (readonly (readonly [number, number])[])[])[];
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
  /** Die gezeichneten Schritte in der Reihenfolge der Liste (Felder, oder Themen im Relief eines Gebiets). */
  readonly keys: readonly string[];
  /** Felder des Weges, die nicht als Linie kommen (ein langer Weg: nur ihr Umriss). */
  readonly rest: readonly string[];
}

export interface MapCommand {
  readonly kind: 'fit' | 'focus';
  readonly at: number;
}

interface Cam { s: number; cx: number; cy: number }

/** Wie hoch die Fläche eines Gebiets über dem Boden liegt (Bodeneinheiten): „leicht erhaben". */
const PLATE = 0.1;

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

/* -- Schilder: der ganze Name, höchstens zwei Zeilen (breiter statt gekürzt) ----------------------------------------- */

let measureCtx: CanvasRenderingContext2D | null | undefined;
let measureFont = '';
/** Wie breit ein Text auf dem Schild ist (px) — mit der Schrift der Seite gemessen, sonst geschätzt. */
function textWidth(text: string, bold: boolean): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
      const root = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
      const px = root === null ? 16 : parseFloat(root.fontSize) || 16;
      const body = typeof document === 'undefined' || document.body === null ? null : getComputedStyle(document.body);
      measureFont = `${px * 0.75}px ${body?.fontFamily ?? root?.fontFamily ?? 'sans-serif'}`;
    } catch { measureCtx = null; }
  }
  if (measureCtx === null || measureCtx === undefined) return text.length * (bold ? 7.2 : 6.8);
  measureCtx.font = `${bold ? '700 ' : ''}${measureFont}`;
  /* Ein wenig Luft: die Schrift im Bild kann breiter laufen als gemessen. */
  return measureCtx.measureText(text).width * 1.08 + 2;
}

/** Der Name in Zeilen von höchstens `max` px — wird es mehr als zwei, wird die Zeile breiter (nie gekürzt). */
function wrapName(name: string, max: number, bold: boolean): { lines: string[]; width: number } {
  const words = name.split(/\s+/).filter((w) => w !== '');
  const lay = (limit: number): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line === '' ? w : `${line} ${w}`;
      if (line !== '' && textWidth(next, bold) > limit) { lines.push(line); line = w; } else line = next;
    }
    if (line !== '') lines.push(line);
    return lines;
  };
  let limit = max;
  let lines = lay(limit);
  for (let k = 0; k < 12 && lines.length > 2; k += 1) { limit *= 1.18; lines = lay(limit); }
  return { lines, width: Math.max(...lines.map((l) => textWidth(l, bold)), 10) };
}

/* -- Die Karte ------------------------------------------------------------------------------------------------- */

const MIN_SIGN = 12;
const NAME_AT = 104;
const LINE_H = 14;

export function RegionMap({ levelKey, depth, fields, gates, ground, route, chosen, next, focus, width, compact, T, memoryKey, canUp, command, onChoose, onGate, onUp, onBackground, legend }: {
  levelKey: string;
  /** Wie tief die Ebene liegt (0 oben): hinein wird gezoomt, hinauf hinaus. */
  depth: number;
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
  const regional = fields.some((f) => f.cells !== undefined && f.cells.length > 0);

  /* Die Mitte: um sie wird gedreht (bei Gebieten die Mitte aller Säulen). */
  const centre = useMemo(() => {
    const pts: { x: number; y: number }[] = regional ? fields.flatMap((f) => f.cells ?? []) : [...fields];
    if (pts.length === 0) return { x: 0, y: 0 };
    return { x: pts.reduce((s, f) => s + f.x, 0) / pts.length, y: pts.reduce((s, f) => s + f.y, 0) / pts.length };
  }, [fields, regional]);
  const turnedFields = useMemo(() => rotated(fields, rot, centre.x, centre.y), [fields, rot, centre]);
  const turnedGates = useMemo(() => rotated(gates, rot, centre.x, centre.y), [gates, rot, centre]);
  const turnedGround = useMemo(() => rotated(ground, rot, centre.x, centre.y), [ground, rot, centre]);
  /* Die Säulen, die gemessen und gezeichnet werden: Themen — oder das Relief jedes Gebiets. */
  const columns = useMemo(() => {
    const out: { key: string; owner: number; x: number; y: number; steps: number; important: boolean; cell: MapCell | null }[] = [];
    turnedFields.forEach((f, i) => {
      if (f.cells !== undefined && f.cells.length > 0) {
        for (const c of rotated(f.cells, rot, centre.x, centre.y)) out.push({ key: c.key, owner: i, x: c.x, y: c.y, steps: c.steps, important: c.glow || c.home, cell: c });
      } else if (!regional) out.push({ key: f.key, owner: i, x: f.x, y: f.y, steps: f.steps, important: f.glow || f.sign !== null || f.key === chosen || f.key === next, cell: null });
    });
    return out;
  }, [turnedFields, rot, centre, regional, chosen, next]);
  const turnedOutlines = useMemo(() => turnedFields.map((f) => ({
    outline: (f.outline ?? []).map((loop) => rotated(loop.map(([x, y]) => ({ x, y })), rot, centre.x, centre.y)),
    parts: (f.parts ?? []).map((loops) => loops.map((loop) => rotated(loop.map(([x, y]) => ({ x, y })), rot, centre.x, centre.y)))
  })), [turnedFields, rot, centre]);
  /* Der Fussabdruck am Boden: wie gross eine Bodeneinheit bei „Ganze Karte" etwa wird (für die kleinste lesbare Stufe). */
  const footprint = useMemo(() => {
    const pts = [...columns, ...turnedGates];
    const xs = pts.map((f) => f.x);
    const ys = pts.map((f) => f.y);
    const spanX = (xs.length === 0 ? 1 : Math.max(...xs) - Math.min(...xs)) + 2 * HEX_CORNER;
    const spanY = (ys.length === 0 ? 1 : Math.max(...ys) - Math.min(...ys)) * 0.52 + 1;
    return Math.max(8, Math.min((width - 24) / spanX, (height - 24) / spanY));
  }, [columns, turnedGates, width, height]);
  /* Die Stufe: eine für alle (`levelMap.ts` stepRange — bei Gebieten flacher, ein Überblick). */
  const scale = useMemo(() => viewScale(columns, stepRange(columns, footprint, regional)), [columns, footprint, regional]);
  const { fore, step } = scale;
  const plate = regional ? PLATE : 0;

  /* Wo alles in der Welt liegt (Bodeneinheiten; y nach unten). */
  const world = useMemo(() => {
    const faceH = HEX_CORNERS[1][1] * fore;
    const cols = columns.map((c, i) => {
      const lift = scale.drawn[i];
      const bx = c.x;
      const by = -c.y * fore;
      return { c, i, bx, by, ty: by - plate - lift * step, lift };
    });
    let x0 = Number.POSITIVE_INFINITY; let x1 = Number.NEGATIVE_INFINITY; let y0 = Number.POSITIVE_INFINITY; let y1 = Number.NEGATIVE_INFINITY;
    for (const c of cols) { x0 = Math.min(x0, c.bx - HEX_CORNER); x1 = Math.max(x1, c.bx + HEX_CORNER); y0 = Math.min(y0, c.ty - faceH - 0.25); y1 = Math.max(y1, c.by + faceH + HEX_FLOOR); }
    for (const g of [...turnedGates, ...turnedGround]) { const by = -g.y * fore; x0 = Math.min(x0, g.x - HEX_CORNER); x1 = Math.max(x1, g.x + HEX_CORNER); y0 = Math.min(y0, by - faceH - 0.3); y1 = Math.max(y1, by + faceH + 0.05); }
    if (!Number.isFinite(x0)) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; }
    /* Über einem Gebiet Platz für sein Schild. */
    if (regional) y0 -= 1.2;
    /* Je Feld seine Mitte (ein Gebiet: die Mitte seiner Säulen, oben auf ihnen). */
    const hubs = turnedFields.map((f, i) => {
      const mine = cols.filter((c) => c.c.owner === i);
      if (mine.length === 0) return { x: f.x, top: -f.y * fore, base: -f.y * fore, x0: f.x, x1: f.x, y0: -f.y * fore, y1: -f.y * fore };
      const xs = mine.map((c) => c.bx);
      return {
        x: xs.reduce((s, v) => s + v, 0) / xs.length,
        top: mine.reduce((s, c) => s + c.ty, 0) / mine.length,
        base: mine.reduce((s, c) => s + c.by, 0) / mine.length,
        x0: Math.min(...xs) - HEX_CORNER, x1: Math.max(...xs) + HEX_CORNER,
        y0: Math.min(...mine.map((c) => c.ty)) - faceH, y1: Math.max(...mine.map((c) => c.by)) + faceH + HEX_FLOOR
      };
    });
    return { cols, faceH, x0, x1, y0, y1, hubs };
  }, [columns, turnedFields, turnedGates, turnedGround, scale, fore, step, plate]);
  const colByKey = useMemo(() => new Map(world.cols.map((c) => [c.c.key, c] as const)), [world]);
  const fitCam = (): Cam => {
    const s = Math.max(4, Math.min((width - 24) / Math.max(0.5, world.x1 - world.x0), (height - 24) / Math.max(0.5, world.y1 - world.y0)));
    return { s, cx: (world.x0 + world.x1) / 2, cy: (world.y0 + world.y1) / 2 };
  };
  const focusCam = (key: string | null): Cam => {
    const fit = fitCam();
    /* Gebiete: die ganze Ebene (die Flächen sind gross genug), ausser das Relief wäre zu klein zum Lesen. */
    if (regional && 2 * HEX_CORNER * fit.s >= 12) return fit;
    const i = key === null ? -1 : turnedFields.findIndex((f) => f.key === key);
    const col = key === null ? undefined : colByKey.get(key);
    const hub = i >= 0 ? world.hubs[i] : col === undefined ? null : { x: col.bx, top: col.ty, base: col.by };
    if (hub === null) return fit;
    /* Ist die ganze Ebene schon gross genug zum Lesen, bleibt sie ganz im Bild; sonst nah genug für Namen und Zeichen. */
    if (!regional && 2 * HEX_CORNER * fit.s >= 40) return fit;
    const s = Math.max(fit.s, Math.min(fit.s * 1.8, (regional ? 30 : 84) / (2 * HEX_CORNER)));
    return clampCam({ s, cx: hub.x, cy: (hub.top + hub.base) / 2 });
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

  /* -- Bewegung: ziehen (mit Ausrollen), zwei Finger, Rad, Knöpfe — sanft ------------------------------------- */
  const frame = useRef(0);
  const stop = () => { if (frame.current !== 0) { cancelAnimationFrame(frame.current); frame.current = 0; } };
  useEffect(() => stop, []);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const glide = (to: Cam, byHand = true, from: Cam = camRef.current, ms = 260) => {
    stop();
    const target = clampCam(to);
    if (reduced) { setCam(target, byHand); return; }
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      setCam({ s: from.s * (target.s / from.s) ** e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e }, byHand && k >= 1);
      frame.current = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };

  /* Eine andere Ebene: ihre gemerkte Kamera, sonst beim nächsten Schritt — und dorthin sanft (hinein: aus der Ferne näher, hinauf: umgekehrt). */
  const seenLevel = useRef(levelKey);
  const seenDepth = useRef(depth);
  useLayoutEffect(() => {
    if (seenLevel.current === levelKey) return;
    seenLevel.current = levelKey;
    const deeper = depth > seenDepth.current;
    const higher = depth < seenDepth.current;
    seenDepth.current = depth;
    auto.current = kept.cams[levelKey] === undefined;
    const target = kept.cams[levelKey] ?? focusCam(focus);
    if (reduced || (!deeper && !higher)) { setCam(target, false); return; }
    const from = { ...target, s: target.s * (deeper ? 0.55 : 1.9) };
    setCam(from, false);
    glide(target, false, from, 320);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);
  /* Neue Breite oder andere Höhen: die Kamera bleibt im Land — und folgt ihr, solange niemand sie bewegt hat. */
  useEffect(() => { if (frame.current !== 0) return; setCam(auto.current ? focusCam(focus) : clampCam(camRef.current), false); }, [width, world]); // eslint-disable-line react-hooks/exhaustive-deps
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
  /** Was unter dem Zeiger liegt: ein Feld (auch ein Gebiet über eine seiner Säulen), ein Tor. */
  const targetOf = (el: Element | null): { key: string | null; gate: string | null } => {
    const hit = el?.closest?.('[data-ls-key],[data-ls-in],[data-ls-gate]') ?? null;
    return { key: hit?.getAttribute('data-ls-key') ?? hit?.getAttribute('data-ls-in') ?? null, gate: hit?.getAttribute('data-ls-gate') ?? null };
  };
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
  const tip = useRef<HTMLDivElement>(null);
  const tipAt = useRef<[number, number]>([0, 0]);
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && drag.current === null) {
      const [x, y] = local(e);
      tipAt.current = [x, y];
      if (tip.current !== null) { tip.current.style.left = `${Math.round(x)}px`; tip.current.style.top = `${Math.round(y - 14)}px`; }
      const k = targetOf(e.target as Element).key;
      if (k !== hover) setHover(k);
    }
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
      const { key, gate } = targetOf(d.target);
      if (key !== null) onChoose(key); else if (gate !== null) onGate(gate); else onBackground();
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
      const nextCam = clampCam({ s: c.s, cx: c.cx - (vx * dt) / c.s, cy: c.cy - (vy * dt) / c.s });
      if (Math.abs(nextCam.cx - (c.cx - (vx * dt) / c.s)) > 1e-6) vx = 0;
      if (Math.abs(nextCam.cy - (c.cy - (vy * dt) / c.s)) > 1e-6) vy = 0;
      setCam(nextCam);
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
  const subject = (s: number) => (s >= 0 && s < 8 ? s : 'x');
  const [hover, setHover] = useState<string | null>(null);

  /*
    Das Relief der Gebiete in Weltmassen (nur die Gruppe wird verschoben und gezoomt): von hinten nach vorn, jede Säule auf
    der leicht erhabenen Fläche ihres Gebiets.
  */
  const relief = useMemo(() => {
    if (!regional) return null;
    const W = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`;
    const wface = (x: number, y: number) => HEX_CORNERS.map(([cx, cy]) => W(x + cx, y - cy * fore)).join(' ');
    const wsides = (x: number, top: number, base: number) => [[3, 4], [4, 5], [5, 0]].map(([a, b]) => [
      W(x + HEX_CORNERS[a][0], base - HEX_CORNERS[a][1] * fore + HEX_FLOOR), W(x + HEX_CORNERS[b][0], base - HEX_CORNERS[b][1] * fore + HEX_FLOOR),
      W(x + HEX_CORNERS[b][0], top - HEX_CORNERS[b][1] * fore), W(x + HEX_CORNERS[a][0], top - HEX_CORNERS[a][1] * fore)
    ].join(' '));
    const sorted = [...world.cols].sort((a, b) => b.c.y - a.c.y);
    return sorted.map((col) => {
      const c = col.c.cell!;
      const owner = turnedFields[col.c.owner];
      const cut = scale.cut[col.i];
      const cls = `cg-rm-col is-cell is-${c.band} is-s${subject(c.subject)}${c.glow ? ' is-glow' : ''}${owner.conquered ? ' is-conquered' : ''}${far(c.steps) > 0 ? ` is-far${far(c.steps)}` : ''}${cut ? ' is-cut' : ''}`;
      return (
        <g key={`${owner.key}:${c.key}`} className={cls} data-ls-in={owner.key} data-ls-cell={c.key} data-ls-band={c.band} data-ls-steps={c.steps} data-ls-drawn={scale.drawn[col.i]} data-ls-visible={scale.visible[col.i].toFixed(2)}>
          {wsides(col.bx, col.ty, col.by).map((p, j) => <polygon key={j} className={`cg-rm-side is-${['l', 'f', 'r'][j]}`} points={p} />)}
          <polygon className="cg-rm-face" points={wface(col.bx, col.ty)} />
          {cut && <polygon className="cg-rm-cutface" points={wface(col.bx, col.ty)} fill={`url(#${pid}-cut)`} data-ls-cut="" />}
          {/* Der Rand des Gebiets oben auf seinen äusseren Säulen: in seiner Farbe, der helle Teil — so viel ist gelernt. */}
          {(c.rim ?? []).length > 0 && [false, true].map((lit) => {
            const d = (c.rim ?? []).filter((e) => e.lit === lit).map((e) => { const a = HEX_CORNERS[(e.k + rot) % 6]; const b2 = HEX_CORNERS[(e.k + 1 + rot) % 6]; return `M${W(col.bx + a[0] * 0.94, col.ty - a[1] * fore * 0.94)}L${W(col.bx + b2[0] * 0.94, col.ty - b2[1] * fore * 0.94)}`; }).join('');
            return d === '' ? null : <path key={lit ? 'lit' : 'rim'} className={lit ? 'cg-rm-rim is-lit' : 'cg-rm-rim'} d={d} />;
          })}
        </g>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regional, world, scale, fore, turnedFields, pid, rot]);

  /* Die Schilder der Gebiete: der ganze Name, neben (über, unter) der Fläche, ohne einander zu decken. */
  const labels = useMemo(() => {
    if (!regional) return [];
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const order = turnedFields.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === 'region')
      .sort((a, b) => Number(b.f.home) - Number(a.f.home) || (b.f.cells?.length ?? 0) - (a.f.cells?.length ?? 0));
    const out: { key: string; i: number; x: number; y: number; w: number; h: number; lines: string[]; icon: boolean }[] = [];
    for (const { f, i } of order) {
      const hub = world.hubs[i];
      const wide = (hub.x1 - hub.x0) * cam.s;
      const icon = f.sign !== null || f.conquered;
      const { lines, width: tw } = wrapName(f.label, Math.max(96, Math.min(220, wide * 1.1)), f.home);
      const w = tw + 14 + (icon ? 16 : 0);
      const h = lines.length * LINE_H + 6;
      const mid = sx(hub.x);
      const top = sy(hub.y0);
      const bottom = sy(hub.y1);
      const centre = (top + bottom) / 2;
      /* Erst über, unter, neben der Fläche — dann immer weiter aussen im Kreis, bis ein freier Platz gefunden ist. */
      const tries: [number, number][] = [[mid, top - 4 - h / 2], [mid, bottom + 4 + h / 2], [mid - w / 2, top - 4 - h / 2], [mid + w / 2, top - 4 - h / 2], [mid, centre]];
      for (let d = 14; d <= 220; d += 14) for (let k = 0; k < 16; k += 1) { const ang = -Math.PI / 2 + (k / 16) * 2 * Math.PI; tries.push([mid + Math.cos(ang) * d * 1.6, centre + Math.sin(ang) * d]); }
      let best: { x: number; y: number; over: number } | null = null;
      for (const [x0, y0] of tries) {
        const x = Math.max(w / 2 + 2, Math.min(width - w / 2 - 2, x0));
        const y = Math.max(h / 2 + 2, Math.min(height - h / 2 - 2, y0));
        const box = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
        let over = 0;
        for (const p of placed) over += Math.max(0, Math.min(p.x1, box.x1) - Math.max(p.x0, box.x0)) * Math.max(0, Math.min(p.y1, box.y1) - Math.max(p.y0, box.y0));
        if (best === null || over < best.over - 1e-6) best = { x, y, over };
        if (over === 0) break;
      }
      const b = best!;
      placed.push({ x0: b.x - w / 2 - 2, x1: b.x + w / 2 + 2, y0: b.y - h / 2 - 2, y1: b.y + h / 2 + 2 });
      out.push({ key: f.key, i, x: b.x, y: b.y, w, h, lines, icon });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regional, turnedFields, world, cam, width, height]);

  /* Von hinten nach vorn: Tore und Felder zusammen (die Themen einer Themen-Ebene). */
  const order = [
    ...(regional ? [] : world.cols.map((c) => ({ kind: 'field' as const, y: c.c.y, c }))),
    ...turnedGates.map((g, j) => ({ kind: 'gate' as const, y: g.y, j }))
  ].sort((a, b) => b.y - a.y);

  /* Namen im Nahen: AUF der eigenen Fläche (so deckt kein Name ein anderes Feld; eine Säule davor deckt ihn wie die Fläche). */
  const nameOf = (f: MapField): string | null => {
    if (!showNames) return null;
    const fit = Math.max(4, Math.floor((topWidth * 0.86) / 6.3));
    const plain = f.label.replace(/^(Wokół: |Rund um |Around )/, '');
    return plain.length > fit ? `${plain.slice(0, fit - 1)}…` : plain;
  };

  const hoveredField = hover === null ? undefined : fields.find((f) => f.key === hover) ?? (() => { const c = colByKey.get(hover); return c === undefined ? undefined : turnedFields[c.c.owner]; })();
  const hint = (f: MapField) => (f.kind === 'region' ? T.hintZoom : f.key === chosen ? (f.startable === true ? T.hintStart : '') : T.hintSelect);
  useLayoutEffect(() => {
    const el = tip.current;
    if (el === null) return;
    el.style.left = `${Math.round(tipAt.current[0])}px`;
    el.style.top = `${Math.round(tipAt.current[1] - 14)}px`;
  });

  /* Tastatur: Pfeile von Feld zu Feld (die Schilder der Gebiete, die Säulen der Themen), Eingabe wählt. */
  const hubOf = (key: string) => { const i = turnedFields.findIndex((f) => f.key === key); return i < 0 ? null : { x: sx(world.hubs[i].x), y: sy(world.hubs[i].top) }; };
  const keys = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); glide({ ...camRef.current, s: camRef.current.s * 1.4 }); return; }
    if (e.key === '-') { e.preventDefault(); if (camRef.current.s <= fitCam().s * 1.01 && canUp) onUp(); else glide({ ...camRef.current, s: camRef.current.s / 1.4 }); return; }
    if (e.key === 'Escape' || e.key === 'Backspace') { if (canUp) { e.preventDefault(); onUp(); } return; }
    const el = (e.target as Element).closest('[data-ls-key]');
    const key = el?.getAttribute('data-ls-key') ?? null;
    if (key === null) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(key); return; }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    const at = hubOf(key);
    if (d === undefined || at === null) return;
    e.preventDefault();
    let best: string | null = null;
    let score = Number.POSITIVE_INFINITY;
    for (const f of turnedFields) {
      if (f.key === key) continue;
      const h = hubOf(f.key);
      if (h === null) continue;
      const dx = h.x - at.x;
      const dy = h.y - at.y;
      const along = dx * d[0] + dy * d[1];
      if (along <= 4) continue;
      const s = along + Math.abs(dx * d[1] - dy * d[0]) * 2;
      if (s < score) { score = s; best = f.key; }
    }
    if (best !== null) svg.current?.querySelector<SVGGElement>(`[data-ls-key="${CSS.escape(best)}"]`)?.focus();
  };

  /* Der Weg: Themen im Relief bei ihrer Säule, sonst das Feld. */
  const routePts = (route?.keys ?? []).map((k) => {
    const col = colByKey.get(k);
    if (col !== undefined) return { key: k, x: col.bx, y: col.ty - world.faceH * 0.55 };
    const i = turnedFields.findIndex((f) => f.key === k);
    return i < 0 ? null : { key: k, x: world.hubs[i].x, y: world.hubs[i].top - world.faceH * 0.55 };
  }).filter((p): p is { key: string; x: number; y: number } => p !== null);
  const homeCol = regional ? world.cols.find((c) => c.c.cell?.home === true) : undefined;
  const loopPath = (loops: readonly (readonly { x: number; y: number }[])[], lift: number) => loops.map((l) => `M${l.map((p) => P(p.x, -p.y * fore - lift)).join('L')}Z`).join('');

  return (
    <div className={`cg-rm${compact ? ' is-compact' : ''}${regional ? ' is-regional' : ''}`} data-rm-level={levelKey} data-rm-fore={fore.toFixed(2)} data-rm-step={step.toFixed(4)} data-rm-scale={cam.s.toFixed(2)}
      data-rm-cut={scale.cut.filter(Boolean).length} data-rm-world={[world.x0, world.x1, world.y0, world.y1].map((v) => v.toFixed(2)).join(',')} data-rm-cam={[cam.s, cam.cx, cam.cy].map((v) => v.toFixed(2)).join(',')}
      data-rm-auto={auto.current ? '1' : '0'} data-rm-signs={showSigns ? '1' : '0'} data-rm-names={showNames ? '1' : '0'} data-rm-rot={rot} data-rm-cells={regional ? world.cols.length : 0}>
      <svg ref={svg} className="cg-rm-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={T.mapLabel} tabIndex={-1}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keys}
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
        {/* Die Flächen der Gebiete: ein weicher Rand in ihrer Farbe; der helle Teil des Randes — so viel ist gelernt. */}
        {regional && turnedFields.map((f, i) => {
          const o = turnedOutlines[i];
          if (o.outline.length === 0) return null;
          const d = loopPath(o.outline, 0);
          return (
            <g key={`area:${f.key}`} className={`cg-rm-area is-s${subject(f.subject)}${f.conquered ? ' is-conquered' : ''}${f.glow ? ' is-glow' : ''}${hover === f.key ? ' is-hover' : ''}${restSet.has(f.key) ? ' is-route-rest' : ''}`} data-ls-in={f.key} data-ls-area={f.key}>
              <path className="cg-rm-area-fill" d={d} />
              <path className="cg-rm-area-edge" d={d} />
            </g>
          );
        })}
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
          const f = turnedFields[c.c.owner];
          const cut = scale.cut[c.i];
          const cls = `cg-rm-col is-${f.band} is-s${subject(f.subject)}${f.glow ? ' is-glow' : ''}`
            + `${far(f.steps) > 0 ? ` is-far${far(f.steps)}` : ''}`
            + `${f.key === chosen ? ' is-on' : ''}${f.key === hover ? ' is-hover' : ''}${routeIndex.has(f.key) ? ' is-route' : ''}${restSet.has(f.key) ? ' is-route-rest' : ''}${cut ? ' is-cut' : ''}`;
          const cx = sx(c.bx);
          const cy = sy(c.ty);
          const signShown = f.sign !== null && (showSigns || f.key === chosen || f.key === next);
          return (
            <g key={f.key} className={cls} data-ls-key={f.key} data-ls-field={f.key} data-ls-band={f.band} data-ls-kind={f.kind} data-ls-steps={f.steps} data-ls-drawn={scale.drawn[c.i]}
              data-ls-visible={scale.visible[c.i].toFixed(2)} data-ls-x={cx.toFixed(1)} data-ls-top={cy.toFixed(1)} data-ls-base={sy(c.by).toFixed(1)}
              tabIndex={0} role="button" aria-pressed={f.key === chosen} aria-label={f.title}>
              {sides(c.bx, c.ty, c.by).map((p, j) => <polygon key={j} className={`cg-rm-side is-${['l', 'f', 'r'][j]}`} points={p} />)}
              <polygon className="cg-rm-face" points={face(c.bx, c.ty)} />
              {cut && <polygon className="cg-rm-cutface" points={face(c.bx, c.ty)} fill={`url(#${pid}-cut)`} data-ls-cut="" />}
              {signShown && <SignIcon kind={f.sign!} r={Math.max(MIN_SIGN / 2, signR)} fore={fore} x={cx} y={cy} />}
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
        {regional && (
          <g className="cg-rm-relief" transform={`translate(${(width / 2 - cam.cx * cam.s).toFixed(2)},${(height / 2 - cam.cy * cam.s).toFixed(2)}) scale(${cam.s.toFixed(4)})`} data-ls-relief={world.cols.length}>
            {relief}
          </g>
        )}
        {/* Die Teilgebiete: ein feiner Umriss auf der Fläche (über dem Relief, ganz leise). */}
        {regional && cam.s * 2 * HEX_CORNER >= 14 && turnedFields.map((f, i) => (turnedOutlines[i].parts.length > 1 ? (
          <path key={`parts:${f.key}`} className="cg-rm-part" d={turnedOutlines[i].parts.map((loops) => loopPath(loops, plate)).join('')} aria-hidden />
        ) : null))}
        {/* Der Weg: EINE Linie in der Reihenfolge der Liste, Schritt 1 hervorgehoben. */}
        {routePts.length > 0 && (
          <g className="cg-rm-route" aria-hidden data-ls-route={routePts.length}>
            {routePts.length > 1 && <polyline className="cg-rm-routeline" points={routePts.map((c) => P(c.x, c.y)).join(' ')} />}
            {routePts.map((c, k) => {
              const first = k === 0 && routePts.length > 1;
              const goal = k === routePts.length - 1;
              const r = first ? 7 : regional ? 4.5 : 5.5;
              return (
                <g key={`${c.key}:${k}`} className={`cg-rm-step${first ? ' is-first' : ''}${goal ? ' is-goal' : ''}`} data-ls-route-step={k + 1}>
                  {/* Hinten auf der Fläche (das Zeichen in ihrer Mitte bleibt frei). */}
                  <circle cx={sx(c.x)} cy={sy(c.y)} r={r} />
                  {topWidth >= 40 && !goal && <text x={sx(c.x)} y={sy(c.y) + 3.5} textAnchor="middle">{k + 1}</text>}
                </g>
              );
            })}
          </g>
        )}
        {homeCol !== undefined && <MeIcon x={sx(homeCol.bx)} y={sy(homeCol.ty) + 2} h={Math.max(11, topWidth * 0.5)} />}
        {/* Die Zahl am Ziel: so viele Themen bis dorthin (die Legende sagt es). */}
        {turnedFields.map((f, i) => {
          if (f.badge == null || f.badge <= 0) return null;
          const hub = world.hubs[i];
          const x = sx(regional ? hub.x1 - HEX_CORNER : hub.x + HEX_CORNER * 0.5);
          const y = sy(regional ? hub.y0 : hub.top - world.faceH) - 18;
          const w = String(f.badge).length * 7 + 10;
          return (
            <g key={`badge:${f.key}`} className="cg-rm-badge" aria-hidden data-ls-badge={f.badge}>
              <rect x={x} y={y} width={w} height={16} rx={8} />
              <text x={x + w / 2} y={y + 12} textAnchor="middle">{f.badge}</text>
            </g>
          );
        })}
        {/* Die Schilder der Gebiete: ein Tippen zoomt hinein. */}
        {labels.map((l) => {
          const f = turnedFields[l.i];
          const x0 = l.x - l.w / 2;
          const y0 = l.y - l.h / 2;
          const textX = x0 + 7 + (l.icon ? 16 : 0);
          return (
            <g key={`label:${l.key}`} className={`cg-rm-label is-s${subject(f.subject)}${f.home ? ' is-home' : ''}${f.conquered ? ' is-conquered' : ''}${hover === f.key ? ' is-hover' : ''}`} data-ls-key={f.key} data-ls-field={f.key} data-ls-kind="region"
              data-ls-band={f.band} data-ls-steps={f.steps} data-ls-cells={f.cells?.length ?? 0} data-ls-share={f.share.toFixed(2)} data-ls-label={l.lines.join(' ')}
              data-ls-box={[x0, y0, l.w, l.h].map((v) => v.toFixed(1)).join(',')} tabIndex={0} role="button" aria-label={`${f.title} — ${T.hintZoom}`}>
              <rect className="cg-rm-label-box" x={x0} y={y0} width={l.w} height={l.h} rx={l.h / 2 > 10 ? 8 : l.h / 2} />
              {l.icon && (f.sign !== null ? <SignIcon kind={f.sign} r={6.5} x={x0 + 13} y={l.y} /> : <FlagIcon x={x0 + 10} y={l.y + 6} h={12} />)}
              <text className="cg-rm-label-text" x={textX} y={y0 + 3 + LINE_H * 0.78}>
                {l.lines.map((line, k) => <tspan key={k} x={textX} dy={k === 0 ? 0 : LINE_H}>{line}</tspan>)}
              </text>
            </g>
          );
        })}
        {(() => {
          /* Die Namen der Tore: ohne einander zu decken (sonst nur beim Zeigen, als Hinweis). */
          if (topWidth < (regional ? 14 : 40)) return null;
          const placed: { x0: number; x1: number; y0: number; y1: number }[] = labels.map((l) => ({ x0: l.x - l.w / 2, x1: l.x + l.w / 2, y0: l.y - l.h / 2, y1: l.y + l.h / 2 }));
          return turnedGates.map((g) => {
            const text = g.label;
            const x = sx(g.x);
            const y = sy(-g.y * fore) - world.faceH * cam.s - 6;
            const w = textWidth(text, false) + 8;
            const box = { x0: x - w / 2, x1: x + w / 2, y0: y - 12, y1: y + 3 };
            if (placed.some((p) => p.x0 < box.x1 && box.x0 < p.x1 && p.y0 < box.y1 && box.y0 < p.y1)) return null;
            placed.push(box);
            return <text key={`gname:${g.key}`} className="cg-rm-gate-name" x={x} y={y} textAnchor="middle" aria-hidden>{text}</text>;
          });
        })()}
      </svg>
      {hoveredField !== undefined && (
        <div ref={tip} className="cg-rm-tip" role="tooltip" data-landscape-tip="">
          {hoveredField.title}{hint(hoveredField) === '' ? '' : <> · <strong>{hint(hoveredField)}</strong></>}
        </div>
      )}
      <div className="cg-rm-tools" role="group" aria-label={T.mapLabel}>
        <button type="button" className="cg-rm-tool" onClick={() => glide({ ...camRef.current, s: camRef.current.s * 1.5 })} aria-label={T.zoomIn} title={T.zoomIn} data-rm-zoom="in">+</button>
        <button type="button" className="cg-rm-tool" onClick={() => { if (camRef.current.s <= fitCam().s * 1.01 && canUp) onUp(); else glide({ ...camRef.current, s: camRef.current.s / 1.5 }); }} aria-label={T.zoomOut} title={T.zoomOut} data-rm-zoom="out">−</button>
        <button type="button" className="cg-rm-tool is-icon" onClick={() => setRot((r) => (r + 1) % 6)} aria-label={T.rotate} title={T.rotate} data-landscape-rotate={rot}>
          <svg viewBox="-8 -8 16 16" aria-hidden><path d="M5.2,-2.6 A6,6 0 1 0 6,1.4 M5.2,-2.6 L1.6,-3.2 M5.2,-2.6 L5.8,0.8" /></svg>
        </button>
      </div>
      {legend(fore, new Set(world.cols.filter((c) => { const x = sx(c.bx); const y = sy(c.ty); return x > -20 && x < width + 20 && y > -20 && y < height + 20; }).map((c) => turnedFields[c.c.owner].key)))}
    </div>
  );
}
