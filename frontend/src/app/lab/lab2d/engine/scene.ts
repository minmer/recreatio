/**
 * LABOR 2D (v2) — DIE SZENE als JSON (`format: "recreatio/lab2d"`, Version 1):
 * ein Anfangsaufbau, kein Ablauf — die Kiste, die Umgebung, die Seiten, die
 * Auflösung, der Samen und die Handgriffe der Reihe nach. Im JSON stehen
 * Meter, °C, kPa und W; die Engine bekommt SI (K, Pa).
 *
 * Nichts hier ist eine Voreinstellung für einen Stoff oder ein Gerät: eine
 * Zlewka ist eine Form aus Glaszellen, eine Heizplatte eine Form aus
 * Stahlzellen mit innerer Wärmequelle (ARCHITECTURE.md §10).
 */

import { readRegion, writeRegion, type Region } from './shapes';
import { solidIndex } from './materials';
import { G0, P_ATM, T0 } from './units';

export const SCENE_FORMAT = 'recreatio/lab2d';

export type Side = 'wall' | 'open';
export type SideName = 'left' | 'right' | 'bottom' | 'top';
export type Quality = 'very-high' | 'high' | 'medium';
export type HeaterMode = 'power' | 'thermostat';

/** Die Stufen von fein nach grob. */
export const QUALITIES: readonly Quality[] = ['very-high', 'high', 'medium'];
/** Kantenlänge einer Zelle je Stufe (m) — Prompt v2: 2 mm auf der CPU, 1 mm mit WebGPU, 3 mm für schwache Rechner. */
export const CELL: Readonly<Record<Quality, number>> = { 'very-high': 0.001, high: 0.002, medium: 0.003 };
export const isQuality = (v: unknown): v is Quality => v === 'very-high' || v === 'high' || v === 'medium';

/** Höchstens so viele Zellen (sonst wird die Stufe gröber, mit Warnung). */
export const MAX_CELLS = 160_000;

export type Op =
  | { readonly op: 'fill'; readonly region: Region; readonly phase: 'liquid' | 'gas'; readonly T: number; readonly composition: Readonly<Record<string, number>> }
  | { readonly op: 'erase'; readonly region: Region }
  | { readonly op: 'solid'; readonly region: Region; readonly material: string; readonly T: number }
  | { readonly op: 'beaker'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly wall: number; readonly material: string; readonly T: number; readonly lid: boolean }
  | { readonly op: 'hotplate'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly material: string; readonly T: number; readonly mode: HeaterMode; readonly power: number; readonly target: number; readonly on: boolean };

export interface Ambient {
  /** Druck (Pa) auf Höhe des Kistenbodens. */
  readonly p: number;
  /** Temperatur (K). */
  readonly T: number;
  /** Relative Feuchte (0–1). */
  readonly rh: number;
  /** Fallbeschleunigung (Betrag, m/s²; zeigt nach unten). */
  readonly g: number;
  /** Trockene Luft als Massenanteile. */
  readonly air: { readonly N2: number; readonly O2: number };
}

export interface Scene {
  readonly seed: number;
  readonly box: { readonly w: number; readonly h: number; readonly depth: number };
  readonly ambient: Ambient;
  readonly sides: Readonly<Record<SideName, Side>>;
  readonly quality: Quality;
  readonly ops: readonly Op[];
}

export interface ReadOptions {
  /** Prüfstand: Schwerkraft auch unter 0,25 g (Test 7, 13). In der Oberfläche nie. */
  readonly harness?: boolean;
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const obj = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const side = (v: unknown, fallback: Side): Side => (v === 'wall' || v === 'open' ? v : fallback);

/** Schwerkraft: Prompt v2 — von 0,25 g bis 2 g (ohne Oberflächenspannung auf der aufgelösten Oberfläche keine Schwerelosigkeit). */
export const G_MIN = 0.25 * G0;
export const G_MAX = 2 * G0;

function readComposition(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  let sum = 0;
  for (const [k, v] of Object.entries(obj(raw))) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) { out[k] = v; sum += v; }
  }
  if (sum <= 0) return { H2O: 1 };
  for (const k of Object.keys(out)) out[k] /= sum;
  return out;
}

function readOp(raw: unknown, warnings: string[], at: number): Op | null {
  const r = obj(raw);
  const T = T0 + num(r.T, 20);
  const material = (fallback: string): string => {
    const m = typeof r.material === 'string' ? r.material : fallback;
    if (solidIndex(m) >= 0) return m;
    warnings.push(`ops[${at}]: unknown material "${String(r.material)}", using ${fallback}`);
    return fallback;
  };
  switch (r.op) {
    case 'fill': {
      const region = readRegion(r.region);
      if (region === null) break;
      return { op: 'fill', region, phase: r.phase === 'gas' ? 'gas' : 'liquid', T, composition: readComposition(r.composition) };
    }
    case 'erase': {
      const region = readRegion(r.region);
      if (region === null) break;
      return { op: 'erase', region };
    }
    case 'solid': {
      const region = readRegion(r.region);
      if (region === null) break;
      return { op: 'solid', region, material: material('glass'), T };
    }
    case 'beaker':
      return {
        op: 'beaker', x: num(r.x, 0.1), y: num(r.y, 0), w: clamp(num(r.w, 0.07), 0.01, 1), h: clamp(num(r.h, 0.09), 0.01, 1),
        wall: clamp(num(r.wall, 0.002), 0.0005, 0.02), material: material('glass'), T, lid: r.lid === true
      };
    case 'hotplate':
      return {
        op: 'hotplate', x: num(r.x, 0.1), y: num(r.y, 0), w: clamp(num(r.w, 0.12), 0.005, 1), h: clamp(num(r.h, 0.008), 0.002, 0.1),
        material: material('steel'), T, mode: r.mode === 'thermostat' ? 'thermostat' : 'power',
        power: clamp(num(r.power, 40), 0, 2000), target: T0 + clamp(num(r.target, 150), 0, 600), on: r.on !== false
      };
    default:
      break;
  }
  warnings.push(`ops[${at}]: not understood (${String(r.op)})`);
  return null;
}

/** Eine Szene aus JSON lesen; Unbekanntes fällt weg (mit Warnung), Fehlendes bekommt den üblichen Wert. */
export function readScene(raw: unknown, options: ReadOptions = {}): { scene: Scene; warnings: string[] } {
  const r = obj(raw);
  const warnings: string[] = [];
  if (r.format !== undefined && r.format !== SCENE_FORMAT) warnings.push(`format "${String(r.format)}" is not ${SCENE_FORMAT}`);
  const box = obj(r.box);
  const amb = obj(r.ambient);
  const air = obj(amb.air);
  const sides = obj(r.sides);
  const gRaw = num(amb.g, G0);
  const g = options.harness === true ? clamp(gRaw, 0, G_MAX) : clamp(gRaw, G_MIN, G_MAX);
  if (g !== gRaw) warnings.push(`ambient.g ${gRaw} m/s² is outside ${G_MIN.toFixed(2)}–${G_MAX.toFixed(2)}, using ${g.toFixed(2)}`);
  const n2 = num(air.N2, 0.7676);
  const o2 = num(air.O2, 0.2324);
  const airSum = n2 + o2 > 0 ? n2 + o2 : 1;
  const ops: Op[] = [];
  if (Array.isArray(r.ops)) r.ops.forEach((o, k) => { const op = readOp(o, warnings, k); if (op !== null) ops.push(op); });
  return {
    scene: {
      seed: Math.floor(num(r.seed, 1)) >>> 0,
      box: { w: clamp(num(box.w, 0.2), 0.02, 0.6), h: clamp(num(box.h, 0.15), 0.02, 0.4), depth: clamp(num(box.depth, 0.01), 0.002, 0.05) },
      ambient: {
        p: clamp(num(amb.p, P_ATM / 1000), 20, 400) * 1000,
        T: T0 + clamp(num(amb.T, 20), -20, 100),
        rh: clamp(num(amb.rh, 0.5), 0, 1),
        g,
        air: { N2: Math.max(0, n2) / airSum, O2: Math.max(0, o2) / airSum }
      },
      sides: {
        left: side(sides.left, 'wall'),
        right: side(sides.right, 'wall'),
        bottom: side(sides.bottom, 'wall'),
        top: side(sides.top, 'open')
      },
      quality: isQuality(r.quality) ? r.quality : 'high',
      ops
    },
    warnings
  };
}

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));

export function writeOp(op: Op): Record<string, unknown> {
  switch (op.op) {
    case 'fill':
      return { op: 'fill', region: writeRegion(op.region), composition: { ...op.composition }, phase: op.phase, T: round(op.T - T0, 3) };
    case 'erase':
      return { op: 'erase', region: writeRegion(op.region) };
    case 'solid':
      return { op: 'solid', region: writeRegion(op.region), material: op.material, T: round(op.T - T0, 3) };
    case 'beaker':
      return { op: 'beaker', x: op.x, y: op.y, w: op.w, h: op.h, wall: op.wall, material: op.material, T: round(op.T - T0, 3), ...(op.lid ? { lid: true } : {}) };
    case 'hotplate':
      return { op: 'hotplate', x: op.x, y: op.y, w: op.w, h: op.h, material: op.material, mode: op.mode, power: op.power, target: round(op.target - T0, 3), on: op.on, T: round(op.T - T0, 3) };
  }
}

/** Eine Szene als JSON (°C, kPa) — so, wie readScene sie wieder liest. */
export function writeScene(scene: Scene): Record<string, unknown> {
  return {
    format: SCENE_FORMAT,
    version: 1,
    seed: scene.seed,
    box: { ...scene.box },
    ambient: { p: round(scene.ambient.p / 1000, 4), T: round(scene.ambient.T - T0, 3), rh: scene.ambient.rh, g: round(scene.ambient.g, 4), air: { ...scene.ambient.air } },
    sides: { ...scene.sides },
    quality: scene.quality,
    ops: scene.ops.map(writeOp)
  };
}
