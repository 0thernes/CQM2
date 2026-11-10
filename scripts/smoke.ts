#!/usr/bin/env bun
/**
 * CQM2 v2.1.0 End-to-End Local Server, `/api/v1/*`, OpenAPI, Security Header & Binary `.glb` Smoke Gate (`bun run smoke`).
 */
import { createCqm2Server } from '../src/server/main';

const srv = await createCqm2Server({ port: 0, dbPath: ':memory:', enableNpuDaemon: false, enableGoOscDaemon: false });

try {
  // 1. Health & Cross-Origin Isolation headers
  const healthRes = await fetch(`${srv.url}/api/v1/health`);
  if (healthRes.status !== 200) throw new Error(`/api/v1/health returned ${healthRes.status}`);
  if (healthRes.headers.get('cross-origin-opener-policy') !== 'same-origin') {
    throw new Error('Missing COOP same-origin header');
  }
  if (healthRes.headers.get('cross-origin-embedder-policy') !== 'require-corp') {
    throw new Error('Missing COEP require-corp header');
  }
  if (!healthRes.headers.get('x-request-id')) {
    throw new Error('Missing X-Request-Id header');
  }

  // 2. OpenAPI 3.1.0 endpoint
  const openApiRes = await fetch(`${srv.url}/api/v1/openapi.json`);
  if (openApiRes.status !== 200) throw new Error(`/api/v1/openapi.json returned ${openApiRes.status}`);

  // 3. Static HTML Observatory page & self-hosted WOFF2 font
  const indexRes = await fetch(`${srv.url}/`);
  if (indexRes.status !== 200) throw new Error(`/ returned ${indexRes.status}`);
  const indexHtml = await indexRes.text();
  if (!indexHtml.includes('Cosmogonic Quantum Mechalogodrom 2')) {
    throw new Error('index.html missing expected title');
  }
  const fontRes = await fetch(`${srv.url}/fonts/inter-latin-wght-normal.woff2`);
  if (fontRes.status !== 200) throw new Error(`/fonts/inter-latin-wght-normal.woff2 returned ${fontRes.status}`);

  // 4. Deterministic simulation step + First-Law conservation audit
  const stepRes = await fetch(`${srv.url}/api/v1/world/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps: 3, dtSec: 0.05 }),
  });
  if (stepRes.status !== 200) throw new Error(`/api/v1/world/step returned ${stepRes.status}`);
  const stepJson = (await stepRes.json()) as {
    ok: boolean;
    rustAudit: { valid: boolean; maxRelativeDrift: number };
  };
  if (!stepJson.ok || !stepJson.rustAudit.valid || stepJson.rustAudit.maxRelativeDrift >= 1e-12) {
    throw new Error(`Conservation check failed in smoke test: ${JSON.stringify(stepJson.rustAudit)}`);
  }

  // 5. Path-traversal & sensitive file protection
  const travRes = await fetch(`${srv.url}/%2e%2e/package.json`);
  if (travRes.status !== 403) throw new Error(`Expected 403 on path traversal, got ${travRes.status}`);

  // 6. Khronos glTF 2.0 & Binary `.glb` (`0x46546C67`) exporters
  const gltfRes = await fetch(`${srv.url}/api/v1/export/gltf`);
  if (gltfRes.status !== 200) throw new Error(`/api/v1/export/gltf returned ${gltfRes.status}`);
  const gltf = (await gltfRes.json()) as { asset: { version: string } };
  if (gltf.asset.version !== '2.0') throw new Error('Invalid glTF version');

  const glbRes = await fetch(`${srv.url}/api/v1/export/glb`);
  if (glbRes.status !== 200) throw new Error(`/api/v1/export/glb returned ${glbRes.status}`);
  const glbBuf = new DataView(await glbRes.arrayBuffer());
  if (glbBuf.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB magic bytes');

  console.log('[smoke] End-to-end HTTP v1 server, OpenAPI, COOP/COEP, fonts, simulation step, traversal guard, and glTF/GLB export PASSED.');
} finally {
  srv.stop();
}
