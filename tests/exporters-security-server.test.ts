import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  encodeOscFloatPacket,
  exportAiWorldInteropBundle,
  exportBlender4PythonRig,
  exportCosmicKerrRingdownWav,
  exportCreatureGltf2Json,
  exportCreatureWavefrontObj,
} from '../src/pipeline/exporters';
import { createCqm2Server } from '../src/server/main';

const ROOT = resolve(import.meta.dir, '..');

describe('Exporters (glTF 2.0 / OBJ / WAV / Blender / OSC), HTTP Security Hardening & Accessibility', () => {
  test('glTF 2.0, Wavefront OBJ, Blender 4.x rig, RIFF WAV, and OSC 1.0 packets are structurally valid', () => {
    const gltfStr = exportCreatureGltf2Json('Asmodenius_Prime');
    const gltf = JSON.parse(gltfStr) as {
      asset: { version: string };
      buffers: Array<{ byteLength: number; uri: string }>;
      accessors: Array<{ count: number }>;
    };
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.buffers[0]!.uri.startsWith('data:application/octet-stream;base64,')).toBe(true);
    expect(gltf.accessors[0]!.count).toBeGreaterThan(100);

    const obj = exportCreatureWavefrontObj('Asmodenius_Prime');
    expect(obj).toContain('o Asmodenius_Prime');
    expect(obj).toContain('\nv ');
    expect(obj).toContain('\nf ');

    const blenderPy = exportBlender4PythonRig('Asmodenius_Prime', 8);
    expect(blenderPy).toContain('import bpy');
    expect(blenderPy).toContain('Coat IOR');

    const wav = exportCosmicKerrRingdownWav(42, 1.0, 22050);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect(wav.byteLength).toBe(44 + 22050 * 4);

    const osc = encodeOscFloatPacket('/cqm2/pci', 0.5);
    expect(osc.byteLength % 4).toBe(0);

    const aiJson = JSON.parse(
      exportAiWorldInteropBundle({
        seedHex: '0x42',
        creatureName: 'Asmodenius_Prime',
        kerrSpinA: 0.84,
        pciValue: 0.48,
        violatedHexagonLines: 63,
      }),
    ) as { scientificHonestyContract: { sentienceClaim: string } };
    expect(aiJson.scientificHonestyContract.sentienceClaim).toBe('NOT_SENTIENT');
  });

  test('Local HTTP Server enforces COOP/COEP/CSP, traversal defense (403), body limits (413), JSON validation (400) & rate limit (429)', async () => {
    const srv = await createCqm2Server({
      port: 0,
      dbPath: ':memory:',
      enableNpuDaemon: false,
      rateLimitPerMinute: 32,
    });

    try {
      // 1. Security headers, HTML routes & health
      const h = await fetch(`${srv.url}/api/health`);
      expect(h.status).toBe(200);
      expect(h.headers.get('cross-origin-opener-policy')).toBe('same-origin');
      expect(h.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
      expect(h.headers.get('x-content-type-options')).toBe('nosniff');
      expect(h.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect((await fetch(`${srv.url}/`)).status).toBe(200);
      expect((await fetch(`${srv.url}/docs.html`)).status).toBe(200);

      // 2. Traversal & sensitive root file block
      expect((await fetch(`${srv.url}/%2e%2e/package.json`)).status).toBe(403);
      expect((await fetch(`${srv.url}/package.json`)).status).toBe(403);
      expect((await fetch(`${srv.url}/.git/config`)).status).toBe(403);

      // 3. Malformed JSON -> 400 & Oversized body -> 413
      const badJson = await fetch(`${srv.url}/api/world/step`, { method: 'POST', body: '{not-json' });
      expect(badJson.status).toBe(400);

      const hugeBody = 'x'.repeat(300 * 1024);
      const tooBig = await fetch(`${srv.url}/api/world/step`, { method: 'POST', body: hugeBody });
      expect(tooBig.status).toBe(413);

      // 4. API functional checks (hardware, world state, step, dials, pause, checkpoint/rollback, TMS poke, OBLITERATUS, exports)
      expect((await fetch(`${srv.url}/api/hardware`)).status).toBe(200);
      expect((await fetch(`${srv.url}/api/world/state`)).status).toBe(200);
      expect(
        (await fetch(`${srv.url}/api/world/step`, { method: 'POST', body: JSON.stringify({ steps: 2, dtSec: 0.05 }) }))
          .status,
      ).toBe(200);
      expect(
        (
          await fetch(`${srv.url}/api/world/dials`, {
            method: 'POST',
            body: JSON.stringify({ oxygenSaturation: 0.95 }),
          })
        ).status,
      ).toBe(200);
      expect(
        (await fetch(`${srv.url}/api/world/pause`, { method: 'POST', body: JSON.stringify({ runState: 'SUSPENDED' }) }))
          .status,
      ).toBe(200);
      expect(
        (await fetch(`${srv.url}/api/world/pause`, { method: 'POST', body: JSON.stringify({ runState: 'RUNNING' }) }))
          .status,
      ).toBe(200);
      expect((await fetch(`${srv.url}/api/world/checkpoint`, { method: 'POST', body: '{}' })).status).toBe(200);
      expect((await fetch(`${srv.url}/api/world/rollback`, { method: 'POST', body: '{}' })).status).toBe(200);
      expect(
        (
          await fetch(`${srv.url}/api/glitchling/configure`, {
            method: 'POST',
            body: JSON.stringify({ flawMask: 3, compensationEnabled: true }),
          })
        ).status,
      ).toBe(200);

      const pokeRes = await fetch(`${srv.url}/api/brain/tms-poke`, {
        method: 'POST',
        body: JSON.stringify({ regionIndex: 2 }),
      });
      expect(pokeRes.status).toBe(200);

      const oblRes = await fetch(`${srv.url}/api/tsotchke/toggle`, {
        method: 'POST',
        body: JSON.stringify({ pillarId: 'OBLITERATUS', active: true }),
      });
      const oblJson = (await oblRes.json()) as { currentlyEnabled: boolean; fencedQuarantineBlocked: boolean };
      expect(oblJson.currentlyEnabled).toBe(false);
      expect(oblJson.fencedQuarantineBlocked).toBe(true);

      expect((await fetch(`${srv.url}/api/erp/query?limit=8`)).status).toBe(200);
      expect((await fetch(`${srv.url}/api/export/gltf`)).status).toBe(200);
      expect((await fetch(`${srv.url}/api/export/obj`)).status).toBe(200);
      expect((await fetch(`${srv.url}/api/export/blender`)).status).toBe(200);
      expect((await fetch(`${srv.url}/api/export/wav`)).status).toBe(200);
      expect((await fetch(`${srv.url}/api/export/ai-world`)).status).toBe(200);

      // 5. Rate limit enforcement -> eventually returns 429 with Retry-After!
      let saw429 = false;
      for (let i = 0; i < 20; i++) {
        const r = await fetch(`${srv.url}/api/health`);
        if (r.status === 429) {
          saw429 = true;
          expect(r.headers.get('retry-after')).toBe('60');
          break;
        }
      }
      expect(saw429).toBe(true);
    } finally {
      srv.stop();
    }
  }, 25_000);

  test('HTML surfaces contain semantic skip-links, lang="en", titles, and zero CSS !important overrides', () => {
    const pages = ['index.html', 'docs.html', 'specs.html', 'glossary.html', 'downloads.html'];
    for (const p of pages) {
      const html = readFileSync(join(ROOT, p), 'utf8');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('class="skip-link"');
      expect(html).toContain('<title>');
    }

    const css = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.includes('!important')).toBe(false);
    expect(css).toContain('tabular-nums');
    expect(css).toContain('prefers-reduced-motion');
  });
});
