# Privacy & Export Policy

## Data Classes

| Class | Description | Examples | Export Policy |
|---|---|---|---|
| **Framework** | Standards, skill specs, agent specs, schemas, scripts | `standards/`, `skills/*/SKILL.md`, `schemas/`, `scripts/` | Allowed |
| **Config** | Route definitions, workflow definitions, templates | `orchestration/`, `workflows/`, `templates/` | Allowed |
| **Memory** | Persistent domain data accumulated over time | `memory/`, event logs, trend notes, calibration data | Forbidden |
| **State** | Runtime data, caches, intermediate results | `state/`, `cache/`, `logs/` | Forbidden |
| **Secrets** | Credentials, tokens, API keys, environment variables | `.env`, `.tokens/`, `.secrets/` | Forbidden |

## Default .gitignore Expectations

The repository `.gitignore` must exclude all Forbidden-class data. At minimum:

```gitignore
# Memory and state (private)
memory/
state/
logs/
cache/

# Secrets
.env
.env.*
.tokens/
.secrets/

# Artifacts
*.db
*.sqlite*
*.log
```

Any new directory or file pattern containing private data must be added to `.gitignore` before the first commit that introduces it.

## Pre-Publish Checklist

Before publishing, exporting, or sharing the repository:

- [ ] Run `git status` — no untracked private files
- [ ] Verify `.gitignore` covers all Forbidden-class paths
- [ ] Run `scripts/export-template.sh` to generate a sanitized copy
- [ ] Review the export directory — no memory, state, logs, cache, tokens, or secrets present
- [ ] Check `examples/` files — no real names, emails, or org-specific details in sample data
- [ ] Check templates — no personal identifiers in template files
- [ ] Verify no hardcoded credentials or API keys in any committed file

## Sanitization Requirements

Template and example files intended for export must:

- Use fictional names (e.g., "Jordan Lee", "Acme Corp") instead of real people or organizations.
- Use placeholder emails (e.g., `user@example.com`) instead of real addresses.
- Remove or generalize org-specific details (team names, internal tool names, proprietary processes).
- Use realistic but non-sensitive data for rubrics, transcripts, and other domain content.

If a real-data example is needed during development, keep it in `memory/` or `state/` (gitignored), not in `examples/`.

## Incident Response: Accidental Private Data Commit

If private data (memory, state, secrets, PII) is accidentally committed:

1. **Do not push.** If the commit has not been pushed, amend or reset locally to remove the data.
2. **If already pushed:**
   a. Remove the file and commit the removal immediately.
   b. Rotate any exposed secrets (API keys, tokens, passwords) immediately.
   c. Use `git filter-branch` or `git filter-repo` to scrub the data from history.
   d. Force-push the cleaned history (coordinate with collaborators).
   e. Check GitHub's cached views and any forks for lingering exposure.
3. **Post-incident:** Add the file pattern to `.gitignore` and update this policy if a new class of private data was discovered.
