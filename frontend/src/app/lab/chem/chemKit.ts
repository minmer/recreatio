/**
 * 2026-10-18 — DAS GERÄT AUF DEM TISCH, GEZEICHNET (Chemia): Brenner mit
 * Dreifuss und Flamme, Stative und Klemmen, die Gasspritze, das Manometer,
 * Schläuche, der Strahl beim Giessen, Holzspan und Papier an der Öffnung,
 * Draht und Löffel in der Hand, die Druck-Sonde — und was alle Zeichnungen
 * teilen (Farben der Seite, der Zustand eines Bildes).
 */

import type { Camera } from '../labView';
import { SPECIES } from './chemData';
import type { Effects } from './chemFx';
import { SEAT, type Burner, type Lab, type Link } from './chemBench';
import { linkPath, path, pivotOf, syringeGeom, toWorld, vesselAt } from './chemGeom';
import { rgba, type Vessel } from './chemVessel';

export interface ChemPalette {
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly surface: string;
  readonly ground: string;
  readonly accent: string;
  readonly font: string;
  readonly dark: boolean;
}

export function readChemPalette(el: HTMLElement): ChemPalette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const surface = v('--wk-surface', '#ffffff');
  const [r, g, b] = rgba(surface.startsWith('#') || surface.startsWith('rgb') ? surface : '#ffffff');
  return {
    ink: v('--wk-ink', '#1a1815'), muted: v('--wk-muted', '#6b665e'), line: v('--wk-line', '#ddd8cf'), surface,
    ground: v('--wk-ground', '#f6f3ee'), accent: v('--wk-accent', '#2f6fae'), font: cs.fontFamily || 'system-ui, sans-serif',
    dark: (r + g + b) / 3 < 110
  };
}

export interface DrawState {
  readonly lab: Lab;
  readonly cam: Camera;
  readonly dpr: number;
  readonly pal: ChemPalette;
  readonly fx: Effects;
  readonly time: number;
  readonly pick: string | null;
  readonly target: string | null;
  readonly values: boolean;
  readonly linkFrom: string | null;
  /** Wo der Zeiger steht (cm) — für Draht und Löffel in der Hand. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
  readonly holding: 'spoon' | 'loop' | null;
  /** Eine Druck-Sonde in der Flüssigkeit (cm). */
  readonly probe: { readonly x: number; readonly y: number } | null;
}

/** Die Sonde in der Flüssigkeit: p = p(Gas) + ρ·g·h an dieser Stelle. */
export function drawProbe(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const pr = s.probe;
  if (pr === null) return;
  const v = vesselAt(s.lab, pr.x, pr.y, 0);
  const sx = s.cam.toScreenX(pr.x);
  const sy = s.cam.toScreenY(pr.y);
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx, sy - 22); ctx.stroke();
  let text = 'Dotknij cieczy w naczyniu.';
  if (v !== null && v.kind !== 'syringe') {
    const depth = v.y + v.level() - pr.y;
    const gasP = v.pressure(s.lab.room.p);
    text = depth > 0 && v.wet()
      ? `p = ${(gasP + 0.0981 * v.density() * depth).toFixed(2).replace('.', ',')} kPa  (h = ${depth.toFixed(1).replace('.', ',')} cm, ρ = ${v.density().toFixed(2).replace('.', ',')} g/cm³)`
      : `p = ${gasP.toFixed(2).replace('.', ',')} kPa (gaz)`;
  }
  ctx.font = `600 12px ${s.pal.font}`;
  const w = ctx.measureText(text).width + 12;
  const x = Math.min(s.cam.w - w - 4, Math.max(4, sx - w / 2));
  ctx.fillStyle = s.pal.dark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.92)';
  roundRect(ctx, x, sy - 46, w, 20, 4);
  ctx.fill();
  ctx.fillStyle = s.pal.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 6, sy - 36);
}

/* -- Brenner ---------------------------------------------------------------------------------------- */

export function drawBurner(ctx: CanvasRenderingContext2D, b: Burner, s: DrawState): void {
  const x = b.x;
  const sel = s.pick === b.id;
  /* Dreifuss mit Drahtnetz */
  ctx.strokeStyle = s.pal.dark ? '#8a8f96' : '#4a4f55';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(x - 5.6, 0); ctx.lineTo(x - 4.2, SEAT);
  ctx.moveTo(x + 5.6, 0); ctx.lineTo(x + 4.2, SEAT);
  ctx.moveTo(x + 0.8, 0.2); ctx.lineTo(x + 0.5, SEAT);
  ctx.stroke();
  ctx.fillStyle = s.pal.dark ? '#6c7178' : '#7a7f86';
  ctx.fillRect(x - 5, SEAT - 0.35, 10, 0.35);
  ctx.fillStyle = '#d9d4cb';
  ctx.fillRect(x - 2.4, SEAT - 0.3, 4.8, 0.28);
  /* Schlauch */
  ctx.strokeStyle = '#b8562e';
  ctx.lineWidth = 0.55;
  ctx.beginPath(); ctx.moveTo(x + 1, 2.3); ctx.quadraticCurveTo(x + 6, 1.8, x + 9, 0.3); ctx.stroke();
  /* Fuss, Rohr, Luftring */
  ctx.fillStyle = '#2f3237';
  ctx.beginPath(); ctx.moveTo(x - 3.2, 0); ctx.lineTo(x + 3.2, 0); ctx.lineTo(x + 2.4, 1.1); ctx.lineTo(x - 2.4, 1.1); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(x - 0.8, 0, x + 0.8, 0);
  g.addColorStop(0, '#6d7279'); g.addColorStop(0.45, '#d5d9de'); g.addColorStop(1, '#5a5f66');
  ctx.fillStyle = g;
  ctx.fillRect(x - 0.75, 1.1, 1.5, 9.9);
  ctx.fillStyle = b.air ? '#9aa3ab' : '#5f666e';
  ctx.fillRect(x - 0.95, 2.2, 1.9, 1.3);
  ctx.fillStyle = '#1d2024';
  ctx.fillRect(x - 0.35, 2.55, 0.7, b.air ? 0.6 : 0.15);
  if (sel) {
    ctx.strokeStyle = s.pal.accent;
    ctx.lineWidth = 0.2;
    ctx.strokeRect(x - 3.6, -0.2, 7.2, 11.6);
  }
}

export function drawFlame(ctx: CanvasRenderingContext2D, b: Burner, s: DrawState): void {
  if (!b.on) return;
  const x = b.x;
  const t = s.time;
  const fl = (k: number) => Math.sin(t * 13 + k) * 0.18 + Math.sin(t * 29 + k * 2) * 0.08;
  const covered = s.lab.vessels.some((v) => Math.abs(v.y - SEAT) < 0.5 && Math.abs(v.x - x) < 3);
  const h = b.air ? 5.6 : 7.6;
  const top = Math.min(11 + h, covered ? SEAT - 0.3 : 99);
  ctx.save();
  ctx.globalCompositeOperation = s.pal.dark ? 'lighter' : 'source-over';
  if (b.air) {
    const outer = b.tint ?? 'rgba(80,110,255,0.55)';
    const [r, g, bb] = rgba(outer);
    ctx.fillStyle = `rgba(${r},${g},${bb},${b.tint === null ? 0.5 : 0.8})`;
    ctx.beginPath();
    ctx.moveTo(x - 0.75, 11);
    ctx.quadraticCurveTo(x - 1.3 + fl(1), 11 + h * 0.5, x + fl(2) * 0.6, top);
    ctx.quadraticCurveTo(x + 1.3 + fl(3), 11 + h * 0.5, x + 0.75, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(150,215,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(x - 0.5, 11);
    ctx.quadraticCurveTo(x - 0.4, 11 + h * 0.3, x, 11 + h * 0.42);
    ctx.quadraticCurveTo(x + 0.4, 11 + h * 0.3, x + 0.5, 11);
    ctx.closePath();
    ctx.fill();
  } else {
    const grad = ctx.createLinearGradient(0, 11, 0, top);
    grad.addColorStop(0, 'rgba(90,110,255,0.6)');
    grad.addColorStop(0.15, b.tint ?? 'rgba(255,190,60,0.9)');
    grad.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 0.75, 11);
    ctx.quadraticCurveTo(x - 1.8 + fl(1) * 2, 11 + h * 0.55, x + fl(2) * 1.5, top);
    ctx.quadraticCurveTo(x + 1.8 + fl(3) * 2, 11 + h * 0.55, x + 0.75, 11);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(x, 11 + h * 0.4, 0, x, 11 + h * 0.4, 4);
  glow.addColorStop(0, b.tint === null ? 'rgba(120,150,255,0.25)' : `${b.tint}55`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 4, 11 + h * 0.4 - 4, 8, 8);
  ctx.restore();
}

/* -- Stative: Probierglasständer, Klemme, Bürette, Spritze ----------------------------------------- */

export function drawStand(ctx: CanvasRenderingContext2D, v: Vessel, lab: Lab, pal: ChemPalette): void {
  const wood = pal.dark ? '#6b5236' : '#a77b4f';
  const metal = pal.dark ? '#9aa0a8' : '#5d6168';
  if (v.kind === 'tube' && v.y < 0.5 && Math.abs(v.angle) < 0.05) {
    ctx.fillStyle = wood;
    ctx.fillRect(v.x - 1.6, 0, 3.2, 0.6);
    ctx.fillRect(v.x - 1.6, 4.2, 3.2, 0.5);
    ctx.fillRect(v.x - 1.6, 0, 0.3, 4.7);
    ctx.fillRect(v.x + 1.3, 0, 0.3, 4.7);
  }
  if ((v.kind === 'tube' && v.y > 0.5) || v.kind === 'burette') {
    const sx = v.x - 6;
    ctx.fillStyle = metal;
    ctx.fillRect(sx - 2.5, 0, 6, 0.6);
    ctx.fillRect(sx - 0.2, 0, 0.4, v.y + v.shape.H * 0.85);
    const cy = v.y + v.shape.H * (v.kind === 'burette' ? 0.6 : 0.75);
    ctx.fillRect(sx, cy - 0.2, 6 - v.shape.R, 0.4);
  }
  if (v.kind === 'syringe') {
    const g = syringeGeom(v);
    ctx.fillStyle = metal;
    ctx.fillRect(v.x - 0.2, 0, 0.4, g.y - g.R);
    ctx.fillRect(v.x - 3, 0, 6, 0.5);
  }
  void lab;
}

export function drawSyringe(ctx: CanvasRenderingContext2D, v: Vessel, s: DrawState): void {
  const g = syringeGeom(v);
  const filled = Math.min(1, v.syringeMl / v.size);
  ctx.fillStyle = s.pal.dark ? 'rgba(160,190,210,0.12)' : 'rgba(255,255,255,0.6)';
  ctx.fillRect(g.x0, g.y - g.R, g.L, 2 * g.R);
  ctx.fillStyle = 'rgba(200,220,235,0.35)';
  ctx.fillRect(g.x0, g.y - g.R, g.L * filled, 2 * g.R);
  ctx.strokeStyle = 'rgba(90,120,140,0.9)';
  ctx.lineWidth = 0.09;
  ctx.strokeRect(g.x0, g.y - g.R, g.L, 2 * g.R);
  ctx.fillStyle = '#5d6168';
  const px = g.x0 + g.L * filled;
  ctx.fillRect(px - 0.25, g.y - g.R + 0.08, 0.5, 2 * g.R - 0.16);
  /* Der Kolben wandert hinaus, die Stange mit ihm. */
  ctx.fillRect(px, g.y - 0.12, g.L * 0.6 + 1, 0.24);
  ctx.fillRect(px + g.L * 0.6 + 1, g.y - g.R, 0.3, 2 * g.R);
  ctx.beginPath(); ctx.moveTo(g.x0, g.y - 0.25); ctx.lineTo(g.x0 - 0.9, g.y - 0.12); ctx.lineTo(g.x0 - 0.9, g.y + 0.12); ctx.lineTo(g.x0, g.y + 0.25); ctx.closePath(); ctx.fill();
  if (s.cam.scale >= 9) {
    ctx.strokeStyle = 'rgba(40,60,80,0.5)';
    ctx.lineWidth = 0.05;
    for (let i = 1; i <= 10; i += 1) { const x = g.x0 + (g.L * i) / 10; ctx.beginPath(); ctx.moveTo(x, g.y + g.R); ctx.lineTo(x, g.y + g.R - (i % 5 === 0 ? 0.6 : 0.35)); ctx.stroke(); }
  }
  if (s.pick === v.id || s.target === v.id) { ctx.strokeStyle = s.pal.accent; ctx.lineWidth = 0.3; ctx.strokeRect(g.x0 - 0.3, g.y - g.R - 0.3, g.L + 0.6, 2 * g.R + 0.6); }
}

/* -- Manometer, Schläuche, Giessen, Werkzeuge -------------------------------------------------------- */

export function drawGauge(ctx: CanvasRenderingContext2D, v: Vessel, s: DrawState): void {
  const p0 = s.lab.room.p;
  const dp = v.pressure(p0) - p0;
  const dh = Math.max(-9, Math.min(9, dp / 0.0981));
  const x = v.x + v.shape.R + 4;
  const top = v.y + v.shape.H + 0.7;
  ctx.strokeStyle = 'rgba(90,120,140,0.9)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(v.x, top - 0.8); ctx.lineTo(v.x, top + 2); ctx.lineTo(x, top + 2); ctx.lineTo(x, 2); ctx.arc(x + 1.2, 2, 1.2, Math.PI, 0, true); ctx.lineTo(x + 2.4, 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,120,220,0.85)';
  ctx.lineWidth = 0.22;
  const base = 10;
  ctx.beginPath();
  ctx.moveTo(x, base - dh / 2); ctx.lineTo(x, 2); ctx.arc(x + 1.2, 2, 1.2, Math.PI, 0, true); ctx.lineTo(x + 2.4, base + dh / 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(x + 3.2, base + 4);
  ctx.scale(1 / s.cam.scale, -1 / s.cam.scale);
  ctx.font = `600 11px ${s.pal.font}`;
  ctx.fillStyle = s.pal.ink;
  ctx.fillText(`Δp ${dp >= 0 ? '+' : '−'}${Math.abs(dp).toFixed(1).replace('.', ',')} kPa`, 0, 0);
  ctx.restore();
}

export function drawLink(ctx: CanvasRenderingContext2D, k: Link, s: DrawState): void {
  const pts = linkPath(s.lab, k);
  if (pts === null) return;
  path(ctx, pts, false);
  ctx.strokeStyle = 'rgba(90,120,140,0.9)';
  ctx.lineWidth = 0.42;
  ctx.lineJoin = 'round';
  ctx.stroke();
  path(ctx, pts, false);
  ctx.strokeStyle = s.pal.dark ? 'rgba(40,55,65,1)' : 'rgba(235,244,250,1)';
  ctx.lineWidth = 0.24;
  ctx.stroke();
  if (k.gas > 1e-8 || k.back > 0) {
    ctx.setLineDash([0.25, 0.9]);
    ctx.lineDashOffset = -s.time * (k.back > 0 ? -8 : 8);
    path(ctx, pts, false);
    ctx.strokeStyle = k.back > 0 ? 'rgba(80,140,220,0.95)' : 'rgba(120,120,120,0.7)';
    ctx.lineWidth = 0.16;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function drawPour(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const p = s.lab.pouring;
  if (p === null) return;
  const a = s.lab.vessel(p.from);
  const b = s.lab.vessel(p.to);
  if (a === undefined || b === undefined || Math.abs(a.angle) < 0.6) return;
  const [lx, ly] = pivotOf(a);
  const [x0, y0] = toWorld(a, lx, ly);
  const tx = b.x + (x0 < b.x ? -0.3 : 0.3);
  const ty = b.y + Math.max(0.2, b.level());
  const look = a.look();
  const empty = a.liquidMl() < 0.02;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(x0 + (tx - x0) * 0.6, y0, tx, ty);
  ctx.strokeStyle = empty ? 'rgba(120,120,120,0.18)' : `rgba(${look.r | 0},${look.g | 0},${look.b | 0},${Math.max(0.45, look.a).toFixed(2)})`;
  ctx.lineWidth = empty ? 0.8 : 0.28;
  ctx.stroke();
}

export function drawProbes(ctx: CanvasRenderingContext2D, s: DrawState): void {
  for (const p of s.lab.probes) {
    const v = s.lab.vessel(p.vessel);
    if (v === undefined) continue;
    const top = v.y + v.shape.H;
    if (p.result === 'paper') {
      ctx.fillStyle = '#f7f3e6';
      ctx.fillRect(v.x - 0.25, top - 2.5, 0.5, 5);
      ctx.fillStyle = p.color ?? '#40a040';
      ctx.fillRect(v.x - 0.25, top - 2.5, 0.5, 1.8);
      continue;
    }
    const tipX = v.x + 0.2;
    const tipY = top - 0.6;
    ctx.strokeStyle = '#c8955a';
    ctx.lineWidth = 0.22;
    ctx.beginPath(); ctx.moveTo(v.x + 5, top + 7); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flame = p.result === 'relight' || p.result === 'bright' ? 1.6 : p.result === 'burn' ? 0.9 : 0;
    if (flame > 0) {
      const g = ctx.createRadialGradient(tipX, tipY + flame * 0.6, 0, tipX, tipY + flame * 0.6, flame);
      g.addColorStop(0, 'rgba(255,250,220,0.95)');
      g.addColorStop(0.4, 'rgba(255,170,50,0.8)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tipX, tipY + flame * 0.6, flame, 0, Math.PI * 2); ctx.fill();
    } else if (p.result === 'glow') {
      ctx.fillStyle = 'rgba(255,100,30,0.9)';
      ctx.beginPath(); ctx.arc(tipX, tipY, 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (p.result === 'out') {
      ctx.fillStyle = 'rgba(120,120,120,0.35)';
      ctx.beginPath(); ctx.arc(tipX, tipY + 1, 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawHeld(ctx: CanvasRenderingContext2D, s: DrawState): void {
  if (s.pointer === null || s.holding === null) return;
  const { x, y } = s.pointer;
  ctx.strokeStyle = s.holding === 'loop' ? '#b9bec5' : '#7d8289';
  ctx.lineWidth = 0.12;
  ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x, y); ctx.stroke();
  if (s.holding === 'loop') {
    ctx.beginPath(); ctx.arc(x - 0.2, y - 0.2, 0.3, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#7d8289';
    ctx.beginPath(); ctx.ellipse(x, y, 0.7, 0.25, 0, 0, Math.PI); ctx.fill();
    const l = s.lab.spoon;
    if (l !== null) {
      ctx.fillStyle = SPECIES[l.sp]?.color ?? '#ccc';
      ctx.beginPath(); ctx.arc(x, y + 0.2, 0.35, 0, Math.PI * 2); ctx.fill();
      if (l.burning) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y + 0.9, 0, x, y + 0.9, 1);
        g.addColorStop(0, 'rgba(255,255,230,0.9)');
        g.addColorStop(1, 'rgba(90,120,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y + 0.9, 1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
