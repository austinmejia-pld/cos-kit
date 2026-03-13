## Transcript

{{transcript}}

{{context_block}}

## Output Schema

Your response must be a single JSON object conforming exactly to this schema:

```
{{output_schema}}
```

## Instructions

- Extract every actionable commitment from the transcript above.
- For each commitment, include at least one verbatim source_evidence quote.
- Set confidence_score using the heuristic from your system instructions.
- Populate owner_rollup with accurate counts derived from the commitments array.
- Set metadata.mode_used to "{{mode_used}}".
- Set metadata.generated_at to the current ISO-8601 datetime.

Return ONLY valid JSON matching the schema above. Do not wrap in markdown code fences. Do not include any text outside the JSON object.
