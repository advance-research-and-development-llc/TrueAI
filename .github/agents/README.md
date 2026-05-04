# Sub-agents

Per-task agent prompts for **TrueAI LocalAI**. Each `*.agent.md` declares a named teammate with its own mandate and scope. Agent CLIs that support per-task profiles (Claude Code, Codex CLI, GitHub Copilot agent picker) read the front-matter `name` field and route work accordingly.

## Roster

| Agent | When to use it |
|---|---|
| [`bug-fix-teammate`](./my-agent.agent.md) | Generic bug triage + targeted fix across web + Android. The default for "something is broken" issues. |
| [`coverage-improver`](./coverage-improver.agent.md) | Lift Vitest line / branch / function coverage on a specified file or low-covered cluster. Biases toward the `src/` top-level shells. |
| [`dep-bumper`](./dep-bumper.agent.md) | Resolve a Dependabot / OSV / npm audit finding without weakening `package.json` `overrides` pins. |
| [`release-shepherd`](./release-shepherd.agent.md) | Drive a tagged release through `release-bump.yml` / `tag-release.yml`. Pre-flight checklist + CHANGELOG. |
| [`android-doctor`](./android-doctor.agent.md) | Capacitor 8 / AGP 9.x / JDK 21 / Android lint diagnostics and fixes. |
| [`docs-curator`](./docs-curator.agent.md) | Consolidate the root-level `*_COMPLETE.md` / `*_GUIDE.md` sprawl into a structured `docs/` tree without losing content. |

## Authoring rules

1. **Front-matter is mandatory.** Every file must start with a YAML block declaring `name` and `description`. The agent CLI uses `name` to resolve `@<name>` mentions in issues and PR threads.
2. **One file per teammate.** Don't bundle multiple roles into one prompt — split them. `release-shepherd` and `dep-bumper` overlap on the override-pin rule but are deliberately separate so a release doesn't auto-bump.
3. **Hard constraints first.** Each prompt MUST reproduce the "do NOT violate these" block from [`../copilot-instructions.md`](../copilot-instructions.md). Agents skip long preambles.
4. **Lessons learned hook.** Every prompt should end with a `## Lessons learned (mandatory)` instruction so the merged PR feeds [`../copilot/LEARNINGS.md`](../copilot/LEARNINGS.md) via [`../workflows/learnings-ingest.yml`](../workflows/learnings-ingest.yml).
5. **Branch naming.** Stick to the table in [`../copilot-instructions.md`](../copilot-instructions.md) §"Branch naming convention". Don't invent new patterns per agent.

## Validation

Run `npm run check:agents` to lint every `*.agent.md` for the required front-matter fields. CI does not (yet) enforce this — the script is a local pre-flight that the relevant teammate runs before PR.

## See also

- [`../copilot-instructions.md`](../copilot-instructions.md) — canonical long-form contract.
- [`AGENTS.md`](../../AGENTS.md) — portable digest at the repo root for non-Copilot CLIs.
- [`../copilot/PROMPTS.md`](../copilot/PROMPTS.md) — reusable prompt fragments embedded by dispatcher workflows.
- [`../copilot/AGENT_RUNTIME.md`](../copilot/AGENT_RUNTIME.md) — runner / token / environment reference.
