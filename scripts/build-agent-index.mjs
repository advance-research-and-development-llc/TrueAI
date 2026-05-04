#!/usr/bin/env node
// scripts/build-agent-index.mjs
//
// Generate `.agent/index.json` — a compact, machine-readable index of
// the codebase that the Copilot cloud agent reads at the start of a
// session to skip the "where does X live?" rediscovery phase.
//
// What it captures (regex-based, zero deps so it runs in any session):
//   - exports[file]          : top-level exported symbols per .ts/.tsx
//   - kvKeys                 : every literal first-arg of useKV(...)
//   - routes                 : every <TabsTrigger value="..."> in App.tsx
//   - capacitorPlugins       : every registerPlugin(name, ...) in MainActivity
//   - nativeModules          : every file under src/lib/native/
//   - dispatchers            : every workflow that calls dispatch-fix-issue
//   - promptFragments        : every "## Fragment: `name`" header in PROMPTS.md
//
// The output is committed to the repo so an agent can read it
// without regenerating; .github/workflows/code-index.yml refreshes
// it on every push to main and copilot-setup-steps.yml regenerates
// it at session start as a safety net.
//
// Pure local-first — reads files from disk, writes to disk, no
// network, no third-party deps.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(REPO_ROOT, '.agent');
const OUT = resolve(OUT_DIR, 'index.json');

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'coverage', '.git', '.idea', '.vscode',
  'android/app/build', 'android/build', 'android/.gradle',
  'fastlane/report.xml', 'wiki', '.agent',
]);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(REPO_ROOT, full);
    if (SKIP_DIRS.has(name) || SKIP_DIRS.has(rel)) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

const allFiles = walk(REPO_ROOT);

// ---------- exports[file] for src/**/*.{ts,tsx} ---------------------------
const exports_ = {};
const tsFiles = allFiles.filter(p =>
  /\.(ts|tsx)$/.test(p) &&
  !/\.(test|spec)\.tsx?$/.test(p) &&
  relative(REPO_ROOT, p).startsWith('src/')
);
const exportRe = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const reexportRe = /^export\s*\{\s*([^}]+)\s*\}/gm;
for (const f of tsFiles) {
  const src = read(f);
  const names = new Set();
  for (const m of src.matchAll(exportRe)) names.add(m[1]);
  for (const m of src.matchAll(reexportRe)) {
    for (const piece of m[1].split(',')) {
      const sym = piece.trim().split(/\s+as\s+/i).pop().trim();
      if (sym && /^[A-Za-z_$][\w$]*$/.test(sym)) names.add(sym);
    }
  }
  if (names.size) exports_[relative(REPO_ROOT, f)] = [...names].sort();
}

// ---------- KV keys: useKV<...>('key', ...) -------------------------------
const kvKeys = new Set();
const kvRe = /useKV\s*(?:<[^>]+>)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
for (const f of tsFiles) {
  for (const m of read(f).matchAll(kvRe)) kvKeys.add(m[1]);
}

// ---------- Routes: TabsTrigger values in App.tsx -------------------------
const routes = new Set();
const appTsx = read(resolve(REPO_ROOT, 'src/App.tsx'));
for (const m of appTsx.matchAll(/<TabsTrigger\s+[^>]*value\s*=\s*["']([^"']+)["']/g)) {
  routes.add(m[1]);
}

// ---------- Capacitor plugin registrations --------------------------------
const capacitorPlugins = [];
const mainActivity = allFiles.find(p =>
  p.endsWith('MainActivity.java') || p.endsWith('MainActivity.kt')
);
if (mainActivity) {
  for (const m of read(mainActivity).matchAll(/registerPlugin\s*\(\s*([A-Za-z_][\w]*)\.class/g)) {
    capacitorPlugins.push(m[1]);
  }
}

// ---------- Native module index ------------------------------------------
const nativeModules = allFiles
  .filter(p => relative(REPO_ROOT, p).startsWith('src/lib/native/'))
  .filter(p => /\.ts$/.test(p) && !/\.(test|spec)\.ts$/.test(p))
  .map(p => relative(REPO_ROOT, p))
  .sort();

// ---------- Dispatchers: workflows that use dispatch-fix-issue -----------
const dispatchers = [];
const workflowFiles = allFiles
  .filter(p => relative(REPO_ROOT, p).startsWith('.github/workflows/'))
  .filter(p => /\.ya?ml$/.test(p));
for (const f of workflowFiles) {
  const src = read(f);
  if (src.includes('dispatch-fix-issue')) {
    dispatchers.push(relative(REPO_ROOT, f));
  }
}
dispatchers.sort();

// ---------- Prompt fragments ---------------------------------------------
const promptFragments = [];
const prompts = read(resolve(REPO_ROOT, '.github/copilot/PROMPTS.md'));
for (const m of prompts.matchAll(/^##\s+Fragment:\s+`([^`]+)`/gm)) {
  promptFragments.push(m[1]);
}

// ---------- Compose index -------------------------------------------------
const index = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  generator: 'scripts/build-agent-index.mjs',
  notes: [
    'Read this at the start of an agent session to skip rediscovery.',
    'Regenerated by .github/workflows/code-index.yml on push to main.',
    'Also regenerated at session start by copilot-setup-steps.yml.',
  ],
  counts: {
    files: allFiles.length,
    indexedTsFiles: tsFiles.length,
    exportedFiles: Object.keys(exports_).length,
    kvKeys: kvKeys.size,
    routes: routes.size,
    capacitorPlugins: capacitorPlugins.length,
    nativeModules: nativeModules.length,
    dispatchers: dispatchers.length,
    promptFragments: promptFragments.length,
  },
  routes: [...routes].sort(),
  kvKeys: [...kvKeys].sort(),
  capacitorPlugins: capacitorPlugins.sort(),
  nativeModules,
  dispatchers,
  promptFragments: promptFragments.sort(),
  exports: exports_,
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');
process.stdout.write(
  `Wrote ${relative(REPO_ROOT, OUT)} ` +
  `(${index.counts.exportedFiles} files, ${index.counts.kvKeys} kv keys, ` +
  `${index.counts.routes} routes, ${index.counts.dispatchers} dispatchers)\n`
);
