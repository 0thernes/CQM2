#!/usr/bin/env bun
/**
 * CQM2 Polyglot Native Accelerator Build Orchestrator (`bun run build:native`).
 * Gracefully detects installed toolchains (Zig, Clang++/CUDA/WinSDK, Rust, Go) and compiles:
 *   1. Zig SIMD128 WASM + Native AVX2 DLL (`native/bin/cqm2_zig.dll`)
 *   2. C++20 CUDA/cuBLAS + DirectML + LevelZero + x86-64 AVX2 ASM (`native/bin/cqm2_tri_accel.dll`)
 *   3. Rust 1.94 Entity-Relational Merkle & Metabolic Conservation Auditor (`native/bin/cqm2_rust_ledger.dll`)
 *   4. Go 1.26 Hardware Telemetry & TouchDesigner/Unity OSC Hub (`native/bin/cqm2-telemetry-bridge.exe`)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const BIN_DIR = join(ROOT, 'native', 'bin');
mkdirSync(BIN_DIR, { recursive: true });

// 1. Build Zig WASM + Native DLL
console.log('=== [1/4] Building Zig 0.17 SIMD128 WASM & Native AVX2 DLL ===');
const zigStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build-zig.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (zigStep.exitCode !== 0) process.exit(zigStep.exitCode);

// 2. Build C++20 + x86-64 AVX2 ASM + CUDA/DirectML/LevelZero Tri-Accelerator (Windows x64)
if (process.platform === 'win32') {
  console.log('=== [2/4] Building C++20 + x86-64 AVX2 ASM + CUDA/DirectML/LevelZero DLL ===');
  const clangCandidates = [
    Bun.which('clang++'),
    'Z:\\Tools\\LLVM-21\\bin\\clang++.exe',
    'C:\\Program Files\\LLVM\\bin\\clang++.exe',
  ].filter((x): x is string => Boolean(x && existsSync(x)));

  const msvcBase = 'Z:\\Tools\\VS2022BuildTools\\VC\\Tools\\MSVC';
  const msvcVer = existsSync(msvcBase) ? readdirSync(msvcBase).sort().at(-1) : null;
  const sdkIncBase = 'C:\\Program Files (x86)\\Windows Kits\\10\\Include';
  const sdkVer = existsSync(sdkIncBase) ? readdirSync(sdkIncBase).sort().at(-1) : null;
  const cudaInc = 'Z:\\Tools\\cuda-12.9-redist\\include';

  if (clangCandidates.length > 0 && msvcVer && sdkVer && existsSync(cudaInc)) {
    const clang = clangCandidates[0]!;
    const msvc = join(msvcBase, msvcVer);
    const sdkInc = join(sdkIncBase, sdkVer);
    const sdkLib = join('C:\\Program Files (x86)\\Windows Kits\\10\\Lib', sdkVer);
    const cppSrc = join(ROOT, 'native', 'gpu_cuda', 'cqm2_tri_accel.cpp');
    const asmSrc = join(ROOT, 'native', 'gpu_cuda', 'cqm2_avx2_asm.S');
    const dllOut = join(BIN_DIR, 'cqm2_tri_accel.dll');

    const res = Bun.spawnSync(
      [
        clang,
        '-shared',
        '-O3',
        '-mavx2',
        '-mfma',
        '-mpopcnt',
        '-std=c++20',
        '-Wall',
        '-Wextra',
        '-Werror',
        cppSrc,
        asmSrc,
        '-o',
        dllOut,
        `-I${join(msvc, 'include')}`,
        `-I${join(sdkInc, 'ucrt')}`,
        `-I${join(sdkInc, 'shared')}`,
        `-I${join(sdkInc, 'um')}`,
        `-I${cudaInc}`,
        `-L${join(msvc, 'lib', 'x64')}`,
        `-L${join(sdkLib, 'ucrt', 'x64')}`,
        `-L${join(sdkLib, 'um', 'x64')}`,
        '-lole32',
        '-luuid',
      ],
      { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' },
    );
    if (res.exitCode !== 0) {
      console.error('[build:native] Failed to compile cqm2_tri_accel.dll');
      process.exit(res.exitCode);
    }
    console.log(`[build:native] Built ${dllOut}`);
  } else {
    console.log('[build:native] Windows CUDA/MSVC headers not present; skipping cqm2_tri_accel.dll (TS/Zig fallback active).');
  }
}

// 3. Build Rust Ledger & Conservation Verifier
console.log('=== [3/4] Building Rust 1.94 Merkle & First-Law Conservation Ledger ===');
const cargoCandidates = [
  Bun.which('cargo'),
  join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo'),
].filter((x): x is string => Boolean(x && existsSync(x)));

if (cargoCandidates.length > 0) {
  const cargo = cargoCandidates[0]!;
  const rustDir = join(ROOT, 'rust');
  const cargoEnv = {
    ...process.env,
    PATH: `${join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
  };
  const testRust = Bun.spawnSync([cargo, 'test', '--release'], {
    cwd: rustDir,
    env: cargoEnv,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (testRust.exitCode !== 0) process.exit(testRust.exitCode);

  const buildRust = Bun.spawnSync([cargo, 'build', '--release'], {
    cwd: rustDir,
    env: cargoEnv,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (buildRust.exitCode !== 0) process.exit(buildRust.exitCode);

  for (const libName of ['cqm2_rust_ledger.dll', 'libcqm2_rust_ledger.so', 'libcqm2_rust_ledger.dylib']) {
    const built = join(rustDir, 'target', 'release', libName);
    if (existsSync(built)) {
      copyFileSync(built, join(BIN_DIR, libName));
      console.log(`[build:native] Built native/bin/${libName}`);
    }
  }
} else {
  console.log('[build:native] Cargo not installed; skipping Rust ledger DLL (TS fallback active).');
}

// 4. Build Go Telemetry & TouchDesigner/Unity OSC Hub
console.log('=== [4/4] Building Go 1.26 Telemetry & OSC Streaming Hub ===');
const goCandidates = [
  Bun.which('go'),
  'C:\\Program Files\\Go\\bin\\go.exe',
].filter((x): x is string => Boolean(x && existsSync(x)));

if (goCandidates.length > 0) {
  const goExe = goCandidates[0]!;
  const outExe = join(BIN_DIR, process.platform === 'win32' ? 'cqm2-telemetry-bridge.exe' : 'cqm2-telemetry-bridge');
  const goRes = Bun.spawnSync([goExe, 'build', '-o', outExe, '.'], {
    cwd: join(ROOT, 'go'),
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (goRes.exitCode !== 0) process.exit(goRes.exitCode);
  console.log(`[build:native] Built ${outExe}`);
} else {
  console.log('[build:native] Go compiler not installed; skipping telemetry bridge binary.');
}

console.log('=== [CQM2] Polyglot Native Hardware Build Complete! ===');
