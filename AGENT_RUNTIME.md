# AGENT_RUNTIME.md

Runtime configuration reference for the Copilot SWE agent and automated workflows in this repository.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Runner Configuration](#2-runner-configuration)
3. [Authentication & Tokens](#3-authentication--tokens)
   - [3a. AGENT_AUTOMATION_TOKEN — Fine-Grained PAT](#3a-agent_automation_token--fine-grained-pat)
4. [Environments](#4-environments)
5. [Security](#5-security)

---

## 1. Overview

This document describes the runtime requirements for automated agents operating against the `TrueAI` repository under the `advance-research-and-development-llc` organization. All secrets and variables referenced here are stored in **Settings → Secrets and variables → Actions** and are never committed to source.

---

## 2. Runner Configuration

| Variable | Value | Description |
|---|---|---|
| `COPILOT_RUNNER` | `ubuntu-8-core` | GitHub Actions runner label used by agent workflows |

Set in **Settings → Secrets and variables → Actions → Variables**.

---

## 3. Authentication & Tokens

### 3a. AGENT_AUTOMATION_TOKEN — Fine-Grained PAT

| Property | Value |
|---|---|
| **Secret name** | `AGENT_AUTOMATION_TOKEN` |
| **Token type** | Fine-grained personal access token |
| **Owner** | `smackypants` |
| **Expiry** | 2027-05-05 |
| **Target resource** | `advance-research-and-development-llc/TrueAI` |

#### Repository permissions granted

| Permission | Level | Purpose |
|---|---|---|
| `contents` | read/write | Read code, push commits, create branches |
| `pull_requests` | read/write | Open, update, and merge PRs on behalf of the agent |
| `workflows` | read/write | Trigger and manage GitHub Actions workflow runs |
| `issues` | read/write | Create and update issues, link to PRs |
| `metadata` | read | Required baseline for all fine-grained PATs |
| `administration` | read | Inspect repo settings (branch protection, environments) |

#### How to rotate

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Regenerate or create a new token with the permissions above, scoped to `advance-research-and-development-llc/TrueAI`
3. Update the secret: `gh secret set AGENT_AUTOMATION_TOKEN --repo advance-research-and-development-llc/TrueAI`
4. Update the expiry date in this document

> ⚠️ Never commit this token to source. Rotate immediately if exposed.

---

## 4. Environments

Three deployment environments are configured in **Settings → Environments**:

| Environment | Required Reviewer | Purpose |
|---|---|---|
| `development` | — | Automated deploys on every push to `main` |
| `staging` | — | Pre-release validation and integration testing |
| `release` | `@smackypants` | Production releases; requires manual approval |

---

## 5. Security

- Dependabot vulnerability alerts: **enabled**
- Dependabot automated security fixes: **enabled**
- Default workflow permissions: **read and write**
- Actions can create and approve pull requests: **enabled**
- GPG commit signing: enforced locally (key `1B901A8C74A78E8E`)
