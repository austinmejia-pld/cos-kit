# CoS Kit

Portable Chief of Staff architecture: one front-door agent, domain sub-agents, reusable skills, and privacy-safe export.

## Goals

- Single-entity UX for end users
- Reactive + proactive workflows
- Durable memory per domain
- Clean separation between framework and private state
- Easy export to GitHub without personal context

## Repository Structure

```text
agents/ # Agent role definitions and routing rules
skills/ # Reusable capabilities (portable)
workflows/ # Reactive triggers + recurring cron jobs
templates/ # User-safe templates for first-run setup
scripts/ # Bootstrap/export utilities
```

## Interview Schema Validation

Validates `sample-input.json` and `sample-output.json` against their JSON Schema contracts.

```bash
bash scripts/validate-interview-schema.sh
```

Requires [`ajv-cli`](https://github.com/ajv-validator/ajv-cli). Install with:

```bash
npm install -g ajv-cli
```

## Adding a New Skill (Auto-Visibility)

After creating a new `skills/<name>/SKILL.md` and schemas, run:

```bash
npm run sync:skills
```

This regenerates:

- `orchestration/skill-registry.yaml`
- `state/skill-command-map.json` (IDE-agnostic mapping artifact)
- `config/skill-wrapper.config.json`
- `.claude/commands/*.md`

Use `npm run sync:skills:core` when you only need the IDE-agnostic map (for non-Claude runtimes).
