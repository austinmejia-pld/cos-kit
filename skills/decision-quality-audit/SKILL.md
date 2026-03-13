---
name: decision-quality-audit
description: Audit the quality of decision-making from a single meeting transcript by scoring clarity, evidence, alternatives, risk analysis, and accountability; then produce concrete decision-hygiene upgrades. Use when teams need to improve decision rigor, avoid rework, and increase execution confidence.
---

## 1. Purpose

Audit the quality of a decision made (or not made) in a meeting. Score the decision process across six dimensions, surface gaps and untested assumptions, and produce specific, operational upgrades for the next meeting. Ground every finding in verbatim transcript evidence. Prefer explicit uncertainty over false confidence. Never fabricate evidence, scores, or quotes.

Canonical contracts:
- Input: `schemas/decision-quality-audit.input.schema.json`
- Output: `schemas/decision-quality-audit.output.schema.json`

---

## 2. Input Reference

The only required field is `transcript`. All other fields are optional but improve audit quality — especially decision focus, participant context, and risk tolerance calibration.

### Mode detection

- If any of `decision_focus`, `strategic_context`, `risk_tolerance`, `analysis_depth`, `participant_directory`, `key_questions`, `meeting_title`, or `meeting_datetime` are present: **transcript_plus_context** mode.
- Otherwise: **transcript_only** mode.

Set `metadata.mode_used` in the output accordingly.

### Optional fields

| Field | When to provide | Effect on output |
|---|---|---|
| `meeting_title` | When the meeting has a known subject line or agenda title. | Adds context for decision classification and executive summary framing. |
| `meeting_datetime` | When you need relative dates ("next Friday") resolved to ISO dates. | Enables deadline normalization in `accountability_snapshot`. Without it, deadlines remain as stated. |
| `decision_focus` | When there's a specific decision to audit rather than scanning broadly. | Centers the entire audit on this decision. Without it, the auditor identifies the primary decision surface from the transcript. |
| `strategic_context` | When organizational background helps calibrate decision quality (company stage, board expectations, competitive pressures). | Improves gap detection and risk weighting. Without it, the audit uses only what the transcript reveals. |
| `risk_tolerance` | When the organization has an explicit risk posture. | `low` = flag all gaps aggressively. `medium` = flag material gaps. `high` = only flag critical gaps. Without it, defaults to `medium` behavior. |
| `analysis_depth` | When you want to control thoroughness. | `quick` = high-level score and top gaps only (fewer assumptions, shorter output). `standard` (default) = full audit. `deep` = exhaustive analysis with maximum evidence citation and assumption surfacing. |
| `participant_directory` | When you know attendees' names, roles, and teams. | Improves owner attribution in `accountability_snapshot` and enables role-aware gap detection. |
| `key_questions` | When there are specific concerns about decision quality to investigate. | Each question becomes a targeted probe. Answers surface in gaps, assumptions, or the executive summary. Max 8 items. |

### Transcript-only input example

```json
{
  "transcript": "Alice: I think we should go with vendor B. They're cheaper and the integration timeline is shorter. Bob: But vendor A has better security certifications. Alice: We can deal with security later..."
}
```

### Transcript + context input example

```json
{
  "transcript": "Alice: I think we should go with vendor B. They're cheaper and the integration timeline is shorter...",
  "meeting_title": "Vendor Selection — Final Decision",
  "meeting_datetime": "2026-03-10T14:00:00-07:00",
  "decision_focus": "Select vendor B over vendor A for the payments integration",
  "strategic_context": "Series B SaaS company. SOC 2 audit scheduled for Q3. Board expects platform stability for Series C.",
  "risk_tolerance": "low",
  "analysis_depth": "deep",
  "participant_directory": [
    { "name": "Alice Chen", "role": "VP Engineering", "team": "Engineering" },
    { "name": "Bob Park", "role": "Head of Security", "team": "InfoSec" }
  ],
  "key_questions": [
    "Was the security trade-off explicitly acknowledged?",
    "Did anyone quantify the cost difference between vendors?"
  ]
}
```

---

## 3. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm `transcript` is present and at least 100 characters. If missing or too short, apply Failure Handling (§9) immediately.

**Step 2 — Detect mode.**
If any optional context field is present, set mode to `transcript_plus_context`. Otherwise, set mode to `transcript_only`.

**Step 3 — Read the transcript for structure.**
Read the full transcript once without scoring. Map: speaker identities, proposals discussed, decisions made, decisions deferred, disagreements, evidence cited, and closing action items. Note topic transitions and emotional tone shifts.

**Step 4 — Identify the decision surface.**
- In `transcript_plus_context` mode with `decision_focus`: use it directly.
- Otherwise: infer the central decision, proposal, or choice point from the transcript. State it concretely in `decision_surface`.

**Step 5 — Classify decision status.**
Determine whether the group reached a decision:
- `clear_decision` — an explicit choice was made and acknowledged by participants. Look for: "We're going with X," "Agreed," "Let's do X."
- `tentative_decision` — a direction was set but with caveats, conditions, or pending information. Look for: "Let's plan for X pending Y," "Leaning toward X," deferral of final commitment.
- `no_decision` — the topic was discussed but no direction was established. Look for: "Let's revisit," "We need more data," circular discussion without resolution.

**Step 6 — Evaluate evidence quality.**
For each major claim or assertion in the discussion, assess: was data cited? Were numbers specific or vague? Were sources named? Was counter-evidence acknowledged? Score `evidence_quality` based on the ratio of evidence-backed claims to unsupported assertions.

**Step 7 — Detect missing alternatives and underweighted risks.**
Identify alternatives that should have been considered but were not discussed. Identify risks that were mentioned but insufficiently explored, or risks that were not raised at all but are material given the decision context. Populate `alternatives_missing` and `risks_underweighted`.

**Step 8 — Surface assumptions.**
Identify assumptions underpinning the decision — both explicit (stated aloud) and implicit (inferred from context). For each, assess validation status (`yes`, `partial`, `no`, `unknown`) and write a specific, low-cost way to test it. Populate `assumptions`. Minimum 3 assumptions for `standard` and `deep` modes.

**Step 9 — Evaluate ownership and accountability quality.**
Assess: were owners named for next steps? Were deadlines stated? Were proof artifacts identified? Were follow-up checkpoints established? Populate `accountability_snapshot` with each commitment, its owner, timeline, proof artifact, and confidence level. Score `ownership_and_accountability` and `reversibility_and_checkpoints`.

**Step 10 — Score each dimension.**
Apply the Scoring Rubric (§4) to assign integer scores (0–100) for each of the six dimensions:
- `clarity_of_decision`
- `evidence_quality`
- `alternatives_considered`
- `risk_assessment_quality`
- `ownership_and_accountability`
- `reversibility_and_checkpoints`

**Step 11 — Compute composite score.**
Calculate `decision_quality_score` as a weighted average of the six dimension scores. Default weights: clarity 20%, evidence 20%, alternatives 15%, risk assessment 20%, ownership 15%, reversibility 10%. Adjust emphasis based on `analysis_depth` and `risk_tolerance` if provided.

**Step 12 — Generate upgrades.**
Produce `decision_hygiene_upgrades_next_meeting` — specific, operational process improvements the group should adopt. Then select the single highest-leverage upgrade for `single_most_important_upgrade` with owner, deadline, and success signal. No generic advice ("communicate better"). Every upgrade must be actionable by a named person.

**Step 13 — Collect citations.**
Gather all verbatim quotes referenced in the analysis. Each citation must include speaker and approximate location. Minimum 2 citations.

**Step 14 — Assemble and validate output.**
Construct the full output object. Verify it conforms to the output schema before returning. All required fields must be present and non-empty where the schema mandates it.

---

## 4. Scoring Rubric

### Dimension definitions

| Dimension | What to assess | High signals (80+) | Low signals (<60) |
|---|---|---|---|
| `clarity_of_decision` | Was the decision articulated? Did participants understand and acknowledge it? Is the decision statement specific enough to act on? | Explicit decision statement, group acknowledgment, specific scope and boundaries. | Vague direction, no explicit statement, participants left with different interpretations. |
| `evidence_quality` | Were claims backed by data? Were sources cited? Was counter-evidence considered? | Specific numbers, named sources, data-driven comparisons, counter-evidence discussed. | Anecdotal reasoning, unsupported assertions, no data cited, counter-evidence dismissed. |
| `alternatives_considered` | Were multiple options discussed? Were trade-offs articulated? Was the option space sufficiently explored? | 3+ options discussed, explicit trade-off analysis, structured comparison. | Single option presented as fait accompli, no trade-off discussion, obvious alternatives ignored. |
| `risk_assessment_quality` | Were risks identified? Were they weighted by likelihood and impact? Were mitigations proposed? | Named risks with severity assessment, mitigation plans, contingencies discussed. | Risks dismissed or unmentioned, no mitigation, optimism bias unchallenged. |
| `ownership_and_accountability` | Were owners assigned? Were deadlines stated? Were proof artifacts defined? | Named owners, specific deadlines, tangible deliverables, clear handoffs. | No owners, vague timelines ("soon"), no follow-up mechanism, diffusion of responsibility. |
| `reversibility_and_checkpoints` | Were checkpoints or review gates established? Were kill criteria defined? Is the decision reversible, and does the group know the cost of reversal? | Explicit review dates, kill criteria, reversal plan discussed. | No checkpoints, one-way-door decision treated as trivially reversible, no review scheduled. |

### Score interpretation bands

| Range | Interpretation |
|---|---|
| **80–100** | **Strong decision process.** The group applied rigorous analysis, considered alternatives, assessed risks, and established clear accountability. Minor gaps may exist but do not threaten execution. |
| **60–79** | **Acceptable with gaps.** The decision is defensible but has identifiable weaknesses — missing alternatives, untested assumptions, or incomplete accountability. Address gaps before execution accelerates. |
| **Below 60** | **Fragile decision process.** Material gaps in evidence, alternatives, risk assessment, or accountability. The decision is at risk of rework, misalignment, or failure. Recommend pausing to close critical gaps before proceeding. |

### analysis_depth modulation

- `quick`: Score all six dimensions but abbreviate `gaps` (minimum 2), `assumptions` (minimum 2), and `citations` (minimum 2). Skip `accountability_snapshot` details — include only owners and commitments without proof artifacts.
- `standard`: Full audit. Apply all minimums from the output schema (gaps: 2, assumptions: 3, citations: 2). Complete `accountability_snapshot` with all fields.
- `deep`: Maximize evidence citation. Surface 5+ assumptions where evidence supports it. Expand gap evidence arrays. Address every `key_question` explicitly in the output.

---

## 5. Evidence Rules

- Every `evidence` entry in a gap and every `citations` entry must be a verbatim quote from the transcript. Do not paraphrase and present as a quote.
- Attribute quotes to the correct speaker. If speaker attribution is unclear, set `speaker` to `"Unknown"`.
- Include `approximate_location` to help the reader find the quote in the original transcript (e.g., "opening remarks", "during vendor comparison", "closing action items").
- Distinguish **"not observed"** from **"negative evidence."**
  - Not observed: a topic never raised is a coverage gap. Surface it in `alternatives_missing`, `risks_underweighted`, or `gaps`. Do not fabricate evidence to fill it.
  - Negative evidence: a topic raised with poor outcomes (e.g., risk dismissed without analysis). Cite the specific exchange and score accordingly.
- If evidence for a gap or assumption is weak, lower the relevant dimension score, state the uncertainty explicitly, and note the limitation in the gap's `why_it_matters` or the assumption's `how_to_test_fast`.

---

## 6. Output Contract

Output must be a valid JSON object conforming to `schemas/decision-quality-audit.output.schema.json`. All objects enforce `additionalProperties: false`.

| Field | Type | Constraint |
|---|---|---|
| `executive_summary` | string | 2–4 sentences. What was decided (or not), overall quality, biggest gap. |
| `decision_surface` | string | Concise statement of the decision being audited. |
| `decision_status` | string | One of `clear_decision`, `tentative_decision`, `no_decision`. |
| `decision_quality_score` | integer | 0–100. Weighted composite of score_breakdown dimensions. |
| `score_breakdown` | object | Six integer fields (0–100): `clarity_of_decision`, `evidence_quality`, `alternatives_considered`, `risk_assessment_quality`, `ownership_and_accountability`, `reversibility_and_checkpoints`. |
| `strengths` | array of strings | What the group did well. May be empty for very weak decisions. |
| `gaps` | array | minItems: 2. Each: `gap`, `why_it_matters`, `impact_level` (low/medium/high/critical), `evidence` (array of {speaker, quote, approximate_location}), `fix`. |
| `assumptions` | array | minItems: 3. Each: `assumption`, `explicit_or_implicit` (explicit/implicit), `validated` (yes/partial/no/unknown), `how_to_test_fast`. |
| `alternatives_missing` | array of strings | Options not discussed but worth considering. |
| `risks_underweighted` | array of strings | Risks insufficiently explored or not raised. |
| `accountability_snapshot` | array | Each: `owner`, `commitment`, `due_or_window`, `proof_artifact`, `confidence` (low/medium/high). |
| `decision_hygiene_upgrades_next_meeting` | array of strings | Specific process improvements for the next meeting. |
| `single_most_important_upgrade` | object | `upgrade`, `why`, `owner`, `deadline`, `success_signal`. |
| `citations` | array | minItems: 2. Each: `quote`, `speaker`, `approximate_location`. |
| `metadata` | object | `mode_used` (transcript_only/transcript_plus_context), `generated_at` (ISO 8601). |

---

## 7. Guardrails

1. **No fabricated evidence.** Every quote must be verbatim from the transcript. If evidence is thin, lower scores and say so. Do not invent quotes, risks, or gaps to fill the output.
2. **Separate fact from inference.** When an assumption or gap is inferred rather than directly stated, label it explicitly. Use "[inference]" in any field where the finding is not grounded in a direct quote.
3. **No generic advice.** Every entry in `decision_hygiene_upgrades_next_meeting` and the `single_most_important_upgrade` must be specific and operational. Reject formulations like "communicate better," "be more aligned," or "improve decision-making." Each upgrade must name a concrete action, a context, and ideally a person.
4. **Upgrades must be actionable.** The `single_most_important_upgrade` must include a named `owner`, a `deadline`, and a `success_signal` that an observer could verify. If no owner can be determined, assign the most senior participant and note the ambiguity.
5. **No extra fields.** Output must not include fields beyond what the schema defines. All objects enforce `additionalProperties: false`.

---

## 8. Speaker Handling

- Track speaker identity explicitly. Map each statement to its speaker throughout the analysis.
- If speaker labels include **"Austin"** or **"Austin Mejia"**, treat as **primary user signal**:
  - Pay specific attention to this speaker's contributions, concerns, and commitments.
  - In `accountability_snapshot`, prioritize extracting this speaker's commitments with high detail.
  - In `gaps` and `assumptions`, flag items that directly affect this speaker's decisions or responsibilities.
  - In `decision_hygiene_upgrades_next_meeting`, orient recommendations toward what this speaker can drive.
- A variable may be passed (via `decision_focus`, `strategic_context`, or `key_questions`) that identifies a specific entity as the core user. If detected, apply the same treatment as the Austin signal.
- If speaker attribution is unclear throughout the transcript, reduce confidence in ownership-related scores, note the limitation in `executive_summary`, and add a gap entry recommending speaker-attributed transcripts for future meetings.

---

## 9. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 100 characters or garbled | Set `decision_quality_score` to 0, `decision_status` to `no_decision`. Write `executive_summary` explaining the limitation. Populate `gaps` with two minimal entries noting insufficient transcript. Set `assumptions` to three placeholder entries. Set `metadata.mode_used` to `transcript_only`. Populate `citations` with entries from whatever text is available. |
| Missing transcript field entirely | Same as above but note the missing field in `executive_summary`. Set `decision_surface` to "Unable to determine — transcript not provided." |
| Transcript has no identifiable decisions | Set `decision_status` to `no_decision`, `decision_quality_score` reflecting the process quality of the discussion. Populate `gaps` with entries noting the absence of a decision. Surface the lack of decision in `executive_summary` and `single_most_important_upgrade`. |
| Speaker attribution unclear throughout | Proceed with analysis but reduce `ownership_and_accountability` score by at least 15 points. Note the limitation in `executive_summary`. Add a gap entry recommending speaker-attributed transcripts. Set `speaker` to `"Unknown"` in evidence and citations where attribution cannot be determined. |

---

## 10. Example Outputs

### Transcript-only mode (abbreviated)

Minimal input with only a transcript. No `decision_focus` provided — the decision surface is inferred.

```json
{
  "executive_summary": "The group reached a tentative decision to lead APAC expansion with Singapore and defer Japan to Q2 next year. Decision quality scores 62/100 — evidence surfacing was solid but alternatives analysis was thin and no review checkpoints were established. The biggest gap is the absence of go/no-go criteria for the Japan follow-on.",
  "decision_surface": "Launch Singapore as lead APAC market in Q4, with Japan as phased follow-on",
  "decision_status": "tentative_decision",
  "decision_quality_score": 62,
  "score_breakdown": {
    "clarity_of_decision": 75,
    "evidence_quality": 70,
    "alternatives_considered": 45,
    "risk_assessment_quality": 55,
    "ownership_and_accountability": 65,
    "reversibility_and_checkpoints": 40
  },
  "strengths": [
    "Cross-functional representation: strategy, sales, finance, and engineering perspectives all heard",
    "Sophie raised concrete compliance risks that redirected the group's approach",
    "The Singapore-first pivot emerged from evidence rather than being imposed"
  ],
  "gaps": [
    {
      "gap": "No go/no-go criteria defined for Japan follow-on",
      "why_it_matters": "Without criteria, the Japan decision will be re-litigated from scratch, wasting cycles and risking perpetual deferral.",
      "impact_level": "high",
      "evidence": [
        {
          "speaker": "Ravi Patel",
          "quote": "Let's not commit to a Japan timeline today.",
          "approximate_location": "closing discussion"
        }
      ],
      "fix": "Define 3-4 conditions that must be true before committing to Japan (e.g., ISMAP timeline confirmed, legal review complete, Singapore unit economics validated)."
    },
    {
      "gap": "Legal review not started despite being a critical dependency",
      "why_it_matters": "Japanese Qualified Invoice System compliance was identified as a deal-breaker for enterprise, yet no legal work has begun.",
      "impact_level": "critical",
      "evidence": [
        {
          "speaker": "Kenji Tanaka",
          "quote": "Not yet. We've been focused on the commercial side. Legal review is on the roadmap but hasn't started.",
          "approximate_location": "mid-discussion"
        }
      ],
      "fix": "Assign a named owner to commission legal review this week with a deadline for preliminary findings."
    }
  ],
  "assumptions": [
    {
      "assumption": "Singapore can be served from existing US-East/EU-West infrastructure with acceptable latency",
      "explicit_or_implicit": "explicit",
      "validated": "partial",
      "how_to_test_fast": "Run latency benchmarks from Singapore to existing regions; confirm P95 meets SLA."
    },
    {
      "assumption": "Payments team can deliver lightweight multi-currency layer in three months",
      "explicit_or_implicit": "explicit",
      "validated": "no",
      "how_to_test_fast": "Get written commitment from payments team lead with scoped requirements and resource allocation."
    },
    {
      "assumption": "Singapore standalone unit economics are viable without Japan revenue mix",
      "explicit_or_implicit": "implicit",
      "validated": "no",
      "how_to_test_fast": "Have Kenji model Singapore-only P&L with conservative assumptions; validate with Sophie."
    }
  ],
  "alternatives_missing": [
    "Partner-led Japan launch via Nomura white-label to bypass infra and certification",
    "Prioritize Australia or another APAC market with lower regulatory complexity"
  ],
  "risks_underweighted": [
    "Board perception: Singapore-only may be seen as insufficient APAC commitment for Series C",
    "No APAC-based staff discussed — customer success across timezones is non-trivial"
  ],
  "accountability_snapshot": [
    {
      "owner": "Kenji Tanaka",
      "commitment": "Deliver revised GTM plan with Singapore-first unit economics",
      "due_or_window": "Next Friday",
      "proof_artifact": "Revised plan document shared with team",
      "confidence": "high"
    },
    {
      "owner": "Diana Osei",
      "commitment": "Provide infrastructure estimate for APAC region buildout",
      "due_or_window": "Wednesday",
      "proof_artifact": "Written estimate shared with Ravi",
      "confidence": "high"
    }
  ],
  "decision_hygiene_upgrades_next_meeting": [
    "Open with a recap of decision criteria: what must be true for Singapore go? For Japan go?",
    "Circulate Kenji's revised plan 48 hours before the meeting as a pre-read",
    "Explicitly ask 'What alternatives have we not considered?' before closing"
  ],
  "single_most_important_upgrade": {
    "upgrade": "Define explicit go/no-go criteria for the Japan follow-on decision",
    "why": "Without criteria, Japan will consume disproportionate meeting time and remain unresolved indefinitely.",
    "owner": "Ravi Patel",
    "deadline": "Before the two-week reconvene",
    "success_signal": "A written list of 3-5 conditions shared with the team before the next meeting."
  },
  "citations": [
    {
      "quote": "We've been circling this for two quarters and leadership wants a decision by end of month.",
      "speaker": "Ravi Patel",
      "approximate_location": "opening remarks"
    },
    {
      "quote": "Manual currency conversion is a compliance nightmare. Japan has strict invoicing requirements under the Qualified Invoice System.",
      "speaker": "Sophie Laurent",
      "approximate_location": "mid-discussion, payments debate"
    }
  ],
  "metadata": {
    "mode_used": "transcript_only",
    "generated_at": "2026-03-12T10:00:00Z"
  }
}
```

### Transcript + context mode (abbreviated)

Input includes `decision_focus`, `strategic_context`, `risk_tolerance: "low"`, `analysis_depth: "deep"`, `participant_directory`, and `key_questions`. The audit is targeted and exhaustive.

```json
{
  "executive_summary": "The Singapore-first pivot scores 68/100 — a defensible decision with material gaps in alternatives analysis and checkpoint planning. With low risk tolerance, three gaps qualify as high or critical impact. The legal review gap is the most urgent: compliance was identified as a deal-breaker yet no work has started. Key question addressed: the security trade-off between vendors A and B was not explicitly acknowledged.",
  "decision_surface": "Select vendor B over vendor A for the payments integration",
  "decision_status": "clear_decision",
  "decision_quality_score": 68,
  "score_breakdown": {
    "clarity_of_decision": 80,
    "evidence_quality": 72,
    "alternatives_considered": 50,
    "risk_assessment_quality": 60,
    "ownership_and_accountability": 75,
    "reversibility_and_checkpoints": 48
  },
  "strengths": [
    "Decision was explicitly stated and acknowledged by all participants",
    "Cost analysis was data-driven with specific numbers cited",
    "Clear owner assigned for integration timeline with a firm deadline"
  ],
  "gaps": [
    {
      "gap": "Security trade-off not explicitly acknowledged or quantified",
      "why_it_matters": "Vendor B lacks certifications that vendor A has. With SOC 2 audit in Q3, this gap could force a vendor switch mid-integration.",
      "impact_level": "critical",
      "evidence": [
        {
          "speaker": "Bob Park",
          "quote": "But vendor A has better security certifications.",
          "approximate_location": "opening discussion"
        },
        {
          "speaker": "Alice Chen",
          "quote": "We can deal with security later.",
          "approximate_location": "immediately following"
        }
      ],
      "fix": "Before signing, have InfoSec produce a gap analysis: which specific certifications does vendor B lack, what is the cost and timeline to close each gap, and does this conflict with the Q3 SOC 2 audit?"
    },
    {
      "gap": "No reversal plan if vendor B integration fails or security gaps prove unacceptable",
      "why_it_matters": "If vendor B cannot meet security requirements by Q3, switching back to vendor A mid-stream would double integration costs and timeline.",
      "impact_level": "high",
      "evidence": [
        {
          "speaker": "Alice Chen",
          "quote": "We can deal with security later.",
          "approximate_location": "opening discussion"
        }
      ],
      "fix": "Define a checkpoint at week 4 of integration: if vendor B's security gap analysis reveals blockers for Q3 SOC 2, trigger a vendor A fallback plan with pre-scoped requirements."
    }
  ],
  "assumptions": [
    {
      "assumption": "Vendor B's security gaps can be closed before the Q3 SOC 2 audit",
      "explicit_or_implicit": "implicit",
      "validated": "no",
      "how_to_test_fast": "Ask vendor B for their SOC 2 readiness timeline and compare against your Q3 audit date."
    },
    {
      "assumption": "The cost difference between vendors justifies accepting lower security posture",
      "explicit_or_implicit": "implicit",
      "validated": "no",
      "how_to_test_fast": "Quantify the cost of closing vendor B's security gaps; if it exceeds the savings, the rationale collapses."
    },
    {
      "assumption": "Integration timeline is the primary constraint, not long-term vendor relationship",
      "explicit_or_implicit": "explicit",
      "validated": "partial",
      "how_to_test_fast": "Confirm with product leadership that speed-to-market outweighs vendor lock-in risk for this integration."
    }
  ],
  "alternatives_missing": [
    "Negotiate vendor A's price down using vendor B's quote as leverage",
    "Phase the integration: start with vendor B for non-sensitive flows, vendor A for security-critical paths"
  ],
  "risks_underweighted": [
    "SOC 2 audit failure risk if vendor B security gaps are not closed by Q3",
    "Vendor switching cost if security proves unacceptable post-integration"
  ],
  "accountability_snapshot": [
    {
      "owner": "Alice Chen",
      "commitment": "Complete vendor B integration",
      "due_or_window": "6 weeks from kickoff",
      "proof_artifact": "Integration passing end-to-end tests in staging",
      "confidence": "high"
    },
    {
      "owner": "Bob Park",
      "commitment": "Produce security gap analysis for vendor B",
      "due_or_window": "End of this week",
      "proof_artifact": "Gap analysis document shared with Alice and leadership",
      "confidence": "medium"
    }
  ],
  "decision_hygiene_upgrades_next_meeting": [
    "When dismissing a concern ('we can deal with X later'), immediately ask: 'What is the cost if we can't?'",
    "For any vendor decision, require a side-by-side comparison doc as a pre-read — not a verbal walkthrough",
    "Establish a 30-day checkpoint for every vendor integration decision to review against original assumptions",
    "Assign a named devil's advocate for each decision to surface risks the group may be under-weighting"
  ],
  "single_most_important_upgrade": {
    "upgrade": "Produce a vendor B security gap analysis before signing the contract",
    "why": "The security concern was raised and dismissed without analysis. If vendor B cannot meet Q3 SOC 2 requirements, the entire decision unravels.",
    "owner": "Bob Park",
    "deadline": "End of this week",
    "success_signal": "A document listing each missing certification, estimated remediation cost and timeline, and a clear go/no-go recommendation."
  },
  "citations": [
    {
      "quote": "I think we should go with vendor B. They're cheaper and the integration timeline is shorter.",
      "speaker": "Alice Chen",
      "approximate_location": "opening remarks"
    },
    {
      "quote": "But vendor A has better security certifications.",
      "speaker": "Bob Park",
      "approximate_location": "opening discussion, response to Alice"
    },
    {
      "quote": "We can deal with security later.",
      "speaker": "Alice Chen",
      "approximate_location": "immediately following Bob's concern"
    }
  ],
  "metadata": {
    "mode_used": "transcript_plus_context",
    "generated_at": "2026-03-12T10:30:00Z"
  }
}
```
