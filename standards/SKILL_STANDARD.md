# Skill Standard

## Package Structure

Every skill lives in `skills/<skill-name>/` and must contain:

```
skills/<skill-name>/
  SKILL.md                          # Specification
  schemas/input.schema.json         # Input contract (JSON Schema draft-07)
  schemas/output.schema.json        # Output contract (JSON Schema draft-07)
  examples/sample-input.json        # Validates against input schema
  examples/sample-output.json       # Validates against output schema
  scripts/validate-<skill-name>.sh  # Runs schema validation on examples
```

No other files are required. Do not add README, CHANGELOG, or other docs per skill unless a specific need is documented and approved.

## Naming Conventions

- **Skill directory:** lowercase, hyphen-separated. E.g., `interview-analysis`, `transcript-decision-extraction`.
- **SKILL.md:** always uppercase, always at package root.
- **Schema files:** always `input.schema.json` and `output.schema.json` inside `schemas/`.
- **Example files:** always `sample-input.json` and `sample-output.json` inside `examples/`.
- **Validation script:** `validate-<skill-name>.sh` inside `scripts/`.

## SKILL.md Frontmatter

Every SKILL.md must begin with exactly these frontmatter fields:

```yaml
---
name: <skill-name>
description: <one-line description of what the skill does>
---
```

No other frontmatter fields. The body of SKILL.md contains the full specification: purpose, workflow steps, scoring/evaluation rules, failure handling, and output requirements.

## Output Contract Discipline

- The output JSON schema (`schemas/output.schema.json`) is the canonical definition of what the skill produces.
- SKILL.md may describe output fields in prose, but the schema wins if there is any conflict.
- All required fields in the output schema must be present in every response, including error/degraded cases.
- Schema version is tracked in the schema file's `title` or `description` field (e.g., `"title": "interview-analysis-output-v1"`).

## Failure Behavior

Skills must return schema-valid output whenever possible, even in degraded cases. Specifically:

- **Insufficient input:** Return valid output with lowered confidence, empty arrays where appropriate, and a clear explanation in summary/rationale fields.
- **Missing optional fields:** Proceed with available data. Do not fail on missing optional input.
- **Unrecoverable error:** If schema-valid output is truly impossible, return the closest valid structure with an explicit error description in the relevant text field.

Skills must never silently drop required output fields or return invalid JSON.

## Testing Requirements

- `examples/sample-input.json` must validate against `schemas/input.schema.json`.
- `examples/sample-output.json` must validate against `schemas/output.schema.json`.
- `scripts/validate-<skill-name>.sh` must run both validations and exit 0 on success, 1 on failure.
- Schema validation must pass before any PR adding or modifying a skill is merged.

## Versioning

- Skill versions follow `v1`, `v1.1`, `v2` convention.
- Track version in the schema `title` field (e.g., `"title": "interview-analysis-output-v1"`).
- Breaking changes to required output fields require a major version bump (v1 → v2).
- Additive changes (new optional fields) are minor bumps (v1 → v1.1).
- When bumping a major version, update all downstream agents and routes that reference the skill.

## Skill Registry

Adding or modifying a skill requires regenerating the skill registry:

```bash
bash scripts/generate-skill-registry.sh
```

This script scans all `skills/*/SKILL.md` files, extracts `name` and `description` from frontmatter, and writes `orchestration/skill-registry.yaml`. The front door agent reads this file to discover available skills — it is the single source of truth for skill discovery at runtime.

The registry is auto-generated and must not be edited manually. Commit the updated registry alongside any skill changes.

## No Extra Docs Clutter

Each skill package contains only the files listed in Package Structure above. Avoid:

- Per-skill README files (the SKILL.md is the README)
- Per-skill CHANGELOG files (use git history)
- Per-skill TODO or ROADMAP files (use issues)
- Duplicate or derivative documentation
