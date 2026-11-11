#!/usr/bin/env bun
/**
 * CQM2 v3.0.0 Polyglot Native Accelerator & Win32 GUI Launcher Build Orchestrator (`bun run build:native`).
 * Respects `CQM2_LLVM_BIN`, `CQM2_MSVC_DIR`, `CQM2_WINKITS_DIR`, and `CQM2_CUDA_INC` environment
 * overrides before probing standard installation paths (`I-038`).
 *
 * Builds:
 *   1. `cqm2_zig.wasm` (SIMD128) + `native/bin/cqm2_zig.dll` (AVX2)
 *   2. `native/bin/cqm2_tri_accel.dll` (CUDA cuBLAS + DirectML iGPU + LevelZero NPU + x86-64 AVX2/FMA3/POPCNT ASM)
 *   3. `native/bin/cqm2_tsotchke_native.dll` (C17 RosettaWire + C++20 Moonlab + libirrep + Eshkol + QGTL + QRNG + Apex + CSR Graph + FWHT Magic)
 *   4. `native/bin/CQM2.exe` (Native Win32 GUI `-Wl,/SUBSYSTEM:WINDOWS` Launcher with embedded `cqm2.ico`)
 *   5. `native/bin/cqm2_rust_ledger.dll` (Rust 1.94 Merkle + First-Law Conservation + GeoRefine BF16)
 *   6. `native/bin/cqm2-telemetry-bridge.exe` (Go 1.26 TouchDesigner / Unity OSC Streaming Hub)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const BIN_DIR = join(ROOT, 'native', 'bin');
mkdirSync(BIN_DIR, { recursive: true });

// 1. Build Zig WASM + Native DLL
console.log('=== [1/6] Building Zig 0.17 SIMD128 WASM & Native AVX2 DLL ===');
const zigStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build-zig.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (zigStep.exitCode !== 0) process.exit(zigStep.exitCode);

// 2-4. Build Windows x64 Native C/C++/ASM/CUDA DLLs + Win32 GUI Launcher (`CQM2.exe`)
if (process.platform === 'win32') {
  const clangCandidates = [
    process.env.CQM2_LLVM_BIN ? join(process.env.CQM2_LLVM_BIN, 'clang++.exe') : null,
    Bun.which('clang++'),
    'Z:\\Tools\\LLVM-21\\bin\\clang++.exe',
    'C:\\Program Files\\LLVM\\bin\\clang++.exe',
  ].filter((x): x is string => Boolean(x && existsSync(x)));

  const msvcBaseCandidates = [
    process.env.CQM2_MSVC_DIR,
    'Z:\\Tools\\VS2022BuildTools\\VC\\Tools\\MSVC',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC',
  ].filter((x): x is string => Boolean(x && existsSync(x)));

  const msvcBase = msvcBaseCandidates[0] ?? '';
  const msvcVer = msvcBase ? readdirSync(msvcBase).sort().at(-1) : null;
  const kitsBase = process.env.CQM2_WINKITS_DIR ?? 'C:\\Program Files (x86)\\Windows Kits\\10';
  const sdkIncBase = join(kitsBase, 'Include');
  const sdkVer = existsSync(sdkIncBase) ? readdirSync(sdkIncBase).sort().at(-1) : null;

  const cudaIncCandidates = [
    process.env.CQM2_CUDA_INC,
    process.env.CUDA_PATH ? join(process.env.CUDA_PATH, 'include') : null,
    'Z:\\Tools\\cuda-12.9-redist\\include',
  ].filter((x): x is string => Boolean(x && existsSync(x)));
  const cudaInc = cudaIncCandidates[0] ?? '';

  if (clangCandidates.length > 0 && msvcVer && sdkVer) {
    const clangxx = clangCandidates[0]!;
    const llvmBin = dirname(clangxx);
    const clangc = existsSync(join(llvmBin, 'clang.exe')) ? join(llvmBin, 'clang.exe') : clangxx;
    const llvmRc = existsSync(join(llvmBin, 'llvm-rc.exe')) ? join(llvmBin, 'llvm-rc.exe') : null;

    const msvc = join(msvcBase, msvcVer);
    const sdkInc = join(sdkIncBase, sdkVer);
    const sdkLib = join(kitsBase, 'Lib', sdkVer);

    const commonIncludes = [
      `-I${join(msvc, 'include')}`,
      `-I${join(sdkInc, 'ucrt')}`,
      `-I${join(sdkInc, 'shared')}`,
      `-I${join(sdkInc, 'um')}`,
    ];
    const commonLibDirs = [
      `-L${join(msvc, 'lib', 'x64')}`,
      `-L${join(sdkLib, 'ucrt', 'x64')}`,
      `-L${join(sdkLib, 'um', 'x64')}`,
    ];

    // [2/6] Tri-Accelerator DLL (CUDA + DirectML + LevelZero + AVX2 ASM)
    if (cudaInc) {
      console.log('=== [2/6] Building C++20 + x86-64 AVX2 ASM + CUDA/DirectML/LevelZero DLL ===');
      const cppSrc = join(ROOT, 'native', 'gpu_cuda', 'cqm2_tri_accel.cpp');
      const asmSrc = join(ROOT, 'native', 'gpu_cuda', 'cqm2_avx2_asm.S');
      const dllOut = join(BIN_DIR, 'cqm2_tri_accel.dll');

      const res = Bun.spawnSync(
        [
          clangxx,
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
          ...commonIncludes,
          `-I${cudaInc}`,
          ...commonLibDirs,
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
      console.log('[build:native] CUDA headers not present; skipping cqm2_tri_accel.dll.');
    }

    // [3/6] Tsotchke C17 + C++20 Native DLL (RosettaWire + Moonlab + libirrep + Eshkol + QGTL + QRNG + CSR Graph)
    console.log('=== [3/6] Building C17 RosettaWire + C++20 Moonlab/Eshkol/QGTL/CSR DLL ===');
    const rwObj = join(BIN_DIR, 'cqm2_rosette_wire.obj');
    const rwC = join(ROOT, 'native', 'tsotchke', 'cqm2_rosette_wire.c');
    const tsCpp = join(ROOT, 'native', 'tsotchke', 'cqm2_tsotchke_native.cpp');
    const tsDll = join(BIN_DIR, 'cqm2_tsotchke_native.dll');

    const cRes = Bun.spawnSync(
      [
        clangc,
        '-c',
        '-O3',
        '-mavx2',
        '-std=c17',
        '-Wall',
        '-Wextra',
        '-Werror',
        rwC,
        '-o',
        rwObj,
        ...commonIncludes,
      ],
      { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' },
    );
    if (cRes.exitCode !== 0) {
      console.error('[build:native] Failed to compile cqm2_rosette_wire.c');
      process.exit(cRes.exitCode);
    }

    const tsRes = Bun.spawnSync(
      [
        clangxx,
        '-shared',
        '-O3',
        '-mavx2',
        '-mfma',
        '-mpopcnt',
        '-std=c++20',
        '-Wall',
        '-Wextra',
        '-Werror',
        tsCpp,
        rwObj,
        '-o',
        tsDll,
        `-I${join(ROOT, 'native', 'tsotchke')}`,
        ...commonIncludes,
        ...commonLibDirs,
      ],
      { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' },
    );
    if (tsRes.exitCode !== 0) {
      console.error('[build:native] Failed to compile cqm2_tsotchke_native.dll');
      process.exit(tsRes.exitCode);
    }
    console.log(`[build:native] Built ${tsDll}`);

    // [4/6] Native Win32 GUI Workstation Launcher (`CQM2.exe`)
    console.log('=== [4/6] Building Native Win32 GUI Workstation Executable (CQM2.exe) ===');
    const icoStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'gen-ico.ts')], {
      cwd: ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (icoStep.exitCode !== 0) process.exit(icoStep.exitCode);

    const launcherDir = join(ROOT, 'native', 'launcher');
    const resObj = join(BIN_DIR, 'cqm2_icon.res');
    const extraResInputs: string[] = [];
    if (llvmRc) {
      const rcStep = Bun.spawnSync([llvmRc, '/fo', resObj, join(launcherDir, 'cqm2.rc')], {
        cwd: launcherDir,
        stdout: 'inherit',
        stderr: 'inherit',
      });
      if (rcStep.exitCode === 0 && existsSync(resObj)) {
        extraResInputs.push(resObj);
      }
    }

    const exeOut = join(BIN_DIR, 'CQM2.exe');
    const launcherStep = Bun.spawnSync(
      [
        clangxx,
        '-O3',
        '-std=c++20',
        '-Wall',
        '-Wextra',
        '-Werror',
        join(launcherDir, 'cqm2_launcher.cpp'),
        ...extraResInputs,
        '-o',
        exeOut,
        ...commonIncludes,
        ...commonLibDirs,
        '-lws2_32',
        '-lshell32',
        '-luser32',
        '-ladvapi32',
        '-Wl,/SUBSYSTEM:WINDOWS',
      ],
      { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' },
    );
    if (launcherStep.exitCode !== 0) {
      console.error('[build:native] Failed to compile CQM2.exe');
      process.exit(launcherStep.exitCode);
    }
    console.log(`[build:native] Built ${exeOut}`);
  } else {
    console.log('[build:native] Windows LLVM/MSVC headers not present; skipping Windows C++ DLLs & CQM2.exe.');
  }
}

// 5. Build Rust Ledger & Conservation Verifier
console.log('=== [5/6] Building Rust 1.94 Merkle & First-Law Conservation Ledger ===');
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

// 6. Build Go Telemetry & TouchDesigner/Unity OSC Hub
console.log('=== [6/6] Building Go 1.26 Telemetry & OSC Streaming Hub ===');
const goCandidates = [
  Bun.which('go'),
  'C:\\Program Files\\Go\\bin\\go.exe',
  join(process.env.USERPROFILE ?? '', 'go', 'bin', 'go.exe'),
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

console.log('=== [CQM2 v3.0.0] Polyglot Native Hardware & GUI Executable Build Complete! ===');
