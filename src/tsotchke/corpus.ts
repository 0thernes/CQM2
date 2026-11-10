/**
 * CQM2 Tsotchke 22-Pillar Mathematical & Biophysical Corpus Registry.
 * Maps each of the 22 Tsotchke pillars to concrete, non-cosmetic execution pathways in CQM2,
 * supports runtime causal ablation toggles, and enforces a hard read-only fence on `OBLITERATUS`.
 */

export interface TsotchkePillarDescriptor {
  readonly id: string;
  readonly repoFolder: string;
  readonly domain: 'QUANTUM' | 'BIOPHYSICS' | 'GEOMETRY' | 'NEURODYNAMICS' | 'NUMERICS' | 'FENCED_SAFETY';
  readonly cqm2Module: string;
  readonly activeByDefault: boolean;
  readonly fencedQuarantine: boolean;
  readonly mathematicalContract: string;
}

export const TSOTCHKE_22_PILLARS: readonly TsotchkePillarDescriptor[] = Object.freeze([
  {
    id: 'moonlab',
    repoFolder: 'moonlab',
    domain: 'QUANTUM',
    cqm2Module: 'src/quantum/contextuality.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Unitary SU(2) block-braid state-vector evolution with norm drift < 1e-12.',
  },
  {
    id: 'eshkol',
    repoFolder: 'eshkol',
    domain: 'GEOMETRY',
    cqm2Module: 'zig/src/root.zig::cqm2_eshkol_spine_curvature',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Degree-2 Taylor jet differential spine curvature |r\' x r\'\'| / |r\'|^3.',
  },
  {
    id: 'qgtl',
    repoFolder: 'qgtl',
    domain: 'QUANTUM',
    cqm2Module: 'src/quantum/contextuality.ts::ZeroGcQuantumRegister',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Zero-GC Fubini-Study metric g_uv and Berry curvature Omega_uv.',
  },
  {
    id: 'qrng',
    repoFolder: 'qrng',
    domain: 'QUANTUM',
    cqm2Module: 'zig/src/root.zig::cqm2_tsotchke_qrng_batch',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Toeplitz parity extractor gated by NIST SP 800-90B RCT & APT health checks.',
  },
  {
    id: 'quantum-computing',
    repoFolder: 'quantum-computing',
    domain: 'QUANTUM',
    cqm2Module: 'zig/src/root.zig::cqm2_hoggar_qgt_violated_hexagon_count',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Symplectic N-qubit Pauli W(2N-1,2) & Hoggar H(2) = 63 violated lines.',
  },
  {
    id: 'c-elegans-connectome-data',
    repoFolder: 'c-elegans-connectome-data',
    domain: 'NEURODYNAMICS',
    cqm2Module: 'src/brains/asmodenius.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Small-world sensory-interneuron-motor connectome motif prior & Enteric coupling.',
  },
  {
    id: 'hyperbolic-embeddings',
    repoFolder: 'Hyperbolic-Embeddings',
    domain: 'GEOMETRY',
    cqm2Module: 'src/brains/pantheon.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Poincaré ball phylogenetic distance metric d_H(u,v) for SpeciesLineage.',
  },
  {
    id: 'pinn',
    repoFolder: 'physics-informed-neural-network',
    domain: 'NUMERICS',
    cqm2Module: 'src/brains/metabolism.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Conservation-constrained metabolic flux projection satisfying sum(pools) == intake.',
  },
  {
    id: 'ml-quantum-workbench',
    repoFolder: 'machine-learning-quantum-workbench',
    domain: 'QUANTUM',
    cqm2Module: 'src/brains/pantheon.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: '512D FHRR Phasor Hyperdimensional Computing (HDC) + Modern Hopfield memory.',
  },
  {
    id: 'noether',
    repoFolder: 'noether',
    domain: 'BIOPHYSICS',
    cqm2Module: 'rust/src/lib.rs::cqm2_rust_audit_metabolic_conservation',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'First-Law symmetry invariant auditor via Kahan compensated summation.',
  },
  {
    id: 'runge-kutta',
    repoFolder: 'runge-kutta',
    domain: 'NUMERICS',
    cqm2Module: 'zig/src/root.zig::cqm2_schwarzschild_photon_deflection',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: '4th-order Runge-Kutta relativistic Binet geodesic integrator.',
  },
  {
    id: 'turing-morphogenesis',
    repoFolder: 'turing-morphogenesis',
    domain: 'BIOPHYSICS',
    cqm2Module: 'zig/src/root.zig::cqm2_reactive_skin_step',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Endocrine-coupled Gray-Scott + FitzHugh-Nagumo reactive chromatophore lattice.',
  },
  {
    id: 'lyapunov',
    repoFolder: 'lyapunov',
    domain: 'NEURODYNAMICS',
    cqm2Module: 'src/brains/asmodenius.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Hasani semi-implicit sLTC unconditional membrane stability & Lipschitz guard.',
  },
  {
    id: 'galois',
    repoFolder: 'galois',
    domain: 'QUANTUM',
    cqm2Module: 'src/quantum/xenolinguistics.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'GF(2^4) Reed-Solomon RS[15,11] self-healing 4D Zooid error correction.',
  },
  {
    id: 'riemann',
    repoFolder: 'riemann',
    domain: 'GEOMETRY',
    cqm2Module: 'src/render/shaders.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Lipschitz-bounded non-Euclidean 4D manifold metric warp & Kerr photon beaming.',
  },
  {
    id: 'boltzmann',
    repoFolder: 'boltzmann',
    domain: 'BIOPHYSICS',
    cqm2Module: 'src/brains/metabolism.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Q10 thermal enzyme rate scaling & dissipative entropy production tracking.',
  },
  {
    id: 'kuramoto-sync',
    repoFolder: 'kuramoto-sync',
    domain: 'NEURODYNAMICS',
    cqm2Module: 'src/brains/pantheon.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: '5-Caste Kuramoto phase-coherence order parameter R + Cholesky 5x5 DPP diversity.',
  },
  {
    id: 'hebbian-assemblies',
    repoFolder: 'hebbian-assemblies',
    domain: 'NEURODYNAMICS',
    cqm2Module: 'src/brains/glitchling.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Oja-stabilized 3-factor plasticity + Frey-Morris Synaptic Tagging & Capture.',
  },
  {
    id: 'active-inference-voi',
    repoFolder: 'active-inference-voi',
    domain: 'NEURODYNAMICS',
    cqm2Module: 'src/brains/asmodenius.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Frazier Knowledge-Gradient Value-of-Information (VOI) epistemic foraging.',
  },
  {
    id: 'antithetic-control',
    repoFolder: 'antithetic-control',
    domain: 'BIOPHYSICS',
    cqm2Module: 'src/brains/metabolism.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Briat-Gupta-Khammash Antithetic Integral Controller robust perfect adaptation.',
  },
  {
    id: 'casali-pci',
    repoFolder: 'casali-pci',
    domain: 'NEURODYNAMICS',
    cqm2Module: 'src/brains/asmodenius.ts',
    activeByDefault: true,
    fencedQuarantine: false,
    mathematicalContract: 'Perturbational Complexity Index (PCI) Lempel-Ziv spatiotemporal response proxy.',
  },
  {
    id: 'OBLITERATUS',
    repoFolder: 'OBLITERATUS',
    domain: 'FENCED_SAFETY',
    cqm2Module: 'FENCED_QUARANTINE_NEVER_EXECUTED',
    activeByDefault: false,
    fencedQuarantine: true,
    mathematicalContract: 'STRICT SAFETY FENCE: Uncensored/abliteration weights/tools are permanently quarantined and cannot be enabled.',
  },
]);

export class TsotchkeAblationController {
  private readonly enabled = new Map<string, boolean>();

  public constructor() {
    for (const p of TSOTCHKE_22_PILLARS) {
      this.enabled.set(p.id, p.fencedQuarantine ? false : p.activeByDefault);
    }
  }

  public isEnabled(pillarId: string): boolean {
    if (pillarId === 'OBLITERATUS') return false;
    return this.enabled.get(pillarId) ?? false;
  }

  public setPillarEnabled(pillarId: string, active: boolean): boolean {
    const descriptor = TSOTCHKE_22_PILLARS.find((p) => p.id === pillarId);
    if (!descriptor) return false;
    if (descriptor.fencedQuarantine) {
      // Hard safety invariant: OBLITERATUS can NEVER be enabled at runtime!
      this.enabled.set(pillarId, false);
      return false;
    }
    this.enabled.set(pillarId, Boolean(active));
    return this.enabled.get(pillarId)!;
  }

  public snapshotStatus(): Array<TsotchkePillarDescriptor & { currentlyEnabled: boolean }> {
    return TSOTCHKE_22_PILLARS.map((p) => ({
      ...p,
      currentlyEnabled: this.isEnabled(p.id),
    }));
  }
}
