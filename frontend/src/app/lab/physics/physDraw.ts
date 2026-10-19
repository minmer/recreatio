/**
 * 2026-10-18 — WIE DIE FIZYKA 2D AUSSIEHT: Boden, Becken mit Flüssigkeit
 * (der Druck als Farbe der Tiefe, Wellen auf dem Spiegel, Strahlen aus den
 * Löchern), Körper nach ihrem Stoff (Maserung, Glanz, Körner), Verbindungen
 * (Seil, Stange, Feder als Zickzack, Gelenk, Rolle), Pfeile der Kräfte und
 * Geschwindigkeiten, Spuren, das Ziel — und die Werte an den Dingen.
 *
 * Gezeichnet wird in Welt-Koordinaten (die Kamera setzt die Transformation);
 * Linien und Schrift haben eine feste Breite in Bildpunkten.
 */

import { kPa } from '../fluid';
import type { Camera } from '../labView';
import type { Body } from './physBody';
import type { Joint, PulleyJoint, RodJoint } from './physJoints';
import type { Basin } from './physFluid';
import type { VectorKind } from './physScene';
import type { World } from './physWorld';

export interface Palette {
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly accent: string;
  readonly ground: string;
  readonly surface: string;
  readonly ok: string;
  readonly danger: string;
  readonly info: string;
  readonly font: string;
}

/** Die Farben des Themas (hell, dunkel) aus den Variablen der Seite. */
export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--wk-ink', '#1a1815'),
    muted: v('--wk-muted', '#5b554c'),
    line: v('--wk-line', '#dcd7cd'),
    accent: v('--wk-accent', '#7a5a2e'),
    ground: v('--wk-ground', '#f7f5f1'),
    surface: v('--wk-surface', '#ffffff'),
    ok: v('--wk-ok', '#2f8a4c'),
    danger: v('--wk-danger', '#c0392b'),
    info: v('--wk-info', '#2f6fae'),
    font: css.fontFamily || 'system-ui, sans-serif'
  };
}

/** Eine Spur: die letzten Lagen eines Körpers. */
export class Trail {
  readonly xs = new Float32Array(600);
  readonly ys = new Float32Array(600);
  n = 0;
  private last = -1;

  add(t: number, x: number, y: number): void {
    if (t - this.last < 1 / 30 && this.last >= 0) return;
    this.last = t;
    if (this.n === this.xs.length) { this.xs.copyWithin(0, 1); this.ys.copyWithin(0, 1); this.n -= 1; }
    this.xs[this.n] = x;
    this.ys[this.n] = y;
    this.n += 1;
  }

  clear(): void { this.n = 0; this.last = -1; }
}

export interface DrawState {
  readonly world: World;
  readonly cam: Camera;
  readonly dpr: number;
  readonly pal: Palette;
  readonly vectors: readonly VectorKind[];
  readonly grid: boolean;
  readonly pressure: boolean;
  readonly values: boolean;
  readonly selected: Body | null;
  readonly trails: ReadonlyMap<Body, Trail>;
  readonly preview: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly kind: string } | null;
  readonly probe: { readonly x: number; readonly y: number } | null;
  readonly ruler: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number } | null;
  readonly goal: readonly [number, number, number, number] | null;
  readonly goalHit: boolean;
}

const tau = Math.PI * 2;

export function drawWorld(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const { cam, dpr, pal, world } = s;
  const px = 1 / cam.scale;
  cam.screen(ctx, dpr);
  ctx.clearRect(0, 0, cam.w, cam.h);
  cam.apply(ctx, dpr);
  if (s.grid) drawGrid(ctx, s);
  const fixed = world.bodies.filter((b) => b.fixed);
  const moving = world.bodies.filter((b) => !b.fixed);
  for (const b of fixed) if (!world.basins.some((x) => x.walls.includes(b))) drawBody(ctx, b, s, px);
  for (const b of moving) drawBody(ctx, b, s, px);
  /* Die Flüssigkeit NACH den Körpern, durchscheinend: was eintaucht, sieht man unter Wasser. */
  for (const basin of world.basins) drawLiquid(ctx, basin, s, px);
  for (const basin of world.basins) drawGlass(ctx, basin, s, px);
  for (const p of world.pipes) drawPipe(ctx, p.a, p.b, p.y, p.size, p.open, s, px);
  for (const j of world.joints) drawJoint(ctx, j, s, px);
  drawDrops(ctx, s, px);
  for (const [b, trail] of s.trails) drawTrail(ctx, trail, s.selected === b ? pal.accent : pal.muted, px);
  if (s.goal !== null) drawGoal(ctx, s.goal, s.goalHit, pal, px);
  if (world.mouse !== null) {
    const m = world.mouse;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([4 * px, 3 * px]);
    ctx.beginPath(); ctx.moveTo(m.pax, m.pay); ctx.lineTo(m.tx, m.ty); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (s.preview !== null) {
    const p = s.preview;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([6 * px, 4 * px]);
    ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
    ctx.setLineDash([]);
  }
  /* Was in Bildpunkten steht: Pfeile, Schrift, Messwerkzeuge. */
  cam.screen(ctx, dpr);
  ctx.font = `600 11px ${pal.font}`;
  for (const b of moving) drawVectors(ctx, b, s);
  if (s.values) for (const b of moving) drawLabel(ctx, b, s);
  for (const basin of world.basins) drawHoles(ctx, basin, s);
  for (const j of world.joints) if (j.kind === 'spring' || j.kind === 'rope' || j.kind === 'rod') drawTension(ctx, j, s);
  if (s.ruler !== null) drawRuler(ctx, s.ruler, s);
  if (s.probe !== null) drawProbe(ctx, s.probe, s);
}

function drawGrid(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const { cam, pal } = s;
  const px = 1 / cam.scale;
  const x0 = cam.toWorldX(0); const x1 = cam.toWorldX(cam.w);
  const y0 = cam.toWorldY(cam.h); const y1 = cam.toWorldY(0);
  const step = cam.scale > 120 ? 0.1 : cam.scale > 25 ? 1 : 5;
  ctx.strokeStyle = pal.line;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = px;
  ctx.beginPath();
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* -- Körper ------------------------------------------------------------------------------------ */

function path(ctx: CanvasRenderingContext2D, b: Body): void {
  ctx.beginPath();
  if (b.shape.kind === 'circle') { ctx.arc(b.x, b.y, b.shape.r, 0, tau); return; }
  for (let i = 0; i < b.shape.n; i += 1) {
    if (i === 0) ctx.moveTo(b.wx[i], b.wy[i]); else ctx.lineTo(b.wx[i], b.wy[i]);
  }
  ctx.closePath();
}

function drawBody(ctx: CanvasRenderingContext2D, b: Body, s: DrawState, px: number): void {
  const m = b.material;
  const color = b.color ?? m.color;
  if (b.id === '~ziemia') {
    ctx.fillStyle = s.pal.line;
    path(ctx, b);
    ctx.fill();
    ctx.strokeStyle = s.pal.muted;
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath(); ctx.moveTo(b.minX, b.maxY); ctx.lineTo(b.maxX, b.maxY); ctx.stroke();
    return;
  }
  path(ctx, b);
  if (m.look === 'metal') {
    const g = ctx.createLinearGradient(b.minX, b.maxY, b.maxX, b.minY);
    g.addColorStop(0, '#f2f4f6'); g.addColorStop(0.45, color); g.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = g;
  } else if (m.look === 'ice' || m.look === 'glass') {
    ctx.fillStyle = withAlpha(color, 0.55);
  } else {
    ctx.fillStyle = color;
  }
  ctx.fill();
  /* Was den Stoff erkennbar macht. */
  ctx.save();
  path(ctx, b);
  ctx.clip();
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  if (m.look === 'wood') {
    ctx.strokeStyle = shade(color, -0.25);
    ctx.lineWidth = 1 * px;
    const c = Math.cos(b.a); const sn = Math.sin(b.a);
    for (let k = -4; k <= 4; k += 1) {
      const off = (k / 4.5) * span * 0.5;
      ctx.beginPath();
      for (let t = -1; t <= 1.001; t += 0.25) {
        const lx = t * span;
        const ly = off + Math.sin(t * 3 + k) * span * 0.03;
        const x = b.x + c * lx - sn * ly;
        const y = b.y + sn * lx + c * ly;
        if (t === -1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (m.look === 'stone' || m.look === 'cork') {
    ctx.fillStyle = shade(color, m.look === 'cork' ? -0.3 : 0.25);
    const dots = 14;
    for (let k = 0; k < dots; k += 1) {
      const lx = (pseudo(k * 3.1 + b.id.length) - 0.5) * span;
      const ly = (pseudo(k * 7.3 + 1) - 0.5) * span;
      const [x, y] = b.toWorld(lx, ly);
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.2 * px, span * 0.025), 0, tau); ctx.fill();
    }
  } else if (m.look === 'ice' || m.look === 'glass' || m.look === 'plastic' || m.look === 'rubber') {
    const [hx, hy] = b.toWorld(-span * 0.18, span * 0.18);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(hx, hy, span * 0.16, 0, tau); ctx.fill();
  }
  ctx.restore();
  path(ctx, b);
  ctx.strokeStyle = s.selected === b ? s.pal.accent : shade(color, -0.45);
  ctx.lineWidth = (s.selected === b ? 3 : 1.2) * px;
  ctx.stroke();
  /* Ein Kreis zeigt, wie er sich dreht. */
  if (b.shape.kind === 'circle') {
    ctx.strokeStyle = shade(color, -0.5);
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.a) * b.shape.r, b.y + Math.sin(b.a) * b.shape.r); ctx.stroke();
  }
}

/* -- Flüssigkeiten ------------------------------------------------------------------------------- */

function drawLiquid(ctx: CanvasRenderingContext2D, basin: Basin, s: DrawState, px: number): void {
  let below = basin.y0;
  const n = basin.waves.length;
  const dx = basin.width / Math.max(1, n - 1);
  basin.layers.forEach((l, k) => {
    const top = l.top;
    const last = k === basin.layers.length - 1;
    ctx.beginPath();
    ctx.moveTo(basin.x0, below);
    ctx.lineTo(basin.x1, below);
    if (last) {
      for (let i = n - 1; i >= 0; i -= 1) ctx.lineTo(basin.x0 + i * dx, top + basin.waves[i]);
    } else {
      ctx.lineTo(basin.x1, top);
      ctx.lineTo(basin.x0, top);
    }
    ctx.closePath();
    if (s.pressure) {
      /* Der Druck als Tiefe der Farbe: unten dunkler. */
      const g = ctx.createLinearGradient(0, top, 0, basin.y0);
      g.addColorStop(0, l.liquid.color);
      g.addColorStop(1, shade(rgbaToHex(l.liquid.color), -0.45));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = l.liquid.color;
    }
    ctx.fill();
    if (last) {
      ctx.strokeStyle = withAlpha(rgbaToHex(l.liquid.color), 0.95);
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) { const x = basin.x0 + i * dx; const y = top + basin.waves[i]; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    below = top;
  });
}

function drawGlass(ctx: CanvasRenderingContext2D, basin: Basin, s: DrawState, px: number): void {
  ctx.fillStyle = 'rgba(190, 225, 235, 0.45)';
  ctx.strokeStyle = s.pal.muted;
  ctx.lineWidth = 1.2 * px;
  for (const w of basin.walls) { path(ctx, w); ctx.fill(); ctx.stroke(); }
  /* Die Löcher: eine Lücke in der Wand (offen) oder ein Stopfen. */
  for (const hole of basin.holes) {
    const y = hole.side === 'bottom' ? basin.y0 - basin.wall / 2 : basin.y0 + hole.at;
    const x = hole.side === 'bottom' ? basin.x0 + hole.at : hole.side === 'left' ? basin.x0 - basin.wall / 2 : basin.x1 + basin.wall / 2;
    ctx.fillStyle = hole.open ? s.pal.surface : '#8a5a2b';
    const w = hole.side === 'bottom' ? hole.size : basin.wall * 1.3;
    const h = hole.side === 'bottom' ? basin.wall * 1.3 : hole.size;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
  }
}

function drawPipe(ctx: CanvasRenderingContext2D, a: Basin, b: Basin, y: number, size: number, open: boolean, s: DrawState, px: number): void {
  const [l, r] = a.x1 < b.x0 ? [a, b] : [b, a];
  const x0 = l.x1;
  const x1 = r.x0;
  ctx.fillStyle = 'rgba(190, 225, 235, 0.55)';
  ctx.strokeStyle = s.pal.muted;
  ctx.lineWidth = 1.2 * px;
  ctx.fillRect(x0, y - size / 2, x1 - x0, size);
  ctx.strokeRect(x0, y - size / 2, x1 - x0, size);
  const liquid = l.liquidAt(y) ?? r.liquidAt(y);
  if (liquid !== null && open) { ctx.fillStyle = liquid.color; ctx.fillRect(x0, y - size / 2, x1 - x0, size); }
  if (!open) {
    ctx.fillStyle = s.pal.danger;
    ctx.beginPath(); ctx.arc((x0 + x1) / 2, y, size * 0.9, 0, tau); ctx.fill();
  }
}

function drawDrops(ctx: CanvasRenderingContext2D, s: DrawState, px: number): void {
  const r = Math.max(1.6 * px, 0.012);
  for (const d of s.world.drops) {
    ctx.fillStyle = d.liquid.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, tau); ctx.fill();
  }
}

/* -- Verbindungen --------------------------------------------------------------------------------- */

function drawJoint(ctx: CanvasRenderingContext2D, j: Joint, s: DrawState, px: number): void {
  const { pal } = s;
  ctx.strokeStyle = pal.ink;
  if (j.kind === 'pin') {
    ctx.fillStyle = pal.surface;
    ctx.lineWidth = 2 * px;
    ctx.beginPath(); ctx.arc(j.pax, j.pay, 5 * px, 0, tau); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.beginPath(); ctx.arc(j.pax, j.pay, 1.8 * px, 0, tau); ctx.fill();
    if ((j as { torque?: number }).torque !== undefined && (j as unknown as { torque: number }).torque > 0) {
      ctx.strokeStyle = pal.accent;
      ctx.beginPath(); ctx.arc(j.pax, j.pay, 9 * px, 0.3, 4.5); ctx.stroke();
    }
    return;
  }
  if (j.kind === 'rod') {
    ctx.lineWidth = 3 * px;
    ctx.beginPath(); ctx.moveTo(j.pax, j.pay); ctx.lineTo(j.pbx, j.pby); ctx.stroke();
    anchor(ctx, j.pbx, j.pby, j.b === s.world.ground, pal, px);
    return;
  }
  if (j.kind === 'rope') {
    const rope = j as RodJoint;
    ctx.lineWidth = 1.8 * px;
    ctx.strokeStyle = '#8a6d3b';
    const span = rope.span();
    ctx.beginPath();
    ctx.moveTo(j.pax, j.pay);
    if (span < rope.length - 0.005) {
      /* Locker: es hängt durch (eine Parabel mit der fehlenden Länge). */
      const sag = Math.sqrt(Math.max(0, rope.length * rope.length - span * span)) * 0.5;
      ctx.quadraticCurveTo((j.pax + j.pbx) / 2, Math.min(j.pay, j.pby) - sag, j.pbx, j.pby);
    } else {
      ctx.lineTo(j.pbx, j.pby);
    }
    ctx.stroke();
    anchor(ctx, j.pbx, j.pby, j.b === s.world.ground, pal, px);
    return;
  }
  if (j.kind === 'spring') {
    const dx = j.pbx - j.pax;
    const dy = j.pby - j.pay;
    const len = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / len; const uy = dy / len;
    const nx = -uy; const ny = ux;
    const coils = 12;
    const amp = Math.min(0.08, Math.max(6 * px, len * 0.06));
    ctx.lineWidth = 1.8 * px;
    ctx.strokeStyle = pal.info;
    ctx.beginPath();
    ctx.moveTo(j.pax, j.pay);
    const lead = len * 0.08;
    ctx.lineTo(j.pax + ux * lead, j.pay + uy * lead);
    for (let i = 1; i < coils * 2; i += 1) {
      const t = lead + ((len - 2 * lead) * i) / (coils * 2);
      const side = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(j.pax + ux * t + nx * amp * side, j.pay + uy * t + ny * amp * side);
    }
    ctx.lineTo(j.pbx - ux * lead, j.pby - uy * lead);
    ctx.lineTo(j.pbx, j.pby);
    ctx.stroke();
    anchor(ctx, j.pbx, j.pby, j.b === s.world.ground, pal, px);
    return;
  }
  if (j.kind === 'pulley') {
    const p = j as PulleyJoint;
    ctx.lineWidth = 1.8 * px;
    ctx.strokeStyle = '#8a6d3b';
    ctx.beginPath();
    ctx.moveTo(p.pax, p.pay); ctx.lineTo(p.gax, p.gay);
    ctx.lineTo(p.gbx, p.gby); ctx.lineTo(p.pbx, p.pby);
    ctx.stroke();
    for (const [x, y] of [[p.gax, p.gay], [p.gbx, p.gby]] as const) {
      ctx.fillStyle = pal.surface;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2 * px;
      ctx.beginPath(); ctx.arc(x, y, 7 * px, 0, tau); ctx.fill(); ctx.stroke();
    }
  }
}

/** Wo eine Verbindung an der Welt hängt: ein kleiner Halter. */
function anchor(ctx: CanvasRenderingContext2D, x: number, y: number, world: boolean, pal: Palette, px: number): void {
  if (!world) return;
  ctx.fillStyle = pal.muted;
  ctx.fillRect(x - 8 * px, y, 16 * px, 3 * px);
  ctx.beginPath(); ctx.arc(x, y, 2.5 * px, 0, tau); ctx.fill();
}

function drawTrail(ctx: CanvasRenderingContext2D, t: Trail, color: string, px: number): void {
  if (t.n < 2) return;
  ctx.fillStyle = color;
  for (let i = 0; i < t.n; i += 2) {
    ctx.beginPath(); ctx.arc(t.xs[i], t.ys[i], 1.6 * px, 0, tau); ctx.fill();
  }
}

function drawGoal(ctx: CanvasRenderingContext2D, area: readonly [number, number, number, number], hit: boolean, pal: Palette, px: number): void {
  const [x0, y0, x1, y1] = area;
  ctx.fillStyle = withAlpha(hit ? pal.ok : pal.accent, 0.12);
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = hit ? pal.ok : pal.accent;
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);
}

/* -- In Bildpunkten: Pfeile, Werte, Werkzeuge ---------------------------------------------------- */

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string, label: string): void {
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ux = dx / len; const uy = dy / len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx - ux * 7, y + dy - uy * 7); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - ux * 10 - uy * 5, y + dy - uy * 10 + ux * 5);
  ctx.lineTo(x + dx - ux * 10 + uy * 5, y + dy - uy * 10 - ux * 5);
  ctx.closePath();
  ctx.fill();
  if (label !== '') ctx.fillText(label, x + dx + 4, y + dy - 4);
}

function drawVectors(ctx: CanvasRenderingContext2D, b: Body, s: DrawState): void {
  if (s.vectors.length === 0) return;
  const { cam, pal, world } = s;
  const x = cam.toScreenX(b.x);
  const y = cam.toScreenY(b.y);
  const weight = b.m * world.g;
  /* Kräfte: 40 px je Gewicht des Körpers (so sind Auftrieb und Gewicht vergleichbar). */
  const fs = 40 / Math.max(1e-6, weight);
  if (s.vectors.includes('v')) arrow(ctx, x, y, b.vx * 18, -b.vy * 18, pal.ok, 'v');
  if (s.vectors.includes('g')) arrow(ctx, x, y, 0, weight * fs, pal.danger, 'Q');
  if (s.vectors.includes('lift') && b.lift > 0) arrow(ctx, x + 6, y, 0, -b.lift * fs, pal.info, 'Fw');
  if (s.vectors.includes('net')) arrow(ctx, x - 6, y, b.fx * fs, -(b.fy - weight) * fs, pal.accent, 'F');
}

function drawLabel(ctx: CanvasRenderingContext2D, b: Body, s: DrawState): void {
  const { cam, pal } = s;
  const x = cam.toScreenX(b.x);
  const y = cam.toScreenY(b.maxY) - 6;
  const text = b.named ? `${b.label} · ${fmt(b.m, b.m < 10 ? 2 : 1)} kg` : `${fmt(b.m, b.m < 10 ? 2 : 1)} kg`;
  ctx.fillStyle = pal.surface;
  const w = ctx.measureText(text).width;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(x - w / 2 - 3, y - 11, w + 6, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.ink;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}

function drawHoles(ctx: CanvasRenderingContext2D, basin: Basin, s: DrawState): void {
  for (const hole of basin.holes) {
    if (hole.speed <= 0.05) continue;
    const y = hole.side === 'bottom' ? basin.y0 : basin.y0 + hole.at;
    const x = hole.side === 'bottom' ? basin.x0 + hole.at : hole.side === 'left' ? basin.x0 - basin.wall : basin.x1 + basin.wall;
    ctx.fillStyle = s.pal.info;
    ctx.fillText(`${fmt(hole.speed, 2)} m/s`, s.cam.toScreenX(x) + (hole.side === 'left' ? -60 : 6), s.cam.toScreenY(y) - 8);
  }
}

function drawTension(ctx: CanvasRenderingContext2D, j: Joint, s: DrawState): void {
  if (!s.values || Math.abs(j.tension) < 0.01) return;
  const x = s.cam.toScreenX((j.pax + j.pbx) / 2) + 6;
  const y = s.cam.toScreenY((j.pay + j.pby) / 2);
  ctx.fillStyle = s.pal.muted;
  ctx.fillText(`${fmt(Math.abs(j.tension), 1)} N`, x, y);
}

function drawRuler(ctx: CanvasRenderingContext2D, r: NonNullable<DrawState['ruler']>, s: DrawState): void {
  const { cam, pal } = s;
  const x1 = cam.toScreenX(r.x1); const y1 = cam.toScreenY(r.y1);
  const x2 = cam.toScreenX(r.x2); const y2 = cam.toScreenY(r.y2);
  const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const n = Math.min(100, Math.floor(len / (len > 2 ? 0.5 : 0.1)));
  const ux = (x2 - x1) / Math.max(1e-6, Math.hypot(x2 - x1, y2 - y1));
  const uy = (y2 - y1) / Math.max(1e-6, Math.hypot(x2 - x1, y2 - y1));
  const step = len > 2 ? 0.5 : 0.1;
  for (let i = 0; i <= n; i += 1) {
    const t = (i * step) / len;
    const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t;
    const k = i % (len > 2 ? 2 : 5) === 0 ? 8 : 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - uy * k, y + ux * k); ctx.stroke();
  }
  ctx.fillStyle = pal.ink;
  ctx.fillText(`${fmt(len, 2)} m`, (x1 + x2) / 2 + 8, (y1 + y2) / 2 - 8);
}

function drawProbe(ctx: CanvasRenderingContext2D, p: NonNullable<DrawState['probe']>, s: DrawState): void {
  const { cam, pal, world } = s;
  const x = cam.toScreenX(p.x);
  const y = cam.toScreenY(p.y);
  const basin = world.basins.find((b) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0);
  const pressure = basin === undefined ? 101325 : basin.pressure(p.y, world.g);
  const depth = basin === undefined ? 0 : Math.max(0, basin.surface() - p.y);
  ctx.strokeStyle = pal.danger;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 7, 0, tau); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.moveTo(x, y - 11); ctx.lineTo(x, y + 11); ctx.stroke();
  const text = `p = ${kPa(pressure)}${depth > 0 ? ` · głęb. ${fmt(depth, 2)} m` : ''}`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = pal.surface;
  ctx.fillRect(x + 12, y - 22, w + 8, 16);
  ctx.fillStyle = pal.ink;
  ctx.fillText(text, x + 16, y - 10);
}

/* -- Farben --------------------------------------------------------------------------------------- */

const fmt = (v: number, d: number) => v.toFixed(d).replace('.', ',');
const pseudo = (x: number) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };

/** Eine Farbe (#rrggbb) heller (+) oder dunkler (−). */
export function shade(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  const r = ch((n >> 16) & 255); const g = ch((n >> 8) & 255); const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function withAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return hex;
  const n = Number.parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function rgbaToHex(rgba: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba);
  if (m === null) return rgba;
  return `#${((1 << 24) | (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3])).toString(16).slice(1)}`;
}
