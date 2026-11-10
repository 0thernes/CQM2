const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{
        .preferred_optimize_mode = .ReleaseFast,
    });

    // 1. Portable Browser / Worker Target: WebAssembly + SIMD128 + Bulk Memory
    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
        .cpu_features_add = std.Target.wasm.featureSet(&.{ .simd128, .bulk_memory }),
    });

    const wasm_mod = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = wasm_target,
        .optimize = .ReleaseSmall,
    });

    const wasm = b.addExecutable(.{
        .name = "cqm2_zig",
        .root_module = wasm_mod,
    });
    wasm.entry = .disabled;
    wasm.rdynamic = true;
    b.installArtifact(wasm);

    // 2. Local Workstation Native Shared Library (.dll / .so / .dylib) for Bun.FFI
    const host_target = b.standardTargetOptions(.{});
    const dll_mod = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = host_target,
        .optimize = optimize,
    });

    const dll = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "cqm2_zig",
        .root_module = dll_mod,
    });
    b.installArtifact(dll);

    // 3. Native Unit Tests
    const test_mod = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = host_target,
        .optimize = optimize,
    });
    const unit_tests = b.addTest(.{
        .root_module = test_mod,
    });
    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run CQM2 Zig SIMD & quantum kernel unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
