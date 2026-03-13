## Transcript

{{transcript}}

{{context_block}}

## Output Schema

Your response must be a single JSON object conforming exactly to this schema:

```
{{output_schema}}
```

## Instructions

- Scan the transcript for execution friction across all 8 categories: ownership, dependency, timeline, scope, decision_latency, handoff, resourcing, signal_noise.
- Produce at least 3 friction hotspots, each with at least 1 verbatim evidence quote from the transcript.
- For each hotspot, write `why_it_creates_drag` as a root cause explanation, not a symptom restatement.
- Produce at least 3 entries in `next_7_day_friction_kill_plan`, each with a named owner, due date, and proof artifact.
- Produce at least 2 entries in `citations` with verbatim transcript quotes.
- Populate `critical_path_risks` with any dependencies that block forward progress.
- Populate `ambiguities_to_resolve` with unresolved questions that will create friction if left open.
- The `single_highest_leverage_move` must be ONE action (not compound) that would most reduce friction if completed.
- Set `metadata.mode_used` to "{{mode_used}}".
- Set `metadata.generated_at` to the current ISO-8601 datetime.

## Fallback behavior

When evidence for a friction point is thin or ambiguous:
- Reduce `severity` and `likelihood` scores to reflect uncertainty.
- Write the uncertainty explicitly in `why_it_creates_drag` (e.g., "Evidence is limited to a single remark; root cause may differ.").
- Surface the gap in `ambiguities_to_resolve` with a `proposed_clarifying_question`.
- Do NOT fabricate evidence or inflate scores to compensate for sparse transcripts.

Return ONLY valid JSON matching the schema above. Do not wrap in markdown code fences. Do not include any text outside the JSON object.
