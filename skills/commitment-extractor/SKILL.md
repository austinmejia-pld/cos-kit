---
name: commitment-extractor
description: Extract explicit and implied commitments from meeting transcripts/emails, normalize owner/date/artifact fields, and output an accountability-ready action list with evidence citations. Use when preparing follow-ups, weekly reviews, execution tracking, or decision accountability.
---

## 1. Purpose

Extract commitments from meeting transcripts — who promised what, by when, and what artifact proves completion. Ground every commitment in verbatim transcript evidence. Prefer explicit uncertainty over false attribution. Never fabricate commitments, owners, or dates.

Canonical contracts:
- Input: `skills/commitment-extractor/schemas/input.schema.json`
- Output: `skills/commitment-extractor/schemas/output.schema.json`

---

## 2. Input Reference

The only required field is `transcript`. All other fields are optional but improve extraction quality — especially owner resolution and date normalization.

### Mode detection

- If any of `participant_directory`, `focus_person`, `meeting_datetime`, `meeting_title`, `default_timezone`, `extraction_mode`, or `include_non_actionable` are present: **transcript_plus_context** mode.
- Otherwise: **transcript_only** mode.

Set `metadata.mode_used` in the output accordingly.

### Optional fields

| Field | When to provide | Effect on output |
|---|---|---|
| `meeting_title` | When the meeting has a known subject line or agenda title. | Adds context for commitment classification (e.g., a "budget review" meeting biases toward financial commitments). |
| `meeting_datetime` | When you need relative dates ("next Friday") resolved to ISO dates. | Enables `due_date_normalized` population. Without it, normalized dates remain `""`. |
| `default_timezone` | When participants span timezones or the transcript lacks timezone context. | Ensures correct date normalization. IANA format (e.g., `America/Los_Angeles`). |
| `participant_directory` | When you know attendees' names, roles, and teams. | Improves owner attribution confidence. Enables role-based prioritization and team-level rollups. |
| `focus_person` | When you want commitments filtered or highlighted for a specific person. | Output prioritizes commitments owned by or dependent on this person. Treat "Austin" and "Austin Mejia" as the same person. |
| `extraction_mode` | When you want to control extraction sensitivity. | `strict` = only explicit, unambiguous commitments. `balanced` (default) = explicit + high-confidence implied. `inclusive` = all potential commitments, may include `UNKNOWN` owners. |
| `include_non_actionable` | When you also want decisions, observations, and context captured. | Adds non-actionable items alongside actionable commitments. Default `false`. |

### Transcript-only input example

```json
{
  "transcript": "Alice: I'll send the revised budget by Thursday. Bob: Great, I'll loop in the CFO once I have it. Carol: Can someone check if legal signed off on the vendor contract?..."
}
```

### Transcript + context input example

```json
{
  "transcript": "Alice: I'll send the revised budget by Thursday. Bob: Great, I'll loop in the CFO once I have it...",
  "meeting_title": "Q2 Budget Review",
  "meeting_datetime": "2026-03-10T14:00:00-07:00",
  "default_timezone": "America/Los_Angeles",
  "participant_directory": [
    { "name": "Alice Chen", "role": "Finance Lead", "team": "Finance" },
    { "name": "Bob Park", "role": "VP Operations", "team": "Operations" }
  ],
  "focus_person": "Austin",
  "extraction_mode": "balanced",
  "include_non_actionable": false
}
```

---

## 3. Workflow

Execute these steps in order. Do not skip steps.

**Step 1 — Validate input.**
Confirm `transcript` is present and at least 80 characters. If missing or too short, apply Failure Handling (section 8) immediately.

**Step 2 — Detect mode.**
If any optional context field is present, set mode to `transcript_plus_context`. Otherwise, set mode to `transcript_only`.

**Step 3 — Read the transcript for structure.**
Read the full transcript once without extracting. Map: speaker labels, conversation flow, topic transitions, and closing action-item segments. Identify the "action items" portion of the meeting if one exists.

**Step 4 — Identify action-bearing statements.**
Scan for language patterns that signal commitments: explicit promises ("I'll have it by..."), directive assignments ("Can you..."), agreements ("Agreed, let's..."), and conditional plans ("If X, then we'll Y"). Mark each candidate with the speaker, approximate location, and verbatim quote.

**Step 5 — Separate commitments from discussion.**
Filter out speculative language, brainstorming, rhetorical questions, and status updates that don't carry an action obligation. In `strict` mode, only retain statements with an explicit owner and action verb. In `balanced` mode, also retain high-confidence implied commitments. In `inclusive` mode, retain all candidates.

**Step 6 — Deduplicate and merge.**
If two candidates refer to the same underlying commitment (e.g., a request and its acceptance), merge into a single commitment entry. Preserve all source evidence from both candidates. Treat name variants as the same person (e.g., "Austin" and "Austin Mejia").

**Step 7 — Attribute owners.**
For each commitment, determine the owner:
- If someone explicitly says "I'll do X" → owner is the speaker, confidence `high`.
- If someone is asked "Can you do X?" and accepts → owner is the respondent, confidence `high`.
- If someone is asked but does not explicitly accept → owner is the askee, confidence `medium`.
- If a task is mentioned but no one is named → set owner to `UNKNOWN` (only in `inclusive` mode; otherwise exclude), confidence `low`.

**Step 8 — Normalize dates.**
For each commitment with a date reference:
- Capture the verbatim date language in `due_date_raw`.
- If `meeting_datetime` is provided, resolve relative dates ("next Friday", "in two weeks") to ISO 8601 in `due_date_normalized`.
- If `meeting_datetime` is absent, set `due_date_normalized` to `""`.
- If no date is mentioned, set both fields to `""`.

**Step 9 — Classify and prioritize.**
For each commitment:
- Set `commitment_type`: `deliverable` (tangible output), `decision` (choice made), `follow_up` (post-meeting action), `coordination` (alignment/handoff), `investigation` (research/info-gathering).
- Set `status`: `new` (first mentioned here), `carried` (follow-up from prior discussion), `unclear`.
- Set `priority`: based on urgency language, speaker authority, downstream dependency count, and deadline proximity.

**Step 10 — Assign proof artifacts.**
For each commitment, infer the expected proof artifact — the tangible output that proves completion. Be specific: "Revised plan document shared in #channel" not "document."

**Step 11 — Identify dependencies and blockers.**
Cross-reference commitments to find dependency chains (CMT-002 blocks CMT-004). Flag external blockers mentioned in the transcript.

**Step 12 — Score confidence.**
Set `confidence_score` (0.0–1.0) per commitment:
- 0.9–1.0: explicit owner, explicit deadline, clear scope, verbatim evidence.
- 0.7–0.89: explicit owner, deadline or scope partially implied.
- 0.5–0.69: owner implied, deadline vague or missing.
- 0.0–0.49: speculative, inferred from context, weak evidence.

**Step 13 — Flag missing fields.**
For any commitment missing owner, due date, proof artifact, or scope clarity, create a `missing_fields` entry with a specific follow-up question.

**Step 14 — Identify unassigned actions.**
Capture action items mentioned in the transcript that have no identifiable owner.

**Step 15 — Build owner rollup.**
Aggregate commitments per owner. Count total and critical-priority items.

**Step 16 — Write summary.**
Summarize in 2–4 sentences: total commitment count, key owners, critical items, and notable gaps. Write for a reader who will not read the full output.

**Step 17 — Assemble and validate output.**
Construct the full output object. Verify it conforms to the output schema before returning. All required fields must be present.

---

## 4. Extraction Rules

1. **Speaker labels are primary.** Prioritize commitments tied to named speakers. A commitment without a speaker label requires stronger contextual evidence.
2. **Name normalization.** Treat "Austin" and "Austin Mejia" as the same primary person. Apply the same logic to other name variants (first name vs. full name).
3. **No duplicates.** If a request and its acceptance describe the same commitment, merge them into one entry. Preserve all source evidence quotes from both.
4. **Uncertain owners.** If the owner cannot be determined, set `owner` to `UNKNOWN` and `owner_confidence` to `low`. Only include UNKNOWN-owner commitments when `extraction_mode` is `inclusive`.
5. **Evidence required.** Every commitment must have at least one `source_evidence` entry with a verbatim transcript quote. No exceptions.
6. **Explicit vs. inferred.** Distinguish between an explicit promise ("I'll have it by Friday") and an inferred next step ("Someone should probably check with legal"). Set `confidence_score` accordingly.

---

## 5. Evidence Rules

- Every `source_evidence` entry must be a verbatim quote from the transcript. Do not paraphrase and present as a quote.
- Attribute quotes to the correct speaker. If speaker attribution is unclear, set `speaker` to `"Unknown"`.
- Include `approximate_location` to help the reader find the quote in the original transcript (e.g., "closing action items", "during infrastructure discussion").
- A single commitment may have multiple evidence entries when the commitment spans a request-acceptance exchange.

---

## 6. Output Contract

Output must conform to `skills/commitment-extractor/schemas/output.schema.json`. All objects enforce `additionalProperties: false`.

| Field | Type | Constraint |
|---|---|---|
| `summary` | string | 2-4 sentences. Total count, key owners, critical items, gaps. |
| `commitments` | array | minItems: 1. Each: `id`, `commitment_text`, `commitment_type`, `owner`, `owner_confidence`, `due_date_raw`, `due_date_normalized`, `status`, `priority`, `proof_artifact_expected`, `dependencies`, `blockers`, `source_evidence` (minItems: 1), `confidence_score` (0–1). |
| `unassigned_actions` | array | Strings. Action items with no identifiable owner. May be empty. |
| `missing_fields` | array | Each: `commitment_id`, `missing` (enum array), `suggested_followup_question`. |
| `owner_rollup` | array | Each: `owner`, `count` (integer), `critical_count` (integer). |
| `metadata` | object | `mode_used` (`transcript_only` or `transcript_plus_context`), `generated_at` (ISO 8601). |

---

## 7. Guardrails

1. **No fabricated commitments.** If the transcript contains no actionable commitments, return a minimal valid output with a summary explaining the finding. Do not invent commitments to fill the output.
2. **No fabricated dates.** If a date is not stated or inferable, leave `due_date_raw` and `due_date_normalized` as `""`. Do not guess.
3. **Explicit vs. inferred.** Clearly distinguish an explicit promise from an inferred next step via `confidence_score` and `owner_confidence`. An inferred step with weak evidence should score below 0.5.
4. **Concise, high-signal output.** Each commitment should be actionable and specific. Avoid restating discussion points as commitments unless someone took clear ownership.
5. **No extra fields.** Output must not include fields beyond what the schema defines.

---

## 8. Failure Handling

Never fail ungracefully. Always return schema-valid output.

| Condition | Action |
|---|---|
| Transcript < 80 characters or garbled | Set `metadata.mode_used` to `transcript_only`. Return a single low-confidence commitment (CMT-001, confidence 0.1) titled "Insufficient transcript for extraction." Set `summary` explaining the limitation. |
| Missing transcript field | Same as above but note missing field in `summary`. |
| Transcript has no identifiable commitments | Return `commitments` with a single placeholder entry (confidence 0.1) noting no actionable commitments found. Populate `unassigned_actions` and `missing_fields` as empty arrays. |
| Speaker attribution unclear throughout | Proceed with extraction. Set `owner_confidence` to `low` on affected commitments. Set all `speaker` fields to `"Unknown"` where attribution cannot be determined. Note the issue in `summary`. |

---

## 9. Quality Checklist

Before returning output, verify:

- [ ] Every commitment has `owner`, `due_date_raw`, and `proof_artifact_expected` populated — or an explicit `missing_fields` entry explaining the gap.
- [ ] Every commitment has at least one `source_evidence` entry with a verbatim quote.
- [ ] `confidence_score` is calibrated: explicit promises score 0.85+, inferred steps score below 0.7, speculative items below 0.5.
- [ ] `missing_fields[].suggested_followup_question` is specific enough that someone could ask it in a Slack message and get a useful answer.
- [ ] `owner_rollup` matches the actual commitment-owner distribution.
- [ ] No duplicate commitments (same action, same owner).
- [ ] `due_date_normalized` is populated only when `meeting_datetime` was provided or the date is absolute.

---

## 10. Example Outputs

### Transcript-only example

Minimal input with only a transcript. Dates cannot be normalized (no `meeting_datetime`).

```json
{
  "summary": "3 commitments extracted across 2 owners. Alice owns the highest-priority deliverable (revised budget). One action (vendor contract legal review) has no clear owner.",
  "commitments": [
    {
      "id": "CMT-001",
      "commitment_text": "Send revised budget to Bob",
      "commitment_type": "deliverable",
      "owner": "Alice",
      "owner_confidence": "high",
      "due_date_raw": "by Thursday",
      "due_date_normalized": "",
      "status": "new",
      "priority": "high",
      "proof_artifact_expected": "Revised budget document sent to Bob via email or shared drive",
      "dependencies": [],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Alice",
          "quote": "I'll send the revised budget by Thursday.",
          "approximate_location": "opening discussion"
        }
      ],
      "confidence_score": 0.92
    },
    {
      "id": "CMT-002",
      "commitment_text": "Loop in CFO once revised budget is received",
      "commitment_type": "coordination",
      "owner": "Bob",
      "owner_confidence": "high",
      "due_date_raw": "",
      "due_date_normalized": "",
      "status": "new",
      "priority": "medium",
      "proof_artifact_expected": "Email or meeting invite including CFO and revised budget",
      "dependencies": ["CMT-001"],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Bob",
          "quote": "Great, I'll loop in the CFO once I have it.",
          "approximate_location": "opening discussion"
        }
      ],
      "confidence_score": 0.88
    },
    {
      "id": "CMT-003",
      "commitment_text": "Verify legal sign-off on vendor contract",
      "commitment_type": "investigation",
      "owner": "UNKNOWN",
      "owner_confidence": "low",
      "due_date_raw": "",
      "due_date_normalized": "",
      "status": "new",
      "priority": "medium",
      "proof_artifact_expected": "Confirmation from legal that vendor contract is approved",
      "dependencies": [],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Carol",
          "quote": "Can someone check if legal signed off on the vendor contract?",
          "approximate_location": "mid-meeting discussion"
        }
      ],
      "confidence_score": 0.55
    }
  ],
  "unassigned_actions": [
    "Vendor contract legal sign-off check — Carol raised it but no owner volunteered"
  ],
  "missing_fields": [
    {
      "commitment_id": "CMT-002",
      "missing": ["due_date"],
      "suggested_followup_question": "Bob, by when do you need to loop in the CFO — same day you receive the budget, or by end of week?"
    },
    {
      "commitment_id": "CMT-003",
      "missing": ["owner", "due_date", "scope_clarity"],
      "suggested_followup_question": "Who is responsible for checking vendor contract legal sign-off, and by when is this needed?"
    }
  ],
  "owner_rollup": [
    { "owner": "Alice", "count": 1, "critical_count": 0 },
    { "owner": "Bob", "count": 1, "critical_count": 0 },
    { "owner": "UNKNOWN", "count": 1, "critical_count": 0 }
  ],
  "metadata": {
    "mode_used": "transcript_only",
    "generated_at": "2026-03-12T10:00:00Z"
  }
}
```

### With context and focus_person example

Input includes `meeting_datetime`, `participant_directory`, and `focus_person: "Austin"`. Dates are normalized.

```json
{
  "summary": "4 commitments extracted across 3 owners. Austin owns 2 items including the critical Q2 roadmap draft (due 2026-03-20). One commitment lacks a proof artifact.",
  "commitments": [
    {
      "id": "CMT-001",
      "commitment_text": "Draft Q2 product roadmap with updated priorities from this discussion",
      "commitment_type": "deliverable",
      "owner": "Austin",
      "owner_confidence": "high",
      "due_date_raw": "by next Friday",
      "due_date_normalized": "2026-03-20",
      "status": "new",
      "priority": "critical",
      "proof_artifact_expected": "Q2 roadmap doc shared in #product-planning channel",
      "dependencies": [],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Austin",
          "quote": "I'll have the Q2 roadmap draft ready by next Friday with the updated priorities we discussed.",
          "approximate_location": "closing action items"
        }
      ],
      "confidence_score": 0.95
    },
    {
      "id": "CMT-002",
      "commitment_text": "Schedule design review with UX team for the onboarding redesign",
      "commitment_type": "coordination",
      "owner": "Austin",
      "owner_confidence": "medium",
      "due_date_raw": "early next week",
      "due_date_normalized": "2026-03-16",
      "status": "new",
      "priority": "medium",
      "proof_artifact_expected": "Calendar invite sent to UX team for design review",
      "dependencies": [],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Morgan",
          "quote": "Austin, can you set up a design review with UX early next week?",
          "approximate_location": "during onboarding discussion"
        }
      ],
      "confidence_score": 0.78
    },
    {
      "id": "CMT-003",
      "commitment_text": "Pull usage metrics for current onboarding funnel",
      "commitment_type": "investigation",
      "owner": "Priya",
      "owner_confidence": "high",
      "due_date_raw": "by Wednesday",
      "due_date_normalized": "2026-03-18",
      "status": "new",
      "priority": "high",
      "proof_artifact_expected": "Dashboard link or data export shared with product team",
      "dependencies": [],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Priya",
          "quote": "I'll pull the usage metrics by Wednesday so we have data for the design review.",
          "approximate_location": "during onboarding discussion"
        }
      ],
      "confidence_score": 0.91
    },
    {
      "id": "CMT-004",
      "commitment_text": "Share competitive analysis findings with the team",
      "commitment_type": "follow_up",
      "owner": "Jordan",
      "owner_confidence": "high",
      "due_date_raw": "before the next sync",
      "due_date_normalized": "",
      "status": "carried",
      "priority": "low",
      "proof_artifact_expected": "Competitive analysis document or summary shared async",
      "dependencies": [],
      "blockers": [],
      "source_evidence": [
        {
          "speaker": "Jordan",
          "quote": "I'll share the competitive analysis before our next sync — been meaning to close the loop on that.",
          "approximate_location": "closing remarks"
        }
      ],
      "confidence_score": 0.75
    }
  ],
  "unassigned_actions": [],
  "missing_fields": [
    {
      "commitment_id": "CMT-004",
      "missing": ["due_date", "artifact"],
      "suggested_followup_question": "Jordan, when is 'next sync' — and will you share via Slack, email, or a shared doc?"
    }
  ],
  "owner_rollup": [
    { "owner": "Austin", "count": 2, "critical_count": 1 },
    { "owner": "Priya", "count": 1, "critical_count": 0 },
    { "owner": "Jordan", "count": 1, "critical_count": 0 }
  ],
  "metadata": {
    "mode_used": "transcript_plus_context",
    "generated_at": "2026-03-12T10:30:00Z"
  }
}
```
