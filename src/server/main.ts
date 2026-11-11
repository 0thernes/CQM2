/**
 * CQM2 v2.2.0 Local Full-Stack Quad-Silicon Workstation Server (`Bun.serve` + WebSocket + 3NF SQLite WAL + Tri-Engine).
 *
 * Security, API & Reliability Hardening (`grade-a-standard` `WEB,API,DB,AI,SIM,NATIVE,AGENT,PUB`):
 *   - `Cross-Origin-Opener-Policy: same-origin` & `Cross-Origin-Embedder-Policy: require-corp` (`SharedArrayBuffer`)
 *   - Strict `Content-Security-Policy` (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `X-Request-Id`
 *   - Versioned `/api/v1/*` + backwards-compatible `/api/*` routing + published OpenAPI 3.1.0 (`/api/v1/openapi.json`)
 *   - Bounded LRU sliding-window rate limiting (`429` + `Retry-After` + `X-RateLimit-Remaining`, socket IP only)
 *   - Body ceiling (`<= 256 KB` `413`), JSON depth (`<= 8`), duplicate-key & prototype-pollution blocking (`400`)
 *   - `405 Method Not Allowed` (`Allow`), `415 Unsupported Media Type`, `406 Not Acceptable`, `Idempotency-Key` (`409`)
 *   - Strict CORS origin allowlist (never reflecting arbitrary or `null` origins)
 *   - Real Quad-Silicon dispatch: RTX 5070 Ti CUDA `cublasSgemmStridedBatched_v2`, Intel AI Boost NPU RSSM,
 *     Intel Graphics iGPU 2D field diffusion, Zig 0.17 AVX2, Rust 1.94 Kahan/Merkle, and Go 1.26 20 Hz OSC bridge.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { TmsArousalMode } from '../brains/asmodenius';
import { runAsmodeniusR21BenchmarkSuite, runComprehensive12CausalSuite } from '../brains/causal-benchmarks';
import { runThalerCreativityAblationSuite } from '../brains/thaler-creativity';
import { runXylosRealityMonitoringAssay } from '../brains/xylos';
import { type GodDialParams } from '../core/prng';
import type { BiomeKind, CasteRole } from '../erp/relational-store';
import { type CortexGemmReceipt, getTriEngine, type TriEngineOrchestrator } from '../native/tri-engine';
import {
  buildProceduralChromatophorePng,
  exportAiWorldInteropBundle,
  exportBlender4PythonRig,
  exportCosmicKerrRingdownWav,
  exportCreatureGlbBinary,
  exportCreatureGltf2Json,
  exportCreatureWavefrontObj,
  exportTouchDesignerBridgeScript,
  exportUnity6BridgeScript,
} from '../pipeline/exporters';
import {
  runAiSafetyAndQualityEvalSuite,
  runScholarlyAiNarration,
  validateExternalHttpsUrlAgainstSsrf,
} from '../pipeline/free-ai-studio';
import { Cqm2WorldScheduler, type SimulationRunState, type WorldTickTelemetry } from '../sim/world-scheduler';
import { Cqm2SqliteDatabase, MAX_DB_PAGE_SIZE } from './db';

const ROOT_DIR = resolve(import.meta.dir, '..', '..');
const SITE_DIR = resolve(ROOT_DIR, 'site');
const PUBLIC_DIR = resolve(ROOT_DIR, 'public');
const OPENAPI_PATH = resolve(ROOT_DIR, 'docs', 'openapi.json');
const MAX_JSON_BODY_BYTES = 256 * 1024;
const MAX_JSON_DEPTH = 8;
const MAX_RATE_BUCKETS = 4096;
const MAX_IDEMPOTENCY_ENTRIES = 512;

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json; charset=utf-8',
  '.obj': 'text/plain; charset=utf-8',
  '.py': 'text/x-python; charset=utf-8',
  '.cs': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
});

export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface StructuredServerLogEntry {
  timestampIso: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  requestId: string;
  method: string;
  path: string;
  status: number;
  elapsedMs: number;
  code?: string;
  message?: string;
}

/**
 * Constant-time token/secret verifier over fixed-length SHA-256 digests (`T-276`).
 */
export function verifySecretConstantTime(provided: string, expected: string): boolean {
  const hA = createHash('sha256').update(provided, 'utf8').digest();
  const hB = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(hA, hB) && provided.length === expected.length;
}

/**
 * Generates a 128-bit cryptographic request identifier (`T-277`).
 */
export function generateCryptoRequestId(): string {
  return 'req_' + randomBytes(16).toString('hex');
}

export function parseStrictFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function detectDuplicateJsonKeysOrExcessDepth(rawJson: string): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  const containers: Array<'OBJ' | 'ARR'> = [];
  const objKeySets: Array<Set<string>> = [];
  const expectingKey: boolean[] = [];
  let tokenStart = -1;

  for (let i = 0; i < rawJson.length; i++) {
    const ch = rawJson[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        const literal = rawJson.slice(tokenStart + 1, i);
        let j = i + 1;
        while (j < rawJson.length && /\s/.test(rawJson[j]!)) j++;
        if (
          rawJson[j] === ':' &&
          containers[containers.length - 1] === 'OBJ' &&
          expectingKey[expectingKey.length - 1] === true
        ) {
          const topSet = objKeySets[objKeySets.length - 1]!;
          if (literal === '__proto__' || literal === 'constructor' || literal === 'prototype') {
            return `Forbidden prototype-pollution key '${literal}'`;
          }
          if (topSet.has(literal)) {
            return `Duplicate JSON property '${literal}' is not permitted`;
          }
          topSet.add(literal);
          expectingKey[expectingKey.length - 1] = false;
        }
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      tokenStart = i;
    } else if (ch === '{') {
      depth += 1;
      if (depth > MAX_JSON_DEPTH) return `JSON nesting exceeds maximum depth of ${MAX_JSON_DEPTH}`;
      containers.push('OBJ');
      objKeySets.push(new Set<string>());
      expectingKey.push(true);
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      containers.pop();
      objKeySets.pop();
      expectingKey.pop();
    } else if (ch === '[') {
      depth += 1;
      if (depth > MAX_JSON_DEPTH) return `JSON nesting exceeds maximum depth of ${MAX_JSON_DEPTH}`;
      containers.push('ARR');
      expectingKey.push(false);
    } else if (ch === ']') {
      depth = Math.max(0, depth - 1);
      containers.pop();
      expectingKey.pop();
    } else if (ch === ',' && containers[containers.length - 1] === 'OBJ') {
      expectingKey[expectingKey.length - 1] = true;
    }
  }
  return null;
}

function sanitizeJsonObjectDeep(val: unknown, depth = 0): unknown {
  if (depth > MAX_JSON_DEPTH) {
    throw new Error(`JSON nesting exceeds maximum depth of ${MAX_JSON_DEPTH}`);
  }
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeJsonObjectDeep(item, depth + 1));
  }
  const clean = Object.create(null) as Record<string, unknown>;
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    clean[k] = sanitizeJsonObjectDeep(v, depth + 1);
  }
  return { ...clean };
}

function scanLocalTsotchkeMirrorMap(): Record<string, boolean> {
  const dir = process.env.CQM2_TSOTCHKE_DIR ?? 'z:\\[Vibe Coded (AI)]\\(Tsotchke)';
  const out: Record<string, boolean> = {};
  if (!existsSync(dir)) return out;
  try {
    for (const entry of readdirSync(dir)) {
      out[entry] = true;
    }
  } catch {
    // Non-fatal if host directory cannot be enumerated
  }
  return out;
}

export interface Cqm2ServerHandle {
  readonly port: number;
  readonly url: string;
  readonly world: Cqm2WorldScheduler;
  readonly db: Cqm2SqliteDatabase;
  readonly triEngine: TriEngineOrchestrator;
  setSimulatedDbOutage(offline: boolean): void;
  findLogsByRequestId(requestId: string): StructuredServerLogEntry[];
  stop(): void;
}

const KNOWN_ROUTE_METHODS: Readonly<Record<string, ReadonlyArray<string>>> = {
  '/api/health': ['GET'],
  '/api/openapi.json': ['GET'],
  '/api/hardware': ['GET'],
  '/api/telemetry/gpu': ['GET'],
  '/api/tsotchke/native': ['GET'],
  '/api/connectome/csr': ['POST'],
  '/api/eshkol/eval': ['POST'],
  '/api/audit': ['GET'],
  '/api/consciousness-lab': ['GET'],
  '/api/sentience-lab': ['GET'],
  '/api/world/state': ['GET'],
  '/api/world/step': ['POST'],
  '/api/world/dials': ['POST'],
  '/api/world/pause': ['POST'],
  '/api/world/checkpoint': ['POST'],
  '/api/world/rollback': ['POST'],
  '/api/brain/tms-poke': ['POST'],
  '/api/brain/benchmarks': ['POST'],
  '/api/glitchling/configure': ['POST'],
  '/api/tsotchke/toggle': ['POST'],
  '/api/erp/query': ['GET'],
  '/api/erp/organisms': ['GET'],
  '/api/erp/biomes': ['GET', 'POST'],
  '/api/ai/ollama': ['POST'],
  '/api/ai/narrate': ['POST'],
  '/api/copilot': ['POST'],
  '/api/chat': ['POST'],
  '/api/ai/texture': ['GET'],
  '/api/ai/mesh3d': ['POST'],
  '/api/jobs/retention': ['POST'],
};

export async function createCqm2Server(options: {
  port?: number;
  hostname?: string;
  dbPath?: string;
  enableNpuDaemon?: boolean;
  enableGoOscDaemon?: boolean;
  rateLimitPerMinute?: number;
  aiRateLimitPerMinute?: number;
  jobSharedSecret?: string;
  seed?: number;
} = {}): Promise<Cqm2ServerHandle> {
  const hostname = options.hostname ?? process.env.CQM2_HOST ?? '127.0.0.1';
  const requestedPort = options.port ?? Number(process.env.CQM2_PORT ?? process.env.PORT ?? 4200);
  const dbPath = options.dbPath ?? process.env.CQM2_DB_PATH ?? join(ROOT_DIR, 'data', 'cqm2_local.sqlite');
  const rateLimitMax = options.rateLimitPerMinute ?? 600;
  const aiRateLimitMax = options.aiRateLimitPerMinute ?? 30;
  const jobSecret = options.jobSharedSecret ?? process.env.CQM2_JOB_SECRET ?? 'cqm2-local-maintenance-secret-v210';

  const triEngine = getTriEngine();
  await triEngine.init({ enableNpuDaemon: options.enableNpuDaemon ?? false });

  const localMirrorMap = scanLocalTsotchkeMirrorMap();
  const world = new Cqm2WorldScheduler({ seed: options.seed ?? 20261110, initialPopulation: 96 });
  const db = new Cqm2SqliteDatabase(dbPath);
  if (dbPath !== ':memory:') {
    db.loadLatestCheckpoint(world.store);
  }
  db.persistCheckpoint(world.store);

  let simulatedDbOutage = false;
  let goProc: ReturnType<typeof Bun.spawn> | null = null;
  const goExe = join(ROOT_DIR, 'native', 'bin', process.platform === 'win32' ? 'cqm2-telemetry-bridge.exe' : 'cqm2-telemetry-bridge');
  if (options.enableGoOscDaemon && existsSync(goExe)) {
    try {
      goProc = Bun.spawn([goExe], { stdout: 'ignore', stderr: 'ignore' });
    } catch {
      goProc = null;
    }
  }

  // Real silicon scratch views (populated dynamically from real organism & habitat tensors — NEVER dummy `.fill()`)
  const npuRealLatentBatch = new Float32Array(32 * 64);
  const igpuRealFieldUv = new Float32Array(2 * 32 * 32);

  // Bounded LRU sliding-window rate limiters + idempotency store + structured log ring buffer
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const aiRateBuckets = new Map<string, { count: number; resetAt: number }>();
  const idempotencyCache = new Map<string, { payloadHash: string; status: number; bodyJson: string; createdAt: number }>();
  const recentLogs: StructuredServerLogEntry[] = [];
  const wsClients = new Set<{ send(data: string): void }>();

  const recordLog = (entry: StructuredServerLogEntry) => {
    recentLogs.push(entry);
    if (recentLogs.length > 512) recentLogs.shift();
  };

  const checkSlidingRate = (
    map: Map<string, { count: number; resetAt: number }>,
    key: string,
    maxPerMin: number,
  ): { allowed: boolean; remaining: number; retryAfterSec: number } => {
    const now = Date.now();
    const existing = map.get(key);
    if (!existing || now >= existing.resetAt) {
      if (map.size >= MAX_RATE_BUCKETS && !map.has(key)) {
        const oldestKey = map.keys().next().value;
        if (oldestKey !== undefined) map.delete(oldestKey);
      }
      map.set(key, { count: 1, resetAt: now + 60_000 });
      return { allowed: true, remaining: Math.max(0, maxPerMin - 1), retryAfterSec: 0 };
    }
    existing.count += 1;
    const rem = Math.max(0, maxPerMin - existing.count);
    const retrySec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: existing.count <= maxPerMin, remaining: rem, retryAfterSec: retrySec };
  };

  const buildCorsHeaders = (req: Request, actualPort: number): Record<string, string> | 'FORBIDDEN_ORIGIN' => {
    const origin = req.headers.get('origin');
    if (!origin) return {};
    const allowed = new Set([
      `http://127.0.0.1:${actualPort}`,
      `http://localhost:${actualPort}`,
      'https://0thernes.github.io',
    ]);
    if (!allowed.has(origin)) {
      return 'FORBIDDEN_ORIGIN';
    }
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, X-Request-Id, X-Cqm2-Job-Secret',
      Vary: 'Origin',
    };
  };

  /**
   * Executes one or more deterministic simulation steps across REAL Quad-Silicon hardware:
   *   1. RTX 5070 Ti CUDA `cublasSgemmStridedBatched_v2` on every living organism's unique 126-float genome
   *   2. Rust 1.94 Kahan First-Law 15-pool conservation auditor
   *   3. Intel AI Boost NPU OpenVINO `[32, 64]` `[latent48 | action16]` world-model rollout (when active)
   *   4. Intel Graphics iGPU `[1, 2, 32, 32]` Gray-Scott Turing habitat field diffusion (when active)
   */
  const executeQuadSiliconSteps = async (steps: number, dtSec: number, includeAsyncNpuIgpu: boolean) => {
    let lastGpuReceipt: CortexGemmReceipt = {
      backend: 'CPU-Reference',
      gflops: 0,
      elapsedMs: 0,
      rows: 0,
      cols: 6,
      depth: 8,
    };

    const cortexHook = (
      ins: Float32Array,
      wts: Float32Array,
      mods: Float32Array,
      outs: Float32Array,
      count: number,
      lr: number,
    ) => {
      lastGpuReceipt = triEngine.dispatchOrganismCortexBatch(ins, wts, mods, outs, count, lr);
    };

    let latestTel: WorldTickTelemetry = world.stepTick(dtSec, cortexHook);
    for (let s = 1; s < steps; s++) {
      latestTel = world.stepTick(dtSec, cortexHook);
    }

    const rustAudit = triEngine.auditMetabolicConservation(
      world.store.pools15,
      world.store.totalIntakeKj,
      world.store.activeCount,
    );

    const gpuDeviceKind =
      lastGpuReceipt.backend === 'CUDA-cuBLAS-StridedBatched' || lastGpuReceipt.backend === 'CUDA-cuBLAS'
        ? 'GPU_CUDA'
        : 'CPU_ZIG_SIMD';
    const gpuRec = {
      simTick: latestTel.simTick,
      deviceKind: gpuDeviceKind as 'GPU_CUDA' | 'CPU_ZIG_SIMD',
      kernelName: 'cqm2_cuda_organism_brains_strided_8x8x6',
      batchSize: lastGpuReceipt.rows,
      elapsedMs: lastGpuReceipt.elapsedMs,
      gflops: lastGpuReceipt.gflops,
      conservationValid: rustAudit.valid,
    };
    world.store.recordDispatchReceipt(gpuRec);
    if (!simulatedDbOutage && db.ping()) {
      db.insertHardwareReceipt(world.store.epoch.epochId, gpuRec);
    }

    let npuReceipt = null;
    let igpuReceipt = null;
    if (includeAsyncNpuIgpu || triEngine.npu.getStatus().daemonActive) {
      // Populate REAL `[32, 64]` `[latent48 | action16]` from live organism states + Asmodenius/Xylos/Thaler!
      const nAct = Math.max(1, world.store.activeCount);
      for (let b = 0; b < 32; b++) {
        const eid = b % nAct;
        const baseOff = b * 64;
        const sOff = eid * 8;
        const mOff = eid * 6;
        const pOff = eid * 15;
        for (let k = 0; k < 8; k++) npuRealLatentBatch[baseOff + k] = world.store.senseIn8[sOff + k] ?? 0;
        for (let k = 0; k < 14; k++) {
          npuRealLatentBatch[baseOff + 8 + k] = latestTel.asmodenius.regionActivations14[k] ?? 0;
        }
        for (let k = 0; k < 15; k++) {
          npuRealLatentBatch[baseOff + 22 + k] = Math.tanh((world.store.pools15[pOff + k] ?? 0) * 0.05);
        }
        npuRealLatentBatch[baseOff + 37] = world.store.o2Reserve[eid] ?? 0.95;
        npuRealLatentBatch[baseOff + 38] = world.store.bloodPh[eid] ?? 7.4;
        npuRealLatentBatch[baseOff + 39] = world.store.rosDamage[eid] ?? 0.02;
        npuRealLatentBatch[baseOff + 40] = latestTel.xylos.veridicalProbability.value;
        npuRealLatentBatch[baseOff + 41] = latestTel.thaler.candidateNovelty;
        for (let k = 42; k < 48; k++) {
          npuRealLatentBatch[baseOff + k] = world.spineCurvature[k - 42] ?? 0;
        }
        // 16 action channels: 6 organism motors + 6 Asmodenius motors + 4 Ising VQE drives
        for (let a = 0; a < 6; a++) npuRealLatentBatch[baseOff + 48 + a] = world.store.motorOut6[mOff + a] ?? 0;
        for (let a = 0; a < 6; a++) npuRealLatentBatch[baseOff + 54 + a] = latestTel.asmodenius.motorCmd6[a] ?? 0;
        for (let a = 0; a < 4; a++) npuRealLatentBatch[baseOff + 60 + a] = latestTel.isingVqeDrives4[a] ?? 0;
      }

      npuReceipt = await triEngine.dispatchNpuWorldModel(npuRealLatentBatch);
      const npuRec = {
        simTick: latestTel.simTick,
        deviceKind: 'NPU_OPENVINO' as const,
        kernelName: 'cqm2_npu_action_rssm_32x64',
        batchSize: 32,
        elapsedMs: npuReceipt.ms,
        gflops: 0,
        conservationValid: rustAudit.valid,
      };
      world.store.recordDispatchReceipt(npuRec);
      if (!simulatedDbOutage && db.ping()) {
        db.insertHardwareReceipt(world.store.epoch.epochId, npuRec);
      }

      // Populate REAL `[1, 2, 32, 32]` habitat reaction-diffusion field from `world.skinUGs`/`skinVGs`
      for (let y = 0; y < 32; y++) {
        const sy = Math.min(world.skinHeight - 1, Math.floor((y * world.skinHeight) / 32));
        for (let x = 0; x < 32; x++) {
          const sx = Math.min(world.skinWidth - 1, Math.floor((x * world.skinWidth) / 32));
          const sIdx = sy * world.skinWidth + sx;
          const dIdx = y * 32 + x;
          igpuRealFieldUv[dIdx] = world.skinUGs[sIdx] ?? 1.0;
          igpuRealFieldUv[1024 + dIdx] = world.skinVGs[sIdx] ?? 0.0;
        }
      }
      igpuReceipt = await triEngine.dispatchIgpuFieldDiffusion(igpuRealFieldUv, 0.036, 0.061);
      // Couple iGPU habitat diffusion meanV subtly back into chromatophore boundary
      if (Number.isFinite(igpuReceipt.meanV)) {
        const clampedMeanV = Math.max(0, Math.min(1, igpuReceipt.meanV));
        for (let i = 0; i < world.skinWidth; i++) {
          world.skinVGs[i] = 0.92 * world.skinVGs[i]! + 0.08 * clampedMeanV;
        }
      }
      const igpuRec = {
        simTick: latestTel.simTick,
        deviceKind: 'IGPU_DML' as const,
        kernelName: 'cqm2_igpu_gray_scott_2x32x32',
        batchSize: 1,
        elapsedMs: igpuReceipt.ms,
        gflops: 0,
        conservationValid: rustAudit.valid,
      };
      world.store.recordDispatchReceipt(igpuRec);
      if (!simulatedDbOutage && db.ping()) {
        db.insertHardwareReceipt(world.store.epoch.epochId, igpuRec);
      }
    }

    // Fire-and-forget non-blocking update to Go 20 Hz UDP OSC bridge if listening on 127.0.0.1:4201
    if (triEngine.getTopology().goOscBridgePresent && options.enableGoOscDaemon) {
      fetch('http://127.0.0.1:4201/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tick: latestTel.simTick,
          asmodeniusPci: world.store.pciProxy[0] ?? latestTel.asmodenius.metacognitiveConfidenceHot3.value,
          violatedHexLines: latestTel.hoggar.violatedHexagonH2Lines,
          xylosVeridicalTag: latestTel.xylos.veridicalProbability.value,
          populationAlive: latestTel.aliveCount,
        }),
        signal: AbortSignal.timeout(150),
      }).catch(() => undefined);
    }

    return { latestTel, gpuReceipt: lastGpuReceipt, rustAudit, npuReceipt, igpuReceipt };
  };

  let boundPort = requestedPort;

  const server = Bun.serve({
    hostname,
    port: requestedPort,
    websocket: {
      open(ws) {
        wsClients.add(ws);
          ws.send(
          JSON.stringify({
            type: 'welcome',
            version: '4.0.0',
            hardware: triEngine.getTopology(),
            epoch: world.store.epoch,
          }),
        );
      },
      async message(ws, message) {
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
        if (text.length > 8192) return;
        try {
          const msg = JSON.parse(text) as Record<string, unknown>;
          if (msg.cmd === 'step') {
            const { latestTel, gpuReceipt, rustAudit } = await executeQuadSiliconSteps(1, 0.05, false);
            ws.send(JSON.stringify({ type: 'tick', telemetry: latestTel, gpuReceipt, rustAudit }));
          } else if (msg.cmd === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', simTick: world.store.epoch.simTick }));
          }
        } catch {
          ws.send(JSON.stringify({ type: 'error', code: 'WS_BAD_JSON', error: 'Invalid WS JSON command' }));
        }
      },
      close(ws) {
        wsClients.delete(ws);
      },
    },
    async fetch(req, srv) {
      const reqStartMs = performance.now();
      const url = new URL(req.url);
      const rawClientReqId = req.headers.get('x-request-id')?.trim();
      const requestId =
        rawClientReqId && /^[A-Za-z0-9_-]{6,64}$/.test(rawClientReqId) ? rawClientReqId : generateCryptoRequestId();

      // Always take client IP from platform socket (`srv.requestIP`), never spoofable X-Forwarded-For (`T-180`)
      const clientIp = srv.requestIP(req)?.address ?? '127.0.0.1';

      const corsResult = buildCorsHeaders(req, boundPort);
      const makeHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
        ...SECURITY_HEADERS,
        'X-Request-Id': requestId,
        ...(corsResult !== 'FORBIDDEN_ORIGIN' ? corsResult : {}),
        ...extra,
      });

      const sendJson = (payload: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}): Response => {
        const elapsedMs = performance.now() - reqStartMs;
        recordLog({
          timestampIso: new Date().toISOString(),
          level: status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO',
          requestId,
          method: req.method,
          path: url.pathname,
          status,
          elapsedMs,
          ...(typeof payload.code === 'string' ? { code: payload.code } : {}),
          ...(typeof payload.message === 'string' ? { message: payload.message } : {}),
        });
        return new Response(JSON.stringify({ ...payload, requestId }), {
          status,
          headers: makeHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders,
          }),
        });
      };

      const sendError = (
        status: number,
        code: string,
        message: string,
        details: ApiErrorDetail[] = [],
        extraHeaders: Record<string, string> = {},
      ): Response =>
        sendJson(
          {
            ok: false,
            code,
            error: message,
            message,
            details,
          },
          status,
          extraHeaders,
        );

      if (corsResult === 'FORBIDDEN_ORIGIN') {
        return sendError(403, 'CORS_ORIGIN_DENIED', 'Origin is not on the workstation allowlist');
      }

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: makeHeaders() });
      }

      // Header size cap (`T-194`)
      let totalHeaderBytes = 0;
      req.headers.forEach((v, k) => {
        totalHeaderBytes += k.length + v.length;
      });
      if (totalHeaderBytes > 16 * 1024) {
        return sendError(431, 'REQUEST_HEADERS_TOO_LARGE', 'Request header fields exceed 16 KB ceiling');
      }

      const rateCheck = checkSlidingRate(rateBuckets, clientIp, rateLimitMax);
      if (!rateCheck.allowed) {
        return sendError(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded; back off before retrying', [], {
          'Retry-After': String(rateCheck.retryAfterSec),
          'X-RateLimit-Remaining': '0',
        });
      }

      if (url.pathname === '/ws') {
        if (srv.upgrade(req)) return undefined;
        return sendError(400, 'WS_UPGRADE_FAILED', 'WebSocket upgrade failed');
      }

      // Raw + percent-decoded path-traversal guard (`I-275`, `T-243`)
      const rawUrlPath = req.url.split('?')[0] ?? '';
      let decodedPath = url.pathname;
      try {
        decodedPath = decodeURIComponent(url.pathname);
      } catch {
        return sendError(400, 'MALFORMED_URL', 'Malformed percent-encoding in request URL');
      }
      if (
        rawUrlPath.includes('..') ||
        rawUrlPath.toLowerCase().includes('%2e') ||
        decodedPath.includes('..') ||
        decodedPath.includes('\\') ||
        decodedPath.includes('\0')
      ) {
        return sendError(403, 'PATH_TRAVERSAL_BLOCKED', 'Forbidden path traversal sequence');
      }

      // Normalize `/api/v1/*` -> `/api/*` so both v1 and legacy routes share identical handlers (`T-207`)
      const apiPath = decodedPath.startsWith('/api/v1/')
        ? '/api/' + decodedPath.slice('/api/v1/'.length)
        : decodedPath === '/api/v1'
          ? '/api'
          : decodedPath;

      if (apiPath.startsWith('/api/')) {
        // Content negotiation check (`T-186`)
        const accept = (req.headers.get('accept') ?? '*/*').toLowerCase();
        if (
          !apiPath.startsWith('/api/export/') &&
          apiPath !== '/api/ai/texture' &&
          !accept.includes('*/*') &&
          !accept.includes('application/json')
        ) {
          return sendError(406, 'NOT_ACCEPTABLE', 'API endpoints produce application/json');
        }

        // Dedicated burst throttle on costly `/api/ai/*` and `/api/export/*` routes (`I-266`, `T-268`, `T-483`)
        if (apiPath.startsWith('/api/ai/') || apiPath.startsWith('/api/export/')) {
          const burst = checkSlidingRate(aiRateBuckets, `${clientIp}::costly`, aiRateLimitMax);
          if (!burst.allowed) {
            return sendError(429, 'COSTLY_ENDPOINT_THROTTLED', 'AI/Export burst quota reached; retry shortly', [], {
              'Retry-After': String(burst.retryAfterSec),
              'X-RateLimit-Remaining': '0',
            });
          }
        }

        // Method check (`405 Method Not Allowed` with `Allow` header, `T-183`)
        let allowedMethods: ReadonlyArray<string> | null = KNOWN_ROUTE_METHODS[apiPath] ?? null;
        if (!allowedMethods) {
          if (apiPath.startsWith('/api/export/')) allowedMethods = ['GET'];
          else if (apiPath.startsWith('/api/erp/biomes/')) allowedMethods = ['GET', 'PATCH', 'DELETE'];
          else if (apiPath.startsWith('/api/erp/organisms/')) allowedMethods = ['DELETE'];
        }
        if (allowedMethods && !allowedMethods.includes(req.method)) {
          return sendError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed on ${decodedPath}`, [], {
            Allow: allowedMethods.join(', '),
          });
        }

        // Parse & validate JSON body + Idempotency-Key for mutating methods (`POST`, `PATCH`, `PUT`)
        const parseMutatingBody = async (
          allowedFields?: ReadonlyArray<string>,
        ): Promise<
          | { ok: true; data: Record<string, unknown>; rawText: string; idempKey: string | null }
          | { ok: false; response: Response }
        > => {
          const idempHeader = req.headers.get('idempotency-key');
          let idempKey: string | null = null;
          if (idempHeader !== null) {
            const trimmed = idempHeader.trim();
            if (!/^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) {
              return {
                ok: false,
                response: sendError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must match ^[A-Za-z0-9_-]{8,128}$', [
                  { field: 'Idempotency-Key', code: 'INVALID_FORMAT', message: 'Expected 8..128 URL-safe token chars' },
                ]),
              };
            }
            idempKey = `${req.method}:${apiPath}:${trimmed}`;
          }

          const contentLen = Number(req.headers.get('content-length') ?? '0');
          if (contentLen > MAX_JSON_BODY_BYTES) {
            return {
              ok: false,
              response: sendError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 256 KB limit'),
            };
          }
          const buf = await req.arrayBuffer();
          if (buf.byteLength > MAX_JSON_BODY_BYTES) {
            return {
              ok: false,
              response: sendError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 256 KB limit'),
            };
          }

          const ct = (req.headers.get('content-type') ?? '').toLowerCase();
          if (buf.byteLength > 0 && !ct.includes('application/json')) {
            return {
              ok: false,
              response: sendError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'),
            };
          }

          const rawText = buf.byteLength > 0 ? new TextDecoder().decode(buf) : '{}';
          if (idempKey) {
            const payloadHash = createHash('sha256').update(rawText).digest('hex');
            const cached = idempotencyCache.get(idempKey);
            if (cached) {
              if (cached.payloadHash !== payloadHash) {
                return {
                  ok: false,
                  response: sendError(
                    409,
                    'IDEMPOTENCY_CONFLICT',
                    'Idempotency-Key was already used with a different request payload',
                  ),
                };
              }
              return {
                ok: false,
                response: new Response(cached.bodyJson, {
                  status: cached.status,
                  headers: makeHeaders({
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store',
                    'X-Idempotent-Replay': 'true',
                  }),
                }),
              };
            }
          }

          if (buf.byteLength === 0) {
            return { ok: true, data: {}, rawText, idempKey };
          }

          const dupOrDepthErr = detectDuplicateJsonKeysOrExcessDepth(rawText);
          if (dupOrDepthErr) {
            return {
              ok: false,
              response: sendError(400, 'INVALID_JSON_STRUCTURE', dupOrDepthErr),
            };
          }

          let parsedRaw: unknown;
          try {
            parsedRaw = JSON.parse(rawText);
          } catch (err) {
            const msg = err instanceof Error ? err.message.slice(0, 120) : 'Unexpected JSON token';
            return {
              ok: false,
              response: sendError(400, 'MALFORMED_JSON', `Malformed JSON request body: ${msg}`),
            };
          }

          if (typeof parsedRaw !== 'object' || parsedRaw === null || Array.isArray(parsedRaw)) {
            return {
              ok: false,
              response: sendError(400, 'JSON_NOT_OBJECT', 'JSON request body must be an object'),
            };
          }

          let sanitized: Record<string, unknown>;
          try {
            sanitized = sanitizeJsonObjectDeep(parsedRaw) as Record<string, unknown>;
          } catch (err) {
            return {
              ok: false,
              response: sendError(400, 'JSON_DEPTH_EXCEEDED', err instanceof Error ? err.message : 'Excessive nesting'),
            };
          }

          if (allowedFields) {
            const allowSet = new Set(allowedFields);
            const unknownDetails: ApiErrorDetail[] = [];
            for (const k of Object.keys(sanitized)) {
              if (!allowSet.has(k)) {
                unknownDetails.push({
                  field: k,
                  code: 'UNKNOWN_PROPERTY',
                  message: `Unknown property '${k}' is not accepted by this endpoint`,
                });
              }
            }
            if (unknownDetails.length > 0) {
              return {
                ok: false,
                response: sendError(400, 'VALIDATION_FAILED', 'Request contains unknown properties', unknownDetails),
              };
            }
          }

          return { ok: true, data: sanitized, rawText, idempKey };
        };

        const sendIdempotentJson = (
          idempKey: string | null,
          rawText: string,
          payload: Record<string, unknown>,
          status = 200,
        ): Response => {
          const resp = sendJson(payload, status, {
            'X-RateLimit-Remaining': String(rateCheck.remaining),
          });
          if (idempKey) {
            const payloadHash = createHash('sha256').update(rawText).digest('hex');
            if (idempotencyCache.size >= MAX_IDEMPOTENCY_ENTRIES) {
              const firstKey = idempotencyCache.keys().next().value;
              if (firstKey !== undefined) idempotencyCache.delete(firstKey);
            }
            idempotencyCache.set(idempKey, {
              payloadHash,
              status,
              bodyJson: JSON.stringify({ ...payload, requestId }),
              createdAt: Date.now(),
            });
          }
          return resp;
        };

        const ensureDatabaseHealthy = (): Response | null => {
          if (simulatedDbOutage || !db.ping()) {
            return sendError(503, 'DATABASE_UNAVAILABLE', 'Local SQLite persistence engine is temporarily unavailable', [], {
              'Retry-After': '5',
            });
          }
          return null;
        };

        // --- GET /api/v1/health ---
        if (apiPath === '/api/health' && req.method === 'GET') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          return sendJson({
            ok: true,
            service: 'cqm2-workstation',
            version: '4.0.0',
            simTick: world.store.epoch.simTick,
            runState: world.runState,
            databaseHealthy: true,
            sharedMemoryActive: world.store.sharedMemoryActive,
            tsotchkeNative: triEngine.tsotchke.getStatus(),
          });
        }

        // --- GET /api/v1/openapi.json ---
        if (apiPath === '/api/openapi.json' && req.method === 'GET') {
          if (existsSync(OPENAPI_PATH)) {
            return new Response(Bun.file(OPENAPI_PATH), {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=60',
              }),
            });
          }
          return sendError(404, 'OPENAPI_MISSING', 'OpenAPI schema file not found');
        }

        // --- GET /api/v1/hardware ---
        if (apiPath === '/api/hardware' && req.method === 'GET') {
          return sendJson({
            ok: true,
            topology: triEngine.getTopology(),
            recentReceipts: world.store.dispatchReceipts.slice(-16),
          });
        }

        // --- GET /api/v1/tsotchke/native (Moonlab + libirrep + Eshkol + RosettaWire + CSR + FWHT Live Attestation) ---
        if (apiPath === '/api/tsotchke/native' && req.method === 'GET') {
          const ts = triEngine.tsotchke;
          const qrng = ts.drawMoonlabQrng(32);
          const qgtl = ts.sampleQgtlQwzGeometry(1.0, 0.45, -0.35, 24);
          const hVec = new Float64Array([0.1, -0.1, 0.05]);
          const jMat = new Float64Array([0, -1, 0, -1, 0, -1, 0, -1, 0]);
          const ising = ts.annealMoonlabIsing(3, hVec, jMat, BigInt(world.store.epoch.simTick + 42));
          const cgHalf = ts.clebschGordan(1, 1, 1, -1, 2, 0);
          const rsc1 = ts.encodeAndVerifyRsc1('cqm2/tick', 'application/octet-stream', qrng.bytes);
          const rsw1 = ts.testRsw1FailClosedStream(11);
          const hd = ts.eshkolHyperDualPotential(0.7, 0.4, 0.5);
          const apexHashes = ts.computeApexGoldenHashes(world.prng.masterSeed);

          // 1-qubit |T> = (|0> + e^{i pi/4}|1>)/sqrt(2) -> exact M_2(|T>) = log2(4/3) ≈ 0.4150375
          const invSqrt2 = Math.SQRT1_2;
          const psiRe = new Float64Array([invSqrt2, invSqrt2 * Math.SQRT1_2]);
          const psiIm = new Float64Array([0, invSqrt2 * Math.SQRT1_2]);
          const magicM2 = ts.computeFwhtQuantumMagicM2(psiRe, psiIm, 1);

          return sendJson({
            ok: true,
            status: ts.getStatus(),
            moonlabQrng: {
              sampleHex: Buffer.from(qrng.bytes.subarray(0, 16)).toString('hex'),
              averageChsh: qrng.averageChsh,
              capabilitiesHex: '0x' + qrng.capabilities.toString(16),
              liveDll: qrng.liveDll,
            },
            moonlabQgtl: qgtl,
            moonlabIsing: {
              bestBitstring: '0b' + ising.bestBitstring.toString(2).padStart(3, '0'),
              bestEnergy: ising.bestEnergy,
              groundEnergy: ising.groundEnergy,
              successProbability: ising.successProbability,
              problemGap: ising.problemGap,
              source: ising.source,
            },
            libirrepClebschGordan: cgHalf,
            rosetteWire: {
              rsc1Cid: rsc1.cid,
              rsc1Verified: rsc1.verified,
              rsw1FailClosed: rsw1,
              canonicalPiJson: ts.canonicalRosetteFloatJson(Math.PI),
            },
            eshkolHyperDual: hd,
            apexGoldenHashes: apexHashes,
            fwhtStabilizerMagicM2: magicM2,
          });
        }

        // --- POST /api/v1/connectome/csr (Zero-GC Native C++20 CSR PageRank + Louvain Modularity) ---
        if (apiPath === '/api/connectome/csr' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['numNodes', 'edgeU', 'edgeV']);
          if (!parsed.ok) return parsed.response;
          const nNodes = parseStrictFiniteNumber(parsed.data.numNodes);
          if (nNodes === null || !Number.isInteger(nNodes) || nNodes < 1 || nNodes > 4096) {
            return sendError(400, 'VALIDATION_FAILED', 'numNodes must be an integer in [1, 4096]');
          }
          if (!Array.isArray(parsed.data.edgeU) || !Array.isArray(parsed.data.edgeV)) {
            return sendError(400, 'VALIDATION_FAILED', 'edgeU and edgeV must be integer arrays');
          }
          const eLen = Math.min(parsed.data.edgeU.length, parsed.data.edgeV.length, 32768);
          const uArr = new Uint32Array(eLen);
          const vArr = new Uint32Array(eLen);
          for (let i = 0; i < eLen; i++) {
            uArr[i] = Math.max(0, Math.min(nNodes - 1, Math.trunc(Number(parsed.data.edgeU[i]) || 0)));
            vArr[i] = Math.max(0, Math.min(nNodes - 1, Math.trunc(Number(parsed.data.edgeV[i]) || 0)));
          }
          const receipt = triEngine.tsotchke.computeCsrPagerankLouvain(nNodes, uArr, vArr, eLen);
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            backend: receipt.backend,
            elapsedMs: receipt.elapsedMs,
            numNodes: receipt.numNodes,
            numEdges: receipt.numEdges,
            modularityQ: receipt.modularityQ,
            degreeEntropyBits: receipt.degreeEntropyBits,
            maxPagerank: receipt.maxPagerank,
            communityCount: receipt.communityCount,
            pagerankSample: Array.from(receipt.pagerank.subarray(0, 32)),
            communitySample: Array.from(receipt.communities.subarray(0, 32)),
          });
        }

        // --- POST /api/v1/eshkol/eval — Safe Mathematical Eshkol HyperDual + Pure Arithmetic .esk Runner ---
        if (apiPath === '/api/eshkol/eval' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['x', 'y', 'coupling', 'schemeExpr']);
          if (!parsed.ok) return parsed.response;
          const x = parseStrictFiniteNumber(parsed.data.x ?? 0.6) ?? 0.6;
          const y = parseStrictFiniteNumber(parsed.data.y ?? 0.4) ?? 0.4;
          const coupling = parseStrictFiniteNumber(parsed.data.coupling ?? 0.5) ?? 0.5;
          const hyperDual = triEngine.tsotchke.eshkolHyperDualPotential(x, y, coupling);

          let cliResult: { ok: boolean; output: string; engine: string } | null = null;
          if (typeof parsed.data.schemeExpr === 'string' && parsed.data.schemeExpr.trim().length > 0) {
            const expr = parsed.data.schemeExpr.trim();
            // Strict pure-math S-expression allowlist: block any file/network/process/system primitives!
            if (expr.length > 512 || /(?:system|process|open-|file|load|port|socket|eval|shell|env|ffi|foreign)/i.test(expr)) {
              return sendError(400, 'UNSAFE_ESHKOL_EXPR', 'Only pure mathematical S-expressions (<=512 chars) are permitted');
            }
            cliResult = triEngine.tsotchke.runEshkolProgramSync(expr);
          }
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            hyperDual,
            cliResult,
          });
        }

        // --- GET /api/v1/audit & /api/v1/consciousness-lab & /api/v1/sentience-lab ---
        if (
          (apiPath === '/api/audit' || apiPath === '/api/consciousness-lab' || apiPath === '/api/sentience-lab') &&
          req.method === 'GET'
        ) {
          const tel = world.stepTick(0.005);
          return sendJson({
            ok: true,
            indicatorOnly: true,
            sentienceClaim: 'NOT_SENTIENT',
            honestyContract: 'CQM-25 / Butlin-14 / Thaler-9 / Casali-PCI mathematical proxies only; zero phenomenal awareness.',
            butlin14Mean: tel.xylos.meanButlinScore,
            veridicalTag: tel.xylos.veridicalProbability.value,
            hot3Confidence: tel.asmodenius.metacognitiveConfidenceHot3.value,
            pciProxy: world.store.pciProxy[0] ?? 0.44,
            thalerNovelty: tel.thaler.candidateNovelty,
            kuramotoR: tel.pantheon.kuramotoOrderParameterR.value,
            hoggarViolatedLines: tel.hoggar.violatedHexagonH2Lines,
            tsotchkeNative: triEngine.tsotchke.getStatus(),
          });
        }

        // --- GET /api/v1/telemetry/gpu ---
        if (apiPath === '/api/telemetry/gpu' && req.method === 'GET') {
          if (options.enableGoOscDaemon) {
            try {
              const r = await fetch('http://127.0.0.1:4201/telemetry', { signal: AbortSignal.timeout(250) });
              if (r.ok) {
                const goJson = (await r.json()) as Record<string, unknown>;
                return sendJson({ ok: true, bridge: 'go-osc-daemon', telemetry: goJson });
              }
            } catch {
              // Fallback to Tri-Engine topology
            }
          }
          const top = triEngine.getTopology();
          return sendJson({
            ok: true,
            bridge: 'tri-engine-ffi',
            telemetry: {
              gpu: {
                available: top.cudaReady,
                name: top.gpuName,
                vramGb: top.vramGb,
              },
              npu: {
                available: top.npuLevelZeroReady,
                name: top.npuName,
              },
              igpu: {
                available: top.igpuDmlReady,
                name: top.igpuName,
              },
            },
          });
        }

        // --- GET /api/v1/world/state ---
        if (apiPath === '/api/world/state' && req.method === 'GET') {
          const tel = world.stepTick(0.005);
          return sendJson({
            ok: true,
            epoch: world.store.epoch,
            dials: world.dials,
            biomes: Array.from(world.store.biomes.values()),
            species: Array.from(world.store.species.values()),
            organismsSample: world.store.queryJoinedOrganisms({ limit: 32 }),
            snapshots: world.store.listSnapshots(),
            tsotchkePillars: world.tsotchke.snapshotStatus(localMirrorMap),
            telemetry: tel,
          });
        }

        // --- POST /api/v1/world/step ---
        if (apiPath === '/api/world/step' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['steps', 'dtSec', 'includeNpu', 'includeIgpu']);
          if (!parsed.ok) return parsed.response;

          const details: ApiErrorDetail[] = [];
          let steps = 1;
          if (parsed.data.steps !== undefined) {
            const n = parseStrictFiniteNumber(parsed.data.steps);
            if (n === null || n < 1 || n > 25 || !Number.isInteger(n)) {
              details.push({ field: 'steps', code: 'OUT_OF_RANGE', message: 'steps must be an integer in [1, 25]' });
            } else {
              steps = n;
            }
          }
          let dtSec = 0.05;
          if (parsed.data.dtSec !== undefined) {
            const d = parseStrictFiniteNumber(parsed.data.dtSec);
            if (d === null || d < 0.002 || d > 0.25) {
              details.push({ field: 'dtSec', code: 'OUT_OF_RANGE', message: 'dtSec must be a number in [0.002, 0.25]' });
            } else {
              dtSec = d;
            }
          }
          if (parsed.data.includeNpu !== undefined && typeof parsed.data.includeNpu !== 'boolean') {
            details.push({ field: 'includeNpu', code: 'INVALID_TYPE', message: 'includeNpu must be a boolean' });
          }
          if (parsed.data.includeIgpu !== undefined && typeof parsed.data.includeIgpu !== 'boolean') {
            details.push({ field: 'includeIgpu', code: 'INVALID_TYPE', message: 'includeIgpu must be a boolean' });
          }
          if (details.length > 0) {
            return sendError(400, 'VALIDATION_FAILED', 'Invalid simulation step parameters', details);
          }

          const { latestTel, gpuReceipt, rustAudit, npuReceipt, igpuReceipt } = await executeQuadSiliconSteps(
            steps,
            dtSec,
            parsed.data.includeNpu === true || parsed.data.includeIgpu === true,
          );

          const broadcastPayload = JSON.stringify({
            type: 'tick',
            telemetry: latestTel,
            gpuReceipt,
            rustAudit,
            npuReceipt,
            igpuReceipt,
          });
          for (const ws of wsClients) {
            ws.send(broadcastPayload);
          }

          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            telemetry: latestTel,
            gpuReceipt,
            rustAudit,
            npuReceipt,
            igpuReceipt,
          });
        }

        // --- POST /api/v1/world/dials ---
        if (apiPath === '/api/world/dials' && req.method === 'POST') {
          const parsed = await parseMutatingBody([
            'freeEnergyInfluxKjPerSec',
            'entropyTemperature',
            'mutationSigma',
            'kerrSpinA',
            'quantumDecoherenceGamma',
            'oxygenSaturation',
            'gravityG',
            'metabolicRateScale',
          ]);
          if (!parsed.ok) return parsed.response;
          const details: ApiErrorDetail[] = [];
          for (const [k, v] of Object.entries(parsed.data)) {
            if (parseStrictFiniteNumber(v) === null) {
              details.push({ field: k, code: 'INVALID_NUMBER', message: `${k} must be a finite number` });
            }
          }
          if (details.length > 0) {
            return sendError(400, 'VALIDATION_FAILED', 'Invalid God-dial numeric values', details);
          }
          const dials = world.updateGodDials(parsed.data as Partial<GodDialParams>);
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ok: true, dials });
        }

        // --- POST /api/v1/world/pause ---
        if (apiPath === '/api/world/pause' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['runState']);
          if (!parsed.ok) return parsed.response;
          const rawState = parsed.data.runState;
          if (rawState !== 'RUNNING' && rawState !== 'SUSPENDED' && rawState !== 'FROZEN') {
            return sendError(400, 'VALIDATION_FAILED', 'runState must be RUNNING, SUSPENDED, or FROZEN', [
              { field: 'runState', code: 'INVALID_ENUM', message: 'Expected RUNNING, SUSPENDED, or FROZEN' },
            ]);
          }
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            runState: world.setRunState(rawState as SimulationRunState),
          });
        }

        // --- POST /api/v1/world/checkpoint ---
        if (apiPath === '/api/world/checkpoint' && req.method === 'POST') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const parsed = await parseMutatingBody(['note']);
          if (!parsed.ok) return parsed.response;
          world.captureWorldSnapshot();
          const saved = db.persistCheckpoint(world.store);
          db.appendAuditEvent({
            actorId: 'local-operator',
            actionName: 'WORLD_CHECKPOINT_SAVED',
            targetResource: saved.epochPublicUid,
            afterJson: saved,
            requestId,
          });
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            checkpoint: saved,
            snapshots: world.store.listSnapshots(),
          });
        }

        // --- POST /api/v1/world/rollback ---
        if (apiPath === '/api/world/rollback' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['tick']);
          if (!parsed.ok) return parsed.response;
          let targetTick: number | undefined;
          if (parsed.data.tick !== undefined) {
            const n = parseStrictFiniteNumber(parsed.data.tick);
            if (n === null || n < 0 || !Number.isInteger(n)) {
              return sendError(400, 'VALIDATION_FAILED', 'tick must be a non-negative integer', [
                { field: 'tick', code: 'INVALID_INTEGER', message: 'Expected integer >= 0' },
              ]);
            }
            targetTick = n;
          }
          const rolled = world.rollbackToSnapshot(targetTick);
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: rolled,
            epoch: world.store.epoch,
            snapshots: world.store.listSnapshots(),
          });
        }

        // --- POST /api/v1/brain/tms-poke ---
        if (apiPath === '/api/brain/tms-poke' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['regionIndex', 'arousalMode']);
          if (!parsed.ok) return parsed.response;
          const regNum = parsed.data.regionIndex !== undefined ? parseStrictFiniteNumber(parsed.data.regionIndex) : 2;
          if (regNum === null || regNum < 0 || regNum > 13 || !Number.isInteger(regNum)) {
            return sendError(400, 'VALIDATION_FAILED', 'regionIndex must be an integer in [0, 13]', [
              { field: 'regionIndex', code: 'OUT_OF_RANGE', message: 'Expected cortical region index 0..13' },
            ]);
          }
          const modeRaw = parsed.data.arousalMode ?? 'WAKE';
          if (modeRaw !== 'WAKE' && modeRaw !== 'NREM_SLOW_WAVE' && modeRaw !== 'PROPOFOL_ANESTHESIA') {
            return sendError(400, 'VALIDATION_FAILED', 'Invalid arousalMode', [
              { field: 'arousalMode', code: 'INVALID_ENUM', message: 'Expected WAKE, NREM_SLOW_WAVE, or PROPOFOL_ANESTHESIA' },
            ]);
          }
          const report = world.asmodenius.runTmsPokeTest(regNum, modeRaw as TmsArousalMode);
          world.store.pciProxy[0] = report.pciIndicator.value;
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ok: true, report });
        }

        // --- POST /api/v1/brain/benchmarks ---
        if (apiPath === '/api/brain/benchmarks' && req.method === 'POST') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const parsed = await parseMutatingBody(['trials', 'suite']);
          if (!parsed.ok) return parsed.response;

          const suite = parsed.data.suite ?? 'r21';
          if (suite !== 'r21' && suite !== 'full12' && suite !== 'xylos' && suite !== 'thaler' && suite !== 'ai-eval') {
            return sendError(400, 'VALIDATION_FAILED', 'suite must be r21, full12, xylos, thaler, or ai-eval', [
              { field: 'suite', code: 'INVALID_ENUM', message: 'Unknown benchmark suite' },
            ]);
          }
          const trialsNum = parsed.data.trials !== undefined ? parseStrictFiniteNumber(parsed.data.trials) : 16;
          if (trialsNum === null || trialsNum < 8 || trialsNum > 48) {
            return sendError(400, 'VALIDATION_FAILED', 'trials must be between 8 and 48', [
              { field: 'trials', code: 'OUT_OF_RANGE', message: 'Expected 8..48 trials per arm' },
            ]);
          }
          const trials = Math.trunc(trialsNum);

          if (suite === 'xylos') {
            return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
              ok: true,
              suite,
              xylosAssay: runXylosRealityMonitoringAssay(world.prng.masterSeed),
            });
          }
          if (suite === 'thaler') {
            return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
              ok: true,
              suite,
              thalerAblations: runThalerCreativityAblationSuite(world.prng.masterSeed),
            });
          }
          if (suite === 'ai-eval') {
            return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
              ok: true,
              suite,
              aiEval: await runAiSafetyAndQualityEvalSuite(),
            });
          }

          const results =
            suite === 'full12'
              ? runComprehensive12CausalSuite(world.prng.masterSeed, trials)
              : runAsmodeniusR21BenchmarkSuite(world.prng.masterSeed, trials);

          for (const r of results) {
            const rec = {
              benchmarkName: r.benchmarkName,
              intactMean: r.intactMean,
              lesionMean: r.lesionMean,
              cohensD: r.cohensD,
              welchsT: r.welchsT,
              passedGradeA: r.passedGradeA,
              recordedAtTick: world.store.epoch.simTick,
            };
            world.store.recordExperiment(rec);
            db.insertExperiment(world.store.epoch.epochId, rec);
          }
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ok: true, suite, results });
        }

        // --- POST /api/v1/glitchling/configure ---
        if (apiPath === '/api/glitchling/configure' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['flawMask', 'compensationEnabled']);
          if (!parsed.ok) return parsed.response;
          if (parsed.data.flawMask !== undefined) {
            const fm = parseStrictFiniteNumber(parsed.data.flawMask);
            if (fm === null || fm < 0 || fm > 15 || !Number.isInteger(fm)) {
              return sendError(400, 'VALIDATION_FAILED', 'flawMask must be an integer bitmask in [0, 15]', [
                { field: 'flawMask', code: 'OUT_OF_RANGE', message: 'Expected integer 0..15' },
              ]);
            }
            world.glitchling.flawMask = fm & 0x0f;
          }
          if (parsed.data.compensationEnabled !== undefined) {
            if (typeof parsed.data.compensationEnabled !== 'boolean') {
              return sendError(400, 'VALIDATION_FAILED', 'compensationEnabled must be boolean', [
                { field: 'compensationEnabled', code: 'INVALID_TYPE', message: 'Expected boolean' },
              ]);
            }
            world.glitchling.compensationEnabled = parsed.data.compensationEnabled;
          }
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            glitchling: world.glitchling.getTelemetry(),
          });
        }

        // --- POST /api/v1/tsotchke/toggle ---
        if (apiPath === '/api/tsotchke/toggle' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['pillarId', 'active']);
          if (!parsed.ok) return parsed.response;
          if (typeof parsed.data.pillarId !== 'string' || parsed.data.pillarId.trim().length === 0) {
            return sendError(400, 'VALIDATION_FAILED', 'pillarId must be a non-empty string', [
              { field: 'pillarId', code: 'REQUIRED', message: 'pillarId is required' },
            ]);
          }
          if (typeof parsed.data.active !== 'boolean') {
            return sendError(400, 'VALIDATION_FAILED', 'active must be a boolean', [
              { field: 'active', code: 'INVALID_TYPE', message: 'Expected boolean' },
            ]);
          }
          const pillarId = parsed.data.pillarId.trim();
          const currentlyEnabled = world.tsotchke.setPillarEnabled(pillarId, parsed.data.active);
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            pillarId,
            currentlyEnabled,
            fencedQuarantineBlocked: pillarId === 'OBLITERATUS' || (!currentlyEnabled && parsed.data.active),
          });
        }

        // --- GET /api/v1/erp/query ---
        if (apiPath === '/api/erp/query' && req.method === 'GET') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const rawLim = url.searchParams.get('limit');
          let limit = 64;
          if (rawLim !== null) {
            const n = parseStrictFiniteNumber(rawLim);
            if (n === null || n < 1 || n > 256 || !Number.isInteger(n)) {
              return sendError(400, 'VALIDATION_FAILED', 'limit must be an integer between 1 and 256', [
                { field: 'limit', code: 'INVALID_NUMBER', message: 'Expected integer 1..256' },
              ]);
            }
            limit = n;
          }
          const caste = url.searchParams.get('caste') as CasteRole | null;
          if (caste && !['EXPLORER', 'HARVESTER', 'GUARDIAN', 'ARCHITECT', 'ORACLE'].includes(caste)) {
            return sendError(400, 'VALIDATION_FAILED', 'Invalid caste filter', [
              { field: 'caste', code: 'INVALID_ENUM', message: 'Unknown casteRole' },
            ]);
          }
          return sendJson({
            ok: true,
            joinedOrganisms: world.store.queryJoinedOrganisms({ limit, casteRole: caste ?? undefined }),
            speciesTrophicAnalytics: db.querySpeciesTrophicAnalytics(),
            socialBonds: Array.from(world.store.socialBonds.values()).slice(0, 64),
          });
        }

        // --- GET /api/v1/erp/organisms (Cursor-paginated, filterable, sortable SQLite view `T-187`, `T-188`) ---
        if (apiPath === '/api/erp/organisms' && req.method === 'GET') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const rawLim = url.searchParams.get('limit');
          let limit = 32;
          if (rawLim !== null) {
            const n = parseStrictFiniteNumber(rawLim);
            if (n === null || n < 1 || !Number.isInteger(n)) {
              return sendError(400, 'VALIDATION_FAILED', 'limit must be a positive integer', [
                { field: 'limit', code: 'INVALID_NUMBER', message: 'Expected positive integer' },
              ]);
            }
            if (n > MAX_DB_PAGE_SIZE) {
              return sendError(400, 'PAGE_SIZE_EXCEEDED', `limit cannot exceed ${MAX_DB_PAGE_SIZE}`, [
                { field: 'limit', code: 'MAX_PAGE_SIZE', message: `Max page size is ${MAX_DB_PAGE_SIZE}` },
              ]);
            }
            limit = n;
          }
          const cursor = url.searchParams.get('cursor') ?? undefined;
          if (cursor && !/^org_[0-9a-f]{24}$/.test(cursor)) {
            return sendError(400, 'INVALID_CURSOR', 'Malformed cursor token', [
              { field: 'cursor', code: 'INVALID_FORMAT', message: 'Expected org_<24-hex>' },
            ]);
          }
          const caste = url.searchParams.get('caste') as CasteRole | null;
          if (caste && !['EXPLORER', 'HARVESTER', 'GUARDIAN', 'ARCHITECT', 'ORACLE'].includes(caste)) {
            return sendError(400, 'VALIDATION_FAILED', 'Invalid caste filter');
          }
          const sortBy = (url.searchParams.get('sortBy') ?? undefined) as
            | 'publicUid'
            | 'ageSec'
            | 'atpBufferKj'
            | 'pciProxy'
            | 'latinBinomial'
            | undefined;
          if (sortBy && !['publicUid', 'ageSec', 'atpBufferKj', 'pciProxy', 'latinBinomial'].includes(sortBy)) {
            return sendError(400, 'VALIDATION_FAILED', 'Unsupported sortBy column');
          }
          const sortDir = (url.searchParams.get('sortDir') ?? 'ASC').toUpperCase();
          if (sortDir !== 'ASC' && sortDir !== 'DESC') {
            return sendError(400, 'VALIDATION_FAILED', 'sortDir must be ASC or DESC');
          }
          const search = url.searchParams.get('search') ?? undefined;

          const page = db.queryPaginatedOrganisms({
            cursorPublicUid: cursor,
            limit,
            casteRole: caste ?? undefined,
            search,
            sortBy,
            sortDir: sortDir as 'ASC' | 'DESC',
          });
          return sendJson({ ok: true, ...page });
        }

        // --- DELETE /api/v1/erp/organisms/:publicUid ---
        if (apiPath.startsWith('/api/erp/organisms/') && req.method === 'DELETE') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const uid = apiPath.slice('/api/erp/organisms/'.length);
          if (!/^org_[0-9a-f]{24}$/.test(uid)) {
            return sendError(400, 'INVALID_IDENTIFIER', 'Invalid organism publicUid format');
          }
          const deleted = db.softDeleteOrganismByPublicUid(uid);
          if (!deleted) {
            return sendError(404, 'ORGANISM_NOT_FOUND', 'Organism not found');
          }
          return sendJson({ ok: true, deletedPublicUid: uid });
        }

        // --- GET / POST /api/v1/erp/biomes & GET / PATCH / DELETE /api/v1/erp/biomes/:publicUid (`T-189..T-192`) ---
        if (apiPath === '/api/erp/biomes' && req.method === 'GET') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const rows = db.db
            .query(
              `SELECT public_uid AS publicUid, name, kind, center_x AS centerX, center_z AS centerZ,
                      radius, nutrient_pool_kj AS nutrientPoolKj, o2_saturation AS o2Saturation,
                      temperature_k AS temperatureK, version_rev AS versionRev,
                      created_at_iso AS createdAtIso, updated_at_iso AS updatedAtIso
               FROM biome_zones ORDER BY biome_id ASC LIMIT 128`,
            )
            .all();
          return sendJson({ ok: true, items: rows });
        }

        if (apiPath === '/api/erp/biomes' && req.method === 'POST') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const parsed = await parseMutatingBody([
            'name',
            'kind',
            'centerX',
            'centerZ',
            'radius',
            'nutrientPoolKj',
            'o2Saturation',
            'temperatureK',
          ]);
          if (!parsed.ok) return parsed.response;

          const details: ApiErrorDetail[] = [];
          const name = typeof parsed.data.name === 'string' ? parsed.data.name.trim() : '';
          if (name.length < 1 || name.length > 120) {
            details.push({ field: 'name', code: 'INVALID_LENGTH', message: 'name must be 1..120 characters' });
          }
          const kind = parsed.data.kind as BiomeKind;
          if (!['HYDROTHERMAL_ABYSS', 'PELAGIC_PHOTON_SHELF', 'CRYSTAL_REEF', 'SINGULARITY_RIM'].includes(kind)) {
            details.push({ field: 'kind', code: 'INVALID_ENUM', message: 'Invalid BiomeKind' });
          }
          const cx = parseStrictFiniteNumber(parsed.data.centerX ?? 0);
          const cz = parseStrictFiniteNumber(parsed.data.centerZ ?? 0);
          const rad = parseStrictFiniteNumber(parsed.data.radius ?? 20);
          if (cx === null) details.push({ field: 'centerX', code: 'INVALID_NUMBER', message: 'centerX must be finite' });
          if (cz === null) details.push({ field: 'centerZ', code: 'INVALID_NUMBER', message: 'centerZ must be finite' });
          if (rad === null || rad <= 0) {
            details.push({ field: 'radius', code: 'OUT_OF_RANGE', message: 'radius must be > 0' });
          }
          if (details.length > 0) {
            return sendError(400, 'VALIDATION_FAILED', 'Invalid biome creation payload', details);
          }

          try {
            const created = db.createBiomeZone({
              epochId: world.store.epoch.epochId,
              name,
              kind,
              centerX: cx!,
              centerZ: cz!,
              radius: rad!,
              ...(parsed.data.nutrientPoolKj !== undefined
                ? { nutrientPoolKj: Number(parsed.data.nutrientPoolKj) }
                : {}),
              ...(parsed.data.o2Saturation !== undefined ? { o2Saturation: Number(parsed.data.o2Saturation) } : {}),
              ...(parsed.data.temperatureK !== undefined ? { temperatureK: Number(parsed.data.temperatureK) } : {}),
            });
            return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ok: true, biome: created }, 201);
          } catch {
            return sendError(409, 'DUPLICATE_BIOME_NAME', `A biome named '${name}' already exists`);
          }
        }

        if (apiPath.startsWith('/api/erp/biomes/')) {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const uid = apiPath.slice('/api/erp/biomes/'.length);
          if (!/^bio_[0-9a-f]{24}$/.test(uid)) {
            return sendError(400, 'INVALID_IDENTIFIER', 'Malformed biome publicUid');
          }

          if (req.method === 'GET') {
            const rec = db.getBiomeByPublicUid(uid);
            if (!rec) return sendError(404, 'BIOME_NOT_FOUND', 'Biome not found');
            return sendJson({ ok: true, biome: rec });
          }

          if (req.method === 'PATCH') {
            const parsed = await parseMutatingBody([
              'expectedVersionRev',
              'name',
              'nutrientPoolKj',
              'o2Saturation',
              'temperatureK',
            ]);
            if (!parsed.ok) return parsed.response;
            const expRev = parseStrictFiniteNumber(parsed.data.expectedVersionRev);
            if (expRev === null || expRev < 1 || !Number.isInteger(expRev)) {
              return sendError(400, 'VALIDATION_FAILED', 'expectedVersionRev positive integer is required', [
                { field: 'expectedVersionRev', code: 'REQUIRED', message: 'Provide current versionRev for optimistic lock' },
              ]);
            }
            const patch: { name?: string; nutrientPoolKj?: number; o2Saturation?: number; temperatureK?: number } = {};
            if (parsed.data.name !== undefined) {
              if (typeof parsed.data.name !== 'string' || parsed.data.name.trim().length === 0) {
                return sendError(400, 'VALIDATION_FAILED', 'name must be a non-empty string');
              }
              patch.name = parsed.data.name;
            }
            if (parsed.data.nutrientPoolKj !== undefined) {
              const v = parseStrictFiniteNumber(parsed.data.nutrientPoolKj);
              if (v === null || v < 0) return sendError(400, 'VALIDATION_FAILED', 'nutrientPoolKj must be >= 0');
              patch.nutrientPoolKj = v;
            }
            if (parsed.data.o2Saturation !== undefined) {
              const v = parseStrictFiniteNumber(parsed.data.o2Saturation);
              if (v === null || v < 0 || v > 2.5) return sendError(400, 'VALIDATION_FAILED', 'o2Saturation must be in [0, 2.5]');
              patch.o2Saturation = v;
            }
            if (parsed.data.temperatureK !== undefined) {
              const v = parseStrictFiniteNumber(parsed.data.temperatureK);
              if (v === null || v <= 0) return sendError(400, 'VALIDATION_FAILED', 'temperatureK must be > 0');
              patch.temperatureK = v;
            }

            const upd = db.updateBiomeOptimistic(uid, expRev, patch);
            if (upd.status === 'NOT_FOUND') return sendError(404, 'BIOME_NOT_FOUND', 'Biome not found');
            if (upd.status === 'CONFLICT') {
              return sendError(409, 'VERSION_CONFLICT', 'Stale expectedVersionRev; reload resource and retry');
            }
            return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ok: true, biome: upd.record });
          }

          if (req.method === 'DELETE') {
            const del = db.deleteBiomeByPublicUid(uid);
            if (del === 'NOT_FOUND') return sendError(404, 'BIOME_NOT_FOUND', 'Biome not found');
            if (del === 'REFERENCED_CONFLICT') {
              return sendError(409, 'FOREIGN_KEY_RESTRICTED', 'Cannot delete biome while organisms reference it');
            }
            return sendJson({ ok: true, deletedPublicUid: uid });
          }
        }

        // --- POST /api/v1/ai/ollama | /api/v1/ai/narrate | /api/copilot | /api/chat (Local Scholarly Narrator) ---
        if (
          (apiPath === '/api/ai/ollama' ||
            apiPath === '/api/ai/narrate' ||
            apiPath === '/api/copilot' ||
            apiPath === '/api/chat') &&
          req.method === 'POST'
        ) {
          const parsed = await parseMutatingBody(['topic', 'prompt', 'message', 'creatureName']);
          if (!parsed.ok) return parsed.response;
          const rawTopic = parsed.data.topic ?? parsed.data.prompt ?? parsed.data.message;
          if (typeof rawTopic !== 'string') {
            return sendError(400, 'VALIDATION_FAILED', 'topic string is required', [
              { field: 'topic', code: 'REQUIRED', message: 'Provide scholarly topic prompt string' },
            ]);
          }
          const aiRes = await runScholarlyAiNarration(
            {
              topic: rawTopic,
              creatureName: typeof parsed.data.creatureName === 'string' ? parsed.data.creatureName : 'Asmodenius_Prime',
              kerrSpinA: world.dials.kerrSpinA,
              pciIndicator: world.store.pciProxy[0] ?? 0.44,
              violatedHexagonLines: 63,
            },
            { allowLocalOllama: process.env.CQM2_ENABLE_LOCAL_OLLAMA === '1' },
          );
          const status = aiRes.refused ? (aiRes.refusalCode === 'CONTEXT_LENGTH_EXCEEDED' ? 400 : 422) : 200;
          if (!aiRes.ok) {
            return sendError(status, aiRes.refusalCode ?? 'AI_REQUEST_REFUSED', aiRes.sanitizedSummary);
          }
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ...aiRes, narration: aiRes, reply: aiRes.sanitizedSummary });
        }

        // --- GET /api/v1/ai/texture (Procedural Gray-Scott + Guanine PBR PNG Synthesizer) ---
        if (apiPath === '/api/ai/texture' && req.method === 'GET') {
          const sizeRaw = url.searchParams.get('size');
          const size = sizeRaw ? Math.max(32, Math.min(512, parseStrictFiniteNumber(sizeRaw) ?? 128)) : 128;
          const png = buildProceduralChromatophorePng(Math.trunc(size), Math.trunc(size), world.skinVGs, world.store.epoch.simTick + 20261110);
          return new Response(png as BodyInit, {
            status: 200,
            headers: makeHeaders({
              'Content-Type': 'image/png',
              'Cache-Control': 'no-store',
            }),
          });
        }

        // --- POST /api/v1/ai/mesh3d (Tripo / Meshy / Local Bishop `.glb` Studio Bridge + SSRF Guard) ---
        if (apiPath === '/api/ai/mesh3d' && req.method === 'POST') {
          const parsed = await parseMutatingBody(['creatureName', 'prompt', 'referenceImageUrl']);
          if (!parsed.ok) return parsed.response;
          if (parsed.data.referenceImageUrl !== undefined) {
            if (typeof parsed.data.referenceImageUrl !== 'string') {
              return sendError(400, 'VALIDATION_FAILED', 'referenceImageUrl must be an https:// URL string');
            }
            const ssrf = validateExternalHttpsUrlAgainstSsrf(parsed.data.referenceImageUrl);
            if (!ssrf.allowed) {
              return sendError(400, 'SSRF_URL_BLOCKED', ssrf.reason ?? 'Disallowed URL target');
            }
          }
          const creatureName =
            (typeof parsed.data.creatureName === 'string' ? parsed.data.creatureName : 'Asmodenius_Prime')
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .slice(0, 48) || 'Asmodenius_Prime';
          const glb = exportCreatureGlbBinary(creatureName, world.spinePtsXyz, world.skinVGs);
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, {
            ok: true,
            creatureName,
            glbByteLength: glb.byteLength,
            downloadUrl: `/api/v1/export/glb?creature=${encodeURIComponent(creatureName)}`,
            tripoPrompt: `Articulated 8-somite pelagic-abyssal organism ${creatureName}, crystalline guanine PBR 4K`,
            meshyPrompt: `Reactive Gray-Scott Turing chromatophore skin for ${creatureName}, 4096x4096 PBR`,
          });
        }

        // --- POST /api/v1/jobs/retention (Authenticated Scheduled Maintenance Job `T-173`, `T-112`, `T-210`) ---
        if (apiPath === '/api/jobs/retention' && req.method === 'POST') {
          const dbErr = ensureDatabaseHealthy();
          if (dbErr) return dbErr;
          const providedSecret = req.headers.get('x-cqm2-job-secret') ?? '';
          if (!providedSecret || !verifySecretConstantTime(providedSecret, jobSecret)) {
            return sendError(401, 'UNAUTHORIZED_JOB_CALLER', 'Missing or invalid X-Cqm2-Job-Secret header');
          }
          const parsed = await parseMutatingBody(['maxReceipts', 'maxExperiments', 'purgeSoftDeletedOrganisms']);
          if (!parsed.ok) return parsed.response;
          const purged = db.purgeExpiredTelemetry({
            maxReceipts: typeof parsed.data.maxReceipts === 'number' ? parsed.data.maxReceipts : 2000,
            maxExperiments: typeof parsed.data.maxExperiments === 'number' ? parsed.data.maxExperiments : 500,
            purgeSoftDeletedOrganisms: parsed.data.purgeSoftDeletedOrganisms === true,
          });
          return sendIdempotentJson(parsed.idempKey, parsed.rawText, { ok: true, purged });
        }

        // --- GET /api/v1/export/* (`glb`, `gltf`, `obj`, `blender`, `unity`, `touchdesigner`, `png`, `wav`, `ai-world`) ---
        if (apiPath.startsWith('/api/export/') && req.method === 'GET') {
          const format = apiPath.slice('/api/export/'.length);
          const creatureName =
            (url.searchParams.get('creature') ?? 'Asmodenius_Prime').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) ||
            'Asmodenius_Prime';

          if (format === 'glb') {
            const glb = exportCreatureGlbBinary(creatureName, world.spinePtsXyz, world.skinVGs);
            return new Response(glb as BodyInit, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'model/gltf-binary',
                'Content-Disposition': `attachment; filename="${creatureName}.glb"`,
              }),
            });
          }
          if (format === 'gltf') {
            const body = exportCreatureGltf2Json(creatureName, world.spinePtsXyz, world.skinVGs);
            return new Response(body, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'model/gltf+json; charset=utf-8',
                'Content-Disposition': `attachment; filename="${creatureName}.gltf"`,
              }),
            });
          }
          if (format === 'obj') {
            const body = exportCreatureWavefrontObj(creatureName, world.spinePtsXyz);
            return new Response(body, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${creatureName}.obj"`,
              }),
            });
          }
          if (format === 'blender') {
            const body = exportBlender4PythonRig(creatureName, 8);
            return new Response(body, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'text/x-python; charset=utf-8',
                'Content-Disposition': `attachment; filename="blender_${creatureName}_rig.py"`,
              }),
            });
          }
          if (format === 'unity') {
            const body = exportUnity6BridgeScript(creatureName, 9000);
            return new Response(body, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="Cqm2OscTelemetryBridge.cs"`,
              }),
            });
          }
          if (format === 'touchdesigner') {
            const body = exportTouchDesignerBridgeScript(creatureName, 9000);
            return new Response(body, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'text/x-python; charset=utf-8',
                'Content-Disposition': `attachment; filename="cqm2_td_bridge.py"`,
              }),
            });
          }
          if (format === 'png') {
            const png = buildProceduralChromatophorePng(128, 128, world.skinVGs);
            return new Response(png as BodyInit, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${creatureName}_chromatophore.png"`,
              }),
            });
          }
          if (format === 'wav') {
            const wav = exportCosmicKerrRingdownWav(20261110, 2.5, 44100);
            return new Response(wav as BodyInit, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'audio/wav',
                'Content-Disposition': `attachment; filename="cqm2_kerr_cosmic_stem.wav"`,
              }),
            });
          }
          if (format === 'ai-world' || format === 'osc-json') {
            const body = exportAiWorldInteropBundle({
              seedHex: world.store.epoch.seedHex,
              creatureName,
              kerrSpinA: world.dials.kerrSpinA,
              pciValue: world.store.pciProxy[0] ?? 0.42,
              violatedHexagonLines: 63,
            });
            return new Response(body, {
              status: 200,
              headers: makeHeaders({
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="cqm2_ai_world_interop.json"`,
              }),
            });
          }
          return sendError(404, 'EXPORT_FORMAT_NOT_FOUND', `Unknown export format '${format}'`);
        }

        return sendError(404, 'ROUTE_NOT_FOUND', `API route '${decodedPath}' does not exist`);
      }

      // ======================================================================
      // Static Asset Serving (`site/` bundle -> `public/` -> `dist/` allowlist)
      // ======================================================================
      const ROUTE_HTML_ALIASES: Readonly<Record<string, string>> = {
        '/': 'index.html',
        '/docs': 'docs.html',
        '/docs/': 'docs.html',
        '/spec': 'specs.html',
        '/specs': 'specs.html',
        '/bible': 'bible.html',
        '/glossary': 'glossary.html',
        '/downloads': 'downloads.html',
        '/lab': 'lab/quantum-wildbeyond.html',
        '/lab/': 'lab/quantum-wildbeyond.html',
        '/lab/consciousness': 'lab/consciousness.html',
        '/lab/sentience': 'lab/sentience.html',
        '/docs/alife/cqm-capability-profile.html': 'alife/cqm-capability-profile.html',
        '/alife/cqm-capability-profile': 'alife/cqm-capability-profile.html',
        '/docs/alife/cqm-alife-catalog.html': 'alife/cqm-alife-catalog.html',
        '/alife/cqm-alife-catalog': 'alife/cqm-alife-catalog.html',
      };
      const relReq = ROUTE_HTML_ALIASES[decodedPath] ?? decodedPath.replace(/^\/+/, '');
      if (relReq.startsWith('.') || relReq === 'package.json' || relReq.startsWith('src/') || relReq.startsWith('data/')) {
        return sendError(403, 'FORBIDDEN_STATIC_RESOURCE', 'Forbidden static resource');
      }

      let candidatePath: string | null = null;
      let candidateMtime = -1;
      for (const baseDir of [SITE_DIR, PUBLIC_DIR]) {
        if (existsSync(baseDir)) {
          const candidate = resolve(baseDir, relReq);
          if (!candidate.startsWith(baseDir + sep) && candidate !== baseDir) {
            return sendError(403, 'FORBIDDEN_PATH', 'Forbidden static path');
          }
          if (existsSync(candidate)) {
            const st = statSync(candidate);
            if (st.isFile() && st.mtimeMs > candidateMtime) {
              candidatePath = candidate;
              candidateMtime = st.mtimeMs;
            }
          }
        }
      }

      if (!candidatePath && relReq.startsWith('dist/')) {
        const rootCandidate = resolve(ROOT_DIR, relReq);
        if (!rootCandidate.startsWith(ROOT_DIR + sep)) {
          return sendError(403, 'FORBIDDEN_PATH', 'Forbidden static path');
        }
        if (existsSync(rootCandidate)) candidatePath = rootCandidate;
      }

      if (candidatePath) {
        const file = Bun.file(candidatePath);
        const stat = await file.stat();
        const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
        if (req.headers.get('if-none-match') === etag) {
          return new Response(null, {
            status: 304,
            headers: makeHeaders({ ETag: etag }),
          });
        }

        const ext = extname(candidatePath).toLowerCase();
        const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
        const isImmutableAsset = /\.[0-9a-f]{8,}\.(?:js|css|wasm)$/i.test(relReq) || ext === '.woff2';
        const cacheHeader = isImmutableAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=60';

        return new Response(file, {
          status: 200,
          headers: makeHeaders({
            'Content-Type': mime,
            'Cache-Control': cacheHeader,
            ETag: etag,
          }),
        });
      }

      return sendError(404, 'NOT_FOUND', 'Requested resource was not found');
    },
  });

  boundPort = server.port ?? requestedPort;

  return {
    port: boundPort,
    url: `http://${hostname}:${boundPort}`,
    world,
    db,
    triEngine,
    setSimulatedDbOutage(offline: boolean) {
      simulatedDbOutage = offline;
    },
    findLogsByRequestId(requestId: string) {
      return recentLogs.filter((e) => e.requestId === requestId);
    },
    stop() {
      if (goProc) {
        try {
          goProc.kill();
        } catch {
          // ignore
        }
      }
      server.stop(true);
      db.close();
      triEngine.shutdown();
    },
  };
}

if (import.meta.main) {
  const enableNpu = process.env.CQM2_DISABLE_NPU !== '1';
  const enableGoOsc = process.env.CQM2_DISABLE_GO_OSC !== '1';
  const srv = await createCqm2Server({ enableNpuDaemon: enableNpu, enableGoOscDaemon: enableGoOsc });
  console.log(`[CQM2] Local Quad-Silicon Workstation v4.0.0 listening at ${srv.url}`);
  console.log(`[CQM2] Silicon Topology:`, JSON.stringify(srv.triEngine.getTopology()));
}
