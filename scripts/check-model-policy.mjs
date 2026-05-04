#!/usr/bin/env node
// scripts/check-model-policy.mjs
//
// Validator + lookup helper for `.github/copilot/MODEL_POLICY.yml`.
//
// Pure-stdlib YAML reader (only the subset we need: top-level keys,
// nested 2-space objects, scalar values, no anchors / multi-line
// folded blocks except simple `|`). Avoids adding `js-yaml` to
// dependencies for a single config file.
//
// Modes
//   default              validate the file structure and exit 0
//                        if every entry has the expected fields.
//   --self-test          run an in-memory parser/lookup test
//                        against a fixture string.
//   --check <model-id> --risk <class> [--agent-surface]
//                        exit 0 if the listed model is allowed to
//                        land a PR with the given risk class /
//                        agent-surface attr; exit 1 otherwise.
//                        Prints a one-line verdict.
//
// Used by future workflow extensions (auto-merge.yml) but works
// standalone today via `npm run check:model-policy`.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const POLICY = path.join(REPO_ROOT, '.github', 'copilot', 'MODEL_POLICY.yml');

const RISK_ORDER = ['trivial', 'low', 'medium', 'high'];
const VALID_RISKS = new Set(RISK_ORDER);

/** Minimal YAML subset parser (top-level + 2-space nested). */
function parseYaml(text) {
  const lines = text.split('\n');
  const root = {};
  // Stack of (indent, container).
  const stack = [{ indent: -1, container: root }];
  let pendingBlockKey = null; // for `|` literal scalars
  let pendingBlockOwner = null;
  let pendingBlockIndent = 0;
  let pendingBlockLines = [];

  function flushPending() {
    if (pendingBlockKey != null) {
      pendingBlockOwner[pendingBlockKey] = pendingBlockLines
        .map((l) => l.slice(pendingBlockIndent))
        .join('\n')
        .replace(/\n+$/, '');
      pendingBlockKey = null;
      pendingBlockOwner = null;
      pendingBlockLines = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim().startsWith('#') || line.trim() === '') {
      if (pendingBlockKey != null) pendingBlockLines.push('');
      continue;
    }

    const indentMatch = line.match(/^( *)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const content = line.slice(indent);

    if (pendingBlockKey != null) {
      if (indent >= pendingBlockIndent) {
        pendingBlockLines.push(line);
        continue;
      } else {
        flushPending();
      }
    }

    while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();

    const m = content.match(/^([A-Za-z0-9_.\-]+):(?:\s+(.*))?$/);
    if (!m) {
      // Skip unrecognised lines silently — only the structured
      // shape matters for this minimal parser.
      continue;
    }
    const key = m[1];
    let value = m[2];
    const owner = stack.at(-1).container;

    if (value == null || value === '') {
      // Could be a nested object container OR a `|` literal block
      // started on a later line. We open an object container here
      // and let nested lines populate it; if the next non-blank
      // line is `|`, we'll re-open as a block scalar.
      const child = {};
      owner[key] = child;
      stack.push({ indent, container: child });
    } else if (value === '|') {
      pendingBlockKey = key;
      pendingBlockOwner = owner;
      pendingBlockIndent = indent + 2;
      pendingBlockLines = [];
    } else {
      // Strip optional surrounding quotes.
      value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      // Coerce booleans / numbers.
      if (value === 'true') owner[key] = true;
      else if (value === 'false') owner[key] = false;
      else if (/^-?\d+$/.test(value)) owner[key] = Number(value);
      else owner[key] = value;
    }
  }
  flushPending();
  return root;
}

function validate(policy) {
  const errors = [];
  if (policy.policy_version !== 1) {
    errors.push(`policy_version must be 1 (got ${policy.policy_version}).`);
  }
  if (!policy.default || typeof policy.default !== 'object') {
    errors.push('missing top-level `default:` block.');
  } else {
    if (!VALID_RISKS.has(policy.default.max_risk)) {
      errors.push(`default.max_risk must be one of ${[...VALID_RISKS].join(', ')}; got '${policy.default.max_risk}'.`);
    }
    if (typeof policy.default.allow_agent_surface !== 'boolean') {
      errors.push('default.allow_agent_surface must be a boolean.');
    }
  }
  const models = policy.models || {};
  for (const [id, def] of Object.entries(models)) {
    if (typeof def !== 'object' || def == null) {
      errors.push(`models.${id}: must be a mapping.`);
      continue;
    }
    if (!VALID_RISKS.has(def.max_risk)) {
      errors.push(`models.${id}.max_risk: must be one of ${[...VALID_RISKS].join(', ')}; got '${def.max_risk}'.`);
    }
    if (typeof def.allow_agent_surface !== 'boolean') {
      errors.push(`models.${id}.allow_agent_surface: must be a boolean.`);
    }
  }
  return { ok: errors.length === 0, errors, modelCount: Object.keys(models).length };
}

function lookup(policy, modelId) {
  const models = policy.models || {};
  if (Object.prototype.hasOwnProperty.call(models, modelId)) {
    return { source: 'explicit', ...models[modelId] };
  }
  return { source: 'default', ...policy.default };
}

function isAllowed(entry, requestedRisk, agentSurface) {
  if (!VALID_RISKS.has(requestedRisk)) {
    return { allowed: false, reason: `unknown requested risk class '${requestedRisk}'.` };
  }
  const reqIdx = RISK_ORDER.indexOf(requestedRisk);
  const capIdx = RISK_ORDER.indexOf(entry.max_risk);
  if (reqIdx > capIdx) {
    return {
      allowed: false,
      reason: `requested risk:${requestedRisk} exceeds cap risk:${entry.max_risk}.`,
    };
  }
  if (agentSurface && !entry.allow_agent_surface) {
    return {
      allowed: false,
      reason: 'requested agent-surface change but allow_agent_surface=false for this model.',
    };
  }
  return { allowed: true, reason: 'within cap.' };
}

function selfTest() {
  const fixture = `
policy_version: 1
default:
  max_risk: low
  allow_agent_surface: false
models:
  claude-opus-4.7:
    max_risk: high
    allow_agent_surface: true
  claude-haiku-4.5:
    max_risk: low
    allow_agent_surface: false
`.trim();
  const parsed = parseYaml(fixture);
  const v = validate(parsed);
  const checks = [
    ['parses version', parsed.policy_version === 1],
    ['parses default.max_risk', parsed.default.max_risk === 'low'],
    ['parses default.allow_agent_surface', parsed.default.allow_agent_surface === false],
    ['parses opus max_risk', parsed.models['claude-opus-4.7'].max_risk === 'high'],
    ['parses opus allow_agent_surface', parsed.models['claude-opus-4.7'].allow_agent_surface === true],
    ['validate ok', v.ok === true],
    ['lookup explicit', lookup(parsed, 'claude-opus-4.7').source === 'explicit'],
    ['lookup default', lookup(parsed, 'unknown-model').source === 'default'],
    [
      'opus allowed: high agent-surface',
      isAllowed(lookup(parsed, 'claude-opus-4.7'), 'high', true).allowed === true,
    ],
    [
      'haiku denied: high',
      isAllowed(lookup(parsed, 'claude-haiku-4.5'), 'high', false).allowed === false,
    ],
    [
      'haiku denied: agent-surface',
      isAllowed(lookup(parsed, 'claude-haiku-4.5'), 'low', true).allowed === false,
    ],
    [
      'unknown model denied: high',
      isAllowed(lookup(parsed, 'mystery-model'), 'high', false).allowed === false,
    ],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'ok' : 'FAIL'}  ${name}`);
    if (!pass) ok = false;
  }
  return ok;
}

function readPolicy() {
  if (!fs.existsSync(POLICY)) {
    console.error(`error: ${POLICY} does not exist.`);
    process.exit(2);
  }
  return parseYaml(fs.readFileSync(POLICY, 'utf8'));
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }

  const policy = readPolicy();

  if (argv.includes('--check')) {
    const i = argv.indexOf('--check');
    const modelId = argv[i + 1];
    const ri = argv.indexOf('--risk');
    const risk = ri !== -1 ? argv[ri + 1] : null;
    const agentSurface = argv.includes('--agent-surface');
    if (!modelId || !risk) {
      console.error('usage: check-model-policy.mjs --check <model-id> --risk <class> [--agent-surface]');
      process.exit(2);
    }
    const v = validate(policy);
    if (!v.ok) {
      console.error('policy file invalid:');
      for (const e of v.errors) console.error(`  - ${e}`);
      process.exit(2);
    }
    const entry = lookup(policy, modelId);
    const verdict = isAllowed(entry, risk, agentSurface);
    console.log(
      `${verdict.allowed ? 'ALLOW' : 'DENY'}  ${modelId} (source=${entry.source}, ` +
        `cap=${entry.max_risk}, allow_agent_surface=${entry.allow_agent_surface}) ` +
        `for risk:${risk}${agentSurface ? '+agent-surface' : ''} — ${verdict.reason}`,
    );
    process.exit(verdict.allowed ? 0 : 1);
  }

  // Default: validate.
  const v = validate(policy);
  if (!v.ok) {
    console.error('MODEL_POLICY.yml is invalid:');
    for (const e of v.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `MODEL_POLICY.yml ok: policy_version=${policy.policy_version}, ` +
      `${v.modelCount} model(s) defined, default cap=${policy.default.max_risk}.`,
  );
}

main();
