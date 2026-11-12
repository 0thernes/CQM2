#!/usr/bin/env bun
/**
 * CQM2 v5.0.0 Polyglot Native Accelerator & Standalone OpenGL/Jolt/ImGui Workstation Build Orchestrator (`bun run build:native`).
 * Respects `CQM2_LLVM_BIN`, `CQM2_MINGW_BIN`, `CQM2_DEPS_DIR`, `CQM2_MSVC_DIR`, `CQM2_WINKITS_DIR`, and `CQM2_CUDA_INC`
 * environment overrides before probing standard installation paths (`I-038`).
 *
 * Builds:
 *   1. `cqm2_zig.wasm` (SIMD128, 49 kernels) + `native/bin/cqm2_zig.dll` (AVX2)
 *   2. `native/bin/cqm2_tri_accel.dll` (CUDA 12.9 cuBLAS + NVRTC sm_120 JIT + DirectML iGPU + LevelZero NPU + x86-64 AVX2/FMA3/POPCNT ASM)
 *   3. `native/bin/cqm2_tsotchke_native.dll` (C17 RosettaWire + C++20 Moonlab + libirrep + Eshkol + QGTL + QRNG + Asmodenius 272-LIF + Apex + CSR)
 *   4. `native/bin/CQM2.exe` (Standalone Native C++20 + 64-Mesh OpenGL 3.3 Core + GLFW 3.4 + GLM 1.0.3 + Jolt Physics 5.5.0 + Dear ImGui 1.92.8 + WinMM Audio Workstation)
 *   5. `native/bin/cqm2_rust_ledger.dll` (Rust 1.94 Merkle + First-Law Conservation + GeoRefine BF16)
 *   6. `native/bin/cqm2-telemetry-bridge.exe` (Go 1.26 TouchDesigner / Unity OSC Streaming Hub)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const BIN_DIR = join(ROOT, 'native', 'bin');
mkdirSync(BIN_DIR, { recursive: true });

// 1. Build Zig WASM + Native DLL
console.log('=== [1/6] Building Zig 0.17 SIMD128 WASM & Native AVX2 DLL (49 Kernels) ===');
const zigStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'build-zig.ts')], {
  cwd: ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (zigStep.exitCode !== 0) process.exit(zigStep.exitCode);

// 2-4. Build Windows x64 Native C/C++/ASM/CUDA DLLs + Standalone OpenGL/Jolt/ImGui Workstation (`CQM2.exe`)
if (process.platform === 'win32') {
  // Stage Tsotchke Moonlab & libirrep native DLLs into native/bin if present on workstation
  const tsotchkeDllCandidates: Array<[string, string]> = [
    ['Z:\\[Vibe Coded (AI)]\\(Tsotchke)\\mirrors\\moonlab\\build_mingw\\libquantumsim.dll', 'libquantumsim.dll'],
    ['Z:\\[Vibe Coded (AI)]\\(Tsotchke)\\mirrors\\libirrep\\build_mingw\\liblibirrep.dll', 'liblibirrep.dll'],
  ];
  for (const [srcDll, dstName] of tsotchkeDllCandidates) {
    if (existsSync(srcDll)) {
      copyFileSync(srcDll, join(BIN_DIR, dstName));
      console.log(`[build:native] Staged Tsotchke native DLL -> native/bin/${dstName}`);
    }
  }

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
      console.log('=== [2/6] Building C++20 + x86-64 AVX2 ASM + Blackwell sm_120 PTX + CUDA/DirectML/LevelZero DLL ===');
      const sm120C = join(ROOT, 'native', 'gpu_cuda', 'cqm2_kernels_sm120.c');
      const sm120Hdr = join(ROOT, 'native', 'gpu_cuda', 'cqm2_kernels_sm120_ptx.h');
      if (existsSync(sm120C)) {
        const p120 = Bun.spawnSync([clangc, '--target=nvptx64-nvidia-cuda', '-march=sm_120', '-O3', '-S', sm120C, '-o', '-'], { cwd: ROOT });
        const p80 = Bun.spawnSync([clangc, '--target=nvptx64-nvidia-cuda', '-march=sm_80', '-O3', '-S', sm120C, '-o', '-'], { cwd: ROOT });
        if (p120.exitCode === 0 && p80.exitCode === 0) {
          const s120 = new TextDecoder().decode(p120.stdout).replace(/\r\n/g, '\n');
          const s80 = new TextDecoder().decode(p80.stdout).replace(/\r\n/g, '\n');
          writeFileSync(
            sm120Hdr,
            `/* Auto-generated by LLVM 21 NVPTX64 Backend from cqm2_kernels_sm120.c */\n#pragma once\nstatic const char* kCqm2PtxSm120 = R"PTX(${s120})PTX";\nstatic const char* kCqm2PtxSm80 = R"PTX(${s80})PTX";\n`,
          );
          console.log('[build:native] Compiled sm_120 + sm_80 NVPTX64 kernels via Clang 21.');
        }
      }
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

    // [3/6] Tsotchke C17 + C++20 Native DLL (RosettaWire + Moonlab + libirrep + Eshkol + QGTL + QRNG + Asmodenius 272-LIF + CSR Graph)
    console.log('=== [3/6] Building C17 RosettaWire + C++20 Moonlab/Eshkol/QGTL/Asmodenius DLL ===');
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
  } else {
    console.log('[build:native] Windows LLVM/MSVC headers not present; skipping Clang-MSVC DLLs.');
  }

  // [4/6] Standalone Native C++20 + OpenGL 3.3 + GLFW 3.4 + Jolt 5.5 + ImGui 1.92.8 Workstation (`CQM2.exe`)
  console.log('=== [4/6] Building Standalone OpenGL 3.3 + Jolt 5.5 + Dear ImGui 1.92.8 Workstation (CQM2.exe) ===');
  const icoStep = Bun.spawnSync([process.execPath, 'run', join(ROOT, 'scripts', 'gen-ico.ts')], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (icoStep.exitCode !== 0) process.exit(icoStep.exitCode);

  const localAppData = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local');
  const wingetMingwBin = join(
    localAppData,
    'Microsoft',
    'WinGet',
    'Packages',
    'BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'mingw64',
    'bin',
  );
  const gxxCandidates = [
    process.env.CQM2_MINGW_BIN ? join(process.env.CQM2_MINGW_BIN, 'g++.exe') : null,
    join(wingetMingwBin, 'g++.exe'),
    Bun.which('g++'),
  ].filter((x): x is string => Boolean(x && existsSync(x)));

  const depsCandidates = [
    process.env.CQM2_DEPS_DIR,
    resolve(ROOT, '..', 'Cosmogonic Quantum Mechalogodrom', 'native', 'build-upgrade-mingw', '_deps'),
  ].filter((x): x is string => Boolean(x && existsSync(x)));

  if (gxxCandidates.length > 0 && depsCandidates.length > 0) {
    const gxx = gxxCandidates[0]!;
    const mingwBin = dirname(gxx);
    const windres = join(mingwBin, 'windres.exe');
    const depsDir = depsCandidates[0]!;
    const mingwEnv = {
      ...process.env,
      PATH: `${mingwBin};${process.env.PATH ?? ''}`,
    };

    const glfwInc = join(depsDir, 'glfw-src', 'include');
    const glfwDepsInc = join(depsDir, 'glfw-src', 'deps');
    const glfwLib = join(depsDir, 'glfw-build', 'src', 'libglfw3.a');
    const joltInc = join(depsDir, 'joltphysics-src');
    const joltLib = join(depsDir, 'joltphysics-build', 'libJolt.a');
    const glmInc = join(depsDir, 'glm-src');
    const imguiDir = join(depsDir, 'imgui-src');
    const imguiBackends = join(imguiDir, 'backends');

    const objDir = join(BIN_DIR, 'obj_engine');
    mkdirSync(objDir, { recursive: true });

    // Exact Jolt v5.5.0 ABI flags matching libJolt.a + 32-bit ImDrawIdx (eliminates 65k vertex cap)
    const joltAndSimdFlags = [
      '-DNDEBUG',
      '-DImDrawIdx=unsigned int',
      '-DJPH_DEBUG_RENDERER',
      '-DJPH_PROFILE_ENABLED',
      '-DJPH_OBJECT_STREAM',
      '-DJPH_USE_AVX2',
      '-DJPH_USE_AVX',
      '-DJPH_USE_SSE4_1',
      '-DJPH_USE_SSE4_2',
      '-DJPH_USE_LZCNT',
      '-DJPH_USE_TZCNT',
      '-DJPH_USE_F16C',
      '-DJPH_USE_FMADD',
      '-mavx2',
      '-mbmi',
      '-mpopcnt',
      '-mlzcnt',
      '-mf16c',
      '-mfma',
      '-mfpmath=sse',
    ];

    const incFlags = [
      `-I${join(ROOT, 'native', 'engine')}`,
      `-I${glfwInc}`,
      `-I${glfwDepsInc}`,
      `-I${joltInc}`,
      `-I${glmInc}`,
      `-I${imguiDir}`,
      `-I${imguiBackends}`,
    ];

    const engineDir = join(ROOT, 'native', 'engine');
    const engineHeadersNewest = Math.max(
      ...readdirSync(engineDir)
        .filter((f) => f.endsWith('.h'))
        .map((f) => statSync(join(engineDir, f)).mtimeMs),
    );

    const buildScriptMtime = statSync(join(ROOT, 'scripts', 'build-native.ts')).mtimeMs;
    const compileTu = (srcPath: string, strictWarnings: boolean, depMtime = 0): string => {
      const objPath = join(objDir, `${basename(srcPath, '.cpp')}.o`);
      const srcMtime = Math.max(statSync(srcPath).mtimeMs, depMtime, buildScriptMtime);
      if (existsSync(objPath) && statSync(objPath).mtimeMs >= srcMtime) {
        return objPath;
      }
      const warnFlags = strictWarnings ? ['-Wall', '-Wextra'] : ['-w'];
      const res = Bun.spawnSync(
        [
          gxx,
          '-c',
          '-O3',
          '-std=c++20',
          ...joltAndSimdFlags,
          ...warnFlags,
          ...incFlags,
          srcPath,
          '-o',
          objPath,
        ],
        { cwd: ROOT, env: mingwEnv, stdout: 'inherit', stderr: 'inherit' },
      );
      if (res.exitCode !== 0) {
        console.error(`[build:native] Failed compiling ${srcPath}`);
        process.exit(res.exitCode);
      }
      return objPath;
    };

    const imguiSources = [
      join(imguiDir, 'imgui.cpp'),
      join(imguiDir, 'imgui_draw.cpp'),
      join(imguiDir, 'imgui_tables.cpp'),
      join(imguiDir, 'imgui_widgets.cpp'),
      join(imguiBackends, 'imgui_impl_glfw.cpp'),
      join(imguiBackends, 'imgui_impl_opengl3.cpp'),
    ];

    const engineSources = [
      join(engineDir, 'gl_core.cpp'),
      join(engineDir, 'cqm2_native_audio.cpp'),
      join(engineDir, 'cqm2_native_sim.cpp'),
      join(engineDir, 'cqm2_native_renderer.cpp'),
      join(engineDir, 'cqm2_native_hud.cpp'),
      join(engineDir, 'cqm2_engine_main.cpp'),
    ];

    const objects: string[] = [];
    for (const s of imguiSources) {
      objects.push(compileTu(s, false, 0));
    }
    for (const s of engineSources) {
      objects.push(compileTu(s, true, engineHeadersNewest));
    }

    // Compile Windows application icon resource
    const launcherDir = join(ROOT, 'native', 'launcher');
    const iconObj = join(objDir, 'cqm2_icon.o');
    if (existsSync(windres) && existsSync(join(launcherDir, 'cqm2.rc'))) {
      const rcRes = Bun.spawnSync([windres, '-i', 'cqm2.rc', '-o', iconObj], {
        cwd: launcherDir,
        env: mingwEnv,
        stdout: 'inherit',
        stderr: 'inherit',
      });
      if (rcRes.exitCode === 0 && existsSync(iconObj)) {
        objects.push(iconObj);
      }
    }

    const exeOut = join(BIN_DIR, 'CQM2.exe');
    const linkRes = Bun.spawnSync(
      [
        gxx,
        '-O3',
        '-std=c++20',
        ...joltAndSimdFlags,
        ...objects,
        glfwLib,
        joltLib,
        '-o',
        exeOut,
        '-static',
        '-static-libgcc',
        '-static-libstdc++',
        '-lopengl32',
        '-lgdi32',
        '-lwinmm',
        '-lws2_32',
        '-lshell32',
        '-lole32',
        '-luuid',
        '-lcomdlg32',
        '-ldwmapi',
        '-limm32',
        '-Wl,--subsystem,windows',
      ],
      { cwd: ROOT, env: mingwEnv, stdout: 'inherit', stderr: 'inherit' },
    );
    if (linkRes.exitCode !== 0) {
      console.error('[build:native] Failed linking standalone CQM2.exe');
      process.exit(linkRes.exitCode);
    }
    console.log(`[build:native] Built standalone workstation ${exeOut}`);
  } else {
    console.log('[build:native] MinGW UCRT64 / _deps static archives not present; skipping standalone CQM2.exe.');
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

console.log('=== [CQM2 v5.0.0] Polyglot Native Hardware & Standalone OpenGL/Jolt Workstation Build Complete! ===');
