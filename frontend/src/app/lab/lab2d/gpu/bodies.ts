/**
 * LABOR 2D (v2) — DIE KÖRPER AUF DER GPU, DIE SEITE DES RECHNERS (seit
 * 2026-10-26): die Puffer der Körper (Plätze in kbodylib.ts), das Hochladen
 * aus der CPU-Engine (jeder Body2D genau: Lage, Geschwindigkeit, Randwert,
 * Zuwachs und Vorhersage, mitbewegte Masse, Zustand, innere Zellen, der
 * Warmstart der Berührungen), das Zurückholen in sie und die Ablesung je
 * Körper für Anzeige und Bilanzen.
 *
 * In einer Szene mit freien Körpern (bodyMode) rechnen ALLE Körper mit genauen
 * Anteilen; ohne freie Körper bleibt die Treppe (staircase.ts) und diese Puffer
 * sind leer. Ändert ein Werkzeug die Körper (neue, geteilte, weggenommene),
 * geht es wie jeder Handgriff über die CPU: zurückholen, anwenden, hochladen.
 */

import { latentPerKg, meltsAt, type Body2D } from '../engine/body';
import type { Engine } from '../engine/engine';
import { SOLIDS } from '../engine/materials';
import { objectKey, type ObjectView } from '../engine/objects';
import type { ObjectOp } from '../engine/scene';
import { BB, BC, BR, BRD, BS, GEO_RECTS, GH, PS, RS, SS } from './kbodylib';
import type { GpuCtx } from './kernel';

/** bat: je Körper die atomaren Summen (f32): Rest an Film und Kruste (collect), Σ Film und Kruste danach, die neun Summen der Messung der mitbewegten Masse. */
export const BA = { RESTF: 0, RESTK: 1, FSUM: 2, KSUM: 3, M9: 4 } as const;
export const BA_STRIDE = 16;
/** Berührungen: höchstens so viele zugleich; Wörter je Berührung im Arbeitsspeicher und je Eintrag des Warmstarts. */
export const MAXC = 128;
export const CW = 48;
export const WT_W = 11;
/** bcon: Zahl der Einträge des Warmstarts, dann die Einträge, dann der Arbeitsspeicher der Berührungen. */
export const BCON_WT = 4;
export const BCON_LIVE = BCON_WT + WT_W * MAXC;
export const BCON_WORDS = BCON_LIVE + CW * MAXC;
/** Höchstens so viele freie Körper rechnet die GPU (Engine.needsCpu). */
export const MAX_FREE = 8;
/** Die Seiten der Kiste als Stoff (wie bodyContacts.ts). */
const WALL = { friction: 0.5, bounce: 0.1 } as const;

/** Rechnen in dieser Szene alle Körper mit genauen Anteilen (eine Szene mit freien Körpern)? */
export function bodyMode(e: Engine): boolean {
  return e.bodies.anyFree;
}

/** Was eine Ablesung je Körper bringt. */
export interface BodyRead {
  readonly x: number; readonly y: number; readonly a: number; readonly vx: number; readonly vy: number; readonly w: number;
  readonly pinned: boolean; readonly asleep: boolean; readonly gone: boolean;
  readonly m: number; readonly T: number; readonly E: number; readonly film: number; readonly crust: number;
  readonly fx: number; readonly fy: number; readonly tq: number;
}

/** Die Umgrenzung eines Körpers in der Welt bei seiner Lage. */
function worldBox(b: Body2D): [number, number, number, number] {
  const out = new Float64Array(4);
  b.worldBox(b.x, b.y, b.a, out);
  return [out[0], out[1], out[2], out[3]];
}

export class GpuBodies {
  readonly bod: GPUBuffer;
  readonly bgeo: GPUBuffer;
  readonly bcell: GPUBuffer;
  readonly bcon: GPUBuffer;
  readonly bat: GPUBuffer;
  readonly bread: GPUBuffer;
  /** Kapazität (Körper, Rechtecke, innere Zellen, Wörter von bgeo). */
  readonly capBodies: number;
  readonly capCells: number;
  readonly capGeo: number;
  /** Beim letzten Hochladen: Körper, innere Zellen, Rechtecke, Lagen der Druckfortsetzung, die freien Körper, die ihre mitbewegte Masse messen. */
  nbody = 0;
  ncell = 0;
  nrect = 0;
  layers = 2;
  probed: number[] = [];
  private readonly ctx: GpuCtx;
  private readonly own: GPUBuffer[] = [];

  constructor(ctx: GpuCtx, e: Engine) {
    this.ctx = ctx;
    const need = GpuBodies.need(e);
    this.capBodies = Math.max(4, need.bodies + 4);
    this.capCells = Math.max(16, Math.ceil(need.cells * 1.25) + 64);
    this.capGeo = Math.max(64, Math.ceil(need.geo * 1.25) + 256);
    const b = (label: string, words: number): GPUBuffer => { const x = ctx.buffer(label, 4 * Math.max(4, words)); this.own.push(x); return x; };
    this.bod = b('bod', BS * this.capBodies);
    this.bgeo = b('bgeo', this.capGeo);
    this.bcell = b('bcell', BC * this.capCells);
    this.bcon = b('bcon', BCON_WORDS);
    this.bat = b('bat', BA_STRIDE * this.capBodies);
    this.bread = b('bread', BR * this.capBodies);
  }

  /** Was die Körper einer Engine an Platz brauchen (nur in einer Szene mit freien Körpern). */
  private static need(e: Engine): { bodies: number; cells: number; geo: number } {
    if (!bodyMode(e)) return { bodies: 0, cells: 0, geo: 0 };
    let cells = 0;
    let geo = GEO_RECTS;
    for (const b of e.bodies.list) {
      if (b.gone) continue;
      cells += b.ncell;
      geo += b.nr * RS + SS * b.nseg;
      for (let r = 0; r < b.nr; r += 1) geo += b.xs[r].length + b.ys[r].length;
    }
    /* Die festen Teile der Berührungen: höchstens vier Wände und die Läufe gemalter Feststoffe. */
    geo += PS * (4 + e.grid.n / 2);
    return { bodies: e.bodies.list.length, cells, geo };
  }

  /** Passen die Körper der Engine in diese Puffer? */
  fits(e: Engine): boolean {
    const need = GpuBodies.need(e);
    return need.bodies <= this.capBodies && need.cells <= this.capCells && need.geo <= this.capGeo;
  }

  destroy(): void {
    this.ctx.release(this.own);
    this.own.length = 0;
  }

  /* -- Hochladen ------------------------------------------------------------------------------------- */

  /** Alle Körper hochladen (nach jedem Handgriff); ohne freie Körper bleibt nichts (die Treppe). */
  upload(e: Engine): void {
    const q = this.ctx.device.queue;
    this.nbody = 0;
    this.ncell = 0;
    this.nrect = 0;
    this.probed = [];
    if (!bodyMode(e)) return;
    const list = e.bodies.list;
    const mo = e.bodies.motion;
    const nb = list.length;
    const bod = new Float32Array(BS * nb);
    const rects: number[] = [];
    const coords: number[] = [];
    const segs: number[] = [];
    const cells: number[] = [];
    let rectIndex = 0;
    let cellIndex = 0;
    let segIndex = 0;
    let maxHalf = 0;
    /* Erst die Rechtecke (fester Platz), die Grenzen hinter allen Rechtecken. */
    let nrect = 0;
    for (const b of list) if (!b.gone && b.ncell > 0) nrect += b.nr;
    let coordAt = GEO_RECTS + RS * nrect;
    list.forEach((b, k) => {
      const o = BS * k;
      const gone = b.gone || b.ncell === 0;
      const box = gone ? [1e9, 1e9, -1e9, -1e9] : worldBox(b);
      const v = (f: number, x: number): void => { bod[o + f] = x; };
      v(BB.X, b.x); v(BB.Y, b.y); v(BB.A, b.a); v(BB.VX, b.vx); v(BB.VY, b.vy); v(BB.W, b.w);
      v(BB.UX, b.ux); v(BB.UY, b.uy); v(BB.UW, b.uw);
      v(BB.M, b.m); v(BB.I, b.I); v(BB.RMAX, b.rmax); v(BB.HULLA, b.hullA); v(BB.HULLJ, b.hullJ);
      v(BB.PINNED, b.pinned ? 1 : 0); v(BB.ASLEEP, b.asleep ? 1 : 0); v(BB.GONE, gone ? 1 : 0); v(BB.REST, b.rest);
      v(BB.RX, b.rx); v(BB.RY, b.ry); v(BB.RA, b.ra);
      for (let d = 0; d < 3; d += 1) {
        v(BB.PREV + d, mo.prev[3 * k + d] ?? 0); v(BB.PRED + d, mo.pred[3 * k + d] ?? 0); v(BB.PNOW + d, mo.predNow[3 * k + d] ?? 0);
        v(BB.POLD + d, mo.predOld[3 * k + d] ?? 0); v(BB.VPRE + d, mo.vPre[3 * k + d] ?? 0);
      }
      for (let d = 0; d < 6; d += 1) v(BB.MA6 + d, b.ma6[d]);
      v(BB.MAOK, b.maOk ? 1 : 0); v(BB.MA, b.ma); v(BB.IA, b.Ia);
      v(BB.MAT, b.mat); v(BB.HEATER, b.heater); v(BB.NR, gone ? 0 : b.nr); v(BB.RO, rectIndex); v(BB.NCELL, gone ? 0 : b.ncell); v(BB.KO, cellIndex);
      v(BB.NSEG, gone ? 0 : b.nseg); v(BB.SO, segIndex);
      v(BB.BX0, box[0]); v(BB.BY0, box[1]); v(BB.BX1, box[2]); v(BB.BY1, box[3]);
      v(BB.OX0, box[0]); v(BB.OY0, box[1]); v(BB.OX1, box[2]); v(BB.OY1, box[3]);
      v(BB.TOUCH, e.bodies.contacts.touches(b) ? 1 : 0);
      /* Nach dem Hochladen deckt die GPU jeden Körper einmal neu ab (die Paare dünner Wände, ihre eigenen Anteile). */
      v(BB.AGAIN, gone ? 0 : 1);
      v(BB.COS, Math.cos(b.a)); v(BB.SIN, Math.sin(b.a));
      /* Jeder freie Körper misst seine mitbewegte Masse (bodies.probe): mit dem vorhergesagten Randwert der CPU ist die Schätzung zu klein (MILESTONES.md). */
      v(BB.PROBE, !gone && !b.pinned ? 1 : 0);
      v(BB.KEY, b.key);
      let V = 0;
      for (let c = 0; c < b.ncell; c += 1) V += b.cellVolume(c);
      v(BB.VOL, V);
      v(BB.E0, latentPerKg(b.mat));
      if (gone) return;
      if (!b.pinned && this.probed.length < MAX_FREE) this.probed.push(k);
      for (let r = 0; r < b.nr; r += 1) {
        const [x0, y0, x1, y1] = b.bounds(r);
        maxHalf = Math.max(maxHalf, Math.min(x1 - x0, y1 - y0));
        const xo = coordAt;
        for (const x of b.xs[r]) coords.push(x);
        coordAt += b.xs[r].length;
        const yo = coordAt;
        for (const y of b.ys[r]) coords.push(y);
        coordAt += b.ys[r].length;
        rects.push(x0, y0, x1, y1, b.ni[r], b.nj[r], xo, yo, cellIndex + b.off[r], k, 0, 0);
        for (let c = 0; c < b.ni[r] * b.nj[r]; c += 1) cells.push(rectIndex + r);
      }
      for (let s = 0; s < b.nseg; s += 1) segs.push(rectIndex + b.segR[s], b.segS[s], b.segT0[s], b.segT1[s], k, 0, 0, 0);
      rectIndex += b.nr;
      cellIndex += b.ncell;
      segIndex += b.nseg;
    });
    const segBase = coordAt;
    const partBase = segBase + segs.length;
    const parts = staticParts(e);
    const geo = new Float32Array(Math.max(GEO_RECTS, partBase + parts.length));
    geo[GH.SEGS] = segBase;
    geo[GH.PARTS] = partBase;
    geo[GH.NPARTS] = parts.length / PS;
    geo[GH.NRECT] = rectIndex;
    geo[GH.NCELL] = cellIndex;
    geo[GH.NBODY] = nb;
    geo.set(rects, GEO_RECTS);
    geo.set(coords, GEO_RECTS + RS * nrect);
    geo.set(segs, segBase);
    geo.set(parts, partBase);
    /* Innere Zellen: Energie, Film, Kruste, Rechteck. */
    const bc = new Float32Array(BC * Math.max(1, cellIndex));
    let at = 0;
    for (const b of list) {
      if (b.gone || b.ncell === 0) continue;
      for (let c = 0; c < b.ncell; c += 1) {
        bc[BC * at] = b.E[c];
        bc[BC * at + 1] = b.film[c];
        bc[BC * at + 2] = b.crust[c];
        bc[BC * at + 3] = cells[at];
        at += 1;
      }
    }
    q.writeBuffer(this.bod, 0, bod);
    q.writeBuffer(this.bgeo, 0, geo);
    q.writeBuffer(this.bcell, 0, bc);
    q.writeBuffer(this.bcon, 0, this.warmTable(e));
    q.writeBuffer(this.bat, 0, new Uint32Array(BA_STRIDE * this.capBodies));
    this.nbody = nb;
    this.ncell = cellIndex;
    this.nrect = rectIndex;
    /*
     * Lagen der Druckfortsetzung in die festen Zellen (bodyForces.extend): so viele, dass sie die unterste Zeile eines flach
     * liegenden Rechtecks erreicht (von oben durch seine Dicke oder von den Seiten bis zur Mitte — höchstens seine kleinere Seite),
     * höchstens 64, gerade (das Ping-Pong endet im ersten Puffer).
     */
    const L = Math.min(64, Math.ceil(maxHalf / e.grid.dx) + 3);
    this.layers = L + (L % 2);
  }

  /** Der Warmstart der Berührungen (BodyContacts.warmKey/warmData) als Tabelle: Kennung a, Kennung b, Zahl der Punkte, je Punkt Merkmal, jn, jt, Rückprall. */
  private warmTable(e: Engine): Uint32Array<ArrayBuffer> {
    const c = e.bodies.contacts;
    const out = new Uint32Array(BCON_LIVE);
    const f = new Float32Array(out.buffer);
    const n = Math.min(MAXC, c.warmCount);
    out[0] = n;
    for (let k = 0; k < n; k += 1) {
      const key = c.warmKey[k];
      const ia = Math.floor(key / 1e6);
      const o = BCON_WT + WT_W * k;
      out[o] = ia;
      out[o + 1] = Math.round(key - ia * 1e6);
      const d = 9 * k;
      out[o + 2] = c.warmData[d];
      for (let i = 0; i < 2; i += 1) {
        out[o + 3 + 4 * i] = Math.max(0, Math.round(c.warmData[d + 1 + 4 * i])) >>> 0;
        f[o + 4 + 4 * i] = c.warmData[d + 2 + 4 * i];
        f[o + 5 + 4 * i] = c.warmData[d + 3 + 4 * i];
        out[o + 6 + 4 * i] = c.warmData[d + 4 + 4 * i] === 1 ? 1 : 0;
      }
    }
    return out;
  }

  /* -- Zurückholen ----------------------------------------------------------------------------------- */

  /**
   * Die Körper in die CPU-Engine zurück (vor einem Handgriff): Lage, Geschwindigkeit, Randwert, Zustand, Zuwachs und Vorhersage,
   * mitbewegte Masse, Energie, Film und Kruste der inneren Zellen, der Warmstart der Berührungen. Die Zellen baut danach die CPU
   * aus den inneren Zellen neu (state.ts: Bodies.sync).
   */
  async download(e: Engine, read: (ranges: { buf: GPUBuffer; offset: number; size: number }[]) => Promise<ArrayBuffer[]>): Promise<void> {
    if (this.nbody === 0) return;
    const [bodB, cellB, conB] = await read([
      { buf: this.bod, offset: 0, size: 4 * BS * this.nbody },
      { buf: this.bcell, offset: 0, size: 4 * BC * Math.max(1, this.ncell) },
      { buf: this.bcon, offset: 0, size: 4 * BCON_LIVE }
    ]);
    const bod = new Float32Array(bodB);
    const bc = new Float32Array(cellB);
    const list = e.bodies.list;
    const mo = e.bodies.motion;
    let at = 0;
    list.forEach((b, k) => {
      if (k >= this.nbody) return;
      const o = BS * k;
      const v = (f: number): number => bod[o + f];
      const wasGone = b.gone || b.ncell === 0;
      if (!wasGone) {
        for (let c = 0; c < b.ncell; c += 1) { b.E[c] = bc[BC * at]; b.film[c] = bc[BC * at + 1]; b.crust[c] = bc[BC * at + 2]; at += 1; }
      }
      if (wasGone) return;
      b.x = v(BB.X); b.y = v(BB.Y); b.a = v(BB.A); b.vx = v(BB.VX); b.vy = v(BB.VY); b.w = v(BB.W);
      b.ux = v(BB.UX); b.uy = v(BB.UY); b.uw = v(BB.UW);
      b.asleep = v(BB.ASLEEP) !== 0; b.rest = v(BB.REST);
      b.rx = v(BB.RX); b.ry = v(BB.RY); b.ra = v(BB.RA);
      for (let d = 0; d < 3; d += 1) {
        mo.prev[3 * k + d] = v(BB.PREV + d); mo.pred[3 * k + d] = v(BB.PRED + d); mo.predNow[3 * k + d] = v(BB.PNOW + d);
        mo.predOld[3 * k + d] = v(BB.POLD + d); mo.vPre[3 * k + d] = v(BB.VPRE + d);
      }
      for (let d = 0; d < 6; d += 1) b.ma6[d] = v(BB.MA6 + d);
      b.maOk = v(BB.MAOK) !== 0;
      b.ma = v(BB.MA);
      b.Ia = v(BB.IA);
      if (v(BB.GONE) !== 0) {
        /* Durch eine offene Seite hinaus (die GPU buchte das Entwichene): weg, seine Zellen baut die CPU ohne ihn. */
        e.bodies.cover.release(b);
        b.gone = true;
        b.ncell = 0;
      }
    });
    /* Der Warmstart der Berührungen; die Teile baut die CPU neu (ihr Speicher der Berührungen gehörte zum Stand vor dem Hochladen). */
    const wt = new Uint32Array(conB);
    const wf = new Float32Array(conB);
    const c = e.bodies.contacts;
    const n = Math.min(MAXC, wt[0]);
    if (c.warmKey.length < n) { c.warmKey = new Float64Array(2 * n + 8); c.warmData = new Float64Array(9 * (2 * n + 8)); }
    for (let k = 0; k < n; k += 1) {
      const o = BCON_WT + WT_W * k;
      c.warmKey[k] = wt[o] * 1e6 + wt[o + 1];
      const d = 9 * k;
      c.warmData[d] = wt[o + 2];
      for (let i = 0; i < 2; i += 1) {
        c.warmData[d + 1 + 4 * i] = wt[o + 3 + 4 * i];
        c.warmData[d + 2 + 4 * i] = wf[o + 4 + 4 * i];
        c.warmData[d + 3 + 4 * i] = wf[o + 5 + 4 * i];
        c.warmData[d + 4 + 4 * i] = wt[o + 6 + 4 * i];
      }
    }
    c.warmCount = n;
    c.invalidate();
  }

  /* -- Ablesung -------------------------------------------------------------------------------------- */

  /** Die Ablesung je Körper (bread, BR Wörter je Körper). */
  parse(all: ArrayBuffer, offset: number, count: number): BodyRead[] {
    const r = new Float32Array(all, offset, BR * count);
    const out: BodyRead[] = [];
    for (let k = 0; k < count; k += 1) {
      const o = BR * k;
      const st = r[o + BRD.STATE];
      out.push({
        x: r[o + BRD.X], y: r[o + BRD.Y], a: r[o + BRD.A], vx: r[o + BRD.VX], vy: r[o + BRD.VY], w: r[o + BRD.W],
        pinned: (st & 1) !== 0, asleep: (st & 2) !== 0, gone: (st & 4) !== 0,
        m: r[o + BRD.M], T: r[o + BRD.T], E: r[o + BRD.E], film: r[o + BRD.FILM], crust: r[o + BRD.CRUST],
        fx: r[o + BRD.FX], fy: r[o + BRD.FY], tq: r[o + BRD.TQ]
      });
    }
    return out;
  }
}

/** Die festen Teile der Berührungen wie BodyContacts.build: die geschlossenen Seiten der Kiste, gemalte Feststoffe als Läufe je Zeile (gleiche übereinander zu Rechtecken). */
function staticParts(e: Engine): number[] {
  const g = e.grid;
  const out: number[] = [];
  const W = g.w;
  const H = g.h;
  const push = (x0: number, y0: number, x1: number, y1: number, id: number, m: { readonly friction: number; readonly bounce: number }): void => {
    out.push(x0, y0, x1, y1, id, m.friction, m.bounce, 0);
  };
  if (!g.openL) push(-1, -1, 0, H + 1, 1, WALL);
  if (!g.openR) push(W, -1, W + 1, H + 1, 2, WALL);
  if (!g.openB) push(-1, -1, W + 1, 0, 3, WALL);
  if (!g.openT) push(-1, H, W + 1, H + 1, 4, WALL);
  const { nx, ny, dx } = g;
  const mat = (s: number): { friction: number; bounce: number } => { const m = SOLIDS[s - 1]; return m !== undefined ? { friction: m.friction, bounce: m.bounce } : WALL; };
  let open = new Map<number, number>();
  let tid = 10;
  for (let j = 0; j <= ny; j += 1) {
    const next = new Map<number, number>();
    if (j < ny) {
      let i = 0;
      while (i < nx) {
        const c = i + j * nx;
        if (g.solid[c] === 0 || g.owner[c] !== 0) { i += 1; continue; }
        const m = g.solid[c];
        let k = i;
        while (k + 1 < nx && g.solid[k + 1 + j * nx] === m && g.owner[k + 1 + j * nx] === 0) k += 1;
        const key = (m << 24) | (i << 12) | k;
        next.set(key, open.has(key) ? (open.get(key) as number) : j);
        i = k + 1;
      }
    }
    for (const [key, start] of open) {
      if (next.get(key) === start) continue;
      push(((key >> 12) & 0xfff) * dx, start * dx, ((key & 0xfff) + 1) * dx, j * dx, tid++, mat(key >>> 24));
    }
    open = next;
  }
  return out;
}

/** Der Gegenstand für die Oberfläche aus der Ablesung der GPU (Lage, Temperatur, Zustand), sonst wie objects.objectView. */
export function objectViewGpu(e: Engine, id: string, reads: readonly BodyRead[] | null): ObjectView | null {
  const key = objectKey(e, id);
  if (key < 0) return null;
  const op = e.scene.ops[key] as ObjectOp;
  const outline: number[] = [];
  let mass = 0;
  let CT = 0;
  let C = 0;
  let state: ObjectView['state'] = 'gone';
  e.bodies.list.forEach((b, k) => {
    const rd = reads?.[k];
    if (b.gone || b.key !== key || rd?.gone === true) return;
    const x = rd?.x ?? b.x;
    const y = rd?.y ?? b.y;
    const a = rd?.a ?? b.a;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    for (let r = 0; r < b.nr; r += 1) {
      const [x0, y0, x1, y1] = b.bounds(r);
      for (const [lx, ly] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) outline.push(x + cs * lx - sn * ly, y + sn * lx + cs * ly);
    }
    mass += b.m;
    const c = b.m * SOLIDS[b.mat].cp;
    CT += c * (rd !== undefined && rd.T > 0 ? rd.T : b.meanT());
    C += c;
    const s = b.pinned ? 'pinned' : (rd?.asleep ?? b.asleep) ? 'asleep' : 'moving';
    if (state === 'gone' || s === 'moving') state = s;
  });
  return { id, kind: op.op, outline, T: C > 0 ? CT / C : op.T, mass, state };
}

/** Eis zählt als Wasser (budget.ts): die Masse der schmelzbaren Körper aus der Ablesung. */
export function iceMass(e: Engine, reads: readonly BodyRead[]): number {
  let m = 0;
  e.bodies.list.forEach((b, k) => { const rd = reads[k]; if (rd !== undefined && !rd.gone && meltsAt(b.mat) > 0) m += rd.m; });
  return m;
}
