#!/usr/bin/env bun
/**
 * CQM2 Production Frontend & Universal Static Site Builder (`bun run build`).
 * Compiles `src/ui/workstation.ts` -> `site/assets/workstation.js` (minified, zero sourcemaps in prod),
 * copies `tokens.css`, `favicon.svg`, and all 5 semantic HTML pages into `site/`.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SITE_DIR = join(ROOT, 'site');
const ASSETS_DIR = join(SITE_DIR, 'assets');

if (existsSync(SITE_DIR)) {
  rmSync(SITE_DIR, { recursive: true, force: true });
}
mkdirSync(ASSETS_DIR, { recursive: true });

const buildResult = await Bun.build({
  entrypoints: [join(ROOT, 'src', 'ui', 'workstation.ts')],
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
copyFileSync(join(ROOT, 'favicon.svg'), join(SITE_DIR, 'favicon.svg'));

const HTML_PAGES = ['index.html', 'docs.html', 'specs.html', 'glossary.html', 'downloads.html', 'robots.txt', 'sitemap.xml'];
for (const page of HTML_PAGES) {
  copyFileSync(join(ROOT, page), join(SITE_DIR, page));
}

writeFileSync(join(SITE_DIR, '.nojekyll'), '');

const jsBytes = statSync(join(ASSETS_DIR, 'workstation.js')).size;
const cssBytes = statSync(join(ASSETS_DIR, 'tokens.css')).size;
console.log(
  `[build] Built site/ cleanly: workstation.js=${(jsBytes / 1024).toFixed(1)} KB, tokens.css=${(cssBytes / 1024).toFixed(1)} KB`,
);
