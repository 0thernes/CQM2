/**
 * CQM2 Local Full-Stack Workstation Server (`Bun.serve` + WebSocket + 3NF SQLite WAL + Tri-Engine Silicon).
 * Security & Reliability Hardening:
 *   - `Cross-Origin-Opener-Policy: same-origin` & `Cross-Origin-Embedder-Policy: require-corp` (`SharedArrayBuffer`)
 *   - Strict `Content-Security-Policy` (`default-src 'self'`), `X-Content-Type-Options: nosniff`
 *   - Sliding-window rate limiting (`429`), body size ceiling (`<= 256 KB`, `413`), strict JSON validation (`400`)
 *   - Canonical path-traversal blocking (`403` on any escape outside `site/` or root static allowlist)
 */
import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { runAsmodeniusR21BenchmarkSuite } from '../brains/asmodenius';
import { type GodDialParams } from '../core/prng';
import type { CasteRole } from '../erp/relational-store';
import { getTriEngine, type TriEngineOrchestrator } from '../native/tri-engine';
import {
  exportAiWorldInteropBundle,
  exportBlender4PythonRig,
  exportCosmicKerrRingdownWav,
  exportCreatureGltf2Json,
  exportCreatureWavefrontObj,
} from '../pipeline/exporters';
import { Cqm2WorldScheduler, type SimulationRunState } from '../sim/world-scheduler';
import { Cqm2SqliteDatabase } from './db';

const ROOT_DIR = resolve(import.meta.dir, '..', '..');
const SITE_DIR = resolve(ROOT_DIR, 'site');
const MAX_JSON_BODY_BYTES = 256 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.gltf': 'model/gltf+json; charset=utf-8',
  '.obj': 'text/plain; charset=utf-8',
  '.py': 'text/x-python; charset=utf-8',
};

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
});

function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function parseJsonBody(req: Request): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: Response }> {
  const contentLen = Number(req.headers.get('content-length') ?? '0');
  if (contentLen > MAX_JSON_BODY_BYTES) {
    return { ok: false, response: jsonResponse({ ok: false, error: 'Payload exceeds 256 KB limit' }, 413) };
  }
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_JSON_BODY_BYTES) {
    return { ok: false, response: jsonResponse({ ok: false, error: 'Payload exceeds 256 KB limit' }, 413) };
  }
  if (buf.byteLength === 0) {
    return { ok: true, data: {} };
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(buf));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, response: jsonResponse({ ok: false, error: 'JSON body must be an object' }, 400) };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonResponse({ ok: false, error: 'Malformed JSON request body' }, 400) };
  }
}

export interface Cqm2ServerHandle {
  readonly port: number;
  readonly url: string;
  readonly world: Cqm2WorldScheduler;
  readonly db: Cqm2SqliteDatabase;
  readonly triEngine: TriEngineOrchestrator;
  stop(): void;
}

export async function createCqm2Server(options: {
  port?: number;
  hostname?: string;
  dbPath?: string;
  enableNpuDaemon?: boolean;
  rateLimitPerMinute?: number;
  seed?: number;
} = {}): Promise<Cqm2ServerHandle> {
  const hostname = options.hostname ?? process.env.CQM2_HOST ?? '127.0.0.1';
  const requestedPort = options.port ?? Number(process.env.CQM2_PORT ?? 4200);
  const dbPath = options.dbPath ?? join(ROOT_DIR, 'data', 'cqm2_local.sqlite');
  const rateLimitMax = options.rateLimitPerMinute ?? 600;

  const triEngine = getTriEngine();
  await triEngine.init({ enableNpuDaemon: options.enableNpuDaemon ?? false });

  const world = new Cqm2WorldScheduler({ seed: options.seed ?? 20261110, initialPopulation: 96 });
  const db = new Cqm2SqliteDatabase(dbPath);
  db.persistCheckpoint(world.store);

  // Reusable GPU/NPU silicon buffers
  const cudaA = new Float32Array(128 * 128).fill(0.035);
  const cudaB = new Float32Array(128 * 128).fill(0.025);
  const cudaC = new Float32Array(128 * 128);
  const npuLatentBatch = new Float32Array(2048).fill(0.12);

  // Sliding-window rate limiter per client key
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const wsClients = new Set<{ send(data: string): void }>();

  const checkRateLimit = (clientKey: string): boolean => {
    const now = Date.now();
    const bucket = rateBuckets.get(clientKey);
    if (!bucket || now >= bucket.resetAt) {
      rateBuckets.set(clientKey, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= rateLimitMax;
  };

  const server = Bun.serve({
    hostname,
    port: requestedPort,
    websocket: {
      open(ws) {
        wsClients.add(ws);
        ws.send(
          JSON.stringify({
            type: 'welcome',
            version: '2.0.0',
            hardware: triEngine.getTopology(),
            epoch: world.store.epoch,
          }),
        );
      },
      message(ws, message) {
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
        if (text.length > 8192) return;
        try {
          const msg = JSON.parse(text) as Record<string, unknown>;
          if (msg.cmd === 'step') {
            const tel = world.stepTick(0.05);
            ws.send(JSON.stringify({ type: 'tick', telemetry: tel }));
          }
        } catch {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid WS JSON command' }));
        }
      },
      close(ws) {
        wsClients.delete(ws);
      },
    },
    async fetch(req, srv) {
      const url = new URL(req.url);
      const clientIp = srv.requestIP(req)?.address ?? '127.0.0.1';

      if (!checkRateLimit(clientIp)) {
        return jsonResponse({ ok: false, error: 'Rate limit exceeded' }, 429, { 'Retry-After': '60' });
      }

      if (url.pathname === '/ws') {
        if (srv.upgrade(req)) return undefined;
        return jsonResponse({ ok: false, error: 'WebSocket upgrade failed' }, 400);
      }

      // Raw + percent-decoded path-traversal guard
      const rawUrlPath = req.url.split('?')[0] ?? '';
      let decodedPath = url.pathname;
      try {
        decodedPath = decodeURIComponent(url.pathname);
      } catch {
        return jsonResponse({ ok: false, error: 'Malformed URL encoding' }, 400);
      }
      if (
        rawUrlPath.includes('..') ||
        rawUrlPath.toLowerCase().includes('%2e') ||
        decodedPath.includes('..') ||
        decodedPath.includes('\\') ||
        decodedPath.includes('\0')
      ) {
        return jsonResponse({ ok: false, error: 'Forbidden path traversal attempt' }, 403);
      }

      // ======================================================================
      // REST API Endpoints
      // ======================================================================
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return jsonResponse({
          ok: true,
          service: 'cqm2-workstation',
          version: '2.0.0',
          simTick: world.store.epoch.simTick,
          runState: world.runState,
          sharedMemoryActive: world.store.sharedMemoryActive,
        });
      }

      if (url.pathname === '/api/hardware' && req.method === 'GET') {
        return jsonResponse({
          ok: true,
          topology: triEngine.getTopology(),
          recentReceipts: world.store.dispatchReceipts.slice(-12),
        });
      }

      if (url.pathname === '/api/world/state' && req.method === 'GET') {
        const tel = world.stepTick(0.005);
        return jsonResponse({
          ok: true,
          epoch: world.store.epoch,
          dials: world.dials,
          biomes: Array.from(world.store.biomes.values()),
          species: Array.from(world.store.species.values()),
          organismsSample: world.store.queryJoinedOrganisms({ limit: 32 }),
          snapshots: world.store.listSnapshots(),
          tsotchkePillars: world.tsotchke.snapshotStatus(),
          telemetry: tel,
        });
      }

      if (url.pathname === '/api/world/step' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const steps = Math.max(1, Math.min(25, Math.trunc(Number(parsed.data.steps ?? 1))));
        const dtSec = Math.max(0.005, Math.min(0.2, Number(parsed.data.dtSec ?? 0.05)));

        let latestTel = world.stepTick(dtSec);
        for (let s = 1; s < steps; s++) {
          latestTel = world.stepTick(dtSec);
        }

        // Dispatch RTX 5070 Ti CUDA Cortex GEMM + Rust Kahan Conservation Ledger + optional NPU World Model!
        cudaA[0] = latestTel.asmodenius.frenetCurvatureKappa;
        const gpuReceipt = triEngine.dispatchGpuCortexGemm(cudaA, cudaB, cudaC, 128, 128, 128);
        const rustAudit = triEngine.auditMetabolicConservation(
          world.store.pools15,
          world.store.totalIntakeKj,
          world.store.activeCount,
        );

        world.store.recordDispatchReceipt({
          simTick: latestTel.simTick,
          deviceKind: gpuReceipt.backend === 'CUDA-cuBLAS' ? 'GPU_CUDA' : 'CPU_ZIG_SIMD',
          kernelName: 'cqm2_cuda_cortex_gemm_tanh_128x128',
          batchSize: 128,
          elapsedMs: gpuReceipt.elapsedMs,
          gflops: gpuReceipt.gflops,
          conservationValid: rustAudit.valid,
        });

        let npuReceipt = null;
        if (parsed.data.includeNpu === true || triEngine.npu.getStatus().daemonActive) {
          npuLatentBatch[0] = latestTel.asmodenius.epistemicValueOfInfo;
          npuReceipt = await triEngine.dispatchNpuWorldModel(npuLatentBatch);
          world.store.recordDispatchReceipt({
            simTick: latestTel.simTick,
            deviceKind: 'NPU_OPENVINO',
            kernelName: 'cqm2_npu_rssm_world_model_32x64',
            batchSize: 32,
            elapsedMs: npuReceipt.ms,
            gflops: 0,
            conservationValid: rustAudit.valid,
          });
        }

        const broadcastPayload = JSON.stringify({
          type: 'tick',
          telemetry: latestTel,
          gpuReceipt,
          rustAudit,
          npuReceipt,
        });
        for (const ws of wsClients) {
          ws.send(broadcastPayload);
        }

        return jsonResponse({
          ok: true,
          telemetry: latestTel,
          gpuReceipt,
          rustAudit,
          npuReceipt,
        });
      }

      if (url.pathname === '/api/world/dials' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const dials = world.updateGodDials(parsed.data as Partial<GodDialParams>);
        return jsonResponse({ ok: true, dials });
      }

      if (url.pathname === '/api/world/pause' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const rawState = String(parsed.data.runState ?? 'RUNNING');
        if (rawState !== 'RUNNING' && rawState !== 'SUSPENDED' && rawState !== 'FROZEN') {
          return jsonResponse({ ok: false, error: 'runState must be RUNNING, SUSPENDED, or FROZEN' }, 400);
        }
        return jsonResponse({ ok: true, runState: world.setRunState(rawState as SimulationRunState) });
      }

      if (url.pathname === '/api/world/checkpoint' && req.method === 'POST') {
        world.store.captureSnapshot();
        const saved = db.persistCheckpoint(world.store);
        return jsonResponse({ ok: true, checkpoint: saved, snapshots: world.store.listSnapshots() });
      }

      if (url.pathname === '/api/world/rollback' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const targetTick = parsed.data.tick !== undefined ? Number(parsed.data.tick) : undefined;
        const rolled = world.store.rollbackToSnapshot(targetTick);
        return jsonResponse({ ok: rolled, epoch: world.store.epoch, snapshots: world.store.listSnapshots() });
      }

      if (url.pathname === '/api/brain/tms-poke' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const regIdx = Number(parsed.data.regionIndex ?? 2);
        const report = world.asmodenius.runTmsPokeTest(regIdx);
        world.store.pciProxy[0] = report.pciIndicator.value;
        return jsonResponse({ ok: true, report });
      }

      if (url.pathname === '/api/brain/benchmarks' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const trials = Math.max(8, Math.min(48, Number(parsed.data.trials ?? 24)));
        const results = runAsmodeniusR21BenchmarkSuite(world.prng.masterSeed, trials);
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
        return jsonResponse({ ok: true, results });
      }

      if (url.pathname === '/api/glitchling/configure' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        if (typeof parsed.data.flawMask === 'number' && Number.isFinite(parsed.data.flawMask)) {
          world.glitchling.flawMask = Math.trunc(parsed.data.flawMask) & 0x0f;
        }
        if (typeof parsed.data.compensationEnabled === 'boolean') {
          world.glitchling.compensationEnabled = parsed.data.compensationEnabled;
        }
        return jsonResponse({ ok: true, glitchling: world.glitchling.getTelemetry() });
      }

      if (url.pathname === '/api/tsotchke/toggle' && req.method === 'POST') {
        const parsed = await parseJsonBody(req);
        if (!parsed.ok) return parsed.response;
        const pillarId = String(parsed.data.pillarId ?? '');
        const active = Boolean(parsed.data.active);
        const result = world.tsotchke.setPillarEnabled(pillarId, active);
        return jsonResponse({
          ok: true,
          pillarId,
          currentlyEnabled: result,
          fencedQuarantineBlocked: pillarId === 'OBLITERATUS',
        });
      }

      if (url.pathname === '/api/erp/query' && req.method === 'GET') {
        const limit = Math.max(1, Math.min(256, Number(url.searchParams.get('limit') ?? 64)));
        const caste = url.searchParams.get('caste') as CasteRole | null;
        return jsonResponse({
          ok: true,
          joinedOrganisms: world.store.queryJoinedOrganisms({
            limit,
            casteRole: caste ?? undefined,
          }),
          speciesTrophicAnalytics: db.querySpeciesTrophicAnalytics(),
          socialBonds: Array.from(world.store.socialBonds.values()).slice(0, 64),
        });
      }

      if (url.pathname.startsWith('/api/export/') && req.method === 'GET') {
        const format = url.pathname.slice('/api/export/'.length);
        const creatureName = (url.searchParams.get('creature') ?? 'Asmodenius_Prime').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);

        if (format === 'gltf') {
          const body = exportCreatureGltf2Json(creatureName, world.spinePtsXyz);
          return new Response(body, {
            status: 200,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'model/gltf+json; charset=utf-8',
              'Content-Disposition': `attachment; filename="${creatureName}.gltf"`,
            },
          });
        }
        if (format === 'obj') {
          const body = exportCreatureWavefrontObj(creatureName, world.spinePtsXyz);
          return new Response(body, {
            status: 200,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': `attachment; filename="${creatureName}.obj"`,
            },
          });
        }
        if (format === 'blender') {
          const body = exportBlender4PythonRig(creatureName, 8);
          return new Response(body, {
            status: 200,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'text/x-python; charset=utf-8',
              'Content-Disposition': `attachment; filename="blender_${creatureName}_rig.py"`,
            },
          });
        }
        if (format === 'wav') {
          const wav = exportCosmicKerrRingdownWav(20261110, 2.5, 44100);
          return new Response(wav as BodyInit, {
            status: 200,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'audio/wav',
              'Content-Disposition': `attachment; filename="cqm2_kerr_cosmic_stem.wav"`,
            },
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
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Disposition': `attachment; filename="cqm2_ai_world_interop.json"`,
            },
          });
        }
        return jsonResponse({ ok: false, error: `Unknown export format '${format}'` }, 404);
      }

      // ======================================================================
      // Static Asset Serving (`site/` bundle + strict root HTML/dist allowlist)
      // ======================================================================
      const relReq = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
      if (relReq.startsWith('.') || relReq === 'package.json' || relReq.startsWith('src/') || relReq.startsWith('data/')) {
        return jsonResponse({ ok: false, error: 'Forbidden static resource' }, 403);
      }

      const ALLOWED_ROOT_FILES = new Set([
        'index.html',
        'docs.html',
        'specs.html',
        'glossary.html',
        'downloads.html',
        'favicon.svg',
        'robots.txt',
        'sitemap.xml',
      ]);

      let candidatePath: string | null = null;
      if (existsSync(SITE_DIR)) {
        const siteCandidate = resolve(SITE_DIR, relReq);
        if (!siteCandidate.startsWith(SITE_DIR + sep) && siteCandidate !== SITE_DIR) {
          return jsonResponse({ ok: false, error: 'Forbidden path' }, 403);
        }
        if (existsSync(siteCandidate)) candidatePath = siteCandidate;
      }

      if (!candidatePath && (ALLOWED_ROOT_FILES.has(relReq) || relReq.startsWith('dist/'))) {
        const rootCandidate = resolve(ROOT_DIR, relReq);
        if (!rootCandidate.startsWith(ROOT_DIR + sep)) {
          return jsonResponse({ ok: false, error: 'Forbidden path' }, 403);
        }
        if (existsSync(rootCandidate)) candidatePath = rootCandidate;
      }

      if (candidatePath) {
        const ext = extname(candidatePath).toLowerCase();
        const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
        return new Response(Bun.file(candidatePath), {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': mime,
          },
        });
      }

      return jsonResponse({ ok: false, error: 'Not Found' }, 404);
    },
  });

  return {
    port: server.port ?? requestedPort,
    url: `http://${hostname}:${server.port ?? requestedPort}`,
    world,
    db,
    triEngine,
    stop() {
      server.stop(true);
      db.close();
      triEngine.shutdown();
    },
  };
}

if (import.meta.main) {
  const enableNpu = process.env.CQM2_DISABLE_NPU !== '1';
  const srv = await createCqm2Server({ enableNpuDaemon: enableNpu });
  console.log(`[CQM2] Local Workstation Server listening at ${srv.url}`);
  console.log(`[CQM2] Silicon Topology:`, JSON.stringify(srv.triEngine.getTopology()));
}
