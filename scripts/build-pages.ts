#!/usr/bin/env bun
/**
 * CQM2 v2.1.0 GitHub Pages Universal Web Edition Builder & Budget Gate (`bun run pages`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const buildStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (buildStep.exitCode !== 0) process.exit(buildStep.exitCode);

const SITE = join(ROOT, 'site');
const required = [
  'index.html',
  'docs.html',
  'specs.html',
  'bible.html',
  'glossary.html',
  'downloads.html',
  'lab/quantum-wildbeyond.html',
  'favicon.svg',
  'og-card.svg',
  'robots.txt',
  'sitemap.xml',
  '.nojekyll',
  'fonts/inter-latin-wght-normal.woff2',
  'fonts/jetbrains-mono-latin-400-normal.woff2',
  'fonts/jetbrains-mono-latin-700-normal.woff2',
  'assets/workstation.js',
  'assets/wildbeyond-lab.js',
  'assets/tokens.css',
  'assets/manifest.json',
];

for (const rel of required) {
  if (!existsSync(join(SITE, rel))) {
    console.error(`[pages] Missing required Pages artifact: site/${rel}`);
    process.exit(1);
  }
}

const manifest = JSON.parse(readFileSync(join(SITE, 'assets', 'manifest.json'), 'utf8')) as Record<string, string>;
for (const hashed of Object.values(manifest)) {
  if (!existsSync(join(SITE, 'assets', hashed))) {
    console.error(`[pages] Missing content-hashed asset: site/assets/${hashed}`);
    process.exit(1);
  }
}

// Enforce zero .map files in production bundle (`I-066`) and strict JS size budget (`< 1.5 MB` uncompressed including Three.js + Zig WASM)
const assetFiles = readdirSync(join(SITE, 'assets'));
for (const f of assetFiles) {
  if (f.endsWith('.map')) {
    console.error(`[pages] Forbidden source map found in production site/assets/${f}`);
    process.exit(1);
  }
}

const jsSize = statSync(join(SITE, 'assets', 'workstation.js')).size;
if (jsSize > 1_500_000) {
  console.error(`[pages] Bundle budget exceeded: workstation.js is ${jsSize} bytes (> 1.5 MB)`);
  process.exit(1);
}

console.log(`[pages] Universal GitHub Pages bundle verified (${(jsSize / 1024).toFixed(1)} KB total JS+Three+ZigWASM, 7 HTML pages, 3 WOFF2 fonts).`);
