/**
 * 2026-10-18 — WIE DIE WELT DER CHEMIA AUSSIEHT: der Inhalt aus dem Gitter
 * (je Zelle ein Bildpunkt, weich vergrössert — Wasser in seiner Farbe, die
 * Wolke eines Niederschlags, Schmelze, glühendes Metall, Russ, Nebel, braunes
 * NO₂, Flammen in der Farbe dessen, was brennt, Flammenfärbung der Salze),
 * die Geräte als Linien und Flächen darüber, Blasen, Knalle, Beschriftungen,
 * Thermometer mit ihrer Anzeige. Die Wärmeansicht färbt jede Zelle nach ihrer
 * Temperatur — man sieht die Wärme wandern.
 */

import type { Camera } from '../labView';
import { SPECIES } from './chemData';
import { NC, aqVolume, rgba } from './chemAq';
import { CELL, F, FIRE, GASI, GAS_M, Grid, L, MATERIALS, NG, SOL, SOL_M, SOL_RHO } from './chemGrid';
import { FLAME_IONS } from './chemFire';
import { THING_NAME, inside, partsOf, toWorld, type Thing } from './chemThings';
import { BENCH, type World } from './chemWorld';

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

/* -- Farben ------------------------------------------------------------------------------------------ */

/* Feststoffe etwas dunkler (sonst verschwinden helle Metalle und weisse Salze vor dem hellen Grund). */
const SOL_RGB: readonly (readonly number[])[] = SOL.map((id) => {
  const [r, g, b] = rgba(SPECIES[id]?.color ?? '#bbbbbb');
  const lum = (r + g + b) / 765;
  const k = lum > 0.84 ? 0.84 / lum : 1;
  return [r * k, g * k, b * k];
});
/** Ein Niederschlag in der Flüssigkeit: etwas dunkler — eine weisse Trübung (AgCl, BaSO₄, CaCO₃) sieht man sonst auf hellem Grund nicht. */
const PRECIP_RGB: readonly (readonly number[])[] = SOL_RGB.map(([r, g, b]) => {
  const lum = (r + g + b) / 765;
  const k = lum > 0.74 ? 0.74 / lum : 1;
  return [r * k, g * k, b * k * 1.02];
});
const FLAME_RGB: readonly (readonly number[])[] = FLAME_IONS.map((ion) => rgba(SPECIES[ion]?.flame ?? '#ffffff'));
const FIRE_RGB: Readonly<Record<number, readonly number[]>> = {
  [FIRE.gas]: [80, 130, 255], [FIRE.yellow]: [255, 186, 72], [FIRE.sulfur]: [90, 110, 255], [FIRE.white]: [255, 255, 250],
  [FIRE.sparks]: [255, 180, 70], [FIRE.ethanol]: [110, 150, 255], [FIRE.hydrogen]: [190, 205, 255]
};
const G_NO2 = GASI.NO2;
const G_SO2 = GASI.SO2;

/** Glühen eines heissen Körpers (K) → Farbe und Stärke 0 … 1. */
function glow(T: number, out: number[]): number {
  if (T < 760) return 0;
  const k = Math.min(1, (T - 760) / 900);
  if (T < 1050) { out[0] = 150 + 90 * k; out[1] = 25 + 40 * k; out[2] = 5; }
  else if (T < 1400) { out[0] = 255; out[1] = 90 + 110 * ((T - 1050) / 350); out[2] = 20 + 30 * ((T - 1050) / 350); }
  else { out[0] = 255; out[1] = 220 + 30 * Math.min(1, (T - 1400) / 600); out[2] = 120 + 120 * Math.min(1, (T - 1400) / 600); }
  return Math.min(0.95, 0.25 + k * 0.75);
}

/**
 * Wärmeansicht: Temperatur → Farbe. Kalt blau, Zimmer durchsichtig; zwischen
 * Zimmer und 100 °C fein abgestuft (gelb, orange, rot — da spielen die meisten
 * Versuche: Stäbe in heissem Wasser, Lösungswärme), darüber Karmin, dann die
 * Glut (orange, gelb, weiss).
 */
const HEAT: readonly (readonly [number, number, number, number, number])[] = [
  [35, 255, 214, 90, 0.42], [50, 255, 168, 40, 0.58], [65, 250, 118, 30, 0.68], [80, 236, 72, 34, 0.74],
  [100, 212, 36, 44, 0.8], [200, 150, 22, 64, 0.82], [400, 255, 92, 20, 0.85], [900, 255, 230, 150, 0.88], [1500, 255, 250, 232, 0.9]
];

function heatColor(T: number, room: number, out: number[]): number {
  const d = T - room;
  if (Math.abs(d) < 0.6) return 0;
  if (d < 0) { const k = Math.min(1, -d / 25); out[0] = 40; out[1] = 110 + 60 * k; out[2] = 255; return 0.25 + 0.55 * k; }
  const c = T - 273.15;
  const r = room - 273.15;
  /* Vom Zimmer bis zum ersten Punkt: aus dem Durchsichtigen ins Hellgelbe. */
  const [c0, r0, g0, b0, a0] = HEAT[0];
  if (c <= c0) { const k = Math.max(0, Math.min(1, (c - r) / Math.max(1, c0 - r))); out[0] = r0; out[1] = 240 - (240 - g0) * k; out[2] = 170 - (170 - b0) * k; return 0.18 + (a0 - 0.18) * k; }
  for (let n = 1; n < HEAT.length; n += 1) {
    const [c1, r1, g1, b1, a1] = HEAT[n];
    if (c > c1) continue;
    const [cp, rp, gp, bp, ap] = HEAT[n - 1];
    const k = (c - cp) / (c1 - cp);
    out[0] = rp + (r1 - rp) * k; out[1] = gp + (g1 - gp) * k; out[2] = bp + (b1 - bp) * k;
    return ap + (a1 - ap) * k;
  }
  const last = HEAT[HEAT.length - 1];
  out[0] = last[1]; out[1] = last[2]; out[2] = last[3];
  return last[4];
}

/* -- Das Bild des Gitters ------------------------------------------------------------------------------- */

/** Ein Bild so gross wie das Gitter (ein Punkt je Zelle) — weich vergrössert ergibt es Flüssigkeit, Rauch, Flamme. */
export class Field {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly img: ImageData | null;

  constructor(readonly g: Grid) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = g.w;
    this.canvas.height = g.h;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx?.createImageData(g.w, g.h) ?? null;
  }

  update(world: World, heat: boolean): void {
    const g = this.g;
    const img = this.img;
    if (img === null || this.ctx === null) return;
    const px = img.data;
    const { w, h } = g;
    const c = [0, 0, 0];
    const room = world.room.T;
    for (let r = 0; r < h; r += 1) {
      const row = (h - 1 - r) * w;
      for (let k = 0; k < w; k += 1) {
        const i = r * w + k;
        let R = 0;
        let G = 0;
        let B = 0;
        let A = 0;
        /* über das Bisherige legen (vorne wird zuletzt gemalt) */
        const over = (cr: number, cg: number, cb: number, ca: number): void => {
          if (ca <= 0) return;
          const t = A + ca * (1 - A);
          if (t <= 0) return;
          R = (cr * ca + R * A * (1 - ca)) / t;
          G = (cg * ca + G * A * (1 - ca)) / t;
          B = (cb * ca + B * A * (1 - ca)) / t;
          A = t;
        };
        if (heat) {
          const a = heatColor(g.T[i], room, c);
          const dense = g.mat[i] !== 0 || g.lq[i] !== L.none || g.sp[i] >= 0;
          if (a > 0) over(c[0], c[1], c[2], dense ? Math.min(0.95, a + 0.15) : a * 0.35);
        } else {
          const vol = g.vol(i);
          const mat = g.mat[i];
          /* Gas: Russ, Nebel, weisser Rauch, braunes NO₂ */
          if (mat === 0 || MATERIALS[mat].porous === true) {
            const tot = g.gasTotal(i);
            if (tot > 0) {
              /* NO₂ nach Lambert-Beer: so viel Farbe, wie Moleküle auf dem Weg durch das Glas liegen (Tiefe der Zelle) — heiss
                 (mehr NO₂) dunkelbraun, im Eis (fast alles farbloses N₂O₄) blassgelb. */
              const no2 = g.gas[i * NG + G_NO2];
              if (no2 > 0) {
                const a = 1 - Math.exp((-1e5 * no2 * g.D[i]) / Math.max(1e-9, g.gasVol(i)));
                if (a > 0.01) over(165, 73, 31, Math.min(0.9, a));
              }
              const so2 = g.gas[i * NG + G_SO2] / tot;
              if (so2 > 0.02) over(220, 200, 120, Math.min(0.2, so2));
            }
            if (g.mist[i] > 0) over(245, 248, 250, Math.min(0.8, g.mist[i] / (vol * 1.2e-6)));
            if (g.fume[i] > 0) over(248, 248, 246, Math.min(0.85, g.fume[i] / (vol * 4e-7)));
            if (g.smoke[i] > 0 && g.T[i] < 1050) over(60, 58, 56, Math.min(0.8, g.smoke[i] / (vol * 2.5e-5)));
          }
          /* Flüssigkeit */
          const l = g.lq[i];
          if (l === L.aq) {
            const o = i * 4;
            const room2 = g.room(i);
            const fill = room2 > 0 ? Math.min(1, aqVolume(g.comp, i * NC) / room2) : 1;
            over(g.look[o], g.look[o + 1], g.look[o + 2], Math.min(0.95, (g.look[o + 3] * 0.9 + 0.12) * (0.25 + 0.75 * fill)));
            if (g.sform[i] === F.precip && g.sp[i] >= 0) {
              const vf = (g.sn[i] * SOL_M[g.sp[i]]) / SOL_RHO[g.sp[i]] / Math.max(1e-6, aqVolume(g.comp, i * NC));
              const rgb = PRECIP_RGB[g.sp[i]];
              over(rgb[0], rgb[1], rgb[2], Math.min(0.95, 1 - Math.exp(-vf * 4000)));
            }
          } else if (l === L.melt && g.msp[i] >= 0) {
            /* Schmelze: metallisch glänzend (oben heller), Paraffin und Schwefel in ihrer Farbe. */
            const rgb = SOL_RGB[g.msp[i]];
            const top = i + w < g.n && g.lq[i + w] !== L.melt ? 40 : 0;
            over(Math.min(255, rgb[0] * 0.85 + top), Math.min(255, rgb[1] * 0.85 + top), Math.min(255, rgb[2] * 0.9 + top), 0.97);
          }
          /* Feststoffe */
          const s = g.sp[i];
          if (s >= 0 && g.sform[i] !== F.precip) {
            const f = g.sform[i];
            const rgb = SOL_RGB[s];
            const fill = f === F.piece || f === F.cast ? Math.min(1, 0.35 + g.solidTrue(i) / vol) : Math.min(1, (g.solidVol(i) / vol) * 1.3 + 0.15);
            over(rgb[0], rgb[1], rgb[2], 0.95 * fill);
          } else if (s >= 0 && l !== L.aq) {
            const rgb = SOL_RGB[s];
            over(rgb[0], rgb[1], rgb[2], Math.min(0.9, (g.solidVol(i) / vol) * 2 + 0.2));
          }
          /* Glühen: Feststoffe, Schmelzen, Wände */
          const hot = s >= 0 || l === L.melt || mat !== 0 ? glow(g.T[i], c) : 0;
          if (hot > 0) over(c[0], c[1], c[2], hot);
          /* Flamme: was brennt — und heisses Gas leuchtet schwach */
          const burn = g.burn[i];
          if (burn > 0.01) {
            const rgb = FIRE_RGB[g.fire[i]] ?? FIRE_RGB[FIRE.gas];
            const soot = g.smoke[i] > 0 && g.T[i] > 1050;
            const k = Math.min(0.92, (burn / (vol * 25)) ** 0.6);
            if (soot) over(255, 190 + Math.min(50, (g.T[i] - 1050) / 20), 80, Math.min(0.95, k + 0.2));
            else over(rgb[0], rgb[1], rgb[2], g.fire[i] === FIRE.hydrogen ? k * 0.35 : k);
          } else if (g.smoke[i] > 0 && g.T[i] > 1050) {
            over(255, 175, 60, Math.min(0.9, (g.smoke[i] / (vol * 1e-5)) * ((g.T[i] - 1000) / 800)));
          } else if (g.T[i] > 950 && mat === 0 && s < 0 && l === L.none) {
            over(255, 140, 60, Math.min(0.35, (g.T[i] - 950) / 2500));
          }
          if (g.glow[i] > 1e-10 && g.glowSp[i] >= 0 && g.T[i] > 900) {
            const rgb = FLAME_RGB[g.glowSp[i]];
            over(rgb[0], rgb[1], rgb[2], Math.min(0.95, 0.35 + Math.log10(1 + g.glow[i] / (vol * 1e-9)) * 0.25));
          }
        }
        const p = (row + k) * 4;
        px[p] = R;
        px[p + 1] = G;
        px[p + 2] = B;
        px[p + 3] = A * 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }
}

/* -- Was gezeichnet wird ------------------------------------------------------------------------------- */

export interface ViewState {
  readonly world: World;
  readonly cam: Camera;
  readonly dpr: number;
  readonly pal: ChemPalette;
  readonly time: number;
  readonly pick: string | null;
  readonly target: string | null;
  readonly heat: boolean;
  readonly values: boolean;
  /** Die Sonde (Temperatur an einem Punkt), cm. */
  readonly probe: { readonly x: number; readonly y: number } | null;
}

const GLASS = 'rgba(176, 214, 236, 0.32)';
const GLASS_LINE = 'rgba(70, 120, 150, 0.85)';

/** Der Umriss eines Glases (Welt): aussen herum, oben offen, innen zurück. */
function glassPath(ctx: CanvasRenderingContext2D, t: Thing): void {
  const p = t.prof;
  if (p === null) return;
  const N = 24;
  const pts: [number, number][] = [];
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let k = 0; k <= N; k += 1) {
    const yl = p.t + (p.H * k) / N;
    const r = p.half(Math.min(p.top - 1e-6, Math.max(p.t + 1e-6, yl)));
    outer.push([r + p.t, yl]);
    inner.push([r, yl]);
  }
  pts.push([-(inner[0][0] + p.t), 0], [inner[0][0] + p.t, 0]);
  for (const [x, y] of outer) pts.push([x, y]);
  for (let k = inner.length - 1; k >= 0; k -= 1) pts.push([inner[k][0], inner[k][1]]);
  for (const [x, y] of inner) pts.push([-x, y]);
  for (let k = outer.length - 1; k >= 0; k -= 1) pts.push([-outer[k][0], outer[k][1]]);
  ctx.beginPath();
  pts.forEach(([x, y], k) => { const [wx, wy] = toWorld(t, x, y); if (k === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy); });
  ctx.closePath();
}

function drawThing(ctx: CanvasRenderingContext2D, t: Thing, s: ViewState): void {
  const px = 1 / s.cam.scale;
  if (t.prof !== null) {
    glassPath(ctx, t);
    ctx.fillStyle = t.kind === 'crucible' || t.kind === 'dish' ? 'rgba(240, 236, 226, 0.9)' : GLASS;
    ctx.fill();
    ctx.strokeStyle = t.kind === 'crucible' || t.kind === 'dish' ? 'rgba(150, 140, 120, 0.9)' : GLASS_LINE;
    ctx.lineWidth = 1.2 * px;
    ctx.stroke();
    if (t.kind === 'burette') {
      const [x0, y0] = toWorld(t, -0.5, -0.5);
      const [x1, y1] = toWorld(t, 0.5, -0.1);
      ctx.fillStyle = t.on ? '#2f8a4c' : '#8a4b2a';
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    return;
  }
  for (const p of partsOf(t)) {
    if (p.sp !== undefined && t.kind !== 'rod') continue;
    const m = p.mat !== undefined ? MATERIALS[p.mat] : undefined;
    const color = t.kind === 'rod' && p.sp !== undefined ? SPECIES[SOL[p.sp]]?.color ?? '#999' : m?.color ?? '#888';
    const a = toWorld(t, p.x0, p.y0);
    const b = toWorld(t, p.x1, p.y0);
    const c = toWorld(t, p.x1, p.y1);
    const d = toWorld(t, p.x0, p.y1);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    if (m?.porous === true && m.id === 'gauze') {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 0.08;
      ctx.setLineDash([0.15, 0.12]);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.8 * px;
    ctx.stroke();
  }
  if (t.kind === 'thermometer') {
    const T = Number.isFinite(t.readout) ? t.readout : 20;
    const frac = Math.min(1, Math.max(0.02, (T + 10) / 120));
    const [x0, y0] = toWorld(t, 0, 0.3);
    const [x1, y1] = toWorld(t, 0, 0.3 + (t.size - 1) * frac);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 0.14;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(x0, y0, 0.25, 0, Math.PI * 2); ctx.fill();
  }
  if (t.kind === 'loop') {
    const [x, y] = toWorld(t, 0, 0.1);
    ctx.strokeStyle = '#9aa0a8';
    ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.arc(x, y, 0.3, 0, Math.PI * 2); ctx.stroke();
  }
}

/** Die Bühne zeichnen: Tisch, Inhalt (Gitter), Geräte, Blasen, Knalle, Sonde, Beschriftungen. */
export function drawWorld(ctx: CanvasRenderingContext2D, s: ViewState, field: Field): void {
  const { world, cam, dpr, pal } = s;
  const g = world.g;
  cam.screen(ctx, dpr);
  ctx.clearRect(0, 0, cam.w, cam.h);
  cam.apply(ctx, dpr);
  /* Tisch */
  ctx.fillStyle = pal.dark ? '#5a4632' : '#c8a27a';
  ctx.fillRect(g.x0, -BENCH, g.w * CELL, BENCH);
  ctx.fillStyle = pal.dark ? '#6b553d' : '#d7b48d';
  ctx.fillRect(g.x0, -0.12, g.w * CELL, 0.12);
  /* Inhalt */
  field.update(world, s.heat);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(g.x0, g.y0 + g.h * CELL);
  ctx.scale(CELL, -CELL);
  ctx.drawImage(field.canvas, 0, 0);
  ctx.restore();
  /* Geräte (in der Wärmeansicht durchscheinend: man sieht die Temperatur der Stäbe und Wände) */
  if (s.heat) ctx.globalAlpha = 0.28;
  for (const t of world.things) {
    if (t.prof !== null) continue;
    drawThing(ctx, t, s);
  }
  for (const t of world.things) if (t.prof !== null) drawThing(ctx, t, s);
  ctx.globalAlpha = 1;
  /* Der Rührfisch: ein weisses Stäbchen am Boden eines Glases auf dem laufenden Magnetrührer — es dreht sich (von der Seite: es wird kürzer und länger). */
  ctx.fillStyle = '#f4f4f0';
  for (const t of world.things) {
    if (t.kind !== 'hotplate' || !t.stir) continue;
    for (const u of world.carried(t)) {
      if (u.prof === null) continue;
      const [x, y] = toWorld(u, 0, u.prof.t + 0.2);
      const len = Math.min(2.4, u.prof.half(u.prof.t + 0.3) * 1.2) * Math.abs(Math.cos(world.time * 9));
      ctx.fillRect(x - len / 2 - 0.12, y - 0.12, len + 0.24, 0.24);
    }
  }
  /* Blasen */
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.035;
  for (const b of world.bubbles.list) {
    let n = 0;
    for (let k = 0; k < NG; k += 1) n += b.n[k];
    const r = Math.min(0.28, Math.max(0.04, Math.cbrt((3 * ((n * 8.314 * Math.max(273, b.T)) / 101.325) * 1000) / (4 * Math.PI))));
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  /* Streichholz */
  for (const sp of world.sparks) {
    const fl = 0.5 + 0.15 * Math.sin(s.time * 40);
    ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y + 0.3, 0.22, fl, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  /* Knalle */
  for (const p of world.pops) {
    const age = world.time - p.t;
    if (age < 0 || age > 0.8) continue;
    ctx.strokeStyle = `rgba(255, 200, 80, ${(1 - age / 0.8).toFixed(2)})`;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.5 + age * 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (world.pops.length > 6) world.pops.splice(0, world.pops.length - 6);
  /* Auswahl und Ziel */
  for (const t of world.things) {
    if (t.id !== s.pick && t.id !== s.target) continue;
    ctx.strokeStyle = t.id === s.target ? '#2f8a4c' : pal.accent;
    ctx.lineWidth = 2.4 / cam.scale;
    if (t.prof !== null) { glassPath(ctx, t); ctx.stroke(); } else {
      for (const p of partsOf(t)) {
        const a = toWorld(t, p.x0 - 0.15, p.y0 - 0.15);
        const c = toWorld(t, p.x1 + 0.15, p.y1 + 0.15);
        ctx.strokeRect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]));
      }
    }
  }
  /* Schrift (in Bildpunkten) */
  cam.screen(ctx, dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of world.things) {
    if (t.prof !== null) {
      /* Ein Glas in einem anderen (die Probówka im Wasserbad): Name und Werte über seiner Öffnung, nicht über denen des äusseren. */
      const nested = world.things.some((u) => u !== t && u.prof !== null && inside(u, t.x, t.y + 0.5));
      const sx = cam.toScreenX(t.x);
      const sy = nested ? cam.toScreenY(toWorld(t, 0, t.prof.top + 1.4)[1]) - 34 : cam.toScreenY(t.y - 0.3);
      if (sy > cam.h + 20 || sx < -60 || sx > cam.w + 60) continue;
      ctx.font = `600 12px ${pal.font}`;
      ctx.fillStyle = pal.ink;
      ctx.fillText(t.label || THING_NAME[t.kind], sx, Math.min(cam.h - 30, sy + 4));
      if (s.values && !t.hidden) {
        const sum = world.summary(t, false);
        const parts: string[] = [];
        if (sum.ml > 0.3 || sum.solids.size > 0 || sum.melts.size > 0) parts.push(`${(sum.T - 273.15).toFixed(1).replace('.', ',')} °C`);
        const ph = world.phOf(t);
        if (ph !== null) parts.push(`pH ${ph.toFixed(1).replace('.', ',')}`);
        if (Math.abs(sum.P - world.room.p) > 0.5) parts.push(`${sum.P.toFixed(0)} kPa`);
        if (parts.length > 0) {
          ctx.font = `500 11px ${pal.font}`;
          ctx.fillStyle = pal.muted;
          ctx.fillText(parts.join(' · '), sx, Math.min(cam.h - 16, sy + 19));
        }
      }
    } else if (t.kind === 'thermometer' && Number.isFinite(t.readout)) {
      const [tx, ty] = toWorld(t, 0, t.size);
      const sx = cam.toScreenX(tx);
      const sy = cam.toScreenY(ty);
      label(ctx, `${t.readout.toFixed(1).replace('.', ',')} °C`, sx, sy - 22, pal);
    }
  }
  if (s.probe !== null) {
    const info = world.probe(s.probe.x, s.probe.y);
    const sx = cam.toScreenX(s.probe.x);
    const sy = cam.toScreenY(s.probe.y);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.stroke();
    if (info !== null) {
      const extra = info.pH !== null ? `, pH ${info.pH.toFixed(1).replace('.', ',')}` : info.what === 'gaz' ? `, ${info.P.toFixed(1).replace('.', ',')} kPa` : '';
      label(ctx, `${info.what}: ${(info.T - 273.15).toFixed(1).replace('.', ',')} °C${extra}`, sx, sy - 34, pal);
    }
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, pal: ChemPalette): void {
  ctx.font = `600 12px ${pal.font}`;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = pal.dark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.92)';
  ctx.fillRect(x - w / 2, y, w, 18);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2, y, w, 18);
  ctx.fillStyle = pal.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 9);
  ctx.textBaseline = 'top';
}

export { GAS_M };
