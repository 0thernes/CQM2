#!/usr/bin/env bun
/**
 * CQM2 Static Hygiene, Security, Secret, CSS & Version-Sync Linter (`bun run lint`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const errors: string[] = [];

function walkFiles(dir: string, exts: Set<string>, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'target' || entry === '.zig-cache' || entry === 'zig-out') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.has(extname(full).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

// 1. Version Sync Gate (`VERSION`, `package.json`, `CHANGELOG.md`)
const versionFile = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');

if (versionFile !== pkg.version) {
  errors.push(`Version mismatch: VERSION='${versionFile}' vs package.json='${pkg.version}'`);
}
if (!changelog.includes(`[${versionFile}]`)) {
  errors.push(`CHANGELOG.md missing section header '[${versionFile}]'`);
}

// 2. CSS Hygiene Gate: Zero `!important` in `src/styles/`
for (const cssFile of walkFiles(join(ROOT, 'src', 'styles'), new Set(['.css']))) {
  const txt = readFileSync(cssFile, 'utf8');
  // Strip block comments before checking so explanatory comments don't trigger false positives
  const codeOnly = txt.replace(/\/\*[\s\S]*?\*\//g, '');
  if (codeOnly.includes('!important')) {
    errors.push(`Forbidden '!important' rule in ${relative(ROOT, cssFile)}`);
  }
}

// 3. Code Security, Secret & Stub Hygiene Gate across `src/`, `python/`, `zig/`, `rust/`, `go/`
const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'OpenAI/Anthropic Key', regex: /\bsk-[A-Za-z0-9]{20,}/ },
  { name: 'GitHub PAT', regex: /\bgh[pousr]_[A-Za-z0-9]{24,}/ },
  { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'Private Key PEM', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const sourceDirs = ['src', 'python', 'zig/src', 'rust/src', 'go'];
for (const d of sourceDirs) {
  for (const file of walkFiles(join(ROOT, d), new Set(['.ts', '.js', '.py', '.zig', '.rs', '.go']))) {
    const rel = relative(ROOT, file);
    const txt = readFileSync(file, 'utf8');

    for (const sp of SECRET_PATTERNS) {
      if (sp.regex.test(txt)) {
        errors.push(`Potential hardcoded secret (${sp.name}) detected in ${rel}`);
      }
    }

    if (rel.startsWith('src')) {
      if (/\beval\s*\(/.test(txt) || /\bnew\s+Function\s*\(/.test(txt)) {
        errors.push(`Forbidden dynamic code execution (eval / new Function) in ${rel}`);
      }
      if (/\b(TODO|FIXME|XXX|HACK)\b/.test(txt)) {
        errors.push(`Unresolved stub marker (TODO/FIXME/XXX/HACK) in ${rel}`);
      }
    }
  }
}

// 4. OBLITERATUS Quarantine Fence Verification
const corpusTxt = readFileSync(join(ROOT, 'src', 'tsotchke', 'corpus.ts'), 'utf8');
if (!corpusTxt.includes("if (pillarId === 'OBLITERATUS') return false;")) {
  errors.push('Missing hard safety quarantine check for OBLITERATUS in src/tsotchke/corpus.ts');
}

if (errors.length > 0) {
  console.error('[lint] FAILED with issues:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

console.log(`[lint] All static hygiene, version-sync (${versionFile}), CSS, and security gates PASSED.`);
