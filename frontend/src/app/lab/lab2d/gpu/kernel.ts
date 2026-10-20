/**
 * LABOR 2D (v2) — DIE KERNE DES BESCHLEUNIGTEN WEGS: ein kleiner Baukasten über
 * WebGPU. Ein Kern ist WGSL-Text mit einer Liste seiner Bindungen
 * (`name:modus<typ>`): u = uniform, r = Speicher lesend, w = Speicher
 * schreibend, a = Speicher als atomic<u32> (mit Helfern addF_, getF_, setF_,
 * maxU_ für f32-Werte über Vergleichen-und-Tauschen — die Reihenfolge der
 * Summen ist dann nicht festgelegt, das ist hier erlaubt). Davor steht die
 * gemeinsame Bibliothek (lib.ts). Bindungsgruppen entstehen über Namen.
 */

import { LIB } from './lib';

/** u uniform, r/w Speicher, a atomar, t Speichertextur (schreibend), x Textur (lesend), s Sampler. */
type Mode = 'u' | 'r' | 'w' | 'a' | 't' | 'x' | 's';

interface BindSpec {
  readonly name: string;
  readonly mode: Mode;
  readonly type: string;
}

export interface KernelDef {
  readonly name: string;
  /** Bindungen, z. B. `P:u glob:r parts:w<Particle> cnt:a`. */
  readonly bind: string;
  /** WGSL ab den Bindungen: Hilfsfunktionen und `@compute @workgroup_size(WG) fn main(…)`. */
  readonly code: string;
  readonly wg?: number;
}

export class Kernel {
  readonly name: string;
  readonly binds: readonly BindSpec[];
  readonly wg: number;
  readonly source: string;
  pipeline: GPUComputePipeline | null = null;
  layout: GPUBindGroupLayout | null = null;

  constructor(def: KernelDef) {
    this.name = def.name;
    this.wg = def.wg ?? 128;
    this.binds = parseBinds(def.bind);
    this.source = generate(def, this.binds, this.wg);
  }
}

/** Der Typ einer Bindung ohne Angabe: nach ihrem Namen (sonst f32). */
const DEFAULT_TYPE: Readonly<Record<string, string>> = {
  mgU: 'u32', cu: 'u32', fu: 'u32', lab: 'u32', cfl: 'u32', ccount: 'u32', cstart: 'u32', bsum: 'u32', pkey: 'u32', pslot: 'u32',
  pargs: 'u32', parts: 'Particle', parts2: 'Particle', bubs: 'Bubble', bubs2: 'Bubble', sites: 'Site', btarget: 'u32'
};

function parseBinds(spec: string): BindSpec[] {
  return spec.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const m = /^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(tok);
    if (m === null) throw new Error(`bad binding "${tok}"`);
    const mode = m[2] as Mode;
    const type = m[3] ?? (mode === 'u' ? 'Params' : mode === 'a' ? 'atomic<u32>' : DEFAULT_TYPE[m[1]] ?? 'f32');
    return { name: m[1], mode, type };
  });
}

/** Helfer, die jeder Kern bekommt (jeder bindet die Parameter als `P`). */
const COMMON = `
fn ci(c: u32) -> i32 { return i32(c % P.nx); }
fn cj(c: u32) -> i32 { return i32(c / P.nx); }
fn cellOf(i: i32, j: i32) -> u32 { return u32(i) + u32(j) * P.nx; }
fn inGrid(i: i32, j: i32) -> bool { return i >= 0 && j >= 0 && i < i32(P.nx) && j < i32(P.ny); }
fn cellAt(x: f32, y: f32) -> u32 {
  let i = u32(clamp(floor(x * P.invdx), 0.0, f32(P.nx - 1u)));
  let j = u32(clamp(floor(y * P.invdx), 0.0, f32(P.ny - 1u)));
  return i + j * P.nx;
}
fn cellAtN(x: f32, y: f32) -> u32 {
  let fi = floor(x * P.invdx);
  let fj = floor(y * P.invdx);
  if (fi < 0.0 || fj < 0.0 || fi >= f32(P.nx) || fj >= f32(P.ny)) { return NONE; }
  return u32(fi) + u32(fj) * P.nx;
}
fn s0(c: u32) -> u32 { return (c % P.nx + 1u) + (c / P.nx + 1u) * (P.nx + 2u); }
fn yOf(c: u32) -> f32 { return P.dx * (f32(c / P.nx) + 0.5); }
fn uF(i: i32, j: i32) -> u32 { return u32(i) + u32(j) * (P.nx + 1u); }
fn vF(i: i32, j: i32) -> u32 { return P.nu + u32(i) + u32(j) * P.nx; }
fn sideOpen(k: u32) -> bool {
  if (k == 0u) { return P.openL != 0u; }
  if (k == 1u) { return P.openR != 0u; }
  if (k == 2u) { return P.openB != 0u; }
  return P.openT != 0u;
}
`;

/** Helfer je gebundenem Namen (nur, wenn der Kern ihn bindet). */
const BY_BINDING: readonly { readonly needs: readonly string[]; readonly code: string }[] = [
  { needs: ['cf'], code: 'fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }' },
  { needs: ['cu'], code: 'fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }' },
  { needs: ['at'], code: 'fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }' },
  { needs: ['ff'], code: 'fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }' },
  { needs: ['fu'], code: 'fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }' },
  { needs: ['af'], code: 'fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }' },
  { needs: ['cstart', 'bsum'], code: 'fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }' },
  {
    needs: ['cnt!'],
    code: `var<workgroup> wcnt: u32;
/* Ein Zähler für die ganze Arbeitsgruppe (ein atomares Lesen statt eines je Faden; am Anfang von main aufrufen). */
fn cntWG(lid: u32, slot: u32) -> u32 {
  if (lid == 0u) { wcnt = atomicLoad(&cnt[slot]); }
  let v = workgroupUniformLoad(&wcnt);
  workgroupBarrier();
  return v;
}`
  },
  {
    needs: ['cu', 'reg'],
    code: `fn pAt(c: u32) -> f32 {
  let r = cu[U_RID * P.n + c];
  if (r == NONE) { return P.pamb; }
  return reg[r * REG_STRIDE + R_P0] - reg[r * REG_STRIDE + R_RHOBAR] * P.gy * yOf(c);
}`
  },
  {
    needs: ['cf'],
    code: `fn sdfAt(x: f32, y: f32) -> f32 {
  let fx = clamp(x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  let i1 = min(P.nx - 1u, i + 1u);
  let j1 = min(P.ny - 1u, j + 1u);
  let o = F_SDF * P.n;
  var d = (1.0 - ty) * ((1.0 - tx) * cf[o + i + j * P.nx] + tx * cf[o + i1 + j * P.nx]) + ty * ((1.0 - tx) * cf[o + i + j1 * P.nx] + tx * cf[o + i1 + j1 * P.nx]);
  if (P.openL == 0u) { d = min(d, x); }
  if (P.openR == 0u) { d = min(d, P.boxw - x); }
  if (P.openB == 0u) { d = min(d, y); }
  if (P.openT == 0u) { d = min(d, P.boxh - y); }
  return d;
}`
  },
  {
    needs: ['ff'],
    code: `fn velL(x: f32, y: f32) -> vec2<f32> {
  let nx = P.nx;
  let nxu = nx + 1u;
  let o = FF_UL * P.nf;
  var fx = clamp(x * P.invdx, 0.0, f32(nx) - 1e-4);
  var fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  var i = u32(floor(fx));
  var j = u32(floor(fy));
  var tx = fx - f32(i);
  var ty = fy - f32(j);
  let u = (1.0 - ty) * ((1.0 - tx) * ff[o + i + j * nxu] + tx * ff[o + i + 1u + j * nxu]) + ty * ((1.0 - tx) * ff[o + i + (j + 1u) * nxu] + tx * ff[o + i + 1u + (j + 1u) * nxu]);
  fx = clamp(x * P.invdx - 0.5, 0.0, f32(nx) - 1.0001);
  fy = clamp(y * P.invdx, 0.0, f32(P.ny) - 1e-4);
  i = u32(floor(fx));
  j = u32(floor(fy));
  tx = fx - f32(i);
  ty = fy - f32(j);
  let ov = o + P.nu;
  let v = (1.0 - ty) * ((1.0 - tx) * ff[ov + i + j * nx] + tx * ff[ov + i + 1u + j * nx]) + ty * ((1.0 - tx) * ff[ov + i + (j + 1u) * nx] + tx * ff[ov + i + 1u + (j + 1u) * nx]);
  return vec2<f32>(u, v);
}`
  }
];

function generate(def: KernelDef, binds: readonly BindSpec[], wg: number): string {
  const lines: string[] = [LIB, `const WG: u32 = ${wg}u;`, COMMON];
  const names = new Set(binds.map((b) => b.name));
  for (const b of binds) if (b.mode === 'a') names.add(`${b.name}!`);
  for (const h of BY_BINDING) if (h.needs.every((n) => names.has(n))) lines.push(h.code);
  binds.forEach((b, i) => {
    if (b.mode === 'u') lines.push(`@group(0) @binding(${i}) var<uniform> ${b.name}: ${b.type};`);
    else if (b.mode === 't') lines.push(`@group(0) @binding(${i}) var ${b.name}: texture_storage_2d<rgba8unorm, write>;`);
    else if (b.mode === 'x') lines.push(`@group(0) @binding(${i}) var ${b.name}: texture_2d<f32>;`);
    else if (b.mode === 's') lines.push(`@group(0) @binding(${i}) var ${b.name}: sampler;`);
    else if (b.mode === 'r') lines.push(`@group(0) @binding(${i}) var<storage, read> ${b.name}: array<${b.type}>;`);
    else if (b.mode === 'w') lines.push(`@group(0) @binding(${i}) var<storage, read_write> ${b.name}: array<${b.type}>;`);
    else {
      lines.push(`@group(0) @binding(${i}) var<storage, read_write> ${b.name}: array<atomic<u32>>;`);
      lines.push(`fn addF_${b.name}(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&${b.name}[i]);
  loop {
    let r = atomicCompareExchangeWeak(&${b.name}[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn getF_${b.name}(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&${b.name}[i])); }
fn setF_${b.name}(i: u32, v: f32) { atomicStore(&${b.name}[i], bitcast<u32>(v)); }
fn maxU_${b.name}(i: u32, v: f32) { atomicMax(&${b.name}[i], bitcast<u32>(max(v, 0.0))); }`);
    }
  });
  lines.push(def.code);
  return lines.join('\n');
}

export type Resource = GPUBuffer | { readonly buffer: GPUBuffer; readonly offset: number; readonly size: number } | { readonly view: GPUTextureView } | { readonly sampler: GPUSampler };

/** Das Gerät und alles, was Kerne brauchen. */
export class GpuCtx {
  readonly device: GPUDevice;
  readonly kernels = new Map<string, Kernel>();
  readonly timestamps: boolean;
  private readonly bufs: GPUBuffer[] = [];

  constructor(device: GPUDevice) {
    this.device = device;
    this.timestamps = device.features.has('timestamp-query');
  }

  /** Ein Gerät holen (die grösste Zahl an Speicherbindungen, die der Adapter kann; Zeitstempel, wenn es sie gibt). */
  static async create(): Promise<GpuCtx> {
    const gpu = (navigator as Navigator).gpu;
    if (gpu === undefined) throw new Error('WebGPU is not available');
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (adapter === null) throw new Error('no WebGPU adapter');
    const features: string[] = [];
    if (adapter.features.has('timestamp-query')) features.push('timestamp-query');
    const lim = adapter.limits;
    const device = await adapter.requestDevice({
      requiredFeatures: features,
      requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(16, lim.maxStorageBuffersPerShaderStage),
        maxStorageBufferBindingSize: lim.maxStorageBufferBindingSize,
        maxBufferSize: lim.maxBufferSize,
        maxComputeWorkgroupStorageSize: lim.maxComputeWorkgroupStorageSize,
        maxComputeInvocationsPerWorkgroup: Math.min(1024, lim.maxComputeInvocationsPerWorkgroup)
      }
    });
    return new GpuCtx(device);
  }

  /** Alle Kerne übersetzen; liefert die Fehlermeldungen (leer: alles gut). */
  async compile(defs: readonly KernelDef[]): Promise<string[]> {
    const errors: string[] = [];
    await Promise.all(defs.map(async (def) => {
      const k = new Kernel(def);
      this.kernels.set(def.name, k);
      const module = this.device.createShaderModule({ code: k.source, label: def.name });
      const info = await module.getCompilationInfo();
      const bad = info.messages.filter((m) => m.type === 'error');
      if (bad.length > 0) {
        const src = k.source.split('\n');
        for (const m of bad) errors.push(`${def.name}:${m.lineNum}:${m.linePos} ${m.message}\n    ${src[m.lineNum - 1] ?? ''}`);
        return;
      }
      const layout = this.device.createBindGroupLayout({
        label: def.name,
        entries: k.binds.map((b, i): GPUBindGroupLayoutEntry => {
          if (b.mode === 't') return { binding: i, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } };
          if (b.mode === 'x') return { binding: i, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } };
          if (b.mode === 's') return { binding: i, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' } };
          return { binding: i, visibility: GPUShaderStage.COMPUTE, buffer: { type: b.mode === 'u' ? 'uniform' : b.mode === 'r' ? 'read-only-storage' : 'storage' } };
        })
      });
      k.layout = layout;
      try {
        k.pipeline = await this.device.createComputePipelineAsync({
          label: def.name,
          layout: this.device.createPipelineLayout({ bindGroupLayouts: [layout] }),
          compute: { module, entryPoint: 'main' }
        });
      } catch (e) {
        errors.push(`${def.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }));
    return errors;
  }

  kernel(name: string): Kernel {
    const k = this.kernels.get(name);
    if (k === undefined || k.pipeline === null) throw new Error(`kernel ${name} not compiled`);
    return k;
  }

  /** Eine Bindungsgruppe über die Namen der Bindungen. */
  bind(name: string, res: Readonly<Record<string, Resource>>): GPUBindGroup {
    const k = this.kernel(name);
    return this.device.createBindGroup({
      label: name,
      layout: k.layout as GPUBindGroupLayout,
      entries: k.binds.map((b, i) => {
        const r = res[b.name];
        if (r === undefined) throw new Error(`kernel ${name}: no resource for "${b.name}"`);
        if ('view' in r) return { binding: i, resource: r.view };
        if ('sampler' in r) return { binding: i, resource: r.sampler };
        return { binding: i, resource: 'buffer' in r ? { buffer: r.buffer, offset: r.offset, size: r.size } : { buffer: r } };
      })
    });
  }

  /**
   * Messen (Entwicklung): jeder Aufruf in einem eigenen Pass mit Zeitstempeln;
   * die Pässe der Aufrufer sind dann Attrappen (GpuEngine.pass).
   */
  profiler: { readonly enc: GPUCommandEncoder; readonly qs: GPUQuerySet; readonly names: string[] } | null = null;

  private own(pass: GPUComputePassEncoder, name: string): GPUComputePassEncoder {
    const pr = this.profiler;
    if (pr === null) return pass;
    const k = 2 * pr.names.length;
    pr.names.push(name);
    return pr.enc.beginComputePass({ timestampWrites: { querySet: pr.qs, beginningOfPassWriteIndex: k, endOfPassWriteIndex: k + 1 } });
  }

  /** Einen Kern über `threads` Fäden laufen lassen. */
  dispatch(pass: GPUComputePassEncoder, name: string, group: GPUBindGroup, threads: number): void {
    const k = this.kernel(name);
    const p = this.own(pass, name);
    p.setPipeline(k.pipeline as GPUComputePipeline);
    p.setBindGroup(0, group);
    p.dispatchWorkgroups(Math.max(1, Math.ceil(threads / k.wg)));
    if (p !== pass) p.end();
  }

  /** Einen Kern mit der Zahl der Arbeitsgruppen aus einem Puffer (Teilchen: pargs). */
  dispatchIndirect(pass: GPUComputePassEncoder, name: string, group: GPUBindGroup, args: GPUBuffer): void {
    const k = this.kernel(name);
    const p = this.own(pass, name);
    p.setPipeline(k.pipeline as GPUComputePipeline);
    p.setBindGroup(0, group);
    p.dispatchWorkgroupsIndirect(args, 0);
    if (p !== pass) p.end();
  }

  /** Einen Kern mit genau einer Arbeitsgruppe. */
  dispatchOne(pass: GPUComputePassEncoder, name: string, group: GPUBindGroup): void {
    const k = this.kernel(name);
    const p = this.own(pass, name);
    p.setPipeline(k.pipeline as GPUComputePipeline);
    p.setBindGroup(0, group);
    p.dispatchWorkgroups(1);
    if (p !== pass) p.end();
  }

  buffer(label: string, bytes: number, usage: number = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC): GPUBuffer {
    const b = this.device.createBuffer({ label, size: Math.max(16, Math.ceil(bytes / 16) * 16), usage });
    this.bufs.push(b);
    return b;
  }

  uniform(label: string, data: ArrayBuffer): GPUBuffer {
    const b = this.buffer(label, data.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.device.queue.writeBuffer(b, 0, data);
    return b;
  }

  /** Puffer freigeben (die einer Szene, wenn sie ersetzt wird). */
  release(list: readonly GPUBuffer[]): void {
    const set = new Set(list);
    for (const b of list) b.destroy();
    for (let k = this.bufs.length - 1; k >= 0; k -= 1) if (set.has(this.bufs[k])) this.bufs.splice(k, 1);
  }

  destroy(): void {
    for (const b of this.bufs) b.destroy();
    this.bufs.length = 0;
    this.device.destroy();
  }
}
