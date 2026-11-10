/**
 * CQM2 Isomorphic Zig 0.17 SIMD128 WebAssembly Kernel Bridge.
 * Zero Node/Bun-only imports: runs identically inside any modern Browser (Mobile/Desktop/4K),
 * Bun local server, or Node 24 CI runner with deterministic arena reset per call!
 */
import { CQM2_ZIG_WASM_BASE64 } from './zig-wasm-embedded';

export interface ZigWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  cqm2_reset_heap(): void;
  cqm2_alloc(byteLen: number): number;
  cqm2_heap_used(): number;
  cqm2_organism_brain_batch_simd(
    inputsPtr: number,
    weightsPtr: number,
    modulatorsPtr: number,
    outputsPtr: number,
    count: number,
    lr: number,
  ): void;
  cqm2_sltc_larkum_step(
    vStatePtr: number,
    nmdaSlowPtr: number,
    basalInPtr: number,
    apicalInPtr: number,
    n: number,
    dt: number,
    ach: number,
    ne: number,
    onsetReset: number,
  ): number;
  cqm2_cerebellum_marr_albus_step(
    granuleWPtr: number,
    pfWeightsPtr: number,
    cmdProprioPtr: number,
    climbingErrPtr: number,
    correctionOutPtr: number,
    etaCf: number,
  ): number;
  cqm2_deltanet_fast_weights_step(
    stateMatPtr: number,
    rawSenseKeyPtr: number,
    expectedValPtr: number,
    alignedOutPtr: number,
    alphaDecay: number,
    betaLearn: number,
  ): number;
  cqm2_verlet_shuffled_step(
    posPtr: number,
    prevPosPtr: number,
    invMassPtr: number,
    numParticles: number,
    edgeAPtr: number,
    edgeBPtr: number,
    restLenPtr: number,
    stiffnessPtr: number,
    orderScratchPtr: number,
    numEdges: number,
    dt: number,
    gravityY: number,
    rngStatePtr: number,
  ): void;
  cqm2_pauli_commute(u: number, v: number, nQubits: number): number;
  cqm2_pauli_line_sign(u: number, v: number, nQubits: number): number;
  cqm2_hoggar_isotropic_census(nQubits: number, satOutPtr: number, violOutPtr: number): number;
  cqm2_hoggar_qgt_violated_hexagon_count(traceOutPtr: number): number;
  cqm2_tsotchke_qrng_batch(seedInOutPtr: number, outF64Ptr: number, count: number, rctOkOutPtr: number): void;
  cqm2_eshkol_spine_curvature(ptsXyzPtr: number, curvOutPtr: number, numPts: number): number;
  cqm2_schwarzschild_photon_deflection(impactBOverM: number, maxSteps: number, capturedOutPtr: number): number;
  cqm2_reactive_skin_step(
    uGsPtr: number,
    vGsPtr: number,
    fhnVPtr: number,
    fhnWPtr: number,
    w: number,
    h: number,
    leptin: number,
    cortisol: number,
    dopamine: number,
    neuralDrive: number,
  ): number;
}

function decodeBase64Bytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export class ZigKernelBridge {
  private readonly exports: ZigWasmExports;

  public constructor() {
    const bytes = decodeBase64Bytes(CQM2_ZIG_WASM_BASE64);
    const mod = new WebAssembly.Module(bytes as BufferSource);
    const inst = new WebAssembly.Instance(mod, {});
    this.exports = inst.exports as ZigWasmExports;
  }

  private allocF32(src: Float32Array): number {
    const ptr = this.exports.cqm2_alloc(src.byteLength);
    if (ptr === 0) throw new Error(`Zig WASM arena exhausted allocating ${src.byteLength} bytes`);
    new Float32Array(this.exports.memory.buffer, ptr, src.length).set(src);
    return ptr;
  }

  private allocF32Zero(len: number): number {
    const byteLen = len * 4;
    const ptr = this.exports.cqm2_alloc(byteLen);
    if (ptr === 0) throw new Error(`Zig WASM arena exhausted allocating ${byteLen} bytes`);
    new Float32Array(this.exports.memory.buffer, ptr, len).fill(0);
    return ptr;
  }

  private allocU16(src: Uint16Array): number {
    const ptr = this.exports.cqm2_alloc(src.byteLength);
    if (ptr === 0) throw new Error(`Zig WASM arena exhausted allocating ${src.byteLength} bytes`);
    new Uint16Array(this.exports.memory.buffer, ptr, src.length).set(src);
    return ptr;
  }

  /**
   * Evaluates `count` organisms' 8->8->6 neuromodulated brains in SIMD128!
   * Updates `weights` in-place when `lr > 0` and writes motor/affect actions into `outputs`.
   */
  public stepOrganismBrainsSimd(
    inputs: Float32Array,
    weights: Float32Array,
    modulators: Float32Array,
    outputs: Float32Array,
    count: number,
    lr: number,
  ): void {
    if (count <= 0) return;
    this.exports.cqm2_reset_heap();
    const inPtr = this.allocF32(inputs.subarray(0, count * 8));
    const wPtr = this.allocF32(weights.subarray(0, count * 126));
    const modPtr = this.allocF32(modulators.subarray(0, count * 2));
    const outPtr = this.allocF32Zero(count * 6);

    this.exports.cqm2_organism_brain_batch_simd(inPtr, wPtr, modPtr, outPtr, count, lr);

    const buf = this.exports.memory.buffer;
    outputs.subarray(0, count * 6).set(new Float32Array(buf, outPtr, count * 6));
    if (Math.abs(lr) > 1e-7) {
      weights.subarray(0, count * 126).set(new Float32Array(buf, wPtr, count * 126));
    }
  }

  /**
   * Biophysical Larkum 2-Compartment NMDA + Hasani Fused Semi-Implicit sLTC step.
   */
  public stepSltcLarkum(
    vState: Float32Array,
    nmdaSlow: Float32Array,
    basalIn: Float32Array,
    apicalIn: Float32Array,
    dt: number,
    ach: number,
    ne: number,
    onsetReset: number,
  ): number {
    const n = vState.length;
    if (n === 0) return 0;
    this.exports.cqm2_reset_heap();
    const vPtr = this.allocF32(vState);
    const nmdaPtr = this.allocF32(nmdaSlow);
    const bPtr = this.allocF32(basalIn);
    const aPtr = this.allocF32(apicalIn);

    const meanAbs = this.exports.cqm2_sltc_larkum_step(vPtr, nmdaPtr, bPtr, aPtr, n, dt, ach, ne, onsetReset);
    const buf = this.exports.memory.buffer;
    vState.set(new Float32Array(buf, vPtr, n));
    nmdaSlow.set(new Float32Array(buf, nmdaPtr, n));
    return meanAbs;
  }

  /**
   * Glitchling Compensatory Organ 1: Marr-Albus Cerebellar 16 -> 256 -> 8 Forward + Climbing-Fiber LTD/LTP.
   */
  public stepCerebellumMarrAlbus(
    granuleW: Float32Array,
    pfWeights: Float32Array,
    cmdProprio16: Float32Array,
    climbingErr8: Float32Array,
    correctionOut8: Float32Array,
    etaCf: number,
  ): number {
    this.exports.cqm2_reset_heap();
    const gwPtr = this.allocF32(granuleW);
    const pfPtr = this.allocF32(pfWeights);
    const cpPtr = this.allocF32(cmdProprio16);
    const errPtr = this.allocF32(climbingErr8);
    const outPtr = this.allocF32Zero(8);

    const norm = this.exports.cqm2_cerebellum_marr_albus_step(gwPtr, pfPtr, cpPtr, errPtr, outPtr, etaCf);
    const buf = this.exports.memory.buffer;
    pfWeights.set(new Float32Array(buf, pfPtr, 8 * 256));
    correctionOut8.set(new Float32Array(buf, outPtr, 8));
    return norm;
  }

  /**
   * Glitchling Compensatory Organ 2: Gated-DeltaNet 16x16 Associative Fast-Weight Sensory Unscrambler.
   */
  public stepDeltaNetFastWeights(
    stateMat256: Float32Array,
    rawSenseKey16: Float32Array,
    expectedVal16: Float32Array,
    alignedOut16: Float32Array,
    alphaDecay: number,
    betaLearn: number,
  ): number {
    this.exports.cqm2_reset_heap();
    const sPtr = this.allocF32(stateMat256);
    const kPtr = this.allocF32(rawSenseKey16);
    const vPtr = this.allocF32(expectedVal16);
    const oPtr = this.allocF32Zero(16);

    const rmse = this.exports.cqm2_deltanet_fast_weights_step(sPtr, kPtr, vPtr, oPtr, alphaDecay, betaLearn);
    const buf = this.exports.memory.buffer;
    stateMat256.set(new Float32Array(buf, sPtr, 256));
    alignedOut16.set(new Float32Array(buf, oPtr, 16));
    return rmse;
  }

  /**
   * LCG-shuffled zero-yaw-bias Verlet soft-body constraint solver.
   */
  public stepVerletShuffled(
    pos: Float32Array,
    prevPos: Float32Array,
    invMass: Float32Array,
    edgeA: Uint16Array,
    edgeB: Uint16Array,
    restLen: Float32Array,
    stiffness: Float32Array,
    dt: number,
    gravityY: number,
    rngState: number,
  ): number {
    const numParticles = invMass.length;
    const numEdges = edgeA.length;
    this.exports.cqm2_reset_heap();
    const posPtr = this.allocF32(pos);
    const prevPtr = this.allocF32(prevPos);
    const massPtr = this.allocF32(invMass);
    const eaPtr = this.allocU16(edgeA);
    const ebPtr = this.allocU16(edgeB);
    const rlPtr = this.allocF32(restLen);
    const stPtr = this.allocF32(stiffness);
    const scratchPtr = this.exports.cqm2_alloc(Math.max(16, numEdges * 2));
    const rngPtr = this.exports.cqm2_alloc(16);
    new Uint32Array(this.exports.memory.buffer, rngPtr, 1)[0] = rngState >>> 0;

    this.exports.cqm2_verlet_shuffled_step(
      posPtr,
      prevPtr,
      massPtr,
      numParticles,
      eaPtr,
      ebPtr,
      rlPtr,
      stPtr,
      scratchPtr,
      numEdges,
      dt,
      gravityY,
      rngPtr,
    );

    const buf = this.exports.memory.buffer;
    pos.set(new Float32Array(buf, posPtr, pos.length));
    prevPos.set(new Float32Array(buf, prevPtr, prevPos.length));
    return new Uint32Array(buf, rngPtr, 1)[0]!;
  }

  public pauliCommute(u: number, v: number, nQubits: number): boolean {
    return this.exports.cqm2_pauli_commute(u >>> 0, v >>> 0, nQubits >>> 0) === 1;
  }

  public pauliLineSign(u: number, v: number, nQubits: number): number {
    return this.exports.cqm2_pauli_line_sign(u >>> 0, v >>> 0, nQubits >>> 0);
  }

  public hoggarIsotropicCensus(nQubits: number): { total: number; satisfied: number; violated: number } {
    this.exports.cqm2_reset_heap();
    const ptr = this.exports.cqm2_alloc(16);
    const total = this.exports.cqm2_hoggar_isotropic_census(nQubits >>> 0, ptr, ptr + 4);
    const view = new Uint32Array(this.exports.memory.buffer, ptr, 2);
    return { total: total >>> 0, satisfied: view[0]!, violated: view[1]! };
  }

  public hoggarViolatedHexagonCensus(): { violatedHexagonLines: number; metricTrace: number } {
    this.exports.cqm2_reset_heap();
    const tracePtr = this.exports.cqm2_alloc(16);
    const violated = this.exports.cqm2_hoggar_qgt_violated_hexagon_count(tracePtr);
    const trace = new Float64Array(this.exports.memory.buffer, tracePtr, 1)[0]!;
    return { violatedHexagonLines: violated >>> 0, metricTrace: trace };
  }

  public qrngBatch(seed: bigint, count: number): { values: Float64Array; nextSeed: bigint; rctHealthy: boolean } {
    this.exports.cqm2_reset_heap();
    const seedPtr = this.exports.cqm2_alloc(16);
    const rctPtr = this.exports.cqm2_alloc(16);
    const outPtr = this.exports.cqm2_alloc(Math.max(16, count * 8));
    new BigUint64Array(this.exports.memory.buffer, seedPtr, 1)[0] = BigInt.asUintN(64, seed);

    this.exports.cqm2_tsotchke_qrng_batch(seedPtr, outPtr, count, rctPtr);
    const buf = this.exports.memory.buffer;
    const values = new Float64Array(count);
    values.set(new Float64Array(buf, outPtr, count));
    const nextSeed = new BigUint64Array(buf, seedPtr, 1)[0]!;
    const rctHealthy = new Uint32Array(buf, rctPtr, 1)[0] === 1;
    return { values, nextSeed, rctHealthy };
  }

  public eshkolSpineCurvature(ptsXyz: Float32Array, curvOut: Float32Array): number {
    const numPts = Math.floor(ptsXyz.length / 3);
    if (numPts < 3) return 0;
    this.exports.cqm2_reset_heap();
    const ptsPtr = this.allocF32(ptsXyz);
    const outPtr = this.allocF32Zero(numPts);
    const meanCurv = this.exports.cqm2_eshkol_spine_curvature(ptsPtr, outPtr, numPts);
    curvOut.subarray(0, numPts).set(new Float32Array(this.exports.memory.buffer, outPtr, numPts));
    return meanCurv;
  }

  public schwarzschildPhotonDeflection(
    impactBOverM: number,
    maxSteps = 4000,
  ): { deflectionRad: number; captured: boolean } {
    this.exports.cqm2_reset_heap();
    const capPtr = this.exports.cqm2_alloc(16);
    const deflectionRad = this.exports.cqm2_schwarzschild_photon_deflection(impactBOverM, maxSteps, capPtr);
    const captured = new Uint32Array(this.exports.memory.buffer, capPtr, 1)[0] === 1;
    return { deflectionRad, captured };
  }

  public stepReactiveSkin(
    uGs: Float32Array,
    vGs: Float32Array,
    fhnV: Float32Array,
    fhnW: Float32Array,
    w: number,
    h: number,
    leptin: number,
    cortisol: number,
    dopamine: number,
    neuralDrive: number,
  ): number {
    this.exports.cqm2_reset_heap();
    const uPtr = this.allocF32(uGs);
    const vPtr = this.allocF32(vGs);
    const fvPtr = this.allocF32(fhnV);
    const fwPtr = this.allocF32(fhnW);
    const meanPattern = this.exports.cqm2_reactive_skin_step(
      uPtr,
      vPtr,
      fvPtr,
      fwPtr,
      w,
      h,
      leptin,
      cortisol,
      dopamine,
      neuralDrive,
    );
    const buf = this.exports.memory.buffer;
    const len = w * h;
    uGs.set(new Float32Array(buf, uPtr, len));
    vGs.set(new Float32Array(buf, vPtr, len));
    fhnV.set(new Float32Array(buf, fvPtr, len));
    fhnW.set(new Float32Array(buf, fwPtr, len));
    return meanPattern;
  }
}

let sharedZigBridge: ZigKernelBridge | null = null;
export function getZigBridge(): ZigKernelBridge {
  if (!sharedZigBridge) {
    sharedZigBridge = new ZigKernelBridge();
  }
  return sharedZigBridge;
}
