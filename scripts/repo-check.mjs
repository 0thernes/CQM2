#!/usr/bin/env node
// Check one repository against GITHUB-REPO-STANDARD.md. Read-only: it changes nothing.
//
//   repo-check.mjs [path-to-repo] [--remote] [--pre-release] [--json] [--help]
//
//   path-to-repo   one folder, the root of the repository (default: the current folder)
//   --remote       also ask GitHub (through the gh CLI) about the About panel, visibility, CodeQL and the latest release
//   --pre-release  the project has not had its first release yet: do not count missing tags and releases
//   --json         print the result as JSON
//   --help, -h     print the usage line and exit 2
//
// What it checks: that each of the twenty items exists and has been filled in, that the index covers docs/,
// that no Markdown file under docs/ is an unfilled template, that a coverage badge fed by docs/badges/coverage.json
// has that file (JSON with a filled-in "message"), that the declared version, the changelog and the latest tag
// agree, and that docs/REPORT.md was graded by inspect.mjs grade --write, was not changed since, and is not graded
// NOT SHIPPABLE on the commit that carries the release tag of its version. A required file that git ignores is not
// in the repository, so it counts as missing. A badge fed by docs/badges/inspection.json has to say what the report
// says. On a public repository (the report's profile holds PUB, or with --remote GitHub says so) no file under docs/
// may hold diligence rows, which rules out a diligence report and a trigger register, and the report's Profile line
// shows product tags only.
// What it does not check: whether what those files say is true. An OK line is not evidence of that.
//
// Placeholders. In the README and in a policy file kept outside docs/, a leftover placeholder counts wherever it
// stands, code included, because their templates put the commands to fill in inside code. In a Markdown file under
// docs/, a placeholder inside a code span or a fenced code block does not count. A document that has to show
// placeholder text as its own content names it in a comment, one comment per text:
//   <!-- repo-check: literal {{NAME}} -->
// The texts a file declares literal are printed on the line of its item and listed in the JSON output.
//
// Exit codes: 0 nothing missing, 1 something missing or unfilled, 2 usage error,
//             3 --remote was asked for but gh left a question about the repository unanswered.
// For tests only: the environment variable REPO_CHECK_GH may hold a JSON array, the program and leading arguments
// to run in place of gh. The output says when it was used, and a value that is not such an array is a usage error.
// This file imports only Node built-ins, so it can be copied into a project's own scripts folder.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeSync } from 'node:fs';
import { join, resolve } from 'node:path';

const USAGE = 'Usage: repo-check.mjs [path-to-repo] [--remote] [--pre-release] [--json] [--help]';
const FLAGS = ['--remote', '--json', '--pre-release'];
const argv = process.argv.slice(2);
// Writes to a pipe are asynchronous on Linux and macOS, and process.exit() does not wait for them ("A note on process
// I/O" in the Node.js documentation): a message written just before an exit goes out synchronously, and a check that
// ends normally sets process.exitCode, so its whole report reaches a pipe.
const stop = (code, message) => { writeSync(2, `${message}\n`); process.exit(code); };
if (argv.includes('--help') || argv.includes('-h')) stop(2, USAGE);
const unknownFlags = argv.filter((arg) => arg.startsWith('--') && !FLAGS.includes(arg));
if (unknownFlags.length) stop(2, `Unknown option(s): ${unknownFlags.join(', ')}. Known: ${FLAGS.join(', ')}, --help\n${USAGE}`);
const paths = argv.filter((arg) => !arg.startsWith('--'));
if (paths.some((arg) => arg.startsWith('-'))) stop(2, `Unknown option(s): ${paths.filter((arg) => arg.startsWith('-')).join(', ')}. Write a folder whose name starts with a dash as ./-name\n${USAGE}`);
if (paths.length > 1) stop(2, `One repository at a time, but ${paths.length} paths were given: ${paths.join(', ')}\n${USAGE}`);
// An empty path is what an unset shell variable leaves behind. It is not a quiet way to say "the current folder".
if (paths[0]?.trim() === '') stop(2, `The path to the repository is empty (an unset variable?). Leave it out to check the current folder.\n${USAGE}`);
const repo = resolve(paths[0] ?? '.');
const remote = argv.includes('--remote');
const preRelease = argv.includes('--pre-release');
const asJson = argv.includes('--json');
if (!existsSync(repo) || !statSync(repo).isDirectory()) stop(2, `Not a directory: ${repo}`);

// Test hook: REPO_CHECK_GH may hold a JSON array, the program and leading arguments to run in place of gh.
// A value that cannot be used is an error: falling back to the real gh would reach GitHub from a test by mistake.
const standIn = process.env.REPO_CHECK_GH ?? '';
const GH = (() => {
  if (standIn === '') return ['gh'];
  let value = null;
  try { value = JSON.parse(standIn); } catch { /* reported below */ }
  if (Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === 'string' && part !== '')) return value;
  return stop(2, 'REPO_CHECK_GH is set but is not a JSON array of strings (the program and leading arguments to run in place of gh). Unset it to use gh.');
})();
const ghStandIn = standIn !== '';

const has = (path) => existsSync(join(repo, path));
const isDir = (path) => { try { return statSync(join(repo, path)).isDirectory(); } catch { return false; } };
// A byte-order mark at the start of a file (some Windows editors write one) is not part of its text.
const withoutMark = (text) => (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
const read = (path) => { try { return withoutMark(readFileSync(join(repo, path), 'utf8')); } catch { return null; } };
const firstOf = (...paths) => paths.find(has) ?? null;
const healthFile = (name) => firstOf(`.github/${name}`, name, `docs/${name}`);
const run = (program, args) => {
  // A command that fails, is not installed or takes over 30 seconds counts as "no answer".
  try { return execFileSync(program, args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim(); } catch { return null; }
};
// The mark that opens or closes a fenced code block on this line, or null. A line of backticks that goes on to
// hold another backtick is a code span, not a fence. nested: also see a fence that stands inside a list item or a
// block quote, after any run of spaces and ">" marks.
const fenceMark = (line, nested) => {
  const found = line.replace(/\r$/, '').match(nested ? /^[\s>]*(`{3,}|~{3,})(.*)$/ : /^\s{0,3}(`{3,}|~{3,})(.*)$/);
  return found && !(found[1][0] === '`' && found[2].includes('`')) ? found[1] : null;
};
const closes = (mark, fence) => mark !== null && mark[0] === fence[0] && mark.length >= fence.length;
// The text without its comments. "<!--" that a document shows as code, in a code span or in a fenced block, is
// text and not the start of a comment, so it does not hide what follows it.
const stripComments = (text) => {
  let out = '';
  let fence = null;
  let inComment = false;
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const newline = index < lines.length - 1 ? '\n' : '';
    let rest = line;
    if (inComment) {
      const end = rest.indexOf('-->');
      if (end === -1) return;
      inComment = false;
      rest = rest.slice(end + 3);
    } else {
      const mark = fenceMark(line, true);
      if (fence !== null || mark !== null) {
        if (fence === null) fence = mark;
        else if (closes(mark, fence)) fence = null;
        out += line + newline;
        return;
      }
    }
    for (;;) {
      const next = rest.search(/`|<!--/);
      if (next === -1) break;
      out += rest.slice(0, next);
      rest = rest.slice(next);
      if (rest[0] === '`') {
        // A code span: from a run of backticks to the next run of the same length on the line.
        const ticks = rest.match(/^`+/)[0];
        const close = [...rest.slice(ticks.length).matchAll(/`+/g)].find((found) => found[0].length === ticks.length);
        const length = close ? ticks.length + close.index + ticks.length : ticks.length;
        out += rest.slice(0, length);
        rest = rest.slice(length);
      } else {
        const end = rest.indexOf('-->', 4);
        if (end === -1) { inComment = true; return; }
        rest = rest.slice(end + 3);
      }
    }
    out += rest + newline;
  });
  return out;
};
const outsideFences = (text, nested = false) => {
  let fence = null;
  return text.split(/\r?\n/).filter((line) => {
    const mark = fenceMark(line, nested);
    if (fence === null ? mark !== null : closes(mark, fence)) { fence = fence === null ? mark : null; return false; }
    return fence === null;
  }).join('\n');
};
const filesUnder = (dir) => {
  if (!isDir(dir)) return [];
  return readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
};

// Template placeholders are written {{LIKE_THIS}}. Three older forms from the agent kit's README template are caught too.
const CURLY = /\{\{[A-Z0-9][A-Z0-9 _./-]*\}\}/;
const PLACEHOLDER = new RegExp(`${CURLY.source}|OWNER\\/REPO|PROJECT NAME|ONE-LINE TAGLINE`);
const WHOLE_PLACEHOLDER = new RegExp(`^(?:${PLACEHOLDER.source})$`);
// A document that has to show placeholder text as its own content (a prompt-template project, a gh example with
// OWNER/REPO) names each such text in a comment of its own: <!-- repo-check: literal {{NAME}} -->
// Only a comment that names one whole placeholder counts, so a comment cannot switch the check off by naming "{{".
const literalsIn = (text) => [...new Set([...text.matchAll(/<!--\s*repo-check:\s*literal\s+([^\n]*?)\s*-->/g)].map((match) => match[1]).filter((literal) => WHOLE_PLACEHOLDER.test(literal)))];
const withoutLiterals = (text) => literalsIn(text).reduce((body, literal) => body.split(literal).join('\u0000'), stripComments(text));
// A comment does not show in the rendered page, so what a file declares literal is said out loud: on the line of
// its item and in the JSON output.
const literals = [];
const literalNote = (path, text) => {
  const texts = literalsIn(text);
  if (texts.length === 0) return '';
  literals.push({ file: path, texts });
  return `${texts.length} ${texts.length === 1 ? 'text' : 'texts'} declared literal: ${texts.join(', ')}`;
};
// The first placeholder left in the README or in a policy file kept outside docs/, code blocks and code spans
// included: the templates put the commands to fill in (install, run, test) inside code blocks.
const unfilled = (text) => withoutLiterals(text).match(PLACEHOLDER)?.[0] ?? null;
// The first placeholder left in a Markdown file under docs/: not inside a fenced code block or a code span, where
// a document shows text instead of saying it.
const unfilledProse = (text, pattern) => outsideFences(withoutLiterals(text), true).replace(/(`+)[^\n]*?\1/g, '').match(pattern)?.[0] ?? null;
const leftover = (path, text) => (path.startsWith('docs/') ? unfilledProse(text, PLACEHOLDER) : unfilled(text));
const some = (list) => list.slice(0, 5).join(', ') + (list.length > 5 ? ` and ${list.length - 5} more` : '');
// Whether git can be run at all, and whether this folder is the root of a repository it can read.
const gitRuns = run('git', ['--version']) !== null;
const isGitRepo = gitRuns && run('git', ['rev-parse', '--show-prefix']) === '';
// Why git gave no answer. The three cases need different words, and only the last one is about the folder.
const notGit = !gitRuns ? 'git could not be run here (is it installed and on the PATH?)'
  : has('.git') ? 'git could not read this repository (run "git status" in it to see why)'
    : 'not the root of a git repository';
// A file that git ignores is in this folder but not in the repository, so a reader of the repository never sees it.
// A tracked file is never reported as ignored. The user's own global ignore file is left out of the question.
const ignoredByGit = (path) => isGitRepo && path !== null && run('git', ['-c', 'core.excludesFile=', 'check-ignore', '-q', '--', path]) !== null;
const notHeld = (path) => `${path} is in this folder, but git ignores it, so the repository does not hold it; take it out of the ignore file and commit it`;
function fileState(path, minChars = 40) {
  const text = path ? read(path) : null;
  if (text === null) return { ok: false, detail: null };
  if (ignoredByGit(path)) return { ok: false, detail: notHeld(path) };
  const note = literalNote(path, text);
  const body = stripComments(text).trim();
  if (body.length < minChars) return { ok: false, detail: `${path} is empty or nearly empty` };
  const placeholder = leftover(path, text);
  if (placeholder) return { ok: false, detail: `${path} still contains the template placeholder ${placeholder}` };
  return { ok: true, detail: note ? `${path} (${note})` : path };
}

const items = [];
const extras = [];
const add = (list, item, status, detail) => list.push({ item, status, detail });
const present = (list, item, ok, yes, no) => add(list, item, ok ? 'ok' : 'missing', ok ? yes : no);
const fileItem = (item, path, absentText, minChars) => {
  const state = fileState(path, minChars);
  present(items, item, state.ok, state.detail, state.detail ?? absentText);
};

// ---- gather ----
const readmePath = firstOf('README.md', 'README', 'readme.md');
const readme = readmePath ? read(readmePath) ?? '' : '';
const prose = outsideFences(stripComments(readme));
// Headings as a reader sees them: "## Install" (indented up to three spaces), a line underlined with = or -, and <h2>Install</h2>.
const headings = [
  ...[...prose.matchAll(/^ {0,3}#{1,4}[ \t]+(.+?)[ \t#]*$/gm)].map((match) => match[1]),
  ...[...prose.matchAll(/^([^\s#>|`-][^\n]*)\r?\n(?:=+|-{2,})[ \t]*$/gm)].map((match) => match[1]),
  ...[...prose.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map((match) => match[1].replace(/<[^>]+>/g, '')),
].map((heading) => heading.replace(/[*_`]/g, '').trim().toLowerCase().replace(/^[^a-z]+/, ''));
const hasHeading = (pattern) => headings.some((heading) => pattern.test(heading));
const readmePlaceholder = unfilled(readme);
const readmeNote = readmePath ? literalNote(readmePath, readme) : '';

const workflowFiles = isDir('.github/workflows') ? readdirSync(join(repo, '.github/workflows')).filter((name) => /\.ya?ml$/i.test(name)) : [];
const workflowTexts = workflowFiles.map((name) => read(`.github/workflows/${name}`) ?? '');
const realWorkflows = workflowTexts.filter((text) => /^jobs:\s*(?:#.*)?$/m.test(text) && /^\s+(runs-on|uses):/m.test(text));
const workflowText = workflowTexts.join('\n');

const shallow = isGitRepo && run('git', ['rev-parse', '--is-shallow-repository']) === 'true';
const tagList = isGitRepo ? run('git', ['-c', 'versionsort.suffix=-', 'tag', '--list', 'v[0-9]*', '--sort=-v:refname']) : null;
const tagNames = (tagList ?? '').split(/\r?\n/).filter(Boolean);
const latestTag = tagNames.find((tag) => /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) ?? null;

// A version as written in a manifest or a VERSION file. A leading "v" is not part of it.
const semver = (value) => {
  const text = typeof value === 'string' ? value.trim().replace(/^v(?=\d)/, '') : '';
  return /^\d+\.\d+\.\d+/.test(text) ? text : null;
};
const jsonField = (path, pick) => { try { return pick(JSON.parse(read(path) ?? 'null') ?? {}); } catch { return null; } };
const badJson = ['package.json', 'src-tauri/tauri.conf.json'].filter((path) => {
  const text = read(path);
  if (text === null) return false;
  try { JSON.parse(text); return false; } catch { return true; }
});
const tomlField = (path, table, key) => {
  let inTable = false;
  for (const line of (read(path) ?? '').split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (header) { inTable = header[1].trim() === table; continue; }
    const found = inTable ? line.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`)) : null;
    if (found) return found[1];
  }
  return null;
};
const declared = [
  ['package.json', semver(jsonField('package.json', (json) => json.version))],
  ['VERSION', semver(read('VERSION'))],
  ['pyproject.toml', semver(tomlField('pyproject.toml', 'project', 'version') ?? tomlField('pyproject.toml', 'tool.poetry', 'version'))],
  ['Cargo.toml', semver(tomlField('Cargo.toml', 'package', 'version'))],
  ['CMakeLists.txt', semver(read('CMakeLists.txt')?.match(/project\s*\([^)]*?VERSION\s+(\d+\.\d+\.\d+)/is)?.[1])],
  ['src-tauri/tauri.conf.json', semver(jsonField('src-tauri/tauri.conf.json', (json) => json.version ?? json.package?.version))],
  ['src-tauri/Cargo.toml', semver(tomlField('src-tauri/Cargo.toml', 'package', 'version'))],
].filter(([, version]) => version);
const declaredVersion = declared[0]?.[1] ?? null;
const declaredDisagree = declared.some(([, version]) => version !== declaredVersion);
const manifestLicense = jsonField('package.json', (json) => (typeof json.license === 'string' ? json.license : null))
  ?? tomlField('Cargo.toml', 'package', 'license') ?? tomlField('pyproject.toml', 'project', 'license');

const changelog = read('CHANGELOG.md');
const versionCore = (version) => version.split(/[-+]/)[0].split('.').map(Number);
// The order of two pre-releases of one version, as semver.org item 11 gives it: a release outranks its own
// pre-releases, identifiers are compared left to right, numbers as numbers and below words, a shorter list is lower.
const preOrder = (a, b) => {
  const [x, y] = [a, b].map((version) => version.split('+')[0].split(/-(.*)/s)[1] ?? null);
  if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
  const [p, q] = [x.split('.'), y.split('.')];
  for (let i = 0; i < Math.max(p.length, q.length); i += 1) {
    if (p[i] === undefined) return -1;
    if (q[i] === undefined) return 1;
    const [n, m] = [/^\d+$/.test(p[i]), /^\d+$/.test(q[i])];
    if (n && m && Number(p[i]) !== Number(q[i])) return Number(p[i]) - Number(q[i]);
    if (n !== m) return n ? -1 : 1;
    if (!n && p[i] !== q[i]) return p[i] < q[i] ? -1 : 1;
  }
  return 0;
};
const versionOrder = (a, b) => {
  const [x, y] = [versionCore(a), versionCore(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return preOrder(a, b);
};
// Version headings are read where a reader sees them: not in comments and not in code blocks.
const changelogVersion = [...outsideFences(stripComments(changelog ?? '')).matchAll(/^##\s*\[?(?:version\s+)?v?(\d+\.\d+\.\d+[0-9A-Za-z.+-]*)\]?/gim)].map((match) => match[1]).sort(versionOrder).at(-1) ?? null;

const gh = (...args) => run(GH[0], [...GH.slice(1), ...args]);
let github = null;
let defaultSetup = null;
if (remote && isGitRepo) {
  const raw = gh('repo', 'view', '--json', 'description,homepageUrl,repositoryTopics,visibility,latestRelease');
  try { github = raw ? JSON.parse(raw) : null; } catch { github = null; }
  if (github) defaultSetup = gh('api', 'repos/{owner}/{repo}/code-scanning/default-setup', '--jq', '.state');
}
const notAsked = 'not checked (run with --remote)';
const noAnswer = 'not checked (gh could not read this repository)';
// With --remote, an item that GitHub gave no answer for is still printed as SKIPPED, and the run exits 3, so that
// an unanswered question cannot pass for a finished check. This holds what was left unanswered.
let unanswered = remote && !github ? 'gh could not read this repository (is gh installed and signed in, and does the repository have a GitHub remote?)' : null;

// ---- the twenty items, in the order of GITHUB-REPO-STANDARD.md ----
if (!readmePath) add(items, 'Readme', 'missing', 'no README.md at the root');
else if (readmePlaceholder) add(items, 'Readme', 'missing', `${readmePath} still contains the template placeholder ${readmePlaceholder}`);
else present(items, 'Readme', prose.trim().length >= 300, `${readmePath} (${prose.trim().length} characters of prose${readmeNote ? `; ${readmeNote}` : ''})`, `${readmePath} has under 300 characters of prose`);

if (!remote) add(items, 'About', 'skipped', notAsked);
else if (!github) add(items, 'About', 'skipped', noAnswer);
else {
  const topics = (github.repositoryTopics ?? []).length;
  const gaps = [!github.description && 'description', !github.homepageUrl && 'website', topics === 0 && 'topics'].filter(Boolean);
  present(items, 'About', gaps.length === 0, `description, website and ${topics} topic(s) set`, `missing: ${gaps.join(', ')}`);
}

fileItem('Summary', has('docs/SUMMARY.md') ? 'docs/SUMMARY.md' : null, 'no docs/SUMMARY.md', 200);

const healthFiles = [['Code of conduct', 'CODE_OF_CONDUCT.md'], ['Contributing', 'CONTRIBUTING.md'], ['Security policy', 'SECURITY.md']].map(([item, name]) => [item, name, healthFile(name)]);
// The files under docs/ that a clean checkout would hold: tracked files, and untracked files that git does not
// ignore. Without git, every file on disk. Litter that an operating system drops into folders is never a document.
const LITTER = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const knownDocs = isGitRepo ? run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'docs']) : null;
const docsFiles = (knownDocs !== null ? [...new Set(knownDocs.split('\0'))].filter((path) => path && has(path)) : filesUnder('docs')).filter((path) => !LITTER.has(path.split('/').pop())).sort();
const isMarkdown = (path) => /\.(md|markdown|mdx)$/i.test(path);
const indexText = read('docs/INDEX.md');
if (indexText === null) add(items, 'Index', 'missing', 'no docs/INDEX.md');
else {
  // A document counts as listed when the index names its path (as a link, a first table cell or code text),
  // or names a folder that contains it, written with a trailing slash ("research/").
  const visible = stripComments(indexText);
  const clean = (name) => name.trim().replace(/^`|`$/g, '').replace(/^\.\//, '').replace(/^docs\//, '');
  const decoded = (name) => { try { return decodeURIComponent(name); } catch { return name; } };
  // A link target, written plainly (it may hold one level of round brackets) or in angle brackets, without its
  // #anchor and with %20 and the like decoded.
  const linked = [...visible.matchAll(/\]\((?:<([^>\n]*)>|((?:[^()\s]|\([^()\s]*\))+))/g)].map((match) => clean(decoded((match[1] ?? match[2]).split('#')[0])));
  const firstCells = [...visible.matchAll(/^\|[ \t]*([^|\[\s][^|]*?)[ \t]*\|/gm)].map((match) => clean(match[1]));
  const spans = [...visible.matchAll(/`([^`\n]+)`/g)].map((match) => clean(match[1]));
  const named = new Set([...linked, ...firstCells, ...spans]);
  // A folder that git tracks as one entry (a submodule) is listed by its own name with a trailing slash.
  const listed = (path) => {
    const parts = path.split('/').slice(1);
    return named.has(parts.join('/')) || parts.slice(0, -1).some((_, depth) => named.has(`${parts.slice(0, depth + 1).join('/')}/`)) || (isDir(path) && named.has(`${parts.join('/')}/`));
  };
  // docs/badges/ holds generated badge data, so it is not expected in the index.
  const unlisted = docsFiles.filter((path) => path !== 'docs/INDEX.md' && !path.startsWith('docs/badges/') && !listed(path));
  // A row or link that names a Markdown file which is not there. Names in running text (code spans) are not checked.
  // A plain first cell counts only when it is a file name and nothing else ("Start with RUNBOOK.md" is a phrase),
  // and one that names a file at the repository root is a description of that file, not a broken entry.
  const stale = [...new Set([...linked.filter((name) => /^[\w./ ()-]+\.md$/i.test(name)), ...firstCells.filter((name) => /^[\w./-]+\.md$/i.test(name))])]
    .filter((name) => !name.startsWith('..') && !has(`docs/${name}`) && !(firstCells.includes(name) && !linked.includes(name) && has(name)));
  // Every other Markdown file under docs/ (a runbook, a risk register, a decision record) is checked for a leftover
  // placeholder too. Those were not necessarily made from a template, so only the {{LIKE_THIS}} form is looked for.
  // The files that have an item of their own are reported there.
  const ownItem = new Set(['docs/INDEX.md', 'docs/SUMMARY.md', 'docs/GLOSSARY.md', ...healthFiles.map(([, , path]) => path)]);
  const notes = [];
  const noted = (path, text) => { const note = literalNote(path, text); if (note) notes.push(`${path}: ${note}`); return text; };
  noted('docs/INDEX.md', indexText);
  const leftovers = docsFiles.filter((path) => isMarkdown(path) && !ownItem.has(path))
    .map((path) => [path, unfilledProse(noted(path, read(path) ?? ''), CURLY)])
    .filter(([, found]) => found !== null).map(([path, found]) => `${path} (${found})`);
  const placeholder = leftover('docs/INDEX.md', indexText);
  if (placeholder) add(items, 'Index', 'missing', `docs/INDEX.md still contains the template placeholder ${placeholder}`);
  else {
    present(items, 'Index', unlisted.length === 0 && stale.length === 0 && leftovers.length === 0, ['docs/INDEX.md lists every file or folder under docs/, and no Markdown file there is an unfilled template', ...notes].join('; '), [
      unlisted.length ? `not listed in docs/INDEX.md: ${some(unlisted)}` : '',
      stale.length ? `listed but not found: ${stale.join(', ')}` : '',
      leftovers.length ? `still ${leftovers.length === 1 ? 'contains' : 'contain'} a template placeholder: ${some(leftovers)}` : '',
    ].filter(Boolean).join('; '));
  }
}

fileItem('Glossary', has('docs/GLOSSARY.md') ? 'docs/GLOSSARY.md' : null, 'no docs/GLOSSARY.md', 80);

// The result block that inspect.mjs grade --write puts into the report holds the lines "Grade       A" and
// "Rows        <digest>", and "Readiness   <verdict>" when the report holds diligence rows. The digest is the first
// 16 hexadecimal characters of a SHA-256. What is hashed, joined with a newline: the report without its result
// block, reduced to its row lines, its Profile and Version lines and every line that opens or closes a comment or a
// code block, in file order, each reduced to its wording (emphasis marks and backslashes removed, runs of spaces
// made one space, the spaces around each pipe removed); then the line "Grade <grade>"; then, when the result has
// one, the line "Readiness <verdict>". It is recomputed here, so a report that was changed after it was graded, or
// whose result was typed by hand, does not pass. A Markdown formatter that pads the tables or writes emphasis with
// underscores does not change it. It catches accidents and casual edits; someone who recomputes it by hand can
// still forge it. inspect.mjs holds the same rule; change both together.
const report = read('docs/REPORT.md');
const reportVersion = report?.match(/^- Version:[ \t]*v?(\S+)/m)?.[1] ?? null;
const resultBlock = report?.match(/<!-- result:start -->([\s\S]*?)<!-- result:end -->/)?.[1] ?? null;
const reportGrade = resultBlock?.match(/^Grade[ \t]+(A\+|A|B|C|D|NOT SHIPPABLE)[ \t]*$/m)?.[1] ?? null;
const reportReadiness = resultBlock?.match(/^Readiness[ \t]+(READY|GAPS|EXPOSED)\b/m)?.[1] ?? null;
const ROW_LINE = /^[\s>]*\|?[\s*_`~]*([ITD]-\d{3})[\s*_`~]*\|/i;
const MARK_LINE = /<!--|-->|^[\s>]*(?:`{3,}|~{3,})/;
const digestLine = (line) => line.replace(/[*_\\]/g, '').replace(/\s+/g, ' ').trim().replace(/ ?\| ?/g, '|');
const digestNow = report === null ? null : createHash('sha256').update([
  ...report.replace(/<!-- result:start -->[\s\S]*?<!-- result:end -->/, '').split(/\r?\n/).filter((line) => ROW_LINE.test(line) || /^- (Profile|Version):/.test(line) || MARK_LINE.test(line)).map(digestLine),
  `Grade ${reportGrade}`,
  ...(reportReadiness ? [`Readiness ${reportReadiness}`] : []),
].join('\n')).digest('hex').slice(0, 16);
const digestThen = resultBlock?.match(/^Rows[ \t]+([0-9a-f]{16})\b/m)?.[1] ?? null;
// A public repository gets nothing from the diligence module: no diligence rows in its report, no diligence report
// and no trigger register. The repository is public when the report's own profile holds PUB, or when GitHub says so
// (--remote). A line counts as a diligence row when it is written the way inspect.mjs writes one: the ID, then a
// severity and a stage (a report), or a stage and a colon (a register).
const DILIGENCE_LINE = /^[\s>]*\|?[\s*_`~]*D-\d{3}[\s*_`~]*\|[\s*_`~]*(?:P[0-3][ \t]+(?:NOW|SEAM|TRIGGER)\b|(?:SEAM|TRIGGER):)/im;
const diligenceFiles = docsFiles.filter((path) => isMarkdown(path) && DILIGENCE_LINE.test(read(path) ?? ''));
const reportProfile = (report?.match(/^- Profile:[ \t]*(.*)$/m)?.[1] ?? '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
const publicByGitHub = github?.visibility === 'PUBLIC';
const isPublic = publicByGitHub || reportProfile.includes('PUB');
const whyPublic = publicByGitHub ? 'GitHub says this repository is public' : 'the profile of docs/REPORT.md holds PUB';
const companyTagsShown = ['REV', 'TEAM', 'FUND', 'ENT', 'US'].filter((tag) => reportProfile.includes(tag));
// A release goes out when its tag is put on a commit, so the rule is about the commit being checked: a report graded
// NOT SHIPPABLE fails on the commit that carries the release tag of its version. On any other commit it is an honest
// finding, to be fixed before the next release, and it passes with a line that says so. Otherwise a project could
// never push again after finding a failing gate in a version it had already released.
const versionTag = `v${reportVersion}`;
const headTags = isGitRepo ? (run('git', ['tag', '--points-at', 'HEAD']) ?? '').split(/\r?\n/).filter(Boolean) : [];
const releasedHere = headTags.includes(versionTag);
const releasedEarlier = !releasedHere && tagNames.includes(versionTag);
// Whether this commit carries a release tag can be told only where every tag can be seen: not in a folder without
// git, and not in a shallow clone, which holds only the tags of the commits it fetched.
const tagsUnseen = !isGitRepo ? `${gitRuns && !has('.git') ? 'this folder is ' : ''}${notGit}, so release tags cannot be seen here${gitRuns && !has('.git') ? '; run the check in the repository' : ''}`
  : tagList === null ? 'git did not list the tags'
    : shallow ? 'this is a shallow clone, which does not hold every tag; fetch the full history and the tags to check' : null;
const gradeAgain = 'run inspect.mjs grade with --write';
const gradedFor = `graded ${reportGrade}${reportVersion ? ` for version ${reportVersion}` : ''}`;
if (report === null) add(items, 'Report', 'missing', 'no docs/REPORT.md (create it with inspect.mjs init)');
else if (ignoredByGit('docs/REPORT.md')) add(items, 'Report', 'missing', notHeld('docs/REPORT.md'));
else if (isPublic && diligenceFiles.length) add(items, 'Report', 'missing', `${some(diligenceFiles)} ${diligenceFiles.length === 1 ? 'holds' : 'hold'} diligence rows, and ${whyPublic}; a public repository gets nothing from the diligence module: split a report with inspect.mjs init --from (once with --no-diligence, once with --only-diligence --scope product and an --out path outside the repository), and move a trigger register to the private company folder`);
else if (publicByGitHub && !reportProfile.includes('PUB')) add(items, 'Report', 'missing', `GitHub says this repository is public, but the profile of docs/REPORT.md (${reportProfile.join(', ') || 'none'}) has no PUB tag, so the rows for a public repository were not graded; write the report again with PUB in the profile (inspect.mjs init --no-diligence --from docs/REPORT.md)`);
else if (isPublic && companyTagsShown.length) add(items, 'Report', 'missing', `the Profile line of docs/REPORT.md holds ${companyTagsShown.join(', ')}, and ${whyPublic}; that line is public and no row of the report depends on a company tag: write a refreshed report, which leaves them out (inspect.mjs init --no-diligence --from docs/REPORT.md)`);
else if (!reportGrade && /^Readiness[ \t]+\S/m.test(resultBlock ?? '')) add(items, 'Report', 'missing', `the result in docs/REPORT.md is a diligence result with no Grade line; docs/REPORT.md is the product report (${gradeAgain}, without --only-diligence)`);
else if (!reportGrade) add(items, 'Report', 'missing', `docs/REPORT.md has not been graded (${gradeAgain})`);
else if (declaredVersion && reportVersion !== declaredVersion) add(items, 'Report', 'missing', `docs/REPORT.md is for version ${reportVersion ?? 'unknown'}; the project declares ${declaredVersion}`);
else if (digestThen === null) add(items, 'Report', 'missing', `the result in docs/REPORT.md has no Rows line, so it was typed by hand or written by an older inspect.mjs; ${gradeAgain}`);
else if (digestThen !== digestNow) add(items, 'Report', 'missing', `docs/REPORT.md was changed after it was graded, or its result was typed by hand; ${gradeAgain} again`);
else if (reportGrade === 'NOT SHIPPABLE' && releasedHere) add(items, 'Report', 'missing', `docs/REPORT.md is graded NOT SHIPPABLE for version ${reportVersion}, and this commit carries the release tag ${versionTag}; a release does not go out while a gate fails: fix the gate and grade again`);
else if (reportGrade === 'NOT SHIPPABLE' && tagsUnseen) add(items, 'Report', 'skipped', `docs/REPORT.md is ${gradedFor}, and whether this commit carries the release tag ${versionTag} was not checked: ${tagsUnseen}`);
else if (reportGrade === 'NOT SHIPPABLE' && releasedEarlier) add(items, 'Report', 'ok', `docs/REPORT.md, ${gradedFor}; ${versionTag} was released from an earlier commit, and the commit that gets the next release tag will not pass with this grade`);
else add(items, 'Report', 'ok', `docs/REPORT.md, ${gradedFor}${reportGrade === 'NOT SHIPPABLE' ? `; the commit that gets the release tag ${versionTag} will not pass with this grade` : ''}`);
// A badge address may hold the address of the file it reads in percent-encoded form (url=https%3A%2F%2F...), so
// the README is read both as written and with such codes turned back into their characters.
const proseDecoded = `${prose}\n${prose.replace(/%([2-7][0-9A-Fa-f])/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))}`;
// A self-inspection badge that reads docs/badges/inspection.json shows what that file says, so the file has to say
// what the report says. inspect.mjs grade --badge writes "A+ (points 97%, tests 98%)" or "not shippable".
// A path written as code in a sentence that explains it (`docs/badges/inspection.json`) shows no badge: only an
// address in a link, an image or a bare URL points at the file.
const badgeFile = /docs\/badges\/inspection\.json/i.test(proseDecoded.replace(/(`+)[^\n]*?\1/g, '')) ? 'docs/badges/inspection.json' : null;
const badgeMessage = badgeFile ? jsonField(badgeFile, (json) => (typeof json.message === 'string' && json.message.trim() ? json.message.trim() : null)) : null;
const badgeGrade = !badgeMessage ? null : /^not shippable\b/i.test(badgeMessage) ? 'NOT SHIPPABLE' : badgeMessage.match(/^(A\+|A|B|C|D)(?![A-Za-z+])/)?.[1] ?? null;
if (!(/docs\/REPORT\.md/i.test(prose) || hasHeading(/^(self-)?inspection\b/))) add(items, 'Inspection', 'missing', 'README has no Inspection section or link to docs/REPORT.md');
else if (badgeFile && has(badgeFile) && ignoredByGit(badgeFile)) add(items, 'Inspection', 'missing', notHeld(badgeFile));
else if (badgeFile && !badgeMessage) add(items, 'Inspection', 'missing', `the README points at ${badgeFile}, which ${has(badgeFile) ? 'is not a badge file (JSON with a filled-in "message")' : 'does not exist'}; write it with inspect.mjs grade --write --badge ${badgeFile}, or take the badge out of the README`);
else if (badgeFile && reportGrade && badgeGrade !== reportGrade) add(items, 'Inspection', 'missing', `${badgeFile} says "${badgeMessage}" but docs/REPORT.md is graded ${reportGrade}; grade again with --write --badge ${badgeFile}`);
else add(items, 'Inspection', 'ok', `README shows or links the inspection result${badgeFile && reportGrade ? `, and ${badgeFile} agrees with the report` : ''}`);

const licensePath = firstOf('LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE');
const licenseText = licensePath ? read(licensePath) ?? '' : '';
const licenseKind = /Permission is hereby granted, free of charge/i.test(licenseText) ? 'MIT'
  : /Apache License[\s\S]{0,120}Version 2\.0/i.test(licenseText) ? 'APACHE'
    : /GNU AFFERO GENERAL PUBLIC LICENSE/i.test(licenseText) ? 'AGPL'
      : /GNU LESSER GENERAL PUBLIC LICENSE/i.test(licenseText) ? 'LGPL'
        : /GNU GENERAL PUBLIC LICENSE/i.test(licenseText) ? 'GPL'
          : /Redistribution and use in source and binary forms/i.test(licenseText) ? 'BSD'
            : /Mozilla Public License/i.test(licenseText) ? 'MPL'
              : /all rights reserved/i.test(licenseText) ? 'PROPRIETARY' : null;
// The manifest's license field as a list of identifiers: "(MIT OR Apache-2.0)" gives MIT and APACHE-2.0.
const manifestIds = !manifestLicense ? [] : /^(unlicensed|proprietary|see license)/i.test(manifestLicense.trim()) ? ['PROPRIETARY']
  : manifestLicense.toUpperCase().split(/[^A-Z0-9.+-]+/).filter((id) => id && id !== 'OR' && id !== 'AND' && id !== 'WITH').map((id) => id.replace(/^LICENSEREF-/, ''));
const licenseClash = Boolean(licenseKind) && manifestIds.length > 0 && !manifestIds.some((id) => id.startsWith(licenseKind));
if (!licensePath || licenseText.trim().length === 0) add(items, 'License', 'missing', 'no LICENSE file at the root');
else if (ignoredByGit(licensePath)) add(items, 'License', 'missing', notHeld(licensePath));
else if (CURLY.test(licenseText)) add(items, 'License', 'missing', `${licensePath} still contains the template placeholder ${licenseText.match(CURLY)[0]}`);
else if (licenseText.trim().length < 40) add(items, 'License', 'missing', `${licensePath} is nearly empty (under 40 characters), so it grants or reserves nothing a reader can rely on`);
else if (!hasHeading(/^licen[sc]e\b/)) add(items, 'License', 'missing', 'README has no License section');
else if (licenseClash) add(items, 'License', 'missing', `the manifest says "${manifestLicense}" but ${licensePath} reads as ${licenseKind}`);
else add(items, 'License', 'ok', `${licensePath} and a License section in the README${manifestLicense ? `; manifest says "${manifestLicense}"` : ''}`);

for (const [item, name, path] of healthFiles) fileItem(item, path, `no ${name} in .github/, the root or docs/`, 120);

present(items, 'Tests', hasHeading(/^(tests?|testing|running (the )?tests)\b/), 'README has a Tests section', 'README has no Tests section');
const coverageShown =/coverage[^\n]{0,80}\d{1,3}(?:\.\d+)?\s?%|\d{1,3}(?:\.\d+)?\s?%[^\n]{0,40}coverage|badges\/coverage\.json|codecov\.io|coveralls\.io/i.test(proseDecoded);
// A badge that reads docs/badges/coverage.json shows nothing until the test run has written that file.
const coverageFile = /docs\/badges\/coverage\.json/i.test(proseDecoded) ? 'docs/badges/coverage.json' : null;
const coverageBadge = coverageFile ? jsonField(coverageFile, (json) => (typeof json.message === 'string' && json.message.trim() && !CURLY.test(json.message) ? json.message : null)) : null;
if (coverageFile && has(coverageFile) && ignoredByGit(coverageFile)) add(items, 'Coverage', 'missing', notHeld(coverageFile));
else if (coverageFile && !has(coverageFile)) add(items, 'Coverage', 'missing', `the README points at ${coverageFile}, which does not exist; let the test run write it, or take the badge or the mention of the file out of the README`);
else if (coverageFile && !coverageBadge) add(items, 'Coverage', 'missing', `${coverageFile} is not a badge file (JSON with a filled-in "message"); let the test run write it, or take the badge or the mention of the file out of the README`);
else present(items, 'Coverage', coverageShown, 'README shows a coverage figure or badge', 'README shows no coverage figure or coverage badge');

const tagsExcused = latestTag ? null : preRelease ? 'no release yet (--pre-release)' : shallow ? 'shallow clone without tags; fetch full history to check' : null;
const versions = { declared: declaredVersion, changelog: changelogVersion, tag: latestTag ? latestTag.replace(/^v/, '') : null };
const versionText = `declared ${declaredVersion ? `${declaredVersion} in ${declared[0][0]}` : 'nowhere'}, changelog ${changelogVersion ?? 'none'}, tag ${versions.tag ?? 'none'}`;
if (badJson.length) add(items, 'Version', 'missing', `${badJson.join(' and ')} ${badJson.length === 1 ? 'is' : 'are'} not valid JSON, so the version in ${badJson.length === 1 ? 'it' : 'them'} cannot be read`);
else if (!declaredVersion) add(items, 'Version', 'missing', `no version in package.json, VERSION, pyproject.toml, Cargo.toml, CMakeLists.txt or the Tauri config (${versionText})`);
else if (declaredDisagree) add(items, 'Version', 'missing', `the version is declared in more than one place and they disagree: ${declared.map(([file, version]) => `${file} ${version}`).join(', ')}`);
else if (!changelogVersion && tagsExcused) add(items, 'Version', 'skipped', `${tagsExcused}; ${versionText}`);
else if (!changelogVersion) add(items, 'Version', 'missing', `the changelog has no entry for a version (${versionText})`);
else if (changelogVersion !== declaredVersion || (versions.tag && versions.tag !== declaredVersion)) add(items, 'Version', 'missing', `versions disagree: ${versionText}`);
else add(items, 'Version', 'ok', `one version everywhere: ${versionText}`);

// The badge GitHub serves for CodeQL default setup also sits under actions/workflows. It shows the code scan, not the
// project's own CI, so it does not count here.
const ciBadge = /actions\/workflows\/(?!github-code-scanning\/)[^)\s]+\/badge\.svg|shields\.io\/github\/actions\/workflow\/status/i.test(prose);
present(items, 'CI', realWorkflows.length > 0 && ciBadge, `${realWorkflows.length} workflow(s) with jobs, and a status badge in the README`, realWorkflows.length === 0 ? 'no workflow with jobs in .github/workflows' : 'a workflow exists, but the README has no CI status badge');

if (/^\s*-?\s*uses:\s*github\/codeql-action\/(init|analyze)@/m.test(workflowText)) add(items, 'CodeQL', 'ok', 'a workflow runs CodeQL');
// Where CodeQL does not support the project's language, another scanner that sends its results to code scanning counts.
else if (/^\s*-?\s*uses:\s*github\/codeql-action\/upload-sarif@/m.test(workflowText)) add(items, 'CodeQL', 'ok', 'a workflow uploads another scanner\'s results to code scanning');
else if (defaultSetup === 'configured') add(items, 'CodeQL', 'ok', 'CodeQL default setup is switched on');
else if (github?.visibility === 'PUBLIC' && defaultSetup === null) {
  unanswered = 'gh could not read the code scanning settings of this repository (may the signed-in account read them?)';
  add(items, 'CodeQL', 'skipped', 'no CodeQL workflow, and gh could not read the default setup state; look under Settings, Advanced Security');
} else if (github?.visibility === 'PUBLIC') add(items, 'CodeQL', 'missing', 'public repository with neither CodeQL default setup nor a CodeQL workflow');
else if (github?.visibility) add(items, 'CodeQL', 'skipped', 'not available for this private repository; run another static analyzer in CI');
else if (github) {
  unanswered = 'gh did not say whether this repository is public or private, so the CodeQL item could not be checked';
  add(items, 'CodeQL', 'skipped', 'no CodeQL workflow found, and gh did not say whether the repository is public; CodeQL is needed on a public repository');
} else add(items, 'CodeQL', 'skipped', `no CodeQL workflow found; needed only on public repositories (${remote ? 'visibility unknown' : 'run with --remote to check'})`);

if (latestTag) add(items, 'Tags', 'ok', `latest release tag ${latestTag}`);
else if (tagsExcused) add(items, 'Tags', 'skipped', tagsExcused);
else add(items, 'Tags', 'missing', isGitRepo ? 'no tag of the form vX.Y.Z (before the first release, run with --pre-release)' : notGit);

if (!remote) add(items, 'Releases', 'skipped', notAsked);
else if (!github) add(items, 'Releases', 'skipped', noAnswer);
else if (!latestTag && tagsExcused) add(items, 'Releases', 'skipped', tagsExcused);
else {
  const releaseTag = github.latestRelease?.tagName ?? null;
  present(items, 'Releases', Boolean(releaseTag) && releaseTag === latestTag, `latest release ${releaseTag} matches the latest tag`, releaseTag ? `latest release ${releaseTag} does not match latest tag ${latestTag ?? 'none'}` : 'no GitHub Release');
}

present(items, 'Install', hasHeading(/^(how to )?(install(ation|ing)?|quick ?start|getting started|set ?up)\b/), 'README has an Install section', 'README has no Install or Quickstart section');
present(items, 'Users', hasHeading(/^users\b|^who (is )?(it|this)('?s| is)? for|^audience\b/), 'README has a Users section', 'README has no Users section (who it is for, supported platforms, help)');

// ---- related hygiene, reported but not counted in the twenty ----
present(extras, 'Changelog', changelog !== null && changelog.trim().length > 0, 'CHANGELOG.md', 'no CHANGELOG.md');
const ignoreText = read('.gitignore') ?? '';
const envIgnored = isGitRepo ? run('git', ['-c', 'core.excludesFile=', 'check-ignore', '-q', '.env']) !== null : /^\/?(?:\*\*\/)?\.env\*?[ \t]*$/m.test(ignoreText) && !/^!\/?\.env[ \t]*$/m.test(ignoreText);
// Committed environment files, by name only: a file named .env or .env.<something>, in any folder. Files that
// exist to be copied (.env.example and the like) are expected, and a file such as docs/.env.md is a document.
const envFiles = isGitRepo ? (run('git', ['ls-files', '--', '.env', '.env.*', '**/.env', '**/.env.*']) ?? '').split(/\r?\n/).filter((name) => /^\.env(\..+)?$/.test(name.split('/').pop()) && !/\.(example|sample|template|dist|defaults|md)$/i.test(name)) : [];
present(extras, 'Ignore file', envIgnored && envFiles.length === 0, isGitRepo ? '.env is ignored and no environment file is committed' : '.gitignore ignores .env (not the root of a git repository, so committed files were not looked at)', envFiles.length ? `${envFiles.join(', ')} ${envFiles.length === 1 ? 'is' : 'are'} committed to the repository` : '.gitignore is missing or does not ignore .env');
present(extras, 'Line endings', /^\*\s+(?:.*\s)?text(?:=auto)?(?:\s|$)/m.test(read('.gitattributes') ?? ''), '.gitattributes normalizes text files', has('.gitattributes') ? '.gitattributes has no "* text=auto" rule' : 'no .gitattributes (line endings are not normalized)');
present(extras, 'Issue templates', isDir('.github/ISSUE_TEMPLATE') && readdirSync(join(repo, '.github/ISSUE_TEMPLATE')).some((name) => /\.(ya?ml|md)$/i.test(name) && name.toLowerCase() !== 'config.yml'), '.github/ISSUE_TEMPLATE', 'no issue templates');

// ---- report ----
const count = (status) => items.filter((entry) => entry.status === status).length;
const summary = { present: count('ok'), missing: count('missing'), notChecked: count('skipped'), total: items.length };
const remoteFailed = unanswered !== null;
const standInNote = remote && ghStandIn ? 'gh was replaced by REPO_CHECK_GH; the remote items were not read from GitHub' : null;
if (asJson) {
  console.log(JSON.stringify({ repo, summary, remoteFailed, ghStandIn: standInNote !== null, versions, literals, items, extras }, null, 2));
} else {
  const label = { ok: 'OK', missing: 'MISSING', skipped: 'SKIPPED' };
  const print = (list) => { for (const entry of list) console.log(`  ${entry.item.padEnd(16)} ${label[entry.status].padEnd(8)} ${entry.detail}`); };
  console.log(`Repository: ${repo}\n`);
  print(items);
  console.log('\nRelated hygiene (not counted):');
  print(extras);
  console.log(`\n${summary.present} of ${summary.total} present, ${summary.missing} missing or unfilled, ${summary.notChecked} not checked`);
  console.log('This confirms that items exist and are filled in. It does not confirm that what they say is true.');
}
if (standInNote) console.error(`${standInNote}.`);
if (remoteFailed) console.error(`Remote checks were requested but ${unanswered}.`);
process.exitCode = summary.missing > 0 ? 1 : remoteFailed ? 3 : 0;
