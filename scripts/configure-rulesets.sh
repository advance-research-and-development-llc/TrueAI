#!/usr/bin/env bash
#
# BEGIN_HELP
# configure-rulesets.sh — one-shot ruleset bootstrap for the
# TrueAI repository.
#
# Reads the GitHub App installations on the repository, looks up the
# numeric `app_id` for each bot we rely on (github-actions[bot],
# copilot-swe-agent[bot], dependabot[bot]), patches the placeholder
# `actor_id: -1` entries in the JSON files under `.github/rulesets/`,
# and POSTs each ruleset to the repository (or PUTs over it if a
# ruleset of the same name already exists). The result is a fully
# active set of branch- and tag-protection rules with the correct
# bypass actors — no manual `Settings → Rules → Rulesets → Import`
# clicking required.
#
# Re-run any time. The script is idempotent.
#
# Requirements (run on the maintainer's workstation, NOT in CI):
#   - gh CLI authenticated as a repo *admin* (`gh auth login`).
#   - jq + python3.
#   - The bots you want to authorize must already be installed on the
#     repository (Copilot agent: install via
#     https://github.com/apps/copilot-swe-agent; Dependabot: enable
#     under Settings → Code security).
#
# Usage:
#   scripts/configure-rulesets.sh [--owner OWNER] [--repo REPO] [--dry-run]
#
# Defaults are auto-detected from `git remote get-url origin` when run
# inside a clone of this repo, falling back to
# advance-research-and-development-llc/TrueAI otherwise.
# END_HELP

set -euo pipefail

# Auto-detect OWNER/REPO from the origin remote so the script keeps
# working through future repo renames or org moves; flags still win.
detect_slug() {
  local url
  url="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." remote get-url origin 2>/dev/null || true)"
  url="${url%.git}"
  url="${url#git@github.com:}"
  url="${url#https://github.com/}"
  url="${url#http://github.com/}"
  echo "$url"
}
SLUG="$(detect_slug)"
OWNER="${SLUG%%/*}"
REPO="${SLUG##*/}"
[[ -z "$OWNER" || "$OWNER" == "$SLUG" ]] && OWNER="advance-research-and-development-llc"
[[ -z "$REPO"  || "$REPO"  == "$SLUG" ]] && REPO="TrueAI"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)   OWNER="$2"; shift 2 ;;
    --repo)    REPO="$2";  shift 2 ;;
    --dry-run) DRY_RUN=1;  shift ;;
    -h|--help)
      sed -n '/^# BEGIN_HELP$/,/^# END_HELP$/p' "$0" \
        | sed '1d;$d;s/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "::error:: 'gh' CLI not found"; exit 1; }
command -v jq >/dev/null || { echo "::error:: 'jq' not found"; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RULESETS_DIR="$REPO_ROOT/.github/rulesets"

if [[ ! -d "$RULESETS_DIR" ]]; then
  echo "::error:: $RULESETS_DIR not found"; exit 1
fi

echo "==> Fetching GitHub App installations on $OWNER/$REPO ..."
# Try repo-level first (requires GitHub App auth); fall back to org-level
# (requires admin:org scope); gracefully default to empty if both fail,
# since actor_ids may already be set in the ruleset JSON files.
INSTALLATIONS_JSON="$(gh api "/repos/$OWNER/$REPO/installations" --paginate 2>/dev/null \
  || gh api "/orgs/$OWNER/installations" --paginate 2>/dev/null \
  || echo '{"installations":[]}')"

# Slug -> app_id lookup. Handles both array (repo endpoint) and object
# with .installations key (org endpoint). Returns empty if not found.
app_id_for() {
  local slug="$1"
  printf '%s' "$INSTALLATIONS_JSON" \
    | jq -r --arg slug "$slug" \
        '(if type == "array" then . else .installations end)[]
         | select(.app_slug == $slug) | .app_id' 2>/dev/null \
    | head -n1
}

GITHUB_ACTIONS_ID="$(app_id_for 'github-actions')"
COPILOT_AGENT_ID="$(app_id_for 'copilot-swe-agent')"
DEPENDABOT_ID="$(app_id_for 'dependabot')"

echo "    github-actions[bot]    app_id = ${GITHUB_ACTIONS_ID:-<not installed>}"
echo "    copilot-swe-agent[bot] app_id = ${COPILOT_AGENT_ID:-<not installed>}"
echo "    dependabot[bot]        app_id = ${DEPENDABOT_ID:-<not installed>}"

# Check whether any ruleset still has a placeholder actor_id <= 0 that
# requires github-actions to be resolved. If all ids are already set in
# the JSON files, we can safely proceed without the installations lookup.
NEEDS_GHA_ID=0
for f in "$RULESETS_DIR"/*.json; do
  if jq -e '[.bypass_actors[]? | select(.actor_type == "Integration" and .actor_id <= 0 and ((.._comment? // "") | ascii_downcase | contains("github-actions")))] | length > 0' "$f" >/dev/null 2>&1; then
    NEEDS_GHA_ID=1; break
  fi
done

if [[ "$NEEDS_GHA_ID" -eq 1 && -z "$GITHUB_ACTIONS_ID" ]]; then
  echo "::error:: github-actions[bot] is not installed on $OWNER/$REPO. Cannot proceed: the release workflows would be blocked."
  exit 1
fi

# Pre-process the ruleset JSON to assign each placeholder Integration
# entry to a specific bot based on its `_comment` text, then recursively
# strip every `_comment` field (the Rulesets API rejects unknown keys).
# More robust than positional matching.
assign_actor_ids() {
  local src="$1"
  python3 - "$src" "${GITHUB_ACTIONS_ID:-0}" "${COPILOT_AGENT_ID:-0}" "${DEPENDABOT_ID:-0}" <<'PY'
import json, sys
src, gha, copilot, dependabot = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
with open(src) as f:
    data = json.load(f)

def strip_comments(obj):
    """Recursively drop any '_comment' / '_bypass_note' keys the Rulesets API would reject."""
    if isinstance(obj, dict):
        obj.pop("_comment", None)
        obj.pop("_bypass_note", None)
        for v in obj.values():
            strip_comments(v)
    elif isinstance(obj, list):
        for v in obj:
            strip_comments(v)

new_actors = []
for actor in data.get("bypass_actors", []):
    comment = (actor.get("_comment", "") or "").lower()
    if actor.get("actor_type") == "Integration" and actor.get("actor_id", 0) <= 0:
        if "github-actions" in comment:
            target = gha
        elif "copilot" in comment:
            target = copilot
        elif "dependabot" in comment:
            target = dependabot
        else:
            target = 0
        if target <= 0:
            # Bot not installed — drop the entry so the ruleset stays valid.
            continue
        actor["actor_id"] = target
    new_actors.append(actor)
data["bypass_actors"] = new_actors
strip_comments(data)
print(json.dumps(data, indent=2))
PY
}

# Find an existing ruleset of the given name, searching repo then org level.
# Returns "<scope>:<id>" so the caller knows which API to use.
find_ruleset_id() {
  local name="$1"
  local repo_id org_id
  repo_id="$(gh api "/repos/$OWNER/$REPO/rulesets" --paginate \
    | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' \
    | head -n1)"
  [[ -n "$repo_id" ]] && echo "repo:$repo_id" && return
  org_id="$(gh api "/orgs/$OWNER/rulesets" --paginate 2>/dev/null \
    | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' \
    | head -n1)"
  [[ -n "$org_id" ]] && echo "org:$org_id" && return
  echo ""
}

upsert_ruleset() {
  local file="$1"
  local body name is_org_level scoped_id scope id endpoint method
  body="$(assign_actor_ids "$file")"
  name="$(printf '%s' "$body" | jq -r '.name')"
  is_org_level="$(printf '%s' "$body" | jq -r '._org_level // false')"
  # Strip the meta field before sending to the API
  body="$(printf '%s' "$body" | jq 'del(._org_level)')"

  scoped_id="$(find_ruleset_id "$name")"
  scope="${scoped_id%%:*}"
  id="${scoped_id##*:}"

  if [[ "$is_org_level" == "true" ]]; then
    # Org-level ruleset (e.g. file_path_restriction / push rules)
    if [[ -n "$id" && "$scope" == "org" ]]; then
      endpoint="/orgs/$OWNER/rulesets/$id"
      method="PUT"
    else
      endpoint="/orgs/$OWNER/rulesets"
      method="POST"
    fi
  else
    if [[ -n "$id" && "$scope" == "repo" ]]; then
      endpoint="/repos/$OWNER/$REPO/rulesets/$id"
      method="PUT"
    else
      endpoint="/repos/$OWNER/$REPO/rulesets"
      method="POST"
    fi
  fi

  echo "==> $method $endpoint  ($(basename "$file") -> '$name')"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '%s\n' "$body"
    return 0
  fi
  printf '%s' "$body" | gh api --method "$method" "$endpoint" --input -
}

shopt -s nullglob
for f in "$RULESETS_DIR"/*.json; do
  upsert_ruleset "$f"
done

echo "==> Done. Verify under https://github.com/$OWNER/$REPO/settings/rules"
