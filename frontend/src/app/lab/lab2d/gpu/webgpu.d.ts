/**
 * LABOR 2D (v2) — DIE WEBGPU-TYPEN, die der beschleunigte Weg braucht (die
 * Bibliothek von TypeScript 5.9 kennt WebGPU noch nicht; ein Paket dafür wäre
 * eine neue Abhängigkeit). Nur der benutzte Teil der Schnittstelle (W3C
 * WebGPU, Candidate Recommendation 2024).
 */

type GPUBufferUsageFlags = number;
type GPUMapModeFlags = number;
type GPUTextureUsageFlags = number;
type GPUShaderStageFlags = number;
type GPUSize64 = number;
type GPUTextureFormat = string;

declare const GPUBufferUsage: {
  readonly MAP_READ: number; readonly MAP_WRITE: number; readonly COPY_SRC: number; readonly COPY_DST: number;
  readonly INDEX: number; readonly VERTEX: number; readonly UNIFORM: number; readonly STORAGE: number;
  readonly INDIRECT: number; readonly QUERY_RESOLVE: number;
};
declare const GPUMapMode: { readonly READ: number; readonly WRITE: number };
declare const GPUTextureUsage: {
  readonly COPY_SRC: number; readonly COPY_DST: number; readonly TEXTURE_BINDING: number;
  readonly STORAGE_BINDING: number; readonly RENDER_ATTACHMENT: number;
};
declare const GPUShaderStage: { readonly VERTEX: number; readonly FRAGMENT: number; readonly COMPUTE: number };

interface GPUObjectBase { label: string }

interface GPUSupportedLimits {
  readonly maxStorageBuffersPerShaderStage: number;
  readonly maxComputeWorkgroupStorageSize: number;
  readonly maxBufferSize: number;
  readonly maxStorageBufferBindingSize: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  readonly maxComputeWorkgroupsPerDimension: number;
  readonly maxBindingsPerBindGroup: number;
  readonly maxUniformBuffersPerShaderStage: number;
}

interface GPUAdapterInfo { readonly vendor: string; readonly architecture: string; readonly device: string; readonly description: string }

interface GPUAdapter {
  readonly features: ReadonlySet<string>;
  readonly limits: GPUSupportedLimits;
  readonly info?: GPUAdapterInfo;
  requestDevice(descriptor?: { requiredFeatures?: string[]; requiredLimits?: Record<string, number>; label?: string }): Promise<GPUDevice>;
}

interface GPU {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface Navigator { readonly gpu?: GPU }
interface WorkerNavigator { readonly gpu?: GPU }

interface GPUDeviceLostInfo { readonly reason: string; readonly message: string }
interface GPUError { readonly message: string }

interface GPUDevice extends GPUObjectBase {
  readonly features: ReadonlySet<string>;
  readonly limits: GPUSupportedLimits;
  readonly queue: GPUQueue;
  readonly lost: Promise<GPUDeviceLostInfo>;
  destroy(): void;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
  createShaderModule(descriptor: { code: string; label?: string }): GPUShaderModule;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  createComputePipelineAsync(descriptor: GPUComputePipelineDescriptor): Promise<GPUComputePipeline>;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
  createRenderPipelineAsync(descriptor: GPURenderPipelineDescriptor): Promise<GPURenderPipeline>;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createBindGroupLayout(descriptor: { entries: GPUBindGroupLayoutEntry[]; label?: string }): GPUBindGroupLayout;
  createPipelineLayout(descriptor: { bindGroupLayouts: GPUBindGroupLayout[]; label?: string }): GPUPipelineLayout;
  createCommandEncoder(descriptor?: { label?: string }): GPUCommandEncoder;
  createQuerySet(descriptor: { type: 'timestamp' | 'occlusion'; count: number; label?: string }): GPUQuerySet;
  pushErrorScope(filter: 'validation' | 'out-of-memory' | 'internal'): void;
  popErrorScope(): Promise<GPUError | null>;
  addEventListener(type: 'uncapturederror', listener: (e: { error: GPUError }) => void): void;
}

interface GPUBufferDescriptor { size: number; usage: GPUBufferUsageFlags; mappedAtCreation?: boolean; label?: string }

interface GPUBuffer extends GPUObjectBase {
  readonly size: number;
  readonly mapState: 'unmapped' | 'pending' | 'mapped';
  mapAsync(mode: GPUMapModeFlags, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void;
  onSubmittedWorkDone(): Promise<void>;
}

interface GPUShaderModule extends GPUObjectBase {
  getCompilationInfo(): Promise<{ messages: readonly { type: 'error' | 'warning' | 'info'; message: string; lineNum: number; linePos: number }[] }>;
}

interface GPUProgrammableStage { module: GPUShaderModule; entryPoint?: string; constants?: Record<string, number> }
interface GPUComputePipelineDescriptor { layout: GPUPipelineLayout | 'auto'; compute: GPUProgrammableStage; label?: string }
interface GPUPipelineBase { getBindGroupLayout(index: number): GPUBindGroupLayout }
interface GPUComputePipeline extends GPUObjectBase, GPUPipelineBase {}
interface GPURenderPipeline extends GPUObjectBase, GPUPipelineBase {}
interface GPUPipelineLayout extends GPUObjectBase {}
interface GPUBindGroupLayout extends GPUObjectBase {}
interface GPUBindGroup extends GPUObjectBase {}
interface GPUSampler extends GPUObjectBase {}
interface GPUQuerySet extends GPUObjectBase { destroy(): void }
interface GPUCommandBuffer extends GPUObjectBase {}

interface GPUBindGroupLayoutEntry {
  binding: number;
  visibility: GPUShaderStageFlags;
  buffer?: { type?: 'uniform' | 'storage' | 'read-only-storage' };
  sampler?: { type?: 'filtering' | 'non-filtering' };
  texture?: { sampleType?: 'float' | 'unfilterable-float' };
  storageTexture?: { access?: 'write-only'; format: GPUTextureFormat };
}

interface GPUBufferBinding { buffer: GPUBuffer; offset?: number; size?: number }
interface GPUBindGroupEntry { binding: number; resource: GPUBufferBinding | GPUSampler | GPUTextureView }
interface GPUBindGroupDescriptor { layout: GPUBindGroupLayout; entries: GPUBindGroupEntry[]; label?: string }

interface GPUTextureDescriptor {
  size: [number, number] | [number, number, number] | { width: number; height: number };
  format: GPUTextureFormat;
  usage: GPUTextureUsageFlags;
  label?: string;
}
interface GPUTexture extends GPUObjectBase {
  readonly width: number;
  readonly height: number;
  createView(descriptor?: { format?: GPUTextureFormat }): GPUTextureView;
  destroy(): void;
}
interface GPUTextureView extends GPUObjectBase {}
interface GPUSamplerDescriptor { magFilter?: 'nearest' | 'linear'; minFilter?: 'nearest' | 'linear'; addressModeU?: 'clamp-to-edge'; addressModeV?: 'clamp-to-edge' }

interface GPUComputePassTimestampWrites { querySet: GPUQuerySet; beginningOfPassWriteIndex?: number; endOfPassWriteIndex?: number }

interface GPUCommandEncoder extends GPUObjectBase {
  beginComputePass(descriptor?: { label?: string; timestampWrites?: GPUComputePassTimestampWrites }): GPUComputePassEncoder;
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
  clearBuffer(buffer: GPUBuffer, offset?: number, size?: number): void;
  resolveQuerySet(querySet: GPUQuerySet, firstQuery: number, queryCount: number, destination: GPUBuffer, destinationOffset: number): void;
  finish(descriptor?: { label?: string }): GPUCommandBuffer;
}

interface GPUComputePassEncoder extends GPUObjectBase {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  dispatchWorkgroupsIndirect(indirectBuffer: GPUBuffer, indirectOffset: number): void;
  end(): void;
}

interface GPURenderPassColorAttachment {
  view: GPUTextureView;
  clearValue?: { r: number; g: number; b: number; a: number };
  loadOp: 'load' | 'clear';
  storeOp: 'store' | 'discard';
}
interface GPURenderPassDescriptor { colorAttachments: GPURenderPassColorAttachment[]; label?: string }

interface GPURenderPassEncoder extends GPUObjectBase {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: number, size?: number): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  end(): void;
}

interface GPUBlendComponent { srcFactor?: string; dstFactor?: string; operation?: string }
interface GPUColorTargetState { format: GPUTextureFormat; blend?: { color: GPUBlendComponent; alpha: GPUBlendComponent } }
interface GPURenderPipelineDescriptor {
  layout: GPUPipelineLayout | 'auto';
  vertex: GPUProgrammableStage & { buffers?: unknown[] };
  fragment?: GPUProgrammableStage & { targets: GPUColorTargetState[] };
  primitive?: { topology?: 'point-list' | 'line-list' | 'line-strip' | 'triangle-list' | 'triangle-strip' };
  label?: string;
}

interface GPUCanvasContext {
  configure(configuration: { device: GPUDevice; format: GPUTextureFormat; alphaMode?: 'opaque' | 'premultiplied' }): void;
  unconfigure(): void;
  getCurrentTexture(): GPUTexture;
}
