/**
 * LABOR 2D (v2) — DIE AUFNAHME AUF DER GPU, die Seite der CPU (B, Backen mit
 * der Grafikkarte; seit 2026-10-25): die Puffer und Aufrufe der Kerne aus
 * captureKernels.ts auf einer GpuEngine, und das Lesen eines Bildes aus einem
 * zurückgelesenen Bündel als Ebenen (render/layers.ts) — Ansichten in die
 * Bytes, ohne zu kopieren; der ChunkWriter kopiert, was er behält.
 *
 * Ein Bündel ist eine Folge von Schritten in einem Befehlspuffer, nach jedem
 * die Aufnahme (encode). Ein Bündel nimmt höchstens kmax Bilder auf, jedes in
 * seinen eigenen Platz; am Ende kopiert copyOut die Uhr, die Köpfe und die
 * Plätze in einen Zwischenpuffer (die GPU arbeitet die Befehle der Reihe nach
 * ab: das nächste Bündel überschreibt die Plätze erst nach der Kopie). Ein
 * weiterer Platz (kmax) dient der Probe: der Zustand jetzt, alle Ebenen, ohne
 * die Uhr zu stellen (Prüfstand, G31).
 *
 * Platz eines Bildes (u32-Wörter, q4 = ⌈n/4⌉): Art, Merkmale, Kruste, Glühen
 * (je q4), Temperatur (2 q4), Druck, Geschwindigkeit, Feuchte, Dampf, Nebel
 * (je q4), Flüssigkeit (4n Texel RGBA), Pfeile (zwei je Wort), Blasen (zwei
 * Wörter je Blase, Platz für alle), Vierecke (ein Wort je Viereck).
 */

import type { Engine } from '../engine/engine';
import { arrowPoints, arrowStep, presOf, QUAD, RECT, speedOf, velOf, type Layers } from '../render/layers';
import { OVERLAY_EVERY } from '../clip/codec';
import { BK_WORDS, BKC, BKC_WORDS, CLOCK_UNITS, HEAD, HEAD_WORDS } from './captureKernels';
import { bodyStatics, fillQuads, rebaseQuads, type BodyStatics } from './captureBodies';
import type { GpuEngine } from './engine';
import { F } from './slots';

/** Wo im Platz eines Bildes welche Ebene beginnt (Wörter), und sein Umfang; rect: die Umrisse (nur mit genauen Anteilen, fünf u16 je Rechteck). */
export interface SlotLayout {
  readonly sw: number;
  readonly flags: number; readonly crust: number; readonly glow: number; readonly temp: number; readonly pres: number;
  readonly speed: number; readonly hum: number; readonly vap: number; readonly fog: number; readonly liq: number;
  readonly arw: number; readonly bub: number; readonly quad: number; readonly rect: number;
  /** Punkte des Pfeilrasters, Punkte je Zeile, Abstand, erster Punkt. */
  readonly na: number; readonly nax: number; readonly astep: number; readonly ahalf: number;
}

/**
 * nq Vierecke: ohne genaue Anteile (die Treppe, Körper liegen still) ein Wort je Viereck (Temperatur, Glühen, Kruste — die Lage steht fest);
 * mit genauen Anteilen (body) das ganze Viereck (vier Wörter) und nr Umrisse — Körper bewegen sich, Eis schmilzt (seit 2026-10-26).
 */
export function slotLayout(nx: number, ny: number, dx: number, bcap: number, nq: number, nr = 0, body = false): SlotLayout {
  const n = nx * ny;
  const q4 = Math.ceil(n / 4);
  const astep = arrowStep(dx);
  const ahalf = astep >> 1;
  const na = arrowPoints(nx, ny, dx);
  const liq = 11 * q4;
  const arw = liq + 4 * n;
  const bub = arw + Math.ceil(na / 2);
  const quad = bub + 2 * bcap;
  const rect = quad + (body ? 4 : 1) * Math.max(1, nq);
  const end = rect + (body ? Math.ceil((RECT * Math.max(1, nr)) / 2) : 0);
  return {
    sw: 4 * Math.ceil(end / 4), flags: q4, crust: 2 * q4, glow: 3 * q4, temp: 4 * q4, pres: 6 * q4, speed: 7 * q4,
    hum: 8 * q4, vap: 9 * q4, fog: 10 * q4, liq, arw, bub, quad, rect, na, nax: Math.max(0, Math.ceil((nx - ahalf) / astep)), astep, ahalf
  };
}

/** Was ein Bündel nach dem Zurücklesen sagt. */
export interface BatchRead {
  /** Bilder in diesem Bündel, verlorene Bilder (kein Platz frei — sollte 0 bleiben), aufgenommene Bilder insgesamt (die Nummer des nächsten). */
  readonly count: number;
  readonly lost: number;
  readonly captured: number;
}

export class Capture {
  /** Plätze je Bündel (ein weiterer für die Probe). */
  readonly kmax: number;
  readonly lay: SlotLayout;
  /** Ohne genaue Anteile: das Feste der Körper (sie liegen still); mit genauen Anteilen null — jedes Bild nimmt die Körper aus ihren Puffern. */
  readonly bodies: BodyStatics | null;
  readonly body: boolean;
  /** Bytes im Zwischenpuffer eines Bündels: Uhr (64), Köpfe (32 je Platz), Plätze. */
  readonly batchBytes: number;
  private readonly headAt = 4 * BKC_WORDS;
  private readonly slotAt: number;
  private readonly g: GpuEngine;
  private readonly e: Engine;
  private readonly own: GPUBuffer[] = [];
  private readonly bkc: GPUBuffer;
  private readonly bko: GPUBuffer;
  private readonly bkh: GPUBuffer;
  /** Der Bezug der Vierecke (je Viereck T_k, Kruste_k, Seite) und der Treppenzellen (T_c, dann Kruste_c). */
  private readonly q0: GPUBuffer;
  private readonly c0: GPUBuffer;
  private readonly groups: Record<string, GPUBindGroup>;
  /** Die Vierecke eines Bildes (feste Lage, Wörter 6 und 7 je Bild) — wiederverwendet. */
  private readonly quads: Uint16Array;
  private readonly rects: Uint16Array;

  /** g: die GpuEngine (Kerne übersetzt, Zustand hochgeladen) mit ihrer CPU-Engine; fps: Bilder je Sekunde; steps: Schritte je Bündel; L0: das erste Bild (von der CPU). */
  constructor(g: GpuEngine, fps: number, steps: number, L0: Layers) {
    this.g = g;
    this.e = g.cpu;
    const S = g.state;
    /* Mit genauen Anteilen (freie Körper, schmelzendes Eis) bewegen sich Körper und ändern ihre Form: bkTexB und bkBodyB nehmen sie in jedem Bild aus
       ihren Puffern (seit 2026-10-26); sonst liegen sie still, und ihr Festes steht einmal hier (captureBodies.ts). */
    this.body = S.body;
    const stair = S.staircase;
    if (stair === null && !this.body) throw new Error('capture: no staircase (state not uploaded)');
    this.bodies = stair !== null && !this.body ? bodyStatics(this.e, stair, L0) : null;
    const grid = this.e.grid;
    const n = grid.n;
    const nq = this.bodies !== null ? this.bodies.nq : S.bodies.ncell;
    this.lay = slotLayout(grid.nx, grid.ny, grid.dx, S.d.bcap, nq, S.bodies.nrect, this.body);
    /* Ein Schritt nimmt höchstens ein Bild auf (Δt ≤ 1/120 s < 1/60 s); in einem Bündel höchstens so viele, wie in steps · Δt_max fallen, und eins mehr. */
    const dtmax = Math.fround(this.e.dtMax);
    this.kmax = Math.min(steps, Math.ceil(steps * dtmax * fps) + 1);
    this.slotAt = this.headAt + 4 * HEAD_WORDS * this.kmax;
    this.batchBytes = this.slotAt + 4 * this.lay.sw * this.kmax;
    const ctx = g.ctx;
    const buf = (label: string, words: number, data?: ArrayBufferView): GPUBuffer => {
      const b = ctx.buffer(label, 4 * Math.max(4, words));
      this.own.push(b);
      if (data !== undefined) ctx.device.queue.writeBuffer(b, 0, data as BufferSource);
      return b;
    };
    const slots = this.kmax + 1;
    const st = this.bodies;
    this.bkc = buf('bkc', BKC_WORDS);
    this.bko = buf('bko', this.lay.sw * slots);
    this.bkh = buf('bkh', HEAD_WORDS * slots);
    const lq = buf('lq', 16 * n);
    const lqE = buf('lqE', 16 * n);
    const lq2 = buf('lq2', 16 * n);
    const L = this.lay;
    const K = new Uint32Array(BK_WORDS);
    K.set([L.sw, this.kmax, Math.round(CLOCK_UNITS / fps), S.d.bcap, L.flags, L.crust, L.glow, L.temp, L.pres, L.speed, L.hum, L.vap, L.fog, L.liq, L.arw, L.bub, L.quad,
      st !== null ? st.nq : 0, L.na, L.nax, L.astep, L.ahalf, OVERLAY_EVERY, this.body ? 1 : 0, L.rect, S.bodies.ncell, 0, 0]);
    const kbuf = ctx.uniform('bk', K.buffer);
    this.own.push(kbuf);
    /* Mit genauen Anteilen brauchen die Kerne der Treppe nichts (leere Puffer); die Maske der Texel schreibt bkTexB in jedem Bild. */
    const none = new Uint32Array(4);
    this.q0 = buf('q0', st !== null ? st.q0.length : 4, st?.q0 ?? none);
    this.c0 = buf('c0', st !== null ? st.c0.length : 4, st?.c0 ?? none);
    const res = {
      P: S.params, K: kbuf, glob: S.glob, cnt: S.cnt, cf: S.cf, cu: S.cu, ff: S.ff, reg: S.reg, parts: S.partsA, ccount: S.ccountB, cstart: S.cstart,
      bsum: S.bsum, bubs: S.bubs, bkc: this.bkc, bko: this.bko, bkh: this.bkh, lq, lq2,
      bkm: buf('bkm', n, st?.cellMask ?? new Uint32Array(n)), bkt: buf('bkt', 4 * n, st?.texMask), qs: buf('qs', st !== null ? st.qs.length : 4, st?.qs ?? none),
      qc: buf('qc', st !== null ? st.qc.length : 4, st?.qc ?? none), qw: buf('qw', st !== null ? st.qw.length : 4, st?.qw ?? none),
      qx: buf('qx', st !== null ? st.qx.length : 4, st?.qx ?? none), q0: this.q0, c0: this.c0,
      bod: S.bodies.bod, bgeo: S.bodies.bgeo, bcell: S.bodies.bcell
    };
    const bind = (name: string, extra: Record<string, GPUBuffer> = {}): GPUBindGroup => ctx.bind(name, { ...res, ...extra });
    this.groups = {
      clock: bind('bkClock'), cells: bind('bkCells'), splat: bind('bkLiqSplat'), ext1: bind('bkLiqExt', { lqa: lq, lqb: lqE }), ext2: bind('bkLiqExt', { lqa: lqE, lqb: lq }),
      blurX: bind('bkLiqBlurX', { lqa: lqE }), out: bind('bkLiqOut'), arrows: bind('bkArrows'), bubbles: bind('bkBubbles'), quads: bind('bkQuads'),
      texB: bind('bkTexB'), bodyB: bind('bkBodyB')
    };
    this.quads = new Uint16Array(Math.max(16, L0.quads.length));
    this.rects = new Uint16Array(Math.max(16, L0.rects.length));
    if (st !== null) this.rects.set(st.rects);
  }

  /** Die Uhr auf den Anfang: Bild 0 kam von der CPU, das nächste fällt auf 1/fps; gemerkt ist das Δt des ersten Schritts (glob.DT wie hochgeladen). */
  start(fps: number): void {
    const init = new Uint32Array(BKC_WORDS);
    init[BKC.NEXT_LO] = Math.round(CLOCK_UNITS / fps);
    init[BKC.FRAMES] = 1;
    init[BKC.DT] = Math.round(Math.fround(Math.fround(this.e.dt) * CLOCK_UNITS));
    this.g.ctx.device.queue.writeBuffer(this.bkc, 0, init);
  }

  /**
   * An einem Schlüsselbild, nach GpuState.download (die Bündel sind leer): der neue Bezug der Vierecke — T_k und
   * Kruste_k, wie collect sie eben in der CPU-Engine hinterliess; T_c und Kruste_c der Zellen, wie sie auf der GPU stehen.
   */
  rebase(): void {
    const st = this.bodies;
    /* Mit genauen Anteilen rechnen die Vierecke aus den inneren Zellen selbst (collect läuft auf der GPU): kein Bezug. */
    if (st === null || st.nq === 0) return;
    rebaseQuads(this.e, st);
    const dev = this.g.ctx.device;
    dev.queue.writeBuffer(this.q0, 0, st.q0 as BufferSource);
    const n = this.e.grid.n;
    const cf = this.g.state.cf;
    const enc = dev.createCommandEncoder();
    enc.copyBufferToBuffer(cf, 4 * F.T * n, this.c0, 0, 4 * n);
    enc.copyBufferToBuffer(cf, 4 * F.CRUST * n, this.c0, 4 * n, 4 * n);
    dev.queue.submit([enc.finish()]);
  }

  /** Ein Bündel beginnt: noch kein Bild darin. */
  begin(enc: GPUCommandEncoder): void {
    enc.clearBuffer(this.bkc, 4 * BKC.K, 4);
  }

  /** Nach einem Schritt: die Aufnahme (jeder Kern kehrt sofort zurück, wenn kein Bild fällig ist). */
  encode(enc: GPUCommandEncoder): void {
    const ctx = this.g.ctx;
    const n = this.e.grid.n;
    const gr = this.groups;
    const p = enc.beginComputePass();
    ctx.dispatch(p, 'bkClock', gr.clock, 1);
    ctx.dispatch(p, 'bkCells', gr.cells, Math.ceil(n / 4));
    ctx.dispatch(p, 'bkLiqSplat', gr.splat, 4 * n);
    if (this.body) ctx.dispatch(p, 'bkTexB', gr.texB, 4 * n);
    ctx.dispatch(p, 'bkLiqExt', gr.ext1, 4 * n);
    ctx.dispatch(p, 'bkLiqExt', gr.ext2, 4 * n);
    ctx.dispatch(p, 'bkLiqExt', gr.ext1, 4 * n);
    ctx.dispatch(p, 'bkLiqBlurX', gr.blurX, 4 * n);
    ctx.dispatch(p, 'bkLiqOut', gr.out, 4 * n);
    ctx.dispatch(p, 'bkArrows', gr.arrows, Math.ceil(this.lay.na / 2));
    ctx.dispatch(p, 'bkBubbles', gr.bubbles, this.g.state.d.bcap);
    if (this.bodies !== null) ctx.dispatch(p, 'bkQuads', gr.quads, Math.max(1, this.bodies.nq));
    else ctx.dispatch(p, 'bkBodyB', gr.bodyB, Math.max(1, this.g.state.bodies.ncell));
    p.end();
  }

  /** Am Ende eines Bündels: Uhr, Köpfe und Plätze in den Zwischenpuffer (batchBytes). */
  copyOut(enc: GPUCommandEncoder, staging: GPUBuffer): void {
    enc.copyBufferToBuffer(this.bkc, 0, staging, 0, 4 * BKC_WORDS);
    enc.copyBufferToBuffer(this.bkh, 0, staging, this.headAt, 4 * HEAD_WORDS * this.kmax);
    enc.copyBufferToBuffer(this.bko, 0, staging, this.slotAt, 4 * this.lay.sw * this.kmax);
  }

  /** Was ein zurückgelesenes Bündel sagt. */
  read(all: ArrayBuffer): BatchRead {
    const c = new Uint32Array(all, 0, BKC_WORDS);
    return { count: c[BKC.K], lost: c[BKC.LOST], captured: c[BKC.FRAMES] };
  }

  /** Die Nummer des k-ten Bildes eines Bündels. */
  index(all: ArrayBuffer, k: number): number {
    return new Uint32Array(all, this.headAt + 4 * HEAD_WORDS * k, HEAD_WORDS)[HEAD.INDEX];
  }

  /** Das k-te Bild eines Bündels als Ebenen in L (Ansichten in all; gültig, solange all es ist). */
  frame(all: ArrayBuffer, k: number, L: Layers): Layers {
    return this.layersAt(all, this.headAt + 4 * HEAD_WORDS * k, this.slotAt + 4 * this.lay.sw * k, L);
  }

  /** Kopf (32 Bytes) und Platz des k-ten Bildes eines Bündels als eigene Kopie (Kopf, dann Platz) — für eine Vorschau, die das Bündel überdauert. */
  copyFrame(all: ArrayBuffer, k: number, into: ArrayBuffer | null): ArrayBuffer {
    const size = 4 * HEAD_WORDS + 4 * this.lay.sw;
    const out = into !== null && into.byteLength === size ? into : new ArrayBuffer(size);
    const dst = new Uint8Array(out);
    dst.set(new Uint8Array(all, this.headAt + 4 * HEAD_WORDS * k, 4 * HEAD_WORDS), 0);
    dst.set(new Uint8Array(all, this.slotAt + 4 * this.lay.sw * k, 4 * this.lay.sw), 4 * HEAD_WORDS);
    return out;
  }

  /** Ein Bild aus Bytes: Kopf ab headByte, Platz ab slotByte (Ebenen der Einblendungen nur in jedem dritten Bild und in der Probe). */
  layersAt(all: ArrayBuffer, headByte: number, slotByte: number, L: Layers): Layers {
    const head = new Uint32Array(all, headByte, HEAD_WORDS);
    const ov = head[HEAD.INDEX] === 0xffffffff || head[HEAD.INDEX] % OVERLAY_EVERY === 0;
    return this.view(all, slotByte, head, ov, L);
  }

  private view(all: ArrayBuffer, at: number, head: Uint32Array, ov: boolean, L: Layers): Layers {
    const grid = this.e.grid;
    const n = grid.n;
    const lay = this.lay;
    const u8 = (w: number, len: number): Uint8Array => new Uint8Array(all, at + 4 * w, len);
    L.nx = grid.nx; L.ny = grid.ny; L.dx = grid.dx; L.depth = grid.depth; L.boxW = grid.w; L.boxH = grid.h;
    L.t = (head[HEAD.HI] * 2 ** 32 + head[HEAD.LO]) / CLOCK_UNITS;
    L.code = u8(0, n); L.flags = u8(lay.flags, n); L.crust = u8(lay.crust, n); L.glow = u8(lay.glow, n);
    L.temp = new Uint16Array(all, at + 4 * lay.temp, n);
    L.pres = u8(lay.pres, n); L.speed = u8(lay.speed, n); L.hum = u8(lay.hum, n); L.vap = u8(lay.vap, n); L.fog = u8(lay.fog, n);
    L.liquid = u8(lay.liq, 16 * n);
    L.arrows = new Int8Array(all, at + 4 * lay.arw, 2 * lay.na);
    L.pmax = Math.max(1, presOf(128 + head[HEAD.PMAX]));
    L.vmax = Math.max(0.02, speedOf(head[HEAD.VMAX]));
    L.nb = head[HEAD.NB];
    L.bubbles = new Uint16Array(all, at + 4 * lay.bub, 4 * this.g.state.d.bcap);
    /* Die grösste Geschwindigkeit an den Pfeilen (wie sampleArrows) — nur, wo das Bild seine Pfeile trägt. */
    let vGas = 0;
    let vLiq = 0;
    if (ov) {
      let q = 0;
      for (let j = lay.ahalf; j < grid.ny; j += lay.astep) {
        for (let i = lay.ahalf; i < grid.nx; i += lay.astep, q += 1) {
          const kind = L.code[i + j * grid.nx] & 3;
          if (kind !== 0 && kind !== 1) continue;
          const s = Math.hypot(velOf(L.arrows[2 * q]), velOf(L.arrows[2 * q + 1]));
          if (kind === 0) vGas = Math.max(vGas, s); else vLiq = Math.max(vLiq, s);
        }
      }
    }
    L.vGas = vGas;
    L.vLiq = vLiq;
    const st = this.bodies;
    if (st === null) {
      /* Mit genauen Anteilen: die Vierecke und Umrisse, wie bkBodyB sie schrieb (ihre Zahl im Kopf: ein Körper, der wegschmolz, eine neue Aufteilung). */
      L.nq = head[HEAD.NQ];
      L.nr = head[HEAD.NR];
      L.quads = new Uint16Array(all, at + 4 * lay.quad, QUAD * L.nq);
      L.rects = new Uint16Array(all, at + 4 * lay.rect, RECT * L.nr);
      return L;
    }
    fillQuads(st, new Uint32Array(all, at + 4 * lay.quad, Math.max(1, st.nq)), this.quads);
    L.quads = this.quads;
    L.rects = this.rects;
    L.nq = st.nq;
    L.nr = st.nr;
    return L;
  }

  /**
   * Prüfstand: den Zustand jetzt aufnehmen (alle Ebenen, die Uhr bleibt) — nach dem Leeren der Bündel, wenn die
   * CPU-Engine dasselbe hält (GpuState.download). Die Ebenen sind eine Kopie.
   */
  async probe(): Promise<Layers> {
    const dev = this.g.ctx.device;
    const at = this.kmax;
    dev.queue.writeBuffer(this.bkc, 4 * BKC.PROBE, new Uint32Array([1]));
    const bytes = 4 * HEAD_WORDS + 4 * this.lay.sw;
    const staging = dev.createBuffer({ label: 'probe', size: Math.ceil(bytes / 16) * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = dev.createCommandEncoder();
    this.encode(enc);
    enc.clearBuffer(this.bkc, 4 * BKC.PROBE, 4);
    enc.copyBufferToBuffer(this.bkh, 4 * HEAD_WORDS * at, staging, 0, 4 * HEAD_WORDS);
    enc.copyBufferToBuffer(this.bko, 4 * this.lay.sw * at, staging, 4 * HEAD_WORDS, 4 * this.lay.sw);
    dev.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const all = staging.getMappedRange().slice(0);
    staging.unmap();
    staging.destroy();
    const L = emptyLayers();
    this.view(all, 4 * HEAD_WORDS, new Uint32Array(all, 0, HEAD_WORDS), true, L);
    L.quads = L.quads.slice();
    L.rects = L.rects.slice();
    return L;
  }

  destroy(): void {
    this.g.ctx.release(this.own);
    this.own.length = 0;
  }
}

/** Ein Gerüst von Ebenen, dessen Felder view() auf die Bytes eines Platzes richtet. */
export function emptyLayers(): Layers {
  const z8 = new Uint8Array(0);
  return {
    nx: 0, ny: 0, dx: 0, depth: 0, boxW: 0, boxH: 0, t: 0, code: z8, flags: z8, crust: z8, glow: z8, temp: new Uint16Array(0), pres: z8, speed: z8,
    hum: z8, vap: z8, fog: z8, liquid: z8, arrows: new Int8Array(0), pmax: 1, vmax: 0.02, vGas: 0, vLiq: 0, nb: 0, bubbles: new Uint16Array(0),
    nq: 0, quads: new Uint16Array(0), nr: 0, rects: new Uint16Array(0)
  };
}
