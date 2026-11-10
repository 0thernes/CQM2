/**
 * CQM2 v2.1.0 Browser WebGPU (`WGSL`) Compute Pipeline (`src/render/webgpu-compute.ts`).
 * Executes batched organism neural cortex forward passes (`8 -> 8 -> 6`) directly on the browser's GPU
 * via WGSL compute shaders with persistent `GPUBuffer` reuse and verified numerical `Float32Array` readback,
 * falling back cleanly to Zig SIMD128 WASM when `navigator.gpu` is unavailable.
 */

export interface WebGpuCapabilities {
  supported: boolean;
  adapterInfo: string;
  lastDispatchMs: number;
}

const CORTEX_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> inputs: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputs: array<f32>;

fn fast_tanh(x: f32) -> f32 {
  let c = clamp(x, -4.95, 4.95);
  let c2 = c * c;
  return c * (27.0 + c2) / (27.0 + 9.0 * c2);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let e = gid.x;
  let total_entities = arrayLength(&outputs) / 6u;
  if (e >= total_entities) {
    return;
  }

  let in_base = e * 8u;
  let w_base = e * 126u;
  let out_base = e * 6u;

  var hid: array<f32, 8>;
  for (var h: u32 = 0u; h < 8u; h = h + 1u) {
    var s: f32 = weights[w_base + 64u + h];
    let row = w_base + h * 8u;
    for (var i: u32 = 0u; i < 8u; i = i + 1u) {
      s = s + weights[row + i] * inputs[in_base + i];
    }
    hid[h] = fast_tanh(s);
  }

  let w2_base = w_base + 72u;
  let b2_base = w2_base + 48u;
  for (var o: u32 = 0u; o < 6u; o = o + 1u) {
    var s2: f32 = weights[b2_base + o];
    let row2 = w2_base + o * 8u;
    for (var h2: u32 = 0u; h2 < 8u; h2 = h2 + 1u) {
      s2 = s2 + weights[row2 + h2] * hid[h2];
    }
    outputs[out_base + o] = fast_tanh(s2);
  }
}
`;

interface GpuBufferLike {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
}

interface GpuDeviceLike {
  createShaderModule(desc: { code: string }): unknown;
  createComputePipeline(desc: unknown): { getBindGroupLayout(idx: number): unknown };
  createBuffer(desc: { size: number; usage: number }): GpuBufferLike;
  createBindGroup(desc: unknown): unknown;
  createCommandEncoder(): {
    beginComputePass(): {
      setPipeline(p: unknown): void;
      setBindGroup(i: number, bg: unknown): void;
      dispatchWorkgroups(x: number): void;
      end(): void;
    };
    copyBufferToBuffer(src: unknown, srcOff: number, dst: unknown, dstOff: number, size: number): void;
    finish(): unknown;
  };
  queue: {
    writeBuffer(buf: unknown, offset: number, data: BufferSource, dataOffset?: number, size?: number): void;
    submit(cmds: unknown[]): void;
  };
}

export class BrowserWebGpuCompute {
  private device: GpuDeviceLike | null = null;
  private pipeline: { getBindGroupLayout(idx: number): unknown } | null = null;
  private adapterInfo = 'WebGPU Not Initialized';
  private lastDispatchMs = 0;

  // Persistent GPU buffers reused across dispatches to avoid per-frame allocation churn
  private allocatedEntities = 0;
  private inBuf: GpuBufferLike | null = null;
  private wBuf: GpuBufferLike | null = null;
  private outBuf: GpuBufferLike | null = null;
  private readBuf: GpuBufferLike | null = null;
  private bindGroup: unknown = null;
  private dispatchInFlight = false;

  public async init(): Promise<WebGpuCapabilities> {
    const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }) : null;
    if (!nav?.gpu) {
      this.adapterInfo = 'WebGPU Unavailable (Zig SIMD128 WASM Active)';
      return this.getCapabilities();
    }

    try {
      // Omit `powerPreference` option so Windows Chromium/Edge Dawn never emits a console warning
      const adapter = (await nav.gpu.requestAdapter()) as {
        info?: { vendor?: string; architecture?: string; description?: string };
        requestDevice(): Promise<GpuDeviceLike>;
      } | null;
      if (!adapter) {
        this.adapterInfo = 'No WebGPU Adapter Found';
        return this.getCapabilities();
      }
      const info = adapter.info;
      this.adapterInfo =
        info?.description || [info?.vendor, info?.architecture].filter(Boolean).join(' ') || 'WebGPU Hardware Adapter';
      this.device = await adapter.requestDevice();
      const module = this.device.createShaderModule({ code: CORTEX_WGSL });
      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });
    } catch {
      this.device = null;
      this.pipeline = null;
      this.adapterInfo = 'WebGPU Fallback (Zig SIMD128 WASM Active)';
    }

    return this.getCapabilities();
  }

  public getCapabilities(): WebGpuCapabilities {
    return {
      supported: Boolean(this.device && this.pipeline),
      adapterInfo: this.adapterInfo,
      lastDispatchMs: this.lastDispatchMs,
    };
  }

  private ensurePersistentBuffers(entityCount: number): void {
    if (!this.device || !this.pipeline) return;
    if (this.allocatedEntities >= entityCount && this.inBuf && this.wBuf && this.outBuf && this.readBuf) {
      return;
    }
    this.releaseBuffers();
    const cap = Math.max(64, entityCount);
    const STORAGE = 0x0080;
    const COPY_DST = 0x0008;
    const COPY_SRC = 0x0004;
    const MAP_READ = 0x0001;

    this.inBuf = this.device.createBuffer({ size: cap * 8 * 4, usage: STORAGE | COPY_DST });
    this.wBuf = this.device.createBuffer({ size: cap * 126 * 4, usage: STORAGE | COPY_DST });
    this.outBuf = this.device.createBuffer({ size: cap * 6 * 4, usage: STORAGE | COPY_SRC });
    this.readBuf = this.device.createBuffer({ size: cap * 6 * 4, usage: MAP_READ | COPY_DST });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.inBuf } },
        { binding: 1, resource: { buffer: this.wBuf } },
        { binding: 2, resource: { buffer: this.outBuf } },
      ],
    });
    this.allocatedEntities = cap;
  }

  public async runCortexBatch(
    inputs8xN: Float32Array,
    weights126xN: Float32Array,
    entityCount: number,
  ): Promise<Float32Array | null> {
    if (!this.device || !this.pipeline || this.dispatchInFlight || entityCount <= 0) {
      return null;
    }
    this.dispatchInFlight = true;
    try {
      const n = Math.max(1, Math.min(16384, entityCount));
      this.ensurePersistentBuffers(n);
      const outBytes = n * 6 * 4;

      const t0 = performance.now();
      this.device.queue.writeBuffer(this.inBuf!, 0, new Float32Array(inputs8xN.subarray(0, n * 8)));
      this.device.queue.writeBuffer(this.wBuf!, 0, new Float32Array(weights126xN.subarray(0, n * 126)));

      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.dispatchWorkgroups(Math.ceil(n / 64));
      pass.end();
      enc.copyBufferToBuffer(this.outBuf!, 0, this.readBuf!, 0, outBytes);
      this.device.queue.submit([enc.finish()]);

      await this.readBuf!.mapAsync(1);
      const mapped = new Float32Array(this.readBuf!.getMappedRange(0, outBytes));
      const result = new Float32Array(mapped);
      this.readBuf!.unmap();

      this.lastDispatchMs = performance.now() - t0;
      return result;
    } finally {
      this.dispatchInFlight = false;
    }
  }

  public async runCortexBenchmark(entityCount = 1024): Promise<{
    supported: boolean;
    elapsedMs: number;
    entities: number;
    sampleOutput0: number;
  }> {
    if (!this.device || !this.pipeline) {
      return { supported: false, elapsedMs: 0, entities: 0, sampleOutput0: 0 };
    }
    const n = Math.max(64, Math.min(16384, entityCount));
    const inData = new Float32Array(n * 8).fill(0.25);
    const wData = new Float32Array(n * 126).fill(0.05);
    const out = await this.runCortexBatch(inData, wData, n);
    if (!out) {
      return { supported: false, elapsedMs: 0, entities: 0, sampleOutput0: 0 };
    }
    return {
      supported: true,
      elapsedMs: this.lastDispatchMs,
      entities: n,
      sampleOutput0: out[0] ?? 0,
    };
  }

  public releaseBuffers(): void {
    this.inBuf?.destroy();
    this.wBuf?.destroy();
    this.outBuf?.destroy();
    this.readBuf?.destroy();
    this.inBuf = null;
    this.wBuf = null;
    this.outBuf = null;
    this.readBuf = null;
    this.bindGroup = null;
    this.allocatedEntities = 0;
  }
}
