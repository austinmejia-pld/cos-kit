## Transcript

{{transcript}}

{{context_block}}

## Output Schema

Your response must be a single JSON object conforming exactly to this schema:

```
{{output_schema}}
```

## Instructions

- Identify the decision surface: what decision was (or should have been) made?
- Classify the decision status: `clear_decision`, `tentative_decision`, or `no_decision`.
- Score all 6 dimensions of decision quality (0-100 each) with internal rationale before assigning numbers.
- Compute `decision_quality_score` as a weighted composite.
- Produce at least 2 entries in `gaps`, each with at least 1 verbatim evidence quote from the transcript.
- Produce at least 3 entries in `assumptions`, distinguishing explicit from implicit and assessing validation status.
- Produce at least 2 entries in `citations` with verbatim transcript quotes.
- Populate `accountability_snapshot` with every commitment, owner, timeline, proof artifact, and confidence level identified in the transcript.
- The `single_most_important_upgrade` must be ONE action (not compound) with a named owner, deadline, and success signal.
- Every entry in `decision_hygiene_upgrades_next_meeting` must be specific and operational — no generic advice.
- Set `metadata.mode_used` to "{{mode_used}}".
- Set `metadata.generated_at` to the current ISO-8601 datetime.

## Fallback behavior

When evidence for a finding is thin or ambiguous:
- Reduce the relevant dimension scores to reflect uncertainty.
- Write the uncertainty explicitly in `why_it_matters` for gaps or `how_to_test_fast` for assumptions.
- Surface the gap in `alternatives_missing` or `risks_underweighted` with a note about limited evidence.
- Add a targeted clarifying question in `decision_hygiene_upgrades_next_meeting`.
- Do NOT fabricate evidence or inflate scores to compensate for sparse transcripts.

Return ONLY valid JSON matching the schema above. Do not wrap in markdown code fences. Do not include any text outside the JSON object.
