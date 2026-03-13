---
name: redteam
description: Adversarial analysis of a meeting transcript to surface failure modes, hidden assumptions, and decision risks. Use when stress-testing a strategy, proposal, or plan discussed in a meeting. Supports two modes: transcript-only (broad scan) or transcript + focus (targeted stress-test of a specific idea). Optional inputs: context, audience, risk_tolerance, focus_idea, focus_questions, constraints.
---

## 1. Purpose

Produce a structured adversarial analysis of a meeting transcript. Identify how the discussed plan, proposal, or decision could fail. Ground every finding in transcript evidence. Prefer explicit uncertainty over false confidence. Never fabricate evidence.

Canonical contracts:
- Input: `skills/redteam/schemas/input.schema.json`
- Output: `skills/redteam/schemas/output.schema.json`

---

## 2. Input Reference

The only required field is `transcript`. All other fields are optional but improve analysis quality. The skill operates in two modes depending on which optional fields are present.

### Mode detection

- If `focus_idea` or `focus_questions` are present: **transcript_plus_focus** mode. The analysis focuses failure modes and adversarial questions on the specified idea.
- Otherwise: **transcript_only** mode. The analysis performs a broad scan of the transcript for risks and failure modes.

Set `metadata.mode_used` in the output accordingly.

### Optional fields

| Field | When to provide | Effect on output |
|---|---|---|
| `context` | When background information would help interpret the transcript (company stage, market context, org structure). | Improves risk calibration. Without it, the analysis uses only what the transcript reveals. |
| `audience` | When the output will be read by a specific person or group. | Adjusts language and detail level. "Board of directors" gets different framing than "engineering team." Without it, defaults to general leadership audience. |
| `risk_tolerance` | When the caller has a specific threshold for what should be flagged. | `low` = flag everything, conservative. `medium` = balanced, flag material risks. `high` = only serious and likely risks. Without it, defaults to `medium` behavior. |
| `focus_idea` | When there's a specific thesis or proposal to stress-test. | Activates transcript_plus_focus mode. Failure modes and adversarial questions focus on this idea. Without it, the analysis scans broadly. |
| `focus_questions` | When there are specific angles or concerns to investigate. | Each question becomes a targeted probe. Activates transcript_plus_focus mode. Without it, questions are generated from the transcript. |
| `constraints` | When known limits must be respected (budget, timeline, headcount). | Failure modes and recommendations are evaluated against these constraints. Without it, the analysis may suggest mitigations that violate unstated constraints. |

---

## 3. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm `transcript` is present and at least 50 characters. If missing or too short, apply Failure Handling (section 8) immediately.

**Step 2 — Detect mode.**
If `focus_idea` or `focus_questions` are present, set mode to `transcript_plus_focus`. Otherwise, set mode to `transcript_only`.

**Step 3 — Read the transcript for context.**
Read the full transcript once without scoring. Map: participant roles, proposals discussed, decisions made, decisions deferred, disagreements, emotional tone shifts, and commitments made.

**Step 4 — Identify the thesis under test.**
- In `transcript_plus_focus` mode: derive from `focus_idea`.
- In `transcript_only` mode: infer the central proposal, decision, or plan from the transcript. State it as a testable thesis.

**Step 5 — Extract key assumptions.**
Identify implicit and explicit assumptions underlying the thesis. For each, assess confidence (0.0-1.0) and ground in a transcript quote. Focus on assumptions that carry material risk if false.

**Step 6 — Identify failure modes.**
Apply the Failure Mode Analysis Rules (section 4). Prioritize failure modes by severity x likelihood. Each must include leading indicators and actionable mitigation.

**Step 7 — Generate adversarial questions.**
Write sharp, specific questions that challenge the thesis. Each question should target a blind spot, untested assumption, or logical gap in the discussion. In `transcript_plus_focus` mode, at least half should address the `focus_questions` if provided.

**Step 8 — Extract commitments.**
Identify promises, deadlines, and deliverables stated in the transcript. For each, capture owner, timeline, what was committed, and what artifact would prove completion.

**Step 9 — Determine decision recommendation.**
Apply the Decision Recommendation Rules (section 6). Set the recommendation based on the aggregate risk profile.

**Step 10 — Score overall risk level.**
Apply the Risk Scoring rules (section 7). Factor in `risk_tolerance` if provided.

**Step 11 — Collect citations.**
Gather all verbatim quotes referenced in the analysis. Each citation must include speaker and approximate location in the transcript.

**Step 12 — Write summary.**
Summarize the analysis in 2-4 sentences. Cover the most critical failure modes, the recommendation, and the overall risk posture. Write for a reader who will not read the full output.

**Step 13 — Assemble and validate output.**
Construct the full output object. Verify it satisfies the output schema before returning. All required fields must be present.

---

## 4. Failure Mode Analysis Rules

**Per-failure-mode requirements:**
1. Assign a unique `id` (FM-001, FM-002, etc.).
2. Write a concrete, specific `title`. Avoid generic labels like "timeline risk." Tie to the specific issue discussed.
3. Set `severity` (1-5) based on impact magnitude if the failure occurs. Anchors:
   - 1 = minor inconvenience, easily recoverable
   - 2 = noticeable setback, requires effort to recover
   - 3 = significant impact on timeline, revenue, or reputation
   - 4 = major damage, difficult to recover from
   - 5 = existential or catastrophic, potentially irreversible
4. Set `likelihood` (1-5) based on evidence strength and contextual signals. Anchors:
   - 1 = very unlikely given evidence
   - 2 = possible but evidence is weak
   - 3 = plausible, some supporting evidence
   - 4 = likely, strong evidence or historical precedent
   - 5 = near certain given current trajectory
5. Write `why_it_fails` explaining the causal mechanism: what goes wrong and why.
6. List `leading_indicators` that are specific enough to monitor. Not "things go badly" but "payments team has not committed engineering resources by end of next sprint."
7. Write `mitigation` that is specific and actionable. Not a restatement of the risk.

**No-inflation rule.** Do not fabricate failure modes to fill the output. If the plan is genuinely sound, report fewer failure modes with lower severity. A routine meeting should not produce a critical-risk analysis.

---

## 5. Evidence Rules

- Do not output a failure mode, assumption, or adversarial question without grounding in transcript content.
- Citations must be verbatim quotes from the transcript. Do not paraphrase and present as a quote.
- Distinguish **"not observed"** from **"negative evidence."**
  - Not observed: a topic never raised is a coverage gap, not evidence of a problem. Note it in adversarial questions or the summary. Do not manufacture a failure mode from silence.
  - Negative evidence: a topic raised with poor outcomes. Cite the specific exchange and score accordingly.
- If evidence for a failure mode is weak or incomplete, lower `confidence` on related assumptions, state the uncertainty explicitly in `why_it_fails`, and surface the gap as an adversarial question.
- Attribute quotes accurately. Ensure the quoted text matches the speaker and context.

---

## 6. Decision Recommendation Rules

| Recommendation | Criteria |
|---|---|
| `proceed` | No high-severity failure modes. Assumptions are well-supported. Risks are manageable with standard execution. |
| `proceed_with_guards` | Some material risks but mitigable. Specific checks or safeguards are needed before or during execution. Most common recommendation. |
| `pause` | One or more high-severity, high-likelihood failure modes. Critical assumptions are unvalidated. Proceeding without resolving specific blockers would be irresponsible. |
| `stop` | Multiple critical failure modes. The thesis is fundamentally flawed based on available evidence. Proceeding would cause material harm. |

`required_next_checks` must be populated for `proceed_with_guards` and `pause`. Each check must be specific enough that someone can execute it and report back.

---

## 7. Risk Scoring

Set `overall_risk_level` based on the aggregate failure mode profile:

| Level | Criteria |
|---|---|
| `low` | No failure modes above severity 2. All assumptions well-supported. Plan is sound with minor risks. |
| `medium` | One or more failure modes at severity 3-4 with likelihood 2-3. Some assumptions weakly supported. Material but manageable risks. |
| `high` | One or more failure modes at severity 4-5 with likelihood 3+. Critical assumptions unvalidated. Multiple risks that compound. |
| `critical` | Multiple failure modes at severity 5 with high likelihood. Thesis is fundamentally compromised. Proceeding without major changes would be reckless. |

**risk_tolerance modulation.** When `risk_tolerance` is provided:
- `low`: shift thresholds down — flag at lower severity/likelihood combinations. A severity 2, likelihood 3 failure mode may warrant `medium` overall risk.
- `medium`: use the thresholds above as-is.
- `high`: shift thresholds up — only flag at higher severity/likelihood. A severity 3, likelihood 2 failure mode alone does not raise overall risk.

---

## 8. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 50 characters or garbled | Set `overall_risk_level: low`, populate `summary` explaining the limitation. Include a single failure mode (FM-001, severity 1, likelihood 1) titled "Insufficient transcript for analysis." Set `metadata.mode_used` to `transcript_only`. Populate `adversarial_questions` with a single entry asking for a complete transcript. Populate `recommended_actions` with a follow-up to re-submit. |
| Missing transcript field entirely | Same as above but note the missing field in `summary`. Set `thesis_under_test` to "Unable to determine — transcript not provided." |
| Transcript has no identifiable risks | Return `overall_risk_level: low` with a single low-severity failure mode noting the plan appears sound. Populate `adversarial_questions` with probing questions to validate this assessment. Do not inflate. |
| Speaker attribution unclear | Proceed with analysis. Note the attribution issue in `summary`. Set citation `speaker` fields to "Unknown" where attribution cannot be determined. |

---

## 9. Output Contract Requirements

Output must be a valid JSON object conforming to `skills/redteam/schemas/output.schema.json`. Do not include fields not defined in the schema (`additionalProperties: false`).

**Required fields:**

| Field | Type | Constraint |
|---|---|---|
| `summary` | string | 2-4 sentences. Write for a reader who will not read the full output. |
| `overall_risk_level` | string | One of `low`, `medium`, `high`, `critical`. |
| `thesis_under_test` | string | The core thesis being stress-tested. |
| `key_assumptions` | array | Each item: `assumption`, `confidence` (0-1), `evidence_from_transcript`. |
| `failure_modes` | array | minItems: 1. Each item: `id`, `title`, `severity` (1-5), `likelihood` (1-5), `why_it_fails`, `leading_indicators` (string[]), `mitigation`. |
| `adversarial_questions` | array | minItems: 1. Sharp, specific questions that challenge the thesis. |
| `decision_recommendation` | object | `recommendation` (proceed/proceed_with_guards/pause/stop), `rationale`, `required_next_checks` (string[]). |
| `commitments_extracted` | array | Each item: `owner`, `due_date_or_window`, `commitment`, `proof_artifact`. May be empty if no commitments were made. |
| `citations` | array | Each item: `quote`, `speaker`, `approximate_location`. |
| `metadata` | object | `mode_used` (transcript_only/transcript_plus_focus), `generated_at` (ISO 8601 datetime). |

All nested objects enforce `additionalProperties: false`. Do not add extra fields to any object in the output.
