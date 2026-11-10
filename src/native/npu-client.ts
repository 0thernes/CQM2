/**
 * CQM2 v2.1.0 Persistent Intel(R) AI Boost NPU & Intel(R) Graphics iGPU Subprocess Client.
 * Dispatches BOTH:
 *   1. Action-Conditioned RSSM World Model (`NPU` — Intel AI Boost)
 *   2. 2D Habitat Gray-Scott / Pheromone Field Diffusion & Sensory Alignment (`GPU.0` — Intel Graphics iGPU)
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface NpuWorkerStatus {
  available: boolean;
  daemonActive: boolean;
  primaryDevice: string;
  primaryDeviceName: string;
  auxDevice: string;
  auxDeviceName: string;
  calibratedNpuMs: number;
  calibratedAuxMs: number;
  totalDispatches: number;
  totalIgpuDispatches: number;
  lastLatencyMs: number;
  lastIgpuLatencyMs: number;
}

export interface NpuRssmResult {
  device: string;
  ms: number;
  meanAbs: number;
  epistemicVar: number;
  branchScores: number[];
  head: number[];
}

export interface IgpuFieldResult {
  device: string;
  ms: number;
  meanV: number;
}

const ROOT = resolve(import.meta.dir, '..', '..');
const WORKER_SCRIPT = join(ROOT, 'python', 'npu_world_worker.py');

function findUvBinary(): string | null {
  const candidates = [
    typeof Bun !== 'undefined' ? Bun.which('uv') : null,
    join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.local', 'bin', process.platform === 'win32' ? 'uv.exe' : 'uv'),
  ].filter((x): x is string => Boolean(x && existsSync(x)));
  return candidates[0] ?? null;
}

export class NpuWorldClient {
  private status: NpuWorkerStatus = {
    available: false,
    daemonActive: false,
    primaryDevice: 'CPU-FALLBACK',
    primaryDeviceName: 'Deterministic TypeScript/Zig Latent Fallback',
    auxDevice: 'CPU-FALLBACK',
    auxDeviceName: 'Deterministic Zig Reaction-Diffusion Fallback',
    calibratedNpuMs: 0,
    calibratedAuxMs: 0,
    totalDispatches: 0,
    totalIgpuDispatches: 0,
    lastLatencyMs: 0,
    lastIgpuLatencyMs: 0,
  };

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private lineReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private textBuf = '';
  private reqCounter = 1;
  private pendingMutex: Promise<void> = Promise.resolve();

  public getStatus(): NpuWorkerStatus {
    return { ...this.status };
  }

  public async init(enableDaemon = true): Promise<NpuWorkerStatus> {
    const npuDisabled =
      process.env.CQM2_DISABLE_NPU === '1' ||
      process.env.CQM2_ENABLE_NPU === '0' ||
      process.env.CQM2_ENABLE_NPU === 'false';
    if (npuDisabled || !existsSync(WORKER_SCRIPT) || typeof Bun === 'undefined') {
      return this.getStatus();
    }
    const uvBin = findUvBinary();
    if (!uvBin) {
      return this.getStatus();
    }

    if (!enableDaemon) {
      const res = Bun.spawnSync(
        [uvBin, 'run', '--with', 'openvino', '--with', 'numpy', 'python', WORKER_SCRIPT, '--probe'],
        { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' },
      );
      if (res.exitCode === 0) {
        const line = res.stdout.toString('utf8').trim().split('\n').at(-1) ?? '';
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          if (parsed.ok) {
            this.status = {
              available: true,
              daemonActive: false,
              primaryDevice: String(parsed.primaryDevice ?? 'CPU'),
              primaryDeviceName: String(parsed.primaryDeviceName ?? 'OpenVINO'),
              auxDevice: String(parsed.auxDevice ?? 'CPU'),
              auxDeviceName: String(parsed.auxDeviceName ?? 'OpenVINO'),
              calibratedNpuMs: Number(parsed.calibratedNpuMs ?? 0),
              calibratedAuxMs: Number(parsed.calibratedAuxMs ?? 0),
              totalDispatches: 0,
              totalIgpuDispatches: 0,
              lastLatencyMs: Number(parsed.calibratedNpuMs ?? 0),
              lastIgpuLatencyMs: Number(parsed.calibratedAuxMs ?? 0),
            };
          }
        } catch {
          // Keep fallback status
        }
      }
      return this.getStatus();
    }

    try {
      const proc = Bun.spawn(
        [uvBin, 'run', '--with', 'openvino', '--with', 'numpy', 'python', WORKER_SCRIPT, '--daemon'],
        { cwd: ROOT, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
      );
      this.proc = proc;
      this.lineReader = proc.stdout.getReader();
      const readyMsg = await this.readNextJsonLine(15000);
      if (readyMsg && readyMsg.ok) {
        this.status = {
          available: true,
          daemonActive: true,
          primaryDevice: String(readyMsg.primaryDevice ?? 'NPU'),
          primaryDeviceName: String(readyMsg.primaryDeviceName ?? 'Intel(R) AI Boost'),
          auxDevice: String(readyMsg.auxDevice ?? 'GPU.0'),
          auxDeviceName: String(readyMsg.auxDeviceName ?? 'Intel(R) Graphics'),
          calibratedNpuMs: Number(readyMsg.calibratedNpuMs ?? 0),
          calibratedAuxMs: Number(readyMsg.calibratedAuxMs ?? 0),
          totalDispatches: 0,
          totalIgpuDispatches: 0,
          lastLatencyMs: Number(readyMsg.calibratedNpuMs ?? 0),
          lastIgpuLatencyMs: Number(readyMsg.calibratedAuxMs ?? 0),
        };
      } else {
        this.shutdown();
      }
    } catch {
      this.shutdown();
    }
    return this.getStatus();
  }

  private async readNextJsonLine(timeoutMs = 3000): Promise<Record<string, unknown> | null> {
    if (!this.lineReader) return null;
    const decoder = new TextDecoder();
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const nlIdx = this.textBuf.indexOf('\n');
      if (nlIdx >= 0) {
        const line = this.textBuf.slice(0, nlIdx).trim();
        this.textBuf = this.textBuf.slice(nlIdx + 1);
        if (line.startsWith('{')) {
          return JSON.parse(line) as Record<string, unknown>;
        }
        continue;
      }
      const remaining = Math.max(50, deadline - Date.now());
      const readPromise = this.lineReader.read();
      const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolveTimeout) =>
        setTimeout(() => resolveTimeout({ done: true, value: undefined }), remaining),
      );
      const chunk = await Promise.race([readPromise, timeoutPromise]);
      if (chunk.done || !chunk.value) break;
      this.textBuf += decoder.decode(chunk.value, { stream: true });
    }
    return null;
  }

  /**
   * Executes `[32, 64]` Action-Conditioned RSSM World-Model rollout on `Intel(R) AI Boost` NPU!
   */
  public async stepRssmWorldModel(latentBatch2048: Float32Array): Promise<NpuRssmResult> {
    if (this.status.daemonActive && this.proc?.stdin) {
      let result: NpuRssmResult | null = null;
      const run = async () => {
        const id = this.reqCounter++;
        const payload = JSON.stringify({ id, cmd: 'rssm', data: Array.from(latentBatch2048.subarray(0, 2048)) }) + '\n';
        const stdinSink = this.proc!.stdin as { write(chunk: string): unknown; flush?(): unknown };
        stdinSink.write(payload);
        if (typeof stdinSink.flush === 'function') stdinSink.flush();
        const resp = await this.readNextJsonLine(2500);
        if (resp && resp.ok) {
          const ms = Number(resp.ms ?? this.status.calibratedNpuMs);
          this.status.totalDispatches += 1;
          this.status.lastLatencyMs = ms;
          result = {
            device: String(resp.device ?? this.status.primaryDevice),
            ms,
            meanAbs: Number(resp.meanAbs ?? 0),
            epistemicVar: Number(resp.epistemicVar ?? 0.01),
            branchScores: Array.isArray(resp.branchScores) ? (resp.branchScores as number[]) : [0, 0, 0, 0],
            head: Array.isArray(resp.head) ? (resp.head as number[]) : [],
          };
        }
      };
      this.pendingMutex = this.pendingMutex.then(run, run);
      await this.pendingMutex;
      if (result) return result;
    }

    // Deterministic action-conditioned fallback matching `build_rssm_model`
    const t0 = performance.now();
    let sumAbs = 0;
    const head: number[] = [];
    const branchScores: number[] = [];
    const n = Math.min(2048, latentBatch2048.length);
    for (let r = 0; r < 8; r++) {
      let rowSum = 0;
      for (let c = 0; c < 16; c++) {
        const idx = r * 64 + c;
        const x = idx < n ? latentBatch2048[idx]! : 0;
        const act = r * 64 + 48 + (c & 15) < n ? latentBatch2048[r * 64 + 48 + (c & 15)]! : 0;
        const next = Math.tanh(0.82 * x + 0.38 * Math.tanh(0.45 * x + 0.32 * act));
        rowSum += next;
        if (r === 0) head.push(Number(next.toFixed(5)));
      }
      branchScores.push(Number((rowSum / 16).toFixed(5)));
    }
    for (let i = 0; i < n; i++) {
      const x = latentBatch2048[i]!;
      sumAbs += Math.abs(Math.tanh(0.82 * x + 0.38 * Math.tanh(0.42 * x)));
    }
    const meanBranch = branchScores.reduce((a, b) => a + b, 0) / branchScores.length;
    const epistemicVar =
      branchScores.reduce((acc, b) => acc + (b - meanBranch) * (b - meanBranch), 0) / branchScores.length;
    const ms = Math.max(0.01, performance.now() - t0);
    this.status.totalDispatches += 1;
    this.status.lastLatencyMs = ms;
    return {
      device: this.status.primaryDevice,
      ms,
      meanAbs: n > 0 ? sumAbs / n : 0,
      epistemicVar,
      branchScores,
      head,
    };
  }

  /**
   * Executes `[1, 2, 32, 32]` Habitat Gray-Scott + Pheromone Field Diffusion on `Intel(R) Graphics` iGPU (`GPU.0`)!
   * Mutates `fieldUv2048` in-place with the updated reaction-diffusion concentrations.
   */
  public async stepFieldDiffusion2D(fieldUv2048: Float32Array, feed = 0.036, kill = 0.061): Promise<IgpuFieldResult> {
    if (this.status.daemonActive && this.proc?.stdin && fieldUv2048.length >= 2048) {
      let result: IgpuFieldResult | null = null;
      const run = async () => {
        const id = this.reqCounter++;
        const payload =
          JSON.stringify({ id, cmd: 'field2d', feed, kill, data: Array.from(fieldUv2048.subarray(0, 2048)) }) + '\n';
        const stdinSink = this.proc!.stdin as { write(chunk: string): unknown; flush?(): unknown };
        stdinSink.write(payload);
        if (typeof stdinSink.flush === 'function') stdinSink.flush();
        const resp = await this.readNextJsonLine(2500);
        if (resp && resp.ok && Array.isArray(resp.data)) {
          const outArr = resp.data as number[];
          const lim = Math.min(2048, outArr.length);
          for (let i = 0; i < lim; i++) fieldUv2048[i] = outArr[i]!;
          const ms = Number(resp.ms ?? this.status.calibratedAuxMs);
          this.status.totalIgpuDispatches += 1;
          this.status.lastIgpuLatencyMs = ms;
          result = {
            device: String(resp.device ?? this.status.auxDevice),
            ms,
            meanV: Number(resp.meanV ?? 0),
          };
        }
      };
      this.pendingMutex = this.pendingMutex.then(run, run);
      await this.pendingMutex;
      if (result) return result;
    }

    // Deterministic 32x32 reaction-diffusion CPU fallback
    const t0 = performance.now();
    const g = 32;
    const nextU = new Float32Array(1024);
    const nextV = new Float32Array(1024);
    let sumV = 0;
    for (let y = 0; y < g; y++) {
      const ym = y === 0 ? g - 1 : y - 1;
      const yp = y + 1 === g ? 0 : y + 1;
      for (let x = 0; x < g; x++) {
        const xm = x === 0 ? g - 1 : x - 1;
        const xp = x + 1 === g ? 0 : x + 1;
        const idx = y * g + x;
        const u = fieldUv2048[idx]!;
        const v = fieldUv2048[1024 + idx]!;
        const lapU =
          (fieldUv2048[ym * g + x]! + fieldUv2048[yp * g + x]! + fieldUv2048[y * g + xm]! + fieldUv2048[y * g + xp]! - 4 * u) *
          0.16;
        const lapV =
          (fieldUv2048[1024 + ym * g + x]! +
            fieldUv2048[1024 + yp * g + x]! +
            fieldUv2048[1024 + y * g + xm]! +
            fieldUv2048[1024 + y * g + xp]! -
            4 * v) *
          0.08;
        const uvv = u * v * v;
        nextU[idx] = Math.max(0, Math.min(1, u + lapU - uvv + feed * (1 - u)));
        nextV[idx] = Math.max(0, Math.min(1, v + lapV + uvv - (feed + kill) * v));
        sumV += nextV[idx]!;
      }
    }
    fieldUv2048.subarray(0, 1024).set(nextU);
    fieldUv2048.subarray(1024, 2048).set(nextV);
    const ms = Math.max(0.01, performance.now() - t0);
    this.status.totalIgpuDispatches += 1;
    this.status.lastIgpuLatencyMs = ms;
    return {
      device: this.status.auxDevice,
      ms,
      meanV: sumV / 1024,
    };
  }

  public shutdown(): void {
    try {
      void this.lineReader?.cancel().catch(() => {});
      if (this.proc?.stdin) {
        const stdinSink = this.proc.stdin as { write(chunk: string): unknown; end?(): unknown };
        stdinSink.write('{"id":0,"cmd":"quit"}\n');
        if (typeof stdinSink.end === 'function') stdinSink.end();
      }
      this.proc?.kill();
    } catch {
      // Ignore cleanup errors
    }
    this.proc = null;
    this.lineReader = null;
    this.status.daemonActive = false;
  }
}
