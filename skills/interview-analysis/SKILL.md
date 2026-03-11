---
name: interview-analysis
description: Analyze an interview transcript against a role rubric to produce evidence-backed dimension scores, a hire recommendation, and interviewer coaching feedback. Use when you have a structured transcript and rubric and need a consistent, schema-valid evaluation output.
---

## 1. Purpose

Produce a structured, evidence-grounded interview evaluation. Output must conform to the canonical output schema. Never fabricate evidence. Prefer explicit uncertainty over false confidence.

Canonical contracts:
- Input: `skills/interview-analysis/schemas/input.schema.json`
- Output: `skills/interview-analysis/schemas/output.schema.json`

---

## 2. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm all required input fields are present (`candidate_name`, `role`, `stage`, `transcript`, `rubric`). If any are missing or the transcript is below 50 characters, apply Failure Handling (§8) immediately.

**Step 2 — Parse the rubric.**
Extract each dimension: `name`, `description`, `must_have` flag, and any score anchors. Note which dimensions are must-haves. Record `must_have_requirements` if provided alongside the rubric.

**Step 3 — Read the transcript without scoring.**
Read the full transcript once to build context: pacing, question types, candidate communication style, any interviewer artifacts (leading questions, interruptions, topic skips).

**Step 4 — Score each dimension.**
For each rubric dimension:
1. Locate all relevant transcript passages.
2. Extract verbatim quote(s) as `evidence_quotes`. At least one direct quote is required — do not assign a score without it.
3. Assign a score (1–4) anchored to the rubric definitions and calibrated to the expected level for the role and stage.
4. Write a concise `rationale` linking the score to the evidence.

If no usable evidence exists for a dimension, do not guess. Record the dimension with the lowest defensible score, note "insufficient evidence" in the rationale, reduce `confidence`, and add a risk flag.

**Step 5 — Identify strengths and concerns.**
- `strengths`: dimensions where candidate scored 3–4, with specific behavioral evidence.
- `concerns`: dimensions where candidate scored 1–2, or where evidence is thin.

**Step 6 — Apply bias and quality checks (§6).**
Review your scores for the patterns listed in §6 before finalizing.

**Step 7 — Determine recommendation (§4).**
Apply the recommendation policy using dimension scores and must-have performance.

**Step 8 — Generate interviewer feedback.**
Assess the quality of the interview itself: coverage gaps, leading questions, missed probes. Write actionable coaching notes in `interviewer_feedback`.

**Step 9 — Generate follow-up questions.**
For each dimension with weak signal or missing evidence, write one targeted behavioral question for a follow-up interview.

**Step 10 — Assemble and validate output.**
Construct the full output object. Verify it satisfies the output schema before returning. All required fields must be present and non-empty where schema mandates it.

---

## 3. Scoring Policy

| Score | Label | Meaning |
|-------|-------|---------|
| 1 | Below bar | Clear gaps; candidate did not demonstrate the competency |
| 2 | Partial / mixed evidence | Some signal but inconsistent or incomplete |
| 3 | Meets bar | Solid, consistent evidence that satisfies the role requirement |
| 4 | Exceeds bar | Exceptional evidence; materially above expectations for level and stage |

**Calibration:** Scores are relative to the expected level for the stated `role` and `stage`. A "3" for a senior engineer panel is a higher absolute bar than a "3" for a recruiter screen. Use rubric anchors when provided; apply consistent level calibration when anchors are absent.

**Evidence requirement:** Do not assign a dimension score without at least one direct evidence quote from the transcript.

---

## 4. Recommendation Policy

| Value | Criteria |
|-------|----------|
| `strong_yes` | No critical concerns; must-haves all ≥3; mostly 3s and 4s; strong evidence throughout |
| `yes` | Meets bar overall; concerns are manageable and non-critical |
| `mixed` | Conflicting signals, thin evidence on key dimensions, or unresolved must-have questions requiring follow-up |
| `no` | Clear below-bar performance on important (non-must-have) dimensions |
| `strong_no` | Below bar on one or more must-have dimensions, or multiple critical dimensions at 1 |

**Hard rules:**
- Recommendation must be consistent with dimension scores and must-have requirement performance.
- When must-have dimensions are below bar, do not return `strong_yes`.
- A single high score does not override a pattern of 1s and 2s.

---

## 5. Evidence Rules

- Every `dimension_score` object must include at least one verbatim quote in `evidence_quotes`. The output schema enforces `minItems: 1`.
- Quotes must come directly from the transcript. Do not paraphrase as if quoting.
- Distinguish "not observed" (no relevant exchange) from "negative evidence" (observed and it was poor). Treat them differently in rationale and risk flags.
- If transcript evidence is insufficient for a dimension, lower `confidence` and add a risk flag for weak signal.
- Prefer explicit uncertainty over fabricated certainty. It is better to say "insufficient evidence to score confidently" than to assert a score that cannot be grounded.

---

## 6. Bias & Quality Checks

Before finalizing scores, apply each check:

1. **Communication polish vs. competency signal.** Do not conflate articulateness or presentation confidence with actual competency. Fluent delivery is not evidence of technical depth or sound judgment.

2. **Accent and non-native fluency.** Do not penalize accent or non-native English unless the role explicitly requires native-level fluency and the rubric defines it as a scored dimension.

3. **Interviewer artifacts.** Flag potential leading-question artifacts — where the interviewer provided the answer or heavily scaffolded the response before the candidate spoke. Do not credit the candidate for mirroring an interviewer-supplied framing.

4. **"Not observed" ≠ negative evidence.** If a topic was never raised, note the coverage gap in `interviewer_feedback` and generate a follow-up question. Do not score a dimension down solely because it was not covered.

5. **Recency and halo bias.** Assess all parts of the transcript, not only the most recent or most memorable exchange.

---

## 7. Output Requirements

Output must be a valid JSON object conforming to `skills/interview-analysis/schemas/output.schema.json`.

Required fields and key constraints:
- `recommendation`: one of `strong_yes | yes | mixed | no | strong_no`
- `confidence`: float 0.0–1.0 reflecting overall evidence quality and coverage
- `decision_summary`: string ≥20 characters summarizing the hire/no-hire rationale
- `dimension_scores`: one entry per rubric dimension; each entry requires `dimension` (name), `score` (1–4 integer), `rationale` (string), `evidence_quotes` (array, minItems: 1)
- `strengths`: array of strings (may be empty array if none)
- `concerns`: array of strings (may be empty array if none)
- `risk_flags`: array of strings — use for weak signal, coverage gaps, must-have concerns, or bias flags
- `interviewer_feedback`: array of actionable coaching notes
- `follow_up_questions`: array of targeted behavioral questions for dimensions with weak signal

Do not include fields not defined in the output schema (`additionalProperties: false`).

---

## 8. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|-----------|--------|
| Transcript < 50 characters or garbled beyond interpretation | Set `confidence` ≤ 0.2, `recommendation: mixed`, populate `risk_flags` with `"transcript_insufficient"`, populate `follow_up_questions` with probes for every rubric dimension, write `decision_summary` explaining the limitation |
| Missing required input field | Return a schema-valid output with `confidence: 0`, `recommendation: mixed`, `decision_summary` naming the missing field, all array fields as empty arrays or minimal placeholders |
| Rubric dimension has no anchors | Apply general 1–4 calibration against role/stage; note "no anchors provided" in that dimension's rationale |
| Interviewer questions not distinguishable from candidate responses | Note in `risk_flags`, flag affected dimension scores with reduced confidence rationale, and generate follow-up questions |

---

## 9. Minimal Example Invocation Contract

Input shape — see `skills/interview-analysis/schemas/input.schema.json` for the full contract.

Minimum viable input:
```json
{
  "candidate_name": "string",
  "role": "string",
  "stage": "onsite",
  "transcript": "string (≥50 chars)",
  "rubric": {
    "dimensions": [
      {
        "name": "string",
        "description": "string",
        "scale_min": 1,
        "scale_max": 4
      }
    ]
  }
}
```

Output shape — see `skills/interview-analysis/schemas/output.schema.json` for the full contract.

Minimum valid output skeleton:
```json
{
  "recommendation": "mixed",
  "confidence": 0.5,
  "decision_summary": "string (≥20 chars)",
  "dimension_scores": [
    {
      "dimension": "string",
      "score": 2,
      "rationale": "string",
      "evidence_quotes": ["direct transcript quote"]
    }
  ],
  "strengths": [],
  "concerns": [],
  "risk_flags": [],
  "interviewer_feedback": [],
  "follow_up_questions": []
}
```

Do not embed full example transcripts or extended output samples in this skill file. Use the schema files as the canonical reference.
