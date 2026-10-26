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
import { MOLAR, muMix } from '../engine/materials';
import { GAS_SPECIES, H2O, N2, O2, R_GAS, SOLID, SPECIES_SLOTS } from '../engine/units';
import { bodyMode, GpuBodies, meltsOnGpu } from './bodies';
import type { GpuCtx } from './kernel';
import { fromStair, stairOf, type Stair } from './staircase';
import { BUBBLE_WORDS, NONE, PARAMS_WORDS, PARTICLE_WORDS, SITE_WORDS } from './lib';
import { extremeParams } from '../engine/extremes';
import { NACL } from '../engine/solution';
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

/** Mole, Zähigkeit und V_eos jeder Zelle aus Massen, T und Druck der Engine (wie Gas.deriveCell und Gas.updateEos; die Engine bleibt, wie sie ist). */
function derivedGas(e: Engine): { nmol: Float64Array; mu: Float64Array; veos: Float64Array } {
  const g = e.grid;
  const n = g.n;
  const nmol = new Float64Array(n);
  const mu = new Float64Array(n);
  const veos = new Float64Array(n);
  for (let c = 0; c < n; c += 1) {
    const mN = g.mg[N2 * n + c];
    const mO = g.mg[O2 * n + c];
    const mV = g.mg[H2O * n + c];
    nmol[c] = mN / MOLAR[N2] + mO / MOLAR[O2] + mV / MOLAR[H2O];
    mu[c] = mN + mO + mV + g.mfog[c] <= 1e-30 ? 1.8e-5 : muMix(mN, mO, mV, g.T[c]);
    veos[c] = g.kind[c] === SOLID || e.gas.vgas[c] <= 0 ? 0 : (nmol[c] * R_GAS * g.T[c]) / e.regions.pAt(c);
  }
  return { nmol, mu, veos };
}

/**
 * Die Gebiete der GPU aus denen der CPU: mit genauen Anteilen (body) verschliesst ein freier Körper nie ein Gebiet — Gebiete, die nur
 * Zellen oder ganz bedeckte Flächen freier Körper trennen, sind auf der GPU eines (offen, wenn eines seiner Teile offen ist). Die CPU
 * verschliesst eine Tasche ab 2 cm³ hinter einem freien Deckel (regions.ts VENT_V) und öffnet sie wieder, sobald er sich hebt; die GPU
 * führt ihre Gebiete beim Rechnen nur fort (eine Zelle, die aufgeht, nimmt das Gebiet eines Nachbarn) — ein verschlossener Topf blieb dort
 * verschlossen, nachdem der Dampf den Deckel abgehoben hatte (+200 kPa, 3,8 J Energiefehler). Ohne genaue Anteile: je CPU-Gebiet eines.
 * Liefert je CPU-Gebiet seine Gruppe und die Zahl der Gruppen.
 */
function regionGroups(e: Engine, body: boolean): { group: Int32Array; count: number } {
  const R = e.regions;
  const parent = Int32Array.from({ length: R.count }, (_, k) => k);
  const find = (k: number): number => { let x = k; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const join = (a: number, b: number): void => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const list = e.bodies.list;
  if (body && list.some((b) => b.free)) {
    const g = e.grid;
    const { nx, ny, n } = g;
    const freeCell = (c: number): boolean => g.solid[c] !== 0 && g.owner[c] > 0 && list[g.owner[c] - 1]?.free === true;
    /* Zusammenhängende Zellen freier Körper: alle Gebiete, an die sie grenzen, sind eines. */
    const seen = new Uint8Array(n);
    const stack: number[] = [];
    for (let c0 = 0; c0 < n; c0 += 1) {
      if (seen[c0] !== 0 || !freeCell(c0)) continue;
      seen[c0] = 1;
      stack.push(c0);
      let first = -1;
      while (stack.length > 0) {
        const c = stack.pop() as number;
        const i = c % nx;
        const j = (c - i) / nx;
        for (let k = 0; k < 4; k += 1) {
          const ii = i + (k === 0 ? -1 : k === 1 ? 1 : 0);
          const jj = j + (k === 2 ? -1 : k === 3 ? 1 : 0);
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const nb = ii + jj * nx;
          if (freeCell(nb)) { if (seen[nb] === 0) { seen[nb] = 1; stack.push(nb); } continue; }
          const r = R.id[nb];
          if (r < 0) continue;
          if (first < 0) first = r; else join(first, r);
        }
      }
    }
    /* Eine ganz bedeckte Fläche zwischen zwei Fluidzellen, die ein freier Körper bedeckt (ein dünner Deckel, der keine Zelle schliesst). */
    const fown = e.bodies.cover.faceOwner;
    const freeFace = (key: number): boolean => { const o = fown[key]; return o > 0 && list[o - 1]?.free === true; };
    for (let j = 0; j < ny; j += 1) {
      for (let i = 1; i < nx; i += 1) {
        const a = i - 1 + j * nx;
        const b = a + 1;
        const ra = R.id[a];
        const rb = R.id[b];
        if (ra >= 0 && rb >= 0 && ra !== rb && g.au[i + j * (nx + 1)] <= 0 && freeFace(i + j * (nx + 1))) join(ra, rb);
      }
    }
    for (let j = 1; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const a = i + (j - 1) * nx;
        const b = a + nx;
        const ra = R.id[a];
        const rb = R.id[b];
        if (ra >= 0 && rb >= 0 && ra !== rb && g.av[i + j * nx] <= 0 && freeFace(g.nu + i + j * nx)) join(ra, rb);
      }
    }
  }
  const group = new Int32Array(R.count);
  const index = new Map<number, number>();
  for (let r = 0; r < R.count; r += 1) {
    const root = find(r);
    let k = index.get(root);
    if (k === undefined) { k = index.size; index.set(root, k); }
    group[r] = k;
  }
  return { group, count: index.size };
}

/**
 * Gas, das auf der GPU in einer geschlossenen Körperzelle liegen blieb (kbodycover.ts bFlip, C_PARKED: kein freier Platz in der Nähe — zwischen
 * zwei gestapelten Klötzen), beim Zurückholen in die nächste Fluidzelle: die Bilanz der CPU zählt Gas in festen Zellen nicht (Prüfung 38:
 * 1,5 mg Luft in 76 Zellen, −59 mJ in der Bilanz der CPU-Engine). Gesucht wird durch Körperzellen, nicht durch gemalten Feststoff.
 */
function unpark(e: Engine): void {
  const g = e.grid;
  const { nx, ny, n } = g;
  let seen: Int32Array | null = null;
  let queue: Int32Array | null = null;
  for (let c = 0; c < n; c += 1) {
    if (g.solid[c] === 0 || g.owner[c] === 0) continue;
    let m = g.mfog[c];
    for (let k = 0; k < GAS_SPECIES; k += 1) m += g.mg[k * n + c];
    if (!(m > 0) && g.Hg[c] === 0) continue;
    seen ??= new Int32Array(n).fill(-1);
    queue ??= new Int32Array(n);
    let head = 0;
    let tail = 0;
    queue[tail++] = c;
    seen[c] = c;
    let target = -1;
    while (head < tail && target < 0) {
      const q = queue[head++];
      const qi = q % nx;
      const qj = (q - qi) / nx;
      for (let k = 0; k < 4 && target < 0; k += 1) {
        const ii = qi + (k === 0 ? -1 : k === 1 ? 1 : 0);
        const jj = qj + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const nb = ii + jj * nx;
        if (seen[nb] === c) continue;
        seen[nb] = c;
        if (g.solid[nb] === 0) target = nb;
        else if (g.owner[nb] !== 0) queue[tail++] = nb;
      }
    }
    if (target >= 0) e.gas.move(c, target, 1);
  }
}

export class GpuState {
  /** Die Treppe der Körper beim letzten Hochladen (staircase.ts) — beim Zurückholen gebraucht; null, wenn alle Körper genaue Anteile haben. */
  private stair: Stair | null = null;
  /** Die Treppe beim letzten Hochladen (die Aufnahme beim Backen, capture.ts, braucht ihre Zellen und Temperaturen). */
  get staircase(): Stair | null { return this.stair; }
  /** Rechnen alle Körper mit genauen Anteilen (eine Szene mit freien Körpern, seit 2026-10-26; bodies.ts)? */
  body = false;
  /** Die Körper auf der GPU (bodies.ts; ohne freie Körper leer). */
  readonly bodies: GpuBodies;
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
    this.bodies = new GpuBodies(ctx, e);
  }

  /** Passt die Engine noch in diese Puffer (gleiches Gitter, Platz für Kavitäten, Gebiete, Heizgruppen, Körper)? */
  fits(e: Engine): boolean {
    const d = this.d;
    return e.grid.nx === d.nx && e.grid.ny === d.ny && e.particles.cap === d.pcap && e.bubbles.cap === d.bcap
      && e.bubbleModel.cavities.count <= d.nsites && e.regions.count <= d.nreg && e.heat.heaters.length <= d.nheat && this.bodies.fits(e);
  }

  /** Alle Puffer dieser Szene freigeben. */
  destroy(): void {
    this.ctx.release(this.own);
    this.own.length = 0;
    this.bodies.destroy();
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
    /* Andere Flüssigkeiten als Wasser in der Szene (M2a): Zähigkeit und Drift der Tröpfchen laufen nur dann. */
    u[43] = e.particles.hasOther() ? 1 : 0;
    /* Heftige Zustände (extremes.ts): Wärmestromdichte der Wände an Blasen, Keimen spätestens bei, Teilchen höchstens, Blasen höchstens. */
    const x = extremeParams(e.scene.extremes, e.regions.pAmb, Math.abs(e.gy));
    f.set([x.chf, x.actMax, x.vmax, x.bubCap], 44);
    /* Körper mit genauen Anteilen (bodies.ts): ein? wie viele? Lagen der Druckfortsetzung. */
    u.set([this.body ? 1 : 0, this.body ? this.bodies.nbody : 0, this.bodies.layers, 0], 48);
    this.ctx.device.queue.writeBuffer(this.params, 0, buf);
  }

  /** Die Heizgruppen (nach jeder Änderung der Einstellungen); cells: Zellen je Gruppe auf der GPU (die Treppe der Platte), sonst die der CPU. */
  writeHeaters(e: Engine, cells: readonly number[] | null = null): void {
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
      a[o + H.CELLS] = cells !== null ? (cells[k] ?? 0) : (this.stair?.heaterCells[k] ?? h.cells);
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
    /*
     * Ohne freie Körper die Körper als Treppen ganzer Zellen (staircase.ts); mit freien Körpern rechnen alle mit genauen Anteilen
     * (bodies.ts): die Zellen so, wie die CPU sie hat — der erste Schritt deckt jeden Körper neu ab (seine Paare dünner Wände).
     */
    this.body = bodyMode(e);
    this.bodies.upload(e);
    const st = this.body ? null : stairOf(e);
    this.stair = st;
    this.writeParams(e);
    this.writeHeaters(e, st !== null ? st.heaterCells : null);
    /* Gebiete: die grössten zuerst (die Summen je Gebiet laufen für die ersten vier über die Arbeitsgruppe); mit genauen Anteilen trennt ein
       freier Körper keine (regionGroups: was nur er trennt, ist ein Gebiet der GPU). */
    const R0 = e.regions;
    const { group, count: ng } = regionGroups(e, this.body);
    const gv = new Float64Array(Math.max(1, ng));
    const members = new Int32Array(Math.max(1, ng));
    for (let r = 0; r < R0.count; r += 1) { gv[group[r]] += R0.vFluid[r]; members[group[r]] += 1; }
    const order = Array.from({ length: ng }, (_, k) => k).sort((a, b) => gv[b] - gv[a]);
    const rank = new Int32Array(Math.max(1, ng));
    order.forEach((k, gpu) => { rank[k] = gpu; });
    this.regionMap = new Int32Array(Math.max(1, R0.count));
    this.regionInv = new Int32Array(Math.max(1, ng));
    for (let r = R0.count - 1; r >= 0; r -= 1) { this.regionMap[r] = rank[group[r]]; this.regionInv[rank[group[r]]] = r; }
    const reg = new Float32Array(REG_STRIDE * d.nreg);
    const pw = new Float64Array(Math.max(1, ng));
    const rw = new Float64Array(Math.max(1, ng));
    for (let r = 0; r < R0.count; r += 1) {
      const k = group[r];
      const o = REG_STRIDE * rank[k];
      if (members[k] === 1) {
        reg[o + R.OPEN] = R0.open[r];
        reg[o + R.VFLUID] = R0.vFluid[r] - (st !== null ? st.vFix[r] : 0);
        reg[o + R.P0] = R0.p0[r];
        reg[o + R.RHOBAR] = R0.rhoBar[r];
        reg[o + R.VLIQ] = R0.vLiq[r];
        reg[o + R.VBUB] = R0.vBub[r];
        reg[o + R.VGAS] = R0.vGas[r];
        reg[o + R.P0START] = R0.p0[r];
        continue;
      }
      /* Zusammengelegt: offen, wenn ein Teil offen ist; Volumina summiert, Druck und Dichte nach dem Fluidvolumen gemittelt (ein offenes Gebiet
         nimmt im ersten Schritt den Umgebungsdruck, ein verschlossenes rechnet ihn aus seinem Inhalt — gasRegions regFinish). */
      if (R0.open[r] !== 0) reg[o + R.OPEN] = 1;
      reg[o + R.VFLUID] += R0.vFluid[r];
      reg[o + R.VLIQ] += R0.vLiq[r];
      reg[o + R.VBUB] += R0.vBub[r];
      reg[o + R.VGAS] += R0.vGas[r];
      pw[k] += R0.p0[r] * R0.vFluid[r];
      rw[k] += R0.rhoBar[r] * R0.vFluid[r];
    }
    for (let k = 0; k < ng; k += 1) {
      if (members[k] === 1) continue;
      const o = REG_STRIDE * rank[k];
      reg[o + R.P0] = gv[k] > 0 ? pw[k] / gv[k] : e.pRef;
      if (reg[o + R.OPEN] !== 0) reg[o + R.P0] = e.regions.pAmb;
      reg[o + R.RHOBAR] = gv[k] > 0 ? rw[k] / gv[k] : e.regions.rhoAmb;
      reg[o + R.P0START] = reg[o + R.P0];
    }
    q.writeBuffer(this.reg, 0, reg);
    /* Zellen. */
    const cu = new Uint32Array(NU * n);
    for (let c = 0; c < n; c += 1) {
      const painted = g.solid[c] !== 0 && g.owner[c] === 0;
      if (st !== null) {
        cu[U.KIND * n + c] = st.kind[c];
        cu[U.KPREV * n + c] = st.kind[c];
        cu[U.SOLID * n + c] = st.solid[c];
        cu[U.HGRP * n + c] = st.hgrp[c];
      } else {
        cu[U.KIND * n + c] = g.kind[c];
        cu[U.KPREV * n + c] = g.kind[c];
        cu[U.SOLID * n + c] = g.solid[c];
        /* Heizzellen nur aus gemaltem Feststoff; eine Heizplatte heizt über ihre Anteile (bCover: F_HW). */
        cu[U.HGRP * n + c] = painted && g.role[c] === 1 && g.heater[c] >= 0 ? g.heater[c] + 1 : 0;
        cu[U.OWNER * n + c] = g.owner[c];
        cu[U.MATB * n + c] = g.matB[c];
        cu[U.PAINT * n + c] = painted ? 1 : 0;
      }
      const r = R0.id[c];
      cu[U.RID * n + c] = r < 0 ? NONE : this.regionMap[r];
    }
    q.writeBuffer(this.cu, 0, cu);
    const cf = new Float32Array(NF * n);
    const put = (field: number, src: ArrayLike<number>, off = 0): void => { for (let c = 0; c < n; c += 1) cf[field * n + c] = src[off + c]; };
    put(F.PHI, g.phi); put(F.ALPHA, g.alpha); put(F.ALPHAOLD, g.alpha); put(F.PL, g.pl); put(F.PG, g.pg);
    put(F.MN, g.mg, N2 * n); put(F.MO, g.mg, O2 * n); put(F.MV, g.mg, H2O * n); put(F.MF, g.mfog); put(F.HG, g.Hg);
    put(F.ES, st !== null ? st.es : g.Es); put(F.FILM, st !== null ? st.film : g.film); put(F.T, st !== null ? st.T : g.T); put(F.TL, g.Tl); put(F.CL, g.Cl);
    if (st === null) {
      const cv = e.bodies.cover;
      put(F.FS, g.fs); put(F.CAPB, g.capB); put(F.TSB, g.Ts); put(F.ESY, cv.esSync); put(F.FSY, cv.filmSync); put(F.KSY, cv.crustSync); put(F.WSUM, cv.wsum);
    }
    const G0 = e.gas;
    /* Mole, Zähigkeit und V_eos nicht aus der Engine, sondern aus ihrem Zustand neu (V_eos zur Mitte = V_eos): ein Schlüsselbild trägt
       sie nicht (Arbeitsspeicher, snapshot.ts SCRATCH) — mit den Feldern einer daraus gebauten Engine lief der Druck eines
       verschlossenen Gebiets auf der GPU davon (bis 8 bar). */
    const der = derivedGas(e);
    put(F.VGAS, G0.vgas); put(F.RHO, G0.rho); put(F.NMOL, der.nmol); put(F.CAP, G0.cap); put(F.MU, der.mu);
    put(F.VEOS, der.veos); put(F.SRCV, G0.srcV); put(F.VEOSMID, der.veos); put(F.PHIS, st !== null ? st.phiS : g.phiS); put(F.SDF, st !== null ? st.sdf : g.sdf);
    put(F.PTL, st !== null ? st.T : g.T);
    /* Salz (M2b): Kruste je Zelle (Körperteile: ihr Spiegel), Salz am Boden der Kiste je Spalte; a_w = 1 bis zur ersten Sammlung. */
    put(F.CRUST, g.crust);
    for (let i = 0; i < g.nx; i += 1) { cf[F.FLOOR * n + i] = e.salt.floor[i]; cf[F.FLOORH * n + i] = e.salt.floorH[i]; }
    cf.fill(1, F.AW * n, (F.AW + 1) * n);
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
      /* Merkmale: Bit 0 tot, Bits 8..15 die Flüssigkeit (M2a). */
      pu[o + 13] = (P.mat[p] & 0xff) << 8;
      pu[o + 14] = P.id[p];
      pi[o + 15] = L.bi[p];
      pi[o + 16] = L.bj[p];
      for (let k = 0; k < 9; k += 1) pf[o + 17 + k] = L.wt[9 * p + k];
      /* Gelöstes Salz (M2b). */
      pf[o + 26] = P.smass[2 * p];
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
    /* Die Wandzelle einer Kavität muss auf der GPU fest sein (der Kern nimmt ihr die Wärme): liegt sie in einer Zelle, die die Treppe frei lässt,
       nimmt die feste Nachbarzelle nach innen ihren Platz ein; gibt es keine, keimt die Kavität dort nicht (winziger Radius). */
    const nxg = g.nx;
    const solidAt = (c: number): number => (st !== null ? st.solid[c] : g.solid[c]);
    for (let s = 0; s < cav.count; s += 1) {
      const o = SITE_WORDS * s;
      let wall = cav.cell[s];
      let r = cav.r[s];
      /* Kavitäten auf freien Körpern und auf schmelzendem Eis (seine Wandzellen gehen auf, wenn es schmilzt) kennt der beschleunigte Weg nicht
         (SIMPLIFICATIONS.md): sie keimen nie. */
      const owner = cav.body[s] >= 0 ? e.bodies.list[cav.body[s]] : undefined;
      if (owner !== undefined && (owner.free || meltsOnGpu(owner))) r = 1e-9;
      if (wall >= 0 && solidAt(wall) === 0) {
        const k = cav.dir[s];
        const inward = k === 0 ? wall + 1 : k === 1 ? wall - 1 : k === 2 ? wall + nxg : wall - nxg;
        if (inward >= 0 && inward < n && solidAt(inward) !== 0) wall = inward;
        else r = 1e-9;
      }
      if (wall < 0) { wall = 0; r = 1e-9; }
      su.set([wall, cav.fluid[s], cav.dir[s], 0], o);
      sf.set([r, cav.s[s], cav.z[s], 0], o + 4);
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
    get(F.CRUST, g.crust);
    for (let i = 0; i < g.nx; i += 1) { e.salt.floor[i] = cf[F.FLOOR * n + i]; e.salt.floorH[i] = cf[F.FLOORH * n + i]; }
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
      const s = pf[o + 26] > 0 ? pf[o + 26] : 0;
      P.spc[2 * p] = s > 0 ? NACL : 0; P.spc[2 * p + 1] = 0; P.smass[2 * p] = s; P.smass[2 * p + 1] = 0; P.mat[p] = (pu[o + 13] >>> 8) & 0xff;
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
    if (!this.body) {
      /* Die Treppen der Körper zurück in ihre inneren Zellen, die Anteile der CPU neu. */
      fromStair(e, this.stair);
      return;
    }
    /*
     * Genaue Anteile: die Zellen, wie die GPU sie schloss (gemalter Feststoff bleibt), die Körper selbst (bodies.ts), dann baut die
     * CPU ihre Zellen aus den inneren Zellen neu — Zellen, die sie anders schliesst (die Paare dünner Wände), wechseln mit ihrem Gas
     * wie nach jeder Bewegung, und die Gebiete werden neu bestimmt.
     */
    for (let c = 0; c < n; c += 1) {
      if (cu[U.PAINT * n + c] !== 0) continue;
      g.solid[c] = cu[U.SOLID * n + c];
      g.owner[c] = cu[U.OWNER * n + c];
      g.matB[c] = cu[U.MATB * n + c];
      g.fs[c] = cf[F.FS * n + c];
      g.capB[c] = cf[F.CAPB * n + c];
      g.Ts[c] = cf[F.TSB * n + c];
    }
    unpark(e);
    await this.bodies.download(e, (r) => this.read(r));
    const cover = e.bodies.cover;
    for (const b of e.bodies.list) if (!b.gone) cover.weigh(b);
    cover.addAll();
    cover.topologyChanged = true;
    e.bodies.sync();
  }

  /** Die GPU-Nummer eines CPU-Gebiets. */
  gpuRegion(cpu: number): number { return this.regionMap[cpu] ?? 0; }
  cpuRegion(gpu: number): number { return this.regionInv[gpu] ?? 0; }
}
