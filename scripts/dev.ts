#!/usr/bin/env bun
/**
 * CQM2 Local Development & Workstation Launcher (`bun run dev`).
 */
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const buildRes = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (buildRes.exitCode !== 0) process.exit(buildRes.exitCode);

await import('../src/server/main.ts');
