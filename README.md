# CoS Kit

Portable Chief of Staff architecture: one front-door agent, domain sub-agents, reusable skills, and privacy-safe export.

## Goals

- Single-entity UX for end users
- Reactive + proactive workflows
- Durable memory per domain
- Clean separation between framework and private state
- Easy export to GitHub without personal context

## Skills

All skills can be invoked either with `run <skill-name>` or with the generated slash command.

### 1) Execution Friction X-Ray

- **Skill name:** `execution-friction-xray`
- **Slash command:** `/friction`
- **Description:** Diagnose execution drag from a meeting transcript by identifying friction hotspots, scoring severity/likelihood, and producing a concrete 7-day friction-kill plan with evidence citations.
- **How to use:**
  - `run execution-friction-xray`
  - `/friction`
- **Optional inputs:** `meeting_title`, `meeting_datetime`, `team_context`, `focus_area`, `urgency_level`, `analysis_depth`, `participant_directory`, `key_questions`

### 2) Commitment Extractor

- **Skill name:** `commitment-extractor`
- **Slash command:** `/commitments`
- **Description:** Identify explicit and implied commitments from transcripts/emails, normalize owner/date/artifact fields, and output an accountability-ready action list with evidence citations.
- **How to use:**
  - `run commitment-extractor`
  - `/commitments`
- **Optional inputs:** `meeting_title`, `meeting_datetime`, `default_timezone`, `participant_directory`, `focus_person`, `extraction_mode`, `include_non_actionable`

### 3) Stakeholder Analysis

- **Skill name:** `stakeholder-analysis`
- **Slash command:** `/stakeholders`
- **Description:** Analyze meeting transcripts and decision context to map stakeholders, infer stances/incentives, identify coalition dynamics and execution risks, and produce an actionable engagement plan.
- **How to use:**
  - `run stakeholder-analysis`
  - `/stakeholders`
- **Optional inputs:** `analysis_goal`, `focal_decision`, `org_context`, `stakeholder_directory`, `key_questions`, `time_horizon`, `confidence_threshold`

### 4) Decision Quality Audit

- **Skill name:** `decision-quality-audit`
- **Slash command:** `/decision-audit`
- **Description:** Audit decision quality from a meeting transcript by scoring clarity, evidence, alternatives, risk analysis, and accountability; then propose concrete decision-hygiene upgrades.
- **How to use:**
  - `run decision-quality-audit`
  - `/decision-audit`
- **Optional inputs:** `meeting_title`, `meeting_datetime`, `decision_focus`, `strategic_context`, `risk_tolerance`, `analysis_depth`, `participant_directory`, `key_questions`

### 5) Meeting Risk Analysis

- **Skill name:** `meeting-risk-analysis`
- **Slash command:** `/risks`
- **Description:** Analyze a meeting transcript to surface risks, unresolved tensions, hidden assumptions, decision gaps, and recommended actions with evidence-backed citations.
- **How to use:**
  - `run meeting-risk-analysis`
  - `/risks`
- **Optional inputs:** `meeting_date`, `domain`, `objectives` (required base fields include `meeting_id`, `meeting_title`, `transcript`, `participants`, and `context`)

### 6) Redteam

- **Skill name:** `redteam`
- **Slash command:** `/redteam`
- **Description:** Adversarial analysis of a meeting transcript to surface failure modes, hidden assumptions, and decision risks in transcript-only or transcript-plus-focus mode.
- **How to use:**
  - `run redteam`
  - `/redteam`
- **Optional inputs:** `context`, `audience`, `risk_tolerance`, `focus_idea`, `focus_questions`, `constraints`

### 7) Interview Analysis

- **Skill name:** `interview-analysis`
- **Slash command:** `/interview`
- **Description:** Analyze an interview transcript against a role rubric to produce evidence-backed dimension scores, a hire recommendation, and interviewer coaching feedback.
- **How to use:**
  - `run interview-analysis`
  - `/interview`
- **Optional inputs:** `interviewer`, `must_have_requirements`, `interview_date`, `interview_id`, `rubric_version` (required base fields include `candidate_name`, `role`, `stage`, `transcript`, and `rubric`)

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
