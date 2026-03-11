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
