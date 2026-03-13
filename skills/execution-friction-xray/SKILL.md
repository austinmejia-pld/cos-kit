---
name: execution-friction-xray
description: Diagnose execution drag from a single meeting transcript by identifying friction hotspots (ownership, dependencies, timelines, handoffs, and scope ambiguity), scoring severity/likelihood, and producing a concrete 7-day friction-kill plan with evidence citations. Use when momentum is slipping, launches are at risk, or cross-functional delivery is stalling.
---

## 1. Purpose

Diagnose execution drag from a meeting transcript — where momentum is stuck, who owns unblocking, and what to do in the next 7 days to kill friction. Ground every finding in verbatim transcript evidence. Prefer explicit uncertainty over false confidence. Never fabricate friction, owners, or dependencies.

Canonical contracts:
- Input: `schemas/execution-friction-xray.input.schema.json`
- Output: `schemas/execution-friction-xray.output.schema.json`

---

## 2. Input Reference

The only required field is `transcript`. All other fields are optional but improve analysis quality.

### Mode detection

- If any of `meeting_title`, `meeting_datetime`, `team_context`, `focus_area`, `urgency_level`, `analysis_depth`, `participant_directory`, or `key_questions` are present: **transcript_plus_context** mode.
- Otherwise: **transcript_only** mode.

Set `metadata.mode_used` in the output accordingly.

### Optional fields

| Field | When to provide | Effect on output |
|---|---|---|
| `meeting_title` | When the meeting has a known subject line or agenda title. | Adds context for friction categorization (e.g., a "launch review" meeting biases toward timeline and dependency friction). |
| `meeting_datetime` | When you need timeline friction anchored to a real date. | Enables date-aware kill plan due dates. Without it, kill plan uses relative dates. |
| `team_context` | When background on the team, project, or org would improve root cause analysis. | Grounds friction detection in real constraints. Without it, the analysis uses only what the transcript reveals. |
| `focus_area` | When a specific execution concern should be prioritized. | Friction hotspots related to this area are weighted higher in scoring and placed first in output. Examples: `"launch readiness"`, `"cross-team handoff"`, `"resourcing constraints"`. |
| `urgency_level` | When the execution context has a known time sensitivity. | `critical` = imminent deadline, tightest scrutiny. `low` = exploratory. Adjusts severity weighting — higher urgency raises the severity floor for timeline and dependency friction. |
| `analysis_depth` | When you want to control thoroughness. | `quick` = top friction points only (3 hotspots). `standard` = balanced coverage (3-6 hotspots). `deep` = exhaustive, granular evidence, more hotspots (6+). Without it, defaults to `standard`. |
| `participant_directory` | When you know attendees' names, roles, and teams. | Improves owner attribution and cross-team friction detection. Enables role-aware owner recommendations. |
| `key_questions` | When there are specific execution concerns to investigate. | Each question becomes a targeted probe. Answers surface in hotspots or ambiguities. Max 8 items. |

### Transcript-only input example

```json
{
  "transcript": "Alice: The API migration is supposed to ship next Thursday but the data team hasn't started their side yet. Bob: We're blocked on the schema review — nobody approved it. Carol: I thought Dave was handling that? Bob: Dave said he'd look at it but I haven't heard back in two weeks..."
}
```

### Transcript + context input example

```json
{
  "transcript": "Alice: The API migration is supposed to ship next Thursday but the data team hasn't started their side yet...",
  "meeting_title": "API Migration Standup — Week 8",
  "meeting_datetime": "2026-03-10T10:00:00-07:00",
  "team_context": "Platform team (12 engineers) migrating from monolith to microservices. Data team (6 engineers) owns schema changes. Both report to VP Eng.",
  "focus_area": "cross-team handoff",
  "urgency_level": "high",
  "analysis_depth": "deep",
  "participant_directory": [
    { "name": "Alice Chen", "role": "Platform Tech Lead", "team": "Platform" },
    { "name": "Bob Park", "role": "Data Engineering Lead", "team": "Data" },
    { "name": "Carol Davis", "role": "PM", "team": "Product" }
  ],
  "key_questions": [
    "Is the Thursday ship date realistic given the schema review blocker?",
    "Who actually owns the schema review approval?"
  ]
}
```

---

## 3. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm `transcript` is present and at least 100 characters. If missing or too short, apply Failure Handling (§11) immediately.

**Step 2 — Detect mode.**
If any optional context field is present, set mode to `transcript_plus_context`. Otherwise, set mode to `transcript_only`.

**Step 3 — Read the transcript for structure.**
Read the full transcript once without scoring. Map: speaker identities, proposals discussed, decisions made, decisions deferred, disagreements, dependencies mentioned, deadlines stated, and emotional tone shifts.

**Step 4 — Identify objective and critical path.**
Determine the team's stated or implied objective from the transcript. Trace the critical path — the sequence of tasks, decisions, and handoffs that must complete for the objective to be achieved. In `transcript_plus_context` mode with `focus_area`, orient the critical path around that area.

**Step 5 — Detect friction signals by category.**
Scan the transcript using the Friction Category Taxonomy (§4). For each signal, capture the verbatim quote, speaker, and approximate location. A single transcript segment may produce friction signals in multiple categories.

**Step 6 — Distinguish symptoms from root causes.**
For each friction signal, separate the observable symptom (what was said) from the underlying root cause (why it creates drag). A missed deadline is a symptom; an unowned handoff is the root cause. Write `why_it_creates_drag` as the root cause, not the symptom.

**Step 7 — Score each hotspot.**
Apply the Scoring Rules (§5). Assign `severity` (1-5), `likelihood` (1-5), and `blast_radius` (local/cross_team/org_wide). Compute the aggregate `friction_score` (0-100). If `urgency_level` is provided, apply urgency modulation.

**Step 8 — Produce fixes and the 7-day kill plan.**
Apply the Kill Plan and Highest-Leverage Move Rules (§7). For each hotspot, write a `recommended_fix` with a named `owner_recommendation` and `target_resolution_window`. Assemble the `next_7_day_friction_kill_plan` with at least 3 actions. Every action must trace to a hotspot or critical path risk.

**Step 9 — Identify the single highest-leverage move.**
Select the one action that would most reduce execution friction if completed. Write `why` in terms of what it unblocks. This is for an executive who can only do one thing.

**Step 10 — Assemble and validate output.**
Collect citations (at least 2 verbatim quotes). Surface ambiguities with clarifying questions. Construct the full output object. Verify it satisfies the output schema before returning. All required fields must be present.

---

## 4. Friction Category Taxonomy

Scan the transcript for these friction categories. A hotspot belongs to exactly one category — choose the root cause category, not the symptom.

| Category | What to look for |
|---|---|
| `ownership` | No named owner for a task, decision, or deliverable. "Someone should..." language. Shared ownership with no DRI. Tasks acknowledged but not claimed. |
| `dependency` | Work blocked on another team, person, or external factor. Upstream deliverables with no confirmed date. Third-party approvals pending. |
| `timeline` | Aggressive deadlines with no buffer. Dates stated without validation. Competing timelines across workstreams. Slippage acknowledged but not replanned. |
| `scope` | Requirements unclear, changing, or contested. "I thought we agreed..." language. Feature creep mid-execution. Spec gaps discovered late. |
| `decision_latency` | Decisions deferred ("let's take it offline"), stuck in review, or requiring absent approvers. Decisions made but not communicated to executors. |
| `handoff` | Work passing between teams or people with unclear responsibilities. "I thought Dave was handling that" moments. Gaps between who produces and who consumes a deliverable. |
| `resourcing` | Understaffing, overcommitted individuals, bandwidth conflicts, competing priorities. "We don't have capacity" or "I'm stretched across three things." |
| `signal_noise` | Meetings that generate heat but not clarity. Status updates that mask blockers. Optimistic reporting that contradicts evidence. Circular discussion with no resolution. |

---

## 5. Scoring Rules

### Severity anchors (1-5)

| Score | Meaning |
|---|---|
| 1 | Minor inconvenience. Easily resolved by one person in a day. |
| 2 | Noticeable drag. Requires coordination to fix but won't derail the objective. |
| 3 | Significant friction. Will delay the critical path if not addressed this sprint. |
| 4 | Major blocker. Threatens the objective timeline or requires escalation. |
| 5 | Critical path is broken. The objective cannot be achieved until this is resolved. |

### Likelihood anchors (1-5)

| Score | Meaning |
|---|---|
| 1 | Very unlikely given current evidence. Mentioned as a hypothetical. |
| 2 | Possible but evidence is weak. One signal, no corroboration. |
| 3 | Plausible. Multiple signals or one strong signal with historical precedent. |
| 4 | Likely. Strong evidence and no mitigation in progress. |
| 5 | Near certain. Already materializing or has materialized. |

### Blast radius

| Level | Definition |
|---|---|
| `local` | Impact contained to a single team or workstream. |
| `cross_team` | Friction propagates across two or more teams. Handoffs, shared dependencies, or coordination failures. |
| `org_wide` | Impacts leadership decisions, board timelines, customer commitments, or organizational reputation. |

### Friction score (0-100)

Compute `friction_score` as a composite reflecting the aggregate execution drag:
- Count of hotspots, weighted by severity x likelihood.
- Bonus weight for `cross_team` and `org_wide` blast radius.
- Anchor: a meeting with 3 medium-severity (3), medium-likelihood (3), local hotspots scores ~40-50. A meeting with 5+ high-severity hotspots spanning multiple teams scores 70+.

### Urgency modulation

When `urgency_level` is provided:
- `critical`: raise severity by 1 (capped at 5) for any hotspot on the critical path. A severity-3 timeline friction becomes severity-4.
- `high`: use scoring rules as-is.
- `medium`: default behavior.
- `low`: reduce severity by 1 (floored at 1) for timeline and dependency friction. Long-horizon work tolerates more slack.

### No-inflation rule

Do not fabricate hotspots to fill the output. If the meeting is genuinely low-friction, report a low `friction_score` with the minimum 3 hotspots at low severity. A routine standup should not produce a crisis-level analysis.

---

## 6. Evidence Rules

- Do not output a hotspot, critical path risk, or ambiguity without at least one verbatim transcript quote in `evidence`. The output schema enforces `minItems: 1` on evidence.
- Quotes must come directly from the transcript. Do not paraphrase and present as a quote.
- Distinguish **"not observed"** from **"negative evidence."**
  - Not observed: a topic never raised is a coverage gap, not evidence of friction. Note it in `ambiguities_to_resolve` if relevant.
  - Negative evidence: a topic raised with poor outcomes. Cite the specific exchange and score accordingly.
- If evidence for a hotspot is weak or circumstantial, lower `severity` and `likelihood`, state the uncertainty in `why_it_creates_drag`, and surface the gap in `ambiguities_to_resolve`.
- Attribute quotes accurately. Ensure the quoted text matches the speaker and context.

---

## 7. Kill Plan and Highest-Leverage Move Rules

### Kill plan actions

Every entry in `next_7_day_friction_kill_plan` must include all four fields:

| Field | Requirement |
|---|---|
| `action` | Specific, executable task. Not "discuss further" or "align on priorities." State what needs to happen, with whom, and what the output is. |
| `owner` | A named participant or role from the meeting. If no obvious owner, assign the most senior participant and note the ambiguity. |
| `due` | A concrete date within 7 days. Derive from meeting context. If `meeting_datetime` is provided, use absolute dates. Otherwise, use relative dates ("Wednesday EOD"). |
| `proof_artifact` | The tangible output that proves the action is complete — a document, decision, email, approval, or deliverable. |

**Specificity test.** Before finalizing an action, verify: could someone who was not in the meeting execute this action from the description alone? If not, add detail.

**Derivation rule.** Every kill plan action must trace to at least one hotspot or critical path risk in the output. Do not add actions disconnected from the analysis.

### Highest-leverage move

The `single_highest_leverage_move` must satisfy:
- **Singular.** One action, not a compound "do X and Y."
- **Decisive.** Completing it materially changes the friction posture.
- **Grounded.** The `why` field explains what it unblocks or accelerates, referencing specific hotspots.
- **Observable.** The `success_signal` is something a third party could verify.

---

## 8. Speaker Handling

- Track speaker identity explicitly. Map each statement to its speaker.
- **Primary user designation.** The invoker may designate a `focus_person` (a name or name variants) at invocation time. When a speaker in the transcript matches `focus_person`, treat them as the **primary accountable party**:
  - Prioritize extracting their commitments, concerns, and open questions.
  - Orient owner recommendations and the kill plan from their perspective.
  - In `single_highest_leverage_move`, consider whether this person is the right owner or the right person to assign the owner.
- If `focus_person` is not provided, no speaker receives special treatment. All speakers are analyzed equally.
- If speaker attribution is unclear throughout the transcript, reduce confidence in owner recommendations, note the limitation in `executive_summary`, and add an ambiguity entry recommending a speaker-attributed transcript.

---

## 9. Guardrails

1. **No generic advice.** Every hotspot fix, kill plan action, and owner recommendation must be specific to the transcript content. Reject outputs containing phrases like "improve communication," "increase alignment," or "establish clearer processes" without naming the specific person, action, and artifact.
2. **No invented dependencies or owners.** Only reference dependencies and people that appear in the transcript or `participant_directory`. If an owner is unclear, say so — do not fabricate.
3. **Every hotspot must have transcript evidence.** A hotspot without at least one verbatim quote in `evidence` is invalid. Do not generate a hotspot from inference alone.
4. **Separate observed fact from inferred root cause.** The `evidence` field captures what was said. The `why_it_creates_drag` field captures the inferred root cause. Label inferences as such when the causal chain is not explicit in the transcript.

---

## 10. Quality Checklist

Before returning output, verify:

- [ ] At least 3 friction hotspots with distinct categories.
- [ ] Each hotspot has a `recommended_fix` with a named `owner_recommendation`.
- [ ] Each hotspot has at least 1 evidence entry with a verbatim transcript quote.
- [ ] `why_it_creates_drag` explains the root cause, not just the symptom.
- [ ] Kill plan has 3+ actions, each with a specific `action`, named `owner`, concrete `due` date, and verifiable `proof_artifact`.
- [ ] `single_highest_leverage_move` is one action, not a compound task.
- [ ] Citations include at least 2 verbatim transcript quotes.
- [ ] `friction_score` is calibrated — a routine meeting scores below 40, a crisis meeting scores above 70.
- [ ] No generic advice appears anywhere in the output.
- [ ] All `evidence` quotes are verbatim from the transcript, not paraphrased.

---

## 11. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 100 characters or garbled beyond interpretation | Set `friction_score` to 0. Write `executive_summary` explaining the limitation. Populate `friction_hotspots` with 3 minimal low-severity entries titled "Insufficient transcript for friction analysis." Populate `next_7_day_friction_kill_plan` with 3 actions recommending re-submission of a complete transcript. Set `metadata.mode_used` to `transcript_only`. |
| Missing transcript field entirely | Same as above but note the missing field in `executive_summary`. |
| Transcript has no identifiable friction | Set `friction_score` to a low value (0-15). Populate `friction_hotspots` with 3 low-severity, low-likelihood entries reflecting the meeting's low-friction nature. Do not inflate. Populate `ambiguities_to_resolve` with probing questions to validate the assessment. |
| Speaker attribution unclear throughout | Proceed with analysis. Note the limitation in `executive_summary`. Set `owner_recommendation` to the most plausible candidate and flag the uncertainty. Add an ambiguity entry recommending a speaker-attributed transcript. |

---

## 12. Output Contract Requirements

Output must be a valid JSON object conforming to `schemas/execution-friction-xray.output.schema.json`. Do not include fields not defined in the schema (`additionalProperties: false`).

**Required fields:**

| Field | Type | Constraint |
|---|---|---|
| `executive_summary` | string | 2-4 sentences. Covers the most critical hotspots, friction score rationale, and the single highest-leverage move. Write for a reader who will not read the full output. |
| `friction_score` | integer | 0-100. Higher = more execution friction. See Scoring Rules (§5). |
| `friction_hotspots` | array | minItems: 3. Each item: `id`, `category` (8-value enum), `title`, `why_it_creates_drag`, `severity` (1-5), `likelihood` (1-5), `blast_radius` (3-value enum), `early_warning_signals` (string[]), `evidence` (minItems: 1, each: `speaker`, `quote`, `approximate_location`), `recommended_fix`, `owner_recommendation`, `target_resolution_window`. |
| `critical_path_risks` | array | Each item: `risk`, `blocking_dependency`, `owner`, `due_or_trigger`, `unblock_action`. May be empty if no critical path risks exist. |
| `ambiguities_to_resolve` | array | Each item: `ambiguity`, `why_it_matters`, `proposed_clarifying_question`. May be empty. |
| `next_7_day_friction_kill_plan` | array | minItems: 3. Each item: `action`, `owner`, `due`, `proof_artifact`. |
| `single_highest_leverage_move` | object | `move`, `why`, `owner`, `deadline`, `success_signal`. |
| `citations` | array | minItems: 2. Each item: `quote`, `speaker`, `approximate_location`. |
| `metadata` | object | `mode_used` (`transcript_only` or `transcript_plus_context`), `generated_at` (ISO 8601 datetime). |

All nested objects enforce `additionalProperties: false`. Do not add extra fields to any object in the output.

---

## 13. Example Outputs

### Transcript-only mode (abbreviated)

```json
{
  "executive_summary": "API migration carries a friction score of 62/100, driven by an unowned schema review blocking the data team (ownership), a hard Thursday deadline with no validated timeline (timeline), and a two-week-old handoff gap between platform and data teams (handoff). The single highest-leverage move is getting Dave to approve or reject the schema review by tomorrow EOD.",
  "friction_score": 62,
  "friction_hotspots": [
    {
      "id": "FH-001",
      "category": "ownership",
      "title": "Schema review approval has no confirmed owner",
      "why_it_creates_drag": "Dave was assumed to own the review but has not responded in two weeks. Without a confirmed DRI, the data team remains blocked and the platform team is planning against a deadline that cannot be met.",
      "severity": 5,
      "likelihood": 5,
      "blast_radius": "cross_team",
      "early_warning_signals": [
        "Dave does not respond to direct ping by EOD tomorrow",
        "No schema review on anyone's sprint board"
      ],
      "evidence": [
        {
          "speaker": "Bob",
          "quote": "We're blocked on the schema review — nobody approved it.",
          "approximate_location": "early discussion"
        },
        {
          "speaker": "Bob",
          "quote": "Dave said he'd look at it but I haven't heard back in two weeks.",
          "approximate_location": "mid-discussion"
        }
      ],
      "recommended_fix": "Ping Dave today with a 24-hour deadline to approve or escalate. If no response by tomorrow EOD, reassign the review to Bob with Carol as tiebreaker.",
      "owner_recommendation": "Carol (PM, best positioned to escalate)",
      "target_resolution_window": "24 hours"
    },
    {
      "id": "FH-002",
      "category": "dependency",
      "title": "Data team blocked on schema review, platform team unaware of downstream impact",
      "why_it_creates_drag": "The data team cannot start their migration work until the schema review completes. The platform team is operating as if Thursday is achievable without accounting for this dependency.",
      "severity": 4,
      "likelihood": 5,
      "blast_radius": "cross_team",
      "early_warning_signals": [
        "Data team sprint has no migration tasks scheduled",
        "Platform team's Thursday plan does not include data team dependency"
      ],
      "evidence": [
        {
          "speaker": "Alice",
          "quote": "The API migration is supposed to ship next Thursday but the data team hasn't started their side yet.",
          "approximate_location": "opening statement"
        }
      ],
      "recommended_fix": "Map the dependency chain: schema review -> data team work -> integration testing -> ship. Calculate the minimum calendar time needed and compare to Thursday deadline. Communicate the gap to stakeholders today.",
      "owner_recommendation": "Alice (Tech Lead, owns the migration timeline)",
      "target_resolution_window": "48 hours"
    },
    {
      "id": "FH-003",
      "category": "timeline",
      "title": "Thursday ship date is not validated against actual work remaining",
      "why_it_creates_drag": "The Thursday deadline was stated but no one validated it against the current state of work. With the data team not started and schema review pending, the deadline is likely fictional. Continuing to plan against it wastes coordination effort and delays the necessary replan.",
      "severity": 3,
      "likelihood": 4,
      "blast_radius": "local",
      "early_warning_signals": [
        "No updated timeline shared after this meeting",
        "Team continues referencing Thursday without caveats"
      ],
      "evidence": [
        {
          "speaker": "Alice",
          "quote": "The API migration is supposed to ship next Thursday but the data team hasn't started their side yet.",
          "approximate_location": "opening statement"
        }
      ],
      "recommended_fix": "Alice to draft a revised timeline today that accounts for schema review resolution + data team ramp. Share with stakeholders before EOD Wednesday with a new ship date or explicit conditions for holding Thursday.",
      "owner_recommendation": "Alice",
      "target_resolution_window": "this sprint"
    }
  ],
  "critical_path_risks": [
    {
      "risk": "Schema review remains unresolved, blocking data team and entire migration",
      "blocking_dependency": "Dave's review approval (2 weeks overdue)",
      "owner": "Carol",
      "due_or_trigger": "Tomorrow EOD — if no response, escalate to VP Eng",
      "unblock_action": "Direct ping to Dave with 24-hour deadline; pre-draft escalation email to VP Eng as contingency"
    }
  ],
  "ambiguities_to_resolve": [
    {
      "ambiguity": "Is Dave still the right person to review the schema, or has his role changed?",
      "why_it_matters": "If Dave is no longer responsible, the two-week wait was misdirected and the actual reviewer hasn't been engaged at all.",
      "proposed_clarifying_question": "Carol: Can you confirm Dave is still the schema review owner? If not, who should it be reassigned to?"
    }
  ],
  "next_7_day_friction_kill_plan": [
    {
      "action": "Ping Dave with explicit 24-hour deadline to approve or reject schema review",
      "owner": "Carol",
      "due": "Today EOD",
      "proof_artifact": "Slack message or email to Dave with deadline, cc'd to Alice and Bob"
    },
    {
      "action": "Draft revised migration timeline accounting for schema review delay and data team ramp",
      "owner": "Alice",
      "due": "Wednesday EOD",
      "proof_artifact": "Updated timeline doc shared in #api-migration channel"
    },
    {
      "action": "If Dave does not respond by tomorrow EOD, escalate to VP Eng and reassign schema review to Bob",
      "owner": "Carol",
      "due": "Thursday morning",
      "proof_artifact": "Escalation email sent or schema review reassigned with new reviewer confirmed"
    }
  ],
  "single_highest_leverage_move": {
    "move": "Get Dave to approve or reject the schema review by tomorrow EOD",
    "why": "Every downstream task — data team migration work, integration testing, ship date — is blocked on this single approval. Resolving it unblocks the entire critical path.",
    "owner": "Carol",
    "deadline": "Tomorrow EOD",
    "success_signal": "Schema review has an approved/rejected status and the data team has a green light to begin work"
  },
  "citations": [
    {
      "quote": "We're blocked on the schema review — nobody approved it.",
      "speaker": "Bob",
      "approximate_location": "early discussion"
    },
    {
      "quote": "Dave said he'd look at it but I haven't heard back in two weeks.",
      "speaker": "Bob",
      "approximate_location": "mid-discussion"
    }
  ],
  "metadata": {
    "mode_used": "transcript_only",
    "generated_at": "2026-03-12T10:00:00Z"
  }
}
```

### Transcript + context mode (abbreviated)

Input included `focus_area: "cross-team handoff"`, `urgency_level: "high"`, and `participant_directory`.

```json
{
  "executive_summary": "Cross-team handoff friction scores 71/100 with urgency modulation applied. The schema review ownership gap (FH-001, severity 5) is the root of a dependency chain blocking both Platform and Data teams. With a high urgency level and a Thursday hard deadline, the single highest-leverage move is Carol escalating the schema review today — every hour of delay compresses the data team's already-zero buffer.",
  "friction_score": 71,
  "friction_hotspots": [
    {
      "id": "FH-001",
      "category": "handoff",
      "title": "Schema review handoff between Platform and Data teams has no DRI",
      "why_it_creates_drag": "The schema review sits at the boundary between Platform (producer) and Data (consumer). Neither team owns the approval step. Dave was informally asked but never formally assigned. This handoff gap is the root cause of the two-week stall.",
      "severity": 5,
      "likelihood": 5,
      "blast_radius": "cross_team",
      "early_warning_signals": [
        "No schema review owner on any team's sprint board",
        "Carol unable to name the DRI when asked directly"
      ],
      "evidence": [
        {
          "speaker": "Carol",
          "quote": "I thought Dave was handling that?",
          "approximate_location": "mid-discussion, reacting to blocker"
        },
        {
          "speaker": "Bob",
          "quote": "Dave said he'd look at it but I haven't heard back in two weeks.",
          "approximate_location": "mid-discussion"
        }
      ],
      "recommended_fix": "Carol to formally assign the schema review to Dave (or a replacement) in the team tracker today with an explicit SLA. If Dave cannot commit by EOD, reassign to Bob and have Carol approve as tiebreaker.",
      "owner_recommendation": "Carol Davis (PM)",
      "target_resolution_window": "24 hours"
    },
    {
      "id": "FH-002",
      "category": "dependency",
      "title": "Data team migration work blocked on unresolved schema review",
      "why_it_creates_drag": "Bob's team cannot begin migration implementation until the schema is approved. With urgency_level high and a Thursday deadline, every day of delay is a day the data team cannot recover.",
      "severity": 5,
      "likelihood": 5,
      "blast_radius": "cross_team",
      "early_warning_signals": [
        "Data team has no migration tasks in current sprint",
        "Bob flags blocker again at next standup with no change"
      ],
      "evidence": [
        {
          "speaker": "Alice",
          "quote": "The API migration is supposed to ship next Thursday but the data team hasn't started their side yet.",
          "approximate_location": "opening statement"
        }
      ],
      "recommended_fix": "Once schema review resolves, Bob to immediately assign migration tasks to his team with a compressed timeline. Alice and Bob to sync daily until integration is complete.",
      "owner_recommendation": "Bob Park (Data Engineering Lead)",
      "target_resolution_window": "begins as soon as schema review resolves"
    },
    {
      "id": "FH-003",
      "category": "timeline",
      "title": "Thursday deadline is fictional given current blockers",
      "why_it_creates_drag": "The ship date was never validated against the dependency chain. With schema review unresolved and data team at zero progress, Thursday is unreachable. Continuing to reference it creates false urgency without productive action.",
      "severity": 4,
      "likelihood": 5,
      "blast_radius": "cross_team",
      "early_warning_signals": [
        "No revised timeline shared after this meeting",
        "Stakeholders still expecting Thursday delivery"
      ],
      "evidence": [
        {
          "speaker": "Alice",
          "quote": "The API migration is supposed to ship next Thursday but the data team hasn't started their side yet.",
          "approximate_location": "opening statement"
        }
      ],
      "recommended_fix": "Alice to draft a revised timeline within 24 hours. Communicate the new date (or conditions for the original date) to all stakeholders by Wednesday EOD.",
      "owner_recommendation": "Alice Chen (Platform Tech Lead)",
      "target_resolution_window": "48 hours"
    }
  ],
  "critical_path_risks": [
    {
      "risk": "Schema review stall extends past Wednesday, making any Thursday-adjacent date impossible",
      "blocking_dependency": "Dave's approval or reassignment of schema review",
      "owner": "Carol Davis",
      "due_or_trigger": "Tomorrow EOD — if unresolved, escalate to VP Eng",
      "unblock_action": "Formal assignment with SLA today; escalation path pre-drafted"
    }
  ],
  "ambiguities_to_resolve": [
    {
      "ambiguity": "Does Dave have the authority and context to approve the schema, or was he the wrong person from the start?",
      "why_it_matters": "If Dave was never the right reviewer, reassignment resolves faster than chasing him. If he is the right person but deprioritized it, escalation is the lever.",
      "proposed_clarifying_question": "Carol: Was Dave formally assigned the schema review, or was it an informal ask? Does he have the technical context to approve it?"
    }
  ],
  "next_7_day_friction_kill_plan": [
    {
      "action": "Formally assign schema review with 24-hour SLA in team tracker",
      "owner": "Carol Davis",
      "due": "2026-03-10 EOD",
      "proof_artifact": "Tracker ticket assigned with SLA and notification sent to Dave"
    },
    {
      "action": "Draft revised migration timeline with dependency chain mapped",
      "owner": "Alice Chen",
      "due": "2026-03-12",
      "proof_artifact": "Timeline doc shared in #api-migration with new ship date"
    },
    {
      "action": "Escalate to VP Eng if schema review unresolved by tomorrow EOD",
      "owner": "Carol Davis",
      "due": "2026-03-11 AM",
      "proof_artifact": "Escalation email sent with context and ask"
    }
  ],
  "single_highest_leverage_move": {
    "move": "Carol formally assigns the schema review with a 24-hour SLA today",
    "why": "The informal 'Dave will look at it' approach has failed for two weeks. A formal assignment with an SLA converts an ambiguous handoff into an accountable task, unblocking the entire critical path.",
    "owner": "Carol Davis",
    "deadline": "2026-03-10 EOD",
    "success_signal": "Schema review has a named owner in the tracker with a committed completion date"
  },
  "citations": [
    {
      "quote": "I thought Dave was handling that?",
      "speaker": "Carol",
      "approximate_location": "mid-discussion"
    },
    {
      "quote": "We're blocked on the schema review — nobody approved it.",
      "speaker": "Bob",
      "approximate_location": "early discussion"
    }
  ],
  "metadata": {
    "mode_used": "transcript_plus_context",
    "generated_at": "2026-03-12T10:30:00Z"
  }
}
```
