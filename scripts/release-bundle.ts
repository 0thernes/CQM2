#!/usr/bin/env bun
/**
 * CQM2 Deterministic Release Archive & SHA-256 Manifest Builder (`bun run release:bundle`).
 * Produces downloadable `.tar.gz` / `.zip` release bundles + `SHA256SUMS.txt` in `release-artifacts/`.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT_DIR = join(ROOT, 'release-artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();

// Ensure `site/` is freshly built
const pagesStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build-pages.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (pagesStep.exitCode !== 0) process.exit(pagesStep.exitCode);

// Copy LICENSE & README into a staging folder for archiving
const stageWeb = join(OUT_DIR, `cqm2-v${version}-universal-web`);
rmSync(stageWeb, { recursive: true, force: true });
mkdirSync(join(stageWeb, 'assets'), { recursive: true });

for (const f of ['index.html', 'docs.html', 'specs.html', 'glossary.html', 'downloads.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '.nojekyll']) {
  copyFileSync(join(ROOT, 'site', f), join(stageWeb, f));
}
for (const f of readdirSync(join(ROOT, 'site', 'assets'))) {
  copyFileSync(join(ROOT, 'site', 'assets', f), join(stageWeb, 'assets', f));
}
copyFileSync(join(ROOT, 'LICENSE'), join(stageWeb, 'LICENSE'));
copyFileSync(join(ROOT, 'README.md'), join(stageWeb, 'README.md'));

// Create portable `.tar.gz` archive (supported natively via `tar` on Windows 10/11, macOS, and Ubuntu!)
const webTarName = `cqm2-v${version}-universal-web.tar.gz`;
const webTarPath = join(OUT_DIR, webTarName);
const tarWeb = Bun.spawnSync(['tar', '-czf', webTarPath, '-C', OUT_DIR, `cqm2-v${version}-universal-web`], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (tarWeb.exitCode !== 0) process.exit(tarWeb.exitCode);
rmSync(stageWeb, { recursive: true, force: true });

// If Windows x64 polyglot native binaries are built locally, package the Tri-Engine Native Pack too!
const triDll = join(ROOT, 'native', 'bin', 'cqm2_tri_accel.dll');
if (existsSync(triDll)) {
  const stageWin = join(OUT_DIR, `cqm2-v${version}-windows-x64-tri-engine`);
  rmSync(stageWin, { recursive: true, force: true });
  mkdirSync(join(stageWin, 'native', 'bin'), { recursive: true });
  for (const f of readdirSync(join(ROOT, 'native', 'bin'))) {
    if (f.endsWith('.dll') || f.endsWith('.exe')) {
      copyFileSync(join(ROOT, 'native', 'bin', f), join(stageWin, 'native', 'bin', f));
    }
  }
  copyFileSync(join(ROOT, 'LICENSE'), join(stageWin, 'LICENSE'));
  copyFileSync(join(ROOT, 'README.md'), join(stageWin, 'README.md'));

  const winTarName = `cqm2-v${version}-windows-x64-tri-engine.tar.gz`;
  const winTarPath = join(OUT_DIR, winTarName);
  const tarWin = Bun.spawnSync(['tar', '-czf', winTarPath, '-C', OUT_DIR, `cqm2-v${version}-windows-x64-tri-engine`], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (tarWin.exitCode !== 0) process.exit(tarWin.exitCode);
  rmSync(stageWin, { recursive: true, force: true });
}

// Compute SHA256SUMS.txt over all files in `release-artifacts/`
const sumLines: string[] = [];
for (const f of readdirSync(OUT_DIR).sort()) {
  if (f === 'SHA256SUMS.txt') continue;
  const full = join(OUT_DIR, f);
  const digest = createHash('sha256').update(readFileSync(full)).digest('hex');
  sumLines.push(`${digest}  ${f}`);
}
writeFileSync(join(OUT_DIR, 'SHA256SUMS.txt'), sumLines.join('\n') + '\n');
console.log('[release:bundle] Generated release artifacts and SHA256SUMS.txt:\n' + sumLines.join('\n'));
