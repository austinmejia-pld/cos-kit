# Definition of Done

## A) New Skill

- [ ] Skill directory follows naming convention: `skills/<skill-name>/`
- [ ] `SKILL.md` exists with required frontmatter (`name`, `description`)
- [ ] `SKILL.md` body defines purpose, workflow, failure handling, and output requirements
- [ ] `schemas/input.schema.json` exists and is valid JSON Schema (draft-07)
- [ ] `schemas/output.schema.json` exists and is valid JSON Schema (draft-07)
- [ ] `examples/sample-input.json` exists and validates against input schema
- [ ] `examples/sample-output.json` exists and validates against output schema
- [ ] `scripts/validate-<skill-name>.sh` exists and passes (exit 0)
- [ ] No extra files beyond the required package structure
- [ ] Skill registry regenerated: `bash scripts/generate-skill-registry.sh`
- [ ] `orchestration/skill-registry.yaml` includes the new skill with correct name, description, and paths
- [ ] Privacy check: example files contain no real PII or credentials
- [ ] Commit message follows conventional style (e.g., `feat(skills): add <skill-name>`)

## B) New Agent

- [ ] Agent directory follows convention: `agents/<domain>/`
- [ ] `AGENT.md` exists with all minimum contract fields (mission, scope, inputs, outputs, memory policy, run policy)
- [ ] Run policy defaults to `reactive_only: true`
- [ ] Memory policy documents what is written, where, and what is excluded
- [ ] Memory directory exists: `memory/<domain>/`
- [ ] `memory/<domain>/README.md` documents event schema
- [ ] Memory directory is covered by `.gitignore`
- [ ] Agent references valid skill(s) with correct schema paths
- [ ] Privacy check: no secrets or unnecessary PII in agent spec or memory schema
- [ ] Commit message follows conventional style (e.g., `feat(agents): add <domain> agent`)

## C) Route Integration

- [ ] Route entry added to `orchestration/routes.yaml`
- [ ] Route has all required keys: `id`, `status`, `trigger_examples`, `required_inputs`, `target`, `fallback_prompt`, `run_policy`
- [ ] `target` references valid agent and/or skill paths
- [ ] `output_schema` points to the correct schema file
- [ ] `fallback_prompt` clearly tells the user what inputs are needed
- [ ] `run_policy.reactive_only` is `true` (unless proactive behavior is explicitly approved)
- [ ] Routes YAML is valid (parseable without errors)
- [ ] If route is `active`: target skill and agent both pass their respective DoD checklists
- [ ] Commit message follows conventional style (e.g., `feat(orchestration): add <route-id> route`)

## D) Export Readiness

- [ ] `.gitignore` covers all Forbidden-class data (memory, state, logs, cache, secrets)
- [ ] `scripts/export-template.sh` runs without errors
- [ ] Export output contains no files from Forbidden-class directories
- [ ] All `examples/` files use fictional names and placeholder emails
- [ ] No hardcoded credentials or API keys in any committed file
- [ ] All templates are sanitized (no personal identifiers or org-specific details)
- [ ] Pre-publish checklist in `standards/PRIVACY_EXPORT_POLICY.md` passes
- [ ] Commit message follows conventional style

## Hard Gates

These must pass before any PR is merged:

1. **Schema validation passes** — all `validate-*.sh` scripts exit 0
2. **Sample fixtures pass** — example files validate against their schemas
3. **Skill registry current** — `orchestration/skill-registry.yaml` reflects all skills (run `scripts/generate-skill-registry.sh`)
4. **Privacy checks pass** — no Forbidden-class data in committed files
5. **Docs updated** — relevant standards, agent specs, or skill specs reflect the change
6. **Conventional commit** — commit message follows `type(scope): description` format
