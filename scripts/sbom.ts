#!/usr/bin/env bun
/**
 * CQM2 CycloneDX 1.5 Software Bill of Materials Generator (`bun run sbom`).
 * Emits `release-artifacts/sbom.cdx.json` with SHA-256 hashes of runtime libraries and native binaries.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT_DIR = join(ROOT, 'release-artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  description: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

function sha256File(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const components: Array<Record<string, unknown>> = [];

for (const [depName, depVer] of Object.entries(pkg.dependencies ?? {})) {
  components.push({
    type: 'library',
    name: depName,
    version: depVer,
    purl: `pkg:npm/${depName}@${depVer}`,
    scope: 'required',
  });
}

const nativeBinaries = [
  { name: 'cqm2_zig.wasm', path: join(ROOT, 'src', 'native', 'zig-wasm-embedded.ts'), desc: 'Embedded Zig 0.17 SIMD128 WebAssembly module' },
  { name: 'cqm2_zig.dll', path: join(ROOT, 'native', 'bin', 'cqm2_zig.dll'), desc: 'Native Zig 0.17 AVX2 Windows x64 DLL' },
  { name: 'cqm2_tri_accel.dll', path: join(ROOT, 'native', 'bin', 'cqm2_tri_accel.dll'), desc: 'C++20 CUDA/cuBLAS + DirectML + LevelZero + x86-64 AVX2 ASM DLL' },
  { name: 'cqm2_rust_ledger.dll', path: join(ROOT, 'native', 'bin', 'cqm2_rust_ledger.dll'), desc: 'Rust 1.94 Merkle & First-Law Conservation Ledger DLL' },
  { name: 'cqm2-telemetry-bridge.exe', path: join(ROOT, 'native', 'bin', 'cqm2-telemetry-bridge.exe'), desc: 'Go 1.26 Hardware Telemetry & OSC 1.0 UDP Hub' },
];

for (const nb of nativeBinaries) {
  const hash = sha256File(nb.path);
  if (hash) {
    components.push({
      type: 'application',
      name: nb.name,
      version: pkg.version,
      description: nb.desc,
      hashes: [{ alg: 'SHA-256', content: hash }],
    });
  }
}

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: 'urn:uuid:c05m060n-c9a2-4000-8000-000000000200',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      licenses: [{ license: { name: 'COSMOGONIC LICENSE — NON-COMMERCIAL RESEARCH & PLAY' } }],
    },
  },
  components,
};

const outPath = join(OUT_DIR, 'sbom.cdx.json');
writeFileSync(outPath, JSON.stringify(sbom, null, 2) + '\n');
console.log(`[sbom] Wrote CycloneDX 1.5 SBOM (${components.length} components) -> ${outPath}`);
