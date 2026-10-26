/**
 * LABOR 2D (v2) — DIE LÖSER AUF DER GPU: Plan der Mehrgitterstufen über dem
 * ganzen Gitter (einmal je Szene; die Stufe selbst hängt nur von nx, ny ab,
 * welche Zellen mitmachen, entscheidet `act` in jedem Lösen neu) und das
 * Aufzeichnen eines Laufs in einen Rechenpass (Kerne in ksolver.ts).
 *
 * Ein Lauf hat so viele Iterationen, wie der Aufrufer verlangt (aus der
 * Zahl, die die letzten Läufe brauchten); ist die Toleranz früher erreicht,
 * tun die übrigen Aufrufe nichts.
 */

import type { GpuCtx, Resource } from './kernel';
import { COARSE_CELLS, MAX_LEVELS, TAIL_SH } from './ksolver';
import { C, CGS_STRIDE } from './slots';

/* xp: x nach dem Vorglätten — getrennt von x, weil das Nachglätten einer Kachel x schreibt, während die Nachbarkacheln im selben Aufruf ihren Rand lesen. */
const F_FIELDS = ['ax', 'ay', 'dH', 'dDx', 'dDy', 'diag', 'inv', 'x', 'xp', 'b', 'gx', 'gy', 'gDx', 'gDy', 'eDx', 'eDy', 'area', 'ox', 'oy'] as const;
type FField = (typeof F_FIELDS)[number];

export interface LevelPlan {
  readonly nx: number;
  readonly ny: number;
  readonly stride: number;
  readonly size: number;
  readonly h: number;
  readonly f: Readonly<Record<FField | 'pW', number>>;
  readonly act: number;
  readonly pIdx: number;
}

export interface Plan {
  readonly levels: readonly LevelPlan[];
  /** Grösse von mgF und mgU (Wörter). */
  readonly fSize: number;
  readonly uSize: number;
  /** Erste Stufe, die in der Arbeitsgruppe des Schwanzes läuft. */
  readonly lt: number;
}

/** Die Stufen über dem ganzen Gitter nx × ny (wie GridSolver: halbiert, bis höchstens COARSE_CELLS Zellen). */
export function planLevels(nx: number, ny: number): Plan {
  const levels: LevelPlan[] = [];
  let fOff = 0;
  let uOff = 0;
  let lx = nx;
  let ly = ny;
  let h = 1;
  let prev = 0;
  for (;;) {
    const stride = lx + 2;
    const size = (lx + 2) * (ly + 2);
    const f = {} as Record<FField | 'pW', number>;
    for (const k of F_FIELDS) { f[k] = fOff; fOff += size; }
    const act = uOff;
    uOff += size;
    let pIdx = 0;
    f.pW = 0;
    if (levels.length > 0) {
      f.pW = fOff;
      fOff += 4 * prev;
      pIdx = uOff;
      uOff += 4 * prev;
    }
    levels.push({ nx: lx, ny: ly, stride, size, h, f, act, pIdx });
    if (lx * ly <= COARSE_CELLS || (lx <= 2 && ly <= 2) || levels.length >= MAX_LEVELS) break;
    prev = size;
    lx = Math.ceil(lx / 2);
    ly = Math.ceil(ly / 2);
    h *= 2;
  }
  /* Der Schwanz: die ersten Stufen, deren Zellen zusammen in den gemeinsamen Speicher einer Arbeitsgruppe passen (TAIL_SH). */
  let lt = levels.length - 1;
  for (let l = 0; l < levels.length; l += 1) {
    let sum = 0;
    for (let m = l; m < levels.length; m += 1) sum += levels[m].size;
    if (sum <= TAIL_SH) { lt = l; break; }
  }
  return { levels, fSize: fOff, uSize: uOff, lt };
}

/** Eine Stufe als die 32 Wörter von struct Level. */
function levelWords(L: LevelPlan | null, lv: number, out: Uint32Array, o: number): void {
  if (L === null) return;
  const w = [
    L.nx, L.ny, L.stride, L.size,
    L.f.ax, L.f.ay, L.f.dH, L.f.dDx,
    L.f.dDy, L.f.diag, L.f.inv, L.f.x,
    L.f.b, L.h, L.f.gx, L.f.gy,
    L.f.gDx, L.f.gDy, L.f.eDx, L.f.eDy,
    L.f.area, L.f.ox, L.f.oy, L.act,
    L.pIdx, L.f.pW, lv, L.f.xp, 0, 0, 0, 0
  ];
  out.set(w, o);
}

/** Die Einstellungen eines Lösers: Toleranz und die Plätze seiner Kennzahlen in `cnt`. */
export interface SolveKind {
  readonly tol: number;
  readonly it: number;
  readonly cap: number;
  readonly res: number;
}

export const SOLVE_LIQUID: SolveKind = { tol: 1e-5, it: C.IT_L, cap: C.CAP_L, res: C.RES_L };
export const SOLVE_GAS: SolveKind = { tol: 1e-5, it: C.IT_G, cap: C.CAP_G, res: C.RES_G };
export const SOLVE_HEAT: SolveKind = { tol: 1e-5, it: C.IT_H, cap: C.CAP_H, res: C.RES_H };
export const SOLVE_DIFF: SolveKind = { tol: 1e-5, it: C.IT_D, cap: C.CAP_D, res: C.RES_H };
/** Die Lösungen der mitbewegten Masse eines Körpers (wie bodies.probe: 1e-4). */
export const SOLVE_PROBE: SolveKind = { tol: 1e-4, it: C.IT_P, cap: C.CAP_P, res: C.RES_P };

export interface SolverBuffers {
  readonly params: GPUBuffer;
  readonly mgF: GPUBuffer;
  readonly mgU: GPUBuffer;
  readonly cgv: GPUBuffer;
  readonly cgs: GPUBuffer;
  readonly lab: GPUBuffer;
  readonly cfl: GPUBuffer;
  readonly csum: GPUBuffer;
  readonly cnt: GPUBuffer;
  readonly cgp: GPUBuffer;
}

/** Höchstzahl der Iterationen eines Laufs (Uniform-Plätze). */
export const MAX_ITER = 200;
const SLOT = 256;

export class GpuSolver {
  private readonly ctx: GpuCtx;
  private readonly plan: Plan;
  private readonly b: SolverBuffers;
  private readonly l0: GPUBuffer;
  private readonly lp: GPUBuffer;
  private readonly lv: GPUBuffer;
  private readonly it: GPUBuffer;
  private readonly cfg: GPUBuffer;
  private readonly kinds: SolveKind[] = [];
  private readonly groups = new Map<string, GPUBindGroup>();
  private readonly n0cells: number;

  constructor(ctx: GpuCtx, plan: Plan, buffers: SolverBuffers) {
    this.ctx = ctx;
    this.plan = plan;
    this.b = buffers;
    const L = plan.levels;
    this.n0cells = L[0].nx * L[0].ny;
    /* Stufe 0 allein, je Stufe das Paar (feiner, diese), alle zusammen (Schwanz), die Iterationszahlen, die Löser. */
    const w0 = new Uint32Array(32);
    levelWords(L[0], 0, w0, 0);
    this.l0 = ctx.uniform('l0', w0.buffer);
    const pairs = new Uint32Array((SLOT / 4) * L.length);
    for (let l = 0; l < L.length; l += 1) {
      levelWords(l > 0 ? L[l - 1] : null, l - 1, pairs, (SLOT / 4) * l);
      levelWords(L[l], l, pairs, (SLOT / 4) * l + 32);
    }
    this.lp = ctx.uniform('lp', pairs.buffer);
    const all = new Uint32Array(32 * MAX_LEVELS + 4);
    for (let l = 0; l < L.length; l += 1) levelWords(L[l], l, all, 32 * l);
    all[32 * MAX_LEVELS] = plan.lt;
    all[32 * MAX_LEVELS + 1] = L.length;
    this.lv = ctx.uniform('lv', all.buffer);
    const its = new Uint32Array((SLOT / 4) * (MAX_ITER + 1));
    for (let k = 0; k < MAX_ITER; k += 1) its[(SLOT / 4) * k] = k;
    its[(SLOT / 4) * MAX_ITER] = 0xffffffff;
    this.it = ctx.uniform('iter', its.buffer);
    this.cfg = ctx.uniform('solvecfg', new ArrayBuffer(SLOT * 8));
    for (const k of [SOLVE_LIQUID, SOLVE_GAS, SOLVE_HEAT, SOLVE_DIFF, SOLVE_PROBE]) this.setKind(k);
  }

  get levels(): number { return this.plan.levels.length; }
  /** Stufe 0 als Uniform (für die Kerne, die ein System aufbauen). */
  get level0(): GPUBuffer { return this.l0; }

  /** Die eigenen Puffer freigeben (beim Neuaufbau des Zustands). */
  destroy(): void {
    this.ctx.release([this.l0, this.lp, this.lv, this.it, this.cfg]);
    this.groups.clear();
  }

  /** Die Einstellungen eines Lösers (bis zu vier verschiedene). */
  private setKind(k: SolveKind): number {
    let i = this.kinds.indexOf(k);
    if (i >= 0) return i;
    i = this.kinds.length;
    this.kinds.push(k);
    const buf = new ArrayBuffer(16);
    new Float32Array(buf, 0, 1)[0] = k.tol * k.tol;
    new Uint32Array(buf, 4, 3).set([k.it, k.cap, k.res]);
    this.ctx.device.queue.writeBuffer(this.cfg, SLOT * i, buf);
    return i;
  }

  /** Die Toleranz eines Lösers ändern (Prüfstand). */
  setTolerance(k: SolveKind, tol: number): void {
    const i = this.setKind(k);
    this.ctx.device.queue.writeBuffer(this.cfg, SLOT * i, new Float32Array([tol * tol]));
  }

  private range(buf: GPUBuffer, slot: number, size: number): Resource {
    return { buffer: buf, offset: SLOT * slot, size };
  }

  /** Bindungsgruppe (zwischengespeichert) eines Kerns mit den Puffern des Lösers und den gewählten Uniform-Plätzen. */
  private group(name: string, key: string, extra: Readonly<Record<string, Resource>>): GPUBindGroup {
    const id = `${name}|${key}`;
    let g = this.groups.get(id);
    if (g === undefined) {
      const b = this.b;
      g = this.ctx.bind(name, { P: b.params, mgF: b.mgF, mgU: b.mgU, cgv: b.cgv, cgs: b.cgs, lab: b.lab, cfl: b.cfl, csum: b.csum, cnt: b.cnt, cgp: b.cgp, L: this.l0, LV: this.lv, ...extra });
      this.groups.set(id, g);
    }
    return g;
  }

  private run(pass: GPUComputePassEncoder, name: string, threads: number, key = '', extra: Readonly<Record<string, Resource>> = {}): void {
    this.ctx.dispatch(pass, name, this.group(name, key, extra), threads);
  }

  private one(pass: GPUComputePassEncoder, name: string, key = '', extra: Readonly<Record<string, Resource>> = {}): void {
    this.ctx.dispatchOne(pass, name, this.group(name, key, extra));
  }

  private lpRes(l: number): Resource { return this.range(this.lp, l, SLOT); }
  private itRes(k: number): Resource { return this.range(this.it, k, 16); }

  /** Vorbereitung bis zum Anfangsresiduum; reuse: die groben Stufen stehen noch vom letzten Lauf mit derselben Matrix (die Messung der mitbewegten Masse gleich nach der Projektion). */
  private prepare(pass: GPUComputePassEncoder, kind: SolveKind, nullspace: boolean, reuse = false): void {
    const cfgSlot = this.setKind(kind);
    const sv = { SV: this.range(this.cfg, cfgSlot, 16) };
    const n = this.n0cells;
    this.run(pass, 'cgPrep1', n, `c${cfgSlot}`, sv);
    this.run(pass, 'cgPrep2', n);
    if (nullspace) {
      this.run(pass, 'cclMerge', n);
      this.run(pass, 'cclFinal', n);
      this.run(pass, 'cclProject', n);
    }
    if (!reuse) this.coarsen(pass);
    this.run(pass, 'cgInitMG', n);
    this.ctx.dispatchOne(pass, 'cgFoldInitMG', this.group('cgFoldInitMG', '', {}));
  }

  /** Die groben Stufen aus der feinsten bauen. */
  private coarsen(pass: GPUComputePassEncoder): void {
    const { levels, lt } = this.plan;
    for (let l = 1; l < levels.length && l <= lt; l += 1) {
      const C = levels[l];
      const F = levels[l - 1];
      const r = { LP: this.lpRes(l) };
      this.run(pass, 'mgC1', C.nx * C.ny, `l${l}`, r);
      this.run(pass, 'mgC2', C.nx * C.ny, `l${l}`, r);
      this.run(pass, 'mgC3', C.nx * C.ny, `l${l}`, r);
      this.run(pass, 'mgC4', F.nx * F.ny, `l${l}`, r);
    }
    if (lt + 1 < levels.length) this.ctx.dispatchOne(pass, 'mgTailBuild', this.group('mgTailBuild', '', {}));
  }

  /** z = M⁻¹ r: ein V-Zyklus (r in b, z in x der feinsten Stufe). */
  private vcycle(pass: GPUComputePassEncoder): void {
    const { levels, lt } = this.plan;
    /* Grosse Stufen: Vorglätten in Kacheln (vier Durchgänge, ein Aufruf), Restriktion; zurück Verlängerung und Nachglätten in einem Aufruf. */
    const tiles = (L: LevelPlan): number => 256 * Math.ceil(L.nx / 16) * Math.ceil(L.ny / 16);
    const tiles12 = (L: LevelPlan): number => 256 * Math.ceil(L.nx / 12) * Math.ceil(L.ny / 12);
    for (let l = 0; l < lt; l += 1) this.run(pass, 'mgPreR', tiles12(levels[l]), `l${l + 1}`, { LP: this.lpRes(l + 1) });
    this.ctx.dispatchOne(pass, 'mgTail', this.group('mgTail', '', {}));
    for (let l = lt - 1; l >= 0; l -= 1) this.run(pass, 'mgPost', tiles(levels[l]), `l${l + 1}`, { LP: this.lpRes(l + 1) });
  }

  /**
   * Ein Lauf mit dem Mehrgitter: das System steht in Stufe 0 (Koeffizienten,
   * act) und in cgv (x, b). `nullspace`: rein Neumann'sche Gebiete möglich
   * (Druck) — dann Vereinigungssuche und in jeder Iteration das Mittel aus z;
   * hat jede Zelle einen Flächenterm (Wärme, Diffusion), nicht.
   */
  encodeMG(pass: GPUComputePassEncoder, kind: SolveKind, iterations: number, nullspace = true, zproj = nullspace, reuse = false): void {
    const n = this.n0cells;
    this.prepare(pass, kind, nullspace, reuse);
    const rz = (k: number, key: string): void => {
      const r = { IT: this.itRes(k) };
      if (zproj) { this.run(pass, 'cgZSum', n, key, r); this.run(pass, 'cgZSub', n, key, r); }
      else this.run(pass, 'cgRZ', n, key, r);
    };
    this.vcycle(pass);
    rz(MAX_ITER, `k${MAX_ITER}`);
    const E = Math.min(MAX_ITER, Math.max(1, iterations));
    for (let k = 0; k < E; k += 1) {
      const r = { IT: this.itRes(k) };
      this.run(pass, 'cgA', n, `k${k}`, r);
      this.run(pass, 'cgB', n, `k${k}`, r);
      this.one(pass, 'cgFoldRR', `k${k}`, r);
      this.vcycle(pass);
      rz(k, `k${k}`);
    }
    this.finish(pass, kind, nullspace);
  }

  private finish(pass: GPUComputePassEncoder, kind: SolveKind, nullspace: boolean): void {
    const cfgSlot = this.setKind(kind);
    this.run(pass, 'cgEnd1', this.n0cells, `c${cfgSlot}`, { SV: this.range(this.cfg, cfgSlot, 16) });
    if (nullspace) this.run(pass, 'cgEnd2', this.n0cells);
  }
}

/** Grösse des Puffers der CG-Skalare (Wörter). */
export const CGS_WORDS = CGS_STRIDE;
