---
name: stakeholder-analysis
description: Analyze meeting transcripts and decision context to map stakeholders, infer stances/incentives, identify coalition dynamics and execution risks, and produce an actionable engagement plan. Use when preparing decisions, alignment plans, launches, roadmap changes, or cross-functional initiatives where stakeholder buy-in is critical.
---

## 1. Purpose

Produce a structured, evidence-grounded stakeholder analysis from a meeting transcript. Map who matters, what they want, where they align or conflict, and what to do about it in the next 7 days. Ground every finding in transcript evidence. Prefer explicit uncertainty over false confidence. Never fabricate stakeholders, stances, or quotes.

Canonical contracts:
- Input: `schemas/stakeholder-analysis.input.schema.json`
- Output: `schemas/stakeholder-analysis.output.schema.json`

---

## 2. Input Reference

The only required field is `transcript`. All other fields are optional but improve analysis quality. The skill operates in two modes depending on which optional fields are present.

### Mode detection

- If any of `focal_decision`, `analysis_goal`, `org_context`, `stakeholder_directory`, `key_questions`, `time_horizon`, or `confidence_threshold` are present: **transcript_plus_context** mode.
- Otherwise: **transcript_only** mode.

Set `metadata.mode_used` in the output accordingly.

### Optional fields

| Field | When to provide | Effect on output |
|---|---|---|
| `analysis_goal` | When the analysis serves a specific purpose (exec review, launch prep, budget approval). | Adjusts framing, depth, and emphasis. Without it, defaults to general stakeholder mapping. |
| `focal_decision` | When there's a specific decision or proposal to evaluate stakeholders against. | Stances, risks, and engagement plans are oriented around this decision. Without it, the decision surface is inferred from the transcript. |
| `org_context` | When background information helps interpret transcript dynamics (company stage, culture, recent reorgs). | Improves inference of hidden incentives and power dynamics. Without it, the analysis uses only what the transcript reveals. |
| `stakeholder_directory` | When you know key players in advance (name, role, team, optional power_hint). | Seeds the analysis; these stakeholders are profiled even if their transcript evidence is thin. Additional stakeholders are still discovered from the transcript. |
| `key_questions` | When there are specific concerns about stakeholder dynamics to investigate. | Each question becomes a targeted probe. Answers surface in `open_questions` or relevant stakeholder profiles. |
| `time_horizon` | When the engagement plan should be calibrated to a specific window. | `immediate` = this week. `30d` = next month. `quarter` = this quarter. `6-12m` = strategic. Affects urgency of engagement actions and risk assessment. Without it, defaults to `quarter` behavior. |
| `confidence_threshold` | When you want to filter out low-confidence findings. | 0.0 = include everything. 1.0 = only strongly evidenced findings. Without it, defaults to 0.5. |

### Input examples

**Mode A — transcript only:**

```json
{
  "transcript": "Alice Chen: Let's discuss the platform migration. The engineering team is ready but I'm worried about the data team's bandwidth..."
}
```

**Mode B — transcript + context:**

```json
{
  "transcript": "Alice Chen: Let's discuss the platform migration...",
  "focal_decision": "Migrate to microservices by Q3",
  "analysis_goal": "Prep for steering committee Thursday",
  "org_context": "Post-acquisition; two engineering orgs merging with competing roadmaps.",
  "stakeholder_directory": [
    { "name": "Alice Chen", "role": "VP Engineering", "team": "Platform", "power_hint": "high" },
    { "name": "Bob Park", "role": "Data Lead", "team": "Data Engineering" }
  ],
  "key_questions": ["Does the data team have bandwidth for the migration?"],
  "time_horizon": "quarter"
}
```

---

## 3. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm `transcript` is present and at least 80 characters. If missing or too short, apply Failure Handling (§11) immediately.

**Step 2 — Detect mode.**
If any optional context field is present, set mode to `transcript_plus_context`. Otherwise, set mode to `transcript_only`.

**Step 3 — Read the transcript for context.**
Read the full transcript once without scoring. Map: speaker identities, proposals discussed, decisions made, decisions deferred, disagreements, emotional tone shifts, and commitments made.

**Step 4 — Extract decision surface.**
- In `transcript_plus_context` mode with `focal_decision`: use it directly.
- Otherwise: infer the central decision, initiative, or proposal from the transcript. State it concretely.

**Step 5 — Identify stakeholders.**
Extract every named speaker and any stakeholders referenced but not present (e.g., "the board," "legal team"). If `stakeholder_directory` is provided, merge it — pre-seeded stakeholders are profiled even with thin transcript evidence. Flag stakeholders that appear in the directory but not in the transcript.

**Step 6 — Profile each stakeholder.**
For each stakeholder, assess:
- `stance` — based on what they said, not who they are. Apply the Stakeholder Profiling Rules (§5).
- `influence_level` — from transcript signals (who defers to whom, who sets the agenda, who has veto language) cross-referenced with `power_hint` if provided.
- `goals`, `concerns`, `hidden_incentives_or_constraints` — separate transcript-grounded facts from inferences. Label inferences explicitly.
- `alignment_score` (0-100) and `change_readiness` (low/medium/high).

**Step 7 — Build power-interest map.**
For each stakeholder, assign `power` (1-5) and `interest` (1-5). Derive `quadrant`: manage_closely (high power + high interest), keep_satisfied (high power + low interest), keep_informed (low power + high interest), monitor (low power + low interest).

**Step 8 — Detect coalition dynamics.**
Identify:
- `likely_allies` — stakeholders who actively support or would champion the decision.
- `likely_blockers` — stakeholders who resist or can unilaterally block.
- `swing_stakeholders` — uncertain positions that could tip either way.
- `relationship_risks` — interpersonal or inter-team friction that threatens alignment.

**Step 9 — Identify risks.**
Apply the Risk Identification Rules (§6). Focus on stakeholder-related risks: misalignment, blockers, resource conflicts, information asymmetry, political dynamics. Each risk must have early signals and actionable mitigation.

**Step 10 — Create engagement plan.**
Apply the Engagement Plan Rules (§7). For each key stakeholder, specify: objective, message_frame, ask, channel, timing, owner, success_signal.

**Step 11 — Create 7-day action plan.**
Produce concrete actions for the next 7 days. Every action must have: owner, due date, and proof artifact.

**Step 12 — Synthesize recommended path.**
Apply the Recommended Path Rules (§8). If confidence is high (3+ evidence-backed stakeholders, 2+ risks with early signals), produce the `actionable` variant. Otherwise, produce the `insufficient_information` variant explaining what's missing.

**Step 13 — Collect citations and open questions.**
Gather all verbatim quotes referenced in the analysis. Each citation must include speaker and approximate location. Surface unresolved questions about stakeholder positions or dynamics.

**Step 14 — Assemble and validate output.**
Construct the full output object. Verify it satisfies the output schema before returning. All required fields must be present. `recommended_path` is optional — include it when Step 12 produces a result.

---

## 4. Evidence Rules

- Every stakeholder stance, influence assessment, and risk must be grounded in at least one transcript quote or explicitly labeled as inference.
- Citations must be verbatim. Do not paraphrase and present as a quote.
- Distinguish **"not observed"** from **"negative evidence."**
  - Not observed: a stakeholder not mentioned is a coverage gap, not evidence of irrelevance. Note it in `open_questions`.
  - Negative evidence: a stakeholder who raised objections or expressed resistance. Cite the specific exchange and score accordingly.
- If evidence for a claim is weak, lower the `alignment_score`, set `stance` to `unknown`, and surface the gap in `open_questions`.
- Attribute quotes accurately. Ensure the quoted text matches the speaker and context.

---

## 5. Stakeholder Profiling Rules

### Alignment score anchors

| Range | Meaning |
|---|---|
| 0-20 | Actively opposed. Has stated objections or taken blocking actions. |
| 21-40 | Skeptical. Raised material concerns that are unaddressed. |
| 41-60 | Neutral or ambiguous. Has not taken a clear position. |
| 61-80 | Supportive with reservations. Generally in favor but has conditions. |
| 81-100 | Strongly aligned. Actively championing or explicitly endorsing. |

### Influence level criteria

| Level | Criteria |
|---|---|
| `low` | No decision authority. Opinions are heard but not decisive. |
| `medium` | Influences the decision through expertise, team control, or political capital. Cannot unilaterally block. |
| `high` | Can significantly delay or reshape the decision. Controls key resources or has senior leadership access. |
| `critical` | Can unilaterally approve or block. Final decision maker or holds veto power. |

### Stance assignment

Assign stance from transcript evidence, not assumptions about role:
- `supportive` — explicitly endorsed or actively advanced the proposal.
- `neutral` — participated without taking a position, or balanced pros and cons equally.
- `skeptical` — raised concerns or objections but did not outright oppose.
- `opposed` — explicitly pushed back, proposed alternatives, or used blocking language.
- `unknown` — insufficient evidence. Use this rather than guessing.

### Hidden incentives

- Must be labeled as inference, not presented as fact.
- Ground in behavioral signals: what someone emphasized, avoided, or deflected.
- Consider: career incentives, team resource competition, political alliances, prior commitments, reporting relationships.

---

## 6. Risk Identification Rules

**Per-risk requirements:**
1. Assign a unique `id` (SR-001, SR-002, etc.).
2. Write a concrete, specific `title`. Tie to the specific stakeholder dynamic, not generic labels.
3. Set `severity` (1-5):
   - 1 = minor friction, easily resolved
   - 2 = noticeable delay or misalignment, requires effort
   - 3 = significant impact on timeline, scope, or relationships
   - 4 = major damage to initiative or cross-team trust
   - 5 = project failure or organizational political crisis
4. Set `likelihood` (1-5):
   - 1 = very unlikely given current evidence
   - 2 = possible but evidence is weak
   - 3 = plausible, some supporting evidence
   - 4 = likely, strong evidence or historical precedent
   - 5 = near certain given current trajectory
5. Assign `owner_recommendation` — the person best positioned to mitigate.
6. List `early_signals` specific enough to monitor week-over-week.
7. Write `mitigation` that is actionable. Not a restatement of the risk.

**No-inflation rule.** Do not fabricate risks to fill the output. If stakeholder dynamics are genuinely healthy, report fewer risks at lower severity. A well-aligned meeting should not produce a crisis-level analysis.

---

## 7. Engagement Plan Rules

Every entry in `engagement_plan` must include all eight fields: `stakeholder`, `objective`, `message_frame`, `ask`, `channel`, `timing`, `owner`, `success_signal`.

**No generic advice.** Do not produce entries like "manage communications better" or "keep stakeholders informed." Every entry must be specific to a named stakeholder with a concrete ask and observable success signal.

**Channel guidance:**
- `1:1` — sensitive topics, skeptics, high-power stakeholders, relationship repair.
- `group` — alignment sessions where multiple stakeholders need to hear the same message.
- `email` — formal asks, paper trails, stakeholders who prefer async.
- `doc` — alignment artifacts, shared decision records, narrative framing.
- `async` — low-urgency updates, monitoring-only stakeholders.

**Specificity test.** Before finalizing an engagement step, verify: could someone who was not in the meeting execute this step from the description alone? If not, add detail.

---

## 8. Recommended Path Rules

The `recommended_path` field is **optional** in the output. It synthesizes the entire analysis into a concrete recommendation: who to lean on, who to invest in, and who to watch.

### Decision logic

- If the analysis produces **3+ stakeholders with evidence-backed stances** AND **2+ risks with early signals**: use the **actionable** variant.
- Otherwise: use the **insufficient_information** variant.

### Actionable variant

Populate when confidence is high. Fields:

| Field | Content |
|---|---|
| `status` | `"actionable"` |
| `overall_recommendation` | 1-3 sentences: the single best path forward, who to engage first, and the key unlock. |
| `leverage` | Stakeholders to lean on. For each: who, why they're a leverage point, and exactly how to activate them. |
| `improve_relations` | Stakeholders where relationship investment yields the highest return. Typically skeptics or swing voters with legitimate concerns. For each: who, why the relationship needs investment, and exactly what to do. |
| `watch_list` | Stakeholders to monitor. For each: who, what signal to watch for, and what contingency to execute if the signal fires. |

**Quality bar for leverage/improve_relations/watch_list:**
- `how` and `contingency` must be specific actions, not platitudes.
- Every entry must trace to evidence from the stakeholder profile, coalition dynamics, or risk analysis.
- Do not duplicate the engagement plan — the recommended path is a strategic synthesis, not a task list.

### Insufficient information variant

Populate when evidence gaps prevent a confident recommendation. Fields:

| Field | Content |
|---|---|
| `status` | `"insufficient_information"` |
| `overall_recommendation` | Explains why a clear path cannot be recommended. |
| `information_gaps` | Specific missing information: absent stakeholders, unclear stances, missing org context, unattributed speakers. |
| `suggested_next_steps` | What the user should do to close the gaps: re-run with additional context, obtain a better transcript, add stakeholders to the directory. |

---

## 9. Speaker Handling

- Track speaker identity explicitly. Map each statement to its speaker.
- If speaker labels include **"Austin"** or **"Austin Mejia"**, treat as **primary decision owner signal**:
  - Prioritize extracting commitments, concerns, and open questions tied to this speaker.
  - In the engagement plan, frame other stakeholders' engagement relative to this speaker's goals.
  - In the recommended path, orient `leverage`, `improve_relations`, and `watch_list` from this speaker's perspective.
- If speaker attribution is unclear throughout the transcript, reduce confidence, note the limitation in `executive_summary`, and add a suggested action to obtain a speaker-attributed transcript.

---

## 10. Quality Bar

- **No generic advice.** Every engagement step, action, and recommendation must be specific to a named stakeholder with a concrete outcome.
- **Evidence or inference, never assertion.** Every major claim about a stakeholder's stance, influence, or motivation must cite transcript evidence or be explicitly labeled as inference.
- **Risks must be testable.** Every risk must have `early_signals` specific enough that someone could check them next week.
- **Actions must be accountable.** Every action in `next_7_day_actions` and `engagement_plan` must have an `owner`, a `due` date, and a `proof_artifact`.
- **`confidence_threshold` modulation.** When provided, exclude stakeholder findings, risks, or engagement steps where the supporting evidence falls below the threshold. Note excluded items in `open_questions`.

---

## 11. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 80 characters or garbled | Populate `executive_summary` explaining the limitation. Include a single low-severity risk (SR-001) titled "Insufficient transcript for stakeholder analysis." Set `metadata.mode_used` to `transcript_only`. Add an action to re-submit a complete transcript. Omit `recommended_path`. |
| Missing transcript field entirely | Same as above but note the missing field in `executive_summary`. Set `decision_surface` to "Unable to determine — transcript not provided." |
| Transcript has no identifiable stakeholders | Return minimal output. Populate `stakeholders` with a placeholder noting no stakeholders could be identified. Add `open_questions` asking for a transcript with speaker attribution or a `stakeholder_directory`. |
| Speaker attribution unclear | Proceed with analysis but note the limitation in `executive_summary`. Set `stance` to `unknown` for ambiguously attributed statements. If `recommended_path` is generated, use the `insufficient_information` variant citing the attribution gap. |

---

## 12. Output Contract Requirements

Output must be a valid JSON object conforming to `schemas/stakeholder-analysis.output.schema.json`. Do not include fields not defined in the schema (`additionalProperties: false`).

**Required fields:**

| Field | Type | Constraint |
|---|---|---|
| `executive_summary` | string | 2-4 sentences. Write for a reader who will not read the full output. |
| `decision_surface` | string | The core decision or initiative the analysis is oriented around. |
| `stakeholders` | array | minItems: 1. Each item: name, role, influence_level, stance, evidence, goals, concerns, hidden_incentives_or_constraints, alignment_score (0-100), change_readiness. |
| `power_interest_map` | array | minItems: 1. Each item: name, power (1-5), interest (1-5), quadrant. |
| `coalition_dynamics` | object | likely_allies, likely_blockers, swing_stakeholders, relationship_risks (all string arrays). |
| `risks` | array | minItems: 1. Each item: id, title, severity (1-5), likelihood (1-5), owner_recommendation, early_signals, mitigation. |
| `engagement_plan` | array | minItems: 1. Each item: stakeholder, objective, message_frame, ask, channel, timing, owner, success_signal. |
| `next_7_day_actions` | array | minItems: 1. Each item: action, owner, due, proof_artifact. |
| `open_questions` | array | Strings. May be empty. |
| `citations` | array | Each item: quote, speaker, approximate_location. |
| `metadata` | object | mode_used (transcript_only or transcript_plus_context), generated_at (ISO 8601). |

**Optional field:**

| Field | Type | Constraint |
|---|---|---|
| `recommended_path` | object | One of two variants discriminated by `status`. See Recommended Path Rules (§8). Omit entirely when evidence is too thin to produce either variant. |

All nested objects enforce `additionalProperties: false`. Do not add extra fields to any object in the output.

---

## 13. Example Outputs

### Transcript-only mode (abbreviated)

```json
{
  "executive_summary": "The APAC expansion discussion reveals four key stakeholders with divergent priorities. Sophie Laurent (CFO) is the most influential skeptic — her compliance concerns are unaddressed and could block budget approval. The Singapore-first pivot has broad alignment but Japan timeline ambiguity creates board narrative risk.",
  "decision_surface": "Whether to proceed with APAC expansion via Singapore-first strategy",
  "stakeholders": [
    {
      "name": "Ravi Patel",
      "role": "VP of Strategy",
      "influence_level": "critical",
      "stance": "supportive",
      "evidence": ["We've been circling this for two quarters and leadership wants a decision by end of month."],
      "goals": ["Deliver a board-ready APAC decision by end of month"],
      "concerns": ["Timeline feasibility for Q4 GA"],
      "hidden_incentives_or_constraints": ["Board pressure for APAC presence to support Series C narrative [inference]"],
      "alignment_score": 80,
      "change_readiness": "high"
    }
  ],
  "power_interest_map": [
    { "name": "Ravi Patel", "power": 5, "interest": 5, "quadrant": "manage_closely" }
  ],
  "coalition_dynamics": {
    "likely_allies": ["Ravi Patel — executive sponsor driving the initiative"],
    "likely_blockers": ["Sophie Laurent — will block if compliance concerns are unresolved"],
    "swing_stakeholders": ["Diana Osei — neutral on strategy but her infra assessment gates the timeline"],
    "relationship_risks": ["Kenji's commercial optimism may clash with Sophie's financial conservatism"]
  },
  "risks": [
    {
      "id": "SR-001",
      "title": "CFO blocks budget without compliance resolution",
      "severity": 5,
      "likelihood": 4,
      "owner_recommendation": "Ravi Patel",
      "early_signals": ["Sophie requests formal legal opinion before next meeting"],
      "mitigation": "Commission expedited legal review of Japanese Qualified Invoice System requirements before steering committee."
    }
  ],
  "engagement_plan": [
    {
      "stakeholder": "Sophie Laurent",
      "objective": "Convert skepticism to conditional support",
      "message_frame": "We've heard your compliance concerns and are prioritizing legal review before committing.",
      "ask": "Review the revised Singapore-standalone financial model",
      "channel": "1:1",
      "timing": "Before Thursday's steering committee",
      "owner": "Ravi Patel",
      "success_signal": "Sophie agrees the Singapore model is viable pending legal review"
    }
  ],
  "next_7_day_actions": [
    {
      "action": "Commission expedited legal review of Qualified Invoice System requirements",
      "owner": "Ravi Patel",
      "due": "Monday EOD",
      "proof_artifact": "Legal team confirms engagement via email"
    }
  ],
  "open_questions": ["What is the board's minimum acceptable APAC milestone for Series C?"],
  "citations": [
    {
      "quote": "Manual currency conversion is a compliance nightmare.",
      "speaker": "Sophie Laurent",
      "approximate_location": "mid-discussion, during payments debate"
    }
  ],
  "metadata": {
    "mode_used": "transcript_only",
    "generated_at": "2026-03-12T10:00:00Z"
  }
}
```

### Transcript + context mode (abbreviated, showing recommended_path)

```json
{
  "executive_summary": "With the focal decision to launch Singapore in Q4 and Japan in Q2, stakeholder alignment is moderate but fragile. Sophie Laurent holds effective veto power through budget control and her compliance concerns are legitimate. Ravi Patel is the strongest champion but needs to bridge the gap between Kenji's commercial optimism and Diana's infrastructure realism.",
  "decision_surface": "Launch Singapore as lead APAC market in Q4, with Japan as phased follow-on in Q2 next year",
  "stakeholders": ["... 4 stakeholders profiled ..."],
  "recommended_path": {
    "status": "actionable",
    "overall_recommendation": "Secure Sophie's conditional support by addressing compliance concerns before steering committee. Use Ravi's sponsorship to frame the two-phase board narrative. Monitor Kenji's timeline claims against Diana's engineering estimates.",
    "leverage": [
      {
        "stakeholder": "Ravi Patel",
        "why": "Executive sponsor with board access; his endorsement legitimizes the pivot",
        "how": "Co-author the two-phase board narrative doc and have him present at steering committee"
      }
    ],
    "improve_relations": [
      {
        "stakeholder": "Sophie Laurent",
        "why": "Highest-power skeptic with legitimate unaddressed compliance concerns",
        "how": "Commission expedited legal review and present findings 1:1 before steering committee"
      }
    ],
    "watch_list": [
      {
        "stakeholder": "Kenji Tanaka",
        "signal": "Continues quoting aggressive timelines without engineering validation",
        "contingency": "Cross-check every timeline with Diana's estimates before including in revised plan"
      }
    ]
  },
  "metadata": {
    "mode_used": "transcript_plus_context",
    "generated_at": "2026-03-12T10:30:00Z"
  }
}
```
