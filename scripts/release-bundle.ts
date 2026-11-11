#!/usr/bin/env bun
/**
 * CQM2 v2.1.0 Deterministic Release Archive & SHA-256 Manifest Builder (`bun run release:bundle`).
 * Produces downloadable `.tar.gz` release bundles + `SHA256SUMS.txt` in `release-artifacts/`.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT_DIR = join(ROOT, 'release-artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
for (const existing of readdirSync(OUT_DIR)) {
  if (existing.startsWith('cqm2-v') && !existing.startsWith(`cqm2-v${version}-`)) {
    rmSync(join(OUT_DIR, existing), { recursive: true, force: true });
  }
}

// Ensure `site/` is freshly built
const pagesStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build-pages.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (pagesStep.exitCode !== 0) process.exit(pagesStep.exitCode);

// Copy entire `site/` (all 7 HTML pages, lab/, fonts/*.woff2, hashed assets/) + LICENSE & README
const stageWeb = join(OUT_DIR, `cqm2-v${version}-universal-web`);
rmSync(stageWeb, { recursive: true, force: true });
cpSync(join(ROOT, 'site'), stageWeb, { recursive: true });
copyFileSync(join(ROOT, 'LICENSE'), join(stageWeb, 'LICENSE'));
copyFileSync(join(ROOT, 'README.md'), join(stageWeb, 'README.md'));

const webTarName = `cqm2-v${version}-universal-web.tar.gz`;
const webTarPath = join(OUT_DIR, webTarName);
const tarWeb = Bun.spawnSync(['tar', '-czf', webTarPath, '-C', OUT_DIR, `cqm2-v${version}-universal-web`], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (tarWeb.exitCode !== 0) process.exit(tarWeb.exitCode);
rmSync(stageWeb, { recursive: true, force: true });

// Package Windows x64 Quad-Silicon Native Binaries when present
const triDll = join(ROOT, 'native', 'bin', 'cqm2_tri_accel.dll');
if (existsSync(triDll)) {
  const stageWin = join(OUT_DIR, `cqm2-v${version}-windows-x64-quad-silicon`);
  rmSync(stageWin, { recursive: true, force: true });
  mkdirSync(join(stageWin, 'native', 'bin'), { recursive: true });
  for (const f of readdirSync(join(ROOT, 'native', 'bin'))) {
    if (f.endsWith('.dll') || f.endsWith('.exe')) {
      copyFileSync(join(ROOT, 'native', 'bin', f), join(stageWin, 'native', 'bin', f));
    }
  }
  copyFileSync(join(ROOT, 'LICENSE'), join(stageWin, 'LICENSE'));
  copyFileSync(join(ROOT, 'README.md'), join(stageWin, 'README.md'));

  const winTarName = `cqm2-v${version}-windows-x64-quad-silicon.tar.gz`;
  const winTarPath = join(OUT_DIR, winTarName);
  const tarWin = Bun.spawnSync(['tar', '-czf', winTarPath, '-C', OUT_DIR, `cqm2-v${version}-windows-x64-quad-silicon`], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (tarWin.exitCode !== 0) process.exit(tarWin.exitCode);
  rmSync(stageWin, { recursive: true, force: true });

  // Also include standalone native launcher CQM2.exe directly in release-artifacts/
  const standaloneExe = join(ROOT, 'native', 'bin', 'CQM2.exe');
  if (existsSync(standaloneExe)) {
    copyFileSync(standaloneExe, join(OUT_DIR, 'CQM2.exe'));
  }
}

// Compute SHA256SUMS.txt over all files in `release-artifacts/`
const sumLines: string[] = [];
for (const f of readdirSync(OUT_DIR).sort()) {
  if (f === 'SHA256SUMS.txt') continue;
  const full = join(OUT_DIR, f);
  if (!statSync(full).isFile()) continue;
  const digest = createHash('sha256').update(readFileSync(full)).digest('hex');
  sumLines.push(`${digest}  ${f}`);
}
writeFileSync(join(OUT_DIR, 'SHA256SUMS.txt'), sumLines.join('\n') + '\n');
console.log('[release:bundle] Generated release artifacts and SHA256SUMS.txt:\n' + sumLines.join('\n'));
