/**
 * CQM2 v2.1.0 Unified Polyglot Quad-Silicon Orchestrator (dGPU + NPU + iGPU + CPU AVX2/SIMD128).
 * Dynamically binds when running locally in Bun:
 *   1. `native/bin/cqm2_tri_accel.dll` -> RTX 5070 Ti CUDA/cuBLAS StridedBatched & SGEMM, DirectML iGPU, LevelZero NPU, AVX2/FMA3/POPCNT ASM
 *   2. `native/bin/cqm2_zig.dll` -> Zero-copy native Zig 0.17 AVX2 FFI (with automatic WASM parity fallback)
 *   3. `native/bin/cqm2_rust_ledger.dll` -> Rust 1.94 Merkle Root, Kahan Conservation, Chaos-Entropy Lemire & GeoRefine BF16 Codec
 *   4. `src/native/npu-client.ts` -> Persistent OpenVINO `Intel(R) AI Boost` NPU (RSSM) + `Intel(R) Graphics` iGPU (2D Field Diffusion)
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NpuWorldClient, type IgpuFieldResult, type NpuRssmResult, type NpuWorkerStatus } from './npu-client';
import { getTsotchkeNativeBridge, type TsotchkeNativeBridge, type TsotchkeNativeStatus } from './tsotchke-bridge';
import { getZigBridge, type ZigKernelBridge } from './zig-bridge';

export interface SiliconHardwareTopology {
  hostPlatform: string;
  cpuArch: string;
  cudaReady: boolean;
  gpuName: string;
  vramGb: number;
  igpuDmlReady: boolean;
  igpuName: string;
  npuLevelZeroReady: boolean;
  npuName: string;
  npuSlices: number;
  avx2AsmReady: boolean;
  zigNativeFfiReady: boolean;
  zigNativeDllReady: boolean;
  rustLedgerReady: boolean;
  zigSimdReady: boolean;
  goOscBridgePresent: boolean;
  npuWorker: NpuWorkerStatus;
  tsotchkeNative: TsotchkeNativeStatus;
}

export interface CortexGemmReceipt {
  backend: 'CUDA-cuBLAS' | 'CUDA-cuBLAS-StridedBatched' | 'Zig-Native-FFI' | 'CPU-Reference';
  gflops: number;
  elapsedMs: number;
  rows: number;
  cols: number;
  depth: number;
}

export interface MetabolicAuditReceipt {
  auditor: 'Rust-1.94-Kahan-FFI' | 'TS-Kahan-Reference';
  valid: boolean;
  maxRelativeDrift: number;
  entityCount: number;
}

const ROOT = resolve(import.meta.dir, '..', '..');
const BIN_DIR = join(ROOT, 'native', 'bin');

interface TriAccelFfiSymbols {
  cqm2_hw_init: (jsonOut: Uint8Array, maxLen: number) => number;
  cqm2_cuda_cortex_gemm_tanh: (
    hA: Float32Array,
    hB: Float32Array,
    hC: Float32Array,
    M: number,
    N: number,
    K: number,
    elapsedOut: Float64Array,
  ) => number;
  cqm2_cuda_organism_brains_strided: (
    inputs: Float32Array,
    weights: Float32Array,
    outputs: Float32Array,
    count: number,
    elapsedOut: Float64Array,
  ) => number;
  cqm2_asm_micro_cortex_gemv: (
    inVec: Float32Array,
    weightMat: Float32Array,
    biasVec: Float32Array,
    outVec: Float32Array,
    inDim: number,
    outDim: number,
  ) => void;
  cqm2_asm_pauli_commute: (ux: bigint, uz: bigint, vx: bigint, vz: bigint) => number;
  cqm2_hw_shutdown: () => void;
}

interface ZigNativeFfiSymbols {
  cqm2_organism_brain_batch_simd: (
    inputs: Float32Array,
    weights: Float32Array,
    modulators: Float32Array,
    outputs: Float32Array,
    count: number,
    lr: number,
  ) => void;
}

interface RustLedgerFfiSymbols {
  cqm2_rust_fnv1a64: (bytes: Uint8Array, len: number) => bigint;
  cqm2_rust_merkle_root64: (leaves: BigUint64Array, count: number) => bigint;
  cqm2_rust_audit_metabolic_conservation: (
    pools15: Float64Array,
    totalIntake: Float64Array,
    entityCount: number,
    maxRelErrOut: Float64Array,
  ) => number;
  cqm2_rust_lemire_lattice_sample: (seed: bigint, bound: number, outU32: Uint32Array, count: number) => bigint;
  cqm2_rust_bf16_xor_encode: (srcF32: Float32Array, outU16: Uint16Array, count: number) => bigint;
  cqm2_rust_bf16_xor_decode: (deltasU16: Uint16Array, outF32: Float32Array, count: number) => void;
}

function fastPadeTanh(x: number): number {
  if (x > 4.95) return 1.0;
  if (x < -4.95) return -1.0;
  const x2 = x * x;
  return (x * (27.0 + x2)) / (27.0 + 9.0 * x2);
}

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x00000100000001b3n;
const MASK64 = 0xffffffffffffffffn;

function fnv1a64Fallback(bytes: Uint8Array): bigint {
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i]!);
    h = (h * FNV_PRIME) & MASK64;
  }
  return h;
}

function mixPair64Fallback(left: bigint, right: bigint): bigint {
  const buf = new Uint8Array(16);
  const dv = new DataView(buf.buffer);
  dv.setBigUint64(0, BigInt.asUintN(64, left), true);
  dv.setBigUint64(8, BigInt.asUintN(64, right), true);
  let z = (fnv1a64Fallback(buf) + 0x9e3779b97f4a7c15n) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return (z ^ (z >> 31n)) & MASK64;
}

export class TriEngineOrchestrator {
  public readonly zig: ZigKernelBridge;
  public readonly npu: NpuWorldClient;
  public readonly tsotchke: TsotchkeNativeBridge;
  private triSymbols: TriAccelFfiSymbols | null = null;
  private zigNativeSymbols: ZigNativeFfiSymbols | null = null;
  private rustSymbols: RustLedgerFfiSymbols | null = null;
  private hwJson: Record<string, unknown> = {};
  private initialized = false;

  public constructor() {
    this.zig = getZigBridge();
    this.npu = new NpuWorldClient();
    this.tsotchke = getTsotchkeNativeBridge();
  }

  public async init(options: { enableNpuDaemon?: boolean } = {}): Promise<SiliconHardwareTopology> {
    if (!this.initialized) {
      await this.loadNativeLibraries();
      await this.tsotchke.init();
      await this.npu.init(options.enableNpuDaemon ?? false);
      this.initialized = true;
    }
    return this.getTopology();
  }

  private async loadNativeLibraries(): Promise<void> {
    if (typeof Bun === 'undefined') return;
    const { dlopen, FFIType } = await import('bun:ffi');

    const triDllPath = join(BIN_DIR, 'cqm2_tri_accel.dll');
    if (process.platform === 'win32' && existsSync(triDllPath)) {
      try {
        const lib = dlopen(triDllPath, {
          cqm2_hw_init: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
          cqm2_cuda_cortex_gemm_tanh: {
            args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr],
            returns: FFIType.f64,
          },
          cqm2_cuda_organism_brains_strided: {
            args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.ptr],
            returns: FFIType.f64,
          },
          cqm2_asm_micro_cortex_gemv: {
            args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32],
            returns: FFIType.void,
          },
          cqm2_asm_pauli_commute: {
            args: [FFIType.u64, FFIType.u64, FFIType.u64, FFIType.u64],
            returns: FFIType.u32,
          },
          cqm2_hw_shutdown: { args: [], returns: FFIType.void },
        });
        this.triSymbols = lib.symbols as unknown as TriAccelFfiSymbols;
        const jsonBuf = new Uint8Array(1024);
        this.triSymbols.cqm2_hw_init(jsonBuf, jsonBuf.length);
        const nul = jsonBuf.indexOf(0);
        const rawStr = new TextDecoder().decode(nul >= 0 ? jsonBuf.subarray(0, nul) : jsonBuf);
        if (rawStr.startsWith('{')) {
          this.hwJson = JSON.parse(rawStr) as Record<string, unknown>;
        }
        if (this.hwJson.cudaReady) {
          const wA = new Float32Array(16 * 16);
          const wB = new Float32Array(16 * 16);
          const wC = new Float32Array(16 * 16);
          const wMs = new Float64Array(1);
          this.triSymbols.cqm2_cuda_cortex_gemm_tanh(wA, wB, wC, 16, 16, 16, wMs);
        }
      } catch {
        this.triSymbols = null;
      }
    }

    // Load zero-copy `cqm2_zig.dll` / `libcqm2_zig.so` native Zig FFI!
    for (const zName of ['cqm2_zig.dll', 'libcqm2_zig.so', 'libcqm2_zig.dylib']) {
      const zPath = join(BIN_DIR, zName);
      if (existsSync(zPath)) {
        try {
          const zlib = dlopen(zPath, {
            cqm2_organism_brain_batch_simd: {
              args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.f32],
              returns: FFIType.void,
            },
          });
          this.zigNativeSymbols = zlib.symbols as unknown as ZigNativeFfiSymbols;
          break;
        } catch {
          this.zigNativeSymbols = null;
        }
      }
    }

    const rustCandidates = ['cqm2_rust_ledger.dll', 'libcqm2_rust_ledger.so', 'libcqm2_rust_ledger.dylib'];
    for (const candidate of rustCandidates) {
      const full = join(BIN_DIR, candidate);
      if (existsSync(full)) {
        try {
          const rlib = dlopen(full, {
            cqm2_rust_fnv1a64: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.u64 },
            cqm2_rust_merkle_root64: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.u64 },
            cqm2_rust_audit_metabolic_conservation: {
              args: [FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.ptr],
              returns: FFIType.u32,
            },
            cqm2_rust_lemire_lattice_sample: {
              args: [FFIType.u64, FFIType.u32, FFIType.ptr, FFIType.u64],
              returns: FFIType.u64,
            },
            cqm2_rust_bf16_xor_encode: {
              args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
              returns: FFIType.u64,
            },
            cqm2_rust_bf16_xor_decode: {
              args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
              returns: FFIType.void,
            },
          });
          this.rustSymbols = rlib.symbols as unknown as RustLedgerFfiSymbols;
          break;
        } catch {
          this.rustSymbols = null;
        }
      }
    }
  }

  public getTopology(): SiliconHardwareTopology {
    const goExe = join(BIN_DIR, process.platform === 'win32' ? 'cqm2-telemetry-bridge.exe' : 'cqm2-telemetry-bridge');
    const npuStatus = this.npu.getStatus();
    return {
      hostPlatform: process.platform,
      cpuArch: process.arch,
      cudaReady: Boolean(this.hwJson.cudaReady),
      gpuName: String(this.hwJson.gpuName ?? 'WebGPU / CPU Portable Fallback'),
      vramGb: Number(this.hwJson.vramGb ?? 0),
      igpuDmlReady: Boolean(this.hwJson.igpuDmlReady) || npuStatus.auxDevice.startsWith('GPU'),
      igpuName: String(
        this.hwJson.igpuName && this.hwJson.igpuName !== 'NONE'
          ? this.hwJson.igpuName
          : npuStatus.auxDeviceName,
      ),
      npuLevelZeroReady: Boolean(this.hwJson.npuLevelZeroReady) || npuStatus.primaryDevice === 'NPU',
      npuName: String(
        this.hwJson.npuName && this.hwJson.npuName !== 'NONE'
          ? this.hwJson.npuName
          : npuStatus.primaryDevice === 'NPU'
            ? npuStatus.primaryDeviceName
            : 'NONE',
      ),
      npuSlices: Number(this.hwJson.npuSlices ?? 0),
      avx2AsmReady: Boolean(this.triSymbols && this.hwJson.avx2AsmReady),
      zigNativeFfiReady: Boolean(this.zigNativeSymbols),
      zigNativeDllReady: Boolean(this.zigNativeSymbols),
      rustLedgerReady: Boolean(this.rustSymbols),
      zigSimdReady: true,
      goOscBridgePresent: existsSync(goExe),
      npuWorker: npuStatus,
      tsotchkeNative: this.tsotchke.getStatus(),
    };
  }

  /**
   * Evaluates REAL living organisms' unique `8->8->6` genomes on RTX 5070 Ti `cuBLAS` StridedBatched SGEMM
   * (with zero-copy Zig Native AVX2 FFI plastic weight update when `lr > 0`)!
   */
  public dispatchOrganismCortexBatch(
    inputs: Float32Array,
    weights: Float32Array,
    modulators: Float32Array,
    outputs: Float32Array,
    count: number,
    lr: number,
  ): CortexGemmReceipt {
    if (count <= 0) {
      return { backend: 'CPU-Reference', gflops: 0, elapsedMs: 0, rows: 0, cols: 6, depth: 8 };
    }

    if (this.triSymbols && Boolean(this.hwJson.cudaReady)) {
      const elapsedOut = new Float64Array(1);
      const gflops = this.triSymbols.cqm2_cuda_organism_brains_strided(inputs, weights, outputs, count, elapsedOut);
      // Apply in-place dual-layer Hebbian Oja plasticity on zero-copy native Zig FFI when lr > 0!
      if (Math.abs(lr) > 1e-7) {
        if (this.zigNativeSymbols) {
          this.zigNativeSymbols.cqm2_organism_brain_batch_simd(inputs, weights, modulators, outputs, count, lr);
        } else {
          this.zig.stepOrganismBrainsSimd(inputs, weights, modulators, outputs, count, lr);
        }
      }
      return {
        backend: 'CUDA-cuBLAS-StridedBatched',
        gflops,
        elapsedMs: elapsedOut[0]!,
        rows: count,
        cols: 6,
        depth: 8,
      };
    }

    const t0 = performance.now();
    if (this.zigNativeSymbols) {
      this.zigNativeSymbols.cqm2_organism_brain_batch_simd(inputs, weights, modulators, outputs, count, lr);
      const elapsedMs = Math.max(0.001, performance.now() - t0);
      return {
        backend: 'Zig-Native-FFI',
        gflops: (count * 224) / (elapsedMs * 1e6),
        elapsedMs,
        rows: count,
        cols: 6,
        depth: 8,
      };
    }

    this.zig.stepOrganismBrainsSimd(inputs, weights, modulators, outputs, count, lr);
    const elapsedMs = Math.max(0.001, performance.now() - t0);
    return {
      backend: 'CPU-Reference',
      gflops: (count * 224) / (elapsedMs * 1e6),
      elapsedMs,
      rows: count,
      cols: 6,
      depth: 8,
    };
  }

  public dispatchGpuCortexGemm(A: Float32Array, B: Float32Array, C: Float32Array, M: number, N: number, K: number): CortexGemmReceipt {
    if (this.triSymbols && Boolean(this.hwJson.cudaReady)) {
      const elapsedOut = new Float64Array(1);
      const gflops = this.triSymbols.cqm2_cuda_cortex_gemm_tanh(A, B, C, M, N, K, elapsedOut);
      return {
        backend: 'CUDA-cuBLAS',
        gflops,
        elapsedMs: elapsedOut[0]!,
        rows: M,
        cols: N,
        depth: K,
      };
    }

    const t0 = performance.now();
    for (let m = 0; m < M; m++) {
      const aRow = m * K;
      const cRow = m * N;
      for (let n = 0; n < N; n++) {
        let sum = 0;
        for (let k = 0; k < K; k++) {
          sum += A[aRow + k]! * B[k * N + n]!;
        }
        C[cRow + n] = fastPadeTanh(sum);
      }
    }
    const elapsedMs = Math.max(0.001, performance.now() - t0);
    const gflops = (2.0 * M * N * K) / (elapsedMs * 1e6);
    return {
      backend: 'CPU-Reference',
      gflops,
      elapsedMs,
      rows: M,
      cols: N,
      depth: K,
    };
  }

  public dispatchAsmMicroCortex(inVec: Float32Array, weights: Float32Array, bias: Float32Array, outVec: Float32Array): void {
    const inDim = inVec.length;
    const outDim = outVec.length;
    if (this.triSymbols) {
      this.triSymbols.cqm2_asm_micro_cortex_gemv(inVec, weights, bias, outVec, inDim, outDim);
      return;
    }
    for (let o = 0; o < outDim; o++) {
      let sum = bias[o] ?? 0;
      const row = o * inDim;
      for (let i = 0; i < inDim; i++) {
        sum += inVec[i]! * weights[row + i]!;
      }
      outVec[o] = fastPadeTanh(sum);
    }
  }

  public pauliCommute64(ux: bigint, uz: bigint, vx: bigint, vz: bigint): boolean {
    if (this.triSymbols) {
      return (
        this.triSymbols.cqm2_asm_pauli_commute(
          BigInt.asUintN(64, ux),
          BigInt.asUintN(64, uz),
          BigInt.asUintN(64, vx),
          BigInt.asUintN(64, vz),
        ) === 1
      );
    }
    const countBits = (n: bigint): number => {
      let v = BigInt.asUintN(64, n);
      let c = 0;
      while (v !== 0n) {
        v &= v - 1n;
        c++;
      }
      return c;
    };
    const p1 = countBits(ux & vz) & 1;
    const p2 = countBits(uz & vx) & 1;
    return (p1 ^ p2) === 0;
  }

  public hashBytes64(bytes: Uint8Array): bigint {
    if (bytes.length === 0) return FNV_OFFSET_BASIS;
    if (this.rustSymbols) {
      return BigInt.asUintN(64, this.rustSymbols.cqm2_rust_fnv1a64(bytes, bytes.length));
    }
    return fnv1a64Fallback(bytes);
  }

  public merkleRoot64(leaves: BigUint64Array): bigint {
    if (leaves.length === 0) return 0n;
    if (this.rustSymbols) {
      return BigInt.asUintN(64, this.rustSymbols.cqm2_rust_merkle_root64(leaves, leaves.length));
    }
    let layer = Array.from(leaves, (x) => BigInt.asUintN(64, x));
    while (layer.length > 1) {
      const next: bigint[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        const l = layer[i]!;
        const r = i + 1 < layer.length ? layer[i + 1]! : l;
        next.push(mixPair64Fallback(l, r));
      }
      layer = next;
    }
    return layer[0]!;
  }

  public lemireLatticeSample(seed: bigint, bound: number, count: number): { samples: Uint32Array; nextSeed: bigint } {
    const samples = new Uint32Array(count);
    if (count <= 0 || bound <= 0) return { samples, nextSeed: seed };
    if (this.rustSymbols) {
      const nextSeed = BigInt.asUintN(
        64,
        this.rustSymbols.cqm2_rust_lemire_lattice_sample(BigInt.asUintN(64, seed), bound >>> 0, samples, count),
      );
      return { samples, nextSeed };
    }
    let s = BigInt.asUintN(64, seed);
    for (let i = 0; i < count; i++) {
      s = (s + 0x9e3779b97f4a7c15n) & MASK64;
      let z = s;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
      z = (z ^ (z >> 31n)) & MASK64;
      samples[i] = Number((z & 0xffffffffn) % BigInt(bound));
    }
    return { samples, nextSeed: s };
  }

  public bf16XorEncode(src: Float32Array): { deltas: Uint16Array; nonzeroResiduals: number } {
    const deltas = new Uint16Array(src.length);
    if (src.length === 0) return { deltas, nonzeroResiduals: 0 };
    if (this.rustSymbols) {
      const nz = Number(this.rustSymbols.cqm2_rust_bf16_xor_encode(src, deltas, src.length));
      return { deltas, nonzeroResiduals: nz };
    }
    const u32 = new Uint32Array(src.buffer, src.byteOffset, src.length);
    let prev = 0;
    let nz = 0;
    for (let i = 0; i < src.length; i++) {
      const bits = u32[i]!;
      const q = ((bits + 0x7fff + ((bits >>> 16) & 1)) >>> 16) & 0xffff;
      const d = q ^ prev;
      deltas[i] = d;
      if (d !== 0) nz++;
      prev = q;
    }
    return { deltas, nonzeroResiduals: nz };
  }

  public bf16XorDecode(deltas: Uint16Array): Float32Array {
    const out = new Float32Array(deltas.length);
    if (deltas.length === 0) return out;
    if (this.rustSymbols) {
      this.rustSymbols.cqm2_rust_bf16_xor_decode(deltas, out, deltas.length);
      return out;
    }
    const u32 = new Uint32Array(out.buffer);
    let prev = 0;
    for (let i = 0; i < deltas.length; i++) {
      const q = (deltas[i]! ^ prev) & 0xffff;
      u32[i] = (q << 16) >>> 0;
      prev = q;
    }
    return out;
  }

  public auditMetabolicConservation(pools15: Float64Array, totalIntake: Float64Array, entityCount: number): MetabolicAuditReceipt {
    if (entityCount <= 0) {
      return {
        auditor: this.rustSymbols ? 'Rust-1.94-Kahan-FFI' : 'TS-Kahan-Reference',
        valid: true,
        maxRelativeDrift: 0,
        entityCount: 0,
      };
    }
    if (this.rustSymbols) {
      const errOut = new Float64Array(1);
      const ok = this.rustSymbols.cqm2_rust_audit_metabolic_conservation(pools15, totalIntake, entityCount, errOut);
      return {
        auditor: 'Rust-1.94-Kahan-FFI',
        valid: ok === 1,
        maxRelativeDrift: errOut[0]!,
        entityCount,
      };
    }

    let maxRel = 0;
    let allValid = true;
    for (let e = 0; e < entityCount; e++) {
      const base = e * 15;
      let sum = 0;
      let c = 0;
      for (let k = 0; k < 15; k++) {
        const val = pools15[base + k]!;
        if (!Number.isFinite(val) || val < -1e-12) allValid = false;
        const y = val - c;
        const t = sum + y;
        c = t - sum - y;
        sum = t;
      }
      const expected = totalIntake[e]!;
      const denom = Math.max(1.0, Math.abs(expected));
      const rel = Math.abs(sum - expected) / denom;
      if (!Number.isFinite(rel) || rel >= 1e-12) allValid = false;
      if (rel > maxRel) maxRel = rel;
    }
    return {
      auditor: 'TS-Kahan-Reference',
      valid: allValid,
      maxRelativeDrift: maxRel,
      entityCount,
    };
  }

  public async dispatchNpuWorldModel(latentBatch2048: Float32Array): Promise<NpuRssmResult> {
    return this.npu.stepRssmWorldModel(latentBatch2048);
  }

  public async dispatchIgpuFieldDiffusion(fieldUv2048: Float32Array, feed = 0.036, kill = 0.061): Promise<IgpuFieldResult> {
    return this.npu.stepFieldDiffusion2D(fieldUv2048, feed, kill);
  }

  public shutdown(): void {
    this.npu.shutdown();
    if (this.triSymbols) {
      this.triSymbols.cqm2_hw_shutdown();
    }
    this.initialized = false;
  }
}

let sharedTriEngine: TriEngineOrchestrator | null = null;
export function getTriEngine(): TriEngineOrchestrator {
  if (!sharedTriEngine) {
    sharedTriEngine = new TriEngineOrchestrator();
  }
  return sharedTriEngine;
}
