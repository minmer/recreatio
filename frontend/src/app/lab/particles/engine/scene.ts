/**
 * PARTIKEL-LABOR — DIE SZENE: ein Anfangsaufbau, kein Abbild aller Partikeln.
 * Die Kiste, die Umgebung, die Seiten, der Samen und eine geordnete Liste von
 * Handgriffen (füllen, löschen, Festkörper, Zlewka, Heizplatte). Geladen wird
 * sie auf eine Kiste voll Umgebungsluft; Malen und Stellen hängen Handgriffe
 * an — gespeichert wird so, was gebaut wurde, in jeder Auflösung.
 *
 * JSON (`format: "recreatio/particles"`, Version 1) rechnet in Metern, °C, kPa
 * und Watt; hier wird es nach SI umgerechnet und geprüft.
 */

import type { Region } from './shapes';
import { spIndex } from './species';
import { G0, P_ATM, T0 } from './units';

/**
 * Qualitätsstufen, von fein nach grob. Das Labor ist für leistungsstarke
 * Rechner gebaut: „sehr hoch“ ist der Normalfall, „hoch“ geht auch, „mittel“
 * ist die Wahl für einen schwächeren Rechner.
 */
export type Quality = 'very-high' | 'high' | 'medium';
export const QUALITIES: readonly Quality[] = ['very-high', 'high', 'medium'];
/** Gitterweite je Qualitätsstufe (m). */
export const SPACING: Readonly<Record<Quality, number>> = { 'very-high': 0.002, high: 0.0025, medium: 0.003 };
export const isQuality = (v: unknown): v is Quality => typeof v === 'string' && (QUALITIES as readonly string[]).includes(v);
export type Side = 'wall' | 'open';
export type HeaterMode = 'power' | 'thermostat';

export type Op =
  | { readonly op: 'fill'; readonly region: Region; readonly composition: Readonly<Record<string, number>>; readonly phase: 'liquid' | 'gas'; readonly T: number }
  | { readonly op: 'erase'; readonly region: Region }
  | { readonly op: 'solid'; readonly region: Region; readonly material: string; readonly T: number }
  | { readonly op: 'beaker'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly wall: number; readonly material: string; readonly T: number }
  | {
      readonly op: 'hotplate'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly material: string; readonly T: number;
      readonly mode: HeaterMode; readonly power: number; readonly target: number; readonly on: boolean;
    };

export interface Scene {
  readonly seed: number;
  /** Innenmasse der Kiste und die Tiefe der Scheibe (m). */
  readonly box: { readonly w: number; readonly h: number; readonly depth: number };
  /** Umgebung (SI): Druck Pa, Temperatur K, Schwere m/s², Luft nach Masse. */
  readonly ambient: { readonly p: number; readonly T: number; readonly g: number; readonly air: Readonly<Record<string, number>> };
  readonly sides: { readonly left: Side; readonly right: Side; readonly bottom: Side; readonly top: Side };
  readonly quality: Quality;
  readonly ops: readonly Op[];
}

export const DEFAULT_AIR: Readonly<Record<string, number>> = { N2: 0.7676, O2: 0.2324 };

export const EMPTY_SCENE: Scene = {
  seed: 1,
  box: { w: 0.3, h: 0.2, depth: 0.01 },
  ambient: { p: P_ATM, T: T0 + 20, g: G0, air: DEFAULT_AIR },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' },
  quality: 'very-high',
  ops: []
};

/* -- Lesen (JSON → SI, geprüft) --------------------------------------------------------------------------- */

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback: number, lo = -Infinity, hi = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const pair = (v: unknown): readonly [number, number] | null => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? [v[0] as number, v[1] as number] : null);
const quad = (v: unknown): readonly [number, number, number, number] | null => (Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? [v[0], v[1], v[2], v[3]] as [number, number, number, number] : null);

export function readRegion(v: unknown): Region | null {
  if (!isObj(v)) return null;
  const rect = quad(v.rect);
  if (rect !== null) return { rect };
  if (Array.isArray(v.circle) && v.circle.length === 3 && v.circle.every((x) => typeof x === 'number' && Number.isFinite(x)) && (v.circle[2] as number) > 0) {
    return { circle: [v.circle[0] as number, v.circle[1] as number, v.circle[2] as number] };
  }
  const line = quad(v.line);
  if (line !== null) return { line, width: num(v.width, 0.005, 0.0005, 0.1) };
  if (Array.isArray(v.poly)) {
    const pts = v.poly.map(pair).filter((p): p is readonly [number, number] => p !== null);
    if (pts.length >= 3) return { poly: pts };
  }
  return null;
}

/** Zusammensetzung nach Masse — nur bekannte Stoffe, normiert. */
function readComposition(v: unknown): Record<string, number> | null {
  if (!isObj(v)) return null;
  const out: Record<string, number> = {};
  let sum = 0;
  for (const [id, x] of Object.entries(v)) {
    if (spIndex(id) < 0 || typeof x !== 'number' || !(x > 0)) continue;
    out[id] = x;
    sum += x;
  }
  if (sum <= 0) return null;
  for (const id of Object.keys(out)) out[id] /= sum;
  return out;
}

const celsiusIn = (v: unknown, fallback: number): number => T0 + num(v, fallback - T0, -50, 1200);

function readOp(v: unknown, warnings: string[], at: number): Op | null {
  if (!isObj(v)) { warnings.push(`ops[${at}]: nie obiekt`); return null; }
  const T = celsiusIn(v.T, T0 + 20);
  switch (v.op) {
    case 'fill': {
      const region = readRegion(v.region);
      const composition = readComposition(v.composition);
      if (region === null || composition === null) { warnings.push(`ops[${at}]: fill bez obszaru albo składu`); return null; }
      return { op: 'fill', region, composition, phase: v.phase === 'gas' ? 'gas' : 'liquid', T };
    }
    case 'erase': {
      const region = readRegion(v.region);
      if (region === null) { warnings.push(`ops[${at}]: erase bez obszaru`); return null; }
      return { op: 'erase', region };
    }
    case 'solid': {
      const region = readRegion(v.region);
      const material = typeof v.material === 'string' && spIndex(v.material) >= 0 ? v.material : null;
      if (region === null || material === null) { warnings.push(`ops[${at}]: solid bez obszaru albo materiału`); return null; }
      return { op: 'solid', region, material, T };
    }
    case 'beaker':
      return {
        op: 'beaker', x: num(v.x, 0.15), y: num(v.y, 0), w: num(v.w, 0.07, 0.01, 1), h: num(v.h, 0.09, 0.01, 1), wall: num(v.wall, 0.0025, 0.001, 0.02),
        material: typeof v.material === 'string' && spIndex(v.material) >= 0 ? v.material : 'glass', T
      };
    case 'hotplate':
      return {
        op: 'hotplate', x: num(v.x, 0.15), y: num(v.y, 0), w: num(v.w, 0.16, 0.01, 1), h: num(v.h, 0.012, 0.004, 0.1),
        material: typeof v.material === 'string' && spIndex(v.material) >= 0 ? v.material : 'steel', T,
        mode: v.mode === 'thermostat' ? 'thermostat' : 'power', power: num(v.power, 50, 0, 2000), target: celsiusIn(v.target, T0 + 150), on: v.on !== false
      };
    default:
      warnings.push(`ops[${at}]: nieznana operacja „${String(v.op)}”`);
      return null;
  }
}

/** Eine Szene aus JSON — Unbekanntes wird übergangen (mit Warnung), Fehlendes ergänzt. */
export function readScene(raw: unknown): { scene: Scene; warnings: string[] } {
  const warnings: string[] = [];
  if (!isObj(raw)) return { scene: EMPTY_SCENE, warnings: raw === null || raw === undefined ? [] : ['scena: nie obiekt'] };
  const box = isObj(raw.box) ? raw.box : {};
  const amb = isObj(raw.ambient) ? raw.ambient : {};
  const sides = isObj(raw.sides) ? raw.sides : {};
  const side = (v: unknown, d: Side): Side => (v === 'open' ? 'open' : v === 'wall' ? 'wall' : d);
  const quality: Quality = isQuality(raw.quality) ? raw.quality : EMPTY_SCENE.quality;
  if (raw.quality !== undefined && !isQuality(raw.quality)) warnings.push(`quality: nieznana jakość „${String(raw.quality)}” — przyjęto „${quality}”`);
  const ops: Op[] = [];
  if (Array.isArray(raw.ops)) raw.ops.forEach((o, k) => { const op = readOp(o, warnings, k); if (op !== null) ops.push(op); });
  const scene: Scene = {
    seed: Math.trunc(num(raw.seed, 1, 0, 2 ** 31)),
    box: { w: num(box.w, 0.3, 0.05, 1), h: num(box.h, 0.2, 0.05, 1), depth: num(box.depth, 0.01, 0.001, 0.05) },
    ambient: {
      p: 1000 * num(amb.p, P_ATM / 1000, 1, 2000),
      T: celsiusIn(amb.T, T0 + 20),
      g: num(amb.g, G0, 0, 50),
      air: readComposition(amb.air) ?? DEFAULT_AIR
    },
    sides: { left: side(sides.left, 'wall'), right: side(sides.right, 'wall'), bottom: side(sides.bottom, 'wall'), top: side(sides.top, 'open') },
    quality,
    ops
  };
  return { scene, warnings };
}

/* -- Schreiben (SI → JSON) ------------------------------------------------------------------------------------ */

const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;
const c1 = (k: number): number => Math.round((k - T0) * 10) / 10;

function writeRegion(r: Region): Record<string, unknown> {
  if ('rect' in r) return { rect: r.rect.map(r6) };
  if ('circle' in r) return { circle: r.circle.map(r6) };
  if ('line' in r) return { line: r.line.map(r6), width: r6(r.width) };
  return { poly: r.poly.map(([x, y]) => [r6(x), r6(y)]) };
}

function writeOp(o: Op): Record<string, unknown> {
  switch (o.op) {
    case 'fill': return { op: 'fill', region: writeRegion(o.region), composition: o.composition, phase: o.phase, T: c1(o.T) };
    case 'erase': return { op: 'erase', region: writeRegion(o.region) };
    case 'solid': return { op: 'solid', region: writeRegion(o.region), material: o.material, T: c1(o.T) };
    case 'beaker': return { op: 'beaker', x: r6(o.x), y: r6(o.y), w: r6(o.w), h: r6(o.h), wall: r6(o.wall), material: o.material, T: c1(o.T) };
    case 'hotplate': return { op: 'hotplate', x: r6(o.x), y: r6(o.y), w: r6(o.w), h: r6(o.h), material: o.material, T: c1(o.T), mode: o.mode, power: o.power, target: c1(o.target), on: o.on };
  }
}

export function writeScene(s: Scene): Record<string, unknown> {
  return {
    format: 'recreatio/particles',
    version: 1,
    seed: s.seed,
    box: { w: s.box.w, h: s.box.h, depth: s.box.depth },
    ambient: { p: Math.round(s.ambient.p) / 1000, T: c1(s.ambient.T), g: s.ambient.g, air: s.ambient.air },
    sides: s.sides,
    quality: s.quality,
    ops: s.ops.map(writeOp)
  };
}
