# Skill Wrapper

Thin command wrapper for CoS Kit skills. Maps slash commands to existing skill runtimes, returns concise markdown insights by default, and persists full JSON artifacts for debugging.

## Philosophy

The wrapper is **glue only**. All analysis logic, validation, and normalization live in the skill runtimes (`src/skills/*/`). The wrapper handles three things:

1. Command parsing — `/xray --focus "handoffs"` → skill name + flags
2. Runtime dispatch — resolve the skill, map flags to input fields, call the runtime
3. Output formatting — return a concise markdown summary (not raw JSON)

## Enable / Disable

The wrapper is controlled by `config/skill-wrapper.config.json`:

```json
{
  "enabled": true,
  "exposeRawJsonByDefault": false,
  "artifactDir": ".artifacts/skill-runs",
  "commands": { ... }
}
```

- Set `enabled: false` to disable all commands. The wrapper returns `{ mode: "passthrough" }`.
- Programmatic override: `initSkillWrapper({ enabled: false })`.

## Commands

| Command | Skill | Status |
|---------|-------|--------|
| `/xray` | execution-friction-xray | Active |
| `/commitments` | commitment-extractor | Active |
| `/stakeholders` | stakeholder-analysis | Active |
| `/decision-audit` | decision-quality-audit | Active |
| `/risks` | meeting-risk-analysis | Active |
| `/redteam` | redteam | Active |
| `/interview` | interview-analysis | Active |

## Self-Maintaining Command Sync

Skill visibility is generated, not hand-maintained.

### Scripts

- `npm run generate:skill-registry` → rebuilds `orchestration/skill-registry.yaml`
- `npm run sync:skill-commands-core` → builds IDE-agnostic `state/skill-command-map.json`
- `npm run sync:claude-commands` → generates:
  - `config/skill-wrapper.config.json` command map
  - `.claude/commands/*.md` command files for Claude Desktop/Claude Code
- `npm run sync:skills` → full pipeline (`registry -> core map -> claude commands`)
- `npm run sync:skills:core` → non-Claude pipeline (`registry -> core map` only)

### Alias Overrides

Friendly command aliases live in `orchestration/skill-command-aliases.json`.

- If a skill has an alias (for example `execution-friction-xray -> xray`), that alias is used.
- If no alias exists, the default command is the skill name (for example `new-skill -> /new-skill`).

### Modularity Boundary

Claude-native command generation is isolated to the adapter script (`scripts/sync-claude-commands.ts`) and `.claude/commands` artifacts.

- Core mapping logic (`scripts/sync-skill-commands-core.ts`) is IDE-agnostic and reusable by other runtimes (for example OpenClaw).
- Other runtimes can consume `state/skill-command-map.json` without requiring `.claude/commands` files.

### Registry-Driven Command Listing Descriptions

Claude command listing descriptions are generated from each skill's `description` in `orchestration/skill-registry.yaml` (which comes from `SKILL.md` frontmatter).

- Improving a skill description in `SKILL.md` automatically improves the command listing after `npm run sync:skills`.
- New skills inherit detailed listing descriptions automatically; no manual command file edits are required.

## Flags

| Flag | Type | Description |
|------|------|-------------|
| `--raw` | boolean | Return full JSON instead of markdown summary |
| `--focus "<text>"` | string | Mapped to the skill's focus field (`focus_area`, `focus_person`, `focal_decision`, etc.) |
| `--depth quick\|standard\|deep` | enum | Mapped to `analysis_depth` (supported by execution-friction-xray) |

## Examples

```
/xray
/xray --focus "handoff risk"
/xray --depth deep --raw
/commitments --focus "Diana Osei"
/decision-audit --depth deep
/stakeholders --raw
```

## Output Modes

- **Insight** (default): Concise markdown with headline, top insights, next actions, and highest leverage move. Raw JSON is never shown.
- **Raw** (`--raw`): Pretty-printed JSON output. Includes the artifact path for reference.
- **Passthrough**: Returned when the wrapper is disabled. No-op.
- **Error**: Concise error message. Includes artifact path when available.

## Artifact Storage

Every successful skill run persists the full raw JSON result to disk:

```
.artifacts/skill-runs/{skill-name}-{ISO-timestamp}-{uuid-prefix}.json
```

Example:
```
.artifacts/skill-runs/execution-friction-xray-2026-03-12T22-30-00-000Z-a1b2c3d4.json
```

Artifacts are written regardless of output mode (insight or raw). They contain the complete skill result including `data`, `diagnostics`, and `ok` status.

The `.artifacts/` directory is created automatically on first run. Add it to `.gitignore` if you don't want artifacts tracked.

## Integration

```typescript
import { initSkillWrapper, handleWrappedCommand } from "./src/wrapper/index.js";

// 1. Initialize with an LLM client
initSkillWrapper({
  llmClient: {
    chat: async (messages) => {
      // Your LLM call here — return raw string response
      return await callYourLLM(messages);
    },
  },
});

// 2. Handle commands
const result = await handleWrappedCommand("/xray --focus 'handoffs'", {
  transcript: "...",
});

// result.mode === "insight" | "raw" | "passthrough" | "error"
// result.content === markdown string or JSON string
// result.artifactPath === path to persisted JSON (when available)
```
