#!/usr/bin/env bun
/**
 * CQM2 v2.1.0 Production Frontend & Universal Static Site Builder (`bun run build`).
 * - Compiles `src/ui/workstation.ts` & `src/ui/wildbeyond-lab.ts` -> `site/assets/` (minified, zero sourcemaps).
 * - Copies `public/**` recursively into `site/` (7 semantic HTML pages, SIL OFL `.woff2` fonts, SVG icons).
 * - Generates SHA-256 content-hashed asset bundles (`workstation.<hash8>.js`, `wildbeyond-lab.<hash8>.js`, `tokens.<hash8>.css`),
 *   rewrites HTML references for immutable cache busting (`I-340`, `T-373`), and preserves unhashed aliases.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const PUBLIC_DIR = join(ROOT, 'public');
const SITE_DIR = join(ROOT, 'site');
const ASSETS_DIR = join(SITE_DIR, 'assets');

if (existsSync(SITE_DIR)) {
  rmSync(SITE_DIR, { recursive: true, force: true });
}
mkdirSync(ASSETS_DIR, { recursive: true });

// 1. Copy all static files from `public/` (`*.html`, `lab/*.html`, `fonts/*.woff2`, `favicon.svg`, `og-card.svg`, `robots.txt`, `sitemap.xml`)
cpSync(PUBLIC_DIR, SITE_DIR, { recursive: true });

// 2. Bundle TypeScript entrypoints (`workstation.ts`, `wildbeyond-lab.ts`, `alife-catalog.ts`)
const buildResult = await Bun.build({
  entrypoints: [
    join(ROOT, 'src', 'ui', 'workstation.ts'),
    join(ROOT, 'src', 'ui', 'wildbeyond-lab.ts'),
    join(ROOT, 'src', 'ui', 'alife-catalog.ts'),
  ],
  outdir: ASSETS_DIR,
  target: 'browser',
  format: 'esm',
  minify: true,
  sourcemap: 'none',
});

if (!buildResult.success) {
  console.error('[build] Bun.build failed:', buildResult.logs);
  process.exit(1);
}

copyFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), join(ASSETS_DIR, 'tokens.css'));

// 3. Emit content-hashed immutable copies (`<stem>.<hash8>.<ext>`) and rewrite HTML references
function emitHashedAsset(filename: string): string {
  const srcPath = join(ASSETS_DIR, filename);
  const buf = readFileSync(srcPath);
  const hash8 = createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const dot = filename.lastIndexOf('.');
  const hashedName = `${filename.slice(0, dot)}.${hash8}${filename.slice(dot)}`;
  writeFileSync(join(ASSETS_DIR, hashedName), buf);
  return hashedName;
}

const hashedWorkstation = emitHashedAsset('workstation.js');
const hashedWildBeyond = emitHashedAsset('wildbeyond-lab.js');
const hashedAlifeCatalog = emitHashedAsset('alife-catalog.js');
const hashedTokens = emitHashedAsset('tokens.css');

writeFileSync(
  join(ASSETS_DIR, 'manifest.json'),
  JSON.stringify(
    {
      'workstation.js': hashedWorkstation,
      'wildbeyond-lab.js': hashedWildBeyond,
      'alife-catalog.js': hashedAlifeCatalog,
      'tokens.css': hashedTokens,
    },
    null,
    2,
  ),
);

function walkHtmlFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkHtmlFiles(full, acc);
    else if (extname(full).toLowerCase() === '.html') acc.push(full);
  }
  return acc;
}

for (const htmlFile of walkHtmlFiles(SITE_DIR)) {
  const html = readFileSync(htmlFile, 'utf8')
    .replace(/assets\/tokens\.css/g, `assets/${hashedTokens}`)
    .replace(/assets\/workstation\.js/g, `assets/${hashedWorkstation}`)
    .replace(/assets\/wildbeyond-lab\.js/g, `assets/${hashedWildBeyond}`)
    .replace(/assets\/alife-catalog\.js/g, `assets/${hashedAlifeCatalog}`);
  writeFileSync(htmlFile, html);
}

writeFileSync(join(SITE_DIR, '.nojekyll'), '');

const jsBytes = statSync(join(ASSETS_DIR, hashedWorkstation)).size;
const labBytes = statSync(join(ASSETS_DIR, hashedWildBeyond)).size;
const cssBytes = statSync(join(ASSETS_DIR, hashedTokens)).size;
console.log(
  `[build] Built site/ cleanly: ${hashedWorkstation}=${(jsBytes / 1024).toFixed(1)} KB, ${hashedWildBeyond}=${(labBytes / 1024).toFixed(1)} KB, ${hashedTokens}=${(cssBytes / 1024).toFixed(1)} KB`,
);
