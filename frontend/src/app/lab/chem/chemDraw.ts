/**
 * 2026-10-18 — DER LABORTISCH, GEZEICHNET (Chemia): Wand und Tisch, Brenner
 * mit Dreifuss und Drahtnetz, Glas (Zlewka, Kolba, Probówka …) mit der
 * Flüssigkeit in ihrer Farbe — auch schräg beim Ausgiessen, der Spiegel
 * bleibt waagrecht —, Trübung, Bodensatz, Schaum, Feststoffe (Stücke,
 * Körner, Kristalle, Pulver, Band, Kerze), Stopfen, Manometer, Schläuche,
 * Bürette, Gasspritze, die Werkzeuge an der Öffnung, Beschriftungen.
 *
 * Gezeichnet wird in cm (die Kamera setzt die Transformation, y nach oben);
 * Schrift in Bildpunkten.
 */

import { SPECIES } from './chemData';
import { candleTop } from './chemFx';
import { interior, liquidPoly, path, pivotOf, syringeGeom, type Pt } from './chemGeom';
import { drawBurner, drawFlame, drawGauge, drawHeld, drawLink, drawPour, drawProbe, drawProbes, drawStand, drawSyringe, roundRect, type ChemPalette, type DrawState } from './chemKit';
import { rgba, type Lump, type Vessel } from './chemVessel';

/* -- Zeichnen ------------------------------------------------------------------------------------- */

export function drawLab(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const { cam, dpr, pal, lab } = s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  cam.apply(ctx, dpr);
  const x0 = cam.toWorldX(0);
  const x1 = cam.toWorldX(cam.w);
  const y0 = cam.toWorldY(cam.h);
  const y1 = cam.toWorldY(0);
  drawRoom(ctx, pal, x0, x1, y0, y1);
  for (const b of lab.burners) drawBurner(ctx, b, s);
  const order = [...lab.vessels].sort((a, b) => (a.id === s.pick ? 1 : 0) - (b.id === s.pick ? 1 : 0) || a.y - b.y);
  for (const v of order) drawStand(ctx, v, lab, pal);
  for (const v of order) drawVessel(ctx, v, s);
  for (const k of lab.links) drawLink(ctx, k, s);
  for (const v of lab.vessels) if (v.gauge) drawGauge(ctx, v, s);
  drawPour(ctx, s);
  for (const b of lab.burners) drawFlame(ctx, b, s);
  s.fx.drawFree(ctx, pal.font, cam.scale, pal.dark);
  drawProbes(ctx, s);
  drawHeld(ctx, s);
  cam.screen(ctx, dpr);
  drawLabels(ctx, s);
  drawProbe(ctx, s);
}

function drawRoom(ctx: CanvasRenderingContext2D, pal: ChemPalette, x0: number, x1: number, y0: number, y1: number): void {
  ctx.fillStyle = pal.dark ? '#1d2126' : '#eef2f4';
  ctx.fillRect(x0, 0, x1 - x0, Math.max(0, y1));
  ctx.strokeStyle = pal.dark ? 'rgba(255,255,255,0.04)' : 'rgba(40,70,90,0.06)';
  ctx.lineWidth = 0.08;
  for (let x = Math.floor(x0 / 10) * 10; x < x1; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y1); ctx.stroke(); }
  for (let y = 10; y < y1; y += 10) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  ctx.fillStyle = pal.dark ? '#3a3229' : '#c9b08a';
  ctx.fillRect(x0, Math.min(0, y0), x1 - x0, -Math.min(0, y0) + 0.0001);
  ctx.fillStyle = pal.dark ? '#4a4034' : '#b59a72';
  ctx.fillRect(x0, -0.6, x1 - x0, 0.6);
  ctx.strokeStyle = pal.dark ? '#5a4e3f' : '#8f7756';
  ctx.lineWidth = 0.12;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
}

/* -- Ein Gefäss ------------------------------------------------------------------------------------- */

function drawVessel(ctx: CanvasRenderingContext2D, v: Vessel, s: DrawState): void {
  if (v.kind === 'syringe') { drawSyringe(ctx, v, s); return; }
  const { pal } = s;
  const H = v.shape.H;
  const wall = v.kind === 'tube' || v.kind === 'burette' ? 0.1 : 0.16;
  ctx.save();
  ctx.translate(v.x, v.y);
  if (v.angle !== 0) {
    const [px, py] = pivotOf(v);
    ctx.translate(px, py);
    ctx.rotate(v.angle);
    ctx.translate(-px, -py);
  }
  const inner = interior(v);
  const outer: Pt[] = inner.map(([x, y]) => [x + Math.sign(x || 1) * wall, y < 0.01 ? y - wall : y]);
  /* Hinter dem Glas */
  path(ctx, inner);
  ctx.fillStyle = pal.dark ? 'rgba(160,190,210,0.06)' : 'rgba(255,255,255,0.45)';
  ctx.fill();
  if (s.target === v.id || s.pick === v.id || s.linkFrom === v.id) {
    path(ctx, outer);
    ctx.strokeStyle = s.target === v.id ? pal.accent : `${pal.accent}aa`;
    ctx.lineWidth = s.target === v.id ? 0.45 : 0.3;
    ctx.stroke();
  }
  /* Inhalt — beschnitten auf das Innere */
  ctx.save();
  path(ctx, inner);
  ctx.clip();
  drawGasTint(ctx, v, inner);
  const level = v.level();
  const look = v.look();
  if (v.liquidMl() > 0.005) {
    const liq = liquidPoly(v, inner, level);
    if (liq.poly.length > 2) {
      path(ctx, liq.poly);
      ctx.fillStyle = `rgba(${look.r | 0},${look.g | 0},${look.b | 0},${look.a.toFixed(3)})`;
      ctx.fill();
      if (look.turbid > 0.01) {
        /* Milchig: ein Weiss, das man vor dem hellen Glas noch sieht (etwas grauer, mit Körnchen). */
        const pale = (look.tr + look.tg + look.tb) / 3 > 215;
        const k = pale ? 0.86 : 1;
        ctx.fillStyle = `rgba(${(look.tr * k) | 0},${(look.tg * k) | 0},${(look.tb * k + (pale ? 12 : 0)) | 0},${(look.turbid * 0.92).toFixed(3)})`;
        ctx.fill();
        if (look.turbid > 0.08) {
          ctx.fillStyle = pale ? 'rgba(150,150,150,0.35)' : 'rgba(0,0,0,0.12)';
          const bottom = Math.min(...liq.poly.map((q) => q[1]));
          const top = Math.max(...liq.poly.map((q) => q[1]));
          for (let i = 0; i < 40 * look.turbid; i += 1) {
            const fy = bottom + ((i * 0.618 + 0.11) % 1) * (top - bottom);
            const fx = (((i * 0.382 + 0.7) % 1) * 2 - 1) * Math.max(0.2, v.shape.halfWidth(fy) - 0.15);
            ctx.fillRect(fx, fy, 0.06, 0.06);
          }
        }
      }
      /* Der Spiegel: eine helle Linie, unruhig, wenn es sprudelt */
      const wob = Math.min(0.25, v.fx.boil * 30 + v.fx.bulk * 2e3 + v.fx.spots.reduce((a, p) => a + p.rate, 0) * 1e3);
      const ends = liq.poly.filter((p) => Math.abs(liq.nx * p[0] + liq.ny * p[1] - liq.c) < 1e-6);
      if (ends.length >= 2) {
        const [a, b] = [ends[0], ends[ends.length - 1]];
        ctx.beginPath();
        const steps = 10;
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t + Math.sin(s.time * 11 + t * 9) * wob * Math.sin(Math.PI * t);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.08;
        ctx.stroke();
      }
    }
  }
  drawSediment(ctx, v);
  for (const l of v.lumps) drawLump(ctx, v, l, s);
  s.fx.drawInside(ctx, v);
  if (v.foam > 0.2) drawFoam(ctx, v, level);
  ctx.restore();
  /* Das Glas selbst */
  path(ctx, outer);
  ctx.strokeStyle = pal.dark ? 'rgba(190,215,230,0.75)' : 'rgba(90,120,140,0.85)';
  ctx.lineWidth = 0.09;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-v.shape.halfWidth(H * 0.85) + 0.18, H * 0.85);
  ctx.lineTo(-v.shape.halfWidth(H * 0.15) + 0.18, H * 0.15);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.12;
  ctx.stroke();
  drawMarks(ctx, v, s);
  if (v.kind === 'burette') drawTap(ctx, v);
  if (v.closed) drawStopper(ctx, v, s.lab.links.some((k) => k.from === v.id) || v.gauge);
  if (v.foam > 0.5 && !v.closed) drawFoamOver(ctx, v, s.time);
  for (const l of v.lumps) if (l.where === 'spoon') drawSpoon(ctx, v);
  ctx.restore();
}

function drawGasTint(ctx: CanvasRenderingContext2D, v: Vessel, inner: readonly Pt[]): void {
  const no2 = v.frac('NO2');
  if (no2 < 0.002) return;
  const p = v.closed ? v.pressure(101.3) / 101.3 : 1;
  path(ctx, inner);
  ctx.fillStyle = `rgba(165,73,31,${Math.min(0.75, no2 * p * 4).toFixed(3)})`;
  ctx.fill();
}

function drawSediment(ctx: CanvasRenderingContext2D, v: Vessel): void {
  let vol = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const l of v.lumps) {
    if (l.form !== 'precipitate' || l.where !== 'in') continue;
    const part = l.volume() * (1 - l.suspended) * 3;
    const [cr, cg, cb] = rgba(SPECIES[l.sp]?.color ?? '#f4f4f0');
    vol += part; r += cr * part; g += cg * part; b += cb * part;
  }
  if (vol < 1e-4) return;
  const h = Math.max(0.08, v.shape.levelOf(vol));
  const w = v.shape.halfWidth(h) + 0.2;
  ctx.fillStyle = `rgb(${(r / vol) | 0},${(g / vol) | 0},${(b / vol) | 0})`;
  ctx.beginPath();
  ctx.moveTo(-w, -0.5);
  for (let i = 0; i <= 12; i += 1) {
    const x = -w + (2 * w * i) / 12;
    ctx.lineTo(x, h + Math.sin(i * 2.7) * Math.min(0.08, h * 0.2));
  }
  ctx.lineTo(w, -0.5);
  ctx.closePath();
  ctx.fill();
}

/** Schaum: Bläschen mit Rand (weiss vor weissem Glas soll man sehen), bis zum Rand. */
function drawFoam(ctx: CanvasRenderingContext2D, v: Vessel, level: number): void {
  const r = Math.max(0.3, v.shape.halfWidth(level));
  const h = Math.min(v.shape.H - level + 0.6, v.foam / (Math.PI * r * r));
  const rows = Math.max(1, Math.ceil(h / 0.45));
  ctx.lineWidth = 0.03;
  for (let j = 0; j < rows; j += 1) {
    const y = level + j * 0.45;
    const hw = v.shape.halfWidth(y);
    for (let x = -hw; x <= hw; x += 0.5) {
      const rr = 0.2 + (((j * 7 + Math.round(x * 3)) % 5) * 0.04);
      ctx.beginPath();
      ctx.arc(x + ((j % 2) * 0.25), y, rr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,250,247,0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,160,170,0.55)';
      ctx.stroke();
    }
  }
}

/** Was nicht ins Gefäss passt, quillt über den Rand und läuft aussen hinunter. */
function drawFoamOver(ctx: CanvasRenderingContext2D, v: Vessel, t: number): void {
  const level = v.level();
  const r = Math.max(0.3, v.shape.halfWidth(level));
  const room = Math.PI * r * r * (v.shape.H - level);
  const over = v.foam - room;
  if (over <= 0.5) return;
  const top = v.shape.H;
  const w = v.shape.halfWidth(top);
  const tall = Math.min(14, Math.cbrt(over) * 1.6);
  ctx.lineWidth = 0.03;
  for (let k = 0; k < 60; k += 1) {
    const u = (k * 0.618) % 1;
    const side = k % 3;
    let x: number;
    let y: number;
    if (side === 0) { x = (u * 2 - 1) * (w + 0.3); y = top + ((k * 0.37) % 1) * tall * 0.5; }
    else { const d = ((k * 0.29 + t * 0.15) % 1) * Math.min(top, tall * 1.6); x = (side === 1 ? -1 : 1) * (w + 0.35 + Math.sin(k) * 0.15); y = top - d; }
    const rr = 0.25 + ((k * 13) % 7) * 0.04;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,250,247,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,160,170,0.55)';
    ctx.stroke();
  }
}

/** Ein Feststoff: Stück (Metall glänzt, geschmolzen eine Kugel), Körner, Kristalle, Pulver, Band, Kerze. */
function drawLump(ctx: CanvasRenderingContext2D, v: Vessel, l: Lump, s: DrawState): void {
  if (l.form === 'precipitate' || l.n <= 0) return;
  const sp = SPECIES[l.sp];
  const color = sp?.color ?? '#cccccc';
  const vol = l.volume();
  const y0 = l.where === 'spoon' ? v.shape.H * 0.72 : l.y;
  const hw = Math.max(0.3, v.shape.halfWidth(y0 + 0.2) - 0.3);
  const coat = Object.entries(l.coat).filter(([, n]) => n > 0);
  if (l.form === 'candle') {
    const left = l.n / l.n0;
    const top = candleTop(v, left) - 0.6;
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(-0.6, 0, 1.2, top);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0.25, 0, 0.35, top);
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0.05, top + 0.55); ctx.stroke();
    if (l.burning) candleFlame(ctx, top + 0.45, s.time, l.seed);
    return;
  }
  const x = l.where === 'spoon' ? 0 : l.x * hw;
  ctx.save();
  ctx.translate(x, y0);
  if (l.form === 'piece') {
    /* Etwas grösser als in echt — ein Krümel Natrium soll man sehen. */
    const r = Math.max(0.32, Math.cbrt((3 * vol) / (4 * Math.PI)) * 1.35);
    ctx.beginPath();
    if (l.molten) ctx.arc(0, r * 0.8, r * 0.85, 0, Math.PI * 2);
    else {
      const k = 7;
      for (let i = 0; i <= k; i += 1) {
        const a = (i / k) * Math.PI * 2;
        const rr = r * (0.82 + 0.25 * Math.sin(a * 3 + l.seed * 10));
        const px = Math.cos(a) * rr * 1.25;
        const py = r * 0.8 + Math.sin(a) * rr * 0.8;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    const g = ctx.createLinearGradient(-r, 2 * r, r, 0);
    g.addColorStop(0, shade(color, 1.25));
    g.addColorStop(1, shade(color, 0.7));
    ctx.fillStyle = g;
    ctx.fill();
    if (coat.length > 0) {
      const total = coat.reduce((a, [, n]) => a + n, 0);
      ctx.strokeStyle = SPECIES[coat[0][0]]?.color ?? '#c26a3d';
      ctx.lineWidth = Math.min(0.25, 0.04 + Math.sqrt(total) * 1.5);
      ctx.stroke();
    }
    if (l.molten) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(-r * 0.3, r * 1.1, r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (l.form === 'granules') {
    const count = Math.max(1, Math.min(9, Math.round(2 + vol * 8)));
    for (let i = 0; i < count; i += 1) {
      const gx = (((i * 0.618 + l.seed) % 1) - 0.5) * Math.min(hw * 1.6, 0.5 + count * 0.35);
      const gy = 0.2 + (i % 3) * 0.22;
      ctx.beginPath();
      ctx.arc(gx, gy, 0.22, 0, Math.PI * 2);
      ctx.fillStyle = shade(color, 0.85 + ((i * 37) % 30) / 100);
      ctx.fill();
    }
  } else if (l.form === 'crystals') {
    const count = Math.max(1, Math.min(14, Math.round(2 + vol * 6)));
    for (let i = 0; i < count; i += 1) {
      const gx = (((i * 0.618 + l.seed) % 1) - 0.5) * Math.min(hw * 1.7, 0.6 + count * 0.3);
      const gy = 0.12 + ((i * 7) % 4) * 0.12;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(i * 0.7 + l.seed);
      ctx.fillStyle = shade(color, 0.9 + ((i * 13) % 20) / 100);
      ctx.fillRect(-0.13, -0.13, 0.26, 0.26);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.02;
      ctx.strokeRect(-0.13, -0.13, 0.26, 0.26);
      ctx.restore();
    }
  } else if (l.form === 'powder') {
    const w = Math.min(hw * 1.6, 0.6 + Math.sqrt(vol) * 2.2);
    const h = Math.min(1.2, 0.12 + Math.sqrt(vol) * 0.9);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, h * 2, w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.03;
    ctx.stroke();
  } else if (l.form === 'ribbon') {
    const len = Math.min(hw * 1.8, 0.8 + l.mass() * 9);
    ctx.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const px = -len / 2 + len * t;
      const py = 0.25 + Math.sin(t * 8 + l.seed * 6) * 0.18;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = coat.length > 0 ? SPECIES[coat[0][0]]?.color ?? color : color;
    ctx.lineWidth = 0.16;
    ctx.stroke();
  }
  if (l.burning && (l.sp === 'C' || l.sp === 'Fe')) {
    ctx.fillStyle = 'rgba(255,110,30,0.75)';
    ctx.beginPath(); ctx.arc(0, 0.3, 0.35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  void s;
}

/** Die Flamme einer Kerze: ein Tropfen, unten blau, innen hell, flackernd. */
function candleFlame(ctx: CanvasRenderingContext2D, y: number, t: number, seed: number): void {
  const f = Math.sin(t * 11 + seed * 9) * 0.06 + Math.sin(t * 23 + seed * 3) * 0.04;
  const h = 1.9 + f * 3;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(90,120,255,0.75)');
  g.addColorStop(0.18, 'rgba(255,240,190,0.98)');
  g.addColorStop(0.55, 'rgba(255,190,70,0.95)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, y - 0.1);
  ctx.bezierCurveTo(-0.55, y + 0.3, -0.35 + f, y + h * 0.7, f * 2, y + h);
  ctx.bezierCurveTo(0.35 + f, y + h * 0.7, 0.55, y + 0.3, 0, y - 0.1);
  ctx.fill();
  const glow = ctx.createRadialGradient(0, y + h * 0.4, 0, 0, y + h * 0.4, 2.2);
  glow.addColorStop(0, 'rgba(255,200,90,0.25)');
  glow.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-2.2, y + h * 0.4 - 2.2, 4.4, 4.4);
}

function drawMarks(ctx: CanvasRenderingContext2D, v: Vessel, s: DrawState): void {
  if (s.cam.scale < 9) return;
  const every = v.kind === 'beaker' ? v.size / 5 : v.kind === 'cylinder' || v.kind === 'burette' ? v.size / 10 : 0;
  if (every <= 0) return;
  ctx.strokeStyle = s.pal.dark ? 'rgba(220,230,240,0.45)' : 'rgba(40,60,80,0.45)';
  ctx.lineWidth = 0.05;
  for (let ml = every; ml <= v.size + 1e-9; ml += every) {
    const y = v.kind === 'burette' ? v.shape.levelOf(v.shape.full - ml) : v.shape.levelOf(ml);
    const x = v.shape.halfWidth(y);
    ctx.beginPath();
    ctx.moveTo(x - 0.05, y);
    ctx.lineTo(x - Math.min(0.9, x * 0.4), y);
    ctx.stroke();
  }
}

function drawTap(ctx: CanvasRenderingContext2D, v: Vessel): void {
  ctx.strokeStyle = 'rgba(90,120,140,0.9)';
  ctx.lineWidth = 0.12;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -1.4); ctx.stroke();
  ctx.fillStyle = v.drip > 0 ? '#2f6fae' : '#7a8088';
  ctx.fillRect(v.drip > 0 ? -0.18 : -1, -0.75, v.drip > 0 ? 0.36 : 2, v.drip > 0 ? 1.2 : 0.3);
}

function drawStopper(ctx: CanvasRenderingContext2D, v: Vessel, hole: boolean): void {
  const H = v.shape.H;
  const w = v.shape.halfWidth(H);
  ctx.fillStyle = '#8a4b2a';
  ctx.beginPath();
  ctx.moveTo(-w - 0.25, H + 0.75); ctx.lineTo(w + 0.25, H + 0.75); ctx.lineTo(w - 0.05, H - 0.8); ctx.lineTo(-w + 0.05, H - 0.8);
  ctx.closePath();
  ctx.fill();
  if (hole) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-0.12, H - 0.8, 0.24, 1.55);
  }
}

function drawSpoon(ctx: CanvasRenderingContext2D, v: Vessel): void {
  const y = v.shape.H * 0.72;
  ctx.strokeStyle = '#7d8289';
  ctx.lineWidth = 0.12;
  ctx.beginPath(); ctx.moveTo(0, v.shape.H + 5); ctx.lineTo(0, y + 0.1); ctx.stroke();
  ctx.fillStyle = '#7d8289';
  ctx.beginPath(); ctx.ellipse(0, y, 0.7, 0.25, 0, 0, Math.PI); ctx.fill();
}

/* -- Beschriftungen (Bildpunkte) ------------------------------------------------------------------- */

function drawLabels(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const { cam, pal, lab } = s;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  /* Auf dem Tisch dicht nebeneinander (Probówki): abwechselnd eine Zeile tiefer, statt übereinander. */
  const rowEnd = [-Infinity, -Infinity];
  for (const v of [...lab.vessels].sort((a, b) => a.x - b.x)) {
    if (Math.abs(v.angle) > 0.1) continue;
    if (v.kind === 'syringe') {
      const g = syringeGeom(v);
      const sx = cam.toScreenX(g.x0 + g.L / 2);
      const sy = cam.toScreenY(g.y + g.R) - 18;
      ctx.font = `600 12px ${pal.font}`;
      ctx.fillStyle = pal.ink;
      ctx.fillText(`${v.label || 'strzykawka'} · ${v.syringeMl < 0.6 ? 0 : v.syringeMl.toFixed(1).replace('.', ',')} cm³`, sx, sy);
      continue;
    }
    const seated = v.y > 0.5;
    let sy = seated ? cam.toScreenY(v.y + v.shape.H + (v.closed ? 1.4 : 0.6)) - (s.values ? 30 : 16) : cam.toScreenY(-0.9);
    if (v.kind === 'burette') sy = cam.toScreenY(v.y + v.shape.H + 0.4) - 30;
    const name = v.label || v.type.name;
    const bits: string[] = [];
    if (s.values && !v.hidden) {
      bits.push(`${(v.T - 273.15).toFixed(1).replace('.', ',')} °C`);
      if (v.wet()) bits.push(`pH ${(Math.abs(v.spec.pH) < 0.05 ? 0 : v.spec.pH).toFixed(1).replace('.', ',').replace('-', '−')}`);
      if (v.closed) bits.push(`${v.pressure(lab.room.p).toFixed(0)} kPa`);
      if (v.kind === 'burette') bits.unshift(`${v.liquidMl().toFixed(1).replace('.', ',')} cm³`);
    }
    ctx.font = `500 11px ${pal.font}`;
    const vw = bits.length > 0 ? ctx.measureText(bits.join(' · ')).width : 0;
    ctx.font = `600 12px ${pal.font}`;
    const w = Math.max(ctx.measureText(name).width, vw, 40) + 10;
    /* Am Rand der Bühne bleibt die Beschriftung ganz sichtbar. */
    const sx = Math.min(cam.w - w / 2 - 2, Math.max(w / 2 + 2, cam.toScreenX(v.x)));
    if (!seated && v.kind !== 'burette') {
      const row = sx - w / 2 > rowEnd[0] + 2 ? 0 : sx - w / 2 > rowEnd[1] + 2 ? 1 : 0;
      rowEnd[row] = sx + w / 2;
      sy += row * (bits.length > 0 ? 36 : 22);
    }
    if (!seated && v.kind !== 'burette') {
      ctx.fillStyle = pal.dark ? 'rgba(20,20,20,0.55)' : 'rgba(255,255,255,0.75)';
      roundRect(ctx, sx - w / 2, sy - 2, w, bits.length > 0 ? 32 : 18, 4);
      ctx.fill();
    }
    ctx.fillStyle = pal.ink;
    ctx.fillText(name, sx, sy);
    if (bits.length > 0) {
      ctx.font = `500 11px ${pal.font}`;
      ctx.fillStyle = pal.muted;
      ctx.fillText(bits.join(' · '), sx, sy + 15);
    }
  }
}

/** Eine Farbe heller (k > 1) oder dunkler. */
function shade(c: string, k: number): string {
  const [r, g, b] = rgba(c);
  const f = (x: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? x + (255 - x) * (k - 1) : x * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
