/**
 * LABOR 2D (v2) — DIE HANDGRIFFE: was eine Szene oder ein Werkzeug in die Welt
 * malt. Ein fester Bau („solid“, Pinsel und Ścianka) besteht aus Zellen des
 * Gitters. Zlewka, Heizplatte und „body“ („Postaw ciało“) sind Körper
 * (bodies.ts): genaue Rechtecke, nicht auf das Gitter gerundet — eine Zlewka
 * aus Boden und zwei Wänden (mit Deckel vier), eine Heizplatte eines mit einer
 * Wärmequelle, ein Körper eines (aus einer Strecke mit Breite: gedreht; ein
 * Kreis wird ein Quadrat gleicher Fläche). Was einen Körper überdeckt
 * (Radieren, ein neuer Bau), schneidet ihn (bodyTools.ts).
 *
 * Was ein Handgriff an Masse und Energie hinzufügt oder wegnimmt, wird als
 * „Eingriff“ gebucht (budget.edits): die Bilanzen schliessen auch über
 * Werkzeuge hinweg.
 */

import { Body2D, meltsAt, type RectWorld } from './body';
import type { Bodies } from './bodies';
import { carveBodies, liftBodies, placeBodies, removeBody } from './bodyTools';
import type { Bubbles } from './bubbles';
import type { Gas } from './gas';
import type { Grid } from './grid';
import type { Heat } from './heat';
import type { Liquid } from './liquid';
import { hLiq, liquidIndex, LIQUIDS, rhoLiq, solidIndex, SOLIDS, WATER } from './materials';
import type { Particles } from './particles';
import { hSol, rhoSol, soluteIndex } from './solution';
import type { Op } from './scene';
import { bounds, inside, type Region } from './shapes';
import { GAS_SPECIES, H2O, N2, O2, SOLID, SPECIES_SLOTS, T0 } from './units';

/** Was ein Handgriff bucht: Wasser-, Gas- und andere Flüssigkeitsmasse (Öl), Salz und Energie, die von aussen kamen (negativ: weggenommen). */
export interface EditLedger {
  water: number;
  air: number;
  energy: number;
  /** Flüssigkeiten ausser Wasser (kg). */
  other: number;
  /** Kochsalz, gelöst oder als Kruste (kg). */
  salt: number;
}

export interface World {
  readonly grid: Grid;
  readonly particles: Particles;
  readonly bubbles: Bubbles;
  readonly gas: Gas;
  readonly heat: Heat;
  readonly liquid: Liquid;
  /** Umgebungsluft als Massenanteile (mit Feuchte) und ihre Temperatur. */
  readonly ambientY: Float64Array;
  readonly ambientT: number;
  readonly ledger: EditLedger;
  /** Die Körper (M3a) und die Nummer des Handgriffs, der gerade ausgeführt wird (sein Schlüssel). */
  readonly bodies: Bodies;
  readonly opIndex: number;
  /** Der Schlüssel (Nummer des Handgriffs, der ihn anlegte) des Gegenstands mit diesem Namen; −1: keiner. */
  objectKey(id: string): number;
  /** Nach einer Änderung der Feststoffe: feste Daten, Gebiete, Kavitäten neu. */
  solidsChanged(): void;
}

/** Den Körpern nehmen, was eine Fläche bedeckt (gebucht), bevor ein neuer Bau sie überschreibt. */
function carve(w: World, region: Region): void {
  if (w.bodies.list.length === 0) return;
  carveBodies(w.bodies, region, w.ledger);
}

/** Teilchen und Blasen, die in einem eben gesetzten Körper liegen: entfernen (gebucht) — der Körper ersetzt, was dort war. */
function clearInside(w: World, b: Body2D): void {
  const l = new Float64Array(2);
  const P = w.particles;
  for (let p = 0; p < P.count; p += 1) {
    Body2D.toLocal(b.x, b.y, b.a, P.x[p], P.y[p], l);
    if (!b.insideLocal(l[0], l[1])) continue;
    unbook(w, p);
    w.liquid.removeParticle(p);
    p -= 1;
  }
  const B = w.bubbles;
  for (let k = 0; k < B.count; k += 1) {
    Body2D.toLocal(b.x, b.y, b.a, B.x[k], B.y[k], l);
    if (!b.insideLocal(l[0], l[1])) continue;
    w.ledger.water -= B.m[k * SPECIES_SLOTS + H2O];
    w.ledger.air -= B.m[k * SPECIES_SLOTS + N2] + B.m[k * SPECIES_SLOTS + O2];
    w.ledger.energy -= B.H[k];
    B.remove(k);
    k -= 1;
  }
  w.liquid.weightsDirty = true;
}

/** Ein Körper aus Rechtecken (Welt, ungedreht) setzen: gebucht mit seiner Energie, gedreht um (px, py), was darin lag, entfernt. */
function placeBody(w: World, rects: readonly RectWorld[], s: number, T: number, pinned: boolean, angle: number, px: number, py: number, heater = -1): Body2D | null {
  const b = w.bodies.adopt(rects, s, T, w.opIndex, pinned, heater);
  if (b === null) return null;
  if (angle !== 0) w.bodies.turn(b, px, py, (angle * Math.PI) / 180);
  w.ledger.energy += b.energy();
  /* Eis ist Wasser (M3b). */
  if (meltsAt(b.mat) > 0) w.ledger.water += b.m;
  clearInside(w, b);
  /* Das Gas, dessen Platz der Körper nun einnimmt, weicht (gebucht) — sonst drückte er es in die Nachbarzellen (ein verschlossenes Gebiet stünde unter Druck). */
  const g = w.grid;
  const cover = new Map<number, number>();
  const A = g.dx * g.dx;
  for (let e = 0; e < b.nw; e += 1) {
    const c = b.wc[e];
    cover.set(c, (cover.get(c) ?? 0) + (b.ww[e] * b.cellVolume(b.wk[e])) / (b.depth * A));
  }
  for (const [c, share] of cover) if (share > 0 && g.solid[c] === 0) dropGasShare(w, c, Math.min(1, share));
  return b;
}

/** Zellen, deren Mitte in der Fläche liegt (Rückgabe über den Rückruf). */
function eachCell(g: Grid, region: Region, fn: (c: number, i: number, j: number) => void): void {
  const [x0, y0, x1, y1] = bounds(region);
  const i0 = Math.max(0, Math.floor(x0 / g.dx));
  const i1 = Math.min(g.nx - 1, Math.ceil(x1 / g.dx));
  const j0 = Math.max(0, Math.floor(y0 / g.dx));
  const j1 = Math.min(g.ny - 1, Math.ceil(y1 / g.dx));
  for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
    if (inside(region, (i + 0.5) * g.dx, (j + 0.5) * g.dx)) fn(i + j * g.nx, i, j);
  }
}

/** Gas einer Zelle entfernen (gebucht). */
function dropGas(w: World, c: number): void {
  const g = w.grid;
  const n = g.n;
  w.ledger.water -= g.mg[H2O * n + c] + g.mfog[c];
  w.ledger.air -= g.mg[N2 * n + c] + g.mg[O2 * n + c];
  w.ledger.energy -= g.Hg[c];
  for (let k = 0; k < SPECIES_SLOTS; k += 1) g.mg[k * n + c] = 0;
  g.mfog[c] = 0;
  g.Hg[c] = 0;
}

/** Den Anteil `share` des Gases einer Zelle entfernen (gebucht) — so viel, wie ein eben gesetzter Körper von ihr füllt. */
function dropGasShare(w: World, c: number, share: number): void {
  if (share >= 1) { dropGas(w, c); return; }
  const g = w.grid;
  const n = g.n;
  w.ledger.water -= share * (g.mg[H2O * n + c] + g.mfog[c]);
  w.ledger.air -= share * (g.mg[N2 * n + c] + g.mg[O2 * n + c]);
  w.ledger.energy -= share * g.Hg[c];
  for (let k = 0; k < SPECIES_SLOTS; k += 1) g.mg[k * n + c] *= 1 - share;
  g.mfog[c] *= 1 - share;
  g.Hg[c] *= 1 - share;
}

/** Eine Zelle mit Gas der Zusammensetzung Y bei T füllen (gebucht; vorher vorhandenes Gas wird ersetzt). */
function putGas(w: World, c: number, T: number, Y: Float64Array): void {
  const g = w.grid;
  const n = g.n;
  dropGas(w, c);
  w.gas.fillCell(c, T, Y, Math.max(1e-3, 1 - g.fs[c] - g.phi[c] - g.alpha[c]));
  w.ledger.water += g.mg[H2O * n + c];
  w.ledger.air += g.mg[N2 * n + c] + g.mg[O2 * n + c];
  w.ledger.energy += g.Hg[c];
}

/** Ein Teilchen als Eingriff ausbuchen (Wasser oder eine andere Flüssigkeit, gelöstes Salz) — vor dem Entfernen. */
function unbook(w: World, p: number): void {
  const P = w.particles;
  const s = P.smass[2 * p];
  if (P.mat[p] === WATER) w.ledger.water -= P.mass[p] - s;
  else w.ledger.other -= P.mass[p] - s;
  w.ledger.salt -= s;
  w.ledger.energy -= P.mass[p] * P.h[p];
}

/** Die Salzkruste einer festen Zelle geht mit ihr hinaus (gebucht; ihre Energie steckt in Es). */
function unbookCrust(w: World, c: number): void {
  w.ledger.salt -= w.grid.crust[c];
  w.grid.crust[c] = 0;
}

/** Teilchen und Blasen in einer Fläche entfernen (gebucht). */
function removeLiquid(w: World, region: Region): void {
  const P = w.particles;
  for (let p = 0; p < P.count; p += 1) {
    if (!inside(region, P.x[p], P.y[p])) continue;
    unbook(w, p);
    w.liquid.removeParticle(p);
    p -= 1;
  }
  const B = w.bubbles;
  for (let b = 0; b < B.count; b += 1) {
    if (!inside(region, B.x[b], B.y[b])) continue;
    w.ledger.water -= B.m[b * SPECIES_SLOTS + H2O];
    w.ledger.air -= B.m[b * SPECIES_SLOTS + N2] + B.m[b * SPECIES_SLOTS + O2];
    w.ledger.energy -= B.H[b];
    B.remove(b);
    b -= 1;
  }
  w.liquid.weightsDirty = true;
}

/** Zellen fest machen (Werkstoff s, Temperatur T); was darin war, wird entfernt (gebucht). */
function makeSolid(w: World, cells: readonly number[], s: number, T: number, heaterGroup: number): void {
  const g = w.grid;
  const mat = SOLIDS[s];
  for (const c of cells) {
    /* Zellen, die ein Körper füllt, bleiben seine (der Aufrufer hat ihn zuvor beschnitten). */
    if (g.owner[c] !== 0 && g.solid[c] !== 0) continue;
    if (g.solid[c] !== 0) {
      w.ledger.energy -= g.Es[c];
      w.ledger.water -= g.film[c];
      unbookCrust(w, c);
    } else {
      dropGas(w, c);
    }
    /* Ein Körperteil in der Zelle gehört weiter dem Körper (seine inneren Zellen): die Zelle selbst wird Bau. */
    g.owner[c] = 0;
    g.capB[c] = 0;
    g.fs[c] = 0;
    g.crust[c] = 0;
    g.solid[c] = s + 1;
    g.role[c] = heaterGroup >= 0 ? 1 : 0;
    g.heater[c] = heaterGroup;
    g.film[c] = 0;
    g.T[c] = T;
    g.Es[c] = mat.rho * mat.cp * g.vCell * (T - T0);
    g.kind[c] = SOLID;
    w.ledger.energy += g.Es[c];
  }
  /* Teilchen in neuen Feststoffzellen: entfernen. */
  const P = w.particles;
  for (let p = 0; p < P.count; p += 1) {
    const c = g.cellAt(P.x[p], P.y[p]);
    if (c < 0 || g.solid[c] === 0) continue;
    unbook(w, p);
    w.liquid.removeParticle(p);
    p -= 1;
  }
  w.solidsChanged();
}

/** Feste Zellen wieder zu Gas machen (gefüllt mit Umgebungsluft). */
function clearSolid(w: World, cells: readonly number[]): void {
  const g = w.grid;
  let any = false;
  for (const c of cells) {
    if (g.solid[c] === 0) continue;
    any = true;
    w.ledger.energy -= g.Es[c];
    w.ledger.water -= g.film[c];
    unbookCrust(w, c);
    g.solid[c] = 0;
    g.role[c] = 0;
    g.heater[c] = -1;
    g.Es[c] = 0;
    g.film[c] = 0;
    g.kind[c] = 0;
  }
  if (!any) return;
  w.solidsChanged();
  for (const c of cells) if (g.solid[c] === 0 && w.gas.massOf(c) <= 0) putGas(w, c, w.ambientT, w.ambientY);
}


/** Einen Handgriff ausführen. Liefert eine Warnung (oder null). */
export function applyOp(w: World, op: Op): string | null {
  const g = w.grid;
  switch (op.op) {
    case 'fill': {
      if (op.phase === 'gas') {
        removeLiquid(w, op.region);
        const Y = new Float64Array(SPECIES_SLOTS);
        let sum = 0;
        for (const [k, v] of Object.entries(op.composition)) {
          const idx = k === 'N2' ? N2 : k === 'O2' ? O2 : k === 'H2O' ? H2O : -1;
          if (idx >= 0) { Y[idx] = v; sum += v; }
        }
        if (sum <= 0) Y.set(w.ambientY.subarray(0, SPECIES_SLOTS));
        else for (let k = 0; k < GAS_SPECIES; k += 1) Y[k] /= sum;
        eachCell(g, op.region, (c) => { if (g.solid[c] === 0) putGas(w, c, op.T, Y); });
        return null;
      }
      /*
       * Flüssigkeit: vorhandene Teilchen und Blasen in der Fläche ersetzen,
       * dann 2 × 2 Teilchen je Zelle. Die Zusammensetzung nennt Flüssigkeiten
       * (H2O, oil-rapeseed …) und gelöste Stoffe (NaCl) mit Massenanteilen;
       * mehrere unmischbare Flüssigkeiten werden nach ihren Volumenanteilen
       * gleichmässig verteilt (jedes Teilchen ist eine von ihnen) — die
       * Schwerkraft trennt sie dann. Salz löst sich im Wasser: jedes
       * Wasserteilchen ist Sole des Massenanteils w = NaCl/(H2O + NaCl).
       */
      removeLiquid(w, op.region);
      const NL = LIQUIDS.length;
      let saltIn = 0;
      for (const [k, v] of Object.entries(op.composition)) if (soluteIndex(k) >= 0 && v > 0) saltIn += v;
      const waterIn = op.composition[LIQUIDS[WATER].id] ?? 0;
      const ws = saltIn > 0 && waterIn > 0 ? saltIn / (saltIn + waterIn) : 0;
      const rhoOf = (l: number): number => (l === WATER && ws > 0 ? rhoSol(op.T, ws) : rhoLiq(l, op.T));
      const vf = new Float64Array(NL);
      let vsum = 0;
      for (const [k, v] of Object.entries(op.composition)) {
        const l = liquidIndex(k);
        if (l < 0 || !(v > 0)) continue;
        const mass = l === WATER && ws > 0 ? v + saltIn : v;
        vf[l] += mass / rhoOf(l);
        vsum += mass / rhoOf(l);
      }
      if (vsum <= 0) return 'fill: no known liquid in the composition';
      for (let l = 0; l < NL; l += 1) vf[l] /= vsum;
      const mOf = new Float64Array(NL);
      const hOf = new Float64Array(NL);
      for (let l = 0; l < NL; l += 1) { mOf[l] = (rhoOf(l) * g.vCell) / 4; hOf[l] = l === WATER && ws > 0 ? hSol(op.T, ws) : hLiq(l, op.T); }
      const sOf = ws * mOf[WATER];
      /* Fehlerverteilung: jedes Teilchen nimmt die Flüssigkeit, die ihrem Anteil am weitesten hinterherhinkt. */
      const due = new Float64Array(NL);
      const P = w.particles;
      let full = false;
      eachCellBox(g, op.region, (i, j) => {
        const c = i + j * g.nx;
        if (g.solid[c] !== 0) return;
        let placed = 0;
        for (let b = 0; b < 2; b += 1) for (let a = 0; a < 2; a += 1) {
          const x = (i + 0.25 + 0.5 * a) * g.dx;
          const y = (j + 0.25 + 0.5 * b) * g.dx;
          if (!inside(op.region, x, y)) continue;
          /* Nicht in einen Körper (eine Zelle kann zum Teil ein Körper sein). */
          if (g.owner[c] !== 0 && w.bodies.bodyAt(x, y, 0) !== null) continue;
          let l = 0;
          for (let k = 0; k < NL; k += 1) { due[k] += vf[k]; if (due[k] > due[l]) l = k; }
          due[l] -= 1;
          const m = mOf[l];
          const h = hOf[l];
          const s = l === WATER ? sOf : 0;
          if (P.add(x, y, m, h, l, s) < 0) { full = true; continue; }
          placed += 1;
          if (l === WATER) w.ledger.water += m - s; else w.ledger.other += m;
          w.ledger.salt += s;
          w.ledger.energy += m * h;
        }
        /* Ganz gefüllte Zellen: ihre Luft weicht (gebucht). */
        if (placed === 4) dropGas(w, c);
      });
      w.liquid.weightsDirty = true;
      if (saltIn > 0 && waterIn <= 0) return 'fill: salt needs water to dissolve in (NaCl dropped)';
      return full ? 'fill: particle capacity reached' : null;
    }
    case 'erase': {
      carve(w, op.region);
      removeLiquid(w, op.region);
      const cells: number[] = [];
      eachCell(g, op.region, (c) => { if (g.owner[c] === 0) cells.push(c); });
      clearSolid(w, cells);
      return null;
    }
    case 'move': {
      if (op.region !== null) { moveSolids(w, op.region, op.dx, op.dy); return null; }
      /* Ein Gegenstand samt dem, was in seinem Umriss liegt: Wasser, Blasen, ein gemalter Bau (Siedesteinchen in der Zlewka) und Gegenstände, die ganz darin liegen. */
      const own = w.bodies.list.filter((b) => !b.gone && b.key === w.objectKey(op.id ?? ''));
      if (own.length === 0) return `move: no object "${op.id ?? ''}"`;
      const box = new Float64Array(4);
      const out: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const b of own) {
        b.worldBox(b.x, b.y, b.a, box);
        out[0] = Math.min(out[0], box[0]); out[1] = Math.min(out[1], box[1]); out[2] = Math.max(out[2], box[2]); out[3] = Math.max(out[3], box[3]);
      }
      const tol = 1e-3 * g.dx;
      const inside = (b: Body2D): boolean => {
        if (own.includes(b)) return true;
        b.worldBox(b.x, b.y, b.a, box);
        return box[0] >= out[0] - tol && box[1] >= out[1] - tol && box[2] <= out[2] + tol && box[3] <= out[3] + tol;
      };
      moveSolids(w, { rect: out }, op.dx, op.dy, inside);
      return null;
    }
    case 'remove': {
      const key = w.objectKey(op.id);
      let any = false;
      for (const b of w.bodies.list) {
        if (b.gone || b.key !== key) continue;
        removeBody(w.bodies, b, w.ledger);
        if (b.heater >= 0) { const h = w.heat.heaters[b.heater]; if (h !== undefined) h.on = false; }
        any = true;
      }
      return any ? null : `remove: no object "${op.id}"`;
    }
    case 'solid': {
      const s = solidIndex(op.material);
      if (s < 0) return `solid: unknown material ${op.material}`;
      carve(w, op.region);
      const cells: number[] = [];
      eachCell(g, op.region, (c) => cells.push(c));
      /* Eine Strecke dünner als eine Zelle: wenigstens die Zellen auf ihr. */
      if (cells.length === 0 && 'line' in op.region) {
        const [ax, ay, bx, by] = op.region.line;
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (0.5 * g.dx)) + 1;
        for (let k = 0; k <= steps; k += 1) {
          const c = g.cellAt(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps);
          if (c >= 0 && !cells.includes(c)) cells.push(c);
        }
      }
      w.bodies.sync();
      makeSolid(w, cells, s, op.T, -1);
      return null;
    }
    case 'body': {
      const s = solidIndex(op.material);
      if (s < 0) return `body: unknown material ${op.material}`;
      carve(w, op.region);
      const r = op.region;
      let warning: string | null = null;
      let rect: RectWorld;
      let turn = op.angle;
      let px: number;
      let py: number;
      if ('line' in r) {
        /* Eine Strecke mit Breite: ein Rechteck so lang wie sie, gedreht in ihre Richtung. */
        const [ax, ay, bx, by] = r.line;
        const len = Math.max(r.width, Math.hypot(bx - ax, by - ay));
        px = (ax + bx) / 2;
        py = (ay + by) / 2;
        rect = [px - len / 2, py - r.width / 2, px + len / 2, py + r.width / 2];
        turn += (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
      } else if ('circle' in r) {
        /* Körper sind Rechtecke: ein Kreis wird das Quadrat gleicher Fläche. */
        const [cx, cy, rad] = r.circle;
        const h = 0.5 * rad * Math.sqrt(Math.PI);
        rect = [cx - h, cy - h, cx + h, cy + h];
        px = cx;
        py = cy;
        warning = 'body: bodies are rectangles — the circle became a square of the same area';
      } else {
        const [x0, y0, x1, y1] = bounds(r);
        rect = [x0, y0, x1, y1];
        px = (x0 + x1) / 2;
        py = (y0 + y1) / 2;
        if ('poly' in r) warning = 'body: bodies are rectangles — the polygon became its bounding rectangle';
      }
      placeBody(w, [rect], s, op.T, op.pinned, turn, px, py);
      return warning;
    }
    case 'pin': {
      const b = w.bodies.bodyAt(op.x, op.y);
      if (b === null) return 'pin: no body at this point';
      w.bodies.pin(b, op.pinned);
      return null;
    }
    case 'beaker': {
      const s = solidIndex(op.material);
      if (s < 0) return `beaker: unknown material ${op.material}`;
      /* Boden und zwei Wände, die auf ihm stehen (mit Deckel: die Wände bis unter ihn) — genau, nicht auf Zellen gerundet. */
      const wall = Math.min(op.wall, 0.45 * op.w, 0.45 * op.h);
      const x0 = op.x - op.w / 2;
      const x1 = op.x + op.w / 2;
      const y0 = op.y;
      const y1 = op.y + op.h;
      const top = op.lid ? y1 - wall : y1;
      const rects: RectWorld[] = [[x0, y0, x1, y0 + wall], [x0, y0 + wall, x0 + wall, top], [x1 - wall, y0 + wall, x1, top]];
      if (op.lid) rects.push([x0, top, x1, y1]);
      for (const r of rects) carve(w, { rect: [...r] });
      placeBody(w, rects, s, op.T, op.pinned, op.angle, op.x, op.y);
      return null;
    }
    case 'hotplate': {
      const s = solidIndex(op.material);
      if (s < 0) return `hotplate: unknown material ${op.material}`;
      const group = w.heat.heaters.length;
      w.heat.heaters.push({ group, mode: op.mode, power: op.power, target: op.target, on: op.on, P: 0, Tmean: op.T, integral: 0, cells: 0 });
      const rect: RectWorld = [op.x - op.w / 2, op.y, op.x + op.w / 2, op.y + op.h];
      carve(w, { rect: [...rect] });
      placeBody(w, [rect], s, op.T, op.pinned, op.angle, op.x, op.y, group);
      return null;
    }
  }
}

/**
 * Alles Feste in der Fläche verschieben, dazu Wasserteilchen und Blasen in der
 * Fläche um denselben Weg (so bleibt das Wasser in seiner Zlewka): Körper als
 * Ganzes, genau um (mx, my); liegen auch Zellen eines festen Baus in der
 * Fläche, rückt alles um ganze Zellen (der Bau besteht aus Zellen). Jede
 * Zelle behält Werkstoff, Temperatur (Energie), Heizgruppe und Belag; was am
 * Ziel war, weicht (gebucht wie bei makeSolid); frei gewordene Zellen füllt
 * Umgebungsluft. Was die Kiste verlässt, ist weg (gebucht).
 */
function moveSolids(w: World, region: Region, mx: number, my: number, pick?: (b: Body2D) => boolean): void {
  const g = w.grid;
  const { nx, ny, dx } = g;
  const src: number[] = [];
  eachCell(g, region, (c) => { if (g.solid[c] !== 0 && g.owner[c] === 0) src.push(c); });
  const di = Math.round(mx / dx);
  const dj = Math.round(my / dx);
  const ox = src.length > 0 ? di * dx : mx;
  const oy = src.length > 0 ? dj * dx : my;
  if (ox === 0 && oy === 0) return;
  /* Körper, deren Rechteck die Fläche trifft, rücken als Ganzes (erst aus dem Gitter, nach dem Bau wieder hinein). */
  const lifted = w.bodies.list.length > 0 ? liftBodies(w.bodies, region, pick) : [];
  const P = w.particles;
  const B = w.bubbles;
  /* Wasser und Blasen mitnehmen. */
  for (let q = 0; q < P.count; q += 1) {
    if (!inside(region, P.x[q], P.y[q])) continue;
    const x = P.x[q] + ox;
    const y = P.y[q] + oy;
    if (x <= 0 || y <= 0 || x >= g.w || y >= g.h) {
      unbook(w, q);
      w.liquid.removeParticle(q);
      q -= 1;
      continue;
    }
    P.x[q] = x;
    P.y[q] = y;
  }
  for (let b = 0; b < B.count; b += 1) {
    if (!inside(region, B.x[b], B.y[b])) continue;
    B.x[b] = Math.min(g.w - 1e-6, Math.max(1e-6, B.x[b] + ox));
    B.y[b] = Math.min(g.h - 1e-6, Math.max(1e-6, B.y[b] + oy));
    B.site[b] = -1;
  }
  w.liquid.weightsDirty = true;
  if (src.length === 0) {
    if (lifted.length === 0) return;
    placeBodies(w.bodies, lifted, ox, oy);
    w.bodies.sync();
    for (const b of lifted) w.bodies.cover.pushOut(b, b.x, b.y, b.a);
    removeInSolids(w);
    return;
  }
  /* Die Zustände der festen Zellen merken und die Quellen räumen (gebucht: ihre Energie und ihr Belag gehen hinaus …). */
  const state = src.map((c) => ({ c, s: g.solid[c], role: g.role[c], heater: g.heater[c], T: g.T[c], Es: g.Es[c], film: g.film[c], crust: g.crust[c] }));
  for (const k of state) {
    w.ledger.energy -= k.Es;
    w.ledger.water -= k.film;
    w.ledger.salt -= k.crust;
    g.solid[k.c] = 0;
    g.role[k.c] = 0;
    g.heater[k.c] = -1;
    g.Es[k.c] = 0;
    g.film[k.c] = 0;
    g.crust[k.c] = 0;
    g.kind[k.c] = 0;
  }
  /* … und am Ziel wieder hinein. */
  for (const k of state) {
    const i = (k.c % nx) + di;
    const j = Math.floor(k.c / nx) + dj;
    if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
    const t = i + j * nx;
    if (g.solid[t] !== 0) {
      w.ledger.energy -= g.Es[t];
      w.ledger.water -= g.film[t];
      unbookCrust(w, t);
    } else {
      dropGas(w, t);
    }
    g.solid[t] = k.s;
    g.role[t] = k.role;
    g.heater[t] = k.heater;
    g.T[t] = k.T;
    g.Es[t] = k.Es;
    g.film[t] = k.film;
    g.crust[t] = k.crust;
    g.kind[t] = SOLID;
    w.ledger.energy += k.Es;
    w.ledger.water += k.film;
    w.ledger.salt += k.crust;
  }
  placeBodies(w.bodies, lifted, ox, oy);
  w.solidsChanged();
  for (const b of lifted) w.bodies.cover.pushOut(b, b.x, b.y, b.a);
  removeInSolids(w);
  for (const k of state) if (g.solid[k.c] === 0 && w.gas.massOf(k.c) <= 0) putGas(w, k.c, w.ambientT, w.ambientY);
}

/** Teilchen, die jetzt in Zellen eines festen Baus liegen: entfernen (gebucht); aus Körpern schiebt sie bodyCover hinaus. */
function removeInSolids(w: World): void {
  const g = w.grid;
  const P = w.particles;
  for (let q = 0; q < P.count; q += 1) {
    const c = g.cellAt(P.x[q], P.y[q]);
    if (c < 0 || g.solid[c] === 0 || g.owner[c] !== 0) continue;
    unbook(w, q);
    w.liquid.removeParticle(q);
    q -= 1;
  }
}

/** Alle Zellen im umschliessenden Rechteck einer Fläche (für Teilchen, deren Plätze einzeln geprüft werden). */
function eachCellBox(g: Grid, region: Region, fn: (i: number, j: number) => void): void {
  const [x0, y0, x1, y1] = bounds(region);
  const i0 = Math.max(0, Math.floor(x0 / g.dx));
  const i1 = Math.min(g.nx - 1, Math.floor(x1 / g.dx));
  const j0 = Math.max(0, Math.floor(y0 / g.dx));
  const j1 = Math.min(g.ny - 1, Math.floor(y1 / g.dx));
  for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) fn(i, j);
}
