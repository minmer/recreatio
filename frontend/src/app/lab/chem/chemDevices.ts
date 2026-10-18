/**
 * 2026-10-18 — WAS DIE DINGE TUN (Chemia): der Brenner bläst Methan und Luft
 * aus seinem Rohr, die Flamme sitzt auf dem Rand; die Heizplatte heizt ihre
 * Platte (Regler bei 450 °C) und rührt, was auf ihr steht; die Kerze brennt
 * an ihrem Docht; der Draht nimmt ein Salz auf und färbt die Flamme; das
 * Thermometer misst, was seine Kugel umgibt; die Bürette tropft. Stücke sinken
 * oder schwimmen, ein Stopfen fliegt bei 40 kPa Überdruck.
 */

import { SPECIES } from './chemData';
import { AQI, NC, aqDensity } from './chemAq';
import type { ChemCtx } from './chemCell';
import { FLAME_IONS, burnCandle, emit } from './chemFire';
import { AIR_X, CELL, F, GASI, Grid, L, NG, SOLI, SOL_RHO, SOL_RHOL } from './chemGrid';
import { nozzleOf, prunePiece, relocate, tipOf, toWorld, wickOf } from './chemThings';
import type { World } from './chemWorld';

const name = (id: string): string => SPECIES[id]?.name ?? id;

const FLAME_WORD: Readonly<Record<string, string>> = {
  'Na+': 'intensywnie żółto', 'K+': 'fioletowo', 'Li+': 'karminowo', 'Ca+2': 'ceglastoczerwono', 'Sr+2': 'czerwono', 'Ba+2': 'zielono', 'Cu+2': 'niebieskozielono'
};

const flameText = (ion: string): string => `Płomień barwi się na ${FLAME_WORD[ion] ?? 'inny kolor'} — ${name(ion)}.`;

/** Eine Zelle voll Flüssigkeit (mindestens halb) — nicht ein Tröpfchen Tau. */
const wetCell = (g: Grid, i: number): boolean => g.lq[i] !== L.none && g.liqVol(i) > 0.5 * g.room(i);


/** Ein Stopfen hält, bis der Druck im Glas 40 kPa über dem des Zimmers ist — dann fliegt er. */
export function corks(w: World): void {
  for (const s of [...w.things]) {
    if (s.kind !== 'stopper' || s.onto === null) continue;
    const t = w.thing(s.onto);
    if (t === undefined || t.prof === null) continue;
    const [x, y] = toWorld(t, 0, t.prof.top - 1.6);
    const i = w.g.at(x, y);
    if (i < 0) continue;
    const P = w.air.pressureOf(i);
    if (P > w.room.p + 40) {
      w.remove(s);
      w.say(`cork:${Math.floor(w.time)}`, 'Za duże ciśnienie — korek wyskakuje z naczynia!', i);
      w.pops.push({ x, y: y + 2, t: w.time });
    }
  }
}

/** Was die Dinge selbst tun: Brenner, Heizplatte (mit Rührer), Kerze, Draht, Thermometer, Bürette. */
export function devicesStep(w: World, ctx: ChemCtx): void {
  const g = w.g;
  for (const t of w.things) {
    switch (t.kind) {
      case 'burner': {
        if (!t.on) break;
        const i = g.at(...nozzleOf(t));
        if (i < 0) break;
        const ch4 = 1.4e-3 * Math.max(0.05, t.flow) * ctx.dt;
        const air = (2 * ch4 * 0.95 * t.air) / 0.207;
        g.mixHeat(i, ch4 * 35.7 + air * 29.1, w.room.T);
        g.gas[i * NG + GASI.CH4] += ch4;
        for (let k = 0; k < NG; k += 1) g.gas[i * NG + k] += air * AIR_X[k];
        g.turb[i] = Math.max(g.turb[i], 0.6);
        break;
      }
      case 'hotplate': {
        /* Der Magnetrührer: was auf der Platte steht, wird ständig gerührt (Titration, Lösen). */
        if (t.stir) for (const u of w.carried(t)) if (u.prof !== null) for (const i of u.cells) if (g.lq[i] === L.aq) g.turb[i] = Math.max(g.turb[i], 0.6);
        if (!t.on) break;
        let top = -Infinity;
        for (const i of t.cells) top = Math.max(top, g.cy(i));
        const row = t.cells.filter((i) => Math.abs(g.cy(i) - top) < CELL * 0.5);
        /* Der Regler hält die Platte unter 450 °C. */
        for (const i of row) if (g.T[i] < 723) g.q[i] += (t.air * ctx.dt) / Math.max(1, row.length);
        break;
      }
      case 'candle': t.on = burnCandle(ctx, g.at(...wickOf(t)), t.on); break;
      case 'loop': {
        const i = g.at(...tipOf(t));
        if (i < 0) break;
        for (const j of [i, i - g.w, i - 1, i + 1]) {
          if (j < 0 || g.lq[j] !== L.aq) continue;
          let best = -1;
          let most = 0;
          FLAME_IONS.forEach((ion, k) => { const x = g.comp[j * NC + (AQI[ion] ?? 0)] * [6, 0.6, 1.5, 1, 1.5, 1, 1][k]; if (x > most) { most = x; best = k; } });
          if (best >= 0 && most > 1e-7) { t.sample = FLAME_IONS[best]; t.sampleN = 4e-6; }
          break;
        }
        const ion = t.sample;
        if (ion !== null && t.sampleN > 0) {
          for (const j of [i, i + g.w, i - 1, i + 1]) {
            if (j < 0 || g.T[j] < 950 || g.gasTotal(j) <= 0) continue;
            const d = Math.min(t.sampleN, 1.5e-6 * ctx.dt);
            emit(g, j, FLAME_IONS.indexOf(ion), d);
            t.sampleN -= d;
            w.say(`flame:${ion}`, flameText(ion), j);
            if (t.sampleN <= 1e-12) { t.sample = null; w.forget(`flame:${ion}`); }
            break;
          }
        }
        break;
      }
      case 'thermometer': {
        /* Die Kugel misst, was sie umgibt — nach Wärmekapazität gewichtet (halb in der Flüssigkeit: die Flüssigkeit) und mit gut einer Sekunde Verzögerung. */
        const [bx, by] = tipOf(t);
        let ct = 0;
        let cs = 0;
        for (let k = 0; k < 3; k += 1) {
          const i = g.at(bx, by + k * CELL);
          if (i < 0) continue;
          for (const j of k === 0 ? [i - 1, i + 1, i - g.w] : [i - 1, i + 1]) {
            if (j < 0 || j >= g.n || g.wall(j) || g.own[j] === t.num) continue;
            const c = g.cap(j);
            ct += c * g.T[j];
            cs += c;
          }
        }
        const tip = g.at(bx, by);
        const Tm = (cs > 0 ? ct / cs : tip >= 0 ? g.T[tip] : Number.NaN) - 273.15;
        t.readout = !Number.isFinite(Tm) ? Number.NaN : !Number.isFinite(t.readout) ? Tm : t.readout + (Tm - t.readout) * (1 - Math.exp(-ctx.dt / 1.2));
        break;
      }
      case 'burette': {
        /* Der Hahn: offen fliesst die Flüssigkeit aus der untersten Zelle durch die Spitze hinaus. */
        if (!t.on || t.prof === null) break;
        let low = -1;
        for (const i of t.cells) if (g.own[i] === t.num && g.mat[i] === 0 && (low < 0 || g.cy(i) < g.cy(low))) low = i;
        if (low < 0 || g.lq[low] !== L.aq) break;
        const [tx, ty] = toWorld(t, 0, -CELL * 0.5);
        const out = g.at(tx, ty);
        if (out < 0 || g.wall(out)) break;
        const have = g.liqVol(low);
        const ml = Math.min(have, t.flow * ctx.dt);
        if (ml > 1e-9) { g.moveAq(low, out, ml / have); t.readout = (Number.isFinite(t.readout) ? t.readout : 0) + ml; }
        break;
      }
      default: break;
    }
  }
}

/**
 * Die Flamme sitzt auf dem Rand des Brennerrohrs: wo das ausströmende Gas
 * die Luft trifft, bleibt es heiss genug zum Zünden, solange Sauerstoff da
 * ist — ohne Sauerstoff (ein Glas darüber) geht die Flamme aus.
 */
export function flameBase(w: World): void {
  const g = w.g;
  for (const t of w.things) {
    if (t.kind !== 'burner' || !t.on || !t.lit) continue;
    const i = g.at(...nozzleOf(t));
    if (i < 0) continue;
    let o2 = 0;
    for (const j of [i, i + g.w, i - 1, i + 1]) {
      if (j < 0 || j >= g.n || g.wall(j)) continue;
      const tot = g.gasTotal(j);
      if (tot > 0) o2 = Math.max(o2, g.gas[j * NG + GASI.O2] / tot);
      if (g.gas[j * NG + GASI.CH4] > 0 && g.T[j] < 960) g.T[j] = 960;
    }
    if (o2 < 0.02) t.lit = false;
  }
}

/** Stücke sinken, schwimmen auf, Natrium fährt herum; was geschmolzen oder gelöst ist, verlässt das Stück. */
export function piecesStep(w: World): boolean {
  const g = w.g;
  let moved = false;
  for (const t of [...w.things]) {
    if (t.kind !== 'piece') continue;
    prunePiece(g, w.things, t, w.room.T);
    if (t.cells.length === 0) { w.remove(t); continue; }
    if (t.held) continue;
    const set = new Set(t.cells);
    const sp = SOLI[t.of] ?? -1;
    const rho = sp >= 0 ? SOL_RHO[sp] : 3;
    let support = false;
    let liquid = 0;
    let rhoL = 0;
    let upLiquid = false;
    let fizz = 0;
    for (const i of t.cells) {
      const b = i - g.w;
      /* Was trägt: Wände, andere Stücke, Erstarrtes, ein Haufen Körner — nicht Belag, Niederschlag, Pulver in Wasser. */
      const f = g.sform[b];
      if (b < 0) support = true;
      else if (!set.has(b) && (g.mat[b] !== 0 || (g.sp[b] >= 0 && (f === F.piece || f === F.cast || f === F.granules || f === F.crystals)))) support = true;
      /* Flüssigkeit zählt, wo eine Zelle mindestens halb voll ist — Tau an einem kalten Eiswürfel trägt ihn nicht. */
      for (const j of [i - 1, i + 1, b, i + g.w]) {
        if (j < 0 || j >= g.n || set.has(j)) continue;
        if (wetCell(g, j)) { liquid += 1; rhoL += g.lq[j] === L.aq ? aqDensity(g.comp, j * NC, g.T[j]) : SOL_RHOL[g.msp[j]] ?? 3; }
        fizz += g.fizz[j];
      }
      const up = i + g.w;
      if (up < g.n && !set.has(up) && wetCell(g, up)) upLiquid = true;
    }
    const floats = liquid > 0 && rho < rhoL / liquid;
    let dy = 0;
    if (floats && upLiquid) dy = CELL;
    else if (!support && !floats) dy = -CELL;
    if (dy !== 0 && relocate(g, w.things, [t, ...w.carried(t)], 0, dy, 0, [0, 0], w.room.T)) moved = true;
    if (floats && !upLiquid && fizz > 2e-6 && w.rand() < Math.min(0.6, fizz * 3e4)) {
      if (relocate(g, w.things, [t], w.rand() < 0.5 ? -CELL : CELL, 0, 0, [0, 0], w.room.T)) moved = true;
    }
  }
  return moved;
}
