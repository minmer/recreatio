/**
 * 2026-10-18 — WAS MAN IN DER CHEMIA SIEHT, ABER NICHT RECHNET: Bläschen,
 * Dampf, Rauch, Flammen, Funken, Flocken eines Niederschlags, Schlieren
 * beim Eingiessen, Tropfen, Spritzer, ein fliegender Korken, „Pyk!”.
 *
 * Die Menge kommt aus der Chemie (`Vessel.fx`: mol/s Gas, mol Niederschlag,
 * eingegossene mL) — die Teilchen sind nur ihr Bild: begrenzt (ein Telefon
 * bekommt weniger), in echter Zeit bewegt, auch wenn die Chemie schneller läuft.
 * Teilchen im Gefäss leben in seinen Koordinaten (cm über dem Boden, quer zur
 * Mitte) und wandern mit, wenn man es verschiebt.
 */

import { SPECIES } from './chemData';
import type { Lab } from './chemBench';
import { rgba, type Vessel } from './chemVessel';

type Kind = 'bubble' | 'ring' | 'steam' | 'smoke' | 'flame' | 'spark' | 'flake' | 'swirl' | 'drop' | 'cork' | 'text' | 'flash';

export interface Particle {
  kind: Kind;
  /** Im Gefäss (lokale Koordinaten) oder frei (Welt, cm). */
  v: Vessel | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  color: string;
  seed: number;
  text?: string;
}

/** Wie viele Bläschen je Sekunde ein Gasstrom (mol/s) zeigt. */
const bubblesPerSecond = (rate: number): number => (rate <= 0 ? 0 : Math.min(140, 55 * Math.log10(1 + rate * 1.2e5)));

export class Effects {
  readonly list: Particle[] = [];
  private readonly acc = new Map<string, number>();

  constructor(private readonly cap: number) {}

  get busy(): boolean { return this.list.length > 0; }

  private add(p: Omit<Particle, 'seed'>): void {
    if (this.list.length >= this.cap) return;
    this.list.push({ ...p, seed: Math.random() });
  }

  /** Wie viele Teilchen jetzt (Bruchteile werden aufgespart). */
  private count(key: string, perSecond: number, dt: number): number {
    const a = (this.acc.get(key) ?? 0) + perSecond * dt;
    const n = Math.floor(a);
    this.acc.set(key, a - n);
    return n;
  }

  /** Aus dem, was die Chemie in diesem Bild getan hat, neue Teilchen. */
  emit(lab: Lab, dt: number, speed: number): void {
    for (const v of lab.vessels) {
      if (Math.abs(v.angle) > 0.15) continue;
      const f = v.fx;
      const level = v.level();
      const wet = v.wet() && level > 0.05;
      const hw = (h: number) => Math.max(0.2, v.shape.halfWidth(h) - 0.15);
      /* Bläschen an Stellen (am Metall, am Katalysator, am Schlauchende). */
      f.spots.forEach((s, i) => {
        if (!wet || s.y > level) return;
        const n = this.count(`${v.id}:s${i}`, bubblesPerSecond(s.rate * speed), dt);
        const size = Math.min(0.32, 0.07 + Math.log10(1 + s.rate * 1e5) * 0.05);
        /* Am Boden steigen sie auf; an einem schwimmenden Stück (Natrium) zischt es rundherum. */
        const surface = s.y > level - 0.6;
        for (let k = 0; k < n; k += 1) {
          const y = surface ? Math.max(0.05, level - 0.15 - Math.random() * 0.7) : Math.max(0.05, s.y + Math.random() * 0.3);
          this.add({ kind: 'bubble', v, x: s.x * hw(y) + (Math.random() - 0.5) * (surface ? 1.4 : 0.5), y, vx: 0, vy: 0, r: size * (0.6 + Math.random() * 0.6), life: 0, max: 30, color: '' });
        }
        if (surface && s.rate > 2e-6) {
          const puffs = this.count(`${v.id}:h${i}`, Math.min(14, 3 + s.rate * 2e4), dt);
          for (let k = 0; k < puffs; k += 1) this.add({ kind: 'steam', v: null, x: v.x + s.x * hw(level) + (Math.random() - 0.5) * 0.6, y: v.y + level + 0.2, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 3, r: 0.25 + Math.random() * 0.3, life: 0, max: 1, color: '#ffffff' });
        }
      });
      if (wet) {
        const bulk = this.count(`${v.id}:b`, bubblesPerSecond(f.bulk * speed), dt);
        for (let k = 0; k < bulk; k += 1) {
          const y = Math.random() * level * 0.5;
          this.add({ kind: 'bubble', v, x: (Math.random() * 2 - 1) * hw(y), y, vx: 0, vy: 0, r: 0.05 + Math.random() * 0.08, life: 0, max: 30, color: '' });
        }
        const boil = this.count(`${v.id}:k`, f.boil > 0 ? Math.min(90, 25 + f.boil * 2e4) : 0, dt);
        for (let k = 0; k < boil; k += 1) this.add({ kind: 'bubble', v, x: (Math.random() * 2 - 1) * hw(0.2), y: 0.15, vx: 0, vy: 0, r: 0.18 + Math.random() * 0.25, life: 0, max: 30, color: '' });
        for (const [solid, mol] of f.precip) {
          const n = Math.min(40, Math.ceil(mol * 4e5));
          const color = SPECIES[solid]?.color ?? '#f4f4f0';
          for (let k = 0; k < n; k += 1) {
            const y = Math.random() * level;
            this.add({ kind: 'flake', v, x: (Math.random() * 2 - 1) * hw(y), y, vx: 0, vy: -0.4 - Math.random() * 0.5, r: 0.05 + Math.random() * 0.07, life: 0, max: 4 + Math.random() * 3, color });
          }
        }
        for (const s of f.swirl) {
          const n = Math.min(14, 3 + Math.ceil(s.amount / 2));
          for (let k = 0; k < n; k += 1) {
            const y = level * (0.45 + Math.random() * 0.55);
            this.add({ kind: 'swirl', v, x: (Math.random() - 0.5) * hw(y), y, vx: (Math.random() - 0.5) * 1.5, vy: -0.6 - Math.random(), r: 0.3 + Math.random() * 0.5, life: 0, max: 1.6 + Math.random(), color: s.color });
          }
        }
        if (f.splash > 0) {
          for (let k = 0; k < Math.min(12, 4 + f.splash * 3); k += 1) this.add({ kind: 'drop', v: null, x: v.x + (Math.random() - 0.5) * hw(level), y: v.y + level, vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 40, r: 0.1, life: 0, max: 1.2, color: 'rgba(170,208,238,0.8)' });
        }
      }
      const top = v.y + v.shape.H;
      const mouth = Math.max(0.3, v.shape.halfWidth(v.shape.H) - 0.2);
      const steam = this.count(`${v.id}:d`, f.steam > 0 ? Math.min(30, 2 + Math.log10(1 + f.steam * 3e4) * 9) * Math.min(1, speed) + (f.boil > 0 ? 6 : 0) : 0, dt);
      for (let k = 0; k < steam; k += 1) this.add({ kind: 'steam', v: null, x: v.x + (Math.random() * 2 - 1) * mouth, y: top + 0.3, vx: (Math.random() - 0.5) * 2, vy: 4 + Math.random() * 4, r: 0.5 + Math.random() * 0.6, life: 0, max: 2.2 + Math.random(), color: '#ffffff' });
      const smoke = this.count(`${v.id}:r`, f.smoke > 0 ? Math.min(30, 4 + Math.log10(1 + f.smoke * 1e5) * 8) : 0, dt);
      for (let k = 0; k < smoke; k += 1) this.add({ kind: 'smoke', v: null, x: v.x + (Math.random() * 2 - 1) * mouth, y: top, vx: (Math.random() - 0.5) * 3, vy: 5 + Math.random() * 4, r: 0.6 + Math.random() * 0.8, life: 0, max: 2.6, color: f.smokeColor });
      /* Was brennt: Flammen an den Brocken (Kerze, Magnesium, Schwefel, Kalium auf dem Wasser). */
      for (const l of v.lumps) {
        if (!l.burning) continue;
        const color = l.sp === 'K' ? '#c890ff' : l.sp === 'Na' ? '#ffb000' : l.sp === 'Mg' ? '#ffffff' : l.sp === 'S' ? '#5a7cff' : l.sp === 'C' ? '#ff6a1a' : '#ffb347';
        const base = l.where === 'spoon' ? v.shape.H * 0.72 : l.form === 'candle' ? candleTop(v, l.n / l.n0) : l.y + 0.3;
        const n = this.count(`${v.id}:f${l.id}`, l.sp === 'wax' ? 0 : l.sp === 'C' ? 6 : 40, dt);
        for (let k = 0; k < n; k += 1) {
          this.add({ kind: 'flame', v: null, x: v.x + l.x * hw(base) + (Math.random() - 0.5) * 0.4, y: v.y + base, vx: (Math.random() - 0.5) * 2, vy: (l.sp === 'wax' ? 7 : 12) + Math.random() * 6, r: (l.sp === 'wax' ? 0.45 : l.sp === 'Mg' ? 0.9 : 0.6) * (0.7 + Math.random() * 0.5), life: 0, max: l.sp === 'wax' ? 0.3 : 0.4, color });
        }
        if (l.sp === 'Mg') this.add({ kind: 'flash', v: null, x: v.x, y: v.y + base, vx: 0, vy: 0, r: 9, life: 0, max: 0.12, color: '#ffffff' });
      }
      if (v.burning) {
        const n = this.count(`${v.id}:e`, 30, dt);
        for (let k = 0; k < n; k += 1) this.add({ kind: 'flame', v: null, x: v.x + (Math.random() * 2 - 1) * hw(level), y: v.y + level, vx: 0, vy: 9 + Math.random() * 5, r: 0.5, life: 0, max: 0.35, color: '#6f9cff' });
      }
      const sparks = this.count(`${v.id}:i`, f.sparks > 0 ? 40 : 0, dt);
      for (let k = 0; k < sparks; k += 1) this.add({ kind: 'spark', v: null, x: v.x, y: v.y + v.shape.H * 0.72, vx: (Math.random() - 0.5) * 60, vy: Math.random() * 50, r: 0.08, life: 0, max: 0.6, color: '#ffd070' });
      if (f.pop > 0) {
        this.add({ kind: 'flash', v: null, x: v.x, y: top + 1, vx: 0, vy: 0, r: 6, life: 0, max: 0.25, color: '#fff2b0' });
        this.add({ kind: 'text', v: null, x: v.x, y: top + 3, vx: 0, vy: 5, r: 0, life: 0, max: 1.4, color: '#c0392b', text: 'Pyk!' });
      }
      if (f.cork) {
        this.add({ kind: 'cork', v: null, x: v.x, y: top + 0.5, vx: (Math.random() - 0.5) * 40, vy: 160, r: 0.9, life: 0, max: 3, color: '#8a4b2a' });
        this.add({ kind: 'text', v: null, x: v.x, y: top + 4, vx: 0, vy: 6, r: 0, life: 0, max: 1.4, color: '#c0392b', text: 'Puk!' });
      }
      if (f.spill > 0) {
        for (let k = 0; k < Math.min(10, 2 + f.spill); k += 1) this.add({ kind: 'drop', v: null, x: v.x + (Math.random() < 0.5 ? -1 : 1) * (v.shape.R + 0.3), y: top, vx: (Math.random() - 0.5) * 6, vy: 0, r: 0.12, life: 0, max: 1.5, color: 'rgba(170,208,238,0.8)' });
      }
    }
    /* Die Bürette tropft. */
    for (const b of lab.vessels) {
      if (b.kind !== 'burette' || b.drip <= 0 || b.liquidMl() <= 0) continue;
      const n = this.count(`${b.id}:t`, Math.min(12, b.drip * 20 * speed), dt);
      for (let k = 0; k < n; k += 1) this.add({ kind: 'drop', v: null, x: b.x, y: b.y - 0.8, vx: 0, vy: -5, r: 0.12, life: 0, max: 2, color: 'rgba(170,208,238,0.9)' });
    }
  }

  /** Bewegen (echte Zeit). */
  update(lab: Lab, dt: number): void {
    const keep: Particle[] = [];
    for (const p of this.list) {
      p.life += dt;
      if (p.life > p.max) continue;
      switch (p.kind) {
        case 'bubble': {
          const v = p.v;
          if (v === null) break;
          const level = v.level();
          p.vy = 5 + p.r * 30;
          p.y += p.vy * dt;
          p.x += Math.sin(p.life * 9 + p.seed * 7) * 0.6 * dt;
          const hw = v.shape.halfWidth(p.y) - p.r - 0.12;
          if (p.x > hw) p.x = hw;
          if (p.x < -hw) p.x = -hw;
          if (p.y >= level - p.r * 0.5 || !v.wet()) {
            keep.push({ ...p, kind: 'ring', y: level, life: 0, max: 0.18 });
            continue;
          }
          break;
        }
        case 'flake': {
          const v = p.v;
          if (v === null) break;
          p.y += p.vy * dt;
          p.x += Math.sin(p.life * 2 + p.seed * 9) * 0.25 * dt + (v.stir > 0 ? Math.sin(p.life * 3) * 2 * dt : 0);
          if (p.y < 0.1 || p.y > v.level()) continue;
          break;
        }
        case 'swirl': p.x += p.vx * dt; p.y += p.vy * dt; p.r += 1.1 * dt; break;
        case 'steam': case 'smoke': p.x += p.vx * dt; p.y += p.vy * dt; p.r += (p.kind === 'smoke' ? 1.6 : 1.3) * dt; p.vx *= 0.98; break;
        case 'flame': p.x += p.vx * dt; p.y += p.vy * dt; p.r *= 1 - 1.8 * dt; break;
        case 'spark': p.vy -= 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'drop': {
          p.vy -= 981 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y <= 0) continue;
          const into = lab.vessels.find((v) => v.wet() && Math.abs(p.x - v.x) < v.shape.halfWidth(v.level()) && p.y < v.y + v.level() && p.y > v.y);
          if (into !== undefined && p.vy < 0) continue;
          break;
        }
        case 'cork': p.vy -= 981 * dt; p.x += p.vx * dt; p.y = Math.max(0.4, p.y + p.vy * dt); if (p.y <= 0.4) { p.vx *= 0.9; p.vy = Math.abs(p.vy) * 0.3; } break;
        case 'text': p.y += p.vy * dt; break;
        default: break;
      }
      keep.push(p);
    }
    this.list.length = 0;
    this.list.push(...keep);
  }

  /** Was im Gefäss schwimmt (lokale Koordinaten; der Aufrufer hat schon verschoben und beschnitten). */
  drawInside(ctx: CanvasRenderingContext2D, v: Vessel): void {
    for (const p of this.list) {
      if (p.v !== v) continue;
      const a = 1 - p.life / p.max;
      if (p.kind === 'bubble') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fill();
        ctx.lineWidth = Math.max(0.015, p.r * 0.18);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * (1 + p.life * 8), p.r * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${(0.7 * a).toFixed(2)})`;
        ctx.lineWidth = 0.03;
        ctx.stroke();
      } else if (p.kind === 'flake') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.globalAlpha = 1;
      } else if (p.kind === 'swirl') {
        const [r, g, b, al] = rgba(p.color);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, `rgba(${r},${g},${b},${(al * a * 0.7).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Was frei fliegt (Welt-Koordinaten). */
  drawFree(ctx: CanvasRenderingContext2D, font: string, scale: number, dark: boolean): void {
    ctx.save();
    for (const p of this.list) {
      if (p.v !== null) continue;
      const a = 1 - p.life / p.max;
      if (p.kind === 'steam' || p.kind === 'smoke') {
        /* Weisser Dampf vor heller Wand: ein wenig grau, sonst sähe man ihn nicht. */
        const [r, g, b] = p.kind === 'steam' && !dark ? [178, 190, 202] : rgba(p.color);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        const alpha = (p.kind === 'steam' ? 0.35 : 0.5) * a * Math.min(1, p.life * 4);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'drop' || p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.kind === 'spark' ? a : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'cork') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 9 * (p.seed - 0.5));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-0.7, -0.6); ctx.lineTo(0.7, -0.6); ctx.lineTo(0.55, 0.6); ctx.lineTo(-0.55, 0.6); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    /* Leuchtendes zuletzt — auf dunklem Grund addiert, auf hellem mit kräftigen Farben (Weiss auf Weiss sähe niemand). */
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    for (const p of this.list) {
      if (p.v !== null || (p.kind !== 'flame' && p.kind !== 'flash')) continue;
      const a = 1 - p.life / p.max;
      const [r0, g0, b0] = rgba(p.color);
      const white = r0 + g0 + b0 > 690;
      const [r, g, b] = !dark && white ? [255, 214, 120] : [r0, g0, b0];
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(0.05, p.r));
      grad.addColorStop(0, dark ? `rgba(255,255,240,${(0.9 * a).toFixed(3)})` : `rgba(255,250,215,${(0.95 * a).toFixed(3)})`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},${((dark ? 0.7 : 0.85) * a).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.05, p.r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    /* Laute: Text in Bildpunkten (nicht gespiegelt). */
    for (const p of this.list) {
      if (p.kind !== 'text' || p.text === undefined) continue;
      const a = 1 - p.life / p.max;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1 / scale, -1 / scale);
      ctx.font = `700 18px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}

/** Wo der Docht einer Kerze ist (cm über dem Boden), je nachdem, wie viel noch da ist. */
export const candleTop = (v: Vessel, left: number): number => Math.min(v.shape.H * 0.8, 1 + 5 * Math.max(0.15, left)) + 0.6;
