/**
 * CQM2 v2.1.0 Isomorphic Zig 0.17 SIMD128 WebAssembly Kernel Bridge.
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
  cqm2_eshkol_vandermonde_jet4(history5Ptr: number, jetOut5Ptr: number): number;
  cqm2_schwarzschild_photon_deflection(impactBOverM: number, maxSteps: number, capturedOutPtr: number): number;
  cqm2_kerr_mino_geodesic(
    spinA: number,
    inclRad: number,
    xi: number,
    eta: number,
    maxSteps: number,
    out4Ptr: number,
  ): number;
  cqm2_llg_spin_step(
    spinsXyzPtr: number,
    hEffXyzPtr: number,
    count: number,
    alphaGilbert: number,
    dt: number,
  ): number;
  cqm2_spherical_harmonics_l2(dirXyzPtr: number, out9Ptr: number): void;
  cqm2_rmsnorm_swiglu(xInPtr: number, gateInPtr: number, weightPtr: number, outPtr: number, dim: number): number;
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
  cqm2_fwht_quantum_magic_m2(psiRePtr: number, psiImPtr: number, nQubits: number): number;
  cqm2_glyph_brain_batch_step(
    statesPtr: number,
    lateralWPtr: number,
    drivePtr: number,
    numGlyphs: number,
    lr: number,
  ): number;
  cqm2_csr_pagerank_louvain_arena(
    numNodes: number,
    edgeUPtr: number,
    edgeVPtr: number,
    numEdges: number,
    rowPtr: number,
    colIdxPtr: number,
    degPtr: number,
    cursorPtr: number,
    nextPrPtr: number,
    commVolPtr: number,
    pagerankOutPtr: number,
    communityOutPtr: number,
    statsOut4Ptr: number,
  ): number;
  cqm2_quasicrystal_icosa_shell(
    gridExtent: number,
    perpCutoff: number,
    rMin: number,
    rMax: number,
    outXyzPtr: number,
    maxPoints: number,
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

  public eshkolVandermondeJet4(history5: Float32Array, jetOut5: Float32Array): number {
    this.exports.cqm2_reset_heap();
    const hPtr = this.allocF32(history5.subarray(0, 5));
    const jPtr = this.allocF32Zero(5);
    const confidence = this.exports.cqm2_eshkol_vandermonde_jet4(hPtr, jPtr);
    jetOut5.subarray(0, 5).set(new Float32Array(this.exports.memory.buffer, jPtr, 5));
    return confidence;
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

  public kerrMinoGeodesic(
    spinA: number,
    inclRad: number,
    xi: number,
    eta: number,
    maxSteps = 4000,
  ): { captured: boolean; rMin: number; phiAccum: number; diskCrossings: number; carterRelDrift: number } {
    this.exports.cqm2_reset_heap();
    const outPtr = this.exports.cqm2_alloc(32);
    const cap = this.exports.cqm2_kerr_mino_geodesic(spinA, inclRad, xi, eta, maxSteps, outPtr);
    const view = new Float64Array(this.exports.memory.buffer, outPtr, 4);
    return {
      captured: cap === 1,
      rMin: view[0]!,
      phiAccum: view[1]!,
      diskCrossings: view[2]!,
      carterRelDrift: view[3]!,
    };
  }

  public stepLlgSpins(spinsXyz: Float32Array, hEffXyz: Float32Array, alphaGilbert = 0.08, dt = 0.05): number {
    const count = Math.floor(Math.min(spinsXyz.length, hEffXyz.length) / 3);
    if (count <= 0) return 0;
    this.exports.cqm2_reset_heap();
    const sPtr = this.allocF32(spinsXyz.subarray(0, count * 3));
    const hPtr = this.allocF32(hEffXyz.subarray(0, count * 3));
    const mzMean = this.exports.cqm2_llg_spin_step(sPtr, hPtr, count, alphaGilbert, dt);
    spinsXyz.subarray(0, count * 3).set(new Float32Array(this.exports.memory.buffer, sPtr, count * 3));
    return mzMean;
  }

  public sphericalHarmonicsL2(x: number, y: number, z: number): Float32Array {
    this.exports.cqm2_reset_heap();
    const inPtr = this.allocF32(new Float32Array([x, y, z]));
    const outPtr = this.allocF32Zero(9);
    this.exports.cqm2_spherical_harmonics_l2(inPtr, outPtr);
    const res = new Float32Array(9);
    res.set(new Float32Array(this.exports.memory.buffer, outPtr, 9));
    return res;
  }

  public rmsNormSwiglu(xIn: Float32Array, gateIn: Float32Array, weight: Float32Array, out: Float32Array): number {
    const dim = Math.min(xIn.length, gateIn.length, weight.length, out.length);
    if (dim <= 0) return 0;
    this.exports.cqm2_reset_heap();
    const xPtr = this.allocF32(xIn.subarray(0, dim));
    const gPtr = this.allocF32(gateIn.subarray(0, dim));
    const wPtr = this.allocF32(weight.subarray(0, dim));
    const oPtr = this.allocF32Zero(dim);
    const meanAbs = this.exports.cqm2_rmsnorm_swiglu(xPtr, gPtr, wPtr, oPtr, dim);
    out.subarray(0, dim).set(new Float32Array(this.exports.memory.buffer, oPtr, dim));
    return meanAbs;
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

  public computeFwhtQuantumMagicM2(psiRe: Float64Array, psiIm: Float64Array, nQubits: number): number {
    if (nQubits <= 0 || nQubits > 8) return 0;
    const dim = 1 << nQubits;
    this.exports.cqm2_reset_heap();
    const rePtr = this.exports.cqm2_alloc(dim * 8);
    const imPtr = this.exports.cqm2_alloc(dim * 8);
    new Float64Array(this.exports.memory.buffer, rePtr, dim).set(psiRe.subarray(0, dim));
    new Float64Array(this.exports.memory.buffer, imPtr, dim).set(psiIm.subarray(0, dim));
    return this.exports.cqm2_fwht_quantum_magic_m2(rePtr, imPtr, nQubits >>> 0);
  }

  public stepGlyphBrainBatch(
    states: Float32Array,
    lateralW: Float32Array,
    drive: Float32Array,
    numGlyphs: number,
    lr: number,
  ): number {
    if (numGlyphs <= 0) return 0;
    this.exports.cqm2_reset_heap();
    const sPtr = this.allocF32(states.subarray(0, numGlyphs * 1024));
    const wPtr = this.allocF32(lateralW.subarray(0, numGlyphs * 4));
    const dPtr = this.allocF32(drive.subarray(0, numGlyphs * 4));
    const meanEnergy = this.exports.cqm2_glyph_brain_batch_step(sPtr, wPtr, dPtr, numGlyphs >>> 0, lr);
    const buf = this.exports.memory.buffer;
    states.subarray(0, numGlyphs * 1024).set(new Float32Array(buf, sPtr, numGlyphs * 1024));
    if (Math.abs(lr) > 1e-7) {
      lateralW.subarray(0, numGlyphs * 4).set(new Float32Array(buf, wPtr, numGlyphs * 4));
    }
    return meanEnergy;
  }

  public computeCsrPagerankLouvain(
    numNodes: number,
    edgeU: Uint32Array,
    edgeV: Uint32Array,
    numEdges: number,
  ): {
    pagerank: Float32Array;
    communities: Uint32Array;
    modularityQ: number;
    degreeEntropyBits: number;
    maxPagerank: number;
    communityCount: number;
  } {
    const pagerank = new Float32Array(numNodes);
    const communities = new Uint32Array(numNodes);
    if (numNodes <= 0) {
      return { pagerank, communities, modularityQ: 0, degreeEntropyBits: 0, maxPagerank: 0, communityCount: 0 };
    }
    this.exports.cqm2_reset_heap();
    const eCount = Math.min(numEdges, edgeU.length, edgeV.length);
    const euPtr = this.exports.cqm2_alloc(Math.max(16, eCount * 4));
    const evPtr = this.exports.cqm2_alloc(Math.max(16, eCount * 4));
    const rowPtr = this.exports.cqm2_alloc((numNodes + 1) * 4);
    const colIdxPtr = this.exports.cqm2_alloc(Math.max(16, eCount * 2 * 4));
    const degPtr = this.exports.cqm2_alloc(numNodes * 4);
    const cursorPtr = this.exports.cqm2_alloc((numNodes + 1) * 4);
    const nextPrPtr = this.exports.cqm2_alloc(numNodes * 4);
    const commVolPtr = this.exports.cqm2_alloc(numNodes * 8);
    const prOutPtr = this.exports.cqm2_alloc(numNodes * 4);
    const commOutPtr = this.exports.cqm2_alloc(numNodes * 4);
    const statsPtr = this.exports.cqm2_alloc(32);

    const buf0 = this.exports.memory.buffer;
    if (eCount > 0) {
      new Uint32Array(buf0, euPtr, eCount).set(edgeU.subarray(0, eCount));
      new Uint32Array(buf0, evPtr, eCount).set(edgeV.subarray(0, eCount));
    }

    this.exports.cqm2_csr_pagerank_louvain_arena(
      numNodes >>> 0,
      euPtr,
      evPtr,
      eCount >>> 0,
      rowPtr,
      colIdxPtr,
      degPtr,
      cursorPtr,
      nextPrPtr,
      commVolPtr,
      prOutPtr,
      commOutPtr,
      statsPtr,
    );

    const buf = this.exports.memory.buffer;
    pagerank.set(new Float32Array(buf, prOutPtr, numNodes));
    communities.set(new Uint32Array(buf, commOutPtr, numNodes));
    const stats = new Float64Array(buf, statsPtr, 4);
    return {
      pagerank,
      communities,
      modularityQ: stats[0]!,
      degreeEntropyBits: stats[1]!,
      maxPagerank: stats[2]!,
      communityCount: Math.round(stats[3]!),
    };
  }

  public projectQuasicrystalIcosaShell(
    gridExtent = 3,
    perpCutoff = 1.65,
    rMin = 0.8,
    rMax = 3.2,
    maxPoints = 2048,
  ): Float32Array {
    this.exports.cqm2_reset_heap();
    const outPtr = this.allocF32Zero(maxPoints * 3);
    const count = this.exports.cqm2_quasicrystal_icosa_shell(
      gridExtent | 0,
      perpCutoff,
      rMin,
      rMax,
      outPtr,
      maxPoints >>> 0,
    );
    const res = new Float32Array(count * 3);
    res.set(new Float32Array(this.exports.memory.buffer, outPtr, count * 3));
    return res;
  }
}

let sharedZigBridge: ZigKernelBridge | null = null;
export function getZigBridge(): ZigKernelBridge {
  if (!sharedZigBridge) {
    sharedZigBridge = new ZigKernelBridge();
  }
  return sharedZigBridge;
}
