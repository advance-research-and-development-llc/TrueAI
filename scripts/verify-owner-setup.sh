#!/usr/bin/env bash
#
# verify-owner-setup.sh — confirm the five owner-only setup steps for
# the TrueAI repo are actually live. Run from a workstation
# where `gh` is authenticated as a repo *admin* (so it can read repo
# settings, environments, rulesets, and app installations).
#
# Reports ✅ / ❌ per item and exits non-zero if anything is missing.
#
# Usage:
#   scripts/verify-owner-setup.sh [--owner OWNER] [--repo REPO]
#
# Defaults are auto-detected from `git remote get-url origin` when run
# inside a clone of this repo, falling back to
# advance-research-and-development-llc/TrueAI otherwise.

set -uo pipefail

# Auto-detect OWNER/REPO from the origin remote so the script keeps
# working through future repo renames or org moves; flags still win.
detect_slug() {
  local url
  url="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." remote get-url origin 2>/dev/null || true)"
  # Strip protocol + trailing .git, then take the last two path segments.
  url="${url%.git}"
  url="${url#git@github.com:}"
  url="${url#https://github.com/}"
  url="${url#http://github.com/}"
  echo "$url"
}
SLUG="$(detect_slug)"
OWNER="${SLUG%%/*}"
REPO="${SLUG##*/}"
# Fallback if detection failed (e.g. running outside a clone).
[[ -z "$OWNER" || "$OWNER" == "$SLUG" ]] && OWNER="advance-research-and-development-llc"
[[ -z "$REPO"  || "$REPO"  == "$SLUG" ]] && REPO="TrueAI"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner) OWNER="$2"; shift 2 ;;
    --repo)  REPO="$2";  shift 2 ;;
    -h|--help)
      sed -n '2,/^set -uo/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "❌ 'gh' CLI not found"; exit 1; }
command -v jq >/dev/null || { echo "❌ 'jq' not found"; exit 1; }

FAIL=0
ok()    { echo "✅ $1"; }
fail()  { echo "❌ $1"; FAIL=$((FAIL + 1)); }
warn()  { echo "⚠️  $1"; }
info()  { echo "ℹ️  $1"; }

echo "==> Verifying owner-only setup for $OWNER/$REPO"
echo

# --- 1. Workflow permissions -------------------------------------------------
echo "[1/7] Actions workflow permissions"
PERMS_JSON="$(gh api "/repos/$OWNER/$REPO/actions/permissions/workflow" 2>/dev/null || echo '{}')"
DEFAULT_PERMS="$(printf '%s' "$PERMS_JSON" | jq -r '.default_workflow_permissions // ""')"
PR_APPROVE="$(printf '%s' "$PERMS_JSON" | jq -r '.can_approve_pull_request_reviews // false')"

if [[ "$DEFAULT_PERMS" == "write" ]]; then
  ok "default_workflow_permissions = write"
else
  fail "default_workflow_permissions = '${DEFAULT_PERMS:-unknown}' (need 'write')"
fi
if [[ "$PR_APPROVE" == "true" ]]; then
  ok "can_approve_pull_request_reviews = true"
else
  fail "can_approve_pull_request_reviews = ${PR_APPROVE} (need true)"
fi
echo

# --- 2. Auto-merge / squash settings ----------------------------------------
echo "[2/7] Pull-request merge settings"
REPO_JSON="$(gh api "/repos/$OWNER/$REPO" 2>/dev/null || echo '{}')"
for key in allow_auto_merge allow_squash_merge delete_branch_on_merge; do
  val="$(printf '%s' "$REPO_JSON" | jq -r --arg k "$key" '.[$k] // false')"
  if [[ "$val" == "true" ]]; then
    ok "$key = true"
  elif [[ "$key" == "delete_branch_on_merge" ]]; then
    warn "$key = $val (recommended but not required)"
  else
    fail "$key = $val (need true)"
  fi
done
echo

# --- 3. Environments (release / play / fdroid) ------------------------------
echo "[3/7] Environments"
ENVS_JSON="$(gh api "/repos/$OWNER/$REPO/environments" 2>/dev/null || echo '{"environments":[]}')"
for env_name in release play fdroid; do
  if printf '%s' "$ENVS_JSON" | jq -e --arg n "$env_name" '.environments[]? | select(.name == $n)' >/dev/null; then
    ok "environment '$env_name' exists"
  else
    fail "environment '$env_name' missing"
  fi
done
echo

# --- 4. Rulesets imported ----------------------------------------------------
echo "[4/7] Repository rulesets"
# Repo-level rulesets (branch + tag protection).
RULESETS_JSON="$(gh api "/repos/$OWNER/$REPO/rulesets" 2>/dev/null || echo '[]')"
# Org-level rulesets (e.g. push / file_path_restriction which cannot be
# created at repo level on public repos — file_path_restriction is a push
# rule and "Source public repos cannot have push rules").
ORG_RULESETS_JSON="$(gh api "/orgs/$OWNER/rulesets" --paginate 2>/dev/null || echo '[]')"
check_ruleset() {
  local name="$1"
  # Active in repo-level rulesets?
  if printf '%s' "$RULESETS_JSON" | jq -e --arg n "$name" '.[]? | select(.name == $n and .enforcement == "active")' >/dev/null; then
    ok "ruleset '$name' is active"
    return
  fi
  # Active in org-level rulesets?
  if printf '%s' "$ORG_RULESETS_JSON" | jq -e --arg n "$name" '.[]? | select(.name == $n and .enforcement == "active")' >/dev/null; then
    ok "ruleset '$name' is active (org-level push ruleset)"
    return
  fi
  # Exists but disabled?
  if printf '%s' "$RULESETS_JSON $ORG_RULESETS_JSON" | jq -e --arg n "$name" '.[]? | select(.name == $n)' >/dev/null 2>&1; then
    warn "ruleset '$name' exists but is not 'active' (run scripts/configure-rulesets.sh)"
    FAIL=$((FAIL + 1))
    return
  fi
  fail "ruleset '$name' not imported (run scripts/configure-rulesets.sh)"
}
for name in \
  "Protect default branch (main/master)" \
  "Protect release tags (v*)" \
  "Protect workflows, license, and config files"; do
  check_ruleset "$name"
done
echo

# --- 5. Bot installations ---------------------------------------------------
echo "[5/7] Bot app installations"

# github-actions[bot] — built-in; active whenever Actions is enabled
if gh api "/repos/$OWNER/$REPO/actions/permissions" --jq '.enabled' 2>/dev/null | grep -q "true"; then
  ok "github-actions[bot] active (Actions enabled)"
else
  fail "github-actions[bot] unavailable — Actions not enabled on this repo"
fi

# dependabot[bot] — check via vulnerability alerts API (enabled earlier)
if gh api "/repos/$OWNER/$REPO/vulnerability-alerts" >/dev/null 2>&1; then
  ok "dependabot[bot] active (vulnerability alerts enabled)"
else
  fail "dependabot[bot] not active — enable via Settings → Code security"
fi

# copilot-swe-agent — optional; check via installations endpoint with fallback
INSTALL_JSON="$(gh api "/repos/$OWNER/$REPO/installations" --paginate 2>/dev/null || echo '{"installations":[]}')"
copilot_id="$(printf '%s' "$INSTALL_JSON" | jq -r '.installations[]? | select(.app_slug == "copilot-swe-agent") | .app_id' | head -n1)"
if [[ -n "$copilot_id" ]]; then
  ok "copilot-swe-agent[bot] installed (app_id $copilot_id)"
else
  warn "copilot-swe-agent[bot] not installed (optional — install via https://github.com/apps/copilot-swe-agent)"
fi
echo

# --- 6. Agent infra: variables, secrets, and dispatcher workflows -----------
echo "[6/7] Agent infrastructure"

# COPILOT_RUNNER variable (Workstream A1)
RUNNER_VAR="$(gh api "/repos/$OWNER/$REPO/actions/variables/COPILOT_RUNNER" --jq '.value' 2>/dev/null || echo "")"
if [[ -n "$RUNNER_VAR" ]]; then
  ok "Actions variable COPILOT_RUNNER = '$RUNNER_VAR'"
else
  warn "Actions variable COPILOT_RUNNER not set (falls back to ubuntu-latest; recommended: ubuntu-8-core)"
fi

# AGENT_AUTOMATION_TOKEN secret presence (Workstream A4) — cannot read value
# but `gh api` will return 200 if the secret exists.
if gh api "/repos/$OWNER/$REPO/actions/secrets/AGENT_AUTOMATION_TOKEN" >/dev/null 2>&1; then
  ok "Secret AGENT_AUTOMATION_TOKEN is present"
else
  warn "Secret AGENT_AUTOMATION_TOKEN missing (workflows fall back to GITHUB_TOKEN; broader scopes recommended — see AGENT_RUNTIME.md § 3a)"
fi

# Dispatcher workflows present + active
# GitHub sometimes indexes a workflow by its file path instead of its `name:`
# field (e.g. when the trigger event is plan-gated). Fall back to path lookup.
WORKFLOWS_JSON="$(gh api "/repos/$OWNER/$REPO/actions/workflows" --paginate 2>/dev/null || echo '{"workflows":[]}')"

# Map "Display Name" -> "filename-slug.yml" for path fallback
declare -A WF_PATH_FALLBACK=(
  ["CodeQL Auto-Fix Dispatch"]="codeql-autofix.yml"
  ["Test Failure Auto-Fix Dispatch"]="test-failure-autofix.yml"
  ["Secret Scanning Auto-Fix Dispatch"]="secret-scanning-autofix.yml"
)

check_workflow() {
  local wf="$1"
  local state
  # Primary: match by name
  state="$(printf '%s' "$WORKFLOWS_JSON" | jq -r --arg n "$wf" '.workflows[]? | select(.name == $n) | .state' | head -n1)"
  # Fallback: match by file path suffix
  if [[ -z "$state" && -n "${WF_PATH_FALLBACK[$wf]+x}" ]]; then
    local fname="${WF_PATH_FALLBACK[$wf]}"
    state="$(printf '%s' "$WORKFLOWS_JSON" | jq -r --arg p "$fname" '.workflows[]? | select(.path | endswith($p)) | .state' | head -n1)"
  fi
  if [[ "$state" == "active" ]]; then
    ok "workflow '$wf' is active"
  elif [[ -n "$state" ]]; then
    warn "workflow '$wf' state = '$state' (expected active)"
  else
    fail "workflow '$wf' not found"
  fi
}

for wf in \
  "Copilot Setup Steps" \
  "CodeQL Auto-Fix Dispatch" \
  "Auto Lint Fix" \
  "Test Failure Auto-Fix Dispatch" \
  "Android Proactive Lint Audit" \
  "Dependency Vulnerability Scan" \
  "Secret Scanning Auto-Fix Dispatch" \
  "Coverage Gap Dispatch" \
  "Compatibility Matrix" \
  "PR Risk Labeller" \
  "Fix Verification Harness" \
  "Bug Report from Logs Dispatcher"; do
  check_workflow "$wf"
done

# Composite actions present in the working tree (the only place we can check).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
for f in \
  ".github/actions/dispatch-fix-issue/action.yml" \
  ".github/actions/agent-throttle/action.yml" \
  ".github/copilot/PROMPTS.md" \
  ".github/copilot/AGENT_RUNTIME.md" \
  "scripts/ratchet-coverage-thresholds.mjs" \
  "scripts/check-node-engines.mjs" \
  "scripts/classify-pr-risk.mjs" \
  "docs/AGENT_OPERATIONS.md"; do
  if [[ -f "$REPO_ROOT/$f" ]]; then
    ok "file present: $f"
  else
    fail "file missing: $f"
  fi
done
echo

# --- 7. Security features (best-effort, requires admin) ---------------------
echo "[7/7] Security features"
SEC_JSON="$(gh api "/repos/$OWNER/$REPO" --jq '.security_and_analysis // {}' 2>/dev/null || echo '{}')"
for feat in secret_scanning secret_scanning_push_protection; do
  state="$(printf '%s' "$SEC_JSON" | jq -r --arg k "$feat" '.[$k].status // ""')"
  if [[ "$state" == "enabled" ]]; then
    ok "$feat = enabled"
  elif [[ -n "$state" ]]; then
    warn "$feat = $state (recommended: enabled — see codeql-autofix.yml header)"
  else
    warn "$feat status unknown (admin scope required to read)"
  fi
done
echo

# --- Summary -----------------------------------------------------------------
if [[ "$FAIL" -eq 0 ]]; then
  echo "🎉 All owner-only setup steps look good."
  exit 0
else
  echo "❌ ${FAIL} item(s) need attention. See .github/copilot/AGENT_RUNTIME.md for fix instructions."
  exit 1
fi
