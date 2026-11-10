/**
 * CQM2 Browser WebGPU (`WGSL`) Compute Pipeline.
 * Executes batched organism neural cortex forward passes (`8 -> 8 -> 6`) directly on the browser's GPU
 * via WGSL compute shaders when `navigator.gpu` is available, with zero-error fallback to Zig SIMD128 WASM.
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

// Minimal WebGPU ambient interfaces so TypeScript compiles cleanly without requiring `@webgpu/types`
interface GpuDeviceLike {
  createShaderModule(desc: { code: string }): unknown;
  createComputePipeline(desc: unknown): { getBindGroupLayout(idx: number): unknown };
  createBuffer(desc: { size: number; usage: number }): {
    destroy(): void;
    mapAsync(mode: number): Promise<void>;
    getMappedRange(): ArrayBuffer;
    unmap(): void;
  };
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
    writeBuffer(buf: unknown, offset: number, data: BufferSource): void;
    submit(cmds: unknown[]): void;
  };
}

export class BrowserWebGpuCompute {
  private device: GpuDeviceLike | null = null;
  private pipeline: { getBindGroupLayout(idx: number): unknown } | null = null;
  private adapterInfo = 'WebGPU Not Initialized';
  private lastDispatchMs = 0;

  public async init(): Promise<WebGpuCapabilities> {
    const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { gpu?: { requestAdapter(opts?: unknown): Promise<unknown> } }) : null;
    if (!nav?.gpu) {
      this.adapterInfo = 'WebGPU Unavailable (Zig SIMD128 WASM Active)';
      return this.getCapabilities();
    }

    try {
      const adapter = (await nav.gpu.requestAdapter({ powerPreference: 'high-performance' })) as {
        info?: { vendor?: string; architecture?: string; description?: string };
        requestDevice(): Promise<GpuDeviceLike>;
      } | null;
      if (!adapter) {
        this.adapterInfo = 'No WebGPU Adapter Found';
        return this.getCapabilities();
      }
      const info = adapter.info;
      this.adapterInfo =
        info?.description || [info?.vendor, info?.architecture].filter(Boolean).join(' ') || 'WebGPU High-Performance Adapter';
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

  public async runCortexBenchmark(entityCount = 1024): Promise<{ supported: boolean; elapsedMs: number; entities: number }> {
    if (!this.device || !this.pipeline) {
      return { supported: false, elapsedMs: 0, entities: 0 };
    }
    const n = Math.max(64, Math.min(16384, entityCount));
    const STORAGE = 0x0080;
    const COPY_DST = 0x0008;
    const COPY_SRC = 0x0004;
    const MAP_READ = 0x0001;

    const inData = new Float32Array(n * 8).fill(0.25);
    const wData = new Float32Array(n * 126).fill(0.05);
    const outBytes = n * 6 * 4;

    const inBuf = this.device.createBuffer({ size: inData.byteLength, usage: STORAGE | COPY_DST });
    const wBuf = this.device.createBuffer({ size: wData.byteLength, usage: STORAGE | COPY_DST });
    const outBuf = this.device.createBuffer({ size: outBytes, usage: STORAGE | COPY_SRC });
    const readBuf = this.device.createBuffer({ size: outBytes, usage: MAP_READ | COPY_DST });

    const t0 = performance.now();
    this.device.queue.writeBuffer(inBuf, 0, inData);
    this.device.queue.writeBuffer(wBuf, 0, wData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf } },
        { binding: 1, resource: { buffer: wBuf } },
        { binding: 2, resource: { buffer: outBuf } },
      ],
    });

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, outBytes);
    this.device.queue.submit([enc.finish()]);

    await readBuf.mapAsync(1);
    readBuf.unmap();
    const dt = performance.now() - t0;
    this.lastDispatchMs = dt;

    inBuf.destroy();
    wBuf.destroy();
    outBuf.destroy();
    readBuf.destroy();

    return { supported: true, elapsedMs: dt, entities: n };
  }
}
