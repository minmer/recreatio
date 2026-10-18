/**
 * 2026-10-18 — POD LUPĄ (Chemia): was in einem Glas wirklich ist, als
 * Teilchen — oben das Gas (Moleküle fliegen, je wärmer, desto schneller;
 * N₂ blau, O₂ rot, CO₂ schwarz mit Rot, H₂ weiss …), unten die Lösung
 * (Wasser blass, Ionen mit ihrer Ladung, gelöste Moleküle, Komplexe).
 *
 * Ändert sich die Zusammensetzung, werden einige Teilchen in jedem Bild
 * umgefärbt — man sieht das Mischen, nicht nur das Ergebnis. Die Lupe liest
 * eine Probe (`sampleOf`): das zusammengezählte Innere eines Glases.
 */

import { COMPLEXES, GASES, GAS_COLORS, POOLS, SPECIES, type GasId } from './chemData';
import { AQ, NC, concOf, complexOf } from './chemAq';
import type { Summary } from './chemWorld';

interface Dot { sp: string; liquid: boolean; x: number; y: number; vx: number; vy: number; a: number }

export interface Share { readonly sp: string; readonly label: string; readonly color: string; readonly value: string }

/** Was die Lupe von einem Glas braucht. */
export interface Sample {
  readonly gas: ReadonlyMap<GasId, number>;
  readonly gasTotal: number;
  readonly solutes: readonly { readonly sp: string; readonly c: number }[];
  readonly wet: boolean;
  readonly look: readonly [number, number, number, number];
  readonly T: number;
}

const ION_PLUS = '#8a5ad0';
const ION_MINUS = '#3c9b55';

/** Die Probe eines Glases aus seiner Zusammenfassung (mit Gleichgewicht der gemischten Lösung). */
export function sampleOf(s: Summary): Sample {
  const gas = new Map<GasId, number>();
  let total = 0;
  GASES.forEach((g, k) => { const n = s.gas[k] ?? 0; if (n > 0) { gas.set(g, n); total += n; } });
  const solutes: { sp: string; c: number }[] = [];
  const spec = s.spec;
  const V = s.ml / 1000;
  if (spec !== null && V > 1e-6) {
    for (let k = 1; k < NC; k += 1) {
      const id = AQ[k];
      const n = s.comp[k];
      if (n <= 0 || id.startsWith('ind:') || id === 'soap') continue;
      const pool = POOLS.find((p) => p.id === id);
      if (pool !== undefined) {
        pool.forms.forEach((f, i) => { const c = (n / V) * (spec.alpha[pool.id][i] ?? 0); if (c > 1e-6) solutes.push({ sp: f, c }); });
        continue;
      }
      const c = concOf(s.comp, 0, spec, id);
      if (c > 1e-6) solutes.push({ sp: id, c });
      for (const cx of COMPLEXES) {
        if (cx.metal !== id) continue;
        const cc = complexOf(s.comp, 0, spec, cx.id, id);
        if (cc > 1e-6) solutes.push({ sp: cx.id, c: cc });
      }
    }
    if (spec.h > 1e-4) solutes.push({ sp: 'H+', c: spec.h });
    if (spec.oh > 1e-4) solutes.push({ sp: 'OH-', c: spec.oh });
  }
  solutes.sort((a, b) => b.c - a.c);
  return { gas, gasTotal: total, solutes, wet: s.ml > 0.05, look: [s.look[0], s.look[1], s.look[2], s.look[3]], T: s.T };
}

const num = (x: number, d = 2): string => (x >= 0.01 || x === 0 ? x.toFixed(d) : x.toExponential(1)).replace('.', ',');

/** Die Anteile zum Zeigen (Gas in %, Lösung in mol/dm³). */
export function shares(s: Sample): { gas: Share[]; liquid: Share[] } {
  const gas: Share[] = [];
  for (const g of GASES) {
    const n = s.gas.get(g) ?? 0;
    if (s.gasTotal <= 0 || n / s.gasTotal < 0.0005) continue;
    gas.push({ sp: g, label: SPECIES[g]?.formula ?? g, color: GAS_COLORS[g], value: `${num((100 * n) / s.gasTotal, n / s.gasTotal < 0.01 ? 2 : 1)} %` });
  }
  gas.sort((a, b) => parseFloat(b.value.replace(',', '.')) - parseFloat(a.value.replace(',', '.')));
  const liquid = s.solutes.slice(0, 8).map((x): Share => ({ sp: x.sp, label: SPECIES[x.sp]?.formula ?? x.sp, color: colorOf(x.sp), value: `${num(x.c, 3)} mol/dm³` }));
  return { gas, liquid };
}

function colorOf(sp: string): string {
  const s = SPECIES[sp];
  if (s?.aqColor !== undefined) return s.aqColor;
  if (GASES.includes(sp as GasId)) return GAS_COLORS[sp as GasId];
  if (sp === 'CO2(aq)') return GAS_COLORS.CO2;
  if (sp === 'NH3(aq)') return GAS_COLORS.NH3;
  if (sp === 'SO2(aq)') return GAS_COLORS.SO2;
  if (sp === 'H+') return '#d0202a';
  if (sp === 'OH-') return '#2878c8';
  const z = s?.charge ?? 0;
  return z > 0 ? ION_PLUS : z < 0 ? ION_MINUS : '#8c8c8c';
}

/** Wie viele Teilchen je Art (die grössten Reste bekommen eines mehr; jede sichtbare Art mindestens eines). */
function counts(items: readonly { sp: string; w: number }[], total: number): Map<string, number> {
  const sum = items.reduce((a, i) => a + i.w, 0);
  const out = new Map<string, number>();
  if (sum <= 0) return out;
  let left = total;
  const rest: { sp: string; r: number }[] = [];
  for (const i of items) {
    const exact = (i.w / sum) * total;
    const n = Math.max(1, Math.floor(exact));
    out.set(i.sp, n);
    left -= n;
    rest.push({ sp: i.sp, r: exact - Math.floor(exact) });
  }
  rest.sort((a, b) => b.r - a.r);
  for (let k = 0; k < rest.length && left > 0; k += 1, left -= 1) out.set(rest[k].sp, (out.get(rest[k].sp) ?? 0) + 1);
  return out;
}

export class Micro {
  private dots: Dot[] = [];
  private key: string | null = null;

  /** Die Teilchen der Probe angleichen (ein paar je Bild — man sieht das Mischen). */
  sync(key: string, s: Sample, dt: number): void {
    const hasGas = s.gasTotal > 0;
    const wet = s.wet;
    if (this.key !== key) { this.dots = []; this.key = key; }
    const gasItems = hasGas ? GASES.map((g) => ({ sp: g as string, w: s.gas.get(g) ?? 0 })).filter((i) => i.w / Math.max(1e-12, s.gasTotal) >= 0.006) : [];
    const sol = wet ? s.solutes.filter((x) => x.c >= 5e-4).slice(0, 7) : [];
    const solTotal = sol.reduce((a, x) => a + x.c, 0);
    const want = new Map<string, number>();
    for (const [sp, n] of counts(gasItems, hasGas ? (wet ? 26 : 44) : 0)) want.set(`g:${sp}`, n);
    if (wet) {
      want.set('l:H2O', 22);
      const room = Math.min(18, Math.round(4 + Math.log10(1 + solTotal * 40) * 9));
      for (const [sp, n] of counts(sol.map((x) => ({ sp: x.sp, w: Math.sqrt(x.c) })), room)) want.set(`l:${sp}`, n);
    }
    const have = new Map<string, Dot[]>();
    for (const d of this.dots) { const k = `${d.liquid ? 'l' : 'g'}:${d.sp}`; have.set(k, [...(have.get(k) ?? []), d]); }
    let changes = Math.max(1, Math.round(dt * 40));
    for (const [k, list] of have) {
      const extra = list.length - (want.get(k) ?? 0);
      for (let i = 0; i < extra && changes > 0; i += 1) { this.dots.splice(this.dots.indexOf(list[i]), 1); changes -= 1; }
    }
    const split = hasGas && wet ? 0.45 : hasGas ? 1 : 0;
    for (const [k, n] of want) {
      const missing = n - (have.get(k)?.length ?? 0);
      for (let i = 0; i < missing && changes > 0; i += 1) {
        const liquid = k.startsWith('l:');
        const fresh = this.dots.length > 4;
        this.dots.push({
          sp: k.slice(2), liquid,
          x: Math.random(),
          y: liquid ? (fresh ? split + 0.02 : split + Math.random() * (1 - split)) : (fresh && wet ? split - 0.03 : Math.random() * split),
          vx: Math.random() - 0.5, vy: Math.random() - 0.5, a: Math.random() * Math.PI * 2
        });
        changes -= 1;
      }
    }
    const speed = Math.sqrt(s.T / 293);
    for (const d of this.dots) {
      if (d.liquid) {
        d.vx += (Math.random() - 0.5) * 2.4 * dt;
        d.vy += (Math.random() - 0.5) * 2.4 * dt;
        d.vx *= 0.9; d.vy *= 0.9;
        d.x += d.vx * dt * 0.25 * speed;
        d.y += d.vy * dt * 0.25 * speed;
        if (d.y < split + 0.03) { d.y = split + 0.03; d.vy = Math.abs(d.vy); }
        if (d.y > 0.97) { d.y = 0.97; d.vy = -Math.abs(d.vy); }
      } else {
        const m = Math.sqrt(29 / (SPECIES[d.sp]?.M ?? 29));
        d.x += d.vx * dt * 0.6 * speed * m;
        d.y += d.vy * dt * 0.6 * speed * m;
        if (d.y < 0.03) { d.y = 0.03; d.vy = Math.abs(d.vy); }
        if (d.y > split - 0.03) { d.y = split - 0.03; d.vy = -Math.abs(d.vy); }
      }
      if (d.x < 0.03) { d.x = 0.03; d.vx = Math.abs(d.vx); }
      if (d.x > 0.97) { d.x = 0.97; d.vx = -Math.abs(d.vx); }
      d.a += dt * (d.liquid ? 0.8 : 2.5);
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: Sample, dark: boolean): void {
    ctx.clearRect(0, 0, w, h);
    const split = s.gasTotal > 0 && s.wet ? 0.45 : s.gasTotal > 0 ? 1 : 0;
    ctx.fillStyle = dark ? '#1b2228' : '#f4f8fb';
    ctx.fillRect(0, 0, w, h);
    if (s.wet) {
      ctx.fillStyle = `rgba(${s.look[0] | 0},${s.look[1] | 0},${s.look[2] | 0},${Math.min(0.5, s.look[3] + 0.12).toFixed(2)})`;
      ctx.fillRect(0, split * h, w, h - split * h);
      ctx.strokeStyle = 'rgba(80,140,200,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, split * h); ctx.lineTo(w, split * h); ctx.stroke();
    }
    const unit = Math.max(3, Math.min(w, h) / 34);
    for (const d of this.dots) drawDot(ctx, d, d.x * w, d.y * h, unit, dark);
  }
}

function drawDot(ctx: CanvasRenderingContext2D, d: Dot, x: number, y: number, u: number, dark: boolean): void {
  const atom = (dx: number, dy: number, r: number, color: string) => {
    const c = Math.cos(d.a);
    const s = Math.sin(d.a);
    ctx.beginPath();
    ctx.arc(x + dx * c - dy * s, y + dx * s + dy * c, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  };
  const sp = d.sp;
  const O = '#d64a4a';
  const Hh = '#f2f2f2';
  switch (sp) {
    case 'H2O': case 'H2O(g)': ctx.globalAlpha = d.liquid ? 0.35 : 0.9; atom(0, 0, u * 0.8, O); atom(-u * 0.75, u * 0.5, u * 0.45, Hh); atom(u * 0.75, u * 0.5, u * 0.45, Hh); ctx.globalAlpha = 1; return;
    case 'N2': atom(-u * 0.55, 0, u * 0.75, GAS_COLORS.N2); atom(u * 0.55, 0, u * 0.75, GAS_COLORS.N2); return;
    case 'O2': atom(-u * 0.55, 0, u * 0.75, O); atom(u * 0.55, 0, u * 0.75, O); return;
    case 'H2': atom(-u * 0.4, 0, u * 0.5, Hh); atom(u * 0.4, 0, u * 0.5, Hh); return;
    case 'Ar': atom(0, 0, u * 0.85, GAS_COLORS.Ar); return;
    case 'CO2': case 'CO2(aq)': atom(-u * 1.05, 0, u * 0.7, O); atom(u * 1.05, 0, u * 0.7, O); atom(0, 0, u * 0.8, '#333333'); return;
    case 'CH4': atom(0, 0, u * 0.8, '#333333'); atom(-u * 0.8, -u * 0.4, u * 0.42, Hh); atom(u * 0.8, -u * 0.4, u * 0.42, Hh); atom(0, u * 0.85, u * 0.42, Hh); return;
    case 'NH3': case 'NH3(aq)': atom(-u * 0.75, u * 0.45, u * 0.45, Hh); atom(u * 0.75, u * 0.45, u * 0.45, Hh); atom(0, -u * 0.75, u * 0.45, Hh); atom(0, 0, u * 0.8, '#4a6cd6'); return;
    case 'HCl(g)': atom(-u * 0.6, 0, u * 0.9, '#4fae5f'); atom(u * 0.6, 0, u * 0.5, Hh); return;
    case 'SO2': case 'SO2(aq)': atom(-u * 0.95, u * 0.4, u * 0.65, O); atom(u * 0.95, u * 0.4, u * 0.65, O); atom(0, 0, u * 0.85, '#e0c020'); return;
    case 'NO': atom(-u * 0.5, 0, u * 0.7, '#4a6cd6'); atom(u * 0.5, 0, u * 0.7, O); return;
    case 'NO2': atom(-u * 0.9, u * 0.4, u * 0.65, O); atom(u * 0.9, u * 0.4, u * 0.65, O); atom(0, 0, u * 0.75, '#4a6cd6'); return;
    default: break;
  }
  const s = SPECIES[sp];
  const z = s?.charge ?? 0;
  const r = u * (sp.includes('(') || (s?.M ?? 40) > 90 ? 1.25 : 0.95);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = colorOf(sp);
  ctx.fill();
  if (z !== 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(r * 1.4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(z > 0 ? '+' : '−', x, y + 0.5);
  }
}
