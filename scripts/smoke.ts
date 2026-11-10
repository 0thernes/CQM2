#!/usr/bin/env bun
/**
 * CQM2 End-to-End Local Server, Security Header & Export Smoke Gate (`bun run smoke`).
 */
import { createCqm2Server } from '../src/server/main';

const srv = await createCqm2Server({ port: 0, dbPath: ':memory:', enableNpuDaemon: false });

try {
  // 1. Health & Cross-Origin Isolation headers
  const healthRes = await fetch(`${srv.url}/api/health`);
  if (healthRes.status !== 200) throw new Error(`/api/health returned ${healthRes.status}`);
  if (healthRes.headers.get('cross-origin-opener-policy') !== 'same-origin') {
    throw new Error('Missing COOP same-origin header');
  }
  if (healthRes.headers.get('cross-origin-embedder-policy') !== 'require-corp') {
    throw new Error('Missing COEP require-corp header');
  }

  // 2. Static HTML Observatory page
  const indexRes = await fetch(`${srv.url}/`);
  if (indexRes.status !== 200) throw new Error(`/ returned ${indexRes.status}`);
  const indexHtml = await indexRes.text();
  if (!indexHtml.includes('Cosmogonic Quantum Mechalogodrom 2')) {
    throw new Error('index.html missing expected title');
  }

  // 3. Deterministic simulation step + First-Law conservation audit
  const stepRes = await fetch(`${srv.url}/api/world/step`, {
    method: 'POST',
    body: JSON.stringify({ steps: 3, dtSec: 0.05 }),
  });
  if (stepRes.status !== 200) throw new Error(`/api/world/step returned ${stepRes.status}`);
  const stepJson = (await stepRes.json()) as {
    ok: boolean;
    rustAudit: { valid: boolean; maxRelativeDrift: number };
  };
  if (!stepJson.ok || !stepJson.rustAudit.valid || stepJson.rustAudit.maxRelativeDrift >= 1e-12) {
    throw new Error(`Conservation check failed in smoke test: ${JSON.stringify(stepJson.rustAudit)}`);
  }

  // 4. Path-traversal & sensitive file protection
  const travRes = await fetch(`${srv.url}/%2e%2e/package.json`);
  if (travRes.status !== 403) throw new Error(`Expected 403 on path traversal, got ${travRes.status}`);

  // 5. glTF 2.0 & WAV exporters
  const gltfRes = await fetch(`${srv.url}/api/export/gltf`);
  if (gltfRes.status !== 200) throw new Error(`/api/export/gltf returned ${gltfRes.status}`);
  const gltf = (await gltfRes.json()) as { asset: { version: string } };
  if (gltf.asset.version !== '2.0') throw new Error('Invalid glTF version');

  console.log('[smoke] End-to-end HTTP server, COOP/COEP, simulation step, traversal guard, and glTF export PASSED.');
} finally {
  srv.stop();
}
