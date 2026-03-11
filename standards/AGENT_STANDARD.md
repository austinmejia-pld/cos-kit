# Agent Standard

## When to Use an Agent

Create an agent only when the functionality requires at least one of:

- **Statefulness:** Reading or writing to memory/state across invocations.
- **Multi-skill orchestration:** Coordinating multiple skills in a workflow.
- **Domain-specific judgment:** Applying rules or policies that go beyond any single skill's scope.

If none of these apply, implement the functionality as a skill instead. See the decision rubric in `standards/ARCHITECTURE_CHARTER.md`.

## Agent Minimum Contract

Every agent lives in `agents/<domain>/AGENT.md` and must define:

| Field | Description |
|---|---|
| **Mission** | One sentence: what this agent owns and why it exists. |
| **Scope** | What this agent is responsible for and what is explicitly out of scope. |
| **Inputs** | What data the agent requires to run. Reference input schemas where applicable. |
| **Outputs** | What the agent produces. Reference output schemas where applicable. |
| **Memory policy** | What the agent writes to memory, in what format, and what it never stores. |
| **Run policy** | How the agent is triggered. Default: `reactive_only: true`. |

## Run Policy Defaults

- All agents default to `reactive_only: true`.
- An agent runs only when triggered by a user request routed through the front door.
- Proactive or scheduled behavior (cron, heartbeat, polling) must be:
  1. Defined in a separate workflow file under `workflows/cron/`.
  2. Disabled by default.
  3. Explicitly opted into by the user.

## Delegation Policy

- Agents may invoke skills to perform discrete units of work.
- The Front Door Agent discovers available skills by reading `orchestration/skill-registry.yaml` (auto-generated; see `standards/SKILL_STANDARD.md` § Skill Registry).
- Agents may read from and write to their domain's memory directory (`memory/<domain>/`).
- Agents never speak directly to the user. The Front Door Agent owns all user-facing communication.
- An agent's output is structured data returned to the front door, which decides how to present it.

## Memory Write Policy

- **Append-only** where applicable. Prefer appending events to a JSONL log over mutating existing records.
- **No secrets.** Agents must never write API keys, tokens, passwords, or credentials to memory.
- **No PII in logs.** If memory includes personal identifiers (names, emails), they must be necessary for the domain function and documented in the agent's memory policy.
- **Schema-defined.** The structure of memory events should be documented in `memory/<domain>/README.md`.

## Observability

Every agent run must produce a log record (to `logs/` or the domain's event log) with these fields:

| Field | Type | Required |
|---|---|---|
| `timestamp` | ISO 8601 | Yes |
| `route` | string (route ID from `orchestration/routes.yaml`) | Yes |
| `status` | `success` \| `partial` \| `error` | Yes |
| `duration_ms` | integer | Yes |
| `confidence` | float (0.0–1.0) | No |
| `error_detail` | string | Only if status is `error` |

## Decommission Rule

Collapse an agent back into skill-only when:

- The agent's memory/state capabilities are no longer used.
- The orchestration reduces to invoking a single skill with no additional logic.
- The domain no longer requires cross-invocation state.

When decommissioning: migrate any essential memory data, update routes to point directly to the skill, and remove the agent directory.

## New Agent Template

Use this template when creating a new agent:

```markdown
# <Domain> Agent

## Mission

<One sentence: what this agent owns and why.>

## Scope

**In scope:**
- <responsibility 1>
- <responsibility 2>

**Out of scope:**
- <exclusion 1>

## Inputs

- <input 1> — <description> (see `skills/<name>/schemas/input.schema.json`)

## Outputs

- <output 1> — <description> (see `skills/<name>/schemas/output.schema.json`)

## Core Workflow

1. <step>
2. <step>
3. <step>

## Memory Policy

- **Writes to:** `memory/<domain>/events.jsonl`
- **Event schema:** <describe or reference README>
- **Never stores:** secrets, credentials, raw transcripts

## Run Policy

- `reactive_only: true`
- Triggered via: <route ID or description>

## Non-Negotiables

- <hard rule 1>
- <hard rule 2>
```
