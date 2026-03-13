---
name: meeting-risk-analysis
description: Analyze a meeting transcript to surface risks, unresolved tensions, hidden assumptions, decision gaps, and recommended actions with evidence-backed citations. Use when you have a meeting transcript and need a structured risk assessment.
---

## 1. Purpose

Produce a structured, evidence-grounded risk analysis of a meeting transcript. Never fabricate evidence. Prefer explicit uncertainty over false confidence. Output must conform to the canonical output schema.

Canonical contracts:
- Input: `skills/meeting-risk-analysis/schemas/input.schema.json`
- Output: `skills/meeting-risk-analysis/schemas/output.schema.json`

---

## 2. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm all required fields are present (`meeting_id`, `meeting_title`, `transcript`, `participants`, `context`). If any are missing or the transcript is below 100 characters, apply Failure Handling (§8) immediately.

**Step 2 — Read the transcript for context.**
Read the full transcript once without scoring. Map meeting dynamics: participant roles, areas of agreement, areas of disagreement, decisions made, decisions deferred, and emotional tone shifts.

**Step 3 — Identify risks.**
Apply the Risk Identification Rules (§3). For each risk, extract evidence quotes, assess severity and likelihood, and write impact rationale, owner, and mitigation.

**Step 4 — Surface unresolved tensions and hidden assumptions.**
Apply the Tension & Assumption Analysis rules (§5). For each tension, identify at least two sides with evidence. For each assumption, assess the risk if it proves false.

**Step 5 — Catalog decision gaps.**
Identify decisions that need to be made but were deferred, unclear, or unassigned. For each gap, identify the blocker and suggest a decision owner.

**Step 6 — Generate recommended actions.**
Apply the Action Recommendation Rules (§6). Every action must have an owner, due date, and success artifact.

**Step 7 — Score confidence.**
Apply the Confidence Scoring rubric (§7). Adjust downward for weak evidence, low transcript quality, or incomplete coverage.

**Step 8 — Determine overall risk level.**
Set `overall_risk_level` based on the aggregate severity, likelihood, and count of identified risks, unresolved tensions, and decision gaps. Do not inflate. A routine meeting with minor issues is `low`, not `medium`.

**Step 9 — Write executive summary.**
Summarize the risk posture in 2–4 sentences. Cover the most significant risks, unresolved tensions, and highest-priority actions. Write for a reader who will not read the full output.

**Step 10 — Assemble and validate output.**
Construct the full output object. Verify it satisfies the output schema (§9) before returning. All required fields must be present and non-empty where the schema mandates it.

---

## 3. Risk Identification Rules

**Risk taxonomy.** Prioritize these categories when scanning the transcript:

| Category | What to look for |
|---|---|
| Execution risk | Aggressive timelines, understaffing, spec gaps, unclear scope, technical unknowns |
| Coordination risk | Cross-team dependencies without clear owners, handoff ambiguity, missing RACI |
| Decision ambiguity | Deferred decisions, "let's figure it out offline," competing proposals without resolution |
| Dependency risk | External blockers, third-party approvals, upstream deliverables with no confirmed date |
| Adoption risk | Stakeholder resistance, unvalidated assumptions about user/customer behavior, change management gaps |

**Per-risk requirements:**
1. Assign a concrete, specific `title`. Avoid generic labels like "timeline risk" — tie it to the specific timeline issue discussed.
2. Set `severity` (low/medium/high) based on the magnitude of impact if the risk materializes.
3. Set `likelihood` (low/medium/high) based on evidence strength and contextual signals.
4. Write an `impact` statement explaining the downstream consequences in concrete terms.
5. Assign an `owner` — the participant best positioned to mitigate, based on the discussion.
6. Write a `mitigation` that is specific and actionable, not a restatement of the risk.

**No-inflation rule.** Do not fabricate risks to fill the output. If the meeting content is genuinely low-risk, report `overall_risk_level: low` with a single low-severity risk reflecting that assessment. A routine status update should not produce a high-risk analysis.

---

## 4. Evidence Rules

- Do not output a risk, tension, or assumption without at least one direct verbatim quote from the transcript in `evidence_quotes`. The output schema enforces `minItems: 1`.
- Quotes must come directly from the transcript. Do not paraphrase and present it as a quote.
- Distinguish **"not observed"** from **"negative evidence."** A topic never raised is not evidence of a problem — it is a coverage gap. A topic raised with poor outcomes is negative evidence. Treat them differently:
  - Not observed: note the gap in `decision_gaps` or `recommended_actions`. Do not manufacture a risk from silence.
  - Negative evidence: cite the specific exchange and score accordingly.
- If evidence for a risk is weak or incomplete, lower `confidence`, state the uncertainty explicitly in the risk's `impact` or `mitigation` field, and add a clarifying follow-up action in `recommended_actions`.
- Attribute quotes accurately. Ensure the quoted text matches the speaker and context.

---

## 5. Tension & Assumption Analysis

**Unresolved tensions.**
Surface disagreements or competing positions that were not resolved during the meeting.

For each tension:
1. Write a `tension` statement describing the conflict.
2. List at least two `sides` — the distinct positions held by participants.
3. Include at least one direct `evidence_quotes` entry showing the disagreement.
4. Write `why_it_matters` explaining the downstream risk if the tension remains unresolved.

Do not flag healthy debate that reached resolution as a tension. Only flag positions that remain open.

**Hidden assumptions.**
Identify implicit beliefs the participants are operating under that were not explicitly validated.

For each assumption:
1. State the `assumption` in clear terms.
2. Write `risk_if_false` — what breaks if this assumption is wrong.
3. Include at least one `evidence_quotes` entry showing where the assumption surfaces in the transcript.

Focus on assumptions that carry material risk if false. Ignore trivially true background assumptions.

---

## 6. Action Recommendation Rules

Every entry in `recommended_actions` must include all four fields:

| Field | Requirement |
|---|---|
| `action` | Specific, executable task. Not "discuss further" or "think about X." State what needs to happen, with whom, and what the output is. |
| `owner` | A named participant or role from the meeting. If no obvious owner, assign the most senior participant and note the ambiguity. |
| `due_date` | A concrete date. Derive from meeting context (upcoming deadlines, next meetings). If no date is inferable, set the next business day and flag it as a placeholder. |
| `success_artifact` | The tangible output that proves the action is complete — a document, decision, email, approval, or deliverable. |

**Specificity test.** Before finalizing an action, verify: could someone who was not in the meeting execute this action from the description alone? If not, add detail.

**Derivation rule.** Every recommended action must trace to at least one risk, tension, assumption, or decision gap in the output. Do not add actions that are disconnected from the analysis.

---

## 7. Confidence Scoring

Set `confidence` as a float 0.0–1.0 reflecting the reliability of the entire analysis.

| Range | Criteria |
|---|---|
| 0.8–1.0 | Long, clear transcript with identified speakers; strong evidence density; all major threads covered; risks well-supported by multiple quotes |
| 0.5–0.79 | Adequate transcript but some coverage gaps; one or more risks grounded in single quotes; minor speaker attribution ambiguity |
| 0.2–0.49 | Short or noisy transcript; significant coverage gaps; multiple risks with weak or circumstantial evidence; speaker attribution unclear |
| 0.0–0.19 | Transcript below minimum length, garbled, or missing required fields; analysis is best-effort placeholder only |

**Adjustment triggers.** Reduce confidence by at least 0.1 for each of:
- A risk scored without a strong evidence quote (only circumstantial support).
- An unresolved tension where one side's position is inferred rather than quoted.
- A hidden assumption that is speculative rather than grounded in transcript language.
- Significant portions of the transcript that are unintelligible or lack speaker attribution.

---

## 8. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 100 characters or garbled beyond interpretation | Set `confidence` ≤ 0.2, `overall_risk_level: low`. Write `executive_summary` explaining the limitation. Populate `risks` with a single low-severity entry titled "Insufficient transcript for analysis" with an evidence quote from whatever text is available. Populate `recommended_actions` with a follow-up action to re-submit a complete transcript. |
| Missing required input field | Return schema-valid output with `confidence: 0`, `overall_risk_level: low`, `executive_summary` naming the missing field. Populate `risks` and `recommended_actions` with minimal placeholder entries. |
| Transcript has no identifiable risks | Return `overall_risk_level: low` with `confidence` reflecting evidence quality. Populate `risks` with a single low-severity, low-likelihood entry noting that no significant risks were identified. Do not inflate. |
| Speaker attribution unclear throughout | Proceed with analysis but reduce `confidence` by at least 0.2. Note the attribution issue in `executive_summary` and add a recommended action to obtain a transcript with clear speaker labels. |

---

## 9. Output Contract Requirements

Output must be a valid JSON object conforming to `skills/meeting-risk-analysis/schemas/output.schema.json`. Do not include fields not defined in the schema (`additionalProperties: false`).

**Required fields:**

| Field | Type | Constraint |
|---|---|---|
| `executive_summary` | string | minLength: 30. Write for a reader who will not read the full output. |
| `overall_risk_level` | string | One of `low`, `medium`, `high`. |
| `risks` | array | minItems: 1. Each item: `title`, `severity`, `likelihood`, `evidence_quotes` (minItems: 1), `impact`, `owner`, `mitigation`. |
| `unresolved_tensions` | array | Each item: `tension`, `sides` (minItems: 2), `evidence_quotes` (minItems: 1), `why_it_matters`. May be empty if no tensions exist. |
| `hidden_assumptions` | array | Each item: `assumption`, `risk_if_false`, `evidence_quotes` (minItems: 1). May be empty if no hidden assumptions exist. |
| `decision_gaps` | array | Each item: `missing_decision`, `blocker`, `suggested_decision_owner`. May be empty if all decisions were made. |
| `recommended_actions` | array | minItems: 1. Each item: `action`, `owner`, `due_date`, `success_artifact`. |
| `confidence` | number | 0.0–1.0. See Confidence Scoring (§7). |

All nested objects enforce `additionalProperties: false`. Do not add extra fields to any object in the output.
