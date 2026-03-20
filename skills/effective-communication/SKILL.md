---
name: effective-communication
description: Coach a speaker's communication effectiveness from meeting transcripts with quote-grounded scoring, tactical rewrites, and a next-meeting gameplan focused on clarity, executive presence, and actionability.
---

## 1. Purpose and When to Use

Produce a structured communication coaching analysis of a meeting transcript. Score the speaker across seven dimensions, identify the highest-cost communication patterns, deliver concrete before/after rewrites, and generate a copy-paste-ready gameplan for the next meeting. Ground every finding in verbatim transcript evidence. Prefer explicit uncertainty over fabricated insight. Never invent quotes.

Canonical contracts:
- Input: `schemas/effective-communication.input.schema.json`
- Output: `schemas/effective-communication.output.schema.json`

### When to use

- **Meeting retros.** After any meeting where you want to understand how your communication landed — what worked, what didn't, and what to change.
- **Leadership comms coaching.** Ongoing development of clarity, executive presence, and influence in meetings with senior stakeholders.
- **Prep for high-stakes stakeholder meetings.** Review a recent similar meeting to build a concrete gameplan — opening script, non-negotiables, pushback templates, and closing.
- **Diagnosing "I said it but it didn't land."** When the right message was delivered but didn't produce the expected outcome. Pinpoint where the delivery, framing, or structure caused the gap.

---

## 2. Input Reference

The only required field is `transcript`. All other fields are optional but improve coaching specificity — especially `user_name`, `communication_goal`, and `focus_areas`.

### Mode detection

- If any of `user_name`, `communication_goal`, `audience_context`, `tone_target`, `analysis_depth`, `participant_directory`, `focus_areas`, or `key_questions` are present: **transcript_plus_context** mode.
- Otherwise: **transcript_only** mode.

Set `metadata.mode_used` in the output accordingly.

### Analysis depth

Set `metadata.analysis_depth_used` in the output to match the input `analysis_depth` value. If `analysis_depth` is not provided, default to `standard`.

| Depth | Behavior |
|---|---|
| `quick` | Headline-level coaching: scores, top 3 improvements, one-thing-to-change. Missed opportunities may be empty. |
| `standard` | Balanced analysis: full score breakdown, 3+ priority improvements with rewrites, filler patterns, gameplan. |
| `deep` | Comprehensive: everything in `standard` plus 3+ missed opportunities, extended drills, and detailed filler analysis. |

### Optional fields

| Field | When to provide | Effect on output |
|---|---|---|
| `meeting_title` | When the meeting has a known subject line or agenda. | Adds context for audience-alignment and structure scoring. |
| `meeting_datetime` | When temporal context matters for the coaching framing. | Included in metadata context. |
| `user_name` | When coaching a specific person in the meeting. | All analysis focuses on this person's communication. Without it, the skill coaches the most prominent speaker. |
| `communication_goal` | When the speaker had a specific objective (align, persuade, decide, unblock). | Shapes scoring: "persuade" weights executive presence and structure higher; "align" weights listening and audience alignment. |
| `audience_context` | When the audience's seniority, familiarity, or concerns are known. | Calibrates audience-alignment scoring. "Board of directors" gets different expectations than "engineering standup." |
| `tone_target` | When the speaker has a desired communication style. | Scoring and rewrites calibrate to the target. `executive` = crisp, high-signal, time-aware. `warm` = empathetic, collaborative. `assertive` = direct, decisive. `neutral` = balanced, professional. |
| `analysis_depth` | When you want more or less detail. | Controls output thoroughness. Defaults to `standard`. |
| `participant_directory` | When attendee roles and teams are known. | Improves speaker attribution and audience-alignment analysis. |
| `focus_areas` | When specific dimensions matter most. | These areas receive deeper coverage in `priority_improvements`. Enum values: `clarity`, `brevity`, `executive_presence`, `structure`, `listening`, `ownership_language`, `handling_pushback`, `closing`. |
| `key_questions` | When the user has specific concerns about their communication. | Each question is addressed directly in the analysis. Maximum 8. |

### Transcript-only input example

```json
{
  "transcript": "Marcus: Let's get into the status update. Priya, where are we on the migration? Priya: Yeah, so, um, we've been making progress. I think we're in a pretty good place, actually..."
}
```

### Transcript + context input example

```json
{
  "transcript": "Marcus: Let's get into the status update. Priya, where are we on the migration? Priya: Yeah, so, um, we've been making progress...",
  "meeting_title": "Platform Migration — Weekly Status",
  "user_name": "Priya Sharma",
  "communication_goal": "align",
  "audience_context": "Cross-functional status meeting with engineering director who reports to the CTO.",
  "tone_target": "executive",
  "analysis_depth": "deep",
  "participant_directory": [
    { "name": "Marcus Chen", "role": "Engineering Director", "team": "Engineering" },
    { "name": "Priya Sharma", "role": "Tech Lead", "team": "Engineering" }
  ],
  "focus_areas": ["clarity", "brevity", "executive_presence", "ownership_language"]
}
```

---

## 3. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm `transcript` is present and at least 150 characters. If missing or too short, apply Failure Handling (section 7) immediately.

**Step 2 — Detect mode and depth.**
If any optional context field is present, set mode to `transcript_plus_context`. Otherwise, set mode to `transcript_only`. Set analysis depth from the input `analysis_depth` field, defaulting to `standard`.

**Step 3 — Identify the user and infer their objective.**
- If `user_name` is provided, focus all analysis on that person's communication.
- If `user_name` is absent, identify the most prominent speaker and coach them.
- If `communication_goal` is provided, use it as the primary coaching lens. If absent, infer the goal from transcript cues: is the speaker trying to align, persuade, decide, or unblock?

**Step 4 — Read the transcript for communication patterns.**
Read the full transcript once without scoring. Map: speaker turns, topic transitions, hedging language, filler words, moments of clarity, moments of confusion, pushback exchanges, and closing behaviors. Note the user's approximate talk-time share.

**Step 5 — Score seven communication dimensions.**
Score each dimension on a 0–100 integer scale. Ground each score in observed behavior from the transcript.

| Dimension | What it measures |
|---|---|
| `clarity` | How clear and unambiguous the communication was. |
| `brevity` | Economy of words — saying what needs to be said without excess. |
| `structure` | Logical organization of points, use of framing and signposting. |
| `audience_alignment` | Calibration to the audience's needs, seniority, and context. |
| `executive_presence` | Confidence, authority, and gravitas in delivery. |
| `action_orientation` | Driving toward decisions, next steps, and clear ownership. |
| `listening_and_responsiveness` | Acknowledging others' points, building on input, adapting in real time. |

Compute `overall_effectiveness_score` as a holistic composite — not a simple average. Weight dimensions by relevance to the inferred `communication_goal`. Set `communication_status` based on the composite:
- 80–100: `excellent`
- 60–79: `strong_with_gaps`
- 40–59: `mixed`
- 0–39: `needs_improvement`

**Step 6 — Identify what worked.**
List specific things the speaker did well. Each entry must be a concrete, evidence-grounded observation — not generic praise.

**Step 7 — Identify highest-cost communication misses.**
For each priority improvement (minimum 3):
1. Name the `theme` — a specific, descriptive label tied to observed behavior.
2. Write the `diagnosis` — what the speaker is doing and why it's a problem.
3. Explain `why_it_costs_you` — the concrete impact on credibility, outcomes, or perception.
4. Set `impact_level` (`low`, `medium`, `high`, `critical`).
5. Cite at least one verbatim `evidence` entry with speaker, quote, and approximate location.
6. Write a `rewrite` — a `before` (from the transcript), an `after` (improved version), and `why_better`.
7. Provide a `drill` — a specific practice exercise to build the new habit.

If `focus_areas` are provided, ensure those dimensions receive priority coverage in improvements.

**Step 8 — Surface missed opportunities.**
Identify moments where a different approach would have been more effective. For each, capture: `moment` (when), `what_happened` (what the speaker did), `better_move` (what they should have done), and `sample_line` (copy-paste alternative). When `analysis_depth` is `deep`, include at least 3 missed opportunities.

**Step 9 — Catalog filler and hedging patterns.**
Identify recurring filler words, hedge phrases, or verbal tics. For each, capture: the `pattern`, an approximate `count_estimate`, and a `replacement_pattern` the speaker can practice.

**Step 10 — Assess talk-time signal.**
Estimate the user's share of total talk time. Assess whether it was appropriate for their role and communication goal (`under_talking`, `balanced`, `over_talking`, or `unknown` if insufficient data). Add a `note` explaining the assessment.

**Step 11 — Build next-meeting gameplan.**
Produce a concrete preparation plan:
- `opening_script` — a suggested opening statement the user can adapt.
- `three_non_negotiables` — exactly three communication behaviors to commit to. Not five, not two. Three.
- `pushback_response_template` — a template for handling disagreement gracefully.
- `closing_script` — a suggested closing statement that ends with clarity and ownership.

**Step 12 — Identify the one thing to change.**
Select the single highest-leverage behavior change. Explain `why` it matters most and define a concrete `success_signal` — how the user will know it worked.

**Step 13 — Write the coach take.**
Write `coach_take` as a candid, direct coaching perspective — what a trusted advisor would say privately. Be specific and actionable, not generic.

**Step 14 — Write executive summary.**
Summarize in 2–4 sentences: overall impression, key strengths, and the most impactful area for improvement. Write for a reader who will not read the full output.

**Step 15 — Collect citations.**
Gather all verbatim quotes referenced in the analysis. Each citation must include `speaker` and `approximate_location`. Minimum 3 citations.

**Step 16 — Assemble and validate output.**
Construct the full output object. Verify it conforms to the output schema before returning. All required fields must be present. All objects enforce `additionalProperties: false`.

---

## 4. Output Behavior (Granola Parity)

The coaching output must meet these quality standards:

1. **Concise but insight-dense.** Every sentence earns its place. No filler paragraphs, no generic coaching platitudes. If it could apply to anyone, cut it.
2. **Direct, non-generic notes.** "You hedged 7 times in your opening update" not "Consider being more direct." Reference the specific person, the specific meeting, the specific behavior.
3. **Quote-grounded claims only.** Every diagnosis, improvement, and missed opportunity must be tied to something that actually happened in the transcript. No inferences presented as fact.
4. **Rewrite-first suggestions.** Don't tell the speaker what to do abstractly — show them. Every priority improvement includes a before/after rewrite they can study. The `after` version should be something they could actually say.
5. **Copy-paste scripts.** The `next_meeting_gameplan` contains opening and closing scripts, a pushback template, and three non-negotiables. These should be ready to use, not templates full of `[INSERT X HERE]` placeholders.

---

## 5. Constraints and Evidence Rules

1. **No fabricated quotes.** Every `quote` field in `evidence` and `citations` must be a verbatim string from the transcript. Do not paraphrase and present as a quote. Do not synthesize quotes from multiple statements.
2. **No psychoanalysis.** Do not speculate about the speaker's emotions, insecurities, or motivations beyond what the transcript directly reveals. "You sounded nervous" is not acceptable unless the speaker said "I'm nervous."
3. **No advice without evidence.** Every entry in `priority_improvements` must include at least one evidence citation. If you cannot ground an improvement in a specific transcript moment, do not include it.
4. **Thin evidence triggers explicit downgrade.** If the transcript is short, single-speaker, or lacks enough material to confidently score a dimension, lower the score and explain the limitation in `coach_take`. Do not inflate scores to fill the output. A 15-second transcript should not produce a 14-field coaching analysis with high confidence.

---

## 6. Modes

### Transcript-only mode

Input contains only `transcript`. The analysis:
- Identifies the most prominent speaker and coaches them.
- Infers communication goal from context.
- Scores all seven dimensions based solely on transcript evidence.
- Sets `metadata.mode_used` to `transcript_only`.

### Transcript-plus-context mode

Input includes `transcript` plus one or more optional fields. The analysis:
- Focuses on the named `user_name` (if provided).
- Uses `communication_goal` to weight scoring dimensions.
- Calibrates `audience_alignment` against `audience_context` and `participant_directory`.
- Evaluates tone against `tone_target`.
- Prioritizes `focus_areas` in `priority_improvements`.
- Addresses `key_questions` directly in the analysis.
- Sets `metadata.mode_used` to `transcript_plus_context`.

### Analysis depth

Mirrors the input `analysis_depth` field:
- `quick`: scores + top 3 improvements + one-thing-to-change. Other arrays may be empty.
- `standard`: full analysis. `priority_improvements` minItems 3, `citations` minItems 3.
- `deep`: full analysis + `missed_opportunities` minItems 3, extended drills, detailed filler cataloging.

Set `metadata.analysis_depth_used` accordingly.

---

## 7. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 150 characters or garbled | Return a valid output with low scores, `communication_status: "needs_improvement"`, and `coach_take` explaining the limitation. Populate `priority_improvements` with 3 placeholder entries noting insufficient transcript. Set `citations` to 3 entries quoting whatever text is available. Include in `executive_summary`: "Transcript too short for reliable analysis." Note in `what_worked` what can be observed, even if minimal. |
| Missing transcript field entirely | Same as above but note the missing field in `executive_summary`. Set `overall_effectiveness_score` to 0 and `communication_status` to `needs_improvement`. |
| Transcript has no identifiable communication issues | Return high scores with genuine observations in `what_worked`. Populate `priority_improvements` with 3 low-impact refinements. Set `communication_status` to `excellent` or `strong_with_gaps`. Do not fabricate problems. |
| Speaker attribution unclear throughout | Proceed with analysis. Note the attribution limitation in `coach_take`. Set `speaker` fields to `"Unknown"` where attribution cannot be determined. Lower `audience_alignment` and `listening_and_responsiveness` scores to reflect reduced observability. |
| Transcript quality is poor (ASR errors, missing segments) | Return a partial analysis with a confidence caveat in `executive_summary`. Lower all scores by 10–20 points to account for missing signal. In `coach_take`, specify what additional context would improve the analysis (e.g., "A speaker-attributed transcript would let me score listening and responsiveness more accurately"). |

---

## 8. Output Contract

Output must conform to `schemas/effective-communication.output.schema.json`. All objects enforce `additionalProperties: false`.

| Field | Type | Constraint |
|---|---|---|
| `executive_summary` | string | 2–4 sentences. Overall impression, key strengths, top improvement area. |
| `overall_effectiveness_score` | integer | 0–100. Holistic composite, not a simple average. |
| `communication_status` | string | One of `excellent`, `strong_with_gaps`, `mixed`, `needs_improvement`. |
| `coach_take` | string | Candid, direct coaching perspective. Actionable and specific. |
| `score_breakdown` | object | Seven integer scores (0–100): `clarity`, `brevity`, `structure`, `audience_alignment`, `executive_presence`, `action_orientation`, `listening_and_responsiveness`. |
| `what_worked` | array of strings | Concrete, evidence-grounded observations. |
| `priority_improvements` | array | minItems: 3. Each: `theme`, `diagnosis`, `why_it_costs_you`, `impact_level`, `evidence` (minItems: 1), `rewrite` (`before`, `after`, `why_better`), `drill`. |
| `missed_opportunities` | array | Each: `moment`, `what_happened`, `better_move`, `sample_line`. When `analysis_depth_used` is `deep`: minItems 3. |
| `filler_or_hedging_patterns` | array | Each: `pattern`, `count_estimate`, `replacement_pattern`. |
| `talk_time_signal` | object | `user_share_estimate` (string), `balance_assessment` (`under_talking`, `balanced`, `over_talking`, `unknown`), `note`. |
| `next_meeting_gameplan` | object | `opening_script`, `three_non_negotiables` (exactly 3 items), `pushback_response_template`, `closing_script`. |
| `one_thing_to_change_next_meeting` | object | `change`, `why`, `success_signal`. |
| `citations` | array | minItems: 3. Each: `quote` (verbatim), `speaker`, `approximate_location`. |
| `metadata` | object | `mode_used` (`transcript_only` or `transcript_plus_context`), `analysis_depth_used` (`quick`, `standard`, `deep`), `generated_at` (ISO 8601). |

---

## 9. Implementation Notes

### Schema fidelity

- Output must validate against `schemas/effective-communication.output.schema.json` with zero errors.
- All objects enforce `additionalProperties: false`. Do not add fields beyond what the schema defines.
- The output schema includes a conditional constraint: when `metadata.analysis_depth_used` is `deep`, `missed_opportunities` must have `minItems: 3`.
- `next_meeting_gameplan.three_non_negotiables` enforces exactly 3 items (`minItems: 3`, `maxItems: 3`).
- All score fields (`overall_effectiveness_score` and every field in `score_breakdown`) are constrained to integer 0–100.

### Test expectations

- Input and output fixtures: `fixtures/effective-communication.input.transcript-only.json`, `fixtures/effective-communication.input.with-context.json`, `fixtures/effective-communication.output.example.json`.
- Validator: `src/validators/effectiveCommunication.ts` exports `validateEffectiveCommunicationInput` and `validateEffectiveCommunicationOutput`.
- Tests: `tests/effectiveCommunication.validators.test.ts` — run via `npx vitest run tests/effectiveCommunication.validators.test.ts`.
- All 6 validator tests pass: transcript-only input, with-context input, missing transcript rejection, invalid enum rejection, output minItems enforcement, and full output fixture validation.
