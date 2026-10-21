/**
 * LABOR 2D (v2) — DER ZUSTAND AUF DER GPU: alle Puffer einer Szene (Plätze in
 * slots.ts), das Hochladen aus der CPU-Engine und das Zurückholen in sie.
 *
 * Die CPU-Engine bleibt die Werkstatt: Szenen bauen, Werkzeuge anwenden,
 * speichern. Vor einem Handgriff holt der beschleunigte Weg den Zustand in sie
 * zurück (download), danach lädt er ihn wieder hoch (upload). Auf der GPU ist
 * alles f32 (Massen und Energien auch — Abweichung der Bilanzen bis etwa 1e-6
 * relativ; SIMPLIFICATIONS.md).
 */

import type { Engine } from '../engine/engine';
import { FORCE_SLOTS } from '../engine/bubbles';
import { tSat } from '../engine/if97';
import { H2O, N2, O2, SPECIES_SLOTS } from '../engine/units';
import type { GpuCtx } from './kernel';
import { BUBBLE_WORDS, NONE, PARAMS_WORDS, PARTICLE_WORDS, SITE_WORDS } from './lib';
import { CSUM_PARTS } from './ksolver';
import { planLevels, type Plan } from './solver';
import {
  A, BACC_STRIDE, C, CGS_STRIDE, CNT_SIZE, F, FF, G, GLOB_SIZE, H, HACC_STRIDE, HEAT_STRIDE, NA, NAF, NF, NFF, NFU, NU, R, RACC_STRIDE, REG_STRIDE, U
} from './slots';

export interface Dims {
  readonly nx: number;
  readonly ny: number;
  readonly n: number;
  readonly nu: number;
  readonly nv: number;
  readonly nf: number;
  readonly n0: number;
  readonly pcap: number;
  readonly bcap: number;
  readonly nsites: number;
  readonly nreg: number;
  readonly nheat: number;
}

/** Zwischensummen pro Arbeitsgruppe der Kennzahlen (meas). */
export const MEAS_K = 16;
const ST = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;

export class GpuState {
  readonly ctx: GpuCtx;
  readonly d: Dims;
  readonly plan: Plan;
  readonly params: GPUBuffer;
  readonly glob: GPUBuffer;
  readonly cnt: GPUBuffer;
  readonly cf: GPUBuffer;
  readonly cu: GPUBuffer;
  readonly at: GPUBuffer;
  readonly ff: GPUBuffer;
  readonly fu: GPUBuffer;
  readonly af: GPUBuffer;
  readonly partsA: GPUBuffer;
  readonly partsB: GPUBuffer;
  readonly ccountA: GPUBuffer;
  readonly ccountB: GPUBuffer;
  readonly cstart: GPUBuffer;
  readonly bsum: GPUBuffer;
  readonly pkey: GPUBuffer;
  readonly pslot: GPUBuffer;
  readonly pargs: GPUBuffer;
  readonly bubs: GPUBuffer;
  readonly bubs2: GPUBuffer;
  readonly bacc: GPUBuffer;
  readonly btarget: GPUBuffer;
  readonly sites: GPUBuffer;
  readonly sbub: GPUBuffer;
  readonly reg: GPUBuffer;
  readonly racc: GPUBuffer;
  readonly heat: GPUBuffer;
  readonly hacc: GPUBuffer;
  readonly mgF: GPUBuffer;
  readonly mgU: GPUBuffer;
  readonly cgv: GPUBuffer;
  readonly cgs: GPUBuffer;
  readonly lab: GPUBuffer;
  readonly cfl: GPUBuffer;
  readonly csum: GPUBuffer;
  /** Teilsummen der CG-Skalare je Arbeitsgruppe (vier Zeilen). */
  readonly cgp: GPUBuffer;
  readonly meas: GPUBuffer;
  readonly probe: GPUBuffer;
  /** Gebiete: CPU-Nummer → GPU-Nummer (die grössten zuerst) und zurück. */
  private regionMap = new Int32Array(0);
  private regionInv = new Int32Array(0);
  /** Wie viele Arbeitsgruppen die Kennzahlen schreiben (Zellen, Teilchen, Blasen). */
  readonly measGroups: readonly [number, number, number];
  /** Die jetzige Zahl der Kavitäten (die Puffer haben Platz für d.nsites). */
  nsites = 0;
  private readonly own: GPUBuffer[] = [];

  constructor(ctx: GpuCtx, e: Engine) {
    this.ctx = ctx;
    const g = e.grid;
    /* Platz mit Reserve: neue Wände, Seiten und Heizplatten brauchen so selten neue Puffer. */
    const nsites = Math.max(1024, 2 * e.bubbleModel.cavities.count);
    this.d = {
      nx: g.nx, ny: g.ny, n: g.n, nu: g.nu, nv: g.nv, nf: g.nu + g.nv, n0: (g.nx + 2) * (g.ny + 2),
      pcap: e.particles.cap, bcap: e.bubbles.cap, nsites, nreg: Math.max(64, 2 * e.regions.count), nheat: Math.max(16, 2 * e.heat.heaters.length)
    };
    const d = this.d;
    this.plan = planLevels(g.nx, g.ny);
    const b = (label: string, words: number, usage = ST): GPUBuffer => { const x = ctx.buffer(label, 4 * Math.max(4, words), usage); this.own.push(x); return x; };
    this.params = b('params', PARAMS_WORDS, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.glob = b('glob', GLOB_SIZE);
    this.cnt = b('cnt', CNT_SIZE);
    this.cf = b('cf', NF * d.n);
    this.cu = b('cu', NU * d.n);
    this.at = b('at', NA * d.n);
    this.ff = b('ff', NFF * d.nf);
    this.fu = b('fu', NFU * d.nf);
    this.af = b('af', NAF * d.nf);
    this.partsA = b('partsA', PARTICLE_WORDS * d.pcap);
    this.partsB = b('partsB', PARTICLE_WORDS * d.pcap);
    this.ccountA = b('ccountA', d.n + 4);
    this.ccountB = b('ccountB', d.n + 4);
    this.cstart = b('cstart', d.n + 4);
    this.bsum = b('bsum', Math.ceil(d.n / 1024) + 4);
    this.pkey = b('pkey', d.pcap);
    this.pslot = b('pslot', d.pcap);
    this.pargs = b('pargs', 8, ST | GPUBufferUsage.INDIRECT);
    this.bubs = b('bubs', BUBBLE_WORDS * d.bcap);
    this.bubs2 = b('bubs2', BUBBLE_WORDS * d.bcap);
    this.bacc = b('bacc', BACC_STRIDE * d.bcap);
    this.btarget = b('btarget', d.bcap);
    this.sites = b('sites', SITE_WORDS * d.nsites);
    this.sbub = b('sbub', d.nsites);
    this.reg = b('reg', REG_STRIDE * d.nreg);
    this.racc = b('racc', RACC_STRIDE * d.nreg);
    this.heat = b('heat', HEAT_STRIDE * d.nheat);
    this.hacc = b('hacc', HACC_STRIDE * d.nheat);
    this.mgF = b('mgF', this.plan.fSize);
    this.mgU = b('mgU', this.plan.uSize);
    this.cgv = b('cgv', 5 * d.n0);
    this.cgs = b('cgs', CGS_STRIDE);
    this.lab = b('lab', d.n0);
    this.cfl = b('cfl', d.n0);
    this.csum = b('csum', CSUM_PARTS * d.n0);
    this.cgp = b('cgp', 4 * Math.ceil((d.nx * d.ny) / 256) + 16);
    const wg = 256;
    this.measGroups = [Math.ceil(d.n / wg), Math.ceil(d.pcap / wg), Math.ceil(d.bcap / wg)];
    this.meas = b('meas', MEAS_K * (this.measGroups[0] + this.measGroups[1] + this.measGroups[2]));
    this.probe = b('probe', 64);
  }

  /** Passt die Engine noch in diese Puffer (gleiches Gitter, Platz für Kavitäten, Gebiete, Heizgruppen)? */
  fits(e: Engine): boolean {
    const d = this.d;
    return e.grid.nx === d.nx && e.grid.ny === d.ny && e.particles.cap === d.pcap && e.bubbles.cap === d.bcap
      && e.bubbleModel.cavities.count <= d.nsites && e.regions.count <= d.nreg && e.heat.heaters.length <= d.nheat;
  }

  /** Alle Puffer dieser Szene freigeben. */
  destroy(): void {
    this.ctx.release(this.own);
    this.own.length = 0;
  }

  /* -- Hochladen ------------------------------------------------------------------------------------ */

  /** Die Parameter (nach jeder Änderung der Umgebung, der Seiten, der Heizung). */
  writeParams(e: Engine): void {
    const d = this.d;
    const g = e.grid;
    const buf = new ArrayBuffer(4 * PARAMS_WORDS);
    const u = new Uint32Array(buf);
    const f = new Float32Array(buf);
    u.set([d.nx, d.ny, d.n, d.nu, d.nv, d.nf, d.pcap, d.bcap, e.bubbleModel.cavities.count, e.regions.count, e.heat.heaters.length, d.n0], 0);
    f.set([g.dx, g.depth, g.vCell, g.aFace, 1 / g.dx, g.w, g.h, e.dtMax], 12);
    f.set([e.gy, e.pRef, e.regions.pAmb, e.regions.rhoAmb, e.ambientT, e.heat.hExt, e.tol, e.heat.liquidPower], 20);
    const amb = e.gas.amb;
    f.set([amb[0], amb[1], amb[2], amb[4]], 28);
    f.set([e.ambientY[N2], e.ambientY[O2], e.ambientY[H2O], tSat(e.regions.pAmb)], 32);
    u.set([g.openL ? 1 : 0, g.openR ? 1 : 0, g.openB ? 1 : 0, g.openT ? 1 : 0], 36);
    let sealed = 0;
    for (let r = 0; r < e.regions.count; r += 1) if (e.regions.open[r] === 0) sealed = 1;
    u[40] = sealed;
    u[41] = e.optionsUsed.harness === true ? 1 : 0;
    f[42] = e.bubbleModel.contactAngleOverride ?? -1;
    u[43] = 0;
    this.ctx.device.queue.writeBuffer(this.params, 0, buf);
  }

  /** Die Heizgruppen (nach jeder Änderung der Einstellungen). */
  writeHeaters(e: Engine): void {
    const hs = e.heat.heaters;
    const a = new Float32Array(HEAT_STRIDE * this.d.nheat);
    hs.forEach((h, k) => {
      const o = HEAT_STRIDE * k;
      a[o + H.MODE] = h.mode === 'thermostat' ? 1 : 0;
      a[o + H.POWER] = h.power;
      a[o + H.TARGET] = h.target;
      a[o + H.ON] = h.on ? 1 : 0;
      a[o + H.P] = h.P;
      a[o + H.TMEAN] = h.Tmean;
      a[o + H.INTEGRAL] = h.integral;
      a[o + H.CELLS] = h.cells;
    });
    this.ctx.device.queue.writeBuffer(this.heat, 0, a);
  }

  /** Nur die Einstellungen der Heizgruppen (Leistung, Ziel, an/aus), ohne den Zustand des Reglers zu überschreiben. */
  writeHeaterSettings(e: Engine, group: number): void {
    const h = e.heat.heaters[group];
    if (h === undefined || group >= this.d.nheat) return;
    this.ctx.device.queue.writeBuffer(this.heat, 4 * HEAT_STRIDE * group, new Float32Array([h.mode === 'thermostat' ? 1 : 0, h.power, h.target, h.on ? 1 : 0]));
  }

  /** Alles aus der CPU-Engine hochladen. */
  upload(e: Engine): void {
    const q = this.ctx.device.queue;
    const d = this.d;
    const g = e.grid;
    const n = d.n;
    this.writeParams(e);
    this.writeHeaters(e);
    /* Gebiete: die grössten zuerst (die Summen je Gebiet laufen für die ersten vier über die Arbeitsgruppe). */
    const R0 = e.regions;
    const order = Array.from({ length: R0.count }, (_, k) => k).sort((a, b) => R0.vFluid[b] - R0.vFluid[a]);
    this.regionMap = new Int32Array(Math.max(1, R0.count));
    this.regionInv = new Int32Array(Math.max(1, R0.count));
    order.forEach((cpu, gpu) => { this.regionMap[cpu] = gpu; this.regionInv[gpu] = cpu; });
    const reg = new Float32Array(REG_STRIDE * d.nreg);
    for (let r = 0; r < R0.count; r += 1) {
      const o = REG_STRIDE * this.regionMap[r];
      reg[o + R.OPEN] = R0.open[r];
      reg[o + R.VFLUID] = R0.vFluid[r];
      reg[o + R.P0] = R0.p0[r];
      reg[o + R.RHOBAR] = R0.rhoBar[r];
      reg[o + R.VLIQ] = R0.vLiq[r];
      reg[o + R.VBUB] = R0.vBub[r];
      reg[o + R.VGAS] = R0.vGas[r];
      reg[o + R.P0START] = R0.p0[r];
    }
    q.writeBuffer(this.reg, 0, reg);
    /* Zellen. */
    const cu = new Uint32Array(NU * n);
    for (let c = 0; c < n; c += 1) {
      cu[U.KIND * n + c] = g.kind[c];
      cu[U.KPREV * n + c] = g.kind[c];
      cu[U.SOLID * n + c] = g.solid[c];
      cu[U.HGRP * n + c] = g.role[c] === 1 && g.heater[c] >= 0 ? g.heater[c] + 1 : 0;
      const r = R0.id[c];
      cu[U.RID * n + c] = r < 0 ? NONE : this.regionMap[r];
    }
    q.writeBuffer(this.cu, 0, cu);
    const cf = new Float32Array(NF * n);
    const put = (field: number, src: ArrayLike<number>, off = 0): void => { for (let c = 0; c < n; c += 1) cf[field * n + c] = src[off + c]; };
    put(F.PHI, g.phi); put(F.ALPHA, g.alpha); put(F.ALPHAOLD, g.alpha); put(F.PL, g.pl); put(F.PG, g.pg);
    put(F.MN, g.mg, N2 * n); put(F.MO, g.mg, O2 * n); put(F.MV, g.mg, H2O * n); put(F.MF, g.mfog); put(F.HG, g.Hg);
    put(F.ES, g.Es); put(F.FILM, g.film); put(F.T, g.T); put(F.TL, g.Tl); put(F.CL, g.Cl);
    const G0 = e.gas;
    put(F.VGAS, G0.vgas); put(F.RHO, G0.rho); put(F.NMOL, G0.nmol); put(F.CAP, G0.cap); put(F.MU, G0.mu);
    put(F.VEOS, G0.veos); put(F.SRCV, G0.srcV); put(F.VEOSMID, G0.veosMid); put(F.PHIS, g.phiS); put(F.SDF, g.sdf);
    put(F.PTL, g.T);
    q.writeBuffer(this.cf, 0, cf);
    const at = new Float32Array(NA * n);
    for (let c = 0; c < n; c += 1) at[A.VOLSRC * n + c] = e.liquid.volSrc[c];
    q.writeBuffer(this.at, 0, at);
    /* Flächen. */
    const nf = d.nf;
    const ff = new Float32Array(NFF * nf);
    for (let k = 0; k < d.nu; k += 1) { ff[FF.UL * nf + k] = g.ul[k]; ff[FF.UG * nf + k] = g.ug[k]; }
    for (let k = 0; k < d.nv; k += 1) { ff[FF.UL * nf + d.nu + k] = g.vl[k]; ff[FF.UG * nf + d.nu + k] = g.vg[k]; }
    q.writeBuffer(this.ff, 0, ff);
    q.writeBuffer(this.fu, 0, new Uint32Array(NFU * nf));
    const af = new Float32Array(NAF * nf);
    for (let k = 0; k < d.nu; k += 1) af[k] = e.liquid.fU[k];
    for (let k = 0; k < d.nv; k += 1) af[d.nu + k] = e.liquid.fV[k];
    q.writeBuffer(this.af, 0, af);
    /* Teilchen (Struktur je Teilchen, wie PARTICLE_WGSL). */
    const P = e.particles;
    const L = e.liquid;
    const pb = new ArrayBuffer(4 * PARTICLE_WORDS * Math.max(1, P.count));
    const pf = new Float32Array(pb);
    const pu = new Uint32Array(pb);
    const pi = new Int32Array(pb);
    for (let p = 0; p < P.count; p += 1) {
      const o = PARTICLE_WORDS * p;
      pf.set([P.x[p], P.y[p], P.vx[p], P.vy[p], P.c00[p], P.c01[p], P.c10[p], P.c11[p], P.mass[p], P.h[p], P.T[p], P.rho[p], L.dVp[p]], o);
      pu[o + 13] = 0;
      pu[o + 14] = P.id[p];
      pi[o + 15] = L.bi[p];
      pi[o + 16] = L.bj[p];
      for (let k = 0; k < 9; k += 1) pf[o + 17 + k] = L.wt[9 * p + k];
    }
    if (P.count > 0) q.writeBuffer(this.partsA, 0, pb);
    /* Blasen. */
    const B = e.bubbles;
    const motion = e.bubbleModel.motionState;
    const bb = new ArrayBuffer(4 * BUBBLE_WORDS * Math.max(1, B.count));
    const bf = new Float32Array(bb);
    const bu = new Uint32Array(bb);
    const bi = new Int32Array(bb);
    for (let k = 0; k < B.count; k += 1) {
      const o = BUBBLE_WORDS * k;
      const m = k * SPECIES_SLOTS;
      bf.set([B.x[k], B.y[k], B.z[k], B.vx[k], B.vy[k], B.m[m + N2], B.m[m + O2], B.m[m + H2O], B.H[k], B.age[k]], o);
      bi[o + 10] = B.site[k];
      bf.set([B.r[k], B.V[k], B.pb[k], B.pv[k], B.Tb[k], B.dmdt[k], motion.ux0[k], motion.uy0[k]], o + 11);
      bu[o + 19] = B.id[k];
      bu[o + 20] = 1;
      for (let s = 0; s < FORCE_SLOTS; s += 1) bf[o + 21 + s] = B.force[k * FORCE_SLOTS + s];
    }
    if (B.count > 0) q.writeBuffer(this.bubs, 0, bb);
    /* Kavitäten. */
    const cav = e.bubbleModel.cavities;
    this.nsites = cav.count;
    const sb = new ArrayBuffer(4 * SITE_WORDS * d.nsites);
    const su = new Uint32Array(sb);
    const sf = new Float32Array(sb);
    for (let s = 0; s < cav.count; s += 1) {
      const o = SITE_WORDS * s;
      su.set([cav.cell[s], cav.fluid[s], cav.dir[s], 0], o);
      sf.set([cav.r[s], cav.s[s], cav.z[s], 0], o + 4);
    }
    q.writeBuffer(this.sites, 0, sb);
    const sbub = new Uint32Array(d.nsites);
    for (let s = 0; s < cav.count; s += 1) sbub[s] = cav.bubble[s];
    q.writeBuffer(this.sbub, 0, sbub);
    /* Zähler und Schritt. */
    const glob = new Float32Array(GLOB_SIZE);
    glob[G.DT] = e.dt;
    glob[G.TIME] = e.time;
    glob[G.RHOREF] = L.rhoRef;
    q.writeBuffer(this.glob, 0, glob);
    const cnt = new Uint32Array(CNT_SIZE);
    const cntF = new Float32Array(cnt.buffer);
    cnt[C.PCOUNT] = P.count;
    /* Die Teilchen liegen dicht und lebend vor: so viele zählen auch vor dem ersten Sortieren (eine Ablesung gleich nach dem Hochladen sah sonst kein Wasser — und nahm das als Bezugswert der Bilanz). */
    cnt[C.PSORT] = P.count;
    cnt[C.BCOUNT] = B.count;
    cnt[C.NEXTID_B] = Math.max(1, B.nextFree);
    cnt[C.NEXTID_P] = Math.max(1, P.nextFree);
    const bm = e.bubbleModel;
    cnt[C.WATCH] = bm.watch >= 0 ? bm.watch : NONE;
    cnt[C.WATCH_FATE] = bm.watchFate;
    if (bm.firstSuperheat !== null) {
      cntF[C.FIRST_SH] = bm.firstSuperheat + 1000;
      cnt[C.FIRST_MAT] = 1;
    }
    q.writeBuffer(this.cnt, 0, cnt);
    /* Leere Arbeitsspeicher: Zählfelder der Sortierung, Summen beim Verschmelzen. */
    q.writeBuffer(this.ccountA, 0, new Uint32Array(d.n + 4));
    q.writeBuffer(this.ccountB, 0, new Uint32Array(d.n + 4));
    q.writeBuffer(this.bacc, 0, new Uint32Array(BACC_STRIDE * d.bcap));
    q.writeBuffer(this.racc, 0, new Uint32Array(RACC_STRIDE * d.nreg));
    q.writeBuffer(this.hacc, 0, new Uint32Array(HACC_STRIDE * d.nheat));
  }

  /* -- Zurückholen ---------------------------------------------------------------------------------- */

  /** Bereiche von Puffern lesen (ein Zwischenpuffer, eine Übergabe). */
  async read(ranges: readonly { readonly buf: GPUBuffer; readonly offset: number; readonly size: number }[]): Promise<ArrayBuffer[]> {
    const dev = this.ctx.device;
    const sizes = ranges.map((r) => Math.ceil(r.size / 4) * 4);
    const total = sizes.reduce((a, s) => a + s, 0);
    const staging = dev.createBuffer({ label: 'read', size: Math.max(16, total), usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = dev.createCommandEncoder();
    let at = 0;
    ranges.forEach((r, k) => { if (sizes[k] > 0) enc.copyBufferToBuffer(r.buf, r.offset, staging, at, sizes[k]); at += sizes[k]; });
    dev.queue.submit([enc.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const all = staging.getMappedRange().slice(0);
    staging.unmap();
    staging.destroy();
    const out: ArrayBuffer[] = [];
    at = 0;
    for (const s of sizes) { out.push(all.slice(at, at + s)); at += s; }
    return out;
  }

  /** Den Zustand in die CPU-Engine zurückholen (Teilchen, Blasen, Felder, Kavitäten, Gebiete, Heizung, Zeit). */
  async download(e: Engine): Promise<void> {
    const d = this.d;
    const n = d.n;
    const [cntB, globB, cfB, cuB, atB, ffB, afB, heatB, sbubB, regB] = await this.read([
      { buf: this.cnt, offset: 0, size: 4 * CNT_SIZE },
      { buf: this.glob, offset: 0, size: 4 * GLOB_SIZE },
      { buf: this.cf, offset: 0, size: 4 * NF * n },
      { buf: this.cu, offset: 0, size: 4 * NU * n },
      { buf: this.at, offset: 0, size: 4 * NA * n },
      { buf: this.ff, offset: 0, size: 4 * NFF * d.nf },
      { buf: this.af, offset: 0, size: 4 * NAF * d.nf },
      { buf: this.heat, offset: 0, size: 4 * HEAT_STRIDE * d.nheat },
      { buf: this.sbub, offset: 0, size: 4 * d.nsites },
      { buf: this.reg, offset: 0, size: 4 * REG_STRIDE * d.nreg }
    ]);
    const cnt = new Uint32Array(cntB);
    const np = Math.min(d.pcap, cnt[C.PCOUNT]);
    const nb = Math.min(d.bcap, cnt[C.BCOUNT]);
    const [partB, bubB] = await this.read([
      { buf: this.partsA, offset: 0, size: 4 * PARTICLE_WORDS * Math.max(1, np) },
      { buf: this.bubs, offset: 0, size: 4 * BUBBLE_WORDS * Math.max(1, nb) }
    ]);
    const g = e.grid;
    const cf = new Float32Array(cfB);
    const get = (field: number, dst: { [k: number]: number }, off = 0): void => { for (let c = 0; c < n; c += 1) dst[off + c] = cf[field * n + c]; };
    get(F.PHI, g.phi); get(F.ALPHA, g.alpha); get(F.PL, g.pl); get(F.PG, g.pg);
    get(F.MN, g.mg, N2 * n); get(F.MO, g.mg, O2 * n); get(F.MV, g.mg, H2O * n); get(F.MF, g.mfog); get(F.HG, g.Hg);
    get(F.ES, g.Es); get(F.FILM, g.film); get(F.T, g.T); get(F.TL, g.Tl); get(F.CL, g.Cl);
    const G0 = e.gas;
    get(F.VGAS, G0.vgas); get(F.RHO, G0.rho); get(F.NMOL, G0.nmol); get(F.CAP, G0.cap); get(F.MU, G0.mu);
    get(F.VEOS, G0.veos); get(F.SRCV, G0.srcV); get(F.VEOSMID, G0.veosMid);
    const cu = new Uint32Array(cuB);
    for (let c = 0; c < n; c += 1) g.kind[c] = cu[U.KIND * n + c];
    const at = new Float32Array(atB);
    for (let c = 0; c < n; c += 1) e.liquid.volSrc[c] = at[A.VOLSRC * n + c];
    const ff = new Float32Array(ffB);
    const af = new Float32Array(afB);
    const nf = d.nf;
    for (let k = 0; k < d.nu; k += 1) { g.ul[k] = ff[FF.UL * nf + k]; g.ug[k] = ff[FF.UG * nf + k]; e.liquid.fU[k] = af[k]; }
    for (let k = 0; k < d.nv; k += 1) { g.vl[k] = ff[FF.UL * nf + d.nu + k]; g.vg[k] = ff[FF.UG * nf + d.nu + k]; e.liquid.fV[k] = af[d.nu + k]; }
    /* Teilchen. */
    const P = e.particles;
    const L = e.liquid;
    const pf = new Float32Array(partB);
    const pu = new Uint32Array(partB);
    const pi = new Int32Array(partB);
    let count = 0;
    let maxId = 0;
    for (let k = 0; k < np; k += 1) {
      const o = PARTICLE_WORDS * k;
      if ((pu[o + 13] & 1) !== 0 || !(pf[o + 8] > 0)) continue;
      const p = count;
      count += 1;
      P.x[p] = pf[o]; P.y[p] = pf[o + 1]; P.vx[p] = pf[o + 2]; P.vy[p] = pf[o + 3];
      P.c00[p] = pf[o + 4]; P.c01[p] = pf[o + 5]; P.c10[p] = pf[o + 6]; P.c11[p] = pf[o + 7];
      P.mass[p] = pf[o + 8]; P.h[p] = pf[o + 9];
      P.spc[2 * p] = 0; P.spc[2 * p + 1] = 0; P.smass[2 * p] = 0; P.smass[2 * p + 1] = 0; P.mat[p] = 0;
      P.id[p] = pu[o + 14];
      if (P.id[p] > maxId) maxId = P.id[p];
      L.dVp[p] = pf[o + 12];
      L.bi[p] = pi[o + 15];
      L.bj[p] = pi[o + 16];
      for (let w = 0; w < 9; w += 1) L.wt[9 * p + w] = pf[o + 17 + w];
      P.derive(p);
    }
    P.count = count;
    P.reserveIds(Math.max(cnt[C.NEXTID_P], maxId + 1));
    L.weightsDirty = true;
    /* Blasen. */
    const B = e.bubbles;
    const motion = e.bubbleModel.motionState;
    const bf = new Float32Array(bubB);
    const bu = new Uint32Array(bubB);
    const bi = new Int32Array(bubB);
    B.count = 0;
    let maxB = 0;
    for (let k = 0; k < nb; k += 1) {
      const o = BUBBLE_WORDS * k;
      if (bu[o + 20] === 0) continue;
      const b = B.count;
      B.count += 1;
      const m = b * SPECIES_SLOTS;
      B.x[b] = bf[o]; B.y[b] = bf[o + 1]; B.z[b] = bf[o + 2]; B.vx[b] = bf[o + 3]; B.vy[b] = bf[o + 4];
      for (let s = 0; s < SPECIES_SLOTS; s += 1) B.m[m + s] = 0;
      B.m[m + N2] = bf[o + 5]; B.m[m + O2] = bf[o + 6]; B.m[m + H2O] = bf[o + 7];
      B.H[b] = bf[o + 8]; B.age[b] = bf[o + 9]; B.site[b] = bi[o + 10];
      B.r[b] = bf[o + 11]; B.V[b] = bf[o + 12]; B.pb[b] = bf[o + 13]; B.pv[b] = bf[o + 14]; B.Tb[b] = bf[o + 15]; B.dmdt[b] = bf[o + 16];
      motion.ux0[b] = bf[o + 17]; motion.uy0[b] = bf[o + 18];
      B.id[b] = bu[o + 19];
      if (B.id[b] > maxB) maxB = B.id[b];
      for (let s = 0; s < FORCE_SLOTS; s += 1) B.force[b * FORCE_SLOTS + s] = bf[o + 21 + s];
    }
    B.reserveIds(Math.max(cnt[C.NEXTID_B], maxB + 1));
    /* Kavitäten, Gebiete, Heizung, Zeit. */
    const cav = e.bubbleModel.cavities;
    const sbub = new Uint32Array(sbubB);
    for (let s = 0; s < cav.count; s += 1) cav.bubble[s] = sbub[s];
    const reg = new Float32Array(regB);
    for (let r = 0; r < e.regions.count; r += 1) {
      const o = REG_STRIDE * this.regionMap[r];
      e.regions.p0[r] = reg[o + R.P0];
      e.regions.rhoBar[r] = reg[o + R.RHOBAR];
    }
    const heat = new Float32Array(heatB);
    e.heat.heaters.forEach((h, k) => {
      const o = HEAT_STRIDE * k;
      h.P = heat[o + H.P];
      h.Tmean = heat[o + H.TMEAN];
      h.integral = heat[o + H.INTEGRAL];
    });
    const glob = new Float32Array(globB);
    e.dt = glob[G.DT];
    const bm = e.bubbleModel;
    bm.watch = cnt[C.WATCH] === NONE ? -1 : cnt[C.WATCH];
  }

  /** Die GPU-Nummer eines CPU-Gebiets. */
  gpuRegion(cpu: number): number { return this.regionMap[cpu] ?? 0; }
  cpuRegion(gpu: number): number { return this.regionInv[gpu] ?? 0; }
}
