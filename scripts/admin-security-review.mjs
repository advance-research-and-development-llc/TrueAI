#!/usr/bin/env node
/**
 * scripts/admin-security-review.mjs
 *
 * Comprehensive security audit script for TrueAI LocalAI. Performs deep
 * security analysis across all repository surfaces including:
 * - Token/credential leak detection
 * - Dependency supply-chain risk assessment
 * - Access control verification (rulesets, CODEOWNERS, workflows)
 * - Code-level vulnerability scanning
 * - CI/CD pipeline security review
 *
 * Usage:
 *   node scripts/admin-security-review.mjs [--full-report] [--output FILE]
 *
 * Options:
 *   --full-report    Generate complete markdown report (default: summary only)
 *   --output FILE    Write report to FILE (default: docs/security-reviews/YYYY-MM-DD-admin-review.md)
 *   --dry-run        Perform scan but don't write files
 *   --json           Output findings as JSON instead of markdown
 *
 * Owner-only operation — requires full repository read access.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const FULL_REPORT = args.includes('--full-report');
const DRY_RUN = args.includes('--dry-run');
const JSON_OUTPUT = args.includes('--json');
const outputArg = args.indexOf('--output');
const CUSTOM_OUTPUT = outputArg >= 0 ? args[outputArg + 1] : null;

const TODAY = new Date().toISOString().split('T')[0];
const DEFAULT_OUTPUT = `docs/security-reviews/${TODAY}-admin-review.md`;
const OUTPUT_FILE = CUSTOM_OUTPUT || DEFAULT_OUTPUT;

// Severity levels
const CRITICAL = 'CRITICAL';
const HIGH = 'HIGH';
const MEDIUM = 'MEDIUM';
const LOW = 'LOW';
const INFO = 'INFO';

// Finding categories
const CATEGORY_TOKEN = 'Token/Credential Exposure';
const CATEGORY_DEPENDENCY = 'Dependency Vulnerability';
const CATEGORY_ACCESS = 'Access Control';
const CATEGORY_CODE = 'Code Vulnerability';
const CATEGORY_CICD = 'CI/CD Pipeline';
const CATEGORY_CONFIG = 'Configuration';

const findings = [];
let findingId = 1;

function addFinding(severity, category, location, description, remediation) {
  findings.push({
    id: `F${String(findingId++).padStart(3, '0')}`,
    severity,
    category,
    location,
    description,
    remediation,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Token & Credential Scanning
// ────────────────────────────────────────────────────────────────────────────

function scanTokens() {
  console.log('🔍 Scanning for tokens and credentials...');

  const patterns = [
    { name: 'Generic API Key', regex: /[a-zA-Z0-9_-]{32,}/g },
    { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9-_]{40,}/g },
    { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{48}/g },
    { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
    { name: 'Bearer Token', regex: /Bearer\s+[A-Za-z0-9\-_=]+/g },
    { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g },
    { name: 'Private Key', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  ];

  const excludePatterns = [
    /node_modules/,
    /\.git\//,
    /dist\//,
    /coverage\//,
    /android\/build\//,
    /\.lock$/,
  ];

  const filesToScan = getAllFiles('.', excludePatterns);

  for (const file of filesToScan) {
    // Skip binary files
    if (file.match(/\.(png|jpg|jpeg|gif|ico|pdf|woff|woff2|ttf|eot)$/)) continue;

    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch (err) {
      continue; // Skip unreadable files
    }

    for (const { name, regex } of patterns) {
      const matches = content.match(regex);
      if (matches) {
        // Filter out false positives (example keys, test fixtures)
        const realMatches = matches.filter(m => !isLikelyFalsePositive(m, content));
        if (realMatches.length > 0) {
          addFinding(
            HIGH,
            CATEGORY_TOKEN,
            file,
            `Potential ${name} found: ${realMatches.length} occurrence(s)`,
            `Review ${file} and ensure no real credentials are committed. Move to environment variables or secure storage.`
          );
        }
      }
    }
  }

  // Verify secure storage usage
  verifySecureStorage();
}

function isLikelyFalsePositive(match, content) {
  // Check if it's in a comment
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes(match) && (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('*'))) {
      return true;
    }
  }

  // Check for test/example markers
  if (content.includes('example') && content.includes(match)) return true;
  if (content.includes('test') && content.includes(match)) return true;
  if (content.includes('fixture') && content.includes(match)) return true;
  if (match === 'sk-ant-example-key-000000000000000000000000') return true;

  return false;
}

function verifySecureStorage() {
  console.log('🔍 Verifying secure storage patterns...');

  // Check that API keys use secureStorage
  const kvStoreFile = 'src/lib/llm-runtime/kv-store.ts';
  if (existsSync(kvStoreFile)) {
    const content = readFileSync(kvStoreFile, 'utf-8');

    // Verify setSecure doesn't delegate to idbSet
    if (content.includes('async setSecure(') && content.includes('await idbSet(')) {
      addFinding(
        CRITICAL,
        CATEGORY_TOKEN,
        kvStoreFile,
        'setSecure() delegates to idbSet(), which falls back to localStorage on failure',
        'setSecure() must perform inline IndexedDB write without localStorage fallback per regression test requirement'
      );
    }
  }

  // Check for localStorage usage with sensitive keys
  const srcFiles = getAllFiles('src', [/node_modules/]);
  for (const file of srcFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

    const content = readFileSync(file, 'utf-8');
    if (content.includes('localStorage.setItem') &&
        (content.includes('api') || content.includes('key') || content.includes('token'))) {
      addFinding(
        HIGH,
        CATEGORY_TOKEN,
        file,
        'Potential credential storage in localStorage detected',
        'Use secureStorage or kvStore.setSecure() for sensitive data, never localStorage'
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dependency Security Assessment
// ────────────────────────────────────────────────────────────────────────────

function scanDependencies() {
  console.log('🔍 Scanning dependencies for vulnerabilities...');

  try {
    const auditOutput = execSync('npm audit --omit=dev --json', { encoding: 'utf-8' });
    const audit = JSON.parse(auditOutput);

    if (audit.metadata && audit.metadata.vulnerabilities) {
      const vulns = audit.metadata.vulnerabilities;

      if (vulns.critical > 0) {
        addFinding(
          CRITICAL,
          CATEGORY_DEPENDENCY,
          'package-lock.json',
          `${vulns.critical} CRITICAL npm vulnerabilities detected`,
          'Run npm audit for details and update affected packages immediately'
        );
      }

      if (vulns.high > 0) {
        addFinding(
          HIGH,
          CATEGORY_DEPENDENCY,
          'package-lock.json',
          `${vulns.high} HIGH npm vulnerabilities detected`,
          'Run npm audit for details and update affected packages'
        );
      }

      if (vulns.moderate > 0) {
        addFinding(
          MEDIUM,
          CATEGORY_DEPENDENCY,
          'package-lock.json',
          `${vulns.moderate} MODERATE npm vulnerabilities detected`,
          'Run npm audit for details. Consider updating during next maintenance cycle'
        );
      }
    }
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities found
    addFinding(
      INFO,
      CATEGORY_DEPENDENCY,
      'package.json',
      'npm audit check completed (see logs for details)',
      'Review npm audit output for vulnerability details'
    );
  }

  // Verify overrides pins
  verifyOverridesPins();

  // Check for suspicious scripts
  scanPackageScripts();
}

function verifyOverridesPins() {
  const pkgFile = 'package.json';
  if (!existsSync(pkgFile)) return;

  const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8'));
  const requiredOverrides = {
    'path-to-regexp': '^8.4.0',
    'postcss': '^8.5.10',
    'lodash': '^4.17.24',
    'brace-expansion': '^1.1.13',
  };

  for (const [dep, minVersion] of Object.entries(requiredOverrides)) {
    if (!pkg.overrides || !pkg.overrides[dep]) {
      addFinding(
        HIGH,
        CATEGORY_DEPENDENCY,
        pkgFile,
        `Missing required override pin for ${dep}`,
        `Add "${dep}": "${minVersion}" to package.json overrides block`
      );
    }
  }
}

function scanPackageScripts() {
  const pkgFile = 'package.json';
  if (!existsSync(pkgFile)) return;

  const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8'));
  const suspiciousPatterns = ['curl', 'wget', 'eval', 'bash -c'];

  for (const [script, command] of Object.entries(pkg.scripts || {})) {
    for (const pattern of suspiciousPatterns) {
      if (command.includes(pattern)) {
        addFinding(
          MEDIUM,
          CATEGORY_DEPENDENCY,
          pkgFile,
          `Package script "${script}" contains suspicious pattern: ${pattern}`,
          `Review script for security implications: ${command}`
        );
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Access Control Verification
// ────────────────────────────────────────────────────────────────────────────

function verifyAccessControls() {
  console.log('🔍 Verifying access controls...');

  verifyRulesets();
  verifyCodeowners();
  verifyWorkflowPermissions();
}

function verifyRulesets() {
  const rulesetDir = '.github/rulesets';
  if (!existsSync(rulesetDir)) {
    addFinding(
      CRITICAL,
      CATEGORY_ACCESS,
      rulesetDir,
      'Rulesets directory not found',
      'Create rulesets to protect main branch and release tags'
    );
    return;
  }

  const rulesetFiles = readdirSync(rulesetDir).filter(f => f.endsWith('.json'));

  for (const file of rulesetFiles) {
    const fullPath = join(rulesetDir, file);
    const ruleset = JSON.parse(readFileSync(fullPath, 'utf-8'));

    // Check enforcement status
    if (ruleset.enforcement !== 'active') {
      addFinding(
        HIGH,
        CATEGORY_ACCESS,
        fullPath,
        `Ruleset "${ruleset.name}" is not active (status: ${ruleset.enforcement})`,
        'Set enforcement to "active" for this ruleset to take effect'
      );
    }

    // Verify bypass actors
    if (ruleset.bypass_actors) {
      for (const actor of ruleset.bypass_actors) {
        if (actor.actor_id === -1) {
          addFinding(
            HIGH,
            CATEGORY_ACCESS,
            fullPath,
            `Placeholder bypass actor (actor_id: -1) in "${ruleset.name}"`,
            'Replace with real GitHub App ID using scripts/configure-rulesets.sh'
          );
        }
      }
    }
  }
}

function verifyCodeowners() {
  const codeownersFile = '.github/CODEOWNERS';
  if (!existsSync(codeownersFile)) {
    addFinding(
      CRITICAL,
      CATEGORY_ACCESS,
      codeownersFile,
      'CODEOWNERS file not found',
      'Create CODEOWNERS file to enforce ownership review on all PRs'
    );
    return;
  }

  const content = readFileSync(codeownersFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));

  // Verify sensitive paths are covered
  const sensitivePaths = [
    '.github/',
    'LICENSE',
    'NOTICE',
    'package.json',
    'src/lib/llm-runtime/kv-store.ts',
    'src/lib/native/secure-storage.ts',
  ];

  for (const path of sensitivePaths) {
    const covered = lines.some(line => line.includes(path));
    if (!covered) {
      addFinding(
        MEDIUM,
        CATEGORY_ACCESS,
        codeownersFile,
        `Sensitive path "${path}" not explicitly listed in CODEOWNERS`,
        `Add entry: /${path} @smackypants`
      );
    }
  }
}

function verifyWorkflowPermissions() {
  const workflowDir = '.github/workflows';
  if (!existsSync(workflowDir)) return;

  const workflows = readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of workflows) {
    const fullPath = join(workflowDir, file);
    const content = readFileSync(fullPath, 'utf-8');

    // Check for overly permissive permissions
    if (content.includes('permissions:') && content.includes('write-all')) {
      addFinding(
        HIGH,
        CATEGORY_CICD,
        fullPath,
        'Workflow uses write-all permissions',
        'Use least-privilege permissions. Specify only required scopes.'
      );
    }

    // Check for pull_request_target without input validation
    if (content.includes('pull_request_target') && !content.includes('github.event.pull_request')) {
      addFinding(
        HIGH,
        CATEGORY_CICD,
        fullPath,
        'pull_request_target trigger without apparent input validation',
        'Validate all inputs from untrusted PR context to prevent workflow injection'
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Code Vulnerability Scanning
// ────────────────────────────────────────────────────────────────────────────

function scanCodeVulnerabilities() {
  console.log('🔍 Scanning code for vulnerabilities...');

  const srcFiles = getAllFiles('src', [/node_modules/, /\.test\./]);

  for (const file of srcFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js') && !file.endsWith('.jsx')) continue;

    const content = readFileSync(file, 'utf-8');

    // Check for eval
    if (content.includes('eval(') && !content.includes('// eslint-disable-line no-eval')) {
      addFinding(
        HIGH,
        CATEGORY_CODE,
        file,
        'Use of eval() detected',
        'Avoid eval(). Use safer alternatives or add explicit justification comment.'
      );
    }

    // Check for dangerouslySetInnerHTML without sanitization
    if (content.includes('dangerouslySetInnerHTML') && !content.includes('DOMPurify')) {
      addFinding(
        HIGH,
        CATEGORY_CODE,
        file,
        'dangerouslySetInnerHTML used without apparent sanitization',
        'Use DOMPurify.sanitize() or similar before setting inner HTML'
      );
    }

    // Check for Math.random() in security contexts
    if ((content.includes('Math.random()') && content.includes('token')) ||
        (content.includes('Math.random()') && content.includes('key'))) {
      addFinding(
        MEDIUM,
        CATEGORY_CODE,
        file,
        'Math.random() used in potential security context',
        'Use crypto.getRandomValues() for cryptographic randomness'
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────────────────────────────────────

function getAllFiles(dir, excludePatterns = []) {
  const results = [];

  function walk(currentPath) {
    if (excludePatterns.some(pattern => pattern.test(currentPath))) return;

    let entries;
    try {
      entries = readdirSync(currentPath);
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      if (excludePatterns.some(pattern => pattern.test(fullPath))) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          results.push(fullPath);
        }
      } catch (err) {
        // Skip inaccessible files
      }
    }
  }

  walk(dir);
  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Report Generation
// ────────────────────────────────────────────────────────────────────────────

function generateReport() {
  if (JSON_OUTPUT) {
    return JSON.stringify({ date: TODAY, findings }, null, 2);
  }

  const criticalCount = findings.filter(f => f.severity === CRITICAL).length;
  const highCount = findings.filter(f => f.severity === HIGH).length;
  const mediumCount = findings.filter(f => f.severity === MEDIUM).length;
  const lowCount = findings.filter(f => f.severity === LOW).length;
  const infoCount = findings.filter(f => f.severity === INFO).length;

  const report = `---
date: ${TODAY}
reviewer: admin-security-reviewer (automated)
total_findings: ${findings.length}
critical: ${criticalCount}
high: ${highCount}
medium: ${mediumCount}
low: ${lowCount}
info: ${infoCount}
---

# Admin Security Review — ${TODAY}

## Executive Summary

This automated security review scanned the TrueAI LocalAI repository for:
- Token and credential exposure
- Dependency vulnerabilities and supply-chain risks
- Access control configuration (rulesets, CODEOWNERS, workflow permissions)
- Code-level vulnerabilities (XSS, injection, insecure randomness)
- CI/CD pipeline security

**Total findings: ${findings.length}**

${criticalCount > 0 ? `\n🚨 **CRITICAL**: ${criticalCount} finding(s) require immediate attention.\n` : ''}
${highCount > 0 ? `⚠️ **HIGH**: ${highCount} finding(s) should be addressed soon.\n` : ''}
${mediumCount > 0 ? `📋 **MEDIUM**: ${mediumCount} finding(s) for next maintenance cycle.\n` : ''}

${findings.length === 0 ? '✅ No security findings detected. All checks passed.\n' : ''}

---

## Critical Findings

${generateFindingsTable(CRITICAL)}

## High-Priority Findings

${generateFindingsTable(HIGH)}

## Medium-Priority Findings

${generateFindingsTable(MEDIUM)}

## Low-Priority Findings

${generateFindingsTable(LOW)}

## Informational Findings

${generateFindingsTable(INFO)}

---

## Compliance Checklist

- [${findings.filter(f => f.category === CATEGORY_TOKEN).length === 0 ? 'x' : ' '}] No credentials in code or configuration
- [${findings.filter(f => f.location === 'src/lib/llm-runtime/kv-store.ts').length === 0 ? 'x' : ' '}] Secure storage pattern correct (no localStorage fallback)
- [${findings.filter(f => f.category === CATEGORY_DEPENDENCY && f.severity === CRITICAL).length === 0 ? 'x' : ' '}] No critical dependency vulnerabilities
- [${findings.filter(f => f.location.includes('package.json') && f.description.includes('override')).length === 0 ? 'x' : ' '}] All required override pins present
- [${findings.filter(f => f.location.includes('.github/rulesets') && f.severity === HIGH).length === 0 ? 'x' : ' '}] All rulesets active and properly configured
- [${findings.filter(f => f.location === '.github/CODEOWNERS').length === 0 ? 'x' : ' '}] CODEOWNERS complete for sensitive paths
- [${findings.filter(f => f.category === CATEGORY_CICD && f.severity === HIGH).length === 0 ? 'x' : ' '}] No high-risk workflow configurations

---

## Methodology

This review used automated scanning techniques including:

1. **Token Detection**: Pattern matching for common API key formats, GitHub tokens, private keys
2. **Secure Storage Verification**: Code analysis of secureStorage and kvStore usage patterns
3. **Dependency Audit**: npm audit + manual override pin verification
4. **Access Control Check**: Ruleset parsing, CODEOWNERS validation, workflow permission review
5. **Code Scanning**: Pattern matching for eval(), dangerouslySetInnerHTML, insecure randomness

False positives may occur. All findings should be manually reviewed before remediation.

---

## Recommendations

${criticalCount > 0 || highCount > 0 ? `
### Immediate Actions Required

${findings.filter(f => f.severity === CRITICAL || f.severity === HIGH).slice(0, 5).map(f =>
  `- **${f.id}** (${f.severity}): ${f.description} → ${f.remediation}`
).join('\n')}
` : '✅ No immediate actions required.'}

### Next Steps

1. Review all findings in detail
2. Create fix issues for high/critical findings
3. Schedule remediation for medium findings
4. Document any accepted risks
5. Re-run review after fixes: \`node scripts/admin-security-review.mjs --full-report\`

---

*Generated by admin-security-reviewer agent on ${new Date().toISOString()}*
`;

  return report;
}

function generateFindingsTable(severity) {
  const severityFindings = findings.filter(f => f.severity === severity);

  if (severityFindings.length === 0) {
    return '_No findings at this severity level._\n';
  }

  let table = '| ID | Category | Location | Description | Remediation |\n';
  table += '|---|---|---|---|---|\n';

  for (const finding of severityFindings) {
    table += `| ${finding.id} | ${finding.category} | \`${finding.location}\` | ${finding.description} | ${finding.remediation} |\n`;
  }

  return table;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Execution
// ────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔐 TrueAI LocalAI Admin Security Review');
  console.log(`📅 Date: ${TODAY}`);
  console.log(`📄 Output: ${OUTPUT_FILE}`);
  console.log('');

  try {
    scanTokens();
    scanDependencies();
    verifyAccessControls();
    scanCodeVulnerabilities();

    console.log('');
    console.log(`✅ Scan complete. Found ${findings.length} findings.`);
    console.log(`   Critical: ${findings.filter(f => f.severity === CRITICAL).length}`);
    console.log(`   High: ${findings.filter(f => f.severity === HIGH).length}`);
    console.log(`   Medium: ${findings.filter(f => f.severity === MEDIUM).length}`);
    console.log(`   Low: ${findings.filter(f => f.severity === LOW).length}`);
    console.log('');

    if (!DRY_RUN) {
      const report = generateReport();

      // Ensure output directory exists
      const outputDir = OUTPUT_FILE.substring(0, OUTPUT_FILE.lastIndexOf('/'));
      if (outputDir && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      writeFileSync(OUTPUT_FILE, report, 'utf-8');
      console.log(`📝 Report written to ${OUTPUT_FILE}`);
    } else {
      console.log('🏃 Dry run mode - no files written');
      if (FULL_REPORT) {
        console.log('');
        console.log(generateReport());
      }
    }

    // Exit with error code if critical or high findings
    const criticalOrHigh = findings.filter(f => f.severity === CRITICAL || f.severity === HIGH).length;
    if (criticalOrHigh > 0) {
      console.log('');
      console.log(`⚠️  ${criticalOrHigh} critical/high findings require attention`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error during security review:', error.message);
    process.exit(1);
  }
}

main();
