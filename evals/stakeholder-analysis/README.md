# Stakeholder Analysis Eval Harness

Deterministic quality gate for the `stakeholder-analysis` skill. Runs the full pipeline (`runStakeholderAnalysis`) against pre-baked LLM responses and checks the output against a suite of assertions. No actual LLM calls — results are repeatable.

## How to Run

**CLI runner** (standalone, colored output):

```bash
npm run eval:stakeholder-analysis
```

**Vitest** (as part of the full test suite):

```bash
npm test
```

Both execute the same pipeline and assertions. The CLI runner prints a per-assertion report with a summary score. Vitest wraps the same logic in `describe`/`it` blocks.

## Case File Format

Each `.case.json` in `evals/stakeholder-analysis/cases/` has this structure:

```json
{
  "id": "transcript-only",
  "description": "Human-readable description of what this case tests",
  "input": { ... },
  "model_response": { ... },
  "expect": {
    "min_stakeholders": 3,
    "min_risks": 2,
    "min_engagement_steps": 3,
    "min_citations": 2,
    "expected_mode": "transcript_only",
    "known_stakeholder_names": ["Alice", "Bob"]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier, used in test names and CLI output |
| `description` | `string` | What this case covers |
| `input` | `object` | Valid `StakeholderAnalysisInput` — passed as the first arg to `runStakeholderAnalysis` |
| `model_response` | `object` | Simulated LLM output — serialized to JSON and passed as the second arg |
| `expect` | `CaseExpect` | Per-case thresholds for the assertions module (see below) |

### `expect` Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `min_stakeholders` | `number` | yes | Minimum stakeholders in output |
| `min_risks` | `number` | yes | Minimum risks in output |
| `min_engagement_steps` | `number` | yes | Minimum engagement plan entries |
| `min_citations` | `number` | yes | Minimum citations |
| `expected_mode` | `string` | yes | `"transcript_only"` or `"transcript_plus_context"` — must match `metadata.mode_used` |
| `known_stakeholder_names` | `string[]` | no | If present, every stakeholder name in the output must appear in this list (hallucination check) |

## How to Add a New Case

1. Create `evals/stakeholder-analysis/cases/{your-case-id}.case.json`.
2. Populate `input` with a valid `StakeholderAnalysisInput` (see `schemas/stakeholder-analysis.input.schema.json`).
3. Populate `model_response` with a valid output object that the LLM would plausibly return (see `schemas/stakeholder-analysis.output.schema.json`).
4. Set `expect` thresholds appropriate for this case.
5. Run `npm run eval:stakeholder-analysis` to verify.

The CLI runner auto-discovers all `*.case.json` files in the `cases/` directory — no registration step needed.

## Assertion Reference

| # | Name | What It Checks |
|---|---|---|
| 1 | `schema_valid` | Pipeline returned `ok: true` (input valid, JSON parsed, output validated) |
| 2 | `min_stakeholders` | `stakeholders.length >= expect.min_stakeholders` |
| 3 | `stakeholder_profiles_complete` | Every stakeholder has `stance`, `influence_level`, and at least 1 `evidence` entry |
| 4 | `min_risks` | `risks.length >= expect.min_risks`, each has `severity` and `likelihood` |
| 5 | `min_engagement_steps` | `engagement_plan.length >= expect.min_engagement_steps` |
| 6 | `actions_accountable` | Every `next_7_day_actions` entry has non-empty `owner`, `due`, `proof_artifact` |
| 7 | `min_citations` | `citations.length >= expect.min_citations` |
| 8 | `recommendation_valid` | If `recommended_path` exists, `status` is `"actionable"` or `"insufficient_information"` |
| 9 | `no_hallucinated_stakeholders` | Every stakeholder name exists in `expect.known_stakeholder_names` (skipped if not provided) |
| 10 | `metadata_mode_correct` | `metadata.mode_used` matches `expect.expected_mode` |

If the pipeline fails (`ok: false`), only `schema_valid` runs — all others are auto-failed with "Skipped — pipeline returned ok: false".

## How to Extend Assertions

1. Open `evals/stakeholder-analysis/assertions.ts`.
2. Add a new function following the pattern:
   ```typescript
   function assertYourCheck(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
     const name = "your_check";
     // ... logic ...
     return ok(name, "detail") or fail(name, "detail");
   }
   ```
3. Add it to the `runAssertions` function body (after the `ok` guard).
4. If needed, add new fields to `CaseExpect` in the same file.
5. Run the eval to verify.

## Interpreting Results

**CLI output:**

```
[PASS] transcript-only: schema_valid (Pipeline returned ok: true)
[PASS] transcript-only: min_stakeholders (4 >= 3)
[FAIL] transcript-only: min_citations (1 < 2)
...
Score: 18/20 (90%)
```

- **PASS**: Assertion met its criteria.
- **FAIL**: Either a threshold wasn't met, a required field is missing, or a hallucinated name was found. The detail string explains why.
- **Exit code 0**: All assertions passed across all cases.
- **Exit code 1**: At least one assertion failed.

**Debugging a failure:**

1. Read the `detail` string — it tells you exactly what's wrong (e.g., `"2 < 3"` means the output had 2 items but needed 3).
2. Check the case file's `model_response` — the simulated LLM output may not have enough data for the threshold.
3. If the pipeline itself failed (`schema_valid` is FAIL), check the `error.stage` and `error.message` in the RunResult.
4. If normalization is the issue, check `src/skills/stakeholder-analysis/mapper.ts` — enum synonyms and clamping logic live there.

## Architecture

```
cases/*.case.json    →  run.ts (CLI)     →  runStakeholderAnalysis()  →  assertions.ts  →  report
                     →  e2e.test.ts (Vitest)  →  same pipeline       →  same assertions →  test results
```

Both entry points use the same pipeline and assertion module. The case files are the single source of truth for test data.
