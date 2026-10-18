/**
 * 2026-10-18 — HINEINGEBEN (Chemia): ein Reagenz aus dem Regal in ein Glas
 * (es fällt durch die Öffnung) oder an einen Punkt, eine Szene, die ihre
 * Gläser gleich unten füllt (und zu einer Lösung mischt), Umgiessen ohne
 * Bewegung, ein Glas voll Gas. Funktionen der Welt (`World.add` …).
 */

import { reagentOf } from './chemData';
import { ETHANOL, NC, WATER, aqLook, aqVolume, bottleOf, formHeat, specOf, type Bottle } from './chemAq';
import { holdsGas } from './chemAir';
import { fallSolids, moveLiquid } from './chemFlow';
import { CELL, F, GASI, L, NG, SOLI, SOL_CM, SOL_M, SOL_RHO, type Form } from './chemGrid';
import { mouthOf, toLocal, type Thing, type ThingKind } from './chemThings';
import { settleGas } from './chemKinetics';
import type { World } from './chemWorld';

const R = 8.314;
const num1 = (x: number): string => x.toFixed(x < 10 && x > -10 ? 1 : 0).replace('.', ',').replace('-', '−');

/**
 * EIN REAGENZ: in ein Glas (es fällt durch die Öffnung hinein) oder an einen
 * Punkt. Gramm (fest), cm³ (Lösung, Flüssigkeit, Gas) oder Tropfen. `settled`:
 * gleich unten im Glas (zum Füllen einer Szene).
 */
export function addReagent(w: World, id: string, amount: number, to: Thing | null, at: readonly [number, number] | null = null, settled = false): boolean {
  const r = reagentOf(id);
  if (r === undefined || !(amount > 0)) return false;
  const T = r.T !== undefined ? r.T + 273.15 : r.solid === 'ice' ? 263.15 : w.room.T;
  const point = to !== null ? mouthOf(to) : at;
  if (point === null) return false;
  const say = (unit: string) => w.say(`act:${w.time.toFixed(2)}:${id}`, `→ Dodano ${r.name} (${num1(amount)} ${unit}).`, w.g.at(point[0], point[1]));
  if (r.form === 'solution' || r.form === 'liquid' || r.form === 'indicator') {
    const b = bottleOf(r);
    if (b === null) return false;
    const ml = r.form === 'indicator' ? amount * 0.05 : amount;
    if (settled && to !== null) fillSettled(w, to, b, ml, T); else spill(w, b, ml, T, point[0], point[1], to);
    if (!settled) say(r.form === 'indicator' ? (amount === 1 ? 'kropla' : 'krople') : 'cm³');
  } else if (r.form === 'gas' && r.solid !== undefined) {
    const n = (w.room.p * amount) / 1000 / (R * w.room.T);
    const gi = GASI[r.solid];
    if (gi === undefined) return false;
    /* Eine Szene füllt das Glas von unten; sonst strömt das Gas aus der Flasche (etwa 100 cm³/s) und verdrängt die Luft. */
    if (settled && to !== null) fillGas(w, to, gi, n);
    else w.streams.push({ to, x: point[0], y: point[1], gi, left: n });
    if (!settled) say('cm³');
  } else if (r.solid !== undefined) {
    const s = SOLI[r.solid];
    if (s === undefined) return false;
    if (r.form === 'piece' || r.form === 'ribbon' || r.form === 'candle') {
      const kind: ThingKind = r.form === 'candle' ? 'candle' : 'piece';
      /* Eis kommt in Würfeln zu etwa 10 g. */
      const n = r.solid === 'ice' ? Math.max(1, Math.round(amount / 10)) : 1;
      for (let k = 0; k < n; k += 1) {
        const x = point[0] + (k - (n - 1) / 2) * 1.2;
        const t = w.place(kind, `${r.solid}-${Math.round(w.time * 100)}-${w.things.length}`, { x, y: settled && to?.prof ? to.y + to.prof.t : point[1] - 0.6, size: amount / n, of: r.solid, ...(to !== null && to.prof !== null ? { within: to } : {}) });
        for (const i of t.cells) w.g.T[i] = T;
        if (settled) w.drop(t);
      }
    } else {
      const form: Form = r.form === 'granules' ? F.granules : r.form === 'crystals' ? F.crystals : F.powder;
      sprinkle(w, s, amount / SOL_M[s], form, T, point[0], point[1], to);
      if (settled) settleSolids(w);
    }
    if (!settled) say('g');
  }
  w.poke();
  return true;
}

/** Was eben hineingestreut wurde, liegt gleich unten (eine Szene füllen, eine gespeicherte laden). */
export function settleSolids(w: World): void {
  for (let k = 0; k < 120; k += 1) fallSolids(w.g, 1, () => 0);
}

/** Flüssigkeit an einem Punkt: in die freien Zellen ringsum (sie fällt dann). */
export function spill(w: World, b: Bottle, ml: number, T: number, x: number, y: number, into: Thing | null = null): void {
  const g = w.g;
  const start = g.at(x, y);
  if (start < 0) return;
  let left = ml;
  const seen = new Set<number>([start]);
  const q = [start];
  const ok = within(w, into);
  for (let k = 0; k < q.length && left > 1e-9 && k < 6000; k += 1) {
    const i = q[k];
    left -= pourInto(w, i, b, left, T);
    for (const j of [i - g.w, i - 1, i + 1, i + g.w]) {
      if (j < 0 || j >= g.n || seen.has(j) || g.wall(j) || !ok(j)) continue;
      if (Math.abs((j % g.w) - (i % g.w)) > 1) continue;
      seen.add(j);
      q.push(j);
    }
  }
}

/** Was beim Hineingeben in ein Glas in Frage kommt: sein Inneres und die Säule über seiner Öffnung. */
export function within(w: World, t: Thing | null): (i: number) => boolean {
  if (t === null || t.prof === null) return () => true;
  const p = t.prof;
  const mouth = p.half(p.top - CELL * 0.5);
  return (i: number) => {
    const [xl, yl] = toLocal(t, w.g.cx(i), w.g.cy(i));
    return Math.abs(xl) < p.half(yl) || (yl >= p.top - CELL && Math.abs(xl) < mouth);
  };
}

/** Eine Szene füllt ein Glas: die Flüssigkeit liegt gleich unten. */
export function fillSettled(w: World, t: Thing, b: Bottle, ml: number, T: number): void {
  const g = w.g;
  const cells = t.cells.filter((i) => g.own[i] === t.num && g.mat[i] === 0 && g.sform[i] !== F.piece).sort((a, c) => g.cy(a) - g.cy(c) || g.cx(a) - g.cx(c));
  let left = ml;
  for (const i of cells) { if (left <= 1e-9) break; left -= pourInto(w, i, b, left, T, true); }
  if (left > 1e-6) spill(w, b, left, T, ...mouthOf(t), t);
}

/**
 * Die Flüssigkeit eines Glases gleichmässig machen — eine Szene füllt eine
 * fertige Lösung (Lauge mit Fenoloftaleina), keine Schichten. Was beim
 * Mischen frei wird (Formenwärme), bleibt als Wärme in der Lösung.
 */
export function blend(w: World, t: Thing): void {
  const g = w.g;
  const cells = t.cells.filter((i) => g.own[i] === t.num && g.lq[i] === L.aq);
  if (cells.length === 0) return;
  const total = new Float64Array(NC);
  let vol = 0;
  let hf = 0;
  let C = 0;
  let CT = 0;
  for (const i of cells) {
    const o = i * NC;
    for (let k = 0; k < NC; k += 1) total[k] += g.comp[o + k];
    vol += aqVolume(g.comp, o);
    hf += g.hf[i];
    const c = g.cap(i);
    C += c;
    CT += c * g.T[i];
  }
  if (vol <= 1e-9) return;
  const T = CT / C;
  const spec = specOf(total, 0, T, null);
  const look = new Float32Array(4);
  const shares = cells.map((i) => aqVolume(g.comp, i * NC) / vol);
  cells.forEach((i, n) => {
    const o = i * NC;
    for (let k = 0; k < NC; k += 1) g.comp[o + k] = total[k] * shares[n];
    g.spec[i] = spec;
    g.specT[i] = T;
    g.chg[i] = 0;
    g.T[i] = T;
    const h = formHeat(g.comp, o, spec);
    g.q[i] += hf * shares[n] - h;
    g.hf[i] = h;
    aqLook(g.comp, o, spec, look);
    g.look.set(look, i * 4);
  });
  for (const i of cells) g.applyQ(i);
}

/** So viel Flüssigkeit aus der Flasche in eine Zelle, wie hineinpasst — gibt die cm³ zurück (`calm`: ohne Aufwirbeln — eine Szene beginnt ruhig). */
function pourInto(w: World, i: number, b: Bottle, ml: number, T: number, calm = false): number {
  const g = w.g;
  if (g.lq[i] === L.melt || g.wall(i)) return 0;
  const v = Math.min(ml, g.room(i) - g.liqVol(i));
  if (v <= 1e-7) return 0;
  const o = i * NC;
  const fresh = g.lq[i] !== L.aq;
  g.mixHeat(i, v * (b.comp[WATER] * 75.3 + b.comp[ETHANOL] * 112), T);
  for (let k = 0; k < NC; k += 1) g.comp[o + k] += b.comp[k] * v;
  g.hf[i] += b.hf * v;
  g.lq[i] = L.aq;
  if (fresh) {
    g.spec[i] = b.spec;
    g.specT[i] = g.T[i];
    g.chg[i] = 0;
    const look = new Float32Array(4);
    aqLook(g.comp, o, b.spec, look);
    g.look.set(look, i * 4);
  } else g.touch(i, 1);
  if (!calm) g.turb[i] = Math.max(g.turb[i], 0.35);
  /* Die Luft, die das Wasser verdrängt, steigt in die Zelle darüber (CO₂ in einer Zlewka wird nach oben geschoben) — sie
     wird keine Blase, die beim ersten Schritt durch die frisch gefüllte Lösung perlt und Schichten verrührt. */
  const n = g.gasTotal(i);
  const keep = (w.room.p * g.gasVol(i)) / (R * g.T[i]) / 1000;
  if (n > keep) {
    const up = i + g.w;
    if (up < g.n && holdsGas(g, up)) g.moveGas(i, up, n - keep);
    else { const f = keep / n; for (let k = 0; k < NG; k += 1) g.gas[i * NG + k] *= f; }
  }
  return v;
}

/** Körner, Pulver, Kristalle an einem Punkt (sie fallen dann). */
export function sprinkle(w: World, s: number, n: number, form: Form, T: number, x: number, y: number, into: Thing | null): void {
  const g = w.g;
  const start = g.at(x, y);
  if (start < 0) return;
  let left = n;
  const seen = new Set<number>([start]);
  const q = [start];
  const ok = within(w, into);
  for (let k = 0; k < q.length && left > 1e-12 && k < 4000; k += 1) {
    const i = q[k];
    if (!g.wall(i) && (g.sp[i] < 0 || (g.sp[i] === s && g.sform[i] === form))) {
      const capMol = (g.vol(i) * 0.6 * 0.62 * SOL_RHO[s]) / SOL_M[s] - (g.sp[i] === s ? g.sn[i] : 0);
      const put = Math.min(left, capMol);
      if (put > 0) {
        g.mixHeat(i, put * SOL_CM[s], T);
        if (g.sp[i] < 0) { g.sp[i] = s; g.sform[i] = form; }
        g.sn[i] += put;
        left -= put;
      }
    }
    for (const j of [i + g.w, i - 1, i + 1, i - g.w]) {
      if (j < 0 || j >= g.n || seen.has(j) || g.wall(j) || !ok(j)) continue;
      if (Math.abs((j % g.w) - (i % g.w)) > 1) continue;
      seen.add(j);
      q.push(j);
    }
  }
}

/**
 * UMGIESSEN OHNE BEWEGUNG (für den Aufbau einer Szene und „vorher”): `ml`
 * Flüssigkeit von oben aus einem Glas unten in ein anderes — mit dem
 * schwebenden Niederschlag. Gibt zurück, wie viel umgegossen wurde.
 */
export function transfer(w: World, from: Thing, to: Thing, ml: number): number {
  const g = w.g;
  const inner = (t: Thing) => t.cells.filter((i) => g.own[i] === t.num && g.mat[i] === 0 && g.sform[i] !== F.piece);
  const src = inner(from).filter((i) => g.lq[i] === L.aq).sort((a, b) => g.cy(b) - g.cy(a));
  const dst = inner(to).sort((a, b) => g.cy(a) - g.cy(b) || g.cx(a) - g.cx(b));
  let left = ml;
  let k = 0;
  for (const j of dst) {
    if (left <= 1e-9) break;
    if (g.lq[j] === L.melt) continue;
    let room = g.room(j) - g.liqVol(j);
    while (room > 1e-7 && left > 1e-9 && k < src.length) {
      const i = src[k];
      const v = g.liqVol(i);
      if (v <= 1e-9 || g.lq[i] !== L.aq) { k += 1; continue; }
      const take = Math.min(v, room, left);
      moveLiquid(g, i, j, take / v);
      room -= take;
      left -= take;
      if (take >= v - 1e-9) k += 1;
    }
    if (k >= src.length) break;
  }
  w.poke();
  return ml - left;
}

/** Ein Glas von unten mit einem Gas füllen (die Luft darin wird ersetzt). */
export function fillGas(w: World, t: Thing, gi: number, n: number): void {
  const g = w.g;
  const cells = t.cells.filter((i) => g.own[i] === t.num && g.mat[i] === 0 && holdsGas(g, i)).sort((a, b) => g.cy(a) - g.cy(b));
  let left = n;
  for (const i of cells) {
    if (left <= 0) break;
    const cap = (w.room.p * g.gasVol(i)) / (R * g.T[i]) / 1000;
    const put = Math.min(cap, left);
    const keep = Math.max(0, 1 - put / cap);
    for (let k = 0; k < NG; k += 1) g.gas[i * NG + k] *= keep;
    g.gas[i * NG + gi] += put;
    /* Was sich in der Flasche schon verbunden hat (2NO₂ → N₂O₄), nimmt weniger Platz: nachfüllen, bis der Druck wieder der des Zimmers ist. */
    for (let k = 0; k < 6; k += 1) {
      settleGas(g, i);
      const lack = cap - g.gasTotal(i);
      if (lack <= cap * 1e-4) break;
      g.gas[i * NG + gi] += lack;
    }
    left -= put;
  }
}

/**
 * Ein Glas voll einer Gasmischung (`x`: Anteile je Gas, Summe 1) — überall dieselbe, schon im Gleichgewicht (2NO₂ ⇄ N₂O₄)
 * und beim Druck des Zimmers. Wer Gase einzeln von unten einfüllte, bekäme Schichten, die sich erst mischen — und
 * NO₂, das sich mit Luft verdünnt, zerfiele aus N₂O₄ nach: im verschlossenen Glas stiege der Druck.
 */
export function fillGasMix(w: World, t: Thing, x: ArrayLike<number>): void {
  const g = w.g;
  for (const i of t.cells) {
    if (g.own[i] !== t.num || g.mat[i] !== 0 || !holdsGas(g, i)) continue;
    const cap = (w.room.p * g.gasVol(i)) / (R * g.T[i]) / 1000;
    for (let k = 0; k < NG; k += 1) g.gas[i * NG + k] = cap * x[k];
    for (let r = 0; r < 8; r += 1) {
      settleGas(g, i);
      const lack = cap - g.gasTotal(i);
      if (Math.abs(lack) <= cap * 1e-4) break;
      for (let k = 0; k < NG; k += 1) g.gas[i * NG + k] += lack * x[k];
    }
  }
}

/** Die unterste Zelle im Inneren eines Glases. */
export function lowest(w: World, t: Thing): number {
  const g = w.g;
  let best = -1;
  for (const i of t.cells) if (g.own[i] === t.num && g.mat[i] === 0 && g.sform[i] !== F.piece && (best < 0 || g.cy(i) < g.cy(best))) best = i;
  return best;
}

/** Die unterste Zelle mit Gas im Inneren eines Glases (dort strömt Gas aus der Flasche ein). */
export function lowestGas(w: World, t: Thing): number {
  const g = w.g;
  let best = -1;
  for (const i of t.cells) if (g.own[i] === t.num && g.mat[i] === 0 && holdsGas(g, i) && (best < 0 || g.cy(i) < g.cy(best))) best = i;
  return best;
}
